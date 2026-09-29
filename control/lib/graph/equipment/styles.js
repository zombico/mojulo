// equipment/styles — the seeded style cards. PURE DATA: every card is plain JSON (the test round-trips each one), so
// an agent can read one, copy it, and author its own inline as `build.style`. A style is only a SAMPLE, a preset over
// the dials (principles.js): a new direction is a new card, not code.
//
// A card:
//   dials     { stylize, mass, focus, ornament } — the defaults a build's own `dials` override
//   lean      the sample's own proportion character (multipliers: W, T, L, span, grip, pommel)
//   language  slot → variant for the sword family, with per-item overrides (`dagger`, `staff`, `bow`, `shield`);
//             staff / bow / shield entries may also name their `focus`, a `shaft` or `board` role, a `bark` species
//   edge      blade edge: fuller (0–1), bevel (0–1), single (a spine), barbs (count), twoTone
//   roles     material role → [shelf material, '#hex'] or a metal surface { metal, finish?, film?, pattern? } (its colour is the
//             metal's measured optics): blade, edge?, fittings, accent, wrap, leaf?
//   gem       the stone the sample carries when its focus takes one: { gem, cut, glow }

import { isMetalSurface, metalSurfaceError } from '../materials/metal-surface.js';

export const SEEDED_STYLES = Object.freeze({
  historical: {
    "id": "historical",
    "dials": { "stylize": 0, "mass": 1, "focus": "none", "ornament": 0 },
    "lean": {},
    "language": { "blade": "straight", "guard": "bar", "pommel": "wheel", "grip": "leather",
      "staff": { "head": "plain", "focus": "none", "shaft": ["wood", "#6b4a2e"] },
      "bow": { "limb": "longbow", "tips": "none", "focus": "curve", "shaft": ["wood", "#8a5a32"] },
      "shield": { "outline": "heater", "device": "chevron", "focus": "none", "board": ["wood", "#7a2e2a"] } },
    "edge": { "fuller": 0.35, "bevel": 0.55 },
    "roles": { "blade": { "metal": "steel", "finish": "brushed" }, "fittings": { "metal": "steel", "finish": "blasted" }, "accent": { "metal": "bronze", "finish": "polished" }, "wrap": ["leather", "#5a3b24"] }
  },
  elven: {
    "id": "elven",
    "dials": { "stylize": 0.4, "mass": 0.82, "focus": "pommel", "ornament": 2 },
    "lean": { "span": 1.15, "L": 1.06 },
    "language": { "blade": "leaf", "guard": "crescent", "pommel": "cage", "grip": "wire",
      "staff": { "head": "branch", "focus": "head", "shaft": ["wood", "#d8ceb4"], "bark": "beech", "limbs": 3, "twigs": 1, "leaves": false },
      "bow": { "limb": "recurve", "tips": "leaf", "focus": "riser", "shaft": ["wood", "#d8ceb4"] },
      "shield": { "outline": "kite", "device": "vine", "focus": "boss", "board": ["silver", "#c9d6df"] } },
    "edge": { "fuller": 0.25, "bevel": 0.4 },
    "roles": { "blade": { "metal": "silver", "finish": "polished" }, "fittings": { "metal": "silver", "finish": "brushed" }, "accent": { "metal": "silver", "finish": "mirror" }, "wrap": ["matte", "#2f4a5c"] },
    "gem": { "gem": "sapphire", "glow": 0.35, "cut": "brilliant" }
  },
  dwarven: {
    "id": "dwarven",
    "dials": { "stylize": 0.3, "mass": 1.3, "focus": "guard", "ornament": 1 },
    "lean": { "L": 0.84, "span": 0.95 },
    "language": { "blade": "broad", "guard": "block", "pommel": "block", "grip": "banded",
      "staff": { "head": "block", "focus": "head", "shaft": ["wood", "#4a3222"] },
      "bow": { "limb": "horn", "tips": "horn", "focus": "riser", "shaft": ["wood", "#3b2a1e"] },
      "shield": { "outline": "round", "device": "bands", "focus": "boss", "board": ["wood", "#5a3a24"] } },
    "edge": { "fuller": 0.15, "bevel": 0.72 },
    "roles": { "blade": { "metal": "steel", "finish": "polished", "film": { "temper": 300 } }, "fittings": { "metal": "bronze", "finish": "planished" }, "accent": { "metal": "gold", "finish": "polished" }, "wrap": ["leather", "#3d2a1c"] },
    "gem": { "gem": "ruby", "glow": 0.1, "cut": "brilliant" }
  },
  brutal: {
    "id": "brutal",
    "dials": { "stylize": 0.5, "mass": 1.35, "focus": "blade", "ornament": 0 },
    "lean": { "W": 1.2, "L": 0.92, "span": 0.9 },
    "language": { "blade": "cleaver", "guard": "spiked", "pommel": "spike", "grip": "cord",
      "staff": { "head": "mace", "focus": "head", "shaft": ["matte", "#d8ccb0"] },
      "bow": { "limb": "recurve", "tips": "spike", "focus": "tips", "shaft": ["matte", "#cbbd9c"] },
      "shield": { "outline": "round", "device": "spikes", "focus": "boss", "board": ["wood", "#4a3b2e"] } },
    "edge": { "fuller": 0, "bevel": 0.8, "barbs": 4 },
    "roles": { "blade": { "metal": "steel", "finish": "mill" }, "fittings": { "metal": "steel", "finish": "mill" }, "accent": ["matte", "#d8ccb0"], "wrap": ["matte", "#d2c3a2"] }
  },
  eastern: {
    "id": "eastern",
    "dials": { "stylize": 0.1, "mass": 0.9, "focus": "guard", "ornament": 0 },
    "lean": { "W": 0.8, "span": 0.5, "grip": 1.35, "pommel": 0.7 },
    "language": { "blade": "sabre", "guard": "disc", "pommel": "cap", "grip": "cord", "dagger": { "blade": "tanto" },
      "staff": { "head": "ringed", "focus": "head", "shaft": ["satin", "#1c1a1a"] },
      "bow": { "limb": "yumi", "tips": "none", "focus": "curve", "shaft": ["satin", "#2a1f1a"] },
      "shield": { "outline": "round", "device": "mon", "focus": "boss", "board": ["satin", "#1f1d1c"] } },
    "edge": { "fuller": 0, "bevel": 0.35, "single": true },
    "roles": { "blade": { "metal": "steel", "pattern": { "kind": "damascus", "type": "twist", "folds": 3 } }, "fittings": { "metal": "steel", "finish": "blasted", "film": { "temper": 340 } }, "accent": { "metal": "gold", "finish": "brushed" }, "wrap": ["matte", "#1f2340"] }
  },
  "anime-hero": {
    "id": "anime-hero",
    "dials": { "stylize": 0.9, "mass": 1.05, "focus": "guard", "ornament": 3 },
    "lean": {},
    "language": { "blade": "hero", "guard": "winged", "pommel": "ring", "grip": "wire",
      "staff": { "head": "crescent", "wings": true, "focus": "head", "shaft": ["satin", "#f2f2f0"] },
      "bow": { "limb": "recurve", "tips": "wing", "focus": "riser", "shaft": ["satin", "#f2f2f0"] },
      "shield": { "outline": "heater", "device": "wings", "focus": "boss", "board": ["satin", "#2f63d8"] } },
    "edge": { "fuller": 0, "bevel": 0.62, "twoTone": true },
    "roles": { "blade": ["satin", "#2f63d8"], "edge": { "metal": "chrome", "finish": "mirror" }, "fittings": ["satin", "#f2f2f0"], "accent": { "metal": "gold", "finish": "mirror" }, "wrap": ["matte", "#b3242c"] },
    "gem": { "gem": "sapphire", "glow": 0.6, "cut": "brilliant" }
  },
  druid: {
    "id": "druid",
    "dials": { "stylize": 0.45, "mass": 1.05, "focus": "guard", "ornament": 2 },
    "lean": { "span": 1.05 },
    "language": { "blade": "leaf", "guard": "crescent", "pommel": "wheel", "grip": "leather",
      "staff": { "head": "branch", "shaftForm": "gnarled", "focus": "head", "bark": "oak", "limbs": 4, "twigs": 3, "leaves": true, "shaft": ["wood", "#6e5238"] },
      "bow": { "limb": "longbow", "tips": "leaf", "focus": "riser", "bark": "oak", "shaft": ["wood", "#6e5238"] },
      "shield": { "outline": "round", "device": "vine", "focus": "boss", "board": ["wood", "#5a4330"] } },
    "edge": { "fuller": 0, "bevel": 0.5 },
    "roles": { "blade": { "metal": "bronze", "finish": "planished" }, "fittings": ["wood", "#6e5238"], "accent": { "metal": "bronze", "film": { "age": 40 } }, "wrap": ["leather", "#4a3524"], "leaf": ["matte", "#5d8a3c"] },
    "gem": { "gem": "tourmaline", "glow": 0.3, "cut": "natural" }
  },
  celestial: {
    "id": "celestial",
    "dials": { "stylize": 0.6, "mass": 1, "focus": "guard", "ornament": 2 },
    "lean": { "span": 1.1, "L": 1.04 },
    "language": { "blade": "flamberge", "guard": "winged", "pommel": "cap", "grip": "wire",
      "staff": { "head": "crescent", "focus": "head", "shaft": ["satin", "#f4f1e8"] },
      "bow": { "limb": "recurve", "tips": "wing", "focus": "riser", "shaft": ["satin", "#f4f1e8"] },
      "shield": { "outline": "heater", "device": "rays", "focus": "boss", "board": ["satin", "#f1ede2"] } },
    "edge": { "fuller": 0.3, "bevel": 0.5 },
    "roles": { "blade": { "metal": "stainless", "finish": "mirror" }, "fittings": { "metal": "gold", "finish": "polished" }, "accent": { "metal": "gold", "finish": "mirror" }, "wrap": ["matte", "#f4f1e8"] },
    "gem": { "gem": "diamond", "glow": 0.2, "cut": "brilliant" }
  },
});

/** Every variant a slot can take, per item family — what `parts` and a card's `language` may name. */
export const VARIANTS = Object.freeze({
  blade: ['straight', 'broad', 'leaf', 'hero', 'flamberge', 'cleaver', 'sabre', 'tanto'],
  guard: ['bar', 'crescent', 'block', 'spiked', 'disc', 'winged'],
  pommel: ['wheel', 'block', 'spike', 'cap', 'ring', 'cage'],
  grip: ['leather', 'banded', 'wire', 'cord'],
  head: ['plain', 'branch', 'claw', 'crescent', 'block', 'mace', 'ringed'],
  shaftForm: ['turned', 'gnarled'],
  limb: ['longbow', 'recurve', 'horn', 'yumi'],
  tips: ['none', 'leaf', 'wing', 'spike', 'horn'],
  outline: ['round', 'heater', 'kite'],
  device: ['none', 'chevron', 'rays', 'bands', 'spikes', 'mon', 'wings', 'vine'],
});
export const BARK_SPECIES = Object.freeze(['beech', 'oak', 'pine', 'chestnut', 'spruce', 'silverfir', 'pineUpper']);
const SHELF = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && /^#[0-9a-fA-F]{6}$/.test(v[1]);
const ROLE = (v) => SHELF(v) || (isMetalSurface(v) && !metalSurfaceError(v));

/** Validate a style card → an array of error strings (empty when valid). */
export function validateStyleCard(card, path = 'style') {
  const errs = [];
  if (!card || typeof card !== 'object' || Array.isArray(card)) return [`${path}: a style is a sample name (${Object.keys(SEEDED_STYLES).join(', ')}) or a card object`];
  const d = card.dials || {};
  if (d.stylize !== undefined && !(Number.isFinite(d.stylize) && d.stylize >= 0 && d.stylize <= 1)) errs.push(`${path}.dials.stylize: a number 0–1`);
  if (d.mass !== undefined && !(Number.isFinite(d.mass) && d.mass >= 0.5 && d.mass <= 2)) errs.push(`${path}.dials.mass: a number 0.5–2`);
  const lang = card.language || {};
  const checkSlots = (o, p) => { for (const [slot, v] of Object.entries(o || {})) {
    if (VARIANTS[slot] && !VARIANTS[slot].includes(v)) errs.push(`${p}.${slot}: '${v}' is not one of ${VARIANTS[slot].join(', ')}`);
    if (slot === 'bark' && !BARK_SPECIES.includes(v)) errs.push(`${p}.bark: '${v}' is not one of ${BARK_SPECIES.join(', ')}`);
    if ((slot === 'shaft' || slot === 'board') && !ROLE(v)) errs.push(`${p}.${slot}: a role is ['<material>', '#rrggbb']`); } };
  checkSlots(lang, `${path}.language`);
  for (const k of ['dagger', 'sword', 'greatsword', 'staff', 'bow', 'shield']) if (lang[k]) checkSlots(lang[k], `${path}.language.${k}`);
  for (const [role, v] of Object.entries(card.roles || {})) if (!ROLE(v)) errs.push(`${path}.roles.${role}: a role is ['<material>', '#rrggbb'] or a metal surface { metal, finish?, film?, pattern? }${isMetalSurface(v) ? ` — ${metalSurfaceError(v)}` : ''}`);
  for (const role of ['blade', 'fittings', 'accent', 'wrap']) if (!card.roles?.[role]) errs.push(`${path}.roles.${role}: required`);
  return errs;
}
