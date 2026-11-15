// THE LOADOUT (carried.js): what the hero carries of the arsenal. One kit with two melee weapons and a sidearm, chosen
// from the templates in code: the carried weapons in slot order, a pick over the start, a world with no loadout unchanged.
import { describe, it, expect } from 'vitest';
import { readLoadout, loadoutOf, carriedOf, LOADOUT_SLOTS } from './carried.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { armLevel } from './arsenal.js';
import { GAMEWORLD_KEYS } from './world.js';

const KIT = Object.keys(TEMPLATE_ARSENALS).find((id) => TEMPLATE_ARSENALS[id].weapons.length >= 2 && (TEMPLATE_ARSENALS[id].ranged ?? []).length);
const A = TEMPLATE_ARSENALS[KIT], [W1, W2] = A.weapons.map((W) => W.id), SIDE = A.ranged[0].id;
const pilot = (sheath) => ({ id: 'hero', pilotable: true, rule: { strikeContact: [0.3, 0.6], ...(sheath ? { combat: { sheathed: 'hero-sheathed' } } : {}) } });

describe('the loadout', () => {
  it('is what the hero carries: two melee weapons unsaid, in the order the cycle steps, the sidearm or none', () => {
    expect(GAMEWORLD_KEYS).toContain('loadout');
    expect(LOADOUT_SLOTS.melee).toBe(2);
    expect(loadoutOf({ loadout: {} }, A)).toMatchObject({ melee: [W1, W2], sidearm: SIDE });
    const back = carriedOf({ loadout: { start: { melee: [W2, W1] } } }, A);
    expect(back.weapons.map((W) => W.id)).toEqual([W2, W1]);
    const one = carriedOf({ loadout: { slots: { melee: 1 }, start: { melee: [W2], sidearm: false } } }, A);
    expect(one.weapons.map((W) => W.id)).toEqual([W2]);
    expect(one.ranged).toBeUndefined();
  });
  it('takes a choice made in play over the start, held to its slots', () => {
    const G = { loadout: { slots: { melee: 1 }, start: { melee: [W1] } } };
    expect(carriedOf(G, A, { melee: [W2] }).weapons.map((W) => W.id)).toEqual([W2]);
    expect(carriedOf(G, A, { melee: [W2, W1] }).weapons.length).toBe(1);
    expect(carriedOf(G, A, { melee: ['nothing'] }).weapons.map((W) => W.id)).toEqual([W1]);
  });
  it('leaves a world that writes none as it was, and is laid on a level\'s hero where it is written', () => {
    expect(carriedOf({}, A)).toBe(A);
    const M = { entities: [pilot(true)] };
    const all = armLevel({ arsenal: KIT }, M), one = armLevel({ arsenal: KIT, loadout: { slots: { melee: 1 }, start: { melee: [W2] } } }, M);
    expect(all.entities[0].rule.weapons.length).toBe(A.weapons.length);
    expect(one.entities[0].rule.weapons.length).toBe(1);
    expect(JSON.stringify(armLevel({ arsenal: KIT, loadout: undefined }, M))).toBe(JSON.stringify(all));
  });
  it('says what it takes', () => {
    for (const [bad, says] of [[[], /is \{ slots/], [{ gear: 1 }, /has no 'gear'/], [{ slots: { melee: 0 } }, /slots is/], [{ start: { melee: [W1, W1] } }, /each once/], [{ start: { melee: ['axe'] } }, /no weapon of the arsenal/], [{ slots: { melee: 1 }, start: { melee: [W1, W2] } }, /for 1 slot/], [{ start: { sidearm: 'cannon' } }, /sidearm is/]]) expect(() => readLoadout(bad, A), JSON.stringify(bad)).toThrow(says);
  });
});
