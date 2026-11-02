/**
 * THE FIELD'S REALISTIC POLE COMPILED: a realistic sheet whose class is a military one (road-military.js
 * MILITARY_CLASSES) → the vehicle at its class's true numbers, its body the hull kit's, not a road loft. The same shape
 * realistic.js compileRealistic returns, so every door that draws a loft draws it: the quick ride, the studio grid, a
 * world's figure, the GLB.
 *
 *   compileMilitary(sheet, { keys?, form? }) → { spec, faces: { root, wheels }, figure, census, rule, envelope, class,
 *                                              form? }
 *     form: true   the figure in the form render (each face its material, albedo and normals, the page lighting it, under
 *                  the field's materials, MIL_MATERIALS); absent, its faces baked under the studio's light (road-form.js
 *                  bakeForm), the figure a world without the form render draws
 *
 * The wheels are the field's (mil-wheel.js: a lugged cross-country tyre on a split steel rim), each its own bone
 * turning in the `roll` clip; each arch its liner on the body; the kit's fittings on the body too (road-military.js
 * KITS), outside the census, which measures the hull against the class. Vehicle space (+y forward). Pure and
 * deterministic.
 */
import { VEHICLES, vehicleRule, envelope } from '../roads/vehicles.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { smoothForm, bakeForm } from './road-form.js';
import { wheelWell } from './road-wheel.js';
import { milWheel } from './mil-wheel.js';
import { formLight } from './form-light.js';
import { militaryBody, militaryAxles, MILITARY_CLASSES, MIL_MATERIALS } from './road-military.js';
import { realisticCensus } from './realistic.js';

const r4 = (n) => Math.round(n * 1e4) / 1e4 + 0;
// a field tyre's width, by its radius (a light 4x4's, a truck's)
const tyreWidth = (r) => (r > 0.5 ? 0.38 : 0.3);

export function compileMilitary(sheet, { keys = 12, form = false } = {}) {
  const cls = sheet.facets.class, v = VEHICLES[cls];
  if (!MILITARY_CLASSES[cls]) throw new Error(`car-designer: compileMilitary reads a military class (${Object.keys(MILITARY_CLASSES).join(', ')}), not ${cls}`);
  const spec = { kind: MILITARY_CLASSES[cls], L: v.L, W: v.W, H: v.H, wb: v.wheelbase, track: v.track, r: v.wheelRadius, tyreW: tyreWidth(v.wheelRadius), lift: 0 };
  const axles = militaryAxles(cls);
  // the wheels: each axle's pair, the front pair first; left (−x) and right
  const wheels = axles.flatMap((y, axle) => [1, -1].map((side) => ({ axle, side, hub: [-side * spec.track / 2, y, spec.r] })));
  const name = (w) => { const lr = w.side > 0 ? 'L' : 'R'; return w.axle === 0 ? `wheelF${lr}` : w.axle === 1 ? `wheelR${lr}` : `wheel${w.axle + 1}${lr}`; };
  const { hull, fittings } = militaryBody(cls, { seed: sheet.seed, r: spec.r, tyreW: spec.tyreW });
  const wells = smoothForm(wheels.flatMap((w) => wheelWell({ hub: w.hub, r: spec.r, width: spec.tyreW })));
  const body = [...hull, ...wells, ...fittings];
  const wheelForm = wheels.map((w) => milWheel({ hub: w.hub, r: spec.r, width: spec.tyreW }));
  // centred on its footprint (the body is built centred; the census holds it)
  const bones = [{ id: 'root', head: [0, 0, 0] }, ...wheels.map((w) => ({ id: name(w), head: w.hub.map(r4) }))];
  const formOf = new Map([['root', body], ...wheels.map((w, k) => [name(w), wheelForm[k]])]);
  // (without the form render, the same faces baked under the studio's light: what a world without gen-7 draws)
  const baked = new Map([...formOf].map(([b, fs]) => [b, bakeForm(fs)]));
  const figure = {
    ...packVehicleFigure(bones, baked, { keys, ...(form ? { form: formOf } : {}) }),
    ...(form ? { form: formLight(null, MIL_MATERIALS) } : {}),
    figH: r4(Math.max(...body.flatMap((f) => f.corners.map((c) => c[2])))),
    wheelbase: r4(axles[0] - axles[1]),
    wheelRadius: r4(spec.r),
    warnings: [],
  };
  const compiled = {
    spec, class: cls, figure, rule: vehicleRule(cls), envelope: envelope(cls),
    faces: { root: baked.get('root'), wheels: wheels.map((w) => ({ bone: name(w), faces: baked.get(name(w)), hub: w.hub.map(r4) })) },
  };
  // (the census measures the hull and its wheels against the class: the fittings hang off it, as a mirror does a car)
  const measured = { ...compiled, faces: { ...compiled.faces, root: bakeForm([...hull, ...wells]) } };
  return { ...compiled, census: realisticCensus(measured), ...(form ? { form: Object.fromEntries(formOf) } : {}) };
}
