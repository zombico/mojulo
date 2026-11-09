/**
 * mecha-gap-makers — giant arm packs by design house: a house's philosophy (what it puts first) solved into a pack and its
 * two giant arms, as inventory rows the shelf builds like any other. The solver proportions the arm, places every ram's
 * pins so each joint still turns its full working arc, sizes each actuator by statics for the house's rated lift, and
 * dresses every part in the house's construction and colours. The laws then hold what was solved like any built frame.
 *
 *   MECHA_MAKERS          the houses (generic, no maker's): each a philosophy card
 *     label, says          what it is called and what it puts first
 *     k                    the arm's size against the utility walker's design (its lengths times k)
 *     fore                 the forearm's length against the upper arm's (reach drawn out, or strength held in)
 *     wk                   its arm's sections against the design's (deeper for strength, slimmer for lightness)
 *     beam                 how its arms are built: 'plated' (box under bolted plates), 'tube' (round tube and collars),
 *                          'truss' (open lattice), 'sealed' (under bellows sleeves)
 *     shoulder, pack       its shoulders' and its pack's construction (mecha-parts.js families)
 *     actuator             'hydraulic' (rams at the system pressure) or 'screw' (electric screw actuators, rated by force)
 *     hand                 its own hand: { family: 'hand' | 'gripper', fingers }
 *     target               the load its two arms are rated to heave, kg: what its actuators are sized for
 *     livery               its colours over the frame's palette (paint, trim, light)
 *     at                   its shoulders on its pack [across, ahead, up]; flow, its pump's l/min
 *   makerRows(R, scaleDims) → { sku: row } every house's rows (R the inventory's row builder), each sku
 *                        `${part}-${house}` (MAKER_PARTS); makerHand(house) its hand as a tool card
 *   solveMount(kind, L1, L2, { spread, arc }) → the ram's pins, closed length and stroke for a joint's working arc
 *                        (design scale); arcsFor(L1, L2, poses) the arcs an arm's poses ask
 *
 * Deterministic: a fixed grid searched in a fixed order, no dice.
 */
import { DEG, G, SYSTEM_PRESSURE } from './mecha-common.js';
import { solveArm } from './mecha-ik.js';
import { ARM_POSES } from './mecha-archetypes.js';

export const MECHA_MAKERS = Object.freeze({
  forge: Object.freeze({
    label: 'forge house', says: 'strength first: cast and plated, short and deep arms, heavy hydraulics, a four-fingered hand',
    k: 2.0, fore: 0.85, wk: 1.15, spread: 0.18, beam: 'plated', shoulder: 'armoured', pack: 'giant', actuator: 'hydraulic',
    hand: Object.freeze({ family: 'hand', fingers: 4 }), target: 2600, at: Object.freeze([1.12, 0.42, 1.06]), flow: 260,
    livery: Object.freeze({ paint: '#5d6369', trim: '#25272a', light: '#e8742a' }),
  }),
  aero: Object.freeze({
    label: 'aero house', says: 'reach first: slender tube arms, a long forearm, electric screw actuators, faired shoulders on one mast',
    k: 2.0, fore: 1.3, wk: 0.85, spread: 0.1, beam: 'tube', shoulder: 'faired', pack: 'spine', actuator: 'screw',
    hand: Object.freeze({ family: 'hand', fingers: 3 }), target: 1400, at: Object.freeze([1.0, 0.34, 1.2]), flow: 200,
    livery: Object.freeze({ paint: '#e6e9ec', trim: '#3a4656', light: '#2f6fbf' }),
  }),
  truss: Object.freeze({
    label: 'truss house', says: 'service first, built like a crane: open lattice towers and arms, every pin in reach, a parallel gripper',
    k: 2.0, fore: 1.1, wk: 1.0, spread: 0.15, beam: 'truss', shoulder: 'truss', pack: 'gantry', actuator: 'hydraulic',
    hand: Object.freeze({ family: 'gripper', fingers: 2 }), target: 2200, at: Object.freeze([1.06, 0.42, 1.1]), flow: 240,
    livery: Object.freeze({ paint: '#c8322c', trim: '#2b2c2e', light: '#f2ece0' }),
  }),
  sealed: Object.freeze({
    label: 'sealed house', says: 'protection first, for hazardous sites: every joint under bellows, every shell closed, electric actuators inside',
    k: 1.9, fore: 0.95, wk: 1.15, spread: 0.11, beam: 'sealed', shoulder: 'sealed', pack: 'sealed', actuator: 'screw',
    hand: Object.freeze({ family: 'hand', fingers: 3 }), target: 1800, at: Object.freeze([1.0, 0.42, 1.0]), flow: 220,
    livery: Object.freeze({ paint: '#c9cdd0', trim: '#3a3f44', light: '#f2c230' }),
  }),
});
export const MECHA_MAKER_IDS = Object.freeze(Object.keys(MECHA_MAKERS));

// ── the mount solver: a ram's pins for a joint's working arc ───────────────────────────────────────────────────
const rx = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const r3 = (v) => Math.round(v * 1000) / 1000;
/** The working arcs a giant arm's joints are solved for at the least (degrees): an arm's poses widen them (arcsFor). */
export const ARCS = Object.freeze({ shoulder: Object.freeze([-25, 110]), elbow: Object.freeze([5, 120]) });
/** A joint's working arc for an arm's proportions: ARCS, widened to every pose the arm is carried in (its wrist's place as
 *  shares of its length) with a margin of 5°. */
export function arcsFor(L1, L2, poses) {
  const out = { shoulder: [...ARCS.shoulder], elbow: [...ARCS.elbow] }, n = L1 + L2;
  for (const P of Object.values(poses)) {
    const a = solveArm({ l1: L1, l2: L2 }, [P.wrist[0] * n, P.wrist[1] * n], 0).values;
    out.shoulder = [Math.min(out.shoulder[0], Math.floor(a.pitch - 5)), Math.max(out.shoulder[1], Math.ceil(a.pitch + 5))];
    out.elbow = [Math.min(out.elbow[0], Math.floor(a.elbow - 5)), Math.max(out.elbow[1], Math.ceil(a.elbow + 5))];
  }
  return out;
}
/** A ram's lengths over an arc (a margin past each end, every `step` degrees): monotone, no longer than a ram can stroke
 *  (1.62 times its closed length), and its least moment arm (m per radian) → or null. */
function score(L, [a, b], step) {
  const ls = [];
  for (let v = a - 3; v <= b + 3; v += step) ls.push(L(v * DEG));
  const s = Math.sign(ls[1] - ls[0]);
  for (let i = 1; i < ls.length; i++) if (Math.sign(ls[i] - ls[i - 1]) !== s) return null;
  const mn = Math.min(...ls), mx = Math.max(...ls);
  if (mx / mn > 1.62) return null;
  let arm = Infinity;
  for (let i = 1; i < ls.length - 2; i++) arm = Math.min(arm, Math.abs(ls[i + 1] - ls[i]) / (step * DEG));
  return { mn, mx, arm };
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
/** The best point of a box of variables by `f(x, step)` (higher `arm` is better, null refused): a coarse grid over the
 *  box read every 3°, then, from each of its best eight, three rounds of a finer grid round the best so far, each at half
 *  the last's step, read every 1°. Fixed order, no dice. */
function search(box, f) {
  const better = (a, b) => !b || a.v.arm > b.v.arm;
  const coarse = [];
  const sweep = (axes, visit, at = []) => { if (at.length === axes.length) return visit(at); for (const v of axes[at.length]) sweep(axes, visit, [...at, v]); };
  sweep(box.map(([lo, hi]) => Array.from({ length: 7 }, (_, i) => r3(lo + ((hi - lo) * i) / 6))), (x) => { const v = f(x, 3); if (v) coarse.push({ x, v }); });
  coarse.sort((a, b) => b.v.arm - a.v.arm);
  let best = null;
  for (const seed of coarse.slice(0, 8)) {
    let here = null, step = box.map(([lo, hi]) => (hi - lo) / 6);
    const visit = (x) => { const v = f(x, 1); if (v && better({ x, v }, here)) here = { x, v }; };
    visit(seed.x);
    for (let round = 0; round < 3; round++) {
      step = step.map((s) => s / 2);
      const c = (here ?? seed).x;
      sweep(box.map(([lo, hi], i) => [-1, 0, 1].map((d) => r3(Math.min(hi, Math.max(lo, c[i] + d * step[i]))))), visit);
    }
    if (here && better(here, best)) best = here;
  }
  return best;
}
const SOLVED = new Map();
/**
 * A joint's ram, solved at the design's scale (an arm its upper arm L1 long, its forearm L2): its two pins (each
 * [ahead, up] from its body's pivot), its closed length and its stroke, the best of the search by its least moment arm
 * over its arc (a coarse pass every 3°, the answer checked every 1°). `spread`, how far off the beam a house sets its pins
 * (a wide horn for leverage, a slim one inside a sleeve); 'shoulder': the horn on the shoulder's housing, the bracket on
 * the upper arm; 'elbow': the base on the upper arm, the eye on the forearm.
 */
export function solveMount(kind, L1, L2, { spread = 0.14, arc = arcsFor(L1, L2, {})[kind] } = {}) {
  const key = `${kind}|${L1}|${L2}|${spread}|${arc}`;
  if (SOLVED.has(key)) return SOLVED.get(key);
  const s = spread;
  const lengthOf = kind === 'shoulder'
    ? ([hy, hz, ty, tz]) => (v) => dist([hy, hz], rx([ty, tz], v))
    : ([by, bz, ey, ez]) => (v) => { const e = rx([ey, ez], v); return dist([by, bz], [e[0], e[1] - L1]); };
  const fits = kind === 'shoulder'
    ? ([hy, , ty]) => Math.abs(hy) >= 0.04 && Math.abs(ty) >= 0.06
    : ([by, , ey, ez]) => Math.abs(by) >= 0.06 && Math.hypot(ey, ez) >= 0.08;
  const box = kind === 'shoulder' ? [[-s, s], [0.04, 0.04 + s], [-s, s], [-(L1 - 0.09), -0.2]] : [[-s, s], [-(L1 - 0.13), -0.12], [-s, s], [-0.14, 0.08]];
  const top = search(box, (x, step) => (fits(x) ? score(lengthOf(x), arc, step) : null)), fine = top?.v;
  if (!fine) throw new Error(`mecha makers: no ${kind} ram reaches its ${arc[0]}..${arc[1]}° arc on a ${L1} m upper arm`);
  const [a0, a1, b0, b1] = top.x;
  const out = Object.freeze({ A: Object.freeze([a0, a1]), B: Object.freeze([b0, b1]), arc: Object.freeze([...arc]), closed: Math.ceil(fine.mn * 1000) / 1000, stroke: Math.floor((fine.mx - fine.mn) * 1000) / 1000, arm: fine.arm });
  SOLVED.set(key, out);
  return out;
}
/** A solved ram's moment arm at a joint's value (design scale, m per radian). */
function armAt(kind, M, L1, deg) {
  const L = kind === 'shoulder' ? (v) => dist(M.A, rx(M.B, v)) : (v) => { const e = rx(M.B, v); return dist(M.A, [e[0], e[1] - L1]); };
  return Math.abs(L((deg + 0.5) * DEG) - L((deg - 0.5) * DEG)) / DEG;
}

// ── the sizing: each actuator by statics for the house's rated heave ─────────────────────────────────────────────
const BORES = Object.freeze([0.063, 0.08, 0.1, 0.125, 0.14, 0.16, 0.18, 0.2, 0.22, 0.25]);
const FORCES = Object.freeze([25e3, 40e3, 63e3, 80e3, 100e3, 125e3, 160e3, 200e3, 250e3, 320e3, 400e3]);
/** The smallest actuator of its kind holding `F` newtons: a ram's bore (pulling, on the annulus round its rod), or an
 *  electric screw actuator's rated force. */
function actuatorFor(kind, F) {
  if (kind === 'screw') { const force = FORCES.find((f) => f >= F) ?? FORCES[FORCES.length - 1]; return { force, bore: Math.round(Math.sqrt(force / 1.4e7) * 2 * 1000) / 1000 }; }
  const bore = BORES.find((b) => SYSTEM_PRESSURE * Math.PI * ((b / 2) ** 2) * (1 - 0.56 ** 2) >= F) ?? BORES[BORES.length - 1];
  return { bore, rod: Math.round(bore * 0.56 * 1000) / 1000 };
}

/** A house's own hand as a tool card (mecha-tools.js's shape): it takes the giant hand's place on a pack of its house,
 *  rated to hold its share of the house's rated heave. */
export function makerHand(id) {
  const m = MECHA_MAKERS[id];
  if (!m) throw new Error(`Unknown giant arm house '${id}'; expected one of: ${MECHA_MAKER_IDS.join(', ')}`);
  const word = m.hand.family === 'gripper' ? 'gripper' : 'hand';
  return Object.freeze({ sku: `hand-${id}`, label: `${m.label.replace(' house', '')} giant ${word}`, task: `grips, carries and places as the ${m.label} builds it: ${m.says.split(':')[0]}`, holds: m.target / 2, circuit: 'clamp', flow: 40 });
}
/** The parts a house makes, by their sku's prefix (`${part}-${house}`): its giant arm's, its hand, its pack. */
export const MAKER_PARTS = Object.freeze(['shoulder', 'upperarm', 'forearm', 'wrist', 'ram-shoulder', 'ram-elbow', 'hand', 'gap']);
/** Every house's rows: its pack, its giant arm's parts and rams, its hand; `R` the inventory's row builder, `scaleDims`
 *  its scaler. */
export function makerRows(R, scaleDims) {
  const rows = {};
  for (const [id, m] of Object.entries(MECHA_MAKERS)) {
    const L1 = 0.55, L2 = Math.round(0.55 * m.fore * 1000) / 1000, k = m.k, wk = m.wk, label = m.label.replace(' house', '');
    const arcs = arcsFor(L1, L2, ARM_POSES), S = solveMount('shoulder', L1, L2, { spread: m.spread, arc: arcs.shoulder }), E = solveMount('elbow', L1, L2, { spread: m.spread, arc: arcs.elbow });
    // (a row drawn at the design's size and scaled whole: its numbers in true metres, `scale` its factor)
    const scaled = (kind, name, design, mass, build, aliases, over = {}) => R(kind, `${label} ${name}`, `${m.label} giant arm`, { ...scaleDims(design, k), ...over, scale: k }, mass, build, aliases);
    const live = { livery: m.livery, maker: id };
    // (the masses the sizing weighs: the arm's segments grown with its size and its sections)
    const mu = Math.round(17 * k ** 3 * wk ** 2 * (L1 / 0.55)), mf = Math.round(13 * k ** 3 * wk ** 2 * (L2 / 0.52)), mw = Math.round(6 * k ** 3);
    const hand = m.hand.family === 'gripper'
      ? { dims: { palm: [0.42, 0.26, 0.2], finger: 0.5, gap: 0.42, r: 0.05, fingers: 2 }, mass: 190 }
      : { dims: { palm: m.hand.fingers === 4 ? [0.44, 0.34, 0.3] : [0.34, 0.28, 0.24], finger: m.hand.fingers === 4 ? 0.46 : 0.42, thumb: 0.34, r: m.hand.fingers === 4 ? 0.058 : 0.046, fingers: m.hand.fingers }, mass: m.hand.fingers === 4 ? 260 : 180 };
    // (the heave, solved: each arm's wrist ahead at the carry's shares, its hand's fingers ahead; the lever of each mass
    // about the shoulder and the elbow, the moment arm of each ram there)
    const l1 = L1 * k, l2 = L2 * k, n = l1 + l2, a = solveArm({ l1, l2 }, [0.58 * n, -0.393 * n], 90).values;
    const th = a.pitch * DEG, el = [l1 * Math.sin(th), -l1 * Math.cos(th)], wr = [0.58 * n, -0.393 * n], tl = 0.1 * k + hand.dims.palm[2] + 0.06 + hand.dims.finger * 0.8;
    const tip = [wr[0] + tl, wr[1]], Q = m.target / 2;
    const tauE = G * (Q * (tip[0] - el[0]) + hand.mass * (wr[0] + tl / 2 - el[0]) + mw * (wr[0] - el[0]) + mf * ((wr[0] - el[0]) / 2));
    const tauS = G * (Q * tip[0] + hand.mass * (wr[0] + tl / 2) + mw * wr[0] + mf * (el[0] + wr[0]) / 2 + mu * el[0] / 2);
    // (each ram sized for its torque at the heave on its moment arm there, with the rating's margin: rated at 87% of the
    // hydraulic limit, and a tenth over)
    const need = (tau, kind, M, deg) => (1.1 * tau) / (0.87 * armAt(kind, M, L1, deg) * k);
    const sAct = actuatorFor(m.actuator, need(tauS, 'shoulder', S, a.pitch)), eAct = actuatorFor(m.actuator, need(tauE, 'elbow', E, a.elbow));
    const wristTorque = Math.ceil((1.3 * G * (Q * tl + hand.mass * tl / 2)) / 1000) * 1000;
    const ram = (name, M, act, aliases) => scaled('mecha-ram', name, { bore: 0.063, rod: 0.036, closed: M.closed, stroke: M.stroke }, Math.round(6 * k ** 3 * (act.bore / 0.126) ** 2), { family: m.actuator === 'screw' ? 'screw' : 'double', ...(m.beam === 'sealed' ? { boot: true } : {}), ...live }, aliases,
      { bore: act.bore, rod: act.rod ?? Math.round(act.bore * 0.5 * 1000) / 1000, ...(act.force ? { force: act.force } : {}) });
    rows[`shoulder-${id}`] = scaled('mecha-shoulder', 'giant shoulder', { r: 0.09, drop: 0, horn: [0.11, S.A[0], S.A[1]], stop: [-30, 45], torque: 1200 }, Math.round(16 * k ** 3 * wk), { family: m.shoulder, ...live }, [`${label} giant shoulder`],
      { torque: Math.round(1200 * k ** 4), ...(m.shoulder === 'armoured' ? { block: [0.68, 0.76, 0.54] } : {}) });
    rows[`upperarm-${id}`] = scaled('mecha-upperarm', 'giant upper arm', { length: L1, w: 0.11 * wk, d0: 0.15 * wk, d1: 0.12 * wk, shoulderRam: [0.11, S.B[0], S.B[1]], elbowRam: [-0.11, E.A[0], E.A[1]], clevis: 0.13 }, mu, { family: m.beam, ...live }, [`${label} giant upper arm`]);
    rows[`forearm-${id}`] = scaled('mecha-forearm', 'giant forearm', { length: L2, w: 0.1 * wk, d0: 0.13 * wk, d1: 0.1 * wk, elbowEye: [-0.11, E.B[0], E.B[1]] }, mf, { family: m.beam, ...live }, [`${label} giant forearm`]);
    rows[`wrist-${id}`] = scaled('mecha-wrist', 'giant wrist', { r: 0.06, drop: 0.1, stop: [-110, 110], torque: 600 }, mw, { family: 'rotary', ...live }, [`${label} giant wrist`], { torque: wristTorque });
    rows[`ram-shoulder-${id}`] = ram('giant shoulder actuator', S, sAct, [`${label} giant shoulder actuator`]);
    rows[`ram-elbow-${id}`] = ram('giant elbow actuator', E, eAct, [`${label} giant elbow actuator`]);
    rows[`hand-${id}`] = R('mecha-tool', `${label} giant ${m.hand.family === 'gripper' ? 'gripper' : 'hand'}`, `${m.label} giant arm`, hand.dims, hand.mass, { family: m.hand.family, ...live }, [`${label} giant hand`, `${label} hand`]);
    // (its pack: a hydraulic house's carries its power unit, its pump and its tank; an electric house's its drives and
    // their inverters, no tank, lighter)
    rows[`gap-${id}`] = R('mecha-pack', `${label} giant arm pack`, `${m.label} giant arm`, { w: 0.9, d: 0.5, h: 0.62, tower: { x: m.at[0] - 0.08, y: m.at[1], z: m.at[2] - 0.06, w: 0.22 }, shoulder: [...m.at], flow: m.flow }, m.actuator === 'screw' ? 480 : m.pack === 'gantry' ? 560 : 570, { family: m.pack, ...live }, [`${label} giant arm pack`, `${label} pack`, `${id} pack`]);
  }
  return rows;
}
