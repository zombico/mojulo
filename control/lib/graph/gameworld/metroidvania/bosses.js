/**
 * THE CASTLE'S BOSSES (docs/metroidvania-map.md "Bosses"): each a foe class at the boss's rank on a skin (the foe shelf's
 * own: foes.js standFoe, as the side map stands its roster, side-map/boss-cast.js), its idea in a line, and its TIER (how
 * much taller than the hero it stands). A box's boss is named in its words (a ring's `boss`); the shelf is read by that
 * name (a boss it does not know stands as a warden). Stood in its boss room on the room's own stretch of the lane, facing
 * the way in, it is a body of the world: struck, it staggers and falls as a foe does, and its fall gives what its room
 * gives (held-gates.js, its `entity`): its seal broken, its power. Until its figure is made it stands as a block (STAND_IN).
 *
 *   CASTLE_BOSSES        { <id>: { class, skin, tier, blows, reads, moves, phases } }   a new boss is a row; `blows` its
 *                        health in the hero's blows (foes/vocab.js HERO.blow), rising as the castle goes in; `moves` and
 *                        `phases` its FIGHT, a human boss's words for the boss director (boss/bosses.js: each move a side
 *                        view's pattern in its own words, boss/patterns.js; its phases quicker as its health falls)
 *   castleBoss(id, { second? }) → the row as the director's boss (`second`: its second form's, a row's `second`: a boss
 *                        defeated into a form of its own, its own title, tier, blows, moves and phases) (boss/bosses.js readBoss reads it); a move's `look` names what
 *                        its attack looks like where its pattern's own does not say (boss/looks.js: a toss's thing)
 *   SIDE_BODY, sideBody(reach) → the body a side view's fight is measured for (boss/laws.js: on a lane, with its jump);
 *                        `reach` a feel's measured reach (feel/reach.js), else the castle's hero's numbers
 *   bossRow(name)        → { id, known, ...row }   the row a boss's name reads as (lower-cased, `the` off, hyphened)
 *   BOSS_DEFAULT         the row a boss the shelf does not know stands as
 *   CASTLE_FIGURES       { <id>: { hero } | { animal } | { bell } }   (a bell a card built on the page, bell.js)   each boss's figure in the door's words (the runner makes it,
 *                        `boss-<id>`); figuredBosses(names) → the ids a box's boss names have figures for
 *   castleFigure(id, { second? }) → the figure's door words with its wind-up clips (a winged body's flapping: its wings'
 *                        channels, boss/looks.js windClips); castleWind(id, { second? }) → the stretch of them the page plays
 *                        (`rule.boss.wind`: a beast's own, a winged body's flapWind), or null
 *   standBosses(G, B, { stature, refs? }) → { figures, entities }   (`refs` { <row id>: its figure's sketch }: stood as
 *                        it, fitted to its tier's height; without one, a stand-in)   each of the box's bosses (scene.js boxOf `bosses`, laid
 *                        `bosses: 'stood'`) stood by the foe shelf where its room says, at its tier's height, its health its
 *                        blows, on its room's own stretch of the lane (it never follows her out of its room), its bar the
 *                        castle's (held-gates-view.js), never one over its head; a form that flies its SKY (`rule.boss.sky`:
 *                        the air over its floor that keeps its head in the frame, FRAME_TOP of the frame's height)
 *   BOSS_LAWS, bossLaws(B, { body? }) → [{ id, holds, says }]   known (each boss a row of the shelf, not the default it
 *                        falls back to), fights (each boss's fight held to the director's laws for a body on the lane,
 *                        its jump among its escapes: every move told, escapable, survivable, opened after; three moves
 *                        or more; its phases falling and quickening), room-to-fight (each boss's stretch of the lane at least FIGHT_ROOM metres: room to back off and
 *                        come in), rising (no boss along the walk under EASE of the hardest before it: the castle never
 *                        eases going in)
 *   FIGHT_ROOM, BOSS_EASE
 *
 * Pure.
 */
import { standFoe } from '../foes.js';
import { libraryFigure, foeFigure } from '../stage-figures.js';
import { sideFoe } from '../side-map/cast.js';
import { HERO } from '../../foes/vocab.js';
import { bossRule, bossMind } from '../../boss/stand.js';
import { bossLaws as directorLaws } from '../../boss/bosses.js';
import { lookOfMove, windClips, flapWind } from '../../boss/looks.js';
import { PATTERNS } from '../../boss/patterns.js';
import { SEEDED_OUTFITS } from '../../outfit/styles.js';
// (its FIGHT: the director's words for a human boss, boss/bosses.js: its moves over the side view's patterns,
// boss/patterns.js, said in its own words, and its phases, quicker as its health falls)
const ph = (moves, tempo, more = {}) => Object.freeze({ moves: Object.freeze(moves), tempo, ...more });
export const CASTLE_BOSSES = Object.freeze({
  'gate-warden': Object.freeze({ class: 'guard', skin: Object.freeze({ people: 'undead' }), tier: 1.5, blows: 14, reads: 'a dead halberdier in black plate, holding the wall\'s gate: it stands and cuts at what comes in reach',
    moves: Object.freeze({ 'halberd-cleave': { pattern: 'cleave', says: 'draws the halberd back over its shoulder' }, 'haft-slam': { pattern: 'quake', says: 'raises the halberd high and drives its haft into the floor' }, thrust: { pattern: 'lunge', says: 'sets its feet and levels the blade low' } }),
    phases: Object.freeze([ph({ 'halberd-cleave': 3, thrust: 1 }, 2.4), ph({ 'halberd-cleave': 2, 'haft-slam': 2, thrust: 1 }, 1.9, { below: 0.5, temper: 'bold' })]) }),
  gatekeeper: Object.freeze({ class: 'guard', skin: Object.freeze({ people: 'infernal' }), tier: 1.6, blows: 24, reads: 'a horned keeper of the keep\'s portcullis, its blade as long as the gate is wide',
    moves: Object.freeze({ 'gate-cut': { pattern: 'cleave', says: 'swings its great blade back' }, 'gate-slam': { pattern: 'quake', says: 'lifts its blade in both hands over its horns' }, 'horn-rush': { pattern: 'lunge', says: 'lowers its horns and paws the floor' } }),
    phases: Object.freeze([ph({ 'gate-cut': 2, 'horn-rush': 1 }, 2.2), ph({ 'gate-cut': 2, 'gate-slam': 2, 'horn-rush': 1 }, 1.8, { below: 0.6, temper: 'opportunist' }), ph({ 'gate-slam': 2, 'horn-rush': 2, 'gate-cut': 1 }, 1.4, { below: 0.3, temper: 'relentless' })]) }),
  'bell-ringer': Object.freeze({ class: 'lobber', skin: Object.freeze({ people: 'undead' }), tier: 1.4, blows: 16, reads: 'the tower\'s dead ringer, hurling the bell-ropes\' weights in arcs',
    moves: Object.freeze({ 'rope-weight': { pattern: 'toss', says: 'whirls a rope\'s weight and lets it fly' }, peal: { pattern: 'toll', says: 'hauls on the bell-rope; the tower rings before the peal' }, 'clapper-swing': { pattern: 'cleave', says: 'swings a bell\'s clapper back like a club' } }),
    phases: Object.freeze([ph({ 'rope-weight': 3, 'clapper-swing': 1 }, 2.4), ph({ 'rope-weight': 2, peal: 2, 'clapper-swing': 1 }, 1.9, { below: 0.5 })]) }),
  bellkeeper: Object.freeze({ class: 'lobber', skin: Object.freeze({ people: 'undead' }), tier: 1.5, blows: 18, reads: 'the ward\'s bell-keeper, throwing its cracked bells',
    moves: Object.freeze({ 'cracked-bell': { pattern: 'toss', says: 'hefts a cracked bell and throws it', look: { tell: { falling: 'bell' } } }, knell: { pattern: 'toll', says: 'strikes the bell at its hip; the air rings' }, 'bell-drop': { pattern: 'quake', says: 'lifts its heaviest bell over its head' } }),
    phases: Object.freeze([ph({ 'cracked-bell': 2, 'bell-drop': 1 }, 2.3), ph({ 'cracked-bell': 2, knell: 2, 'bell-drop': 1 }, 1.8, { below: 0.5 })]) }),
  'great-bell': Object.freeze({ class: 'turret', skin: Object.freeze({ people: 'undead' }), tier: 1.8, blows: 22, reads: 'the great bell, swung by its dead and tolling: each toll a round that crosses the spire',
    moves: Object.freeze({ 'great-toll': { pattern: 'toll', says: 'swings back on its beam; the spire hums' }, shards: { pattern: 'toss', says: 'cracks, and a shard of bronze breaks away', look: { tell: { falling: 'bell' } } }, shudder: { pattern: 'quake', says: 'drops on its beam; the floor shudders' } }),
    phases: Object.freeze([ph({ 'great-toll': 2, shards: 2 }, 2.4), ph({ 'great-toll': 2, shards: 1, shudder: 2 }, 1.8, { below: 0.5 })]) }),
  warden: Object.freeze({ class: 'stalker', skin: Object.freeze({ people: 'infernal' }), tier: 1.5, blows: 22, reads: 'the chapel\'s warden, a devil in a monk\'s cowl: quick, and it cuts as it comes',
    moves: Object.freeze({ hellclaw: { pattern: 'cleave', says: 'draws its claws back under its cowl' }, spring: { pattern: 'lunge', says: 'crouches low, its tail lashing' }, brimstone: { pattern: 'toss', says: 'cups a coal of brimstone and throws it' } }),
    phases: Object.freeze([ph({ hellclaw: 2, spring: 2 }, 2), ph({ hellclaw: 2, spring: 2, brimstone: 2 }, 1.5, { below: 0.5, temper: 'relentless' })]) }),
  'crypt-lord': Object.freeze({ class: 'lurker', skin: Object.freeze({ species: 'wolf' }), tier: 1.8, blows: 26, reads: 'a great wolf of the crypt: it waits in the dark and springs',
    moves: Object.freeze({ pounce: { pattern: 'lunge', says: 'flattens to the floor, hackles up' }, maul: { pattern: 'cleave', says: 'rears with its jaws wide' }, howl: { pattern: 'toll', says: 'throws its head back; the crypt goes still' } }),
    phases: Object.freeze([ph({ pounce: 2, maul: 2 }, 2.2), ph({ pounce: 2, maul: 1, howl: 2 }, 1.8, { below: 0.6 }), ph({ pounce: 3, maul: 1, howl: 1 }, 1.4, { below: 0.3, temper: 'relentless' })]) }),
  // THE NEW ROOMS' (a boss for the belfry, the barbican, the armoury and the upper keep): each a fight of its own, an
  // attack the others have not (blades from the air, a boulder, lances out of the floor, a tail and venom)
  // (the belfry's: she fights from the air, a carrion bird in a nun's rags)
  'carrion-abbess': Object.freeze({ class: 'stalker', skin: Object.freeze({ people: 'undead' }), tier: 1.6, blows: 20, reads: 'the belfry\'s abbess, dead and feathered: a carrion bird in a nun\'s rags who fights from the air',
    moves: Object.freeze({ 'feather-volley': { pattern: 'volley', says: 'beats up over the floor and draws back an arm full of black quills' }, 'carrion-dive': { pattern: 'swoop', says: 'beats up into the bells and hangs there, then folds her wings and dives' },
      'talon-drop': { pattern: 'dive', says: 'rises over Erina on her wings; her shadow spreads under her' }, shriek: { pattern: 'toll', says: 'throws her beak open; the bells hum with her' } }),
    phases: Object.freeze([ph({ 'feather-volley': 2, 'carrion-dive': 2 }, 2.3), ph({ 'feather-volley': 2, 'carrion-dive': 1, 'talon-drop': 2, shriek: 1 }, 1.8, { below: 0.5, temper: 'opportunist' })]) }),
  // (the barbican's: chained at the gate, it throws the broken wall at what comes in)
  'siege-ogre': Object.freeze({ class: 'guard', skin: Object.freeze({ people: 'orcish' }), tier: 2, blows: 20, reads: 'the barbican\'s siege ogre, chained at the gate with a maul and the boulders of its broken wall',
    moves: Object.freeze({ 'maul-swing': { pattern: 'cleave', says: 'drags its maul back over its shoulder' }, 'wall-boulder': { pattern: 'boulder', says: 'heaves a boulder of the broken wall over its head' },
      'ground-pound': { pattern: 'quake', says: 'raises its maul in both fists' }, 'shoulder-rush': { pattern: 'lunge', says: 'drops its shoulder and stamps' } }),
    phases: Object.freeze([ph({ 'maul-swing': 2, 'wall-boulder': 2 }, 2.5), ph({ 'maul-swing': 1, 'wall-boulder': 2, 'ground-pound': 2, 'shoulder-rush': 1 }, 2, { below: 0.5, temper: 'bold' })]) }),
  // (the armoury's: an empty suit of plate, the armoury's lances at its call)
  armiger: Object.freeze({ class: 'guard', skin: Object.freeze({ people: 'undead' }), tier: 1.7, blows: 24, reads: 'the armoury\'s armiger: an empty suit of gilded plate, nothing inside it, the armoury\'s lances at its call',
    moves: Object.freeze({ 'lance-field': { pattern: 'lances', says: 'drives its gauntlet into the floor; the marks spread from Erina\'s feet' }, 'blade-arc': { pattern: 'cleave', says: 'draws its sword back over its shoulder' },
      'shield-rush': { pattern: 'lunge', says: 'sets its shield and lowers itself behind it' }, 'flung-shield': { pattern: 'toss', says: 'hurls its shield high' } }),
    phases: Object.freeze([ph({ 'blade-arc': 2, 'shield-rush': 1, 'lance-field': 1 }, 2.3), ph({ 'blade-arc': 1, 'lance-field': 2, 'shield-rush': 1, 'flung-shield': 2 }, 1.8, { below: 0.6, temper: 'opportunist' }),
      ph({ 'lance-field': 3, 'shield-rush': 2, 'blade-arc': 1 }, 1.4, { below: 0.3, temper: 'relentless' })]) }),
  // (the upper keep's: the lord's countess, a serpent below the waist)
  'serpent-countess': Object.freeze({ class: 'stalker', skin: Object.freeze({ people: 'infernal' }), tier: 1.8, blows: 30, reads: 'the lord\'s countess, a serpent below the waist: she coils across the upper keep and spits venom',
    moves: Object.freeze({ 'tail-sweep': { pattern: 'coil', says: 'draws her coils in under her; her tail lifts' }, 'venom-spit': { pattern: 'venom', says: 'rears back, her throat swelling' },
      'fang-strike': { pattern: 'lunge', says: 'draws her head back on her coils' }, 'fan-cut': { pattern: 'cleave', says: 'raises her bladed fan behind her' } }),
    phases: Object.freeze([ph({ 'fang-strike': 2, 'fan-cut': 2, 'tail-sweep': 1 }, 2.2), ph({ 'tail-sweep': 2, 'venom-spit': 2, 'fang-strike': 1, 'fan-cut': 1 }, 1.7, { below: 0.55, temper: 'opportunist' }),
      ph({ 'venom-spit': 2, 'tail-sweep': 2, 'fang-strike': 2 }, 1.3, { below: 0.25, temper: 'relentless' })]) }),
  'lord-of-the-keep': Object.freeze({ class: 'pursuer', skin: Object.freeze({ people: 'infernal' }), tier: 1.6, blows: 34, reads: 'the vampire lord herself, cool and sharp: she follows Erina across her throne room and strikes',
    moves: Object.freeze({ 'cape-sweep': { pattern: 'cleave', says: 'gathers her cape and sweeps it round' }, 'bat-swarm': { pattern: 'toss', says: 'opens her cape; bats pour out where Erina stood', look: { tell: { falling: 'swarm' } } }, 'blood-wave': { pattern: 'toll', says: 'raises both hands; the throne room\'s air turns red' }, 'shadow-lunge': { pattern: 'lunge', says: 'sinks into her own shadow' } }),
    phases: Object.freeze([ph({ 'cape-sweep': 2, 'bat-swarm': 2 }, 2.2), ph({ 'cape-sweep': 2, 'bat-swarm': 1, 'blood-wave': 2 }, 1.8, { below: 0.66, temper: 'opportunist' }), ph({ 'blood-wave': 2, 'shadow-lunge': 2, 'bat-swarm': 1, 'cape-sweep': 1 }, 1.3, { below: 0.33, temper: 'relentless' })]),
    // (her SECOND FORM: cut down, she does not fall but tears out of her finery as the beast she is: a mode of her own,
    // its health its blows, taller by its tier, its fight quicker and closer)
    // (`over`: its figure's height over its body's, the wings raised above its head: the fit stands the BODY at the tier)
    second: Object.freeze({ title: 'The Lord Unbound', tier: 2.5, over: 1.45, blows: 24, reads: 'her true shape: a dragon on two legs, horned and spined, its wings crimson skin on bone that beat as it strikes and carry it into the air, gold at its shoulders and arms',
      moves: Object.freeze({ 'wing-rake': { pattern: 'cleave', says: 'rears up, its wings flung wide' }, 'tail-charge': { pattern: 'lunge', says: 'drops low, its wings folded back along it' }, 'bat-storm': { pattern: 'toss', says: 'beats its wings; the dark above it splits into bats', look: { tell: { falling: 'swarm' } } }, 'shadow-roar': { pattern: 'toll', says: 'throws its horned head back, its wings spread' },
        // (the air's: it takes off, beating up over the room, and comes down out of it)
        'sky-rake': { pattern: 'swoop', says: 'beats up off the floor and hangs over the room, then folds its wings and dives' },
        'wyrm-fall': { pattern: 'dive', says: 'rises on its wings over the body and hangs there; its shadow darkens the floor' } }),
      phases: Object.freeze([ph({ 'wing-rake': 2, 'tail-charge': 2, 'bat-storm': 1, 'shadow-roar': 1, 'sky-rake': 2, 'wyrm-fall': 2 }, 1.4, { temper: 'relentless' })]) }) }),
});
export const BOSS_DEFAULT = 'gate-warden';

// THEIR FIGURES (the character door's words, made by the runner as each boss's own figure, `boss-<id>`; the great wolf
// the animal door's; the great bell none yet, a stand-in until a bell is made): the castle's palette, iron and crimson,
// bone and bronze; each its idea read at a glance from the side. Found by minting: the undead's zombie does not yet wear
// the knight's sabatons nor the cleric's robe (the door refuses both), so the Gate Warden and the Bellkeeper are dead
// by their colours and their theme, not the undead word; and the cleric's robe under a `monk` silhouette is two bodices
// (refused), so the Bellkeeper's outline is the bell's; the `knight` silhouette lays garment pauldrons over the armour's
// own (a grey roof over the shoulders), so the knights' outline is the plain wedge
const MYTH = Object.freeze({ genre: 'fantasy', register: 'mythic', canon: 'western' });
// (the castle's creepy dress, the outfit's own pieces: a CLOAK to its length, wrapped round, lined in a colour of its own,
// its hem TORN into tongues; RAGS of its cloth hung off the plate at the hips and the shoulders;
// a SHROUD a dress of those pieces alone, worn over the plate (no top, no bottom: the armour's); a seeded card with
// pieces added, and some dropped)
const cloak = (hem, wrap, lining, torn = null) => ({ kind: 'cloak', hem, wrap, material: 'wool', lining, hood: { worn: 'down', point: 'none' }, ...(torn ? { torn: torn.depth, tongues: torn.tongues } : {}) });
const shroud = (id, pieces, tones) => ({ type: 'outfit', style: { id, dials: { stylize: 0.45, fit: 0.4, coverage: 1, ornament: 1 }, language: { top: false, bottom: false, focal: 'collar' }, pieces, tones } });
const withPieces = (style, add, { drop = [] } = {}) => { const C = SEEDED_OUTFITS[style]; return { ...structuredClone(C), id: `${style}-castle`, pieces: [...C.pieces.filter((p) => !drop.includes(p.kind)), ...add] }; };
export const CASTLE_FIGURES = Object.freeze({
  'gate-warden': Object.freeze({ hero: { name: 'The Gate Warden', cast: { pole: 'male', build: 'brute' }, head: 'landmark',
    adorn: { type: 'armor', style: 'knight', theme: 'death-knight', without: ['pauldron'], dials: { mass: 0.7, ornament: 1 } },
    outfit: shroud('grave-shroud', [cloak('ankle', 0.75, 'accent', { depth: 0.26, tongues: 6 }), { kind: 'rags', count: 8, len: 0.55, shoulders: true, colour: '#6a6256' }, { kind: 'collar', rise: 0.2 }, { kind: 'chain' }, { kind: 'trophy' }], { OutfitSecond: '#100c0c', OutfitAccent: '#4a0c10', OutfitTrim: '#6a6a60' }),
    palette: { Skin: '#9a9a86' }, gear: { right: { item: 'staff', style: 'grave', parts: { head: 'halberd' }, dials: { mass: 1.6 } } }, stylism: { ...MYTH, silhouette: 'wedge' } } }),
  gatekeeper: Object.freeze({ hero: { name: 'The Gatekeeper', cast: { pole: 'male', build: 'brute' }, head: 'landmark',
    adorn: { type: 'armor', style: 'knight', without: ['pauldron'], dials: { mass: 0.7, ornament: 1 } }, headgear: 'skullKnight',
    outfit: shroud('gate-rags', [cloak('calf', 0.65, 'accent', { depth: 0.3, tongues: 5 }), { kind: 'rags', count: 6, len: 0.45, shoulders: true, colour: '#6a2a1e' }, { kind: 'charms', charm: 'bone' }, { kind: 'trophy' }, { kind: 'chain' }], { OutfitSecond: '#1a0c0c', OutfitAccent: '#5a1410', OutfitTrim: '#9a6a32' }),
    palette: { Skin: '#7a2a22', Plate: '#3a1a1a', Iron: '#2a1a1a', Bronze: '#9a6a32', Helm: '#2a1414', Trim: '#9a6a32', Rivet: '#c9a75a', Accent: '#8a1a1a', Leather: '#1e1212', Top: '#2a1416', Bottom: '#1a0e10', Shoes: '#120a0a' },
    gear: { right: { item: 'greatsword', style: 'brutal', dials: { mass: 1.3 } } }, stylism: { ...MYTH, silhouette: 'wedge' } } }),
  'bell-ringer': Object.freeze({ hero: { name: 'The Bell Ringer', cast: { pole: 'male', build: 'stout' }, head: 'landmark',
    undead: { form: 'zombie' }, outfit: { type: 'outfit', style: withPieces('mage', [{ kind: 'charms', charm: 'bell' }, { kind: 'chain' }]) },
    palette: { Skin: '#8a9a7a', OutfitBase: '#4a3a2a', OutfitSecond: '#2e241a', OutfitTrim: '#8a6a32', OutfitAccent: '#c9a75a', Outer: '#2e241a', Top: '#4a3a2a', Bottom: '#3a2e22', Shoes: '#221a14' },
    gear: { right: { item: 'staff', style: 'grave', parts: { head: 'mace' } } }, stylism: { ...MYTH, silhouette: 'monk' } } }),
  bellkeeper: Object.freeze({ hero: { name: 'The Bellkeeper', cast: { pole: 'male', build: 'stout' }, head: 'landmark',
    outfit: { type: 'outfit', style: withPieces('cleric', [{ kind: 'charms', charm: 'both' }, { kind: 'chain' }]) },
    palette: { Skin: '#a8a490', OutfitBase: '#3a3440', OutfitSecond: '#26222c', OutfitTrim: '#8a7a5a', OutfitAccent: '#c9a75a', Outer: '#26222c', Top: '#3a3440', Bottom: '#2a2630', Shoes: '#1a141a' },
    gear: { right: { item: 'staff', style: 'grave', parts: { head: 'ringed' } } }, stylism: { ...MYTH, silhouette: 'bell' } } }),
  warden: Object.freeze({ hero: { name: 'The Warden', cast: { pole: 'male', build: 'lithe' }, head: 'landmark',
    beast: { kin: 'draconic', tail: 'thin', claws: 'long' }, headgear: 'pointedCowl',
    palette: { Skin: '#8a2a2a', Outer: '#120a0e', Panel: '#4a0e18', OutfitBase: '#4a0e18', OutfitSecond: '#120a0e', Leather: '#120a0e', Collar: '#120a0e', Wrap: '#120a0e', Trim: '#c9a75a', Top: '#2a0e14', Bottom: '#1e0a10', Shoes: '#140c0e', Claws: '#e8dcc0' },
    stylism: { ...MYTH, silhouette: 'monk' } } }),
  // (its wind-ups its own door's: a beast's STRIKE crouches, head down, then springs, and its FLINCH drops it low with
  // its head thrown up; played through the tell and the blow by the page's wind-up, `wind`, by the pattern each move draws)
  'crypt-lord': Object.freeze({ animal: { species: 'wolf', ooze: ['dire', 'shadow'], strike: { startup: 30, active: 8, recovery: 22 } },
    wind: Object.freeze({ lunge: { wind: ['swing_neutral', 0, 0.42], strike: ['swing_neutral', 0.42, 1] }, cleave: { wind: ['swing_neutral', 0, 0.42], strike: ['swing_neutral', 0.42, 1] }, toll: { wind: ['stagger', 0, 0.5], strike: ['stagger', 0.5, 1] } }) }),
  // THE NEW ROOMS' (found by minting: a hood, even worn down, wants a head the beaked kin has none of, so the Abbess wears a
  // mantle and a wimple's collar; the castle's stylism lays a harmony accent the Ogre's palette does not pin (a cyan
  // collar), and the orc's frame is the wedge already, so it goes without)
  // (the Carrion Abbess: the avian kin in a nun's black, a white wimple and mantle, black wings swept back, rags of her habit)
  'carrion-abbess': Object.freeze({ hero: { name: 'The Carrion Abbess', cast: { pole: 'female', build: 'lithe' }, head: 'none', tune: { stature: 1.1 },
    beast: { kin: 'avian', head: 'beaked', claws: 'long', hunch: 22, mass: { trunk: 1.15, upperArm: 1.1, foreArm: 1.1, thigh: 1.15 } },
    outfit: shroud('carrion-habit', [{ kind: 'wings', span: 1.1, rise: 1, sweep: 0.75 }, { kind: 'mantle', colour: '#e8e0d0' }, { kind: 'collar', rise: 0.3, colour: '#e8e0d0' }, { kind: 'rags', count: 9, len: 0.5, shoulders: true, colour: '#2a2228' }, { kind: 'charms', charm: 'bone' }],
      { OutfitSecond: '#14101a', OutfitBase: '#e8e0d0', OutfitTrim: '#8a7a5a', OutfitAccent: '#6a1a22', OutfitBone: '#e8dcc0' }),
    palette: { Skin: '#1e1a22', Claws: '#d8ccb0', Top: '#1e1a22', Bottom: '#16121a', Shoes: '#12101a' } } }),
  // (the Siege Ogre: the orc kin in harness and rags, iron at its arms, a spiked mace)
  'siege-ogre': Object.freeze({ hero: { name: 'The Siege Ogre', cast: { pole: 'male', build: 'brute' }, tune: { stature: 1.1 }, beast: { kin: 'orc' },
    outfit: shroud('siege-rags', [{ kind: 'harness' }, { kind: 'rags', count: 6, len: 0.45, colour: '#4a3a2a' }, { kind: 'armRings' }],
      { OutfitSecond: '#3a2e22', OutfitTrim: '#6a6a60', Leather: '#2a2018', OutfitMetal: '#5a5a54', OutfitAccent: '#7a2a1a', OutfitBone: '#d8ccb0' }),
    palette: { Skin: '#6e7a5a', Top: '#3a2e22', Bottom: '#2e241a', Shoes: '#1e1812' },
    gear: { right: { item: 'staff', style: 'brutal', parts: { head: 'mace', reach: 'arm' }, dials: { mass: 2 } } } } }),
  // (the Armiger: the knight's plate gilded and tarnished, nothing in it, a dark T-visor where a face would be; its sword
  // and its shield, a red cloak torn at the hem)
  armiger: Object.freeze({ hero: { name: 'The Armiger', cast: { pole: 'male', build: 'heroic' }, head: 'landmark',
    adorn: { type: 'armor', style: 'knight', theme: 'radiant', without: ['pauldron'], dials: { mass: 0.8, ornament: 2 } }, headgear: 'heavyTVisor',
    outfit: shroud('armiger-tabard', [cloak('calf', 0.6, 'accent', { depth: 0.24, tongues: 5 }), { kind: 'rags', count: 4, len: 0.4, colour: '#5a1418' }, { kind: 'trophy' }], { OutfitSecond: '#2a0c10', OutfitAccent: '#7a1a1e', OutfitTrim: '#c9a75a' }),
    palette: { Skin: '#0a080c', Cloth: '#5a1418', Glow: '#e0c070', Helmet: '#8a7a4a', HelmetTrim: '#e0c070', HelmetVisor: '#050406', Visor: '#050406', Plate: '#8a7a4a', Iron: '#3a3428', Bronze: '#c9a75a', Helm: '#8a7a4a', Trim: '#e0c070', Rivet: '#e0c070', Accent: '#7a1a1e', Leather: '#1e1414', Top: '#1a1416', Bottom: '#120e10', Shoes: '#0e0a0a' },
    gear: { right: { item: 'greatsword', style: 'historical', dials: { mass: 1.1 } }, left: { item: 'shield', style: 'historical' } }, stylism: { ...MYTH, silhouette: 'wedge' } } }),
  // (the Serpent Countess: the serpentine kin (a coil for legs) under the anime head, sharp and cool, her hair long and
  // dark, a noble's purple with gold at her throat and arms)
  'serpent-countess': Object.freeze({ hero: { name: 'The Serpent Countess', cast: 'female', head: 'anime', animeStyle: 'shonen-high', animeBody: 'maki',
    beast: { kin: 'serpentine' }, look: ['rival', 'sharp', 'narrow-eyes', 'mature'], hair: ['long'], expression: 'deadpan',
    outfit: shroud('countess-bodice', [{ kind: 'mantle', colour: 'base' }, { kind: 'collar', rise: 0.24, flare: 3 }, { kind: 'torc' }, { kind: 'armRings' }, { kind: 'sash' }], { OutfitSecond: '#1a0a2a', OutfitBase: '#3a1050', OutfitTrim: '#c9a75a', OutfitAccent: '#c9a75a' }),
    palette: { Skin: '#e6e0d8', Hair: '#1a2a22', Scales: '#2a5a3a', Top: '#3a1050', Bottom: '#2a5a3a', Shoes: '#1a2a22' } } }),
  // (the great bell: no door makes a bell, so it is a card of its own, bell.js, built on the page with its swings)
  'great-bell': Object.freeze({ bell: { card: 'great-bell' } }),
  // (the vampire lord a woman, androgynous: the slim female body squared at the shoulder and straightened at the hip, a
  // sharp, cool face, the hair swept back short; the noble's dress kept)
  'lord-of-the-keep': Object.freeze({ hero: { name: 'The Lord of the Keep', cast: 'female', head: 'anime', animeStyle: 'shonen-high', animeBody: 'maki',
    tune: { shoulders: 1.08, hips: 0.92, waist: 1.06 },
    look: ['rival', 'sharp', 'narrow-eyes', 'mature'], hair: ['swept-back'], expression: 'deadpan',
    outfit: { type: 'outfit', style: withPieces('noble', [{ kind: 'collar', rise: 0.24, flare: 3 }, cloak('ankle', 0.8, 'base', { depth: 0.16, tongues: 7 })], { drop: ['mantle'] }) },
    palette: { Skin: '#ece4ea', Hair: '#d9d6e0', Outer: '#0e0a10', OutfitBase: '#4a0a1a', OutfitSecond: '#1a0a12', OutfitTrim: '#c9a75a', OutfitAccent: '#c9a75a', Top: '#3a0a18', Bottom: '#140a10', Shoes: '#0e0a0c' },
    stylism: { ...MYTH, canon: 'anime', silhouette: 'balance' } },
    // (her second form's: a DRAGON ON TWO LEGS, the draconic kin at its least human: digitigrade legs, a dragon's head,
    // horns, a thick spined tail, long claws, a deep hunch; WINGS of crimson skin on bone swept back along it (a side view
    // sees them whole: the outfit's `wings`), gold at its throat, shoulders and arms, skulls at its hips, the shreds of her
    // cape at its shoulders. A body on a person's skeleton, so it winds up as the castle's people do)
    second: { hero: { name: 'The Lord Unbound', cast: { pole: 'female', build: 'lithe' }, head: 'none', tune: { stature: 1.15 },
      beast: { kin: 'draconic', legs: 'digitigrade', head: 'dragon', tail: 'thick', claws: 'long', ridge: 'spines', hunch: 30, mass: { trunk: 1.2, upperArm: 1.2, foreArm: 1.3, hand: 1.5, thigh: 1.4, shank: 1.2 } },
      outfit: shroud('unbound-wyrm', [{ kind: 'wings', span: 1.1, rise: 1.0, sweep: 0.75 }, { kind: 'torc' }, { kind: 'armRings' }, { kind: 'harness' }, { kind: 'trophy' }, { kind: 'rags', count: 4, len: 0.45, shoulders: true, colour: '#4a0c16' }],
        { OutfitSecond: '#3a0e18', OutfitTrim: '#c9a75a', OutfitAccent: '#c9a75a', Leather: '#1a1014', OutfitBone: '#e8dcc0', OutfitMetal: '#c9a75a' }),
      palette: { Skin: '#2a2230', Claws: '#efe4cc', Top: '#2a2230', Bottom: '#221a28', Shoes: '#1a1420' } } } }),
});
/** A castle boss's figure as its door is asked for it: a person's with its moves' wind-up and strike clips (boss/looks.js
 * ATTACK_POSES, played by the page as it winds up and strikes); a beast's as it is (its own gaits). */
export function castleFigure(id, { second = false } = {}) {
  const F0 = CASTLE_FIGURES[id], F = second ? F0?.second : F0, R = second ? CASTLE_BOSSES[id]?.second : CASTLE_BOSSES[id];
  if (!F || F.animal || F.bell) return F ?? null;
  const pats = Object.values(R.moves).map((m) => m.pattern), wings = wingsOf(F.hero);
  return { hero: { ...F.hero, clips: { ...windClips(pats, { wings }), ...(F.hero.clips ?? {}) } } };
}
/** the channels a figure's WINGS beat on (its outfit's `wings`, outfit-plan.js: `<id>R`, `<id>L`), or null */
function wingsOf(hero) {
  const W = (hero?.outfit?.style?.pieces ?? []).find((p) => p.kind === 'wings');
  return W ? [`${W.id ?? 'wing'}R`, `${W.id ?? 'wing'}L`] : null;
}
/** The stretch of its clips a castle boss's page plays as it winds up and strikes (its `rule.boss.wind`): a beast's its
 * own door's, a winged body's its flapping wind-ups' (boss/looks.js flapWind); else none (each clip over its first half). */
export function castleWind(id, { second = false } = {}) {
  const F0 = CASTLE_FIGURES[id], F = second ? F0?.second : F0, R = second ? CASTLE_BOSSES[id]?.second : CASTLE_BOSSES[id];
  if (!F) return null;
  if (F.wind) return F.wind;
  return F.hero && wingsOf(F.hero) ? flapWind(Object.values(R.moves).map((m) => m.pattern)) : null;
}

/** The castle bosses a box's words name that have a figure to make (minted by the runner: a card built on the page, the
 * bell's, is not): their row ids. */
export function figuredBosses(names) {
  return [...new Set(names.map((n) => bossRow(n)).filter((r) => r.known && CASTLE_FIGURES[r.id] && !CASTLE_FIGURES[r.id].bell).map((r) => r.id))];
}


/** The row a boss's name reads as. */
export function bossRow(name) {
  const id = String(name ?? '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { id: CASTLE_BOSSES[id] ? id : BOSS_DEFAULT, known: !!CASTLE_BOSSES[id], ...CASTLE_BOSSES[CASTLE_BOSSES[id] ? id : BOSS_DEFAULT] };
}

const r3 = (v) => Math.round(v * 1000) / 1000;

/** A castle boss as the director's boss: its name, its idea, its tells in the castle's gold, its moves and phases. */
export function castleBoss(id, { second = false } = {}) {
  const R0 = CASTLE_BOSSES[id] ?? CASTLE_BOSSES[BOSS_DEFAULT], R = second && R0.second ? R0.second : R0, name = id.split('-').map((w) => (w === 'of' || w === 'the' ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
  return { name: second && R0.second ? R0.second.title : `The ${name}`, title: R.reads.split(':')[0], reads: R.reads, look: { tell: '#e8c77a', hazard: '#d0463c' }, moves: JSON.parse(JSON.stringify(R.moves)), phases: JSON.parse(JSON.stringify(R.phases)) };
}

/** the body a side view's fight is measured for: on the lane, no dive, its jump (Erina's measured numbers) */
export const SIDE_BODY = Object.freeze({ speed: 5.5, reaction: 0.6, dive: Object.freeze({ dist: 0, dur: 0, iframes: 0 }), lane: true, jump: Object.freeze({ height: 2.24, gravity: 20 }) });
export const sideBody = (reach) => (reach?.moves?.run ? { ...SIDE_BODY, speed: reach.speed, jump: { height: reach.moves.run.height, gravity: reach.rule.gravity } } : SIDE_BODY);

/** a castle boss's rule with each move's LOOK (boss/looks.js) carried for the page: its tell and its hit, by its pattern
 * and its own words (the thing a toss throws) */
const withLooks = (R, row) => ({ ...R, moves: Object.fromEntries(Object.entries(R.moves).map(([m, x]) => [m, { ...x, fx: lookOfMove({ id: m, ...row.moves[m] }) }])) });

/** A boss's MODES (its first form, then its second, a row's `second`): each its figure and health and title; the second
 * its own director's rule (bossRule over its moves and phases, its looks, kept to the same room), its height and its hit
 * egg at its own tier. */
function modesOf(G, b, row, { stature, figure, fig2, k, wind = null, frame = null }) {
  const S2 = row.second, H2 = r3(stature * S2.tier), R2 = r3(0.3 * S2.tier);
  // (a form that flies flies in its SKY: the air over its floor that keeps its head in the side view's frame, the frame's
  // top FRAME_TOP of its height over the floor the hero stands on)
  const flies = Object.values(S2.moves).some((m) => PATTERNS[m.pattern]?.flies), sky = flies && frame ? { sky: r3(Math.max(0, FRAME_TOP * frame - H2 - 0.3)) } : {};
  const boss2 = withLooks({ ...bossRule(castleBoss(row.id, { second: true }), { seed: k + 101, first: 1.2 }), ...(b.room ? { room: [...b.room] } : {}), ...(wind ? { wind: structuredClone(wind) } : {}), ...sky }, S2);
  return [{ figure, hp: row.blows * HERO.blow, title: b.title ?? castleBoss(row.id).name },
    // (its own size: a figure of its own stood at its tier's height by its own bounds, the page's mode fit)
    { figure: fig2 ?? figure, hp: S2.blows * HERO.blow, title: S2.title, rule: { collideHeight: H2, collideRadius: R2, boss: boss2 }, body: { radius: R2, egg: { a: r3(0.42 * S2.tier), c: r3(H2 / 2), cz: r3(H2 / 2) }, ...(fig2 ? { fit: { least: r3(H2 * (S2.over ?? 1)) } } : {}) } }];
}

/** The box's bosses stood in their rooms. */
export function standBosses(G, B, { stature = HERO.height, refs = {} } = {}) {
  const part = { figures: {}, entities: [] };
  for (const [k, b] of (B.bosses ?? []).entries()) {
    const P = b.place, row = bossRow(b.name);
    // (its FIGURE where the runner made one, `refs[<row id>]`: the character door's on the library's clips, the animal
    // door's on its own gaits; else a stand-in of its class, level.js)
    const F = CASTLE_FIGURES[row.id], ref = refs[row.id], figure = F?.bell ? { bell: { ...F.bell } } : ref && F ? (F.animal ? foeFigure(ref, { species: F.animal.species, ...(F.animal.strike ? { strike: F.animal.strike } : {}) }) : libraryFigure(ref)) : null;
    const e0 = standFoe(G, part, { id: b.id, entry: { class: row.class, rank: 'boss', skin: row.skin }, at: P.at, heading: P.heading }, figure ? { figure } : {});
    part.entities.pop();
    // (its size the tier's: as tall as the hero times its tier, its collider and its hit egg with it; its rounds the side
    // map's, travelling, seen crossing the room and jumped)
    const H = r3(stature * row.tier), R = r3(0.3 * row.tier), e = sideFoe({ ...e0, rule: { ...e0.rule, collideHeight: H, collideRadius: R } }, stature);
    // (a SECOND FORM, the row's `second`: a mode of its own (worlds/controllable/vanish.js): cut down, it reels and rises
    // as its second figure with its own health, its director's rule (its moves, its phases, its looks), its height and
    // its hit egg; only the second dies. Its figure the runner's `<id>:second`, else the first's)
    const S2 = row.second, F2 = F?.second, ref2 = S2 && refs[`${row.id}:second`], fig2 = ref2 ? `${b.id}-unbound` : null;
    if (fig2) part.figures[fig2] = F2?.animal ? foeFigure(ref2, { species: F2.animal.species, ...(F2.animal.strike ? { strike: F2.animal.strike } : {}) }) : libraryFigure(ref2);
    // (a figure grown to its tier: a door's body, a person's height, by its tier, as the side map's bosses are (its
    // bounds would count the halberd held over its head); a beast by its own bounds to the tier's height, the page's fit
    // (its skeleton shorter than its flesh))
    const { scale: _s, fit: _f, ...body } = e.body, fit = !figure || F.bell ? {} : F.animal ? { fit: { least: H, from: 1 } } : { scale: row.tier };
    // (a boss that flies flies in its sky, as a second form does: modesOf)
    const sky1 = Object.values(row.moves).some((m) => PATTERNS[m.pattern]?.flies) && B.greybox?.screen?.height ? { sky: r3(Math.max(0, FRAME_TOP * B.greybox.screen.height - H - 0.3)) } : {};
    part.entities.push({
      ...e,
      body: { ...body, ...fit, hp: row.blows * HERO.blow, hpBar: 'none', radius: R, egg: { a: r3(0.42 * row.tier), c: r3(H / 2), cz: r3(H / 2) },
        ...(S2 ? { modes: modesOf(G, b, row, { stature, figure: body.figure, fig2, k, wind: fig2 ? castleWind(row.id, { second: true }) : null, frame: B.greybox?.screen?.height ?? null }) } : {}) },
      // (on its room's own stretch of the lane, between its walls and short of its doorways)
      // (its FIGHT the director's, boss/stand.js: its moves laid at its tempo, planted through each, its mind crossing its
      // phases; between its moves it fights as its class does)
      rule: { ...e.rule, collideHeight: H, collideRadius: R, rail: { a: [0, P.span[0]], b: [0, P.span[1]], join: P.at, heading: P.heading },
        boss: withLooks({ ...bossRule(castleBoss(row.id), { seed: k + 1, first: 1.5 }), ...(b.room ? { room: [...b.room] } : {}), ...(figure && castleWind(row.id) ? { wind: structuredClone(castleWind(row.id)) } : {}), ...(fig2 ? { figures: [fig2] } : {}), ...sky1 }, row), mind: { ...(e.rule.mind ?? {}), ...bossMind(castleBoss(row.id)), rank: 'boss' } },
    });
  }
  return part;
}

/** where the side view's frame tops out over the floor the hero stands on, a share of the frame's height (the floor sits in
 * its bottom fifth) */
export const FRAME_TOP = 0.8;
export const BOSS_LAWS = Object.freeze(['known', 'fights', 'room-to-fight', 'rising']);
/** a boss's stretch of the lane at least this long, and none along the walk under this share of the hardest before it */
export const FIGHT_ROOM = 8, BOSS_EASE = 0.8;

/** The bosses' laws, measured on the box's bosses where they stand. */
export function bossLaws(B, { body = SIDE_BODY } = {}) {
  const out = [], law = (id, holds, says) => out.push({ id, holds: !!holds, says });
  const walkAt = new Map(B.layout.walk.map((id, k) => [id, k]));
  const Bs = [...(B.bosses ?? [])].sort((a, b) => walkAt.get(a.place.room) - walkAt.get(b.place.room));
  const unknown = Bs.filter((b) => !bossRow(b.name).known).map((b) => b.name);
  law('known', !unknown.length, unknown.length ? `not on the shelf, stood as the ${BOSS_DEFAULT}: ${unknown.join(', ')}` : `every boss a row of the shelf (${Bs.length})`);
  const ids = [...new Set(Bs.map((b) => bossRow(b.name).id))], forms = ids.flatMap((id) => [[id, castleBoss(id)], ...(CASTLE_BOSSES[id]?.second ? [[`${id} (second form)`, castleBoss(id, { second: true })]] : [])]);
  const broke = forms.flatMap(([id, B]) => directorLaws(B, body).filter((l) => !l.holds && !(B.phases.length === 1 && l.law === 'falling')).map((l) => `${id}: ${l.law} (${l.says})`));
  law('fights', !broke.length, broke.length ? `fights that break the director's laws on the lane: ${broke.join('; ')}` : `every boss's fight told, escaped along the lane or over, survivable and opened after, in phases that quicken (${ids.length})`);
  const tight = Bs.filter((b) => b.place.span[1] - b.place.span[0] < FIGHT_ROOM - 1e-9).map((b) => b.name);
  law('room-to-fight', !tight.length, tight.length ? `too little room to fight: ${tight.join(', ')}` : `every boss on ${FIGHT_ROOM} m of lane and more`);
  let most = 0;
  const eases = [];
  for (const b of Bs) { const n = bossRow(b.name).blows; if (n < most * BOSS_EASE - 1e-9) eases.push(b.name); most = Math.max(most, n); }
  law('rising', !eases.length, eases.length ? `the bosses ease going in at ${eases.join(', ')}` : `each boss along the walk as hard as ${BOSS_EASE} of the hardest before it, or harder`);
  return BOSS_LAWS.map((id) => out.find((l) => l.id === id));
}
