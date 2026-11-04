/**
 * THE FIELD'S REALISTIC POLE COMPILED: a realistic sheet whose class is a military one (road-military.js
 * MILITARY_CLASSES) → the vehicle at its class's true numbers, its body the hull kit's, not a road loft. The same shape
 * realistic.js compileRealistic returns, so every door that draws a loft draws it: the quick ride, the studio grid, a
 * world's figure, the GLB.
 *
 *   compileMilitary(sheet, { keys?, form?, livery?, wear?, setting? }) → { spec, faces: { root, wheels }, figure, census, rule, envelope,
 *                                              class, form? }
 *     livery       its paint as words (livery-cut.js: mono or a camo, its stencils), cut into the hull and its fittings;
 *                  absent, plain olive drab and no stencils, as it always was
 *     wear         its history (mil-wear.js: pristine | used | battered, or { level, soil }): caked mud and chips cut
 *                  in, dust, sun fade and grounding per corner; absent, the sheet's when a brief asked it, else `used`
 *     pose         an airside vehicle's ({ reach }: how high its lift, belt or platform stands, road-airside.js)
 *     setting      the world it stands in, when a world draws it ({ sky?, wet? }: world-scene.js): lit by that world's
 *                  sky (form-light.js skyMood), its ground bounce the soil's, its slots wet in the rain; absent, noon
 *     form: true   the figure in the form render (each face its material, albedo and normals, the page lighting it, under
 *                  the field's materials, MIL_MATERIALS); absent, its faces baked under the studio's light (road-form.js
 *                  bakeForm), the figure a world without the form render draws
 *
 * The wheels are the field's (mil-wheel.js: a lugged cross-country tyre on a split steel rim; an airside vehicle's
 * smooth), each its own bone
 * turning in the `roll` clip; each arch its liner on the body; the kit's fittings on the body too (road-military.js
 * KITS), outside the census, which measures the hull against the class. Vehicle space (+y forward). Pure and
 * deterministic.
 */
import { VEHICLES, vehicleRule, envelope } from '../roads/vehicles.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { smoothForm, bakeForm } from './road-form.js';
import { wheelWell } from './road-wheel.js';
import { milWheel } from './mil-wheel.js';
import { formLight, skyMood } from './form-light.js';
import { militaryBody, militaryAxles, trackedGear, sizeOf, MILITARY_CLASSES, MIL_MATERIALS } from './road-military.js';
import { liveryBase } from './livery-cut.js';
import { AIRSIDE_CLASSES } from './road-airside.js';
import { readWear, soilFor, weather, weatherWheel, wetMaterials, wetFaces, groundOf } from './mil-wear.js';
import { realisticCensus, most } from './realistic.js';

const r4 = (n) => Math.round(n * 1e4) / 1e4 + 0;
// a field tyre's width, by its radius (a light 4x4's, a truck's)
const tyreWidth = (r) => (r > 0.5 ? 0.38 : 0.3);

export function compileMilitary(sheet, { keys = 12, form = false, livery, wear, setting = null, pose } = {}) {
  const cls = sheet.facets.class, v = VEHICLES[cls];
  if (!MILITARY_CLASSES[cls]) throw new Error(`car-designer: compileMilitary reads a military class (${Object.keys(MILITARY_CLASSES).join(', ')}), not ${cls}`);
  const spec = { kind: MILITARY_CLASSES[cls], L: v.L, W: v.W, H: v.H, wb: v.wheelbase, track: v.track, r: v.wheelRadius, tyreW: tyreWidth(v.wheelRadius), lift: 0 };
  const tracked = v.running === 'track';
  const { hull, fittings, zones, livery: L, spinners, bones: parts = {} } = militaryBody(cls, { seed: sheet.seed, r: spec.r, tyreW: spec.tyreW, livery, words: sheet.unread?.words ?? [], ...(pose ? { pose } : {}) });
  // the wheels: each axle's pair, the front pair first, left (−x) and right; or a tracked body's spinners (its road
  // wheels first, the sprocket, the idler and the rollers), each its own bone
  const axles = tracked ? trackedGear(cls).wheels.map((w) => w.y) : militaryAxles(cls);
  const wheels = tracked
    ? [...spinners].sort((a, b) => (a.kind === 'road') === (b.kind === 'road') ? 0 : a.kind === 'road' ? -1 : 1).map((sp) => ({ id: sp.id, side: -sp.side, hub: sp.hub, faces: sp.faces }))
    : axles.flatMap((y, axle) => [1, -1].map((side) => ({ axle, side, hub: [-side * spec.track / 2, y, spec.r] })));
  const name = (w) => { if (w.id) return w.id; const lr = w.side > 0 ? 'L' : 'R'; return w.axle === 0 ? `wheelF${lr}` : w.axle === 1 ? `wheelR${lr}` : `wheel${w.axle + 1}${lr}`; };
  // (a track runs under no arch: its fenders are its body's)
  const wells = tracked ? [] : smoothForm(wheels.flatMap((w) => wheelWell({ hub: w.hub, r: spec.r, width: spec.tyreW })));
  // its wear (mil-wear.js): the operator's word, else the sheet's when a brief asked one, else a working vehicle's; its
  // soil the setting's, read from the livery's camo
  // (an airside vehicle works on concrete: kept clean unless a wear is asked)
  const W = readWear(wear ?? (sheet.given?.includes('wear') ? sheet.facets.wear : AIRSIDE_CLASSES[cls] ? 'pristine' : 'used')), soil = soilFor(L);
  // (in the rain, its setting's: the porous slots soaked darker, every slot glossier: mil-wear.js)
  const wet = !!setting?.wet, soak = (fs) => (wet ? wetFaces(fs) : fs);
  const body = soak(weather([...hull, ...wells, ...fittings], W, { hubs: wheels.map((w) => w.hub), r: spec.r, zones, seed: sheet.seed, soil, scale: sizeOf(cls) }));
  // (the rims in the livery's base: a camo's first colour, a mono's own; a tracked body's spinners its own)
  const wheelForm = wheels.map((w) => soak(weatherWheel(w.faces ?? milWheel({ hub: w.hub, r: spec.r, width: spec.tyreW, ...(L ? { paint: liveryBase(L) } : {}), ...(AIRSIDE_CLASSES[cls] ? { lugs: 0 } : {}) }), W, { soil })));
  // centred on its footprint (the body is built centred; the census holds it); a part that turns on its own (a turret)
  // its own bone, its faces those its body tagged with it, held still by the roll
  const own = Object.keys(parts), onRoot = own.length ? body.filter((f) => !f.bone) : body;
  const bones = [{ id: 'root', head: [0, 0, 0] }, ...wheels.map((w) => ({ id: name(w), head: w.hub.map(r4) })), ...own.map((id) => ({ id, head: parts[id].map(r4) }))];
  const formOf = new Map([['root', onRoot], ...wheels.map((w, k) => [name(w), wheelForm[k]]), ...own.map((id) => [id, body.filter((f) => f.bone === id)])]);
  // (without the form render, the same faces baked under the studio's light: what a world without gen-7 draws)
  const baked = new Map([...formOf].map(([b, fs]) => [b, bakeForm(fs)]));
  const figure = {
    ...packVehicleFigure(bones, baked, { keys, ...(own.length ? { rolls: wheels.map(name) } : {}), ...(form ? { form: formOf } : {}) }),
    // (lit as its world is: the world's own sky read as its light when it stands in one, else noon; its ground the soil's
    // bounce; its slots wet in the rain: form-light.js skyMood)
    ...(form ? { form: formLight(skyMood(setting?.sky), wet ? wetMaterials(MIL_MATERIALS) : MIL_MATERIALS, { ground: groundOf(soil) }) } : {}),
    figH: r4(most(body.flatMap((f) => f.corners.map((c) => c[2])))),
    // (as its sheet quotes it: a 4x4's axle to axle, a truck's front axle to its tandem's middle, a carrier's first axle
    // to its last, a tracked body's first road wheel to its last: its track on the ground)
    wheelbase: r4(tracked || axles.length > 3 ? axles[0] - axles[axles.length - 1] : axles[0] - axles.slice(1).reduce((t, y) => t + y, 0) / (axles.length - 1)),
    wheelRadius: r4(spec.r),
    warnings: [],
  };
  const compiled = {
    spec, class: cls, figure, rule: vehicleRule(cls), envelope: envelope(cls),
    faces: { root: baked.get('root'), wheels: wheels.map((w) => ({ bone: name(w), faces: baked.get(name(w)), hub: w.hub.map(r4) })) },
  };
  // (the census measures the hull and its wheels against the class: the fittings hang off it, as a mirror does a car)
  // (and a turret's own, but not its gun, which reaches past the hull's length; nor a launcher's load, its missile and
  // its erector, which stand above it, and its launch table set down behind it)
  const measured = { ...compiled, faces: { ...compiled.faces, root: bakeForm([...hull, ...wells].filter((f) => !/^(gun|missile|erector|table)/.test(f.part))) } };
  return { ...compiled, census: realisticCensus(measured), ...(form ? { form: Object.fromEntries(formOf) } : {}) };
}
