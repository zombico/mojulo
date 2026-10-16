/**
 * The CAPABILITY REGISTRY: for every facet setting, its values and what makes each one today. Sourced settings take
 * their values from registry.generated.js (the tables, read by the generator); hand settings take them from the facet
 * file. A sourced setting may also name `planned` values its table does not hold, so the sweep sees the gap (or, built by
something else, what lowers it). Pure
and light: it imports no source module.
 *
 *   capabilityRegistry() → { [facet]: { [setting]: { multi, values: { [value]: { status, lowers?, note?, effort?, pkg?, requires?, [engine]: mark } } } } }
 *
 * Every value carries its mark in each engine with a runtime kernel (scene/engines/registry.js): built, approximated
 * or absent. A sourced setting's come from the generated read (or its source's `<engine>: { all }`), a hand value
 * writes its own under the engine's id. A value with no mark reads as the engine's `unmarked` (a young kernel's
 * 'absent'); an engine with none (Godot) throws.
 *
 * `effort` and `pkg` price a gap (packages.js); a built value carries neither. `requires` names the values (as
 * 'facet.setting=value') a value cannot be built without; the sweep builds them with it. An unknown one throws.
 */
import { FACETS, STATUSES } from './facets/index.js';
import { GENERATED } from './registry.generated.js';
import { MARKS } from '../scene/engines/marks.js';
import { ENGINES, MARKED_ENGINES } from '../scene/engines/registry.js';

let cached = null;

export function capabilityRegistry() {
  if (cached) return cached;
  const reg = {};
  for (const facet of FACETS) {
    const out = (reg[facet.id] = {});
    for (const [setting, spec] of Object.entries(facet.settings)) {
      const values = {};
      if (spec.source) {
        const gen = GENERATED[`${facet.id}.${setting}`];
        if (!gen) throw new Error(`cosmos: ${facet.id}.${setting} has no generated values; run node scripts/gen-cosmos-registry.mjs`);
        const { status = 'built', note, effort, pkg, requires } = spec.source;
        for (const v of gen.values) {
          values[v] = { status, lowers: gen.lowers, ...(note ? { note } : {}), ...(effort ? { effort } : {}), ...(pkg ? { pkg } : {}), ...(requires ? { requires } : {}), ...Object.fromEntries(MARKED_ENGINES.map((e) => [e, spec.source[e]?.all ?? gen[e]?.[v]])) };
        }
        // planned: values the table does not hold yet (a gap the sweep should see), never one it holds; built only when
        // something other than the table makes it (it names what it lowers to)
        for (const [v, row] of Object.entries(spec.planned || {})) {
          if (values[v]) throw new Error(`cosmos: ${facet.id}.${setting}=${v} is planned but the table already holds it; drop it from planned`);
          if (row.status === 'built' && !row.lowers) throw new Error(`cosmos: ${facet.id}.${setting}=${v} is planned and built: name what it lowers to, or add it to the table`);
          values[v] = { ...row };
        }
      } else {
        for (const [v, row] of Object.entries(spec.values)) values[v] = { ...row };
      }
      for (const [v, row] of Object.entries(values)) {
        if (!STATUSES.includes(row.status)) throw new Error(`cosmos: ${facet.id}.${setting}=${v} has status '${row.status}' (known: ${STATUSES.join(', ')})`);
        for (const e of MARKED_ENGINES) {
          if (row[e] === undefined && ENGINES[e].unmarked) row[e] = ENGINES[e].unmarked;
          if (!MARKS.includes(row[e])) throw new Error(`cosmos: ${facet.id}.${setting}=${v} has no ${ENGINES[e].name} mark ('${row[e]}'; known: ${MARKS.join(', ')}): mark it in ${ENGINES[e].marksPath} or on the value`);
        }
      }
      out[setting] = { multi: !!spec.multi, values };
    }
  }
  for (const [f, settings] of Object.entries(reg)) {
    for (const [s, { values }] of Object.entries(settings)) {
      for (const [v, row] of Object.entries(values)) {
        for (const q of row.requires || []) {
          const m = /^([^.=]+)\.([^.=]+)=(.+)$/.exec(q);
          if (!m || !reg[m[1]]?.[m[2]]?.values[m[3]]) throw new Error(`cosmos: ${f}.${s}=${v} requires '${q}', which the registry does not hold ('facet.setting=value')`);
        }
      }
    }
  }
  cached = reg;
  return reg;
}
