/**
 * THE CONCEPT: what character this is, read off the sheet BEFORE a piece is chosen, so the wardrobe agrees with itself
 * (no sash over a cuirass's fauld, no plate on a scholar, no worked gold on a people near the beast). A concept is a
 * WORD with a card:
 *   reads      the character in a line (the thesis says it)
 *   families   the adornment that is not gear, in the order it reaches for it (outfit-plan.js OUTFIT_KINDS: charms,
 *              feathers, streamers, warpaint, prayerBand, toolRoll, trophy), each the FAMILY it speaks for
 *   refuses    the kinds that are not this character's: dropped from whatever the cut, the role or the station chose
 *   material   what its found and worked things are of (the ledger says it; the palette's trim is still the metal)
 *
 *   conceptOf(sheet)                    → { word, also?, reads, families, refuses, material, count }
 *   dressByConcept(pieces, sheet, ctx)  the pieces made to agree (refused dropped, disagreeing pairs resolved) and the
 *                                       concept's family pieces added that fit the body; mutates `pieces`, returns the
 *                                       reasons (what was dropped and why) for the readout
 *
 * The word comes from the archetype; the role can turn it (a frontline sage is a scholar who fights: a warrior's
 * families after its own, refusing only what both refuse); a people below the clothed line (plan.js CLOTHED_H) is WILD.
 * Pure, deterministic, no dice.
 */
const FAMILY = Object.freeze({ charms: 'found', feathers: 'found', trophy: 'found', streamers: 'textile', warpaint: 'ritual', prayerBand: 'ritual', toolRoll: 'craft' });
export const CONCEPTS = Object.freeze({
  warrior: { reads: 'a fighter: what it wears it took, or it keeps it alive', families: ['trophy', 'warpaint', 'charms'], refuses: ['toolRoll'], material: 'iron and bone' },
  noble: { reads: 'rank worn: fine cloth and precious metal, nothing carried', families: ['streamers', 'prayerBand'], refuses: ['harness', 'toolRoll', 'trophy', 'warpaint', 'charms', 'satchel'], material: 'gold' },
  scholar: { reads: 'learning worn as rank: the tools of the work, no weapon', families: ['toolRoll', 'prayerBand'], refuses: ['chestPlate', 'pauldron', 'trophy', 'warpaint'], material: 'brass and ink' },
  mystic: { reads: 'the unseen made visible: bells, runes, marks on the skin', families: ['charms', 'prayerBand', 'warpaint', 'feathers'], refuses: ['chestPlate', 'toolRoll'], material: 'bone and bronze' },
  wanderer: { reads: 'the road carried: found things tied on, weather on everything', families: ['feathers', 'charms', 'toolRoll'], refuses: ['torc'], material: 'leather and bone' },
  artisan: { reads: 'the work worn: tools at the hip, the hands free', families: ['toolRoll', 'charms'], refuses: ['trophy', 'streamers'], material: 'iron and wood' },
  healer: { reads: 'care carried: herbs and charms, nothing that threatens', families: ['toolRoll', 'charms', 'prayerBand'], refuses: ['trophy', 'warpaint', 'chestPlate', 'pauldron'], material: 'wood and cloth' },
  trickster: { reads: 'play worn loud: streamers, bells, colour that moves', families: ['streamers', 'charms', 'feathers'], refuses: ['prayerBand', 'chestPlate'], material: 'brass and ribbon' },
  wild: { reads: 'a people near the beast: found things and marks on the skin, little worked metal', families: ['warpaint', 'feathers', 'trophy', 'charms'], refuses: ['chestPlate', 'torc', 'chain'], material: 'bone, feather and ochre' },
});
export const CONCEPT_WORDS = Object.freeze(Object.keys(CONCEPTS));
/** what a people near the beast makes and wears of its own (no worked rank, no tools of a trade) */
const WILD_MAKES = Object.freeze(['warpaint', 'feathers', 'trophy', 'charms', 'streamers']);
const BY_ARCHETYPE = Object.freeze({ ruler: 'noble', lover: 'noble', sage: 'scholar', magician: 'mystic', hero: 'warrior', outlaw: 'trickster', jester: 'trickster', explorer: 'wanderer', innocent: 'wanderer', everyman: 'artisan', creator: 'artisan', caregiver: 'healer' });
/** the station (formality) by archetype, as the outfit reads it (outfit.js STATION) */
const STATION = Object.freeze({ ruler: 0.9, sage: 0.8, magician: 0.75, caregiver: 0.55, lover: 0.55, hero: 0.5, innocent: 0.45, creator: 0.4, explorer: 0.3, jester: 0.3, everyman: 0.25, outlaw: 0.15 });

/** The concept a sheet's character is. `clothedAt`: the humanity under which a people is wild (plan.js CLOTHED_H). */
export function conceptOf(sheet, { clothedAt = 0.25 } = {}) {
  const f = sheet.facets, beast = sheet.ancestry?.door === 'creature' && f.humanity < clothedAt;
  // the WILD keep the archetype's flavour in the things that are theirs to wear (a wild mystic's bone charms, a wild
  // warrior's trophy, a wild noble's feathers): the archetype's own families that a people near the beast would make,
  // first, then the wild's
  const own = BY_ARCHETYPE[f.archetype] ?? 'wanderer', word = beast ? 'wild' : own;
  // the role turns it: a frontline that is not already a warrior fights too
  const also = f.role === 'frontline' && word !== 'warrior' && own !== 'warrior' ? 'warrior' : null;
  const C = CONCEPTS[word], X = also ? CONCEPTS[also] : null;
  const flavour = beast ? [...(own === 'noble' ? ['feathers', 'streamers'] : []), ...CONCEPTS[own].families.filter((k) => WILD_MAKES.includes(k))] : [];
  const families = [...new Set([...flavour, ...C.families, ...(X ? X.families.slice(0, 1) : [])])];
  const refuses = X ? C.refuses.filter((k) => X.refuses.includes(k) || !['chestPlate', 'pauldron', 'trophy', 'warpaint'].includes(k)) : [...C.refuses];
  // how many of its own: the wild and the low in station wear more found things; the court less (its rank is the cloth)
  const F = STATION[f.archetype] ?? 0.4, count = word === 'wild' ? 3 : word === 'noble' ? 1 : F >= 0.7 ? 1 : 2;
  return { word, ...(beast ? { flavour: own } : {}), ...(also ? { also } : {}), reads: beast ? `${C.reads}; a ${own} among them` : X ? `${C.reads}; and it fights` : C.reads, families, refuses, material: C.material, count };
}

/**
 * Make the pieces agree with the concept, then add its own. ctx: { A (outfit.js anatomyOf), tailSeen, cut? (the cut's
 * language when clothed), room (the most pieces the outfit keeps) }. Returns the reasons, for the readout.
 */
export function dressByConcept(pieces, sheet, { A = {}, tailSeen = false, cut = null, room = 5, concept = conceptOf(sheet) } = {}) {
  const why = [], drop = (p, reason) => { pieces.splice(pieces.indexOf(p), 1); why.push(`${p.kind}: ${reason}`); };
  // REFUSED: a piece the character would not wear; a refused focal hands the focal to the concept's first family piece
  let focalLost = false;
  for (const p of [...pieces]) if (concept.refuses.includes(p.kind)) { if (p.role === 'focal') focalLost = true; drop(p, `not the ${concept.word}'s (${concept.reads})`); }
  // PAIRS THAT DISAGREE: a sash over a cuirass's fauld (the plate is the waist), a cloak over wings, a satchel and a
  // tool roll on one hip
  const has = (k) => pieces.find((p) => p.kind === k);
  if (has('sash') && pieces.some((p) => p.kind === 'chestPlate' && p.cut === 'cuirass')) drop(has('sash'), 'the cuirass\'s fauld is the waist: no sash over it');
  if (has('cloak') && A.wings) drop(has('cloak'), 'a cloak would bury the wings');
  // THE CONCEPT'S OWN: its families in order, each that fits the body and is not already worn
  const sleeved = (w) => cut && ['long', 'threeQuarter'].includes(w);
  const fits = (k) => {
    if (has(k)) return false;
    if (k === 'warpaint') return !sleeved(cut?.top?.sleeve) && !sleeved(cut?.outer?.sleeve);   // a painted arm under a sleeve is not seen
    if (k === 'feathers') return !A.wings;                                                       // a bird's arm is feathered already
    if (k === 'charms' || k === 'trophy') return !has('charms') && !has('trophy');              // one thing hung at the hip
    if (k === 'toolRoll') return !has('pack');
    return true;
  };
  // ORDER: a bound character wears its arm pieces in pairs and one thing at most on one hip; a free one wears them on
  // one side (its asymmetric note)
  const bound = sheet.facets.order < 0.5, HIP = ['satchel', 'charms', 'trophy', 'toolRoll'];
  // ROOM: the concept's pieces fill the room the gear and the station leave, never fewer than one (the character always
  // shows in something of its own), never more than its count
  const take = Math.min(concept.count, Math.max(1, room - pieces.length));
  const added = [];
  for (const k of concept.families) { if (added.length >= take) break; if (!fits(k)) continue;
    if (bound && HIP.includes(k) && pieces.some((p) => HIP.includes(p.kind))) {
      // the hip is taken: a plain satchel gives way to the character's own (a tool roll is the artisan's satchel)
      const sat = pieces.find((p) => p.kind === 'satchel' && p.role !== 'focal');
      if (!sat || pieces.some((p) => HIP.includes(p.kind) && p !== sat)) continue;
      drop(sat, `the hip carries the ${concept.word}'s ${k} instead`); }
    const piece = { kind: k, family: FAMILY[k], why: `the ${concept.word}'s ${FAMILY[k]}: ${concept.reads}`, ...(bound && ['feathers', 'streamers', 'prayerBand'].includes(k) ? { pair: true } : {}) };
    if (k === 'streamers' && tailSeen) piece.on = 'tail';
    if (k === 'charms') piece.charm = concept.word === 'mystic' || concept.word === 'trickster' ? 'bell' : concept.word === 'wild' || concept.word === 'warrior' ? 'bone' : 'both';
    pieces.push(piece); added.push(piece); }
  if (focalLost && added.length) Object.assign(added[0], { role: 'focal', why: `${added[0].why}; the focal` });
  // past the room by its one piece: the latest piece the station or the gear only suggested gives way (never the focal)
  while (pieces.length > room) { const last = [...pieces].reverse().find((p) => p.role !== 'focal' && !p.family); if (!last) break; drop(last, 'past the outfit\'s room: the character\'s own piece shows instead'); }
  return why;
}
