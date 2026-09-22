import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outDir = path.join(root, 'qa', 'visual-assets');

// These locks are implementation evidence for the source-quality requirement in
// RULES.md. They are the exact four PNG sources that were independently
// verified in the prior final-cone release preflight. Do not upscale or replace
// them merely to satisfy an arbitrary pixel threshold; fidelity is byte-locked.
const expected = {
  'visual-assets/anis-basics.png': {
    bytes: 2383847,
    width: 1055,
    height: 1491,
    sha256: 'b9cf1b2dd2ca1263a39fcfdef2b3cd295af0c8b1053bf818d249023863f5c65a'
  },
  'visual-assets/cone-in-my-head.png': {
    bytes: 2578227,
    width: 1055,
    height: 1491,
    sha256: 'ec95b439b498b8ef7191d226b09e4612cf332be3702cbd2c27d1f244b0d10b84'
  },
  'visual-assets/world-of-cones.png': {
    bytes: 3054080,
    width: 1055,
    height: 1491,
    sha256: 'ca46b93f94932b694d9d3bce301a1d5f885b458267d46a2c584359fd65247ee5'
  },
  'visual-assets/jerusalem-cone-vision.png': {
    bytes: 2817862,
    width: 1055,
    height: 1491,
    sha256: '78350a291425eadcf8b89ed18edff294afcb369498bca25edcef8bb62fae9bad'
  }
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngDimensions(buffer) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('invalid PNG signature');
  }
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('missing canonical 13-byte IHDR chunk');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

const results = Object.entries(expected).map(([rel, lock]) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    return {
      path: rel,
      exists: false,
      sourceVerified: false,
      renderReady: false,
      reason: 'exact verified source PNG is not yet repo-hosted'
    };
  }

  try {
    const buffer = fs.readFileSync(file);
    const { width, height } = pngDimensions(buffer);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const sourceVerified =
      buffer.length === lock.bytes &&
      width === lock.width &&
      height === lock.height &&
      sha256 === lock.sha256;

    return {
      path: rel,
      exists: true,
      bytes: buffer.length,
      width,
      height,
      sha256,
      sourceVerified,
      renderReady: sourceVerified,
      reason: sourceVerified
        ? 'exact canonical PNG source matches locked bytes, IHDR dimensions and SHA-256'
        : 'repo asset does not match the exact verified canonical source lock'
    };
  } catch (error) {
    return {
      path: rel,
      exists: true,
      sourceVerified: false,
      renderReady: false,
      reason: error.message
    };
  }
});

const blocked = results.filter(item => !item.sourceVerified);
const report = {
  schemaVersion: 2,
  target: 'exact source fidelity for the four full-page cone visuals',
  policy: 'exact canonical source lock; no artificial upscaling',
  blocked: blocked.length > 0,
  blockedCount: blocked.length,
  assets: results
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'status.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

for (const item of blocked) {
  console.log(`::warning file=${item.path}::BLOCKED EXTERNAL ASSET — ${item.reason}`);
}

console.log(blocked.length
  ? `Visual asset audit: ${blocked.length}/${results.length} exact source PNGs are still blocked; no substitute or upscale was fabricated.`
  : `Visual asset audit: all ${results.length} full-page cone visuals match the exact verified source locks.`);
