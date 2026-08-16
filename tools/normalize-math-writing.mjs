import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content', 'workbook.json'), 'utf8'));
const lockedWorksheetIds = new Set((workbook.pages || []).filter(p => p.contentLocked === true).map(p => p.id));
const changed = [];
const stats = new Map();

function countAndReplace(text, pattern, replacement, label) {
  let count = 0;
  const next = text.replace(pattern, (...args) => {
    count++;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count) stats.set(label, (stats.get(label) || 0) + count);
  return next;
}

function writeIfChanged(file, original, next) {
  if (next === original) return;
  fs.writeFileSync(file, next, 'utf8');
  changed.push(path.relative(root, file).replaceAll('\\', '/'));
}

// Cone: normalize only project-authored worksheets. Source-locked page 17 is never rewritten.
for (const page of workbook.pages || []) {
  if (lockedWorksheetIds.has(page.id)) continue;
  const file = path.join(root, 'worksheets', `${page.slug}.html`);
  if (!fs.existsSync(file)) throw new Error(`Missing cone worksheet: ${file}`);
  const original = fs.readFileSync(file, 'utf8');
  let next = original;

  next = countAndReplace(next, /×/g, '·', '×→·');
  next = countAndReplace(next, /סמ[״"]ק/g, 'ס״מ³', 'סמ״ק→ס״מ³');
  next = countAndReplace(next, /סמ[״"]ר/g, 'ס״מ²', 'סמ״ר→ס״מ²');
  next = countAndReplace(next, /ס"מ/g, 'ס״מ', 'ASCII unit quotes→gershayim');
  next = countAndReplace(next, /היקף העיגול/g, 'היקף המעגל', 'היקף העיגול→היקף המעגל');
  next = countAndReplace(next, /היקף עיגול/g, 'היקף מעגל', 'היקף עיגול→היקף מעגל');

  writeIfChanged(file, original, next);
}

// Circle: algebraic subtraction uses the mathematical minus sign. Restrict to the audited pages.
for (const pageNo of [50, 51]) {
  const file = path.join(root, 'circle', `page-${pageNo}.html`);
  if (!fs.existsSync(file)) throw new Error(`Missing circle page: ${file}`);
  const original = fs.readFileSync(file, 'utf8');
  let next = original;
  next = countAndReplace(next, /x-([12])\b/g, 'x−$1', 'algebraic ASCII minus→mathematical minus');
  writeIfChanged(file, original, next);
}

// Guardrails: these are the exact classes of genuine findings from the audited baseline.
const expectedMinimums = new Map([
  ['×→·', 17],
  ['סמ״ק→ס״מ³', 45],
  ['סמ״ר→ס״מ²', 7],
  ['ASCII unit quotes→gershayim', 2],
  ['היקף העיגול→היקף המעגל', 1],
  ['היקף עיגול→היקף מעגל', 1],
  ['algebraic ASCII minus→mathematical minus', 4]
]);
for (const [label, minimum] of expectedMinimums) {
  const actual = stats.get(label) || 0;
  if (actual < minimum) throw new Error(`Normalization guard failed for ${label}: expected at least ${minimum}, found ${actual}`);
}

// Absolute source-lock guard: page-17 must remain byte-for-byte untouched by this script.
if (lockedWorksheetIds.size) {
  for (const id of lockedWorksheetIds) {
    if (changed.includes(`worksheets/page-${id}.html`)) throw new Error(`Source-locked worksheet page-${id} was modified`);
  }
}

console.log(`Normalized mathematical writing in ${changed.length} source page(s).`);
for (const [label, count] of [...stats.entries()].sort()) console.log(`${label}: ${count}`);
for (const file of changed) console.log(`changed: ${file}`);
