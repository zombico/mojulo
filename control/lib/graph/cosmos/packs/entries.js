// cosmos/packs/entries — each pack's CARD for the solid vocabulary, generated from the pack's own tables at load
// (solid-vocab/loader.js), never hand-written: the characters it makes by name through create_character's `pack`, and
// the words their orders take. Found by search, read by the pack's id.
import { CAST } from './comic-hero/cast.js';
import { LOOKS } from './comic-hero/looks.js';
import { ERAS } from './comic-hero/costumes.js';
import { PIECES } from './comic-hero/pieces.js';
import { ACCESSORIES } from './comic-hero/accessories.js';
import { ITEMS } from './comic-hero/items.js';
import { ENSEMBLES } from './comic-hero/ensembles.js';
import { GRUNT_STYLES } from './comic-hero/grunts.js';

const ids = (T) => Object.keys(T).map((k) => `\`${k}\``).join(', ');

function comicHeroCard() {
  const lines = ['# The comic hero pack', '',
    "Comic-book and superhero characters by name: create_character { pack: { id: 'comic-hero', member: '<cast id>' } } for one of the cast, or { pack: { id: 'comic-hero', grunt: '<crew>' } } for one of a crew's grunts. Each is a hero minted through the hero door, its headgear kept as the hero's `headgear` word, so update_character revises it by word like any hero. A hero's `spec` words beside `pack` lay over the pack's. The result says what was rolled (`pack`).", '',
    '## The cast (`member`)', ''];
  for (const m of CAST) lines.push(`- \`${m.id}\` — ${m.name}: ${m.reads} (suit ${m.suit}${m.items?.length ? `; carries ${m.items.join(', ')} with items: 'signature'` : ''})`);
  lines.push('', "A member's words: `look` (below; 'dcau-golden' when none), `era` (the costume era; the look's stop suggests one), `pole` ('male' | 'female', in place of the member's), `seed` (its face and build), `headgear` (a word: get_solid_vocab({ id: 'headgear' })), `pieces`, `accessories`, `items` (lists of the cards below, or items: 'signature'), `ensemble` (a body that answers the head, in place of the costume; 'auto' for the one the headgear calls for), `swing` (true, or a swing word: the stand of the first item that names one).", '',
    '## The looks (`look`)', '');
  for (const [k, L] of Object.entries(LOOKS)) lines.push(`- \`${k}\` — the ${L.stop} stop: ${L.reads}`);
  lines.push('', 'The realistic stop dresses the realistic body: its headgear is the domino and the cowl alone, and it takes no ensemble.', '', '## The costume eras (`era`)', '');
  for (const [k, E] of Object.entries(ERAS)) lines.push(`- \`${k}\` — ${E.name}: ${E.reads}`);
  lines.push('', '## The cards', '',
    `- pieces: ${ids(PIECES)}`, `- accessories: ${ids(ACCESSORIES)}`, `- items: ${ids(ITEMS)}`, `- ensembles: ${ids(ENSEMBLES)}`, '',
    '## The crews (`grunt`)', '');
  for (const [k, S] of Object.entries(GRUNT_STYLES)) lines.push(`- \`${k}\` — ${S.name}: ${S.reads} (kinds ${Object.keys(S.kinds).join(', ')}; colourways ${Object.keys(S.colourways).join(', ')})`);
  lines.push('', "A grunt's words: `look`, `kind`, `colourway`, `pole`, `seed`, `index` (its place in a crew: the same seed and index is the same grunt).");
  return {
    id: 'comic-hero', name: 'The comic hero pack: superheroes, villains and their crews by name', family: 'figure', entry: 'create_character', generated: true,
    summary: `A comic-book cast (${CAST.map((m) => m.id).join(', ')}) and crews (${Object.keys(GRUNT_STYLES).join(', ')}), made by name through create_character's pack.`,
    when: '"a superhero", "a comic book villain", "a sidekick", "a masked vigilante", "the hero and his rival", "a supervillain mastermind", "henchmen", "a street gang", "a crew of thugs", "comic book characters"',
    body: lines.join('\n'),
  };
}

/** Every pack's card. */
export function packCards() {
  return [comicHeroCard()];
}
