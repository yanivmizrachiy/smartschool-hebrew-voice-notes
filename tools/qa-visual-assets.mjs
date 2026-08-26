import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'qa', 'visual-assets');
const assets = [
  'visual-assets/anis-basics.jpg',
  'visual-assets/cone-in-my-head.jpg',
  'visual-assets/jerusalem-cone-vision.jpg',
  'visual-assets/world-of-cones.jpg'
];

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('not a JPEG');
  let offset = 2;
  while (offset + 4 < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    const sof = (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (sof) {
      if (offset + 7 > buffer.length) break;
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  throw new Error('JPEG dimensions not found');
}

const results = assets.map(rel => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return { path: rel, exists: false, printReady: false, reason: 'missing' };
  try {
    const buffer = fs.readFileSync(file);
    const { width, height } = jpegDimensions(buffer);
    const shortEdge = Math.min(width, height);
    const longEdge = Math.max(width, height);
    const printReady = shortEdge >= 2000 && longEdge >= 2800;
    return {
      path: rel,
      exists: true,
      bytes: buffer.length,
      width,
      height,
      printReady,
      reason: printReady ? 'meets high-resolution A4 raster floor' : 'below high-resolution A4 raster floor (2000×2800 minimum edges)'
    };
  } catch (error) {
    return { path: rel, exists: true, printReady: false, reason: error.message };
  }
});

const blocked = results.filter(item => !item.printReady);
const report = {
  schemaVersion: 1,
  target: 'full-page A4 raster source quality',
  minimumEdgesPx: { short: 2000, long: 2800 },
  blocked: blocked.length > 0,
  blockedCount: blocked.length,
  assets: results
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'status.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

for (const item of blocked) console.log(`::warning file=${item.path}::BLOCKED EXTERNAL ASSET — ${item.reason}`);
console.log(blocked.length
  ? `Visual asset audit: ${blocked.length}/${results.length} full-page assets remain externally blocked; no replacement was fabricated.`
  : `Visual asset audit: all ${results.length} full-page raster assets meet the configured print-resolution floor.`);
