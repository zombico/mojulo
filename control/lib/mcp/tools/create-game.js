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

import { listingRows, DETAIL_PROPERTY } from '@/lib/mcp/vocab-listing';
import { registerTool } from '@/lib/mcp/server';
import { RENDER_TOOL_TIMEOUT_MS } from '@/lib/mcp/telemetry';
import { isToolRefusal } from '@/lib/errors/tool-refusal';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { GameProjectRepository, GameProjectMemberRepository } from '@/lib/db/repositories/game-projects';
import { validateGameManifest, normalizeGameManifest } from '@/lib/graph/game/game-manifest';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { auditLevel } from '@/lib/graph/game/game-audit';
import { withChromiumFetch } from '@/lib/graph/scene/chromium-consent';
import { getGameVocabCatalog } from '@/lib/graph/game/slice-cards/loader';
import { gameworldCards, GAMEWORLD_CARD_IDS, SAMPLE_PAGES } from '@/lib/graph/gameworld/gameworld-cards';
import { gameworldSamples } from '@/lib/graph/gameworld/samples';
import { getMechanicVocabCatalog } from '@/lib/graph/game/mechanic-cards/loader';
import { getKitVocabCatalog } from '@/lib/graph/game/kit-cards/loader';
import { getGlyphVocabCatalog } from '@/lib/graph/game/glyph-cards/loader';
import { getSfxVocabCatalog } from '@/lib/graph/game/sfx-cards/loader';
import { getHudVocabCatalog } from '@/lib/graph/game/hud-cards/loader';
import { getIdiomVocabCatalog } from '@/lib/graph/game/idiom-cards/loader';
import { playCards, playIndex, playRung, PLAY_RUNGS } from '@/lib/graph/playscape/ui/cards';
import { suggestScore, levelScoreContext, sceneStyle } from '@/lib/graph/beats/score-suggest';
import { seedOfRef } from '@/lib/graph/beats/field-cue';

// The field score each level calls for (beats/score-suggest.js), for the levels with no soundtrack of their own, and
// their action sounds ('auto') where they have none: one
// identity across the game (its ref seeds `game`), each level's own ref its cue's seed. Advice: create_game never
// writes a level; the reply carries the update_sketch call that does.
function suggestLevelMusic(levelRefs, gameRef) {
  const game = seedOfRef(gameRef);
  const out = [];
  // the row's title stands in for a manifest that carries none (its place words often live there)
  const rows = levelRefs.map((ref) => { const row = SketchRepository.getByRef(ref), m = row?.manifest; return m ? { ref, m, ctx: { ...m, title: m.title ?? row.title } } : null; });
  // one style for the game (one score): electronic when most of its levels read so (score-suggest sceneStyle)
  const club = rows.filter((r) => r && sceneStyle(levelScoreContext(r.ctx)) === 'club').length * 2 > rows.filter(Boolean).length;
  const style = club ? 'club' : 'field';
  rows.forEach((r, i) => {
    if (!r || r.m.audio?.soundtrack) return;
    const { ref, m } = r;
    const s = suggestScore({ ...levelScoreContext(r.ctx, { final: levelRefs.length > 1 && i === levelRefs.length - 1 }), style });
    if (!s) return;
    // and its action sounds, when it has none: the palette the score implies, wired to its mechanics (sfx-palettes.js)
    // a fight level plays its scene's music and changes to the fight's when the tension rises (adaptive-music.js)
    const score = (mood) => ({ score: { mood, ...(club ? { style } : {}), game } });
    const audio = { ...(m.audio && typeof m.audio === 'object' ? m.audio : {}), soundtrack: score(s.explore ?? s.mood), ...(s.explore ? { combat: score(s.mood) } : {}), ...(m.audio?.sfx ? {} : { sfx: 'auto' }) };
    out.push({ level: ref, mood: s.mood, why: s.why, also: s.also, brief: s.brief, apply: { ref, patch: [{ op: 'set', path: '/audio', value: audio }] } });
  });
  return out.length ? {
    style,
    suggest: out,
    how: "each level's `apply` is an update_sketch call (its score, and sfx 'auto' where it has no sounds); the shared `game` seed keeps one score identity across the levels. "
      + "Name another mood in score.mood to override, and cast its instruments for the brief's feeling in score.cast "
      + "(one cast on every level keeps one sound). Manuals: get_beats_vocab({ id: 'beats-world-audio' }), get_beats_vocab({ id: 'beats-casting' }).",
  } : null;
}

const levelSrc = (ref) => `/api/sketches/${encodeURIComponent(ref)}/world`;

export async function mintGame({ title, store, levels, links, menu, music, theme, setup, difficulty, shell, run, front, ref, folderRef, audits, allowUnaudited = false, autoAudit = false, runTraversal = null, projectRef = null } = {}) {
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
  // Project claim validated BEFORE the mint so a typo'd gp_ ref fails cheap
  // (game-developer.plan.md GP1). The bind itself happens after the row lands.
  if (projectRef !== null && projectRef !== undefined) {
    if (typeof projectRef !== 'string' || !projectRef) throw new Error('`project_ref` must be a non-empty gp_ ref if provided');
    if (!GameProjectRepository.getByRef(projectRef)) {
      throw new Error(`Game project '${projectRef}' not found (game projects are retired: leave project_ref out, or name one made before)`);
    }
  }

  const manifest = { kind: 'game', title, store, levels, ...(links !== undefined ? { links } : {}), ...(menu !== undefined ? { menu } : {}), ...(music !== undefined ? { music } : {}), ...(theme !== undefined ? { theme } : {}), ...(setup !== undefined ? { setup } : {}), ...(difficulty !== undefined ? { difficulty } : {}), ...(shell !== undefined ? { shell } : {}), ...(run !== undefined ? { run } : {}), ...(front !== undefined ? { front } : {}) };
  const { ok, errors } = validateGameManifest(manifest);
  if (!ok) throw new Error(`Invalid game manifest:\n - ${errors.join('\n - ')}`);

  // Promotion discipline (structural): verify every level exists and carries a contract valid
  // against THIS game's store before the game row is written — a game never ships pointing at a
  // level that can't be played or whose events its store can't apply.
  // (a building or room stage that asks to be a level is lowered inside resolveGame: structure/level.js)
  const { manifest: finalized, levels: resolved } = resolveGame(manifest, (r) => SketchRepository.getByRef(r), levelSrc);

  // Promotion GATE (verification, G4 + M3): each level must pass a contract dry-run (always) AND be
  // shown completable — by a stored traversal (motion_ref), or by AUTO-RUNNING its mechanic-derived
  // audit (auto_audit — M3, no hand-authored traversal), else the allow_unaudited waiver. A game is
  // not minted until every level is promotable — "dry-run → inspect → promote", made a gate.
  const auditMap = audits && typeof audits === 'object' ? audits : {};
  // auto_audit runner: lazily built from the real headless traversal path (browser); injectable for
  // tests. Only constructed when asked, so a normal mint never imports the render pipeline.
  // auto_audit is an explicit render request: on a host with no browser its headless
  // run may download Chrome for Testing, and the result says so (browser_download).
  let browserDownload = null;
  const traverse = autoAudit ? (runTraversal || (await import('@/lib/graph/game/auto-audit-runner')).runLevelTraversal) : null;
  const autoRun = traverse
    ? async (arg) => {
        const { value, fetched } = await withChromiumFetch(() => traverse(arg));
        if (fetched) browserDownload = fetched.notice;
        return value;
      }
    : null;
  const auditReports = await Promise.all(resolved.map((lv) => auditLevel({
    ref: lv.ref,
    store: finalized.store,
    contract: lv.contract,
    motionRef: auditMap[lv.ref] && auditMap[lv.ref].motion_ref,
    allowUnaudited,
    autoRun,
  })));
  const blocked = auditReports.filter((a) => !a.promotable);
  if (blocked.length) {
    const lines = blocked.map((a) => {
      const why = !a.dryRun.ok ? a.dryRun.errors.join('; ') : a.reason;
      return `  • ${a.ref}: ${why}`;
    });
    throw new Error(`cannot promote ${blocked.length} level(s) into '${title}' — verification gate:\n${lines.join('\n')}\nnext: prove each blocked level completable — a forge_motion traversal that reaches its win condition passed via audits:{<ref>:{motion_ref}}, or auto_audit:true for mechanic-declared levels; allow_unaudited:true records the skip per level.`);
  }

  const sketch = SketchRepository.create({ title, manifest: normalizeGameManifest(finalized), ref, folderRef: folderRef ?? null });

  // Project claim: the minted game becomes the project's ACTIVE rules member
  // (newest bind wins; a prior rules member stays as history). Levels/music
  // are NOT copied into members — they surface as implied members at read
  // time, derived from this manifest (store only what isn't derivable).
  let project = null;
  if (projectRef) {
    GameProjectMemberRepository.bind({ projectRef, memberRef: sketch.ref, role: 'rules' });
    project = { ref: projectRef, url: `/games/${encodeURIComponent(projectRef)}` };
  }

  const levelMusic = suggestLevelMusic(finalized.levels.map((l) => l.ref), sketch.ref);
  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    playUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/game`,
    playtestUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/playtest`,
    levels: finalized.levels.map((l) => l.ref),
    audits: auditReports.map((a) => ({ ref: a.ref, completable: a.completable, result: a.result, audited: a.completable === true, note: a.reason, ...(a.autoAuditPlan ? { audit_plan: a.autoAuditPlan } : {}) })),
    ...(levelMusic ? { music: levelMusic } : {}),
    ...(project ? { project } : {}),
    ...(browserDownload ? { browser_download: browserDownload } : {}),
  };
}

export async function createGameHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error("create_game requires an object: { title, store: { slices }, levels: [{ ref, title?, gate? }] }");
  }
  const { title, store, levels, links, menu, music, theme, setup, difficulty, shell, run, front, ref, folder_ref: folderRef, audits, allow_unaudited: allowUnaudited, auto_audit: autoAudit, project_ref: projectRef } = input;
  try {
    return await mintGame({ title, store, levels, links, menu, music, theme, setup, difficulty, shell, run, front, ref, folderRef, audits, allowUnaudited: !!allowUnaudited, autoAudit: !!autoAudit, projectRef });
  } catch (err) {
    if (isToolRefusal(err)) throw err; // REF_EXISTS already names its next move
    // Error-as-drawer: a failed mint points at the store-schema manuals.
    throw new Error(`${err.message}\n— store-schema manuals: get_game_vocab() (slices: character | inventory | party | progression | flags; events: typed-events).`);
  }
}

export async function getGameVocabHandler(input) {
  const { id, scope, samples, n, seed } = input && typeof input === 'object' ? input : {};
  // the rail leads: the game book's guide and its page cards, and its synthetic samples (gameworld/)
  const rail = gameworldCards();
  if (samples !== undefined) {
    return { ok: true, ...gameworldSamples(samples, { ...(n !== undefined ? { n } : {}), ...(seed !== undefined ? { seed } : {}) }), _telemetrySignal: { id_requested: true, found: true } };
  }
  if (id && rail.has(id)) return { ok: true, card: rail.get(id), _telemetrySignal: { id_requested: true, found: true } };
  const slices = getGameVocabCatalog();
  const mechanics = getMechanicVocabCatalog();
  const kits = getKitVocabCatalog();
  const glyphs = getGlyphVocabCatalog();
  const sfx = getSfxVocabCatalog();
  const hud = getHudVocabCatalog();
  const idioms = getIdiomVocabCatalog();
  if (id) {
    const card = slices.get(id) || mechanics.get(id) || kits.get(id) || glyphs.get(id) || sfx.get(id) || hud.get(id) || idioms.get(id);
    if (!card) {
      throw new Error(`get_game_vocab: unknown card '${id}'. Known: ${[...rail.keys(), ...slices.keys(), ...mechanics.keys(), ...kits.keys(), ...glyphs.keys(), ...sfx.keys(), ...hud.keys(), ...idioms.keys()].join(', ')}. Find one by intent via semantic_search({ kinds: ['game_vocab', 'game_mechanic', 'game_kit', 'game_hud', 'game_idiom'], query: '<your ask>' }).`);
    }
    return { ok: true, card, _telemetrySignal: { id_requested: true, found: true } };
  }
  const row = (cat, cardScope) => listingRows([...cat.values()].map(({ id: cid, name, summary, when }) => ({ id: cid, name, summary, when, scope: cardScope })), { detail: input?.detail === true });
  const railRows = scope && scope !== 'rail' ? [] : row(rail, 'rail');
  if (scope === 'rail') return { ok: true, cards: railRows, _telemetrySignal: { id_requested: false, found: true } };
  const cards = [
    ...(scope && scope !== 'slice' ? [] : row(slices, 'slice')),
    ...(scope && scope !== 'mechanic' ? [] : row(mechanics, 'mechanic')),
    ...(scope && scope !== 'kit' ? [] : row(kits, 'kit')),
    ...(scope && scope !== 'glyph' ? [] : row(glyphs, 'glyph')),
    ...(scope && scope !== 'sfx' ? [] : row(sfx, 'sfx')),
    ...(scope && scope !== 'hud' ? [] : row(hud, 'hud')),
    ...(scope && scope !== 'idiom' ? [] : row(idioms, 'idiom')),
  ];
  if (scope) return { ok: true, cards, _telemetrySignal: { id_requested: false, found: true } };
  return {
    ok: true,
    rail: { read: `${GAMEWORLD_CARD_IDS[0]} first: the loop and the principles; then a page card by id; samples: '<${Object.keys(SAMPLE_PAGES).join(' | ')}>' to browse random fragments`, cards: railRows },
    machinery: 'the rows below are what the rail is built on: read one when going past it (a store slice, a level mechanic, a kit the compiler builds a game type from, a glyph, an sfx verb, a hud card, an idiom rule)',
    cards,
    _telemetrySignal: { id_requested: false, found: true },
  };
}

// THE PLAY DRAWER (playscape/ui/cards.js): playscape served scaled to the ask — the ladder with no argument, a rung's
// set with `rung`, one card in full with `id`.
export async function getPlayVocabHandler(input) {
  const { id, rung } = input && typeof input === 'object' ? input : {};
  if (id) {
    const card = playCards().get(id);
    if (!card) throw new Error(`get_play_vocab: unknown card '${id}'. Known: ${[...playCards().keys()].join(', ')}.`);
    return { ok: true, card, _telemetrySignal: { id_requested: true, found: true } };
  }
  if (rung !== undefined) {
    const read = playRung(rung);
    if (!read) throw new Error(`get_play_vocab: unknown id: rung ${rung} — rungs are ${PLAY_RUNGS.map((r) => r.rung).join(', ')}.`);
    return { ok: true, ...read, _telemetrySignal: { id_requested: true, found: true } };
  }
  return { ok: true, ...playIndex(), _telemetrySignal: { id_requested: false, found: true } };
}

export function registerGameTools() {
  registerTool({
    name: 'create_game',
    // May fetch Chrome for Testing first, then bake: past the 120 s default.
    timeoutMs: RENDER_TOOL_TIMEOUT_MS,
    description:
      'Mint a GAME — a standalone playable artifact composed of levels you have already minted as '
      + 'worlds (the fifth creatable paradigm — composition over Media: levels, music, art). A game '
      + 'is a SHELL that owns a typed STORE plus a list of promoted LEVELS; the shell renders a '
      + 'pre-level setup screen from each level\'s declared inputs, hosts the level, and applies its '
      + 'one outcome to the store. Persistent state (a character\'s level, an inventory, a customizable '
      + 'army, story flags, campaign unlocks) lives in the store and carries between levels; play data '
      + 'never enters mojulo. `store.slices` declares the store from five slice kinds '
      + '(character | inventory | party | progression | flags); `levels` lists refs of worlds minted '
      + 'WITH a `game:` contract channel (compose_world … { game: { levelRef, consumes, produces } }), '
      + 'in play order, each optionally `gate`d on a flag or a completed level. A level need not hand-wire '
      + 'its contract: declare `game.mechanics` (reusable verbs — reach-exit / survive / collect / '
      + "hazard-damage / fail-on-death + a `fall` policy; find them via semantic_search({ kinds: ['game_mechanic'] }) "
      + '+ get_game_vocab) and the world behavior + contract are SYNTHESIZED. Design the store first: '
      + "find slice kinds by intent via semantic_search({ kinds: ['game_vocab'] }) and read manuals via "
      + 'get_game_vocab; a game KIT (dungeon-crawler / collectathon / survival-arena) shows how a type is wired: '
      + 'machinery, not a design. A game with a hero, powers and systems is designed on the rail first '
      + '(design_game). VERIFICATION GATE: every level must pass a contract dry-run (always) and be '
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
          description: 'Promoted levels in play order: [{ ref, title?, gate? }]. Each ref is a world minted with a `game:` contract channel, or a building minted with `level: { goal }` (mint_building). gate ∈ { flag, equals?, slice? } | { completed: <ref>, slice? }.',
          items: { type: 'object' },
        },
        menu: {
          type: 'object',
          description: "Optional game-frame presentation: { tagline?, entries: [{ id, title, subtitle?, kind: 'levels'|'world', ref? }] }. When present the shell boots Start screen → main menu; exactly one entry is kind:'levels' (the level list), kind:'world' entries iframe another stored world by ref (e.g. a hangar/viewer). Omit for the plain level-list shell.",
        },
        music: {
          type: 'object',
          description: "Optional shell score by beats ref: { menu?: <beatsRef>, battle?: [<beatsRef>, …], volume?, menuVolume?, battleVolume? }. The menu track loops on menu/setup screens; the battle list rotates while a level runs. Refs must be stored beats artifacts (create_beats); the shell streams their derived WAV renders. The volume keys (0..1) set the music BED LEVEL so the score plays under the game's own SFX — defaults: battle 0.4, menu 0.55; `volume` sets both, the per-context keys override. A kind:'world' menu entry (e.g. a hangar) is silent shell-side — give that world its own manifest `audio` channel instead.",
        },
        theme: {
          type: 'object',
          description: "Optional presentation skin: { accent?, accent2?, ink?, bg?, panel?, line? (hex colors), font?: 'system'|'mono'|'serif'|'display', style?: 'hud'|'clean' }. The tokens skin the shell (menu / setup / score screens) AND ride game-init to every level, so each level's HUD widgets (events.hud — see get_game_vocab({ id: 'hud-guide' })) share the look. style:'hud' turns on the stylized treatment (mono type, cold accents, corner brackets, accent glow); absent → the default clean look. Pure presentation; never gates play.",
        },
        setup: {
          type: 'object',
          description: "Optional pre-level setup presentation, per party slice: { <sliceName>: { style: 'hangar', label?, cards?: { <memberId>: { portrait?: <sketchRef>, preview?: <sketchRef>, stats?: { <label>: value }, blurb? } } } | { style: 'count', label?, blurb? } }. 'hangar' renders the full-page single-pick selector (portrait card rail + the selected member's preview World self-rotating in a side panel beside its stats) — applies when a level consumes the slice with pick.max 1. 'count' asks only HOW MANY and draws that many members at random (seeded per session). Slices without presentation keep the plain picker. Refs resolve at serve time like menu/music refs.",
        },
        links: {
          type: 'array',
          description: "Optional door links between levels (a building entered by its door): [{ from: { ref, door }, to: { ref, door } }], each a pair both ways; the doors are the levels' `door` mechanics.",
        },
        difficulty: {
          type: 'object',
          description: "Optional pre-battle difficulty pick: { label?, default?, options: [{ id: 'easy'|'medium'|'max', name, sub? }] }. ids are engine ai-tuning tiers ('max' = the untuned brain); name/sub are the game's own display voice. The shell renders the pick on the map step of piloted setups (a hangar pick present) and passes the picked id to the level as params.difficulty; spectate setups never show it.",
        },
        shell: { type: 'string', enum: ['play'], description: 'The light shell: no menu, music, setup, difficulty.' },
        run: { type: 'object', description: 'Runs (light shell): { length }: each run draws that many levels in a rolled order; a death ends it.' },
        front: { type: 'object', description: "The light shell's title and credits: { cover?: <cover ref> | { art }, layout?, tagline?, press?, menu?: [continue|play|levels|options|credits], credits?: { roll: [{ role, names }], thanks? }, end? }. get_game_vocab({ id: 'front' })." },
        ref: { type: 'string', description: 'Optional stable sketch ref for the game.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
        project_ref: { type: 'string', description: 'Legacy: a gp_ game project (retired) to bind the game to.' },
        audits: {
          type: 'object',
          description: "Completability evidence per level: { <levelRef>: { motion_ref } }. motion_ref is a forge_motion TRAVERSAL of that level (world_ref = the level) whose run reached the win condition — its final probe carries game.result:'success'. The gate verifies the stored probe. A level with no audit is refused unless allow_unaudited.",
        },
        auto_audit: { type: 'boolean', description: "AUTO-RUN each level's mechanic-derived completability audit (reach-exit → walk to the exit; survive → idle past the timer) instead of requiring a hand-authored traversal. Levels built from auto-auditable mechanics pass the gate with no motion_ref. Runs a headless traversal per such level (slower). Levels with no auto-auditable mechanic still need a motion_ref or allow_unaudited." },
        allow_unaudited: { type: 'boolean', description: "Promote levels that lack a completability audit. The contract dry-run still runs (always). Recorded per level in the result (audited:false). Default false — a game is beatable-by-construction unless you opt out." },
      },
      required: ['title', 'store', 'levels'],
    },
    handler: createGameHandler,
  });

  registerTool({
    name: 'get_game_vocab',
    description:
      'The GAME drawer, led by the game book\'s rail. No argument → the rail first (gameworld-guide: the loop and the '
      + 'principles for designing a game top down, then a card per page: world, direction, looks, motion, actions, adornment, '
      + 'equipment, systems), then the machinery rows. `id` → one card in full. `samples` (direction | actions | motion | '
      + 'gear, with `n` and `seed`) → random fragments of that page drawn without the brief, each with what the book derives '
      + 'from it: browse to learn how a choice propagates, never to copy. The machinery, read when going past the rail: store '
      + 'slices (slice-<kind>, typed-events), level mechanics (reach-exit … mechanics-guide), kits (dungeon-crawler / '
      + 'collectathon / survival-arena: what a game type compiles from), glyph forms, sfx verbs, hud cards (hud-guide …), '
      + 'idiom rules (idiom-guide). `scope` filters the rows. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        detail: DETAIL_PROPERTY,
        id: { type: 'string', description: 'Card id: gameworld-guide / gameworld-<page>, or a machinery card (slice-<kind>, a mechanic, a kit, glyph-<form>, sfx-<verb>, hud-<card>, idiom-<kind>).' },
        scope: { type: 'string', enum: ['rail', 'slice', 'mechanic', 'kit', 'glyph', 'sfx', 'hud', 'idiom'], description: 'List only one family of rows.' },
        samples: { type: 'string', enum: ['direction', 'actions', 'motion', 'gear'], description: 'Draw random fragments of this page, each with what it derives.' },
        n: { type: 'integer', minimum: 1, maximum: 12, description: 'How many samples (default 6).' },
        seed: { type: 'integer', description: 'The draw (default 1): the same seed draws the same samples.' },
      },
      required: [],
    },
    handler: getGameVocabHandler,
  });

  registerTool({
    name: 'get_play_vocab',
    description:
      'The PLAY drawer: make a world interactive (a door that opens, a lever, a HUD, a level, a game that is only its '
      + 'UI), scaled to the ask. No argument → the ladder (board, click, level, systems, game) and the card rows; `rung` '
      + '→ what that rung admits; `id` → one card (play-guide first). A world opts in with a `play` block via '
      + 'update_sketch. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'One card: play-guide, ui-board, ui-register, ui-motion, ui-layout, ui-part-<part>.' },
        rung: { type: 'integer', minimum: 0, maximum: 4, description: '0 board, 1 click, 2 level, 3 systems, 4 game.' },
      },
      required: [],
    },
    handler: getPlayVocabHandler,
  });
}
