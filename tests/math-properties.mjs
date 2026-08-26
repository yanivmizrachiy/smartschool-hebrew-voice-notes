const EPSILON = 1e-10;
const assertClose = (actual, expected, label) => {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  if (Math.abs(actual - expected) > EPSILON * scale) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
};

let cases = 0;
for (let r = 0.5; r <= 20; r += 0.5) {
  for (let h = 0.5; h <= 20; h += 0.5) {
    const cylinder = Math.PI * r * r * h;
    const cone = cylinder / 3;
    const slant = Math.hypot(r, h);

    assertClose(cone * 3, cylinder, `same r,h volume relation at r=${r}, h=${h}`);
    assertClose(slant * slant, r * r + h * h, `right-cone Pythagoras at r=${r}, h=${h}`);
    if (!(cylinder > 0 && cone > 0 && slant > r && slant > h)) {
      throw new Error(`positive-geometry invariant failed at r=${r}, h=${h}`);
    }
    cases += 1;
  }
}

for (const scale of [0.1, 0.5, 2, 5, 10]) {
  const r = 3.75;
  const h = 8.25;
  const originalCone = Math.PI * r * r * h / 3;
  const scaledCone = Math.PI * (r * scale) ** 2 * (h * scale) / 3;
  assertClose(scaledCone, originalCone * scale ** 3, `volume cubic scaling at factor ${scale}`);
  cases += 1;
}

console.log(`OK: ${cases} deterministic property-based cone/cylinder geometry cases passed.`);
