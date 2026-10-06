import { describe, it, expect } from 'vitest';
import { withMotion, faunaBones, packFaunaRig, quatOfRows, motionGaits, strideSeconds } from './rig.js';
import { gaitFrames } from './gait.js';
import { SPECIES, speciesPlan } from './species.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { bindLayered } from '../polygonizer/station-loft-rig.js';

// The fauna rig contract: a species minted with motion binds every vertex to its skeleton, skins to itself at rest,
// and its packed clips move the mesh where the gait solver puts the bones. Without motion, nothing changes.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const quatRows = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
const mv = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const minted = (id) => { const recipe = expandPlan(withMotion(speciesPlan(id), id)); const mesh = compileLayered(recipe, {}, {}); return { recipe, mesh, skin: bindLayered(mesh, recipe, faunaBones(id)) }; };

describe('fauna rig', () => {
  for (const id of Object.keys(SPECIES)) {
    it(`${id}: every vertex bound, weights valid`, () => {
      const { mesh, skin } = minted(id), nb = faunaBones(id).bones.length;
      expect(skin.weights.length).toBe(mesh.vertices.length);
      skin.weights.forEach((w, i) => {
        expect(Math.abs(w.reduce((a, b) => a + b, 0) - 1), `vertex ${i}`).toBeLessThan(1e-9);
        expect(skin.joints[i].every((j) => j >= 0 && j < nb)).toBe(true);
      });
    });
  }

  it('without motion the plan is untouched; withMotion copies, never mutates', () => {
    const p = speciesPlan('wolf'), before = JSON.stringify(p);
    const m = withMotion(p, 'wolf', ['walk', 'trot']);
    expect(JSON.stringify(p)).toBe(before);
    expect(m.motion).toEqual({ species: 'wolf', gaits: ['walk', 'trot'], keys: 24 });
    expect(expandPlan(m).motion).toEqual(m.motion);
    expect(expandPlan(p).motion).toBeUndefined();
    expect(() => withMotion(p, 'wolf', ['fly'])).toThrow(/walk, trot, gallop/);
  });

  it('a rotation survives the quaternion', () => {
    for (const id of ['cheetah', 'snake', 'baldEagle']) {
      for (const f of gaitFrames(id, motionGaits(id).at(-1), 6)) for (const p of Object.values(f.bones)) {
        const back = quatRows(quatOfRows(p.m));
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(Math.abs(back[i][j] - p.m[i][j])).toBeLessThan(1e-9);
      }
    }
  });

  it('a packed clip moves the paw where the gait puts the foot', () => {
    const id = 'wolf', { mesh, skin } = minted(id), B = faunaBones(id);
    const pack = packFaunaRig(mesh, skin, { species: id, gaits: ['trot'], keys: 12 });
    const clip = pack.clips.trot, nb = B.bones.length;
    expect(clip.k).toBe(12); expect(clip.b.length).toBe(12 * nb * 7); expect(clip.s).toBeGreaterThan(0.2);
    // the vertex nearest the right hind toe at rest, skinned through key 3, lands near that toe's posed position
    const toe = B.bones.find((b) => b.id === 'hindPawR'), bi = B.boneIndex.hindPawR;
    let vi = 0; mesh.vertices.forEach((v, i) => { if (len(sub(v, toe.tail)) < len(sub(mesh.vertices[vi], toe.tail))) vi = i; });
    const key = 3, frameOf = (j) => { const o = (key * nb + j) * 7, q = clip.b.slice(o, o + 4), h = clip.b.slice(o + 4, o + 7); return { m: quatRows(q), h, rest: B.bones[j].head }; };
    let p = [0, 0, 0]; skin.joints[vi].forEach((j, k) => { const w = skin.weights[vi][k]; if (!w) return; const f = frameOf(j); const q = f.h.map((x, a) => x + mv(f.m, sub(mesh.vertices[vi], f.rest))[a]); p = p.map((x, a) => x + w * q[a]); });
    const posedToe = gaitFrames(id, 'trot', 12)[key].bones.hindPawR.tail;
    expect(bi).toBeGreaterThan(0);
    expect(len(sub(p, posedToe))).toBeLessThan(len(sub(mesh.vertices[vi], toe.tail)) + 0.02);
  });

  it('a stride lasts what its speed says: a walk slower than a gallop, an elephant slower than a fox', () => {
    expect(strideSeconds('wolf', 'walk')).toBeGreaterThan(strideSeconds('wolf', 'gallop'));
    expect(strideSeconds('elephant', 'walk')).toBeGreaterThan(strideSeconds('fox', 'walk'));
  });
});
