import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const root = process.cwd();
const input = path.join(root, 'print', 'harut-a4.html');
const output = path.join(root, 'print', 'harut-a4.pdf');

if (!fs.existsSync(input)) {
  throw new Error('Missing print/harut-a4.html. Run npm run build:print first.');
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(input).href, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: output,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  console.log(`Rendered ${output}`);
} finally {
  await browser.close();
}
