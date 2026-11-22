/**
 * THE HERO'S KIT — what a hero of a city game is made of, in three parts that are chosen apart, so heroes differ by
 * what they are given and never by code of their own:
 *
 *   movement   how it gets about the city (MOVEMENT_KITS): the moves it starts with (actions.js HERO_MOVES: the wall, the
 *              line) and the traversal it is granted from the first level (TRAVERSAL_MOVES: a second jump, a high jump,
 *              a glide, flight). Swinging is a movement, not a fight
 *   style      how it fights (FIGHTING_STYLES), its own thing: one PUNCH button, an autoflow of punches and kicks.
 *              Pressed again as each blow lands, the flow plays on to its finisher; a PAUSE turns the string, a HELD
 *              press charges the heavy blow, and the punch with the MODIFIER held is the style's super, spent from a
 *              meter its blows fill. A style is an arsenal of one weapon, the body, lowered by the arsenal's own
 *              lowering (combos.js): the same frames, juggle and foe health as any kit
 *   ranged     one RANGE button, if any (RANGED_KITS; or a superhero POWER, hero-powers.js CITY_POWERS): the arsenal's one sidearm
 *   special    one SPECIAL button, for actions and events (SPECIALS): at a foe that is reeling or in the air it is
 *              the style's FINISH (the arsenal's F beat); with none, it is the level's own (a door, a switch, someone
 *              to help)
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
import { CITY_POWERS, powerSidearm } from './hero-powers.js';
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

// the body's blows a style is built from: the basic arsenal's fist (each its solver's frames and window) and the kicks
// (hero-kick.js: each its own length and where its foot lands)
const FIST = BASIC_ARSENAL.weapons.find((w) => w.id === 'fist').moves;
const KICK = Object.freeze({
  frontKick: { strike: 'frontKick', role: 'filler', frames: 36, cancel: 24, contact: [0.46, 0.58], travel: { kind: 'step', m: 0.2 }, damage: 1.4, impact: 1.5 },
  roundKick: { strike: 'roundKick', role: 'filler', frames: 46, cancel: 32, contact: [0.5, 0.62], travel: { kind: 'step', m: 0.25 }, damage: 1.8, impact: 2 },
  knee: { strike: 'knee', role: 'filler', frames: 30, cancel: 20, contact: [0.46, 0.58], travel: { kind: 'step', m: 0.3 }, damage: 1.3, impact: 1 },
});
const blow = (id, over = {}) => { const m = { ...(FIST[id] ?? KICK[id]), ...over }; if (m.role === 'finisher' || m.role === 'launcher') delete m.cancel; return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)); };
// a string: its beats and the moves they play, one a press (a pause, `.`, plays none)
const string = (id, name, beats, moves, air = false) => ({ id, name, beats, moves, ...(air ? { air: true } : {}) });
// a style's weapon: the body, drawn (there is nothing to sheathe)
const body = ({ reach, damage, moves, combos }) => ({ id: 'hands', name: 'Hands and feet', figure: 'drawn', reach, damage, moves, combos });

/**
 * How a hero fights: ONE punch button, an AUTOFLOW. Pressed again as each blow lands, the FLOW plays on, punches and
 * kicks mixed, to its finisher. What changes the outcome is WHEN and HOW LONG the button is pressed, never which button:
 *   a PAUSE   the press held back a breath after a blow (`.`): the string turns (a knee, a kick that sends a foe off)
 *   a CHARGE  the press held (`L+`): the heavy blow, from standing or in the middle of a string
 * and with the MODIFIER held the punch is the style's SUPER (`mL`), spent from a meter that blows landed fill.
 * `read` says the style; `weapon` is its arsenal weapon; `mp` its meter.
 */
export const FIGHTING_STYLES = Object.freeze({
  brawler: {
    read: 'a straight fighter: jab, cross, a front kick, a hook that floors. Paused, it turns to the knee and a round kick; charged, a haymaker; its super an uppercut that lifts a foe off the street',
    mp: { max: 100, onHit: 6 },
    weapon: body({ reach: 1, damage: 0.5,
      moves: {
        jab: blow('jab'), cross: blow('cross'), kick: blow('frontKick'), hook: blow('hook'),
        knee: blow('knee'), round: blow('roundKick', { role: 'finisher', damage: 2.2, impact: 3, topple: true }),
        haymaker: blow('hook', { role: 'opener', frames: 40, damage: 2.6, impact: 3.5, topple: true, travel: { kind: 'lunge', m: 0.5 } }),
        drive: blow('roundKick', { role: 'finisher', damage: 2.6, impact: 4, topple: true }),
finish: blow('hook', { role: 'opener', frames: 38, damage: 5, impact: 5, topple: true, travel: { kind: 'lunge', m: 0.7 } }),
                super: blow('rising-uppercut', { damage: 3, launch: 11, mp: 50, cooldown: undefined }),
        'air-jab': blow('air-jab'), 'air-cross': blow('air-cross'), 'air-hammer': blow('air-hammer'),
        'air-slam': blow('air-hammer', { role: 'opener', damage: 2.6, impact: 3.5, slam: 20 }),
      },
      combos: [
        string('flow', 'The flow', ['L', 'L', 'L', 'L'], ['jab', 'cross', 'kick', 'hook']),
        string('turn', 'The turn (a pause after the cross)', ['L', 'L', '.', 'L', 'L'], ['jab', 'cross', 'knee', 'round']),
        string('haymaker', 'The haymaker (held)', ['L+'], ['haymaker']),
        string('drive', 'The drive (held in the string)', ['L', 'L', 'L+'], ['jab', 'cross', 'drive']),
        string('finish', 'The finish (special, at a reeling foe)', ['F'], ['finish']),
        string('super', 'The lift', ['mL'], ['super']),
        string('air-flow', 'The air flow', ['L', 'L', 'L'], ['air-jab', 'air-cross', 'air-hammer'], true),
        string('air-slam', 'The slam (held in the air)', ['L+'], ['air-slam'], true),
      ] }),
  },
  acrobat: {
    read: 'quick and light: a jab, a front kick, a cross, a round kick, and an uppercut that launches. Paused, a knee into a floor kick; charged, a lunging round kick; its super a launch from anywhere',
    mp: { max: 100, onHit: 5 },
    weapon: body({ reach: 1.05, damage: 0.4,
      moves: {
        jab: blow('jab', { frames: 18, cancel: 10 }), kick: blow('frontKick', { frames: 30, cancel: 19 }), cross: blow('cross', { frames: 21, cancel: 12 }),
        round: blow('roundKick', { frames: 40, cancel: 27 }), launch: blow('rising-uppercut', { role: 'finisher', cooldown: undefined }),
        knee: blow('knee', { frames: 26, cancel: 17 }), sweep: blow('roundKick', { role: 'finisher', frames: 40, damage: 2, impact: 2.5, topple: true }),
        lunge: blow('roundKick', { role: 'opener', frames: 42, damage: 2.2, impact: 3, topple: true, travel: { kind: 'lunge', m: 0.7 } }),
        spike: blow('hook', { damage: 2.4, impact: 3.5, topple: true }),
finish: blow('roundKick', { role: 'opener', frames: 42, damage: 4.5, impact: 4.5, topple: true, travel: { kind: 'lunge', m: 0.7 } }),
                super: blow('rising-uppercut', { damage: 2.6, launch: 12, mp: 40, cooldown: undefined }),
        'air-jab': blow('air-jab', { frames: 17, cancel: 10 }), 'air-cross': blow('air-cross', { frames: 20, cancel: 12 }), 'air-jab-2': blow('air-jab', { frames: 17, cancel: 10, damage: 1.1 }), 'air-hammer': blow('air-hammer'),
        'air-slam': blow('air-hammer', { role: 'opener', damage: 2.2, impact: 3, slam: 22 }),
      },
      combos: [
        string('flow', 'The flow', ['L', 'L', 'L', 'L', 'L'], ['jab', 'kick', 'cross', 'round', 'launch']),
        string('turn', 'The turn (a pause after the kick)', ['L', 'L', '.', 'L', 'L'], ['jab', 'kick', 'knee', 'sweep']),
        string('lunge', 'The lunge (held)', ['L+'], ['lunge']),
        string('spike', 'The spike (held in the string)', ['L', 'L', 'L', 'L+'], ['jab', 'kick', 'cross', 'spike']),
        string('finish', 'The finish (special, at a reeling foe)', ['F'], ['finish']),
        string('super', 'The launch', ['mL'], ['super']),
        string('air-flow', 'The air flow', ['L', 'L', 'L', 'L'], ['air-jab', 'air-cross', 'air-jab-2', 'air-hammer'], true),
        string('air-slam', 'The slam (held in the air)', ['L+'], ['air-slam'], true),
      ] }),
  },
  bruiser: {
    read: 'slow and heavy: a cross, a knee, a hook that sends a foe flying. Paused, a front kick that shoves a foe away; charged, a blow that floors whatever it meets; its super the same, bigger',
    mp: { max: 100, onHit: 9 },
    weapon: body({ reach: 1.15, damage: 0.8,
      moves: {
        cross: blow('cross', { role: 'opener', frames: 32, cancel: 22, damage: 1.5, impact: 1.5 }), knee: blow('knee', { frames: 34, cancel: 24, damage: 1.6, impact: 1.5 }), hook: blow('hook', { frames: 42, damage: 2.6, impact: 4 }),
        shove: blow('frontKick', { role: 'finisher', frames: 40, damage: 2, impact: 5, topple: true }),
        maul: blow('hook', { role: 'opener', frames: 50, damage: 3.4, impact: 5, topple: true, travel: { kind: 'lunge', m: 0.6 } }),
        crush: blow('hook', { frames: 48, damage: 3.2, impact: 5 }),
finish: blow('hook', { role: 'opener', frames: 46, damage: 6, impact: 6, topple: true, travel: { kind: 'lunge', m: 0.7 } }),
                super: blow('rising-uppercut', { damage: 4, launch: 10, mp: 60, cooldown: undefined }),
        'air-cross': blow('air-cross', { role: 'opener', frames: 30, cancel: 20, damage: 1.5 }), 'air-hammer': blow('air-hammer', { frames: 38, damage: 2.6, impact: 4 }),
        'air-slam': blow('air-hammer', { role: 'opener', frames: 40, damage: 3.2, impact: 5, slam: 18 }),
      },
      combos: [
        string('flow', 'The flow', ['L', 'L', 'L'], ['cross', 'knee', 'hook']),
        string('turn', 'The turn (a pause after the cross)', ['L', '.', 'L'], ['cross', 'shove']),
        string('maul', 'The maul (held)', ['L+'], ['maul']),
        string('crush', 'The crush (held in the string)', ['L', 'L', 'L+'], ['cross', 'knee', 'crush']),
        string('finish', 'The finish (special, at a reeling foe)', ['F'], ['finish']),
        string('super', 'The crater', ['mL'], ['super']),
        string('air-flow', 'The air flow', ['L', 'L'], ['air-cross', 'air-hammer'], true),
        string('air-slam', 'The slam (held in the air)', ['L+'], ['air-slam'], true),
      ] }),
  },
});

/** What a hero has at range, if anything: the arsenal's one sidearm, on the range button. */
export const RANGED_KITS = Object.freeze({
  bolt: { read: 'a bolt from the hand, as fast as the button is held', sidearm: { id: 'bolt', name: 'Bolt', mode: 'auto', rof: 4, damage: 0.6, impact: 6, range: 35, infinite: true, hand: 'right' } },
  volley: { read: 'a quick stream of light shots that wear a foe down', sidearm: { id: 'volley', name: 'Volley', mode: 'auto', rof: 10, damage: 0.25, impact: 2, range: 28, infinite: true, hand: 'right' } },
  thrown: { read: 'a thing drawn back and thrown: held, it is aimed; let go, it flies and lands hard', sidearm: { id: 'thrown', name: 'Throw', mode: 'draw', draw: 0.35, early: 'none', speed: 38, drop: 6, damage: 3, impact: 30, quiver: 99, nock: 0.25, hand: 'right' } },
});

/** What the special button does: the level's actions and events. One row yet. */
export const SPECIALS = Object.freeze({
  context: { read: 'at a foe that is reeling or in the air, the FINISH: the style\'s heaviest blow, the hero turned to it; with none, the thing at hand: a door, a switch, someone to help, whatever the level asks for where the hero stands' },
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
  if (out.ranged !== null && !RANGED_KITS[out.ranged] && !CITY_POWERS[out.ranged]) no(`.ranged is what it has at range (${list(RANGED_KITS)}; or a power, ${list(CITY_POWERS)}), or null for none, not '${out.ranged}'`);
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
// (the range button's sidearm: a kit's own, or a superhero power lowered from the street's card, hero-powers.js)
const rangedOf = (id) => (RANGED_KITS[id] ? structuredClone(RANGED_KITS[id].sidearm) : powerSidearm(id));

export function kitArsenal(kit) {
  if (!kit) return null;
  const K = readHeroKit(kit), W = structuredClone(FIGHTING_STYLES[K.style].weapon);
  return { timing: structuredClone(BASIC_ARSENAL.timing), weapons: [W], juggle: structuredClone(BASIC_ARSENAL.juggle), mp: { ...FIGHTING_STYLES[K.style].mp }, ...(K.ranged ? { ranged: [rangedOf(K.ranged)] } : {}) };
}

/** A kit's buttons, in words. */
export function kitLegendOf(kit) {
  const K = readHeroKit(kit);
  return `click  punch (again to flow on, pause to turn it, hold to charge) · Ctrl + click  super${K.ranged ? ` · Q  ${rangedOf(K.ranged).name.toLowerCase()}` : ''} · E  special (finish a reeling foe, or the thing at hand)`;
}
