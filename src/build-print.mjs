import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const outDir = path.join(root, 'print');
fs.mkdirSync(outDir, { recursive: true });

const pages = [];
for (const page of workbook.pages) {
  const src = path.join(root, 'worksheets', `${page.slug}.html`);
  let html = fs.readFileSync(src, 'utf8');
  html = html.replace(/<nav class="preview-nav"[\s\S]*?<\/nav>/, '');
  const match = html.match(/<main class="a4-page[^>]*>[\s\S]*?<\/main>/);
  if (!match) throw new Error(`Cannot extract A4 page from ${src}`);
  pages.push(match[0]);
}

const baseCss = fs.readFileSync(path.join(root, 'worksheets', 'styles.css'), 'utf8');
const specialCssPath = path.join(root, 'worksheets', 'ayelet-special.css');
const specialCss = fs.existsSync(specialCssPath) ? fs.readFileSync(specialCssPath, 'utf8') : '';
const printCss = `${baseCss}\n\n${specialCss}\n\n/* Generated print bundle overrides */\nbody { background:#fff; }\n.a4-page { margin:0; box-shadow:none; page-break-after:always; break-after:page; }\n.a4-page:last-child { page-break-after:auto; break-after:auto; }\n`;
fs.writeFileSync(path.join(outDir, 'styles.css'), printCss, 'utf8');

const book = `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>חרוט — ${workbook.pageCount} דפי תרגול A4 להדפסה</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${pages.join('\n')}
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'harut-a4.html'), book, 'utf8');
console.log(`Built print/harut-a4.html with ${pages.length} A4 pages.`);
