/**
 * THE RACE MACHINES' INSTANCES, BUILT — what the family layer (meta-fabricator.js) hands a racer or a supercar instance
 * to: the machine solved from its recipe (roster.js racerOf, supercar-figure.js supercarOfSpec, its theme worn) and its
 * faces as the workbench's studio draws them (each face its baked fill, the light painted in).
 *
 *   racerInstanceFaces(spec)       a racer's recipe (roster.js racerSpec's entry) → { faces, stats }
 *   supercarInstanceFaces(spec)    a supercar's spec (supercar-figure.js) → { faces, stats }
 *
 * The studio quality for a supercar (the grid's close look), the game's mesh for a racer (it has one). Kept apart from
 * the family layer so the nets' families never load the race machines: it is imported only when one is built.
 */
import { racerSpec, racerOf, racerMeasures } from './roster.js';
import { supercarOfSpec, readSupercarSpec, themeFaces } from './supercar-figure.js';

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
