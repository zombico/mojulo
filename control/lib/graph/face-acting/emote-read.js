/**
 * emote-read — the MACHINE READ of a face clip on a real mesh: how far the skin moves, side by side, when the clip holds
 * its face, so a faint emote's asymmetry is caught by the numbers before anyone looks (a quarter of a millimetre of
 * unevenness is no unevenness at a face's framing). The eyes gate stays the operator's; this says whether there is
 * anything for the eyes to find.
 *
 *   • THE HELD WEIGHTS of a clip (`heldWeights`): each target's median over its keys, so a blink, a stir or a saccade
 *     does not count as the face the clip holds.
 *   • THE DISPLACEMENT (`faceRead`): each vertex moved by the held weights over its morph targets (the look targets left
 *     out: a turned eye is no expression), in millimetres (the mesh's unit a metre), its largest and its 95th percentile
 *     per side of the face (x across it; the figure's left on the side `left` gives).
 *   • THE ASYMMETRY: the face against its own mirror, each vertex where it is held against where the same face with its
 *     sides swapped (each Left target's weight on its Right and back) would hold it: no vertex is paired across the
 *     midline (the one skin's lids, lips and lashes lie in layers a millimetre apart, and no pairing tells them apart),
 *     so a symmetric face reads nought exactly, and what reads is the expression's own unevenness, not the head's. Its
 *     largest and 95th percentile, and whether it `shows` (`SHOWS`).
 *   • BY REGION (`regionReads`): the same read with the held weights of one region's targets alone (the brows, the lids,
 *     the mouth: `REGIONS`), so a read says where the unevenness is, not only how much.
 * Pure arithmetic over typed arrays.
 */

/** the least asymmetry that shows at a face's framing (mm); the least move counted (mm) */
export const SHOWS = 0.5;
export const MOVES = 0.05;

/** a clip's held weights: per target, the median over its keys ({ name: w }); `w` a list of keys, each the weights in
 * `names`' order */
export function heldWeights(names, w) {
  return Object.fromEntries(names.map((n, j) => { const col = w.map((row) => row[j]).sort((a, b) => a - b); return [n, col[col.length >> 1]]; }));
}

const pct = (xs, q) => { if (!xs.length) return 0; const s = Float64Array.from(xs).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r2 = (v) => Math.round(v * 100) / 100;

/** weights with the sides swapped: each `<x>Left` target's weight on `<x>Right` and back */
export const swapSides = (weights) => Object.fromEntries(Object.entries(weights).map(([n, w]) => [n.endsWith('Left') ? `${n.slice(0, -4)}Right` : n.endsWith('Right') ? `${n.slice(0, -5)}Left` : n, w]));

/**
 * A face held by `weights` ({ target: w }) on a mesh: `positions` (Float32Array, x y z per vertex, metres), `deltas`
 * ({ target: Float32Array, the target's offsets per vertex }), `left` (+1 when the figure's left is mesh +x, −1 when −x)
 * → { L: { max, p95 }, R: { max, p95 }, asymmetry: { max, p95 }, shows, moved (the vertices counted) }, millimetres.
 */
export function faceRead({ positions, deltas, left = -1 }, weights) {
  const n = positions.length / 3, held = (W) => {
    const d = new Float64Array(n * 3);
    // (the look targets turn the globes: no expression)
    for (const [name, D] of Object.entries(deltas)) { const w = W[name] ?? 0; if (w && !name.startsWith('eyeLook')) for (let i = 0; i < n * 3; i++) d[i] += w * D[i]; }
    return d;
  };
  const d = held(weights), m = held(swapSides(weights)), len = (a, i) => 1000 * Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
  const sides = { L: [], R: [] }, asym = [];
  let moved = 0;
  for (let i = 0; i < n; i++) {
    const a = len(d, i);
    if (a >= MOVES) { moved++; sides[Math.sign(positions[i * 3]) === Math.sign(left) ? 'L' : 'R'].push(a); }
    if (Math.max(a, len(m, i)) >= MOVES) asym.push(1000 * Math.hypot(d[i * 3] - m[i * 3], d[i * 3 + 1] - m[i * 3 + 1], d[i * 3 + 2] - m[i * 3 + 2]));
  }
  const side = (xs) => ({ max: r2(xs.reduce((a, b) => Math.max(a, b), 0)), p95: r2(pct(xs, 0.95)) });
  const A = side(asym);
  return { L: side(sides.L), R: side(sides.R), asymmetry: A, shows: A.max >= SHOWS, moved };
}

/** the face's regions by their targets' names (relational-face-rig.js RELATIONAL_FACE_TARGETS): the mouth all the rest */
export const REGIONS = Object.freeze({ brows: /^brow/, lids: /^(blink|eyeWide|eyeSquint|cheekRaise)/ });

/** `faceRead` per region: { brows, lids, mouth }, each the read with that region's held weights alone */
export function regionReads(mesh, weights) {
  const of = (test) => Object.fromEntries(Object.entries(weights).filter(([n]) => test(n)));
  const other = (n) => !Object.values(REGIONS).some((re) => re.test(n));
  return { ...Object.fromEntries(Object.entries(REGIONS).map(([r, re]) => [r, faceRead(mesh, of((n) => re.test(n)))])), mouth: faceRead(mesh, of(other)) };
}

