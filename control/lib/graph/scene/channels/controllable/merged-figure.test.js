import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeableFigure, mergedFigureScript, keptPart } from './merged-figure.js';
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
    // (a face keeps only its own part: the one carrying its morphs; a morph with no face to drive it keeps the whole)
    expect(mergeableFigure({ ...P, face: { targets: [] } })).toBe(true);
    expect(mergeableFigure({ ...P, face: { targets: [] }, parts: [{ ...P.parts[0], morph: { i: 'AA==' } }, P.parts[1]] })).toBe(true);
    expect(mergeableFigure({ ...P, parts: [{ ...P.parts[0], morph: { i: 'AA==' } }, P.parts[1]] })).toBe(false);
    expect([keptPart({ ...P.parts[0], morph: { i: 'AA==' } }), keptPart(P.parts[1]), keptPart(null)]).toEqual([true, false, false]);
    expect(mergeableFigure({ ...P, muzzle: { bone: 'pelvis' } })).toBe(false);
    expect(mergeableFigure({ ...P, bones: [...P.bones, { id: 'weapon_rifle' }] })).toBe(false);
    expect(mergeableFigure({ ...P, parts: [{ ...P.parts[0], spec8: 'AA==' }, P.parts[1]] })).toBe(false);
    // (a part still in the float soup, a vehicle's: kept as it is)
    expect(mergeableFigure({ rig: true, bones: [{ id: 'a' }], parts: [{ pos: f32(SOUP), col: u8(COL) }] })).toBe(false);
  });

  it('the page builds it merged only where a part\'s own mesh is never read', () => {
    const ent = [{ id: 'hero', body: { type: 'figure-rig', figure: 'p' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const figs = { p: { rig: true, layered: true, bones: [{ id: 'pelvis', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [part(0)], clips: { idle: clip }, figH: 1.7 } };
    expect(controllableChannelScript(ent, null, figs)).toContain('if (__mergeable(fig)) return __makeMergedGroup(fig, b, group, __part);');
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

describe('the pose grade cut in', () => {
  it('a close shot on a figure shows its pose twin on the same bones; off the shot, its play grade', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const dec = (T) => (s) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
    const P = person(), twin = person();
    const __FIG = { p: { ...P, pose: 'p@pose' }, 'p@pose': twin }, __bodies = {}, __world = { camera: { rule: { type: 'follow' } } }, window = {};
    const src = `${mergedFigureScript({ pose: true })}\nreturn { make: __makeMergedGroup, frame: __poseFrame };`;
    const api = new Function('THREE', 'scene', '__decodeU16', '__decodeU32', 'decodeU8', '__FIG', '__bodies', '__world', 'window', src)(THREE, new THREE.Scene(), dec(Uint16Array), dec(Uint32Array), dec(Uint8Array), __FIG, __bodies, __world, window);
    const g = __bodies.hero = api.make(__FIG.p, {}, new THREE.Group()), rf = g.userData.rigFig;
    api.frame();
    expect(rf.poseSkin).toBeUndefined();   // (built only when wanted)
    __world.camera.rule = { type: 'shot', frame: 'close', on: ['hero'] };
    api.frame();
    expect([rf.poseSkin.visible, rf.skin.visible]).toEqual([true, false]);
    expect(rf.poseSkin.skeleton.bones).toEqual(rf.skin.skeleton.bones);   // (the same bones: the clips never change hands)
    __world.camera.rule = { type: 'shot', frame: 'wide', on: ['hero'] };
    api.frame();
    expect([rf.poseSkin.visible, rf.skin.visible]).toEqual([false, true]);
    // (the battle's film cuts it in the same way)
    window.__mojFilmPose = ['hero'];
    api.frame();
    expect(rf.poseSkin.visible).toBe(true);
  });

  it('the page carries the cut-in only where a figure has a pose twin', () => {
    const ent = [{ id: 'hero', body: { type: 'figure-rig', figure: 'p' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const figs = (pose) => ({ p: { rig: true, layered: true, bones: [{ id: 'pelvis', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [part(0)], clips: { idle: clip }, figH: 1.7, ...(pose ? { pose: 'q' } : {}) }, ...(pose ? { q: { rig: true, layered: true, bones: [{ id: 'pelvis', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [part(0)], clips: { idle: clip }, figH: 1.7 } } : {}) });
    expect(controllableChannelScript(ent, null, figs(true))).toContain('__poseFrame();');
    expect(controllableChannelScript(ent, null, figs(false))).not.toContain('__poseFrame');
  });
});


describe('a person with a face', () => {
  it('is merged but for its face\'s part, which keeps its own mesh in its bone\'s place on the same skeleton', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const dec = (T) => (s) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
    const make = new Function('THREE', 'scene', '__decodeU16', '__decodeU32', 'decodeU8', `${mergedFigureScript()}\nreturn __makeMergedGroup;`)(THREE, new THREE.Scene(), dec(Uint16Array), dec(Uint32Array), dec(Uint8Array));
    const P0 = person(), P = { ...P0, face: { targets: ['smile'] }, parts: [P0.parts[0], { ...P0.parts[1], morph: { i: 'AA==' } }] };
    // the page's part builder, as __makeRigGroup hands it: a mesh of its own, in the group
    const built = [];
    const own = (bn, bi) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()); m.matrixAutoUpdate = false; built.push(bi); g0.add(m); return m; };
    const g0 = new THREE.Group(), g = make(P, {}, g0, own);
    const R = g.userData.rigFig;
    expect(built).toEqual([1]);
    expect(R.boneMeshes[0].isBone).toBe(true);
    expect(R.boneMeshes[1].isMesh).toBe(true);
    // the skinned mesh holds only the merged part's corners; its skeleton is every slot, the kept mesh in its own
    expect(R.skin.geometry.getAttribute('position').count).toBe(P.parts[0].n);
    expect(R.skin.skeleton.bones[1]).toBe(R.boneMeshes[1]);
  });
});
