import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const exists = rel => fs.existsSync(path.join(root, rel));
const errors = [];
const fail = message => errors.push(message);
const assert = (condition, message) => { if (!condition) fail(message); };

const catalogPath = 'content/catalog.json';
assert(exists(catalogPath), `${catalogPath}: missing canonical workbook catalog`);

if (!errors.length) {
  const catalog = readJson(catalogPath);
  assert(catalog.schemaVersion === 1, 'catalog: schemaVersion must be 1');
  assert(catalog.projectId === 'circle-cylinder-cone', 'catalog: unexpected projectId');
  assert(Array.isArray(catalog.books) && catalog.books.length === 3, 'catalog: exactly three books are required');

  const ids = (catalog.books || []).map(book => book.id);
  assert(new Set(ids).size === ids.length, 'catalog: duplicate workbook id');
  for (const required of ['circle', 'cylinder', 'cone']) {
    assert(ids.includes(required), `catalog: missing ${required}`);
  }

  let totalPages = 0;
  for (const book of catalog.books || []) {
    assert(typeof book.manifest === 'string' && book.manifest.startsWith('content/') && book.manifest.endsWith('.json'), `catalog: invalid manifest path for ${book.id}`);
    if (!exists(book.manifest)) {
      fail(`catalog: ${book.id} manifest does not exist: ${book.manifest}`);
      continue;
    }

    const manifest = readJson(book.manifest);
    if (book.id === 'cone') {
      assert(manifest.pageCount === 38, 'cone: worksheet count must remain 38');
      assert(manifest.visualPageCount === 8, 'cone: visual page count must remain 8');
      assert(manifest.printSheetCount === 46, 'cone: print sheet count must remain 46');
      assert(Array.isArray(manifest.pages) && manifest.pages.length === 38, 'cone: pages array must contain 38 worksheets');
      assert(Array.isArray(manifest.visualPages) && manifest.visualPages.length === 8, 'cone: visualPages array must contain 8 pages');
      assert(Array.isArray(manifest.printSequence) && manifest.printSequence.length === 46, 'cone: printSequence must contain 46 items');
      totalPages += manifest.printSheetCount || 0;
      continue;
    }

    assert(manifest.schemaVersion === 1, `${book.id}: schemaVersion must be 1`);
    assert(manifest.id === book.id, `${book.id}: manifest id mismatch`);
    assert(manifest.sourceType === 'numbered-html-series', `${book.id}: unsupported sourceType`);
    assert(Number.isInteger(manifest.pageCount) && manifest.pageCount > 0, `${book.id}: invalid pageCount`);
    assert(manifest.pageRange?.start === 1, `${book.id}: page range must start at 1`);
    assert(manifest.pageRange?.end === manifest.pageCount, `${book.id}: pageRange.end must equal pageCount`);
    assert(typeof manifest.pagePattern === 'string' && manifest.pagePattern.includes('{page}'), `${book.id}: pagePattern must contain {page}`);
    assert(Number.isInteger(manifest.a4UtilizationMaxBlankPx) && manifest.a4UtilizationMaxBlankPx >= 0, `${book.id}: invalid A4 utilization threshold`);

    for (let page = 1; page <= (manifest.pageCount || 0); page += 1) {
      const file = path.join(manifest.folder, manifest.pagePattern.replace('{page}', String(page))).replaceAll('\\', '/');
      assert(exists(file), `${book.id}: missing page ${page}: ${file}`);
    }
    totalPages += manifest.pageCount || 0;
  }

  assert(totalPages === 172, `catalog: total A4 page count must be 172, found ${totalPages}`);

  const circle = catalog.books?.find(book => book.id === 'circle');
  const cylinder = catalog.books?.find(book => book.id === 'cylinder');
  if (circle && exists(circle.manifest)) {
    const manifest = readJson(circle.manifest);
    assert(manifest.pageCount === 88, 'circle: page count must remain 88');
    assert(manifest.identity?.nameField === false && manifest.identity?.dateField === false, 'circle: name/date fields must remain disabled');
    assert(manifest.a4UtilizationMaxBlankPx === 150, 'circle: A4 blank-space threshold must remain 150px');
  }
  if (cylinder && exists(cylinder.manifest)) {
    const manifest = readJson(cylinder.manifest);
    assert(manifest.pageCount === 38, 'cylinder: page count must remain 38');
    assert(manifest.identity?.nameField === true && manifest.identity?.dateField === true, 'cylinder: name/date fields must remain enabled');
    assert(manifest.a4UtilizationMaxBlankPx === 150, 'cylinder: A4 blank-space threshold must remain 150px');
  }
}

if (errors.length) {
  console.error(`Catalog contract failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: canonical catalog resolves circle 88 + cylinder 38 + cone 46 = 172 A4 pages with valid manifests and page paths.');
