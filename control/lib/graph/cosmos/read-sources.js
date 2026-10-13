/**
 * Reads every facet's SOURCE tables live: the values the tree defines today, in the table's own order. Used by the
 * generator (scripts/gen-cosmos-registry.mjs) and by registry.test.js, which holds the generated file equal to
 * this read. Modules are imported by their path under control/, so a branch can name a new table without a code edit
 * here. Under plain Node the caller registers the `@/` loader first (scripts/mcp-stdio-loader.mjs).
 *
 *   readSources() → { 'facet.setting': { lowers, values: [...], godot?: [...the values that survive a Godot export] } }
 *   (a source's `godot: false` says no value survives; the registry reads it, so there is no table to read here)
 */
import { FACETS } from './facets/index.js';

const CONTROL = new URL('../../../', import.meta.url);

// a table's values: an object's keys, an array's items, a string as itself
const valuesOf = (t) => (Array.isArray(t) ? t.map(String) : t && typeof t === 'object' ? Object.keys(t) : typeof t === 'string' ? [t] : null);

// tables that are assembled, not written: read by composing what assembles them
const SPACE_CAMERA_RULES = ['eye', 'overhead', 'side'];
// and the directing camera (playscape/ui/scenes.js): time.shots and time.framing, not a power
const TIME_CAMERA_RULES = ['shot'];
const READERS = {
  // the camera rules that lower space.camera (eye, overhead, side) are Space's, not Power's verbs. `follow` predates the
  // split and stays: power.rules' Godot list names it.
  engineRules: (m) => Object.keys(m.composeControllable(m.EMISSION_ENGINE).RULES).filter((k) => !SPACE_CAMERA_RULES.includes(k) && !TIME_CAMERA_RULES.includes(k)),
  aiDifficulty: (m) => Object.keys(m.composeLive().AI_DIFFICULTY || {}),
};

async function load(module) {
  return import(new URL(module, CONTROL).href);
}

async function read({ module, table, read: reader }) {
  const m = await load(module);
  const values = reader ? READERS[reader]?.(m) : valuesOf(m[table]);
  if (!values) throw new Error(`cosmos source ${module}#${reader || table} gave no values`);
  return values;
}

export async function readSources() {
  const out = {};
  for (const facet of FACETS) {
    for (const [setting, spec] of Object.entries(facet.settings)) {
      if (!spec.source) continue;
      const src = spec.source, lowers = `${src.module}#${src.read || src.table}`;
      const values = await read(src);
      const row = { lowers, values };
      if (src.godot && typeof src.godot === 'object') { const exported = new Set(await read(src.godot)); row.godot = values.filter((v) => exported.has(v)); }
      out[`${facet.id}.${setting}`] = row;
    }
  }
  return out;
}
