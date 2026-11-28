/**
 * THE FRAMES' SCORE — the music of a frame's field (Terraformers: Warlords of Mars and every game on the frame rail):
 * chunky and gritty, each loop limited a few dB under full scale so it sits under the field. Two loops in D minor with a
 * Phrygian edge: the field's quiet a heavy band in one room (a stadium kit gated, a reese bass kept low, a string machine
 * for the dark, crotales and a tam-tam for the metal of the place), its fight a techno machine (a 909, an acid line, rave
 * stabs, a supersaw). The score follows play (beats/adaptive-music.js): the EXPLORE loop while the field is quiet, the
 * COMBAT loop once the shooting starts, changed on the bar line.
 *
 *   REGOLITH   explore: 84 bpm, half time. Dm | B♭ | Gm | A, four bars each: a pad held low and filtered, the reese bass
 *              on the roots (the one and the and of two), the kit in half time (its snare on three), a bell ping every
 *              other bar answering, the tam-tam on each turn. Spare, heavy, waiting.
 *   HARDPOINT  combat, techno: 134 bpm. Dm | B♭ | C | A, four bars each, twice: a 909 four on the floor (its trance
 *              drive the second pass), an acid line driven hard in sixteenths (the root, its octave, its flat third
 *              and seventh), rave stabs on the offbeats, a poly-string pad under it, and in the second pass a
 *              sixteenth arpeggio over the chord and the supersaw's hook.
 *
 *   FRAME_SCORE                      { explore, combat, tension } the loops and the meter that changes them
 *   frameScore()                     → { soundtrack, combat, tension } a frame level's `audio` music (beats-world.js)
 *
 * Regolith is RECORDED (`recorded: true`): its string machine is heard on the sound library's strings where the library
 * is installed (its takes inlined in the page), the synthesized one where it is not, byte for byte as without the switch.
 * Hardpoint is synthesized by design: a techno machine has no recorded twin.
 *
 * Pure: compositions are dice-free by construction, the same score every time.
 */
const f = Object.freeze;
// ("bar:beat:sixteenth")
const at = (bar, beat = 0, six = 0) => `${bar}:${beat}:${six}`;
const ROOM = f({ decay: 2.2, size: 0.6 });

// the progression's roots, a bar each (four bars a chord)
const EXPLORE_ROOTS = f(['D', 'Bb', 'G', 'A']);
const COMBAT_ROOTS = f(['D', 'Bb', 'C', 'A']);
const TRIAD = f({ D: ['D3', 'F3', 'A3'], Bb: ['Bb2', 'D3', 'F3'], G: ['G2', 'Bb2', 'D3'], A: ['A2', 'C#3', 'E3'], C: ['C3', 'E3', 'G3'] });
const LOW = f({ D: 'D1', Bb: 'Bb0', G: 'G0', A: 'A0', C: 'C1' });
const GTR = f({ D: 'D2', Bb: 'Bb1', G: 'G1', A: 'A1', C: 'C2' });

function regolith() {
  const bars = 16, pad = [], bass = [], bell = [], metal = [];
  for (let c = 0; c < 4; c++) {
    const r = EXPLORE_ROOTS[c], b0 = c * 4;
    pad.push([at(b0), TRIAD[r], '4:0:0', 0.32]);
    metal.push([at(b0), 'C3', '2:0:0', c === 0 ? 0.55 : 0.35]);
    for (let b = b0; b < b0 + 4; b++) {
      bass.push([at(b), LOW[r], '0:1:2', 0.42], [at(b, 1, 2), LOW[r], '0:0:2', 0.3]);
      if (b % 4 === 3) bass.push([at(b, 3, 2), r === 'A' ? 'C#1' : LOW[r].replace(/(\d)$/, (m) => String(Number(m))), '0:0:2', 0.4]);
    }
  }
  // (the bell answers every other bar, high and wet: the place's metal)
  const PINGS = ['A5', 'F5', 'D6', 'E5', 'A5', 'G5', 'F5', 'C#6'];
  PINGS.forEach((n, i) => bell.push([at(i * 2 + 1, 2), n, '1:0:0', 0.3]));
  return f({
    kind: 'beats-composition', title: 'Regolith', bpm: 84, swing: 0, loop: true, recorded: true, room: ROOM, master: { limit: -4 },
    parts: [
      { name: 'kit', instrument: 'stadium-kit-gated', send: 0.15, trim: 5, groove: [{ style: 'half-time', bars: [0, bars], fills: 'every-8', crash: 'section', vel: 0.85 }] },
      { name: 'bass', instrument: 'reese-bass', send: 0, trim: -9, chain: [{ type: 'drive', amount: 0.2 }, { type: 'filter', mode: 'lowpass', freq: 520 }], events: bass },
      { name: 'pad', instrument: 'string-machine', send: 0.5, trim: 6, chain: [{ type: 'filter', mode: 'lowpass', freq: 1400 }], events: pad },
      { name: 'bell', instrument: 'crotales', send: 0.7, trim: 3, events: bell },
      { name: 'metal', patch: 'tamTam', send: 0.6, trim: 3, events: metal },
    ],
  });
}

// (a note moved by semitones: 'D2' +3 → 'F2')
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const shift = (n, k) => { const m = /^([A-G][#b]?)(-?\d+)$/.exec(n), v = (Number(m[2]) + 1) * 12 + PC[m[1]] + k; return `${NAMES[((v % 12) + 12) % 12]}${Math.floor(v / 12) - 1}`; };
// the acid line, a bar of sixteenths over its root: semitones above it, null a rest
const ACID = f([0, null, 0, 12, 0, null, 3, 0, 0, null, 12, 0, 7, null, 0, 10]);

function hardpoint() {
  const passes = 2, acid = [], stabs = [], pad = [], arp = [], lead = [];
  for (let p = 0; p < passes; p++) for (let c = 0; c < 4; c++) {
    const r = COMBAT_ROOTS[c], b0 = p * 16 + c * 4, T = TRIAD[r].map((n) => shift(n, 12));
    pad.push([at(b0), TRIAD[r], '4:0:0', p ? 0.3 : 0.22]);
    for (let b = b0; b < b0 + 4; b++) {
      // (the acid line: sixteenths on the root, its octave and its flat third and seventh, the downbeats leaning)
      ACID.forEach((k, e) => { if (k !== null) acid.push([at(b, Math.floor(e / 4), e % 4), shift(GTR[r], k), '0:0:1', e % 4 === 0 ? 0.85 : 0.55]); });
      // (stabs on the offbeats, the triad an octave up, short)
      for (let q = 0; q < 4; q++) stabs.push([at(b, q, 2), T, '0:0:1', q === 3 ? 0.6 : 0.48]);
      // (the second pass: a sixteenth arpeggio over the chord, two octaves up)
      if (p) for (let e = 0; e < 16; e++) arp.push([at(b, Math.floor(e / 4), e % 4), shift(T[e % 3], 12 * (e % 6 < 3 ? 0 : 1)), '0:0:1', 0.36]);
    }
  }
  // (the hook, in the second pass: two bars called, two answered, over each chord)
  const HOOK = [
    [[0, 0, 'D5', 2], [0, 2, 'F5', 1], [0, 3, 'G5', 1], [1, 0, 'A5', 4]],
    [[0, 0, 'Bb5', 2], [0, 2, 'A5', 1], [0, 3, 'G5', 1], [1, 0, 'F5', 4]],
    [[0, 0, 'G5', 2], [0, 2, 'E5', 1], [0, 3, 'F5', 1], [1, 0, 'G5', 4]],
    [[0, 0, 'E5', 2], [0, 2, 'C#5', 1], [0, 3, 'E5', 1], [1, 0, 'A5', 3], [1, 3, 'G5', 1]],
  ];
  HOOK.forEach((ph, c) => ph.forEach(([b, beat, n, beats]) => lead.push([at(16 + c * 4 + b, beat), n, String(beats), 0.7])));
  return f({
    kind: 'beats-composition', title: 'Hardpoint', bpm: 134, swing: 0, loop: true, room: ROOM, master: { limit: -4, glue: { threshold: -18, ratio: 3 } },
    parts: [
      { name: 'kit', instrument: 'drum-machine-909', send: 0.08, trim: -7, groove: [{ style: 'four-floor', bars: [0, 16], fills: 'every-8', crash: 'section' }, { style: 'trance-drive', bars: [16, 32], fills: 'every-8', crash: 'section' }] },
      { name: 'acid', instrument: 'acid-bass', send: 0, trim: -11, chain: [{ type: 'drive', amount: 0.5 }, { type: 'filter', mode: 'lowpass', freq: 1600 }], events: acid },
      { name: 'stabs', patch: 'raveStab', send: 0.3, trim: -13, events: stabs },
      { name: 'pad', instrument: 'poly-strings', send: 0.5, trim: -13, events: pad },
      { name: 'arp', patch: 'trancePluck', send: 0.45, trim: -14, chain: [{ type: 'delay', time: '1/8', feedback: 0.3, wet: 0.25 }], events: arp },
      { name: 'lead', instrument: 'supersaw-lead', send: 0.4, trim: -13, events: lead },
    ],
  });
}

// the meter: hits and falls raise it (any body's: a fight in earnest), an alarm fills it; it leaks back to explore
export const FRAME_SCORE = f({ explore: regolith(), combat: hardpoint(), tension: f({ on: f({ 'hit:*': 0.3, down: 0.2 }), enter: 0.55, exit: 0.2, hold: 4, decay: 8 }) });

export function frameScore() {
  return { soundtrack: FRAME_SCORE.explore, combat: FRAME_SCORE.combat, tension: { ...FRAME_SCORE.tension, on: { ...FRAME_SCORE.tension.on } } };
}
