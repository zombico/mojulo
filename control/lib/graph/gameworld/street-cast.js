/**
 * THE STREET'S CAST, A SIX AT A TIME — who walks a city's pavements, made as the hero door's realistic people (the form
 * field's body, the relational head and its rolled face, `form: 'realistic'`), dressed for an ordinary day. A SIX is six
 * different people: three men and three women, of six ages spread from the young to the old, of builds from slight to
 * heavy, each a face of their own ancestry (drawn from the place's mix where it names one), and no two in the same
 * clothes: each an everyday outfit card (outfit/styles.js) in colours of their own off the street's palette.
 *
 *   STREET_WARDROBE   { male, female }: the outfit cards a person on the street wears, each with the ages it suits
 *   STREET_MIX        a locale's ancestries, weighted (gameworld/locales.js ids); a place without one draws evenly
 *   STREET_PALETTE    the clothes' colours: tops, bottoms, shoes (an everyday street's, muted with a few brights)
 *   streetSix(seed, { locale?, set? }) → [{ id, label, spec, reads }] × 6: each a hero spec the door mints as it is
 *                       (`create_character({ as: 'hero', spec })`), `reads` what it is in words
 *
 * Pure: a six's own dice (`streetOf(seed, set)`), so one six moves no other.
 */
import { streamOf } from '../city/plan/dice.js';
import { FACE_AGE } from '../polygonizer/face-compose.js';

export const STREET_WARDROBE = Object.freeze({
  male: Object.freeze({
    casual: [16, 85], streetwear: [16, 40], office: [22, 65], business: [26, 70], athleisure: [16, 50],
  }),
  female: Object.freeze({
    casual: [16, 85], sundress: [16, 60], blouse: [22, 75], athleisure: [16, 50], streetwear: [16, 40], trousersuit: [24, 70],
  }),
});
export const STREET_MIX = Object.freeze({
  'los-angeles': { latin: 4.5, western: 3, 'east-asian': 1.5, african: 1, 'southeast-asian': 1, levantine: 0.5, 'indo-aryan': 0.5 },
  miami: { latin: 6, western: 2, african: 2, 'south-mediterranean': 0.5 },
  'san-francisco': { western: 3.5, 'east-asian': 3, latin: 1.5, 'southeast-asian': 1.5, 'indo-aryan': 1, african: 0.5 },
  boston: { western: 5, african: 1.5, latin: 1.5, 'east-asian': 1, 'indo-aryan': 0.5 },
  toronto: { western: 3.5, 'east-asian': 2, 'indo-aryan': 2, 'southeast-asian': 1, african: 1, levantine: 0.5, dravidian: 0.5 },
});
export const STREET_PALETTE = Object.freeze({
  tops: Object.freeze(['#e8e4da', '#2b2f36', '#6d7b8a', '#8a2f2f', '#d9c39a', '#3f5a46', '#c96f3b', '#f2f0ea', '#4a4f6b', '#b9a0b4', '#1f3b5c', '#9aa38a']),
  bottoms: Object.freeze(['#2c323d', '#1d1f24', '#3b4a63', '#6b5d4c', '#8c8577', '#4d4a45', '#26303f', '#a89a7d']),
  shoes: Object.freeze(['#1c1714', '#f1f1f1', '#6b4a2f', '#3a3a3a', '#8a6a4a', '#c8c3ba']),
});

// (six ages a six spreads across, one each: the young, two adults, the middle-aged, two older)
const AGE_BANDS = Object.freeze([[18, 24], [25, 33], [34, 42], [43, 54], [55, 66], [67, 80]]);
// (a six's builds: two slight, two ordinary, two heavier; the door's physique words with their dials)
const BUILDS = Object.freeze([
  { from: 'skinny', height: 0.2 }, { from: 'skinny', height: -0.3 },
  { from: 'athletic', weight: 0 }, { from: 'athletic', weight: 0.3, height: -0.2 },
  { from: 'heavyset', height: 0 }, { from: 'heavyset', weight: 0.5, height: -0.4 },
]);
const ANCESTRIES = Object.freeze(['western', 'latin', 'african', 'east-asian', 'southeast-asian', 'indo-aryan', 'levantine', 'north-asian', 'south-mediterranean', 'dravidian']);

const pick = (R, list) => list[Math.floor(R() * list.length) % list.length];
const shuffle = (R, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const weighted = (R, table) => { const rows = Object.entries(table), total = rows.reduce((s, [, w]) => s + w, 0); let u = R() * total; for (const [k, w] of rows) { u -= w; if (u < 0) return k; } return rows[rows.length - 1][0]; };
const round = (v) => Math.round(v * 100) / 100;

export const streetOf = (seed, set = 0) => streamOf(seed, 'street-cast', `six-${set}`);

export function streetSix(seed, { locale = null, set = 0 } = {}) {
  const R = streetOf(seed, set), mix = STREET_MIX[locale] ?? Object.fromEntries(ANCESTRIES.map((a) => [a, 1]));
  const casts = shuffle(R, ['male', 'male', 'male', 'female', 'female', 'female']);
  const ages = shuffle(R, AGE_BANDS), builds = shuffle(R, BUILDS), worn = new Set();
  const people = [];
  for (let i = 0; i < 6; i++) {
    const cast = casts[i], [lo, hi] = ages[i], age = Math.min(FACE_AGE.range[1], Math.round(lo + R() * (hi - lo)));
    const ethnicity = weighted(R, mix);
    // (the clothes: a card this person's age wears that no one else in the six has on, in colours of their own)
    const fits = Object.entries(STREET_WARDROBE[cast]).filter(([id, [a, b]]) => age >= a && age <= b && !worn.has(id)).map(([id]) => id);
    const style = fits.length ? pick(R, fits) : 'casual'; worn.add(style);
    const palette = { Top: pick(R, STREET_PALETTE.tops), Bottom: pick(R, STREET_PALETTE.bottoms), Shoes: pick(R, STREET_PALETTE.shoes) };
    const B = builds[i], physique = Object.fromEntries(Object.entries(B).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v]));
    const spec = {
      form: 'realistic', cast, physique,
      face: { seed: Math.floor(R() * 1e6), ethnicity, age },
      outfit: { type: 'outfit', style, dials: { ornament: 1 } },
      stylism: { genre: 'modern', register: 'grounded', canon: 'western', detail: 'plain' },
      palette,
    };
    people.push({ id: `p${set * 6 + i + 1}`, label: `${cast} ${age} ${ethnicity} ${B.from} ${style}`, spec, reads: { cast, age, ethnicity, build: B.from, style } });
  }
  return people;
}
