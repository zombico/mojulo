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
 * MVP surface: base = 'city' (fractal-city). Bases are a small map; adding one is: import
 * its mint + adapter and add a row. Themes are extensible (new packs, incl. scifi/fantasy
 * families) with no change here. See world-composer.plan.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { resolveTheme, listThemes } from '@/lib/graph/theme-registry';
import { mintFractalCity } from '@/lib/mcp/tools/scene-city';
import { cityThemeAdapter } from '@/lib/graph/city/fractal-city';

// base id → { mint(params), adapt(slots)→params }. One row per composer base.
const BASES = {
  city: { mint: mintFractalCity, adapt: cityThemeAdapter },
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
  if (!b) throw new Error(`compose_world: unknown base '${base}'. Known: ${Object.keys(BASES).join(', ')}`);
  const pack = resolveTheme(theme);                    // throws (with known ids) on miss
  const slots = deepMerge(pack.slots || {}, overrides || {});
  const params = b.adapt(slots);
  const result = b.mint({ ...params, seed, title, ref, folderRef });
  return { ...result, base, theme };
}

export async function composeWorldHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('compose_world requires an object');
  return composeWorld(input);
}

export async function listWorldThemesHandler(input) {
  const family = input && typeof input.family === 'string' ? input.family : undefined;
  return { ok: true, bases: Object.keys(BASES), themes: listThemes({ family }) };
}

export function registerComposeWorldTools() {
  registerTool({
    name: 'compose_world',
    description:
      "Compose a world from a BASE (which geometry generator) × a THEME (a flavor pack: context / assets / "
      + "materials) × optional per-call OVERRIDES. One tool, many worlds — instead of a separate create_* per "
      + "world type. It resolves the theme, lowers its abstract slots onto the base's knobs, and mints through "
      + "the same recipe→render-on-view path as create_fractal_city (tiny deterministic recipe stored; same seed "
      + "→ same world; served at `/api/sketches/<ref>/scene` and `/world`). Themes are extensible across families "
      + "(earth / scifi / fantasy) — call list_world_themes to see them. Bases available now: 'city'. "
      + "Reach for 'make a <theme> city / compose a world / a Mars-colony city / an old-world-Europe town'.",
    inputSchema: {
      type: 'object',
      properties: {
        base: { type: 'string', enum: ['city'], description: "Which geometry generator (the world's SHAPE). MVP: 'city' (fractal-city)." },
        theme: { type: 'string', description: "A theme pack id (the world's FLAVOR). See list_world_themes. Defaults to 'earth-temperate' (identity)." },
        seed: { type: 'integer', description: 'Deterministic seed — same base+theme+seed → same world.' },
        overrides: { type: 'object', description: "Optional slot overrides deep-merged over the theme pack (same abstract shape: { context?, asset?, material?, style? }). E.g. { context: { time: 'day' } } or { asset: { elements: { streetcars: true } } }." },
        title: { type: 'string', description: 'Optional title for the resulting sketch artifact.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: composeWorldHandler,
  });

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
