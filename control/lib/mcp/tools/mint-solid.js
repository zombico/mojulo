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
import { getSolidVocabCatalog } from '@/lib/graph/solid-vocab/loader';
import { createFigureHandler, emoteFigureHandler } from '@/lib/mcp/tools/figure';
import { createManjiTreeHandler, sketchPolygomerHandler } from '@/lib/mcp/tools/manji-trees';
import { createWorkbenchHandler } from '@/lib/mcp/tools/workbench';
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

// Flat list of every retired tool name → its original handler, for the
// listed:false alias loop. These keep persisted plans/skills executing.
const RETIRED_ALIASES = [
  ['create_figure', createFigureHandler],
  ['emote_figure', emoteFigureHandler],
  ['create_manji_tree', createManjiTreeHandler],
  ['sketch_polygomer', sketchPolygomerHandler],
  ['create_polygonized_sketch', createPolygonizedSketchHandler],
  ['get_polygonizer_packet', getPolygonizerPacketHandler],
  ['submit_polygonizer_manifest', submitPolygonizerManifestHandler],
  ['create_workbench', createWorkbenchHandler],
  ['create_assembler', createAssemblerHandler],
  ['create_carved_solid', createCarvedSolidHandler],
  ['create_solid_turntable', createSolidTurntableHandler],
  ['create_edifice', createEdificeHandler],
  ['preview_vehicle_instance', previewVehicleInstanceHandler],
  ['get_skin_packet', getSkinPacketHandler],
  ['skin_polygomer', skinPolygomerHandler],
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
  let handler = entry.handler;
  if (via !== undefined) {
    if (!entry.via || !entry.via[via]) {
      const modes = entry.via ? Object.keys(entry.via).join(', ') : '(none)';
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
    // Error-as-drawer: a failed mint points at the kind's parameter manual.
    throw new Error(`${err.message} — parameter manual: get_solid_vocab({ id: '${kind}' }).`);
  }
}

export async function editSolidHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('edit_solid requires an object: { op, ref, spec? }');
  }
  const { op, ref, spec } = input;
  const handler = EDIT_OPS[op];
  if (!handler) {
    throw new Error(
      `edit_solid: unknown op '${op}'. Known ops: ${OP_LIST.join(', ')}. ` +
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

export async function getSolidVocabHandler(input) {
  const { id, family } = input && typeof input === 'object' ? input : {};
  const catalog = getSolidVocabCatalog();
  if (id) {
    const card = catalog.get(id);
    if (!card) {
      throw new Error(
        `get_solid_vocab: unknown card '${id}'. Known: ${[...catalog.keys()].join(', ')}`,
      );
    }
    return { ok: true, card, _telemetrySignal: { id_requested: true, found: true } };
  }
  let cards = [...catalog.values()];
  if (family) cards = cards.filter((c) => c.family === family);
  return {
    ok: true,
    cards: cards.map(({ id: cid, name, family: fam, entry, summary, when }) => ({
      id: cid, name, family: fam, entry, summary, when,
    })),
    _telemetrySignal: { id_requested: false, found: true },
  };
}

export function registerMintSolidTools() {
  registerTool({
    name: 'mint_solid',
    description:
      'Mint a 3D SOLID — a posed human figure, a part-graph creature/object, a measured object '
      + 'study, a composed assembly, a carved metal wordmark/logo, a spinning single solid, a '
      + 'bespoke building, or a vehicle-family instance. Served as an SVG still + orbitable World + `.glb`; a tiny deterministic '
      + 'recipe is stored, regenerated on render. Pick `kind` from the enum; per-kind parameters go '
      + 'in `spec`; `via` picks an authoring door for the manji-tree kind (ir / parts / prompt / '
      + "packet). Find a kind by intent via semantic_search({ kinds: ['solid_vocab'] }) and read its "
      + "parameter manual via get_solid_vocab({ id: '<kind>' }) before passing spec.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KIND_LIST, description: 'Which solid. Parameter manual: get_solid_vocab({ id: kind }).' },
        spec: { type: 'object', description: `The kind's own knobs (see its solid-vocab card). Validated by the kind's mint; a failed mint returns the card pointer.` },
        via: { type: 'string', description: `Authoring door for kind 'manji-tree' only: 'ir' (default, full manifest) | 'parts' (parts-list) | 'prompt' (NL, keyed) | 'packet' (NL, key-free two-call handshake).` },
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['kind'],
    },
    handler: mintSolidHandler,
  });

  registerTool({
    name: 'edit_solid',
    description:
      'Operate on an already-minted family solid. `op`: `skin` — make a manji-tree / workbench / '
      + 'assembler polygomer or a figure WEAR a painted skin (two-phase: spec.phase `packet` hands '
      + 'back the skin packet, then `apply` binds the painted result); `emote` — apply a named '
      + 'body-language emote to a stored figure and render a looping GIF. Pass the target `ref` and '
      + "op params in `spec`. Parameter manual: get_solid_vocab({ id: '<op>' }).",
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
  });

  registerTool({
    name: 'get_solid_vocab',
    description:
      'Read a solid-vocab card in full — the depiction prose + routing phrases + parameter manual '
      + 'for one `mint_solid` kind or `edit_solid` op. Pass `id` for one card; omit for the index '
      + 'rows { id, name, family, entry, summary, when } (optional `family` filter: figure / '
      + "creature / object / structure / vehicle / edit). Discover cards by intent via "
      + "semantic_search({ kinds: ['solid_vocab'] }); this reader returns the full body. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Card id (= the mint_solid kind or edit_solid op).' },
        family: { type: 'string', enum: ['figure', 'creature', 'object', 'structure', 'vehicle', 'edit'], description: 'Optional list filter.' },
      },
      required: [],
    },
    handler: getSolidVocabHandler,
  });

  // Deprecated per-type creators/verbs — resolve in tools/call, hidden from
  // tools/list. Each forwards to its original handler unchanged.
  for (const [name, handler] of RETIRED_ALIASES) {
    registerTool({
      name,
      listed: false,
      description: `Deprecated alias — folded into mint_solid / edit_solid. See get_solid_vocab.`,
      inputSchema: { type: 'object', properties: {}, required: [] },
      handler,
    });
  }
}
