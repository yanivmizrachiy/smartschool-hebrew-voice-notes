import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SOURCE_REPO = 'yanivmizrachiy/jerusalem2';
const SOURCE_COMMIT = '0ce788f1aa2f186bce83b73217570728ea637052';
const SOURCE_FILE = 'src/content/curriculum-fragments/idkun-geometri-8/idkun-geometri-8-p001-025.json';
const FIGURE_DIR = 'public/media/curriculum/idkun-geometri-8';
const REQUIRED_PAGES = Array.from({ length: 17 }, (_, index) => index + 3);
const rawBase = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_COMMIT}`;
const sourceUrl = `${rawBase}/${SOURCE_FILE}`;
const figuresApi = `https://api.github.com/repos/${SOURCE_REPO}/contents/${FIGURE_DIR}?ref=${SOURCE_COMMIT}`;

function fail(message) {
  console.error(`Jerusalem2 coverage QA failed: ${message}`);
  process.exit(1);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'smartschool-jerusalem2-coverage-qa' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) fail(`${label} returned HTTP ${response.status}`);
  return response.json();
}

const officialPage = read('official-questions.html');
const bootstrap = read('viewer/bootstrap.js');
const buildSite = read('src/build-site.mjs');

for (const required of [SOURCE_REPO, SOURCE_COMMIT, SOURCE_FILE, FIGURE_DIR]) {
  if (!officialPage.includes(required)) fail(`official-questions.html is not pinned to ${required}`);
}
if (!officialPage.includes('SOURCE_START_PAGE=3') || !officialPage.includes('SOURCE_END_PAGE=19')) {
  fail('official question bank must render the complete locked source range 3–19');
}
if (!officialPage.includes('sourcePages.length!==17')) {
  fail('official question bank must reject an incomplete 3–19 source snapshot');
}
if (!bootstrap.includes('official-questions.html') || !bootstrap.includes('שאלות רשמיות')) {
  fail('shared navigation does not expose the official question bank');
}
if (!buildSite.includes("'official-questions.html'")) {
  fail('deployment artifact does not include the official question bank');
}

const [source, figureFiles] = await Promise.all([
  fetchJson(sourceUrl, 'locked Jerusalem2 curriculum source'),
  fetchJson(figuresApi, 'locked Jerusalem2 figure inventory')
]);

const pages = source.blocks
  .filter(block => block.type === 'sourcePage' && block.page >= 3 && block.page <= 19)
  .sort((a, b) => a.page - b.page);
const actualPages = pages.map(block => block.page);
if (JSON.stringify(actualPages) !== JSON.stringify(REQUIRED_PAGES)) {
  fail(`expected source pages 3–19 exactly; got ${actualPages.join(', ')}`);
}

for (const page of pages) {
  const rows = (page.tables || []).flatMap(table => table.rows || []);
  if (!rows.length) fail(`source page ${page.page} has no curriculum rows`);
  if (!rows.some(row => Array.isArray(row) && row.some(cell => String(cell || '').trim()))) {
    fail(`source page ${page.page} has no readable source content`);
  }
}

if (!Array.isArray(figureFiles)) fail('figure inventory is not an array');
const sourceFigures = figureFiles.filter(file => {
  const match = file.name?.match(/^fig-p(\d+)-/i);
  if (!match) return false;
  const page = Number(match[1]);
  return page >= 3 && page <= 19;
});
if (!sourceFigures.length) fail('no source figures were discovered for pages 3–19');
for (const file of sourceFigures) {
  if (file.type !== 'file' || !file.name || !file.sha) fail('source figure inventory contains an invalid entry');
}

const catalog = JSON.parse(read('content/catalog.json'));
const expectedCounts = { circle: 88, cylinder: 38, cone: 46 };
let total = 0;
for (const book of catalog.books || []) {
  if (!(book.id in expectedCounts)) continue;
  const manifest = JSON.parse(read(book.manifest));
  const count = manifest.printSheetCount ?? manifest.pageCount;
  if (count !== expectedCounts[book.id]) fail(`${book.id} count changed: ${count} != ${expectedCounts[book.id]}`);
  total += count;
}
if (total !== 172) fail(`canonical workbook total changed: ${total} != 172`);

console.log(`OK: Jerusalem2 pages 3–19 are covered from locked commit ${SOURCE_COMMIT}; ${sourceFigures.length} source figures discovered; canonical 88/38/46 = 172 unchanged.`);
