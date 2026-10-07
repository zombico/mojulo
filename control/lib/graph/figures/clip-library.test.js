/**
 * clip-library: an outside animation library's clips on mojulo's rigs. The shipped hub (Quaternius's CC0 locomotion)
 * retargeted onto the heroine, and, where the library's own file is on this machine, every limb of the heroine
 * checked against the library's mannequin frame by frame.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hubClips, retargetClip, libraryClips, LIBRARY_MAPS, HUB_BONES } from './clip-library.js';
import { loadClipLibrary, clipLoops, CLIP_LIBRARY_IDS } from './library/index.js';
import { tposeFrames } from './rig-tpose.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

const cast = JSON.parse(readFileSync(new URL('../../../../docs/examples/humanoid/cast/heroine.json', import.meta.url), 'utf8'));
let heroinePack;
async function heroine() {
  if (heroinePack) return heroinePack;
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ ...cast.hero, palette: { ...cast.hero.palette, ...cast.palette } }) });
  return (heroinePack = (await WORLD_KINDS.layered.resolve(m, { title: 'heroine' })).figures.body);
}
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const deg = (a, b) => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
// a packed clip key's bone q and head
const keyOf = (clip, nb, k, i) => { const o = (k * nb + i) * 7; return { q: clip.b.slice(o, o + 4), head: clip.b.slice(o + 4, o + 7) }; };

describe('the shipped library', () => {
  it('Quaternius\'s CC0 locomotion ships as a hub, its licence and source on it', async () => {
    expect(CLIP_LIBRARY_IDS).toContain('quaternius-ual');
    const lib = await loadClipLibrary('quaternius-ual');
    expect(lib.licence).toBe('CC0');
    expect(Object.keys(lib.clips)).toEqual(expect.arrayContaining(['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land']));
    for (const h of Object.values(lib.clips)) for (const v of ['hips', 'leftUpperArm', 'rightUpperLeg']) expect(h.bones[v].length).toBe((h.hips.length / 3) * 4);
    await expect(loadClipLibrary('mixamo')).rejects.toThrow(/not shipped/);
    expect([clipLoops('Walk_Loop'), clipLoops('Jump_Start')]).toEqual([true, false]);
  });
});

describe('a library clip on the heroine', () => {
  it('a hub with no turn leaves her in the T-pose the mold puts her in', async () => {
    const pack = await heroine(), T = tposeFrames(pack.bones), frames = 3;
    const still = { seconds: 0.1, fps: 30, bones: Object.fromEntries(HUB_BONES.map((v) => [v, Array.from({ length: frames }, () => [0, 0, 0, 1]).flat()])), hips: new Array(frames * 3).fill(0) };
    const c = retargetClip(pack, still);
    for (let i = 0; i < pack.bones.length; i++) {
      const { q, head } = keyOf(c, pack.bones.length, 1, i);
      q.forEach((x, j) => expect(x).toBeCloseTo(T[i].q[j], 3));
      head.forEach((x, j) => expect(x).toBeCloseTo(T[i].head[j], 3));
    }
  }, 60000);

  it('every library clip retargets: the keys she plays, a one-shot holds its last pose', async () => {
    const pack = await heroine(), lib = await loadClipLibrary('quaternius-ual');
    const clips = libraryClips(pack, lib, undefined, { once: ['Jump_Start', 'Jump_Land', 'Hit_Chest'] });
    for (const [n, c] of Object.entries(clips)) {
      expect(c.b.length).toBe(c.k * pack.bones.length * 7);
      expect(c.b.every(Number.isFinite)).toBe(true);
      expect(!!c.once).toBe(['Jump_Start', 'Jump_Land', 'Hit_Chest'].includes(n));
    }
    expect(() => libraryClips(pack, lib, ['Moonwalk'])).toThrow(/no clip 'Moonwalk'/);
  }, 60000);

  it('the jog keeps her on the ground: her lowest point stays within a hand of the floor, and she bobs', async () => {
    const pack = await heroine(), lib = await loadClipLibrary('quaternius-ual'), c = retargetClip(pack, lib.clips.Jog_Fwd_Loop), nb = pack.bones.length;
    const floor = Math.min(...pack.bones.flatMap((b) => [b.head[2], b.tail[2]]));
    const hips = tposeFrames(pack.bones).findIndex((f) => f.vrm === 'hips'), hz = [];
    for (let k = 0; k < c.k; k++) hz.push(keyOf(c, nb, k, hips).head[2]);
    expect(Math.max(...hz) - Math.min(...hz)).toBeGreaterThan(0.05);
    expect(Math.min(...hz)).toBeGreaterThan(floor + 0.4);
  }, 60000);
});

// The gate against the library's own mannequin (needs the library's file; skipped where it is absent).
const UAL = process.env.MOJULO_UAL || join(process.env.HOME || '', 'Documents/mojulo-godot-retarget-view/quaternius/AnimationLibrary_Godot_Standard.gltf');
describe.skipIf(!existsSync(UAL))('against the library\'s mannequin', () => {
  it('each limb of the heroine points where the mannequin\'s does, every frame of the walk, jog and jump', async () => {
    const gltf = JSON.parse(readFileSync(UAL, 'utf8')), bin = readFileSync(join(UAL, '..', gltf.buffers[0].uri));
    const map = LIBRARY_MAPS['quaternius-ual'], pack = await heroine(), T = tposeFrames(pack.bones), nb = pack.bones.length;
    const lib = hubClips(gltf, bin, { map, clips: ['Walk_Loop', 'Jog_Fwd_Loop', 'Jump_Loop'], at: true });
    // the mannequin's limb at a frame: from its joint to the next, where the library itself puts them
    const SEG = [['leftUpperArm', 'leftLowerArm'], ['leftLowerArm', 'leftHand'], ['rightUpperArm', 'rightLowerArm'], ['rightLowerArm', 'rightHand'], ['leftUpperLeg', 'leftLowerLeg'], ['leftLowerLeg', 'leftFoot'], ['rightUpperLeg', 'rightLowerLeg'], ['rightLowerLeg', 'rightFoot']];
    const idx = Object.fromEntries(T.map((f, i) => [f.vrm, i]).filter(([v]) => v));
    const report = {};
    for (const name of ['Walk_Loop', 'Jog_Fwd_Loop', 'Jump_Loop']) {
      const hub = lib.clips[name], frames = hub.hips.length / 3, c = retargetClip(pack, hub, { keys: frames });
      let w = 0;
      for (let f = 0; f < frames; f++) for (const [a, b] of SEG) {
        const src = unit(hub.at[b].slice(3 * f, 3 * f + 3).map((x, j) => x - hub.at[a][3 * f + j]));
        const ha = keyOf(c, nb, f, idx[a]).head, hb = keyOf(c, nb, f, idx[b]).head;
        w = Math.max(w, deg(src, unit(hb.map((x, j) => x - ha[j]))));
      }
      report[name] = +w.toFixed(2);
    }
    const worst = Math.max(...Object.values(report));
    process.stderr.write(`limb directions vs the mannequin, worst per clip (deg): ${JSON.stringify(report)}\n`);
    // the whole residual is the rest: the library's shin leans 4.7° back from straight in its bind pose, the mold stands
    // her lower leg straight; every other limb lands within a degree
    expect(worst).toBeLessThan(5);
  }, 120000);
});
