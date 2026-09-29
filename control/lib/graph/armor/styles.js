// armor/styles — the seeded armour cards. PURE DATA: every card is plain JSON (the test round-trips each one), so an
// agent can read one, copy it, and author its own inline as `adorn.style`. A style is only a SAMPLE, a preset over the
// dials (principles.js): a new direction is a new card, not code.
//
// A card:
//   family    'plate' | 'lamellar' | 'hardsuit' — the construction (law 12), which picks the grammar and its coverage
//             order
//   dials     { stylize, mass, coverage, ornament } — the defaults a build's own `dials` override
//   language  plate: { pauldron: 'spaulder' | 'bell', focalSide: 'R' | 'L', fnSide: 'R' | 'L' } — the focal shoulder and
//             the arm that carries function (a bow arm takes the first bracer)
//             lamellar: { crest: 'crescent' | 'kuwagata' | 'sun' }
//             hardsuit: { helm: 'power' | 'trooper' | 'faceplate', pauldron: 'dome' | 'cap' | 'segmented', chest:
//             'plain' | 'reactor', pack: 'power' | 'none', segments: 1–3 (the panel lines), focal: 'helm' | 'pauldron' |
//             'reactor', focalSide }
//   tones     group → '#hex': the piece groups (plate: Plate, Trim, Rivet, Accent, Leather; lamellar: Lacquer, Odoshi,
//             Kanamono, Crest; hardsuit: Plate, Helm, Visor, Lens, Face, Trim, Emblem, Reactor, Suit) and the layer
//             beneath (Top, Bottom, Shoes) — law 10: one clear value step between them. Suggested beneath the
//             operator's own palette.
//   emissive  groups that render full-bright (lenses, a visor slit, a reactor) — law 5: the glow spends on the focal

export const ARMOR_FAMILIES = Object.freeze(['plate', 'lamellar', 'hardsuit']);
export const PAULDRONS = Object.freeze(['spaulder', 'bell']);
export const SIDES = Object.freeze(['R', 'L']);
const HARD = { helm: ['power', 'trooper', 'faceplate'], pauldron: ['dome', 'cap', 'segmented'], chest: ['plain', 'reactor'], pack: ['power', 'none'], focal: ['helm', 'pauldron', 'reactor'] };

export const SEEDED_ARMOR = Object.freeze({
  knight: {
    "id": "knight",
    "family": "plate",
    "dials": { "stylize": 0.35, "mass": 1, "coverage": 1, "ornament": 1 },
    "language": { "pauldron": "spaulder", "focalSide": "R", "fnSide": "L" },
    "tones": { "Plate": "#aeb4bb", "Trim": "#c9a55a", "Rivet": "#d7d2c4", "Accent": "#b98a44", "Top": "#3b3833", "Bottom": "#2e2b27", "Shoes": "#2a211a" }
  },
  "kuro-kon": {
    "id": "kuro-kon",
    "family": "lamellar",
    "dials": { "stylize": 0.2, "mass": 1, "coverage": 1, "ornament": 1 },
    "language": { "crest": "crescent" },
    "tones": { "Lacquer": "#1d1b1e", "Odoshi": "#2c4a9a", "Kanamono": "#caa24a", "Crest": "#d8b04c", "Top": "#6e5638", "Bottom": "#3a3430", "Shoes": "#2a2420" }
  },
  aka: {
    "id": "aka",
    "family": "lamellar",
    "dials": { "stylize": 0.2, "mass": 1, "coverage": 1, "ornament": 1 },
    "language": { "crest": "kuwagata" },
    "tones": { "Lacquer": "#9e2621", "Odoshi": "#c23a2c", "Kanamono": "#d4ab4a", "Crest": "#e0b84e", "Top": "#2e2a2a", "Bottom": "#262224", "Shoes": "#1e1a1a" }
  },
  shiro: {
    "id": "shiro",
    "family": "lamellar",
    "dials": { "stylize": 0.2, "mass": 1, "coverage": 1, "ornament": 1 },
    "language": { "crest": "sun" },
    "tones": { "Lacquer": "#1b1b1d", "Odoshi": "#e8e4da", "Kanamono": "#c9a048", "Crest": "#d9b24a", "Top": "#4a3f5e", "Bottom": "#2c2836", "Shoes": "#1e1a1a" }
  },
  // massive power armour: domed pauldrons (the focal one carries an emblem), a bulky moulded cuirass, a power pack,
  // a helm with glowing lenses and a grille
  "grim-scifi": {
    "id": "grim-scifi",
    "family": "hardsuit",
    "dials": { "stylize": 0.7, "mass": 1.35, "coverage": 1, "ornament": 2 },
    "language": { "helm": "power", "pauldron": "dome", "chest": "plain", "pack": "power", "segments": 1, "focal": "pauldron", "focalSide": "L" },
    "tones": { "Plate": "#34465e", "Helm": "#34465e", "Trim": "#b08d45", "Emblem": "#d9d2b8", "Lens": "#ff3b2a", "Suit": "#1b1c1f", "Top": "#1b1c1f", "Bottom": "#1b1c1f", "Shoes": "#161616" },
    "emissive": ["Lens"]
  },
  // minimal trooper plates over a dark bodysuit, a smooth helmet with a T-visor (the helm is the focal)
  "fantasy-space": {
    "id": "fantasy-space",
    "family": "hardsuit",
    "dials": { "stylize": 0.3, "mass": 0.9, "coverage": 0.6, "ornament": 0 },
    "language": { "helm": "trooper", "pauldron": "cap", "chest": "plain", "pack": "none", "segments": 1, "focal": "helm" },
    "tones": { "Plate": "#e8eaed", "Helm": "#eceef0", "Visor": "#15161a", "Trim": "#7d848c", "Suit": "#16171a", "Top": "#16171a", "Bottom": "#16171a", "Shoes": "#121214" },
    "emissive": []
  },
  // a modular powered suit: full segmented coverage, a faceplate helm with glowing eye slits, a glowing chest reactor
  "armored-hero": {
    "id": "armored-hero",
    "family": "hardsuit",
    "dials": { "stylize": 0.55, "mass": 1.05, "coverage": 1, "ornament": 1 },
    "language": { "helm": "faceplate", "pauldron": "segmented", "chest": "reactor", "pack": "none", "segments": 2, "focal": "reactor" },
    "tones": { "Plate": "#a31f1d", "Helm": "#a31f1d", "Face": "#d4a53a", "Trim": "#d4a53a", "Lens": "#eef6ff", "Reactor": "#bfe8ff", "Suit": "#2a2a2e", "Top": "#2a2a2e", "Bottom": "#2a2a2e", "Shoes": "#222226" },
    "emissive": ["Lens", "Reactor"]
  },
});

const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** Error strings for an inline card (form only). */
export function validateArmorCard(card, at = 'style') {
  const errs = [];
  if (!card || typeof card !== 'object' || Array.isArray(card)) return [`${at}: a sample name (${Object.keys(SEEDED_ARMOR).join(', ')}) or a card { family, dials?, language?, tones?, emissive? }`];
  if (!ARMOR_FAMILIES.includes(card.family)) errs.push(`${at}.family: one of ${ARMOR_FAMILIES.join(', ')}`);
  const L = card.language || {};
  if (card.family === 'plate') {
    if (L.pauldron !== undefined && !PAULDRONS.includes(L.pauldron)) errs.push(`${at}.language.pauldron: one of ${PAULDRONS.join(', ')}`);
    for (const k of ['focalSide', 'fnSide']) if (L[k] !== undefined && !SIDES.includes(L[k])) errs.push(`${at}.language.${k}: 'R' | 'L'`);
  }
  if (card.family === 'lamellar' && L.crest !== undefined && !['crescent', 'kuwagata', 'sun'].includes(L.crest)) errs.push(`${at}.language.crest: one of crescent, kuwagata, sun`);
  if (card.family === 'hardsuit') {
    for (const [k, vs] of Object.entries(HARD)) if (L[k] !== undefined && !vs.includes(L[k])) errs.push(`${at}.language.${k}: one of ${vs.join(', ')}`);
    if (L.segments !== undefined && !(Number.isInteger(L.segments) && L.segments >= 1 && L.segments <= 3)) errs.push(`${at}.language.segments: an integer 1–3 (the panel lines)`);
    if (L.focalSide !== undefined && !SIDES.includes(L.focalSide)) errs.push(`${at}.language.focalSide: 'R' | 'L'`);
  }
  for (const [g, v] of Object.entries(card.tones || {})) if (!isHex(v)) errs.push(`${at}.tones.${g}: a "#rrggbb" colour`);
  if (card.emissive !== undefined && !(Array.isArray(card.emissive) && card.emissive.every((g) => typeof g === 'string'))) errs.push(`${at}.emissive: a list of group names`);
  return errs;
}
