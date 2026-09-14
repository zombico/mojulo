/**
 * BODY CHARTS — the figure's own rings as a set of measured (u, v) surfaces.
 *
 * A pattern garment (pattern-garment.js) is CUT flat in centimetres and SEWN onto a body.
 * For that the body has to answer two questions no ring-stack answered before: "where is
 * the point 12 cm to the right of centre-front, 30 cm below the collar?" and "what is the
 * bust girth?". A chart answers both. It is a named region of the posed body — the trunk,
 * an arm, a leg, the neck — as ROWS top → bottom, each row a closed polygon with its
 * cumulative arc-length table measured from the FRONT, plus a cumulative arc along the
 * rows. Everything is a derive over `buildProtoform`'s rings; nothing is stored.
 *
 * Conventions (documented once, used by every consumer):
 *   • rows run top → bottom; `v` ∈ [0,1] is the fraction of the along-arc from the top.
 *   • `u` ∈ [0,1) is the fraction of a row's girth measured from centre-front (+y) and
 *     increasing toward the figure's RIGHT (+x), i.e. clockwise seen from above. So
 *     `sideR` = 0.25, `cb` (centre-back) = 0.5, `sideL` = 0.75.
 *   • world units are the figure's (STAND × scale); `worldPerCm` converts a stature.
 *   • the trunk is a HULL chart (z-band × sector outermost radius, as hullStacks binds it,
 *     so the cloth follows the combined silhouette) closed over the top by a CAP — rows over
 *     the yoke up to the crest, the shoulder line (`capRows`); limbs and the neck are TUBE
 *     charts (each posed ring is a row, re-indexed to start at the front).
 *
 * Girths fall out: a row's `girth` × (1 / worldPerCm) is a circumference in cm. That is the
 * first measured girth the substrate has had — a perimeter sum over rings that already exist.
 */

// Which body stacks feed each chart, and how the rows are built.
export const CHART_SOURCES = {
  trunk: {
    mode: 'hull',
    stacks: ['trunk', 'dantien', 'coreSideL', 'coreSideR', 'breastL', 'breastR', 'pecL', 'pecR', 'scapulaL', 'scapulaR',
      'scapBunL', 'scapBunR', 'clavicleL', 'clavicleR', 'shoulderYoke', 'diaper', 'groin', 'gluteL', 'gluteR', 'hipCapL', 'hipCapR'],
  },
  armL: { mode: 'tube', stacks: ['upperArmL', 'forearmL'] },
  armR: { mode: 'tube', stacks: ['upperArmR', 'forearmR'] },
  legL: { mode: 'tube', stacks: ['legL'] },
  legR: { mode: 'tube', stacks: ['legR'] },
  neck: { mode: 'tube', stacks: ['neck'] },
};
export const CHART_IDS = Object.keys(CHART_SOURCES);

// Named u lines. A piece anchors to one of these (or a raw fraction).
export const U_LINES = { cf: 0, sideR: 0.25, cb: 0.5, sideL: 0.75 };

const HULL_BANDS = 40, HULL_SECTORS = 48;
// THE CAP (outfit.plan.md P6): rows over the top of a hull chart, from its top band up to the
// crest — the line from the neck base to the acromion, measured off the flesh — so a shoulder
// seam has a surface to lie on. `CAP_ROWS` rows at t = k / CAP_ROWS; `CREST_BINS` samples of
// the flesh's top height across the crest's width.
const CAP_ROWS = 4, CREST_BINS = 24;
const TAU = Math.PI * 2;

const smoothstep = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

function smoothLoop(vals, half) {
  const n = vals.length, w = Math.max(0, Math.floor(half));
  if (w === 0 || n === 0) return vals.slice();
  const out = new Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = -w; k <= w; k++) s += vals[((i + k) % n + n) % n]; out[i] = s / (2 * w + 1); }
  return out;
}

// A row from a closed polygon: cumulative arc table + girth. `pts` is CLOSED implicitly
// (the last segment returns to pts[0]).
function makeRow(center, pts) {
  const arc = [0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    arc.push(arc[i] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return { center, pts, arc, girth: arc[pts.length] };
}

// ── hull chart (the trunk) ────────────────────────────────────────────────────
function hullRows(stacks) {
  const verts = [];
  let zMin = Infinity, zMax = -Infinity;
  for (const s of stacks) for (const rg of s.rings) for (const q of rg.polyline) { verts.push(q); if (q.z < zMin) zMin = q.z; if (q.z > zMax) zMax = q.z; }
  if (verts.length < 8 || zMax - zMin < 1e-6) return [];
  const span = zMax - zMin, B = HULL_BANDS, S = HULL_SECTORS;
  const band = (z) => Math.min(B - 1, Math.max(0, Math.floor((z - zMin) / span * B)));
  const cxS = new Array(B).fill(0), cyS = new Array(B).fill(0), cN = new Array(B).fill(0);
  for (const q of verts) { const b = band(q.z); cxS[b] += q.x; cyS[b] += q.y; cN[b]++; }
  const cx = cxS.map((s, i) => (cN[i] ? s / cN[i] : 0)), cy = cyS.map((s, i) => (cN[i] ? s / cN[i] : 0));
  for (const ax of [cx, cy]) {
    for (let i = 1; i < B; i++) if (!cN[i]) ax[i] = ax[i - 1];
    for (let i = B - 2; i >= 0; i--) if (!cN[i]) ax[i] = ax[i + 1];
    const raw = ax.slice();
    for (let i = 0; i < B; i++) { let s = 0, c = 0; for (let k = -2; k <= 2; k++) { const b = i + k; if (b >= 0 && b < B) { s += raw[b]; c++; } } ax[i] = s / c; }
  }
  // sector k covers the angle band centred on a_k = π/2 − 2πk/S (front first, clockwise from above)
  const R = Array.from({ length: B }, () => new Array(S).fill(0));
  for (const q of verts) {
    const b = band(q.z), dx = q.x - cx[b], dy = q.y - cy[b], r = Math.hypot(dx, dy);
    if (r < 1e-6) continue;
    let k = Math.round((Math.PI / 2 - Math.atan2(dy, dx)) / TAU * S);
    k = ((k % S) + S) % S;
    if (r > R[b][k]) R[b][k] = r;
  }
  for (let b = 0; b < B; b++) {
    const row = R[b];
    if (row.every((v) => v === 0)) continue;
    for (let j = 0; j < S; j++) {
      if (row[j] > 0) continue;
      for (let d = 1; d <= S; d++) {
        const lo = row[((j - d) % S + S) % S], hi = row[(j + d) % S];
        if (lo > 0 || hi > 0) { row[j] = Math.max(lo, hi); break; }
      }
    }
  }
  for (let b = 1; b < B; b++) if (R[b].every((v) => v === 0)) R[b] = R[b - 1].slice();
  const sm = R.map((row) => smoothLoop(row, 2));
  // smoothed for a fair arc table, but NEVER inside the raw envelope: an averaged row dips inside
  // the belly's apex and the seat, and cloth placed an ease off it would still be inside the flesh
  const smz = sm.map((row, b) => row.map((_v, j) => { let s = 0, c = 0; for (let k = -1; k <= 1; k++) { const bb = b + k; if (bb >= 0 && bb < B) { s += sm[bb][j]; c++; } } return Math.max(s / c, R[b][j]); }));
  const rows = [];
  for (let b = B - 1; b >= 0; b--) {   // top → bottom
    if (R[b].every((v) => v === 0)) continue;
    const zc = zMin + (b + 0.5) / B * span, pts = [];
    for (let k = 0; k < S; k++) {
      const a = Math.PI / 2 - TAU * k / S, r = smz[b][k];
      pts.push({ x: cx[b] + Math.cos(a) * r, y: cy[b] + Math.sin(a) * r, z: zc });
    }
    rows.push(makeRow({ x: cx[b], y: cy[b], z: zc }, pts));
  }
  return rows;
}

// ── the cap (the trunk's shoulder line) ──────────────────────────────────────
// A hull chart's rows are z-bands, so its top row is a ring AROUND the yoke at the height of the
// top band's centre and nothing lies over the top of the shoulder: cloth could reach no higher
// than that ring and its stand-off was always sideways. The cap closes the chart with rows over
// the yoke: at parameter t ∈ (0, 1] a thin ellipse with the top row's half-width W (the crest's
// end, the acromion) and a front-back half-depth that closes as √(1 − t²) — the yoke tube's own
// profile — at the height the flesh's top reaches per x (the crest, sloped or flat as the body
// is). The NECK rises through the cap, so no cap row is thinner than the neck's base: every row is
// the union of that ellipse and the neck-base circle (its mean radius, centred with the cap), and
// the crest (t = 1) is the neck circle with the crest line out to each acromion — a ring whose
// u = 0 is the front of the neck, u = 0.25 the right acromion, u = 0.5 the back of the neck.
// Cloth near the centre lands AROUND the neck by arc instead of on its axis.
function capRows(stacks, top, neck = null) {
  const c = top.center;
  let W = 0, D = 0;
  for (const p of top.pts) { W = Math.max(W, Math.abs(p.x - c.x)); D = Math.max(D, Math.abs(p.y - c.y)); }
  if (W < 1e-9 || D < 1e-9) return null;
  // the neck's base: the neck ring nearest the crest's height, its mean radius
  let rn = 0, neckGirth = 0;
  if (neck && Array.isArray(neck.rings) && neck.rings.length) {
    let zc = -Infinity; for (const rg of neck.rings) for (const q of rg.polyline) zc = Math.max(zc, q.z);
    zc = Math.min(zc, Math.max(...top.pts.map((q) => q.z)) + (D + W));   // never above the cap's reach
    let best = null; for (const rg of neck.rings) if (!best || Math.abs(rg.center.z - c.z) < Math.abs(best.center.z - c.z)) best = rg;
    if (best && best.polyline.length >= 3) {
      const r = makeRow(best.center, best.polyline);
      rn = Math.min(W * 0.9, r.girth / TAU); neckGirth = r.girth;
    }
  }
  // the crest: the flesh's top per x-bin across the row's footprint, never below the top row
  const NB = CREST_BINS, hb = new Array(NB).fill(-Infinity);
  for (const s of stacks) for (const rg of s.rings) for (const q of rg.polyline) {
    if (Math.abs(q.x - c.x) > W || Math.abs(q.y - c.y) > D) continue;
    const b = Math.min(NB - 1, Math.max(0, Math.floor((q.x - c.x + W) / (2 * W) * NB)));
    if (q.z > hb[b]) hb[b] = q.z;
  }
  for (let i = 1; i < NB; i++) if (!Number.isFinite(hb[i])) hb[i] = hb[i - 1];
  for (let i = NB - 2; i >= 0; i--) if (!Number.isFinite(hb[i])) hb[i] = hb[i + 1];
  if (!hb.every(Number.isFinite)) return null;
  const crest = hb.map((z, i) => [c.x - W + (i + 0.5) / NB * 2 * W, Math.max(c.z, z)]);
  const zCrest = Math.max(...crest.map((q) => q[1]));
  if (zCrest - c.z < 1e-9) return null;
  const cap = { rows: CAP_ROWS, cx: c.x, cy: c.y, W, D, rn, neckGirth, zTop: c.z, crest, lift: 0 };
  const chart = { cap };
  const S = HULL_SECTORS, rows = [];
  let prevD = 0, prevZ = null;
  for (let k = CAP_ROWS; k >= 1; k--) {   // top → bottom: the crest first
    const t = k / CAP_ROWS, d = D * Math.sqrt(Math.max(0, 1 - t * t)), pts = [];
    for (let j = 0; j < S; j++) {
      const a = Math.PI / 2 - TAU * j / S, ca = Math.cos(a), sa = Math.sin(a);
      const re = d < 1e-12 ? (Math.abs(sa) < 1e-9 ? W : 0) : (W * d) / Math.hypot(d * ca, W * sa);
      const r = Math.max(re, rn);   // never inside the neck's base
      const x = c.x + ca * r, y = c.y + sa * r;
      pts.push({ x, y, z: c.z + t * (crestZAt(chart, x) - c.z) });
    }
    // the row's centre climbs to the crest's top with t (monotone, whatever the crest's profile)
    const row = makeRow({ x: c.x, y: c.y, z: c.z + t * (zCrest - c.z) }, pts);
    row.cap = t;
    // the along-arc over the cap is the SURFACE's: from the crest out over the yoke's top to the
    // top row's edge (mostly forward, a little down), not the rows' height difference — cloth
    // crossing the shoulder covers that distance, and the cm drops a block reads include it
    if (prevZ != null) row.vStep = Math.hypot(d - prevD, row.center.z - prevZ);
    prevD = d; prevZ = row.center.z;
    rows.push(row);
  }
  top.vStep = Math.hypot(D - prevD, c.z - prevZ);
  return { rows, cap };
}

/**
 * Push a point OUTSIDE a tube chart (the neck rising through the shoulder's cap): if `p` lies
 * within `margin` of the tube's skin at its height, it is moved out radially to the skin plus
 * the margin. Unchanged when the point is outside the tube's span or already clear.
 */
export function pushOutsideTube(chart, p, margin = 0) {
  const rows = chart && chart.rows; if (!rows || rows.length < 2) return p;
  const zTop = Math.max(rows[0].center.z, rows[rows.length - 1].center.z), zBot = Math.min(rows[0].center.z, rows[rows.length - 1].center.z);
  if (p.z > zTop + 1e-9 || p.z < zBot - 1e-9) return p;
  let best = rows[0]; for (const r of rows) if (Math.abs(r.center.z - p.z) < Math.abs(best.center.z - p.z)) best = r;
  const dx = p.x - best.center.x, dy = p.y - best.center.y, rq = Math.hypot(dx, dy);
  if (rq < 1e-9) return { ...p, y: best.center.y + rbAt(best, 0, 1) + margin };
  const rb = rbAt(best, dx / rq, dy / rq);
  if (rq >= rb + margin - 1e-9) return p;
  const k = (rb + margin) / rq;
  return { ...p, x: best.center.x + dx * k, y: best.center.y + dy * k };
}
// a row's radius toward the unit direction (ux, uy) in its plane: the nearest point by angle
function rbAt(row, ux, uy) {
  let near = null, nd = Infinity;
  const a0 = Math.atan2(uy, ux);
  for (const q of row.pts) { const a = Math.abs(Math.atan2(q.y - row.center.y, q.x - row.center.x) - a0); const d = Math.min(a, TAU - a); if (d < nd) { nd = d; near = q; } }
  return near ? Math.hypot(near.x - row.center.x, near.y - row.center.y) : 0;
}

/** The crest's height (world z) at world x on a chart with a cap; null off the crest or without one. */
export function crestZAt(chart, x) {
  const cap = chart && chart.cap; if (!cap) return null;
  const cr = cap.crest, n = cr.length;
  if (x < cr[0][0] - (cr[1][0] - cr[0][0]) / 2 || x > cr[n - 1][0] + (cr[1][0] - cr[0][0]) / 2) return null;
  if (x <= cr[0][0]) return cr[0][1];
  if (x >= cr[n - 1][0]) return cr[n - 1][1];
  let i = 0; while (i < n - 2 && cr[i + 1][0] <= x) i++;
  const f = (x - cr[i][0]) / (cr[i + 1][0] - cr[i][0]);
  return cr[i][1] + (cr[i + 1][1] - cr[i][1]) * f;
}

/**
 * A row's EASE RING: the circumference cloth an `ease` off the skin has to cover. On a cap row the
 * stand-off turns upward with t, so the ring's extra shrinks with it — a crest centimetre is a
 * centimetre. Shared by placement and the hang rule so the two agree.
 */
export function rowRing(row, ease) { return row.girth + TAU * ease * (1 - (row.cap ?? 0)); }

/**
 * THE LAYERING RULE on the cap: the worn stacks' radius ratios mean nothing on a thin ellipse, so
 * the cap is lifted instead by the height any worn vertex inside the crest's footprint reaches
 * above it — a jacket's shoulder sits on the tee's. Returns the chart with its cap rows raised
 * by lift·t and its crest raised by lift; the chart itself when there is nothing to lift.
 */
export function liftChartCap(chart, stacks) {
  const cap = chart && chart.cap; if (!cap || !Array.isArray(stacks) || !stacks.length) return chart;
  let lift = 0;
  for (const st of stacks) {
    if (!st || !Array.isArray(st.rings)) continue;
    for (const rg of st.rings) for (const q of rg.polyline) {
      if (Math.abs(q.x - cap.cx) > cap.W || Math.abs(q.y - cap.cy) > cap.D) continue;
      const cz = crestZAt(chart, q.x); if (cz == null) continue;
      if (q.z - cz > lift) lift = q.z - cz;
    }
  }
  if (lift < 1e-9) return chart;
  const rows = chart.rows.map((row) => {
    const t = row.cap ?? 0; if (!t) return row;
    const r = makeRow({ ...row.center, z: row.center.z + lift * t }, row.pts.map((p) => ({ ...p, z: p.z + lift * t })));
    r.cap = t; return r;
  });
  return { ...chart, rows, cap: { ...cap, lift: cap.lift + lift, crest: cap.crest.map(([x, z]) => [x, z + lift]) } };
}

// ── tube chart (limbs, neck) ──────────────────────────────────────────────────
// Each ring is a row. Rows are re-indexed to START at the front (the +y direction
// projected into the ring plane) and to run toward the figure's right when seen
// with the limb's own axis pointing DOWN the chart — the trunk convention carried.
function tubeRows(stacks) {
  const rings = [];
  for (const s of stacks) for (const rg of s.rings) if (rg.polyline.length >= 3) rings.push(rg);
  if (rings.length < 2) return [];
  const rows = [];
  for (let i = 0; i < rings.length; i++) {
    const c = rings[i].center, poly = rings[i].polyline;
    const prev = rings[Math.max(0, i - 1)].center, next = rings[Math.min(rings.length - 1, i + 1)].center;
    let n = { x: next.x - prev.x, y: next.y - prev.y, z: next.z - prev.z };
    let L = Math.hypot(n.x, n.y, n.z);
    if (L < 1e-9) n = { x: 0, y: 0, z: -1 }; else n = { x: n.x / L, y: n.y / L, z: n.z / L };
    // front reference in the ring plane; a limb pointing along y falls back to +z
    let f = { x: 0 - n.x * n.y, y: 1 - n.y * n.y, z: 0 - n.z * n.y };
    L = Math.hypot(f.x, f.y, f.z);
    if (L < 1e-6) { f = { x: 0 - n.x * n.z, y: 0 - n.y * n.z, z: 1 - n.z * n.z }; L = Math.hypot(f.x, f.y, f.z) || 1; }
    f = { x: f.x / L, y: f.y / L, z: f.z / L };
    const g = { x: n.y * f.z - n.z * f.y, y: n.z * f.x - n.x * f.z, z: n.x * f.y - n.y * f.x };   // n × f
    const az = poly.map((q) => { const dx = q.x - c.x, dy = q.y - c.y, dz = q.z - c.z; return Math.atan2(dx * g.x + dy * g.y + dz * g.z, dx * f.x + dy * f.y + dz * f.z); });
    let start = 0;
    for (let j = 1; j < poly.length; j++) if (Math.abs(az[j]) < Math.abs(az[start])) start = j;
    const m = poly.length;
    // orientation: does azimuth grow with index? (compare the neighbour after the start)
    const d1 = ((az[(start + 1) % m] - az[start]) + Math.PI * 3) % TAU - Math.PI;
    const pts = [];
    for (let k = 0; k < m; k++) pts.push(poly[d1 >= 0 ? (start + k) % m : ((start - k) % m + m) % m]);
    rows.push(makeRow(c, pts));
  }
  return rows;
}

// ── landmarks ─────────────────────────────────────────────────────────────────
const zBottomOf = (st) => (st ? Math.min(...st.rings.flatMap((rg) => rg.polyline.map((p) => p.z))) : null);
const zTopOf = (st) => (st ? Math.max(...st.rings.flatMap((rg) => rg.polyline.map((p) => p.z))) : null);
const zCenterOf = (st) => (st ? st.rings.reduce((s, rg) => s + rg.center.z, 0) / st.rings.length : null);
const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

function vOfZ(rows, z) {
  // rows top → bottom; v is the ALONG-ARC fraction at height z, interpolated between the two rows
  // that bracket it — every consumer reads arc fractions, and over the cap the arc runs several
  // centimetres for a few millimetres of height
  if (z == null || rows.length < 2) return null;
  const av = arcFractions(rows);
  if (z >= rows[0].center.z) return 0;
  for (let i = 0; i < rows.length - 1; i++) {
    const za = rows[i].center.z, zb = rows[i + 1].center.z;
    if (z <= za && z >= zb) { const f = za - zb > 1e-12 ? (za - z) / (za - zb) : 0; return av[i] + (av[i + 1] - av[i]) * f; }
  }
  return 1;
}

function trunkLandmarks(rows, find, cap = null) {
  const lm = { top: 0, bottom: 1 };
  const put = (k, z) => { const v = vOfZ(rows, z); if (v != null) lm[k] = v; };
  if (cap) put('yoke', cap.zTop);   // the ring around the yoke the chart used to start at; `top` is now the crest
  put('shoulder', mean([find('upperArmL')?.rings[0]?.center.z, find('upperArmR')?.rings[0]?.center.z]));
  put('collar', zBottomOf(find('neck')) ?? zTopOf(find('trunk')));
  put('bust', mean([zCenterOf(find('breastL')), zCenterOf(find('breastR'))]) ?? mean([zCenterOf(find('pecL')), zCenterOf(find('pecR'))]));
  put('hip', mean([zCenterOf(find('gluteL')), zCenterOf(find('gluteR'))]));
  put('crotch', zBottomOf(find('groin')));
  // the natural waist is where the tape reads SMALLEST between bust and hip — the
  // tailor's rule; the belly's underside (dantien bottom) is the fallback.
  put('waist', zBottomOf(find('dantien')));
  const av = arcFractions(rows);
  if (lm.bust != null && lm.hip != null && lm.hip > lm.bust) {
    let best = null;
    for (let i = 0; i < rows.length; i++) {
      const v = av[i];
      if (v < lm.bust || v > lm.hip) continue;
      if (best == null || rows[i].girth < rows[best].girth) best = i;
    }
    if (best != null) lm.waist = av[best];
  }
  // and the hip is where the tape reads FULLEST between the waist and the crotch — the seat, not
  // the glute's centre (which sits below it on the female pole); the glute centre is the fallback
  if (lm.waist != null) {
    const lo = lm.waist, hi = lm.crotch ?? 1;
    let best = null;
    for (let i = 0; i < rows.length; i++) { const v = av[i]; if (v < lo || v > hi) continue; if (best == null || rows[i].girth > rows[best].girth) best = i; }
    if (best != null) lm.hip = av[best];
  }
  lm.hem = lm.crotch ?? 1;
  return lm;
}

function tubeLandmarks(stacks, rows) {
  const lm = { top: 0, bottom: 1 };
  // the widest row of the upper third — where a sleeve sets (the armscye line) or a
  // trouser leg's thigh line. The rows above it are the joint ball, whose rings flare
  // from a point within a centimetre; a piece anchored there stretches over that flare.
  const av = arcFractions(rows);
  const widest = (v0, v1) => { let best = null; for (let i = 0; i < rows.length; i++) { const v = av[i]; if (v < v0 || v > v1) continue; if (best == null || rows[i].girth > rows[best].girth) best = i; } return best == null ? 0 : av[best]; };
  if (stacks.length === 2) {   // arm: elbow at the stack junction
    const n0 = stacks[0].rings.length;
    lm.shoulder = widest(0, 0.35);
    lm.elbow = av[Math.min(rows.length - 1, n0)];
    lm.wrist = 1;
  }
  if (stacks.length === 1 && /^leg/.test(stacks[0].id)) { lm.thigh = widest(0, 0.35); lm.knee = 0.5; lm.ankle = 1; }
  lm.mid = 0.5;
  return lm;
}

// cumulative along-arc between row centres; a row may carry its own `vStep` (the cap's surface arc)
function alongArc(rows) {
  const v = [0];
  for (let i = 1; i < rows.length; i++) { const a = rows[i - 1].center, b = rows[i].center; v.push(v[i - 1] + (rows[i].vStep ?? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))); }
  return v;
}
function arcFractions(rows) {
  const v = alongArc(rows), total = v[v.length - 1] || 1;
  return v.map((x) => x / total);
}

function capTubeAbove(rows, vThigh) {
  const av = arcFractions(rows);
  let k = 0; for (let i = 0; i < rows.length; i++) if (av[i] <= vThigh + 1e-12) k = i;
  const cap = rows[k];
  for (let i = 0; i < k; i++) {
    const c = rows[i].center, d = { x: c.x - cap.center.x, y: c.y - cap.center.y, z: c.z - cap.center.z };
    rows[i] = makeRow(c, cap.pts.map((p) => ({ x: p.x + d.x, y: p.y + d.y, z: p.z + d.z })));
  }
}

function finishChart(id, mode, rows, landmarks, worldPerCm, stackIds) {
  const vArc = alongArc(rows);
  return { id, mode, rows, vArc, vTotal: vArc[vArc.length - 1], landmarks, worldPerCm, stacks: stackIds };
}

/**
 * Build every chart the body can supply.
 * @param {Array<{id, rings}>} body   buildProtoform output (posed)
 * @param {{ stature_cm?: number }} [opts]  the height the body stands for, in cm (default 170)
 * @returns {{ charts: Object<string, Chart>, worldPerCm: number, height: number }}
 */
export function buildBodyCharts(body, { stature_cm = 170 } = {}) {
  let zMin = Infinity, zMax = -Infinity;
  for (const s of body) for (const rg of s.rings) for (const q of rg.polyline) { if (q.z < zMin) zMin = q.z; if (q.z > zMax) zMax = q.z; }
  const height = zMax - zMin;
  const worldPerCm = height > 0 ? height / stature_cm : 1;
  const find = (id) => body.find((p) => p.id === id);
  const charts = {};
  for (const [id, src] of Object.entries(CHART_SOURCES)) {
    const stacks = src.stacks.map(find).filter(Boolean);
    if (!stacks.length) continue;
    let rows = src.mode === 'hull' ? hullRows(stacks) : tubeRows(stacks);
    if (rows.length < 2) continue;
    // a hull chart is closed over the top by the cap (the shoulder line); tube charts are not
    let cap = null;
    if (src.mode === 'hull') { const c = capRows(stacks, rows[0], find('neck')); if (c) { rows = [...c.rows, ...rows]; cap = c.cap; } }
    const landmarks = src.mode === 'hull' ? trunkLandmarks(rows, find, cap) : tubeLandmarks(stacks, rows);
    // a leg's rings above its widest thigh row are the hip joint's ball inside the pelvis — cloth
    // cannot go there, so the chart carries the thigh row's polygon up over them (a cylinder cap)
    if (landmarks.thigh != null && /^leg/.test(id)) capTubeAbove(rows, landmarks.thigh);
    charts[id] = finishChart(id, src.mode, rows, landmarks, worldPerCm, stacks.map((s) => s.id));
    if (cap) charts[id].cap = cap;
  }
  return { charts, worldPerCm, height };
}

// A point on one row at arc length `s` from the front (wraps).
function rowPointAtArc(row, s) {
  const g = row.girth, n = row.pts.length;
  let t = ((s % g) + g) % g;
  let lo = 0, hi = n;   // arc[i] ≤ t < arc[i+1]
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (row.arc[mid] <= t) lo = mid; else hi = mid; }
  const a = row.pts[lo], b = row.pts[(lo + 1) % n], seg = row.arc[lo + 1] - row.arc[lo];
  const f = seg > 1e-12 ? (t - row.arc[lo]) / seg : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
}

// Resolve a v (fraction | landmark name) on a chart.
export function resolveV(chart, v) {
  if (typeof v === 'number') return Math.max(0, Math.min(1, v));
  if (typeof v === 'string' && chart.landmarks[v] != null) return chart.landmarks[v];
  return null;
}
// Resolve a u (fraction | named line).
export function resolveU(u) {
  if (typeof u === 'number') return ((u % 1) + 1) % 1;
  if (typeof u === 'string' && U_LINES[u] != null) return U_LINES[u];
  return null;
}

/**
 * The point on a chart at (u, v) — u a girth fraction from the front (clockwise from
 * above), v the along fraction from the top. Returns the surface point, the row centre
 * interpolated with it (so a caller can offset radially), and the row's girth there.
 */
export function chartPoint(chart, u, v) {
  const along = Math.max(0, Math.min(1, v)) * chart.vTotal;
  return chartPointAtArc(chart, null, along, u);
}

/**
 * The cm-faithful placement: `sAlong` is the along-arc from the chart top (world units),
 * `sAround` the arc from a u line (world units) — both signed. When `sAround` is null the
 * fraction `uFrac` is used directly. Out-of-range along values clamp and report `clipped`.
 * `ease` (world units) is the radial stand-off the cloth will be pushed to: cloth centimetres
 * are arc on the EASE RING (girth + 2π·ease), so they are mapped onto the skin row's arc in
 * that proportion — a piece as wide as the ring closes on itself instead of wrapping past.
 */
export function chartPointAtArc(chart, sAround, sAlong, uFrac = 0, { ease = 0, rest = ease } = {}) {
  const rows = chart.rows, R = rows.length, vArc = chart.vArc;
  let clipped = false, hung = 0;
  let s = sAlong;
  if (s < 0) { if (s < -1e-9) clipped = true; s = 0; }   // a top-edge vertex lands at 0 up to Coons rounding
  // BELOW the chart's last row the cloth hangs straight on along the chart's axis (a
  // knee-length skirt below the crotch row, a long sleeve past the wrist): the last row's
  // point carried down by the overshoot. Not a clip — the chart simply ends and gravity continues.
  if (s > chart.vTotal) { hung = s - chart.vTotal; s = chart.vTotal; }
  let lo = 0, hi = R - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (vArc[mid] <= s) lo = mid; else hi = mid; }
  const span = vArc[lo + 1] - vArc[lo];
  const t = R > 1 && span > 1e-12 ? Math.max(0, Math.min(1, (s - vArc[lo]) / span)) : 0;
  const rowA = rows[lo], rowB = rows[Math.min(R - 1, lo + 1)];
  const ringA = rowRing(rowA, ease), ringB = rowRing(rowB, ease);
  const sA = sAround == null ? uFrac * rowA.girth : uFrac * rowA.girth + sAround * (rowA.girth / ringA);
  const sB = sAround == null ? uFrac * rowB.girth : uFrac * rowB.girth + sAround * (rowB.girth / ringB);
  const pa = rowPointAtArc(rowA, sA), pb = rowPointAtArc(rowB, sB);
  const p = { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, z: pa.z + (pb.z - pa.z) * t };
  const ca = rowA.center, cb = rowB.center;
  const c = { x: ca.x + (cb.x - ca.x) * t, y: ca.y + (cb.y - ca.y) * t, z: ca.z + (cb.z - ca.z) * t };
  // outward: radial from the interpolated centre, projected off the row axis
  let ax = cb.x - ca.x, ay = cb.y - ca.y, az = cb.z - ca.z, al = Math.hypot(ax, ay, az);
  if (chart.mode === 'hull' || al < 1e-9) { ax = 0; ay = 0; az = 1; al = 1; }   // a hull chart's axis is vertical (its band centroids drift sideways)
  ax /= al; ay /= al; az /= al;
  let nx = p.x - c.x, ny = p.y - c.y, nz = p.z - c.z;
  const d = nx * ax + ny * ay + nz * az; nx -= d * ax; ny -= d * ay; nz -= d * az;
  let nl = Math.hypot(nx, ny, nz) || 1;
  // ON THE CAP the stand-off turns from radial to UP with t and shortens from the ease to the
  // rest: cloth rests on the shoulder, it does not float an ease above it (`easeScale` is the
  // caller's multiplier on its ease)
  const capA = rowA.cap ?? 0, capT = capA + ((rowB.cap ?? 0) - capA) * t;
  let easeScale = 1;
  if (capT > 0) {
    nx = nx / nl * (1 - capT); ny = ny / nl * (1 - capT); nz = nz / nl * (1 - capT) + capT;
    nl = Math.hypot(nx, ny, nz) || 1;
    easeScale = ease > 1e-12 ? ((1 - capT) * ease + capT * Math.min(ease, rest)) / ease : 1;
  }
  if (hung > 0) {
    // the hang direction: the chart's own axis at its bottom (the trunk's is straight down)
    const a0 = rows[Math.max(0, R - 2)].center, a1 = rows[R - 1].center;
    let hx = a1.x - a0.x, hy = a1.y - a0.y, hz = a1.z - a0.z, hl = Math.hypot(hx, hy, hz);
    if (hl < 1e-9 || chart.mode === 'hull') { hx = 0; hy = 0; hz = -1; hl = 1; }
    p.x += hx / hl * hung; p.y += hy / hl * hung; p.z += hz / hl * hung;
    c.x += hx / hl * hung; c.y += hy / hl * hung; c.z += hz / hl * hung;
  }
  return { p, center: c, out: { x: nx / nl, y: ny / nl, z: nz / nl }, easeScale, cap: capT, girth: rowA.girth + (rowB.girth - rowA.girth) * t, clipped, hung, row: lo + t };
}

/**
 * A copy of a chart whose rows are scaled radially about their own centres (in the row
 * plane) by `scales[i]` (a number per row, or an array per point) — the pattern garment's HANG rule: cloth that is wider than the
 * body's girth cannot compress, so it stands off (a straight shift bags out at the waist).
 * Arc tables and girths are recomputed; centres, vArc and landmarks are unchanged.
 */
export function scaleChartRows(chart, scales) {
  const rows = chart.rows.map((row, i) => {
    const sc = scales[i];
    const c = row.center;
    const keep = (r) => { if (row.cap) r.cap = row.cap; return r; };   // a scaled cap row is still the cap
    if (Array.isArray(sc)) {   // per-point (directional) scales
      if (sc.every((f) => Math.abs(f - 1) < 1e-12)) return row;
      return keep(makeRow(c, row.pts.map((p, j) => { const f = Number.isFinite(sc[j]) ? sc[j] : 1; return { x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f, z: c.z + (p.z - c.z) * f }; })));
    }
    const f = Number.isFinite(sc) ? sc : 1;
    if (Math.abs(f - 1) < 1e-12) return row;
    return keep(makeRow(c, row.pts.map((p) => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f, z: c.z + (p.z - c.z) * f }))));
  });
  return { ...chart, rows };
}

/**
 * THE LAYERING RULE's measurement: how far the stacks already WORN stand off each chart row.
 * Every vertex of `stacks` is read against every chart row whose
 * along-axis band it falls in, as the RATIO of its distance off the row's axis to the row's own
 * radius in that direction; it belongs to the row where that ratio is smallest — the surface it
 * is relatively closest to, so a tee's torso beside a hanging arm is the trunk's, and a sleeve is
 * the arm's (nearest-centre would hand both to the thin arm). The row keeps the maximum ratio in
 * (1, cap]; beyond `cap` the vertex is another region's. A ring that names its `chart` (a
 * pattern piece's) lifts that chart only. No smoothing across rows: a seat hanging at hip width
 * over the narrowing groin rows must not lift the hip rows a hem sits on.
 * Returns { chartId: scales[] }, 1 = on the skin.
 */
export function standoffScalesByChart(charts, stacks, { cap = 2.5, tie = 1.15 } = {}) {
  const ids = Object.keys(charts);
  // per row, a scale PER POINT of the row polygon (directional: a belly's hanging front lifts the
  // front, not the sides and back) — 1 = on the skin
  const out = {};
  for (const id of ids) out[id] = charts[id].rows.map((row) => new Array(row.pts.length).fill(1));
  if (!Array.isArray(stacks) || !stacks.length || !ids.length) return out;
  // flat list of rows with their frame (axis, front, side) for the azimuth read
  const rowsAll = [];
  for (const id of ids) {
    const rows = charts[id].rows, R = rows.length;
    for (let i = 0; i < R; i++) {
      if (rows[i].cap) continue;   // the cap is lifted by height, not by ratio (liftChartCap)
      const c = rows[i].center, cp = rows[Math.max(0, i - 1)].center, cn = rows[Math.min(R - 1, i + 1)].center;
      // a hull chart's rows are z-bands, so its axis IS vertical: the smoothed band centroids
      // drift sideways and a neighbour-centre axis would tilt by tens of degrees at the bust
      let ax = cn.x - cp.x, ay = cn.y - cp.y, az = cn.z - cp.z, al = Math.hypot(ax, ay, az);
      if (charts[id].mode === 'hull' || al < 1e-9) { ax = 0; ay = 0; az = -1; al = 1; }
      ax /= al; ay /= al; az /= al;
      let fx = rows[i].pts[0].x - c.x, fy = rows[i].pts[0].y - c.y, fz = rows[i].pts[0].z - c.z;
      const fd = fx * ax + fy * ay + fz * az; fx -= fd * ax; fy -= fd * ay; fz -= fd * az;
      const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      const gx = ay * fz - az * fy, gy = az * fx - ax * fz, gz = ax * fy - ay * fx;   // axis × front
      // the row's along-axis band: the larger gap to a neighbouring row (an end row keeps its one gap)
      const gap = Math.max(Math.hypot(c.x - cp.x, c.y - cp.y, c.z - cp.z), Math.hypot(cn.x - c.x, cn.y - c.y, cn.z - c.z)) || 1e-6;
      // the row's points by ANGLE in its frame (monotone from pts[0]): the radius toward a vertex
      // is read by angle, not by arc fraction — an arc fraction misreads an elliptical waist by a tenth
      const ua = rows[i].pts.map((q) => { const dx = q.x - c.x, dy = q.y - c.y, dz = q.z - c.z; const d = dx * ax + dy * ay + dz * az; const px = dx - d * ax, py = dy - d * ay, pz = dz - d * az; return { u: ((Math.atan2(px * gx + py * gy + pz * gz, px * fx + py * fy + pz * fz) / TAU) % 1 + 1) % 1, r: Math.hypot(px, py, pz) }; });
      // an END row's band is open on its outward side: cloth above a chart's top row (a collar
      // over the trunk) or hanging below its last row (a hem past the crotch) is still that row's
      rowsAll.push({ id, i, row: rows[i], c, a: [ax, ay, az], f: [fx, fy, fz], g: [gx, gy, gz], band: gap, openAbove: i === 0 || !!rows[i - 1].cap, openBelow: i === R - 1, ua });
    }
  }
  // ratio of a vertex's off-axis distance to the row's radius toward it; null outside the band
  const ratioOn = (r, p) => {
    let dx = p.x - r.c.x, dy = p.y - r.c.y, dz = p.z - r.c.z;
    const d = dx * r.a[0] + dy * r.a[1] + dz * r.a[2];   // + = down the chart
    if (d < -r.band && !r.openAbove) return null;
    if (d > r.band && !r.openBelow) return null;
    dx -= d * r.a[0]; dy -= d * r.a[1]; dz -= d * r.a[2];
    const rp = Math.hypot(dx, dy, dz); if (rp < 1e-9) return null;
    const u = ((Math.atan2(dx * r.g[0] + dy * r.g[1] + dz * r.g[2], dx * r.f[0] + dy * r.f[1] + dz * r.f[2]) / TAU) % 1 + 1) % 1;
    // the row's radius at that angle: the two points bracketing u (the polygon's angles are
    // monotone from its front point), interpolated
    const ua = r.ua, n = ua.length;
    let best = 0, bd = 1;
    for (let j = 0; j < n; j++) { const d = Math.abs(ua[j].u - u); const dd = Math.min(d, 1 - d); if (dd < bd) { bd = dd; best = j; } }
    const rr = ua[best].r;
    return rr < 1e-9 ? null : { q: rp / rr, j: best };
  };
  // The ratio chooses the CHART, not the row: a vertex belongs to the chart it is relatively
  // closest to (its best row's ratio) — and to every chart NEARLY as close (within `tie`): a
  // trouser waistband at the hip reads alike on the trunk and on the leg's open-topped chart and
  // must lift both, or a shift hemmed there sinks into it; a tee's torso beside a hanging arm
  // (1.2 vs 2.4) still lifts the trunk alone. On a winning chart the vertex lifts EVERY row whose
  // band it is in, each by its own ratio: the rows it is level with. Choosing the row by ratio
  // handed a skirt's seat to the wider belly row above it and left the hip row bare at the front.
  const cand = [], bestBy = new Map();
  for (const st of stacks) {
    if (!st || !Array.isArray(st.rings)) continue;
    for (const rg of st.rings) for (const p of rg.polyline) {
      cand.length = 0; bestBy.clear();
      let br = Infinity;
      const only = typeof rg.chart === 'string' && charts[rg.chart] ? rg.chart : null;   // a pattern ring names the chart it was placed on
      for (const r of rowsAll) {
        if (only && r.id !== only) continue;
        const h = ratioOn(r, p); if (h == null) continue;
        cand.push([r, h.q, h.j]);
        if (h.q < br) br = h.q;
        const bb = bestBy.get(r.id); if (bb == null || h.q < bb) bestBy.set(r.id, h.q);
      }
      if (!(br > 1) || br > cap) continue;
      for (const [r, q, j] of cand) if (q <= cap && bestBy.get(r.id) <= br * tie && q > out[r.id][r.i][j]) out[r.id][r.i][j] = q;
    }
  }
  // smooth each row's scales over ±2 points (a max, so a lifted sector never dips between samples)
  for (const id of ids) out[id] = out[id].map((sc) => { const n = sc.length; return sc.map((_v, j) => { let m = 1; for (let k = -2; k <= 2; k++) m = Math.max(m, sc[((j + k) % n + n) % n]); return m; }); });
  return out;
}

/** The arc fraction of the chart row whose centre is nearest world height `z` (a join's matched anchor). */
export function chartVAtZ(chart, z) {
  let best = 0;
  for (let i = 1; i < chart.rows.length; i++) if (Math.abs(chart.rows[i].center.z - z) < Math.abs(chart.rows[best].center.z - z)) best = i;
  return chart.vTotal > 0 ? chart.vArc[best] / chart.vTotal : 0;
}

/** Girth (world units) at a v fraction. */
export function chartGirthAt(chart, v) {
  const s = Math.max(0, Math.min(1, v)) * chart.vTotal, rows = chart.rows, R = rows.length, vArc = chart.vArc;
  let lo = 0, hi = R - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (vArc[mid] <= s) lo = mid; else hi = mid; }
  const span = vArc[lo + 1] - vArc[lo], t = span > 1e-12 ? Math.max(0, Math.min(1, (s - vArc[lo]) / span)) : 0;
  return rows[lo].girth + (rows[Math.min(R - 1, lo + 1)].girth - rows[lo].girth) * t;
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * The tailor's tape over any figure: circumferences in cm at the named landmarks.
 * Null where the body has no such part (a fluffform without a dantien has no waist).
 */
export function bodyGirths(body, { stature_cm = 170 } = {}) {
  const { charts, worldPerCm } = buildBodyCharts(body, { stature_cm });
  const cm = (chart, v) => (chart && v != null ? r1(chartGirthAt(chart, v) / worldPerCm) : null);
  const t = charts.trunk, a = charts.armL ?? charts.armR, l = charts.legL ?? charts.legR, n = charts.neck;
  const out = {
    stature_cm,
    bust: cm(t, t?.landmarks.bust),
    waist: cm(t, t?.landmarks.waist),
    hip: cm(t, t?.landmarks.hip),
    neck: cm(n, 0.5),
    upperArm: cm(a, a?.landmarks.shoulder ?? 0.15),
    wrist: cm(a, 0.98),
    thigh: cm(l, l?.landmarks.thigh ?? 0.12),
    ankle: cm(l, 0.98),
  };
  if (t) {
    const lm = t.landmarks;
    const len = (v0, v1) => (v0 != null && v1 != null ? r1(Math.abs(v1 - v0) * t.vTotal / worldPerCm) : null);
    out.nape_to_waist = len(lm.collar, lm.waist);
    out.waist_to_hip = len(lm.waist, lm.hip);
  }
  if (a) out.arm_length = r1(a.vTotal / worldPerCm);
  if (l) out.inseam = r1(l.vTotal / worldPerCm);
  return out;
}
