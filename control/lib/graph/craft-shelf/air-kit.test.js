// The aircraft detail kit: its skin (panel lines laid on an item's own faces along the planes they lie on, darker than
// the paint and in its slot, a millimetre proud; access panels and their fasteners; wings' ribs and spars), the made
// craft within its budget, every face wound to agree with its normal; its parts (lips, hinges, doors, wells, tyres,
// nozzles, lights, blisters, blades) lowering to the shelf's faces in their tints, the same twice; the light the
// aircraft asks for (a low sheen, glass seen into, a big craft's shadow bias). One craft, chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { craftForm, craftFormFigure, AIR_MATERIALS } from './craft-form.js';
import * as K from './air-kit-parts.js';
import { CRAFT_ARCHETYPES } from './craft-archetypes.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';
import { FLAT_LIGHT } from '../polygonizer/vexar.js';

const JET = Object.keys(CRAFT_ARCHETYPES).find((k) => CRAFT_ARCHETYPES[k].realm === 'earth' && CRAFT_ARCHETYPES[k].role === 'superiority' && /F-/.test(CRAFT_ARCHETYPES[k].classOf));
const plain = craftForm(JET), made = craftForm(JET, { made: true });
const itemOf = (C, id) => C.items.find((i) => i.id === id);
const tris = (C) => C.items.flatMap((i) => i.faces).reduce((s, f) => s + f.corners.length - 2, 0);
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return n; };
const lum = (h) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0);

describe('the skin\'s panel lines', () => {
  // (a seam: the colour of the skin's paint under it darkened, on a face that is not a fitting; the made pieces on the
  // skin, a door, a blade, a fairing, are fittings and carry none)
  const darkOf = (h) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.68).toString(16).padStart(2, '0')).join('');
  const seamsOf = (fs) => { const dark = new Set(fs.filter((f) => !f.fitting && f.material === 'airPaint').map((f) => darkOf(f.albedo))); return fs.filter((f) => !f.fitting && dark.has(f.albedo)); };
  it('laid on the hull and the wings: more faces than the plain skin, each a seam darker than the paint under it, in its slot', () => {
    for (const id of ['hull', 'wing-r', 'fin']) {
      const p = itemOf(plain, id).faces, m = itemOf(made, id).faces;
      expect(m.filter((f) => !f.fitting).length, id).toBeGreaterThan(p.length + 20);
      const seams = seamsOf(m);
      expect(seams.length, id).toBeGreaterThan(20);
      for (const f of seams) expect(['airPaint', 'airTrim'], id).toContain(f.material);
      // (none on a fitting: every fitting keeps its own colour)
      expect(m.filter((f) => f.fitting).some((f) => seams.includes(f)), id).toBe(false);
    }
  });
  it('a seam lies on the skin: within a few millimetres of the plane of the skin face nearest it', () => {
    const cen = (f) => [0, 1, 2].map((k) => f.corners.reduce((s, q) => s + q[k], 0) / f.corners.length);
    const all = itemOf(made, 'hull').faces, seams = seamsOf(all), set = new Set(seams);
    const skin = all.filter((f) => !f.fitting && !set.has(f) && f.part === 'hull').map((f) => ({ c: cen(f), p: f.corners[0], n: f.outNormal, m: f.material }));
    expect(seams.length).toBeGreaterThan(50);
    for (const f of seams.filter((_, i) => i % 7 === 0).slice(0, 120)) {
      // (the nearest of the planes of the six skin faces of its slot nearest it: on a curved hull its own face is among them)
      const c = cen(f), near = skin.filter((g) => g.m === f.material).map((g) => ({ g, e: Math.hypot(g.c[0] - c[0], g.c[1] - c[1], g.c[2] - c[2]) })).sort((a, b) => a.e - b.e).slice(0, 6);
      const d = Math.min(...near.map(({ g }) => Math.abs((c[0] - g.p[0]) * g.n[0] + (c[1] - g.p[1]) * g.n[1] + (c[2] - g.p[2]) * g.n[2])));
      expect(d).toBeLessThan(0.004);
    }
  });
  it('the access panels\' fasteners on the hull, bare metal heads', () => {
    expect(itemOf(made, 'hull').faces.filter((f) => f.part === 'fastener' && f.material === 'airMetal').length).toBeGreaterThan(60);
  });
  it('every face wound to agree with its normal, the mirrored parts too', () => {
    for (const it of made.items) for (const f of it.faces) {
      const w = newell(f.corners);
      expect(w[0] * f.outNormal[0] + w[1] * f.outNormal[1] + w[2] * f.outNormal[2], it.id).toBeGreaterThan(-1e-9);
    }
  });
  it('within its budget, the same twice', () => {
    // (the plan's budget for a fighter made: its skin, its cockpit and its parts' made finish)
    expect(tris(made)).toBeLessThan(80000);
    expect(JSON.stringify(craftForm(JET, { made: true }))).toBe(JSON.stringify(made));
  });
});

describe('the kit\'s parts', () => {
  const T = { paint: '#8c949c', metal: '#6c737a', dark: '#1c1d1f', glass: '#26323c', light: '#ff2a1a', primer: '#a3a75a', hot: '#6a5a8a' };
  const PIECES = {
    lip: () => K.rolledLip('lip', [0, 0, 0.6], [0, 1, 0], 0.5, 0.04, T.metal),
    hinge: () => K.hingeLine('hinge', [-0.6, 0, 0.3], [0.6, 0, 0.3], T.dark, { knuckles: 4, metal: T.metal }),
    door: () => K.panelDoor('door', [-0.4, 0, 0.1], [1, 0, 0], [0, 0, 1], { w: 0.8, h: 0.5, tint: T.paint, metal: T.metal }),
    well: () => K.wellBox('well', [0, 0, 0], { w: 0.6, d: 1.0, h: 0.5 }, { primer: T.primer, metal: T.metal }),
    tyre: () => K.treadTyre('tyre', [0, 0, 0.35], [1, 0, 0], { D: 0.7, W: 0.22 }, { rubber: T.dark, metal: T.metal }),
    nozzle: () => K.petalNozzle('nozzle', [0, 0, 0.6], [0, -0.7, 0.6], { R0: 0.45, R1: 0.5, n: 14 }, { metal: T.metal, dark: T.dark, hot: T.hot }),
    light: () => K.coveredLight('light', [0, 0, 0.2], [0, 0, 1], { r: 0.06, light: T.light, glass: T.glass }),
    blister: () => K.blister('blister', [0, 0, 0.2], [0, 0, 1], [0, 1, 0], { len: 0.9, wid: 0.3, h: 0.1, tint: T.paint }),
    blade: () => K.blade('blade', [0, 0, 0.1], [0, 0, 1], [0, 1, 0], { len: 0.4, chord: 0.25, tint: T.paint }),
  };
  const lower = (id, src) => lowerAssemblerBuild({ kind: 'assembler', units: 'm', items: [{ id, source: { kind: 'workbench', units: 'm', title: id, ...src } }] }, { light: FLAT_LIGHT }).faces;
  const box = (fs) => [0, 1, 2].map((k) => { const v = fs.flatMap((f) => f.corners.map((c) => c[k])); return Math.max(...v) - Math.min(...v); });
  it('each lowers to the shelf\'s faces in its own tints, the same twice', () => {
    for (const [id, make] of Object.entries(PIECES)) {
      const fs = lower(id, make());
      expect(fs.length, id).toBeGreaterThan(5);
      for (const f of fs) expect(Object.values(T), id).toContain(f.fill);
      expect(JSON.stringify(make()), id).toBe(JSON.stringify(PIECES[id]()));
    }
  });
  it('at the size asked: a tyre its diameter and width, a door its width and height, a nozzle its petals', () => {
    const t = box(lower('tyre', PIECES.tyre()));
    expect(t[1]).toBeCloseTo(0.7, 1); expect(t[2]).toBeCloseTo(0.7, 1); expect(t[0]).toBeGreaterThan(0.2);
    const d = box(lower('door', PIECES.door()));
    expect(d[0]).toBeGreaterThan(0.79); expect(d[2]).toBeGreaterThan(0.49);
    expect(PIECES.nozzle().extrudes.filter((e) => /_petal_/.test(e.id))).toHaveLength(14);
    // (a tyre's tread ribbed: its section rises and falls round its crown)
    const radii = PIECES.tyre().lathes[0].profile.map((p) => p.radius);
    expect(radii.filter((r, i) => i && r < radii[i - 1]).length).toBeGreaterThan(3);
  });
});

describe('the light an aircraft asks for', () => {
  it('a low sheen on its paint, its canopy glass seen into, a big craft\'s shadow bias', () => {
    expect(AIR_MATERIALS.airPaint.roughness).toBeGreaterThanOrEqual(0.6);
    expect(AIR_MATERIALS.canopy).toMatchObject({ transparent: true });
    expect(AIR_MATERIALS.canopy.opacity).toBeLessThan(0.6);
    expect(craftFormFigure(JET).form.normalBias).toBeGreaterThan(0.05);
  });
});

describe('the cockpit under the canopy', () => {
  const NOCANOPY = Object.keys(CRAFT_ARCHETYPES).find((k) => CRAFT_ARCHETYPES[k].realm === 'earth' && !CRAFT_ARCHETYPES[k].layout.some((e) => e.id === 'canopy'));
  const hull = itemOf(made, 'hull').faces, canopy = itemOf(made, 'canopy').faces, pit = hull.filter((f) => !itemOf(plain, 'hull').faces.some((g) => g === f));
  const ext = (fs, k) => { const v = fs.flatMap((f) => f.corners.map((c) => c[k])); return [Math.min(...v), Math.max(...v)]; };
  it('a seat with its pull handle, a panel and its displays, the HUD\'s glass, a stick: inside the canopy, under its roof', () => {
    const cockpitFaces = hull.filter((f) => ['#26292c', '#2f3336', '#3b4232', '#d8b02a'].includes(f.albedo) || (f.material === 'canopy'));
    expect(cockpitFaces.some((f) => f.albedo === '#d8b02a')).toBe(true);
    expect(cockpitFaces.some((f) => f.material === 'canopy')).toBe(true);
    const [cx0, cx1] = ext(canopy, 0), [cy0, cy1] = ext(canopy, 1), [, cz1] = ext(canopy, 2);
    for (const f of cockpitFaces) for (const c of f.corners) {
      expect(c[0]).toBeGreaterThan(cx0 - 1e-3); expect(c[0]).toBeLessThan(cx1 + 1e-3);
      expect(c[1]).toBeGreaterThan(cy0 - 1e-3); expect(c[1]).toBeLessThan(cy1 + 1e-3);
      expect(c[2]).toBeLessThan(cz1);
    }
  });
  it('its canopy\'s glass smoky gold when made; without the word, and on a craft with no canopy, none', () => {
    expect(new Set(canopy.filter((f) => f.material === 'canopy').map((f) => f.albedo))).toEqual(new Set(['#6f6a52']));
    expect(itemOf(plain, 'hull').faces.some((f) => f.albedo === '#d8b02a')).toBe(false);
    if (NOCANOPY) expect(craftForm(NOCANOPY, { made: true }).items.flatMap((i) => i.faces).some((f) => f.albedo === '#d8b02a')).toBe(false);
  });
});

