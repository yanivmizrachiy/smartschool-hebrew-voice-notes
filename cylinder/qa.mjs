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
  assert(!/\d\s*[xX]\s*\d/.test(html), `page ${page}: x/X must not be used as a numeric multiplication sign`);
  assert(!/π\s*=\s*3(?:[.,])14/.test(html), `page ${page}: π must never be written as exactly 3.14`);
  assert(!/demo|placeholder/i.test(html), `page ${page}: demo/placeholder text is forbidden`);
  assert(!/נמקו|הסבירו\s+במילים/.test(html), `page ${page}: unrestricted open response wording is forbidden`);
  if (page === 1) assert(/<h1[^>]*>מושגים בסיסיים<\/h1>/.test(html), 'page 1: canonical opening title must be מושגים בסיסיים');
  if (page < 19) assert(!/V\s*=/.test(html), `page ${page}: volume formula is forbidden before page 19`);
  assert(!/S\s*=|M\s*=/.test(html), `page ${page}: lateral/total surface-area formula is not authorized in current produced sequence`);

  if (page === 20) {
    assert(/<th>V לפני<\/th><th>V אחרי<\/th>[\s\S]*____ ס״מ³<\/td><td>____ ס״מ³/.test(html), 'page 20: before/after volume answers must carry cubic-centimeter units');
  }

  if (page === 38) {
    assert(/r=4<\/span> ס״מ, <span dir="ltr">h=5<\/span> ס״מ/.test(html), 'page 38: direct-volume data must include length units');
    assert(/d=10<\/span> ס״מ, <span dir="ltr">h=3<\/span> ס״מ[\s\S]*r=____<\/span> ס״מ, <span dir="ltr">V=____π<\/span> ס״מ³/.test(html), 'page 38: diameter-to-volume item must preserve radius and volume units');
    assert(/B=16π<\/span> ס״מ², <span dir="ltr">V=80π<\/span> ס״מ³[\s\S]*h=____<\/span> ס״מ/.test(html), 'page 38: reverse-height item must preserve area, volume, and height units');
    assert(/V=147π<\/span> ס״מ³, <span dir="ltr">h=3<\/span> ס״מ[\s\S]*r=____<\/span> ס״מ/.test(html), 'page 38: reverse-radius item must preserve volume, height, and radius units');
  }
}

console.log('Cylinder QA: PASS (38 student pages checked; approved sequence locked at 1–38; math-notation/unit guards active; no separate answer keys; surface-area extension blocked)');
