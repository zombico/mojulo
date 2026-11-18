import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeableFigure, mergedFigureScript, oneDrawFigure, oneDrawScript, farFigureScript } from './merged-figure.js';
import { suitShadowBlock } from './suit-shadows.js';
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


// ONE DRAW A LIT FIGURE: a layered body (painted, lit, a face's morphs on some parts) keeps its bone meshes, hidden, as the
// bones every reader poses and reads, and draws their corners as one skinned mesh a material.
describe('one draw a lit figure', () => {
  it('a layered rig may be; one whose bones or parts are read on their own may not', () => {
    const P = { ...person(), paintTex: { url: 'x' }, face: { targets: [] }, cast: {} };
    expect(oneDrawFigure(P)).toBe(true);
    expect(oneDrawFigure({ ...P, skin: true })).toBe(false);
    expect(oneDrawFigure({ ...P, muzzle: { bone: 'pelvis' } })).toBe(false);
    expect(oneDrawFigure({ ...P, bones: [...P.bones, { id: 'shield' }] })).toBe(false);
    expect(oneDrawFigure({ ...P, parts: [{ ...P.parts[0], metal: 'AA==' }, P.parts[1]] })).toBe(false);
    expect(oneDrawFigure({ ...P, parts: [P.parts[0], null] })).toBe(false);   // (one part: nothing to merge)
  });

  it('the page carries it only for a figure the world marked', () => {
    const ent = [{ id: 'hero', body: { type: 'figure-rig', figure: 'p' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const figs = (mark) => ({ p: { ...person(), paintTex: { url: 'x' }, ...(mark ? { oneDraw: true } : {}) } });
    expect(controllableChannelScript(ent, null, figs(true))).toContain('if (fig.oneDraw) __oneDraw(fig, group, boneMeshes);');
    expect(controllableChannelScript(ent, null, figs(false))).not.toContain('__oneDraw');
    expect(controllableChannelScript(ent, null, figs(true), { toonInk: { width: 1 } })).not.toContain('__oneDraw');
  });

  it('draws every part but a morphing one in one skinned mesh, each corner where its bone mesh put it', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const oneDraw = new Function('THREE', `${oneDrawScript()}\nreturn __oneDraw;`)(THREE);
    const group = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const tri = (dz, normals) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, dz, 1, 0, dz, 0, 1, dz]), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]), 3, true));
      // (a lit read's normals as bytes on one part, as floats on another)
      g.setAttribute('normal', normals === 'bytes' ? new THREE.BufferAttribute(new Int8Array([0, 0, 127, 0, 0, 127, 0, 0, 127]), 3, true) : new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
      if (normals === 'bytes') g.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
      const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; group.add(m); return m;
    };
    const face = tri(2, 'floats'); face.morphTargetInfluences = [0];
    const bm = [tri(0, 'bytes'), tri(1, 'floats'), face];
    group.userData.rigFig = { boneMeshes: bm };
    oneDraw({ figH: 1.7 }, group, bm);
    const rf = group.userData.rigFig, skin = rf.skin, geo = skin.geometry;
    expect(skin.isSkinnedMesh).toBe(true);
    expect(rf.merged).toBe(true);
    expect(bm.map((m) => m.visible)).toEqual([false, false, true]);   // (the face's own mesh still drawn)
    expect(geo.getAttribute('position').count).toBe(6);
    expect(geo.index.count).toBe(6);
    expect(geo.getAttribute('normal').array[2]).toBeCloseTo(1, 2);
    expect(Array.from(geo.getAttribute('skinIndex').array).filter((_, i) => i % 4 === 0)).toEqual([0, 0, 0, 1, 1, 1]);
    // posed: the sync moves bone 1's mesh up and turns it; its corners in the skin go with it
    bm[1].matrix.makeRotationZ(Math.PI / 2).setPosition(0, 0, 0.5);
    group.updateMatrixWorld(true); skin.skeleton.update();
    const v = skin.applyBoneTransform(4, new THREE.Vector3().fromBufferAttribute(geo.getAttribute('position'), 4));
    const want = new THREE.Vector3(1, 0, 1).applyMatrix4(bm[1].matrix);
    expect([v.x, v.y, v.z].map((x) => +x.toFixed(4))).toEqual([want.x, want.y, want.z].map((x) => +x.toFixed(4)));
  });
});

describe('a body\'s contact pool at its feet', () => {
  it('sits at the feet without a probe through the scene; without it, the probe as it was', () => {
    const feet = suitShadowBlock({ r: 0.5, alpha: 0.4, fade: 1.5, color: [0, 0, 0], feet: true });
    expect(feet).toContain('const zc = p[2];');
    expect(feet).not.toContain('const own = __bodySet();');
    const probe = suitShadowBlock({ r: 12, alpha: 0.45, fade: 55, color: [0, 0, 0] });
    expect(probe).toContain('const zc = __shProbe(own, p[0], p[1], p[2] + 2);');
    expect(probe).toContain('zc + 0.4');
  });
});

// FAR FIGURES: past its far distance a figure shows its far twin (the same bones, baked coarse), posed from its bones.
describe('far figures', () => {
  it('the page carries it only for a figure with a far twin', () => {
    const ent = [{ id: 'g', body: { type: 'figure-rig', figure: 'p' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const figs = (far) => ({ p: { ...person(), ...(far ? { far: 'p@far', farAt: 24 } : {}) }, ...(far ? { 'p@far': person() } : {}) });
    expect(controllableChannelScript(ent, null, figs(true))).toContain('__farFrame();');
    expect(controllableChannelScript(ent, null, figs(false))).not.toContain('__farFrame');
  });

  it('shows the twin past the distance (two metres\' grace back), posed from the figure\'s bones, only while the body shows', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const bone = () => { const m = new THREE.Mesh(new THREE.BufferGeometry()); m.matrixAutoUpdate = false; return m; };
    const g = new THREE.Group(), main = [bone(), bone()], skin = new THREE.Mesh(new THREE.BufferGeometry());
    g.userData.rigFig = { fig: { far: 'p@far', farAt: 24 }, boneMeshes: main, skin, skins: [skin] };
    let built = 0;
    const make = () => { built++; const G = new THREE.Group(), B = [bone(), bone()]; for (const b of B) G.add(b); G.userData.rigFig = { boneMeshes: B }; return G; };
    const world = { byId: { g: { transform: { pos: [0, 0, 0] }, body: {} } } }, camera = new THREE.PerspectiveCamera();
    const farFrame = new Function('THREE', '__bodies', '__FIG', '__makeRigGroup', '__world', 'camera', `${farFigureScript()}\nreturn __farFrame;`)(THREE, { g }, { 'p@far': {} }, make, world, camera);
    const rf = g.userData.rigFig;
    camera.position.set(10, 0, 0); farFrame();
    expect(built).toBe(0); expect(skin.visible).toBe(true);                 // near: as it was, no twin built
    main[1].matrix.makeTranslation(1, 2, 3);
    camera.position.set(30, 0, 0); farFrame();
    expect(built).toBe(1); expect(skin.visible).toBe(false); expect(rf.farG.visible).toBe(true);
    expect(rf.farG.userData.rigFig.boneMeshes[1].matrix.equals(main[1].matrix)).toBe(true);
    camera.position.set(23, 0, 0); farFrame();
    expect(rf.farG.visible).toBe(true);                                      // inside the grace: still far
    g.visible = false; farFrame();
    expect(rf.farG.visible).toBe(false);                                     // the body hidden: its twin too
    g.visible = true; camera.position.set(20, 0, 0); farFrame();
    expect(rf.farG.visible).toBe(false); expect(skin.visible).toBe(true); expect(built).toBe(1);
  });
});

// THE PILOT ALONE CASTS (shadows.actors 'pilot'): the pilot into the live map, every other body a pool at its feet.
describe('the pilot alone casts', () => {
  it('the page keeps the others\' pools, skips the pilot\'s, and takes the others out of the map; asked for every body, none of it', () => {
    const ent = [{ id: 'hero', pilotable: true, body: { type: 'figure-rig', figure: 'p' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }, { id: 'g', body: { type: 'figure-rig', figure: 'p' }, rule: { type: 'walk' }, transform: { pos: [3, 0, 0], heading: 0 } }];
    const figs = { p: person() };
    const pilot = controllableChannelScript(ent, null, figs, { shadows: { actors: 'pilot', hour: true, feet: true, r: 0.5 } });
    expect(pilot).toContain('__updateSuitShadows(); __pilotCasts();');
    expect(pilot).toContain("if (e.id === __world.pilotId) { const ps = __suitShadows[e.id];");
    expect(pilot).toContain('mesh.castShadow = true;');
    const all = controllableChannelScript(ent, null, figs, { shadows: { actors: true, hour: true } });
    expect(all).not.toContain('__pilotCasts');
    expect(all).not.toContain('__updateSuitShadows');
  });
});
