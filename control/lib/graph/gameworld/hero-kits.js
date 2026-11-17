/**
 * THE HERO'S KIT — what a hero of a city game is made of, in three parts that are chosen apart, so heroes differ by
 * what they are given and never by code of their own:
 *
 *   movement   how it gets about the city (MOVEMENT_KITS): the moves it starts with (actions.js HERO_MOVES: the wall, the
 *              line) and the traversal it is granted from the first level (TRAVERSAL_MOVES: a second jump, a high jump,
 *              a glide, flight). Swinging is a movement, not a fight
 *   style      how it fights (FIGHTING_STYLES), its own thing: one PUNCH button. A style is an arsenal of one weapon,
 *              the hero's hands, whose strings are all on the light beat: press it again on a connect for the next
 *              blow, the last a finisher; in the air its own string. What differs is the string's length, its pace, its
 *              weight and what its finisher does (floors, launches). Lowered by the arsenal's own lowering
 *              (combos.js): the same frames, juggle and foe health as any kit
 *   ranged     one RANGE button, if any (RANGED_KITS): the arsenal's one sidearm
 *   special    one SPECIAL button, for the level's actions and events (SPECIALS): what the hero does at a thing that
 *              asks for it (a door, a switch, someone to help, a foe to finish). It carries no blows of its own
 *
 *   characters.hero.kit: '<a named kit>' | { from?: '<a named kit>', movement?, style?, ranged?, special? }
 *
 * A NAMED KIT (HERO_KITS) is a choice of the four; `from` takes one and changes parts of it; `ranged: null` carries
 * none. A new movement, style, ranged or special is a row; a new hero is a named kit, or four words.
 *
 *   readHeroKit(v)        the kit, checked → { movement, style, ranged, special, from? } (throws naming what it takes)
 *   kitOfGame(G)          a world's hero's kit, read, or null
 *   kitMoves(G)           the moves its hero starts with: its kit's movement's and its actions page's, each once
 *   kitGrants(G)          the traversal its kit's movement grants from the first level: [{ move }]
 *   kitArsenal(kit)       the arsenal its style and its ranged make (combos.js readArsenal takes it), or null
 *   kitLegendOf(kit)      its buttons in words: punch, range, special
 *
 * Pure data and resolvers.
 */
import { HERO_MOVES, TRAVERSAL_MOVES } from './actions.js';
import { BASIC_ARSENAL } from './combos.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`characters: hero.kit ${m}`); };

/** How a hero gets about. `moves` are held from the first level (HERO_MOVES); `grants` are traversal powers it has from
 *  the start (TRAVERSAL_MOVES). */
export const MOVEMENT_KITS = Object.freeze({
  swinger: { read: 'a line cast to the city: swings, zips and launches, a wall run and a climb, a glide and a dive', moves: ['wall', 'swinger'], grants: [] },
  leaper: { read: 'great leaps: half as high again and a second in the air, and a hold on any wall', moves: ['wall'], grants: ['high-jump', 'double-jump'] },
  glider: { read: 'a second jump and a held glide down from any height, and a hold on any wall', moves: ['wall'], grants: ['double-jump', 'glide'] },
  flyer: { read: 'flight on its own air: rise, hover and fly at will', moves: [], grants: ['vayo-flight'] },
  runner: { read: 'on foot: a second jump, and nothing else', moves: [], grants: ['double-jump'] },
});

// the hands' blows a style is built from (the basic arsenal's fist: each its solver's frames and window)
const FIST = BASIC_ARSENAL.weapons.find((w) => w.id === 'fist').moves;
const blow = (id, over = {}) => ({ ...FIST[id], ...over });
// a style's weapon: the hands, drawn (there is nothing to sheathe), every string on the light beat
const hands = ({ reach, damage, moves, ground, air }) => ({
  id: 'hands', name: 'Hands', figure: 'drawn', reach, damage, moves,
  combos: [{ id: 'string', name: 'The string', beats: ground.map(() => 'L'), moves: ground }, { id: 'air-string', name: 'The air string', air: true, beats: air.map(() => 'L'), moves: air }],
});

/** How a hero fights: ONE punch button. `read` says the style; `weapon` is its arsenal weapon. */
export const FIGHTING_STYLES = Object.freeze({
  brawler: {
    read: 'a straight fighter: one, two, and a hook that floors; in the air, a hammer blow that slams down',
    weapon: hands({ reach: 0.95, damage: 0.5, ground: ['jab', 'cross', 'hook'], air: ['air-jab', 'air-cross', 'air-hammer'],
      moves: { jab: blow('jab'), cross: blow('cross'), hook: blow('hook'), 'air-jab': blow('air-jab'), 'air-cross': blow('air-cross'), 'air-hammer': blow('air-hammer') } }),
  },
  acrobat: {
    read: 'quick and light: four fast blows, the last an uppercut that launches a foe into the air to be followed',
    weapon: hands({ reach: 1.05, damage: 0.4, ground: ['jab', 'cross', 'flick', 'launch'], air: ['air-jab', 'air-cross', 'air-jab-2', 'air-hammer'],
      moves: {
        jab: blow('jab', { frames: 18, cancel: 10 }), cross: blow('cross', { frames: 21, cancel: 12 }), flick: blow('jab', { frames: 18, cancel: 10, damage: 1.1 }),
        launch: blow('rising-uppercut', { role: 'finisher', cooldown: undefined }),
        'air-jab': blow('air-jab', { frames: 17, cancel: 10 }), 'air-cross': blow('air-cross', { frames: 20, cancel: 12 }), 'air-jab-2': blow('air-jab', { frames: 17, cancel: 10, damage: 1.1 }), 'air-hammer': blow('air-hammer'),
      } }),
  },
  bruiser: {
    read: 'slow and heavy: two blows, each a weight; the second sends a foe flying and floors it',
    weapon: hands({ reach: 1.1, damage: 0.8, ground: ['cross', 'hook'], air: ['air-cross', 'air-hammer'],
      moves: {
        cross: blow('cross', { role: 'opener', frames: 32, cancel: 22, damage: 1.5, impact: 1.5 }), hook: blow('hook', { frames: 42, damage: 2.6, impact: 4 }),
        'air-cross': blow('air-cross', { role: 'opener', frames: 30, cancel: 20, damage: 1.5 }), 'air-hammer': blow('air-hammer', { frames: 38, damage: 2.6, impact: 4 }),
      } }),
  },
});
// (a move's undefined fields are dropped: an arsenal's reader takes only what is said)
for (const S of Object.values(FIGHTING_STYLES)) for (const [k, m] of Object.entries(S.weapon.moves)) S.weapon.moves[k] = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined));

/** What a hero has at range, if anything: the arsenal's one sidearm, on the range button. */
export const RANGED_KITS = Object.freeze({
  bolt: { read: 'a bolt from the hand, as fast as the button is held', sidearm: { id: 'bolt', name: 'Bolt', mode: 'auto', rof: 4, damage: 0.6, impact: 6, range: 35, infinite: true, hand: 'right' } },
  volley: { read: 'a quick stream of light shots that wear a foe down', sidearm: { id: 'volley', name: 'Volley', mode: 'auto', rof: 10, damage: 0.25, impact: 2, range: 28, infinite: true, hand: 'right' } },
  thrown: { read: 'a thing drawn back and thrown: held, it is aimed; let go, it flies and lands hard', sidearm: { id: 'thrown', name: 'Throw', mode: 'draw', draw: 0.35, early: 'none', speed: 38, drop: 6, damage: 3, impact: 30, quiver: 99, nock: 0.25, hand: 'right' } },
});

/** What the special button does: the level's actions and events. One row yet. */
export const SPECIALS = Object.freeze({
  context: { read: 'the thing at hand: a door, a switch, someone to help, whatever the level asks for where the hero stands' },
});

/** Named kits: a hero in a word. */
export const HERO_KITS = Object.freeze({
  swinger: { read: 'the city swinger: on a line, quick with its hands', movement: 'swinger', style: 'acrobat', ranged: null, special: 'context' },
  powerhouse: { read: 'the powerhouse: great leaps and heavy blows', movement: 'leaper', style: 'bruiser', ranged: null, special: 'context' },
  blaster: { read: 'the blaster: it flies, and fights at range', movement: 'flyer', style: 'brawler', ranged: 'bolt', special: 'context' },
  vigilante: { read: 'the vigilante: a glide from the rooftops, a straight fighter, a thing to throw', movement: 'glider', style: 'brawler', ranged: 'thrown', special: 'context' },
});
const PARTS = Object.freeze({ movement: MOVEMENT_KITS, style: FIGHTING_STYLES, ranged: RANGED_KITS, special: SPECIALS });
const list = (T) => Object.keys(T).join(', ');

/** A hero's kit, checked → { movement, style, ranged, special, from? }. */
export function readHeroKit(v) {
  const K = typeof v === 'string' ? { from: v } : v;
  if (!isObj(K)) no(`is a named kit (${list(HERO_KITS)}) or { from?, movement?, style?, ranged?, special? }`);
  for (const k of Object.keys(K)) if (k !== 'from' && !PARTS[k]) no(`.${k} is not part of a kit (from, movement, style, ranged, special)`);
  if (K.from !== undefined && !HERO_KITS[K.from]) no(`${typeof v === 'string' ? `'${v}'` : `.from '${K.from}'`} is not a named kit (${list(HERO_KITS)})`);
  const base = K.from !== undefined ? HERO_KITS[K.from] : { movement: 'runner', style: 'brawler', ranged: null, special: 'context' };
  const out = { movement: K.movement ?? base.movement, style: K.style ?? base.style, ranged: K.ranged === undefined ? base.ranged : K.ranged, special: K.special ?? base.special };
  if (!MOVEMENT_KITS[out.movement]) no(`.movement is how it gets about (${list(MOVEMENT_KITS)}), not '${out.movement}'`);
  if (!FIGHTING_STYLES[out.style]) no(`.style is how it fights (${list(FIGHTING_STYLES)}), not '${out.style}'`);
  if (out.ranged !== null && !RANGED_KITS[out.ranged]) no(`.ranged is what it has at range (${list(RANGED_KITS)}), or null for none, not '${out.ranged}'`);
  if (!SPECIALS[out.special]) no(`.special is what its special button does (${list(SPECIALS)}), not '${out.special}'`);
  return { ...out, ...(K.from !== undefined ? { from: K.from } : {}) };
}

/** A world's hero's kit, read, or null. */
export function kitOfGame(G) {
  const k = G?.characters?.hero?.kit;
  return k === undefined || k === null ? null : readHeroKit(k);
}

/** The moves a world's hero starts with: its kit's movement's and its actions page's, each once. */
export function kitMoves(G) {
  const K = kitOfGame(G), own = G?.characters?.hero?.actions?.moves ?? [];
  return [...new Set([...(K ? MOVEMENT_KITS[K.movement].moves : []), ...own])].filter((id) => HERO_MOVES[id]);
}

/** The traversal its kit's movement grants from the first level. */
export function kitGrants(G) {
  const K = kitOfGame(G);
  return K ? MOVEMENT_KITS[K.movement].grants.filter((m) => TRAVERSAL_MOVES[m]).map((move) => ({ move })) : [];
}

/** The arsenal a kit's style and ranged make: one weapon, the hands; the basic kit's timing and juggle; its one sidearm. */
export function kitArsenal(kit) {
  if (!kit) return null;
  const K = readHeroKit(kit), W = structuredClone(FIGHTING_STYLES[K.style].weapon);
  return { timing: structuredClone(BASIC_ARSENAL.timing), weapons: [W], juggle: structuredClone(BASIC_ARSENAL.juggle), ...(K.ranged ? { ranged: [structuredClone(RANGED_KITS[K.ranged].sidearm)] } : {}) };
}

/** A kit's buttons, in words. */
export function kitLegendOf(kit) {
  const K = readHeroKit(kit);
  return `click  punch${K.ranged ? ` · S  ${RANGED_KITS[K.ranged].sidearm.name.toLowerCase()}` : ''} · E  special`;
}
