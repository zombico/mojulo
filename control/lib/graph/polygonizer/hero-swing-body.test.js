// THE FULL-BODY SWING (hero-swing-body.js swingBody): the arm's arc carried by the body on the strike solver's principles: the
// hips lead the chest, the weight moves back then onto the lead foot, the rear foot pivots, the off hand counters a
// one-handed swing, and every key's legs reach their planted feet on the rig. One case a procedure: a forehand, a
// backhand, a two-handed heavy.
import { describe, expect, it } from 'vitest';
import { swingClipKeys } from './hero-swing.js';
import { swingBody, SWING_BODY } from './hero-swing-body.js';
import { STRUCTURED_SWING_BASE } from './hero-gesture.js';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rig = (cast, item) => validateRig(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, gesture: 'chop', gear: { right: { item } } }) }).recipe.rig);
const body = (R, word, cls) => swingBody(word, cls, swingClipKeys(word, cls, { base: STRUCTURED_SWING_BASE }), R, rigNodesAt);
const at = (keys, cls, ph) => keys[SWING_BODY.phases[cls].indexOf(ph)];

describe('a swing carried by the whole body', () => {
  it('a forehand: the hips turned back at the coil, leading forward at the cock while the chest is still wound, through the blow onto the lead foot, the rear heel up', () => {
    for (const cast of ['male', 'female']) {
      const R = rig(cast, 'sword'), K = body(R, 'chop', 'normal');
      expect(at(K, 'normal', 'cock').facing).toBeGreaterThan(at(K, 'normal', 'coil').facing);   // (the hips already coming forward)
      expect(at(K, 'normal', 'cock').spine.twist[0]).toBe('right');                                // (the chest still back)
      expect(at(K, 'normal', 'strike').facing).toBeGreaterThan(0);
      expect(at(K, 'normal', 'cock').shift.y).toBeLessThan(0);
      expect(at(K, 'normal', 'strike').shift.y).toBeGreaterThan(0);
      expect(at(K, 'normal', 'strike').heelR).toBeGreaterThan(0);
      // (the off hand out at the cock, home at the hip through the blow)
      expect(at(K, 'normal', 'cock').shL.pitch).toBeGreaterThan(at(K, 'normal', 'strike').shL.pitch);
      // every key stands: both legs reach, the planted feet where the stance put them
      const feet = K.map((k) => { const { nodes, report } = rigNodesAt(R, k); expect(Object.values(report.legs).every((l) => l.reach === 'ok')).toBe(true); return [nodes[R.legs.L.toeBase], nodes[R.legs.R.toeBase]]; });
      for (const f of feet) for (let s = 0; s < 2; s++) for (let a = 0; a < 3; a++) expect(f[s][a]).toBeCloseTo(feet[0][s][a], 6);
    }
  });
  it('a backhand turns the other way; a two-handed swing keeps its own off hand', () => {
    const R = rig('male', 'sword'), B = body(R, 'rising', 'normal');
    expect(at(B, 'normal', 'cock').facing).toBeGreaterThan(0);
    expect(at(B, 'normal', 'strike').facing).toBeLessThan(0);
    const G = rig('male', 'greatsword'), plain = swingClipKeys('cleave', 'heavy', { base: STRUCTURED_SWING_BASE }), C = body(G, 'cleave', 'heavy');
    C.forEach((k, i) => expect(k.shL).toEqual(plain[i].shL));
    expect(at(C, 'heavy', 'strike').facing).toBeGreaterThan(at(C, 'heavy', 'load').facing);
  });
  it('a swing not asked for the body is its keys as they were', () => {
    const k = swingClipKeys('chop', 'normal', { base: STRUCTURED_SWING_BASE });
    expect(k.every((x) => x.facing === undefined && x.shift === undefined)).toBe(true);
  });
});
