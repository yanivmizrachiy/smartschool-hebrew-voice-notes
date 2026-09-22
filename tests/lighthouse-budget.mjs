import fs from 'node:fs';
import path from 'node:path';

const cases = [
  {
    name: 'home',
    file: path.join('qa', 'modern-browser', 'lighthouse-home.json'),
    minimum: { performance: 0.85, accessibility: 0.95, 'best-practices': 0.90, seo: 0.90 }
  },
  {
    name: 'viewer-cone',
    file: path.join('qa', 'modern-browser', 'lighthouse-viewer-cone.json'),
    minimum: { performance: 0.70, accessibility: 0.90, 'best-practices': 0.90, seo: 0.90 }
  }
];

const failures = [];
const summary = {};

for (const item of cases) {
  if (!fs.existsSync(item.file)) {
    failures.push(`${item.name}: missing Lighthouse report ${item.file}`);
    continue;
  }
  const report = JSON.parse(fs.readFileSync(item.file, 'utf8'));
  summary[item.name] = {};
  for (const [category, minimum] of Object.entries(item.minimum)) {
    const score = report.categories?.[category]?.score;
    summary[item.name][category] = score;
    if (typeof score !== 'number' || score < minimum) {
      failures.push(`${item.name}: ${category} score ${score ?? 'missing'} < ${minimum}`);
    }
  }
}

fs.writeFileSync(path.join('qa', 'modern-browser', 'lighthouse-budget.json'), `${JSON.stringify({ summary, failures }, null, 2)}\n`, 'utf8');

if (failures.length) {
  console.error(`Lighthouse budget failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lighthouse budget: PASS ${JSON.stringify(summary)}`);
