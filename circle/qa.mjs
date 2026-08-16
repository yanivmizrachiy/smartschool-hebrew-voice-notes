import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'page-1.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const answers = JSON.parse(fs.readFileSync(path.join(dir, 'page-1.answers.json'), 'utf8'));

const assert = (condition, message) => {
  if (!condition) throw new Error(`Circle page 1 QA failed: ${message}`);
};
const count = (pattern) => (html.match(pattern) || []).length;

assert(/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html), 'Hebrew RTL root is required');
assert(count(/<h1\b/g) === 1, 'exactly one visible page heading is required');
assert(count(/<h[23]\b/g) === 0, 'question-level headings are forbidden');
assert(/aria-label="עמוד 1"[^>]*>1<\/div>/.test(html), 'independent numbering must start at page 1');
assert(count(/class="visual-card"/g) === 8, 'page 1 must contain exactly 8 visual classification items');
assert(answers.task1.length === 8, 'answer key must cover all 8 visual items');
assert(answers.page === 1 && answers.project === 'מעגל', 'answer key identity mismatch');
assert(!html.includes('π'), 'pi is not allowed on circle page 1');
assert(!/[×]/.test(html), 'multiplication sign × is forbidden');
assert(!/demo|placeholder/i.test(html), 'demo/placeholder text is forbidden');
assert(/width:210mm/.test(css) && /height:297mm/.test(css), 'A4 dimensions must be exactly 210×297mm');
assert(/overflow:hidden/.test(css), 'A4 page must guard against overflow');
assert(/@page\{size:A4;margin:0\}/.test(css), 'print page contract is missing');
assert(answers.qa.openResponseAllowed === false, 'open response must stay disabled');
assert(answers.qa.piAllowed === false && answers.qa.areaFormulaAllowed === false, 'page 1 topic boundary mismatch');

console.log('Circle page 1 QA: PASS');