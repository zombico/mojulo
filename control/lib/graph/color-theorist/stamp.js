/**
 * AUTHORING TIME — where a palette's seed is rolled and stored, the way a stage's `art` is (era/art-direction.js): the
 * build only ever reads what is stored, so a recipe re-renders the same forever.
 *
 *   stampWorldPalette(manifest, prior, fresh) → a gameworld manifest with its `style.palette` settled:
 *     'auto', or a spec with no seed      → the seed rolled here
 *     false                               → left: the kit's own colours
 *     nothing, and no kit, look or geocube named, not a quick game:
 *       a NEW world                       → a palette rolled for it (the silent meadow default retired)
 *       an edit of a world that had one   → the one it had (a recipe re-sent whole keeps its colours)
 *       an edit of a world made before   → left as it was (an old world never changes colour by being edited)
 *   stampInteriorPalette(manifest, prior, fresh) → an interior's `palette`, by the same rules (a style named is a name)
 *   resolveArtPalette(manifest, fresh) → a room stage whose `art.palette` is { from: spec } given its ramps, solved
 *   freshPaletteSeed()
 *
 * `fresh` is injectable for tests.
 */
import { randomInt } from 'node:crypto';
import { readPaletteSpec, solvePalette } from './solve.js';
import { artPalette } from './adapters.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const freshPaletteSeed = () => randomInt(1, 2 ** 31 - 1);
const withPalette = (m, palette) => ({ ...m, style: { ...(m.style ?? {}), palette } });

/** An interior's `palette` at authoring time, by the same rules: rolled for a new room that names no style, kept by an
 * edit, never given to a room made before. */
export function stampInteriorPalette(manifest, prior = null, fresh = freshPaletteSeed) {
  if (!isObj(manifest) || manifest.kind !== 'interior') return manifest;
  const p = manifest.palette;
  if (p === 'auto' || (isObj(p) && p.seed === undefined)) return { ...manifest, palette: { ...(isObj(p) ? p : {}), seed: fresh() } };
  if (p !== undefined || manifest.style !== undefined) return manifest;
  if (prior) return prior.palette !== undefined ? { ...manifest, palette: prior.palette } : manifest;
  return { ...manifest, palette: { seed: fresh() } };
}

export function stampWorldPalette(manifest, prior = null, fresh = freshPaletteSeed) {
  if (!isObj(manifest)) return manifest;
  const st = isObj(manifest.style) ? manifest.style : {}, p = st.palette;
  if (p === 'auto' || (isObj(p) && p.seed === undefined)) return withPalette(manifest, { ...(isObj(p) ? p : {}), seed: fresh() });
  if (p !== undefined) return manifest;
  if (manifest.quick !== undefined || st.kit !== undefined || st.look !== undefined || st.geocube !== undefined) return manifest;
  if (prior) return prior.style?.palette !== undefined ? withPalette(manifest, prior.style.palette) : manifest;
  return withPalette(manifest, { seed: fresh() });
}

/** A room stage's art palette from a palette spec (`art: { palette: { from: spec } }`, the other items rolled as ever by
 * resolveArt): solved here, at authoring time, and stored as the numbers the build reads, with what it came from. */
export function resolveArtPalette(manifest, fresh = freshPaletteSeed) {
  const P = isObj(manifest) && manifest.kind === 'stage' && isObj(manifest.art) ? manifest.art.palette : undefined;
  if (!isObj(P) || P.from === undefined || Array.isArray(P.stone)) return manifest;
  let spec = readPaletteSpec(P.from, 'art.palette.from');
  if (spec === false) throw new Error("stage: art.palette.from is a palette spec (pick_palette's), or 'auto'");
  if (spec === 'auto') spec = {};
  if (spec.seed === undefined) spec = { ...spec, seed: fresh() };
  const K = solvePalette(spec);
  return { ...manifest, art: { ...manifest.art, palette: { seed: spec.seed, from: K.spec, ...artPalette(K) } } };
}
