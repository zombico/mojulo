/**
 * DRESS MATERIALS — what a hero's armour, outfit and dress are made of, by the palette group each piece is painted in,
 * so a level's look (a geocube's `materials`) can turn the tones a card wrote into materials the World page and the
 * exporters shade: plate as worked steel, kanamono as gold, leather as leather, a hardsuit's shell as paint.
 *
 *   FAMILY_MATERIALS              family → group → material (a shelf name, a metal surface, or { metal: 'tone', finish })
 *   metalForTone(hex)             the metal a tone reads as: gold, brass, bronze, copper or steel, by hue and lightness
 *   dressSurfaces({ palette, family, overrides })   → recipe.surfaces for the groups the palette paints, or null
 *   agedTones(palette, surfaces, age)                → the painted tones of the groups an age changed, or null
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
 * The surfaces a dressed hero wears: for every group its palette paints, the family's material, else the dress's, else
 * an override's (`false` leaves a group as paint). → { <group>: material } or null when no group has one.
 */
export function dressSurfaces({ palette = {}, family = null, overrides = null } = {}) {
  const { age = null, ...own } = overrides && typeof overrides === 'object' ? overrides : {};
  const table = { ...DRESS, ...(family && FAMILY_MATERIALS[family] ? FAMILY_MATERIALS[family] : {}) };
  const out = {};
  for (const [g, m] of Object.entries({ ...table, ...own })) {
    if (m === false || !(g in palette)) continue;
    const t = m && typeof m === 'object' && m.metal === 'tone' ? { ...m, metal: metalForTone(palette[g]) } : m;
    out[g] = agedSurface(t, age, g in own);
  }
  return Object.keys(out).length ? out : null;
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
