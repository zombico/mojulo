/** body-garment.js — GARMENTS WITH VOLUME that follow the body's own geometry: a garment piece is a new L1 part copied
 * from a body part's rings over a window, each ring point carried outward by the piece's EASE (m, off the ring's
 * centre) and lifted over every layer beneath it (the hull of its `over` parts and of the garments already worn on
 * that part: a shirt over the breasts, a hem over the trousers), so it takes the body's shape and keeps clear of it.
 *
 * It FOLLOWS: each garment ring carries its body ring's station id and so its bind (station-loft-rig.js bindLayered
 * reads the blend by station), so the garment skins vertex by vertex exactly as the skin under it does and bends at
 * the elbow and the knee with the arm and the leg; a ring the window inserts between two stations takes their blends
 * mixed by its place between them. Every live dial that names the body part names its garment too, so a `bulk` that
 * broadens the chest broadens the shirt. Rebuilt from the body on every read, so a cast, a tune or a core re-fits it.
 *
 * A plan's `garments`: [{ id, part, u?: [a, b], run?: [a, b], ease, flare?, over?, rings?, group }], worn in order.
 * `part` a body part or a list (a base name both sides, a side name that side: body-paint.js's rule); `u` / `run`
 * the window in the part's station parameter / as a share of its span (both ends interpolated, so a hem sits where it
 * is asked); `flare` [at the window's start, at its end] adds ease toward an end (a bell sleeve, a wide trouser hem);
 * `over` the parts it clears beside its own (the chest's layers); `rings` { u?, run? } adds rings inside the window where
 * an edge is finished (a hem's or a cuff's band, then painted as narrow as it is drawn). Each piece is the part `<id>_<body part>`, closed at
 * its ends by caps pinched on its axis just beyond the end rings (inside the body: what shows is the hem's edge), and
 * is marked `garment: true` (the studio light shades it smoothly as cloth: station-loft-shade.js STUDIO_SMOOTH_CREASE).
 *
 * `fit: 'shoe'` builds a piece of its own instead of a copy: footwear is FLAT where the foot is not. The foot and its
 * `over` parts (the toes) are held by two solids fitted to them, each the smallest that holds its share of their points
 * with the ease: at the back a ROUND ELLIPSOID (the heel cup, standing on the sole), at the front a FLAT HALF-ELLIPSOID
 * (the toe box, its flat side the sole) reaching back under the instep. Each ring is the SUPERPOSITION of their two
 * sections, the outermost in every direction, and nothing lies below the sole (the lowest point), so the shoe stands
 * flat. `toe` (a share, default 1: the toes' own height, so none shows through) is the toe box's height against the foot's; `heel` (m) lifts the heel cup's top.
 * Each ring takes the bind of the foot's station nearest it.
 *
 * `fit: 'skirt'` is a piece of its own too: one hull round all of `part` (the hips and both legs) from the waist (`from`:
 * an address { part, u | run }) to the hem (`to`), each ring the support of everything at its height in twenty
 * directions, symmetric, never narrowing below the hips and widening by `flare` (m per m of fall); each point skins as
 * the pelvis at the waist, and below by the crotch as the leg it lies over (the cloth near a leg follows it, the cloth
 * between and behind the legs stays with the pelvis). The
 * cloth has two faces, down the outside, folded at the hem and back up `thick` (m) inside to the hips, so the hem is an edge
 * and the skirt open beneath. The piece is `<id>_skirt`; its outer rings are st0 (the waist) … st11 (the hem).
 * `drape` (a copy piece's): held out above, the cloth falls from there, coming in at most `drape` per metre of fall (a
 * shirt from the bust, not hugging back under it). Pure, deterministic.
 */
import { hullHeight } from './station-loft-adorn.js';
import { SLOT_FAMILIES } from './station-loft-plan.js';
import * as dmath from '../../util/dmath.js';

const both = (v) => (Array.isArray(v) ? v : [v]);
const isWin = (w) => Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) && w[0] <= w[1];
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], lerp3 = (a, b, f) => add(a, mul(sub(b, a), f));
const unit = (a) => { const l = dmath.hypot(...a) || 1; return mul(a, 1 / l); };
const mean = (ps) => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);

/** Error strings for a plan's `garments` (form only; names are judged against the parts by `garmentParts`). */
export function validateGarments(G) {
  if (G === undefined || G === null) return [];
  if (!Array.isArray(G)) return ['garments: a list of { id, part, u?, run?, ease, flare?, over?, group }'];
  const errs = [], ids = new Set();
  G.forEach((P, i) => {
    const at = `garments[${i}]`;
    if (!P || typeof P !== 'object' || Array.isArray(P)) { errs.push(`${at}: { id, part, u?, run?, ease, flare?, over?, group }`); return; }
    if (typeof P.id !== 'string' || !/^[A-Za-z][\w-]*$/.test(P.id)) errs.push(`${at}.id: a name (letters, digits, - or _)`);
    else if (ids.has(P.id)) errs.push(`${at}.id: '${P.id}' worn twice — give each piece its own id`); else ids.add(P.id);
    if (!both(P.part).length || !both(P.part).every((n) => typeof n === 'string' && n)) errs.push(`${at}.part: a part name or a list of them`);
    if (typeof P.group !== 'string' || !P.group) errs.push(`${at}.group: a palette group name`);
    if (!(Number.isFinite(P.ease) && P.ease >= 0)) errs.push(`${at}.ease: metres off the body, ≥ 0`);
    if (P.u !== undefined && !isWin(P.u)) errs.push(`${at}.u: [a, b] in the part's station parameter, a ≤ b`);
    if (P.run !== undefined && !(isWin(P.run) && P.run[0] >= 0 && P.run[1] <= 1)) errs.push(`${at}.run: [a, b] shares of the part's span, 0 ≤ a ≤ b ≤ 1`);
    if (P.flare !== undefined && !(Array.isArray(P.flare) && P.flare.length === 2 && P.flare.every((x) => Number.isFinite(x) && x >= 0))) errs.push(`${at}.flare: [extra ease at the start, at the end] (m)`);
    if (P.over !== undefined && !(Array.isArray(P.over) && P.over.every((n) => typeof n === 'string'))) errs.push(`${at}.over: a list of part names`);
    if (P.rings !== undefined && !(P.rings && typeof P.rings === 'object' && Object.keys(P.rings).every((k) => ['u', 'run'].includes(k)) && Object.values(P.rings).every((v) => Array.isArray(v) && v.every(Number.isFinite)))) errs.push(`${at}.rings: { u?: [stations], run?: [shares] } — rings added inside the window`);
    if (P.fit !== undefined && !['shoe', 'skirt'].includes(P.fit)) errs.push(`${at}.fit: 'shoe' (footwear on a flat sole), 'skirt' (a hull round the hips and both legs), or absent (a copy of the part's rings)`);
    if (P.fit === 'skirt') for (const k of ['from', 'to']) if (!(P[k] && typeof P[k].part === 'string' && (Number.isFinite(P[k].u) || Number.isFinite(P[k].run)))) errs.push(`${at}.${k}: { part, u | run } — the ${k === 'from' ? 'waist' : 'hem'}'s height, an address on a body part`);
    if (P.drape !== undefined && !(Number.isFinite(P.drape) && P.drape >= 0)) errs.push(`${at}.drape: how far the cloth may fall in per metre it falls below what holds it out (≥ 0; 0 falls straight)`);
    if (P.toe !== undefined && !(Number.isFinite(P.toe) && P.toe > 0)) errs.push(`${at}.toe: the toe box's height as a share of the foot's (> 0)`);
    if (P.heel !== undefined && !(Number.isFinite(P.heel) && P.heel >= 0)) errs.push(`${at}.heel: metres added over the heel cup (≥ 0)`);
    for (const k of Object.keys(P)) if (!['id', 'part', 'u', 'run', 'ease', 'flare', 'over', 'group', 'fit', 'toe', 'heel', 'rings', 'from', 'to', 'drape', 'thick'].includes(k)) errs.push(`${at}.${k}: not a garment field (id, part, u, run, ease, flare, over, group, fit, toe, heel, rings, from, to, drape, thick)`);
    if (P.thick !== undefined && !(Number.isFinite(P.thick) && P.thick > 0)) errs.push(`${at}.thick: a skirt's cloth thickness at the hem (m, > 0)`);
  });
  return errs;
}

const partsNamed = (parts, name) => (/[RL]$/.test(name) && parts[name]?.layer === 1 ? [name]
  : Object.keys(parts).filter((n) => parts[n].layer === 1 && (n === name || n === `${name}R` || n === `${name}L`)));

/** a station's blend as weights (its own entry, else the part's bone whole) */
const blendOf = (bind, id) => (bind == null ? null : typeof bind === 'string' ? { [bind]: 1 } : bind.blend?.[id] ?? { [bind.bone]: 1 });
const mixBlend = (a, b, f) => { const o = {}; for (const [k, w] of Object.entries(a)) o[k] = (o[k] || 0) + w * (1 - f); for (const [k, w] of Object.entries(b)) o[k] = (o[k] || 0) + w * f;
  const e = Object.entries(o).filter(([, w]) => w > 1e-9).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 4), s = e.reduce((t, [, w]) => t + w, 0);
  const out = Object.fromEntries(e.map(([k, w]) => [k, r6(w / s)])); const top = e[0][0]; out[top] = r6(out[top] + 1 - Object.values(out).reduce((t, w) => t + w, 0)); return out; };

/** the window's rings on a part: every station inside it, and a ring interpolated at each end that falls between two */
function windowRings(part, P) {
  const st = part.stations, U = st.map((s, k) => s.u ?? k), u0 = U[0], u1 = U[U.length - 1];
  let [a, b] = P.u ?? [u0, u1]; if (P.run) { a = Math.max(a, u0 + P.run[0] * (u1 - u0)); b = Math.min(b, u0 + P.run[1] * (u1 - u0)); }
  a = Math.max(a, u0); b = Math.min(b, u1); if (!(b > a)) return [];
  const at = (u) => { let i = U.findIndex((x) => x >= u - 1e-9); if (Math.abs(U[i] - u) < 1e-9) return { ...st[i], u: U[i], k: i };
    const f = (u - U[i - 1]) / (U[i] - U[i - 1]);
    return { id: `${st[i - 1].id}_${st[i].id}_g${Math.round(f * 1000)}`, u, points: Object.fromEntries(part.slots.map((sl) => [sl, lerp3(st[i - 1].points[sl], st[i].points[sl], f)])), mix: [st[i - 1].id, st[i].id, f] }; };
  // the rings a piece asks for inside its window (`rings`: u values and shares of the span), where its edges are
  // finished: a hem, a cuff or a rib is then a band of its own, as narrow as it is drawn
  const extra = [...(P.rings?.u || []), ...(P.rings?.run || []).map((r) => u0 + r * (u1 - u0))].filter((u) => u > a + 1e-6 && u < b - 1e-6 && !U.some((x) => Math.abs(x - u) < 1e-6));
  const inner = [...st.map((s, k) => ({ ...s, u: U[k], k })).filter((s) => s.u > a + 1e-9 && s.u < b - 1e-9), ...[...new Set(extra.map((u) => Math.round(u * 1e6) / 1e6))].map(at)].sort((x, y) => x.u - y.u);
  return [at(a), ...inner, at(b)];
}

/** Build the garment parts of `garments` from the L1 `parts` (in place: adds `<id>_<part>` parts) and name each beside
 * its body part in `dials` (fresh lists). Throws on a name that dresses no part, or a window that covers none of it. */
export function garmentParts(parts, garments, dials = {}) {
  if (!garments?.length) return parts;
  const worn = {};   // body part → the garment parts already on it (the next one stands off them)
  garments.forEach((P, i) => {
    const names = both(P.part).flatMap((n) => { const hit = partsNamed(parts, n); if (!hit.length) throw new Error(`garments[${i}]: '${n}' is not an L1 part`); return hit; });
    if (P.fit === 'skirt') { const name = `${P.id}_skirt`; parts[name] = skirtPart(parts, names, P, worn);
      for (const src of names) (worn[src] ??= []).push(name);
      for (const d of Object.values(dials)) if (Array.isArray(d.parts) && names.some((n) => d.parts.includes(n))) d.parts = [...d.parts, name];
      return; }
    for (const src of names) {
      if (P.fit === 'shoe') { const name = `${P.id}_${src}`; parts[name] = shoePart(parts, src, P); (worn[src] ??= []).push(name);
        for (const d of Object.values(dials)) if (Array.isArray(d.parts) && d.parts.includes(src)) d.parts = [...d.parts, name];
        continue; }
      const part = parts[src], rings = windowRings(part, P);
      if (rings.length < 2) throw new Error(`garments[${i}] (${P.id}): its window covers none of '${src}'`);
      const overs = (P.over || []).flatMap((n) => partsNamed(parts, n)).filter((n) => n !== src);
      const beneath = [...overs, ...(worn[src] || [])].flatMap((n) => parts[n].stations.flatMap((s) => Object.values(s.points)));
      const n = rings.length, ua = rings[0].u, span = rings[n - 1].u - ua || 1;
      // the lift over what lies beneath: per point along its outward normal (the hull within a hand's breadth), then
      // smoothed round the ring and along it (a max, then a mean: adornment's min-shield), so a shirt bridges the cleft
      const C = rings.map((r) => mean(part.slots.map((sl) => r.points[sl])));
      const N = rings.map((r, j) => part.slots.map((sl) => unit(sub(r.points[sl], C[j]))));
      let H = rings.map((r, j) => part.slots.map((sl, k) => (beneath.length ? hullHeight(beneath, r.points[sl], N[j][k], 0.06) : 0)));
      if (beneath.length) {
        const m = part.slots.length, nb = (j, k) => [[j, k], [j, (k + 1) % m], [j, (k + m - 1) % m], [Math.max(0, j - 1), k], [Math.min(n - 1, j + 1), k]];
        H = H.map((row, j) => row.map((_, k) => Math.max(...nb(j, k).map(([a, b]) => H[a][b])))); H = H.map((row, j) => row.map((_, k) => mean(nb(j, k).map(([a, b]) => [H[a][b], 0, 0]))[0]));
      }
      const fl = P.flare ?? [0, 0];
      // DRAPE: cloth held out above (by the bust, the shoulder blades) falls from there instead of hugging back in under
      // it: from the top ring down, each point stands at least as far out as the one above it, less `drape` per metre
      // it falls
      if (P.drape !== undefined) for (let j = n - 2; j >= 0; j--) { const dz = Math.abs(C[j + 1][2] - C[j][2]);
        for (let k = 0; k < part.slots.length; k++) { const sl = part.slots[k], f = (rings[j].u - ua) / span, e = P.ease + fl[0] * (1 - f) + fl[1] * f, fa = (rings[j + 1].u - ua) / span, ea = P.ease + fl[0] * (1 - fa) + fl[1] * fa;
          const above = dmath.hypot(...sub(add(rings[j + 1].points[sl], mul(N[j + 1][k], ea + H[j + 1][k])), C[j + 1]).slice(0, 2)), here = dmath.hypot(...sub(rings[j].points[sl], C[j]).slice(0, 2));
          H[j][k] = Math.max(H[j][k], above - P.drape * dz - here - e); } }
      const stations = rings.map((r, j) => { const f = (r.u - ua) / span, e = P.ease + fl[0] * (1 - f) + fl[1] * f;
        return { id: r.id, u: r6(r.u), points: Object.fromEntries(part.slots.map((sl, k) => [sl, add(r.points[sl], mul(N[j][k], e + H[j][k])).map(r6)])) }; });
      const name = `${P.id}_${src}`;
      // the caps pinched on the axis a little beyond the end rings (a cap in its ring's plane has no outward side)
      const axis = unit(sub(C[n - 1], C[0])), rad = (j) => mean(part.slots.map((sl) => [dmath.hypot(...sub(stations[j].points[sl], C[j])), 0, 0]))[0];
      const piece = { layer: 1, closure: 'closed', garment: true, slots: part.slots, stations, caps: { back: sub(C[0], mul(axis, 0.3 * rad(0))).map(r6), tip: add(C[n - 1], mul(axis, 0.3 * rad(n - 1))).map(r6) }, group: P.group, ...(part.slotT ? { slotT: { ...part.slotT } } : {}) };
      if (part.bind !== undefined) {
        const own = (r) => (r.mix ? mixBlend(blendOf(part.bind, r.mix[0]), blendOf(part.bind, r.mix[1]), r.mix[2]) : blendOf(part.bind, r.id));
        const blend = Object.fromEntries(rings.map((r) => [r.id, own(r)]));
        piece.bind = { bone: typeof part.bind === 'string' ? part.bind : part.bind.bone, blend: { ...blend, back: own(rings[0]), tip: own(rings[n - 1]) } };
      }
      parts[name] = piece; (worn[src] ??= []).push(name);
      for (const d of Object.values(dials)) if (Array.isArray(d.parts) && d.parts.includes(src)) d.parts = [...d.parts, name];
    }
  });
  return parts;
}

// ─── footwear: two sections superposed on a flat sole ───
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** the distance from (x, z) along (dx, dz) to the boundary of the ellipse at (cx, cz) with semi-axes a, b (inside it) */
const toEllipse = (x, z, dx, dz, cx, cz, a, b) => { const ox = (x - cx) / a, oz = (z - cz) / b, ux = dx / a, uz = dz / b;
  const A = ux * ux + uz * uz, B = 2 * (ox * ux + oz * uz), C = ox * ox + oz * oz - 1; return (-B + Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A); };
/** A shoe on `src` (a foot), built in the foot's own frame (along it heel → toe, out to its side, up), its slots the
 * fine ring's, R and L each from its own foot. Two solids, each the smallest that holds its share of the foot and toe
 * points with the ease: a ROUND ELLIPSOID over the heel (sunk through the sole and cut flat on it) and a FLAT HALF-ELLIPSOID over the
 * forefoot (its flat side the sole), reaching back under the instep; a ring is their two sections superposed (the
 * outermost in each direction), and nothing lies below the sole. */
function shoePart(parts, src, P) {
  // its own fine ring (a shoe needs no slot of the foot's: it binds by station), so the sole's edge is not cut across
  const foot = parts[src], side = /L$/.test(src) ? -1 : 1, slots = SLOT_FAMILIES.ring20, n = slots.length;
  const overs = (P.over || []).flatMap((o) => partsNamed(parts, o)).filter((o) => o !== src && o.slice(-1) === src.slice(-1));
  const pts = [foot, ...overs.map((o) => parts[o])].flatMap((q) => [...q.stations.flatMap((st) => Object.values(st.points)), q.caps.back, q.caps.tip]);   // its caps too: the heel and the toe tips
  const up = [0, 0, 1], C0 = mean(Object.values(foot.stations[0].points));
  let far = pts[0]; for (const p of pts) if (dmath.hypot(p[0] - C0[0], p[1] - C0[1]) > dmath.hypot(far[0] - C0[0], far[1] - C0[1])) far = p;
  const axis = unit([far[0] - C0[0], far[1] - C0[1], 0]), out = mul(unit(cross(axis, up)), side);   // out: the foot's outer side
  const local = pts.map((p) => { const d = sub(p, C0); return [dot(d, axis), dot(d, out), p[2]]; });
  const e = P.ease, toe = P.toe ?? 1, heel = P.heel ?? 0;
  const sole = Math.min(...local.map((q) => q[2])), a0 = Math.min(...local.map((q) => q[0])) - e, a1 = Math.max(...local.map((q) => q[0])) + e, L = a1 - a0;
  // the centre line across: a least-squares line through the points (a foot turned out, toes splayed)
  const ma = mean(local.map((q) => [q[0], 0, 0]))[0], ml = mean(local.map((q) => [q[1], 0, 0]))[0];
  const k = local.reduce((t, q) => t + (q[0] - ma) * (q[1] - ml), 0) / (local.reduce((t, q) => t + (q[0] - ma) ** 2, 0) || 1), cl = (a) => ml + k * (a - ma);
  // the two solids along the foot: centre, half-length and the power of their profile along it, a section's share
  // s(a) = (1 − |(a − c)/r|^p)^(1/p), never under 0.3: the heel round (p 2), the toe box blunt (p 3.5), so it keeps
  // its width until near the tip. Each is sized by the points where its section is full enough to hold them (s ≥ 0.45):
  // nearer its end a point is the tip's, and the ease covers it
  const back = { c: a0 + 0.22 * L, r: 0.22 * L + 2 * e, p: 2 }, front = { c: a0 + 0.58 * L, r: 0.42 * L + 2 * e, p: 3.5 };   // both reach a little past the foot, so neither end is pinched on it
  const share = (S, a) => Math.max(0.3, Math.max(0, 1 - Math.abs((a - S.c) / S.r) ** S.p) ** (1 / S.p));
  const fit = (S, mine) => { let w = 1e-3, h = 1e-3; for (const [a, l, z] of local.filter(mine)) { const sh = share(S, a); if (sh < 0.45) continue; w = Math.max(w, (Math.abs(l - cl(a)) + e) / sh); h = Math.max(h, (z - sole + e) / sh); } return { ...S, w, h }; };
  const inB = (q) => q[0] < a0 + 0.4 * L, inF = (q) => q[0] >= a0 + 0.3 * L;
  const B = fit(back, inB), F = fit(front, inF);
  // the heel cup a round ellipse sunk through the sole to SINK of its half-height and cut there, so it too stands flat:
  // its half-height the height it must reach over (1 + SINK)
  const SINK = 0.6; B.h = B.h / (1 + SINK); F.h *= toe;
  // grow each until its points lie inside the ellipse itself, not just its box (a high point out at the side, the
  // ankle's corner), the ease included: a few passes, since the heel's centre rises with its height
  const grow = (S, mine, zc) => { for (let it = 0; it < 4; it++) { let g = 1; for (const [a, l, z] of local.filter(mine)) { const sh = share(S, a); if (sh < 0.45) continue;
    const dl = Math.abs(l - cl(a)) + e, dz = Math.max(0, z - zc(S, sh)) + e; g = Math.max(g, Math.hypot(dl / (S.w * sh), dz / ((S === F ? S.h : S.h) * sh))); }
    S.w *= g; S.h *= g; } };
  grow(B, inB, (S, sh) => sole + SINK * S.h * sh); if (toe >= 1) grow(F, inF, () => sole);
  B.h += heel / 2;
  const N = 12, stations = [];
  for (let i = 0; i < N; i++) {
    const a = a0 + L * i / (N - 1), c = cl(a), sb = a <= back.c + back.r ? share(B, a) : 0, sf = a >= front.c - front.r ? share(F, a) : 0;
    const oz = sole + 0.15 * Math.min(...[sb ? 2 * B.h * sb : Infinity, sf ? F.h * sf : Infinity]);
    const points = {};
    for (let q = 0; q < n; q++) {
      const sl = side > 0 ? slots[q] : slots[(n - q) % n];   // the mirror of the R ring's slot, so the halves pair as the body's do
      const th = 2 * Math.PI * q / n, dx = Math.sin(th), dz = Math.cos(th);
      let t = 0;
      if (sb) { let tb = toEllipse(c, oz, dx, dz, c, sole + SINK * (B.h - heel / 2) * sb, B.w * sb, B.h * sb); if (dz < 0) tb = Math.min(tb, (sole - oz) / dz); t = Math.max(t, tb); }
      if (sf) { let te = toEllipse(c, oz, dx, dz, c, sole, F.w * sf, F.h * sf); if (dz < 0) te = Math.min(te, (sole - oz) / dz); t = Math.max(t, te); }
      points[sl] = add(add(C0, add(mul(axis, a), mul(out, c + t * dx))), [0, 0, Math.max(sole, oz + t * dz) - C0[2]]).map(r6);
    }
    stations.push({ id: `st${i}`, u: i, points, a });
  }
  const cen = (j) => mean(Object.values(stations[j].points)), ax = unit(sub(cen(N - 1), cen(0)));
  const piece = { layer: 1, closure: 'closed', garment: true, slots, stations: stations.map(({ a: _a, ...st }) => st), caps: { back: sub(cen(0), mul(ax, 0.01)).map(r6), tip: add(cen(N - 1), mul(ax, 0.01)).map(r6) }, group: P.group };
  if (foot.bind !== undefined) {
    // each ring binds as the foot's station nearest it along the foot
    const fa = foot.stations.map((st) => dot(sub(mean(Object.values(st.points)), C0), axis));
    const near = (a) => foot.stations[fa.reduce((b, x, j) => (Math.abs(x - a) < Math.abs(fa[b] - a) ? j : b), 0)].id;
    const blend = Object.fromEntries(stations.map((st) => [st.id, blendOf(foot.bind, near(st.a))]));
    piece.bind = { bone: typeof foot.bind === 'string' ? foot.bind : foot.bind.bone, blend: { ...blend, back: blend.st0, tip: blend[`st${N - 1}`] } };
  }
  return piece;
}

// ─── skirts: a hull round the hips and both legs ───
/** the height of an address { part, u | run } on a body part: its ring centre there */
function heightAt(parts, A) {
  const part = parts[A.part] ?? parts[`${A.part}R`]; if (!part) throw new Error(`skirt: '${A.part}' is not an L1 part`);
  const U = part.stations.map((s, k) => s.u ?? k), u0 = U[0], u1 = U[U.length - 1], u = Number.isFinite(A.u) ? A.u : u0 + A.run * (u1 - u0);
  const z = part.stations.map((st) => mean(Object.values(st.points))[2]); let i = U.findIndex((x) => x >= u - 1e-9); if (i <= 0) return z[Math.max(0, i)];
  return z[i - 1] + (z[i] - z[i - 1]) * (u - U[i - 1]) / (U[i] - U[i - 1]);
}
/** A SKIRT round `names` (the hips and both legs, a list of L1 parts) from the waist (`from`) to the hem (`to`): each
 * ring at its height is the support of everything there (the body parts, the garments already worn on them) in twenty
 * directions about the waist's centre, made symmetric, carried out by the ease; below the hips' widest ring it never
 * narrows (cloth falls, it does not tuck between the legs) and widens by `flare` per metre it falls (an A-line). Each
 * point skins as the pelvis at the waist, blending down to the leg on its own side by the crotch. */
function skirtPart(parts, names, P, worn) {
  const slots = SLOT_FAMILIES.ring20, n = slots.length, e = P.ease, flare = Array.isArray(P.flare) ? P.flare[1] : (P.flare ?? 0);
  const zw = heightAt(parts, P.from), zh = heightAt(parts, P.to);
  const beneath = [...names, ...names.flatMap((nm) => worn[nm] || [])].filter((nm, i, a) => a.indexOf(nm) === i && parts[nm]);
  const pts = beneath.flatMap((nm) => [...parts[nm].stations.flatMap((st) => Object.values(st.points)), parts[nm].caps.back, parts[nm].caps.tip]);
  const waist = pts.filter((p) => Math.abs(p[2] - zw) < 0.04), cy = waist.length ? (Math.min(...waist.map((p) => p[1])) + Math.max(...waist.map((p) => p[1]))) / 2 : 0;
  const N = 12, dirs = Array.from({ length: n }, (_, k) => [Math.sin(2 * Math.PI * k / n), Math.cos(2 * Math.PI * k / n)]);
  const zs = Array.from({ length: N }, (_, i) => zw + (zh - zw) * i / (N - 1)), slab = Math.abs(zh - zw) / (N - 1) * 0.75;
  let prev = null;
  const R = zs.map((z) => { const q = pts.filter((p) => Math.abs(p[2] - z) <= slab);
    const r = q.length ? dirs.map(([dx, dy]) => Math.max(0.01, ...q.map((p) => p[0] * dx + (p[1] - cy) * dy))) : prev; prev = r;
    return r.map((x, k) => Math.max(x, r[(n - k) % n])); });
  // the hips' widest ring; below it the cloth only falls and flares
  let hip = 0; R.forEach((r, i) => { if (r.reduce((a, b) => a + b, 0) > R[hip].reduce((a, b) => a + b, 0)) hip = i; });
  for (let i = hip + 1; i < N; i++) R[i] = R[i].map((x, k) => Math.max(x, R[i - 1][k] + flare * Math.abs(zs[i] - zs[i - 1])));
  // the crotch: where the legs part (the lowest point of the pelvis, else the thighs' tops)
  const zc = parts.pelvis ? Math.min(...parts.pelvis.stations.flatMap((st) => Object.values(st.points)).map((p) => p[2])) : zw - 0.12;
  const pelvisBone = parts.pelvis?.bind?.bone ?? 'pelvis', legBone = (sd) => parts[`thigh${sd}`]?.bind?.bone ?? `thigh${sd}`;
  // a leg's centre and radius at a height: its thigh's and shank's ring centres, interpolated (null above it)
  const legRings = (sd) => ['thigh', 'shank'].flatMap((nm) => parts[`${nm}${sd}`]?.stations || []).map((st) => { const P2 = Object.values(st.points), c = mean(P2);
    return { c, r: Math.max(...P2.map((q) => dmath.hypot(q[0] - c[0], q[1] - c[1]))) }; }).sort((a2, b2) => b2.c[2] - a2.c[2]);
  const LR = { R: legRings('R'), L: legRings('L') };
  const legAt = (sd, z) => { const L = LR[sd]; if (!L.length || z > L[0].c[2]) return null; for (let q = 1; q < L.length; q++) if (z >= L[q].c[2]) { const f = (L[q - 1].c[2] - z) / Math.max(1e-9, L[q - 1].c[2] - L[q].c[2]);
    return { c: L[q - 1].c.map((v, d) => v + (L[q].c[d] - v) * f), r: L[q - 1].r + (L[q].r - L[q - 1].r) * f }; } return L[L.length - 1]; };
  // the cloth's two faces: down the outside to the hem, folded there, and back up a wall `thick` inside it to the hips,
  // closed within the body; so the hem is an edge and the skirt is open beneath, never a disc across the legs
  const thick = P.thick ?? 0.004, ring = (i, inner) => ({ i, inner, z: inner ? zs[i] + (i === N - 1 ? thick : 0) : zs[i] });
  const walk = [...zs.map((_, i) => ring(i, false)), ...zs.map((_, i) => N - 1 - i).filter((i) => i >= hip).map((i) => ring(i, true))];
  const stations = [], blend = {};
  walk.forEach(({ i, inner, z }, j) => { const id = `st${j}`, points = {};
    slots.forEach((sl, k) => { const [dx, dy] = dirs[k], r = R[i][k] + e - (inner ? thick : 0); const p = [dx * r, cy + dy * r, z]; points[sl] = p.map(r6);
      // the cloth goes with what it lies nearest: each leg, or the line between them (the pelvis), by the inverse square
      // of its distance from each at its height (a leg from its surface, the line from the axis, the leg's radius off it).
      // So the cloth over a knee goes where the knee goes, the cloth between and behind the knees stays with the pelvis,
      // and a stride swings the skirt rather than flinging it. The legs' share grows from the waist to the crotch.
      const down = Math.max(0, Math.min(1, (zw - z) / Math.max(1e-6, zw - zc))), LgR = legAt('R', z), LgL = legAt('L', z);
      const inv = (d) => 1 / Math.max(1e-4, d) ** 2, off = (L) => (L ? Math.max(0.005, dmath.hypot(p[0] - L.c[0], p[1] - L.c[1]) - L.r) : Infinity);
      const iR = LgR ? inv(off(LgR)) : 0, iL = LgL ? inv(off(LgL)) : 0, iC = inv(Math.max(0.005, dmath.hypot(p[0], p[1] - cy) - (LgR?.r ?? 0.06)));
      const legs = Math.min(0.95, down * (iR + iL) / (iR + iL + iC)), split = iR + iL > 0 ? iR / (iR + iL) : 0.5;
      const w = { [pelvisBone]: 1 - legs, [legBone('R')]: legs * split, [legBone('L')]: legs * (1 - split) };
      const ent = Object.entries(w).filter(([, x]) => x > 1e-6), sum = ent.reduce((t, [, x]) => t + x, 0), out = Object.fromEntries(ent.map(([b, x]) => [b, r6(x / sum)]));
      const top = ent.sort((a2, b2) => b2[1] - a2[1])[0][0]; out[top] = r6(out[top] + 1 - Object.values(out).reduce((t, x) => t + x, 0)); blend[`${id}.${sl}`] = out; });
    stations.push({ id, u: j, points }); });
  const zTop = zs[hip];
  const piece = { layer: 1, closure: 'closed', garment: true, slots, stations, caps: { back: [0, r6(cy), r6(zw + 0.02)], tip: [0, r6(cy), r6(zTop - 0.02)] }, group: P.group,
    bind: { bone: pelvisBone, blend: { ...blend, back: { [pelvisBone]: 1 }, tip: { [pelvisBone]: 1 } } } };
  return piece;
}
