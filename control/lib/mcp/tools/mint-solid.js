/**
 * mint_solid / edit_solid / get_solid_vocab — the consolidated figure/solid
 * family entry points.
 *
 * Instead of one closed `create_*` tool per solid kind (figure, manji-tree,
 * workbench, assembler, carved-solid, solid-turntable, edifice) plus their
 * authoring doors and finishing verbs, the family collapses to:
 *   - `mint_solid(kind, spec)` — make a new solid of `kind`; `via` selects an
 *     authoring door for the manji-tree/polygomer kind (ir / parts / prompt /
 *     packet).
 *   - `edit_solid(op, ref, spec)` — a verb over an already-minted family solid
 *     (skin / emote).
 *   - `get_solid_vocab(kind)` — read one kind's parameter manual.
 *
 * Per-kind depiction prose, routing phrases, and the parameter manual live in
 * the kind's solid-vocab card (lib/graph/solid-vocab/<kind>.md), indexed under
 * source_kind='solid_vocab' — semantic_search to find, get_solid_vocab to
 * read. Errors teach: unknown kind → the kind list; a failed mint → a pointer
 * at the kind's card.
 *
 * The retired names (`create_figure`, `create_manji_tree`, `sketch_polygomer`,
 * `emote_figure`, `get_skin_packet`, `skin_polygomer`, …) remain callable as
 * UNLISTED aliases (listed:false — resolve in tools/call, absent from
 * tools/list), so compiled plans / skills that persisted them keep executing.
 * Drop after one release. Stored manifests and the render path are untouched —
 * each family file keeps its mint + handler; only its registerTool block
 * retired. See mint-solid-consolidation.plan.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { isToolRefusal } from '@/lib/errors/tool-refusal';
import {
  pluginProfileActive,
  pluginProfileNotice,
  hiddenRowInPluginProfile,
  profileEdit,
  withPluginProfile,
  PROMPT_DOOR_NOTICE,
} from '@/lib/mcp/plugin-profile';
import { profiledCard } from '@/lib/mcp/plugin-profile-cards';
import { getSolidVocabCatalog } from '@/lib/graph/solid-vocab/loader';
import { createFigureHandler, emoteFigureHandler } from '@/lib/mcp/tools/figure';
import { createAnimalHandler } from '@/lib/mcp/tools/animal';
import { createManjiTreeHandler, sketchPolygomerHandler } from '@/lib/mcp/tools/manji-trees';
import { createWorkbenchHandler, createCodeSolidHandler, createEquipmentHandler } from '@/lib/mcp/tools/workbench';
import { createScadHandler } from '@/lib/mcp/tools/scad';
import { createLayeredHandler, createLayeredPlanHandler, createLayeredHeroHandler } from '@/lib/mcp/tools/layered';
import { createAssemblerHandler } from '@/lib/mcp/tools/assembler';
import { createCarvedSolidHandler } from '@/lib/mcp/tools/carved-solid';
import { createSolidTurntableHandler } from '@/lib/mcp/tools/solid-turntable-tool';
import { createEdificeHandler } from '@/lib/mcp/tools/edifice';
import { previewVehicleInstanceHandler } from '@/lib/mcp/tools/preview-vehicle';
import {
  createPolygonizedSketchHandler,
  getPolygonizerPacketHandler,
  submitPolygonizerManifestHandler,
  getSkinPacketHandler,
  skinPolygomerHandler,
} from '@/lib/mcp/tools/sketches';

// kind → { family, handler, via? }. `handler` is the default authoring path;
// `via` maps an authoring-door mode to its handler (manji-tree/polygomer only).
// Dispatch keeps each retired tool's own param validation — mint_solid is pure
// routing. NOTE: 'vehicle' is folded in a later pass (see the plan); not here.
export const SOLID_KINDS = {
  'figure': { family: 'figure', handler: createFigureHandler },
  // The ANIMAL realm of the figure system — the human protoform's armature with the
  // spine reoriented horizontal. A bare `archetype` is the cheap overlap body; a
  // `species` is a dressed ZOO_BUILDS recipe on the welded-skin hero path.
  'animal': { family: 'creature', handler: createAnimalHandler },
  'manji-tree': {
    family: 'creature',
    handler: createManjiTreeHandler,
    via: {
      // 'ir' is the default (the full cardinal-grammar manifest); the doors are
      // alternate front-ends that lower into the same polygomer manifest.
      ir: createManjiTreeHandler,
      parts: sketchPolygomerHandler,
      prompt: createPolygonizedSketchHandler,
      // the key-free two-call handshake: no manifest in spec → hand back the
      // packet; manifest present → submit it.
      packet: (input) =>
        input && input.manifest
          ? submitPolygonizerManifestHandler(input)
          : getPolygonizerPacketHandler(input),
    },
  },
  'workbench': { family: 'object', handler: createWorkbenchHandler },
  // The code door (expressiveness.plan.md E3): a program that RETURNS a workbench spec or a
  // face list, run in a no-reach realm with seeded dice. Stores kind:'workbench' + `program`.
  'code': { family: 'object', handler: createCodeSolidHandler },
  // The equipment door: arms named by intent and direction (item, style, dials) — the laws in lib/graph/equipment
  // compose them. Stores kind:'workbench' + `build`, expanded on every read, so a dial patch restyles in place.
  'equipment': { family: 'object', handler: createEquipmentHandler },
  // The OpenSCAD front door: `spec.source` is an OpenSCAD program and IS the recipe, meshed
  // in-process by OpenSCAD (WASM) and served on the workbench studio. Stores kind:'scad'.
  'scad': { family: 'object', handler: createScadHandler },
  // A solid born layered (stations × slots, pinned details, dials): the recipe is stored and lowers to
  // the workbench studio on every read, so a dial patch reshapes it in place. Stores kind:'layered'.
  'layered': {
    family: 'object',
    handler: createLayeredHandler,
    // the plan door: a ring plan (joints, segments, details, dials, rig, clips as data) expanded into
    // the recipe at mint and stored beside it, so a `/plan` patch re-expands the solid.
    // the hero door: a human from a cast word and a TUNE (percentages of the cast's baseline), stored as `hero` beside
    // the plan, so a `/hero/tune/<control>` patch regenerates the figure by word.
    via: { recipe: createLayeredHandler, plan: createLayeredPlanHandler, hero: createLayeredHeroHandler },
  },
  'assembler': { family: 'object', handler: createAssemblerHandler },
  'carved-solid': { family: 'object', handler: createCarvedSolidHandler },
  'solid-turntable': { family: 'object', handler: createSolidTurntableHandler },
  'edifice': { family: 'structure', handler: createEdificeHandler },
  // A meta-fabricator VEHICLE family instance (a registered type + optional
  // decoration) previewed on the measured studio grid — mints kind
  // 'vehicle-instance'.
  'vehicle': { family: 'vehicle', handler: previewVehicleInstanceHandler },
};

const KIND_LIST = Object.keys(SOLID_KINDS);

// op → handler. `skin` is a two-phase handshake keyed on spec.phase; `emote`
// applies a named body-language emote to a stored figure.
export const EDIT_OPS = {
  skin: (input) =>
    input && input.phase === 'packet' ? getSkinPacketHandler(input) : skinPolygomerHandler(input),
  emote: emoteFigureHandler,
};

const OP_LIST = Object.keys(EDIT_OPS);

// Flat list of every retired tool name → its original handler and the consolidated
// tool it folded into, for the listed:false alias loop. These keep persisted
// plans/skills executing; the target also lends the alias its annotations.
const RETIRED_ALIASES = [
  ['create_figure', createFigureHandler, 'mint_solid'],
  ['emote_figure', emoteFigureHandler, 'edit_solid'],
  ['create_manji_tree', createManjiTreeHandler, 'mint_solid'],
  ['sketch_polygomer', sketchPolygomerHandler, 'mint_solid'],
  ['create_polygonized_sketch', createPolygonizedSketchHandler, 'mint_solid',
    "Deprecated alias of mint_solid via:'prompt'. Sends the prompt to an external LLM API with the user's key; `provider` is required. Key-free: via:'packet'."],
  ['get_polygonizer_packet', getPolygonizerPacketHandler, 'mint_solid'],
  ['submit_polygonizer_manifest', submitPolygonizerManifestHandler, 'mint_solid'],
  ['create_workbench', createWorkbenchHandler, 'mint_solid'],
  ['create_assembler', createAssemblerHandler, 'mint_solid'],
  ['create_carved_solid', createCarvedSolidHandler, 'mint_solid'],
  ['create_solid_turntable', createSolidTurntableHandler, 'mint_solid'],
  ['create_edifice', createEdificeHandler, 'mint_solid'],
  ['preview_vehicle_instance', previewVehicleInstanceHandler, 'mint_solid'],
  ['get_skin_packet', getSkinPacketHandler, 'edit_solid'],
  ['skin_polygomer', skinPolygomerHandler, 'edit_solid'],
];

function mergeTop(spec, { title, ref, folderRef }) {
  const merged = { ...(spec && typeof spec === 'object' ? spec : {}) };
  if (title !== undefined) merged.title = title;
  if (ref !== undefined) merged.ref = ref;
  if (folderRef !== undefined) merged.folder_ref = folderRef;
  return merged;
}

export async function mintSolidHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_solid requires an object: { kind, spec?, via?, title?, ref?, folder_ref? }');
  }
  const { kind, spec, via, title, ref, folder_ref: folderRef } = input;
  const entry = SOLID_KINDS[kind];
  if (!entry) {
    throw new Error(
      `mint_solid: unknown kind '${kind}'. Known kinds: ${KIND_LIST.join(', ')}. ` +
        `Find one by intent via semantic_search({ kinds: ['solid_vocab'] }), then read its ` +
        `parameter manual via get_solid_vocab({ id: '<kind>' }).`,
    );
  }
  // The Claude plugin profile closes the keyed LLM door; via:'packet' is the key-free one.
  if (via === 'prompt' && pluginProfileActive()) throw new Error(PROMPT_DOOR_NOTICE);
  let handler = entry.handler;
  if (via !== undefined) {
    if (!entry.via || !entry.via[via]) {
      // The Claude plugin profile names no prompt door here either (it refused via:'prompt' above).
      const modes = entry.via
        ? Object.keys(entry.via).filter((m) => m !== 'prompt' || !pluginProfileActive()).join(', ')
        : '(none)';
      throw new Error(
        `mint_solid: kind '${kind}' has no via '${via}'. Available via modes: ${modes}.`,
      );
    }
    handler = entry.via[via];
  }
  const merged = mergeTop(spec, { title, ref, folderRef });
  try {
    return await handler(merged);
  } catch (err) {
    if (isToolRefusal(err)) throw err; // REF_EXISTS already names its next move
    // Error-as-drawer: a failed mint points at the kind's parameter manual.
    throw new Error(`${err.message} — parameter manual: get_solid_vocab({ id: '${kind}' }).`);
  }
}

export async function editSolidHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('edit_solid requires an object: { op, ref, spec? }');
  }
  const { op, ref, spec } = input;
  // The skin op binds a PNG painted by an image generator: not in the Claude plugin profile.
  if (op === 'skin' && pluginProfileActive()) throw new Error(pluginProfileNotice("edit_solid op:'skin'"));
  const handler = EDIT_OPS[op];
  if (!handler) {
    const known = pluginProfileActive() ? OP_LIST.filter((o) => o !== 'skin') : OP_LIST;
    throw new Error(
      `edit_solid: unknown op '${op}'. Known ops: ${known.join(', ')}. ` +
        `Parameter manual: get_solid_vocab({ id: '<op>' }).`,
    );
  }
  const merged = mergeTop(spec, { ref });
  try {
    return await handler(merged);
  } catch (err) {
    throw new Error(`${err.message} — parameter manual: get_solid_vocab({ id: '${op}' }).`);
  }
}

// A card with sections opens at its base plus a menu; `section` reads one, or a list reads several.
function sectionedRead(id, card, section) {
  const { base, sections, ...rest } = card;
  const menu = Object.entries(sections).map(([name, s]) => ({ name, title: s.title, summary: s.summary, bytes: Buffer.byteLength(s.body, 'utf8') }));
  if (section === undefined) {
    return { ok: true, card: { ...rest, body: base, sections: menu, read: `get_solid_vocab({ id: '${id}', section: '<name>' }), or a list of names` }, _telemetrySignal: { id_requested: true, found: true } };
  }
  const names = Array.isArray(section) ? section : [section];
  if (!names.length || names.some((n) => typeof n !== 'string')) throw new Error('get_solid_vocab: `section` is a section name or a list of them.');
  const unknown = names.filter((n) => !sections[n]);
  if (unknown.length) throw new Error(`get_solid_vocab: card '${id}' has no section ${unknown.map((n) => `'${n}'`).join(', ')}. Its sections: ${Object.keys(sections).join(', ')}.`);
  return {
    ok: true,
    id,
    sections: names.map((n) => ({ name: n, title: sections[n].title, body: sections[n].body })),
    _telemetrySignal: { id_requested: true, found: true },
  };
}

export async function getSolidVocabHandler(input) {
  const { id, family, section } = input && typeof input === 'object' ? input : {};
  const catalog = getSolidVocabCatalog();
  // The Claude plugin profile does not serve the manual of an op it leaves out (skin), and serves the
  // kept cards without their lines about the skin seam, a dreamed reference or the prompt door
  // (lib/mcp/plugin-profile-cards.js).
  const served = (cid) => !hiddenRowInPluginProfile('solid_vocab', cid);
  if (id) {
    if (!served(id)) throw new Error(pluginProfileNotice(`The '${id}' card`));
    const card = catalog.get(id);
    if (!card) {
      throw new Error(
        `get_solid_vocab: unknown card '${id}'. Known: ${[...catalog.keys()].filter(served).join(', ')}. Find one by intent via semantic_search({ kinds: ['solid_vocab'], query: '<your ask>' }).`,
      );
    }
    if (card.sections) return sectionedRead(id, card, section);
    if (section !== undefined) throw new Error(`get_solid_vocab: card '${id}' has no sections; read it whole without \`section\`.`);
    return { ok: true, card: profiledCard('solid_vocab', card), _telemetrySignal: { id_requested: true, found: true } };
  }
  let cards = [...catalog.values()].filter((c) => served(c.id)).map((c) => profiledCard('solid_vocab', c));
  if (family) cards = cards.filter((c) => c.family === family);
  return {
    ok: true,
    cards: cards.map(({ id: cid, name, family: fam, entry, summary, when }) => ({
      id: cid, name, family: fam, entry, summary, when,
    })),
    _telemetrySignal: { id_requested: false, found: true },
  };
}

// The Claude plugin profile's mint_solid: no prompt door (lib/mcp/plugin-profile.js).
const PROMPT_DOOR_VIA = " | 'prompt' (NL: sends spec.prompt to an external LLM API with the user's key; spec.provider required, nothing is picked for you)";

export function registerMintSolidTools() {
  registerTool(withPluginProfile({
    name: 'mint_solid',
    description:
      'Mint a 3D SOLID — a posed human figure, an ANIMAL, a part-graph creature/object, a measured object '
      + 'study, a `code` program returning one, an assembly, a carved metal wordmark/logo, a spinning solid, a '
      + 'bespoke INSTITUTIONAL building (edifice), or a vehicle-family instance. A house / apartment / one furnished '
      + "room is NOT a solid: mint_building. "
      + 'Served as an SVG still + orbitable World + `.glb`; a tiny deterministic '
      + 'recipe, regenerated on render. Pick `kind` from the enum; per-kind params go '
      + 'in `spec`; `via` picks an authoring door (manji-tree: ir/parts/prompt/packet; layered: '
      + "plan, hero — a human by cast word + proportion tune). Find a kind by intent via semantic_search({ kinds: ['solid_vocab'] }) and read its "
      + "manual via get_solid_vocab({ id: '<kind>' }) before passing spec. Iterate the stored "
      + 'recipe in place via `update_sketch`.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KIND_LIST, description: 'Which solid. Parameter manual: get_solid_vocab({ id: kind }).' },
        spec: { type: 'object', description: `The kind's own knobs (see its solid-vocab card). Validated by the kind's mint; a failed mint returns the card pointer.` },
        via: { type: 'string', description: `Authoring door. manji-tree: 'ir' (default, full manifest) | 'parts' | 'prompt' (NL: sends spec.prompt to an external LLM API with the user's key; spec.provider required, nothing is picked for you) | 'packet' (NL, key-free two-call handshake). layered: 'plan' (a ring plan in spec.plan) | 'hero' (a human: spec { cast: 'male' | 'female', register, tune: percentages of the cast — 'athletic', { shoulders: 1.1, legs: 1.08 } }).` },
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['kind'],
    },
    handler: mintSolidHandler,
  }, {
    edits: [['(manji-tree: ir/parts/prompt/packet; layered: ', '(manji-tree: ir/parts/packet; layered: ']],
    schema: (schema) => {
      schema.properties.via.description = profileEdit(schema.properties.via.description, [[PROMPT_DOOR_VIA, '']], 'mint_solid.via');
      return schema;
    },
  }));

  registerTool(withPluginProfile({
    name: 'edit_solid',
    description:
      'Operate on an already-minted family solid. `op`: `skin` — make a manji-tree / workbench / '
      + 'assembler polygomer or a figure WEAR a painted skin (two-phase: spec.phase `packet` hands '
      + 'back the skin packet, then `apply` binds the painted result); `emote` — apply a named '
      + 'body-language emote to a stored figure and render a looping GIF. Pass the target `ref` and '
      + "op params in `spec`. Parameter manual: get_solid_vocab({ id: '<op>' }). Recipe edits "
      + '(dials/parts/spec) go through `update_sketch` instead.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: OP_LIST, description: 'Which operation. Parameter manual: get_solid_vocab({ id: op }).' },
        ref: { type: 'string', description: 'The target sketch ref to operate on.' },
        spec: { type: 'object', description: `The op's own params (see its solid-vocab card). For 'skin', spec.phase selects 'packet' vs 'apply'.` },
      },
      required: ['op'],
    },
    handler: editSolidHandler,
  }, {
    edits: [[
      "`op`: `skin` — make a manji-tree / workbench / assembler polygomer or a figure WEAR a painted skin (two-phase: spec.phase `packet` hands back the skin packet, then `apply` binds the painted result); `emote` — apply",
      "`op`: `emote` — apply",
    ]],
    schema: (schema) => {
      schema.properties.op.enum = schema.properties.op.enum.filter((op) => op !== 'skin');
      schema.properties.spec.description = profileEdit(schema.properties.spec.description, [[" For 'skin', spec.phase selects 'packet' vs 'apply'.", '']], 'edit_solid.spec');
      return schema;
    },
  }));

  registerTool({
    name: 'get_solid_vocab',
    description:
      'Read a solid-vocab card — the depiction prose + routing phrases + parameter manual '
      + 'for one `mint_solid` kind or `edit_solid` op. Pass `id` for one card; omit for the index '
      + 'rows { id, name, family, entry, summary, when } (optional `family` filter: figure / '
      + "creature / object / structure / vehicle / edit). Discover cards by intent via "
      + "semantic_search({ kinds: ['solid_vocab'] }). A long card opens to a `sections` menu. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Card id (= the mint_solid kind or edit_solid op).' },
        family: { type: 'string', enum: ['figure', 'creature', 'object', 'structure', 'vehicle', 'edit'], description: 'Optional list filter.' },
        section: { description: 'With `id`: a section name, or a list.' },
      },
      required: [],
    },
    handler: getSolidVocabHandler,
  });

  // Deprecated per-type creators/verbs — resolve in tools/call, hidden from
  // tools/list. Each forwards to its original handler unchanged.
  for (const [name, handler, aliasOf, note] of RETIRED_ALIASES) {
    registerTool({
      name,
      listed: false,
      aliasOf,
      description: note || `Deprecated alias — folded into mint_solid / edit_solid. See get_solid_vocab.`,
      inputSchema: { type: 'object', properties: {}, required: [] },
      handler,
    });
  }
}
