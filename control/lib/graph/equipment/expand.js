// equipment/expand — an equipment `build` on a workbench manifest, expanded into plain monomers on every read.
//
//   build: { type: 'equipment', item, style, dials?, parts?, gem?, seed?, laws? }
//     item    dagger | sword | greatsword | staff | bow | shield
//     style   a seeded sample name (styles.js) or an inline style card
//     dials   { stylize 0–1, mass, focus, ornament } over the card's own
//     parts   slot → variant ({ blade: 'leaf', head: 'claw', … }); for staff / bow / shield also focus, bark, limbs,
//             twigs, leaves, wings
//     gem     a gem name, { gem, cut?, glow? }, or null for none; absent → the card's stone
//     laws    the version of principles.js the build was minted under (stamped at mint; absent → current)
//
// The recipe stores these words; `withEquipment` merges the expansion BEFORE any explicit monomer arrays (so an author
// can add a hand-made part beside a built item), exactly where a `program` expands (worlds/workbench-program.js).
// Absent a build, the manifest passes through by identity. Pure and deterministic: seeded dice, fixed order.
import { proportion, LAWS_VERSION } from './principles.js';
import { SEEDED_STYLES, VARIANTS, BARK_SPECIES, validateStyleCard } from './styles.js';
import { SWORDS, buildSword } from './sword.js';
import { ITEMS, buildItem } from './items.js';
import { CRYSTAL_GEMS } from '../polygonizer/crystal-optics.js';
import { r3 } from './shapes.js';

export { LAWS_VERSION };
export const EQUIPMENT_ITEMS = Object.freeze([...Object.keys(SWORDS), ...Object.keys(ITEMS)]);
export const FOCI = Object.freeze({ dagger: ['guard', 'pommel', 'blade', 'none'], sword: ['guard', 'pommel', 'blade', 'none'], greatsword: ['guard', 'pommel', 'blade', 'none'],
  staff: ['head', 'none'], bow: ['riser', 'tips', 'curve', 'none'], shield: ['boss', 'none'] });
const CUTS = ['natural', 'brilliant', 'cabochon'];
const ITEM_KEYS = ['focus', 'bark', 'limbs', 'twigs', 'leaves', 'wings', 'shaft', 'board'];
const MONOMER_ARRAYS = ['lathes', 'extrudes', 'sweeps', 'lofts', 'fields'];

export function hasEquipment(manifest) {
  return !!(manifest && manifest.build && typeof manifest.build === 'object' && manifest.build.type === 'equipment');
}

const cardOf = (style) => (typeof style === 'string' ? SEEDED_STYLES[style] : style);

/** Validate a build → an array of error strings, each naming the choices. */
export function validateBuild(build) {
  const errs = [];
  if (!build || typeof build !== 'object') return ['build: { type: "equipment", item, style, … }'];
  if (build.type !== 'equipment') errs.push(`build.type: '${build.type}' — the workbench knows 'equipment'`);
  if (!EQUIPMENT_ITEMS.includes(build.item)) errs.push(`build.item: '${build.item}' is not one of ${EQUIPMENT_ITEMS.join(', ')}`);
  const style = build.style ?? 'historical';
  if (typeof style === 'string') { if (!SEEDED_STYLES[style]) errs.push(`build.style: '${style}' is not a sample (${Object.keys(SEEDED_STYLES).join(', ')}); or pass an inline card`); }
  else errs.push(...validateStyleCard(style, 'build.style'));
  const d = build.dials || {};
  if (d.stylize !== undefined && !(Number.isFinite(d.stylize) && d.stylize >= 0 && d.stylize <= 1)) errs.push('build.dials.stylize: a number 0–1');
  if (d.mass !== undefined && !(Number.isFinite(d.mass) && d.mass >= 0.5 && d.mass <= 2)) errs.push('build.dials.mass: a number 0.5–2');
  if (d.ornament !== undefined && !(Number.isInteger(d.ornament) && d.ornament >= 0 && d.ornament <= 3)) errs.push('build.dials.ornament: an integer 0–3');
  const focus = d.focus ?? build.parts?.focus;
  if (focus !== undefined && FOCI[build.item] && !FOCI[build.item].includes(focus)) errs.push(`build focus: '${focus}' is not one of ${FOCI[build.item].join(', ')} for a ${build.item}`);
  for (const [slot, v] of Object.entries(build.parts || {})) {
    if (VARIANTS[slot]) { if (!VARIANTS[slot].includes(v)) errs.push(`build.parts.${slot}: '${v}' is not one of ${VARIANTS[slot].join(', ')}`); }
    else if (slot === 'bark') { if (!BARK_SPECIES.includes(v)) errs.push(`build.parts.bark: '${v}' is not one of ${BARK_SPECIES.join(', ')}`); }
    else if (!ITEM_KEYS.includes(slot)) errs.push(`build.parts.${slot}: not a slot — slots are ${[...Object.keys(VARIANTS), ...ITEM_KEYS].join(', ')}`);
  }
  if (build.gem !== undefined && build.gem !== null) {
    const g = typeof build.gem === 'string' ? { gem: build.gem } : build.gem;
    if (!g || !CRYSTAL_GEMS.includes(g.gem)) errs.push(`build.gem: '${g?.gem}' is not one of ${CRYSTAL_GEMS.join(', ')}`);
    if (g?.cut !== undefined && !CUTS.includes(g.cut)) errs.push(`build.gem.cut: '${g.cut}' is not one of ${CUTS.join(', ')}`);
    if (g?.glow !== undefined && !(Number.isFinite(g.glow) && g.glow >= 0 && g.glow <= 1)) errs.push('build.gem.glow: a number 0–1');
  }
  if (build.seed !== undefined && !Number.isInteger(build.seed)) errs.push('build.seed: an integer');
  if (build.laws !== undefined && build.laws !== LAWS_VERSION) errs.push(`build.laws: ${build.laws} is unknown — this kernel carries laws ${LAWS_VERSION}`);
  return errs;
}

/** Expand a (valid) build → { monomers, sockets, trace }. Throws with every error when invalid. */
export function expandEquipment(build) {
  const errs = validateBuild(build);
  if (errs.length) throw new Error(`Invalid equipment build:\n- ${errs.join('\n- ')}`);
  const card = cardOf(build.style ?? 'historical');
  const item = build.item, seed = build.seed ?? 1, parts = build.parts || {};
  const lang = { ...(card.language?.[item] || {}), ...parts };
  const focus = build.dials?.focus ?? parts.focus ?? (SWORDS[item] ? undefined : lang.focus) ?? card.dials?.focus ?? 'none';
  const d = { stylize: 0, mass: 1, ornament: 0, ...card.dials, ...build.dials, focus };
  const law = proportion(d);
  const lean = { W: 1, T: 1, L: 1, span: 1, grip: 1, pommel: 1, ...card.lean };
  const base = card.gem || null;
  const gem = build.gem === null ? null : build.gem === undefined ? base
    : typeof build.gem === 'string' ? { gem: build.gem, cut: base?.cut ?? 'brilliant', glow: base?.glow ?? 0.2 } : { cut: 'brilliant', glow: 0.2, ...build.gem };
  const ctx = { item, card: { ...card, language: card.language || {} }, d, law, lean, roles: card.roles, gem, parts, lang, seed };
  const out = SWORDS[item] ? buildSword(ctx) : buildItem(ctx);
  return { monomers: out.monomers, sockets: out.sockets, trace: { item, style: typeof build.style === 'string' ? build.style : card.id || 'inline', dials: d, laws: build.laws ?? LAWS_VERSION, ...out.trace } };
}

/** The manifest with its build expanded into monomers (merged before its own arrays); identity when absent. */
export function withEquipment(manifest) {
  if (!hasEquipment(manifest)) return manifest;
  const { monomers } = expandEquipment(manifest.build);
  const out = { ...manifest };
  for (const k of MONOMER_ARRAYS) if (monomers[k]?.length) out[k] = [...monomers[k], ...(Array.isArray(manifest[k]) ? manifest[k] : [])];
  return out;
}

/** The readout for `stats.equipment`: the focal, the sockets, the variants, the laws. */
export function equipmentReadout(build) {
  const { sockets, trace } = expandEquipment(build);
  return { item: trace.item, style: trace.style, laws: trace.laws, dials: { ...trace.dials, stylize: r3(trace.dials.stylize) }, variants: trace.variants, focal: trace.focal || null, sockets, length: trace.length, minFeature: trace.minFeature, ...(trace.bark ? { bark: trace.bark } : {}) };
}
