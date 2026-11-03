/**
 * THE FOES A SENTENCE NAMES: the words a creator says for who the party fights ("skeletons and zombies", "orcs",
 * "beast folk", "werewolves") read into the party battles' packs and each foe's look (battles.js `packs`, `looks`), so
 * a composed game fights what its sentence asks for, each foe made through its character door: a beast through the
 * animal door, a people (a lineage, the beast-kin, the undead) from its own sheet.
 *
 *   FOE_WORDS            { <word>: [{ kind, look? }] }: the foe kinds a word names (playscape/rpg/presets.js), each with
 *                        the look it stands in where the word asks for one other than its kind's own (battles.js FOE_LOOKS)
 *   readFoeWords(text)   → { kinds, looks, read: [{ word, decides }] } | null: the kinds in the order the sentence names
 *                        them, the looks the words ask for, what each word decided; null where it names none
 *   foePacks(kinds)      → the packs met along the way: one foe, then two, then three, walked round the sentence's kinds
 *                        in its order (a pack of one kind where it names one); four packs, or one starting at each kind
 *
 * Pure: the same sentence reads the same foes.
 */

const one = (kind, look) => Object.freeze({ kind, ...(look ? { look: Object.freeze(look) } : {}) });
const UNDEAD = [one('skeleton'), one('zombie')];
const KIN = [one('wolf', { people: 'lupine' }), one('bandit', { people: 'feline' })];
// (a word read whole, or two words together where a creator says them as one: "beast folk")
export const FOE_WORDS = Object.freeze({
  skeleton: [one('skeleton')], skeletons: [one('skeleton')],
  zombie: [one('zombie')], zombies: [one('zombie')], ghoul: [one('zombie')], ghouls: [one('zombie')],
  undead: UNDEAD, risen: [one('zombie', { people: 'risen' })], revenants: [one('zombie', { people: 'revenant' })],
  goblin: [one('goblin'), one('shaman')], goblins: [one('goblin'), one('shaman')],
  orc: [one('goblin'), one('shaman')], orcs: [one('goblin'), one('shaman')], orcish: [one('goblin'), one('shaman')],
  werewolf: [one('wolf', { people: 'lupine' })], werewolves: [one('wolf', { people: 'lupine' })],
  'beast folk': KIN, beastfolk: KIN, 'beast-folk': KIN, beastmen: KIN, 'beast-kin': KIN, beastkin: KIN,
  catfolk: [one('bandit', { people: 'feline' })], 'cat folk': [one('bandit', { people: 'feline' })],
  lizardfolk: [one('bandit', { people: 'serpentine' })], lizardmen: [one('bandit', { people: 'serpentine' })],
  demons: [one('wisp', { people: 'infernal' })], demon: [one('wisp', { people: 'infernal' })],
  insectoids: [one('spider', { people: 'insectoid' })], bugfolk: [one('spider', { people: 'insectoid' })],
  beasts: [one('wolf'), one('bat'), one('spider')], beast: [one('wolf'), one('bat'), one('spider')],
  wolf: [one('wolf')], wolves: [one('wolf')], bat: [one('bat')], bats: [one('bat')],
  spider: [one('spider')], spiders: [one('spider')], slime: [one('slime')], slimes: [one('slime')],
  bandit: [one('bandit')], bandits: [one('bandit')], golem: [one('golem')], golems: [one('golem')],
  drake: [one('drake')], drakes: [one('drake')], dragon: [one('drake')], dragons: [one('drake')],
  wisp: [one('wisp')], wisps: [one('wisp')], ghost: [one('wisp')], ghosts: [one('wisp')],
});
const PHRASES = Object.keys(FOE_WORDS).filter((w) => w.includes(' '));

export function readFoeWords(text) {
  // (the sentence's words in order; a pair said as one read before either alone)
  const words = String(text ?? '').toLowerCase().split(/[^a-z-]+/).filter(Boolean), named = [];
  for (let i = 0; i < words.length; i++) {
    const pair = `${words[i]} ${words[i + 1] ?? ''}`;
    if (PHRASES.includes(pair)) { named.push(pair); i++; } else if (FOE_WORDS[words[i]]) named.push(words[i]);
  }
  if (!named.length) return null;
  const kinds = [], looks = {}, read = [];
  for (const w of named) {
    const decides = [];
    for (const { kind, look } of FOE_WORDS[w]) {
      if (!kinds.includes(kind)) kinds.push(kind);
      // (the first word to ask a look of a kind decides it)
      if (look && looks[kind] === undefined) looks[kind] = { ...look };
      decides.push(`battles.foe=${kind}${look ? `(${look.people})` : ''}`);
    }
    if (!read.some((r) => r.word === w)) read.push({ word: w, decides });
  }
  return { kinds, looks, read };
}

export function foePacks(kinds) {
  const m = kinds.length, n = Math.max(4, m), at = (i) => kinds[i % m];
  return Array.from({ length: n }, (_, i) => Array.from({ length: Math.min(1 + i, 3) }, (_, j) => at(i + j)));
}
