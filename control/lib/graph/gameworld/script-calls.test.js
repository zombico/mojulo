import { describe, it, expect } from 'vitest';
import { readScript, scriptSequences } from './script.js';
import { callsData, callsScript } from '../scene/channels/calls.js';
import { gameScript } from './script-book.js';

// THE CALLS: a level's radio calls, read, raised on the bus at their moments, laid for the call screen, read in the book
const SCRIPT = {
  speakers: { coral: { name: 'Coral' }, chandler: { name: 'Chandler', colour: '#d9a441' } },
  calls: [
    { id: 'signal', on: 'start', from: 'chandler', lines: [{ id: 'sg-1', who: 'coral', text: '... This is Coral.' }, { id: 'sg-2', who: 'chandler', text: 'Just testing the signal.' }] },
    { id: 'spotted', on: { event: 'alarm:found' }, after: 1, lines: [{ id: 'sp-1', who: 'chandler', text: 'They know you are there. Break their line and hide.' }] },
  ],
};

describe('a level\'s radio calls', () => {
  it('are read beside its lines, each moment a task\'s or any event the bus hears, and teach what is wrong', () => {
    const S = readScript(SCRIPT, { tasks: 2 });
    expect(S.lines).toEqual([]);
    expect(S.calls.map((C) => C.id)).toEqual(['signal', 'spotted']);
    expect(S.calls[1].on).toEqual({ event: 'alarm:found' });
    expect(() => readScript({ speakers: {} })).toThrow(/its lines .* or its calls/);
    expect(() => readScript({ calls: [{ id: 'x', on: 'start', lines: [{ id: 'a', who: 'coral', text: 'hi' }], from: 'krait' }] })).toThrow(/from is one who speaks/);
    expect(() => readScript({ calls: [{ id: 'x', on: { event: 'Bad Event' }, lines: [{ id: 'a', who: 'coral', text: 'hi' }] }] })).toThrow(/bus event/);
    // (a line's id is its voice's: never two the same, on a call or off one)
    expect(() => readScript({ lines: [{ id: 'a', who: 'coral', text: 'hi', on: 'start' }], calls: [{ id: 'x', on: 'start', lines: [{ id: 'a', who: 'coral', text: 'hi' }] }] })).toThrow(/its own name/);
  });

  it('are raised on the bus at their moments: call:<id>, after its seconds', () => {
    const S = readScript(SCRIPT, { tasks: 2 }), Q = scriptSequences(S.lines, S.calls);
    expect(Q.map((q) => q.id)).toEqual(['call:signal', 'call:spotted']);
    expect(Q[0].trigger).toEqual({ on: 'objective:begin', task: 't1' });
    expect(Q[1].trigger).toEqual({ on: 'alarm:found' });
    expect(Q[1].steps).toEqual([{ await: { timer: 1 } }, { do: 'emit', type: 'call:spotted' }]);
  });

  it('are laid for the call screen: the one called on the left, the caller on the right', () => {
    const D = callsData(readScript(SCRIPT, { tasks: 2 }));
    expect(D.calls.signal).toMatchObject({ left: 'coral', right: 'chandler' });
    expect(D.speakers.chandler).toMatchObject({ name: 'Chandler', initials: 'C', colour: '#d9a441' });
    // (a call one speaker makes alone has no one on its left)
    expect(D.calls.spotted).toMatchObject({ left: null, right: 'chandler' });
    const js = callsScript(D);
    expect(js).toContain('__mojFreeze');
    expect(() => new Function(js)).not.toThrow();
  });

  it('are read in the script book, on the radio at their moments', () => {
    const G = { ids: ['dock'], levels: { dock: { name: 'The hangar dock', infiltration: { tasks: [{ reach: [0, 0] }] }, script: SCRIPT } } };
    const L = gameScript(G).levels[0];
    expect(L.lines.map((l) => l.id)).toEqual(['sg-1', 'sg-2', 'sp-1']);
    expect(L.lines[2].when).toBe('on the radio, 1 s after, as the bus hears alarm:found');
  });
});
