import { describe, it, expect } from 'vitest';

import { lowerEventsProgram, EVENTS_PROGRAM_CHANNELS } from './events-program.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { buildBus } from '../worlds/event-bus.js';

// A PROGRAM FOR PLAY (events-program.js): a level's `events.program` run in the code realm as it is resolved, its bus
// data joined to the level's own rows. The concept: the program becomes data (the page never carries it), the same
// program the same data, a level without one unchanged, and a program that goes wrong says so, its log with it.

// a ring of `n` sensors round the exit's anchor, each counting into `near` when the walker passes, and the last one
// ending the level: logic past what any mechanic says, written in the recipe
const SOURCE = `
  const [x, y, z] = ctx.anchors.exit || [20, 0, 0];
  const sources = [], reactions = [];
  for (let k = 0; k < params.n; k++) {
    const a = (2 * Math.PI * k) / params.n, zone = 'ring_' + k;
    sources.push({ type: 'zone', zone, at: [x + params.r * Math.cos(a), y + params.r * Math.sin(a), z], radius: 1.5, planar: true, watch: 'hero' });
    reactions.push({ on: 'enter', match: { zone }, do: 'inc', var: 'near', by: 1 });
  }
  console.log('laid', sources.length, 'sensors');
  return { vars: { near: 0, laps: 0 }, sources, reactions };
`;
const program = (over = {}) => ({ source: SOURCE, params: { n: 4, r: 3 }, ...over });
const level = { anchors: { exit: [20, 0, 0] }, entities: ['hero'] };

describe('the program, lowered', () => {
  it('a block without a program is the same block', () => {
    const own = { reactions: [{ on: 'x', do: 'emit', type: 'y' }] };
    expect(lowerEventsProgram(own, level)).toBe(own);
    expect(lowerEventsProgram(undefined, level)).toBeUndefined();
  });

  it('becomes bus data joined after the level\'s own rows; the program itself is gone; the hand\'s variable wins', () => {
    const own = { vars: { laps: 3 }, reactions: [{ on: 'start', do: 'set', var: 'laps', to: 0 }], style: { accent: '#fff' } };
    const ev = lowerEventsProgram({ ...own, program: program() }, level);
    expect(ev).not.toHaveProperty('program');
    expect(ev.style).toEqual(own.style);
    expect(ev.sources.map((s) => s.zone)).toEqual(['ring_0', 'ring_1', 'ring_2', 'ring_3']);
    expect(ev.reactions[0]).toEqual(own.reactions[0]);
    expect(ev.reactions).toHaveLength(5);
    expect(ev.vars).toEqual({ near: 0, laps: 3 });
    // placed off the level's own anchor
    expect(ev.sources[0].at).toEqual([23, 0, 0]);
  });

  it('the same program is the same data; its params change it', () => {
    const a = lowerEventsProgram({ program: program() }, level), b = lowerEventsProgram({ program: program() }, level);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    a.sources.push({ type: 'zone' });   // (a resolve's rows are its own: the next is not touched)
    expect(lowerEventsProgram({ program: program() }, level).sources).toHaveLength(4);
    expect(lowerEventsProgram({ program: program({ params: { n: 6, r: 3 } }) }, level).sources).toHaveLength(6);
  });

  it('a program that goes wrong says so, with its log', () => {
    expect(() => lowerEventsProgram({ program: { source: 'return [1, 2];' } }, level)).toThrow(/events\.program: the program returns the bus's data/);
    expect(() => lowerEventsProgram({ program: { source: 'return { entities: [] };' } }, level)).toThrow(new RegExp(`'entities' is not a channel.*${EVENTS_PROGRAM_CHANNELS[0]}`));
    expect(() => lowerEventsProgram({ program: { source: 'return { reactions: [3] };' } }, level)).toThrow(/reactions is a list of rows/);
    let err;
    try { lowerEventsProgram({ program: { source: 'console.log("about to fail"); throw new Error("no exit");' } }, level); } catch (e) { err = e; }
    expect(err.message).toMatch(/events\.program: the program threw: no exit/);
    expect(err.message).toMatch(/about to fail/);
    expect(() => lowerEventsProgram({ program: { source: 'return { vars: { t: Date.now() } };' } }, level)).toThrow(/clock/);
  });
});

describe('through the resolve, onto the page', () => {
  const LEVEL = {
    kind: 'controllable',
    entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' }, transform: { pos: [0, 0, 2] } }],
    camera: { rule: 'follow', target: 'hero' },
    game: { levelRef: 'ring-1', mechanics: [{ kind: 'reach-exit', at: [20, 0, 0], radius: 2 }] },
  };

  it('the page runs the program\'s rows beside the mechanics\', and never carries its source', async () => {
    const { payload } = await resolveWorldScene({ title: 'ring', manifest: { ...LEVEL, events: { program: program() } } });
    const zones = payload.events.sources.filter((s) => s.type === 'zone').map((s) => s.zone);
    expect(zones).toEqual(expect.arrayContaining(['ring_0', 'ring_3', 'exit_0']));
    expect(payload.events.program).toBeUndefined();
    const html = emitThreeWorld(payload);
    expect(html).toContain('ring_3');
    expect(html).not.toContain('params.r * Math.cos');   // the source is not on the page
    // and the bus runs it: entering a sensor counts
    const { createBusState, processEvents } = buildBus();
    const state = processEvents(createBusState(payload.events), [{ type: 'enter', zone: 'ring_0', id: 'hero' }]);
    expect(state.vars.near).toBe(1);
  });

  it('a level without a program resolves as it did', async () => {
    const a = await resolveWorldScene({ title: 'ring', manifest: LEVEL });
    const b = await resolveWorldScene({ title: 'ring', manifest: { ...LEVEL, events: undefined } });
    expect(JSON.stringify(a.payload.events)).toBe(JSON.stringify(b.payload.events));
  });
});
