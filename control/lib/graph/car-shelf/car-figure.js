/**
 * car-figure — a composed car COMPILED: the design (car-library.js composeCar) → its body and parts (car-body.js), the
 * glass set in its frames and parted by its pillars (car-designer/road-glass.js), the body parted into panels with their
 * pulls, mirrors and plates (road-panels.js), its wheels (car-wheels.js) and their wells, smoothed by crease. The shape
 * car-designer/realistic.js compileRealistic returns, so every door that draws a realistic loft draws a composed car:
 * the studio grid, a quick ride, a level's parked vehicles, a world's figure, the GLB.
 *
 *   compileCar(spec, { keys?, form? }) → { spec, design, class, faces: { root, wheels }, figure, rule, envelope, census,
 *                                          form? }
 *     spec   a card's id or a composition (car-library.js readCarSpec)
 *     form   true: the figure in the form render (each face its material, albedo and normals, the page lighting it,
 *            under CAR_MATERIALS at the paint's finish); absent, its faces baked under the studio's light
 *            (road-form.js bakeForm), what a world without the form render draws
 *   carMaterials(design)   the slots' response: the road car's, the paint at its finish, chrome, steel, the cabin's
 *   carCensus(compiled)    the body measured against its class (its mirrors, rails, pipes and splitter left out: they
 *                          hang off it, as the field's fittings do)
 *
 * The figure is the vehicle rig (vehicle-designer/vehicle-rig.js packVehicleFigure): the body the root, each wheel its own
 * bone turning in the `roll` clip. Vehicle space (+y forward). Pure and deterministic.
 */
import { vehicleRule, envelope } from '../roads/vehicles.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { smoothForm, bakeForm, ROAD_MATERIALS } from '../car-designer/road-form.js';
import { wheelWell } from '../car-designer/road-wheel.js';
import { glasshouse } from '../car-designer/road-glass.js';
import { panels } from '../car-designer/road-panels.js';
import { formLight } from '../car-designer/form-light.js';
import { realisticCensus, most } from '../car-designer/realistic.js';
import { composeCar } from './car-library.js';
import { carBody } from './car-body.js';
import { carWheel } from './car-wheels.js';
import { PAINT_FINISHES } from './car-paints.js';

const r4 = (n) => Math.round(n * 1e4) / 1e4 + 0;

export function carMaterials(design) {
  return Object.freeze({
    ...ROAD_MATERIALS,
    paint: PAINT_FINISHES[design.paint.finish],
    chrome: Object.freeze({ metalness: 1, roughness: 0.08 }),
    steel: Object.freeze({ metalness: 0.55, roughness: 0.48 }),
    interior: Object.freeze({ metalness: 0, roughness: 0.78 }),
    fabric: Object.freeze({ metalness: 0, roughness: 0.92 }),
  });
}

// the fittings that hang off the body: outside the census, as a car's mirror is (a spare wheel and the bumpers are
// inside the class's length, so measured)
const FITTING = /^(mirror|rail|exhaust|splitter|diffuser|plate|door\.handle)/;

export function compileCar(spec, { keys = 12, form = false } = {}) {
  const design = composeCar(spec), F = design.frame, cls = design.class, P = design.parts;
  const { faces, hubs } = carBody(design);
  const chrome = P.frames === 'chrome';
  const shaped = panels(glasshouse(faces, { body: design.paint.body, chrome }), { body: design.paint.body, chrome, W: F.W, kind: 'car', seed: design.seed });
  const wells = hubs.flatMap((hub) => wheelWell({ hub, r: F.r, width: F.tyreW }));
  const body = smoothForm([...shaped, ...wells]);
  const wheels = hubs.map((hub, i) => ({ hub, axle: Math.floor(i / 2), side: i % 2 ? -1 : 1, faces: smoothForm(carWheel({ hub, r: F.r, width: F.tyreW, style: P.wheel, tyre: P.tyre })) }));
  const name = (w) => `${w.axle === 0 ? 'wheelF' : 'wheelR'}${w.side > 0 ? 'L' : 'R'}`;
  const bones = [{ id: 'root', head: [0, 0, 0] }, ...wheels.map((w) => ({ id: name(w), head: w.hub.map(r4) }))];
  const formOf = new Map([['root', body], ...wheels.map((w) => [name(w), w.faces])]);
  const baked = new Map([...formOf].map(([b, fs]) => [b, bakeForm(fs)]));
  const figure = {
    ...packVehicleFigure(bones, baked, { keys, ...(form ? { form: formOf } : {}) }),
    ...(form ? { form: formLight(null, carMaterials(design)) } : {}),
    figH: r4(most(body.flatMap((f) => f.corners.map((c) => c[2])))),
    wheelbase: r4(F.wb), wheelRadius: r4(F.r),
    warnings: design.laws.filter((l) => !l.pass).map((l) => `law ${l.id} fails`),
  };
  const spec0 = { kind: 'car', L: F.L, W: F.W, H: F.H, wb: F.wb, track: F.track, r: F.r, tyreW: F.tyreW, lift: F.lift };
  const compiled = {
    spec: spec0, design, class: cls, figure, rule: vehicleRule(cls), envelope: envelope(cls),
    faces: { root: baked.get('root'), wheels: wheels.map((w) => ({ bone: name(w), faces: baked.get(name(w)), hub: w.hub.map(r4) })) },
  };
  return { ...compiled, census: carCensus(compiled, body), ...(form ? { form: Object.fromEntries(formOf) } : {}) };
}

/** The body and its wheels against the class, its fittings left out. */
export function carCensus(compiled, body) {
  const measured = { ...compiled, faces: { ...compiled.faces, root: bakeForm(body.filter((f) => !FITTING.test(f.part))) } };
  return realisticCensus(measured);
}
