import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(`Cylinder QA failed: ${message}`); };
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

assert(pages.length === 38, `current approved cylinder sequence must contain exactly 38 student pages; found ${pages.length}`);
assert(new Set(pages).size === 38, 'page numbers must be unique');
pages.forEach((page, index) => assert(page === index + 1, `current approved sequence must be continuous from 1 to 38; found page ${page} at position ${index + 1}`));
assert(!pages.some(page => page >= 39), 'pages 39+ are blocked until the תשפ״ז status of nets/lateral/total surface area is resolved');

for (const page of pages) {
  const html = fs.readFileSync(path.join(dir, `page-${page}.html`), 'utf8');
  assert(/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html), `page ${page}: Hebrew RTL root is required`);
  assert(count(html, /<h1\b/g) === 1, `page ${page}: exactly one visible page heading is required`);
  assert(count(html, /<h[23]\b/g) === 0, `page ${page}: question-level headings are forbidden`);
  assert(new RegExp(`aria-label="עמוד ${page}"[^>]*>${page}<\\/div>`).test(html), `page ${page}: visible page number mismatch`);
  assert(/<footer class="footer">/.test(html), `page ${page}: name/date footer is required`);
  assert(!/[×]/.test(html), `page ${page}: multiplication sign × is forbidden`);
  assert(!/demo|placeholder/i.test(html), `page ${page}: demo/placeholder text is forbidden`);
  assert(!/נמקו|הסבירו\s+במילים/.test(html), `page ${page}: unrestricted open response wording is forbidden`);
  if (page === 1) assert(/<h1[^>]*>מושגים בסיסיים<\/h1>/.test(html), 'page 1: canonical opening title must be מושגים בסיסיים');
  if (page < 19) assert(!/V\s*=/.test(html), `page ${page}: volume formula is forbidden before page 19`);
  assert(!/S\s*=|M\s*=/.test(html), `page ${page}: lateral/total surface-area formula is not authorized in current produced sequence`);
}

console.log('Cylinder QA: PASS (38 student pages checked; approved sequence locked at 1–38; no separate answer keys; surface-area extension blocked)');
