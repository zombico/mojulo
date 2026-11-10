/**
 * THE PROP SHELF — small things a publication's plates are composed of, each a form in field terms (what a drawn
 * plate draws, book/drawn-plate.js) standing at the origin on the ground, in metres. A plate is not authored blind:
 * `stillLife(['alembic', 'candle', 'tome'])` stands up to four in a row, turned to the draughtsman, and returns the
 * plate spec with its station and light set for what it holds.
 *
 *   PROPS          { <word>: { reads, size: [width, height] (m), form(tint?) → { id, terms, tint, gloss? } } }
 *   stillLife(words, { tints?, light?, turn?, finish? }) → a plate spec; a word may be [word, tint]
 *
 * A new prop is a row. Pure and deterministic.
 */
const lathe = (base, height, profile, extra = {}) => ({
  op: 'add', ...extra,
  shape: { kind: 'lathe', axisFrom: base, axisTo: [base[0], base[1], base[2] + height], profile: profile.map(([t, radius]) => ({ t, radius })) },
});
const add = (shape, blend) => ({ op: 'add', ...(blend ? { blend } : {}), shape });
const cut = (shape, blend) => ({ op: 'subtract', ...(blend ? { blend } : {}), shape });

export const PROPS = Object.freeze({
  alembic: {
    reads: 'a glass still: a round belly, a long neck, a beak', size: [0.62, 0.58], tint: '#9fb3a0', gloss: true,
    terms: () => [
      lathe([0, 0, 0], 0.56, [[0, 0.07], [0.04, 0.13], [0.2, 0.185], [0.36, 0.17], [0.52, 0.09], [0.62, 0.045], [0.9, 0.04], [0.96, 0.055], [1, 0.05]]),
      { op: 'round', radius: 0.006 },
      add({ kind: 'sweep', radius: 0.022, path: [[0, 0, 0.5], [0.09, 0.02, 0.56], [0.2, 0.04, 0.54], [0.32, 0.07, 0.44], [0.42, 0.09, 0.3]] }, 0.03),
    ],
  },
  vial: {
    reads: 'a stoppered vial', size: [0.12, 0.2], tint: '#8fb0b8', gloss: true,
    terms: () => [
      lathe([0, 0, 0], 0.17, [[0, 0.03], [0.05, 0.05], [0.5, 0.055], [0.72, 0.022], [0.95, 0.02], [1, 0.028]]),
      add({ kind: 'sphere', center: [0, 0, 0.185], radius: 0.024 }, 0.008),
    ],
  },
  chalice: {
    reads: 'a footed cup', size: [0.18, 0.24], tint: '#c9a45c', gloss: true,
    terms: () => [
      lathe([0, 0, 0], 0.24, [[0, 0.07], [0.05, 0.06], [0.12, 0.016], [0.45, 0.014], [0.55, 0.05], [0.78, 0.085], [1, 0.09]]),
      { ...lathe([0, 0, 0.14], 0.12, [[0, 0.03], [0.5, 0.072], [1, 0.082]]), op: 'subtract' },
    ],
  },
  candle: {
    reads: 'a lit taper in its own wax', size: [0.16, 0.38], tint: '#e6d9b8',
    terms: () => [
      lathe([0, 0, 0], 0.3, [[0, 0.036], [0.9, 0.034], [1, 0.02]]),
      add({ kind: 'ellipsoid', center: [0.035, -0.02, 0.2], radii: [0.012, 0.012, 0.05] }, 0.02),
      add({ kind: 'ellipsoid', center: [0, 0, 0.01], radii: [0.07, 0.07, 0.014] }, 0.03),
      add({ kind: 'roundCone', a: [0, 0, 0.325], b: [0, 0, 0.375], ra: 0.016, rb: 0.004 }),
    ],
  },
  tome: {
    reads: 'a closed book lying flat', size: [0.36, 0.08], tint: '#6f4a35',
    terms: () => [add({ kind: 'box', center: [0, 0, 0.035], size: [0.34, 0.24, 0.07], round: 0.008 }), { op: 'transform', rotate: [0, 0, 18] }],
  },
  orb: {
    reads: 'a sphere on a ring stand', size: [0.24, 0.3], tint: '#b9a6d6', gloss: true,
    terms: () => [
      lathe([0, 0, 0], 0.07, [[0, 0.085], [0.3, 0.08], [1, 0.05]]),
      add({ kind: 'sphere', center: [0, 0, 0.17], radius: 0.115 }),
    ],
  },
  crystal: {
    reads: 'a cluster of shards', size: [0.28, 0.34], tint: '#a8cbd8', gloss: true,
    terms: () => [
      add({ kind: 'roundCone', a: [0, 0, 0.02], b: [0.01, 0, 0.32], ra: 0.05, rb: 0.006 }),
      add({ kind: 'roundCone', a: [0.05, -0.02, 0.02], b: [0.13, -0.04, 0.2], ra: 0.036, rb: 0.005 }),
      add({ kind: 'roundCone', a: [-0.05, 0.01, 0.02], b: [-0.11, 0.03, 0.17], ra: 0.034, rb: 0.005 }),
      add({ kind: 'roundCone', a: [0, -0.05, 0.02], b: [-0.03, -0.11, 0.12], ra: 0.028, rb: 0.004 }),
      add({ kind: 'ellipsoid', center: [0, 0, 0.012], radii: [0.11, 0.09, 0.03] }, 0.02),
    ],
  },
  blade: {
    reads: 'a sword stood on its point', size: [0.22, 0.86], tint: '#b9bcc2', gloss: true,
    terms: () => [
      add({ kind: 'box', center: [0, 0, 0.3], size: [0.05, 0.012, 0.58], round: 0.004 }),
      add({ kind: 'box', center: [0, 0, 0.6], size: [0.2, 0.026, 0.026], round: 0.008 }),
      add({ kind: 'capsule', a: [0, 0, 0.62], b: [0, 0, 0.78], radius: 0.014 }),
      add({ kind: 'sphere', center: [0, 0, 0.81], radius: 0.026 }),
      { op: 'transform', rotate: [0, 0, 24] },
    ],
  },
  shield: {
    reads: 'a round shield leant back', size: [0.5, 0.5], tint: '#8a6b4a',
    terms: () => [
      add({ kind: 'ellipsoid', center: [0, 0, 0], radii: [0.24, 0.035, 0.24] }),
      add({ kind: 'sphere', center: [0, -0.03, 0], radius: 0.05 }, 0.01),
      { op: 'transform', rotate: [-16, 0, 14], translate: [0, 0, 0.235] },
    ],
  },
  skull: {
    reads: 'a skull', size: [0.2, 0.28], tint: '#ded3bb',
    terms: () => [
      add({ kind: 'ellipsoid', center: [0, 0.03, 0.17], radii: [0.1, 0.125, 0.105] }),
      add({ kind: 'box', center: [0, -0.06, 0.075], size: [0.11, 0.09, 0.09], round: 0.03 }, 0.04),
      add({ kind: 'ellipsoid', center: [-0.07, -0.045, 0.12], radii: [0.03, 0.035, 0.02] }, 0.03),
      add({ kind: 'ellipsoid', center: [0.07, -0.045, 0.12], radii: [0.03, 0.035, 0.02] }, 0.03),
      cut({ kind: 'ellipsoid', center: [-0.042, -0.1, 0.15], radii: [0.028, 0.045, 0.026] }, 0.014),
      cut({ kind: 'ellipsoid', center: [0.042, -0.1, 0.15], radii: [0.028, 0.045, 0.026] }, 0.014),
      cut({ kind: 'roundCone', a: [0, -0.115, 0.118], b: [0, -0.11, 0.092], ra: 0.006, rb: 0.016 }, 0.008),
      { op: 'transform', rotate: [0, 0, -38] },
    ],
  },
  toadstool: {
    reads: 'a capped mushroom', size: [0.22, 0.21], tint: '#b5523c',
    terms: () => [
      add({ kind: 'roundCone', a: [0.01, 0, 0], b: [0, 0, 0.15], ra: 0.03, rb: 0.022 }),
      add({ kind: 'ellipsoid', center: [0, 0, 0.16], radii: [0.1, 0.1, 0.05] }, 0.012),
      cut({ kind: 'box', center: [0, 0, 0.09], size: [0.4, 0.4, 0.1] }, 0.02),
      add({ kind: 'roundCone', a: [0.01, 0, 0], b: [0, 0, 0.15], ra: 0.03, rb: 0.022 }, 0.01),
    ],
  },
});
export const PROP_IDS = Object.freeze(Object.keys(PROPS));

const HEX = /^#[0-9a-fA-F]{6}$/;

/** One prop as a form, moved to `at` on the ground, in `tint` (its own unless said). */
export function propForm(word, { at = [0, 0], tint, id } = {}) {
  const P = PROPS[word];
  if (!P) throw new Error(`publication: no prop '${word}' (${PROP_IDS.join(', ')})`);
  if (tint !== undefined && !HEX.test(tint)) throw new Error('publication: a prop\'s tint is a colour as #rrggbb');
  const moved = at[0] || at[1] ? [{ op: 'transform', translate: [at[0], at[1], 0] }] : [];
  return { id: id ?? word, tint: tint ?? P.tint, ...(P.gloss ? { gloss: true } : {}), terms: [...P.terms(), ...moved] };
}

/**
 * Up to four props stood in a row across the picture, the tallest behind and to the left, with the station and the
 * light a still life wants. A word may be `[word, tint]`.
 */
export function stillLife(words, { light, turn = 24, finish } = {}) {
  if (!Array.isArray(words) || !words.length || words.length > 4) throw new Error('publication: a still life stands 1 to 4 props');
  const picks = words.map((w) => (Array.isArray(w) ? { word: w[0], tint: w[1] } : { word: w }));
  for (const p of picks) if (!PROPS[p.word]) throw new Error(`publication: no prop '${p.word}' (${PROP_IDS.join(', ')})`);
  // across the picture is the station's right: x cos(turn) - y sin(turn); the row runs along it, a little in depth
  const a = (turn * Math.PI) / 180, right = [Math.cos(a), -Math.sin(a)], fwd = [Math.sin(a), Math.cos(a)];
  const gap = 0.07, total = picks.reduce((s, p) => s + PROPS[p.word].size[0], 0) + gap * (picks.length - 1);
  let u = -total / 2;
  const forms = picks.map((p, i) => {
    const w = PROPS[p.word].size[0], mid = u + w / 2, depth = (i % 2 ? -0.07 : 0.05);
    u += w + gap;
    return propForm(p.word, { at: [right[0] * mid + fwd[0] * depth, right[1] * mid + fwd[1] * depth], tint: p.tint, id: `${p.word}${i}` });
  });
  const tall = Math.max(...picks.map((p) => PROPS[p.word].size[1]));
  const reach = Math.max(total, tall * 1.25);
  return {
    width: 560, height: 420, forms,
    station: { turn, eye: tall * 0.9 + 0.12, distance: reach * 2.1 + 0.5, lens: 34, look: [0, 0, tall * 0.42] },
    light: light ?? { azimuth: -58, elevation: 40 },
    ...(finish ? { finish } : {}),
  };
}
