/**
 * The live light (live-light.plan.md): its settings, its math on stubs, and what it adds to the page. Claims under test:
 *   · absent, every page is as it was: faces carrying a sun share emit the same bytes as faces without one, and no
 *     live-light code is written;
 *   · the receive patch darkens a fragment by its sun share: a lit vertex darkens, a baked-shadowed one does not;
 *   · a stage's sun bake writes each corner's share beside the colour it always made, and only when asked;
 *   · actors: the static solids receive and never cast, what moves casts, the box follows the pilot (the seats' centre);
 *   · the hour: the static map's light has its autoUpdate off and an hour pass before every render;
 *   · occlusion: on a depth / normal stub a flat surface takes none and a step takes some; with creases, one prepass.
 * The pixels are in live-light.chrome.test.js.
 */
import { describe, expect, it } from 'vitest';

import { readLiveShadows, wantsSunShare, sunShare, liveShade, LIVE_SHADOW_KEYS, readOcclusion, OCCLUSION_DEFAULTS, occlusionKernel, occlusionAt, occlusionComposite } from './live-light.js';
import { emitThreeWorld } from './scene-three.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { bakeStageLight, assembleStageScene } from '../era/stage.js';
import { makeSunShadow } from '../era/sun.js';

const floor = (extra = {}) => ({ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#888888', ...extra });
const GROUPS = (page) => JSON.parse(page.match(/const GROUPS = (\[.*?\]);\n/s)[1]);
const ENT = [{ id: 'd', transform: { pos: [1, 1, 0], heading: 0 }, rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 0.6] } }];

describe('live light: the settings', () => {
  it('reads actors and hour, and nothing else asks for it', () => {
    for (const off of [undefined, null, true, {}, { cast: true }, { r: 12 }, { actors: false }]) expect(readLiveShadows(off)).toBeNull();
    expect(readLiveShadows({ actors: true })).toEqual({ actors: true, hour: false });
    expect(readLiveShadows({ hour: true, alpha: 0.5 })).toEqual({ actors: false, hour: true });
    expect(wantsSunShare({ actors: true })).toBe(true);
    expect(wantsSunShare({ cast: true })).toBe(false);
  });
  it('refuses what it cannot draw, saying why', () => {
    expect(() => readLiveShadows({ actors: 'yes' })).toThrow(/shadows\.actors is true or false/);
    expect(() => readLiveShadows({ hour: 1 })).toThrow(/shadows\.hour is true or false/);
    expect(() => readLiveShadows({ cast: true, actors: true })).toThrow(/not both/);
  });
  it('the page keys are the cast channel\'s and the live light\'s', () => {
    for (const k of ['cast', 'actors', 'hour', 'alpha', 'span', 'mapSize', 'bias', 'fitMin']) expect(LIVE_SHADOW_KEYS).toContain(k);
  });
});

describe('live light: the math on a stub', () => {
  const shoulder = (v) => v;   // a linear stub: the share is then the sun's part of the luminance
  it('the sun share is the sun\'s part of the finished light, 0 where it gives none', () => {
    expect(sunShare([0.8, 0.8, 0.8], [0.2, 0.2, 0.2], shoulder)).toBe(0.75);
    expect(sunShare([0.3, 0.3, 0.3], [0.3, 0.3, 0.3], shoulder)).toBe(0);
    expect(sunShare([0, 0, 0], [0, 0, 0], shoulder)).toBe(0);
  });
  it('the receive patch: a lit vertex darkens by its share, a baked-shadowed one does not, an unshadowed one is as it was', () => {
    const rgb = [0.8, 0.6, 0.4];
    expect(liveShade(rgb, 0.75, 0).map((v) => +v.toFixed(4))).toEqual([0.2, 0.15, 0.1]);   // under the actor: the baked shade's level
    expect(liveShade(rgb, 0, 0)).toEqual(rgb);   // already in the baked shadow: never doubled
    expect(liveShade(rgb, 0.75, 1)).toEqual(rgb);   // out of the actor's shadow: untouched
  });
});

describe('live light: the bake writes the share only when asked', () => {
  // the sun up and toward +x; a wall at x = 2 three metres high: the floor west of it is in its baked shadow
  const wall = { corners: [[2, -1, 0], [2, 5, 0], [2, 5, 3], [2, -1, 3]], normal: [-1, 0, 0], tint: [0.8, 0.8, 0.8] };
  const sun = (share) => ({ dir: [0.6, 0, 0.8], rgb: [1, 0.95, 0.85], gain: 1, bounce: [0.2, 0.18, 0.15], bounceGain: 0.2, shadow: makeSunShadow([wall], [0.6, 0, 0.8]), ...(share ? { share: true } : {}) });
  const west = { corners: [[0, 0, 0], [1.9, 0, 0], [1.9, 4, 0], [0, 4, 0]], normal: [0, 0, 1], tint: [0.8, 0.8, 0.8] };
  const east = { corners: [[3, 0, 0], [6, 0, 0], [6, 4, 0], [3, 4, 0]], normal: [0, 0, 1], tint: [0.8, 0.8, 0.8] };
  it('the colours are the same bytes; a lit corner carries its share, a baked-shadowed one none', () => {
    const plain = bakeStageLight([west, east], [], [0.2, 0.2, 0.25], undefined, sun(false));
    const shared = bakeStageLight([west, east], [], [0.2, 0.2, 0.25], undefined, sun(true));
    expect(shared.map(({ sunShare: _s, ...f }) => f)).toEqual(plain);
    expect(plain.some((f) => 'sunShare' in f)).toBe(false);
    const [w, e] = shared;
    expect(w.sunShare).toEqual([0, 0, 0, 0]);   // in the wall's baked shadow: nothing for an actor to take away
    expect(e.sunShare.every((s) => s > 0.4 && s < 1)).toBe(true);   // in the sun: most of its light is the sun's
  });
  it('a stage asks for it through the world\'s shadows, and keeps its own bake keys beside them', () => {
    const M = { kind: 'stage', kit: 'island-plaza', reference: 'island-noon', dress: false, rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 10, h: 4 }] };
    const plain = assembleStageScene(M, {}), live = assembleStageScene({ ...M, shadows: { actors: true, torch: 'soft' } }, { liveSun: true });
    expect(plain.faces.some((f) => 'sunShare' in f)).toBe(false);
    const shared = live.faces.filter((f) => f.sunShare !== undefined);
    expect(shared.length).toBeGreaterThan(plain.faces.length / 4);
    expect(shared.some((f) => (Array.isArray(f.sunShare) ? f.sunShare : [f.sunShare]).some((s) => s > 0.3))).toBe(true);
    expect(() => assembleStageScene({ ...M, shadows: { actors: true, glow: 1 } }, {})).toThrow(/shadows\.glow is not a setting/);
  });
});

describe('live light: the face mesh packs the share per vertex', () => {
  it('only when a face carries one; a face without it in that mesh takes 0', () => {
    expect(faceListToMesh([floor()]).suns).toBeUndefined();
    const m = faceListToMesh([floor({ sunShare: [1, 0.5, 0, 0.25] }), { ...floor(), corners: floor().corners.map(([x, y, z]) => [x + 9, y, z]) }]);
    expect(m.suns.length).toBe(m.positions.length / 3);
    expect([...m.suns.slice(0, 6)]).toEqual([1, 0.5, 0, 1, 0, 0.25]);   // the quad's two triangles, corner by corner
    expect([...m.suns.slice(6)].every((s) => s === 0)).toBe(true);
    const t = faceListToMesh([floor({ texture: 'k', uv: [[0, 0], [1, 0], [1, 1], [0, 1]], sunShare: 0.5 })]);
    expect([...t.textureGroups.k.suns]).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  });
});

describe('live light: the World page', () => {
  it('absent, a sun share is never read: the same bytes as a world without it, and no live code', () => {
    const shared = [floor({ sunShare: 0.6 })], plain = [floor()];
    for (const extra of [{}, { shadows: { cast: true } }, { shadows: true, entities: ENT, camera: { rule: 'follow', target: 'd' } }]) {
      expect(emitThreeWorld({ faces: shared, ...extra })).toBe(emitThreeWorld({ faces: plain, ...extra }));
    }
    const page = emitThreeWorld({ faces: shared, shadows: { cast: true } });
    for (const s of ['__mojHourPass', 'aSun', '__mojLight', 'CS_SUN']) expect(page).not.toContain(s);
  });

  it('actors: the share rides the group as aSun, the static world receives and never casts, the pilot casts and steers', () => {
    const page = emitThreeWorld({ faces: [floor({ sunShare: 0.6 })], shadows: { actors: true }, entities: ENT, camera: { rule: 'follow', target: 'd' } });
    expect(GROUPS(page)[0].sun).toBeTruthy();
    expect(page).toContain("if (grp.sun) geo.setAttribute('aSun'");
    expect(page).toContain('m.castShadow = false;   // the static world receives');
    expect(page).toContain('mesh.castShadow = true;');   // the controllable body casts
    expect(page).toContain('window.__mojCast.follow(__c[0], __c[1], __c[2], __r)');   // the pilot, or the seats' centre
    expect(page).not.toContain('__hrL');   // no hour map asked
    expect(page).not.toContain('__updateSuitShadows();');   // the blob gives way to the real shadow
    const renders = page.split('renderer.render(scene, camera)').length - 1;
    expect(page.split('__mojHourPass(); renderer.render(scene, camera)').length - 1).toBe(renders);
  });

  it('hour: its light draws only when armed; with actors both maps are read', () => {
    const page = emitThreeWorld({ faces: [floor()], shadows: { hour: true } });
    expect(page).toContain('__hrL.shadow.autoUpdate = false;');
    expect(page).toContain('float lit = csLit( hrMap, vHrCoord, hrBias, hrTexel );');
    expect(page).not.toContain('__csL');
    const both = emitThreeWorld({ faces: [floor()], shadows: { actors: true, hour: true } });
    expect(both).toContain('float lit = min( csLit( csMap, vCsCoord, csBias, csTexel ), csLit( hrMap, vHrCoord, hrBias, hrTexel ) );');
    expect(() => emitThreeWorld({ faces: [floor()], shadows: { cast: true, hour: true } })).toThrow(/not both/);
  });

  it('the actors\' box is 30 metres in the world\'s units unless the world names its span', () => {
    expect(emitThreeWorld({ faces: [floor()], shadows: { actors: true } })).toContain('"span":30');
    expect(emitThreeWorld({ faces: [floor()], shadows: { actors: true }, metersPerUnit: 3 })).toContain('"span":10,"unit":3');
    expect(emitThreeWorld({ faces: [floor()], shadows: { actors: true, span: 12 } })).toContain('"span":12');
  });
});

describe('live light: a world asks for it', () => {
  it('a stage on a geocube keeps the cube\'s bake shadows under a recipe\'s page-only shadows', async () => {
    const { withGeocube } = await import('../era/geocube.js');
    const cube = withGeocube({ kind: 'stage', geocube: 'gothic-night' }).shadows;
    expect(withGeocube({ kind: 'stage', geocube: 'gothic-night', shadows: { actors: true } }).shadows).toEqual({ ...cube, actors: true });
    // a recipe that names a bake key keeps its own, as it always did
    expect(withGeocube({ kind: 'stage', geocube: 'gothic-night', shadows: { torch: 'off' } }).shadows).toEqual({ torch: 'off' });
  });
  it('world-scene: the share is baked and the shadows carried only when asked', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const M = { kind: 'stage', kit: 'island-plaza', reference: 'island-noon', dress: false, rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 10, h: 4 }] };
    const plain = (await resolveWorldScene({ manifest: M, title: 't' })).payload;
    const live = (await resolveWorldScene({ manifest: { ...M, shadows: { actors: true } }, title: 't' })).payload;
    expect(plain.faces.some((f) => 'sunShare' in f)).toBe(false);
    expect(live.faces.some((f) => f.sunShare !== undefined)).toBe(true);
    expect(live.shadows).toEqual({ actors: true });
    const unshaded = (await resolveWorldScene({ manifest: { ...M, shadows: { actors: true } }, title: 't' }, { unshaded: true })).payload;
    expect(unshaded.faces.some((f) => 'sunShare' in f)).toBe(false);
    await expect(resolveWorldScene({ manifest: { ...M, shadows: { hour: 'noon' } }, title: 't' })).rejects.toThrow(/shadows\.hour is true or false/);
  });
});

describe('occlusion: the setting', () => {
  it('reads true as the defaults and an object over them; absent or false is off', () => {
    expect(readOcclusion(true)).toEqual({ ...OCCLUSION_DEFAULTS });
    expect(readOcclusion({ samples: 12 })).toEqual({ ...OCCLUSION_DEFAULTS, samples: 12 });
    for (const off of [undefined, null, false]) expect(readOcclusion(off)).toBeNull();
  });
  it('refuses what it cannot draw, naming the setting', () => {
    expect(() => readOcclusion('on')).toThrow(/occlusion is true or/);
    expect(() => readOcclusion({ radius: 1 })).toThrow(/occlusion\.radius is not a setting/);
    expect(() => readOcclusion({ strength: 0 })).toThrow(/occlusion\.strength/);
    expect(() => readOcclusion({ reach: 9 })).toThrow(/occlusion\.reach/);
    expect(() => readOcclusion({ samples: 4 })).toThrow(/occlusion\.samples/);
  });
});

describe('occlusion: the math on a depth / normal stub', () => {
  const res = [200, 200], fov = 1, kernel = occlusionKernel(10), N = () => [0, 0, -1];
  it('the kernel lies in the hemisphere over the normal, nearer the earlier', () => {
    expect(kernel).toHaveLength(10);
    for (const k of kernel) { expect(k[2]).toBeGreaterThan(0); expect(Math.hypot(...k)).toBeLessThanOrEqual(1.0001); }
    expect(Math.hypot(...kernel[0])).toBeLessThan(Math.hypot(...kernel[9]));
  });
  it('a flat surface facing the camera takes none; beside a nearer step it takes some, fading with the step\'s distance', () => {
    const flat = { res, fov, reach: 0.5, kernel, depth: () => 5, normal: N };
    expect(occlusionAt(flat, [100.5, 100.5])).toBe(0);
    const step = (dz) => ({ ...flat, depth: (q) => (q[0] >= 100 ? 5 - dz : 5) });
    // (a step half a metre nearer, the pixel two pixels from it: its contact)
    const near = occlusionAt(step(0.5), [98.5, 100.5]), far = occlusionAt(step(0.5), [40.5, 100.5]);
    expect(near).toBeGreaterThan(0.2);
    expect(far).toBe(0);
    expect(occlusionAt(step(0.5), [95.5, 100.5])).toBeLessThan(near);   // fading away from the step
    // a surface far in front (a silhouette, not a contact) occludes far less: no halo
    expect(occlusionAt(step(4), [98.5, 100.5])).toBeLessThan(near / 10);
    expect(occlusionAt({ ...flat, depth: () => 0 }, [100.5, 100.5])).toBe(0);   // the sky
  });
  it('the composite darkens by strength, faded by the fog', () => {
    expect(occlusionComposite(0.5, 0.6)).toBeCloseTo(0.3);
    expect(occlusionComposite(0.5, 0.6, 0)).toBe(0);
    expect(occlusionComposite(2, 1)).toBe(1);
  });
});

describe('occlusion: the World page', () => {
  const faces = [floor(), { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#8a7a5c' }];
  it('absent, the creases\' block is as it was, and nothing at all without creases', () => {
    expect(emitThreeWorld({ faces, occlusion: null })).toBe(emitThreeWorld({ faces }));
    expect(emitThreeWorld({ faces, creases: true, occlusion: false })).toBe(emitThreeWorld({ faces, creases: true }));
    expect(emitThreeWorld({ faces, creases: true })).not.toContain('__mojOcclusion');
  });
  it('alone or with the creases: one prepass into two targets, its pass and composite, before every render', () => {
    for (const extra of [{}, { creases: true }]) {
      const page = emitThreeWorld({ faces, occlusion: true, ...extra });
      expect(page).toContain('depthBuffer: true, count: 2 });');
      expect(page.split('renderer.setRenderTarget(__crRT)').length - 1).toBe(1);   // one prepass for both
      expect(page).toContain('uKern: { value: ' + JSON.stringify(occlusionKernel(OCCLUSION_DEFAULTS.samples)));
      expect(page).toContain('__aoQuad.renderOrder = 99998;');
      const renders = page.split('renderer.render(scene, camera)').length - 1;
      expect(page.split('__creasePrepass(); renderer.render(scene, camera)').length - 1).toBe(renders - 1);   // all but the prepass's own
      expect(page.includes('__crInkScene')).toBe(!!extra.creases);
    }
  });
  it('world-scene carries it only when asked, and the unshaded base drops it', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const sk = (manifest) => ({ manifest, title: 't' });
    expect((await resolveWorldScene(sk({ kind: 'floorplan' }))).payload.occlusion).toBeUndefined();
    expect((await resolveWorldScene(sk({ kind: 'floorplan', occlusion: true }))).payload.occlusion).toEqual({ ...OCCLUSION_DEFAULTS });
    expect((await resolveWorldScene(sk({ kind: 'floorplan', occlusion: true }), { unshaded: true })).payload.occlusion).toBeUndefined();
    await expect(resolveWorldScene(sk({ kind: 'floorplan', occlusion: { reach: 99 } }))).rejects.toThrow(/occlusion\.reach/);
  });
});
