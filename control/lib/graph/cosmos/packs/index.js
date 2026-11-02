/**
 * THE PACKS by id, and the characters each makes by name: a pack's cast member or one of its crews' grunts, as the hero
 * door's own words (the orders a pack already writes), its headgear left as the door's `headgear` word so the character
 * stays editable by word (headgear/wear.js). create_character's `pack` reads this; the pack's own modules stay its own.
 *
 *   PACK_IDS
 *   packCharacterOrders({ id, member | grunt, look?, … })
 *       → { pack: { id, member | grunt, look, … what was rolled }, mint: { tool: 'mint_solid', args } }
 *       comic-hero: `member` a cast id (cast.js) with era, pole, seed, pieces, headgear, ensemble, accessories, items,
 *       swing (characters.js memberOrders); or `grunt` a crew (grunts.js GRUNT_STYLES) with kind, colourway, pole,
 *       seed, index (gruntOrders); `look` a stop of the dial (looks.js LOOKS), 'dcau-golden' (the western hero on the
 *       game body, every headgear fitted) when none is named
 */
import { memberOrders } from './comic-hero/characters.js';
import { gruntOrders, GRUNT_STYLE_IDS } from './comic-hero/grunts.js';
import { CAST } from './comic-hero/cast.js';
import { LOOKS } from './comic-hero/looks.js';

const DEFAULT_LOOK = 'dcau-golden';
const MEMBER_WORDS = ['era', 'pole', 'seed', 'pieces', 'headgear', 'ensemble', 'accessories', 'items', 'swing'];
const GRUNT_WORDS = ['kind', 'colourway', 'pole', 'seed', 'index'];

const PACKS = Object.freeze({
  'comic-hero': {
    orders({ member, grunt, look = DEFAULT_LOOK, ...words }) {
      if ((member === undefined) === (grunt === undefined)) throw new Error(`the comic hero pack makes a cast member (member: ${CAST.map((m) => m.id).join(' | ')}) or a crew's grunt (grunt: ${GRUNT_STYLE_IDS.join(' | ')}); name one`);
      if (!LOOKS[look]) throw new Error(`the comic hero pack has no look '${look}' (looks: ${Object.keys(LOOKS).join(', ')})`);
      const allowed = member !== undefined ? MEMBER_WORDS : GRUNT_WORDS, unknown = Object.keys(words).filter((k) => !allowed.includes(k));
      if (unknown.length) throw new Error(`a comic hero ${member !== undefined ? 'cast member' : 'grunt'} takes ${allowed.join(', ')} (not ${unknown.join(', ')})`);
      if (member !== undefined) {
        const O = memberOrders(member, look, { ...words, words: true });
        return { pack: { id: 'comic-hero', member, look, era: O.era, ...words }, mint: O.mint };
      }
      const O = gruntOrders(grunt, look, { ...words, words: true }), { style: _s, ...rolled } = O.grunt;
      return { pack: { id: 'comic-hero', grunt, look, ...rolled }, mint: O.mint };
    },
  },
});
export const PACK_IDS = Object.freeze(Object.keys(PACKS));

export function packCharacterOrders({ id, ...rest } = {}) {
  const P = PACKS[id];
  if (!P) throw new Error(`no pack '${id}' (packs: ${PACK_IDS.join(', ')})`);
  return P.orders(rest);
}
