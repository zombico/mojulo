/**
 * The CAPABILITY REGISTRY: for every facet setting, its values and what makes each one today. Sourced settings take
 * their values from registry.generated.js (the tables, read by the generator); hand settings take them from the facet
 * file. Pure and light: it imports no source module.
 *
 *   capabilityRegistry() → { [facet]: { [setting]: { multi, values: { [value]: { status, lowers?, note?, effort?, pkg?, requires?, godot? } } } } }
 *
 * `effort` and `pkg` price a gap (packages.js); a built value carries neither. `requires` names the values (as
 * 'facet.setting=value') a value cannot be built without; the sweep builds them with it. An unknown one throws.
 */
import { FACETS, STATUSES } from './facets/index.js';
import { GENERATED } from './registry.generated.js';

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
        const { status = 'built', note, effort, pkg, requires, godot } = spec.source;
        for (const v of gen.values) {
          values[v] = { status, lowers: gen.lowers, ...(note ? { note } : {}), ...(effort ? { effort } : {}), ...(pkg ? { pkg } : {}), ...(requires ? { requires } : {}), ...(godot === false ? { godot: false } : gen.godot ? { godot: gen.godot.includes(v) } : {}) };
        }
      } else {
        for (const [v, row] of Object.entries(spec.values)) values[v] = { ...row };
      }
      for (const [v, row] of Object.entries(values)) {
        if (!STATUSES.includes(row.status)) throw new Error(`cosmos: ${facet.id}.${setting}=${v} has status '${row.status}' (known: ${STATUSES.join(', ')})`);
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
