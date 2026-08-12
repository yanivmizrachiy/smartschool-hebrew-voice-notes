import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbookPath = path.join(root, 'content/workbook.json');
const registryPath = path.join(root, 'content/source-registry.json');
const workbook = JSON.parse(fs.readFileSync(workbookPath, 'utf8'));
const sourceRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const css = fs.readFileSync(path.join(root, 'worksheets/styles.css'), 'utf8');
const errors = [];
const fail = (msg) => errors.push(msg);
const forbiddenOutputText = /\b(?:דמו|demo|placeholder|lorem|sample|mock|todo)\b/i;
const oldProjectText = /smartschool|voice[- ]?notes|סמרטקול|הכתבה בעברית/i;

const allowedRootEntries = new Set([
  '.git', '.github', 'README.md', 'RULES.md', 'content', 'design', 'index.html',
  'package.json', 'print', 'print.html', 'qa', 'questions', 'research', 'src',
  'tests', 'tools', 'viewer', 'worksheets'
]);
for (const entry of fs.readdirSync(root)) {
  if (!allowedRootEntries.has(entry)) fail(`root: unexpected entry ${entry}`);
}

if (workbook.project !== 'חרוט') fail(`workbook project must be חרוט, found ${JSON.stringify(workbook.project)}`);
if (workbook.pages.length !== workbook.pageCount) fail(`workbook pageCount=${workbook.pageCount}, pages=${workbook.pages.length}`);
const ids = workbook.pages.map(page => page.id);
const slugs = workbook.pages.map(page => page.slug);
if (new Set(ids).size !== ids.length) fail('workbook: duplicate page id');
if (new Set(slugs).size !== slugs.length) fail('workbook: duplicate page slug');
for (let i = 0; i < workbook.pages.length; i += 1) {
  if (workbook.pages[i].id !== i + 1) fail(`workbook: page at index ${i} must have id ${i + 1}`);
}

if (!/@page\s*\{[^}]*size:\s*A4/i.test(css)) fail('styles.css: missing @page A4');
if (!/width:\s*210mm/.test(css) || !/height:\s*297mm/.test(css)) fail('styles.css: missing 210mm × 297mm A4 geometry');
if (!/\.gz-footer/.test(css)) fail('styles.css: missing .gz-footer');
if (!/\.preview-nav\s*\{\s*display:\s*none/.test(css)) fail('styles.css: student output must hide preview navigation by default');

for (const [rel, text] of [
  ['content/workbook.json', fs.readFileSync(workbookPath, 'utf8')],
  ['content/source-registry.json', fs.readFileSync(registryPath, 'utf8')]
]) {
  if (forbiddenOutputText.test(text)) fail(`${rel}: demo/placeholder content is forbidden`);
}

for (const page of workbook.pages) {
  const rel = `worksheets/${page.slug}.html`;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { fail(`${rel}: missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');

  if (!/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html)) fail(`${rel}: missing Hebrew RTL root`);
  if (!html.includes('<link rel="stylesheet" href="styles.css">')) fail(`${rel}: missing shared stylesheet`);
  if (!html.includes('class="a4-page')) fail(`${rel}: missing .a4-page`);
  if (!html.includes(`<div class="page-number">${page.id}</div>`)) fail(`${rel}: wrong page number`);
  if (!html.includes(workbook.credit.line1) || !html.includes(workbook.credit.line2)) fail(`${rel}: credit mismatch`);
  if (/<style\b/i.test(html) || /\sstyle="/i.test(html)) fail(`${rel}: inline CSS is forbidden`);
  if (forbiddenOutputText.test(html)) fail(`${rel}: demo/placeholder content is forbidden`);
  if (oldProjectText.test(html)) fail(`${rel}: old project branding/content is forbidden`);
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
    else if (src.type !== 'official' || src.sourceVerified !== true || src.questionExtracted !== true) {
      fail(`${rel}: data-source ${id} is not an extracted verified official question`);
    }
  }

  const svgCount = (html.match(/<svg\b/g) || []).length;
  const labelledSvgCount = (html.match(/<svg[^>]*role="img"[^>]*aria-label="[^"]+"/g) || []).length;
  if (svgCount !== labelledSvgCount) fail(`${rel}: every SVG must have role="img" and aria-label (${svgCount}/${labelledSvgCount})`);
}

const indexPath = path.join(root, 'index.html');
const appJsPath = path.join(root, 'viewer/app.js');
const printPagePath = path.join(root, 'print.html');
const printJsPath = path.join(root, 'viewer/print.js');
for (const file of [indexPath, appJsPath, printPagePath, printJsPath]) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)}: missing viewer file`);
}
if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  if (!/<h1>חרוט<\/h1>/.test(indexHtml)) fail('index.html: app title must be חרוט');
  if (!indexHtml.includes('id="worksheet-frame"')) fail('index.html: missing worksheet frame');
  if (!indexHtml.includes('id="print-current"')) fail('index.html: missing print-current action');
  if (!indexHtml.includes('href="print.html"')) fail('index.html: missing print-all link');
  if (oldProjectText.test(indexHtml)) fail('index.html: old project branding/content is forbidden');
}
if (fs.existsSync(appJsPath)) {
  const appJs = fs.readFileSync(appJsPath, 'utf8');
  if (!appJs.includes("fetch('content/workbook.json'")) fail('viewer/app.js: must load workbook.json dynamically');
  if (!appJs.includes('worksheets/${page.slug}.html')) fail('viewer/app.js: must load worksheet pages from slugs');
  if (!appJs.includes('frame.contentWindow?.print()')) fail('viewer/app.js: current-page print action missing');
  if (oldProjectText.test(appJs)) fail('viewer/app.js: old project branding/content is forbidden');
}
if (fs.existsSync(printPagePath)) {
  const printPage = fs.readFileSync(printPagePath, 'utf8');
  if (!printPage.includes('worksheets/styles.css')) fail('print.html: missing worksheet print stylesheet');
  if (!printPage.includes('viewer/print.js')) fail('print.html: missing print builder');
  if (oldProjectText.test(printPage)) fail('print.html: old project branding/content is forbidden');
}
if (fs.existsSync(printJsPath)) {
  const printJs = fs.readFileSync(printJsPath, 'utf8');
  if (!printJs.includes("fetch('content/workbook.json'")) fail('viewer/print.js: must load workbook.json dynamically');
  if (!printJs.includes('worksheets/${page.slug}.html')) fail('viewer/print.js: must load all worksheet pages from slugs');
  if (!printJs.includes('window.print()')) fail('viewer/print.js: print-all action missing');
  if (oldProjectText.test(printJs)) fail('viewer/print.js: old project branding/content is forbidden');
}

const printHtmlPath = path.join(root, 'print/harut-a4.html');
const printCssPath = path.join(root, 'print/styles.css');
if (!fs.existsSync(printHtmlPath) || !fs.existsSync(printCssPath)) {
  fail('print bundle missing: run npm run build:print');
} else {
  const printHtml = fs.readFileSync(printHtmlPath, 'utf8');
  const printCss = fs.readFileSync(printCssPath, 'utf8');
  const a4Count = (printHtml.match(/<main class="a4-page(?:\s+dense)?">/g) || []).length;
  if (a4Count !== workbook.pageCount) fail(`print/harut-a4.html: expected ${workbook.pageCount} A4 pages, found ${a4Count}`);
  if (/<nav\b/i.test(printHtml)) fail('print/harut-a4.html: navigation is forbidden in print output');
  if (/<style\b/i.test(printHtml) || /\sstyle="/i.test(printHtml)) fail('print/harut-a4.html: inline CSS is forbidden');
  if (forbiddenOutputText.test(printHtml)) fail('print/harut-a4.html: demo/placeholder content is forbidden');
  if (oldProjectText.test(printHtml)) fail('print/harut-a4.html: old project branding/content is forbidden');
  if (!/@page\s*\{[^}]*size:\s*A4/i.test(printCss)) fail('print/styles.css: missing @page A4');
  for (const page of workbook.pages) {
    if (!printHtml.includes(`<div class="page-number">${page.id}</div>`)) fail(`print/harut-a4.html: missing page number ${page.id}`);
  }
  const credit1Count = printHtml.split(workbook.credit.line1).length - 1;
  const credit2Count = printHtml.split(workbook.credit.line2).length - 1;
  if (credit1Count !== workbook.pageCount || credit2Count !== workbook.pageCount) {
    fail(`print/harut-a4.html: credit must appear exactly ${workbook.pageCount} times`);
  }
}

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`OK: ${workbook.pageCount} printable cone worksheets, viewer, repo hygiene and A4 print bundle passed validation.`);
