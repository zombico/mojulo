// The legs pass each other (hero-stride.js): the swing leg's clearance of the planted leg through the hero's walk, and
// the pass heroLocomotion solves for it. One body (the female hero's walk as the door mints it: a narrow base, full
// thighs): the walk without the pass runs the calves through each other; with it the swing foot goes round, out early
// and back onto its line late, and the legs keep the gap at every phase. And the man's, on his wider base, which clears
// unaided. (Beside the module, not in the critical tier.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroLocomotion, locomotionClips, stampHeroMotion, motionPlan } from './hero-motion.js';
import { legGirths, legClearance, swingBump, THIGH_TOUCH } from './hero-stride.js';
import { HERO_WALK, HERO_WALK_POLE } from './hero-gaits.js';
import { stampHero, withDefaultWalk, withDefaultForm } from './motion-stamp.js';

describe('the legs pass each other', () => {
  let m, R, G, walk;
  const least = (fn, n = 48) => Math.min(...Array.from({ length: n }, (_, i) => legClearance(R, rigNodesAt(R, fn(i / n)).nodes, G).clear));
  beforeAll(() => {
    m = expandLayeredManifest({ kind: 'layered', hero: stampHero(heroRecord({ cast: 'female', motion: { walk: true } })) });
    R = validateRig(m.recipe.rig); G = legGirths(m.recipe, R); walk = motionPlan(stampHeroMotion({ walk: true })).walk;
  }, 120_000);

  it('reads each leg\'s girth off the body: the thigh fuller than the shank, the legs clear at rest past the groin\'s own contact', () => {
    for (const S of ['L', 'R']) expect(Math.max(...G[S].thigh.map(([, r]) => r))).toBeGreaterThan(Math.max(...G[S].shank.map(([, r]) => r)));
    expect(legClearance(R, rigNodesAt(R, {}).nodes, G).clear).toBeGreaterThan(0.02);
    expect(THIGH_TOUCH).toBeGreaterThan(0);
  });

  it('times the excursion: none at the lift-off and the landing, out early, held through the pass, in late', () => {
    expect(swingBump(0)).toBe(0); expect(swingBump(1)).toBe(0); expect(swingBump(0.5)).toBe(1);
    expect(swingBump(0.25)).toBeGreaterThan(swingBump(0.85));   // (out sooner than it comes back: the medial travel is late)
    expect(swingBump(0.9)).toBeLessThan(0.3);
  });

  it('the narrow walk without the pass runs the legs through each other; with it they keep the gap at every phase', { timeout: 120_000 }, () => {
    expect(HERO_WALK.swingClear).toBeGreaterThan(0);
    const { swingClear, ...without } = walk.spec.walk;
    expect(least(heroLocomotion({ walk: without }, R, { tilt: walk.tilt, girths: G }).fn)).toBeLessThan(-0.02);
    const loco = heroLocomotion(walk.spec, R, { tilt: walk.tilt, girths: G });
    expect(loco.pass.R.before).toBeLessThan(0); expect(loco.pass.R.flare).toBeGreaterThan(0);
    expect(least(loco.fn)).toBeGreaterThan(swingClear - 0.003);   // (between the solve's samples, within 3 mm)
    // (without the body's girths the walk is the walk as it was: nothing to keep clear of)
    expect(heroLocomotion(walk.spec, R, { tilt: walk.tilt }).pass).toBeUndefined();
  });

  it('rides the recipe: a minted walk carries the body\'s girths, so every reader compiles the solved walk', { timeout: 120_000 }, () => {
    expect(m.recipe.locomotion.walk.girths).toEqual(G);
    const fn = locomotionClips(m.recipe.locomotion, R).clips.walk;
    expect(least(fn, 24)).toBeGreaterThan(HERO_WALK.swingClear - 0.003);
  });

  it('the man walks a wider base (HERO_WALK_POLE): his legs clear each other on their own, nothing for the pass to solve', { timeout: 120_000 }, () => {
    const man = expandLayeredManifest({ kind: 'layered', hero: heroRecord(stampHero(withDefaultWalk(withDefaultForm({ cast: 'male' })))) });
    const Rm = validateRig(man.recipe.rig), loco = man.recipe.locomotion.walk, Gm = loco.girths;
    expect(loco.spec.walk.stepWidth).toBe(HERO_WALK_POLE.male.stepWidth);
    const lst = (fn) => Math.min(...Array.from({ length: 48 }, (_, i) => legClearance(Rm, rigNodesAt(Rm, fn(i / 48)).nodes, Gm).clear));
    const { swingClear, ...without } = loco.spec.walk;
    expect(lst(heroLocomotion({ ...loco.spec, walk: without }, Rm, { tilt: loco.tilt, girths: Gm }).fn)).toBeGreaterThan(0.004);
    const solved = heroLocomotion(loco.spec, Rm, { tilt: loco.tilt, girths: Gm });
    expect(solved.pass?.R?.flare ?? 0).toBeLessThan(1e-6);
    // (the feet land apart, men's heels about 10 to 13 cm: never onto one line as they pass)
    const fn = locomotionClips(man.recipe.locomotion, Rm).clips.walk;
    const sep = Array.from({ length: 48 }, (_, i) => { const n = rigNodesAt(Rm, fn(i / 48)).nodes; return Math.abs(n.ankleR[0] - n.ankleL[0]); });
    expect(Math.min(...sep)).toBeGreaterThan(0.08);
  });
});
