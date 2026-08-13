import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const assets = path.join(root, 'visual-assets');
const jpgs = fs.readdirSync(assets).filter(name => /\.jpe?g$/i.test(name)).sort();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harut-ocr-'));

const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
const tess = spawnSync('tesseract', ['--version'], { encoding: 'utf8' });
console.log('\n=== SECOND-PASS RASTER AUDIT: FFMPEG -> PNG -> OCR ===');
if (ff.status !== 0 || tess.status !== 0) {
  console.log(`ffmpeg=${ff.status === 0 ? 'yes' : 'no'}, tesseract=${tess.status === 0 ? 'yes' : 'no'}`);
  process.exit(0);
}

for (const name of jpgs) {
  const src = path.join(assets, name);
  const png = path.join(tmp, name.replace(/\.jpe?g$/i, '.png'));
  const conv = spawnSync('ffmpeg', ['-y', '-v', 'warning', '-err_detect', 'ignore_err', '-i', src, '-frames:v', '1', png], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  console.log(`\n===== FFMPEG ${name} =====`);
  if (!fs.existsSync(png) || fs.statSync(png).size === 0) {
    console.log('[conversion failed]');
    console.log((conv.stderr || conv.stdout || '').trim());
    continue;
  }
  console.log(`decoded PNG bytes=${fs.statSync(png).size}`);
  if (conv.stderr) console.log(`[decode warnings] ${conv.stderr.trim()}`);
  const ocr = spawnSync('tesseract', [png, 'stdout', '-l', 'heb+eng', '--psm', '6'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  console.log((ocr.stdout || '').trim() || '[no OCR text]');
  if (ocr.status !== 0 && ocr.stderr) console.log(`[OCR error] ${ocr.stderr.trim()}`);
}
