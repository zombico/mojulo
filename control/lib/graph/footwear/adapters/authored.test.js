// authored.test.js — the AUTHORED game body wears the footwear library's cards through its own adapter: the bare foot
// the plan keeps for them, read up to the toe base and its toes as one block from there, the leather clear of the foot,
// the cards at half the reference resolution. One case per concept: a closed shoe (the foot under it not drawn, the
// leather closed and wound once), a sandal (the bare foot kept, the straps on it), a heeled card (the rig's stance), and
// a plain word unchanged (the kernel's shoe on the boxes).
import { describe, it, expect } from 'vitest';

import { heroRecord, heroPlanOf, expandLayeredManifest } from '../../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from '../../polygonizer/station-loft.js';
import { expandPlan } from '../../polygonizer/station-loft-plan.js';
import { validateRig } from '../../polygonizer/station-loft-rig.js';
import { authoredFoot, FACETS } from './authored.js';

const wear = (cast, w) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, outfit: ['tee', 'trousers', w] }) }).recipe;
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));

describe('the authored body\'s footwear', () => {
  it('the foot as footwear reads it: to the toe base, the toes one block from there on its ring, the leather outside the bare foot', () => {
    const hero = heroRecord({ cast: 'male', outfit: ['oxfords'] }), R = expandPlan(heroPlanOf(hero)), rig = validateRig(R.rig), A = authoredFoot(R, rig);
    expect(A).toBeTruthy(); expect(A.facets).toBe(FACETS);
    const tb = rig.joints.toeBaseR, F = A.bare('footR'), T = A.bare('toesR');
    // (the foot's last ring at the toe base, the block's first the same ring)
    expect(T.stations[0].points).toEqual(F.stations[F.stations.length - 1].points);
    const c = (st) => [0, 1].map((q) => Object.values(st.points).reduce((t, p) => t + p[q], 0) / 12);
    expect(c(F.stations[F.stations.length - 1])[1]).toBeCloseTo(tb[1], 3);
    // (the leather over the foot and the toes: each ring at least the sock's thickness past every bare point beside it)
    const up = A.upper({ height: 'shoe', thick: 0.003 }, { id: 'x', group: 'Shoes' });
    const bareX = [R.parts.footR, R.parts.halluxR, R.parts.toe5R].flatMap(pointsOf).map((p) => p[0]);
    const leatherX = [up.x_footR, up.x_toesR].flatMap(pointsOf).map((p) => p[0]);
    expect(Math.min(...leatherX)).toBeLessThan(Math.min(...bareX) - 0.002); expect(Math.max(...leatherX)).toBeGreaterThan(Math.max(...bareX) + 0.002);
    // (a plain body: the shoe's boxes, no bare foot, no adapter)
    expect(authoredFoot(expandPlan(heroPlanOf(heroRecord({ cast: 'male', outfit: ['shoes'] }))), rig)).toBeNull();
  });

  it('a closed shoe: its pieces on both feet, closed and wound once, the bare foot under it not drawn', () => {
    const r = wear('male', 'oxfords');
    for (const k of ['oxfords_footR', 'oxfords_toesL', 'oxfordsSole_footR', 'oxfordsToeCap_toesL']) expect(r.parts[k], k).toBeTruthy();
    for (const k of ['footR', 'halluxL', 'toe5R']) expect(r.parts[k], k).toBeUndefined();
    // (at half the reference resolution: the sole's outline 24 points round, not 48)
    expect(r.parts.oxfordsSole_footR.slots.length).toBe(Math.round(48 * FACETS));
    const A = auditLayered(compileLayered(r));
    for (const k of Object.keys(r.parts).filter((n) => n.startsWith('oxfords'))) { expect(A[k].windingErrors, k).toBe(0); expect(A[k].boundaryEdges, k).toBe(0); }
  }, 300_000);

  it('a sandal: the bare foot kept and the straps and the sole on it; a heeled card stands the rig in its stance', () => {
    const s = wear('female', 'gladiatorSandals');
    for (const k of ['footR', 'halluxR', 'gladiatorSandalsSole_footR', 'gladiatorSandalsStrap0_footL']) expect(s.parts[k], k).toBeTruthy();
    expect(s.rig.stance).toBeUndefined();
    const p = wear('female', 'pumps');
    expect(p.parts.pumpsHeel_footR).toBeTruthy();
    expect(p.rig.stance.pitch).toBeGreaterThan(10); expect(p.rig.stance.rise).toBeGreaterThan(0.02);
  }, 300_000);
});
