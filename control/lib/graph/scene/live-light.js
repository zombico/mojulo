/**
 * LIVE LIGHT: the settings and the math of the World page's live light. What does not move stays baked; what moves
 * gets live light (live-light.plan.md). Pure: the readers, and the JS mirrors of the shaders the page compiles
 * (channels/cast-shadows.js), so the math is pinned on stubs without a browser.
 *
 *   shadows.actors   only what moves casts into a shadow map drawn each frame; the static world receives. Where the
 *                    world bakes its sun, each vertex carries its share of light that comes straight from the sun
 *                    (`sunShare` on a face, the page's `aSun`), and an actor's shadow darkens by that share alone, so
 *                    it never doubles a baked shadow
 *   shadows.hour     the static world in its own shadow map, drawn once at load and again only when the hour changes
 *
 *   LIVE_SHADOW_KEYS          the keys of a world's `shadows` the page reads (a stage's bake ignores them)
 *   readLiveShadows(s)        a world's `shadows` → null | { actors, hour } (only when one is asked), or throws
 *   wantsSunShare(s)          does the world's `shadows` ask the bake to write each corner's `sunShare`?
 *   sunShare(full, noSun, shoulder)   the share of a corner's finished light the sun gives, from its light with and
 *                             without the sun's direct term (both before the bake's shoulder)
 *   liveShade(rgb, k, lit)    the receive patch: a fragment's colour under a shadow map's `lit` (0..1), darkened by
 *                             its sun share `k` (or the cast's alpha where the world bakes no sun)
 */

/** the keys of a world's `shadows` that the page reads: the cast channel's and its tuning, the live modes */
export const LIVE_SHADOW_KEYS = Object.freeze(['cast', 'actors', 'hour', 'alpha', 'span', 'mapSize', 'toLight', 'noCastGroups', 'bias', 'fitMin']);

/** A world's `shadows` → null (no live mode asked) | { actors, hour }; malformed live keys throw, naming the setting. */
export function readLiveShadows(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  for (const k of ['actors', 'hour']) {
    if (s[k] !== undefined && typeof s[k] !== 'boolean') throw new Error(`shadows.${k} is true or false (${k === 'actors' ? 'only what moves casts a live shadow; the static world keeps its baked sun' : 'the static world in its own shadow map, drawn when the hour changes, never per frame'})`);
  }
  if (!s.actors && !s.hour) return null;
  if (s.cast) throw new Error('shadows.cast draws every mass into a shadow map each frame; shadows.actors and shadows.hour split that (what moves each frame, the static world once an hour). Ask for cast, or for actors and/or hour, not both');
  return { actors: !!s.actors, hour: !!s.hour };
}

/** Does the world's `shadows` ask the bake for each corner's sun share (a live mode is on)? */
export const wantsSunShare = (s) => !!readLiveShadows(s);

// the share is read on luminance: one number a vertex carries for the three channels
const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The share of a corner's finished light that comes straight from the sun: 1 − shoulder(noSun) / shoulder(full), on
 *  luminance, rounded to 1e-3. 0 where the sun gives nothing (a baked shadow, a face turned away). */
export function sunShare(full, noSun, shoulder) {
  const a = Y(full.map(shoulder));
  if (!(a > 1e-9)) return 0;
  const s = 1 - Y(noSun.map(shoulder)) / a;
  return Math.round(Math.min(1, Math.max(0, s)) * 1000) / 1000;
}

/** The receive patch, as the page's shader writes it: rgb × (1 − k × (1 − lit)). */
export const liveShade = (rgb, k, lit) => rgb.map((v) => v * (1 - k * (1 - lit)));
