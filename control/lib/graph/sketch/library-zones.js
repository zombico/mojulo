/**
 * Library zones — the floor's reading of the shelf model.
 *
 * The splayed-floor home sorts the library into two zones before anything else:
 * 3D (scenes, models, characters, materials — things that are walked, orbited,
 * printed) over 2D (images, diagrams — things that are looked at flat). The
 * split is not curated per artifact: it is the walk-vs-orbit-vs-flat distinction
 * `world-kinds.js` and `sketchRenderMode` already draw, lifted to the surface.
 * A shelf belongs to exactly one zone, so zone counts are sums of the shelf
 * counts the store already tallies — nothing here reads the DB.
 *
 * This module is pure and import-free on purpose, the same posture as
 * library-shelves.js: one place decides the floor's shape, so the route that
 * feeds it and the components that draw it can never disagree.
 *
 * Design: components/3d-factory-ui.plan.md §10 (the splayed floor).
 */

/**
 * The zones, in display order. `shelves` are library-shelves keys; `materials`
 * is the registry rail (no count, no strip rows — it lists presets, not rows).
 */
export const LIBRARY_ZONES = [
  { key: 'd3', shelves: ['scenes', 'models', 'characters', 'materials'] },
  { key: 'd2', shelves: ['images', 'diagrams'] },
];

/**
 * How many faces each strip shows. A strip is a storefront, not the store:
 * the header opens the room with everything in it, and the status bar says so.
 * Scenes and characters get fewer, wider cards; models and images pack denser.
 */
export const STRIP_LIMITS = {
  scenes: 4,
  models: 6,
  characters: 4,
  images: 6,
  diagrams: 4,
};

/** The shelves that render as row-strips on the floor, in display order. */
export const STRIP_SHELVES = LIBRARY_ZONES.flatMap((z) =>
  z.shelves.filter((s) => s in STRIP_LIMITS),
);

/** How many rows the bench's "picked up recently" column shows. */
export const RECENT_PICKS = 3;

/**
 * Zone totals from the shelf counts `shelfCountsFromTallies()` already computes.
 * Materials contributes nothing — presets are a registry, not a population.
 */
export function zoneCounts(shelfCounts = {}) {
  const out = {};
  for (const zone of LIBRARY_ZONES) {
    out[zone.key] = zone.shelves.reduce((n, s) => n + (shelfCounts[s] || 0), 0);
  }
  return out;
}

/**
 * The version-stem heuristic, stated plainly: iteration chains are named by
 * humans mid-flow ("city 1", "Humanoid-Face full assembly v10 - first form",
 * "tram night 7 dense"), so exact rules don't exist and this does not pretend
 * to have them. It strips trailing iteration tokens — bare numbers, vN, and the
 * separators left behind — and nothing else. Conservative by design: a stem
 * that fails to match leaves the artifact a solo card, which is always correct,
 * just less folded.
 */
const ITERATION_TOKEN = /^(?:v\d+[a-z]?|\d+[a-z]?|final|wip)$/i;
const VERSION_TOKEN = /^v\d+[a-z]?$/i;
const TRAILING_PAREN = /\s*[([{][^)\]}]*[)\]}]\s*$/;

export function titleStem(title) {
  if (!title || typeof title !== 'string') return '';
  // A trailing parenthetical is annotation, not identity: "Wizard — dream
  // reconstruction (attested)" and "(disposable)" siblings should meet.
  let t = title.trim().replace(TRAILING_PAREN, '').trim();
  const parts = t.split(/[\s·:—–-]+/).filter(Boolean);
  // An explicit vN anywhere marks the identity/iteration boundary — real chains
  // annotate PAST it ("… v10 - first form", "… v9 - slimmer waist"), so
  // everything from the token on is the iteration, not the name. Bare numbers
  // get no such power mid-title ("apollo 11 landing" is one thing); they only
  // fold when trailing, below.
  const vAt = parts.findIndex((p) => VERSION_TOKEN.test(p));
  if (vAt > 0) parts.length = vAt;
  while (parts.length > 1 && ITERATION_TOKEN.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join(' ').toLowerCase();
}

/**
 * Fold a newest-first row window into stacked faces: rows sharing a stem
 * collapse to their newest row with a `stack` count. Order follows the face
 * (newest sibling), so a chain someone just extended surfaces at its place in
 * time. The count is siblings-in-window and claims nothing more — the room, not
 * the strip, is where a chain is walked.
 */
export function collapseStems(rows = []) {
  const byStem = new Map();
  const order = [];
  for (const row of rows) {
    const stem = titleStem(row?.title) || row?.ref || '';
    const entry = byStem.get(stem);
    if (entry) {
      entry.stack += 1;
      entry.siblings.push(row);
    } else {
      // `siblings` includes the face itself, newest first — the rooms' version
      // filmstrip. Consumers building wire payloads map explicit fields and drop
      // it (the floor route's lightFace), so it never rides to the client twice.
      const face = { ...row, stack: 1, siblings: [row] };
      byStem.set(stem, face);
      order.push(face);
    }
  }
  return order;
}

/** A strip's faces: stem-fold the window, then cap at the strip's limit. */
export function stripFaces(rows = [], shelfKey) {
  const limit = STRIP_LIMITS[shelfKey] || 6;
  return collapseStems(rows).slice(0, limit);
}

/**
 * The character-name stem: the segment before the first spaced dash / em-dash /
 * colon, iteration-folded. Character artifacts are titled "Name — what this one
 * is" ("Green Battle Wizard - Hooded Cape Study", "Sprocket — hero preview
 * P0c"), so the lead segment is the identity and the tail is the study. The
 * separator must be SPACED so hyphenated names ("Humanoid-Face") stay whole.
 */
export function characterStem(title) {
  if (!title || typeof title !== 'string') return '';
  const lead = title.trim().split(/\s+[—–-]\s+|:\s+/)[0] || title;
  return titleStem(lead);
}

/**
 * The cast board's grouping, used by the characters strip: fold the character
 * artifacts (figure / character-sheet / sprite-sheet rows) by NAME stem into one
 * entry per character, keeping the newest row as the face and recording which
 * kinds exist — the card's kit row. Same honesty as the stems: an ungroupable
 * artifact is a cast of one, never hidden.
 */
export function castGroups(rows = []) {
  const byStem = new Map();
  const order = [];
  for (const row of rows) {
    const stem = characterStem(row?.title) || row?.ref || '';
    let entry = byStem.get(stem);
    if (!entry) {
      entry = { ...row, stack: 0, kit: {}, siblings: [] };
      byStem.set(stem, entry);
      order.push(entry);
    }
    entry.stack += 1;
    entry.siblings.push(row);
    // Rows arrive in both shapes: light faces carry `kind` at the top, full
    // sketch objects carry it under `manifest`.
    const kind = row?.kind ?? row?.manifest?.kind;
    if (kind) entry.kit[kind] = (entry.kit[kind] || 0) + 1;
  }
  return order;
}

/**
 * The rooms' facet chips — kind families inside one shelf, from the live
 * store's own population. A facet with `rest: true` is the honest long tail
 * (the science/education views are ~a dozen kinds of a handful each); a kind
 * matching no facet falls to the `rest` facet, or to none, and the All chip
 * always exists implicitly.
 */
export const ROOM_FACETS = {
  scenes: [
    { key: 'walkable', kinds: ['controllable'] },
    { key: 'cities', kinds: ['fractal-city'] },
    { key: 'hubs', kinds: ['transportation-hub', 'subway-building'] },
    { key: 'interiors', kinds: ['dungeon', 'floorplan'] },
  ],
  models: [
    { key: 'workbench', kinds: ['workbench'] },
    { key: 'assembler', kinds: ['assembler'] },
    { key: 'manji', kinds: ['manji-tree'] },
    { key: 'science', rest: true },
  ],
  images: [
    { key: 'stills', kinds: ['css3d-turntable'] },
    { key: 'sequential', kinds: ['sequential-art'] },
    { key: 'painted', kinds: ['image-outcome'] },
    { key: 'carved', kinds: ['carved-solid'] },
    { key: 'other', rest: true },
  ],
};

/** Which facet a kind lands on within a shelf, or null when the shelf has no facets. */
export function facetKeyFor(shelfKey, kind) {
  const facets = ROOM_FACETS[shelfKey];
  if (!facets) return null;
  for (const f of facets) if (f.kinds?.includes(kind)) return f.key;
  return facets.find((f) => f.rest)?.key ?? null;
}

/** Per-facet tallies for a room's rows (kind read from row or manifest). */
export function facetCounts(shelfKey, rows = []) {
  const counts = {};
  for (const row of rows) {
    const key = facetKeyFor(shelfKey, row?.kind ?? row?.manifest?.kind);
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
