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
 *   THE CUT    the cloth itself, in the outfit grammar the hero wears (outfit/principles.js: a top, a bottom, an outer
 *              layer, their families, lengths on landmarks, closure and fit), DERIVED by principles, never picked from
 *              a list of outfits (cutFromSheet):
 *                mobility   what the role moves stays free: a flanker's or a ranger's legs in trousers, a draw arm in
 *                           a short sleeve, a frontline's arms sleeved under its armour
 *                station    the archetype's formality: how long the outer layer falls and how many layers (a ruler's
 *                           long coat over a gown, an outlaw's open jerkin)
 *                order      closure: bound is closed, tucked and woven (a placket); free is open, worn out, knit
 *                age, build fit and length: a youth shorter and closer, an elder longer and looser; a heavy build
 *                           eased, its mass broken by an opening
 *                anatomy    the lineage's must-see stays seen: over a tail the skirt gives way to trousers and the coat
 *                           stops at the hip; clawed feet go bare. And cloth goes where the body does not already
 *                           show itself: fur on the forearms and thighs ends the sleeve at the elbow and the leg at the
 *                           knee, in light cloth, with no collar over a ruff; scales are cold, so one layer more,
 *                           sleeved; chitin plates are the armour, so no shirt: a kilt and an open vest between the
 *                           plates; feathered wings leave the arms bare and the back uncloaked
 *                silhouette the word shapes the layer that carries it: a bell's full skirt, a column's long straight
 *                           coat, a needle's narrow coat and collar, a wedge's short layer under broad shoulders, a
 *                           barrel's layers at the middle
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

/** the archetype's FORMALITY (0 everyday … 1 court) and the role's MOBILITY (0 still … 1 always moving) */
export const STATION = Object.freeze({ ruler: 0.9, sage: 0.8, magician: 0.75, caregiver: 0.55, lover: 0.55, hero: 0.5, innocent: 0.45, creator: 0.4, explorer: 0.3, jester: 0.3, everyman: 0.25, outlaw: 0.15 });
export const MOBILITY = Object.freeze({ flanker: 1, ranged: 0.9, frontline: 0.8, support: 0.5, controller: 0.4, caster: 0.3, 'non-combatant': 0.2 });

/** THE CUT from the sheet by principles → { language, dials, colours, notes: [the reason for each choice] } */
/** what the lineage's body already shows: its cover (fur, scales, chitin) and where, its wings */
export function anatomyOf(sheet) {
  // only what the body DRAWS counts: the hero door draws a person (no fur, scales, tail or wings), whatever the notes say
  const P = sheet.ancestry?.door === 'creature' ? sheet.ancestry?.plan || {} : {}, kind = P.cover?.kind ?? null, where = new Set(P.cover?.where || []);
  // scales are cold only when they are the body's cover, not patches (all over: the belly scaled)
  return { cover: kind, where, fur: kind === 'fur', scales: kind === 'scales' && where.has('belly'), chitin: kind === 'chitin', wings: hasDerive(sheet, 'wings = feather'), ruff: kind === 'fur' && where.has('ruff') };
}

export function cutFromSheet(sheet, { silhouette, tailSeen } = {}) {
  const f = sheet.facets, a = f.archetype, notes = [], note = (n) => notes.push(n), A = anatomyOf(sheet);
  const bound = f.order < 0.4, free = f.order >= 0.6, youth = ['child', 'youth'].includes(f.age), elder = ['seasoned', 'elder'].includes(f.age);
  // scales are cold: the formality of the layering climbs a step (one layer more)
  const F = Math.max(0, Math.min(1, (STATION[a] ?? 0.4) + (elder ? 0.15 : youth ? -0.15 : 0) + (A.scales ? 0.2 : 0))), M = MOBILITY[f.role] ?? 0.5;
  const heavy = ['stout', 'brute'].includes(f.build), lithe = f.build === 'lithe';
  // the BOTTOM: a skirt only where nothing must move fast and no tail must read; else trousers, the knees free on the
  // quickest
  let bottom;
  if (A.chitin) { bottom = { kind: 'skirt', family: 'woven', leg: 'knee', cut: 'aline' }; note('a kilt to the knee, the plated legs moving free under it'); }
  else if (!tailSeen && M < 0.5 && (silhouette === 'bell' || F >= 0.6)) {
    const leg = F >= 0.75 ? 'maxi' : F >= 0.55 ? 'midi' : 'knee', cut = silhouette === 'bell' ? 'full' : ['column', 'needle'].includes(silhouette) ? 'pencil' : 'aline';
    bottom = { kind: 'skirt', family: 'woven', leg, cut }; note(`a ${cut === 'full' ? 'full' : cut === 'pencil' ? 'straight' : 'flared'} skirt to the ${leg === 'maxi' ? 'ankle' : leg === 'midi' ? 'calf' : 'knee'}: the ${a}'s ${silhouette}, and a role that need not run`);
  } else {
    const furred = A.fur && A.where.has('thigh'), leg = furred || (M >= 0.9 && F < 0.5) ? 'knee' : 'long';
    bottom = { family: 'woven', leg }; note(furred ? 'breeches to the knee: the furred legs show below' : tailSeen && M < 0.5 && F >= 0.6 ? `trousers, not a skirt: the tail must read` : leg === 'knee' ? `breeches to the knee: the ${f.role} moves fast` : `trousers: the ${f.role}'s legs free`);
  }
  // the TOP, always: woven and tucked when bound (a placket, tidy), knit and worn out when free; its sleeve by the work
  let sleeve = f.role === 'caster' ? 'long' : f.role === 'ranged' ? 'short' : f.role === 'frontline' ? 'long' : F >= 0.6 ? 'long' : youth || M >= 0.9 ? 'short' : 'elbow';
  const SL = ['none', 'cap', 'short', 'elbow', 'threeQuarter', 'long'], cap = (w, most) => (SL.indexOf(w) > SL.indexOf(most) ? most : w);
  let why = f.role === 'ranged' ? ' (the draw arm free)' : f.role === 'caster' ? ' (the casting hands framed)' : '';
  if (A.wings) { sleeve = 'none'; why = ' (the wings on the arms)'; } else if (A.fur && A.where.has('forearm') && SL.indexOf(sleeve) > SL.indexOf('elbow')) { sleeve = 'elbow'; why = ' (the furred forearm shows)'; }
  const top = A.chitin ? false : { family: (bound || F >= 0.6) && !A.fur ? 'woven' : 'knit', sleeve, hem: bound ? 'hip' : 'tunic', ...(F >= 0.6 && bound && !A.ruff ? { collar: true } : {}) };
  if (top) note(`a ${top.family === 'knit' && A.fur ? 'light knit' : top.family} top, ${sleeve === 'none' ? 'sleeveless' : sleeve === 'long' ? 'long-sleeved' : sleeve === 'short' ? 'short-sleeved' : 'sleeved to the elbow'}${why}, ${bound ? 'tucked: a bound order' : 'worn out: a free order'}`);
  else note('no shirt: the chitin plates are the ground');
  // the OUTER layer by station and silhouette: a coat at court, a jacket or jerkin between, a vest or nothing everyday
  let outer = null;
  const maxHem = tailSeen ? 'hip' : null, opened = free || heavy || (!bound && F >= 0.6);
  if (F >= 0.7) outer = { family: 'woven', sleeve: f.role === 'ranged' ? 'none' : 'long', hem: maxHem ?? (bottom.kind === 'skirt' ? 'maxi' : 'knee'), open: opened, cut: silhouette === 'bell' ? 'full' : ['column', 'needle'].includes(silhouette) ? 'pencil' : 'aline', ...(silhouette === 'needle' ? { collar: true } : {}) };
  else if (F >= 0.4 || silhouette === 'wedge' || silhouette === 'barrel') outer = { family: 'woven', sleeve: M >= 0.8 || silhouette === 'barrel' ? 'none' : 'elbow', hem: silhouette === 'wedge' ? 'hip' : maxHem ?? (silhouette === 'barrel' ? 'tunic' : F >= 0.55 ? 'knee' : 'tunic'), open: opened, cut: 'aline' };
  else if (bound) outer = { family: 'woven', sleeve: 'none', hem: 'waist', open: false };
  if (outer && ['column', 'needle'].includes(silhouette) && !tailSeen && F >= 0.4) Object.assign(outer, { hem: bottom.kind === 'skirt' ? 'maxi' : 'midi', cut: 'pencil', open: free });
  // between the plates: an open vest, the cloth a harness over the shell
  if (A.chitin) outer = { family: 'woven', sleeve: 'none', hem: F >= 0.5 ? 'tunic' : 'hip', open: true, cut: 'aline' };
  if (outer) { if (A.wings) outer.sleeve = 'none'; else if (A.fur && A.where.has('forearm')) outer.sleeve = cap(outer.sleeve, 'short');
    if (A.ruff) delete outer.collar; if (!top) outer.open = true; }
  if (outer) { const kind = outer.sleeve === 'none' ? (['waist', 'hip'].includes(outer.hem) ? 'vest' : 'jerkin') : ['knee', 'midi', 'maxi'].includes(outer.hem) ? 'coat' : 'jacket';
    const len = { waist: 'the waist', hip: 'the hip', tunic: 'mid-thigh', knee: 'the knee', midi: 'the calf', maxi: 'the ankle' }[outer.hem];
    note(`${outer.open ? 'an open' : 'a closed'} ${outer.cut === 'pencil' ? 'straight ' : outer.cut === 'full' ? 'full ' : ''}${kind} to ${len}: ${F >= 0.7 ? `the ${a}'s station` : silhouette === 'wedge' ? 'the wedge kept short under the shoulders' : silhouette === 'barrel' ? 'the barrel layered at the middle' : `the ${a}'s second layer`}${tailSeen && outer.hem === 'hip' ? ', short over the tail' : ''}${outer.open && heavy && !free ? ', open to break the mass' : ''}${A.scales ? ' (scales are cold: a layer more)' : ''}`); }
  // FIT BY ZONE: tight against loose (the contrast of fit is visual interest, and one full zone at most, the one the
  // silhouette lives in). Next to the skin under an outer layer, a second skin; fast legs in hose; the outline's
  // carrier the only full zone; everything else follows the body in
  const carrier = silhouette === 'barrel' ? 'outer' : ['bell', 'column'].includes(silhouette) ? 'outer' : null;
  if (top) top.fit = outer ? 'skin' : f.role === 'caster' ? 'eased' : heavy && !lithe ? 'eased' : 'fitted';
  if (bottom.kind !== 'skirt') bottom.fit = M >= 0.8 && !heavy && bottom.leg === 'long' ? 'skin' : 'fitted';
  // the full zone is EASED, not loose: a barrel is round (full at the middle, in at the hem), never a box
  if (outer) outer.fit = A.chitin ? 'fitted' : carrier === 'outer' || heavy ? 'eased' : 'fitted';
  if (![top?.fit, bottom.fit, outer?.fit].some((x) => x === 'skin' || x === 'fitted') && bottom.kind !== 'skirt') bottom.fit = 'fitted';
  note(`fit: ${[top && `the ${outer ? 'undershirt' : 'top'} ${top.fit === 'skin' ? 'a second skin' : top.fit}`, bottom.kind !== 'skirt' && `the ${bottom.leg === 'knee' ? 'breeches' : bottom.fit === 'skin' ? 'hose' : 'trousers'} ${bottom.fit === 'skin' ? 'skintight' : bottom.fit}`, outer && `the ${outer.sleeve === 'none' ? 'vest' : 'coat'} ${outer.fit}`].filter(Boolean).join(', ')}: tight against ${carrier ? `the ${silhouette}'s full ${silhouette === 'barrel' ? 'middle' : 'fall'}` : 'the shoulders'}`);
  // fit and length from age and build; the drawn style a little stylized; the dress notes' derives on top
  const fit = Math.max(0, Math.min(1, (lithe ? 0.3 : heavy ? 0.65 : 0.5) + (elder ? 0.1 : youth ? -0.1 : 0) + (hasDerive(sheet, 'outfit.fit +') ? 0.15 : 0)));
  const dials = { stylize: 0.35, fit: Math.round(fit * 100) / 100, coverage: 1, ornament: Math.min(3, 1 + (F >= 0.5 ? 1 : 0) + (hasDerive(sheet, 'armor.ornament +') ? 1 : 0)) };
  const focal = top.collar ? 'collar' : top.family === 'woven' && bound ? 'placket' : 'belt';
  // the feet: a creature's claws read bare; a person is shod, booted for the road and the fight, in shoes at court
  const human = sheet.ancestry?.door !== 'creature', feet = human ? (M >= 0.5 || ['explorer', 'outlaw', 'hero'].includes(a) ? 'boots' : 'shoes') : 'none';
  const language = { top, bottom, ...(outer ? { outer } : {}), feet, tuck: bound, focal };
  note(feet === 'none' ? 'bare feet: the claws read' : feet === 'boots' ? 'boots: the road and the fight' : 'shoes: indoors and at court');
  // the cloth's colour roles (60 / 30 / 10): the largest field the base. Under a short outer layer the legs wear its
  // colour too (one suit, the shirt the secondary showing at the front and the sleeves); under a long coat they barely
  // show, in leather. Without an outer layer the longer of top and bottom is the base
  const longOuter = outer && ['knee', 'midi', 'maxi'].includes(outer.hem), skirtBig = bottom.kind === 'skirt' && bottom.leg !== 'knee';
  const colours = !top ? { Outer: 'base', Bottom: 'base' } : outer ? { Outer: 'base', Top: 'secondary', Bottom: longOuter ? 'leather' : bottom.kind === 'skirt' ? 'secondary' : 'base' } : skirtBig ? { Top: 'secondary', Bottom: 'base' } : { Top: 'base', Bottom: 'secondary' };
  return { language, dials, colours, notes };
}

export function outfitFromSheet(sheet, { coat } = {}) {
  const f = sheet.facets, a = f.archetype, free = f.order >= 0.5, side = 'R';
  const tail = sheet.ancestry?.door === 'creature' ? sheet.ancestry?.plan?.tail : null, tailSeen = SEEN_TAILS.has(tail);
  // the sheet's own silhouette word when the archetype reads that way; the archetype's otherwise
  const said = deriveOf(sheet, 'silhouette ='), silhouette = said && (ARCHETYPE_SHAPES[a] || []).includes(said) ? said : SHAPE[a] ?? 'column';
  const pieces = [], cut = cutFromSheet(sheet, { silhouette, tailSeen });
  const long = ['knee', 'midi', 'maxi'].includes(cut.language.outer?.hem);
  // the station on the shoulders when no long coat already carries it; a sash where the cloth meets at the waist
  if (OFFICE.mantle.includes(a) && !long) pieces.push({ kind: 'mantle', clasp: false, why: `the ${a}'s station on the shoulder line` });
  if (OFFICE.sash.includes(a) && !(cut.language.outer && !cut.language.outer.open)) pieces.push({ kind: 'sash', why: 'marks the natural waist', ...(FOCAL[a] === 'sash' ? { role: 'focal', knotColour: 'accent' } : {}) });
  // a traveller's cloak, where no tail must read; a needle's rise
  // the cloak is the largest field the figure wears: it takes the base (60 / 30 / 10)
  if (['explorer', 'outlaw'].includes(a) && !tailSeen && !anatomyOf(sheet).wings) pieces.push({ kind: 'cloak', colour: 'base', why: `the ${a} travels: a cloak from the shoulders` });
  // a standing collar is the cloth it stands from: the base
  if (silhouette === 'needle' && !cut.language.outer?.collar) pieces.push({ kind: 'collar', colour: 'base', why: 'the needle\'s height: a collar standing behind the nape' });
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
  if (silhouette === 'wedge') for (const p of pieces) if (p.kind === 'pauldron') p.shoulder = 1.25;   // the wedge's broad shoulder line
  // restraint: six pieces at most, kept by what each is for (the garment, the focal, the station, the role's first
  // need, the asymmetric note, the waist, the role's second need, the detail)
  const rank = (p) => (p.role === 'focal' ? 1 : p.kind === 'mantle' ? 2 : p.why?.includes('asymmetric') ? 4 : p.kind === 'sash' ? 5 : p.role === 'detail' ? 7 : (ROLE_GEAR[f.role] ?? []).findIndex((g) => g.kind === p.kind) === 0 ? 3 : 6);
  const room = 5 - (cut.language.outer ? 1 : 0);   // the cloth (its base and its outer layer) counts toward the whole's six
  if (pieces.length > room) { const keep = new Set([...pieces].sort((x, y) => rank(x) - rank(y)).slice(0, room)); for (let i = pieces.length - 1; i >= 0; i--) if (!keep.has(pieces[i])) pieces.splice(i, 1); }
  // repetition: the trim on two pieces at least (the mantle's clasp takes it when only one wears it)
  const trims = () => pieces.filter((p) => (p.colour ?? defaultColour(p.kind)) === 'trim').length + pieces.filter((p) => p.kind === 'mantle' && p.clasp !== false).length;
  if (trims() < 2) { const m = pieces.find((p) => p.kind === 'mantle'); if (m) Object.assign(m, { clasp: true, claspColour: 'trim' }); }
  if (trims() < 2) { const m = pieces.find((p) => ['medallion', 'chain'].includes(p.kind)); if (m) m.cordColour = 'trim'; }
  if (trims() < 2) { const w = pieces.find((p) => p.kind === 'wraps'); if (w) w.colour = 'trim';
    else if (pieces.length < room) pieces.push({ kind: 'wraps', colour: 'trim', role: 'detail', why: 'the trim repeated small at the wrists, tying the outfit together' });
    // no room for one more: a piece already worn takes the trim
    else for (const r of pieces.filter((p) => p.role !== 'focal' && ['collar', 'baldric', 'sash', 'belt', 'bracers'].includes(p.kind))) { if (trims() >= 2) break; r.colour = 'trim'; } }
  const outfit = { intent: { silhouette, symmetry: free ? 'asymmetric' : 'symmetric', side, palette: outfitPalette(sheet, coat ?? sheet.ancestry?.colours?.Skin) },
    cut: { language: cut.language, dials: cut.dials, colours: cut.colours, notes: cut.notes }, pieces };
  const laws = outfitLaws(outfit, { order: f.order, archetype: a, mustSee: tailSeen ? ['tail'] : [] });
  return { outfit, laws };
}
/** THE CUT FOR THE HERO DOOR: the same derived cut as an inline outfit card for a person's record (`spec.outfit`), its
 * cloth coloured by the palette's roles, its trims, buttons and buckles in the trim's metal, its leather the palette's */
export function heroOutfitOf(outfit) {
  const P = outfit.intent.palette, C = outfit.cut.colours || {}, L = outfit.cut.language;
  const tones = { Top: P[C.Top ?? 'base'], Bottom: P[C.Bottom ?? 'secondary'], ...(L.outer ? { Outer: P[C.Outer ?? 'base'] } : {}), Trim: P.trim, Button: P.trim, Buckle: P.trim, Leather: P.leather, Shoes: P.leather };
  return { type: 'outfit', style: { id: 'designed', dials: outfit.cut.dials, language: L, tones: Object.fromEntries(Object.entries(tones).filter(([, v]) => v)) } };
}
const DEFAULT = { gown: 'base', robe: 'base', tunic: 'base', mantle: 'secondary', cloak: 'secondary', collar: 'secondary', sash: 'trim', belt: 'leather', baldric: 'leather', wraps: 'secondary', pauldron: 'secondary', bracers: 'leather', chain: 'accent', medallion: 'accent', satchel: 'leather', pack: 'leather', quiver: 'leather' };
const defaultColour = (kind) => DEFAULT[kind] ?? 'base';
