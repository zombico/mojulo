/**
 * philosophers stone audio — real beats manifests, not a parallel grammar.
 *
 * A looping beats-ambient theme (seeded dice, synthesized never sampled) + a
 * beats-sfx cue bank, both validated by the beats mint gate and played by the
 * stock kernel (buildBeatsKernel.toString() inlined into the shell, the
 * beats-player discipline). The shell fires cues off game transitions — audio
 * reads sim state and never writes back; the reducer knows nothing about sound.
 *
 * Whimsy: a celesta bubbling over a sweet I–IV–vi–V, a tuba on the roots, a soft
 * hat shimmer. bpm 104, gentle swing — a cosy little laboratory.
 */

/** The looping theme — one seed, same performance forever. */
export const PS_THEME = {
  kind: 'beats-ambient',
  title: "Philosopher's Stone — The Laboratory",
  bpm: 104,
  swing: 0.14,
  seed: 26,
  progression: [
    { root: 'C3', chord: ['C4', 'E4', 'G4'] }, // C
    { root: 'F2', chord: ['F3', 'A3', 'C4'] }, // F
    { root: 'A2', chord: ['A3', 'C4', 'E4'] }, // Am
    { root: 'G2', chord: ['G3', 'B3', 'D4'] }, // G
  ],
  channels: [
    { name: 'bed', role: 'harmony', patch: 'pad' },
    { name: 'roots', role: 'roots', patch: 'tuba' },
    {
      name: 'bubbles',
      role: 'melody',
      patch: 'celesta',
      sequence: { table: ['E5', 'G5', 'C6', 'B5', 'A5', 'C6', 'E6', 'G5'], gate: 0.55 },
    },
    { name: 'shimmer', role: 'pulse', patch: 'hat', steps: [0.4, 0, 0.2, 0.1, 0.4, 0, 0.2, 0, 0.4, 0, 0.25, 0.1, 0.4, 0, 0.3, 0.2] },
  ],
};

/** Foley cues fired off game transitions by the shell. */
export const PS_SFX = {
  kind: 'beats-sfx',
  title: "Philosopher's Stone — Foley",
  cues: {
    swap: [{ type: 'thump', from: 'E4', to: 'A4' }],
    invalid: [{ type: 'thump', from: 'D3', to: 'B2' }],
    match: [{ type: 'burst' }, { type: 'sweep', from: 'C5', to: 'G5' }],
    cascade: [{ type: 'burst' }, { type: 'sweep', from: 'G5', to: 'E6' }], // brighter, for chained pops
    promote: [{ type: 'ring' }, { type: 'sweep', from: 'C5', to: 'C6' }],
    stone: [{ type: 'ring' }, { type: 'sweep', from: 'C4', to: 'C7' }, { type: 'burst' }], // the grand transmute
    reshuffle: [{ type: 'sweep', from: 'A5', to: 'C5' }],
    levelup: [{ type: 'ring' }, { type: 'sweep', from: 'C5', to: 'G6' }],
    timesup: [{ type: 'sweep', from: 'G4', to: 'G2' }, { type: 'thump', from: 'C3', to: 'C2' }],
  },
};
