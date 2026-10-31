// outfit/collar — a top's COLLAR as the outfit language says it: its kind and its front, and the measures its
// construction takes (polygonizer/shirt-collar.js builds it on either body). Pure data and two readers, no imports, so
// the expander can read a card's collar without the construction.
//
//   collarSpec(word)   a top's `collar` word → { kind, open } or null: false none, true a collared shirt closed, a kind's
//                      name (band open, turtle and shirt closed), or { kind, open? }
//   collarRun(spec)    the share of the neck the stand climbs (its run on the neck: a turtleneck's to under the jaw)

/** the kinds of collar, and each's default front */
export const COLLAR_KINDS = Object.freeze({ band: { open: true }, turtle: { open: false }, shirt: { open: false } });
/**
 * THE COLLAR's measures (m): the stand's V (its gap at its foot and at its top, open), the FALL (out off the stand at its fold and at its edge; its drop at the back and at its points; how far
 * apart its points spread, open and closed), a turtleneck's fold (a share of the stand's height) and the stand's run on
 * the neck by kind
 */
export const COLLAR = Object.freeze({
  v: { foot: 0.022, top: 0.05 },
  fall: { fold: 0.0025, out: 0.012, back: 0.036, points: 0.07, spread: { open: 0.05, closed: 0.014 } },
  turtle: { fold: 0.45 },
  run: { band: 0.3, shirt: 0.35, turtle: 0.62 },
});

/** A top's `collar` word → { kind, open } or null (see the head of the file). */
export function collarSpec(word) {
  if (!word) return null;
  if (word === true) return { kind: 'shirt', open: false };
  const o = typeof word === 'string' ? { kind: word } : typeof word === 'object' ? word : null;
  if (!o || !COLLAR_KINDS[o.kind]) return null;
  return { kind: o.kind, open: typeof o.open === 'boolean' ? o.open : COLLAR_KINDS[o.kind].open };
}

/** the share of the neck a collar's stand climbs */
export const collarRun = (spec) => COLLAR.run[spec?.kind ?? 'shirt'] ?? COLLAR.run.shirt;

