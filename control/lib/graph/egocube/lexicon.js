/**
 * THE EGOCUBE'S LEXICON: the words people use for characters, each a partial Egocube. A brief is read left to right,
 * longest phrase first; a later word wins a facet an earlier one set. Words not here come back unread, for the brief.
 * What no word decides, the seed does (egocube.js), as gameworld/compose.js does for worlds.
 *
 * A class word is a reading, not a rule: `paladin` is a frontline hero, bound and selfless, because that is what people
 * mean by it; an explicit facet overrides it.
 */

export const LEXICON = Object.freeze({
  // classes and familiar figures
  'paladin':      { role: 'frontline', archetype: 'hero', motivation: 0.1, order: 0.15 },
  'knight':       { role: 'frontline', archetype: 'hero', order: 0.2 },
  'dark knight':  { role: 'frontline', archetype: 'hero', motivation: 0.6, order: 0.4 },
  'warrior':      { role: 'frontline' },
  'barbarian':    { role: 'frontline', archetype: 'outlaw', order: 0.9, build: 'brute' },
  'rogue':        { role: 'flanker', archetype: 'outlaw', motivation: 0.5, order: 0.85 },
  'thief':        { role: 'flanker', archetype: 'jester', motivation: 0.6, order: 0.8 },
  'assassin':     { role: 'flanker', archetype: 'outlaw', motivation: 0.75 },
  'ninja':        { role: 'flanker', order: 0.25 },
  'ranger':       { role: 'ranged', archetype: 'explorer' },
  'archer':       { role: 'ranged' },
  'gunslinger':   { role: 'ranged', archetype: 'outlaw', order: 0.85 },
  'mage':         { role: 'caster', archetype: 'sage' },
  'wizard':       { role: 'caster', archetype: 'sage' },
  'sorcerer':     { role: 'caster', archetype: 'magician' },
  'witch':        { role: 'caster', archetype: 'magician', order: 0.75 },
  'scientist':    { role: 'non-combatant', archetype: 'sage' },
  'inventor':     { role: 'non-combatant', archetype: 'creator' },
  'summoner':     { role: 'controller', archetype: 'magician' },
  'necromancer':  { role: 'controller', archetype: 'magician', motivation: 0.85 },
  'beastmaster':  { role: 'controller', archetype: 'caregiver' },
  'healer':       { role: 'support', archetype: 'caregiver', motivation: 0.1 },
  'cleric':       { role: 'support', archetype: 'caregiver', order: 0.2 },
  'bard':         { role: 'support', archetype: 'jester' },
  'mercenary':    { motivation: 0.65, order: 0.75 },
  'emperor':      { role: 'non-combatant', archetype: 'ruler', motivation: 0.9, order: 0.1, age: 'elder' },
  'king':         { role: 'non-combatant', archetype: 'ruler' },
  'queen':        { role: 'non-combatant', archetype: 'ruler' },
  'tyrant':       { archetype: 'ruler', motivation: 0.95 },
  'mentor':       { archetype: 'sage', motivation: 0.15 },
  'trickster':    { archetype: 'jester', order: 0.9 },
  'rebel':        { archetype: 'outlaw', motivation: 0.3, order: 0.9 },
  'explorer':     { archetype: 'explorer' },
  'blacksmith':   { role: 'non-combatant', archetype: 'creator', build: 'stout' },
  'villager':     { role: 'non-combatant', archetype: 'everyman' },
  'soldier':      { role: 'frontline', archetype: 'everyman', order: 0.1 },
  'hero':         { archetype: 'hero' },
  // motivation and order
  'selfless':     { motivation: 0 },
  'noble':        { motivation: 0.1, order: 0.25 },
  'kind':         { motivation: 0.15 },
  'opportunistic':{ motivation: 0.5 },
  'greedy':       { motivation: 0.85 },
  'ruthless':     { motivation: 0.9 },
  'evil':         { motivation: 1 },
  'corrupt':      { motivation: 0.8 },
  'fallen':       { motivation: 0.7 },
  'lawful':       { order: 0.1 },
  'disciplined':  { order: 0.2 },
  'chaotic':      { order: 0.95 },
  'wild':         { order: 0.85 },
  // age
  'child':        { age: 'child' },
  'kid':          { age: 'child' },
  'young':        { age: 'youth' },
  'teenage':      { age: 'youth' },
  'grown':        { age: 'adult' },
  'veteran':      { age: 'seasoned' },
  'weary':        { age: 'seasoned' },
  'old':          { age: 'elder' },
  'ancient':      { age: 'elder' },
  'elderly':      { age: 'elder' },
  // human ancestries: broad groups, and the words people use for them
  'african':        { ancestry: 'african' },
  'black':          { ancestry: 'african' },
  'nigerian':       { ancestry: 'african' },
  'kenyan':         { ancestry: 'african' },
  'ethiopian':      { ancestry: 'african' },
  'european':       { ancestry: 'european' },
  'white':          { ancestry: 'european' },
  'east asian':     { ancestry: 'east-asian' },
  'chinese':        { ancestry: 'east-asian' },
  'japanese':       { ancestry: 'east-asian' },
  'korean':         { ancestry: 'east-asian' },
  'southeast asian':{ ancestry: 'southeast-asian' },
  'filipino':       { ancestry: 'southeast-asian' },
  'vietnamese':     { ancestry: 'southeast-asian' },
  'thai':           { ancestry: 'southeast-asian' },
  'indonesian':     { ancestry: 'southeast-asian' },
  'south asian':    { ancestry: 'south-asian' },
  'indian':         { ancestry: 'south-asian' },
  'pakistani':      { ancestry: 'south-asian' },
  'bangladeshi':    { ancestry: 'south-asian' },
  'middle eastern': { ancestry: 'middle-eastern-north-african' },
  'arab':           { ancestry: 'middle-eastern-north-african' },
  'persian':        { ancestry: 'middle-eastern-north-african' },
  'egyptian':       { ancestry: 'middle-eastern-north-african' },
  'north african':  { ancestry: 'middle-eastern-north-african' },
  'native american':{ ancestry: 'indigenous-american' },
  'indigenous':     { ancestry: 'indigenous-american' },
  'pacific islander':{ ancestry: 'pacific-islander' },
  'polynesian':     { ancestry: 'pacific-islander' },
  'samoan':         { ancestry: 'pacific-islander' },
  'hawaiian':       { ancestry: 'pacific-islander' },
  'maori':          { ancestry: 'pacific-islander' },
  'latino':         { ancestry: 'latin-american' },
  'latina':         { ancestry: 'latin-american' },
  'latin american': { ancestry: 'latin-american' },
  'mexican':        { ancestry: 'latin-american' },
  'brazilian':      { ancestry: 'latin-american' },
  'mixed':          { ancestry: 'mixed' },
  'biracial':       { ancestry: 'mixed' },
  // non-human peoples (lineages, ancestry.js)
  'dragon warrior': { ancestry: 'draconic', role: 'frontline', archetype: 'hero' },
  'dragonborn':     { ancestry: 'draconic' },
  'dragon-kin':     { ancestry: 'draconic' },
  'lizardfolk':     { ancestry: 'draconic', humanity: 0.3 },
  'elf':            { ancestry: 'sylvan' },
  'elven':          { ancestry: 'sylvan' },
  'dwarf':          { ancestry: 'dwarven' },
  'dwarven':        { ancestry: 'dwarven' },
  'orc':            { ancestry: 'orcish' },
  'orcish':         { ancestry: 'orcish' },
  'tiefling':       { ancestry: 'infernal' },
  'demon':          { ancestry: 'infernal', humanity: 0.65 },
  'undead':         { ancestry: 'undead' },
  'lich':           { ancestry: 'undead', humanity: 0.65, role: 'caster', archetype: 'magician', motivation: 0.9, age: 'elder' },
  'vampire':        { ancestry: 'undead', humanity: 0.9, archetype: 'lover', motivation: 0.8 },
  'skeleton':       { ancestry: 'undead', humanity: 0.6 },
  'catfolk':        { ancestry: 'feline' },
  'cat-folk':       { ancestry: 'feline' },
  'werewolf':       { ancestry: 'lupine', humanity: 0.35 },
  'wolf-kin':       { ancestry: 'lupine' },
  'bearfolk':       { ancestry: 'ursine' },
  'birdfolk':       { ancestry: 'avian' },
  'insectoid':      { ancestry: 'insectoid' },
  'mantis':         { ancestry: 'insectoid' },
  // build and pole
  'lithe':        { build: 'lithe' },
  'slender':      { build: 'lithe' },
  'burly':        { build: 'brute' },
  'hulking':      { build: 'brute' },
  'stocky':       { build: 'stout' },
  'stout':        { build: 'stout' },
  'muscular':     { build: 'heroic' },
  'man':          { pole: 'male' },
  'male':         { pole: 'male' },
  'woman':        { pole: 'female' },
  'female':       { pole: 'female' },
});

const PHRASE_MAX = Math.max(...Object.keys(LEXICON).map((k) => k.split(' ').length));
/** Words that carry nothing on their own and are not reported unread. */
const FILLER = new Set(['a', 'an', 'the', 'who', 'and', 'of', 'with', 'is', 'was', 'too', 'very', 'long', 'that', 'in', 'to', 'but']);

/** Read a brief: { facets (merged, later words winning), read: [words matched], unread: [words not] }. */
export function readBrief(brief = '') {
  const words = String(brief).toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  const facets = {}, read = [], unread = [];
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let n = Math.min(PHRASE_MAX, words.length - i); n >= 1 && !hit; n--) {
      const phrase = words.slice(i, i + n).join(' ');
      if (LEXICON[phrase]) hit = { phrase, n };
    }
    if (hit) { Object.assign(facets, LEXICON[hit.phrase]); read.push(hit.phrase); i += hit.n; }
    else { if (!FILLER.has(words[i])) unread.push(words[i]); i += 1; }
  }
  return { facets, read, unread };
}
