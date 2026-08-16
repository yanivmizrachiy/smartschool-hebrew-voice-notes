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

const pages = fs.readdirSync(dir)
  .filter(name => /^page-\d+\.html$/.test(name))
  .map(name => Number(name.match(/\d+/)[0]))
  .sort((a,b) => a-b);

assert(pages.length > 0, 'at least one worksheet page is required');
pages.forEach((page, index) => assert(page === index + 1, `page numbering must be continuous from 1; found page ${page} at position ${index + 1}`));

for (const page of pages) {
  const html = fs.readFileSync(path.join(dir, `page-${page}.html`), 'utf8');
  const answerPath = path.join(dir, `page-${page}.answers.json`);
  assert(fs.existsSync(answerPath), `page ${page} is missing an answer key`);
  const answers = JSON.parse(fs.readFileSync(answerPath, 'utf8'));

  assert(/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html), `page ${page}: Hebrew RTL root is required`);
  assert(count(html, /<h1\b/g) === 1, `page ${page}: exactly one visible page heading is required`);
  assert(count(html, /<h[23]\b/g) === 0, `page ${page}: question-level headings are forbidden`);
  assert(new RegExp(`aria-label="עמוד ${page}"[^>]*>${page}<\\/div>`).test(html), `page ${page}: visible page number mismatch`);
  assert(answers.page === page && answers.project === 'גליל', `page ${page}: answer key identity mismatch`);
  assert(answers.qa?.independentPageNumber === page, `page ${page}: QA page number mismatch`);
  assert(answers.qa?.singleVisiblePageTitle === true, `page ${page}: single-title contract missing`);
  assert(answers.qa?.openResponseAllowed === false, `page ${page}: open responses must stay disabled`);
  assert(!/[×]/.test(html), `page ${page}: multiplication sign × is forbidden`);
  assert(!/demo|placeholder/i.test(html), `page ${page}: demo/placeholder text is forbidden`);
  if (answers.qa?.volumeFormulaAllowed === false) assert(!/V\s*=|π\s*·\s*r²\s*·\s*h/.test(html), `page ${page}: volume formula appears before it is allowed`);
  if (answers.qa?.surfaceAreaFormulaAllowed === false) assert(!/S\s*=|M\s*=/.test(html), `page ${page}: surface-area formula appears before it is allowed`);
}

console.log(`Cylinder QA: PASS (${pages.length} pages checked, canonical 2-line footer locked)`);