import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
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

const failures = [];

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('not a PNG file');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

for (const [rel, lock] of Object.entries(expected)) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`${rel}: missing final source PNG`);
    continue;
  }
  const data = fs.readFileSync(file);
  const digest = crypto.createHash('sha256').update(data).digest('hex');
  let dimensions;
  try {
    dimensions = pngDimensions(data);
  } catch (error) {
    failures.push(`${rel}: ${error.message}`);
    continue;
  }
  if (data.length !== lock.bytes) failures.push(`${rel}: byte size ${data.length} != ${lock.bytes}`);
  if (dimensions.width !== lock.width || dimensions.height !== lock.height) {
    failures.push(`${rel}: dimensions ${dimensions.width}x${dimensions.height} != ${lock.width}x${lock.height}`);
  }
  if (digest !== lock.sha256) failures.push(`${rel}: sha256 ${digest} != locked source ${lock.sha256}`);
}

if (failures.length) {
  console.error(`Final cone PNG verification failed with ${failures.length} issue(s):`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('OK: all four final cone PNG assets match the exact verified source bytes and 1055x1491 dimensions.');
