// construction/frame — a workbench `frames` entry: a structure's members on centrelines, cut where they meet, each in its
// material: timber dressed in its figure, steel in its section and finish, concrete with its reinforcement.
//
//   { id?, unit?: 'cm' | 'mm' | 'm' (default 'cm'), species?, finish?, tint?, cut?, figure?: 'full' | 'coarse' | 'flat',
//     seed?, load?: kN per metre of live load on level members, explode?: a distance (unit) to pull every member and
//     piece back along the way it seats — the joinery drawing's exploded view, xray?: concrete drawn see-through,
//     members: [{ id, from:[x,y,z], to:[x,y,z], up?,
//                 timber:   stock: [w, d] | '2x6' | '4sun' …, species?, finish?, tint?, cut?, log?: { … }
//                 steel:    section: 'W8x31' | 'IPE300' | 'SHS100x6' …, finish?: 'mill' | 'primer' | … | { paint }
//                 concrete: material: 'concrete', stock: [w, d], finish?, rebar?: { … } | false (rebar.js)
//                 sheet:    material: 'particleboard' | 'mfc' | 'mdf' | 'plywood' | 'osb' | 'hardboard', stock: [w, t],
//                           finish?, tint?, edges?: { front: 'abs' | 'none' | { paint } … } (sheets.js)
//                 any:      shelfLoad?: kg per metre this member carries as a shelf (furniture; the frame's `shelfLoad`,
//                           default 30, a row of books) }],
//     Any member may be a box instead of a centreline: { id, box: { min, max }, grain?: 'x'|'y'|'z', …material }; its
//     grain runs the longest side and its thinnest side is its depth (members.js boxToCentreline).
//     joints: [{ type, a, b, id?, …the type's options }],
//     soft?: [{ id, kind: 'cushion' | 'pillow' | 'bolster' | 'pad' | 'custom', box, … }] (soft.js): cushions and padding,
//     fabric?: the cloth they are covered in (fabric.js), railroad?: the cloth turned so its width runs along the piece,
//     view?: 'finished' (default: members the padding hides are left out of the faces) | 'frame' (no soft parts),
//     softCell?: the surface-net cell (the frame's unit; about 20 mm) }
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
import { SHEETS, SHEET_KEYS, isSheet, sheetColor, sheetFigureMean, sheetTile, bandFor, edgesError, thicknessAdvice } from './sheets.js';
import { HARDWARE_FINISHES } from './hardware.js';
import { furnitureReport, furnitureStamps, isFurniture } from './furniture-checks.js';
import { expandBuild, validateBuild } from './furniture-builds.js';
import { validateLog, ageForRadius } from './log.js';
import { figureMean } from './figure.js';
import { stockSection, memberFrame, toWorld, dirWorld, cutError, cutPose, poseReach, localToLog, localDirToLog, boxToCentreline, boxError } from './members.js';
import { movement } from './movement.js';
import { applyJoints, JOINT_TYPES } from './joints.js';
import { spanChecks, assemblyOrder, assemblyTree, assemblyGroups } from './checks.js';
import { timberTextureKey } from './textures.js';
import { validateSoft, lowerSoft, FILLS } from './soft.js';
import { fabricError, resolveFabric, fabricSummary } from './fabric.js';
import { worldBox } from './furniture-joints.js';
import { coverLayout, coverSummary, coverStamps } from './covers.js';

export const FRAME_UNITS = Object.freeze({ mm: 0.001, cm: 0.01, m: 1 });
export const FIGURE_MODES = Object.freeze(['full', 'coarse', 'flat']);
export const MEMBER_MATERIALS = Object.freeze(['timber', 'steel', 'concrete', ...SHEET_KEYS]);
const XRAY_ALPHA = 0.28;
/** The material a member spec names: a steel section, a concrete stock, or timber. */
const materialOf = (m) => (m.section !== undefined ? 'steel' : m.material || 'timber');
/** A frame with a `build` (furniture-builds.js): its members and joints with the build's appended, and the expansion. */
function withBuild(f) {
  if (!f || !f.build || validateBuild(f.build, 'build').length) return f;
  const x = expandBuild(f);
  return { ...f, members: [...(Array.isArray(f.members) ? f.members : []), ...x.members], joints: [...(Array.isArray(f.joints) ? f.joints : []), ...x.joints], ...(x.soft ? { soft: [...(Array.isArray(f.soft) ? f.soft : []), ...x.soft] } : {}), ...(x.supplied ? { supplied: x.supplied } : {}), built: x };
}

/** A member written as a box, as its centreline twin (recipe units); any other member as written. */
const asCentreline = (m) => (m && m.box && !boxError(m.box, m.grain, 1e9) ? { ...m, ...boxToCentreline(m.box, m.grain) } : m);
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
  frames.forEach((f0, i) => {
    const at = `frames[${i}]`;
    if (!f0 || typeof f0 !== 'object') { errors.push(`${at}: must be an object { members, joints? }`); return; }
    if (f0.unit !== undefined && !FRAME_UNITS[f0.unit]) { errors.push(`${at}.unit: must be one of ${Object.keys(FRAME_UNITS).join(', ')}`); return; }
    const buildErrors = validateBuild(f0.build, `${at}.build`);
    if (buildErrors.length) { errors.push(...buildErrors); return; }
    let f; try { f = withBuild(f0); } catch (e) { errors.push(`${at}.${e.message}`); return; }
    if (f.species !== undefined && timberError(f.species)) errors.push(`${at}.species: ${timberError(f.species)}`);
    if (finishError(f.finish)) errors.push(`${at}.finish: ${finishError(f.finish)}`);
    if (cutError(f.cut)) errors.push(`${at}.cut: ${cutError(f.cut)}`);
    if (f.figure !== undefined && !FIGURE_MODES.includes(f.figure)) errors.push(`${at}.figure: must be one of ${FIGURE_MODES.join(', ')}`);
    if (f.seed !== undefined && !Number.isInteger(f.seed)) errors.push(`${at}.seed: must be an integer`);
    if (f.load !== undefined && !(Number.isFinite(f.load) && f.load >= 0)) errors.push(`${at}.load: kN per metre, a number ≥ 0`);
    if (f.explode !== undefined && !(Number.isFinite(f.explode) && f.explode >= 0)) errors.push(`${at}.explode: a distance in the frame's unit, ≥ 0`);
    if (f.xray !== undefined && typeof f.xray !== 'boolean') errors.push(`${at}.xray: true or false`);
    if (f.layout !== undefined && f.layout !== 'kit') errors.push(`${at}.layout: 'kit' (every part laid flat to print), or leave it out`);
    if (f.kitGap !== undefined && !(Number.isFinite(f.kitGap) && f.kitGap >= 0)) errors.push(`${at}.kitGap: a distance in the frame's unit, ≥ 0`);
    if (f.shelfLoad !== undefined && !(Number.isFinite(f.shelfLoad) && f.shelfLoad >= 0)) errors.push(`${at}.shelfLoad: kg per metre, a number ≥ 0`);
    if (fabricError(f.fabric)) errors.push(`${at}.${fabricError(f.fabric)}`);
    if (f.railroad !== undefined && typeof f.railroad !== 'boolean') errors.push(`${at}.railroad: true (the cloth's width runs along the piece) or false`);
    if (f.view !== undefined && !['finished', 'frame'].includes(f.view)) errors.push(`${at}.view: 'finished' or 'frame'`);
    if (f.softCell !== undefined && !(Number.isFinite(f.softCell) && f.softCell > 0)) errors.push(`${at}.softCell: a size > 0 in the frame's unit`);
    if (f.supplied !== undefined && !(Array.isArray(f.supplied) && f.supplied.every((g) => typeof g === 'string' && g))) errors.push(`${at}.supplied: the groups that arrive made (upholstered sections), as names`);
    if (!Array.isArray(f.members) || !f.members.length) { errors.push(`${at}.members: a non-empty array of { id, from, to, stock } (or a \`build\`)`); return; }
    const scale = FRAME_UNITS[f.unit || 'cm'] || 0.01;
    const ids = new Set();
    f.members.forEach((m0, j) => {
      const mt = `${at}.members[${j}]`;
      if (!m0 || typeof m0 !== 'object') { errors.push(`${mt}: must be an object`); return; }
      if (m0.box !== undefined) {
        const be = boxError(m0.box, m0.grain, scale);
        if (be) { errors.push(`${mt}.${be}`); return; }
        if (m0.from !== undefined || m0.to !== undefined || m0.stock !== undefined) errors.push(`${mt}: a box member has no from, to or stock (the box gives them)`);
      }
      const m = asCentreline(m0);
      if (typeof m.id !== 'string' || !m.id) errors.push(`${mt}.id: a non-empty string (joints name members by id)`);
      else if (ids.has(m.id)) errors.push(`${mt}.id: '${m.id}' is used twice`);
      else ids.add(m.id);
      if (!isPt(m.from) || !isPt(m.to)) errors.push(`${mt}: from and to must be [x, y, z]`);
      else if (len(sub(m.to, m.from)) * scale < 0.02) errors.push(`${mt}: from and to are less than 2 cm apart`);
      if (m.up !== undefined && !isPt(m.up)) errors.push(`${mt}.up: must be [x, y, z]`);
      if (m.shelfLoad !== undefined && !(Number.isFinite(m.shelfLoad) && m.shelfLoad >= 0)) errors.push(`${mt}.shelfLoad: kg per metre, a number ≥ 0`);
      if (m.group !== undefined && !(typeof m.group === 'string' && m.group)) errors.push(`${mt}.group: a name — members sharing it are built together first (a drawer)`);
      if (m.load !== undefined && !(Number.isFinite(m.load) && m.load >= 0)) errors.push(`${mt}.load: kN per metre of live load this member carries, ≥ 0`);
      const material = materialOf(m);
      if (m.material !== undefined && !MEMBER_MATERIALS.includes(m.material)) errors.push(`${mt}.material: one of ${MEMBER_MATERIALS.join(', ')} (a steel member names its \`section\`)`);
      else if (material === 'steel') {
        if (sectionError(m.section)) errors.push(`${mt}.section: ${sectionError(m.section)}`);
        if (materialFinishError('steel', m.finish)) errors.push(`${mt}.finish: ${materialFinishError('steel', m.finish)}`);
      } else if (material === 'concrete') {
        if (!stockSection(m.stock, scale)) errors.push(`${mt}.stock: [width, depth] in the frame's unit`);
        if (materialFinishError('concrete', m.finish)) errors.push(`${mt}.finish: ${materialFinishError('concrete', m.finish)}`);
        errors.push(...validateRebar(m.rebar, `${mt}.rebar`));
      } else if (isSheet(material)) {
        if (!stockSection(m.stock, scale)) errors.push(`${mt}.stock: [width, thickness] in the frame's unit (or give a box)`);
        if (finishError(m.finish)) errors.push(`${mt}.finish: ${finishError(m.finish)}`);
        if (edgesError(m.edges)) errors.push(`${mt}.${edgesError(m.edges)}`);
      } else {
        if (!stockSection(m.stock, scale)) errors.push(`${mt}.stock: [width, depth] in the frame's unit, or a named size (2x4, 4x6, 3.5sun, 4sun, nuki, …) — or a steel \`section\`, or material: 'concrete'`);
        if (m.species !== undefined && timberError(m.species)) errors.push(`${mt}.species: ${timberError(m.species)}`);
        if (finishError(m.finish)) errors.push(`${mt}.finish: ${finishError(m.finish)}`);
        if (cutError(m.cut)) errors.push(`${mt}.cut: ${cutError(m.cut)}`);
        if (m.log !== undefined) errors.push(...validateLog(m.log, `${mt}.log`));
      }
    });
    errors.push(...validateSoft(f.soft, `${at}.soft`, { unitScale: scale, taken: ids }));
    const softIds = new Set((Array.isArray(f.soft) ? f.soft : []).map((s) => s && s.id));
    (Array.isArray(f.soft) ? f.soft : []).forEach((s, j) => { if (s && s.on !== undefined && typeof s.on === 'string' && !ids.has(s.on) && !softIds.has(s.on)) errors.push(`${at}.soft[${j}].on: '${s.on}' names no member or soft part`); });
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
  // furniture is made from clear, graded stock: its timber has no knots unless the member's log asks for them
  const clearStock = isFurniture(spec);
  const seed = Number.isInteger(spec.seed) ? spec.seed : 1;
  return spec.members.map((m0, i) => {
    const m = asCentreline(m0);
    const material = materialOf(m);
    const from = m.from.map((v) => v * scale), to = m.to.map((v) => v * scale);
    const F = memberFrame(from, to, m.up);
    const base = { id: m.id, index: i, F, L: F.L, material, xMin: 0, xMax: F.L, trims: [], adds: [], subs: [], ...(m0.box ? { box: true } : {}), ...(Number.isFinite(m.shelfLoad) ? { shelfKgM: m.shelfLoad } : {}), ...(typeof m.group === 'string' && m.group ? { group: m.group } : {}), ...(Number.isFinite(m.load) ? { liveKNm: m.load } : {}) };
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
    if (isSheet(material)) {
      return { ...base, W, D, sheet: SHEETS[material], finish: m.finish !== undefined ? m.finish : undefined, tint: m.tint, edges: m.edges, seed: mix((seed * 7919 + i * 104729) | 0) % 1000003 };
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
      ...(lg.knots ? { knots: lg.knots } : clearStock ? { knots: 'clear' } : {}),
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
function dressFaces(M, polys, { light, mat, color, planes, unitScale, group, alpha, mean }) {
  const inv = 1 / unitScale;
  const figureMode = color.mode === 'figure' && planes && Object.values(planes).some((P) => P && P.key);
  const meanRgb = color.mode === 'figure' ? color.rgb.map((v, i) => v * (mean || figureMean(M.species))[i]) : color.rgb;
  const flatHex = rgbHex(meanRgb), tintHex = rgbHex(color.rgb);
  const a = alpha ? { alpha } : {};
  return polys.map(({ corners, n }) => {
    const nW = dirWorld(M.F, n);
    const cornersW = corners.map((c) => toWorld(M.F, c).map((v) => v * inv));
    const quad = corners.length === 3 ? [...cornersW, cornersW[0]] : cornersW;
    if (!figureMode) return { corners: quad, fill: shadeHexMat(flatHex, nW, mat, { light }), doubleSided: true, outNormal: nW, group, ...a, ...(corners.length === 3 ? { exact: true } : {}) };
    const P = planes[sideOf(n)];
    if (!P || !P.key) return { corners: quad, fill: shadeHexMat(flatHex, nW, mat, { light }), doubleSided: true, outNormal: nW, group, ...a, ...(corners.length === 3 ? { exact: true } : {}) };
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
  if (M.material === 'hardware') return { mode: 'paint', rgb: (HARDWARE_FINISHES[M.finish] || HARDWARE_FINISHES.zinc).slice() };
  return memberColor(M.species, { tint: M.tint, finish: M.finish });
}

/**
 * A sheet member's faces: its two faces wear the face tile in the face colour, each edge the edge tile in the core's
 * colour, or its band (the face's colour, or a paint) as one flat colour.
 */
function dressSheet(M, polys, { light, mat, unitScale, mode }) {
  const col = sheetColor(M.material, { finish: M.finish, tint: M.tint });
  const mean = sheetFigureMean(M.material);
  const thickMm = Math.round(M.D * 10000) / 10;
  const flat = (c) => ({ mode: 'paint', rgb: c.mode === 'figure' ? c.rgb.map((v, i) => v * mean[i]) : c.rgb });
  const bySide = new Map();
  for (const p of polys) { const s = sideOf(p.n); if (!bySide.has(s)) bySide.set(s, []); bySide.get(s).push(p); }
  const out = [];
  for (const [side, ps] of bySide) {
    const ax = side[1];
    const isFace = ax === 'z';
    let color = isFace ? col.face : col.edge; let planes = null;
    if (!isFace) {
      const w = dirWorld(M.F, sideNormal(side)); const k = [0, 1, 2].reduce((b, i) => (Math.abs(w[i]) > Math.abs(w[b]) ? i : b), 0);
      const band = bandFor(M.material, M.edges, `${w[k] >= 0 ? '+' : '-'}${'xyz'[k]}`);
      if (band === 'abs') color = flat(col.face);
      else if (band && typeof band === 'object') color = { mode: 'paint', rgb: sheetColor(M.material, { finish: band }).face.rgb };
    }
    if (color.mode === 'figure' && mode !== 'flat') {
      const t = sheetTile(M.material, isFace ? 'face' : ax === 'y' ? 'edge-long' : 'edge-end', { thickMm, seed: M.seed % 7 });
      const [iu, iv] = PLANE_AXES[ax];
      planes = { [side]: { key: t.key, iu, iv, u0: iu === 0 ? M.xMin : -M.W / 2, v0: iv === 1 ? -M.W / 2 : -M.D / 2, w: t.tileU, h: t.tileV || M.D } };
    }
    out.push(...dressFaces(M, ps, { light, mat, color, planes, unitScale, group: M.id, mean }));
  }
  return out;
}
const sideNormal = (side) => { const n = [0, 0, 0]; n['xyz'.indexOf(side[1])] = side[0] === '+' ? 1 : -1; return n; };

/** Compose a term list with the exact kernel → local triangles [{ corners, n }]. */
function exactPolys(terms) {
  const faces = fieldToFaces({ terms, exact: true, segments: 12 }, {});
  return faces.map((f) => ({ corners: f.corners.slice(0, 3), n: f.outNormal }));
}

/**
 * lowerFrame(spec, { light, timberFigure }) → { faces, report }. Faces are in the recipe's unit (the workbench grid's).
 * `timberFigure: 'flat'` (a lowering option, not the recipe's) tints timber flat while boards and cloth keep their
 * shared tiles — a room full of pieces cannot carry a figure texture per timber face.
 */
export function lowerFrame(spec0, { light = DEFAULT_LIGHT, timberFigure = null } = {}) {
  const spec = withBuild(spec0);
  const unitScale = FRAME_UNITS[spec.unit || 'cm'];
  const members = resolveMembers(spec);
  const byId = new Map(members.map((M) => [M.id, M]));
  const joints = Array.isArray(spec.joints) ? spec.joints : [];
  const J = applyJoints(joints, byId);
  const kernel = exactFieldRendererReady();
  const mode = spec.figure || 'full';
  const MAT = { timber: resolveMaterial('wood'), steel: resolveMaterial('steel'), concrete: resolveMaterial('stone'), rebar: resolveMaterial('gunmetal'), sheet: resolveMaterial('wood'), hardware: resolveMaterial('steel') };
  const xray = spec.xray === true ? XRAY_ALPHA : null;
  const faces = [];
  const cages = new Map();
  for (const M of members) {
    const mat = MAT[isSheet(M.material) ? 'sheet' : M.material];
    const jointed = M.trims.length || M.adds.length || M.subs.length;
    const needsKernel = jointed || M.material === 'steel';
    const polys = needsKernel && kernel
      ? exactPolys([...bodyTerms(M), ...M.trims.map((shape) => ({ op: 'subtract', shape })), ...M.adds.map((shape) => ({ op: 'add', shape })), ...M.subs.map((shape) => ({ op: 'subtract', shape }))])
      : memberBoxPolys(M);
    if (isSheet(M.material)) { faces.push(...tagFacesWithMaterial(dressSheet(M, polys, { light, mat, unitScale, mode }), mat)); continue; }
    const planes = M.material === 'timber' ? sidePlanes(M, timberFigure === 'flat' ? 'flat' : mode) : null;
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
    const pm = material === 'hardware' && p.finish === 'beech' ? MAT.timber : MAT[material];
    faces.push(...tagFacesWithMaterial(dressFaces({ ...p.host, species: p.species }, polys, { light, mat: pm, color, planes: null, unitScale, group: p.id }), pm));
  }
  // ── soft parts: fluffed, covered; the finished view leaves out what the padding hides, the frame view the padding
  const softSpecs = Array.isArray(spec.soft) ? spec.soft : [];
  const softIds = new Set(softSpecs.map((s) => s.id));
  const view = spec.view || 'finished';
  const softMat = resolveMaterial('cloth') || resolveMaterial('wood');
  const soft = softSpecs.map((s) => lowerSoft(s, { unitScale, light, mat: softMat, fabric: spec.fabric, railroad: spec.railroad === true, cellM: Number.isFinite(spec.softCell) ? spec.softCell * unitScale : 0.02, mode }));
  const ownerOf = new Map(); for (const L of soft) for (const g of L.extras) ownerOf.set(g, L.row.id);
  let hidden = [];
  if (softSpecs.length && view === 'finished') {
    const pads = soft.filter((L) => L.row.kind === 'pad').map((L) => L.frame);
    // inside the padding: every point of a 3 × 3 × 3 lattice over the member's box lies in some pad
    const inPad = (q) => pads.some((P) => [0, 1, 2].every((k) => q[k] >= P.lo[k] - 0.001 && q[k] <= P.hi[k] + 0.001));
    const inside = (b) => [0, 0.5, 1].every((fx) => [0, 0.5, 1].every((fy) => [0, 0.5, 1].every((fz) => inPad([b.lo[0] + fx * b.size[0], b.lo[1] + fy * b.size[1], b.lo[2] + fz * b.size[2]]))));
    const gone = new Set(members.filter((M) => inside(worldBox(M))).map((M) => M.id));
    // a fitting inside the padding goes with it when it was fitted there at the factory: seated first in a hidden part, or
    // joining only parts of the one section; a bolt the owner drives between two sections stays
    const needsOf = new Map(J.edges.filter((e) => e.piece).map((e) => [e.a, e.needs || []]));
    const groupOf = new Map(members.map((M) => [M.id, M.group]));
    for (const p of J.pieces) {
      if (!gone.has(p.host.id)) continue;
      const nd = needsOf.get(p.id) || [p.host.id];
      if (p.pre || nd.every((m) => gone.has(m) && groupOf.get(m) === groupOf.get(p.host.id))) gone.add(p.id);
    }
    hidden = members.map((M) => M.id).filter((id) => gone.has(id));
    if (gone.size) { const keep = faces.filter((f) => !gone.has(f.group)); faces.length = 0; faces.push(...keep); }
  }
  if (view !== 'frame') for (const L of soft) faces.push(...tagFacesWithMaterial(L.faces, softMat));

  // ── the report ──
  // supports: a level member is carried where a post (or another level member) meets it; braces are not counted
  const sin15 = Math.sin((15 * Math.PI) / 180);
  const carries = (O) => Math.abs(O.F.ex[2]) < sin15 || Math.abs(O.F.ex[2]) > Math.cos((15 * Math.PI) / 180);
  const supports = new Map(members.map((M) => [M.id, []]));
  for (const e of J.edges) {
    if (e.piece || e.bears === false) continue;
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
  const furniture = isFurniture(spec);
  const span = spanChecks(spanMembers, (id) => supports.get(id), { liveKNm: Number.isFinite(spec.load) ? spec.load : 0, ...(furniture ? { shelfKgM: Number.isFinite(spec.shelfLoad) ? spec.shelfLoad : 30 } : {}) });
  const drawn = J.pieces.filter((p) => p.polys || kernel);
  const drawnIds = new Set(drawn.map((p) => p.id));
  const ids = [...members.map((M) => M.id), ...drawn.map((p) => p.id), ...softSpecs.map((s) => s.id)];
  // a soft part goes in the way it rests: down onto what carries it, or back against it
  const REST = { down: [0, 0, -1], back: [0, 1, 0] };
  const softEdges = softSpecs.filter((s) => typeof s.on === 'string').map((s) => ({ a: s.id, b: s.on, dirs: [REST[s.rest || 'down']] }));
  const seatEdges = [...J.edges.filter((e) => !e.piece || drawnIds.has(e.a)), ...softEdges];
  // parts declared to be built together first (a drawer) go in as one; otherwise one member at a time
  const declared = new Map(); for (const M of [...members, ...softSpecs]) if (M.group) { if (!declared.has(M.group)) declared.set(M.group, []); declared.get(M.group).push(M.id); }
  const orderOpts = furniture ? { connected: true } : {};
  let assembly = declared.size ? (assemblyGroups(ids, seatEdges, declared, orderOpts) || assemblyOrder(ids, seatEdges, orderOpts)) : assemblyOrder(ids, seatEdges, orderOpts);
  // furniture that cannot go together one member at a time is built in sub-assemblies (a table's end frames)
  if (furniture && !assembly.order) { const t = assemblyTree(ids, seatEdges); if (t) assembly = { ...t, lock: null }; }
  // the kit: every part laid flat for printing a model of it, the bought fittings left out (they are not printed)
  let kit = null;
  if (spec.layout === 'kit') { const k = layKit(faces, members, drawn, unitScale, Number.isFinite(spec.kitGap) ? spec.kitGap : 5 / (unitScale * 1000), { soft, ownerOf }); faces.length = 0; faces.push(...k.faces); kit = k.report; }
  // the exploded view: each member back along the way it seats; a piece with its host, then out along its own way
  if (!kit && Number.isFinite(spec.explode) && spec.explode > 0) {
    const k = spec.explode; const off = new Map();
    // later members pull back further, so two that seat the same way (a splice's halves) still come apart
    let rank = 0;
    for (const id of assembly.order || members.map((M) => M.id)) {
      const v = (byId.has(id) || softIds.has(id)) && assembly.moves[id]; if (!v) continue;
      const kk = k * (1 + 0.5 * Math.min(4, rank++)); off.set(id, v.map((x) => -x * kk));
    }
    // a sub-assembly pulls back as one, along the way it joins the rest
    // (the one the rest join, first in the order, stays put)
    for (const sa of assembly.subassemblies || []) { if (softSpecs.length && assembly.order && sa.parts.includes(assembly.order[0])) continue; for (const id of sa.parts) { const o = off.get(id) || [0, 0, 0]; off.set(id, o.map((x, i) => x - sa.dir[i] * k * 2)); } }
    for (const p of drawn) {
      const h = off.get(p.host.id) || [0, 0, 0]; const v = assembly.moves[p.id] || [0, 0, 0];
      off.set(p.id, h.map((x, i) => x - v[i] * k * 1.2));
    }
    for (const f of faces) { const o = off.get(ownerOf.get(f.group) || f.group); if (o) f.corners = f.corners.map((c) => [c[0] + o[0], c[1] + o[1], c[2] + o[2]]); }
  }
  // the covers: the soft parts cut flat and laid on the roll, one layout for each cloth
  const covers = [], clothSpecs = [];
  if (softSpecs.length) {
    const byCloth = new Map();
    soft.forEach((L, i) => { const f = softSpecs[i].fabric !== undefined ? softSpecs[i].fabric : spec.fabric; const key = JSON.stringify(f === undefined ? 'linen' : f); if (!byCloth.has(key)) byCloth.set(key, { fabric: f, parts: [] }); byCloth.get(key).parts.push(L); });
    for (const { fabric, parts: ps } of byCloth.values()) { covers.push(coverLayout(ps, { fabric, railroad: spec.railroad === true })); clothSpecs.push(fabric === undefined ? 'linen' : fabric); }
  }
  const mm = (v) => Math.round(v * 1000);
  const report = {
    members: members.map((M) => {
      const common = { id: M.id, material: M.material, lengthMm: mm(M.xMax - M.xMin), ...(M.finish !== undefined ? { finish: M.finish } : {}), ...(M.group ? { group: M.group } : {}) };
      if (M.material === 'steel') { const p = sectionProps(M.section); return { ...common, section: M.section, grade: M.sec.grade, massKg: Math.round(p.mass * (M.xMax - M.xMin) * 10) / 10 }; }
      if (M.material === 'concrete') return { ...common, stockMm: [mm(M.W), mm(M.D)], ...(cages.has(M.id) ? { rebar: cages.get(M.id) } : { rebar: null }) };
      if (isSheet(M.material)) {
        const adv = thicknessAdvice(M.material, Math.round(M.D * 10000) / 10);
        return { ...common, stockMm: [mm(M.W), Math.round(M.D * 10000) / 10], ...(M.edges ? { edges: M.edges } : {}), ...(adv ? { advice: adv } : {}) };
      }
      return {
        ...common, species: M.species, stockMm: [mm(M.W), mm(M.D)], cut: M.pose.name,
        log: { age: M.log.age, ringMm: M.log.ringMm || TIMBERS[M.species].ringMm, knots: M.log.knots || 'normal' },
        movement: movement(M.species, M.pose, M.W, M.D),
      };
    }),
    joints: J.report,
    pieces: drawn.map((p) => ({ id: p.id, kind: p.kind, ...(p.species && !p.material ? { species: p.species } : { material: p.material }) })),
    ...(spec.built ? { build: { type: spec0.build.type, dials: spec.built.dials, expanded: { members: spec.built.members, joints: spec.built.joints } } } : {}),
    span, assembly: { order: assembly.order, lock: assembly.lock, ...(assembly.subassemblies && assembly.subassemblies.length ? { subassemblies: assembly.subassemblies.map((sa) => ({ parts: sa.parts, dir: sa.dir.map((v) => Math.round(v * 1000) / 1000), ...(sa.group ? { group: sa.group } : {}) })) } : {}) },
    ...(softSpecs.length ? { soft: soft.map((L) => L.row), fabric: fabricSummary(resolveFabric(spec.fabric !== undefined ? spec.fabric : 'linen')), covers: covers.map(coverSummary), ...(hidden.length ? { hidden } : {}), ...(view !== 'finished' ? { view } : {}) } : {}),
    ...(furniture ? { furniture: furnitureReport({ spec, members, byId, joints: J, drawn, assembly, soft }) } : {}),
    ...(kit ? { kit } : {}),
    ...(jointedWithoutKernel(members, kernel) ? { degraded: 'joints are not cut and steel sections are not shaped: the exact kernel (manifold-3d) is not installed, so members draw as plain boxes' } : {}),
  };
  // beside the report (so a report's bytes do not move): the way each part seats, and the loose pieces as placed — what
  // an instruction manual (manual.js) sequences and draws
  const parts = drawn.map((p) => {
    const e = J.edges.find((x) => x.piece && x.a === p.id);
    return { id: p.id, kind: p.kind, host: p.host.id, ...(p.code ? { code: p.code } : {}), ...(p.pre ? { pre: p.pre } : {}), needs: e && e.needs ? e.needs : [p.host.id] };
  });
  return { faces, report, seat: assembly.moves, parts, ...(covers.length ? { covers, clothSpecs } : {}), ...(Array.isArray(spec.supplied) ? { supplied: spec.supplied } : {}), ...(softSpecs.length ? { soft: soft.map((L) => ({ id: L.row.id, extras: L.extras, lightness: L.fabric.lightness, frame: L.frame, pleats: L.pleats, ...(L.row.kind ? { kind: L.row.kind } : {}), ...(softSpecs.find((s) => s.id === L.row.id).group ? { group: softSpecs.find((s) => s.id === L.row.id).group } : {}) })) } : {}) };
}

/**
 * Lay a frame's parts out flat as a print kit: each member and each timber piece (peg, wedge, key) turned so its
 * thinnest side stands up and its longest runs along x, then placed in rows on the floor `gap` apart, rows about as
 * wide as the kit is deep. Fittings made of metal or plastic are left out: a model is
 * glued, and a real piece's fittings are bought. → { faces, report: { parts, sizeMm } } in the recipe's unit.
 */
function layKit(faces, members, drawn, unitScale, gap, { soft = [], ownerOf = new Map() } = {}) {
  const byGroup = new Map(); for (const f of faces) { const g = ownerOf.get(f.group) || f.group; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(f); }
  const frameOf = new Map(members.map((M) => [M.id, M]));
  for (const p of drawn) if (!p.material || p.material === 'timber') frameOf.set(p.id, p.host);
  // a soft part lies in its own frame (its cord and buttons with it)
  for (const L of soft) frameOf.set(L.row.id, { F: { origin: L.frame.c, ex: L.frame.axes[0], ey: L.frame.axes[1], ez: L.frame.axes[2] } });
  const inv = 1 / unitScale;
  const items = [];
  for (const [g, fs] of byGroup) {
    const M = frameOf.get(g); if (!M) continue;
    // corners in the part's own frame (its host's, for a piece), in the recipe's unit
    const local = fs.map((f) => f.corners.map((c) => toLocalFrame(M.F, c.map((v) => v * unitScale)).map((v) => v * inv)));
    const lo = [0, 1, 2].map((k) => Math.min(...local.flat().map((c) => c[k]))), hi = [0, 1, 2].map((k) => Math.max(...local.flat().map((c) => c[k])));
    const size = lo.map((v, k) => hi[k] - v);
    const order = [0, 1, 2].sort((a, b) => size[b] - size[a] || a - b);   // longest → x, middle → y, thinnest → z
    const flip = ((order[0] + 1) % 3 === order[1]) ? 1 : -1;            // keep the mapping a rotation, not a mirror
    items.push({ g, fs, local, lo, size, order, flip });
  }
  items.sort((a, b) => b.size[b.order[1]] - a.size[a.order[1]] || (a.g < b.g ? -1 : 1));
  // rows about as wide as the kit is deep: the longest part, or the side of a square holding them all
  const rowMax = Math.max(...items.map((it) => it.size[it.order[0]]), 1.2 * Math.sqrt(items.reduce((s, it) => s + it.size[it.order[0]] * (it.size[it.order[1]] + gap), 0)));
  let x = 0, y = 0, rowH = 0; const out = [], parts = [];
  for (const it of items) {
    const [ax, ay, az] = it.order; const L = it.size[ax], Wd = it.size[ay];
    if (x > 0 && x + L > rowMax) { x = 0; y += rowH + gap; rowH = 0; }
    const map = (c) => [x + (c[ax] - it.lo[ax]), y + (it.flip > 0 ? c[ay] - it.lo[ay] : it.lo[ay] + it.size[ay] - c[ay]), c[az] - it.lo[az]];
    it.fs.forEach((f, i) => out.push({ ...f, corners: it.local[i].map(map) }));
    parts.push({ id: it.g, atMm: [x, y].map((v) => Math.round(v * unitScale * 1000)), sizeMm: [L, Wd, it.size[az]].map((v) => Math.round(v * unitScale * 1000)) });
    x += L + gap; rowH = Math.max(rowH, Wd);
  }
  const X = Math.max(...parts.map((p) => p.atMm[0] + p.sizeMm[0])), Y = Math.max(...parts.map((p) => p.atMm[1] + p.sizeMm[1]));
  return { faces: out, report: { parts, sizeMm: [X, Y], left: drawn.filter((p) => p.material && p.material !== 'timber').length } };
}
const toLocalFrame = (F, w) => { const q = [w[0] - F.origin[0], w[1] - F.origin[1], w[2] - F.origin[2]]; return [dot(q, F.ex), dot(q, F.ey), dot(q, F.ez)]; };

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
    if (s.shelfKgM !== undefined) { out.push(`${label}: ${s.member} sags ${s.instantMm} mm over its ${s.spanMm} mm span under ${s.shelfKgM} kg/m (keep under ${s.instantLimitMm}, span/600), and ${s.deflMm} mm as it creeps (×${s.creep}; keep under ${s.limitMm}, span/300) — thicker stock, a shorter span, a stiffening rail, or a middle support`); continue; }
    const strength = s.capacityKNm !== undefined ? `carries ${s.momentKNm} kN·m against a capacity of ${s.capacityKNm}` : `is stressed to ${s.stressMPa} of a rough ${s.allowMPa} MPa`;
    out.push(`${label}: ${s.member} (${s.kind} ${s.spanMm} mm) deflects ${s.deflMm} mm against a ${s.limitMm} mm limit and ${strength} — deepen it, shorten the span, or add a support (advisory arithmetic, braces not counted)`);
  }
  for (const j of report.joints) if (j.relishOk === false) out.push(`${label}: joint ${j.joint} leaves ${j.relishMm} mm of relish past its peg (keep at least two peg diameters) — a deeper tenon or a peg nearer the shoulder`);
  const a = report.assembly;
  const placedMembers = a.lock ? a.lock.after.filter((id) => report.members.some((m) => m.id === id)) : [];
  if (!a.order && a.lock) out.push(`${label}: no order seats every joint by sliding — ${a.lock.member} would have to move in directions ${a.lock.spreadDeg}° apart (after ${placedMembers.join(', ') || 'nothing'}). A framer seats this by flexing the frame together; a kigumi frame is shaped so it slides.`);
  if (report.degraded) out.push(`${label}: ${report.degraded}`);
  for (const m of report.members) if (m.advice) out.push(`${label}: ${m.id}: ${m.advice}`);
  if (report.furniture) out.push(...furnitureStamps(report.furniture, label));
  const seatIds = new Set((report.soft || []).filter((r) => r.sinkMm !== undefined).map((r) => r.id));
  for (const c of report.covers || []) out.push(...coverStamps(c, label, { seats: c.parts.some((id) => seatIds.has(id)) }));
  return out;
}
