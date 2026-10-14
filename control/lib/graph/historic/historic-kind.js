/**
 * historic-kind — the `historic` world kind: a culture at its period, solved from its form and drawn on the World page.
 *
 *   { kind: 'historic', culture: 'thebes', scene?: 'city' | 'region' | 'slice', focus?, form?, seed?, view?, people?, statues? }
 *
 * Every scene is the solver's (./solver/index.js): `city` the town, `region` the town in its land with the work done
 * in it (its farms and crafts, ../land-kits.js), `slice` a slice of life cut from the region round a `focus` (an
 * activity's id, or 'street', 'monument', 'water', 'gate', 'market'). `form` rewrites any field of the culture's form
 * (./form/schema.js: the site, the water, the armature, the streets, the density, what is placed where), checked and
 * refused by name, so a town is configured as data rather than re-written.
 *
 * `people` (any scene): its people and beasts, static figures for scale — true, or { density 0–1, year, citizens: false,
 * hands: false, beasts: false, crews: false }. `year` dresses them as the record says that year's people dressed
 * (./dress.js). `statues` (the city): stored statues stood on its statue slots (./statues.js).
 *
 * A manifest is checked before anything is built: an unknown culture, scene, focus or view is refused with the ids on
 * offer.
 */
import { HISTORIC_CULTURES, assembleHistoricWorld, planHistoricCity } from './historic-city.js';
import { SCENES, SLICE_FOCI, formOf, sliceFoci } from './solver/index.js';
import { validateStatues } from './statues.js';

/** The scenes each culture has: every culture is solved at every scale. */
export const HISTORIC_SCENES = Object.freeze(Object.fromEntries(SCENES.map((s) => [s, Object.freeze({ get cultures() { return Object.keys(HISTORIC_CULTURES); } })])));
export { SLICE_FOCI };

const list = (a) => a.map((x) => `'${x}'`).join(', ');

/**
 * A manifest's options for the solver and the World, checked: `{ scene, opts }`. Throws on an unknown culture, scene,
 * focus, form field or view, naming what is on offer.
 */
export function historicOptions(m = {}) {
  const culture = m.culture;
  if (!HISTORIC_CULTURES[culture]) throw new Error(`historic: unknown culture '${culture}' — one of ${list(Object.keys(HISTORIC_CULTURES))}`);
  const scene = m.scene ?? 'city';
  if (!SCENES.includes(scene)) throw new Error(`historic: unknown scene '${scene}' — one of ${list(SCENES)}`);
  const opts = { culture, scene, seed: Number.isInteger(m.seed) ? m.seed : 1 };
  if (m.form !== undefined) {
    if (!m.form || typeof m.form !== 'object' || Array.isArray(m.form)) throw new Error('historic: form is { …changes } to the culture\'s form, or { from: <culture>, …changes }');
    try { formOf(culture, m.form); } catch (e) { throw new Error(`historic: ${e.message}`); }
    opts.form = m.form;
  }
  if (m.focus !== undefined) {
    if (scene !== 'slice') throw new Error(`historic: focus picks what a slice of life is cut round; the '${scene}' scene has none`);
    const foci = historicFoci(opts);
    if (!foci.includes(m.focus)) throw new Error(`historic: ${culture} has no slice of life round '${m.focus}' — one of ${list(foci)}`);
    opts.focus = m.focus;
  }
  if (m.people !== undefined && m.people !== false) {
    const p = m.people;
    if (p !== true && (typeof p !== 'object' || p === null || Array.isArray(p))) throw new Error('historic: people is true or { density, year, citizens, hands, beasts, crews }');
    if (typeof p === 'object' && p.density !== undefined && !(Number.isFinite(p.density) && p.density >= 0 && p.density <= 1)) throw new Error('historic: people.density is a number from 0 to 1');
    if (typeof p === 'object' && p.year !== undefined && !(Number.isInteger(p.year) && p.year !== 0)) throw new Error('historic: people.year is a whole year, BCE negative (no year 0)');
    opts.people = p;
  }
  if (m.view !== undefined) {
    const views = historicViews(opts);
    if (!views.includes(m.view)) throw new Error(`historic: ${culture} ${scene} has no view '${m.view}' — one of ${list(views)}`);
    opts.view = m.view;
  }
  // `statues` (historic/statues.js): stored statues stood on the city's statue slots, in the World; absent ⇒ none
  if (m.statues !== undefined) {
    const errs = validateStatues(m.statues); if (errs.length) throw new Error(`historic: ${errs.join('; ')}`);
    if (scene !== 'city') throw new Error(`historic: statues stand on a city's statue slots; the '${scene}' scene has none`);
    if (m.statues === 'carved' || m.statues.length) opts.statues = m.statues;
  }
  return { scene, opts };
}

/** What a slice of life may be cut round: its activities, its street, its monument … (read off the form). */
export function historicFoci({ culture, form }) {
  return sliceFoci(culture, form);
}

/** The views a scene opens on: the aerial, the approach, and the plan's own eye-level views. */
export function historicViews({ view, people, statues, ...opts }) {
  void view; void people; void statues;
  const plan = planHistoricCity(opts);
  return ['aerial', 'approach', ...Object.keys(plan.views || {})];
}

/** The `historic` world kind's payload: the checked manifest's scene on the World page. */
export function assembleHistoricKindScene(m = {}, { title } = {}) {
  const { opts } = historicOptions(m);
  const payload = assembleHistoricWorld(opts);
  return title ? { ...payload, title } : payload;
}
