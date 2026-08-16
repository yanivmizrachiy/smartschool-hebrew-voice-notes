const fs = require('fs');

for (let n = 71; n <= 79; n += 1) {
  const file = `circle/page-${n}.html`;
  let text = fs.readFileSync(file, 'utf8');
  const oldForm = `<div class="page-number">${n}</div>`;
  const newForm = `<div class="page-number" aria-label="עמוד ${n}">${n}</div>`;
  if (text.includes(oldForm)) text = text.replace(oldForm, newForm);
  else if (!text.includes(newForm)) throw new Error(`${file}: local page-number marker not found`);
  fs.writeFileSync(file, text);
}

{
  const file = 'circle/a4-utilization.css';
  let css = fs.readFileSync(file, 'utf8');
  const marker = '/* Final measured residual tuning after the full-scan pass. */';
  if (!css.includes(marker)) {
    css += `\n\n${marker}\n` +
      `/* Page 47: remove the measured 25px overflow while preserving the larger work surfaces. */\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 47"]){font-size:16.5px!important;line-height:1.42!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 47"]) .task{margin-block:4.6mm!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 47"]) .instruction{margin-bottom:2.5mm!important}\n\n` +
      `/* Page 84: remove the measured 12px overflow by trimming spacing only. */\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 84"]){font-size:16.7px!important;line-height:1.43!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 84"]) .task{margin-block:5.8mm!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 84"]) .thinking{padding:4.2mm!important;line-height:1.48!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 84"]) .choice-row{padding-block:3mm!important}\n`;
  }
  fs.writeFileSync(file, css);
}

{
  const file = 'circle/qa.mjs';
  let qa = fs.readFileSync(file, 'utf8');
  const existing = 'accessible local page label is required';
  if (!qa.includes(existing)) {
    const anchor = '  assert(new RegExp(`class="page-number"[^>]*>${page}<\\\\/div>`).test(html), `page ${page}: visible page number mismatch`);';
    if (!qa.includes(anchor)) throw new Error('circle QA visible-page-number anchor not found');
    const guard = anchor + '\n' +
      '  assert(new RegExp(`class="page-number"[^>]*aria-label="עמוד ${page}"[^>]*>${page}<\\\\/div>`).test(html), `page ${page}: accessible local page label is required`);';
    qa = qa.replace(anchor, guard);
  }
  fs.writeFileSync(file, qa);
}

console.log('Final Circle A4 patch applied: pages 71-79 normalized; pages 47/84 residual layout tuned; QA accessibility guard locked.');
