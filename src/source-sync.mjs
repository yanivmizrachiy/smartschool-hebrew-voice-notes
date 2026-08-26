import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceOne(text, re, replacement, label, file) {
  if (!re.test(text)) throw new Error(`${file}: missing ${label}`);
  return text.replace(re, replacement);
}

export function synchronizeWorkbookSources({ write = false } = {}) {
  const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
  const sequence = workbook.printSequence || workbook.pages.map(page => ({ kind: 'worksheet', id: page.id }));
  const localWorksheetPage = new Map();
  const localVisualPage = new Map();

  for (const [index, item] of sequence.entries()) {
    const localPage = index + 1;
    if (item.kind === 'worksheet') {
      if (localWorksheetPage.has(item.id)) throw new Error(`Worksheet ${item.id} appears more than once in printSequence`);
      localWorksheetPage.set(item.id, localPage);
    } else if (item.kind === 'visual') {
      if (localVisualPage.has(item.slug)) throw new Error(`Visual page ${item.slug} appears more than once in printSequence`);
      localVisualPage.set(item.slug, localPage);
    }
  }

  // Stable worksheet ids are intentional: print order may change independently of layout treatment.
  const textbookFillWorksheetIds = new Set([24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38]);
  const drift = [];

  const apply = (file, next) => {
    const current = fs.readFileSync(file, 'utf8');
    if (current === next) return;
    if (write) fs.writeFileSync(file, next, 'utf8');
    else drift.push(path.relative(root, file).replaceAll('\\', '/'));
  };

  for (const page of workbook.pages) {
    const file = path.join(root, 'worksheets', `${page.slug}.html`);
    if (!fs.existsSync(file)) throw new Error(`Missing worksheet: ${file}`);
    const localPage = localWorksheetPage.get(page.id);
    if (!localPage) throw new Error(`Worksheet ${page.id} is missing from printSequence`);
    let html = fs.readFileSync(file, 'utf8');

    html = replaceOne(html, /<title>[^<]*<\/title>/, `<title>${page.title}</title>`, 'document title', file);
    html = replaceOne(html, /<h1 class="page-title">[\s\S]*?<\/h1>/, `<h1 class="page-title">${page.title}</h1>`, 'page title', file);
    html = replaceOne(html, /<p class="page-subtitle">[\s\S]*?<\/p>/, `<p class="page-subtitle">${page.subtitle}</p>`, 'page subtitle', file);
    html = replaceOne(
      html,
      /<div class="page-number"[^>]*>[\s\S]*?<\/div>/,
      `<div class="page-number" data-local-page-number="true" aria-label="עמוד ${localPage}">${localPage}</div>`,
      'local page number',
      file
    );

    if (!html.includes('textbook-layout.css')) {
      html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        '<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="textbook-layout.css">'
      );
    }

    html = html.replace(/<main class="([^"]*)">/, (_, classes) => {
      const classSet = new Set(classes.split(/\s+/).filter(Boolean));
      classSet.delete('textbook-fill');
      if (textbookFillWorksheetIds.has(page.id)) classSet.add('textbook-fill');
      return `<main class="${[...classSet].join(' ')}">`;
    });

    html = html.replace(/\sdata-word-bank="[^"]*"/g, '');
    html = replaceOne(
      html,
      /<footer class="gz-footer">[\s\S]*?<\/footer>/,
      `<footer class="gz-footer"><div class="f1">${workbook.credit.line1}</div><div class="f2">${workbook.credit.line2}</div></footer>`,
      'credit footer',
      file
    );

    apply(file, html);
  }

  for (const page of workbook.visualPages || []) {
    const file = path.join(root, 'visual-pages', `${page.slug}.html`);
    if (!fs.existsSync(file)) throw new Error(`Missing visual page: ${file}`);
    const localPage = localVisualPage.get(page.slug);
    if (!localPage) throw new Error(`Visual page ${page.slug} is missing from printSequence`);
    let html = fs.readFileSync(file, 'utf8');

    html = html.replace(/\sdata-local-page="\d+"/g, '');
    html = html.replace(/<div class="local-page-number"[^>]*>[\s\S]*?<\/div>/g, '');
    html = replaceOne(
      html,
      /<main\b([^>]*\bclass="[^"]*\ba4-page\b[^"]*"[^>]*)>/,
      `<main$1 data-local-page="${localPage}"><div class="local-page-number" data-local-page-number="true" aria-label="עמוד ${localPage}">${localPage}</div>`,
      'A4 main',
      file
    );

    apply(file, html);
  }

  if (drift.length) {
    throw new Error(`Generated source drift detected in ${drift.length} file(s):\n- ${drift.join('\n- ')}\nRun npm run sync:source intentionally, review the diff, then commit it.`);
  }

  return {
    worksheets: workbook.pages.length,
    visualPages: (workbook.visualPages || []).length,
    wrote: write
  };
}
