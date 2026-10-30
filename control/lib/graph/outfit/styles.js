// outfit/styles — the seeded outfit cards. PURE DATA: every card is plain JSON (the test round-trips each one), so an
// agent can read one, copy it, and author its own inline as `outfit.style`. A style is only a SAMPLE, a preset over the
// dials and the language (principles.js): a new look is a new card, not code.
//
// A card:
//   dials     { stylize, fit, coverage, ornament } — the defaults a build's own `dials` override
//   language  top:    { family: 'knit' | 'woven', sleeve, hem, collar?, cloth? } | false (no top); `collar` false, true (a
//             collared shirt, closed), 'band' (the stand and its V, open), 'turtle' (the stand round and tall, rolled),
//             'shirt' (the stand and its fall, the points an M, closed) or { kind, open? } (polygonizer/shirt-collar.js); `cloth` on the
//             top, the bottom and the outer one of CLOTH_WORDS (how it folds and shines; on the realistic body's lit export
//             its surface: `knit` a sweater, `cable` a cable knit); `pattern` on the top, the bottom, the outer and the
//             waistcoat one of PATTERN_WORDS or { kind, scale?, contrast? } (herringbone, houndstooth, plaid, pinstripe …:
//             on the realistic body's lit export its relief and its colour; or a camouflage, CAMO_WORDS: woodland,
//             dpm, tiger, flecktarn …, its marks painted on either body: outfit/camouflage.js)
//             head:   a helmet (headgear/helmets.js HELMETS: m1, stahlhelm, brodie, ssh40, adrian, pasgt, ach, highcut) or
//             { helmet, cover?: true | a camouflage, band?, net?, nvg? }: worn on the head, the hair dropped under it
//             bottom: { family, leg, cut?: skinny | tapered (default) | straight | wide | breeches (full at the thigh, close from
//             the knee: the riding and the soldier's galife), into?: 'boots' (tucked: the leg ends at the top of the boot's
//             shaft or its puttees, bloused over it), pockets?: 'cargo' (a flapped pocket on each thigh) } | { kind: 'skirt', family, leg: micro | mini | knee | midi | maxi, cut: pencil | aline |
//             full, rigidity?: shell | stiff | crisp | soft | flowing | 0 … 1 (how the skirt moves: rigidity.js) } | false
//             outer:  { family, sleeve, hem: waist | hip | tunic | knee | midi | maxi, open: true|false, cut?: pencil | aline |
//             full } | false: a layer over the top and the bottom (a vest or jerkin without sleeves, a jacket, a coat);
//             a tailored FRONT (the tailor's, on either body: tailored-front.js): front?: single | double (one
//             row of buttons, or two with the fronts overlapped), lapel?: notch | peak | shawl | none (none: the stand
//             collar), buttons?: 1 | 2 | 3 (in a row); any of them gives the jacket a V onto the shirt, its lapels and its
//             buttons (single with a notch lapel, double with a peak, unless named); its SHAPE: shoulder?: natural |
//             structured (squared on a pad), waist?: suppressed (taken in) | straight (a sack, chest to hip); its
//             CONSTRUCTION (a jacket's, on either body: body-relational-jacket.js, authored-jacket.js): front: 'zip' (closed on a zip
//             down the centre, no V), collar: 'shirt' (a falling collar, its points snapped to the chest; true the stand
//             collar), rib?: cuffs | waist | both (knit rib bands, the body and the sleeves bloused over them),
//             pockets?: flap (patch pockets low on the front, each under a flap with a snap), epaulettes?: true (a strap
//             over each shoulder buttoned at the collar), cloth?: leather or a cloth word (how it folds and shines)
//             panels: [{ at: back | front | sides | sideR | sideL, length: micro … maxi, width?: 0–1 (a share of the half
//             turn, default 0.33), split?: 1 | 2 (two tails side by side), cut?, family?, rigidity? (default 'soft') }]: DRAPE
//             PANELS hung from the waist over everything else (coattails, a tabard's apron, tassets, a loincloth)
//             girth:  on top, trousers and outer: { chest | waist | hip | thigh | knee | calf | ankle | bicep | elbow | forearm |
//             wrist: cm } — the girth the cloth adds over the body at that landmark (0 on the skin), the rest in proportion
//             fit:    on top, trousers and outer: 'skin' (painted second skin; not the outer) | 'fitted' | 'eased' (the
//             dials' cut, the default) | 'loose': law 2 zone by zone, so an outfit can be tight in one place and full in another
//             dress:  true (the skirt is the top's own cloth: one garment, no waistband, the belt its focal) | false
//             feet:   'boots' | 'shoes' | 'none', or a footwear card's name (footwear/styles.js: combatBoots, jungleBoots,
//                     jackboots …), worn by the footwear library on either body
//             tuck:   true (the top tucked in, the bottom over its tail) | false (worn out over the bottom)
//             tie:    true (a tie on the shirt from its collar to the belt, under a closed jacket) |
//             false
//             waistcoat: true | { front?: 'single' | 'double', buttons?: 3–6 } (a waistcoat over the shirt and the tie and
//             under the jacket, from the chest to below the waist, worn without a belt; its V and its buttons the realistic
//             body's) | false
//             focal:  'collar' | 'placket' | 'belt' (law 5; defaults to the woven top's placket, else the belt)
//             (sleeve, hem and leg are LENGTHS words: principles.js)
//   tones     group → '#hex': Top, Bottom, Shoes and the construction's (Trim, Placket, Button, Seam, Waistband,
//             Leather, Buckle), suggested beneath the operator's own palette; the rest derive from Top and Bottom

import { rigidityErrors } from '../polygonizer/rigidity.js';
import { GIRTH_LANDMARKS } from '../polygonizer/body-garment.js';
import { FOOTWEAR } from '../footwear/styles.js';
import { CAMOS } from './camouflage.js';
import { validateHead } from '../headgear/helmets.js';

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
  // THE MODERN AND FUTURE WARDROBE (the setting's era: egocube/outfit.js ERA_LOOKS rolls one per person): a leather
  // jacket, tactical clothes, fatigues, a suit, an operative's coat, streetwear; a flight suit, a runner's cropped jacket,
  // a corporate long coat. Each is a cut in the same grammar; what it is MADE of is its tones (a leather jacket is a short
  // fitted jacket in black hide)
  biker: {
    "id": "biker",
    "dials": { "stylize": 0.25, "fit": 0.35, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "short", "hem": "hip" }, "bottom": { "family": "woven", "leg": "long", "cut": "skinny", "fit": "fitted" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "waist", "open": true, "fit": "fitted", "collar": true }, "feet": "boots", "tuck": false, "focal": "collar" },
    "tones": { "Outer": "#1e1b19", "Top": "#d9d5cc", "Bottom": "#2f3d57", "Shoes": "#1a1612", "Leather": "#1e1b19", "Buckle": "#c9c9c9" }
  },
  // a FLIGHT JACKET (the A-2): brown leather to the belt on a knit rib waistband and rib cuffs, closed on a zip, a shirt
  // collar with snapped points, a flapped patch pocket on each front, epaulettes; over a tee and work trousers
  flight: {
    "id": "flight",
    "dials": { "stylize": 0.2, "fit": 0.45, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "short", "hem": "hip", "fit": "fitted" }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "fit": "eased" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "hip", "fit": "eased", "collar": "shirt", "front": "zip", "rib": "both", "pockets": "flap", "epaulettes": true, "cloth": "leather" }, "feet": "boots", "tuck": true, "focal": "collar" },
    "tones": { "Outer": "#5a3a24", "Rib": "#2e2219", "Top": "#3f4436", "Bottom": "#75664c", "Shoes": "#2b241c", "Leather": "#3a2617", "Buckle": "#8f8676" }
  },
  tactical: {
    "id": "tactical",
    "dials": { "stylize": 0.2, "fit": 0.55, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "long", "hem": "hip", "fit": "fitted" }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "fit": "eased", "girth": { "thigh": 6, "knee": 4 } },
      "feet": "boots", "tuck": true, "focal": "belt" },
    "tones": { "Top": "#3f4436", "Bottom": "#75664c", "Shoes": "#2b241c", "Leather": "#2b2622", "Buckle": "#5c5c58" }
  },
  fatigues: {
    "id": "fatigues",
    "dials": { "stylize": 0.15, "fit": 0.6, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "girth": { "thigh": 5 } },
      "feet": "boots", "tuck": false, "focal": "placket" },
    "tones": { "Top": "#5b6442", "Bottom": "#4f5638", "Shoes": "#231d17", "Button": "#3a3d2a", "Leather": "#2b2622", "Buckle": "#5c5c58" }
  },
  suit: {
    "id": "suit",
    "dials": { "stylize": 0.1, "fit": 0.35, "coverage": 1, "ornament": 3 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true }, "bottom": { "family": "woven", "leg": "long", "cut": "straight" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "hip", "open": false, "fit": "fitted", "collar": true }, "feet": "shoes", "tuck": true, "focal": "collar" },
    "tones": { "Outer": "#24272f", "Top": "#eef0f3", "Bottom": "#24272f", "Shoes": "#141110", "Button": "#2a2a2a", "Leather": "#141110", "Buckle": "#b9b9b9" }
  },
  operative: {
    "id": "operative",
    "dials": { "stylize": 0.3, "fit": 0.25, "coverage": 1, "ornament": 1 },
    "language": { "top": { "family": "knit", "sleeve": "long", "hem": "hip", "fit": "fitted", "collar": true }, "bottom": { "family": "woven", "leg": "long", "cut": "skinny", "fit": "fitted" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "knee", "open": false, "fit": "fitted", "collar": true }, "feet": "boots", "tuck": true, "focal": "collar" },
    "tones": { "Outer": "#2e2b28", "Top": "#17181c", "Bottom": "#17181c", "Shoes": "#111111", "Leather": "#111111", "Buckle": "#8d8d8d" }
  },
  streetwear: {
    "id": "streetwear",
    "dials": { "stylize": 0.3, "fit": 0.75, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "long", "hem": "hip", "fit": "loose" }, "bottom": { "family": "woven", "leg": "long", "cut": "wide", "fit": "loose" },
      "feet": "shoes", "tuck": false, "focal": "collar" },
    "tones": { "Top": "#8b919b", "Bottom": "#2c323d", "Shoes": "#f1f1f1", "Trim": "#f1f1f1" }
  },
  flightsuit: {
    "id": "flightsuit",
    "dials": { "stylize": 0.3, "fit": 0.2, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "long", "hem": "hip", "fit": "fitted", "collar": true }, "bottom": { "family": "knit", "leg": "long", "cut": "straight", "fit": "fitted" },
      "feet": "boots", "tuck": true, "focal": "belt" },
    "tones": { "Top": "#3c4a5c", "Bottom": "#3c4a5c", "Shoes": "#20242a", "Trim": "#e0a43a", "Leather": "#20242a", "Buckle": "#c9ced6" }
  },
  runner: {
    "id": "runner",
    "dials": { "stylize": 0.45, "fit": 0.3, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "long", "hem": "hip", "fit": "skin" }, "bottom": { "family": "woven", "leg": "long", "cut": "skinny", "fit": "fitted" },
      "outer": { "family": "woven", "sleeve": "elbow", "hem": "waist", "open": true, "fit": "fitted", "collar": true }, "feet": "boots", "tuck": true, "focal": "collar" },
    "tones": { "Outer": "#b8325f", "Top": "#141519", "Bottom": "#141519", "Shoes": "#141519", "Trim": "#38e0d0", "Leather": "#141519", "Buckle": "#38e0d0" }
  },
  corporate: {
    "id": "corporate",
    "dials": { "stylize": 0.25, "fit": 0.3, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "knit", "sleeve": "long", "hem": "hip", "fit": "fitted", "collar": true }, "bottom": { "family": "woven", "leg": "long", "cut": "straight" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "knee", "open": true, "fit": "fitted", "collar": true }, "feet": "shoes", "tuck": true, "focal": "collar" },
    "tones": { "Outer": "#e8eaee", "Top": "#2a2e36", "Bottom": "#2a2e36", "Shoes": "#e8eaee", "Trim": "#7fb2ff", "Leather": "#2a2e36", "Buckle": "#c9ced6" }
  },
  // the BUSINESS SUITS: a closed jacket over a shirt and tie, its front made by the tailor on either body (a V, lapels,
  // the right front over the left; on the game body its lapels alone, no collar on it nor the shirt's under it)
  business: {
    "id": "business",
    "dials": { "stylize": 0.1, "fit": 0.3, "coverage": 1, "ornament": 3 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true, "fit": "fitted" }, "bottom": { "family": "woven", "leg": "long", "cut": "tapered", "fit": "fitted" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "tunic", "open": false, "fit": "fitted", "collar": true, "front": "single", "lapel": "notch", "buttons": 2 , "shoulder": "structured", "waist": "suppressed" }, "feet": "shoes", "tuck": true, "focal": "collar", "tie": true },
    "tones": { "Outer": "#1f2a44", "Top": "#f6f7f9", "Bottom": "#1f2a44", "Tie": "#6b1d2a", "Shoes": "#3b2416", "Button": "#15181f", "Leather": "#3b2416", "Buckle": "#c9a24a", "Trim": "#1f2a44" }
  },
  doublebreasted: {
    "id": "doublebreasted",
    "dials": { "stylize": 0.1, "fit": 0.3, "coverage": 1, "ornament": 3 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true, "fit": "fitted" }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "fit": "fitted" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "tunic", "open": false, "fit": "fitted", "collar": true, "front": "double", "lapel": "peak", "buttons": 3 , "shoulder": "structured", "waist": "suppressed" }, "feet": "shoes", "tuck": true, "focal": "collar", "tie": true },
    "tones": { "Outer": "#3a3d42", "Top": "#cfdcec", "Bottom": "#3a3d42", "Tie": "#1d2b4a", "Shoes": "#141110", "Button": "#22252a", "Leather": "#141110", "Buckle": "#b9b9b9", "Trim": "#3a3d42" }
  },
  // a THREE-PIECE: the business suit's cloth in a waistcoat between the shirt and the jacket (its V shows between the
  // lapels, its buttons down it), worn without a belt
  threepiece: {
    "id": "threepiece",
    "dials": { "stylize": 0.1, "fit": 0.3, "coverage": 1, "ornament": 3 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true, "fit": "fitted" }, "bottom": { "family": "woven", "leg": "long", "cut": "tapered", "fit": "fitted" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "tunic", "open": false, "fit": "fitted", "collar": true, "front": "single", "lapel": "notch", "buttons": 2 , "shoulder": "structured", "waist": "suppressed" }, "feet": "shoes", "tuck": true, "focal": "collar", "tie": true, "waistcoat": true },
    "tones": { "Outer": "#4a4e57", "Waistcoat": "#4a4e57", "Top": "#f4f1ea", "Bottom": "#4a4e57", "Tie": "#7a5a1e", "Shoes": "#2a1a10", "Button": "#1d1f24", "Leather": "#2a1a10", "Buckle": "#c9a24a", "Trim": "#4a4e57" }
  },
  // (a woman's: her jacket's left front over her right, as hers close; a pencil skirt or wide trousers)
  skirtsuit: {
    "id": "skirtsuit",
    "dials": { "stylize": 0.1, "fit": 0.3, "coverage": 1, "ornament": 3 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true, "fit": "fitted" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "knee", "cut": "pencil" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "tunic", "open": false, "fit": "fitted", "collar": true, "front": "single", "lapel": "notch", "buttons": 1 , "shoulder": "natural", "waist": "suppressed" }, "feet": "shoes", "tuck": true, "focal": "collar" },
    "tones": { "Outer": "#1f2a44", "Top": "#f6f7f9", "Bottom": "#1f2a44", "Shoes": "#111111", "Button": "#15181f", "Leather": "#111111", "Buckle": "#c9a24a", "Trim": "#1f2a44" }
  },
  trousersuit: {
    "id": "trousersuit",
    "dials": { "stylize": 0.1, "fit": 0.3, "coverage": 1, "ornament": 3 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true, "fit": "fitted" }, "bottom": { "family": "woven", "leg": "long", "cut": "wide", "fit": "eased" },
      "outer": { "family": "woven", "sleeve": "long", "hem": "tunic", "open": false, "fit": "fitted", "collar": true, "front": "double", "lapel": "peak", "buttons": 2 , "shoulder": "structured", "waist": "suppressed" }, "feet": "shoes", "tuck": true, "focal": "collar" },
    "tones": { "Outer": "#141416", "Top": "#f1ece1", "Bottom": "#141416", "Shoes": "#0b0b0b", "Button": "#c9a24a", "Leather": "#0b0b0b", "Buckle": "#c9a24a", "Trim": "#141416" }
  },
  // the soldier, by tradition, from the boots up: jungle fatigues; the woodland, desert and DPM camouflage uniforms; the
  // Soviet gymnastyorka and galife breeches in kirza boots; the field-grey tunic in jackboots; battledress over puttees
  jungle: {
    "id": "jungle",
    "dials": { "stylize": 0.15, "fit": 0.6, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "into": "boots", "pockets": "cargo" },
      "head": { "helmet": "m1", "band": true }, "feet": "jungleBoots", "tuck": false, "focal": "placket" },
    "tones": { "Top": "#4f5735", "Bottom": "#454c2f", "Button": "#2f3322", "Leather": "#2b2622", "Buckle": "#5c5c58" }
  },
  bdu: {
    "id": "bdu",
    "dials": { "stylize": 0.15, "fit": 0.6, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true, "pattern": "woodland" }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "into": "boots", "pockets": "cargo", "pattern": "woodland" },
      "head": { "helmet": "pasgt", "cover": true }, "feet": "combatBoots", "tuck": false, "focal": "placket" },
    "tones": { "Button": "#2f3322", "Leather": "#1e1c19", "Buckle": "#4a4a46" }
  },
  desertbdu: {
    "id": "desertbdu",
    "dials": { "stylize": 0.15, "fit": 0.6, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true, "pattern": "desert" }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "into": "boots", "pockets": "cargo", "pattern": "desert" },
      "head": { "helmet": "pasgt", "cover": true }, "feet": "desertBoots", "tuck": false, "focal": "placket" },
    "tones": { "Button": "#8d7d5c", "Leather": "#7a6446", "Buckle": "#6b6656" }
  },
  dpm: {
    "id": "dpm",
    "dials": { "stylize": 0.15, "fit": 0.6, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true, "pattern": "dpm" }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "into": "boots", "pockets": "cargo", "pattern": "dpm" },
      "head": { "helmet": "pasgt", "cover": true }, "feet": "combatBoots", "tuck": false, "focal": "placket" },
    "tones": { "Button": "#3a3d2a", "Leather": "#1e1c19", "Buckle": "#4a4a46" }
  },
  galife: {
    "id": "galife",
    "dials": { "stylize": 0.15, "fit": 0.6, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": { "kind": "band", "open": false }}, "bottom": { "family": "woven", "leg": "long", "cut": "breeches", "into": "boots" },
      "head": "ssh40", "feet": "kirzaBoots", "tuck": false, "focal": "belt" },
    "tones": { "Top": "#8a8257", "Bottom": "#5d5838", "Button": "#6f6a40", "Leather": "#4a3423", "Buckle": "#a08a4e" }
  },
  feldgrau: {
    "id": "feldgrau",
    "dials": { "stylize": 0.15, "fit": 0.6, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "hip", "collar": true }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "into": "boots" },
      "head": "stahlhelm", "feet": "jackboots", "tuck": false, "focal": "belt" },
    "tones": { "Top": "#6a6e5d", "Bottom": "#4d5046", "Button": "#7c7c74", "Leather": "#1b1a18", "Buckle": "#77776f" }
  },
  battledress: {
    "id": "battledress",
    "dials": { "stylize": 0.15, "fit": 0.6, "coverage": 1, "ornament": 2 },
    "language": { "top": { "family": "woven", "sleeve": "long", "hem": "waist", "collar": true }, "bottom": { "family": "woven", "leg": "long", "cut": "straight", "into": "boots" },
      "head": { "helmet": "brodie", "net": true }, "feet": "putteeBoots", "tuck": true, "focal": "belt" },
    "tones": { "Top": "#79683f", "Bottom": "#655733", "Button": "#4c4126", "Leather": "#3b2c1f", "Buckle": "#9a8a5a" }
  }
});

const FAMILY = ['knit', 'woven'], SLEEVE = ['none', 'cap', 'short', 'elbow', 'threeQuarter', 'long'], HEM = ['crop', 'waist', 'hip', 'tunic'];
const COAT = ['waist', 'hip', 'tunic', 'knee', 'midi', 'maxi'], FITS = ['skin', 'fitted', 'eased', 'loose'];
/** a jacket's FRONT words (the tailor's, on either body): the fastening, the lapel, the buttons in a row */
export const OUTER_FRONTS = Object.freeze(['single', 'double', 'zip']), OUTER_LAPELS = Object.freeze(['notch', 'peak', 'shawl', 'none']);
/** a jacket's SHAPE words (the tailor's too): its shoulder and its waist */
export const OUTER_SHOULDERS = Object.freeze(['natural', 'structured']), OUTER_WAISTS = Object.freeze(['suppressed', 'straight']);
/** a jacket's CONSTRUCTION words (either body's: body-relational-jacket.js, authored-jacket.js): its rib bands, its pockets, the cloth */
export const OUTER_RIBS = Object.freeze(['cuffs', 'waist', 'both']), OUTER_POCKETS = Object.freeze(['flap', 'none']), OUTER_CLOTHS = Object.freeze(['leather', 'canvas', 'wool', 'denim', 'nylon', 'cotton']);
/** the cloth a layer may name (`cloth`, on the top, the bottom or the outer): how it folds and shines, and on the realistic
 * body's lit export its surface (epidermis/cloth-relief.js): `knit` a sweater's stockinette, its stitches in columns down
 * it; `cable` a cable knit, ropes crossing down it between purl channels; `jersey` a fine knit; the rest woven or hide */
export const CLOTH_WORDS = Object.freeze([...OUTER_CLOTHS, 'twill', 'jersey', 'knit', 'cable', 'silk']);
/** the pattern a layer may be woven or worked in (`pattern`, on the top, the bottom, the outer or the waistcoat: a name or
 * { kind, scale?, contrast? }): on the realistic body's lit export, its relief and its colour (epidermis/cloth-relief.js
 * PATTERNS, its names these) */
export const WEAVE_WORDS = Object.freeze(['herringbone', 'houndstooth', 'plaid', 'gingham', 'pinstripe', 'chalkstripe', 'corduroy', 'quilted', 'waffle', 'tweed']);
/** and the camouflages it may be printed in (outfit/camouflage.js CAMOS, its names these): marks of field paint over its
 * ground, on either body */
export const CAMO_WORDS = Object.freeze(Object.keys(CAMOS));
export const PATTERN_WORDS = Object.freeze([...WEAVE_WORDS, ...CAMO_WORDS]);
/** a top's collar: false none, true a collared shirt (closed), a kind (COLLAR_WORDS: band, the stand and its V, open;
 * turtle, the stand round and tall, its top rolled; shirt, the stand and its fall, the points an M, closed), or
 * { kind, open? } (polygonizer/shirt-collar.js) */
export const COLLAR_WORDS = Object.freeze(['band', 'turtle', 'shirt']);   // (outfit/collar.js COLLAR_KINDS' names)
const collarErrors = (w, at) => {
  if (w === undefined || w === true || w === false) return [];
  const o = typeof w === 'string' ? { kind: w } : w;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return [`${at}: true, false, a kind (${COLLAR_WORDS.join(', ')}) or { kind, open? }`];
  return [...one(o.kind, COLLAR_WORDS, `${at}.kind`), ...(o.kind === undefined ? [`${at}.kind: one of ${COLLAR_WORDS.join(', ')}`] : []), ...(o.open !== undefined && typeof o.open !== 'boolean' ? [`${at}.open: true (its front parted) or false (closed, buttoned up)`] : [])];
};
const patternErrors = (w, at) => {
  if (w === undefined) return [];
  const o = typeof w === 'string' ? { kind: w } : w;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return [`${at}: a pattern's name or { kind, scale?, contrast? }`];
  return [...one(o.kind, PATTERN_WORDS, `${at}.kind`), ...(o.kind === undefined ? [`${at}.kind: one of ${PATTERN_WORDS.join(', ')}`] : []),
    ...(o.scale !== undefined && !(Number.isFinite(o.scale) && o.scale > 0 && o.scale <= 8) ? [`${at}.scale: a size's multiple, 0 < scale ≤ 8`] : []),
    ...(o.contrast !== undefined && !(Number.isFinite(o.contrast) && o.contrast >= 0 && o.contrast <= 1.5) ? [`${at}.contrast: 0 (none) … 1 (as woven) … 1.5`] : [])];
};
const PANEL_AT = ['back', 'front', 'sides', 'sideR', 'sideL'], TCUT = ['skinny', 'tapered', 'straight', 'wide', 'breeches'], LEG = ['brief', 'short', 'knee', 'capri', 'long'], SKIRT = ['micro', 'mini', 'knee', 'midi', 'maxi'], CUT = ['pencil', 'aline', 'full'], FEET = ['boots', 'shoes', 'none'], FOCAL = ['collar', 'placket', 'belt'];
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const one = (v, list, at) => (v === undefined || list.includes(v) ? [] : [`${at}: '${v}' — one of ${list.join(', ')}`]);

/** Validate a card → error strings naming the choices (`at` prefixes them) */
export function validateOutfitCard(card, at = 'outfit.style') {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return [`${at}: a card { dials?, language, tones? }`];
  const errs = [], L = card.language ?? {};
  if (typeof L !== 'object' || Array.isArray(L)) return [`${at}.language: { top, bottom, feet, tuck, focal }`];
  if (L.top !== undefined && L.top !== false) { if (typeof L.top !== 'object') errs.push(`${at}.language.top: { family, sleeve, hem, collar? } or false`);
    else errs.push(...one(L.top.family, FAMILY, `${at}.language.top.family`), ...one(L.top.sleeve, SLEEVE, `${at}.language.top.sleeve`), ...one(L.top.hem, HEM, `${at}.language.top.hem`), ...one(L.top.cloth, CLOTH_WORDS, `${at}.language.top.cloth`), ...collarErrors(L.top.collar, `${at}.language.top.collar`)); }
  if (L.bottom !== undefined && L.bottom !== false) { if (typeof L.bottom !== 'object') errs.push(`${at}.language.bottom: { family, leg } or false`);
    else if (L.bottom.kind === 'skirt') errs.push(...one(L.bottom.family, FAMILY, `${at}.language.bottom.family`), ...one(L.bottom.leg, SKIRT, `${at}.language.bottom.leg`), ...one(L.bottom.cut, CUT, `${at}.language.bottom.cut`), ...rigidityErrors(L.bottom.rigidity, `${at}.language.bottom.rigidity`));
    else if (L.bottom.kind !== undefined && L.bottom.kind !== 'trousers') errs.push(`${at}.language.bottom.kind: 'trousers' (the default) or 'skirt'`);
    else errs.push(...one(L.bottom.family, FAMILY, `${at}.language.bottom.family`), ...one(L.bottom.leg, LEG, `${at}.language.bottom.leg`), ...one(L.bottom.cut, TCUT, `${at}.language.bottom.cut`)); }
  if (L.bottom && typeof L.bottom === 'object') errs.push(...one(L.bottom.into, ['boots'], `${at}.language.bottom.into`), ...one(L.bottom.pockets, ['cargo', 'none'], `${at}.language.bottom.pockets`), ...one(L.bottom.cloth, CLOTH_WORDS, `${at}.language.bottom.cloth`), ...patternErrors(L.bottom.pattern, `${at}.language.bottom.pattern`));
  if (L.top && typeof L.top === 'object') errs.push(...patternErrors(L.top.pattern, `${at}.language.top.pattern`));
  if (L.outer && typeof L.outer === 'object') errs.push(...patternErrors(L.outer.pattern, `${at}.language.outer.pattern`));
  if (L.waistcoat && typeof L.waistcoat === 'object') errs.push(...one(L.waistcoat.cloth, CLOTH_WORDS, `${at}.language.waistcoat.cloth`), ...patternErrors(L.waistcoat.pattern, `${at}.language.waistcoat.pattern`));
  if (L.outer !== undefined && L.outer !== false) { if (typeof L.outer !== 'object') errs.push(`${at}.language.outer: { family, sleeve, hem, open?, cut? } or false`);
    else { errs.push(...one(L.outer.family, FAMILY, `${at}.language.outer.family`), ...one(L.outer.sleeve, SLEEVE, `${at}.language.outer.sleeve`), ...one(L.outer.hem, COAT, `${at}.language.outer.hem`), ...one(L.outer.cut, CUT, `${at}.language.outer.cut`));
      if (L.outer.open !== undefined && typeof L.outer.open !== 'boolean') errs.push(`${at}.language.outer.open: true or false`);
      errs.push(...one(L.outer.front, OUTER_FRONTS, `${at}.language.outer.front`), ...one(L.outer.lapel, OUTER_LAPELS, `${at}.language.outer.lapel`), ...one(L.outer.shoulder, OUTER_SHOULDERS, `${at}.language.outer.shoulder`), ...one(L.outer.waist, OUTER_WAISTS, `${at}.language.outer.waist`));
      errs.push(...one(L.outer.rib, OUTER_RIBS, `${at}.language.outer.rib`), ...one(L.outer.pockets, OUTER_POCKETS, `${at}.language.outer.pockets`), ...one(L.outer.cloth, CLOTH_WORDS, `${at}.language.outer.cloth`));
      if (L.outer.collar !== undefined && ![true, false, 'shirt'].includes(L.outer.collar)) errs.push(`${at}.language.outer.collar: true (a stand collar), 'shirt' (a falling collar, its points snapped) or false`);
      if (L.outer.epaulettes !== undefined && typeof L.outer.epaulettes !== 'boolean') errs.push(`${at}.language.outer.epaulettes: true or false`);
      if (L.outer.front === 'zip' && (L.outer.lapel !== undefined || L.outer.buttons !== undefined)) errs.push(`${at}.language.outer.front: 'zip' closes without lapels or buttons (leave lapel and buttons out)`);
      if (L.outer.buttons !== undefined && !(Number.isInteger(L.outer.buttons) && L.outer.buttons >= 1 && L.outer.buttons <= 3)) errs.push(`${at}.language.outer.buttons: 1, 2 or 3 (a row's, down the front)`); } }
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
  // (feet: the plain words, or a footwear library card by its name: footwear/styles.js FOOTWEAR, combatBoots, jungleBoots …)
  errs.push(...(L.feet === undefined || FEET.includes(L.feet) || FOOTWEAR[L.feet] ? [] : [`${at}.language.feet: '${L.feet}' — one of ${FEET.join(', ')}, or a footwear card (${Object.keys(FOOTWEAR).filter((w) => !FEET.includes(w)).slice(0, 8).join(', ')} …)`]), ...one(L.focal, FOCAL, `${at}.language.focal`));
  errs.push(...validateHead(L.head, `${at}.language.head`, Object.keys(CAMOS)));
  if (L.tuck !== undefined && typeof L.tuck !== 'boolean') errs.push(`${at}.language.tuck: true or false`);
  if (L.tie !== undefined && typeof L.tie !== 'boolean') errs.push(`${at}.language.tie: true or false (a tie on the shirt)`);
  if (L.waistcoat !== undefined && typeof L.waistcoat !== 'boolean') {
    const V = L.waistcoat, w = `${at}.language.waistcoat`;
    if (!(V && typeof V === 'object' && !Array.isArray(V))) errs.push(`${w}: true, false or { front?, buttons? }`);
    else { errs.push(...one(V.front, OUTER_FRONTS, `${w}.front`));
      if (V.buttons !== undefined && !(Number.isInteger(V.buttons) && V.buttons >= 3 && V.buttons <= 6)) errs.push(`${w}.buttons: a whole number, 3–6`);
      for (const k of Object.keys(V)) if (!['front', 'buttons'].includes(k)) errs.push(`${w}.${k}: not a waistcoat field (front, buttons)`); }
  }
  if (card.tones !== undefined && !(card.tones && typeof card.tones === 'object' && Object.values(card.tones).every(isHex))) errs.push(`${at}.tones: { group: '#rrggbb' }`);
  return errs;
}
