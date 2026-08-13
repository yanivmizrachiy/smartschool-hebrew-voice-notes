import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const wb = JSON.parse(fs.readFileSync('content/workbook.json', 'utf8'));
const worksheets = new Map(wb.pages.map(page => [page.id, page]));
const visuals = new Map((wb.visualPages || []).map(page => [page.slug, page]));
const outDir = path.join('qa', 'layout-pages');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

function commandExists(command) {
  const probe = spawnSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return probe.status === 0;
}

const chrome = process.env.CHROME_BIN || ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find(commandExists);
if (!chrome) throw new Error('No supported Chrome/Chromium executable found. Set CHROME_BIN explicitly.');

for (let index = 0; index < wb.printSequence.length; index += 1) {
  const item = wb.printSequence[index];
  const page = item.kind === 'worksheet' ? worksheets.get(item.id) : visuals.get(item.slug);
  if (!page) throw new Error(`printSequence item ${index + 1} does not resolve to a page`);

  const rel = item.kind === 'worksheet'
    ? `worksheets/${page.slug}.html`
    : `visual-pages/${page.slug}.html`;
  const output = path.join(outDir, `${String(index + 1).padStart(2, '0')}-${page.slug}.png`);
  const args = [
    '--headless=new',
    '--hide-scrollbars',
    '--disable-gpu',
    '--no-sandbox',
    '--force-device-scale-factor=1',
    '--window-size=794,1123',
    '--virtual-time-budget=1200',
    `--screenshot=${output}`,
    `http://127.0.0.1:4173/${rel}`
  ];

  const result = spawnSync(chrome, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Chrome failed on page ${index + 1} (${rel}): ${result.stderr || result.stdout}`);
  if (!fs.existsSync(output) || fs.statSync(output).size < 1000) throw new Error(`Render missing or empty for page ${index + 1} (${rel})`);
  console.log(`${index + 1}/${wb.printSequence.length} ${rel}`);
}

const rendered = fs.readdirSync(outDir).filter(name => name.endsWith('.png'));
if (rendered.length !== wb.printSequence.length) {
  throw new Error(`Expected ${wb.printSequence.length} page renders, found ${rendered.length}`);
}

console.log(`OK: rendered ${rendered.length}/${wb.printSequence.length} A4 pages with ${chrome}.`);
