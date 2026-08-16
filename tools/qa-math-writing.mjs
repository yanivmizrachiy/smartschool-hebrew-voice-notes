import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportDir = path.join(root, 'qa', 'math-writing');
fs.mkdirSync(reportDir, { recursive: true });

const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content', 'workbook.json'), 'utf8'));

function conePrintFiles() {
  const pages = new Map((workbook.pages || []).map(p => [p.id, p]));
  const visuals = new Map((workbook.visualPages || []).map(p => [p.slug, p]));
  const sequence = workbook.printSequence || (workbook.pages || []).map(p => ({ kind: 'worksheet', id: p.id }));
  return sequence.map(entry => {
    if (entry.kind === 'worksheet') {
      const page = pages.get(entry.id);
      if (!page) throw new Error(`Cone print sequence references missing worksheet ${entry.id}`);
      return { topic: 'חרוט', file: path.join('worksheets', `${page.slug}.html`), locked: page.contentLocked === true };
    }
    if (entry.kind === 'visual') {
      const page = visuals.get(entry.slug);
      if (!page) throw new Error(`Cone print sequence references missing visual ${entry.slug}`);
      return { topic: 'חרוט', file: path.join('visual-pages', `${page.slug}.html`), locked: false };
    }
    throw new Error(`Unknown cone print entry kind: ${entry.kind}`);
  });
}

function simpleFiles(topic, folder, count) {
  return Array.from({ length: count }, (_, i) => ({
    topic,
    file: path.join(folder, `page-${i + 1}.html`),
    locked: false
  }));
}

const files = [
  ...conePrintFiles(),
  ...simpleFiles('מעגל', 'circle', 88),
  ...simpleFiles('גליל', 'cylinder', 38)
];

if (files.length !== 172) throw new Error(`Expected 172 A4 pages, got ${files.length}`);

function decodeEntities(text) {
  return text
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&times;|&#215;/gi, '×')
    .replace(/&pi;/gi, 'π')
    .replace(/&sup2;|&#178;/gi, '²')
    .replace(/&sup3;|&#179;/gi, '³')
    .replace(/&minus;|&#8722;/gi, '−')
    .replace(/&approx;|&#8776;/gi, '≈')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function visibleText(html) {
  return decodeEntities(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|section|article|h1|h2|h3|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

const findings = [];
const lockedWarnings = [];
function addFinding(meta, rule, sample, severity = 'error') {
  const item = { topic: meta.topic, file: meta.file.replaceAll('\\', '/'), rule, sample: sample.trim().slice(0, 220), severity };
  if (meta.locked && severity === 'error') {
    lockedWarnings.push({ ...item, severity: 'locked-source-warning' });
  } else {
    findings.push(item);
  }
}

function matches(text, regex) {
  const out = [];
  regex.lastIndex = 0;
  let m;
  while ((m = regex.exec(text))) {
    out.push(m[0]);
    if (!regex.global) break;
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }
  return out;
}

const canonicalUnit = '(?:מ״מ|ס״מ|דצ״מ|מ|ק״מ)';
const squaredUnit = '(?:מ״מ²|ס״מ²|דצ״מ²|מ²|ק״מ²)';
const cubedUnit = '(?:מ״מ³|ס״מ³|דצ״מ³|מ³|ק״מ³)';

for (const meta of files) {
  const full = path.join(root, meta.file);
  if (!fs.existsSync(full)) {
    addFinding(meta, 'missing-file', `Missing expected page: ${meta.file}`);
    continue;
  }
  const html = fs.readFileSync(full, 'utf8');
  const text = visibleText(html);

  // Core notation rules.
  for (const s of matches(text, /π\s*=\s*3(?:[.,]14\d*)?/g)) {
    const deliberateCylinderDistractor = meta.file.replaceAll('\\', '/') === 'cylinder/page-11.html' && /לא תקין/.test(text) && /π\s*≈\s*3[.,]14/.test(text);
    if (!deliberateCylinderDistractor) addFinding(meta, 'pi-must-not-equal-decimal', s);
  }
  for (const s of matches(text, /×/g)) addFinding(meta, 'multiplication-sign-must-be-middle-dot', s);
  for (const s of matches(text, /(?:\d|[πrhdlabcvABCVMRl])\s*[xX*]\s*(?:\d|[πrhdlabcvABCVMRl(])/g)) addFinding(meta, 'ascii-multiplication-forbidden', s);
  for (const s of matches(text, /\^[23]\b/g)) addFinding(meta, 'use-real-superscript', s);
  for (const s of matches(text, /(?:=|<|>|≤|≥|\(|,)\s*-\s*\d/g)) addFinding(meta, 'use-mathematical-minus', s);

  // If π has been numerically evaluated, equality must become approximation.
  for (const s of matches(text, /π[^\n]{0,100}=\s*\d+(?:[.,]\d+)?(?!\s*π)/g)) {
    if (!/π\s*=\s*3(?:[.,]14\d*)?/.test(s)) addFinding(meta, 'pi-decimal-evaluation-needs-approximation', s);
  }

  // Irrational square roots may not be equated to rounded decimals.
  const sqrtEq = /√\s*(\d+(?:[.,]\d+)?)\s*=\s*(\d+[.,]\d+)/g;
  let sm;
  while ((sm = sqrtEq.exec(text))) {
    const radicand = Number(sm[1].replace(',', '.'));
    if (Number.isFinite(radicand) && Math.sqrt(radicand) % 1 !== 0) addFinding(meta, 'irrational-root-needs-approximation', sm[0]);
  }

  // Hebrew mathematical terminology locked by the project.
  for (const s of matches(text, /שטח\s+(?:של\s+)?ה?מעגל/g)) addFinding(meta, 'area-is-of-disk-not-circle', s);
  for (const s of matches(text, /היקף\s+(?:של\s+)?ה?עיגול/g)) addFinding(meta, 'circumference-is-of-circle', s);
  for (const s of matches(text, /בסיס(?:י|י\s+ה)?\s+ה?(?:חרוט|גליל)?[^\n]{0,35}\bמעגל\b/g)) {
    if (!/היקף\s+מעגל/.test(s)) addFinding(meta, 'solid-base-is-disk-not-circle', s);
  }

  // Unit typography and unambiguous powers.
  for (const s of matches(text, /(?:ס|מ|דצ|ק)"מ|מ"ל/g)) addFinding(meta, 'use-hebrew-gershayim-in-units', s);
  for (const s of matches(text, /(?:סמ|ממ|דמ)[״"]ר|(?:סמ|ממ|דמ)[״"]ק/g)) addFinding(meta, 'use-explicit-squared-or-cubed-unit', s);
  for (const s of matches(text, /(?:מ״מ|ס״מ|דצ״מ|ק״מ)[23]\b/g)) addFinding(meta, 'unit-power-must-be-superscript', s);
  for (const s of matches(text, /\b(?:cm|mm|dm|km)[23]\b/gi)) addFinding(meta, 'unit-power-must-be-superscript', s);

  // Dimension consistency when a named variable is explicitly assigned a unit.
  for (const s of matches(text, new RegExp(`\\bV\\s*=.{0,70}\\s${canonicalUnit}(?![²³])`, 'g'))) addFinding(meta, 'volume-needs-cubic-units', s);
  for (const s of matches(text, new RegExp(`\\bV\\s*=.{0,70}\\s${squaredUnit}`, 'g'))) addFinding(meta, 'volume-needs-cubic-units', s);
  for (const s of matches(text, new RegExp(`\\b(?:A|B)\\s*=.{0,70}\\s${canonicalUnit}(?![²³])`, 'g'))) addFinding(meta, 'area-needs-squared-units', s);
  for (const s of matches(text, new RegExp(`\\b(?:A|B)\\s*=.{0,70}\\s${cubedUnit}`, 'g'))) addFinding(meta, 'area-needs-squared-units', s);
  for (const s of matches(text, new RegExp(`\\b(?:C|r|d|h|l)\\s*=.{0,55}\\s(?:${squaredUnit}|${cubedUnit})`, 'g'))) addFinding(meta, 'length-variable-needs-linear-units', s);

  // Common plain-language dimension errors around explicit numeric answers.
  for (const s of matches(text, new RegExp(`(?:נפח|קיבול)[^\\n=]{0,45}=\\s*[^\\n]{0,55}\\s${canonicalUnit}(?![²³])`, 'g'))) addFinding(meta, 'volume-answer-needs-cubic-units', s);
  for (const s of matches(text, new RegExp(`(?:שטח|שטח\\s+הבסיס)[^\\n=]{0,45}=\\s*[^\\n]{0,55}\\s${canonicalUnit}(?![²³])`, 'g'))) addFinding(meta, 'area-answer-needs-squared-units', s);
  for (const s of matches(text, new RegExp(`(?:היקף|רדיוס|קוטר|גובה|יוצר)[^\\n=]{0,45}=\\s*[^\\n]{0,55}\\s(?:${squaredUnit}|${cubedUnit})`, 'g'))) addFinding(meta, 'length-answer-needs-linear-units', s);
}

const countsByTopic = Object.fromEntries(['חרוט', 'מעגל', 'גליל'].map(topic => [topic, files.filter(f => f.topic === topic).length]));
const report = {
  generatedAt: new Date().toISOString(),
  pagesScanned: files.length,
  countsByTopic,
  errors: findings,
  lockedSourceWarnings: lockedWarnings
};
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));

const lines = [
  '# Mathematical writing audit',
  '',
  `Pages scanned: ${files.length} (חרוט ${countsByTopic['חרוט']}, מעגל ${countsByTopic['מעגל']}, גליל ${countsByTopic['גליל']})`,
  `Errors: ${findings.length}`,
  `Locked-source warnings: ${lockedWarnings.length}`,
  ''
];
for (const item of [...findings, ...lockedWarnings]) {
  lines.push(`- **${item.severity}** \`${item.file}\` — ${item.rule}: ${item.sample.replace(/\n/g, ' ')}`);
}
fs.writeFileSync(path.join(reportDir, 'report.md'), lines.join('\n') + '\n');

if (lockedWarnings.length) {
  console.warn(`Mathematical writing audit: ${lockedWarnings.length} issue(s) found only in source-locked material; they are reported but not rewritten.`);
}
if (findings.length) {
  console.error(`Mathematical writing audit: FAIL — ${findings.length} issue(s) across ${files.length} pages.`);
  for (const item of findings.slice(0, 80)) console.error(`${item.file} :: ${item.rule} :: ${item.sample.replace(/\n/g, ' ')}`);
  if (findings.length > 80) console.error(`... ${findings.length - 80} more; see qa/math-writing/report.md`);
  process.exit(1);
}

console.log(`Mathematical writing audit: PASS — ${files.length}/172 pages checked; locked-source warnings: ${lockedWarnings.length}.`);
