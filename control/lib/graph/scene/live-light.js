/**
 * LIVE LIGHT: the settings and the math of the World page's live light. What does not move stays baked; what moves
 * gets live light (live-light.plan.md). Pure: the readers, and the JS mirrors of the shaders the page compiles
 * (channels/cast-shadows.js, channels/creases.js), so the math is pinned on stubs without a browser.
 *
 *   shadows.actors   only what moves casts into a shadow map drawn each frame; the static world receives. Where the
 *                    world bakes its sun, each vertex carries its share of light that comes straight from the sun
 *                    (`sunShare` on a face, the page's `aSun`), and an actor's shadow darkens by that share alone, so
 *                    it never doubles a baked shadow
 *   shadows.hour     the static world in its own shadow map, drawn once at load and again only when the hour changes
 *   occlusion        live contact occlusion on the creases' prepass: true or { strength, reach, samples }
 *
 *   LIVE_SHADOW_KEYS          the keys of a world's `shadows` the page reads (a stage's bake ignores them)
 *   readLiveShadows(s)        a world's `shadows` → null | { actors, hour } (only when one is asked), or throws
 *   wantsSunShare(s)          does the world's `shadows` ask the bake to write each corner's `sunShare`?
 *   sunShare(full, noSun, shoulder)   the share of a corner's finished light the sun gives, from its light with and
 *                             without the sun's direct term (both before the bake's shoulder)
 *   liveShade(rgb, k, lit)    the receive patch: a fragment's colour under a shadow map's `lit` (0..1), darkened by
 *                             its sun share `k` (or the cast's alpha where the world bakes no sun)
 *   OCCLUSION_DEFAULTS, readOcclusion(o)   `occlusion` → null | { strength, reach, samples }, or throws
 *   occlusionKernel(n)        the hemisphere's sample offsets, the same numbers the page's shader is written with
 *   occlusionAt(stub, px)     the occlusion pass on a depth / normal stub (the shader's loop, in JS)
 *   occlusionComposite(occ, strength, fogK)   the composite's alpha: what share of a pixel's colour the occlusion takes
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

/** occlusion's defaults: how dark full contact goes, how far a surface reaches to occlude (metres), the samples */
export const OCCLUSION_DEFAULTS = Object.freeze({ strength: 0.6, reach: 0.5, samples: 10 });

/** `occlusion` → null (absent / false) or the resolved terms; anything malformed throws, naming the setting. */
export function readOcclusion(o) {
  if (o === undefined || o === null || o === false) return null;
  if (o !== true && (typeof o !== 'object' || Array.isArray(o))) throw new Error('occlusion is true or { strength, reach, samples } (live contact occlusion: a hero\'s feet, a prop on the floor; static occlusion stays baked)');
  const v = { ...OCCLUSION_DEFAULTS, ...(o === true ? {} : o) };
  for (const k of Object.keys(v)) if (!(k in OCCLUSION_DEFAULTS)) throw new Error(`occlusion.${k} is not a setting (occlusion: ${Object.keys(OCCLUSION_DEFAULTS).join(', ')})`);
  if (!(typeof v.strength === 'number' && v.strength > 0 && v.strength <= 1)) throw new Error('occlusion.strength is how dark full contact goes, above 0 up to 1');
  if (!(typeof v.reach === 'number' && v.reach >= 0.05 && v.reach <= 4)) throw new Error('occlusion.reach is how far a surface reaches to occlude, 0.05 to 4 metres (contact, not a room\'s corners: those are baked)');
  if (!(Number.isInteger(v.samples) && v.samples >= 6 && v.samples <= 16)) throw new Error('occlusion.samples is the hemisphere\'s sample count, a whole number 6 to 16 (8 to 12 is the budget)');
  return v;
}

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** The hemisphere's `n` sample offsets (z along the normal), a golden-angle spiral rising from the rim to the pole, each
 *  scaled nearer the centre the earlier it is (contact is near). Fixed numbers: no dice. */
export function occlusionKernel(n) {
  return Array.from({ length: n }, (_, i) => {
    const u = (i + 0.5) / n, z = 0.15 + 0.85 * u, r = Math.sqrt(1 - z * z), a = i * 2.39996323, s = 0.15 + 0.85 * ((i + 1) / n) ** 2;
    return [r4(r * Math.cos(a) * s), r4(r * Math.sin(a) * s), r4(z * s)];
  });
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * The occlusion pass at pixel `px` (full-resolution pixel coordinates), as the page's shader computes it. View space
 * is the creases' frame: x right, y up, z the linear depth forward. `stub`: { res: [w, h], fov (radians), reach (world
 * units), kernel, depth(px) → z (0 is sky), normal(px) → unit normal facing the camera, spin (0..1) }. → 0..1
 */
export function occlusionAt(stub, px) {
  const { res, fov, reach, kernel, depth, normal, spin = 0 } = stub;
  const t = Math.tan(fov / 2), posAt = (q, z) => { const u = (q[0] - 0.5 * res[0]) / (0.5 * res[1]), v = (q[1] - 0.5 * res[1]) / (0.5 * res[1]); return [u * t * z, v * t * z, z]; };
  const z = depth(px);
  if (!(z > 0)) return 0;
  const P = posAt(px, z), N = normal(px);
  const up = Math.abs(N[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], T0 = unit(cross(up, N)), B0 = cross(N, T0), a = spin * 6.2831853;
  const T = T0.map((v, k) => v * Math.cos(a) + B0[k] * Math.sin(a)), B = cross(N, T);
  let occ = 0;
  for (const k of kernel) {
    const S = [0, 1, 2].map((j) => P[j] + (T[j] * k[0] + B[j] * k[1] + N[j] * k[2]) * reach);
    if (S[2] <= 1e-3) continue;
    const q = [Math.floor(0.5 * res[0] + (S[0] / (S[2] * t)) * 0.5 * res[1]) + 0.5, Math.floor(0.5 * res[1] + (S[1] / (S[2] * t)) * 0.5 * res[1]) + 0.5];
    if (q[0] < 0 || q[1] < 0 || q[0] > res[0] || q[1] > res[1]) continue;
    const zq = depth(q);
    if (!(zq > 0)) continue;
    const range = smoothstep(0, 1, reach / Math.max(Math.abs(z - zq), 1e-6));
    occ += (zq < S[2] - 0.02 * reach ? 1 : 0) * range;
  }
  return occ / kernel.length;
}

/** The composite's alpha over a pixel: its occlusion × the strength, faded by the fog as the creases are. */
export const occlusionComposite = (occ, strength, fogK = 1) => Math.min(1, Math.max(0, occ * strength * fogK));
