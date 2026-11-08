/**
 * families/blades — a katana: drawn, sheathed, swung, jostling at the hip. Pure.
 *
 * The swing is a stylized slash, a game's "shhk-shing", not a recording of air: it is short, it travels across the
 * stereo field, and its brightness is noise and struck steel, never a held tone (a held tone is a whistle). Its layers:
 *   approach  two whooshes opening upward, the first left, the second right: the blade crossing in front of you
 *   cut       a bright noise slash whose lowpass falls fast from the top of the band: the "shhk"
 *   shing     the edge ringing: a struck high metal note and a noise-excited plate, short, sent to the space
 *   spray     a dense spray of high grit across the cut: the edge's sparkle
 *   push      the air the cut moves: a soft low thump and the low band, so it has weight under its brightness
 *   tail      the air settling, sent
 * `weight` runs light (a quick flick) to heavy (a committed two-handed cut: longer, lower, a deeper push).
 */
import { transient, sub, grit, plate, whoosh, ringOf, knock, lowBody, air } from '../layers.js';

const WEIGHT = ['light', 'heavy'];

function slash(w, seed) {
  const s = 1 + 0.45 * w;   // a heavy cut takes longer
  const t = (x) => Math.round(x * s * 1000) / 1000;
  return [
    whoosh(500, 4000 - 800 * w, t(0.08), 0.18, { pan: -0.4, send: 0.15 }),
    whoosh(700, 6000 - 1000 * w, t(0.07), 0.16, { at: t(0.03), pan: 0.4, send: 0.15 }),
    { type: 'burst', at: t(0.06), decay: t(0.11), vol: 0.42 + 0.06 * w, highpass: 2200 - 600 * w, filterEnv: { from: 14000, to: 2200, decay: t(0.11) }, pan: 0.15, send: 0.2 },
    transient(5000 - 1000 * w, 0.006, 0.28, { at: t(0.06) }),
    ringOf('metal', w ? 'B6' : 'E7', 0.22 + 0.1 * w, 0.07, { at: t(0.065), pan: 0.25, send: 0.4 }),
    plate(w ? 'F#6' : 'B6', 0.18 + 0.08 * w, 0.04, { at: t(0.07), pan: -0.2, send: 0.4 }),
    grit(Math.round(26 * s), t(0.08), 4500, 12000, 0.16, seed(1), { at: t(0.055), decay: [0.002, 0.006], pan: 0.35, send: 0.25 }),
    ...knock(w ? 'E2' : 'A2', w ? 'A1' : 'E2', t(0.09), 0.2 + 0.12 * w, 900, { at: t(0.07) }),
    lowBody(0.2 + 0.08 * w, { at: t(0.06) }),
    ...(w ? [sub('C1', 'A0', 0.16, 0.06, { at: t(0.07) })] : []),
    air(0.08, t(0.2), { at: t(0.12), pan: 0.3 }),
  ];
}

export const katana = {
  label: 'a katana: drawn, sheathed, swung (a stylized slash), jostling at the hip',
  dials: { act: ['swing', 'draw', 'sheathe', 'jostle'], weight: WEIGHT },
  defaults: { act: 'swing', weight: 'light' },
  ordered: [{ dial: 'weight', rises: ['ms'], falls: ['centroidHz'] }],
  build(d, seed) {
    const w = WEIGHT.indexOf(d.weight);
    switch (d.act) {
      case 'draw': return [
        // steel leaving the saya: a quick scrape brightening as it runs, the mouth's click, the blade ringing free
        { type: 'burst', decay: 0.3, vol: 0.22, highpass: 2500, filterEnv: { from: 4000, to: 11000, decay: 0.3 }, pan: -0.2, send: 0.15 },
        grit(40, 0.28, 3000, 11000, 0.14, seed(1), { decay: [0.002, 0.006], pan: 0.2, send: 0.15 }),
        ...knock('D3', 'A2', 0.05, 0.22, 2000), transient(3500, 0.008, 0.2),
        transient(4500, 0.006, 0.3, { at: 0.3 }), ringOf('metal', 'E7', 0.45, 0.08, { at: 0.3, send: 0.45 }), plate('B6', 0.3, 0.04, { at: 0.3, pan: 0.25, send: 0.45 }),
        lowBody(0.18, { at: 0.3 }), air(0.08, 0.3, { at: 0.32 }),
      ];
      case 'sheathe': return [
        // steel sliding home, darkening as it goes in, the tsuba meeting the saya's mouth
        { type: 'burst', decay: 0.28, vol: 0.2, highpass: 1800, filterEnv: { from: 9000, to: 2500, decay: 0.28 }, pan: 0.2, send: 0.15 },
        grit(30, 0.26, 2500, 9000, 0.12, seed(1), { decay: [0.002, 0.006], pan: -0.2, send: 0.15 }),
        transient(3800, 0.01, 0.32, { at: 0.28 }), ...knock('C3', 'G2', 0.06, 0.3, 2200, { at: 0.28 }), ringOf('metal', 'A6', 0.12, 0.06, { at: 0.28, send: 0.3 }), ringOf('wood', 'D4', 0.08, 0.08, { at: 0.285 }),
        lowBody(0.15, { at: 0.28 }),
      ];
      case 'jostle': return [
        // one step's worth at the hip: the saya knocking, the tsuba's faint clink, a little cloth
        ...knock('C3', 'G2', 0.05, 0.18, 1800), ringOf('wood', 'A3', 0.08, 0.08), transient(2200, 0.006, 0.08),
        ringOf('metal', 'B6', 0.1, 0.04, { at: 0.03, pan: 0.2 }), grit(6, 0.08, 700, 2500, 0.08, seed(1), { pan: -0.2 }), air(0.04, 0.06, { at: 0.03 }),
      ];
      default: return slash(w, seed);
    }
  },
};
