import { describe, it, expect } from 'vitest';
import { stationRig, renderPlate, readPlate, drawnPlate, formsOfSolid, contour, curvePath, FINISHES, FINISH_NAMES } from './drawn-plate.js';
import { PLATE_EXAMPLES } from './drawn-plate-examples.js';
import { readBookStyle } from './book-style.js';

// the smallest plate that still holds the concepts: a round form and a square one under one light, on the ground
const BALL = { id: 'ball', tint: '#d9765c', gloss: true, terms: [{ op: 'add', shape: { kind: 'sphere', center: [0.3, -0.1, 0.2], radius: 0.2 } }] };
const CRATE = { id: 'crate', terms: [{ op: 'add', shape: { kind: 'box', center: [-0.25, 0.1, 0.2], size: [0.4, 0.4, 0.4] } }] };
const SMALL = { width: 200, height: 150, station: { turn: 30, eye: 1.1, distance: 3, lens: 34, look: [0, 0, 0.2] }, forms: [CRATE, BALL] };
const draw = (over = {}, opts = {}) => renderPlate({ ...SMALL, ...over }, { res: 1, ...opts });
const count = (svg, re) => (svg.match(re) || []).length;

describe('the station: two-point perspective is a camera', () => {
  const rig = stationRig({ width: 400, height: 300, station: { turn: 35, eye: 1.5, distance: 5, lens: 40, look: [0, 0, 0.5] } });

  it('the vanishing points lie on the horizon, and their distances from the centre multiply to the focal length squared', () => {
    const { x, y } = rig.vanishing;
    expect(x[1]).toBe(rig.horizonY);
    expect(y[1]).toBe(rig.horizonY);
    expect((x[0] - rig.cx) * (rig.cx - y[0])).toBeCloseTo(rig.f * rig.f, 6);
  });

  it('edges along the ground axes run to their vanishing point; a vertical stays vertical', () => {
    const far = rig.project({ x: 1e7, y: 0, z: 0.3 });
    expect(far[0]).toBeCloseTo(rig.vanishing.x[0], 1);
    expect(far[1]).toBeCloseTo(rig.horizonY, 1);
    expect(rig.project({ x: 0.4, y: 0.2, z: 0 })[0]).toBeCloseTo(rig.project({ x: 0.4, y: 0.2, z: 2 })[0], 9);
  });

  it('the eye looks at its look point: it lands at the frame\'s centre', () => {
    const [sx, sy] = rig.project({ x: 0, y: 0, z: 0.5 });
    expect(sx).toBeCloseTo(200, 6);
    expect(sy).toBeCloseTo(150, 6);
  });
});

describe('tones as shapes: the contour of a field', () => {
  it('a disc is one closed outline of its own circumference, drawn as curves', () => {
    const W = 40, H = 40, field = Float32Array.from({ length: W * H }, (_, k) => 12 - Math.hypot((k % W) - 20, Math.floor(k / W) - 20));
    const loops = contour(field, W, H, 0);
    expect(loops).toHaveLength(1);
    expect(loops[0].closed).toBe(true);
    const len = loops[0].pts.reduce((s, p, i, a) => s + Math.hypot(p[0] - a[(i + 1) % a.length][0], p[1] - a[(i + 1) % a.length][1]), 0);
    expect(len).toBeGreaterThan(2 * Math.PI * 12 * 0.97);
    expect(len).toBeLessThan(2 * Math.PI * 12 * 1.03);
    const d = curvePath(loops[0], 1);
    expect(d).toMatch(/^M[\d. -]+C/);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('a square keeps its sides straight: no run bows outside it', () => {
    const W = 40, H = 40, field = Float32Array.from({ length: W * H }, (_, k) => 10 - Math.max(Math.abs((k % W) - 20), Math.abs(Math.floor(k / W) - 20)));
    const d = curvePath(contour(field, W, H, 0)[0], 1);
    const coords = d.match(/-?\d+(\.\d+)?/g).map(Number);
    expect(Math.min(...coords)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...coords)).toBeLessThanOrEqual(30);
    // each long side is one run from corner to corner
    expect(d).toContain('C10 17 10 23 10 29');
  });
});

describe('the plate', () => {
  it('is curves and nothing else, and the same spec gives the same bytes', () => {
    const { svg } = draw();
    expect(svg).toBe(draw().svg);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toMatch(/<path d="M[^"]*C/);
    expect(svg).not.toMatch(/<image|<script|href=|NaN|Infinity/);
  });

  it('each finish lays its tones its own way: a wash in steps, a woodcut in one, an engraving in lines', () => {
    const wash = draw({ finish: 'wash' }).svg, wood = draw({ finish: 'woodcut' }).svg, engr = draw({ finish: 'engraving' }).svg;
    expect(new Set(wash.match(/opacity="0\.\d+"/g)).size).toBeGreaterThanOrEqual(FINISHES.wash.steps.length);
    expect(wash).not.toMatch(/clip-path="url\(#h/);
    expect(wood).toContain(`fill="${FINISHES.woodcut.ink}" fill-rule="evenodd" opacity="1"`);
    expect(count(engr, /clip-path="url\(#h/g)).toBeGreaterThan(0);
    expect(engr).toMatch(/stroke-linecap="round"/);
    expect(FINISH_NAMES).toEqual(Object.keys(FINISHES));
  });

  it('a form casts on the ground; without a ground nothing is drawn under it', () => {
    const on = draw().svg, off = draw({ ground: false }).svg;
    expect(off.length).toBeLessThan(on.length);
    // the ground's layer is the first drawn, before any form's clip
    expect(on.indexOf('<path')).toBeLessThan(on.indexOf('clip-path="url(#f'));
    expect(off.slice(off.indexOf('</defs>')).startsWith('</defs><path d="M')).toBe(true);
  });

  it('a tint, a gloss and the found line are the form\'s: the tint its colour, the gloss the paper, the line the ink', () => {
    const { svg } = draw();
    expect(svg).toContain(`fill="${BALL.tint}"`);
    expect(svg).toContain(`fill="${FINISHES.wash.paper}" opacity="0.92"`);
    expect(svg).toMatch(new RegExp(`fill="${FINISHES.wash.ink}" fill-rule="evenodd" transform="translate\\(`));
    expect(draw({ forms: [CRATE] }).svg).not.toContain(BALL.tint);
  });

  it('is framed on what is drawn, or on the whole picture plane when asked', () => {
    const fit = draw(), full = draw({ frame: 'full' });
    expect([full.width, full.height]).toEqual([SMALL.width, SMALL.height]);
    expect(fit.width).toBeLessThan(full.width);
    expect(fit.svg).toMatch(new RegExp(`viewBox="\\d+ \\d+ ${fit.width} ${fit.height}"`));
  });

  it('sits on a page beside another: its ids take a prefix, and its paper can be left to the page', () => {
    const a = draw({}, { prefix: 'a-', backdrop: false }).svg;
    expect(a).toMatch(/id="a-f1"/);
    expect(a).not.toMatch(/id="f1"/);
    expect(a).not.toMatch(/<rect/);
    expect(draw().svg).toMatch(/<rect /);
  });

  it('takes its paper and ink from a palette, and draws its construction when asked', () => {
    const { svg } = draw({ palette: { paper: '#ffffff', ink: '#000000' }, construction: true });
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('stroke="#9b4a2c"');
    expect(draw().svg).not.toContain('#9b4a2c');
  });
});

describe('reading a plate', () => {
  it('refuses what is not one, naming what it takes', () => {
    expect(() => readPlate(null)).toThrow(/a plate is \{ forms/);
    expect(() => readPlate({ forms: [] })).toThrow(/forms is a non-empty list/);
    expect(() => readPlate({ forms: [{ terms: [{ op: 'add', shape: { kind: 'cube' } }] }] })).toThrow(/forms\[0\]\.terms/);
    expect(() => readPlate({ ...SMALL, finish: 'oil' })).toThrow(/finish is one of wash, woodcut, engraving/);
    expect(() => readPlate({ ...SMALL, station: { turn: 90 } })).toThrow(/one-point perspective/);
    expect(() => readPlate({ ...SMALL, light: { azimuth: 400 } })).toThrow(/-90 from the left/);
    expect(() => readPlate({ ...SMALL, forms: [{ ...BALL, tint: 'red' }] })).toThrow(/#rrggbb/);
    expect(() => readPlate({ ...SMALL, frame: 'tight' })).toThrow(/'fit'/);
    expect(readPlate(SMALL)).toBe(SMALL);
  });

  it('every example is a plate', () => {
    for (const plate of Object.values(PLATE_EXAMPLES)) expect(readPlate(plate)).toBe(plate);
  });

  it('a minted workbench solid\'s fields are its forms, moved where the solid moved them', () => {
    const forms = formsOfSolid({ kind: 'workbench', fields: [{ id: 'knob', terms: BALL.terms, tint: '#445566' }, { terms: CRATE.terms, translate: [0, 0, 1] }] });
    expect(forms).toHaveLength(2);
    expect(forms[0]).toEqual({ id: 'knob', terms: BALL.terms, tint: '#445566' });
    expect(forms[1].terms.at(-1)).toEqual({ op: 'transform', translate: [0, 0, 1] });
    expect(readPlate({ forms })).toBeTruthy();
    expect(() => formsOfSolid({ kind: 'workbench', lathes: [{}] })).toThrow(/no `fields` to draw/);
  });
});

describe('a plate in a book', () => {
  it('is the press\'s figure in the book\'s own ink, its paper left to the page, with its caption', () => {
    const html = drawnPlate(SMALL, { style: 'tome', caption: 'Plate I. A ball & a crate.', id: 'one', res: 1 });
    const C = readBookStyle('tome').colours;
    expect(html.startsWith('<figure class="plate">')).toBe(true);
    expect(html).toContain('<figcaption>Plate I. A ball &amp; a crate.</figcaption>');
    expect(html).toContain(`stroke="${C.ink}"`);
    expect(html).toMatch(/id="one-f1"/);
    expect(html).not.toMatch(/<rect/);
    expect(drawnPlate(SMALL, { span: true, res: 1 })).toContain('class="plate span"');
  });
});
