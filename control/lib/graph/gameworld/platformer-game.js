/**
 * A PLATFORMER'S GAME — the mascot platformer's rail in its two dimensions: from a feel (Jumping Giuseppe's) to a game
 * whose first level is laid (first-level.js) and whose flow is said (game/flow.js), each level a TURN (game/turn.js:
 * set up, load, play, pause, results) the play shell runs and mana-ui draws. One rail, two games:
 *
 *   2d   THE SIDE-SCROLLER (the default, the card's own view). A side camera; the first level's trails are the segments
 *        of one strip, so the level is ONE page and ONE turn. Its flow: the title (continue, a new game),
 *        the level played from its first step to its exit, its result (on to the next level, again, or the title); a
 *        level quit goes back to the title with no result.
 *   3d   THE 3D PLATFORMER (opt-in: the world's camera says it, or the brief does). A chase the player turns (`orbit`)
 *        or one that follows by itself (`follow`); the first level's trails are COURSES up a hill, each its own page and
 *        its own turn. Its flow: the title (continue, a new game from the first course, the courses), the COURSES
 *        screen (the place every course is entered from and left to: each one won opens the next), a course played,
 *        its result (on to the next course, again, or back to the courses); a course quit goes back to the courses
 *        with no result.
 *
 * WHAT BOTH SAY, the same way: the feel with its takes (the hero's own jumps, its wall, its run button); lives and
 * coins (a strip's and a trail's course both carry coins: levels.js); a front that is the start menu its flow is
 * entered through (a plain title offers play alone); a screen on its side (a platformer is read across its width); and
 * the look its menus, pause, result and HUD are drawn in by mana-ui, the HILLTOP card of the toy family
 * (playscape/ui/theme-cards/hilltop.json): cream sticker plates in a cocoa outline, a sunburst behind the title,
 * confetti on a result, screens opened and closed on an iris.
 *
 * All of it is words on the gameworld, never a second runtime. A rail proposes; the recipe is the creator's:
 * `platformerSuggestion` is a patch design_game's readout offers (next: `first-level`), 2d by default and 3d as its
 * other reading where the template has one, keeping what the world already says, and nothing is laid until written.
 *
 *   PLATFORMER_DIMENSIONS            { 2d, 3d }: each { camera, cameras, level, after, says, poles? (the templates it is
 *                                    offered for; absent: every platformer's) }
 *   PLATFORMER_TURN                  { 2d, 3d }: the turn's phases as each game plays them (the readout's and the card's)
 *   PLATFORMER_CUBE                  the geocube its levels are drawn in (`style.geocube`): the sherbet orchard
 *   PLATFORMER_LOOK                  the theme card both are drawn in (`ui.theme`); SIDE_MAP_LOOK a side map's (a robot hero's)
 *   PLATFORMER_BODY                  the body its hero is made on: the mascot's (chibi), written on a character book
 *                                    that names none (the patch's `/characters/direction/body`); a named one is kept
 *   platformerBody(pole)             → the body a template puts its hero on: its feel's rail (Galaxy Boy's the toy hero
 *                                    robot's, game-bodies.js), else the mascot's
 *   platformerFlow(dimension)        → the flow it says, in the world's level ids
 *   platformerFront(dimension)       → the start menu that flow is entered through
 *   platformerGame({ dimension?, pole?, id?, name?, seed?, kit?, boss?, camera? })
 *                                    → { dimension, level, words: { feel, camera, mechanics, levels, style, grade, screen, ui, front,
 *                                    flow }, turn, says }
 *   dimensionOf(world)               → '2d' | '3d' | null: the dimension its camera says (side; orbit or follow, the
 *                                    chases W A S D steer by the camera; null: none said, or another camera)
 *   platformerPole(world)            → { pole, from: 'feel' | 'suggested' } | null: the platformer template it plays
 *   platformerSuggestion(world)      → { dimension, pole, level, why, patch, turn, needs?, advise?, or? } | null: the
 *                                    rail as a patch over the world as it stands (what it already says is kept); null
 *                                    for a world that is no platformer's, has a course already, or plays through
 *                                    another camera. `or` is the other dimension, the same shape, where the template
 *                                    has one
 *   platformerStart(world)           → { dimension, pole, why, world: <the words to write>, turn, or? } | null: the same
 *                                    for a book with no level yet (nothing to patch: the words the first write takes)
 *
 * Pure: words in, a recipe out.
 */
import { firstLevel, firstLevelSegments, FIRST_LEVEL_DIMENSIONS } from './first-level.js';
import { firstSideMap } from './side-map/first.js';
import { POLES, variantsOf } from './feel/cards.js';
import { feelSuggestion } from './feel/suggest.js';
import { STEERED } from './cameras.js';
import { railOfGame } from './game-bodies.js';
import { HEROBOTS, HEROBOT_IDS } from './herobots.js';

export const PLATFORMER_DIMENSIONS = Object.freeze({
  '2d': Object.freeze({
    camera: 'side', cameras: Object.freeze(['side']), level: 'first', after: 'the side-scroller',
    says: 'one strip seen from the side: the first level is one page and one turn, from its first step to its exit',
  }),
  '3d': Object.freeze({
    camera: 'orbit', cameras: Object.freeze(['orbit', 'follow']), level: 'hill', after: 'the 3D platformer',
    says: 'courses up a hill under a chase camera: each course its own page and its own turn, entered from the courses screen and left back to it',
    // (the templates whose card moves in the round: the mascot platformer's; a run-and-gun stays on its lane)
    poles: Object.freeze(['jumping-giuseppe']),
  }),
});

/** The turn (game/turn.js TURN_PHASES, and the pause) as each dimension's game plays it. */
export const PLATFORMER_TURN = Object.freeze({
  '2d': Object.freeze({
    untap: 'the level is picked from the title: a new game starts on the first, continue goes to the save\'s',
    upkeep: 'the strip is loaded, one page for the whole level',
    main: 'the run from the first step to the exit; lives and coins counted on the HUD',
    interrupt: 'the pause, with the controls; quit goes back to the title, no result',
    cleanup: 'the outcome kept by the save; a level won opens the next',
    end: 'the result: on to the next level, again, or the title',
  }),
  '3d': Object.freeze({
    untap: 'the course is picked on the courses screen (a new game starts on the first; continue goes to the save\'s)',
    upkeep: 'that course is loaded, a page of its own',
    main: 'the course played under the chase camera, to its exit (the summit: to its boss\'s fall); lives and coins counted',
    interrupt: 'the pause, with the controls; quit goes back to the courses, no result',
    cleanup: 'the outcome kept by the save; a course won opens the next',
    end: 'the result: on to the next course, again, or back to the courses',
  }),
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const poleOfFeel = (f) => (typeof f === 'string' ? f : isObj(f) && typeof f.pole === 'string' ? f.pole : null);
const readDimension = (d) => { if (!FIRST_LEVEL_DIMENSIONS.includes(d)) throw new Error(`platformer: dimension is ${Object.entries(PLATFORMER_DIMENSIONS).map(([k, v]) => `${k} (${v.after})`).join(' or ')}`); return d; };

/** The body its hero is made on (game-bodies.js, the character book's `direction.body`): the mascot's, a big head on a
 * small round body (chibi; a few flat faces in a pixel world). Written on a book that names no body; a body the
 * creator named is kept. */
export const PLATFORMER_BODY = 'mascot';
/** The body a platformer's template puts its hero on: its feel's rail (game-bodies.js railOfGame: Galaxy Boy's the toy
 * hero robot's, too real a body for a chibi), else the mascot's. */
export const platformerBody = (pole) => railOfGame({ feel: pole })?.rail ?? PLATFORMER_BODY;

/** The geocube its levels are drawn in (era/geocube.js GEOCUBE_PRESETS): the sherbet orchard, warm pastels (a peach
 * floor, pink blossom, cream blocks) and one mint accent, the values in three masses so a platform reads at a glance.
 * Written on a world whose style names no cube; a cube the creator named is kept (the toy hill is its sibling: clean
 * greens under a clear sky). The side strip is drawn in it and a course in the round is skinned from it. */
export const PLATFORMER_CUBE = 'sherbet-orchard';

/** The theme card both dimensions are drawn in (playscape/ui/theme-cards/). */
export const PLATFORMER_LOOK = 'hilltop';
/** The look a side map's robot hero is drawn in (`ui.theme`): the 8-bit action platformer's, theme-cards/galaxy.json. */
export const SIDE_MAP_LOOK = 'galaxy';

/** The flow a dimension says, in the world's level ids. The side-scroller's home is its title, the 3D platformer's its
 * courses screen; in both a level won shows its result and goes on, and one quit goes home with no result. */
export function platformerFlow(dimension = '2d') {
  const round = readDimension(dimension) === '3d', list = round ? 'courses' : 'levels', home = round ? 'courses' : 'title', play = round ? 'course' : 'level';
  return {
    start: 'title', home,
    steps: {
      // (the side-scroller's first game is one level, the strip: a levels screen lists nothing yet, so it has none; a
      // game that grows levels adds the entry and the screen, as the 3D platformer's courses are)
      title: { kind: 'screen', screen: 'title', on: { continue: '$continue', play: '$first', ...(round ? { levels: list } : {}) } },
      ...(round ? { [list]: { kind: 'screen', screen: 'levels', on: { pick: '$picked', back: 'title' } } } : {}),
      [play]: { kind: 'level', level: '$any', on: { won: 'result', lost: 'result', left: home } },
      result: { kind: 'screen', screen: 'result', on: { next: ['$next', home], again: '$again', home } },
    },
  };
}

/** The front a flow is entered through: the start menu (continue, a new game, and the 3D platformer's courses: a plain
 * title offers play alone, so a save could not be continued and the courses would be reached only after one). The cover, the
 * tagline and the credits stay the interface's to add. */
export function platformerFront(dimension = '2d') {
  return { menu: readDimension(dimension) === '3d' ? ['continue', 'play', 'levels'] : ['continue', 'play'] };
}

/** The platformer templates whose first level in two dimensions is a side map (side-map/first.js), not a strip. */
export const SIDE_MAP_POLES = Object.freeze(['galaxy-boy']);

/**
 * THE SIDE SCROLLER'S FOES: its bestiary in the hero's own design language. The ROBOTS are animals carried into the toy
 * hero robot (the mutagen's `herobot` ooze: a helmet over a big head, ear domes, a gem, antennae, ball joints, panel
 * seams, LED eyes, moulded plastic), each keeping its own animal's face, never a person's; the CRITTERS are the game's
 * own (the `mascot` ooze: a big round head, big eyes, stumpy limbs, one signature piece). Each a class of the foe shelf,
 * so it moves and hurts as its class does; the level names them in the order it teaches them (side-map/cast.js lays
 * them on its spawners in turn).
 */
/** A ROBOT's death on a side map: it is DESTROYED, the killing blow choosing how (gameworld/vanish.js): a round or a crush
 * blows it apart at every joint, its pieces flung and falling in the explosion; a saber's cut cleaves it through. A
 * critter is squashed, as a platformer's are. Its pieces go in a puff of smoke. */
export const ROBOT_WRECK = Object.freeze({ is: 'smoke', die: 'destroy', by: Object.freeze({ round: Object.freeze({ die: 'dismantle', sever: 'all' }), burst: Object.freeze({ die: 'dismantle', sever: 'all' }), crush: Object.freeze({ die: 'dismantle', sever: 'all' }) }) });
// a HEAVY: the class at the elite rank (foes/vocab.js FOE_RANKS: three times the downs, a little taller), its robot
// plated over (the mutagen's `transmetal` on the herobot: a chrome faceplate, chrome legs and back plate, pistons), so
// it reads armoured before it is shot and takes a dozen taps to drop
const heavy = (cls, species) => ({ class: cls, rank: 'elite', skin: { species, ooze: ['herobot', 'transmetal'] }, vanish: ROBOT_WRECK });
const robot = (cls, species) => ({ class: cls, skin: { species, ooze: 'herobot' }, vanish: ROBOT_WRECK });
export const SIDE_MAP_FOES = Object.freeze({
  // a hard-hatted runner: walks at the hero, a stomp or a pellet downs it
  'hardhat': robot('walker', 'guineaPig'),
  // a hopping critter: met in the air as often as on the floor
  'hopfrog': { class: 'hopper', skin: { species: 'frog', ooze: 'mascot' } },
  // a ram: braces, then charges down the lane
  'ram': robot('charger', 'wildBoar'),
  // a batwing: weaves overhead and swoops
  'batwing': robot('swooper', 'fruitBat'),
  // a shell gun: never moves, turns and fires a slow round (side-map/cast.js FOE_SHOT): jump it
  'shellgun': robot('turret', 'tortoise'),
  // a spiky critter: paces its floor
  'prickle': { class: 'walker', skin: { species: 'hedgehog', ooze: 'mascot' } },
  // HEAVIES: an armoured rhino that braces and charges, and an armoured bunker gun, a dozen taps (or a full charge and a
  // few) each
  'ironhorn': heavy('charger', 'rhino'),
  'bunker': heavy('turret', 'tortoise'),
});
/** Level 0's foes, in the order it meets them along its spawners (side-map/cast.js lays them in turn): one walker on its
 * first run, its `meet` zone's three, the dash run's two, then its gauntlet's six with the heavies among them. */
export const SIDE_MAP_FIRST_FOES = Object.freeze(['hardhat', 'hardhat', 'hopfrog', 'shellgun', 'ram', 'batwing', 'hardhat', 'ironhorn', 'shellgun', 'batwing', 'bunker', 'prickle']);

/** How each way of playing is said on the co-star's pick. */
const COSTAR_ABOUT = Object.freeze({ buster: 'The arm cannon: tap to shoot, hold to charge.', saber: 'The saber: press to cut, again for the string.' });

/** The rail's game in a dimension: the words to write on a gameworld (see the header). */
export function platformerGame({ dimension = '2d', pole = 'jumping-giuseppe', id, name, seed, kit, boss = false, camera, hero, costar } = {}) {
  const D = PLATFORMER_DIMENSIONS[readDimension(dimension)];
  if (!POLES[pole] || POLES[pole].base !== 'platformer') throw new Error(`platformer: '${pole}' is not a platformer's template (${Object.keys(POLES).filter((p) => POLES[p].base === 'platformer').join(', ')})`);
  if (D.poles && !D.poles.includes(pole)) throw new Error(`platformer: ${POLES[pole].name} is played in 2d (${D.after} is ${D.poles.map((p) => POLES[p].name).join(', ')}'s)`);
  if (camera !== undefined && !D.cameras.includes(camera)) throw new Error(`platformer: a ${dimension} game is played through ${D.cameras.join(' | ')} (not '${camera}')`);
  // (a run and gun's HERO, herobots.js: the variant of its feel it plays, Zero Boy's the saber)
  if (hero !== undefined && !(SIDE_MAP_POLES.includes(pole) && HEROBOTS[hero])) throw new Error(`platformer: hero is one of ${HEROBOT_IDS.join(', ')}, a side scroller's (${SIDE_MAP_POLES.map((p) => POLES[p].name).join(', ')})`);
  const variant = hero ? HEROBOTS[hero].variant : undefined;
  // (its CO-STAR, herobots.js: a second hero the player picks before each level, Astro Girl beside Galaxy Boy; `costar`:
  // false for none, or a herobot's id; the caller writes the book's `characters.costar` with the co-star it makes)
  const costarId = costar === false ? null : costar ?? (SIDE_MAP_POLES.includes(pole) && (hero ?? 'galaxy-boy') === 'galaxy-boy' ? 'astro-girl' : null);
  if (costarId && !HEROBOTS[costarId]) throw new Error(`platformer: costar is one of ${HEROBOT_IDS.join(', ')}, or false`);
  const C = costarId ? HEROBOTS[costarId] : null, H = HEROBOTS[hero ?? 'galaxy-boy'];
  const level = id ?? D.level, flow = platformerFlow(dimension), front = platformerFront(dimension), sideMap = SIDE_MAP_POLES.includes(pole) && D === PLATFORMER_DIMENSIONS['2d'];
  const words = {
    feel: { pole, takes: true, ...(variant && variant !== variantsOf(pole)[0] ? { variant } : {}) },
    camera: camera ?? D.camera,
    mechanics: { lives: 3, coins: true, legend: 'menu' },
    // (the run and gun's first level is a SIDE MAP, side-map/first.js: its zones, climbs and boss's room seen from the
    // side; the mascot platformer's the strip of trails it always was)
    levels: { [level]: sideMap ? { name: name ?? 'Level 0', ...(seed !== undefined ? { seed } : {}), sidemap: firstSideMap({ boss: 'bulwark' }), foes: { from: [...SIDE_MAP_FIRST_FOES] } } : firstLevel({ name, seed, kit, boss, dimension }) },
    // (a side map's foes: the side scroller's bestiary)
    ...(sideMap ? { foes: structuredClone({ ...SIDE_MAP_FOES }) } : {}),
    // (its SOUND and its MUSIC: the sound sheet solved from what it is, the run and gun's own voices among them, and the
    // cue sheet's score, electronic: a robot side scroller's driving synths; sound-sheet.js, cue-sheet.js)
    ...(sideMap ? { sound: {}, music: { direction: { style: 'club' } } } : {}),
    // (made for a screen on its side: a lane is read across its width, a chase camera needs it; game/screen.js)
    screen: 'screen',
    style: { geocube: PLATFORMER_CUBE },
    // (the frame graded vivid: a mascot platformer is saturated, scene/channels/grade.js)
    grade: 'vivid',
    ui: { theme: sideMap ? SIDE_MAP_LOOK : PLATFORMER_LOOK },
    front, flow,
    // (the co-star's pick, asked before each level: who goes, the hero or the co-star; setup.js, the page's `pilot`)
    ...(C ? { setup: { picks: [{ id: 'pilot', ask: 'Who goes?', from: { options: [{ id: 'hero', name: H.name, about: COSTAR_ABOUT[H.variant] ?? H.name }, { id: 'costar', name: C.name, about: COSTAR_ABOUT[C.variant] ?? C.name }] } }] } } : {}),
  };
  return { dimension, level, words, turn: PLATFORMER_TURN[dimension], says: `${POLES[pole].name} as ${D.after}: ${D.says}${C ? `, ${H.name} and ${C.name} its co-stars` : ''}`,
    ...(C ? { costar: { herobot: costarId, name: C.name, variant: C.variant } } : {}) };
}

/** The dimension a world's camera says: side is 2d, a chase is 3d; null when it says none, or another camera. */
export function dimensionOf(world) {
  const cam = world?.camera;
  if (cam === 'side') return '2d';
  if (STEERED[cam]) return '3d';
  return null;
}

/** The platformer template a world plays: its feel's, else the one its brief or its genre points at. */
export function platformerPole(world) {
  const own = poleOfFeel(world?.feel);
  if (own) return POLES[own]?.base === 'platformer' ? { pole: own, from: 'feel' } : null;
  let s = null;
  try { s = feelSuggestion(world); } catch { s = null; }
  const pole = s ? poleOfFeel(s.feel) : null;
  return pole && POLES[pole]?.base === 'platformer' ? { pole, from: 'suggested' } : null;
}

// the words a brief uses when it means the round (lower case, matched whole)
const ROUND = ['3d', '3-d', 'three dimensions', 'three-dimensional', 'in the round', 'mario 64', 'n64', 'open courses'];
const briefOf = (w) => ` ${String(typeof w?.brief === 'string' ? w.brief : w?.brief?.prompt ?? w?.brief?.text ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ')} `;

/** One dimension's patch over the world as it stands: what the world already says is kept, what it lacks is set. */
function patchFor(world, dimension, pole, boss) {
  const cam = world.camera, D = PLATFORMER_DIMENSIONS[dimension];
  const taken = isObj(world.levels) ? Object.keys(world.levels) : [];
  const id = taken.includes(D.level) ? `${D.level}-course` : D.level;
  const G = platformerGame({ dimension, pole, id, boss, ...(D.cameras.includes(cam) ? { camera: cam } : {}) });
  const ops = [];
  // the feel with its takes: the hero's own jumps, and the card's wall and run button the advanced course teaches
  const F = world.feel;
  if (F === undefined || F === null) ops.push({ op: 'set', path: '/feel', value: G.words.feel });
  else if (typeof F === 'string') ops.push({ op: 'set', path: '/feel', value: { pole: F, takes: true } });
  else if (isObj(F) && F.takes === undefined) ops.push({ op: 'set', path: '/feel/takes', value: true });
  if (cam !== G.words.camera) ops.push({ op: 'set', path: '/camera', value: G.words.camera });
  const M = world.mechanics;
  if (!isObj(M)) ops.push({ op: 'set', path: '/mechanics', value: G.words.mechanics });
  else for (const [k, v] of Object.entries(G.words.mechanics)) if (M[k] === undefined) ops.push({ op: 'set', path: `/mechanics/${k}`, value: v });
  ops.push({ op: 'set', path: `/levels/${id}`, value: G.words.levels[id] });
  // (played first: a world that already has levels starts on the one the rail lays)
  if (taken.length && (world.start ?? taken[0]) !== id) ops.push({ op: 'set', path: '/start', value: id });
  if (!isObj(world.style)) ops.push({ op: 'set', path: '/style', value: G.words.style });
  else if (world.style.geocube === undefined) ops.push({ op: 'set', path: '/style/geocube', value: PLATFORMER_CUBE });
  if (world.grade === undefined) ops.push({ op: 'set', path: '/grade', value: G.words.grade });
  if (world.ui === undefined) ops.push({ op: 'set', path: '/ui', value: G.words.ui });
  if (G.words.front && world.front === undefined) ops.push({ op: 'set', path: '/front', value: G.words.front });
  if (G.words.flow && world.flow === undefined) ops.push({ op: 'set', path: '/flow', value: G.words.flow });
  // (a platformer watches its hero: a world with no character book is walked first person, its camera kept for the run
  // that has its hero. The hero is the creator's to design, so it is said, never laid)
  // (the screen is the creator's decision, and a stored world always says one: a phone held upright is said, never changed)
  const upright = (world.screen === 'phone' || (isObj(world.screen) && world.screen.orientation === 'portrait'));
  const advise = upright ? 'its screen is held upright: a platformer is read across its width, a lane or a chase camera (screen: \'screen\', a monitor or a TV)' : null;
  if (G.words.screen && world.screen === undefined) ops.push({ op: 'set', path: '/screen', value: G.words.screen });
  if (G.words.setup && world.setup === undefined) ops.push({ op: 'set', path: '/setup', value: G.words.setup });
  for (const k of ['sound', 'music']) if (G.words[k] && world[k] === undefined) ops.push({ op: 'set', path: `/${k}`, value: G.words[k] });
  // THE HERO IS A MASCOT by default: a book whose direction names no body takes the template's body (the mascot's chibi,
  // or the toy hero robot's for the run and gun)
  const dir = isObj(world.characters) ? world.characters.direction : null, body = platformerBody(pole);
  if (isObj(dir) && dir.body === undefined) ops.push({ op: 'set', path: '/characters/direction/body', value: body });
  // A PLATFORMER'S HERO HOLDS NOTHING: it runs, jumps and stomps. The rail never writes an item; a book whose hero
  // carries some (its adornment's items: the run makes the equipped hero and the level's pilot holds them) is told,
  // and the items are the creator's to keep or take off
  const held = (isObj(world.characters?.hero?.adornment) && Array.isArray(world.characters.hero.adornment.items) ? world.characters.hero.adornment.items : []).map((i) => i?.id).filter(Boolean);
  const hands = held.length ? `its hero carries ${held.join(', ')}: a platformer's hero runs, jumps and stomps with empty hands (take the items off characters.hero.adornment.items, or keep them if the game is about them)` : null;
  const needs = isObj(world.characters) ? null : `a hero: the world has no character book yet (characters: { direction: { tradition, body: '${body}' }, hero }, gameworld-direction; ${body === PLATFORMER_BODY ? 'the mascot\'s body is the platformer\'s, chibi' : `the ${body} body is this template's`}-sized). Until it has one its levels are walked first person, the camera kept for the run that has its hero`;
  const sideMap = !!G.words.levels[id]?.sidemap;
  return { dimension, level: id, courses: sideMap ? G.words.levels[id].sidemap.zones.map((z, k) => `${k}:${z.teach ?? z.beat ?? z.climb ?? z.drop ?? z.run ?? 'room'}`) : firstLevelSegments(dimension, !!boss).map((s) => s.id), says: G.says, patch: ops, turn: G.turn, ...(needs ? { needs } : {}), ...(advise || hands ? { advise: [advise, hands].filter(Boolean).join('; ') } : {}) };
}

/** The rail as a patch over a world (see the header); null where it has nothing to offer. */
export function platformerSuggestion(world, { boss = false } = {}) {
  if (!isObj(world) || isObj(world.quick)) return null;
  const P = platformerPole(world);
  if (!P) return null;
  // (a level with a course is the rail already ridden, or the creator's own course: nothing to offer)
  if (Object.values(isObj(world.levels) ? world.levels : {}).some((L) => isObj(L) && (L.course !== undefined || L.sidemap !== undefined))) return null;
  const cam = world.camera;
  if (cam !== undefined && cam !== null && !dimensionOf(world)) return null;
  const round = PLATFORMER_DIMENSIONS['3d'].poles.includes(P.pole);
  const said = dimensionOf(world), words = ROUND.filter((w) => briefOf(world).includes(` ${w} `));
  const dimension = said ?? (round && words.length ? '3d' : '2d');
  if (dimension === '3d' && !round) return null;
  const main = patchFor(world, dimension, P.pole, boss), other = dimension === '2d' ? '3d' : '2d';
  const why = said ? `its camera is ${cam}: ${PLATFORMER_DIMENSIONS[dimension].after}` : words.length && dimension === '3d' ? `the brief says ${words.map((w) => `"${w}"`).join(', ')}: ${PLATFORMER_DIMENSIONS['3d'].after}` : `${POLES[P.pole].name} is ${PLATFORMER_DIMENSIONS['2d'].after} unless the camera or the brief says the round`;
  // (the other reading: offered where the template has one and the camera has not already chosen)
  const or = !said && (other === '2d' || round) ? patchFor(world, other, P.pole, boss) : null;
  return { ...main, pole: P.pole, from: P.from, why, ...(or ? { or } : {}) };
}

/** The rail for a book with no level yet (design_game's start readout): the words its first write takes beside its own. */
export function platformerStart(world, { boss = false } = {}) {
  if (!isObj(world) || world.levels !== undefined) return null;
  const S = platformerSuggestion(world, { boss });
  if (!S) return null;
  const words = (d) => { const cam = world.camera, G = platformerGame({ dimension: d, pole: S.pole, boss, ...(PLATFORMER_DIMENSIONS[d].cameras.includes(cam) ? { camera: cam } : {}) }); return { dimension: d, says: G.says, world: G.words, turn: G.turn, ...(isObj(world.characters) ? {} : { needs: `a hero: write the character book with it (characters: { direction: { tradition, body: '${PLATFORMER_BODY}' }, hero }, gameworld-direction): a platformer watches its hero, a mascot by default (chibi-sized)` }) }; };
  return { ...words(S.dimension), pole: S.pole, from: S.from, why: S.why, ...(S.or ? { or: words(S.or.dimension) } : {}) };
}
