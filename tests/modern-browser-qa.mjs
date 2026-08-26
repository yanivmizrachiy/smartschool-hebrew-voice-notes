import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const ROOT_URL = process.env.VIEWER_QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.join('qa', 'modern-browser');
const BOOKS = [
  { id: 'circle', count: 88, first: 'circle/page-1.html' },
  { id: 'cylinder', count: 38, first: 'cylinder/page-1.html' },
  { id: 'cone', count: 46, first: 'worksheets/page-17.html' }
];
const EXPECTED_HOME_COUNTS = BOOKS.map(book => `${book.count} דפי A4`);
const EXPECTED_TOTAL = String(BOOKS.reduce((sum, book) => sum + book.count, 0));
const ENGINES = { chromium, firefox, webkit };

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(`Modern browser QA failed: ${message}`);
}

async function waitForHome(page) {
  await page.waitForFunction(({ counts: expectedCounts, total: expectedTotal }) => {
    const counts = [...document.querySelectorAll('[data-book-pages]')].map(node => node.textContent?.trim() || '');
    const total = document.querySelector('[data-total-pages]')?.textContent?.trim() || '';
    return document.body.classList.contains('is-home')
      && JSON.stringify(counts) === JSON.stringify(expectedCounts)
      && total === expectedTotal;
  }, { counts: EXPECTED_HOME_COUNTS, total: EXPECTED_TOTAL });
}

async function viewerDiagnostic(page) {
  return page.evaluate(() => ({
    url: location.href,
    bodyClasses: [...document.body.classList],
    frames: document.querySelectorAll('.ws-wsframe').length,
    iframeElements: document.querySelectorAll('.ws-sheet-frame').length,
    loadingText: document.querySelector('#booklet-loading')?.textContent?.trim() || '',
    loadingHidden: document.querySelector('#booklet-loading')?.hidden ?? null,
    statusText: document.querySelector('#booklet-status')?.textContent?.trim() || '',
    libraryHidden: document.querySelector('#library')?.hidden ?? null,
    workbookHidden: document.querySelector('#workbook')?.hidden ?? null,
    jumpHidden: document.querySelector('#page-jump')?.hidden ?? null
  }));
}

async function homeSnapshot(page) {
  return page.evaluate(() => ({
    cards: [...document.querySelectorAll('.workbook-card h3')].map(node => node.textContent?.trim()),
    counts: [...document.querySelectorAll('[data-book-pages]')].map(node => node.textContent?.trim()),
    total: document.querySelector('[data-total-pages]')?.textContent?.trim(),
    iframeCount: document.querySelectorAll('iframe').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    direction: document.documentElement.dir
  }));
}

async function assertHome(page, engineName) {
  await page.goto(ROOT_URL, { waitUntil: 'domcontentloaded' });
  await waitForHome(page);
  const snapshot = await homeSnapshot(page);
  assert(JSON.stringify(snapshot.cards) === JSON.stringify(['מעגל', 'גליל', 'חרוט']), `${engineName}: home card order ${JSON.stringify(snapshot.cards)}`);
  assert(JSON.stringify(snapshot.counts) === JSON.stringify(EXPECTED_HOME_COUNTS), `${engineName}: home counts ${JSON.stringify(snapshot.counts)}`);
  assert(snapshot.total === EXPECTED_TOTAL, `${engineName}: home total ${snapshot.total}`);
  assert(snapshot.iframeCount === 0, `${engineName}: root must create zero workbook iframes`);
  assert(Math.abs(snapshot.overflowX) <= 2, `${engineName}: home horizontal overflow ${snapshot.overflowX}px`);
  assert(snapshot.direction === 'rtl', `${engineName}: document direction must be rtl`);
  return snapshot;
}

async function assertBook(page, engineName, book) {
  const url = `${ROOT_URL}?topic=${book.id}&sheet=1#workbook`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(expected => document.body.classList.contains('has-topic') && document.querySelectorAll('.ws-wsframe').length === expected, book.count, { timeout: 15000 });
  } catch (error) {
    const diagnostic = await viewerDiagnostic(page);
    throw new Error(`Modern browser QA failed: ${engineName}/${book.id}: viewer hydration timeout; state=${JSON.stringify(diagnostic)}; cause=${error.message || error}`);
  }
  const snapshot = await page.evaluate(() => ({
    frames: document.querySelectorAll('.ws-wsframe').length,
    firstSrc: document.querySelector('.ws-sheet-frame')?.getAttribute('src') || '',
    current: document.querySelector('#page-jump-status')?.textContent?.trim() || '',
    libraryHidden: document.querySelector('#library')?.hidden === true,
    workbookVisible: document.querySelector('#workbook')?.hidden === false
  }));
  assert(snapshot.frames === book.count, `${engineName}/${book.id}: expected ${book.count} wrappers, got ${snapshot.frames}`);
  assert(snapshot.firstSrc === book.first, `${engineName}/${book.id}: first page ${snapshot.firstSrc}`);
  assert(snapshot.current === `1/${book.count}`, `${engineName}/${book.id}: counter ${snapshot.current}`);
  assert(snapshot.libraryHidden && snapshot.workbookVisible, `${engineName}/${book.id}: wrong Home/workbook visibility`);
  return snapshot;
}

async function assertMobile(page, engineName) {
  await page.goto(`${ROOT_URL}?topic=cone&sheet=1#workbook`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => document.querySelectorAll('.ws-wsframe').length === 46, null, { timeout: 15000 });
  } catch (error) {
    const diagnostic = await viewerDiagnostic(page);
    throw new Error(`Modern browser QA failed: ${engineName}/mobile: viewer hydration timeout; state=${JSON.stringify(diagnostic)}; cause=${error.message || error}`);
  }
  await page.locator('.ws-sheet-frame').first().waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const frame = document.querySelector('.ws-sheet-frame');
    return frame?.style.width === '210mm' && frame?.style.height === '297mm' && !!frame?.style.transform;
  });
  const snapshot = await page.evaluate(() => {
    const wrap = document.querySelector('.ws-wsframe');
    const frame = document.querySelector('.ws-sheet-frame');
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      viewport: document.documentElement.clientWidth,
      wrapWidth: wrap?.getBoundingClientRect().width || 0,
      frameTransform: frame?.style.transform || '',
      frameWidth: frame?.style.width || '',
      frameHeight: frame?.style.height || '',
      touchPointerEvents: frame ? getComputedStyle(frame).pointerEvents : ''
    };
  });
  assert(Math.abs(snapshot.overflowX) <= 2, `${engineName}/mobile: horizontal overflow ${snapshot.overflowX}px`);
  assert(Math.abs(snapshot.wrapWidth - snapshot.viewport) <= 2, `${engineName}/mobile: A4 wrapper ${snapshot.wrapWidth}px != viewport ${snapshot.viewport}px`);
  assert(snapshot.frameWidth === '210mm' && snapshot.frameHeight === '297mm', `${engineName}/mobile: iframe A4 surface ${snapshot.frameWidth} × ${snapshot.frameHeight}`);
  assert(snapshot.touchPointerEvents === 'none', `${engineName}/mobile: iframe must not trap touch`);
  return snapshot;
}

const results = { schemaVersion: 1, engines: {}, accessibility: null };
let failure = null;

try {
  for (const [engineName, engine] of Object.entries(ENGINES)) {
    const browser = await engine.launch({ headless: true });
    try {
      const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' });
      const page = await desktop.newPage();
      const home = await assertHome(page, engineName);
      const books = {};
      for (const book of BOOKS) books[book.id] = await assertBook(page, engineName, book);
      await page.goto(ROOT_URL, { waitUntil: 'domcontentloaded' });
      await waitForHome(page);
      await page.screenshot({ path: path.join(OUT_DIR, `${engineName}-home.png`), fullPage: true });

      if (engineName === 'chromium') {
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        results.accessibility = {
          violations: axe.violations.map(item => ({
            id: item.id,
            impact: item.impact,
            help: item.help,
            targets: item.nodes.flatMap(node => node.target)
          }))
        };
        assert(axe.violations.length === 0, `axe WCAG violations: ${axe.violations.map(item => item.id).join(', ')}`);
      }
      await desktop.close();

      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        screen: { width: 390, height: 844 },
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
        locale: 'he-IL'
      });
      const mobilePage = await mobile.newPage();
      const mobileSnapshot = await assertMobile(mobilePage, engineName);
      await mobilePage.screenshot({ path: path.join(OUT_DIR, `${engineName}-mobile-cone.png`), fullPage: false });
      await mobile.close();

      results.engines[engineName] = { home, books, mobile: mobileSnapshot };
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  failure = error;
} finally {
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log('Modern browser QA: PASS (Chromium + Firefox + WebKit desktop/mobile smoke and Chromium axe WCAG 2.2 AA checks passed).');
