const fs = require('fs');
const file = 'circle/a4-utilization.css';
let css = fs.readFileSync(file, 'utf8');
const marker = '/* Final sub-threshold tuning for Circle pages 74 and 77. */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n` +
    `/* Page 74 measured 154px: add ~8px to the existing diagram row. */\n` +
    `.a4-page:has(.page-number[aria-label="עמוד 74"]) .coord-strip .coord-card{min-height:80mm!important}\n` +
    `.a4-page:has(.page-number[aria-label="עמוד 74"]) .coord-strip svg{height:64mm!important;max-height:64mm!important}\n\n` +
    `/* Page 77 rounded to 150px but was fractionally above the strict threshold: enlarge existing table rows slightly. */\n` +
    `.a4-page:has(.page-number[aria-label="עמוד 77"]) .table-compact th,\n` +
    `.a4-page:has(.page-number[aria-label="עמוד 77"]) .table-compact td{padding-block:1.3mm!important}\n`;
}
fs.writeFileSync(file, css);
console.log('Applied final page 74/77 measured A4 tuning.');
