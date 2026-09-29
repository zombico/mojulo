// armor/styles — the seeded armour cards. PURE DATA: every card is plain JSON (the test round-trips each one), so an
// agent can read one, copy it, and author its own inline as `adorn.style`. A style is only a SAMPLE, a preset over the
// dials (principles.js): a new direction is a new card, not code.
//
// A card:
//   family    'plate' | 'lamellar' — the construction (law 12), which picks the grammar and its coverage order
//   dials     { stylize, mass, coverage, ornament } — the defaults a build's own `dials` override
//   language  plate: { pauldron: 'spaulder' | 'bell', focalSide: 'R' | 'L', fnSide: 'R' | 'L' } — the focal shoulder and
//             the arm that carries function (a bow arm takes the first bracer)
//             lamellar: { crest: 'crescent' | 'kuwagata' | 'sun' }
//   tones     group → '#hex': the piece groups (plate: Plate, Trim, Rivet, Accent, Leather; lamellar: Lacquer, Odoshi,
//             Kanamono, Crest) and the layer beneath (Top, Bottom, Shoes) — law 10: one clear value step between them.
//             Suggested beneath the operator's own palette.

export const ARMOR_FAMILIES = Object.freeze(['plate', 'lamellar']);
export const PAULDRONS = Object.freeze(['spaulder', 'bell']);
export const SIDES = Object.freeze(['R', 'L']);

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
});

const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** Error strings for an inline card (form only). */
export function validateArmorCard(card, at = 'style') {
  const errs = [];
  if (!card || typeof card !== 'object' || Array.isArray(card)) return [`${at}: a sample name (${Object.keys(SEEDED_ARMOR).join(', ')}) or a card { family, dials?, language?, tones? }`];
  if (!ARMOR_FAMILIES.includes(card.family)) errs.push(`${at}.family: one of ${ARMOR_FAMILIES.join(', ')}`);
  const L = card.language || {};
  if (card.family === 'plate') {
    if (L.pauldron !== undefined && !PAULDRONS.includes(L.pauldron)) errs.push(`${at}.language.pauldron: one of ${PAULDRONS.join(', ')}`);
    for (const k of ['focalSide', 'fnSide']) if (L[k] !== undefined && !SIDES.includes(L[k])) errs.push(`${at}.language.${k}: 'R' | 'L'`);
  }
  if (card.family === 'lamellar' && L.crest !== undefined && !['crescent', 'kuwagata', 'sun'].includes(L.crest)) errs.push(`${at}.language.crest: one of crescent, kuwagata, sun`);
  for (const [g, v] of Object.entries(card.tones || {})) if (!isHex(v)) errs.push(`${at}.tones.${g}: a "#rrggbb" colour`);
  return errs;
}
