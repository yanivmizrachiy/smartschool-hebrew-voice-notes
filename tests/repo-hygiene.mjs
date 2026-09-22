import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const fail = message => errors.push(message);
const rel = p => path.relative(root, p).replaceAll('\\', '/');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const allFiles = walk(root).filter(file => !rel(file).startsWith('.git/'));
const allRel = allFiles.map(rel);

for (const file of allRel) {
  if (file.startsWith('.asset-staging/')) fail(`${file}: temporary asset staging must never be committed`);
  if (file.endsWith('.b64')) fail(`${file}: base64 staging file must never be committed`);
  if (/DO-NOT-MERGE/i.test(file)) fail(`${file}: merge-blocker sentinel belongs in an issue/PR, not in source control`);
  if (/^tools\/apply-.*\.(?:py|mjs|js)$/i.test(file)) fail(`${file}: one-time transformation script must be removed after use`);
}

const rulesPath = path.join(root, 'RULES.md');
if (!fs.existsSync(rulesPath) || fs.statSync(rulesPath).size === 0) {
  fail('RULES.md: the sole project source of truth is missing or empty');
} else {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  if (!rules.includes('מקור האמת היחיד')) fail('RULES.md: must explicitly declare itself the sole source of truth');
  if (!rules.includes('מעגל, גליל וחרוט')) fail('RULES.md: must explicitly cover circle, cylinder and cone');
  if (!rules.includes('האתר המשותף — Home')) fail('RULES.md: shared-home requirements must live in the sole project authority');
  if (!rules.includes('Viewer משותף') || !rules.includes('Viewer בנייד')) fail('RULES.md: viewer/mobile requirements must live in the sole project authority');
}

// No parallel requirements authority may exist by filename or by a true self-declaration.
// Subordinate docs are allowed (and encouraged) to say that root RULES.md is authoritative.
const textExtensions = new Set(['.md', '.txt', '.mjs', '.js', '.ts', '.json', '.yml', '.yaml', '.html', '.css']);
for (const file of allRel) {
  if (file === 'RULES.md') continue;
  const base = path.basename(file);
  const lowerBase = base.toLowerCase();

  if (lowerBase === 'rules.md') fail(`${file}: duplicate RULES.md is forbidden; root RULES.md is the only requirements authority`);
  if (/^(?:source[-_ ]?of[-_ ]?truth|project[-_ ]?rules)(?:\.[^/]*)?$/i.test(base)) {
    fail(`${file}: parallel requirements/source-of-truth file is forbidden; use root RULES.md only`);
  }
  if (/_rules\.md$/i.test(base)) {
    fail(`${file}: *_RULES.md is forbidden because project requirements belong only in root RULES.md`);
  }

  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  let text;
  try { text = fs.readFileSync(path.join(root, file), 'utf8'); }
  catch { continue; }

  const selfAuthority = [
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:מסמך|קובץ)\s+זה\s+(?:הוא\s+)?(?:\*\*)?(?:מקור\s+האמת|מקור\s+אמת)/im,
    /(?:^|\n)\s*(?:#{1,6}\s*)?this\s+(?:document|file)\s+(?:is\s+)?(?:the\s+)?(?:sole\s+)?source\s+of\s+truth/im
  ].some(re => re.test(text));

  if (selfAuthority) {
    fail(`${file}: self-declared requirements authority is forbidden; only root RULES.md may be the source of truth`);
  }
}

const workflowDir = path.join(root, '.github', 'workflows');
const allowedWorkflows = new Set(['workbook-quality.yml', 'textbook-layout-render.yml', 'codeql.yml', 'modern-browser-qa.yml']);
if (!fs.existsSync(workflowDir)) {
  fail('.github/workflows: missing CI workflows');
} else {
  for (const name of fs.readdirSync(workflowDir)) {
    if (!allowedWorkflows.has(name)) fail(`.github/workflows/${name}: temporary or undocumented workflow is not allowed`);
    const text = fs.readFileSync(path.join(workflowDir, name), 'utf8');
    if (/audit\/textbook-layout-46-pages-20260813|final-visual-assets|apply-staged|verify-final-assets/i.test(text)) {
      fail(`.github/workflows/${name}: contains a historical branch/workflow trigger`);
    }

    for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)) {
      const actionRef = match[1];
      const at = actionRef.lastIndexOf('@');
      if (at < 0) {
        fail(`.github/workflows/${name}: action reference ${actionRef} has no immutable revision`);
        continue;
      }
      const revision = actionRef.slice(at + 1);
      if (!/^[0-9a-f]{40}$/i.test(revision)) {
        fail(`.github/workflows/${name}: action ${actionRef} must be pinned to an immutable 40-character commit SHA`);
      }
    }
  }
}

const studentRuntimeRoots = ['worksheets', 'visual-pages', 'viewer', 'src'];
const studentRuntimeFiles = [
  ...studentRuntimeRoots.flatMap(dir => walk(path.join(root, dir))),
  path.join(root, 'index.html'),
  path.join(root, 'print.html')
].filter(fs.existsSync);
for (const file of studentRuntimeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/https?:\/\/(?:drive|docs)\.google\.com|https?:\/\/drive\.usercontent\.google\.com/i.test(text)) {
    fail(`${rel(file)}: student/runtime output must not depend on private Google Drive URLs`);
  }
}

const workbookPath = path.join(root, 'content', 'workbook.json');
if (!fs.existsSync(workbookPath)) {
  fail('content/workbook.json: missing cone implementation manifest');
} else {
  const wb = JSON.parse(fs.readFileSync(workbookPath, 'utf8'));
  if (wb.pageCount !== 38 || wb.pages?.length !== 38) fail('content/workbook.json: worksheet count must remain 38');
  if (wb.visualPageCount !== 8 || wb.visualPages?.length !== 8) fail('content/workbook.json: visual page count must remain 8');
  if (wb.printSheetCount !== 46 || wb.printSequence?.length !== 46) fail('content/workbook.json: print sequence must remain 46 pages');

  const worksheetIds = new Set((wb.pages || []).map(p => p.id));
  const visualSlugs = new Set((wb.visualPages || []).map(p => p.slug));
  const seen = new Set();
  for (const item of wb.printSequence || []) {
    const key = item.kind === 'worksheet' ? `worksheet:${item.id}` : `visual:${item.slug}`;
    if (seen.has(key)) fail(`content/workbook.json: duplicate printSequence item ${key}`);
    seen.add(key);
    if (item.kind === 'worksheet' && !worksheetIds.has(item.id)) fail(`content/workbook.json: printSequence references missing worksheet ${item.id}`);
    if (item.kind === 'visual' && !visualSlugs.has(item.slug)) fail(`content/workbook.json: printSequence references missing visual page ${item.slug}`);
  }
}

for (const htmlPath of walk(path.join(root, 'visual-pages')).filter(p => p.endsWith('.html'))) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const match of html.matchAll(/(?:src|href)="\.\.\/visual-assets\/([^"?#]+)"/g)) {
    const asset = path.join(root, 'visual-assets', match[1]);
    if (!fs.existsSync(asset)) fail(`${rel(htmlPath)}: references missing asset visual-assets/${match[1]}`);
  }
}

for (const required of ['README.md', 'content/source-registry.json', 'print/harut-a4.html', 'print/styles.css']) {
  const file = path.join(root, required);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) fail(`${required}: required repository artifact is missing or empty`);
}

if (errors.length) {
  console.error(`Repository hygiene failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: repository is free of temporary staging, historical workflows, private runtime Drive links, parallel requirements authorities, and mutable action tags.');
