import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'content/source-registry.json'), 'utf8'));
const errors = [];
const fail = message => errors.push(message);

const expectedGrades = ['ז', 'ח'];
if (JSON.stringify(workbook.targetGrades) !== JSON.stringify(expectedGrades)) {
  fail(`workbook.targetGrades must be ${JSON.stringify(expectedGrades)}`);
}
if (workbook.targetCurriculumVersion !== 'תשפ״ז') {
  fail(`workbook.targetCurriculumVersion must be תשפ״ז`);
}
if (registry.rules?.targetCurriculumVersion !== workbook.targetCurriculumVersion) {
  fail('source registry curriculum version must match workbook');
}
if (JSON.stringify(registry.rules?.targetGrades) !== JSON.stringify(workbook.targetGrades)) {
  fail('source registry target grades must match workbook');
}

for (const [id, source] of Object.entries(registry.sources || {})) {
  const grades = new Set(source.gradeScope || []);
  const isElementaryOnly = source.schoolStage === 'יסודי' || ([...grades].length > 0 && [...grades].every(g => ['ה', 'ו'].includes(g)));
  if (isElementaryOnly && source.curriculumRole !== 'reference-only-for-junior-high') {
    fail(`${id}: elementary source must be reference-only-for-junior-high`);
  }
}

for (const page of workbook.pages) {
  if (workbook.curriculumCoreVerified === false && page.curriculumCoreStatus === 'verified-core') {
    fail(`${page.slug}: cannot be verified-core while workbook curriculumCoreVerified=false`);
  }

  const file = path.join(root, 'worksheets', `${page.slug}.html`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');

  if (workbook.curriculumCoreVerified === false && html.includes('בהתאם לתוכנית הלימודים')) {
    fail(`${page.slug}: curriculum-aligned label is forbidden until grade 7-8 5787 cone alignment is explicitly verified`);
  }

  const curriculumLabels = (html.match(/מתוך תוכנית הלימודים/g) || []).length;
  const sourceIds = [...html.matchAll(/data-source="([^"]+)"/g)].map(match => match[1]);
  if (curriculumLabels !== sourceIds.length) {
    fail(`${page.slug}: every curriculum label must have exactly one data-source`);
  }

  for (const sourceId of sourceIds) {
    const source = registry.sources?.[sourceId];
    if (!source) {
      fail(`${page.slug}: unknown curriculum source ${sourceId}`);
      continue;
    }
    const sourceGrades = new Set(source.gradeScope || []);
    const gradeMatches = workbook.targetGrades.some(grade => sourceGrades.has(grade));
    if (!gradeMatches) fail(`${page.slug}: source ${sourceId} does not match target grades ז-ח`);
    if (source.curriculumVersion !== workbook.targetCurriculumVersion) {
      fail(`${page.slug}: source ${sourceId} does not explicitly match curriculum version תשפ״ז`);
    }
    if (source.curriculumRole === 'reference-only-for-junior-high') {
      fail(`${page.slug}: source ${sourceId} is reference-only and cannot validate a junior-high curriculum label`);
    }
    if (source.type !== 'official' || source.sourceVerified !== true || source.questionExtracted !== true) {
      fail(`${page.slug}: source ${sourceId} is not an extracted, verified official question`);
    }
  }
}

if (errors.length) {
  console.error(`Curriculum scope validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: curriculum scope is locked to grades ז-ח, תשפ״ז; elementary cone sources cannot validate junior-high core labels.`);
