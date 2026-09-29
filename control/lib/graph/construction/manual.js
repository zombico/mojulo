// construction/manual — a frame writes its own instruction manual: black line art on white A4 pages, wordless, the
// way a flat-pack manual is.
//
// The plan (manualPlan) comes from what the frame already knows:
//   · the order its members seat in (checks.js assemblyOrder, or assemblyTree's sub-assemblies) and the direction
//     each one moves to seat (`seat`);
//   · its loose pieces: fittings that go into one part BEFORE assembly (dowels, cams, cam bolts, shelf pins: `pre`)
//     become "fit" steps, one per kind of part (×2 when two identical parts take the same fittings); screws, pegs and
//     wedges go in on the step where the last part they cross arrives; a cam is turned on the step its joint closes;
//   · identical parts share a number (the two sides are both part 1, ×2), hardware is lettered in the order it is
//     first used, and a piece that tips (the furniture check) ends with a step fixing it to the wall.
// The pages (manualPages) draw each step through the hidden-line renderer (scene/wire-svg.js wireRuns) from one
// near-orthographic three-quarter view, parts already placed at rest and this step's parts pulled back along the way
// they go in, with dashed motion lines, numbered and lettered callouts, and a turn arrow on every cam to tighten. The
// inventory page draws every fitting at TRUE SCALE (1:1 on A4, with a 10 mm check bar) so a builder can lay a screw on
// the page to tell a 30 from a 35. Only numerals, part numbers, letters and counts are written; the title is the frame's
// id. Pure: same frame, same pages.
//
// Soft parts (soft.js): a cushion is a part like any other, numbered, and goes in the way it rests (the cushions last);
// a group the frame says arrives made (`supplied`: an upholstered sofa's base, arms and back) is ONE part — its insides
// are not built on the page, and the fittings fitted at the factory are not in the inventory. Soft forms are drawn
// with their silhouettes and seams and shaded in cross-contour hatching (scene/hatch-lines.js), their tufting's pleats
// as lines. A frame with soft parts ends with its cloth: a swatch at true size in one ink, the weave's draft magnified,
// and the cutting layout on the roll (covers.js).
import { lowerFrame, FRAME_UNITS } from './frame.js';
import { hardwarePart, toolOf } from './hardware.js';
import { weldFaces, wireRuns, projectVertices, triangleGrid, visibleAt } from '../scene/wire-svg.js';
import { hatchRuns, hatchPath } from '../scene/hatch-lines.js';
import { fabricSvg } from './fabric.js';
import { coverPages } from './covers.js';

const PAGE = { w: 210, h: 297 };                    // A4, mm
const INK = '#000';
const WEIGHT = { outline: 0.45, feature: 0.32, plane: 0.18 };
const r2 = (v) => Math.round(v * 100) / 100;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

/** Bounds of a face list → { lo, hi, c, diag }. */
function bounds(faces) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; }
  return { lo, hi, c: lo.map((v, k) => (v + hi[k]) / 2), diag: Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) };
}

/**
 * manualPlan(spec) → { id, steps, parts, hardware, tools, low } — the steps a builder follows, numbered from 1.
 * step: { n, kind: 'fit' | 'join' | 'anchor', hosts?, times?, base, adds, dir?, pieces, turns, sub? }.
 */
export function manualPlan(spec) {
  const low = lowerFrame(spec);
  const { report, seat, parts } = low;
  const byId = new Map(report.members.map((m) => [m.id, m]));
  // a soft part is a part: numbered by its kind and size
  const softGroup = new Map((low.soft || []).map((L) => [L.id, L.group]));
  for (const r of report.soft || []) byId.set(r.id, { id: r.id, material: 'soft', kind: r.kind, lengthMm: r.sizeMm[0], stockMm: r.sizeMm.slice(1), ...(softGroup.get(r.id) ? { group: softGroup.get(r.id) } : {}) });
  const order = (report.assembly.order || report.members.map((m) => m.id)).filter((id) => byId.has(id));
  // a supplied group (an upholstered section) is one part; what was fitted in it at the factory is not the builder's
  const supplied = new Set(low.supplied || []);
  const sectionOf = new Map([...byId.values()].filter((m) => m.group && supplied.has(m.group)).map((m) => [m.id, m.group]));
  const factory = (p) => (p.pre && sectionOf.has(p.pre)) || (p.needs.length > 0 && p.needs.every((m) => sectionOf.has(m) && sectionOf.get(m) === sectionOf.get(p.needs[0])));
  const sectionIds = (g) => order.filter((id) => sectionOf.get(id) === g);
  const sectionDims = (g) => { const b = bounds(low.faces.filter((f) => sectionIds(g).includes(f.group) || sectionIds(g).includes(String(f.group).split(':')[0]))); return b.hi.map((v, k) => Math.round((v - b.lo[k]) * FRAME_UNITS[spec.unit || 'cm'] * 1000)).sort((a, c) => c - a); };
  // identical parts share a number: same material, section and length
  const keyOf = (m) => JSON.stringify([m.material, m.species || '', m.section || '', m.stockMm || '', m.lengthMm]);
  const numberOf = new Map(); const numbers = new Map(); const sectionKey = new Map();
  for (const id of order) {
    const g = sectionOf.get(id);
    if (g && !sectionKey.has(g)) sectionKey.set(g, JSON.stringify(['section', sectionDims(g)]));
    const k = g ? sectionKey.get(g) : keyOf(byId.get(id));
    if (!numbers.has(k)) numbers.set(k, numbers.size + 1); numberOf.set(id, numbers.get(k));
  }
  const jointOf = (pid) => pid.slice(0, pid.lastIndexOf(':'));
  const joints = new Map(report.joints.map((j) => [j.joint, j]));
  const steps = [];
  // ── fit: fittings seated in a part before it joins, one step per part kind
  const pre = parts.filter((p) => p.pre && p.code && !factory(p));
  const fitted = new Map();
  for (const id of order) {
    const ps = pre.filter((p) => p.pre === id); if (!ps.length) continue;
    const sig = `${numberOf.get(id)}|${ps.map((p) => p.code).sort().join(',')}`;
    if (fitted.has(sig)) fitted.get(sig).hosts.push(id);
    else { const s = { kind: 'fit', hosts: [id], pieces: ps.map((p) => p.id) }; fitted.set(sig, s); steps.push(s); }
  }
  for (const s of steps) s.times = s.hosts.length;
  // ── join: parts arrive in order; a sub-assembly is built on its own, then joins as one
  const placed = new Set(); const done = new Set([...pre.map((p) => p.id), ...parts.filter(factory).map((p) => p.id)]); const turned = new Set();
  const loose = parts.filter((p) => !p.pre);
  const ready = (have) => loose.filter((p) => !done.has(p.id) && p.needs.every((m) => have.has(m)));
  const camsReady = (have) => parts.filter((p) => p.kind === 'cam' && !turned.has(p.id) && (() => { const j = joints.get(jointOf(p.id)); return j && have.has(j.a) && have.has(j.b); })());
  const subs = report.assembly.subassemblies || [];
  const subOf = new Map(); subs.forEach((sa, i) => sa.parts.forEach((id) => subOf.set(id, i)));
  const join = (base, adds, dir, extra = {}) => {
    const have = new Set([...base, ...adds]);
    const ps = ready(have); ps.forEach((p) => done.add(p.id));
    const ts = camsReady(have); ts.forEach((p) => turned.add(p.id));
    steps.push({ kind: 'join', base: [...base], adds, dir, pieces: ps.map((p) => p.id), turns: ts.map((p) => p.id), ...extra });
  };
  // identical sub-assemblies (four drawers) are built once, ×N; each still joins the rest
  const subSig = (sa) => sa.parts.map((m) => numberOf.get(m)).join(',');
  const subCount = new Map(); for (const sa of subs) subCount.set(subSig(sa), (subCount.get(subSig(sa)) || 0) + 1);
  const subBuilt = new Set(subs.filter((sa) => sa.group && supplied.has(sa.group)).map(subSig));
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    // a supplied section first: it stands, whole
    if (!placed.size && subOf.has(id) && supplied.has(subs[subOf.get(id)].group)) { const sa = subs[subOf.get(id)]; sa.parts.forEach((m) => placed.add(m)); i += sa.parts.length - 1; continue; }
    if (!placed.size) { placed.add(id); continue; }
    if (subOf.has(id)) {
      const sa = subs[subOf.get(id)]; const sig = subSig(sa);
      const inSub = new Set([sa.parts[0]]);
      for (const m of sa.parts.slice(1)) {
        if (subBuilt.has(sig)) { ready(new Set([...inSub, m])).forEach((p) => done.add(p.id)); inSub.add(m); continue; }
        join([...inSub], [m], seat[m], { sub: subOf.get(id), times: subCount.get(sig) }); inSub.add(m);
      }
      subBuilt.add(sig);
      join([...placed], sa.parts, sa.dir, { group: true, groupSig: sig });
      sa.parts.forEach((m) => placed.add(m)); i += sa.parts.length - 1; continue;
    }
    // a part joined to nothing placed yet (a second post) just stands: it appears at rest in the next step
    if (!seat[id]) { placed.add(id); continue; }
    join([...placed], [id], seat[id]); placed.add(id);
  }
  // consecutive single joins moving the same way onto what was already there merge (up to three parts a step)
  const merged = [];
  for (const s of steps) {
    const last = merged[merged.length - 1];
    // identical sub-assemblies going in the same way go in on one step (the drawers slide in together)
    if (last && s.group && last.group && last.groupSig === s.groupSig && dirEq(last.dir, s.dir)) {
      last.adds.push(...s.adds); last.pieces.push(...s.pieces); last.turns.push(...s.turns); last.times = (last.times || 1) + 1; continue;
    }
    const same = last && last.kind === 'join' && s.kind === 'join' && !last.group && !s.group && last.sub === s.sub && last.dir && s.dir && last.adds.length < 3
      && Math.abs(last.dir[0] * s.dir[0] + last.dir[1] * s.dir[1] + last.dir[2] * s.dir[2] - 1) < 1e-6
      && s.base.every((m) => last.base.includes(m) || last.adds.includes(m)) && !s.adds.some((m) => joinsAny(report, m, last.adds));
    if (same) { last.adds.push(...s.adds); last.pieces.push(...s.pieces); last.turns.push(...s.turns); }
    else merged.push({ ...s, adds: s.adds ? [...s.adds] : undefined, pieces: [...s.pieces], turns: [...(s.turns || [])] });
  }
  const tip = report.furniture && report.furniture.tip;
  if (tip && ((tip.pull && tip.pull.tips) || (tip.drawers && tip.drawers.tips))) merged.push({ kind: 'anchor', pieces: [], turns: [] });
  merged.forEach((s, i) => { s.n = i + 1; });
  // hardware letters in order of first use: catalog fittings by code, a joint's own loose pieces (pegs, wedges, keys,
  // plates) by kind — drawn from their geometry on the inventory, since they have no catalog size
  const codeOf = new Map(parts.map((p) => [p.id, p.code || `piece:${p.kind}`]));
  const letters = new Map();
  for (const s of merged) for (const pid of s.pieces) { const c = codeOf.get(pid); if (c && !letters.has(c)) letters.set(c, String.fromCharCode(65 + letters.size)); }
  const count = new Map(), sample = new Map(); for (const p of parts) { if (factory(p)) continue; const c = codeOf.get(p.id); count.set(c, (count.get(c) || 0) + 1); if (!sample.has(c)) sample.set(c, p.id); }
  const hardware = [...letters.entries()].map(([code, letter]) => ({ letter, code, label: code.startsWith('piece:') ? code.slice(6) : hardwarePart(code).label, count: count.get(code), sample: sample.get(code) }));
  const partsList = [...numbers.entries()].map(([k, n]) => {
    const ids = order.filter((id) => numberOf.get(id) === n); const m = byId.get(ids[0]);
    const g = sectionOf.get(ids[0]);
    if (g) { const groups = [...new Set(ids.map((id) => sectionOf.get(id)))]; return { n, ids: groups, count: groups.length, material: 'section', dimsMm: sectionDims(g), draw: sectionIds(g) }; }
    return { n, ids, count: ids.length, material: m.material, dimsMm: [m.lengthMm, ...(m.stockMm || [])] };
  });
  const TIMBER_PIECES = ['peg', 'komisen', 'kusabi', 'shachi'];
  const tools = [...new Map([...hardware.map((h) => toolOf(hardwarePart(h.code))), ...(hardware.some((h) => TIMBER_PIECES.includes(h.label)) ? [{ key: 'hammer', label: 'hammer' }] : [])].filter(Boolean).map((t) => [t.key, t])).values()];
  // how soft forms are inked: their groups (and their cord and buttons) as soft, the parts themselves hatched
  const ink = low.soft && low.soft.length ? {
    softGroups: new Set(low.soft.flatMap((L) => [L.id, ...L.extras])),
    hatch: new Map(low.soft.map((L) => [L.id, { axes: L.frame.axes, lightness: L.lightness }])),
    pleats: low.soft.flatMap((L) => L.pleats.map(([a, b]) => ({ id: L.id, a: a.map((v) => v / (FRAME_UNITS[spec.unit || 'cm'])), b: b.map((v) => v / (FRAME_UNITS[spec.unit || 'cm'])) }))),
  } : null;
  return { id: spec.id || 'frame', unit: spec.unit || 'cm', steps: merged, parts: partsList, numberOf, hardware, letters, codeOf, tools, low, ...(ink ? { ink, sectionOf } : {}) };
}
const dirEq = (a, b) => a && b && Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] - 1) < 1e-6;
const joinsAny = (report, m, others) => report.joints.some((j) => (j.a === m && others.includes(j.b)) || (j.b === m && others.includes(j.a)));

// ── drawing ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A near-orthographic three-quarter camera fitted to `pts` inside a page box { x, y, w, h } (mm). */
function fitCamera(pts, box, { az = -35, el = 28 } = {}) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
  const c = lo.map((v, k) => (v + hi[k]) / 2); const rad = Math.max(1e-6, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2);
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, dist = 60 * rad;
  const position = [c[0] + dist * Math.cos(e) * Math.sin(a), c[1] - dist * Math.cos(e) * Math.cos(a), c[2] + dist * Math.sin(e)];
  const R = [[Math.cos(a), Math.sin(a), 0], [Math.sin(e) * Math.sin(a), -Math.sin(e) * Math.cos(a), -Math.cos(e)], [-Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), -Math.sin(e)]];
  const probe = projectVertices(pts, { position, R, f: 1, principal: [0, 0] });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of probe) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const w = x1 - x0 || 1e-9, h = y1 - y0 || 1e-9;
  const f = Math.min(box.w / w, box.h / h);
  const principal = [box.x + box.w / 2 - f * (x1 + x0) / 2, box.y + box.h / 2 - f * (y1 + y0) / 2];
  return { position, R, f, principal, size: PAGE.w };
}

/**
 * Hidden-line strokes of a face list through cam → SVG path elements (black, weighted by role). With `ink` (a frame
 * with soft parts): soft forms keep only their silhouettes and seams, are hatched, and their pleats drawn.
 */
function inkRuns(faces, cam, ink = null) {
  if (!faces.length) return '';
  const src = weldFaces(faces);
  const runs = wireRuns(src, cam, { creaseDegrees: 20, ...(ink ? { softGroups: ink.softGroups } : {}) });
  const by = { outline: [], feature: [], plane: [] };
  for (const r of runs) if (r.visible) by[r.type].push(`M${r2(r.xy[0][0])} ${r2(r.xy[0][1])}L${r2(r.xy[1][0])} ${r2(r.xy[1][1])}`);
  let out = '';
  if (ink) {
    const present = new Set(faces.map((f) => f.group));
    const groups = new Map([...ink.hatch].filter(([id]) => present.has(id)));
    // the hatch: slices of each soft form, where it turns from the light
    if (groups.size) {
      const b = bounds(faces); const depth = Math.abs((b.c[0] - cam.position[0]) * cam.R[2][0] + (b.c[1] - cam.position[1]) * cam.R[2][1] + (b.c[2] - cam.position[2]) * cam.R[2][2]);
      const pagePerUnit = cam.f / depth, sizeOnPage = b.diag * pagePerUnit;
      out += hatchPath(hatchRuns(src, cam, { groups, spacing: Math.max(0.55, Math.min(1.1, sizeOnPage / 160)), wobble: 0.08, tol: 0.08 }), { width: 0.12 });
    }
    // the pleats between buttons, where they show
    const pl = ink.pleats.filter((p) => present.has(p.id));
    if (pl.length) {
      const q = projectVertices(src.vertices, cam); const grid = triangleGrid(src.faces.map((f) => [q[f[0]], q[f[1]], q[f[2]]]));
      const lines = [];
      // the pleat's line sits in its crease: nudge it toward the viewer so the crease does not hide it
      const toCam = cam.R[2].map((v) => -v); const nudge = bounds(faces).diag * 0.004;
      for (const p of pl) {
        const pts = Array.from({ length: 13 }, (_, i) => [0, 1, 2].map((k) => p.a[k] + ((p.b[k] - p.a[k]) * i) / 12 + toCam[k] * nudge));
        let run = [];
        for (const w of projectVertices(pts, cam)) { if (visibleAt(w[0], w[1], w[2], grid.at(w[0], w[1]))) run.push(w); else { if (run.length > 1) lines.push(run); run = []; } }
        if (run.length > 1) lines.push(run);
      }
      if (lines.length) out += `<path d="${lines.map((l) => `M${l.map((w) => `${r2(w[0])} ${r2(w[1])}`).join('L')}`).join('')}" fill="none" stroke="${INK}" stroke-width="${WEIGHT.feature}" stroke-linecap="round"/>`;
    }
  }
  return ['plane', 'feature', 'outline'].map((t) => (by[t].length ? `<path d="${by[t].join('')}" fill="none" stroke="${INK}" stroke-width="${WEIGHT[t]}" stroke-linecap="round"/>` : '')).join('') + out;
}

const P = (cam, p) => { const q = projectVertices([p], cam)[0]; return [q[0], q[1]]; };
const circle = (x, y, r, label, { size = 4.2, fill = '#fff', sw = 0.35 } = {}) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${sw}"/><text x="${r2(x)}" y="${r2(y + size * 0.36)}" font-size="${size}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700">${label}</text>`;
const leader = (a, b) => `<line x1="${r2(a[0])}" y1="${r2(a[1])}" x2="${r2(b[0])}" y2="${r2(b[1])}" stroke="${INK}" stroke-width="0.25"/>`;
const text = (x, y, s, size = 4, anchor = 'start', weight = 400) => `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" text-anchor="${anchor}" font-family="Helvetica, Arial, sans-serif" font-weight="${weight}">${s}</text>`;
const page = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.w}mm" height="${PAGE.h}mm" viewBox="0 0 ${PAGE.w} ${PAGE.h}"><rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>${body}</svg>`;
const turnArrow = (x, y) => `<path d="M${r2(x - 3)} ${r2(y - 1)}A3.2 3.2 0 1 1 ${r2(x + 1)} ${r2(y + 3)}" fill="none" stroke="${INK}" stroke-width="0.45"/><path d="M${r2(x + 1)} ${r2(y + 3)}l-1.8 -0.4l1.2 -1.6z" fill="${INK}"/>`;

/** Faces grouped by part. */
function groupsOf(faces) { const g = new Map(); for (const f of faces) { if (!g.has(f.group)) g.set(f.group, []); g.get(f.group).push(f); } return g; }
const moved = (faces, off) => faces.map((f) => ({ ...f, corners: f.corners.map((c) => add(c, off)) }));

/** One step's page. */
function stepPage(plan, s, groups, wholeCam, mmPerUnit) {
  const { seat, parts } = plan.low;
  const partById = new Map(parts.map((p) => [p.id, p]));
  const draw = []; const motions = []; const tags = [];
  const pull = (ids) => { const b = bounds(ids.flatMap((id) => groups.get(id) || [])); return Math.max(60 / mmPerUnit, Math.min(400 / mmPerUnit, 0.28 * b.diag)); };
  const hwPull = (pid) => { const p = hardwarePart(partById.get(pid).code || ''); return ((p ? Math.max(p.length || p.leg || 0, 12) : 20) * 2.2) / mmPerUnit; };
  const preOf = (id) => parts.filter((p) => p.pre === id).map((p) => p.id);
  const placedPieces = new Set(); // loose pieces from earlier steps
  for (const t of plan.steps) { if (t === s) break; for (const pid of t.pieces || []) if (!partById.get(pid).pre) placedPieces.add(pid); }
  let cam = wholeCam;
  if (s.kind === 'fit') {
    const host = s.hosts[0];
    draw.push(...(groups.get(host) || []));
    for (const pid of s.pieces) {
      const d = scl(seat[pid] || [0, 0, 1], -hwPull(pid));
      draw.push(...moved(groups.get(pid) || [], d));
      const b = bounds(groups.get(pid) || []); motions.push([add(b.c, d), b.c]);
    }
    cam = fitCamera(draw.flatMap((f) => f.corners), { x: 20, y: 60, w: 170, h: 200 });
    const hb = bounds(groups.get(host));
    tags.push({ kind: 'part', n: plan.numberOf.get(host), at: hb.c, times: s.times });
  } else if (s.kind === 'join') {
    const baseSet = new Set(s.base), adds = s.adds || [];
    for (const id of s.base) { draw.push(...(groups.get(id) || [])); for (const pid of preOf(id)) draw.push(...(groups.get(pid) || [])); if (plan.ink) for (const [g, fs] of groups) if (String(g).startsWith(`${id}:`) && plan.ink.softGroups.has(g)) draw.push(...fs); }
    for (const pid of placedPieces) { const p = partById.get(pid); if (p.needs.every((m) => baseSet.has(m))) draw.push(...(groups.get(pid) || [])); }
    // a sub-assembly going in as one (a drawer) gets one motion line and no numbers: it was built on the pages before
    const off = scl(s.dir || [0, 0, 1], -(s.group ? pull(adds.slice(0, Math.max(1, adds.length / (s.times || 1)))) : pull(adds)));
    for (const id of adds) {
      draw.push(...moved(groups.get(id) || [], off)); for (const pid of preOf(id)) draw.push(...moved(groups.get(pid) || [], off));
      for (const [g, fs] of groups) if (plan.ink && String(g).startsWith(`${id}:`) && plan.ink.softGroups.has(g)) draw.push(...moved(fs, off));   // a cushion's cord and buttons
      if (s.group) continue;
      const b = bounds(groups.get(id)); motions.push([add(b.c, off), b.c]);
      tags.push({ kind: 'part', n: plan.numberOf.get(id), at: add(b.c, off), ...(s.sub !== undefined && s.times > 1 && id === adds[0] ? { times: s.times } : {}) });
    }
    if (s.group) {
      const per = adds.length / (s.times || 1);
      for (let g = 0; g < (s.times || 1); g++) {
        const b = bounds(adds.slice(g * per, (g + 1) * per).flatMap((id) => groups.get(id) || [])); motions.push([add(b.c, off), b.c]);
        // a section that arrived made has not been seen being built: it carries its number
        if (plan.sectionOf && plan.sectionOf.has(adds[g * per])) tags.push({ kind: 'part', n: plan.numberOf.get(adds[g * per]), at: add(b.c, off) });
      }
    }
    for (const pid of s.pieces) {
      const p = partById.get(pid); const hostOff = adds.includes(p.host) ? off : [0, 0, 0];
      const d = add(hostOff, scl(seat[pid] || [0, 0, 1], -hwPull(pid)));
      draw.push(...moved(groups.get(pid) || [], d));
      const b = bounds(groups.get(pid) || []); motions.push([add(b.c, d), add(b.c, hostOff)]);
    }
    for (const pid of s.turns) { const b = bounds(groups.get(pid) || []); const hostOff = adds.includes(partById.get(pid).host) ? off : [0, 0, 0]; tags.push({ kind: 'turn', at: add(b.c, hostOff) }); }
  } else {
    for (const g of groups.values()) draw.push(...g);
  }
  // a sub-assembly built on its own is framed on itself, not where it will end up in the piece
  if (s.kind === 'join' && s.sub !== undefined && draw.length) cam = fitCamera(draw.flatMap((f) => f.corners), { x: 20, y: 60, w: 170, h: 200 });
  // ── ink
  let body = inkRuns(draw, cam, plan.ink);
  body += motions.map(([a, b]) => { const p = P(cam, a), q = P(cam, b); return `<line x1="${r2(p[0])}" y1="${r2(p[1])}" x2="${r2(q[0])}" y2="${r2(q[1])}" stroke="${INK}" stroke-width="0.25" stroke-dasharray="1.6 1.2"/>`; }).join('');
  const centre = P(cam, bounds(draw).c);
  for (const t of tags) {
    const q = P(cam, t.at);
    if (t.kind === 'turn') { body += turnArrow(q[0], q[1]); continue; }
    const dx = q[0] - centre[0], dy = q[1] - centre[1], l = Math.hypot(dx, dy) || 1;
    const at = [q[0] + (dx / l) * 16, q[1] + (dy / l) * 16 - 4];
    body += leader(q, at) + circle(at[0], at[1], 4.2, t.n, { size: 4.6 });
    if (t.times > 1) body += text(at[0] + 6, at[1] + 1.8, `×${t.times}`, 5, 'start', 700);
  }
  // the step number, and the hardware this step uses (letter, count)
  body += text(14, 30, String(s.n), 22, 'start', 700);
  const used = new Map();
  for (const pid of s.pieces) { const c = plan.codeOf.get(pid); if (c) used.set(c, (used.get(c) || 0) + 1); }
  if (s.kind === 'fit' || (s.sub !== undefined && s.times > 1)) for (const [c, k] of used) used.set(c, k * s.times);
  let x = 196;
  for (const [code, k] of [...used.entries()].reverse()) {
    x -= 26; body += `<rect x="${x}" y="12" width="24" height="18" fill="none" stroke="${INK}" stroke-width="0.3" rx="1.5"/>` + circle(x + 6, 21, 3.4, plan.letters.get(code), { size: 3.8 }) + text(x + 11.5, 22.6, `×${k}`, 4.2, 'start', 700);
  }
  if (s.turns.length) { body += turnArrow(x - 8, 21); }
  if (s.kind === 'anchor') body += anchorGlyph(170, 70);
  // a detail bubble: the first fitting of the step, magnified, lettered
  // the fitting that shows best: the one standing out toward the camera (a pin in the far side, not the near one)
  const toCam = (() => { const f = cam.R[2]; return [-f[0], -f[1], -f[2]]; })();
  const lettered = s.pieces.filter((pid) => plan.codeOf.get(pid));
  const facing = (pid) => { const v = plan.low.seat[pid] || [0, 0, 1]; return -(v[0] * toCam[0] + v[1] * toCam[1] + v[2] * toCam[2]); };
  const focus = lettered.reduce((best, pid) => (best === undefined || facing(pid) > facing(best) + 1e-9 ? pid : best), undefined);
  if (focus && (s.kind === 'fit' || s.kind === 'join')) body += detailBubble(plan, s, focus, draw, cam, groups);
  return page(body);
}

/** A magnified circle on one fitting and what surrounds it, with a leader back to where it sits in the drawing. */
function detailBubble(plan, s, focus, draw, cam, groups) {
  const fb = bounds(draw.filter((f) => f.group === focus));
  const code = plan.codeOf.get(focus);
  const r = Math.max(fb.diag * 1.4, 1e-6);
  const near = draw.filter((f) => f.corners.some((c) => Math.hypot(c[0] - fb.c[0], c[1] - fb.c[1], c[2] - fb.c[2]) < 3 * r));
  const B = { cx: 158, cy: 222, R: 30 };
  const dcam = fitCamera([sub3(fb.c, [r, r, r]), add(fb.c, [r, r, r])], { x: B.cx - B.R, y: B.cy - B.R, w: 2 * B.R, h: 2 * B.R });
  const id = `d${s.n}`;
  const at = P(cam, fb.c);
  let out = `<clipPath id="${id}"><circle cx="${B.cx}" cy="${B.cy}" r="${B.R}"/></clipPath><circle cx="${B.cx}" cy="${B.cy}" r="${B.R}" fill="#fff" stroke="none"/>`;
  out += `<g clip-path="url(#${id})">${inkRuns(near, dcam, plan.ink)}</g><circle cx="${B.cx}" cy="${B.cy}" r="${B.R}" fill="none" stroke="${INK}" stroke-width="0.5"/>`;
  out += `<circle cx="${r2(at[0])}" cy="${r2(at[1])}" r="2.2" fill="none" stroke="${INK}" stroke-width="0.3"/>` + leader(at, [B.cx - B.R * 0.7, B.cy - B.R * 0.7]);
  const q = P(dcam, fb.c);
  out += leader(q, [B.cx + B.R * 0.55, B.cy - B.R * 0.55]) + circle(B.cx + B.R * 0.62, B.cy - B.R * 0.62, 3.4, plan.letters.get(code), { size: 3.8 });
  return out;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** The wall-anchor mark: a wall, a strap and a screw into it, and a warning triangle. */
function anchorGlyph(x, y) {
  return `<g stroke="${INK}" fill="none" stroke-width="0.45"><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 40}"/>${[0, 8, 16, 24, 32].map((d) => `<line x1="${x}" y1="${y + d + 4}" x2="${x + 4}" y2="${y + d}"/>`).join('')}<path d="M${x - 14} ${y + 12}h14v4h-14z"/><line x1="${x - 4}" y1="${y + 14}" x2="${x + 6}" y2="${y + 14}" stroke-width="0.8"/><path d="M${x - 30} ${y + 2}l6 -10l6 10z"/></g>${text(x - 24, y + 1, '!', 6, 'middle', 700)}`;
}

// ── hardware at true scale ──────────────────────────────────────────────────────────────────────────────────────

/** A fitting's side view (mm), its left end at (x, y) centred on y → SVG. Threads as hatches at the pitch. */
export function hardwareGlyph(part, x, y) {
  const g = []; const L = part.length; const sw = 0.25;
  const rect = (x0, y0, w, h) => g.push(`<rect x="${r2(x0)}" y="${r2(y0)}" width="${r2(w)}" height="${r2(h)}" fill="none" stroke="${INK}" stroke-width="${sw}"/>`);
  const poly = (pts) => g.push(`<path d="M${pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join('L')}Z" fill="none" stroke="${INK}" stroke-width="${sw}"/>`);
  const hatch = (x0, x1, r, pitch) => { const out = []; for (let t = x0 + pitch / 2; t < x1; t += pitch) out.push(`M${r2(t)} ${r2(y - r)}L${r2(t + pitch * 0.5)} ${r2(y + r)}`); if (out.length) g.push(`<path d="${out.join('')}" stroke="${INK}" stroke-width="0.12"/>`); };
  switch (part.family) {
    case 'bolt': {
      const k = part.head.k; const hd = part.head.shape === 'hex' ? part.head.s : part.head.dk;
      if (part.head.shape === 'csk') { poly([[x, y - hd / 2], [x + k, y - part.d / 2], [x + k, y + part.d / 2], [x, y + hd / 2]]); rect(x + k, y - part.d / 2, L - k, part.d); hatch(x + L - part.threadLen, x + L, part.d / 2, part.P); }
      else { rect(x, y - hd / 2, k, hd); rect(x + k, y - part.d / 2, L, part.d); hatch(x + k + L - part.threadLen, x + k + L, part.d / 2, part.P); }
      break;
    }
    case 'wood-screw': case 'confirmat': {
      const k = part.head.k, dk = part.head.dk, d = part.d;
      if (part.head.shape === 'csk') poly([[x, y - dk / 2], [x + k, y - (part.neck ? part.neck.d : d) / 2], [x + k, y + (part.neck ? part.neck.d : d) / 2], [x, y + dk / 2]]);
      else rect(x - k, y - dk / 2, k, dk);
      const s0 = part.head.shape === 'csk' ? k : 0;
      if (part.neck) rect(x + s0, y - part.neck.d / 2, part.neck.len, part.neck.d);
      const t0 = x + s0 + (part.neck ? part.neck.len : 0), tip = part.pointed ? d : 2;
      poly([[t0, y - d / 2], [x + L - tip, y - d / 2], [x + L, y], [x + L - tip, y + d / 2], [t0, y + d / 2]]);
      hatch(x + L - part.threadLen, x + L - tip, d / 2, d * 0.45);
      break;
    }
    case 'dowel': { const c = 1; poly([[x, y - part.d / 2 + c], [x + c, y - part.d / 2], [x + L - c, y - part.d / 2], [x + L, y - part.d / 2 + c], [x + L, y + part.d / 2 - c], [x + L - c, y + part.d / 2], [x + c, y + part.d / 2], [x, y + part.d / 2 - c]]); for (const f of [-0.25, 0, 0.25]) g.push(`<line x1="${r2(x + 2)}" y1="${r2(y + f * part.d)}" x2="${r2(x + L - 2)}" y2="${r2(y + f * part.d)}" stroke="${INK}" stroke-width="0.12"/>`); break; }
    case 'cam': { const r = part.d / 2; g.push(`<circle cx="${r2(x + r)}" cy="${r2(y)}" r="${r}" fill="none" stroke="${INK}" stroke-width="${sw}"/><circle cx="${r2(x + r + 2)}" cy="${r2(y)}" r="3.4" fill="none" stroke="${INK}" stroke-width="0.2"/><line x1="${r2(x + r - 4)}" y1="${r2(y)}" x2="${r2(x + r + 4)}" y2="${r2(y)}" stroke="${INK}" stroke-width="0.5"/>`); break; }
    case 'cam-bolt': {
      const out = L - part.into, b = part.head.dk;
      g.push(`<circle cx="${r2(x + b / 2)}" cy="${r2(y)}" r="${r2(b / 2)}" fill="none" stroke="${INK}" stroke-width="${sw}"/>`);
      rect(x + b, y - part.shank / 2, out - b - 1.5, part.shank); rect(x + out - 1.5, y - 5, 1.5, 10);
      poly([[x + out, y - part.d / 2], [x + L - 2, y - part.d / 2], [x + L, y], [x + L - 2, y + part.d / 2], [x + out, y + part.d / 2]]);
      hatch(x + out, x + L - 2, part.d / 2, 1.6);
      break;
    }
    case 'washer': rect(x, y - part.od / 2, part.length, part.od); g.push(`<circle cx="${r2(x + part.length + 3 + part.od / 2)}" cy="${r2(y)}" r="${r2(part.od / 2)}" fill="none" stroke="${INK}" stroke-width="${sw}"/><circle cx="${r2(x + part.length + 3 + part.od / 2)}" cy="${r2(y)}" r="${r2(part.d / 2)}" fill="none" stroke="${INK}" stroke-width="${sw}"/>`); break;
    case 'nut': { const R = part.s / Math.sqrt(3); const cx = x + R; poly(Array.from({ length: 6 }, (_, i) => [cx + R * Math.cos((Math.PI / 3) * i), y + R * Math.sin((Math.PI / 3) * i)])); g.push(`<circle cx="${r2(cx)}" cy="${r2(y)}" r="${r2(part.d / 2)}" fill="none" stroke="${INK}" stroke-width="${sw}"/>`); break; }
    case 'shelf-pin': rect(x, y - part.d / 2, L, part.d); break;
    case 'bracket': poly([[x, y + part.leg / 2], [x, y - part.leg / 2], [x + part.t, y - part.leg / 2], [x + part.t, y + part.leg / 2 - part.t], [x + part.leg, y + part.leg / 2 - part.t], [x + part.leg, y + part.leg / 2]]); break;
    case 'hanger-bolt': {
      // the machine thread (fine) to the left, the wood thread (coarse, pointed) to the right
      const m = L - part.wood;
      rect(x, y - part.d / 2, m, part.d); hatch(x, x + m, part.d / 2, part.P);
      poly([[x + m, y - part.d / 2], [x + L - part.d, y - part.d / 2], [x + L, y], [x + L - part.d, y + part.d / 2], [x + m, y + part.d / 2]]); hatch(x + m, x + L - part.d, part.d / 2, part.d * 0.45);
      break;
    }
    case 'insert': rect(x, y - part.od / 2, L, part.od); hatch(x, x + L, part.od / 2, 2.5); g.push(`<circle cx="${r2(x + L + 3 + part.od / 2)}" cy="${r2(y)}" r="${r2(part.od / 2)}" fill="none" stroke="${INK}" stroke-width="${sw}"/><circle cx="${r2(x + L + 3 + part.od / 2)}" cy="${r2(y)}" r="${r2(part.d / 2)}" fill="none" stroke="${INK}" stroke-width="${sw}"/>`); break;
    case 'clip': rect(x, y - part.h / 2, L, part.h); break;
    case 'spring': { const pts = []; for (let i = 0; i <= 12; i++) pts.push(`${r2(x + i * 5)} ${r2(y + (i % 2 ? -6 : 6))}`); g.push(`<path d="M${pts.join('L')}" fill="none" stroke="${INK}" stroke-width="${part.d / 4}"/>`); break; }
    default: rect(x, y - 2, L, 4);
  }
  return g.join('');
}
/** How long a glyph runs to the right (mm). */
const glyphWidth = (p) => (p.family === 'cam' ? p.d : p.family === 'washer' ? p.length + 3 + p.od : p.family === 'nut' ? 2 * p.s / Math.sqrt(3) : p.family === 'bracket' ? p.leg : p.family === 'insert' ? p.length + 3 + p.od : p.family === 'spring' ? 60 : p.length + (p.head && p.head.shape === 'hex' ? p.head.k : 0));
const glyphHeight = (p) => (p.family === 'bracket' ? p.leg : p.family === 'washer' ? p.od : p.family === 'insert' ? p.od : p.family === 'clip' ? p.h : p.family === 'spring' ? 12 : p.head ? (p.head.dk || p.head.s || p.d) : p.d);

/** The inventory: every part numbered with its size, every fitting lettered at 1:1, a 10 mm check bar. */
function inventoryPage(plan, groups, mmPerUnit) {
  let body = '';
  // parts: a small line drawing of each, its number, ×count and size
  const cols = 3, cw = 60, ch = 44; const x0 = 15, y0 = 18;
  plan.parts.forEach((pt, i) => {
    const cx = x0 + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
    // a section is drawn whole: every part in it, with its cord and buttons
    const fs = pt.draw ? pt.draw.flatMap((id) => [...groups.entries()].filter(([g]) => g === id || String(g).startsWith(`${id}:`)).flatMap(([, f]) => f)) : (groups.get(pt.ids[0]) || []);
    if (fs.length) { const cam = fitCamera(fs.flatMap((f) => f.corners), { x: cx + 10, y: cy + 4, w: cw - 16, h: ch - 18 }); body += inkRuns(fs, cam, plan.ink); }
    body += circle(cx + 4, cy + 5, 3.6, pt.n, { size: 4 });
    if (pt.count > 1) body += text(cx + 9, cy + 6.6, `×${pt.count}`, 4, 'start', 700);
    body += text(cx + cw / 2, cy + ch - 6, pt.dimsMm.map((v) => Math.round(v)).join(' × '), 3.2, 'middle');
  });
  // fittings at 1:1
  let y = y0 + Math.ceil(plan.parts.length / cols) * ch + 10;
  body += `<line x1="12" y1="${y - 6}" x2="198" y2="${y - 6}" stroke="${INK}" stroke-width="0.3"/>`;
  let x = 18, rowH = 0;
  for (const h of plan.hardware) {
    const p = hardwarePart(h.code);
    // a joint's own piece has no catalog size: a small drawing of it, not to scale
    const w = p ? glyphWidth(p) + 30 : 60, hh = p ? Math.max(glyphHeight(p), 10) + 10 : 26;
    if (x + w > 196) { x = 18; y += rowH; rowH = 0; }
    body += circle(x + 4, y + hh / 2, 3.6, h.letter, { size: 4 }) + text(x + 9.5, y + hh / 2 + 1.5, `×${h.count}`, 4, 'start', 700);
    if (p) body += hardwareGlyph(p, x + 22, y + hh / 2);
    else { const fs = groups.get(h.sample) || []; if (fs.length) body += inkRuns(fs, fitCamera(fs.flatMap((f) => f.corners), { x: x + 22, y: y + 2, w: w - 26, h: hh - 4 }), plan.ink); }
    x += w + 6; rowH = Math.max(rowH, hh + 4);
  }
  // the check bar: print at 100 % and this is 10 mm (only when there are fittings drawn to scale)
  const by = PAGE.h - 18;
  if (plan.hardware.some((h) => hardwarePart(h.code))) body += `<g stroke="${INK}" stroke-width="0.3"><line x1="18" y1="${by}" x2="28" y2="${by}" stroke-width="0.6"/><line x1="18" y1="${by - 2}" x2="18" y2="${by + 2}"/><line x1="28" y1="${by - 2}" x2="28" y2="${by + 2}"/></g>${text(31, by + 1.4, '10 mm · 1:1', 3.2)}`;
  return page(body);
}

/** The cover: the finished piece, its name, its carton and mass; the tools it needs. */
function coverPage(plan, groups) {
  const all = [...groups.values()].flat();
  const cam = fitCamera(all.flatMap((f) => f.corners), { x: 25, y: 40, w: 160, h: 170 });
  let body = inkRuns(all, cam, plan.ink) + text(PAGE.w / 2, 26, plan.id.toUpperCase(), 11, 'middle', 700);
  const f = plan.low.report.furniture;
  // a piece that arrives in sections (an upholstered sofa) gives its size; a flat-pack one its carton
  if (f) body += text(PAGE.w / 2, 232, `${(plan.sectionOf ? f.sizeMm : f.cartonMm).join(' × ')} mm · ${f.massKg} kg`, 4.5, 'middle');
  let x = PAGE.w / 2 - (plan.tools.length * 40) / 2;
  for (const t of plan.tools) { body += toolGlyph(t.key, x + 20, 258); x += 40; }
  return page(body);
}
/** A tool's glyph, with its size under it (PZ2, 4 mm). */
function toolGlyph(key, x, y) {
  const g = `stroke="${INK}" fill="none" stroke-width="0.5"`;
  if (/^PZ/.test(key)) return `<g ${g}><rect x="${x - 14}" y="${y - 3}" width="12" height="6" rx="2"/><line x1="${x - 2}" y1="${y}" x2="${x + 12}" y2="${y}"/></g>${text(x, y + 9, key, 3.6, 'middle', 700)}`;
  if (/^hex-key-/.test(key)) return `<g ${g}><path d="M${x - 10} ${y - 4}h14v10"/></g>${text(x, y + 12, `${key.slice(8)} mm`, 3.6, 'middle', 700)}`;
  if (key === 'hammer') return `<g ${g}><rect x="${x - 8}" y="${y - 6}" width="16" height="5" rx="1"/><line x1="${x}" y1="${y - 1}" x2="${x}" y2="${y + 10}" stroke-width="1.2"/></g>`;
  if (/^spanner-/.test(key)) return `<g ${g}><path d="M${x - 12} ${y}h20m0 -3a4 4 0 1 1 0 6"/></g>${text(x, y + 9, key.slice(8), 3.6, 'middle', 700)}`;
  return '';
}

/**
 * manualPages(spec) → { plan, pages: [{ name, svg }] }: the cover, the inventory, then one page per step. Every page is
 * an A4 SVG in millimetres, so it prints at true scale.
 */
export function manualPages(spec) {
  const plan = manualPlan(spec);
  const mmPerUnit = FRAME_UNITS[plan.unit] * 1000;
  const groups = groupsOf(plan.low.faces);
  // one camera for every assembly step, fitted to the whole piece with room for the parts pulled back
  const allPts = plan.low.faces.flatMap((f) => f.corners);
  const b = bounds(plan.low.faces); const grow = 0.3 * b.diag;
  const pts = [...allPts, add(b.lo, [-grow, -grow, 0]), add(b.hi, [grow, grow, grow])];
  const wholeCam = fitCamera(pts, { x: 15, y: 45, w: 180, h: 235 });
  const pages = [{ name: 'cover', svg: coverPage(plan, groups) }, { name: 'inventory', svg: inventoryPage(plan, groups, mmPerUnit) }];
  for (const s of plan.steps) pages.push({ name: `step-${String(s.n).padStart(2, '0')}`, svg: stepPage(plan, s, groups, wholeCam, mmPerUnit) });
  // the cloth: a swatch at true size in one ink and the weave's draft magnified, then where each piece is cut
  for (const [i, c] of (plan.low.covers || []).entries()) {
    const tag = plan.low.covers.length > 1 ? `-${i + 1}` : '';
    pages.push({ name: `cloth${tag}`, svg: clothPage(plan, c, i) });
    coverPages(c, { numberOf: plan.numberOf }).forEach((svg, k) => pages.push({ name: `cut${tag}-${String(k + 1).padStart(2, '0')}`, svg }));
  }
  return { plan, pages };
}

/**
 * A cloth's page: the parts it covers (numbered), a swatch at true size in hatched tones, the weave's draft magnified
 * eight times, and the metres of it on its roll's width.
 */
function clothPage(plan, c, i) {
  const spec = plan.low.clothSpecs ? plan.low.clothSpecs[i] : c.fabric;
  const embed = (svg, x, y) => `<g transform="translate(${x} ${y})">${svg.replace(/^<svg[^>]*>/, (m) => m.replace(/ width="[^"]*mm" height="[^"]*mm"/, (w) => w.replace(/mm"/g, '"')))}</g>`;
  let body = '';
  body += embed(fabricSvg(spec, { widthMm: 170, heightMm: 90, scale: 1, ink: 'tone', id: `k${i}a` }), 20, 45) + `<rect x="20" y="45" width="170" height="90" fill="none" stroke="${INK}" stroke-width="0.3"/>`;
  body += text(20, 141, '1:1', 3.2, 'start');
  body += embed(fabricSvg(spec, { widthMm: 170, heightMm: 60, scale: 8, ink: 'draft', id: `k${i}b` }), 20, 150) + `<rect x="20" y="150" width="170" height="60" fill="none" stroke="${INK}" stroke-width="0.3"/>`;
  body += text(20, 216, '8:1', 3.2, 'start');
  const nums = [...new Set(c.parts.map((id) => plan.numberOf.get(id)).filter(Boolean))].sort((a, b) => a - b);
  nums.forEach((n, k) => { body += circle(24 + k * 11, 232, 4.2, n, { size: 4.6 }); });
  body += text(20, 256, `${c.metres} m × ${c.rollMm} mm`, 6, 'start', 700);
  if (c.match) body += text(20, 266, `${c.repeatMm[0]} × ${c.repeatMm[1]} mm`, 4, 'start');
  return page(body);
}

/** The pages as one printable HTML book: A4, one page a sheet, ink on white. */
export function manualHtml({ plan, pages }) {
  const css = '@page{size:A4;margin:0}body{margin:0;background:#ddd}section{width:210mm;height:297mm;margin:8mm auto;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.25)}section svg{display:block;width:210mm;height:297mm}@media print{body{background:#fff}section{margin:0;box-shadow:none;break-after:page}}';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${plan.id}</title><style>${css}</style></head><body>${pages.map((p) => `<section id="${p.name}">${p.svg}</section>`).join('')}</body></html>`;
}
