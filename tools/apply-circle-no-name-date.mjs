import fs from 'node:fs';

const changed = [];
for (let page = 1; page <= 88; page += 1) {
  const file = `circle/page-${page}.html`;
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  // Remove the student name/date row entirely, not merely visually.
  text = text.replace(/\n?\s*<(?:footer|div)\s+class=["']footer["'][^>]*>[\s\S]*?<\/(?:footer|div)>\s*/gi, '\n');
  text = text.replace(/\n?\s*<div\s+class=["'][^"']*(?:student-meta|name-date|identity-fields)[^"']*["'][^>]*>[\s\S]*?<\/div>\s*/gi, '\n');

  if (/שם\s*(?:התלמיד)?\s*[:：]|תאריך\s*[:：]/u.test(text)) {
    throw new Error(`${file}: name/date student field still remains after cleanup`);
  }

  if (text !== before) {
    fs.writeFileSync(file, text);
    changed.push(file);
  }
}

if (changed.length !== 88) {
  throw new Error(`Expected name/date cleanup in all 88 circle pages; changed ${changed.length}`);
}

// Reclaim vertical space formerly reserved for the removed name/date row.
{
  const file = 'circle/styles.css';
  let css = fs.readFileSync(file, 'utf8');
  if (!css.includes('padding:10mm 18mm 27mm')) throw new Error('circle A4 padding baseline not found');
  css = css.replace('padding:10mm 18mm 27mm', 'padding:10mm 18mm 18mm');
  css = css.replace(/\.footer\{[^}]*\}/g, '');
  fs.writeFileSync(file, css);
}

// Lock the no-name/no-date rule permanently in Circle QA.
{
  const file = 'circle/qa.mjs';
  let qa = fs.readFileSync(file, 'utf8');
  const anchor = "    assert(!/answers\\.json/i.test(html), `${file}: answer-key reference forbidden`);";
  if (!qa.includes(anchor)) throw new Error('circle QA anchor not found');
  const addition = `${anchor}\n    assert(!/<(?:footer|div)\\s+class=[\"']footer[\"']/i.test(html), \`${'${file}'}: student footer is forbidden\`);\n    assert(!/שם\\s*(?:התלמיד)?\\s*[:：]|תאריך\\s*[:：]/u.test(html), \`${'${file}'}: student name/date fields are forbidden\`);`;
  qa = qa.replace(anchor, addition);
  fs.writeFileSync(file, qa);
}

console.log(`Removed name/date fields from ${changed.length}/88 circle pages and reclaimed bottom A4 space.`);
