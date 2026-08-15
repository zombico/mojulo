/**
 * compose_world / list_world_themes — the generic world-composer entry point.
 *
 * Instead of one closed `create_*` tool per world type, `compose_world` composes a world
 * from orthogonal axes: a `base` (which geometry generator) × a `theme` (a flavor pack from
 * theme-registry) × per-call `overrides` (slot escape hatch). It resolves the theme, deep-
 * merges overrides, runs the base's adapter to lower the abstract slots onto that base's
 * knobs, and mints through the SAME recipe→render-on-view path as the direct tools — so the
 * stored artifact is a tiny deterministic recipe exactly like create_fractal_city.
 *
 * Bases are a small map; adding one is: import its mint + adapter and add a row, plus a
 * view-vocab card (family 'world') carrying its parameter manual. Seven ship: city (the one
 * with real theme lowering), transport-hub, controllable, action, operator, planetary,
 * painted-landscape (identity adapters — overrides are their param surface). Themes are
 * extensible (new packs, incl. scifi/fantasy families) with no change here. The retired
 * per-type create_* names remain callable as unlisted aliases. See world-composer.plan.md
 * and tool-list-drawerization.plan.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { resolveTheme, listThemes } from '@/lib/graph/theme-registry';
import { resolveWorldAudio } from '@/lib/graph/beats/beats-world';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintFractalCity, createFractalCityHandler } from '@/lib/mcp/tools/scene-city';
import { cityThemeAdapter } from '@/lib/graph/city/fractal-city';
import { mintTransportationHub, createTransportationHubHandler } from '@/lib/mcp/tools/scene-transport-hub';
import { mintControllableWorld, createControllableWorldHandler } from '@/lib/mcp/tools/scene-controllable';
import { mintActionWorld, createActionWorldHandler } from '@/lib/mcp/tools/scene-action-world';
import { mintOperatorWorld, createOperatorWorldHandler } from '@/lib/mcp/tools/scene-operator-world';
import { mintPlanetary, createPlanetaryHandler } from '@/lib/mcp/tools/scene-planetary';
import { mintPaintedLandscape, createPaintedLandscapeHandler } from '@/lib/mcp/tools/painted-landscape';
import { mintMathStructure } from '@/lib/mcp/tools/scene-math-structure';
import { mintSchoolComplex } from '@/lib/mcp/tools/scene-school';
import { mintDungeon } from '@/lib/mcp/tools/scene-dungeon';

// Identity adapter: theme slots pass straight through as mint params. Each
// mint destructures only its own knobs, so a theme pack's abstract slots
// ({ context, asset, material, style }) drop harmlessly — the theme has no
// effect on these bases until a real adapter lowers its slots onto the
// base's knobs (roadmap; `city` is the worked example). The `overrides`
// channel IS the per-base param surface for identity bases: the base's
// parameter manual is its view-vocab card (family 'world').
const identityAdapter = (slots) => slots;

// base id → { mint(params), adapt(slots)→params }. One row per composer base.
const BASES = {
  city: { mint: mintFractalCity, adapt: cityThemeAdapter },
  'transport-hub': { mint: mintTransportationHub, adapt: identityAdapter },
  controllable: { mint: mintControllableWorld, adapt: identityAdapter },
  action: { mint: mintActionWorld, adapt: identityAdapter },
  operator: { mint: mintOperatorWorld, adapt: identityAdapter },
  planetary: { mint: mintPlanetary, adapt: identityAdapter },
  'painted-landscape': { mint: mintPaintedLandscape, adapt: identityAdapter },
  math: { mint: mintMathStructure, adapt: identityAdapter },
  school: { mint: mintSchoolComplex, adapt: identityAdapter },
  dungeon: { mint: mintDungeon, adapt: identityAdapter },
};

// Retired per-type creators → { base, handler }. Each old name still resolves
// in tools/call (listed:false) via its ORIGINAL handler — same input contract,
// zero behavior change — but no longer costs tools/list context. Compiled
// plans / skills that persisted these names keep executing. Drop after one
// release; see tool-list-drawerization.plan.md.
const RETIRED_WORLD_TOOLS = {
  create_fractal_city: { base: 'city', handler: createFractalCityHandler },
  create_transportation_hub: { base: 'transport-hub', handler: createTransportationHubHandler },
  create_controllable_world: { base: 'controllable', handler: createControllableWorldHandler },
  create_action_world: { base: 'action', handler: createActionWorldHandler },
  create_operator_world: { base: 'operator', handler: createOperatorWorldHandler },
  create_planetary: { base: 'planetary', handler: createPlanetaryHandler },
  create_painted_landscape: { base: 'painted-landscape', handler: createPaintedLandscapeHandler },
};

// Deep-merge plain objects (overrides win); arrays and scalars REPLACE. Used to layer
// per-call overrides on top of a theme pack's slots.
function deepMerge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(out[k], v) : v;
  }
  return out;
}

export function composeWorld({ base = 'city', theme = 'earth-temperate', seed, overrides, title, ref, folder_ref: folderRef } = {}) {
  const b = BASES[base];
  if (!b) {
    throw new Error(
      `compose_world: unknown base '${base}'. Known: ${Object.keys(BASES).join(', ')}. ` +
        `Each base's parameter manual is its view-vocab card (family 'world') — read it via get_view_vocab({ id: '<base>' }).`,
    );
  }
  const pack = resolveTheme(theme);                    // throws (with known ids) on miss
  const slots = deepMerge(pack.slots || {}, overrides || {});
  // The `audio` channel is KIND-GENERIC — the world route resolves manifest.audio for
  // every registry kind (world-scene.js) — but only the city/transport-hub mints
  // whitelist it, so a documented overrides.audio silently vanished on every other
  // base (0813 persona sims). Validate it eagerly for ALL bases — a bad beats ref or
  // recipe must refuse the mint here, not 500 the stored world link — then stamp it
  // onto the minted manifest below when the base's own whitelist didn't carry it.
  let audio;
  if (slots.audio !== undefined) {
    if (!slots.audio || typeof slots.audio !== 'object' || Array.isArray(slots.audio)) {
      throw new Error(
        `compose_world: overrides.audio must be an object ({ soundtrack?, sfx?, footsteps?, wind?, bindings? }); `
          + `got ${JSON.stringify(slots.audio)}. Vocabulary: get_beats_vocab({ id: 'audio-beats' }).`,
      );
    }
    resolveWorldAudio(slots.audio); // throws per-channel (unknown beats ref, invalid recipe, dangling cue)
    audio = slots.audio;
  }
  const params = b.adapt(slots);
  // Only spread top-level fields the caller actually set, so an
  // overrides-supplied seed/title isn't clobbered by `undefined`.
  const top = {};
  if (seed !== undefined) top.seed = seed;
  if (title !== undefined) top.title = title;
  if (ref !== undefined) top.ref = ref;
  if (folderRef !== undefined) top.folderRef = folderRef;
  const result = b.mint({ ...params, ...top });
  if (audio && result && result.ref && !(result.recipe && result.recipe.audio)) {
    const stored = SketchRepository.getByRef(result.ref);
    if (stored) {
      SketchRepository.update({ ref: result.ref, manifest: { ...stored.manifest, audio } });
      if (result.recipe && typeof result.recipe === 'object') result.recipe.audio = audio;
    }
  }
  // Silent-swallow guard (0813 first-contact reports): every mint destructures a
  // parameter whitelist, so an override key the base doesn't know — or a value that
  // fails its validation — used to vanish without a trace. Surface a soft note for
  // any override key that didn't land in the stored recipe, minus keys compose_world
  // consumes structurally. Advisory only: some bases legitimately lower a key into
  // another shape (mode → kind, gates → mezzanine), so this is a nudge toward the
  // parameter manual, never a refusal.
  const STRUCTURAL_KEYS = new Set(['mode', 'building', 'layout', 'theme', 'title', 'ref', 'folder_ref', 'gates', 'line_b', 'explode', 'audio']);
  const ignored = Object.keys(overrides || {}).filter(
    (k) => !STRUCTURAL_KEYS.has(k) && !(result.recipe && typeof result.recipe === 'object' && k in result.recipe),
  );
  return {
    ...result, base, theme,
    ...(ignored.length ? {
      note: `override key(s) not reflected in the stored recipe: ${ignored.join(', ')} — either consumed `
        + `structurally, invalid for this base, or not supported by it. Parameter manual: `
        + `get_view_vocab({ id: '${base}' }).`,
    } : {}),
  };
}

export async function composeWorldHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('compose_world requires an object');
  const result = composeWorld(input);
  // R1 validator half (0813 persona sims): the recipe layer was permissive where the
  // renderer is not — an undocumented fog:{color:'#hex'} stored with ok:true and the
  // world link opened HTTP 500 (color.map is not a function). `ok:true` must mean the
  // link opens: resolve the STORED sketch through the world registry — the same path
  // /world runs, fog/audio/game channels included — before answering, and unmint on
  // failure so no 500-rendering recipe survives a mint. The full override-contract
  // reconciliation (flat vs slotted, overrides-beat-theme) is staked separately.
  if (result && result.ref) {
    const stored = SketchRepository.getByRef(result.ref);
    if (stored) {
      try {
        await resolveWorldScene(stored);
      } catch (err) {
        SketchRepository.deleteByRef(result.ref);
        throw new Error(
          `compose_world: the minted recipe failed render validation and was NOT kept — ${err.message}. `
            + `Parameter manual: get_view_vocab({ id: '${typeof input.base === 'string' ? input.base : 'city'}' }).`,
        );
      }
    }
  }
  return result;
}

export async function listWorldThemesHandler(input) {
  const family = input && typeof input.family === 'string' ? input.family : undefined;
  return { ok: true, bases: Object.keys(BASES), themes: listThemes({ family }) };
}

export function registerComposeWorldTools() {
  registerTool({
    name: 'compose_world',
    description:
      "THE world entry point: compose a world from a BASE (which geometry generator) × a THEME (a flavor pack) "
      + "× per-call OVERRIDES (the base's own knobs). One tool, many worlds. Bases: 'city' (generated 3D cityscape / "
      + "skyline), 'transport-hub' (airport / train station / bus terminal / subway), 'controllable' (a LIVE world the "
      + "user DRIVES — walk a figure, fly a drone, a platformer), 'action' (a live world with RULES — a game with "
      + "score/timer/spawns/pickups), 'operator' (mojulo's own connected-services state as a walkable world), "
      + "'planetary' (a space-accurate body in a celestial sphere), 'painted-landscape' (painterly glyph-composed "
      + "terrain SVG), 'math' (a finite group as a walkable Cayley city — plazas are elements, generators are "
      + "street types, walking a relation returns you home), 'school' (a generated K-12 CAMPUS — classroom wings, "
      + "gyms, library/cafeteria, brick/glass facades, athletic fields + parking + vehicles, walkable interiors), "
      + "'dungeon' (torch-lit fantasy cave INTERIOR — organic chambers + sloping tunnels, walkable). "
      + "Each base's parameter manual + routing phrases live in its view-vocab card — "
      + "semantic_search({kinds:['view_vocab']}) to find, get_view_vocab({id:'<base>'}) to read before passing "
      + "overrides. Themes via list_world_themes (theme lowering ships for 'city'; other bases take theme's place "
      + "via overrides for now). Tiny deterministic recipe stored, regenerated on render; served at "
      + "`/api/sketches/<ref>/scene` and/or `/world` per base. Reach for 'make a city / an airport / a walkable "
      + "world / a game where… / a painted landscape / a Mars-colony city'.",
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
          enum: ['city', 'transport-hub', 'controllable', 'action', 'operator', 'planetary', 'painted-landscape', 'math', 'school', 'dungeon'],
          description: "Which geometry generator (the world's SHAPE). Read the base's view-vocab card for its overrides manual.",
        },
        theme: { type: 'string', description: "A theme pack id (the world's FLAVOR). See list_world_themes. Defaults to 'earth-temperate' (identity)." },
        seed: { type: 'integer', description: 'Deterministic seed — same base+theme+seed → same world.' },
        overrides: { type: 'object', description: "The base's own knobs, deep-merged over the theme pack's slots (for 'city': { context?, asset?, material?, style? }; for identity bases: the base's mint params per its view-vocab card, e.g. { mode: 'airport' } for transport-hub, { entities, idioms } for action)." },
        title: { type: 'string', description: 'Optional title for the resulting sketch artifact.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: composeWorldHandler,
  });

  // Deprecated per-type world creators — resolve in tools/call, hidden from
  // tools/list. Same handlers, same input contracts.
  for (const [name, { base, handler }] of Object.entries(RETIRED_WORLD_TOOLS)) {
    registerTool({
      name,
      listed: false,
      description: `Deprecated alias — use compose_world with base '${base}' (parameter manual: get_view_vocab({ id: '${base}' })).`,
      inputSchema: { type: 'object', properties: {}, required: [] },
      handler,
    });
  }

  registerTool({
    name: 'list_world_themes',
    description:
      "List the theme packs available to compose_world (and the composer bases). Optionally filter by family "
      + "('earth' | 'scifi' | 'fantasy' | …). Each theme is { id, family, label, description }. Call this before "
      + "compose_world to pick a theme.",
    inputSchema: {
      type: 'object',
      properties: {
        family: { type: 'string', description: "Optional family filter, e.g. 'earth', 'scifi', 'fantasy'." },
      },
      required: [],
    },
    handler: listWorldThemesHandler,
  });
}
