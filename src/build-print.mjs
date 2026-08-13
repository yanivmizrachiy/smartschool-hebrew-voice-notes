import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const outDir = path.join(root, 'print');
fs.mkdirSync(outDir, { recursive: true });

const worksheetById = new Map(workbook.pages.map(page => [page.id, page]));
const visualBySlug = new Map((workbook.visualPages || []).map(page => [page.slug, page]));
const sequence = workbook.printSequence || workbook.pages.map(page => ({ kind: 'worksheet', id: page.id }));
const pages = [];

function applyLocalPageNumber(mainHtml, localPage) {
  let html = mainHtml.replace(/\sdata-local-page="\d+"/g, '');
  html = html.replace(
    /<main\b([^>]*\bclass="[^"]*\ba4-page\b[^"]*"[^>]*)>/,
    `<main$1 data-local-page="${localPage}">`
  );

  const worksheetNumber = /<div class="page-number"[^>]*>[\s\S]*?<\/div>/;
  const visualNumber = /<div class="local-page-number"[^>]*>[\s\S]*?<\/div>/;
  const replacement = `<div class="page-number" data-local-page-number="true" aria-label="עמוד ${localPage}">${localPage}</div>`;

  if (worksheetNumber.test(html)) {
    return html.replace(worksheetNumber, replacement);
  }
  if (visualNumber.test(html)) {
    return html.replace(
      visualNumber,
      `<div class="local-page-number" data-local-page-number="true" aria-label="עמוד ${localPage}">${localPage}</div>`
    );
  }

  return html.replace(
    /<main\b([^>]*)>/,
    `<main$1><div class="local-page-number" data-local-page-number="true" aria-label="עמוד ${localPage}">${localPage}</div>`
  );
}

for (const [sequenceIndex, item] of sequence.entries()) {
  let src;
  if (item.kind === 'worksheet') {
    const page = worksheetById.get(item.id);
    if (!page) throw new Error(`Unknown worksheet id ${item.id}`);
    src = path.join(root, 'worksheets', `${page.slug}.html`);
  } else if (item.kind === 'visual') {
    const page = visualBySlug.get(item.slug);
    if (!page) throw new Error(`Unknown visual page ${item.slug}`);
    src = path.join(root, 'visual-pages', `${page.slug}.html`);
  } else {
    throw new Error(`Unknown print sequence kind ${item.kind}`);
  }

  let pageHtml = fs.readFileSync(src, 'utf8');
  pageHtml = pageHtml.replace(/<nav class="preview-nav"[\s\S]*?<\/nav>/, '');
  pageHtml = pageHtml.replace(/<footer class="sheet-footer"[\s\S]*?<\/footer>/g, '');
  const match = pageHtml.match(/<main class="a4-page[^>]*>[\s\S]*?<\/main>/);
  if (!match) throw new Error(`Cannot extract A4 page from ${src}`);

  const localPage = sequenceIndex + 1;
  pages.push(applyLocalPageNumber(match[0], localPage));
}

const baseCss = fs.readFileSync(path.join(root, 'worksheets', 'styles.css'), 'utf8');
const specialCssPath = path.join(root, 'worksheets', 'ayelet-special.css');
const specialCss = fs.existsSync(specialCssPath) ? fs.readFileSync(specialCssPath, 'utf8') : '';
const visualCssPath = path.join(root, 'visual-pages', 'visual.css');
const visualCss = fs.existsSync(visualCssPath) ? fs.readFileSync(visualCssPath, 'utf8') : '';
const printCss = `${baseCss}\n\n${specialCss}\n\n${visualCss}\n\n/* Generated print bundle overrides */\nbody { background:#fff; }\n.a4-page { margin:0; box-shadow:none; page-break-after:always; break-after:page; }\n.a4-page:last-child { page-break-after:auto; break-after:auto; }\n.sheet-footer { display:none !important; }\n`;
fs.writeFileSync(path.join(outDir, 'styles.css'), printCss, 'utf8');

const sheetCount = workbook.printSheetCount || pages.length;
const book = `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>חרוט — ${sheetCount} דפי A4 להדפסה</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${pages.join('\n')}
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'harut-a4.html'), book, 'utf8');
console.log(`Built print/harut-a4.html with ${pages.length} topic-locally numbered A4 pages.`);
