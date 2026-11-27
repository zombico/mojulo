/**
 * hero-hold — laws-2 gear held without wearing it through the body: a mount fitted at rest and through the poses it
 * rides (one case per hold class that is fitted: a haft, a shield, a blade), the held idle by class (a haft kept upright
 * by its wrist), every stand, idle and walk key clear of the capsules, and gear minted under laws 1 untouched; a head
 * girthier than a person's read off its skin, a haft beside it leaning out from its grip.
 */
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { validateRig, rigNodesAt, boneFrames } from './station-loft-rig.js';
import { gearMounts } from './hero-gear.js';
import { heldClips, posedPoints, MARGIN, headGirth } from './hero-hold.js';
import { compileLayered } from './station-loft.js';

const heroOf = (spec) => { const hero = heroRecord(spec); const m = expandLayeredManifest({ kind: 'layered', hero }); return { hero, m, R: validateRig(m.recipe.rig) }; };
const A = heroOf({ cast: 'female', gear: { right: { item: 'staff', style: 'celestial' }, left: { item: 'shield', style: 'historical' } } });
const B = heroOf({ cast: 'male', gear: { right: { item: 'greatsword', style: 'historical' } } });
const need = (R) => MARGIN * R.joints.headTop[2] / 1.75;

describe('hero-hold: laws-2 gear held clear of the body', () => {
  it('rule 1: each mount is fitted clear at rest and through the poses it rides', () => {
    for (const { hero, R } of [A, B]) for (const G of gearMounts(hero, R)) expect(G.restClearance).toBeGreaterThanOrEqual(need(R) - 1e-4);
  });
  it('rule 2: the idle takes the holding arm by its class, a haft upright by its wrist', () => {
    const idle = A.m.recipe.clips.idle;
    expect(idle.map((k) => k.elbowL)).toEqual([38, 44, 38, 42]);                                  // the shield's forearm up
    expect(idle.every((k) => k.wristR && k.wristR.deviation < 0)).toBe(true);                    // the haft's wrist
    const G = gearMounts(A.hero, A.R).find((x) => x.slot === 'right'), R = A.R;
    const axis = (pose) => { const n = rigNodesAt(R, pose).nodes, [p, q] = posedPoints(G, [[0, 0, 0], [0, 0, 100]], boneFrames(R, R.joints, n)[G.boneIndex]); const d = q.map((v, i) => v - p[i]), l = Math.hypot(...d); return d.map((v) => v / l); };
    const rest = axis({}), turn = (k) => (Math.acos(Math.min(1, axis(k).reduce((s, v, i) => s + v * rest[i], 0))) * 180) / Math.PI;
    for (const k of idle) expect(turn(k)).toBeLessThan(5);                                        // a sway, not a tip
    expect(B.m.recipe.clips.idle.map((k) => k.elbowR)).toEqual([16, 24, 16, 21]);                  // a blade breathes
  });
  it('rule 3 and the readout: every stand, idle and walk key keeps the margin', () => {
    for (const { hero, m, R } of [A, B]) {
      const { clearance } = heldClips(m.recipe.clips, { mounts: gearMounts(hero, R), R, own: m.recipe.clips });
      expect(Object.keys(clearance).length).toBeGreaterThan(0);
      for (const c of Object.values(clearance)) { expect(c.clear).toBe(true); expect(c.m).toBeGreaterThanOrEqual(need(R) - 1e-4); }
    }
  });
  it('gear minted under laws 1 keeps the hold and the clips it was minted with', () => {
    const old = heroOf({ cast: 'female', gear: { right: { item: 'staff', style: 'celestial', laws: 1 } } });
    expect(gearMounts(old.hero, old.R)[0].restClearance).toBeUndefined();
    expect(old.m.recipe.clips.idle.every((k) => k.elbowR === 'slight' && k.wristR === undefined)).toBe(true);
  });

  it('a head girthier than a person\'s is read off its skin, and a haft beside it leans out, never across the face', () => {
    // (a person's head, its hair with it, keeps the canonical capsule)
    expect(headGirth(compileLayered(A.m.recipe, {}), A.m.recipe, A.R)).toBeNull();
    // (a bull's skull and muzzle on a brute, a great axe in its fist)
    const axe = { item: 'staff', style: 'grave', parts: { hilt: 'long', end: 'axe' } };
    const C = heroOf({ cast: { pole: 'male', build: 'brute' }, head: 'none', form: 'tiered', beast: { kin: 'bovine' }, gear: { right: axe } });
    const g = headGirth(compileLayered(C.m.recipe, {}), C.m.recipe, C.R);
    expect(g).toBeGreaterThan(1.3 * 0.1 * C.R.joints.headTop[2] / 1.75);
    const lean = (G) => { const [p, q] = posedPoints(G, [[0, 0, G.o[2]], [0, 0, 150]], boneFrames(C.R, C.R.joints, C.R.joints)[G.boneIndex]); return q[0] - p[0]; };
    const G = gearMounts(C.hero, C.R, { head: g })[0];
    expect(lean(G)).toBeGreaterThan(0);                                                           // its top out past its grip
    expect(G.restClearance).toBeGreaterThanOrEqual(need(C.R) - 1e-4);
  });
});
