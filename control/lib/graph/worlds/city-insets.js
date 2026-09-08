/**
 * worlds/city-insets — the DB half of a minted edifice inside the fractal city (print-loop-demo,
 * 2026-09-08). `manifest.edifices: [{ ref, at? }]` on a `fractal-city` recipe names stored
 * EDIFICE sketches; this resolves each ref to its stored recipe and hands `city/city-insets.js`
 * the pure conversion. Kept out of `lib/graph/city/` so the planner stays DB-free.
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { insetFromEdifice } from '@/lib/graph/city/city-insets';

const DEFAULT_REGION = { x: 2, y: 2, w: 30, d: 18 };

/** normalizeEdificeEntries(list) → [{ ref, at? }] or throws on a malformed entry. */
export function normalizeEdificeEntries(list) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw new Error('`edifices` must be an array of { ref, at?: [x, y] }');
  return list.map((e, i) => {
    const entry = typeof e === 'string' ? { ref: e } : e;
    if (!entry || typeof entry.ref !== 'string' || !entry.ref.trim()) throw new Error(`edifices[${i}].ref must be a stored edifice sketch ref (sk_…)`);
    const out = { ref: entry.ref.trim() };
    if (entry.at !== undefined) {
      if (!Array.isArray(entry.at) || entry.at.length !== 2 || !entry.at.every(Number.isFinite)) throw new Error(`edifices[${i}].at must be [x, y] in city units`);
      out.at = [Number(entry.at[0]), Number(entry.at[1])];
    }
    if (entry.mode !== undefined) {
      if (entry.mode !== 'lot' && entry.mode !== 'plaza') throw new Error(`edifices[${i}].mode must be 'lot' (take a parcel, the default) or 'plaza' (reserve the plot at \`at\` before roads)`);
      out.mode = entry.mode;
    }
    if (entry.margin !== undefined) {
      if (!Number.isFinite(entry.margin) || entry.margin < 0) throw new Error(`edifices[${i}].margin must be a non-negative number (city units)`);
      out.margin = Number(entry.margin);
    }
    return out;
  });
}

/**
 * resolveCityInsets(cityManifest) → insets for planFractalCity, or [] when the recipe names
 * none. Throws when a ref is missing or is not an edifice — a mint-time refusal with the kind
 * it found, never a silent hole in the city. An absent `at` centres the plot in the region.
 */
export function resolveCityInsets(manifest = {}) {
  const entries = normalizeEdificeEntries(manifest.edifices);
  if (!entries.length) return [];
  const region = manifest.region && typeof manifest.region === 'object' ? { ...DEFAULT_REGION, ...manifest.region } : DEFAULT_REGION;
  return entries.map((entry) => {
    const sketch = SketchRepository.getByRef(entry.ref);
    if (!sketch) throw new Error(`edifices: no sketch with ref '${entry.ref}'`);
    const kind = sketch.manifest && sketch.manifest.kind;
    if (kind !== 'edifice') throw new Error(`edifices: '${entry.ref}' is a '${kind}' sketch, not an edifice — mint the building with mint_solid({ kind: 'edifice' }) first`);
    // centre by default: size it first at the origin, then re-place so the plot centres on the region
    const probe = insetFromEdifice(sketch.manifest, { at: [0, 0], margin: entry.margin });
    const at = entry.at || [region.x + region.w / 2 - probe.plot.w / 2, region.y + region.d / 2 - probe.plot.d / 2];
    const inset = insetFromEdifice(sketch.manifest, { at, margin: entry.margin });
    // an explicit `at` means the operator chose the spot: reserve it before the roads (plaza);
    // otherwise the planner takes over a generated parcel (lot).
    return { ...inset, ref: entry.ref, at, mode: entry.mode || (entry.at ? 'plaza' : 'lot') };
  });
}
