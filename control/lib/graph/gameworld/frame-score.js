/**
 * THE FRAMES' SCORE — the music of a frame's field (Terraformers: Warlords of Mars and every game on the frame rail):
 * chunky and gritty, a machine band in one room, each loop limited a few dB under full scale so it sits under the field. Two loops in D minor with a Phrygian edge, one band: a stadium kit
 * (gated), a reese bass that growls, a drop-tuned guitar that chugs, a string machine for the dark, fm brass for the
 * turns, crotales and a tam-tam for the metal of the place. The score follows play (beats/adaptive-music.js): the
 * EXPLORE loop while the field is quiet, the COMBAT loop once the shooting starts, changed on the bar line.
 *
 *   REGOLITH   explore: 84 bpm, half time. Dm | B♭ | Gm | A, four bars each: a pad held low and filtered, the reese bass
 *              on the roots (the one and the and of two), the kit in half time (its snare on three), a bell ping every
 *              other bar answering, the tam-tam on each turn. Spare, heavy, waiting.
 *   HARDPOINT  combat: 132 bpm. Dm | B♭ | C | A, four bars each, twice: the drop guitar chugging eighths palm-muted on
 *              the root with a climb at each bar's end, the bass doubling it an octave down, the kit's rock drive then
 *              its double time for the second pass, brass dyads on each turn, and in the second pass the lead's hook.
 *
 *   FRAME_SCORE                      { explore, combat, tension } the loops and the meter that changes them
 *   frameScore()                     → { soundtrack, combat, tension } a frame level's `audio` music (beats-world.js)
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
// (each root's climb at the bar's end: the minor third and the fourth over it, the chug's turn)
const CLIMB = f({ D: ['F2', 'G2'], Bb: ['Db2', 'Eb2'], C: ['Eb2', 'F2'], A: ['C2', 'D2'], G: ['Bb1', 'C2'] });

function regolith() {
  const bars = 16, pad = [], bass = [], bell = [], metal = [];
  for (let c = 0; c < 4; c++) {
    const r = EXPLORE_ROOTS[c], b0 = c * 4;
    pad.push([at(b0), TRIAD[r], '4:0:0', 0.32]);
    metal.push([at(b0), 'C3', '2:0:0', c === 0 ? 0.55 : 0.35]);
    for (let b = b0; b < b0 + 4; b++) {
      bass.push([at(b), LOW[r], '0:1:2', 0.62], [at(b, 1, 2), LOW[r], '0:0:2', 0.45]);
      if (b % 4 === 3) bass.push([at(b, 3, 2), r === 'A' ? 'C#1' : LOW[r].replace(/(\d)$/, (m) => String(Number(m))), '0:0:2', 0.4]);
    }
  }
  // (the bell answers every other bar, high and wet: the place's metal)
  const PINGS = ['A5', 'F5', 'D6', 'E5', 'A5', 'G5', 'F5', 'C#6'];
  PINGS.forEach((n, i) => bell.push([at(i * 2 + 1, 2), n, '1:0:0', 0.3]));
  return f({
    kind: 'beats-composition', title: 'Regolith', bpm: 84, swing: 0, loop: true, room: ROOM, master: { limit: -4 },
    parts: [
      { name: 'kit', instrument: 'stadium-kit-gated', send: 0.15, groove: [{ style: 'half-time', bars: [0, bars], fills: 'every-8', crash: 'section', vel: 0.85 }] },
      { name: 'bass', instrument: 'reese-bass', send: 0, chain: [{ type: 'drive', amount: 0.35 }, { type: 'filter', mode: 'lowpass', freq: 900 }], events: bass },
      { name: 'pad', instrument: 'string-machine', send: 0.5, chain: [{ type: 'filter', mode: 'lowpass', freq: 1400 }], events: pad },
      { name: 'bell', instrument: 'crotales', send: 0.7, events: bell },
      { name: 'metal', patch: 'tamTam', send: 0.6, events: metal },
    ],
  });
}

function hardpoint() {
  const passes = 2, guitar = [], bass = [], brass = [], lead = [];
  for (let p = 0; p < passes; p++) for (let c = 0; c < 4; c++) {
    const r = COMBAT_ROOTS[c], b0 = p * 16 + c * 4;
    brass.push([at(b0), TRIAD[r].slice(1).map((n) => n.replace(/(\d)$/, (m) => String(Number(m) + 1))), '0:2:0', 0.7]);
    for (let b = b0; b < b0 + 4; b++) {
      // (eighths palm-muted on the root, the last two climbing; the bass under it an octave down)
      for (let e = 0; e < 8; e++) {
        const climb = b % 4 === 3 && e >= 6, n = climb ? CLIMB[r][e - 6] : GTR[r];
        guitar.push([at(b, Math.floor(e / 2), (e % 2) * 2), n, '0:0:2', e % 2 ? 0.62 : 0.82]);
        bass.push([at(b, Math.floor(e / 2), (e % 2) * 2), n.replace(/(\d)$/, (m) => String(Number(m) - 1)), '0:0:2', e % 2 ? 0.55 : 0.72]);
      }
    }
  }
  // (the hook, in the second pass: two bars called, two answered, over each chord)
  const HOOK = [
    [[0, 0, 'D4', 2], [0, 2, 'F4', 1], [0, 3, 'G4', 1], [1, 0, 'A4', 4]],
    [[0, 0, 'Bb4', 2], [0, 2, 'A4', 1], [0, 3, 'G4', 1], [1, 0, 'F4', 4]],
    [[0, 0, 'G4', 2], [0, 2, 'E4', 1], [0, 3, 'F4', 1], [1, 0, 'G4', 4]],
    [[0, 0, 'E4', 2], [0, 2, 'C#4', 1], [0, 3, 'E4', 1], [1, 0, 'A4', 3], [1, 3, 'G4', 1]],
  ];
  HOOK.forEach((ph, c) => ph.forEach(([b, beat, n, beats]) => lead.push([at(16 + c * 4 + b, beat), n, String(beats), 0.78])));
  return f({
    kind: 'beats-composition', title: 'Hardpoint', bpm: 132, swing: 0, loop: true, room: ROOM, master: { limit: -4, glue: { threshold: -18, ratio: 3 } },
    parts: [
      { name: 'kit', instrument: 'stadium-kit-gated', send: 0.12, groove: [{ style: 'rock-drive', bars: [0, 16], fills: 'every-4', crash: 'section' }, { style: 'double-time-chorus', bars: [16, 32], fills: 'every-4', crash: 'section' }] },
      { name: 'guitar', instrument: 'drop-guitar', send: 0, trim: -6, events: guitar },
      { name: 'bass', instrument: 'reese-bass', send: 0, trim: -3, chain: [{ type: 'drive', amount: 0.4 }], events: bass },
      { name: 'brass', instrument: 'fm-brass', send: 0.35, events: brass },
      { name: 'lead', instrument: 'rock-lead', send: 0.4, trim: -4, events: lead },
    ],
  });
}

// the meter: hits and falls raise it (any body's: a fight in earnest), an alarm fills it; it leaks back to explore
export const FRAME_SCORE = f({ explore: regolith(), combat: hardpoint(), tension: f({ on: f({ 'hit:*': 0.3, down: 0.2 }), enter: 0.55, exit: 0.2, hold: 4, decay: 8 }) });

export function frameScore() {
  return { soundtrack: FRAME_SCORE.explore, combat: FRAME_SCORE.combat, tension: { ...FRAME_SCORE.tension, on: { ...FRAME_SCORE.tension.on } } };
}
