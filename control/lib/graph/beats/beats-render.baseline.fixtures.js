/**
 * Byte-identity baseline fixtures for the offline render (the golden rule: a
 * kernel's output for given params is a compatibility promise over minted rows).
 * Each fixture is a representative stored-shape manifest that opts into NOTHING
 * newer than the pin; beats-render.baseline.test.js hashes its WAV. A realizer
 * change that moves one of these hashes changed what an existing row renders.
 */

import { normalizeBeatsManifest } from './beats-manifest.js';

const bars = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

export const BASELINE_FIXTURES = {
  // the band: piano + acoustic guitar + a string pair + brass + a kit.
  composition: {
    manifest: normalizeBeatsManifest({
      kind: 'beats-composition', title: 'baseline band', bpm: 104, seed: 41,
      parts: [
        { name: 'keys', instrument: 'piano', events: [['0:0:0', ['C3', 'E3', 'G3', 'C4'], '1:0:0', 0.8], ['1:0:0', ['A2', 'C3', 'E3', 'A4'], '1:0:0', 0.95]] },
        { name: 'gtr', instrument: 'acoustic-guitar', events: [['0:0:0', ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'], '0:2:0', 0.8], ['0:2:0', ['A2', 'E3', 'A3', 'C#4', 'E4'], '0:2:0', 0.7], ['1:0:0', 'C6', '0:2:0', 0.8]] },
        { name: 'vln', instrument: 'violin', events: [['0:0:0', 'E5', '2:0:0', 0.7]] },
        { name: 'vc', instrument: 'cello', events: [['0:0:0', 'C3', '2:0:0', 0.7]] },
        { name: 'tpt', instrument: 'trumpet', events: [['0:2:0', 'G4', '0:1:0', 0.6], ['1:0:0', 'C5', '0:2:0', 1]] },
        { name: 'kick', patch: 'kick', events: bars(4, (i) => [`${Math.floor(i / 2)}:${(i % 2) * 2}:0`, 'C1', '0:1:0', 1]) },
        { name: 'hat', patch: 'hat', events: bars(8, (i) => [`${Math.floor(i / 4)}:${i % 4}:0`, 'C1', '0:0:1', 0.9]) },
        { name: 'snare', patch: 'burstSoft', events: [['0:1:0', 'C1', '0:0:2', 0.8], ['1:1:0', 'C1', '0:0:2', 0.8]] },
      ],
    }),
    opts: { tail: 1 },
  },
  // a groove with a gesture track, a feel'd stab, and a harmony-bus pad.
  pattern: {
    manifest: normalizeBeatsManifest({
      kind: 'beats-pattern', title: 'baseline groove', bpm: 126, swing: 0.1, seed: 9, steps: 16,
      chords: { i: ['C3', 'Eb3', 'G3'], iv: ['F3', 'Ab3', 'C4'] }, progression: ['i', 'iv'],
      tracks: [
        { name: 'kick', gesture: { type: 'thump', from: 'G2', to: 'G1' }, mask: [1, 0, 0, 0] },
        { name: 'clap', cue: [{ type: 'burst', decay: 0.12, highpass: 900 }, { type: 'grain', grains: 5, over: 0.03, seed: 3 }], mask: [0, 0, 0, 0, 1, 0, 0, 0] },
        { name: 'stab', patch: 'sawStab', feel: { jitterTime: 0.004 }, mask: [0, 0, 0.8, 0], notes: ['C3'], chain: [{ type: 'pingpong', time: '3/16', mix: 0.3 }] },
        { name: 'pad', instrument: 'organ', chordVoice: 'chord', mask: [0.7, 0, 0, 0, 0, 0, 0, 0] },
      ],
    }),
    opts: { loops: 1, tail: 0.8 },
  },
  // foley: grain + ring (+ a sweep, a flutter, a burst).
  sfx: {
    manifest: normalizeBeatsManifest({
      kind: 'beats-sfx', title: 'baseline foley',
      cues: {
        clink: [
          { type: 'grain', grains: 14, over: 0.2, band: { lo: 800, hi: 6000 }, seed: 12 },
          { type: 'ring', material: 'glass', note: 'E6', at: 0.02 },
          { type: 'ring', material: 'metal', note: 'A4', at: 0.1, decay: 0.5 },
          { type: 'sweep', from: 'A4', to: 'E5', dur: 0.08, at: 0.2 },
          { type: 'flutter', rateHz: 24, hold: 0.2, jitter: 0.5, at: 0.3 },
          { type: 'burst', decay: 0.1, lowpass: 3000, at: 0.35 },
        ],
      },
    }),
    opts: { tail: 0.5 },
  },
  // generative loop: harmony + roots + melody + pulse, with an instrument channel and a tone macro.
  ambient: {
    manifest: normalizeBeatsManifest({
      kind: 'beats-ambient', title: 'baseline drift', bpm: 88, seed: 20260925, swing: 0.08,
      progression: [{ chord: ['C3', 'E3', 'G3', 'B3'], root: 'C2' }, { chord: ['A2', 'C3', 'E3', 'G3'], root: 'A1' }],
      channels: [
        { name: 'pads', role: 'harmony', patch: 'pad', chain: [{ type: 'reverb', decay: 3, wet: 0.35 }, { type: 'chorus' }], tone: 0.7 },
        { name: 'bass', role: 'roots', patch: 'bassMono' },
        { name: 'bells', role: 'melody', instrument: 'celesta', sequence: { table: ['E5', 'G5', 'A5', 'C6', 'D6'] } },
        { name: 'kick', role: 'pulse', patch: 'kick', note: 'C1', steps: [1, 0, 0, 0, 0.9, 0, 0, 0], dropout: 0.1 },
      ],
    }),
    opts: { bars: 2, tail: 1 },
  },
};
