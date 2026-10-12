import { describe, it, expect } from 'vitest';
import { simLevel } from './level-sim.js';
import { buildBus } from '../worlds/event-bus.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { composeMechanics } from './mechanics.js';
import { lowerCues } from '../playscape/ui/cues.js';
import { mergeEventManifests } from './level-synth.js';

// A DEFENCE, stepped as the page steps it (scene/channels/events.js): the walkers' zone facts and the cast's facts
// join the frame's events, the bus processes them, its watches, timers and sagas run, and the character intents it
// queued reach the world. Foes minted asleep wake in waves and walk to the base; a sentry tower fells what passes it;
// a pad builds the tower for gold. Flat ground, no rendering.

const body = { eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 };
const foe = (k) => ({ id: `foe-${k}`, dormant: true, team: 'wave', rule: { type: 'static', speed: 3, ...body }, body: { type: 'mesh', hittable: true, hp: 2, poise: 2, radius: 0.6 }, transform: { pos: [60, 0, 0], heading: Math.PI } });
const tower = { id: 'tower-1', dormant: true, team: 'defense', rule: { type: 'ai', mind: { motivation: 'sentry' }, foes: 'wave', range: 13, turnRate: 6, dodge: false, ...body }, weapon: { fireClass: 'area', auto: false, cooldown: 0.4, damage: 1, range: 13, coreAngle: 4, assistAngle: 12, eye: 1.4 }, body: { type: 'mesh', hittable: false, radius: 0.5 }, transform: { pos: [30, 6, 0], heading: -Math.PI / 2 } };

function level({ foes = 4, build = true, lives = 3 } = {}) {
  const mech = composeMechanics([{ kind: 'waves', waves: [{ after: 1, foes: Array.from({ length: foes }, (_, k) => `foe-${k + 1}`), every: 1.2 }], path: [[60, 0], [0, 0]], lives, bounty: 2, purse: { var: 'gold', start: 6 } }], { player: 'hero' });
  const cues = lowerCues({ cues: [{ id: 'build-1', once: true, when: { use: { at: [30, 3], r: 2 } }, if: { var: 'gold', gte: 5 }, then: [{ add: 'gold', by: -5 }, { spawn: 'tower-1' }], else: { say: 'a tower costs 5 gold', as: 'toast' } }] }, { player: 'hero' });
  const hero = { id: 'hero', pilotable: true, rule: { type: 'walk', speed: 0, ...body }, body: { type: 'none' }, transform: { pos: build ? [30, 3, 0] : [-20, 0, 0], heading: 0 } };
  return simLevel({ entities: [hero, tower, ...Array.from({ length: foes }, (_, k) => foe(k + 1))], events: mergeEventManifests(cues, mech.events) });
}
const run = (L, seconds, extra) => L.run(seconds, extra ? { 0: extra } : {});
const types = (bus) => bus.log.map((r) => r.type);

describe('a defence on the bus', () => {
  it('without a tower, every foe walks the path, leaks a life and goes; out of lives, the base falls', () => {
    const L = level({ build: false, foes: 4, lives: 3 });
    run(L, 40);
    expect(types(L.bus).filter((t) => t === 'leak').length).toBe(4);
    expect(types(L.bus)).toContain('base:fallen');
    expect(L.bus.vars.__lives_0).toBe(0);
    expect(L.world.byId['foe-1'].gone).toBe(true);
  });

  it('a pad builds the tower for gold (the cue\'s if), and the sentry fells the foes that pass: the waves are cleared', () => {
    const L = level({ foes: 4 });
    run(L, 0.5, [{ type: 'use-cue-build-1' }]);
    expect(L.world.byId['tower-1'].gone).toBe(false);
    expect(L.bus.vars.gold).toBe(1);
    run(L, 40);
    const downs = L.world.entities.filter((e) => e.team === 'wave' && e.downed).length;
    expect(downs).toBe(4);
    expect(L.bus.vars.gold).toBe(1 + 4 * 2);
    expect(types(L.bus)).toContain('waves:cleared');
    expect(types(L.bus)).not.toContain('leak');
  });

  it('without the gold, the pad says so and builds nothing', () => {
    const L = level({ foes: 1 });
    L.bus.vars.gold = 3;
    run(L, 0.5, [{ type: 'use-cue-build-1' }]);
    expect(L.world.byId['tower-1'].gone).toBe(true);
    expect(types(L.bus)).toContain('cue-else:build-1');
    expect(L.bus.vars.gold).toBe(3);
  });
});

describe('push: boulders on a grid, on the bus', () => {
  const grid = (extra = {}) => composeMechanics([{ kind: 'push', origin: [0, 0, 0], cols: 4, rows: 3, cell: 2, blocks: [[1, 1]], plates: [[3, 1]], ...extra }], { player: 'hero' });
  const B = buildBus();
  const walk = (c, cells) => {
    const s = B.createBusState(c.events, c.events.entities);
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); for (let k = 0; w.length && k < 8; k++) { B.processEvents(s, w); w = B.watchEvents(s); } };
    for (const q of cells) pump([{ type: 'enter', zone: `cell_0_${q[0]}_${q[1]}`, entity: 'hero' }]);
    return s;
  };
  it('walking into a boulder from a side pushes it on; twice onto the plate holds it: success', () => {
    const c = grid();
    expect(c.on['plates:held']).toEqual({ end: 'success' });
    const s = walk(c, [[0, 1], [1, 1], [2, 1]]);
    expect(s.vars.__occ_0_1_1).toBe(0);
    expect(s.vars.__occ_0_3_1).toBe(1);
    expect(s.byId.__blk_0_3_1.on).toBe(true);
    expect(s.byId.__blk_0_1_1.on).toBe(false);
    expect(s.log.map((r) => r.type)).toContain('plates:held');
  });
  it('a boulder against the edge, a wall or another boulder does not move, and the walker is put back', () => {
    const s = walk(grid({ walls: [[2, 1]] }), [[0, 1], [1, 1]]);
    expect(s.vars.__occ_0_1_1).toBe(1);
    expect(s.log.map((r) => r.type)).toContain('bump');
    expect(s._ctrlWarps.hero).toEqual([1, 3, 0]);
  });
  it('a boulder entered from no side (the first step, or a diagonal) stays where it is', () => {
    const s = walk(grid(), [[0, 0], [1, 1]]);
    expect(s.vars.__occ_0_1_1).toBe(1);
  });
});

describe('the clock', () => {
  const B = buildBus();
  const clock = (p = {}) => {
    const c = composeMechanics([{ kind: 'clock', ...p }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero' });
    const s = B.createBusState(c.events, c.events.entities);
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); for (let k = 0; w.length && k < 8; k++) { B.processEvents(s, w); w = B.watchEvents(s); } };
    pump([]);
    return { s, tick: (sec) => { for (let k = 0; k < sec; k++) pump(B.tickTimers(s, 1)); }, pump };
  };
  it('runs the minutes, the hours and the days; dawn at six, a day at midnight', () => {
    const { s, tick } = clock({ start: 5, rate: 30 });
    expect([s.vars.hour, s.vars.minute, s.vars.day]).toEqual([5, 300, 1]);
    tick(2);
    expect(s.vars.hour).toBe(6);
    expect(s.log.map((r) => r.type)).toContain('dawn');
    tick(38);   // 1500 minutes: an hour past midnight
    expect([s.vars.day, s.vars.hour, s.vars.minute]).toEqual([2, 1, 60]);
  });
  it('a clock set forward many hours at once lands on the right hour', () => {
    const { s, pump } = clock({ start: 8 });
    s.vars.minute = 22 * 60 + 5;
    pump([]);
    expect(s.vars.hour).toBe(22);
  });
  it('turns the seasons every few days', () => {
    const { s, tick } = clock({ start: 23, rate: 60, seasons: 2 });
    tick(1 + 24 * 2);
    expect(s.vars.season).toBe(1);
    tick(24 * 6);
    expect(s.vars.season).toBe(0);
  });
});

describe('aftermath: what broke stays broken', () => {
  const STORE = { slices: [{ name: 'aftermath', kind: 'flags' }, { name: 'campaign', kind: 'progression' }] };
  it('keeps each break as a flag named for it, in a slice the level consumes and restores from', () => {
    const c = composeMechanics([{ kind: 'aftermath' }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero', storeSchema: STORE });
    expect(c.on['broke:*']).toEqual({ emit: { type: 'setFlag', slice: 'aftermath', key: '{event}', value: true } });
    expect(c.consumes).toEqual([{ slice: 'aftermath' }]);
    expect(c.aftermath).toEqual({ slice: 'aftermath' });
    expect(c.produces).toEqual([{ type: 'setFlag', slice: 'aftermath' }]);
  });
  it('a block that breaks says broke and broke:<id>; one restored at the start is gone, and says nothing', () => {
    const c = composeMechanics([{ kind: 'aftermath', slice: 'aftermath' }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero' });
    const hero = { id: 'hero', pilotable: true, rule: { type: 'walk', speed: 0 }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } };
    const E = composeLive();
    const W = E.createWorld({ entities: [hero], breakables: [{ id: 'crate-1', min: [2, -0.5, 0], max: [3, 0.5, 1] }, { id: 'crate-2', min: [5, -0.5, 0], max: [6, 0.5, 1] }] });
    let prev = E.castFacts(W, undefined).prev;
    E.restoreBlock(W, 'crate-2');
    let f = E.castFacts(W, prev); prev = f.prev;
    expect(f.events).toEqual([]);
    expect(W.breakables.find((b) => b.id === 'crate-2').broken.how).toBe('restore');
    E.breakBlock(W, 'crate-1', 99);
    f = E.castFacts(W, prev);
    expect(f.events.map((e) => e.type)).toEqual(['broke', 'broke:crate-1']);
  });
});

describe('aftermath on the page', () => {
  it('the game channel names the flag after the event, and restores the carried breaks at the start', async () => {
    const { gameChannelScript } = await import('../scene/channels/game.js');
    const s = gameChannelScript({ levelRef: 'x', on: { 'broke:*': { emit: { type: 'setFlag', slice: 'aftermath', key: '{event}', value: true } } }, aftermath: { slice: 'aftermath' } });
    expect(s).toContain("if (o[k] === '{event}') o[k] = ev.type;");
    expect(s).toContain("k.indexOf('broke:') === 0");
    const plain = gameChannelScript({ levelRef: 'x', on: { 'goal:reached': { end: 'success' } } });
    expect(plain).not.toContain('{event}');
    expect(plain).not.toContain('AFTERMATH');
  });
});
