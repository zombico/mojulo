/**
 * Reads every facet's SOURCE tables live: the values the tree defines today, in the table's own order. Used by the
 * generator (scripts/gen-cosmos-registry.mjs) and by registry.deep.test.js, which holds the generated file equal to
 * this read. Modules are imported by their path under control/, so a branch can name a new table without a code edit
 * here. Under plain Node the caller registers the `@/` loader first (scripts/mcp-stdio-loader.mjs).
 *
 *   readSources() → { 'facet.setting': { lowers, values: [...], godot?: [...the values that survive a Godot export] } }
 */
import { FACETS } from './facets/index.js';

const CONTROL = new URL('../../../', import.meta.url);

// a table's values: an object's keys, an array's items, a string as itself
const valuesOf = (t) => (Array.isArray(t) ? t.map(String) : t && typeof t === 'object' ? Object.keys(t) : typeof t === 'string' ? [t] : null);

// tables that are assembled, not written: read by composing what assembles them
const READERS = {
  engineRules: (m) => Object.keys(m.composeControllable(m.EMISSION_ENGINE).RULES),
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
      if (src.godot) { const exported = new Set(await read(src.godot)); row.godot = values.filter((v) => exported.has(v)); }
      out[`${facet.id}.${setting}`] = row;
    }
  }
  return out;
}
