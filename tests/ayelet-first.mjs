import fs from 'node:fs';
const workbook = JSON.parse(fs.readFileSync('content/workbook.json', 'utf8'));
const first = workbook.printSequence?.[0];
const ayelet = workbook.pages?.find(page => page.sourceId === 'drive-cone-companion-ayelet');
const errors = [];
if (!ayelet) errors.push('Ayelet source page missing');
if (ayelet?.id !== 17) errors.push('Ayelet source page must remain page-17');
if (!(first?.kind === 'worksheet' && first?.id === 17)) errors.push('Ayelet source page page-17 must be first in printSequence');
if (workbook.printSequence?.length !== 46) errors.push('printSequence must remain exactly 46 sheets');
if (errors.length) { for (const e of errors) console.error('- ' + e); process.exit(1); }
console.log('OK: Ayelet source page is first of 46 sheets.');
