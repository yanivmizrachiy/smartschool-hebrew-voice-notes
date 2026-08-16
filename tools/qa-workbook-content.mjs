import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BOOKS = {
  circle: { dir: 'circle', count: 88 },
  cylinder: { dir: 'cylinder', count: 38 }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Workbook content QA failed: ${message}`);
};

function decodeBasicEntities(text) {
  return text
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function visibleText(html) {
  return decodeBasicEntities(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function taskTexts(html) {
  const matches = [...html.matchAll(/<section\b[^>]*class="[^"]*\btask\b[^"]*"[^>]*>([\s\S]*?)<\/section>/gi)];
  return matches.map(match => visibleText(match[1])).filter(Boolean);
}

function normalizeTask(text) {
  return text
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/\d+(?:[.,]\d+)?/g, '#')
    .replace(/[π²³]/g, 'm')
    .replace(/[()\[\]{}:;,.!?"'׳״־+=·÷<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return normalizeTask(text).split(' ').filter(token => token.length > 1 || /^[a-z]$/i.test(token));
}

function ngramSet(text, n) {
  const list = tokens(text);
  const grams = new Set();
  if (list.length < n) return grams;
  for (let i = 0; i <= list.length - n; i += 1) grams.add(list.slice(i, i + n).join(' '));
  return grams;
}

function setJaccard(A, B) {
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection += 1;
  return intersection / (A.size + B.size - intersection);
}

function similarityScore(a, b) {
  const unigram = setJaccard(new Set(tokens(a)), new Set(tokens(b)));
  const bigram = setJaccard(ngramSet(a, 2), ngramSet(b, 2));
  return 0.30 * unigram + 0.70 * bigram;
}

function isIntentionalRepeatedDrill(book, page, a, b) {
  if (book !== 'circle' || page !== 7) return false;
  const compassDrill = /שרטטו מעגל ברדיוס\s+\d+(?:[.,]\d+)?\s+ס״מ\.\s*סמנו O ורדיוס אחד/;
  return compassDrill.test(a) && compassDrill.test(b);
}

function loadBook(name, spec) {
  const dir = path.join(ROOT, spec.dir);
  const pages = [];
  for (let page = 1; page <= spec.count; page += 1) {
    const file = path.join(dir, `page-${page}.html`);
    assert(fs.existsSync(file), `${name}: missing page ${page}`);
    const html = fs.readFileSync(file, 'utf8');
    pages.push({ page, html, text: visibleText(html), tasks: taskTexts(html) });
  }
  return pages;
}

const reports = [];

for (const [name, spec] of Object.entries(BOOKS)) {
  const pages = loadBook(name, spec);

  for (const item of pages) {
    assert(!/demo|placeholder|lorem ipsum/i.test(item.text), `${name} page ${item.page}: demo/placeholder content is forbidden`);
    assert(!/[×]/.test(item.text), `${name} page ${item.page}: multiplication sign × is forbidden; use ·`);
    assert(!/\b(?:cm2|m2|cm3|m3)\b/i.test(item.text), `${name} page ${item.page}: plain-text unit powers are forbidden; use proper squared/cubic units`);

    for (let i = 0; i < item.tasks.length; i += 1) {
      for (let j = i + 1; j < item.tasks.length; j += 1) {
        if (isIntentionalRepeatedDrill(name, item.page, item.tasks[i], item.tasks[j])) continue;
        const normalizedA = normalizeTask(item.tasks[i]);
        const normalizedB = normalizeTask(item.tasks[j]);
        if (normalizedA.length >= 20 && normalizedB.length >= 20) {
          assert(normalizedA !== normalizedB, `${name} page ${item.page}: tasks ${i + 1} and ${j + 1} are structurally identical after number normalization`);
        }
        const similarity = similarityScore(item.tasks[i], item.tasks[j]);
        assert(similarity < 0.94, `${name} page ${item.page}: tasks ${i + 1} and ${j + 1} are too similar (${similarity.toFixed(2)})`);
      }
    }
  }

  for (let i = 0; i < pages.length - 1; i += 1) {
    const a = pages[i];
    const b = pages[i + 1];
    const similarity = similarityScore(a.text, b.text);
    reports.push({ book: name, a: a.page, b: b.page, similarity });
    assert(similarity < 0.93, `${name}: consecutive pages ${a.page}/${b.page} are too similar after normalization (${similarity.toFixed(2)})`);
  }
}

const circle = loadBook('circle', BOOKS.circle);
const circlePage7 = circle.find(page => page.page === 7);
assert(circlePage7.tasks.filter(task => /שרטטו מעגל ברדיוס\s+(?:2|3|4)\s+ס״מ/.test(task)).length === 3,
  'circle page 7: the only allowed repeated drill must remain the explicit 2/3/4 cm compass-radius sequence');

const circleBlock = circle.filter(page => page.page >= 52 && page.page <= 60).map(page => page.text).join(' ');
assert(/היקף/.test(circleBlock) && /שטח/.test(circleBlock) && /רדיוס/.test(circleBlock), 'circle 52–60: reverse-problem block must cover circumference, area and radius');
assert(/גינה|בריכה|שולחן|שטיח|גלגל|מזרקה|מסלול/.test(circleBlock), 'circle 52–60: real-life contexts are required');
assert(/C\s*=\s*\d+(?:[.,]\d+)?π[\s\S]*r/.test(circleBlock), 'circle 52–60: circumference → radius reasoning must exist');
assert(/A\s*=\s*\d+(?:[.,]\d+)?π[\s\S]*r/.test(circleBlock), 'circle 52–60: area → radius reasoning must exist');

const topPairs = reports.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
console.log('Highest consecutive-page similarities (informational):');
for (const row of topPairs) console.log(`${row.book} ${row.a}/${row.b}: ${row.similarity.toFixed(3)}`);
console.log('Workbook content QA: PASS (order-aware duplication checks; only the locked circle page-7 compass drill is exempt; notation, units and reverse-problem coverage checked)');
