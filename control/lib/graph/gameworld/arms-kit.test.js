// arms-kit — a shooter's carried arms by the words a person says: each word an arm of the arms kernel (or the bow) on the
// weapon row and the gunplay its slot carries, its numbers following its archetype and scaled to the goal's base round;
// the quick door takes them on the shoot and deathmatch goals and refuses them elsewhere by name.
import { describe, expect, it } from 'vitest';
import { kitSlot, armsLoadout, validateArmsKit, ARMS_KIT, ARMS_KIT_WORDS, ARMS_MAX, BOW, ADS } from './arms-kit.js';
import { readQuick, SHOOT } from './quick.js';
import { ROUNDS } from './rounds.js';
import { composeLive } from '../worlds/controllable/compose.js';

// one word per archetype, chosen from the table
const byArchetype = Object.values(Object.groupBy(ARMS_KIT_WORDS, (w) => ARMS_KIT[w].as)).map((g) => g[0]);

describe('arms kit', () => {
  it('each archetype: a weapon row with its sights, its sway and its switch\'s two halves; a scope zooms and nearly closes the cone', () => {
    for (const w of byArchetype) {
      const s = kitSlot(w, SHOOT.rifle, { eye: 1.5 });
      expect(s.weapon.eye, w).toBe(1.5);
      expect(s.switchReady, w).toBeCloseTo(s.gunplay.swap.out + s.gunplay.swap.in, 6);
      expect(s.gunplay.ads.zoom, w).toBeGreaterThanOrEqual(1.25);
      expect(s.gunplay.ads.time, w).toBeGreaterThan(0.1);
      if (w !== 'bow') { expect(s.gunplay.view.boxes.length, w).toBeGreaterThan(4); expect(s.gunplay.view.sight.y, w).toBeGreaterThan(0); }
    }
    const sn = kitSlot('sniper', SHOOT.rifle), rf = kitSlot('rifle', SHOOT.rifle);
    expect(sn.gunplay.ads).toMatchObject({ scope: true, zoom: 8, spread: ADS.scopedSpread });
    expect(sn.weapon.damage).toBeGreaterThan(rf.weapon.damage * 4);
    expect(rf.weapon.auto).toBe(true); expect(sn.weapon.auto).toBe(false);
    expect(sn.gunplay.view.relief).toBeGreaterThan(5);
  });
  it('the numbers scale to the goal\'s base round, and an arm named by its build words takes its sight\'s archetype', () => {
    const half = kitSlot('rifle', { ...SHOOT.rifle, damage: 0.5 }), one = kitSlot('rifle', SHOOT.rifle);
    expect(half.weapon.damage * 2).toBeCloseTo(one.weapon.damage, 6);
    expect(kitSlot({ item: 'rifle', model: 'marksman' }, SHOOT.rifle).weapon.cooldown).toBe(kitSlot('marksman', SHOOT.rifle).weapon.cooldown);
  });
  it('the bow: a drawn charge loosing an arrow that falls, its speed and damage a range from a twitch to full', () => {
    const b = kitSlot('bow', SHOOT.rifle);
    expect(b.weapon).toMatchObject({ fireClass: 'lob', chargeTime: BOW.draw, magazine: 1, projectileGravity: BOW.gravity, smokeTrail: false });
    expect(b.gunplay.draw.speed).toEqual(BOW.speed);
    expect(b.gunplay.draw.damage[1]).toBeGreaterThan(b.gunplay.draw.damage[0]);
  });
  it('validation names the words; the quick door takes arms on shoot and deathmatch only, and not beside the pole\'s floor guns', () => {
    expect(validateArmsKit(['rifle', 'bow'])).toEqual([]);
    expect(validateArmsKit(['laser'])[0]).toMatch(/not a word of the kit/);
    expect(validateArmsKit(Array(ARMS_MAX + 1).fill('rifle'))[0]).toMatch(/1 to 5/);
    expect(validateArmsKit([{ item: 'knife' }])[0]).toMatch(/a gun/);
    expect(armsLoadout(['rifle', 'handgun'], SHOOT.rifle).map((s) => s.name)).toEqual(['rifle', 'handgun']);
    expect(() => readQuick({ goal: 'shoot', arms: ['rifle', 'sniper'] })).not.toThrow();
    expect(() => readQuick({ goal: 'collect', arms: ['rifle'] })).toThrow(/shoot and deathmatch/);
    expect(() => readQuick({ goal: 'deathmatch', pole: 0, weapons: true, arms: ['rifle'] })).toThrow(/one or the other/);
    expect(() => readQuick({ goal: 'shoot', arms: ['rifle', 'plasma'] })).toThrow(/plasma/);
  });
  it('a gun\'s round: each archetype\'s cartridge class (a longer flash for a longer cartridge), the bow none; the runtime keeps it, and adds nothing without', () => {
    const rounds = byArchetype.filter((w) => w !== 'bow').map((w) => [w, kitSlot(w, SHOOT.rifle).weapon.round]);
    for (const [w, r] of rounds) expect(Object.values(ROUNDS), w).toContainEqual(r);
    expect(kitSlot('bow', SHOOT.rifle).weapon.round).toBeUndefined();
    expect(kitSlot('handgun', SHOOT.rifle).weapon.round.flash).toBeLessThan(kitSlot('shotgun', SHOOT.rifle).weapon.round.flash);
    const E = composeLive();
    expect(E.initWeapon(kitSlot('rifle', SHOOT.rifle).weapon).round).toEqual(ROUNDS.rifle);
    expect('round' in E.initWeapon({ fireClass: 'sight', magazine: 6 })).toBe(false);
  });
});

