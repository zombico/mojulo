// A skill tree: a school's techniques, the order they are come by, what each costs; lowered to a party class and its
// skills, and read back by the party RPG's reader.
import { describe, it, expect } from 'vitest';
import { DOES, DOES_IDS, DEPTH, MAX_RANK, TREE, newTree, intensifyTree, readTree, depthsOf, derivedCosts, treeLaws, lowerTree } from './tree.js';
import { depthOf, openOf, rawNewCeiling, checkPass } from './passes.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { treeDiagram } from './diagram.js';

const by = (laws) => Object.fromEntries(laws.map((l) => [l.law, l]));
// the smallest tree that has both ways of coming by a technique, and a requirement
const premise = { id: 'pyre', element: 'flame', techniques: [{ id: 'spark', does: 'bolt' }, { id: 'kindle', does: 'surge' }, { id: 'smoulder', does: 'hex', status: 'poison' }, { id: 'wildfire', does: 'storm' }] };
const order = { spark: { at: 1 }, kindle: { at: 2 }, smoulder: { requires: ['spark'] }, wildfire: { requires: ['smoulder', 'kindle'] } };
const whole = () => intensifyTree(newTree(premise), { order, costs: true }).tree;

describe('a tree, made in passes', () => {
  it('raw-new says the school and what its techniques do, and stops', () => {
    const T = newTree(premise);
    expect(T.element).toBe('fire');
    expect(depthOf(TREE, T)).toBe(1);
    expect(rawNewCeiling(TREE)).toBe(1);
    for (const l of checkPass(TREE, 'raw-new', null, T)) expect(l.ok, l.law).toBe(true);
    expect(openOf(TREE, T)).toEqual({ rung: 'ordered', missing: ['order'] });
    expect(treeLaws(T)).toEqual([]);
    expect(() => newTree({ ...premise, order })).toThrow(/order is not a raw-new pass's/);
  });

  it('intensify lays the order, then the costs, in that order, touching nothing below', () => {
    const T = newTree(premise);
    const o = intensifyTree(T, { order });
    expect(o.open).toEqual(['costs']);
    const done = intensifyTree(o.tree, { costs: true });
    expect(done.open).toEqual([]);
    expect(depthOf(TREE, done.tree)).toBe(3);
    for (const l of checkPass(TREE, 'intensify', T, done.tree)) expect(l.ok, l.law).toBe(true);
    expect(() => intensifyTree(T, { costs: true })).toThrow(/costs are said before its order/);
    expect(() => intensifyTree(T, { element: 'ice' })).toThrow(/is its premise/);
    expect(() => intensifyTree(o.tree, { order })).toThrow(/already said/);
  });

  it('says what is wrong', () => {
    expect(() => readTree({ ...premise, element: 'plasma' })).toThrow(/no element the character book knows/);
    expect(() => readTree({ ...premise, techniques: [{ id: 'spark', does: 'zap' }] })).toThrow(/does is what it does: bolt, storm/);
    expect(() => readTree({ ...premise, techniques: [{ id: 'curse', does: 'hex' }] })).toThrow(/status is what a hex afflicts with: poison, sleep, silence/);
    expect(() => readTree({ ...premise, techniques: [{ id: 'spark', does: 'bolt', status: 'sleep' }] })).toThrow(/status is a hex's alone/);
    expect(() => readTree({ ...premise, order: { ...order, wildfire: { at: 1, requires: [] } } })).toThrow(/\{ at: rank \} \(learned\) or \{ requires/);
    expect(() => readTree({ ...premise, order: { ...order, wildfire: { requires: ['ember'] } } })).toThrow(/'ember' is no technique of this tree/);
    expect(() => readTree({ ...premise, order: { spark: { at: 1 } } })).toThrow(/says nothing of kindle, smoulder, wildfire/);
  });
});

describe('depth and cost', () => {
  it('a learned technique stands at its rank less one; a bought one a step under the deepest it requires', () => {
    expect(depthsOf(whole())).toEqual({ spark: 0, kindle: 1, smoulder: 1, wildfire: 2 });
    // bought, requiring nothing: under the first rank
    expect(depthsOf(readTree({ ...premise, order: { ...order, smoulder: { requires: [] } } })).smoulder).toBe(1);
  });

  it('the deeper, the dearer: MP by depth, a point a step for a bought one, none for a learned one', () => {
    const C = derivedCosts(intensifyTree(newTree(premise), { order }).tree);
    expect(C.spark).toEqual({ mp: DOES.bolt.mp });
    expect(C.smoulder).toEqual({ mp: Math.round(DOES.hex.mp * (1 + DEPTH.mp)), points: 1 });
    expect(C.wildfire).toEqual({ mp: Math.round(DOES.storm.mp * (1 + DEPTH.mp * 2)), points: 2 });
    // the author's own lies over it
    expect(intensifyTree(newTree(premise), { order, costs: { wildfire: { mp: 12 } } }).tree.costs.wildfire).toEqual({ mp: 12, points: 2 });
  });
});

describe('treeLaws', () => {
  it('the smallest whole tree holds every law', () => {
    for (const l of treeLaws(whole())) expect(l.ok, l.law).toBe(true);
  });

  it('says a tree with nothing learned at rank 1, techniques that require each other, and one past the last rank', () => {
    const none = by(treeLaws(readTree({ ...premise, order: { ...order, spark: { at: 2 } } })));
    expect(none.rooted.ok).toBe(false);
    const loop = by(treeLaws(readTree({ ...premise, order: { ...order, smoulder: { requires: ['wildfire'] } } })));
    expect(loop['no-cycle']).toMatchObject({ ok: false, value: 'smoulder, wildfire' });
    expect(loop.reachable).toMatchObject({ ok: false, value: 'smoulder, wildfire' });
    expect(by(treeLaws(readTree({ ...premise, order: { ...order, kindle: { at: MAX_RANK + 1 } } })))['within-reach'].ok).toBe(false);
  });

  it('says a technique that costs less than what it requires', () => {
    const cheap = intensifyTree(newTree(premise), { order, costs: { wildfire: { mp: 1 } } }).tree;
    expect(by(treeLaws(cheap))['costs-rise']).toMatchObject({ ok: false, value: 'wildfire under smoulder, wildfire under kindle' });
  });
});

describe('lowerTree', () => {
  it('needs the costed rung, and a tree that can be reached', () => {
    expect(() => lowerTree(newTree(premise))).toThrow(/lowers once it is costed: it is at its premise/);
  });

  it('gives the school a class and each technique a skill of its element; the game\'s own reader takes them', () => {
    const { classes, skills } = lowerTree(whole());
    expect(classes.pyre.skills).toEqual([
      { skill: 'pyre-spark', at: 1 }, { skill: 'pyre-kindle', at: 2 },
      { skill: 'pyre-smoulder', cost: 1, requires: ['pyre-spark'] }, { skill: 'pyre-wildfire', cost: 2, requires: ['pyre-smoulder', 'pyre-kindle'] },
    ]);
    expect(skills['pyre-spark']).toMatchObject({ name: 'Spark', element: 'fire', target: 'foe', mp: DOES.bolt.mp, power: DOES.bolt.skill.power });
    expect(skills['pyre-smoulder'].status).toMatchObject({ is: 'poison' });
    expect(skills['pyre-kindle']).not.toHaveProperty('element');
    // deeper is stronger
    expect(skills['pyre-wildfire'].power).toBe(Math.round(DOES.storm.skill.power * (1 + DEPTH.power * 2)));
    const cfg = readRpg({ rpg: { party: [{ id: 'hero', class: 'pyre' }], classes, skills } });
    expect(cfg).toBeTruthy();
  });

  it('every way a technique can do something lowers to a skill the reader takes', () => {
    // one technique a `does`, each learned in turn: the table is the input, the lowering the procedure
    const all = { id: 'all', element: 'ice', techniques: DOES_IDS.map((d) => ({ id: d, does: d, ...(DOES[d].status ? { status: 'sleep' } : {}) })) };
    const T = intensifyTree(newTree(all), { order: Object.fromEntries(DOES_IDS.map((d, i) => [d, { at: 1 + (i % MAX_RANK) }])), costs: true }).tree;
    const { classes, skills } = lowerTree(T);
    expect(Object.keys(skills)).toHaveLength(DOES_IDS.length);
    expect(readRpg({ rpg: { party: [{ id: 'hero', class: 'all' }], classes, skills } })).toBeTruthy();
  });

  it('is deterministic', () => {
    expect(lowerTree(whole())).toEqual(lowerTree(whole()));
  });
});

describe('the tree, drawn', () => {
  const kinds = (M, k) => M.marks.filter((m) => m.kind === k);

  it('draws each technique once, an arrow a requirement, and how each is come by', () => {
    const T = whole(), M = treeDiagram(T), said = kinds(M, 'text').map((t) => t.value);
    expect(kinds(M, 'rect')).toHaveLength(premise.techniques.length);
    expect(kinds(M, 'line').length + kinds(M, 'polyline').length).toBe(3);
    expect(said).toEqual(expect.arrayContaining(['Spark', 'learned at rank 1', 'bought: 2 points']));
    expect(treeDiagram(T)).toEqual(M);
  });

  it('a premise is drawn in no order; a technique that cannot be reached is marked', () => {
    expect(kinds(treeDiagram(newTree(premise)), 'line')).toHaveLength(0);
    const loop = readTree({ ...premise, order: { ...order, smoulder: { requires: ['wildfire'] } } });
    const said = kinds(treeDiagram(loop), 'text').map((t) => t.value);
    expect(said).toContain('cannot be reached');
    expect(said.some((x) => /require each other/.test(x))).toBe(true);
  });
});
