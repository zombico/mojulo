/**
 * Reads every facet's SOURCE tables live: the values the tree defines today, in the table's own order. Used by the
 * generator (scripts/gen-cosmos-registry.mjs) and by registry.test.js, which holds the generated file equal to
 * this read. Modules are imported by their path under control/, so a branch can name a new table without a code edit
 * here. Under plain Node the caller registers the `@/` loader first (scripts/mcp-stdio-loader.mjs).
 *
 *   readSources() → { 'facet.setting': { lowers, values: [...], godot?: { [value]: 'built' | 'approximated' | 'absent' } } }
 *   A source's `godot` names where its Godot marks come from (scene/godot-marks.js, the one portability source): a
 *   table of the values that travel whole (the rest absent), or a reader that marks each value. A source's
 *   `godot: { all, how }` marks every value alike; the registry reads it, so there is nothing to read here.
 */
import { FACETS } from './facets/index.js';

const CONTROL = new URL('../../../', import.meta.url);

// a table's values: an object's keys, an array's items, a string as itself
const valuesOf = (t) => (Array.isArray(t) ? t.map(String) : t && typeof t === 'object' ? Object.keys(t) : typeof t === 'string' ? [t] : null);

// tables that are assembled, not written: read by composing what assembles them
const SPACE_CAMERA_RULES = ['eye', 'overhead', 'side'];
// and the directing camera (playscape/ui/scenes.js): time.shots and time.framing, not a power
const TIME_CAMERA_RULES = ['shot'];
// a reader's output: a list (the values built; the rest absent) or { value: mark | { godot } }
const markOf = (r) => (typeof r === 'string' ? r : r && r.godot);
const READERS = {
  // the Godot marks (scene/godot-marks.js and engine-portability.js read the same tables the export reads)
  mechanicMarks: (m) => m.MECHANIC_MARKS,
  ruleMarks: (m) => m.RULE_MARKS,
  kitMarks: async (m) => { const { KITS } = await load('lib/graph/game/kits.js'); return Object.fromEntries(Object.keys(KITS).map((k) => [k, m.kitMark(k)])); },
  systemMarks: (m) => m.SYSTEM_MARKS,
  idiomMarks: async (m) => { const { IDIOMS } = await load('lib/graph/gameworld/actions.js'); return Object.fromEntries(Object.entries(IDIOMS).map(([k, i]) => [k, m.SYSTEM_MARKS[i.system.kind]])); },
  traversalMarks: async (m) => { const { ENTRIES } = await load('lib/graph/playscape/objects/index.js'); return Object.fromEntries(Object.keys(ENTRIES).map((k) => [k, m.traversalMark(k)])); },
  gaitMarks: async (m) => { const { MOTION_GAITS } = await load('lib/graph/polygonizer/hero-motion.js'); return Object.fromEntries(Object.entries(MOTION_GAITS).map(([k, g]) => [k, m.gaitMark(k, g)])); },
  linkMarks: (m) => m.LINK_MARKS,
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
  const values = reader ? await READERS[reader]?.(m) : valuesOf(m[table]);
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
      if (src.godot && typeof src.godot === 'object' && src.godot.module) {
        const got = await read(src.godot);
        if (Array.isArray(got)) { const built = new Set(got); row.godot = Object.fromEntries(values.map((v) => [v, built.has(v) ? 'built' : 'absent'])); }
        else row.godot = Object.fromEntries(values.map((v) => [v, markOf(got[v]) || 'unmarked']));
      }
      out[`${facet.id}.${setting}`] = row;
    }
  }
  return out;
}
