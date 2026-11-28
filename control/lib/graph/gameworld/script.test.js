// THE SCRIPT (gameworld/script.js): a level's spoken lines read, teaching what it refuses; each line raised on the bus at
// its moment (a task begun or met, a find, a body down, the win), a few seconds after where it says; and on the page as
// comms, its speaker named and marked.
import { describe, expect, it } from 'vitest';
import { readScript, scriptSequences } from './script.js';
import { commsData } from '../scene/channels/comms.js';
import { composeMechanics } from '../game/mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const SCRIPT = { speakers: { cole: { name: 'Cole', colour: '#e0a040' } }, lines: [
  { id: 'hi', who: 'cole', text: 'Morning, rookie.', on: 'start', after: 1 },
  { id: 'there', who: 'cole', text: 'Good. Scanner on.', on: { done: 1 } },
  { id: 'won', who: 'boss', text: 'Pay day.', on: 'win' },
] };

describe('a script', () => {
  it('raises each line on the bus at its moment, after its seconds', () => {
    const S = readScript(SCRIPT, { tasks: 1 });
    const c = composeMechanics([{ kind: 'objectives', tasks: [{ id: 't1', kind: 'reach', text: 'Go', at: [40, 0, 0] }] }], { player: 'p', spawn: [0, 0, 0], fall: 'none' });
    const ev = { ...c.events, sequences: [...(c.events.sequences ?? []), ...scriptSequences(S.lines)] }, s = B.createBusState(ev, ev.entities);
    let prev;
    const pump = (events) => { B.processEvents(s, events); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
    const stand = (at) => { for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'p', position: at }], prev, ev.sources); prev = z.prev; pump(z.events); } };
    const time = (secs) => { for (let k = 0; k < secs * 10; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
    const said = () => s.log.filter((e) => /^comms:/.test(e.type)).map((e) => e.type.slice(6));
    pump(ev.initial ?? []); stand([0, 0, 0]);
    expect(said()).toEqual([]);                 // (its second not yet run)
    time(1.2);
    expect(said()).toEqual(['hi']);
    stand([40, 0, 0]); time(0.2);
    expect(said()).toEqual(['hi', 'there', 'won']);
  });

  it('names and marks each speaker on the page, one it was not told of by its id', () => {
    const D = commsData(readScript(SCRIPT, { tasks: 1 }));
    expect(D.speakers.cole).toMatchObject({ name: 'Cole', initials: 'C', colour: '#e0a040' });
    expect(D.speakers.boss.name).toBe('Boss');
    expect(D.lines.there).toEqual({ who: 'cole', text: 'Good. Scanner on.' });
  });

  it('refuses a line it cannot place or a moment it does not know, teaching', () => {
    expect(() => readScript({ lines: [{ id: 'a', who: 'cole', text: 'x', on: { done: 3 } }] }, { tasks: 2 })).toThrow(/done is a task, 1 to 2/);
    expect(() => readScript({ lines: [{ id: 'a', who: 'cole', text: 'x', on: 'dawn' }] })).toThrow(/'start' \| 'win'/);
    expect(() => readScript({ lines: [{ id: 'a', who: 'cole', text: 'x', on: 'start' }, { id: 'a', who: 'cole', text: 'y', on: 'win' }] })).toThrow(/id is its own name/);
  });
});

describe("a speaker's portrait", () => {
  const PIC = 'data:image/jpeg;base64,' + 'A'.repeat(400);
  it('a small still of the face, carried to the comms box in place of the initials; anything else refused', async () => {
    const { readScript } = await import('./script.js');
    const { commsData, commsScript } = await import('../scene/channels/comms.js');
    const S = readScript({ speakers: { quattro: { name: 'Captain Quattro', portrait: PIC } }, lines: [{ id: 'a', who: 'quattro', on: { begin: 1 }, text: 'On our six.' }] }, { tasks: 2 });
    expect(S.speakers.quattro.portrait).toBe(PIC);
    const D = commsData(S);
    expect(D.speakers.quattro.portrait).toBe(PIC);
    expect(() => new Function(commsScript(D))).not.toThrow();
    expect(() => readScript({ speakers: { q: { name: 'Q', portrait: 'https://example.com/q.jpg' } }, lines: [{ id: 'a', who: 'q', on: { begin: 1 }, text: 'x' }] }, { tasks: 2 })).toThrow(/portrait is a small still/);
    expect(() => readScript({ speakers: { q: { name: 'Q', portrait: 'data:image/jpeg;base64,' + 'A'.repeat(70000) } }, lines: [{ id: 'a', who: 'q', on: { begin: 1 }, text: 'x' }] }, { tasks: 2 })).toThrow(/portrait is a small still/);
  });
});
