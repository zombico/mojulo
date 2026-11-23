/**
 * DERMAL BROW — the brows PAINTED into the skin, as a current game's face carries them: each hair of the brow's groom
 * (epidermis.js `growBrow`: the head's hairs combed up, the body's out along the line, the tail's out and down, the
 * herringbone across the band) a stroke in the head's texture, where the hero wore them as a lock's mass, a band that
 * read as a plank stuck on the face. The skin shows between the hairs, the band thins at its head and tail as the
 * groom does, and the paint rides the skin, so the brow's actions move it with nothing pinned.
 *
 *   browStrokes(head, epidermis, { lashLine })  → the strokes: the groom's brow hairs on the relational head `head`,
 *                                   projected into the head's chart frame (dermal-map.js `headXY`: mm, X round the plumb
 *                                   line at the face's radius, Y up the meridian), as segments on a grid; with `lashLine`
 *                                   the LASH LINE too (the lashes' roots along each margin, smoothed: the dark line a lid
 *                                   reads by, where the lashes' own cards, hero-head-layers.js, are a ribbon); null without
 *   browAt(B, X, Y, mpt)          → { cover, root, line } at a texel of `mpt` mm: the hairs' share of it (each a line of
 *                                   `BROW_PAINT.width`, spread over the texel), the band's faint root shade, and the
 *                                   lash line's share (`LASH_LINE`)
 *
 * A texel (~0.4 mm on the head's page) is wider than a hair (~0.08 mm), so no single hair resolves: what reads is their
 * direction and their density, which is what a brow reads by at a game's distance. Deterministic: the groom's seeds.
 */
import { growEpidermis, readEpidermis } from './epidermis.js';
import { headSphere, headMarks, STAND_M } from './dermal-head.js';

/** the paint: a hair's drawn width (mm; a brow hair is ~0.08, drawn a little wider so the brow reads as full as the eye
 * sees it, the hairs' own shadows between them), the strokes' gain, and the root shade under the band (its share at the
 * band's densest, its spread in mm, its density's knee in hair-mm per mm²) */
export const BROW_PAINT = Object.freeze({ width: 0.12, gain: 1, root: 0.24, rootSpread: 1.2, rootKnee: 3 });
/** the lash line: its drawn width (mm), its gain, the lower lid's share of the upper's, and how many stations a margin's
 * roots are smoothed into */
export const LASH_LINE = Object.freeze({ width: 0.45, gain: 2.2, lower: 0.45, stations: 16 });
const CELL = 1;

/** The brow's strokes on the head (see the head of the file). */
export function browStrokes(head, epidermis, { lashLine = false } = {}) {
  const spec = typeof epidermis === 'string' ? { from: epidermis } : { ...epidermis };
  const cube = readEpidermis(lashLine ? spec : { ...spec, hair: { ...(spec.hair || {}), lashes: false } });
  if (!cube.hair.brows && !(lashLine && cube.hair.lashes)) return null;
  const E = growEpidermis(head, cube), sp = headSphere(head), M = headMarks(head);
  const xy = (p) => { const q = [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M]; return [Math.atan2(q[0], q[1] - M.cy) * M.r0, sp.of(q).along * M.length * 1000]; };
  // (each segment [ax, ay, bx, by, kind, weight]: kind 0 a brow hair, 1 the lash line)
  const segs = [];
  for (const st of E.strands) {
    if (st.groom !== 'brow' || st.pts.length < 2) continue;
    const P = st.pts.map(xy);
    for (let i = 0; i + 1 < P.length; i++) segs.push([P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], 0, 1]);
  }
  // (the lash line: each margin's roots, a side's and a lid's, ordered across the eye and averaged into stations)
  if (lashLine) for (const groom of ['lash', 'lashLow']) for (const side of [1, -1]) {
    const roots = E.strands.filter((st) => st.groom === groom && Math.sign(st.pts[0].x) === side).map((st) => xy(st.pts[0])).sort((a, b) => a[0] - b[0]);
    if (roots.length < 4) continue;
    const n = Math.min(LASH_LINE.stations, roots.length), line = Array.from({ length: n }, (_, k) => { const g = roots.slice(Math.floor((k * roots.length) / n), Math.floor(((k + 1) * roots.length) / n)); return [0, 1].map((a) => g.reduce((t, r) => t + r[a], 0) / g.length); });
    const w = groom === 'lash' ? 1 : LASH_LINE.lower;
    for (let i = 0; i + 1 < n; i++) segs.push([line[i][0], line[i][1], line[i + 1][0], line[i + 1][1], 1, w]);
  }
  if (!segs.length) return null;
  const reach = 3 * Math.max(BROW_PAINT.rootSpread, 1);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [ax, ay, bx, by] of segs) { x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by); x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by); }
  const box = { x0: x0 - reach, y0: y0 - reach, x1: x1 + reach, y1: y1 + reach };
  const nx = Math.ceil((box.x1 - box.x0) / CELL), ny = Math.ceil((box.y1 - box.y0) / CELL), grid = Array.from({ length: nx * ny }, () => []);
  // (each segment in every cell its reach touches: a texel reads its own cell alone)
  segs.forEach(([ax, ay, bx, by], k) => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach - box.x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx) + reach - box.x0) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - reach - box.y0) / CELL)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by) + reach - box.y0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * nx + i].push(k);
  });
  return { segs, box, nx, ny, grid, count: E.counts.brows };
}

/** The paint at a texel (see the head of the file). */
export function browAt(B, X, Y, mpt) {
  const { box } = B;
  if (X < box.x0 || X >= box.x1 || Y < box.y0 || Y >= box.y1) return null;
  const cell = B.grid[Math.floor((Y - box.y0) / CELL) * B.nx + Math.floor((X - box.x0) / CELL)];
  if (!cell.length) return null;
  const W = BROW_PAINT, s = Math.max(mpt / 2, W.width / 2), s2 = 2 * s * s, sr = W.rootSpread, sr2 = 2 * sr * sr;
  const sl = Math.max(mpt / 2, LASH_LINE.width / 2), sl2 = 2 * sl * sl;
  let line = 0, dens = 0, lash = 0;
  for (const k of cell) {
    const [ax, ay, bx, by, kind, wt] = B.segs[k], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((X - ax) * dx + (Y - ay) * dy) / l2)), ex = X - ax - dx * t, ey = Y - ay - dy * t, d2 = ex * ex + ey * ey;
    // (the lash line: the nearest of its segments, a band `LASH_LINE.width` wide spread over the texel)
    if (kind === 1) { if (d2 < 9 * sl2) lash = Math.max(lash, wt * (LASH_LINE.width / (Math.sqrt(2 * Math.PI) * sl)) * Math.exp(-d2 / sl2)); continue; }
    // (a line `width` wide crossing the texel covers width/texel of it: its share spread across the texel's size)
    if (d2 < 9 * s * s) line += (W.width / (Math.sqrt(2 * Math.PI) * s)) * Math.exp(-d2 / s2);
    // (the band's hair-length per mm² about the texel, spread wide: the root shade)
    if (d2 < 9 * sr * sr) dens += (Math.sqrt(l2) * Math.exp(-d2 / sr2)) / (2 * Math.PI * sr * sr);
  }
  const cover = 1 - Math.exp(-W.gain * line), root = W.root * (1 - Math.exp(-dens / W.rootKnee)), lashCover = 1 - Math.exp(-LASH_LINE.gain * lash);
  return cover > 0.002 || root > 0.002 || lashCover > 0.002 ? { cover, root, line: lashCover } : null;
}
