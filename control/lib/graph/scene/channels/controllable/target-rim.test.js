// The target rim (controllable/index.js `foeRim`, gameworld/foes.js `targetRim`): a gameworld's foes carry the world's
// accent as their rim, the page lights the one the pilot targets on the bone meshes of whatever body it wears, and a page
// whose bodies ask for no rim carries none of it.
import { describe, it, expect } from 'vitest';
import { controllableChannelScript } from './index.js';
import { targetRimOf } from '../../../gameworld/foes.js';

const foe = (id, extra = {}) => ({ id, team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 10, hpBar: 'target', ...extra }, transform: { pos: [0, 0, 0], heading: 0 } });

describe('the target rim', () => {
  it('is emitted only for a page whose foes ask for one, lit on the target the bar picks', () => {
    const without = controllableChannelScript([foe('a')], null, {}), withRim = controllableChannelScript([foe('a', { targetRim: [0.2, 0.6, 0.5] })], null, {});
    expect(without).not.toMatch(/__foeRim/);
    expect(withRim).toMatch(/__foeRim\(__foeT\);/);
    // (the bar's own pick: the lock's target, else the foe the pilot faces)
    expect(withRim).toMatch(/function __foeTarget/);
  });
  it('a world\'s rim is its accent, and a warm white without one', () => {
    const c = targetRimOf({});
    expect(c).toHaveLength(3);
    for (const x of c) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1); }
  });
});
