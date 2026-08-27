import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const dir = path.join(root, 'qa', 'print-booklets');
const expected = [
  { file: 'cone-46-pages.pdf', topic: 'cone', pages: 46 },
  { file: 'circle-93-pages.pdf', topic: 'circle', pages: 93 },
  { file: 'cylinder-41-pages.pdf', topic: 'cylinder', pages: 41 }
];

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const pdfs = expected.map(item => {
  const file = path.join(dir, item.file);
  if (!fs.existsSync(file)) throw new Error(`Missing canonical PDF: ${item.file}`);
  const buffer = fs.readFileSync(file);
  if (buffer.length === 0) throw new Error(`Canonical PDF is empty: ${item.file}`);
  return {
    topic: item.topic,
    expectedPages: item.pages,
    file: item.file,
    bytes: buffer.length,
    sha256: sha256(buffer)
  };
});

const report = {
  schemaVersion: 1,
  totalExpectedPages: pdfs.reduce((sum, item) => sum + item.expectedPages, 0),
  pdfs
};

if (report.totalExpectedPages !== 180) throw new Error(`Unexpected total PDF pages: ${report.totalExpectedPages}`);
fs.writeFileSync(path.join(dir, 'fingerprints.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log('OK: SHA-256 fingerprints recorded for cone/circle/cylinder canonical PDFs (180 expected pages total).');
