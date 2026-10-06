/**
 * mechanism — a `scad` row's parts, joined into a machine that moves.
 *
 * `parts` already makes each part its own render group; `mechanism` says how they move: a JOINT per moving part
 * (revolute about an axis through a centre, prismatic along an axis, or fixed to another part with `on`), the
 * COUPLINGS that tie joints together (gears, ring gears, belts, racks, screws, plain ratios, and rigid links between
 * two pins), and one DRIVE whose value sweeps a cycle. Everything else is solved.
 *
 *   mechanism: {
 *     joints: { <part>: { type: 'revolute', center, axis, on? } | { type: 'prismatic', axis, on? } | { type: 'fixed', on } },
 *     couplings: [{ type: 'gear'|'ring', a, b, teeth: [za, zb] } | { type: 'belt', a, b, d: [da, db] }
 *                 | { type: 'rack', a, b, r } | { type: 'screw', a, b, lead, hand?, d?, mu? }
 *                 | { type: 'ratio', a, b, ratio, efficiency? } | { type: 'link', a, pa, b, pb, rod?, axis? }],
 *     drive: { part, from?, to?, mode?: 'loop'|'swing', period?, speed?, torque?|force? },
 *     loads?: [{ part, torque?|force? }], ignore?: [[a, b]], steps?,
 *   }
 *
 * The authored pose is the rest pose: every joint value is 0 there, a link's length is read off it, and a gear pair
 * is assumed authored in mesh (mj_gear_meshed). A revolute value is radians, a prismatic one is the manifest's units;
 * the drive's `from` / `to` are degrees or units. Each step is solved by damped Gauss–Newton from the step before
 * (continuation), so a linkage stays on the branch it was authored on. The degrees of freedom are counted at rest:
 * a joint nothing drives is named, not left standing still. A step that cannot close is where the mechanism LOCKS.
 *
 * Forces are virtual work through stated efficiencies: the drive's effort is Σ load·|dq/ds| / η over the loads,
 * with η the best product of coupling efficiencies from the drive to that joint. Rigid bodies, no inertia, no
 * deflection: what moves and what it takes to move it, never whether it breaks.
 *
 * Pure: no rendering here except `sweepCollisions`, which takes the renderer as an argument.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const MECHANISM_JOINTS = ['revolute', 'prismatic', 'fixed'];
export const MECHANISM_COUPLINGS = ['gear', 'ring', 'belt', 'rack', 'screw', 'ratio', 'link'];
export const DEFAULT_STEPS = 36;
export const ANIM_SAMPLES = 144;
export const DEFAULT_PERIOD = 4;
// stated, not measured: a printed or machined part's real number is the operator's to put in `efficiency`
export const EFFICIENCY = { gear: 0.98, ring: 0.97, belt: 0.96, rack: 0.95, ratio: 0.9, link: 1, fixed: 1 };
export const SCREW_MU = 0.2;   // dry plastic or lightly oiled steel on a trapezoid thread
const UNIT_M = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254 };

// ─── small vector algebra ─────────────────────────────────────────────────────────

const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mv3 = (R, v) => [dot(R[0], v), dot(R[1], v), dot(R[2], v)];
const mm3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
function rot(n, a) {
  const [x, y, z] = n, c = Math.cos(a), s = Math.sin(a), C = 1 - c;
  return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
}
// a rigid transform v → R·v + p
const IDENT = () => ({ R: I3(), p: [0, 0, 0] });
const compose = (A, B) => ({ R: mm3(A.R, B.R), p: add(mv3(A.R, B.p), A.p) });
const apply = (T, v) => add(mv3(T.R, v), T.p);
/** OpenSCAD's multmatrix for a transform. */
export const toMultmatrix = (T) => [[...T.R[0], T.p[0]], [...T.R[1], T.p[1]], [...T.R[2], T.p[2]], [0, 0, 0, 1]];

// ─── validation ───────────────────────────────────────────────────────────────────

/** Refusals for a `mechanism` block against the manifest's part names; [] when it is well formed. */
export function validateMechanism(mech, partNames) {
  if (mech == null) return [];
  const errs = [];
  if (typeof mech !== 'object' || Array.isArray(mech)) return ['`mechanism` must be an object { joints, couplings, drive }'];
  if (!partNames) return ['`mechanism` needs `parts`: each moving piece is a named part, so the World can move it on its own'];
  const parts = new Set(partNames);
  const joints = mech.joints && typeof mech.joints === 'object' ? mech.joints : null;
  if (!joints || !Object.keys(joints).length) errs.push('`mechanism.joints` must name at least one part: { <part>: { type: "revolute", center: [x,y,z], axis: [x,y,z] } }');
  for (const [name, j] of Object.entries(joints || {})) {
    const at = `mechanism.joints.${name}`;
    if (!parts.has(name)) { errs.push(`${at}: names no part — the parts are ${[...parts].join(', ')}`); continue; }
    if (!j || !MECHANISM_JOINTS.includes(j.type)) { errs.push(`${at}.type must be one of ${MECHANISM_JOINTS.join(', ')}`); continue; }
    if (j.type === 'revolute' && !isVec3(j.center)) errs.push(`${at}.center must be [x, y, z] — a point on the axis, in the authored pose`);
    if (j.type !== 'fixed' && (!isVec3(j.axis) || norm(j.axis) < 1e-9)) errs.push(`${at}.axis must be a non-zero [x, y, z]`);
    if (j.type === 'fixed' && j.on == null) errs.push(`${at}: a fixed joint rides another part — give \`on\` (a part with no joint is already fixed to the ground)`);
    if (j.on != null && (!parts.has(j.on) || j.on === name)) errs.push(`${at}.on must name another part`);
  }
  // a part may ride a part, never itself through a loop
  for (const name of Object.keys(joints || {})) {
    const seen = new Set([name]); let p = joints[name]?.on;
    while (p != null) { if (seen.has(p)) { errs.push(`mechanism.joints: \`on\` makes a loop through ${[...seen].join(' → ')}`); break; } seen.add(p); p = joints[p]?.on; }
  }
  const type = (n) => joints?.[n]?.type;
  const rods = new Set();
  const couplings = Array.isArray(mech.couplings) ? mech.couplings : mech.couplings == null ? [] : null;
  if (!couplings) errs.push('`mechanism.couplings` must be an array');
  (couplings || []).forEach((c, i) => {
    const at = `mechanism.couplings[${i}]`;
    if (!c || !MECHANISM_COUPLINGS.includes(c.type)) { errs.push(`${at}.type must be one of ${MECHANISM_COUPLINGS.join(', ')}`); return; }
    for (const k of ['a', 'b']) if (!parts.has(c[k])) errs.push(`${at}.${k} must name a part`);
    if (c.a === c.b) errs.push(`${at}: a and b are the same part`);
    const need = { gear: ['revolute', 'revolute'], ring: ['revolute', 'revolute'], belt: ['revolute', 'revolute'], rack: ['revolute', 'prismatic'], screw: ['revolute', 'prismatic'] }[c.type];
    // a gear, ring or belt member with no joint stands on the ground (a fixed ring gear); a rack or screw needs both
    const ground = (n) => ['gear', 'ring', 'belt'].includes(c.type) && type(n) == null;
    if (need) need.forEach((t, k) => { const n = k ? c.b : c.a; if (parts.has(n) && type(n) !== t && !ground(n)) errs.push(`${at}: a ${c.type} needs ${k ? 'b' : 'a'} ('${n}') on a ${t} joint${['gear', 'ring', 'belt'].includes(c.type) ? ', or no joint at all for a member fixed to the ground' : ''}`); });
    if (need && ['gear', 'ring', 'belt'].includes(c.type) && type(c.a) == null && type(c.b) == null && parts.has(c.a) && parts.has(c.b)) errs.push(`${at}: neither '${c.a}' nor '${c.b}' has a joint, so the ${c.type} couples nothing`);
    if (c.type === 'ratio') for (const k of ['a', 'b']) if (parts.has(c[k]) && !['revolute', 'prismatic'].includes(type(c[k]))) errs.push(`${at}: '${c[k]}' needs a revolute or prismatic joint`);
    const pos2 = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => Number.isFinite(x) && x > 0);
    if ((c.type === 'gear' || c.type === 'ring') && !pos2(c.teeth)) errs.push(`${at}.teeth must be [za, zb], both positive`);
    if (c.type === 'belt' && !pos2(c.d)) errs.push(`${at}.d must be [da, db], the two pitch diameters`);
    if (c.type === 'rack' && !(Number.isFinite(c.r) && c.r > 0)) errs.push(`${at}.r must be the pinion's pitch radius (mod·z/2)`);
    if (c.type === 'screw') {
      if (!(Number.isFinite(c.lead) && c.lead > 0)) errs.push(`${at}.lead must be the travel per turn (pitch × starts)`);
      if (c.hand != null && c.hand !== 'right' && c.hand !== 'left') errs.push(`${at}.hand must be 'right' or 'left'`);
    }
    if (c.type === 'ratio' && !(Number.isFinite(c.ratio) && c.ratio !== 0)) errs.push(`${at}.ratio must be a non-zero number (b moves ratio × a)`);
    if (c.efficiency != null && !(Number.isFinite(c.efficiency) && c.efficiency > 0 && c.efficiency <= 1)) errs.push(`${at}.efficiency must be in (0, 1]`);
    if (c.type === 'link') {
      if (!isVec3(c.pa) || !isVec3(c.pb)) errs.push(`${at}: a link needs pa and pb, the two pin centres in the authored pose`);
      else if (norm(sub(c.pa, c.pb)) < 1e-6) errs.push(`${at}: pa and pb coincide — a link has a length`);
      if (c.axis != null && !isVec3(c.axis)) errs.push(`${at}.axis must be [x, y, z], the pins' axis`);
      if (c.rod != null) {
        if (!parts.has(c.rod)) errs.push(`${at}.rod must name a part`);
        else if (joints?.[c.rod]) errs.push(`${at}.rod: '${c.rod}' has a joint — a rod is placed by its two pins, not by a joint`);
        else if (rods.has(c.rod)) errs.push(`${at}.rod: '${c.rod}' is already another link's rod`);
        rods.add(c.rod);
      }
    }
  });
  for (const n of rods) if (Object.values(joints || {}).some((j) => j?.on === n)) errs.push(`mechanism: '${n}' is a rod, and a part rides it with \`on\` — a rod cannot carry parts`);
  const d = mech.drive;
  if (!d || typeof d !== 'object') errs.push('`mechanism.drive` must name the part that moves the mechanism: { part, from?, to? }');
  else {
    if (!['revolute', 'prismatic'].includes(type(d.part))) errs.push('`mechanism.drive.part` must name a part on a revolute or prismatic joint');
    for (const k of ['from', 'to', 'period', 'speed', 'torque', 'force']) if (d[k] != null && !Number.isFinite(d[k])) errs.push(`mechanism.drive.${k} must be a number`);
    if (type(d.part) === 'prismatic' && !(Number.isFinite(d.to) && d.to !== (d.from ?? 0))) errs.push('mechanism.drive: a prismatic drive needs `to`, the travel in the manifest\'s units');
    if (d.mode != null && d.mode !== 'loop' && d.mode !== 'swing') errs.push("mechanism.drive.mode must be 'loop' or 'swing'");
    if (d.period != null && !(d.period > 0)) errs.push('mechanism.drive.period must be positive (seconds per cycle in the World)');
    if (d.torque != null && d.force != null) errs.push('mechanism.drive: give torque (a revolute drive) or force (a prismatic one), not both');
  }
  const loads = mech.loads == null ? [] : Array.isArray(mech.loads) ? mech.loads : null;
  if (!loads) errs.push('`mechanism.loads` must be an array');
  (loads || []).forEach((l, i) => {
    const at = `mechanism.loads[${i}]`;
    const t = type(l?.part);
    if (!['revolute', 'prismatic'].includes(t)) { errs.push(`${at}.part must name a part on a revolute or prismatic joint`); return; }
    if (t === 'revolute' && !(Number.isFinite(l.torque) && l.torque >= 0)) errs.push(`${at}: '${l.part}' turns, so its load is a torque (N·m, ≥ 0)`);
    if (t === 'prismatic' && !(Number.isFinite(l.force) && l.force >= 0)) errs.push(`${at}: '${l.part}' slides, so its load is a force (N, ≥ 0)`);
  });
  if (mech.ignore != null && !(Array.isArray(mech.ignore) && mech.ignore.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => parts.has(n))))) errs.push('`mechanism.ignore` must be [[partA, partB], …], pairs that touch by design');
  if (mech.steps != null && !(Number.isInteger(mech.steps) && mech.steps >= 4 && mech.steps <= 180)) errs.push('`mechanism.steps` must be an integer 4–180 (the collision sweep\'s resolution)');
  return errs;
}

// ─── the model ────────────────────────────────────────────────────────────────────

function buildModel(mech, { bounds = {}, units = 'mm' } = {}) {
  const joints = {};
  for (const [name, j] of Object.entries(mech.joints)) {
    joints[name] = { name, type: j.type, on: j.on ?? null, center: j.center ? [...j.center] : [0, 0, 0], axis: j.axis ? unit(j.axis) : [0, 0, 1] };
  }
  const driveName = mech.drive.part;
  const drive = joints[driveName];
  const rev = drive.type === 'revolute';
  const from = mech.drive.from ?? 0;
  const to = mech.drive.to ?? (rev ? 360 : 0);
  const mode = mech.drive.mode ?? (rev && Math.abs(to - from) % 360 === 0 && to !== from ? 'loop' : 'swing');
  const toQ = (v) => (rev ? v * DEG : v);
  const unknowns = Object.values(joints).filter((j) => j.type !== 'fixed' && j.name !== driveName).map((j) => j.name);
  const couplings = (mech.couplings || []).map((c) => ({ ...c }));
  // a rack's direction comes from the geometry: the rack's centre sits on one side of the pinion, and a positive
  // turn carries the pitch line that way
  for (const c of couplings) {
    if (c.type !== 'rack') continue;
    const A = joints[c.a], B = joints[c.b], bb = bounds[c.b];
    const centre = bb ? mul(add(bb.min, bb.max), 0.5) : add(A.center, [0, -1, 0]);
    const off = sub(centre, A.center); const radial = sub(off, mul(A.axis, dot(off, A.axis)));
    const s = dot(cross(A.axis, radial), B.axis);
    c.sign = s < 0 ? -1 : 1;
  }
  for (const c of couplings) if (c.type === 'link') c.L = norm(sub(c.pa, c.pb));
  return { joints, driveName, drive, rev, from, to, mode, toQ, unknowns, couplings, mech, units, m: UNIT_M[units] ?? 0.001 };
}

function localOf(j, q) {
  if (j.type === 'revolute') { const R = rot(j.axis, q); return { R, p: sub(j.center, mv3(R, j.center)) }; }
  if (j.type === 'prismatic') return { R: I3(), p: mul(j.axis, q) };
  return IDENT();
}

/** Every jointed part's world transform for joint values `q` (rods are placed separately). */
function worldOf(model, q) {
  const out = {};
  const get = (name) => {
    if (out[name]) return out[name];
    const j = model.joints[name];
    if (!j) return IDENT();   // a part with no joint stands on the ground
    const local = localOf(j, q[name] ?? 0);
    out[name] = j.on ? compose(get(j.on), local) : local;
    return out[name];
  };
  for (const name of Object.keys(model.joints)) get(name);
  return out;
}

// the absolute turn of a part about `axis`: its own revolute value plus every ancestor's turning the same way
function absAngle(model, q, name, axis) {
  let a = 0; let n = name;
  while (n != null) {
    const j = model.joints[n];
    if (!j) break;
    if (j.type === 'revolute') { const d = dot(j.axis, axis); if (Math.abs(d) > 0.999) a += Math.sign(d) * (q[n] ?? 0); }
    n = j.on;
  }
  return a;
}
// the frame both members of a pair are carried in (a planet's carrier), or null for the ground
const frameOf = (model, c) => model.joints[c.a]?.on ?? model.joints[c.b]?.on ?? null;

function residuals(model, q) {
  const W = worldOf(model, q);
  const T = (n) => W[n] || IDENT();
  return model.couplings.map((c) => {
    const A = model.joints[c.a] || model.joints[c.b], B = model.joints[c.b] || model.joints[c.a];
    const C = frameOf(model, c);
    const rel = (n, axis) => absAngle(model, q, n, axis) - (C && C !== n ? absAngle(model, q, C, axis) : 0);
    switch (c.type) {
      case 'gear': return (c.teeth[0] * rel(c.a, A.axis) + c.teeth[1] * rel(c.b, A.axis)) / c.teeth[1];
      case 'ring': return (c.teeth[0] * rel(c.a, A.axis) - c.teeth[1] * rel(c.b, A.axis)) / c.teeth[1];
      case 'belt': return (c.d[0] * rel(c.a, A.axis) - c.d[1] * rel(c.b, A.axis)) / c.d[1];
      case 'rack': return (q[c.b] ?? 0) - c.sign * c.r * rel(c.a, A.axis);
      // a right-hand screw turned +θ about its axis moves a nut that cannot turn by −lead·θ/2π along that axis
      case 'screw': return (q[c.b] ?? 0) * dot(B.axis, A.axis) + (c.hand === 'left' ? -1 : 1) * c.lead * rel(c.a, A.axis) / TAU;
      case 'ratio': return (q[c.b] ?? 0) - c.ratio * (q[c.a] ?? 0);
      case 'link': return norm(sub(apply(T(c.a), c.pa), apply(T(c.b), c.pb))) - c.L;
      default: return 0;
    }
  });
}

// ─── linear algebra for a handful of unknowns ─────────────────────────────────────

function jacobian(model, q, names) {
  const r0 = residuals(model, q);
  const h = 1e-6;
  const J = r0.map(() => new Array(names.length).fill(0));
  names.forEach((n, k) => {
    const qp = { ...q, [n]: (q[n] ?? 0) + h }, qm = { ...q, [n]: (q[n] ?? 0) - h };
    const rp = residuals(model, qp), rm = residuals(model, qm);
    for (let i = 0; i < r0.length; i++) J[i][k] = (rp[i] - rm[i]) / (2 * h);
  });
  return { r: r0, J };
}
// rank of J by row reduction with partial pivoting, and the columns left without a pivot (the free joints)
function rankOf(J, n, tol = 1e-7) {
  const A = J.map((row) => [...row]);
  const pivotCols = []; let row = 0;
  for (let col = 0; col < n && row < A.length; col++) {
    let best = row; for (let i = row + 1; i < A.length; i++) if (Math.abs(A[i][col]) > Math.abs(A[best][col])) best = i;
    if (Math.abs(A[best][col]) < tol) continue;
    [A[row], A[best]] = [A[best], A[row]];
    for (let i = 0; i < A.length; i++) if (i !== row) { const f = A[i][col] / A[row][col]; for (let k = col; k < n; k++) A[i][k] -= f * A[row][k]; }
    pivotCols.push(col); row++;
  }
  return { rank: pivotCols.length, free: [...Array(n).keys()].filter((c) => !pivotCols.includes(c)) };
}
function solveSym(M, b) {
  const n = b.length, A = M.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c]; if (Math.abs(d) < 1e-300) return null;
    for (let i = c + 1; i < n; i++) { const f = A[i][c] / d; for (let k = c; k <= n; k++) A[i][k] -= f * A[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = A[i][n]; for (let k = i + 1; k < n; k++) s -= A[i][k] * x[k]; x[i] = s / A[i][i]; }
  return x;
}
const rms = (r) => Math.sqrt(r.reduce((s, v) => s + v * v, 0) / Math.max(1, r.length));

// damped Gauss–Newton from the guess; { q, residual, ok }
function solveStep(model, guess, tol) {
  const names = model.unknowns;
  let q = { ...guess }; let lambda = 1e-6;
  let { r, J } = jacobian(model, q, names); let err = rms(r);
  for (let it = 0; it < 60 && err > tol; it++) {
    const n = names.length;
    const JtJ = [...Array(n)].map((_, i) => [...Array(n)].map((__, k) => J.reduce((s, row) => s + row[i] * row[k], 0) + (i === k ? lambda : 0)));
    const Jtr = [...Array(n)].map((_, i) => -J.reduce((s, row, m) => s + row[i] * r[m], 0));
    const dx = solveSym(JtJ, Jtr); if (!dx) break;
    const trial = { ...q }; names.forEach((nm, i) => { trial[nm] = (trial[nm] ?? 0) + dx[i]; });
    const rt = residuals(model, trial); const et = rms(rt);
    if (et < err) { q = trial; ({ r, J } = jacobian(model, q, names)); err = et; lambda = Math.max(1e-12, lambda / 10); } else { lambda *= 10; if (lambda > 1e8) break; }
  }
  return { q, residual: err, ok: err <= tol };
}

// ─── the cycle ────────────────────────────────────────────────────────────────────

/** The drive value at cycle fraction u ∈ [0, 1] (radians or units): a loop runs from → to; a swing goes and returns. */
function driveAt(model, u) {
  const w = model.mode === 'swing' ? (u <= 0.5 ? 2 * u : 2 - 2 * u) : u;
  return model.toQ(model.from + (model.to - model.from) * w);
}

/**
 * Solve the cycle at `samples` + 1 evenly spaced fractions (the last equals the first for a loop). Returns
 * `{ model, samples: [{ u, s, q, ok }], lock, dof }`. Never throws on a lock: the samples stop there and `lock`
 * says where. Throws on a degrees-of-freedom refusal (a structural error, not a pose).
 */
export function solveMechanism(mech, opts = {}) {
  const model = buildModel(mech, opts);
  const names = model.unknowns;
  const tol = 1e-10 * Math.max(1, ...model.couplings.filter((c) => c.L).map((c) => c.L));
  // degrees of freedom at rest: every unknown joint must be pinned by the couplings
  const q0 = Object.fromEntries(Object.keys(model.joints).map((n) => [n, 0]));
  q0[model.driveName] = driveAt(model, 0);
  if (names.length) {
    const { J } = jacobian(model, { ...q0, [model.driveName]: 0 }, names);
    const { free } = rankOf(J, names.length);
    if (free.length) {
      const which = free.map((k) => `'${names[k]}'`).join(', ');
      throw new Error(`mechanism: ${which} ${free.length === 1 ? 'is' : 'are'} free — nothing couples ${free.length === 1 ? 'it' : 'them'} to the drive '${model.driveName}'. Add a coupling (a gear, belt, rack, screw, ratio or link) or make the part fixed (drop its joint, or { type: 'fixed', on }).`);
    }
  }
  const n = Math.max(4, opts.samples ?? ANIM_SAMPLES);
  const subSteps = 4;   // continuation sub-steps between samples, so a fast-moving linkage stays on its branch
  const samples = []; let q = { ...q0, [model.driveName]: 0 }; let lock = null;
  // a drive that starts away from the rest pose walks there first, on the authored branch
  const s0 = driveAt(model, 0);
  if (Math.abs(s0) > 1e-12 && names.length) {
    for (let k = 1; k <= 32 && !lock; k++) {
      const r = solveStep(model, { ...q, [model.driveName]: s0 * k / 32 }, tol);
      if (!r.ok) lock = { u: 0, drive: model.rev ? r3(s0 * k / 32 / DEG) : r3(s0 * k / 32), unit: model.rev ? '°' : model.units, reason: 'the mechanism cannot reach `from` from the authored pose' };
      q = r.q;
    }
  }
  for (let i = 0; i <= n && !lock; i++) {
    for (let k = subSteps; k >= 1 && !lock; k--) {
      const u = (i - (k - 1) / subSteps) / n;
      if (u < 0) continue;
      q = { ...q, [model.driveName]: driveAt(model, u) };
      const r = names.length ? solveStep(model, q, tol) : { q, ok: true, residual: 0 };
      if (!r.ok) {
        const v = model.rev ? Math.round((model.from + (model.to - model.from) * (model.mode === 'swing' ? Math.min(2 * u, 2 - 2 * u) : u)) * 10) / 10 : Math.round(driveAt(model, u) * 100) / 100;
        const links = model.couplings.filter((c) => c.type === 'link');
        lock = { u, drive: v, unit: model.rev ? '°' : model.units, reason: links.length ? `the link${links.length > 1 ? 's' : ''} cannot close: the mechanism reaches a dead point or a limit of its travel there (for a four-bar, check Grashof: shortest + longest ≤ the sum of the other two for the crank to turn fully)` : 'the couplings cannot all hold there' };
        break;
      }
      q = r.q;
    }
    if (!lock) samples.push({ u: i / n, s: q[model.driveName], q: { ...q }, ok: true });
  }
  return { model, samples, lock, dof: 1 };
}

/** Every part's world transform at a solved sample: jointed parts, rods placed on their pins, the rest at rest. */
export function transformsAt(model, q, partNames) {
  const W = worldOf(model, q);
  const out = {};
  for (const n of partNames) out[n] = W[n] || IDENT();
  for (const c of model.couplings) {
    if (c.type !== 'link' || !c.rod) continue;
    const PA = apply(out[c.a], c.pa), PB = apply(out[c.b], c.pb);
    const axis = c.axis ? unit(c.axis) : (model.joints[c.a]?.type === 'revolute' ? model.joints[c.a].axis : model.joints[c.b]?.type === 'revolute' ? model.joints[c.b].axis : unit(cross(sub(c.pb, c.pa), [0, 0, 1])));
    const flat = (v) => sub(v, mul(axis, dot(v, axis)));
    const d0 = unit(flat(sub(c.pb, c.pa))), d1 = unit(flat(sub(PB, PA)));
    const ang = Math.atan2(dot(axis, cross(d0, d1)), dot(d0, d1));
    const R = rot(axis, ang);
    out[c.rod] = { R, p: sub(PA, mv3(R, c.pa)) };
  }
  return out;
}

// the axis and angle of a rotation matrix, or null for the identity
function axisAngle(R) {
  const tr = R[0][0] + R[1][1] + R[2][2];
  const ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  if (ang < 1e-9) return null;
  const v = [R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]];
  if (norm(v) < 1e-9) return null;   // a half turn: the axis is not recoverable this way; the caller falls back
  return { axis: unit(v), angle: ang };
}

/**
 * The World's mover entries for a solved cycle: a ground revolute is a `turn` table, a pure translation a `path`,
 * anything else a `pose` (path + a tilt about one axis). Parts that never move get none.
 */
export function mechanismMovers(solved, partNames) {
  const { model, samples } = solved;
  if (!samples.length) return [];
  const period = model.mech.drive.period ?? DEFAULT_PERIOD;
  const frames = samples.map((s) => transformsAt(model, s.q, partNames));
  const movers = [];
  for (const name of partNames) {
    const Ts = frames.map((f) => f[name]);
    const moves = Ts.some((T) => norm(T.p) > 1e-9 || Math.abs(T.R[0][0] - 1) + Math.abs(T.R[1][1] - 1) + Math.abs(T.R[2][2] - 1) > 1e-9);
    if (!moves) continue;
    const j = model.joints[name];
    const base = { group: name, label: name, basePos: [0, 0, 0], period, loop: true, mechanism: true };
    if (j && j.type === 'revolute' && !j.on) {
      movers.push({ ...base, turn: { center: j.center, axis: j.axis, absolute: true, angles: samples.map((s) => round6(s.q[name])) } });
      continue;
    }
    const rotates = Ts.some((T) => axisAngle(T.R));
    if (!rotates) { movers.push({ ...base, path: Ts.map((T) => T.p.map(round6)) }); continue; }
    // one fixed axis for the whole cycle: the first non-identity sample's, signed per sample
    const ref = Ts.map((T) => axisAngle(T.R)).find(Boolean).axis;
    const angles = Ts.map((T) => { const aa = axisAngle(T.R); if (!aa) return 0; return Math.sign(dot(aa.axis, ref)) * aa.angle; });
    const planar = Ts.every((T, i) => { const R2 = rot(ref, angles[i]); return T.R.every((row, a) => row.every((v, b) => Math.abs(v - R2[a][b]) < 1e-6)); });
    if (!planar) continue;   // a spatial tumble the one-axis pose cannot play; the report still measures it
    movers.push({ ...base, pose: true, path: Ts.map((T) => T.p.map(round6)), tilt: { axis: ref, angles: angles.map(round6) } });
  }
  return movers;
}
const round6 = (v) => Math.round(v * 1e6) / 1e6;

// ─── forces by virtual work ───────────────────────────────────────────────────────

/** A lead screw's efficiency driving the nut, and back-driven by it, from its lead angle and friction. */
export function screwEfficiency({ lead, d, mu = SCREW_MU }) {
  const dm = Number.isFinite(d) && d > 0 ? d : null;
  if (!dm) return { eta: 0.3, assumed: true, note: `no pitch diameter (\`d\`) given, so 0.3 is assumed (a typical trapezoid lead screw)` };
  const lam = Math.atan(lead / (Math.PI * dm)); const phi = Math.atan(mu);
  const eta = Math.tan(lam) / Math.tan(lam + phi);
  const back = lam > phi ? Math.tan(lam - phi) / Math.tan(lam) : 0;
  return { eta, back, selfLocking: lam <= phi, leadAngleDeg: lam / DEG, frictionDeg: phi / DEG, mu };
}

function couplingEta(c) {
  if (c.efficiency != null) return c.efficiency;
  if (c.type === 'screw') return screwEfficiency(c).eta;
  return EFFICIENCY[c.type] ?? 1;
}

// best product of efficiencies from the drive to every part, over couplings and `on` (riding costs nothing)
function pathEfficiency(model) {
  const edges = [];
  for (const c of model.couplings) { const e = couplingEta(c); edges.push([c.a, c.b, e], [c.b, c.a, e]); if (c.rod) edges.push([c.a, c.rod, e], [c.b, c.rod, e]); }
  for (const j of Object.values(model.joints)) if (j.on) edges.push([j.on, j.name, 1], [j.name, j.on, 1]);
  const best = { [model.driveName]: 1 };
  for (let pass = 0; pass < 32; pass++) {
    let changed = false;
    for (const [a, b, e] of edges) if (best[a] != null && (best[b] == null || best[a] * e > best[b] + 1e-12)) { best[b] = best[a] * e; changed = true; }
    if (!changed) break;
  }
  return best;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const sig = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.abs(v) >= 1 ? Math.round(v * 100) / 100 : Math.round(v * 10000) / 10000);

/**
 * The numbers: per joint the range, the ratio to the drive (dq/ds), peak speed, and — with loads — the effort the
 * drive needs through the cycle, its worst point, and the margin against a stated drive torque or force.
 */
export function mechanismReport(solved) {
  const { model, samples, lock } = solved;
  const mech = model.mech;
  const units = model.units;
  const driveUnit = model.rev ? 'rad' : units;
  const period = mech.drive.period ?? DEFAULT_PERIOD;
  // the drive's speed: stated (rpm for a turn, units/s for a slide), else the World's own cycle
  const travel = Math.abs(model.toQ(model.to) - model.toQ(model.from)) * (model.mode === 'swing' ? 2 : 1);
  const sRate = mech.drive.speed != null ? (model.rev ? mech.drive.speed * TAU / 60 : mech.drive.speed) : travel / period;   // drive units per second
  const n = samples.length;
  const deriv = (name, i) => {   // dq/ds by a central difference; one-sided where a swing turns back (ds → 0)
    const tries = [[i - 1, i + 1], [i, i + 1], [i - 1, i]];
    for (const [x, y] of tries) {
      const a = samples[Math.max(0, x)], b = samples[Math.min(n - 1, y)];
      const ds = b.s - a.s; if (Math.abs(ds) > 1e-9) return (b.q[name] - a.q[name]) / ds;
    }
    return 0;
  };
  const etaTo = pathEfficiency(model);
  const joints = {};
  for (const j of Object.values(model.joints)) {
    if (j.type === 'fixed') continue;
    const vals = samples.map((s) => s.q[j.name] ?? 0);
    const ratios = samples.map((_, i) => (j.name === model.driveName ? 1 : deriv(j.name, i)));
    const absR = ratios.map(Math.abs);
    const rotary = j.type === 'revolute';
    const fmtV = (v) => (rotary ? r3(v / DEG) : r3(v));
    const entry = {
      type: j.type,
      range: [fmtV(Math.min(...vals)), fmtV(Math.max(...vals))], range_unit: rotary ? '°' : units,
      ratio: { min: sig(Math.min(...ratios)), max: sig(Math.max(...ratios)), unit: `${rotary ? 'rad' : units} per ${driveUnit} of drive` },
      peak_speed: rotary ? { value: sig(Math.max(...absR) * sRate * 60 / TAU), unit: 'rpm' } : { value: sig(Math.max(...absR) * sRate), unit: `${units}/s` },
      efficiency_from_drive: etaTo[j.name] != null ? r3(etaTo[j.name]) : null,
    };
    if (Math.max(...absR) - Math.min(...absR) < 1e-6 * Math.max(1, Math.max(...absR))) entry.ratio = { constant: sig(ratios[0]), unit: entry.ratio.unit };
    joints[j.name] = entry;
  }
  // effort: Σ over loads of |Q · dq/ds| / η, in N·m (a revolute drive, s in rad) or N (a prismatic drive, s in m)
  const loads = mech.loads || [];
  let effort = null;
  if (loads.length && n >= 2) {
    const dsToSI = model.rev ? 1 : model.m;   // ds in m for a slide
    const series = samples.map((_, i) => loads.reduce((sum, l) => {
      const j = model.joints[l.part]; const r = l.part === model.driveName ? 1 : deriv(l.part, i);
      const dqSI = j.type === 'revolute' ? r : r * model.m;           // dq in rad or m per drive unit
      const Q = j.type === 'revolute' ? l.torque : l.force;
      return sum + Math.abs(Q * dqSI / dsToSI) / Math.max(1e-6, etaTo[l.part] ?? 1);
    }, 0));
    let k = 0; for (let i = 1; i < n; i++) if (series[i] > series[k]) k = i;
    const atDrive = model.rev ? r3(samples[k].s / DEG) : r3(samples[k].s);
    const unitE = model.rev ? 'N·m' : 'N';
    effort = {
      unit: unitE,
      peak: sig(series[k]), at_drive: atDrive, at_unit: model.rev ? '°' : units,
      mean: sig(series.reduce((a, b) => a + b, 0) / n),
      peak_power_w: sig(series[k] * (model.rev ? sRate : sRate * model.m)),
    };
    const rating = model.rev ? mech.drive.torque : mech.drive.force;
    if (Number.isFinite(rating)) {
      const required = series[k];
      const ok = required <= rating + 1e-9;
      effort.margin = { ok, required: sig(required), rating, utilization: r3(rating > 0 ? required / rating : Infinity), margin_frac: r3(rating > 0 ? (rating - required) / rating : -1) };
    }
  }
  // with a stated drive torque or force: what each loaded joint can deliver at its worst point of the cycle
  const rating = model.rev ? mech.drive.torque : mech.drive.force;
  let available = null;
  if (Number.isFinite(rating) && n >= 2) {
    available = {};
    for (const j of Object.values(model.joints)) {
      if (j.type === 'fixed' || j.name === model.driveName) continue;
      const dsToSI = model.rev ? 1 : model.m;
      const outs = samples.map((_, i) => { const r = Math.abs(deriv(j.name, i)) * (j.type === 'revolute' ? 1 : model.m) / dsToSI; return r < 1e-9 ? Infinity : rating * (etaTo[j.name] ?? 1) / r; });
      let k = 0; for (let i = 1; i < n; i++) if (outs[i] < outs[k]) k = i;
      if (!Number.isFinite(outs[k])) continue;
      available[j.name] = { min: sig(outs[k]), unit: j.type === 'revolute' ? 'N·m' : 'N', at_drive: model.rev ? r3(samples[k].s / DEG) : r3(samples[k].s) };
    }
  }
  const screws = model.couplings.filter((c) => c.type === 'screw').map((c) => {
    const e = c.efficiency != null ? { eta: c.efficiency, stated: true } : screwEfficiency(c);
    return { a: c.a, b: c.b, lead: c.lead, efficiency: r3(e.eta), ...(e.selfLocking != null ? { self_locking: e.selfLocking, back_drive_efficiency: r3(e.back), lead_angle_deg: r3(e.leadAngleDeg), friction_angle_deg: r3(e.frictionDeg) } : {}), ...(e.note ? { note: e.note } : {}) };
  });
  return {
    drive: { part: model.driveName, type: model.drive.type, from: model.from, to: model.to, unit: model.rev ? '°' : units, mode: model.mode, period_s: period, speed: model.rev ? { value: sig(sRate * 60 / TAU), unit: 'rpm', stated: mech.drive.speed != null } : { value: sig(sRate), unit: `${units}/s`, stated: mech.drive.speed != null } },
    samples: n,
    ...(lock ? { lock } : {}),
    joints,
    ...(effort ? { effort } : {}),
    ...(available && Object.keys(available).length ? { available } : {}),
    ...(screws.length ? { screws } : {}),
    assumptions: 'Rigid parts, no inertia, no deflection; loads oppose the motion; efficiencies as stated per coupling (gear 0.98, ring 0.97, belt 0.96, rack 0.95, ratio 0.9, pins frictionless; a screw from its lead angle at μ 0.2) unless `efficiency` is given. Strength is not assessed.',
  };
}

// ─── collisions across the cycle ──────────────────────────────────────────────────

const mmText = (T) => `multmatrix(${JSON.stringify(toMultmatrix(T).map((row) => row.map((v) => Math.round(v * 1e9) / 1e9)))})`;
const sameT = (A, B) => A.R.every((row, i) => row.every((v, k) => Math.abs(v - B.R[i][k]) < 1e-9)) && A.p.every((v, i) => Math.abs(v - B.p[i]) < 1e-9);
const inv = (T) => { const Rt = [0, 1, 2].map((i) => [0, 1, 2].map((k) => T.R[k][i])); return { R: Rt, p: mul(mv3(Rt, T.p), -1) }; };

// the eight corners of a box under a transform, as a box again
function movedBox(b, T) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) {
    const v = apply(T, [x, y, z]); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], v[i]); hi[i] = Math.max(hi[i], v[i]); }
  }
  return { min: lo, max: hi };
}
const boxesMeet = (a, b) => [0, 1, 2].every((i) => a.min[i] <= b.max[i] && b.min[i] <= a.max[i]);

/**
 * Intersect every pair of parts at `steps` evenly spaced points of the solved cycle. A pair whose moved bounding
 * boxes never meet is clear without a render; a pair that moves rigidly together is rendered once; every other pair
 * is rendered once as a union over the steps, and only a pair that comes back non-empty is rendered step by step.
 * `render(program)` resolves `{ empty, volume, centre }`. Returns `{ steps, pairs: [{ a, b, clear, … }], renders }`.
 */
export async function sweepCollisions(solved, { partNames, statements, bounds, steps = DEFAULT_STEPS, ignore = [], minVolume = 1e-3, render }) {
  const { model, samples } = solved;
  const n = samples.length;
  const pick = [...new Set([...Array(Math.min(steps, n)).keys()].map((k) => Math.round(k * (n - 1) / Math.max(1, Math.min(steps, n)))))];
  const at = pick.map((i) => ({ i, sample: samples[i], T: transformsAt(model, samples[i].q, partNames) }));
  const skip = new Set(ignore.map(([a, b]) => [a, b].sort().join('\u0000')));
  const label = (st) => (model.rev ? r3(st.sample.s / DEG) : r3(st.sample.s));
  const pairs = []; let renders = 0;
  const intersect = (a, b, list) => list.map((st) => `intersection(){ ${mmText(st.T[a])} { ${statements[a]} } ${mmText(st.T[b])} { ${statements[b]} } }`).join('\n');
  for (let x = 0; x < partNames.length; x++) for (let y = x + 1; y < partNames.length; y++) {
    const a = partNames[x], b = partNames[y];
    if (skip.has([a, b].sort().join('\u0000'))) { pairs.push({ a, b, ignored: true }); continue; }
    const live = at.filter((st) => !bounds[a] || !bounds[b] || boxesMeet(movedBox(bounds[a], st.T[a]), movedBox(bounds[b], st.T[b])));
    if (!live.length) { pairs.push({ a, b, clear: true, by: 'bounding boxes never meet' }); continue; }
    const rigid = live.every((st) => sameT(compose(inv(live[0].T[a]), st.T[b]), compose(inv(live[0].T[a]), live[0].T[b])) && sameT(st.T[a], live[0].T[a]));
    const relConst = live.every((st) => sameT(compose(inv(st.T[a]), st.T[b]), compose(inv(live[0].T[a]), live[0].T[b])));
    const list = rigid || relConst ? [live[0]] : live;
    renders++;
    const all = await render(`union(){\n${intersect(a, b, list)}\n}`);
    if (all.empty || all.volume < minVolume) { pairs.push({ a, b, clear: true, by: relConst ? 'one render (they move together)' : `one render across ${list.length} steps` }); continue; }
    const hits = [];
    for (const st of list) {
      renders++;
      const r = await render(intersect(a, b, [st]));
      if (!r.empty && r.volume >= minVolume) hits.push({ step: st.i, drive: label(st), volume: Math.round(r.volume * 1000) / 1000, at: r.centre ? r.centre.map((v) => Math.round(v * 100) / 100) : null });
    }
    if (!hits.length) { pairs.push({ a, b, clear: true, by: 'per-step renders (the union was a sliver)' }); continue; }
    let worst = hits[0]; for (const h of hits) if (h.volume > worst.volume) worst = h;
    pairs.push({ a, b, clear: false, steps_colliding: hits.length, of: list.length, first_at: hits[0].drive, worst: { drive: worst.drive, volume: worst.volume, at: worst.at }, ...(relConst ? { always: true } : {}) });
  }
  return { steps: at.length, drive_unit: model.rev ? '°' : model.units, pairs, renders };
}
