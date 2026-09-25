/** wings/wings.mjs — one wing op (arm chain + rays + membrane | vanes), dragon and vulture data, a vulture ring
 * plan, renders spread / folded, and the trailing edge as a waveform, through the core detail operators and the
 * ring plan. `node wings.mjs` writes wings.png, waveform.svg, planform.svg and stats.json to the spike tree. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const CORE = new URL('../../../control/lib/graph/polygonizer/', import.meta.url).href;
const { compileLayered } = await import(`${CORE}station-loft.js`);
const { expandPlan, PLAN_SCHEMA } = await import(`${CORE}station-loft-plan.js`);
const D = await import(`${CORE}station-loft-detail.js`);
const { orbitCamera, projectVertices } = await import(new URL('../../../control/lib/graph/scene/wire-svg.js', import.meta.url).href);
const { frameAt, sweep, loftParts, loftLabels, ringAt, tiles, vec } = D;
const { sub, add, mul, dot, cross, unit, mean } = vec;
const OUT = () => { const o = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0924/spike-output/wings/', import.meta.url))); mkdirSync(o, { recursive: true }); return o; };
const lerp = (a, b, t) => a + (b - a) * t; const rad = (d) => d * Math.PI / 180;
const r2 = (a) => [Math.cos(a), Math.sin(a)];

// ═══════════ CORE: the wing op (species-free) ═══════════
/** the arm in the wing plane at fold f: joints P0 (root) … Pn, bone angles from the span axis (x), degrees */
function armAt(W, f) { const pts = [[0, 0]]; let a = 0; const dirs = [];
  W.arm.forEach((b) => { a += lerp(b.spread, b.folded, f); const d = r2(rad(a)); dirs.push(d); const p = pts[pts.length - 1]; pts.push([p[0] + d[0] * b.len, p[1] + d[1] * b.len]); });
  return { pts, dirs, ang: (i) => Math.atan2(dirs[i][1], dirs[i][0]) }; }
/** rays in the wing plane: anchor on bone b at fraction `at`, angle from the bone toward the trailing edge (−y side) */
function raysAt(W, arm, f) { return W.rays.map((r, i) => { const A = arm.pts[r.bone], B = arm.pts[r.bone + 1]; const anchor = [lerp(A[0], B[0], r.at), lerp(A[1], B[1], r.at)];
  const a = arm.ang(r.bone) - rad(lerp(r.angle, r.foldAngle ?? r.angle, f)); const d = r2(a); const o = r.offset ?? 0; return { ...r, i, anchor: [anchor[0] + d[0] * o, anchor[1] + d[1] * o], d, a }; }); }
/** the wing plane in the world: root frame spread → folded (orthonormalised); z is the plane's normal */
function planeAt(W, root, f) { const S = unit(W.frame.spread.S.map((v, i) => lerp(v, W.frame.folded.S[i], f))); let C = W.frame.spread.C.map((v, i) => lerp(v, W.frame.folded.C[i], f));
  C = unit(sub(C, mul(S, dot(C, S)))); const N = cross(S, C); return ([x, y, z = 0]) => add(root, add(add(mul(S, x), mul(C, y)), mul(N, z))); }
/** MEMBRANE: one closed sheet whose stations are sub-rays between consecutive rays; between two rays the
 * length sags by `sag · sin(πu)` (the authored waveform). Anchors interpolate ALONG THE ARM when the rays
 * anchor on different bones, so the inner membrane is attached to the arm, not cut across it. Weights: each
 * sub-ray is (1 − u) ray a + u ray b. */
function membrane(W, arm, rays, place) { const M = W.membrane; const K = M.sub, th = M.thickness; const chainLen = (b, at) => W.arm.slice(0, b).reduce((s, x) => s + x.len, 0) + W.arm[b].len * at;
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
function vane(r, place, { th = 0.003, stations = [0, 0.18, 0.4, 0.62, 0.82, 0.95] } = {}) {
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
function buildWing(W, root, f, side = 'R') {
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

// ═══════════ WING DATA ═══════════
/** dragon: a bat pattern, scaled to a 2.3 m biped. Rays: the body ray (membrane inner edge), digits V–II, thumb */
const DRAGON_WING = { girdle: 'wingGirdle', boneGroup: 'WingBone', surface: 'membrane',
  arm: [{ id: 'wingHumerus', len: 0.55, spread: 20, folded: -70, r: [0.075, 0.055] }, { id: 'wingForearm', len: 0.85, spread: -30, folded: 160, r: [0.05, 0.035] }],
  rays: [
    { name: 'body', bone: 0, at: 0, angle: 105, foldAngle: 15, len: 1.05 },
    { digit: 'V', bone: 1, at: 1, angle: 78, foldAngle: 172, len: 1.25, r: [0.028, 0.012], offset: 0.03 },
    { digit: 'IV', bone: 1, at: 1, angle: 52, foldAngle: 174, len: 1.55, r: [0.03, 0.012], offset: 0.03 },
    { digit: 'III', bone: 1, at: 1, angle: 28, foldAngle: 176, len: 1.7, r: [0.032, 0.012], offset: 0.03 },
    { digit: 'II', bone: 1, at: 1, angle: 8, foldAngle: 178, len: 1.5, r: [0.032, 0.014], offset: 0.03, claw: 0.07 },
    { digit: 'I', bone: 1, at: 1, angle: -35, foldAngle: -20, len: 0.16, r: [0.03, 0.02], phalanges: 2, claw: 0.09 },
  ],
  membrane: { order: [0, 1, 2, 3, 4], sag: [0.16, 0.22, 0.2, 0.18], sub: 10, along: [0, 0.12, 0.28, 0.46, 0.66, 0.84, 1], thickness: 0.007, root: 3, bone: 0.03,
    groups: { top: 'MembraneBack', under: 'MembraneUnder', rim: 'MembraneRim', vein: 'Vein' }, veins: { every: 3, r: 0.009, to: 0.8 } },
  frame: { spread: { S: [1, -0.35, 0.5], C: [0, 0.05, 1] }, folded: { S: [0.25, -1, -0.1], C: [0.05, 0, 1] } } };
/** vulture: a bird pattern for a ~2.5 m span. Tertials (humerus), secondaries (ulna), primaries (hand), coverts */
function vultureWing() { const rays = []; const add1 = (o) => rays.push(o);
  for (let k = 0; k < 3; k++) add1({ kind: 'tertial', bone: 0, at: 0.55 + 0.2 * k, angle: 100, foldAngle: 5, len: 0.3 + 0.03 * k, width: 0.1, layer: 0.012 - 0.002 * k, group: 'Flight' });
  for (let k = 0; k < 16; k++) add1({ kind: 'secondary', bone: 1, at: 0.03 + 0.97 * k / 15, angle: 98 - 3 * (k / 15), foldAngle: 176, len: 0.44 + 0.03 * Math.sin(Math.PI * k / 15), width: 0.085, layer: 0.004 * (15 - k) / 15, group: 'Flight' });
  for (let k = 0; k < 10; k++) { const t = k / 9; add1({ kind: 'primary', bone: 2, at: 0.1 + 0.9 * t, angle: lerp(95, 8, t ** 0.9), foldAngle: 4, len: 0.5 + 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.15)), width: lerp(0.085, 0.07, t), layer: 0.006 + 0.004 * t,
    emarg: t > 0.35 ? { from: 0.45, by: 0.55 } : null, group: 'Flight' }); }
  // coverts: shorter rows over the flight feather bases (greater, then lesser), on top
  const flight = rays.filter((r) => r.kind !== 'tertial'); for (const [row, frac, z] of [['greater', 0.42, 0.022], ['lesser', 0.22, 0.034]]) flight.forEach((r) => add1({ ...r, kind: `${row}Covert`, len: r.len * frac, width: r.width * 1.05, emarg: null, layer: z + (r.layer ?? 0), group: row === 'greater' ? 'Covert' : 'CovertLesser' }));
  const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const TONES = { Flight: { tones: ['FlightA', 'FlightB', 'FlightC'], under: 'FlightUnder' }, Covert: { tones: ['CovertA', 'CovertB', 'CovertC'], under: 'CovertUnder', tipGroup: 'CovertTip', tipFrom: 0.62 },
    CovertLesser: { tones: ['LesserA', 'LesserB', 'LesserC'], under: 'CovertUnder', tipGroup: 'LesserTip', tipFrom: 0.8 } };
  rays.forEach((r, i) => { const T = TONES[r.group]; const k = (i + (hash(`${r.kind}${i}`) % 5 === 0 ? 1 : 0)) % 2 + (hash(`t${r.kind}${i}`) % 7 === 0 ? 1 : 0); Object.assign(r, { tone: T.tones[k], under: T.under, ...(T.tipGroup ? { tipGroup: T.tipGroup, tipFrom: T.tipFrom } : {}) }); });
  return { girdle: 'body', boneGroup: 'WingBone', surface: 'vanes',
    arm: [{ id: 'humerus', len: 0.2, spread: 8, folded: -80, r: [0.035, 0.03] }, { id: 'ulna', len: 0.29, spread: -6, folded: 168, r: [0.03, 0.025] }, { id: 'hand', len: 0.2, spread: -6, folded: -165, r: [0.025, 0.015] }],
    rays, frame: { spread: { S: [1, 0, 0.14], C: [0, 1, 0] }, folded: { S: [0.2, 0, -1], C: [0, 1, 0] } } }; }
const VULTURE_WING = vultureWing();

// ═══════════ the VULTURE as a ring plan (data only) ═══════════
const BROWN = '#7d5f40', PALE = '#d8c8ad', GREY = '#9b958a';
const VULTURE_PLAN = { schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y', note: 'a griffon vulture standing, 1 unit = 1 m' },
  joints: { rump: [0, -0.36, 0.6], chest: [0, 0.24, 0.86], n0: [0, 0.2, 0.9], n1: [0, 0.3, 1.0], n2: [0, 0.3, 1.1], n3: [0, 0.39, 1.19], headA: [0, 0.37, 1.2], headB: [0, 0.52, 1.19],
    hip: [0.1, -0.05, 0.6], knee: [0.11, 0.04, 0.38], ankle: [0.11, 0.08, 0.1], toeF: [0.12, 0.23, 0.02], toeI: [0.05, 0.2, 0.02], toeO: [0.19, 0.17, 0.02], toeB: [0.1, -0.06, 0.02] },
  segments: [
    { name: 'body', kind: 'segment', from: 'rump', to: 'chest', rA: [0.1, 0.09], rB: [0.12, 0.13], rMid: [0.2, 0.18], mid: 0.45, e: 2.2, slots: 'ring8', over: [0.3, 0.25], group: 'Body', tint: BROWN, mirror: 'plane' },
    { name: 'neck', kind: 'chain', joints: ['n0', 'n1', 'n2', 'n3'], r: [0.075, 0.045, 0.04, 0.045], group: 'Neck', tint: PALE, mirror: 'plane' },
    { name: 'head', kind: 'segment', from: 'headA', to: 'headB', rA: 0.058, rB: 0.034, group: 'Head', tint: PALE, mirror: 'plane' },
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.075, rB: 0.05, group: 'Legs', tint: BROWN, mirror: 'name' },
    { name: 'tarsusR', kind: 'segment', from: 'knee', to: 'ankle', rA: 0.032, rB: 0.028, group: 'Legs', tint: GREY, mirror: 'name' },
    ...[['toeFR', 'toeF'], ['toeIR', 'toeI'], ['toeOR', 'toeO'], ['toeBR', 'toeB']].map(([n, j]) => ({ name: n, kind: 'segment', from: 'ankle', to: j, rA: 0.024, rB: 0.016, group: 'Toes', tint: GREY, mirror: 'name' })),
  ], dials: {} };

// ═══════════ creatures: body + details + wings ═══════════
const hexT = (p, h) => p;
function vulture(f) { const recipe = expandPlan(VULTURE_PLAN); const mesh = compileLayered(recipe, {}); const L1 = mesh.parts; const parts = {};
  // bald head's hooked beak, eyes, the neck ruff (the same tile op as the bear's fur), talons, a tail fan (vanes again)
  parts.beak = { ...sweep([[0, 0.5, 1.195], [0, 0.55, 1.19], [0, 0.585, 1.175], [0, 0.6, 1.15], [0, 0.595, 1.13]], [0.028, 0.022, 0.016, 0.01], 8, { squash: [0.7, 1] }), group: 'Beak' };
  for (const s of [1, -1]) parts[`eye${s > 0 ? 'R' : 'L'}`] = { ...loftParts([0.35, 0.8, 1, 0.8, 0.35].map((k, i) => ringAt([s * (0.035 + 0.012 * Math.sin(Math.PI * i / 4)), 0.44, 1.215], [s, 0, 0], 0.012 * k, 8)), [s * 0.03, 0.44, 1.215], [s * 0.05, 0.44, 1.215]), group: 'Eye' };
  for (const side of ['R', 'L']) Object.assign(parts, tiles(L1, 'neck0', side, { part: 'neck0', s: [0.1, 1.6], t: [0, 3], grid: [4, 5], brick: true, sides: 3, coverage: 1.3, inset: 0.85, height: 0.05, lean: -1.2, edgeFade: 0.2, wobble: 0.3, jitter: 0.3, group: ['Ruff', 'RuffAlt'] }, `ruff${side}`));
  for (const S of ['R', 'L']) for (const t of ['toeF', 'toeI', 'toeO', 'toeB']) { const P = L1[`${t}${S}`]; const tip = P.caps?.tip ?? mean(P.slots.map((sl) => P.points[`${t}${S}/st2.${sl}`]));
    const tipP = Object.entries(P.points).filter(([k]) => k.endsWith('tip')).map(([, v]) => v)[0] ?? tip; const d = unit(sub(tipP, mean(P.slots.map((sl) => P.points[`${t}${S}/st0.${sl}`]))));
    parts[`talon${t}${S}`] = { ...sweep([tipP, add(tipP, mul(d, 0.02)), add(add(tipP, mul(d, 0.035)), [0, 0, -0.012]), add(add(tipP, mul(d, 0.04)), [0, 0, -0.03])], [0.012, 0.009, 0.005], 6), group: 'Talon' }; }
  const TAIL = { rays: Array.from({ length: 12 }, (_, k) => ({ kind: 'rectrix', bone: 0, at: 0, angle: 0, len: 0.3 - 0.02 * Math.abs(k - 5.5) / 5.5, width: 0.07, layer: 0.003 * (6 - Math.abs(k - 5.5)), group: 'Flight', fan: lerp(-40, 40, k / 11) })) };
  const tailPlace = (q) => add([0, -0.38, 0.6], add(add(mul([1, 0, 0], q[0]), mul(unit([0, -1, -0.35]), q[1])), mul(unit(cross([1, 0, 0], unit([0, -1, -0.35]))), q[2])));
  TAIL.rays.forEach((r, k) => { const d = r2(rad(90 + r.fan)); const v = vane({ ...r, tone: k % 2 ? 'FlightA' : 'FlightB', under: 'FlightUnder', anchor: [d[0] * 0.03, d[1] * 0.03], d }, tailPlace); parts[`rectrix${k}`] = { ...v, group: 'Flight' }; });
  // wings: the forelimb, rooted at the shoulder on the body's side
  const root = [0.11, 0.14, 0.9]; const wings = {}; for (const side of ['R', 'L']) { const w = buildWing(VULTURE_WING, root, f, side); wings[side] = w; for (const [k, v] of Object.entries(w.parts)) parts[`${k}${side}`] = v; }
  return { mesh, parts, wings, palette: { Ruff: '#ece2cf', RuffAlt: '#dccfb6', Beak: '#cbbf9f', Eye: '#1c1410', Talon: '#2b2521', WingBone: BROWN,
    FlightA: '#33271f', FlightB: '#43342a', FlightC: '#54433a', FlightUnder: '#8d8680',
    CovertA: '#9a7a52', CovertB: '#a98a60', CovertC: '#8b6c47', CovertTip: '#efe6d2', CovertUnder: '#e6dccb',
    LesserA: '#b0916a', LesserB: '#bd9f77', LesserC: '#a3855d', LesserTip: '#e3d5bc' } }; }
function dragon(f) { const recipe = JSON.parse(readFileSync(new URL('../dragon-body/recipe.json', import.meta.url), 'utf8')); const mesh = compileLayered(recipe, {}); const L1 = mesh.parts; const parts = {};
  // installed BEHIND the shoulder blades: a surface address on the torso's back, a second girdle (hexapod)
  const f0 = frameAt(L1, 'torso', [3.05, 3.35], 'R'); const root = sub(f0.origin, mul(f0.normal, 0.03)); const wings = {};
  for (const side of ['R', 'L']) { const w = buildWing(DRAGON_WING, root, f, side); wings[side] = w; for (const [k, v] of Object.entries(w.parts)) parts[`${k}${side}`] = v;
    // the wing's root muscle: a short tapered sweep from inside the back out along the humerus
    const h = w.bones[0]; parts[`wingRoot${side}`] = { ...(side === 'L' ? ((m) => ({ ...m, faces: m.faces.map((t) => [...t].reverse()) })) : (m) => m)(tube([side === 'L' ? [-(root[0] - 0.1), root[1] + 0.02, root[2] - 0.04] : sub(root, [0.1, -0.02, 0.04]), h.head, add(h.head, mul(unit(sub(h.tail, h.head)), 0.2))], 0.11, 0.07, 8)), group: 'Body' }; }
  return { mesh, parts, wings, root, rootFrame: f0, palette: { ...(recipe.palette || {}), MembraneBack: '#4a3d34', MembraneUnder: '#9a7466', MembraneRim: '#2a211c', Vein: '#6d4a42', WingBone: '#5f6e52', Claw: '#efe9d8', Body: '#66755a' } }; }

// ═══════════ source, audit, raster ═══════════
function toSource({ mesh, parts, palette }) { const V = [...mesh.vertices], F = [...mesh.faces], C = []; let open = 0, wind = 0;
  const tintOf = Object.fromEntries(Object.entries(mesh.parts).map(([k, p]) => [k, p.tint])); mesh.faces.forEach((f, i) => C.push(palette[mesh.groups[i]] || tintOf[mesh.provenance[f[0]].part] || '#8a8f96'));
  for (const d of Object.values(parts)) { const idx = {}; for (const [k, p] of Object.entries(d.points)) { idx[k] = V.length; V.push(p); } const fg = d.faceGroups;
    d.faces.forEach((f, i) => { F.push(f.map((k) => idx[k])); C.push(palette[fg ? fg[i] : d.group] || '#ff00ff'); });
    const E = new Map(); for (const f of d.faces) for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; const key = a < b ? `${a}|${b}` : `${b}|${a}`; const e = E.get(key) || [0, 0]; e[0]++; e[1] += a < b ? 1 : -1; E.set(key, e); }
    for (const [c, bal] of E.values()) { if (c !== 2) open++; else if (bal) wind++; } }
  return { vertices: V, faces: F, colors: C, audit: { parts: Object.keys(parts).length, open, wind } }; }
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const LIGHT = unit([0.35, -0.55, 0.75]), FILL = unit([-0.7, 0.35, 0.15]); const BG = [247, 245, 239];   // a key and a weaker fill from the far side: a face turned from the key goes dark, it is not lit twice
function raster(src, cam, size, ss = 2) { const P = projectVertices(src.vertices, cam); const N = size * ss; const img = new Uint8Array(N * N * 3); const zb = new Float64Array(N * N).fill(Infinity);
  for (let i = 0; i < N * N; i++) img.set(BG, 3 * i);
  src.faces.forEach((f, fi) => { const [a, b, c] = f.map((k) => src.vertices[k]); const nn = cross(sub(b, a), sub(c, a)); if (Math.hypot(...nn) < 1e-14) return; const n = unit(nn); const k = 0.3 + 0.62 * Math.max(0, dot(n, LIGHT)) + 0.16 * Math.max(0, dot(n, FILL)); const col = hex(src.colors[fi]).map((x) => Math.min(255, Math.round(x * k)));
    const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] = f.map((v) => [P[v][0] * ss, P[v][1] * ss, P[v][2]]); const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const px = x + 0.5, py = y + 0.5; const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w2 = 1 - w0 - w1;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue; const z = 1 / (w0 / az + w1 / bz + w2 / cz); const idx = y * N + x; if (z < zb[idx]) { zb[idx] = z; img.set(col, 3 * idx); } } });
  const M = size, out = new Uint8Array(M * M * 3); for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) for (let ch = 0; ch < 3; ch++) { let t = 0; for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) t += img[3 * ((y * ss + dy) * N + x * ss + dx) + ch]; out[3 * (y * M + x) + ch] = Math.round(t / (ss * ss)); }
  return out; }
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(rgb, w, h) { const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
function sheet(cells, cols, size) { const rows = Math.ceil(cells.length / cols); const W = cols * size, out = new Uint8Array(W * rows * size * 3).fill(BG[0]);
  cells.forEach((c, i) => { const ox = (i % cols) * size, oy = Math.floor(i / cols) * size; for (let y = 0; y < size; y++) out.set(c.subarray(y * size * 3, (y + 1) * size * 3), 3 * ((oy + y) * W + ox)); }); return png(out, W, rows * size); }

// ═══════════ the waveform: measured (polar from the wrist, spread planform) and analytic ═══════════
function measuredEdge(W, f = 0) { const arm = armAt(W, f); const rays = raysAt(W, arm, f); const c = arm.pts[W.arm.length === 2 ? 2 : 2];
  // sample the planform's material: membrane sub-ray segments, or each vane's outline
  const pts = []; if (W.surface === 'membrane') { const m = membrane(W, arm, rays.map((r) => ({ ...r, boneId: 'x' })), (q) => q); for (const e of m.edge) pts.push(e); }
  else for (const r of rays.filter((r) => ['tertial', 'secondary', 'primary'].includes(r.kind))) { const p = [-r.d[1], r.d[0]]; for (let s = 0.5; s <= 1.0001; s += 0.01) { const w = r.width * (r.emarg && s > r.emarg.from ? 1 - r.emarg.by * (s - r.emarg.from) / (1 - r.emarg.from) : 1) * (s > 0.85 ? 1 - 1.8 * (s - 0.85) : 1);
    for (const q of [-0.5, -0.25, 0, 0.25, 0.5]) pts.push([r.anchor[0] + r.d[0] * r.len * s + p[0] * w * q, r.anchor[1] + r.d[1] * r.len * s + p[1] * w * q]); } }
  const bins = 240, rmax = new Array(bins).fill(0); const a0 = -Math.PI * 1.05, a1 = 0.15;
  for (const [x, y] of pts) { const a = Math.atan2(y - c[1], x - c[0]); if (a < a0 || a > a1) continue; const b = Math.min(bins - 1, Math.floor((a - a0) / (a1 - a0) * bins)); rmax[b] = Math.max(rmax[b], Math.hypot(x - c[0], y - c[1])); }
  return { rmax, a0, a1 }; }
const analytic = (m) => ({ N: Math.round(lerp(4, 29, m)), g: lerp(1, 6, m), a: lerp(0.2, 0.07, m), slot: lerp(0, 0.35, m) });
function waveformSvg() { const W = 1100, rowH = 120; const rows = []; let y = 30;
  const path = (vals, x0, w, y0, h, max) => vals.map((v, i) => `${i ? 'L' : 'M'}${(x0 + w * i / (vals.length - 1)).toFixed(1)},${(y0 + h - h * v / max).toFixed(1)}`).join(' ');
  for (const [name, Wd] of [['dragon (membrane, measured)', DRAGON_WING], ['vulture (vanes, measured)', VULTURE_WING]]) { const { rmax } = measuredEdge(Wd); const vals = rmax.map((v, i) => v || rmax.slice(Math.max(0, i - 3), i + 4).reduce((a, b) => Math.max(a, b), 0)); const mx = Math.max(...vals);
    rows.push(`<text x="20" y="${y - 8}" font-size="13">${name}: trailing-edge radius from the wrist, body side → tip</text><path d="${path(vals, 20, W - 40, y, rowH - 30, mx)}" fill="none" stroke="#333" stroke-width="1.5"/>`); y += rowH; }
  for (const m of [0, 0.25, 0.5, 0.75, 1]) { const { N, g, a, slot } = analytic(m); const vals = Array.from({ length: 600 }, (_, i) => { const s = i / 599; const env = Math.sin(Math.PI * (0.15 + 0.8 * s)); const amp = a + slot * Math.max(0, (s - 0.65) / 0.35); return env * (1 - amp * Math.abs(Math.sin(Math.PI * N * s)) ** g); });
    rows.push(`<text x="20" y="${y - 8}" font-size="13">analytic m=${m}: N=${N} rays, γ=${g.toFixed(1)}, sag ${a.toFixed(2)}, slot ${slot.toFixed(2)} ${m === 0 ? '(dragon)' : m === 1 ? '(vulture)' : ''}</text><path d="${path(vals, 20, W - 40, y, rowH - 30, 1)}" fill="none" stroke="${m === 0 ? '#6b4f3a' : m === 1 ? '#2d2a26' : '#8a8a8a'}" stroke-width="1.5"/>`); y += rowH; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="#f7f5ef"/><g font-family="sans-serif" fill="#333">${rows.join('')}</g></svg>`; }
/** the spread planforms, top-down, as SVG: arm, rays, and surface outline */
function planformSvg() { const cell = 520; const out = []; [['dragon', DRAGON_WING, 0.2], ['vulture', VULTURE_WING, 0.4]].forEach(([name, Wd, sc], ci) => { const arm = armAt(Wd, 0), rays = raysAt(Wd, arm, 0); const s = cell * sc; const ox = ci * cell + 60, oy = 200;
  const P = ([x, y]) => `${(ox + x * s).toFixed(1)},${(oy - y * s).toFixed(1)}`; const g = [];
  if (Wd.surface === 'membrane') { const m = membrane(Wd, arm, rays.map((r) => ({ ...r, boneId: 'x' })), (q) => q); g.push(`<polygon points="${[...m.edge.map(P)].join(' ')} ${P(arm.pts[2])} ${P(arm.pts[1])} ${P(arm.pts[0])}" fill="#b9a594" stroke="#5b4a3e" stroke-width="1"/>`); }
  else rays.filter((r) => ['tertial', 'secondary', 'primary'].includes(r.kind)).forEach((r) => { const p = [-r.d[1], r.d[0]]; const pts = []; for (const s of [0, 0.3, 0.6, 0.85, 1]) { const w = r.width * (r.emarg && s > r.emarg.from ? 1 - r.emarg.by * (s - r.emarg.from) / (1 - r.emarg.from) : 1) * (s > 0.85 ? 1 - 1.8 * (s - 0.85) : 1) / 2; pts.push([r.anchor[0] + r.d[0] * r.len * s + p[0] * w, r.anchor[1] + r.d[1] * r.len * s + p[1] * w]); }
    const back = pts.map(([x, y], k) => { const s = [0, 0.3, 0.6, 0.85, 1][k]; const w = r.width * (r.emarg && s > r.emarg.from ? 1 - r.emarg.by * (s - r.emarg.from) / (1 - r.emarg.from) : 1) * (s > 0.85 ? 1 - 1.8 * (s - 0.85) : 1); return [x - p[0] * w, y - p[1] * w]; }).reverse();
    g.push(`<polygon points="${[...pts, ...back].map(P).join(' ')}" fill="#8f7a64" fill-opacity="0.55" stroke="#3a2d23" stroke-width="0.6"/>`); });
  rays.forEach((r) => g.push(`<line x1="${P(r.anchor).split(',')[0]}" y1="${P(r.anchor).split(',')[1]}" x2="${P([r.anchor[0] + r.d[0] * r.len, r.anchor[1] + r.d[1] * r.len]).split(',')[0]}" y2="${P([r.anchor[0] + r.d[0] * r.len, r.anchor[1] + r.d[1] * r.len]).split(',')[1]}" stroke="${r.digit ? '#222' : '#777'}" stroke-width="${r.digit ? 2.5 : 0.5}"/>`));
  g.push(`<polyline points="${arm.pts.map(P).join(' ')}" fill="none" stroke="#c0392b" stroke-width="4"/>`); arm.pts.forEach((p) => g.push(`<circle cx="${P(p).split(',')[0]}" cy="${P(p).split(',')[1]}" r="4" fill="#c0392b"/>`));
  out.push(`<text x="${ox}" y="24" font-size="14">${name}: spread planform (red: arm chain, black: digits, grey: rays)</text>${g.join('')}`); });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cell * 2}" height="560" viewBox="0 0 ${cell * 2} 560"><rect width="100%" height="100%" fill="#f7f5ef"/><g font-family="sans-serif" fill="#333">${out.join('')}</g></svg>`; }

export { buildWing, DRAGON_WING, VULTURE_WING, VULTURE_PLAN, vulture, dragon, toSource, measuredEdge, armAt };
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const t0 = Date.now(); const S = 560; const cells = []; const stats = {};
  const V = { dragon: [['back34', 330, 18, [0, -0.4, 1.7], 8.5], ['front', 180, 8, [0, 0, 1.6], 8.5], ['wingBack', 345, 20, [1.4, -0.9, 2.2], 3.2], ['wingUnder', 160, 5, [1.4, -0.9, 2.2], 3.2]],
    vulture: [['top', 180, 70, [0, 0.05, 0.8], 4.2], ['under', 180, -35, [0, 0.05, 0.85], 4.2], ['wingTop', 170, 55, [0.75, 0, 0.95], 1.8], ['side', 90, 8, [0, 0, 0.7], 3.4]] };
  for (const [name, make] of [['dragon', dragon], ['vulture', vulture]]) for (const f of [0, 0.5, 1]) { const c = make(f); const src = toSource(c); stats[`${name}-fold${f}`] = { faces: src.faces.length, ...src.audit, bones: c.wings.R.bones.map((b) => `${b.id}<${b.parent}`).join(' ') };
    for (const [, az, el, tgt, dist] of V[name]) cells.push(raster(src, orbitCamera({ azimuthDegrees: az, elevationDegrees: el, target: tgt, distance: dist * (f === 1 ? 0.75 : 1), focalPixels: 1100, size: S }), S)); }
  writeFileSync(`${OUT()}/wings.png`, sheet(cells, 4, S)); writeFileSync(`${OUT()}/waveform.svg`, waveformSvg()); writeFileSync(`${OUT()}/planform.svg`, planformSvg()); writeFileSync(`${OUT()}/stats.json`, JSON.stringify(stats, null, 1));
  console.log(JSON.stringify(stats), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
