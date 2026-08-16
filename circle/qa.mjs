import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(`Circle QA failed: ${message}`); };
const count = (text, pattern) => (text.match(pattern) || []).length;

assert(/width:210mm/.test(css) && /height:297mm/.test(css), 'A4 dimensions must be exactly 210×297mm');
assert(/overflow:hidden/.test(css), 'A4 page must guard against overflow');
assert(/@page\{size:A4;margin:0\}/.test(css), 'print page contract is missing');
assert(css.includes('יניב רז - מדריך מחוזי חט\\"ב בעיר ירושלים'), 'canonical first credit line is missing');
assert(css.includes('הדרכה במחוז ירושלים והעיר ירושלים - מנח\\"י, בהובלת איילת קריספין'), 'canonical second credit line is missing');
assert(/white-space:pre-line/.test(css), 'credit footer must render as two lines');

const answerFiles = fs.readdirSync(dir).filter(name => /\.answers\.json$/i.test(name));
assert(answerFiles.length === 0, `separate answer-key files are forbidden: ${answerFiles.join(', ')}`);

const pages = fs.readdirSync(dir)
  .filter(name => /^page-\d+\.html$/.test(name))
  .map(name => Number(name.match(/\d+/)[0]))
  .sort((a,b) => a-b);

assert(pages.length === 88, `complete workbook must contain exactly 88 student pages; found ${pages.length}`);
assert(new Set(pages).size === 88, 'page numbers must be unique');
pages.forEach((page, index) => assert(page === index + 1, `complete workbook must be continuous from 1 to 88; found page ${page} at position ${index + 1}`));

for (const page of pages) {
  const html = fs.readFileSync(path.join(dir, `page-${page}.html`), 'utf8');
  assert(/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html), `page ${page}: Hebrew RTL root is required`);
  assert(count(html, /<h1\b/g) === 1, `page ${page}: exactly one visible page heading is required`);
  assert(count(html, /<h[23]\b/g) === 0, `page ${page}: question-level headings are forbidden`);
  assert(new RegExp(`class="page-number"[^>]*>${page}<\\/div>`).test(html), `page ${page}: visible page number mismatch`);
  assert(/<(?:footer|div) class="footer">/.test(html), `page ${page}: name/date footer is required`);
  assert(!/[×]/.test(html), `page ${page}: multiplication sign × is forbidden`);
  assert(!/demo|placeholder/i.test(html), `page ${page}: demo/placeholder text is forbidden`);
  assert(!/נמקו|הסבירו\s+במילים/.test(html), `page ${page}: unrestricted open response wording is forbidden`);

  if (page === 1) assert(/<h1[^>]*>מושגים בסיסיים<\/h1>/.test(html), 'page 1: canonical opening title must be מושגים בסיסיים');
  if (page <= 20) assert(!html.includes('π'), `page ${page}: π is forbidden before page 21`);
  if (page <= 20) assert(!/A\s*=\s*π|π\s*[·*]?\s*r²/.test(html), `page ${page}: area formula is forbidden before page 21`);

  if (page >= 71 && page <= 79) {
    assert(/<h1[^>]*>מעגל ברביע הראשון<\/h1>/.test(html), `page ${page}: canonical first-quadrant title is required`);
    assert(!/\(\s*[-−]\d+\s*,|,\s*[-−]\d+\s*\)/.test(html), `page ${page}: negative ordered-pair coordinates are forbidden in the first-quadrant block`);
  }

  if (page >= 71 && page <= 88) {
    assert(!/x\s*[²^]\s*\+\s*y\s*[²^]|\(x\s*[-−+]\s*[^)]*\)\s*[²^]\s*\+\s*\(y\s*[-−+]/i.test(html), `page ${page}: analytic circle-equation notation is forbidden`);
  }
}

console.log(`Circle QA: PASS (88 student pages checked; continuous 1–88; no separate answer keys; canonical A4/footer/coordinate rules locked)`);
