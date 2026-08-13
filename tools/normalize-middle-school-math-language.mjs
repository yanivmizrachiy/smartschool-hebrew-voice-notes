import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const worksheetsDir = path.join(root, 'worksheets');

function replaceLatinMathSymbols(text) {
  let out = text;
  const replacements = [
    ['V', 'נפח'],
    ['A', 'שטח'],
    ['r', 'רדיוס'],
    ['h', 'גובה'],
    ['l', 'יוצר'],
    ['d', 'קוטר'],
    ['b', 'בסיס']
  ];
  for (const [symbol, word] of replacements) {
    const re = new RegExp(`(?<![A-Za-z])${symbol}(?![A-Za-z])`, 'g');
    out = out.replace(re, word);
  }

  out = out
    .replace(/רדיוס\s*,\s*גובה\s*,\s*יוצר/g, 'רדיוס, גובה ויוצר')
    .replace(/רדיוס\s+ו-?גובה/g, 'רדיוס וגובה')
    .replace(/גובה\s+ו-?יוצר/g, 'גובה ויוצר')
    .replace(/רדיוס\s+ו-?יוצר/g, 'רדיוס ויוצר')
    .replace(/π\s*רדיוס/g, 'π × רדיוס')
    .replace(/רדיוס²\s*גובה/g, 'רדיוס² × גובה')
    .replace(/2\s*רדיוס/g, '2 × רדיוס')
    .replace(/1\/3/g, '⅓');
  return out;
}

function transformHtml(html) {
  const parts = html.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i += 1) {
    if (!parts[i].startsWith('<')) parts[i] = replaceLatinMathSymbols(parts[i]);
  }
  let out = parts.join('');
  out = out.replace(/aria-label="([^"]*)"/g, (_, value) => `aria-label="${replaceLatinMathSymbols(value)}"`);
  return out;
}

const files = fs.readdirSync(worksheetsDir)
  .filter(name => /^page-\d+\.html$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

for (const name of files) {
  const file = path.join(worksheetsDir, name);
  let html = fs.readFileSync(file, 'utf8');
  html = transformHtml(html);

  // Mathematical precision fixes found in the full audit.
  if (name === 'page-17.html') {
    html = html
      .replace('בסיס החרוט הוא  - מעגל', 'בסיס החרוט הוא - עיגול')
      .replace('בסיס החרוט הוא - מעגל', 'בסיס החרוט הוא - עיגול')
      .replace('קטע המחבר נקודה על המעגל אל קודקוד החרוט נקרא- הקו היוצר', 'קטע המחבר נקודה על שפת הבסיס אל קודקוד החרוט נקרא - הקו היוצר');
  }

  if (name === 'page-18.html') {
    html = html
      .replace(/<span class="math-ltr">רדיוס=3, גובה=8<\/span>:\s*הקוטר =/, 'רדיוס הבסיס 3 ס״מ: הקוטר =')
      .replace(/<span class="math-ltr">רדיוס=4, גובה=6<\/span>:\s*הקוטר =/, 'רדיוס הבסיס 4 ס״מ: הקוטר =')
      .replace('והיקף הבסיס בקירוב הוא', 'והיקף הבסיס בקירוב, גם כאן לפי π≈3, הוא');
  }

  if (name === 'page-19.html') {
    html = html
      .replace(/בסיס עגול/g, 'בסיס בצורת עיגול')
      .replace(/החלק העגול/g, 'בסיס החרוט');
  }

  if (name === 'page-31.html') {
    html = html.replace(
      'בהשוואה בין שני דגמים דומים, אחד רחב ונמוך ואחד צר וגבוה, לאיזה מהם בסיס תמיכה רחב יותר ולכן בדרך כלל יציבות טובה יותר?',
      'בהשוואה בין שני דגמים דומים, אחד רחב ונמוך ואחד צר וגבוה, לאיזה מהם בסיס רחב יותר?'
    ).replace('יציבות:', 'השוואת צורה:');
  }

  fs.writeFileSync(file, html, 'utf8');
}

console.log(`Normalized mathematical language in ${files.length} middle-school worksheet pages.`);
