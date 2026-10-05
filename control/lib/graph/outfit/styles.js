// outfit/styles — the seeded outfit cards. PURE DATA: every card is plain JSON (the test round-trips each one), so an
// agent can read one, copy it, and author its own inline as `outfit.style`. A style is only a SAMPLE, a preset over the
// dials and the language (principles.js): a new look is a new card, not code.
//
// A card:
//   dials     { stylize, fit, coverage, ornament } — the defaults a build's own `dials` override
//   language  top:    { family: 'knit' | 'woven', sleeve, hem, collar: true|false } | false (no top)
//             bottom: { family, leg } | { kind: 'skirt', family, leg: micro | mini | knee | midi | maxi, cut: pencil | aline |
//             full } | false
//             dress:  true (the skirt is the top's own cloth: one garment, no waistband, the belt its focal) | false
//             feet:   'boots' | 'shoes' | 'none'
//             tuck:   true (the top tucked in, the bottom over its tail) | false (worn out over the bottom)
//             focal:  'collar' | 'placket' | 'belt' (law 5; defaults to the woven top's placket, else the belt)
//             (sleeve, hem and leg are LENGTHS words: principles.js)
//   tones     group → '#hex': Top, Bottom, Shoes and the construction's (Trim, Placket, Button, Seam, Waistband,
//             Leather, Buckle), suggested beneath the operator's own palette; the rest derive from Top and Bottom

export const SEEDED_OUTFITS = Object.freeze({
  casual: {
    "id": "casual",
    "dials": { "stylize": 0.2, "fit": 0.5, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "short", "hem": "hip" }, "bottom": { "family": "woven", "leg": "long" }, "feet": "boots", "tuck": false, "focal": "belt" },
    "tones": { "Top": "#e6e0d0", "Bottom": "#33415c", "Shoes": "#6b4a2f", "Leather": "#5a3a22", "Buckle": "#b8b2a6" }
  },
  office: {
    "id": "office",
    "dials": { "stylize": 0.1, "fit": 0.35, "coverage": 1, "ornament": 3 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true }, "bottom": { "family": "woven", "leg": "long" }, "feet": "shoes", "tuck": true, "focal": "collar" },
    "tones": { "Top": "#dfe7f1", "Bottom": "#2b2d33", "Shoes": "#1c1714", "Button": "#f4f1ea", "Leather": "#1f1a17", "Buckle": "#c7c2b5" }
  },
  athlete: {
    "id": "athlete",
    "dials": { "stylize": 0.25, "fit": 0.2, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "none", "hem": "waist" }, "bottom": { "family": "knit", "leg": "short" }, "feet": "shoes", "tuck": false, "focal": "collar" },
    "tones": { "Top": "#e4572e", "Bottom": "#1d2433", "Shoes": "#f2f2f2", "Trim": "#f2f2f2" }
  },
  // the female cards: a dress, a blouse and a pencil skirt, athleisure (any card dresses any cast; these are drawn on her)
  sundress: {
    "id": "sundress",
    "dials": { "stylize": 0.25, "fit": 0.45, "coverage": 1, "ornament": 1 },
    "language": { "top": { "family": "woven", "sleeve": "cap", "hem": "waist" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "knee", "cut": "aline" }, "dress": true, "feet": "shoes", "tuck": true, "focal": "belt" },
    "tones": { "Top": "#e9b44c", "Shoes": "#8a5a3c", "Leather": "#7a4a2a", "Buckle": "#e8d9a8" }
  },
  blouse: {
    "id": "blouse",
    "dials": { "stylize": 0.15, "fit": 0.4, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "knee", "cut": "pencil" }, "feet": "shoes", "tuck": true, "focal": "placket" },
    "tones": { "Top": "#f3ece4", "Bottom": "#2f2a3a", "Shoes": "#1c1714", "Button": "#c9b48a" }
  },
  athleisure: {
    "id": "athleisure",
    "dials": { "stylize": 0.2, "fit": 0.1, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "none", "hem": "crop" }, "bottom": { "family": "knit", "leg": "long" }, "feet": "shoes", "tuck": false, "focal": "collar" },
    "tones": { "Top": "#7fb8a4", "Bottom": "#2b2f3a", "Shoes": "#f0f0f0", "Trim": "#f0f0f0" }
  },
  adventurer: {
    "id": "adventurer",
    "dials": { "stylize": 0.45, "fit": 0.7, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "threeQuarter", "hem": "tunic" }, "bottom": { "family": "woven", "leg": "long" }, "feet": "boots", "tuck": false, "focal": "belt" },
    "tones": { "Top": "#8a9a5b", "Bottom": "#4a3f33", "Shoes": "#3a2a1e", "Leather": "#6a4327", "Buckle": "#c9a55a" }
  },
});

const FAMILY = ['knit', 'woven'], SLEEVE = ['none', 'cap', 'short', 'elbow', 'threeQuarter', 'long'], HEM = ['crop', 'waist', 'hip', 'tunic'];
const LEG = ['brief', 'short', 'knee', 'capri', 'long'], SKIRT = ['micro', 'mini', 'knee', 'midi', 'maxi'], CUT = ['pencil', 'aline', 'full'], FEET = ['boots', 'shoes', 'none'], FOCAL = ['collar', 'placket', 'belt'];
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const one = (v, list, at) => (v === undefined || list.includes(v) ? [] : [`${at}: '${v}' — one of ${list.join(', ')}`]);

/** Validate a card → error strings naming the choices (`at` prefixes them) */
export function validateOutfitCard(card, at = 'outfit.style') {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return [`${at}: a card { dials?, language, tones? }`];
  const errs = [], L = card.language ?? {};
  if (typeof L !== 'object' || Array.isArray(L)) return [`${at}.language: { top, bottom, feet, tuck, focal }`];
  if (L.top !== undefined && L.top !== false) { if (typeof L.top !== 'object') errs.push(`${at}.language.top: { family, sleeve, hem, collar? } or false`);
    else errs.push(...one(L.top.family, FAMILY, `${at}.language.top.family`), ...one(L.top.sleeve, SLEEVE, `${at}.language.top.sleeve`), ...one(L.top.hem, HEM, `${at}.language.top.hem`)); }
  if (L.bottom !== undefined && L.bottom !== false) { if (typeof L.bottom !== 'object') errs.push(`${at}.language.bottom: { family, leg } or false`);
    else if (L.bottom.kind === 'skirt') errs.push(...one(L.bottom.family, FAMILY, `${at}.language.bottom.family`), ...one(L.bottom.leg, SKIRT, `${at}.language.bottom.leg`), ...one(L.bottom.cut, CUT, `${at}.language.bottom.cut`));
    else if (L.bottom.kind !== undefined && L.bottom.kind !== 'trousers') errs.push(`${at}.language.bottom.kind: 'trousers' (the default) or 'skirt'`);
    else errs.push(...one(L.bottom.family, FAMILY, `${at}.language.bottom.family`), ...one(L.bottom.leg, LEG, `${at}.language.bottom.leg`)); }
  if (L.dress !== undefined && typeof L.dress !== 'boolean') errs.push(`${at}.language.dress: true or false`);
  if (L.dress && L.bottom?.kind !== 'skirt') errs.push(`${at}.language.dress: a dress is a top and a skirt (bottom.kind 'skirt')`);
  errs.push(...one(L.feet, FEET, `${at}.language.feet`), ...one(L.focal, FOCAL, `${at}.language.focal`));
  if (L.tuck !== undefined && typeof L.tuck !== 'boolean') errs.push(`${at}.language.tuck: true or false`);
  if (card.tones !== undefined && !(card.tones && typeof card.tones === 'object' && Object.values(card.tones).every(isHex))) errs.push(`${at}.tones: { group: '#rrggbb' }`);
  return errs;
}
