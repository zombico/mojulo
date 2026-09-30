// themes — a THEME carried down through every piece of a set (armour, and the gear it carries). PURE DATA: every card
// is plain JSON, so an agent can read one, copy it, and author its own inline. A theme is orthogonal to the armour's
// family and style: the family says how a suit is built, the style its proportions and palette, the theme WHAT IT SAYS.
//
// The laws (armor/principles.js carries 1–12):
//   13. A theme is a MOTIF VOCABULARY, not a skin: a primary motif, a secondary motif, an edge verb, a crest verb, a
//       glow and a material set, each seated on a role the family names (armor/theme.js).
//   14. The primary motif REPEATS WITH HIERARCHY: full size at the focal, then smaller at the anchors in a fixed order
//       (partner, chest, belt, knees, the gear's guard). The ornament budget sets how many anchors take it, never all.
//   15. The secondary motif is the FIELD'S ONE STRUCTURAL LINE (law 11): ribs where plate had a plain field.
//   16. The edge verb runs the edges it names; the crest verb stands ONLY on the crest line (the pauldron tops, the
//       helm's crown): the silhouette is where a theme is read from across a room.
//
// A card:
//   dials      over the style's defaults, under the build's own: a theme leans the structure (a top-heavy silhouette is
//              stylize and mass, not a new grammar)
//   language   per family, over the style's: { plate: { pauldron, focalSide }, … }
//   primary    { motif: 'skull' | 'boss', group, socket?, glow?: [anchors whose sockets glow], horns?: { anchor: 0–2 },
//              size? }
//   secondary  { motif: 'ribs', group, count? }
//   edge       one verb or a list: { motif: 'rim' | 'fur' | 'spikes' | 'studs', group, on: ['plates', 'cuffs', 'trims'] } — a
//              rim paints every plate's own edge (and retires the family's rolled-edge straps)
//   glyphs     { motif: 'runes', group, on: ['limbs', 'cuirass'] } — marks on the plain fields (a glow group reads as runes)
//   crest      { motif: 'spikes' | 'plume', group, profile?, count? }
//   helm       { n, pad, flare, muzzle, crown, visor, visorGroup, faceplate?, brow?, coronet?, group }
//   cloth      { tabard?: { group, hemGroup?, len?, w? } } — w: the half-width as a fraction of the torso ring half
//   tones      group → '#hex' over the style's; emissive: groups that render full-bright (law 5)

export const MOTIFS = Object.freeze({ primary: ['skull', 'boss'], secondary: ['ribs'], edge: ['rim', 'fur', 'spikes', 'studs'], crest: ['spikes', 'plume'], glyphs: ['runes'] });
export const ANCHORS = Object.freeze(['focal', 'partner', 'chest', 'belt', 'knees', 'guard']);
export const EDGES = Object.freeze(['plates', 'cuffs', 'trims']);
export const FIELDS = Object.freeze(['limbs', 'cuirass']);

export const THEMES = Object.freeze({
  // the undead champion: skulls down the suit from the focal pauldron, a ribcage on the abdomen, a spiked crown and
  // spiked pauldron crests, frost glow in a shadowed face, fur at the cuffs, a dark cloth tabard
  'death-knight': {
    "id": "death-knight",
    "dials": { "stylize": 0.85, "mass": 1.05, "ornament": 3 },
    "language": { "plate": { "pauldron": "spaulder" } },
    "primary": { "motif": "skull", "group": "Bone", "socket": "Socket", "glow": ["focal", "guard"], "horns": { "knees": 1 } },
    "secondary": { "motif": "ribs", "group": "Bone", "count": 4 },
    "edge": [{ "motif": "rim", "group": "Trim", "on": ["plates"] }, { "motif": "fur", "group": "Fur", "on": ["cuffs"] }],
    "glyphs": { "motif": "runes", "group": "Glow", "on": ["limbs"] },
    "crest": { "motif": "spikes", "group": "Plate", "profile": "crown" },
    "helm": { "n": 2.8, "pad": 0.016, "flare": 0.06, "muzzle": 0.012, "crown": 0.75, "visor": "slits", "visorGroup": "Glow", "faceplate": "Socket", "brow": { "group": "Plate" },
      "coronet": { "count": 7, "len": 0.17, "r": 0.012, "u": 0.9, "arc": 0.55, "lean": 0.12, "profile": "fan", "group": "Plate", "band": 0.018 }, "group": "Plate" },
    "cloth": { "tabard": { "group": "Cloth", "hemGroup": "Trim", "len": 0.62, "w": 0.15 } },
    "tones": { "Plate": "#2b2f37", "Trim": "#8c7648", "Rivet": "#5d6168", "Accent": "#8c7648", "Leather": "#2a2320", "Bone": "#d8d1bd", "Socket": "#0b0d12", "Glow": "#8fdcff", "Fur": "#8e9094", "Cloth": "#1b2947", "Top": "#14161a", "Bottom": "#14161a", "Shoes": "#101114" },
    "emissive": ["Glow"]
  },
  // the radiant champion: the same suit made holy — a sun boss down the suit, wings for pauldron crests, a halo of
  // rays behind the head, gold filigree on every edge, a white tabard; the structure rises instead of spiking
  radiant: {
    "id": "radiant",
    "dials": { "stylize": 0.6, "mass": 1.0, "ornament": 2 },
    "language": { "plate": { "pauldron": "bell" } },
    "primary": { "motif": "boss", "group": "Gold", "glow": ["focal"] },
    "edge": [{ "motif": "rim", "group": "Gold", "on": ["plates"] }, { "motif": "studs", "group": "Gold", "on": ["cuffs"] }],
    "crest": { "motif": "plume", "group": "Plate", "count": 5 },
    "helm": { "n": 2.3, "pad": 0.02, "flare": 0.12, "muzzle": 0.012, "crown": 0.92, "visor": "t", "visorGroup": "Glow", "group": "Plate",
      "coronet": { "count": 11, "len": 0.16, "r": 0.008, "u": 0.62, "arc": 0.36, "centre": "back", "lean": 2.4, "profile": "fan", "group": "Gold" } },
    "cloth": { "tabard": { "group": "Cloth", "hemGroup": "Gold", "len": 0.55 } },
    "tones": { "Plate": "#e9e6df", "Trim": "#d4ae55", "Rivet": "#d4ae55", "Accent": "#e3bd5c", "Gold": "#d9b25a", "Glow": "#ffe9a8", "Cloth": "#f2efe8", "Leather": "#6b5237", "Top": "#6b5a44", "Bottom": "#4c4133", "Shoes": "#3a3026" },
    "emissive": ["Glow"]
  },
});

const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
// the counts a theme names are loops over geometry (ribs, crest spikes, the helm's rings, grille bars, coronet spikes),
// so each is bounded and a runaway number is refused by name
const THEME_COUNTS = Object.freeze([['secondary.count', 1, 16], ['crest.count', 1, 16], ['helm.m', 3, 64], ['helm.grille', 0, 8], ['helm.coronet.count', 1, 32]]);
/** the dials a theme may lean, over the style's and under the build's: the armour build's own ranges */
export const THEME_DIALS = Object.freeze({ stylize: [0, 1], coverage: [0, 1], mass: [0.5, 2], ornament: [0, 3] });

/** Error strings for an inline theme card (form only). */
export function validateTheme(card, at = 'theme') {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return [`${at}: a theme name (${Object.keys(THEMES).join(', ')}) or a card { primary?, secondary?, edge?, crest?, helm?, cloth?, dials?, tones? }`];
  const errs = [];
  for (const slot of Object.keys(MOTIFS)) for (const [i, m] of (slot === 'edge' && Array.isArray(card.edge) ? card.edge.map((e, j) => [`[${j}]`, e]) : card[slot] === undefined ? [] : [['', card[slot]]])) {
    const w = `${at}.${slot}${i}`;
    if (!m || typeof m !== 'object' || !MOTIFS[slot].includes(m.motif)) { errs.push(`${w}.motif: one of ${MOTIFS[slot].join(', ')}`); continue; }
    if (typeof m.group !== 'string') errs.push(`${w}.group: a group name`);
    if (slot === 'edge') for (const e of m.on || []) if (!EDGES.includes(e)) errs.push(`${w}.on: among ${EDGES.join(', ')}`); }
  for (const a of card.primary?.glow || []) if (!ANCHORS.includes(a)) errs.push(`${at}.primary.glow: anchors among ${ANCHORS.join(', ')}`);
  for (const [a, n] of Object.entries(card.primary?.horns || {})) if (!ANCHORS.includes(a) || ![0, 1, 2].includes(n)) errs.push(`${at}.primary.horns.${a}: an anchor (${ANCHORS.join(', ')}) → 0 | 1 | 2`);
  for (const e of card.glyphs?.on || []) if (!FIELDS.includes(e)) errs.push(`${at}.glyphs.on: among ${FIELDS.join(', ')}`);
  if (card.helm !== undefined && (typeof card.helm !== 'object' || !Number.isFinite(card.helm.pad))) errs.push(`${at}.helm: { pad, n?, visor?, coronet?, … } (the helm signature's words)`);
  for (const [path, lo, hi] of THEME_COUNTS) {
    const v = path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), card);
    if (v !== undefined && !(Number.isInteger(v) && v >= lo && v <= hi)) errs.push(`${at}.${path}: an integer ${lo}–${hi}`);
  }
  const d = card.dials;
  if (d !== undefined && (!d || typeof d !== 'object' || Array.isArray(d))) errs.push(`${at}.dials: { ${Object.keys(THEME_DIALS).join(', ')} }`);
  else for (const [k, v] of Object.entries(d || {})) {
    if (!THEME_DIALS[k]) { errs.push(`${at}.dials.${k}: not a dial (${Object.keys(THEME_DIALS).join(', ')})`); continue; }
    const [lo, hi] = THEME_DIALS[k];
    if (!(Number.isFinite(v) && v >= lo && v <= hi && (k !== 'ornament' || Number.isInteger(v)))) errs.push(`${at}.dials.${k}: ${k === 'ornament' ? 'an integer' : 'a number'} ${lo}–${hi}`);
  }
  for (const [g, v] of Object.entries(card.tones || {})) if (!isHex(v)) errs.push(`${at}.tones.${g}: a "#rrggbb" colour`);
  if (card.emissive !== undefined && !(Array.isArray(card.emissive) && card.emissive.every((g) => typeof g === 'string'))) errs.push(`${at}.emissive: a list of group names`);
  return errs;
}

export const themeOf = (theme) => (typeof theme === 'string' ? THEMES[theme] : theme);
