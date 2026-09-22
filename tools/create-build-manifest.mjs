import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const dist = path.join(root, 'dist');
const read = rel => fs.readFileSync(path.join(root, rel));
const readJson = rel => JSON.parse(read(rel).toString('utf8'));
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function gitSha() {
  const envSha = process.env.GITHUB_SHA?.trim();
  if (envSha) return envSha;
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  return 'unknown';
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function runtimeTreeFingerprint() {
  const entries = walkFiles(dist)
    .filter(file => path.basename(file) !== 'build-manifest.json')
    .map(file => ({
      path: path.relative(dist, file).replaceAll('\\', '/'),
      sha256: sha256(fs.readFileSync(file))
    }))
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));

  const canonical = entries.map(entry => `${entry.path}\0${entry.sha256}`).join('\n');
  return {
    fileCount: entries.length,
    sha256: sha256(canonical)
  };
}

const catalog = readJson('content/catalog.json');
const manifests = Object.fromEntries(
  catalog.books.map(book => [book.id, readJson(book.manifest)])
);

const circlePages = manifests.circle.pageCount;
const cylinderPages = manifests.cylinder.pageCount;
const conePages = manifests.cone.printSheetCount;
const totalPages = circlePages + cylinderPages + conePages;

if (circlePages !== 93 || cylinderPages !== 41 || conePages !== 46 || totalPages !== 180) {
  throw new Error(`Refusing build manifest for unexpected counts: circle=${circlePages}, cylinder=${cylinderPages}, cone=${conePages}, total=${totalPages}`);
}

const runtimeTree = runtimeTreeFingerprint();
const manifest = {
  schemaVersion: 2,
  gitSha: gitSha(),
  rulesSha256: sha256(read('RULES.md')),
  catalogSha256: sha256(read('content/catalog.json')),
  manifestSha256: Object.fromEntries(catalog.books.map(book => [book.id, sha256(read(book.manifest))])),
  runtimeTree,
  counts: {
    circlePages,
    cylinderPages,
    conePages,
    totalPages
  }
};

fs.mkdirSync(dist, { recursive: true });
const target = path.join(dist, 'build-manifest.json');
fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Built ${path.relative(root, target)} for ${totalPages} A4 pages at ${manifest.gitSha}; runtime=${runtimeTree.fileCount} files/${runtimeTree.sha256}.`);
