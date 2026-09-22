import fs from 'node:fs';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const css = fs.readFileSync('worksheets/textbook-layout.css', 'utf8');
check(!/:has\(\.page-number\[aria-label=/i.test(css), 'textbook-layout.css must not key layout behavior to a visible page number');

const expectedProfiles = new Map([
  ['worksheets/page-7.html', 'layout-draw-room'],
  ['worksheets/page-13.html', 'layout-reasoning-room'],
  ['worksheets/page-15.html', 'layout-table-room']
]);

for (const [file, profile] of expectedProfiles) {
  const html = fs.readFileSync(file, 'utf8');
  check(new RegExp(`class="[^"]*\\b${profile}\\b`).test(html), `${file} must carry stable layout profile ${profile}`);
}

const page23 = fs.readFileSync('worksheets/page-23.html', 'utf8');
check(/class="[^"]*\btextbook-fill\b/.test(page23), 'worksheets/page-23.html must retain the A4 workspace utilization profile');

if (failures.length) {
  console.error(`Layout profile contract failed with ${failures.length} issue(s):`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('OK: worksheet layout behavior is keyed by stable source profiles, and page 23 retains purposeful A4 workspace.');
