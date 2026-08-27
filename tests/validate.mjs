import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbookPath = path.join(root, 'content/workbook.json');
const registryPath = path.join(root, 'content/source-registry.json');
const workbook = JSON.parse(fs.readFileSync(workbookPath, 'utf8'));
const sourceRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const css = fs.readFileSync(path.join(root, 'worksheets/styles.css'), 'utf8');
const errors = [];
const fail = msg => errors.push(msg);
const forbiddenOutputText = /\b(?:דמו|demo|placeholder|lorem|sample|mock|todo)\b/i;
const forbiddenInternalStudentText = /(?:RULES\.md|workbook\.json|source-registry|\bQA\b|הוראת עורך|הוראה פנימית|טקסט פנימי)/i;
const oldProjectText = /smartschool|voice[- ]?notes|סמרטקול|הכתבה בעברית/i;

const allowedRootEntries = new Set([
  '.git', '.github', '.gitignore', '.nvmrc', 'README.md', 'RULES.md', 'content', 'design', 'index.html',
  'package.json', 'package-lock.json', 'print', 'print.html', 'qa', 'questions', 'research', 'src',
  'tests', 'tools', 'viewer', 'worksheets', 'visual-assets', 'visual-pages', 'circle', 'cylinder'
]);
for (const entry of fs.readdirSync(root)) if (!allowedRootEntries.has(entry)) fail(`root: unexpected entry ${entry}`);

if (workbook.project !== 'חרוט') fail(`workbook project must be חרוט, found ${JSON.stringify(workbook.project)}`);
if (workbook.pages.length !== workbook.pageCount) fail(`workbook pageCount=${workbook.pageCount}, pages=${workbook.pages.length}`);
const ids = workbook.pages.map(page => page.id);
const slugs = workbook.pages.map(page => page.slug);
if (new Set(ids).size !== ids.length) fail('workbook: duplicate page id');
if (new Set(slugs).size !== slugs.length) fail('workbook: duplicate page slug');
for (let i = 0; i < workbook.pages.length; i += 1) if (workbook.pages[i].id !== i + 1) fail(`workbook: page at index ${i} must have id ${i + 1}`);

const visualPages = workbook.visualPages || [];
const visualBySlug = new Map(visualPages.map(page => [page.slug, page]));
if (visualPages.length !== (workbook.visualPageCount || 0)) fail(`workbook visualPageCount=${workbook.visualPageCount}, visualPages=${visualPages.length}`);
if (new Set(visualPages.map(page => page.slug)).size !== visualPages.length) fail('workbook: duplicate visual page slug');
const sequence = workbook.printSequence || workbook.pages.map(page => ({ kind: 'worksheet', id: page.id }));
if (sequence.length !== (workbook.printSheetCount || workbook.pageCount)) fail(`print sequence=${sequence.length}, printSheetCount=${workbook.printSheetCount}`);
const sequenceWorksheetIds = sequence.filter(item => item.kind === 'worksheet').map(item => item.id);
if (sequenceWorksheetIds.length !== workbook.pageCount || new Set(sequenceWorksheetIds).size !== workbook.pageCount) fail('printSequence must contain each worksheet exactly once');
for (const id of ids) if (!sequenceWorksheetIds.includes(id)) fail(`printSequence missing worksheet ${id}`);
const sequenceVisualSlugs = sequence.filter(item => item.kind === 'visual').map(item => item.slug);
if (sequenceVisualSlugs.length !== visualPages.length || new Set(sequenceVisualSlugs).size !== visualPages.length) fail('printSequence must contain each visual page exactly once');
for (const slug of visualBySlug.keys()) if (!sequenceVisualSlugs.includes(slug)) fail(`printSequence missing visual page ${slug}`);

const localWorksheetPage = new Map();
const localVisualPage = new Map();
for (const [index, item] of sequence.entries()) {
  if (item.kind === 'worksheet') localWorksheetPage.set(item.id, index + 1);
  if (item.kind === 'visual') localVisualPage.set(item.slug, index + 1);
}

if (!/@page\s*\{[^}]*size:\s*A4/i.test(css)) fail('styles.css: missing @page A4');
if (!/width:\s*210mm/.test(css) || !/height:\s*297mm/.test(css)) fail('styles.css: missing 210mm × 297mm A4 geometry');
if (!/\.gz-footer/.test(css)) fail('styles.css: missing .gz-footer');
if (!/\.preview-nav\s*\{\s*display:\s*none/.test(css)) fail('styles.css: student output must hide preview navigation by default');

for (const [rel, text] of [
  ['content/workbook.json', fs.readFileSync(workbookPath, 'utf8')],
  ['content/source-registry.json', fs.readFileSync(registryPath, 'utf8')]
]) if (forbiddenOutputText.test(text)) fail(`${rel}: demo/placeholder content is forbidden`);

for (const page of workbook.pages) {
  const rel = `worksheets/${page.slug}.html`;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { fail(`${rel}: missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const localPage = localWorksheetPage.get(page.id);
  if (!/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html)) fail(`${rel}: missing Hebrew RTL root`);
  if (!html.includes('<link rel="stylesheet" href="styles.css">')) fail(`${rel}: missing shared stylesheet`);
  if (!html.includes('class="a4-page')) fail(`${rel}: missing .a4-page`);
  const pageNumber = html.match(/<div class="page-number"[^>]*>(\d+)<\/div>/);
  if (!pageNumber || Number(pageNumber[1]) !== localPage) fail(`${rel}: wrong local page number; expected ${localPage}`);
  if (!/data-local-page-number="true"/.test(html)) fail(`${rel}: local page number marker missing`);
  if (!html.includes(workbook.credit.line1) || !html.includes(workbook.credit.line2)) fail(`${rel}: credit mismatch`);
  if (/<style\b/i.test(html) || /\sstyle="/i.test(html)) fail(`${rel}: inline CSS is forbidden`);
  if (forbiddenOutputText.test(html)) fail(`${rel}: demo/placeholder content is forbidden`);
  if (forbiddenInternalStudentText.test(html)) fail(`${rel}: internal editor/QA text is forbidden in student output`);
  if (oldProjectText.test(html)) fail(`${rel}: old project branding/content is forbidden`);
  if (/class="rule-box"/.test(html)) fail(`${rel}: explanation/rule box is forbidden in student worksheets`);
  if (/<(?:h2|h3|p)[^>]*>[^<]*(?:תרגול|אתגר|העמקה|ביסוס|שלב\s*\d+)/.test(html)) fail(`${rel}: visible difficulty/stage label`);
  if (/שאלה\s*\d+/.test(html)) fail(`${rel}: visible question numbering is forbidden`);
  const curriculumLabelCount = (html.match(/מתוך תוכנית הלימודים/g) || []).length;
  const sourceIds = [...html.matchAll(/data-source="([^"]+)"/g)].map(m => m[1]);
  if (curriculumLabelCount !== sourceIds.length) fail(`${rel}: every curriculum label must have exactly one data-source (${curriculumLabelCount} labels, ${sourceIds.length} ids)`);
  for (const id of sourceIds) {
    const src = sourceRegistry.sources[id];
    if (!src) fail(`${rel}: unknown data-source ${id}`);
    else if (src.type !== 'official' || src.sourceVerified !== true || src.questionExtracted !== true) fail(`${rel}: data-source ${id} is not an extracted verified official question`);
  }
  const accessibilityHtml = html.replace(/<div class="ay-bg"[^>]*aria-hidden="true">[\s\S]*?<\/div>/g, '');
  const svgTags = [...accessibilityHtml.matchAll(/<svg\b[^>]*>/g)].map(m => m[0]);
  const contentSvgs = svgTags.filter(tag => !/aria-hidden="true"/.test(tag));
  const labelledContentSvgs = contentSvgs.filter(tag => /role="img"/.test(tag) && /aria-label="[^"]+"/.test(tag));
  if (contentSvgs.length !== labelledContentSvgs.length) fail(`${rel}: every non-decorative SVG must have role="img" and aria-label (${contentSvgs.length}/${labelledContentSvgs.length})`);
}

const checkedScenes = new Map();
for (const page of visualPages) {
  const rel = `visual-pages/${page.slug}.html`;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { fail(`${rel}: missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const localPage = localVisualPage.get(page.slug);
  if (!/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html)) fail(`${rel}: missing Hebrew RTL root`);
  if (!html.includes('../worksheets/styles.css') || !html.includes('visual.css')) fail(`${rel}: missing visual/shared stylesheets`);
  if (!html.includes('class="a4-page visual-a4"')) fail(`${rel}: missing A4 visual page root`);
  const visualNumber = html.match(/<div class="local-page-number"[^>]*>(\d+)<\/div>/);
  if (!visualNumber || Number(visualNumber[1]) !== localPage) fail(`${rel}: wrong local page number; expected ${localPage}`);
  if (!html.includes(workbook.credit.line1) || !html.includes(workbook.credit.line2)) fail(`${rel}: credit mismatch`);
  if (/<style\b/i.test(html) || /\sstyle="/i.test(html)) fail(`${rel}: inline CSS is forbidden`);
  if (forbiddenOutputText.test(html) || forbiddenInternalStudentText.test(html) || oldProjectText.test(html)) fail(`${rel}: forbidden internal/legacy text`);
  if (!page.sceneAsset) { fail(`${rel}: missing sceneAsset`); continue; }
  const sceneFile = path.join(root, page.sceneAsset);
  if (!fs.existsSync(sceneFile)) { fail(`${page.sceneAsset}: missing`); continue; }
  if (!checkedScenes.has(page.sceneAsset)) {
    const scene = fs.readFileSync(sceneFile, 'utf8');
    const coneCount = (scene.match(/<use\s+href="#cone"/g) || []).length;
    checkedScenes.set(page.sceneAsset, coneCount);
    if (!/<svg[^>]*role="img"[^>]*aria-label="[^"]+"/.test(scene)) fail(`${page.sceneAsset}: SVG must have role=img and aria-label`);
  }
  if (checkedScenes.get(page.sceneAsset) !== page.verifiedConeCount) fail(`${page.sceneAsset}: expected exactly ${page.verifiedConeCount} cone instances, found ${checkedScenes.get(page.sceneAsset)}`);
}

const indexPath = path.join(root, 'index.html');
const appJsPath = path.join(root, 'viewer/app.js');
const printPagePath = path.join(root, 'print.html');
const printJsPath = path.join(root, 'viewer/print.js');
for (const file of [indexPath, appJsPath, printPagePath, printJsPath]) if (!fs.existsSync(file)) fail(`${path.relative(root, file)}: missing viewer file`);
if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  if (!/<h1[^>]*id="hero-title"[^>]*>מעגל · גליל · חרוט<\/h1>/.test(indexHtml)) fail('index.html: shared project title must name circle, cylinder and cone');
  if (!indexHtml.includes('data-total-pages') || !indexHtml.includes('data-book-pages="circle"') || !indexHtml.includes('data-book-pages="cylinder"') || !indexHtml.includes('data-book-pages="cone"')) fail('index.html: manifest-driven home count slots are missing');
  if (indexHtml.includes('90 דפי A4') || indexHtml.includes('41 דפי A4') || indexHtml.includes('46 דפי A4') || indexHtml.includes('177 דפי A4')) fail('index.html: canonical page counts must not be duplicated as hard-coded home text');
  if (!indexHtml.includes('viewer/bootstrap.js') || indexHtml.includes('src="viewer/app.js"')) fail('index.html: root must use lazy shared-home bootstrap instead of eager workbook app');
  if (!indexHtml.includes('id="library"')) fail('index.html: shared three-workbook library is missing');
  if (!indexHtml.includes('id="booklet-sheets"')) fail('index.html: missing continuous booklet sheets container');
  if (!indexHtml.includes('id="print-booklet"')) fail('index.html: missing whole-booklet print action');
  if (!indexHtml.includes('id="bw-toggle"')) fail('index.html: missing booklet black-and-white toggle');
  if (!indexHtml.includes('data-topic="cone"') || !indexHtml.includes('data-topic="circle"') || !indexHtml.includes('data-topic="cylinder"')) fail('index.html: shared viewer must expose cone/circle/cylinder topic selectors');
  if (oldProjectText.test(indexHtml)) fail('index.html: old project branding/content is forbidden');
}
if (fs.existsSync(appJsPath)) {
  const appJs = fs.readFileSync(appJsPath, 'utf8');
  if (!appJs.includes('catalogBook.manifest')) fail('viewer/app.js: must load the selected workbook through the canonical catalog manifest');
  if (/const\s+TOPICS\s*=/.test(appJs)) fail('viewer/app.js: must not duplicate canonical topic counts in a private TOPICS constant');
  if (!appJs.includes('worksheets/${page.slug}.html')) fail('viewer/app.js: must load worksheet pages from slugs');
  if (!appJs.includes("frameWrap.className = 'ws-wsframe'")) fail('viewer/app.js: continuous booklet frame rendering missing');
  if (!appJs.includes("printBooklet.addEventListener('click', printPreparedBooklet)")) fail('viewer/app.js: prepared whole-booklet print action missing');
  if (!appJs.includes('ensureAllFramesLoaded') || !appJs.includes('prepareFramesForPrint')) fail('viewer/app.js: safe all-pages print preparation is missing');
  if (oldProjectText.test(appJs)) fail('viewer/app.js: old project branding/content is forbidden');
}
if (fs.existsSync(printPagePath)) {
  const printPage = fs.readFileSync(printPagePath, 'utf8');
  if (!printPage.includes('worksheets/styles.css')) fail('print.html: missing worksheet print stylesheet');
  if (visualPages.length && !printPage.includes('visual-pages/visual.css')) fail('print.html: missing visual page stylesheet');
  if (!printPage.includes('viewer/print.js')) fail('print.html: missing print builder');
  if (oldProjectText.test(printPage)) fail('print.html: old project branding/content is forbidden');
}
if (fs.existsSync(printJsPath)) {
  const printJs = fs.readFileSync(printJsPath, 'utf8');
  if (!printJs.includes("fetch('content/workbook.json'")) fail('viewer/print.js: must load workbook.json dynamically');
  if (!printJs.includes('workbook.printSequence')) fail('viewer/print.js: must honor printSequence');
  if (!printJs.includes('worksheets/${page.slug}.html')) fail('viewer/print.js: must load worksheet entries');
  if (visualPages.length && !printJs.includes('visual-pages/${page.slug}.html')) fail('viewer/print.js: must load visual entries');
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
  const a4Count = (printHtml.match(/<main\b[^>]*class="[^"]*\ba4-page\b[^"]*"[^>]*>/g) || []).length;
  const expectedSheets = workbook.printSheetCount || workbook.pageCount;
  if (a4Count !== expectedSheets) fail(`print/harut-a4.html: expected ${expectedSheets} A4 pages, found ${a4Count}`);
  if (/<nav\b/i.test(printHtml)) fail('print/harut-a4.html: navigation is forbidden in print output');
  if (/<style\b/i.test(printHtml) || /\sstyle="/i.test(printHtml)) fail('print/harut-a4.html: inline CSS is forbidden');
  if (forbiddenOutputText.test(printHtml) || forbiddenInternalStudentText.test(printHtml) || oldProjectText.test(printHtml)) fail('print/harut-a4.html: forbidden output text');
  if (!/@page\s*\{[^}]*size:\s*A4/i.test(printCss)) fail('print/styles.css: missing @page A4');
  if (visualPages.length && !/\.visual-a4/.test(printCss)) fail('print/styles.css: missing visual page styles');
  const printLocalPages = [...printHtml.matchAll(/data-local-page="(\d+)"/g)].map(match => Number(match[1]));
  if (printLocalPages.length !== expectedSheets) fail(`print/harut-a4.html: expected ${expectedSheets} local page markers, found ${printLocalPages.length}`);
  for (let i = 0; i < expectedSheets; i += 1) if (printLocalPages[i] !== i + 1) fail(`print/harut-a4.html: local page at index ${i} must be ${i + 1}`);
  for (const page of visualPages) if (!printHtml.includes(page.title)) fail(`print/harut-a4.html: missing visual page ${page.slug}`);
  const credit1Count = printHtml.split(workbook.credit.line1).length - 1;
  const credit2Count = printHtml.split(workbook.credit.line2).length - 1;
  if (credit1Count !== expectedSheets || credit2Count !== expectedSheets) fail(`print/harut-a4.html: credit must appear exactly ${expectedSheets} times`);
}

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`OK: ${workbook.pageCount} worksheets + ${visualPages.length} visual pages; ${(workbook.printSheetCount || workbook.pageCount)} A4 print sheets passed validation with topic-local numbering.`);