/**
 * furnishings/roster — one row per piece of room furniture, under the name people say.
 *
 * A piece used to live in up to five tables under five spellings: the arranger's `type`
 * (floorplan-glyphs.js), its box-net preset and net (room-scene-elements.js,
 * furniture-cards.js), the mesh a share-mode room swaps in (room-assets.js, via
 * SHARE_ASSETS) and the workbench build that stands in for it (CONSTRUCTED_FOR in
 * floorplan-structure.js). The roster is the one place that says those are the same
 * piece. It NAMES; the legacy tables still MEASURE — sizes, bands, footprints, priorities
 * and placement sets stay where the builders read them, so no house changes by a byte.
 *
 * A row:
 *   label      what the piece is called in prose
 *   role       what a room asks for (ROLES); pieces that share a role can stand in for each other
 *   aliases    the words people say for it (search and the resolver), 3+ characters each
 *   type       the arranger / preset / net key it renders as when it is a box-net piece
 *   spellings  other legacy keys that render the same piece (`tv-stand`, `television`)
 *   asset      the room mesh this piece OWNS (room-assets.js id); the mesh's own aliases
 *              join the piece's words
 *   wears      a mesh another piece owns that this one renders with (the desk chair
 *              wears the dining chair)
 *   constructed  the workbench build that stands in for it under `furnishing: 'constructed'`
 *
 * The contract (roster.test.js) holds every key of every legacy table, and every type
 * and mesh an arranger emits, to exactly one row, and the legacy pairings to the rows.
 * One word, one piece: the name index throws on a collision.
 */

// What a room asks for. A slot (later) names a role; any piece of the role can fill it.
export const ROLES = {
  sofa: 'a sofa, the main seat of a lounge',
  'easy-chair': 'an armchair or lounge chair',
  'dining-chair': 'a chair pulled up to a table',
  'desk-chair': 'a chair at a desk',
  stool: 'a backless seat',
  bench: 'a long seat against a wall',
  'coffee-table': 'a low table in front of the seats',
  'dining-table': 'a table to eat at',
  desk: 'a table to work at',
  counter: 'a standing-height counter in a living space',
  bed: 'a bed',
  nightstand: 'a small table beside the bed',
  dresser: 'a chest of drawers',
  bookcase: 'shelves for books',
  shelving: 'open utility shelving',
  cabinet: 'closed storage',
  sideboard: 'a long low cabinet along a dining or living wall',
  media: 'a low unit under a screen',
  rug: 'a rug or runner on the floor',
  lamp: 'a standing lamp',
  'wall-art': 'a picture on a wall',
  'wall-light': 'a light fixed to a wall',
  screen: 'a screen on a wall',
  fixture: 'a plumbed fixture',
  'kitchen-unit': 'a unit of the kitchen run',
  tabletop: 'a small thing set on a table, desk or counter',
};

// Wall openings the room presets also carry; they belong to the building, not the furnishing.
export const NOT_FURNISHINGS = ['window', 'door'];

export const FURNISHINGS = {
  // ── seats ──
  sofa: { label: 'sofa', role: 'sofa', aliases: ['couch', 'settee', 'davenport'], type: 'sofa', constructed: 'constructed-sofa' },
  'modern-couch': { label: 'modern couch', role: 'sofa', aliases: ['modern sofa', 'mid-century sofa'], type: 'modern-couch', asset: 'modern-couch', constructed: 'constructed-sofa' },
  chesterfield: { label: 'chesterfield', role: 'sofa', aliases: ['button-tufted sofa'], asset: 'constructed-chesterfield' },
  armchair: { label: 'armchair', role: 'easy-chair', aliases: ['arm chair', 'easy chair'], type: 'armchair', asset: 'club-armchair', constructed: 'constructed-armchair' },
  'club-chair': { label: 'club chair', role: 'easy-chair', aliases: ['single sofa'], type: 'club-chair', spellings: ['single-sofa'] },
  'lounge-chair': { label: 'lounge chair', role: 'easy-chair', aliases: ['tub chair'], type: 'lounge-chair', spellings: ['tub-chair'] },
  'dining-chair': { label: 'dining chair', role: 'dining-chair', aliases: ['chair', 'ladder-back chair', 'kitchen chair'], type: 'ladder-chair', asset: 'chair', constructed: 'constructed-chair' },
  'yoke-chair': { label: 'yoke-back chair', role: 'dining-chair', aliases: ['yoke back chair'], type: 'yoke-chair' },
  'block-chair': { label: 'block chair', role: 'dining-chair', aliases: ['simple chair'], type: 'chair' },
  'desk-chair': { label: 'desk chair', role: 'desk-chair', aliases: ['office chair', 'computer chair', 'swivel chair'], type: 'computer-chair', wears: 'chair', constructed: 'constructed-chair' },
  stool: { label: 'stool', role: 'stool', aliases: ['bar stool'], type: 'stool' },
  bench: { label: 'bench', role: 'bench', aliases: ['hall bench', 'shoe bench', 'entry bench'], type: 'bench', asset: 'entry-bench' },

  // ── tables and desks ──
  'coffee-table': { label: 'coffee table', role: 'coffee-table', aliases: ['low table', 'cocktail table'], type: 'table', asset: 'coffee-table', constructed: 'constructed-coffee-table' },
  'dining-table': { label: 'dining table', role: 'dining-table', aliases: ['kitchen table', 'farmhouse table'], type: 'dining-table', asset: 'plank-dining-table', constructed: 'constructed-dining-table' },
  'study-table': { label: 'writing desk', role: 'desk', aliases: ['desk', 'study desk', 'writing table'], type: 'study-table', spellings: ['desk'], asset: 'study-table' },
  'computer-table': { label: 'computer desk', role: 'desk', aliases: ['pc desk', 'workstation'], type: 'computer-table', asset: 'computer-table' },
  'standing-desk': { label: 'standing desk', role: 'desk', aliases: ['sit-stand desk'], type: 'standing-desk', asset: 'standing-desk' },
  'l-desk': { label: 'L-shaped desk', role: 'desk', aliases: ['corner desk', 'l desk'], asset: 'l-table' },
  bar: { label: 'bar counter', role: 'counter', aliases: ['breakfast bar', 'home bar'], type: 'bar' },

  // ── the bedroom ──
  bed: { label: 'bed', role: 'bed', aliases: ['double bed', 'queen bed', 'king bed'], type: 'bed', asset: 'platform-bed' },
  nightstand: { label: 'nightstand', role: 'nightstand', aliases: ['bedside table', 'night table'], type: 'nightstand', asset: 'bedside-table', constructed: 'constructed-nightstand' },
  dresser: { label: 'dresser', role: 'dresser', aliases: ['bureau', 'chest'], type: 'dresser', asset: 'low-dresser', constructed: 'constructed-chest' },
  drawers: { label: 'tallboy', role: 'dresser', aliases: ['drawer tower', 'tall dresser'], type: 'drawers', spellings: ['tallboy'] },

  // ── storage ──
  bookcase: { label: 'bookcase', role: 'bookcase', aliases: ['bookshelf', 'book shelf', 'bookshelves'], type: 'bookshelf', asset: 'bookcase', constructed: 'constructed-bookcase' },
  'utility-shelf': { label: 'utility shelving', role: 'shelving', aliases: ['rack shelf', 'wire shelving', 'garage shelving'], type: 'rack-shelf', spellings: ['rackShelves'], asset: 'utility-shelf' },
  cabinet: { label: 'cabinet', role: 'cabinet', aliases: ['cupboard', 'storage cabinet'], type: 'cabinet' },
  sideboard: { label: 'sideboard', role: 'sideboard', aliases: ['buffet'], type: 'sideboard', asset: 'sideboard-cabinet', constructed: 'constructed-sideboard' },
  'media-unit': { label: 'media unit', role: 'media', aliases: ['tv stand', 'entertainment center', 'media console'], type: 'media-unit', spellings: ['tv-stand'], asset: 'media-console', constructed: 'constructed-media-console' },

  // ── floor, light, walls ──
  rug: { label: 'rug', role: 'rug', aliases: ['carpet'], type: 'rug', asset: 'bordered-rug' },
  runner: { label: 'runner', role: 'rug', aliases: ['hall runner', 'runner rug'], type: 'runner' },
  'floor-lamp': { label: 'floor lamp', role: 'lamp', aliases: ['torchiere', 'reading lamp'], type: 'floor-lamp', asset: 'floor-lamp' },
  picture: { label: 'picture', role: 'wall-art', aliases: ['painting', 'artwork', 'framed print', 'poster'], type: 'picture' },
  sconce: { label: 'wall sconce', role: 'wall-light', aliases: ['wall light', 'wall lamp'], type: 'sconce' },
  tv: { label: 'television', role: 'screen', aliases: ['flat screen', 'flatscreen'], type: 'tv', spellings: ['television'] },

  // ── plumbing and the kitchen run ──
  toilet: { label: 'toilet', role: 'fixture', aliases: ['commode', 'lavatory'], type: 'toilet' },
  'kitchen-counter': { label: 'kitchen counter', role: 'kitchen-unit', aliases: ['countertop', 'worktop'], asset: 'kitchen-counter' },
  'kitchen-sink': { label: 'kitchen sink', role: 'kitchen-unit', aliases: [], asset: 'kitchen-sink' },
  'kitchen-stove': { label: 'stove', role: 'kitchen-unit', aliases: ['hob'], asset: 'kitchen-stove' },
  'kitchen-fridge': { label: 'refrigerator', role: 'kitchen-unit', aliases: ['icebox'], asset: 'kitchen-fridge' },
  'kitchen-upper': { label: 'wall cupboard', role: 'kitchen-unit', aliases: ['upper cabinets', 'kitchen cupboard'], asset: 'kitchen-upper' },

  // ── on the table, the desk, the counter ──
  plate: { label: 'plate', role: 'tabletop', aliases: [], asset: 'plate' },
  bowl: { label: 'bowl', role: 'tabletop', aliases: [], asset: 'bowl' },
  cup: { label: 'cup', role: 'tabletop', aliases: [], asset: 'cup' },
  vase: { label: 'vase', role: 'tabletop', aliases: ['flowers'], asset: 'vase' },
  napkin: { label: 'napkin', role: 'tabletop', aliases: ['serviette'], asset: 'napkin' },
  cutlery: { label: 'cutlery', role: 'tabletop', aliases: ['knives and forks'], asset: 'cutlery' },
  'place-setting': { label: 'place setting', role: 'tabletop', aliases: ['table for one'], asset: 'place-setting' },
  notebook: { label: 'notebook', role: 'tabletop', aliases: [], asset: 'notebook' },
  laptop: { label: 'laptop', role: 'tabletop', aliases: [], type: 'laptop', asset: 'laptop' },
  keyboard: { label: 'keyboard', role: 'tabletop', aliases: [], type: 'keyboard', asset: 'keyboard' },
  monitor: { label: 'monitor', role: 'tabletop', aliases: ['computer screen'], type: 'monitor', spellings: ['display'] },
  'pencil-holder': { label: 'pencil holder', role: 'tabletop', aliases: [], asset: 'pencil-holder' },
  mouse: { label: 'computer mouse', role: 'tabletop', aliases: [], asset: 'mouse' },
  'desk-setup': { label: 'desk setup', role: 'tabletop', aliases: [], asset: 'desk-setup' },
  'desktop-tower': { label: 'desktop tower', role: 'tabletop', aliases: [], asset: 'desktop-tower' },
  eyeglasses: { label: 'eyeglasses', role: 'tabletop', aliases: [], asset: 'eyeglasses' },
  sunglasses: { label: 'sunglasses', role: 'tabletop', aliases: [], asset: 'sunglasses' },
  'water-bottle': { label: 'water bottle', role: 'tabletop', aliases: [], asset: 'water-bottle' },
  'wine-glass': { label: 'wine glass', role: 'tabletop', aliases: [], asset: 'wine-glass' },
  'paper-stack': { label: 'stack of paper', role: 'tabletop', aliases: [], asset: 'paper-stack' },
  'mail-stack': { label: 'stack of mail', role: 'tabletop', aliases: [], asset: 'mail-stack' },
};

// ── names ───────────────────────────────────────────────────────────────────
// The animals' rule (fauna/entries.js): lowercase, articles dropped, hyphens and
// underscores read as spaces, so 'Tv-Stand', 'a tv stand' and 'tv_stand' are one word.
const ARTICLES = /^(a|an|the|some)\s+/;
export function normalizeName(word) {
  return String(word || '').toLowerCase().trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').replace(ARTICLES, '');
}
const words = (id) => id.replace(/-/g, ' ');
// a mesh alias that is a dotted registry spelling ('chair.dining') is not a word anyone says
const spoken = (alias) => !alias.includes('.');

let NAME_INDEX = null;
/** Every word that names a piece → its id: the id as words, the label, the aliases, and the
 *  aliases of the mesh it owns. Throws on a collision — one word, one piece. Pass a table of
 *  mesh aliases (`{ assetId: [aliases] }`) to fold them in; the cached index folds none, so
 *  the roster stays free of the mesh registry's imports. */
export function furnishingNameIndex(meshAliases = null) {
  if (!meshAliases && NAME_INDEX) return NAME_INDEX;
  const index = new Map();
  const claim = (word, id) => {
    const key = normalizeName(word);
    if (!key) return;
    const had = index.get(key);
    if (had && had !== id) throw new Error(`furnishings: "${key}" names both ${had} and ${id}`);
    index.set(key, id);
  };
  for (const [id, row] of Object.entries(FURNISHINGS)) {
    claim(words(id), id);
    claim(row.label, id);
    for (const a of row.aliases) claim(a, id);
    if (meshAliases && row.asset) for (const a of meshAliases[row.asset] || []) if (spoken(a)) claim(a, id);
  }
  if (!meshAliases) NAME_INDEX = index;
  return index;
}

/** A word people say → `{ id, row }`, or null. Tries the word, then its singular
 *  ('shelves' → 'shelf', 'benches' → 'bench', 'chairs' → 'chair'). */
export function resolveFurnishing(word, index = furnishingNameIndex()) {
  const key = normalizeName(word);
  if (!key) return null;
  const tries = [key];
  if (key.endsWith('ves')) tries.push(`${key.slice(0, -3)}f`);
  if (key.endsWith('es')) tries.push(key.slice(0, -2));
  if (key.endsWith('s')) tries.push(key.slice(0, -1));
  for (const t of tries) {
    const id = index.get(t);
    if (id) return { id, row: FURNISHINGS[id] };
  }
  return null;
}

// ── handles ─────────────────────────────────────────────────────────────────
/** Every legacy key a row answers to, by table: `types` (arranger / preset / net keys) and
 *  `meshes` (room-asset ids it owns or wears, and its constructed stand-in). */
export function handlesOf(id) {
  const row = FURNISHINGS[id];
  if (!row) return null;
  return {
    types: [row.type, ...(row.spellings || [])].filter(Boolean),
    meshes: [row.asset, row.wears, row.constructed].filter(Boolean),
  };
}

let BY_TYPE = null;
/** The piece a legacy arranger / preset / net key belongs to (or a mesh id an arranger
 *  emits as its type, as the kitchen run does), or null. */
export function pieceOfType(type) {
  if (!BY_TYPE) {
    BY_TYPE = new Map();
    for (const [id, row] of Object.entries(FURNISHINGS)) {
      for (const t of handlesOf(id).types) BY_TYPE.set(t, id);
      if (row.asset && !BY_TYPE.has(row.asset)) BY_TYPE.set(row.asset, id);
    }
  }
  return BY_TYPE.get(type) ?? null;
}

/** The pieces that can fill a role, in roster order. */
export function piecesForRole(role) {
  return Object.keys(FURNISHINGS).filter((id) => FURNISHINGS[id].role === role);
}
