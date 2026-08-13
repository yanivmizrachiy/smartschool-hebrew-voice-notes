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

  const bookPage = sequenceIndex + 1;
  const numbered = match[0].replace(
    /<main\b([^>]*\bclass="[^"]*\ba4-page\b[^"]*"[^>]*)>/,
    `<main$1 data-book-page="${bookPage}"><div class="book-page-number" aria-label="עמוד ${bookPage} מתוך ${sequence.length}">${bookPage}</div>`
  );
  pages.push(numbered);
}

const baseCss = fs.readFileSync(path.join(root, 'worksheets', 'styles.css'), 'utf8');
const specialCssPath = path.join(root, 'worksheets', 'ayelet-special.css');
const specialCss = fs.existsSync(specialCssPath) ? fs.readFileSync(specialCssPath, 'utf8') : '';
const visualCssPath = path.join(root, 'visual-pages', 'visual.css');
const visualCss = fs.existsSync(visualCssPath) ? fs.readFileSync(visualCssPath, 'utf8') : '';
const printCss = `${baseCss}\n\n${specialCss}\n\n${visualCss}\n\n/* Generated print bundle overrides */\nbody { background:#fff; }\n.a4-page { margin:0; box-shadow:none; page-break-after:always; break-after:page; }\n.a4-page:last-child { page-break-after:auto; break-after:auto; }\n.sheet-footer,.page-number { display:none !important; }\n.book-page-number { position:absolute; left:7mm; bottom:5mm; z-index:100; min-width:9mm; height:9mm; padding:0 2.2mm; display:flex; align-items:center; justify-content:center; border-radius:999px; background:rgba(255,255,255,.92); border:1px solid rgba(36,48,68,.22); color:#243044; font:700 11px/1 \"Rubik\",\"Heebo\",sans-serif; box-shadow:0 2px 8px rgba(20,35,55,.10); }\n`;
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
console.log(`Built print/harut-a4.html with ${pages.length} sequentially numbered A4 pages.`);
