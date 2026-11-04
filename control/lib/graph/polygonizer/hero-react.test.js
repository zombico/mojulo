// hero-react — the reactions lifted from the versus fighter onto a hero's rig: read from the fight's own library (not
// copied), struck fast and given back slowly, the feet planted, the clip starting and ending on the stand, and each
// reaction moving the body the way the fight's does.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroReact, planeToVajra, REACTS, REACT_NAMES, BLOCK_NAMES } from './hero-react.js';
import { MOTION_GAITS } from './hero-motion.js';
import { heroStance } from './hero-stance.js';
import { HIT_PEAKS } from '../versus/versus-react.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rigOf = (hero) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(hero) }).recipe.rig);

describe('hero-react', () => {
  const R = rigOf({ cast: 'female', head: 'anime' });

  it('reads the fight\'s own poses: a high hit snaps the head back and leans away, a low one drops the body', () => {
    const high = planeToVajra(HIT_PEAKS.high), low = planeToVajra(HIT_PEAKS.low), body = planeToVajra(HIT_PEAKS.body);
    expect(high.pose.head.pitch).toBeGreaterThan(10);
    expect(high.pose.hinge).toBeLessThan(0);
    expect(body.pose.hinge).toBeGreaterThan(20);
    expect(low.sink).toBeGreaterThan(0.03);
    expect(JSON.stringify(REACTS.hitHigh.keys[1].pose)).toBe(JSON.stringify(high.pose));
  });

  it('is a move word, a one-shot that keeps its feet and comes home to the stand', () => {
    for (const name of REACT_NAMES) expect(MOTION_GAITS[name]).toMatchObject({ motion: 'move', family: 'react' });
    // one hit and the stagger: the two shapes of timeline
    for (const name of ['hitLow', 'stagger']) {
      const K = heroReact(name, R);
      expect(K.laws, name).toEqual({ planted: true, ends: true });
      expect(K.seconds).toBe(REACTS[name].seconds);
      expect(JSON.stringify(K.fn(0))).toBe(JSON.stringify(K.fn(1)));
    }
  }, 60000);

  it('moves the body the way the fight does: a high hit throws the head back, a body blow folds it forward and down', () => {
    const head = (name, t) => rigNodesAt(R, heroReact(name, R).fn(t)).nodes.headTop;
    const [h0, hHigh, hBody] = [head('hitHigh', 0), head('hitHigh', 0.1), head('hitBody', 0.1)];
    expect(hHigh[1]).toBeLessThan(h0[1] - 0.03);   // back (the front is +y)
    expect(hBody[1]).toBeGreaterThan(h0[1] + 0.1);   // forward over the blow
    expect(hBody[2]).toBeLessThan(h0[2] - 0.05);   // and down
  }, 60000);

  it('takes a blow in the guard: out of the guard\'s held pose and back to it, the fists kept, the head still snapped back', () => {
    const G = heroStance('guard', R).clip.fn(1), K = heroReact('guardHitHigh', R), P = heroReact('hitHigh', R);
    expect(Object.values(K.laws).every(Boolean)).toBe(true);
    const n = (pose) => rigNodesAt(R, pose).nodes, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const g = n(G), k0 = n(K.fn(0)), k1 = n(K.fn(1)), p0 = n(P.fn(0));
    for (const j of ['wristR', 'wristL', 'headTop']) { expect(d(k0[j], g[j])).toBeLessThan(0.01); expect(d(k1[j], g[j])).toBeLessThan(0.01); }
    expect(d(p0.wristR, g.wristR)).toBeGreaterThan(0.2);   // (the plain blow starts with the hands dropped)
    expect(K.fn(0).fingersR).toEqual(G.fingersR);
    expect(n(K.fn(0.1)).headTop[1]).toBeLessThan(k0.headTop[1] - 0.03);
    for (const w of ['guardHitHigh', 'guardHitBody', 'guardHitLow', 'guardStagger']) expect(MOTION_GAITS[w]).toMatchObject({ motion: 'move', family: 'react' });
  }, 60000);

  it('blocks on the guard: out of it and home to it, the gloves driven back toward the face, the arms out of the trunk', () => {
    const G = rigNodesAt(R, heroStance('guard', R).clip.fn(1)).nodes, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (const w of BLOCK_NAMES) {
      const K = heroReact(w, R);
      expect(Object.values(K.laws).every(Boolean)).toBe(true);
      expect(MOTION_GAITS[w]).toMatchObject({ motion: 'move', family: 'react' });
      const k0 = rigNodesAt(R, K.fn(0)).nodes; for (const j of ['wristR', 'wristL', 'headTop']) expect(d(k0[j], G[j])).toBeLessThan(0.01);
    }
    // (the high block's gloves back toward the face at its impact: nearer the head than in the guard; the body's lower)
    const hi = rigNodesAt(R, heroReact('block', R).fn(0.12)).nodes, bo = rigNodesAt(R, heroReact('blockBody', R).fn(0.14)).nodes;
    expect(d(hi.wristR, hi.headTop) + d(hi.wristL, hi.headTop)).toBeLessThan(d(G.wristR, G.headTop) + d(G.wristL, G.headTop));
    expect(bo.wristR[2] + bo.wristL[2]).toBeLessThan(G.wristR[2] + G.wristL[2] - 0.05);
  }, 60000);
});
