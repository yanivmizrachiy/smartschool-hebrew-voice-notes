import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportDir = path.join(root, 'qa', 'math-writing');
fs.mkdirSync(reportDir, { recursive: true });
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));

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
  return Array.from({ length: count }, (_, i) => ({ topic, file: path.join(folder, `page-${i + 1}.html`), locked: false }));
}
const files = [...conePrintFiles(), ...simpleFiles('מעגל', 'circle', 90), ...simpleFiles('גליל', 'cylinder', 38)];
if (files.length !== 174) throw new Error(`Expected 174 A4 pages, got ${files.length}`);

function decodeEntities(text) {
  return text
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&times;|&#215;/gi, '×').replace(/&pi;/gi, 'π')
    .replace(/&sup2;|&#178;/gi, '²').replace(/&sup3;|&#179;/gi, '³').replace(/&minus;|&#8722;/gi, '−')
    .replace(/&approx;|&#8776;/gi, '≈').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
}
function visibleText(html) {
  return decodeEntities(html)
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|tr|section|article|h1|h2|h3|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}
function semanticText(html) {
  const cleaned = html
    .replace(/<span\b[^>]*class="[^"]*(?:choice-pill|choice-item|choice)[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ')
    .replace(/<table\b[\s\S]*?<\/table>/gi, ' ');
  return visibleText(cleaned);
}
function matches(text, regex) {
  const out = []; regex.lastIndex = 0; let m;
  while ((m = regex.exec(text))) { out.push(m[0]); if (!regex.global) break; if (m.index === regex.lastIndex) regex.lastIndex++; }
  return out;
}

const findings = [];
const lockedWarnings = [];
function addFinding(meta, rule, sample, severity = 'error') {
  const item = { topic: meta.topic, file: meta.file.replaceAll('\\', '/'), rule, sample: sample.trim().slice(0, 220), severity };
  if (meta.locked && severity === 'error') lockedWarnings.push({ ...item, severity: 'locked-source-warning' });
  else findings.push(item);
}
function deliberateErrorContext(text) {
  return /(אמת\s*\/\s*שקר|תקין\s*\/\s*לא\s*תקין|תקנו[^\n]{0,30}(?:שגוי|שגיאה)|שגיאה אחת|מצאו[^\n]{0,25}טעות|איתור טעות|טעויות נפוצות)/.test(text);
}

const deliberatePiPages = new Set(['circle/page-24.html', 'cylinder/page-11.html']);
const deliberateDimensionPages = new Set(['circle/page-41.html', 'circle/page-46.html']);
const unitToken = '(?:מ״מ|ס״מ|דצ״מ|ק״מ|מ׳|מ)(?:²|³)?';
const unitRe = new RegExp(`${unitToken}(?=\\s|$|[,.|;:→)])`, 'g');
const assignmentRe = /\b(V|A|B|C|r|d|h|l)([²³]?)\s*=\s*([\s\S]*?)(?=\b(?:V|A|B|C|r|d|h|l)(?:[²³]?)\s*=|[|;\n]|$)/g;

for (const meta of files) {
  const full = path.join(root, meta.file);
  if (!fs.existsSync(full)) { addFinding(meta, 'missing-file', `Missing expected page: ${meta.file}`); continue; }
  const html = fs.readFileSync(full, 'utf8');
  const text = visibleText(html);
  const semantic = semanticText(html);
  const deliberate = deliberateErrorContext(text);
  const rel = meta.file.replaceAll('\\', '/');

  for (const s of matches(text, /×/g)) addFinding(meta, 'multiplication-sign-must-be-middle-dot', s);
  for (const s of matches(text, /(?:\d|[A-Za-zπ])\s*\*\s*(?:\d|[A-Za-zπ(])/g)) addFinding(meta, 'asterisk-multiplication-forbidden', s);
  for (const s of matches(text, /\d\s+[xX]\s+\d/g)) addFinding(meta, 'spaced-x-multiplication-forbidden', s);
  for (const s of matches(text, /\^[23]\b/g)) addFinding(meta, 'use-real-superscript', s);
  for (const s of matches(text, /(?:\d|[A-Za-zπ])\s*-\s*(?:\d|[A-Za-zπ])/g)) addFinding(meta, 'use-mathematical-minus', s);

  for (const s of matches(text, /π\s*=\s*3(?:[.,]14\d*)?/g)) {
    const hasCorrectForm = /π\s*≈\s*3[.,]14/.test(text) || /3[.,]14\s*≈\s*π/.test(text);
    if (!(deliberate && hasCorrectForm && deliberatePiPages.has(rel))) addFinding(meta, 'pi-must-not-equal-decimal', s);
  }
  if (!deliberatePiPages.has(rel)) {
    for (const segment of text.split(/\n|[|;]/)) {
      if (!segment.includes('π') || deliberateErrorContext(segment)) continue;
      const m = segment.match(/π[^=]{0,55}=\s*(\d+[.,]\d+)(?![\dπ])/);
      if (m && !segment.includes('≈')) addFinding(meta, 'pi-decimal-evaluation-needs-approximation', m[0]);
    }
  }
  const sqrtEq = /√\s*(\d+(?:[.,]\d+)?)\s*=\s*(\d+[.,]\d+)/g; let sm;
  while ((sm = sqrtEq.exec(text))) {
    const radicand = Number(sm[1].replace(',', '.'));
    if (Number.isFinite(radicand) && !Number.isInteger(Math.sqrt(radicand))) addFinding(meta, 'irrational-root-needs-approximation', sm[0]);
  }

  for (const s of matches(semantic, /שטח\s+(?:של\s+)?ה?מעגל/g)) addFinding(meta, 'area-is-of-disk-not-circle', s);
  for (const s of matches(semantic, /היקף\s+(?:של\s+)?ה?עיגול/g)) addFinding(meta, 'circumference-is-of-circle', s);

  for (const s of matches(text, /(?:ס|מ|דצ|ק)"מ|מ"ל/g)) addFinding(meta, 'use-hebrew-gershayim-in-units', s);
  for (const s of matches(text, /(?:מ|קמ|דצמ|סמ|ממ)[״"](?:ר|ק)/g)) addFinding(meta, 'use-explicit-squared-or-cubed-unit', s);
  for (const s of matches(text, /(?:מ״מ|ס״מ|דצ״מ|ק״מ|מ׳|מ)[23]\b/g)) addFinding(meta, 'unit-power-must-be-superscript', s);
  for (const s of matches(text, /\b(?:cm|mm|dm|km|m)[23]\b/gi)) addFinding(meta, 'unit-power-must-be-superscript', s);

  if (!deliberateDimensionPages.has(rel)) {
    assignmentRe.lastIndex = 0; let am;
    while ((am = assignmentRe.exec(text))) {
      const variable = am[1], variablePower = am[2], value = am[3];
      const units = matches(value, unitRe);
      if (!units.length) continue;
      const unit = units.at(-1);
      const power = unit.endsWith('²') ? 2 : unit.endsWith('³') ? 3 : 1;
      if (variablePower) continue;
      if (variable === 'V' && power !== 3) addFinding(meta, 'volume-needs-cubic-units', `${variable}=${value}`);
      if ((variable === 'A' || variable === 'B') && power !== 2) addFinding(meta, 'area-needs-squared-units', `${variable}=${value}`);
      if (['C','r','d','h','l'].includes(variable) && power !== 1) addFinding(meta, 'length-variable-needs-linear-units', `${variable}=${value}`);
    }
  }
}

const countsByTopic = Object.fromEntries(['חרוט','מעגל','גליל'].map(topic => [topic, files.filter(f => f.topic === topic).length]));
const report = { generatedAt: new Date().toISOString(), pagesScanned: files.length, countsByTopic, errors: findings, lockedSourceWarnings: lockedWarnings };
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
const lines = ['# Mathematical writing audit','',`Pages scanned: ${files.length} (חרוט ${countsByTopic['חרוט']}, מעגל ${countsByTopic['מעגל']}, גליל ${countsByTopic['גליל']})`,`Errors: ${findings.length}`,`Locked-source warnings: ${lockedWarnings.length}`,''];
for (const item of [...findings, ...lockedWarnings]) lines.push(`- **${item.severity}** \`${item.file}\` — ${item.rule}: ${item.sample.replace(/\n/g, ' ')}`);
fs.writeFileSync(path.join(reportDir, 'report.md'), lines.join('\n') + '\n');
if (lockedWarnings.length) console.warn(`Mathematical writing audit: ${lockedWarnings.length} issue(s) are confined to source-locked material and were not rewritten.`);
if (findings.length) {
  console.error(`Mathematical writing audit: FAIL — ${findings.length} issue(s) across ${files.length} pages.`);
  for (const item of findings.slice(0, 100)) console.error(`${item.file} :: ${item.rule} :: ${item.sample.replace(/\n/g, ' ')}`);
  if (findings.length > 100) console.error(`... ${findings.length - 100} more; see qa/math-writing/report.md`);
  process.exit(1);
}
console.log(`Mathematical writing audit: PASS — ${files.length}/174 pages checked; locked-source warnings: ${lockedWarnings.length}.`);
