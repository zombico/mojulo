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
 *   freshPaletteSeed()
 *
 * `fresh` is injectable for tests.
 */
import { randomInt } from 'node:crypto';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const freshPaletteSeed = () => randomInt(1, 2 ** 31 - 1);
const withPalette = (m, palette) => ({ ...m, style: { ...(m.style ?? {}), palette } });

export function stampWorldPalette(manifest, prior = null, fresh = freshPaletteSeed) {
  if (!isObj(manifest)) return manifest;
  const st = isObj(manifest.style) ? manifest.style : {}, p = st.palette;
  if (p === 'auto' || (isObj(p) && p.seed === undefined)) return withPalette(manifest, { ...(isObj(p) ? p : {}), seed: fresh() });
  if (p !== undefined) return manifest;
  if (manifest.quick !== undefined || st.kit !== undefined || st.look !== undefined || st.geocube !== undefined) return manifest;
  if (prior) return prior.style?.palette !== undefined ? withPalette(manifest, prior.style.palette) : manifest;
  return withPalette(manifest, { seed: fresh() });
}
