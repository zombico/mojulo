/**
 * The CAPABILITY REGISTRY: for every facet setting, its values and what makes each one today. Sourced settings take
 * their values from their tables, read live on the first call (read-sources.js); hand settings take them from the facet
 * file. A sourced setting may also name `planned` values its table does not hold, so the sweep sees the gap (or, built by
 * something else, what lowers it).
 *
 *   capabilityRegistry() → { [facet]: { [setting]: { multi, values: { [value]: { status, lowers?, note?, effort?, pkg?, requires?, since? } } } } }
 *
 * `effort` and `pkg` price a gap (packages.js); a built value carries neither. `requires` names the values (as
 * 'facet.setting=value') a value cannot be built without; the sweep builds them with it. An unknown one throws.
 * `since` is the day a built value was built ('YYYY-MM-DD', the day of its changelog theme), on a hand value or, for a
 * sourced setting, by value in its source's `since`; compose.js unlockedSince reads what the values since a day made.
 * A value built before the cube kept days carries none.
 */
import { FACETS, STATUSES } from './facets/index.js';
import { readSources } from './read-sources.js';

let cached = null;

export function capabilityRegistry() {
  if (cached) return cached;
  const reg = {}, sources = readSources();
  for (const facet of FACETS) {
    const out = (reg[facet.id] = {});
    for (const [setting, spec] of Object.entries(facet.settings)) {
      const values = {};
      if (spec.source) {
        const gen = sources[`${facet.id}.${setting}`];
        const { status = 'built', note, effort, pkg, requires, since } = spec.source;
        for (const v of Object.keys(since || {})) if (!gen.values.includes(v)) throw new Error(`cosmos: ${facet.id}.${setting} dates '${v}', which its table does not hold`);
        for (const v of gen.values) {
          values[v] = { status, lowers: gen.lowers, ...(note ? { note } : {}), ...(effort ? { effort } : {}), ...(pkg ? { pkg } : {}), ...(requires ? { requires } : {}), ...(since?.[v] ? { since: since[v] } : {}) };
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
        if (row.since !== undefined && (row.status !== 'built' || !/^\d{4}-\d{2}-\d{2}$/.test(row.since))) throw new Error(`cosmos: ${facet.id}.${setting}=${v} is since '${row.since}': a built value's day, 'YYYY-MM-DD'`);
      }
      // `given`: a setting that means something only when another of the facet holds one of these values (soul's seat
      // settings, given more than one seat); the sweep rolls and nudges it only then
      for (const [g, vals] of Object.entries(spec.given || {})) {
        if (!facet.settings[g]) throw new Error(`cosmos: ${facet.id}.${setting} is given ${g}, which ${facet.id} has no setting for`);
        for (const v of vals) if (!(facet.settings[g].values || {})[v]) throw new Error(`cosmos: ${facet.id}.${setting} is given ${g}=${v}, which ${facet.id}.${g} does not hold`);
      }
      out[setting] = { multi: !!spec.multi, values, ...(spec.given ? { given: spec.given } : {}) };
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
