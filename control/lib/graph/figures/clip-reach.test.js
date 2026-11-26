import { describe, expect, it } from 'vitest';

import { clipReach } from './clip-reach.js';
import { bladeFit, BLADE } from '../gameworld/foe-blade.js';

// one bone, a shoulder at 1.4 m, its weapon's tip 1 m out along +y at rest; the clip turns it about +x from straight up
// (u 0) down through straight ahead (u 0.5) to straight down (u 1): a chop, the contact window round the level
const K = 21, SH = [0, 0, 1.4];
const turnX = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
const chop = () => {
  const b = [];
  for (let k = 0; k < K; k++) { const u = k / (K - 1), a = Math.PI / 2 - u * Math.PI; b.push(...turnX(a), ...SH); }
  return { k: K, b, once: true, move: { tip: { bone: 'arm', at: [0, 1, 1.4] }, window: [0.4, 0.6] } };
};
const PACK = { bones: [{ id: 'arm', head: SH, tail: [0, 1, 1.4] }], clips: { swing_neutral: chop() } };

describe('where a held weapon goes while a swing can hit', () => {
  it('a chop through the level: its tip a metre ahead at the blow, straight ahead, round the shoulder\'s height', () => {
    const R = clipReach(PACK, 'swing_neutral');
    expect(R.reach).toBeCloseTo(1, 2);
    expect(R.cone).toBeCloseTo(0, 2);
    expect(R.low).toBeLessThan(1.4);
    expect(R.high).toBeGreaterThan(1.4);
    // (outside the window it is not measured: the wind-up overhead is no reach)
    expect(R.path.every((p) => p[1] > 0.9)).toBe(true);
  });

  it('a sweep across the front widens the cone; the fit takes it, its margin and its bounds, at the body\'s scale', () => {
    const b = [];
    for (let k = 0; k < K; k++) { const u = k / (K - 1), a = -Math.PI / 3 + u * (2 * Math.PI / 3); b.push(0, 0, Math.sin(a / 2), Math.cos(a / 2), ...SH); }
    const sweep = { k: K, b, once: true, move: { tip: { bone: 'arm', at: [0, 1, 1.4] }, window: [0, 1] } };
    const R = clipReach({ ...PACK, clips: { s: sweep } }, 's');
    expect(R.cone).toBeCloseTo(60, 0);
    const F = bladeFit({ ...PACK, clips: { s: sweep } }, 's', 2);
    expect(F.strikeReach).toBeCloseTo(2, 2);
    expect(F.strikeCone).toBe(Math.min(BLADE.coneMax, 60 + BLADE.margin));
    expect(bladeFit(PACK, 'swing_neutral').strikeCone).toBe(BLADE.coneMin);
  });

  it('a clip that carries no weapon\'s tip says nothing', () => {
    expect(clipReach(PACK, { k: K, b: chop().b, once: true })).toBeNull();
    expect(bladeFit(PACK, 'nope')).toBeNull();
  });
});
