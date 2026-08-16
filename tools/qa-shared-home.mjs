import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT_URL = process.env.VIEWER_QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.join('qa', 'shared-home');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const commandExists = command => spawnSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
const chrome = process.env.CHROME_BIN || ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find(commandExists);
if (!chrome) throw new Error('Shared home QA: Chrome/Chromium not found');
if (typeof WebSocket === 'undefined') throw new Error('Shared home QA: Node 22+ WebSocket API required');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'home-cdp-'));
const port = 10120 + Math.floor(Math.random() * 300);
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}
async function waitDebug() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { return await json(`http://127.0.0.1:${port}/json/version`); } catch { await delay(100); }
  }
  throw new Error('Shared home QA: Chrome DevTools port timeout');
}
class Cdp {
  constructor(url) { this.ws = new WebSocket(url); this.id = 1; this.pending = new Map(); }
  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP open timeout')), 10000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP socket error')); }, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const p = this.pending.get(message.id); if (!p) return;
      this.pending.delete(message.id);
      message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result || {});
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  close() { this.ws.close(); }
}
async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate exception');
  return result.result?.value;
}
async function waitFor(cdp, expression, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await evaluate(cdp, expression)) return; } catch {}
    await delay(80);
  }
  throw new Error(`Shared home QA: timeout waiting for ${label}`);
}
async function shot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(result.data, 'base64'));
}
function assert(condition, message) { if (!condition) throw new Error(`Shared home QA failed: ${message}`); }

let cdp; let target; let exitCode = 0;
try {
  await waitDebug();
  target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(ROOT_URL)}`, { method: 'PUT' });
  cdp = new Cdp(target.webSocketDebuggerUrl); await cdp.open();
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');

  // Desktop home: light catalog, three equal topics, no workbook payload.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: ROOT_URL });
  await waitFor(cdp, `document.readyState === 'complete' && document.body.classList.contains('is-home') && document.querySelectorAll('.workbook-card').length === 3`, 'desktop shared home');
  await delay(250);
  const desktop = await evaluate(cdp, `(() => ({
    cards: [...document.querySelectorAll('.workbook-card h3')].map(x => x.textContent.trim()),
    counts: [...document.querySelectorAll('.workbook-card__meta span:first-child')].map(x => x.textContent.trim()),
    iframeCount: document.querySelectorAll('iframe').length,
    workbookHidden: document.querySelector('#workbook')?.hidden === true,
    jumpHidden: document.querySelector('#page-jump')?.hidden === true,
    bodyHome: document.body.classList.contains('is-home'),
    bodyTopic: document.body.classList.contains('has-topic'),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    heroVisible: getComputedStyle(document.querySelector('#home-hero')).display !== 'none',
    libraryVisible: getComputedStyle(document.querySelector('#library')).display !== 'none'
  }))()`);
  assert(JSON.stringify(desktop.cards) === JSON.stringify(['מעגל','גליל','חרוט']), `desktop card order/titles ${JSON.stringify(desktop.cards)}`);
  assert(JSON.stringify(desktop.counts) === JSON.stringify(['88 דפי A4','38 דפי A4','46 דפי A4']), `desktop page counts ${JSON.stringify(desktop.counts)}`);
  assert(desktop.iframeCount === 0, `home must load zero iframes, got ${desktop.iframeCount}`);
  assert(desktop.workbookHidden && desktop.jumpHidden, 'workbook and page dock must stay hidden on root');
  assert(desktop.bodyHome && !desktop.bodyTopic, 'root body mode must be is-home only');
  assert(Math.abs(desktop.overflowX) <= 2, `desktop horizontal overflow ${desktop.overflowX}px`);
  assert(desktop.heroVisible && desktop.libraryVisible, 'desktop hero/library must be visible');
  await shot(cdp, 'home-desktop.png');

  // Phone home: the catalog must remain visible; mobile workbook rules may not hide it.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2.75, mobile: true, screenWidth: 390, screenHeight: 844 });
  await cdp.send('Page.navigate', { url: ROOT_URL });
  await waitFor(cdp, `document.readyState === 'complete' && document.body.classList.contains('is-home') && document.querySelectorAll('.workbook-card').length === 3`, 'phone shared home');
  await delay(250);
  const phone = await evaluate(cdp, `(() => ({
    iframeCount: document.querySelectorAll('iframe').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    topbar: getComputedStyle(document.querySelector('.topbar')).display,
    nav: getComputedStyle(document.querySelector('.sitenav')).display,
    hero: getComputedStyle(document.querySelector('#home-hero')).display,
    library: getComputedStyle(document.querySelector('#library')).display,
    cardWidths: [...document.querySelectorAll('.workbook-card')].map(x => x.getBoundingClientRect().width),
    viewport: document.documentElement.clientWidth
  }))()`);
  assert(phone.iframeCount === 0, `phone home must load zero iframes, got ${phone.iframeCount}`);
  assert(Math.abs(phone.overflowX) <= 2, `phone horizontal overflow ${phone.overflowX}px`);
  assert([phone.topbar,phone.nav,phone.hero,phone.library].every(x => x !== 'none'), `phone home chrome hidden: ${JSON.stringify(phone)}`);
  assert(phone.cardWidths.every(w => w <= phone.viewport + 1), `phone card exceeds viewport: ${JSON.stringify(phone.cardWidths)}`);
  await shot(cdp, 'home-phone.png');

  // Direct circle link: no catalog payload; selected booklet begins at page 1 and has all 88 frames.
  const circleUrl = `${ROOT_URL}?topic=circle&sheet=1#workbook`;
  await cdp.send('Page.navigate', { url: circleUrl });
  await waitFor(cdp, `document.body.classList.contains('has-topic') && document.querySelectorAll('.ws-wsframe').length === 88`, 'direct circle workbook', 20000);
  const circle = await evaluate(cdp, `(() => ({
    frames: document.querySelectorAll('.ws-wsframe').length,
    firstSrc: document.querySelector('.ws-sheet-frame')?.getAttribute('src') || '',
    libraryHidden: document.querySelector('#library')?.hidden === true,
    workbookHidden: document.querySelector('#workbook')?.hidden === true,
    jumpHidden: document.querySelector('#page-jump')?.hidden === true,
    active: document.querySelector('.topic-link.is-active')?.dataset.topic || ''
  }))()`);
  assert(circle.frames === 88, `circle direct link frame count ${circle.frames}`);
  assert(circle.firstSrc === 'circle/page-1.html', `circle must begin at page 1, got ${circle.firstSrc}`);
  assert(circle.libraryHidden && !circle.workbookHidden && !circle.jumpHidden, `circle mode visibility ${JSON.stringify(circle)}`);
  assert(circle.active === 'circle', `circle topic must be active, got ${circle.active}`);

  console.log('Shared home browser QA: PASS (desktop + phone home, zero eager workbook iframes, no horizontal overflow, direct circle page 1 / 88-page viewer checked)');
} catch (error) {
  exitCode = 1; console.error(error.stack || error.message || error);
} finally {
  cdp?.close();
  if (target?.id) await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  const exited = new Promise(resolve => browser.once('exit', resolve));
  browser.kill('SIGTERM'); await Promise.race([exited, delay(1200)]);
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 80 }); break; }
    catch (error) { if (i === 4) console.warn(`Shared home cleanup warning: ${error.message}`); else await delay(120 * (i + 1)); }
  }
}
process.exitCode = exitCode;
