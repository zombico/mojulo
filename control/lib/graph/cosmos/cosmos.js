/**
 * THE COSMOS CUBE: a game as six facets (facets/index.js), each a small seed:
 *
 *   { reality: { extends?, samples?, era, look, … }, space: { … }, power, soul, mind, time }
 *
 * A facet may be absent or partial; an unset setting falls back to the default and is not checked. Three reads:
 *
 *   validateCube(cube)  throws on an unknown facet, setting or value, naming the known ones
 *   facetDepth(spec)    0 a preset ref only · 1 settings · 2 samples · 3 every sample approved: found, never claimed
 *   dryRun(cube)        what each set value lowers to today, and the verdict:
 *                         makeable  every value built
 *                         gaps      some value local or partial (named)
 *                         blocked   some value absent (named)
 *                       plus `godot`: the values that would not survive a Godot export
 *
 * It builds nothing. Pure and deterministic: the same cube gives the same report.
 */
import { FACETS, FACET_IDS } from './facets/index.js';
import { capabilityRegistry } from './registry.js';

const RESERVED = ['extends', 'samples'];

export function validateCube(cube) {
  if (!cube || typeof cube !== 'object') throw new Error('cosmos: a cube is an object of facets');
  const reg = capabilityRegistry();
  for (const [fid, spec] of Object.entries(cube)) {
    if (!FACET_IDS.includes(fid)) throw new Error(`cosmos: unknown facet '${fid}' (known: ${FACET_IDS.join(', ')})`);
    if (spec == null) continue;
    for (const [setting, val] of Object.entries(spec)) {
      if (RESERVED.includes(setting)) continue;
      const s = reg[fid][setting];
      if (!s) throw new Error(`cosmos: ${fid} has no setting '${setting}' (known: ${Object.keys(reg[fid]).join(', ')})`);
      const vals = Array.isArray(val) ? val : [val];
      if (Array.isArray(val) && !s.multi) throw new Error(`cosmos: ${fid}.${setting} takes one value`);
      for (const v of vals) {
        if (!(v in s.values)) throw new Error(`cosmos: ${fid}.${setting} has no value '${v}' (known: ${Object.keys(s.values).join(', ')})`);
      }
    }
  }
  return cube;
}

export function facetDepth(spec) {
  if (!spec) return 0;
  const samples = Array.isArray(spec.samples) ? spec.samples : [];
  if (samples.length && samples.every((s) => s && s.approved)) return 3;
  if (samples.length) return 2;
  return Object.keys(spec).some((k) => !RESERVED.includes(k)) ? 1 : 0;
}

export function dryRun(cube) {
  validateCube(cube);
  const reg = capabilityRegistry();
  const facets = {}, gaps = [], blocked = [], lost = [];
  for (const { id } of FACETS) {
    const spec = cube[id] || null;
    const rows = [];
    for (const [setting, val] of Object.entries(spec || {})) {
      if (RESERVED.includes(setting)) continue;
      for (const value of Array.isArray(val) ? val : [val]) {
        const r = reg[id][setting].values[value];
        const row = { setting, value, status: r.status, ...(r.lowers ? { lowers: r.lowers } : {}), ...(r.note ? { note: r.note } : {}) };
        rows.push(row);
        const at = { facet: id, setting, value, status: r.status, ...(r.note ? { note: r.note } : {}) };
        if (r.status === 'absent') blocked.push(at);
        else if (r.status !== 'built') gaps.push(at);
        if (r.godot === false) lost.push({ facet: id, setting, value });
      }
    }
    facets[id] = { depth: facetDepth(spec), rows };
  }
  const verdict = blocked.length ? 'blocked' : gaps.length ? 'gaps' : 'makeable';
  return { verdict, blocked, gaps, godot: { ok: !lost.length, lost }, facets };
}
