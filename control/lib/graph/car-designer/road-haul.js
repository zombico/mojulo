/**
 * THE HIGHWAY'S HAULERS in the form render: the trucks that move freight, at their classes' true numbers
 * (roads/vehicles.js), in the hull kit's language (mil-hull.js, civic-kit.js, haul-kit.js), drawn, worn and painted as
 * the city's and the field's are (road-military.js compileMilitary): previewed, parked, driven and exported. Classes, not
 * replicas: no maker's grille, badge or livery.
 *
 *   sleeper    the eighteen-wheeler: a long-nosed aero tractor, its one-piece hood falling to its chrome grille, its
 *              cab and the sleeper behind it under a roof swept up from the screen to the trailer's height, its twin
 *              stacks, its saddle tanks and fairings, its drive tandem on duals under quarter fenders, its fifth wheel;
 *              and its 53 ft trailer on a tandem of duals (five axles, eighteen tyres). Its trailer by word
 *              (haul-kit.js TRAILER_WORDS): a dry van (its default), a reefer, a flatbed and its load, a tanker, a
 *              container on its chassis, a curtain-sider; `bobtail` leaves it off. Its load `empty` on a flatbed
 *   cabover    the European articulated lorry: a tall cab-over tractor (its flat face, its screen, its step wells, its
 *              roof spoiler and side deflectors) on two axles, its drive axle on duals; its 13.6 m curtain-sider on a
 *              tri-axle of wide singles. Its trailer by the same words (a curtain-sider its default)
 *   box        the straight box truck: a bonneted medium-duty cab (the civic kit's) on two axles, duals behind; its box
 *              (aluminium on its posts, its rails, its conspicuity tape), its roll-up rear door, its exhaust stack.
 *              `unloading` (open, delivering) rolls its door up; `reefer` (refrigerated) a fridge unit on the box's
 *              face over the cab
 *   flatbed    the flatbed truck: the same cab and chassis, a timber deck in its steel frame, its headache rack, its
 *              stake pockets; its load (crates on pallets under a tarp, strapped) unless `empty`
 *   log        the log truck: a day-cab aero tractor, its headache rack behind the cab, its drive tandem; its log
 *              trailer's bunks and stakes and its logs bundled between them, strapped. `empty` leaves its logs off
 *
 *   HAUL_CLASSES                      physics class → its body kind
 *   haulAxles(cls)                    → the axles' stations (+y forward, the body centred), the front first
 *   HAUL_BODIES, HAUL_KITS            the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *   HAUL_LIVERY                       kind → its plain livery (a tractor's paint; a trailer's skin is its own)
 *   haulWords, TRAILER_WORDS          (haul-kit.js)
 *
 * Each body says its wheels axle by axle (`wheelSet`: a steer axle's single, a drive or a trailer axle's duals, a European
 * trailer's wide singles), which the compiler draws (military.js). Vehicle space (+y forward, x across, +x the right
 * side, z up), metres, the wheels' contact at z = 0. Pure and deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, face } from './mil-hull.js';
import { conventionalCab, without, lightBar } from './civic-kit.js';
import {
  HC, haulWords, aeroHood, aeroCab, euroCab, tractorFrame, stacks, trailer, own, stripes, band, M, paint, dark, alu, rect, xs, X, Y, Z, neg,
  lamp, guard, black, chrome, seam, sideFace, outline, C, CC,
} from './haul-kit.js';

export { haulWords, TRAILER_WORDS } from './haul-kit.js';

export const HAUL_CLASSES = Object.freeze({ semiSleeper: 'sleeper', semiCabover: 'cabover', straightBox: 'box', flatbedTruck: 'flatbed', logTruck: 'log' });

// each kind's geometry along its length, from its bumper: the front axle behind the bumper, the drive tandem's spread,
// the fifth wheel ahead of the drive's middle, the kingpin behind the trailer's nose, the trailer's last axle from the
// kingpin (a spread tandem's or a tri-axle's middle)
const RIG = Object.freeze({
  sleeper: { ahead: 1.15, spread: 1.32, fifth: 0.3, kingpin: 0.91, trailerAxle: 12.2, trailerSpread: 1.24, trailerAxles: 2 },
  cabover: { ahead: 1.4, spread: 0, fifth: 0.6, kingpin: 1.6, trailerAxle: 8.71, trailerSpread: 1.31, trailerAxles: 3 },
  log: { ahead: 1.15, spread: 1.32, fifth: 0.3, kingpin: 0.9, trailerAxle: 11.5, trailerSpread: 1.24, trailerAxles: 2 },
  box: { ahead: 1.05 },
  flatbed: { ahead: 1.05 },
});

/** Where each axle stands (+y forward), the front first: a tractor's steer axle, its drive (a tandem about the
 *  wheelbase's end, or one), its trailer's (a tandem's or a tri-axle's, the last at `trailerAxle` behind the kingpin). */
export function haulAxles(cls) {
  const kind = HAUL_CLASSES[cls], v = VEHICLES[cls], G = RIG[kind];
  if (!G) throw new Error(`car-designer: '${cls}' is not one of the highway's haulers (${Object.keys(HAUL_CLASSES).join(', ')})`);
  const yf = v.L / 2 - G.ahead, yd = yf - v.wheelbase;
  if (!G.kingpin) return [yf, yd];
  const drive = G.spread ? [yd + G.spread / 2, yd - G.spread / 2] : [yd];
  const yK = yd + G.fifth, last = yK - G.trailerAxle, tr = Array.from({ length: G.trailerAxles }, (_, i) => last + (G.trailerAxles - 1 - i) * G.trailerSpread);
  return [yf, ...drive, ...tr];
}
/** The kingpin's station (+y), on the fifth wheel ahead of the drive's middle. */
const kingpinOf = (cls) => { const v = VEHICLES[cls], G = RIG[HAUL_CLASSES[cls]]; return v.L / 2 - G.ahead - v.wheelbase + G.fifth; };

const MIRRORS = [['post.L', 'mirror'], ['post.R', 'mirror']];
const FLAPS = [['flap.L', 'mudFlap', { drop: 0.6 }], ['flap.R', 'mudFlap', { drop: 0.6 }], ['flap.tL', 'mudFlap', { drop: 0.6 }], ['flap.tR', 'mudFlap', { drop: 0.6 }]];
const sideMarks = (s, { flap, mark, h = 0.2, id = 'flap' }) => {
  const L = s < 0 ? 'L' : 'R';
  return [
    { id: `${id}.${L}`, kind: 'flap', at: flap, out: neg(Y), up: Z },
    ...(mark ? [{ id: `mark.${L}`, kind: 'mark', role: 'number', at: mark, out: s < 0 ? neg(X) : X, up: Z, h }] : []),
  ];
};
// (the trailer's flaps renamed so the tractor's keep theirs)
const trailerFlaps = (anchors) => anchors.map((a) => (a.kind === 'flap' ? { ...a, id: a.id.replace('flap.', 'flap.t') } : a));
// (a hauler's wheels polished aluminium, not its paint)
const RIM = HC.chrome;
// (a steer axle's single, then duals)
const steerAndDuals = (n, { steer = 0.3, dual = 0.27 } = {}) => [{ w: steer, rim: RIM }, ...Array.from({ length: n - 1 }, () => ({ w: dual, dual: true, rim: RIM }))];

// ── the eighteen-wheeler ────────────────────────────────────────────────────────
function sleeper(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], hw = 1.24, r = v.wheelRadius, axles = haulAxles(cls), [yf, d1, d2] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const { trailer: kind, empty } = haulWords(words, 'van'), yK = kingpinOf(cls), G = RIG.sleeper;
  // the hood and the cab: the cowl 1.95 m behind the bumper, the cab 1.25 m deep, the sleeper 1.83 m behind it
  const yw = yN - 1.95, yb = yw - 1.25 - 1.83, zH = 2 * r + 0.08;
  aeroHood(out, { yN, yG: yN - 0.22, yw, hw, zH, zB: 1.98, zG: 1.8, yf, r });
  const anchors = aeroCab(out, { yw, yb, hw, z0: 1.15, zB: 1.98, zTop: v.H - 0.17, sleeper: true }).filter((a) => a.kind !== 'sill');
  tractorFrame(out, { axles: [yf, d1, d2], yN, yE: d2 - 0.85, hw: v.W / 2, r, tanks: [yf - r - 0.18, yf - r - 1.65], y5: yK });
  stacks(out, { y: yb - 0.13, x: hw - 0.14, z0: 1.0, z1: v.H - 0.1 });
  // (the cab's skirt under the sleeper, down to the tanks; the tractor's flaps behind its tandem)
  out.push(...plate({ axis: 'x', profile: rect(yb + 0.02, yf - r - 1.75, 0.95, 1.18), from: -hw, to: hw, r: 0.02, seg: 1, look: paint('cab.skirt') }));
  for (const s of [-1, 1]) anchors.push(...sideMarks(s, { flap: [s * 1.0, d2 - r - 0.15, 1.0] }));
  // the trailer: its nose the kingpin's 0.91 m ahead; its tandem's last axle 12.2 m behind the kingpin
  if (kind !== 'none') {
    const T = trailer(out, { kind, yNose: yK + G.kingpin, yT, yK, hw: v.W / 2, H: v.H, axles: axles.slice(3), r, empty });
    anchors.push(...trailerFlaps(T.anchors));
  }
  // (bobtailing, its own three axles: the trailer's are not there)
  const n = kind === 'none' ? 3 : axles.length;
  return { faces: out.filter(Boolean), anchors, zones: { floor: 1.0, tub: { x: v.W / 2, y: [yT, yN], z: [0.4, 1.2] } }, wheelSet: steerAndDuals(n), ...(kind === 'none' ? { axles: axles.slice(0, n) } : {}) };
}

// ── the European articulated lorry ──────────────────────────────────────────────
function cabover(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], hw = 1.23, r = v.wheelRadius, axles = haulAxles(cls), [yf, yd] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const { trailer: kind, empty } = haulWords(words, 'curtain'), yK = kingpinOf(cls), G = RIG.cabover, z5 = 1.12;
  const yb = yN - 2.3;
  const anchors = euroCab(out, { yN, yb, hw, z0: 1.42, zTop: v.H - 0.05, yf, r });
  tractorFrame(out, { axles: [yf, yd], yN, yE: yd - 0.75, hw: 1.24, r, zf: 0.95, tanks: [yf - r - 0.72, yf - r - 1.85], y5: yK, z5 });
  // (the drive axle's mudguard over its duals; the cab's rear wall's air and electric lines coiled to the trailer)
  for (const s of [-1, 1]) out.push(...guard(yd, r, r + 0.07, 0.3, Math.PI - 0.3, ...xs(s, 0.68, 1.26), black('guard.drive')));
  for (const [x, c] of [[-0.15, '#c22d22'], [0, '#2f5ab3'], [0.15, '#1d1e1f']]) out.push(...tube([[x, yb - 0.04, 1.9], [x, yb - 0.25, 1.7], [x, yK + 1.2, z5 + 0.45], [x, yK + 1.6, z5 + 0.6]], 0.012, { sides: 6, look: M('airline', 'canvas', c) }));
  for (const s of [-1, 1]) anchors.push(...sideMarks(s, { flap: [s * 0.97, yd - r - 0.12, 0.95] }));
  if (kind !== 'none') {
    const T = trailer(out, { kind, yNose: yK + G.kingpin, yT, yK, hw: v.W / 2, H: v.H, axles: axles.slice(2), r, z5, empty });
    anchors.push(...trailerFlaps(T.anchors));
  }
  // (a steer single, the drive's duals, the trailer's wide singles)
  const n = kind === 'none' ? 2 : axles.length, wheelSet = [{ w: 0.315, rim: RIM }, { w: 0.28, dual: true, rim: RIM }, ...axles.slice(2, n).map(() => ({ w: 0.385, rim: RIM }))];
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.95, tub: { x: v.W / 2, y: [yT, yN], z: [0.4, 1.2] } }, wheelSet, ...(kind === 'none' ? { axles: axles.slice(0, n) } : {}) };
}

// ── the straight trucks: the box truck and the flatbed ─────────────────────────
// (the bonneted medium-duty cab and its chassis both share, on its class's axles; → { anchors, yb, z0, z1, … }; the city's
// medium truck's too, road-city-truck.js)
export function straightCab(out, cls, [yf, yr] = haulAxles(cls)) {
  const v = VEHICLES[cls], r = v.wheelRadius, yN = v.L / 2, yT = -v.L / 2, hw = 1.08, zf = 0.95;
  const P = (o) => out.push(...plate(o));
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.4, 0.5), zf - 0.26, zf), from: yT + 0.15, to: yN - 0.3, r: 0.01, seg: 1, look: dark('frame') });
  for (const y of [yf, yr]) out.push(...tube([[-0.88, y, r], [0.88, y, r]], 0.065, { sides: 10, look: M('axle', 'steel', C.steel) }));
  const yG = yN - 0.14, yw = yG - 1.55, yb = yw - 1.3, z0 = zf + 0.1, zB = 1.78, z1 = 2.78;
  const anchors = conventionalCab(out, { yb, yw, yG, yN: yN, hw, hb: 0.62, z0, zB, z1, yf, r });
  // (a saddle tank under the left door, its straps; the exhaust stack up the cab's back right corner; the amber lamps)
  out.push(...tube([[-hw + 0.3, yb + 0.95, 0.68], [-hw + 0.3, yb + 0.05, 0.68]], 0.26, { sides: 16, look: alu('tank') }));
  out.push(...tube([[hw - 0.12, yb - 0.1, 0.9], [hw - 0.12, yb - 0.1, z1 + 0.35]], 0.06, { sides: 10, look: chrome('stack') }));
  out.push(...tube([[hw - 0.12, yb - 0.1, 1.6], [hw - 0.12, yb - 0.1, 2.4]], 0.08, { sides: 10, look: M('stack.shield', 'steel', HC.alu) }));
  for (let i = -1; i <= 1; i++) out.push(...lamp([i * 0.3, yw - 0.65, z1 + 0.004], Z, 0.08, 0.05, 'marker', 'cab.lamp'));
  for (const s of [-1, 1]) out.push(...guard(yr, r, r + 0.08, 0.25, Math.PI - 0.25, ...xs(s, 0.62, Math.min(1.29, v.W / 2 - 0.02)), black('guard.rear')));
  return { anchors: anchors.filter((a) => a.kind !== 'sill'), yb, z0, z1, zf, yr, yT, yN, yf, r };
}
function box(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], out = [], P = (o) => out.push(...plate(o)), W = (words ?? []).map((w) => String(w).toLowerCase());
  const { anchors, yb, z1, zf, yr, yT, r } = straightCab(out, cls), hw = v.W / 2 - 0.036, H = v.H;
  const reefer = haulWords(words, 'van').trailer === 'reefer', open = W.some((w) => ['unloading', 'open', 'opened', 'delivering', 'loading'].includes(w));
  // the box from just behind the cab to the tail, its floor on its sills over the frame
  const yB0 = yb - 0.12, zb0 = zf + 0.2, yB1 = yT;
  P({ axis: 'y', profile: rect(-hw + 0.01, hw - 0.01, zb0, H - 0.01), from: yB1, to: yB0, r: 0.05, seg: 1, look: own('van', HC.van, 'plate') });
  P({ axis: 'y', profile: rect(-hw + 0.1, hw - 0.1, zf, zb0), from: yB1 + 0.1, to: yB0 - 0.1, r: 0.01, seg: 1, look: dark('box.sill') });
  for (const s of [-1, 1]) {
    const x = s * (hw - 0.004);
    for (let y = yB1 + 0.6; y < yB0 - 0.2; y += 0.6) sideFace(out, s, x + s * 0.008, [y - 0.018, y + 0.018], [zb0 + 0.08, H - 0.1], own('van.post', HC.vanPost, 'steel'));
    for (const z of [zb0, H - 0.1]) P({ axis: 'y', profile: rect(...xs(s, hw - 0.015, hw + 0.012), z, z + 0.1), from: yB1, to: yB0, r: 0.01, seg: 1, look: alu('van.rail') });
    out.push(...stripes({ o: [x + s * 0.016, s > 0 ? yB1 + 0.05 : yB0 - 0.05, zb0 + 0.12], u: s > 0 ? Y : neg(Y), v: Z, w: yB0 - yB1 - 0.1, h: 0.05, n: [s, 0, 0], colours: [CC.reflRed, CC.reflWhite], pitch: 0.3, part: 'tape' }));
    for (const y of [yB0 - 0.15, yB1 + 0.15]) out.push(...lamp([x + s * 0.02, y, zb0 + 0.3], [s, 0, 0], 0.08, 0.05, 'marker', 'side.marker'));
    out.push(...lamp([s * (hw - 0.2), yT - 0.004, 0.8], neg(Y), 0.14, 0.18, 'tail', 'taillamp'));
  }
  // (its roll-up door: slats from its foot to the head, the box dark under it when it is up; its step and its grab bar)
  const zD = open ? H - 0.45 : zb0 + 0.04, zHead = H - 0.2;
  if (open) out.push(face([[-hw + 0.1, yT - 0.004, zb0 + 0.04], [hw - 0.1, yT - 0.004, zb0 + 0.04], [hw - 0.1, yT - 0.004, zD], [-hw + 0.1, yT - 0.004, zD]], M('doorway', 'seal', '#141516'), neg(Y)));
  out.push(...plate({ axis: 'y', profile: rect(-hw + 0.1, hw - 0.1, zD, zHead), from: yT - 0.02, to: yT, look: own('door.rear', '#e4e5e2', 'plate') }));
  for (let z = zD + 0.15; z < zHead - 0.04; z += 0.15) out.push(...plate({ axis: 'y', profile: rect(-hw + 0.11, hw - 0.11, z, z + 0.012), from: yT - 0.024, to: yT - 0.02, look: seam }));
  out.push(...plate({ axis: 'z', profile: rect(-0.5, 0.5, yT - 0.06, yT + 0.3), from: 0.5, to: 0.54, r: 0.008, seg: 1, look: alu('step.rear') }));
  out.push(...stripes({ o: [hw - 0.1, yT - 0.026, 0.42], u: neg(X), v: Z, w: 2 * hw - 0.2, h: 0.14, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], part: 'underrun.stripe' }));
  // (a fridge unit on the box's face over the cab, when it is refrigerated)
  if (reefer) {
    P({ axis: 'y', profile: rect(-0.85, 0.85, z1 + 0.15, H - 0.15), from: yB0, to: yB0 + 0.36, r: 0.05, seg: 2, look: own('reefer', HC.reefer, 'plate') });
    for (const x of [-0.38, 0.38]) out.push(...tube([[x, yB0 + 0.36, (z1 + H) / 2], [x, yB0 + 0.375, (z1 + H) / 2]], 0.2, { sides: 16, look: black('reefer.fan') }));
  }
  for (const s of [-1, 1]) anchors.push(...sideMarks(s, { flap: [s * 0.97, yr - r - 0.12, 0.95], mark: [s * (hw + 0.004), yB1 + 1.2, H - 0.6], h: 0.24 }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: zf, tub: { x: hw, y: [yT, yb], z: [0.4, 1.1] } }, wheelSet: [{ w: 0.28, rim: RIM }, { w: 0.26, dual: true, rim: RIM }] };
}
function flatbed(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], out = [], P = (o) => out.push(...plate(o)), { empty } = haulWords(words, 'flatbed');
  const { anchors, yb, z1, zf, yr, yT, r } = straightCab(out, cls), hw = v.W / 2;
  // the deck: its frame, its timber, its rails and pockets; the headache rack behind the cab, its mesh
  const yD0 = yb - 0.3, zD = zf + 0.2;
  P({ axis: 'z', profile: rect(-hw + 0.02, hw - 0.02, yT, yD0), from: zf, to: zD - 0.04, r: 0.01, seg: 1, look: dark('deck.frame') });
  for (let x = -hw + 0.08; x < hw - 0.1; x += 0.16) P({ axis: 'z', profile: rect(x, Math.min(x + 0.15, hw - 0.08), yT + 0.05, yD0 - 0.05), from: zD - 0.04, to: zD, look: own('deck', HC.deck, 'canvas') });
  for (const s of [-1, 1]) {
    P({ axis: 'y', profile: rect(...xs(s, hw - 0.09, hw - 0.04), zf - 0.05, zD), from: yT, to: yD0, r: 0.01, seg: 1, look: dark('deck.rail') });
    for (let y = yT + 0.5; y < yD0 - 0.2; y += 0.6) P({ axis: 'z', profile: rect(...xs(s, hw - 0.04, hw - 0.002), y - 0.05, y + 0.05), from: zf - 0.03, to: zD - 0.02, look: dark('stake.pocket') });
    out.push(...lamp([s * (hw - 0.2), yT - 0.004, zf - 0.05], neg(Y), 0.14, 0.12, 'tail', 'taillamp'));
    P({ axis: 'z', profile: rect(...xs(s, hw - 0.1, hw - 0.02), yD0 - 0.08, yD0), from: zD, to: z1 - 0.05, r: 0.01, seg: 1, look: dark('rack.post') });
  }
  P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, z1 - 0.12, z1 - 0.02), from: yD0 - 0.08, to: yD0, r: 0.01, seg: 1, look: dark('rack.rail') });
  for (let x = -hw + 0.2; x < hw - 0.1; x += 0.2) out.push(...tube([[x, yD0 - 0.04, zD], [x, yD0 - 0.04, z1 - 0.1]], 0.012, { sides: 6, look: dark('rack.bar') }));
  P({ axis: 'x', profile: rect(yT + 0.12, yT + 0.26, 0.42, 0.58), from: -hw + 0.15, to: hw - 0.15, r: 0.012, seg: 1, look: dark('underrun') });
  out.push(...stripes({ o: [hw - 0.15, yT + 0.12, 0.42], u: neg(X), v: Z, w: 2 * hw - 0.3, h: 0.16, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], part: 'underrun.stripe' }));
  if (!empty) {
    const n = Math.floor((yD0 - yT - 0.4) / 1.25);
    for (let i = 0; i < n; i++) {
      const y = yD0 - 0.15 - i * 1.25;
      P({ axis: 'z', profile: rect(-hw + 0.15, hw - 0.15, y - 1.15, y), from: zD, to: zD + 0.12, r: 0.01, seg: 1, look: own('pallet', HC.crate, 'canvas') });
      P({ axis: 'z', profile: rect(-hw + 0.18, hw - 0.18, y - 1.12, y - 0.03), from: zD + 0.12, to: zD + 1.1, r: 0.03, seg: 1, look: M('tarp', 'canvas', HC.tarp) });
      for (const t of [0.3, 0.8]) out.push(...tube([[-hw + 0.02, y - t, zD - 0.05], [-hw + 0.17, y - t, zD + 1.11], [hw - 0.17, y - t, zD + 1.11], [hw - 0.02, y - t, zD - 0.05]], 0.012, { sides: 4, look: M('strap', 'canvas', HC.strap) }));
    }
  }
  for (const s of [-1, 1]) anchors.push(...sideMarks(s, { flap: [s * 0.97, yr - r - 0.12, 0.95] }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: zf, tub: { x: hw, y: [yT, yb], z: [0.4, 1.1] } }, wheelSet: [{ w: 0.28, rim: RIM }, { w: 0.26, dual: true, rim: RIM }] };
}

// ── the log truck ───────────────────────────────────────────────────────────────
function log(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], hw = 1.24, r = v.wheelRadius, axles = haulAxles(cls), [yf, d1, d2] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const { empty } = haulWords(words, 'log'), yK = kingpinOf(cls), G = RIG.log, P = (o) => out.push(...plate(o));
  const yw = yN - 1.95, yb = yw - 1.25;
  aeroHood(out, { yN, yG: yN - 0.22, yw, hw, zH: 2 * r + 0.08, zB: 1.98, zG: 1.8, yf, r });
  const anchors = aeroCab(out, { yw, yb, hw, z0: 1.15, zB: 1.98, sleeper: false }).filter((a) => a.kind !== 'sill');
  tractorFrame(out, { axles: [yf, d1, d2], yN, yE: d2 - 0.85, hw: v.W / 2, r, tanks: [yf - r - 0.18, yf - r - 1.2], y5: yK, fairing: false });
  // (the headache rack behind the cab: its posts, its rails and its mesh, the cab's guard against a shifting load; the
  // lines' tray across it; its light bar)
  const yR = yb - 0.35, zR = 3.25;
  for (const s of [-1, 1]) P({ axis: 'z', profile: rect(...xs(s, hw - 0.12, hw), yR - 0.1, yR), from: 1.0, to: zR, r: 0.01, seg: 1, look: dark('rack.post') });
  for (const z of [1.25, zR - 0.08]) P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, z, z + 0.08), from: yR - 0.1, to: yR, r: 0.01, seg: 1, look: dark('rack.rail') });
  for (let x = -hw + 0.2; x < hw - 0.1; x += 0.18) out.push(...tube([[x, yR - 0.05, 1.33], [x, yR - 0.05, zR - 0.08]], 0.012, { sides: 6, look: dark('rack.bar') }));
  out.push(...lightBar([0, yR - 0.05, zR], { width: 1.2, colours: [HC.amber, HC.amber], depth: 0.2 }));
  stacks(out, { y: yb - 0.13, x: hw - 0.3, z0: 1.0, z1: 3.55 });
  for (const s of [-1, 1]) anchors.push(...sideMarks(s, { flap: [s * 1.0, d2 - r - 0.15, 1.0] }));
  const T = trailer(out, { kind: 'log', yNose: yK + G.kingpin, yT, yK, hw: v.W / 2, H: v.H, axles: axles.slice(3), r, empty, zDeck: 1.32 });
  anchors.push(...trailerFlaps(T.anchors));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 1.0, tub: { x: v.W / 2, y: [yT, yN], z: [0.4, 1.2] } }, wheelSet: steerAndDuals(axles.length) };
}

export const HAUL_BODIES = Object.freeze({ sleeper, cabover, box, flatbed, log });

/** Each hauler's kit (mil-fittings.js cards on its anchors). */
export const HAUL_KITS = Object.freeze({
  sleeper: Object.freeze([...MIRRORS, ...FLAPS]), cabover: Object.freeze([...MIRRORS, ...FLAPS]), log: Object.freeze([...MIRRORS, ...FLAPS]),
  box: Object.freeze([...MIRRORS, ['flap.L', 'mudFlap', { drop: 0.55 }], ['flap.R', 'mudFlap', { drop: 0.55 }]]),
  flatbed: Object.freeze([...MIRRORS, ['flap.L', 'mudFlap', { drop: 0.55 }], ['flap.R', 'mudFlap', { drop: 0.55 }]]),
});

const mono = (c) => Object.freeze({ pattern: 'mono', colours: Object.freeze([c]), marks: Object.freeze({ emblem: false }) });
/** Each hauler's plain livery: its tractor's or its cab's paint (a trailer's skin is its own). */
export const HAUL_LIVERY = Object.freeze({ sleeper: mono('#7a1d24'), cabover: mono('#e6e6e2'), box: mono('#ecebe6'), flatbed: mono('#20497f'), log: mono('#2f5a3a') });

export { without, outline, band, own };
