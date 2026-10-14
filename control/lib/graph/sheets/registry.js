/**
 * THE SHEETS — every page mojulo draws for a person to look at, by what it is drawn from, so the dashboard can show all
 * of them without anyone asking the agent for one.
 *
 *   REPERTOIRE        drawn from mojulo's own tables, no recipe: what a world can be built from (the index of forms,
 *                     the land, the flora, the blocks, the structures, a fortified town, a castle, technology), in a kit
 *                     and a seed. The kits a sheet draws in are the ones its builder reads (an isekai kit's land, flora
 *                     and civil vocabulary; any kit's land).
 *   recipeSheets(m)   drawn from one recipe: a gameworld's own atlas (the same sheets in the world's kit, seed and its
 *                     civilization's finish), a stage's art board or landform board, a floormap's board, a world's UI
 *                     board. The bibles and the books are the recipe's book (the `/bible` route), not sheets here.
 *
 * Each builder is a pure string function of the recipe (era/out-*-html.js and kin); this module only says which apply
 * and imports a builder when its sheet is drawn. Nothing is stored.
 */
import { STAGE_KITS } from '../era/stage.js';
import { isGameworldKind, gameworldOf } from '../gameworld/gameworld-kind.js';

/** The kits drawn in the isekai look: the ones the civil sheets (flora, blocks, structures, town, castle, tech) read. */
export const ISEKAI_KITS = Object.freeze(Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].shell === 'isekai'));
export const ALL_KITS = Object.freeze(Object.keys(STAGE_KITS));

// each builder imported only when its sheet is drawn, by an explicit path (a bundler cannot follow a templated one)
export const REPERTOIRE = Object.freeze([
  { id: 'index', name: 'Index', kits: null, build: async (o) => (await import('../era/out-index-html.js')).outIndexHtml(o) },
  { id: 'land', name: 'Land', kits: ALL_KITS, build: async (o) => (await import('../era/out-land-html.js')).outLandHtml(o) },
  { id: 'flora', name: 'Flora', kits: ISEKAI_KITS, build: async (o) => (await import('../era/out-flora-html.js')).outFloraHtml(o) },
  { id: 'blocks', name: 'Blocks', kits: ISEKAI_KITS, finish: true, build: async (o) => (await import('../era/out-blocks-html.js')).outBlocksHtml(o) },
  { id: 'structures', name: 'Structures', kits: ISEKAI_KITS, build: async (o) => (await import('../era/out-structures-html.js')).outStructuresHtml(o) },
  { id: 'fortified-town', name: 'Fortified town', kits: ISEKAI_KITS, build: async (o) => (await import('../era/out-fortified-town-html.js')).outFortifiedTownHtml(o) },
  { id: 'castle', name: 'Castle', kits: ISEKAI_KITS, build: async (o) => (await import('../era/out-castle-html.js')).outCastleHtml(o) },
  { id: 'tech', name: 'Technology', kits: ISEKAI_KITS, finish: true, build: async (o) => (await import('../gameworld/tech-html.js')).techIndexHtml(o) },
]);
const BY_ID = new Map(REPERTOIRE.map((s) => [s.id, s]));

/** A repertoire sheet by id, or null. */
export const repertoireSheet = (id) => BY_ID.get(id) ?? null;

/** Does this repertoire sheet draw in this kit? (A sheet with no kits draws in none; it takes no kit.) */
export const drawsIn = (sheet, kitId) => !sheet.kits || sheet.kits.includes(kitId);

/** The repertoire as the dashboard lists it: id, name, the kits it draws in. */
export const repertoireList = () => REPERTOIRE.map(({ id, name, kits }) => ({ id, name, kits: kits ?? [] }));

/** Draw a repertoire sheet: `{ kit?, seed?, finish? }`. Throws for a kit the sheet does not draw in. */
export async function drawRepertoire(id, { kit, seed = 8, finish } = {}) {
  const sheet = repertoireSheet(id);
  if (!sheet) throw new Error(`sheets: '${id}' is not a sheet (${REPERTOIRE.map((s) => s.id).join(', ')})`);
  if (sheet.kits && kit && !sheet.kits.includes(kit)) throw new Error(`sheets: ${id} is drawn in ${sheet.kits.join(', ')}, not '${kit}'`);
  return sheet.build({ seed, ...(sheet.kits && kit ? { kitId: kit } : {}), ...(sheet.finish && finish ? { finish } : {}) });
}

// ── one recipe's sheets ──────────────────────────────────────────────────────────────────────────────────────────

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A gameworld's own atlas: the repertoire in its kit, its seed, and its first civilization's finish. */
function worldAtlas(m) {
  const w = gameworldOf(m);
  const kit = w.style?.kit;
  if (!kit || !STAGE_KITS[kit]) return [];
  const civ = Object.values(isObj(w.civilizations) ? w.civilizations : {})[0];
  const finish = civ?.technology?.finish;
  const seed = Number.isFinite(w.seed) ? w.seed : 8;
  return REPERTOIRE.filter((s) => s.kits && s.kits.includes(kit))
    .map((s) => ({ id: s.id, name: s.name, build: () => s.build({ seed, kitId: kit, ...(s.finish && finish ? { finish } : {}) }) }));
}

/** The sheets one recipe draws: [{ id, name, build() → html }]. */
export function recipeSheets(m) {
  if (!isObj(m)) return [];
  if (isGameworldKind(m.kind)) return worldAtlas(m);
  const out = [];
  if (m.kind === 'stage' && isObj(m.art)) out.push({ id: 'art-board', name: 'Art board', build: async () => (await import('../era/art-board-html.js')).artBoardHtml(m) });
  if (m.kind === 'stage' && m.trail !== undefined && m.trail !== false && STAGE_KITS[m.kit || 'isekai-meadow']?.shell !== undefined) {
    out.push({ id: 'trail-board', name: 'Landform board', build: async () => (await import('../era/out-trail-board.js')).outTrailBoardHtml(m) });
  }
  if (m.kind === 'floormap') out.push({ id: 'floormap-board', name: 'Floormap board', build: async () => (await import('../era/floormap-board-html.js')).floormapBoardHtml(m) });
  if (isObj(m.play?.ui) && m.play.ui.guide) out.push({ id: 'ui-board', name: 'UI board', build: async () => (await import('../playscape/ui/board-html.js')).uiBoardHtml(m) });
  return out;
}

/** One recipe's sheet by id, drawn, or null when the recipe has no such sheet. */
export async function drawRecipeSheet(m, id) {
  const sheet = recipeSheets(m).find((s) => s.id === id);
  return sheet ? sheet.build() : null;
}
