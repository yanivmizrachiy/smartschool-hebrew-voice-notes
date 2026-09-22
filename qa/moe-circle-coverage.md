# MoE Grade-8 Geometry — CIRCLE questions: coverage audit

Source PDF: official Israeli MoE grade-8 geometry curriculum (idkun-geometri-8), circle section = **pages 3–13** (page 14+ is cylinder/cone/parallel-lines/triangles, out of scope).

Cross-checked against:
- **Worksheets**: `circle/page-*.html` (88-page practice booklet).
- **Bank snapshot**: `content/jerusalem2-geometry-p03-19.json` (verbatim MoE source, pages 3–19). Every circle question below appears verbatim in this snapshot (pages 3–13), so all are at least COVERED-bank; the table's status reflects **practice-worksheet** coverage, which is the meaningful gap signal.

## Coverage table

| # | Question id + key data | Status | Note |
|---|---|---|---|
| C1 | p3 Q1 — string/nail/pencil; identify points inside/outside a circle in a coord system | COVERED-worksheet(88) + bank(p3) | page-88 #2 classifies a point on/inside/outside by distance in coord system; pages 72–83 do coord-system circle work. Physical string metaphor not reproduced; math type covered. |
| C2 | p3 Q2 — circle r=5 at origin; classify 8 points A(5,0)…H(-5,0) on/inside | COVERED-worksheet(88) + bank(p3) | page-88 #2 is the same "on the circle / inside" test via distance, and uses r=5. Close variant. |
| C3 | p4 — find the coordinates of the circle's center | COVERED-worksheet(72,73,75,88) + bank(p4) | Center from diameter endpoints (midpoint) / tangency covered extensively. |
| C4 | p4 Q1 — Tomer's bicycle wheel, radius 30 → circumference | COVERED-worksheet(19,52,60) + bank(p4) | page-19 wheel radius/diameter; page-52 #2 wheel travels 188.4 cm → d,r; page-60 #5 wheel 31.4 cm → r. Circumference-from-radius in wheel context. |
| C5 | p5 Q2 — circle r=1, **inscribed regular hexagon**; triangle angles; hexagon perimeter; compare circle vs hexagon perimeter | **MISSING** (bank p5 only) | No `משושה`/`מצולע`/`משוכלל` anywhere in 88 worksheets. Polygon-approximation-of-π idea has zero practice. |
| C6 | p6 Q1 — stadium = square 144 m² + two half-circles; area & perimeter | COVERED-worksheet(67) + bank(p6) | page-67 "אצטדיון": rectangle + 2 half-circles, computes perimeter and area (inner short sides excluded). |
| C7 | p6 Q2 — three congruent squares w/ congruent tangent circles; which gray area is largest & why (invariance) | PARTIAL | Underlying ideas covered: page-61 #3 (circle:square ratio = π:4 is constant), page-44 (compare circle areas / ratios), page-45 (scaling). The specific "compare 3 arrangements of n circles → shaded area equal" is not a worksheet. |
| C8 | p7 Q3 — yin-yang; circle area = A; shaded S-shape = A/2 by symmetry | PARTIAL | page-63 gives half-circle area (= A/2 numerically), but the symmetry argument on the S-shaped shaded region is not present. Figure-dependent. |
| C9 | p7 Q4 — circle inscribed in square, r=6; square perimeter (MCQ); how much larger is square area than circle | COVERED-worksheet(61) + bank(p7) | page-61 "עיגול בתוך ריבוע": d=side, square perimeter, **area outside circle = square − πr²**, ratio π:4; case 1 uses side 12 (= r 6). Direct match. |
| C10 | p8 Q5 — jeweler cuts silver disks into **40° sectors**; disk 2.7 g; weight of one sector (central-angle proportion) | **MISSING** (bank p8 only) | Only half (page-63) and quarter (page-64) special cases exist. No general **central angle / גזרה / זווית מרכזית** (θ/360). MoE lists central-angle+sector as a core p3 concept — no worksheet teaches it. |
| C11 | p8 Q6 — field 150×200; grass = rectangle + 2 half-circles; paved gray area; cost 40₪/m², budget 750,000 enough | PARTIAL (sub-skills COVERED) | Composite discorectangle: page-67; cost per m²/per m: page-59; grass context: pages 35/48/56. Both sub-skills covered but not the combined field+budget problem in one worksheet. |
| C12 | p9 Q7 — rectangle with **two tangent circles r=5**; rectangle area (MCQ 200) | PARTIAL | page-65 (one circle in rectangle, shaded = rect − circle) and page-67 cover the mechanics; the specific two-tangent-circles → rectangle-dimensions inference is not present. |
| C13 | p9 Q8 — Shape A = rectangle + half-circle; Shape B = rectangle − half-circle; 20×12; perimeter comparison; area of A (MCQ) | COVERED-worksheet(63,67) + bank(p9) | page-63 teaches the key skill: perimeter of a half-circle composite includes the diameter (vs arc alone), plus half-circle area. |
| C14 | p10 Q9 — **London Eye ferris wheel**; diameter 140, top 150 m, platform 10 m; height of center M above water | **MISSING** (bank p10 only) | No ferris wheel / vertical chord-geometry problem (center height = top − radius). Atypical, niche, but zero coverage. |
| C15a | p12 Q6a — fountain-park pool area (r=5) | COVERED-worksheet(53,54,60,66) + bank(p12) | Area-from-radius chains everywhere. |
| C15b | p12 Q6b — ring/promenade area = outer(r=7) − inner(r=5) | COVERED-worksheet(66) + bank(p12) | page-66 "טבעת": exact R=7, r=5 case; annulus = πR² − πr². |
| C15c | p12 Q7 — total fence = inner + outer circumference | COVERED-worksheet(52,54,59,60) + bank(p12) | Circumference + "fence per meter" cost covered. |
| C15d | p12 Q8 — total budget; per-component cost | COVERED-worksheet(59) + bank(p12) | page-59: cost = geometric size × unit price, per m and per m². |
| C15e | p13 Q9 — double radius 5→10; prove cost grows ×4 via area ratios | COVERED-worksheet(44,45,46) + bank(p13) | page-45 (radius ×2 → area ×4, explicit correction of the "×2" misconception), page-44 #3 (radius ×2 → areas 4:1), page-46 #8. |
| C15f | p13 Q10 — cut cost 30% while keeping promenade (ring) area constant; propose new radii (optimization) | PARTIAL | page-66 #3 varies R,r keeping thickness and observes area change — related, but the open-ended "keep ring area fixed, optimize cost" design task is not a worksheet. |

## Genuine gaps (no worksheet coverage — most important first)

1. **C5 — Inscribed polygon / π-by-polygon approximation (hexagon in circle).** Entire sub-idea absent from all 88 worksheets (`משושה`/`מצולע`/`משוכלל` = 0 hits). MoE emphasizes approximating π via polygons; the booklet only discovers π by measurement (page-23). Topic-level gap.

2. **C10 — Central angle & sector for a general angle (זווית מרכזית / גזרה, e.g. 40°).** Only half-circle (page-63) and quarter-circle (page-64) special cases exist; no θ/360 sector area/arc, and no applied proportion problem (the 40° silver-disk weight). This is a **core MoE concept** listed in the page-3 basics — zero worksheet coverage. Highest-value gap to close.

3. **C14 — Circle vertical/chord geometry (ferris-wheel "London Eye").** Find the center's height from the top height and radius. Niche single problem, but no analogous worksheet.

### Partial gaps (concept present, exact task not)

- **C7** — multi-arrangement shaded-area **invariance** comparison (which of 3 layouts has largest gray area).
- **C8** — **symmetry**-based shaded region = A/2 (yin-yang figure reasoning).
- **C12** — **two tangent circles inside a rectangle** → deduce rectangle dimensions/area.
- **C11** — the combined **composite-field + budget** problem in a single worksheet (both sub-skills exist separately).
- **C15f** — **optimization** task (keep ring/annulus area fixed while cutting cost).

_Note: all 20 items are present verbatim in the bank snapshot `content/jerusalem2-geometry-p03-19.json` (pages 3–13), so nothing is missing from the official-source capture; the gaps above are strictly in the practice-worksheet booklet._
