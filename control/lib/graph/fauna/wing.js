// The WING op, species-free: one forelimb chain (arm bones) with a fan of RAYS at its end, surfaced either as ONE
// membrane between the rays (bat / dragon pattern) or as separate shingled VANES, one per ray (feather pattern:
// tertials, secondaries, primaries with emarginated slots, coverts in rows). One FOLD dial (0 spread … 1 folded)
// interpolates the bone angles, the ray angles and the wing plane's roll against the body. Pure, deterministic.
// Lifted from docs/examples/wings/. Data shape (W): { girdle, boneGroup, surface: 'membrane' | 'vanes',
//   arm: [{ id, len, spread, folded, r: [r0, r1] }], rays: [{ bone, at, angle, foldAngle?, len, offset?, … }],
//   membrane?: { order, sag, sub, along, thickness, root?, bone?, groups, veins? },
//   frame: { spread: { S, C }, folded: { S, C } } }   (S = span axis, C = chord axis, in the body frame)
import { sweep, loftParts, loftLabels, vec } from '../polygonizer/station-loft-detail.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered, pinFrame } from '../polygonizer/station-loft.js';
import { surfaceLocalOffset } from '../polygonizer/surface-pin.js';

const { sub, add, mul, dot, cross, unit, mean } = vec;
const lerp = (a, b, t) => a + (b - a) * t; const rad = (d) => d * Math.PI / 180;
const r2 = (a) => [Math.cos(a), Math.sin(a)];

/** the arm in the wing plane at fold f: joints P0 (root) … Pn, bone angles from the span axis (x), degrees */
export function armAt(W, f) { const pts = [[0, 0]]; let a = 0; const dirs = [];
  W.arm.forEach((b) => { a += lerp(b.spread, b.folded, f); const d = r2(rad(a)); dirs.push(d); const p = pts[pts.length - 1]; pts.push([p[0] + d[0] * b.len, p[1] + d[1] * b.len]); });
  return { pts, dirs, ang: (i) => Math.atan2(dirs[i][1], dirs[i][0]) }; }
/** rays in the wing plane: anchor on bone b at fraction `at`, angle from the bone toward the trailing edge (−y side) */
export function raysAt(W, arm, f) { return W.rays.map((r, i) => { const A = arm.pts[r.bone], B = arm.pts[r.bone + 1]; const anchor = [lerp(A[0], B[0], r.at), lerp(A[1], B[1], r.at)];
  const a = arm.ang(r.bone) - rad(lerp(r.angle, r.foldAngle ?? r.angle, f)); const d = r2(a); const o = r.offset ?? 0; return { ...r, i, anchor: [anchor[0] + d[0] * o, anchor[1] + d[1] * o], d, a }; }); }
/** the wing plane in the world: root frame spread → folded (orthonormalised); z is the plane's normal */
export function planeAt(W, root, f) { const S = unit(W.frame.spread.S.map((v, i) => lerp(v, W.frame.folded.S[i], f))); let C = W.frame.spread.C.map((v, i) => lerp(v, W.frame.folded.C[i], f));
  C = unit(sub(C, mul(S, dot(C, S)))); const N = cross(S, C); return ([x, y, z = 0]) => add(root, add(add(mul(S, x), mul(C, y)), mul(N, z))); }
/** MEMBRANE: one closed sheet whose stations are sub-rays between consecutive rays; between two rays the
 * length sags by `sag · sin(πu)` (the authored waveform). Anchors interpolate ALONG THE ARM when the rays
 * anchor on different bones, so the inner membrane is attached to the arm, not cut across it. Weights: each
 * sub-ray is (1 − u) ray a + u ray b. */
export function membrane(W, arm, rays, place) { const M = W.membrane; const K = M.sub, th = M.thickness; const chainLen = (b, at) => W.arm.slice(0, b).reduce((s, x) => s + x.len, 0) + W.arm[b].len * at;
  const armPoint = (s) => { let acc = 0; for (let b = 0; b < W.arm.length; b++) { const L = W.arm[b].len; if (s <= acc + L || b === W.arm.length - 1) { const t = (s - acc) / L, A = arm.pts[b], B = arm.pts[b + 1]; return [lerp(A[0], B[0], t), lerp(A[1], B[1], t)]; } acc += L; } };
  const order = M.order.map((k) => rays[k]); const subs = []; const weights = [];
  for (let g = 0; g + 1 < order.length; g++) { const a = order[g], b = order[g + 1]; const sag = M.sag[g];
    for (let k = 0; k < K + (g === order.length - 2 ? 1 : 0); k++) { const u = k / K; const sa = chainLen(a.bone, a.at), sb = chainLen(b.bone, b.at);
      const anc = sa === sb ? a.anchor : (() => { const p = armPoint(lerp(sa, sb, u)); const d = r2(lerp(a.a, b.a, u)); return [p[0] + d[0] * (a.offset ?? 0), p[1] + d[1] * (a.offset ?? 0)]; })();
      let da = a.a, db = b.a; if (db - da > Math.PI) db -= 2 * Math.PI; if (da - db > Math.PI) db += 2 * Math.PI; const d = r2(lerp(da, db, u));
      const L = lerp(a.len, b.len, u) * (1 - sag * Math.sin(Math.PI * u)); subs.push({ anc, d, L }); weights.push({ [a.boneId]: 1 - u, [b.boneId]: u }); } }
  // THICKNESS: a layer, not a sheet: thick at the root (× root), cushioned along each bone ray (+ bone, falling
  // off across the gap), thinning to `thickness` at the trailing edge. Its two faces are separate groups.
  const F = M.along; const nearRay = []; order.forEach((_, g) => { if (g + 1 < order.length) for (let k = 0; k < K + (g === order.length - 2 ? 1 : 0); k++) nearRay.push((1 - 2 * Math.min(k / K, 1 - k / K)) ** 3); });
  const thAt = (j, s) => th * (1 + ((M.root ?? 2.5) - 1) * (1 - s) ** 2) + (M.bone ?? 0) * nearRay[j] * (1 - 0.6 * s);
  const rings = subs.map(({ anc, d, L }, j) => { const top = F.map((s) => [anc[0] + d[0] * L * s, anc[1] + d[1] * L * s, thAt(j, s) / 2]); return [...top, ...[...top].reverse().map(([x, y, z]) => [x, y, -z])].map(place); });
  const cap = (j, k) => add(mean(rings[j]), mul(unit(sub(mean(rings[j]), mean(rings[k]))), 0.004));
  const raw = loftParts(rings, cap(0, 1), cap(rings.length - 1, rings.length - 2)); const G = M.groups; const n = F.length;
  const mesh = { ...raw, group: G.top, faceGroups: loftLabels(raw, (j, k) => (k < n - 1 ? G.top : k === n - 1 ? G.rim : k < 2 * n - 1 ? G.under : G.rim), [G.rim, G.rim]) };
  // VEINS: on the underside only, along every `veins.every`-th sub-ray between the bone rays, from near the root toward the edge
  const veins = []; if (M.veins) subs.forEach(({ anc, d, L }, j) => { const u = j % K; if (!u || u % M.veins.every) return; const pts = [0.08, 0.3, 0.55, M.veins.to].map((s) => place([anc[0] + d[0] * L * s, anc[1] + d[1] * L * s, -thAt(j, s) / 2 - M.veins.r * 0.4]));
    veins.push({ ...tube(pts, M.veins.r, M.veins.r * 0.35, 5), group: G.vein }); });
  return { mesh, veins, weights, edge: subs.map(({ anc, d, L }) => [anc[0] + d[0] * L, anc[1] + d[1] * L]) }; }
/** VANES: one thin flat loft per ray (a feather), layered by `layer` along the plane normal; its width
 * narrows past `emarg.from` (emargination), so the outer primaries separate into slots. */
export function vane(r, place, { th = 0.003, stations = [0, 0.18, 0.4, 0.62, 0.82, 0.95] } = {}) {
  const p = [-r.d[1], r.d[0]]; const w = (s) => r.width * (s < 0.12 ? 0.45 + 4.6 * s : 1) * (r.emarg && s > r.emarg.from ? 1 - r.emarg.by * (s - r.emarg.from) / (1 - r.emarg.from) : 1) * (s > 0.85 ? 1 - 1.8 * (s - 0.85) : 1);
  const z = r.layer ?? 0; const rings = stations.map((s) => { const c = [r.anchor[0] + r.d[0] * r.len * s, r.anchor[1] + r.d[1] * r.len * s]; const h = w(s) / 2, bow = (r.bow ?? 0.01) * Math.sin(Math.PI * s);
    return [[c[0] - p[0] * h, c[1] - p[1] * h, z + bow + th / 2], [c[0] + p[0] * h, c[1] + p[1] * h, z + bow + th / 2], [c[0] + p[0] * h, c[1] + p[1] * h, z + bow - th / 2], [c[0] - p[0] * h, c[1] - p[1] * h, z + bow - th / 2]].map(place); });
  const tip = place([r.anchor[0] + r.d[0] * r.len, r.anchor[1] + r.d[1] * r.len, z]); const back = place([r.anchor[0] - r.d[0] * 0.01, r.anchor[1] - r.d[1] * 0.01, z]);
  // two-sided: ring k 0 is the upper face, 2 the under face, 1 and 3 the edges; a pale tip band from `tipFrom` on the upper face
  const mesh = loftParts(rings, back, tip); const top = r.tone || r.group, under = r.under || top, tipG = r.tipGroup;
  return { ...mesh, faceGroups: loftLabels(mesh, (j, k) => (k === 2 ? under : tipG && k === 0 && stations[j] >= r.tipFrom ? tipG : top), [top, tipG || top]) }; }
/** a tube along 3D points (bones, digits): a sweep with radii tapering */
const tube = (pts, r0, r1, m = 6) => sweep([...pts, add(pts[pts.length - 1], mul(unit(sub(pts[pts.length - 1], pts[pts.length - 2])), r1))], pts.map((_, i) => lerp(r0, r1, i / Math.max(1, pts.length - 1))), m);
/** build one wing: parts, bone table, bindings, and the planform (2D) for the waveform */
export function buildWing(W, root, f, side = 'R') {
  const arm = armAt(W, f); const rays = raysAt(W, arm, f).map((r) => ({ ...r, boneId: r.digit ? `digit${r.digit}` : W.arm[r.bone].id }));
  const mir = side === 'L' ? (p) => [-p[0], p[1], p[2]] : (p) => p; const planeR = planeAt(W, side === 'L' ? [-root[0], root[1], root[2]] : root, f);
  const place = side === 'L' ? (q) => mir(planeAt(W, root, f)(q)) : planeR; const parts = {}; const flip = (m) => (side === 'L' ? { ...m, faces: m.faces.map((t) => [...t].reverse()) } : m);
  const bones = W.arm.map((b, i) => ({ id: b.id, parent: i ? W.arm[i - 1].id : W.girdle, head: place([...arm.pts[i], 0]), tail: place([...arm.pts[i + 1], 0]) }));
  W.arm.forEach((b, i) => { parts[`${b.id}`] = { ...flip(tube([place([...arm.pts[i], 0]), place([...arm.pts[i + 1], 0])], b.r[0], b.r[1])), group: W.boneGroup }; });
  const bind = {};
  for (const r of rays) {
    if (r.digit) { const segs = r.phalanges ?? 3; const pts = Array.from({ length: segs + 1 }, (_, k) => place([r.anchor[0] + r.d[0] * r.len * k / segs, r.anchor[1] + r.d[1] * r.len * k / segs, 0]));
      parts[`digit${r.digit}`] = { ...flip(tube(pts, r.r[0], r.r[1])), group: W.boneGroup }; bones.push({ id: `digit${r.digit}`, parent: W.arm[r.bone].id, head: pts[0], tail: pts[segs] });
      if (r.claw) { const tip = pts[segs]; const d3 = unit(sub(pts[segs], pts[segs - 1])); parts[`claw${r.digit}`] = { ...flip(tube([tip, add(tip, mul(d3, r.claw * 0.5)), add(add(tip, mul(d3, r.claw)), mul(unit(cross(d3, [0, 0, 1])), 0))], r.r[1] * 1.4, 0.002, 5)), group: 'Claw' }; } }
    if (W.surface === 'vanes' && !r.digit) { const id = `${r.kind}${r.i}`; const v = vane(r, place); parts[id] = { ...flip(v), group: r.group, faceGroups: v.faceGroups }; bind[id] = { [r.boneId]: 1 }; }
  }
  let edge = null;
  if (W.surface === 'membrane') { const m = membrane(W, arm, rays, place); parts.membrane = { ...flip(m.mesh), faceGroups: m.mesh.faceGroups }; m.veins.forEach((v, i) => { parts[`vein${i}`] = { ...flip(v), group: v.group }; }); bind.membrane = m.weights; edge = m.edge; }
  return { parts, bones, bind, arm, rays, edge }; }

export { tube };

/** WINGS worn natively on a ring plan (the way build.js wears a head mesh): each side's wing (built at fold `fold`,
 * authored at the family's size and grown by `scale`) is ONE layer-2 part pinned to a small hidden core segment at
 * the root joint `at` (an x > 0 joint, mirrored by name), every vertex an offset in that pin's frame. Adds the
 * segment `wingCoreR` (+ its mirror), the include `wings` and the wing palette; returns the plan. */
export function wearWings(plan, { wing, at = 'wingRoot', fold = 1, scale = 1, core = 0.04, palette = {} }) {
  const J = plan.joints[at]; if (!J) throw new Error(`wings: no joint '${at}'`);
  const k = scale, r = core * k, tipJ = `${at}Tip`;
  plan.joints[tipJ] = [J[0], J[1] + 2 * r, J[2]];
  const seg = { name: 'wingCoreR', kind: 'segment', from: at, to: tipJ, rA: r, rB: r, slots: 'ring8', group: 'Coat', mirror: 'name' };
  plan.segments.push(seg);
  const mini = { schema: plan.schema, frame: plan.frame, joints: { [at]: J, [tipJ]: plan.joints[tipJ] }, segments: [seg], dials: {} };
  const built = compileLayered(expandPlan(mini), {}, { details: false, creases: false }).parts;
  const r6 = (x) => Math.round(x * 1e6) / 1e6; const parts = {};
  for (const side of ['R', 'L']) {
    const host = built[`wingCore${side}`]; const [faceId, face] = Object.entries(host.faces).sort(([a], [b]) => (a < b ? -1 : 1))[0];
    const pin = { parent: `wingCore${side}`, face: faceId, weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: [face[0], face[1]], handedness: 1 };
    const frame = pinFrame(host, pin); const root = side === 'L' ? [-J[0], J[1], J[2]] : J;
    const w = buildWing(wing, [0, 0, 0], fold, side); const offsets = {}, faces = {}, groups = {}; let nv = 0, nf = 0;
    for (const name of Object.keys(w.parts).sort()) { const d = w.parts[name]; const idx = {};
      for (const [pk, p] of Object.entries(d.points)) { const id = `v${String(nv++).padStart(5, '0')}`; idx[pk] = id; offsets[id] = surfaceLocalOffset(frame, p.map((x, i) => root[i] + x * k)).map(r6); }
      d.faces.forEach((f, i) => { const id = `f${String(nf++).padStart(5, '0')}`; faces[id] = f.map((q) => idx[q]); groups[id] = d.faceGroups ? d.faceGroups[i] : d.group; }); }
    parts[`wing${side}`] = { layer: 2, pin, offsets, faces, groups };
  }
  plan.include = [...(plan.include || []), { name: 'wings', parts, shift: [0, 0, 0] }];
  plan.palette = { ...(plan.palette || {}), ...palette };
  return plan;
}
