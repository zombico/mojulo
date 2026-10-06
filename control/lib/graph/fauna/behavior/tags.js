/**
 * tags — the notes on an animal that its bones cannot tell, as a closed vocabulary.
 *
 * SYSTEM ORIENTATION. A behavior (`relax`, `alert`, `eat`, `sleep`, …; ./index.js) is what an animal does, said once
 * for every animal. It resolves per species to a STRATEGY: how this body does it. Three things choose the strategy,
 * in this order of authority:
 *  1. CAPABILITIES (./capabilities.js), measured from the skeleton: four legs or two, wings, fins, a neck that reaches
 *     the ground, a tail long enough to wrap. Never authored. What the body cannot do, no tag can grant.
 *  2. TAGS (this file), authored per family with species overrides: the habits and the ecology that pick between
 *     strategies the body could equally do. A horse could lie down to relax; it dozes standing, so it is tagged
 *     `dozes-standing`. A sheep and a lion both fold their legs; the sheep chews the cud (`ruminant`).
 *  3. ORDER: a behavior's strategies are tried most specific first; the first whose needs and tags are met wins, and
 *     every behavior ends on a fallback any body can do. So every species resolves every behavior, and the answer
 *     says why (`resolveBehavior(...).why`).
 *
 * The rules a tag keeps:
 *  - a tag is a HABIT or an ECOLOGY, never a body fact (that is a capability) and never a pose (that is a strategy);
 *  - a tag is READ: every tag here is named by at least one strategy's `when` or `unless` (the test enforces it), so
 *    a tag that changes nothing cannot be added; add the strategy that reads it first;
 *  - a tag is set on the FAMILY where the habit is the family's, and a species adds (`add`) or drops (`drop`) it
 *    where it differs. Prose stays in a comment beside the tag, never in the tag.
 *  - nothing here reaches a plan: every species builds byte-identically.
 */

/** The vocabulary: each tag's group and the one line that says what it means. */
export const TAGS = Object.freeze({
  // diet: what it eats, and so how it eats
  grazer:     { group: 'diet', line: 'crops grass and low plants at the ground' },
  browser:    { group: 'diet', line: 'strips leaves and twigs at head height or above' },
  ruminant:   { group: 'diet', line: 'chews the cud at rest' },
  predator:   { group: 'diet', line: 'kills its food' },
  scavenger:  { group: 'diet', line: 'feeds on carcasses' },
  filter:     { group: 'diet', line: 'strains food from the water with the mouth open' },
  roots:      { group: 'diet', line: 'digs food out of the ground with the snout' },
  'handles-food': { group: 'diet', line: 'holds food in its hands, paws or foot to eat it' },
  // vigilance: what it does when something is wrong
  prey:       { group: 'vigilance', line: 'is hunted: it freezes head-high and ready to run' },
  'flags-tail': { group: 'vigilance', line: 'lifts its tail to flash an alarm' },
  freezes:    { group: 'vigilance', line: 'goes flat and still to hide' },
  'rears-to-look': { group: 'vigilance', line: 'stands up on its hind legs to look' },
  hoods:      { group: 'vigilance', line: 'rears and spreads a hood' },
  rattles:    { group: 'vigilance', line: 'coils and rattles its tail' },
  withdraws:  { group: 'vigilance', line: 'pulls its head into its shell' },
  // rest: how it rests and sleeps
  'dozes-standing': { group: 'rest', line: 'dozes on its feet, a hind leg cocked' },
  curls:      { group: 'rest', line: 'curls up nose to tail' },
  'lies-on-side': { group: 'rest', line: 'sprawls flat on its side' },
  'sits-upright': { group: 'rest', line: 'sits up on its haunches' },
  perches:    { group: 'rest', line: 'rests standing on a perch, a leg tucked' },
  'roosts-hanging': { group: 'rest', line: 'hangs upside down by its feet' },
  basks:      { group: 'rest', line: 'lies belly-flat soaking up the sun' },
  floats:     { group: 'rest', line: 'rests floating at the surface' },
  'keeps-swimming': { group: 'rest', line: 'never stops swimming, even at rest' },
});

/**
 * Each family's tags, with species overrides: `{ tags, species?: { <id>: { add?, drop? } } }`. Every family with
 * species has an entry (the test enforces it), even an empty one, so a missing family is a gap, not a default.
 */
export const FAMILY_TAGS = Object.freeze({
  canine:     { tags: ['predator', 'curls'] },
  feline:     { tags: ['predator'], species: {
    houseCat: { add: ['curls'] }, lion: { add: ['lies-on-side'] }, tiger: { add: ['lies-on-side'] } } },
  equine:     { tags: ['grazer', 'prey', 'dozes-standing'], species: {
    camel: { add: ['browser', 'ruminant'], drop: ['grazer', 'dozes-standing'] } } },   // camelids chew the cud and kneel to rest
  cervid:     { tags: ['browser', 'ruminant', 'prey', 'flags-tail'], species: { moose: { drop: ['flags-tail'] } } },
  bovid:      { tags: ['grazer', 'ruminant', 'prey'], species: { goat: { add: ['browser'], drop: ['grazer'] } } },
  giraffid:   { tags: ['browser', 'ruminant', 'prey', 'dozes-standing'] },
  suid:       { tags: ['roots', 'lies-on-side'] },
  pachyderm:  { tags: ['grazer'], species: {
    elephant: { add: ['browser', 'dozes-standing'], drop: ['grazer'] }, hippo: { add: ['floats'] } } },
  ursine:     { tags: ['rears-to-look', 'lies-on-side'], species: {
    giantPanda: { add: ['handles-food', 'sits-upright'], drop: ['rears-to-look'] },
    brownBear: { add: ['roots'] },   // digs roots, bulbs and burrowing rodents
    polarBear: { add: ['predator'] },
    wombat: { add: ['grazer'], drop: ['rears-to-look', 'lies-on-side'] } } },
  procyonid:  { tags: ['handles-food', 'curls'], species: { raccoon: { add: ['rears-to-look'] } } },
  macropod:   { tags: ['grazer', 'prey', 'rears-to-look', 'lies-on-side'] },
  rodent:     { tags: ['handles-food', 'sits-upright', 'prey'], species: { beaver: { add: ['browser', 'floats'] }, squirrel: { add: ['curls'] } } },
  mustelid:   { tags: ['predator', 'handles-food', 'floats', 'curls'] },   // the otter eats floating on its back
  monotreme:  { tags: ['predator', 'curls'] },
  leporid:    { tags: ['grazer', 'prey', 'freezes', 'rears-to-look'] },
  primate:    { tags: ['handles-food', 'sits-upright', 'rears-to-look', 'lies-on-side'] },   // sleeps on its side in a nest
  avian:      { tags: ['perches'], species: {
    vulture: { add: ['scavenger'] }, baldEagle: { add: ['predator'] }, greatHornedOwl: { add: ['predator'] },
    macaw: { add: ['handles-food'] },   // holds food in one foot
    mallard: { add: ['floats'], drop: ['perches'] },
    emperorPenguin: { add: ['predator'], drop: ['perches'] } } },
  crocodilian: { tags: ['predator', 'basks'] },
  testudine:  { tags: ['grazer', 'withdraws', 'basks'] },
  squamate:   { tags: ['predator', 'basks'], species: {
    kingCobra: { add: ['hoods'] }, rattlesnake: { add: ['rattles'] }, seaSerpent: { drop: ['basks'] } } },
  anuran:     { tags: ['predator', 'freezes'] },
  chiropteran: { tags: ['roosts-hanging', 'handles-food'] },   // a fruit bat holds fruit with its thumbs
  chondrichthyan: { tags: ['predator', 'keeps-swimming'], species: { mantaRay: { add: ['filter'], drop: ['predator'] } } },
  teleost:    { tags: [], species: { morayEel: { add: ['predator'] }, salmon: { add: ['predator'] } } },
  theropod:   { tags: ['predator'] },
  ceratopsian: { tags: ['browser'] },
  hadrosaur:  { tags: ['browser', 'prey'] },
  sauropod:   { tags: ['browser'] },
  thyreophoran: { tags: ['browser'] },
  pterosaur:  { tags: ['predator'] },
  plesiosaur: { tags: ['predator'] },
});

/** A species' tags: its family's, with its own added and dropped, in vocabulary order. */
export function tagsOf(family, id) {
  const F = FAMILY_TAGS[family]; if (!F) return null;
  const o = F.species?.[id] || {};
  const set = new Set([...F.tags, ...(o.add || [])]);
  for (const t of o.drop || []) set.delete(t);
  return Object.keys(TAGS).filter((t) => set.has(t));
}
