import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'page-1.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const answers = JSON.parse(fs.readFileSync(path.join(dir, 'page-1.answers.json'), 'utf8'));

const assert = (condition, message) => {
  if (!condition) throw new Error(`Cylinder page 1 QA failed: ${message}`);
};
const count = (pattern) => (html.match(pattern) || []).length;

assert(/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html), 'Hebrew RTL root is required');
assert(count(/<h1\b/g) === 1, 'exactly one visible page heading is required');
assert(count(/<h[23]\b/g) === 0, 'question-level headings are forbidden');
assert(/aria-label="עמוד 1"[^>]*>1<\/div>/.test(html), 'independent numbering must start at page 1');
assert(count(/class="shape-card"/g) === 12, 'page 1 must contain exactly 12 vector items');
assert(Object.keys(answers.task1).length === 12, 'answer key must cover all 12 visual items');
assert(answers.qa.planarItems === 5 && answers.qa.solidItems === 7, '5/7 classification contract mismatch');
assert(answers.page === 1 && answers.project === 'גליל', 'answer key identity mismatch');
assert(!html.includes('π'), 'pi is not part of cylinder page 1');
assert(!/V\s*=|B\s*=/.test(html), 'volume/base-area formulas are forbidden on cylinder page 1');
assert(!/[×]/.test(html), 'multiplication sign × is forbidden');
assert(!/demo|placeholder/i.test(html), 'demo/placeholder text is forbidden');
assert(/width:210mm/.test(css) && /height:297mm/.test(css), 'A4 dimensions must be exactly 210×297mm');
assert(/overflow:hidden/.test(css), 'A4 page must guard against overflow');
assert(/@page\{size:A4;margin:0\}/.test(css), 'print page contract is missing');
assert(answers.qa.openResponseAllowed === false, 'open response must stay disabled');
assert(answers.qa.perspectiveMeasurementAllowed === false, 'perspective measurement must stay forbidden');

console.log('Cylinder page 1 QA: PASS');