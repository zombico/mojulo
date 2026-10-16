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
import { conceptOf, dressByConcept } from './concept.js';
import { hexLch, lchHex } from '../polygonizer/station-loft-shade.js';
import { outfitLaws, ARCHETYPE_SHAPES } from '../polygonizer/outfit-plan.js';
import { SEEDED_OUTFITS } from '../outfit/styles.js';

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
/**
 * THE ERA'S KIT (the setting's era, setting.js): what a modern or a future world's people carry for their role, in place
 * of a myth's. A myth's or a rustic world's people (and a roll with no setting) wear ROLE_GEAR as they always did.
 *   gear    by role, as ROLE_GEAR: the modern carrier and pouches, a future hardshell in the metal
 *   focal   the archetypes whose myth focal is a myth's piece (a baldric, a pauldron no role brought), and the era's
 *   drop    the myth's pieces the era leaves off: a traveller's cloak, a mantle of office (its people wear coats)
 */
export const ERA_GEAR = Object.freeze({
  modern: {
    gear: {
      frontline: [{ kind: 'vest', colour: 'leather', why: 'a plate carrier takes the round on the chest' }, { kind: 'kneepads', colour: 'leather', why: 'the frontline kneels behind cover' }],
      flanker: [{ kind: 'pouches', why: 'a flanker carries its reloads on the belt, light' }],
      ranged: [{ kind: 'vest', cut: 'rig', colour: 'leather', why: 'a chest rig: the magazines where the support hand finds them' }],
      support: [{ kind: 'pack', colour: 'secondary', why: 'what the medic hands out is carried on the back' }],
      controller: [{ kind: 'pouches', why: 'the tools of the trade, on the belt' }],
      caster: [{ kind: 'satchel', why: 'the tech keeps its kit at the hip' }],
      'non-combatant': [],
    },
    focal: { hero: 'vest', outlaw: 'medallion' },
    drop: ['cloak', 'mantle'],
  },
  future: {
    gear: {
      frontline: [{ kind: 'vest', cut: 'hardshell', colour: 'metal', why: 'a hardshell over the chest' }, { kind: 'pauldron', pair: true, float: true, why: 'the plates stand off the shoulders' }],
      flanker: [{ kind: 'pouches', why: 'a flanker carries its cells on the belt, light' }, { kind: 'kneepads', colour: 'leather', why: 'the knees taken on landing' }],
      ranged: [{ kind: 'vest', cut: 'slick', colour: 'metal', why: 'a chest shell where the cells ride' }],
      support: [{ kind: 'pack', colour: 'secondary', why: 'the field kit on the back' }],
      controller: [{ kind: 'bracers', colour: 'metal', why: 'the wrist units it works the machines through' }],
      caster: [{ kind: 'bracers', colour: 'metal', why: 'the wrist units it works the machines through' }],
      'non-combatant': [],
    },
    focal: { outlaw: 'medallion' },
    drop: ['cloak', 'mantle'],
  },
});
/** the era's kit for a sheet (null for a myth's or a rustic world's people, and with no setting) */
export const eraKitOf = (sheet) => ERA_GEAR[sheet.setting?.era] ?? null;

/**
 * THE ERA'S LOOKS: what a modern or future world's people dress as, so a crowd is a leather jacket, a suit, fatigues and
 * an operative's coat, not one cut. Each look is a seeded outfit card (outfit/styles.js) and how the role's kit sits in it:
 *   style    the card
 *   owns     the garments whose tones are the look's own, never the world's (a leather jacket is black hide in any
 *            world; a suit is its suit's colour): the card's tones for them
 *   kit      how much of the role's ERA_GEAR it wears: 'full' all of it, 'light' no armour (no vest, kneepads or
 *            plates), 'concealed' nothing worn over the clothes but a satchel or wrist units (a suit, a long coat)
 *   vest     the vest's cut by role over the role's own (carrier, slick, rig, hardshell: outfit-plan.js)
 *   gear     the gear's colourway (the leather role: straps, pouches, a carrier, the boots): black, coyote, olive
 *   archetype, role   the leans that roll it (a weight per value; anything unnamed weighs 0.5)
 * Rolled once per person off the sheet's own seed and facets (eraLookOf), so a rank's members and a crowd vary.
 */
export const ERA_LOOKS = Object.freeze({
  modern: {
    biker: { style: 'biker', owns: ['Outer'], kit: 'light', gear: '#24201c', archetype: { outlaw: 4, jester: 2, explorer: 2, hero: 1.5 }, role: { flanker: 2.5, frontline: 1.5 } },
    tactical: { style: 'tactical', owns: ['Bottom'], kit: 'full', gear: '#26282b', vest: { flanker: 'slick' }, archetype: { hero: 2, everyman: 2, ruler: 1.5 }, role: { frontline: 4, ranged: 3, flanker: 2, support: 1.5 } },
    fatigues: { style: 'fatigues', owns: ['Top', 'Bottom'], kit: 'full', gear: '#6e6046', vest: { frontline: 'slick' }, archetype: { everyman: 3, caregiver: 2, hero: 1.5 }, role: { support: 3, frontline: 2.5, ranged: 2 } },
    suit: { style: 'suit', owns: ['Outer', 'Top', 'Bottom'], kit: 'concealed', gear: '#141110', archetype: { ruler: 4, sage: 2, magician: 2, lover: 2 }, role: { controller: 3, 'non-combatant': 2, support: 1 } },
    operative: { style: 'operative', owns: ['Outer', 'Top', 'Bottom'], kit: 'concealed', gear: '#111111', archetype: { magician: 2.5, outlaw: 2, explorer: 2, ruler: 1.5, lover: 1.5 }, role: { flanker: 3, controller: 2.5, ranged: 1.5 } },
    streetwear: { style: 'streetwear', kit: 'light', gear: '#2c2c2c', archetype: { innocent: 3, jester: 3, creator: 2.5, everyman: 2 }, role: { 'non-combatant': 3, support: 2, caster: 2 } },
    casual: { style: 'casual', kit: 'light', gear: '#4a3a2a', archetype: { everyman: 2.5, caregiver: 2.5, innocent: 2 }, role: { 'non-combatant': 3, support: 2 } },
  },
  future: {
    hardsuit: { style: 'flightsuit', kit: 'full', gear: '#2a2f38', archetype: { hero: 3, ruler: 2 }, role: { frontline: 5, ranged: 2 } },
    flightsuit: { style: 'flightsuit', kit: 'full', gear: '#20262e', vest: { frontline: 'slick', flanker: 'rig', ranged: 'rig' }, archetype: { explorer: 3, hero: 2, everyman: 2 }, role: { ranged: 2.5, flanker: 2, support: 2.5 } },
    runner: { style: 'runner', owns: ['Outer'], kit: 'light', gear: '#141519', archetype: { outlaw: 4, jester: 3, lover: 1.5 }, role: { flanker: 3, controller: 2 } },
    corporate: { style: 'corporate', owns: ['Outer'], kit: 'concealed', gear: '#2a2e36', archetype: { ruler: 4, sage: 3, magician: 2.5, creator: 2 }, role: { controller: 3, caster: 2.5, 'non-combatant': 2 } },
    athleisure: { style: 'athleisure', kit: 'light', gear: '#2b2f3a', archetype: { everyman: 2.5, caregiver: 2.5, innocent: 2 }, role: { 'non-combatant': 3, support: 2 } },
  },
});
const ARMOUR = new Set(['vest', 'kneepads', 'pauldron', 'chestPlate']);
const KEPT_CONCEALED = new Set(['satchel', 'bracers']);
/** a 32-bit FNV-1a of a string: the look's die, off the sheet's seed and facets */
const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
/** The look a modern or future person dresses as ({ id, ...ERA_LOOKS row }), rolled off its seed and facets; null for a
 * myth's or a rustic world's people. */
export function eraLookOf(sheet) {
  const looks = ERA_LOOKS[sheet.setting?.era]; if (!looks) return null;
  const f = sheet.facets, rows = Object.entries(looks).map(([id, L]) => [id, (L.archetype?.[f.archetype] ?? 0.5) * (L.role?.[f.role] ?? 0.5)]);
  const total = rows.reduce((a, [, w]) => a + w, 0), u = (fnv(`${sheet.seed}|${JSON.stringify(f)}`) / 2 ** 32) * total;
  let acc = 0; const id = (rows.find(([, w]) => (acc += w) > u) ?? rows[rows.length - 1])[0];
  return { id, ...looks[id] };
}
/** The role's era gear as the look wears it: its kit's share, the vest in the look's cut. */
export function lookGear(kit, look, role) {
  const gear = (kit?.gear[role] ?? []).filter((g) => (look.kit === 'full' ? true : look.kit === 'light' ? !ARMOUR.has(g.kind) : KEPT_CONCEALED.has(g.kind)));
  return gear.map((g) => (g.kind === 'vest' && look.vest?.[role] ? { ...g, cut: look.vest[role] } : { ...g }));
}
/** A card's garments → the palette's roles, as the derived cut assigns them (60 / 30 / 10: the largest field the base). */
const lookColours = (L) => (L.outer ? { Outer: 'base', Top: 'secondary', Bottom: ['knee', 'midi', 'maxi'].includes(L.outer.hem) ? 'leather' : 'base' } : { Top: 'base', Bottom: 'secondary' });
/** The owned garments' tones off the look's card (its leather jacket, its suit). */
export const lookTones = (look) => { const T = SEEDED_OUTFITS[look.style]?.tones ?? {}; return Object.fromEntries((look.owns ?? []).filter((g) => T[g]).map((g) => [g, T[g]])); };
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
  const f = sheet.facets, [L0, H] = HUES[f.archetype] ?? [44, 230], shadow = sheet.reading?.reads !== 'light', pp = peopleOf(sheet)?.palette ?? {};
  let L = L0 - (shadow ? 6 : 0) - (hasDerive(sheet, 'palette.Top -') ? 5 : 0) + (hasDerive(sheet, 'palette.Top +') ? 5 : 0) + (pp.dL ?? 0);
  const Lc = hexLch(coat)[0];
  if (Math.abs(L - Lc) < 18) L = Lc > 50 ? Lc - 22 : Math.min(85, Lc + 22);   // the garment a step from the coat
  const C = Math.max(6, (shadow ? 26 : 34) + (pp.dC ?? 0));   // a people's cloth richer or faded
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
  // the plate: worked iron or steel, never the trim's metal, a clear step from the trim and from the coat it lies on (a
  // plate in a cloth colour reads as cloth)
  const metal = PLATES.find((m) => Math.abs(hexLch(m)[0] - hexLch(trim)[0]) >= 12 && Math.abs(hexLch(m)[0] - Lc) >= 16) ?? PLATES.find((m) => Math.abs(hexLch(m)[0] - Lc) >= 16) ?? PLATES[0];
  return { base, secondary, trim, accent, leather: shadow ? '#5e4d3e' : '#6e4a2e', metal };
}
const PLATES = ['#8e949c', '#5d6168', '#a9aeb6', '#454950'];

/** A PEOPLE'S OWN DRESS: what a lineage's body and life ask of the cut, as tendencies on the grammar's axes, never an
 * outfit. Each reads the lineage's own lines (ancestry.js) and combines with the archetype, role and order:
 *   layers  ± the formality the layering reads (one layer more for a people that carries weight)
 *   length  ± steps on the outer layer's hem (long lines on long limbs; short hems keep a short body's legs)
 *   sleeve  the most sleeve any layer wears (the work, or the mass shown)
 *   open, collar, fit   the outer layer's closure, its standing collar, its fit
 *   palette { dL, dC }  lighter or darker, richer or faded */
export const PEOPLE = Object.freeze({
  sylvan: { why: 'long-limbed and light: long fitted lines, light and pale', length: 1, fit: 'fitted', palette: { dL: 8, dC: -8 } },
  dwarven: { why: 'built to carry stone: a layer more, heavy cloth, sleeves to the elbow for the work, hems short on a short body', layers: 0.2, length: -1, sleeve: 'elbow', palette: { dL: -4, dC: -8 } },
  orcish: { why: 'mass first: sleeveless and open, the arms and shoulders bare, eased over the bulk', sleeve: 'none', open: true, fit: 'eased', palette: { dL: -2, dC: -10 } },
  infernal: { why: 'sharp: closed and fitted, a standing collar, long and dark', length: 1, open: false, collar: true, fit: 'fitted', palette: { dL: -10, dC: 6 } },
  undead: { why: 'thin to the point of wrongness: the cloth hangs loose off the frame, long and faded', length: 1, fit: 'loose', palette: { dC: -14 } },
});
/** the people's dress a sheet reads, for a person only (a creature's body speaks through its anatomy instead) */
const peopleOf = (sheet) => (sheet.ancestry?.door !== 'creature' ? PEOPLE[sheet.facets.ancestry] ?? null : null);

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
  const Pp = peopleOf(sheet);
  const F = Math.max(0, Math.min(1, (STATION[a] ?? 0.4) + (elder ? 0.15 : youth ? -0.15 : 0) + (A.scales ? 0.2 : 0) + (Pp?.layers ?? 0))), M = MOBILITY[f.role] ?? 0.5;
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
  // the PEOPLE'S OWN DRESS over the archetype's: its length, its sleeve, its closure and collar
  if (Pp) {
    const COATS = ['waist', 'hip', 'tunic', 'knee', 'midi', 'maxi'];
    if (outer && Pp.length) outer.hem = COATS[Math.max(0, Math.min(COATS.length - 1, COATS.indexOf(outer.hem) + Pp.length))];
    if (Pp.sleeve) { if (top) top.sleeve = cap(top.sleeve, Pp.sleeve === 'none' ? 'short' : Pp.sleeve); if (outer) outer.sleeve = cap(outer.sleeve, Pp.sleeve); }
    if (outer && Pp.open !== undefined) outer.open = Pp.open;
    if (Pp.collar) { if (outer) outer.collar = true; else if (top) top.collar = true; }
    note(`the ${f.ancestry} dress: ${Pp.why}`);
  }
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
  if (outer && Pp?.fit) outer.fit = Pp.fit;
  if (![top?.fit, bottom.fit, outer?.fit].some((x) => x === 'skin' || x === 'fitted') && bottom.kind !== 'skirt') bottom.fit = 'fitted';
  note(`fit: ${[top && `the ${outer ? 'undershirt' : 'top'} ${top.fit === 'skin' ? 'a second skin' : top.fit}`, bottom.kind !== 'skirt' && `the ${bottom.leg === 'knee' ? 'breeches' : bottom.fit === 'skin' ? 'hose' : 'trousers'} ${bottom.fit === 'skin' ? 'skintight' : bottom.fit}`, outer && `the ${outer.sleeve === 'none' ? 'vest' : 'coat'} ${outer.fit}`].filter(Boolean).join(', ')}: tight against ${carrier ? `the ${silhouette}'s full ${silhouette === 'barrel' ? 'middle' : 'fall'}` : 'the shoulders'}`);
  // fit and length from age and build; the drawn style a little stylized; the dress notes' derives on top
  const fit = Math.max(0, Math.min(1, (lithe ? 0.3 : heavy ? 0.65 : 0.5) + (elder ? 0.1 : youth ? -0.1 : 0) + (hasDerive(sheet, 'outfit.fit +') ? 0.15 : 0)));
  const dials = { stylize: 0.35, fit: Math.round(fit * 100) / 100, coverage: 1, ornament: Math.min(3, 1 + (F >= 0.5 ? 1 : 0) + (hasDerive(sheet, 'armor.ornament +') ? 1 : 0)) };
  // the focal edge on what is WORN and seen: a collar only on cloth (a second skin has none), a placket only where the top
  // shows (no closed outer layer over it); the belt otherwise
  const topCloth = top && top.fit !== 'skin', topSeen = topCloth && !(outer && !outer.open);
  const focal = (topCloth && top.collar) || outer?.collar ? 'collar' : topSeen && top.family === 'woven' && bound ? 'placket' : 'belt';
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
  const pieces = [], kit = eraKitOf(sheet), look = kit && sheet.ancestry?.door !== 'creature' ? eraLookOf(sheet) : null;
  // a modern or future person's cut is its look's card (a leather jacket, a suit, fatigues), its fit the sheet's
  const cut = ((C) => (look ? { ...C, language: { ...SEEDED_OUTFITS[look.style].language }, colours: lookColours(SEEDED_OUTFITS[look.style].language), notes: [...C.notes, `the ${look.id} look: the ${look.style} card`] } : C))(cutFromSheet(sheet, { silhouette, tailSeen }));
  const roleGear = look ? lookGear(kit, look, f.role) : kit ? kit.gear[f.role] ?? [] : ROLE_GEAR[f.role] ?? [], focalOf = kit ? { ...FOCAL, ...kit.focal } : FOCAL, dropped = new Set(kit?.drop ?? []);
  const long = ['knee', 'midi', 'maxi'].includes(cut.language.outer?.hem);
  // the station on the shoulders when no long coat already carries it; a sash where the cloth meets at the waist
  if (OFFICE.mantle.includes(a) && !long && !dropped.has('mantle')) pieces.push({ kind: 'mantle', clasp: false, why: `the ${a}'s station on the shoulder line` });
  if (OFFICE.sash.includes(a) && !(cut.language.outer && !cut.language.outer.open)) pieces.push({ kind: 'sash', why: 'marks the natural waist', ...(focalOf[a] === 'sash' ? { role: 'focal', knotColour: 'accent' } : {}) });
  // a traveller's cloak, where no tail must read; a needle's rise
  // the cloak is the largest field the figure wears: it takes the base (60 / 30 / 10)
  if (['explorer', 'outlaw'].includes(a) && !tailSeen && !anatomyOf(sheet).wings && !dropped.has('cloak')) pieces.push({ kind: 'cloak', colour: 'base', why: `the ${a} travels: a cloak from the shoulders` });
  // a standing collar is the cloth it stands from: the base
  if (silhouette === 'needle' && !cut.language.outer?.collar) pieces.push({ kind: 'collar', colour: 'base', why: 'the needle\'s height: a collar standing behind the nape' });
  // what the role needs
  for (const g of roleGear) if (!pieces.some((p) => p.kind === g.kind)) pieces.push({ ...g });
  // the one focal piece: the archetype's, unless it is gear (armour, a vest) and the role brought none
  const focalKind = ['pauldron', 'vest'].includes(focalOf[a]) && !pieces.some((p) => p.kind === focalOf[a]) ? 'medallion' : focalOf[a];
  const own = pieces.find((p) => p.kind === focalKind);
  if (own) Object.assign(own, { role: 'focal', ...(focalKind === 'pauldron' || focalKind === 'baldric' ? { colour: own.colour ?? 'secondary' } : {}) });
  else pieces.push({ kind: focalKind, role: 'focal', why: focalKind === 'chain' ? 'the chain of office, near the face' : `the ${a}'s emblem, near the face` });
  if (hasDerive(sheet, 'armor.ornament +')) for (const p of pieces) if (p.kind === 'pauldron' && p.role === 'focal') p.colour = 'secondary';
  // a look with no accent worn (a uniform's focal is its carrier, in its gear colour) wears an ID band on the arm in it:
  // the accent a crowd of one colour is told apart by
  if (look && !pieces.some((p) => (p.colour ?? defaultColour(p.kind)) === 'accent')) pieces.push({ kind: 'armRings', colour: 'accent', role: 'detail', why: 'an ID band on the arm: the accent a crowd in one uniform is told apart by' });
  // order: a free character wears one asymmetric note; a bound one keeps it to one
  const asym = (p) => ['satchel', 'baldric'].includes(p.kind) || (p.kind === 'pauldron' && !p.pair);
  if (free && !pieces.some(asym)) pieces.push(OFFICE.mantle.includes(a) && !kit ? { kind: 'baldric', colour: 'trim', why: `the sash of office worn across the chest: the free ${a}'s one asymmetric note` } : { kind: 'satchel', why: 'what it carries, on one hip: its asymmetric note' });
  if (!free) for (const p of pieces) if (p.kind === 'pauldron') p.pair = true;
  if (silhouette === 'wedge') for (const p of pieces) if (p.kind === 'pauldron') p.shoulder = 1.25;   // the wedge's broad shoulder line
  // THE CONCEPT on a beast (concept.js): the cloth and the pieces agree with the character, and its own adornment joins
  const beast = sheet.ancestry?.door === 'creature', concept = beast ? conceptOf(sheet) : null;
  const agreed = beast ? dressByConcept(pieces, sheet, { A: anatomyOf(sheet), tailSeen, cut: cut.language, room: 5 - (cut.language.outer ? 1 : 0), concept }) : null;
  // restraint: six pieces at most, kept by what each is for (the garment, the focal, the station, the role's first
  // need, the asymmetric note, the waist, the role's second need, the detail)
  const rank = (p) => (p.role === 'focal' ? 1 : p.family ? 3.5 : p.kind === 'mantle' ? 2 : p.why?.includes('asymmetric') ? 4 : p.kind === 'sash' ? 5 : p.role === 'detail' ? 7 : roleGear.findIndex((g) => g.kind === p.kind) === 0 ? 3 : 6);
  const room = 5 - (cut.language.outer ? 1 : 0);   // the cloth (its base and its outer layer) counts toward the whole's six
  if (pieces.length > room) { const keep = new Set([...pieces].sort((x, y) => rank(x) - rank(y)).slice(0, room)); for (let i = pieces.length - 1; i >= 0; i--) if (!keep.has(pieces[i])) pieces.splice(i, 1); }
  // repetition: the trim on two pieces at least (the mantle's clasp takes it when only one wears it)
  const trims = () => pieces.filter((p) => (p.colour ?? defaultColour(p.kind)) === 'trim').length + pieces.filter((p) => (p.kind === 'mantle' && p.clasp !== false) || (p.kind === 'sash' && (p.knotColour ?? 'trim') === 'trim')).length;   // a sash's buckle is the trim's metal
  if (trims() < 2) { const m = pieces.find((p) => p.kind === 'mantle'); if (m) Object.assign(m, { clasp: true, claspColour: 'trim' }); }
  if (trims() < 2) { const m = pieces.find((p) => ['medallion', 'chain'].includes(p.kind)); if (m) m.cordColour = 'trim'; }
  // a focal sash is its cloth in the accent; its buckle can still be the trim's metal
  if (trims() < 2) { const k = pieces.find((p) => p.kind === 'sash' && p.knotColour === 'accent'); if (k) k.knotColour = 'trim'; }
  if (trims() < 2) { const w = pieces.find((p) => p.kind === 'wraps'); if (w) w.colour = 'trim';
    else if (pieces.length < room) pieces.push({ kind: 'wraps', colour: 'trim', role: 'detail', why: 'the trim repeated small at the wrists, tying the outfit together' });
    // no room for one more: a piece already worn takes the trim
    else for (const r of pieces.filter((p) => p.role !== 'focal' && ['collar', 'baldric', 'sash', 'belt', 'bracers'].includes(p.kind))) { if (trims() >= 2) break; r.colour = 'trim'; } }
  const palette = outfitPalette(sheet, coat ?? sheet.ancestry?.colours?.Skin);
  const outfit = { intent: { silhouette, symmetry: free ? 'asymmetric' : 'symmetric', side, palette: look ? { ...palette, leather: look.gear } : palette, ...(concept ? { concept: concept.word } : {}) },
    cut: { language: cut.language, dials: cut.dials, colours: cut.colours, notes: cut.notes }, pieces, ...(look ? { look: { id: look.id, tones: lookTones(look) } } : {}) };
  const laws = outfitLaws(outfit, { order: f.order, archetype: a, mustSee: tailSeen ? ['tail'] : [] });
  return { outfit, laws, ...(concept ? { concept: { ...concept, agreed } } : {}) };
}
/** THE FRAME ADORNED: a beast is not clothed. Its body (the silhouette, the fur, the scales, the plates) is the costume,
 * and what it wears accents the frame on its own landmarks: straps, bands, metal, a plate where it fights, what it
 * carries. The same principles read the sheet as for a person's cut, with no cloth:
 *   role       the gear the work asks (a frontline's plates, a flanker's baldric, a ranger's quiver and bow-arm bracer,
 *              a support's harness to carry by, a caster's wrapped hands, a controller's arm rings)
 *   station    metal grows with formality (a torc or a chain at court, arm rings between)
 *   archetype  the one focal (BEAST_FOCAL)
 *   order      symmetry: bound pairs, free one-sided notes
 *   anatomy    a ruff takes no torc (it would vanish in the fur); a winged back carries nothing; a tail that must read
 *              wears a ring at its root rather than nothing over it; chitin's straps are riveted
 *   the frame  the law that keeps the body the show: the adornment's area at most a frame's budget */
export const BEAST_FOCAL = Object.freeze({ ruler: 'chain', sage: 'medallion', magician: 'torc', hero: 'pauldron', outlaw: 'baldric', caregiver: 'medallion', innocent: 'medallion', lover: 'torc', explorer: 'harness', everyman: 'medallion', jester: 'armRings', creator: 'bracers' });
const BEAST_GEAR = Object.freeze({
  frontline: [{ kind: 'pauldron', why: 'the frontline takes the blow on the shoulder' }, { kind: 'bracers', why: 'the frontline guards with the forearms' }],
  flanker: [{ kind: 'baldric', why: 'a flanker carries the blade across the back, light' }, { kind: 'wraps', why: 'a flanker binds the wrists for grip' }],
  ranged: [{ kind: 'quiver', why: 'the ranger carries the arrows' }, { kind: 'bracers', why: 'the bow arm\'s guard', colour: 'leather' }],
  support: [{ kind: 'harness', why: 'a harness to carry by: what the support hands out rides on it' }, { kind: 'satchel', why: 'what the support hands out is kept at the hip' }],
  controller: [{ kind: 'armRings', why: 'the controller\'s bands of office on the arms' }],
  caster: [{ kind: 'wraps', why: 'the caster binds the hands that cast', colour: 'secondary' }],
  'non-combatant': [],
});

/** WARP AND DISTORT, the design phase's fantasy proportions: how far an archetype exaggerates (its ENERGY), and how a
 * lineage distorts (heavy frames CHUNK, sleek ones FLARE) */
export const ENERGY = Object.freeze({ jester: 1, hero: 0.85, outlaw: 0.85, magician: 0.75, explorer: 0.6, ruler: 0.6, lover: 0.55, creator: 0.5, sage: 0.45, innocent: 0.4, caregiver: 0.3, everyman: 0.25 });
export const DISTORT = Object.freeze({ ursine: { chunk: 1.8, flare: 1.1 }, draconic: { chunk: 1.5, flare: 1.5 }, lupine: { chunk: 1.2, flare: 1.4 }, feline: { chunk: 1, flare: 1.6 }, avian: { chunk: 1, flare: 1.7 }, insectoid: { chunk: 1.1, flare: 1.8 } });
export function distortOf(sheet) {
  const f = sheet.facets, a = Math.max(0, Math.min(1, (ENERGY[f.archetype] ?? 0.4) + (['child', 'youth'].includes(f.age) ? 0.1 : 0) + (f.order >= 0.6 ? 0.1 : f.order < 0.3 ? -0.1 : 0)));
  return { amount: Math.round(a * 100) / 100, side: 'R', ...(DISTORT[f.ancestry] ?? { chunk: 1.3, flare: 1.3 }) };
}

export function adornFromSheet(sheet, { coat } = {}) {
  const f = sheet.facets, a = f.archetype, A = anatomyOf(sheet), free = f.order >= 0.5, side = 'R';
  const tail = sheet.ancestry?.door === 'creature' ? sheet.ancestry?.plan?.tail : null, tailSeen = SEEN_TAILS.has(tail);
  const elder = ['seasoned', 'elder'].includes(f.age), youth = ['child', 'youth'].includes(f.age), heavy = ['stout', 'brute'].includes(f.build);
  const F = Math.max(0, Math.min(1, (STATION[a] ?? 0.4) + (elder ? 0.15 : youth ? -0.15 : 0)));
  const said = deriveOf(sheet, 'silhouette ='), silhouette = said && (ARCHETYPE_SHAPES[a] || []).includes(said) ? said : SHAPE[a] ?? 'column';
  const pieces = [], has = (k) => pieces.some((p) => p.kind === k);
  // the role's gear; a winged back carries nothing (the quiver moves to a hip satchel)
  for (const g of BEAST_GEAR[f.role] ?? []) { if (A.wings && ['quiver', 'pack'].includes(g.kind)) { if (!has('satchel')) pieces.push({ kind: 'satchel', why: 'carried at the hip: the back is the wings\'' }); continue; } pieces.push({ ...g }); }
  // a plate armours what the body does not: fur is the frame's display, scales all over and chitin its own armour
  if (f.role === 'frontline' && (F >= 0.5 || heavy) && !A.fur && !A.scales && !A.chitin) pieces.push({ kind: 'chestPlate', why: `a plate over the breast: the ${heavy ? 'heavy frame' : `${a}'s station`} fights in the front` });
  // station: metal on the frame (a torc or a chain at court, arm rings between); a ruff would swallow a torc
  if (F >= 0.7 && !has('chain')) pieces.push(A.ruff ? { kind: 'chain', why: 'a chain over the ruff: the station a torc would lose in the fur' } : { kind: 'torc', why: `the ${a}'s station in metal at the throat` });
  else if (F >= 0.45 && !has('armRings')) pieces.push({ kind: 'armRings', why: `bands of metal on the arms: the ${a}'s standing` });
  // WHAT THE FRAME OFFERS: the body's own features are where adornment belongs. A tail that must read wears a ring near its
  // root; scaled shins on a bird's legs are banded; bare digitigrade ankles under fur take anklets; chitin is strapped
  // and riveted between its plates; scales all over take metal bands on the arms
  const P = sheet.ancestry?.plan || {};
  if (tailSeen && (free || F >= 0.5)) pieces.push({ kind: 'tailRing', why: 'the tail adorned, not hidden: a ring near its root' });
  if (A.cover === 'scales' && A.where.has('shin') && !A.where.has('belly') && !has('anklets')) pieces.push({ kind: 'anklets', why: 'the scaled shins banded, as a bird\'s legs are ringed' });
  else if (A.fur && P.tail === 'thin' && !has('anklets')) pieces.push({ kind: 'anklets', why: 'the bare ankles of a cat\'s legs belled with metal' });
  if (A.chitin && !has('harness')) pieces.push({ kind: 'harness', why: 'straps between the plates, the shell showing through' });
  if (A.scales && !has('armRings')) pieces.push({ kind: 'armRings', why: 'metal bands on scaled arms' });
  // the archetype's one focal
  const want = BEAST_FOCAL[a] === 'pauldron' && !has('pauldron') ? 'torc' : BEAST_FOCAL[a];
  const focalKind = want === 'torc' && A.ruff ? 'chain' : want;
  const own = pieces.find((p) => p.kind === focalKind);
  if (own) Object.assign(own, { role: 'focal', ...(['pauldron', 'baldric', 'harness'].includes(focalKind) ? { colour: own.colour ?? 'secondary' } : {}) });
  else pieces.push({ kind: focalKind, role: 'focal', why: focalKind === 'chain' ? 'the chain of office, near the face' : `the ${a}'s emblem${['torc', 'medallion'].includes(focalKind) ? ', near the face' : ''}` });
  // one focal metal: a torc and a chain or medallion both at the throat, the focal keeps it
  const throat = pieces.filter((p) => ['torc', 'chain', 'medallion'].includes(p.kind)); if (throat.length > 1) for (const p of throat) if (p.role !== 'focal') pieces.splice(pieces.indexOf(p), 1);
  // a medallion where a harness crosses is mounted there, the harness's boss (a pendant on the straps, not on a chain)
  { const h = pieces.find((p) => p.kind === 'harness'), m = pieces.find((p) => p.kind === 'medallion'); if (h && m) { m.mount = 'harness'; h.mounted = true; m.why = `${m.why}: mounted where the harness crosses`; } }
  // PLATE is metal, not cloth: a pauldron or a breastplate wears the palette's plate metal (its focal motif embossed)
  for (const p of pieces) if (['pauldron', 'chestPlate'].includes(p.kind)) p.colour = 'metal';
  // chitin's straps riveted
  if (A.chitin) for (const p of pieces) if (['harness', 'baldric'].includes(p.kind)) Object.assign(p, { studs: 5, why: `${p.why}, riveted across the plates` });
  // THE CONCEPT (concept.js): what character this is decides what agrees; its own adornment (found, textile, ritual,
  // craft) joins the gear, so a beast is not only a gladiator
  const concept = conceptOf(sheet), agreed = dressByConcept(pieces, sheet, { A, tailSeen, room: 5, concept });
  // order: bound pairs, free one asymmetric note
  const asym = (p) => ['satchel', 'baldric', 'charms', 'trophy', 'toolRoll'].includes(p.kind) || (['pauldron', 'armRings', 'feathers', 'prayerBand'].includes(p.kind) && !p.pair) || (p.kind === 'streamers' && !p.pair && p.on !== 'tail');
  if (free && !pieces.some(asym)) { const r = pieces.find((p) => ['pauldron', 'armRings'].includes(p.kind)); if (r) r.why = `${r.why}, on one side: the free order's asymmetric note`; else if (!concept.refuses.includes('satchel')) pieces.push({ kind: 'satchel', why: 'what it carries, on one hip: its asymmetric note' }); }
  if (!free) for (const p of pieces) if (['pauldron', 'armRings'].includes(p.kind)) p.pair = true;
  // (no broadened shoulder line: a beast's own shoulders carry its silhouette, and its plates lie close on them)
  // restraint: five pieces at most, so the frame shows (the focal, the role's first need, the station, the asymmetric note)
  const rank = (p) => (p.role === 'focal' ? 0 : p.family ? 1.6 : (BEAST_GEAR[f.role] ?? []).findIndex((g) => g.kind === p.kind) === 0 ? 1 : ['tailRing', 'anklets'].includes(p.kind) || (p.kind === 'harness' && A.chitin) ? 1.5 : ['chestPlate', 'torc', 'chain', 'armRings'].includes(p.kind) ? 2 : asym(p) ? 3 : 5);
  if (pieces.length > 5) { const keep = new Set([...pieces].sort((x, y) => rank(x) - rank(y)).slice(0, 5)); for (let i = pieces.length - 1; i >= 0; i--) if (!keep.has(pieces[i])) pieces.splice(i, 1); }
  // repetition: the metal twice at least (a ring, studs, a band takes it)
  const trims = () => pieces.filter((p) => (p.colour ?? DEFAULT[p.kind] ?? 'base') === 'trim').length + pieces.filter((p) => p.cordColour === 'trim').length + pieces.filter((p) => ['bracers', 'chestPlate', 'harness', 'baldric'].includes(p.kind) || (p.kind === 'pauldron' && p.role !== 'focal')).length;
  if (trims() < 2) { const m = pieces.find((p) => ['medallion', 'chain'].includes(p.kind)); if (m) m.cordColour = 'trim'; }
  if (trims() < 2 && pieces.length < 5 && !has('armRings')) pieces.push({ kind: 'armRings', colour: 'trim', role: 'detail', pair: !free, why: 'the metal repeated small on the arms, tying the adornment together' });
  else if (trims() < 2) { const r = pieces.find((p) => p.role !== 'focal' && ['bracers', 'wraps', 'armRings', 'tailRing'].includes(p.kind)); if (r) r.colour = 'trim'; }
  // WARP AND DISTORT: the focal exaggerated, the rest kept smaller (contrast of scale); the dominant side's pairs grow
  // against the other's (the compile's asymmetry), heavy frames chunked, sleek ones flared
  const distort = distortOf(sheet);
  for (const p of pieces) p.scale = Math.round((p.role === 'focal' ? 1 + 0.9 * distort.amount : p.role === 'detail' ? 1 - 0.2 * distort.amount : 1 - 0.1 * distort.amount) * 100) / 100;
  const outfit = { intent: { silhouette, symmetry: free ? 'asymmetric' : 'symmetric', side, palette: outfitPalette(sheet, coat ?? sheet.ancestry?.colours?.Skin), distort, concept: concept.word }, pieces };
  const laws = outfitLaws(outfit, { order: f.order, archetype: a, mustSee: tailSeen ? ['tail'] : [], frame: true });
  return { outfit, laws, concept: { ...concept, agreed } };
}

/** THE CUT FOR THE HERO DOOR: the same derived cut as an inline outfit card for a person's record (`spec.outfit`), its
 * cloth coloured by the palette's roles, its trims, buttons and buckles in the trim's metal, its leather the palette's;
 * and the designed pieces over it (`pieces`, in the intent's palette), which the cut alone dropped */
export function heroOutfitOf(outfit) {
  const P = outfit.intent.palette, C = outfit.cut.colours || {}, L = outfit.cut.language;
  const tones = { Top: P[C.Top ?? 'base'], Bottom: P[C.Bottom ?? 'secondary'], ...(L.outer ? { Outer: P[C.Outer ?? 'base'] } : {}), Trim: P.trim, Button: P.trim, Buckle: P.trim, Leather: P.leather, Shoes: P.leather, ...(outfit.look?.tones ?? {}) };
  // the designed pieces ride the build (layered.js wears them over the cut, as a creature wears them); their reasons are
  // the outfit's readout, not the recipe's
  const pieces = (outfit.pieces || []).map(({ why: _w, ...p }) => p);
  const { palette, symmetry, side, distort } = outfit.intent;
  return { type: 'outfit', style: { id: 'designed', dials: outfit.cut.dials, language: L, tones: Object.fromEntries(Object.entries(tones).filter(([, v]) => v)) }, ...(outfit.cut.detail ? { detail: outfit.cut.detail } : {}),
    ...(pieces.length ? { pieces, intent: { palette, ...(symmetry ? { symmetry } : {}), ...(side ? { side } : {}), ...(distort ? { distort } : {}) } } : {}) };
}
const DEFAULT = { vest: 'secondary', pouches: 'leather', kneepads: 'secondary', gown: 'base', robe: 'base', tunic: 'base', mantle: 'secondary', cloak: 'secondary', collar: 'secondary', harness: 'leather', torc: 'trim', armRings: 'trim', anklets: 'trim', tailRing: 'trim', chestPlate: 'metal', sash: 'secondary', belt: 'leather', baldric: 'leather', wraps: 'secondary', pauldron: 'metal', bracers: 'leather', chain: 'accent', medallion: 'accent', satchel: 'leather', pack: 'leather', quiver: 'leather' };
const defaultColour = (kind) => DEFAULT[kind] ?? 'base';
