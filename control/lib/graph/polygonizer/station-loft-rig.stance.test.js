// station-loft-rig.stance.test.js — the rig's STANCE (a heeled shoe's: lib/graph/footwear): every pose stands in it. The
// root risen, the planted toes up on the forepart sole, the metatarsus turned heel-up by the pitch (or by the pose's own
// heel where it lifts further), a free foot's toes turned down; absent, nothing changes. One authored hero (the
// procedure is one).
import { describe, it, expect } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { validateRig, rigNodesAt } from './station-loft-rig.js';

const recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female' }) }).recipe;
const R0 = validateRig(recipe.rig), L = R0.legs.R;
// (the rise that keeps the legs their length, as footwear solves it: the toes' sole and the ankle's lift under the turn)
const v = R0.joints[L.hock].map((x, q) => x - R0.joints[L.toeBase][q]), a = (-25 * Math.PI) / 180, RISE = 0.01 + (v[1] * Math.sin(a) + v[2] * Math.cos(a)) - v[2];
const RS = validateRig({ ...recipe.rig, stance: { rise: RISE, toe: 0.01, pitch: 25 } });

describe('the rig stance', () => {
  it('absent, the pose is as it was; present, the root rises, the toes stand on their sole, the heel lifts', () => {
    expect(R0.stance).toBeUndefined();
    const flat = rigNodesAt(R0, {}).nodes, heeled = rigNodesAt(RS, {}).nodes;
    expect(heeled.pelvisHub[2] - flat.pelvisHub[2]).toBeCloseTo(RISE, 6);
    expect(heeled[L.toeBase][2] - flat[L.toeBase][2]).toBeCloseTo(0.01, 6);
    // the metatarsus turned 25° heel-up about the toe base
    const rise = (N) => { const d = N[L.hock].map((x, q) => x - N[L.toeBase][q]); return Math.atan2(d[2], -d[1]) * 180 / Math.PI; };
    expect(rise(heeled) - rise(flat)).toBeCloseTo(25, 0);
    // a pose's own heel past the pitch stands; one short of it is lifted to the pitch
    expect(rise(rigNodesAt(RS, { heelR: -40 }).nodes) - rise(flat)).toBeCloseTo(40, 0);
    expect(rise(rigNodesAt(RS, { heelR: -10 }).nodes) - rise(flat)).toBeCloseTo(25, 0);
  });

  it('a free foot stays tipped: its toes turned down about the ankle by the pitch', () => {
    const free = (R) => { const N = rigNodesAt(R, { lift: 0.2 }).nodes; return N[L.toeTip][2] - N[L.hock][2]; };
    expect(free(RS)).toBeLessThan(free(R0) - 0.02);
  });

  it('refuses a stance out of its ranges by name', () => {
    expect(() => validateRig({ ...recipe.rig, stance: { rise: RISE, toe: 0.01, pitch: 90 } })).toThrow(/stance is \{ rise/);
  });
});
