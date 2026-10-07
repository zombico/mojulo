// construction/furniture-checks — where furniture fails, as advisory arithmetic over a frame: they stamp, they never
// refuse. They run when a frame is furniture (a sheet or box member, or a furniture joint); a timber bent's report is
// unchanged.
//
//   · tip-over: the centre of mass (every member's volume × density, and the hardware) against the footprint it stands
//     on; and a scenario for tall, narrow storage (a sheet side or back standing most of its height) — taller than 686 mm (ASTM F2057's 27 in) and at least one and a
//     half times as tall as it is deep: a child (22.7 kg, the standard's 50 lb) pulling forward with a third of their
//     weight at up to 1.2 m. A piece with drawers (members grouped and on slides) taller than 686 mm is also checked
//     the way ASTM F2057-23 loads a chest: every drawer out two-thirds of its depth and the child's weight on the front
//     of the highest one. Tipping stamps "fix it to the wall".
//   · racking: in each upright plane (sideways x–z, front to back y–z), something must keep the corners square — a
//     panel lying in that plane fastened along two or more of its edges (a side, a fixed back), or two or more
//     moment-rigid joints between members in it (a table's aprons in their legs, a bracket). Knock-down fittings
//     alone let a corner turn: a carcass with no back folds sideways.
//   · interference: two members' bodies that overlap with no joint between them, two tenons that meet inside the
//     member they both go into (a table leg: shorten them with `depth`, or mitre them), and two fittings whose holes
//     meet inside a member (cam bolts or shelf pins from both faces of a partition, with no room to stagger them).
//   · fasteners: one that pokes out of the far side, bites too little, goes into a particleboard or MDF edge as a
//     plain screw, or sits too near a face; a cam bore that leaves too thin a floor.
//   · the cut list: every sheet part nested onto its standard sheets (guillotine strips, 4 mm kerf, 10 mm trim; turned
//     only where the board has no grain), with the sheet count and yield; the flat-pack carton and the mass.
import { TIMBERS } from './timber.js';
import { SHEETS, isSheet } from './sheets.js';
import { sectionProps } from './sections.js';
import { hardwarePart, toolOf } from './hardware.js';
import { FURNITURE_JOINTS, RIGIDITY, worldBox, cylsMeet } from './furniture-joints.js';
import { toWorld } from './members.js';
import { seatingReport, seatingStamps } from './seating.js';
import * as dmath from '../../util/dmath.js';

const G = 9.81;
const CHILD = { kg: 22.7, pullShare: 1 / 3, reach: 1.2, scopeM: 0.686 };
const r1 = (v) => Math.round(v * 10) / 10;
const mm = (v) => Math.round(v * 1000);

/** Is this frame furniture? */
export function isFurniture(spec) {
  const ms = Array.isArray(spec.members) ? spec.members : [];
  const js = Array.isArray(spec.joints) ? spec.joints : [];
  return ms.some((m) => m && (m.box !== undefined || isSheet(m.material))) || js.some((j) => j && FURNITURE_JOINTS.includes(j.type)) || (Array.isArray(spec.soft) && spec.soft.length > 0);
}

/** A member's mass, kg. */
function memberKg(M) {
  const len = M.xMax - M.xMin;
  if (M.material === 'steel') return sectionProps(M.section).mass * len;
  const rho = isSheet(M.material) ? SHEETS[M.material].density : M.material === 'concrete' ? 2400 : TIMBERS[M.species].density;
  return rho * M.W * M.D * len;
}

/** Monotone-chain convex hull of 2D points (counter-clockwise). */
function hull(pts) {
  const p = [...new Map(pts.map((q) => [`${q[0].toFixed(5)},${q[1].toFixed(5)}`, q])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** Signed distance from q to the hull's boundary (positive inside). */
function insideMargin(H, q) {
  if (H.length < 3) return -Infinity;
  let m = Infinity;
  for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], l = dmath.hypot(ex, ey) || 1;
    m = Math.min(m, ((q[1] - a[1]) * -ex + (q[0] - a[0]) * ey) / -l);
  }
  return m;
}

/**
 * Nest parts ([{ id, l, w }] mm, l along the grain) onto sheets of L × W mm → { sheets, yieldPct, placed, oversize }.
 * Guillotine strips, first fit, widest first. `rotate` lets a part turn when its board has no grain.
 */
export function nestParts(parts, [L, W], { kerf = 4, trim = 10, rotate = true } = {}) {
  const L0 = L - 2 * trim, W0 = W - 2 * trim;
  const orient = (p) => (rotate && p.w > p.l ? { ...p, l: p.w, w: p.l, turned: true } : { ...p, turned: false });
  const list = parts.map(orient).sort((a, b) => b.w - a.w || b.l - a.l || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sheets = []; const placed = []; const oversize = [];
  for (const p of list) {
    const fits = p.l <= L0 && p.w <= W0;
    const q = !fits && rotate && p.w <= L0 && p.l <= W0 ? { ...p, l: p.w, w: p.l, turned: !p.turned } : p;
    if (q.l > L0 || q.w > W0) { oversize.push(p.id); continue; }
    let done = false;
    for (let si = 0; si < sheets.length && !done; si++) {
      for (const st of sheets[si].strips) if (st.h >= q.w && st.x + q.l <= L0) { placed.push({ id: q.id, sheet: si + 1, x: st.x + trim, y: st.y + trim, l: q.l, w: q.w, turned: q.turned }); st.x += q.l + kerf; done = true; break; }
      if (!done && sheets[si].used + q.w <= W0) { const st = { y: sheets[si].used, h: q.w, x: q.l + kerf }; sheets[si].strips.push(st); sheets[si].used += q.w + kerf; placed.push({ id: q.id, sheet: si + 1, x: trim, y: st.y + trim, l: q.l, w: q.w, turned: q.turned }); done = true; }
    }
    if (!done) { sheets.push({ strips: [{ y: 0, h: q.w, x: q.l + kerf }], used: q.w + kerf }); placed.push({ id: q.id, sheet: sheets.length, x: trim, y: trim, l: q.l, w: q.w, turned: q.turned }); }
  }
  const area = placed.reduce((s, p) => s + p.l * p.w, 0);
  return { sheets: sheets.length, yieldPct: sheets.length ? r1((100 * area) / (sheets.length * L * W)) : 0, placed, oversize };
}

/** A member-local box term's world box. */
function termBox(M, t) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const p = toWorld(M.F, [t.center[0] + sx * t.size[0] / 2, t.center[1] + sy * t.size[1] / 2, t.center[2] + sz * t.size[2] / 2]);
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  }
  return { lo, hi };
}

/** The furniture report for a lowered frame. */
export function furnitureReport({ spec = {}, members, joints: J, drawn, soft = [] }) {
  const boxes = new Map(members.map((M) => [M.id, worldBox(M)]));
  // ── mass and centre of mass
  let kg = 0; const com = [0, 0, 0];
  for (const M of members) { const m = memberKg(M), c = boxes.get(M.id).c; kg += m; for (let k = 0; k < 3; k++) com[k] += m * c[k]; }
  let hwKg = 0;
  for (const p of drawn) if (Number.isFinite(p.massG)) { const m = p.massG / 1000; hwKg += m; const c = boxes.get(p.host.id).c; kg += m; for (let k = 0; k < 3; k++) com[k] += m * c[k]; }
  // soft parts: their fill and cover, at their box's centre
  for (const L of soft) { const m = L.row.massKg; kg += m; for (let k = 0; k < 3; k++) com[k] += m * L.frame.c[k]; }
  for (let k = 0; k < 3; k++) com[k] /= kg || 1;
  const all = [...boxes.values(), ...soft.map((L) => ({ lo: L.frame.lo, hi: L.frame.hi }))];
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((b) => b.lo[k]))), hi = [0, 1, 2].map((k) => Math.max(...all.map((b) => b.hi[k])));
  const height = hi[2] - lo[2];
  // ── tip-over
  const feet = [];
  for (const b of all) if (b.lo[2] <= lo[2] + 0.003) feet.push([b.lo[0], b.lo[1]], [b.hi[0], b.lo[1]], [b.hi[0], b.hi[1]], [b.lo[0], b.hi[1]]);
  const H = hull(feet);
  const standing = insideMargin(H, [com[0], com[1]]);
  let pull = null;
  // storage — a side or back panel standing most of the height — that is tall and narrow
  const storage = members.some((M) => { const b = boxes.get(M.id); const thin = b.size.indexOf(Math.min(...b.size)); return thin !== 2 && b.size[2] >= 0.6 * height && isSheet(M.material); });
  if (storage && height > CHILD.scopeM && height >= 1.5 * (hi[1] - lo[1])) {
    const front = Math.min(...H.map((q) => q[1]));                           // tipping about the front edge (front is −y)
    const F = CHILD.kg * CHILD.pullShare * G, h = Math.min(height, CHILD.reach);
    const over = F * h, restore = kg * G * (com[1] - front);
    pull = { forceN: r1(F), heightMm: mm(h), overturnNm: r1(over), restoreNm: r1(restore), tips: over > restore };
  }
  // ── drawers out (after ASTM F2057-23): every drawer two-thirds out, a child's weight on the highest one's front
  let drawers = null;
  const onSlides = new Set(J.report.filter((r) => r.type === 'slide').map((r) => r.a));
  const drawerGroups = new Set(members.filter((M) => M.group && onSlides.has(M.id)).map((M) => M.group));
  if (drawerGroups.size && height > CHILD.scopeM && H.length >= 3) {
    const front = Math.min(...H.map((q) => q[1]));
    const groupBox = (g) => { const bs = members.filter((M) => M.group === g).map((M) => boxes.get(M.id)); return { lo: [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.lo[k]))), hi: [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.hi[k]))) }; };
    // out two-thirds of the slide's travel (the box's depth when no catalog slide says)
    const slideOf = new Map(J.report.filter((r) => r.type === 'slide').map((r) => [members.find((M) => M.id === r.a).group, hardwarePart(r.slide)]));
    const ext = new Map([...drawerGroups].map((g) => { const s = slideOf.get(g); const b = groupBox(g); return [g, (2 / 3) * (s ? s.length / 1000 : b.hi[1] - b.lo[1])]; }));
    let moment = 0;                                                        // N·m about the front edge; positive holds it down
    for (const M of members) { const b = boxes.get(M.id); const y = b.c[1] - (M.group && ext.has(M.group) ? ext.get(M.group) : 0); moment += memberKg(M) * G * (y - front); }
    for (const p of drawn) if (Number.isFinite(p.massG)) { const hb = boxes.get(p.host.id); const Mh = members.find((M) => M.id === p.host.id); const y = hb.c[1] - (Mh && Mh.group && ext.has(Mh.group) ? ext.get(Mh.group) : 0); moment += (p.massG / 1000) * G * (y - front); }
    const top = [...drawerGroups].sort((x, y) => groupBox(y).hi[2] - groupBox(x).hi[2])[0];
    const yChild = groupBox(top).lo[1] - ext.get(top);
    moment += CHILD.kg * G * (yChild - front);
    drawers = { count: drawerGroups.size, outMm: mm(Math.max(...ext.values())), childKg: CHILD.kg, onDrawer: top, netNm: r1(moment), tips: moment < 0 };
  }
  // ── seating: a piece with seat cushions sits, and a sitter may tip it
  const seating = soft.length ? seatingReport({ soft, J, kg, com, hull: H, seats: spec.built && spec.built.dials && spec.built.dials.seats }) : null;
  // ── racking
  const jointList = J.report.filter((r) => r.b !== undefined);
  const inPlane = (b, nk) => b.size[nk] <= 0.5 * Math.max(...b.size);
  const racking = [];
  if (height >= 0.3) {
    for (const [plane, nk, a1] of [['sideways (x–z)', 1, 0], ['front to back (y–z)', 0, 1]]) {
      let by = null;
      for (const M of members) {
        const b = boxes.get(M.id);
        if (!(b.size[nk] <= Math.min(...b.size) + 1e-4 && b.size[a1] >= 0.5 * (hi[a1] - lo[a1]) && b.size[2] >= 0.5 * height)) continue;
        const partners = new Set(jointList.filter((r) => (r.a === M.id || r.b === M.id) && (r.rigidity || RIGIDITY[r.type] || 'pin') !== 'none').map((r) => (r.a === M.id ? r.b : r.a)));
        if (partners.size >= 2) { by = `panel ${M.id}`; break; }
      }
      if (!by) {
        // moment-rigid joints where a rail lying in the plane meets its post (the post may be a panel seen edge-on)
        const rigid = jointList.filter((r) => (r.rigidity || RIGIDITY[r.type]) === 'moment' && boxes.has(r.a) && boxes.has(r.b) && (inPlane(boxes.get(r.a), nk) || inPlane(boxes.get(r.b), nk)));
        if (rigid.length >= 2) by = `${rigid.length} rigid joints`;
      }
      racking.push({ plane, resisted: !!by, ...(by ? { by } : {}) });
    }
  }
  // ── interference: bodies (as authored, before tenons) that overlap with no joint between them; tenons that collide
  const joined = new Set(jointList.flatMap((r) => [`${r.a}|${r.b}`, `${r.b}|${r.a}`]));
  const interference = [];
  const bodies = new Map(members.map((M) => [M.id, worldBox({ ...M, xMin: 0, xMax: M.L })]));
  const overlap = (a, b) => [0, 1, 2].map((k) => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]));
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
    const A = members[i], B = members[j]; if (joined.has(`${A.id}|${B.id}`)) continue;
    const ov = overlap(bodies.get(A.id), bodies.get(B.id));
    if (ov.every((v) => v > 0.0005)) interference.push({ a: A.id, b: B.id, overlapMm: ov.map((v) => r1(v * 1000)) });
  }
  const tenons = [];
  for (const M of members) for (const t of M.adds) if (t.kind === 'box') tenons.push({ id: M.id, box: termBox(M, t) });
  for (let i = 0; i < tenons.length; i++) for (let j = i + 1; j < tenons.length; j++) {
    if (tenons[i].id === tenons[j].id) continue;
    const ov = overlap(tenons[i].box, tenons[j].box);
    if (ov.every((v) => v > 0.0005)) interference.push({ a: tenons[i].id, b: tenons[j].id, tenons: true, overlapMm: ov.map((v) => r1(v * 1000)) });
  }
  // fittings: two holes in one member that meet, other than a cam and the bolt it grips
  const holesIn = new Map();
  for (const h of J.holes || []) { if (!holesIn.has(h.member)) holesIn.set(h.member, []); holesIn.get(h.member).push(h); }
  for (const [mid, hs] of holesIn) {
    const seen = new Set();
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i], b = hs[j];
      if (a.fit === b.fit || a.mates.includes(b.fit) || b.mates.includes(a.fit) || seen.has(`${a.fit}|${b.fit}`)) continue;
      const ov = cylsMeet(a.cyl, b.cyl, -0.0002, boxes.get(mid));
      if (ov) { seen.add(`${a.fit}|${b.fit}`); interference.push({ a: a.fit, b: b.fit, in: mid, fittings: true, overlapMm: ov.map((v) => r1(v * 1000)) }); }
    }
  }
  // ── fasteners
  const flags = [];
  for (const r of J.report) {
    for (const f of r.fasteners || []) {
      const P = hardwarePart(f.code); if (!P) continue;
      if (f.pokeMm > 0) flags.push({ joint: r.joint, code: f.code, issue: 'pokes', mm: f.pokeMm, into: f.into });
      if (P.family === 'wood-screw' && f.intoEdge && !(f.throughMm <= 6) && (f.material === 'particleboard' || f.material === 'mdf')) flags.push({ joint: r.joint, code: f.code, issue: 'edge-screw', into: f.into, material: f.material });
      if (P.family === 'wood-screw' && f.penMm !== undefined && f.penMm < Math.max(4 * P.d, 12)) flags.push({ joint: r.joint, code: f.code, issue: 'short', mm: f.penMm, needMm: Math.max(4 * P.d, 12) });
      if (P.family === 'confirmat' && f.penMm !== undefined && f.penMm < 30) flags.push({ joint: r.joint, code: f.code, issue: 'short', mm: f.penMm, needMm: 30 });
      if (f.edgeMm !== undefined && f.edgeMm < 2.5 && f.intoEdge) flags.push({ joint: r.joint, code: f.code, issue: 'near-face', mm: f.edgeMm, into: f.into });
    }
    if (r.type === 'cam-lock' && r.camFloorMm < 3) flags.push({ joint: r.joint, code: 'cam-15', issue: 'cam-floor', mm: r.camFloorMm, into: r.edge });
  }
  // ── the parts: hardware BOM, tools, cut list, carton
  const bom = new Map();
  for (const p of drawn) if (p.code) bom.set(p.code, (bom.get(p.code) || 0) + 1);
  const hardware = [...bom.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([code, count]) => ({ code, label: hardwarePart(code).label, count }));
  const tools = [...new Set(hardware.map((h) => toolOf(hardwarePart(h.code))).filter(Boolean).map((t) => t.label))].sort();
  const groups = new Map();
  for (const M of members) {
    if (!isSheet(M.material)) continue;
    const t = Math.round(M.D * 10000) / 10; const key = `${M.material}|${t}`;
    if (!groups.has(key)) groups.set(key, { material: M.material, thickMm: t, parts: [] });
    groups.get(key).parts.push({ id: M.id, l: mm(M.xMax - M.xMin), w: mm(M.W) });
  }
  const cutList = [...groups.values()].map((g) => {
    const row = SHEETS[g.material];
    const n = nestParts(g.parts, row.sheet, { rotate: row.rotate });
    return { material: g.material, thickMm: g.thickMm, sheetMm: row.sheet, sheets: n.sheets, yieldPct: n.yieldPct, parts: n.placed, ...(n.oversize.length ? { oversize: n.oversize } : {}) };
  });
  const flatDims = members.map((M) => [M.xMax - M.xMin, M.W, M.D].map(mm).sort((a, b) => b - a));
  const carton = [Math.max(...flatDims.map((d) => d[0])), Math.max(...flatDims.map((d) => d[1])), flatDims.reduce((s, d) => s + d[2], 0) + (hardware.length ? 20 : 0)];
  return {
    massKg: r1(kg), hardwareKg: r1(hwKg), comMm: com.map(mm), sizeMm: [0, 1, 2].map((k) => mm(hi[k] - lo[k])),
    tip: { standingMarginMm: mm(standing), ...(pull ? { pull } : {}), ...(drawers ? { drawers } : {}) },
    racking, interference, fasteners: flags, hardware, tools, cutList, cartonMm: carton, ...(seating ? { seating } : {}),
  };
}

/** The lines a mint stamps for a furniture report. */
export function furnitureStamps(f, label) {
  const out = [];
  if (f.tip.standingMarginMm < 0) out.push(`${label}: falls over as it stands — its centre of mass is ${-f.tip.standingMarginMm} mm outside its footprint`);
  else if (f.tip.pull && f.tip.pull.tips) out.push(`${label}: tips forward if a child pulls on it (${f.tip.pull.forceN} N at ${f.tip.pull.heightMm} mm turns it over ${f.tip.pull.overturnNm} N·m against ${f.tip.pull.restoreNm}; an advisory scenario after ASTM F2057) — fix it to the wall`);
  if (f.tip.drawers && f.tip.drawers.tips) out.push(`${label}: tips forward with its ${f.tip.drawers.count} drawer${f.tip.drawers.count > 1 ? 's' : ''} out ${f.tip.drawers.outMm} mm and a child's ${f.tip.drawers.childKg} kg on ${f.tip.drawers.onDrawer} (net ${f.tip.drawers.netNm} N·m; after ASTM F2057-23) — fix it to the wall`);
  for (const r of f.racking) if (!r.resisted) out.push(`${label}: racks ${r.plane}: nothing keeps its corners square in that plane — fix a back (in a groove, screwed or nailed) or add a brace or bracket`);
  for (const i of f.interference) {
    if (i.fittings) out.push(`${label}: ${i.a} and ${i.b} meet inside ${i.in} (${i.overlapMm.join(' × ')} mm) — move one along the joint (\`spacing\`), or shorter fittings`);
    else if (i.tenons) out.push(`${label}: the tenons of ${i.a} and ${i.b} collide (${i.overlapMm.join(' × ')} mm) inside the member they share — shorten them (\`depth\`) or mitre their ends`);
    else out.push(`${label}: ${i.a} and ${i.b} overlap (${i.overlapMm.join(' × ')} mm) with no joint between them`);
  }
  for (const x of f.fasteners) {
    if (x.issue === 'pokes') out.push(`${label}: joint ${x.joint}: ${x.code} pokes ${x.mm} mm out of ${x.into} — a shorter one`);
    else if (x.issue === 'edge-screw') out.push(`${label}: joint ${x.joint}: a plain ${x.code} into the ${x.material} edge of ${x.into} holds poorly — a confirmat, or dowels and a cam`);
    else if (x.issue === 'short') out.push(`${label}: joint ${x.joint}: ${x.code} bites ${x.mm} mm (keep at least ${x.needMm}) — a longer one`);
    else if (x.issue === 'near-face') out.push(`${label}: joint ${x.joint}: ${x.code} leaves ${x.mm} mm to the face of ${x.into} — thicker stock or a thinner fastener`);
    else if (x.issue === 'cam-floor') out.push(`${label}: joint ${x.joint}: the cam bore leaves ${x.mm} mm under it in ${x.into} (keep 3) — 16 mm board or thicker`);
  }
  for (const c of f.cutList) if (c.oversize) out.push(`${label}: ${c.oversize.join(', ')} will not fit a ${c.sheetMm.join(' × ')} ${c.material} sheet`);
  if (f.seating) out.push(...seatingStamps(f.seating, label));
  return out;
}
