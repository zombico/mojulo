/**
 * GARMENTS — clothes/adornments as offset shells over the figure's own flesh.
 *
 * SPIKE (lite-template/integration/0610/figure-garments.plan.md). The figure is
 * a list of tagged world-space ring-stacks `{ id, rings: [{ center, polyline }] }`
 * emitted by `buildProtoform` (figure-proto.js). A garment here is NOT new
 * geometry sculpted from scratch — it is a SELECTION of those body stacks, each
 * pushed outward from its own ring centers by a thin fabric thickness and
 * recolored. Because the offset is relative to the body's own rings, a garment
 * auto-tracks every proto/dimorph tuning of the figure underneath it (a tee on
 * the female pole follows the bust; on the male pole it follows the pec plates)
 * with no garment-specific landmark math.
 *
 * Output is the SAME shape as a body stack plus a `hex`, so the vexar renderer
 * (figure-readable-envelope.spike.gen.test.js `litFacesFromRings`) lights, culls,
 * and depth-sorts garment faces alongside flesh with zero pipeline change.
 *
 * CANON (inaugural clothing principles, lite-template/integration/0610/figure-garments.plan.md):
 * a garment is `coverage + mugen field + rigidity + cuts` (+ material) over a body
 * that SUPPLIES ITS OWN GEOMETRY — the body part's topology picks the sampler (TUBE →
 * rings, SADDLE → top-down basin, BALL → crown-fan), openings DERIVE from part roles
 * (poke-through − cover), under-colour is automatic. TOP and BOTTOM are one machine —
 * `basin(s) + tube(s) + optional ball-cap(s)` anchored at a support (shoulders / waist):
 * a jacket is torso-basin + 2 sleeves + 2 shoulder crown-fans; trousers are pelvis-basin
 * + 2 legs. Slim ↔ baggy, blazer ↔ coat, shoulder-bearing ↔ shoulderless are all the
 * SAME components at different numbers. `buildGarment(body, spec)` is the entry; the
 * `GARMENTS` table is the validated wardrobe. See the plan's CLOTHING PRINCIPLES canon.
 */

// cloth colors (vexar-lit like flesh — Lambert over these base hexes)
const TEE_HEX = '#3f6f93';     // shirt
const SHORTS_HEX = '#2f3a4c';  // shorts
const SKIN_HEX = '#c8836a';    // canonical skin suit — matched to the model's flesh tone (FLESH_HEX)

// Moving average over a closed (periodic) loop of scalars — the angular low-pass
// that washes out a ring's fine contour (helper cleft/lobes/abs) into its line.
function smoothLoop(vals, half) {
  const n = vals.length, w = Math.max(0, Math.floor(half));
  if (w === 0 || n === 0) return vals.slice();
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -w; k <= w; k++) s += vals[((i + k) % n + n) % n];
    out[i] = s / (2 * w + 1);
  }
  return out;
}

// MIN-SHIELD offset. Each garment vertex rides a SMOOTHED envelope standing off
// the body by `clearance`, tenting up only where the bare body would poke through
// (`minSkin` anti-clip floor). So the cloth follows the body's gross line, not the
// skin — helper contours below the clearance vanish and nothing is skintight.
// Center is preserved, so back-face culling + outward normals keep working.
//   garment_r = max(smoothedRadius + clearance, bodyRadius + minSkin)
function shieldRings(rings, { clearance = 0.18, smooth = 4, minSkin = 0.04 } = {}) {
  return rings.map((rg) => {
    const c = rg.center, dirs = [], rad = [];
    for (const q of rg.polyline) {
      const dx = q.x - c.x, dy = q.y - c.y, dz = q.z - c.z;
      const L = Math.hypot(dx, dy, dz) || 1;
      dirs.push([dx / L, dy / L, dz / L]); rad.push(L);
    }
    const rs = smoothLoop(rad, smooth);
    const polyline = rg.polyline.map((_, i) => {
      const r = Math.max(rs[i] + clearance, rad[i] + minSkin), d = dirs[i];
      return { x: c.x + d[0] * r, y: c.y + d[1] * r, z: c.z + d[2] * r };
    });
    return { center: c, polyline };
  });
}

// Contiguous fraction [t0,t1] of a ring sequence (by index — the stacks are
// ordered along their centerline, see figure-proto.js).
function sliceRings(rings, t0, t1) {
  const n = rings.length;
  if (n === 0) return rings;
  const i0 = Math.round(t0 * (n - 1)), i1 = Math.round(t1 * (n - 1));
  return rings.slice(Math.min(i0, i1), Math.max(i0, i1) + 1);
}

const byId = (pieces, id) => pieces.find((p) => p.id === id);

// Uniform-thickness shell: offset every vertex along the LOCAL surface normal
// (ring-tangent × stack-tangent), oriented outward — NOT radially from a single
// center. This follows true curvature (the breast dome, the deltoid), so a
// form-fitting suit hugs the form. Radial-from-center distorts domes whose ring
// `center` sits on the spine axis (e.g. the breast: center is {x:0,…}, so radial
// pushes its surface sideways off the spine instead of out of the dome).
// `taperHead`/`taperTail`: fraction of the stack (from the first/last ring) over
// which thickness eases 0↔full, so a cuff lands FLUSH with the bare body at that
// end (the wrist on the forearm tail, the ankle on the leg tail).
export function inflateRings(rings, thickness, { taperHead = 0, taperTail = 0 } = {}) {
  const n = rings.length;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const at = (i, j) => { const p = rings[i].polyline; return p[Math.min(j, p.length - 1)]; };
  const ease = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  return rings.map((rg, i) => {
    const poly = rg.polyline, m = poly.length, c = rg.center;
    const ip = Math.max(0, i - 1), inx = Math.min(n - 1, i + 1);
    const u = n > 1 ? i / (n - 1) : 0;
    let f = 1;
    if (taperHead > 0) f = Math.min(f, ease(u / taperHead));
    if (taperTail > 0) f = Math.min(f, ease((1 - u) / taperTail));
    const th = thickness * f;
    const np = poly.map((q, j) => {
      const u = sub(poly[(j + 1) % m], poly[(j - 1 + m) % m]);   // along the ring
      const w = sub(at(inx, j), at(ip, j));                       // along the stack
      let nx = u.y * w.z - u.z * w.y, ny = u.z * w.x - u.x * w.z, nz = u.x * w.y - u.y * w.x;
      let L = Math.hypot(nx, ny, nz);
      if (L < 1e-9) {   // degenerate (e.g. the nipple ring) → fall back to radial
        nx = q.x - c.x; ny = q.y - c.y; nz = q.z - c.z; L = Math.hypot(nx, ny, nz) || 1;
      }
      nx /= L; ny /= L; nz /= L;
      const dx = q.x - c.x, dy = q.y - c.y, dz = q.z - c.z;       // orient outward
      if (nx * dx + ny * dy + nz * dz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      return { x: q.x + nx * th, y: q.y + ny * th, z: q.z + nz * th };
    });
    return { center: c, polyline: np };
  });
}

// Shrink-wrap SEVERAL body stacks into ONE smooth garment hull. Per-ring
// shielding can't close the gap BETWEEN separate masses (the bust cleft is the
// gap between the L/R breast stacks); this can. We bin every contributing
// vertex into a (height-band × angle-sector) field, keep the OUTERMOST flesh
// radius per cell, smooth that field, and stand it off by `clearance` — so the
// cloth follows the combined silhouette down the body's line and hides which
// helper is underneath. One closed ring per band → renderer-ready.
// `hangFrom` (z-fraction, 1=top) turns the wrap into a SUSPENDED drape: the cloth
// hangs from that anchor line down (running-max per sector, relaxed by `sag`), so
// between the support and the bust it stays out instead of caving to the chest
// hollow — what makes a tank read as held up by the shoulders. `openTop` scoops
// the neck (front) and armholes (sides) near the anchor, leaving shoulder straps.
function hullStacks(stacks, { zBands = 26, sectors = 44, clearance = 0.18, smoothA = 4, smoothZ = 2, hangFrom = null, sag = 0.12, openTop = null } = {}) {
  const verts = [];
  let zMin = Infinity, zMax = -Infinity;
  for (const s of stacks) for (const rg of s.rings) for (const q of rg.polyline) {
    verts.push(q); if (q.z < zMin) zMin = q.z; if (q.z > zMax) zMax = q.z;
  }
  if (verts.length < 8 || zMax - zMin < 1e-6) return [];
  const span = zMax - zMin;
  const band = (z) => Math.min(zBands - 1, Math.max(0, Math.floor((z - zMin) / span * zBands)));

  // per-band centroid (cx, cy) — the wrap is measured from this, so it works for
  // offset limbs (a single pant leg) as well as the centered torso/skirt.
  const cxS = new Array(zBands).fill(0), cyS = new Array(zBands).fill(0), cN = new Array(zBands).fill(0);
  for (const q of verts) { const b = band(q.z); cxS[b] += q.x; cyS[b] += q.y; cN[b]++; }
  const cx = cxS.map((s, i) => (cN[i] ? s / cN[i] : 0)), cy = cyS.map((s, i) => (cN[i] ? s / cN[i] : 0));
  for (const ax of [cx, cy]) {
    for (let i = 1; i < zBands; i++) if (!cN[i]) ax[i] = ax[i - 1];
    for (let i = zBands - 2; i >= 0; i--) if (!cN[i]) ax[i] = ax[i + 1];
  }
  // smooth the centerline across bands — a raw per-band mean is noisy and shifts
  // each ring, corrugating the wrap into horizontal terraces.
  for (const ax of [cx, cy]) {
    const raw = ax.slice();
    for (let i = 0; i < zBands; i++) { let s = 0, c = 0; for (let k = -2; k <= 2; k++) { const b = i + k; if (b >= 0 && b < zBands) { s += raw[b]; c++; } } ax[i] = s / c; }
  }

  // radius field: outermost flesh per (band, sector), measured from the centroid
  const R = Array.from({ length: zBands }, () => new Array(sectors).fill(0));
  for (const q of verts) {
    const b = band(q.z), dx = q.x - cx[b], dy = q.y - cy[b], r = Math.hypot(dx, dy);
    if (r < 1e-6) continue;
    let a = Math.atan2(dy, dx); if (a < 0) a += 2 * Math.PI;
    const sec = Math.min(sectors - 1, Math.floor(a / (2 * Math.PI) * sectors));
    if (r > R[b][sec]) R[b][sec] = r;
  }
  // fill empty sectors (circular nearest non-zero)
  for (let b = 0; b < zBands; b++) {
    const row = R[b];
    if (row.every((v) => v === 0)) continue;
    for (let j = 0; j < sectors; j++) {
      if (row[j] > 0) continue;
      for (let d = 1; d <= sectors; d++) {
        const lo = row[((j - d) % sectors + sectors) % sectors], hi = row[(j + d) % sectors];
        if (lo > 0 || hi > 0) { row[j] = Math.max(lo, hi); break; }
      }
    }
  }
  // drop fully-empty bands at the ends, copy interior empties from neighbours
  for (let b = 1; b < zBands; b++) if (R[b].every((v) => v === 0)) R[b] = R[b - 1].slice();

  const smoothRow = (row, half) => smoothLoop(row, half);
  const sm = R.map((row) => smoothRow(row, smoothA));
  // light vertical smoothing
  const smz = sm.map((row, b) => row.map((_v, j) => {
    let s = 0, c = 0;
    for (let k = -smoothZ; k <= smoothZ; k++) { const bb = b + k; if (bb >= 0 && bb < zBands) { s += sm[bb][j]; c++; } }
    return s / c;
  }));

  // SUSPENSION: hang the field from the anchor band downward (per sector), so the
  // cloth is held up at the anchor and drapes below it (the tank's shoulder line).
  if (hangFrom != null) {
    const anchorB = Math.max(0, Math.min(zBands - 1, Math.round(hangFrom * (zBands - 1))));
    const dz = span / zBands;
    for (let s = 0; s < sectors; s++) { let r = -Infinity; for (let b = anchorB; b >= 0; b--) { r = Math.max(smz[b][s], r - sag * dz); smz[b][s] = r; } }
  }

  const angDist = (x, t) => { const d = Math.abs(x - t) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
  const rings = [];
  for (let b = 0; b < zBands; b++) {
    if (R[b].every((v) => v === 0)) continue;
    const zc = zMin + (b + 0.5) / zBands * span, tz = (b + 0.5) / zBands, poly = [];
    for (let j = 0; j <= sectors; j++) {
      const jj = j % sectors, a = (jj / sectors) * Math.PI * 2;
      let clr = clearance;
      if (openTop && tz > 1 - openTop.frac) {   // scoop neck (front +y) + armholes (sides ±x) near the anchor
        const top = (tz - (1 - openTop.frac)) / openTop.frac;
        const inNeck = angDist(a, Math.PI / 2) < (openTop.neckHalf ?? 0.6);
        const inArm = angDist(a, 0) < (openTop.armHalf ?? 0.5) || angDist(a, Math.PI) < (openTop.armHalf ?? 0.5);
        if (inNeck || inArm) clr *= Math.max(0, 1 - top);   // → flush with body at the very top = the opening edge
      }
      // ride the SMOOTHED field only — the raw per-cell max is binning-noisy.
      const r = smz[b][jj] + clr;
      poly.push({ x: cx[b] + Math.cos(a) * r, y: cy[b] + Math.sin(a) * r, z: zc });
    }
    rings.push({ center: { x: cx[b], y: cy[b], z: zc }, polyline: poly });
  }
  return rings;
}

/**
 * Build a fitted tee + shorts over an already-built figure.
 *
 * @param {Array<{id,rings}>} bodyPieces  output of buildProtoform(positions, proto)
 * @param {{ tee?:number, shorts?:number }} [opts]  fabric thickness (world units)
 * @returns {Array<{id, rings, hex}>}  garment ring-stacks, renderer-ready
 */
export function buildOutfit(bodyPieces, { tee = {}, shorts = {} } = {}) {
  // shield/hull standoff (world units). clearance = looseness, smooth = how much
  // contour to wash out, minSkin = anti-clip floor.
  const TEE = { clearance: 0.20, smooth: 5, minSkin: 0.05, ...tee };
  const SHORTS = { clearance: 0.16, smooth: 5, minSkin: 0.05, ...shorts };

  const out = [];
  const add = (id, rings, hex) => { if (rings && rings.length > 1) out.push({ id, rings, hex }); };
  const pick = (ids, t0 = 0, t1 = 1) => ids
    .map((id) => byId(bodyPieces, id))
    .filter(Boolean)
    .map((pc) => ({ id: pc.id, rings: sliceRings(pc.rings, t0, t1) }));
  // a single shrink-wrapped hull over several body stacks
  const hull = (id, ids, hex, opts, t0, t1) =>
    add(id, hullStacks(pick(ids, t0, t1), opts), hex);
  // a thin shielded shell over one stack (for tubes — sleeves, leg cuffs)
  const shell = (bodyId, hex, opts, t0 = 0, t1 = 1) => {
    const pc = byId(bodyPieces, bodyId);
    if (pc) add(bodyId + '·cloth', shieldRings(sliceRings(pc.rings, t0, t1), opts), hex);
  };

  // ── TEE — the whole torso (rib barrel + chest masses + side wrap + back) as ONE
  // hull from hem (above the hip) to the neckline, so the bust/pec/belly read as a
  // single draped front, not separate lumps. Sleeves are thin shells on the arms.
  hull('tee', ['trunk', 'coreSideL', 'coreSideR', 'breastL', 'breastR', 'pecL', 'pecR',
    'scapulaL', 'scapulaR', 'scapBunL', 'scapBunR', 'dantien'], TEE_HEX,
    { clearance: TEE.clearance, sectors: 44, zBands: 26, smoothA: 4, smoothZ: 2 },
    0.0, 0.97);
  shell('upperArmL', TEE_HEX, TEE, 0.0, 0.42);       // short sleeve
  shell('upperArmR', TEE_HEX, TEE, 0.0, 0.42);

  // ── SHORTS — seat (glutes + groin + low trunk) as ONE hull; legs as thin shells
  // down to mid-thigh.
  hull('shorts-seat', ['gluteL', 'gluteR', 'groin', 'trunk'], SHORTS_HEX,
    { clearance: SHORTS.clearance, sectors: 40, zBands: 16, smoothA: 4, smoothZ: 2 },
    0.0, 0.30);
  shell('legL', SHORTS_HEX, SHORTS, 0.0, 0.32);
  shell('legR', SHORTS_HEX, SHORTS, 0.0, 0.32);

  return out;
}

// The canonical skin suit: the figure's second skin. A thin uniform shell on
// EVERY body stack except the head, hands, and feet — color-matched to the
// model's skin and tapered FLUSH into the bare wrists and ankles, so it reads as
// continuous skin, not a garment. This is the canonical base layer; other
// garments (tee, shorts) layer over it.
//
// Form-fitting by construction: offset is along the local surface NORMAL
// (`inflateRings`), so it hugs the breast curvature, the deltoid, the glutes —
// the suit reads the body, not a smoothed silhouette. The distal end of each
// forearm/leg tapers to zero thickness, landing flush at the wrist/ankle.
const SKIN_SUIT_BARE = new Set(['headEgg', 'faceMask', 'handL', 'handR', 'footL', 'footR']);
const SKIN_SUIT_TAPER_TAIL = new Set(['forearmL', 'forearmR', 'legL', 'legR']);

/**
 * @param {Array<{id,rings}>} bodyPieces  output of buildProtoform(positions, proto)
 * @param {{ thickness?:number, hex?:string, taper?:number }} [opts]
 *   thickness (world units), hex (defaults to the model's flesh tone), taper
 *   (fraction of the forearm/leg over which the cuff eases to flush).
 * @returns {Array<{id, rings, hex}>}  skin-suit ring-stacks, renderer-ready
 */
export function buildSkinSuit(bodyPieces, { thickness = 0.05, hex = SKIN_HEX, taper = 0.18 } = {}) {
  const out = [];
  for (const pc of bodyPieces) {
    if (SKIN_SUIT_BARE.has(pc.id) || pc.rings.length < 2) continue;
    const opts = SKIN_SUIT_TAPER_TAIL.has(pc.id) ? { taperTail: taper } : {};
    out.push({ id: pc.id + '·skin', rings: inflateRings(pc.rings, thickness, opts), hex });
  }
  return out;
}

// Upper convex hull of a polyline (xs ascending) — the indices whose chords are
// the taut "membrane" across the row: it rides the peaks and bridges the hollows
// (the bust cleft) with straight spans, never dipping into a concavity.
function upperHullIdx(xs, ys) {
  const idx = [];
  for (let i = 0; i < xs.length; i++) {
    while (idx.length >= 2) {
      const a = idx[idx.length - 2], b = idx[idx.length - 1];
      const cross = (xs[b] - xs[a]) * (ys[i] - ys[a]) - (ys[b] - ys[a]) * (xs[i] - xs[a]);
      if (cross >= 0) idx.pop(); else break;   // pop left turns → keep the upper boundary
    }
    idx.push(i);
  }
  return idx;
}

/**
 * DRAPE — fabric as a membrane over the front of the form. Captures the two
 * forces that make cloth read as cloth, both of which REFUSE concavities:
 *   - TENSION  → bridge across each horizontal row (upper convex hull): the cloth
 *               chords over the bust cleft instead of dipping into it.
 *   - GRAVITY  → running-max down each vertical column with a slow `sag` relax:
 *               below the breast apex the cloth hangs, leaving the underbust
 *               hollow as an air gap (the skin suit hugged it).
 * Built as a front height-field y = C(x,z) sampled from the body's forward
 * profile, then emitted as horizontal scanline "rings" the vexar renderer meshes.
 * `clearance` is the standoff; it tapers to 0 at the collar (top) and the side
 * seams so the sheet meets the body there and pooches only over the supported
 * masses. Toggle `gravity`/`bridge` to study each force in isolation.
 *
 * @returns {{id, rings, hex} | null}
 */
export function drapeFrontSheet(bodyPieces, opts = {}) {
  const {
    ids = ['trunk', 'breastL', 'breastR', 'pecL', 'pecR', 'coreSideL', 'coreSideR', 'dantien', 'clavicleL', 'clavicleR'],
    nx = 60, nz = 60, clearance = 0.13, sag = 0.12, hex = TEE_HEX,
    gravity = true, bridge = true, topTaper = 0.14, sideTaper = 0.14, id = 'drape-front',
  } = opts;

  const V = [];
  for (const gid of ids) { const pc = bodyPieces.find((p) => p.id === gid); if (pc) for (const rg of pc.rings) for (const q of rg.polyline) V.push(q); }
  if (V.length < 12) return null;
  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
  for (const q of V) { if (q.x < xmin) xmin = q.x; if (q.x > xmax) xmax = q.x; if (q.z < zmin) zmin = q.z; if (q.z > zmax) zmax = q.z; }
  const xAt = (i) => xmin + (i / (nx - 1)) * (xmax - xmin);
  const zAt = (j) => zmin + (j / (nz - 1)) * (zmax - zmin);
  const xi = (x) => Math.max(0, Math.min(nx - 1, Math.round((x - xmin) / (xmax - xmin) * (nx - 1))));
  const zj = (z) => Math.max(0, Math.min(nz - 1, Math.round((z - zmin) / (zmax - zmin) * (nz - 1))));

  // front profile B[j][i] = outermost forward (max y) flesh in that cell
  const B = Array.from({ length: nz }, () => new Array(nx).fill(-Infinity));
  for (const q of V) { const j = zj(q.z), i = xi(q.x); if (q.y > B[j][i]) B[j][i] = q.y; }
  // fill gaps along x (linear), then any empty row from a filled neighbour
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (B[j][i] === -Infinity) {
    let l = -1, r = -1;
    for (let k = i - 1; k >= 0; k--) if (B[j][k] > -Infinity) { l = k; break; }
    for (let k = i + 1; k < nx; k++) if (B[j][k] > -Infinity) { r = k; break; }
    if (l >= 0 && r >= 0) B[j][i] = B[j][l] + (B[j][r] - B[j][l]) * ((i - l) / (r - l));
    else if (l >= 0) B[j][i] = B[j][l]; else if (r >= 0) B[j][i] = B[j][r];
  }
  for (let j = 0; j < nz; j++) if (B[j].every((v) => v === -Infinity)) { const src = B.find((rw, k) => k !== j && !rw.every((v) => v === -Infinity)); if (src) B[j] = src.slice(); }

  // low-pass the field — per-cell max over sparse vertices is binning-noisy, and
  // the gravity running-max below would drag single-cell spikes into curtains.
  const smooth2d = (G, passes) => {
    let cur = G;
    for (let p = 0; p < passes; p++) {
      const nxt = cur.map((r) => r.slice());
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        let s = 0, c = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const jj = j + dj, ii = i + di;
          if (jj >= 0 && jj < nz && ii >= 0 && ii < nx && Number.isFinite(cur[jj][ii])) { s += cur[jj][ii]; c++; }
        }
        if (c) nxt[j][i] = s / c;
      }
      cur = nxt;
    }
    return cur;
  };

  // light denoise only — the convex-hull (tension) and running-max (gravity) are
  // themselves concavity-removers, so over-smoothing here erases the very cleft /
  // underbust they're meant to act on. One pass kills up-spikes, keeps the features.
  let C = smooth2d(B, 1);
  if (bridge) for (let j = 0; j < nz; j++) {     // TENSION: chord over each row's hollows
    const xs = [], ys = [], map = [];
    for (let i = 0; i < nx; i++) if (Number.isFinite(C[j][i])) { xs.push(xAt(i)); ys.push(C[j][i]); map.push(i); }
    if (xs.length < 3) continue;
    const h = upperHullIdx(xs, ys);
    for (let k = 0; k < h.length - 1; k++) {
      const a = h[k], b = h[k + 1];
      for (let i = map[a]; i <= map[b]; i++) { const t = (xAt(i) - xs[a]) / ((xs[b] - xs[a]) || 1); C[j][i] = ys[a] + (ys[b] - ys[a]) * t; }
    }
  }
  if (gravity) {     // GRAVITY: hang from each column's highest support, relax by `sag`
    const dz = (zmax - zmin) / (nz - 1);
    for (let i = 0; i < nx; i++) { let r = -Infinity; for (let j = nz - 1; j >= 0; j--) { r = Math.max(C[j][i], r - sag * dz); C[j][i] = r; } }
  }
  C = smooth2d(C, 1);   // soften the curtain edges left by the running-max

  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const rows = [];
  for (let j = 0; j < nz; j++) {
    const tz = j / (nz - 1);
    const fTop = clamp01((1 - tz) / topTaper);   // 0 at the collar (top), full below
    const poly = [];
    for (let i = 0; i < nx; i++) {
      const tx = i / (nx - 1);
      const fSide = clamp01(Math.min(tx, 1 - tx) / sideTaper);   // 0 at the side seams
      const clr = clearance * fTop * fSide;
      poly.push({ x: xAt(i), y: C[j][i] + clr, z: zAt(j) });
    }
    rows.push({ center: { x: 0, y: -1e3, z: zAt(j) }, polyline: poly });   // inside far behind (−y) → normals face forward
  }
  return { id, rings: rows, hex };
}

// ─────────────────────────────────────────────────────────────────────────────
// DECLARATIVE GARMENTS — clothing as a pure function of the body.
//
// A garment is DATA: a list of pieces, each a (coverage region + fit + clearance
// + edges). `buildGarment(body, spec)` resolves it against whatever body it's
// given, so the same spec dresses any figure (sex, size, build, pose) — the body
// is an input, not something the garment was fitted to. The three surface
// primitives become one `fit` dial:
//   - 'hug'   → inflateRings     (fitted: reveals the form; the skin suit)
//   - 'hull'  → hullStacks       (loose:  shrink-wraps a region; the tee body)
//   - 'drape' → drapeFrontSheet  (draped: tension+gravity over the front)
// The COVERAGE RULE is baked in: every covered stack (incl. superimposed ones —
// dantien, scapula buns, shoulder caps) is colored over with a thin under-shade
// shell, so nothing shows as bare flesh inside the garment's zone.

const HEAD_HANDS_FEET = ['headEgg', 'faceMask', 'handL', 'handR', 'footL', 'footR'];
const baseName = (id) => id.replace(/[LR]$/, '');

function darkenHex(hex, k = 0.6) {
  const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return '#' + c((n >> 16) & 255) + c((n >> 8) & 255) + c(n & 255);
}

// Resolve a list of region names to the body-stack ids present on THIS body.
function resolveCoverage(body, regions) {
  const have = new Set(body.map((p) => p.id));
  const ids = new Set();
  const add = (...xs) => xs.forEach((x) => { if (have.has(x)) ids.add(x); });
  for (const region of regions) {
    switch (region) {
      case 'torso': add('trunk', 'dantien', 'coreSideL', 'coreSideR', 'breastL', 'breastR', 'pecL', 'pecR', 'scapulaL', 'scapulaR', 'scapBunL', 'scapBunR', 'clavicleL', 'clavicleR', 'shoulderYoke'); break;
      case 'seat': add('gluteL', 'gluteR', 'groin'); break;
      case 'upperArms': add('upperArmL', 'upperArmR'); break;
      case 'arms': add('upperArmL', 'upperArmR', 'forearmL', 'forearmR'); break;
      case 'legs': add('legL', 'legR'); break;
      case 'hips': add('trunk', 'coreSideL', 'coreSideR', 'gluteL', 'gluteR', 'groin'); break;   // pelvis/hips + groin (clip the top to the waistline)
      case 'neck': add('neck'); break;
      case 'body': for (const p of body) if (!HEAD_HANDS_FEET.includes(p.id)) ids.add(p.id); break;   // all but head/hands/feet
      default: if (have.has(region)) ids.add(region);   // a raw stack id
    }
  }
  return ids;
}

// The set of body stacks a garment covers (union over its pieces) — so the
// renderer knows which flesh is clothed.
export function garmentCoverage(body, spec) {
  const ids = new Set();
  for (const piece of spec.pieces) for (const id of resolveCoverage(body, piece.coverage)) ids.add(id);
  return ids;
}

/**
 * Build a garment over a body from a declarative spec.
 * @param {Array<{id,rings}>} body  buildProtoform output
 * @param {{ id, color:{cloth,under?}, pieces: Array<{coverage:string[], fit:'hug'|'hull'|'drape', clearance?, thickness?, sag?, taperEnds?, taper?, cloth?}> }} spec
 * @returns {Array<{id, rings, hex}>}  renderer-ready cloth stacks
 */
export function buildGarment(body, spec) {
  const out = [];
  const cloth = spec.color?.cloth ?? TEE_HEX;
  const under = spec.color?.under ?? darkenHex(cloth);
  const find = (id) => body.find((p) => p.id === id);
  for (const piece of spec.pieces) {
    const pieceCloth = piece.cloth ?? cloth;
    const fit = piece.fit ?? 'hug';
    if (fit === 'radial') {
      // fill ONE segment's verified golden-ratio plan as a cloth cap (the bust
      // method, applied to garment coverage). `term` is the tuned terminator.
      const st = find(piece.segment); if (!st) continue;
      const plan = radialPlan(st, { term: piece.term ?? 0.6 });
      out.push({ id: `${spec.id}:under:${piece.segment}`, rings: inflateRings(st.rings, 0.012), hex: under });
      out.push({ id: `${spec.id}:${piece.segment}`, rings: fillRadialPlan(plan, piece.clearance ?? 0.06), hex: pieceCloth });
      continue;
    }
    if (fit === 'pelvis') {
      // the whole pelvis basin (diaper + hip vajras + groin + glutes), top-down
      // concentric rings filled. With basin.includeLegs it bells over both legs (skirt).
      const basin = piece.basin ?? {};
      const plan = pelvisPlan(body, basin); if (!plan) continue;
      const underIds = ['groin', 'diaper', 'coreSideL', 'coreSideR', 'trunk', 'gluteL', 'gluteR'];
      if (basin.includeLegs) underIds.push('legL', 'legR');
      for (const id of underIds) {
        const st = find(id); if (!st) continue;
        const rr = st.rings.filter((rg) => rg.center.z <= plan.top && rg.center.z >= plan.bottom);
        if (rr.length > 1) out.push({ id: `${spec.id}:under:${id}`, rings: inflateRings(rr, 0.012), hex: under });
      }
      out.push({ id: `${spec.id}:pelvis`, rings: fillPelvisBasin(plan, piece.clearance ?? 0.08), hex: pieceCloth });
      continue;
    }
    if (fit === 'torso') {
      // the torso basin filled to a top — `openTop` (neck/armhole scoops) makes it
      // a vest; small `clearance` makes it fitted-but-not-skintight; `openFront`
      // opens it down the middle (the chest shows in the gap → no under-color).
      const plan = torsoPlan(body, piece.basin ?? {}); if (!plan) continue;
      if (!piece.openFront) for (const id of ['trunk', 'coreSideL', 'coreSideR', 'breastL', 'breastR', 'pecL', 'pecR', 'scapulaL', 'scapulaR', 'scapBunL', 'scapBunR', 'clavicleL', 'clavicleR', 'shoulderYoke', 'dantien']) {
        const st = find(id); if (!st) continue;
        const rr = st.rings.filter((rg) => rg.center.z <= plan.top && rg.center.z >= plan.bottom);
        if (rr.length > 1) out.push({ id: `${spec.id}:under:${id}`, rings: inflateRings(rr, 0.012), hex: under, panel: 'torso' });
      }
      // Standing rule: declared COVERAGE of body positions must stay covered; the
      // CUTS (openings) only sit where a part POKES THROUGH. So: the armhole derives
      // from the arm BELOW the shoulder (arm[0.25,1]) → the shoulder stays covered;
      // the neck from the neck; and the CHEST (breast on the female / pec on the male)
      // + the SHOULDERS (clavicle/scapula) are cover parts the cuts must not eat.
      const openParts = [
        ...bodyCapsules(body, ['upperArmL', 'upperArmR'], { slice: [0.25, 1.0] }),
        ...bodyCapsules(body, ['neck']),
      ];
      // openness cover = the whole covered torso (so cuts can't eat the chest/shoulder);
      // front-keep cover = the chest masses only (so the open front still parts at the cleft).
      const coverComps = bodyComponents(body, piece.coverParts ?? ['trunk', 'coreSideL', 'coreSideR', 'breastL', 'breastR', 'pecL', 'pecR', 'clavicleL', 'clavicleR', 'scapulaL', 'scapulaR', 'shoulderYoke', 'dantien']);
      // `cleanFront` → a clean angular WEDGE (no frontKeep): the open front shows the
      // chest in a straight V like 39's wedge cut, instead of `frontKeep` leaving
      // ragged partial cloth shredding over the bust.
      const frontComps = piece.cleanFront ? [] : bodyComponents(body, ['breastL', 'breastR', 'pecL', 'pecR', 'clavicleL', 'clavicleR']);
      // openParts/superposition are SKIPPED when the spec drives openings via cuts
      // (svgile-row): a fully closed basin the cutter then carves (neck/armhole/front).
      const op = piece.cutOpenings ? [] : openParts;
      out.push({ id: `${spec.id}:torso`, rings: fillBasin(plan, { clearance: piece.clearance ?? 0.1, openParts: op, openMargin: piece.openMargin ?? 0.16, coverComps, frontComps, coverNear: piece.coverNear ?? 0.55, coverRamp: piece.coverRamp ?? 0.2, openFront: piece.openFront ?? 0, lapelFrac: piece.lapelFrac ?? 1 }), hex: pieceCloth, panel: 'torso' });
      continue;
    }
    if (fit === 'shoulders') {
      // P2/P3 — a crown-fan cap per shoulder, the ball-topology component. `seamGap`
      // should equal the torso piece's clearance so the cap connects flush. Omitting
      // this piece is exactly how a shoulderless garment falls out (P4).
      for (const side of ['L', 'R']) {
        for (const id of ['upperArm' + side, 'shoulderYoke', 'clavicle' + side, 'scapula' + side]) {   // under-colour the shoulder mass (P5)
          const st = find(id); if (st && st.rings.length > 1) out.push({ id: `${spec.id}:under:${id}:${side}`, rings: inflateRings(st.rings, 0.012), hex: under, panel: 'shoulder' });
        }
        const cap = buildShoulderCap(body, side, { crownGap: piece.crownGap ?? 0.05, seamGap: piece.seamGap ?? 0.18, lateralGap: piece.lateralGap ?? null, term: piece.term ?? 1.5 });
        if (cap) out.push({ id: `${spec.id}:${cap.id}`, rings: cap.rings, hex: pieceCloth, panel: 'shoulder' });
      }
      continue;
    }
    if (fit === 'sleeve') {
      // P4 — one joined sleeve per arm (no elbow cut). coverForearm:false → bicep-length.
      const coverForearm = piece.coverForearm ?? true;
      for (const side of ['L', 'R']) {
        const armIds = coverForearm ? ['upperArm' + side, 'forearm' + side] : ['upperArm' + side];
        for (const id of armIds) { const st = find(id); if (st && st.rings.length > 1) out.push({ id: `${spec.id}:under:${id}`, rings: inflateRings(st.rings, 0.012), hex: under, panel: 'sleeve' }); }
        const sl = buildSleeve(body, side, { thickness: piece.thickness ?? 0.06, headSlice: piece.headSlice ?? 0.15, coverForearm });
        if (sl) out.push({ id: `${spec.id}:${sl.id}`, rings: sl.rings, hex: pieceCloth, panel: 'sleeve' });
      }
      continue;
    }
    const ids = resolveCoverage(body, piece.coverage);
    if (fit === 'hug') {
      const thickness = piece.thickness ?? 0.05;
      for (const id of ids) {
        const pc = find(id); if (!pc || pc.rings.length < 2) continue;
        const rings = piece.slice ? sliceRings(pc.rings, piece.slice[0], piece.slice[1]) : pc.rings;   // e.g. a short sleeve = upperArm[0,0.5]
        if (rings.length < 2) continue;
        const end = piece.taperEnds?.[baseName(id)];
        const opts = end === 'tail' ? { taperTail: piece.taper ?? 0.18 } : end === 'head' ? { taperHead: piece.taper ?? 0.18 } : {};
        out.push({ id: `${spec.id}:${id}`, rings: inflateRings(rings, thickness, opts), hex: pieceCloth });
      }
      continue;
    }
    // waistline clip — a lower garment's top is defined BELOW the dantien (belly),
    // so it covers the hips + groin but not the belly. Clip every covered stack's
    // rings to z ≤ the dantien's underside.
    let waistZ = Infinity;
    if (piece.waist === 'belowDantien') { const dan = find('dantien'); if (dan) waistZ = Math.min(...dan.rings.flatMap((r) => r.polyline.map((p) => p.z))); }
    const clip = (rings) => (waistZ === Infinity ? rings : rings.filter((rg) => rg.center.z <= waistZ));
    // hull / drape don't enclose every superimposed stack → color the covered
    // body under the surface (thin inflate, so it reliably draws over the flesh).
    for (const id of ids) { const pc = find(id); if (!pc) continue; const rr = clip(pc.rings); if (rr.length > 1) out.push({ id: `${spec.id}:under:${id}`, rings: inflateRings(rr, 0.012), hex: under }); }
    const stacks = [...ids].map(find).filter(Boolean).map((s) => ({ id: s.id, rings: clip(s.rings) })).filter((s) => s.rings.length > 1);
    if (fit === 'hull') {
      const rings = hullStacks(stacks, { clearance: piece.clearance ?? 0.16, sectors: piece.sectors ?? 44, zBands: piece.zBands ?? 26, smoothA: 4, smoothZ: 2 });
      if (rings.length) out.push({ id: `${spec.id}:hull`, rings, hex: pieceCloth });
    } else if (fit === 'drape') {
      // a SUSPENDED wrap — declare what it hangs from. Without an anchor a drape
      // is a strapless panel with nothing holding it up (the tank bug). Every
      // garment hangs from the TOP of its covered region (shoulders for a top,
      // waist for a skirt/trousers, hip for a single pant leg); the anchor name
      // only adds the neck/armhole openings a shoulder-hung top needs.
      const anchor = piece.anchor ?? 'shoulders';
      const openTop = anchor === 'shoulders' ? (piece.openTop ?? { frac: 0.36, neckHalf: 0.7, armHalf: 0.62 }) : null;
      const rings = hullStacks(stacks, { clearance: piece.clearance ?? 0.13, sectors: 44, zBands: 30, smoothA: 4, smoothZ: 2, hangFrom: 1.0, sag: piece.sag ?? 0.15, openTop });
      if (rings.length) out.push({ id: `${spec.id}:drape`, rings, hex: pieceCloth });
    }
  }
  return out;
}

// A small wardrobe, entirely as data. Same specs dress any body.
export const GARMENTS = {
  skinSuit: { id: 'skin', color: { cloth: SKIN_HEX }, pieces: [{ coverage: ['body'], fit: 'hug', thickness: 0.05, taperEnds: { forearm: 'tail', leg: 'tail' } }] },
  wetsuit: { id: 'wetsuit', color: { cloth: '#222a36' }, pieces: [{ coverage: ['body'], fit: 'hug', thickness: 0.06, taperEnds: { forearm: 'tail', leg: 'tail' } }] },
  tee: { id: 'tee', color: { cloth: '#3f6f93' }, pieces: [{ coverage: ['torso'], fit: 'hull', clearance: 0.18 }, { coverage: ['upperArms'], fit: 'hug', thickness: 0.05 }] },
  tank: { id: 'tank', color: { cloth: '#6a8f5a' }, pieces: [{ coverage: ['torso'], fit: 'drape', anchor: 'shoulders', clearance: 0.12 }] },
  dress: { id: 'dress', color: { cloth: '#7a4a6a' }, pieces: [{ coverage: ['torso', 'seat'], fit: 'drape', anchor: 'shoulders', clearance: 0.14, sag: 0.1 }] },
  // waistband BELOW the dantien, covering hips + groin; each pant leg wraps its OWN leg
  trousers: { id: 'trousers', color: { cloth: '#3a4250' }, pieces: [
    { coverage: ['hips'], fit: 'drape', anchor: 'waist', waist: 'belowDantien', clearance: 0.09 },
    { coverage: ['legL'], fit: 'drape', anchor: 'hip', clearance: 0.075 },
    { coverage: ['legR'], fit: 'drape', anchor: 'hip', clearance: 0.075 },
  ] },
  // waistband BELOW the dantien; ONE bell over hips + groin + BOTH legs (legs unioned)
  skirt: { id: 'skirt', color: { cloth: '#8a5a3a' }, pieces: [
    { coverage: ['hips', 'legs'], fit: 'drape', anchor: 'waist', waist: 'belowDantien', clearance: 0.14, sag: 0.07 },
  ] },
  // RADIAL-METHOD trousers: waistband-to-hips drape (to the dantien, past the hips)
  // gives the full coverage; each pelvis segment is then a tuned golden-ratio cap
  // (term chosen so the plans don't superimpose) sitting on the seat as the segment
  // detail; + a drape wrap per leg. "Each garment is a tuning of the radial plan."
  trousersRadial: { id: 'trousersR', color: { cloth: '#3a4250' }, pieces: [
    { fit: 'pelvis', clearance: 0.08 },                                  // the whole pelvis basin (diaper + hips), top-down
    { coverage: ['legL'], fit: 'drape', anchor: 'hip', clearance: 0.075 },
    { coverage: ['legR'], fit: 'drape', anchor: 'hip', clearance: 0.075 },
  ] },
  // SAME basin method, legs included → it bells over both legs instead of wrapping
  // each. If this reads, the pelvis basin IS the lower-garment method; bagginess
  // (clearance) and material (hex) are just parameters on top.
  skirtRadial: { id: 'skirtR', color: { cloth: '#8a5a3a' }, pieces: [
    { fit: 'pelvis', clearance: 0.14, basin: { includeLegs: true, hemFrac: 0.5 } },
  ] },
  // TORSO behavioural primitives (golden-ratio radial basin), NOT gendered:
  // vest = open (armholes + neck scoop), moderate standoff, hem at the waist.
  vest: { id: 'vest', color: { cloth: '#5a6b4a' }, pieces: [
    { fit: 'torso', clearance: 0.10, basin: { hemFrac: 0.66 }, openMargin: 0.22, openFront: 0.34 },
  ] },
  // fitted shirt = close-following (small clearance) but NOT skintight, hem to the
  // hip + a short sleeve over half the bicep. Smaller armholes (the sleeve attaches).
  fittedShirt: { id: 'fitted', color: { cloth: '#7a4a5a' }, pieces: [
    { fit: 'torso', clearance: 0.05, basin: { hemFrac: 0.82 }, openMargin: 0.18 },
    { coverage: ['upperArms'], fit: 'hug', thickness: 0.05, slice: [0, 0.5] },
  ] },
  // OPEN JACKET — the vest's open-front torso (looser, hip-length) + full sleeves.
  // Openings still derive from the part-roles: arms→armholes, neck→neckline,
  // breasts as cover. `openFront` opens it down the middle; bigger clearance = an
  // outer layer that stands off.
  jacket: { id: 'jacket', color: { cloth: '#39414f' }, pieces: [
    // uniform basin (dense to the shoulder, no sparse top) + looser clearance → the
    // torso reaches up to the cap (no flesh band) and sits loose like the 34/39 drape.
    // openFront = the wedge half-angle; lapelFrac ≥ 1 keeps the cutaway open the WHOLE
    // length (collar → hem) like 39, instead of closing high into a one-button blazer.
    { fit: 'torso', clearance: 0.21, basin: { hemFrac: 0.82, uniform: true }, openMargin: 0.14, openFront: 0.6, lapelFrac: 3.0, cleanFront: true },
    { fit: 'shoulders', crownGap: 0.05, seamGap: 0.21, term: 1.5 },   // crown-fan caps; seamGap == torso/sleeve mugen → flush
    { fit: 'sleeve', thickness: 0.20 },                                // loose sleeve at the SAME mugen as torso/cap (was skin-tight 0.06)
  ] },
  // CUTTER DEMO — the SAME jacket, but built CLOSED and opened only by the first-class
  // red-line cutter (a `wedge` cut, full length). Proves measure→pattern→CUT: the torso
  // basin is whole; the cutter deletes the front wedge at FACE level, revealing flesh,
  // leaving everything outside the wedge bit-identical. Body-relative → carves any pole.
  jacketCut: { id: 'jacketCut', color: { cloth: '#39414f' }, pieces: [
    { fit: 'torso', clearance: 0.21, basin: { hemFrac: 0.82, uniform: true }, openMargin: 0.14 },   // CLOSED
    { fit: 'shoulders', crownGap: 0.05, seamGap: 0.21, term: 1.5 },
    { fit: 'sleeve', thickness: 0.20 },
  ], cuts: [{ kind: 'wedge', halfAngle: 0.6, from: 'collar', to: 'hem' }] },   // ← the red-line opens the front
  // UNIFIED OPENINGS — EVERY opening through the one cutter. The torso is a fully
  // closed basin (`cutOpenings:true` skips fillBasin's superposition); the front,
  // neck, and both armholes are all declared CUTS, scoped to the torso panel so the
  // armhole never eats the sleeve. The cutter is now the single source of fabric
  // removal (measure→pattern→cut), and openings stop being a separate mechanism.
  jacketAllCut: { id: 'jacketAllCut', color: { cloth: '#39414f' }, pieces: [
    { fit: 'torso', clearance: 0.21, basin: { hemFrac: 0.82, uniform: true }, cutOpenings: true },
    { fit: 'shoulders', crownGap: 0.05, seamGap: 0.21, term: 1.5 },
    { fit: 'sleeve', thickness: 0.20 },
  ], cuts: [
    { kind: 'wedge', halfAngle: 0.6, from: 'collar', to: 'hem', on: 'torso' },   // front cutaway
    { kind: 'neck' },                                                            // neckline (→ capsule at the neck, torso panel)
    { kind: 'armhole', side: 'L' }, { kind: 'armhole', side: 'R' },              // armholes (→ capsules at the arms, torso panel)
  ] },
  // PATTERN PANELS — a panel is the DUAL of a cut: same body-relative region vocabulary,
  // but the action is RECOLOUR (a material) instead of DELETE. So a garment is base cloth
  // − cuts + panels — the cut-and-sew decomposition. Here: contrast yoke (the shoulder
  // panel), contrast sleeves, light cuffs (a band at the sleeve wrist).
  jacketPaneled: { id: 'jacketPaneled', color: { cloth: '#6b7078' }, pieces: [
    { fit: 'torso', clearance: 0.21, basin: { hemFrac: 0.82, uniform: true }, cutOpenings: true },
    { fit: 'shoulders', crownGap: 0.05, seamGap: 0.21, term: 1.5 },
    { fit: 'sleeve', thickness: 0.20 },
  ],
  cuts: [
    { kind: 'wedge', halfAngle: 0.6, from: 'collar', to: 'hem', on: 'torso' },
    { kind: 'neck' }, { kind: 'armhole', side: 'L' }, { kind: 'armhole', side: 'R' },
  ],
  panels: [
    { on: 'shoulder', region: { kind: 'all' }, color: '#36404f' },               // contrast yoke (the shoulder caps)
    { on: 'sleeve', region: { kind: 'all' }, color: '#2c333d' },                  // contrast sleeves
    { on: 'sleeve', region: { kind: 'band', lo: 'hem', hi: 0.13 }, color: '#9aa0a8' },   // light cuffs at the wrist
  ] },
  // OVERSIZED SHIRT — spot check of the four knobs at a different point than the jacket:
  // CLOSED front (no openFront), hem PAST the hip (hemFrac→1), BICEP-length sleeves
  // (coverForearm:false), and a HIGHER mugen than the jacket (looser everywhere). Same
  // three components, only the numbers move.
  oversizedShirt: { id: 'oshirt', color: { cloth: '#9a7b52' }, pieces: [
    { fit: 'torso', clearance: 0.28, basin: { hemFrac: 0.98, uniform: true }, openMargin: 0.16 },   // closed, long, loose
    { fit: 'shoulders', crownGap: 0.07, seamGap: 0.28, term: 1.5 },                                  // higher mugen than the jacket
    { fit: 'sleeve', thickness: 0.26, coverForearm: false },                                         // full bicep, ends at the elbow
  ] },
  // TROUSERS — the LOWER-body mirror of the jacket: a pelvis BASIN (the saddle
  // sampler, waist→crotch) + a leg TUBE per side (anchored at the hip, hangs down).
  // Slim vs baggy is ONLY the mugen (clearance) — same components, different numbers,
  // exactly like shirt-vs-jacket on the torso.
  trousersSlim: { id: 'trousersSlim', color: { cloth: '#37414f' }, pieces: [
    { fit: 'pelvis', clearance: 0.06 },                                  // waist→crotch basin, snug
    { coverage: ['legL'], fit: 'drape', anchor: 'hip', clearance: 0.06 },
    { coverage: ['legR'], fit: 'drape', anchor: 'hip', clearance: 0.06 },
  ] },
  trousersBaggy: { id: 'trousersBaggy', color: { cloth: '#5b5236' }, pieces: [
    { fit: 'pelvis', clearance: 0.18 },                                  // looser seat
    { coverage: ['legL'], fit: 'drape', anchor: 'hip', clearance: 0.26 },   // ≈ the shirt's mugen
    { coverage: ['legR'], fit: 'drape', anchor: 'hip', clearance: 0.26 },
  ] },
  // SHOULDERLESS (P4) — the SAME torso basin, just no shoulder cap and no sleeves:
  // a strapless top falls out as the ABSENCE of the shoulder component, not a special
  // case. (drape anchor still holds it up; here a fitted basin hem at the waist.)
  tankStrapless: { id: 'strapless', color: { cloth: '#6a8f5a' }, pieces: [
    { fit: 'torso', clearance: 0.08, basin: { hemFrac: 0.55 }, openMargin: 0.3 },
  ] },
};

// ─────────────────────────────────────────────────────────────────────────────
// RADIAL COVERAGE PLANNING — tell a garment what to cover by GEOMETRY, not size.
//
// The same "verify before fill" method the bust uses (golden-ratio concentric
// ring-waves): each body SEGMENT is re-parametrized as concentric rings from its
// outward apex, spaced at 1/φ from the terminator (the outward equator) inward.
// A garment is then assigned the segments whose plans TILE its region — and the
// assignment is valid only if those plans do not SUPERIMPOSE (no body point is
// claimed by two segments). Cylindrical wrapping can't honor the pelvis (it
// bridges the crotch/cleft); a per-segment radial plan can, and the superposition
// test is what proves the coverage is clean before any cloth is filled.

const _sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const _len = (a) => Math.hypot(a.x, a.y, a.z);
const _n = (a) => { const l = _len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const _dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const _cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/**
 * Concentric golden-ratio ring-plan over ONE body segment, from its outward apex.
 * Only the OUTWARD hemisphere (footprint angle θ ≤ 90° from the apex axis) is
 * planned — that's the face a garment wraps; the inner side lies against the body.
 * @returns {{ rings: Array<Array<{x,y,z}>>, apex, center, axis, reach }}  world-space
 */
export function radialPlan(stack, { phi = 1.618, samples = 48, maxRings = 7, term = 1, apex = null } = {}) {
  const V = stack.rings.flatMap((r) => r.polyline);
  if (V.length < 8) return { rings: [], apex: null, center: null, axis: null, reach: 0 };
  const C = V.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, z: a.z + v.z }), { x: 0, y: 0, z: 0 });
  C.x /= V.length; C.y /= V.length; C.z /= V.length;
  let A = V[0], dmax = -1;
  for (const v of V) { const d = _len(_sub(v, C)); if (d > dmax) { dmax = d; A = v; } }   // outward apex
  if (apex) A = apex;   // PIN the clock centre (e.g. the acromion / shoulder vajra), not the auto farthest vertex
  const axis = _n(_sub(A, C));
  const ref = Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const u = _n(_cross(axis, ref)), w = _cross(axis, u);
  const HALF = (Math.PI / 2) * term;   // terminator footprint — `term`<1 pulls the rr=1 ring inward (smaller cap) to clear superposition
  const pts = V.map((v) => {
    const d = _sub(v, C), L = _len(d) || 1;
    return { v, theta: Math.acos(Math.max(-1, Math.min(1, _dot(d, axis) / L))), az: Math.atan2(_dot(d, w), _dot(d, u)) };
  });
  const rrs = []; for (let rr = 1, k = 0; k < maxRings && rr > 0.05; rr /= phi, k++) rrs.push(rr);
  const rings = rrs.map((rr) => {
    const tt = rr * HALF, ring = [];
    for (let s = 0; s <= samples; s++) {
      const az = (s / samples) * 2 * Math.PI - Math.PI;
      let best = null, bd = 1e9;
      for (const p of pts) { let da = Math.abs(p.az - az); da = Math.min(da, 2 * Math.PI - da); const score = da * 0.25 + Math.abs(p.theta - tt); if (score < bd) { bd = score; best = p; } }
      if (best) ring.push(best.v);
    }
    return ring;
  });
  return { rings, apex: A, center: C, axis, reach: dmax, termAngle: HALF, verts: V };
}

// Fill a verified radial plan as a cloth CAP: offset each concentric ring outward
// from the segment center by `clearance` and hand back a ring-stack the renderer
// meshes (terminator → apex, like the bust dome fill).
export function fillRadialPlan(plan, clearance = 0.06) {
  const c = plan.center;
  if (!c) return [];
  return plan.rings.map((ring) => ({
    center: c,
    polyline: ring.map((v) => { const d = _sub(v, c), L = _len(d) || 1, k = (L + clearance) / L; return { x: c.x + d.x * k, y: c.y + d.y * k, z: c.z + d.z * k }; }),
  }));
}

// Is point p claimed by this segment — inside its terminator cone AND near its
// surface (within reach)? The reach bound stops a wide cone from grabbing the far
// half-space (e.g. the groin cone "claiming" the glutes behind it).
function _claimed(plan, p) {
  const d = _sub(p, plan.center), L = _len(d) || 1;
  if (L > plan.reach * 1.15) return false;
  return Math.acos(Math.max(-1, Math.min(1, _dot(d, plan.axis) / L))) <= plan.termAngle;
}

// SUPERPOSITION test (areal): a body point is superimposed if it falls inside BOTH
// segments' terminator cones (double-covered). Monotonic in `term` — shrinking a
// cap can only reduce overlap. Returns the doubly-claimed points (for highlighting).
export function planSuperposition(planA, planB) {
  const hits = [];
  for (const p of planA.verts || []) if (_claimed(planB, p) && _claimed(planA, p)) hits.push(p);
  for (const p of planB.verts || []) if (_claimed(planA, p) && _claimed(planB, p)) hits.push(p);
  return hits;
}

/**
 * PELVIS BASIN PLAN — ONE structure, sampled radially TOP-DOWN. The full pelvis —
 * diaper (perineum/crotch saddle) + hip vajras (coreSide + lower trunk) + groin +
 * glutes — is wrapped by concentric horizontal cross-section rings around the
 * vertical axis, golden-ratio spaced from the TOP (waist, below the dantien, rr=1)
 * down to the crotch apex (rr→0). Viewed from above the rings are concentric; this
 * is the pelvis basin a trouser fills. Reuses the cross-section field (centroid +
 * angular max radius) so it's robust, then samples it at the golden-ratio heights.
 * @returns {{ rings, apex, center, axis, reach, verts } | null}
 */
export function pelvisPlan(body, { phi = 1.618, sectors = 48, nbands = 30, maxRings = 9, smooth = 2, topZ = null, margin = 0.18, includeLegs = false, hemFrac = 0.5 } = {}) {
  // top of the basin = ABOVE the hip spheres (glute + diaper tops), so the waist
  // terminator sits over them rather than cutting through the hips.
  const zsOf = (id) => { const st = body.find((p) => p.id === id); return st ? st.rings.flatMap((r) => r.polyline.map((p) => p.z)) : [-Infinity]; };
  const hipTopZ = Math.max(...['gluteL', 'gluteR', 'diaper', 'groin'].flatMap(zsOf));
  const waistZ = topZ != null ? topZ : hipTopZ + margin;
  const ids = ['groin', 'diaper', 'coreSideL', 'coreSideR', 'trunk', 'gluteL', 'gluteR'];   // the whole pelvis as ONE structure
  // SKIRT: include the legs so the cross-sections below the hips bridge BOTH legs
  // into a bell (instead of converging to the crotch); hem at `hemFrac` down the leg.
  let hemZ = -Infinity;
  if (includeLegs) {
    ids.push('legL', 'legR');
    const leg = body.find((p) => p.id === 'legL');
    if (leg) { const zs = leg.rings.map((r) => r.center.z), zt = Math.max(...zs), zb = Math.min(...zs); hemZ = zt + (zb - zt) * hemFrac; }
  }
  const V = [];
  for (const id of ids) { const st = body.find((p) => p.id === id); if (!st) continue; for (const rg of st.rings) for (const q of rg.polyline) if (q.z <= waistZ && q.z >= hemZ) V.push(q); }
  if (V.length < 16) return null;
  let zMin = Infinity, zMax = -Infinity;
  for (const q of V) { if (q.z < zMin) zMin = q.z; if (q.z > zMax) zMax = q.z; }
  const top = waistZ === Infinity ? zMax : Math.min(waistZ, zMax), span = top - zMin;
  if (span < 1e-6) return null;
  const band = (z) => Math.min(nbands - 1, Math.max(0, Math.floor((z - zMin) / span * nbands)));
  // per-band centroid (the pelvis axis at each height)
  const cxS = Array(nbands).fill(0), cyS = Array(nbands).fill(0), cN = Array(nbands).fill(0);
  for (const q of V) { const b = band(q.z); cxS[b] += q.x; cyS[b] += q.y; cN[b]++; }
  const cx = cxS.map((s, i) => (cN[i] ? s / cN[i] : 0)), cy = cyS.map((s, i) => (cN[i] ? s / cN[i] : 0));
  for (const ax of [cx, cy]) { for (let i = 1; i < nbands; i++) if (!cN[i]) ax[i] = ax[i - 1]; for (let i = nbands - 2; i >= 0; i--) if (!cN[i]) ax[i] = ax[i + 1]; }
  // angular max-radius field (the outer flesh per band × sector)
  const R = Array.from({ length: nbands }, () => Array(sectors).fill(0));
  for (const q of V) { const b = band(q.z), dx = q.x - cx[b], dy = q.y - cy[b], r = Math.hypot(dx, dy); if (r < 1e-6) continue; let a = Math.atan2(dy, dx); if (a < 0) a += 2 * Math.PI; const sec = Math.min(sectors - 1, Math.floor(a / (2 * Math.PI) * sectors)); if (r > R[b][sec]) R[b][sec] = r; }
  for (let b = 0; b < nbands; b++) { const row = R[b]; if (row.every((v) => v === 0)) continue; for (let j = 0; j < sectors; j++) { if (row[j] > 0) continue; for (let d = 1; d <= sectors; d++) { const lo = row[((j - d) % sectors + sectors) % sectors], hi = row[(j + d) % sectors]; if (lo > 0 || hi > 0) { row[j] = Math.max(lo, hi); break; } } } }
  for (let b = 1; b < nbands; b++) if (R[b].every((v) => v === 0)) R[b] = R[b - 1].slice();
  const sm = R.map((row) => smoothLoop(row, smooth));
  // golden-ratio heights, top (waist, rr=1) → crotch apex (rr→0); concentric rings
  const rings = [];
  for (let rr = 1, k = 0; k < maxRings && rr > 0.03; rr /= phi, k++) {
    const b = Math.min(nbands - 1, Math.max(0, Math.round(rr * (nbands - 1)))), zc = zMin + (b + 0.5) / nbands * span, ring = [];
    for (let s = 0; s <= sectors; s++) { const jj = s % sectors, a = (jj / sectors) * 2 * Math.PI, r = sm[b][jj]; ring.push({ x: cx[b] + Math.cos(a) * r, y: cy[b] + Math.sin(a) * r, z: zc }); }
    rings.push(ring);
  }
  const mid = Math.floor(nbands / 2);
  return { rings, apex: { x: cx[0], y: cy[0], z: zMin }, center: { x: cx[mid], y: cy[mid], z: zMin + span / 2 }, axis: { x: 0, y: 0, z: -1 }, reach: Math.max(...sm.flat()), top: waistZ, bottom: zMin, verts: V };
}

// Fill the pelvis basin: offset each concentric ring outward in its own plane
// (from the ring centroid, z fixed) by `clearance`, and hand back a ring-stack the
// renderer meshes (waist → crotch). This is the trouser pelvis, diaper included.
export function fillPelvisBasin(plan, clearance = 0.08) {
  return plan.rings.map((ring) => {
    const c = ring.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, z: a.z + v.z }), { x: 0, y: 0, z: 0 });
    c.x /= ring.length; c.y /= ring.length; c.z /= ring.length;
    return { center: c, polyline: ring.map((v) => { const dx = v.x - c.x, dy = v.y - c.y, L = Math.hypot(dx, dy) || 1, k = (L + clearance) / L; return { x: c.x + dx * k, y: c.y + dy * k, z: v.z }; }) };
  });
}

/**
 * TORSO BASIN — the pelvis-basin method for tops: the torso (trunk + coreSide +
 * breast/pec + scapula + clavicle + shoulderYoke + dantien) wrapped by concentric
 * horizontal cross-section rings, golden-ratio spaced from the SHOULDER (top, rr=1)
 * down to the hem (`hemFrac` of the torso height). The neck is the open centre of
 * the top ring; `fillBasin` opens the armholes/neck. Same behavioural primitive as
 * the pelvis basin — only the gather + z-range differ.
 * @returns {{ rings, center, top, bottom, verts } | null}
 */
export function torsoPlan(body, { phi = 1.618, sectors = 48, nbands = 30, maxRings = 9, smooth = 2, hemFrac = 0.7, uniform = false } = {}) {
  const ids = ['trunk', 'coreSideL', 'coreSideR', 'breastL', 'breastR', 'pecL', 'pecR', 'scapulaL', 'scapulaR', 'scapBunL', 'scapBunR', 'clavicleL', 'clavicleR', 'shoulderYoke', 'dantien'];
  const all = [];
  for (const id of ids) { const st = body.find((p) => p.id === id); if (st) for (const rg of st.rings) for (const q of rg.polyline) all.push(q); }
  if (all.length < 16) return null;
  let zMax = -Infinity, zMin = Infinity; for (const q of all) { if (q.z > zMax) zMax = q.z; if (q.z < zMin) zMin = q.z; }
  const hemZ = zMax - (zMax - zMin) * hemFrac;
  const V = all.filter((q) => q.z >= hemZ);
  if (V.length < 16) return null;
  const top = zMax, span = top - hemZ; if (span < 1e-6) return null;
  const band = (z) => Math.min(nbands - 1, Math.max(0, Math.floor((z - hemZ) / span * nbands)));
  const cxS = Array(nbands).fill(0), cyS = Array(nbands).fill(0), cN = Array(nbands).fill(0);
  for (const q of V) { const b = band(q.z); cxS[b] += q.x; cyS[b] += q.y; cN[b]++; }
  const cx = cxS.map((s, i) => (cN[i] ? s / cN[i] : 0)), cy = cyS.map((s, i) => (cN[i] ? s / cN[i] : 0));
  for (const ax of [cx, cy]) { for (let i = 1; i < nbands; i++) if (!cN[i]) ax[i] = ax[i - 1]; for (let i = nbands - 2; i >= 0; i--) if (!cN[i]) ax[i] = ax[i + 1]; }
  const R = Array.from({ length: nbands }, () => Array(sectors).fill(0));
  for (const q of V) { const b = band(q.z), dx = q.x - cx[b], dy = q.y - cy[b], r = Math.hypot(dx, dy); if (r < 1e-6) continue; let a = Math.atan2(dy, dx); if (a < 0) a += 2 * Math.PI; const sec = Math.min(sectors - 1, Math.floor(a / (2 * Math.PI) * sectors)); if (r > R[b][sec]) R[b][sec] = r; }
  for (let b = 0; b < nbands; b++) { const row = R[b]; if (row.every((v) => v === 0)) continue; for (let j = 0; j < sectors; j++) { if (row[j] > 0) continue; for (let d = 1; d <= sectors; d++) { const lo = row[((j - d) % sectors + sectors) % sectors], hi = row[(j + d) % sectors]; if (lo > 0 || hi > 0) { row[j] = Math.max(lo, hi); break; } } } }
  for (let b = 1; b < nbands; b++) if (R[b].every((v) => v === 0)) R[b] = R[b - 1].slice();
  const sm0 = R.map((row) => smoothLoop(row, smooth));
  // VERTICAL smooth across bands — dense uniform sampling otherwise terraces into
  // horizontal steps (the per-band radius jumps). 3-tap (not 5) + an ANTI-CLIP floor
  // at the raw outermost flesh, so the smooth flattens terraces but never dips INSIDE
  // a real bulge (the bust) → no poke-through. Skipped for golden-ratio (sparse).
  const sm = uniform
    ? sm0.map((row, b) => row.map((v, j) => { let s = 0, c = 0; for (let k = -1; k <= 1; k++) { const bb = b + k; if (bb >= 0 && bb < nbands) { s += sm0[bb][j]; c++; } } return Math.max(s / c, v); }))
    : sm0;
  const buildRing = (b) => {
    const zc = hemZ + (b + 0.5) / nbands * span, ring = [];
    for (let s = 0; s <= sectors; s++) { const jj = s % sectors, a = (jj / sectors) * 2 * Math.PI, r = sm[b][jj]; ring.push({ x: cx[b] + Math.cos(a) * r, y: cy[b] + Math.sin(a) * r, z: zc }); }
    return ring;
  };
  const rings = [];
  if (uniform) {   // EVEN bands top→hem: dense over the shoulder shelf (no golden-ratio sparse top → the
    const N = Math.max(maxRings, 12);   // cloth surface reaches up to meet the shoulder cap, no flesh band)
    for (let k = 0; k < N; k++) rings.push(buildRing(Math.round((1 - k / (N - 1)) * (nbands - 1))));
  } else {   // golden ratio: shoulder (rr=1, top band) → hem (rr→0)
    for (let rr = 1, k = 0; k < maxRings && rr > 0.03; rr /= phi, k++) rings.push(buildRing(Math.min(nbands - 1, Math.max(0, Math.round(rr * (nbands - 1))))));
  }
  const mid = Math.floor(nbands / 2);
  return { rings, center: { x: cx[mid], y: cy[mid], z: hemZ + span / 2 }, top, bottom: hemZ, verts: V };
}

// Fill a basin (pelvis OR torso). `openTop` scoops the neck (front +y) and armholes
// (sides ±x) near the top ring, ramping clearance to 0 there — the difference
// between a closed shirt and an open vest is just these opening sizes.
export function fillBasin(plan, { clearance = 0.08, openFront = 0, lapelFrac = 1, openParts = [], openMargin = 0.25, coverComps = [], frontComps = null, coverNear = 0.3, coverRamp = 0.16 } = {}) {
  const angDist = (a, t) => { const d = Math.abs(a - t) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
  // openness cover = the WHOLE covered torso (so an armhole/neck never eats the
  // chest/shoulder); front-keep cover = just the chest masses (so the open front
  // still parts at the cleft BETWEEN them).
  const cover = (v) => (coverComps.length ? componentSuperposition(v, coverComps, coverNear, coverRamp) : 0);
  const fComps = frontComps ?? coverComps;
  const frontKeep = (v) => (fComps.length ? componentSuperposition(v, fComps, coverNear, coverRamp) : 0);
  const FRONT = Math.PI / 2, n = plan.rings.length;
  return plan.rings.map((ring, ri) => {
    const c = ring.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, z: a.z + v.z }), { x: 0, y: 0, z: 0 });
    c.x /= ring.length; c.y /= ring.length; c.z /= ring.length;
    let pts = ring;
    // LAPEL taper: the open front is widest at the collar (top, ri=0) and closes by
    // `lapelFrac` of the way down — so an open jacket still covers the chest/torso.
    const tz = n > 1 ? ri / (n - 1) : 0;
    const of = openFront > 0 ? (tz < lapelFrac ? openFront * (1 - tz / lapelFrac) : 0) : 0;
    if (of > 0) {
      // OPEN FRONT: drop the front-centre sector so the ring is an ARC. Keep the cloth
      // where it sits over a CHEST-MASS component → the gap routes between the breasts/
      // pecs (the cleft) and the panels stay ON them, never cutting across one.
      const az = (v) => { let a = Math.atan2(v.y - c.y, v.x - c.x); if (a < 0) a += 2 * Math.PI; return a; };
      pts = ring.slice(0, -1).filter((v) => {
        if (angDist(az(v), FRONT) >= of) return true;   // outside the (tapered) front sector → keep
        return frontKeep(v) > 0.4;   // inside: keep only over a chest mass
      }).sort((a, b) => ((az(a) - FRONT + 2 * Math.PI) % (2 * Math.PI)) - ((az(b) - FRONT + 2 * Math.PI) % (2 * Math.PI)));   // seam at the cleft
    }
    return {
      center: c,
      polyline: pts.map((v) => {
        // PRINCIPLE: a body part has a ROLE. POKE-THROUGH parts (arms→armholes,
        // neck→neckline) open the cloth; COVER components (breast/pec/shoulder) the
        // garment drapes over, so they SUPPRESS openings. openness = poke-through − cover.
        const op = openParts.length ? superposition(v, openParts, openMargin) : 0;
        const clr = clearance * (1 - Math.max(0, op - cover(v)));
        const dx = v.x - c.x, dy = v.y - c.y, L = Math.hypot(dx, dy) || 1, k = (L + clr) / L;
        return { x: c.x + dx * k, y: c.y + dy * k, z: v.z };
      }),
    };
  });
}

// ─── Superposition between a garment map and the limbs/neck ───────────────────
// The torso basin should OPEN where it would superimpose a part that pokes through
// (the arms → armholes, the neck → neckline). Each part is a capsule (centerline +
// mean radius); a cloth point is "claimed" by it when it falls within radius+margin.
// So the openings DERIVE from the body, not from a guessed angle.
const _distSeg = (p, a, b) => {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / ((abx * abx + aby * aby + abz * abz) || 1)));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t), p.z - (a.z + abz * t));
};
export function bodyCapsules(body, ids, { slice = null } = {}) {
  return ids.map((id) => {
    const st = body.find((p) => p.id === id); if (!st || st.rings.length < 2) return null;
    const rs = slice ? sliceRings(st.rings, slice[0], slice[1]) : st.rings;   // e.g. arm[0.25,1] → armhole at the armpit, shoulder stays covered
    if (rs.length < 2) return null;
    const a = rs[0].center, b = rs[rs.length - 1].center;
    let r = 0, n = 0; for (const rg of rs) { const c = rg.center; for (const p of rg.polyline) { r += Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z); n++; } }
    return { id, a, b, r: n ? r / n : 0 };
  }).filter(Boolean);
}
// How strongly point v is superimposed by the parts (0 = clear, 1 = inside) — the
// smooth ramp across `margin` is the opening edge.
export function superposition(v, caps, margin = 0.25) {
  let o = 0;
  for (const cap of caps) { const d = _distSeg(v, cap.a, cap.b); o = Math.max(o, Math.min(1, (cap.r + margin - d) / margin)); }
  return o;
}

// A protrusion the garment COVERS (the breast, a belly) as a sphere at its own
// mass centroid (NOT the ring centers, which sit on the spine for a dome). A cover
// part SUPPRESSES openings over it — the principled dual of a poke-through part.
export function bodySpheres(body, ids) {
  return ids.map((id) => {
    const st = body.find((p) => p.id === id); if (!st) return null;
    const V = st.rings.flatMap((r) => r.polyline); if (V.length < 4) return null;
    const c = V.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, z: a.z + v.z }), { x: 0, y: 0, z: 0 });
    c.x /= V.length; c.y /= V.length; c.z /= V.length;
    let r = 0; for (const v of V) r = Math.max(r, Math.hypot(v.x - c.x, v.y - c.y, v.z - c.z));
    return { id, a: c, b: c, r };
  }).filter(Boolean);
}

// COMPONENT superposition — test against a part's ACTUAL surface (its real
// vertices), not a lumped sphere over its whole mass. A flat pec or a shoulder
// cap isn't a ball; the sphere over-reports "covered" where no cloth sits. Here a
// cloth point counts as over a component only when it's within `near` of that
// component's real surface, ramped over `ramp`.
export function bodyComponents(body, ids) {
  return ids.map((id) => { const st = body.find((p) => p.id === id); return st ? { id, verts: st.rings.flatMap((r) => r.polyline) } : null; }).filter(Boolean);
}
function _nearestVertDist(v, verts) {
  let m = Infinity;
  for (const p of verts) { const dx = v.x - p.x, dy = v.y - p.y, dz = v.z - p.z, d = dx * dx + dy * dy + dz * dz; if (d < m) m = d; }
  return Math.sqrt(m);
}
export function componentSuperposition(v, comps, near = 0.3, ramp = 0.16) {
  let o = 0;
  for (const c of comps) { const d = _nearestVertDist(v, c.verts); o = Math.max(o, Math.min(1, (near - d) / ramp)); }
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOULDER-BASED GARMENTS — the crown-fan cap (codified from the 38/39 spikes).
//
// PRINCIPLES — the garment model distilled (lite-template/integration/0610/figure-garments.plan.md):
//  P1 ONE OP       — a garment surface is the body surface offset outward by a
//                    standoff (mugen). Shrink-to-fit and grow-to-mugen converge.
//  P2 TOPOLOGY     — the offset's SAMPLER follows the part's topology: a TUBE (torso,
//                    limb) → stacked rings; a BALL (the deltoid; later breast/glute/
//                    knee) → a CROWN-FAN from the ball's apex, draped PAST the equator
//                    (term>1) so it OVERLAPS its neighbours. A tube-sampler degenerates
//                    at a ball's crown (no ring on a pole) → the bare-shoulder bug.
//  P3 MUGEN FIELD  — the standoff is not constant. Apparel HANGS from its support
//                    (shoulders for a top), so it is lowest at the support (snug —
//                    gravity sits it down, no football pad), ramps looser toward the
//                    seam, and pushes LATERALLY outward (never up) at the outer edge.
//  P4 COMPOSITION  — a garment is a set of region components (torso, shoulder caps,
//                    sleeves…), each a sampler+offset. OMIT the cap → a shoulderless
//                    garment (tank/tube/strapless) falls out for free.
//  P5 ROLES        — coverage under-colours; openings = poke-through − cover.

// The whole shoulder MASS a cap wraps: deltoid (upper-arm crown) + the trapezius
// shelf (yoke, this side) + clavicle (front) + scapula (back). Gathering all four
// carries the cap inboard to the collar and round the joint — the deltoid alone seals
// only the crown and leaves the trapezius notch (spike 38 → 39).
function shoulderMassVerts(body, side) {
  const sgn = side === 'L' ? -1 : 1, verts = [];
  const ua = body.find((p) => p.id === 'upperArm' + side);
  if (ua) for (const rg of ua.rings.slice(0, Math.max(3, Math.ceil(ua.rings.length * 0.45)))) for (const v of rg.polyline) verts.push(v);
  const sy = body.find((p) => p.id === 'shoulderYoke'); if (sy) for (const rg of sy.rings) for (const v of rg.polyline) if (sgn * v.x > 0.04) verts.push(v);
  for (const id of ['clavicle' + side, 'scapula' + side]) { const st = body.find((p) => p.id === id); if (st) for (const rg of st.rings) for (const v of rg.polyline) verts.push(v); }
  return verts;
}

// P2 — crown-fan over a ball: concentric latitude rings from the terminator (term·90°
// off the up-axis, outermost) up to the apex on the crown. UNIFORM latitude + dense
// azimuth → maps the ball evenly. Returns rings of points + the ball centre/R.
export function crownFanCap(verts, { samples = 96, maxRings = 16, term = 1.5 } = {}) {
  if (verts.length < 8) return { rings: [], center: null, R: 0 };
  const center = verts.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, z: a.z + v.z }), { x: 0, y: 0, z: 0 });
  center.x /= verts.length; center.y /= verts.length; center.z /= verts.length;
  let R = 0; for (const v of verts) R += Math.hypot(v.x - center.x, v.y - center.y, v.z - center.z); R = (R / verts.length) || 0.05;
  const HALF = (Math.PI / 2) * term, rings = [];
  for (let k = 0; k <= maxRings; k++) {   // k=0 terminator (outermost) → k=max apex (crown)
    const theta = (1 - k / maxRings) * HALF, ct = Math.cos(theta), st = Math.sin(theta), ring = [];
    for (let s = 0; s <= samples; s++) { const a = (s / samples) * 2 * Math.PI; ring.push({ x: center.x + R * st * Math.cos(a), y: center.y + R * st * Math.sin(a), z: center.z + R * ct }); }
    rings.push(ring);
  }
  return { rings, center, R };
}

// P3 — apply the MUGEN FIELD to a shoulder crown-fan, returning renderer-ready
// ring-stacks ({center, polyline}, center = the ball centre so normals face out).
// Gravity ramp: `crownGap` (snug) at the apex → `seamGap` (the torso/sleeve standoff)
// at the terminator. Lateral push: the outermost L/R eased OUT in world ±x by
// `lateralGap` (default halfway between crown and seam) — a translation, so it only
// widens, never grows toward the zenith.
export function buildShoulderCap(body, side, { crownGap = 0.05, seamGap = 0.18, lateralGap = null, samples = 96, maxRings = 16, term = 1.5 } = {}) {
  const cap = crownFanCap(shoulderMassVerts(body, side), { samples, maxRings, term });
  if (!cap.center) return null;
  const c = cap.center, sgnOut = c.x < 0 ? -1 : 1, lat = lateralGap == null ? (crownGap + seamGap) / 2 : lateralGap, n = cap.rings.length;
  const rings = cap.rings.map((ring, i) => {
    const t = n > 1 ? i / (n - 1) : 1;                 // 0 = terminator (seam) → 1 = crown
    const gap = seamGap + (crownGap - seamGap) * t;     // gravity ramp
    const polyline = ring.map((v) => {
      const dx = v.x - c.x, dy = v.y - c.y, dz = v.z - c.z, L = Math.hypot(dx, dy, dz) || 1, k = (L + gap) / L;
      const p = { x: c.x + dx * k, y: c.y + dy * k, z: c.z + dz * k };
      const out = Math.min(1, Math.max(0, (dx * sgnOut) / (cap.R || 1)));   // lateral push (never up)
      p.x += sgnOut * lat * out;
      return p;
    });
    return { center: c, polyline };
  });
  return { id: 'shoulder' + side, rings };
}

// P4 — joined sleeve: ONE continuous tube from the upper arm (sliced below the deltoid
// ball) through the forearm to the wrist — no elbow cut — offset to `thickness` mugen.
export function buildSleeve(body, side, { thickness = 0.06, headSlice = 0.15, coverForearm = true } = {}) {
  const ua = body.find((p) => p.id === 'upperArm' + side);
  const fa = coverForearm ? body.find((p) => p.id === 'forearm' + side) : null;   // false → full-bicep sleeve, ends at the elbow
  const stack = [];
  if (ua) stack.push(...ua.rings.slice(Math.max(1, Math.floor(ua.rings.length * headSlice))));
  if (fa) stack.push(...fa.rings);
  if (stack.length < 2) return null;
  return { id: 'sleeve' + side, rings: inflateRings(stack, thickness) };
}

// ─────────────────────────────────────────────────────────────────────────────
// SVGILE-ROW — the red-line CUTTER. A first-class fabric DELETER: it removes the
// cloth whose point falls inside a body-relative region and leaves EVERYTHING
// outside the mesh untouched. Face-level deletion (drop a face if its centroid is
// inside a cut) — no re-mesh, no distortion, so cuts COMPOSE and outside stays
// bit-identical. The region kinds resolve against the given body's own frame
// (sagittal x=0, front +y), so ONE cut carves any protoform. The boundary the cut
// leaves IS the red-line (the seam). This is the "cut" act of measure→pattern→cut.

// Is point p inside a RESOLVED (absolute) cut region?
export function cutHits(p, cut) {
  switch (cut.kind) {
    case 'wedge': {   // azimuthal slice about the front — the open front / a vent / a slit
      if (p.z < cut.zLo || p.z > cut.zHi) return false;
      let a = Math.atan2(p.y - cut.cy, p.x - cut.cx); if (a < 0) a += 2 * Math.PI;
      const d = Math.abs(a - cut.front) % (2 * Math.PI), ad = Math.min(d, 2 * Math.PI - d);
      const tz = cut.zHi > cut.zLo ? (p.z - cut.zLo) / (cut.zHi - cut.zLo) : 1;   // 0 hem → 1 collar
      const half = cut.taper ? cut.halfAngle * (1 - cut.taper * (1 - tz)) : cut.halfAngle;   // narrows toward the hem if tapered (a lapel)
      return ad < Math.max(0, half);
    }
    case 'band':      return p.z >= cut.zLo && p.z <= cut.zHi;                                  // horizontal slab — hem / crop / midriff
    case 'capsule':   return _distSeg(p, cut.a, cut.b) < cut.r;                                 // around a limb centerline — armhole / leg-hole
    case 'hole':      return Math.hypot(p.x - cut.c.x, p.y - cut.c.y, p.z - cut.c.z) < cut.r;   // round hole — neck / pocket
    case 'halfspace': return (p.x - cut.o.x) * cut.n.x + (p.y - cut.o.y) * cut.n.y + (p.z - cut.o.z) * cut.n.z > 0;   // a straight cut
    case 'all': return true;   // the whole panel — for per-panel MATERIAL, not deletion
    default: return false;
  }
}
// Face-delete predicate: a face (centroid as [x,y,z] or {x,y,z}) is removed if it
// is inside ANY cut. Hand this to the mesher's `skip`.
export function cutPredicate(cuts) {
  return (c) => { const p = Array.isArray(c) ? { x: c[0], y: c[1], z: c[2] } : c; return cuts.some((cut) => cutHits(p, cut)); };
}
// Resolve BODY-RELATIVE cut declarations (on a spec) into absolute regions, measured
// from the built garment's own geometry — so the same declaration carves any body.
// z anchors: 'collar'/'top' = the garment top, 'hem'/'bottom' = the garment bottom,
// a number in [0,1] = that fraction up from the hem. Front is the body's +y.
export function resolveCuts(decls, pieces, body = null) {
  let cy = 0, n = 0, zMin = Infinity, zMax = -Infinity;
  for (const g of pieces) for (const r of g.rings) for (const v of r.polyline) { cy += v.y; n++; if (v.z < zMin) zMin = v.z; if (v.z > zMax) zMax = v.z; }
  cy = n ? cy / n : 0;
  const zAt = (k, dflt) => k == null ? dflt : (k === 'collar' || k === 'top') ? zMax : (k === 'hem' || k === 'bottom') ? zMin : zMin + (zMax - zMin) * k;
  const meanR = (st) => { let s = 0, m = 0; for (const rg of st.rings) for (const v of rg.polyline) { s += Math.hypot(v.x - rg.center.x, v.y - rg.center.y, v.z - rg.center.z); m++; } return m ? s / m : 0.05; };
  const sliceCenters = (st, t0, t1) => { const k = st.rings.length - 1; return [st.rings[Math.round(t0 * k)].center, st.rings[Math.round(t1 * k)].center]; };
  return (decls || []).map((d) => {
    const on = d.on;   // panel target — preserved on the resolved cut
    if (d.kind === 'wedge') return { kind: 'wedge', cx: 0, cy, front: Math.PI / 2, halfAngle: d.halfAngle ?? 0.6, zLo: zAt(d.to, zMin), zHi: zAt(d.from, zMax), taper: d.taper ?? 0, on };
    if (d.kind === 'band') return { kind: 'band', zLo: zAt(d.lo, zMin), zHi: zAt(d.hi, zMax), on };
    // BODY-RELATIVE openings — the neck and armholes resolve to capsules around the
    // body part, so the cutter (not fillBasin superposition) carves them. `on:'torso'`
    // scopes them to the torso panel, so they never eat the sleeve/cap.
    if (d.kind === 'neck') { const st = body && body.find((p) => p.id === 'neck'); if (!st) return null; const [a, b] = sliceCenters(st, 0, 1); return { kind: 'capsule', a, b, r: meanR(st) + (d.margin ?? 0.06), on: on ?? 'torso' }; }
    if (d.kind === 'armhole') { const st = body && body.find((p) => p.id === 'upperArm' + d.side); if (!st) return null; const [a, b] = sliceCenters(st, 0, d.depth ?? 0.5); return { kind: 'capsule', a, b, r: meanR(st) + (d.margin ?? 0.07), on: on ?? 'torso' }; }
    return { ...d, on };   // capsule/hole/halfspace declared in absolute form
  }).filter(Boolean);
}

// RED-LINE — the seam a cut leaves. Generic over cut kinds: walk the garment's quad
// mesh and emit every edge that separates KEPT cloth from CUT cloth. That set IS the
// cut's boundary (the literal red line) — front lapels, neckline, armholes — as 3D
// segments [p,q] a renderer projects and strokes. Each segment carries the kept
// quad's outward `n` + centroid `c` so the renderer can back-face cull it (no seams
// bleeding through from the far side).
export function cutBoundary(rings, cuts) {
  const hit = (p) => cuts.some((c) => cutHits(p, c));
  const cen4 = (a, b, j) => ({ x: (a[j].x + a[j + 1].x + b[j + 1].x + b[j].x) / 4, y: (a[j].y + a[j + 1].y + b[j + 1].y + b[j].y) / 4, z: (a[j].z + a[j + 1].z + b[j + 1].z + b[j].z) / 4 });
  const N = rings.length, status = [];
  for (let i = 0; i < N - 1; i++) { const a = rings[i].polyline, b = rings[i + 1].polyline, m = Math.min(a.length, b.length), row = []; for (let j = 0; j < m - 1; j++) row.push(hit(cen4(a, b, j))); status.push(row); }
  const segs = [];
  for (let i = 0; i < N - 1; i++) {
    const a = rings[i].polyline, b = rings[i + 1].polyline, m = Math.min(a.length, b.length), c = rings[i].center;
    for (let j = 0; j < m - 1; j++) {
      if (status[i][j]) continue;   // boundary recorded from the KEPT side only (status=false)
      const quad = cen4(a, b, j);
      let nx = (a[j + 1].y - a[j].y) * (b[j].z - a[j].z) - (a[j + 1].z - a[j].z) * (b[j].y - a[j].y);   // rough quad normal
      let ny = (a[j + 1].z - a[j].z) * (b[j].x - a[j].x) - (a[j + 1].x - a[j].x) * (b[j].z - a[j].z);
      let nz = (a[j + 1].x - a[j].x) * (b[j].y - a[j].y) - (a[j + 1].y - a[j].y) * (b[j].x - a[j].x);
      if (nx * (quad.x - c.x) + ny * (quad.y - c.y) + nz * (quad.z - c.z) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const n = { x: nx, y: ny, z: nz };
      if (j + 1 < status[i].length && status[i][j + 1]) segs.push({ p: a[j + 1], q: b[j + 1], n, c: quad });   // right edge meets a cut quad
      if (i + 1 < status.length && j < status[i + 1].length && status[i + 1][j]) segs.push({ p: b[j], q: b[j + 1], n, c: quad });   // bottom edge meets a cut quad
    }
  }
  return segs;
}
