/**
 * families/play — the sounds of a platformer, a puzzle and a table: a run's (`platform`: a coin, a gem, a power-up, a
 * bounce pad, a stomp, a crumbling ledge, a grab, a hurt), a puzzle's pieces (`puzzle`: swapped, matched by the
 * combo, cleared, dropped, pushed, locked in, by what they are made of), a table's (`tabletop`: a piece placed or
 * slid, cards flipped, shuffled and dealt, chips stacked, a coin flipped), and dice (`dice`: how many, on what).
 * Game effects, heard in the world: a menu's sounds are the interface's. Pure.
 */
import { transient, sub, grit, tail, duck, harmonicsOf, whoosh, ringOf, chime, knock, lowBody, air } from '../layers.js';

export const platform = {
  label: 'a run\'s sounds: a coin, a gem, a power-up, a bounce pad, a stomp, a crumbling ledge, a grab, a hurt',
  dials: { act: ['coin', 'gem', 'power-up', 'bounce-pad', 'stomp', 'crumble', 'ledge-grab', 'hurt'] },
  defaults: { act: 'coin' },
  ordered: [],
  build(d, seed) {
    switch (d.act) {
      case 'coin': return [lowBody(0.3), air(0.16, 0.12, { at: 0.05 }), transient(5000, 0.005, 0.2), ringOf('metal', 'B6', 0.12, 0.06, { send: 0.25 }), ringOf('metal', 'E7', 0.15, 0.045, { at: 0.06, send: 0.3 }), ringOf('glass', 'E7', 0.25, 0.04, { at: 0.06 }), grit(8, 0.12, 5000, 12000, 0.08, seed(1), { at: 0.05, pan: 0.3 }), { type: 'thump', from: 'E3', to: 'B2', decay: 0.04, vol: 0.2 }];
      case 'gem': return [transient(4500, 0.006, 0.2), ...chime('glass', ['E6', 'G#6', 'B6', 'E7'], 0, 0.045, 0.4, 0.09), grit(16, 0.3, 4000, 12000, 0.1, seed(1), { at: 0.05, pan: -0.3, send: 0.4 }), { type: 'thump', from: 'E4', to: 'B3', decay: 0.04, vol: 0.1 }];
      case 'power-up': return [
        { type: 'sweep', wave: 'triangle', from: 'C4', to: 'C6', dur: 0.4, vol: 0.1, send: 0.3 },
        ...chime('bell', ['C5', 'E5', 'G5', 'C6', 'E6'], 0.05, 0.07, 0.6, 0.09),
        { type: 'flutter', wave: 'sine', rateHz: 24, hold: 0.4, tiers: [{ at: 0, table: ['C5', 'G5'] }, { at: 0.2, table: ['E5', 'C6'] }], vol: 0.05, pan: -0.25, send: 0.3 },
        grit(30, 0.5, 4000, 12000, 0.1, seed(1), { at: 0.1, pan: 0.3, send: 0.4 }), sub('C2', 'C1', 0.3, 0.07), transient(3000, 0.01, 0.15),
      ];
      case 'bounce-pad': return [
        transient(2500, 0.01, 0.3), { type: 'thump', from: 'A2', to: 'E2', decay: 0.08, vol: 0.35 },
        // the spring: a pitch flung upward, a coil wobbling as it settles
        { type: 'sweep', wave: 'sine', from: 'A3', to: 'A5', dur: 0.18, vol: 0.12, send: 0.2 },
        { type: 'tone', note: 'E4', dur: 0.4, wave: 'triangle', vol: 0.06, attack: 0.005, release: 0.3, vibrato: { rate: 14, depth: 120 }, at: 0.03, pan: 0.2, send: 0.25 },
        ringOf('metal', 'A4', 0.25, 0.05, { pan: -0.2 }), whoosh(800, 5000, 0.2, 0.12, { at: 0.04, send: 0.2 }),
      ];
      case 'stomp': {
        const body = { type: 'thump', from: 'G2', to: 'C2', decay: 0.12, vol: 0.5 };
        return [{ type: 'burst', decay: 0.06, vol: 0.4, lowpass: 1800, send: 0.15 }, body, harmonicsOf(body, 0.12, 300), transient(2200, 0.01, 0.25), grit(14, 0.1, 400, 3500, 0.16, seed(1), { pan: 0.3, send: 0.2 }), { type: 'sweep', wave: 'sine', from: 'C4', to: 'C3', dur: 0.12, vol: 0.06, at: 0.02 }, sub('C1', 'A0', 0.15, 0.08)];
      }
      case 'crumble': return [transient(2000, 0.015, 0.3), ...knock('E2', 'A1', 0.15, 0.35, 1500), grit(40, 0.6, 300, 4000, 0.18, seed(1), { at: 0.03, pan: -0.35, send: 0.4 }), grit(25, 0.7, 600, 5000, 0.13, seed(2), { at: 0.08, pan: 0.35, send: 0.4 }), tail(0.6, 2500, 200, 0.12, { at: 0.05, send: 0.5 })];
      case 'ledge-grab': return [grit(12, 0.08, 500, 3500, 0.14, seed(1), { pan: -0.2 }), ...knock('C3', 'G2', 0.06, 0.3, 2000, { at: 0.02 }), transient(2500, 0.008, 0.15, { at: 0.02 }), whoosh(400, 2000, 0.12, 0.1, { pan: 0.2 }), grit(6, 0.05, 2000, 7000, 0.08, seed(2), { at: 0.05, pan: 0.25 })];
      default: return [
        // hurt: a blow taken, a low tone dropping under it
        { type: 'burst', decay: 0.08, vol: 0.4, lowpass: 2500, send: 0.15 }, ...knock('E2', 'A1', 0.15, 0.4, 1800),
        { type: 'sweep', wave: 'sawtooth', from: 'A3', to: 'A2', dur: 0.25, vol: 0.06, send: 0.25 }, transient(2500, 0.01, 0.2), grit(10, 0.1, 600, 4000, 0.12, seed(1), { pan: 0.3 }), duck(2, 0.06, 0.2),
      ];
    }
  },
};

const COMBO = ['1', '2', '3', '4'];
const MATERIAL = { crystal: 'glass', wood: 'wood', stone: 'wood', metal: 'metal' };
export const puzzle = {
  label: 'a puzzle\'s pieces: swapped, matched (by the combo), cleared, dropped, pushed, locked in, by their material',
  dials: { act: ['match', 'swap', 'clear', 'drop', 'push', 'lock'], material: Object.keys(MATERIAL), combo: COMBO },
  defaults: { act: 'match', material: 'crystal', combo: '1' },
  ordered: [{ dial: 'combo', rises: ['centroidHz'] }],
  build(d, seed) {
    const mat = MATERIAL[d.material], c = COMBO.indexOf(d.combo), stone = d.material === 'stone';
    const up = (n, k) => ['C', 'D', 'E', 'G', 'A'][(n + k) % 5] + (5 + Math.floor((n + k) / 5));
    switch (d.act) {
      case 'match': return [
        // the combo climbs: each step up the scale and brighter, the chord fuller
        transient(4000, 0.006, 0.2), ...chime(mat, [0, 2, 4].slice(0, 2 + Math.min(c, 1)).map((n) => up(n, 2 * c)), 0, 0.04, 0.25, 0.07),
        grit(16 + 8 * c, 0.25, 3000 + 1000 * c, 12000, 0.18, seed(1), { at: 0.03, pan: 0.3, send: 0.35 }),
        ...knock('C3', 'G2', 0.08, 0.28, 1500), lowBody(0.25), ...(c >= 2 ? [{ type: 'sweep', wave: 'sine', from: up(0, 2 * c), to: up(4, 2 * c + 2), dur: 0.15, vol: 0.05, send: 0.3 }] : []),
      ];
      case 'swap': return [whoosh(1200, 5000, 0.1, 0.15, { pan: -0.3 }), whoosh(1200, 5000, 0.1, 0.15, { at: 0.05, pan: 0.3 }), transient(3000, 0.006, 0.15, { at: 0.1 }), ringOf(mat, 'G5', 0.08, 0.06, { at: 0.1 }), grit(6, 0.08, 2000, 8000, 0.08, seed(1)), { type: 'thump', from: 'D4', to: 'A3', decay: 0.03, vol: 0.1, at: 0.1 }];
      case 'clear': return [{ type: 'sweep', wave: 'triangle', from: 'C5', to: 'C7', dur: 0.3, vol: 0.08, send: 0.35 }, whoosh(1000, 9000, 0.35, 0.22, { send: 0.3 }), ...chime(mat, ['C6', 'G6', 'C7'], 0.1, 0.05, 0.3, 0.06), grit(40, 0.4, 3000, 12000, 0.2, seed(1), { pan: -0.3, send: 0.4 }), ...knock('A2', 'E2', 0.12, 0.42, 1800), sub('C2', 'C1', 0.2, 0.08), lowBody(0.25)];
      case 'drop': return [...knock(stone ? 'A2' : 'D3', stone ? 'E2' : 'A2', 0.08, 0.35, stone ? 1500 : 2500), transient(stone ? 2000 : 3000, 0.008, 0.2), ringOf(mat, stone ? 'C4' : 'A5', 0.08, 0.06), grit(6, 0.04, 800, 5000, 0.1, seed(1), { pan: 0.25 })];
      case 'push': return [
        // a block shoved across stone: a long grinding scrape, a low rumble under it, a thud where it stops
        grit(80, 0.6, 300, 3500, 0.16, seed(1), { decay: [0.004, 0.015], pan: -0.2, send: 0.3 }), grit(50, 0.6, 1500, 6000, 0.08, seed(2), { pan: 0.2 }),
        { type: 'burst', decay: 0.6, vol: 0.12, lowpass: 400, send: 0.3 }, ...knock('C2', 'G1', 0.15, 0.4, 1200, { at: 0.6 }), sub('A0', 'E0', 0.2, 0.06, { at: 0.6 }), transient(1800, 0.012, 0.15, { at: 0.6 }),
      ];
      default: return [transient(3500, 0.008, 0.3), ...knock('D3', 'A2', 0.05, 0.32, 2000), ringOf(mat, 'E5', 0.12, 0.08, { send: 0.2 }), ringOf('metal', 'A6', 0.05, 0.04, { at: 0.01 }), grit(8, 0.03, 3000, 10000, 0.16, seed(1))];
    }
  },
};

const PIECE = { wood: ['wood', 'C4', 2200], plastic: ['wood', 'A4', 3500], stone: ['wood', 'E4', 1800], glass: ['glass', 'E6', 5000] };
export const tabletop = {
  label: 'a table\'s sounds: a piece placed or slid, cards flipped, shuffled and dealt, chips stacked, a coin flipped',
  dials: { act: ['piece-place', 'piece-slide', 'card-flip', 'card-shuffle', 'card-deal', 'chip-stack', 'coin-flip'], material: Object.keys(PIECE) },
  defaults: { act: 'piece-place', material: 'wood' },
  ordered: [],
  build(d, seed) {
    const [mat, note, lp] = PIECE[d.material];
    const flick = (at, vol, i) => [{ type: 'burst', decay: 0.02, vol, bandpass: 3500, q: 1, at }, grit(6, 0.03, 2000, 9000, vol * 0.6, seed(i), { at, pan: (i % 3) * 0.2 - 0.2 })];
    switch (d.act) {
      case 'piece-place': return [...(d.material === 'glass' ? [lowBody(0.2)] : []), ...knock(d.material === 'glass' ? 'E3' : 'A3', 'E3', 0.04, 0.3, lp), transient(lp * 1.5, 0.006, 0.18), ringOf(mat, note, 0.1, d.material === 'glass' ? 0.06 : 0.1, { send: 0.2 }), grit(4, 0.02, 1500, 6000, 0.08, seed(1)), { type: 'thump', from: 'A2', to: 'E2', decay: 0.05, vol: d.material === 'glass' ? 0.2 : 0.12 }];
      case 'piece-slide': return [grit(30, 0.25, 800, 5000, 0.12, seed(1), { decay: [0.003, 0.01], pan: -0.2 }), { type: 'burst', decay: 0.25, vol: 0.08, bandpass: 1500, q: 1 }, ...knock('A3', 'E3', 0.04, 0.25, lp, { at: 0.25 }), ringOf(mat, note, 0.08, 0.06, { at: 0.25 })];
      case 'card-flip': return [...flick(0, 0.25, 1), whoosh(1500, 6000, 0.06, 0.08, { pan: 0.2 }), { type: 'burst', at: 0.05, decay: 0.015, vol: 0.2, lowpass: 3000 }, { type: 'thump', from: 'A3', to: 'E3', decay: 0.02, vol: 0.08, at: 0.05 }];
      case 'card-shuffle': return [...Array.from({ length: 18 }, (_, i) => flick(i * 0.025, 0.12 + 0.04 * Math.sin(i), i + 1)).flat(), { type: 'burst', decay: 0.5, vol: 0.06, bandpass: 2500, q: 0.8 }, ...knock('A3', 'E3', 0.03, 0.18, 2500, { at: 0.5 })];
      case 'card-deal': return [whoosh(2000, 7000, 0.1, 0.12, { pan: -0.3 }), ...flick(0.06, 0.2, 1), { type: 'burst', at: 0.1, decay: 0.02, vol: 0.18, lowpass: 2500 }, { type: 'thump', from: 'A3', to: 'E3', decay: 0.02, vol: 0.08, at: 0.1 }, transient(4000, 0.004, 0.08)];
      case 'chip-stack': return [...[0, 0.05, 0.09, 0.12].flatMap((t, i) => [transient(4500, 0.004, 0.16, { at: t }), ringOf('glass', ['G6', 'E6', 'A6', 'D7'][i], 0.06, 0.06, { at: t, pan: i % 2 ? 0.2 : -0.2 }), { type: 'thump', from: 'E4', to: 'B3', decay: 0.02, vol: 0.06, at: t }]), grit(6, 0.15, 3000, 10000, 0.06, seed(1))];
      default: return [transient(5000, 0.004, 0.2), ringOf('metal', 'E7', 0.6, 0.08, { send: 0.3 }), ringOf('metal', 'B6', 0.5, 0.05, { pan: 0.2 }), whoosh(2000, 8000, 0.3, 0.05, { at: 0.02 }), ...knock('A3', 'E3', 0.03, 0.2, 4000, { at: 0.45 }), ringOf('metal', 'E7', 0.3, 0.06, { at: 0.45 }), grit(4, 0.05, 3000, 9000, 0.06, seed(1), { at: 0.45 })];
    }
  },
};

const COUNT = ['one', 'two', 'handful'];
const SURFACE = { wood: ['wood', 2200, 'C4'], felt: ['wood', 900, 'A3'], stone: ['wood', 3000, 'E4'] };
export const dice = {
  label: 'dice thrown, by how many and on what',
  dials: { count: COUNT, surface: Object.keys(SURFACE) },
  defaults: { count: 'two', surface: 'wood' },
  ordered: [{ dial: 'count', rises: ['ms'] }],
  build(d, seed) {
    const n = [1, 2, 5][COUNT.indexOf(d.count)], [mat, lp, note] = SURFACE[d.surface];
    const out = [grit(6 * n, 0.1, 1500, 7000, 0.06, seed(1), { pan: -0.2 })];
    // each die: a throw's first strike, then bounces closing up and softening
    for (let i = 0; i < n; i++) {
      const t0 = 0.04 * i, pan = n > 1 ? (i / (n - 1)) * 0.6 - 0.3 : 0;
      [0, 0.12, 0.2, 0.25, 0.28].forEach((t, j) => {
        out.push(transient(lp * 1.6, 0.005, 0.2 * (1 - 0.18 * j), { at: t0 + t * (1 + 0.1 * i), pan }));
        if (j < 3) out.push({ type: 'thump', from: 'A3', to: 'E3', decay: 0.025, vol: 0.12 * (1 - 0.25 * j), at: t0 + t * (1 + 0.1 * i), pan });
      });
      out.push(ringOf(mat, note, 0.06, 0.05, { at: t0, pan }));
    }
    out.push({ type: 'burst', decay: 0.04, vol: 0.12, lowpass: lp, send: 0.2 }, grit(10 * n, 0.3 + 0.03 * n, 600, 4000, 0.06, seed(2), { at: 0.1, pan: 0.25 }));
    return out;
  },
};
