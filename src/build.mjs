import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));

function replaceOne(text, re, replacement, label, file) {
  if (!re.test(text)) throw new Error(`${file}: missing ${label}`);
  return text.replace(re, replacement);
}

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

for (let index = 0; index < workbook.pages.length; index += 1) {
  const page = workbook.pages[index];
  const prev = workbook.pages[index - 1];
  const next = workbook.pages[index + 1];
  const file = path.join(root, 'worksheets', `${page.slug}.html`);
  if (!fs.existsSync(file)) throw new Error(`Missing worksheet: ${file}`);
  let html = fs.readFileSync(file, 'utf8');

  html = replaceOne(html, /<title>[^<]*<\/title>/, `<title>${page.title}</title>`, 'document title', file);
  html = replaceOne(html, /<h1 class="page-title">[\s\S]*?<\/h1>/, `<h1 class="page-title">${page.title}</h1>`, 'page title', file);
  html = replaceOne(html, /<p class="page-subtitle">[\s\S]*?<\/p>/, `<p class="page-subtitle">${page.subtitle}</p>`, 'page subtitle', file);
  html = replaceOne(html, /<div class="page-number">[\s\S]*?<\/div>/, `<div class="page-number">${page.id}</div>`, 'page number', file);

  const nav = `<nav class="preview-nav" aria-label="ניווט בין דפי החרוט">${prev ? `<a href="${prev.slug}.html">הקודם</a>` : '<span></span>'}<span class="meta">חרוט — עמוד ${page.id} / ${workbook.pageCount}</span>${next ? `<a href="${next.slug}.html">הבא</a>` : '<span></span>'}</nav>`;
  html = replaceOne(html, /<nav class="preview-nav"[\s\S]*?<\/nav>/, nav, 'preview navigation', file);

  html = html.replace(/\sdata-word-bank="[^"]*"/g, '');
  if (page.verbalBank && page.verbalSupportExempt !== true) {
    html = replaceOne(
      html,
      /<main class="([^"]*\ba4-page\b[^"]*)">/,
      `<main class="$1" data-word-bank="${escapeAttr(page.verbalBank)}">`,
      'A4 main element',
      file
    );
  }

  html = replaceOne(
    html,
    /<footer class="gz-footer">[\s\S]*?<\/footer>/,
    `<footer class="gz-footer"><div class="f1">${workbook.credit.line1}</div><div class="f2">${workbook.credit.line2}</div></footer>`,
    'credit footer',
    file
  );

  fs.writeFileSync(file, html, 'utf8');
}

console.log(`Synced ${workbook.pages.length} printable worksheet pages, navigation and verbal-support banks from content/workbook.json`);
