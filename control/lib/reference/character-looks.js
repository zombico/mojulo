/**
 * The looks a character read from a picture lands in: the "style" a person names ("make her anime", "a statue of him")
 * or the agent picks from the picture's own rendering. A look is a named bundle of the hero door's own words
 * (create_character as 'hero', lib/mcp/tools/layered.js HERO_FIELDS), never words of its own: what a look sets is what
 * the person could have typed, so a hero made from a picture is the hero those words make, and every word stays the
 * person's to sculpt afterwards with update_character.
 *
 * The register (the mesh's construction: hero-form.js REGISTERS) is read beside the look, not inside it: a toon hero
 * and an anime hero can each be smooth, faceted or blocky.
 *
 * Nothing here is a copy of a table. Every menu (the anime head casts, the anime bodies, the builds, the physiques, the
 * statue cards, the stylism words, the look words) is read off the module that owns it, so a new entry there is on
 * the menu here with no edit. The one table this module owns is the looks themselves, and `REGISTER_READS` (what in a
 * picture calls for each register), which a test holds to REGISTERS key for key.
 */

import { REGISTERS, HERO_BUILD_NAMES, HERO_CASTS } from '../graph/polygonizer/hero-form.js';
import { ANIME_STYLES, ANIME_STYLE_DEFAULT } from '../graph/polygonizer/anime-styles.js';
import { ANIME_BODIES } from '../graph/polygonizer/anime-bodies.js';
import { LOOK_WORDS } from '../graph/polygonizer/anime-looks.js';
import { PHYSIQUES } from '../graph/polygonizer/body-relational-builds.js';
import { SEEDED_STATUES } from '../graph/statue/styles.js';
import { GENRES } from '../graph/stylism/genres.js';
import { OUTLINES } from '../graph/stylism/silhouette.js';
import { NAMED_SILHOUETTES } from '../graph/stylism/silhouettes.js';
import { REGISTER_WORDS } from '../graph/stylism/index.js';
import { CANONS } from '../graph/stylism/proportion.js';

/** What in a picture calls for each mesh register. Held to REGISTERS key for key (character-looks.test.js). */
export const REGISTER_READS = Object.freeze({
  round: 'smooth forms: toon and anime game art, a cartoon, a drawing with soft volumes (the default)',
  lowpoly: 'faceted forms: low-poly or early-3D game art, a flat-shaded figure, visible polygons',
  chamfer: 'bevelled forms: a vinyl toy, an action figure, hard-surface suits with softened edges',
  box: 'blocky forms: voxel or brick-built figures, boxy mecha, a character made of cuboids',
});
export const REGISTER_DEFAULT = 'round';

const menu = (table, say) => Object.freeze(Object.keys(table).map((id) => Object.freeze({ id, ...say(table[id], id) })));

/** The menus a look's choices are made from, each read off the table that owns it. */
export const CHARACTER_MENUS = Object.freeze({
  poles: Object.freeze(Object.keys(HERO_CASTS)),
  builds: HERO_BUILD_NAMES,
  animeStyles: menu(ANIME_STYLES, (s) => ({ note: s.note })),
  animeBodies: menu(ANIME_BODIES, (b) => ({ note: b.note, ...(b.pole ? { pole: b.pole } : {}) })),
  animeLooks: LOOK_WORDS,
  physiques: Object.freeze(Object.keys(PHYSIQUES)),
  statues: menu(SEEDED_STATUES, (s) => ({ period: s.period, place: s.place })),
  stylism: Object.freeze({
    genres: Object.freeze(Object.keys(GENRES)),
    registers: Object.freeze(Object.keys(REGISTER_WORDS)),
    outlines: OUTLINES,
    named: NAMED_SILHOUETTES,
    canons: CANONS,
  }),
});

/**
 * The looks. Each: `words` (the hero words the look IS; they win over the read on the keys they set, but for a key the
 * look lets you choose, and the person can change any of them after), `choose` (the choices inside the look, each a
 * hero word with its menu, or its range, and the door's own default when the read names none), `suits` (what in a picture calls for it), `register` (the default register), and
 * `refuses` (combinations the door refuses, said up front). One row per distinct procedure on the door: a head family
 * or a form, never a game or a franchise.
 */
export const CHARACTER_LOOKS = Object.freeze({
  toon: Object.freeze({
    words: Object.freeze({}),
    choose: Object.freeze({}),
    suits: 'western game and cartoon art, a toy-like hero, a drawing with no anime conventions: the door as it stands (the landmark head)',
    register: 'round',
  }),
  anime: Object.freeze({
    words: Object.freeze({ head: 'anime' }),
    choose: Object.freeze({
      animeStyle: Object.freeze({ from: 'animeStyles', default: ANIME_STYLE_DEFAULT, note: "the head's cast: a figure's scale and theme (a child or a chibi wears none)" }),
      animeBody: Object.freeze({ from: 'animeBodies', note: 'a body codename over the same base; absent, the body follows the head cast' }),
      look: Object.freeze({ from: 'animeLooks', note: 'archetypes, face and hair traits, cuts and poses, as one list of words that compose' }),
    }),
    suits: 'cel anime, manga, a light-novel cover, a visual-novel sprite: large clear eyes, graphic features, clump hair',
    register: 'round',
  }),
  'anime-painterly': Object.freeze({
    words: Object.freeze({ head: 'anime', painterly: true }),
    choose: Object.freeze({
      animeStyle: Object.freeze({ from: 'animeStyles', default: ANIME_STYLE_DEFAULT, note: "the head's cast" }),
      look: Object.freeze({ from: 'animeLooks', note: 'as the anime look' }),
    }),
    suits: 'soft, painted anime: a watercolour or gouache finish, the light meeting the shade on a soft edge, a painted face',
    register: 'round',
  }),
  shonen: Object.freeze({
    words: Object.freeze({ head: 'anime', genki: 0.6 }),
    choose: Object.freeze({
      genki: Object.freeze({ range: Object.freeze([0, 1]), default: 0.6, note: 'how much of the shonen spirit: 0.6 a lead, 1 at full' }),
      animeStyle: Object.freeze({ from: 'animeStyles', default: ANIME_STYLE_DEFAULT, note: "the head's cast" }),
      animeBody: Object.freeze({ from: 'animeBodies', note: 'as the anime look' }),
      look: Object.freeze({ from: 'animeLooks', note: 'as the anime look' }),
    }),
    suits: 'an action-anime lead: broad shoulders, a set brow, a wide stance, spiked hair; genki 0..1 is how much (0.6 here, 1 at full spirit)',
    register: 'round',
  }),
  chibi: Object.freeze({
    words: Object.freeze({ cast: Object.freeze({ build: 'chibi' }) }),
    choose: Object.freeze({}),
    suits: 'super-deformed figures: a head near a third of the height, a vinyl collectible, a mascot-like person; the pole is read from the picture',
    register: 'round',
  }),
  realistic: Object.freeze({
    words: Object.freeze({ form: 'realistic' }),
    choose: Object.freeze({
      physique: Object.freeze({ from: 'physiques', default: 'athletic', note: "a word, or { bulk, tone, weight, height } each -1..1" }),
    }),
    suits: 'a photograph, realistic game or film art, a figure drawn from life; it depicts adults, so a child-coded build is drawn as the stylised figure instead',
    register: 'round',
  }),
  statue: Object.freeze({
    words: Object.freeze({ statue: 'classical' }),
    choose: Object.freeze({
      statue: Object.freeze({ from: 'statues', default: 'classical', note: 'a period card: its material, crop, base and stand' }),
    }),
    suits: 'a sculpture, a monument, a bust, a figure carved in stone or cast in bronze',
    register: 'round',
    refuses: Object.freeze(["the anime head (its graphic face is not carved yet): leave `head` to the landmark head or 'none'", 'held gear']),
  }),
});
export const CHARACTER_LOOK_IDS = Object.freeze(Object.keys(CHARACTER_LOOKS));
export const CHARACTER_LOOK_DEFAULT = 'toon';

/** The looks as the protocol shows them: each with its words, its choices against their menus, and when it suits. */
export function characterLookTable() {
  return CHARACTER_LOOK_IDS.map((id) => {
    const L = CHARACTER_LOOKS[id];
    return {
      id,
      sets: L.words,
      ...(Object.keys(L.choose).length ? { choose: Object.fromEntries(Object.entries(L.choose).map(([word, c]) => [word, { ...(c.from ? { menu: c.from } : { range: c.range }), ...(c.default !== undefined ? { default: c.default } : {}), note: c.note }])) } : {}),
      suits: L.suits,
      register: L.register,
      ...(L.refuses ? { refuses: L.refuses } : {}),
    };
  });
}

/** The registers as the protocol shows them. */
export function characterRegisterTable() {
  return Object.keys(REGISTERS).map((id) => ({ id, reads: REGISTER_READS[id] ?? null, ...(id === REGISTER_DEFAULT ? { default: true } : {}) }));
}
