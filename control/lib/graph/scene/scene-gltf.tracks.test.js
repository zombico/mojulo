// scene-gltf.tracks.test.js — the anime hero's CLIP TIMING and FACIAL TRACKS in the GLB (addRigClip, anime-face-tracks.js
// through world-kinds): every clip's times end at its designed duration (the skinned and the rigid clips alike), each
// clip carries a STEP `weights` channel on the skinned mesh whose sampler output is keys × targets and whose last time is
// the body's, the face-only `face:ambientBlink` follows the clips, and extras.face names the layer and the clips it plays
// over; `blink: false` drops the layer. A landmark hero and the head-none hero carry no duration and no face: every clip
// one second, no weights channel.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { FACE_TARGETS } from '../polygonizer/anime-face-rig.js';
import { validateRig, bindLayered, packLayeredRig } from '../polygonizer/station-loft-rig.js';
import { compileLayered } from '../polygonizer/station-loft.js';

const glbOf = (bytes) => { const jl = bytes.readUInt32LE(12); return { json: JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')), bin: bytes.subarray(28 + jl) }; };
const floats = (G, i) => { const a = G.json.accessors[i], bv = G.json.bufferViews[a.bufferView], o = (bv.byteOffset || 0) + (a.byteOffset || 0); return Array.from({ length: a.count * ({ SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type]) }, (_, k) => G.bin.readFloatLE(o + k * 4)); };
const payloadOf = async (manifest, opts = {}) => (await resolveWorldScene({ ref: 'glb-tracks', title: 'glb tracks', manifest }, opts)).payload;
const glb = async (manifest, { skinned = true, face = skinned } = {}) => glbOf(facesToGlb(await payloadOf(manifest, face ? { face: true } : {}), { generator: 'mojulo glb-tracks', clips: '_all', skinned }).bytes);
const f32 = (x) => Math.fround(x);
/** an animation's end: its first sampler's last time */
const G_end = (G, a) => G.json.accessors[a.samplers[0].input].max[0];

// the lowpoly anime hero with a door clip carrying its duration and a facial track
const CLIPS = { cheer: { seconds: 1.5, keys: [{ support: 'both', crouch: 0.1, face: { blink: 0.2, smile: 0.6, brow: 0.55 } }, { support: 'both', armR: { x: 0.3, y: 0.15, z: 0.94 }, elbowR: 'slight', face: ['happy', { open: 0.85 }] }] } };
const anime = (spec = {}) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'anime', register: 'lowpoly', expression: ['smile', { open: 0.3 }], clips: CLIPS, ...spec }) });
const SECONDS = { gesture: 1, idle: 4, walk: 1, wave: 2, cheer: 1.5 };

describe('the anime hero\'s clips in the GLB', () => {
  it('each clip over its designed duration with a STEP weights channel (keys × targets, ending with the body); the ambient layer after them', async () => {
    const G = await glb(anime());
    const mesh = G.json.meshes.findIndex((m) => m.extras?.face), node = G.json.nodes.findIndex((n) => n.mesh === mesh && n.skin !== undefined);
    expect(G.json.animations.map((a) => a.name)).toEqual([...Object.keys(SECONDS).map((c) => `body:${c}`), 'face:ambientBlink']);
    for (const [c, s] of Object.entries(SECONDS)) {
      const a = G.json.animations.find((x) => x.name === `body:${c}`);
      const body = a.channels.filter((ch) => ch.target.path !== 'weights'), weights = a.channels.filter((ch) => ch.target.path === 'weights');
      const bodyIn = G.json.accessors[a.samplers[body[0].sampler].input];
      expect(bodyIn.max[0], c).toBe(f32(s)); expect(floats(G, a.samplers[body[0].sampler].input).at(-1)).toBe(f32(s));
      expect(weights.length, c).toBe(1); expect(weights[0].target.node).toBe(node);
      const S = a.samplers[weights[0].sampler]; expect(S.interpolation).toBe('STEP');
      const tin = G.json.accessors[S.input], tout = G.json.accessors[S.output];
      expect(tout.count, c).toBe(tin.count * FACE_TARGETS.length); expect(tin.max[0]).toBe(bodyIn.max[0]); expect(tin.min[0]).toBe(0);
      const t = floats(G, S.input); expect(t.every((x, i) => i === 0 || x > t[i - 1]), c).toBe(true);
      const w = floats(G, S.output), K = FACE_TARGETS.length; expect(w.slice(0, K), `${c}: the loop closes on its first drawing`).toEqual(w.slice(-K));
    }
    // cheer: the squeeze, the half lid on the frame before the cheer (its mouth already open), the cheer shut, the half lid back
    const cheer = G.json.animations.find((x) => x.name === 'body:cheer'), wc = cheer.channels.find((ch) => ch.target.path === 'weights');
    const blinkOf = floats(G, cheer.samplers[wc.sampler].output).filter((_, k) => k % FACE_TARGETS.length === 0);
    expect(floats(G, cheer.samplers[wc.sampler].input).map((x) => Math.round(x * 30 * 100) / 100)).toEqual([0, 21.5, 22.5, 43.5, 45]);
    expect(blinkOf.map((x) => Math.round(x * 100) / 100)).toEqual([0.2, 0.5, 1, 0.5, 0.2]);
    // the ambient blink: one weights channel, twelve seconds, STEP
    const amb = G.json.animations.at(-1);
    expect(amb.channels).toEqual([{ sampler: 0, target: { node, path: 'weights' } }]); expect(amb.samplers[0].interpolation).toBe('STEP');
    expect(G.json.accessors[amb.samplers[0].input].max[0]).toBe(12);
    const F = G.json.meshes[mesh].extras.face;
    expect(F.ambientClip).toBe('face:ambientBlink'); expect(F.ambientOver).toEqual(['body:gesture', 'body:walk', 'body:wave']);
    expect(F.keying).toMatch(/STEP weights channel on the mesh node, a drawing per frame at fps keyed half a frame early/);
  });
  it('the rigid clips take the same durations and no face; blink false drops the layer and the baked blinks', async () => {
    const R = await glb(anime(), { skinned: false, face: false });
    expect(R.json.animations.map((a) => a.name)).toEqual(Object.keys(SECONDS).map((c) => `body:${c}`));
    for (const a of R.json.animations) { expect(G_end(R, a)).toBe(f32(SECONDS[a.name.slice(5)])); expect(a.channels.some((ch) => ch.target.path === 'weights')).toBe(false); }
    const off = await glb(anime({ blink: false }));
    expect(off.json.animations.map((a) => a.name)).not.toContain('face:ambientBlink');
    const F = off.json.meshes.find((m) => m.extras?.face).extras.face; expect(F.ambientClip).toBeNull(); expect(F.ambientOver).toEqual([]);
    const idle = off.json.animations.find((a) => a.name === 'body:idle'), wc = idle.channels.find((ch) => ch.target.path === 'weights');
    expect(off.json.accessors[idle.samplers[wc.sampler].input].count).toBe(2);   // the authored face held, no blink baked
  });
});

describe('every other hero: no duration, no face', () => {
  it('a landmark hero and the head-none hero: packs without `s` (the option absent is the option null), every clip one second, no weights channel', async () => {
    const cheer = { cheer: [{ support: 'both', crouch: 0.1 }, { support: 'both', armR: { x: 0.3, y: 0.15, z: 0.94 }, elbowR: 'slight' }] };
    for (const spec of [{ cast: 'male', register: 'lowpoly', clips: cheer }, { cast: 'female', head: 'none', register: 'lowpoly', clips: cheer }]) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }), label = spec.head ?? 'landmark';
      const p = await payloadOf(m, { face: true });
      for (const c of Object.values(p.figures.body.clips)) expect(Object.keys(c), label).toEqual(['k', 'b']);
      for (const skinned of [true, false]) {
        const G = await glb(m, { skinned });
        for (const a of G.json.animations) { expect(G_end(G, a), `${label} ${a.name}`).toBe(1); expect(a.samplers.every((s) => s.interpolation === 'LINEAR')).toBe(true); }
      }
      const mesh = compileLayered(m.recipe, m.dials), R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R);
      expect(packLayeredRig(mesh, skin, R, { clips: m.recipe.clips, seconds: null })).toEqual(packLayeredRig(mesh, skin, R, { clips: m.recipe.clips }));
    }
  });
});
