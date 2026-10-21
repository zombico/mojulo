/**
 * BODY-RELATIONAL DRAPE — LOOSE cloth that hangs on the realistic body, where every garment before it is fitted: the
 * martial artist's WIDE TROUSERS (wide from the hip, falling past the knee, bunched over a gathered cuff at the ankle,
 * a sash at the waist).
 *
 *   the base    the trousers' own rings (body-relational-garment.js `fieldGarment`: the seat, the legs, their handover),
 *               so the drape keeps their stations and slots, and with them the skin's bind and correctives
 *   the FALL    down each leg (the thigh's rings, then the shank's), each slot's radius off its ring's middle the
 *               larger of its own (and the `slack`, eased in below the seat so the legs leave it without a step) and
 *               the ring above's let down by `taper` per metre: the cloth falls from the widest it passes, released
 *               slowly, as cloth hanging from the hip does
 *   the MIDLINE the inner side held `margin` off the body's middle plane, so the two legs never cross
 *   the FOLDS   vertical: a ripple round each ring (`folds` of them, `fold` deep), deeper toward the hem
 *   ONE LEG     the thigh's cloth and the shank's made one tube (`<id>_leg<R|L>`: the thigh's rings down to where the
 *               shank's begin, then the shank's, taken round at the thigh's slots), each point keeping its own weights,
 *               so no edge crosses the knee
 *   the HEM     a BLOUSE (the cloth bunched `blouse` out over `blouseLen`) above a gathered CUFF (`cuffLen` at the ankle,
 *               the skin's ease again), a wrapped band round it (`Cuff`)
 *   the SASH    a wide band round the waist (`Sash`), a knot at the front and two tails hanging over the trousers
 *
 *   loosePants(recipe, R, build, map, spec, { id }) → { parts, tones }   (parts `<id>_<segment>` the trousers,
 *               `<id>Cuff_<shank>`, `<id>Sash_pelvis`, `<id>Knot`, `<id>Tail<R|L>`)
 *   LOOSE_GARMENTS  the words: `martialPants` (gathered at the ankle), `wideTrousers` (`hem: 'fall'`: open, falling past the
 *                   ankle onto the foot to `floor` over the ground)
 *
 * The drape is the REST shape, carried by the leg's bones as the skin is (no cloth simulation). Pure; deterministic.
 */
import { fieldGarment, FIELD_GARMENTS } from './body-relational-garment.js';
import { ringSlots } from './body-relational-resample.js';

export const LOOSE_GARMENTS = Object.freeze({
  martialPants: Object.freeze({ slack: 0.03, taper: 0.045, margin: 0.004, folds: 8, fold: 0.008, blouse: 0.02, blouseLen: 0.16, cuffLen: 0.045, cuffEase: 0.005, sash: true, cuff: true }),
  // (open at the hem, falling past the ankle onto the foot and to the floor)
  wideTrousers: Object.freeze({ slack: 0.03, taper: 0.03, margin: 0.004, folds: 9, fold: 0.009, hem: 'fall', floor: 0.012, sash: true, cuff: false }),
});
/** the colours of the groups the drape adds, for a palette that names none */
export const LOOSE_TONES = Object.freeze({ Sash: '#24407a', Cuff: '#24407a' });

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(...v);
const unitv = (v) => { const l = len(v) || 1; return v.map((x) => x / l); };
const ease3 = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** The wide trousers (see the head of this file). */
export function loosePants(recipe, R, build, map, spec = 'martialPants', { id = 'martialPants', group = 'Bottom' } = {}) {
  const F = { ...(typeof spec === 'string' ? LOOSE_GARMENTS[spec] : spec) };
  const { parts } = fieldGarment(recipe, R, build, map, { id, ...FIELD_GARMENTS.trousers, limit: {}, group });
  for (const S of ['R', 'L']) {
    const thigh = parts[`${id}_thigh${S}`], shank = parts[`${id}_shank${S}`];
    if (!thigh || !shank) continue;
    drapeLeg([thigh, shank], S === 'R' ? 1 : -1, F);
    parts[`${id}_leg${S}`] = F.hem === 'fall' ? fallToFloor(oneLeg(thigh, shank), recipe, S, F) : oneLeg(thigh, shank);
    delete parts[`${id}_thigh${S}`]; delete parts[`${id}_shank${S}`];
  }
  const out = { ...parts };
  if (F.cuff) for (const S of ['R', 'L']) {
    const P = parts[`${id}_leg${S}`]; if (!P) continue;
    const band = bandAt(P, P.stations.length - 1, { width: F.cuffLen * 0.8, lift: 0.003 }); if (band) out[`${id}Cuff_leg${S}`] = { ...band, group: 'Cuff' };
  }
  if (F.sash && parts[`${id}_pelvis`]) Object.assign(out, sashOn(parts[`${id}_pelvis`], parts, id));
  return { parts: out, tones: LOOSE_TONES };
}

/** the FALL, the MIDLINE, the FOLDS and the HEM down one leg's pieces (the thigh's, the shank's), in place */
export function drapeLeg(pieces, side, F) {
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

/** ONE LEG: the thigh's draped rings down to where the shank's begin, then the shank's, taken round at the thigh's slots
 * (a shank ring's point at the same share of the turn, between its two slots there); every point's weights its own
 * piece's (a station's or a point's blend, else its bone), mixed between the two slots it lies between */
export function oneLeg(thigh, shank) {
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

/** the HEM FALLING: below the leg's last ring, rings dropped straight down to `floor` over the ground, each point no
 * lower than the foot under it (a few millimetres over its top), the last ring's radius carried; their weights the last
 * ring's (the cloth hangs from the ankle) */
function fallToFloor(leg, recipe, S, F) {
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

/** a piece's bind copied from `P`: each point takes the weights of P's nearest point */
export function bindNearest(piece, P) {
  const own = { [P.bind.bone]: 1 }, src = P.stations.flatMap((st) => Object.entries(st.points).map(([sl, p]) => [p, P.bind.blend?.[`${st.id}.${sl}`] ?? own]));
  const nearest = (q) => { let best = src[0], d0 = Infinity; for (const s of src) { const d = (s[0][0] - q[0]) ** 2 + (s[0][1] - q[1]) ** 2 + (s[0][2] - q[2]) ** 2; if (d < d0) { d0 = d; best = s; } } return best[1]; };
  const blend = {};
  for (const st of piece.stations) for (const [sl, q] of Object.entries(st.points)) { const w = nearest(q); if (w !== own) blend[`${st.id}.${sl}`] = w; }
  for (const [k, q] of Object.entries(piece.caps)) { const w = nearest(q); if (w !== own) blend[k] = w; }
  return { bone: P.bind.bone, blend };
}

/** a box-section strip through `centres` (top first), `w` across (x) and `t` deep (y), its caps a hair past its ends */
export function strip(centres, { w, t }) {
  const names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const stations = centres.map((c, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(names.map((nm, j) => [nm, [r6(c[0] + (corner[j][0] * w) / 2), r6(c[1] + (corner[j][1] * t) / 2), r6(c[2])]])) }));
  const dir = unitv(sub(centres[centres.length - 1], centres[0]));
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: centres[0].map((x, k) => r6(x - dir[k] * 0.001)), tip: centres[centres.length - 1].map((x, k) => r6(x + dir[k] * 0.001)) } };
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
