import { describe, expect, it } from 'vitest';

import { renderBeatsMidi, midiNote, TICKS_PER_QUARTER } from './beats-midi.js';
import { normalizeBeatsManifest } from './beats-manifest.js';

const PATTERN = normalizeBeatsManifest({
  kind: 'beats-pattern',
  title: 'Groove',
  bpm: 120,
  tracks: [
    { name: 'kick', patch: 'kick', mask: [1, 0, 0, 0] },
    { name: 'stab', patch: 'sawStab', mask: [0, 0, 1, 0], notes: [['A3', 'C4', 'E4']], transpose: 2 },
    { name: 'thumper', gesture: { type: 'thump' }, mask: [0, 1] },
  ],
});

const COMPOSITION = normalizeBeatsManifest({
  kind: 'beats-composition',
  title: 'Sting',
  bpm: 90,
  parts: [{ name: 'lead', patch: 'piano', events: [['0:0:0', 'C4', 1, 0.8], ['0:1:0', ['E4', 'G4'], 1, 0.6]] }],
});

describe('midiNote', () => {
  it('maps note names and Hz to MIDI numbers', () => {
    expect(midiNote('A4')).toBe(69);
    expect(midiNote('C4')).toBe(60);
    expect(midiNote('F#3')).toBe(54);
    expect(midiNote('Bb1')).toBe(34);
    expect(midiNote(440)).toBe(69);       // numeric notes are Hz — snapped
    expect(() => midiNote('H2')).toThrow(/bad note name/);
  });
});

describe('renderBeatsMidi', () => {
  it('emits a format-1 SMF: MThd header, tempo track, one track per row', () => {
    const { mid, meta } = renderBeatsMidi(PATTERN, { loops: 1 });
    expect(mid.subarray(0, 4).toString()).toBe('MThd');
    expect(mid.readUInt16BE(8)).toBe(1);                    // format 1
    expect(mid.readUInt16BE(10)).toBe(4);                   // tempo + 3 rows
    expect(mid.readUInt16BE(12)).toBe(TICKS_PER_QUARTER);
    expect(meta.tracks).toBe(3);
    expect(meta.notes).toBeGreaterThan(0);
    // tempo meta: 120bpm = 500000 µs/quarter → bytes 07 A1 20.
    expect(mid.includes(Buffer.from([0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]))).toBe(true);
  });

  it('is deterministic: same manifest + options → the same bytes', () => {
    const a = renderBeatsMidi(PATTERN, { loops: 2 }).mid;
    const b = renderBeatsMidi(PATTERN, { loops: 2 }).mid;
    expect(a.equals(b)).toBe(true);
  });

  it('drum-shaped rows land on channel 10; melodic rows get programs + transpose', () => {
    const { mid } = renderBeatsMidi(PATTERN, { loops: 1 });
    // kick: note-on channel 9 (0x99), GM 36. thump gesture: also 0x99/36.
    expect(mid.includes(Buffer.from([0x99, 36]))).toBe(true);
    // stab: program change to saw lead (0xc0, 81) and the chord transposed
    // +2 (A3=57 → 59, C4=60 → 62, E4=64 → 66) on a melodic channel (0x90).
    expect(mid.includes(Buffer.from([0xc0, 81]))).toBe(true);
    expect(mid.includes(Buffer.from([0x90, 59]))).toBe(true);
    expect(mid.includes(Buffer.from([0x90, 62]))).toBe(true);
    expect(mid.includes(Buffer.from([0x90, 66]))).toBe(true);
  });

  it('composition: velocities scale to 1–127 and chords emit every note', () => {
    const { mid, meta } = renderBeatsMidi(COMPOSITION);
    expect(meta.tracks).toBe(1);
    expect(meta.notes).toBe(3);                              // C4 + [E4, G4]
    expect(mid.includes(Buffer.from([0xc0, 0]))).toBe(true); // piano GM program
  });

  it('refuses beats-sfx (choreography, not a score) and reports skipped pitched foley', () => {
    expect(() => renderBeatsMidi({ kind: 'beats-sfx', title: 'x', cues: {} })).toThrow(/wav instead/);
    const flutterKit = normalizeBeatsManifest({
      kind: 'beats-pattern', title: 'chirp', bpm: 120,
      tracks: [{ name: 'chirp', gesture: { type: 'flutter' }, mask: [1, 0] }],
    });
    const { meta } = renderBeatsMidi(flutterKit, { loops: 1 });
    expect(meta.notes).toBe(0);
    expect(meta.skipped_gesture_hits).toBeGreaterThan(0);    // no silent truncation
  });
});
