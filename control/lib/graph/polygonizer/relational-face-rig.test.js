// The realistic head's face rig (relational-face-rig.js): its targets differenced from the head rebuilt at its fit with
// one of its own actions; what is pinned to the face carried by the skin under it; the weights from the western
// expression channels. One face, built once (a rig costs a few head builds). (Beside the module, not in the critical
// tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { relationalFaceRig, relationalWeights, RELATIONAL_FACE_TARGETS } from './relational-face-rig.js';
import { westernState } from './western-face-rig.js';
import { EXPRESSIONS, CHANNEL_RANGES } from './humanoid-head.js';

describe('the realistic face\'s weights', () => {
  it('reads the western channels: the blink its own, a smile its corners\' lift, a brow its raise or its lowering', () => {
    const at = (c) => Object.fromEntries(RELATIONAL_FACE_TARGETS.map((t, i) => [t, relationalWeights(westernState({ ...EXPRESSIONS.neutral, ...c }), [0, 0.2, 0.5, 1])[i]]));
    expect(Object.values(at({}))).toEqual(RELATIONAL_FACE_TARGETS.map(() => 0));
    expect(at({ blink: 1 }).blink).toBe(1);
    expect(at({ mouthCorner: CHANNEL_RANGES.mouthCorner[1] }).smile).toBe(1);
    expect(at({ mouthCorner: CHANNEL_RANGES.mouthCorner[0] }).smile).toBe(0);
    expect(at({ browRaise: CHANNEL_RANGES.browRaise[1] }).browRaise).toBe(1);
    expect(at({ browRaise: CHANNEL_RANGES.browRaise[0] }).browLower).toBe(1);
  });
});

describe('the realistic face rig', () => {
  let m, mesh, F, W;
  const move = (t, re) => { const ti = F.targets.indexOf(t); let mx = 0; mesh.vertices.forEach((_, i) => { const k = F.sub[i]; if (k < 0 || !re.test(mesh.provenance[i].part)) return; const o = k * W + 3 + ti * 3; mx = Math.max(mx, Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2])); }); return mx; };
  beforeAll(() => {
    const hero = heroRecord({ form: 'realistic', cast: 'female', face: { seed: 10, ethnicity: 'western' } });
    m = { ...expandLayeredManifest({ kind: 'layered', hero }), hero }; mesh = compileLayered(m.recipe);
    F = relationalFaceRig(m, mesh); W = (1 + F.targets.length) * 3;
  }, 600_000);
  it('builds its targets on the head the figure carries (the rest rebuilt is the stored face, within a millimetre: the rows carry the rest)', () => {
    expect(F.skipped).toBeUndefined();
    expect(F.targets).toEqual([...RELATIONAL_FACE_TARGETS]);
    let rebase = 0; mesh.vertices.forEach((_, i) => { const k = F.sub[i]; if (k >= 0) rebase = Math.max(rebase, Math.hypot(F.rows[k * W], F.rows[k * W + 1], F.rows[k * W + 2])); });
    expect(rebase).toBeLessThan(1e-3);
  });
  it('moves what each action moves: a blink the eyes and their lashes, one eye its own side; a brow its hairs, hardly the scalp\'s', () => {
    expect(move('blink', /^eye[RL]$/)).toBeGreaterThan(0.003);
    expect(move('blink', /^hairLashes$/)).toBeGreaterThan(0.002);
    expect(move('blink', /^(cranium|jaw|ear[RL])$/)).toBe(0);
    // (one eye: the left's target leaves the right's side still)
    const ti = F.targets.indexOf('blinkLeft'); let right = 0;
    mesh.vertices.forEach((v, i) => { const k = F.sub[i]; if (k < 0 || v[0] < 0.01) return; const o = k * W + 3 + ti * 3; right = Math.max(right, Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2])); });
    expect(right).toBeLessThan(1e-4);
    expect(move('browRaise', /^hairBrows$/)).toBeGreaterThan(0.002);
    // (the scalp's hair stays, but for the fringe lying on the forehead's skin, which the frontalis lifts)
    const ti2 = F.targets.indexOf('browRaise'); let hair = 0, moved = 0;
    mesh.vertices.forEach((_, i) => { if (mesh.provenance[i].part !== 'hair') return; hair++; const k = F.sub[i]; if (k < 0) return; const o = k * W + 3 + ti2 * 3; if (Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2]) > 5e-4) moved++; });
    expect(moved / hair).toBeLessThan(0.2);
    expect(move('smile', /^visage$/)).toBeGreaterThan(0.003);
  });
  it('wears the hero\'s expression as its default weights; a hero without the relational head has none', () => {
    expect(F.meta.weights).toEqual(RELATIONAL_FACE_TARGETS.map(() => 0));
    expect(relationalFaceRig({ ...m, hero: { ...m.hero, head: 'landmark' } }, mesh)).toBeNull();
  });
});
