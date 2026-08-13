import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const worksheetsDir = path.join(root, 'worksheets');
const files = fs.readdirSync(worksheetsDir)
  .filter(name => /^page-\d+\.html$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

function plainText(fragment) {
  return fragment
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const errors = [];
const latinVariable = /(^|[\s(,.;:])(?:r|h|l|V|A|d|b)(?=$|[\s),.;:=²³/+\-])/g;
const awkward = [
  'רדיוס רדיוס',
  'גובה גובה',
  'יוצר יוצר',
  'נפח נפח',
  'שטח שטח',
  'שרדיוסו רדיוס',
  'גובה (גובה)',
  'רדיוס (רדיוס)',
  'יוצר (יוצר)',
  'היטל ניצב',
  'משפט פיתגורס במישור ובמרחב'
];

for (const name of files) {
  const html = fs.readFileSync(path.join(worksheetsDir, name), 'utf8');
  const text = plainText(html);
  const matches = [...text.matchAll(latinVariable)].map(m => m[0].trim()).filter(Boolean);
  if (matches.length) errors.push(`${name}: contains high-school-style Latin variable(s): ${[...new Set(matches)].join(', ')}`);

  const ariaText = [...html.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]).join(' | ');
  const ariaMatches = [...ariaText.matchAll(latinVariable)].map(m => m[0].trim()).filter(Boolean);
  if (ariaMatches.length) errors.push(`${name}: aria-label contains Latin math variable(s): ${[...new Set(ariaMatches)].join(', ')}`);

  // Check awkward wording inside one semantic text component. This catches a real
  // phrase such as "רדיוס רדיוס" in one heading/paragraph, but does not falsely
  // join adjacent table cells such as "רדיוס" | "רדיוס הבסיס".
  const components = [...html.matchAll(/<(th|p|h1|h2|h3|li|span)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(m => plainText(m[2]))
    .filter(Boolean);
  components.push(...[...html.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]));

  for (const phrase of awkward) {
    if (components.some(component => component.includes(phrase))) {
      errors.push(`${name}: age-inappropriate or awkward phrase: ${phrase}`);
    }
  }
}

if (errors.length) {
  console.error(`Middle-school language check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: ${files.length} worksheets use Hebrew elementary/middle-school math language without Latin variable notation or projection jargon.`);
