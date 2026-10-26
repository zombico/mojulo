/**
 * LIVE LIGHT: the settings and the math of the World page's live light. What does not move stays baked; what moves
 * gets live light (live-light.plan.md). Pure: the readers, and the JS mirrors of the shaders the page compiles
 * (channels/cast-shadows.js, channels/creases.js), so the math is pinned on stubs without a browser.
 *
 * THE SUN DOES NOT MOVE, live or within a level (the operator's principle, era/geocube-hours.js). A level is lit at one
 * hour: its light baked, its static shadow map drawn once at load. Never wire a clock, a day cycle or a moving sun here.
 *
 * ON BY DEFAULT where it pays (liveLightDefaults, read by world-scene before the bake): a hero's level takes the actors'
 * shadows; a world whose geocube names the seventh generation takes actors, the hour's map and occlusion; each the
 * recipe's own where it says, and all of it under the quality tier (`light.tier`, by the screen the game is made for).
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
 *   heroLevel(m)              does a world have a pilot with a body (a hero's level, not a spectated battle)?
 *   LIGHT_TIERS, readLightTier(light)   `light.tier` → 'auto' | 'off' | 'half' | 'full', or throws
 *   TIER_TERMS, tierFor(tier, screen)   a tier (and the screen's pole for auto) → { tier, mapSize, ao, occlusion }
 *   liveLightDefaults(m, { era })   a world manifest → the shadows and occlusion its page takes (the recipe's own, the
 *                             hero's and the era's defaults filled where it says nothing) and the tier they cost at
 *   receiverBias(g, texel, bias, cap)   the hour map's depth bias for a receiver whose light-space depth slope is g
 */

/** the keys of a world's `shadows` that the page reads: the cast channel's and its tuning, the live modes */
export const LIVE_SHADOW_KEYS = Object.freeze(['cast', 'actors', 'hour', 'alpha', 'span', 'lead', 'mapSize', 'toLight', 'noCastGroups', 'bias', 'fitMin']);

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

// ── on by default where it pays ──────────────────────────────────────────────────────────────────────────────────

/** A hero's level: the world has a pilot with a body (a pilotable entity whose body is not `none`), and is not a
 *  spectated battle (no pilot at all there). A first-person walker with no body is the camera, not a hero. */
export function heroLevel(m) {
  if (!m || m.spectate === true || !Array.isArray(m.entities)) return false;
  return m.entities.some((e) => e && e.pilotable && !(e.body && e.body.type === 'none'));
}

/** the tiers a world's `light.tier` names: auto (by the screen the game is made for), off, half, full */
export const LIGHT_TIERS = Object.freeze(['auto', 'off', 'half', 'full']);
/** what a tier costs: the shadow maps' size, and the occlusion's resolution (1 as built: the prepass at the frame's,
 *  the occlusion pass at half of it; 0.5: each at half that) */
export const TIER_TERMS = Object.freeze({ half: Object.freeze({ mapSize: 1024, ao: 0.5 }), full: Object.freeze({ mapSize: 2048, ao: 1 }) });
// auto, by the screen's pole (game/screen.js): a phone takes half and no default occlusion; a tablet half; a screen
// (the desktop's), or none named, full. A custom frame upright reads as a phone, on its side as a screen
const AUTO = Object.freeze({ phone: { tier: 'half', occlusion: false }, tablet: { tier: 'half', occlusion: true }, screen: { tier: 'full', occlusion: true } });

/** A world's `light` → its tier ('auto' when it names none). Only `light.tier` is the live light's: other keys of a
 *  world's `light` (a painted landscape's direction) are their kind's. Throws on a tier that is not one. */
export function readLightTier(light) {
  if (light === undefined || light === null || typeof light !== 'object' || Array.isArray(light) || light.tier === undefined) return 'auto';
  if (!LIGHT_TIERS.includes(light.tier)) throw new Error(`light.tier is one of ${LIGHT_TIERS.join(', ')} (what the live light may cost: auto by the screen the game is made for, a phone half without occlusion; off none of it; half its maps at 1024 and its occlusion at a quarter of the frame; full 2048 and half the frame)`);
  return light.tier;
}

/** A tier and the screen it is read with (readScreen's, or null) → null (off) | { tier, mapSize, ao, occlusion } where
 *  `occlusion` says whether a DEFAULT occlusion is taken at it (a recipe's own is kept at any tier but off). */
export function tierFor(tier, screen = null) {
  if (tier === 'off') return null;
  if (tier === 'half' || tier === 'full') return { tier, ...TIER_TERMS[tier], occlusion: true };
  const pole = !screen ? 'screen' : AUTO[screen.pole] ? screen.pole : screen.orientation === 'portrait' ? 'phone' : 'screen';
  const A = AUTO[pole];
  return { tier: A.tier, ...TIER_TERMS[A.tier], occlusion: A.occlusion };
}

// what a recipe's own `shadows` says about the page: 'open' (nothing: absent, or only a stage's bake keys), 'live' (it
// names actors or hour: the rest is filled), 'said' (false: none; true or a blob's tuning: the suit's contact blob; cast)
const BAKE_SHADOW_KEYS = ['torch', 'sun', 'cells'];
function shadowsSay(s) {
  if (s === undefined || s === null) return 'open';
  if (typeof s !== 'object' || Array.isArray(s)) return 'said';
  if (s.cast) return 'said';
  if (s.actors !== undefined || s.hour !== undefined) return 'live';
  return Object.keys(s).some((k) => !BAKE_SHADOW_KEYS.includes(k)) ? 'said' : 'open';
}

/**
 * The live light a world's page takes: its recipe's own, and the defaults where the recipe says nothing.
 *   a hero's level (heroLevel)   shadows.actors
 *   era 'gen-7' (its geocube's)  shadows.actors, shadows.hour, occlusion
 * A recipe says otherwise with `shadows: false`, `shadows: true` or a blob's tuning, `shadows.cast`, `actors: false` /
 * `hour: false`, `occlusion: false`; a stage's bake keys alone say nothing. The tier (`light.tier`, auto by the
 * `screen`, readScreen's) caps the cost: off drops the live light, its defaults and the recipe's asks alike.
 * → { shadows, occlusion, tier: null | { tier, mapSize, ao }, from: { actors?, hour?, occlusion? } }. `shadows` and
 * `occlusion` are the recipe's own values (the same objects) where nothing is added; `from` names each default taken.
 */
export function liveLightDefaults(m, { era = null, screen = null } = {}) {
  const s = m.shadows, T = tierFor(readLightTier(m.light), screen), gen7 = era === 'gen-7', hero = heroLevel(m);
  if (!T) {
    // off: no live light. The recipe's live keys come off its shadows (its bake keys and its blob stay); a shadows that
    // asked for live light alone is none
    const live = s && typeof s === 'object' && !Array.isArray(s) && (s.actors !== undefined || s.hour !== undefined);
    const rest = live ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'actors' && k !== 'hour')) : s;
    return { shadows: live && !Object.keys(rest).length ? undefined : rest, occlusion: undefined, tier: null, from: {} };
  }
  const want = { actors: hero || gen7, hour: gen7 }, say = shadowsSay(s), from = {};
  let shadows = s;
  if (say !== 'said') {
    const add = {};
    for (const k of ['actors', 'hour']) if (want[k] && (say === 'open' || s[k] === undefined)) { add[k] = true; from[k] = k === 'actors' && hero ? 'hero' : 'gen-7'; }
    if (Object.keys(add).length) shadows = { ...(s || {}), ...add };
  }
  let occlusion = m.occlusion;
  if (occlusion === undefined && gen7 && T.occlusion) { occlusion = true; from.occlusion = 'gen-7'; }
  const lit = !!readLiveShadows(shadows) || !!readOcclusion(occlusion);
  return { shadows, occlusion, tier: lit ? { tier: T.tier, mapSize: T.mapSize, ao: T.ao } : null, from };
}

/** The hour map's depth bias for a receiver whose light-space depth slope is `g` = [dz/du, dz/dv] (the receive patch
 *  reads it from the fragment's own derivatives): the map's constant bias plus the depth the receiver's own plane
 *  climbs across one texel and a half (the farthest of the four taps from the texel it reads), capped at `cap` (a
 *  grazing receiver would otherwise lose a caster's real shadow). Without it a sun low over wide terrain lays the map's
 *  own steps on the ground as moiré. The page's shader in JS. */
export const receiverBias = (g, texel, bias, cap) => bias + Math.min(cap, 1.5 * texel * (Math.abs(g[0]) + Math.abs(g[1])));
