import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// NEWTYPE TACKLE-GUARD FACING GATE (mind.js). The auto-tackle counter answers a raw melee swing
// with a body-check — but only a swing the brain can SEE: the swinger must sit inside the
// tackler's front cone (`tackleGuardCone` half-angle, default 1.1 rad). A melee from behind or
// the flank lands; the brain no longer whips 180° to stuff an attack it never saw.

const DT = 1 / 60;
const body = { hp: 1000, radius: 8, collideRadius: 3.5, collideHeight: 22 };
const rifle = { name: 'rifle', weapon: { fireClass: 'sight', magazine: 10, cooldown: 0.6, damage: 10, impact: 20, range: 300, eye: 14 } };

const aiRule = (over = {}) => ({
  type: 'ai', speed: 10, boost: true, boostSpeed: 34, turn: 2.4, standoff: 60, eye: 0,
  dodgeCooldown: 8, collideRadius: 3.5, collideHeight: 22, loadout: [rifle], ...over,
});

// ai seat within tackle range of a target at the origin; `heading` aims the tackler's body.
// NEWTYPE ('max') is the only tier with tackleGuard.
function world(heading, aiOver = {}) {
  const state = createWorld({
    entities: [
      { id: 'target', pilotable: true, rule: { type: 'static' }, ambient: { type: 'static' }, body, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'ai', rule: aiRule(aiOver), body, transform: { pos: [12, 0, 0], heading } },
    ],
    camera: { rule: 'follow', target: 'target', dist: 30, height: 14 },
    aiDifficulty: 'max',
  });
  return state;
}
const ai = (state) => state.entities.find((e) => e.id === 'ai');
// arm the tackle-guard trigger: the target throws a raw swing (live phase + strike params)
function rawSwing(state) {
  const tg = state.entities.find((x) => x.id === 'target');
  tg.swingT = 0.1; tg.strikeParams = { damage: 20 }; tg.staggerT = null; tg.downed = false;
  const e = ai(state);
  e.tackleCdT = 0; e.aiBoostRestT = 0;
  return e;
}
const step = (state) => stepWorld(state, {}, DT, { ground: () => 0 });

describe('NEWTYPE tackle-guard facing gate', () => {
  it('FACING the swinger (head-on) → the counter still fires', () => {
    const state = world(Math.PI);              // at [12,0] looking -x, square at the origin target
    const e = rawSwing(state);
    step(state);
    expect(e.tackleT).not.toBeNull();          // committed the body-check
  });

  it('swinger BEHIND the tackler → no counter (the pre-fix 180° whip-tackle)', () => {
    const state = world(0);                    // looking +x — the target is directly behind
    const e = rawSwing(state);
    step(state);
    expect(e.tackleT == null).toBe(true);      // refused — it never saw the swing
  });

  it('swinger on the FLANK (perpendicular, outside the 1.1 rad cone) → no counter', () => {
    const state = world(Math.PI / 2);          // looking +y — the target is 90° off-axis
    const e = rawSwing(state);
    step(state);
    expect(e.tackleT == null).toBe(true);
  });

  it('slightly off-axis but inside the cone → fires (the square-up handles the shoulder-turn)', () => {
    const state = world(Math.PI - 0.5);        // 0.5 rad off the target line, within 1.1
    const e = rawSwing(state);
    step(state);
    expect(e.tackleT).not.toBeNull();
    expect(e.transform.heading).toBeCloseTo(Math.PI, 5);   // squared up onto the charge line
  });

  it('rule `tackleGuardCone` widens the gate (π → the old all-around counter, opt-in)', () => {
    const state = world(0, { tackleGuardCone: Math.PI });
    const e = rawSwing(state);
    step(state);
    expect(e.tackleT).not.toBeNull();          // behind, but the rule asked for eyes-in-the-back
  });
});
