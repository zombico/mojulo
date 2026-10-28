/**
 * meta-fabricator — the FAMILY layer above the workbench.
 *
 * The workbench authors one model (an instance). The meta-fabricator authors a
 * FAMILY: the parametric space a populator samples to spawn many instances at
 * scale. See meta-fabricator.plan.md for the three-tier model
 * (instance → type → family) and the four facets a family binds.
 *
 * Today this is a COMPOSITION layer, not new machinery: every facet already
 * exists, scattered across the vehicle modules. This module names them as one
 * introspectable thing so an authoring surface (and the world-populators) can
 * read "what families exist, what presets/decorations each carries, how to
 * sample one" from a single place instead of branching on hardcoded tables.
 *
 *   1. Frame schema  — the backend builder, dispatched by `backend` tag through
 *                      vehicleFaces() (plane → fuselage net, car/box → swept net).
 *   2. Parameter space — the named presets (TYPES) belonging to the family,
 *                      drawn from the VEHICLE_REGISTRY by their `family` tag.
 *   3. Decoration    — the scheme system: aircraft liveries, car paint+hull,
 *                      or (box) the per-card baked livery with no palette yet.
 *   4. Spawn policy  — per-type `weight` + `contexts`, sampled family-scoped.
 *
 * No geometry is produced here; an authored/sampled instance is handed back to
 * vehicleFaces() (the workbench/world seam) via buildInstanceFaces().
 *
 * THE RACE MACHINES' FAMILIES (`racer`, `supercar`): the same four facets over a GRAMMAR in place of a net — the racer's
 * parts solver (car-designer/racer.js: its types the driver archetypes, its parts library the vocabulary a theme
 * prefers from) and the supercar's surface compiler (car-designer/vehicle-odm-surface.js: its types the library's
 * cards). Their decoration is a THEME (car-designer/vehicle-theme.js): a card of palette, finish, livery, shape and
 * parts, a starter's name, or a card of the user's own, varied across a series. An instance is { family, racer: {…} }
 * or { family, supercar: {…} } (the recipe the race machine's own door takes); building one loads the race machines
 * (car-designer/race-families.js), so it is asynchronous, and the nets' families never load them.
 */

import {
  VEHICLE_REGISTRY, VEHICLE_TYPES, vehicleFaces, vehicleTypesFor, aircraftFootprint,
} from './vehicles/vehicles-css3d.js';
import { AIRCRAFT_LIVERY_SCHEMES, pickAircraftLiveryScheme } from './polygonizer/vehicle-fuselage-net.js';
import { CAR_PAINT_SCHEMES, pickCarPaint, CAR_HULL_NAMES, pickCarHull } from './polygonizer/vehicle-swept-net.js';
import { studioSceneFromFaces } from './worlds/workbench.js';
import { ARCHETYPES } from './egocube/facets.js';
import { SUPERCAR_LIBRARY } from './car-designer/vehicle-library.js';
import { BODIES, PARTS } from './car-designer/parts.js';
import { THEME_IDS, THEME_KEYS, FINISHES, readTheme, seriesTheme } from './car-designer/vehicle-theme.js';

export const META_FABRICATOR_VERSION = 'meta-fabricator-v0.1.0';

// ===========================================================================
// Decoration systems — each knows its scheme vocabulary, how to SAMPLE a
// decoration deterministically from an rng, and how to lower a decoration into
// the partial vehicleFaces() args that apply it. Data-driven so a future
// authoring tool reads the vocabulary and buildInstanceFaces() stays generic.
// ===========================================================================
const LIVERY_DECOR = {
  kind: 'livery',
  schemeNames: () => AIRCRAFT_LIVERY_SCHEMES.map((s) => s.name),
  sample: (rng) => ({ scheme: pickAircraftLiveryScheme(rng) }),
  // accept a scheme object, a scheme name, or an index — normalize to the object.
  resolve: (d = {}) => {
    if (d.scheme && typeof d.scheme === 'object') return { scheme: d.scheme };
    if (typeof d.scheme === 'string') return { scheme: AIRCRAFT_LIVERY_SCHEMES.find((s) => s.name === d.scheme) || pickAircraftLiveryScheme(0) };
    if (typeof d.scheme === 'number') return { scheme: pickAircraftLiveryScheme(d.scheme) };
    return { scheme: pickAircraftLiveryScheme(0) };
  },
  toFaceArgs: (d = {}) => ({ livery: LIVERY_DECOR.resolve(d).scheme }),
};
const PAINT_HULL_DECOR = {
  kind: 'paint+hull',
  schemeNames: () => CAR_PAINT_SCHEMES.map((s) => s.name),
  hullNames: () => [...CAR_HULL_NAMES],
  sample: (rng) => ({ paint: pickCarPaint(rng).body, hull: pickCarHull(rng) }),
  toFaceArgs: (d = {}) => {
    const args = {};
    if (d.paint != null) args.paint = d.paint;
    if (d.hull != null) args.hull = d.hull;
    return args;
  },
};
// Box family: livery is baked into the body/front/rear cards; there is no
// palette/variation system yet (a phase-2 candidate — generalize the sticker
// decorator). So sampling yields no decoration and nothing is applied.
const BAKED_DECOR = {
  kind: 'none',
  schemeNames: () => [],
  sample: () => ({}),
  toFaceArgs: () => ({}),
};

// The race machines' decoration: a theme (a starter's name, its k-th variation, or the user's own card).
const THEME_DECOR = {
  kind: 'theme',
  schemeNames: () => [...THEME_IDS],
  sample: (rng) => { const name = THEME_IDS[Math.floor(rng() * THEME_IDS.length)]; return { theme: seriesTheme(name, Math.floor(rng() * 4)) }; },
  resolve: (d = {}) => ({ theme: d.theme === undefined ? null : readTheme(d.theme) }),
  toFaceArgs: (d = {}) => (d.theme === undefined ? {} : { theme: d.theme }),
};

// ===========================================================================
// Family registry — each binds the four facets. `backend` is the tag
// vehicleFaces() dispatches on; membership is derived from VEHICLE_REGISTRY by
// the matching per-type `family` tag, so adding a type (one registry row) joins
// its family automatically. `tunables` documents the parameter-space axes an
// authoring surface would expose (the net fields that define the preset).
// ===========================================================================
export const VEHICLE_FAMILIES = {
  'fixed-wing-aircraft': {
    id: 'fixed-wing-aircraft',
    label: 'Fixed-wing aircraft',
    backend: 'plane',
    decoration: LIVERY_DECOR,
    tunables: ['proportions.length', 'proportions.radius', 'fuselage.profile', 'fuselage.windows', 'appendages[].span', 'appendages[].drop'],
  },
  'ground-car': {
    id: 'ground-car',
    label: 'Ground vehicle (car)',
    backend: 'car',
    decoration: PAINT_HULL_DECOR,
    tunables: ['length', 'W0', 'seN', 'wid', 'zBot', 'zTop'],
  },
  'ground-box': {
    id: 'ground-box',
    label: 'Ground vehicle (box)',
    backend: 'box',
    decoration: BAKED_DECOR,
    tunables: ['geo.length', 'geo.halfW', 'geo.halfH', 'geo.seN', 'profile', 'wid'],
  },
  'ground-cycle': {
    id: 'ground-cycle',
    label: 'Ground vehicle (cycle)',
    backend: 'cycle',
    decoration: BAKED_DECOR,
    tunables: ['scale'],
  },
  // the race machines: a grammar each, its types its own (every type equally likely), raced
  racer: {
    id: 'racer',
    label: 'Cartoon racer',
    grammar: 'parts',
    key: 'archetype',
    types: () => Object.keys(ARCHETYPES),
    contexts: ['race'],
    decoration: THEME_DECOR,
    tunables: ['archetype', 'build', 'age', 'brief', 'facets', 'seed', 'parts', 'shade', 'light', 'theme'],
  },
  supercar: {
    id: 'supercar',
    label: 'Supercar',
    grammar: 'odm',
    key: 'preset',
    types: () => Object.keys(SUPERCAR_LIBRARY),
    contexts: ['race'],
    decoration: THEME_DECOR,
    tunables: ['preset', 'seed', 'surface.paint', 'surface.livery', 'surface.cabinStyle', 'surface.headlightStyle', 'surface.ventStyle', 'surface.spoilerStyle', 'surface.line', 'light', 'theme'],
  },
};

// backend tag (on a registry row) → family id (the nets' families; a grammar's types are its own)
const BACKEND_TO_FAMILY = Object.fromEntries(
  Object.values(VEHICLE_FAMILIES).filter((f) => f.backend).map((f) => [f.backend, f.id]),
);
const RACE_KINDS = ['racer', 'supercar'];
const raceKindOf = (instance) => RACE_KINDS.find((k) => instance && instance[k] !== undefined) ?? null;

// ===========================================================================
// Introspection
// ===========================================================================
/** All family ids. */
export function listFamilies() { return Object.keys(VEHICLE_FAMILIES); }

/** A family descriptor by id (throws on unknown). */
export function getFamily(id) {
  const fam = VEHICLE_FAMILIES[String(id || '').trim()];
  if (!fam) throw new Error(`meta-fabricator: unknown family "${id}"`);
  return fam;
}

/** The family id a vehicle type belongs to (null if the type/backend is unmapped). */
export function familyOfType(type) {
  const meta = VEHICLE_REGISTRY[type];
  return meta ? (BACKEND_TO_FAMILY[meta.family] ?? null) : null;
}

/** The type (preset) names belonging to a family. */
export function typesInFamily(id) {
  const fam = getFamily(id);                                       // validate
  if (fam.grammar) return fam.types();
  return VEHICLE_TYPES.filter((t) => familyOfType(t) === id);
}

/** Per-type facts: which family/net, coarse class, intrinsic size, spawn weight,
 *  eligible contexts, and (aircraft only) the world footprint at a render scale. */
export function describeType(type, { scale = 1 } = {}) {
  const meta = VEHICLE_REGISTRY[type];
  if (!meta) throw new Error(`meta-fabricator: unknown vehicle type "${type}"`);
  const family = familyOfType(type);
  const out = { type, family, net: meta.net, class: meta.class, size: meta.size, weight: meta.weight, contexts: [...meta.contexts] };
  const fp = aircraftFootprint(type, scale);
  if (fp) out.footprint = fp;
  return out;
}

/** The decoration vocabulary for a family: kind + scheme names (+ hull names for cars). */
export function listDecorations(id) {
  const { decoration: d } = getFamily(id);
  const out = { kind: d.kind, schemes: d.schemeNames() };
  if (d.hullNames) out.hulls = d.hullNames();
  // (a theme: the starters, the finishes it may name, and the keys of a card of one's own)
  if (d === THEME_DECOR) { out.finishes = Object.fromEntries(Object.entries(FINISHES).map(([k, v]) => [k, Object.keys(v)])); out.keys = [...THEME_KEYS]; }
  return out;
}

/** The racer's parts library as a theme's `prefer` reads it: each family's part ids. */
export function partsVocabulary() {
  const out = { body: Object.keys(BODIES) };
  for (const [id, r] of Object.entries(PARTS)) (out[r.family] ??= []).push(id);
  return out;
}

/** Full introspection for an authoring surface: presets, decoration, tunables. */
export function describeFamily(id, { scale = 1 } = {}) {
  const fam = getFamily(id);
  if (fam.grammar) {
    return {
      id: fam.id, label: fam.label, grammar: fam.grammar,
      types: fam.types().map((type) => ({ type, family: fam.id, grammar: fam.grammar, weight: 1, contexts: [...fam.contexts] })),
      decoration: listDecorations(id), tunables: [...fam.tunables],
      ...(fam.id === 'racer' ? { parts: partsVocabulary() } : {}),
    };
  }
  return {
    id: fam.id,
    label: fam.label,
    backend: fam.backend,
    types: typesInFamily(id).map((t) => describeType(t, { scale })),
    decoration: listDecorations(id),
    tunables: [...fam.tunables],
  };
}

// ===========================================================================
// Spawn policy (family-scoped sampling) + the geometry seam
// ===========================================================================
/** Weighted-random TYPE within a family, optionally context-filtered.
 *  `rng()` → [0,1). Returns null if the (family ∩ context) pool is empty. */
export function sampleType(id, rng = Math.random, { context } = {}) {
  const fam = getFamily(id);
  if (fam.grammar) { const pool = context && !fam.contexts.includes(context) ? [] : fam.types(); return pool.length ? pool[Math.floor(rng() * pool.length)] : null; }
  const pool = (context ? vehicleTypesFor(context) : VEHICLE_TYPES).filter((t) => familyOfType(t) === id);
  if (!pool.length) return null;
  const total = pool.reduce((s, t) => s + VEHICLE_REGISTRY[t].weight, 0);
  let r = rng() * total;
  for (const t of pool) { r -= VEHICLE_REGISTRY[t].weight; if (r <= 0) return t; }
  return pool[pool.length - 1];
}

/** Sample a full INSTANCE from a family: a weighted type + a sampled decoration.
 *  This is the family's spawn policy as one call. null if the pool is empty. */
export function sampleInstance(id, rng = Math.random, { context } = {}) {
  const fam = getFamily(id);
  const type = sampleType(id, rng, { context });
  if (!type) return null;
  // (a race machine: its recipe, the type its grammar's key, its theme and its seed thrown on the same dice)
  if (fam.grammar) return { family: id, [id]: { [fam.key]: type, ...fam.decoration.sample(rng), seed: 1 + Math.floor(rng() * 9999) } };
  return { family: id, type, decoration: fam.decoration.sample(rng) };
}

/** A race machine's instance built: its faces and a readout (asynchronous: the race machines load on first build). */
async function buildRaceInstance(instance) {
  const kind = raceKindOf(instance);
  if (instance.type !== undefined) throw new Error(`meta-fabricator: an instance is a registered type or a ${kind}, not both`);
  const spec = instance[kind];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error(`meta-fabricator: a ${kind} instance is its recipe { … } (describeFamily('${kind}').tunables)`);
  const { racerInstanceFaces, supercarInstanceFaces } = await import('./car-designer/race-families.js');
  return { kind, ...(kind === 'racer' ? racerInstanceFaces(spec) : supercarInstanceFaces(spec)) };
}

/** Lower an instance ({ type, decoration }) to faces at a pose — the seam to the
 *  workbench preview and to world placement. The family's decoration system maps
 *  the decoration into the right vehicleFaces() args (livery / paint+hull / none).
 *  vehicleFaces emits the full closed shell (cull:false), so the instance reads from
 *  any camera in an orbit — exactly what a turntable preview needs. */
export function buildInstanceFaces(instance, pose = {}) {
  // (a race machine's: a promise of its faces, at its own pose)
  if (raceKindOf(instance)) return buildRaceInstance(instance).then((b) => b.faces);
  const { type, decoration } = instance || {};
  const famId = familyOfType(type);
  if (!famId) throw new Error(`meta-fabricator: cannot build unknown/unmapped type "${type}"`);
  const fam = VEHICLE_FAMILIES[famId];
  return vehicleFaces({ type, ...pose, ...fam.decoration.toFaceArgs(decoration || {}) });
}

/**
 * PREVIEW a family instance in the workbench's measured studio — the verification seam.
 * Lowers the instance to its full orbitable shell and wraps it in the studio scene (measured
 * grid + turntable cameras + neutral framing), returning the shared scene payload that
 * emitThreeWorld (/world) and emitPreserve3dScene (/scene) consume — the SAME vantage an
 * authored polygomer gets. This is how a sampled/authored vehicle is eyeballed before it joins
 * a fleet library: open it on the grid, confirm the silhouette + livery read, then commit.
 *
 * @param {object} instance  { type, decoration? } (e.g. from sampleInstance()).
 * @param {object} opts  { pose? (vehicleFaces pose: scale/heading/…), title?, viewBox? }.
 */
export function assembleInstanceStudio(instance, opts = {}) {
  if (raceKindOf(instance)) {
    return buildRaceInstance(instance).then(({ kind, faces, stats }) => studioSceneFromFaces(faces, { viewBox: opts.viewBox, title: opts.title || `workbench · ${stats.archetype ?? stats.preset} · ${kind}` }));
  }
  const faces = buildInstanceFaces(instance, opts.pose || {});
  const label = [instance?.type, instance?.family].filter(Boolean).join(' · ');
  return studioSceneFromFaces(faces, { viewBox: opts.viewBox, title: opts.title || `workbench · ${label || 'instance'}` });
}

/**
 * Validate a family instance + return a stat readout (no scene assembled, no geometry stored) —
 * the mint-tool guard, mirroring planWorkbench. Throws a clear error on an unknown/unmapped type
 * or an unbuildable decoration so a bad preview request surfaces as a 400, not a 500.
 * @param {object} instance  { type, decoration? }.
 */
export function planInstance(instance = {}) {
  // (a race machine's: a promise of its readout, its recipe checked by building it)
  if (raceKindOf(instance)) return buildRaceInstance(instance).then(({ kind, stats }) => ({ stats: { family: kind, ...stats, theme: instance[kind].theme ?? null } }));
  const { type, decoration } = instance;
  const family = familyOfType(type);
  if (!family) throw new Error(`meta-fabricator: unknown/unmapped vehicle type "${type}". Known types come from typesInFamily(<family>); families from listFamilies().`);
  const faces = buildInstanceFaces({ type, decoration });   // throws on an unbuildable spec
  const meta = VEHICLE_REGISTRY[type];
  return { stats: { type, family, net: meta.net, class: meta.class, faces: faces.length, decoration: decoration ?? null } };
}
