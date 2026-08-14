import fs from 'node:fs';

const workbook = JSON.parse(fs.readFileSync('content/workbook.json', 'utf8'));
const first = workbook.printSequence?.[0];
const ayeletPage = workbook.pages?.find(page => page.sourceId === 'drive-cone-companion-ayelet');

const errors = [];
if (!ayeletPage) errors.push('Ayelet source page is missing from workbook metadata');
if (ayeletPage?.id !== 17) errors.push(`Ayelet source page must remain page-17; found ${ayeletPage?.id ?? 'none'}`);
if (!(first?.kind === 'worksheet' && first?.id === 17)) {
  errors.push('Ayelet source page page-17 must be the first item in printSequence');
}
if (workbook.printSequence?.length !== 46) {
  errors.push(`printSequence must remain 46 sheets; found ${workbook.printSequence?.length ?? 0}`);
}

if (errors.length) {
  console.error(`Ayelet-first contract failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: Ayelet source page page-17 is locked as the first of 46 print sheets.');
