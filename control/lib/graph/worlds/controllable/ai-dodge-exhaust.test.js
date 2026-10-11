import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// AI POST-DODGE THRUSTER LOCKOUT (aiDodgeExhaust, mind.js). After an acrobatic roll, the ai must
// pay the same thruster cost the pilot does (beginDodge dumps the gauge + overheat) — it cannot
// instantly tackle or boost again. The ai is gauge-independent, so the cost is a wall-clock
// `e.aiBoostRestT` sized to the pilot's overheat-recovery window, gating boost + tackle until it clears.

const DT = 1 / 60;
const body = { hp: 1000, radius: 8, collideRadius: 3.5, collideHeight: 22 };
const rifle = { name: 'rifle', weapon: { fireClass: 'sight', magazine: 10, cooldown: 0.6, damage: 10, impact: 20, range: 300, eye: 14 } };

// an ai suit that closes on a distant target: boost to close, dodge on recovery, tackle a raw swing.
// NOTE: deliberately NO boostMax — this is the REAL arena seat-rule shape (the ai is gauge-independent;
// seatRule never sets boostMax). The lockout must fire anyway, or every real arena suit is exempt
// (the roll-then-counter regression). Cases that need a gauge add boostMax via `over`.
const aiRule = (over = {}) => ({
  type: 'ai', speed: 10, boost: true, boostSpeed: 34, turn: 2.4, standoff: 60, eye: 0,
  dodgeCooldown: 8, collideRadius: 3.5, collideHeight: 22, loadout: [rifle], ...over,
});

function world(aiOver, difficulty = 'medium') {
  const state = createWorld({
    entities: [
      { id: 'target', pilotable: true, rule: { type: 'static' }, ambient: { type: 'static' }, body, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'ai', rule: aiRule(aiOver), body, transform: { pos: [200, 0, 0], heading: Math.PI } },
    ],
    camera: { rule: 'follow', target: 'target', dist: 30, height: 14 },
    aiDifficulty: difficulty,
  });
  return state;
}
const ai = (state) => state.entities.find((e) => e.id === 'ai');
const step = (state, n = 1) => { for (let i = 0; i < n; i++) stepWorld(state, {}, DT, { ground: () => 0 }); };

describe('AI post-dodge thruster lockout', () => {
  it('a roll on a gauge-INDEPENDENT ai (no boostMax — the real arena shape) still sets the lockout', () => {
    const state = world();                    // aiRule() has NO boostMax on purpose
    const e = ai(state);
    e.reactionEnded = true; e.dodgeCdT = 0;   // "I just got tagged" — the ai dodge-out trigger
    step(state);
    expect(e.dodgeT).not.toBeNull();          // rolling
    expect(e.aiBoostRestT).toBeCloseTo(7.5, 1);   // default window (no gauge to derive from)
  });

  it('a suit WITH a gauge derives the window from its own overheat regime (boostMax/overheatRegen)', () => {
    const state = world({ boostMax: 6, overheatRegen: 2 });   // 6/2 = 3s recovery
    const e = ai(state);
    e.reactionEnded = true; e.dodgeCdT = 0;
    step(state);
    expect(e.aiBoostRestT).toBeCloseTo(3, 1);
  });

  it('the lockout ticks down each frame', () => {
    const state = world();
    const e = ai(state);
    e.reactionEnded = true; e.dodgeCdT = 0;
    step(state);
    const t0 = e.aiBoostRestT;
    step(state, 30);
    expect(e.aiBoostRestT).toBeCloseTo(t0 - 30 * DT, 2);
    expect(e.aiBoostRestT).toBeGreaterThan(0);
  });

  it('gates boost: a locked-out ai walks toward a far target instead of boosting; it boosts once cleared', () => {
    const state = world();
    const e = ai(state);
    e.aiBoostRestT = 5;                         // mid-lockout
    step(state);
    expect(e.boosting).toBe(false);             // gated — no boost-juke / boost-close while spent
    e.aiBoostRestT = 0;                         // thruster recovered
    step(state);
    expect(e.boosting).toBe(true);              // resumes boosting to close the 200-unit gap
  });

  it('gates tackle: a locked-out ai will not commit a NEWTYPE tackle even with a raw swing in reach', () => {
    const state = world({}, 'max');            // NEWTYPE — the only tier with tackleGuard
    // put the ai in tackle range and give the target a live raw swing (the tackle-guard trigger)
    const e = ai(state);
    const tg = state.entities.find((x) => x.id === 'target');
    e.transform.pos = [12, 0, 0];               // within tackleReach + dash
    tg.swingT = 0.1; tg.strikeParams = { damage: 20 }; tg.staggerT = null;
    e.tackleCdT = 0; e.aiBoostRestT = 4;        // ready to tackle, but thruster spent
    step(state);
    expect(e.tackleT == null).toBe(true);       // refused — spent thruster can't tackle
  });

  it('END-TO-END (the operator scenario): stun→roll→raw melee → the ai does NOT tackle-counter', () => {
    const state = world({}, 'max');           // NEWTYPE — tackleGuard on; real gauge-independent rule
    const e = ai(state);
    const tg = state.entities.find((x) => x.id === 'target');
    // 1) the ai rolls out of a stagger recovery (the real dodge-out path, sets the lockout itself)
    e.reactionEnded = true; e.dodgeCdT = 0;
    step(state);
    expect(e.dodgeT).not.toBeNull();
    expect(e.aiBoostRestT).toBeGreaterThan(0);
    // 2) let the roll finish (the body frees up) — the lockout is still running
    for (let i = 0; i < 60 && e.dodgeT != null; i++) step(state);
    expect(e.dodgeT).toBeNull();
    expect(e.aiBoostRestT).toBeGreaterThan(0);
    // 3) the operator melees in range — pre-fix the ai countered with a tackle; now it can't
    e.transform.pos = [12, 0, 0]; e.tackleCdT = 0;
    tg.swingT = 0.1; tg.strikeParams = { damage: 20 }; tg.staggerT = null; tg.downed = false;
    step(state);
    expect(e.tackleT == null).toBe(true);     // spent thruster from the roll → no counter
  });

  it('a free-roll suit (dodgeBoostCost:0) pays NO lockout — parity with the pilot who dodges freely', () => {
    const state = world({ dodgeBoostCost: 0 });
    const e = ai(state);
    e.reactionEnded = true; e.dodgeCdT = 0;
    step(state);
    expect(e.dodgeT).not.toBeNull();            // still dodged
    expect(e.aiBoostRestT || 0).toBe(0);        // but no thruster lockout
  });
});
