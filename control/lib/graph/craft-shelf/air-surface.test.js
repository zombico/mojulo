// The aircraft's surface (air-surface.js through craftForm's livery and wear): a graded camo darker on top than beneath,
// a wing by its face; a blotched one in its bands' shares; splinter's shards cut straight; a seam the camo's own colour
// darkened; the marks laid on the skin (on its plane, a millimetre or two proud), low-visibility against the paint, the
// tail number on both sides of the fin; the wear: soot over the engine's end, streaks running aft, chips on the leading
// edges in bare metal, more for battered than used, none for pristine; each absent adding nothing; within the budget;
// every face wound to its normal; the same twice. One craft, chosen from the shelf in code; one case per kind of pattern.
import { describe, it, expect } from 'vitest';
import { craftForm } from './craft-form.js';
import { AIR_CAMO, readAirLivery, decal } from './air-surface.js';
import { CRAFT_ARCHETYPES } from './craft-archetypes.js';

const A = CRAFT_ARCHETYPES;
const JET = Object.keys(A).find((k) => A[k].realm === 'earth' && A[k].role === 'superiority' && /F-/.test(A[k].classOf));
const KIND = (k) => Object.keys(AIR_CAMO).find((p) => AIR_CAMO[p].kind === k);
const faces = (C) => C.items.flatMap((i) => i.faces);
const itemOf = (C, id) => C.items.find((i) => i.id === id).faces;
const tris = (C) => faces(C).reduce((s, f) => s + f.corners.length - 2, 0);
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cen = (f) => [0, 1, 2].map((k) => f.corners.reduce((s, q) => s + q[k], 0) / f.corners.length);
const area = (P) => { let n = [0, 0, 0]; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n = [n[0] + a[1] * b[2] - a[2] * b[1], n[1] + a[2] * b[0] - a[0] * b[2], n[2] + a[0] * b[1] - a[1] * b[0]]; } return Math.hypot(...n) / 2; };
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return n; };
const paint = (fs) => fs.filter((f) => f.material === 'airPaint' && !f.fitting);

const plain = craftForm(JET, { made: true });

describe('a pair\'s two sides', () => {
  it('lowered alike: a mirrored wing\'s faces the same raw paint as its twin\'s (the flat light kept on a mirrored part)', () => {
    const C = craftForm(JET), set = (id) => new Set(itemOf(C, id).filter((f) => f.material !== 'navRed' && f.material !== 'navGreen').map((f) => `${f.material} ${f.albedo}`));
    expect([...set('wing-l')].sort()).toEqual([...set('wing-r')].sort());
  });
});

describe('the livery read', () => {
  it('a word is its pattern; its words checked; marks generic by default', () => {
    expect(readAirLivery('naval')).toMatchObject({ pattern: 'naval', marks: { emblem: 'disc', warnings: true } });
    expect(readAirLivery(null)).toBe(null);
    expect(() => readAirLivery('woodland')).toThrow(/pattern/);
    expect(() => readAirLivery({ pattern: 'desert', stripes: 2 })).toThrow(/not one of its words/);
    expect(() => readAirLivery({ pattern: 'desert', marks: { number: '12345' } })).toThrow(/digits/);
  });
});

describe('the camo, cut into the paint', () => {
  const graded = KIND('shade'), blotched = KIND('field'), shards = KIND('planes');
  it('graded: the hull\'s top darker than its belly, a wing\'s upper face darker than its lower', () => {
    // (the craft without its made skin: a seam is the paint darkened)
    const C = craftForm(JET, { livery: graded }), hull = paint(itemOf(C, 'hull'));
    const zs = hull.map((f) => cen(f)[2]), lo = Math.min(...zs), hi = Math.max(...zs);
    const top = hull.filter((f) => cen(f)[2] > hi - 0.15 * (hi - lo) && f.outNormal[2] > 0.5), belly = hull.filter((f) => cen(f)[2] < lo + 0.15 * (hi - lo) && f.outNormal[2] < -0.5);
    expect(Math.max(...top.map((f) => lum(f.albedo)))).toBeLessThan(Math.min(...belly.map((f) => lum(f.albedo))));
    const wing = paint(itemOf(C, 'wing-r'));
    expect(lum(wing.find((f) => f.outNormal[2] > 0.8).albedo)).toBeLessThan(lum(wing.find((f) => f.outNormal[2] < -0.8).albedo));
  });
  it('blotched: every band of the pattern on the craft, its first the most of it', () => {
    const C = craftForm(JET, { made: true, livery: blotched }), cols = AIR_CAMO[blotched].colours;
    const by = new Map(cols.map((c) => [c, 0]));
    for (const it of C.items) if (!/^(missile|gun|canopy)/.test(it.id)) for (const f of paint(it.faces)) if (by.has(f.albedo)) by.set(f.albedo, by.get(f.albedo) + area(f.corners));
    for (const c of cols) expect(by.get(c), c).toBeGreaterThan(0);
    expect(by.get(cols[0])).toBeGreaterThan(Math.max(...cols.slice(1).map((c) => by.get(c))));
  });
  it('splinter: more than one shard\'s colour on the hull, each face one colour; the stores keep their own', () => {
    const C = craftForm(JET, { made: true, livery: shards }), cols = new Set(AIR_CAMO[shards].colours);
    expect(new Set(paint(itemOf(C, 'hull')).map((f) => f.albedo).filter((a) => cols.has(a))).size).toBeGreaterThan(1);
    expect(paint(itemOf(C, 'missile-r')).some((f) => cols.has(f.albedo))).toBe(false);
  });
  it('a seam the camo\'s own colour under it darkened', () => {
    const C = craftForm(JET, { made: true, livery: blotched }), hull = itemOf(C, 'hull');
    const camo = new Set(paint(hull).map((f) => f.albedo)), dark = new Set([...camo].map((h) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.68).toString(16).padStart(2, '0')).join('')));
    expect(hull.filter((f) => !f.fitting && dark.has(f.albedo)).length).toBeGreaterThan(50);
  });
});

describe('the marks', () => {
  const C = craftForm(JET, { made: true, livery: { pattern: KIND('shade'), marks: { number: '417' } } });
  const marks = faces(C).filter((f) => f.fitting === 'mark');
  it('laid on the skin: each on the plane of a skin face under it, a millimetre or two proud', () => {
    expect(marks.length).toBeGreaterThan(40);
    for (const it of C.items) {
      const skin = it.faces.filter((f) => !f.fitting);
      for (const m of it.faces.filter((f) => f.fitting === 'mark').filter((_, i) => i % 5 === 0)) {
        const c = cen(m), d = Math.min(...skin.filter((g) => Math.hypot(...cen(g).map((v, k) => v - c[k])) < 1).map((g) => Math.abs((c[0] - g.corners[0][0]) * g.outNormal[0] + (c[1] - g.corners[0][1]) * g.outNormal[1] + (c[2] - g.corners[0][2]) * g.outNormal[2])));
        expect(d, it.id).toBeLessThan(0.004);
      }
    }
  });
  it('the tail number on both sides of the fin; low-visibility, a step off the paint; the warning red', () => {
    const fin = itemOf(C, 'fin').filter((f) => f.fitting === 'mark');
    expect(fin.some((f) => f.outNormal[0] > 0.5) && fin.some((f) => f.outNormal[0] < -0.5)).toBe(true);
    const paints = new Set(faces(C).filter((f) => f.material === 'airPaint' && !f.fitting).map((f) => f.albedo));
    expect(marks.filter((f) => f.albedo !== '#a8392c').every((f) => !paints.has(f.albedo))).toBe(true);
    expect(marks.some((f) => f.albedo === '#a8392c')).toBe(true);
  });
  it('none with marks false; a decal laid only on faces turned toward it', () => {
    expect(faces(craftForm(JET, { made: true, livery: { pattern: 'mono', marks: false } })).some((f) => f.fitting === 'mark')).toBe(false);
    const sq = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
    const up = { corners: sq, part: 'p', material: 'airPaint', albedo: '#808080', outNormal: [0, 0, 1] }, down = { ...up, outNormal: [0, 0, -1] };
    const look = () => ({ material: 'airPaint', albedo: '#000000' }), shape = [[[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]]];
    expect(decal([up], { at: [0.5, 0.5, 0], out: [0, 0, 1], up: [0, 1, 0] }, shape, look)).toHaveLength(1);
    expect(decal([down], { at: [0.5, 0.5, 0], out: [0, 0, 1], up: [0, 1, 0] }, shape, look)).toHaveLength(0);
  });
});

describe('the wear', () => {
  const used = craftForm(JET, { made: true, livery: KIND('shade'), wear: 'used' }), battered = craftForm(JET, { made: true, livery: KIND('shade'), wear: 'battered' });
  const worn = (C) => faces(C).filter((f) => f.fitting === 'wear');
  it('streaks, chips and patches laid; more battered than used; chips bare metal on what faces ahead', () => {
    expect(worn(used).length).toBeGreaterThan(50);
    expect(worn(battered).length).toBeGreaterThan(worn(used).length);
    const chips = worn(battered).filter((f) => f.material === 'airMetal');
    expect(chips.length).toBeGreaterThan(30);
    for (const f of chips) expect(f.outNormal[1]).toBeGreaterThan(0.3);
  });
  it('soot over the engine\'s end: the hull\'s aft corners darker than its middle\'s', () => {
    const hull = itemOf(battered, 'hull').filter((f) => f.cornerAlbedo), ys = hull.flatMap((f) => f.corners.map((c) => c[1]));
    const y0 = Math.min(...ys), aft = hull.filter((f) => cen(f)[1] < y0 + 0.6), mid = hull.filter((f) => Math.abs(cen(f)[1] - (y0 + 7)) < 1);
    const mean = (fs) => fs.flatMap((f) => f.cornerAlbedo.map(lum)).reduce((s, v, _, a) => s + v / a.length, 0);
    expect(aft.length).toBeGreaterThan(5);
    expect(mean(aft)).toBeLessThan(mean(mid) * 0.9);
  });
  it('pristine lays none; without the words the craft is as it was', () => {
    expect(JSON.stringify(craftForm(JET, { made: true, wear: 'pristine' }))).toBe(JSON.stringify(plain));
    expect(JSON.stringify(craftForm(JET, { made: true, livery: undefined, wear: null }))).toBe(JSON.stringify(plain));
  });
});

describe('within its budget, wound, the same twice', () => {
  it('the made fighter in each kind of pattern, battered, within 130k triangles, every face wound to its normal', () => {
    for (const p of ['shade', 'field', 'planes'].map(KIND)) {
      const C = craftForm(JET, { made: true, livery: p, wear: 'battered' });
      expect(tris(C), p).toBeLessThan(130000);
      for (const f of faces(C)) { const w = newell(f.corners); expect(w[0] * f.outNormal[0] + w[1] * f.outNormal[1] + w[2] * f.outNormal[2], p).toBeGreaterThan(-1e-9); }
    }
    expect(JSON.stringify(craftForm(JET, { made: true, livery: KIND('planes'), wear: 'used' }))).toBe(JSON.stringify(craftForm(JET, { made: true, livery: KIND('planes'), wear: 'used' })));
  });
});
