import { describe, it, expect } from 'vitest';
import { readTrees, treeLaws, lowerTrees, nodeStates, TREE_LAWS } from './tree.js';
import { MOVE_SKILL_IDS, moveSkillPatch } from './movement.js';
import { TECH_IDS, techCombos } from './techs.js';
import { feelRule, feelCombos } from '../feel/lower.js';
import { VAMPIRE_SONATA_FEEL, VAMPIRE_SONATA_POWERS, VAMPIRE_SONATA_TREES } from '../metroidvania/vampire-sonata.js';

const rule = feelRule(VAMPIRE_SONATA_FEEL), combos = feelCombos(VAMPIRE_SONATA_FEEL);
const words = () => structuredClone(VAMPIRE_SONATA_TREES);
const lost = (w, ctx) => treeLaws(readTrees(w), ctx).filter((l) => !l.holds).map((l) => l.id);

describe('a game\'s trees', () => {
  it('reads the skill tree on movement and the tech tree on spells and attacks, refusing, teaching, what it cannot', () => {
    const R = readTrees(words());
    expect(R.trees.map((t) => t.id)).toEqual(['movement', 'techs']);
    expect(R.trees[0].nodes[0]).toMatchObject({ id: 'double-jump', row: 'double-jump', found: 'second-leap', cost: 0 });
    expect(() => readTrees({})).toThrow(/a tree at least/);
    expect(() => readTrees({ movement: { nodes: [{ move: 'teleport' }] } })).toThrow(/a way to move: double-jump/);
    expect(() => readTrees({ techs: { nodes: [{ tech: 'thrust', requires: ['cleave'] }] } })).toThrow(/requires 'cleave', no node of its tree/);
    expect(() => readTrees({ movement: { nodes: [{ move: 'glide', found: 'x', cost: 1 }] } })).toThrow(/never bought/);
    expect(() => readTrees({ points: { gold: 1 }, movement: { nodes: [{ move: 'glide' }] } })).toThrow(/points is/);
  });

  it('holds Vampire Sonata\'s trees to their laws, and says a cycle, a cheaper node deeper, an unknown power, a node out of means', () => {
    expect(treeLaws(readTrees(words()), { powers: VAMPIRE_SONATA_POWERS, earnable: 7 }).map((l) => l.id)).toEqual([...TREE_LAWS]);
    expect(lost(words(), { powers: VAMPIRE_SONATA_POWERS, earnable: 7 })).toEqual([]);
    const cyc = words(); cyc.techs.nodes[0].requires = ['cleave'];
    expect(lost(cyc)).toEqual(expect.arrayContaining(['no-cycle', 'reachable']));
    const cheap = words(); cheap.techs.nodes[3].cost = 1;
    expect(lost(cheap)).toContain('costs-rise');
    const lost1 = words(); lost1.movement.nodes[0].found = 'bat-form';
    expect(lost(lost1, { powers: VAMPIRE_SONATA_POWERS })).toContain('found-known');
    expect(lost(words(), { earnable: 4 })).toContain('within-means');
  });

  it('turns each way to move from the hero\'s own rule, by paths, and refuses what the hero has nothing of to turn', () => {
    expect(MOVE_SKILL_IDS).toContain('air-dash');
    expect(moveSkillPatch('swift', rule).speed).toBeGreaterThan(rule.speed);
    expect(moveSkillPatch('air-dash', rule)).toEqual({ 'dash.air.count': rule.dash.air.count + 1 });
    expect(() => moveSkillPatch('air-dash', { speed: 5 })).toThrow(/turns the hero's dash.air.count/);
  });

  it('adds each attack and spell to the hero\'s own strings, a fork played by its own moves, each string held shut', () => {
    const T = techCombos(combos, TECH_IDS);
    expect(Object.values(T.gated)).toEqual([...TECH_IDS]);
    const own = combos.combos.find((c) => c.beats.join('') === 'LLL'), cleave = T.manifest.combos.find((c) => c.id === 'tech:cleave');
    expect(cleave.beats).toEqual(['L', 'L', 'H']);
    expect(cleave.moves.slice(0, 2)).toEqual(own.moves.slice(0, 2));
    const { spec, moveset } = lowerTrees(readTrees(words()), { rule, combos, powers: VAMPIRE_SONATA_POWERS });
    expect(Object.keys(moveset.gated).length).toBe(TECH_IDS.length);
    expect(moveset.tree.L.combos).toEqual(expect.arrayContaining([own.id, 'tech:cleave']));
    expect(spec.nodes.find((n) => n.id === 'double-jump')).toMatchObject({ found: 'gate:double-jump', patch: { airJumps: 1 } });
    expect(spec.nodes.find((n) => n.id === 'soul-burst')).toMatchObject({ combos: ['tech:soul-burst'], kind: 'spell' });
    // (what the screen draws: learned, the found one waiting for its power, what can be bought, what is locked)
    const st = Object.fromEntries(nodeStates(spec, { thrust: 0 }, 1).map((n) => [n.id, n.state]));
    expect(st).toMatchObject({ 'double-jump': 'found', thrust: 'learned', cleave: 'available', 'rising-cut': 'locked', swift: 'available' });
  });
});
