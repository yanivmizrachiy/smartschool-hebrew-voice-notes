import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT_URL = process.env.VIEWER_QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.join('qa', 'print-viewer');
const EXPECTED = { cone: 46, circle: 88, cylinder: 38 };
const A4_RATIO = 297 / 210;

const assert = (condition, message) => {
  if (!condition) throw new Error(`Print viewer QA failed: ${message}`);
};

function commandExists(command) {
  return spawnSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

const chrome = process.env.CHROME_BIN || [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser'
].find(commandExists);
if (!chrome) throw new Error('No supported Chrome/Chromium executable found. Set CHROME_BIN.');
if (typeof WebSocket === 'undefined') throw new Error('Node WebSocket API is unavailable; Node 22+ is required.');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'viewer-print-cdp-'));
const port = 9722 + Math.floor(Math.random() * 400);
const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`,
  '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`,
  'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function waitForDebugPort() {
  const deadline = Date.now() + 15000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await json(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }
  throw new Error(`Chrome DevTools port did not become ready: ${lastError?.message || 'timeout'}`);
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket open timeout')), 10000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', event => { clearTimeout(timer); reject(event.error || new Error('CDP WebSocket error')); }, { once: true });
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

  close() {
    this.ws.close();
  }
}

async function evaluate(cdp, expression, awaitPromise = true) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate exception');
  return result.result?.value;
}

async function waitFor(cdp, expression, description, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(cdp, expression)) return;
    } catch {
      // Page may still be navigating.
    }
    await delay(150);
  }
  throw new Error(`Timeout waiting for ${description}`);
}

async function createTarget() {
  return json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
}

function pdfPageCount(file) {
  if (commandExists('pdfinfo')) {
    const result = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
    const match = result.stdout.match(/^Pages:\s+(\d+)$/m);
    if (result.status === 0 && match) return Number(match[1]);
  }
  const bytes = fs.readFileSync(file);
  const ascii = bytes.toString('latin1');
  const directPages = [...ascii.matchAll(/\/Type\s*\/Page\b/g)].length;
  if (directPages > 0) return directPages;
  const counts = [...ascii.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,300}?\/Count\s+(\d+)/g)].map(match => Number(match[1]));
  return counts.length ? Math.max(...counts) : 0;
}

function pdfMediaBoxes(file) {
  const ascii = fs.readFileSync(file).toString('latin1');
  return [...ascii.matchAll(/\/MediaBox\s*\[\s*0(?:\.0+)?\s+0(?:\.0+)?\s+([0-9.]+)\s+([0-9.]+)\s*\]/g)]
    .map(match => ({ width: Number(match[1]), height: Number(match[2]) }));
}

async function runTopic(topic, expected) {
  const target = await createTarget();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  try {
    await cdp.open();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.navigate', { url: `${ROOT_URL}?topic=${topic}#workbook` });

    await waitFor(
      cdp,
      `document.querySelector('#booklet-loading')?.hidden === true && document.querySelectorAll('.ws-wsframe').length === ${expected}`,
      `${topic} viewer render`
    );

    await evaluate(cdp, `window.__viewerEnsureAllFramesLoaded?.(45000)`);
    await waitFor(
      cdp,
      `[...document.querySelectorAll('.ws-sheet-frame')].every(frame => { try { return frame.contentDocument?.readyState === 'complete' && !!frame.contentDocument?.querySelector('.a4-page'); } catch { return false; } })`,
      `${topic} all iframe pages loaded`,
      45000
    );
    await evaluate(cdp, `window.__viewerPrepareFramesForPrint?.()`);
    await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
    await delay(250);

    const metrics = await evaluate(cdp, `(() => {
      const pages = [...document.querySelectorAll('.ws-wsframe')];
      const first = pages[0]?.getBoundingClientRect();
      const transforms = [...document.querySelectorAll('.ws-sheet-frame')].map(frame => {
        try { return getComputedStyle(frame.contentDocument.querySelector('.a4-page')).transform; }
        catch { return 'unreadable'; }
      });
      return {
        count: pages.length,
        firstWidth: first?.width || 0,
        firstHeight: first?.height || 0,
        ratio: first?.height / first?.width || 0,
        topbar: getComputedStyle(document.querySelector('.topbar')).display,
        wsbar: getComputedStyle(document.querySelector('.wsbar')).display,
        jump: getComputedStyle(document.querySelector('#page-jump')).display,
        pageNumberOverlay: getComputedStyle(document.querySelector('.ws-wsnum')).display,
        badTransforms: transforms.filter(value => value !== 'none').length,
        readyFrames: [...document.querySelectorAll('.ws-sheet-frame')].filter(frame => {
          try { return frame.contentDocument?.readyState === 'complete' && !!frame.contentDocument?.querySelector('.a4-page'); }
          catch { return false; }
        }).length
      };
    })()`);

    assert(metrics.count === expected, `${topic}: expected ${expected} print wrappers, got ${metrics.count}`);
    assert(metrics.readyFrames === expected, `${topic}: only ${metrics.readyFrames}/${expected} iframe pages are print-ready`);
    assert(Math.abs(metrics.ratio - A4_RATIO) < 0.01, `${topic}: print A4 ratio drifted to ${metrics.ratio}`);
    assert(metrics.topbar === 'none' && metrics.wsbar === 'none' && metrics.jump === 'none', `${topic}: viewer chrome leaked into print`);
    assert(metrics.pageNumberOverlay === 'none', `${topic}: floating viewer page number leaked into print`);
    assert(metrics.badTransforms === 0, `${topic}: ${metrics.badTransforms} A4 pages retained a mobile transform in print`);

    const pdf = await cdp.send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      paperWidth: 8.2677165354,
      paperHeight: 11.6929133858,
      scale: 1
    });
    const output = path.join(OUT_DIR, `${topic}.pdf`);
    fs.writeFileSync(output, Buffer.from(pdf.data, 'base64'));
    assert(fs.statSync(output).size > expected * 1000, `${topic}: generated PDF is unexpectedly small`);

    const pages = pdfPageCount(output);
    assert(pages === expected, `${topic}: PDF has ${pages} pages, expected ${expected}`);

    const mediaBoxes = pdfMediaBoxes(output);
    assert(mediaBoxes.length >= 1, `${topic}: PDF has no readable MediaBox`);
    for (const [index, box] of mediaBoxes.entries()) {
      const ratio = box.height / box.width;
      assert(box.width > 590 && box.width < 601, `${topic}: MediaBox ${index + 1} width ${box.width}pt is not A4`);
      assert(box.height > 838 && box.height < 846, `${topic}: MediaBox ${index + 1} height ${box.height}pt is not A4`);
      assert(Math.abs(ratio - A4_RATIO) < 0.012, `${topic}: MediaBox ${index + 1} ratio ${ratio} is not A4`);
    }

    console.log(`PASS ${topic}: ${pages} A4 PDF pages, ${metrics.firstWidth.toFixed(1)}×${metrics.firstHeight.toFixed(1)} CSS px, ${mediaBoxes.length} MediaBox record(s)`);
  } finally {
    cdp.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }
}

let exitCode = 0;
try {
  await waitForDebugPort();
  for (const [topic, expected] of Object.entries(EXPECTED)) {
    await runTopic(topic, expected);
  }
  console.log('Print viewer browser QA: PASS (cone/circle/cylinder real PDFs, exact page counts and A4 MediaBox checked)');
} catch (error) {
  exitCode = 1;
  console.error(error.stack || error.message || error);
} finally {
  browser.kill('SIGTERM');
  await delay(150);
  fs.rmSync(profile, { recursive: true, force: true });
}
process.exitCode = exitCode;
