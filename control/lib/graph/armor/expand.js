// armor/expand — an ARMOUR BUILD on the hero's `adorn`, expanded into an adornment kit on every read.
//
//   adorn: { type: 'armor', style, dials?, language?, theme?, laws? }
//     style     a seeded sample name (styles.js) or an inline card
//     dials     { stylize 0–1, mass, coverage 0–1, ornament 0–3 } over the card's own
//     language  slot words over the card's (plate: pauldron, focalSide, fnSide; lamellar: crest)
//     theme     a theme name (themes/themes.js) or an inline card: the motifs carried down the suit (laws 13–16),
//               leaning the dials and language between the style's and the build's own
//     laws      the version of principles.js the build was minted under (stamped by the hero record; absent → current)
//
// The hero record stores these words; `hero-dress.dressPlan` calls `expandArmor` with the register's ring halves, and
// the kit is baked like any other (station-loft-adorn.js). Pure and deterministic: no dice, fixed order.
import { ARMOR_LAWS_VERSION } from './principles.js';
import { SEEDED_ARMOR, validateArmorCard } from './styles.js';
import { plateSuit } from './plate.js';
import { lamellarSuit } from './lamellar.js';
import { hardSuit } from './hardsuit.js';
import { themeArmor } from './theme.js';
import { THEMES, themeOf, validateTheme } from '../themes/themes.js';

export { ARMOR_LAWS_VERSION };

export function isArmorBuild(adorn) {
  return !!(adorn && typeof adorn === 'object' && !Array.isArray(adorn) && adorn.type === 'armor');
}

const cardOf = (style) => (typeof style === 'string' ? SEEDED_ARMOR[style] : style);

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
  const card = cardOf(style);
  if (build.language !== undefined && card && !validateArmorCard(card).length) errs.push(...validateArmorCard({ ...card, language: { ...card.language, ...build.language } }, 'adorn').filter((e) => e.includes('language')));
  if (build.theme !== undefined) { if (typeof build.theme === 'string') { if (!Object.hasOwn(THEMES, build.theme)) errs.push(`adorn.theme: '${build.theme}' is not a theme (${Object.keys(THEMES).join(', ')}); or pass an inline card`); } else errs.push(...validateTheme(build.theme, 'adorn.theme')); }
  // a theme's language leans the style's family words: the same choices as the card's own
  const TL = card && !validateArmorCard(card).length ? themeOf(build.theme)?.language?.[card.family] : undefined;
  if (TL !== undefined) errs.push(...validateArmorCard({ family: card.family, language: TL }, 'adorn.theme').filter((e) => e.includes('language')).map((e) => e.replace('adorn.theme.language.', `adorn.theme.language.${card.family}.`)));
  if (build.laws !== undefined && build.laws !== ARMOR_LAWS_VERSION) errs.push(`adorn.laws: ${build.laws} is unknown — this kernel carries armour laws ${ARMOR_LAWS_VERSION}`);
  return errs;
}

/** Expand a (valid) build → { kit, tones, emissive, trace }. `ctx`: { Ht, Hl, scale } from hero-dress.dressContext. */
export function expandArmor(build, { Ht, Hl, scale = 1, pelvis = false, Hth } = {}) {
  const errs = validateArmor(build);
  if (errs.length) throw new Error(`Invalid armour build:\n- ${errs.join('\n- ')}`);
  const card = cardOf(build.style ?? 'knight'), T = build.theme === undefined ? null : themeOf(build.theme);
  // precedence: the style's card, then the theme's lean, then the build's own words
  const dials = { stylize: 0, mass: 1, coverage: 1, ornament: 1, ...card.dials, ...(T?.dials || {}), ...build.dials };
  const lang = { ...(card.language || {}), ...(T?.language?.[card.family] || {}), ...(build.language || {}) };
  const ctx = { Ht, Hl, k: scale, height: 1.75 * scale, ...(pelvis ? { pelvis: true, Hth } : {}) };
  let out = card.family === 'lamellar' ? lamellarSuit(dials, ctx, { crest: lang.crest ?? 'crescent' })
    : card.family === 'hardsuit' ? hardSuit(dials, ctx, lang)
      : plateSuit(dials, ctx, { variant: lang.pauldron ?? 'spaulder', focalSide: lang.focalSide ?? 'R', fnSide: lang.fnSide ?? 'L' });
  let tones = { ...(card.tones || {}) }, emissive = [...(card.emissive || [])];
  if (T) { const th = themeArmor(out, T, { family: card.family, dials, ctx, lang }); out = th; tones = { ...tones, ...th.tones }; emissive = [...new Set([...emissive, ...th.emissive])]; }
  return { kit: out.kit, tones, emissive, trace: { style: typeof build.style === 'string' ? build.style : card.id || 'inline', family: card.family, dials, language: lang, laws: build.laws ?? ARMOR_LAWS_VERSION, ...out.trace } };
}

/** The palette a build suggests beneath the operator's own (its piece groups and the layer beneath). */
export function armorTones(build) {
  const card = isArmorBuild(build) ? cardOf(build.style ?? 'knight') : null, T = card && build.theme !== undefined ? themeOf(build.theme) : null;
  return card && typeof card === 'object' ? { ...(card.tones || {}), ...(T?.tones || {}) } : {};
}

/** The readout for the hero's dress: the style, the family, the resolved dials, the pieces worn, the focal. */
export function armorReadout(build, ctx) {
  const { kit, trace } = expandArmor(build, ctx);
  return { style: trace.style, family: trace.family, ...(trace.theme ? { theme: trace.theme.id, seated: trace.theme.seated.length } : {}), laws: trace.laws, dials: trace.dials, worn: trace.worn, focal: trace.focal, adornments: kit.length, ...(trace.rows && Object.keys(trace.rows).length ? { rows: trace.rows } : {}) };
}
