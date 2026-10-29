/**
 * BODY-RELATIONAL TAILOR — the realistic body's CONSTRUCTION, the primitives every garment there is made of, so a
 * garment is a choice of them and its numbers, not a module of its own. Each a pure function; none knows a garment.
 *
 *   the BLOCK     a garment's cloth over the body's parts: body-relational-garment.js `fieldGarment` (not here)
 *   RUNS          `oneTube` two pieces one tube along a run, each point's weights its own piece's
 *   PROFILES      `drapeRun` down a limb's run: the FALL (`slack`, `taper`), the FOLDS, a FLARE, the BLOUSE over a
 *                 gathered CUFF, the MIDLINE; `flareRun` a piece widened from one end to the other; `fairRun` a
 *                 run's radii smoothed along it; `bridgeRun` its hollows bridged; `carrySkirt` a skirt carried down
 *                 from a trunk tube's lowest ring; `clearanceOver` how far out what is under the cloth reaches, ray by ray
 *   SHAPE         `squareShoulders` a pad's straight line, `takeIn` a waist suppressed, `fallStraight` a sack's
 *   FRONTS        `cutV` a jacket's V onto the shirt, `cutOpening` its quarters, `lapelBand` its lapels and collar
 *                 as one band (and a front's edge), `buttonOn`, `bladeOn` a tie, `clearOver` cloth carried over it
 *   EDGES         `fallToFloor` an open hem carried down over the foot; `turnHemIn` a tube's hem folded back in to the
 *                 limb (so it opens, no lid)
 *   TRIMS         `collarOn` (a stand collar up the neck from a garment's top ring), `bandAt` (a belt, a cuff: caps
 *                 weighted as their rings), `strapBand` (a strap at a station's `u`),
 *                 `sashOn` (a band, a knot, two tails), `strip` (a box section through centres), `ribbon` (a band lying
 *                 on the cloth along a path: a collar, a lapel, a panel's edge), `soleSlab`, `buckleOn`
 *   BINDS         `bindNearest` (each point the nearest's weights; with `soleSlab`, `strapBand`, `buckleOn` the footwear
 *                 library's, lib/graph/footwear/parts.js, re-exported), `bindRibbon` (a station's corners one weight),
 *                 `ringW` (a ring's weights mixed: a cap's)
 *
 * The garments: body-relational-drape.js (the wide trousers), body-relational-gi.js (the gi's jacket),
 * body-relational-footwear.js (boots, shoes, sandals). Deterministic; no dice.
 */
import { ringSlots, mixW, four } from './body-relational-resample.js';
import { bindNearest } from '../footwear/parts.js';
// (the binds and the footwear's pieces the wearable libraries share: one copy, the footwear library's)
export { bindNearest, soleSlab, strapBand, buckleOn } from '../footwear/parts.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (v) => Math.hypot(...v);
const unitv = (v) => { const l = len(v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ease3 = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

// RUNS

/** ONE TUBE of two pieces in order along a run (a thigh and a shank; an upper arm and a forearm; a pelvis and a torso):
 * the first's rings down to where the second's begin, then the second's, taken round at the first's slots (a point at
 * the same share of the turn, between its two slots there); every point's weights its own piece's (a station's or a
 * point's blend, else its bone), mixed between the two slots it lies between. (The names are the leg's, where it was
 * first made.) */
export function oneTube(thigh, shank) {
  const slots = thigh.slots, N = slots.length, M = shank.slots.length;
  const mid = (P, st) => mean(P.slots.map((sl) => st.points[sl])), start = mid(shank, shank.stations[0]);
  const t0 = mid(thigh, thigh.stations[0]), reach = len(sub(start, t0));
  const keep = thigh.stations.filter((st) => len(sub(mid(thigh, st), t0)) < reach - 1e-6);
  const weightOf = (P, st, sl) => P.bind?.blend?.[`${st.id}.${sl}`] ?? P.bind?.blend?.[st.id] ?? { [P.bind.bone]: 1 };
  const mix = (a, b, f) => { const w = {}; for (const [k, v] of Object.entries(a)) w[k] = (w[k] ?? 0) + v * (1 - f); for (const [k, v] of Object.entries(b)) w[k] = (w[k] ?? 0) + v * f;
    const top = Object.entries(w).filter(([, v]) => v > 1e-9).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 4), sum = top.reduce((t, [, v]) => t + v, 0);
    return Object.fromEntries(top.map(([k, v]) => [k, r6(v / sum)])).valueOf(); };
  const fix = (w) => { const e = Object.entries(w), sum = e.reduce((t, [, v]) => t + v, 0), d = r6(1 - sum); if (e.length && d) e[0][1] = r6(e[0][1] + d); return Object.fromEntries(e); };
  const stations = [], blend = {};
  // (the stations renumbered st0 … in order down the leg: the bind reads a point's station by that form)
  for (const st of keep) { const id = `st${stations.length}`; stations.push({ ...st, id }); for (const sl of slots) blend[`${id}.${sl}`] = weightOf(thigh, st, sl); }
  for (const st of shank.stations) {
    const id = `st${stations.length}`, points = {};
    slots.forEach((sl, j) => {
      const f = (j * M) / N, a = Math.floor(f) % M, b = (a + 1) % M, t = f - Math.floor(f), A = st.points[shank.slots[a]], B = st.points[shank.slots[b]];
      points[sl] = A.map((x, k) => r6(x + (B[k] - x) * t));
      blend[`${id}.${sl}`] = fix(mix(weightOf(shank, st, shank.slots[a]), weightOf(shank, st, shank.slots[b]), t));
    });
    stations.push({ id, u: st.u, points });
  }
  const capW = (P, k) => P.bind?.blend?.[k] ?? { [P.bind.bone]: 1 };
  blend.back = capW(thigh, 'back'); blend.tip = capW(shank, 'tip');
  return { ...thigh, slots, stations, caps: { back: thigh.caps.back, tip: shank.caps.tip }, bind: { bone: thigh.bind.bone, blend } };
}

// PROFILES

/** the FALL, the MIDLINE, the FOLDS and the HEM down one limb's pieces in order (a thigh's and a shank's, an upper arm's
 * and a forearm's), in place */
export function drapeRun(pieces, side, F) {
  const rings = pieces.flatMap((P) => P.stations.map((st) => ({ P, st })));
  // (each ring's middle and its run down the leg; the hem's run from the leg's end)
  const C = rings.map(({ P, st }) => mean(P.slots.map((sl) => st.points[sl]))), L = [0];
  for (let i = 1; i < rings.length; i++) L.push(L[i - 1] + len(sub(C[i], C[i - 1])));
  const end = L[L.length - 1];
  // (the ring above's radius at the same share of the turn: the thigh's and the shank's rings have their own slots)
  let prev = null; const above = (j, N) => prev[Math.round((j * prev.length) / N) % prev.length];
  rings.forEach(({ P, st }, i) => {
    const c = C[i], fromEnd = end - L[i];
    const slack = F.slack * ease3(L[i] / 0.12);
    const N = P.slots.length, radii = P.slots.map((sl, j) => {
      const p = st.points[sl], d = unitv(sub(p, c)), r = len(sub(p, c));
      // the fall: its own (and the slack), or the ring above's let down by the taper
      const Rf = Math.max(r + slack, prev ? above(j, N) - F.taper * (L[i] - L[i - 1]) : 0);
      let Rj = Rf;
      // the hem: the blouse bunched out over the cuff, the cuff gathered back to the skin's ease
      const over = fromEnd - (F.cuffLen ?? 0), falls = F.hem === 'fall';
      if (!falls && over < F.blouseLen && over > 0) Rj += F.blouse * Math.sin(Math.PI * (1 - over / F.blouseLen));
      const cuff = falls ? 0 : 1 - ease3((fromEnd - F.cuffLen * 0.5) / (F.cuffLen * 0.8));
      if (cuff > 0) Rj += (r + F.cuffEase - Rj) * cuff;
      // the folds, round the ring, deeper toward the hem (none in the cuff)
      const deep = (0.35 + 0.65 * ease3(L[i] / end)) * (1 - cuff);
      Rj += F.fold * deep * Math.sin((2 * Math.PI * F.folds * j) / N + 0.7 * side);
      // (a sleeve's FLARE: wider toward its hem)
      if (F.flare) Rj += F.flare * ease3(L[i] / end);
      // the midline: the inner side held off the body's middle plane, never inside the skin; at the crotch, where the
      // thigh's own skin reaches the plane, the plane wins (the cloth tucks under skin hidden between the legs)
      if (d[0] * side < -1e-6) {
        const off = (m) => (c[0] * side - m) / (-d[0] * side);
        Rj = Math.min(Rj, Math.max(r + 0.002, off(F.margin)), off(F.margin * 0.75));
      }
      return { d, Rj, Rf };
    });
    for (const [j, sl] of P.slots.entries()) st.points[sl] = c.map((x, k) => r6(x + radii[j].d[k] * radii[j].Rj));
    // (the fall alone is let down the leg: the folds, the blouse and the cuff are each ring's own)
    prev = radii.map((x) => x.Rf);
  });
  // (each piece's caps a third of its end ring's radius on beyond it, as the garment's own are)
  for (const P of pieces) {
    const mid = (st) => mean(P.slots.map((sl) => st.points[sl])), rad = (st) => { const c = mid(st); return P.slots.reduce((a, sl) => a + len(sub(st.points[sl], c)), 0) / P.slots.length; };
    const cap = (st, nb) => { const c = mid(st), u = unitv(sub(c, mid(nb))); return c.map((x, k) => r6(x + (u[k] * rad(st)) / 3)); };
    const S0 = P.stations;
    P.caps = { back: cap(S0[0], S0[1]), tip: cap(S0[S0.length - 1], S0[S0.length - 2]) };
  }
}

/** how far out the points `below` (what a garment is worn over) reach from a ring's middle `c`, ray by ray: a function of
 * a horizontal direction, the farthest within 25 mm of the ray and 20 mm of the ring's height (0 when none) */
export function clearanceOver(below, band = 0.02) {
  return (c) => { const near = below.filter((q) => Math.abs(q[2] - c[2]) < band); return (dh) => { let m = 0; for (const q of near) { const vx = q[0] - c[0], vy = q[1] - c[1], pr = vx * dh[0] + vy * dh[1]; if (pr > m && Math.abs(vx * dh[1] - vy * dh[0]) < 0.025) m = pr; } return m; }; };
}

/** THE WAISTBAND's zone on a trunk piece `P`, its rings from its station `from` up (the band): { zw, zb, zt } the hips'
 * widest ring below it (the piece's own widest), the band's foot and its top; null when no ring is in the band */
export function waistbandOf(P, from) {
  const C = P.stations.map((st) => mean(P.slots.map((sl) => st.points[sl]))), R = P.stations.map((st, i) => P.slots.reduce((t, sl) => t + Math.hypot(st.points[sl][0] - C[i][0], st.points[sl][1] - C[i][1]), 0) / P.slots.length);
  const band = C.filter((_, i) => (P.stations[i].u ?? -Infinity) >= from - 1e-9).map((c) => c[2]);
  if (!band.length) return null;
  const zb = Math.min(...band), below = C.map((c, i) => [c[2], R[i]]).filter(([z]) => z < zb);
  return { zw: below.length ? below.reduce((x, y) => (y[1] > x[1] ? y : x))[0] : zb, zb, zt: Math.max(...band) };
}
/** THE WAISTBAND CINCHED: `P`'s rings in the band (`zone`, waistbandOf's: from its foot to its top) brought in onto what
 * is worn under them (`under`: the skin's points and the layers before it) a hair off (`gap`), never into it; below, eased
 * back to where they stood by the hips' widest; above (a tucked layer's, `above` m), eased back out as it leaves the
 * band. What is under is read within `band` m of each ring's height (the hips widening below are not the waist's).
 * A layer tucked under a waistband is cinched with it: each in the order worn, then the band over them. In place */
export function cinchWaist(P, under, { zw, zb, zt }, { gap = 0.002, above = 0.03, band = 0.006 } = {}) {
  const C = P.stations.map((st) => mean(P.slots.map((sl) => st.points[sl]))), need = clearanceOver(under, band);
  P.stations.forEach((st, i) => {
    const z = C[i][2], w = z < zb ? ease3((z - zw) / Math.max(1e-6, zb - zw)) : z > zt ? 1 - ease3((z - zt) / above) : 1;
    if (w <= 0) return;
    const reach = need(C[i]);
    for (const sl of P.slots) {
      const p = st.points[sl], h = [p[0] - C[i][0], p[1] - C[i][1]], r = Math.hypot(...h), d = [h[0] / (r || 1), h[1] / (r || 1), 0], under = reach(d), to = under + gap;
      // (nothing read under it there: left as it stands, never drawn to the axis)
      if (under > 0 && to < r) st.points[sl] = [C[i][0] + d[0] * (r + (to - r) * w), C[i][1] + d[1] * (r + (to - r) * w), p[2]].map(r6);
    }
  });
  return P;
}

/** a FLARE along a piece's run: each ring's points `a` (m) out from its middle at its first station, `b` at its last,
 * in between by its share of the run; its caps a third of the end ring's radius on beyond it again. In place */
export function flareRun(P, [a, b]) {
  if (!a && !b) return P;
  const S = P.stations, C = S.map((st) => mean(P.slots.map((sl) => st.points[sl]))), L = [0];
  for (let i = 1; i < S.length; i++) L.push(L[i - 1] + len(sub(C[i], C[i - 1])));
  const end = L[L.length - 1] || 1;
  S.forEach((st, i) => { const f = a + (b - a) * (L[i] / end); for (const sl of P.slots) { const p = st.points[sl], d = unitv(sub(p, C[i])); st.points[sl] = add(p, scl(d, f)).map(r6); } });
  const rad = (i) => P.slots.reduce((t, sl) => t + len(sub(S[i].points[sl], C[i])), 0) / P.slots.length, n = S.length - 1;
  P.caps = { ...P.caps, back: add(C[0], scl(unitv(sub(C[0], C[1])), rad(0) / 3)).map(r6), tip: add(C[n], scl(unitv(sub(C[n], C[n - 1])), rad(n) / 3)).map(r6) };
  return P;
}

/** a run FAIRED: each slot's radius off its ring's middle smoothed along the run (a [1, 2, 1] kernel, `passes` times),
 * its first and last `keep` rings held, so a step where two pieces were joined (two limbs' cloth meeting at the elbow)
 * eases out. In place */
export function fairRun(P, { passes = 2, keep = 1 } = {}) {
  const S = P.stations, n = S.length; if (n < 2 * keep + 1) return P;
  const C = S.map((st) => mean(P.slots.map((sl) => st.points[sl])));
  const D = S.map((st, i) => Object.fromEntries(P.slots.map((sl) => [sl, unitv(sub(st.points[sl], C[i]))])));
  let R = S.map((st, i) => Object.fromEntries(P.slots.map((sl) => [sl, len(sub(st.points[sl], C[i]))])));
  for (let it = 0; it < passes; it++) R = R.map((r, i) => (i < keep || i >= n - keep ? r : Object.fromEntries(P.slots.map((sl) => [sl, (R[i - 1][sl] + 2 * r[sl] + R[i + 1][sl]) / 4]))));
  S.forEach((st, i) => { if (i >= keep && i < n - keep) for (const sl of P.slots) st.points[sl] = add(C[i], scl(D[i][sl], R[i][sl])).map(r6); });
  return P;
}

/** a run BRIDGED, as cloth lies over the hollows between what it rests on: each slot's radius off its ring's middle
 * lifted to its neighbours' mean wherever it is less, along the run (between the deltoid and the biceps, at the elbow)
 * and (`around`) round each ring, `passes` times; its first and last `keep` rings held, and any ring outside `range`
 * or point `hold` names. Never inward, so the cloth stays clear of the peaks it rests on. In place */
export function bridgeRun(P, { passes = 4, keep = 1, range = null, around = true, hold = null } = {}) {
  const S = P.stations, n = S.length, N = P.slots.length; if (n < 2 * keep + 1) return P;
  const C = S.map((st) => mean(P.slots.map((sl) => st.points[sl])));
  const D = S.map((st, i) => P.slots.map((sl) => unitv(sub(st.points[sl], C[i])))), R = S.map((st, i) => P.slots.map((sl) => len(sub(st.points[sl], C[i]))));
  // (`range` [zLo, zHi] the rings it may lift; `around` false along the run only; `hold(i, j)` a point left as it is)
  const free = (i, j) => i >= keep && i < n - keep && (!range || (C[i][2] >= range[0] && C[i][2] <= range[1])) && !(hold && hold(i, j));
  for (let it = 0; it < passes; it++) for (let i = keep; i < n - keep; i++) for (let j = 0; j < N; j++) if (free(i, j)) R[i][j] = Math.max(R[i][j], (R[i - 1][j] + R[i + 1][j]) / 2, around ? (R[i][(j + N - 1) % N] + R[i][(j + 1) % N]) / 2 : 0);
  S.forEach((st, i) => P.slots.forEach((sl, j) => { if (free(i, j)) st.points[sl] = add(C[i], scl(D[i][j], R[i][j])).map(r6); }));
  return P;
}

/** a SKIRT carried down from a trunk tube's lowest ring (its stations bottom-up) to `zHem`: a ring every `step`, each the
 * lowest ring let down, every slot out to the larger of the ring's own reach widened by `flare` (m at the hem, by the
 * share of the drop), what is under it (`needAt(c)(direction)`: the trousers, the legs) `clear` over it, and its reach
 * on the ring above (never narrowing below the hips), a dent between its neighbours bridged; each slot's
 * weights the lowest ring's, the thigh's shared in toward each side and down (`thigh` of it at the hem, so a stride
 * carries the skirt's front with the leg); `u` below the tube's first by `span` over the drop, so what finds a station by
 * its `u` still does. The HEM TURNED: with `zTurn`, a ring a quarter of the hem's up inside at that height (the crotch),
 * so the hem is an edge and the skirt open beneath, the cap's pole back toward the opening, the tube then run top-down
 * (its stations and caps reversed); else the hem's cap a third of its radius under it. A new tube */
export function carrySkirt(P, { zHem, flare = 0, clear = 0.008, needAt = null, thigh = 0.55, step = 0.025, span = 1, zTurn = null }) {
  const S = P.stations, base = S[0], slots = P.slots, c0 = mean(slots.map((sl) => base.points[sl])), z0 = c0[2];
  if (!(zHem < z0 - 0.01)) return P;
  const n = Math.max(2, Math.ceil((z0 - zHem) / step)), own = { [P.bind.bone]: 1 }, wOf = (sl) => P.bind.blend?.[`${base.id}.${sl}`] ?? P.bind.blend?.[base.id] ?? own;
  const rings = [], blend = { ...(P.bind.blend || {}) }, held = {};
  // (from the waist down, each slot's reach never less than the ring above's: cloth falls from the hips' widest, it does
  // not follow the legs back in)
  for (let k = 1; k <= n; k++) {
    const f = k / n, dz = (z0 - zHem) * f, c = [c0[0], c0[1], z0 - dz], need = needAt ? needAt(c) : null, id = `stSkirt${n - k}`, points = {};
    const D = {}, Rs = slots.map((sl) => { const p = base.points[sl], h = [p[0] - c0[0], p[1] - c0[1], 0], d = D[sl] = unitv(h); return Math.max(len(h) + flare * f, need ? need(d) + clear : 0, held[sl] ?? 0); });
    // (and across the ring the hollows between what it rests on bridged, as cloth is: a dent lifted to its neighbours' mean)
    const N = slots.length; for (let it = 0; it < 3; it++) for (let j = 0; j < N; j++) Rs[j] = Math.max(Rs[j], (Rs[(j + N - 1) % N] + Rs[(j + 1) % N]) / 2);
    for (const [j, sl] of slots.entries()) {
      const p = base.points[sl], d = D[sl], Rr = held[sl] = Rs[j];
      points[sl] = [c[0] + d[0] * Rr, c[1] + d[1] * Rr, p[2] - dz].map(r6);
      blend[`${id}.${sl}`] = four(mixW(wOf(sl), { [`thigh${p[0] >= 0 ? 'R' : 'L'}`]: 1 }, thigh * ease3((Math.abs(p[0]) - 0.02) / 0.06) * f));
    }
    rings.unshift({ id, u: r6((base.u ?? 0) - span * f), points });
  }
  const hem = rings[0], hc = mean(slots.map((sl) => hem.points[sl])), hr = slots.reduce((t, sl) => t + len(sub(hem.points[sl], hc)), 0) / slots.length;
  if (zTurn !== null && zTurn > zHem + 0.02 && zTurn < z0) {
    const lc = [hc[0], hc[1], zTurn], id = 'stSkirtLining', points = Object.fromEntries(slots.map((sl) => [sl, add(lc, scl(sub(hem.points[sl], hc), 0.25)).map(r6)]));
    // (the tube run top-down, the lining last: the loft winds a tube by its first band, which a fold first would turn)
    for (const sl of slots) blend[`${id}.${sl}`] = wOf(sl);
    const { back: _b, tip, ...rest } = blend;
    return { ...P, stations: [...S.slice().reverse(), ...rings.slice().reverse(), { id, u: r6(hem.u - 0.01), points }],
      caps: { back: P.caps?.tip, tip: add(lc, scl(unitv(sub(hc, lc)), (hr * 0.25) / 3)).map(r6) },
      bind: { ...P.bind, blend: { ...rest, ...(tip ? { back: tip } : {}), tip: ringW(Object.fromEntries(slots.map((sl) => [sl, wOf(sl)]))) } } };
  }
  blend.back = ringW(Object.fromEntries(slots.map((sl) => [sl, blend[`${hem.id}.${sl}`]])));
  return { ...P, stations: [...rings, ...S], caps: { ...P.caps, back: [hc[0], hc[1], hc[2] - hr / 3].map(r6) }, bind: { ...P.bind, blend } };
}

// EDGES

/** the HEM FALLING: below the leg's last ring, rings dropped straight down to `floor` over the ground, each point no
 * lower than the foot under it (a few millimetres over its top), the last ring's radius carried; their weights the last
 * ring's (the cloth hangs from the ankle) */
export function fallToFloor(leg, recipe, S, F) {
  const foot = ['foot', 'toes'].flatMap((k) => (recipe.parts[`${k}${S}`]?.stations || []).flatMap((st) => Object.values(st.points)));
  const ground = Math.min(...foot.map((p) => p[2])), last = leg.stations[leg.stations.length - 1], slots = leg.slots;
  const over = (p) => foot.reduce((m, q) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.015 ? Math.max(m, q[2] + 0.006) : m), ground + F.floor);
  const zs = slots.map((sl) => last.points[sl][2]), stations = [...leg.stations], blend = { ...leg.bind.blend };
  for (const f of [0.5, 1]) {
    const id = `st${stations.length}`, points = Object.fromEntries(slots.map((sl, j) => { const p = last.points[sl], z = zs[j] + (ground + F.floor - zs[j]) * f; return [sl, [p[0], p[1], r6(Math.max(z, over(p)))]]; }));
    stations.push({ id, u: (last.u ?? 0) + f, points });
    for (const sl of slots) blend[`${id}.${sl}`] = leg.bind.blend?.[`${last.id}.${sl}`] ?? { [leg.bind.bone]: 1 };
  }
  const end = stations[stations.length - 1], c = mean(slots.map((sl) => end.points[sl]));
  blend.tip = leg.bind.blend?.tip ?? { [leg.bind.bone]: 1 };
  return { ...leg, stations, caps: { ...leg.caps, tip: [r6(c[0]), r6(c[1]), r6(c[2] + 0.004)] }, bind: { ...leg.bind, blend } };
}

/** a tube's HEM TURNED IN: a ring `back` (m) up inside from its last, each point the limb's `rest` ring's (its slots
 * `restSlots`, found by share of the turn) `inset` in from its middle, so the cloth folds back to the limb; its cap's pole
 * toward the opening (the loft winds a cap outward from its ring, which a fold keeps only so); its weights the hem's. In
 * place; the tube returned */
export function turnHemIn(sv, rest, restSlots, { back = 0.03, inset = 0.004 } = {}) {
  const restC = mean(Object.values(rest)), last = sv.stations[sv.stations.length - 1], lc = mean(sv.slots.map((sl) => last.points[sl])), prevC = mean(sv.slots.map((sl) => sv.stations[sv.stations.length - 2].points[sl]));
  const axis = unitv(sub(lc, prevC)), linC = sub(lc, scl(axis, back));
  // (the limb's slots on its ring: the tube's taken round at its first piece's, so each found by its share of the turn)
  const rs = restSlots, at = (j) => rest[rs[Math.round((j * rs.length) / sv.slots.length) % rs.length]];
  const linPts = Object.fromEntries(sv.slots.map((sl, j) => { const q = at(j), d = unitv(sub(q, restC)); return [sl, add(linC, scl(d, Math.max(0.01, len(sub(q, restC)) - inset))).map(r6)]; }));
  const id2 = `st${sv.stations.length}`, lw = {}; for (const sl of sv.slots) { lw[sl] = sv.bind.blend[`${last.id}.${sl}`] ?? { [sv.bind.bone]: 1 }; sv.bind.blend[`${id2}.${sl}`] = lw[sl]; }
  const linR = sv.slots.reduce((s, sl) => s + len(sub(linPts[sl], linC)), 0) / sv.slots.length;
  sv.stations = [...sv.stations, { id: id2, u: (last.u ?? 0) + 0.01, points: linPts }];
  sv.caps = { ...sv.caps, tip: add(linC, scl(axis, linR / 3)).map(r6) };
  sv.bind.blend.tip = ringW(lw);
  return sv;
}

// TRIMS

/** a STAND COLLAR: a short tube from a garment's top ring (`body`'s last, lifted `lift` off it) up the neck `height` (m),
 * its upper ring the neck's skin there (`neck`, the nearest of its rings) eased out by `ease`, taken round at the
 * garment's slots (each the neck point at the same share of the turn); its lower ring's weights the garment's, its upper
 * ring's the neck's; null where the neck rises no higher than the garment's top */
export function collarOn(body, neck, { height = 0.035, ease = 0.006, lift = 0.002 } = {}) {
  const S = body.stations, top = S[S.length - 1], c0 = mean(body.slots.map((sl) => top.points[sl])), z1 = c0[2] + height;
  const nk = neck.stations.reduce((b, st) => (Math.abs(mean(Object.values(st.points))[2] - z1) < Math.abs(mean(Object.values(b.points))[2] - z1) ? st : b));
  let nc = mean(neck.slots.map((sl) => nk.points[sl]));
  const N = body.slots.length, M = neck.slots.length;
  // (no neck above the garment's top to stand on, as on a heavy figure whose shirt rises to the jaw: no collar)
  if (nc[2] < c0[2] + 0.005) return null;
  // (a collar climbing past the neck's last ring, where the head's skin takes it over, a turtleneck's: that ring carried
  // on up the neck's axis to its height, drawn in a little as the neck narrows)
  const byZ = neck.stations.map((st) => [mean(Object.values(st.points))[2], st]).sort((a, b) => a[0] - b[0]), last = byZ[byZ.length - 1][1];
  let ring = (q) => q;
  if (nk === last && byZ.length > 1 && z1 > nc[2] + 0.002) {
    const pc = mean(Object.values(byZ[byZ.length - 2][1].points)), ax = unitv(sub(nc, pc)), k = (z1 - nc[2]) / Math.max(0.3, ax[2]), lc = add(nc, scl(ax, k));
    const n0 = nc;
    ring = (q) => add(lc, scl(sub(q, n0), 0.96));
    nc = lc;
  }
  const lower = Object.fromEntries(body.slots.map((sl) => { const p = top.points[sl], d = unitv(sub(p, c0)); return [sl, add(p, scl(d, lift)).map(r6)]; }));
  const upper = Object.fromEntries(body.slots.map((sl, j) => { const q = ring(nk.points[neck.slots[Math.round((j * M) / N) % M]]), d = unitv(sub(q, nc)); return [sl, add(q, scl(d, ease)).map(r6)]; }));
  const own = { [body.bind.bone]: 1 }, nOwn = { [neck.bind?.bone ?? 'neck']: 1 }, blend = {};
  for (const [j, sl] of body.slots.entries()) { blend[`st0.${sl}`] = body.bind.blend?.[`${top.id}.${sl}`] ?? own; blend[`st1.${sl}`] = neck.bind?.blend?.[`${nk.id}.${neck.slots[Math.round((j * M) / N) % M]}`] ?? nOwn; }
  const C1 = mean(Object.values(upper)), up = unitv(sub(C1, c0));
  blend.back = ringW(Object.fromEntries(body.slots.map((sl) => [sl, blend[`st0.${sl}`]]))); blend.tip = ringW(Object.fromEntries(body.slots.map((sl) => [sl, blend[`st1.${sl}`]])));
  return { layer: 1, closure: 'closed', slots: body.slots, ...(body.slotT ? { slotT: body.slotT } : {}), stations: [{ id: 'st0', u: 0, points: lower }, { id: 'st1', u: 1, points: upper }],
    caps: { back: sub(c0, scl(up, 0.001)).map(r6), tip: add(C1, scl(up, 0.001)).map(r6) }, bind: { bone: body.bind.bone, blend } };
}

/** a band: the piece's rings about station `i`, `width` (m) apart along it, each point lifted off its ring's middle,
 * carried by the piece's bind there */
export function bandAt(P, i, { width, lift }) {
  const mid = P.stations.map((st) => mean(P.slots.map((sl) => st.points[sl])));
  let a = i, b = i; const far = () => len(sub(mid[b], mid[a]));
  while (far() < width && (a > 0 || b < mid.length - 1)) { if (a > 0) a--; if (far() < width && b < mid.length - 1) b++; }
  if (a === b) return null;
  const pick = [P.stations[a], P.stations[b]], C = [mid[a], mid[b]], along = unitv(sub(C[1], C[0])), ids = new Set(pick.map((st) => st.id));
  const stations = pick.map((st, k) => ({ id: st.id, u: k, points: Object.fromEntries(P.slots.map((sl) => { const d = unitv(sub(st.points[sl], C[k])); return [sl, st.points[sl].map((x, q) => r6(x + d[q] * lift))]; })) }));
  const blend = Object.fromEntries(Object.entries(P.bind?.blend || {}).filter(([k]) => ids.has(k.split('.')[0])));
  // (each cap its ring's weights mixed: left to the piece's bone, a cuff's cap stays with the thigh as the knee bends)
  const ringW = (st) => { const w = {}; for (const sl of P.slots) for (const [b, v] of Object.entries(blend[`${st.id}.${sl}`] ?? { [P.bind.bone]: 1 })) w[b] = (w[b] ?? 0) + v;
    const top = Object.entries(w).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 4), sum = top.reduce((t, [, v]) => t + v, 0);
    const out = top.map(([b, v]) => [b, r6(v / sum)]); out[0][1] = r6(out[0][1] + 1 - out.reduce((t, [, v]) => t + v, 0)); return Object.fromEntries(out); };
  blend.back = ringW(pick[0]); blend.tip = ringW(pick[1]);
  return { layer: 1, closure: 'closed', slots: P.slots, ...(P.slotT ? { slotT: P.slotT } : {}), stations,
    caps: { back: C[0].map((x, q) => r6(x - along[q] * 0.001)), tip: C[1].map((x, q) => r6(x + along[q] * 0.001)) }, bind: { ...P.bind, blend } };
}


/** the SASH: a wide band round the trousers' waist (their highest ring, or station `at`; `width` high), lifted off it; a
 * knot at its front; two tails hanging from the knot over the cloth (each station a little in front of the cloth under
 * it), all carried by the piece's weights: `<id>Sash_<seg>`, `<id>Knot`, `<id>Tail<R|L>` */
export function sashOn(pelvis, parts, id, { at = null, seg = 'pelvis', width = 0.06 } = {}) {
  const top = at ?? pelvis.stations.map((st, i) => [i, mean(pelvis.slots.map((sl) => st.points[sl]))[2]]).sort((a, b) => b[1] - a[1])[0][0];
  const band = bandAt(pelvis, top, { width, lift: 0.006 }); if (!band) return {};
  const out = { [`${id}Sash_${seg}`]: { ...band, group: 'Sash' } };
  // the knot at the band's front
  const front = band.stations.map((st) => st.points.front ?? st.points[band.slots[0]]), k = mean(front);
  const knot = strip([[k[0], k[1] + 0.012, k[2] + 0.022], [k[0], k[1] + 0.016, k[2] - 0.022]], { w: 0.05, t: 0.022 });
  out[`${id}Knot`] = { ...knot, group: 'Sash', bind: bindNearest(knot, pelvis) };
  // the tails: down from the knot, each station held in front of the trousers under it
  const cloth = Object.entries(parts).filter(([n]) => n.startsWith(`${id}_`)).flatMap(([, P]) => P.stations.flatMap((st) => Object.values(st.points)));
  for (const [S, x] of [['R', 0.022], ['L', -0.026]]) {
    const centres = [0, 1, 2, 3].map((q) => {
      const z = k[2] - 0.02 - q * 0.07, X = k[0] + x * (1 + 0.15 * q);
      const ahead = cloth.filter((p) => Math.abs(p[0] - X) < 0.025 && Math.abs(p[2] - z) < 0.025).reduce((m, p) => Math.max(m, p[1]), k[1]);
      return [X, ahead + 0.01, z];
    });
    const tail = strip(centres, { w: 0.038, t: 0.006 });
    out[`${id}Tail${S}`] = { ...tail, group: 'Sash', bind: bindNearest(tail, pelvis) };
  }
  return out;
}

/** a box-section strip through `centres` (top first), `w` across (x) and `t` deep (y), its caps a hair past its ends */
export function strip(centres, { w, t }) {
  const names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const stations = centres.map((c, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(names.map((nm, j) => [nm, [r6(c[0] + (corner[j][0] * w) / 2), r6(c[1] + (corner[j][1] * t) / 2), r6(c[2])]])) }));
  const dir = unitv(sub(centres[centres.length - 1], centres[0]));
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: centres[0].map((x, k) => r6(x - dir[k] * 0.001)), tip: centres[centres.length - 1].map((x, k) => r6(x + dir[k] * 0.001)) } };
}

/** a RIBBON along `path` lying on the cloth (`w` across it, `t` thick, its centre `t`/2 off the surface, and `over.by`
 * more from the path's point `over.from` on, so a panel's edge lies over the one it crosses; its outside the horizontal
 * out from the trunk's middle `near(p)` there): the path resampled every 12 mm and smoothed; a box section on
 * ringSlots(4), its caps a hair past its ends */
export function ribbon(path, near, { w, t, over = null }) {
  if (path.length < 2) return null;
  // (resampled by length, every 12 mm, then smoothed twice, its ends kept)
  const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + len(sub(path[i], path[i - 1])));
  const total = cum[cum.length - 1], K = Math.max(2, Math.round(total / 0.012)), along = [];
  for (let k = 0; k <= K; k++) { const s = (total * k) / K; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const f = cum[i] > cum[i - 1] ? (s - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0; along.push(path[i - 1].map((x, q) => x + (path[i][q] - x) * f)); }
  let P = along; for (let it = 0; it < 2; it++) P = P.map((p, i) => (i === 0 || i === P.length - 1 ? p : p.map((x, q) => 0.25 * P[i - 1][q] + 0.5 * x + 0.25 * P[i + 1][q])));
  const names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]], overAt = over ? (cum[over.from] ?? total) / total : 2;
  const stations = P.map((p, i) => {
    const tn = unitv(sub(P[Math.min(i + 1, P.length - 1)], P[Math.max(i - 1, 0)])), c = near(p), nn = unitv([p[0] - c[0], p[1] - c[1], 0]), a = unitv(cross(tn, nn));
    const m = add(p, scl(nn, t / 2 + 0.002 + (over ? over.by * ease3((i / K - overAt) / 0.08) : 0)));
    return { id: `st${i}`, u: i, points: Object.fromEntries(names.map((nm, j) => [nm, add(m, add(scl(a, (corner[j][0] * w) / 2), scl(nn, (corner[j][1] * t) / 2))).map(r6)])) };
  });
  const mid = (st) => mean(Object.values(st.points)), d0 = unitv(sub(mid(stations[1]), mid(stations[0]))), d1 = unitv(sub(mid(stations[stations.length - 1]), mid(stations[stations.length - 2])));
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: sub(mid(stations[0]), scl(d0, 0.001)).map(r6), tip: add(mid(stations[stations.length - 1]), scl(d1, 0.001)).map(r6) } };
}

// FRONTS

/** the rise (m) over which a seamed V is taken in from its apex, and the fall under it over which its rings turn to it */
const SEAM_FOOT = 0.05, SEAM_TURN = 0.06;
/** the V of a tailored jacket's front: each point of the tube `P` facing the front (`front`, a horizontal unit) inside
 * the V from `apex` ([x, z], the top button) up to `necks` ([[x, z] right, [x, z] left], where the roll lines meet the
 * collar), and with `open` within `openHalf` of the apex's x on down to the hem, taken in under what the jacket is worn
 * over (`under(c)(direction)`, the skin's reach, 3 mm inside it), so the shirt shows in the V; on each ring the points
 * nearest each roll line (within `snap`), outside and inside, carried round to it, so the V's edge is the line and a
 * step down to the shirt; the faces it takes in painted `group` (the shirt's); nothing within `floor` above the apex
 * (the lapels close over it there); the roll lines' feet `apexHalf` either side of the apex (an open front's, the
 * width of its opening). `at(p)(direction)` (optional): what is under read at each point's own height as well, the
 * nearer of the two taken (the game body's rings at the neckline tilt 10 cm front to back: read at the ring's middle
 * alone, a point in the V low on its ring was taken in to where the skin is 3 cm above it, and stood through the shirt).
 * `seam` (a count of slots, optional): the V's edge a SEAM of the cloth. On every ring the V crosses the same slots lie
 * in it (`seam` a side of the front and the front's own), spread from one roll line to the other, the rest over the
 * jacket beyond them, so no face runs from the V's inside on one ring to the jacket's outside on the next (cut across
 * its slots, each ring's edge a slot on from the next one's, the V's edge was a row of teeth); the V taken in over its
 * first `SEAM_FOOT` above the apex, its slots drawn together there from as wide as they stood; the rings under it turned
 * toward the apex over `SEAM_TURN`, and only a ring taken in whole painted. In place */
export function cutV(P, under, { front, apex, necks, open = false, openHalf = 0.03, snap = 0.025, group = null, floor = 0, apexHalf = 0, at = null, seam = 0 }) {
  const [xa, za] = apex, [[xr, zr], [xl, zl]] = necks, zTop = Math.max(zr, zl) + 0.01, side = [-front[1], front[0], 0], taken = [];
  // (side: the body's +x, the right, when the front is −y; its sign read off the right neck)
  const sgn = Math.sign(xr - xa) * Math.sign(side[0] || 1), S = scl(side, sgn || 1);
  // (the seam's walk across the front, the back on the left to the back on the right, and how far a point is inside the V
  // as the cut below reads it: > 0 inside)
  const n = P.slots.length, half = n / 2, walk = [...Array.from({ length: half }, (_, j) => half + j), ...Array.from({ length: half + 1 }, (_, j) => j)];
  const inV0 = (c) => (p) => {
    const d = unitv([p[0] - c[0], p[1] - c[1], 0]), z = p[2];
    if (d[0] * front[0] + d[1] * front[1] < 0.15 || z > zTop) return -1;
    const f = (zn) => Math.min(1, Math.max(0, (z - za) / (zn - za))), xR = xa + apexHalf + (xr - xa - apexHalf) * f(zr), xL = xa - apexHalf + (xl - xa + apexHalf) * f(zl);
    return z > za ? (z > za + floor ? Math.min(xR - p[0], p[0] - xL) : -1) : open ? openHalf - Math.abs(p[0] - xa) : -1;
  };
  for (const st of P.stations) {
    // (the ring's middle as it stands: a seam crowds its slots to the front)
    const c = mean(P.slots.map((sl) => st.points[sl]));
    if (seam && 2 * seam + 2 < n) {
      // THE SEAM: the ring walked across its front from the back on the left to the back on the right; the V on it from
      // the line where it comes in to the line where it goes out (wherever it lies: a double front's is off the
      // middle), its `seam` slots a side of the front and the front's own spread across it, the rest over the jacket
      // on either side, just past the lines
      const Q = walk.map((j) => st.points[P.slots[j]]), G = Q.map(inV0(c)), cross = [];
      for (let i = 0; i + 1 < Q.length; i++) if ((G[i] > 0) !== (G[i + 1] > 0)) cross.push(i + G[i] / (G[i] - G[i + 1] || 1));
      const L = [0]; for (let i = 1; i < Q.length; i++) L.push(L[i - 1] + len(sub(Q[i], Q[i - 1])));
      const sAt = (x) => { const i = Math.floor(x); return L[i] + (L[i + 1] - L[i]) * (x - i); }, atS = (s) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = Math.max(0, Math.min(1, (s - L[i - 1]) / Math.max(1e-12, L[i] - L[i - 1]))); return Q[i - 1].map((v, q) => v + (Q[i][q] - v) * f); };
      const T = L[L.length - 1], i0 = half - seam, i1 = half + seam, m = Q.length - 1;
      const lay = (sA, sB, e) => { for (let i = 1; i < m; i++) st.points[P.slots[walk[i]]] = atS(i < i0 ? ((sA - e) * i) / i0 : i <= i1 ? sA + e + ((sB - sA - 2 * e) * (i - i0)) / (i1 - i0) : sB + e + ((T - sB - e) * (i - i1)) / (m - i1)).map(r6); };
      if (cross.length === 2 && G[Math.floor(cross[0]) + 1] > 0) {
        // (over the V's foot, as it is taken in, its slots spread from as wide as they stood down to the V's own width:
        // drawn onto it at once, the band from the ring under it fanned 15 cm across a bust)
        const [sA, sB] = cross.map(sAt), w = Math.max(0, Math.min(1, (Q[half][2] - za - floor) / SEAM_FOOT)), own = L[i1] - L[i0];
        if (w >= 1 || own <= sB - sA) lay(sA, sB, 0.001);
        else { const mid = (sA + sB) / 2, h = (sB - sA + (own - sB + sA) * (1 - w)) / 2; lay(Math.max(0.002, mid - h), Math.min(T - 0.002, mid + h), 0.001); }
      }
      else {
        // (under the V, its slots turned round the ring toward the apex, the front's onto it, by less the farther under
        // it, nothing at the back: a double front's V lies off the middle, and the ring under its first, its slots where
        // they stood, twisted the band between them across the chest)
        const facing = Q.map((p) => { const d = unitv([p[0] - c[0], p[1] - c[1], 0]); return d[0] * front[0] + d[1] * front[1] >= 0.15; });
        const k = Q.findIndex((p, i) => i < m && facing[i] && facing[i + 1] && (p[0] - xa) * (Q[i + 1][0] - xa) <= 0 && p[0] !== Q[i + 1][0]);
        const w = Math.max(0, Math.min(1, 1 - (za - Q[half][2]) / SEAM_TURN));
        if (k >= 0 && w > 0) {
          const D = (sAt(k + (xa - Q[k][0]) / (Q[k + 1][0] - Q[k][0])) - L[half]) * w;
          if (Math.abs(D) > 1e-6) for (let i = 1; i < m; i++) st.points[P.slots[walk[i]]] = atS(L[i] + D * (1 - Math.abs(L[i] - L[half]) / Math.max(1e-9, i < half ? L[half] : T - L[half]))).map(r6);
        }
      }
    }
    const need = under(c), near = { R: null, L: null, Ri: null, Li: null }, inV = new Set(); taken.push(inV);
    for (const sl of P.slots) {
      const p = st.points[sl], d = unitv([p[0] - c[0], p[1] - c[1], 0]), z = p[2];
      if (d[0] * front[0] + d[1] * front[1] < 0.15 || z > zTop) continue;
      const f = (zn) => Math.min(1, Math.max(0, (z - za) / (zn - za))), xR = xa + apexHalf + (xr - xa - apexHalf) * f(zr), xL = xa - apexHalf + (xl - xa + apexHalf) * f(zl);
      const inside = z > za ? z > za + floor && p[0] < xR && p[0] > xL : open && Math.abs(p[0] - xa) < openHalf;
      if (inside) {
        const a = at ? at([c[0], c[1], z])(d) : 0, r0 = Math.hypot(p[0] - c[0], p[1] - c[1]), R1 = Math.max(0.01, (a ? Math.min(a, need(d) || a) : need(d)) - 0.003);
        // (a seam's V taken in over its first SEAM_FOOT above the apex, from the cloth as it stands: its slots spread wide on
        // the ring under the V and drawn together on the V's first, the band between would dive under the shirt across the chest)
        const w = seam && z > za ? Math.min(1, (z - za - floor) / SEAM_FOOT) : 1, R = w >= 1 ? R1 : r0 + (R1 - r0) * w; st.points[sl] = [c[0] + d[0] * R, c[1] + d[1] * R, z].map(r6); if (w >= 1) inV.add(sl);
        if (z > za) for (const [k, x, gap] of [['Ri', xR, xR - p[0]], ['Li', xL, p[0] - xL]]) if (gap < snap && (!near[k] || gap < near[k].gap)) near[k] = { sl, x, gap, inset: k === 'Ri' ? -0.002 : 0.002 };
        continue;
      }
      // (the nearest point outside each roll line, to be set on it)
      if (z > za) for (const [k, x, gap] of [['R', xR, p[0] - xR], ['L', xL, xL - p[0]]]) if (gap > 0 && gap < snap && (!near[k] || gap < near[k].gap)) near[k] = { sl, x, gap };
    }
    // THE EDGE ON THE LINE: that point carried round its ring to the roll line, so the V's edge is the line the lapel
    // lies along and not the ring's slots (a cut by slots alone is a ragged slit where the V narrows)
    // (and the nearest inside it, under the shirt, carried there too: the V's edge a step down, not a slope of cloth)
    for (const k of ['R', 'L', 'Ri', 'Li']) {
      const q = near[k]; if (!q) continue;
      const p = st.points[q.sl], h = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...h), s1 = Math.max(-0.999, Math.min(0.999, ((q.x + (q.inset ?? 0) - c[0]) * (S[0] || 1)) / r));
      const fc = Math.sqrt(1 - s1 * s1), dn = [front[0] * fc + S[0] * s1, front[1] * fc + S[1] * s1];
      st.points[q.sl] = [c[0] + dn[0] * r, c[1] + dn[1] * r, p[2]].map(r6);
    }
  }
  // THE CUT'S WALLS in `group` (what is worn under: the shirt's): every face of the cloth with a corner taken in, so
  // where the V is narrower than the cloth's points are apart its sides read as the shirt, not as a slope of the jacket
  if (group) {
    const n = P.slots.length, half = n / 2, idx = (sl) => { const j = P.slots.indexOf(sl); return j <= half ? j : n - j; }, bands = { ...(P.bandGroups || {}) };
    // (a face painted where both its rings are taken in beside it, the V comes to its point, no band of shirt under it;
    // and on both sides of the front, for a face's paint is mirrored: a closed front's V is off the middle, and a wall
    // taken in on its one side alone, painted, had laid a strip of shirt on the other side's cloth beyond the lapel)
    const sides = (set) => [new Set([...set].filter((sl) => P.slots.indexOf(sl) <= half).map(idx)), new Set([...set].filter((sl) => { const j = P.slots.indexOf(sl); return j === 0 || j >= half; }).map(idx))];
    const pair = (S, k) => S.has(k) || S.has(k + 1);
    for (let i = 0; i + 1 < P.stations.length; i++) {
      const [aR, aL] = sides(taken[i]), [bR, bL] = sides(taken[i + 1]); if (!aR.size || !bR.size || !aL.size || !bL.size) continue;
      const key = `${P.stations[i].id}-${P.stations[i + 1].id}`, row = bands[key] ? [...bands[key]] : Array(half).fill(P.group ?? 'Body');
      for (let k = 0; k < half; k++) if (pair(aR, k) && pair(bR, k) && pair(aL, k) && pair(bL, k)) row[k] = group;
      bands[key] = row;
    }
    P.bandGroups = bands; if (group !== 'Skin' && group !== (P.group ?? 'Body')) P.painted = [...new Set([...(P.painted || []), group])];
  }
  return P;
}

/** a WALKER on a tube's cloth (its rings as they are now): `across(p, dir, w)` → [the point `w` (m) from `p` measured
 * along the cloth, its outward normal]: round the ring at `p`'s height as far as `dir` runs round it, and up or down the
 * cloth (at the same place round the ring) as far as it runs up or down, so a band laid out from a line on a jacket
 * wraps its chest and its shoulder as cloth does, never stepping out into the air off them */
export function clothWalker(P) {
  const n = P.slots.length;
  const rows = P.stations.map((st) => P.slots.map((sl) => [...st.points[sl]])).map((pts) => ({ pts, z: mean(pts)[2] })).sort((u, v) => u.z - v.z), last = rows.length - 1;
  const ringAt = (z) => {
    if (z <= rows[0].z) return rows[0].pts; if (z >= rows[last].z) return rows[last].pts;
    let i = 0; while (i < last - 1 && rows[i + 1].z < z) i++;
    const f = (z - rows[i].z) / (rows[i + 1].z - rows[i].z || 1); return rows[i].pts.map((p, k) => p.map((v, q) => v + (rows[i + 1].pts[k][q] - v) * f));
  };
  const at = (ring, j, t) => ring[j].map((v, q) => v + (ring[(j + 1) % n][q] - v) * t);
  const locate = (ring, p) => {
    let best = { j: 0, t: 0, d: Infinity };
    for (let j = 0; j < n; j++) { const a = ring[j], ab = sub(ring[(j + 1) % n], a), l2 = dot(ab, ab) || 1, t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)), d = len(sub(p, add(a, scl(ab, t)))); if (d < best.d) best = { j, t, d }; }
    return best;
  };
  const around = (ring, j, t, L, sign) => {
    for (let guard = 0; guard < 2 * n && L > 1e-9; guard++) {
      const seg = len(sub(ring[(j + 1) % n], ring[j])) || 1e-6, rem = (sign > 0 ? 1 - t : t) * seg;
      if (L <= rem) { t += (sign * L) / seg; L = 0; break; }
      L -= rem; if (sign > 0) { j = (j + 1) % n; t = 0; } else { j = (j + n - 1) % n; t = 1; }
    }
    return { j, t };
  };
  const across = (p, dir, w) => {
    let z = p[2], ring = ringAt(z), { j, t } = locate(ring, p);
    const tan = unitv(sub(ring[(j + 1) % n], ring[j])), ah = dot(dir, tan), Lv = w * dir[2];
    ({ j, t } = around(ring, j, t, w * Math.hypot(dir[0], dir[1]) * Math.min(1, Math.abs(ah) / (Math.hypot(dir[0], dir[1]) || 1)), ah >= 0 ? 1 : -1));
    let q = at(ring, j, t), rem = Math.abs(Lv); const dz = Math.sign(Lv) * 0.002;
    for (let guard = 0; guard < 400 && rem > 1e-9 && dz; guard++) {
      const z2 = z + dz; if (z2 < rows[0].z || z2 > rows[last].z) break;
      const q2 = at(ringAt(z2), j, t), d = len(sub(q2, q)); if (d >= rem) { q = q.map((v, k) => v + (q2[k] - v) * (rem / d)); break; }
      rem -= d; q = q2; z = z2;
    }
    const c = mean(ringAt(q[2])), h = [q[0] - c[0], q[1] - c[1], 0], l = Math.hypot(h[0], h[1]) || 1;
    return [q, [h[0] / l, h[1] / l, 0]];
  };
  return { across };
}

/** a LAPEL and its COLLAR, one band lying on the jacket along `path` (up the right roll line from its button, round the
 * back of the neck, down the left roll line): at each point the band's inner edge on the path and its outer edge
 * `width[k]` (m) out across the cloth from it (the lapel's shape: the notch, the peak, the shawl's curve), away from the
 * V on the lapels and down over the shoulders on the collar (`out0`, the first point's side; `fall[k]` 0 … 1 how far a
 * point's turns down, the collar's; `overhang` its inner edge on over the V; `across` a cloth walker's, its outer edge
 * measured along the cloth, and a middle line to its section); lying `lift` off the
 * surface (`surface(p)` → [the point on it, its outward normal]), `t` thick. A box section on ringSlots(4), its ends a
 * hair past its first and last points */
export function lapelBand(path, width, surface, { out0, t = 0.003, lift = 0.002, fall = null, overhang = 0, across = null }) {
  if (path.length < 3) return null;
  let P = path; for (let it = 0; it < 2; it++) P = P.map((p, i) => (i === 0 || i === P.length - 1 ? p : p.map((x, q) => 0.25 * P[i - 1][q] + 0.5 * x + 0.25 * P[i + 1][q])));
  // (a section of six: the outer edge, the middle and the inner edge, top and bottom, so across a curve (a bust, the
  // chest) it lies on the cloth and no chord of it dips under)
  const names = ringSlots(across ? 6 : 4); let prev = null;
  const stations = P.map((p, i) => {
    const tn = unitv(sub(P[Math.min(i + 1, P.length - 1)], P[Math.max(i - 1, 0)])), [s0, n0] = surface(p);
    let a = unitv(cross(tn, n0));
    // (the band's side kept the same along it: the first point's toward `out0`, each after toward the one before)
    if (prev ? a[0] * prev[0] + a[1] * prev[1] + a[2] * prev[2] < 0 : a[0] * out0[0] + a[1] * out0[1] + a[2] * out0[2] < 0) a = scl(a, -1);
    prev = a;
    // (the collar falls: its outer edge turned down over the shoulders and the back by `fall[k]`)
    const f = fall?.[i] ?? 0, out = f ? unitv(add(scl(a, 1 - f), [0, 0, -f])) : a;
    // (its inner edge `overhang` on over the V, as a lapel rolls over the opening's edge, hiding the cut's step)
    // (the outer edge `across` the cloth from the inner when a walker is given: measured along the jacket, not out
    // into the air off its shoulder)
    const [s1, n1] = across ? across(s0, out, Math.max(0.004, width[i])) : surface(add(s0, scl(out, Math.max(0.004, width[i])))), inner = add(add(s0, scl(n0, lift)), scl(a, -overhang * (1 - f))), outer = add(s1, scl(n1, lift));
    const mid = across ? (() => { const [sm, nm] = across(s0, out, Math.max(0.002, width[i] / 2)); return [add(sm, scl(nm, lift)), nm]; })() : null;
    const pts = mid ? [add(outer, scl(n1, t)), outer, mid[0], inner, add(inner, scl(n0, t)), add(mid[0], scl(mid[1], t))] : [add(outer, scl(n1, t)), outer, inner, add(inner, scl(n0, t))];
    return { id: `st${i}`, u: i, points: Object.fromEntries(names.map((nm, j) => [nm, pts[j].map(r6)])) };
  });
  const mid = (st) => mean(Object.values(st.points)), n = stations.length, d0 = unitv(sub(mid(stations[1]), mid(stations[0]))), d1 = unitv(sub(mid(stations[n - 1]), mid(stations[n - 2])));
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: sub(mid(stations[0]), scl(d0, 0.001)).map(r6), tip: add(mid(stations[n - 1]), scl(d1, 0.001)).map(r6) } };
}

/** the ARMHOLES of sleeveless cloth `P` (a waistcoat's), PAINTED: above `zArm` (the armhole's foot, at the side seam)
 * every face whose middle lies farther out to the side of its ring's middle than the armhole's edge, a quarter ellipse
 * from the cloth's own side at `zArm` in to `xIn` (the shoulder strap's outer edge) at `zTop`, painted `group` (the
 * shirt's, whose sleeve's head is there), front and back alike; the points out there laid on the cloth it is worn over
 * (`onto`, a tube with the same slots, the shirt: its point on the same slot at the same height, 1 mm out), so a jacket
 * over it need not clear it. Not taken in under it: a ring's points stepped in and out round the shoulder's uneven rings
 * had stood out as shards; nor laid on a reach measured over a window of heights, which stands out on the shoulder's curve.
 * In place */
export function armholes(P, { zArm, zTop, xIn, group, onto = null }) {
  const n = P.slots.length, half = n / 2, C = P.stations.map((st) => mean(P.slots.map((sl) => st.points[sl])));
  const i0 = C.reduce((b, c, i) => (Math.abs(c[2] - zArm) < Math.abs(C[b][2] - zArm) ? i : b), 0);
  const xOut = Math.max(...P.slots.map((sl) => Math.abs(P.stations[i0].points[sl][0] - C[i0][0])));
  const edge = (z) => xIn + (xOut - xIn) * Math.sqrt(Math.max(0, 1 - ((Math.min(z, zTop) - zArm) / (zTop - zArm)) ** 2));
  const bands = { ...(P.bandGroups || {}) }, out = (p, c) => p[2] >= zArm && Math.abs(p[0] - c[0]) > edge(p[2]);
  for (let i = 0; i + 1 < P.stations.length; i++) {
    const a = P.stations[i], b = P.stations[i + 1], key = `${a.id}-${b.id}`;
    let row = null;
    for (let k = 0; k < half; k++) {
      const q = [a.points[P.slots[k]], a.points[P.slots[k + 1]], b.points[P.slots[k]], b.points[P.slots[k + 1]]], m = mean(q), cm = mean([C[i], C[i + 1]]);
      if (!out(m, cm)) continue;
      row = row ?? (bands[key] ? [...bands[key]] : Array(half).fill(P.group ?? 'Body')); row[k] = group;
    }
    if (row) bands[key] = row;
  }
  if (onto && P.slots.every((sl) => onto.slots.includes(sl))) {
    const S = [...onto.stations].sort((u, v) => mean(onto.slots.map((sl) => u.points[sl]))[2] - mean(onto.slots.map((sl) => v.points[sl]))[2]);
    const D = S.map((st) => mean(onto.slots.map((sl) => st.points[sl])));
    // (the shirt's point on a slot at a height: between its two rings there, 1 mm out from their middle)
    const at = (sl, z) => { let k = 0; while (k < S.length - 2 && S[k + 1].points[sl][2] < z) k++;
      const a = S[k].points[sl], b = S[k + 1].points[sl], f = Math.max(0, Math.min(1, (z - a[2]) / ((b[2] - a[2]) || 1e-9))), q = a.map((v, j) => v + (b[j] - v) * f), m = D[k].map((v, j) => v + (D[k + 1][j] - v) * f);
      const d = unitv([q[0] - m[0], q[1] - m[1], 0]); return [q[0] + d[0] * 0.001, q[1] + d[1] * 0.001, q[2]]; };
    P.stations.forEach((st, i) => { for (const sl of P.slots) { const p = st.points[sl]; if (out(p, C[i])) st.points[sl] = at(sl, p[2]).map(r6); } });
  }
  P.bandGroups = bands; if (group !== 'Skin' && group !== (P.group ?? 'Body')) P.painted = [...new Set([...(P.painted || []), group])];
  return P;
}

/** an OPENING in the cloth `P` (a closed jacket's quarters, cut away below its last button): each point facing the
 * front for which `inside(p)` holds taken in under what the cloth is worn over (`under(c)(direction)`, 3 mm in), the
 * faces it takes in painted `group` (what shows there: the trousers). In place */
export function cutOpening(P, under, inside, { front, group = null }) {
  const n = P.slots.length, half = n / 2, idx = (sl) => { const j = P.slots.indexOf(sl); return j <= half ? j : n - j; }, taken = [];
  for (const st of P.stations) {
    const c = mean(P.slots.map((sl) => st.points[sl])), need = under(c), got = new Set(); taken.push(got);
    for (const sl of P.slots) {
      const p = st.points[sl], d = unitv([p[0] - c[0], p[1] - c[1], 0]);
      if (d[0] * front[0] + d[1] * front[1] < 0.15 || !inside(p)) continue;
      const R = Math.max(0.01, need(d) - 0.003); st.points[sl] = [c[0] + d[0] * R, c[1] + d[1] * R, p[2]].map(r6); got.add(sl);
    }
  }
  if (group) {
    const bands = { ...(P.bandGroups || {}) };
    // (painted only where the opening is taken in on both sides of the front: a face's paint is mirrored, and a closed
    // front's quarters are off the middle)
    const sides = (set) => [new Set([...set].filter((sl) => P.slots.indexOf(sl) <= half).map(idx)), new Set([...set].filter((sl) => { const j = P.slots.indexOf(sl); return j === 0 || j >= half; }).map(idx))];
    for (let i = 0; i + 1 < P.stations.length; i++) {
      const [aR, aL] = sides(new Set([...taken[i], ...taken[i + 1]])); if (!aR.size || !aL.size) continue;
      const key = `${P.stations[i].id}-${P.stations[i + 1].id}`, row = bands[key] ? [...bands[key]] : Array(half).fill(P.group ?? 'Body');
      for (let k = 0; k < half; k++) if ((aR.has(k) || aR.has(k + 1)) && (aL.has(k) || aL.has(k + 1))) row[k] = group;
      bands[key] = row;
    }
    P.bandGroups = bands; if (group !== 'Skin' && group !== (P.group ?? 'Body')) P.painted = [...new Set([...(P.painted || []), group])];
  }
  return P;
}

/** cloth CLEARED over what lies under it (a jacket over a tie): each point of `P` carried out to `gap` past `pts`' reach
 * in its direction, where they reach past it, read within `band` (m) of each ring's height (narrower over what widens
 * fast: a skirt from the waist to the hip). In place */
export function clearOver(P, pts, { gap = 0.0035, band = 0.02 } = {}) {
  const need = clearanceOver(pts);
  for (const st of P.stations) {
    const c = mean(P.slots.map((sl) => st.points[sl])), under = band >= 0.02 ? need(c) : clearanceOver(pts.filter((q) => Math.abs(q[2] - c[2]) < band))(c);
    for (const sl of P.slots) {
      const p = st.points[sl], h = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...h), R = under([h[0] / (r || 1), h[1] / (r || 1), 0]) + gap;
      if (R > gap && R > r) st.points[sl] = [c[0] + (h[0] / (r || 1)) * R, c[1] + (h[1] / (r || 1)) * R, p[2]].map(r6);
    }
  }
  return P;
}

/** a BLADE lying on the cloth along `path` (a tie: top first), centred on it, `width[k]` across and `thick[k]` deep at
 * each point (the knot's block, the blade widening to its point), `lift` off the surface (`surface(p)` → [the point on
 * it, its outward normal]). A box section on ringSlots(4), its ends a hair past its first and last points */
export function bladeOn(path, width, thick, surface, { lift = 0.0015 } = {}) {
  if (path.length < 3) return null;
  const names = ringSlots(4);
  const stations = path.map((p, i) => {
    const tn = unitv(sub(path[Math.min(i + 1, path.length - 1)], path[Math.max(i - 1, 0)])), [s0, n0] = surface(p), a = unitv(cross(tn, n0)), w = Math.max(0.003, width[i]) / 2;
    const [sa, na] = surface(add(s0, scl(a, w))), [sb, nb] = surface(add(s0, scl(a, -w))), A = add(sa, scl(na, lift)), B = add(sb, scl(nb, lift)), t = thick[i];
    const pts = [add(A, scl(na, t)), A, B, add(B, scl(nb, t))];
    return { id: `st${i}`, u: i, points: Object.fromEntries(names.map((nm, j) => [nm, pts[j].map(r6)])) };
  });
  const mid = (st) => mean(Object.values(st.points)), n = stations.length, d0 = unitv(sub(mid(stations[1]), mid(stations[0]))), d1 = unitv(sub(mid(stations[n - 1]), mid(stations[n - 2])));
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: sub(mid(stations[0]), scl(d0, 0.001)).map(r6), tip: add(mid(stations[n - 1]), scl(d1, 0.001)).map(r6) } };
}

// SHAPE

/** a jacket's SHOULDERS SQUARED, as a pad and a roped sleeve head make them: above its widest ring (`zA`) each ring's
 * reach to the side carried out to the straight line from the neck's point (`xN`, `zN`) at `slope` (rise over run) down
 * to the pad's (`xA`), square from there down to `zA` and eased back to its own line `below` (m) under it; the front and
 * the back left as they are (a point moved by the square of its share of the side). In place */
export function squareShoulders(P, { xN, zN, xA, zA, slope = 0.27, below = 0.03 }) {
  for (const st of P.stations) {
    const c = mean(P.slots.map((sl) => st.points[sl])), z = c[2]; if (z > zN || z < zA - below) continue;
    const w = Math.max(...P.slots.map((sl) => Math.abs(st.points[sl][0] - c[0]))) || 1;
    const line = Math.min(xA, xN + (zN - z) / slope), k = z >= zA ? 1 : 1 - ease3((zA - z) / below), target = w + (Math.max(w, line) - w) * k;
    if (target <= w) continue;
    for (const sl of P.slots) { const p = st.points[sl], dx = p[0] - c[0], f = (Math.abs(dx) / w) ** 2; st.points[sl] = [c[0] + dx * (1 + (target / w - 1) * f), p[1], p[2]].map(r6); }
  }
  return P;
}

/** a jacket's WAIST TAKEN IN (suppressed): each ring within `span` (m) of `z` drawn toward what it is worn over
 * (`under(c)(direction)` and `gap`) by `depth` at the waist, eased out to nothing at `span`. In place */
export function takeIn(P, under, { z, span = 0.1, depth = 0.6, gap = 0.0035 }) {
  for (const st of P.stations) {
    const c = mean(P.slots.map((sl) => st.points[sl])), t = Math.abs(c[2] - z) / span; if (t >= 1) continue;
    const k = depth * 0.5 * (1 + Math.cos(Math.PI * t)), need = under(c);
    for (const sl of P.slots) {
      const p = st.points[sl], h = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...h), d = [h[0] / (r || 1), h[1] / (r || 1)], floor = need([d[0], d[1], 0]) + gap;
      if (r > floor) { const R = r - (r - floor) * k; st.points[sl] = [c[0] + d[0] * R, c[1] + d[1] * R, p[2]].map(r6); }
    }
  }
  return P;
}

/** a jacket falling STRAIGHT from the chest to the hip (a sack cut): each slot between the rings nearest `z0` (the
 * chest) and `z1` (the hip) carried out to the straight line between its reach on those two, wherever it falls inside
 * it (the waist's hollow bridged); never in. In place */
export function fallStraight(P, { z0, z1 }) {
  const C = P.stations.map((st) => mean(P.slots.map((sl) => st.points[sl]))), near = (z) => C.reduce((b, c, i) => (Math.abs(c[2] - z) < Math.abs(C[b][2] - z) ? i : b), 0);
  const a = near(z0), b = near(z1), za = C[a][2], zb = C[b][2], reach = (i, sl) => len(sub(P.stations[i].points[sl], C[i]));
  P.stations.forEach((st, i) => {
    const z = C[i][2]; if (!((z - za) * (z - zb) < 0)) return;
    const f = (z - za) / (zb - za);
    for (const sl of P.slots) { const p = st.points[sl], r = len(sub(p, C[i])), R = reach(a, sl) + (reach(b, sl) - reach(a, sl)) * f; if (R > r) st.points[sl] = add(C[i], scl(unitv(sub(p, C[i])), R)).map(r6); }
  });
  return P;
}

/** a BUTTON: a disc `r` round and `thick` deep lying on the cloth at `at`, its face turned to `normal` */
export function buttonOn(at, normal, { r = 0.0085, thick = 0.0035 } = {}) {
  const n = unitv(normal), u = unitv(Math.abs(n[2]) > 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 0, 1])), v = cross(n, u), names = ringSlots(8);
  const face = (off) => Object.fromEntries(names.map((nm, j) => { const a = (2 * Math.PI * j) / 8; return [nm, [0, 1, 2].map((q) => r6(at[q] + n[q] * off + (u[q] * Math.cos(a) + v[q] * Math.sin(a)) * r))]; }));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: face(0.0005) }, { id: 'st1', u: 1, points: face(thick) }],
    caps: { back: at.map((x, q) => r6(x - n[q] * 0.0005)), tip: at.map((x, q) => r6(x + n[q] * (thick + 0.0005))) } };
}



// BINDS


/** a ribbon's bind off the cloth under it: each station (and each cap) the weights of the cloth's point nearest its
 * middle, all four of its corners alike (each corner its own nearest had parted a thin ribbon's faces in a stride) */
export function bindRibbon(rib, P) {
  const own = { [P.bind.bone]: 1 }, src = P.stations.flatMap((st) => Object.entries(st.points).map(([sl, p]) => [p, P.bind.blend?.[`${st.id}.${sl}`] ?? own]));
  const nearest = (q) => src.reduce((b, s) => { const d = (s[0][0] - q[0]) ** 2 + (s[0][1] - q[1]) ** 2 + (s[0][2] - q[2]) ** 2; return d < b[0] ? [d, s[1]] : b; }, [Infinity, own])[1];
  const blend = {};
  for (const st of rib.stations) { const w = nearest(mean(Object.values(st.points))); for (const sl of rib.slots) blend[`${st.id}.${sl}`] = w; }
  for (const [k, q] of Object.entries(rib.caps)) blend[k] = nearest(q);
  return { bone: P.bind.bone, blend };
}

/** a ring's weights mixed (each slot's), held to four bones: a cap's, so it rides with its ring */
export function ringW(w) {
  const m = {}; for (const x of Object.values(w)) for (const [b, v] of Object.entries(x)) m[b] = (m[b] ?? 0) + v;
  const n = Object.keys(w).length; return four(mixW(Object.fromEntries(Object.entries(m).map(([b, v]) => [b, v / n])), {}, 0));
}
