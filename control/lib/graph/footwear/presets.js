/**
 * FOOTWEAR PRESETS — the words, a spec each (index.js reads the spec). Body-agnostic: every place along a segment is a
 * SHARE of it (0 its start, the ankle for the foot and the knee for the shank; 1 its end), which each body's adapter
 * turns into its own stations.
 *
 *   upper    false: none, a SANDAL (the sole and the straps on the bare foot)
 *   height   'boot': a shaft up the shank, `shaft` its share from the ankle; 'shoe': from the `collar`, a share of the foot
 *   sole     its thickness (m); `welt` how far it stands out of the upper's footprint (m)
 *   straps   [{ on: 'foot' | 'shank', at (share), width? (m) }]; `buckle` one on each strap's outer side
 */
export const FOOTWEAR = Object.freeze({
  boots: Object.freeze({ height: 'boot', shaft: 0.3, sole: 0.009, welt: 0.003, straps: [{ on: 'foot', at: 0.625 }, { on: 'shank', at: 0.9 }], buckle: true }),
  shoes: Object.freeze({ height: 'shoe', collar: 0.15, sole: 0.007, welt: 0.002, straps: [{ on: 'foot', at: 0.625 }], buckle: true }),
  sandals: Object.freeze({ upper: false, sole: 0.01, welt: 0.004, straps: [{ on: 'foot', at: 0.675, width: 0.02 }, { on: 'foot', at: 0.1, width: 0.012 }], buckle: true }),
});
/** the colours of the groups footwear adds, for a palette that names none */
export const FOOTWEAR_TONES = Object.freeze({ Sole: '#2a2420', Strap: '#4b3324', Brass: '#a8843f' });
