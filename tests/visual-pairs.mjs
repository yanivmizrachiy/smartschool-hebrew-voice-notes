import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const visualPages = workbook.visualPages || [];
const bySlug = new Map(visualPages.map(page => [page.slug, page]));
const sequenceVisuals = new Set((workbook.printSequence || []).filter(item => item.kind === 'visual').map(item => item.slug));
const errors = [];
const fail = message => errors.push(message);

for (const page of visualPages) {
  const rel = `visual-pages/${page.slug}.html`;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`${rel}: missing`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  if (/שעשועון/.test(html)) fail(`${rel}: student-facing visual pages must use only the natural question/title; שעשועון is forbidden`);

  if (page.type !== 'puzzle-question') continue;
  if (!page.answerSlug) {
    fail(`${page.slug}: missing answerSlug`);
    continue;
  }

  const answer = bySlug.get(page.answerSlug);
  if (!answer) {
    fail(`${page.slug}: answer page ${page.answerSlug} missing`);
    continue;
  }

  if (answer.type !== 'puzzle-answer') fail(`${page.slug}: ${page.answerSlug} must be puzzle-answer`);
  if (answer.questionSlug !== page.slug) fail(`${page.slug}: answer must point back to questionSlug=${page.slug}`);
  if (answer.sceneAsset !== page.sceneAsset) fail(`${page.slug}: question and answer MUST use the exact same sceneAsset`);
  if (answer.verifiedConeCount !== page.verifiedConeCount) fail(`${page.slug}: question and answer cone counts differ`);
  if (!sequenceVisuals.has(page.slug)) fail(`${page.slug}: question page missing from printSequence`);
  if (!sequenceVisuals.has(page.answerSlug)) fail(`${page.slug}: answer page ${page.answerSlug} missing from printSequence`);

  const expectedSrc = `../${page.sceneAsset}`;
  if (!html.includes(expectedSrc)) fail(`${page.slug}: question HTML does not render declared sceneAsset ${page.sceneAsset}`);
  const answerPath = path.join(root, 'visual-pages', `${answer.slug}.html`);
  const answerHtml = fs.existsSync(answerPath) ? fs.readFileSync(answerPath, 'utf8') : '';
  if (!answerHtml.includes(expectedSrc)) fail(`${answer.slug}: answer HTML does not render the SAME sceneAsset ${page.sceneAsset}`);
}

if (errors.length) {
  console.error(`Visual-pair validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const pairs = visualPages.filter(page => page.type === 'puzzle-question').length;
console.log(`OK: ${pairs} visual question/answer pairs use identical scene assets, both question and answer pages are printed, and student-facing titles contain no שעשועון.`);
