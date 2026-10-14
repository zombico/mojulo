// outfit/styles — the seeded outfit cards. PURE DATA: every card is plain JSON (the test round-trips each one), so an
// agent can read one, copy it, and author its own inline as `outfit.style`. A style is only a SAMPLE, a preset over the
// dials and the language (principles.js): a new look is a new card, not code.
//
// A card:
//   dials     { stylize, fit, coverage, ornament } — the defaults a build's own `dials` override
//   language  top:    { family: 'knit' | 'woven', sleeve, hem, collar: true|false } | false (no top)
//             bottom: { family, leg, cut?: skinny | tapered (default) | straight | wide } | { kind: 'skirt', family, leg: micro | mini | knee | midi | maxi, cut: pencil | aline |
//             full, rigidity?: shell | stiff | crisp | soft | flowing | 0 … 1 (how the skirt moves: rigidity.js) } | false
//             outer:  { family, sleeve, hem: waist | hip | tunic | knee | midi | maxi, open: true|false, cut?: pencil | aline |
//             full } | false: a layer over the top and the bottom (a vest or jerkin without sleeves, a jacket, a coat)
//             panels: [{ at: back | front | sides | sideR | sideL, length: micro … maxi, width?: 0–1 (a share of the half
//             turn, default 0.33), split?: 1 | 2 (two tails side by side), cut?, family?, rigidity? (default 'soft') }]: DRAPE
//             PANELS hung from the waist over everything else (coattails, a tabard's apron, tassets, a loincloth)
//             girth:  on top, trousers and outer: { chest | waist | hip | thigh | knee | calf | ankle | bicep | elbow | forearm |
//             wrist: cm } — the girth the cloth adds over the body at that landmark (0 on the skin), the rest in proportion
//             fit:    on top, trousers and outer: 'skin' (painted second skin; not the outer) | 'fitted' | 'eased' (the
//             dials' cut, the default) | 'loose': law 2 zone by zone, so an outfit can be tight in one place and full in another
//             dress:  true (the skirt is the top's own cloth: one garment, no waistband, the belt its focal) | false
//             feet:   'boots' | 'shoes' | 'none'
//             tuck:   true (the top tucked in, the bottom over its tail) | false (worn out over the bottom)
//             focal:  'collar' | 'placket' | 'belt' (law 5; defaults to the woven top's placket, else the belt)
//             (sleeve, hem and leg are LENGTHS words: principles.js)
//   tones     group → '#hex': Top, Bottom, Shoes and the construction's (Trim, Placket, Button, Seam, Waistband,
//             Leather, Buckle), suggested beneath the operator's own palette; the rest derive from Top and Bottom

import { rigidityErrors } from '../polygonizer/rigidity.js';
import { GIRTH_LANDMARKS } from '../polygonizer/body-garment.js';
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
  // the anime silhouette (principles law 2): a close body, the waist marked, the flow in panels cut to hang
  traveler: {
    "id": "traveler",
    "dials": { "stylize": 0.5, "fit": 0.3, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "long", "hem": "waist", "fit": "skin" }, "bottom": { "family": "woven", "leg": "long", "cut": "tapered", "fit": "fitted" },
      "outer": { "family": "woven", "sleeve": "elbow", "hem": "waist", "open": true, "fit": "fitted" },
      "panels": [{ "at": "back", "length": "knee", "width": 0.45, "split": 2, "rigidity": "soft" }], "feet": "boots", "tuck": true, "focal": "belt" },
    "tones": { "Top": "#2b2d3a", "Bottom": "#3b3346", "Outer": "#e9e2d0", "Panel": "#e9e2d0", "Trim": "#c9a55a", "Shoes": "#3a2a1e", "Leather": "#4a3324", "Buckle": "#d8c27a" }
  },
  warden: {
    "id": "warden",
    "dials": { "stylize": 0.4, "fit": 0.35, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "fit": "fitted" }, "bottom": { "family": "woven", "leg": "long", "cut": "skinny" },
      "panels": [{ "at": "front", "length": "knee", "width": 0.3, "rigidity": "crisp" }, { "at": "back", "length": "knee", "width": 0.36, "rigidity": "crisp" }, { "at": "sides", "length": "mini", "width": 0.32, "rigidity": "stiff" }], "feet": "boots", "tuck": true, "focal": "belt" },
    "tones": { "Top": "#d9d4c4", "Bottom": "#2e3440", "Panel": "#5b2a2a", "Trim": "#c9a55a", "Shoes": "#2a211b", "Leather": "#3d2a1d", "Buckle": "#c9b37a" }
  },
  adventurer: {
    "id": "adventurer",
    "dials": { "stylize": 0.45, "fit": 0.7, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "threeQuarter", "hem": "tunic" }, "bottom": { "family": "woven", "leg": "long" }, "feet": "boots", "tuck": false, "focal": "belt" },
    "tones": { "Top": "#8a9a5b", "Bottom": "#4a3f33", "Shoes": "#3a2a1e", "Leather": "#6a4327", "Buckle": "#c9a55a" }
  },
});

const FAMILY = ['knit', 'woven'], SLEEVE = ['none', 'cap', 'short', 'elbow', 'threeQuarter', 'long'], HEM = ['crop', 'waist', 'hip', 'tunic'];
const COAT = ['waist', 'hip', 'tunic', 'knee', 'midi', 'maxi'], FITS = ['skin', 'fitted', 'eased', 'loose'];
const PANEL_AT = ['back', 'front', 'sides', 'sideR', 'sideL'], TCUT = ['skinny', 'tapered', 'straight', 'wide'], LEG = ['brief', 'short', 'knee', 'capri', 'long'], SKIRT = ['micro', 'mini', 'knee', 'midi', 'maxi'], CUT = ['pencil', 'aline', 'full'], FEET = ['boots', 'shoes', 'none'], FOCAL = ['collar', 'placket', 'belt'];
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
    else if (L.bottom.kind === 'skirt') errs.push(...one(L.bottom.family, FAMILY, `${at}.language.bottom.family`), ...one(L.bottom.leg, SKIRT, `${at}.language.bottom.leg`), ...one(L.bottom.cut, CUT, `${at}.language.bottom.cut`), ...rigidityErrors(L.bottom.rigidity, `${at}.language.bottom.rigidity`));
    else if (L.bottom.kind !== undefined && L.bottom.kind !== 'trousers') errs.push(`${at}.language.bottom.kind: 'trousers' (the default) or 'skirt'`);
    else errs.push(...one(L.bottom.family, FAMILY, `${at}.language.bottom.family`), ...one(L.bottom.leg, LEG, `${at}.language.bottom.leg`), ...one(L.bottom.cut, TCUT, `${at}.language.bottom.cut`)); }
  if (L.outer !== undefined && L.outer !== false) { if (typeof L.outer !== 'object') errs.push(`${at}.language.outer: { family, sleeve, hem, open?, cut? } or false`);
    else { errs.push(...one(L.outer.family, FAMILY, `${at}.language.outer.family`), ...one(L.outer.sleeve, SLEEVE, `${at}.language.outer.sleeve`), ...one(L.outer.hem, COAT, `${at}.language.outer.hem`), ...one(L.outer.cut, CUT, `${at}.language.outer.cut`));
      if (L.outer.open !== undefined && typeof L.outer.open !== 'boolean') errs.push(`${at}.language.outer.open: true or false`); } }
  if (L.panels !== undefined) { if (!Array.isArray(L.panels)) errs.push(`${at}.language.panels: a list of { at, length, width?, split?, cut?, family?, rigidity? }`);
    else L.panels.forEach((Q, i) => { const w = `${at}.language.panels[${i}]`;
      if (!Q || typeof Q !== 'object' || Array.isArray(Q)) { errs.push(`${w}: { at, length, width?, split?, cut?, family?, rigidity? }`); return; }
      errs.push(...one(Q.at, PANEL_AT, `${w}.at`), ...one(Q.length, SKIRT, `${w}.length`), ...one(Q.cut, CUT, `${w}.cut`), ...one(Q.family, FAMILY, `${w}.family`), ...rigidityErrors(Q.rigidity, `${w}.rigidity`));
      if (Q.at === undefined) errs.push(`${w}.at: one of ${PANEL_AT.join(', ')}`);
      if (Q.width !== undefined && !(Number.isFinite(Q.width) && Q.width > 0 && Q.width <= 1)) errs.push(`${w}.width: a share of the half turn, 0 < width ≤ 1`);
      if (Q.split !== undefined && ![1, 2].includes(Q.split)) errs.push(`${w}.split: 1 or 2 (two tails side by side)`);
      for (const k of Object.keys(Q)) if (!['at', 'length', 'width', 'split', 'cut', 'family', 'rigidity'].includes(k)) errs.push(`${w}.${k}: not a panel field (at, length, width, split, cut, family, rigidity)`); }); }
  for (const k of ['top', 'bottom', 'outer']) { const G = L[k] && typeof L[k] === 'object' ? L[k].girth : undefined; if (G === undefined) continue;
    if (!(G && typeof G === 'object' && !Array.isArray(G) && Object.entries(G).every(([w, c]) => GIRTH_LANDMARKS.includes(w) && Number.isFinite(c) && c >= 0))) errs.push(`${at}.language.${k}.girth: { landmark: cm of girth over the body (≥ 0; 0 on the skin) } — landmarks ${GIRTH_LANDMARKS.join(', ')}`); }
  for (const [k, list] of [['top', FITS], ['bottom', FITS], ['outer', FITS.slice(1)]]) if (L[k] && typeof L[k] === 'object') errs.push(...one(L[k].fit, L[k].kind === 'skirt' ? [] : list, `${at}.language.${k}.fit`));
  if (L.dress !== undefined && typeof L.dress !== 'boolean') errs.push(`${at}.language.dress: true or false`);
  if (L.dress && L.bottom?.kind !== 'skirt') errs.push(`${at}.language.dress: a dress is a top and a skirt (bottom.kind 'skirt')`);
  errs.push(...one(L.feet, FEET, `${at}.language.feet`), ...one(L.focal, FOCAL, `${at}.language.focal`));
  if (L.tuck !== undefined && typeof L.tuck !== 'boolean') errs.push(`${at}.language.tuck: true or false`);
  if (card.tones !== undefined && !(card.tones && typeof card.tones === 'object' && Object.values(card.tones).every(isHex))) errs.push(`${at}.tones: { group: '#rrggbb' }`);
  return errs;
}
