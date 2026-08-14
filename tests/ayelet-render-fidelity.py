from pathlib import Path
from PIL import Image

render = Path('qa/layout-pages/01-page-17.png')
if not render.exists():
    raise SystemExit('Ayelet render fidelity: missing qa/layout-pages/01-page-17.png')

img = Image.open(render).convert('RGB')
if img.size != (794, 1123):
    raise SystemExit(f'Ayelet render fidelity: expected 794x1123, got {img.size[0]}x{img.size[1]}')

# Source-derived visual anchor: the red cone in the supplied source PDF renders at
# approximately x=101..171, y=576..674 when the A4 page is normalized to 794x1123.
# We use a tolerant red-pixel mask so antialiasing does not create false failures.
red = []
for y in range(500, 760):
    for x in range(0, 260):
        r, g, b = img.getpixel((x, y))
        if r > 100 and r > g * 1.15 and r > b * 1.15 and g < 190:
            red.append((x, y))

if not red:
    raise SystemExit('Ayelet render fidelity: source cone is not visible in the expected page region')

xs = [p[0] for p in red]
ys = [p[1] for p in red]
bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
expected = (101, 576, 171, 674)
tolerance = (4, 5, 4, 6)
for actual, target, tol, label in zip(bbox, expected, tolerance, ('left', 'top', 'right', 'bottom')):
    if abs(actual - target) > tol:
        raise SystemExit(f'Ayelet render fidelity: cone {label} drifted: expected {target}±{tol}, got {actual}; bbox={bbox}')

# A source-faithful A4 page is black/white plus the original red cone. Reject new
# colored diagrams/cards inside the paper. Ignore an 8px viewport rim because Chrome
# can expose the site's decorative body background on the final fractional A4 pixel.
colored_outside = 0
for y in range(8, img.height - 8):
    for x in range(8, img.width - 8):
        if 88 <= x <= 185 and 555 <= y <= 690:
            continue
        r, g, b = img.getpixel((x, y))
        if max(r, g, b) - min(r, g, b) > 35 and min(r, g, b) < 220:
            colored_outside += 1
            if colored_outside > 40:
                raise SystemExit('Ayelet render fidelity: detected invented colored visual content inside the A4 paper outside the original cone')

print(f'OK: Ayelet rendered source cone bbox={bbox}; no extra colored visuals detected in the A4 paper.')
