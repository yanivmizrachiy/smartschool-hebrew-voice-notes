import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'content/source-registry.json'), 'utf8'));
const errors = [];
const fail = message => errors.push(message);

if (workbook.targetCurriculumVersion !== 'תשפ״ז') fail('workbook target curriculum must be תשפ״ז');
if (registry.rules?.targetCurriculumVersion !== 'תשפ״ז') fail('registry target curriculum must be תשפ״ז');
if (workbook.curriculumCoreVerified !== true) fail('grade 8 cone/cylinder topic must be marked verified');
if (workbook.curriculumCoreGrade !== 'ח') fail('verified cone core grade must be ח');

const grade8 = registry.sources?.['moe-jhs-5787-grade8-plan'];
if (!grade8) fail('missing moe-jhs-5787-grade8-plan source');
else {
  if (grade8.type !== 'official') fail('grade 8 curriculum source must be official');
  if (grade8.curriculumVersion !== 'תשפ״ז' || grade8.curriculumVersionVerified !== true) fail('grade 8 curriculum source must explicitly verify תשפ״ז');
  if (!(grade8.gradeScope || []).includes('ח')) fail('grade 8 curriculum source must include grade ח');
  if (grade8.verifiedTopic !== 'גליל וחרוט') fail('grade 8 curriculum source must record גליל וחרוט');
}

for (const [id, source] of Object.entries(registry.sources || {})) {
  const grades = new Set(source.gradeScope || []);
  const elementaryOnly = source.schoolStage === 'יסודי' || ([...grades].length > 0 && [...grades].every(g => ['ה', 'ו'].includes(g)));
  if (elementaryOnly && source.curriculumRole !== 'reference-only-for-junior-high') {
    fail(`${id}: elementary source must remain reference-only-for-junior-high`);
  }
}

for (const page of workbook.pages) {
  const file = path.join(root, 'worksheets', `${page.slug}.html`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');

  const officialLabels = (html.match(/מתוך תוכנית הלימודים/g) || []).length;
  const sourceIds = [...html.matchAll(/data-source="([^"]+)"/g)].map(match => match[1]);
  if (officialLabels !== sourceIds.length) {
    fail(`${page.slug}: every 'מתוך תוכנית הלימודים' label must have exactly one data-source`);
  }

  for (const sourceId of sourceIds) {
    const source = registry.sources?.[sourceId];
    if (!source) {
      fail(`${page.slug}: unknown official question source ${sourceId}`);
      continue;
    }
    if (source.type !== 'official' || source.sourceVerified !== true || source.questionExtracted !== true) {
      fail(`${page.slug}: ${sourceId} cannot support 'מתוך תוכנית הלימודים' without an extracted verified official question`);
    }
    if (source.curriculumVersion !== 'תשפ״ז' || source.curriculumVersionVerified !== true) {
      fail(`${page.slug}: official question source ${sourceId} must explicitly match תשפ״ז`);
    }
    if (!(source.gradeScope || []).includes('ח') && !(source.gradeScope || []).includes('ז')) {
      fail(`${page.slug}: official question source ${sourceId} must match target junior-high grades`);
    }
  }

  if (page.id === 17 && /מתוך תוכנית הלימודים|בהתאם לתוכנית הלימודים/.test(html)) {
    fail('page-17 is source-locked user material and must not receive project curriculum labels');
  }
}

if (errors.length) {
  console.error(`Curriculum scope validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: grade 8 cone/cylinder topic is verified for תשפ״ז; official-question provenance remains separately locked.');
