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
