/**
 * sfx-shelf/layers — the realistic register's layers, as words: each returns one beats-sfx gesture (the SFX mixer's
 * `chain`, `pan` and `send` where it takes them). Pure. The layered set and every family speak them.
 *
 *   transient   a few milliseconds of bright noise, centred and dry: where the ear hears a sound start
 *   sub         a clean low thump, centred, never driven and never sent: the weight
 *   harmonics   a copy of a body gesture driven hard, then highpassed, so only the overtones the drive grows are
 *               added. Driving the body itself saturates its sub: the sound grows louder and darker, and fills one band.
 *   grit        a grain train in a band, usually panned: texture and width
 *   tail        noise darkening as it fades (`filterEnv`), usually sent: where the room answers
 *   plate       a struck plate's modes excited by noise: metal that rings like metal
 *   duck        no sound: the score dips under a big hit
 */

export const drive = (amount, tone) => ({ chain: [{ type: 'drive', amount, ...(tone ? { tone } : {}) }] });
export const transient = (hp, decay, vol, extra = {}) => ({ type: 'burst', decay, vol, highpass: hp, send: 0, ...extra });
export const sub = (from, to, decay, vol, extra = {}) => ({ type: 'thump', from, to, decay, vol, send: 0, ...extra });
export const grit = (grains, over, lo, hi, vol, seed, extra = {}) => ({ type: 'grain', grains, over, band: { lo, hi }, vol, spread: 0.5, seed, ...extra });
export const tail = (decay, from, to, vol, extra = {}) => ({ type: 'burst', decay, vol, filterEnv: { from, to, decay }, ...extra });
export const plate = (note, decay, vol, extra = {}) => ({ type: 'ring', material: 'plate', note, decay, vol, excite: 'noise', q: 24, ...extra });
export const duck = (depth, hold, release) => ({ type: 'duck', depth, hold, release });
export const harmonicsOf = (g, vol, cut = 300) => ({ ...g, vol, send: 0.15, chain: [{ type: 'drive', amount: 0.75, tone: null }, { type: 'filter', mode: 'highpass', freq: cut, q: 0.7 }] });

/** Deep-freeze a set or a cue (the shelf's data never changes under a caller). */
export const freeze = (v) => {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};

// ── more words the game-type families share ──
/** air moved fast: noise through a lowpass opening `from` → `to` Hz over `decay` (a swing, a throw, a pass) */
export const whoosh = (from, to, decay, vol, extra = {}) => ({ type: 'burst', decay, vol, highpass: 300, filterEnv: { from, to, decay }, ...extra });
/** a struck note of a material (glass, metal, wood, bell, plate, cymbal) */
export const ringOf = (material, note, decay, vol, extra = {}) => ({ type: 'ring', material, note, decay, vol, ...extra });
/** a run of struck notes `step` seconds apart from `at`: an arpeggio of bells, a scatter of coins */
export const chime = (material, notes, at, step, decay, vol, extra = {}) => notes.map((note, i) => ringOf(material, note, decay, vol * (1 - 0.08 * i), { at: at + step * i, pan: notes.length > 1 ? (i / (notes.length - 1)) * 0.6 - 0.3 : 0, send: 0.35, ...extra }));
/** a knock: a short body thump with a lowpassed slap over it */
export const knock = (from, to, decay, vol, lp, extra = {}) => [{ type: 'thump', from, to, decay, vol, ...extra }, { type: 'burst', decay: decay * 0.6, vol: vol * 0.8, lowpass: lp, send: 0.15, ...extra }];
/** stick-slip: a jittered sawtooth flutter, slow: a creak, a strained string */
export const creak = (notes, hold, rate, vol, seed, extra = {}) => ({ type: 'flutter', wave: 'sawtooth', rateHz: rate, hold, jitter: 0.85, tiers: [{ at: 0, table: notes }], vol, seed, send: 0.25, ...extra });
/** the low band (120–500 Hz) a chime or a bell lacks: a short lowpassed thud, its body as the ear hears it */
export const lowBody = (vol, extra = {}) => ({ type: 'burst', decay: 0.12, vol, lowpass: 500, send: 0.2, ...extra });
/** the air above 5 kHz a tone lacks: a breath of highpassed noise */
export const air = (vol, decay = 0.15, extra = {}) => ({ type: 'burst', decay, vol, highpass: 5000, send: 0.3, ...extra });
