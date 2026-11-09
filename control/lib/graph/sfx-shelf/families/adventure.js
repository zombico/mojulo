/**
 * families/adventure — a quest's sounds: spells (`magic`: cast, heal, buff, teleport, summon, curse, by school and
 * power), the bow (`bow`: drawn, loosed, the arrow passing and striking), and the things a world is worked by
 * (`interact`: a chest, a lever, a pressure plate, a key, a gate, coins, a potion, a creak). Pure.
 */
import { transient, sub, grit, tail, plate, duck, harmonicsOf, whoosh, ringOf, chime, knock, creak, lowBody, air } from '../layers.js';

// a school: its colour, as the material its sparkle rings in, the notes it climbs, its drone
const SCHOOLS = {
  arcane: { mat: 'glass', notes: ['E5', 'B5', 'E6', 'G#6'], drone: ['E3', 'square'], band: [3000, 11000] },
  light: { mat: 'bell', notes: ['C6', 'E6', 'G6', 'C7'], drone: ['C4', 'sine'], band: [4000, 12000] },
  dark: { mat: 'plate', notes: ['D4', 'G#3', 'D3', 'G#2'], drone: ['D2', 'sawtooth'], band: [200, 2500] },
  nature: { mat: 'wood', notes: ['G4', 'B4', 'D5', 'G5'], drone: ['G3', 'triangle'], band: [1500, 7000] },
};
const POWER = ['minor', 'major'];

export const magic = {
  label: 'a spell: cast, heal, buff, teleport, summon, curse, by its school and its power',
  dials: { act: ['cast', 'heal', 'buff', 'teleport', 'summon', 'curse'], school: Object.keys(SCHOOLS), power: POWER },
  defaults: { act: 'cast', school: 'arcane', power: 'minor' },
  ordered: [{ dial: 'power', rises: ['ms'] }],
  build(d, seed) {
    const S = SCHOOLS[d.school], P = POWER.indexOf(d.power), s = 1 + 0.7 * P;
    const sparkle = (at, over, vol, i) => grit(Math.round(24 * s), over * s, S.band[0], S.band[1], vol * 1.4, seed(i), { at, pan: i % 2 ? 0.35 : -0.35, send: 0.45 });
    const drone = (at, dur, vol, to) => ({ type: 'tone', note: S.drone[0], ...(to ? { to } : {}), dur: dur * s, wave: S.drone[1], lowpass: 2000, vol, attack: 0.05, release: 0.2, vibrato: { rate: 5, depth: 15 }, at, send: 0.4 });
    const bloom = (at) => [sub('C2', 'C1', 0.25 * s, 0.08 + 0.06 * P, { at }), transient(3000, 0.01, 0.2, { at })];
    switch (d.act) {
      case 'cast': return [
        { type: 'sweep', wave: 'sine', from: S.notes[0], to: S.notes[3], dur: 0.2 * s, vol: 0.12, send: 0.35 },
        { type: 'flutter', wave: 'triangle', rateHz: 30, hold: 0.25 * s, tiers: [{ at: 0, table: S.notes.slice(0, 2) }, { at: 0.12 * s, table: S.notes.slice(2) }], vol: 0.06, pan: -0.25, send: 0.4 },
        whoosh(800, 7000, 0.3 * s, 0.22, { at: 0.18 * s, pan: 0.2, send: 0.3 }),
        sparkle(0.15 * s, 0.35, 0.14, 1), ...bloom(0.2 * s), drone(0, 0.35, 0.05),
        ...(P ? [duck(3, 0.1, 0.4), tail(0.8, 6000, 400, 0.12, { at: 0.2 * s, send: 0.6 })] : []),
      ];
      case 'heal': return [
        ...chime(S.mat === 'plate' ? 'bell' : S.mat, S.notes, 0, 0.08 * s, 0.45, 0.06),
        { type: 'tone', note: S.notes[0], to: S.notes[2], dur: 0.6 * s, wave: 'sine', vol: 0.03, attack: 0.15, release: 0.3, send: 0.5 },
        sparkle(0.1, 0.6, 0.1, 1), ...knock('C3', 'G2', 0.15, 0.25, 1500), lowBody(0.3), air(0.12, 0.4), { type: 'burst', decay: 0.5 * s, vol: 0.2, highpass: 2000, filterEnv: { from: 3000, to: 9000, decay: 0.5 * s }, send: 0.4 },
      ];
      case 'buff': return [
        { type: 'sweep', wave: 'sawtooth', from: S.notes[0], to: S.notes[2], dur: 0.25, vol: 0.06, send: 0.3 },
        ...chime(S.mat, [S.notes[1], S.notes[3]], 0.2, 0.08, 0.6, 0.11),
        whoosh(600, 5000, 0.3, 0.2, { pan: -0.2, send: 0.3 }), sparkle(0.2, 0.3, 0.12, 1), ...bloom(0.2), drone(0, 0.4, 0.04),
      ];
      case 'teleport': return [
        { type: 'riser', dur: 0.35 * s, from: 400, to: 8000, q: 2, vol: 0.18, send: 0.4 },
        { type: 'sweep', wave: 'sine', from: S.notes[0], to: S.notes[3], dur: 0.3 * s, vol: 0.08, pan: -0.3, send: 0.35 },
        transient(2500, 0.02, 0.4, { at: 0.35 * s }), { type: 'thump', from: 'A2', to: 'A1', decay: 0.15, vol: 0.3, at: 0.35 * s },
        { type: 'downlifter', at: 0.36 * s, dur: 0.4 * s, from: 7000, to: 300, q: 2, vol: 0.12, send: 0.4 },
        sparkle(0.35 * s, 0.4, 0.14, 1), air(0.1, 0.2, { at: 0.35 * s }), lowBody(0.3, { at: 0.35 * s }), ...(P ? [duck(4, 0.15, 0.5)] : []),
      ];
      case 'summon': return [
        sub('A0', 'E0', 1 * s, 0.14), { type: 'thump', from: 'D2', to: 'A1', decay: 0.5 * s, vol: 0.4 }, transient(1500, 0.03, 0.3),
        { type: 'riser', dur: 0.8 * s, from: 200, to: 3000, q: 1.5, vol: 0.25, send: 0.5 },
        drone(0, 1.2, 0.08, S.notes[0]), plate(S.notes[3], 1.2 * s, 0.06, { at: 0.6 * s, send: 0.5 }),
        sparkle(0.6 * s, 0.6, 0.14, 1), tail(1.2 * s, 3000, 120, 0.14, { at: 0.1, lowpass: 2000, send: 0.6 }), duck(4 + 2 * P, 0.4, 0.8),
      ];
      default: return [
        // a curse: two tones a tritone apart sinking, a low drone, dust falling
        { type: 'tone', note: S.notes[0], to: S.notes[3], dur: 0.6 * s, wave: 'sawtooth', lowpass: 1800, vol: 0.05, attack: 0.03, release: 0.3, send: 0.45 },
        { type: 'tone', note: 'G#3', to: 'D3', dur: 0.6 * s, wave: 'sawtooth', lowpass: 1500, vol: 0.04, attack: 0.03, release: 0.3, pan: 0.25, send: 0.45 },
        drone(0, 0.8, 0.06, 'A1'), { type: 'thump', from: 'E2', to: 'A1', decay: 0.3, vol: 0.3 }, transient(1800, 0.015, 0.25), lowBody(0.3), air(0.12, 0.3),
        grit(Math.round(30 * s), 0.6 * s, 300, 3000, 0.14, seed(1), { at: 0.1, pan: -0.3, send: 0.45 }), grit(Math.round(20 * s), 0.5 * s, 3000, 9000, 0.14, seed(2), { at: 0.05, pan: 0.3, send: 0.45 }), ...(P ? [duck(3, 0.2, 0.6)] : []),
      ];
    }
  },
};

export const bow = {
  label: 'a bow drawn and loosed, its arrow passing and striking, by the bow',
  dials: { act: ['draw', 'release', 'flyby', 'hit-wood', 'hit-target', 'hit-stone'], kind: ['longbow', 'crossbow'] },
  defaults: { act: 'release', kind: 'longbow' },
  ordered: [],
  build(d, seed) {
    const X = d.kind === 'crossbow';
    switch (d.act) {
      case 'draw': return X ? [
        // a crossbow cocked: a crank's ratchet, then the latch
        ...[0, 0.07, 0.14, 0.21, 0.28].flatMap((t, i) => [transient(3500, 0.006, 0.18, { at: t }), ringOf('metal', 'C6', 0.04, 0.04, { at: t })]),
        creak(['A2', 'C3', 'B2'], 0.3, 18, 0.06, seed(1)), transient(2500, 0.012, 0.3, { at: 0.36 }), { type: 'thump', from: 'D3', to: 'A2', decay: 0.04, vol: 0.18, at: 0.36 },
        grit(8, 0.3, 1000, 5000, 0.08, seed(2), { pan: 0.25 }),
      ] : [
        creak(['G2', 'A2', 'C3', 'B2'], 0.55, 14, 0.07, seed(1)),
        { type: 'tone', note: 'E3', to: 'A3', dur: 0.55, wave: 'triangle', vol: 0.03, attack: 0.2, release: 0.05, send: 0.2 },
        grit(16, 0.5, 800, 4000, 0.1, seed(2), { pan: -0.25 }), grit(10, 0.5, 2000, 7000, 0.06, seed(3), { pan: 0.25 }), { type: 'thump', from: 'C3', to: 'G2', decay: 0.04, vol: 0.1 },
      ];
      case 'release': {
        const twang = { type: 'thump', from: X ? 'A2' : 'E3', to: X ? 'E2' : 'B2', decay: 0.1, vol: 0.4 };
        return [
          transient(X ? 3000 : 2200, 0.01, 0.35), twang, harmonicsOf(twang, 0.1, 400),
          { type: 'tone', note: X ? 'A2' : 'E3', dur: 0.25, wave: 'sawtooth', lowpass: 1400, vol: 0.06, attack: 0.002, release: 0.15, tremolo: { rate: 18, depth: 0.6 }, send: 0.25 },
          whoosh(1500, 6000, 0.2, 0.18, { at: 0.01, pan: 0.25, send: 0.2 }), grit(6, 0.05, 1500, 6000, 0.1, seed(1), { pan: -0.2 }),
          ...(X ? [transient(3800, 0.008, 0.25), ringOf('metal', 'E6', 0.06, 0.05)] : []),
        ];
      }
      case 'flyby': return [whoosh(2000, 8000, 0.15, 0.25, { pan: -0.35, send: 0.2 }), { type: 'burst', at: 0.04, decay: 0.1, vol: 0.12, bandpass: 2500, q: 2, pan: 0.35 }, grit(8, 0.12, 3000, 10000, 0.08, seed(1), { pan: 0.3 }), { type: 'sweep', wave: 'sine', from: 'D7', to: 'A6', dur: 0.1, vol: 0.02 }];
      case 'hit-wood': return [transient(2500, 0.01, 0.35), ...knock('A2', 'E2', 0.12, 0.4, 1800), ringOf('wood', 'D4', 0.12, 0.12, { send: 0.2 }),
        // the shaft quivering in the wood
        { type: 'tone', note: 'E2', dur: 0.35, wave: 'triangle', vol: 0.06, attack: 0.002, release: 0.2, tremolo: { rate: 22, depth: 0.8 }, pan: 0.2, send: 0.2 },
        grit(10, 0.06, 800, 4000, 0.12, seed(1), { pan: -0.25 })];
      case 'hit-target': return [transient(1800, 0.01, 0.3), ...knock('E2', 'B1', 0.15, 0.45, 1200), grit(18, 0.08, 300, 2500, 0.18, seed(1), { pan: 0.25, send: 0.2 }), sub('C1', 'A0', 0.12, 0.06), { type: 'tone', note: 'E2', dur: 0.25, wave: 'triangle', vol: 0.04, release: 0.15, tremolo: { rate: 22, depth: 0.8 } }];
      default: return [transient(4000, 0.008, 0.35), ringOf('metal', 'A5', 0.06, 0.06), { type: 'thump', from: 'D3', to: 'A2', decay: 0.04, vol: 0.2 },
        grit(16, 0.12, 1500, 8000, 0.16, seed(1), { pan: -0.3 }), ...[0.08, 0.15].map((t, i) => transient(3000, 0.008, 0.1, { at: t, pan: i ? 0.3 : -0.1 })), grit(10, 0.2, 400, 3000, 0.1, seed(2), { at: 0.05, pan: 0.3 })];
    }
  },
};

export const interact = {
  label: 'the things a world is worked by: a chest, a lever, a plate, a key, a gate, coins, a potion, a creak',
  dials: { act: ['chest-open', 'chest-close', 'lever', 'pressure-plate', 'key-unlock', 'gate', 'coins', 'potion', 'creak'], material: ['wood', 'metal', 'stone'] },
  defaults: { act: 'chest-open', material: 'wood' },
  ordered: [],
  build(d, seed) {
    const M = d.material, mat = M === 'stone' ? 'wood' : M;
    const clack = (at, vol) => [transient(M === 'metal' ? 3800 : 2600, 0.01, vol, { at }), ringOf('metal', 'A5', 0.05, 0.05, { at })];
    switch (d.act) {
      case 'chest-open': return [...clack(0, 0.28), creak(M === 'metal' ? ['C3', 'D#3', 'D3'] : ['G2', 'A2', 'F#2'], 0.5, M === 'metal' ? 20 : 12, 0.07, seed(1), { at: 0.05 }),
        ...knock('G2', 'D2', 0.1, 0.3, 1500, { at: 0.55 }), ringOf(mat, M === 'metal' ? 'E5' : 'C4', 0.1, 0.08, { at: 0.55 }), grit(10, 0.3, 600, 4000, 0.1, seed(2), { at: 0.1, pan: 0.25 })];
      case 'chest-close': return [creak(M === 'metal' ? ['D3', 'C3'] : ['A2', 'G2'], 0.2, 14, 0.05, seed(1)), ...knock('E2', 'A1', 0.15, 0.5, 1500, { at: 0.2 }), ringOf(mat, M === 'metal' ? 'D5' : 'A3', 0.12, 0.1, { at: 0.2, send: 0.3 }), ...clack(0.32, 0.25), grit(8, 0.06, 500, 3000, 0.12, seed(2), { at: 0.2, pan: -0.2 }), sub('C1', 'A0', 0.12, 0.05, { at: 0.2 })];
      case 'lever': return [...[0, 0.06, 0.12].flatMap((t) => clack(t, 0.18)), creak(['E3', 'D3'], 0.15, 25, 0.05, seed(1)), ...knock('D2', 'A1', 0.15, 0.45, 1500, { at: 0.2 }), plate('A3', 0.25, 0.05, { at: 0.2, send: 0.3 }), transient(2500, 0.015, 0.25, { at: 0.2 })];
      case 'pressure-plate': return [grit(20, 0.15, 200, 2500, 0.16, seed(1), { pan: -0.2 }), ...knock('C2', 'G1', 0.2, 0.45, 900, { at: 0.08 }), transient(3000, 0.01, 0.2, { at: 0.12 }), ringOf('metal', 'E5', 0.06, 0.05, { at: 0.12 }), sub('C1', 'A0', 0.2, 0.08, { at: 0.08 })];
      case 'key-unlock': return [grit(8, 0.1, 2000, 8000, 0.1, seed(1), { pan: 0.2 }), ...clack(0.12, 0.25), ...clack(0.22, 0.35), { type: 'thump', from: 'A3', to: 'E3', decay: 0.04, vol: 0.15, at: 0.22 }, ringOf('metal', 'E6', 0.08, 0.04, { at: 0.22 }), ...knock('E3', 'B2', 0.05, 0.2, 2500, { at: 0.32 })];
      case 'gate': return [
        // a portcullis: its chain rattling up, the frame groaning, a clank where it stops
        ...[0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45].map((t, i) => ringOf('metal', ['A5', 'E5', 'G5', 'D5'][i % 4], 0.06, 0.05, { at: t, pan: i % 2 ? 0.25 : -0.25 })),
        grit(40, 0.5, 2000, 8000, 0.12, seed(1), { pan: 0.3, send: 0.3 }), creak(['C2', 'D2', 'C#2'], 0.5, 9, 0.07, seed(2)),
        ...knock('C2', 'F1', 0.25, 0.5, 1200, { at: 0.55 }), plate('F3', 0.6, 0.07, { at: 0.55, send: 0.5 }), sub('A0', 'E0', 0.3, 0.1, { at: 0.55 }), duck(3, 0.1, 0.4),
      ];
      case 'coins': return [
        ...[['E6', 0], ['B6', 0.04], ['G6', 0.07], ['C7', 0.11], ['A6', 0.16], ['E7', 0.22], ['D7', 0.3]].map(([n, t], i) => ringOf('metal', n, 0.18, 0.08 - 0.006 * i, { at: t, pan: ((i * 3) % 5) / 5 - 0.4, send: 0.25 })),
        ...[0, 0.07, 0.16].map((t) => transient(5000, 0.005, 0.15, { at: t })), grit(14, 0.35, 3000, 10000, 0.1, seed(1), { pan: 0.3 }), { type: 'thump', from: 'D3', to: 'A2', decay: 0.04, vol: 0.12 },
      ];
      case 'potion': return [
        // uncorked, drunk in three gulps, the glass set down
        transient(2500, 0.008, 0.2), { type: 'sweep', wave: 'sine', from: 'E5', to: 'A4', dur: 0.04, vol: 0.06 },
        ...[0.15, 0.4, 0.65].flatMap((t) => [{ type: 'burst', decay: 0.08, vol: 0.25, lowpass: 900, at: t }, { type: 'thump', from: 'G2', to: 'D2', decay: 0.07, vol: 0.18, at: t }, { type: 'sweep', wave: 'sine', from: 'A3', to: 'E4', dur: 0.06, vol: 0.05, at: t + 0.02 }]),
        ringOf('glass', 'E6', 0.25, 0.08, { at: 0.95, send: 0.3 }), transient(4000, 0.006, 0.15, { at: 0.95 }), grit(10, 0.6, 600, 3000, 0.06, seed(1), { at: 0.1, pan: 0.2 }),
      ];
      default: return [creak(M === 'metal' ? ['C3', 'D3', 'C#3', 'E3'] : ['G2', 'A2', 'F#2', 'B2'], 0.9, M === 'metal' ? 22 : 11, 0.09, seed(1)),
        creak(M === 'metal' ? ['C4', 'D#4'] : ['G3', 'A3'], 0.7, 16, 0.03, seed(2), { at: 0.15, pan: 0.3 }), grit(16, 0.8, 500, 3500, 0.08, seed(3), { pan: -0.3 }),
        ...knock('E2', 'B1', 0.08, 0.2, 1500), transient(2500, 0.008, 0.12)];
    }
  },
};
