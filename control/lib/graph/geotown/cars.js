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
 *   carModel(card)                  → { card, L, W, H, paint: faces, trim: faces }, memoized: vehicle space (+y its nose,
 *                                     z up from the ground under its tyres, its middle at the origin)
 *   pickCar(fleet, R)               → one of the fleet by its weight (one die)
 *   parkCar(list, { x, y, z, heading, paint, model })   a car placed (heading 0: its nose along +y; radians about +z)
 *   carRepeats(list, { group? })    → repeats: two a model parked (its paint tinted, its trim)
 *   CAR_PAINT_HEX                   the paints the town's cars are tinted by
 *
 * Pure and deterministic: the compile is the car shelf's, at its own seed.
 */
import { parkable } from '../vehicle-registry/parked.js';
import { handlesOf } from '../vehicle-registry/roster.js';
import { compileCar } from '../car-shelf/car-figure.js';
import { bakeForm } from '../car-designer/road-form.js';

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
/** A card compiled once: its paint faces pale (the tint paints them) and the rest as they are, baked under the studio's
 *  light, its wheels on their hubs. */
export function carModel(card) {
  let m = MODELS.get(card);
  if (m) return m;
  const c = compileCar(card, { form: true }), F = c.design.frame;
  const body = c.form.root, wheels = Object.entries(c.form).filter(([b]) => b !== 'root').flatMap(([, fs]) => fs);
  const paint = bakeForm(body.filter((f) => f.material === 'paint').map((f) => ({ ...f, albedo: PALE, cornerAlbedo: undefined })));
  const trim = bakeForm([...body.filter((f) => f.material !== 'paint'), ...wheels]);
  m = Object.freeze({ card, L: r4(F.L), W: r4(F.W), H: r4(F.H), paint, trim });
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

/** A car parked: where, which way its nose (radians about +z, 0 along +y), its paint, its model (a card). */
export function parkCar(list, { x, y, z, heading = 0, paint, model }) {
  list.push({ pos: [r4(x), r4(y), r4(z)], rotZ: r4(heading), paint, model });
}

/** The parked cars as repeats: each model's paint (tinted by each car's paint) and its trim, one transform a car. */
export function carRepeats(list, { group = 'car' } = {}) {
  const by = new Map();
  for (const c of list) (by.get(c.model) ?? by.set(c.model, []).get(c.model)).push(c);
  const out = [];
  for (const [card, cars] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    const M = carModel(card), at = (c) => ({ pos: c.pos, ...(c.rotZ ? { rotZ: c.rotZ } : {}) });
    out.push({ group: `${group}-paint`, template: M.paint, transforms: cars.map((c) => ({ ...at(c), tint: TINTS.get(c.paint) ?? lin(c.paint) })) });
    out.push({ group: `${group}-trim`, template: M.trim, transforms: cars.map(at) });
  }
  return out;
}
