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

const catalog = readJson('content/catalog.json');
const manifests = Object.fromEntries(
  catalog.books.map(book => [book.id, readJson(book.manifest)])
);

const circlePages = manifests.circle.pageCount;
const cylinderPages = manifests.cylinder.pageCount;
const conePages = manifests.cone.printSheetCount;
const totalPages = circlePages + cylinderPages + conePages;

if (circlePages !== 88 || cylinderPages !== 38 || conePages !== 46 || totalPages !== 172) {
  throw new Error(`Refusing build manifest for unexpected counts: circle=${circlePages}, cylinder=${cylinderPages}, cone=${conePages}, total=${totalPages}`);
}

const manifest = {
  schemaVersion: 1,
  gitSha: gitSha(),
  rulesSha256: sha256(read('RULES.md')),
  catalogSha256: sha256(read('content/catalog.json')),
  manifestSha256: Object.fromEntries(catalog.books.map(book => [book.id, sha256(read(book.manifest))])),
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
console.log(`Built ${path.relative(root, target)} for ${totalPages} A4 pages at ${manifest.gitSha}.`);
