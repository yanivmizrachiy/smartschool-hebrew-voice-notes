import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const styles = fs.readFileSync(path.join(root, 'worksheets/styles.css'), 'utf8');
const printHtml = fs.readFileSync(path.join(root, 'print/harut-a4.html'), 'utf8');
const printCss = fs.readFileSync(path.join(root, 'print/styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'viewer/app.js'), 'utf8');
const printJs = fs.readFileSync(path.join(root, 'viewer/print.js'), 'utf8');
const printViewCss = fs.readFileSync(path.join(root, 'viewer/print.css'), 'utf8');

const errors = [];
const fail = message => errors.push(message);
const expected = workbook.printSheetCount || workbook.printSequence.length;

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

const markers = [...printHtml.matchAll(/data-book-page="(\d+)"/g)].map(match => Number(match[1]));
if (markers.length !== expected) fail(`expected ${expected} numbered book pages, found ${markers.length}`);
for (let i = 0; i < expected; i += 1) {
  if (markers[i] !== i + 1) fail(`book page at sequence index ${i} must be numbered ${i + 1}, found ${markers[i]}`);
}

const badges = (printHtml.match(/class="book-page-number"/g) || []).length;
if (badges !== expected) fail(`expected ${expected} visible book page badges, found ${badges}`);
if (!/\.book-page-number/.test(printCss)) fail('print/styles.css missing book-page-number styling');
if (!/\.page-number\s*\{?[^}]*display:none/i.test(printCss.replace(/\s+/g, ' ')) && !/\.sheet-footer,\.page-number\s*\{\s*display:none/i.test(printCss.replace(/\s+/g, ''))) {
  fail('print/styles.css must suppress legacy worksheet page numbers');
}
if (!appJs.includes('book-page-number') || !appJs.includes("querySelector('.sheet-footer')?.remove()")) {
  fail('viewer/app.js must clean student footer and show unified book numbering');
}
if (!printJs.includes('book-page-number') || !printJs.includes("querySelector('.sheet-footer')?.remove()")) {
  fail('viewer/print.js must clean student footer and show unified book numbering');
}
if (!printViewCss.includes('.book-page-number')) fail('viewer/print.css missing unified booklet number style');

if (errors.length) {
  console.error(`Booklet contract failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: one ${expected}-page booklet, sequentially numbered 1-${expected}, with no student name/class/date fields in print output.`);
