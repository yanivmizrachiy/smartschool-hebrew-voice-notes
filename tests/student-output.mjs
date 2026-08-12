import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const errors = [];

const forbidden = [
  /\bQA\b/i,
  /RULES\.md/i,
  /workbook\.json/i,
  /source-registry/i,
  /\b(?:demo|placeholder|lorem|sample|mock|fake|todo)\b/i,
  /\bAI\b/i,
  /הערת עורך/,
  /הוראה פנימית/,
  /אחוזי התקדמות/
];

for (const page of workbook.pages) {
  const rel = `worksheets/${page.slug}.html`;
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const studentHtml = html.replace(/<nav[\s\S]*?<\/nav>/, '');

  for (const rule of forbidden) {
    if (rule.test(html)) errors.push(`${rel}: forbidden internal/student-irrelevant text matched ${rule}`);
  }

  if (/data-word-bank=/.test(html)) {
    errors.push(`${rel}: blanket page-level word-bank injection is forbidden`);
  }

  if (page.id >= 1 && page.id <= 16 && /עמוד 18|לשאלות מילוליות:\s*היעזרו/.test(studentHtml)) {
    errors.push(`${rel}: project-authored page must not contain blanket support-page instructions`);
  }

  if (page.id === 17 && /מחסן המילים|עמוד 18/.test(studentHtml)) {
    errors.push(`${rel}: locked source page must not contain project word-bank instructions`);
  }
}

if (errors.length) {
  console.error(`Student-output validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`OK: ${workbook.pageCount} student worksheets contain no internal/demo/editorial text or blanket word-bank injection.`);
