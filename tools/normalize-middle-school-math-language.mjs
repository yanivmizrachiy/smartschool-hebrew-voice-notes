import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const worksheetsDir = path.join(root, 'worksheets');

function replaceLatinMathSymbols(text) {
  let out = text;
  const replacements = [
    ['V', 'נפח'], ['A', 'שטח'], ['r', 'רדיוס'], ['h', 'גובה'], ['l', 'יוצר'], ['d', 'קוטר'], ['b', 'בסיס']
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
    .replace(/רדיוס\s*=\s*(\d+(?:\.\d+)?)/g, 'רדיוס $1')
    .replace(/גובה\s*=\s*(\d+(?:\.\d+)?)/g, 'גובה $1')
    .replace(/יוצר\s*=\s*(\d+(?:\.\d+)?)/g, 'יוצר $1')
    .replace(/קוטר\s*=\s*(\d+(?:\.\d+)?)/g, 'קוטר $1')
    .replace(/π\s*רדיוס/g, 'π × רדיוס')
    .replace(/רדיוס²\s*גובה/g, 'רדיוס² × גובה')
    .replace(/2\s*רדיוס/g, '2 × רדיוס')
    .replace(/1\/3/g, '⅓');

  for (const word of ['רדיוס', 'גובה', 'יוצר', 'נפח', 'שטח', 'קוטר', 'בסיס']) {
    out = out
      .replace(new RegExp(`${word}\\s+${word}`, 'g'), word)
      .replace(new RegExp(`${word}\\s*\\(\\s*${word}\\s*\\)`, 'g'), word);
  }

  return out
    .replace(/בסיס עגול/g, 'בסיס בצורת עיגול')
    .replace(/החלק העגול/g, 'בסיס החרוט')
    .replace(/היטל ניצב מלמעלה/g, 'מבט מלמעלה')
    .replace(/היטל ניצב מן הצד/g, 'מבט מהצד')
    .replace(/ההיטל מלמעלה/g, 'המבט מלמעלה');
}

function transformHtml(html) {
  const parts = html.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i += 1) {
    if (!parts[i].startsWith('<')) parts[i] = replaceLatinMathSymbols(parts[i]);
  }
  let out = parts.join('');
  return out.replace(/aria-label="([^"]*)"/g, (_, value) => `aria-label="${replaceLatinMathSymbols(value)}"`);
}

const files = fs.readdirSync(worksheetsDir)
  .filter(name => /^page-\d+\.html$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

for (const name of files) {
  const file = path.join(worksheetsDir, name);
  let html = transformHtml(fs.readFileSync(file, 'utf8'));

  if (name === 'page-17.html') {
    html = html
      .replace('בסיס החרוט הוא  - מעגל', 'בסיס החרוט הוא - עיגול')
      .replace('בסיס החרוט הוא - מעגל', 'בסיס החרוט הוא - עיגול')
      .replace('קטע המחבר נקודה על המעגל אל קודקוד החרוט נקרא- הקו היוצר', 'קטע המחבר נקודה על שפת הבסיס אל קודקוד החרוט נקרא - הקו היוצר');
  }

  if (name === 'page-18.html') {
    html = html
      .replace('משפט פיתגורס במישור ובמרחב — כיתה ח׳', 'משפט פיתגורס במשולש ישר־זווית — כיתה ח׳')
      .replace(/<span class="term">2π × רדיוס<\/span>/, '<span class="term">היקף = 2 × π × רדיוס</span>')
      .replace(/<span class="term">π × רדיוס²<\/span>/, '<span class="term">שטח = π × רדיוס²</span>')
      .replace(/היקף מעגל שרדיוסו <span class="math-ltr">רדיוס<\/span>:/, 'היקף מעגל:')
      .replace(/<span class="math-ltr">רדיוס 3, גובה 8<\/span>:\s*הקוטר =/, 'רדיוס הבסיס 3 ס״מ: הקוטר =')
      .replace(/<span class="math-ltr">רדיוס 4, גובה 6<\/span>:\s*הקוטר =/, 'רדיוס הבסיס 4 ס״מ: הקוטר =')
      .replace('והיקף הבסיס בקירוב הוא', 'והיקף הבסיס בקירוב, גם כאן לפי π≈3, הוא');
  }

  if (name === 'page-20.html') {
    html = html
      .replace('קוראים סימונים ומבחינים בין המידות', 'מכירים שלוש מידות חשובות בחרוט ישר')
      .replace('aria-label="חרוט ישר ובו מסומנים רדיוס רדיוס, גובה גובה ויוצר יוצר"', 'aria-label="חרוט ישר ובו מסומנים רדיוס, גובה ויוצר"')
      .replace('<tr><th>סימון</th><th>מה הוא מודד?</th></tr>', '<tr><th>המידה</th><th>מה היא מתארת?</th></tr>')
      .replace('מה קורה ל־<span class="math-ltr">רדיוס, גובה ויוצר</span>?', 'מה קורה למשמעות של הרדיוס, הגובה והיוצר?')
      .replace('בחרוט ישר נתון <span class="math-ltr">רדיוס 6</span> ס״מ, <span class="math-ltr">גובה 8</span> ס״מ, <span class="math-ltr">יוצר 10</span> ס״מ. כתבו ליד כל נתון את שמו: רדיוס / גובה / יוצר.', 'בחרוט ישר נתונים: רדיוס 6 ס״מ, גובה 8 ס״מ ויוצר 10 ס״מ. כתבו במילים מה מתאר כל אחד משלושת הנתונים.');
  }

  if (name === 'page-21.html') {
    html = html
      .replace('מבינים כל סימון לפני שמחשבים', 'מבינים את מרכיבי נוסחת הנפח לפני שמחשבים')
      .replace('<tr><th>סימון</th><th>משמעות</th></tr>', '<tr><th>הגודל</th><th>משמעות</th></tr>')
      .replace('איזה מספר צריך להציב במקום <span class="math-ltr">רדיוס</span>?', 'איזה מספר הוא רדיוס הבסיס ולכן צריך להציב בנוסחה?');
  }

  if (name === 'page-31.html') {
    html = html
      .replace('בהשוואה בין שני דגמים דומים, אחד רחב ונמוך ואחד צר וגבוה, לאיזה מהם בסיס תמיכה רחב יותר ולכן בדרך כלל יציבות טובה יותר?', 'בהשוואה בין שני דגמים דומים, אחד רחב ונמוך ואחד צר וגבוה, לאיזה מהם בסיס רחב יותר?')
      .replace('יציבות:', 'השוואת צורה:');
  }

  if (name === 'page-33.html') {
    html = html.replace(/גובה הגביע\s*\(\s*גובה\s*\)/g, 'גובה הגביע');
  }

  if (name === 'page-38.html') {
    html = html.replace('כיפת אור חרוטית', 'אלומת אור חרוטית');
  }

  fs.writeFileSync(file, html, 'utf8');
}

console.log(`Normalized mathematical language in ${files.length} middle-school worksheet pages.`);
