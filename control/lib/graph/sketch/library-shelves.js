/**
 * Library shelves — the filter chips over the one sketch store.
 *
 * Mojulo's internal split (world / object / illustration / diagram) is real and
 * load-bearing: it is the walk-vs-orbit-vs-flat distinction in world-kinds.js.
 * It is NOT how a person asks for things. They say scene, model, character,
 * image, diagram. So the vocabulary changes at the surface and the buckets stay
 * exactly where they are — a shelf is a LENS on the store, never a fork of it.
 *
 * This replaces four routes (/sketches, /maker/illustrations, /maker/worlds,
 * /maker/objects) that were the same gallery with a different `bucket` prop, and
 * which made the operator choose a concern before they could look at anything.
 *
 * ── A shelf is a FETCH SCOPE, not just a client-side filter ──────────────────
 * `SketchRepository.list()` caps an unscoped read at `rootLimit` (200) but scans
 * the whole table for a bucket-scoped one, precisely so a gallery never silently
 * loses older artifacts. A workshop here can hold thousands of sketches, so a
 * Library that fetched everything once and filtered in the browser would show a
 * couple of hundred and quietly hide the rest. Every typed shelf therefore names
 * the `bucket` it fetches, and only `recent` is capped — which is why it is named
 * for what it honestly is rather than called "All".
 *
 * Kinds that are heard, spoken, or played (beats, voice, game) are absent on
 * purpose: they have their own homes and no amount of shelving makes a soundtrack
 * an asset you browse next to a floor plan.
 *
 * Design: components/3d-factory-ui.plan.md §2.
 */

import { OBJECT_RENDER_KINDS, SCENE_RENDER_KINDS } from '@/lib/graph/sketch/sketch-manifest';

/**
 * Kinds that depict a CHARACTER. All three live in the illustration bucket, so
 * this shelf shares that fetch and splits on kind — and `images` subtracts them,
 * keeping the shelves a clean partition instead of overlapping views whose counts
 * don't add up.
 */
export const CHARACTER_KINDS = ['figure', 'character-sheet', 'sprite-sheet'];

/**
 * The object bucket splits two ways. SOLIDS are made to be printed or assembled
 * (the workbench, OpenSCAD, the assembler, the polygomer's 3D manji-tree); every
 * other object kind is a VIEW — a scientific or educational study that is
 * orbited and read, never printed. `views` is the object bucket minus the
 * solids, so the two shelves partition it exactly.
 */
export const SOLID_KINDS = ['workbench', 'scad', 'assembler', 'manji-tree'];
export const VIEW_KINDS = OBJECT_RENDER_KINDS.filter((k) => !SOLID_KINDS.includes(k));

/**
 * TURNTABLES live in the illustration bucket but are 3D: a css3d-turntable is a
 * live scene the viewport orbits, and it is by far the commonest thing in that
 * bucket. Shelving it under Images hid the workshop's largest 3D context on the
 * 2D side of the floor; this shelf puts it back where it is looked at.
 */
export const TURNTABLE_KINDS = SCENE_RENDER_KINDS;

/** Buckets with a home of their own; never shelved here. */
export const NON_LIBRARY_BUCKETS = ['beats', 'voice', 'game'];

/**
 * The shelves, in display order. `recent` leads because "what did I just make"
 * is the common landing; it is the one capped view and says so. `materials` is
 * not backed by the sketch store at all — it lists the procedural material
 * registry — so it carries `registry: true` and the gallery swaps its body.
 *
 * `view` names the shelf's ROOM — the contextual body the gallery swaps in the
 * way `registry` already swaps in the material shelf (a scene is scouted, a
 * model is turned, a character is cast, an image is hung, a diagram is read).
 * A shelf without one (`recent`) keeps the default gallery, and every room
 * shelf still offers the full folder view for management (folders, bulk
 * move/delete), so the room adds a reading without removing a capability.
 */
export const LIBRARY_SHELVES = [
  { key: 'recent', capped: true },
  { key: 'scenes', bucket: 'world', view: 'board' },
  { key: 'turntables', bucket: 'illustration', kinds: TURNTABLE_KINDS, view: 'wall' },
  { key: 'models', bucket: 'object', excludeKinds: VIEW_KINDS, view: 'wall' },
  { key: 'views', bucket: 'object', kinds: VIEW_KINDS, view: 'wall' },
  { key: 'characters', bucket: 'illustration', kinds: CHARACTER_KINDS, view: 'cast' },
  { key: 'images', bucket: 'illustration', excludeKinds: [...CHARACTER_KINDS, ...TURNTABLE_KINDS], view: 'masonry' },
  { key: 'diagrams', bucket: 'diagram', view: 'rows' },
  { key: 'materials', registry: true },
];

const SHELF_BY_KEY = new Map(LIBRARY_SHELVES.map((s) => [s.key, s]));
const NON_LIBRARY = new Set(NON_LIBRARY_BUCKETS);

/** The shelf for a key, falling back to `recent` for an unknown or missing one. */
export function shelfByKey(key) {
  return SHELF_BY_KEY.get(key) || SHELF_BY_KEY.get('recent');
}

/**
 * The `?bucket=` this shelf's list request should carry, or null to read the
 * (capped) recent list. Registry shelves fetch nothing.
 */
export function shelfFetchBucket(key) {
  const shelf = shelfByKey(key);
  return shelf.registry ? null : shelf.bucket || null;
}

/** Does this sketch belong in the library at all? */
export function inLibrary(sketch) {
  return Boolean(sketch) && !NON_LIBRARY.has(sketch.bucket);
}

/** Does this sketch sit on this shelf? */
export function onShelf(shelf, sketch) {
  if (!shelf || shelf.registry || !inLibrary(sketch)) return false;
  // Rows arrive in both shapes: a list summary carries `kind` at the top, a full
  // sketch object carries it under `manifest` (sketch-summary.js).
  const kind = sketch.kind ?? sketch.manifest?.kind;
  if (shelf.excludeKinds?.includes(kind)) return false;
  if (shelf.kinds && !shelf.kinds.includes(kind)) return false;
  if (shelf.bucket) return sketch.bucket === shelf.bucket;
  return true;   // `recent`
}

/**
 * Narrow an already-fetched page to the shelf. The fetch has usually done most of
 * the work (it was bucket-scoped); this applies the kind split and keeps
 * beats/voice/game out of the capped `recent` read.
 */
export function filterToShelf(sketches = [], shelfKey) {
  const shelf = shelfByKey(shelfKey);
  if (shelf.registry) return [];
  return sketches.filter((s) => onShelf(shelf, s));
}

/**
 * True shelf totals from whole-table tallies (`SketchRepository.bucketCounts()`).
 *
 * `recent` and `materials` are deliberately absent: one is a cap rather than a
 * population, the other is a registry. A chip with no number is honest; a chip
 * with a number that means something else is not.
 */
export function shelfCountsFromTallies({ buckets = {}, kinds = {} } = {}) {
  const sum = (list) => list.reduce((n, k) => n + (kinds[k] || 0), 0);
  const characters = sum(CHARACTER_KINDS);
  const turntables = sum(TURNTABLE_KINDS);
  // View kinds are object-only, so the subtraction is exact; the polygomer's
  // manji-tree is NOT summed for models because its 2D form is an illustration.
  const views = sum(VIEW_KINDS);
  return {
    scenes: buckets.world || 0,
    turntables,
    models: Math.max(0, (buckets.object || 0) - views),
    views,
    characters,
    images: Math.max(0, (buckets.illustration || 0) - characters - turntables),
    diagrams: buckets.diagram || 0,
  };
}

/**
 * Where a legacy route lands. The four folded index routes keep working by
 * redirecting to their shelf; `/sketches/<ref>` detail pages are untouched.
 */
export const LEGACY_ROUTE_SHELVES = {
  '/sketches': 'diagrams',
  '/maker/illustrations': 'images',
  '/maker/worlds': 'scenes',
  '/maker/objects': 'models',
};
