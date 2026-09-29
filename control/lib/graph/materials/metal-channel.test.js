import { describe, it, expect } from 'vitest';
import { resolveMaterial, validateMaterialRef, tagFacesWithMaterial, toolpathAngle, MATERIALS } from '../polygonizer/materials.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { metalChannelInputs } from '../scene/channels/metal.js';

const quad = (o = [0, 0, 0]) => ({ corners: [[o[0], o[1], o[2]], [o[0] + 2, o[1], o[2]], [o[0] + 2, o[1] + 0.5, o[2]], [o[0], o[1] + 0.5, o[2]]], fill: '#888888' });
const rotZ = (a) => (p) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];

describe('metal surfaces through the material shelf (metal-surfaces S2)', () => {
  it('resolveMaterial takes a metal spec as a shelf row carrying the surface; old names are untouched', () => {
    const row = resolveMaterial({ metal: 'stainless', finish: 'brushed' });
    expect(row.metal).toBe(1); expect(row.surface.metal).toBe('stainless');
    expect(resolveMaterial('steel')).toBe(MATERIALS.steel); expect(resolveMaterial({ preset: 'gold', metal: 1 }).surface).toBeUndefined();
    expect(resolveMaterial({ metal: 'unobtainium' })).toBe(MATERIALS.steel);   // forgiving, like any typo …
    expect(validateMaterialRef({ metal: 'unobtainium' })).toMatch(/metal surface: unknown metal/);   // … and loud at the gate
    expect(validateMaterialRef({ metal: 'zinc', finish: 'spangle' })).toBeNull();
  });
  it('tags faces with the surface key, film thickness, a face-relative tangent and pbr — no white spec lobe', () => {
    const [f] = tagFacesWithMaterial([quad()], resolveMaterial({ metal: 'titanium', film: { anodize: 25 }, along: 'y' }));
    expect(JSON.parse(f.metal.s).metal).toBe('titanium'); expect(f.metal.d).toBe(49); expect(f.pbr[0]).toBe(1); expect(f.spec).toBeUndefined();
    expect(Math.abs(Math.abs(f.metal.ta) - Math.PI / 2)).toBeLessThan(1e-3);   // y is a quarter turn from the first edge (x)
  });
  it('the tangent rides the corners: a posed part keeps its toolpath (rebuilt from the final corners)', () => {
    const [f] = tagFacesWithMaterial([quad()], resolveMaterial({ metal: 'steel', finish: 'polished', along: 'x' }));
    const posed = { ...f, corners: f.corners.map(rotZ(Math.PI / 3)) };
    const m = faceListToMesh([posed], { decollide: false }); const t = [...m.mets.slice(0, 3)]; expect(m.mets.length).toBe(6 * 8);
    expect(t[0]).toBeCloseTo(Math.cos(Math.PI / 3), 4); expect(t[1]).toBeCloseTo(Math.sin(Math.PI / 3), 4);
  });
  it("'around' is circumferential about the part's z; 'auto' follows the longest edge", () => {
    const side = [[1, 0, 0], [1, 0.1, 0], [1, 0.1, 1], [1, 0, 1]];   // a lathe-like strip at x = 1: around = +y
    expect(Math.abs(toolpathAngle(side, 'around'))).toBeLessThan(1e-6);
    expect(Math.abs(Math.abs(toolpathAngle(side, 'auto')) - Math.PI / 2)).toBeLessThan(1e-6);   // longest edge is z
  });
  it('packs a slot per surface; untagged faces in a metal mesh pack −1; no metal → no key', () => {
    const a = tagFacesWithMaterial([quad()], resolveMaterial({ metal: 'gold' }));
    const b = tagFacesWithMaterial([quad([0, 1, 0])], resolveMaterial({ metal: 'copper', film: { age: 2 } }));
    const m = faceListToMesh([...a, ...b, quad([0, 2, 0])], { decollide: false });
    expect(m.metSurfaces.length).toBe(2); const slots = []; for (let i = 3; i < m.mets.length; i += 8 * 6) slots.push(m.mets[i]);
    expect(new Set(slots)).toEqual(new Set([0, 1, -1]));
    expect(faceListToMesh([quad()], { decollide: false }).mets).toBeUndefined();
  });
});

describe('the metal channel on the World page (metal-surfaces S3)', () => {
  const metalFaces = () => tagFacesWithMaterial([quad()], resolveMaterial({ metal: 'stainless', finish: 'brushed' })).map((f) => ({ ...f, group: 'part' }));
  it('emits only when a group carries metal faces', () => {
    const plain = emitThreeWorld({ faces: [quad()] }); expect(plain).not.toMatch(/metal channel/); expect(plain).not.toMatch(/aMetT/);
    const html = emitThreeWorld({ faces: metalFaces() }); expect(html).toMatch(/metal channel \(metal surfaces\)/); expect(html).toMatch(/__mojMetal/);
  });
  it('one lookup row block per metal used: a bare metal 1 row, a film metal 64', () => {
    const ins = metalChannelInputs(['{"metal":"gold","finish":"polished","along":"auto","seed":0}', '{"metal":"titanium","finish":"polished","along":"auto","film":{"anodize":25},"seed":0}']);
    expect(ins.lut.h).toBe(65); expect(ins.surfaces[1].B.slice(0, 2)).toEqual([1, 64]);
  });
  it("tints the studio from an atmosphere sky's zenith and horizon, keeping the studio's brightness", () => {
    const k = ['{"metal":"steel","finish":"polished","along":"auto","seed":0}'];
    const plain = metalChannelInputs(k), warm = metalChannelInputs(k, { sky: { zenith: [0.9, 0.6, 0.3], horizon: [1, 0.8, 0.6] } });
    expect(warm.zen[0]).toBeGreaterThan(warm.zen[2]); const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    expect(L(warm.zen)).toBeCloseTo(L(plain.zen), 3);
  });
});

describe('metal surfaces on parts (metal-surfaces S4)', () => {
  it('a lathe turns: its toolpath circles its own axis unless the spec names one', async () => {
    const { latheToFaces } = await import('../polygonizer/lathe-faces.js');
    const spec = { axisFrom: { x: 5, y: 0, z: 0 }, axisTo: { x: 5, y: 4, z: 0 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };   // a lathe lying along y, off the origin
    const faces = latheToFaces(spec, { material: { metal: 'aluminium' } }).filter((f) => f.metal);
    const m = faceListToMesh(faces, { decollide: false });
    let worst = 0; for (let i = 0; i < m.mets.length; i += 8) worst = Math.max(worst, Math.abs(m.mets[i + 1]));   // a tangent circling a y axis has no y part
    expect(worst).toBeLessThan(1e-3);
    const along = latheToFaces(spec, { material: { metal: 'aluminium', along: 'y' } }).filter((f) => f.metal);
    const ma = faceListToMesh(along, { decollide: false }); expect(Math.abs(ma.mets[1])).toBeGreaterThan(0.9);
  });
  it('a code program face may name a metal surface, and a bad one is refused', async () => {
    const { expandWorkbenchProgram } = await import('../worlds/workbench-program.js');
    const ok = expandWorkbenchProgram({ kind: 'workbench', program: { source: "return [{ corners: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], material: { metal: 'copper', film: { age: 5 } } }];" } });
    expect(JSON.parse(ok.faces[0].metal.s).metal).toBe('copper');
    expect(() => expandWorkbenchProgram({ kind: 'workbench', program: { source: "return [{ corners: [[0,0,0],[1,0,0],[1,1,0]], material: { metal: 'adamantium' } }];" } })).toThrow(/face\[0\]: metal surface: unknown metal/);
  });
  it('a workbench recipe with a metal material mints; a typo is refused at mint', async () => {
    const { planWorkbench } = await import('../worlds/workbench.js');
    const lathe = (material) => ({ lathes: [{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 3 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }], material }] });
    expect(() => planWorkbench({ kind: 'workbench', ...lathe({ metal: 'stainless', finish: 'brushed' }) })).not.toThrow();
    expect(() => planWorkbench({ kind: 'workbench', ...lathe({ metal: 'stainless', finish: 'satin' }) })).toThrow(/unknown finish/);
  });
});
