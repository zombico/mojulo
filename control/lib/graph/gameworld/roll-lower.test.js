import { describe, it, expect } from 'vitest';
import { readWorldRoll, rollOfLevel, BODY } from './roll-lower.js';
import { runSteps, readGameworld } from './index.js';
import { quickWorld } from './quick.js';
import { practiceFor } from './practice.js';
import { readRoll, pickupsOf, rollWays } from '../game/roll.js';

// A WORLD'S ROLL, lowered: each walking level a run lays on a trail takes a roll over its own cover and pickups.
const level = (quick, world = {}) => runSteps(quickWorld({ id: 'rl', quick, ...world }), { ref: 'gw' }).find((s) => s.key.startsWith('level-')).order.manifest;

describe('the world\'s word', () => {
  it('true rolls the cover and the items; either may be left out; the malformed is refused, teaching', () => {
    expect(readWorldRoll(true)).toEqual({ cover: true, items: true });
    expect(readWorldRoll({ cover: false })).toEqual({ cover: false, items: true });
    expect(readWorldRoll(false)).toBeNull();
    expect(readWorldRoll(undefined)).toBeNull();
    expect(() => readWorldRoll('often')).toThrow(/roll is true .* or \{ cover\?/);
    expect(() => readWorldRoll({ foes: true })).toThrow(/no 'foes' \(cover, items\)/);
    expect(() => readWorldRoll({ cover: 2 })).toThrow(/roll\.cover is true or false/);
    expect(() => readWorldRoll({ cover: false, items: false })).toThrow(/rolls nothing/);
  });

  it('a read world carries it, and so has the roll room', () => {
    const W = readGameworld(quickWorld({ id: 'rl', quick: { goal: 'collect' }, roll: true }));
    expect(W.roll).toEqual({ cover: true, items: true });
    expect(practiceFor(W).rooms).toContain('roll');
    expect(readGameworld(quickWorld({ id: 'rl', quick: { goal: 'collect' } })).roll).toBeUndefined();
    expect(() => readGameworld(quickWorld({ id: 'rl', quick: { goal: 'collect' }, roll: 'yes' }))).toThrow(/roll is true/);
  });
});

describe('one level\'s roll', () => {
  const cover = [{ form: 'wall', at: [0, 0, 0] }, { form: 'crate', at: [1, 0, 0] }, { id: 'gate', form: 'wall', at: [2, 0, 0] }];
  const mechanics = [{ kind: 'collect', into: 'bag', pickups: [{ item: 'gem', at: [0, 0, 0] }, { id: 'crown', item: 'gem', at: [1, 0, 0] }, { item: 'gem', at: [2, 0, 0] }] }, { kind: 'reach-exit', at: [9, 0, 0] }];

  it('names what has no id, keeps the ids there are, and rolls half or more and never all', () => {
    const L = rollOfLevel(true, { cover, mechanics, rule: { type: 'walk', speed: 4 } });
    expect(L.cover.map((b) => b.id)).toEqual(['cover-1', 'cover-2', 'gate']);
    expect(L.mechanics[0].pickups.map((p) => p.id)).toEqual(['item-1', 'crown', 'item-3']);
    expect(L.roll).toEqual({ cover: [{ of: ['cover-1', 'cover-2', 'gate'], stand: [2, 2] }], items: [{ of: ['item-1', 'crown', 'item-3'], lay: [2, 2] }] });
    // the level's own roll reads it as written
    expect(() => readRoll(L.roll, { blocks: L.cover, pickups: pickupsOf(L.mechanics) })).not.toThrow();
    // what was given is not written over
    expect(cover[0].id).toBeUndefined();
    expect(mechanics[0].pickups[0].id).toBeUndefined();
  });

  it('a pilot with no body is given one; one with a body keeps its own', () => {
    expect(rollOfLevel(true, { cover, mechanics, rule: { type: 'walk', speed: 4 } }).rule).toEqual({ type: 'walk', speed: 4, ...BODY });
    const own = { type: 'platform', collideRadius: 0.45 };
    expect(rollOfLevel(true, { cover, mechanics, rule: own }).rule).toBe(own);
  });

  it('one of a kind is nothing to roll; nothing to roll at all, the level is as it was', () => {
    expect(rollOfLevel(true, { cover: cover.slice(0, 1), mechanics }).roll).toEqual({ items: [{ of: ['item-1', 'crown', 'item-3'], lay: [2, 2] }] });
    expect(rollOfLevel({ items: false }, { cover, mechanics }).roll).toEqual({ cover: [{ of: ['cover-1', 'cover-2', 'gate'], stand: [2, 2] }] });
    const rule = { type: 'walk' }, none = rollOfLevel(true, { cover: [], mechanics: [{ kind: 'reach-exit', at: [9, 0, 0] }], rule });
    expect(none).toMatchObject({ roll: null, cover: [] });
    expect(none.rule).toBe(rule);
    expect(rollOfLevel(false, { cover, mechanics })).toBeNull();
  });
});

describe('a run\'s level', () => {
  it('a collectathon on a trail: its cover laid and named, its gems named, a roll over both, its walker given a body', () => {
    const M = level({ goal: 'collect' }, { roll: true });
    const read = readRoll(M.roll, { blocks: M.blocks, pickups: pickupsOf(M.game.mechanics) });
    expect(read.cover[0].of.length).toBeGreaterThanOrEqual(2);
    expect(read.cover[0].of).toEqual(M.blocks.map((b) => b.id));
    expect(read.items[0].of).toHaveLength(M.game.mechanics.find((m) => m.kind === 'collect').pickups.length);
    expect(rollWays(read)).toBeGreaterThan(10);
    expect(M.entities[0].rule.collideRadius).toBe(BODY.collideRadius);
  });

  it('a world that does not roll: its level to the last byte as it was; items alone lays no cover', () => {
    const plain = level({ goal: 'collect' });
    expect(plain.roll).toBeUndefined();
    expect(plain.blocks).toBeUndefined();
    expect(plain.entities[0].rule.collideRadius).toBeUndefined();
    expect(JSON.stringify(level({ goal: 'collect' }, { roll: false }))).toBe(JSON.stringify(plain));
    const items = level({ goal: 'collect' }, { roll: { cover: false } });
    expect(items.blocks).toBeUndefined();
    expect(Object.keys(items.roll)).toEqual(['items']);
  });

  it('a level that is no trail walked on foot is left as it is', () => {
    const race = level({ goal: 'race', ride: 'car', roadway: 'kart-oval' }, { roll: true });
    expect(race.roll).toBeUndefined();
  });
});
