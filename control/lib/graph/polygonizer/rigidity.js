/**
 * rigidity — how a worn piece (or a hair section) MOVES with the figure: the garment canon's fourth axis (coverage, mugen,
 * RIGIDITY, cuts). `shell` (1) is locked: it moves rigidly with its bones and is part of the body's collision form; below
 * it the piece flows on control strings (hero-flow.js): `stiff` (0.8: leather, a starched hem), `crisp` (0.6: cotton),
 * `soft` (0.4: wool, a long hair mass), `flowing` (0.2: silk, chiffon), or a number in 0 … 1. No imports: the garments
 * that declare it and the flow that reads it both use it.
 */
export const RIGIDITY_WORDS = Object.freeze({ shell: 1, stiff: 0.8, crisp: 0.6, soft: 0.4, flowing: 0.2 });
/** a rigidity (a word or 0 … 1) as a number, or null when it is not one */
export function rigidityOf(r) { if (typeof r === 'string') return RIGIDITY_WORDS[r] ?? null; return Number.isFinite(r) && r >= 0 && r <= 1 ? r : null; }
/** error strings for a `rigidity` */
export function rigidityErrors(r, at = 'rigidity') { return r === undefined || rigidityOf(r) !== null ? [] : [`${at}: ${Object.keys(RIGIDITY_WORDS).map((w) => `'${w}'`).join(' | ')} or a number 0 (flowing) … 1 (locked)`]; }
/**
 * A rigidity's motion: `stiffness` (1/s²: the pull to the target), `damping` (1/s), `sail` (1/s: how hard the air drags
 * it), `gravity` (a share of g). From 0 (gossamer: barely held, all air) to 1 (held fast). Log-even in stiffness, so each
 * word step reads as one step.
 */
export function rigidityParams(r) {
  const x = Math.max(0, Math.min(1, rigidityOf(r) ?? 0.4));
  return { stiffness: 15 * Math.pow(20, x), damping: 3 + 8 * x, sail: 2 - 1.6 * x, gravity: 1 - 0.5 * x };
}

