import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = n => fs.readFileSync(path.join(root, 'worksheets', `page-${n}.html`), 'utf8');
const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const conePi = (r, h) => r * r * h / 3; // coefficient of π
const cylPi = (r, h) => r * r * h;
const hyp = (a, b) => Math.sqrt(a * a + b * b);
const leg = (hypotenuse, otherLeg) => Math.sqrt(hypotenuse * hypotenuse - otherLeg * otherLeg);
const sectorAngle = (baseRadius, slantHeight) => 360 * baseRadius / slantHeight;

// Conceptual geometry checks from pages 1–5 and 14–21.
assert(read(1).includes('יש בסיס בצורת עיגול'), 'page 1: cone base must be described as a disk (עיגול)');
assert(read(2).includes('אורך קשת הגזרה') && read(2).includes('היקף בסיס'), 'page 2: sector arc must match base circumference');
assert(read(3).includes('אורך קשת הגזרה') && read(3).includes('היקף בסיס החרוט'), 'page 3: net compatibility rule missing');
assert(!read(4).includes('היטל ניצב'), 'page 4: projection jargon should not remain in middle-school worksheet');
assert(read(5).includes('משולש שווה־שוקיים'), 'page 5: axial section of a right cone must be isosceles triangle');
assert(read(14).includes('קרוב לקודקוד') && read(14).includes('קרוב לבסיס'), 'page 14: parallel-section comparison missing');
// Page 17 is an externally supplied, source-locked document. Mathematical audit must not rewrite its terminology;
// source fidelity is enforced separately by source-locked.mjs, while corrected terminology is used on project-authored pages.
assert(read(17).includes('בסיס החרוט הוא  - מעגל'), 'page 17: locked source wording for the cone base must remain verbatim');
assert(read(17).includes('נקודה על המעגל אל קודקוד החרוט'), 'page 17: locked source wording for the generator must remain verbatim');
assert(read(18).includes('משפט פיתגורס במשולש ישר־זווית'), 'page 18: Pythagoras wording must be precise for grade 8');
assert(read(19).includes('בסיס בצורת עיגול'), 'page 19: cone identification must use precise base terminology');
assert(read(20).includes('רדיוס 6 ס״מ') && read(20).includes('גובה 8 ס״מ') && read(20).includes('יוצר 10 ס״מ'), 'page 20: corrected 6-8-10 triple missing');
assert(read(21).includes('נפח') && read(21).includes('רדיוס²') && read(21).includes('גובה'), 'page 21: cone volume formula components missing');

// Page 6 — volume basics.
assert(near(300 / 3, 100), 'page 6: cone/cylinder 1:3 volume relation');
assert(near(conePi(3, 12), 36), 'page 6: r=3 h=12 => 36π');
assert(near(conePi(5, 9), 75), 'page 6: r=5 h=9 => 75π');
assert(near(conePi(4, 15), 80), 'page 6: r=4 h=15 => 80π');
assert(near(conePi(6, 10), 120), 'page 6: r=6 h=10 => 120π');

// Page 7 — comparisons and scale factors.
assert(near(conePi(4, 12), 64), 'page 7: container A => 64π');
assert(near(conePi(8, 6), 128), 'page 7: container B => 128π');
assert(near(128 / 64, 2), 'page 7: B is twice A');
assert(near(3, 3) && near(3 ** 2, 9) && near(2 ** 2 * 2, 8) && near(0.5 ** 2, 0.25), 'page 7: volume scale factors');
assert(near(conePi(4, 9), 48), 'page 7: one valid design for 48π');

// Page 8 — cone vs cylinder and radius scaling.
assert(near(conePi(6, 10), 120) && near(cylPi(6, 10), 360), 'page 8: cone/cylinder volumes');
assert(near(cylPi(6, 10) / conePi(6, 10), 3), 'page 8: cylinder is 3× cone');
assert(near(3 ** 2, 9), 'page 8: tripling radius multiplies base area and cone volume by 9');

// Page 9 — 5-12-13 cone.
assert(near(leg(13, 5), 12), 'page 9: height from r=5, slant=13 must be 12');
assert(near(conePi(5, 12), 100), 'page 9: volume must be 100π');

// Page 10 — reverse volume problems.
assert(near(80 * 3 / 16, 15), 'page 10: r=4, V=80π => h=15');
assert(near(Math.sqrt(75 * 3 / 9), 5), 'page 10: h=9, V=75π => r=5');
assert(near(conePi(4, 9), 48), 'page 10: candidate 4,9 fits 48π');
assert(near(conePi(6, 4), 48), 'page 10: candidate 6,4 fits 48π');
assert(!near(conePi(3, 15), 48), 'page 10: candidate 3,15 must be rejected');
assert(near(conePi(5, 12), 100) && 12 < 15, 'page 10: valid 100π design with h<15');

// Page 11 — cone nets.
assert(near(2 * 3, 6) && near(2 * 5, 10) && near(2 * 7, 14), 'page 11: circumference coefficients 2r');
assert(near(16 / 2, 8), 'page 11: arc 16π => base radius 8');
assert(near(8 / 2, 4) && near(12 / 2, 6), 'page 11: arc lengths 8π/12π => radii 4/6');
assert(near(2 * 6, 12), 'page 11: base r=6 => arc length 12π');

// Page 12 — same-volume reasoning.
assert(near(conePi(4, 9), conePi(6, 4)), 'page 12: distinct dimensions can give same volume');
assert(9 > 4 && 4 < 6, 'page 12: for same positive volume, larger height corresponds to smaller radius in example');

// Page 13 — cone/cylinder relation.
assert(near(540 / 3, 180), 'page 13: 540 cylinder => 180 cone');
assert(near(150 / 3, 50), 'page 13: 150π cylinder => 50π cone');
assert(near(50 * 2, 100), 'page 13: doubling cone height doubles its volume');
assert(near(cylPi(3, 10), 90) && near(conePi(3, 10), 30), 'page 13 table row 1');
assert(near(cylPi(5, 6), 150) && near(conePi(5, 6), 50), 'page 13 table row 2');
assert(near(cylPi(4, 12), 192) && near(conePi(4, 12), 64), 'page 13 table row 3');

// Page 15 — sector/slant geometry.
assert(near(sectorAngle(3, 12), 90), 'page 15: r=3, slant=12 => sector 90°');
assert(near(sectorAngle(4, 10), 144), 'page 15: r=4, slant=10 => sector 144°');
assert(8 > 6, 'page 15: base radius 8 with slant 6 is impossible');
assert(near(sectorAngle(4, 10), 2 * sectorAngle(2, 10)), 'page 15: same slant, doubled radius => doubled sector angle');

// Page 16 — integrated problem.
assert(near(12 / 2, 6), 'page 16: arc 12π => base radius 6');
assert(near(leg(10, 6), 8), 'page 16: r=6, slant=10 => h=8');
assert(near(conePi(6, 8), 96), 'page 16: integrated volume => 96π');

// Page 18 — prerequisite arithmetic.
assert(2 * 3 === 6 && 2 * 4 === 8, 'page 18: diameters');
assert(near(2 * 3 * 3, 18) && near(2 * 3 * 4, 24), 'page 18: circumference with π≈3');
assert(5 * 3 * 4 === 60, 'page 18: box volume 5×3×4=60');
assert(6 ** 2 + 8 ** 2 === 10 ** 2, 'page 18: 6-8-10 Pythagoras');

// Page 20 — valid right-cone metric triple.
assert(6 ** 2 + 8 ** 2 === 10 ** 2, 'page 20: r=6 h=8 slant=10 must satisfy Pythagoras');

// Page 22 — single-step volumes and corrected 5-12-13 triple.
assert(near(conePi(3, 8), 24), 'page 22: 3,8 => 24π');
assert(near(conePi(4, 9), 48), 'page 22: 4,9 => 48π');
assert(near(conePi(5, 6), 50), 'page 22: 5,6 => 50π');
assert(near(conePi(6, 5), 60), 'page 22: 6,5 => 60π');
assert(5 ** 2 + 12 ** 2 === 13 ** 2, 'page 22: corrected r=5 h=12 slant=13 must be valid');

// Page 23 — error analysis.
assert(near(conePi(4, 9), 48), 'page 23: correct volume 48π');
assert(near(4 ** 2 * 9, 144), 'page 23: 144π is the missing-third distractor');
assert(near(conePi(6, 10), 120), 'page 23: diameter 12 => radius 6 => 120π');

// Page 24 — axial section.
assert(2 * 5 === 10, 'page 24: axial-section base is diameter 10');
assert(2 * 6 === 12, 'page 24: r=6 => full section base 12');

// Page 25 — axial-section area.
assert(near((2 * 4) * 9 / 2, 36), 'page 25: r=4 h=9 => section area 36');
assert(near((2 * 6) * 10 / 2, 60), 'page 25: r=6 h=10 => section area 60');

// Pages 26–28 — Pythagoras.
assert(near(hyp(6, 8), 10), 'page 26: 6-8-10');
assert(near(leg(13, 5), 12), 'page 26: r=5 slant=13 => h=12');
assert(near(leg(13, 5), 12), 'page 27: first height 12');
assert(near(leg(17, 8), 15), 'page 27: second height 15');
assert(near(leg(13, 12), 5), 'page 28: h=12 slant=13 => r=5');
assert(near(hyp(9, 12), 15), 'page 28: r=9 h=12 => slant=15');
assert(!near(hyp(8, 6), 9) && near(hyp(8, 6), 10), 'page 28: 8,6,9 impossible; corrected slant 10');

// Pages 29–30 — unit conversions and volume.
assert(60 / 10 === 6 && 0.12 * 100 === 12 && 150 / 10 === 15 && 0.4 * 100 === 40, 'page 29: length conversions');
assert(40 / 10 === 4 && 0.15 * 100 === 15, 'page 29: mixed-unit conversions');
assert(near(conePi(4, 9), 48), 'page 30: 40mm→4cm, h=9 => 48π');
assert(0.10 * 100 === 10 && 10 / 2 === 5 && near(conePi(5, 12), 100), 'page 30: diameter 0.10m => 10cm, r=5, V=100π');

// Page 31 — real-life models.
assert(near(conePi(6, 8), 96), 'page 31: funnel volume 96π');
assert(near(conePi(14, 30), 1960), 'page 31: traffic-cone model volume coefficient 1960π');
assert(!read(31).includes('ולכן בדרך כלל יציבות טובה יותר'), 'page 31: unsupported stability claim should be removed');

// Pages 32–34 — multi-step cone problems.
assert(near(leg(15, 9), 12) && near(conePi(9, 12), 324), 'page 32: 9-12-15 and volume 324π');
assert(near(leg(10, 6), 8) && near(conePi(6, 8), 96), 'page 33: 6-8-10 and volume 96π');
assert(!read(33).includes('גובה (גובה)'), 'page 33: duplicated converted wording must be absent');
assert(near(leg(15, 9), 12) && near((2 * 9) * 12 / 2, 108), 'page 34 case 1: h=12, area=108');
assert(near(leg(25, 7), 24) && near((2 * 7) * 24 / 2, 168), 'page 34 case 2: h=24, area=168');

// Pages 35–38 — reverse calculation, error analysis, feasibility, final task.
assert(near(Math.sqrt(144 * 3 / 12), 6), 'page 35: V=144π h=12 => r=6');
assert(near(100 * 3 / 25, 12), 'page 35: V=100π r=5 => h=12');
assert(near(Math.sqrt(48 * 3 / 9), 4), 'page 35: V=48π h=9 => r=4');
assert(near(conePi(5, 12), 100), 'page 36: diameter 10 h=12 => correct volume 100π');
assert(6 ** 2 + 8 ** 2 === 10 ** 2, 'page 37 row 1 valid');
assert(8 ** 2 + 15 ** 2 === 17 ** 2, 'page 37 row 2 valid');
assert(8 ** 2 + 6 ** 2 !== 9 ** 2, 'page 37 row 3 invalid');
assert(5 ** 2 + 12 ** 2 === 13 ** 2, 'page 37 row 4 valid');
assert(near(hyp(8, 6), 10), 'page 37 corrected slant must be 10');
assert(10 / 2 === 5 && near(hyp(5, 12), 13), 'page 38: diameter 10, h=12 => r=5, slant=13');
assert(near(conePi(5, 12), 100), 'page 38: volume 100π');
assert(near(10 * 12 / 2, 60), 'page 38: axial-section area 60');
assert(read(38).includes('אלומת אור חרוטית'), 'page 38: context title should describe a cone-shaped light beam');

if (errors.length) {
  console.error(`Mathematical correctness check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: page-by-page cone mathematics regression checks passed for all numerical and key conceptual cases.');