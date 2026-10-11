// The chapter chain end to end, on the real kernels the page runs (the bus by buildBus, the store by its kernel):
// a happening turns a chapter → its cues change the world on the bus → the turn's bus event, mapped by game.on, is a
// setFlag in the envelope → the store applies it → a gate on that flag opens. Then a later level that holds the flag
// starts with the world applied (the carried event the game channel pushes), without presenting it again.
import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents } from '../../worlds/event-bus.js';
import { buildGameStoreKernel } from '../../game/store-kernel.js';
import { lowerPlay } from './direction.js';
import { chapterContract, chapterKey } from './chapters.js';

const K = buildGameStoreKernel();
const STORE = { slices: [{ name: 'campaign', kind: 'progression' }, { name: 'world', kind: 'flags' }] };
const PLAY = {
  chapters: [
    { id: 'warned', when: { on: 'mayor-warned' }, world: { set: { gate: 'shut' } } },
    { id: 'siege', when: { after: 'warned' }, world: { set: { alarm: 'ringing' } } },
  ],
  carry: 'world',
};
const CONTRACT = chapterContract({ levelRef: 'town', produces: { events: [] } }, PLAY);

// one page frame: incoming events, then watches → reactions to a fixed point (events.js __watchFix)
function frame(bus, incoming) {
  processEvents(bus, incoming);
  for (let g = 0; g < 8; g++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); }
}
// the game channel's on-mapping over the drained log (scene/channels/game.js): bus event → typed store event
const mapped = (bus) => bus.log.flatMap((ev) => (ev && CONTRACT.on[ev.type] && CONTRACT.on[ev.type].emit ? [CONTRACT.on[ev.type].emit] : []));
const level = () => createBusState(lowerPlay({ play: PLAY }), []);

describe('a chapter, end to end', () => {
  it('turns on a happening, changes the world, chains the next, and opens the gate that waits on it', () => {
    const bus = level();
    frame(bus, [{ type: 'mayor-warned' }]);
    expect(bus.vars).toMatchObject({ gate: 'shut', alarm: 'ringing', 'chapter-warned': 1, 'chapter-siege': 1 });

    const events = mapped(bus);
    expect(events.map((e) => e.key)).toEqual([chapterKey('warned'), chapterKey('siege')]);
    const envelope = { contractVersion: K.CONTRACT_VERSION, levelRef: 'town', seed: 1, result: 'success', events };
    const r = K.applyOutcome(STORE, K.createStore(STORE), CONTRACT, envelope);
    expect(r.ok).toBe(true);
    expect(K.evalGate(STORE, r.state, { flag: chapterKey('siege') })).toBe(true);
    expect(K.evalGate(STORE, r.state, { flag: chapterKey('fallen') })).toBe(false);
  });

  it('turns once: the same happening again changes nothing more', () => {
    const bus = level();
    frame(bus, [{ type: 'mayor-warned' }]);
    const n = mapped(bus).length;
    frame(bus, [{ type: 'mayor-warned' }]);
    expect(mapped(bus).length).toBe(n);
  });

  it('carries into a later level: the world is as it was left, and nothing is written again', () => {
    const bus = level();
    expect(bus.vars.gate).toBeUndefined();
    frame(bus, CONTRACT.chapters.carried.map((c) => ({ type: c.event })));
    expect(bus.vars).toMatchObject({ gate: 'shut', alarm: 'ringing' });
    expect(mapped(bus)).toEqual([]);
    // the happening met again in the later level turns nothing: no presentation, no second write
    frame(bus, [{ type: 'mayor-warned' }]);
    expect(mapped(bus)).toEqual([]);
    expect(bus.log.some((e) => e.type === 'chapter-warned')).toBe(false);
  });

  it('carries the first chapter alone: the one after it still waits for a live turn', () => {
    const bus = level();
    frame(bus, [{ type: CONTRACT.chapters.carried[0].event }]);
    expect(bus.vars.gate).toBe('shut');
    expect(bus.vars.alarm).toBeUndefined();
  });
});
