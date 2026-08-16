const fs = require('fs');

{
  const file = 'circle/a4-utilization.css';
  let css = fs.readFileSync(file, 'utf8');
  const marker = '/* Circle 150px final utilization lock — measured Chrome residuals. */';
  if (!css.includes(marker)) {
    css += `\n\n${marker}\n` +
      `/* Page 36 was measured at 155px blank space: enlarge the existing explanatory diagrams only. */\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 36"]) .visual-card{min-height:72mm!important}\n\n` +
      `/* Page 73 was measured above target: expand existing reasoning cards only. */\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 73"]) .choice-box{padding:5mm!important}\n\n` +
      `/* Page 74: use the available height for the three existing tangency diagrams. */\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 74"]) .coord-strip .coord-card{min-height:78mm!important;padding:4mm!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 74"]) .coord-strip svg{height:62mm!important;max-height:62mm!important}\n\n` +
      `/* Page 78: restore the main coordinate figure from an older compact cap and enlarge existing work cards. */\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 78"])>.coord-card{padding:4mm!important;margin-block:4mm!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 78"])>.coord-card svg{height:auto!important;max-height:88mm!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 78"]) .choice-grid{gap:4mm!important}\n` +
      `.a4-page:has(.page-number[aria-label="עמוד 78"]) .choice-box{padding:4mm!important}\n`;
  }
  fs.writeFileSync(file, css);
}

{
  const file = 'tools/qa-a4-pages.mjs';
  let text = fs.readFileSync(file, 'utf8');
  const oldBlock = `  if (metrics.unusedGapBeforeFooter > EXTREME_UNUSED_GAP_PX && metrics.usefulChildCount > 0) {\n    failures.push(\`extreme purposeless blank zone \${metrics.unusedGapBeforeFooter.toFixed(0)}px before footer\`);\n  }`;
  if (!text.includes('circleUnusedGapLimit')) {
    if (!text.includes(oldBlock)) throw new Error('A4 unused-gap failure block not found');
    const newBlock = `  const circleUnusedGapLimit = WARN_UNUSED_GAP_PX;\n  const unusedGapLimit = book === 'circle' ? circleUnusedGapLimit : EXTREME_UNUSED_GAP_PX;\n  if (metrics.unusedGapBeforeFooter > unusedGapLimit && metrics.usefulChildCount > 0) {\n    failures.push(\`purposeless blank zone \${metrics.unusedGapBeforeFooter.toFixed(0)}px before footer (limit \${unusedGapLimit}px)\`);\n  }`;
    text = text.replace(oldBlock, newBlock);
  }
  fs.writeFileSync(file, text);
}

console.log('Applied final Circle utilization corrections and locked >150px as a Circle failure.');
