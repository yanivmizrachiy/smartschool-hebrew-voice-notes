import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT_URL = process.env.VIEWER_QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.join('qa', 'mobile-viewer');
const EXPECTED = { cone: 46, circle: 93, cylinder: 41 };
const DEVICES = {
  portrait: { width: 412, height: 915 },
  landscape: { width: 915, height: 412 }
};
const TEAL = 'rgb(6, 73, 76)';

const assert = (condition, message) => {
  if (!condition) throw new Error(`Mobile viewer QA failed: ${message}`);
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'viewer-cdp-'));
const port = 9222 + Math.floor(Math.random() * 500);
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
    this.events = new Map();
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
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      const handlers = this.events.get(message.method) || [];
      handlers.forEach(handler => handler(message.params || {}));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(handler);
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

async function waitFor(cdp, expression, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(cdp, expression)) return;
    } catch {
      // Page may still be navigating.
    }
    await delay(120);
  }
  throw new Error(`Timeout waiting for ${description}`);
}

async function createTarget(url) {
  return json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
}

async function runCase(topic, orientation) {
  const expected = EXPECTED[topic];
  const device = DEVICES[orientation];
  const url = `${ROOT_URL}?topic=${topic}#workbook`;
  const target = await createTarget('about:blank');
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  const runtimeErrors = [];

  try {
    await cdp.open();
    cdp.on('Runtime.exceptionThrown', params => runtimeErrors.push(params.exceptionDetails?.text || 'runtime exception'));
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: device.width,
      height: device.height,
      deviceScaleFactor: 2,
      mobile: true,
      screenWidth: device.width,
      screenHeight: device.height
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [
        { name: 'hover', value: 'none' },
        { name: 'pointer', value: 'coarse' }
      ]
    });
    await cdp.send('Network.enable');
    await cdp.send('Network.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
      platform: 'Android'
    });

    await cdp.send('Page.navigate', { url });
    await waitFor(
      cdp,
      `document.querySelector('#booklet-loading')?.hidden === true && document.querySelectorAll('.ws-wsframe').length === ${expected}`,
      `${topic}/${orientation} booklet render`
    );
    await delay(250);

    const metrics = await evaluate(cdp, `(() => {
      const frames = [...document.querySelectorAll('.ws-wsframe')];
      const first = frames[0]?.getBoundingClientRect();
      const second = frames[1]?.getBoundingClientRect();
      const iframe = frames[0]?.querySelector('.ws-sheet-frame');
      const innerDoc = iframe?.contentDocument;
      const innerPage = innerDoc?.querySelector('.a4-page');
      const innerStyle = innerPage ? innerDoc.defaultView.getComputedStyle(innerPage) : null;
      const jump = document.querySelector('#page-jump');
      const topbar = document.querySelector('.topbar');
      const sheets = document.querySelector('.ws-page__sheets');
      return {
        innerWidth,
        innerHeight,
        count: frames.length,
        firstWidth: first?.width || 0,
        firstHeight: first?.height || 0,
        ratio: first?.height / first?.width || 0,
        gap: first && second ? second.top - first.bottom : -1,
        separator: getComputedStyle(sheets).backgroundColor,
        iframePointerEvents: iframe ? getComputedStyle(iframe).pointerEvents : '',
        iframeTextLength: innerPage?.innerText?.replace(/\s+/g, ' ').trim().length || 0,
        innerPageDisplay: innerStyle?.display || '',
        innerPageVisibility: innerStyle?.visibility || '',
        innerPageOpacity: Number(innerStyle?.opacity || 0),
        iframeRenderedWidth: iframe?.getBoundingClientRect().width || 0,
        topbarDisplay: topbar ? getComputedStyle(topbar).display : '',
        jumpDisplay: jump ? getComputedStyle(jump).display : '',
        status: document.querySelector('#page-jump-status')?.textContent || '',
        activeTopic: document.querySelector('.topic-link.is-active')?.dataset.topic || '',
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    })()`);

    assert(metrics.count === expected, `${topic}/${orientation}: expected ${expected} pages, got ${metrics.count}`);
    assert(Math.abs(metrics.firstWidth - metrics.innerWidth) <= 1.5, `${topic}/${orientation}: first A4 width ${metrics.firstWidth} != viewport ${metrics.innerWidth}`);
    assert(Math.abs(metrics.ratio - 297 / 210) < 0.015, `${topic}/${orientation}: A4 ratio drifted to ${metrics.ratio}`);
    assert(metrics.gap >= 10 && metrics.gap <= 14, `${topic}/${orientation}: separator gap is ${metrics.gap}px, expected about 12px`);
    assert(metrics.separator === TEAL, `${topic}/${orientation}: separator color ${metrics.separator} != ${TEAL}`);
    assert(metrics.iframePointerEvents === 'none', `${topic}/${orientation}: iframe must not trap touch gestures`);
    assert(metrics.iframeTextLength > 80, `${topic}/${orientation}: first A4 iframe has no real worksheet text (length ${metrics.iframeTextLength})`);
    assert(metrics.innerPageDisplay !== 'none' && metrics.innerPageVisibility !== 'hidden' && metrics.innerPageOpacity > 0.1, `${topic}/${orientation}: A4 content is hidden inside iframe`);
    assert(Math.abs(metrics.iframeRenderedWidth - metrics.innerWidth) <= 2, `${topic}/${orientation}: scaled iframe width ${metrics.iframeRenderedWidth} != viewport ${metrics.innerWidth}`);
    assert(metrics.topbarDisplay === 'none', `${topic}/${orientation}: desktop topbar must be hidden in mobile mode`);
    assert(metrics.jumpDisplay !== 'none', `${topic}/${orientation}: navigation dock must be visible`);
    assert(metrics.activeTopic === topic, `${topic}/${orientation}: active topic selector mismatch`);
    assert(Math.abs(metrics.horizontalOverflow) <= 1, `${topic}/${orientation}: horizontal overflow ${metrics.horizontalOverflow}px`);
    assert(metrics.status === `1/${expected}`, `${topic}/${orientation}: initial status ${metrics.status}`);

    await evaluate(cdp, `document.querySelector('[data-jump="next"]')?.click()`);
    await waitFor(cdp, `document.querySelector('#page-jump-status')?.textContent === '2/${expected}'`, `${topic}/${orientation} next-page status`);
    await waitFor(cdp, `(() => { const r=document.querySelector('#sheet-2')?.getBoundingClientRect(); return !!r && r.bottom > 48 && r.top < innerHeight; })()`, `${topic}/${orientation} next-page visibility`, 5000);

    await evaluate(cdp, `document.querySelector('[data-jump="bottom"]')?.click()`);
    await waitFor(cdp, `document.querySelector('#page-jump-status')?.textContent === '${expected}/${expected}'`, `${topic}/${orientation} last-page status`);
    await waitFor(cdp, `(() => { const r=document.querySelector('#sheet-${expected}')?.getBoundingClientRect(); return !!r && r.bottom > 48 && r.top < innerHeight; })()`, `${topic}/${orientation} last-page visibility`, 8000);

    await evaluate(cdp, `document.querySelector('[data-jump="top"]')?.click()`);
    await waitFor(cdp, `document.querySelector('#page-jump-status')?.textContent === '1/${expected}'`, `${topic}/${orientation} first-page status`);
    await waitFor(cdp, `(() => { const r=document.querySelector('#sheet-1')?.getBoundingClientRect(); return !!r && r.bottom > 48 && r.top < innerHeight; })()`, `${topic}/${orientation} first-page visibility`, 8000);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const screenshot = path.join(OUT_DIR, `${topic}-${orientation}.png`);
    fs.writeFileSync(screenshot, Buffer.from(shot.data, 'base64'));
    assert(fs.statSync(screenshot).size > 5000, `${topic}/${orientation}: screenshot is unexpectedly small`);
    assert(runtimeErrors.length === 0, `${topic}/${orientation}: runtime JS errors: ${runtimeErrors.join(' | ')}`);

    console.log(`PASS ${topic}/${orientation}: ${expected} pages, ${metrics.firstWidth}×${metrics.firstHeight}px, gap ${metrics.gap}px`);
  } finally {
    cdp.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }
}

let exitCode = 0;
try {
  await waitForDebugPort();
  for (const topic of Object.keys(EXPECTED)) {
    for (const orientation of Object.keys(DEVICES)) {
      await runCase(topic, orientation);
    }
  }
  console.log('Mobile viewer browser QA: PASS (3 topics × portrait/landscape)');
} catch (error) {
  exitCode = 1;
  console.error(error.stack || error.message || error);
} finally {
  browser.kill('SIGTERM');
  await delay(150);
  fs.rmSync(profile, { recursive: true, force: true });
}
process.exitCode = exitCode;
