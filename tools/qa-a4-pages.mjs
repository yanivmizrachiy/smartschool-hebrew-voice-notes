import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT_URL = process.env.VIEWER_QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.join('qa', 'a4-pages');
const BOOKS = { circle: 88, cylinder: 38 };
const EXPECTED_RATIO = 297 / 210;
const EXPECTED_WIDTH = 210 * 96 / 25.4;
const EXPECTED_HEIGHT = 297 * 96 / 25.4;
const UNUSED_GAP_LIMIT_PX = Object.freeze({ circle: 60, cylinder: 260 });
const WARN_UNUSED_GAP_PX = 60;

function commandExists(command) {
  return spawnSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

const chrome = process.env.CHROME_BIN || ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find(commandExists);
if (!chrome) throw new Error('A4 browser QA: Chrome/Chromium not found');
if (typeof WebSocket === 'undefined') throw new Error('A4 browser QA: Node 22+ WebSocket API required');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'a4-cdp-'));
const port = 9722 + Math.floor(Math.random() * 300);
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--force-device-scale-factor=1', `--remote-debugging-port=${port}`,
  '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function removeProfileSafely(profilePath) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 2, retryDelay: 80 });
      return;
    } catch (error) {
      if (!['ENOTEMPTY', 'EBUSY', 'EPERM'].includes(error?.code)) throw error;
      if (attempt === 6) {
        console.warn(`A4 browser QA cleanup warning: could not remove temporary Chrome profile after ${attempt} attempts: ${error.message}`);
        return;
      }
      await delay(attempt * 120);
    }
  }
}

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
  throw new Error('A4 browser QA: Chrome DevTools port timeout');
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

async function waitFor(cdp, expression, label, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await evaluate(cdp, expression)) return; } catch {}
    await delay(80);
  }
  throw new Error(`A4 browser QA: timeout waiting for ${label}`);
}

async function createTarget(url) {
  return json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
}

async function capture(cdp, file) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
}

async function inspectPage(cdp, book, page) {
  const url = `${ROOT_URL}${book}/page-${page}.html`;
  await cdp.send('Page.navigate', { url });
  await waitFor(cdp, `document.readyState === 'complete' && !!document.querySelector('.a4-page')`, `${book} page ${page}`);
  await delay(40);

  const metrics = await evaluate(cdp, `(() => {
    const sheet = document.querySelector('.a4-page');
    const rect = sheet.getBoundingClientRect();
    const h1 = document.querySelectorAll('h1').length;
    const pageNumber = document.querySelector('.page-number, .local-page-number')?.textContent?.trim() || '';
    const svgs = [...document.querySelectorAll('svg')];
    const svgMissingViewBox = svgs.filter(svg => !svg.hasAttribute('viewBox')).length;
    const svgZeroSize = svgs.filter(svg => {
      const r = svg.getBoundingClientRect();
      return r.width < 1 || r.height < 1;
    }).length;
    const descendants = [...sheet.querySelectorAll('*')];
    const outliers = descendants.filter(el => {
      if (getComputedStyle(el).display === 'none') return false;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return false;
      return r.left < rect.left - 2 || r.right > rect.right + 2 || r.top < rect.top - 2 || r.bottom > rect.bottom + 2;
    }).slice(0, 8).map(el => ({ tag: el.tagName, cls: el.className?.baseVal || el.className || '', text: (el.textContent || '').trim().slice(0, 50) }));

    const footer = sheet.querySelector('.footer');
    const footerTop = footer?.getBoundingClientRect().top || (rect.bottom - 68);
    const usefulChildren = [...sheet.children].filter(el => {
      if (el.matches('.page-header,.footer,.page-number,.local-page-number')) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'absolute' || style.position === 'fixed') return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    });
    const contentBottom = usefulChildren.length
      ? Math.max(...usefulChildren.map(el => el.getBoundingClientRect().bottom))
      : rect.top;
    const unusedGapBeforeFooter = Math.max(0, footerTop - contentBottom);
    const usableTop = sheet.querySelector('.page-header')?.getBoundingClientRect().bottom || rect.top;
    const usableHeight = Math.max(1, footerTop - usableTop);
    const usedVerticalRatio = Math.max(0, Math.min(1, (contentBottom - usableTop) / usableHeight));

    return {
      width: rect.width,
      height: rect.height,
      ratio: rect.height / rect.width,
      scrollWidth: sheet.scrollWidth,
      clientWidth: sheet.clientWidth,
      scrollHeight: sheet.scrollHeight,
      clientHeight: sheet.clientHeight,
      bodyOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1,
      pageNumber,
      svgCount: svgs.length,
      svgMissingViewBox,
      svgZeroSize,
      outliers,
      unusedGapBeforeFooter,
      usedVerticalRatio,
      usefulChildCount: usefulChildren.length
    };
  })()`);

  const failures = [];
  if (Math.abs(metrics.width - EXPECTED_WIDTH) > 2) failures.push(`width ${metrics.width.toFixed(1)}px`);
  if (Math.abs(metrics.height - EXPECTED_HEIGHT) > 2) failures.push(`height ${metrics.height.toFixed(1)}px`);
  if (Math.abs(metrics.ratio - EXPECTED_RATIO) > 0.006) failures.push(`ratio ${metrics.ratio.toFixed(4)}`);
  if (metrics.scrollWidth > metrics.clientWidth + 2) failures.push(`sheet horizontal overflow ${metrics.scrollWidth - metrics.clientWidth}px`);
  if (metrics.scrollHeight > metrics.clientHeight + 2) failures.push(`sheet vertical overflow ${metrics.scrollHeight - metrics.clientHeight}px`);
  if (Math.abs(metrics.bodyOverflowX) > 2) failures.push(`document horizontal overflow ${metrics.bodyOverflowX}px`);
  if (metrics.h1 !== 1) failures.push(`h1 count ${metrics.h1}`);
  if (metrics.pageNumber !== String(page)) failures.push(`page number '${metrics.pageNumber}'`);
  if (metrics.svgMissingViewBox) failures.push(`${metrics.svgMissingViewBox} SVG(s) missing viewBox`);
  if (metrics.svgZeroSize) failures.push(`${metrics.svgZeroSize} zero-size SVG(s)`);
  if (metrics.outliers.length) failures.push(`elements outside A4: ${JSON.stringify(metrics.outliers)}`);
  const unusedGapLimit = UNUSED_GAP_LIMIT_PX[book];
  if (metrics.unusedGapBeforeFooter > unusedGapLimit && metrics.usefulChildCount > 0) {
    failures.push(`purposeless blank zone ${metrics.unusedGapBeforeFooter.toFixed(0)}px before footer (limit ${unusedGapLimit}px)`);
  }

  if (failures.length) {
    await capture(cdp, path.join(OUT_DIR, `FAIL-${book}-${String(page).padStart(2, '0')}.png`));
    throw new Error(`${book} page ${page}: ${failures.join('; ')}`);
  }

  if ([1, Math.ceil(BOOKS[book] / 2), BOOKS[book]].includes(page)) {
    await capture(cdp, path.join(OUT_DIR, `${book}-${String(page).padStart(2, '0')}.png`));
  }
  return metrics;
}

let exitCode = 0;
const summary = [];
const pageFailures = [];
let cdp;
let target;
try {
  await waitForDebugPort();
  target = await createTarget('about:blank');
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false });

  for (const [book, count] of Object.entries(BOOKS)) {
    let passed = 0;
    for (let page = 1; page <= count; page += 1) {
      try {
        const metrics = await inspectPage(cdp, book, page);
        passed += 1;
        summary.push({
          book,
          page,
          width: metrics.width,
          height: metrics.height,
          svgs: metrics.svgCount,
          unusedGapBeforeFooter: Math.round(metrics.unusedGapBeforeFooter),
          usedVerticalRatio: Number(metrics.usedVerticalRatio.toFixed(3)),
          utilizationWarning: metrics.unusedGapBeforeFooter > WARN_UNUSED_GAP_PX
        });
      } catch (error) {
        const message = error?.message || String(error);
        pageFailures.push({ book, page, message });
        console.error(`FAIL ${book} page ${page}: ${message}`);
      }
    }
    console.log(`${book}: ${passed}/${count} A4 pages passed in full-scan mode`);
  }

  const warnings = summary
    .filter(row => row.utilizationWarning)
    .sort((a, b) => b.unusedGapBeforeFooter - a.unusedGapBeforeFooter);
  if (warnings.length) {
    console.log('A4 utilization review list (non-failing unless extreme):');
    warnings.slice(0, 30).forEach(row => console.log(`${row.book} page ${row.page}: ${row.unusedGapBeforeFooter}px blank before footer; usedVerticalRatio=${row.usedVerticalRatio}`));
  }

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({
    pages: summary,
    utilizationWarnings: warnings,
    failures: pageFailures
  }, null, 2));

  if (pageFailures.length) {
    throw new Error(`A4 browser QA: ${pageFailures.length} page(s) failed. Full list:\n${pageFailures.map(item => `- ${item.book} page ${item.page}: ${item.message}`).join('\n')}`);
  }

  console.log('A4 browser QA: PASS (126 pages checked for physical size, overflow, page numbers, SVG integrity and extreme blank zones)');
} catch (error) {
  exitCode = 1;
  console.error(error.stack || error.message || error);
} finally {
  cdp?.close();
  if (target?.id) await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  const browserExited = new Promise(resolve => browser.once('exit', resolve));
  browser.kill('SIGTERM');
  await Promise.race([browserExited, delay(1500)]);
  await removeProfileSafely(profile);
}
process.exitCode = exitCode;
