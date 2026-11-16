// A SKILL TREE ON THE BATTLES PAGE: a school is a class the party can be in, a floor under the page's own words; the
// rungs it lacks are derived and said; what it lowers is read by the party RPG's own reader.
import { describe, it, expect } from 'vitest';
import { treeBattles, treeOrder, treesBattles } from './battles-tree.js';
import { readBattles, battleBase } from './battles.js';
import { newTree, intensifyTree, MAX_RANK } from '../lorecube/tree.js';
import { readRpg } from '../playscape/rpg/rpg.js';

const PREMISE = { id: 'pyre', name: 'The Pyre', element: 'fire', techniques: [
  { id: 'spark', does: 'bolt' }, { id: 'brand', does: 'blade' }, { id: 'kindle', does: 'surge' }, { id: 'wildfire', does: 'storm' },
] };

describe('a tree as an order the battles chapter runs', () => {
  it('says how deep it has been taken and which rungs are still derived', () => {
    const T = newTree(PREMISE);
    expect(treeOrder(T)).toEqual({ id: 'pyre', name: 'The Pyre', rung: 'premise', open: ['order', 'costs'], techniques: 4 });
    const ordered = intensifyTree(T, { order: { spark: { at: 1 }, brand: { at: 2 }, kindle: { requires: ['spark'] }, wildfire: { requires: ['brand', 'kindle'] } } }).tree;
    expect(treeOrder(ordered)).toMatchObject({ rung: 'ordered', open: ['costs'] });
    expect(treeOrder(intensifyTree(ordered, { costs: true }).tree)).toMatchObject({ rung: 'costed', open: [] });
  });

  it('gives the page a class and a skill a technique; with no order, learned rank by rank as written', () => {
    const B = treeBattles(newTree(PREMISE));
    expect(Object.keys(B.classes)).toEqual(['pyre']);
    const entries = B.classes.pyre.skills;
    expect(entries.map((e) => e.skill)).toEqual(PREMISE.techniques.map((t) => `pyre-${t.id}`));
    for (const e of entries) expect(B.skills[e.skill], e.skill).toBeTruthy();
    // the first learned at rank 1, each next a rank on while the class has ranks
    expect(entries[0]).toEqual({ skill: 'pyre-spark', at: 1 });
    expect(entries.slice(0, MAX_RANK).every((e, i) => e.at === i + 1)).toBe(true);
    // deeper costs more
    expect(B.skills['pyre-wildfire'].mp).toBeGreaterThan(B.skills['pyre-spark'].mp);
    expect(treeBattles(newTree(PREMISE))).toEqual(B);
  });

  it('takes one school or several, each once', () => {
    const two = treesBattles([PREMISE, { ...PREMISE, id: 'tide', element: 'water' }]);
    expect(Object.keys(two.classes)).toEqual(['pyre', 'tide']);
    expect(two.orders.map((o) => o.id)).toEqual(['pyre', 'tide']);
    expect(() => treesBattles([PREMISE, PREMISE])).toThrow(/said twice/);
  });
});

describe('battles.tree on a gameworld', () => {
  it('is a floor: the school joins the classes a party can be in, the presets kept, the page\'s own class winning', () => {
    const laid = readBattles({ tree: PREMISE });
    const base = battleBase({ battles: laid });
    const R = readRpg({ rpg: base });
    // the hero is still what it was by default, and can be the school's
    expect(R).toBeTruthy();
    expect(() => readBattles({ tree: PREMISE, party: { hero: { class: 'pyre' } } })).not.toThrow();
    const own = readBattles({ tree: PREMISE, classes: { pyre: { name: 'Ash Order', skills: [{ skill: 'pyre-spark', at: 1 }] } } });
    expect(own.classes.pyre.name).toBe('Ash Order');
    expect(own.skills['pyre-brand']).toBeTruthy();
  });

  it('teaches a malformed tree where it was written, and a page with none is as it was', () => {
    expect(() => readBattles({ tree: { id: 'pyre', element: 'fire', techniques: [{ id: 'x', does: 'juggle' }] } })).toThrow(/battles.*tree/);
    expect(readBattles({ per: 1 })).toEqual({ per: 1 });
  });
});
