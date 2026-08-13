import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const fail = message => errors.push(message);

const assets = [
  'visual-assets/cone-3d-upright.svg',
  'visual-assets/cone-3d-down.svg',
  'visual-assets/cone-3d-side.svg'
];

for (const rel of assets) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`${rel}: missing canonical 3D cone asset`);
    continue;
  }
  const svg = fs.readFileSync(file, 'utf8');
  if (!/<linearGradient\b/.test(svg)) fail(`${rel}: missing surface gradient`);
  if (!/(?:<radialGradient\b|<linearGradient\b[\s\S]*id="opening")/.test(svg)) fail(`${rel}: missing depth/base gradient`);
  if (!/<filter\b/.test(svg) || !/<feDropShadow\b/.test(svg)) fail(`${rel}: missing depth shadow`);
  if (!/<ellipse\b/.test(svg)) fail(`${rel}: missing elliptical depth cue`);
  if (!/stroke-dasharray/.test(svg)) fail(`${rel}: missing hidden-rim depth cue`);
}

const required3d = new Map([
  [1, 3],
  [4, 1],
  [5, 1],
  [9, 1],
  [19, 1],
  [20, 1],
  [27, 1],
  [28, 1],
  [32, 1],
  [33, 1],
  [38, 1]
]);

for (const [id, expected] of required3d) {
  const rel = `worksheets/page-${id}.html`;
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const count = (html.match(/data-cone-render="3d"/g) || []).length;
  if (count !== expected) fail(`${rel}: expected ${expected} canonical 3D cone figure(s), found ${count}`);

  const referencedAssets = (html.match(/\.\.\/visual-assets\/cone-3d-(?:upright|down|side)\.svg/g) || []).length;
  if (referencedAssets < expected) fail(`${rel}: canonical 3D figure does not reference enough shared cone assets`);

  for (const match of html.matchAll(/<svg\b[^>]*data-cone-render="3d"[^>]*>[\s\S]*?<\/svg>/g)) {
    const block = match[0];
    if (!/class="[^"]*cone-3d-figure/.test(block)) fail(`${rel}: 3D cone SVG missing cone-3d-figure class`);
    if (!/aria-label="[^"]*תלת־ממדי/.test(block)) fail(`${rel}: 3D cone SVG must describe its depth in aria-label`);
    if (!/<image\b[^>]*href="\.\.\/visual-assets\/cone-3d-/.test(block)) fail(`${rel}: 3D cone SVG must use a canonical shared asset`);
  }
}

const intentional2d = [2, 24, 25, 26, 34];
for (const id of intentional2d) {
  const rel = `worksheets/page-${id}.html`;
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  if (/data-cone-render="3d"/.test(html)) fail(`${rel}: section/net diagram is intentionally 2D and must not be mislabeled as a 3D body view`);
}

if (errors.length) {
  console.error(`Visual quality contract failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: all 11 body-view worksheets use the canonical premium 3D cone system; section/net diagrams remain intentionally 2D.');
