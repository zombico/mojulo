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
import { mulberry32 } from '../../../control/lib/graph/polygonizer/floorplan-glyphs.js';

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
/** Continuous parameters: a station's `u` and a slot's `t` default to their index and are FROZEN before the
 * first refinement, so inserted stations and slots never renumber the rest — addresses keep their meaning. */
function freezeParams(P) {
  P.stations.forEach((st, i) => { if (st.u === undefined) st.u = i; });
  if (!P.slotT) { const half = P.slots.length / 2; P.slotT = Object.fromEntries(P.slots.slice(0, half + 1).map((sl, k) => [sl, k])); }
}
const slotParam = (P, sl) => { const v = P.slotT?.[sl] ?? P.slotT?.[mirrorPid(sl)]; if (v === undefined) throw new Error(`no parameter for slot ${sl}`); return v; };
/** insert stations between stations `a` and `b` at fractions `fs` (linear: the surface does not move) */
function refineStation(recipe, part, a, b, fs = [0.5]) {
  const P = recipe.parts[part]; freezeParams(P); const ia = P.stations.findIndex((st) => st.id === a);
  if (ia < 0 || P.stations[ia + 1]?.id !== b) throw new Error(`refineStation: ${a} and ${b} must be adjacent in ${part}`);
  const A = P.stations[ia], B = P.stations[ia + 1];
  const made = fs.map((f) => ({ id: `${a}_${b}_${Math.round(f * 100)}`, u: A.u + (B.u - A.u) * f, points: Object.fromEntries(Object.keys(A.points).map((k) => [k, lerp(A.points[k], B.points[k], f)])) }));
  P.stations.splice(ia + 1, 0, ...made);
  const g = P.bandGroups?.[`${a}-${b}`]; if (g) { delete P.bandGroups[`${a}-${b}`]; const chain = [a, ...made.map((m) => m.id), b]; for (let i = 0; i + 1 < chain.length; i++) P.bandGroups[`${chain[i]}-${chain[i + 1]}`] = [...g]; }
}
function refineSlot(recipe, part, a, b, name, f = 0.5) {
  const P = recipe.parts[part]; freezeParams(P); const S = P.slots; const n = S.length;
  const ia = S.indexOf(`${a}R`), ib = S.indexOf(b.endsWith('R') || b.endsWith('L') ? b : b);
  if (ia < 0 || ib < 0 || Math.abs(ia - ib) !== 1) throw new Error(`refineSlot: ${a}R and ${b} must be adjacent in ${part}`);
  const insR = Math.max(ia, ib); S.splice(insR, 0, `${name}R`);
  const iaL = S.indexOf(`${a}L`), ibL = S.indexOf(b.endsWith('R') ? b.replace(/R$/, 'L') : b); S.splice(Math.max(iaL, ibL), 0, `${name}L`);
  for (const st of P.stations) { st.points[`${name}R`] = lerp(st.points[`${a}R`], st.points[b], f); st.points[`${name}L`] = lerp(st.points[`${a}L`], st.points[b.endsWith('R') ? b.replace(/R$/, 'L') : b], f); }
  if (P.bandGroups) for (const arr of Object.values(P.bandGroups)) arr.splice(insR - 1, 0, arr[insR - 1]);   // the split band's halves keep its group
  P.slotT[`${name}R`] = slotParam(P, `${a}R`) + (slotParam(P, b) - slotParam(P, `${a}R`)) * f;
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
  const U = part.stations.map((st, i) => st.u ?? i), T = slots.slice(0, half + 1).map((sl, k) => part.slotT?.[sl] ?? k);
  if (!(s >= U[0] && s <= U[U.length - 1] && t >= T[0] && t <= T[half])) throw new Error(`address (${s},${t}) off ${name}`);
  let i = 0; while (i < U.length - 2 && s > U[i + 1]) i++; let k = 0; while (k < half - 1 && t > T[k + 1]) k++;
  const u = (s - U[i]) / (U[i + 1] - U[i]), v = (t - T[k]) / (T[k + 1] - T[k]);
  const P = (j, kk) => `${name}/${ids[j]}.${slots[kk % n]}`; const band = `${name}/${ids[i]}-${ids[i + 1]}.k${k}`;
  const p00 = P(i, k), p01 = P(i, k + 1), p10 = P(i + 1, k), p11 = P(i + 1, k + 1);
  const [id, w, edge] = u <= v ? [`${band}.a`, { [p00]: 1 - v, [p01]: v - u, [p11]: u }, [p01, p11]] : [`${band}.b`, { [p00]: 1 - u, [p11]: v, [p10]: u - v }, [p00, p10]];
  const pin = { parent: name, face: id, weights: part.faces[id].map((p) => w[p]), tangentEdge: edge, handedness: 1 };
  return side === 'R' ? pin : { ...pin, face: mirrorFaceId(pin.face, n), weights: [...pin.weights].reverse(), tangentEdge: pin.tangentEdge.map(mirrorPid), handedness: -1 };
}
const frameAt = (L1, name, [s, t], side) => pinFrame(L1[name], address(L1, name, s, t, side));
/** a midline frame: the average of an address's frame and its mirror, so a midline detail stays on x = 0 */
function symmetricFrameAt(L1, name, at) { const a = frameAt(L1, name, at, 'R'), b = frameAt(L1, name, at, 'L');
  const normal = unit(add(a.normal, b.normal)), tangent = unit(add(a.tangent, b.tangent)); return { origin: mean([a.origin, b.origin]), tangent, bitangent: unit(cross(normal, tangent)), normal, handedness: 1 }; }
/** migrate a face pin (face id + barycentric weights, as authored before refinement) to a parameter address;
 * `flip` says the pin's tangent edge ran against +s, so its local x/y offsets must be negated */
function pinToAddress(part, pin) {
  const ids = part.faces[pin.face]; if (!ids) throw new Error(`pinToAddress: unknown face ${pin.face}`);
  const U = Object.fromEntries(part.stations.map((st, i) => [st.id, st.u ?? i]));
  const st = (id) => { const m = id.match(/\/([^./]+)\.([^.]+)$/); return [U[m[1]], part.slotT?.[m[2]] ?? part.slotT?.[mirrorPid(m[2])] ?? part.slots.indexOf(m[2])]; };
  const at = [0, 1].map((c) => ids.reduce((sum, id, i) => sum + pin.weights[i] * st(id)[c], 0));
  const [a, b] = pin.tangentEdge.map(st); return { at, flip: b[0] < a[0] };
}

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
  const pin = address(L1, name, at[0], at[1], side); const f = pinFrame(L1[name], pin);
  return { group, creases: [], pin, ...extra, points: Object.fromEntries(Object.entries(local.points).map(([k, o]) => [k, placeSurfaceOffset(f, o)])), faces: side === 'L' ? local.faces.map((q) => [...q].reverse()) : local.faces };
}
/** SURFACE STRIP: stations are (s,t) addresses; cross-sections live in each station's own surface frame.
 * Convention: profile point 0 is the edge FACING the region the strip bounds (brow: down; pad: up). */
function strip(L1, name, addrs, side, profile, handle = () => [0, 0, 0]) {
  const F = addrs.map((a) => frameAt(L1, name, a, side)); const O = F.map((f) => f.origin);
  const rings = F.map((f, j) => { const n = f.normal; const raw = sub(O[Math.min(j + 1, O.length - 1)], O[Math.max(j - 1, 0)]); const d = unit(sub(raw, mul(n, dot(raw, n))));
    const e = mul(cross(n, d), side === 'L' ? -1 : 1); const [hd, he, hn] = handle(j); const o = add(f.origin, add(add(mul(d, hd), mul(e, he)), mul(n, hn)));
    return profile(j).map(([a, h]) => add(o, add(mul(e, a), mul(n, h)))); });
  const end = (j, sgn) => { const c = mean(rings[j]); const other = mean(rings[j + (sgn < 0 ? 1 : -1)]); return add(c, mul(unit(sub(c, other)), 0.005)); };
  const mesh = loftParts(rings, end(0, -1), end(rings.length - 1, 1)); mesh.edge0 = rings.map((r) => r[0]); mesh.normal = F[Math.floor(F.length / 2)].normal;
  const mid = addrs[Math.floor(addrs.length / 2)]; mesh.pin = address(L1, name, mid[0], mid[1], side);   // the strip's carrier address, for a bake
  return mesh;
}
/** a strip's profile from region data: w, h, a per-station taper, and which way its facing edge points */
const stripProfile = ({ w, h, taper, facing }, bulk = () => 0) => (j) => { const tp = taper[j]; const W = w * tp, H = (h + bulk(j)) * tp; const s = facing === 'up' ? 1 : -1;
  return [[s * W, 0.001], [s * 0.45 * W, H], [-s * 0.35 * W, 0.75 * H], [-s * W, -0.002], [0, -0.006]]; };

// ── controls: sided, in [-1, 1]; skin maps are named per head ──
const ctl = (x, key, side) => { const v = x[key]; return typeof v === 'object' && v ? (v[side] ?? 0) : (v ?? 0); };
function carriers(recipe, head, x) {
  const L = () => compile(recipe, { jawOpen: x.jawOpen || 0 }, { details: false, creases: false }).parts;
  const bone = L(), skin = L();
  // a skin map entry is an ADDRESS with a falloff radius (metres), not a point name: it moves whatever points
  // refinement put near it, smoothly. Sided: a side's map touches that side's points and the midline only.
  const sideOf = (id) => (/[RL]$/.test(id) ? id.slice(-1) : 'M');
  for (const [key, c] of Object.entries(head.skin)) for (const side of SIDES) { const v = ctl(x, key, side); if (!v) continue;
    for (const m of c.map) { const part = m.part || 'cranium'; const o = frameAt(bone, part, m.at, side).origin; const dir = mx(unit(m.dir), side);
      for (const [id, p] of Object.entries(bone[part].points)) { if (sideOf(id) !== side && sideOf(id) !== 'M') continue; const d = Math.hypot(...sub(p, o)); if (d >= m.r) continue;
        const f = (1 - (d / m.r) ** 2) ** 2; skin[part].points[id] = add(skin[part].points[id], mul(dir, c.amp * m.w * f * v)); } } }
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
/** TILES: detail GROWN from a carrier. An (s,t) window splits into cells (optionally brick-laid). Each tile's
 * footprint is a `sides`-gon of ADDRESSES on the carrier around its cell centre (`coverage` > 1 overlaps its
 * neighbours like shingles), sunk a hair; its top is the footprint inset toward the centre, raised along the
 * surface normal and leaned along +s (negative leans back). `edgeFade` tapers height toward the window border,
 * `wobble` and `jitter` move centres and heights — all seeded per tile id, never by order. Tiles are rebuilt
 * from the carrier every time, so they ride it. */
function tiles(L1, name, side, T, idBase, { keep = [], rest = L1 } = {}) {
  const out = {}; const [s0, s1] = T.s, [t0, t1] = T.t, [ns, nt] = T.grid; const ds = (s1 - s0) / ns, dt = (t1 - t0) / nt;
  const sides = T.sides ?? 4, cover = T.coverage ?? 0.9, fade = T.edgeFade ?? 0; const clampS = (v) => Math.min(s1, Math.max(s0, v)), clampT = (v) => Math.min(t1, Math.max(t0, v));
  const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  for (let j = 0; j < nt; j++) { const off = T.brick && j % 2 ? 0.5 : 0;
    for (let i = 0; i < ns; i++) { if (s0 + (i + off + 1) * ds > s1 + 1e-9) continue; const id = `${idBase}.${i}.${j}`; const rng = mulberry32(hash(id)); const [r1, r2, r3, r4] = [rng(), rng(), rng(), rng()];
      const sc = s0 + (i + off + 0.5 + (T.wobble ?? 0) * (r1 - 0.5)) * ds, tc = t0 + (j + 0.5 + (T.wobble ?? 0) * (r2 - 0.5)) * dt;
      const ring = Array.from({ length: sides }, (_, k) => { const a = 2 * Math.PI * k / sides + Math.PI / sides; return [clampS(sc + Math.cos(a) * ds / 2 * cover), clampT(tc + Math.sin(a) * dt / 2 * cover)]; });
      const O = ring.map((a) => frameAt(L1, name, a, side).origin); const F0 = frameAt(L1, name, [sc, tc], side); const n = F0.normal, c = F0.origin;
      const along = unit(sub(frameAt(L1, name, [clampS(sc + ds / 4), tc], side).origin, frameAt(L1, name, [clampS(sc - ds / 4), tc], side).origin));
      let edge = fade > 0 ? Math.min(1, Math.min(sc - s0, s1 - sc) / (fade * (s1 - s0)), Math.min(tc - t0, t1 - tc) / (fade * (t1 - t0))) : 1;
      // regions win over tiles: a tile centred inside a keep-out is not grown, one near it fades. `thin` drops
      // tiles toward the window border by seeded chance, so a patch has no hard edge. Both are decided on the
      // REST carrier, so the tile set and heights never depend on the expression.
      const cR = frameAt(rest, name, [sc, tc], side).origin; const room = Math.min(Infinity, ...keep.map((z) => Math.hypot(...sub(cR, z.p)) - z.r));
      if (room <= 0 || r4 < (T.thin ?? 0) * (1 - Math.min(1, Math.max(0, edge)))) continue; edge = Math.min(edge, room / (T.clear ?? 0.012));
      const h = T.height * (1 + (T.jitter ?? 0) * (2 * r3 - 1)) * (0.2 + 0.8 * Math.max(0, edge)); const lean = (T.lean ?? 0) * h;
      const base = O.map((o) => sub(o, mul(n, 0.0015))); const top = O.map((o) => add(add(add(c, mul(sub(o, c), 1 - T.inset)), mul(n, h)), mul(along, lean)));
      const mesh = loftParts([base, top], sub(c, mul(n, 0.003)), add(mean(top), mul(n, h * 0.2)));
      out[id] = { ...mesh, group: T.group[(i + j) % T.group.length], creases: [], pin: address(L1, name, sc, tc, side) }; } }
  return out;
}
/** a closed loop of closed cross-sections (a torus): no caps */
function ringLoft(sections) {
  const N = sections.length, m = sections[0].length, pts = {}, faces = [];
  sections.forEach((r, j) => r.forEach((p, k) => (pts[`a${j}.s${k}`] = p))); const id = (j, k) => `a${j % N}.s${k % m}`;
  for (let j = 0; j < N; j++) for (let k = 0; k < m; k++) faces.push([id(j, k), id(j, k + 1), id(j + 1, k + 1)], [id(j, k), id(j + 1, k + 1), id(j + 1, k)]);
  const c = mean(Object.values(pts)); const vol = faces.reduce((s, f) => s + dot(sub(pts[f[0]], c), cross(sub(pts[f[1]], c), sub(pts[f[2]], c))), 0);
  return { points: pts, faces: vol < 0 ? faces.map((f) => [...f].reverse()) : faces, N, m };
}
/** COLLAR: a raised band round ring j of a loft (growth ridges, knuckles): a short closed loft of three rings
 * about that ring's centre (flush, proud by `height` × its radius, flush) spanning ±`width` of the neighbouring
 * segments. Built from the loft's own points, so it rides whatever bent the loft (a curl, a hinge). */
function collar(mesh, j, height, width = 0.3) {
  const ring = (i) => mesh.rings[i].map((id) => mesh.points[id]); const R = ring(j), c = mean(R);
  const prev = mean(ring(Math.max(0, j - 1))), next = mean(ring(Math.min(mesh.rings.length - 1, j + 1)));
  const ax = unit(sub(next, prev)), half = width * Math.hypot(...sub(next, prev)) / 2;
  const at = (d, s) => R.map((p) => add(add(c, mul(sub(p, c), s)), mul(ax, d)));
  return loftParts([at(-half, 0.97), at(0, 1 + height), at(half, 0.97)], add(c, mul(ax, -half * 1.3)), add(c, mul(ax, half * 1.3)));
}
/** DISH: a shallow bowl standing on a face (an inner bowl, a socket rim): a raised rim ring falling to a floor below it,
 * built along local +z and mapped through `place` into the host's frame. Groups: rim outside, inner inside. */
function dish({ r, rim, floor, m = 10, squash = [1, 1] }, place = (p) => p, [outer, inner] = ['Rim', 'Inner']) {
  const ring = (rr, z) => ringAt([0, 0, z], [0, 0, 1], rr, m, 0, squash).map(place);
  const mesh = loftParts([ring(r * 1.08, 0), ring(r, rim), ring(r * 0.62, floor)], place([0, 0, -0.002]), place([0, 0, floor * 0.8]));
  return { ...mesh, faceGroups: loftLabels(mesh, (j) => (j === 0 ? outer : inner), [outer, inner]) };
}
/** DRIVEN STRIP: a surface strip whose height is a declared linear combination of controls (a corrective):
 * h × (rest + Σ drive[k] · max(0, control k)). Always emitted, at its rest height when undriven, so the part
 * set never depends on the expression. */
function drivenStrip(L1, side, D, x) {
  const name = D.part || 'cranium'; const k = (D.rest ?? 0.15) + Object.entries(D.drive).reduce((s, [key, w]) => s + w * Math.max(0, ctl(x, key, side)), 0); const m = D.strip.length;
  const mesh = strip(L1, name, D.strip, side, (j) => { const tp = Math.sin(Math.PI * (j + 0.5) / m); const w = D.w * tp, h = Math.max(0.0005, D.h * k * tp); return [[-w, -0.002], [0, h], [w, -0.002], [0, -0.004]]; });
  const mid = D.strip[Math.floor(m / 2)]; return { ...mesh, group: D.group || 'Wrinkles', creases: [], pin: address(L1, name, mid[0], mid[1], side) };
}
/** WHISKERS: thin tapering sweeps rooted on the skin (barbels, vibrissae). Each root is an address with an
 * optional `dir` and `len`; the spine runs out along `dir` (pin-local) and droops under world gravity read
 * through the RIGHT pin frame, so the left set mirrors the right by name. `curl` bends it along its length. */
function whiskers(L1, side, W) {
  const name = W.part || 'cranium'; const out = {};
  W.roots.forEach((root, i) => { const fR = frameAt(L1, name, root.at, 'R'); const down = [fR.tangent, fR.bitangent, fR.normal].map((a) => -a[2]);
    const d = unit(root.dir || W.dir), len = root.len ?? W.len, n = 6;
    const spine = Array.from({ length: n + 1 }, (_, j) => { const w = j / n; return add(add([0, 0, -W.r], mul(d, len * w)), mul(down, (W.droop ?? 0) * len * w * w)); });
    const mesh = sweep(spine, Array.from({ length: n }, (_, j) => W.r * (1 - 0.8 * j / n)), 4, { curl: W.curl ?? 0, curlAxis: unit(cross(d, down)) });
    out[`whisker${i}`] = pinned(L1, name, root.at, side, mesh, W.group || 'Whiskers'); });
  return out;
}
/** KEEP-OUT: every region placed on a carrier claims the skin around it, as world points with radii, so grown
 * detail (tiles) yields to it. Read from the REST carrier, so what is kept out never depends on the expression. */
function keepOut(L1, Rg, side) {
  const z = []; const at = (part, a, r) => z.push({ p: frameAt(L1, part, a, side).origin, r });
  if (Rg.eye) at('cranium', Rg.eye.at, Rg.eye.R + Math.max(...(Rg.orbit?.reach ?? [0])));
  if (Rg.nostril) at('cranium', Rg.nostril.at, 1.6 * Rg.nostril.r * Math.max(...(Rg.nostril.squash ?? [1])));
  for (const a of Rg.brow?.strip ?? []) at('cranium', a, Rg.brow.w);
  for (const a of Rg.fold?.strip ?? []) at('cranium', a, 0.008);
  for (const D of Rg.wrinkles ?? []) for (const a of D.strip) at(D.part || 'cranium', a, D.w);
  for (const r of Rg.whiskers?.roots ?? []) at(Rg.whiskers.part || 'cranium', r.at, 3 * Rg.whiskers.r);
  if (Rg.web) for (let i = 0; i <= 3; i++) { const u = i / 3, { cranium: C, jaw: J } = Rg.web; at('cranium', [C[0] + (C[1] - C[0]) * u, C[2]], 0.01); at('jaw', [J[0] + (J[1] - J[0]) * u, J[2]], 0.01); }
  return z;
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
  // CLEARANCE RULE: no lid or pad vertex inside the eyeball. The ball's extent is measured on its drawn vertices
  // (iris disc included) about its centre, which gaze never moves. A lining vertex inside that radius plus
  // `clear` is lifted along the eye's axis onto it, a skin vertex onto it plus `minThick`: the lid drapes over
  // the front of the ball. Lifting along the axis keeps x and y, so the aperture and the brow tuck are
  // untouched and the two rules hold together. Points already clear are never moved.
  const ballR = Math.max(...Object.values(ball.points).map((p) => Math.hypot(...sub(p, c)))), Rc = ballR + (orbit.clear ?? 0.0008);
  const hold = (p, r) => { const d = sub(p, c); return Math.hypot(...d) >= r ? p : [p[0], p[1], c[2] + Math.sqrt(r * r - d[0] * d[0] - d[1] * d[1])]; };
  const clearOfBall = (sec) => { const H = sec.length / 2; return [...sec.slice(0, H).map((p) => hold(p, Rc + (orbit.minThick ?? 0.001))), ...sec.slice(H).map((p) => hold(p, Rc))]; };
  for (let j = 0; j < N; j++) { const phi = 2 * Math.PI * j / N, cs = Math.cos(phi), sn = Math.sin(phi), up = sn >= 0;
    const ax = 0.97 * R * cs, ay = (up ? hu : hl) * sn, rl = R + 0.005; const lash = add(c, [ax, ay, Math.sqrt(Math.max(1e-6, rl * rl - ax * ax - ay * ay))]);
    const ox = (R + orbit.reach[0]) * cs; let oy = sn * (R + (up ? orbit.reach[1] : orbit.reach[2]));
    if (up) oy = Math.min(oy, surfaceLocalOffset(f, along(brow, ox))[1] - orbit.tuck);
    const outer = surfaceLocalOffset(f, add(projectOnto(skin.cranium, placeSurfaceOffset(f, [ox, oy, 0.06]), f.normal), mul(f.normal, 0.001)));
    const rim = add(c, mul(unit(sub(lash, c)), Math.hypot(...sub(lash, c)) + 0.004));
    const bulk = up ? orbit.bulk[0] : orbit.bulk[1] * (1 + 0.6 * Math.max(0, bunch));
    const mids = [0.35, 0.7].map((w) => { let p = add(lerp(rim, outer, w), [0, 0, bulk * Math.sin(Math.PI * w)]); const d = sub(p, c); if (Math.hypot(...d) < R + 0.007) p = add(c, mul(unit(d), R + 0.007)); return p; });
    const inner = [add(c, mul(unit(sub(lash, c)), Math.hypot(...sub(lash, c)) - TH)), ...[rim, ...mids, outer].map((p) => sub(p, [0, 0, TH]))];
    sections.push(clearOfBall([lash, rim, ...mids, outer, ...inner.reverse()])); }
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
  return { ...mesh, group: 'Web', creases: [], faceGroups: loftLabels(mesh, (jj, k) => (k >= 4 && k <= 6 ? 'Mouth' : 'Web'), ['Web', 'Web']), pin: address(skin, 'cranium', (cran[0] + cran[1]) / 2, cran[2], side) };
}

/** TONGUE: a spine loft on the jaw floor, carried by the jaw BONE (so it rides the hinge). Shape is data —
 * length, width, thickness, taper, groove, tip: 'round' | 'point' | 'fork' (forkDepth, forkSpread). Motion is
 * controls, each spread along the stations and growing toward the tip (the chain rule), so the root stays
 * seated: tongueOut slides + lengthens (and droops once past the teeth), tongueCurl bends the tip up (+) or
 * down (−), tongueSway bends it sideways. Pin-local axes: x forward (tangent), y lateral, z up (normal). */
/** the jaw's underside in a jaw-carried frame: its midline `bottom` profile as z(x), held at the chin past
 * either end. Rides the hinge, so "below the jaw" means below the jaw wherever the jaw has swung. */
function jawFloor(bone, base) {
  const prof = bone.jaw.stations.map((st) => surfaceLocalOffset(base, bone.jaw.points[`jaw/${st.id}.bottom`])).sort((a, b) => a[0] - b[0]);
  return (x) => { if (x <= prof[0][0]) return prof[0][2]; for (let i = 0; i + 1 < prof.length; i++) if (x <= prof[i + 1][0]) return prof[i][2] + (prof[i + 1][2] - prof[i][2]) * (x - prof[i][0]) / (prof[i + 1][0] - prof[i][0]); return prof[prof.length - 1][2]; };
}
function tongueRegion(T, { out: ext = 0, curl = 0, sway = 0 }, rest, floor) {
  // REST lies on the carrier: `rest` is the jaw floor's midline sampled at N stations (pin-local). Motion
  // re-bends that polyline segment by segment, so a curled, swayed or extended tongue starts from the floor.
  // CLEARANCE RULE: the tongue never goes below the jaw. `floor(x)` is the jaw's underside in the jaw's own
  // frame (held at the chin past the tip); a segment that would dip under it is turned up just enough, and
  // every later segment inherits the turn — lengths are kept, so the chain never stretches to comply.
  const N = rest.length, grow = 1 + 0.3 * ext; const segs = rest.slice(1).map((p, j) => mul(sub(p, rest[j]), grow));
  const spine = [add(rest[0], mul(unit(segs[0]), T.slide * ext))]; let aC = 0, aS = 0; const seg = Math.hypot(...segs[0]);
  const width = (j) => { const w = j / (N - 1); return T.width * (w < 0.2 ? 0.8 + w : w < 0.7 ? 1 : 1 - (w - 0.7) * (T.tip === 'fork' ? 0.9 : 2.0)); };
  const thick = (j) => T.thickness * (0.6 + 0.4 * (1 - j / (N - 1)));
  // the test is on the RING, not the spine: a swayed or rolled section dips its lower edge below its centre
  let upPrev = [0, 0, 1]; const MARGIN = 0.001; const checked = [];
  // the ring exactly as `section` will build it (same frame, centre and ellipse), so the rule judges drawn vertices
  const ringAtStation = (j, q) => { const t = unit(sub(q, spine[j - 1])); const up = unit(sub(upPrev, mul(t, dot(upPrev, t)))); const lat = unit(cross(up, t)); const W = width(j), H = thick(j);
    const ctr = add(q, mul(up, H / 2 - T.seat)); return { up, pts: Array.from({ length: 10 }, (_, k) => { const a = 2 * Math.PI * k / 10 + Math.PI / 10; const top = Math.sin(a) > 0.8; return add(ctr, add(mul(lat, Math.cos(a) * W / 2), mul(up, Math.sin(a) * H / 2 * (top ? 1 - T.groove : 1)))); }) }; };
  const ok = (j, q) => !floor || ringAtStation(j, q).pts.every((v) => v[2] - MARGIN >= floor(v[0]));
  for (let j = 1; j < N; j++) { const w = j / (N - 1), g = (0.3 + 1.4 * w) / (N - 1); aC += (curl * T.curlMax - ext * T.droop * w * w) * g; aS += sway * T.swayMax * g;
    const step = (a) => add(spine[j - 1], rot(rot(segs[j - 1], [0, 1, 0], -a), [0, 0, 1], aS)); let q = step(aC);
    if (!ok(j, q) && ok(j, step(aC + Math.PI / 2))) { let lo = 0, hi = Math.PI / 2; for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (ok(j, step(aC + mid))) hi = mid; else lo = mid; } aC += hi; q = step(aC); }
    upPrev = ringAtStation(j, q).up; checked[j] = upPrev; spine.push(q); }
  const L = segs.reduce((a, v) => a + Math.hypot(...v), 0);
  // cross-sections in a transported frame: an ellipse with a shallow groove along the top midline
  // the frames the clearance check used ARE the frames the rings are built in (station 0 faces its first segment)
  const frames = spine.map((p, j) => { const t = unit(j === 0 ? sub(spine[1], spine[0]) : sub(p, spine[j - 1])); const up = j === 0 ? unit(sub([0, 0, 1], mul(t, t[2]))) : checked[j]; return { t, up, lat: unit(cross(up, t)) }; });
  const section = (j, scale = 1) => { const { up: u, lat } = frames[j]; const W = width(j) * scale, H = T.thickness * scale * (0.6 + 0.4 * (1 - j / (N - 1)));
    const ctr = add(spine[j], mul(u, H / 2 - T.seat)); return Array.from({ length: 10 }, (_, k) => { const a = 2 * Math.PI * k / 10 + Math.PI / 10; const top = Math.sin(a) > 0.8; return add(ctr, add(mul(lat, Math.cos(a) * W / 2), mul(u, Math.sin(a) * H / 2 * (top ? 1 - T.groove : 1)))); }); };
  const meshes = [];
  if (T.tip !== 'fork') { const last = N - 2; meshes.push(loftParts(spine.slice(0, -1).map((_, j) => section(j)), sub(spine[0], mul(frames[0].t, 0.01)), T.tip === 'point' ? spine[N - 1] : add(spine[last], mul(frames[last].t, seg * 0.5)))); return meshes; }
  // fork: the body stops at (1 − forkDepth); two tapering prongs leave it at ±forkSpread about the local up
  const jf = Math.round((1 - T.forkDepth) * (N - 1)); meshes.push(loftParts(spine.slice(0, jf + 1).map((_, j) => section(j)), sub(spine[0], mul(frames[0].t, 0.01)), add(spine[jf], mul(frames[jf].t, seg * 0.3))));
  // the fork is ONE structure: each prong's required lift is found on its own vertices, then both take the larger
  const { t, up: u, lat } = frames[jf]; const pl = L * T.forkDepth * 1.15; const Hf = thick(jf);
  const prong = (sgn, lift) => { const base = add(add(spine[jf], mul(u, Hf / 2 - T.seat)), mul(lat, sgn * width(jf) * 0.22)); const pd = rot(rot(t, u, sgn * T.forkSpread), lat, -lift);
    // a prong is never thicker than the body it leaves: its vertical half-extent is capped by the body's at the fork
    const rings = [0, 0.4, 0.75].map((w, i) => { const r = width(jf) * [0.24, 0.17, 0.09][i]; return ringAt(add(base, mul(pd, pl * w)), pd, r, 6, Math.PI / 6, [1, Math.min(0.6, (Hf / 2 - T.seat * 0.5) / r)]); });
    return loftParts(rings, sub(base, mul(pd, 0.006)), add(base, mul(pd, pl))); };
  const clearOf = (m) => !floor || Object.values(m.points).every((q) => q[2] - MARGIN >= floor(q[0]));
  const need = (sgn) => { if (clearOf(prong(sgn, 0)) || !clearOf(prong(sgn, Math.PI / 2))) return 0; let lo = 0, hi = Math.PI / 2; for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (clearOf(prong(sgn, mid))) hi = mid; else lo = mid; } return hi; };
  const lift = Math.max(need(1), need(-1)); for (const sgn of [1, -1]) meshes.push(prong(sgn, lift));
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
    { const sn = ctl(x, 'sneer', side), fl = ctl(x, 'nostrilFlare', side); const r0 = Rg.nostril.r;
      // built ONCE in the right pin frame's local coordinates (x tangent, y bitangent, z normal; the rim's long axis is
      // world-horizontal, read through that frame), then pinned per side, so the left nostril mirrors the right by name
      const fR = frameAt(skin, 'cranium', Rg.nostril.at, 'R'); const zl = [dot(fR.tangent, [0, 0, 1]), dot(fR.bitangent, [0, 0, 1]), dot(fR.normal, [0, 0, 1])];
      const o = [-0.014 * sn * (Rg.nostril.slide ?? 1), 0.006 * sn, 0]; const rr = (r) => { let u = cross([0, 0, 1], zl); if (Math.hypot(...u) < 1e-6) u = [1, 0, 0]; u = unit(u); const v = cross([0, 0, 1], u); const R = r * (1 + 0.55 * fl);
        return Array.from({ length: 6 }, (_, i) => { const t = 2 * Math.PI * i / 6; return add(o, add(mul(u, Math.cos(t) * R * Rg.nostril.squash[0]), mul(v, Math.sin(t) * R * Rg.nostril.squash[1]))); }); };
      const local = loftParts([rr(r0 * 0.8).map((p) => sub(p, [0, 0, 0.007])), rr(r0).map((p) => add(p, [0, 0, 0.004 + 0.003 * fl])), rr(r0 * 0.65).map((p) => add(p, [0, 0, 0.006 + 0.003 * fl]))], sub(o, [0, 0, 0.012]), add(o, [0, 0, 0.001]));
      parts[`nostril${side}`] = pinned(skin, 'cranium', Rg.nostril.at, side, local, 'Nostrils'); }
    // fold: a strip whose height is DRIVEN by sneer + cheekBunch
    { const drive = Math.max(0, ctl(x, 'sneer', side)) + 0.7 * Math.max(0, bunch); const m = Rg.fold.strip.length;
      parts[`fold${side}`] = { group: 'Folds', creases: [], ...strip(skin, 'cranium', Rg.fold.strip, side, (j) => { const tp = Math.sin(Math.PI * (j + 0.5) / m); const w = 0.007 * tp, h = (0.002 + 0.009 * drive) * tp; return [[-w, -0.002], [0, h], [w, -0.002], [0, -0.004]]; }) }; }
    parts[`web${side}`] = cheekWeb({ skin, bone, cran: Rg.web.cranium, jaw: Rg.web.jaw, side, retract: ctl(x, 'cornerRetract', side), bunch });
    for (const [k, v] of Object.entries(head.ornaments({ bone, skin, rest: rest.bone, side, x, ctl: (key) => ctl(x, key, side) }))) parts[`${k}${side}`] = v;
    (Rg.wrinkles || []).forEach((D, i) => { parts[`wrinkle${i}${side}`] = drivenStrip(skin, side, D, x); });
    if (Rg.whiskers) for (const [k, v] of Object.entries(whiskers(skin, side, Rg.whiskers))) parts[`${k}${side}`] = v;
    const keep = keepOut(rest.skin, Rg, side);
    (Rg.tiles || []).forEach((T, ti) => Object.assign(parts, tiles(skin, T.part, side, T, `tile${ti}${side}`, { keep, rest: rest.skin })));
  }
  if (Rg.tongue) { const T = Rg.tongue; const base = frameAt(bone, 'jaw', T.at, 'R');
    const rest = Array.from({ length: 10 }, (_, j) => { const f = frameAt(bone, 'jaw', [T.at[0] + (T.to - T.at[0]) * j / 9, T.at[1]], 'R'); return surfaceLocalOffset(base, add(f.origin, mul(f.normal, T.lift))); });
    tongueRegion(T, { out: ctl(x, 'tongueOut', 'R'), curl: ctl(x, 'tongueCurl', 'R'), sway: ctl(x, 'tongueSway', 'R') }, rest, jawFloor(bone, base))
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
/** author skin maps by landmark name, compile them to ADDRESSES with a falloff radius: `st2.brow` →
 * { at: [2, t(browR)] } against the head's ORIGINAL slot list, so refinement never changes their meaning */
const addressMaps = (slots, skinSpec, r) => Object.fromEntries(Object.entries(skinSpec).map(([k, c]) => [k, { ...c, map: c.map.map(([pt, w, dir]) => {
  const [st, sl] = pt.split('.'); const t = slots.indexOf(`${sl}R`) >= 0 ? slots.indexOf(`${sl}R`) : slots.indexOf(sl); if (t < 0) throw new Error(`landmark ${pt}`);
  return { at: [Number(st.slice(2)), t], r, w, dir }; }) }]));
const DRAGON_SLOTS = [...DRAGON.parts.cranium.slots];
const DRAGON_L1 = compile(DRAGON, {}, { details: false, creases: false }).parts;   // the authored (unrefined) head, for migrating face pins
const JAW_HINGE = DRAGON.dials.jawOpen;
const ORBIT = { open: [0.5, 0.42], reach: [0.02, 0.024, 0.024], tuck: 0.004, bulk: [0.004, 0.006], thickness: 0.006 };

const HEADS = {
  dragon: {
    recipe: (() => { const r = clone(DRAGON);
      // the jaw FLOOR as data: two named slot pairs (jowl between gum and jaw side, chin between jaw side
      // and bottom) give the cross-section room to round, then radial volume, fullest mid-jaw, kept at the chin
      refineSlot(r, 'jaw', 'gum', 'jawR', 'jowl', 0.5); refineSlot(r, 'jaw', 'jaw', 'bottom', 'chin', 0.5);
      volumize(r, 'jaw', { 'jowl*': 0.15, 'jaw*': 0.6, 'chin*': 1, bottom: 1.15 }, { st0: 0.45, st1: 0.85, st2: 1, st3: 1, st4: 0.85, st5: 0.6 }, 0.05);   // the floor takes the volume; the gum wall stays low so teeth stay proud
      // density where the face MOVES: halve the face stations, split the temple (brow→side) and cheek (side→lip) bands
      for (const [a, b] of [['st1', 'st2'], ['st2', 'st3'], ['st3', 'st4'], ['st4', 'st5']]) refineStation(r, 'cranium', a, b);
      refineSlot(r, 'cranium', 'brow', 'sideR', 'temple'); refineSlot(r, 'cranium', 'side', 'lipR', 'cheek');
      return r; })(),
    skin: addressMaps(DRAGON_SLOTS, {
      browRaise: { amp: 0.022, map: [['st1.brow', 0.4, [0, 0, 1]], ['st2.brow', 0.9, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
      browFurrow: { amp: 0.022, map: [['st2.brow', 0.5, [0, 0, -1]], ['st3.brow', 1, [-0.35, 0.1, -1]], ['st4.brow', 0.3, [0, 0, -1]]] },
      browArch: { amp: 0.014, map: [['st2.brow', 1, [0, 0, 1]]] },
      sneer: { amp: 0.026, map: [['st3.lip', 0.55, [0.2, 0, 1]], ['st4.lip', 1, [0.25, 0, 1]], ['st4.side', 0.45, [0.4, 0, 1]], ['st4.brow', 0.25, [0, -0.3, 1]]] },
      cheekBunch: { amp: 0.02, map: [['st2.side', 1, [0.6, 0, 0.8]], ['st3.side', 0.7, [0.6, 0, 0.8]], ['st2.lip', 0.4, [0.3, 0, 1]]] },
      cornerRetract: { amp: 0.03, map: [['st1.lip', 0.6, [0.1, -1, 0.3]], ['st2.lip', 1, [0.2, -1, 0.4]]] },
    }, 0.11),
    eye: { mode: 'iris', pupil: 'slit', catchlight: true },
    regions: {
      eye: { at: [2.45, 1.55], R: 0.027 }, orbit: ORBIT,
      brow: { strip: [[1.25, 1.1], [1.8, 1.08], [2.35, 1.1], [2.85, 1.14], [3.3, 1.2]], w: 0.021, h: 0.014, taper: [0.55, 0.9, 1, 0.9, 0.6], facing: 'down' },
      nostril: { at: [4.55, 0.6], r: 0.017, squash: [1.6, 1] },
      fold: { strip: [[4.15, 1.35], [3.6, 1.75], [3.05, 2.2], [2.5, 2.55], [1.95, 2.8]] },
      web: { cranium: [0.35, 1.9, 2.97], jaw: [0.35, 1.9, 0.97] },
      tiles: [
        // shingled hex scales, leaning back so each overlaps the one behind it; they fade out at the patch edge
        { part: 'cranium', s: [1.15, 3.1], t: [2.0, 2.8], grid: [8, 3], brick: true, sides: 6, coverage: 1.25, inset: 0.35, height: 0.007, lean: -0.9, edgeFade: 0.3, thin: 0.6, wobble: 0.2, jitter: 0.3, group: ['Scales', 'ScalesAlt'] },   // cheek
        { part: 'jaw', s: [0.6, 4.4], t: [1.15, 2.35], grid: [13, 2], brick: true, sides: 6, coverage: 1.25, inset: 0.35, height: 0.008, lean: -0.9, edgeFade: 0.2, thin: 0.5, wobble: 0.2, jitter: 0.3, group: ['Scales', 'ScalesAlt'] },   // jaw side
        { part: 'cranium', s: [3.1, 3.9], t: [0.05, 0.95], grid: [3, 2], brick: true, sides: 6, coverage: 1.1, inset: 0.25, height: 0.006, lean: -0.5, edgeFade: 0.25, thin: 0.4, wobble: 0.15, group: ['Plates'] },   // snout plates
      ],
      // driven strips (correctives): nose-bridge ridges with the sneer, a glabella line with the furrow, crow's feet with the cheek
      wrinkles: [
        { strip: [[4.02, 0.12], [4.02, 0.45], [4.02, 0.8]], w: 0.005, h: 0.007, rest: 0.2, drive: { sneer: 1 } },
        { strip: [[4.25, 0.12], [4.25, 0.4], [4.25, 0.7]], w: 0.005, h: 0.007, rest: 0.2, drive: { sneer: 1 } },
        { strip: [[2.75, 0.45], [3.0, 0.42], [3.25, 0.4]], w: 0.004, h: 0.008, rest: 0.1, drive: { browFurrow: 1 } },
        { strip: [[2.02, 1.3], [1.93, 1.24], [1.84, 1.18]], w: 0.003, h: 0.006, rest: 0.1, drive: { cheekBunch: 1 } },
        { strip: [[2.0, 1.55], [1.9, 1.56], [1.8, 1.57]], w: 0.003, h: 0.006, rest: 0.1, drive: { cheekBunch: 1 } },
        { strip: [[2.02, 1.8], [1.93, 1.86], [1.84, 1.92]], w: 0.003, h: 0.006, rest: 0.1, drive: { cheekBunch: 1 } },
      ],
      // barbels: one long whisker from the snout side, sweeping back and out, riding the skin
      whiskers: { roots: [{ at: [4.1, 2.15] }], dir: [-0.8, 0, 0.6], len: 0.26, r: 0.011, droop: 0.15, curl: -0.7, group: 'Barbels' },
      tongue: { at: [0.9, 0.02], to: 4.3, slide: 0.08, width: 0.075, thickness: 0.028, lift: 0, seat: 0.003, groove: 0.35, tip: 'fork', forkDepth: 0.24, forkSpread: 0.32, curlMax: 2.2, swayMax: 0.9, droop: 0.9 },
    },
    ornaments: ({ bone, rest, side, x }) => {
      const at = [1.55, 0.55]; const f = frameAt(rest, 'cranium', at, 'R');
      const spine = [[0.11, -0.22, 0.20], [0.15, -0.30, 0.25], [0.19, -0.39, 0.29], [0.22, -0.48, 0.32], [0.245, -0.56, 0.35], [0.26, -0.63, 0.39], [0.265, -0.68, 0.44], [0.26, -0.71, 0.49]].map((p) => surfaceLocalOffset(f, W(p)));
      const horn = sweep(spine, [0.045, 0.043, 0.036, 0.032, 0.024, 0.019, 0.011].map((v, j) => v * (j % 2 ? 0.92 : 1.06)), 6, { curl: x.hornCurl || 0, curlAxis: cross(sub(spine[2], spine[0]), sub(spine[6], spine[2])) });
      return { horn: pinned(bone, 'cranium', at, side, horn, 'Horns', { creases: horn.rings.filter((_, j) => j % 2 === 0 && j > 0).flatMap((rr) => rr.map((a, i) => [a, rr[(i + 1) % rr.length]])) }),
        ...Object.fromEntries([1, 2, 3, 4, 5].map((j) => [`hornRidge${j}`, pinned(bone, 'cranium', at, side, collar(horn, j, 0.1 - 0.012 * j, 0.28), 'HornRidge')])),
        ...teethRow(bone, 'cranium', 3.05, 4.9, 3.05, 6, (i) => (i === 1 ? 0.07 : 0.042 - i * 0.003), side, [0, 0, -1]),
        ...teethRow(bone, 'jaw', 3.1, 4.85, 0.88, 5, (i) => (i === 1 ? 0.06 : 0.036 - i * 0.002), side, [0, 0, 1]) };
    },
    midline: ({ bone }) => Object.fromEntries(['crest1', 'crest2', 'crest3'].map((c) => { const p = DRAGON.parts[c]; const { at, flip } = pinToAddress(DRAGON_L1.cranium, p.pin); const f = symmetricFrameAt(bone, 'cranium', at);
      const pr = address(bone, 'cranium', at[0], at[1], 'R'); const n = bone.cranium.slots.length; const pin = { ...pr, mirror: { face: mirrorFaceId(pr.face, n), tangentEdge: pr.tangentEdge.map(mirrorPid) } };   // the grammar's symmetric pin
      return [c, { group: 'Crest', creases: [], pin, points: Object.fromEntries(Object.entries(p.offsets).map(([k, o]) => [k, placeSurfaceOffset(f, flip ? [-o[0], -o[1], o[2]] : o)])), faces: Object.values(p.faces) }]; })),
    palette: { Skull: '#6f8a6a', Snout: '#6f8a6a', Lip: '#67805f', Palate: '#8a5b55', Jaw: '#66805f', Body: '#6f8a6a', Brow: '#566f4f', Pad: '#66805f', Lids: '#5d7a57', LidRim: '#34452f', Horns: '#d8cdb4', Teeth: '#efe8d6', Crest: '#b9ad8f', Scales: '#5f7a59', ScalesAlt: '#6c8865', Plates: '#7b9373', Nostrils: '#34422f', Folds: '#5d7757', Wrinkles: '#566f4f', HornRidge: '#c2b594', Barbels: '#a89a74', Mouth: '#5a2f30', Web: '#67805f', Tongue: '#8e3b4a', Sclera: '#e2d6b0', Iris: '#e0a526', Limbus: '#3a2a14', Pupil: '#121212', Catchlight: '#ffffff' },
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
      jawVolume(r, 0.022);
      for (const [a, b] of [['st2', 'st3'], ['st3', 'st4'], ['st4', 'st5'], ['st5', 'st6']]) refineStation(r, 'cranium', a, b);
      refineSlot(r, 'cranium', 'cheek', 'jowlR', 'flank'); refineSlot(r, 'cranium', 'jowl', 'lipR', 'flew');
      return r; })(),
    skin: addressMaps(['top', 'crownR', 'browR', 'cheekR', 'jowlR', 'lipR', 'palate'], {
      browRaise: { amp: 0.02, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
      browFurrow: { amp: 0.02, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
      browArch: { amp: 0.012, map: [['st2.brow', 1, [0, 0, 1]]] },
      sneer: { amp: 0.022, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
      cheekBunch: { amp: 0.018, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
      cornerRetract: { amp: 0.025, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
    }, 0.09),
    eye: { mode: 'iris', pupil: 'round', irisAngle: 44, catchlight: true },
    regions: {
      eye: { at: [2.55, 2.45], R: 0.021 }, orbit: { ...ORBIT, open: [0.55, 0.45], reach: [0.016, 0.02, 0.024], bulk: [0.003, 0.008] },
      brow: { strip: [[1.9, 2.08], [2.2, 2.03], [2.55, 2.03], [2.85, 2.08], [3.15, 2.2]], w: 0.016, h: 0.011, taper: [0.55, 0.9, 1, 0.9, 0.6], facing: 'down' },
      nostril: { at: [5.92, 1.3], r: 0.01, squash: [1.3, 1], slide: 0.4 },
      fold: { strip: [[5.5, 1.8], [5.0, 2.6], [4.4, 3.4], [3.85, 4.1], [3.4, 4.6]] },
      web: { cranium: [1.6, 3.2, 4.97], jaw: [0.4, 2.1, 0.97] },
      tiles: [
        // pointed tufts: triangular footprints, a steep inset, leaning back; the same op as the scales
        { part: 'cranium', s: [0.4, 2.1], t: [3.05, 4.6], grid: [6, 3], brick: true, sides: 3, coverage: 1.2, inset: 0.85, height: 0.026, lean: -1.1, edgeFade: 0.25, thin: 0.5, wobble: 0.3, jitter: 0.35, group: ['Fur', 'FurAlt'] },   // cheek ruff
        { part: 'cranium', s: [0.2, 1.6], t: [0.15, 1.5], grid: [5, 3], brick: true, sides: 3, coverage: 1.2, inset: 0.85, height: 0.018, lean: -1.2, edgeFade: 0.25, thin: 0.5, wobble: 0.3, jitter: 0.35, group: ['Fur', 'FurAlt'] },   // crown tufts
      ],
      wrinkles: [
        { strip: [[4.7, 0.1], [4.7, 0.6], [4.7, 1.2]], w: 0.004, h: 0.006, rest: 0.2, drive: { sneer: 1 } },
        { strip: [[5.0, 0.1], [5.0, 0.55], [5.0, 1.1]], w: 0.004, h: 0.006, rest: 0.2, drive: { sneer: 1 } },
        { strip: [[2.8, 1.1], [3.05, 1.05], [3.3, 1.0]], w: 0.004, h: 0.007, rest: 0.1, drive: { browFurrow: 1 } },
        { strip: [[1.95, 2.2], [1.87, 2.12], [1.79, 2.04]], w: 0.003, h: 0.005, rest: 0.1, drive: { cheekBunch: 1 } },
        { strip: [[1.93, 2.5], [1.85, 2.5], [1.77, 2.5]], w: 0.003, h: 0.005, rest: 0.1, drive: { cheekBunch: 1 } },
        { strip: [[1.95, 2.8], [1.87, 2.88], [1.79, 2.96]], w: 0.003, h: 0.005, rest: 0.1, drive: { cheekBunch: 1 } },
      ],
      // vibrissae: three short fine whiskers on the muzzle side
      whiskers: { roots: [{ at: [5.3, 4.2] }, { at: [5.5, 4.25], dir: [-0.1, 0.25, 1] }, { at: [5.4, 4.55], dir: [-0.3, -0.3, 1] }], dir: [-0.35, 0, 1], len: 0.05, r: 0.0016, droop: 0.3 },
      tongue: { at: [0.6, 0.02], to: 3.2, slide: 0.05, width: 0.09, thickness: 0.03, lift: 0, seat: 0.003, groove: 0.3, tip: 'round', curlMax: 1.8, swayMax: 0.8, droop: 1.3 },
    },
    ornaments: ({ bone, side, ctl }) => {
      // round ear: a thick disc standing on the crown, facing forward; earAttitude tilts it (forward +, pinned back −)
      const a = 0.8 * ctl('earAttitude'); const tilt = (p) => rot(rot(p, [0, 0, 1], -0.6), [0, 1, 0], -a);
      const ear = loftParts([[-0.009, 0.042], [0.0, 0.05], [0.008, 0.044]].map(([x0, r]) => ringAt([x0, 0, 0.036], [1, 0, 0], r, 10).map(tilt)), tilt([-0.014, 0, 0.036]), tilt([0.004, 0, 0.036]));
      const nose = sweep([[0, 0, -0.012], [0, 0, 0.012], [0, 0, 0.022]], [0.034, 0.03], 8, { squash: [1.35, 1] });
      // the inner bowl: a dish on the ear's front face, in the ear's own frame (its axis is local x)
      const bowl = dish({ r: 0.03, rim: 0.004, floor: 0.0015 }, ([a, b, z]) => tilt([0.006 + z, a, 0.036 + b]), ['Ears', 'EarInner']);
      return { ear: { ...pinned(bone, 'cranium', [1.25, 0.9], side, ear, 'Ears'), faceGroups: loftLabels(ear, () => 'Ears', ['Ears', 'Ears']) },
        earBowl: { ...pinned(bone, 'cranium', [1.25, 0.9], side, bowl, 'Ears'), faceGroups: bowl.faceGroups },
        ...(side === 'R' ? { nose: pinned(bone, 'cranium', [5.75, 0.0001], 'R', nose, 'NosePad') } : {}),
        ...teethRow(bone, 'cranium', 5.1, 5.5, 5.2, 2, (i) => (i === 0 ? 0.03 : 0.012), side, [0, 0, -1]),
        ...teethRow(bone, 'jaw', 3.3, 3.7, 0.88, 2, (i) => (i === 0 ? 0.026 : 0.01), side, [0, 0, 1]) };
    },
    palette: { Skull: '#7a5a3c', Snout: '#b08e68', Jowl: '#9a7853', Palate: '#7d4a44', Jaw: '#9a7853', Body: '#7a5a3c', Brow: '#65482e', Pad: '#86664a', Lids: '#6f5235', LidRim: '#2e2016', Ears: '#6c4f34', EarInner: '#a07c5a', Fur: '#6a4c32', FurAlt: '#7d5b3d', NosePad: '#211813', Teeth: '#efe8d6', Nostrils: '#0e0a08', Folds: '#9a7853', Wrinkles: '#8c6a47', Whiskers: '#efe6d4', Mouth: '#4a2a28', Web: '#8d6b4a', Tongue: '#c0626a', Sclera: '#efe9dc', Iris: '#5a3a1a', Limbus: '#1e140a', Pupil: '#0e0e0e', Catchlight: '#ffffff' },
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


// ════════════════════════════ BAKE: the detailed head as a layered-recipe fragment ════════════════════════════
/** bakeLayered(head, expression) → { parts, dials, creases, palette }: the refined cranium and jaw as L1 (the
 * expression's skin, so a cast can carry a face; the jaw hinge stays the recipe's live `jawOpen` dial), every
 * region, ornament and tile as an L2 part pinned where it was placed, with its geometry as local offsets in
 * that pin's frame. Head dials whose blends name stations are extended to the refined stations by `u`;
 * the detail-stretch dials (horns, teeth, crest) are dropped: the detail is baked. */
function bakeLayered(head, x = {}) {
  const { skin, parts } = build(head, { ...x, jawOpen: 0 });
  const out = { parts: {}, dials: {}, creases: {}, palette: { ...head.palette } };
  for (const name of ['cranium', 'jaw']) { const P = clone(head.recipe.parts[name]); const S = skin[name];
    for (const st of P.stations) for (const slot of P.slots) st.points[slot] = [...S.points[`${name}/${st.id}.${slot}`]];
    delete P.faces; delete P.points; delete P.groups; out.parts[name] = { ...P, layer: 1, closure: 'closed' }; }
  for (const [name, part] of Object.entries(parts)) {
    if (!part.pin) throw new Error(`bakeLayered: ${name} was placed without a pin`);
    const f = pinFrame(skin[part.pin.parent], part.pin);
    const offsets = Object.fromEntries(Object.entries(part.points).map(([k, p]) => [k, surfaceLocalOffset(f, p)]));
    const faces = {}, groups = {}; part.faces.forEach((t, i) => { const id = `f${String(i).padStart(3, '0')}`; faces[id] = t; groups[id] = part.faceGroups ? part.faceGroups[i] : part.group; });
    out.parts[name] = { layer: 2, closure: 'closed', group: part.group, pin: part.pin, offsets, faces, groups };
  }
  // creases were authored between coarse stations; after refinement they run along the refined chain
  for (const [id, c] of Object.entries(head.recipe.creases || {})) { const P = out.parts[c.parent]; const [a, b] = c.edge.map((e) => e.match(/\/([^.]+)\.([^.]+)$/)); const ids = P.stations.map((st) => st.id);
    const ia = ids.indexOf(a[1]), ib = ids.indexOf(b[1]); if (ia < 0 || ib < 0 || a[2] !== b[2]) throw new Error(`bakeLayered: crease ${id} is not a station edge`);
    for (let i = Math.min(ia, ib); i < Math.max(ia, ib); i++) out.creases[`${id}.${i}`] = { ...c, edge: [`${c.parent}/${ids[i]}.${a[2]}`, `${c.parent}/${ids[i + 1]}.${a[2]}`] }; }
  for (const [k, d] of Object.entries(head.recipe.dials)) {
    if (d.op === 'stretch') continue;
    const dial = clone(d);
    if (dial.blend) for (const pn of dial.parts || []) { const P = out.parts[pn]; if (!P) continue;
      for (const st of P.stations) { if (dial.blend[st.id] !== undefined || st.u === undefined || Number.isInteger(st.u)) continue;
        const lo = `st${Math.floor(st.u)}`, hi = `st${Math.ceil(st.u)}`, t = st.u - Math.floor(st.u); dial.blend[st.id] = (dial.blend[lo] ?? 0) * (1 - t) + (dial.blend[hi] ?? 0) * t; } }
    out.dials[k] = dial;
  }
  return out;
}

export { HEADS, EXPRESSIONS, build, toSource, carriers, frameAt, compile, refineStation, refineSlot, loadRecipe, clone, jawFloor, bakeLayered, address, keepOut };
export const vec = { sub, add, mul, dot, cross, unit, mean };
