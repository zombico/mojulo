/**
 * THE RACE MACHINES' INSTANCES, BUILT — what the family layer (meta-fabricator.js) hands a racer or a supercar instance
 * to: the machine solved from its recipe (roster.js racerOf, supercar-figure.js supercarOfSpec, its theme worn) and its
 * faces as the workbench's studio draws them (each face its baked fill, the light painted in).
 *
 *   racerInstanceFaces(spec)       a racer's recipe (roster.js racerSpec's entry) → { faces, stats }
 *   supercarInstanceFaces(spec)    a supercar's spec (supercar-figure.js) → { faces, stats }
 *   loftInstanceFaces(spec)        a realistic loft's { class, era?, brief?, seed?, light? } (realistic.js compileRealistic: a
 *                                  physics class at its true numbers, in metres) → { faces, stats }: the vehicle
 *                                  registry's realistic build of a road class, on the studio grid
 *   loftFigure(spec, { form? })    the same loft as its vehicle rig, the figure a realistic quick ride drives; in the
 *                                  form render (road-form.js) when its light is form, or absent in a gen-7 read
 *
 * The studio quality for a supercar (the grid's close look), the game's mesh for a racer (it has one). Kept apart from
 * the family layer so the nets' families never load the race machines: it is imported only when one is built.
 */
import { racerSpec, racerOf, racerMeasures } from './roster.js';
import { supercarOfSpec, readSupercarSpec, themeFaces } from './supercar-figure.js';
import { rollVehicleSheet } from './sheet.js';
import { compileRealistic } from './realistic.js';
import { bakeForm } from './road-form.js';

const flat = (fs) => fs.map((f) => ({ corners: f.corners, fill: f.fill }));

export function racerInstanceFaces(entry) {
  const spec = racerSpec(entry, 0, 1), { R, S } = racerOf(spec);
  const faces = flat([...S.faces.root, ...S.faces.wheels.flatMap((w) => w.faces), ...S.faces.bones.flatMap((b) => b.faces)]);
  return { faces, spec, stats: { archetype: R.archetype, parts: S.ids, laws: S.laws.map((l) => l.law), measures: racerMeasures(S), faces: faces.length } };
}

export function supercarInstanceFaces(spec) {
  readSupercarSpec(spec);
  const { car, preset, theme } = supercarOfSpec(spec, { quality: 'studio' });
  const faces = flat(themeFaces([...car.faces.body, ...car.faces.detail, ...car.faces.wheels], theme, car));
  return { faces, spec, stats: { preset, cabinStyle: car.cabinStyle, headlightStyle: car.headlightStyle, livery: car.livery?.pattern ?? 'mono', faces: faces.length } };
}

const LOFT_KEYS = Object.freeze(['class', 'era', 'brief', 'seed', 'light']);
// a loft's recipe compiled: the realistic sheet rolled for its class (its era and brief the sheet's words), then lofted;
// in the form render (gen-7) when its `light` says form, or it says nothing and the read is gen-7
function compileLoft(spec, { form: formRead = false } = {}) {
  const extra = Object.keys(spec).filter((k) => !LOFT_KEYS.includes(k));
  if (extra.length) throw new Error(`meta-fabricator: a loft is { ${LOFT_KEYS.join(', ')} } (no ${extra.join(', ')})`);
  if (typeof spec.class !== 'string') throw new Error('meta-fabricator: a loft names its physics class ({ class: \'pickup\' })');
  if (spec.light !== undefined && !['form', 'paint'].includes(spec.light)) throw new Error('meta-fabricator: a loft\'s light is form (its materials lit by the page) or paint (its light baked)');
  const sheet = rollVehicleSheet({ brief: spec.brief ?? '', facets: { pole: 'realistic', class: spec.class, ...(spec.era ? { era: spec.era } : {}) }, seed: spec.seed ?? 1 });
  const form = spec.light === 'form' || (spec.light === undefined && formRead);
  return { sheet, c: compileRealistic(sheet, { form }) };
}

/** A loft's vehicle rig, as a world's figures map delivers it (the realistic ride's body); `form` the read's (gen-7). */
export function loftFigure(spec, opts = {}) {
  return compileLoft(spec, opts).c.figure;
}

export function loftInstanceFaces(spec) {
  // (on the grid the loft is what a game draws: its named faces, lathed wheels, glasshouse, panels or heavy body,
  // baked under the studio's light from their corner normals, road-form.js bakeForm)
  const { sheet, c } = compileLoft({ ...spec, light: 'form' });
  const faces = bakeForm(Object.values(c.form).flat());
  return { faces, spec, stats: { class: spec.class, era: sheet.facets.era, census: c.census, faces: faces.length } };
}
