// field-paint: the cut's laws on a quad whose answers are known, then the ring chart, the World and the rig pack on a hero.
import { describe, it, expect } from 'vitest';
import { FIELD_SHAPES, FIELD_SHAPE_NAMES, validateFieldPaint, fieldPaintOf, fieldColours, fieldPaintReadout, cellTriangles, markPolys, MARK } from './field-paint.js';
import { parseSvgPath } from './carve-solid.js';
import { heroRecord, expandLayeredManifest, planLayered, createLayeredHandler } from '../../mcp/tools/layered.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

// a 1 m square standing in x-z, facing the front (+y), as two triangles; and the same square's back face
const quad = (back = false) => {
  const vertices = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]];
  const faces = back ? [[0, 1, 2], [0, 2, 3]] : [[0, 2, 1], [0, 3, 2]];
  return { vertices, faces, groups: ['Cloth', 'Cloth'], provenance: vertices.map(() => ({ part: 'board', layer: 3 })), parts: { board: {} } };
};
const triArea = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };
/** the area each group covers on `mesh` under `list` */
function areas(mesh, list) {
  const fp = fieldPaintOf(mesh, list), out = {};
  mesh.faces.forEach((t, fi) => {
    const P = t.map((vi) => mesh.vertices[vi]), cells = fp.cut(fi) ?? [{ ring: [{ w: [1, 0, 0] }, { w: [0, 1, 0] }, { w: [0, 0, 1] }], group: mesh.groups[fi] }];
    for (const c of cells) for (const T of cellTriangles(c.ring)) out[c.group] = (out[c.group] || 0) + triArea(...T.map(({ w }) => [0, 1, 2].map((k) => w[0] * P[0][k] + w[1] * P[1][k] + w[2] * P[2][k])));
  });
  return out;
}

describe('the field paint words', () => {
  it('names what it refuses', () => {
    expect(validateFieldPaint(undefined)).toEqual([]);
    expect(validateFieldPaint({})[0]).toMatch(/a list of/);
    const errs = validateFieldPaint([{ part: 'torso', shape: 'blob', group: 'X', chart: 'side', color: 'red', spin: 1 }]).join('\n');
    for (const want of ["'blob' is not a shape", 'chart: one of front', "color: '#rrggbb'", 'spin: not a field paint word']) expect(errs).toContain(want);
    expect(validateFieldPaint([{ part: 'torso', group: 'X' }])[0]).toMatch(/a shape or a pattern/);
    expect(validateFieldPaint([{ part: 'torso', group: 'X', shape: { poly: [[0, 0], [1, 1], [1, -1], [-1, 1]] } }])[0]).toMatch(/convex polygon/);
    expect(validateFieldPaint([{ part: 'torso', group: 'X', pattern: { cells: 'hex', grid: [48, 48] } }])[0]).toMatch(/at most/);
    expect(validateFieldPaint([{ part: 'torso', group: 'X', shape: { motif: 'rose' } }])[0]).toMatch(/'rose' is not a motif/);
    expect(() => fieldPaintOf(quad(), [{ part: 'board', group: 'X' }])).toThrow(/fieldPaint refused/);
  });
  it('every shape is a union of convex polygons in the unit box', () => {
    for (const name of FIELD_SHAPE_NAMES) for (const P of FIELD_SHAPES[name]()) {
      expect(validateFieldPaint([{ part: 'p', group: 'G', shape: { poly: P.map(([x, y]) => [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]) } }]), name).toEqual([]);
    }
  });
  it('the colours it names', () => { expect(fieldColours([{ group: 'A', color: '#111111' }, { group: 'B' }, { group: 'A', color: '#222222' }])).toEqual({ A: '#222222' }); });
});

describe('the cut', () => {
  it('paints exactly the shape\'s area, across the faces\' diagonal', () => {
    const a = areas(quad(), [{ part: 'board', shape: 'rect', at: [0.5, 0.5], size: [0.5, 0.5], group: 'Charge' }]);
    expect(a.Charge).toBeCloseTo(0.25, 9); expect(a.Cloth).toBeCloseTo(0.75, 9);
    const d = areas(quad(), [{ part: 'board', shape: 'diamond', at: [0.3, 0.6], size: 0.4, group: 'Charge' }]);
    expect(d.Charge).toBeCloseTo(0.08, 9);   // a diamond is half its box
    const s = areas(quad(), [{ part: 'board', shape: 'rect', size: 0.4, rotate: 30, group: 'Charge' }]);
    expect(s.Charge).toBeCloseTo(0.16, 9);   // turned, the same area
  });
  it('a later entry paints over an earlier, and `only` repaints only its groups', () => {
    const a = areas(quad(), [{ part: 'board', shape: 'rect', at: [0.25, 0.5], size: [0.5, 1], group: 'A' }, { part: 'board', shape: 'rect', at: [0.5, 0.5], size: [0.5, 1], group: 'B' }]);
    expect(a.A).toBeCloseTo(0.25, 9); expect(a.B).toBeCloseTo(0.5, 9);
    const o = areas(quad(), [{ part: 'board', shape: 'rect', at: [0.25, 0.5], size: [0.5, 1], group: 'A' }, { part: 'board', shape: 'rect', size: [2, 2], only: ['A'], group: 'C' }]);
    expect(o.C).toBeCloseTo(0.5, 9); expect(o.Cloth).toBeCloseTo(0.5, 9); expect(o.A).toBeUndefined();
  });
  it('a projection paints only the faces that face it; a pattern\'s cells each paint', () => {
    expect(fieldPaintOf(quad(true), [{ part: 'board', shape: 'rect', group: 'X' }]).cut(0)).toBeNull();
    expect(fieldPaintOf(quad(true), [{ part: 'board', chart: 'back', shape: 'rect', group: 'X' }]).cut(0)).not.toBeNull();
    const b = areas(quad(), [{ part: 'board', pattern: { bands: 4, gap: 0.5 }, size: [1, 1], group: 'Band' }]);
    expect(b.Band).toBeCloseTo(0.5, 9);
  });
  it('two faces cut along their shared edge at the same points', () => {
    const mesh = quad(), fp = fieldPaintOf(mesh, [{ part: 'board', shape: 'circle', at: [0.5, 0.5], size: 0.6, group: 'X' }]);
    // the diagonal 0 → 2 is face 0's corners (0, 1) and face 1's corners (0, 2): a point there has a zero weight
    const onEdge = (fi, k0, k1) => fp.cut(fi).flatMap((c) => c.ring).filter(({ w }) => w[3 - k0 - k1] === 0).map(({ w }) => { const P = mesh.faces[fi].map((vi) => mesh.vertices[vi]); return [0, 2].map((k) => w[0] * P[0][k] + w[1] * P[1][k] + w[2] * P[2][k]); });
    const key = (p) => p.map((x) => x.toFixed(9)).join(',');
    const A = new Set(onEdge(0, 0, 1).map(key)), B = new Set(onEdge(1, 0, 2).map(key));
    const crossing = [...A].filter((k) => !['0.000000000,0.000000000', '1.000000000,1.000000000'].includes(k));
    expect(crossing.length).toBeGreaterThan(0);
    for (const k of crossing) expect(B.has(k)).toBe(true);
  });
});

// a MARK as pasted: a ring of two arcs with a ring of two arcs inside it (its hole), and a curved wing 4 by 3
const RING = 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z M 50 25 A 25 25 0 1 0 50 75 A 25 25 0 1 0 50 25 Z';
const WING = 'M 0 40 C 20 30 30 10 40 20 C 45 10 48 8 50 0 C 52 8 55 10 60 20 C 70 10 80 30 100 40 C 85 45 80 60 70 55 C 62 70 55 60 50 75 C 45 60 38 70 30 55 C 20 60 15 45 0 40 Z';
describe('a mark: an SVG path pasted as drawn', () => {
  it('is cut with its holes, its arcs drawn as arcs, fitted into the shape\'s box by its larger side', () => {
    const A = areas(quad(), [{ part: 'board', shape: { path: RING }, size: [0.8, 0.8], group: 'Mark' }]);
    // the outer ring's radius 0.4 m, its hole's 0.2 m: the painted area is the band, within the curves' chords
    expect(A.Mark).toBeCloseTo(Math.PI * (0.4 ** 2 - 0.2 ** 2), 2);
    expect(A.Mark + A.Cloth).toBeCloseTo(1, 9);
    const W = markPolys(WING).flat(), xs = W.map((p) => p[0]), ys = W.map((p) => p[1]);
    expect([Math.min(...xs), Math.max(...xs), Math.max(...ys)].map((v) => +v.toFixed(3))).toEqual([-1, 1, 0.75]);
    // y turned up: the wing's peak (x 50, y 0 in the drawing, SVG's y down) is the box's top, at its middle
    expect(+W[ys.indexOf(Math.max(...ys))][0].toFixed(3)).toBe(0);
    expect(markPolys(WING)).toEqual(markPolys(WING));
  });
  it('names what it refuses: not a path, a key beside it, more pieces than a cut takes', () => {
    expect(validateFieldPaint([{ part: 'torso', shape: { path: RING }, group: 'E' }])).toEqual([]);
    expect(validateFieldPaint([{ part: 'torso', shape: { path: 'a star' }, group: 'E' }])[0]).toMatch(/shape\.path: a mark's path is an SVG path's d/);
    expect(validateFieldPaint([{ part: 'torso', shape: { path: RING, w: 1 }, group: 'E' }])[0]).toMatch(/a mark is \{ path \} alone/);
    expect(validateFieldPaint([{ part: 'torso', shape: { path: 'M 0 0 L 1 1' }, group: 'E' }])[0]).toMatch(/drew no closed outline|no outline with an area/);
    const fine = `M 0 0 ${Array.from({ length: 900 }, (_, i) => `L ${i + 1} ${(i % 2) * 40 + i * 0.01}`).join(' ')} L 900 -10 Z`;
    expect(validateFieldPaint([{ part: 'torso', shape: { path: fine }, group: 'E' }])[0]).toMatch(/too detailed to cut \(\d+ pieces, at most 600\)/);
  });
  it('an arc is a line to its end unless the reader asks for arcs (the carved solids\' reading kept)', () => {
    const d = 'M 0 0 A 10 10 0 0 1 20 0 Z';
    expect(parseSvgPath(d)).toEqual([[[0, 0], [20, 0]]].filter((r) => r.length > 2));
    expect(parseSvgPath(d, { arcs: true, curveSteps: MARK.curveSteps })[0].length).toBeGreaterThan(8);
  });
});

describe('on a hero', () => {
  const { m, mesh } = (() => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', detail: 'clothed', adorn: 'ranger' }) }); return { m, mesh: planLayered(m).mesh }; })();
  it('the ring chart paints the front of the torso, not its back, and the readout counts it', () => {
    const fp = fieldPaintOf(mesh, [{ part: 'torso', chart: 'ring', shape: 'rect', at: [0.5, 0.5], size: [0.3, 1.2], group: 'Front' }]);
    let front = 0, back = 0;
    mesh.faces.forEach((t, fi) => { const c = fp.cut(fi); if (!c?.some((x) => x.group === 'Front')) return; const y = t.reduce((s, vi) => s + mesh.vertices[vi][1], 0) / 3; if (y > 0) front++; else back++; });
    expect(front).toBeGreaterThan(4); expect(back).toBe(0);
    const R = fieldPaintReadout(mesh, [{ part: 'torso', chart: 'ring', shape: 'rect', group: 'Front' }, { part: 'nothing', shape: 'rect', group: 'X' }]);
    expect(R[0].faces).toBeGreaterThan(0); expect(R[1].warning).toMatch(/names no part/);
  });
  it('absent is byte-identical; on, the World and the rig pack carry the cells', async () => {
    const plain = await WORLD_KINDS.layered.resolve(m, { title: 't' });
    expect(JSON.stringify(await WORLD_KINDS.layered.resolve({ ...m, fieldPaint: [] }, { title: 't' }))).toBe(JSON.stringify(plain));
    const fieldPaint = [{ part: 'torso', chart: 'ring', shape: 'circle', at: [0.5, 0.6], size: [0.3, 0.3], group: 'Emblem', color: '#d9b25a' }];
    const painted = await WORLD_KINDS.layered.resolve({ ...m, fieldPaint }, { title: 't' });
    expect(painted.faces.length).toBeGreaterThan(plain.faces.length);
    const faceCount = (s) => s.figures.body.parts.reduce((t, P) => t + (P?.faces ?? 0), 0);
    expect(faceCount(painted)).toBeGreaterThan(faceCount(plain));
    for (const P of painted.figures.body.parts) if (P) { const w = new Float32Array(new Uint8Array(Buffer.from(P.wgt, 'base64')).buffer); for (let i = 0; i < w.length; i += 4) expect(w[i] + w[i + 1] + w[i + 2] + w[i + 3]).toBeCloseTo(1, 5); }
    // the emblem's own colour is on the faces (its studio shade lies between its colour and black)
    const gold = painted.faces.filter((f) => !plain.faces.some((g) => g.fill === f.fill)).length;
    expect(gold).toBeGreaterThan(0);
  }, 120000);
  it('with the bake, a cell bakes under its own group\'s finish, in the World and the pack', async () => {
    const fieldPaint = [{ part: 'torso', chart: 'ring', shape: 'circle', at: [0.5, 0.6], size: [0.3, 0.3], group: 'Emblem', color: '#d9b25a' }];
    const as = (finish) => WORLD_KINDS.layered.resolve({ ...m, fieldPaint, bake: { finish: { Emblem: finish } } }, { title: 't' });
    const metal = await as('metal'), cloth = await as('cloth');
    // the emblem is the only group whose finish differs: under the face's finish (Top's) the two would be one
    expect(JSON.stringify(metal.faces)).not.toBe(JSON.stringify(cloth.faces));
    expect(metal.figures.body.parts.map((P) => P?.col)).not.toEqual(cloth.figures.body.parts.map((P) => P?.col));
    expect(metal.faces.length).toBe(cloth.faces.length);
  }, 120000);
  it('a mark paints the chest whatever is worn on it: the torso and every layer over it (a suffix)', () => {
    // (a hero in an outfit build: its top a layer worn over the torso, `top_torso`)
    const dressed = planLayered(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', outfit: { type: 'outfit', style: 'casual' } }) })).mesh;
    const worn = Object.keys(dressed.parts).filter((n) => n.endsWith('_torso'));
    expect(worn.length).toBeGreaterThan(0);
    const R = fieldPaintReadout(dressed, [{ part: ['torso', '*_torso'], chart: 'front', shape: { path: RING }, at: [0.5, 0.62], size: 0.34, group: 'Emblem' }]);
    expect([R[0].parts, R[0].faces > 0]).toEqual([1 + worn.length, true]);
    // the worn layer is painted, not only the skin under it
    const fp = fieldPaintOf(dressed, [{ part: '*_torso', chart: 'front', shape: { path: RING }, at: [0.5, 0.62], size: 0.34, group: 'Emblem' }]);
    expect(dressed.faces.some((t, fi) => worn.includes(dressed.provenance[t[0]].part) && fp.cut(fi)?.some((c) => c.group === 'Emblem'))).toBe(true);
    expect(validateFieldPaint([{ part: '*', shape: 'star', group: 'E' }])[0]).toMatch(/a suffix starting '\*'/);
  });
  it('the mint refuses bad field paint by name', async () => {
    await expect(createLayeredHandler({ recipe: { parts: {} }, fieldPaint: [{ part: 'x', group: 'Y', shape: 'blob' }] })).rejects.toThrow(/fieldPaint refused:\n - fieldPaint\[0\]\.shape/);
  });
});
