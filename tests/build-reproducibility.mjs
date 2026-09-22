import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const targets = ['print/harut-a4.html', 'print/styles.css'];

function runPrintBuild() {
  const result = spawnSync(process.execPath, ['src/build-print.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
}

function fingerprint() {
  const hash = crypto.createHash('sha256');
  for (const rel of targets) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) throw new Error(`${rel}: missing after build`);
    hash.update(rel);
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

runPrintBuild();
const first = fingerprint();
runPrintBuild();
const second = fingerprint();

if (first !== second) {
  console.error(`Build reproducibility failed: ${first} != ${second}`);
  process.exit(1);
}

console.log(`OK: print build is reproducible (${first}).`);
