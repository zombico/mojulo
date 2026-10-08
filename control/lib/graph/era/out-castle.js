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

/** The keep's breadth: a third of the ward's and more, 14–20 m; a round keep a ninth broader, to weigh as much as a square. */
const keepSide = (W, F = null, INF = null) => { const k = clamp(Math.round(0.72 * W) / 2, 14, 20); return INF?.keep === 'orbs' || (!INF?.keep && F?.tower.plan === 'round' && F?.tower.crown !== 'tiers') ? r3(k * 1.13) : k; };
/**
 * How far the castle reaches past its curtain's line: the berm (clear of the towers and the keep's corner), the ditch,
 * the glacis kept clear before it. Known from the recipe alone, so a town can make room before the castle is designed.
 */
export function castleMoat(recipe = {}, { language = null } = {}) {
  const P = readCastlePlan(recipe), F0 = composeFort(P.fort), INF = language ? influenceOf(language, F0) : null, F = INF?.fort ?? F0, t = F.curtain.t, K = keepSide(P.size, F, INF), round = INF?.trace === 'ellipse';
  // (drawn round, the keep stands at a focus inside the wall: only the towers reach past it)
  const d0 = r3(round ? t / 2 + F.towerDims.proud + 1.5 : Math.max(t / 2 + F.towerDims.proud + 1.5, Math.SQRT2 * (0.3 * K - t / 2) + 1.5)), d1 = r3(d0 + F.ditch.w);
  return { F, d0, d1, glacis: r3(d1 + 6) };
}

const area = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
/** The area of a face in 3D (its corners' cross products). */
const area3 = (c) => { let x = 0, y = 0, z = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; x += p[1] * q[2] - p[2] * q[1]; y += p[2] * q[0] - p[0] * q[2]; z += p[0] * q[1] - p[1] * q[0]; } return Math.hypot(x, y, z) / 2; };
const inPoly = (q, x, y) => { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
/** The keep's footprint: a square, or a ring for a drum or a stack of orbs. */
const keepFoot = (k) => (k.form === 'orbs' || k.plan === 'round' ? Array.from({ length: 16 }, (_, i) => [k.at[0] + (k.K / 2) * Math.cos((i * Math.PI) / 8), k.at[1] + (k.K / 2) * Math.sin((i * Math.PI) / 8)]) : [[k.at[0] - k.K / 2, k.at[1] - k.K / 2], [k.at[0] + k.K / 2, k.at[1] - k.K / 2], [k.at[0] + k.K / 2, k.at[1] + k.K / 2], [k.at[0] - k.K / 2, k.at[1] + k.K / 2]]);
const segDist = ([a, b], x, y) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); return Math.hypot(x - a[0] - dx * k, y - a[1] - dy * k); };

/** The language an anchor recipe names (an id, its pieces or elements, or { seed }), else the kit's. */
const languageOf = (anchor, style) => (anchor && typeof anchor === 'object' && anchor.seed !== undefined && !anchor.pieces && !anchor.elements ? decompileAnchor(seedAnchor(anchor.seed)) : decompileAnchor(anchor ?? style.anchor));

/**
 * THE STYLE'S INFLUENCE: a castle is designed by the language it keeps, not chosen from a list. Its rules read the
 * anchor's elements (its mass, its cap, its tiers) and turn them on the fortification's.
 */
export const STYLE_INFLUENCE = Object.freeze([
  { id: 'trace', rule: 'the wall is drawn in the language\'s plan: a language that builds round (a shell, a drum) draws its curtain as an ellipse, as long as its masses are, the keep at one focus, the hall at the other, the wards nested rings; a block draws a rectangle, the keep on its back corner' },
  { id: 'crown', rule: 'the language\'s cap speaks on the towers: a language of shells or domes crowns them with domes (on drums); a flat-roofed one carries the bay\'s crenels round them; a pitched one leaves the fortification its own crown' },
  { id: 'keep', rule: 'the keep is the language\'s landmark at the castle\'s scale: shells stack into orbs; tiers under flat roofs step into a platform with its shrine; otherwise the tower derived from the bay, broadened' },
]);
/** The style's influence on a fortification: its trace (and the ellipse's aspect), the towers' crown, the keep's form. */
export function influenceOf(L, F) {
  const V = L.vocab, round = V.mass === 'shell' || V.mass === 'drum', domed = V.mass === 'shell' || V.cap === 'dome', flat = V.cap === 'flat';
  const crown = domed ? 'dome' : flat && ['cone', 'hip', 'tiers'].includes(F.tower.crown) ? 'crenel' : F.tower.crown, plan = crown === 'dome' ? 'round' : F.tower.plan;
  const fort = crown === F.tower.crown && plan === F.tower.plan ? F : composeFort({ ...F, tower: { ...F.tower, plan, crown } });
  const keep = V.mass === 'shell' ? 'orbs' : V.tiers && flat ? 'stepped' : null;
  return { trace: round ? 'ellipse' : 'rect', aspect: round ? clamp(r3(L.proportions.aspect ?? 1.2), 1.1, 1.45) : null, crown, keep, fort, read: [round ? `drawn round (its masses are ${V.mass}s): an ellipse` : 'drawn square (its masses are blocks)', crown !== F.tower.crown ? `towers crowned ${crown} (its cap is ${V.cap ?? 'its shell'})` : `towers keep their ${crown}`, keep ? `the keep ${keep === 'orbs' ? 'a stack of orbs' : 'stepped, a shrine on its platform'}` : 'the keep the tower broadened'] };
}

/**
 * The castle, laid out in place: `at` is the gate's centre on the outer curtain's line (the bridge comes up to it from
 * the south) and the ground's height there. `language` is the anchor its ranges are spoken in (the town's, or the
 * recipe's `anchor`, or the kit's); the style's influence (STYLE_INFLUENCE) draws the rest from it.
 */
export function designCastle(style, seed = 1, recipe = {}, { language = null, at = [0, 0, 0] } = {}) {
  const C = CASTLE_CARD, P = readCastlePlan(recipe), D = dice(subSeed(seed, 'castle'));
  const L = language ?? languageOf(P.anchor, style), INF = influenceOf(L, composeFort(P.fort)), F = INF.fort;
  const t = F.curtain.t, ph = F.parapet.h, TD = F.towerDims, bat = F.curtain.base === 'battered', moat = castleMoat(recipe, { language: L });
  // ── the measures: the ward's breadth and depth, its platform, the walls' heights (the castle is the dial at its end) ──
  const W = P.size, Dd = r3(Math.max(C.hall + C.yard + 12, W * D.roll([0.92, 1.1]))), rise = r3(P.rise ?? (bat ? 5 : 1.5)), RT = RAMPART[1];
  // the walls are cut to what they keep: no higher than the language's lodgings can show over (a shell rises only so far)
  const reach = speak(L, 'dwelling', { w: 7, d: 10 }, style, subSeed(seed, 'castle:reach'), { ring: 'near', crown: 99, over: { side: 0, front: 0.6, rear: 0.15 } }).measures.ridge;
  const Hin = r3(Math.max(ph + 2.5, Math.min(RT - rise + 1.5, reach - ph - 1))), Hout = r3(Math.max(ph + 2.5, Math.min(RT - 2, Hin + rise - 1, reach - ph - 1))), wards = P.wards, Df = wards === 2 ? r3(D.roll(C.fore)) : 0;
  // (the ranges deepen with the ward, so the court does not grow into a field)
  const dS = r3(clamp((D.roll(C.range) * W) / 44, C.range[0], 14)), dN = C.hall, dF = r3(clamp(0.25 * W, C.yard, 14)), dSo = C.yard, K = keepSide(W, F, INF);
  const Z = at[2], gw = r3(F.gate.clear + 1.2), made = madeStyle(style.kitId, seed), unit = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l]; };
  // the flight inside the inner gate, up to the platform, its going the man-made index's
  const flight = (() => {
    if (!(rise > 0)) return null;
    const X0 = designPiece('steps', made, seed).dims, n = Math.ceil(rise / X0.riserMax - 1e-9), R = r3(rise / n), Tr = r3(X0.blondel - 2 * R), flights = Math.ceil(n / 10), run = r3(n * Tr + (flights - 1) * X0.landing);
    return { width: C.stair, z0: Z, rise, risers: n, R, T: Tr, run, flights, landing: X0.landing, laws: madeLaws('steps', { blondel: r3(2 * R + Tr), R, T: Tr, uneven: 0, flight: Math.ceil(n / flights) }) };
  })();
  const nIn = clamp(Math.ceil((Hin + ph) / 3), 2, 3), nOut = clamp(Math.ceil((Hout + ph) / 3), 2, 3), over = Math.max(TD.over, 0.4 * RT);
  const raise = (towers, curtains) => { for (const x of towers) { x.z = Z; const on = curtains.filter((c) => segDist(c.pts, ...x.foot) < 1); x.top = r3(Math.max(...on.map((c) => c.top)) + ph + over); x.H = r3(x.top - x.z); } };
  const keepOver = (kc, towers, gates, extra) => { const highest = Math.max(...towers.map((x) => x.top), ...gates.map((g) => g.top)), k = { at: kc, K, z: Z, base: rise, H: r3(highest + 4 - Z), form: INF.keep, plan: INF.keep ?? (F.tower.crown === 'tiers' ? 'tiers' : F.tower.plan), ...extra }; k.top = r3(Z + k.H); return k; };

  // ── drawn square: the keep on the back corner, ranges along four straight walls ──
  const squarePlan = () => {
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
    const keep = keepOver(kc, towers, gates, { side: sK, forebuilding: INF.keep || F.tower.crown === 'tiers' || F.tower.plan === 'round' ? null : fore });

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
    // ── the walk through the forecourt, the courts, the ditch and its bridge ──
    const paths = wards === 2 ? [{ pts: [[X(gOut), yS], [X(gOut), yT], [X(gIn), yT], [X(gIn), yX]], w: 4, z: Z }] : [];
    const ring = (d) => octagon(xL - d, yS - d, xR + d, yN + d, d * (2 - Math.SQRT2));
    const ditch = { inner: ring(moat.d0), outer: ring(moat.d1), depth: F.ditch.depth, w: F.ditch.w, d0: moat.d0, d1: moat.d1 };
    const main = gates.find((g) => g.main), bridges = [{ at: main.at, u: main.u, from: moat.d0 - 0.5, to: moat.d1 + 0.5, w: Math.min(main.w, 5) }];
    const courts = { inner: [[x0, yi0], [x1, yi0], [x1, yi1], [x0, yi1]], fore: wards === 2 ? [[x0, y0], [x1, y0], [x1, r3(y0 + Df)], [x0, r3(y0 + Df)]] : null };
    // the chapel's room: what the ranges leave between them, measured as built
    const chapel = () => { const side = (id, f) => lots.filter((l) => l.side === id).flatMap((l) => l.foot.map(f)); const cx0 = Math.max(x0, ...side('west', (p) => p[0])), cx1 = Math.min(x1, ...side('east', (p) => p[0])), cy0 = Math.max(yi0, ...side('south-w', (p) => p[1]), ...side('south-e', (p) => p[1])), cy1 = Math.min(yi1, ...side('north', (p) => p[1]), ky); return [{ at: [(cx0 + cx1) / 2, (cy0 + cy1) / 2], w: cx1 - cx0 - 6, d: cy1 - cy0 - 6 }]; };
    const cxm = X(0), mg = gates.find((g) => g.main);
    return { curtains, gates, towers, keep, stairs, slot, lots, paths, courts, ditch, bridges, extent: { x0: xL, x1: xR, y0: yS, y1: yN }, chapel, Df, D: Dd, marks: { court: [cxm, (yi0 + yi1) / 2], fore: wards === 2 ? [cxm - (mg.at[0] - cxm) * 0.4, y0 + Df - 1.5] : null } };
  };

  // ── drawn round: an ellipse as long as the language's masses, the keep at one focus, the wards nested rings ──
  const roundPlan = () => {
    // (the forecourt ring as wide as its ranges stand deep and the walk under the inner wall)
    const a = W / 2, b = r3(a * INF.aspect), band = r3(clamp(Math.min(L.proportions.reach ?? 10, 10) + 5, 12.5, 15)), s = D.R() < 0.5 ? 1 : -1;
    const perim = (A, B) => Math.PI * (3 * (A + B) - Math.sqrt((3 * A + B) * (A + 3 * B)));
    const nOf = (A, B) => clamp(4 * Math.round(perim(A, B) / 52), 12, 28);
    // (the forecourt ring's lengths of wall a building and its gap long, so its ranges line it close)
    const Ai = a + t / 2, Bi = b + t / 2, Ao = a + 1.5 * t + band, Bo = b + 1.5 * t + band, nI = nOf(Ai, Bi), nO = clamp(4 * Math.round(perim(Ao, Bo) / (4 * (Math.min(L.proportions.reach ?? 10, 12) + 2))), 12, 40), [Ac, Bc, nc] = wards === 2 ? [Ao, Bo, nO] : [Ai, Bi, nI];
    const cx = r3(at[0]), cy = r3(at[1] + Bc * Math.cos(Math.PI / nc));
    // the vertices of an ellipse of semi-axes A, B in n chords, a chord centred due south (so due east and west too)
    const ring = (A, B, n) => Array.from({ length: n }, (_, k) => { const th = -Math.PI / 2 + Math.PI / n + (2 * Math.PI * k) / n; return [r3(cx + A * Math.cos(th)), r3(cy + B * Math.sin(th))]; });
    const chords = (poly) => poly.map((p, k) => { const q = poly[(k + 1) % poly.length], Lc = Math.hypot(q[0] - p[0], q[1] - p[1]), u = [(q[0] - p[0]) / Lc, (q[1] - p[1]) / Lc], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; return { k, a: p, b: q, L: Lc, u, n: [-u[1], u[0]], m, th: Math.atan2((m[1] - cy) / Bc, (m[0] - cx) / Ac) }; });
    const nearest = (cs, th) => cs.reduce((best, c) => (Math.abs(Math.atan2(Math.sin(c.th - th), Math.cos(c.th - th))) < Math.abs(Math.atan2(Math.sin(best.th - th), Math.cos(best.th - th))) ? c : best));
    // the keep at the far end of the long axis, a third of it out past the wall (read from outside and in, as drawn
    // square); the hall's ground at the near focus
    const f = Math.sqrt(Math.max(0, b * b - a * a)), kc = [cx, r3(cy + b - 0.2 * K)], kR = K / 2 + 0.3, inK = (p) => Math.hypot(p[0] - kc[0], p[1] - kc[1]) < kR;
    // a wall that meets the keep stops at its face
    const toKeep = (p, q) => { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, x = [p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m]; if (inK(x)) hi = m; else lo = m; } return [r3(p[0] + (q[0] - p[0]) * (hi + 0.02)), r3(p[1] + (q[1] - p[1]) * (hi + 0.02))]; };
    const curtains = [], inner = { h: Hin, retain: rise }, outer = { h: Hout, retain: 0 };
    const lay = (poly, ward, H) => chords(poly).flatMap((c) => {
      const ka = ward === 'inner' && inK(c.a), kb = ward === 'inner' && inK(c.b);
      if (ka && kb) return [];
      const pts = ka ? [toKeep(c.b, c.a), c.b] : kb ? [c.a, toKeep(c.a, c.b)] : [c.a, c.b], k = { id: `${ward}-${c.k}`, ward, pts, z: Z, t, ...H, top: r3(Z + H.retain + H.h), gates: [], chord: c };
      curtains.push(k); return [k];
    });
    const innerC = lay(ring(Ai, Bi, nI), 'inner', inner), outerC = wards === 2 ? lay(ring(Ao, Bo, nO), 'fore', outer) : [];
    const gates = [];
    const gate = (k, ward, main) => { const c = k.chord; k.gates.push({ s: r3(c.L / 2), w: gw }); gates.push({ id: `g${gates.length}`, curtain: k.id, ward, at: c.m.map(r3), u: c.u, n: c.n, w: gw, z: Z, h: r3(k.retain + k.h), form: F.gate.form, main, top: r3(Z + k.retain + k.h + ph + 3) }); return c; };
    const mainC = wards === 2 ? gate(outerC.find((k) => k.chord === nearest(outerC.map((x) => x.chord), -Math.PI / 2)), 'fore', true) : null;
    const inC = gate(innerC.find((k) => k.chord === nearest(innerC.map((x) => x.chord), wards === 2 ? (s > 0 ? 0 : Math.PI) : -Math.PI / 2)), 'inner', wards !== 2);
    // the towers: every other vertex of each ring, standing out of the face along the ellipse's normal
    const towers = [];
    const put = (p, A, B, kind) => {
      if (Math.hypot(p[0] - kc[0], p[1] - kc[1]) < kR + TD.w / 2) return;
      if (towers.some((x) => Math.hypot(x.foot[0] - p[0], x.foot[1] - p[1]) < TD.w) || gates.some((g) => Math.hypot(g.at[0] - p[0], g.at[1] - p[1]) < g.w / 2 + TD.w)) return;
      const o = unit([(p[0] - cx) / (A * A), (p[1] - cy) / (B * B)]), off = t / 2 + TD.proud - TD.w / 2;
      towers.push({ id: `t${towers.length}`, kind, foot: p, at: [r3(p[0] + o[0] * off), r3(p[1] + o[1] * off)], out: o });
    };
    for (const [poly, A, B] of [[ring(Ai, Bi, nI), Ai, Bi], ...(wards === 2 ? [[ring(Ao, Bo, nO), Ao, Bo]] : [])]) { const step = Math.max(1, Math.round(C.spacing / chords(poly)[0].L)); poly.forEach((p, k) => { if (k % step === 0) put(p, A, B, 'rhythm'); }); }
    raise(towers, curtains);
    const keep = keepOver(kc, towers, gates, { side: 1, forebuilding: null, focus: true });
    // the flight: inside the inner gate, inward along the gate's normal
    const stairs = [], start = [r3(inC.m[0] + inC.n[0] * (t / 2)), r3(inC.m[1] + inC.n[1] * (t / 2))];
    if (flight) stairs.push({ ...flight, at: start, dir: inC.n });
    const slotPoly = flight ? (() => { const e = [inC.n[1], -inC.n[0]], hw = C.stair / 2 + 0.3, Ls = flight.run + 0.6; return [[-hw, 0], [hw, 0], [hw, Ls], [-hw, Ls]].map(([v, u]) => [start[0] + e[0] * v + inC.n[0] * u, start[1] + e[1] * v + inC.n[1] * u]); })() : null;
    // the ranges: a lot on each chord of the ring's inner face, backed onto it, narrowed so the fronts do not meet
    const lots = [], keepR = (INF.keep === 'stepped' || (!INF.keep && F.tower.plan === 'square') ? K * 0.72 : K / 2) + 1;
    const clear = (pts) => pts.every((p) => Math.hypot(p[0] - kc[0], p[1] - kc[1]) > keepR) && !(slotPoly && pts.some((p) => inPoly(slotPoly, ...p)));
    const ringLots = (poly, ward, d, uses, skip, z) => chords(poly).forEach((c) => {
      if (skip.includes(c.k)) return;
      // (a round mass stands no deeper than it is wide: the fronts are narrowed for the building, not the whole lot)
      const ey = [-c.n[0], -c.n[1]], ex = [ey[1], -ey[0]], room = c.L - 2 * Math.min(d, 7) * Math.tan(Math.PI / poly.length) - 0.4, parts = room > 16 ? 2 : 1, w = r3(room / parts);
      if (w < 5.5) return;
      for (let i = 0; i < parts; i++) {
        const F0 = [c.b[0] + c.n[0] * d, c.b[1] + c.n[1] * d], u0 = (c.L - room) / 2 + i * w, A = [r3(F0[0] + ex[0] * u0), r3(F0[1] + ex[1] * u0)];
        // (clear where the building will stand: backed onto the wall, no deeper than it is wide)
        const v0 = Math.max(0, d - Math.min(d, w + 0.5)), pts = [[A[0] + ey[0] * v0, A[1] + ey[1] * v0], [A[0] + ex[0] * w + ey[0] * v0, A[1] + ex[1] * w + ey[1] * v0], [A[0] + ex[0] * w + ey[0] * d, A[1] + ex[1] * w + ey[1] * d], [A[0] + ey[0] * d, A[1] + ey[1] * d], [A[0] + ex[0] * w / 2 + ey[0] * (v0 + d) / 2, A[1] + ex[1] * w / 2 + ey[1] * (v0 + d) / 2]];
        if (!clear(pts)) continue;
        const near = Math.abs(Math.atan2(Math.sin(c.th + Math.PI / 2), Math.cos(c.th + Math.PI / 2))) < 0.8, want = near ? uses[1] : uses[(c.k + i) % 2 ? 2 : 0];
        const use = [want, 'workshop', 'dwelling'].find((x) => w >= STRUCTURE_USES[x].lot.w - 1e-9 && d >= STRUCTURE_USES[x].lot.d - 1e-9);
        if (use) lots.push({ route: 'castle', side: `${ward}-ring`, castle: ward, A, ex, ey, w, d, use, k: c.k * 2 + i, s: c.k, z, ring: 'near' });
      }
    });
    const inPolyI = ring(a, b, nI), outPolyI = wards === 2 ? ring(Ao - t / 2, Bo - t / 2, nO) : null;
    ringLots(inPolyI, 'inner', dS, ['dwelling', 'barn', 'workshop'], [inC.k], r3(Z + rise));
    if (wards === 2) ringLots(outPolyI, 'fore', 10, ['dwelling', 'barn', 'workshop'], [mainC.k], Z);
    // the walk round the forecourt under the inner wall, from the outer gate to the inner, a quarter of the ring
    const paths = [];
    if (wards === 2) {
      const Ap = a + t + 2.5, Bp = b + t + 2.5, th1 = s > 0 ? 0 : -Math.PI, pts = [mainC.m.map(r3)];
      for (let k = 0; k <= 9; k++) { const th = -Math.PI / 2 + ((th1 + Math.PI / 2) * k) / 9; pts.push([r3(cx + Ap * Math.cos(th)), r3(cy + Bp * Math.sin(th))]); }
      pts.push(inC.m.map(r3));
      paths.push({ pts, w: 4, z: Z });
    }
    const courts = { inner: inPolyI, fore: outPolyI, foreHole: wards === 2 ? ring(a + t, b + t, nI) : null };
    const ringAt = (d) => ring(Ac + d, Bc + d, nc);
    const ditch = { inner: ringAt(moat.d0), outer: ringAt(moat.d1), depth: F.ditch.depth, w: F.ditch.w, d0: moat.d0, d1: moat.d1 };
    const main = gates.find((g) => g.main), bridges = [{ at: main.at, u: main.u, from: moat.d0 - 0.5, to: moat.d1 + 0.5, w: Math.min(main.w, 5) }];
    // the hall at the near focus, facing the keep across the court; the court's middle if the focus is taken
    const chapel = () => [{ at: [cx, r3(cy - f)], w: 18, d: 18, hall: true }, { at: [cx, cy], w: 16, d: 16 }, ...[[-0.42, 0], [0.42, 0], [-0.3, 0.32], [0.3, 0.32], [-0.3, -0.32], [0.3, -0.32]].map(([u, v]) => ({ at: [r3(cx + a * u), r3(cy + b * v)], w: 12, d: 12 }))];
    return { curtains, gates, towers, keep, stairs, slot: slotPoly ? { poly: slotPoly } : null, lots, paths, courts, ditch, bridges, extent: { x0: r3(cx - Ac), x1: r3(cx + Ac), y0: r3(cy - Bc), y1: r3(cy + Bc) }, chapel, Df: wards === 2 ? band : 0, D: r3(2 * b), centre: [cx, cy], semi: [a, b], marks: { court: [cx, cy], fore: wards === 2 ? [r3(cx - s * (a + t + band / 2)), cy] : null } };
  };

  const plan = INF.trace === 'ellipse' ? roundPlan() : squarePlan(), { lots, keep, courts } = plan;
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
  // a court still wider than a cart's turn and a crossing, measured as built, takes a building of its own: the chapel
  // (or a lodging) in what the ranges leave open, or, drawn round, the hall at the near focus; the largest that keeps
  // the court room to arrive and clear of everything standing
  {
    const probe = { courts, lots, keep }, rooms = plan.chapel();
    const free = (l) => { const pts = [l.A, [l.A[0] + l.w, l.A[1]], [l.A[0] + l.w, l.A[1] + l.d], [l.A[0], l.A[1] + l.d], [l.A[0] + l.w / 2, l.A[1] + l.d / 2]]; const kr = keep.K * 0.75 + 1; return pts.every((p) => Math.hypot(p[0] - keep.at[0], p[1] - keep.at[1]) > kr && (!plan.slot?.poly || !inPoly(plan.slot.poly, ...p)) && (!plan.slot?.x || !(p[0] > plan.slot.x[0] - 1 && p[0] < plan.slot.x[1] + 1 && p[1] < plan.slot.y[1] + 1)) && lots.every((o) => !inPoly(o.foot, ...p)) && inPoly(courts.inner, ...p)); };
    const missOf = (B) => Math.max(0, B.span - 24) + 100 * Math.max(0, 0.4 - B.built);
    // room by room: the hall's focus first (drawn round), then the court's middle, while the court is a field
    rooms.forEach((room, ri) => {
      const B0 = castleBudget(probe).inner;
      if (!room.hall && !missOf(B0)) return;
      const tries = [];
      // (each size where the room asks first, then stepped aside, clear of the flight and what stands)
      const nudge = [[0, 0], [0, 3], [0, 6], [-6, 0], [6, 0], [-6, 4], [6, 4]];
      for (const [use, ds] of [['hall', [16, 14]], ['dwelling', [12, 10]]]) for (const d of ds) for (const w of [16, 14, 12, 10]) if (w >= STRUCTURE_USES[use].lot.w && w <= room.w && d <= room.d) for (const [dx, dy] of nudge) tries.push({ use, w, d, at: [room.at[0] + dx, room.at[1] + dy] });
      // the first that holds the court's span and the ward's share; else the one that comes nearest, room to arrive kept
      const at = (x) => ({ route: 'castle', side: 'court', castle: 'inner', island: true, A: [r3(x.at[0] - x.w / 2), r3(x.at[1] - x.d / 2)], ex: [1, 0], ey: [0, 1], w: x.w, d: x.d, use: x.use, k: ri, s: 0, z: r3(Z + rise), ring: 'near' });
      let best = null;
      for (const x of tries) {
        const l = at(x);
        if (!free(l)) continue;
        lots.push(l); speakLot(l);
        const B = castleBudget(probe).inner;
        lots.pop();
        if (B.span < 10) continue;
        const miss = missOf(B);
        if (!best || miss < best.miss) best = { x, miss };
        if (!miss) break;
      }
      if (best && (best.miss < missOf(B0) || room.hall)) { const l = at(best.x); lots.push(l); speakLot(l); }
    });
  }

  const castle = { recipe: P, set: F, influence: INF, trace: INF.trace, seed, language: L.id, W, D: plan.D, Df: plan.Df, rise, Hin, Hout, wards, t, z: Z, extent: plan.extent, curtains: plan.curtains, towers: plan.towers, gates: plan.gates, keep, stairs: plan.stairs, slot: plan.slot, lots, paths: plan.paths, courts, ditch: plan.ditch, bridges: plan.bridges, glacis: moat.glacis, marks: plan.marks, centre: plan.centre ?? null };
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
    const hole = ward === 'fore' ? c.courts.foreHole : null, x0 = Math.floor(Math.min(...poly.map((p) => p[0]))), x1 = Math.ceil(Math.max(...poly.map((p) => p[0]))), y0 = Math.floor(Math.min(...poly.map((p) => p[1]))), y1 = Math.ceil(Math.max(...poly.map((p) => p[1])));
    const A = area(poly) - (hole ? area(hole) : 0), mine = c.lots.filter((l) => l.castle === ward), rects = mine.map((l) => l.foot);
    if (ward === 'inner') { const k = c.keep; rects.push(keepFoot(k)); if (k.forebuilding) { const f = k.forebuilding; rects.push([[f.x[0], f.y[0]], [f.x[1], f.y[0]], [f.x[1], f.y[1]], [f.x[0], f.y[1]]]); } }
    // a metre grid over the ward (inside its face, outside any ward it rings): each cell built, open, or not the ward's
    const nx = Math.round(x1 - x0), ny = Math.round(y1 - y0), cells = new Uint8Array(nx * ny);
    let mineN = 0, builtN = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + i + 0.5, y = y0 + j + 0.5, k = j * nx + i; if (!inPoly(poly, x, y) || (hole && inPoly(hole, x, y))) { cells[k] = 2; continue; } mineN++; if (rects.some((q) => inPoly(q, x, y))) { cells[k] = 1; builtN++; } }
    const built = builtN / (mineN || 1);
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
  const ko = []; FB.keep(ko, F, c.keep.K, c.keep.H, { depth: 1, base: c.rise, form: c.keep.form });
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
  const tallest = Math.max(...towers.map((x) => x.top), ...gates.map((g) => g.top)), wardA = B.inner.area, keepShare = r3(area(keepFoot(keep)) / wardA);
  // shows-over: the ranges whose roofs stand over the parapet of the wall behind them, by their frontage
  const wallTop = (l) => (l.castle === 'inner' ? Math.max(...curtains.filter((k) => k.ward === 'inner').map((k) => k.top)) : Math.max(...curtains.filter((k) => k.ward === 'fore').map((k) => k.top))) + c.set.parapet.h;
  const shown = c.lots.filter((l) => l.crown > wallTop(l) + 1e-9), shownW = shown.reduce((s, l) => s + l.w, 0), allW = c.lots.reduce((s, l) => s + l.w, 0);
  const innerTop = Math.min(...curtains.filter((k) => k.ward === 'inner').map((k) => k.top)), foreTop = Math.max(0, ...curtains.filter((k) => k.ward === 'fore').map((k) => k.top));
  // (the inner gate off the outer's line: its offset across the outer gate's passage)
  const outerG = gates.find((g) => g.main), innerG = gates.find((g) => g.ward === 'inner'), offset = c.wards === 2 ? Math.abs((innerG.at[0] - outerG.at[0]) * outerG.u[0] + (innerG.at[1] - outerG.at[1]) * outerG.u[1]) : 0;
  const each = c.wards === 2 ? gates.filter((g) => g.ward === 'fore').length === 1 && gates.filter((g) => g.ward === 'inner').length === 1 : gates.length === 1;
  const S = castleSurface(c);
  return [
    { law: 'filled', ok: thin.length === 0, value: wards.map(([w, b]) => `${w} ward ${Math.round(b.built * 100)} % built (${b.ranges} ranges${w === 'inner' ? ', the keep' : ''})`).join('; ') },
    { law: 'court-span', ok: wide.length === 0, value: wards.map(([w, b]) => `${w} ${b.span} m`).join(', ') + ' clear at most' },
    { law: 'rich-inside', ok: S.inside >= 0.3 * (S.inside + S.walls) - 1e-9, value: `${Math.round((100 * S.inside) / (S.inside + S.walls))} % inside: the keep ${S.keep} m², the ranges ${S.ranges} m², against the walls' ${S.walls} m²` },
    { law: 'keep-weight', ok: keepShare >= 0.1 - 1e-9 && keep.top >= tallest + 3 - 1e-9, value: `${keep.K} m across, ${Math.round(keepShare * 100)} % of the inner ward; ${r3(keep.top - c.z)} m, over the highest tower or gate (${r3(tallest - c.z)} m) by ${r3(keep.top - tallest)}` },
    { law: 'shows-over', ok: shownW >= allW / 2 - 1e-9, value: `${shown.length} of ${c.lots.length} ranges (${Math.round((100 * shownW) / (allW || 1))} % of their frontage) roofed over the parapet behind them` },
    { law: 'flanking', ok: blind.length === 0, value: blind.length ? `blind: ${blind.join(', ')}` : `${towers.length} towers, ${gates.length} gatehouses and the keep flank ${curtains.length} lengths of curtain` },
    { law: 'commands', ok: c.wards < 2 || innerTop >= foreTop + 1 - 1e-9, value: c.wards < 2 ? 'one ward' : `the inner ward's walls ${r3(innerTop - c.z)} m over the forecourt's ${r3(foreTop - c.z)} m` },
    { law: 'bent-entry', ok: c.wards < 2 || offset >= (outerG.w + innerG.w) / 2 + 0.5, value: c.wards < 2 ? 'one ward: the bridge runs straight to the gate' : `the inner gate ${r3(offset)} m across from the outer: the walk ${c.trace === 'ellipse' ? 'turns round the ring under the inner wall' : 'turns twice'}` },
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
  const kl = []; FB.keep(kl, F, c.keep.K, c.keep.H, { depth: Math.min(most, 2), base: c.rise, form: c.keep.form });
  const keep = place(kl, c.keep.at, [c.keep.side, 0], [0, -1], c.keep.z);
  // the flight inside the inner gate: a block to each riser, between the platform's cheeks
  const q = (pts, group, value, normal = [0, 0, 1]) => ({ corners: pts.map((p) => p.map(r3)), normal, part: 'ground', group, value });
  for (const s of c.stairs) {
    // in the flight's own frame: u up the flight (its direction), v across it
    const g = [], d = s.dir, e = [d[1], -d[0]], hw = s.width / 2, P = (u, v, z) => [s.at[0] + d[0] * u + e[0] * v, s.at[1] + d[1] * u + e[1] * v, z], N = (nu, nv, nz) => [d[0] * nu + e[0] * nv, d[1] * nu + e[1] * nv, nz], end = s.run + 0.4, zt = s.z0 + s.rise, cw = hw + 0.3;
    for (let i = 0; i < s.risers; i++) { const ua = 0.2 + (i * s.run) / s.risers, z = s.z0 + (i + 1) * s.R; g.push(q([P(ua, -hw, z), P(ua, hw, z), P(end, hw, z), P(end, -hw, z)], 'str:stone', 0.72)); g.push(q([P(ua, -hw, z - s.R), P(ua, hw, z - s.R), P(ua, hw, z), P(ua, -hw, z)], 'str:stone', 0.52, N(-1, 0, 0))); }
    for (const sv of [-1, 1]) g.push(q([P(0, sv * cw, s.z0), P(end, sv * cw, s.z0), P(end, sv * cw, zt), P(0, sv * cw, zt)], F.curtain.group, F.curtain.value, N(0, -sv, 0)));
    g.push(q([P(end, -cw, s.z0), P(end, cw, s.z0), P(end, cw, zt), P(end, -cw, zt)], F.curtain.group, F.curtain.value, N(-1, 0, 0)));
    extra.push(g);
  }
  // the floor: the forecourt's ground and its walk; the platform (drawn square, cut where the flight comes up); the
  // ditch, the bridge
  if (c.courts.fore) floor.push(q(c.courts.fore.map(([x, y]) => [x, y, c.z + 0.01]), 'town:soil', 0.5));
  for (const p of c.paths) for (let i = 1; i < p.pts.length; i++) { const [a, b] = [p.pts[i - 1], p.pts[i]], Lp = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / Lp, (b[1] - a[1]) / Lp], n = [-u[1] * p.w / 2, u[0] * p.w / 2], e = [u[0] * p.w / 2, u[1] * p.w / 2]; floor.push(q([[a[0] - n[0] - e[0], a[1] - n[1] - e[1], p.z + 0.03], [b[0] - n[0] + e[0], b[1] - n[1] + e[1], p.z + 0.03], [b[0] + n[0] + e[0], b[1] + n[1] + e[1], p.z + 0.03], [a[0] + n[0] - e[0], a[1] + n[1] - e[1], p.z + 0.03]], 'town:stone', 0.7)); }
  if (c.trace === 'ellipse') floor.push(q(c.courts.inner.map(([x, y]) => [x, y, c.z + c.rise + 0.01]), 'town:stone', 0.64));
  else {
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
