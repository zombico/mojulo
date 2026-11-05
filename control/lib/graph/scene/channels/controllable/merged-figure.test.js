import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeableFigure, mergedFigureScript } from './merged-figure.js';
import { pageFigures, controllableChannelScript } from './index.js';

// ONE DRAW A FIGURE: a plain rigid rig is drawn as one skinned mesh, each part's corners bound wholly to its own bone, so
// the frame, the shadow map and the occlusion prepass each draw it once instead of once a part.

const f32 = (a) => Buffer.from(Float32Array.from(a).buffer).toString('base64');
const u8 = (a) => Buffer.from(Uint8Array.from(a).buffer).toString('base64');
const SOUP = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const COL = [200, 120, 40, 7, 64, 255, 0, 33, 180, 7, 64, 255, 90, 90, 90, 0, 33, 180];
const clip = { k: 2, b: [0, 0, 0, 1, 0.1, 0.2, 1.5, 0.7071, 0, 0, 0.7071, -0.3, 0.25, 1.4, 0, 0, 0, 1, 0.1, 0.2, 1.5, 0.7071, 0, 0, 0.7071, -0.3, 0.25, 1.4] };
const part = (dz) => ({ pos: f32(SOUP.map((v, i) => (i % 3 === 2 ? v + dz : v))), col: u8(COL), faces: 2, jnt: u8(Array(24).fill(0)), wgt: f32(Array(24).fill(0.25)) });
// a layered person of two bones, as the page reads it (pageFigures: its parts indexed on a uint16 grid)
const person = () => pageFigures({ p: { rig: true, layered: true, bones: [{ id: 'pelvis', head: [0, 0, 0], tail: [0, 0, 1] }, { id: 'spine', head: [0, 0, 1], tail: [0, 0, 2] }], parts: [part(0), part(1)], clips: { idle: clip }, figH: 1.7 } }).figs.p;

describe('which figures are drawn as one', () => {
  it('a plain rigid rig is; one whose bones are read on their own is not', () => {
    const P = person();
    expect(mergeableFigure(P)).toBe(true);
    expect(mergeableFigure({ ...P, skin: true })).toBe(false);
    expect(mergeableFigure({ ...P, paintTex: { url: 'x' } })).toBe(false);
    expect(mergeableFigure({ ...P, face: { targets: [] } })).toBe(false);
    expect(mergeableFigure({ ...P, muzzle: { bone: 'pelvis' } })).toBe(false);
    expect(mergeableFigure({ ...P, bones: [...P.bones, { id: 'weapon_rifle' }] })).toBe(false);
    expect(mergeableFigure({ ...P, parts: [{ ...P.parts[0], spec8: 'AA==' }, P.parts[1]] })).toBe(false);
    // (a part still in the float soup, a vehicle's: kept as it is)
    expect(mergeableFigure({ rig: true, bones: [{ id: 'a' }], parts: [{ pos: f32(SOUP), col: u8(COL) }] })).toBe(false);
  });

  it('the page builds it merged only where a part\'s own mesh is never read', () => {
    const ent = [{ id: 'hero', body: { type: 'figure-rig', figure: 'p' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const figs = { p: { rig: true, layered: true, bones: [{ id: 'pelvis', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [part(0)], clips: { idle: clip }, figH: 1.7 } };
    expect(controllableChannelScript(ent, null, figs)).toContain('if (__mergeable(fig)) return __makeMergedGroup(fig, b, group);');
    expect(controllableChannelScript(ent, null, figs, { toonInk: { width: 1 } })).not.toContain('__makeMergedGroup');
    expect(controllableChannelScript(ent, null, figs, { xr: true })).not.toContain('__makeMergedGroup');
    // (a bank with nothing to merge: not a byte of it)
    const car = { c: { rig: true, bones: [{ id: 'a' }], parts: [{ pos: f32(SOUP), col: u8(COL) }], clips: { forward: clip } } };
    expect(controllableChannelScript([{ ...ent[0], body: { type: 'figure-rig', figure: 'c' } }], null, car)).not.toContain('__mergeable');
  });
});

describe('the merged mesh', () => {
  it('holds every part\'s corners in its own bone\'s frame, bound wholly to that bone, with the same triangles', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const dec = (T) => (s) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
    const scene = new THREE.Scene();
    const make = new Function('THREE', 'scene', '__decodeU16', '__decodeU32', 'decodeU8', `${mergedFigureScript()}\nreturn __makeMergedGroup;`)(THREE, scene, dec(Uint16Array), dec(Uint32Array), dec(Uint8Array));
    const P = person(), g = make(P, {}, new THREE.Group());
    const mesh = g.userData.rigFig.skin, geo = mesh.geometry;
    expect(mesh.isSkinnedMesh).toBe(true);
    expect(g.userData.rigFig).toMatchObject({ merged: true });
    expect(g.userData.rigFig.boneMeshes).toHaveLength(2);
    // its corners: each part's, in order; its triangles each part's, offset to where its corners start
    expect(geo.getAttribute('position').count).toBe(P.parts[0].n + P.parts[1].n);
    expect(geo.index.count).toBe(12);
    const at = (i) => [0, 1, 2].map((a) => geo.getAttribute('position').array[i * 3 + a]);
    const second = P.parts[0].n;
    expect(at(second)[2]).toBeCloseTo(at(0)[2] + 1, 3);
    // bound wholly to its bone
    const si = geo.getAttribute('skinIndex').array, sw = geo.getAttribute('skinWeight').array;
    expect([si[0], sw[0], sw[1]]).toEqual([0, 1, 0]);
    expect([si[second * 4], sw[second * 4]]).toEqual([1, 1]);
    expect(Math.min(...Array.from(geo.index.array).slice(6))).toBe(second);
    // culled as a whole, by a sphere round its height over its feet
    expect(mesh.frustumCulled).toBe(true);
    expect(mesh.boundingSphere.radius).toBeGreaterThan(P.figH / 2);
  });
});
