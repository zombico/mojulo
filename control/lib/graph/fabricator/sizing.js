// fabricator/sizing — the smallest stock size that holds the need's load, read off the rigidity sensor's own checks.
//
// The load class (light / medium / heavy) picks a strategy; it does not pick a size. A size is picked here: each
// candidate from the stock tables, smallest first, is run through the same element check measure_solid runs
// (../strength/checks.js: bolt tension, shear, thread stripping and heat-set pull-out; Lewis tooth bending) or a
// catalogue rating (a bearing's static and dynamic load, a stepper's holding torque), and the first whose safety
// factor reaches what the load's certainty calls for (../strength/reading.js REQUIRED_SF) wins. None holding is said,
// so the strategy is passed over for a stronger one, never silently undersized.
//
// The need says (all optional):
//   loadN      the working load on the joint, N, shared by its `count` fasteners (or a shaft's two bearings);
//              absent → 20 N, and the sizing says it assumed so
//   loadDir    'tension' (default: pulls the joint apart, the case that strips threads) | 'shear'
//   loadKind   'static' (default) | 'repeated' | 'impact' (doubles the load)
//   certainty  how well the load is known: 'measured' | 'estimated' (default) | 'guess' → the safety factor asked
//   material   the host it threads into, by strength-table id (printed → petg, metal → al-6061, sheet → s235)
//   grade      the bolt's property class (8.8; A2-70 stainless when tagged waterproof)
//   torqueNm, rpm, hours   a drive's or gear's torque, its speed and the life a bearing must last (default 5000 h)
// Pure and deterministic: the same need gives the same size and the same reading.
import { bolt as boltCheck, gear as gearCheck, LOAD_KINDS } from '../strength/checks.js';
import { REQUIRED_SF } from '../strength/reading.js';
import { resolveMaterial } from '../strength/materials.js';
import { BEARINGS, ISO_SIZES, NEMA } from './mech-tables.js';

export const DEFAULT_LOAD_N = 20;
const r2 = (v) => Math.round(v * 100) / 100;

/** How well the load is known → the safety factor asked of it, the sensor's own table. */
const CERTAINTY = { measured: 'high', estimated: 'medium', guess: 'low' };
export const requiredSf = (need) => REQUIRED_SF[CERTAINTY[need.certainty] || 'medium'];

const HOST_MATERIAL = { printed: 'petg', metal: 'al-6061', extrusion: 'al-6061', sheet: 's235', wood: 'pine' };
export const hostMaterial = (need) => need.material || HOST_MATERIAL[need.host || 'printed'];
export const boltGrade = (need, tags) => need.grade || (tags?.has('waterproof') ? 'A2-70' : '8.8');

/** What every sizing reads: the load (assumed when unsaid), the safety factor asked, the load kind's demand. */
const base = (need, { force = true } = {}) => ({
  ...(force ? { loadN: need.loadN ?? DEFAULT_LOAD_N, ...(need.loadN === undefined ? { loadAssumed: true } : {}) } : {}),
  required: requiredSf(need),
  ...(LOAD_KINDS[need.loadKind] ? { loadKind: need.loadKind } : {}),
});
const demandOf = (need) => LOAD_KINDS[need.loadKind] ?? 1;

// ── bolts: every stock size the hardware table cuts, smallest first ──
const BOLT_SIZES = ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16'];
// The heat-set inserts the bolt check has a pull-out row for.
const INSERT_SIZES = new Set(['M3', 'M4', 'M5', 'M6', 'M8']);

/**
 * The smallest bolt for a fastening `into` 'insert' (a heat-set insert in the host), 'thread' (a thread cut in the
 * host, `engageD` diameters engaged) or 'nut' (through to a nut: the bolt alone). → { size, by, mode, sf, … } or
 * { fail } when no stock size holds.
 */
export function sizeBolt(need, tags, { into = 'nut', engageD = 2 } = {}) {
  const b = base(need);
  const count = need.count ?? 1;
  const per = b.loadN / count;
  const demand = demandOf(need);
  const shear = need.loadDir === 'shear';
  const grade = boltGrade(need, tags);
  const material = hostMaterial(need);
  const host = into === 'nut' ? null : material;
  const read = (size) => {
    const out = boltCheck(null, { size, grade, ...(shear ? { shear: per * demand } : { tension: per * demand }),
      ...(host ? { into: host, ...(into === 'insert' ? { insert: true } : { engaged_mm: engageD * ISO_SIZES[size].d }) } : {}) }, {});
    const worst = out.modes.reduce((a, m) => (m.utilization > a.utilization ? m : a));
    return { mode: worst.mode, sf: r2(1 / worst.utilization) };
  };
  const what = { into, grade, ...(host ? { material: resolveMaterial(host).id } : {}), perPart: r2(per), loadDir: shear ? 'shear' : 'tension' };
  const ok = (size) => ISO_SIZES[size] && (into !== 'insert' || (ISO_SIZES[size].heatset > 0 && INSERT_SIZES.has(size)));
  if (need.size) {
    if (!ok(need.size)) return { fail: `no ${into === 'insert' ? 'heat-set insert' : 'stock bolt'} in ${need.size}` };
    return { size: need.size, by: 'given', ...read(need.size), ...b, ...what };
  }
  for (const size of BOLT_SIZES.filter(ok)) {
    const r = read(size);
    if (r.sf >= b.required) return { size, by: 'strength', ...r, ...b, ...what };
  }
  return { fail: `no stock ${into === 'insert' ? 'insert' : 'bolt'} holds ${r2(per)} N each at safety factor ${b.required}` };
}

// ── bearings: typical catalogue ratings for the library's sizes (deep-groove ball and linear ball bushings) ──
// C = basic dynamic, C0 = basic static load rating, N. Typical of the published tables; the supplier's datasheet
// rules. The two bearings of a shaft share its radial load.
export const BEARING_RATINGS = Object.freeze({
  623: [500, 180], 624: [1300, 490], 625: [1140, 380], 626: [2340, 950], 608: [3450, 1370], 688: [1330, 570],
  6000: [4620, 1960], 6001: [5400, 2360], 6002: [5850, 2850], 6200: [5400, 2360], 6201: [7280, 3100],
  6202: [8060, 3750], 6203: [9950, 4750], 6204: [13500, 6550],
  LM8UU: [265, 400], LM10UU: [372, 549], LM12UU: [510, 784],
});

/**
 * The bearing on a `d` bore (or the linear bushing for a `d` rod) that carries the need's load: its static rating
 * at the safety factor asked, and, when `rpm` is given, a basic life (L10 = (C/P)³ million turns) of `hours`.
 * Among those that hold, the slimmest. → { code, by, mode, sf, … } or { fail }.
 */
export function sizeBearing(need, { linear = false } = {}) {
  const b = base(need);
  const d = need.shaftD;
  const per = (b.loadN * demandOf(need)) / 2;
  const hours = need.hours ?? 5000;
  const fits = Object.values(BEARINGS).filter((x) => x.linear === linear && Math.abs(x.bore - d) < 0.01 && BEARING_RATINGS[x.code])
    .sort((x, y) => x.od - y.od || x.width - y.width);
  const read = (code) => {
    const [C, C0] = BEARING_RATINGS[code];
    const modes = [{ mode: 'static load rating', sf: r2(C0 / Math.max(per, 1e-9)) }];
    if (need.rpm > 0) {
      const lifeH = ((C / Math.max(per, 1e-9)) ** 3 * 1e6) / (60 * need.rpm);
      modes.push({ mode: `basic life at ${need.rpm} rpm`, sf: r2(Math.cbrt(lifeH / hours)), lifeH: Math.round(Math.min(lifeH, 1e9)) });
    }
    return modes.reduce((a, m) => (m.sf < a.sf ? m : a));
  };
  const what = { perPart: r2(per), ...(need.rpm > 0 ? { rpm: need.rpm, hours } : {}) };
  for (const x of fits) {
    const r = read(x.code);
    if (r.sf >= b.required) return { code: x.code, by: 'strength', ...r, ...b, ...what };
  }
  return { fail: fits.length ? `no ${d} mm ${linear ? 'bushing' : 'bearing'} carries ${r2(per)} N each at safety factor ${b.required}` : `no stock bearing on ${d} mm` };
}

// ── steppers: typical holding torque of a mid-length body per frame, N·m; the torque it keeps at speed is taken
// as half of it (the pull-out curve falls off with speed). Typical, not a datasheet.
export const NEMA_HOLDING_NM = Object.freeze({ 11: 0.1, 14: 0.25, 17: 0.45, 23: 1.25 });

/** The smallest stepper frame whose usable torque carries `torqueNm` at the safety factor asked. */
export function sizeStepper(need) {
  if (!(need.torqueNm > 0)) return null;
  const b = base(need, { force: false });
  const T = need.torqueNm * demandOf(need);
  for (const n of Object.keys(NEMA).map(Number).sort((x, y) => x - y)) {
    const held = NEMA_HOLDING_NM[n];
    if (!held) continue;
    const sf = r2((held * 0.5) / T);
    if (sf >= b.required) return { frame: n, by: 'strength', mode: 'usable torque (half the holding torque)', sf, ...b, torqueNm: need.torqueNm };
  }
  return { fail: `no stock stepper frame carries ${need.torqueNm} N·m at safety factor ${b.required}` };
}

// ── gears: Lewis bending on the smaller gear of a printed pair ──
const MODULES = [0.5, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4];

/** The smallest module whose `teeth`-tooth gear, `face` mm wide or six modules if wider, in the host's material, carries `torqueNm`. */
export function sizeGear(need, { teeth, face }) {
  if (!(need.torqueNm > 0)) return null;
  const b = base(need, { force: false });
  const material = resolveMaterial(hostMaterial(need));
  for (const m of MODULES) {
    const F = Math.max(face, 6 * m);   // the face at least six modules wide, the usual lower bound for a spur face
    const out = gearCheck(null, { module: m, teeth, face: F, torque: need.torqueNm * demandOf(need), ...(need.rpm ? { rpm: need.rpm } : {}) }, { material });
    const sf = r2(1 / out.modes[0].utilization);
    if (sf >= b.required) return { module: m, by: 'strength', mode: out.modes[0].mode, sf, ...b, material: material.id, teeth, face: F, torqueNm: need.torqueNm };
  }
  return { fail: `no stock module carries ${need.torqueNm} N·m on a ${teeth}-tooth gear at safety factor ${b.required}` };
}
