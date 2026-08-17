import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const here = path.dirname(new URL(import.meta.url).pathname);
const manifestPath = path.join(here, 'razpages-source-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const EXPECTED_REPO = 'yanivmizrachiy/razpages';
const EXPECTED_TREE = 'caa5719fd17c48a6696a4e60627cc4fbdf559e1d';
const ALLOWED = new Set(['included', 'adapted', 'not_relevant', 'missing']);

const errors = [];

if (manifest?.source?.repo !== EXPECTED_REPO) {
  errors.push(`source.repo must be ${EXPECTED_REPO}`);
}
if (manifest?.source?.treeSha !== EXPECTED_TREE) {
  errors.push(`source.treeSha must be pinned to ${EXPECTED_TREE}`);
}
if (!Array.isArray(manifest?.items) || manifest.items.length === 0) {
  errors.push('manifest.items must be a non-empty array');
}

const ids = new Set();
const topics = new Set();
for (const item of manifest.items ?? []) {
  if (!item.id || ids.has(item.id)) errors.push(`duplicate/missing id: ${item.id ?? '<empty>'}`);
  ids.add(item.id);

  if (!['circle', 'cylinder', 'cone'].includes(item.topic)) {
    errors.push(`${item.id}: invalid topic ${item.topic}`);
  } else {
    topics.add(item.topic);
  }

  if (!/^עמוד-\d+\.html$/.test(item.sourcePath ?? '')) {
    errors.push(`${item.id}: invalid sourcePath ${item.sourcePath}`);
  }
  if (!ALLOWED.has(item.status)) {
    errors.push(`${item.id}: invalid status ${item.status}`);
  }

  if (['included', 'adapted'].includes(item.status)) {
    if (!item.destination || typeof item.destination !== 'string' || !item.destination.trim()) {
      errors.push(`${item.id}: ${item.status} requires destination`);
    }
  }
  if (['adapted', 'not_relevant'].includes(item.status)) {
    if (!item.reason || typeof item.reason !== 'string' || !item.reason.trim()) {
      errors.push(`${item.id}: ${item.status} requires reason`);
    }
  }
}

for (const requiredTopic of ['circle', 'cylinder', 'cone']) {
  if (!topics.has(requiredTopic)) errors.push(`manifest has no ${requiredTopic} items`);
}

const missing = (manifest.items ?? []).filter((item) => item.status === 'missing');
if (missing.length) {
  errors.push(`unmapped RasPages source items: ${missing.length}`);
  for (const item of missing) {
    errors.push(`MISSING ${item.id} | ${item.sourcePath} | ${item.description}`);
  }
}

if (errors.length) {
  console.error('RasPages source audit: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`RasPages source audit: PASS (${manifest.items.length} source items; tree ${manifest.source.treeSha})`);
