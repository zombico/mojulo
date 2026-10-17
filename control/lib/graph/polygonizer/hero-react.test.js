// hero-react — the reactions lifted from the versus fighter onto a hero's rig: read from the fight's own library (not
// copied), struck fast and given back slowly, the feet planted, the clip starting and ending on the stand, and each
// reaction moving the body the way the fight's does.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroReact, planeToVajra, REACTS, REACT_NAMES } from './hero-react.js';
import { MOTION_GAITS } from './hero-motion.js';
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
});
