import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const styles = fs.readFileSync(path.join(root, 'worksheets', 'styles.css'), 'utf8');
const visualCss = fs.readFileSync(path.join(root, 'visual-pages', 'visual.css'), 'utf8');
const printHtml = fs.readFileSync(path.join(root, 'print/harut-a4.html'), 'utf8');
const printCss = fs.readFileSync(path.join(root, 'print/styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'viewer/app.js'), 'utf8');
const printJs = fs.readFileSync(path.join(root, 'viewer/print.js'), 'utf8');
const printViewCss = fs.readFileSync(path.join(root, 'viewer/print.css'), 'utf8');

const errors = [];
const fail = message => errors.push(message);
const sequence = workbook.printSequence || workbook.pages.map(page => ({ kind: 'worksheet', id: page.id }));
const expected = workbook.printSheetCount || sequence.length;

if (!/\.sheet-footer\s*\{\s*display:\s*none\s*!important;\s*\}/.test(styles)) {
  fail('worksheets/styles.css must hide sheet-footer globally');
}

if (/<footer class="sheet-footer"/i.test(printHtml)) {
  fail('print/harut-a4.html must not contain student identity footers');
}

const identityFieldPattern = /(?:שם התלמיד|שם:\s*_{2,}|כיתה:\s*_{2,}|תאריך:\s*_{2,})/;
if (identityFieldPattern.test(printHtml)) {
  fail('print/harut-a4.html contains a student name/class/date field');
}

// The cone workbook is one topic. Its only visible page numbering is the local
// topic sequence 1..N, placed in the A4 header/top-left area. Internal worksheet
// ids are file identities only and must never become a second visible numbering system.
const markers = [...printHtml.matchAll(/data-local-page="(\d+)"/g)].map(match => Number(match[1]));
if (markers.length !== expected) fail(`expected ${expected} locally numbered pages, found ${markers.length}`);
for (let i = 0; i < expected; i += 1) {
  if (markers[i] !== i + 1) fail(`local page at sequence index ${i} must be ${i + 1}, found ${markers[i]}`);
}

const visibleNumbers = (printHtml.match(/data-local-page-number="true"/g) || []).length;
if (visibleNumbers !== expected) fail(`expected exactly one visible local page number on each of ${expected} pages, found ${visibleNumbers}`);
if (/book-page-number/.test(printHtml + printCss + appJs + printJs + printViewCss)) {
  fail('legacy bottom/global book-page-number must not exist anywhere in the active booklet paths');
}
if (/aria-label="עמוד \d+ מתוך \d+"/.test(printHtml)) {
  fail('printed A4 page number must not expose a global "page X of Y" label');
}
if (/\.page-number[^}]*display\s*:\s*none/i.test(printCss) || /\.sheet-footer\s*,\s*\.page-number/.test(printCss)) {
  fail('print CSS must not hide the canonical top-left .page-number');
}
if (!/\.visual-a4>\.local-page-number\{[^}]*left:[^;]+;[^}]*top:/i.test(visualCss)) {
  fail('visual pages must place their local page number at the top-left');
}
if (/\.visual-a4>\.local-page-number\{[^}]*bottom:/i.test(visualCss)) {
  fail('visual-page local number must not be positioned at the bottom');
}
if (/kindLabel:\s*`דף עבודה \$\{page\.id\}`/.test(appJs) || /label\s*=\s*`עמוד \$\{page\.id\}`/.test(printJs)) {
  fail('viewer must not expose internal worksheet ids as visible page numbers');
}
if (!appJs.includes("kindLabel: 'דף עבודה'") || !appJs.includes('עמוד ${entry.sequence}')) {
  fail('viewer must label pages by local sequence only');
}
if (!printJs.includes("main.querySelector('.page-number, .local-page-number')")) {
  fail('print view must preserve/update the local number in the page header');
}

const localByWorksheet = new Map();
const localByVisual = new Map();
for (const [index, item] of sequence.entries()) {
  if (item.kind === 'worksheet') localByWorksheet.set(item.id, index + 1);
  if (item.kind === 'visual') localByVisual.set(item.slug, index + 1);
}

for (const page of workbook.pages) {
  const html = fs.readFileSync(path.join(root, 'worksheets', `${page.slug}.html`), 'utf8');
  const localPage = localByWorksheet.get(page.id);
  const numberMatch = html.match(/<div class="page-number"[^>]*>(\d+)<\/div>/);
  if (!numberMatch) {
    fail(`${page.slug}: missing header page number`);
  } else if (Number(numberMatch[1]) !== localPage) {
    fail(`${page.slug}: visible page number must be local ${localPage}, found ${numberMatch[1]}`);
  }
  if (!/data-local-page-number="true"/.test(html)) fail(`${page.slug}: page number is not marked as local`);

  const studentHtml = html
    .replace(/<nav class="preview-nav"[\s\S]*?<\/nav>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  if (/(?:שאלה|תרגיל)\s+\d+/.test(studentHtml)) {
    fail(`${page.slug}: visible question/exercise numbering is forbidden; use bullets and section letters only`);
  }
}

for (const page of workbook.visualPages || []) {
  const html = fs.readFileSync(path.join(root, 'visual-pages', `${page.slug}.html`), 'utf8');
  const localPage = localByVisual.get(page.slug);
  const numberMatch = html.match(/<div class="local-page-number"[^>]*>(\d+)<\/div>/);
  if (!numberMatch) {
    fail(`${page.slug}: missing visual local page number`);
  } else if (Number(numberMatch[1]) !== localPage) {
    fail(`${page.slug}: visual page number must be local ${localPage}, found ${numberMatch[1]}`);
  }
}

if (errors.length) {
  console.error(`Booklet contract failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: one ${expected}-page cone topic; local page number only, top-left, with no visible question numbering or internal worksheet ids.`);
