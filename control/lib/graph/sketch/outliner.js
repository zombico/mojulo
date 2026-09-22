/**
 * The viewport home's reading of an artifact — outliner tree, HUD facts, and the
 * head pick.
 *
 * §3 asks the left rail to be a DCC outliner and says mojulo "genuinely has a
 * tree". It does, but not a fixed one. A `workbench` recipe is lathes + extrudes
 * + sweeps + drapes; a `fractal-city` is elements + civicAreas; a `controllable`
 * is entities + camera + ground + audio. There is no single scene → parts →
 * materials → audio → bakes spine to walk, and pretending otherwise would mean
 * an outliner that is right for cities and empty for everything else.
 *
 * So the outliner reads the RECIPE'S OWN SHAPE: named branches where mojulo has a
 * word for what it found, a generic branch where it doesn't, and never nothing.
 * That is the same posture as the display-mode resolver — one pure module decides
 * what an artifact can show, so no two surfaces can disagree.
 *
 * Design: components/3d-factory-ui.plan.md §3.
 */

/**
 * Branches mojulo has a word for, in display order. `key` is both the manifest
 * path and the i18n key; `group` sorts them into the four bands the rail draws.
 *
 * Order is deliberate — geometry first, because that is what the viewport is
 * showing, then how it is staged, then what it sounds like, then where it came
 * from.
 */
export const OUTLINER_BRANCHES = [
  // geometry — the thing itself
  { key: 'lathes', group: 'geometry' },
  { key: 'extrudes', group: 'geometry' },
  { key: 'sweeps', group: 'geometry' },
  { key: 'drapes', group: 'geometry' },
  { key: 'faces', group: 'geometry' },
  { key: 'figures', group: 'geometry' },
  { key: 'characters', group: 'geometry' },
  { key: 'entities', group: 'geometry' },
  { key: 'elements', group: 'geometry' },
  { key: 'civicAreas', group: 'geometry' },
  { key: 'blocks', group: 'geometry' },
  { key: 'chambers', group: 'geometry' },
  { key: 'tunnels', group: 'geometry' },
  { key: 'masses', group: 'geometry' },
  { key: 'concourses', group: 'geometry' },
  { key: 'stations', group: 'geometry' },
  { key: 'edges', group: 'geometry' },
  { key: 'tree', group: 'geometry' },
  { key: 'shape', group: 'geometry' },
  // staging — how it is looked at
  { key: 'camera', group: 'staging' },
  { key: 'cameras', group: 'staging' },
  { key: 'ground', group: 'staging' },
  { key: 'physics', group: 'staging' },
  { key: 'detail', group: 'staging' },
  { key: 'game', group: 'staging' },
  // sound
  { key: 'audio', group: 'sound' },
  // provenance — where it came from and what has been done to it
  { key: 'giBake', group: 'provenance' },
];

/** The bands, in the order the rail draws them. */
export const OUTLINER_GROUPS = ['geometry', 'staging', 'sound', 'provenance'];

const NAMED = new Map(OUTLINER_BRANCHES.map((b) => [b.key, b]));

/**
 * Manifest keys that are the artifact's identity rather than a branch of it.
 * Listing `title` under geometry would be noise, not structure.
 */
const NOT_A_BRANCH = new Set([
  'kind', 'title', 'seed', 'units', 'viewBox', 'locale', 'time', 'dimensions',
  'contractVersion', 'intent', 'anchor', 'depth', 'density', 'baseScale', 'fidelity', 'view',
  'showSlotMarkers', 'ao', 'fog',
]);

/** How big is this branch? Arrays count; objects count their keys; scalars are 1. */
function measure(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 1;
}

/**
 * The outliner tree for a manifest.
 *
 * Every branch carries `named: false` when mojulo had no word for it, so the rail
 * can render it in a quieter register instead of inventing a label — an unnamed
 * branch is still real structure, and hiding it would make the outliner lie about
 * what the recipe holds.
 */
export function buildOutliner(manifest) {
  if (!manifest || typeof manifest !== 'object') return [];
  const branches = [];
  for (const [key, value] of Object.entries(manifest)) {
    if (NOT_A_BRANCH.has(key)) continue;
    if (value == null || value === false || value === '') continue;
    const named = NAMED.get(key);
    const count = measure(value);
    if (!count) continue;
    branches.push({
      key,
      group: named?.group || 'geometry',
      count,
      named: Boolean(named),
      // A leaf carries no children to expand into — a scalar or a one-key object.
      leaf: !Array.isArray(value) && (typeof value !== 'object' || count <= 1),
    });
  }
  const rank = (b) => {
    const i = OUTLINER_BRANCHES.findIndex((x) => x.key === b.key);
    return i < 0 ? OUTLINER_BRANCHES.length : i;
  };
  return branches.sort(
    (a, b) => OUTLINER_GROUPS.indexOf(a.group) - OUTLINER_GROUPS.indexOf(b.group)
      || rank(a) - rank(b)
      || a.key.localeCompare(b.key),
  );
}

/** Group the branches for drawing, dropping bands the artifact has nothing in. */
export function groupOutliner(branches = []) {
  return OUTLINER_GROUPS
    .map((group) => ({ group, branches: branches.filter((b) => b.group === group) }))
    .filter((g) => g.branches.length > 0);
}

/**
 * What the STL export will actually do with this recipe's units.
 *
 * §3 asks the viewport to say "1 unit = 1 m · stl-ready", and that is not true by
 * default: `facesToStl` multiplies by `scale` and slicers read STL units as
 * MILLIMETRES, so the default export is 1 unit = 1 mm. Only a handful of kinds
 * (workbench) declare `units` at all.
 *
 * So the readout says what is true: the declared unit when there is one, and the
 * `scale` that would print it at true size. A print-at-true-scale claim is one of
 * mojulo's differentiators — it has to be right or it should not be on screen.
 */
export const STL_UNIT_MM = { m: 1000, cm: 10, mm: 1 };

export function scaleStatement(manifest) {
  const declared = typeof manifest?.units === 'string' ? manifest.units.toLowerCase() : null;
  const perUnitMm = STL_UNIT_MM[declared] ?? null;
  return {
    declared: perUnitMm ? declared : null,
    // The `scale` to pass export_model so one world unit prints as one declared
    // unit. Undeclared recipes get 1, which is the honest default rather than a
    // guess at what the operator meant.
    stlScale: perUnitMm ?? 1,
  };
}

/**
 * The HUD readouts, all of them cheap.
 *
 * Deliberately NOT here: triangle count and bounding box. Both need a full
 * `resolveWorldScene` — tens of seconds for a big world — and the home must not
 * pay that to draw a strip of text. §3 lists "tri count"; the honest version is
 * that the number lives one resolve away, in `export_model`, and the viewport
 * says so rather than showing a wrong number or blocking on a right one.
 */
export function hudFacts({ sketch, giBakeFrom = null } = {}) {
  const manifest = sketch?.manifest;
  if (!manifest) return null;
  const branches = buildOutliner(manifest);
  const parts = branches
    .filter((b) => b.group === 'geometry' && !b.leaf)
    .reduce((n, b) => n + b.count, 0);
  return {
    ref: sketch.ref,
    kind: manifest.kind || null,
    seed: manifest.seed ?? null,
    parts,
    branches: branches.length,
    scale: scaleStatement(manifest),
    bake: manifest.giBake
      ? { preset: manifest.giBake.preset || null, at: manifest.giBake.bakedAt || null, from: giBakeFrom }
      : null,
  };
}

/**
 * Kinds the viewport can actually open. `world` and `scene` are the two live
 * readings; everything else is heard, spoken, played, or is a flat still — which
 * the home can show, but not as a VIEWPORT.
 */
const VIEWPORT_MODES = new Set(['world', 'scene']);

/**
 * Which artifact the home opens on: the most recently minted one the viewport can
 * actually open.
 *
 * `renderModeOf` is injected rather than imported so this module stays free of
 * the manifest registry (the client bundle carries it, same as the turntable
 * planner). The caller passes `sketchRenderMode`.
 *
 * Falls back through: a live world → any artifact at all → null. A workshop with
 * only diagrams in it still gets a home that shows something; a workshop with
 * nothing in it gets `null` and the invitation.
 */
export function pickHead(sketches = [], renderModeOf) {
  if (!Array.isArray(sketches) || !sketches.length) return null;
  const live = sketches.find((s) => VIEWPORT_MODES.has(renderModeOf(s?.manifest)));
  return live || sketches[0] || null;
}

/** Does this artifact have a live viewport reading, or is it a still? */
export function isViewportKind(renderMode) {
  return VIEWPORT_MODES.has(renderMode);
}
