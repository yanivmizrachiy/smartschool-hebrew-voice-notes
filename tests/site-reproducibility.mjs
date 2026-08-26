import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const distManifest = path.join(root, 'dist', 'build-manifest.json');

function runBuild() {
  const result = spawnSync(process.execPath, ['src/build-site.mjs'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`site build failed with exit ${result.status}`);
  }
  if (!fs.existsSync(distManifest)) throw new Error('site build did not create dist/build-manifest.json');
  return JSON.parse(fs.readFileSync(distManifest, 'utf8'));
}

const first = runBuild();
const second = runBuild();

if (!first.runtimeTree?.sha256 || !second.runtimeTree?.sha256) {
  throw new Error('site build manifest is missing runtimeTree.sha256');
}
if (first.runtimeTree.fileCount !== second.runtimeTree.fileCount || first.runtimeTree.sha256 !== second.runtimeTree.sha256) {
  throw new Error(`site build is not reproducible: first=${JSON.stringify(first.runtimeTree)} second=${JSON.stringify(second.runtimeTree)}`);
}

console.log(`OK: complete site build is reproducible (${second.runtimeTree.fileCount} runtime files, ${second.runtimeTree.sha256}).`);
