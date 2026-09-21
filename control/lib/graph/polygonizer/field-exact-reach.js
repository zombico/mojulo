/**
 * field-exact-reach — which field terms have an exact (Manifold) twin. Pure and import-free on
 * purpose: field-faces validates `exact: true` through this module, and field-faces is reachable
 * from client bundles (figure-render → image-outcomes), so nothing here may touch the kernel.
 */

/**
 * exactSupport(terms) → { ok: true } | { ok: false, at, why }: the first term with no Manifold
 * twin, named the way the transpiler's ledger names it.
 */
export function exactSupport(terms, at = 'terms') {
  if (!Array.isArray(terms)) return { ok: false, at, why: 'no terms' };
  for (let i = 0; i < terms.length; i += 1) {
    const t = terms[i];
    const here = `${at}[${i}]`;
    if (!t || typeof t !== 'object') return { ok: false, at: here, why: 'not a term' };
    if (Number.isFinite(t.blend) && t.blend > 0) return { ok: false, at: here, why: '`blend` is a smooth min/max — an exact kernel has no blended boolean' };
    switch (t.op) {
      case 'add': case 'subtract': case 'intersect': {
        const k = t.shape && t.shape.kind;
        if (k === 'expr') return { ok: false, at: here, why: 'an `expr` distance expression has no closed-form solid' };
        if (k === 'lathe' && Array.isArray(t.shape.harmonics) && t.shape.harmonics.length) return { ok: false, at: here, why: 'a lathe with `harmonics` is not a surface of revolution' };
        break;
      }
      case 'transform': case 'repeat': {
        if (Array.isArray(t.terms)) { const r = exactSupport(t.terms, `${here}.terms`); if (!r.ok) return r; }
        break;
      }
      case 'stroke': return { ok: false, at: here, why: 'a `stroke` dab is a smooth-blended sphere' };
      case 'displace': return { ok: false, at: here, why: '`displace` is seeded noise on the field' };
      case 'shell': return { ok: false, at: here, why: '`shell` offsets the field inward; there is no exact 3D offset' };
      case 'round': return { ok: false, at: here, why: '`round` inflates the field (a minkowski); not exact here' };
      case 'twist': case 'bend': case 'taper': case 'elongate': return { ok: false, at: here, why: `\`${t.op}\` warps the distance field, not the solid` };
      default: return { ok: false, at: here, why: `\`${t.op}\` has no exact twin` };
    }
  }
  return { ok: true };
}


const listWantsExact = (xs) => Array.isArray(xs) && xs.some((x) => x && x.exact === true);
/**
 * manifestWantsExact(manifest) → does rendering this recipe need the exact kernel loaded?
 * A workbench with an `exact: true` field or cut, or with a `program` (which may emit one); an
 * assembler whose frozen item sources want it; a scad row whose embedded `fields` want it. The
 * async seams (a mint, an edit, the scene route, the SVG scaffold) gate `ensureExactKernel()` on
 * this so a recipe without exact terms never loads the WASM.
 */
export function manifestWantsExact(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (manifest.kind === 'assembler') return Array.isArray(manifest.items) && manifest.items.some((it) => it && manifestWantsExact({ kind: 'workbench', ...it.source }));
  if (manifest.kind === 'scad') return listWantsExact(manifest.fields);
  return listWantsExact(manifest.fields) || listWantsExact(manifest.cuts) || (manifest.program != null && typeof manifest.program === 'object');
}
