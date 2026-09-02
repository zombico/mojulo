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
      const params = { pickups: [{ item: 'x', at: [0, 0, 0] }], hazards: [{ at: [0, 0, 0] }], at: [1, 0, 0], seconds: 10, when: { var: 'kills', gte: 3 }, entities: [{ id: 'e1' }], count: 1 };
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

// ── mechanics-vocab V1: win-when + hp-pool + defeat-all (mechanics-vocab.plan.md) ───────────────

describe('win-when — the generic predicate terminal', () => {
  it('lowers to a var-predicate watch → end-success, with no audit unless hand-named', () => {
    const m = lowerMechanic('win-when', { when: { var: 'kills', gte: 5 } }, { i: 0 });
    expect(m.role).toBe('terminal');
    expect(m.world.watches[0]).toEqual({ type: 'win:met', when: { var: 'kills', gte: 5 } });
    expect(m.on).toEqual({ 'win:met': { end: 'success' } });
    expect(m.audit).toBeUndefined();
  });

  it('passes a hand-named audit through, and refuses a malformed one', () => {
    const m = lowerMechanic('win-when', { when: { var: 'score', gte: 10 }, audit: { kind: 'idle', seconds: 30 } }, { i: 0 });
    expect(m.audit).toEqual({ kind: 'idle', seconds: 30 });
    expect(() => lowerMechanic('win-when', { when: { var: 'score', gte: 10 }, audit: { kind: 'idle' } }, { i: 0 }))
      .toThrow(/audit must be/);
  });

  it('refuses a predicate with no var or no comparator', () => {
    expect(() => lowerMechanic('win-when', {}, { i: 0 })).toThrow(/needs when/);
    expect(() => lowerMechanic('win-when', { when: { var: 'kills' } }, { i: 0 })).toThrow(/needs when/);
    expect(() => lowerMechanic('win-when', { when: { gte: 5 } }, { i: 0 })).toThrow(/needs when/);
  });

  it('opt-in hud + custom event name', () => {
    const m = lowerMechanic('win-when', { when: { var: 'kills', gte: 3 }, hud: 'Kills', event: 'target:met' }, { i: 1 });
    expect(m.world.hud).toEqual([{ var: 'kills', label: 'Kills' }]);
    expect(m.on).toEqual({ 'target:met': { end: 'success' } });
  });

  it('satisfies the success-terminal rule on its own', () => {
    const out = composeMechanics([{ kind: 'win-when', when: { var: 'kills', gte: 3 } }], ctx({ fall: 'none' }));
    expect(out.on['win:met']).toEqual({ end: 'success' });
    expect(out.audits).toEqual([]);   // no hand-named audit → promotion stays manual
  });
});

describe('hp-pool — the per-entity health producer', () => {
  it('lowers each entity to a namespaced var + clamped hit decrement + enemy:down watch + toggle-off', () => {
    const m = lowerMechanic('hp-pool', { entities: [{ id: 'foe_a', hp: 2 }, { id: 'foe_b', at: [4, 0, 0] }], hp: 3 }, { i: 0 });
    expect(m.role).toBe('emitter');
    expect(m.emits).toEqual(['enemy:down']);
    expect(m.world.vars).toEqual({ __hp_foe_a: 2, __hp_foe_b: 3 });
    expect(m.world.reactions).toContainEqual({ on: 'hit:foe_a', do: 'inc', var: '__hp_foe_a', by: -1, min: 0 });
    expect(m.world.watches).toContainEqual({ type: 'enemy:down', entity: 'foe_a', when: { var: '__hp_foe_a', lte: 0 } });
    expect(m.world.reactions).toContainEqual({ on: 'enemy:down', match: { entity: 'foe_b' }, do: 'toggle', target: 'foe_b', to: false });
    expect(m.world.entities).toEqual([{ id: 'foe_b', type: 'enemy', on: true, position: [4, 0, 0] }]);   // only placed entities declared
  });

  it('refuses an empty entity list and an id-less entity', () => {
    expect(() => lowerMechanic('hp-pool', {}, { i: 0 })).toThrow(/needs entities/);
    expect(() => lowerMechanic('hp-pool', { entities: [{ hp: 2 }] }, { i: 0 })).toThrow(/needs an id/);
  });
});

describe('defeat-all — the counter terminal + the producer rule', () => {
  it('explicit count lowers to a counter var + gte watch → success', () => {
    const m = lowerMechanic('defeat-all', { count: 3 }, { i: 2 });
    expect(m.world.vars).toEqual({ __downs_2: 0 });
    expect(m.world.reactions[0]).toEqual({ on: 'enemy:down', do: 'inc', var: '__downs_2', by: 1 });
    expect(m.world.watches[0]).toEqual({ type: 'all:defeated', when: { var: '__downs_2', gte: 3 } });
    expect(m.on).toEqual({ 'all:defeated': { end: 'success' } });
  });

  it('infers count from a sibling hp-pool at compose time', () => {
    const out = composeMechanics([
      { kind: 'hp-pool', entities: [{ id: 'a' }, { id: 'b' }] },
      { kind: 'defeat-all' },
    ], ctx({ fall: 'none' }));
    expect(out.events.watches).toContainEqual({ type: 'all:defeated', when: { var: '__downs_1', gte: 2 } });
  });

  it('standalone with no count and no sibling refuses with the infer hint', () => {
    expect(() => lowerMechanic('defeat-all', {}, { i: 0 })).toThrow(/needs count/);
  });

  it('REFUSES a level where nothing emits enemy:down (the V0 correctness warning)', () => {
    expect(() => composeMechanics([{ kind: 'defeat-all', count: 3 }], ctx({ fall: 'none' })))
      .toThrow(/no mechanic in this level emits 'enemy:down'/);
  });

  it("producer:'runtime' is the explicit acknowledgment that hand-authored reactions emit it", () => {
    const out = composeMechanics([{ kind: 'defeat-all', count: 3, producer: 'runtime' }], ctx({ fall: 'none' }));
    expect(out.on['all:defeated']).toEqual({ end: 'success' });
  });
});

describe('the combat trio drives the real bus (end to end)', () => {
  it('hit events drain hp-pools, enemy:down counts up, all:defeated ends in success', () => {
    const out = composeMechanics([
      { kind: 'hp-pool', entities: [{ id: 'foe_a', hp: 2, at: [4, 0, 0] }, { id: 'foe_b', hp: 1, at: [8, 0, 0] }] },
      { kind: 'defeat-all' },
      { kind: 'fail-on-death' },
    ], ctx({ fall: 'none' }));
    const B = buildBus();
    const state = B.createBusState({ ...out.events, reactions: [...out.events.reactions, { on: 'all:defeated', do: 'set', var: 'won', to: 1 }] }, out.events.entities || []);
    // drain reactions, then loop watches to a fixed point (the documented caller loop, depth-capped)
    const tick = (events) => {
      B.processEvents(state, events);
      for (let g = 0; g < 8; g++) { const w = B.watchEvents(state); if (!w.length) break; B.processEvents(state, w); }
    };
    // one hit each: foe_b (hp 1) drops, foe_a (hp 2) survives
    tick([{ type: 'hit:foe_a' }, { type: 'hit:foe_b' }]);
    expect(state.vars.__hp_foe_a).toBe(1);
    expect(state.vars.__downs_1).toBe(1);
    expect(state.byId.foe_b.on).toBe(false);       // toggled off on the way down
    expect(state.vars.won).toBeUndefined();
    // second hit on foe_a → both down → all:defeated → won
    tick([{ type: 'hit:foe_a' }]);
    expect(state.vars.__downs_1).toBe(2);
    expect(state.vars.won).toBe(1);
    // over-hitting a downed foe: hp clamps at 0, the edge-fired watch does not refire
    tick([{ type: 'hit:foe_b' }]);
    expect(state.vars.__hp_foe_b).toBe(0);
    expect(state.vars.__downs_1).toBe(2);
  });

  it('win-when over a runtime-produced var: incs cross the threshold → success', () => {
    const out = composeMechanics([{ kind: 'win-when', when: { var: 'kills', gte: 2 }, hud: 'Kills' }], ctx({ fall: 'none' }));
    const B = buildBus();
    const state = B.createBusState({ ...out.events, reactions: [{ on: 'kill', do: 'inc', var: 'kills', by: 1 }, { on: 'win:met', do: 'set', var: 'won', to: 1 }] }, []);
    const tick = (events) => {
      B.processEvents(state, events);
      for (let g = 0; g < 8; g++) { const w = B.watchEvents(state); if (!w.length) break; B.processEvents(state, w); }
    };
    tick([{ type: 'kill' }]);
    expect(state.vars.won).toBeUndefined();
    tick([{ type: 'kill' }]);
    expect(state.vars.won).toBe(1);
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
