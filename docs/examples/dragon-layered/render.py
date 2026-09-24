"""render.py — compile the cast sweep and draw every cast through the shared wire renderer.
Framing is fixed from the baseline so casts are comparable; every cast must stay in frame."""
from pathlib import Path
import importlib.util, json, subprocess, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import xml.etree.ElementTree as ET
P = Path(__file__).resolve().parent
# Renders and compiled casts land in the gitignored spike tree; docs keeps recipe, casts, code and tests.
OUT = Path(os.environ.get('MOJULO_SPIKE_OUT') or P.parents[2] / 'lite-template/integration/0924/spike-output/dragon-layered'); OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('wire', P.parent / 'raccoon-head-wire/build-wire.py'); w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
w.features = {'Eyes', 'Nostrils', 'Teeth', 'Horns', 'Crest', 'Lip'}
CASTS = json.loads((P / 'casts.json').read_text())
VIEWS = [('quarter', 150), ('profile', 90), ('front', 180)]
for name, dials in CASTS.items():
    subprocess.run(['node', str(P / 'compile.mjs'), json.dumps(dials), name, str(OUT)], check=True, capture_output=True)
V = np.vstack([np.array(json.loads((OUT / f'{n}.json').read_text())['vertices']) for n in CASTS]); target = (V.min(0) + V.max(0)) / 2; dist = 3.0 * np.linalg.norm(V - target, axis=1).max()   # one framing for every cast
w.set_framing([float(t) for t in target], float(dist))
for name in CASTS:
    d = json.loads((OUT / f'{name}.json').read_text()); w.set_source(d)
    for az in np.arange(0, 360, 7.5):
        q, _ = w.project(az); assert (q[:, 2] > 0).all() and ((q[:, :2] >= 0) & (q[:, :2] <= w.W)).all(), f'{name} leaves the frame at az {az}'
    for label, az in VIEWS:
        paths = w.view(az); (OUT / f'{name}-{label}.svg').write_text(w.svg(paths, az=az)); w.png(paths).save(OUT / f'{name}-{label}.png')
    if name == 'baseline': (OUT / 'baseline-construction.svg').write_text(w.svg(w.view(150), True, az=150))
# cast sheet: PNG previews of the same projected paths
names = list(CASTS); cols = len(names); cell = 450
canvas = Image.new('RGB', (cols * cell, 2 * cell + 60), '#f7f5ef'); draw = ImageDraw.Draw(canvas); font = ImageFont.load_default(size=18)
for j, name in enumerate(names):
    draw.text((j * cell + 12, 8), name, fill='#253744', font=font); draw.text((j * cell + 12, 30), ', '.join(f'{k} {v}' for k, v in CASTS[name].items()) or 'rest', fill='#82939c', font=ImageFont.load_default(size=13))
    for row, (label, _) in enumerate(VIEWS[:2]): canvas.paste(Image.open(OUT / f'{name}-{label}.png').resize((cell, cell)), (j * cell, 60 + row * cell))
canvas.save(OUT / 'casts.png')
# the same sheet as one vector SVG, paths and metadata intact
NS = '{http://www.w3.org/2000/svg}'; ET.register_namespace('', NS[1:-1])
sheet = ET.Element(NS + 'svg', {'viewBox': f'0 0 {cols * 600} 1260'}); ET.SubElement(sheet, NS + 'rect', {'width': str(cols * 600), 'height': '1260', 'fill': '#f7f5ef'})
for j, name in enumerate(names):
    t = ET.SubElement(sheet, NS + 'text', {'x': str(j * 600 + 20), 'y': '26', 'fill': '#253744', 'font-size': '22', 'font-family': 'sans-serif'}); t.text = name
    for row, (label, _) in enumerate(VIEWS[:2]):
        child = ET.parse(OUT / f'{name}-{label}.svg').getroot(); child.set('x', str(j * 600)); child.set('y', str(row * 630 + 30)); child.set('width', '600'); child.set('height', '600')
        for el in child.iter():
            if el.get('id'): el.set('id', f'{name}-{label}-' + el.get('id'))
        sheet.append(child)
ET.ElementTree(sheet).write(OUT / 'casts.svg', encoding='unicode')
print('rendered', len(names), 'casts x', len(VIEWS), 'views; sheet casts.png / casts.svg')
