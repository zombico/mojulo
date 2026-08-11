/**
 * face-material-roles — stamp the procedural (tessellation + vertex-colour) material system onto a
 * baked map's faces, generically, on ANY map.
 *
 * The material ENGINE already exists ([procedural-material.js](./procedural-material.js),
 * `resolveFaceMaterials`): a face carrying `material:'<preset>'` is subdivided into a grid and
 * vertex-coloured through ramp/brushed/weather layers at world-render time. What was missing is the
 * OPT-IN half — a reusable way to SELECT which faces of a finished map wear it, without hand-editing
 * the generator that baked the geometry. This helper is that selector: a pure manifest → manifest
 * transform that stamps `material` on the faces a spec matches.
 *
 * Map faces carry baked colours with no role tags today (map-treatment.plan.md), so v1 selects by
 * GEOMETRY (height band) or by baked FILL colour (a fill hex IS a de-facto role — floor grey vs
 * hull panel vs trim). Role tagging at generator mint-time is a later pass; when it lands, add a
 * `roles` selector here and the call sites gain precision for free.
 *
 * Invariants (shared with resolveFaceMaterials):
 *   - PURE: deep-clone in, source untouched out. Absent/empty spec ⇒ the map is returned unchanged
 *     (structuraly identical), mirroring "absent `material` ⇒ face list untouched".
 *   - Preset-validated: every stamped material names a known preset (or a `{kind,...}` override on
 *     one), so a typo fails loud at mint, not silent at render.
 *   - Cost is the caller's: tessellation is grid² (procedural-material's own note) — this only opts
 *     faces in; keep grid ≤4 for live worlds. `count` is returned so a caller can log the blast
 *     radius (no silent "materialised the whole map").
 */

import { MATERIAL_KINDS, MATERIAL_PRESETS } from './procedural-material.js';

const clone = (v) => structuredClone(v);

// A material value is either a known preset NAME or an object carrying a known `kind`.
function validMaterial(mat) {
  if (typeof mat === 'string') return MATERIAL_KINDS.includes(mat);
  if (mat && typeof mat === 'object' && typeof mat.kind === 'string') return MATERIAL_KINDS.includes(mat.kind);
  return false;
}

// z-extent of a face (min/max over its corners' z).
function zSpan(face) {
  let mn = Infinity, mx = -Infinity;
  for (const c of face.corners || []) { if (c[2] < mn) mn = c[2]; if (c[2] > mx) mx = c[2]; }
  return [mn, mx];
}

// Normalize a spec into a list of { material, test(face) } RULES, first-match-wins. Accepted forms:
//   'brushed-hull'                                   → blanket every face
//   { preset, minZ?, maxZ?, maxSpan?, fills? }       → one filtered rule (height band and/or fills)
//   [ …rule objects… ]                               → ordered rules (role table), first match wins
function normalizeSpec(spec) {
  if (typeof spec === 'string' || (spec && spec.kind && !spec.preset)) {
    if (!validMaterial(spec)) throw new Error(`face-material: unknown preset ${JSON.stringify(spec)} (known: ${MATERIAL_KINDS.join(', ')})`);
    return [{ material: spec, test: () => true }];
  }
  const raw = Array.isArray(spec) ? spec : [spec];
  return raw.map((r) => {
    const material = r.preset ?? r.material ?? r.kind;
    if (!validMaterial(material)) throw new Error(`face-material: unknown preset ${JSON.stringify(material)} (known: ${MATERIAL_KINDS.join(', ')})`);
    const fills = r.fills ? new Set(r.fills.map((s) => String(s).toLowerCase())) : null;
    const { minZ = -Infinity, maxZ = Infinity, maxSpan = Infinity } = r;
    return {
      material,
      test: (f) => {
        if (fills && !(typeof f.fill === 'string' && fills.has(f.fill.toLowerCase()))) return false;
        if (minZ !== -Infinity || maxZ !== Infinity || maxSpan !== Infinity) {
          const [mn, mx] = zSpan(f);
          if (mn < minZ || mx > maxZ || (mx - mn) > maxSpan) return false;
        }
        return true;
      },
    };
  });
}

/**
 * stampFaceMaterial(map, spec) — return a clone of `map` with `material` stamped on the faces the
 * spec selects. `spec` is a preset name (blanket), a filter object, or an ordered rule array
 * (first-match-wins role table). Returns `{ map, count }` — count = faces stamped.
 */
export function stampFaceMaterial(map, spec) {
  if (!spec || (Array.isArray(spec) && !spec.length)) return { map, count: 0 };
  const rules = normalizeSpec(spec);
  const m = clone(map);
  let count = 0;
  for (const f of m.faces || []) {
    if (!Array.isArray(f.corners)) continue;
    for (const r of rules) { if (r.test(f)) { f.material = r.material; count++; break; } }
  }
  return { map: m, count };
}

export { MATERIAL_KINDS, MATERIAL_PRESETS };
