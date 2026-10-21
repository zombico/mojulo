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
 *   FRONTS        `cutV` a jacket's V onto the shirt, `lapelBand` its lapels and collar as one band, `buttonOn`
 *   EDGES         `fallToFloor` an open hem carried down over the foot; `turnHemIn` a tube's hem folded back in to the
 *                 limb (so it opens, no lid)
 *   TRIMS         `collarOn` (a stand collar up the neck from a garment's top ring), `bandAt` (a belt, a cuff: caps
 *                 weighted as their rings), `strapBand` (a strap at a station's `u`),
 *                 `sashOn` (a band, a knot, two tails), `strip` (a box section through centres), `ribbon` (a band lying
 *                 on the cloth along a path: a collar, a lapel, a panel's edge), `soleSlab`, `buckleOn`
 *   BINDS         `bindNearest` (each point the nearest's weights), `bindRibbon` (a station's corners one weight),
 *                 `ringW` (a ring's weights mixed: a cap's)
 *
 * The garments: body-relational-drape.js (the wide trousers), body-relational-gi.js (the gi's jacket),
 * body-relational-footwear.js (boots, shoes, sandals). Deterministic; no dice.
 */
import { ringSlots, mixW, four } from './body-relational-resample.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (v) => Math.hypot(...v);
const unitv = (v) => { const l = len(v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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
export function clearanceOver(below) {
  return (c) => { const near = below.filter((q) => Math.abs(q[2] - c[2]) < 0.02); return (dh) => { let m = 0; for (const q of near) { const vx = q[0] - c[0], vy = q[1] - c[1], pr = vx * dh[0] + vy * dh[1]; if (pr > m && Math.abs(vx * dh[1] - vy * dh[0]) < 0.025) m = pr; } return m; }; };
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
 * and round each ring, `passes` times; its first and last `keep` rings held. Never inward, so the cloth stays clear of
 * the peaks it rests on. In place */
export function bridgeRun(P, { passes = 4, keep = 1 } = {}) {
  const S = P.stations, n = S.length, N = P.slots.length; if (n < 2 * keep + 1) return P;
  const C = S.map((st) => mean(P.slots.map((sl) => st.points[sl])));
  const D = S.map((st, i) => P.slots.map((sl) => unitv(sub(st.points[sl], C[i])))), R = S.map((st, i) => P.slots.map((sl) => len(sub(st.points[sl], C[i]))));
  for (let it = 0; it < passes; it++) for (let i = keep; i < n - keep; i++) for (let j = 0; j < N; j++) R[i][j] = Math.max(R[i][j], (R[i - 1][j] + R[i + 1][j]) / 2, (R[i][(j + N - 1) % N] + R[i][(j + 1) % N]) / 2);
  S.forEach((st, i) => { if (i >= keep && i < n - keep) P.slots.forEach((sl, j) => { st.points[sl] = add(C[i], scl(D[i][j], R[i][j])).map(r6); }); });
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
  const nc = mean(neck.slots.map((sl) => nk.points[sl])), N = body.slots.length, M = neck.slots.length;
  // (no neck above the garment's top to stand on, as on a heavy figure whose shirt rises to the jaw: no collar)
  if (nc[2] < c0[2] + 0.005) return null;
  const lower = Object.fromEntries(body.slots.map((sl) => { const p = top.points[sl], d = unitv(sub(p, c0)); return [sl, add(p, scl(d, lift)).map(r6)]; }));
  const upper = Object.fromEntries(body.slots.map((sl, j) => { const q = nk.points[neck.slots[Math.round((j * M) / N) % M]], d = unitv(sub(q, nc)); return [sl, add(q, scl(d, ease)).map(r6)]; }));
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

/** a strap: `bandAt` about the first of the piece's stations at or past `u` (the segment's own `u`, as a style names a
 * place on the foot), `width` (m, 15 mm) apart, lifted `lift` off it */
export function strapBand(P, u, { lift, width = 0.015 }) {
  const i = P.stations.findIndex((st, k) => (st.u ?? k) >= u);
  return i < 0 ? null : bandAt(P, i, { width, lift });
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

/** the V of a tailored jacket's front: each point of the tube `P` facing the front (`front`, a horizontal unit) inside
 * the V from `apex` ([x, z], the top button) up to `necks` ([[x, z] right, [x, z] left], where the roll lines meet the
 * collar), and with `open` within `openHalf` of the apex's x on down to the hem, taken in under what the jacket is worn
 * over (`under(c)(direction)`, the skin's reach, 3 mm inside it), so the shirt shows in the V; on each ring the points
 * nearest each roll line (within `snap`), outside and inside, carried round to it, so the V's edge is the line and a
 * step down to the shirt; the faces it takes in painted `group` (the shirt's). In place */
export function cutV(P, under, { front, apex, necks, open = false, openHalf = 0.03, snap = 0.025, group = null }) {
  const [xa, za] = apex, [[xr, zr], [xl, zl]] = necks, zTop = Math.max(zr, zl) + 0.01, side = [-front[1], front[0], 0], taken = [];
  // (side: the body's +x, the right, when the front is −y; its sign read off the right neck)
  const sgn = Math.sign(xr - xa) * Math.sign(side[0] || 1), S = scl(side, sgn || 1);
  for (const st of P.stations) {
    const c = mean(P.slots.map((sl) => st.points[sl])), need = under(c), near = { R: null, L: null, Ri: null, Li: null }, inV = new Set(); taken.push(inV);
    for (const sl of P.slots) {
      const p = st.points[sl], d = unitv([p[0] - c[0], p[1] - c[1], 0]), z = p[2];
      if (d[0] * front[0] + d[1] * front[1] < 0.15 || z > zTop) continue;
      const f = (zn) => Math.min(1, Math.max(0, (z - za) / (zn - za))), xR = xa + (xr - xa) * f(zr), xL = xa + (xl - xa) * f(zl);
      const inside = z > za ? p[0] < xR && p[0] > xL : open && Math.abs(p[0] - xa) < openHalf;
      if (inside) {
        const R = Math.max(0.01, need(d) - 0.003); st.points[sl] = [c[0] + d[0] * R, c[1] + d[1] * R, z].map(r6); inV.add(sl);
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
    for (let i = 0; i + 1 < P.stations.length; i++) {
      const hit = new Set([...taken[i], ...taken[i + 1]].map(idx)); if (!hit.size) continue;
      const key = `${P.stations[i].id}-${P.stations[i + 1].id}`, row = bands[key] ? [...bands[key]] : Array(half).fill(P.group ?? 'Body');
      for (let k = 0; k < half; k++) if (hit.has(k) || hit.has(k + 1)) row[k] = group;
      bands[key] = row;
    }
    P.bandGroups = bands; if (group !== 'Skin' && group !== (P.group ?? 'Body')) P.painted = [...new Set([...(P.painted || []), group])];
  }
  return P;
}

/** a LAPEL and its COLLAR, one band lying on the jacket along `path` (up the right roll line from its button, round the
 * back of the neck, down the left roll line): at each point the band's inner edge on the path and its outer edge
 * `width[k]` (m) out across the cloth from it (the lapel's shape: the notch, the peak, the shawl's curve), away from the
 * V on the lapels and down over the shoulders on the collar (`out0`, the first point's side; `fall[k]` 0 … 1 how far a
 * point's turns down, the collar's; `overhang` its inner edge on over the V); lying `lift` off the
 * surface (`surface(p)` → [the point on it, its outward normal]), `t` thick. A box section on ringSlots(4), its ends a
 * hair past its first and last points */
export function lapelBand(path, width, surface, { out0, t = 0.003, lift = 0.002, fall = null, overhang = 0 }) {
  if (path.length < 3) return null;
  let P = path; for (let it = 0; it < 2; it++) P = P.map((p, i) => (i === 0 || i === P.length - 1 ? p : p.map((x, q) => 0.25 * P[i - 1][q] + 0.5 * x + 0.25 * P[i + 1][q])));
  const names = ringSlots(4); let prev = null;
  const stations = P.map((p, i) => {
    const tn = unitv(sub(P[Math.min(i + 1, P.length - 1)], P[Math.max(i - 1, 0)])), [s0, n0] = surface(p);
    let a = unitv(cross(tn, n0));
    // (the band's side kept the same along it: the first point's toward `out0`, each after toward the one before)
    if (prev ? a[0] * prev[0] + a[1] * prev[1] + a[2] * prev[2] < 0 : a[0] * out0[0] + a[1] * out0[1] + a[2] * out0[2] < 0) a = scl(a, -1);
    prev = a;
    // (the collar falls: its outer edge turned down over the shoulders and the back by `fall[k]`)
    const f = fall?.[i] ?? 0, out = f ? unitv(add(scl(a, 1 - f), [0, 0, -f])) : a;
    // (its inner edge `overhang` on over the V, as a lapel rolls over the opening's edge, hiding the cut's step)
    const [s1, n1] = surface(add(s0, scl(out, Math.max(0.004, width[i])))), inner = add(add(s0, scl(n0, lift)), scl(a, -overhang * (1 - f))), outer = add(s1, scl(n1, lift));
    const pts = [add(outer, scl(n1, t)), outer, inner, add(inner, scl(n0, t))];
    return { id: `st${i}`, u: i, points: Object.fromEntries(names.map((nm, j) => [nm, pts[j].map(r6)])) };
  });
  const mid = (st) => mean(Object.values(st.points)), n = stations.length, d0 = unitv(sub(mid(stations[1]), mid(stations[0]))), d1 = unitv(sub(mid(stations[n - 1]), mid(stations[n - 2])));
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: sub(mid(stations[0]), scl(d0, 0.001)).map(r6), tip: add(mid(stations[n - 1]), scl(d1, 0.001)).map(r6) } };
}

/** a BUTTON: a disc `r` round and `thick` deep lying on the cloth at `at`, its face turned to `normal` */
export function buttonOn(at, normal, { r = 0.0085, thick = 0.0035 } = {}) {
  const n = unitv(normal), u = unitv(Math.abs(n[2]) > 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 0, 1])), v = cross(n, u), names = ringSlots(8);
  const face = (off) => Object.fromEntries(names.map((nm, j) => { const a = (2 * Math.PI * j) / 8; return [nm, [0, 1, 2].map((q) => r6(at[q] + n[q] * off + (u[q] * Math.cos(a) + v[q] * Math.sin(a)) * r))]; }));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: face(0.0005) }, { id: 'st1', u: 1, points: face(thick) }],
    caps: { back: at.map((x, q) => r6(x - n[q] * 0.0005)), tip: at.map((x, q) => r6(x + n[q] * (thick + 0.0005))) } };
}

/** a sole slab: the footprint's outline round its middle (the farthest point in each of 48 directions, a gap filled from
 * its neighbours, eased round), grown by the welt, from the floor up `thick`; its caps a hair beyond its two faces */
export function soleSlab(print, { floor, thick, welt, n = 48 }) {
  if (print.length < 8) return null;
  const c = mean(print), r = new Array(n).fill(0);
  for (const p of print) { const a = Math.atan2(p[1] - c[1], p[0] - c[0]), j = ((Math.round((a / (2 * Math.PI)) * n) % n) + n) % n, d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d > r[j]) r[j] = d; }
  for (let it = 0; it < n && r.some((x) => x === 0); it++) for (let j = 0; j < n; j++) if (!r[j]) { const a = r[(j + n - 1) % n], b = r[(j + 1) % n]; if (a || b) r[j] = a && b ? (a + b) / 2 : a || b; }
  const R = r.map((x, j) => (r[(j + n - 1) % n] + 2 * x + r[(j + 1) % n]) / 4 + welt), names = ringSlots(n);
  const ring = (z, inset) => Object.fromEntries(names.map((nm, j) => { const a = (2 * Math.PI * j) / n; return [nm, [r6(c[0] + Math.cos(a) * (R[j] - inset)), r6(c[1] + Math.sin(a) * (R[j] - inset)), r6(z)]]; }));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: ring(floor, 0.001) }, { id: 'st1', u: 1, points: ring(floor + thick, 0) }],
    caps: { back: [r6(c[0]), r6(c[1]), r6(floor - 0.001)], tip: [r6(c[0]), r6(c[1]), r6(floor + thick + 0.001)] } };
}

/** a buckle: a small block on the strap's outer side (`side` +1 the right, −1 the left), or at the slot `side` names (a
 * belt's at 'front'), across it */
export function buckleOn(band, side, { w = 0.016, h = 0.012, thick = 0.004 } = {}) {
  const [A, B] = band.stations, sl = typeof side === 'string' ? side : band.slots.reduce((best, s) => ((A.points[s][0] + B.points[s][0]) * side > (A.points[best][0] + B.points[best][0]) * side ? s : best), band.slots[0]);
  const P = mean([A.points[sl], B.points[sl]]), C = mean([mean(Object.values(A.points)), mean(Object.values(B.points))]);
  const n = unitv([P[0] - C[0], P[1] - C[1], P[2] - C[2]]), t = unitv(B.points[sl].map((x, q) => x - A.points[sl][q])), b = unitv(cross(n, t));
  const names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const face = (off) => Object.fromEntries(names.map((nm, j) => [nm, [0, 1, 2].map((q) => r6(P[q] + n[q] * off + t[q] * corner[j][0] * h / 2 + b[q] * corner[j][1] * w / 2))]));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: face(0.0005) }, { id: 'st1', u: 1, points: face(thick) }],
    caps: { back: P.map((x, q) => r6(x - n[q] * 0.0005)), tip: P.map((x, q) => r6(x + n[q] * (thick + 0.0005))) } };
}

// BINDS

/** a piece's bind copied from the cloth or the leather `P` it is worn on: each of its points (and its caps) takes the
 * weights of P's nearest point, so it moves as what is under it does */
export function bindNearest(piece, P) {
  const own = { [P.bind.bone]: 1 }, src = P.stations.flatMap((st) => Object.entries(st.points).map(([sl, p]) => [p, P.bind.blend?.[`${st.id}.${sl}`] ?? own]));
  const nearest = (q) => { let best = src[0], d0 = Infinity; for (const s of src) { const d = (s[0][0] - q[0]) ** 2 + (s[0][1] - q[1]) ** 2 + (s[0][2] - q[2]) ** 2; if (d < d0) { d0 = d; best = s; } } return best[1]; };
  const blend = {};
  for (const st of piece.stations) for (const [sl, q] of Object.entries(st.points)) { const w = nearest(q); if (w !== own) blend[`${st.id}.${sl}`] = w; }
  for (const [k, q] of Object.entries(piece.caps)) { const w = nearest(q); if (w !== own) blend[k] = w; }
  return { bone: P.bind.bone, blend };
}

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
