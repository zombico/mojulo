/**
 * THE CUE LEXICON: a sheet's notes read as the beast's anatomy words (./cards.js names the principle behind each), so a
 * people the kin presets do not know, a lineage of the operator's own, is COMPOSED on the tiered body from what its sheet
 * says, not refused to the sixth generation. A table, not a parser: each row a plain-words pattern over a note's line and
 * the word it sets; a people's nearest library skull by its family words; and the parts the composer does not carry yet,
 * named, so a line that asks for one is pending in the ledger with its reason, never dropped.
 *
 *   WORD_ROWS          { word, value | mass, re, ch? }: a line that matches sets the word (`mass` rows lean the girths, each
 *                      a multiplier, composing); `ch` keeps a row to its channel (the hair channel's hair)
 *   SKULL_FAMILIES     { re, head }: the library skull nearest a people's family words (its lineage's reads and its notes),
 *                      the first that matches; `provisional` where it is only the nearest muzzle
 *   GAP_ROWS           { re, part, carried? }: a part the composer lacks (hooves, a horse's body, horns, antennae …):
 *                      pending, named; `carried` the library ornament that stands for it where the people's skull has one
 *   SKULL_SPECIES      the ornaments a library skull carries as its species' own (the dragon's horns, the insect's
 *                      antennae): a people's nearest skull keeps one only where its own lines ask for it
 *   readAnatomy(sheet) → { words, head, placed: Map(line → where it landed), gaps: Map(line → [the gap rows it asks
 *                        for]), asks: Set(the carried ornaments its lines ask for) }
 *
 * Only the LINEAGE's own lines are read (a note `from` its ancestry): the build's, the archetype's and the age's lines
 * are carried by the cast and the head as they are for a preset kin.
 *
 * The structured derives and plan hints a cue carries (`legs = …`, `head = …`, `tail`, `claws`, `cover`) are read by
 * the route itself (egocube/plan.js beastOf) and stand over these words; the lexicon fills what they leave. A row is a
 * first reading the character loop iterates: a new word is a row. Pure.
 */
import { BEAST_BASE } from './cards.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** the rows: the first row of a word that matches a line sets it (mass rows compose), read in channel order */
export const WORD_ROWS = Object.freeze([
  // the lower body
  { word: 'legs', value: 'serpent', re: /\b(coil|coils|serpent'?s? (tail|body|lower body)|snake'?s? (tail|body|lower body)|lamia|naga)\b/ },
  { word: 'legs', value: 'digitigrade', re: /\b(digitigrade|raised heels?|heels? raised|hocks?|reverse[- ]jointed|backward[- ]bending knees|on (its|their) toes)\b/ },
  // the appendages
  { word: 'abdomen', value: 'gaster', re: /\b(abdomen|gaster|segmented (body|hind ?body))\b/ },
  { word: 'tail', value: 'none', re: /\b(no tail|tailless)\b/ },
  { word: 'tail', value: 'thick', re: /\b(thick|heavy|club(bed)?|powerful|crocodile'?s?|lizard'?s?)\b[^.;]*\btail\b|\btail\b[^.;]*\b(thick|heavy) at the root\b/ },
  { word: 'tail', value: 'brush', re: /\b(brush|bushy|fluffy|plumed|fox'?s?)\b[^.;]*\btail\b/ },
  { word: 'tail', value: 'stub', re: /\b(stub|stubby|short|bobbed|docked)\b[^.;]*\btail\b/ },
  { word: 'tail', value: 'thin', re: /\btail\b/ },
  // the limbs
  { word: 'arms', value: 4, re: /\b(second pair of arms|four arms|two pairs of arms|extra (pair of )?arms)\b/ },
  { word: 'wings', value: 'arms', re: /\b(wings on the arms|arm-?wings|wings? (along|from|on) (the|its|their) arms|flight feathers trailing from the (wrists?|arms?))\b/ },
  // the hands and feet
  { word: 'fingers', value: 3, re: /\b(three|3)[- ](clawed |taloned |long )?(fingers?|fingered)\b/ },
  { word: 'fingers', value: 4, re: /\b(four|4)[- ](clawed |taloned |long )?(fingers?|fingered)\b/ },
  { word: 'toes', value: 3, re: /\b(three|3)[- ](clawed |taloned )?toes?\b/ },
  { word: 'toes', value: 4, re: /\b(four|4)[- ](clawed |taloned )?toes?\b/ },
  { word: 'claws', value: 'long', re: /\b(talons?|taloned|long claws|hooked claws|sickle claws|sharp claws|clawed fingers?)\b/ },
  { word: 'claws', value: 'blunt', re: /\b(claws?|clawed)\b/ },
  // the integument
  { word: 'cover', value: 'feathers', re: /\b(feathers|feathered|plumage)\b/ },
  { word: 'cover', value: 'chitin', re: /\b(chitin|chitinous|carapace|exoskeleton|plated shell)\b/ },
  { word: 'cover', value: 'scales', re: /\b(scales|scaled|scaly|scutes)\b/ },
  { word: 'cover', value: 'fur', re: /\b(fur|furred|furry|pelt)\b/ },
  { word: 'coat', value: 'lower', re: /\b(from|below) the (waist|hips) down\b|\b(starting|beginning) at the (waist|hips)\b/ },
  { word: 'hair', value: true, ch: 'hair', re: /\b(hair|braids?|braided|locks|tresses)\b/ },
  // the ornaments
  { word: 'ridge', value: 'spines', re: /\b(crest of spikes|spines down|spiked back|dorsal spines|row of spikes|spined back)\b/ },
  { word: 'ruff', value: 'ruff', re: /\b(ruff|mane|collar of fur|shaggy neck)\b/ },
  // the stance
  { word: 'hunch', value: 18, re: /\b(hunched|hunchbacked|stooped|bent-backed)\b/ },
  { word: 'hunch', value: 14, re: /\b(forward-leaning|leaning forward|a forward lean|prowling)\b/ },
  // the masses (multipliers over the base's girths, composing; a hump or a keel, 0 … 1)
  { word: 'mass', mass: { trunk: 1.15, neck: 1.3, upperArm: 1.2, foreArm: 1.2, hand: 1.15, thigh: 1.2, shank: 1.15, foot: 1.1 }, re: /\b(hulking|massive|enormous|huge|bulky|heavy-set|heavyset|mountainous)\b/ },
  { word: 'mass', mass: { trunk: 1.1, waist: 1.25 }, re: /\b(barrel|barrel-bodied|portly|pot-bellied|round-bellied|rotund)\b/ },
  { word: 'mass', mass: { trunk: 0.93, waist: 0.9, upperArm: 0.9, foreArm: 0.9, thigh: 0.92, shank: 0.92 }, re: /\b(slender|slim|lithe|willowy|wiry|gaunt|svelte)\b(?! (muzzle|snout|face|tail|neck|ears?|horns?|antennae))/ },
  { word: 'mass', mass: { upperArm: 0.85, foreArm: 0.82, hand: 0.88, thigh: 0.92, shank: 0.85 }, re: /\b(thin|spindly|slender|stick-thin|insect-thin)( hard)? (limbs|arms and legs)\b/ },
  { word: 'mass', mass: { trunk: 1.06, upperArm: 1.1 }, re: /\b(broad|wide)( |-)shoulder(s|ed)\b/ },
  { word: 'mass', mass: { waist: 0.7 }, re: /\b(wasp'?s? waist|wasp-waisted|pinched waist|narrow waist)\b/ },
  { word: 'mass', mass: { neck: 1.4 }, re: /\b(thick|bull|heavy|short) neck\b|\bneck as thick\b/ },
  { word: 'mass', mass: { neck: 0.85 }, re: /\b(slender|thin|long) neck\b/ },
  { word: 'mass', mass: { hand: 1.25, foreArm: 1.2 }, re: /\bheavy[- ](handed|paws|hands|forearms)\b/ },
  { word: 'mass', mass: { thigh: 1.2, shank: 1.15 }, re: /\b(strong|heavy|powerful|thick) (haunches|thighs|legs)\b/ },
  { word: 'mass', mass: { hips: 1.12 }, re: /\b(full|wide|broad) hips\b/ },
  { word: 'hump', value: 0.5, re: /\b(hump|humped|hunchback)\b/ },
  { word: 'keel', value: 0.8, re: /\b(keel|keeled)\b/ },
  { word: 'keel', value: 0.35, re: /\b(deep|barrel) chest(ed)?\b|\bdeep-chested\b/ },
]);

/** a people's nearest library skull by its family words (its lineage's reads and its notes), the first that matches */
export const SKULL_FAMILIES = Object.freeze([
  { re: /\b(snake|serpent|viper|cobra|python|naga|lamia)/, head: 'serpent' },
  { re: /\b(insect|bug|beetle|mantis|ant|wasp|bee|moth|locust|cicada|mandibles?)/, head: 'mandibled' },
  { re: /\b(bird|beak|beaked|avian|owl|hawk|eagle|falcon|crow|corvid|raven|parrot|heron|vulture)/, head: 'beaked' },
  { re: /\b(dragon|drake|wyvern|wyrm|lizard|reptile|reptilian|crocodile|alligator|gator|kobold|draconic)/, head: 'dragon' },
  { re: /\b(cat|lion|tiger|panther|leopard|lynx|jaguar|feline|cheetah)/, head: 'felid' },
  { re: /\b(bear|ursine|badger|wolverine)/, head: 'bear' },
  { re: /\b(wolf|dog|hound|jackal|fox|coyote|hyena|canine|lupine)/, head: 'wolf' },
  // (only the nearest: a muzzle the library has no skull of its own for, the wolf's drawn for it by the sheet)
  { re: /\b(rat|mouse|rodent|porcupine|hedgehog|rabbit|hare|weasel|otter|ferret|boar|pig|goat|deer|muzzle|snout)/, head: 'wolf', provisional: true },
]);

/** the parts a line asks for that the composer does not carry yet: pending in the ledger, named */
export const GAP_ROWS = Object.freeze([
  { re: /\b(hooves|hooved|hoofed|cloven)\b/, part: 'hooves (a lower-body module the composer lacks)' },
  { re: /\b(centaur|taur|horse'?s? body|four legs|four-legged|on all fours)\b/, part: 'a four-legged lower body (a taur: a lower-body module the composer lacks)' },
  { re: /\b(wings? folded (at|on) the back|folded (membrane )?wings|membrane wings|wings at the back|back wings)\b/, part: 'wings at the back (the composer carries wings on the arms only)' },
  { re: /\bhorns?\b/, part: 'horns (an ornament the composer lacks; the dragon\'s skull carries its own)', carried: 'horn' },
  { re: /\bantennae\b/, part: 'antennae (an ornament the composer lacks; the mandibled skull carries short ones)', carried: 'antenna' },
  { re: /\btusks?\b/, part: 'tusks (an ornament the composer lacks)' },
  { re: /\bfrill\b/, part: 'a frill (an ornament the composer lacks)' },
  { re: /\b(fins?|finned)\b/, part: 'fins (an ornament the composer lacks)' },
  { re: /\b(shell on (its|their|the) back|carapace on (its|their|the) back)\b/, part: 'a shell on the back (a form the composer lacks)' },
  { re: /\bquills?\b/, part: 'quills (an outline breaker the composer lacks; the cover carries their texture only)' },
]);

/** the ornaments a library skull carries as its species' own, by name */
export const SKULL_SPECIES = Object.freeze(['horn', 'antenna']);

// the lines read for the body first (the frame's, the silhouette's), then the rest, so a body's own word wins
const ORDER = ['frame', 'silhouette', 'structure', 'cover', 'ornament', 'hair', 'stance', 'rest', 'eyes'];
const NEGATED = /\b(no|not|without|never)\b/;

export function readAnatomy(sheet) {
  const notes = sheet.notes ?? {}, chs = [...ORDER.filter((c) => notes[c]), ...Object.keys(notes).filter((c) => !ORDER.includes(c))];
  // (the lineage's own lines: a note says where it came from; one that does not is read as the people's)
  const lines = chs.flatMap((ch) => (notes[ch] ?? []).filter((n) => !n.from || n.from.startsWith('ancestry.')).map((n) => ({ ch, line: n.line })));
  const words = {}, placed = new Map(), gaps = new Map(), lean = {}, asks = new Set();
  const land = (line, at) => placed.set(line, placed.has(line) ? `${placed.get(line)}, ${at}` : at);
  for (const { ch, line } of lines) {
    const l = line.toLowerCase();
    for (const G of GAP_ROWS) if (G.re.test(l) && !NEGATED.test(l)) { gaps.set(line, [...(gaps.get(line) ?? []), G]); if (G.carried) asks.add(G.carried); }
    if (ch === 'dress' || ch === 'colouring' || ch === 'palette') continue;
    const set = new Set();
    for (const R of WORD_ROWS) {
      if ((R.ch && R.ch !== ch) || !R.re.test(l)) continue;
      // (a negated line sets nothing but its own negation: 'no tail' is the tail's none)
      if (NEGATED.test(l) && R.value !== 'none') continue;
      if (R.word === 'mass') { for (const [k, v] of Object.entries(R.mass)) lean[k] = (lean[k] ?? 1) * v; land(line, `spec.beast.mass (${Object.keys(R.mass).join(', ')})`); continue; }
      if (words[R.word] !== undefined || set.has(R.word)) continue;
      // (feathers named as hair are a bird's head of feathers, not a person's hair)
      if (R.word === 'hair' && /feathers|quills|no hair|bald/.test(l)) continue;
      words[R.word] = R.value; set.add(R.word); land(line, `spec.beast.${R.word}`);
    }
  }
  if (Object.keys(lean).length) words.mass = Object.fromEntries(Object.entries(lean).map(([k, v]) => [k, r3(clamp((BEAST_BASE.mass[k] ?? 1) * v, 0.5, 2))]));
  // (a coil takes no tail; an abdomen rides the tail's bones)
  if (words.legs === 'serpent' || words.abdomen) words.tail = 'none';
  if (words.legs === 'serpent' && words.coat === undefined && words.cover && words.cover !== 'none') words.coat = 'lower';
  // the nearest library skull: its lineage's own reads first, then its notes in order
  const said = [sheet.ancestry?.reads ?? '', ...lines.map((x) => x.line)].map((s) => s.toLowerCase());
  let head = null;
  for (const s of said) { const F = SKULL_FAMILIES.find((x) => x.re.test(s)); if (F) { head = { id: F.head, provisional: !!F.provisional, by: s }; break; } }
  return { words, head, placed, gaps, asks };
}
