/**
 * GLYPH WORDS — the painted landscape's glyph cards (painted-landscape-cards/: heartbeat, splatch, sky, scene, camera)
 * read as words onto the geocube. A card's aliases are words a scene (and a game) is asked in; what each card DECIDES is
 * derived from the card's own numbers, not looked up:
 *
 *   heartbeat  the trail's dials: `heartbeat` from the card's amplitude (its waves' or its octaves' summed), `bumpiness`
 *              from how fine it is (its waves' frequency, weighted by their amplitude; its octaves × persistence)
 *   scene      the cube's flora (era/biocube.js): conifers (cones) a stand of them (the alpine flora, its stands as many
 *              as the cones), broadleaf canopies a grove or a meadow by how many, no trees an upland; boulders the rocks
 *   sky        the hour (a moon or stars: night; a sun's disc: the golden hour) and the land's cloud form (its many the
 *              cover; a lid over eight tenths stratus, a high band cirrus, else cumulus; none: clear), lowered onto the
 *              sky as a level's is (nature.js landToLevel)
 *   splatch    the palette's CHARACTER, never its colours (the operator's call): the colour theorist's axes read off the
 *              card's three seeds (heat from the middle seed's hue and chroma, weight from how dark the three are,
 *              activity from the strongest chroma), with the card's intent; the theorist solves them over the cube's own
 *              character (color-theorist/stamp.js)
 *   camera     the still the geocube kind is seen from (era/geocube.js `camera`): low (a tall vertical unit), overhead
 *              (a flat one), wide (vanishing points far apart), close (near together), else none (the kind's own)
 *
 * A word the shared table already reads (compose.js LEXICON, CUBE_WORDS, HOUR_OF_WORDS) is that table's; an alias a
 * sentence uses for other things (GLYPH_STOP) is not a glyph's. A camera is a scene's still: a game has its own camera,
 * so a game takes every family but the camera.
 *
 *   glyphOf(word)          → { family, id, decides } | null
 *   GLYPH_WORDS            { word: 'family:id' } every alias read
 *
 * Pure.
 */
import { HEARTBEATS, SPLATCHES, CAMERAS, SCENES, SKIES } from '../painted-landscape-cards/loader.js';

// aliases a sentence uses for other things: not read as a glyph
export const GLYPH_STOP = Object.freeze(new Set(['default', 'balanced', 'establishing', 'open', 'heavy', 'grey', 'covered', 'broken', 'smooth', 'polished', 'surface', 'water',
  'steps', 'fields', 'hero', 'epic', 'detail', 'tight', 'warm', 'cold', 'growth', 'lush', 'ancient', 'sun', 'stars', 'pixel', 'blocky', 'monitor', 'terminal', 'clearing',
  'scholastic', 'cinematic', 'velvet', 'neon', 'ice', 'mist', 'fog', 'heartbeat']));

const mid = (r) => (r[0] + r[1]) / 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r2 = (v) => Math.round(v * 100) / 100;

/** A heartbeat card's trail dials: how hard the land rises and falls, and how fine its bumps are. */
function heartbeatDials(c) {
  let amp, fine;
  if (c.waves) {
    amp = c.waves.reduce((a, w) => a + mid(w.amp), 0);
    fine = c.waves.reduce((a, w) => a + mid(w.amp) * Math.max(mid(w.cu), mid(w.cv)), 0) / amp;
  } else {
    const p = mid(c.fbm.persistence), o = mid(c.fbm.octaves);
    amp = mid(c.fbm.amplitude) * Array.from({ length: Math.round(o) }, (_, k) => p ** k).reduce((a, b) => a + b, 0);
    fine = o * p;
  }
  return { 'trail.heartbeat': r2(clamp(amp / 4, 0.15, 1)), 'trail.bumpiness': r2(clamp(fine / 4, 0.05, 1)) };
}
/** A scene card's flora: what stands in it, counted over its bands. */
function sceneFlora(c) {
  const n = { cone: 0, canopy: 0, boulder: 0, tuft: 0 };
  for (const band of Object.values(c.fill)) for (const e of band) n[e.kind] += e.count;
  const out = {};
  if (n.cone > 0 && n.cone >= n.canopy) out['flora.biocube'] = { from: 'alpine', flora: { trees: { clusters: clamp(Math.round(n.cone / 3.5), 4, 14) } } };
  else if (n.canopy > 0) out['flora.biocube'] = n.canopy >= 10 ? 'grove' : 'meadow';
  else out['flora.biocube'] = 'upland';
  if (n.boulder >= 10) out['land.rock'] = ['boulders', r2(clamp(n.boulder / 30, 0.25, 1))];
  return out;
}
/** A sky card's hour and clouds. */
function skyOf(c) {
  const out = {};
  if (c.moon || c.stars) out.hour = 'night';
  else if (c.sun) out.hour = 'golden';
  // (as the land's cloud form, the table's own: lowered onto the sky as a level's is, gameworld/nature.js landToLevel)
  const C = c.clouds;
  out['land.cloud'] = !C ? [null, 0] : [C.coverage >= 0.8 ? 'stratus' : (C.altitude ?? 0) >= 0.8 ? 'cirrus' : 'cumulus', r2(C.coverage)];
  return out;
}
// a colour's hue (degrees), chroma and lightness (HSL's, 0–1)
function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, c: d, l };
}
/** A splatch card's character in the theorist's axes (never its colours). */
function splatchAxes(c) {
  const S = c.seeds.map(hsl), m = S[1];
  const heat = clamp(m.c * 2.5 * Math.cos(((m.h - 50) * Math.PI) / 180), -1, 1);
  const weight = clamp((0.5 - S.reduce((a, s) => a + s.l, 0) / S.length) * 2.5, -1, 1);
  const activity = clamp((Math.max(...S.map((s) => s.c)) - 0.3) * 2.5, -1, 1);
  return { palette: { intent: c.intent, heat: r2(heat), weight: r2(weight), activity: r2(activity) } };
}
/** A camera card's still: low, overhead, wide, close, or none (the kind's own). */
function cameraOf(c) {
  const u = c.roomBasis.verticalUnit, spread = c.camera.vanishingPoints.right[0] - c.camera.vanishingPoints.left[0];
  const still = u >= 40 ? 'low' : u <= 12 ? 'overhead' : spread >= 2000 ? 'wide' : spread <= 1000 ? 'close' : null;
  return still ? { camera: still } : {};
}

const FAMILIES = [['heartbeat', HEARTBEATS, heartbeatDials], ['scene', SCENES, sceneFlora], ['sky', SKIES, skyOf], ['splatch', SPLATCHES, splatchAxes], ['camera', CAMERAS, cameraOf]];
const BY_WORD = new Map();
for (const [family, reg, decide] of FAMILIES) for (const [id, card] of Object.entries(reg)) {
  const decides = decide(card);
  if (!Object.keys(decides).length) continue;
  for (const w of card.aliases) if (!GLYPH_STOP.has(w) && !BY_WORD.has(w)) BY_WORD.set(w, Object.freeze({ family, id, decides: Object.freeze(decides) }));
}
export const GLYPH_WORDS = Object.freeze(Object.fromEntries([...BY_WORD].map(([w, g]) => [w, `${g.family}:${g.id}`])));

/** The glyph a word names, and what it decides; null when none does. */
export const glyphOf = (word) => BY_WORD.get(word) ?? BY_WORD.get(word.replace(/s$/, '')) ?? null;
