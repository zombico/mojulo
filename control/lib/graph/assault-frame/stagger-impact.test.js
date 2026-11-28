// STAGGER BUILD-UP by a weapon's impact (parts.js IMPACTS): every weapon says how it hits; a ballistic gun kept on a
// medium frame breaks its bar in a few seconds, an energy weapon builds far less for its damage. Read off the shelf by
// class, one case per class, never a hand list.
import { describe, expect, it } from 'vitest';
import { PARTS, IMPACTS } from './parts.js';
import { assembleFrame } from './assemble.js';

const WEAPONS = Object.values({ ...PARTS.armWeapon, ...(PARTS.backWeapon || {}) });
const perSecond = (W) => W.stagger * (W.pellets || 1) * (W.salvo || 1) * (W.rof ? W.rof : 1 / (W.cooldown || 1));
const perDamage = (W) => W.stagger / Math.max(1, W.damage);

describe('stagger build-up by impact', () => {
  it('every weapon names its impact, one of the classes', () => {
    for (const W of WEAPONS) expect(IMPACTS).toContain(W.impact);
  });

  it('a ballistic gun kept on breaks a medium frame in a few seconds; energy builds far less for its damage', () => {
    const bar = assembleFrame('vanguard').stab.max;
    const auto = WEAPONS.filter((W) => W.impact === 'ballistic' && W.rof);
    expect(auto.length).toBeGreaterThan(0);
    for (const W of auto) expect(bar / perSecond(W)).toBeLessThan(4);
    const ballistic = Math.min(...WEAPONS.filter((W) => W.impact === 'ballistic').map(perDamage));
    const energy = WEAPONS.filter((W) => W.impact === 'energy');
    expect(energy.length).toBeGreaterThan(0);
    for (const W of energy) expect(perDamage(W)).toBeLessThan(ballistic * 2);
    // (per damage, the energy shelf builds less than the ballistic one, on average a fraction of it)
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(energy.map(perDamage))).toBeLessThan(mean(WEAPONS.filter((W) => W.impact === 'ballistic').map(perDamage)) * 0.6);
  });
});
