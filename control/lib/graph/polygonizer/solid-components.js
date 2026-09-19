/**
 * solid-components — is this ONE solid, or several that merely look like one?
 *
 * Closure and connectivity are different questions and the workbench only answered the first.
 * `auditClosure` asks "does every edge have a partner" — a floating horn tip, a detached spear, a
 * crest fin that never reached the helmet all pass it, because each stray island is itself a
 * perfectly closed shell. The recipe then renders correctly, exports happily, and arrives at the
 * slicer as three objects.
 *
 * Nothing else here can see it:
 *   - `field-contribution` asks whether a term is BURIED. A term that flew off is maximally
 *     exposed, so it scores perfectly while being exactly wrong.
 *   - the float/sink lint reads one global bounding box, which an island sits happily inside.
 *   - `manifold-union` finds out, but only at export, only when the optional worker is installed,
 *     and only after the operator has spent the render loop.
 *
 * Method: parity voxelization, then a 6-connected flood fill. Every monomer lowers to the same
 * baked face list whatever lane it came from, so ONE algorithm covers a field solid, a lathe, an
 * extrude and a program's raw faces — which matters because the interesting failure is a FIELD
 * hand meeting a LATHE spear, and a per-kind test could not see across that seam.
 *
 * For each grid line along +x, every triangle crossing it contributes one x plus a SIGN, taken
 * from the x-component of its own normal: negative means the ray is entering that shell, positive
 * means leaving. Sorted and accumulated, the running count is inside wherever it is non-zero.
 *
 * The NONZERO rule, not even-odd, and the difference is the whole point here. Superposition is the
 * house construction method, so monomers are SUPPOSED to interpenetrate — and two separately
 * closed shells that overlap defeat parity completely: the ray enters A, enters B, leaves A,
 * leaves B, and even-odd fills the two rinds while leaving the overlap hollow, then reports the
 * pieces as disconnected. Winding unions them the way the eye and the slicer both do.
 *
 * A line whose winding does not return to zero means the surface was not closed there — reported
 * as `leaks` rather than silently mis-filled, because a wrong "one component" is worse than an
 * honest "could not tell".
 *
 * ADVISORY, never gating, like every workbench warning. Pure and deterministic: fixed iteration
 * order, integer grid, no dice.
 */

const asPt = (c) => (Array.isArray(c) ? { x: c[0], y: c[1], z: c[2] } : c);

/** Fan-triangulate the quads/polygons of a baked face list into flat triangles. */
function trianglesOf(faces) {
  const tris = [];
  for (const f of faces) {
    const c = f && f.corners;
    if (!Array.isArray(c) || c.length < 3) continue;
    const p0 = asPt(c[0]);
    for (let i = 1; i < c.length - 1; i++) tris.push([p0, asPt(c[i]), asPt(c[i + 1])]);
  }
  return tris;
}

function boundsOfTris(tris) {
  let minx = Infinity, miny = Infinity, minz = Infinity;
  let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (const t of tris) {
    for (const p of t) {
      if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
      if (p.z < minz) minz = p.z; if (p.z > maxz) maxz = p.z;
    }
  }
  return Number.isFinite(minx) ? { minx, miny, minz, maxx, maxy, maxz } : null;
}

const DEFAULT_CELLS = 64;
const MIN_CELLS = 16;
const MAX_CELLS = 160;
// An island smaller than this share of the whole is reported but not counted as a second BODY —
// a two-cell speck is grid noise at a tangency, not a part someone authored.
const SPECK_FRAC = 0.0005;
// …and a piece one cell across its thinnest axis was never resolved at all, so it cannot testify
// to a junction. See `grazingSplit`.
const MIN_BODY_ACROSS = 2;

/**
 * Connected components of the solid a baked face list bounds.
 *
 * @param {Array<{corners:any[]}>} faces
 * @param {{cells?:number}} [opts]
 * @returns {{
 *   ok: boolean, reason?: string,
 *   cells: number, filled: number, leaks: number,
 *   count: number,                                  // components above the speck threshold
 *   components: Array<{ cells:number, frac:number, center:number[] }>,  // largest first
 * }}
 */
export function solidComponents(faces, { cells: cellsIn, withGrid = false } = {}) {
  const tris = trianglesOf(Array.isArray(faces) ? faces : []);
  if (!tris.length) return { ok: false, reason: 'no faces', cells: 0, filled: 0, leaks: 0, count: 0, components: [] };
  const b = boundsOfTris(tris);
  const spanX = b.maxx - b.minx, spanY = b.maxy - b.miny, spanZ = b.maxz - b.minz;
  const longest = Math.max(spanX, spanY, spanZ);
  if (!(longest > 0)) return { ok: false, reason: 'degenerate bounds', cells: 0, filled: 0, leaks: 0, count: 0, components: [] };

  const cells = Number.isInteger(cellsIn) ? Math.max(MIN_CELLS, Math.min(MAX_CELLS, cellsIn)) : DEFAULT_CELLS;
  const h = longest / cells;
  // One cell of margin all round, and sample lines nudged off the half-cell by an irrational-ish fraction. A quad mesh shares
  // every edge between two neighbours, so a ray landing exactly on one is counted by BOTH and the
  // crossing list comes back doubled — which is what a grid-aligned dual mesh does on a grid-aligned
  // sample line, every time. Off-lattice sampling plus the strict (half-open) inclusion test below
  // makes a shared-edge hit measure-zero instead of systematic.
  const JY = 0.5 + 0.037193, JZ = 0.5 + 0.074317;
  const ox = b.minx - h, oy = b.miny - h, oz = b.minz - h;
  const nx = Math.ceil((spanX + 2 * h) / h) + 1;
  const ny = Math.ceil((spanY + 2 * h) / h) + 1;
  const nz = Math.ceil((spanZ + 2 * h) / h) + 1;
  if (nx * ny * nz > 24e6) return { ok: false, reason: 'grid too large', cells, filled: 0, leaks: 0, count: 0, components: [] };

  // ── 1. parity fill along +x, one crossing list per (j,k) line ──────────────────────────────
  const lines = new Array(ny * nz);
  for (const [p0, p1, p2] of tris) {
    const ylo = Math.min(p0.y, p1.y, p2.y), yhi = Math.max(p0.y, p1.y, p2.y);
    const zlo = Math.min(p0.z, p1.z, p2.z), zhi = Math.max(p0.z, p1.z, p2.z);
    const j0 = Math.max(0, Math.ceil((ylo - oy) / h - JY)), j1 = Math.min(ny - 1, Math.floor((yhi - oy) / h - JY));
    const k0 = Math.max(0, Math.ceil((zlo - oz) / h - JZ)), k1 = Math.min(nz - 1, Math.floor((zhi - oz) / h - JZ));
    if (j1 < j0 || k1 < k0) continue;
    // Barycentric solve of the ray (y,z fixed, x free) against this triangle, in the y–z plane.
    const e1y = p1.y - p0.y, e1z = p1.z - p0.z;
    const e2y = p2.y - p0.y, e2z = p2.z - p0.z;
    // `det` is exactly the x-component of this triangle's (unnormalised) normal, so its sign says
    // whether a +x ray is entering the shell here or leaving it — which is what makes the winding
    // rule available for free.
    const det = e1y * e2z - e1z * e2y;
    if (Math.abs(det) < 1e-12) continue;                       // edge-on to the ray: contributes nothing
    const wind = det < 0 ? 1 : -1;                             // normal against +x = entering
    for (let k = k0; k <= k1; k++) {
      const z = oz + (k + JZ) * h;
      for (let j = j0; j <= j1; j++) {
        const y = oy + (j + JY) * h;
        const wy = y - p0.y, wz = z - p0.z;
        const u = (wy * e2z - wz * e2y) / det;
        if (!(u > 0) || u >= 1) continue;                      // half-open: a shared edge belongs to one triangle only
        const v = (e1y * wz - e1z * wy) / det;
        if (!(v > 0) || u + v >= 1) continue;
        const x = p0.x + u * (p1.x - p0.x) + v * (p2.x - p0.x);
        const idx = k * ny + j;
        (lines[idx] || (lines[idx] = [])).push(x, wind);
      }
    }
  }

  const inside = new Uint8Array(nx * ny * nz);
  let filled = 0, leaks = 0;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      const flat = lines[k * ny + j];
      if (!flat || flat.length < 4) continue;
      const hits = [];
      for (let s = 0; s < flat.length; s += 2) hits.push([flat[s], flat[s + 1]]);
      hits.sort((a, c) => a[0] - c[0]);
      let w = 0, spanStart = 0;
      let bad = false;
      for (const [x, d] of hits) {
        const was = w;
        w += d;
        if (was === 0 && w !== 0) spanStart = x;                // crossed into solid
        else if (was !== 0 && w === 0) {                        // crossed back out — fill the span
          const i0 = Math.max(0, Math.ceil((spanStart - ox) / h - 0.5));
          const i1 = Math.min(nx - 1, Math.floor((x - ox) / h - 0.5));
          for (let i = i0; i <= i1; i++) {
            const q = (k * ny + j) * nx + i;
            if (!inside[q]) { inside[q] = 1; filled++; }
          }
        }
        if (w < 0) bad = true;                                  // left a shell never entered
      }
      if (w !== 0 || bad) leaks++;                              // did not close — say so, do not guess
    }
  }
  if (!filled) return { ok: false, reason: 'nothing filled (surface may be open or thinner than a cell)', cells, filled: 0, leaks, count: 0, components: [] };

  // ── 2. 6-connected flood fill ──────────────────────────────────────────────────────────────
  const label = new Int32Array(nx * ny * nz).fill(-1);
  const stack = new Int32Array(filled);
  const comps = [];
  for (let seed = 0; seed < inside.length; seed++) {
    if (!inside[seed] || label[seed] >= 0) continue;
    const id = comps.length;
    let sp = 0, n = 0;
    let sx = 0, sy = 0, sz = 0;
    let li = Infinity, lj = Infinity, lk = Infinity, hi = -1, hj = -1, hk = -1;
    stack[sp++] = seed; label[seed] = id;
    while (sp > 0) {
      const q = stack[--sp];
      const i = q % nx, j = ((q - i) / nx) % ny, k = ((q - i) / nx - j) / ny;
      n++; sx += i; sy += j; sz += k;
      if (i < li) li = i; if (i > hi) hi = i;
      if (j < lj) lj = j; if (j > hj) hj = j;
      if (k < lk) lk = k; if (k > hk) hk = k;
      if (i > 0) { const r = q - 1; if (inside[r] && label[r] < 0) { label[r] = id; stack[sp++] = r; } }
      if (i < nx - 1) { const r = q + 1; if (inside[r] && label[r] < 0) { label[r] = id; stack[sp++] = r; } }
      if (j > 0) { const r = q - nx; if (inside[r] && label[r] < 0) { label[r] = id; stack[sp++] = r; } }
      if (j < ny - 1) { const r = q + nx; if (inside[r] && label[r] < 0) { label[r] = id; stack[sp++] = r; } }
      if (k > 0) { const r = q - nx * ny; if (inside[r] && label[r] < 0) { label[r] = id; stack[sp++] = r; } }
      if (k < nz - 1) { const r = q + nx * ny; if (inside[r] && label[r] < 0) { label[r] = id; stack[sp++] = r; } }
    }
    const r3 = (v) => Math.round(v * 1000) / 1000;
    // How many cells across this piece is at its THINNEST. A piece only a cell or two thick was
    // barely resolved, so any split it takes part in may be a grid artifact rather than a real
    // gap — the same `h = longest / cells` limit the geometry lives under, now governing the check.
    const across = Math.min(hi - li, hj - lj, hk - lk) + 1;
    comps.push({
      cells: n,
      frac: Math.round((n / filled) * 10000) / 10000,
      across,
      center: [r3(ox + (sx / n + 0.5) * h), r3(oy + (sy / n + 0.5) * h), r3(oz + (sz / n + 0.5) * h)],
    });
  }
  // `comps` is built in label order and reported biggest-first, so `ids[rank] = label` is what
  // lets a caller get from a reported piece back to its voxels. Only the cross-resolution match
  // needs it, and it holds the whole grid, so it is opt-in.
  const order = comps.map((c, i) => i);
  order.sort((a, c) => comps[c].cells - comps[a].cells);
  const sorted = order.map((i) => comps[i]);
  const bodies = sorted.filter((c) => c.frac >= SPECK_FRAC);
  return {
    ok: true, cells, filled, leaks, count: bodies.length, components: sorted,
    ...(withGrid ? { grid: { label, ids: order, nx, ny, nz, ox, oy, oz, h } } : {}),
  };
}

/**
 * Did a piece that the COARSE grid holds as one come apart into two at the FINE grid?
 *
 * This is what "the count is resolution-dependent" was always trying to ask, and asking it by
 * comparing the two COUNTS cannot answer it. The counting rule is itself resolution-dependent:
 * a plate thinner than a cell breaks into a different number of fragments at each grid, so two
 * grids disagree on recipes where nothing grazes anything (the laptop's two real bodies hold at
 * both grids while its one-cell fragments go 3 → 1), and they can agree while a real tangency
 * hides inside the arithmetic. Thresholding the counts does not rescue it — `frac` and `across`
 * are both measured against the grid, so every threshold near the resolution limit is noise.
 *
 * So match the PIECES instead. Each fine voxel is mapped to the coarse cell holding it and votes
 * for that cell's component; a fine piece's dominant coarse component is the one it came out of.
 * Two substantial fine pieces naming the SAME coarse parent is a junction that merged at the
 * coarse grid and separated at the fine one — a tangency, and the thing Manifold's union cannot
 * resolve either ("jut, don't touch"). Fragment counts cannot reach this: a fine piece whose
 * parent the coarse grid never resolved votes for nothing and is skipped, rather than being
 * counted as evidence.
 */
function grazingSplit(fine, coarse) {
  const F = fine.grid, C = coarse.grid;
  if (!F || !C) return false;
  const rank = new Int32Array(F.ids.length);
  F.ids.forEach((label, r) => { rank[label] = r; });
  const votes = F.ids.map(() => new Map());
  for (let q = 0; q < F.label.length; q++) {
    const fl = F.label[q];
    if (fl < 0) continue;
    const i = q % F.nx, j = ((q - i) / F.nx) % F.ny, k = ((q - i) / F.nx - j) / F.ny;
    const ci = Math.round((F.ox + (i + 0.5) * F.h - C.ox) / C.h - 0.5);
    const cj = Math.round((F.oy + (j + 0.5) * F.h - C.oy) / C.h - 0.5);
    const ck = Math.round((F.oz + (k + 0.5) * F.h - C.oz) / C.h - 0.5);
    if (ci < 0 || cj < 0 || ck < 0 || ci >= C.nx || cj >= C.ny || ck >= C.nz) continue;
    const cl = C.label[(ck * C.ny + cj) * C.nx + ci];
    if (cl < 0) continue;
    const m = votes[rank[fl]];
    m.set(cl, (m.get(cl) || 0) + 1);
  }
  const claimed = new Set();
  for (let r = 0; r < fine.components.length; r++) {
    const c = fine.components[r];
    // Only pieces the FINE grid actually RESOLVED can testify. A piece one cell across its
    // thinnest axis is a plate thinner than `h`, and the number of fragments such a plate breaks
    // into is a property of where the grid lines fell: those fragments are continuous at the
    // coarse grid and separate at the fine one, which looks exactly like a tangency and is not
    // one. This is the same `across` the thin-piece caveat below reads, and applying it HERE —
    // at one grid, as a filter on who may testify, never as a count to compare against the other
    // grid — is what keeps it sound. A tangency worth reporting is two solid chunks that touch.
    if (c.frac < SPECK_FRAC || c.across < MIN_BODY_ACROSS) continue;
    let best = -1, most = 0;
    for (const [cl, n] of votes[r]) if (n > most) { most = n; best = cl; }
    if (best < 0) continue;                                  // the coarse grid never resolved this piece
    if (claimed.has(best)) return true;                      // two substantial fine pieces, one coarse parent
    claimed.add(best);
  }
  return false;
}

/**
 * Warnings for a component report.
 *
 * Multi-body is NOT by itself a defect, and treating it as one was the first cut's mistake: the
 * house construction method is superposition, a prop or a loose part is ordinarily its own solid,
 * and the flagship exported object is eight of them. Firing on every such recipe would cry wolf on
 * the majority of correct work. So the COUNT is reported as a fact (`stats.components.bodies`), and
 * only two things warn:
 *
 *   - a declared `bodies: N` on the manifest that the measurement contradicts — the house pattern
 *     of gating the author's declaration against what was actually built. A character meant to
 *     print in one piece says `bodies: 1` and finds out at mint, not at the slicer.
 *   - a count that is unstable IN THE GRAZING DIRECTION (merged at the coarse grid, split at the
 *     fine one) — a tangency, which is a defect whatever the intent. The opposite disagreement is
 *     the check running out of resolution, not the recipe misbehaving, and only rides as a caveat.
 *   - a leak, as a caveat on something already reported.
 *
 * @param {object} report    from solidComponents / solidComponentsStable
 * @param {string} label     what was checked ("This recipe", "fields[0] 'head'")
 * @param {string} [units]
 * @param {?number} [expected]  the manifest's declared body count, when it declared one
 */
export function componentWarnings(report, label, units = 'units', expected = null) {
  if (!report || !report.ok) return [];
  const out = [];
  const bodies = report.components.filter((c) => c.frac >= SPECK_FRAC);
  if (Number.isInteger(expected) && expected > 0 && report.count !== expected) {
    const [main, ...rest] = bodies;
    out.push(
      `${label} declares \`bodies: ${expected}\` but measures ${report.count}. `
      + (report.count > expected
        ? `The main body holds ${Math.round(main.frac * 100)}% of the volume and ${rest.length} piece(s) stand free `
          + `(${rest.slice(0, 4).map((c) => `${Math.round(c.frac * 1000) / 10}% at [${c.center.join(', ')}] ${units}`).join('; ')}${rest.length > 4 ? '; …' : ''}). `
          + 'Each piece is closed on its own, so the closure check passes and a slicer still sees several objects — grow the overlap where they were meant to meet.'
        : 'Parts you expected to be separate have merged — reduce the overlap, or correct the declaration.'),
    );
  }
  // A split between pieces that are only a cell or two thick is not trustworthy: the grid could
  // not resolve the member that may well be joining them. Say so instead of asserting a gap.
  const thin = bodies.filter((c) => c.across <= 2);
  if (thin.length && out.length) {
    out.push(
      `${label}: ${thin.length} of those piece(s) measure ${Math.min(...thin.map((c) => c.across))}–${Math.max(...thin.map((c) => c.across))} cells across at this grid, `
      + 'so the split may be the CHECK\'s resolution rather than a real gap — a slender member (a shaft, a strap, a fin) '
      + 'falls below one cell in a whole-figure bounding box. Re-check that part on its own bounds before believing the count.',
    );
  }
  // An unstable count is only a RECIPE defect in one direction, and reading it both ways was the
  // first cut's mistake. Grazing (`coarse < fine`) means the parts merged at the coarse grid and
  // came apart at the fine one: a tangency, which is the operator's to fix. The other direction
  // (`coarse > fine`) means the coarse grid could not hold a slender member that the fine grid
  // resolves — the parts already interpenetrate, and telling someone to sink them further is
  // advice against geometry that is correct. That one is the CHECK's limit, so it rides as a
  // caveat on something already reported, the same way a leak does.
  if (report.stable === false && report.grazing) {
    out.push(
      `${label}: the body count is resolution-dependent (${report.counts.join(' vs ')} at two grid sizes), which means at least one junction `
      + 'only GRAZES its neighbour instead of overlapping it. A tangency renders fine and then fails the same way in a boolean union — '
      + 'sink the parts into each other rather than seating them flush.',
    );
  } else if (report.stable === false && out.length) {
    out.push(
      `${label}: the coarse pass counted more pieces than the fine one (${report.counts.join(' vs ')}), so a slender member `
      + '(a shaft, a strap, a rim, a leg) falls below one cell there. The count above is the FINE grid\'s and is the one to read — '
      + 'nothing needs sinking on this account.',
    );
  }
  // Leaks only matter as a CAVEAT on something already reported. A sharp tip, a deliberately
  // dropped cap on a near-degenerate end station, a grazing tangency — these leave a few lines
  // undecidable on geometry that is otherwise fine, and warning about them on their own would cry
  // wolf on correct work (it did, on a hull loft). The raw count stays in the data either way.
  if (report.leaks > 0 && out.length) {
    out.push(
      `${label}: ${report.leaks} grid line(s) crossed the surface an odd number of times, so connectivity `
      + 'could not be decided there. That means an open or self-intersecting shell — read the closure warnings first.',
    );
  }
  return out;
}

/**
 * The same count at two resolutions. Voxel connectivity is only as good as its grid: two parts
 * that merely GRAZE each other merge at a coarse grid and separate at a fine one, so a single
 * number is quietly resolution-dependent. Running it twice turns that into the finding it
 * actually is — an unstable count means some junction is a tangency rather than an overlap, and
 * a tangency is exactly what Manifold's union cannot resolve either ("jut, don't touch").
 *
 * Reports the FINE grid's measurement, and says which WAY the two disagree in `grazing`.
 *
 * The first cut reported whichever count was higher, "because under-reporting a split is the
 * expensive direction". That holds when the coarse pass under-counts — but the coarse pass
 * over-counts far more often, because a slender member (a couch rail, a spectacle arm, a table
 * leg) drops below one cell at 0.7x and the piece it joined falls off. Measured on the room
 * assets: eyeglasses read 16 bodies coarse against 1 fine, the modern couch 2 against 1, the cup,
 * vase and pencil holder 2 against 1 each. Reporting the higher number there publishes the LESS
 * trustworthy of the two measurements as fact. The fine grid is the better measurement in both
 * directions, and it is still the higher one in the direction the original note cared about.
 *
 * `grazing` is true only for `coarse < fine` — merged coarse, split fine — which is the tangency
 * Manifold's union cannot resolve either ("jut, don't touch"). `stable` stays honest about any
 * disagreement so the fact survives; what the direction governs is what gets WARNED about.
 */
export function solidComponentsStable(faces, { cells = DEFAULT_CELLS } = {}) {
  const fine = solidComponents(faces, { cells, withGrid: true });
  if (!fine.ok) return { ...fine, grid: undefined, stable: true, grazing: false };
  const coarse = solidComponents(faces, { cells: Math.max(MIN_CELLS, Math.round(cells * 0.7)), withGrid: true });
  if (!coarse.ok) return { ...fine, grid: undefined, stable: true, grazing: false };
  const grazing = grazingSplit(fine, coarse);
  // The two counts disagreeing stays in the report as a FACT — it is true, and an operator reading
  // the ledger should see it. It is just not the finding, so it no longer drives the warning.
  return {
    ...fine, grid: undefined,
    stable: coarse.count === fine.count,
    grazing,
    counts: [coarse.count, fine.count],
  };
}

export { SPECK_FRAC, DEFAULT_CELLS as COMPONENT_CELLS };
