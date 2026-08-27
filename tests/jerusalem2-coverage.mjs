import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// git blob sha = sha1("blob " + bytelen + "\0" + content)
function gitBlobSha(buf) {
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

const root = process.cwd();
const SOURCE_REPO = 'yanivmizrachiy/jerusalem2';
const SOURCE_COMMIT = '0ce788f1aa2f186bce83b73217570728ea637052';
const SOURCE_FILE = 'src/content/curriculum-fragments/idkun-geometri-8/idkun-geometri-8-p001-025.json';
const FIGURE_DIR = 'public/media/curriculum/idkun-geometri-8';
const SNAPSHOT_FILE = 'content/jerusalem2-geometry-p03-19.json';
const REQUIRED_PAGES = Array.from({ length: 17 }, (_, index) => index + 3);

function fail(message) {
  console.error(`Jerusalem2 coverage QA failed: ${message}`);
  process.exit(1);
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const officialPage = read('viewer/official-questions.html');
const bootstrap = read('viewer/bootstrap.js');
const buildSite = read('src/build-site.mjs');
const snapshot = JSON.parse(read(SNAPSHOT_FILE));

if (snapshot.source?.repo !== SOURCE_REPO) fail('snapshot source repo mismatch');
if (snapshot.source?.commit !== SOURCE_COMMIT) fail('snapshot source commit mismatch');
if (snapshot.source?.file !== SOURCE_FILE) fail('snapshot source file mismatch');
if (snapshot.source?.figureDir !== FIGURE_DIR) fail('snapshot figure directory mismatch');
if (snapshot.source?.startPage !== 3 || snapshot.source?.endPage !== 19) fail('snapshot range must be exactly 3–19');
if (!Array.isArray(snapshot.pages) || snapshot.pages.length !== 17) fail('snapshot must contain exactly 17 source pages');

const actualPages = snapshot.pages.map(page => page.page);
if (JSON.stringify(actualPages) !== JSON.stringify(REQUIRED_PAGES)) {
  fail(`expected source pages 3–19 exactly; got ${actualPages.join(', ')}`);
}
for (const page of snapshot.pages) {
  if (!page.id || !Array.isArray(page.topics) || !page.topics.length) fail(`page ${page.page}: invalid identity/topics`);
  if (!String(page.questions || '').trim()) fail(`page ${page.page}: missing question text`);
  for (const figure of page.figures || []) {
    if (!/^fig-p\d+-\d+\.(?:png|jpe?g)$/i.test(figure.file || '')) fail(`page ${page.page}: invalid figure filename`);
    if (!/^[0-9a-f]{40}$/i.test(figure.sha || '')) fail(`page ${page.page}: invalid figure sha`);
    if (!Number.isInteger(figure.bytes) || figure.bytes <= 0) fail(`page ${page.page}: invalid figure byte size`);
    // Figure-dependent questions need the source figure repo-hosted byte-faithfully (RULES.md §9.1).
    const figPath = path.join(root, 'content', 'jerusalem2-figures', figure.file);
    if (!fs.existsSync(figPath)) fail(`page ${page.page}: source figure not repo-hosted: content/jerusalem2-figures/${figure.file}`);
    const buf = fs.readFileSync(figPath);
    if (buf.length !== figure.bytes) fail(`page ${page.page}: figure ${figure.file} bytes ${buf.length} != ${figure.bytes}`);
    if (gitBlobSha(buf) !== figure.sha) fail(`page ${page.page}: figure ${figure.file} is not byte-faithful to the locked Jerusalem2 source`);
  }
}

if (!officialPage.includes("../content/jerusalem2-geometry-p03-19.json")) fail('viewer must load the local locked snapshot');
if (/raw\.githubusercontent\.com|api\.github\.com\/repos\/yanivmizrachiy\/jerusalem2/.test(officialPage)) fail('viewer must not depend on private Jerusalem2 network access at runtime');
if (!bootstrap.includes('viewer/official-questions.html') || !bootstrap.includes('שאלות רשמיות')) fail('shared navigation does not expose the official question bank');
if (!buildSite.includes("'viewer'")) fail('deployment artifact does not include viewer runtime');
if (!buildSite.includes("'content/catalog.json'")) fail('deployment artifact content contract is missing');

const catalog = JSON.parse(read('content/catalog.json'));
const expectedCounts = { circle: 90, cylinder: 41, cone: 46 };
let total = 0;
for (const book of catalog.books || []) {
  if (!(book.id in expectedCounts)) continue;
  const manifest = JSON.parse(read(book.manifest));
  const count = manifest.printSheetCount ?? manifest.pageCount;
  if (count !== expectedCounts[book.id]) fail(`${book.id} count changed: ${count} != ${expectedCounts[book.id]}`);
  total += count;
}
if (total !== 177) fail(`canonical workbook total changed: ${total} != 177`);

const figureCount = snapshot.pages.reduce((sum, page) => sum + (page.figures?.length || 0), 0);
console.log(`OK: local Jerusalem2 snapshot covers pages 3–19 from locked commit ${SOURCE_COMMIT}; ${figureCount} source figures repo-hosted byte-faithful; canonical 90/41/46 = 177 unchanged.`);
