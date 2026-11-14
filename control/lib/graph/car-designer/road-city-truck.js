/**
 * THE CITY'S WORKING TRUCKS in the form render: the medium-duty and the small trucks that carry a city's goods, at their
 * classes' true numbers (roads/vehicles.js), in the hull kit's language (mil-hull.js, civic-kit.js, haul-kit.js,
 * city-truck-kit.js), drawn, worn and painted as the city's utility vehicles are (road-military.js compileMilitary):
 * previewed, parked, driven and exported. Classes, not replicas: no maker's face, badge or livery.
 *
 *   medium     the medium-duty conventional truck: a bonneted cab (the haulers' straight cab) on two axles, duals
 *              behind; its stake bed (stakes in their pockets, boards between). `dump` gives it a tipping tub
 *              (`tipping` tips it), `flatbed` a bare deck
 *   light      the Asian 2-ton cab-over: a narrow flat-faced cab over its front wheels, its door's low window, on small
 *              wheels and duals; its deck and aluminium drop sides behind its gate guard. By word: `wing` a wing body
 *              (`open` lifts its wings), `box` an aluminium box, `reefer` the box and its fridge unit, `dump` a tipping
 *              tub, `crane` a knuckle-boom crane behind the cab over a shorter deck
 *   wide       the Asian 4-ton wide cab-over: the same face a cab wider and taller, on two axles; its wing body (its
 *              default), or by the same words a box, a reefer, a deck, a crane
 *   mini       the mini goods carrier: a short narrow cab, its face rounded, over its front wheels, on four small
 *              wheels; its deck and its fixed sides; `canvas` (covered, tarp) a tilt over it
 *   cube       the cube van: a cutaway van's nose and cab on duals, its box from behind the cab to the tail and up over
 *              the cab's roof; its roll-up rear door (`unloading` rolls it up), its rear step
 *   beverage   the side-bay beverage truck: a wide cab-over; a body of bays down both sides, each behind its roll-up
 *              shutter; `delivering` (open, unloading) rolls them up, its crates stacked inside
 *
 *   CITY_TRUCK_CLASSES                physics class → its body kind
 *   cityTruckAxles(cls)               → the axles' stations (+y forward, the body centred), the front first
 *   CITY_TRUCK_BODIES, CITY_TRUCK_KITS  the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *   CITY_TRUCK_LIVERY                 kind → its plain livery (its cab's paint; an aluminium body's skin is its own)
 *   cityTruckWords(words)             → { body, open, tipped, covered }: the body a brief asks, whether it is opened,
 *                                       tipped or covered
 *
 * Each body says its wheels axle by axle (`wheelSet`: singles ahead, duals behind on all but the mini carrier). Vehicle
 * space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, face } from './mil-hull.js';
import { chassis } from './civic-kit.js';
import { straightCab } from './road-haul.js';
import {
  TC, asianCab, miniCab, vanCab, dropDeck, gateGuard, stakeBed, wingBody, dumpTub, knuckleCrane, bayBody, own, stripes, M, paint, dark, alu,
  rect, xs, X, Y, Z, neg, guard, lamp, black, seam, CC,
} from './city-truck-kit.js';

export const CITY_TRUCK_CLASSES = Object.freeze({ mediumTruck: 'medium', lightCabover: 'light', wideCabover: 'wide', miniGoods: 'mini', cubeVan: 'cube', beverageTruck: 'beverage' });

// (each kind's front axle behind its nose)
const AHEAD = Object.freeze({ medium: 1.05, light: 0.85, wide: 1.15, mini: 0.6, cube: 0.85, beverage: 1.15 });
/** Where each axle stands (+y forward), the front first. */
export function cityTruckAxles(cls) {
  const kind = CITY_TRUCK_CLASSES[cls], v = VEHICLES[cls];
  if (!kind) throw new Error(`car-designer: '${cls}' is not one of the city's working trucks (${Object.keys(CITY_TRUCK_CLASSES).join(', ')})`);
  const yf = v.L / 2 - AHEAD[kind];
  return [yf, yf - v.wheelbase];
}

const BODY_WORDS = Object.freeze({
  wing: ['wing', 'wing body', 'wing van', 'gullwing'], box: ['box', 'van', 'box body', 'dry van'], reefer: ['reefer', 'refrigerated', 'chilled', 'fridge', 'frozen'],
  dump: ['dump', 'tipper', 'dumper', 'tipping body'], crane: ['crane', 'knuckle crane', 'crane truck', 'hiab'], flatbed: ['flatbed', 'flat', 'deck', 'drop side', 'dropside'],
  stake: ['stake', 'stake bed', 'stakebed', 'racks'],
});
/** A city truck's words: the body asked (the first word that names one), whether it is opened, tipped or covered. */
export function cityTruckWords(words = []) {
  const W = words.map((w) => String(w).toLowerCase()), has = (list) => W.some((w) => list.includes(w));
  return {
    body: Object.keys(BODY_WORDS).find((k) => has(BODY_WORDS[k])) ?? null,
    open: has(['open', 'opened', 'unloading', 'delivering', 'loading']),
    tipped: has(['tipping', 'tipped', 'dumping', 'raised']),
    covered: has(['canvas', 'covered', 'tarp', 'tilt']),
  };
}

const rims = (front, rear, { dual = true, rim = '#dfe1e2' } = {}) => [{ w: front, rim }, { w: rear, rim, ...(dual ? { dual: true } : {}) }];
const flaps = (anchors, s, at) => anchors.push({ id: `flap.${s < 0 ? 'L' : 'R'}`, kind: 'flap', at, out: neg(Y), up: Z });
// (the tail of a deck: its lamps and its under-run bar, striped)
function tail(out, { yT, hw, z = 0.62 }) {
  out.push(...plate({ axis: 'x', profile: rect(yT + 0.02, yT + 0.14, z - 0.2, z - 0.06), from: -hw + 0.12, to: hw - 0.12, r: 0.01, seg: 1, look: dark('underrun') }));
  out.push(...stripes({ o: [hw - 0.12, yT + 0.02, z - 0.2], u: neg(X), v: Z, w: 2 * hw - 0.24, h: 0.14, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], part: 'underrun.stripe' }));
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.2), yT + 0.03, z + 0.06], neg(Y), 0.16, 0.12, 'tail', 'taillamp'));
}
// (a plain aluminium box with its rear doors; a fridge unit on its face when `reefer`)
function aluBox(out, { y0, y1, hw, zF, H, reefer, zCab }) {
  const P = (o) => out.push(...plate(o));
  P({ axis: 'y', profile: rect(-hw, hw, zF, H), from: y1, to: y0, r: 0.04, seg: 1, look: own(reefer ? 'reefer.box' : 'box', TC.alu, 'steel') });
  for (const s of [-1, 1]) for (let y = y1 + 0.5; y < y0 - 0.2; y += 0.5) out.push(face([[s * (hw + 0.002), y - 0.01, zF + 0.05], [s * (hw + 0.002), y + 0.01, zF + 0.05], [s * (hw + 0.002), y + 0.01, H - 0.05], [s * (hw + 0.002), y - 0.01, H - 0.05]], M('box.rib', 'seal', TC.aluDark), [s, 0, 0]));
  out.push(face([[-0.006, y1 - 0.004, zF + 0.05], [0.006, y1 - 0.004, zF + 0.05], [0.006, y1 - 0.004, H - 0.06], [-0.006, y1 - 0.004, H - 0.06]], seam, neg(Y)));
  if (reefer) {
    P({ axis: 'y', profile: rect(-0.6 * hw, 0.6 * hw, zCab + 0.08, H - 0.08), from: y0, to: y0 + 0.3, r: 0.05, seg: 2, look: own('reefer', '#d7d9db', 'plate') });
    out.push(...tube([[0, y0 + 0.3, (zCab + H) / 2], [0, y0 + 0.315, (zCab + H) / 2]], Math.min(0.22, (H - zCab) / 3), { sides: 16, look: black('reefer.fan') }));
  }
}

// ── the medium-duty conventional ────────────────────────────────────────────────
function medium(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], out = [], w = cityTruckWords(words), axles = cityTruckAxles(cls), hw = v.W / 2;
  const { anchors, yb, zf, yr, yT, r } = straightCab(out, cls, axles), y0 = yb - 0.15, zD = zf + 0.22;
  if (w.body === 'dump') dumpTub(out, { y0, y1: yT + 0.05, hw: hw - 0.03, zF: zD - 0.06, h: 0.65, tip: w.tipped ? (45 * Math.PI) / 180 : 0, zFrame: zf });
  else if (w.body === 'flatbed') dropDeck(out, { y0, y1: yT, hw: hw - 0.01, zD, h: 0.1 });
  else stakeBed(out, { y0, y1: yT, hw: hw - 0.005, zD, h: 1.1 });
  tail(out, { yT, hw: hw - 0.05, z: 0.6 });
  for (const s of [-1, 1]) flaps(anchors, s, [s * 0.95, yr - r - 0.12, 0.9]);
  return { faces: out.filter(Boolean), anchors, zones: { floor: zf, tub: { x: hw, y: [yT, yb], z: [0.4, 1.1] } }, wheelSet: rims(0.27, 0.25, { rim: '#cfd3d6' }) };
}

// ── the Asian cab-overs: the 2-ton and the 4-ton, and the beverage truck on the wide cab ──────────────────────
// (each cab's numbers: its half width, its floor, its roof, its depth; its frame's top, its deck's)
const CAB = Object.freeze({
  light: { hw: 0.82, z0: 1.0, zTop: 2.0, depth: 1.55, zf: 0.66, zD: 0.9 },
  wide: { hw: 1.21, z0: 1.38, zTop: 2.78, depth: 1.9, zf: 0.96, zD: 1.16 },
  beverage: { hw: 1.21, z0: 1.38, zTop: 2.78, depth: 1.9, zf: 0.96, zD: 1.0 },
});
function cabover(kind, fallback) {
  return function build(cls, { words = [] } = {}) {
    const v = VEHICLES[cls], K = CAB[kind], r = v.wheelRadius, axles = cityTruckAxles(cls), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, hw = v.W / 2, out = [];
    const w = cityTruckWords(words), body = w.body ?? fallback;
    chassis(out, { axles, yT, yN: yN - 0.3, r, hw: hw - 0.02, zf: K.zf, sideRails: kind !== 'light', rails: kind === 'light' ? [0.33, 0.4] : [0.4, 0.5], axleHalf: kind === 'light' ? 0.6 : 0.85 });
    const anchors = asianCab(out, { yN, hw: K.hw, z0: K.z0, zTop: K.zTop, yf, r, depth: K.depth });
    const yB0 = yN - K.depth - 0.1, y1 = yT + 0.02, bh = hw - 0.01;
    if (kind === 'beverage') bayBody(out, { y0: yB0, y1, hw: bh, zF: K.zD, H: v.H, n: 4, open: w.open });
    else if (body === 'wing') wingBody(out, { y0: yB0, y1, hw: bh, zF: K.zD, H: kind === 'light' ? 2.95 : v.H, open: w.open ? 1 : 0 });
    else if (body === 'box' || body === 'reefer') aluBox(out, { y0: yB0, y1, hw: bh, zF: K.zD, H: kind === 'light' ? 2.95 : v.H, reefer: body === 'reefer', zCab: K.zTop });
    else if (body === 'dump') dumpTub(out, { y0: yB0, y1, hw: bh - 0.02, zF: K.zD, h: 0.4, tip: w.tipped ? (50 * Math.PI) / 180 : 0, zFrame: K.zf });
    else {
      // (a deck and its drop sides; behind the cab a gate guard, or a crane over a shorter deck)
      const crane = body === 'crane', y0 = crane ? yB0 - 0.8 : yB0;
      dropDeck(out, { y0, y1, hw: bh - 0.03, zD: K.zD, h: kind === 'light' ? 0.38 : 0.45 });
      if (crane) knuckleCrane(out, { y: yB0 - 0.05, hw: bh, zFrame: K.zf, zTop: K.zTop + 0.2 });
      else gateGuard(out, { y: yB0, hw: bh - 0.04, zD: K.zD, zTop: K.zTop });
    }
    tail(out, { yT, hw: hw - 0.04, z: K.zf - 0.02 });
    for (const s of [-1, 1]) {
      out.push(...guard(yr, r, r + 0.06, 0.2, Math.PI - 0.2, ...xs(s, hw - 0.4, hw - 0.03), black('guard.rear')));
      flaps(anchors, s, [s * (v.track / 2), yr - r - 0.1, K.zf - 0.05]);
    }
    const wheelSet = kind === 'light' ? rims(0.19, 0.17) : rims(0.27, 0.24);
    return { faces: out.filter(Boolean), anchors, zones: { floor: K.zf, tub: { x: hw, y: [yT, yN], z: [0.3, K.zf + 0.2] } }, wheelSet };
  };
}

// ── the mini goods carrier ──────────────────────────────────────────────────────
function mini(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], r = v.wheelRadius, axles = cityTruckAxles(cls), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, hw = v.W / 2, out = [];
  const P = (o) => out.push(...plate(o)), w = cityTruckWords(words), zD = 0.74, depth = 1.3;
  chassis(out, { axles, yT, yN: yN - 0.3, r, hw: hw - 0.02, zf: 0.62, sideRails: false, rails: [0.28, 0.34], axleHalf: 0.55 });
  const anchors = miniCab(out, { yN, hw: hw - 0.03, z0: 0.8, zTop: v.H - 0.02, yf, r, depth });
  // (its deck behind the cab, its fixed sides and headboard, its tailgate; a tilt over bows when covered)
  const y0 = yN - depth - 0.06;
  dropDeck(out, { y0, y1: yT + 0.02, hw: hw - 0.04, zD, h: 0.5 });
  P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, zD, zD + 0.75), from: y0 - 0.04, to: y0, r: 0.01, seg: 1, look: paint('headboard') });
  if (w.covered) {
    for (let y = y0 - 0.15; y > yT + 0.1; y -= 0.55) out.push(...tube([[-hw + 0.03, y, zD + 0.5], [-hw + 0.03, y, v.H - 0.25], [hw - 0.03, y, v.H - 0.25], [hw - 0.03, y, zD + 0.5]], 0.012, { sides: 4, look: dark('bow') }));
    P({ axis: 'y', profile: [[-hw, zD + 0.45], [hw, zD + 0.45], [hw, v.H - 0.2], [hw - 0.12, v.H - 0.12], [-hw + 0.12, v.H - 0.12], [-hw, v.H - 0.2]], from: yT + 0.04, to: y0 - 0.02, r: 0.03, seg: 1, look: M('tarp', 'canvas', TC.tarp) });
  }
  tail(out, { yT, hw: hw - 0.04, z: 0.6 });
  for (const s of [-1, 1]) {
    out.push(...guard(yr, r, r + 0.05, 0.2, Math.PI - 0.2, ...xs(s, hw - 0.3, hw - 0.02), black('guard.rear')));
    flaps(anchors, s, [s * (v.track / 2), yr - r - 0.08, 0.55]);
  }
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.62, tub: { x: hw, y: [yT, yN], z: [0.3, 0.75] } }, wheelSet: rims(0.15, 0.15, { dual: false }) };
}

// ── the cube van ────────────────────────────────────────────────────────────────
function cube(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], r = v.wheelRadius, axles = cityTruckAxles(cls), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, hw = v.W / 2, out = [];
  const P = (o) => out.push(...plate(o)), w = cityTruckWords(words), hc = 1.0, zTop = 2.25, yb = yN - 2.15, zF = 0.95, H = v.H;
  // (its skin inside the width by its tape)
  chassis(out, { axles, yT, yN: yf + 0.5, r, hw: hw - 0.05, zf: 0.78, sideRails: false, rails: [0.36, 0.44], axleHalf: 0.75 });
  const anchors = vanCab(out, { yN, yb, hw: hc, zBelt: 1.3, zTop, yf, r });
  // (the box from behind the cab to the tail, and its attic out over the cab's roof; its posts, rails, tape and lamps)
  const skin = own('box', '#f0f0ec', 'plate');
  P({ axis: 'y', profile: rect(-hw, hw, zF, H), from: yT, to: yb - 0.04, r: 0.05, seg: 1, look: skin });
  P({ axis: 'x', profile: [[yb - 0.06, zTop + 0.06], [yb + 0.52, zTop + 0.06], [yb + 0.7, zTop + 0.3], [yb + 0.7, H - 0.12], [yb + 0.58, H], [yb - 0.06, H]], from: -hw, to: hw, r: 0.05, seg: 1, look: skin });
  for (const s of [-1, 1]) {
    for (const z of [zF, H - 0.08]) P({ axis: 'y', profile: rect(...xs(s, hw - 0.02, hw), z, z + 0.08), from: yT, to: yb - 0.04, r: 0.01, seg: 1, look: alu('box.rail') });
    out.push(...stripes({ o: [s * (hw - 0.003), s > 0 ? yT + 0.05 : yb - 0.1, zF + 0.1], u: s > 0 ? Y : neg(Y), v: Z, w: yb - yT - 0.15, h: 0.05, n: [s, 0, 0], colours: [CC.reflRed, CC.reflWhite], pitch: 0.3, part: 'tape' }));
    out.push(...guard(yr, r, r + 0.07, 0.2, Math.PI - 0.2, ...xs(s, hw - 0.42, hw - 0.02), black('guard.rear')));
    out.push(...lamp([s * (hw - 0.12), yT + 0.02, 0.9], neg(Y), 0.12, 0.22, 'tail', 'taillamp'));
    flaps(anchors, s, [s * (v.track / 2), yr - r - 0.1, 0.7]);
  }
  // (its roll-up rear door, up when unloading over a dark box; its rear step)
  const zHead = H - 0.18, zD = w.open ? zHead - 0.3 : zF + 0.02;
  if (w.open) out.push(face([[-hw + 0.08, yT - 0.004, zF + 0.02], [hw - 0.08, yT - 0.004, zF + 0.02], [hw - 0.08, yT - 0.004, zD], [-hw + 0.08, yT - 0.004, zD]], M('doorway', 'seal', '#141516'), neg(Y)));
  P({ axis: 'y', profile: rect(-hw + 0.08, hw - 0.08, zD, zHead), from: yT - 0.02, to: yT, look: own('door.rear', '#e4e5e2', 'plate') });
  for (let z = zD + 0.15; z < zHead - 0.04; z += 0.15) P({ axis: 'y', profile: rect(-hw + 0.09, hw - 0.09, z, z + 0.012), from: yT - 0.024, to: yT - 0.02, look: seam });
  P({ axis: 'z', profile: rect(-hw + 0.1, hw - 0.1, yT, yT + 0.3), from: 0.5, to: 0.58, r: 0.01, seg: 1, look: dark('step.rear') });
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.78, tub: { x: hw, y: [yT, yb], z: [0.35, 0.95] } }, wheelSet: rims(0.22, 0.2) };
}

export const CITY_TRUCK_BODIES = Object.freeze({ medium, light: cabover('light', 'flatbed'), wide: cabover('wide', 'wing'), mini, cube, beverage: cabover('beverage', 'bays') });

const MIRRORS = [['post.L', 'mirror'], ['post.R', 'mirror']];
const FLAPS = [['flap.L', 'mudFlap', { drop: 0.45 }], ['flap.R', 'mudFlap', { drop: 0.45 }]];
/** Each city truck's kit (mil-fittings.js cards on its anchors). */
export const CITY_TRUCK_KITS = Object.freeze(Object.fromEntries(Object.values(CITY_TRUCK_CLASSES).map((k) => [k, Object.freeze([...MIRRORS, ...(k === 'mini' ? [] : FLAPS)])])));

const mono = (c) => Object.freeze({ pattern: 'mono', colours: Object.freeze([c]), marks: Object.freeze({ emblem: false }) });
/** Each city truck's plain livery: its cab's paint. */
export const CITY_TRUCK_LIVERY = Object.freeze({ medium: mono('#9e3b26'), light: mono('#eceae4'), wide: mono('#e9e8e2'), mini: mono('#2c5d9e'), cube: mono('#ecebe6'), beverage: mono('#1f5f8b') });
