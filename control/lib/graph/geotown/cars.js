/**
 * THE TOWN'S CARS — the cars a geotown parks (at its kerbs, on its pads and drives, in its lots and forecourts) are the
 * vehicle registry's family cars (vehicle-registry/roster.js), each read through its row to its car shelf card
 * (car-shelf/car-library.js) and compiled realistic (car-shelf/car-figure.js compileCar), once a model. A town draws
 * hundreds, so a model is one REPEAT (the page instances it): its painted body baked pale and TINTED per car by its
 * paint, its trim (glass, tyres, wheels, lamps, chrome, seals) one more repeat on the same transforms, untinted.
 *
 *   TOWN_CARS                       a town's fleet when its pattern names none: registry words and their weights
 *   townFleet(words?)               → [{ word, vehicle, card, weight }]: each word read through the registry (a word that
 *                                     is no family car the car shelf builds throws, naming why)
 *   carModel(key)                   → { card, L, W, H, roof: { y, z }, paint: faces, trim: faces }, memoized: vehicle space
 *                                     (+y its nose, z up from the ground under its tyres, its middle at the origin); `key`
 *                                     a car shelf card, or `loft:<class>` a realistic loft (a bus, a van, a box truck, a
 *                                     pickup: car-designer/realistic.js) its paint split from its trim the same way
 *   ROOF_EXTRAS                     what a vehicle may carry on its roof (a light bar, a beacon, a taxi's sign)
 *   pickCar(fleet, R)               → one of the fleet by its weight (one die)
 *   parkCar(list, { x, y, z, heading, paint, model, extra? })   a car placed (heading 0: its nose along +y; radians
 *                                     about +z); `extra` one of ROOF_EXTRAS on its roof
 *   carRepeats(list, { group? })    → repeats: two a model parked (its paint tinted, its trim), and its roof extras'
 *   CAR_PAINT_HEX                   the paints the town's cars are tinted by
 *
 * Pure and deterministic: the compile is the car shelf's, at its own seed.
 */
import { parkable } from '../vehicle-registry/parked.js';
import { handlesOf } from '../vehicle-registry/roster.js';
import { compileCar } from '../car-shelf/car-figure.js';
import { bakeForm } from '../car-designer/road-form.js';
import { compileRealistic } from '../car-designer/realistic.js';
import { rollVehicleSheet } from '../car-designer/sheet.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
// the family cars a town keeps, as people say them, and how often each is parked
export const TOWN_CARS = Object.freeze({ sedan: 3, hatchback: 3, crossover: 3, suv: 2, estate: 1, minivan: 1, supermini: 2 });
// a parked car's paint (yards.js CAR_PAINTS, the town's own): tinted over the pale body
export const CAR_PAINT_HEX = Object.freeze(['#8a2a2a', '#2a3f6a', '#d8d6d0', '#3a3d42', '#6a6f75', '#2f5a3a', '#c9b48a']);
const PALE = '#ffffff';
const lin = (h) => [1, 3, 5].map((k) => { const c = parseInt(h.slice(k, k + 2), 16) / 255; return r4(c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); });
const TINTS = new Map(CAR_PAINT_HEX.map((h) => [h, lin(h)]));

/** A fleet's words read through the registry to their cards. */
export function townFleet(words = TOWN_CARS) {
  return Object.entries(words).map(([word, weight]) => {
    const p = parkable(word, `cars '${word}'`), card = p.car ?? (handlesOf(p.vehicle).car ?? [])[0];
    if (!card) throw new Error(`cars: the ${p.vehicle} is no car the car shelf builds; a town parks its family cars (a sedan, a hatchback, an estate …)`);
    if (!(typeof weight === 'number' && weight > 0)) throw new Error(`cars.${word} is how often it is parked, a number over 0`);
    return { word, vehicle: p.vehicle, card, weight };
  });
}

const MODELS = new Map();
/** A model compiled once (a card, or a loft by its class): its paint faces pale (the tint paints them) and the rest as
 *  they are, baked under the studio's light, its wheels on their hubs; its roof where an extra stands (a car's top, a
 *  truck's or a van's cab's: the front third's). */
export function carModel(card) {
  let m = MODELS.get(card);
  if (m) return m;
  const loft = card.startsWith('loft:');
  const c = loft ? compileRealistic(rollVehicleSheet({ brief: '', facets: { pole: 'realistic', class: card.slice(5) }, seed: 1 }), { form: true }) : compileCar(card, { form: true });
  const body = c.form.root, wheels = Object.entries(c.form).filter(([b]) => b !== 'root').flatMap(([, fs]) => fs);
  const paint = bakeForm(body.filter((f) => f.material === 'paint').map((f) => ({ ...f, albedo: PALE, cornerAlbedo: undefined })));
  const trim = bakeForm([...body.filter((f) => f.material !== 'paint'), ...wheels]);
  const cs = body.flatMap((f) => f.corners), ys = cs.map((q) => q[1]), L = Math.max(...ys) - Math.min(...ys), W = Math.max(...cs.map((q) => q[0])) - Math.min(...cs.map((q) => q[0])), H = Math.max(...cs.map((q) => q[2]));
  const front = loft ? cs.filter((q) => q[1] > Math.max(...ys) - L / 3) : cs, top = front.reduce((a, q) => (q[2] > a[2] ? q : a), front[0]);
  m = Object.freeze({ card, L: r4(L), W: r4(W), H: r4(H), roof: { y: r4(top[1]), z: r4(top[2]) }, paint, trim });
  MODELS.set(card, m);
  if (MODELS.size > 16) MODELS.delete(MODELS.keys().next().value);
  return m;
}

/** One car of the fleet, by its weight. */
export function pickCar(fleet, R) {
  const sum = fleet.reduce((a, f) => a + f.weight, 0);
  let t = R() * sum;
  for (const f of fleet) { t -= f.weight; if (t <= 0) return f.card; }
  return fleet[fleet.length - 1].card;
}

/** A car parked: where, which way its nose (radians about +z, 0 along +y), its paint, its model (a card), its roof's
 *  extra. */
export function parkCar(list, { x, y, z, heading = 0, paint, model, extra = null }) {
  list.push({ pos: [r4(x), r4(y), r4(z)], rotZ: r4(heading), paint, model, ...(extra ? { extra } : {}) });
}

// ── what a vehicle carries on its roof: a light bar (red and blue, or red), an amber beacon, a taxi's lit sign ──
const SHADE = { up: 1, side: 0.78, down: 0.5 };
const tone = (hex, k) => `#${[1, 3, 5].map((i) => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('')}`;
const boxAt = ([x0, x1], [y0, y1], [z0, z1], hex) => [
  { corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], fill: tone(hex, SHADE.up) },
  { corners: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], fill: tone(hex, SHADE.side) }, { corners: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], fill: tone(hex, SHADE.side) },
  { corners: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], fill: tone(hex, SHADE.side) }, { corners: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], fill: tone(hex, SHADE.side) },
];
export const ROOF_EXTRAS = Object.freeze({
  'lightbar-rb': (y, z) => [...boxAt([-0.58, -0.02], [y - 0.14, y + 0.14], [z, z + 0.13], '#c42a2a'), ...boxAt([0.02, 0.58], [y - 0.14, y + 0.14], [z, z + 0.13], '#2a50c4'), ...boxAt([-0.62, 0.62], [y - 0.06, y + 0.06], [z - 0.02, z + 0.02], '#2b2b2b')],
  'lightbar-r': (y, z) => [...boxAt([-0.62, 0.62], [y - 0.14, y + 0.14], [z, z + 0.13], '#d23a2a')],
  beacon: (y, z) => boxAt([-0.12, 0.12], [y - 0.12, y + 0.12], [z, z + 0.16], '#e8a12a'),
  'taxi-sign': (y, z) => [...boxAt([-0.32, 0.32], [y - 0.1, y + 0.1], [z, z + 0.24], '#f4e9b0'), ...boxAt([-0.34, 0.34], [y - 0.12, y + 0.12], [z - 0.02, z], '#2b2b2b')],
});

/** The parked cars as repeats: each model's paint (tinted by each car's paint) and its trim, one transform a car. */
export function carRepeats(list, { group = 'car' } = {}) {
  const by = new Map();
  for (const c of list) (by.get(c.model) ?? by.set(c.model, []).get(c.model)).push(c);
  const out = [];
  for (const [card, cars] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    const M = carModel(card), at = (c) => ({ pos: c.pos, ...(c.rotZ ? { rotZ: c.rotZ } : {}) });
    out.push({ group: `${group}-paint`, template: M.paint, transforms: cars.map((c) => ({ ...at(c), tint: TINTS.get(c.paint) ?? lin(c.paint) })) });
    out.push({ group: `${group}-trim`, template: M.trim, transforms: cars.map(at) });
    // (its roof's extras, each on the same transforms: set back from the roof's top along its nose a little)
    for (const ex of [...new Set(cars.filter((c) => c.extra).map((c) => c.extra))].sort()) out.push({ group: `${group}-${ex}`, template: ROOF_EXTRAS[ex](r4(M.roof.y - 0.3), M.roof.z), transforms: cars.filter((c) => c.extra === ex).map(at) });
  }
  return out;
}
