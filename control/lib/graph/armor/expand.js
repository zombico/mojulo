// armor/expand — an ARMOUR BUILD on the hero's `adorn`, expanded into an adornment kit on every read.
//
//   adorn: { type: 'armor', style, dials?, language?, theme?, wear?, laws? }
//     style     a seeded sample name (styles.js) or an inline card
//     dials     { stylize 0–1, mass, coverage 0–1, ornament 0–3 } over the card's own
//     language  slot words over the card's (plate: pauldron, focalSide, fnSide; lamellar: crest)
//     theme     a theme name (themes/themes.js) or an inline card: the motifs carried down the suit (laws 13–16),
//               leaning the dials and language between the style's and the build's own
//     wear      the optional pieces the realistic body wears only when named (['gorget']); the authored body wears its own
//     laws      the version of principles.js the build was minted under (stamped by the hero record; absent → current)
//     with      a KIT worn over the suit (a helmet, a mask, a cape's clasp): appended after it; a head piece replaces the helm
//
// The hero record stores these words; `hero-dress.dressPlan` calls `expandArmor` with the register's ring halves, and
// the kit is baked like any other (station-loft-adorn.js). Pure and deterministic: no dice, fixed order.
import { ARMOR_LAWS_VERSION } from './principles.js';
import { SEEDED_ARMOR, validateArmorCard, cardAtLaws } from './styles.js';
import { plateSuit } from './plate.js';
import { lamellarSuit } from './lamellar.js';
import { hardSuit } from './hardsuit.js';
import { themeArmor } from './theme.js';
import { THEMES, themeOf, validateTheme } from '../themes/themes.js';

export { ARMOR_LAWS_VERSION };

export function isArmorBuild(adorn) {
  return !!(adorn && typeof adorn === 'object' && !Array.isArray(adorn) && adorn.type === 'armor');
}

/** the pieces a build's `wear` may name (the realistic body's optional ones) */
const WEARABLE = Object.freeze(['gorget']);

// (the card a build reads: its style's, as recomposed up to the build's armour laws, the current ones when unstamped)
const cardOf = (style, laws = ARMOR_LAWS_VERSION) => cardAtLaws(typeof style === 'string' ? SEEDED_ARMOR[style] : style, laws);

/** Validate a build → an array of error strings, each naming the choices. */
export function validateArmor(build) {
  const errs = [];
  if (!isArmorBuild(build)) return ["adorn: { type: 'armor', style, dials? }"];
  const style = build.style ?? 'knight';
  if (typeof style === 'string') { if (!SEEDED_ARMOR[style]) errs.push(`adorn.style: '${style}' is not a sample (${Object.keys(SEEDED_ARMOR).join(', ')}); or pass an inline card`); }
  else errs.push(...validateArmorCard(style, 'adorn.style'));
  const d = build.dials || {};
  if (typeof d !== 'object' || Array.isArray(d)) errs.push('adorn.dials: { stylize, mass, coverage, ornament }');
  for (const k of Object.keys(d)) if (!['stylize', 'mass', 'coverage', 'ornament'].includes(k)) errs.push(`adorn.dials.${k}: not a dial (stylize, mass, coverage, ornament)`);
  for (const k of ['stylize', 'coverage']) if (d[k] !== undefined && !(Number.isFinite(d[k]) && d[k] >= 0 && d[k] <= 1)) errs.push(`adorn.dials.${k}: a number 0–1`);
  if (d.mass !== undefined && !(Number.isFinite(d.mass) && d.mass >= 0.5 && d.mass <= 2)) errs.push('adorn.dials.mass: a number 0.5–2');
  if (d.ornament !== undefined && !(Number.isInteger(d.ornament) && d.ornament >= 0 && d.ornament <= 3)) errs.push('adorn.dials.ornament: an integer 0–3');
  const card = cardOf(style, build.laws ?? ARMOR_LAWS_VERSION);
  if (build.language !== undefined && card && !validateArmorCard(card).length) errs.push(...validateArmorCard({ ...card, language: { ...card.language, ...build.language } }, 'adorn').filter((e) => e.includes('language')));
  // `wear`: the pieces the realistic body leaves off unless named (polygonizer/body-relational-armour.js OPTIONAL_PIECES)
  if (build.wear !== undefined && !(Array.isArray(build.wear) && build.wear.every((w) => WEARABLE.includes(w)))) errs.push(`adorn.wear: a list of the optional pieces the realistic body wears only when named (${WEARABLE.join(', ')})`);
  if (build.theme !== undefined) { if (typeof build.theme === 'string') { if (!Object.hasOwn(THEMES, build.theme)) errs.push(`adorn.theme: '${build.theme}' is not a theme (${Object.keys(THEMES).join(', ')}); or pass an inline card`); } else errs.push(...validateTheme(build.theme, 'adorn.theme')); }
  // a theme's language leans the style's family words: the same choices as the card's own
  const TL = card && !validateArmorCard(card).length ? themeOf(build.theme)?.language?.[card.family] : undefined;
  if (TL !== undefined) errs.push(...validateArmorCard({ family: card.family, language: TL }, 'adorn.theme').filter((e) => e.includes('language')).map((e) => e.replace('adorn.theme.language.', `adorn.theme.language.${card.family}.`)));
  // `with`: a kit worn over the build (hero-dress.js dressPlan), each adornment its own data (the adornment layer judges it)
  if (build.with !== undefined && !(Array.isArray(build.with) && build.with.every((a) => a && typeof a === 'object' && !Array.isArray(a) && typeof a.id === 'string'))) errs.push('adorn.with: a KIT worn over the armour, [{ id, mode, part, …, signature }]');
  if (build.laws !== undefined && !(Number.isInteger(build.laws) && build.laws >= 1 && build.laws <= ARMOR_LAWS_VERSION)) errs.push(`adorn.laws: ${build.laws} is unknown — this kernel carries armour laws 1 to ${ARMOR_LAWS_VERSION}`);
  return errs;
}

/** Expand a (valid) build → { kit, tones, emissive, trace }. `ctx`: { Ht, Hl, scale } from hero-dress.dressContext. */
export function expandArmor(build, { Ht, Hl, scale = 1, pelvis = false, Hth, chibi = null } = {}) {
  const errs = validateArmor(build);
  if (errs.length) throw new Error(`Invalid armour build:\n- ${errs.join('\n- ')}`);
  const card = cardOf(build.style ?? 'knight', build.laws ?? ARMOR_LAWS_VERSION), T = build.theme === undefined ? null : themeOf(build.theme);
  // precedence: the style's card, then the theme's lean, then the build's own words
  // (a chibi's lean, hero-dress.js CHIBI_DRESS, between the theme's and the build's: fewer, larger lames, no ornament)
  const leaned = { stylize: 0, mass: 1, coverage: 1, ornament: 1, ...card.dials, ...(T?.dials || {}) }, C = chibi?.armor;
  const lean = C ? { stylize: Math.max(leaned.stylize, C.stylize), ornament: Math.min(leaned.ornament, C.ornament) } : {};
  const dials = { ...leaned, ...lean, ...build.dials };
  const lang = { ...(card.language || {}), ...(T?.language?.[card.family] || {}), ...(build.language || {}) };
  // (a chibi wears only its family's `keep` pieces: CHIBI_DRESS)
  const ctx = { Ht, Hl, k: scale, height: 1.75 * scale * (C?.height ?? 1), armorLaws: build.laws ?? ARMOR_LAWS_VERSION, ...(pelvis ? { pelvis: true, Hth } : {}), ...(C ? { keep: C.keep[card.family] } : {}) };
  let out = card.family === 'lamellar' ? lamellarSuit(dials, ctx, { crest: lang.crest ?? 'crescent' })
    : card.family === 'hardsuit' ? hardSuit(dials, ctx, lang)
      : plateSuit(dials, ctx, { variant: lang.pauldron ?? 'spaulder', focalSide: lang.focalSide ?? 'R', fnSide: lang.fnSide ?? 'L' });
  let tones = { ...(card.tones || {}) }, emissive = [...(card.emissive || [])];
  if (T) { const th = themeArmor(out, T, { family: card.family, dials, ctx, lang }); out = th; tones = { ...tones, ...th.tones }; emissive = [...new Set([...emissive, ...th.emissive])]; }
  return { kit: out.kit, tones, emissive, trace: { style: typeof build.style === 'string' ? build.style : card.id || 'inline', family: card.family, dials, language: lang, laws: build.laws ?? ARMOR_LAWS_VERSION, ...out.trace } };
}

/** The construction a build is made in ('plate' | 'lamellar' | 'hardsuit'), or null for anything not an armour build. */
export function armorFamily(build) {
  const card = isArmorBuild(build) ? cardOf(build.style ?? 'knight') : null;
  return card && typeof card === 'object' ? card.family ?? null : null;
}

/** The words a build's suit is composed in: its card's language (at the build's armour laws), the theme's lean, the
 * build's own; null for anything not an armour build. */
export function armorLanguage(build) {
  if (!isArmorBuild(build)) return null;
  const card = cardOf(build.style ?? 'knight', build.laws ?? ARMOR_LAWS_VERSION), T = build.theme === undefined ? null : themeOf(build.theme);
  return card && typeof card === 'object' ? { ...(card.language || {}), ...(T?.language?.[card.family] || {}), ...(build.language || {}) } : null;
}

/** The materials a build's card names for its pieces (styles.js `materials`), or null. */
export function armorMaterials(build) {
  const card = isArmorBuild(build) ? cardOf(build.style ?? 'knight') : null;
  return card && typeof card === 'object' && card.materials && typeof card.materials === 'object' ? card.materials : null;
}

/** The palette a build suggests beneath the operator's own (its piece groups and the layer beneath). */
export function armorTones(build) {
  const card = isArmorBuild(build) ? cardOf(build.style ?? 'knight', build.laws ?? ARMOR_LAWS_VERSION) : null, T = card && build.theme !== undefined ? themeOf(build.theme) : null;
  return card && typeof card === 'object' ? { ...(card.tones || {}), ...(T?.tones || {}) } : {};
}

/** The readout for the hero's dress: the style, the family, the resolved dials, the pieces worn, the focal. */
export function armorReadout(build, ctx) {
  const { kit, trace } = expandArmor(build, ctx);
  return { style: trace.style, family: trace.family, ...(trace.theme ? { theme: trace.theme.id, seated: trace.theme.seated.length } : {}), laws: trace.laws, dials: trace.dials, worn: trace.worn, focal: trace.focal, adornments: kit.length, ...(trace.rows && Object.keys(trace.rows).length ? { rows: trace.rows } : {}) };
}
