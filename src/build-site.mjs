import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const dist = path.join(root, 'dist');
const runtimeEntries = [
  'index.html',
  'print.html',
  'viewer',
  'circle',
  'cylinder',
  'worksheets',
  'visual-pages',
  'visual-assets',
  'print',
  'content/catalog.json',
  'content/circle.json',
  'content/cylinder.json',
  'content/workbook.json'
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const rel of runtimeEntries) {
  const source = path.join(root, rel);
  if (!fs.existsSync(source)) throw new Error(`Site runtime entry is missing: ${rel}`);
  const target = path.join(dist, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

const manifestResult = spawnSync(process.execPath, ['tools/create-build-manifest.mjs'], {
  cwd: root,
  stdio: 'inherit'
});
if (manifestResult.status !== 0) process.exit(manifestResult.status || 1);

console.log(`Built deployment artifact at ${path.relative(root, dist)}/ from ${runtimeEntries.length} explicit runtime entries.`);
