/**
 * Reads every facet's SOURCE tables live: the values the tree defines today, in the table's own order. Used by the
 * generator (scripts/gen-cosmos-registry.mjs) and by registry.test.js, which holds the generated file equal to
 * this read. Modules are imported by their path under control/, so a branch can name a new table without a code edit
 * here. Under plain Node the caller registers the `@/` loader first (scripts/mcp-stdio-loader.mjs).
 *
 *   readSources() → { 'facet.setting': { lowers, values: [...], [engine]?: { [value]: 'built' | 'approximated' | 'absent' } } }
 *   A source's marks come from each engine with a runtime kernel (scene/engines/registry.js). `marks: '<reader>'`
 *   reads every such engine's own tables through MARK_READERS (the tables its export reads). `<engine>: { module,
 *   table | read }` reads one engine's from elsewhere: a table of the values that travel whole (the rest absent), or a
 *   reader. `<engine>: { all, how }` marks every value alike; the registry reads it, so there is nothing to read here.
 */
import { FACETS } from './facets/index.js';
import { MARKED_ENGINES, marksOf } from '../scene/engines/registry.js';

const CONTROL = new URL('../../../', import.meta.url);

// a table's values: an object's keys, an array's items, a string as itself
const valuesOf = (t) => (Array.isArray(t) ? t.map(String) : t && typeof t === 'object' ? Object.keys(t) : typeof t === 'string' ? [t] : null);

// tables that are assembled, not written: read by composing what assembles them
const SPACE_CAMERA_RULES = ['eye', 'overhead', 'side'];
// and the directing camera (playscape/ui/scenes.js): time.shots and time.framing, not a power
const TIME_CAMERA_RULES = ['shot'];
// a reader's output: a list (the values built; the rest absent) or { value: mark row } (rows keyed by their engine)
const markOf = (r, engine) => (typeof r === 'string' ? r : r && r[engine]);
const PORT = 'lib/graph/scene/engine-portability.js';
const each = async (module, table, f) => { const t = (await load(module))[table]; return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, f(k, v)])); };
// each engine's marks, read from its own tables (the ones its export reads), by engine id
const MARK_READERS = {
  mechanicMarks: async (e) => (await load(PORT)).mechanicMarks(e),
  kitMarks: async (e) => { const P = await load(PORT); return each('lib/graph/game/kits.js', 'KITS', (k) => P.kitMark(k, e)); },
  ruleMarks: (e) => marksOf(e).RULE_MARKS,
  systemMarks: (e) => marksOf(e).SYSTEM_MARKS,
  idiomMarks: (e) => each('lib/graph/gameworld/actions.js', 'IDIOMS', (k, i) => marksOf(e).SYSTEM_MARKS[i.system.kind]),
  traversalMarks: (e) => each('lib/graph/playscape/objects/index.js', 'ENTRIES', (k) => marksOf(e).traversalMark(k)),
  gaitMarks: (e) => each('lib/graph/polygonizer/hero-motion.js', 'MOTION_GAITS', (k, g) => marksOf(e).gaitMark(k, g)),
  linkMarks: (e) => marksOf(e).LINK_MARKS,
};
// the values of tables that are assembled, not written
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
      for (const e of MARKED_ENGINES) {
        const own = src[e] && typeof src[e] === 'object' && src[e].module ? src[e] : null;
        if (!own && !src.marks) continue;
        const got = own ? await read(own) : await MARK_READERS[src.marks](e);
        if (!got) throw new Error(`cosmos source ${lowers}: no ${e} marks (${own ? `${own.module}#${own.read || own.table}` : src.marks})`);
        if (Array.isArray(got)) { const built = new Set(got); row[e] = Object.fromEntries(values.map((v) => [v, built.has(v) ? 'built' : 'absent'])); }
        else row[e] = Object.fromEntries(values.map((v) => [v, markOf(got[v], e) || 'unmarked']));
      }
      out[`${facet.id}.${setting}`] = row;
    }
  }
  return out;
}
