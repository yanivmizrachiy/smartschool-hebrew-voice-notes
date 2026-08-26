import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const required = [
  'index.html',
  'print.html',
  'viewer/bootstrap.js',
  'viewer/app.js',
  'content/catalog.json',
  'content/circle.json',
  'content/cylinder.json',
  'content/workbook.json'
];

const fail = message => { throw new Error(`Dist contract failed: ${message}`); };
if (!fs.existsSync(dist)) fail('dist/ does not exist; run node src/build-site.mjs');

for (const rel of required) {
  if (!fs.existsSync(path.join(dist, rel))) fail(`missing runtime file ${rel}`);
}
if (!fs.existsSync(path.join(dist, 'build-manifest.json'))) fail('missing build-manifest.json');

for (let page = 1; page <= 88; page += 1) {
  if (!fs.existsSync(path.join(dist, 'circle', `page-${page}.html`))) fail(`missing circle page ${page}`);
}
for (let page = 1; page <= 38; page += 1) {
  if (!fs.existsSync(path.join(dist, 'cylinder', `page-${page}.html`))) fail(`missing cylinder page ${page}`);
}

const cone = JSON.parse(fs.readFileSync(path.join(dist, 'content', 'workbook.json'), 'utf8'));
if (cone.pages?.length !== 38 || cone.visualPages?.length !== 8 || cone.printSequence?.length !== 46) {
  fail('cone deployment manifest does not preserve 38 worksheets + 8 visuals + 46 print sequence');
}
for (const page of cone.pages || []) {
  if (!fs.existsSync(path.join(dist, 'worksheets', `${page.slug}.html`))) fail(`missing cone worksheet ${page.slug}`);
}
for (const page of cone.visualPages || []) {
  if (!fs.existsSync(path.join(dist, 'visual-pages', `${page.slug}.html`))) fail(`missing cone visual page ${page.slug}`);
}

const forbidden = [
  'RULES.md', 'README.md', 'qa', 'tests', 'research', '.github', 'package.json', 'package-lock.json',
  'content/source-registry.json', 'content/schemas'
];
for (const rel of forbidden) {
  if (fs.existsSync(path.join(dist, rel))) fail(`development-only entry leaked into deployment artifact: ${rel}`);
}

const contentEntries = fs.readdirSync(path.join(dist, 'content')).sort();
const expectedContentEntries = ['catalog.json', 'circle.json', 'cylinder.json', 'workbook.json'];
if (JSON.stringify(contentEntries) !== JSON.stringify(expectedContentEntries)) {
  fail(`dist/content must contain runtime manifests only; found ${contentEntries.join(', ')}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'build-manifest.json'), 'utf8'));
if (manifest.counts?.circlePages !== 88 || manifest.counts?.cylinderPages !== 38 || manifest.counts?.conePages !== 46 || manifest.counts?.totalPages !== 172) {
  fail('build manifest counts are not 88/38/46/172');
}

console.log('OK: dist/ contains the complete 172-page runtime, only runtime manifests, and no development/source-provenance files.');
