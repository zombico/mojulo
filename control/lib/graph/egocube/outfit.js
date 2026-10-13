/**
 * SHEET → OUTFIT: the Egocube designs what a character wears from who it is: its archetype, role, order, motivation,
 * age, reading and lineage, and the dress notes' derives. This replaces the stock kit by role (plan.js `kitOf`: every
 * support a porter's satchels and pack). Whether it wears armour, what it carries, its one focal piece, its
 * colours: each is a reading here, and each piece names its reason. The result is a plan's `outfit`
 * (polygonizer/outfit-plan.js), which compiles onto the body in layer order; a reference fills the same fields.
 *
 *   outfitFromSheet(sheet, { coat? })   { outfit, laws }: the outfit, and the visual-interest laws run over it (advisory)
 *
 * The readings, each a table below:
 *   SHAPE      the archetype's silhouette: a ruler's bell, a hero's wedge, an outlaw's needle (the sheet's own
 *              `silhouette = …` derive wins)
 *   GARMENT    the silhouette as its core garment: a bell is a gown (a robe on a male or an elder), a column a robe, a
 *              wedge, a needle or a barrel a tunic; a lineage whose tail is a must-see takes the tunic, which leaves
 *              the tail free
 *   ROLE_GEAR  what the role needs, no more: a frontline's armour, a ranger's quiver and bracer, a support's one
 *              satchel, a caster's focus
 *   FOCAL      the archetype's one focal piece: a ruler's chain of office, a sage's or magician's medallion, a hero's
 *              pauldron when armoured, an outlaw's baldric
 *   OFFICE     the archetypes whose station shows on the shoulders (a mantle) and the waist (a sash)
 *   HUES       the archetype's garment hue and value, darker and duller on the shadow reading; the secondary a clear
 *              step from it; the trim a metal by motivation (gold above the middle, silver below); the accent the trim
 *              brightened, worn by the focal alone
 *   order      bound: symmetric, one one-sided note at most; free: at least one asymmetric piece (a ruler's sash of
 *              office across the chest, a pauldron on one shoulder, a satchel on one hip)
 * Pure and deterministic.
 */
import { hexLch, lchHex } from '../polygonizer/station-loft-shade.js';
import { outfitLaws, ARCHETYPE_SHAPES } from '../polygonizer/outfit-plan.js';

export const SHAPE = Object.freeze({ ruler: 'bell', sage: 'bell', magician: 'bell', caregiver: 'bell', innocent: 'bell', lover: 'needle', hero: 'wedge', explorer: 'wedge', outlaw: 'needle', jester: 'needle', everyman: 'column', creator: 'column' });
export const HUES = Object.freeze({ ruler: [30, 300], sage: [36, 262], magician: [32, 288], hero: [40, 25], outlaw: [28, 150], caregiver: [52, 62], explorer: [44, 98], innocent: [82, 90], everyman: [44, 235], jester: [52, 335], lover: [46, 12], creator: [44, 192] });
export const ROLE_GEAR = Object.freeze({
  frontline: [{ kind: 'pauldron', why: 'the frontline takes the blow on the shoulder' }, { kind: 'bracers', why: 'the frontline guards with the forearms' }],
  flanker: [{ kind: 'baldric', why: 'a flanker carries the blade across the back, light' }, { kind: 'wraps', why: 'a flanker binds the wrists for grip' }],
  ranged: [{ kind: 'quiver', why: 'the ranger carries the arrows' }, { kind: 'bracers', why: 'the bow arm\'s guard', colour: 'leather' }],
  support: [{ kind: 'satchel', why: 'what the support hands out is kept at the hip' }],
  controller: [],
  caster: [{ kind: 'wraps', why: 'the caster binds the hands that cast', colour: 'secondary' }],
  'non-combatant': [],
});
export const FOCAL = Object.freeze({ ruler: 'chain', sage: 'medallion', magician: 'medallion', hero: 'pauldron', outlaw: 'baldric', caregiver: 'sash', innocent: 'medallion', lover: 'medallion', explorer: 'medallion', everyman: 'medallion', jester: 'medallion', creator: 'medallion' });
export const OFFICE = Object.freeze({ mantle: ['ruler', 'sage', 'magician', 'hero'], sash: ['ruler', 'caregiver', 'innocent', 'lover', 'sage'] });
/** a tail that is a must-see (a stub reads as body) */
const SEEN_TAILS = new Set(['thin', 'thick', 'brush']);
const GOLD = '#c9a24a', SILVER = '#b7bcc4', BRONZE = '#8c6239';

/** an L*C*h° colour that keeps its lightness: its chroma lowered until sRGB holds it (a clamped colour's lightness moves) */
const keepL = (L, C, H) => { for (let c = C; c >= 0; c -= 2) { const hex = lchHex(L, c, H); if (Math.abs(hexLch(hex)[0] - L) < 1) return hex; } return lchHex(L, 0, H); };
const hasDerive = (sheet, d) => Object.values(sheet.derives || {}).some((list) => list.includes(d));
const deriveOf = (sheet, prefix) => { for (const list of Object.values(sheet.derives || {})) for (const d of list) if (d.startsWith(prefix)) return d.slice(prefix.length).trim(); return null; };

/** the palette's roles: base (the garment), secondary, trim (a metal), accent (the trim brightened); each a clear value
 * step from the others and from the coat it is worn over */
export function outfitPalette(sheet, coat = '#8a5a38') {
  const f = sheet.facets, [L0, H] = HUES[f.archetype] ?? [44, 230], shadow = sheet.reading?.reads !== 'light';
  let L = L0 - (shadow ? 6 : 0) - (hasDerive(sheet, 'palette.Top -') ? 5 : 0) + (hasDerive(sheet, 'palette.Top +') ? 5 : 0);
  const Lc = hexLch(coat)[0];
  if (Math.abs(L - Lc) < 18) L = Lc > 50 ? Lc - 22 : Math.min(85, Lc + 22);   // the garment a step from the coat
  const C = shadow ? 26 : 34;
  // the secondary: 22 L* the other way, its hue turned 40° (an analogous neighbour), a little brighter
  // the trim: a metal by motivation (gold above the middle, silver below), the next metal when the garment sits too
  // close to it in value
  const metals = f.motivation >= 0.5 ? [GOLD, SILVER, BRONZE] : [SILVER, GOLD, BRONZE];
  let trim = metals.find((m) => Math.abs(hexLch(m)[0] - L) >= 18);
  // no metal clears it: the garment moves, to a value that clears both its metal and the coat
  if (!trim) { trim = metals[0]; const Lm = hexLch(trim)[0], want = L; let best = null;
    for (let x = 12; x <= 90; x += 1) if (Math.abs(x - Lc) >= 18 && Math.abs(x - Lm) >= 18 && (best === null || Math.abs(x - want) < Math.abs(best - want))) best = x;
    if (best !== null) L = best; }
  const [Lt, Ct, Ht] = hexLch(trim);
  // the secondary: a clear step from the garment and from the metal both; the first that clears them of these
  const Ls = [L < 50 ? L + 22 : L - 22, L < 50 ? L - 20 : L + 20, L + 32, L - 32, Lt - 24].find((x) => x >= 12 && x <= 90 && Math.abs(x - L) >= 16 && Math.abs(x - Lt) >= 16) ?? (L < 50 ? L + 22 : L - 22);
  const base = keepL(L, C, H), secondary = keepL(Ls, C + 6, (H + 40) % 360);
  // the accent: the trim stepped AWAY from the garment (brighter on a dark one, deeper on a light one), richer
  const lift = hasDerive(sheet, 'palette.Trim +') ? 14 : 10, La = L < Lt ? Math.min(94, Lt + lift) : Math.max(10, Lt - lift - 6);
  const Lacc = [La, L < 50 ? L + 30 : L - 30, Ls + 20, Ls - 20, L < 50 ? L + 44 : L - 44].find((x) => x >= 10 && x <= 94 && Math.abs(x - L) >= 15 && Math.abs(x - Ls) >= 15) ?? La;
  const accent = keepL(Lacc, Ct * 1.15, Ht);
  return { base, secondary, trim, accent, leather: shadow ? '#5e4d3e' : '#6e4a2e' };
}

export function outfitFromSheet(sheet, { coat } = {}) {
  const f = sheet.facets, a = f.archetype, free = f.order >= 0.5, side = 'R';
  const tail = sheet.ancestry?.plan?.tail, tailSeen = SEEN_TAILS.has(tail);
  // the sheet's own silhouette word when the archetype reads that way; the archetype's otherwise
  const said = deriveOf(sheet, 'silhouette ='), silhouette = said && (ARCHETYPE_SHAPES[a] || []).includes(said) ? said : SHAPE[a] ?? 'column';
  const pieces = [];
  // the core garment by the silhouette; a must-see tail keeps the skirt short
  const elder = ['seasoned', 'elder'].includes(f.age), female = f.pole === 'female';
  const core = tailSeen ? 'tunic' : silhouette === 'bell' ? (female && !elder ? 'gown' : 'robe') : silhouette === 'column' ? 'robe' : 'tunic';
  pieces.push({ kind: core, ...(hasDerive(sheet, 'outfit.fit +') ? { ease: 0.012 } : {}), why: core === 'tunic' && tailSeen ? `the ${a}'s ${silhouette} kept short, so the tail reads` : `the ${a}'s ${silhouette}: ${core === 'gown' ? 'falls from the shoulders, taken in at the waist' : core === 'robe' ? 'one long line from the shoulders' : 'a short garment, the legs free'}` });
  if (OFFICE.mantle.includes(a)) pieces.push({ kind: 'mantle', clasp: false, why: `the ${a}'s station on the shoulder line` });
  if (OFFICE.sash.includes(a) && core !== 'tunic') pieces.push({ kind: 'sash', why: 'marks the natural waist', ...(FOCAL[a] === 'sash' ? { role: 'focal', knotColour: 'accent' } : {}) });
  // what the role needs
  for (const g of ROLE_GEAR[f.role] ?? []) if (!pieces.some((p) => p.kind === g.kind)) pieces.push({ ...g });
  // the one focal piece: the archetype's, unless armour is the hero's and the role brought none
  const focalKind = FOCAL[a] === 'pauldron' && !pieces.some((p) => p.kind === 'pauldron') ? 'medallion' : FOCAL[a];
  const own = pieces.find((p) => p.kind === focalKind);
  if (own) Object.assign(own, { role: 'focal', ...(focalKind === 'pauldron' || focalKind === 'baldric' ? { colour: own.colour ?? 'secondary' } : {}) });
  else pieces.push({ kind: focalKind, role: 'focal', why: focalKind === 'chain' ? 'the chain of office, near the face' : `the ${a}'s emblem, near the face` });
  if (hasDerive(sheet, 'armor.ornament +')) for (const p of pieces) if (p.kind === 'pauldron' && p.role === 'focal') p.colour = 'secondary';
  // order: a free character wears one asymmetric note; a bound one keeps it to one
  const asym = (p) => ['satchel', 'baldric'].includes(p.kind) || (p.kind === 'pauldron' && !p.pair);
  if (free && !pieces.some(asym)) pieces.push(OFFICE.mantle.includes(a) ? { kind: 'baldric', colour: 'trim', why: `the sash of office worn across the chest: the free ${a}'s one asymmetric note` } : { kind: 'satchel', why: 'what it carries, on one hip: its asymmetric note' });
  if (!free) for (const p of pieces) if (p.kind === 'pauldron') p.pair = true;
  // repetition: the trim on two pieces at least (the mantle's clasp takes it when only one wears it)
  const trims = () => pieces.filter((p) => (p.colour ?? defaultColour(p.kind)) === 'trim').length + pieces.filter((p) => p.kind === 'mantle' && p.clasp !== false).length;
  if (trims() < 2) { const m = pieces.find((p) => p.kind === 'mantle'); if (m) Object.assign(m, { clasp: true, claspColour: 'trim' }); }
  if (trims() < 2) { const m = pieces.find((p) => ['medallion', 'chain'].includes(p.kind)); if (m) m.cordColour = 'trim'; }
  if (trims() < 2) { const w = pieces.find((p) => p.kind === 'wraps'); if (w) w.colour = 'trim'; else pieces.push({ kind: 'wraps', colour: 'trim', role: 'detail', why: 'the trim repeated small at the wrists, tying the outfit together' }); }
  // restraint: six pieces at most, kept by what each is for (the garment, the focal, the station, the role's first
  // need, the asymmetric note, the waist, the role's second need, the detail)
  const rank = (p) => (p.kind === core ? 0 : p.role === 'focal' ? 1 : p.kind === 'mantle' ? 2 : p.why?.includes('asymmetric') ? 4 : p.kind === 'sash' ? 5 : p.role === 'detail' ? 7 : (ROLE_GEAR[f.role] ?? []).findIndex((g) => g.kind === p.kind) === 0 ? 3 : 6);
  if (pieces.length > 6) { const keep = new Set([...pieces].sort((x, y) => rank(x) - rank(y)).slice(0, 6)); for (let i = pieces.length - 1; i >= 0; i--) if (!keep.has(pieces[i])) pieces.splice(i, 1); }
  const outfit = { intent: { silhouette, symmetry: free ? 'asymmetric' : 'symmetric', side, palette: outfitPalette(sheet, coat ?? sheet.ancestry?.colours?.Skin) }, pieces };
  const laws = outfitLaws(outfit, { order: f.order, archetype: a, mustSee: tailSeen ? ['tail'] : [] });
  return { outfit, laws };
}
const DEFAULT = { gown: 'base', robe: 'base', tunic: 'base', mantle: 'secondary', sash: 'trim', belt: 'leather', baldric: 'leather', wraps: 'secondary', pauldron: 'secondary', bracers: 'leather', chain: 'accent', medallion: 'accent', satchel: 'leather', pack: 'leather', quiver: 'leather' };
const defaultColour = (kind) => DEFAULT[kind] ?? 'base';
