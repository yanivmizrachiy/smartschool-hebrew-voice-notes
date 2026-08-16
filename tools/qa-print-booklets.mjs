import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT_URL = process.env.VIEWER_QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.join('qa', 'print-booklets');
const BOOKS = { cone: 46, circle: 88, cylinder: 38 };
const A4_RATIO = 297 / 210;
const assert = (condition, message) => { if (!condition) throw new Error(`Print QA failed: ${message}`); };

function commandExists(command) {
  return spawnSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

const chrome = process.env.CHROME_BIN || ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find(commandExists);
if (!chrome) throw new Error('Print QA: Chrome/Chromium not found');
if (typeof WebSocket === 'undefined') throw new Error('Print QA: Node 22+ WebSocket API required');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'print-cdp-'));
const port = 10022 + Math.floor(Math.random() * 300);
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function waitForDebugPort() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { return await json(`http://127.0.0.1:${port}/json/version`); }
    catch { await delay(120); }
  }
  throw new Error('Chrome DevTools port timeout');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP open timeout')), 10000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP socket error')); }, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate exception');
  return result.result?.value;
}

async function waitFor(cdp, expression, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await evaluate(cdp, expression)) return; } catch {}
    await delay(100);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function createTarget(url) {
  return json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
}

function countPdfPages(buffer, file) {
  if (commandExists('pdfinfo')) {
    const result = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
    const match = result.stdout.match(/^Pages:\s+(\d+)$/m);
    if (result.status === 0 && match) return Number(match[1]);
  }
  const binary = buffer.toString('latin1');
  return (binary.match(/\/Type\s*\/Page\b/g) || []).length;
}

function mediaBoxes(buffer) {
  const binary = buffer.toString('latin1');
  return [...binary.matchAll(/\/MediaBox\s*\[\s*0(?:\.0+)?\s+0(?:\.0+)?\s+([0-9.]+)\s+([0-9.]+)\s*\]/g)]
    .map(match => ({ width: Number(match[1]), height: Number(match[2]) }));
}

async function printBook(cdp, book, expected) {
  await cdp.send('Emulation.setEmulatedMedia', { media: 'screen' });
  await cdp.send('Page.navigate', { url: `${ROOT_URL}?topic=${book}#workbook` });
  await waitFor(cdp,
    `document.querySelector('#booklet-loading')?.hidden === true && document.querySelectorAll('.ws-wsframe').length === ${expected} && typeof window.__viewerEnsureAllFramesLoaded === 'function'`,
    `${book} viewer bootstrap`
  );

  await evaluate(cdp, `window.__viewerEnsureAllFramesLoaded(45000)`);
  await waitFor(cdp,
    `[...document.querySelectorAll('.ws-sheet-frame')].every(f => { try { return f.contentDocument?.readyState === 'complete' && !!f.contentDocument?.querySelector('.a4-page'); } catch { return false; } })`,
    `${book} all iframe pages ready`, 45000
  );
  await evaluate(cdp, `window.__viewerPrepareFramesForPrint()`);
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
  await delay(180);

  const printMetrics = await evaluate(cdp, `(() => {
    const frames = [...document.querySelectorAll('.ws-wsframe')];
    const first = frames[0]?.getBoundingClientRect();
    const hidden = ['.topbar','.sitenav','.hero-section','.wsbar','.site-footer','#page-jump','.ws-wsnum']
      .every(sel => { const nodes=[...document.querySelectorAll(sel)]; return nodes.every(el => getComputedStyle(el).display === 'none'); });
    const transforms = [...document.querySelectorAll('.ws-sheet-frame')].map(frame => {
      try { return getComputedStyle(frame.contentDocument.querySelector('.a4-page')).transform; }
      catch { return 'unreadable'; }
    });
    return {
      count: frames.length,
      firstWidth: first?.width || 0,
      firstHeight: first?.height || 0,
      ratio: first?.height / first?.width || 0,
      hidden,
      ready: [...document.querySelectorAll('.ws-sheet-frame')].filter(f => { try { return !!f.contentDocument?.querySelector('.a4-page'); } catch { return false; } }).length,
      badTransforms: transforms.filter(value => value !== 'none').length,
      hiddenByContentVisibility: frames.filter(frame => getComputedStyle(frame).contentVisibility === 'hidden').length
    };
  })()`);

  assert(printMetrics.count === expected, `${book}: print DOM count ${printMetrics.count}, expected ${expected}`);
  assert(printMetrics.ready === expected, `${book}: only ${printMetrics.ready}/${expected} iframe pages are print-ready`);
  assert(printMetrics.hidden, `${book}: viewer chrome is visible in print media`);
  assert(Math.abs(printMetrics.ratio - A4_RATIO) < 0.01, `${book}: print wrapper ratio ${printMetrics.ratio} is not A4`);
  assert(printMetrics.badTransforms === 0, `${book}: ${printMetrics.badTransforms} A4 pages retained mobile scale/transform in print`);
  assert(printMetrics.hiddenByContentVisibility === 0, `${book}: content-visibility hid ${printMetrics.hiddenByContentVisibility} print pages`);

  const result = await cdp.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0
  });
  const pdf = Buffer.from(result.data, 'base64');
  assert(pdf.length > 25000, `${book}: generated PDF is unexpectedly small (${pdf.length} bytes)`);

  const file = path.join(OUT_DIR, `${book}-${expected}-pages.pdf`);
  fs.writeFileSync(file, pdf);
  const pages = countPdfPages(pdf, file);
  assert(pages === expected, `${book}: PDF contains ${pages} pages, expected ${expected}`);

  const boxes = mediaBoxes(pdf);
  assert(boxes.length >= 1, `${book}: PDF has no readable MediaBox`);
  for (const [index, box] of boxes.entries()) {
    const ratio = box.height / box.width;
    assert(box.width > 590 && box.width < 601, `${book}: MediaBox ${index + 1} width ${box.width}pt is not A4`);
    assert(box.height > 838 && box.height < 846, `${book}: MediaBox ${index + 1} height ${box.height}pt is not A4`);
    assert(Math.abs(ratio - A4_RATIO) < 0.012, `${book}: MediaBox ${index + 1} ratio ${ratio} is not A4`);
  }

  console.log(`PASS ${book}: ${pages}/${expected} A4 PDF pages, ${(pdf.length / 1024).toFixed(0)} KiB`);
}

let exitCode = 0;
let cdp;
let target;
try {
  await waitForDebugPort();
  target = await createTarget('about:blank');
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  for (const [book, expected] of Object.entries(BOOKS)) {
    await printBook(cdp, book, expected);
  }
  console.log('Print QA: PASS (cone 46, circle 88, cylinder 38 — real Chrome PDFs, exact page counts, A4 media boxes, no mobile transform or viewer chrome)');
} catch (error) {
  exitCode = 1;
  console.error(error.stack || error.message || error);
} finally {
  cdp?.close();
  if (target?.id) await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  browser.kill('SIGTERM');
  await delay(120);
  fs.rmSync(profile, { recursive: true, force: true });
}
process.exitCode = exitCode;
