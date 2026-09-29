// construction/frame — a workbench `frames` entry: a structure's members on centrelines, cut where they meet, each in its
// material: timber dressed in its figure, steel in its section and finish, concrete with its reinforcement.
//
//   { id?, unit?: 'cm' | 'mm' | 'm' (default 'cm'), species?, finish?, tint?, cut?, figure?: 'full' | 'coarse' | 'flat',
//     seed?, load?: kN per metre of live load on level members, explode?: a distance (unit) to pull every member and
//     piece back along the way it seats — the joinery drawing's exploded view, xray?: concrete drawn see-through,
//     members: [{ id, from:[x,y,z], to:[x,y,z], up?,
//                 timber:   stock: [w, d] | '2x6' | '4sun' …, species?, finish?, tint?, cut?, log?: { … }
//                 steel:    section: 'W8x31' | 'IPE300' | 'SHS100x6' …, finish?: 'mill' | 'primer' | … | { paint }
//                 concrete: material: 'concrete', stock: [w, d], finish?, rebar?: { … } | false (rebar.js) }],
//     joints: [{ type, a, b, id?, …the type's options }] }
//
// A member's `from` end is its butt: the end that grew lowest in the tree (a post stands the way its tree stood; the
// Japanese carpenter's rule against the upside-down post, sakasa-bashira, is this default). Its log is sized to the
// section and cut (members.js), aged to reach it at the member's top, and seeded from the frame's seed and its index.
//
// Geometry: a member with no joint is its box, six quads; a jointed one is its box with the joints' trims, tenons and
// cuts composed by Manifold (the exact kernel). Without the kernel the members stay uncut boxes and the report says so:
// absence degrades the recipe, never breaks it. Each face carries uv in the member's own frame and, under `figure`
// 'full' or 'coarse', a timber texture key for the side it lies on (the six planes of the member's box; a face inside a
// joint wears the figure of the outer face parallel to it). The face's fill is the member's tint (species × finish),
// lit, and the texture multiplies over it (`textureLit`). Paint, or `figure: 'flat'`, draws one colour.
import { shadeHexMat, DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from '../polygonizer/materials.js';
import { fieldToFaces, exactFieldRendererReady } from '../polygonizer/field-faces.js';
import { TIMBERS, timberError, finishError, memberColor, rgbHex } from './timber.js';
import { SECTIONS, sectionError, sectionBox, sectionProps, profile } from './sections.js';
import { materialFinishError, materialRgb } from './finishes.js';
import { validateRebar, defaultCage, cage } from './rebar.js';
import { boxPolys } from './prims.js';
import { validateLog, ageForRadius } from './log.js';
import { figureMean } from './figure.js';
import { stockSection, memberFrame, toWorld, dirWorld, cutError, cutPose, poseReach, localToLog, localDirToLog } from './members.js';
import { movement } from './movement.js';
import { applyJoints, JOINT_TYPES } from './joints.js';
import { spanChecks, assemblyOrder } from './checks.js';
import { timberTextureKey } from './textures.js';

export const FRAME_UNITS = Object.freeze({ mm: 0.001, cm: 0.01, m: 1 });
export const FIGURE_MODES = Object.freeze(['full', 'coarse', 'flat']);
export const MEMBER_MATERIALS = Object.freeze(['timber', 'steel', 'concrete']);
const XRAY_ALPHA = 0.28;
/** The material a member spec names: a steel section, a concrete stock, or timber. */
const materialOf = (m) => (m.section !== undefined ? 'steel' : m.material || 'timber');
const BUTT = 0.3;                 // the member starts this far up its log: the stump stays in the ground

function mix(n) { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
const isPt = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/** Validate `frames` → string[]. */
export function validateFrames(frames) {
  const errors = [];
  if (!Array.isArray(frames)) return errors;
  frames.forEach((f, i) => {
    const at = `frames[${i}]`;
    if (!f || typeof f !== 'object') { errors.push(`${at}: must be an object { members, joints? }`); return; }
    if (f.unit !== undefined && !FRAME_UNITS[f.unit]) errors.push(`${at}.unit: must be one of ${Object.keys(FRAME_UNITS).join(', ')}`);
    if (f.species !== undefined && timberError(f.species)) errors.push(`${at}.species: ${timberError(f.species)}`);
    if (finishError(f.finish)) errors.push(`${at}.finish: ${finishError(f.finish)}`);
    if (cutError(f.cut)) errors.push(`${at}.cut: ${cutError(f.cut)}`);
    if (f.figure !== undefined && !FIGURE_MODES.includes(f.figure)) errors.push(`${at}.figure: must be one of ${FIGURE_MODES.join(', ')}`);
    if (f.seed !== undefined && !Number.isInteger(f.seed)) errors.push(`${at}.seed: must be an integer`);
    if (f.load !== undefined && !(Number.isFinite(f.load) && f.load >= 0)) errors.push(`${at}.load: kN per metre, a number ≥ 0`);
    if (f.explode !== undefined && !(Number.isFinite(f.explode) && f.explode >= 0)) errors.push(`${at}.explode: a distance in the frame's unit, ≥ 0`);
    if (f.xray !== undefined && typeof f.xray !== 'boolean') errors.push(`${at}.xray: true or false`);
    if (!Array.isArray(f.members) || !f.members.length) { errors.push(`${at}.members: a non-empty array of { id, from, to, stock }`); return; }
    const scale = FRAME_UNITS[f.unit || 'cm'] || 0.01;
    const ids = new Set();
    f.members.forEach((m, j) => {
      const mt = `${at}.members[${j}]`;
      if (!m || typeof m !== 'object') { errors.push(`${mt}: must be an object`); return; }
      if (typeof m.id !== 'string' || !m.id) errors.push(`${mt}.id: a non-empty string (joints name members by id)`);
      else if (ids.has(m.id)) errors.push(`${mt}.id: '${m.id}' is used twice`);
      else ids.add(m.id);
      if (!isPt(m.from) || !isPt(m.to)) errors.push(`${mt}: from and to must be [x, y, z]`);
      else if (len(sub(m.to, m.from)) * scale < 0.02) errors.push(`${mt}: from and to are less than 2 cm apart`);
      if (m.up !== undefined && !isPt(m.up)) errors.push(`${mt}.up: must be [x, y, z]`);
      const material = materialOf(m);
      if (m.material !== undefined && !MEMBER_MATERIALS.includes(m.material)) errors.push(`${mt}.material: one of ${MEMBER_MATERIALS.join(', ')} (a steel member names its \`section\`)`);
      else if (material === 'steel') {
        if (sectionError(m.section)) errors.push(`${mt}.section: ${sectionError(m.section)}`);
        if (materialFinishError('steel', m.finish)) errors.push(`${mt}.finish: ${materialFinishError('steel', m.finish)}`);
      } else if (material === 'concrete') {
        if (!stockSection(m.stock, scale)) errors.push(`${mt}.stock: [width, depth] in the frame's unit`);
        if (materialFinishError('concrete', m.finish)) errors.push(`${mt}.finish: ${materialFinishError('concrete', m.finish)}`);
        errors.push(...validateRebar(m.rebar, `${mt}.rebar`));
      } else {
        if (!stockSection(m.stock, scale)) errors.push(`${mt}.stock: [width, depth] in the frame's unit, or a named size (2x4, 4x6, 3.5sun, 4sun, nuki, …) — or a steel \`section\`, or material: 'concrete'`);
        if (m.species !== undefined && timberError(m.species)) errors.push(`${mt}.species: ${timberError(m.species)}`);
        if (finishError(m.finish)) errors.push(`${mt}.finish: ${finishError(m.finish)}`);
        if (cutError(m.cut)) errors.push(`${mt}.cut: ${cutError(m.cut)}`);
        if (m.log !== undefined) errors.push(...validateLog(m.log, `${mt}.log`));
      }
    });
    if (f.joints !== undefined && !Array.isArray(f.joints)) errors.push(`${at}.joints: must be an array`);
    (f.joints || []).forEach((J, j) => {
      const jt = `${at}.joints[${j}]`;
      if (!J || typeof J !== 'object') { errors.push(`${jt}: must be an object { type, a, b }`); return; }
      if (!JOINT_TYPES.includes(J.type)) errors.push(`${jt}.type: one of ${JOINT_TYPES.join(', ')}`);
      if (!ids.has(J.a)) errors.push(`${jt}.a: '${J.a}' names no member`);
      if (!(J.type === 'base-plate' && J.b === undefined) && !ids.has(J.b)) errors.push(`${jt}.b: '${J.b}' names no member`);
      if (J.a === J.b) errors.push(`${jt}: a and b must differ`);
    });
  });
  return errors;
}

/** Resolve a frame's members: sections, frames, logs, colours (metres). */
function resolveMembers(spec) {
  const scale = FRAME_UNITS[spec.unit || 'cm'];
  const seed = Number.isInteger(spec.seed) ? spec.seed : 1;
  return spec.members.map((m, i) => {
    const material = materialOf(m);
    const from = m.from.map((v) => v * scale), to = m.to.map((v) => v * scale);
    const F = memberFrame(from, to, m.up);
    const base = { id: m.id, index: i, F, L: F.L, material, xMin: 0, xMax: F.L, trims: [], adds: [], subs: [] };
    if (material === 'steel') {
      const [W, D] = sectionBox(m.section);
      return { ...base, W, D, section: m.section, sec: SECTIONS[m.section], finish: m.finish !== undefined ? m.finish : (typeof spec.finish === 'string' && !materialFinishError('steel', spec.finish) ? spec.finish : undefined) };
    }
    const [W, D] = stockSection(m.stock, scale);
    if (material === 'concrete') {
      const grounded = Math.min(from[2], to[2]) - D / 2 <= 0.05;
      const rebar = m.rebar === false ? null : (m.rebar && typeof m.rebar === 'object' ? m.rebar : null);
      return { ...base, W, D, finish: m.finish, rebarSpec: m.rebar === false ? null : (rebar || 'default'), grounded };
    }
    const species = m.species || spec.species || 'oak';
    const pose = cutPose(m.cut !== undefined ? m.cut : spec.cut, W, D);
    const lg = m.log || {};
    const reach = poseReach(pose, W, D) + 0.004;
    const length = BUTT + F.L + 0.4;
    const age = Number.isFinite(lg.age) ? Math.round(lg.age) : ageForRadius(species, reach, BUTT + F.L + 0.3, { ringMm: lg.ringMm });
    const log = {
      species, age, length: Math.round(length * 1000) / 1000,
      ...(Number.isFinite(lg.ringMm) ? { ringMm: lg.ringMm } : {}),
      ...(lg.knots ? { knots: lg.knots } : {}),
      ...(Number.isFinite(lg.clearBelow) ? { clearBelow: lg.clearBelow } : {}),
      ...(Number.isFinite(lg.spiral) ? { spiral: lg.spiral } : {}),
      seed: Number.isInteger(lg.seed) ? lg.seed : mix((seed * 7919 + i * 104729) | 0) % 1000003,
    };
    return {
      ...base, W, D, species, pose, log,
      finish: m.finish !== undefined ? m.finish : spec.finish,
      tint: m.tint !== undefined ? m.tint : spec.tint,
    };
  });
}

// ── faces ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const SIDES = ['+x', '-x', '+y', '-y', '+z', '-z'];
/** The side a local normal faces, and the local (u, v) axes of that side's plane. */
function sideOf(n) {
  const a = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])];
  const i = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
  return `${n[i] >= 0 ? '+' : '-'}${'xyz'[i]}`;
}
const PLANE_AXES = { x: [1, 2], y: [0, 2], z: [0, 1] };   // the local axes a side's texture runs along (u, v)

/**
 * The six side planes of a member's box (local), each with its texture key (or null), and the uv mapping.
 * Resolution: 4 mm a pixel along the grain, 1.25 mm across (`coarse` doubles both), capped at 1024 × 512.
 */
function sidePlanes(M, mode) {
  const lo = [M.xMin, -M.W / 2, -M.D / 2], hi = [M.xMax, M.W / 2, M.D / 2];
  const planes = {};
  for (const side of SIDES) {
    const ax = side[1]; const k = 'xyz'.indexOf(ax); const at = side[0] === '+' ? hi[k] : lo[k];
    const [iu, iv] = PLANE_AXES[ax];
    const w = hi[iu] - lo[iu], h = hi[iv] - lo[iv];
    let key = null;
    if (mode !== 'flat') {
      const f = mode === 'coarse' ? 2 : 1;
      const pxU = (iu === 0 ? 0.004 : 0.00125) * f, pxV = (iv === 0 ? 0.004 : 0.00125) * f;
      const nu = Math.max(8, Math.min(1024, Math.round(w / pxU))), nv = Math.max(8, Math.min(512, Math.round(h / pxV)));
      const o = [0, 0, 0]; o[k] = at; o[iu] = lo[iu]; o[iv] = lo[iv];
      const eu = [0, 0, 0]; eu[iu] = 1; const ev = [0, 0, 0]; ev[iv] = 1;
      key = timberTextureKey(M.log, { origin: localToLog(M.pose, BUTT, o), a: localDirToLog(M.pose, eu), b: localDirToLog(M.pose, ev), w, h }, nu, nv);
    }
    planes[side] = { key, iu, iv, u0: lo[iu], v0: lo[iv], w, h };
  }
  return planes;
}

/** Local triangles or quads (corners in member-local metres, local normal) → textured, lit World faces. */
function dressFaces(M, polys, { light, mat, color, planes, unitScale, group, alpha }) {
  const inv = 1 / unitScale;
  const figureMode = color.mode === 'figure' && planes && planes['+x'].key;
  const meanRgb = color.mode === 'figure' ? color.rgb.map((v, i) => v * figureMean(M.species)[i]) : color.rgb;
  const flatHex = rgbHex(meanRgb), tintHex = rgbHex(color.rgb);
  const a = alpha ? { alpha } : {};
  return polys.map(({ corners, n }) => {
    const nW = dirWorld(M.F, n);
    const cornersW = corners.map((c) => toWorld(M.F, c).map((v) => v * inv));
    const quad = corners.length === 3 ? [...cornersW, cornersW[0]] : cornersW;
    if (!figureMode) return { corners: quad, fill: shadeHexMat(flatHex, nW, mat, { light }), doubleSided: true, outNormal: nW, group, ...a, ...(corners.length === 3 ? { exact: true } : {}) };
    const P = planes[sideOf(n)];
    const uv = corners.map((c) => [(c[P.iu] - P.u0) / P.w, (c[P.iv] - P.v0) / P.h]);
    return {
      corners: quad, fill: shadeHexMat(tintHex, nW, mat, { light }), doubleSided: true, outNormal: nW, group,
      texture: P.key, uv: corners.length === 3 ? [...uv, uv[0]] : uv, textureLit: true,
    };
  });
}

/** A member's box as six local quads (no kernel needed). */
const memberBoxPolys = (M) => boxPolys([(M.xMin + M.xMax) / 2, 0, 0], [M.xMax - M.xMin, M.W, M.D]);

/** A member's body as exact terms (member-local): a timber or concrete box, a steel section's profile extruded. */
function bodyTerms(M) {
  if (M.material !== 'steel') return [{ op: 'add', shape: { kind: 'box', center: [(M.xMin + M.xMax) / 2, 0, 0], size: [M.xMax - M.xMin, M.W, M.D] } }];
  const pr = profile(M.section);
  // an extrude along +x reads its profile as (y, z)
  const ext = (poly, grow) => ({ kind: 'extrude', axisFrom: [M.xMin - grow, 0, 0], axisTo: [M.xMax + grow, 0, 0], profile: { points: poly.map(([y, z]) => [Math.round(y * 1e5) / 1e5, Math.round(z * 1e5) / 1e5]) } });
  return [{ op: 'add', shape: ext(pr.outer, 0) }, ...(pr.inner ? [{ op: 'subtract', shape: ext(pr.inner, 0.002) }] : [])];
}

/** The colour a member (or loose piece) wears → { mode, rgb }. */
function colorOf(M) {
  if (M.material === 'steel') return { mode: 'paint', rgb: materialRgb('steel', M.finish) };
  if (M.material === 'concrete') return { mode: 'paint', rgb: materialRgb('concrete', M.finish) };
  if (M.material === 'rebar') return { mode: 'paint', rgb: materialRgb('rebar', M.finish) };
  return memberColor(M.species, { tint: M.tint, finish: M.finish });
}

/** Compose a term list with the exact kernel → local triangles [{ corners, n }]. */
function exactPolys(terms) {
  const faces = fieldToFaces({ terms, exact: true, segments: 12 }, {});
  return faces.map((f) => ({ corners: f.corners.slice(0, 3), n: f.outNormal }));
}

/**
 * lowerFrame(spec, { light }) → { faces, report }. Faces are in the recipe's unit (the workbench grid's).
 */
export function lowerFrame(spec, { light = DEFAULT_LIGHT } = {}) {
  const unitScale = FRAME_UNITS[spec.unit || 'cm'];
  const members = resolveMembers(spec);
  const byId = new Map(members.map((M) => [M.id, M]));
  const joints = Array.isArray(spec.joints) ? spec.joints : [];
  const J = applyJoints(joints, byId);
  const kernel = exactFieldRendererReady();
  const mode = spec.figure || 'full';
  const MAT = { timber: resolveMaterial('wood'), steel: resolveMaterial('steel'), concrete: resolveMaterial('stone'), rebar: resolveMaterial('gunmetal') };
  const xray = spec.xray === true ? XRAY_ALPHA : null;
  const faces = [];
  const cages = new Map();
  for (const M of members) {
    const mat = MAT[M.material];
    const jointed = M.trims.length || M.adds.length || M.subs.length;
    const needsKernel = jointed || M.material === 'steel';
    const polys = needsKernel && kernel
      ? exactPolys([...bodyTerms(M), ...M.trims.map((shape) => ({ op: 'subtract', shape })), ...M.adds.map((shape) => ({ op: 'add', shape })), ...M.subs.map((shape) => ({ op: 'subtract', shape }))])
      : memberBoxPolys(M);
    const planes = M.material === 'timber' ? sidePlanes(M, mode) : null;
    faces.push(...tagFacesWithMaterial(dressFaces(M, polys, { light, mat, color: colorOf(M), planes, unitScale, group: M.id, alpha: M.material === 'concrete' ? xray : null }), mat));
    if (M.material === 'concrete' && M.rebarSpec) {
      const spec2 = M.rebarSpec === 'default' ? defaultCage(M, M.grounded) : { ...defaultCage(M, M.grounded), ...M.rebarSpec };
      const c = cage(M, spec2); cages.set(M.id, c.summary);
      faces.push(...tagFacesWithMaterial(dressFaces(M, c.polys, { light, mat: MAT.rebar, color: colorOf({ material: 'rebar', finish: spec2.finish }), planes: null, unitScale, group: `${M.id}:rebar` }), MAT.rebar));
    }
  }
  for (const p of J.pieces) {
    if (!p.polys && !kernel) continue;
    const material = p.material || 'timber';
    const polys = p.polys || exactPolys(p.terms);
    const color = material === 'timber' ? { mode: 'paint', rgb: memberColor(p.species, {}).rgb.map((v, i) => v * figureMean(p.species)[i]) } : colorOf({ material, finish: p.finish });
    faces.push(...tagFacesWithMaterial(dressFaces({ ...p.host, species: p.species }, polys, { light, mat: MAT[material], color, planes: null, unitScale, group: p.id }), MAT[material]));
  }

  // ── the report ──
  // supports: a level member is carried where a post (or another level member) meets it; braces are not counted
  const sin15 = Math.sin((15 * Math.PI) / 180);
  const carries = (O) => Math.abs(O.F.ex[2]) < sin15 || Math.abs(O.F.ex[2]) > Math.cos((15 * Math.PI) / 180);
  const supports = new Map(members.map((M) => [M.id, []]));
  for (const e of J.edges) {
    if (e.piece) continue;
    for (const [m, o] of [[e.a, e.b], [e.b, e.a]]) {
      const M = byId.get(m), O = byId.get(o);
      if (!carries(O)) continue;
      const pm = nearestOnAxis(M, O);
      if (pm != null) supports.get(m).push(pm);
    }
  }
  // a spliced run (kanawa-tsugi) acts as one beam: check it as one member in the first piece's frame
  const splices = joints.filter((j) => j.type === 'kanawa-tsugi');
  const nextOf = new Map(splices.map((j) => [j.a, j.b])), spliced = new Set(splices.map((j) => j.b));
  const spanMembers = [];
  for (const M of members) {
    if (spliced.has(M.id)) continue;
    if (!nextOf.has(M.id)) { spanMembers.push(M); continue; }
    const run = { ...M, id: M.id, xMax: M.xMax }; const xs = [...supports.get(M.id)]; let cur = M, off = 0; const names = [M.id];
    while (nextOf.has(cur.id)) {
      off += cur.L; cur = byId.get(nextOf.get(cur.id)); names.push(cur.id);
      for (const x of supports.get(cur.id)) xs.push(off + x);
      run.xMax = off + cur.xMax; run.L = off + cur.L;
    }
    run.id = names.join('+'); supports.set(run.id, xs); spanMembers.push(run);
  }
  for (const M of spanMembers) if (cages.has(M.id)) M.cage = cages.get(M.id);
  const span = spanChecks(spanMembers, (id) => supports.get(id), { liveKNm: Number.isFinite(spec.load) ? spec.load : 0 });
  const drawn = J.pieces.filter((p) => p.polys || kernel);
  const drawnIds = new Set(drawn.map((p) => p.id));
  const ids = [...members.map((M) => M.id), ...drawn.map((p) => p.id)];
  const assembly = assemblyOrder(ids, J.edges.filter((e) => !e.piece || drawnIds.has(e.a)));
  // the exploded view: each member back along the way it seats; a piece with its host, then out along its own way
  if (Number.isFinite(spec.explode) && spec.explode > 0) {
    const k = spec.explode; const off = new Map();
    // later members pull back further, so two that seat the same way (a splice's halves) still come apart
    let rank = 0;
    for (const id of assembly.order || members.map((M) => M.id)) {
      const v = byId.has(id) && assembly.moves[id]; if (!v) continue;
      const kk = k * (1 + 0.5 * Math.min(4, rank++)); off.set(id, v.map((x) => -x * kk));
    }
    for (const p of drawn) {
      const h = off.get(p.host.id) || [0, 0, 0]; const v = assembly.moves[p.id] || [0, 0, 0];
      off.set(p.id, h.map((x, i) => x - v[i] * k * 1.2));
    }
    for (const f of faces) { const o = off.get(f.group); if (o) f.corners = f.corners.map((c) => [c[0] + o[0], c[1] + o[1], c[2] + o[2]]); }
  }
  const mm = (v) => Math.round(v * 1000);
  const report = {
    members: members.map((M) => {
      const common = { id: M.id, material: M.material, lengthMm: mm(M.xMax - M.xMin), ...(M.finish !== undefined ? { finish: M.finish } : {}) };
      if (M.material === 'steel') { const p = sectionProps(M.section); return { ...common, section: M.section, grade: M.sec.grade, massKg: Math.round(p.mass * (M.xMax - M.xMin) * 10) / 10 }; }
      if (M.material === 'concrete') return { ...common, stockMm: [mm(M.W), mm(M.D)], ...(cages.has(M.id) ? { rebar: cages.get(M.id) } : { rebar: null }) };
      return {
        ...common, species: M.species, stockMm: [mm(M.W), mm(M.D)], cut: M.pose.name,
        log: { age: M.log.age, ringMm: M.log.ringMm || TIMBERS[M.species].ringMm, knots: M.log.knots || 'normal' },
        movement: movement(M.species, M.pose, M.W, M.D),
      };
    }),
    joints: J.report,
    pieces: drawn.map((p) => ({ id: p.id, kind: p.kind, ...(p.species && !p.material ? { species: p.species } : { material: p.material }) })),
    span, assembly: { order: assembly.order, lock: assembly.lock },
    ...(jointedWithoutKernel(members, kernel) ? { degraded: 'joints are not cut and steel sections are not shaped: the exact kernel (manifold-3d) is not installed, so members draw as plain boxes' } : {}),
  };
  return { faces, report };
}

const jointedWithoutKernel = (members, kernel) => !kernel && members.some((M) => M.trims.length || M.adds.length || M.subs.length || M.material === 'steel');

/** Where O's axis passes nearest M's axis, as M-local x (null if the axes are parallel and apart). */
function nearestOnAxis(M, O) {
  const p = M.F.origin, u = M.F.ex, q = O.F.origin, v = O.F.ex;
  const w = sub(p, q); const b = dot(u, v), d = dot(u, w), e = dot(v, w); const den = 1 - b * b;
  if (den < 1e-9) return null;
  const sc = (b * e - d) / den;
  return Math.max(M.xMin, Math.min(M.xMax, sc));
}

/** A readable digest of a frame's report: the lines a mint stamps as warnings. */
export function frameStamps(report, label) {
  const out = [];
  for (const s of report.span) {
    if (s.ok) continue;
    const strength = s.capacityKNm !== undefined ? `carries ${s.momentKNm} kN·m against a capacity of ${s.capacityKNm}` : `is stressed to ${s.stressMPa} of a rough ${s.allowMPa} MPa`;
    out.push(`${label}: ${s.member} (${s.kind} ${s.spanMm} mm) deflects ${s.deflMm} mm against a ${s.limitMm} mm limit and ${strength} — deepen it, shorten the span, or add a support (advisory arithmetic, braces not counted)`);
  }
  for (const j of report.joints) if (j.relishOk === false) out.push(`${label}: joint ${j.joint} leaves ${j.relishMm} mm of relish past its peg (keep at least two peg diameters) — a deeper tenon or a peg nearer the shoulder`);
  const a = report.assembly;
  if (!a.order && a.lock) out.push(`${label}: no order seats every joint by sliding — ${a.lock.member} would have to move in directions ${a.lock.spreadDeg}° apart (after ${a.lock.after.join(', ') || 'nothing'}). A framer seats this by flexing the frame together; a kigumi frame is shaped so it slides.`);
  if (report.degraded) out.push(`${label}: ${report.degraded}`);
  return out;
}
