/**
 * create_game / get_game_vocab — the Mojulo Game Designer entry point
 * (game-metacontext.plan.md). The fourth artifact paradigm's mint: a GAME is a
 * standalone artifact — a shell that owns a typed store, hosting N levels that
 * are pure functions of their inputs. Mojulo is the factory; play data never
 * enters mojulo.
 *
 * `create_game` mints the game manifest (kind:'game') as a `sketches` row — a
 * pure recipe of a store schema + promoted level refs. Levels are worlds minted
 * with a `game:` contract channel (compose_world … { game: {…} }); the mint
 * VERIFIES each referenced level exists and carries a contract valid against the
 * game's store, failing loudly if not (promotion discipline). The playable game
 * is served at /sketches/<ref> via /api/sketches/<ref>/game (the shell, with each
 * level hosted in an iframe over the postMessage contract).
 *
 * Store-schema manuals live in game-vocab cards (one per slice kind + the
 * typed-event family), indexed under source_kind='game_vocab' — semantic_search
 * to find, get_game_vocab to read. Errors teach: a failed mint points at the cards.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { validateGameManifest, normalizeGameManifest } from '@/lib/graph/game/game-manifest';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { auditLevel } from '@/lib/graph/game/game-audit';
import { getGameVocabCatalog } from '@/lib/graph/game/slice-cards/loader';

const levelSrc = (ref) => `/api/sketches/${encodeURIComponent(ref)}/world`;

export function mintGame({ title, store, levels, ref, folderRef, audits, allowUnaudited = false } = {}) {
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) throw new Error('`folderRef` must be a non-empty string or null if provided');
    if (!SketchFolderRepository.getByRef(folderRef)) throw new Error(`Folder '${folderRef}' not found`);
  }

  const manifest = { kind: 'game', title, store, levels };
  const { ok, errors } = validateGameManifest(manifest);
  if (!ok) throw new Error(`Invalid game manifest:\n - ${errors.join('\n - ')}`);

  // Promotion discipline (structural): verify every level exists and carries a contract valid
  // against THIS game's store before the game row is written — a game never ships pointing at a
  // level that can't be played or whose events its store can't apply.
  const { manifest: finalized, levels: resolved } = resolveGame(manifest, (r) => SketchRepository.getByRef(r), levelSrc);

  // Promotion GATE (verification, G4): each level must pass a contract dry-run (always) AND be
  // shown completable by a stored traversal (unless allow_unaudited). A game is not minted until
  // every level is promotable — the substrate's "dry-run → inspect → promote" posture, made a gate.
  const auditMap = audits && typeof audits === 'object' ? audits : {};
  const auditReports = resolved.map((lv) => auditLevel({
    ref: lv.ref,
    store: finalized.store,
    contract: lv.contract,
    motionRef: auditMap[lv.ref] && auditMap[lv.ref].motion_ref,
    allowUnaudited,
  }));
  const blocked = auditReports.filter((a) => !a.promotable);
  if (blocked.length) {
    const lines = blocked.map((a) => {
      const why = !a.dryRun.ok ? a.dryRun.errors.join('; ') : a.reason;
      return `  • ${a.ref}: ${why}`;
    });
    throw new Error(`cannot promote ${blocked.length} level(s) into '${title}' — verification gate:\n${lines.join('\n')}`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest: normalizeGameManifest(finalized), ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    playUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/game`,
    levels: finalized.levels.map((l) => l.ref),
    audits: auditReports.map((a) => ({ ref: a.ref, completable: a.completable, result: a.result, audited: a.completable === true, note: a.reason })),
  };
}

export async function createGameHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error("create_game requires an object: { title, store: { slices }, levels: [{ ref, title?, gate? }] }");
  }
  const { title, store, levels, ref, folder_ref: folderRef, audits, allow_unaudited: allowUnaudited } = input;
  try {
    return mintGame({ title, store, levels, ref, folderRef, audits, allowUnaudited: !!allowUnaudited });
  } catch (err) {
    // Error-as-drawer: a failed mint points at the store-schema manuals.
    throw new Error(`${err.message}\n— store-schema manuals: get_game_vocab() (slices: character | inventory | party | progression | flags; events: typed-events).`);
  }
}

export async function getGameVocabHandler(input) {
  const { id } = input && typeof input === 'object' ? input : {};
  const catalog = getGameVocabCatalog();
  if (id) {
    const card = catalog.get(id);
    if (!card) throw new Error(`get_game_vocab: unknown card '${id}'. Known: ${[...catalog.keys()].join(', ')}`);
    return { ok: true, card };
  }
  return {
    ok: true,
    cards: [...catalog.values()].map(({ id: cid, name, summary, when }) => ({ id: cid, name, summary, when })),
  };
}

export function registerGameTools() {
  registerTool({
    name: 'create_game',
    description:
      'Mint a GAME — a standalone playable artifact composed of levels you have already minted as '
      + 'worlds (the fourth creatable paradigm, sibling to bots / connected services / apps). A game '
      + 'is a SHELL that owns a typed STORE plus a list of promoted LEVELS; the shell renders a '
      + 'pre-level setup screen from each level\'s declared inputs, hosts the level, and applies its '
      + 'one outcome to the store. Persistent state (a character\'s level, an inventory, a customizable '
      + 'army, story flags, campaign unlocks) lives in the store and carries between levels; play data '
      + 'never enters mojulo. `store.slices` declares the store from five slice kinds '
      + '(character | inventory | party | progression | flags); `levels` lists refs of worlds minted '
      + 'WITH a `game:` contract channel (compose_world … { game: { levelRef, consumes, produces } }), '
      + 'in play order, each optionally `gate`d on a flag or a completed level. Design the store first: '
      + "find slice kinds by intent via semantic_search({ kinds: ['game_vocab'] }) and read manuals via "
      + 'get_game_vocab. VERIFICATION GATE: every level must pass a contract dry-run (always) and be '
      + 'shown COMPLETABLE — pass `audits: { <levelRef>: { motion_ref } }`, where motion_ref is a '
      + 'forge_motion traversal of that level whose run reached the win condition; a level with no '
      + 'audit is refused unless `allow_unaudited: true`. Played at /sketches/<ref>. Reach for '
      + '"make a game", "a tactics game with a persistent army", "a dungeon crawler where loot carries '
      + 'between levels", "a campaign with level unlocks".',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the game.' },
        store: {
          type: 'object',
          description: "The typed store: { slices: [{ name, kind, init? }] }. kind ∈ character|inventory|party|progression|flags. Manuals: get_game_vocab({ id: 'slice-<kind>' }).",
          properties: { slices: { type: 'array', items: { type: 'object' } } },
          required: ['slices'],
        },
        levels: {
          type: 'array',
          description: 'Promoted levels in play order: [{ ref, title?, gate? }]. Each ref is a world minted with a `game:` contract channel. gate ∈ { flag, equals?, slice? } | { completed: <ref>, slice? }.',
          items: { type: 'object' },
        },
        ref: { type: 'string', description: 'Optional stable sketch ref for the game.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
        audits: {
          type: 'object',
          description: "Completability evidence per level: { <levelRef>: { motion_ref } }. motion_ref is a forge_motion TRAVERSAL of that level (world_ref = the level) whose run reached the win condition — its final probe carries game.result:'success'. The gate verifies the stored probe. A level with no audit is refused unless allow_unaudited.",
        },
        allow_unaudited: { type: 'boolean', description: "Promote levels that lack a completability audit. The contract dry-run still runs (always). Recorded per level in the result (audited:false). Default false — a game is beatable-by-construction unless you opt out." },
      },
      required: ['title', 'store', 'levels'],
    },
    handler: createGameHandler,
  });

  registerTool({
    name: 'get_game_vocab',
    description:
      'Read a game-vocab card in full — the routing phrases + store-schema manual for one store '
      + 'SLICE KIND (slice-character / slice-inventory / slice-party / slice-progression / slice-flags: '
      + 'state shape, the typed events it accepts, how a level consumes/produces it) or the typed-events '
      + 'reference (the whole mutation vocabulary). Pass `id` for one card; omit for the index rows '
      + "{ id, name, summary, when }. Discover cards by intent via semantic_search({ kinds: ['game_vocab'] }); "
      + 'this reader returns the full body. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Card id (slice-<kind> or typed-events).' },
      },
      required: [],
    },
    handler: getGameVocabHandler,
  });
}
