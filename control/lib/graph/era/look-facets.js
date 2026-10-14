/**
 * LOOK FACETS — a style card taken apart into what it decides, so a look can be composed instead of written. A card
 * (era/style/*.js) is one flat list of numbers; read as facets it is seven concerns, each set on its own:
 *
 *   palette  the colours: every ramp, shadow to light, and which group is locked to which ramp
 *   grammar  how it is drawn: the stops a tile paints from, where light turns to shade, hats and fringes, blends
 *   geology  the ground's rock: the landform and its cliff, beds and joints, rubble and boulders
 *   flora    what grows: grass, trees, live grass, what glows
 *   sky      the light and what is in the sky: the key, the sun, the clouds, a night, a companion world by day
 *   air      depth: the haze and the far layers
 *   water    how water is painted
 *
 * What is none of these (the site, the trail, the focus, a kit's own extras) is its FRAME, carried as it is.
 *
 *   decompileKit(card) → { facets: { <facet>: { <key>: value } }, frame }
 *   composeKit({ facets, frame }) → a card (a written card round-trips to itself)
 *   rampFrom(rgb, n, opts), resample(ramp, n), desaturate(ramp, k), luma(rgb), chroma(rgb), toHsl, toRgb   the colour tools
 *
 * Pure.
 */
export const FACETS = Object.freeze({
  palette: { keys: ['palette', 'lock', 'tint'], read: 'the colours: every ramp, shadow to light, and which group is locked to which' },
  grammar: { keys: ['tiles', 'cel', 'cliffCelR', 'hat', 'lip', 'trailBlend', 'contact', 'ground', 'pole'], read: 'how it is drawn: the stops a tile paints from, where light turns to shade, hats and fringes, and the pole (banded, or every surface its material under light) and the ground on it' },
  geology: { keys: ['landform', 'cliff', 'slope', 'lumps', 'rubble', 'boulder'], read: 'the rock: the landform, its cliff\'s beds and joints, rubble and boulders' },
  flora: { keys: ['grass', 'trees', 'live', 'shrubs', 'glow'], read: 'what grows: grass, trees, the live grass, the shrubs, what glows' },
  sky: { keys: ['light', 'sun', 'cumulus', 'night', 'companion'], read: 'the light and the sky: the key, the sun, the clouds, a night, a world hanging in the day' },
  air: { keys: ['air', 'layers'], read: 'depth: the haze and the far layers' },
  water: { keys: ['water'], read: 'how water is painted' },
});
export const FACET_IDS = Object.freeze(Object.keys(FACETS));
const FACET_OF = Object.fromEntries(FACET_IDS.flatMap((f) => FACETS[f].keys.map((k) => [k, f])));
// the order a card's keys are written in (the meadow's), the facets' and the frame's alike
const ORDER = ['id', 'references', 'principles', 'palette', 'tiles', 'cel', 'cliffCelR', 'lock', 'tint', 'site', 'focus', 'trailBlend', 'trail', 'lumps', 'cliff', 'slope', 'landform', 'rubble', 'boulder', 'hat', 'lip', 'grass', 'trees', 'live', 'shrubs', 'contact', 'light', 'air', 'sun', 'cumulus', 'layers', 'night', 'glow', 'water', 'companion', 'pole', 'ground'];

/** A card read as its facets and its frame. */
export function decompileKit(card) {
  const facets = Object.fromEntries(FACET_IDS.map((f) => [f, {}])), frame = {};
  for (const [k, v] of Object.entries(card)) (FACET_OF[k] ? facets[FACET_OF[k]] : frame)[k] = v;
  return { facets, frame };
}

/** A card from facets and a frame, its keys in the written order (anything else after, as given). */
export function composeKit({ facets, frame }) {
  const all = { ...frame };
  for (const f of FACET_IDS) Object.assign(all, facets[f] ?? {});
  const out = {};
  for (const k of ORDER) if (k in all) out[k] = all[k];
  for (const k of Object.keys(all)) if (!(k in out)) out[k] = all[k];
  return out;
}

// ── colour tools ────────────────────────────────────────────────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));
export const luma = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
export const chroma = (c) => Math.max(...c) - Math.min(...c);
export function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function toRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round(clamp((v + m) * 255)));
}
const mixHue = (a, b, t) => { const d = ((b - a + 540) % 360) - 180; return (a + d * t + 360) % 360; };

/**
 * A ramp of n stops round a colour, shadow to light: the darkest a cool colour (leaning `cool` of the way toward
 * `shadow`, a hue), never black; the middle the colour itself; the lightest warmed toward `light` (a hue) and paled.
 * `sat` scales its saturation.
 */
export function rampFrom(rgb, n = 5, { shadow = 222, light = 48, sat = 1, cool = 0.6, lo = 0.13, hi = 0.86 } = {}) {
  const [h, s0] = toHsl(rgb), s = clamp(s0 * sat, 0.04, 1), [, , l0] = toHsl(rgb);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1), l = t <= 0.5 ? lo + (l0 - lo) * (t / 0.5) : l0 + (hi - l0) * ((t - 0.5) / 0.5);
    const hue = t < 0.5 ? mixHue(h, shadow, cool * (1 - t / 0.5)) : mixHue(h, light, (t - 0.5) * 0.4);
    const sat2 = t < 0.5 ? clamp(s * (0.55 + 0.45 * (t / 0.5)), 0.08, 1) : s * (1 - (t - 0.5) * 0.7);
    return toRgb([hue, sat2, clamp(l, 0.06, 0.95)]);
  });
}
/** A ramp re-cut to n stops, the ends kept, each stop between read off the old ones. */
export function resample(ramp, n) {
  if (ramp.length === n) return ramp.map((c) => [...c]);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (ramp.length - 1), a = Math.floor(t), b = Math.min(ramp.length - 1, a + 1), f = t - a;
    return ramp[a].map((v, k) => Math.round(v + (ramp[b][k] - v) * f));
  });
}
/** A ramp with its saturation taken down by k (0…1), its values kept. */
export const desaturate = (ramp, k) => ramp.map((c) => { const [h, s, l] = toHsl(c); return toRgb([h, s * (1 - k), l]); });
