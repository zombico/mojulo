import { describe, it, expect } from 'vitest';

import { lowerMechanic, composeMechanics, MECHANIC_KINDS } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

// ── M0: the mechanic lowering core (game-mechanics.plan.md) ─────────────────────────────────────
// A mechanic lowers into world (idiom fragment) + contract (produces/on) + audit. composeMechanics
// merges them and enforces the two rules: ≥1 SUCCESS terminal, and every required slice present.

const STORE = {
  slices: [
    { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } },
    { name: 'bag', kind: 'inventory' },
    { name: 'campaign', kind: 'progression' },
  ],
};
const ctx = (extra) => ({ storeSchema: STORE, player: 'hero', spawn: [0, 0, 2], ...extra });

describe('lowerMechanic — individual verbs', () => {
  it('reach-exit lowers to a zone source + goal:reached emit + end-success + a walkto audit', () => {
    const m = lowerMechanic('reach-exit', { at: [10, 0, 0], radius: 2 }, { i: 0, player: 'hero' });
    expect(m.role).toBe('terminal');
    expect(m.world.sources[0]).toMatchObject({ type: 'zone', zone: 'exit_0', at: [10, 0, 0], radius: 2, watch: 'hero' });
    expect(m.world.reactions[0]).toMatchObject({ on: 'enter', match: { zone: 'exit_0' }, do: 'emit', type: 'goal:reached' });
    expect(m.on).toEqual({ 'goal:reached': { end: 'success' } });
    expect(m.audit).toEqual({ kind: 'walkto', target: [10, 0, 0] });
  });

  it('collect resolves the inventory slice, groups on-map by item, and declares grant produces', () => {
    const m = lowerMechanic('collect', { pickups: [{ item: 'coin', at: [1, 0, 0] }, { item: 'coin', at: [2, 0, 0] }, { item: 'key', at: [3, 0, 0] }] }, { i: 1, player: 'hero', storeSchema: STORE });
    expect(m.errors).toEqual([]);
    expect(m.produces).toEqual([{ type: 'grant', slice: 'bag', max: 3 }]);
    expect(m.on).toEqual({
      'pickup:coin': { emit: { type: 'grant', slice: 'bag', item: 'coin', count: 1 } },
      'pickup:key': { emit: { type: 'grant', slice: 'bag', item: 'key', count: 1 } },
    });
    expect(m.world.sources.length).toBe(3);   // one zone per pickup
  });

  it('collect errors (not throws) when the store has no inventory slice', () => {
    const m = lowerMechanic('collect', { pickups: [{ item: 'x', at: [0, 0, 0] }] }, { i: 0, storeSchema: { slices: [{ name: 'c', kind: 'character' }] } });
    expect(m.errors.join(' ')).toMatch(/needs a inventory slice/);
  });

  it('fail-on-death owns hp init + a lte:0 watch → end fail', () => {
    const m = lowerMechanic('fail-on-death', { startHp: 100 }, { i: 0 });
    expect(m.ends).toEqual(['fail']);
    expect(m.world.vars).toEqual({ hp: 100 });
    expect(m.world.watches[0]).toMatchObject({ type: 'dead', when: { var: 'hp', lte: 0 } });
    expect(m.on).toEqual({ dead: { end: 'fail' } });
  });

  it('every registered mechanic lowers without throwing on a minimal call', () => {
    for (const k of MECHANIC_KINDS) {
      const params = { pickups: [{ item: 'x', at: [0, 0, 0] }], hazards: [{ at: [0, 0, 0] }], at: [1, 0, 0], seconds: 10 };
      expect(() => lowerMechanic(k, params, { i: 0, player: 'hero', storeSchema: STORE }), k).not.toThrow();
    }
  });
});

describe('composeMechanics — merge + rules', () => {
  it('composes a crawler level: reach-exit + collect + hazard-damage + fail-on-death', () => {
    const out = composeMechanics([
      { kind: 'reach-exit', at: [20, 0, 0], radius: 2 },
      { kind: 'collect', pickups: [{ item: 'coin', at: [5, 0, 0] }] },
      { kind: 'hazard-damage', hazards: [{ at: [10, 0, 0], damage: 25 }] },
      { kind: 'fail-on-death' },
    ], ctx());
    expect(out.produces).toEqual([{ type: 'grant', slice: 'bag', max: 1 }]);
    expect(out.on['goal:reached']).toEqual({ end: 'success' });
    expect(out.on.dead).toEqual({ end: 'fail' });
    expect(out.requires.sort()).toEqual(['character', 'inventory']);
    expect(out.events.vars.hp).toBe(100);          // hazard-damage + fail-on-death both declared hp:100, deduped
    expect(out.audits).toEqual([{ mechanic: 'reach-exit', kind: 'walkto', target: [20, 0, 0] }]);
  });

  it('REFUSES a level with no success-capable terminal (only fail-on-death)', () => {
    expect(() => composeMechanics([{ kind: 'fail-on-death' }, { kind: 'hazard-damage', hazards: [{ at: [0, 0, 0] }] }], ctx()))
      .toThrow(/at least one SUCCESS-capable terminal/);
  });

  it('REFUSES when a required slice is missing from the store', () => {
    const noInv = { slices: [{ name: 'hero', kind: 'character' }] };
    expect(() => composeMechanics([{ kind: 'reach-exit', at: [1, 0, 0] }, { kind: 'collect', pickups: [{ item: 'x', at: [0, 0, 0] }] }], { storeSchema: noInv, player: 'hero' }))
      .toThrow(/needs a inventory slice|no inventory slice/);
  });

  it('REFUSES conflicting hp inits (two mechanics, different startHp)', () => {
    expect(() => composeMechanics([
      { kind: 'reach-exit', at: [1, 0, 0] },
      { kind: 'hazard-damage', hazards: [{ at: [0, 0, 0] }], startHp: 50 },
      { kind: 'fail-on-death', startHp: 100 },
    ], ctx())).toThrow(/var 'hp' conflicts/);
  });
});

describe('the fall policy', () => {
  it('default respawn: catch-box + a move-to-spawn, no penalty, no hp requirement', () => {
    const out = composeMechanics([{ kind: 'reach-exit', at: [1, 0, 0] }], ctx());
    const catchSrc = out.events.sources.find((s) => s.zone === '__catch__');
    expect(catchSrc).toBeTruthy();
    const warp = out.events.reactions.find((r) => r.match && r.match.zone === '__catch__' && r.do === 'move');
    expect(warp).toMatchObject({ do: 'move', target: 'hero', to: [0, 0, 2] });
    expect(out.requires).not.toContain('character');   // penalty 0 → no hp needed
  });

  it('opt-in penalty respawn clamps hp at floor 1 (a fall can never end the run)', () => {
    const out = composeMechanics([{ kind: 'reach-exit', at: [1, 0, 0] }], ctx({ fall: { mode: 'respawn', penalty: 25, floor: 1 } }));
    const dmg = out.events.reactions.find((r) => r.match && r.match.zone === '__catch__' && r.do === 'inc');
    expect(dmg).toMatchObject({ do: 'inc', var: 'hp', by: -25, min: 1 });
    expect(out.requires).toContain('character');       // a penalty needs an hp/character slice
  });

  it('fall:none omits the catch-zone entirely', () => {
    const out = composeMechanics([{ kind: 'reach-exit', at: [1, 0, 0] }], ctx({ fall: 'none' }));
    expect((out.events.sources || []).some((s) => s.zone === '__catch__')).toBe(false);
  });
});

describe('the composed manifest actually drives the real bus (end to end)', () => {
  it('reaching the exit zone fires goal:reached through the live reducer', () => {
    const out = composeMechanics([{ kind: 'reach-exit', at: [10, 0, 0], radius: 2 }], ctx({ fall: 'none' }));
    const B = buildBus();
    const state = B.createBusState({ ...out.events, reactions: [...out.events.reactions, { on: 'goal:reached', do: 'set', var: 'won', to: 1 }] }, out.events.entities || []);
    const hero = { id: 'hero', transform: { pos: [0, 0, 0] } };
    // tick 1: outside
    let z = B.deriveZoneEvents([hero], undefined, out.events.sources);
    B.processEvents(state, z.events);
    expect(state.vars.won).toBeUndefined();
    // tick 2: at the exit → enter → goal:reached → won
    hero.transform.pos = [10, 0, 0];
    z = B.deriveZoneEvents([hero], z.prev, out.events.sources);
    B.processEvents(state, z.events);
    expect(state.vars.won).toBe(1);
  });

  it('a hazard drops hp and fail-on-death watch fires dead at 0', () => {
    const out = composeMechanics([
      { kind: 'survive', seconds: 60 },
      { kind: 'hazard-damage', hazards: [{ at: [5, 0, 0], damage: 60 }], startHp: 100 },
      { kind: 'fail-on-death' },
    ], ctx({ fall: 'none' }));
    const B = buildBus();
    const state = B.createBusState({ ...out.events, reactions: [...out.events.reactions, { on: 'dead', do: 'set', var: 'lost', to: 1 }] }, out.events.entities || []);
    const hero = { id: 'hero', transform: { pos: [0, 0, 0] } };
    // walk into the hazard twice (60 dmg each → hp 100 → 40 → -20)
    let z = B.deriveZoneEvents([hero], undefined, out.events.sources);
    B.processEvents(state, z.events);
    hero.transform.pos = [5, 0, 0];
    z = B.deriveZoneEvents([hero], z.prev, out.events.sources); B.processEvents(state, z.events);
    expect(state.vars.hp).toBe(40);
    hero.transform.pos = [0, 0, 0]; z = B.deriveZoneEvents([hero], z.prev, out.events.sources); B.processEvents(state, z.events);
    hero.transform.pos = [5, 0, 0]; z = B.deriveZoneEvents([hero], z.prev, out.events.sources); B.processEvents(state, z.events);
    expect(state.vars.hp).toBe(-20);
    // the fail-on-death watch edges true → dead → lost
    B.processEvents(state, B.watchEvents(state));
    expect(state.vars.lost).toBe(1);
  });
});
