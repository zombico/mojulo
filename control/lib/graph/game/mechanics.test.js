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
      const params = { pickups: [{ item: 'x', at: [0, 0, 0] }], hazards: [{ at: [0, 0, 0] }], at: [1, 0, 0], seconds: 10, when: { var: 'kills', gte: 3 }, entities: [{ id: 'e1' }], count: 1, checkpoints: [{ at: [5, 0, 0] }, { at: [9, 0, 0] }], waves: [{ foes: ['foe-1'] }], path: [[9, 0], [0, 0]], origin: [0, 0, 0], cols: 3, rows: 3, blocks: [[1, 1]], plates: [[2, 1]], plots: [{ at: [0, 0, 0] }], drops: [{ at: [0, 0, 0], gives: 'ammo' }], rivals: ['foe-1'], heal: true, teams: { a: ['hero'], b: ['foe-1'] }, dots: ['gate'] };
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

// ── mechanics vocabulary V1: win-when + hp-pool + defeat-all ───────────────

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

// ── the genre snipe (10-12): stealth, racing, the kept number ─────────────────────────────────
describe('unseen, laps and score on the bus', () => {
  const B = buildBus();
  const run = (composed, evs, ticks = 0) => {
    const s = B.createBusState(composed.events, composed.events.entities);
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
    pump([]);
    for (let k = 0; k < ticks; k++) pump(B.tickTimers(s, 0.1));
    for (const e of evs) pump([e]);
    return s;
  };
  const types = (s) => s.log.map((r) => r.type);

  it('a reaction with `if` fires only while its predicate holds', () => {
    const s = B.createBusState({ vars: { gate: 0 }, reactions: [{ on: 'ping', if: { var: 'gate', eq: 1 }, do: 'inc', var: 'n', by: 1 }, { on: 'open', do: 'set', var: 'gate', to: 1 }] });
    B.processEvents(s, [{ type: 'ping' }]);
    expect(s.vars.n).toBeUndefined();
    B.processEvents(s, [{ type: 'open' }]);
    B.processEvents(s, [{ type: 'ping' }]);
    expect(s.vars.n).toBe(1);
  });

  it('laps counts checkpoints only in order, and ends with its time kept', () => {
    const c = composeMechanics([{ kind: 'laps', checkpoints: [{ at: [10, 0, 0] }, { at: [20, 0, 0] }, { at: [30, 0, 0] }], laps: 2 }], ctx());
    expect(c.on['laps:done']).toEqual({ end: 'success' });
    expect(c.keep).toEqual([{ var: '__race_0', label: 'Time', best: 'low', scale: 0.1, unit: 's' }]);
    const enter = (j) => ({ type: 'enter', zone: `cp_0_${j}`, entity: 'hero' });
    // out of order: the finish first, then the second: nothing counts
    let s = run(c, [enter(2), enter(1)]);
    expect(s.vars.__lap_0).toBe(0);
    expect(s.vars.__cp_0).toBe(0);
    // in order, twice round, after 4.2 s on the clock
    s = run(c, [enter(0), enter(1), enter(2), enter(0), enter(1), enter(2)], 42);
    expect(s.vars.__lap_0).toBe(2);
    expect(types(s).filter((t) => t === 'checkpoint')).toHaveLength(4);
    expect(types(s)).toContain('laps:done');
    expect(s.vars.__race_0).toBe(42);
    expect(s.vars.__race_over_0).toBe(1);
  });

  it('laps for a flight: the finish is a landing in its box; a hard or off-pad touchdown is a crash, answered by a respawn at the last gate', () => {
    const box = { at: [100, 0, 15], half: [450, 15, 15] };
    const respawn = [{ spot: [0, 0, 2], heading: 0, aloft: 0 }, { spot: [10, 0, 80], heading: 1.5, aloft: 1 }, { spot: [20, 0, 90], heading: 3, aloft: 1 }];
    const c = composeMechanics([{ kind: 'laps', checkpoints: [{ at: [10, 0, 80], radius: 20, planar: false }, { at: [20, 0, 90], radius: 20, planar: false }, { ...box, planar: false, land: true }], land: { pads: [box] }, respawn }], ctx());
    const src = c.events.sources.find((q) => q.zone === 'cp_0_2');
    expect(src.half).toEqual(box.half);
    const enter = (zone) => ({ type: 'enter', zone, entity: 'hero' }), exit = (zone) => ({ type: 'exit', zone, entity: 'hero' });
    const td = (hard) => ({ type: 'touchdown', entity: 'hero', hard, sink: hard ? 5 : 1 });
    // the point a respawn carries: its reaction's (the page reads it there; the log keeps the type)
    const respawns = (s) => s.log.filter((r) => r.type.startsWith('respawn:')).map((r) => s.reactions.find((q) => q.do === 'emit' && q.type === r.type));
    // flying through the finish's box without touching down does not finish
    let s = run(c, [enter('cp_0_0'), enter('cp_0_1'), enter('pad_0_0'), enter('cp_0_2'), exit('cp_0_2'), exit('pad_0_0')]);
    expect(types(s)).not.toContain('laps:done');
    // a soft touchdown in the box, the gates passed: landed, done
    s = run(c, [enter('cp_0_0'), enter('cp_0_1'), enter('pad_0_0'), enter('cp_0_2'), td(0)]);
    expect(types(s)).toContain('laps:done');
    expect(types(s)).not.toContain('crash');
    // landing before the gates are passed counts as a landing, not the finish
    s = run(c, [enter('pad_0_0'), enter('cp_0_2'), td(0)]);
    expect(types(s)).not.toContain('laps:done');
    // a hard touchdown on the runway after the first gate: a crash, back at that gate, flying on toward the next
    s = run(c, [enter('cp_0_0'), enter('pad_0_0'), td(1)]);
    expect(types(s)).toContain('crash');
    expect(respawns(s).map((r) => [r.spot, r.heading, r.aloft])).toEqual([[[10, 0, 80], 1.5, 1]]);
    // a soft touchdown off every pad before any gate: a crash, back on the runway
    s = run(c, [td(0)]);
    expect(respawns(s).map((r) => r.spot)).toEqual([[0, 0, 2]]);
    // and no flight keys, no flight events: a race lowers as it did
    const race = composeMechanics([{ kind: 'laps', checkpoints: [{ at: [10, 0, 0] }, { at: [20, 0, 0] }] }], ctx());
    expect(JSON.stringify(race.events)).not.toMatch(/touchdown|respawn|pad_/);
  });

  it('hunting waves (no path): each wing woken when the one before is down, no lives, every one down is success', () => {
    const c = composeMechanics([{ kind: 'waves', waves: [{ foes: ['foe-1', 'foe-2'] }, { foes: ['foe-3'] }], clear: true }], ctx());
    expect(c.on).toEqual({ 'waves:cleared': { end: 'success' } });
    const steps = c.events.sequences[0].steps;
    expect(steps.some((q) => q.op === 'walk')).toBe(false);
    expect(steps.some((q) => q.await && q.await.on === '__wave_clear_0_1')).toBe(true);
    // (a sequence's waits run on the bus's stepTime as well as its timers)
    const s = B.createBusState(c.events, c.events.entities);
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
    const tick = (n) => { for (let k = 0; k < n; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
    const waves = () => s.log.filter((r) => r.type === 'wave').length;
    pump(c.events.initial || []); tick(60);
    expect(waves()).toBe(1);                         // the first wing; the second waits for it to be down
    pump([{ type: 'down', entity: 'foe-1' }]); tick(60);
    expect(waves()).toBe(1);
    pump([{ type: 'down', entity: 'foe-2' }]); tick(60);
    expect(waves()).toBe(2);
    pump([{ type: 'down', entity: 'foe-3' }]);
    expect(types(s)).toContain('waves:cleared');
    expect(() => composeMechanics([{ kind: 'waves', waves: [{ foes: ['foe-1'] }], path: [] }], ctx())).toThrow(/needs path/);
  });

  it('respawn: a crash comes back at its start, aloft, and hurts when asked', () => {
    const c = composeMechanics([{ kind: 'fail-on-death', startHp: 100 }, { kind: 'respawn', at: { spot: [1, 2, 3], heading: 0.5, aloft: 1 }, hurt: 25 }, { kind: 'defeat-all', who: 'foe-*', count: 1 }], ctx());
    const s = run(c, [{ type: 'crash', entity: 'hero', why: 'rock' }]);
    expect(types(s)).toContain('respawn:0');
    expect(s.reactions.find((r) => r.type === 'respawn:0')).toMatchObject({ spot: [1, 2, 3], heading: 0.5, aloft: 1 });
    expect(s.vars.hp).toBe(75);
    // a touchdown in a fight is a crash too (nothing to land on), unless the level lets the craft land
    expect(types(run(c, [{ type: 'touchdown', entity: 'hero', hard: 0 }]))).toContain('respawn:0');
    const landing = composeMechanics([{ kind: 'respawn', at: [0, 0, 1], touchdown: 'land' }, { kind: 'survive', seconds: 10 }], ctx());
    expect(types(run(landing, [{ type: 'touchdown', entity: 'hero', hard: 0 }]))).not.toContain('respawn:0');
    expect(() => composeMechanics([{ kind: 'respawn', at: { spot: 'there' } }], ctx())).toThrow(/at is \{ spot/);
  });

  it('laps against rivals: each rival\'s passes counted, the place moved at every pass, the finish won or lost by it', () => {
    const cps = [{ at: [10, 0, 0] }, { at: [20, 0, 0] }, { at: [0, 0, 0] }];
    const c = composeMechanics([{ kind: 'laps', checkpoints: cps, laps: 1, rivals: ['rival-1', 'rival-2'], win: 2 }], ctx());
    expect(c.on).toEqual({ 'race:won': { end: 'success' }, 'race:lost': { end: 'fail' } });
    expect(c.keep.map((k) => k.label)).toEqual(['Time', 'Place']);
    expect(c.events.sources.filter((z) => z.zone.startsWith('rcp_')).map((z) => z.watch)).toEqual(['rival-*', 'rival-*', 'rival-*']);
    const me = (j) => ({ type: 'enter', zone: `cp_0_${j}`, entity: 'hero' }), them = (r, j) => ({ type: 'enter', zone: `rcp_0_${j}`, entity: `rival-${r}` });
    // rival 1 takes the first checkpoint: it leads; the player passes it at the second; a tie goes to who passed first
    let s = run(c, [them(1, 0)]);
    expect(s.vars.__place_0).toBe(2);
    s = run(c, [them(1, 0), me(0)]);
    expect(s.vars.__place_0).toBe(2);
    s = run(c, [them(1, 0), me(0), me(1)]);
    expect(s.vars.__place_0).toBe(1);
    // out of order counts for no rival either
    s = run(c, [them(2, 1), them(2, 2)]);
    expect(s.vars.__place_0).toBe(1);
    // both rivals home first: third, and lost; one ahead: second, and won
    s = run(c, [them(1, 0), them(1, 1), them(1, 2), them(2, 0), them(2, 1), them(2, 2), me(0), me(1), me(2)]);
    expect([s.vars.__place_0, types(s).includes('race:lost'), types(s).includes('race:won')]).toEqual([3, true, false]);
    s = run(c, [them(1, 0), them(1, 1), them(1, 2), them(2, 0), me(0), me(1), me(2)]);
    expect([s.vars.__place_0, types(s).includes('race:won')]).toEqual([2, true]);
    // alone, a race lowers as it did
    expect(composeMechanics([{ kind: 'laps', checkpoints: cps }], ctx()).on).toEqual({ 'laps:done': { end: 'success' } });
  });

  it('unseen ends on the first sighting, or counts to its alarms', () => {
    const one = composeMechanics([{ kind: 'unseen' }, { kind: 'reach-exit', at: [9, 0, 0] }], ctx());
    expect(one.on.spotted).toEqual({ end: 'fail' });
    expect(types(run(one, [{ type: 'seen', entity: 'guard-1', target: 'hero' }]))).toContain('spotted');
    const three = composeMechanics([{ kind: 'unseen', alarms: 3, who: 'guard-*' }, { kind: 'reach-exit', at: [9, 0, 0] }], ctx());
    const seen = (who) => ({ type: 'seen', entity: who, target: 'hero' });
    expect(types(run(three, [seen('guard-1'), seen('dog'), seen('guard-2')]))).not.toContain('spotted');
    expect(types(run(three, [seen('guard-1'), seen('guard-2'), seen('guard-1')]))).toContain('spotted');
  });

  it('score counts its points and is kept; a var kept twice is an error', () => {
    const c = composeMechanics([{ kind: 'score', points: [{ on: 'pickup:coin', by: 10 }, { on: 'enemy:down', by: 100 }] }, { kind: 'reach-exit', at: [9, 0, 0] }], ctx());
    expect(c.keep).toEqual([{ var: 'score', label: 'Score', best: 'high' }]);
    expect(run(c, [{ type: 'pickup:coin' }, { type: 'enemy:down' }, { type: 'pickup:coin' }]).vars.score).toBe(120);
    expect(() => composeMechanics([{ kind: 'score' }, { kind: 'score' }, { kind: 'reach-exit', at: [9, 0, 0] }], ctx())).toThrow(/kept twice/);
  });

  it('a mechanic without keep leaves the composed level without the key', () => {
    expect(composeMechanics([{ kind: 'reach-exit', at: [9, 0, 0] }], ctx())).not.toHaveProperty('keep');
  });
});

// ── the shooter's match (frags): kills credited on the bus, the fallen back, a limit and a place ───────────────────
describe('frags on the bus', () => {
  const B = buildBus();
  // a bus that steps: events in order, each followed by `secs` of timers and sequence waits (0.1 s steps)
  const play = (composed, script) => {
    const s = B.createBusState(composed.events, composed.events.entities);
    const ops = [];
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } if (s._ctrlOps) { ops.push(...s._ctrlOps); s._ctrlOps = []; } };
    pump([]);
    for (const [e, secs = 0] of script) {
      if (e) pump([e]);
      for (let k = 0; k < Math.round(secs * 10); k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); }
    }
    return { s, ops, log: s.log.map((r) => r.type) };
  };
  const hit = (v, by) => [{ type: `hit:${v}`, entity: v, by }];
  const down = (v) => [{ type: 'down', entity: v }];
  const spawns = [[0, 0, 0], [20, 0, 0], [0, 20, 0], [20, 20, 0]];
  const base = { kind: 'frags', rivals: ['bot-1', 'bot-2'], frags: 2, spawns, hits: 50 };

  it('lowers to verbs Godot\'s bus performs, its ends won or lost, its frags and place kept', () => {
    const c = composeMechanics([base], ctx());
    expect(c.on).toEqual({ 'frags:won': { end: 'success' }, 'frags:lost': { end: 'fail' } });
    expect(c.keep.map((k) => [k.label, k.best])).toEqual([['Frags', 'high'], ['Place', 'low']]);
    const ops = new Set(c.events.reactions.filter((r) => r.do === 'ctrl').map((r) => r.op));
    expect([...ops].sort()).toEqual(['kill', 'spawn']);
    expect(c.events.sequences).toHaveLength(3);
    expect(() => composeMechanics([{ kind: 'frags' }], ctx())).toThrow(/needs rivals/);
    expect(() => composeMechanics([{ ...base, frags: 0 }], ctx())).toThrow(/frags is the limit/);
    expect(() => composeMechanics([{ ...base, seconds: 3 }], ctx())).toThrow(/seconds is the time limit/);
    expect(() => composeMechanics([{ ...base, spawns: [[0]] }], ctx())).toThrow(/spawns are/);
  });

  it('a fall is credited to its last hitter, said as a kill, and the fallen comes back at its next spawn after its time', () => {
    const c = composeMechanics([base], ctx());
    const { s, ops, log } = play(c, [[...hit('bot-1', 'bot-2')], [...hit('bot-1', 'hero')], [...down('bot-1'), 2.9]]);
    expect(s.vars.__frag_0_hero).toBe(1);
    expect(s.vars['__frag_0_bot-2']).toBe(0);
    expect(s.log.filter((r) => r.type === 'kill')).toHaveLength(1);
    // not yet back at 2.9 s; back by 3.1 s, at the farthest of the spawns (the cast picks it), guarded
    expect(ops.filter((o) => o.op === 'spawn')).toHaveLength(0);
    const more = play(c, [[...hit('bot-1', 'hero')], [...down('bot-1'), 3.1]]);
    const back = more.ops.filter((o) => o.op === 'spawn');
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ who: 'bot-1', among: spawns, guard: 2, fresh: true });
    expect(composeMechanics([{ ...base, guard: 0 }], ctx()).events.reactions.find((x) => x.op === 'spawn').guard).toBeUndefined();
    expect(() => composeMechanics([{ ...base, guard: -1 }], ctx())).toThrow(/guard is the seconds/);
    expect(log).toContain('kill');
    // a fall nobody caused (no hit since it came back) credits no one
    const self = play(c, [[...down('bot-2'), 3.1]]);
    expect([self.s.vars.__frag_0_hero, self.s.vars['__frag_0_bot-1'], self.log.includes('kill')]).toEqual([0, 0, false]);
  });

  it('the player falls when its hp runs out, held down by the cast, and comes back whole', () => {
    const c = composeMechanics([base], ctx());
    const { s, ops } = play(c, [[...hit('hero', 'bot-2')], [...hit('hero', 'bot-2'), 3.1]]);
    expect(s.vars['__frag_0_bot-2']).toBe(1);
    expect(s.vars.__deaths_0).toBe(1);
    expect(ops.map((o) => [o.op, o.who])).toEqual([['kill', 'hero'], ['spawn', 'hero']]);
    expect(s.vars.hp).toBe(100);
  });

  it('the place moves with every frag, a tie to who got there first, and the limit ends it', () => {
    const c = composeMechanics([base], ctx());
    // the player falls by its hp (two 50 hp hits), the others by the cast's down
    const kill = (v, by) => (v === 'hero' ? [[...hit(v, by)], [...hit(v, by), 3.1]] : [[...hit(v, by)], [...down(v), 3.1]]);
    // bot-1 frags first: the player is second; the player draws level: still second; goes ahead: first
    let r = play(c, kill('bot-2', 'bot-1'));
    expect(r.s.vars.__place_0).toBe(2);
    r = play(c, [...kill('bot-2', 'bot-1'), ...kill('bot-2', 'hero')]);
    expect(r.s.vars.__place_0).toBe(2);
    r = play(c, [...kill('bot-2', 'bot-1'), ...kill('bot-2', 'hero'), ...kill('bot-1', 'hero')]);
    expect([r.s.vars.__place_0, r.log.includes('frags:won'), r.s.vars.__frags_over_0]).toEqual([1, true, 1]);
    // another to the limit first: lost, and nothing after it counts as a second end
    r = play(c, [...kill('hero', 'bot-1'), ...kill('bot-2', 'bot-1'), ...kill('bot-2', 'hero'), ...kill('bot-1', 'hero')]);
    expect([r.log.includes('frags:lost'), r.log.includes('frags:won')]).toEqual([true, false]);
  });

  it('with a clock, the horn ends it and the place decides', () => {
    const c = composeMechanics([{ ...base, frags: 9, seconds: 10, win: 1 }], ctx());
    expect(c.events.hud.find((h) => h.label === 'Time')).toMatchObject({ as: 'clock' });
    let r = play(c, [[...hit('bot-1', 'hero')], [...down('bot-1'), 10.5]]);
    expect(r.log.includes('frags:won')).toBe(true);
    r = play(c, [[...hit('bot-1', 'bot-2')], [...down('bot-1'), 10.5]]);
    expect(r.log.includes('frags:lost')).toBe(true);
  });
});

// ── an arena's item economy: supplies that come back, armor, the overdrive, bots that take them ─────────────────────
describe('supplies with timing', () => {
  const B = buildBus();
  const play = (mechs, script) => {
    const c = composeMechanics(mechs, ctx()), s = B.createBusState(c.events, c.events.entities), ops = [];
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } if (s._ctrlOps) { ops.push(...s._ctrlOps); s._ctrlOps = []; } };
    pump([]);
    for (const [e, secs = 0] of script) { if (e) pump([e]); for (let k = 0; k < Math.round(secs * 10); k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } }
    return { s, ops, log: s.log.map((r) => r.type) };
  };
  const enter = (zone, entity = 'hero') => ({ type: 'enter', zone, entity });
  const drops = [{ at: [0, 0, 0], gives: 'health', amount: 30, respawn: 5 }, { at: [9, 0, 0], gives: 'armor', amount: 50 }, { at: [0, 9, 0], gives: 'overdrive', amount: 8 }];

  it('without the new keys it lowers as it did', () => {
    const plain = composeMechanics([{ kind: 'supplies', drops: [{ at: [0, 0, 0], gives: 'health' }, { at: [1, 0, 0], gives: 'ammo' }] }, { kind: 'reach-exit', at: [9, 9, 0] }], ctx());
    expect(plain.events.reactions.map((r) => r.do).slice(0, 8)).toEqual(['inc', 'emit', 'toggle', 'set', 'ctrl', 'emit', 'toggle', 'set']);
    expect(plain.events.sequences ?? []).toEqual([]);
  });

  it('a supply with a respawn is there again after its time, to be taken again; one without stays gone', () => {
    const frags = { kind: 'frags', rivals: ['bot-1'], hp: 100, damage: true, armor: true };
    let r = play([frags, { kind: 'supplies', drops }], [[{ type: 'hit:hero', entity: 'hero', by: 'bot-1', harm: -60, dmg: 60, head: 0 }], [enter('sp_1_0'), 4.9], [enter('sp_1_0')]]);
    expect(r.s.vars.hp).toBe(70);   // the armor was empty: the round took 60 of hp; its pad gave 30; not back yet
    r = play([frags, { kind: 'supplies', drops }], [[{ type: 'hit:hero', entity: 'hero', by: 'bot-1', harm: -60, dmg: 60, head: 0 }], [enter('sp_1_0'), 5.1], [enter('sp_1_0')]]);
    expect(r.log).toContain('supply:back');
    expect(r.s.vars.hp).toBe(100);
    expect(r.log.filter((t) => t === 'supply:health')).toHaveLength(2);
  });

  it('armor takes whole rounds while it lasts, then the hp does; it is lost with a fall', () => {
    const frags = { kind: 'frags', rivals: ['bot-1'], hp: 100, damage: true, armor: true };
    const hit = (h) => ({ type: 'hit:hero', entity: 'hero', by: 'bot-1', harm: -h, dmg: h, head: 0 });
    const r = play([frags, { kind: 'supplies', drops }], [[enter('sp_1_1')], [hit(30)], [hit(30)], [hit(30)]]);
    expect([r.s.vars.armor, r.s.vars.hp]).toEqual([0, 70]);   // 50 → 20 → 0 (the second round's overflow lost), then hp
  });

  it('the others take them too (takers), and once taken by anyone it is gone for everyone', () => {
    const r = play([{ kind: 'supplies', drops, takers: 'bot-*' }, { kind: 'reach-exit', at: [99, 99, 0] }], [[enter('sp_0_0_t', 'bot-2')], [enter('sp_0_0')], [enter('sp_0_2_t', 'bot-1')]]);
    expect(r.ops.map((o) => [o.op, o.who])).toEqual([['heal', 'bot-2'], ['status', 'bot-1']]);
    expect(r.log.filter((t) => t === 'supply:health')).toHaveLength(1);
  });

  it('a weapon on the floor: the cast\'s arm with its slot, for the player and for the takers; it names its slot', () => {
    const w = { kind: 'supplies', takers: 'bot-*', respawn: 30, drops: [{ at: [0, 0, 0], gives: 'weapon', slot: 'long' }] };
    let r = play([w, { kind: 'reach-exit', at: [9, 9, 0] }], [[enter('sp_0_0')]]);
    expect(r.ops.filter((o) => o.op === 'arm').map((o) => [o.who, o.slot])).toEqual([['hero', 'long']]);
    expect(r.log).toContain('supply:weapon');
    r = play([w, { kind: 'reach-exit', at: [9, 9, 0] }], [[enter('sp_0_0_t', 'bot-2')], [enter('sp_0_0')]]);
    expect(r.ops.filter((o) => o.op === 'arm').map((o) => [o.who, o.slot])).toEqual([['bot-2', 'long']]);   // gone for everyone
    const c = composeMechanics([w, { kind: 'reach-exit', at: [9, 9, 0] }], ctx());
    expect(c.events.reactions.some((x) => x.type === 'supply:weapon' && x.slot === 'long')).toBe(true);
    expect(() => composeMechanics([{ kind: 'supplies', drops: [{ at: [0, 0, 0], gives: 'weapon' }] }, { kind: 'reach-exit', at: [9, 9, 0] }], ctx())).toThrow(/slot/);
  });

  it('frags brings the fallen back fresh: the loadout they were minted with', () => {
    const c = composeMechanics([{ kind: 'frags', rivals: ['bot-1'], spawns: [[0, 0, 0], [9, 0, 0]] }], ctx());
    const spawns = c.events.reactions.filter((x) => x.op === 'spawn');
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns.every((x) => x.fresh === true)).toBe(true);
  });
});

describe('two sides', () => {
  const B = buildBus();
  const play = (composed, script) => {
    const s = B.createBusState(composed.events, composed.events.entities), ops = [];
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } if (s._ctrlOps) { ops.push(...s._ctrlOps); s._ctrlOps = []; } };
    pump([]);
    for (const [e, secs = 0] of script) { if (e) pump([e]); for (let k = 0; k < Math.round(secs * 10); k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } }
    return { s, ops, log: s.log.map((r) => r.type) };
  };
  const teams = { red: ['hero', 'bot-1'], blue: ['bot-2', 'bot-3'] };
  const hit = (v, by) => ({ type: `hit:${v}`, entity: v, by }), down = (v) => ({ type: 'down', entity: v });

  it('team frags: a fall counts for the other side only, the first side to the limit wins, each back at its base', () => {
    const spawns = { red: [[0, -15, 0]], blue: [[0, 15, 0]] };
    const c = composeMechanics([{ kind: 'frags', rivals: ['bot-1', 'bot-2', 'bot-3'], frags: 2, teams, spawns }], ctx());
    let r = play(c, [[hit('bot-2', 'bot-3')], [down('bot-2'), 3.1]]);   // a teammate's round credits nobody
    expect([r.s.vars.__team_0_blue, r.log.includes('kill')]).toEqual([0, false]);
    expect(r.ops.find((o) => o.op === 'spawn')).toMatchObject({ who: 'bot-2', among: spawns.blue });
    r = play(c, [[hit('bot-2', 'bot-1')], [down('bot-2'), 3.1], [hit('bot-3', 'hero')], [down('bot-3')]]);
    expect([r.s.vars.__team_0_red, r.s.vars['__frag_0_bot-1'], r.s.vars.__frag_0_hero]).toEqual([2, 1, 1]);
    expect(r.log).toContain('frags:won');   // the side's limit, though no one of it reached it alone
    r = play(c, [[hit('bot-1', 'bot-2')], [down('bot-1'), 3.1], [hit('bot-1', 'bot-3')], [down('bot-1')]]);
    expect(r.log).toContain('frags:lost');
    expect(c.keep.map((k) => k.label)).toEqual(['Frags', 'Side']);
  });

  it('team frags at the horn: the side ahead wins, a tie is lost', () => {
    const c = composeMechanics([{ kind: 'frags', rivals: ['bot-1', 'bot-2', 'bot-3'], frags: 9, seconds: 10, teams }], ctx());
    expect(play(c, [[hit('bot-2', 'hero')], [down('bot-2'), 10.1]]).log).toContain('frags:won');
    expect(play(c, [[null, 10.1]]).log).toContain('frags:lost');
    expect(() => composeMechanics([{ kind: 'frags', rivals: ['bot-1', 'bot-2'], teams }], ctx())).toThrow(/two sides/);
    expect(() => composeMechanics([{ kind: 'frags', rivals: ['bot-1'], teams: { a: ['hero'], b: ['bot-1'], c: [] } }], ctx())).toThrow(/two sides/);
  });

  it('control: a second scored by the side alone on the point; contested, empty or fallen, none', () => {
    const c = composeMechanics([{ kind: 'control', teams, at: [0, 0, 0], hold: 5 }], ctx());
    const enter = (who) => ({ type: 'enter', zone: `cp_0_${who}`, entity: who }), exit = (who) => ({ type: 'exit', zone: `cp_0_${who}`, entity: who });
    let r = play(c, [[enter('bot-1'), 3.05]]);
    expect(r.s.vars.__cps_0_red).toBe(3);
    r = play(c, [[enter('bot-1'), 2.05], [enter('bot-2'), 3]]);   // contested from 2 s
    expect([r.s.vars.__cps_0_red, r.s.vars.__cps_0_blue]).toEqual([2, 0]);
    r = play(c, [[enter('bot-1'), 1.05], [down('bot-1'), 2], [exit('bot-1'), 2]]);   // a fallen body holds nothing, its exit is not counted twice
    expect([r.s.vars.__cps_0_red, r.s.vars.__cpn_0_red]).toEqual([1, 0]);
    expect(play(c, [[enter('hero'), 5.05]]).log).toContain('control:won');
    expect(play(c, [[enter('bot-3'), 5.05]]).log).toContain('control:lost');
    expect(() => composeMechanics([{ kind: 'control', teams: { a: ['bot-1'], b: ['bot-2'] }, at: [0, 0, 0] }], ctx())).toThrow(/player in one/);
    expect(() => composeMechanics([{ kind: 'control', teams, at: [0, 0, 0], hold: 2 }], ctx())).toThrow(/hold the seconds/);
  });
});
