/**
 * DRESS MATERIALS — what a hero's armour, outfit and dress are made of, by the palette group each piece is painted in,
 * so a level's look (a geocube's `materials`) can turn the tones a card wrote into materials the World page and the
 * exporters shade: plate as worked steel, kanamono as gold, leather as leather, a hardsuit's shell as paint.
 *
 *   FAMILY_MATERIALS              family → group → material (a shelf name, a metal surface, or { metal: 'tone', finish })
 *   metalForTone(hex)             the metal a tone reads as: gold, brass, bronze, copper or steel, by hue and lightness
 *   dressSurfaces({ palette, family, cloth, card, overrides })   → recipe.surfaces for the groups the palette paints, or null
 *   CLOTHS, genreCloth(words)                        the painted cloths (silk, velvet, wool, denim …); a genre's on its garments
 *   agedTones(palette, surfaces, age)                → the painted tones of the groups an age changed, or null
 *   recipeTones(recipe)                              → each group's tone: its palette's, else its parts' tint (a creature's)
 *   levelClothBake(surfaces, groups)                 → the painted finish a level lays on the cloth and leather, or null
 *
 * AGE (`overrides.age`, a cube's `materials: { age }`): new, worn, old or ancient, on the table's metals (copper alloys
 * by their tarnish law, metal-surface.js copperAge: brown at 5 years, turning at 20, verdigris at 60; steel dulled,
 * then forged black scale). A group the cube names ages too, unless it names its own film or finish; gold, silver and
 * the rest do not age here, nor does a pattern-welded blade.
 *
 * A group named the same means different things in different families (a plate's Trim is gilt, an outfit's is cloth,
 * a hardsuit's Plate is painted composite), so the table is read by the armour's family first, then the dress and
 * outfit groups every hero may wear. `{ metal: 'tone' }` asks the group's own tone which metal it is, so a card that
 * wrote a gilt trim gets gold and one that wrote a dark iron trim gets steel, with no colour written twice.
 */
import { validateMaterialRef } from '../polygonizer/materials.js';
import { resolveMetalSurface } from './metal-surface.js';
import { hexToRgb, rgbToHex, rgbToOklab, oklabToRgb } from '../color-theorist/oklab.js';

// the dress and outfit groups (polygonizer/hero-dress.js dressTones, outfit/styles.js, polygonizer/outfit-plan.js)
const DRESS = Object.freeze({
  Iron: Object.freeze({ metal: 'steel', finish: 'blasted' }),
  Bronze: Object.freeze({ metal: 'bronze', finish: 'turned' }),
  Leather: 'leather',
  Wrap: 'matte',
  Buckle: Object.freeze({ metal: 'tone', finish: 'polished' }),
  Toggle: 'satin',
  OutfitMetal: Object.freeze({ metal: 'tone', finish: 'polished' }),
});
export const FAMILY_MATERIALS = Object.freeze({
  // plate (armor/plate.js): worked steel, gilt or brass trim, polished rivets (brushed, not planished: a planished
  // plate's near-mirror reads black wherever it faces the ground)
  plate: Object.freeze({
    Plate: Object.freeze({ metal: 'steel', finish: 'brushed' }),
    Helm: Object.freeze({ metal: 'steel', finish: 'brushed' }),
    Trim: Object.freeze({ metal: 'tone', finish: 'polished' }),
    Accent: Object.freeze({ metal: 'tone', finish: 'polished' }),
    Rivet: Object.freeze({ metal: 'steel', finish: 'polished' }),
  }),
  // lamellar (armor/lamellar.js): lacquered scales laced with silk cord, gilt fittings and crest
  lamellar: Object.freeze({
    Lacquer: 'satin',
    Odoshi: 'matte',
    Kanamono: Object.freeze({ metal: 'gold', finish: 'polished' }),
    Crest: Object.freeze({ metal: 'gold', finish: 'polished' }),
  }),
  // hardsuit (armor/hardsuit.js): a painted composite shell over a rubber undersuit; its lens and reactor glow
  hardsuit: Object.freeze({
    Plate: 'satin', Helm: 'satin', Trim: 'satin', Face: 'satin', Emblem: 'satin',
    Visor: 'glass',
    Suit: 'rubber',
  }),
});

// what an age does to a metal surface, by metal: copper alloys take a tarnish film (years), steel a finish
export const AGES = Object.freeze(['new', 'worn', 'old', 'ancient']);
const COPPER_YEARS = Object.freeze({ worn: 5, old: 20, ancient: 60 });
const STEEL_FINISH = Object.freeze({ worn: 'blasted', old: 'mill', ancient: 'mill' });
const AGES_COPPER = new Set(['copper', 'brass', 'bronze']);
/** A metal surface at an age (a non-metal, or a metal that does not age here, as it was). `named`: the cube named
 * this one, so the film or finish it names is kept. */
export function agedSurface(m, age, named = false) {
  if (!age || age === 'new' || !m || typeof m !== 'object' || typeof m.metal !== 'string' || m.pattern != null) return m;
  if (AGES_COPPER.has(m.metal)) return named && m.film ? m : { ...m, film: { age: COPPER_YEARS[age] } };
  if (m.metal === 'steel') return named && m.finish ? m : { ...m, finish: STEEL_FINISH[age] };
  return m;
}

// a creature's own body (the mascot and drawn bodies' groups, egocube/mascot-form.js): keratin and shell take a satin
// gloss; what else it wears of metal or leather its outfit's groups (above) or its plan's `materials` say
export const CREATURE_MATERIALS = Object.freeze({ Horn: 'satin', Hoof: 'satin', Beak: 'satin', Shell: 'satin' });

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
/** The metal a tone reads as: a light warm yellow is gold, a darker one brass, an orange-brown bronze, a red-brown copper,
 * anything greyer steel. */
export function metalForTone(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return 'steel';
  const [r, g, b] = rgbOf(hex), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, sat = max > 0 ? d / max : 0;
  if (sat < 0.3 || d < 1e-6) return 'steel';
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue >= 38 && hue < 62) return max > 0.72 ? 'gold' : 'brass';
  if (hue >= 24 && hue < 38) return 'bronze';
  if (hue < 24 || hue >= 340) return 'copper';
  return 'steel';
}

/** A cube's `materials` checked: true, false, or { <group>: <material> } overrides. → error strings. */
export function materialsErrors(spec, at = 'materials') {
  if (spec === undefined || spec === true || spec === false) return [];
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) return [`${at} is true (the dress materials), false, or { age?, <group>: <material> } over them`];
  const errs = [];
  for (const [g, m] of Object.entries(spec)) {
    if (g === 'age') { if (!AGES.includes(m)) errs.push(`${at}.age: one of ${AGES.join(', ')}`); continue; }
    if (!/^[A-Z][A-Za-z]*$/.test(g)) errs.push(`${at}.${g}: a palette group name (Plate, Trim, Leather …)`);
    const e = m === false ? null : validateMaterialRef(m);
    if (e) errs.push(`${at}.${g}: ${e}`);
  }
  return errs;
}

/**
 * The surfaces a dressed hero wears: for every group its palette paints, the cube's override, else the armour card's
 * own (`card`, armor/styles.js `materials`), else its genre's cloth (`cloth`, genreCloth), else the family's, else the
 * dress's (`false` leaves a group as paint).
 * → { <group>: material } or null when no group has one.
 */
export function dressSurfaces({ palette = {}, family = null, cloth = null, card = null, overrides = null } = {}) {
  const { age = null, ...own } = overrides && typeof overrides === 'object' ? overrides : {};
  const table = { ...DRESS, ...(family && FAMILY_MATERIALS[family] ? FAMILY_MATERIALS[family] : {}), ...(cloth && typeof cloth === 'object' ? cloth : {}), ...(card && typeof card === 'object' ? card : {}) };
  const out = {};
  for (const [g, m] of Object.entries({ ...table, ...own })) {
    if (m === false || !(g in palette)) continue;
    const t = m && typeof m === 'object' && m.metal === 'tone' ? { ...m, metal: metalForTone(palette[g]) } : m;
    out[g] = agedSurface(t, age, g in own);
  }
  return Object.keys(out).length ? out : null;
}

// THE CLOTHS: what each painted cloth does over the bake's channels (polygonizer/surface-bake.js: sky the facing ramp,
// occlusion its folds, edge its ridges, height its hem, rise a piece's own gradient, tint the lift's lean). 'cloth' is
// the bake's own. Wool and felt soft, no ridge; denim faded pale at its ridges; silk a sheen band where it turns to the
// sky; velvet dark in its body, bright at its rims (the pile catching light edge-on); the synthetics a small sheen.
const SILK = Object.freeze({ sky: [[-1, 0.7], [-0.2, 0.86], [0.35, 1.0], [0.6, 1.3], [0.85, 1.12], [1, 1.02]], occlusion: 0.7, edge: 0.2, height: 0.15, rise: 0.3, tint: [1, 0.98, 0.96] });
const SYNTH = Object.freeze({ sky: [[-1, 0.76], [0, 0.93], [0.55, 1.14], [1, 1.05]], occlusion: 0.75, edge: 0.15, height: 0.2, rise: 0.25, tint: [1, 1, 1] });
const WOOL = Object.freeze({ sky: [[-1, 0.8], [0, 0.95], [1, 1.04]], occlusion: 0.85, edge: 0.02, height: 0.25, rise: 0.2, tint: [1, 1, 1] });
export const CLOTHS = Object.freeze({
  linen: 'cloth', cotton: 'cloth', canvas: 'cloth', wool: WOOL, felt: WOOL,
  denim: Object.freeze({ sky: [[-1, 0.74], [0, 0.93], [1, 1.08]], occlusion: 0.8, edge: 0.3, height: 0.3, rise: 0.25, tint: [0.9, 0.95, 1] }),
  silk: SILK, 'spun filament': SILK,
  velvet: Object.freeze({ sky: [[-1, 0.62], [0, 0.8], [1, 0.9]], occlusion: 0.85, edge: 0.75, height: 0.2, rise: 0.2, tint: [1, 1, 1] }),
  nylon: SYNTH, polymer: SYNTH, membrane: SILK,
  'carbon weave': Object.freeze({ ...SYNTH, edge: 0.25, occlusion: 0.8 }), 'resin weave': Object.freeze({ ...SYNTH, edge: 0.22 }),
  'ballistic nylon': Object.freeze({ sky: [[-1, 0.76], [0, 0.94], [1, 1.06]], occlusion: 0.8, edge: 0.12, height: 0.25, rise: 0.25, tint: [1, 1, 1] }),
});
/** The cloth words a genre names (stylism/genres.js `materials.cloth`) on a stylist's garment groups: of the cloths this
 * table paints (its leather is the leather groups' already), the first its top, the second its trousers, the third its
 * outer layer (else the first: the coat over a shirt of the same cloth). */
export function genreCloth(words = []) {
  const [a, b, c] = words.filter((w) => typeof w === 'string' && Object.hasOwn(CLOTHS, w)), out = {};
  if (a) { out.Top = a; out.Outer = c ?? a; }
  if (b) out.Bottom = b;
  return Object.keys(out).length ? out : null;
}

// the CLOTH a level dresses by its painted finish (polygonizer/surface-bake.js `cloth`): the layer beneath, the outfit's
// cloth roles, the stylist's garment groups and the names the bake's own table calls cloth (a Trim a family makes metal
// has its surface, so only a cloth trim is cloth here); LEATHER by its material or its name
const CLOTH_GROUP = /^(Top|Bottom|Cloth|Tabard|Quilt|Cuff|Odoshi|Cape|Cloak|Hem|Robe|Sleeve|Wrap|Outer|Panel|Collar|Waistband|Placket|Lining|Skirt|Dress|Coat|Hood|Scarf|Sash|Patch|Trim|Outfit(Base|Second|Trim|Accent|Shade))/;
const LEATHER_GROUP = /^(Leather|Strap|Belt|Shoes|Boot|Bracer)/;
/**
 * The bake a level that names `materials` lays on a dressed figure's cloth and leather (surface-bake.js finishes):
 * folds deep and a hem falling darker on its cloth, a low sheen and rubbed edges on its leather. A group dressed in
 * something else (metal, satin, glass, rubber) is left to its material; one dressed in a named cloth (CLOTHS: silk,
 * velvet, denim …) takes that cloth's finish. → { finish: { group: 'cloth' | 'leather' | a cloth's finish },
 * only: Set } or null when it has neither. `groups`: the figure's painted groups.
 */
export function levelClothBake(surfaces = {}, groups = []) {
  const finish = {};
  for (const g of groups) {
    const m = surfaces?.[g];
    if (m === 'leather' || (m === undefined && LEATHER_GROUP.test(g))) finish[g] = 'leather';
    else if (typeof m === 'string' && Object.hasOwn(CLOTHS, m)) finish[g] = CLOTHS[m];
    else if ((m === undefined || m === 'matte') && CLOTH_GROUP.test(g)) finish[g] = 'cloth';
  }
  return Object.keys(finish).length ? { finish, only: new Set(Object.keys(finish)) } : null;
}

const HEX3 = /^#[0-9a-f]{3}$/i, HEX6 = /^#[0-9a-f]{6}$/i;
/** The tone each group of a recipe is painted in: its palette's, else the first tint a part in it carries (a creature's
 * parts carry their own tints, no palette), as #rrggbb. */
export function recipeTones(recipe = {}) {
  const out = {};
  for (const part of Object.values(recipe.parts || {})) {
    const g = part?.group, t = part?.tint;
    if (typeof g !== 'string' || g in out || typeof t !== 'string') continue;
    if (HEX6.test(t)) out[g] = t.toLowerCase(); else if (HEX3.test(t)) out[g] = `#${[1, 2, 3].map((i) => t[i] + t[i]).join('')}`.toLowerCase();
  }
  return { ...out, ...(recipe.palette && typeof recipe.palette === 'object' ? recipe.palette : {}) };
}

// how far an aged group's painted tone moves to its aged colour (OKLab), so the card's own tone still shows through
const AGED_TONE = 0.75;
/** The painted tones of the groups an age changed: each moved toward its surface's aged colour. → { group: hex } or null. */
export function agedTones(palette = {}, surfaces = null, age = null) {
  if (!surfaces || !age || age === 'new') return null;
  const out = {};
  for (const [g, m] of Object.entries(surfaces)) {
    const tone = palette[g];
    if (!m || typeof m !== 'object' || !(m.film?.age !== undefined || m.finish === 'mill') || typeof tone !== 'string' || !/^#[0-9a-f]{6}$/i.test(tone)) continue;
    const a = rgbToOklab(hexToRgb(tone)), b = rgbToOklab(hexToRgb(resolveMetalSurface(m).hex));
    out[g] = rgbToHex(oklabToRgb(a.map((v, k) => v + (b[k] - v) * AGED_TONE)));
  }
  return Object.keys(out).length ? out : null;
}
