/**
 * classify — what a model IS, read off its shape at rest: a BODY (a person's proportions), a MASCOT (a head a third of
 * its height or more: egocube/mascot-form.js law 3), a CREATURE (it stands on more than two legs) or a PROP (it stands
 * on none). Read from the geometry, never from its size: a mascot four metres tall is still a mascot, and a figure's
 * size only sets its capsule, camera and stride (egocube/mascot-pilot.js), once its units are known.
 *
 *   classifyShape(tris, { rigged? }) → {
 *     class, basis, headsTall, height, legs, crotch, neck, profile: { bands, core, comps }
 *   }
 *     tris     triangles at rest in the native frame (z up), flat [ax, ay, az, …] (import/inspect.js restTriangles, or a
 *              rig pack's parts)
 *     rigged   'humanoid' when its skeleton reads as one (rig-import.js), 'other' when it has one that does not
 *
 * The read, on a grid laid across the model in horizontal BANDS (each triangle sampled into the cells it covers):
 *   legs     the pieces each band near the floor breaks into: two mirrored → a biped, four or more → a creature,
 *            one → it stands on none (a prop, or a robe or a blob of a mascot: said, never guessed)
 *   crotch   the lowest band where the two legs join
 *   core     above the crotch, the piece holding the torso's middle: its area band by band (a T-pose's arms join it at
 *            the shoulders, a neck pinches it, a head widens it again)
 *   neck     the narrowest core band in the top half above the crotch with a head above it: the head runs from it to
 *            the crown, and heads-tall is the height over that. A rigged humanoid's chin is its skeleton's (`chin`:
 *            midway from its neck joint to its head joint), since hair and a collar hide a neck from a slice
 *
 *   HEADS                the bands: MASCOT_MAX (≤ a mascot), BODY_MIN (≥ a body), between: a body (a child, a
 *                        stylized hero), the reading shown so it can be said otherwise
 *
 * Pure: the same triangles give the same reading.
 */
const r2 = (x) => Math.round(x * 100) / 100 + 0;
const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;

/** The heads-tall bands: at most MASCOT_MAX a mascot (law 3, a head a third of the height, with a margin for a chin the
 * neck hides), at least BODY_MIN a body (the herobot's 4.5 and over), between them a body said to be stylized. */
export const HEADS = Object.freeze({ MASCOT_MAX: 3.25, BODY_MIN: 4.5 });
export const CLASSES = Object.freeze(['body', 'mascot', 'creature', 'prop']);
export const BANDS = 64;

const NB = 64;   // bands up the height (BANDS)
const NG = 96;   // cells across the footprint's longer side

/** The grid: { bands: [Set(cell)], nx, ny, cell, zmin, height, bandH, x0, y0 }. */
export function rasterize(tris) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < tris.length; i += 3) {
    const x = tris[i], y = tris[i + 1], z = tris[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const height = z1 - z0, span = Math.max(x1 - x0, y1 - y0, 1e-9);
  const cell = span / NG, bandH = (height || 1e-9) / NB;
  const nx = Math.min(NG + 1, Math.floor((x1 - x0) / cell) + 1), ny = Math.min(NG + 1, Math.floor((y1 - y0) / cell) + 1);
  const bands = Array.from({ length: NB }, () => new Set());
  const mark = (x, y, z) => {
    const b = Math.min(NB - 1, Math.max(0, Math.floor((z - z0) / bandH)));
    const cx = Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / cell))), cy = Math.min(ny - 1, Math.max(0, Math.floor((y - y0) / cell)));
    bands[b].add(cy * nx + cx);
  };
  // each triangle sampled on a lattice as fine as a cell (its longest edge in cells, so no cell it covers is missed)
  const step = Math.min(cell, bandH);
  for (let i = 0; i + 8 < tris.length; i += 9) {
    const a = [tris[i], tris[i + 1], tris[i + 2]], b = [tris[i + 3], tris[i + 4], tris[i + 5]], c = [tris[i + 6], tris[i + 7], tris[i + 8]];
    const e = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]), Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
    const n = Math.min(256, Math.max(1, Math.ceil((e / step) * 1.5)));
    for (let p = 0; p <= n; p++) for (let q = 0; q <= n - p; q++) {
      const u = p / n, v = q / n, w = 1 - u - v;
      mark(u * a[0] + v * b[0] + w * c[0], u * a[1] + v * b[1] + w * c[1], u * a[2] + v * b[2] + w * c[2]);
    }
  }
  return { bands, nx, ny, cell, zmin: z0, height, bandH, x0, y0 };
}

/** A band's pieces (8-connected), each { cells: [...], area, cx, cy }, biggest first. */
export function pieces(set, nx) {
  const seen = new Set(), out = [];
  for (const c of [...set].sort((a, b) => a - b)) {
    if (seen.has(c)) continue;
    const cells = [], stack = [c]; seen.add(c);
    while (stack.length) {
      const q = stack.pop(); cells.push(q);
      const x = q % nx, y = (q - x) / nx;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= nx) continue;
        const k = Y * nx + X;
        if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
      }
    }
    let sx = 0, sy = 0; for (const q of cells) { sx += q % nx; sy += Math.floor(q / nx); }
    out.push({ cells, area: cells.length, cx: sx / cells.length, cy: sy / cells.length });
  }
  return out.sort((a, b) => b.area - a.area || a.cx - b.cx);
}

const dilate = (cells, nx) => { const out = new Set(); for (const c of cells) { const x = c % nx; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (x + dx < 0 || x + dx >= nx) continue; out.add(c + dy * nx + dx); } } return out; };

/**
 * The legs, followed: down from three fifths of the height, each band's pieces that touch (within a cell) what was
 * followed in the band above; the first band where two of a size are touched is the FORK (just under the crotch), and
 * from there only those two (and what they become: knees that touch are one piece, still followed) go on down. A hand
 * hanging beside a thigh touches nothing followed from above and is left out.
 *
 *   legTrack(g, P) → { fork: band | null, mid: cell x of the trunk's middle over the fork, legCells: [band → cells],
 *                       reached: the lowest band followed }
 */
export function legTrack(g, P) {
  const NBl = g.bands.length;
  const startB = Math.floor(NBl * 0.6);
  const real = (ps) => ps.filter((p) => p.area >= Math.max(2, 0.1 * (ps[0]?.area ?? 0)));
  // the trunk where the following starts: of that band's pieces, the one under the crown (an arm hanging beside the
  // trunk can be the bigger slice, the trunk is the one the head stands on)
  let topB = NBl - 1; while (topB > 0 && !P[topB].length) topB--;
  const crown = P[topB][0];
  const cand = real(P[startB]);
  let tracked = crown && cand.length ? [cand.slice().sort((x, y) => Math.hypot(x.cx - crown.cx, x.cy - crown.cy) - Math.hypot(y.cx - crown.cx, y.cy - crown.cy) || y.area - x.area)[0]] : cand.slice(0, 1);
  let fork = null, mid = null, reached = startB;
  const legCells = new Array(NBl).fill(null);
  for (let b = startB - 1; b >= 0 && tracked.length; b--) {
    const near = dilate(tracked.flatMap((p) => p.cells), g.nx);
    let over = P[b].filter((p) => p.cells.some((c) => near.has(c)));
    if (!over.length) break;
    over = over.sort((x, y) => y.area - x.area);
    if (fork === null) {
      const big = over.filter((p) => p.area >= Math.max(2, 0.1 * over[0].area));
      if (big.length >= 2 && big[1].area >= 0.35 * big[0].area) {
        fork = b;
        const above = tracked.flatMap((p) => p.cells);
        mid = above.reduce((t, c) => t + (c % g.nx), 0) / above.length;
        over = [big[0], big[1]];
      }
    }
    tracked = over;
    if (fork !== null) legCells[b] = over.flatMap((p) => p.cells);
    reached = b;
  }
  return { fork, mid, legCells, reached };
}

/** What a model is, by its shape at rest (see the header). */
export function classifyShape(tris, { rigged = null, chin = null } = {}) {
  if (!tris || tris.length < 9) throw new Error('import: no triangles to read a shape from');
  const g = rasterize(tris);
  const P = g.bands.map((s) => pieces(s, g.nx));
  // pieces worth counting: a leg is more than a speck (a tenth of the band's biggest piece and two cells)
  const real = (ps) => ps.filter((p) => p.area >= Math.max(2, 0.1 * (ps[0]?.area ?? 0)));
  const comps = P.map((ps) => real(ps).length);
  // the legs: the trunk followed DOWN until it forks into two pieces of a size, and those followed to the floor
  // (legTrack); without a fork, what stands on the floor counted (four or more: a table, or an animal with a skeleton)
  const track = legTrack(g, P);
  const floor = [1, 2, 3].map((b) => real(P[b]).length).sort((x, y) => x - y)[1];
  let legs, crotch = null;
  if (floor >= 4) legs = floor;
  else if (track.fork !== null && track.reached <= 1 && track.fork >= NB * 0.08) { legs = 2; crotch = track.fork + 1; }
  else legs = 1;
  // the core: above the crotch (or the middle, with no legs), the piece nearest the torso's middle, band by band
  const start = crotch ?? Math.floor(NB * 0.3);
  const torsoBand = Math.min(NB - 1, start + Math.floor((NB - start) * 0.25));
  const tp = real(P[torsoBand])[0] ?? P[torsoBand][0];
  const core = new Array(NB).fill(0);
  // up the core by what joins it: each band's piece the one sharing the most cells with the core below (the neck rises
  // off the chest, a hand beside it does not); none shared, the nearest to it
  let prev = tp ?? null;
  for (let b = start; b < NB; b++) {
    const ps = P[b]; if (!ps.length) { prev = null; continue; }
    let pick = null;
    if (prev) {
      const below = new Set(prev.cells);
      let most = 0;
      for (const p of ps) { let k = 0; for (const c of p.cells) if (below.has(c)) k++; if (k > most) { most = k; pick = p; } }
      if (!pick) pick = ps.slice().sort((p, q) => Math.hypot(p.cx - prev.cx, p.cy - prev.cy) - Math.hypot(q.cx - prev.cx, q.cy - prev.cy) || q.area - p.area)[0];
    } else pick = ps[0];
    core[b] = pick.area; prev = pick;
  }
  for (let b = start - 1; b >= 0; b--) core[b] = P[b][0]?.area ?? 0;
  // the neck: down from the crown, the first band narrower than the head above it (under nine tenths of its widest,
  // and narrower than the band just over it: where the head ends), followed down its narrow run to the shoulders
  // (half as wide again): the run's narrowest band. A dip inside the head (a hat's
  // brim, an ear) has no shoulders under it; a waist has no head over it, being past the neck. Its top is the chin
  // (a head is at least a tenth of the figure: no neck is looked for nearer the crown; the shoulders are looked for in
  // the sixth of the height under the neck, so a mascot's long neck still finds them)
  const lowest = start + Math.floor((NB - start) * 0.4), reach = Math.ceil(NB / 6), crownGap = Math.ceil(NB / 10);
  let top = NB - 1; while (top > 0 && !(core[top] > 0)) top--;
  let neck = null, headMax = 0;
  for (let b = top; b >= lowest; b--) {
    if (!(core[b] > 0)) continue;
    if (headMax > 0 && top - b >= crownGap && core[b] <= 0.9 * headMax && core[b] < core[b + 1]) {
      // down the narrow run to where the shoulders widen it (half as wide again as the narrowest so far, within the
      // reach): the neck is the run's narrowest band (a round head narrows below its middle before its neck does)
      let lo = b, rise = null;
      for (let k = b - 1; k >= Math.max(0, b - reach); k--) {
        if (core[k] >= 1.5 * core[lo]) { rise = k; break; }
        if (core[k] > 0 && core[k] < core[lo]) lo = k;
      }
      if (rise !== null) { neck = lo; break; }
    }
    headMax = Math.max(headMax, core[b]);
  }
  const height = g.height;
  // a skeleton says where the chin is (rig-import's neck and head joints) better than a slice: hair and a collar hide it
  const chinAt = Number.isFinite(chin) ? chin - g.zmin : neck !== null ? (neck + 1) * g.bandH : null;
  const headH = chinAt !== null && chinAt < height ? height - chinAt : null;
  const headsTall = headH ? r2(height / headH) : null;
  // the class
  let cls, basis;
  if (rigged === 'other' && legs !== 2) { cls = 'creature'; basis = 'a skeleton that is not a humanoid\'s'; }
  else if (rigged !== 'humanoid' && legs >= 4 && rigged) { cls = 'creature'; basis = `a skeleton on ${legs} legs`; }
  else if (rigged !== 'humanoid' && legs >= 4) { cls = 'prop'; basis = `it stands on ${legs} legs and has no skeleton: furniture more often than an animal (say \`as: 'creature'\` if it is one)`; }
  else if (legs === 2 || rigged === 'humanoid') {
    if (headsTall === null) { cls = 'mascot'; basis = 'a biped with no neck: its head is its body'; }
    else if (headsTall <= HEADS.MASCOT_MAX) { cls = 'mascot'; basis = `${headsTall} heads tall: its head a third of it or more`; }
    else if (headsTall >= HEADS.BODY_MIN) { cls = 'body'; basis = `${headsTall} heads tall: a person's proportions`; }
    else { cls = 'body'; basis = `${headsTall} heads tall: between a mascot's ${HEADS.MASCOT_MAX} and a body's ${HEADS.BODY_MIN}, read as a stylized body (a child, a chibi hero); say \`as: 'mascot'\` if it is one`; }
    if (legs !== 2) basis += ' (its legs do not part in the shape: a robe, a skirt, or legs held together)';
  } else { cls = 'prop'; basis = rigged === 'other' ? 'a skeleton that is not a humanoid\'s, standing on no legs' : 'it stands on no legs'; }
  return {
    class: cls, basis, headsTall, height: r4(height), legs,
    crotch: crotch !== null ? r4((crotch + 0.5) * g.bandH) : null,
    neck: neck !== null ? r4((neck + 0.5) * g.bandH) : null, chin: chinAt !== null ? r4(chinAt) : null, chinBy: Number.isFinite(chin) ? 'skeleton' : neck !== null ? 'shape' : null,
    profile: { bands: NB, core, comps },
  };
}
