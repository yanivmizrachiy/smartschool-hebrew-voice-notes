import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));

function decodeEntities(text) {
  const map = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&pi;': 'π', '&sup2;': '²', '&sup3;': '³', '&times;': '×', '&divide;': '÷'
  };
  return text
    .replace(/&(nbsp|amp|lt|gt|quot|pi|sup2|sup3|times|divide);/g, m => map[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function extractText(html) {
  const aria = [...html.matchAll(/aria-label="([^"]+)"/g)].map(m => m[1]);
  let text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<div class="sheet-footer"[\s\S]*?<\/div>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<(?:br|\/p|\/h1|\/h2|\/h3|\/h4|\/li|\/tr|\/td|\/th|\/section|\/article|\/div|\/text)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text)
    .replace(/[\t\r ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const uniqueAria = [...new Set(aria.map(decodeEntities).map(s => s.trim()).filter(Boolean))];
  return { text, aria: uniqueAria };
}

function printPage(label, file) {
  const html = fs.readFileSync(file, 'utf8');
  const { text, aria } = extractText(html);
  console.log(`\n===== ${label} =====`);
  console.log(text);
  if (aria.length) {
    console.log('\n[ARIA/DIAGRAM DESCRIPTIONS]');
    for (const a of aria) console.log(`- ${a}`);
  }
}

console.log('=== FULL MATHEMATICAL AUDIT SOURCE DUMP ===');
console.log(`worksheets=${workbook.pages.length}, visualPages=${(workbook.visualPages || []).length}, printSheets=${workbook.printSequence?.length || workbook.pages.length}`);

for (const page of workbook.pages) {
  printPage(`WORKSHEET ${page.id}: ${page.title}`, path.join(root, 'worksheets', `${page.slug}.html`));
}

for (const page of workbook.visualPages || []) {
  printPage(`VISUAL ${page.slug}: ${page.title}`, path.join(root, 'visual-pages', `${page.slug}.html`));
}

const assetsDir = path.join(root, 'visual-assets');
for (const name of fs.readdirSync(assetsDir).filter(name => name.endsWith('.svg')).sort()) {
  printPage(`VISUAL-ASSET ${name}`, path.join(assetsDir, name));
}

let tessVersion = spawnSync('tesseract', ['--version'], { encoding: 'utf8' });
if (tessVersion.status !== 0 && process.env.CI) {
  console.log('\n=== Installing temporary OCR packages for raster visual audit ===');
  const update = spawnSync('sudo', ['apt-get', 'update', '-qq'], { encoding: 'utf8', stdio: 'pipe' });
  if (update.status === 0) {
    const install = spawnSync('sudo', ['apt-get', 'install', '-y', '-qq', 'tesseract-ocr', 'tesseract-ocr-heb'], { encoding: 'utf8', stdio: 'pipe' });
    if (install.status !== 0) console.log(`[OCR install failed] ${install.stderr || install.stdout}`);
  } else {
    console.log(`[OCR apt update failed] ${update.stderr || update.stdout}`);
  }
  tessVersion = spawnSync('tesseract', ['--version'], { encoding: 'utf8' });
}

if (tessVersion.status === 0) {
  const langsOut = spawnSync('tesseract', ['--list-langs'], { encoding: 'utf8' });
  const langs = langsOut.stdout || '';
  const lang = /(^|\n)heb(\n|$)/.test(langs) ? 'heb+eng' : 'eng';
  console.log(`\n=== RASTER VISUAL OCR (${lang}) ===`);
  for (const name of fs.readdirSync(assetsDir).filter(name => /\.jpe?g$/i.test(name)).sort()) {
    const file = path.join(assetsDir, name);
    const ocr = spawnSync('tesseract', [file, 'stdout', '-l', lang, '--psm', '6'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    console.log(`\n===== OCR ${name} =====`);
    console.log((ocr.stdout || '').trim() || '[no OCR text]');
    if (ocr.status !== 0 && ocr.stderr) console.log(`[tesseract-error] ${ocr.stderr.trim()}`);
  }
} else {
  console.log('\n=== RASTER VISUAL OCR UNAVAILABLE ===');
}

console.log('\n=== END FULL MATHEMATICAL AUDIT SOURCE DUMP ===');
