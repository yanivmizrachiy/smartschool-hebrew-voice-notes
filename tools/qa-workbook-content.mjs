import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BOOKS = {
  circle: { dir: 'circle', count: 90 },
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
  // Word order carries most of the score so inverse operations are not mistaken for clones.
  return 0.30 * unigram + 0.70 * bigram;
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
assert(/שרטטו מעגל ברדיוס\s*2\s*ס״מ/.test(circlePage7.text), 'circle page 7: direct radius→construction task is required');
assert(/קוטר\s*6\s*ס״מ[\s\S]*r\s*=\s*____\s*ס״מ/.test(circlePage7.text), 'circle page 7: diameter→radius→construction task is required');
assert(/AB[\s\S]*8\s*ס״מ[\s\S]*אמצע[\s\S]*O/.test(circlePage7.text), 'circle page 7: diameter-segment→midpoint→center construction task is required');
assert(/r\s*=\s*2[\s\S]*d\s*=\s*8[\s\S]*פתיחת המחוגה/.test(circlePage7.text), 'circle page 7: closed comparison of radius vs diameter compass openings is required');
assert(!/שרטטו מעגל ברדיוס\s*3\s*ס״מ/.test(circlePage7.text) && !/שרטטו מעגל ברדיוס\s*4\s*ס״מ/.test(circlePage7.text),
  'circle page 7: legacy 2/3/4 number-only repeated compass drill must not return');

const circleBlock = circle.filter(page => page.page >= 52 && page.page <= 60).map(page => page.text).join(' ');
assert(/היקף/.test(circleBlock) && /שטח/.test(circleBlock) && /רדיוס/.test(circleBlock), 'circle 52–60: reverse-problem block must cover circumference, area and radius');
assert(/גינה|בריכה|שולחן|שטיח|גלגל|מזרקה|מסלול/.test(circleBlock), 'circle 52–60: real-life contexts are required');
assert(/C\s*=\s*\d+(?:[.,]\d+)?π[\s\S]*r/.test(circleBlock), 'circle 52–60: circumference → radius reasoning must exist');
assert(/A\s*=\s*\d+(?:[.,]\d+)?π[\s\S]*r/.test(circleBlock), 'circle 52–60: area → radius reasoning must exist');

const topPairs = reports.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
console.log('Highest consecutive-page similarities (informational):');
for (const row of topPairs) console.log(`${row.book} ${row.a}/${row.b}: ${row.similarity.toFixed(3)}`);
console.log('Workbook content QA: PASS (order-aware duplication, diversified circle page-7 construction, notation, units and reverse-problem coverage checked)');
