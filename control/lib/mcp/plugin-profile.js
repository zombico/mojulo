/**
 * The Claude plugin profile: what mojulo leaves out when the Claude plugin starts it.
 *
 * The plugin (plugins/mojulo/.claude-plugin/plugin.json) sets MOJULO_DISTRIBUTION=claude-plugin,
 * which lib/version/distribution.js reports as distribution() === 'claude-plugin'. Under that
 * distribution, and only there, mojulo drops what conflicts with Anthropic's Software Directory
 * Policy (the version dated 2026-04-15; items 2.B, 2.D, 3.F and 4.B):
 *
 *   - capabilities whose output depends on an AI model, or on steering Claude to another
 *     generator: the image-render and mesh handoffs, the voice registers (rendered by the Kokoro
 *     TTS model), the sprite sheets painted through the image handoff and the Style Lock presets
 *     only an image worker reads, the `skin` op of edit_solid (a PNG painted by an image
 *     generator), the painted create_sketch kinds, create_cover's painted layers, the scene /
 *     cel families of forge_motion (both composite accepted image renders), and the
 *     character-from-dream loop (the figure-spec tools and a figure's dream_audit), plus the
 *     catalysts, routing cards and vocab cards that exist to drive those loops;
 *   - the keyed LLM door, mint_solid via:'prompt' (the user's text to a third-party provider);
 *   - automatic third-party downloads (Chrome for Testing, ffmpeg, the recall model): the
 *     resolvers in lib/graph/scene/chromium.js, lib/motion/ffmpeg.js and lib/embedder/local.js
 *     read pluginProfileActive() themselves;
 *   - the CDN form of an exported World or game page (sketch-model-export.js, export-game.js).
 *
 * "Left out" means: absent from tools/list in flat and packs mode, not named by any orientation
 * surface (initialize, forward_context, get_tool_index, get_substrate, get_ui_map, the rules card,
 * routing cards, vocab cards, catalysts, pack manuals), and refused in-band when called by name,
 * through a pack, from a plan or from the CLI. The refusal is neutral: it says the capability is
 * not part of this build and points at nothing else.
 *
 * Every other distribution ('npm', 'source') is untouched: each check here is false there, and the
 * edited texts (profileEdit, withPluginProfile, in the modules that own each text) are served only
 * when the profile is active, so their surfaces stay byte-identical. plugin-profile.test.js pins
 * both halves.
 */

import { distribution, CLAUDE_PLUGIN } from '../version/distribution.js';

/** True when the Claude plugin started this process. Read per call, so tests can toggle it. */
export function pluginProfileActive(env = process.env) {
  return distribution(env) === CLAUDE_PLUGIN;
}

// Tools the profile removes. Grouped by why; the pack homes are in lib/mcp/packs.js.
const IMAGE_RENDER_TOOLS = [
  'get_image_render_packet',
  'request_image_render',
  'pull_image_render',
  'submit_image_render',
  'accept_image_render',
  'reject_image_render',
  'bind_image_render',
  'bind_character_sheet',
];
const MESH_RENDER_TOOLS = [
  'request_mesh_render',
  'pull_mesh_render',
  'submit_mesh_render',
  'accept_mesh_render',
  'reject_mesh_render',
  'bind_mesh_render',
];
// A voice register is a blend over Kokoro voice embeddings; the Kokoro TTS model speaks it
// (lib/mcp/tools/voice.js). Beats stays: its sung parts are the parametric formant synth.
const VOICE_TOOLS = ['create_voice', 'get_voice', 'bind_voice_sample', 'get_voice_vocab'];
// A sprite sheet's frames are painted through the image-render handoff before they are baked.
const SPRITE_SHEET_TOOLS = ['create_sprite_sheet', 'bake_sprite_sheet'];
// The Style Lock presets a renderBrief carries to the image worker; nothing else reads them.
const STYLE_TOOLS = ['get_style_vocab'];
// Retired aliases of the doors the profile closes: the skin op of edit_solid, and the prompt door
// of mint_solid (lib/mcp/tools/mint-solid.js RETIRED_ALIASES).
const CLOSED_DOOR_ALIASES = ['get_skin_packet', 'skin_polygomer', 'create_polygonized_sketch'];
// The character-from-dream spec loop (lib/mcp/tools/figure-specs.js): a figure reconstructed from an
// image generator's dreamed reference, drafted with its dream_audit, approved and built. Unlisted
// everywhere; hidden here so a call by name is refused like the rest of that loop.
const DREAM_FIGURE_SPEC_TOOLS = ['draft_figure_spec', 'get_figure_spec', 'resolve_figure_spec', 'build_figure_spec'];

export const PLUGIN_PROFILE_HIDDEN_TOOLS = Object.freeze([
  ...IMAGE_RENDER_TOOLS,
  ...MESH_RENDER_TOOLS,
  ...VOICE_TOOLS,
  ...SPRITE_SHEET_TOOLS,
  ...STYLE_TOOLS,
  ...CLOSED_DOOR_ALIASES,
  ...DREAM_FIGURE_SPEC_TOOLS,
]);

/** Pack dispatchers whose every member is hidden: the pack itself leaves the surface. */
export const PLUGIN_PROFILE_HIDDEN_PACKS = Object.freeze(['pack_image_render', 'pack_voice']);

/** get_creative_toolset forms (lib/mcp/creative-forms.js) whose tools are all hidden. */
export const PLUGIN_PROFILE_HIDDEN_FORMS = Object.freeze(['image-render', 'voice']);

/** create_sketch manifest kinds painted through the image-render handoff (image-outcomes/manifest.js). */
export const PLUGIN_PROFILE_HIDDEN_SKETCH_KINDS = Object.freeze([
  'image-outcome',
  'sequential-art',
  'character-sheet',
  'keyframe-animation',
  'scene-motion',
  'sprite-sheet',
]);

/**
 * Cards and recipes the profile does not serve, by semantic_search source kind: each one exists to
 * drive an image, mesh or voice generator (or is the manual for a hidden kind or op).
 */
export const PLUGIN_PROFILE_HIDDEN_ROWS = Object.freeze({
  catalyst: Object.freeze([
    'character-from-dream',
    'creature-from-plan',
    'dream-edifice',
    'mobile-suit-builder',
    'reconstruct-from-dream',
    'render-image-outcome-locally',
  ]),
  routing: Object.freeze(['image-render', 'voice', 'animate-character', 'pixel-art']),
  sketch_vocab: Object.freeze(['image-outcome', 'sequential-art', 'keyframe-animation', 'scene-motion', 'motion-comic-tricks']),
  solid_vocab: Object.freeze(['skin']),
});

const HIDDEN_NAMES = new Set([...PLUGIN_PROFILE_HIDDEN_TOOLS, ...PLUGIN_PROFILE_HIDDEN_PACKS]);

/** True under the profile for a hidden tool or pack dispatcher name. */
export function hiddenInPluginProfile(name, env = process.env) {
  return HIDDEN_NAMES.has(name) && pluginProfileActive(env);
}

/** True under the profile for a card or recipe it does not serve. */
export function hiddenRowInPluginProfile(sourceKind, ref, env = process.env) {
  const hidden = PLUGIN_PROFILE_HIDDEN_ROWS[sourceKind];
  return Boolean(hidden && hidden.includes(ref)) && pluginProfileActive(env);
}

/** The in-band answer for anything the profile leaves out. Neutral on purpose: no other install is named. */
export function pluginProfileNotice(what) {
  return `${what} is not part of the Claude plugin build of mojulo.`;
}

/** The notice for a hidden tool or pack under the profile, else null. */
export function pluginProfileToolNotice(name, env = process.env) {
  return hiddenInPluginProfile(name, env) ? pluginProfileNotice(`'${name}'`) : null;
}

/** The answer to mint_solid via:'prompt' under the profile: the key-free door instead. */
export const PROMPT_DOOR_NOTICE =
  "mint_solid via:'prompt' is not part of the Claude plugin build of mojulo: it would send the text to a "
  + "third-party LLM provider. Use via:'packet' instead: call mint_solid({ kind: 'manji-tree', via: 'packet', "
  + "spec: { prompt } }) for the packet, write the manifest it asks for yourself, then call it again with "
  + "spec.manifest. Nothing leaves this machine.";

// A backticked mention of a hidden tool or pack: the shape every orientation body uses to name one.
const BACKTICKED_HIDDEN = new RegExp(`\`(?:${[...HIDDEN_NAMES].join('|')})\``);
const ANY_HIDDEN = new RegExp(`\\b(?:${[...HIDDEN_NAMES].join('|')})\\b`);

/** True when `text` names a hidden tool or pack (any mention, word-bounded). */
export function mentionsHiddenTool(text) {
  return ANY_HIDDEN.test(String(text ?? ''));
}

/**
 * Drop the lines of a bullet-list body that name a hidden tool in backticks (a TOOL_INDEX row, a
 * FORM_TOOLSETS bullet, a pack index line). Only for line-per-entry bodies: a paragraph that names
 * one goes through profileEdit instead.
 */
export function dropHiddenToolLines(text) {
  return String(text)
    .split('\n')
    .filter((line) => !BACKTICKED_HIDDEN.test(line))
    .join('\n');
}

// Text edits whose `from` was not found: a surface drifted from its profile edit. Recorded, never
// thrown (the unedited text is served), and asserted empty by plugin-profile.test.js.
const misses = new Set();

/**
 * Apply ordered [from, to] replacements to `text`. A string `from` replaces its first occurrence; a
 * RegExp replaces per its flags. A `from` that does not match is recorded under `where`.
 */
export function profileEdit(text, edits, where = 'text') {
  let out = String(text);
  for (const [from, to] of edits) {
    let hit;
    if (from instanceof RegExp) {
      from.lastIndex = 0;
      hit = from.test(out);
      from.lastIndex = 0;
    } else {
      hit = out.includes(from);
    }
    if (!hit) {
      misses.add(`${where}: ${String(from).slice(0, 100)}`);
      continue;
    }
    out = out.replace(from, to);
  }
  return out;
}

/** The profile edits that found nothing to replace (tests). */
export function profileEditMisses() {
  return [...misses];
}

/**
 * A registered tool's face: the description and inputSchema tools/list, pack manuals, the rules
 * card and `mojulo help` show. Under the profile a tool may carry a `pluginProfile` variant
 * ({ description?, inputSchema? }) that leaves out a closed door; everywhere else the tool's own.
 */
export function toolFace(tool, env = process.env) {
  const variant = tool?.pluginProfile && pluginProfileActive(env) ? tool.pluginProfile : null;
  return {
    description: variant?.description ?? tool?.description,
    inputSchema: variant?.inputSchema ?? tool?.inputSchema,
  };
}

/**
 * A tool registration carrying its plugin-profile face: `edits` applied to its description, and
 * `schema(copy)` returning the profile's inputSchema from a deep copy of the tool's own (edit the
 * copy freely). Built once at registration; shown only under the profile (toolFace).
 */
export function withPluginProfile(tool, { edits = [], schema } = {}) {
  return {
    ...tool,
    pluginProfile: {
      ...(edits.length ? { description: profileEdit(tool.description, edits, tool.name) } : {}),
      ...(schema ? { inputSchema: schema(structuredClone(tool.inputSchema)) } : {}),
    },
  };
}

/**
 * Apply ordered [from, to] edits to every `description` string inside a JSON Schema (pass a copy you
 * own; withPluginProfile hands its `schema` callback one). An edit that hits no description is
 * recorded under `where`, like profileEdit.
 */
export function editSchemaDescriptions(schema, edits, where = 'schema') {
  const hits = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.description === 'string') {
      edits.forEach(([from, to], i) => {
        let hit;
        if (from instanceof RegExp) {
          from.lastIndex = 0;
          hit = from.test(node.description);
          from.lastIndex = 0;
        } else {
          hit = node.description.includes(from);
        }
        if (hit) {
          node.description = node.description.replace(from, to);
          hits.add(i);
        }
      });
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(schema);
  edits.forEach(([from], i) => {
    if (!hits.has(i)) misses.add(`${where}: ${String(from).slice(0, 100)}`);
  });
  return schema;
}
