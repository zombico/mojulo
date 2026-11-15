// A MONSTER MANUAL ON THE BATTLES PAGE: a lore part a game is laid from. The manual is a floor under the page's own
// words; the rungs it lacks are derived and said; what it lowers is read by the party RPG's own reader.
import { describe, it, expect } from 'vitest';
import { manualBattles, manualOrder, ROLE_BEASTS } from './battles-manual.js';
import { readBattles, battleBase, battlePlan, foeLookOf, BATTLE_FOE } from './battles.js';
import { newManual, intensifyManual } from '../lorecube/manual.js';
import { readGameworld } from './index.js';

const PREMISE = { name: 'The Thawing Marches', polarity: 'classical-four', creatures: [
  { id: 'storm-king', element: 'wind', role: 'boss' },
  { id: 'stone-ward', element: 'earth', role: 'elite' },
  { id: 'ember-imp', element: 'fire', role: 'grunt' },
  { id: 'tide-eel', element: 'water', role: 'harrier' },
] };

describe('a manual as an order the battles chapter runs', () => {
  it('says how deep it has been taken and which rungs are still derived', () => {
    const M = newManual(PREMISE);
    expect(manualOrder(M)).toEqual({ name: 'The Thawing Marches', rung: 'premise', open: ['affinity', 'levels'], creatures: 4 });
    const deeper = intensifyManual(M, { affinity: true }).manual;
    expect(manualOrder(deeper)).toMatchObject({ rung: 'affinity', open: ['levels'] });
    expect(manualOrder(intensifyManual(deeper, { levels: true }).manual)).toMatchObject({ rung: 'numbered', open: [] });
  });

  it('gives the page its foes, their skills, a ladder by level and role, and the boss alone', () => {
    const B = manualBattles(newManual(PREMISE));
    expect(Object.keys(B.foes)).toEqual(PREMISE.creatures.map((c) => c.id));
    expect(B.foes['storm-king'].boss).toBe(true);
    for (const f of Object.values(B.foes)) for (const s of f.skills) expect(B.skills[s], s).toBeTruthy();
    // met in the order of their levels: the grunt a pair, the harrier beside it, the elite between two of it
    expect(B.packs).toEqual([['ember-imp', 'ember-imp'], ['tide-eel', 'ember-imp'], ['ember-imp', 'stone-ward', 'ember-imp']]);
    expect(B.boss).toEqual(['storm-king']);
    expect(B.order.lacks.length).toBeGreaterThan(0);
  });

  it('gives each creature a look: a body by its role, grown by its element, two of a role told apart', () => {
    const two = { ...PREMISE, creatures: [...PREMISE.creatures, { id: 'frost-imp', element: 'ice', role: 'grunt' }] };
    const L = manualBattles(newManual(two)).looks;
    expect(Object.keys(L)).toEqual(two.creatures.map((c) => c.id));
    for (const c of two.creatures) expect(ROLE_BEASTS[c.role], c.id).toContain(L[c.id].species);
    expect(L['ember-imp'].species).not.toBe(L['frost-imp'].species);
    expect(L['ember-imp'].ooze).toBe('fire');
    expect(L['ember-imp'].ooze).not.toBe(L['frost-imp'].ooze);
    // each is a look the battles page itself would take (its own reader), and the page's own look wins
    expect(() => readBattles({ looks: L })).not.toThrow();
    const G = { battles: readBattles({ manual: two, looks: { 'ember-imp': { people: 'skeleton' } } }) };
    expect(foeLookOf(G, 'ember-imp')).toEqual({ people: 'skeleton' });
    expect(foeLookOf(G, 'storm-king')).toEqual(L['storm-king']);
    expect(foeLookOf(G, 'storm-king')).not.toBe(BATTLE_FOE);
  });

  it('the author\'s own levels move the ladder; the same manual gives the same page', () => {
    const own = intensifyManual(intensifyManual(newManual(PREMISE), { affinity: true }).manual, { levels: { 'tide-eel': 1, 'ember-imp': 2 } }).manual;
    expect(manualBattles(own).packs[0]).toEqual(['tide-eel']);
    expect(manualBattles(own)).toEqual(manualBattles(own));
  });
});

describe('battles.manual on a gameworld', () => {
  const world = (battles) => ({ id: 'w', levels: { one: { walk: { nodes: { a: { trail: {} } } } } }, battles });

  it('is a floor: the page\'s own foes, packs and boss win, and the RPG\'s reader takes what it lays', () => {
    const laid = readBattles({ manual: PREMISE });
    expect(laid.packs).toHaveLength(3);
    expect(laid.boss).toEqual(['storm-king']);
    expect(Object.keys(battleBase({ battles: laid }).foes)).toContain('ember-imp');
    const own = readBattles({ manual: PREMISE, packs: [['ember-imp']], foes: { 'ember-imp': { name: 'Cinder', hp: 9, atk: 2, def: 1, mag: 1, spd: 3, xp: 1, gold: 1 } } });
    expect(own.packs).toEqual([['ember-imp']]);
    expect(own.foes['ember-imp'].name).toBe('Cinder');
    expect(own.foes['tide-eel']).toBeTruthy();
    // a stage meets the manual's packs, its boss the last
    const G = readGameworld(world({ manual: PREMISE }));
    const plan = battlePlan(G, [{ level: 'one', section: 'trail' }]);
    expect(plan[0].at(-1)).toEqual(['storm-king']);
    expect(plan[0][0]).toEqual(['ember-imp', 'ember-imp']);
  });

  it('teaches a malformed manual where it was written, and a page with none is as it was', () => {
    expect(() => readGameworld(world({ manual: { polarity: 'classical-four', creatures: [{ id: 'x', element: 'plaid', role: 'grunt' }] } }))).toThrow(/battles.*manual.*element 'plaid'/);
    expect(readBattles({ per: 1 })).toEqual({ per: 1 });
  });
});
