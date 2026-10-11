/**
 * The CAPABILITY REGISTRY: for every facet setting, its values and what makes each one today. Sourced settings take
 * their values from registry.generated.js (the tables, read by the generator); hand settings take them from the facet
 * file. Pure and light: it imports no source module.
 *
 *   capabilityRegistry() → { [facet]: { [setting]: { multi, values: { [value]: { status, lowers?, note?, godot? } } } } }
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
        const status = spec.source.status || 'built';
        for (const v of gen.values) {
          values[v] = { status, lowers: gen.lowers, ...(spec.source.note ? { note: spec.source.note } : {}), ...(gen.godot ? { godot: gen.godot.includes(v) } : {}) };
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
  cached = reg;
  return reg;
}
