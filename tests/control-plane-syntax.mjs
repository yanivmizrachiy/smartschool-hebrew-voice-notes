import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const codeRoots = ['src', 'viewer', 'tools', 'tests'];
const jsonRoots = ['content'];
const errors = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

for (const relRoot of codeRoots) {
  for (const file of walk(path.join(root, relRoot))) {
    if (!/\.(?:mjs|js)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
      errors.push(`${path.relative(root, file)}: ${result.stderr || result.stdout || 'syntax check failed'}`.trim());
    }
  }
}

for (const relRoot of jsonRoots) {
  for (const file of walk(path.join(root, relRoot))) {
    if (!file.endsWith('.json')) continue;
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`${path.relative(root, file)}: invalid JSON: ${error.message}`);
    }
  }
}

if (errors.length) {
  console.error(`Control-plane syntax gate failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: all JS/MJS control-plane files parse under the pinned Node runtime and all content JSON files are valid JSON.');
