import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const exists = rel => fs.existsSync(path.join(root, rel));
const errors = [];
const fail = message => errors.push(message);
const assert = (condition, message) => { if (!condition) fail(message); };

function validateSchemaSubset(value, schema, at = '$') {
  if (!schema || typeof schema !== 'object') return;

  if (Object.hasOwn(schema, 'const') && value !== schema.const) fail(`${at}: expected constant ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) fail(`${at}: value ${JSON.stringify(value)} is not in enum`);

  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(`${at}: expected object`);
      return;
    }
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`${at}: missing required property ${key}`);
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${at}: unexpected property ${key}`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) validateSchemaSubset(value[key], childSchema, `${at}.${key}`);
    }
    return;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      fail(`${at}: expected array`);
      return;
    }
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) fail(`${at}: expected at least ${schema.minItems} items`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) fail(`${at}: expected at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, index) => validateSchemaSubset(item, schema.items, `${at}[${index}]`));
    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      fail(`${at}: expected string`);
      return;
    }
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) fail(`${at}: string is shorter than ${schema.minLength}`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) fail(`${at}: string does not match ${schema.pattern}`);
    return;
  }

  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) {
      fail(`${at}: expected integer`);
      return;
    }
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail(`${at}: value is below minimum ${schema.minimum}`);
    return;
  }

  if (schema.type === 'boolean' && typeof value !== 'boolean') fail(`${at}: expected boolean`);
}

const catalogPath = 'content/catalog.json';
const catalogSchemaPath = 'content/schemas/catalog.schema.json';
const simpleSchemaPath = 'content/schemas/simple-workbook.schema.json';
assert(exists(catalogPath), `${catalogPath}: missing canonical workbook catalog`);
assert(exists(catalogSchemaPath), `${catalogSchemaPath}: missing catalog schema`);
assert(exists(simpleSchemaPath), `${simpleSchemaPath}: missing simple workbook schema`);

if (!errors.length) {
  const catalog = readJson(catalogPath);
  const catalogSchema = readJson(catalogSchemaPath);
  const simpleSchema = readJson(simpleSchemaPath);
  validateSchemaSubset(catalog, catalogSchema, 'catalog');

  assert(catalog.schemaVersion === 1, 'catalog: schemaVersion must be 1');
  assert(catalog.projectId === 'circle-cylinder-cone', 'catalog: unexpected projectId');
  assert(Array.isArray(catalog.books) && catalog.books.length === 3, 'catalog: exactly three books are required');

  const ids = (catalog.books || []).map(book => book.id);
  assert(new Set(ids).size === ids.length, 'catalog: duplicate workbook id');
  for (const required of ['circle', 'cylinder', 'cone']) assert(ids.includes(required), `catalog: missing ${required}`);

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

    validateSchemaSubset(manifest, simpleSchema, book.id);
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

  assert(totalPages === 174, `catalog: total A4 page count must be 174, found ${totalPages}`);

  const circle = catalog.books?.find(book => book.id === 'circle');
  const cylinder = catalog.books?.find(book => book.id === 'cylinder');
  if (circle && exists(circle.manifest)) {
    const manifest = readJson(circle.manifest);
    assert(manifest.pageCount === 90, 'circle: page count must remain 90');
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

console.log('OK: canonical catalog + executable schema subset resolve circle 90 + cylinder 38 + cone 46 = 174 A4 pages with valid manifests and page paths.');
