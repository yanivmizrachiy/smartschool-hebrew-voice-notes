from pathlib import Path
from PIL import Image, ImageFilter

render = Path('qa/layout-pages/01-page-17.png')
if not render.exists():
    raise SystemExit('Ayelet render fidelity: missing qa/layout-pages/01-page-17.png')

img = Image.open(render).convert('RGB')
if img.size != (794, 1123):
    raise SystemExit(f'Ayelet render fidelity: expected 794x1123, got {img.size[0]}x{img.size[1]}')

# Source-derived visual anchor: the red cone in the supplied source PDF renders at
# approximately x=101..171, y=576..674 when the A4 page is normalized to 794x1123.
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

# Chrome's LCD text antialiasing creates colored RGB fringes around otherwise black text.
# Blur before chroma analysis so those sub-pixel fringes collapse back to neutral gray,
# while any real colored card/diagram remains a coherent colored region.
blurred = img.filter(ImageFilter.GaussianBlur(radius=2.2))
colored = []
for y in range(8, img.height - 8):
    for x in range(8, img.width - 8):
        if 88 <= x <= 185 and 555 <= y <= 690:
            continue
        rgb = blurred.getpixel((x, y))
        if max(rgb) - min(rgb) > 45 and min(rgb) < 205:
            colored.append((x, y, rgb))

# A few isolated pixels are harmless; a real added colored visual produces a much larger
# coherent region after blur.
if len(colored) > 250:
    cxs = [p[0] for p in colored]
    cys = [p[1] for p in colored]
    cbbox = (min(cxs), min(cys), max(cxs) + 1, max(cys) + 1)
    raise SystemExit(
        f'Ayelet render fidelity: detected coherent colored content outside the original cone; '
        f'pixels={len(colored)}, bbox={cbbox}'
    )

print(f'OK: Ayelet rendered source cone bbox={bbox}; no extra coherent colored visuals detected.')
