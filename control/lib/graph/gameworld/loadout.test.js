// A WORLD'S GUNS, READ (loadout.js): one case per source (a quick shooter's kit, the hero's carried gun, the feel
// template's own), the order they are read in, a world with none; every template loadout a range can be set up from.
import { describe, expect, it } from 'vitest';

import { loadoutOf, TEMPLATE_LOADOUTS } from './loadout.js';
import { validateRange } from './combat/range.js';
import { POLES } from './feel/cards.js';

// (templates chosen by what they are: one whose loadout carries a blade, one that shoots and has none)
const WITH_KNIFE = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.some((w) => w.fire === 'melee'));
const NO_GUNS = Object.keys(POLES).find((id) => !TEMPLATE_LOADOUTS[id] && !POLES[id].demo.includes('shoot'));

describe('a world\'s guns', () => {
  it('a quick shooter\'s kit, its words as the kit\'s and its build words dressed, the free hand\'s knife after them', () => {
    const L = loadoutOf({ quick: { goal: 'shoot', arms: ['carbine', { item: 'pistol', model: 'service', parts: { grip: 'stippled' } }] } });
    expect(L.from).toBe('quick');
    expect(L.weapons).toEqual(['carbine', 'handgun', { name: 'knife', fire: 'melee' }]);
    expect(L.skins).toEqual({ handgun: { item: 'pistol', model: 'service', parts: { grip: 'stippled' } } });
    expect(validateRange(L)).toEqual([]);
  });
  it('the hero\'s carried gun when the world is not a quick shooter: its build words read to the kit word', () => {
    const G = { characters: { hero: { adornment: { items: [{ id: 'gun', slot: 'right', serves: ['shoot'], build: { item: 'carbine' } }] } } } };
    expect(loadoutOf(G)).toEqual({ weapons: ['carbine'], from: 'hero' });
  });
  it('else the feel template\'s own; what the world carries comes first', () => {
    expect(loadoutOf({ feel: WITH_KNIFE })).toMatchObject({ from: 'template', template: WITH_KNIFE, weapons: TEMPLATE_LOADOUTS[WITH_KNIFE].weapons });
    expect(loadoutOf({ feel: WITH_KNIFE, quick: { goal: 'shoot', arms: ['sniper'] } }).weapons[0]).toBe('sniper');
  });
  it('a world that carries no gun, under a template that shoots none, has none', () => {
    expect(loadoutOf({ feel: NO_GUNS })).toBeNull();
    expect(loadoutOf({})).toBeNull();
  });
  it('a template\'s loadout sets up a range, one of each shape: a blade in the free hand, a launcher, guns alone', () => {
    const ids = Object.keys(TEMPLATE_LOADOUTS), shape = (id) => TEMPLATE_LOADOUTS[id].weapons;
    const cases = [WITH_KNIFE, ids.find((id) => shape(id).some((w) => w.fire === 'projectile')), ids.find((id) => shape(id).every((w) => typeof w === 'string'))];
    for (const id of cases) {
      expect(POLES[id], id).toBeTruthy();
      expect(validateRange({ weapons: shape(id) }), id).toEqual([]);
    }
  });
});
