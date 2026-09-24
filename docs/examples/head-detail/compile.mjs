/** head-detail/compile.mjs — the layered head grammar scaled down to detail, articulation and expression.
 *
 * CORE (species-free): surface addresses (s,t) on a station/slot part; recipe-level `refineSlot` and
 * `volumize`; surface STRIPS (lofts whose stations are addresses, so they ride the skin); spine `sweep`
 * with `curl`; `projectOnto` a carrier; `ringLoft` (a closed loop of sections); BONE vs SKIN carriers
 * (skin maps move skin only; teeth, horns, eyes and the tongue ride the bone); sided controls in [-1, 1].
 * Regions built from those ops: the EYE (one ball with named bands Sclera | Limbus | Iris | Pupil |
 * LidShadow, a catchlight, gaze; one SURROUND ring — lid above, pad below — tucked under the BROW strip),
 * the NOSTRIL, a driven FOLD, the dual-pinned CHEEK WEB (its front edge is the mouth corner) and the
 * TONGUE (a chain resting on the jaw floor).
 * HEAD DATA: everything that names an anatomy — station tables, region addresses, skin maps, amplitudes,
 * ornaments, palette — for two heads that share no species code: the dragon (its layered recipe plus a
 * jaw floor) and a bear authored from its own 12-slot station table.
 * Species-neutral EXPRESSIONS drive both. Deterministic, no dice. Not a registered kind: a reference for
 * what the `layered` grammar would gain. */
import { compile, pinFrame, loadRecipe } from '../dragon-layered/compile.mjs';
import { mirrorFaceId, mirrorPid } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { placeSurfaceOffset, surfaceLocalOffset } from '../../../control/lib/graph/polygonizer/surface-pin.js';

const sub = (a, b) => a.map((x, i) => x - b[i]); const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const mean = (ps) => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
const lerp = (a, b, w) => add(mul(a, 1 - w), mul(b, w));
const rot = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a); return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))); };
const SIDES = ['R', 'L']; const mx = (v, side) => (side === 'L' ? [-v[0], v[1], v[2]] : v);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ════════════════════════════ CORE (species-free) ════════════════════════════

// ── recipe-level passes: named refinement and radial volume (run before compile; mirrored by name) ──
/** insert slot `name`R/L between slots `a` and `b` at fraction f on every station of a part */
function refineSlot(recipe, part, a, b, name, f = 0.5) {
  const P = recipe.parts[part]; const S = P.slots; const n = S.length;
  const ia = S.indexOf(`${a}R`), ib = S.indexOf(b.endsWith('R') || b.endsWith('L') ? b : b);
  if (ia < 0 || ib < 0 || Math.abs(ia - ib) !== 1) throw new Error(`refineSlot: ${a}R and ${b} must be adjacent in ${part}`);
  const insR = Math.max(ia, ib); S.splice(insR, 0, `${name}R`);
  const iaL = S.indexOf(`${a}L`), ibL = S.indexOf(b.endsWith('R') ? b.replace(/R$/, 'L') : b); S.splice(Math.max(iaL, ibL), 0, `${name}L`);
  for (const st of P.stations) { st.points[`${name}R`] = lerp(st.points[`${a}R`], st.points[b], f); st.points[`${name}L`] = lerp(st.points[`${a}L`], st.points[b.endsWith('R') ? b.replace(/R$/, 'L') : b], f); }
  delete P.bandGroups;   // band groups are indexed by slot; the part's `group` stands in
  if (S.length !== n + 2) throw new Error('refineSlot: slot count');
}
/** push named slots radially out of each station ring (from the ring centroid), weighted per station */
function volumize(recipe, part, slotW, stationW, amount) {
  const P = recipe.parts[part];
  for (const st of P.stations) { const ws = stationW[st.id] ?? 0; if (!ws) continue; const c = mean(P.slots.map((s) => st.points[s]));
    for (const [slot, wl] of Object.entries(slotW)) for (const nm of slot.endsWith('*') ? [slot.slice(0, -1) + 'R', slot.slice(0, -1) + 'L'] : [slot]) {
      const p = st.points[nm]; st.points[nm] = add(p, mul(unit(sub(p, c)), amount * ws * wl)); } }
}

// ── addresses and frames ──
function address(L1, name, s, t, side = 'R') {
  const part = L1[name]; const slots = part.slots, ids = part.stations.map((x) => x.id), n = slots.length, half = n / 2;
  if (!(s >= 0 && s <= ids.length - 1 && t >= 0 && t <= half)) throw new Error(`address (${s},${t}) off ${name}`);
  const i = Math.min(Math.floor(s), ids.length - 2), k = Math.min(Math.floor(t), half - 1), u = s - i, v = t - k;
  const P = (j, kk) => `${name}/${ids[j]}.${slots[kk % n]}`; const band = `${name}/${ids[i]}-${ids[i + 1]}.k${k}`;
  const p00 = P(i, k), p01 = P(i, k + 1), p10 = P(i + 1, k), p11 = P(i + 1, k + 1);
  const [id, w, edge] = u <= v ? [`${band}.a`, { [p00]: 1 - v, [p01]: v - u, [p11]: u }, [p01, p11]] : [`${band}.b`, { [p00]: 1 - u, [p11]: v, [p10]: u - v }, [p00, p10]];
  const pin = { parent: name, face: id, weights: part.faces[id].map((p) => w[p]), tangentEdge: edge, handedness: 1 };
  return side === 'R' ? pin : { ...pin, face: mirrorFaceId(pin.face, n), weights: [...pin.weights].reverse(), tangentEdge: pin.tangentEdge.map(mirrorPid), handedness: -1 };
}
const frameAt = (L1, name, [s, t], side) => pinFrame(L1[name], address(L1, name, s, t, side));

// ── closed lofts ──
function loftParts(rings, back, tip) {
  const m = rings[0].length, pts = {}, faces = [];
  rings.forEach((r, j) => r.forEach((p, k) => (pts[`st${j}.s${k}`] = p))); pts.back = back; pts.tip = tip;
  const id = (j, k) => `st${j}.s${k % m}`;
  for (let j = 0; j + 1 < rings.length; j++) for (let k = 0; k < m; k++) faces.push([id(j, k), id(j, k + 1), id(j + 1, k + 1)], [id(j, k), id(j + 1, k + 1), id(j + 1, k)]);
  const L = rings.length - 1; for (let k = 0; k < m; k++) faces.push([id(0, k + 1), id(0, k), 'back'], [id(L, k), id(L, k + 1), 'tip']);
  const c = mean(Object.values(pts)); const vol = faces.reduce((s, f) => s + dot(sub(pts[f[0]], c), cross(sub(pts[f[1]], c), sub(pts[f[2]], c))), 0);
  return { points: pts, faces: vol < 0 ? faces.map((f) => [...f].reverse()) : faces, rings: rings.map((r, j) => r.map((_, k) => id(j, k))), m };
}
/** per-face labels in loftParts order: band (j,k) → label(j,k); caps → capLabel */
const loftLabels = (mesh, label, capLabel) => { const [cb, ct] = Array.isArray(capLabel) ? capLabel : [capLabel, capLabel]; const out = []; for (let j = 0; j + 1 < mesh.rings.length; j++) for (let k = 0; k < mesh.m; k++) { const g = label(j, k); out.push(g, g); } for (let k = 0; k < mesh.m; k++) out.push(cb, ct); return out; };
const ringAt = (c, axis, r, m, phase = 0, squash = [1, 1]) => { const a = unit(axis); let u = cross(a, [0, 0, 1]); if (Math.hypot(...u) < 1e-6) u = cross(a, [1, 0, 0]); u = unit(u); const v = cross(a, u);
  return Array.from({ length: m }, (_, i) => { const t = 2 * Math.PI * i / m + phase; return add(c, add(mul(u, Math.cos(t) * r * squash[0]), mul(v, Math.sin(t) * r * squash[1]))); }); };
/** a spine loft in pin-local coords; `curl` spreads a rotation over the stations (the tail-chain rule) */
function sweep(spine, radii, m, { curl = 0, curlAxis = [1, 0, 0], squash } = {}) {
  const pts = [spine[0]]; for (let j = 1; j < spine.length; j++) pts.push(add(pts[j - 1], rot(sub(spine[j], spine[j - 1]), unit(curlAxis), curl * j / (spine.length - 1))));
  return loftParts(pts.slice(0, -1).map((p, j) => ringAt(p, sub(pts[j + 1], p), radii[j], m, Math.PI / m, squash)), sub(pts[0], mul(unit(sub(pts[1], pts[0])), radii[0] * 0.6)), pts[pts.length - 1]);
}
/** place a pin-local mesh on a carrier; the mirrored side reverses winding */
function pinned(L1, name, at, side, local, group, extra = {}) {
  const f = frameAt(L1, name, at, side);
  return { group, creases: [], ...extra, points: Object.fromEntries(Object.entries(local.points).map(([k, o]) => [k, placeSurfaceOffset(f, o)])), faces: side === 'L' ? local.faces.map((q) => [...q].reverse()) : local.faces };
}
/** SURFACE STRIP: stations are (s,t) addresses; cross-sections live in each station's own surface frame.
 * Convention: profile point 0 is the edge FACING the region the strip bounds (brow: down; pad: up). */
function strip(L1, name, addrs, side, profile, handle = () => [0, 0, 0]) {
  const F = addrs.map((a) => frameAt(L1, name, a, side)); const O = F.map((f) => f.origin);
  const rings = F.map((f, j) => { const n = f.normal; const raw = sub(O[Math.min(j + 1, O.length - 1)], O[Math.max(j - 1, 0)]); const d = unit(sub(raw, mul(n, dot(raw, n))));
    const e = mul(cross(n, d), side === 'L' ? -1 : 1); const [hd, he, hn] = handle(j); const o = add(f.origin, add(add(mul(d, hd), mul(e, he)), mul(n, hn)));
    return profile(j).map(([a, h]) => add(o, add(mul(e, a), mul(n, h)))); });
  const end = (j, sgn) => { const c = mean(rings[j]); const other = mean(rings[j + (sgn < 0 ? 1 : -1)]); return add(c, mul(unit(sub(c, other)), 0.005)); };
  const mesh = loftParts(rings, end(0, -1), end(rings.length - 1, 1)); mesh.edge0 = rings.map((r) => r[0]); mesh.normal = F[Math.floor(F.length / 2)].normal; return mesh;
}
/** a strip's profile from region data: w, h, a per-station taper, and which way its facing edge points */
const stripProfile = ({ w, h, taper, facing }, bulk = () => 0) => (j) => { const tp = taper[j]; const W = w * tp, H = (h + bulk(j)) * tp; const s = facing === 'up' ? 1 : -1;
  return [[s * W, 0.001], [s * 0.45 * W, H], [-s * 0.35 * W, 0.75 * H], [-s * W, -0.002], [0, -0.006]]; };

// ── controls: sided, in [-1, 1]; skin maps are named per head ──
const ctl = (x, key, side) => { const v = x[key]; return typeof v === 'object' && v ? (v[side] ?? 0) : (v ?? 0); };
function carriers(recipe, head, x) {
  const L = () => compile(recipe, { jawOpen: x.jawOpen || 0 }, { details: false, creases: false }).parts;
  const bone = L(), skin = L();
  for (const [key, c] of Object.entries(head.skin)) for (const side of SIDES) { const v = ctl(x, key, side); if (!v) continue;
    for (const [pt, w, dir] of c.map) { const [part, key2] = pt.includes(':') ? pt.split(':') : ['cranium', pt]; const id = `${part}/${key2}${side}`;
      if (!skin[part].points[id]) throw new Error(`skin map ${key}: no point ${id}`); skin[part].points[id] = add(skin[part].points[id], mul(mx(unit(dir), side), c.amp * w * v)); } }
  return { bone, skin };
}

/** project a point onto a carrier part along a direction: the nearest triangle hit (either way along dir) */
function projectOnto(part, origin, dir) {
  let best = null;
  for (const f of Object.values(part.faces)) { const [a, b, c] = f.map((k) => part.points[k]); const e1 = sub(b, a), e2 = sub(c, a); const p = cross(dir, e2); const det = dot(e1, p); if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, tv = sub(origin, a), u = dot(tv, p) * inv; if (u < 0 || u > 1) continue; const q = cross(tv, e1), v = dot(dir, q) * inv; if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) * inv; if (best === null || Math.abs(t) < Math.abs(best)) best = t; }
  if (best === null) throw new Error('projectOnto: no hit'); return add(origin, mul(dir, best));
}
/** a closed loop of closed cross-sections (a torus): no caps */
function ringLoft(sections) {
  const N = sections.length, m = sections[0].length, pts = {}, faces = [];
  sections.forEach((r, j) => r.forEach((p, k) => (pts[`a${j}.s${k}`] = p))); const id = (j, k) => `a${j % N}.s${k % m}`;
  for (let j = 0; j < N; j++) for (let k = 0; k < m; k++) faces.push([id(j, k), id(j, k + 1), id(j + 1, k + 1)], [id(j, k), id(j + 1, k + 1), id(j + 1, k)]);
  const c = mean(Object.values(pts)); const vol = faces.reduce((s, f) => s + dot(sub(pts[f[0]], c), cross(sub(pts[f[1]], c), sub(pts[f[2]], c))), 0);
  return { points: pts, faces: vol < 0 ? faces.map((f) => [...f].reverse()) : faces, N, m };
}

// ── the EYE region: ball (named bands) + ONE surround ring (lids above, pad below), tucked under the brow ──
function eyeRegion({ bone, skin, at, R, spec, side, lidClose, bunch, brow, browRest, orbit }) {
  const E = spec; const mode = E.mode || 'iris', pupil = E.pupil || (mode === 'solid' ? 'none' : 'round');
  const c = [0, 0, 0.002]; const irisA = E.irisAngle ?? (pupil === 'slit' ? 46 : 36), pupilA = E.pupilAngle ?? 15, limbA = irisA + 5;
  const f = frameAt(bone, 'cranium', at, side); const out = {};
  const polar = [160, 130, 100, 75, 55, limbA, irisA, (irisA + pupilA) / 2, pupilA]; const flatZ = Math.cos(irisA * Math.PI / 180) * R + 0.002;
  const rings = polar.map((a) => { const r = Math.sin(a * Math.PI / 180) * R; let z = Math.cos(a * Math.PI / 180) * R; if (a < irisA) z = flatZ - (a <= pupilA ? 0.0015 : 0);
    return ringAt(add(c, [0, 0, z]), [0, 0, 1], r, 10, 0, a <= pupilA && pupil === 'slit' ? [1, 0.28] : [1, 1]); });
  const gaze = E.gaze || [0, 0]; const turn = (p) => add(rot(rot(sub(p, c), [0, 1, 0], gaze[0] * Math.PI / 180), [1, 0, 0], -gaze[1] * Math.PI / 180), c);
  const ball = loftParts(rings.map((r) => r.map(turn)), turn(add(c, [0, 0, -R])), turn(add(c, [0, 0, flatZ - 0.0015])));
  const band = (j, k) => { const a = Math.min(polar[j], polar[j + 1]); const up = (rings[j][k][1] + rings[j][(k + 1) % 10][1]) / 2 > 0.45 * R;
    return a >= limbA ? (up && a >= 55 && a < 100 ? 'LidShadow' : 'Sclera') : a >= irisA ? 'Limbus' : a >= pupilA ? 'Iris' : 'Pupil'; };
  const tint = (g) => (mode === 'solid' && (g === 'Iris' || g === 'Limbus') ? 'Sclera' : pupil === 'none' && g === 'Pupil' ? (mode === 'solid' ? 'Sclera' : 'Iris') : g);
  const labels = []; for (let j = 0; j + 1 < rings.length; j++) for (let k = 0; k < 10; k++) { const g = tint(band(j, k)); labels.push(g, g); } for (let k = 0; k < 10; k++) labels.push('Sclera', tint('Pupil'));
  out.eye = { ...pinned(bone, 'cranium', at, side, ball, 'Sclera'), faceGroups: labels };
  if (E.catchlight) { const cc = [-0.35 * Math.sin(24 * Math.PI / 180) * R, 0.8 * Math.sin(24 * Math.PI / 180) * R, c[2] + flatZ + 0.0009];
    const hl = { points: { a: turn(add(cc, [0.0024, 0.0006, 0])), b: turn(add(cc, [-0.0012, 0.0021, 0])), d: turn(add(cc, [-0.0012, -0.0021, 0])), e: turn(add(cc, [0, 0, -0.0012])) }, faces: [['a', 'b', 'd'], ['a', 'e', 'b'], ['b', 'e', 'd'], ['d', 'e', 'a']] };
    if (dot(sub(hl.points.a, hl.points.e), cross(sub(hl.points.b, hl.points.e), sub(hl.points.d, hl.points.e))) < 0) hl.faces = hl.faces.map((q) => [...q].reverse());
    out.catch = pinned(bone, 'cranium', at, side, hl, 'Catchlight'); }
  // the brow's lower edge, sampled by its coordinate along the eye's tangent
  const along = (poly, q) => { const pts = poly.map((p) => [dot(sub(p, f.origin), f.tangent), p]).sort((u, v) => u[0] - v[0]);
    if (q <= pts[0][0]) return pts[0][1]; for (let i = 0; i + 1 < pts.length; i++) if (q <= pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], (q - pts[i][0]) / (pts[i + 1][0] - pts[i][0])); return pts[pts.length - 1][1]; };
  const lift = dot(sub(along(brow, 0), along(browRest, 0)), f.bitangent);
  // SURROUND: stations run all the way round the eye. Each cross-section goes from the lash (on the lid
  // aperture, just off the ball) over a rim and a bowed middle to the skin — and on top the skin point is
  // held just UNDER the brow's lower edge, so the brow overhangs the lid. Upper half = lid, lower = pad.
  const hu = R * Math.max(0.05, orbit.open[0] - 0.55 * lidClose + 8 * lift), hl = R * Math.max(0.05, orbit.open[1] - 0.3 * lidClose - 0.28 * Math.max(0, bunch));
  const N = 20, TH = orbit.thickness; const sections = [];
  for (let j = 0; j < N; j++) { const phi = 2 * Math.PI * j / N, cs = Math.cos(phi), sn = Math.sin(phi), up = sn >= 0;
    const ax = 0.97 * R * cs, ay = (up ? hu : hl) * sn, rl = R + 0.005; const lash = add(c, [ax, ay, Math.sqrt(Math.max(1e-6, rl * rl - ax * ax - ay * ay))]);
    const ox = (R + orbit.reach[0]) * cs; let oy = sn * (R + (up ? orbit.reach[1] : orbit.reach[2]));
    if (up) oy = Math.min(oy, surfaceLocalOffset(f, along(brow, ox))[1] - orbit.tuck);
    const outer = surfaceLocalOffset(f, add(projectOnto(skin.cranium, placeSurfaceOffset(f, [ox, oy, 0.06]), f.normal), mul(f.normal, 0.001)));
    const rim = add(c, mul(unit(sub(lash, c)), Math.hypot(...sub(lash, c)) + 0.004));
    const bulk = up ? orbit.bulk[0] : orbit.bulk[1] * (1 + 0.6 * Math.max(0, bunch));
    const mids = [0.35, 0.7].map((w) => { let p = add(lerp(rim, outer, w), [0, 0, bulk * Math.sin(Math.PI * w)]); const d = sub(p, c); if (Math.hypot(...d) < R + 0.007) p = add(c, mul(unit(d), R + 0.007)); return p; });
    const inner = [add(c, mul(unit(sub(lash, c)), Math.hypot(...sub(lash, c)) - TH)), ...[rim, ...mids, outer].map((p) => sub(p, [0, 0, TH]))];
    sections.push([lash, rim, ...mids, outer, ...inner.reverse()]); }
  const ring = ringLoft(sections); const lab = [];
  for (let j = 0; j < N; j++) { const upper = Math.sin(2 * Math.PI * (j + 0.5) / N) >= 0; for (let k = 0; k < ring.m; k++) { const g = k === 0 || k === ring.m - 1 ? 'LidRim' : upper ? 'Lids' : 'Pad'; lab.push(g, g); } }
  out.surround = { ...pinned(bone, 'cranium', at, side, ring, 'Lids'), faceGroups: lab };
  return out;
}

/** the mouth corner: a dual-pinned web between a cranium lip frame and a jaw gum frame */
function cheekWeb({ skin, bone, cran, jaw, side, retract, bunch }) {
  // the side of the mouth: a thin sheet spanning the upper lip line (cranium skin) and the lower lip line
  // (jaw bone) over a run of stations. It stretches as the jaw opens; its front edge IS the mouth corner.
  const M = 6, rings = [];
  for (let j = 0; j < M; j++) { const u = j / (M - 1); const back = 0.25 * retract * u;
    const fu = frameAt(skin, 'cranium', [cran[0] + (cran[1] - cran[0]) * u - back, cran[2]], side), fl = frameAt(bone, 'jaw', [jaw[0] + (jaw[1] - jaw[0]) * u - back, jaw[2]], side);
    const n = unit(add(fu.normal, fl.normal)); const bulge = (0.006 + 0.006 * Math.max(0, bunch)) * Math.sin(Math.PI * (0.15 + 0.7 * u));
    const line = [0, 1 / 3, 2 / 3, 1].map((w) => add(lerp(fu.origin, fl.origin, w), mul(n, 0.002 + bulge * Math.sin(Math.PI * w))));
    rings.push([...line, ...[...line].reverse().map((p) => sub(p, mul(n, 0.006)))]); }
  const cap = (j, d) => add(mean(rings[j]), mul(unit(sub(mean(rings[j]), mean(rings[j + d]))), 0.003));
  const mesh = loftParts(rings, cap(0, 1), cap(M - 1, -1));
  return { ...mesh, group: 'Web', creases: [], faceGroups: loftLabels(mesh, (jj, k) => (k >= 4 && k <= 6 ? 'Mouth' : 'Web'), ['Web', 'Web']) };
}

/** TONGUE: a spine loft on the jaw floor, carried by the jaw BONE (so it rides the hinge). Shape is data —
 * length, width, thickness, taper, groove, tip: 'round' | 'point' | 'fork' (forkDepth, forkSpread). Motion is
 * controls, each spread along the stations and growing toward the tip (the chain rule), so the root stays
 * seated: tongueOut slides + lengthens (and droops once past the teeth), tongueCurl bends the tip up (+) or
 * down (−), tongueSway bends it sideways. Pin-local axes: x forward (tangent), y lateral, z up (normal). */
function tongueRegion(T, { out: ext = 0, curl = 0, sway = 0 }, rest) {
  // REST lies on the carrier: `rest` is the jaw floor's midline sampled at N stations (pin-local). Motion
  // re-bends that polyline segment by segment, so a curled, swayed or extended tongue starts from the floor.
  const N = rest.length, grow = 1 + 0.3 * ext; const segs = rest.slice(1).map((p, j) => mul(sub(p, rest[j]), grow));
  const spine = [add(rest[0], mul(unit(segs[0]), T.slide * ext))]; let aC = 0, aS = 0; const seg = Math.hypot(...segs[0]);
  for (let j = 1; j < N; j++) { const w = j / (N - 1), g = (0.3 + 1.4 * w) / (N - 1); aC += (curl * T.curlMax - ext * T.droop * w * w) * g; aS += sway * T.swayMax * g;
    spine.push(add(spine[j - 1], rot(rot(segs[j - 1], [0, 1, 0], -aC), [0, 0, 1], aS))); }
  const L = segs.reduce((a, v) => a + Math.hypot(...v), 0);
  // cross-sections in a transported frame: an ellipse with a shallow groove along the top midline
  let up = [0, 0, 1]; const frames = spine.map((p, j) => { const t = unit(sub(spine[Math.min(j + 1, N - 1)], spine[Math.max(j - 1, 0)])); up = unit(sub(up, mul(t, dot(up, t)))); return { t, up, lat: unit(cross(up, t)) }; });
  const width = (j) => { const w = j / (N - 1); return T.width * (w < 0.2 ? 0.8 + w : w < 0.7 ? 1 : 1 - (w - 0.7) * (T.tip === 'fork' ? 0.9 : 2.0)); };
  const section = (j, scale = 1) => { const { up: u, lat } = frames[j]; const W = width(j) * scale, H = T.thickness * scale * (0.6 + 0.4 * (1 - j / (N - 1)));
    const ctr = add(spine[j], mul(u, H / 2 - T.seat)); return Array.from({ length: 10 }, (_, k) => { const a = 2 * Math.PI * k / 10 + Math.PI / 10; const top = Math.sin(a) > 0.8; return add(ctr, add(mul(lat, Math.cos(a) * W / 2), mul(u, Math.sin(a) * H / 2 * (top ? 1 - T.groove : 1)))); }); };
  const meshes = [];
  if (T.tip !== 'fork') { const last = N - 2; meshes.push(loftParts(spine.slice(0, -1).map((_, j) => section(j)), sub(spine[0], mul(frames[0].t, 0.01)), T.tip === 'point' ? spine[N - 1] : add(spine[last], mul(frames[last].t, seg * 0.5)))); return meshes; }
  // fork: the body stops at (1 − forkDepth); two tapering prongs leave it at ±forkSpread about the local up
  const jf = Math.round((1 - T.forkDepth) * (N - 1)); meshes.push(loftParts(spine.slice(0, jf + 1).map((_, j) => section(j)), sub(spine[0], mul(frames[0].t, 0.01)), add(spine[jf], mul(frames[jf].t, seg * 0.3))));
  for (const sgn of [1, -1]) { const { t, up: u } = frames[jf]; const pd = rot(t, u, sgn * T.forkSpread); const pl = L * T.forkDepth * 1.15; const Hf = T.thickness * (0.6 + 0.4 * (1 - jf / (N - 1))); const base = add(add(spine[jf], mul(u, Hf / 2 - T.seat)), mul(frames[jf].lat, sgn * width(jf) * 0.22));
    const rings = [0, 0.4, 0.75].map((w, i) => ringAt(add(base, mul(pd, pl * w)), pd, width(jf) * [0.24, 0.17, 0.09][i], 6, Math.PI / 6, [1, 0.6]));
    meshes.push(loftParts(rings, sub(base, mul(pd, 0.006)), add(base, mul(pd, pl)))); }
  return meshes;
}

/** build one head in one expression: the head's DATA drives every call */

/** build one head in one expression: the head's DATA drives every call */
function build(head, x) {
  const recipe = head.recipe; const { bone, skin } = carriers(recipe, head, x); const rest = carriers(recipe, head, {}); const parts = {}; const Rg = head.regions;
  for (const side of SIDES) {
    // brow: the eye region's upper boundary, a skin strip with raise / arch / furrow handles
    const raise = ctl(x, 'browRaise', side), arch = ctl(x, 'browArch', side), furrow = ctl(x, 'browFurrow', side), bunch = ctl(x, 'cheekBunch', side);
    const n = Rg.brow.strip.length, mid = (j) => Math.sin(Math.PI * j / (n - 1)), inner = (j) => j / (n - 1);
    const browHandle = (j) => [-0.006 * furrow * inner(j), 0.006 * raise + 0.008 * arch * mid(j) - 0.01 * furrow * inner(j), 0.004 * furrow * inner(j)];
    const brow = strip(skin, 'cranium', Rg.brow.strip, side, stripProfile(Rg.brow, (j) => 0.008 * furrow * inner(j)), browHandle);
    parts[`brow${side}`] = { ...brow, group: 'Brow', creases: [] };
    const restBrow = strip(rest.skin, 'cranium', Rg.brow.strip, side, stripProfile(Rg.brow));
    const eye = eyeRegion({ bone, skin, at: Rg.eye.at, R: Rg.eye.R, spec: { ...head.eye, ...(x.eye || {}), gaze: x.eyeGaze || [0, 0] }, side, lidClose: ctl(x, 'lidClose', side), bunch,
      brow: brow.edge0, browRest: restBrow.edge0, orbit: Rg.orbit });
    for (const [k, v] of Object.entries(eye)) parts[`${k}${side}`] = v;
    // nostril: sneer slides it back and up, flare widens it
    { const sn = ctl(x, 'sneer', side), fl = ctl(x, 'nostrilFlare', side); const f = frameAt(skin, 'cranium', Rg.nostril.at, side); const r0 = Rg.nostril.r;
      const o = add(f.origin, add(mul(f.tangent, -0.014 * sn * (Rg.nostril.slide ?? 1)), mul(f.bitangent, 0.006 * sn))); const rr = (r) => ringAt(o, f.normal, r * (1 + 0.55 * fl), 6, 0, Rg.nostril.squash);
      parts[`nostril${side}`] = { group: 'Nostrils', creases: [], ...loftParts([rr(r0 * 0.8).map((p) => sub(p, mul(f.normal, 0.007))), rr(r0).map((p) => add(p, mul(f.normal, 0.004 + 0.003 * fl))), rr(r0 * 0.65).map((p) => add(p, mul(f.normal, 0.006 + 0.003 * fl)))], sub(o, mul(f.normal, 0.012)), sub(o, mul(f.normal, -0.001))) }; }
    // fold: a strip whose height is DRIVEN by sneer + cheekBunch
    { const drive = Math.max(0, ctl(x, 'sneer', side)) + 0.7 * Math.max(0, bunch); const m = Rg.fold.strip.length;
      parts[`fold${side}`] = { group: 'Folds', creases: [], ...strip(skin, 'cranium', Rg.fold.strip, side, (j) => { const tp = Math.sin(Math.PI * (j + 0.5) / m); const w = 0.007 * tp, h = (0.002 + 0.009 * drive) * tp; return [[-w, -0.002], [0, h], [w, -0.002], [0, -0.004]]; }) }; }
    parts[`web${side}`] = cheekWeb({ skin, bone, cran: Rg.web.cranium, jaw: Rg.web.jaw, side, retract: ctl(x, 'cornerRetract', side), bunch });
    for (const [k, v] of Object.entries(head.ornaments({ bone, skin, rest: rest.bone, side, x, ctl: (key) => ctl(x, key, side) }))) parts[`${k}${side}`] = v;
  }
  if (Rg.tongue) { const T = Rg.tongue; const base = frameAt(bone, 'jaw', T.at, 'R');
    const rest = Array.from({ length: 10 }, (_, j) => { const f = frameAt(bone, 'jaw', [T.at[0] + (T.to - T.at[0]) * j / 9, T.at[1]], 'R'); return surfaceLocalOffset(base, add(f.origin, mul(f.normal, T.lift))); });
    tongueRegion(T, { out: ctl(x, 'tongueOut', 'R'), curl: ctl(x, 'tongueCurl', 'R'), sway: ctl(x, 'tongueSway', 'R') }, rest)
    .forEach((m, i) => { parts[`tongue.${i}`] = pinned(bone, 'jaw', T.at, 'R', m, 'Tongue'); }); }   // a midline region: one part, on the jaw bone
  for (const [k, v] of Object.entries(head.midline?.({ bone, skin }) || {})) parts[k] = v;
  return { skin, parts };
}

function toSource({ skin, parts }) {
  const vertices = [], faces = [], groups = [], featureEdges = [], index = {}; const audit = { parts: 0, open: 0, badWinding: 0 };
  const push = (pfx, part, groupOf) => { for (const [id, p] of Object.entries(part.points)) { index[pfx + id] = vertices.length; vertices.push(p); }
    for (const [fid, f] of Object.entries(part.faces)) { faces.push(f.map((p) => index[pfx + p])); groups.push(groupOf(fid)); }
    const edges = new Map(); for (const f of Object.values(part.faces)) for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; const k = a < b ? `${a}|${b}` : `${b}|${a}`; const e = edges.get(k) || [0, 0]; e[0]++; e[1] += a < b ? 1 : -1; edges.set(k, e); }
    audit.parts++; for (const [c, bal] of edges.values()) { if (c !== 2) audit.open++; else if (bal) audit.badWinding++; } };
  for (const nm of ['cranium', 'jaw']) push('', skin[nm], (fid) => skin[nm].groups[fid]);
  for (const [nm, d] of Object.entries(parts)) { const fg = d.faceGroups; let fi = 0; push(`${nm}/`, d, () => (fg ? fg[fi++] : d.group)); for (const [a, b] of d.creases || []) featureEdges.push([index[`${nm}/${a}`], index[`${nm}/${b}`]]); }
  return { vertices, faces, groups, featureEdges, audit };
}


// ════════════════════════════ HEAD DATA (species lives here) ════════════════════════════
const S = 0.8, O = [0, 0, 2.05]; const W = (p) => [p[0] * S + O[0], p[1] * S + O[1], p[2] * S + O[2]];
const teethRow = (L1, name, s0, s1, t, count, sizeOf, side, down, tag = '') => { const out = {}; for (let i = 0; i < count; i++) { const s = s0 + (s1 - s0) * i / (count - 1); const f = frameAt(L1, name, [s, t], 'R');
  const len = sizeOf(i); const ax = unit(surfaceLocalOffset(f, add(f.origin, add(mul(down, len), [0, -0.2 * len, 0])))); const k = cross([0, 0, 1], ax); const ang = Math.acos(Math.max(-1, Math.min(1, ax[2])));
  const m = loftParts([[0, 0, -0.006], [0, 0, len * 0.35], [0, 0, len * 0.7]].map((p, j) => ringAt(p, [0, 0, 1], [0.011, 0.009, 0.005][j] * Math.min(1, len / 0.04 + 0.3), 4, Math.PI / 4)), [0, 0, -0.012], [0, 0, len]);
  out[`tooth${tag}${name === 'jaw' ? 'L' : 'U'}.${i}`] = pinned(L1, name, [s, t], side, { ...m, points: Object.fromEntries(Object.entries(m.points).map(([q, p]) => [q, Math.hypot(...k) > 1e-9 ? rot(p, unit(k), ang) : p])) }, 'Teeth'); } return out; };
const jawVolume = (r, amount) => { refineSlot(r, 'jaw', 'jaw', 'bottom', 'chin', 0.5); volumize(r, 'jaw', { 'chin*': 1, bottom: 0.55, 'jaw*': 0.35 }, { st0: 0.3, st1: 0.8, st2: 1, st3: 1, st4: 0.7, st5: 0.35 }, amount); };
/** author a station/slot recipe from a table (head units → metres through W); right side given, left mirrored */
function stationRecipe({ cranium, jaw, bandGroup, dials }) {
  const part = ({ slots, rows, caps, group, bands }) => { const stations = rows.map(([id, y, pts]) => { const p = {}; for (const [slot, v] of Object.entries(pts)) {
      if (typeof v === 'number') p[slot] = W([0, y, v]); else { p[`${slot}R`] = W([v[0], y, v[1]]); p[`${slot}L`] = W([-v[0], y, v[1]]); } } return { id, points: p }; });
    const bandGroups = bands ? Object.fromEntries(rows.slice(0, -1).map(([id], i) => [`${id}-${rows[i + 1][0]}`, bands(i)])) : undefined;
    return { layer: 1, closure: 'closed', slots, stations, caps: { back: W(caps.back), tip: W(caps.tip) }, group, ...(bandGroups ? { bandGroups } : {}), capGroups: { back: group, tip: caps.tipGroup || group } }; };
  return { schema: 'layered-station-head-v1', frame: { up: '+z', front: '+y' }, dials, parts: { cranium: part(cranium), jaw: part(jaw) }, creases: {} };
}
const DRAGON = clone(loadRecipe());
const JAW_HINGE = DRAGON.dials.jawOpen;
const ORBIT = { open: [0.5, 0.42], reach: [0.02, 0.024, 0.024], tuck: 0.004, bulk: [0.004, 0.006], thickness: 0.006 };

const HEADS = {
  dragon: {
    recipe: (() => { const r = clone(DRAGON);
      // the jaw FLOOR as data: two named slot pairs (jowl between gum and jaw side, chin between jaw side
      // and bottom) give the cross-section room to round, then radial volume, fullest mid-jaw, kept at the chin
      refineSlot(r, 'jaw', 'gum', 'jawR', 'jowl', 0.5); refineSlot(r, 'jaw', 'jaw', 'bottom', 'chin', 0.5);
      volumize(r, 'jaw', { 'jowl*': 0.15, 'jaw*': 0.6, 'chin*': 1, bottom: 1.15 }, { st0: 0.45, st1: 0.85, st2: 1, st3: 1, st4: 0.85, st5: 0.6 }, 0.05);   // the floor takes the volume; the gum wall stays low so teeth stay proud
      return r; })(),
    skin: {
      browRaise: { amp: 0.022, map: [['st1.brow', 0.4, [0, 0, 1]], ['st2.brow', 0.9, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
      browFurrow: { amp: 0.022, map: [['st2.brow', 0.5, [0, 0, -1]], ['st3.brow', 1, [-0.35, 0.1, -1]], ['st4.brow', 0.3, [0, 0, -1]]] },
      browArch: { amp: 0.014, map: [['st2.brow', 1, [0, 0, 1]]] },
      sneer: { amp: 0.026, map: [['st3.lip', 0.55, [0.2, 0, 1]], ['st4.lip', 1, [0.25, 0, 1]], ['st4.side', 0.45, [0.4, 0, 1]], ['st4.brow', 0.25, [0, -0.3, 1]]] },
      cheekBunch: { amp: 0.02, map: [['st2.side', 1, [0.6, 0, 0.8]], ['st3.side', 0.7, [0.6, 0, 0.8]], ['st2.lip', 0.4, [0.3, 0, 1]]] },
      cornerRetract: { amp: 0.03, map: [['st1.lip', 0.6, [0.1, -1, 0.3]], ['st2.lip', 1, [0.2, -1, 0.4]]] },
    },
    eye: { mode: 'iris', pupil: 'slit', catchlight: true },
    regions: {
      eye: { at: [2.45, 1.55], R: 0.027 }, orbit: ORBIT,
      brow: { strip: [[1.25, 1.1], [1.8, 1.08], [2.35, 1.1], [2.85, 1.14], [3.3, 1.2]], w: 0.021, h: 0.014, taper: [0.55, 0.9, 1, 0.9, 0.6], facing: 'down' },
      nostril: { at: [4.55, 0.6], r: 0.017, squash: [1.6, 1] },
      fold: { strip: [[4.15, 1.35], [3.6, 1.75], [3.05, 2.2], [2.5, 2.55], [1.95, 2.8]] },
      web: { cranium: [0.35, 1.9, 2.97], jaw: [0.35, 1.9, 0.97] },
      tongue: { at: [0.9, 0.02], to: 4.3, slide: 0.08, width: 0.075, thickness: 0.028, lift: 0, seat: 0.003, groove: 0.35, tip: 'fork', forkDepth: 0.24, forkSpread: 0.32, curlMax: 2.2, swayMax: 0.9, droop: 0.9 },
    },
    ornaments: ({ bone, rest, side, x }) => {
      const at = [1.55, 0.55]; const f = frameAt(rest, 'cranium', at, 'R');
      const spine = [[0.11, -0.22, 0.20], [0.15, -0.30, 0.25], [0.19, -0.39, 0.29], [0.22, -0.48, 0.32], [0.245, -0.56, 0.35], [0.26, -0.63, 0.39], [0.265, -0.68, 0.44], [0.26, -0.71, 0.49]].map((p) => surfaceLocalOffset(f, W(p)));
      const horn = sweep(spine, [0.045, 0.043, 0.036, 0.032, 0.024, 0.019, 0.011].map((v, j) => v * (j % 2 ? 0.92 : 1.06)), 6, { curl: x.hornCurl || 0, curlAxis: cross(sub(spine[2], spine[0]), sub(spine[6], spine[2])) });
      return { horn: pinned(bone, 'cranium', at, side, horn, 'Horns', { creases: horn.rings.filter((_, j) => j % 2 === 0 && j > 0).flatMap((rr) => rr.map((a, i) => [a, rr[(i + 1) % rr.length]])) }),
        ...teethRow(bone, 'cranium', 3.05, 4.9, 3.05, 6, (i) => (i === 1 ? 0.07 : 0.042 - i * 0.003), side, [0, 0, -1]),
        ...teethRow(bone, 'jaw', 3.1, 4.85, 0.88, 5, (i) => (i === 1 ? 0.06 : 0.036 - i * 0.002), side, [0, 0, 1]) };
    },
    midline: ({ bone }) => Object.fromEntries(['crest1', 'crest2', 'crest3'].map((c) => { const p = DRAGON.parts[c]; const f = pinFrame(bone.cranium, p.pin);
      return [c, { group: 'Crest', creases: [], points: Object.fromEntries(Object.entries(p.offsets).map(([k, o]) => [k, placeSurfaceOffset(f, o)])), faces: Object.values(p.faces) }]; })),
    palette: { Skull: '#6f8a6a', Snout: '#6f8a6a', Lip: '#67805f', Palate: '#8a5b55', Jaw: '#66805f', Body: '#6f8a6a', Brow: '#566f4f', Pad: '#66805f', Lids: '#5d7a57', LidRim: '#34452f', Horns: '#d8cdb4', Teeth: '#efe8d6', Crest: '#b9ad8f', Nostrils: '#34422f', Folds: '#5d7757', Mouth: '#5a2f30', Web: '#67805f', Tongue: '#8e3b4a', Sclera: '#e2d6b0', Iris: '#e0a526', Limbus: '#3a2a14', Pupil: '#121212', Catchlight: '#ffffff' },
  },
  // a BEAR authored from its OWN station table: 12 cranium slots (not 8), 7 stations with a stop between
  // brow and muzzle, a short narrow muzzle whose upper lip overhangs a small set-back jaw, a nose pad,
  // round ears, canines only. Same core, same expressions.
  bear: {
    recipe: (() => { const r = stationRecipe({
      cranium: { slots: ['top', 'crownR', 'browR', 'cheekR', 'jowlR', 'lipR', 'palate', 'lipL', 'jowlL', 'cheekL', 'browL', 'crownL'], group: 'Skull',
        rows: [ // [station, y, { top z, crown [x,z], brow, cheek, jowl, lip, palate z }] in head units
          ['st0', -0.34, { top: 0.12, crown: [0.10, 0.10], brow: [0.15, 0.04], cheek: [0.18, -0.06], jowl: [0.16, -0.16], lip: [0.10, -0.22], palate: -0.23 }],
          ['st1', -0.22, { top: 0.22, crown: [0.14, 0.19], brow: [0.21, 0.10], cheek: [0.25, -0.04], jowl: [0.23, -0.17], lip: [0.15, -0.25], palate: -0.25 }],   // deep cheeks hide the jaw hinge
          ['st2', -0.07, { top: 0.23, crown: [0.14, 0.20], brow: [0.21, 0.12], cheek: [0.25, -0.01], jowl: [0.22, -0.14], lip: [0.14, -0.21], palate: -0.21 }],
          ['st3', 0.06, { top: 0.16, crown: [0.11, 0.14], brow: [0.16, 0.08], cheek: [0.18, -0.02], jowl: [0.15, -0.10], lip: [0.11, -0.15], palate: -0.155 }],   // the stop
          ['st4', 0.12, { top: 0.08, crown: [0.075, 0.07], brow: [0.10, 0.035], cheek: [0.11, -0.03], jowl: [0.10, -0.085], lip: [0.085, -0.13], palate: -0.135 }],   // muzzle root
          ['st5', 0.21, { top: 0.065, crown: [0.065, 0.055], brow: [0.085, 0.02], cheek: [0.092, -0.035], jowl: [0.085, -0.085], lip: [0.07, -0.125], palate: -0.125 }],
          ['st6', 0.29, { top: 0.05, crown: [0.05, 0.042], brow: [0.066, 0.01], cheek: [0.072, -0.035], jowl: [0.066, -0.075], lip: [0.055, -0.11], palate: -0.11 }],
        ], caps: { back: [0, -0.40, -0.02], tip: [0, 0.325, -0.03], tipGroup: 'Snout' },
        bands: (i) => (i < 3 ? ['Skull', 'Skull', 'Skull', 'Skull', 'Jowl', 'Palate'] : ['Snout', 'Snout', 'Snout', 'Snout', 'Jowl', 'Palate']) },
      jaw: { slots: ['gum', 'gumR', 'jawR', 'bottom', 'jawL', 'gumL'], group: 'Jaw',
        rows: [
          ['st0', -0.18, { gum: -0.17, gumR: [0.10, -0.17], jawR: [0.11, -0.22], bottom: -0.245 }],
          ['st1', -0.05, { gum: -0.16, gumR: [0.09, -0.16], jawR: [0.10, -0.21], bottom: -0.235 }],
          ['st2', 0.08, { gum: -0.145, gumR: [0.07, -0.145], jawR: [0.075, -0.185], bottom: -0.205 }],
          ['st3', 0.18, { gum: -0.135, gumR: [0.055, -0.135], jawR: [0.058, -0.165], bottom: -0.18 }],
          ['st4', 0.26, { gum: -0.125, gumR: [0.042, -0.125], jawR: [0.044, -0.148], bottom: -0.16 }],
        ], caps: { back: [0, -0.24, -0.20], tip: [0, 0.29, -0.14] } },
      dials: { jawOpen: JAW_HINGE } });
      // the table's slot pairs are named without R/L; rename to the grammar's convention
      for (const P of Object.values(r.parts)) for (const st of P.stations) for (const k of Object.keys(st.points)) { const m = k.match(/^(.*)(R|L)(R|L)$/); if (m) { st.points[m[1] + m[3]] = st.points[k]; delete st.points[k]; } }
      jawVolume(r, 0.022); return r; })(),
    skin: {
      browRaise: { amp: 0.02, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
      browFurrow: { amp: 0.02, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
      browArch: { amp: 0.012, map: [['st2.brow', 1, [0, 0, 1]]] },
      sneer: { amp: 0.022, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
      cheekBunch: { amp: 0.018, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
      cornerRetract: { amp: 0.025, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
    },
    eye: { mode: 'iris', pupil: 'round', irisAngle: 44, catchlight: true },
    regions: {
      eye: { at: [2.55, 2.45], R: 0.021 }, orbit: { ...ORBIT, open: [0.55, 0.45], reach: [0.016, 0.02, 0.024], bulk: [0.003, 0.008] },
      brow: { strip: [[1.9, 2.08], [2.2, 2.03], [2.55, 2.03], [2.85, 2.08], [3.15, 2.2]], w: 0.016, h: 0.011, taper: [0.55, 0.9, 1, 0.9, 0.6], facing: 'down' },
      nostril: { at: [5.92, 1.3], r: 0.01, squash: [1.3, 1], slide: 0.4 },
      fold: { strip: [[5.5, 1.8], [5.0, 2.6], [4.4, 3.4], [3.85, 4.1], [3.4, 4.6]] },
      web: { cranium: [1.6, 3.2, 4.97], jaw: [0.4, 2.1, 0.97] },
      tongue: { at: [0.6, 0.02], to: 3.2, slide: 0.05, width: 0.09, thickness: 0.03, lift: 0, seat: 0.003, groove: 0.3, tip: 'round', curlMax: 1.8, swayMax: 0.8, droop: 1.3 },
    },
    ornaments: ({ bone, side, ctl }) => {
      // round ear: a thick disc standing on the crown, facing forward; earAttitude tilts it (forward +, pinned back −)
      const a = 0.8 * ctl('earAttitude'); const tilt = (p) => rot(rot(p, [0, 0, 1], -0.6), [0, 1, 0], -a);
      const ear = loftParts([[-0.009, 0.042], [0.0, 0.05], [0.008, 0.044]].map(([x0, r]) => ringAt([x0, 0, 0.036], [1, 0, 0], r, 10).map(tilt)), tilt([-0.014, 0, 0.036]), tilt([0.004, 0, 0.036]));
      const nose = sweep([[0, 0, -0.012], [0, 0, 0.012], [0, 0, 0.022]], [0.034, 0.03], 8, { squash: [1.35, 1] });
      return { ear: { ...pinned(bone, 'cranium', [1.25, 0.9], side, ear, 'Ears'), faceGroups: loftLabels(ear, () => 'Ears', ['Ears', 'EarInner']) },
        ...(side === 'R' ? { nose: pinned(bone, 'cranium', [5.75, 0.0001], 'R', nose, 'NosePad') } : {}),
        ...teethRow(bone, 'cranium', 5.1, 5.5, 5.2, 2, (i) => (i === 0 ? 0.03 : 0.012), side, [0, 0, -1]),
        ...teethRow(bone, 'jaw', 3.3, 3.7, 0.88, 2, (i) => (i === 0 ? 0.026 : 0.01), side, [0, 0, 1]) };
    },
    palette: { Skull: '#7a5a3c', Snout: '#b08e68', Jowl: '#9a7853', Palate: '#7d4a44', Jaw: '#9a7853', Body: '#7a5a3c', Brow: '#65482e', Pad: '#86664a', Lids: '#6f5235', LidRim: '#2e2016', Ears: '#6c4f34', EarInner: '#a07c5a', NosePad: '#211813', Teeth: '#efe8d6', Nostrils: '#0e0a08', Folds: '#9a7853', Mouth: '#4a2a28', Web: '#8d6b4a', Tongue: '#c0626a', Sclera: '#efe9dc', Iris: '#5a3a1a', Limbus: '#1e140a', Pupil: '#0e0e0e', Catchlight: '#ffffff' },
  },
};


// ════════════════════════════ EXPRESSIONS (species-neutral) ════════════════════════════
const EXPRESSIONS = {
  neutral: {},
  pant: { jawOpen: 22, tongueOut: 1, tongueCurl: -0.5, tongueSway: 0.35, browRaise: 0.3, cornerRetract: 0.5, lidClose: 0.1, earAttitude: 0.2 },
  flick: { jawOpen: 10, tongueOut: 1, tongueCurl: 0.18, tongueSway: -0.2, browFurrow: 0.4, lidClose: 0.3, nostrilFlare: 0.6 },
  surprise: { jawOpen: 9, browRaise: 1, browArch: 1, lidClose: -0.35, nostrilFlare: 0.5, cornerRetract: -0.3, earAttitude: 0.6 },
  snarl: { tongueCurl: 0.35, jawOpen: 16, browFurrow: 1, sneer: 1, cheekBunch: 0.8, cornerRetract: 0.7, nostrilFlare: 1, lidClose: 0.45, hornCurl: 0.35, earAttitude: -1, eyeGaze: [14, -6] },
};

export { HEADS, EXPRESSIONS, build, toSource, carriers, frameAt, compile };
export const vec = { sub, add, mul, dot, cross, unit, mean };
