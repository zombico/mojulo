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

/**
 * Kinds that depict a CHARACTER. All three live in the illustration bucket, so
 * this shelf shares that fetch and splits on kind — and `images` subtracts them,
 * keeping the shelves a clean partition instead of overlapping views whose counts
 * don't add up.
 */
export const CHARACTER_KINDS = ['figure', 'character-sheet', 'sprite-sheet'];

/** Buckets with a home of their own; never shelved here. */
export const NON_LIBRARY_BUCKETS = ['beats', 'voice', 'game'];

/**
 * The shelves, in display order. `recent` leads because "what did I just make"
 * is the common landing; it is the one capped view and says so. `materials` is
 * not backed by the sketch store at all — it lists the procedural material
 * registry — so it carries `registry: true` and the gallery swaps its body.
 */
export const LIBRARY_SHELVES = [
  { key: 'recent', capped: true },
  { key: 'scenes', bucket: 'world' },
  { key: 'models', bucket: 'object' },
  { key: 'characters', bucket: 'illustration', kinds: CHARACTER_KINDS },
  { key: 'images', bucket: 'illustration', excludeKinds: CHARACTER_KINDS },
  { key: 'diagrams', bucket: 'diagram' },
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
  const kind = sketch.manifest?.kind;
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
  const characters = CHARACTER_KINDS.reduce((n, k) => n + (kinds[k] || 0), 0);
  return {
    scenes: buckets.world || 0,
    models: buckets.object || 0,
    characters,
    images: Math.max(0, (buckets.illustration || 0) - characters),
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
