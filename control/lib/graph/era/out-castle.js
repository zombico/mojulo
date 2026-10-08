/**
 * THE CASTLE — the lord's land drawn tight. A fortified town (era/out-town.js, `fortified`) keeps the lord's land in
 * its inmost ward, and its surface goes to its walls: a curtain the length of the town round a keep on a ward a
 * hundred metres wide, which reads bare. A castle takes the town's walls off and compresses what they kept into one
 * structure; what was the town stands outside it.
 *
 * It is composed inward from its wall, by BUDGET: the KEEP first (a third of the ward's breadth, on the back corner,
 * straddling the curtain so it is read from outside and in), then RANGES backed onto every curtain (lots spoken in the
 * town's language, wall to wall: the hall beside the keep, lodgings along the sides, stables and work by the gates),
 * and the COURT is what is left: room to arrive, no field to cross. The inner ward stands on a platform (`rise`: a
 * battered base holds its ward high and its wall low; a straight curtain stands tall on level ground), climbed by a
 * flight inside its gate; with `wards: 2` a forecourt lies before it, its gate and the inner gate on opposite hands so
 * the walk turns twice. Towers at the corners and every 26 m, a ditch round it all, bridged at the gate. The
 * fortification's elements are era/out-fortress.js's: the castle spends them on less ground.
 *
 *   CASTLE_CARD / readCastlePlan   the settings and their rails
 *   castleMoat(recipe)             how far the castle reaches past its curtain (the ditch, the glacis), before it is designed
 *   designCastle(style, seed, recipe, { language, at })   the castle, laid out in place, with its laws
 *   castleFaces(castle, opts)      faces by depth: curtains, towers, gatehouses, the keep, the ranges; the floor
 *   CASTLE_LAWS                    the budget's laws and the fortification's
 *
 * Pure; seeded dice only; values only.
 */
import { geometry as G, STRUCTURE_USES } from './out-structures.js';
import { decompileAnchor, speak, seedAnchor } from './out-anchor-structure.js';
import { madeStyle, designPiece, madeLaws } from './out-made.js';
import { build as EB } from './out-anchor-elements.js';
import { composeFort, octagon, RAMPART, build as FB } from './out-fortress.js';

const { dice, subSeed, r3, clamp } = G;

/** The castle's rails: the inner ward's breadth, its wards, its platform; the ranges' depths, the forecourt's, the towers' stride. */
export const CASTLE_CARD = Object.freeze({
  size: [40, 56, 44],
  wards: [1, 2, 2],
  rise: [0, 6],
  range: [10, 12],
  hall: 14,
  yard: 11,
  fore: [16, 22],
  spacing: 26,
  stair: 3.6,
});

/** A castle recipe: true, a fortification (crenellated | battered | { seed } | its elements), or { fort, size, wards, rise, anchor }. */
export function readCastlePlan(rec = {}) {
  const r = rec === true ? {} : typeof rec === 'string' ? { fort: rec } : rec;
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('castle: give a castle as true, a fortification (crenellated | battered), or { fort?, size?, wards?, rise?, anchor? }');
  for (const k of Object.keys(r)) if (!['fort', 'size', 'wards', 'rise', 'anchor'].includes(k)) throw new Error(`castle: '${k}' is not a castle setting (fort, size, wards, rise, anchor)`);
  const C = CASTLE_CARD, out = { fort: r.fort ?? 'crenellated', anchor: r.anchor };
  for (const k of ['size', 'wards']) {
    const [lo, hi, def] = C[k], v = r[k] ?? def;
    if (typeof v !== 'number' || v < lo || v > hi || (k === 'wards' && !Number.isInteger(v))) throw new Error(`castle: ${k} is ${k === 'wards' ? 'a whole number' : 'a number'} ${lo}–${hi} (got ${JSON.stringify(r[k])})`);
    out[k] = v;
  }
  if (r.rise !== undefined && !(typeof r.rise === 'number' && r.rise >= C.rise[0] && r.rise <= C.rise[1])) throw new Error(`castle: rise is a number ${C.rise[0]}–${C.rise[1]} m (the inner ward's platform)`);
  out.rise = r.rise;
  return out;
}

/** The keep's breadth: a third of the ward's and more, 14–20 m. */
const keepSide = (W) => clamp(Math.round(0.72 * W) / 2, 14, 20);
/**
 * How far the castle reaches past its curtain's line: the berm (clear of the towers and the keep's corner), the ditch,
 * the glacis kept clear before it. Known from the recipe alone, so a town can make room before the castle is designed.
 */
export function castleMoat(recipe = {}) {
  const P = readCastlePlan(recipe), F = composeFort(P.fort), t = F.curtain.t, K = keepSide(P.size);
  const d0 = r3(Math.max(t / 2 + F.towerDims.proud + 1.5, Math.SQRT2 * (0.3 * K - t / 2) + 1.5)), d1 = r3(d0 + F.ditch.w);
  return { F, d0, d1, glacis: r3(d1 + 6) };
}

const area = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
/** The area of a face in 3D (its corners' cross products). */
const area3 = (c) => { let x = 0, y = 0, z = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; x += p[1] * q[2] - p[2] * q[1]; y += p[2] * q[0] - p[0] * q[2]; z += p[0] * q[1] - p[1] * q[0]; } return Math.hypot(x, y, z) / 2; };
const segDist = ([a, b], x, y) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); return Math.hypot(x - a[0] - dx * k, y - a[1] - dy * k); };

/**
 * The castle, laid out in place: `at` is the gate's centre on the outer curtain's line (the bridge comes up to it from
 * the south) and the ground's height there. `language` is the anchor its ranges are spoken in (the town's, or the
 * recipe's `anchor`, or the kit's).
 */
export function designCastle(style, seed = 1, recipe = {}, { language = null, at = [0, 0, 0] } = {}) {
  const C = CASTLE_CARD, P = readCastlePlan(recipe), F = composeFort(P.fort), D = dice(subSeed(seed, 'castle'));
  const L = language ?? (P.anchor && typeof P.anchor === 'object' && P.anchor.seed !== undefined && !P.anchor.pieces ? decompileAnchor(seedAnchor(P.anchor.seed)) : decompileAnchor(P.anchor ?? style.anchor));
  const t = F.curtain.t, ph = F.parapet.h, TD = F.towerDims, bat = F.curtain.base === 'battered', moat = castleMoat(recipe);
  // ── the measures: the ward's breadth and depth, its platform, the walls' heights (the castle is the dial at its end) ──
  const W = P.size, Dd = r3(Math.max(C.hall + C.yard + 12, W * D.roll([0.92, 1.1]))), rise = r3(P.rise ?? (bat ? 5 : 1.5)), RT = RAMPART[1];
  // the walls are cut to what they keep: no higher than the language's lodgings can show over (a shell rises only so far)
  const reach = speak(L, 'dwelling', { w: 8, d: 10 }, style, subSeed(seed, 'castle:reach'), { ring: 'near', crown: 99, over: { side: 0, front: 0.6, rear: 0.15 } }).measures.ridge;
  const Hin = r3(Math.max(ph + 2.5, Math.min(RT - rise + 1.5, reach - ph - 1))), Hout = r3(Math.max(ph + 2.5, Math.min(RT - 2, Hin + rise - 1, reach - ph - 1))), wards = P.wards, Df = wards === 2 ? r3(D.roll(C.fore)) : 0;
  // (the ranges deepen with the ward, so the court does not grow into a field)
  const dS = r3(clamp((D.roll(C.range) * W) / 44, C.range[0], 14)), dN = C.hall, dF = r3(clamp(0.25 * W, C.yard, 14)), dSo = C.yard, K = keepSide(W);
  // the gates: the outer on one hand, the inner on the other; the keep on the far corner from the inner gate
  const s = D.R() < 0.5 ? 1 : -1, gIn = (wards === 2 ? -s : s) * r3(W / 2 - dS - 4), gOut = s * r3(W / 2 - dF - 3), sK = -Math.sign(gIn);
  const Z = at[2], ox = r3(at[0] - (wards === 2 ? gOut : gIn)), yS = at[1];
  const X = (x) => r3(ox + x), xL = X(-W / 2 - t / 2), xR = X(W / 2 + t / 2), x0 = X(-W / 2), x1 = X(W / 2);
  const y0 = r3(yS + t / 2), yX = r3(y0 + Df + t / 2), yi0 = wards === 2 ? r3(yX + t / 2) : y0, yi1 = r3(yi0 + Dd), yN = r3(yi1 + t / 2);
  // the keep: on the back corner, a third of it out past the curtain's faces
  const kc = [X(sK * (W / 2 - 0.2 * K)), r3(yi1 - 0.2 * K)], kx = r3(kc[0] - (sK * K) / 2), ky = r3(kc[1] - K / 2);
  const fw = r3(K * 0.42), fore = { x: [Math.min(kc[0] - sK * (K / 2 - 1), kc[0] - sK * (K / 2 - 1 - fw)), Math.max(kc[0] - sK * (K / 2 - 1), kc[0] - sK * (K / 2 - 1 - fw))], y: [r3(ky - 4.2), ky] };

  // ── the curtains, counter-clockwise (the field on the right of each), each broken where the keep stands ──
  const curtains = [], inner = { h: Hin, retain: rise }, outer = { h: Hout, retain: 0 };
  const wall = (id, ward, a, b, H) => curtains.push({ id, ward, pts: [a, b], z: Z, t, ...H, top: r3(Z + H.retain + H.h), gates: [] });
  const keepY = r3(ky + 0.3), keepX = r3(kx + sK * 0.3);
  if (wards === 2) {
    wall('south', 'fore', [xL, yS], [xR, yS], outer);
    wall('east-fore', 'fore', [xR, yS], [xR, yX], outer);
    wall('east', 'inner', [xR, yX], [xR, sK > 0 ? keepY : yN], inner);
    wall('north', 'inner', [sK > 0 ? keepX : xR, yN], [sK < 0 ? keepX : xL, yN], inner);
    wall('west', 'inner', [xL, sK < 0 ? keepY : yN], [xL, yX], inner);
    wall('west-fore', 'fore', [xL, yX], [xL, yS], outer);
    wall('cross', 'inner', [xL, yX], [xR, yX], inner);
  } else {
    wall('south', 'inner', [xL, yS], [xR, yS], inner);
    wall('east', 'inner', [xR, yS], [xR, sK > 0 ? keepY : yN], inner);
    wall('north', 'inner', [sK > 0 ? keepX : xR, yN], [sK < 0 ? keepX : xL, yN], inner);
    wall('west', 'inner', [xL, sK < 0 ? keepY : yN], [xL, yS], inner);
  }
  // ── the gates: the outer in the south wall; the inner in the cross wall (or the south, with one ward), at the ground ──
  const gates = [], gw = r3(F.gate.clear + 1.2);
  const gate = (c, x, ward, main) => { const [a, b] = c.pts, Lc = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / Lc, (b[1] - a[1]) / Lc], sAt = r3(Math.abs(x - a[0])); c.gates.push({ s: sAt, w: gw }); gates.push({ id: `g${gates.length}`, curtain: c.id, ward, at: [r3(x), a[1]], u, n: [-u[1], u[0]], w: gw, z: Z, h: r3(c.retain + c.h), form: F.gate.form, main, top: r3(Z + c.retain + c.h + ph + 3) }); };
  if (wards === 2) { gate(curtains.find((c) => c.id === 'south'), X(gOut), 'fore', true); gate(curtains.find((c) => c.id === 'cross'), X(gIn), 'inner', false); }
  else gate(curtains.find((c) => c.id === 'south'), X(gIn), 'inner', true);

  // ── the towers: at the corners and where the walls step, then every 26 m; never on the keep or a gate ──
  const towers = [], keepBox = [kc[0] - K / 2, kc[1] - K / 2, kc[0] + K / 2, kc[1] + K / 2];
  const unit = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l]; };
  const put = (p, out, kind) => {
    const m = TD.w / 2 + 1;
    if (p[0] > keepBox[0] - m && p[0] < keepBox[2] + m && p[1] > keepBox[1] - m && p[1] < keepBox[3] + m) return;
    if (towers.some((x) => Math.hypot(x.foot[0] - p[0], x.foot[1] - p[1]) < TD.w) || gates.some((g) => Math.hypot(g.at[0] - p[0], g.at[1] - p[1]) < g.w / 2 + TD.w)) return;
    const o = unit(out), off = t / 2 + TD.proud - TD.w / 2;
    towers.push({ id: `t${towers.length}`, kind, foot: p, at: [r3(p[0] + o[0] * off), r3(p[1] + o[1] * off)], out: o });
  };
  const cx = X(0), cy = (yS + yN) / 2;
  for (const p of [[xL, yS], [xR, yS], [xR, yN], [xL, yN]]) put(p, [p[0] - cx, p[1] - cy], 'corner');
  if (wards === 2) for (const p of [[xL, yX], [xR, yX]]) put(p, [p[0] < cx ? -1 : 1, 0], 'step');
  for (const c of curtains.filter((x) => x.id !== 'cross')) {
    const [a, b] = c.pts, Lc = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / Lc, (b[1] - a[1]) / Lc], n = Math.ceil(Lc / C.spacing);
    for (let i = 1; i < n; i++) put([r3(a[0] + (u[0] * Lc * i) / n), r3(a[1] + (u[1] * Lc * i) / n)], [u[1], -u[0]], 'rhythm');
  }
  const over = Math.max(TD.over, 0.4 * RT);
  for (const x of towers) { x.z = Z; const on = curtains.filter((c) => segDist(c.pts, ...x.foot) < 1); x.top = r3(Math.max(...on.map((c) => c.top)) + ph + over); x.H = r3(x.top - x.z); }
  // the keep over every tower and gatehouse by four metres; a tiered keep stands on its stone base, over the platform
  const highest = Math.max(...towers.map((x) => x.top), ...gates.map((g) => g.top));
  const keep = { at: kc, K, z: Z, base: rise, H: r3(highest + 4 - Z), plan: F.tower.crown === 'tiers' ? 'tiers' : F.tower.plan, side: sK, forebuilding: F.tower.crown === 'tiers' || F.tower.plan === 'round' ? null : fore };
  keep.top = r3(Z + keep.H);

  // ── the flight: inside the inner gate, up to the platform, its going the man-made index's ──
  const made = madeStyle(style.kitId, seed), stairs = [];
  if (rise > 0) {
    const X0 = designPiece('steps', made, seed).dims, n = Math.ceil(rise / X0.riserMax - 1e-9), R = r3(rise / n), Tr = r3(X0.blondel - 2 * R), flights = Math.ceil(n / 10), run = r3(n * Tr + (flights - 1) * X0.landing);
    stairs.push({ at: [X(gIn), yi0], dir: [0, 1], width: C.stair, z0: Z, rise, risers: n, R, T: Tr, run, flights, landing: X0.landing, laws: madeLaws('steps', { blondel: r3(2 * R + Tr), R, T: Tr, uneven: 0, flight: Math.ceil(n / flights) }) });
  }
  const st = stairs[0], slot = st ? { x: [r3(X(gIn) - C.stair / 2 - 0.3), r3(X(gIn) + C.stair / 2 + 0.3)], y: [yi0, r3(yi0 + st.run + 0.4)] } : null;

  // ── the ranges: lots backed onto every curtain, spoken in the language, wall to wall ──
  const lots = [];
  const nIn = clamp(Math.ceil((Hin + ph) / 3), 2, 3), nOut = clamp(Math.ceil((Hout + ph) / 3), 2, 3);
  // a zone along a wall: its front line from F0 along ex, the wall toward ey, `d` deep; cut into lots of `rail` wide
  const zone = (id, ward, F0, ex, ey, len, d, uses, z) => {
    if (len < 5.5) return;
    const rail = [7.5, 11.5], w0 = uses[0] === 'hall' ? clamp(r3(D.roll([14, 18])), 9, len) : 0, rest = len - w0;
    const n = rest < 5.5 ? 0 : Math.max(1, Math.min(Math.ceil(rest / rail[1]), Math.floor(rest / rail[0]) || 1)), widths = [...(w0 ? [w0] : []), ...Array.from({ length: n }, () => r3(rest / n))];
    let u = 0;
    widths.forEach((w, k) => {
      const want = w0 && k === 0 ? 'hall' : w0 ? uses[1 + ((k - 1) % (uses.length - 1))] : uses[k % uses.length];
      const use = [want, 'workshop', 'dwelling'].find((x) => w >= STRUCTURE_USES[x].lot.w - 1e-9 && d >= STRUCTURE_USES[x].lot.d - 1e-9);
      if (use) lots.push({ route: 'castle', side: id, castle: ward, A: [r3(F0[0] + ex[0] * u), r3(F0[1] + ex[1] * u)], ex, ey, w, d, use, k, s: r3(u), z: ward === 'inner' ? r3(Z + rise) : Z, ring: 'near' });
      u = r3(u + w);
    });
  };
  // the inner ward: north the hall's range (the hall by the keep), the sides' lodgings, the south's stables either side of the flight
  const nx0 = sK > 0 ? x0 + 0.3 : r3(kx + 0.4), nx1 = sK > 0 ? r3(kx - 0.4) : x1 - 0.3;
  if (sK > 0) zone('north', 'inner', [r3(nx1), r3(yi1 - dN)], [-1, 0], [0, 1], r3(nx1 - nx0), dN, ['hall', 'dwelling'], Z); else zone('north', 'inner', [r3(nx0), r3(yi1 - dN)], [1, 0], [0, 1], r3(nx1 - nx0), dN, ['hall', 'dwelling'], Z);
  const topOf = (side) => r3(Math.min(yi1 - dN, sK === side ? (keep.forebuilding ? fore.y[0] : ky) - 0.4 : Infinity) - 0.3);
  zone('west', 'inner', [r3(x0 + dS), r3(yi0 + 0.3)], [0, 1], [-1, 0], r3(topOf(-1) - yi0 - 0.3), dS, ['dwelling', 'workshop'], Z);
  zone('east', 'inner', [r3(x1 - dS), topOf(1)], [0, -1], [1, 0], r3(topOf(1) - yi0 - 0.3), dS, ['dwelling', 'workshop'], Z);
  {
    const a = r3(x0 + dS + 0.3), b = r3(x1 - dS - 0.3), cut = slot ? [slot.x[0] - 0.3, slot.x[1] + 0.3] : [X(gIn) - gw / 2 - 0.5, X(gIn) + gw / 2 + 0.5];
    for (const [p, q] of [[a, cut[0]], [cut[1], b]]) if (q - p >= 5.5) zone(p < cut[0] ? 'south-w' : 'south-e', 'inner', [r3(q), r3(yi0 + dSo)], [-1, 0], [0, -1], r3(q - p), dSo, ['barn', 'workshop'], Z);
  }
  // the forecourt: stables and work along its sides and either side of the gate, the walk between them turning under
  // the inner wall (shot at from it the length of the turn)
  const yT = r3(y0 + Df - 3.5);
  if (wards === 2) {
    const a = r3(x0 + dF + 0.3), b = r3(x1 - dF - 0.3), cut = [X(gOut) - 3, X(gOut) + 3];
    for (const [p, q] of [[a, cut[0]], [cut[1], b]]) if (q - p >= 5.5) zone(p < cut[0] ? 'fore-sw' : 'fore-se', 'fore', [r3(q), r3(y0 + 10)], [-1, 0], [0, -1], r3(q - p), 10, ['dwelling', 'workshop'], Z);
    zone('fore-west', 'fore', [r3(x0 + dF), r3(y0 + 0.3)], [0, 1], [-1, 0], r3(Df - 0.6), dF, ['workshop', 'dwelling'], Z);
    zone('fore-east', 'fore', [r3(x1 - dF), r3(y0 + Df - 0.3)], [0, -1], [1, 0], r3(Df - 0.6), dF, ['barn', 'dwelling'], Z);
  }
  // each spoken: backed onto its wall, its neighbours' repeat re-rolled; a dwelling as many storeys as show it over the wall
  // (a shell cannot be given storeys: it is asked to crown over the wall, and dares it as its language does, a
  // smaller shell set on its crown)
  const shell = L.vocab.mass === 'shell';
  const prev = new Map();
  const speakLot = (l) => {
    const wallOver = l.castle === 'inner' ? Hin + ph : Hout + ph;
    const opts = { ring: 'near', over: { side: 0, front: 0.6, rear: 0.15, area: r3(l.w * (l.d - 0.75)) }, ...(l.use === 'hall' ? { crown: r3(wallOver + 2.5) } : shell ? { crown: r3(wallOver + 1.5) } : {}), ...(l.use === 'dwelling' ? { band: l.castle === 'inner' ? [nIn, nIn] : [nOut, nOut] } : {}) };
    const s0 = subSeed(seed, `castle:${l.side}:${l.k}`);
    let d = speak(L, l.use, { w: l.w, d: l.d }, style, s0, opts);
    for (let k = 1; k <= 10 && prev.get(l.side) === d.sig; k++) d = speak(L, l.use, { w: l.w, d: l.d }, style, s0 + 977 * k, opts);
    // one its storeys leave under the parapet is asked to crown over it, as the language dares height
    if (d.measures.ridge <= wallOver && !opts.crown) { const o2 = { ...opts, crown: r3(wallOver + 1.5) }; d = speak(L, l.use, { w: l.w, d: l.d }, style, s0, o2); for (let k = 1; k <= 10 && prev.get(l.side) === d.sig; k++) d = speak(L, l.use, { w: l.w, d: l.d }, style, s0 + 977 * k, o2); }
    prev.set(l.side, d.sig);
    const off = (l.w - d.dims.W0) / 2, v0 = l.island ? (l.d - d.dims.D0) / 2 : Math.max(0.6, l.d - 0.15 - d.dims.D0);
    l.design = d;
    l.place = { o: [r3(l.A[0] + l.ex[0] * off + l.ey[0] * v0), r3(l.A[1] + l.ex[1] * off + l.ey[1] * v0), l.z], ex: l.ex, ey: l.ey };
    l.front = [r3(l.A[0] + l.ex[0] * (l.w / 2)), r3(l.A[1] + l.ex[1] * (l.w / 2))];
    l.crown = r3(l.z + d.measures.ridge);
    l.foot = (() => { const o = l.place.o, W0 = d.dims.W0, D0 = d.dims.D0, p = (u, v) => [r3(o[0] + l.ex[0] * u + l.ey[0] * v), r3(o[1] + l.ex[1] * u + l.ey[1] * v)]; return [p(0, 0), p(W0, 0), p(W0, D0), p(0, D0)]; })();
  };
  for (const l of lots) speakLot(l);
  const courts = { inner: [[x0, yi0], [x1, yi0], [x1, yi1], [x0, yi1]], fore: wards === 2 ? [[x0, y0], [x1, y0], [x1, r3(y0 + Df)], [x0, r3(y0 + Df)]] : null };
  // a court still wider than a cart's turn and a crossing, measured as built, takes a building of its own in the middle
  // of what the ranges leave open: the chapel (or a lodging), the largest that keeps the court room to arrive
  {
    const probe = { courts, lots, keep }, open = () => castleBudget(probe).inner.span;
    if (open() > 24 || castleBudget(probe).inner.built < 0.4) {
      const side = (id, f) => lots.filter((l) => l.side === id).flatMap((l) => l.foot.map(f));
      const cx0 = Math.max(x0, ...side('west', (p) => p[0])), cx1 = Math.min(x1, ...side('east', (p) => p[0])), cy0 = Math.max(yi0, ...side('south-w', (p) => p[1]), ...side('south-e', (p) => p[1])), cy1 = Math.min(yi1, ...side('north', (p) => p[1]), ky);
      const tries = [];
      for (const [use, ds] of [['hall', [16, 14]], ['dwelling', [12, 10]]]) for (const d of ds) for (const w of [16, 14, 12, 10]) if (w >= STRUCTURE_USES[use].lot.w && w <= cx1 - cx0 - 6 && d <= cy1 - cy0 - 6) tries.push({ use, w, d });
      // the first that holds the court's span and the ward's share; else the one that comes nearest, room to arrive kept
      const at = (t) => ({ route: 'castle', side: 'court', castle: 'inner', island: true, A: [r3((cx0 + cx1) / 2 - t.w / 2), r3((cy0 + cy1) / 2 - t.d / 2)], ex: [1, 0], ey: [0, 1], w: t.w, d: t.d, use: t.use, k: 0, s: 0, z: r3(Z + rise), ring: 'near' });
      let best = null;
      for (const t of tries) {
        const l = at(t);
        lots.push(l); speakLot(l);
        const B = castleBudget(probe).inner;
        lots.pop();
        if (B.span < 10) continue;
        const miss = Math.max(0, B.span - 24) + 100 * Math.max(0, 0.4 - B.built);
        if (!best || miss < best.miss) best = { t, miss };
        if (!miss) break;
      }
      if (best) { const l = at(best.t); lots.push(l); speakLot(l); }
    }
  }

  // ── the walk through the forecourt, the courts, the ditch and its bridge ──
  const paths = wards === 2 ? [{ pts: [[X(gOut), yS], [X(gOut), yT], [X(gIn), yT], [X(gIn), yX]], w: 4, z: Z }] : [];
  const ring = (d) => octagon(xL - d, yS - d, xR + d, yN + d, d * (2 - Math.SQRT2));
  const ditch = { inner: ring(moat.d0), outer: ring(moat.d1), depth: F.ditch.depth, w: F.ditch.w, d0: moat.d0, d1: moat.d1 };
  const main = gates.find((g) => g.main), bridges = [{ at: main.at, u: main.u, from: moat.d0 - 0.5, to: moat.d1 + 0.5, w: Math.min(main.w, 5) }];

  const castle = { recipe: P, set: F, seed, language: L.id, W, D: Dd, Df, rise, Hin, Hout, wards, t, z: Z, extent: { x0: xL, x1: xR, y0: yS, y1: yN }, curtains, towers, gates, keep, stairs, slot, lots, paths, courts, ditch, bridges, glacis: moat.glacis };
  castle.budget = castleBudget(castle);
  castle.laws = castleLaws(castle);
  return castle;
}

/**
 * Where the castle's ground goes, ward by ward: what is built on it (the ranges' footprints, the keep's and its
 * forebuilding's inside the ward), what is open, and the largest open square (the court's clear span), at a metre.
 */
export function castleBudget(c) {
  const out = {};
  for (const ward of ['inner', 'fore']) {
    const poly = c.courts[ward];
    if (!poly) continue;
    const [x0, y0] = poly[0], [x1, , ] = poly[1], y1 = poly[2][1], A = area(poly), mine = c.lots.filter((l) => l.castle === ward);
    const rects = mine.map((l) => l.foot);
    if (ward === 'inner') { const k = c.keep, kb = [[k.at[0] - k.K / 2, k.at[1] - k.K / 2], [k.at[0] + k.K / 2, k.at[1] - k.K / 2], [k.at[0] + k.K / 2, k.at[1] + k.K / 2], [k.at[0] - k.K / 2, k.at[1] + k.K / 2]]; rects.push(kb); if (k.forebuilding) { const f = k.forebuilding; rects.push([[f.x[0], f.y[0]], [f.x[1], f.y[0]], [f.x[1], f.y[1]], [f.x[0], f.y[1]]]); } }
    // a metre grid over the ward: each cell built or open
    const nx = Math.round(x1 - x0), ny = Math.round(y1 - y0), cells = new Uint8Array(nx * ny);
    const inside = (q, x, y) => { let s = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + i + 0.5, y = y0 + j + 0.5; if (rects.some((q) => inside(q, x, y))) cells[j * nx + i] = 1; }
    const built = cells.reduce((s, v) => s + v, 0) / (nx * ny);
    // the largest open square: its side, by the running minimum
    const sq = new Uint16Array(nx * ny);
    let span = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (cells[k]) continue; sq[k] = i && j ? 1 + Math.min(sq[k - 1], sq[k - nx], sq[k - nx - 1]) : 1; span = Math.max(span, sq[k]); }
    out[ward] = { area: r3(A), built: r3(built), open: r3(1 - built), span, ranges: mine.length };
  }
  return out;
}

/**
 * The surface of what is built, at depth 1: the walls (curtains, towers, gatehouses) against the inside (the keep, the
 * ranges). A ward's platform is ground, not wall: a curtain is measured from the ground it stands on inside.
 */
export function castleSurface(c) {
  const F = c.set, sum = (faces) => faces.reduce((a, f) => a + area3(f.corners), 0);
  let walls = 0;
  for (const k of c.curtains) { const Lc = Math.hypot(k.pts[1][0] - k.pts[0][0], k.pts[1][1] - k.pts[0][1]), o = []; FB.bay(o, Lc, F, k.h, { depth: 1, gates: k.gates.map((g) => ({ u: g.s, w: g.w })), seed: 1 }); walls += sum(o); }
  for (const x of c.towers) { const o = []; FB.tower(o, F, x.H, { depth: 1 }); walls += sum(o); }
  for (const g of c.gates) { const o = []; FB.gatehouse(o, F, g.h, Math.min(g.w - 0.6, 6), { depth: 1 }); walls += sum(o); }
  const ko = []; FB.keep(ko, F, c.keep.K, c.keep.H, { depth: 1, base: c.rise });
  const keep = sum(ko), ranges = c.lots.reduce((s, l) => s + sum(l.design.faces), 0);
  return { walls: Math.round(walls), inside: Math.round(keep + ranges), keep: Math.round(keep), ranges: Math.round(ranges) };
}

/** The castle's laws, read off its plan. */
export function castleLaws(c) {
  const want = (id) => CASTLE_LAWS.find((x) => x.id === id).want, B = c.budget, { curtains, towers, gates, keep } = c;
  const wards = Object.entries(B), thin = wards.filter(([, b]) => b.built < 0.4 - 1e-9), wide = wards.filter(([w, b]) => b.span > 26 || (w === 'inner' && b.span < 10));
  // flanking: every 2 m of every curtain within 30 m of a tower, a gatehouse or the keep
  const posts = [...towers.map((x) => x.at), ...gates.map((g) => g.at), keep.at], blind = [];
  for (const k of curtains) { const [a, b] = k.pts, Lc = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= Lc; s += 2) { const p = [a[0] + ((b[0] - a[0]) * s) / Lc, a[1] + ((b[1] - a[1]) * s) / Lc]; if (Math.min(...posts.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1]))) > 30) { blind.push(k.id); break; } } }
  const tallest = Math.max(...towers.map((x) => x.top), ...gates.map((g) => g.top)), wardA = B.inner.area, keepShare = r3((keep.K * keep.K) / wardA);
  // shows-over: the ranges whose roofs stand over the parapet of the wall behind them, by their frontage
  const wallTop = (l) => (l.castle === 'inner' ? Math.max(...curtains.filter((k) => k.ward === 'inner').map((k) => k.top)) : Math.max(...curtains.filter((k) => k.ward === 'fore').map((k) => k.top))) + c.set.parapet.h;
  const shown = c.lots.filter((l) => l.crown > wallTop(l) + 1e-9), shownW = shown.reduce((s, l) => s + l.w, 0), allW = c.lots.reduce((s, l) => s + l.w, 0);
  const innerTop = Math.min(...curtains.filter((k) => k.ward === 'inner').map((k) => k.top)), foreTop = Math.max(0, ...curtains.filter((k) => k.ward === 'fore').map((k) => k.top));
  const outerG = gates.find((g) => g.main), innerG = gates.find((g) => g.ward === 'inner'), offset = c.wards === 2 ? Math.abs(outerG.at[0] - innerG.at[0]) : 0;
  const each = c.wards === 2 ? curtains.filter((k) => k.id === 'south').every((k) => k.gates.length === 1) && curtains.filter((k) => k.id === 'cross').every((k) => k.gates.length === 1) && gates.length === 2 : gates.length === 1;
  const S = castleSurface(c);
  return [
    { law: 'filled', ok: thin.length === 0, value: wards.map(([w, b]) => `${w} ward ${Math.round(b.built * 100)} % built (${b.ranges} ranges${w === 'inner' ? ', the keep' : ''})`).join('; ') },
    { law: 'court-span', ok: wide.length === 0, value: wards.map(([w, b]) => `${w} ${b.span} m`).join(', ') + ' clear at most' },
    { law: 'rich-inside', ok: S.inside >= 0.3 * (S.inside + S.walls) - 1e-9, value: `${Math.round((100 * S.inside) / (S.inside + S.walls))} % inside: the keep ${S.keep} m², the ranges ${S.ranges} m², against the walls' ${S.walls} m²` },
    { law: 'keep-weight', ok: keepShare >= 0.1 - 1e-9 && keep.top >= tallest + 3 - 1e-9, value: `${keep.K} m across, ${Math.round(keepShare * 100)} % of the inner ward; ${r3(keep.top - c.z)} m, over the highest tower or gate (${r3(tallest - c.z)} m) by ${r3(keep.top - tallest)}` },
    { law: 'shows-over', ok: shownW >= allW / 2 - 1e-9, value: `${shown.length} of ${c.lots.length} ranges (${Math.round((100 * shownW) / (allW || 1))} % of their frontage) roofed over the parapet behind them` },
    { law: 'flanking', ok: blind.length === 0, value: blind.length ? `blind: ${blind.join(', ')}` : `${towers.length} towers, ${gates.length} gatehouses and the keep flank ${curtains.length} lengths of curtain` },
    { law: 'commands', ok: c.wards < 2 || innerTop >= foreTop + 1 - 1e-9, value: c.wards < 2 ? 'one ward' : `the inner ward's walls ${r3(innerTop - c.z)} m over the forecourt's ${r3(foreTop - c.z)} m` },
    { law: 'bent-entry', ok: c.wards < 2 || offset >= (outerG.w + innerG.w) / 2 + 0.5, value: c.wards < 2 ? 'one ward: the bridge runs straight to the gate' : `the inner gate ${r3(offset)} m across from the outer: the walk turns twice` },
    { law: 'one-gate-each', ok: each, value: `${gates.length} gate${gates.length > 1 ? 's' : ''}: ${gates.map((g) => `${g.ward === 'fore' ? 'the forecourt' : 'the inner ward'} by ${g.form}`).join(', ')}` },
    { law: 'climbed', ok: c.stairs.every((x) => x.laws.every((l) => l.ok !== false)), value: c.stairs.length ? c.stairs.map((x) => `${x.rise} m in ${x.risers} × ${x.R}/${x.T} inside the gate`).join('; ') : 'the ward on the ground' },
  ].map((l) => ({ ...l, want: want(l.law) }));
}

/** The laws a castle keeps: its budget first, then the fortification's. */
export const CASTLE_LAWS = Object.freeze([
  { id: 'filled', want: 'every ward at least 40 % built (the ranges, the keep): the court is what is left', why: 'the walls are spent on what they keep: a ward is its buildings, not its grass' },
  { id: 'court-span', want: 'the largest open square in the inner court 10–26 m, in a forecourt under 26 m', why: 'room to arrive and turn a cart, no field to cross; a forecourt is a walk' },
  { id: 'rich-inside', want: 'the keep and the ranges at least 30 % of all the surface built (at depth 1)', why: 'the eye is paid inside for what the wall costs it outside' },
  { id: 'keep-weight', want: 'the keep at least 10 % of the inner ward, over every tower and gate by 3 m', why: 'the keep is the lord: the castle\'s centre of gravity in plan and on the skyline' },
  { id: 'shows-over', want: 'half the ranges\' frontage roofed over the parapet behind it', why: 'from outside, the roofs over the wall say the castle is lived in' },
  { id: 'flanking', want: 'every stretch of curtain within 30 m of a tower, a gatehouse or the keep', why: 'a wall is kept from its towers: a face no tower sees is a face to climb' },
  { id: 'commands', want: 'with a forecourt, the inner ward\'s walls a metre over the forecourt\'s', why: 'the inner ward shoots over the outer: losing the forecourt loses nothing' },
  { id: 'bent-entry', want: 'with a forecourt, the inner gate off the outer\'s line: the walk turns twice', why: 'a straight run from gate to gate is a run for a ram' },
  { id: 'one-gate-each', want: 'one gate into each ward', why: 'every door is a door to keep' },
  { id: 'climbed', want: 'the platform climbed by a flight that holds the steps\' laws', why: 'a level the walk cannot climb is a wall; a stair out of stride trips' },
]);

/**
 * The castle as faces, in place: `walls` (each curtain in 10 m bays, every tower, every gatehouse), `keep`, the ranges
 * (`groups` holds them all as groups, the ranges too unless `lots: false`, a town drawing them as its own lots), and the
 * `floor` (the courts, the walk, the platform, the ditch and its bridge). Depth `most` (3 the bays' paving).
 */
export function castleFaces(c, { most = 3, lots = true } = {}) {
  const F = c.set, walls = [], floor = [], extra = [];
  const place = (faces, o, ex, ey, z) => faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, h]) => [r3(o[0] + ex[0] * x + ey[0] * y), r3(o[1] + ex[1] * x + ey[1] * y), r3(z + h)]), normal: [ex[0] * f.normal[0] + ey[0] * f.normal[1], ex[1] * f.normal[0] + ey[1] * f.normal[1], f.normal[2]].map(r3) }));
  for (const k of c.curtains) {
    const [a, b] = k.pts, Lc = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / Lc, (b[1] - a[1]) / Lc], n = [-u[1], u[0]];
    for (let s0 = 0; s0 < Lc - 1e-6; s0 += 10) {
      const s1 = Math.min(Lc, s0 + 10), len = s1 - s0, local = [], gs = k.gates.filter((g) => g.s + g.w / 2 > s0 && g.s - g.w / 2 < s1).map((g) => ({ u: g.s - s0, w: g.w }));
      FB.bay(local, len, F, k.h, { depth: most, gates: gs, retain: k.retain, seed: subSeed(c.seed, `${k.id}:${s0}`) });
      walls.push(place(local, [a[0] + u[0] * s0, a[1] + u[1] * s0], u, n, k.z));
    }
  }
  for (const x of c.towers) { const local = []; FB.tower(local, F, x.H, { depth: Math.min(most, 2) }); const ey = [-x.out[0], -x.out[1]]; walls.push(place(local, x.at, [ey[1], -ey[0]], ey, x.z)); }
  for (const g of c.gates) { const local = []; FB.gatehouse(local, F, g.h, Math.min(g.w - 0.6, 6), { depth: Math.min(most, 2) }); walls.push(place(local, g.at, g.u, g.n, g.z)); }
  // the keep: its field to the north, its forebuilding toward the court
  const kl = []; FB.keep(kl, F, c.keep.K, c.keep.H, { depth: Math.min(most, 2), base: c.rise });
  const keep = place(kl, c.keep.at, [c.keep.side, 0], [0, -1], c.keep.z);
  // the flight inside the inner gate: a block to each riser, between the platform's cheeks
  const q = (pts, group, value, normal = [0, 0, 1]) => ({ corners: pts.map((p) => p.map(r3)), normal, part: 'ground', group, value });
  for (const s of c.stairs) {
    const g = [], xa = s.at[0] - s.width / 2, xb = s.at[0] + s.width / 2, y0 = s.at[1] + 0.2;
    for (let i = 0; i < s.risers; i++) { const ya = y0 + (i * s.run) / s.risers, z = s.z0 + (i + 1) * s.R; g.push(q([[xa, ya, z], [xb, ya, z], [xb, y0 + s.run + 0.2, z], [xa, y0 + s.run + 0.2, z]], 'str:stone', 0.72)); g.push(q([[xa, ya, z - s.R], [xb, ya, z - s.R], [xb, ya, z], [xa, ya, z]], 'str:stone', 0.52, [0, -1, 0])); }
    const sl = c.slot, zt = s.z0 + s.rise;
    for (const [x, nx] of [[sl.x[0], 1], [sl.x[1], -1]]) g.push(q([[x, sl.y[0], s.z0], [x, sl.y[1], s.z0], [x, sl.y[1], zt], [x, sl.y[0], zt]], F.curtain.group, F.curtain.value, [nx, 0, 0]));
    g.push(q([[sl.x[0], sl.y[1], s.z0], [sl.x[1], sl.y[1], s.z0], [sl.x[1], sl.y[1], zt], [sl.x[0], sl.y[1], zt]], F.curtain.group, F.curtain.value, [0, -1, 0]));
    extra.push(g);
  }
  // the floor: the forecourt's ground and its walk; the platform, cut where the flight comes up; the ditch, the bridge
  if (c.courts.fore) floor.push(q(c.courts.fore.map(([x, y]) => [x, y, c.z + 0.01]), 'town:soil', 0.5));
  for (const p of c.paths) for (let i = 1; i < p.pts.length; i++) { const [a, b] = [p.pts[i - 1], p.pts[i]], Lp = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / Lp, (b[1] - a[1]) / Lp], n = [-u[1] * p.w / 2, u[0] * p.w / 2], e = [u[0] * p.w / 2, u[1] * p.w / 2]; floor.push(q([[a[0] - n[0] - e[0], a[1] - n[1] - e[1], p.z + 0.03], [b[0] - n[0] + e[0], b[1] - n[1] + e[1], p.z + 0.03], [b[0] + n[0] + e[0], b[1] + n[1] + e[1], p.z + 0.03], [a[0] + n[0] - e[0], a[1] + n[1] - e[1], p.z + 0.03]], 'town:stone', 0.7)); }
  {
    const [[x0, y0], [x1], , [, y1]] = c.courts.inner, zt = c.z + c.rise + 0.01, sl = c.slot;
    const rects = sl ? [[x0, y0, sl.x[0], y1], [sl.x[1], y0, x1, y1], [sl.x[0], sl.y[1], sl.x[1], y1]] : [[x0, y0, x1, y1]];
    for (const [a, b, d, e] of rects) floor.push(q([[a, b, zt], [d, b, zt], [d, e, zt], [a, e, zt]], 'town:stone', 0.64));
    if (sl) floor.push(q([[sl.x[0], c.courts.inner[0][1] - c.t, c.z + 0.02], [sl.x[1], c.courts.inner[0][1] - c.t, c.z + 0.02], [sl.x[1], sl.y[0] + 0.2, c.z + 0.02], [sl.x[0], sl.y[0] + 0.2, c.z + 0.02]], 'town:stone', 0.6));
  }
  const { inner, outer } = c.ditch;
  inner.forEach((p, k) => { const nq = inner[(k + 1) % inner.length], Q = outer[(k + 1) % outer.length], P = outer[k]; floor.push(q([[p[0], p[1], c.z + 0.01], [nq[0], nq[1], c.z + 0.01], [Q[0], Q[1], c.z + 0.01], [P[0], P[1], c.z + 0.01]], 'town:soil', 0.22)); });
  for (const br of c.bridges) { const o = [-br.u[1], br.u[0]], at = (s, k) => [br.at[0] - o[0] * s + br.u[0] * k, br.at[1] - o[1] * s + br.u[1] * k, c.z + 0.06]; floor.push(q([at(br.from, -br.w / 2), at(br.from, br.w / 2), at(br.to, br.w / 2), at(br.to, -br.w / 2)], 'str:timber', 0.45)); }
  const ranges = lots ? c.lots.map((l) => { const { o, ex, ey } = l.place; return [...l.design.faces, ...(most >= 2 ? l.design.tile : [])].map((f) => ({ ...f, corners: f.corners.map((p) => [r3(o[0] + ex[0] * p[0] + ey[0] * p[1]), r3(o[1] + ex[1] * p[0] + ey[1] * p[1]), r3(o[2] + p[2])]), normal: [ex[0] * f.normal[0] + ey[0] * f.normal[1], ex[1] * f.normal[0] + ey[1] * f.normal[1], f.normal[2]].map(r3) })); }) : [];
  return { walls, keep, groups: [...walls, keep, ...extra, ...ranges], floor };
}
