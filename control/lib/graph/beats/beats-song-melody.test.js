import { describe, it, expect } from 'vitest';

import {
  degreeSemitone, midiNoteName, fromRows, parseHooktheory, MINOR_DEGREES, MAJOR_DEGREES,
} from './beats-song-melody.js';

describe('beats-song-melody — degree math', () => {
  it('decodes natural-minor and major degrees', () => {
    expect(degreeSemitone('1')).toBe(0);
    expect(degreeSemitone('3')).toBe(3);       // minor third
    expect(degreeSemitone('3', 'major')).toBe(4);
    expect(degreeSemitone('7')).toBe(10);      // subtonic in natural minor
    expect(degreeSemitone('7', 'major')).toBe(11);
  });

  it('stacks accidentals the way Hooktheory emits them', () => {
    expect(degreeSemitone('#6')).toBe(MINOR_DEGREES[6] + 1);  // raised sixth = 9
    expect(degreeSemitone('b3', 'major')).toBe(MAJOR_DEGREES[3] - 1);
    expect(degreeSemitone('##4')).toBe(MINOR_DEGREES[4] + 2);
    expect(() => degreeSemitone('9')).toThrow(/unknown scale degree/);
  });

  it('names MIDI notes in the noteHz octave convention', () => {
    expect(midiNoteName(67)).toBe('G4');
    expect(midiNoteName(60)).toBe('C4');
    expect(midiNoteName(58)).toBe('A#3');
  });
});

describe('beats-song-melody — parseHooktheory', () => {
  const rows = [
    [1, 3, '1', 0, 1],        // pickup rest
    [4, 1, '7', -1, 0],       // F4 (subtonic below the G4 tonic)
    [5, 2, '#6', -1, 0],      // E4 (raised sixth below tonic)
    [7, 8, '4', 0, 0],        // C5
  ];

  it('keeps rests and decodes sounding notes against the tonic', () => {
    const events = parseHooktheory(fromRows(rows), { tonicMidi: 67, mode: 'minor' });
    expect(events[0]).toEqual({ beat: 1, beats: 3, isRest: true });
    expect(events[1]).toMatchObject({ beat: 4, beats: 1, isRest: false, note: 'F4' });
    expect(events[2]).toMatchObject({ note: 'E4' });
    expect(events[3]).toMatchObject({ note: 'C5', midi: 72 });
  });

  it('is pure and deterministic', () => {
    const a = parseHooktheory(fromRows(rows));
    const b = parseHooktheory(fromRows(rows));
    expect(a).toEqual(b);
  });
});
