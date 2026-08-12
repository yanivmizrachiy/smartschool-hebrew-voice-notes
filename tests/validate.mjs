import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const sourceRegistry = JSON.parse(fs.readFileSync(path.join(root, 'content/source-registry.json'), 'utf8'));
const css = fs.readFileSync(path.join(root, 'worksheets/styles.css'), 'utf8');
const errors = [];

const fail = (msg) => errors.push(msg);

if (workbook.pages.length !== workbook.pageCount) fail(`workbook pageCount=${workbook.pageCount}, pages=${workbook.pages.length}`);
if (!/@page\s*\{[^}]*size:\s*A4/i.test(css)) fail('styles.css: missing @page A4');
if (!/width:\s*210mm/.test(css) || !/height:\s*297mm/.test(css)) fail('styles.css: missing 210mm × 297mm A4 geometry');
if (!/\.gz-footer/.test(css)) fail('styles.css: missing .gz-footer');

for (const page of workbook.pages) {
  const rel = `worksheets/${page.slug}.html`;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { fail(`${rel}: missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');

  if (!/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html)) fail(`${rel}: missing Hebrew RTL root`);
  if (!html.includes('<link rel="stylesheet" href="styles.css">')) fail(`${rel}: missing shared stylesheet`);
  if (!html.includes('class="a4-page')) fail(`${rel}: missing .a4-page`);
  if (!html.includes(`<div class="page-number">${page.id}</div>`)) fail(`${rel}: wrong page number`);
  if (!html.includes(`עמוד ${page.id} / ${workbook.pageCount}`)) fail(`${rel}: wrong navigation count`);
  if (!html.includes(workbook.credit.line1) || !html.includes(workbook.credit.line2)) fail(`${rel}: credit mismatch`);
  if (/<style\b/i.test(html) || /\sstyle="/i.test(html)) fail(`${rel}: inline CSS is forbidden`);
  if (/\b(?:דמו|placeholder|lorem)\b/i.test(html)) fail(`${rel}: demo/placeholder content`);
  if (/class="rule-box"/.test(html)) fail(`${rel}: explanation/rule box is forbidden in student worksheets`);
  if (/<(?:h2|h3|p)[^>]*>[^<]*(?:תרגול|אתגר|העמקה|ביסוס|שלב\s*\d+)/.test(html)) fail(`${rel}: visible difficulty/stage label`);
  if (/שאלה\s*\d+/.test(html)) fail(`${rel}: visible question numbering is forbidden`);

  const curriculumLabelCount = (html.match(/מתוך תוכנית הלימודים/g) || []).length;
  const sourceIds = [...html.matchAll(/data-source="([^"]+)"/g)].map(m => m[1]);
  if (curriculumLabelCount !== sourceIds.length) {
    fail(`${rel}: every curriculum label must have exactly one data-source (${curriculumLabelCount} labels, ${sourceIds.length} ids)`);
  }
  for (const id of sourceIds) {
    const src = sourceRegistry.sources[id];
    if (!src) fail(`${rel}: unknown data-source ${id}`);
    else if (src.type !== 'official' || src.verified !== true) fail(`${rel}: data-source ${id} is not a verified official source`);
  }

  const svgCount = (html.match(/<svg\b/g) || []).length;
  const labelledSvgCount = (html.match(/<svg[^>]*role="img"[^>]*aria-label="[^"]+"/g) || []).length;
  if (svgCount !== labelledSvgCount) fail(`${rel}: every SVG must have role="img" and aria-label (${svgCount}/${labelledSvgCount})`);
}

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`OK: ${workbook.pageCount} cone worksheets passed structural contract validation.`);
