/**
 * THE RAIL'S CARDS (get_game_vocab leads with them): the gameworld guide, then one card per page of the game book. The
 * guide teaches the LOOP and the PRINCIPLES, never a world: what each page asks, what it must be answered from, what
 * derives from it. Each page card's words are GENERATED from the tables the reader reads (so a card cannot drift from
 * the build), its laws are the derivations, and where it needs an example it shows a CONTRAST PAIR: two fragments
 * answering the same question from two different briefs, each with what the book derives from it, computed live
 * (samples.js DERIVE). A pair teaches the mapping from a brief to a choice; one example would teach a destination.
 *
 * No test fixture is shown anywhere here, by rule (a test reads every card for their words).
 *
 *   gameworldCards()   Map id → { id, name, summary, when, body }
 *   GAMEWORLD_CARD_IDS the guide first, then the pages in the loop's order
 *
 * Pure.
 */
import { FACILITY_IDS } from '../era/facilities.js';
import { LAYOUT_IDS } from '../era/room-layouts.js';
import { MOTIVATIONS, LABOURS, WORLD_SHAPES, ORDER_KINDS, SIDE_SHARE } from './gmn.js';
import { RAIL_IDS, SIZES, OWN, seenSays, railOf, railShapes, railSheet, variantOf } from './rails.js';
import { levelKindLine } from './level-kinds.js';
import { COATS } from '../mount/coats.js';
import { ERRAND_LAWS } from './errand.js';
import { GAME_BODIES, GAME_BODY_NAMES } from './game-bodies.js';
import { TRADITIONS, BRIDGE, FROM, LOOKS_ELEMENTS, CHARACTER_PART_IDS } from './characters.js';
import { ELEMENT_WORDS } from './element-words.js';
import { UNDERLAYERS } from './hero-looks.js';
import { AXES, VIBES } from './hero-vibe.js';
import { POLES, POLE_IDS, variantsOf } from './feel/cards.js';
import { feelCard as feelCardOf, lowerFeel } from './feel/lower.js';
import { TEMPLATE_ARSENALS, KNOCK_WORDS } from './combos.js';
import { STYLISH, VITALS_LOOKS } from './style-meter.js';
import { SHELF_IDS } from './weapon-shelf.js';
import { ACTION_OUTFITS } from '../outfit/styles.js';
import { MOOD_IDS } from './action-first-level.js';
import { ACTION_LEVEL_IDS } from './action-levels.js';
import { PLOT_KEYS } from '../era/stage.js';
import { GENRE_FEEL, FEEL_WORDS } from './feel/suggest.js';
import { IDIOMS, SYSTEM_KINDS, STAGES, TRAVERSAL_MOVES, HERO_MOVES } from './actions.js';
import { RAILS } from './adornment-kit.js';
import { DIFFICULTY_TIERS } from './setup.js';
import { ARMS_KIT_WORDS, ARMS_MAX } from './arms-kit.js';
// the carried arms a shooter's player holds (arms-kit.js): aimed with the right mouse, switched on the wheel
const ARMS_LINE = `  arms: [${ARMS_KIT_WORDS.join(' | ')} | { item, model }] (1..${ARMS_MAX})   the player's own kit: right click aims down the sights (a scope zooms, Shift steadies it), R reloads, wheel or 1-5 switches, a bow draws while held`;
import { TRADITIONS as FIGHT_TRADITIONS } from '../versus/versus-traditions.js';
import { CLASS_SLOTS } from './equipment.js';
import { SCALE, EPOCH_LEVEL, GAINED, GEAR_STAT, GEAR_BY } from './mechanics.js';
import { WORLD_STYLE, CIVILIZATION, LINK_KINDS, TOPOLOGIES } from './world.js';
import { MODES, STAMPS } from './review.js';
import { chapterById, chapterWaves } from './chapters.js';
import { LENGTHS, LOOSENESS, PASSAGES, BEAT_AS, SHAPES, LAWS as MAIN_QUEST_LAWS } from './main-quest.js';
import { LOOP_LAYERS, BODY_VERBS } from './core-loop.js';
import { GOALPOSTS } from './goalposts.js';
import { INTAKE_KINDS } from './intake.js';
import { DOES_IDS } from '../lorecube/tree.js';
import { SAMPLE_PAGES, SAMPLE_MAX, DERIVE } from './samples.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';
import { PROGRAM_IDS, PROGRAMS, BASE_USES } from '../era/programs.js';
import { STAGE_KITS, resolveKitId, GROUND_KITS } from '../era/stage.js';
import { STRUCTURE_KITS } from '../era/out-structures.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { SEEDED_STYLES } from '../equipment/styles.js';
import { QUICK_GOALS, RHYTHM_MOODS, RACE, DEFEND, DEATHMATCH_MODES, HERO_VILLAINS, HERO_TEAM, HERO_ARMY, HERO_CAMPAIGN } from './quick.js';
import { LOOK_WORDS } from './hero-look.js';
import { SCORE_MOODS } from '../beats/field-score.js';
import { CLUB_MOODS } from '../beats/club-score.js';
import { CAMERAS } from './cameras.js';
import { TEACH, VERTICALITY } from './course.js';
import { FOE_CLASSES, classStatus } from '../foes/index.js';
import { MOVES, ATTACKS, STOMPS, FOE_RANKS } from '../foes/vocab.js';
import { SWARM, MAX_FOES, PAIR_DOWNS, ROOM_FOES } from './foes.js';
import { VANISHES, SEVERS } from './vanish.js';
import { PEOPLE } from '../foes/people.js';
import { PACK_STYLES, PACK_STYLE_IDS, WILD_SIZE_IDS } from '../foes/packs.js';
const KIN_PACKED = [...new Set(PACK_STYLE_IDS.flatMap((id) => PACK_STYLES[id].peoples))];
import { SCREENS, NEW_GAME_SCREEN } from '../game/screen.js';
import { SUPERCAR_LIBRARY } from '../car-designer/vehicle-library.js';
import { RACE_MOOD_IDS } from '../roads/race-mood.js';
import { VEHICLES, TUNINGS, CONDITIONS, wheelLayout } from '../roads/vehicles.js';
import { MILITARY_CLASSES } from '../car-designer/road-military.js';
import { COURSE_PRESETS } from '../roads/course.js';
import { TRACK_LANGUAGES, LANGUAGE_OF_CLASS } from '../roads/track-language.js';
import { SPORT_PRESETS } from '../contest/sport-presets.js';
import { MATCH_SPORT_IDS, TURN_SPORT_IDS, TEAM_SPORT_IDS, INNINGS_SPORT_IDS } from '../contest/sports.js';
import { GENRES, genreCube } from './intent.js';
import { CONCERNS, concernsOf } from './concerns.js';
import { RIDES } from './ride.js';
import { LEVEL_SECTIONS } from '../level/graph.js';
import { TUNE_KEYS, HERO_MOVE_NAMES, PALETTE as HERO_PALETTE, HERO_CASTS, PROPORTION_WORDS } from '../polygonizer/hero-form.js';
import { LOOK_TABLES } from '../polygonizer/anime-looks.js';
import { HAIR_STYLE_NAMES } from '../polygonizer/humanoid-hair.js';
import { METAL_NAMES, FINISHES, FINISH_NAMES } from '../materials/metal-surface.js';
import { CRAFT } from '../skyscape/eye.js';
import { MAP_FORMS } from '../skyscape/map.js';
import { PACKS, JOINER_CLASSES, BATTLE_CLASSES } from './battles.js';
import { MINIGAME_IDS } from '../playscape/ui/minigames.js';
import { ROOMS_KEPT } from './minigames.js';
import { JUICE_REGISTERS, JUICE_LOOKS, JUICE_FLAVORS, JUICE_DIALS, juiceFloor, juiceSignature } from '../scene/juice-style.js';
import { WCD_KINDS, WCD_VIAS, WCD_PRINCIPLES } from '../wcd/wcd.js';
import { QOW_PRINCIPLES, SIGHT } from '../qow/qow.js';
import { ATLAS_LOOK_IDS } from './atlas-html.js';
import { FIGURE_MIN, HUE_KEEP, FIGURE_LAWS } from '../color-theorist/figures.js';
import { COLOUR_DIRECTIONS } from '../color-theorist/directions.js';
import { GENRE_COLOUR } from './world-palette.js';
import { BOOK_SKINS } from './book-skin.js';
import { INTENT_LOOKS } from '../playscape/ui/interface-look.js';
import { THEME_CARD_IDS } from '../playscape/ui/theme-cards/loader.js';
import { FRONT_CARD_IDS } from '../playscape/ui/front-cards/loader.js';
import { STAGE_TREATMENTS } from '../game/front-stage.js';
import { THEME_WORDS, THEME_FAMILIES } from '../../mana-ui/theme.js';
import { FLOW_KINDS, SCREEN_EVENTS, LEVEL_EVENTS, FLOW_SPECIALS, FLOW_GUARDS, FLOW_IN_PLAY } from '../game/flow.js';
import { SECTIONS, BANDS, TASKS, MISSION_LIMITS, MISSION_DEFAULTS, MISSION_MAPS, MISSION_BUILDINGS } from '../mission/index.js';
import { TEMPLATE_IDS } from '../arena-map/templates.js';
import { DRESS_SETTINGS, DRESS_SETTING_IDS, DRESS_PIECES, DRESS_PIECE_IDS } from '../brawl/brawl-dress.js';
import { PLAY_TYPES, PLAY_IDS } from '../brawl/brawl-play.js';
import { POWERS, POWER_IDS, POWER_DIALS, POWER_SCREENS } from '../brawl/brawl-powers.js';
import { VILLAINS, VILLAIN_KINDS, LIEUTENANT_KINDS, VILLAIN_WORDS } from '../brawl/brawl-villains.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';

const lines = (...xs) => xs.flat().join('\n');
const words = (o) => Object.keys(o).join(', ');
const pair = (page, a, b) => [
  'A CONTRAST PAIR (the same question, two briefs; what the book derives from each, computed now):',
  ...[a, b].map(([brief, fragment]) => [`  brief: "${brief}"`, `    ${page}: ${JSON.stringify(fragment)}`, `    derives: ${JSON.stringify(DERIVE[page](fragment))}`]).flat(),
];
const samples = (page) => `Browse more: get_game_vocab({ samples: '${page}', n?, seed? }) draws up to ${SAMPLE_MAX} random fragments of this page, brief-blind, each with what it derives.`;

// the ledger: the units asked for one at a time (gameworld/reqs.js), their jobs (jobs.js), their received gate and the
// game built up to its last accepted level (runner.js composedStages); the studio card points here
function ledgerCard() {
  return lines(
    'THE LEDGER — a game made one unit at a time: a chapter of the book, or one level (level:<id>), worked to quality',
    'before the next, so a mistake stays in its unit and an accepted unit is ground the next stands on.',
    '',
    'ASK FOR A UNIT: { ref, req: { unit, remit?, staffing? } } (a chapter, or level:<id>); what it reads and',
    'has not settled is asked for first. `reqs.current` is the unit being worked; its view carries its `req` (the remit,',
    'the precedent: the last accepted unit of its kind and the creator\'s notes on what they sent back). It is accepted',
    'when the creator approves its parts (a unit with none: { ref, req: { id, accept: true } } on their word).',
    'THE MAIN QUEST AS THE QUEUE: { req: { unit: \'beat:<id>\' } } asks for the level a beat is played on (laid now if',
    'a run would lay it), its remit filled from the quest (the act and its stage, the beat\'s foes and gains, the beats',
    'around it, the core loop; your words win key by key). { req: { quest: true } } asks for every built beat, in order.',
    'A chapter whole: { req: { unit: \'act:<id>\' } }, one req, its levels in play order and its departments one crew.',
    'A planned map\'s segments: { req: { unit: \'level:<id>\', segments: true } }, an author a segment, each its gates and role in its brief.',
    'ITS JOBS ({ ref, req: { id, start: true } }; the view\'s `req.does` says what is next: start, work, keep, critique,',
    'probe, fix, review). Hand each issued job to one agent with its brief (`req.jobs`: what it reads, writes and reports): an author',
    'sends its pages as `patch` and its `decisions`, each with `because`; diverge authors each take an `angle`, their',
    'patches held until you keep one ({ req: { id, keep } }); a critic reads with a `lens` and sends `findings`.',
    'A brief\'s read carries its seat (`as: \'r2.j1\'`): the agent\'s view is its own unit and its own job, its call its',
    'report alone. Its `agent` names the plugin\'s agent to hand it to, where the host has them.',
    'RECEIVED is its machine gate (`req.receipt`: a proposal kept, its decisions cited, its critics in, its laws holding):',
    'a level\'s stages are made by its run ({ chapter: \'level:<id>\', run: true }), then played by the probe',
    '({ req: { id, probe: true } }: it loads, it is not lost before input, it has something to play against, no debug',
    'text; its frames are for a look critic). Received is not accepted: show the creator, whose verdict it is.',
    '',
    'THE PRODUCTION ({ ref, production: { style, checkpoints? } }): yeoman, auteur (unset) or avant-garde sets the',
    'assistant director\'s posture: assistive, strict, elevating. A beat as one crew: { req: { unit: \'beat:<id>\', crew:',
    'true } }, an author per unit in a stable `role` (keep one agent per role: its precedent stays in its context), all',
    'posting to a notebook ({ req: { id, job, post } }). Then { req: { id, assist: true } }: the assistant recommends',
    'pass-up, rework or elevate. You decide: { req: { id, direct: settle | rework | creator } }. Settle (directed, not',
    'accepted) only after the creator accepts the vertical slice, never a pillar or a checkpoint.',
    '',
    'THE TICKET: give `ask: { intent }` with the work it causes (a req, a verdict, a patch, a run): the intent you',
    'inferred and are acting on, in your own words, never the person\'s message. `ask: \'a3\'` adds to it. { ref, trace:',
    '\'a3\' | \'r2\' | \'r2.j1\' } reads the chain: the intent, its reqs and jobs (each decision\'s because), verdicts, revisions.',
    '',
    'THE COMPOSITE: once a level is accepted and the game lacks it, `next` says composite: run: true makes the game of',
    'the accepted levels alone (no level made that no one has worked), playable to the last. A stale level stays out.',
  );
}

// the producer: the seat that faces the creator (the client talks to the producer, the producer to the director). It
// knows the SHAPE of what mojulo makes (the rails) before any detail, calls the size, says the pitch back and locks it,
// then hands the director the work. Its intake rows are the table's own
function producerCard() {
  return lines(
    'THE PRODUCER — the seat that faces the creator. The creator talks to the producer; the producer hands the director',
    'the work. One agent wears both: as PRODUCER you ask and shape, as DIRECTOR you build (gameworld-ledger); say which',
    'seat a move is made from. The assistant director holds a unit to its remit. The producer never picks between two',
    'looks and never fills a gap with taste: what is ambiguous is asked, the creator\'s to say.',
    '',
    'ONE QUESTION A TURN: the readout\'s `producer.ask` is the one to ask now; the rest of `next` waits. Know the SHAPE',
    'first (gameworld-rails: a line a game type); pull detail only when the creator\'s wish reaches for it.',
    '',
    '1 HEAR (next: intake). A game starts from what the creator HAS: ask once for drawings, plans or documents.',
    ...Object.entries(INTAKE_KINDS).map(([id, K]) => `  ${id.padEnd(10)}${K.name} → ${K.door}  (answers: ${K.answers.join(', ')})`),
    '  Write each from what it SAYS, never what it might have meant, then the record:',
    '  { ref, patch: [{ op: \'set\', path: \'/intake\', value: { items: [{ id, kind, says, placed | aside, answers?, basis? }] } }] }',
    '  placed: the page it went to; aside: why it has no place yet; basis: stated | inferred (say so). Nothing brought',
    '  is dropped. Brought nothing: `intake: \'none\'`. Never ask again what a document already said.',
    '2 PLACE (next: rail). Read gameworld-rails. A rail is a TEMPLATE, never the game: they are making a stealth action',
    '  game of their own, started from Steel Serpents. The step\'s `nearest` are the rails their words point at; `notYet`',
    '  a type no door makes yet: say it before anything is built. CALL THE SIZE, the least that answers the ask: a',
    '  pixelizer game, a quick game, a table game, or the designed game (more than one level, or a hero, world or story',
    '  of their own). Say what the next size up would add. Write rail: { from, size, departs? }.',
    '3 LOCK (next: lock). Say the pitch back: the template, what their game keeps of it, where it departs (level,',
    '  action, character, world), what the template does not do yet. With their yes write rail.locked: true: structure',
    '  is locked, content never. On a book with no level this lays the rail\'s STARTER first level and stores the game',
    '  (`pitch.stored`; nothing built). A locked pitch moved to another rail is a re-plan: say so.',
    '4 DEEPEN. Now pull the rail\'s sheet (gameworld-rail-<id>: its tunings, its chain of tools, a card a step) and, for',
    '  a designed game, ask the Game Brief (next: brief, gameworld-brief): why it is played, how it is shaped. Recommend',
    '  a real plan only here, with the build chapter\'s estimate.',
    '5 HAND OFF (next: hand-off). The step carries the first level as a `req`, its remit filled from the pitch. Raise',
    '  it as the DIRECTOR with your ticket: { ref, ask: { intent }, req }. From there the ledger runs the work.',
    '',
    'The goalposts are the path from 0 to level 1 and `next` the move. Level 1 is proved by the machine gate',
    '(`check: true`) and approved by the creator, who plays it: it is the game they want to play.',
  );
}

// the studio: the book worked a chapter at a time, in the waves the chapters' reads make (chapters.js chapterWaves): the
// card is generated from the registry, so its order is the chapters' own
function studioCard() {
  const waves = chapterWaves().map((ids, i) => `  ${String(i + 1).padStart(2)}  ${ids.map((id) => `${id} (${chapterById(id).department})`).join(' · ')}`);
  return lines(
    'THE STUDIO — a game of several departments, worked a chapter at a time. Each page of the book is a chapter in a',
    'department; design_game\'s readout says them (`chapters`: each one\'s state, open parts, and what it `waits` on).',
    '',
    'THE ORDER (each chapter after what it reads). Work ONE unit at a time to quality, so a mistake stays in it:',
    ...waves,
    '',
    'A CHAPTER\'S SESSION (a department\'s or a subagent\'s: it holds this card and its chapter\'s cards):',
    '  read     design_game({ ref, chapter }): its parts, its pages, its upstream as a digest (`reads`: each one\'s state',
    '           and print; a print that moved since you read it: read that chapter again), its next moves, `book`.',
    '  write    { ref, chapter, patch } on its own pages; a write past them is written and said (`outside`).',
    '  preview  { ref, patch, preview: true } first, for a change that may reach far: the parts back for review, the',
    '           accepted units gone stale, what a run would remake. Nothing is written.',
    '  show     its bible section (`read`) to the creator. The verdicts (approve, revise) are the creator\'s: a subagent',
    '           stops at the review and reports what the creator must decide.',
    '  proof    { ref, chapter, run: true }: its steps and what they name, made ahead of their approvals (`ahead`: say so).',
    '  a level  chapter: \'level:<id>\' is one level alone (its part, page, links, stages): a unit each.',
    '  vary     { ref, chapter, vary: { concept, n } }: n visual takes on its pages (colour, size, silhouette, surface,',
    '           detail), rolled and proposed; take one with its patch, the next pass with keep / reject patches.',
    '  done     its state settled (approved; auto in autonomous mode), its `blockers` and `advises` cleared or said.',
    '',
    'A SUBAGENT gets the ref, the chapter id and the cards its view names (`chapter.cards`); it returns its chapter\'s',
    'state and the creator\'s questions. Hand the next unit once the last is settled, never one that `waits`.',
    'THE FLOW (production) is the game director\'s, yours: it reads every department, so never hand it to a subagent.',
    '',
    'ONE UNIT AT A TIME: the ledger asks for each unit, hands its jobs to agents and receives it before the creator',
    'sees it; the game is built to its last accepted level (gameworld-ledger).',
    '',
    'THE BUILD (the last wave): { ref, chapter: \'build\' } reads the pre-compile check (`compile`: blockers by chapter,',
    'advises, the estimate). Then run: true until nothing is `pending`, telling the creator how far each call got;',
    'check: true walks each level and reads its first frame (`audits`, the machine gate). The eyes gate is the creator',
    'playing it (`play`): never say it passed.',
    '',
    'THE FIRST SESSION, 0 TO LEVEL 1: not the game done, its first level: proved by the machine gate, approved by the',
    'creator playing it. Expect attachments: ask for the drawings, plans and docs they have, use what they say, set',
    'aside what has no place yet, ask only what is missing, never guess a document. Most games',
    'are levels played in turns (set-up, load, play, results, on to the next); an open world (qow, a world map) is laid',
    'differently. The readout\'s `goalposts` say where it stands (met, partial,',
    'open), each open one with the question only the creator answers, and `next`: where this session goes on, and the',
    'next picks up. A good first session leaves:',
    ...GOALPOSTS.map((g, i) => `  ${i + 1}. ${g.id.padEnd(12)} ${g.says}`),
    '',
    'THE SEATS: the producer faces the creator and hands on, the director builds, the assistant holds the remit (gameworld-producer).',
    'One level, a simple goal: the quick path (gameworld-quick).',
  );
}

// the sound: the play department's sound sheet (sound-sheet.js)
function soundCard() {
  return lines(
    'THE SOUND — which sound plays each thing the game does: the play department\'s page, the SOUND SHEET. Every sound is',
    'a word on the SFX shelf, solved from what the game already is, so nothing is written twice:',
    '  the hero     its steps by the level\'s ground (its kit, its weather: grass, sand, snow, stone), jump, land, dodge',
    '  the arsenal  every weapon\'s swing and blow by the move\'s weight; block, parry, the bow, a blow taken',
    '  the guns     a shooter\'s carried guns, each by its cartridge: shot, reload over its own time, a round landing',
    '  the ride     a driven level\'s engine, a held voice following its speed',
    '  the foes     a beast in its species\' voice, a person\'s shout, grunt and cry: on its attack, a blow, its fall',
    '  the events   what the level\'s mechanics fire (a door, a pickup, the goal); the bed under the score (rain, a wood)',
    '',
    'A game hears it once it writes a `sound`, even an empty one:   patch [{ op: \'set\', path: \'/sound\', value: {} }]',
    'Every level it builds then carries the sheet. A game with no `sound` builds the levels it built.',
    '',
    'sound: { style?, slots?, on?, weapons?, moves?, guns?, foes?, ride?, bed?, vary? }: each value a SHELF WORD, over',
    'what the sheet solves. A word off the shelf is refused with the shelf\'s nearest.',
    '  style     mouth (the default: mouth foley, the newest voices) | realistic | foley | arcade | orchestral | synth',
    '  slots     { step, jump, land, dodge, swing, strike }        on    { <event cue>: word } (door, pickup, goal, alarm …)',
    '  weapons   { <weapon id>: { swing?, heavy?, hit?, finisher? } }',
    '  moves     { block?, parry?, break?, draw?, loose?, arrow?, felled?, cycle?, foeSwing?, hurt? }',
    '  guns      { <gun>: { shot?, reload?, hit?, draw? } }       foes  { <foe id>: { attack?, hurt?, down? } }',
    '  ride      a held voice (car-engine, motorbike-engine, kart-engine, diesel-engine, tank-engine, boat-engine) | false',
    '  bed       rain | night | forest | cave | swamp | farm | false',
    '',
    'READ AND HEAR IT: /api/sketches/<ref>/bible?book=sound lists every sound, its word and why, each with a play',
    'button, what is OWED (a foe with no voice, a slot the style does not voice), and the music department\'s advice.',
    'Show the creator that page: whether it sounds right is theirs to hear. Never say it passed.',
    'The style where `sound.style` says none is the audio direction\'s (gameworld-music).',
  );
}

// the music: the music department's audio direction and cue sheet (audio-direction.js, cue-sheet.js)
function musicCard() {
  return lines(
    'THE MUSIC — the music department\'s two pages. It owns the soundtrack and the game\'s taste in sound; play owns the',
    'sound effects (gameworld-sound) and reads its direction.',
    '',
    'A game is scored once it writes a `music`, even an empty one:   patch [{ op: \'set\', path: \'/music\', value: {} }]',
    'Every level it builds then plays its cue, and a run mints the outcomes\' stingers. No `music`: unscored, as it was.',
    '',
    'THE AUDIO DIRECTION (chapter audio-direction), music.direction: what the art direction is to the picture.',
    '  style     field (the orchestra) | club (electronic). Unwritten: the orchestra, unless the game\'s words say electronic',
    '  identity  a non-negative integer: the seed of the key, hall, motif and palette every cue shares. Unwritten: the game\'s own',
    '  cast      who plays each job: { colour?, ground?, lead?, brass?, pad?, motion?, kit? }  get_beats_vocab({ id: \'beats-casting\' })',
    '  sfx       the SFX style the sound sheet speaks where sound.style says none',
    '  space     open | interior | hangar | cavern | vacuum: where every level is heard. Unwritten: each level\'s place',
    '  ui        the interface\'s sound set',
    'Taste is advice: it says where the sound sheet sits badly with the score and changes nothing. Play decides.',
    '',
    'THE CUE SHEET (chapter score), music.cues: every department asks for music where it needs it, and each request',
    'is answered with a cue on the one identity:',
    '  title · menu · credits     the flow\'s screens            level:<id>          a level\'s place',
    '  fight:<id> · boss:<id>     a level\'s fights, its boss     cinematic:<scene>   a cinematic the flow plays',
    '  victory · defeat           a level won, lost (four bars, once)',
    'music.cues: { \'<request id>\': \'<mood>\' | { mood, style?, seed?, cast? } | false }   (false: a chosen silence)',
    `  the orchestra\'s moods   ${Object.keys(SCORE_MOODS).join(', ')}`,
    `  electronic moods         ${Object.keys(CLUB_MOODS).join(', ')}`,
    'Unwritten, a level\'s place is read from the level (a forest, a desert, a town), a fight is battle, a boss is boss.',
    '',
    'WHAT PLAYS: a level\'s cue, its fight or boss coming in with the tension; the stingers when a level ends. The title,',
    'menus, credits and cinematics are on the sheet and NOT YET PLAYED, answered by stand-ins and listed as owed.',
    '',
    'READ AND HEAR IT: /api/sketches/<ref>/bible?book=score: the direction, every request, who asked, the cue and why,',
    'each with a play button. Show the creator that page: whether a cue fits is theirs to hear. Never say it passed.',
  );
}

function mainQuestCard() {
  return lines(
    'THE MAIN QUEST — the game\'s spine: its acts, a beat at a time. Not a game type: the flow and the sequence, and the',
    'levels and maps laid from it. Any long game composes on it (an RPG, a metroidvania, a campaign of dungeons).',
    '',
    'ASK THE CREATOR, before writing it (their answers are the recipe; never pick for them):',
    '  how long does the main path play? what periods does it span, on the same maps or new ones? how big is the world?',
    '  where does the story take the hero, and does it end (an ending can wait: a game being built may have none)?',
    '  how loose are the side quests from the main thing?',
    '',
    `mainQuest: { length?: ${Object.keys(LENGTHS).join(' | ')} | { hours }, periods?: [{ id, name?, passage?: ${Object.keys(PASSAGES).join(' | ')} }],`,
    '  acts | chapters: [{ id, name?, period?, goal: \'<words>\', turn?, beats: [{ id, goal, as?, gains?, foes?, who?, built?: false }] }],',
    `  the shape, one or the other: ${Object.entries(SHAPES).map(([k, v]) => `${k}, ${v}`).join('; ')}. A chapter\'s turn is what`,
    '      a happening changes in the world, carried on (the time facet\'s chapter overlay).',
    `  ending?: { beat, stakes? }, sides?: { looseness: ${Object.keys(LOOSENESS).join(' | ')} } }`,
    `  as: ${BEAT_AS.map((k) => `{ ${k} }`).join(' ')}: what the beat is played as (a level, a WCD space, a QOW quest, a`,
    '      gauntlet level, an errand, an epoch by number, a story moment). gains: powers gained on it; foes: the bestiary',
    '      it fields; who: its cast. built: false is a beat planned, not made yet: priced, never run.',
    '  LAID AT A RUN: a built beat with no `as` is laid its own level from its words (named by its goal, standing its',
    '      foes), once, into the recipe: yours from then on, edited in place. The game plays the beats\' levels in order.',
    `  passage: ${Object.entries(PASSAGES).map(([k, v]) => `${k}, ${v}`).join('; ')}.`,
    '',
    'AN ACT (OR A CHAPTER) IS A STAGE of the hero\'s progression: the first early, the last late, the middle mid. So the',
    'actions page\'s progression and the quest say the same: a power gained on a beat is gained in that act\'s stage.',
    '',
    'LAWS (advice, never refused):',
    ...MAIN_QUEST_LAWS.map((l) => `  ${l.law.padEnd(16)} ${l.says}`),
    '',
    'THE CORE LOOP (loop, the intent\'s page): what the player does, nested, each layer feeding the next.',
    ...Object.entries(LOOP_LAYERS).map(([k, v]) => `  ${k.padEnd(10)} ${v}`),
    `  loop: { moment?: [verbs], encounter?, reward?, session? }; a layer not written is read from the book. A moment verb is`,
    `  a power\'s verb or the body\'s own (${BODY_VERBS.join(', ')}). The main quest is the loop\'s outermost turn.`,
  );
}

function guide() {
  return lines(
    'THE GAME BOOK — design a game top down, then let the rail make it. You DESIGN; design_game makes, keeps and remakes.',
    '',
    'SIZE THE ASK first. THEIR game (a hero, powers, gear, a story, anything they brought): ask what they brought',
    '(gameworld-producer), then { world: { name } }: it answers what to ask, nothing stored. Write `levels` once the',
    'first can be named, never invented; then the book below, by chapter (gameworld-studio), from a ticket:',
    '`ask: { intent }` with its first patch (gameworld-ledger). ONLY one level, a simple goal (reach, collect, survive,',
    'avoid), no powers, stats or progression: the QUICK path, one call, made at once, nothing asked first; read',
    'gameworld-quick only. Several levels, no hero: COMPOSE, { compose: { prompt } }, then run.',
    '',
    'THE LOOP (each page answers ONE question, from the brief and the pages above it; never from a default):',
    '  intent      what game is it? its cube; the world is laid for it (gameworld-intent)',
    '  world       where is it? the ground, its levels, who built what (gameworld-world)',
    '  direction   how is it drawn? the tradition, the leading and supporting elements, the motif (gameworld-direction)',
    '  looks       who is the hero, bare? body, head, hair, colour, composed in a base that wears only the world (gameworld-looks)',
    '  motion      how does the hero feel to move? vibe words onto four axes (gameworld-motion)',
    '  actions     what can the hero DO beyond platforming? this decides the systems (gameworld-actions)',
    '  adornment   what does the hero carry, and why? an item exists because a power needs it (gameworld-adornment)',
    '  systems     the numbers and the HUD, derived from the actions, each with its reason (gameworld-systems)',
    '  equipment   the gear classes, in one gear language; they matter once a stat makes them matter (gameworld-equipment)',
    '  battles     turn-based? the party, its classes, its packs of foes, minigames (gameworld-battles)',
    '',
    'PRINCIPLES:',
    '  - Ask, then derive. Before a page, ask the creator what only they know (who the hero is, what the verb of the game',
    '    is, how the world should feel to move through). A choice nothing in the brief explains is a defect, even when it',
    '    validates. Write the brief into the recipe (`brief`) so the readout can ask about the choices it does not explain.',
    '  - The book derives a first reading of every page; that is a floor, not a design. Accepting every derivation passes',
    '    every gate and designs nothing. Override where the brief says something the derivation does not (ledgered).',
    '  - Laws, not presets. Each card states what derives from what. A preset, a style card or an idiom is a language to',
    '    fork, never an answer to adopt whole.',
    '  - Fragments, not worlds: contrast pairs and samples to compose your own from.',
    '  - Past the book, the instruments: the hero door (get_solid_vocab({ id: \'layered\' })), inline equipment style cards,',
    '    the play block\'s parts and cues (get_play_vocab). The book never limits them.',
    '',
    'THE RECIPE (where each page lives; every key optional but id and levels):',
    '  { id, name?, seed?, mode?: gated | autonomous, brief?: \'<the ask, in words>\' | { text, why?: { <choice word>: \'<the brief words it answers>\' } },',
    '    intent?: { from?, cube? }, style?: { kit, look?, land? }, civilizations?: { <id>: { name, builds } },',
    '    levels: { <id>: { name?, walk: { nodes: { <id>: { trail: {} } | { meru: {} } }, edges?: [{ from, to }] } } },',
    '    characters?: { direction: { tradition, primary?, secondary?, motif? },',
    '      hero: { looks?: { body?, head?, hair?, colour?, underlayer? }, motion?, actions?, adornment? } },',
    '    equipment?: { style?, classes? }, mechanics?: { scale?, powers?, stats?, hud?, ui? }, battles? }',
    '  patch ops are { op: \'set\' | \'remove\', path: \'/characters/hero/motion\', value } (JSON Pointer; no \'replace\'; \'add\' is',
    '  { into, entry }, an entry appended to a list of ids, never a path).',
    '  A refusal names the field and the shape it wants.',
    '',
    'THE DOOR (design_game): { world } starts a gameworld (a sketch: update_sketch works on it too); { ref, patch } edits it by',
    '  part; { ref, approve, revise } are the creator\'s verdicts (revise { part, note } sends one back); { ref, run: true }',
    '  makes every ready step. A run keeps what did not move, remakes what did in place, leaves hand edits (force: true',
    '  overwrites). It answers each stamp, the steps, what was made and `next` step ids (gameworld-next); `readout:',
    '  \'changed\'` only what moved. `mode`: ' + Object.entries(MODES).map(([k, v]) => `${k} (${v})`).join('; ') + '.',
    'SHOWN FIRST: asked to see it before it is built? Create the world (no run), show its book (/api/sketches/<ref>/bible:',
    '  the plans, a building\'s finishes as the build paints them) and stop for the verdicts.',
  );
}

function worldCard() {
  return lines(
    'THE WORLD — where the game happens: { id, name?, seed?, style?, civilizations?, levels, links?, start?, topology?, camera?, mode?, brief? }.',
    '',
    `style: ${Object.entries(WORLD_STYLE).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    'kits (the outdoor stage kits a world is drawn in), and what each takes:',
    ...GROUND_KITS.map((k) => `  ${k.padEnd(14)} ${[ISEKAI_STYLES[resolveKitId(k)] ? 'a look in words' : null, STRUCTURE_KITS.includes(resolveKitId(k)) ? 'civilizations' : null].filter(Boolean).join(', ') || 'the kit as it is (no look, no civilizations)'}`),
    'civilizations: { <id>: { name, builds: \'<words>\', technology?: { things?, vehicles?, structures?, weapons? } } }: words',
    '  (each list { <id>: \'<words>\' }); anchor, fort, town, castle default from the kit, best left out (see the bible).',
    `levels: { <id>: { name?, style?, walk: { nodes: { <id>: { ${LEVEL_SECTIONS.join(': {} } | { ')}: {} } }, edges?: [{ from, to }] }, ground?, places?, scenes?, goal? } }:`,
    '  a walk is one line of sections (a trail, then a climb), joined by edges in order; a level overrides its world where it says.',
    '  goal?: { collect?: true | \'<pickup>\', boss?: true, health?: true, guards?: true, escape?: 1…4 }: what the level is played for, else its exit.',
    '  scenes: the level\'s directed moments (get_play_vocab({ id: \'ui-scenes\' })), each with stage?: \'<node>\' (its first stage by default);',
    '    the hero is \'hero\', the stage\'s places are spots (start, exit, pocket, pocket-2…, landmark…); scenes that read or set flags',
    '    (if, sets) ride a \'story\' flags slice from level to level.',
    `  or building: { use: ${PROGRAM_IDS.filter((u) => !BASE_USES.includes(u)).join(' | ')} | a base's (gameworld-wcd), seed?, goal?,`,
    '  civilization? } | { ref } | { complex } for the walk: played from its way in to its goal room. places.buildings: [{ use, at?, node?, goal? }] and places.street:',
    '  { houses?, enter?, goal? } stand buildings and a town\'s first houses on a trail, walked into (card game-building).',
    '  or city: { grammar?, civilization?, from?, to?, stalker?, … } (card city-plan), played by its segments (stalker: true, by the hero).',
    '  or geocity: { evoke: neighbourhood | corridor | segment, at?, shops?, … } (card geocube): a DISTRICT of a metro in detail, the rest its',
    '    skyline, walked along its street; shops: true opens its shops (an errand\'s `shop` trade at a till). A big page (tens of MB): over a cloud session\'s limit, fine locally.',
    '  or glyphs: { rows, key?, regions?, tile? }: one world on one page as a glyph grid (# path, . land, a letter a place { use, goal? };',
    '    regions: a second grid, each { name, rise?, biocube? }), walked from its far end to the goal\'s door.',
    '    ~ water: its edge a beach or a cliff (a region\'s shore: beach | cliff). ways: ranked (roads by places, tracks, paths,',
    '    traces; a region\'s path: a rank | { rank?, surface?, width? }) | one. The style\'s geocube paints it.',
    '    or planned: { plan: { size, rows, route, key }, segments? } for rows: segments walked in turn, each written apart, its gates the plan\'s.',
    'megaworld: { shape: mandala | chain | hub | open, rings: [[zones]], gates?: { <zone>: { key, keyAt } | { needs } } }: maps joined as a topology, the links',
    '  laid from it; the loaded map the current map (kept in the save; leaving by a way completes nothing; a mandala\'s core its end).',
    '  ground: the level\'s land on a grid of cells, its dials and edits (cliff, gorge, raise…): tune_ground.',
    `links: ${Object.entries(LINK_KINDS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    'front: the game\'s title, start menu and credits (card front).',
    `topology: ${Object.entries(TOPOLOGIES).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    '  in a map, a link may take key: \'<item>\', keyAt: \'<level>\': the item there opens it (a trail, or a city roof in reach);',
    '  a hero\'s power as the key also gives the hero its move.',
    '  needs: \'<flag>\' (a quest\'s): the way shut till the story sets it (no dungeon before its quest).',
    `screen: ${Object.keys(SCREENS).join(' | ')} | { aspect } (a new game: ${NEW_GAME_SCREEN ?? 'none, it fills its window'}).`,
    '',
    'ANSWER FROM: the brief\'s places and moods. One level that promises the rest beats many; the world bible draws each.',
  );
}

function directionCard() {
  return lines(
    'THE DIRECTION — how every character page is drawn: characters.direction { tradition, from?, primary?, secondary?, motif?, palette?, bridge? }.',
    '',
    `tradition (chosen, never defaulted): ${Object.entries(TRADITIONS).map(([k, v]) => `${k}: ${v.read}`).join('; ')}.`,
    `from: ${Object.entries(FROM).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    `bridge (an explicit crossing out of the tradition): ${Object.entries(BRIDGE).map(([k, v]) => `${k} ${v.join(' | ')}`).join('; ')}.`,
    `elements with a tint (primary, secondary): ${Object.keys(ELEMENT_WORDS).join(', ')}; a word with no tint is carried as words.`,
    'LAWS: the leading element tints the trim and the top the hero wears, the supporting one the hair highlight and the',
    'bottom; a leading element with a stone gives a staff its stone. The motif is free words, repeated shape language.',
    `body (the body the game puts in it, opt-in): a rail (${GAME_BODY_NAMES.map((n) => `${n}: ${GAME_BODIES[n].read}`).join('; ')}), 'game' for the one its feel, genre or quick goal reads, or { rail, style?, muscle? }; styled by the tradition, the juice look and the medium, laid under the body page (its own words win and are ledgered); muscle: true puts on the muscle shirt (the anime frame's).`,
    '',
    ...pair('direction',
      ['a courier racing sandstorms across a sun-bleached salt flat', { tradition: 'western', primary: 'sun', secondary: 'earth', motif: ['chevron'] }],
      ['a sullen witch of a drowned city under a winter moon', { tradition: 'anime', primary: 'ice', secondary: 'moon', motif: ['crescent', 'wave'] }]),
    '',
    samples('direction'),
  );
}

function looksCard() {
  return lines(
    'THE LOOKS — the hero bare, one page per element, composed top down through the hero door into the BASE.',
    '',
    ...Object.entries(LOOKS_ELEMENTS).map(([k, v]) => `  looks.${k.padEnd(7)} ${v.read}: the door's ${v.fields.join(', ')}`),
    '  how each page is written:',
    `    body    { cast: ${Object.keys(HERO_CASTS).join(' | ')}, tune: a move (${HERO_MOVE_NAMES.join(', ')}) or { ${TUNE_KEYS.join(', ')} } as ratios near 1 }`,
    `    head    { look: [words] }: archetypes ${LOOK_TABLES.archetype.join(', ')}; face ${LOOK_TABLES.face.join(', ')}; pose ${LOOK_TABLES.pose.join(', ')}`,
    `    hair    the anime head: a list of hair words (${LOOK_TABLES.hair.join(', ')}); the landmark head: a style (${HAIR_STYLE_NAMES.join(', ')})`,
    `    colour  { palette: { <group>: '#rrggbb' } }: ${[...new Set([...Object.keys(HERO_PALETTE), 'Hair', 'HairHighlight', 'Trim'])].join(', ')}`,
    `    underlayer  the outfit build itself: { type: 'outfit', style, dials?: { stylize, fit, coverage }, language? } (not wrapped)`,
    `  proportions (the tradition sets them; a bridge crosses): ${(Array.isArray(PROPORTION_WORDS) ? PROPORTION_WORDS : Object.keys(PROPORTION_WORDS)).join(', ')}.`,
    `  looks.underlayer  what the base wears: the world's kit chooses (${Object.entries(UNDERLAYERS).map(([k, v]) => `${k} ${v.style}`).join(', ')}), at ornament 0; your own outfit build replaces it (ledgered), and the direction still colours it`,
    '  looks.base        the pinned base revision { ref, rev, print }: a run writes it',
    '  A world composed from a sentence has its pages WRITTEN where no body rail designs the hero: the protagonist rolled',
    '  as a person of the world (a party\'s anchor where it has a cast), its hair, face and build, the cut and pieces the',
    '  outfit principles design, its garment the world\'s accent so it reads against the ground (brief.hero.design says',
    '  how). Each is a page like any other: rewrite one, or clear looks for the bare base.',
    '',
    'LAWS: no adornment, paint or gear on the base (they are later pages). The tradition sets the head and proportions;',
    'every word of the hero door is open to a page: read get_solid_vocab({ id: \'layered\', section }) for',
    '  hero-looks (archetypes, face and hair traits, hair cuts), hero-anime-head and hero-hair (hair), hero-outfit (the',
    '  underlayer\'s build and its dials: stylize, fit, coverage, ornament), hero-anime-body and hero-core (the body).',
    'ANSWER FROM: who the hero is in the brief; their silhouette first, then the face, then the colour.',
  );
}

function motionCard() {
  return lines(
    'THE MOTION — how the hero feels to move: hero.motion { vibe: [words], axes?, clips? }.',
    '',
    `axes: ${Object.entries(AXES).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    `vibe words: ${Object.keys(VIBES).join(', ')}.`,
    'LAWS: each word moves the axes; the axes move every gait\'s dials and pick the stand. Your own clips ride beside them.',
    '',
    ...pair('motion', ['an old soldier who will not hurry', { vibe: ['heavy', 'stoic'] }], ['a street kid who never stands still', { vibe: ['peppy', 'cocky'] }]),
    '',
    samples('motion'),
  );
}

/** THE STYLISH GAME's card: what a stylish rail lays when its pitch is locked, and every word that changes it */
function stylishCard() {
  const rail = STYLISH.map((p) => `'${p}'`).join(' | ');
  return lines(
    `THE STYLISH GAME — a character action game (Devil May Cry, Bayonetta): its rail (${rail}) locked lays a STARTER,`,
    'each part a default the creator changes by name; every key they write wins. It is the rail\'s first reading, never',
    'their game: name the hero, the foes, the place, the weapons and the look as theirs.',
    `  feel '<pole>'; camera 'orbit' (locks on; pulls back in a tall room); arsenal { from: '<pole>' }; styleMeter 'auto';`,
    '  a level plan (THE PLACE): its building { use, rooms, plot, geocube }, its fights (a duel, a melee, a gallery, a boss)',
    '  and foes, goal.tasks one per room; grade (the screen\'s look).',
    '',
    'THE KIT (gameworld-feel): arsenal { from, art?, weapons: [{ id, name?, reach, damage, held?, moves, combos }] }; a',
    'weapon of the same id replaces the template\'s, a new id joins it. A move: { swing | strike, role: opener | filler |',
    'finisher | launcher, frames, cancel?, contact?, arc? (360: all round), travel?, damage, impact?, topple?, launch?,',
    `rise?, air?, slam?, knock? (${KNOCK_WORDS.join(' | ')} | joules), cooldown? }. A combo: { id, name, beats: ['L', 'L', 'H'], moves }.`,
    `A SECOND WEAPON from the shelf: weapons: [{ shelf: '<row>', id?, …edits }] (rows: ${SHELF_IDS.join(', ')}; each its moves,`,
    'its strings and what is held). It shows in the hand while it is up, manifested, the blade on the back; the run makes',
    'its hero. Your own: a weapon with held: { item, style?, parts? } (an item\'s build words). { id: \'fist\', drop: true }',
    'leaves the template\'s fist out.',
    '',
    `THE METER: styleMeter 'auto' | true | false | { tiers?, step?, gain?, repeat?, memory?, grace?, decay?, halo?, vitals? }:`,
    'varied strings, the air, a switch mid-string and a clean run climb its tiers; a rank on the results. halo { stocks?,',
    'per?, hit?, hurt?, at?, drain?, might?, swift?, heal? }: the gauge and the transformation it buys (stronger, faster,',
    `healing). vitals { look: ${VITALS_LOOKS.join(' | ')}, hp?, halo? }: how the HUD draws health and the gauge, no box.`,
    '',
    `THE PLACE: a level plan names where it is fought (${ACTION_LEVEL_IDS.join(', ')}): its building, its rooms sized for their`,
    'fights, the fight each holds in order, its cube and its mood. The starter lays the one its pitch\'s words name (a',
    'cathedral, catacombs, a tower; else the citadel); the readout\'s `place` step offers each other as a patch. Make each',
    'level a different place. Then building.rooms { <room>: { w?, d?, h?, drop? } } (metres; a melee asks 18 m a side, a',
    'boss 22, a launch 6 m of headroom); goal.tasks [{ fight, at }] in the order fought; fights { <name>: { kind, waves } }; a room\'s light',
    `designed, plot { <room>: { ${Object.keys(PLOT_KEYS).join(', ')} } } (the torches kept; the fill and the hung key light;`,
    'a brighter pair by the way on; each flame its own; a moonlit window); the dark, geocube.light.shade (0.02 dark to 0.6',
    `lit); grade { from, vignette?, exposure? }. A LIGHT MOOD writes the three at once: ${MOOD_IDS.join(', ')} (the starter's`,
    `${MOOD_IDS[0]}; the readout's \`mood\` step offers each as a patch), then change any word.`,
    '',
    `THE HERO (gameworld-looks): the underlayer's style '${ACTION_OUTFITS.join("' | '")}' (a long coat that fights), or your own words:`,
    'outer { hem: \'midi\', open: true, posed: true, stormFlap?: true }: cut away in front below the hip, two tails set by',
    'the pose (open standing, behind the hips walking, streaming back running, hung behind in a strike, flared in the air)',
    'on the realistic body (looks.body.form \'realistic\', the starter\'s); on another a long open coat.',
    '',
    'A worked example, read, never copied: docs/examples/fallen-angel (its world, its README).'
  );
}

function feelCard() {
  return lines(
    'THE FEEL — how the hero moves, as a game template: feel: \'<template>\' | { pole, variant?, toward?, t?, set?, takes? }.',
    'The template\'s card (the action lab\'s) is lowered over the hero\'s platform rule: the run and its acceleration, the',
    'jump\'s height and gravity up and down, coyote time and the buffer, the shortest hop, air control, the gather, air',
    'jumps, the 2D lane, the melee hitstop. design_game\'s readout says what the runtime carries of it, partly carries, and',
    'does not carry yet (the parry, the charge, offense armor, the roll\'s invincible frames, the runner): advice, never a refusal.',
    'The motion (gameworld-motion) is how the walk LOOKS; the feel is how the controls PLAY. Both may be set.',
    'takes: true plays the hero\'s own jumps (a stand\'s, a run\'s, an air jump\'s) on the card\'s flight, landing and squash.',
    `ARSENAL, its weapons and strings (the practice room's): arsenal: 'auto' (the feel template's kit) | false | a template's`,
    `kit (${Object.keys(TEMPLATE_ARSENALS).join(', ')}) | { from: <kit>, …edits by id } | an arsenal { weapons, timing?, ranged?, juggle?, art?, mp? },`,
    'laid on every level\'s hero that strikes (a right-hand blade). Suggested, never laid: an `arsenal` step where the kit exists.',
    'A shooter\'s gun rooms: `bible?book=practice&room=range` (its guns), `room=artillery` (a mech\'s own frame).',
    '',
    'templates (after · base feel · viewer):',
    ...POLE_IDS.map((id) => { const P = POLES[id], v = variantsOf(id); return `  ${id}  ${P.name} (after ${P.after}) · ${P.base} · ${P.view.camera}${v.length ? ` · variants ${v.join(', ')}` : ''}`; }),
    '',
    'toward + t tunes between two (every number blended, the rest the nearer\'s); set lays the card\'s own fields over it',
    '(ground { walk, run, sprint, accel, decel, turn }, jump { commit, height, gRise, gFall, cut, coyote, buffer, air }, air { jumps, mult }).',
    'The template\'s viewer is advice: the camera is the world\'s.',
    'DEFAULTS are suggested, never laid: a world plays the feel it writes. design_game\'s readout suggests one (a `feel`',
    'step) from the brief\'s words, a deathmatch\'s shooter pole, or the genre; a world composed from a prompt that names',
    'a template has it written (each genre\'s: gameworld-intent-<genre>). A written feel wins over a quick game\'s own feet.',
    `brief words: ${Object.entries(FEEL_WORDS).map(([p, w]) => `${p} (${w.slice(0, 3).join(', ')})`).join('; ')}.`,
    '',
    'A CONTRAST PAIR (two briefs; the hero rule each lowers to, computed now):',
    ...[['a Mega Man X style run and gun', 'galaxy-boy'], ['a platformer between Mario and Mega Man', { pole: 'jumping-giuseppe', toward: 'galaxy-boy', t: 0.4 }]].flatMap(([brief, f]) => {
      const L = lowerFeel(feelCardOf(f)), R = L.rule;
      return [`  brief: "${brief}"`, `    feel: ${JSON.stringify(f)}`, `    lowers to: run ${R.speed} m/s, jump ${R.jumpSpeed} m/s on ${R.gravity}/${R.fallGravity} m/s², coyote ${R.coyote} s, buffer ${R.buffer} s${R.airJumps ? `, ${R.airJumps} air jump` : ''}; not carried: ${L.lost.map((x) => x.field).join(', ')}`];
    }),
  );
}

function colourCard() {
  return lines(
    'THE COLOUR — the game coloured as a whole: the land its palette paints, and the cast that stands on it.',
    'The colour theorist solves a palette for the WORLD (style.palette: pick_palette\'s spec, or its cube\'s own). Who',
    'walks it is coloured elsewhere (a lineage\'s skin, a pack\'s cloth, the hero\'s garment), so a cast can sink into its land.',
    `MEASURED: each figure's distance from the ground and the foliage it is seen on (OKLab). Under ${FIGURE_MIN} it sinks: the`,
    'readout says so (a `colour` step with its `sinks`) and names the colour book.',
    'THE COLOUR BOOK, /api/sketches/<ref>/bible?book=colour: the game as it is and each way it could go, every one painted',
    'into the same landscape with the cast on its ground, its distances, its laws and its patch. Show it to the creator:',
    'the machine measures and names its pick; which one reads as their game is theirs to see (the eyes gate).',
    'THE OPTIONS, each a patch for design_game({ ref, patch }):',
    `  cast         the same land; each figure moved inside its own hue family (its value and chroma, ${HUE_KEEP} degrees of hue at`,
    '               most) until it parts from the ground and from the others: a goblin stays green',
    ...Object.entries(COLOUR_DIRECTIONS).map(([id, D]) => `  ${id.padEnd(12)} ${D.says}, the cast solved against it${D.levels ? ` (a world of ${D.levels} levels or more)` : ''}`),
    'WHO IS READ: the hero (its garment: one the sentence door designed wears the world\'s accent); a kin foe\'s skin',
    '(foes.<id>.skin.body.coat); a pack\'s mark (skin.pack.accent: the world\'s second accent, or the hero\'s complement where',
    'the two accents are neighbours). A crew\'s dress and a beast\'s coat are not read yet: the book says so (`unread`).',
    `FROM A SENTENCE: a composed world's cast is painted once, when it is stored; a genre with a direction chosen for it is`,
    `laid in it (${Object.entries(GENRE_COLOUR).map(([g, d]) => `${g}: ${d}`).join(', ')}), said in brief.colour.`,
    `LAWS (advice, never a refusal): ${FIGURE_LAWS.map((l) => l.law).join(', ')}; and the palette's own (pick_palette).`,
    'A new palette for the land is pick_palette\'s; this page is how it and the cast are chosen together.',
  );
}

function juiceCard() {
  return lines(
    'THE JUICE — how the game\'s effects (attacks, blasts, puffs, a battle\'s beats) are drawn and timed:',
    'juice: \'auto\' | false | { register?, look?, flavor?, …dials }. Each level carries it as fxStyle, the effects\' floor composed',
    'from two halves. REGISTER is the look, anime | western: the character book\'s direction, else the kit\'s pole as the',
    'colour theorist leaves it (banded is anime, material is western). FLAVOR is the time, the game type\'s animation:',
    'the feel\'s template, else the genre\'s. A word left out is the game\'s own. Absent, the effects stay as they were.',
    'The characters near an effect take its rim light (the look\'s kind: a soft glow, a cel band, a thin line; the game',
    'type\'s strength), and a status\'s coat the look\'s rim; rim: 0 turns it off.',
    'A composed world writes \'auto\'; design_game\'s readout suggests one (a `juice` step) for a world that writes none.',
    'TEMPO, the world clock: \'auto\' | false | finisher | kill-cam | impact | bullet | { moments: [{ on, scale, hold }] }:',
    'slows the world on strike, down:foe, last-down, dodge; a moment\'s cam and look take the camera and the grade.',
    'GRADE, the look over every frame: \'auto\' (anime vivid, western film) | false | film | noir | bleach | vivid | pastel.',
    '',
    'registers and their looks (look: a register\'s first is its own; an anime fighter or brawler is drawn cel):',
    ...Object.entries(JUICE_REGISTERS).flatMap(([r, R]) => R.looks.map((l) => `  ${r} · ${l}  ${JUICE_LOOKS[l].says}`)),
    'game types:',
    ...Object.entries(JUICE_FLAVORS).map(([k, v]) => `  ${k}  ${v.says}`),
    `dials (one pinned over both): ${Object.entries(JUICE_DIALS).map(([k, d]) => (d === 'switch' ? `${k} true|false` : `${k} ${d[0]}..${d[1]}`)).join(', ')}.`,
    'GLOBAL in every cell: a line stays a line, a laser one beam, an attack lands on its target, the white core reads',
    'first in greys, a warm bolt burns and a pale ray crackles.',
    '',
    'A CONTRAST PAIR (the floor each lays, computed now):',
    ...[['an anime fighter', 'anime', 'cel', 'action'], ['a western racer', 'western', 'material', 'pinball']].map(([brief, register, look, flavor]) => {
      const S = juiceSignature(juiceFloor({ register, look, flavor }));
      return `  ${brief} (${register} · ${look}, ${flavor}): ${S.look}; ${S.time}`;
    }),
  );
}

function interfaceCard() {
  const byLook = {};
  for (const [g, l] of Object.entries(INTENT_LOOKS)) (byLook[l] = byLook[l] || []).push(g);
  return lines(
    'THE INTERFACE: the menus, the front and the HUD, and their LOOK, dressed by the interface department with the',
    'ART DIRECTOR (the register the game speaks in) and the COLOUR THEORIST (the world\'s palette, solved: ink, panel,',
    'line, accents, contrast checked). The game UI runtime (mana-ui) draws what they settle.',
    'ui: { theme?, colour?, languages?, language? }:',
    '  theme      world (the default: the register the intent sets, in the world\'s colours) | a preset | a theme card |',
    '             { from?: any of those, ...words } (a child theme: say only what changes)',
    '  colour     world (the colour theorist\'s palette; the default when the world has one) | theme (the look\'s own)',
    '  languages  { <code>: { <key>: word } }, language the first: the game\'s words and the UI\'s (select, back,',
    '             loading, rank…) in each language it ships; the options screen picks by languageName; English fills gaps',
    'IN ORDER, after the world, the feel and the systems: 1 art direction: the intent\'s register (below), or a preset or',
    'card when the game is not its genre\'s usual; one look for the whole game. 2 colour: world when the world has a',
    'palette; theme only for a brand of its own (a casino). 3 dress it with words, not colours: layers (backing, crest,',
    'breakout, stage, material, overlay), motion (motion, slant, transition, backdrop), sound (sounds, cues). 4 read the',
    'part interface:look (where it came from, its advice: contrast measured, never refused); the eyes gate is the board',
    '(scripts/mana-board.mjs --theme <id>): a person looks.',
    'REGISTERS (intent → look; console when none):',
    ...Object.entries(byLook).map(([look, gs]) => `  ${look}: ${gs.join(' ')}`),
    `FAMILIES: ${Object.entries(THEME_FAMILIES).map(([f, ids]) => `${f} ${ids.join(' ')}`).join('; ')}.`,
    `CARDS: ${THEME_CARD_IDS.join(', ')}. A NEW LOOK IS A CARD: { id, name, about, family?, tags?, from, ...words } as a`,
    'JSON file on the shelf (playscape/ui/theme-cards/, its README), the way a WordPress theme is a theme.json; for one',
    'game only, the same inline as ui.theme.',
    'THE START SCREEN (front.stage): a launcher before any engine loads, ONE of the game\'s subjects (hero, ally, foe,',
    'ride, prop) on a graphic ground, never a cast or a set. Offered last (next: front), once the first level plays;',
    'sooner only when asked. { composition: a front card, subjects?: [a role or a ref], mode?: still | 3d, treatment? }:',
    `  cards ${FRONT_CARD_IDS.join(', ')}; treatments ${STAGE_TREATMENTS.join(', ')}; 3d brings the cutout or`,
    '  silhouette alive over its picture. Part interface:front; seen on the exported game (export_game). An arena',
    '  shell game\'s is menu.stage (a ref); a versus game\'s title is the champion, drawn. The character on a graphic',
    '  ground, or a picture the creator brings INSTEAD (never both): background: { path } (filed) or { stash, item }.',
    'WORDS (closed):',
    ...Object.entries(THEME_WORDS).map(([k, ws]) => `  ${k}: ${ws.join('|')}`),
  );
}

// the game's flow, the game director's page (game/flow.js, gameworld/game-flow.js): words from the flow's own tables
function flowCard() {
  return lines(
    'THE FLOW — what plays when, from the first screen to the credits: the game director\'s page, YOURS (the main agent\'s,',
    'never a subagent\'s: it reads the main quest, the levels, the story and the interface). The creator approves it.',
    'Most games say none: the game plays the flow its front, levels and run make, the story\'s cinematics placed in it',
    '(story slots opening, prologue, ending; the main quest\'s ending when its beat is a story moment). Write one only',
    'for an order the default does not give; the review\'s part flow:sequence shows either as a storyboard.',
    'flow: { start, home?, steps: { <id>: step } }   its levels by the world\'s level ids',
    `  kinds: ${FLOW_KINDS.join(', ')}`,
    '  screen     { screen, on: { <event>: target }, idle?: { after: s, go } }   the interface\'s; left by the player',
    ...Object.entries(SCREEN_EVENTS).map(([k, evs]) => `               ${k}: ${evs.join(', ')}`),
    '  cinematic  { scene, stage: <level id>, next, keep?, skip? }   a story moment (or a level\'s scene) played on its',
    '             level\'s page; keep: the prologue\'s, play goes on from it; skip: false, unskippable',
    '  cutscene   { video? | scene?, stage?, next, skip? }   a sequence made elsewhere, played whole: a video file, or a',
    '             directed scene on its stage; neither yet, an empty slot passed at once',
    `  level      { level: <level id> | $any, on: { ${LEVEL_EVENTS.join(', ')} } }`,
    '  hold       { for?: s, until?: event, next }',
    `  target: a step id, a special (${FLOW_SPECIALS.join(' ')}), or [alts], an alt { when: ${FLOW_GUARDS.join(' | ')}, go }`,
    '  start: a step, or alts: [{ when: \'unseen\', go: \'opening\' }, \'title\'] (an opening on a first boot)',
    `flow: '${FLOW_IN_PLAY}'   the default STARTED IN PLAY: an opening cutscene (the story\'s opening moment, else the empty`,
    '  slot), then straight into the game, no attract, title or prologue first; the title is where quitting goes. A',
    '  game laid from a sentence says it.',
    'A LEVEL STEP IS A TURN: before it loads the player may be asked things, and a scene may play as play starts or ends.',
    '  level  { …, picks?: [{ id, from: { slice } | { options: [id | { id, name?, about? }] }, min?, max?, ask?, hint? }],',
    '           start?: { scene | video, skip?, once? }, end?: { scene | video, skip?, when?: won | lost | left } }',
    '  A pick from options is the game\'s own words; from a slice, which of a consumed slice\'s members go in (the party).',
    `setup: { difficulty?: true | { ask?, hint?, options?: [${Object.keys(DIFFICULTY_TIERS).join(' | ')} | { id, name?, about? }] }, picks?: [pick] }`,
    '  the set-up, said once on the world: asked before every level that asks nothing of its own. difficulty tunes the',
    '  foes\' minds (the engine\'s tiers, named in the game\'s words). Say it when the creator asks for a difficulty select,',
    '  a character or squad select, or a loadout before a level; the review\'s flow:sequence shows what each level asks.',
    'Every step reached from the start, every one with a way out, no loop of cinematics and holds alone: the read says',
    'which, and how. A cinematic waits for its scene to end; a level for its end; a screen for the player.',
  );
}

function actionsCard() {
  return lines(
    'THE ACTIONS — what the hero can DO beyond platforming; this decides the systems.',
    'hero.actions { idiom?, system?: { kind, resource?, source?, rule? }, powers: [{ id, verb, element?, look?, attack?, move? }], progression: [{ stage, gains, gate? }], moves? }',
    `move: what a power lets the hero do, given when it is found as a map key: ${Object.entries(TRAVERSAL_MOVES).map(([k, v]) => `${k} (${v.read})`).join('; ')}.`,
    `moves: what the hero starts with, in every level, outdoors and in (a building's rooms roofed for them): ${Object.entries(HERO_MOVES).map(([k, v]) => `${k} (${v.read})`).join('; ')}.`,
    '',
    `idioms (a design convention, "-like", never a title): ${Object.entries(IDIOMS).map(([k, v]) => `${k} (${v.read})`).join('; ')}.`,
    `system kinds: ${Object.entries(SYSTEM_KINDS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    'system: { kind, resource?: \'<one word: ki, mana, oil>\', source?: \'<words>\', rule?: \'<words>\' }: the idiom fills what you leave out.',
    `stages: ${STAGES.join(', ')}. A power shows as a look (${Object.keys(LOOKS).join(', ')}) or an attack (${BEAM_NAMES.join(', ')}); with neither it is held as words.`,
    'LAWS: the idiom gives the system and the stages\' gates; each power is gained in its stage; the verb decides what',
    'carries it (gameworld-adornment). Lay out early and mid clearly; late only as far as the brief cares.',
    '',
    ...pair('actions',
      ['a thief who never fights head-on, only slips past', { idiom: 'metroidvania-like', powers: [{ id: 'shade-slide', verb: 'slide under a closing gate', look: 'dusty' }, { id: 'lock-pick', verb: 'pick a lock in the dark', look: 'twinkle' }, { id: 'night-glide', verb: 'glide between rooftops', look: 'fall' }], progression: [{ stage: 'early', gains: ['shade-slide'] }, { stage: 'mid', gains: ['lock-pick'] }, { stage: 'late', gains: ['night-glide'] }] }],
      ['a duelist who wins by reading her opponent', { idiom: 'soulslike', powers: [{ id: 'riposte', verb: 'parry and answer', look: 'flare' }, { id: 'lunge', verb: 'stab through an opening', attack: 'ray' }], progression: [{ stage: 'early', gains: ['riposte'] }, { stage: 'mid', gains: ['lunge'] }] }]),
    '',
    samples('actions'),
  );
}

function adornmentCard() {
  return lines(
    'THE ADORNMENT — what the hero carries, from the main loop\'s final design: hero.adornment { items: [{ id, slot, build, serves, tiers?, alt? }], bodily? }.',
    '',
    'THE RAILS (a power\'s verb, read as whole words, decides what carries it; the first known word wins):',
    ...RAILS.map((r) => `  ${(r.bodily ? 'the body' : `a ${r.item}`).padEnd(13)} ${r.stems.join(', ')}: ${r.why}`),
    'LAWS: an item exists because a power needs it (serves); it grows with the stage that unlocks it (tiers: build diffs,',
    'cumulative); it may serve another power as an alternate use (alt). Each item is the TEMPLATE of its class in the',
    'equipment table. Left out, the page is proposed from the verbs (the bible shows the proposal, with its reasons).',
  );
}

function equipmentCard() {
  return lines(
    'THE EQUIPMENT — the world\'s gear: equipment { style?, classes: { <class>: { build, slot?, tiers? } | null } }.',
    '',
    `classes and the hand they take: ${Object.entries(CLASS_SLOTS).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `style: one gear language every class wears unless its row names its own: a sample (${Object.keys(SEEDED_STYLES).join(', ')}) to fork, or an inline card (the equipment kind's manual: get_solid_vocab({ id: 'equipment' })).`,
    'a card\'s roles (blade, edge, fittings, accent, wrap, a staff\'s shaft, a shield\'s board) are [\'<any material word: wood, leather, satin, matte…>\', \'#rrggbb\']',
    `  or a metal { metal: ${METAL_NAMES.join(' | ')}, finish?: ${FINISH_NAMES.map((f) => (FINISHES[f].only ? `${f} (${FINISHES[f].only.join(', ')} only)` : f)).join(' | ')} }.`,
    `a row: { build: { parts?, dials?, gem? }, slot?, tiers?: { ${STAGES.join(', ')}: a build diff } }; a class is ${Object.keys(CLASS_SLOTS).join(', ')} (held gear only).`,
    'LAWS: the hero\'s item of a class seeds its row; your row wins (ledgered); an empty class is a task, not a fault; a',
    'style that would break a seeded template leaves it its own build, and says so. Gear is made once the stats exist.',
    '',
    samples('gear'),
  );
}

function systemsCard() {
  return lines(
    'THE SYSTEMS — the numbers and the HUD, derived from the actions: mechanics { stats?, scale?, hud?, legend?, lives?, coins?, ui?, gear?, destruction?, scars? }.',
    '',
    'legend: screen (the default: the controls on the play screen for a level\'s first seconds) | menu (only in the pause',
    '  menu, nothing over the play: a demo or a release).',
    'lives: 1-9, a platformer\'s lives for hp (a hit or a fall costs one, none left loses; no hp bar). coins: true |',
    '  { oneup }: coins along a course (a strip\'s, a 3D trail\'s), a life every 30.',
    `scale (the coarse dials): ${Object.entries(SCALE).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `stages → epochs reached by level: ${Object.entries(EPOCH_LEVEL).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `how a power is gained, by system kind: ${Object.entries(GAINED).map(([k, v]) => `${k}: ${v.why}`).join('; ')}.`,
    `what each class raises, by stage: ${Object.entries(GEAR_STAT).map(([k, v]) => `${k} ${v} ${GEAR_BY[v].join('/')}`).join(', ')}.`,
    'powers: { <power id>: { spends } }: what one power spends of the resource over the derived (0: free, a guard that',
    '  costs nothing); ledgered. The readout\'s `numbers` says the stats, the resource and what each power spends.',
    'destruction: how much the game lets break, never a default: none, objects (crates, barrels, pots), cover (furniture,',
    '  doors, boulders too) or world (walls as well); copied onto every level. Walls that hold and objects that break suit',
    '  most games. physical (destructible physics: only when asked) breaks what world does by its matter (a thing\'s',
    '  `matter`: concrete, brick, steel, glass…) and drops what loses its support; the level\'s matter { power: human |',
    '  heroic | super | titan | cosmic } scales every blow.',
    'scars: true | { ground?, wall? } (cosmetic damage, any degree): a map that may not change still shows its blows, a',
    '  burst\'s painted crater and thrown dirt, a wall\'s scorch and spalled chips, a round\'s chip or pock, by the',
    '  same laws as physical; ground and wall are matters, else the geocube\'s, else loam and brick.',
    'LAWS: every number carries its reason; your own `stats` are laid over the derived (lists by id, objects by key) and',
    'ledgered. Each power is a key (1, 2, 3 …) that spends its cost and shows its look; I opens the status page. The HUD',
    'is derived (hp, the resource, the level, banners, a status page) or yours (play parts: get_play_vocab).',
    `PARTS reviewed: ${CHARACTER_PART_IDS.join(', ')}. Stamps: ${Object.entries(STAMPS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
  );
}

// THE QUICK PATH in two grains: `gameworld-quick` names the goals and the levers every goal takes, and
// `gameworld-quick-<goal>` is that card with one goal's play and its own levers in full. A new goal is a row in
// QUICK_LEVERS (and its card), never more bytes on the index: the agent that knows the goal reads one card.
const HERO_WORDS = '{ <hero-door words> }';
// the TV graphics a sport is shown in (broadcast/broadcast-package.js), one lever on both sport goals
const BROADCAST_LEVER = ['  broadcast: network | stadium | arcade | clean | { package?, sides?, names?, closeups?, accent? }   TV graphics'];
const QUICK_LEVERS = {
  reach: () => ['  climb: true   the exit is the climb\'s top (without it, the trail\'s end)'],
  collect: () => ['  pickup: \'<word>\'   what lies along the way, one lower-case word (coin, key, star, gem, shell…)'],
  survive: () => ['  seconds: n (5..600)   how long to last'],
  runner: () => [
    '  distance: n (10+)   metres a run is won at (absent: endless, a crash ends it, the best kept)',
    '  runner: { lanes?, speed?, accel?, max?, seed?, palette? }   the run itself; a hero runs it (made when none is named)',
    '  played by swipe on a phone (left and right a lane, up a jump, down a slide), A / D, Space and S on a keyboard',
  ],
  meet: () => [
    '  event: sprint | hurdles | longJump   lanes: 1..8 (one: a time trial)   players: 0..4, the lanes people hold on one keyboard',
    '    (P1 F runs, G hops; P2 J, K; P3 Z, X; P4 , .; gamepads by index); the other lanes are the computer\'s',
    '  register: realistic | action | platformer | pinball (the body\'s pace)   distance: m (the event\'s)   attempts: n (the long jump\'s, 3)',
    ...BROADCAST_LEVER,
    '  the level is the arena (contest/meet-arena.js), the referee the contest kernel: no hero, camera, climb or building',
    '  venue: <stadium preset> | { preset?, surface?, time?, bowl?, … } | false (a stage)   the stadium round it (view-vocab stadium); olympic',
    `  preset: ${Object.keys(SPORT_PRESETS.meet).join(' | ')} (the meet's own: a venue and a broadcast)`,
    '  athletes: [{ ref } (made with create_character) | { <hero-door words> }] cycled over the slots, or false (sticks); absent,',
    '    rolled in the game\'s setting (its tradition: anime or western) in sports kit, a team\'s sides in their colours',
    '  kits: [{ colours?, pattern?: hoops | stripes | band | sleeves | yoke | sides, trim?, socks? }] the rolled athletes\' kits, cycled',
    '  athletes: \'chibi\' (a super-deformed body) | \'mascot\': rolled so, kitted as far as the shape allows; a list mixes in { mascot, kit? }',
    '  concept: \'<the player\'s idea>\' ("a neon night meet, anime"): read into the words above under yours (the contest card\'s)',
  ],
  contest: () => [
    `  sport: a net game, two pads (WASD + F | arrows + right Shift): ${MATCH_SPORT_IDS.join(' | ')}; a turn sport, hot-seat`,
    `    (aim, hold, release): ${TURN_SPORT_IDS.join(' | ')}; a team goal game, two pads (a tap passes, a hold shoots): ${TEAM_SPORT_IDS.join(' | ')};`,
    `    a bat-and-ball game, two pads (the press pitches or swings, timed): ${INNINGS_SPORT_IDS.join(' | ')} (innings 1..9, overs 1..20 cricket's)`,
    '  concept: \'<the player\'s idea>\' ("cats vs dogs at night", "red robots vs blue knights, retro arcade"): read into the words',
    '    below (sides, colours, animal mascots, venue, light, look, register, broadcast) UNDER yours; rules never (the card\'s).',
    '    The readout\'s `concept` says each word read, unread, left; say it to the player, then edit by words',
    '  teams: [{ name?, colour?, mascot? }] x2: a side\'s name, shirt (kits, broadcast and shell share it), its players mascots of a brief',
    '  players: 0..2 (0 an exhibition)  level: novice | regular | veteran | ace  register: realistic | action | platformer | pinball',
    '  sets 1..3 (a net game\'s, to win), surface clay | hard | grass (tennis); rounds (golf 1..3, bowling 1..10), seats 1..8; periods 1..4, seconds 20..900',
    `  preset: ${Object.entries(SPORT_PRESETS).filter(([s]) => s !== 'meet').map(([s, b]) => `${s} ${Object.keys(b).join('|')}`).join('; ')}`,
    '  a variant: { id, from: <an arcade card>, …its modules\' words } (get_game_vocab({ id: \'contest-arcade\' })); beyond, written out (distilled-rulebook)',
    ...BROADCAST_LEVER,
    '  athletes: \'chibi\' | \'mascot\' | [{ ref } | { mascot, kit? } | { hero words }] | false; absent, rolled (kits: a side\'s each)',
    '  venue: <preset> | { … } | false   the stadium (view-vocab stadium); absent, the sport\'s',
  ],
  tabletop: () => [
    '  game: chess | checkers | a game of moves written out in the tabletop kernel\'s words (get_game_vocab({ id: \'tabletop\' }))',
    '  players: 0 (an exhibition) | 1 (you against the computer) | 2 (hot-seat)   level: easy | fair | hard   human: the player you are',
    '  lift: holo (the default): the board projected between two podiums, each piece a hologram of its body; a move glides, a capture',
    '    is an attack and a piece destroyed, a promotion a pillar of light, CHECK and the end on the banners; the life points fall with',
    '    each piece lost and mate takes them to zero. The kernel is the referee; a euro, tile, card or round game stays on its own page',
    '  venue: <stadium preset> (patron-dome: a dome of glowing ribs) | { … }   a stadium round the duel; absent, the stage',
  ],
  avoid: () => [],
  race: () => [
    `  track: trail | loop   end to end, or round a loop laid on the trail's land; laps: n (1..9, ${RACE.laps} round a loop)`,
    `  ride: ${Object.keys(RIDES).join(' | ')} | a registry vehicle ('a jeep')   you drive it (WASD), followed from behind; no hero, climb or building`,
    // (a few of the road's classes by name, the rest by a registry word: every shelf grows a class at a time, so the card
    // names none it would have to keep up with and stays under its ceiling)
    `    vehicle: a physics class (${Object.keys(VEHICLES).filter((k) => !MILITARY_CLASSES[k] && wheelLayout(VEHICLES[k]) === 'axles').slice(0, 8).join(' | ')}, …) or any registry word; tuning: ${TUNINGS.join(' | ')}; conditions: ${Object.keys(CONDITIONS).join(' | ')}`,
    '  rivals: n (1..7, with a ride)   finish on the podium',
    '  racers: n (2..8) or a list (an archetype, a brief in words, or { archetype?, build?, age?, brief?, facets?, seed?, parts?, shade?, light? }):',
    '    the whole field, yours first (no ride, hero or rivals beside it); shade: gloss (default) | smooth | cel (flat); light: form (default: lit by the page) | paint',
    `  supercars: n (2..8) or a list ({ preset?: ${Object.keys(SUPERCAR_LIBRARY).join(' | ')}, paint?, livery? }): streamlined supercars lit by the page, yours first, liveries solved to stand out`,
    `  mood: ${RACE_MOOD_IDS.join(' | ')} (with a roadway)   the light it is raced in: lamps after dark, rain and a wet road`,
    `  roadway: ${Object.keys(COURSE_PRESETS).join(' | ')} | a course spec | { intent: '<words>' }   the race's whole ground, in place of track (no climb, building or run beside it)`,
  ],
  sneak: () => [`  guards: n (1..8, 3), guard: ${HERO_WORDS}, alarms: n (1..9, 1)   sightings that end the run`],
  rhythm: () => [`  music: ${RHYTHM_MOODS.join(' | ')}   a field score with a steady beat; misses: n (1..99) presses off the beat that end it`],
  defend: () => [`  waves: n (1..${DEFEND.perWave.length}, 3), lives: n (1..20, 5), pads: n (1..8, 4), foe / tower: ${HERO_WORDS}   no climb, no building`,
    '  board: true | { cols?, rows?, gold? }: a TOWER DEFENCE on the stage\'s spots instead: towers (arrow, cannon, frost) on any',
    '  free spot that keeps the road open (the foes walk round them), waves 1..5, no hero, no pads'],
  puzzle: () => ['  boulders: n (1..4, 2)   no climb, building or ride'],
  farm: () => [`  plots: n (1..12, 6), target: gold (10..500, 40), days: n (2..30, 6), folk: n (0..6, 2), farmhand: ${HERO_WORDS}   a clock: night falls`],
  work: () => ['  card: kitchen | farm | site | roof | { a Shovels & Buckets card } (kitchen), challenge: beginner | intermediate |',
    '  advanced | 0..1 (beginner): the solver tunes the card\'s pace and patience for one player; serve: n (1..200) the orders',
    '  the bell wants (four fifths of what a player who knows the card serves)   no climb, building or ride (docs/worksim.md)',
    '  seen from overhead and worked by a mascot unless camera or hero says otherwise (hero: false: first person); the work shown in pips',
    '  its work room: bible?book=practice&room=work (&cast=orb|sprout|toon&feel=<template>): the recipe on the floor, a mascot and a movement from the presets'],
  battle: () => [`  foes: n (3), foe: ${HERO_WORDS}`],
  brawl: () => [
    '  players: 1..4 on one screen   lives: 1..9, the falls they share (3)   register: the game\'s one look   armed: true, each hero its own weapon',
    '  ASK FIRST who the enemies are and how the street runs:',
    '  the world\'s `foes` (the bestiary, gameworld-foes) are the crowd: each fights as its class and rank, a person or a people in its',
    '    own body (a beast as a jointed figure, said).',
    '  street: { open?: m, stops: [{ wave: { <role or foe id>: n }, length?, name? }] (1..12), boss?: <role or foe id> | { foe, with?, hp?, cpu?, stages? } }',
    '    boss.stages: 2..5 | [{ at?, cpu?, name?, calls?: { <id>: n } }]: its fight in acts.',
    '    a free first screen, each stop held until its wave falls, then the boss\'s screen; the last wave fallen wins. Roles: grunt,',
    '    shooter, elite, boss. Absent with `foes`: three stops that build, the cast\'s boss. The readout advises, never refuses.',
    '  waves: [{ grunt: 3 }, { foes: { <id>: n }, formation?, name? }] alone: a wave set on one open screen.',
    '  IN A DESIGNED GAME a street is a level: levels.<id>.street: { …the street, players?: 1..4, kit?, lives?, guns? }; its seats the hero and',
    '    the cast who join; more levels are more streets, linked. Give the world screen: \'screen\': a street runs across it.',
    '  OR BY STREETS (gameworld-side-scroll): streets, crowd, play; bare with no `foes`, the starter\'s dressed town street.',
    '  heroes: gameworld-heroes',
  ],
  rungun: () => [
    '  players: 1..4 on one screen   lives: 1..9 (3)   register: the game\'s one look',
    '  guns: [<name> | { from, …dials }] (1..6, the first held over the sidearm; absent machine-gun, spread, flame, rocket)',
    '  waves: as a brawl\'s (absent, four of the range\'s: a wall of rifles, a pincer, down the stairs, suppressed); its shooters',
    '    (rifleman, gunner, grenadier, bazooka) fire on a warning, to the wave\'s pattern (volley, sweep, pincer, alternate).',
    '  foes, street: as a brawl\'s (its cast all carry guns; its stops and its boss the same).',
    '  tuning (a street\'s word): arcade (unsaid for a run & gun: soldiers fall to a couple of rounds, the hero to a few hits, an',
    '    army at each stop, fire sooner and faster, five falls) | measured (the long fight). Ask which the game is.',
    '  The same street as a brawl; what differs is the hitting: rounds fly and are stepped off or rolled through, a grenade lobs.',
  ],
  fight: () => [
    '  roster (1..12): every fighter a CHARACTER. A sheet (egocube card) the run',
    '    makes into one: an archetype word, a brief in words, or { brief?, facets?, seed?, archetype?, role?, build?, age?,',
    '    name?, color? }; or { hero: { ref } }, one made with create_character. The fight is read off the sheet (role the',
    '    style, archetype and its shadow the signature, build heavy or light), the entry\'s own words over it: style',
    '    (grappler | rushdown | zoner | all-rounder), signature, weapon, element (fire | lightning | frost | void, on fists |',
    '    feet), library, normals, specials, super, tune, moves,',
    `    tradition (${Object.keys(FIGHT_TRADITIONS).join(' | ')}): how it stands and strikes (alone, a fighter).`,
    '    Absent: four sheets, one per style. Revise one with update_character; the fight follows',
    '  register: anime | western (stamped, the setting\'s)   one look: every fighter cel or lit, rolled in it, one light',
    '  strikes: own (stamped) | tradition   own: a boxer\'s own punches, solved on its rig; tradition:',
    '    keyed moves for all. Each in its own body',
    '  arenas: [{ id, name?, kit?, look?, width?, depth?, height?, crowd?, set: ring? }] (1..8) 3D stages, or { id, level:',
    '    { kind: greybox, preset: training | flat | alley | rooftop | turned } } by its lane. Absent: training (stamped)',
    '  rounds: n (1..3, 2) to win; timer: s (30..99, 99) a round; rules: { systems?: [parry | burst | spark …] } the sim\'s dials',
    '  seen from the side: theme and camera beside these',
  ],
  shoot: () => [
    `  foes: n (4), foe: ${HERO_WORDS}   first person by default (or third-person); walls to take cover behind`,
    `  craft: ${Object.keys(CRAFT).join(' | ')}   a dogfight instead: waves: n of fighters, assist, airspace (as fly's); followed from behind`,
    ARMS_LINE,
  ],
  deathmatch: () => [
    `  bots: n (1..7, 3), frags: n (1..50, 10), seconds: n (10..600) a time limit, foe: ${HERO_WORDS}`,
    '  arena: \'<words>\' ("a tight three-lane arena with long sightlines"), pole: realistic..stylized (0..1),',
    '    weapons: true (the pole\'s guns on the arena\'s floor; needs a pole)',
    `  mode: ${DEATHMATCH_MODES.join(' | ')}   two sides: team deathmatch, or a point held for time`,
    `${ARMS_LINE} (or weapons, not both)`,
    '  camera first-person or third-person (over the shoulder); no building, ride, climb or run',
  ],
  conquer: () => [
    '  board: true | { cols?, rows?, gold? }   the skirmish\'s board (the stage\'s spots) and the purse each side starts with',
    '  sides: [player, enemy?]   each a civilization of the world (its id) or one in words (\'armoured walkers, laser',
    '    carbines, a sentry turret\'): it fields what its technology crafts (hand weapons arm infantry, what carries mines,',
    '    armour is heavy, machine weapons are siege, a turret shoots), climbs a ladder (machines, then its showpieces)',
    '    researched where it signals, and is drawn as crafted; a side not named plays a plain worker, soldier, archer',
    '  doctrine: economy | aggression | fortress | science   how you chose to play (more workers, harder fighters, sturdier',
    '    buildings, quicker research); a civilization may name the ones it allows (technology.doctrines)',
    '  match: true   a whole match: a lobby first (the sides, their level, the purse, the rule, the fog), the fog, the',
    '    melee rule, a field a side for a hall, results after (each side\'s count, APM, army) with rematch or leave',
    '  you: a base, three workers; them: the same and a mind that mines, builds, climbs and attacks in growing waves',
    '  orders: click / drag to select, right-click to move, attack, gather or rally; A attack-move, S stop, H hold,',
    '  B build (again: the next), Q W E R train, T research; P pause, [ ] speed, Ctrl+1-9 groups, End twice: give up.',
    '  No hero, climb, building, ride or run',
  ],
  fly: () => [
    `  craft: ${Object.entries(CRAFT).map(([k, v]) => `${k} (${v.label})`).join(', ')}`,
    '  assist: arcade (never stalls, the wings level quickly) | sim (the bank holds where it is put); laps: n (not a glider)',
    `  airspace: { map: { form: ${Object.keys(MAP_FORMS).join(' | ')} }, ground?, space?, course? }   space: { asteroids, backdrop? } for a space craft (backdrop: its sky's nebula, planets and far sun, seeded; false for stars alone; { planets? 0-3, worlds?: [kinds of world, the first the large one: earthlike, ocean, desert, jungle, arctic, volcanic, toxic, barren, rust, crimson, city, molten, jovian, ice-giant, hot-jupiter, saturnian, black-hole, random], proximity?: distant | near | high-orbit | low-orbit (how close the large world is: in orbit the fight is over it, a horizon round it), nebula?, suns? 0-1, seed? })`,
    '  world: { style: { palette } }: pick_palette\'s spec, or { preset: \'coastal-noon\' }; paints the land, sky, haze and sea',
    '  followed from behind; no hero, ride, climb, building or run',
  ],
};
export const QUICK_GOAL_CARD_IDS = Object.keys(QUICK_GOALS).map((g) => `gameworld-quick-${g}`);

const quickHead = () => 'THE QUICK PATH — one level, one goal, one call: design_game({ quick: { goal, ... } }). The loop is simple; the graphics are not.';
const quickShared = () => [
  'levers any goal takes (where its play allows; a refusal names the clash):',
  `  hero: ${HERO_WORDS} | { ref } (a hero from create_character): looks, gear, the motion's feel (get_solid_vocab({ id: 'layered' }));`,
  '    { mascot: true | { brief?, facets?, seed? } } a mascot on foot, its own walk, run and jump; absent or false: first person',
  `  camera: ${Object.keys(CAMERAS).join(' | ')}   absent: third person, or first person with no hero`,
  `  screen: ${Object.keys(SCREENS).join(' | ')} | { pole?, aspect?, orientation?, fov? }   the screen it is for (absent: ${NEW_GAME_SCREEN ?? 'none'})`,
  '  climb: true   a climb after the trail;   run: n   a pool of n + 2 trails, each run draws n, a death ends it',
  '  building: { use, seed?, goal?, … }   a building as the level (reach, collect or survive; card game-building)',
  '  cast: true | { scale?: hero | rival | party, n?, cast?, bodies?, … }   on foot: people rolled for the game (the casting',
  '    page, gameworld-story); party and familiars walk beside you and fight what you fight, a rival is the first foe',
  '  moves: true   every person made (hero, foes, guards) takes a blow on its own rig: hit, stagger, fall, rise',
  '  foe: { species }   battle and defend: the foes are a beast (a wolf pack) on its own gaits and reactions',
  `  theme: { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? }   the game shell's skin`,
  "  music: 'auto' | '<mood>', sfx: 'sheet' | 'auto' | '<palette>'   per-level score, goal sounds",
  `  world: { id, name?, seed?, style?: { kit, look?, land? } }   the ground in words: kits ${GROUND_KITS.join(', ')} (gameworld-world says what each takes)`,
  '',
  'THE ANSWER: the readout of the one-level gameworld written and run: its stage as a level with the goal on the stage\'s own',
  'anchors, the store the goal needs, and the game in the light play shell (title, level, result), with its play link.',
  'Walkable by construction; whether it can be beaten is the creator\'s to judge in play, and nothing proved it.',
  'GROWING: it is an ordinary gameworld. Patch in the hero\'s pages (design_game({ ref, patch })) and the same sketch becomes',
  'the book, with every page, review and gate (gameworld-guide). Several levels from a sentence: compose (gameworld-guide).',
];

function battlesCard() {
  return lines(
    'THE BATTLES — party battles, turn by turn, laid on the book\'s levels: battles { on?, board?, party?, packs?, per?, boss?, foe?, looks?,',
    '  shops?, rest?, random?, classes?, skills?, foes?, items?, rules?, manual?, tree? }. The book\'s battles page reads them back. Absent: no battles (a turn-based cube asks for them: the',
    '  encounters concern). The fights are play.rpg (get_play_vocab({ id: \'ui-cues\' }), PARTY BATTLES).',
    '',
    `party   the hero and each cast member who joins (characters.cast.<id>.joins), each a class: { hero: { class, name? },`,
    `        <cast id>: { class } }. Unnamed: the hero a fighter, those who join in turn ${JOINER_CLASSES.join(', ')};`,
    '        with characters.casting, the hero and its first party each the class their sheet reads as.',
    `        Classes: ${BATTLE_CLASSES.join(', ')}, or the world's own (classes). A member switches class on P, outside a`,
    '        fight; each class keeps its own rank, points and skill tree; learned skills stay. followers: false, it',
    '        fights but does not walk the map.',
    `packs   the packs met along the way, walked in order across the game's trail stages (default: ${PACKS.slice(0, 3).map((p) => `[${p.join(', ')}]`).join(', ')} …);`,
    '        per: n on each trail stage (2), on its beats, as many as it has room for. boss: a pack, the last stage\'s',
    '        last (a building\'s: its goal room), with no escape; sets: the story flag its fall sets (a quest\'s last step).',
    '        foe: { <hero-door words> } how a foe stands on the map, or { species, ooze?, stylism? }:',
    '        a beast on its own gaits (a wolf pack, dire wolves); walk up to one to fight.',
    'looks   each foe its own: { <foe id>: { species, ooze?, stylism? } a beast | { people, facets?, dress? } a people (a',
    '        lineage, the beast-kin: lupine, feline …, the undead: skeleton, zombie) | hero-door words }; the presets\' own.',
    'shops   a merchant (wares by how far on, bought back at half) and an inn (a night: HP, MP, cured) beside each fighting',
    '        stage\'s start: shops: false | { wares?: [ids], inn?: gold | false }. Where an inn stands it is the rest.',
    'hub     the world\'s hub: \'<level>\' (topology interconnected): the town every way leads back to, no fights in it,',
    '        its merchant and inn there; kept by its folk (characters.folk) where it has them, else by the way in.',
    'rest    E at each stage\'s start restores HP and MP (rest: false for none). random: { every?, chance?, after? }',
    '        random fights on the trails, drawn from the stage\'s packs.',
    'gear    one item a slot (weapon, armor, accessory), its numbers on the member\'s; each class starts in its own; the',
    '        Equip tab (P) wears what the bag holds. gear: the world\'s own, { <item>: { slot, atk?, def?, …, classes? } }.',
    'foes    { <id>: { hp, mp?, atk, def, mag, spd, xp, gold, skills?, drops?: [{ item, chance }], weak?, boss? } }: a row',
    '        REPLACES its preset whole, its skills and drops too: name them again.',
    'manual  a setting\'s creatures, fielded: { polarity, creatures: [{ id, element, role }], affinity?, levels? } (a',
    '        lorecube manual at any depth): its foes, their skills and looks, a ladder of packs by role and level, its boss;',
    '        the page\'s own foes, looks, packs and boss win. What it lacks is derived and said (`lore`): write it to own it.',
    'tree    a school\'s techniques, a class the party can be in: { id, element, techniques: [{ id, does }], order?, costs? }',
    `        (does: ${DOES_IDS.join(', ')}), one or a list; a technique a skill, learned by rank or bought.`,
    'rules   { turns: rounds (every member picks, then all act by speed) | timeline (each acts when its gauge fills: the',
    '        quick more often), defeat: fail (the level) | retry, switch: anywhere | never, carry: class | all, cap, xp, cp, sp }.',
    'juice   what the moments feel like: { on: { <happening>: juice }, also?, <name>: [steps] } over the defaults (false:',
    '        none); on: the most specific happening\'s juice plays, also: every happening\'s layers over it (weak, resist);',
    '        steps puff, beam, shake (on the map), flash, jolt, pop (the window), hold, emit (a bus event any cue answers).',
    '        Happenings: hit, crit, weak, element:<el>, skill:<id>, cast:<skill>, ko:<foe>, start:boss, victory … ; each',
    '        beat also says rpg-on:<happening> on the bus, for the world\'s own systems. A skill\'s own: juice: { cast, land }.',
    'on      \'board\': each stage that meets packs a TACTICS battle on its ground, the game travelled in EPOCHS from',
    '        MAPS; board: { … } and the rest: get_game_vocab({ id: \'board\' }). Absent: the fights are met on the trail.',
    'A world whose intent fights turn by turn is laid with battles, written or not.',
    'CARRIED: the party (levels, xp, classes, ranks, skills, gear) in the store\'s party slice, the bag (items, gear not',
    '  worn, gold) in its bag slice, two potions to start.',
    'MOVES: moves: true on the world, and every person the run makes (the hero, the foe, a keeper) is made with its own',
    '  hit, stagger, fall and rise, and plays them on the map over the library\'s; a cast member always is.',
    '',
    `MINIGAMES — the games inside the game, battles or not: minigames: true (all) | false | [${MINIGAME_IDS.join(' | ')} |`,
    '  { game, id?, where?, title?, goal?, gold?, prize?, flag? }]. Absent: heard in the prompt (minigames, carnival,',
    '  fishing, arcade, match-3), else none. Each has a keeper, spread across the game: where: inside, in a building\'s room',
    `  (${Object.entries(ROOMS_KEPT).map(([u, r]) => `${u} ${r.join('/')}`).join(', ')}; blocks and match by default) or trail, a few`,
    '  steps up a trail stage (fishing). E there plays a round in a pixel window over the field (it holds still).',
    '  Its score pays gold (gold: a point) into the carried bag;',
    '  goal is the score that wins; the first win gives its prize (an item) and sets its flag (a scene or quest reads it).',
  );
}

function mountsCard() {
  return lines(
    `MOUNTS — horses the hero gets on and rides: mounts: 2 (that many bays beside each walking level's spawn) | [{ coat?`,
    `  (${Object.keys(COATS).join(' | ')}), at?: [x, y], heading? }]. E in reach walks to the near side and gets on; W urges`,
    '  it up through walk, trot, canter and gallop, letting go halts it, S checks it and reins back, A/D turn it (wider at',
    '  speed), Space jumps at a trot or faster (a low wall cleared); E at a walk or halted gets off. Any hero rides: its',
    '  riding clips are solved on its own rig to the horse\'s saddle, irons and bit.',
    'A world whose levels walk lays them on each; a level whose hero is a car or a craft leaves them standing loose.',
    'The mount lane (`bible?book=practice&room=mount`, before any level) tunes the ride: the gaits, the jump, the fences.',
    'A template that rides (the action-adventure) is suggested two (a `mounts` step in design_game\'s readout), never laid.',
    'CARS — a level on a town or a district (a geotown\'s, a geocity\'s) needs none asked for: the cars it parks nearest its\n' +
    '  start are the hero\'s to get into, each its own model and paint where it stands. E in reach walks to the driver\'s door\n' +
    '  and gets in: W throttle, S brake then reverse, A/D steer; E when nearly stopped gets out at the door, on foot again.',
  );
}

function hijackCityCard() {
  return lines(
    'HIJACK CITY — the open city\'s crime game (rail `hijack-city`, genre `open-city-crime`): a district roamed on foot and in',
    '  any car taken, a contact\'s missions, a wanted level and the police after it, a respray and a gun shop, the money in',
    '  hand, a phone\'s fares, crews with turf. A STARTER for a person\'s own GTA-like: theirs to rename and grow, never the game.',
    '',
    'START design_game({ name, rail: { from: \'hijack-city\', locked: true } }): the starter laid whole (hijack-city.js), every',
    '  key the person wrote winning; then design_game({ ref, run: true }) builds it and export_game({ ref: \'<ref>-game\' })',
    '  ships it with its title screen, a save and continue. A sentence ("a GTA-like game") finds the rail (gameworld-producer).',
    '',
    'WHAT IS IN IT, each a word of the world:',
    '  levels.<id>.geocity   the district of a metro (its cars parked to take; traffic; passers-by who flee and fall)',
    '  errands[].mission     { heat?: stars, clean?: lose them first, time?: seconds, final?: the end } on a contact\'s job',
    '  law: true | { stars, per, cars, armed, calm, busted, fine }   mayhem raises stars; police on foot and in cars',
    '  shops: { respray, guns }   repaint and lose the police; rounds for the sidearm (Q fires, R holsters it)',
    '  factions.<id>          crews: turf, rivals, a board of acts (torch, tag, take)   app: \'taskfu\' fares on the phone',
    '  ui.theme, sound, music  the look (theme cards), the car\'s sounds, the score (walk, chase, tension)',
    '',
    'GROW IT: rename it; the hero (create_character words); another metro (`geocity.metro.from`); the story (missions); the',
    '  crews; the law\'s numbers; the shops\' prices; a theme card. Era: gen-7 by default (the sun\'s shadows, the actors\'',
    '  and the buildings\' light), `style.geocube.era: \'gen-6\'` for a lighter page.',
  );
}

function missionCard() {
  return lines(
    'THE MISSION — a shooter\'s first level: the firing range stretched into sections, each with one task. The range is',
    '  where the game\'s guns are written and tried (bible?book=practice&room=range); the mission is the same guns, the same',
    '  body and the same bands laid down one line, briefed, played and debriefed on mana-ui.',
    '',
    'levels.<id>.mission   true (what the guns ask for) | { seed?, sections?, foes?, hold?, waves?, map? }',
    '  in place of `walk`: its ground, its foes and its tasks are its own (no goal, foes, course or arena beside it).',
    '  Laid from the guns the world carries (a quick shooter\'s arms, a gun in the hero\'s right hand, a feel whose',
    '  template shoots): a world that carries none has no mission.',
    `  foes   how many the lane stands, ${MISSION_LIMITS.foes[0]} to ${MISSION_LIMITS.foes[1]} (${MISSION_DEFAULTS.foes}): every fight in proportion`,
    `  hold   the yard's clock, ${MISSION_LIMITS.hold[0]} to ${MISSION_LIMITS.hold[1]} s (${MISSION_DEFAULTS.hold}); waves ${MISSION_LIMITS.waves[0]} to ${MISSION_LIMITS.waves[1]} (${MISSION_DEFAULTS.waves})`,
    '  sections   the sections in order, in place of the ones the kit\'s bands choose; it ends at a way out',
    `  map    fought on a FIGHTING MAP, not down a line: true (the kit picks: ${Object.entries(MISSION_MAPS).map(([b, m]) => `${b} ${m.template}`).join(', ')}) | a`,
    `         template (${TEMPLATE_IDS.join(', ')}), grown under the arena laws; arm up, a clear a band, hold the heart, get out`,
    'IN A BUILDING   levels.<id>: { building: { use, fight? }, mission: true | { seed?, foes?, hold?, waves? } } (no map, no',
    '  sections): fought in its rooms, its fight true unless false, read in the seventh generation (the form render draws',
    '  it); its plan read as a fighting map, the phases placed in real rooms, from its door to a way out. design_game',
    `  proposes one by the kit's band (${Object.entries(MISSION_BUILDINGS).map(([b, r]) => `${b} ${r.use}`).join(', ')}): the step's \`building\`.`,
    'INDUSTRIAL   levels.<id>: { industrial: true | { use?, depth?, hour?, weather?, wet?, tower?, walker?, crew?, masked? } }:',
    '  a fenced yard before a base building, laid by the arena laws, built by the geocube; out by its door.',
    'CAMPAIGN     the step\'s `campaign`: the opening mission as legs (yard, street, building, works), each a level and a',
    '  checkpoint, played in order. Apply its patch whole.',
    'SECTIONS (each a room across the mission, a doorway to the next, sealed until its task is met)',
    ...Object.entries(SECTIONS).map(([k, v]) => `  ${k.padEnd(12)} ${v.task.padEnd(6)} ${v.band ? `${v.band} band, ${BANDS[v.band].m} m` : 'no fight'}: ${v.teaches}${v.gap ? ' (a GAP: designed, not built; refused with what it waits on)' : ''}`),
    `TASKS  ${Object.entries(TASKS).map(([k, v]) => `${k}: ${v.says}`).join('; ')}.`,
    'A kit that serves the mid band gets the lane; a long gun the long line too; close guns alone a room and a yard.',
    'A room\'s foes are woken as it is walked into. The hp is the level\'s; rounds and health lie on the floor.',
    'Its HUD is mana-ui\'s: the hp, the gun in hand, the objective tracker, and the DAMAGE RING: a mark on a ring round the',
    '  aim where each hit came from (the top ahead, the bottom behind), for a moment, turning as the player turns.',
    'BEFORE IT IS A LEVEL: the practice door\'s first mission (bible?book=practice&room=mission) plays it from the world',
    '  alone. design_game proposes it (a `mission` step with its patch) for a world with a firing range and none yet.',
    'GATES (machine): the laws (walkable, sealed, banded, covered, entry-safe, in-order, armed, paced) ride the level\'s',
    '  step; a run reads `mission_proof`: the tasks done in order on the bus, and the level won headless by a gunner that',
    '  walks, aims and reloads. Whether it is a good first level is the creator\'s to say in play.',
  );
}

function rollCard() {
  return lines(
    'THE ROLL — a game that plays a different map each time. The recipe never changes: the seed its shell sends each play',
    '  picks what is on a level. Seed 1 is the reference roll (a page with no shell, a capture, the books).',
    'A WORLD\'S WORD   roll: true | { cover?, items? }   each walking level on a trail takes a roll over its own cover (walls and',
    '  crates by the trail\'s beats, laid for the roll when the level has none: half or more stand, never all) and its own',
    '  pickups (half or more lie, never all). A hero with no body is given one: no cover stops it without.',
    '  Quick: design_game({ quick: { goal: \'collect\', world: { roll: true } } }).',
    'AN OBSTACLE COURSE (a running game)   a level\'s obstacles: true | { slots?: 4…40, rest?: 0.2…3, dress? (gameworld-course-dress) }',
    '  in place of walk: a lane of slots seen from behind the hero, a hurdle, a block or posts in each, rolled as one paced',
    '  line. It is sized for the world\'s hero by what each ask needs in seconds, measured on its feel, and followed by a',
    '  camera that frames it. A hero that runs on momentum (feel: commuter-rail-runner) is the one it is for.',
    'A LEVEL\'S OWN (create_sketch / update_sketch on the level)   roll: {',
    '    cover:   [{ of: [\'<block id>\', …], stand: n | [min, max] }]   groups of its blocks ({ id, form: wall | pillar | crate | slab, at, … })',
    '    items:   [{ of: [\'<pickup id>\', …], lay: n | [min, max] }]     its collect\'s pickups ({ id, item, at })',
    '    start:   [{ pos: [x, y, z], heading? }, …]                       where the pilot sets out',
    '    pattern: [{ slots: [[id, …], …], kinds?, run?: 2, beat?, never?, forms?, ramp? }]   a LINE, one standing a slot, paced:',
    '             never more than `run` of one kind running, never a pair of kinds repeated, `ramp` { form: [first, last] } its weights',
    '  }   A group\'s picks know nothing of each other; a line\'s do. Left out, a thing is gone whole: nothing breaks.',
    'A RUN OF ITS MAPS   create_game({ …, shell: \'play\', run: { length, repeat: true } }): one level that rolls, drawn again and',
    '  again, each draw another map; the result says the map\'s number. Played again, a rolled level is the same map.',
    'THE GATES (machine: they advise, they never refuse)   create_game answers `rolls` for each level that rolls: a sample of',
    '  seeds walked in Node (a body, a way through, apart, won), or for a course played by the reaction bot, which sees only so',
    '  far ahead and acts a reaction time after (fair, finishes, paced, apart). Say how many seeds were walked.',
    'THE ROLL ROOM (before any level)   bible?book=practice&room=roll: a yard, or for a running game its course; R rolls the',
    '  next seed. &view=map is the course map: the course from above, on its side, read left to right. Its measures are in',
    '  design_game\'s readout (practice.measured.roll). Whether a roll reads as designed is the operator\'s to see.',
    'NOT YET   foes a seed picks; the layout itself rolled; a start rolled by the world\'s word.',
  );
}

function trackLanguageCard() {
  return lines(
    'THE TRACK\'S LANGUAGE — what a raced track (a level\'s `roadway`) is made of and how its parts are shaped, said once, so',
    '  the way, its kerbs, its rail, its posts, its flags and its trees are one family. The principles below are STARTING',
    '  POINTS for a new map: copy a card, change its premise, and keep what each principle asks.',
    `THE WORD   a level's roadway.language: ${Object.keys(TRACK_LANGUAGES).map((k) => `'${k}'`).join(' | ')} | a card written out. A track from words (quick.roadway:`,
    `  { intent }) takes its class's (${Object.entries(LANGUAGE_OF_CLASS).map(([c, l]) => `${c}: ${l}`).join(', ')}). A card: { reads, suits: [class…], materials: { <name>: { of, finish:`,
    '  gloss | satin | matte, hex } }, parts: { way, edge, kerb, rail, verge, bunting, tree, pieces, city }, sky? }. Read a shelf card for',
    '  each part\'s fields (roads/track-language.js); a part left out is the class\'s plain one.',
    'THE PRINCIPLES',
    '  1 A PREMISE FIRST   one sentence says what the track is made of (`reads`); every part is named in it.',
    '  2 A SMALL FAMILY   few materials, each a stuff, a finish and a colour. The rail and its posts are one stuff. Two',
    '    finishes at most on the hard parts: gloss for what is moulded, matte for the way and the turf.',
    '  3 THE WAY IS QUIET AND LIGHT   the largest thing on the screen: matte, mid-light, never as vivid as a kerb. The kerb',
    '    parts from it by lightness, and the kerb\'s two colours from each other.',
    '  4 A CORNER IS TOLD THREE TIMES   far: the rail wears its `tell` stripes round the OUTSIDE of the corner. Middle:',
    '    chevrons on the way point into it. Near: the kerb. All three in the tell\'s two colours, used for nothing else.',
    '  5 SEEN TO MOVE   speed is read off what passes: the way in bands of two tones, a centre dash, the verge mown in',
    '    stripes, posts at one spacing, bunting. Give a straight at least two of them.',
    '  6 ASYMMETRY   the two sides never mirror. Bunting runs down ONE side, the side by turns. Chevrons lie on the outside',
    '    half. The tell is on the outside only. A tree\'s crown is lopsided, and a share of trees are in blossom.',
    '  7 CHUNKY   rounded and stout: nothing thinner than a hand could hold, a ball on every pole, pillows for kerbs.',
    '  8 THE SKY IS THE TRACK\'S, ITS SUN CASTS   its day, its sun, clouds built as it is (`sky.puffs`). Page-lit (gen 7): the',
    '    sun low (36°) so shadows read from the kart, soft blue; the palette held on what lies flat. "baked" bakes it.',
    '  9 THE LAND IN THE TRACK\'S SHAPES   trees take the land\'s own greens and the language\'s forms.',
    '  10 THE TRACKSIDE IS THE TRACK\'S TOO   its arch, boards, castle and bumpers are stand-in blocks (pieces.blocks) in the',
    '    family\'s paint (pieces.paint): a hoop on balls for an arch, a lollipop for a braking board, balls for battlements.',
    '  11 A TOWN, A STREET CIRCUIT   "a kart street circuit": round a grid\'s blocks, square corners; fronts down each straight',
    '    facing the way (taller toward the middle, never three alike, the family\'s colours by turns); lamps, signals, zebras;',
    '    an alley across a corner (shorter, cobbled, boost pads: either way the lap) and an underpass (city.split, .tunnel).',
    '  12 UNDERGROUND, A MINE   "a kart race through a gem mine": the arena one cavern (a ring round the lap, a dome,',
    '    stalactites, lantern posts, glowing crystals, one skylight shaft) and galleries bored through its rock: timber',
    '    portals and sets, lanterns, gems, a cart line, a headframe yard; lit as a cave (mine.js).',
    '  13 ONE PRIMITIVE, TWO TUNINGS   a realistic circuit answers the same questions soberly (grand-prix: the look\'s own',
    '    asphalt and paint, one steel for the guardrail and its posts). A principle is a question, not candy.',
    'THE LAWS (machine; they advise)   premise, family, one-metal, finish, kerb-read, tell, suits, drawn (nothing drawn outside',
    '  the family). A roadway level\'s gate says them as language:<law>, beside the track\'s own and the trackscape\'s.',
    'LOOK   node scripts/trackscape.mjs "<the track in words>" out.html writes the page. How it looks is the operator\'s to say.',
    'NOT YET   the land\'s rock formations and a stadium bowl in the language; flank slices; the page lighting it as the kart.',
  );
}

function courseDressCard() {
  return lines(
    'THE COURSE\'S DRESS — how an obstacle course (a level\'s `obstacles`, gameworld-roll) looks: its way and asks, the WALLS',
    '  beside it and the BACKDROP behind it. One dress, because they share one screen, read in thirds from the top: where',
    '  stuff comes from (the backdrop\'s), where it comes to view (the walls\' and the asks\'), where you react (the character\'s).',
    'A PREMISE FIRST   a dress coheres when one sentence says who runs here and toward what, and every thing on the screen is',
    '  named in it. last-train (the default): a kid late for the last train runs down the tracks into the terminus; the lanes',
    '  are tracks, a hurdle a crossing barrier, a block crates, posts stabled wagons, the walls stations and the cutting.',
    'THE WORD   a level\'s obstacles.dress: \'last-train\' | \'rail-yard\' | \'greybox\' | {',
    '    theme?:    the card every part left out falls back to (last-train unsaid)',
    '    palette?:  { <role>: \'#rrggbb\' }   by ROLE, never thing by thing:',
    '               the way ground ground2 sleeper rail kerb wall · the asks jump jump2 (go over) steer (go round) ·',
    '               the tells tell-jump tell-steer · exit · the walls flank flank2 trim iron lamp · the backdrop sky horizon far land',
    '    walls?:    { a?, b?, order? }   A the complex slice, B the plain one that lets A be seen. A slice is one segment long:',
    '               a name (platform, cutting, shed, stacks, fence, bank) or { name, parts: [{ box: [u0, d0, z0, u1, d1, z1],',
    '               role }] }, u 0…1 along it, d metres off the kerb outward, z metres up, a wall\'s role (40 parts at most).',
    '               order: one side\'s own (\'ABBA\'), else the walls\' rule lays each side (never three alike, never ABAB).',
    '    backdrop?: a name (terminus, yard, open) or { name, bands?: 3…12, skyline?: [{ at: -1…1, wide, tall }] }   the sky from',
    '               `horizon` up to `sky`, silhouettes in `far`, the land in `land`, 400 m past the course\'s end.',
    '  }',
    'IN UNISON   design every layer in one patch and read one sheet: bible?book=practice&room=roll&view=sheet (&level=<id>).',
    '  It draws the screen from the course\'s own geometry through its own camera, its thirds ruled, the slices in',
    '  elevation, the palette by layer and every law. &view=map places the slices along the course. Work it as a wave:',
    '  the levels chapter owns the asks and their pace, the world chapter\'s style gives the place and its palette, and',
    '  both patch levels.<id>.obstacles.dress; neither is done until the sheet\'s laws hold for the whole dress.',
    'THE LAWS (one machine gate over every layer; it advises)   readable: an ask stands out from the way, the walls and the',
    '  backdrop. distinct: go over and go round differ by hue. quiet: nothing but an ask is vivid. told: a tell is in its',
    '  ask\'s hue. premise: the theme has one and names every thing; a slice or backdrop of your own carries its name. receding: the skyline is nearer the horizon\'s colour than the walls are. interest: A has more parts than',
    '  B. rhythm: each side keeps the walls\' rule and the sides differ. banded: the skyline stays in the top third.',
    '  design_game\'s readout carries them (practice.measured.roll.dress: lost, says) and a `roll` step names what is lost.',
    'ORDER OF WORK   the character\'s back, then the far end (quiet, so what is coming is read), then the middle third: make A',
    '  interesting at a segment\'s size, then B plainer, then their order. The eyes gate is the operator\'s, on the game\'s page.',
    'NOT YET   walls a seed re-orders each run; textured parts; tall tells in the top third.',
  );
}

function wcdCard() {
  return lines(
    'THE WALLED-CORE DUNGEON (WCD) — a dungeon built as layers on a critical path toward a final area, the CORE. Each layer',
    '  gates the next and takes the player deeper: across, down or up. A concept, not a map shape: Shadow Moses and the',
    '  three walls (Maria, Rose, Sina) are WCDs.',
    '  A stealth game is close to a stack of them; a metroidvania is WCDs side by side, one core\'s reward opening another\'s gate.',
    '',
    'wcd     on the world: { core, spaces: { <id>: { kind, depth, level?, use?, facility?, look?, built? } }, doors: [{ from, to, via,',
    '        gate?, oneWay? }] }',
    'SPACES',
    ...Object.entries(WCD_KINDS).map(([k, v]) => `  ${k.padEnd(13)} ${v}`),
    '  depth         0 the outermost; the core the deepest',
    "  level         the world level it is in (several: a complex); use: a building use (the program's rooms); look: the composer's words or",
    '                { words?, construction?, palette? }, built into its level (a base building is composed and stocked);',
    '                tone: the stage\'s colour (its ramps), kept on the dungeon; built: false, on the path and not made yet',
    'DOORS (the intermediaries)',
    ...Object.entries(WCD_VIAS).map(([k, v]) => `  ${k.padEnd(13)} ${v}`),
    "  gate          { clearance: 1…9 } (a keycard), { power: '<id>' }, { keys: true } (an escape room's)",
    '  oneWay        opens only from `from`: a shortcut back out, a drop',
    '',
    'A BASE\'S BUILDINGS (a space\'s use; each on the bay kit of what it is, so the layers look unlike each other):',
    ...BASE_USES.map((u) => `  ${u.padEnd(13)} ${PROGRAMS[u].reads} (${PROGRAMS[u].kit})`),
    `FACILITIES (a space's or a building's facility: a use built to move through, loops, a catwalk, its floors laid): ${FACILITY_IDS.join(', ')}`,
    `  a room of any building: building.layouts { <room or role>: ${LAYOUT_IDS.join(' | ')} | { layout, …dials } }`,
    '  parked: its level\'s building.parked: true (a truck and an APC) | [vehicles] | { vehicles?, livery?, wear? }: parked',
    '                in its hangar (else its largest room), solid, painted as its foes\' faction, else its setting\'s camo',
    '',
    'PRINCIPLES (laws on the recipe: they advise in design_game\'s readout, `advice.wcd`, and never refuse)',
    ...Object.entries(WCD_PRINCIPLES).map(([k, v]) => `  ${k.padEnd(13)} ${v}`),
    '',
    'COMPLEX: a level\'s building { complex: true | { campus: hospital | base } }: its spaces (or a campus) as buildings,',
    '  joined below grade by their doors; played first door to last goal room; laws in advice.wcd; no gate held shut yet.',
    'A layer\'s construction and palette carry the change from the last. The book draws the dungeon as rings to the core,',
    'each gate on its join, each layer\'s finishes beside it: the approval sheet before a run. A level\'s style palette does',
    'not colour a bay building; its look or its tone does.',
  );
}
function courseCard() {
  return lines(
    'THE COURSE — a platformer\'s level: trails linked one after another, each teaching what the next tests, its floors and',
    'gaps laid over a trail\'s own line and SIZED BY THE HERO\'S REACH (its feel: the running jump, the air jump, the dash jump,',
    'the wall kick), each gap tagged with the move it teaches. levels.<id>.course: { teach, verticality? } over every trail of',
    'its walk, or { <trail node>: { teach, verticality? } } each its own.',
    '',
    `  teach        ${TEACH.join(' | ')}`,
    '    basic      gaps and steps the running jump clears, widening as it goes',
    '    meet       one long flat floor: the first encounter, room to learn the stomp or the blow',
    '    advanced   the card\'s advanced moves, each just past the running jump, then tested (a template with takes: true',
    '               carries its dash and its wall; its air jump without)',
    '    gauntlet   basic gaps between floors long enough to fight on',
    '    boss       one long floor, the arena',
    `  verticality  ${Object.entries(VERTICALITY).map(([k, v]) => `${k} (${v.says})`).join(', ')}`,
    '',
    'THE FIRST LEVEL, the slice: five trail nodes, course { basic, meet, advanced, gauntlet, boss? } a node each, and the',
    'foes\' density a node each (levels.<id>.foes.density: { meet: \'sparse\', gauntlet: \'dense\' }, gameworld-foes). A boss',
    'only when the creator asks: a fifth node, course { teach: boss }, and goal: { boss: { win: jobber | rival | boss } }: a jobber',
    'thrown away, a rival or a boss a story hook. The win changes no fight; the next level reads it, the story keeps it.',
    'IN TWO DIMENSIONS. 2D (camera: side): the trails are one strip, one page, ONE TURN; its home is the title. 3D',
    '(camera: orbit | follow): each trail is a COURSE, a page and a TURN of its own (nodes grounds, meadow, climb, ridge,',
    'summit?: no foes on the grounds), its home the courses screen. Both: coins along the course, a start menu (front), a',
    'screen on its side, the hilltop look (ui.theme), and one flow shape: title → the level → its result → the next, or',
    'home; a level quit goes home with no result. A world that plays a platformer\'s feel and has no course is offered',
    'both as a patch (next: first-level; 2D unless the camera or the brief says the round, the other as `or`). Never laid.',
    'The readout\'s laws (course:gap-n) say each gap\'s width, its rise and what the move it teaches reaches; a fall into',
    'a gap puts the hero back on the floor it left. Its floors are the stage\'s beats: what stands on it stands on them.',
  );
}

function qowCard() {
  return lines(
    'THE QUEST OPEN WORLD (QOW) — the walled-core dungeon\'s opposite pole. A WCD forces the player in, layer by gated layer,',
    '  to a core; a QOW never does: its map is REGIONS joined sideways, connected and loaded as they are passed, each',
    '  reached without a gate, always two ways round. A city or an island: its regions are a geocity\'s neighbourhoods.',
    '',
    'qow     on the world: { map: { geocity: { … }, seed? }, spawn?, locks?, quests?, landmarks?, stream?, level? }',
    '  map         the regions: a geocity\'s (the geocube\'s show \'geocity\' recipe: its metro, its evoke), each neighbourhood',
    '              a region, each pair across an arterial joined at its portal; the beyond on its land edge where more joins',
    "  spawn       where play starts: a region's id ('D3'; by default the core's nearest the seat)",
    "  locks       [{ region, gate: { clearance: 1…9 } | { power: '<id>' }, why? }]: optional, a side door, never the way on",
    "  quests      [{ id, at: '<region>', kind?: main | side, after?: ['<quest id>'] }]: placed on the regions",
    `  landmarks   'auto' (the core's tallest tower, each node's) or [{ at, name?, height? }]: seen ${SIGHT}× their height off`,
    '  stream      { hops?, blocks? }: a region and its neighbours hops away loaded as it is passed, at most blocks blocks',
    '  level       the world level it is played in (city hunter\'s)',
    '',
    'PRINCIPLES (laws on the recipe: they advise in design_game\'s readout, `advice.qow`, and never refuse)',
    ...Object.entries(QOW_PRINCIPLES).map(([k, v]) => `  ${k.padEnd(11)} ${v}`),
    '',
    'ERRANDS (its element, as the escape room is the WCD\'s), on a map world (topology: interconnected): sent out, home with the goods.',
    "errands [{ id, giver: '<level>', reward?: [{ item, n? }], list: [{ item, at: '<level>', count?, min?, needs?: ['<item>'],",
    "        from?: { foe }, cargo?: { fragile?: true, perishable?: <s> }, shop?: '<store card>' }] }]: needs spent where it is had; from, a bounty;",
    "        shop, had over that kind of store's counter (pharmacy, convenience, diner…): at its till where the level's town has one walked into (geotown.shops);",
    '        the giver asks for the roots. Laws (advice.errands): ' + Object.keys(ERRAND_LAWS).join(', ') + '.',
  );
}
function foesCard() {
  const status = (c) => classStatus(c);
  const row = (c) => { const S = status(c); return `  ${c.id.padEnd(8)} ${c.reads}${S.status === 'built' ? '' : ` [${S.status}: ${S.short.join(', ')}]`}`; };
  return lines(
    'THE FOES — hostile things in the hero\'s way, by CLASS: how it moves, hurts, decides and what body it needs, never',
    '  a species or a skin (a goomba and a foot soldier are one class dressed two ways). Any class is any rank.',
    '',
    'foes    the bestiary, on the world: { <id>: { class, rank?, skill?, skin?: { species?, ooze?, stylism? }, vanish? } }. skin: the',
    '        animal door\'s words (a species, the oozes that grow it: dire, mythical, frost …); absent, the class\'s stand-in.',
    '        A skin that does not fit its class is refused, saying why (a swooper needs wings).',
    '        Or skin: { people, facets?, gear? }: a person (\'human\') or a people (' + PEOPLE.slice(1).join(', ') + '),',
    '        rolled in the world\'s setting in its class\'s role, made by the character loop with its moves, at its own height;',
    '        gear: what its hands carry, the hero door\'s words ({ right: { item, … } }: a club, a blade).',
    `        A kin (${KIN_PACKED.join(', ')}) is one body, its gear never designed: wild, bare, each its body: { size?: ${WILD_SIZE_IDS.join(' | ')},`,
    `        coat? }; adorned: true, geared by its own role and standing; or a pack, pack: { style: ${PACK_STYLE_IDS.join(' | ')}, colourway?,`,
    '        motif?, accent? }: the same gear in one cloth, colours and mark, by class and rank, its leaders helmed.',
    '        Or skin: { meshRef, height? }: a rigged humanoid .glb made elsewhere, bound onto that sketch, worn as a person.',
    '        A person dressed as a crew: { people: \'human\', dress: { faction, kind?, colourway?, body? } } (the grunt factions).',
    'levels.<id>.foes   true (the bestiary; each class on its stand-in if the world keeps none) or { from?: [<id>],',
    '        count? | density?, win?: exit | clear }: one foe on each free beat of a stage, cycling through from; clear: won when all fall;',
    `        count stands that many (up to ${MAX_FOES}), the extra round the beats; a building, ${ROOM_FOES} of its rooms. A swarm, a pack of ${SWARM}.`,
    '        density: foes a free beat, 0-4 (none sparse even dense swarm), or { <trail node>: it }. The hero is hittable.',
    `rank    ${Object.entries(FOE_RANKS).map(([k, R]) => `${k} ×${R.downs}`).join(', ')}: the blows it takes; a boss duels.`,
    '        skill: novice, regular, veteran, ace: how well it carries out what it decided.',
    '',
    'CLASSES (built unless marked: what does not run yet is said):',
    ...Object.values(FOE_CLASSES).map(row),
    '',
    `MOVES   ${Object.keys(MOVES).join(', ')}; ATTACKS ${Object.keys(ATTACKS).join(', ')}.`,
    'MODES   becomes: <id>: defeated, it is that entry (skin, class, bar) till the last: a knight\'s armour, a shell.',
    'SUMMONS a summoner\'s: { foe, count?, bound? }: another entry, asleep till called; bound (true), they fall with it.',
    `PAIR    an entry's pair: { foe, cover?, down?: ${PAIR_DOWNS.join(' | ')}, swap? }: its partner stands beside it, each its own bar;`,
    '        each covers the other reeling; one whose partner falls enrages, or (revive) both must fall together; swap: under',
    '        that share of its health one leaves the field while the other stands, and comes back.',
    `STOMP   ${Object.entries(STOMPS).map(([k, v]) => `${k}: ${v}`).join('; ')}.`,
    `VANISH  a downed foe dies in its game type's register, then goes (no carcass): ${Object.keys(VANISHES).join(', ')}.`,
    '        A platformer squashes it, an action game throws it back, a realistic one lets it fall; then the look fades it.',
    '        An entry\'s vanish: <word> | { is?, linger?, die?: fall | launch | dismantle | cleave | destroy,',
    `        sever?, inside? } names its own. DESTRUCTION: a dismantle comes apart at its joints (sever: ${Object.keys(SEVERS).join(' | ')}),`,
    '        a cleave is cut through its trunk (inside: its colour); a destroy lets the killing blow choose (a strike',
    '        cleaves, a round knocks some off, a burst tears it apart): the undead\'s default, layer 0 under every foe.',
    'CAST    /bible?book=foes, the cast sheet: parts foes:cast, foes:<id>. None kept: design_game\'s `foes` step proposes one.',
    'A world or level without foes is laid as it was.',
    'GAUNTLET a level\'s goal: { gauntlet: { arenas: [{ waves: [{ <id>: <n> }] }], checkpoint? } }: sealed in waves (card wave-gauntlet).',
    'STREET  a brawl\'s level: levels.<id>.street: { stops: [{ wave: { <role or id>: n } }], boss? }: the bestiary its crowd (gameworld-quick-brawl).',
  );
}

function quickCard() {
  return lines(
    quickHead(),
    '',
    `goal: ${Object.keys(QUICK_GOALS).join(' | ')}.`,
    'A goal\'s play and its own levers: get_game_vocab({ id: \'gameworld-quick-<goal>\' }), this card with that goal in full.',
    'Knowing the goal, read that card alone.',
    '',
    ...quickShared(),
    `  body: ${GAME_BODY_NAMES.join(' | ')} | 'game' | { rail, style?, muscle? }   the body it puts in its people: under the hero's words, under each foe, guard and tower rolled ('game': the goal's)`,
  );
}

// a sport's (meet, contest): the few levers beside its own it takes, and what its answer is made of
const sportShared = () => [
  `levers a sport takes beside its own: screen: ${Object.keys(SCREENS).join(' | ')} | { … }; theme: { accent?, bg?, … } the shell's skin`,
  '  (absent: solved from the sides\' colours in the venue\'s light); world: { id, name?, seed?, style?: { kit } } (the setting rolled in)',
  '',
  'THE ANSWER: the sport made: its athletes, each a CHARACTER in its own body (<ref>-athlete…; athletes: false alone leaves',
  'stick figures), the arena level in its venue, the game in the light play shell with its play link; laws: cast (who plays',
  'each slot), arena (the venue round the play), style (one palette over kits, graphics and shell; one drawing tradition).',
  'A level\'s first open resolves its arena and bodies (seconds), cached after. Whether it plays well is the creator\'s to judge.',
];
function quickGoalCard(goal) {
  const own = QUICK_LEVERS[goal]();
  return lines(
    quickHead(),
    '',
    `goal: '${goal}'   ${QUICK_GOALS[goal]}.`,
    own.length ? 'its levers, all optional:' : 'no levers of its own.',
    ...own,
    '',
    ...(goal === 'meet' || goal === 'contest' ? sportShared() : quickShared()),
  );
}

/** One quick goal's card by id (`gameworld-quick-<goal>`), or null. Served by id, not listed with the rail. */
export function quickGoalCardById(id) {
  const goal = typeof id === 'string' && id.startsWith('gameworld-quick-') ? id.slice('gameworld-quick-'.length) : null;
  if (!goal || !Object.prototype.hasOwnProperty.call(QUICK_GOALS, goal)) return null;
  return { id, name: `The quick path: ${goal}`, summary: QUICK_GOALS[goal], when: `a quick ${goal} game`, scope: 'rail', body: quickGoalCard(goal) };
}

function storyCard() {
  return lines(
    'THE CAST AND THE STORY — people other than the hero, and the moments they are in, written apart from the levels.',
    'characters.cast: { <id>: { name?, looks?, motion?, actor? } }: each a looks and a motion page, as the hero has (no',
    '  actions, adornment or gear: the player\'s), made after the hero at <ref>-cast-<id>. actor (theirs, the hero\'s):',
    '  how they act a script, { style?, role?, register? } (ui-scenes).',
    'characters.casting: { scale?, n?, anchor?: { brief?, facets? }, cast?, factions?, bodies?, seed? }: the people ROLLED',
    '  for the game, against the hero (anchor), in the world\'s setting. scale is how complete a game: hero | rival |',
    '  party (n besides the hero) | journey (a mastermind, its lieutenant and troops, a mentor, a rival, a party); absent,',
    '  the prompt\'s words decide (saga, party of four, rival), else a party for a turn-based world. cast: { <key>:',
    '  { relation, bond?, body?, name?, joins? } } over the scale\'s (relations: rival, foil, mentor, shadow, party,',
    '  familiar, lieutenant, mastermind, rank, herald, trickster …; keys are paths: \'emperor/dragon\'). bond party fights',
    '  in the battle party in the class its sheet reads as; familiar is kept by its parent. body person | beastkin |',
    '  beast (a species) | mascot (chibi); unasked, the setting rolls it. One egocube row holds the cast (<ref>-casting:',
    '  the members in a line); each member is <ref>-cast-<id> (id: the path, dashed). A journey waits on characters:cast.',
    'story: [{ id, who?: [cast id], where: { level, stage?, place? }, stand?: { <who>: place }, when, if?, sets?, once?, beats }]',
    '  where   the level it happens in, its stage (its first by default), the place it is about. A place is a stage\'s',
    '          start, exit, pocket, pocket-2…, landmark…, or a kind (pocket: the first pocket).',
    '  stand   where each person stands (else the moment\'s place, else beside the start), placed for the level\'s run.',
    '  the rest is a scene (get_play_vocab({ id: \'ui-scenes\' })): when, if, sets, beats; the cast names are the box\'s.',
    '  if also takes { has: \'<item>\' } (held in the store\'s bag, powers or gear, or picked up there) and { done: \'<level>\' }.',
    'SLOTS: a tactics book\'s, when: { slot: before | after } on a level, { slot: begin | end } with where: { epoch } (board',
    '  shots: get_game_vocab({ id: \'board\' })); the GAME\'s, one each, where: { level } its stage: opening (first boot,',
    '  before the title; its attract), prologue (after New Game; play follows), ending (before the end card).',
    'The story names the world, never its coordinates: each build binds every moment again; one that cannot find its',
    'level, stage, place or people is UNPLACED in design_game\'s readout (next: { step: \'story\' }).',
    'A beat may be a CHOICE (the answer sets its flags; a later moment reads them: if: { flag }) or a SCRIPT, a',
    '  screenplay the cinematics department blocks, shoots and acts: write the words; the readout\'s story.notes are',
    '  its director\'s. Both: ui-scenes.',
    'A CUTSCENE TO ORDER from the animation studio: hand it this game\'s characters, places and what happens,',
    '  forge_motion({ film: { order: { from: <this ref>, for, cast, places, events: [{ id, notes }] } } }); it hands',
    '  the cutscene back ({ film: { ordered_by: <this ref> } } finds it). get_motion_vocab({ id: \'film-studio\' }).',
    'quests: [{ id, name?, starts?: flag, steps: [{ log?, done: flag, moments?: [moment id] }] }]: every level keeps',
    '  the journal (J), its flags carried level to level. A moment in step n waits until step n - 1 is done (in step 1,',
    '  until the quest begins); its own if holds too. A step\'s flag is set by a moment\'s sets, an answer, or a cue',
    '  (emit \'flag:<name>\'); one nothing in the story sets is listed in the readout\'s story.unset.',
    'A COMPANION: characters.cast.<id>.joins: \'<flag>\'. Once the flag is set (an answer: { say: \'Come with me.\', sets:',
    '  [\'joined-teodor\'] }) they follow the hero, there and in every level after (the escort behaviour: they keep near',
    '  and fight what is hittable and not their own). Before it they stand where the story puts them, or are not there.',
    'A casting page\'s first party and familiars walk beside the hero from the start (joins: a companion, as above),',
    '  and every rolled member plays its own moves on the field over the library\'s walk; a beast, a mascot or a',
    '  beast-kin below the hero door walks on its own gaits.',
    'A TOWN\'S PEOPLE (NPCs grown from its houses, their talk, sidequests, a day): get_game_vocab({ id: \'gameworld-folk\' }).',
  );
}

function folkCard() {
  return lines(
    'THE TOWN\'S PEOPLE — characters.folk: each town a level lays (places: { town, street }) peopled from its own houses.',
    'A geotown level\'s town is peopled the same way; where its shops are walked into (geotown.shops) a shop\'s keeper stands behind its counter.',
    'characters.folk: true | { seed?, cap?, pool?, domicile?, domiciles?, say?, sidequests?, recurring?, day? }',
    '  A house\'s use roots its first person: a dwelling a townie, a shop its keeper, a workshop its master, a barn a',
    '  farmhand, the hall its elder, the tower its captain; each grows the rest (an apprentice, the watch). Each is rolled',
    '  from the town\'s culture and their role: the role\'s uniform, the seed\'s face. NPCs, not party members.',
    '  cap      people at most (60): every house its first person before anyone\'s household.',
    '  pool     bodies a pool makes as themselves (3): the people the player goes to get their own, the rest share.',
    '  domicile one house shape for every house; domiciles: { <lot key>: shape } one house\'s. A house is its DWELLER',
    '           and who lives with them: \'D + 0\' alone, \'D + P\' a couple, \'D of F (P + C2)\' a family of two',
    '           children, \'D + C1\' single, one parent (or { shape, children? }). Unasked, the dweller\'s age rolls it.',
    'WHAT THEY SAY: chitchat and a service\'s talk are written for them from a seeded line book, by their role, age,',
    '  temper, house and town, the town\'s open needs said aloud (no counter: "Folk trade over the fence."). The plot is',
    '  never written. say: { <role | person path>: text | [text] } gives your words in place of the book\'s.',
    'SIDEQUESTS: sidequests: [{ id, giver, steps: [{ talk: who, say? } | { reach: \'town-<use>-<n>\' }], name?, ask?,',
    '  thanks?, after?, back? }]. who: a role (\'keeper\', the first), a role and its count (\'townie-3\'), a recurring id.',
    '  The giver offers it; taken, the steps are a checklist in the journal (J), in order; done, back to the giver.',
    '  after: \'<id>\' offers it once that one is finished: a chain, giver to giver. Left out, the ask is a slot',
    '  ([Keeper: the errand]) and the rest plain words. It lives in the first town holding all its people.',
    'RECURRING: recurring: { <id>: { role, name? } } the Officer Jenny of a game: in each town with that role, its first',
    '  is them, one face and one name everywhere (the game\'s seed), the town\'s clothes and house. Talk names them.',
    'LIFE: by default each one not looked for potters out before its door and back (life: false: they keep still).',
    'THE DAY: day: true | { start?, rate? } gives the level a clock (its hour on the HUD, its sky dark at night) and the',
    '  households, children and watch walk a day on it; the keeper, the elder, the recurring and anyone in a sidequest',
    '  keep their place. Without it they potter by their doors. Walk up and press interact (E) to talk to anyone.',
  );
}

function nextCard() {
  return lines(
    'THE NEXT MOVES — design_game\'s readout ends with `next`: step ids, each with what it needs. What each asks:',
    '',
    '  review     gated: show the creator the bible, then approve or send back those `parts` ({ ref, approve: [...] } or',
    '             { ref, revise: { part, note } }). The verdicts are theirs, never yours. The bible\'s look is the world\'s',
    `             book: { skin: ${Object.keys(BOOK_SKINS).map((k) => `'${k}'`).join(' | ')} | { from?, paper, sheet, ink, muted, rule, accent, signal (#rrggbb),`,
    '             display, body, mono (font names), frame: rule | bracket, texture: none | grid | scanlines, plates: paper | night } }.',
    '             Its atlas, the levels, trails and ways drawn as a map (flat or tilted on the table): /bible?book=atlas&look=',
    `             ${ATLAS_LOOK_IDS.join(' | ')}.`,
    '  advised    autonomous: the machine gate advises on those `parts`: change the page, or approve it as it stands.',
    '  goalpost   the next open goalpost (`id`, `met` of `of`): ask the creator its `ask`, then make its `move`. Run',
    '             whenever there is something to show; a game built while it stands is a DRAFT (`draft`): show, ask, go on.',
    '             `grow` (a quick game, last): how its one level becomes their game. A `world` with no levels answers them all.',
    '  play       the game is made: `url`. Its levels are walkable by construction (the hero spawns on each stage\'s ground,',
    '             its exit is the stage\'s own end); whether they can be beaten is the creator\'s to judge in play: nothing',
    '             proved it (`gate: eyes`). `playtest` plays it with every level open and nothing saved; ?level=<ref> opens one.',
    '  share      the game is complete: ask the creator how they want to share it before exporting anything. `can` is',
    '             what this host allows per option (here | carry | ask | no); the call that made the game carries the',
    '             whole offer (`share`: each option\'s call and why). Where nothing can leave the host, the recipe is the handoff.',
    '  run        run: true makes every step that is ready: the hero first; a world with no characters (a composed one), its levels and the game.',
    '             A run stops at its budget (~2 min): with `pending`, run again (tell the creator). Each',
    '             reach or survive level is walked after the game, a step each, on check: true: `audits` (machine gate).',
    '  playthrough  check: true plays each fight level by a basic player and a still one (machine gate), as the budget',
    '             lasts (`unplayed`); `lost`: those the basic one could not win (`playthrough.levels`: how far, who hit it).',
    '  rerun      after a change, run again: what moved is remade, a hand edit is left (force: true overwrites it).',
    '  room       the first slice: the combat room (`url`, the creator plays it), then the first level.',
    '  worldmap   LOOK FIRST: open `look` (the map in miniature: ways, side ways, heights, cliffs, beats) and show the',
    '             creator, before a block is written or a page built, and after each change. Its blocks are a floor: ask',
    '             `req` (each block\'s ground, heights, marks), then its play layer from each block\'s brief',
    '             (docs/examples/the-old-keep). No raised walkways: those are a platformer\'s.',
    '  adornment  the page is empty: the bible proposes what the hero carries from the power verbs, with reasons; write',
    '             your own at `path` (gameworld-adornment); its items seed the equipment table.',
    '  intent     the world has not said what game it is: write intent (gameworld-intent); `suggest` names the genres',
    '             its brief\'s words point at. Until then its cube is read from what it says, and its concerns follow.',
    '             With `drift`: a quick goal now reads as another genre than the written one; keep it or change it.',
    '  wait       step `on` waits on those parts (their stamps in brackets).',
    '  compile    `compile.blockers` (by chapter): what the build would hit; fix first. `estimate`: the build left.',
    '  req        the unit being worked (`unit`): its view { ref, chapter: unit } carries its `req` (gameworld-ledger).',
    '  composite  accepted `levels` the game lacks: run: true makes the game of them alone, playable to the last.',
    '  front      the first level plays: its start screen, offered (`composition`, `subjects`, `patch`); the creator\'s to take.',
    '  chapters   (not a step) each chapter: department, state, `open` parts, what it `waits` on. Work one at a time,',
    '             upstream first: { ref, chapter } is its view (a department, or a subagent given only that and its card).',
    '             With run: true it makes that chapter and what it names, ahead of approvals (`ahead`: say so).',
    '  form       what the game it is asks and the world lacks (`asks`: for, field, by, says): a field `by: creator` is',
    '             theirs (the hero: ask who it is, never pick one), a `by: composer` field compose fills; run lays it after.',
    '  feel       no feel written: `suggest` is the template its brief, shooter pole or genre points at (`why`, `from`):',
  '             write it (feel: …) or leave the hero its own rule. Written, `lost` are card fields the runtime does not',
  '             carry yet: advice (gameworld-feel). Keep it, pick a template closer to what the runtime plays, or wait.',
  '  foes       it fights and keeps no bestiary: `suggest` is the cast a casting call proposes (`why`); show the',
  '             creator its cast sheet (foeBook), then write `patch` or any of it (gameworld-foes). Never written for you.',
  '  advice     read `advice`: a choice the brief does not explain, or one that reads as a fixture or a sample, is the',
    '             creator\'s to confirm.',
  );
}

function intentCard() {
  return lines(
    'WHAT GAME IT IS — intent: { from?, cube?, why? }. Say it before the world: the levels are laid for it. What it is ABOUT: gameworld-brief.',
    'A genre (from) is a preset cube, never a lock: cube overrides any value ({ space: { camera: \'top-down\' } }; facets',
    'reality, space, power, soul, mind, time; an unknown value is refused, naming the known ones). A world may mix two genres.',
    'design_game suggests from the brief (intent.suggest); a world that writes none is read from what it says (camera,',
    'topology, quick goal), and shown. A quick game writes the genre its goal is; a composed world the one its words name',
    'clearly (two of its words, more than the next genre\'s). A quick goal patched since to read as another genre:',
    'intent.drift, the written genre holding until you change it.',
    '',
    `genres: ${Object.keys(GENRES).join(' | ')}.`,
    'A genre\'s why, the words a brief uses for it, its cube and what it asks: get_game_vocab({ id: \'gameworld-intent-<genre>\' }).',
    '',
    'CONCERNS: what the cube asks of the world, raised by its values (a farm with guns asks both):',
    ...CONCERNS.map((c) => `  ${c.id.padEnd(14)}${c.when.join(' | ')}`),
    'The readout\'s intent.concerns names each, and whether the levels lay it (laid) and check it (checked) yet.',
    'intent.latent: an outcome the cube is one move from and the values it lacks (couch co-op: soul.seats, soul.frame).',
    '',
    'PLAYING TOGETHER — cube.soul.seats \'two\' | \'four\': every stage the hero walks lays a hero per extra seat, on one',
    'screen; a player sits down with any press on their own pad (the keyboard is one). An empty seat\'s hero follows the hero.',
  );
}

function briefCard() {
  return lines(
    'THE GAME BRIEF — what the game is about, above its genre, settled with the creator before anything is built. The genre says',
    'how a moment plays; the brief says why it is played and what shape it has. A pillar: the creator accepts it.',
    '  gameBrief: { gmn: { motivations: { <id>: share }, labours: { <id>: share } }, orders? }   (each mix sums to 1; the pitch stays in brief)',
    '',
    'ASK, IN ORDER, in conversation; never fill it in for them:',
    '  1. the pitch, in their words (brief)',
    '  2. why the hero goes on: the motivations, a mix',
    '  3. what it asks of the player: the labours, a mix',
    '  4. the first level: what it must show (it sets the tone everything after it follows)',
    '  5. the climax: the citadel, or what stands in its place',
    '',
    `MOTIVATIONS (the Time facet: stakes, ending, the acts, the cast, the palette's arc): ${Object.entries(MOTIVATIONS).map(([id, m]) => `${id} (${m.script})`).join(', ')}.`,
    `LABOURS (Space and Reality: the shape, the climax, what a beat is played as): ${Object.entries(LABOURS).map(([id, l]) => `${id} (${l.shape}, ${l.climax.kind})`).join(', ')}.`,
    `SHAPES: ${Object.entries(WORLD_SHAPES).map(([k, v]) => `${k}: ${v.says}`).join('; ')}.`,
    '',
    `THE MIX, read once when written: the largest labour decides the structure, the others at ${SIDE_SHARE} or more bring their side content; the largest`,
    'motivation decides the stakes and the script, the others add cast and flags; less is said and dropped. The readout\'s intent.gameBrief says what it',
    'decided; intent.suggest offers the genres its labours suit (advice: the creator may mix any genre with any labour).',
    '',
    `THE ORDERS, laid with it, each yours to edit: { id, kind: ${Object.keys(ORDER_KINDS).join(' | ')}, role, words, for?, mood?: { script?, at?, light? }, budget? }.`,
    'Two are always there: lv0, the first level, and the climax. mood is the colour theorist\'s note: how far along the script, and its light (even | drama | noir).',
    'A list already there is kept through a change of the mix; orders: \'reroll\' lays them again. A map order runs as a planned map (gameworld-world: glyphs.plan).',
    'What it seeds is not written for you: mainQuest is its own pillar, from the spine the readout offers (gameworld-main-quest).',
  );
}

// one genre in full (`gameworld-intent-<genre>`): the index above names the genres, so a new genre is a row here, not
// bytes on the index
function genreCard(id) {
  const g = GENRES[id], cube = genreCube(id);
  const say = (v) => (Array.isArray(v) ? `[${v.map(say).join(', ')}]` : typeof v === 'string' ? `'${v}'` : String(v));
  return lines(
    `WHAT GAME IT IS: ${g.name} — intent: { from: '${id}' }; cube overrides any value (gameworld-intent).`,
    '',
    `why: ${g.why}.`,
    ...(g.words.length ? [`a brief says: ${g.words.join(', ')}`] : []),
    'its cube:',
    ...Object.entries(cube).map(([facet, set]) => `  ${facet.padEnd(8)}{ ${Object.entries(set).map(([k, v]) => `${k}: ${say(v)}`).join(', ')} }`),
    `what it asks of the world: ${concernsOf(cube).map((c) => c.id).join(', ') || 'nothing past a walk'} (gameworld-intent says what raises each).`,
    ...(GENRE_FEEL[id] ? [`its feel: '${GENRE_FEEL[id].pole}' (${GENRE_FEEL[id].why}); write feel to play it (gameworld-feel)`] : []),
  );
}

// THE WORKSHOP (game/workshop.js): where a big game is made and where it is seen, said before the work commits. Served by
// id from the readout's `workshop` step, not listed with the rail.
function workshopCard() {
  return lines(
    'THE WORKSHOP — where this game is made, and where it is seen. Say it BEFORE the chapter is built, not after.',
    '',
    'When: design_game\'s readout carries `next: workshop` (a level estimated over this host\'s page limit: a glyph map of',
    'many tiles, a long chapter on one map), or you plan one yourself on a cloud box (Claude Code on the web, a cloud task).',
    'Tell the creator plainly, before the run: this box BUILDS the game and runs its machine checks (the laws, the walk,',
    'the desktop smoke), but it cannot SHOW a level that size here: a page reaches them only under the limit (`says` names',
    'it), it draws in software (no GPU: it checks, it does not play), and it forgets the work when the session ends.',
    'Then ask which path, and hold to the answer for the rest of the work:',
    '',
    '  local     (recommended) install mojulo on their laptop and carry the work over. Here: `npx mojulo script pack-data`',
    '            (the repo: node scripts/pack-data.mjs) writes the database as ONE gzipped file; send it. There: gunzip it as',
    '            the data folder\'s mojulo-lite.db (an install: ~/.mojulo/data; the repo: control/data). Seen at speed on their',
    '            GPU; each change on the next reload or export, nothing zipped again. Code: commit and push here; they pull.',
    '  desktop   keep building here; each look is export_game { ref, target: \'desktop\' } zipped and downloaded, then',
    '            npm install && npm start. Every look is a new download: say so, and say the checks still run here.',
    '  small     keep each level under the limit (fewer tiles, open land instead of dressed tiles, a lighter biocube) and',
    '            play it here as a page.',
    '',
    'Whatever the path: before a long session ends, pack the data (the box is ephemeral); `surface` unknown (MOJULO_SURFACE',
    'unset) means the advice names the box as a possibility: ask where they are working if it is not plain. On their own',
    'machine nothing here applies and the readout says nothing.',
  );
}

/** The workshop card by id (`gameworld-workshop`), or null. Served by id from the readout's step, not listed. */
export function workshopCardById(id) {
  return id === 'gameworld-workshop' ? { id, name: 'The workshop', summary: 'where a big game is made and where it is seen: the laptop, a desktop download, or kept small', when: 'a game too big to see in a cloud box, a level over the page limit, where do I play it', scope: 'rail', body: workshopCard() } : null;
}

// THE RAILS (rails.js): the game types as templates, the producer's two depths. The shape is every rail in a line; a
// rail's sheet is pulled once it is picked. Both generated from the roster; served by id, not listed.
function railsCard() {
  const S = railShapes();
  return lines(
    'THE RAILS — the game types mojulo builds, each a TEMPLATE a person\'s game starts from, never the game itself: they',
    'are making a stealth action game of their own design, started from Steel Serpents. The template\'s name is ours;',
    'the game\'s name, hero, world and story are theirs. This is the shape; pull a rail\'s sheet only once it is picked:',
    'get_game_vocab({ id: \'gameworld-rail-<id>\' }).',
    '',
    ...S.rails.map((l) => `  ${l}`),
    '',
    'NOT A GAME YET (say so before anything is built; offer the nearest rail):',
    ...S.notYet.map((l) => `  ${l}`),
    '',
    `THE SIZE, called first: ${Object.entries(SIZES).map(([id, z]) => `${id} (${z.name}: ${z.says})`).join('; ')}.`,
    'Call the least that answers the ask and say what the next size up would add. More than one level, or anything that',
    `is theirs to design (${Object.keys(OWN).join(', ')}), asks for a designed game; only a designed game is asked the`,
    'Game Brief (gameworld-brief). An ask past what a rail reaches is made at its largest and what it waits on is said.',
    'How a game is played THROUGH (levels in turns, an open world) is the brief\'s labour, not the rail\'s.',
  );
}

function railCard(id, variant = null) {
  const S = railSheet(id, variant);
  const say = (v) => (Array.isArray(v) ? `[${v.map(say).join(', ')}]` : typeof v === 'string' ? `'${v}'` : String(v));
  const set = (o) => (o ? `{ ${Object.entries(o).map(([k, v]) => `${k}: ${say(v)}`).join(', ')} }` : 'read from the ask: no cube of its own');
  return lines(
    `THE RAIL: ${S.name} — ${S.like}. A TEMPLATE: the person's game starts from it and is theirs (its name, hero, world`,
    'and story). Say what they keep from it and where their game departs.',
    ...(STYLISH.includes(railOf(id).handles.pole) ? ['Locked, it lays a stylish starter (its kit, its meter, the citadel, a look): what each part is and the words that change it, gameworld-stylish.'] : []),
    '',
    `seen: ${S.seen.length ? seenSays(S.seen) : 'as its page lays it'}${S.seen.length > 1 ? ' (a choice: ask which)' : ''}.   first: ${S.level1}.`,
    ...S.sizes.map((z) => `  ${z.size.padEnd(9)}${z.door}   ${set(z.with)}`),
    '',
    `ITS TUNINGS${S.from ? ` (its own cube, '${S.from}'; each value theirs to change)` : ''}:`,
    `  level      ${set(S.tunings.level)}`,
    `  action     ${set(S.tunings.action)}`,
    `  character  ${set(S.tunings.character)}`,
    `  world      ${set(S.tunings.world)}`,
    ...(S.gaps ? [`not built yet in its own cube: ${S.gaps.map((g) => `${g.facet}.${g.setting} '${g.value}' (${g.status})`).join(', ')}.`,
      S.starts && S.starts !== S.from ? `so a designed game starts from '${S.starts}' today and changes the values that differ: say so before it is built.` : 'so it is not laid as a designed game yet.'] : []),
    ...(S.asks.length ? [`what it asks of a world: ${S.asks.join(', ')}.`] : []),
    ...(S.labours.length ? [`labours that suit it (gameworld-brief; any may be mixed): ${S.labours.join(', ')}.`] : []),
    '',
    'THE CHAIN, by size (pull a step\'s card when it is reached, not before):',
    ...S.chain.flatMap((c) => [`  ${c.size}:`, ...c.steps.map((st, i) => `    ${i + 1}. ${st.step.padEnd(12)}${st.does}${st.card ? `  (${st.card})` : ''}`)]),
    ...(S.lacks.length ? ['', 'WHAT IT DOES NOT DO YET (say it when the ask reaches for it):', ...S.lacks.map((l) => `  ${l}`)] : []),
    ...(S.kinds ? ['', 'ITS LEVEL KINDS (a game is kinds in an order, the brief\'s; pick one by name, its laws are its proof):',
      ...S.kinds.flatMap((k) => [`  ${levelKindLine(k)}`, `             teaches ${k.teaches.join(', ')}; laws: ${k.laws.join('; ')}${k.example ? `; made in ${k.example}` : ''}`])] : []),
    ...(S.variants ? ['', 'ITS VARIANTS (the ask\'s words name one: pull its own sheet, its chain asks its own question first):',
      ...S.variants.map((v) => `  ${v.name}: ${v.like} (gameworld-rail-${S.id}-${v.id}; the pitch's rail: { from: '${S.id}', variant: '${v.id}' })`)] : []),
  );
}

/** The rails' shape (`gameworld-rails`) or one rail's sheet (`gameworld-rail-<id>`), or null. Served by id, not listed. */
export function railCardById(id) {
  if (id === 'gameworld-rails') return { id, name: 'The rails', summary: 'the game types mojulo builds, each a template a person\'s game starts from; the size called first', when: 'what kind of game, which template, a game like one I know, how big a game', scope: 'rail', body: railsCard() };
  const at = typeof id === 'string' && id.startsWith('gameworld-rail-') ? id.slice('gameworld-rail-'.length) : null;
  if (!at) return null;
  // (a rail's variant: `gameworld-rail-<rail>-<variant>`)
  const rail = RAIL_IDS.includes(at) ? at : RAIL_IDS.find((r) => at.startsWith(`${r}-`) && railOf(r).variants?.[at.slice(r.length + 1)]);
  if (!rail) return null;
  const variant = rail === at ? null : at.slice(rail.length + 1), S = variant ? variantOf(rail, variant) : railOf(rail);
  return { id, name: `The rail: ${S.name}`, summary: S.like, when: `a game started from ${S.name}`, scope: 'rail', body: railCard(rail, variant) };
}

/** One genre's card by id (`gameworld-intent-<genre>`), or null. Served by id, not listed with the rail. */
export function genreCardById(id) {
  const genre = typeof id === 'string' && id.startsWith('gameworld-intent-') ? id.slice('gameworld-intent-'.length) : null;
  if (!genre || !Object.prototype.hasOwnProperty.call(GENRES, genre)) return null;
  return { id, name: `What game it is: ${GENRES[genre].name}`, summary: GENRES[genre].why, when: `a ${GENRES[genre].name.toLowerCase()} game`, scope: 'rail', body: genreCard(genre) };
}

// THE SUPERVILLAINS (brawl/brawl-villains.js VILLAINS, brawl-crowd.js the idioms on the street): generated from the shelf,
// so a new villain, idiom word or henchman is in the card
function villainsCard() {
  const line = (k) => { const v = VILLAINS[k]; return `  ${k} (${v.idiom}, ${v.power}): ${v.reads}. Beat: ${v.beat}.`; };
  const hench = ['caster', 'drone', 'blaster'].filter((t) => CROWD_TYPES[t]);
  return lines(
    'SUPERVILLAINS: who a superhero street ends on. Each is a ROW OF THE FOE SHELF\'S IDIOMS as the street plays them (docs/foes.md):',
    '  summoner  calls its summons a few at a time; bound ones are cut down when it falls',
    '  pair      two bosses as one; one down, the other enrages (the best CPU, untouchable a moment)',
    '  modes     an act\'s form: defeated into another fighter (its moves and power), its health carried on',
    '  stages    acts begun as its health falls, each calling henchmen in; pursuer: always running you down',
    '',
    'THE SHELF (kind, its idiom and power):',
    ...VILLAIN_KINDS.map(line),
    `LIEUTENANTS hold the campaign's streets on the way, in turn: ${LIEUTENANT_KINDS.map((k) => `${k} (${VILLAINS[k].idiom})`).join(', ')}.`,
    `HENCHMEN (crowd types): ${hench.map((t) => `${t}: ${CROWD_TYPES[t].says}`).join('; ')}.`,
    '',
    `DESIGN ONE (quick.heroes.villain: { kind, design, power?, name? }; design over the kind's row): ${VILLAIN_WORDS.filter((w) => w !== 'kind').join(', ')}.`,
    '  summons { type, n? 1..4 at once, every? frames, bound? }; pair { archetype, power, name?, down? enrage | none }',
    '  stages [{ at?, name?, cpu?, calls?: { <crowd type>: n }, form?: { archetype, power, name? } }]: 2..5, the first as it comes in',
    '  henchmen [{ type, n }] stand with it; archetype all-rounder | rushdown | zoner | grappler; any power, designed too.',
    '  e.g. { kind: \'mastermind\', design: { summons: { type: \'blaster\', n: 3 } }, power: \'storm\', name: \'Doctor Umbra\' }',
    'Every word is read when the game is designed; a fault says where it belongs.',
    '',
    'A DESIGNED GAME\'S BESTIARY plays its idioms on a street too: a summoner (class) calls its `summons` entry; a boss\'s',
    '`pair` stands beside it (a pair that revives enrages instead: said); each entry it `becomes` is an act\'s form.',
    'MEASURED (brawl-playthrough.js `hero`, the villains deep test): one hero wins the lair against a villain of each idiom, the idiom seen.',
  );
}

// THE SUPERHERO BEAT-EM-UP (brawl/brawl-powers.js, brawl-tunings.js `heroes`, quick.js readHeroes): generated from the
// shelves, so a new power, villain or team member is in the card
function heroesCard() {
  const D = Object.entries(POWER_DIALS).map(([k, d]) => `${k} ${d.min}..${d.max}${d.round ? '*' : ''}`).join(', ');
  return lines(
    'THE SUPERHERO BEAT-EM-UP: the side-scroll beat-em-up tuned for heroes. Every player a hero with ONE power on the special',
    `(S; a few uses a life), an army that drops in, five falls. A CAMPAIGN (${HERO_CAMPAIGN.map((c) => c.id).join(', ')}) climbs to the villain;`,
    'an arcade front (attract, title, end card, credits); their own streets replace it.',
    'A power called up is a SUPER BEAT: the street holds a moment, the air round the caster marked.',
    `EARTH (${POWER_IDS.filter((id) => POWERS[id].wall).join(', ')}): S raises a slab as cover, S again shoves it (free).`,
    `AIR: ${POWER_IDS.filter((id) => POWERS[id].float).join(', ')} carry their hero (it floats: drifts, glides, no footing).`,
    `Its ENERGY is rupa's knockback (light bodies fly, heavy ones stagger): ${POWER_IDS.filter((id) => POWERS[id].knock).map((id) => `${id} ${POWERS[id].knock.kinetic ? 'pushes' : 'lands'}`).join(', ')}.`,
    '',
    'ASK FIRST, before making it (the heroes and their powers are the person\'s to design; offer the defaults if they have none):',
    '  1. who the heroes are (1..4): a name and a sentence each (who they are, their hair, a cape?), or ones made',
    '  2. each hero\'s power: what it does (pick the nearest kind below), what it is called, what it looks like, how strong',
    '  3. the villain and its power; the army (a crew of the comic pack)',
    '',
    'POWER KINDS (each a card): ' + POWER_IDS.map((id) => `${id} (${POWERS[id].stock})`).join(', ') + '.',
    ...POWER_IDS.map((id) => `  ${id}: ${POWERS[id].says}`),
    `A DESIGNED POWER: { kind, name?, beam? (its look: ${BEAM_NAMES.join(', ')}), stock? 1..9, ${D} } (* a round's kinds only).`,
    `  screen?: its SUPER BEAT round the caster (${POWER_SCREENS.join(' | ')}; each kind has its own). float?: carried on the air.`,
    '  e.g. { kind: \'beam\', name: \'Solar lance\', beam: \'laser\', strength: 120 }. Far off its kind\'s measure: advised.',
    '',
    'QUICK (one call, by streets): design_game({ quick: { goal: \'brawl\', heroes: true | { team?, villain? } } })',
    '  team: 1..4 in seat order, each a power or a hero: { name?, brief?, archetype?, build?, age?, pole?, role?, power?, style?, look?, spec? }',
    '    a brief, no member: their OWN hero rolled from it; hair and cape read from it ("long white hair, a cape")',
    `    or look: { ${LOOK_WORDS.join(', ')} }; spec: ANY create_character hero words, over all (checked at design).`,
    `    hero: { ref }: one made with create_character; member: one of the pack. Unsaid: ${HERO_TEAM.map((t) => `${t.member} ${t.power}`).join(', ')}.`,
    `  villain: ${Object.keys(HERO_VILLAINS).join(' | ')} or { member | hero, kind?, design?, power?, name?, look?, spec? } (gameworld-villains).`,
    '  "A superhero beat em up ..." in a sentence lays this tuning (then design the heroes).',
    'DESIGNED: a street level: tuning: \'heroes\', powers?: [<power> | null] in seat order (unsaid: the hero\'s own actions page',
    '  attack, the rest the team\'s). Its seats the game\'s hero and those who join; its crowd the game\'s own foes.',
    '',
    'MEASURED (brawl-playthrough.js `hero`): one hero wins each campaign street; a designed power is not; nobody played it.',
  );
}

// THE SIDE-SCROLL MAP (brawl/brawl-dress.js): generated from the shelves, so a new setting, set or piece is in the card
const sideScrollCard = () => {
  const wrap = (label, words, width = 112) => { const out = []; let line = label; for (const w of words) { if ((line + ' ' + w).length > width) { out.push(line); line = '    ' + w; } else line += (line.trim().length === label.trim().length && line === label ? '' : ' ') + w; } out.push(line); return out; };
  const floor = DRESS_PIECE_IDS.filter((id) => !DRESS_PIECES[id].wall), marks = DRESS_PIECE_IDS.filter((id) => DRESS_PIECES[id].wall);
  return [
    'THE SIDE-SCROLL MAP: a belt seen from one side (a brawl\'s street; docs/side-scroll-map-principles.md).',
    'A map is DRESSED: beside the band, a set a screen, in a SETTING (the kind of place).',
    '',
    'THE PRINCIPLES (measured, advised; dressLaws):',
    '  the band low, the backdrop over it (a dressed map takes the belt\'s `street` angle)',
    '  nothing between the camera and the fight over a body\'s waist; the dress stands OUTSIDE the band',
    '  a screen is a place: no two running alike; the turn tells a story; the boss\'s screen is HELD (its marks, its colour)',
    '  layers: floor things AND wall marks, something overhead, a way through; no long bare run',
    '  a mark belongs to one building or bay; a set draws on several different things',
    '  wear is the place\'s own matter (skandart), its vessels in groups, some tipped or broken',
    '  the walk may BEND (rise, turn, drift) and still scrolls sideways; a bend is where the map turns a page',
    '',
    'SETTINGS (each its sets, and the turn unsaid: way in → held screens → the boss\'s):',
    ...DRESS_SETTING_IDS.map((id) => { const S = DRESS_SETTINGS[id], T = S.turn; return `  ${id}   ${S.sets.join(', ')}   (${T.way} → ${T.held.join(', ')} → ${T.boss})${S.kits.length ? `   kits: ${S.kits.join(', ')}` : ''}`; }),
    '',
    'IN A DESIGNED GAME a level is a street (gameworld-quick-brawl: its stops, its boss, its crowd the world\'s cast):',
    '  levels.<id>.street: true | { …the street, ground?: <a level, below>, things?, scenes?: { … } | false }',
    '    ground: its place in a kit\'s stead (a town, a stage, a blockout, dressed and bent), the stops laid along it;',
    '    on a ground its play\'s things and the starter\'s scenes are laid unless said',
    '',
    `PLAYED by a play type (\`play\`: ${PLAY_IDS.join(' | ')}; on a quick brawl or one of its streets; a street level by guns). gun: the gunner\'s`,
    '  kit, guns? (asked), grenades?; unsaid: shooters, cover, gun crates. An ungated screen\'s wave is fought on the move',
    'MEASURED: the readout fights each map with bots (the fight laws); a `fight` step names the wave',
    '',
    'A LEVEL (a quick brawl\'s streets[i].level, or brawlLevel):',
    '  { kind: \'town\', fronts?: \'rough\' | \'broken\', dress?: false | { sets?, colour?, seed? } }   a street',
    '  { kind: \'stage\', kit, dress?: false | { setting?, sets?, colour?, seed?, kit? } }   a building\'s rooms; a kit',
    '    with its own setting is dressed as it unsaid; any kit takes one said',
    '  THE WALK BENDS, in any place (a room turns as a street does), by three words on a level (a belt\'s own):',
    '    rise:  [[s, z], …]   the floor\'s height along the walk; the camera rises with it',
    '           (a town: climb: grade, to 0.1)',
    '    turn:  [[s, degrees], …]   the view swings down the walk (under 0, the other way), to 55°',
    '    drift: [[s, n], …]   the band slides across the walk\'s line, the view following: a diagonal',
    '    it plays straight and level, drawn bent',
    '    the place goes with the walk',
    '  sets: one a screen: a set\'s name, null (bare), or A SET OF ITS OWN:',
    '    { says?, far: { piece: weight }, wall?: { piece: weight }, gap?: [m, m], marks?: [m, m], near?: { piece: weight } }',
    '  colour: the holder\'s (#rrggbb): on its marks; a quick brawl gives its crowd\'s',
    '',
    ...wrap('FLOOR PIECES:', floor.map((id, i) => id + (i < floor.length - 1 ? ',' : ''))),
    ...wrap('WALL MARKS:', marks.map((id, i) => id + (i < marks.length - 1 ? ',' : ''))),
    '',
    'A new kind of place is rows (a setting, its sets, its pieces) in brawl-dress.js; see it without a fight:',
    '  node scripts/spikes/brawler/street.mjs --tour --level \'{"kind":"stage","kit":"bay-military"}\'',
  ].join('\n');
};

// THE FLIGHT (flight-goal.js): what an airspace level is flown for, the one reading both doors share
const flightCard = () => [
  'THE FLIGHT — an airspace level (levels.<id>.airspace: a map, its ground, its space, its course) is flown for its',
  'goal: levels.<id>.goal = { flight }. The quick door\'s flights read the same goal (quick fly: a course; quick shoot with',
  'a craft: a dogfight, or a trench run on a trench).',
  '',
  'GOALS (flight):',
  "  'course'   the course's gates in three dimensions, then the landing, against the clock (airspace.course)",
  "  'dogfight' | { dogfight: { foes?, waves? } }   a wing shot down; the craft's hp takes their hits, a crash comes back",
  "  'trench'   the trench flown to its port, the port shot (airspace.space: { trench: true })",
  "  'stage'    an arcade stage down a rail (airspace.rail): its waves met, its hazards passed, its boss shot down",
  "  { sortie: { groups, goals } }   a cockpit's mission (airspace.cockpit, the gameworld-cockpit card)",
  "  { tasks: [ … ], crash?: 'fail' | 'respawn' }   a lesson, a sortie: tasks done in order (game/objectives.js)",
  'No goal: an airspace with a course is flown as one, with a trench as a trench run; else to its exit.',
  'The craft is drawn as its class\'s airframe off the craft shelf (a trainer a light single, a jet a jet fighter, the',
  "space fighter a strike foil); airspace.airframe names another (any of the shelf's archetypes), or false for a slab.",
  'Its land: airspace.ground.country = true | { metro?, towns?, villages? } (farms, woods, roads, geocities, pylons).',
  '',
  'TASKS (each may carry text: what the player is told; a plain one is written when absent):',
  '  { gates: true | [from, to] }   the course\'s gates in order (from 1); one flown out of turn does nothing',
  '  { land: true }                 set down soft on a runway or a pad (ground.pads); a hard one, or one off them, crashes',
  '  { band: { alt?, agl?, speed?, climb?, bank?, heading?, height?, turn? }, seconds, total? }   held in the band, the',
  '                                 HUD\'s units (m, m, knots, m/s, degrees, compass degrees); [min, max], null for open;',
  '                                 a heading wraps through north (min above max); leaving starts the clock again (total:',
  '                                 adds up); height is m over the runway and turn degrees from its heading (right +),',
  '                                 so a lesson holds on any seed\'s map',
  '  { reach: [x, y, z] | { gate: n }, radius? }   a nav point',
  '  { down: n | true }             the next n fighters shot down (true: a wing), asleep until the task wakes them',
  "A crash: 'fail' ends the attempt (a lesson's: the default with no fighters); 'respawn' brings the craft back at the",
  "start, costing hp (the default with fighters, whose hits the level's hp takes too).",
  'grade: { time?, slip?, sink? } each [gold, silver, bronze], least best: a medal for the time, the seconds out of a',
  'band once it was reached, the landing\'s sink (m/s); kept and shown by its name. A run flies each task list with a',
  'careful student (flight_proof: won, its medal). Pilot School (the rail pilot-school) is lessons laid this way.',
  '',
  'A STAGE (airspace.rail: true | { speed?, waves? }; goal \'stage\'): flight as a concept. The craft rides a path, steered',
  'about it in a box (A / D, Space / Shift; W boost, S brake, Q / E roll); the ground a floor, never a crash. On a planet',
  '(map.form \'canyon\') down a gorge, pillars in it; in space through rocks. Waves wake as it passes their marks and',
  'hold station ahead, firing rounds it can dodge; a shield bar; a boss at the end. flight_proof flies each with an',
  'attentive player and a still one. Wolf Squadron (rail wolf-squadron) is stages laid this way.',
  '',
  'A COCKPIT (airspace.cockpit: true, in space): the 90s space-combat sims\' craft flown from its seat, its goal a sortie:',
  'the gameworld-cockpit card.',
  '',
  'A FIRST LESSON:',
  "  levels: { 'lesson-1': { name: 'Climb out', airspace: { map: { craft: 'trainer' }, ground: { pads: [{ kind: 'runway', at: [0.5, 0.25] }] }, course: true },",
  "    goal: { flight: { tasks: [{ gates: [1, 2], text: 'Take off and fly the first two gates' },",
  "      { band: { alt: [250, 350], heading: [80, 100] }, seconds: 15, text: 'Level off at 300 m, heading 090' }, { land: true }] } } } }",
].join('\n');

const cockpitCard = () => [
  'THE COCKPIT — a space combat sim\'s level (airspace: { cockpit: true, airframe? } in space), flown from the seat in the',
  '90s register: the mouse flies, A / D roll, W / S move the throttle (a setting; Backspace stop, \\ full, [ ] thirds, Enter',
  'the target\'s speed); shields fore and aft over the hull; the generator, the core resource: its power ticks out each',
  'second, routed by the pips to lasers, shields or engines (1 to 4), a full pool\'s share redirected to the other, 5 / 6 a',
  'transfer at once to the lasers or the shields; the cannons linked (X); the target picked (R nearest, T next, E the attacker, U the mission\'s), bracketed with its lead pip and read on the',
  'targeting computer; fore and aft sensors; C out to the chase. Its instruments are a dark cockpit: normal in the one',
  'phosphor, the target magenta, friends cyan, hostiles red, a low pool amber, a pool gone red with the master lamps',
  '(docs/cockpit-instruments.md). The view is the cockpit: its canopy\'s frame and its',
  'instrument panel (a fifth of the screen and more), each craft its own (skyscape/cockpits.js):',
  '  strikeFoil (general) · arrowInterceptor (speed) · heavyFighter (firepower) · twinPanel (the other side\'s, no shields)',
  'each its tuning (speed, turning, hull, shields, cannons, generator) and its cockpit; another craft flies the general one\'s.',
  '',
  'ITS GOAL, A SORTIE: goal: { flight: { sortie: { groups, goals } } }',
  '  groups: [{ id, name?, craft? (a shelf archetype), count? (1-6), side: friend | foe, arrive?: start | { after } |',
  '          { down: <group>, after? } (+ say), at?: { ahead, side, up }, shields?, hull?, hold? (transports: unarmed) }]',
  '  goals:  [{ destroy: <group> | [..] } | { protect: <group> | [..] } | { survive: s }] (+ say), met in any order',
  'Friends are minds that hunt the foes, foes hunt the pilot\'s side, each drawn as its shelf airframe and named, each',
  'routing its own generator (shields up under fire, weapons hot on its run in, running as it breaks off). A run',
  'flies each mission with a steady pilot and a still one (flight_proof: won by the first, lost by the second). Rebel',
  'Storm (the rail rebel-storm) is missions laid this way.',
  '',
  'A FIRST MISSION:',
  "  levels: { 'mission-1': { name: 'Patrol', airspace: { map: { craft: 'fighter' }, space: { asteroids: 'sparse' }, airframe: 'strikeFoil', cockpit: true },",
  "    goal: { flight: { sortie: { groups: [{ id: 'red', side: 'friend', count: 2 }, { id: 'fighter', side: 'foe', count: 4 },",
  "      { id: 'interceptor', side: 'foe', craft: 'daggerInterceptor', arrive: { down: 'fighter', after: 3 } }], goals: [{ destroy: ['fighter', 'interceptor'] }] } } } } }",
].join('\n');

const CARDS = [
  ['gameworld-guide', 'The game book', 'the loop and the principles: design a game top down, then let design_game make it', 'make a game, design a game, a game with a hero and powers, where do I start', guide],
  ['gameworld-studio', 'The studio', 'the book worked a chapter at a time: the departments in waves, a chapter\'s session, the build', 'a big game, many levels, several departments, who does what and in what order, subagents, a team of agents', studioCard],
  ['gameworld-ledger', 'The ledger', 'a game made one unit at a time: a req per chapter or level, its jobs for agents, its received gate, the game built up to the last accepted level', 'one level at a time, requisition, req, remit, precedent, subagents, jobs, author, diverge, critic, probe, received, accepted, composite', ledgerCard],
  ['gameworld-producer', 'The producer', 'the seat that faces the creator: what they brought (drawings, plans, docs), the rail their game starts from and its size, the pitch said back and locked, the hand-off to the director; one question a turn', 'I have a design doc, here are my sketches, turn my notes into a game, I drew a map, my game plan, where do we start, who does what, producer, planner', producerCard],
  ['gameworld-main-quest', 'The main quest', 'the game\'s spine: acts of beats, each played as a level, a dungeon, an open world, a gauntlet, an errand; the core loop', 'a long game, an RPG, a campaign, the story from start to end, acts, how long is the game, beginning middle and end, the core loop', mainQuestCard],
  ['gameworld-quick', 'The quick path', `one level and a simple goal in one call: ${Object.keys(QUICK_GOALS).join(', ')}`, 'a simple game, a platformer level, collect coins, reach the exit, survive for a minute, a race against the clock, a kart race against rivals, a stealth level, a rhythm game, drive a car, tower defence, a boulder puzzle, a farm, a turn-based fight, a shooter, a deathmatch with bots, a quick game', quickCard],
  ['gameworld-brief', 'The Game Brief', 'what the game is about, above its genre: the motivations and labours, and the orders they make for the composer', 'what my game is about, the story and its shape, save the princess, storm the citadel, catch them all', briefCard],
  ['gameworld-intent', 'What game it is', 'the cube the world is laid for: a genre to start from, and what each value asks of the world', 'a shooter, a farming game, a racing game, what kind of game, genre, game type', intentCard],
  ['gameworld-world', 'The world', 'the ground, its levels, kits, civilizations and links', 'the levels of my game, where it happens', worldCard],
  ['gameworld-wcd', 'The walled-core dungeon', 'layers on a critical path toward a core: inners, outers and the doors between, each gated', 'a dungeon of layers to the core, a base to infiltrate, keycards to the next area, walls within walls', wcdCard],
  ['gameworld-course', 'The course', 'a platformer\'s level: floors and gaps over a trail sized by the hero\'s reach, each teaching a move', 'a platformer level, a side-scroller, a 3D platformer, jumps over gaps, a tutorial level, teach the double jump, a wall jump section, platforming, level 1', courseCard],
  ['gameworld-mission', 'The mission', 'a shooter\'s first level: the firing range stretched into sections, each with a task, on mana-ui', 'a first level for my shooter, a mission with objectives, an FPS level, clear the room then move on, a tutorial level for the guns, hold the point then extract, level 1 of my shooter', missionCard],
  ['gameworld-flight', 'The flight', 'what an airspace level is flown for: a course, a dogfight, a trench, an arcade stage down a rail, or a lesson\'s or a sortie\'s tasks in order (gates, a band held, a landing, nav points, wings)', 'a flight lesson, take off and land, fly the gates, hold an altitude, a flight school, a sortie, shoot down the fighters, a flight level with objectives, a mission in the air, an on-rails shooter stage, a canyon run, an asteroid field stage', flightCard],
  ['gameworld-cockpit', 'The cockpit', 'a space combat sim\'s level: a starfighter flown from its cockpit (throttle, targeting, shields and power), its mission a sortie of flight groups and goals', 'a cockpit, a space combat sim, an x-wing like mission, flight groups, wingmen, escort the convoy, destroy the bombers, protect the transport, a space combat mission, shields and power, targeting computer', cockpitCard],
  ['gameworld-qow', 'The quest open world', 'regions joined sideways, loaded as they are passed, never gated on the way on: the WCD\'s opposite pole', 'an open world, a city to roam, an island to explore, side quests anywhere, no forced path, an errand, a fetch quest, a delivery run, a bounty board', qowCard],
  ['gameworld-direction', 'The direction', 'how characters are drawn: tradition, elements, motif', 'anime or western, the colours of my hero', directionCard],
  ['gameworld-looks', 'The looks', 'the hero bare: body, head, hair, colour and the underlayer', 'what my hero looks like', looksCard],
  ['gameworld-motion', 'The motion', 'how the hero feels to move: vibe words on four axes', 'make my hero feel heavy, bouncy, bold', motionCard],
  ['gameworld-feel', 'The feel', 'how the controls play: a game template (the run, the jump, its windows) lowered onto the hero', 'play like Mega Man X, a Devil May Cry feel, a Souls-like weight, a Mario jump, tighter controls, floatier jump, coyote time', feelCard],
  ['gameworld-stylish', 'The stylish game', 'a character action game: what its rail lays (the kit, the meter, the citadel, the look) and the words that change each', 'a Devil May Cry like game, a stylish action game, a character action game, a style meter, a devil trigger, a second weapon, combos and launchers, a hack and slash', stylishCard],
  ['gameworld-colour', 'The colour', 'the game coloured as a whole: its land and the cast on it, measured, and the ways it could go', 'what colours should my game be, the enemies blend into the grass, make the hero stand out, colour options for my game, recolour the world', colourCard],
  ['gameworld-sound', 'The sound', 'the sound sheet: which SFX shelf sound plays each thing the game does, solved from the game and overridden by word', 'sound effects for my game, footsteps, sword swings, gunshots, a monster\'s roar, an engine, make my game sound, SFX', soundCard],
  ['gameworld-music', 'The music', 'the audio direction and the cue sheet: the game\'s taste in sound, and a cue for every place that asks for music, on one identity', 'music for my game, a soundtrack, boss music, level music, a score, the game\'s sound direction, orchestral or electronic', musicCard],
  ['gameworld-juice', 'The juice', 'how its effects are drawn and timed: its register (anime | western) and its game type', 'anime-style hit effects, punchier impacts, western explosions, snappier effects, effects on twos, a cartoon boop', juiceCard],
  ['gameworld-interface', 'The interface', 'the menus, the front and the HUD, and their look: a register the art director picks, the colour theorist\'s palette, a theme card or a child theme, the game\'s languages', 'the menus of my game, the UI look, a pause menu like Persona, a souls-like menu, a darker HUD, a language picker, my game in Japanese and Spanish, a theme for my game\'s UI', interfaceCard],
  ['gameworld-actions', 'The actions', 'what the hero can do; it decides the systems', 'my hero\'s powers, a metroidvania, a soulslike', actionsCard],
  ['gameworld-adornment', 'The adornment', 'what the hero carries, and why', 'my hero\'s weapon, what she carries', adornmentCard],
  ['gameworld-equipment', 'The equipment', 'the gear classes in one gear language', 'the weapons in my game, a gear set', equipmentCard],
  ['gameworld-systems', 'The systems', 'the numbers and the HUD, derived from the actions', 'stats, levels, a skill tree, the HUD', systemsCard],
  ['gameworld-roll', 'The roll', 'a different map each time: what a level\'s seed picks on it (cover, items, the start, a paced line), an obstacle course for a running game, a run of its maps', 'a different map every time, a roguelite, random levels, procedural, replayable, the level changes each run, an obstacle course, an endless runner with a finish, hurdles to jump, lanes to switch', rollCard],
  ['gameworld-course-dress', 'The course\'s dress', 'how an obstacle course looks: its way and asks, the walls beside it and the backdrop behind it, designed as one dress by role and held to one gate; the course sheet', 'the walls of the course, the background, the backdrop, the skyline, decorate the course, style the level, the sides of the track, scenery, the look of the runner, palette of the course', courseDressCard],
  ['gameworld-side-scroll', 'The side-scroll map', 'a belt seen from one side, dressed as a place: its principles, its settings (a street, a facility, a base, an office), a set a screen, a set of the agent\'s own', 'a beat \'em up level, a side-scrolling stage, a street to fight down, a warehouse level, a military base level, an office level, dress the street, what makes a good brawler stage', sideScrollCard],
  ['gameworld-heroes', 'The superhero beat-em-up', 'a team of heroes, each its power on its own button with a few uses a life, against an army and a villain with powers: a beat-em-up tuned for heroes', 'a superhero beat em up, heroes with powers, mutants against an army, an X-Men style arcade brawler, a team of heroes', heroesCard],
  ['gameworld-villains', 'Supervillains', 'the bosses a superhero street ends on, each a row of the foe shelf\'s idioms (a summoner, a pair, a form it is defeated into, acts that call henchmen), and how to design one', 'a supervillain, a boss that summons, twin bosses, a boss with a second form, the villain at the end, henchmen', villainsCard],
  ['gameworld-track-language', 'The track\'s language', 'how a raced track looks: one design language for its way, kerbs, rail, flags, trees and sky, and the principles a new map starts from', 'design a race track, a new kart map, the look of the track, track theme, the barriers and kerbs, a candy track, decorate the circuit, track materials, make the road more interesting, the sky over the track', trackLanguageCard],
  ['gameworld-hijack-city', 'Hijack City', 'the open city\'s crime game, a starter for a GTA-like: a district, cars to take, missions, the law, shops', 'a gta-like game, grand theft auto, an open world crime game, steal cars, a wanted level, police chases, a crime sandbox, hijack city, a city to drive around and cause trouble', hijackCityCard],
  ['gameworld-mounts', 'The mounts', 'horses the hero gets on and rides: their coats, where they stand, the ride', 'a horse to ride, mount a horse, ride a horse, horseback, get on my horse, a stable of horses, cavalry, a car to drive, get in a car, a parked car, drive around town', mountsCard],
  ['gameworld-battles', 'The battles', 'party battles turn by turn: classes the party switches, packs along the way, carried level to level', 'a JRPG, turn-based battles, a party of classes, a job system, class switching, a skill tree, random encounters, a boss fight, minigames, a fishing minigame, an arcade in the inn', battlesCard],
  ['gameworld-foes', 'The foes', 'hostile classes on the trails: how each moves, hurts and decides, at any rank, on any body that fits', 'enemies in my level, goombas, monsters to fight, a wolf pack, a boss beast, dire wolves, foot soldiers, a turret, things that chase me, a swarm of rats', foesCard],
  ['gameworld-story', 'The cast and the story', 'other people, and the moments they are in, bound to the world as it is built', 'a mayor who greets you, a story written first, characters in my levels, what happens where, dialogue choices, quests, a journal, a companion, a party member who joins, a cast rolled for my game, a party, a rival, a villain and his lieutenant, a familiar or summon, beastfolk or a mascot in the party', storyCard],
  ['gameworld-folk', 'The town\'s people', 'NPCs grown from a town\'s houses: their houses and faces, their talk, their sidequests, their day', 'villagers to talk to, a shopkeeper, townsfolk, NPCs with errands, side quests, the same nurse in every town', folkCard],
  ['gameworld-flow', 'The flow', 'what plays when, from the first screen to the credits: the default flow, the story\'s opening, prologue and ending in it, or a flow of the game\'s own', 'an opening cinematic, an intro before the title, a cutscene after New Game, the ending before the credits, the order of the screens and levels, an attract loop', flowCard],
  ['gameworld-next', 'The next moves', "design_game's readout steps: review, play, share, run, rerun, intent, feel, foes, wait, advice", 'what do I do next, approve the parts, is it playable', nextCard],
];
export const GAMEWORLD_CARD_IDS = Object.freeze(CARDS.map(([id]) => id));
export { SAMPLE_PAGES };

let cache = null;
export function gameworldCards() {
  if (cache) return cache;
  cache = new Map(CARDS.map(([id, name, summary, when, body]) => [id, { id, name, summary, when, scope: 'rail', body: body() }]));
  return cache;
}
