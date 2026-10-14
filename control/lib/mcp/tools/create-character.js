/**
 * create_character — the Characters ring's door (3.1.0).
 *
 * A character is a body with a rig you can play, print or watch: a hero (a person), a creature (an
 * invented body) or an animal (a real species). Until 3.1.0 all three sat inside `mint_solid` beside
 * brackets and wordmarks, so "make me a character" landed in the object pack. This door names them
 * and dispatches to the SAME mints, so a character minted here is byte-identical to one minted by
 * `mint_solid` with the same spec (create-character.test.js), and `mint_solid` keeps every kind:
 *
 *   as 'hero'     → mint_solid kind 'layered' via 'hero'   (a cast word, a tune, face, hair, dress)
 *   as 'creature' → mint_solid kind 'layered' via 'plan' when spec.plan, else the layered recipe
 *   as 'animal'   → mint_solid kind 'animal'                (a species, or a bare archetype)
 *
 * Iteration: `update_character` (below), the same door the other way round: a character's own words merged into the
 * stored recipe, carried out by `update_sketch`'s patch path, so an edit through it equals the equivalent patch
 * (create-character.test.js). `update_sketch` keeps every op for anything the words don't reach.
 */

import { registerTool } from '@/lib/mcp/server';
import { mintSolidHandler } from '@/lib/mcp/tools/mint-solid';
import { updateSketchHandler } from '@/lib/mcp/tools/sketch-mint';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { HERO_FIELDS, heroKeyHint, lowerVibe } from '@/lib/mcp/tools/layered';
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';
import { egocubeCreate, egocubePrint } from '@/lib/graph/egocube/kind.js';

// as → the mint_solid call it makes, and the card that is its manual.
export const CHARACTER_DOORS = {
  hero: { card: 'layered', route: () => ({ kind: 'layered', via: 'hero' }) },
  creature: { card: 'layered', route: (spec) => ({ kind: 'layered', ...(spec && spec.plan ? { via: 'plan' } : {}) }) },
  animal: { card: 'animal', route: () => ({ kind: 'animal' }) },
};

const AS_LIST = Object.keys(CHARACTER_DOORS);

/**
 * A character from a stored EGOCUBE (egocube/kind.js): the sheet's node at `years` (the canonical one when none is named)
 * lowered through the door its people take (a person the hero door, a lineage below it the creature door), dressed as the
 * cube says unless `dress` says otherwise; a hero's `spec` words lay over the sheet's. The character records the sheet it
 * was made from ({ ref, rev, print, years }), so an edit to the sheet moves nothing already made and is said on an edit.
 */
async function createFromEgocube({ egocube, years, dress, as, spec, title, ref, folder_ref: folderRef }) {
  const row = SketchRepository.getByRef(egocube);
  if (!row || row.manifest?.kind !== 'egocube') throw new Error(`create_character: '${egocube}' is not an egocube (make one with create_sketch { kind: 'egocube', roll })`);
  const C = egocubeCreate(row.manifest, { years, dress });
  if (as !== undefined && as !== C.create.as) throw new Error(`create_character: the egocube '${egocube}' makes ${C.create.as === 'hero' ? 'a person (as: hero)' : 'a body below the hero door (as: creature)'}; leave \`as\` out`);
  if (spec !== undefined && C.create.as !== 'hero') throw new Error('create_character: `spec` lays a hero\'s words over the sheet; a creature from an egocube is revised after, with update_character patch ops');
  const lean = (C.after || []).find((op) => op.path === '/dials/lean')?.value;
  const own = { ...C.create.spec, ...(spec || {}), ...(lean !== undefined ? { dials: { lean } } : {}) };
  const made = { ref: egocube, rev: (SketchRevisionRepository.head(egocube)?.rev ?? 0) + 1, print: egocubePrint(row.manifest), ...(C.node.years !== undefined ? { years: C.node.years } : {}) };
  const out = throughDoor(await mintSolidHandler({ ...CHARACTER_DOORS[C.create.as].route(own), spec: { ...own, egocube: made }, title: title ?? C.create.title, ref, folder_ref: folderRef }));
  const landed = (C.ledger || []).filter((r) => r.at).length;
  return { ...out, egocube: { ...made, node: C.node, notes: `${landed} of ${(C.ledger || []).length} design notes land on a dial`, pending: (C.ledger || []).filter((r) => r.pending).map((r) => `${r.channel}: ${r.line} (${r.pending})`) } };
}

export async function createCharacterHandler(input) {
  if (input && typeof input === 'object' && input.egocube !== undefined) return createFromEgocube(input);
  if (!input || typeof input !== 'object') {
    throw new Error(`create_character requires an object: { as: ${AS_LIST.map((a) => `'${a}'`).join(' | ')}, spec, title?, ref?, folder_ref? }`);
  }
  const { as, spec, title, ref, folder_ref: folderRef } = input;
  const entry = CHARACTER_DOORS[as];
  if (!entry) {
    throw new Error(
      `create_character: unknown as '${as}'. Known: ${AS_LIST.join(', ')} (a person, an invented body, a real species). `
        + "Manuals: get_solid_vocab({ id: 'layered' }) for a hero or a creature, ({ id: 'animal' }) for an animal.",
    );
  }
  // an animal is titled by what it is, as a hero and a creature are by the door (the animal kind requires a title)
  const named = title ?? (as === 'animal' ? animalTitle(spec) : undefined);
  return throughDoor(await mintSolidHandler({ ...entry.route(spec), spec, title: named, ref, folder_ref: folderRef }));
}

/** A character's next move is its own door's: the mint's `update_sketch` pointer, as `update_character` takes the same ops. */
function throughDoor(out) {
  const n = out?.next;
  if (!n || n.tool !== 'update_sketch' || !n.args?.ref) return out;
  return { ...out, next: { ...n, tool: 'update_character', args: { ref: n.args.ref, ...(n.args.patch ? { patch: n.args.patch } : {}) }, reason: `${n.reason ?? ''} (update_character also takes the hero's own words: spec, target, geocube, vibe)`.trim() } };
}

const animalTitle = (spec) => {
  const what = spec?.species ?? spec?.archetype ?? spec?.maker ?? (spec?.bug && (spec.bug.name ?? spec.bug.like)) ?? 'animal';
  return `animal · ${typeof what === 'string' ? what : 'animal'}`;
};

// ─── update_character ──────────────────────────────────────────────────────
/** the stored kinds a character lives in: a hero or a creature is a layered row, an animal a layered or an animal row */
const CHARACTER_ROW_KINDS = ['layered', 'animal'];
/** what a stored row is, as the door names it: a species ring plan carries its `species` (minted since 3.1.0); an older
 * one reads as a creature, which is what it is to the door (a ring plan, revised by patch ops) */
const asOf = (m) => (m.hero ? 'hero' : m.kind === 'animal' || m.fauna || m.species ? 'animal' : 'creature');

/** an object naming one of these is a whole new thing (a build, a style, an item, a cube from a preset): it replaces */
const IDENTITY_KEYS = ['type', 'style', 'item', 'from'];
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const pointer = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');

/** The ops that lay `value` over `stored` at `path`: plain objects merge key by key, an object naming a build, a style,
 * an item or a `from` replaces whole, lists and words replace, null removes (a key the row does not have is skipped). */
function mergeOps(path, value, stored, top = false) {
  if (value === null) return stored === undefined && !top ? [] : [{ op: 'remove', path }];
  if (isPlain(value) && isPlain(stored) && !IDENTITY_KEYS.some((k) => k in value)) {
    return Object.entries(value).flatMap(([k, v]) => mergeOps(`${path}/${pointer(k)}`, v, stored[k]));
  }
  return [{ op: 'set', path, value }];
}

/**
 * A character's words → update_sketch patch ops on its stored recipe. `spec` (a hero's door words: cast, register, tune,
 * face, hair, detail, adorn, …) merges into the stored hero: a plain object key by key at any depth (`{ adorn: { dials:
 * { stylize: 1 } } }` turns one dial), an object naming `type`, `style`, `item` or `from` replaces its key whole, a list
 * or a word replaces, null removes. `vibe` lowers to the gaits and the stand as at mint. `target` and `geocube` are
 * spec keys named on the door because they tie the hero to its level. A word the door does not take is refused.
 */
export function characterPatch(row, { spec, target, geocube }) {
  const as = asOf(row.manifest), words = { ...(spec || {}), ...(target !== undefined ? { target } : {}), ...(geocube !== undefined ? { geocube } : {}) };
  if (!Object.keys(words).length) return [];
  if (as !== 'hero') {
    throw new Error(`update_character: '${row.ref}' is ${as === 'animal' ? 'an animal' : 'a creature'}; spec, target and geocube are a hero's words today. Edit its recipe with patch ops (${as === 'animal' ? "get_solid_vocab({ id: 'animal' }): /plan/…, /dials/<name> on a species' ring plan" : "get_solid_vocab({ id: 'layered' }): /plan/…, /dials/<name>; a species' ring plan reads the same, its card is get_solid_vocab({ id: 'animal' })"}).`);
  }
  const unknown = Object.keys(words).filter((k) => !HERO_FIELDS.includes(k) && k !== 'vibe');
  if (unknown.length) throw new Error(`update_character refused:\n - ${unknown.map(heroKeyHint).join('\n - ')}`);
  const stored = row.manifest.hero ?? {};
  const { vibe: v, ...given } = words;
  // the vibe lowers to gaits merged over the stored motion, and a stand, as at mint; a motion or a gesture given in the
  // same call wins
  const lowered = v === undefined ? given : lowerVibe(given, v).spec;
  return Object.entries(lowered).flatMap(([k, val]) => mergeOps(`/hero/${pointer(k)}`, val, stored[k], true));
}

export async function updateCharacterHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('update_character requires an object: { ref, spec?, target?, geocube?, patch?, title?, note? }');
  const { ref, spec, target, geocube, patch, title, note, readout, folder_ref: folderRef } = input;
  if (!ref || typeof ref !== 'string') throw new Error('update_character: `ref` is required (the character\'s sketch ref)');
  if (spec !== undefined && (!spec || typeof spec !== 'object' || Array.isArray(spec))) throw new Error('update_character: `spec` is an object of the character\'s words (a key set to null removes it)');
  const row = SketchRepository.getByRef(ref);
  if (!row) throw new Error(`update_character: no sketch '${ref}'`);
  if (!CHARACTER_ROW_KINDS.includes(row.manifest?.kind)) throw new Error(`update_character: '${ref}' is not a character (kind '${row.manifest?.kind}'); revise it with update_sketch`);
  const ops = [...characterPatch(row, { spec, target, geocube }), ...(Array.isArray(patch) ? patch : [])];
  if (patch !== undefined && !Array.isArray(patch)) throw new Error('update_character: `patch` is an array of update_sketch ops');
  if (!ops.length && title === undefined && folderRef === undefined) throw new Error('update_character: give at least one of spec, target, geocube, patch, title, folder_ref');
  const out = await updateSketchHandler({ ref, ...(ops.length ? { patch: ops } : {}), ...(title !== undefined ? { title } : {}), ...(note !== undefined ? { note } : {}), ...(readout !== undefined ? { readout } : {}), ...(folderRef !== undefined ? { folder_ref: folderRef } : {}) });
  // a character made from an egocube says when its sheet has moved since (the character keeps what it was made with)
  const from = row.manifest.egocube, cube = from?.ref ? SketchRepository.getByRef(from.ref) : null;
  const moved = from && (!cube ? `the egocube '${from.ref}' is gone` : cube.manifest?.kind === 'egocube' && egocubePrint(cube.manifest) !== from.print ? `the egocube '${from.ref}' has moved since this character was made from it: it keeps what it was made with; create_character { egocube: '${from.ref}' } makes it anew` : null);
  return moved ? { ...out, egocube: { ...from, moved } } : out;
}

export function registerCreateCharacterTools() {
  registerTool({
    name: 'create_character',
    description:
      "Make a CHARACTER: a body with a rig you can play, print or watch. `as: 'hero'`, a person (spec { cast: "
      + "'male' | 'female', register: 'round' | 'lowpoly' …, tune, face, hair, expression, detail, adorn }); "
      + "`as: 'creature'`, an invented body, a dragon, a monster, a plush toy (spec.plan, a ring plan, or a full "
      + "layered recipe); `as: 'animal'`, a real species (spec { species } or a bare { archetype }). A tiny "
      + 'deterministic recipe served as a still, an orbitable World that plays its clips, and a skinned `.glb`. '
      + "Iterate in place with `update_character`; never re-mint. Manual: get_solid_vocab({ id: 'layered' }) for a hero "
      + "or a creature, ({ id: 'animal' }) for an animal.",
    inputSchema: {
      type: 'object',
      properties: {
        as: { type: 'string', enum: AS_LIST, description: 'hero (a person) | creature (an invented body) | animal (a real species).' },
        egocube: { type: 'string', description: "An egocube's ref (create_sketch kind 'egocube'): its character, at `years` on its thread." },
        years: { type: 'number' },
        spec: { type: 'object', description: "The body's own knobs, per its card (`layered` for hero and creature, `animal` for animal)." },
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
    },
    handler: createCharacterHandler,
  });
  registerTool({
    name: 'update_character',
    description:
      'Revise a CHARACTER in place, same ref: its own words, not JSON pointers. `spec` merges into a hero at any depth '
      + "(cast, register, tune, face, hair, detail, adorn, …; null removes one). `target` is what it is drawn for "
      + "('720p' … '4k', or { resolution, framing: 'close' | 'third-person' | 'wide' | 'top-down', error }): each body "
      + 'part gets the rings its outline needs there. `geocube` bakes it in a level\'s light (and lends its target). '
      + "`patch` takes update_sketch ops for the rest. Archives a revision; the readout gives each part's outline error.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: "The character's sketch ref (from create_character)." },
        spec: { type: 'object', description: "A hero's door words, merged at any depth (an object naming type, style, item or from replaces; null removes)." },
        target: { description: "What it is drawn for: a resolution word ('480p' | '720p' | '1080p' | '1440p' | '4k') or { resolution, framing?, error? } (null removes it)." },
        geocube: { description: 'The cube whose light bakes the hero, and whose target it takes: a preset id, a document or { from, … } (null removes it).' },
        patch: { type: 'array', items: { type: 'object' }, description: 'update_sketch ops, applied after the words.' },
        title: { type: 'string' },
        note: { type: 'string', description: 'A line for the archived revision.' },
        readout: { type: 'string', enum: ['changed', 'summary', 'full'] },
        folder_ref: { type: 'string' },
      },
      required: ['ref'],
    },
    handler: updateCharacterHandler,
  });
}
