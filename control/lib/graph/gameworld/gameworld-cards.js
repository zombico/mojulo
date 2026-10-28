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
import { TRADITIONS, BRIDGE, FROM, LOOKS_ELEMENTS, CHARACTER_PART_IDS } from './characters.js';
import { ELEMENT_WORDS } from './element-words.js';
import { UNDERLAYERS } from './hero-looks.js';
import { AXES, VIBES } from './hero-vibe.js';
import { POLES, POLE_IDS, variantsOf } from './feel/cards.js';
import { feelCard as feelCardOf, lowerFeel } from './feel/lower.js';
import { GENRE_FEEL, FEEL_WORDS } from './feel/suggest.js';
import { IDIOMS, SYSTEM_KINDS, STAGES, TRAVERSAL_MOVES, HERO_MOVES } from './actions.js';
import { RAILS } from './adornment-kit.js';
import { TRADITIONS as FIGHT_TRADITIONS } from '../versus/versus-traditions.js';
import { CLASS_SLOTS } from './equipment.js';
import { SCALE, EPOCH_LEVEL, GAINED, GEAR_STAT, GEAR_BY } from './mechanics.js';
import { WORLD_STYLE, CIVILIZATION, LINK_KINDS, TOPOLOGIES } from './world.js';
import { MODES, STAMPS } from './review.js';
import { SAMPLE_PAGES, SAMPLE_MAX, DERIVE } from './samples.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { MARKED_ENGINES } from '../scene/engines/registry.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';
import { PROGRAM_IDS } from '../era/programs.js';
import { STAGE_KITS, resolveKitId, GROUND_KITS } from '../era/stage.js';
import { STRUCTURE_KITS } from '../era/out-structures.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { SEEDED_STYLES } from '../equipment/styles.js';
import { QUICK_GOALS, RHYTHM_MOODS, RACE, DEFEND, DEATHMATCH_MODES } from './quick.js';
import { CAMERAS } from './cameras.js';
import { FOE_CLASSES, classStatus } from '../foes/index.js';
import { MOVES, ATTACKS, STOMPS, FOE_RANKS } from '../foes/vocab.js';
import { SWARM, MAX_FOES, PAIR_DOWNS } from './foes.js';
import { VANISHES, SEVERS } from './vanish.js';
import { PEOPLE } from '../foes/people.js';
import { SCREENS, NEW_GAME_SCREEN } from '../game/screen.js';
import { SUPERCAR_LIBRARY } from '../car-designer/vehicle-library.js';
import { RACE_MOOD_IDS } from '../roads/race-mood.js';
import { VEHICLES, TUNINGS, CONDITIONS } from '../roads/vehicles.js';
import { COURSE_PRESETS } from '../roads/course.js';
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

const lines = (...xs) => xs.flat().join('\n');
const words = (o) => Object.keys(o).join(', ');
const pair = (page, a, b) => [
  'A CONTRAST PAIR (the same question, two briefs; what the book derives from each, computed now):',
  ...[a, b].map(([brief, fragment]) => [`  brief: "${brief}"`, `    ${page}: ${JSON.stringify(fragment)}`, `    derives: ${JSON.stringify(DERIVE[page](fragment))}`]).flat(),
];
const samples = (page) => `Browse more: get_game_vocab({ samples: '${page}', n?, seed? }) draws up to ${SAMPLE_MAX} random fragments of this page, brief-blind, each with what it derives.`;

function guide() {
  return lines(
    'THE GAME BOOK — design a game top down, then let the rail make it. You DESIGN; design_game makes, keeps and remakes.',
    '',
    'SIZE THE ASK first (you infer it). One level, a simple goal (reach, collect, survive, avoid), no powers, stats or',
    'progression: the QUICK path, one call; read gameworld-quick only. Several levels, no hero: COMPOSE,',
    '{ compose: { prompt } }, then run. A hero, powers, gear or a story: the book below.',
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
    '  patch ops are { op: \'set\' | \'remove\' | \'add\', path: \'/characters/hero/motion\', value } (JSON Pointer; no \'replace\').',
    '  A refusal names the field and the shape it wants.',
    '',
    'THE DOOR (design_game): { world } starts a gameworld (a sketch: update_sketch works on it too); { ref, patch } edits it by',
    '  part; { ref, approve, revise } are the creator\'s verdicts (revise { part, note } sends one back); { ref, run: true }',
    '  makes every ready step. A run keeps what did not move, remakes what did in place, leaves hand edits (force: true',
    '  overwrites). It answers each stamp, the steps, what was made and `next` step ids (gameworld-next); `readout:',
    '  \'changed\'` only what moved. `mode`: ' + Object.entries(MODES).map(([k, v]) => `${k} (${v})`).join('; ') + '.',
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
    '  goal?: { collect?: true | \'<pickup>\', boss?: true, health?: true, guards?: true }: what the level is played for, else its exit.',
    '  scenes: the level\'s directed moments (get_play_vocab({ id: \'ui-scenes\' })), each with stage?: \'<node>\' (its first stage by default);',
    '    the hero is \'hero\', the stage\'s places are spots (start, exit, pocket, pocket-2…, landmark…); scenes that read or set flags',
    '    (if, sets) ride a \'story\' flags slice from level to level.',
    `  or building: { use: ${PROGRAM_IDS.join(' | ')}, seed?, goal?, civilization? } | { ref } in place of the walk:`,
    '  a building played from its way in to its goal room. places.buildings: [{ use, at?, node?, goal? }] and places.street:',
    '  { houses?, enter?, goal? } stand buildings and a town\'s first houses on a trail, walked into (card game-building).',
    '  or city: { grammar?, civilization?, from?, to?, stalker?, … } (card city-plan), played by its segments (stalker: true, by the hero).',
    '  ground: the level\'s land on a grid of cells, its dials and edits (cliff, gorge, raise…): tune_ground.',
    `links: ${Object.entries(LINK_KINDS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    'front: the game\'s title, start menu and credits (card front).',
    `topology: ${Object.entries(TOPOLOGIES).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    '  in a map, a link may take key: \'<item>\', keyAt: \'<level>\': the item there opens it (a trail, or a city roof in reach);',
    '  a hero\'s power as the key also gives the hero its move.',
    `screen: ${Object.keys(SCREENS).join(' | ')} | { aspect } (a new game: ${NEW_GAME_SCREEN}).`,
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

function feelCard() {
  return lines(
    'THE FEEL — how the hero moves, as a game template: feel: \'<template>\' | { pole, variant?, toward?, t?, set? }.',
    'The template\'s card (the action lab\'s) is lowered over the hero\'s platform rule: the run and its acceleration, the',
    'jump\'s height and gravity up and down, coyote time and the buffer, the shortest hop, air control, the gather, air',
    'jumps, the 2D lane, the melee hitstop. design_game\'s readout says what the runtime carries of it, partly carries, and',
    'does not carry yet (the parry, the charge, offense armor, the roll\'s invincible frames, the runner): advice, never a refusal.',
    'The motion (gameworld-motion) is how the walk LOOKS; the feel is how the controls PLAY. Both may be set.',
    '',
    'templates (after · base feel · viewer):',
    ...POLE_IDS.map((id) => { const P = POLES[id], v = variantsOf(id); return `  ${id}  ${P.name} (after ${P.after}) · ${P.base} · ${P.view.camera}${v.length ? ` · variants ${v.join(', ')}` : ''}`; }),
    '',
    'toward + t tunes between two (every number blended, the rest the nearer\'s); set lays the card\'s own fields over it',
    '(ground { walk, run, sprint, accel, decel, turn }, jump { commit, height, gRise, gFall, cut, coyote, buffer, air }, air { jumps, mult }).',
    'The template\'s viewer is advice: the camera is the world\'s (camera, or the quick game\'s).',
    'DEFAULTS are suggested, never laid: a world plays the feel it writes. design_game\'s readout suggests one (a `feel`',
    'step) from the brief\'s words, a deathmatch\'s shooter pole, or the genre; a world composed from a prompt that names',
    'a template has it written. Each genre\'s is on its card (gameworld-intent-<genre>). A written feel wins over a',
    'quick game\'s own feet (a deathmatch\'s shooter pole).',
    `brief words: ${Object.entries(FEEL_WORDS).map(([p, w]) => `${p} (${w.slice(0, 3).join(', ')})`).join('; ')}.`,
    '',
    'A CONTRAST PAIR (two briefs; the hero rule each lowers to, computed now):',
    ...[['a Mega Man X style run and gun', 'galaxy-boy'], ['a platformer between Mario and Mega Man', { pole: 'jumping-giuseppe', toward: 'galaxy-boy', t: 0.4 }]].flatMap(([brief, f]) => {
      const L = lowerFeel(feelCardOf(f)), R = L.rule;
      return [`  brief: "${brief}"`, `    feel: ${JSON.stringify(f)}`, `    lowers to: run ${R.speed} m/s, jump ${R.jumpSpeed} m/s on ${R.gravity}/${R.fallGravity} m/s², coyote ${R.coyote} s, buffer ${R.buffer} s${R.airJumps ? `, ${R.airJumps} air jump` : ''}; not carried: ${L.lost.map((x) => x.field).join(', ')}`];
    }),
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
    'THE SYSTEMS — the numbers and the HUD, derived from the actions: mechanics { stats?, scale?, hud?, ui?, gear?, destruction? }.',
    '',
    `scale (the coarse dials): ${Object.entries(SCALE).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `stages → epochs reached by level: ${Object.entries(EPOCH_LEVEL).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `how a power is gained, by system kind: ${Object.entries(GAINED).map(([k, v]) => `${k}: ${v.why}`).join('; ')}.`,
    `what each class raises, by stage: ${Object.entries(GEAR_STAT).map(([k, v]) => `${k} ${v} ${GEAR_BY[v].join('/')}`).join(', ')}.`,
    'powers: { <power id>: { spends } }: what one power spends of the resource over the derived (0: free, a guard that',
    '  costs nothing); ledgered. The readout\'s `numbers` says the stats, the resource and what each power spends.',
    'destruction: how much the game lets break, never a default: none, objects (crates, barrels, pots), cover (furniture,',
    '  doors, boulders too) or world (walls as well); copied onto every level.',
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
    `  ride: ${Object.keys(RIDES).join(' | ')}   you drive it (W / S / A / D), followed from behind; no hero, climb or building`,
    `    vehicle: ${Object.keys(VEHICLES).join(' | ')}; tuning: ${TUNINGS.join(' | ')}; conditions: ${Object.keys(CONDITIONS).join(' | ')}`,
    '  rivals: n (1..7, with a ride)   a place to finish in, on the podium',
    '  racers: n (2..8) or a list (an archetype, a brief in words, or { archetype?, build?, age?, brief?, facets?, seed?, parts?, shade? }):',
    '    the whole field, yours first (no ride, hero or rivals beside it); shade: smooth bevels and smooth-lights a racer (cel by default)',
    `  supercars: n (2..8) or a list ({ preset?: ${Object.keys(SUPERCAR_LIBRARY).join(' | ')}, paint?, livery? }): a field of supercars, yours first, liveries solved to stand out`,
    `  mood: ${RACE_MOOD_IDS.join(' | ')} (with a roadway)   the light it is raced in: lamps after dark, rain and a wet road`,
    `  roadway: ${Object.keys(COURSE_PRESETS).join(' | ')} | a course spec | { intent: '<words>' }   the race's whole ground, in place of track (no track, climb, building or run beside it)`,
  ],
  sneak: () => [`  guards: n (1..8, 3), guard: ${HERO_WORDS}, alarms: n (1..9, 1)   sightings that end the run`],
  rhythm: () => [`  music: ${RHYTHM_MOODS.join(' | ')}   a field score with a steady beat; misses: n (1..99) presses off the beat that end it`],
  defend: () => [`  waves: n (1..${DEFEND.perWave.length}, 3), lives: n (1..20, 5), pads: n (1..8, 4), foe / tower: ${HERO_WORDS}   no climb, no building`,
    '  board: true | { cols?, rows?, gold? }: a TOWER DEFENCE on the stage\'s spots instead: towers (arrow, cannon, frost) on any',
    '  free spot that keeps the road open (the foes walk round them), waves 1..5, no hero, no pads'],
  puzzle: () => ['  boulders: n (1..4, 2)   no climb, building or ride'],
  farm: () => [`  plots: n (1..12, 6), target: gold (10..500, 40), days: n (2..30, 6), folk: n (0..6, 2), farmhand: ${HERO_WORDS}   a clock: night falls`],
  battle: () => [`  foes: n (3), foe: ${HERO_WORDS}`],
  fight: () => [
    '  roster (1..12): every fighter a CHARACTER, designed by the character loop. A sheet (an Egocube: egocube card) the run',
    '    makes into one: an archetype word, a brief in words, or { brief?, facets?, seed?, archetype?, role?, build?, age?,',
    '    name?, color? }; or { hero: { ref } }, one made with create_character. The fight is read off the sheet (role the',
    '    style, archetype and its shadow the signature, build heavy or light), the entry\'s own words over it: style',
    '    (grappler | rushdown | zoner | all-rounder), signature, weapon, library, normals, specials, super, tune, and',
    `    tradition (${Object.keys(FIGHT_TRADITIONS).join(' | ')}): how it stands and strikes, its punches and kicks in every`,
    '    slot (a tradition word alone is a fighter: a sheet rolled to fight that way). Not the drawing tradition (anime |',
    '    western): every sheet is rolled in the game\'s setting, its world\'s look, era and colours, a person every time.',
    '    Absent: four sheets, one per style. Revise a fighter with update_character; the fight follows on read',
    '  arenas: [{ id, name?, kit?, look?, width?, depth?, height?, crowd? }] (1..8)   the stage worlds it is fought on in 3D',
    '  rounds: n (1..3, 2) to win; timer: s (30..99, 99) a round; rules: { systems?: [parry | burst | guard], … } the sim\'s dials',
    '  its own simulation, seen from the side: only theme and camera side beside these (no hero, trail, building, ride or run)',
  ],
  shoot: () => [
    `  foes: n (4), foe: ${HERO_WORDS}   first person by default (or third-person); walls to take cover behind`,
    `  craft: ${Object.keys(CRAFT).join(' | ')}   a dogfight instead: waves: n of fighters, assist, airspace (as fly's); followed from behind`,
  ],
  deathmatch: () => [
    `  bots: n (1..7, 3), frags: n (1..50, 10), seconds: n (10..600) a time limit, foe: ${HERO_WORDS}`,
    '  arena: \'<words>\' ("a tight three-lane arena with long sightlines"), pole: realistic..stylized (0..1),',
    '    weapons: true (the pole\'s guns on the arena\'s floor; needs a pole)',
    `  mode: ${DEATHMATCH_MODES.join(' | ')}   two sides: team deathmatch, or a point held for time`,
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
    `  airspace: { map: { form: ${Object.keys(MAP_FORMS).join(' | ')} }, ground?, space?, course? }   space: { asteroids } for a space craft`,
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
  `  camera: ${Object.keys(CAMERAS).join(' | ')}   absent: third person with a hero, first person without; top-down and side need a hero`,
  `  screen: ${Object.keys(SCREENS).join(' | ')} | { pole?, aspect?, orientation?, fov? }   the screen it is for (absent: ${NEW_GAME_SCREEN})`,
  '  climb: true   a climb after the trail;   run: n   a pool of n + 2 trails, each run draws n, a death ends it',
  '  building: { use, seed?, goal?, … }   a building as the level (reach, collect or survive; card game-building)',
  '  cast: true | { scale?: hero | rival | party, n?, cast?, bodies?, … }   on foot: people rolled for the game (the casting',
  '    page, gameworld-story); party and familiars walk beside you and fight what you fight, a rival is the first foe',
  '  moves: true   every person made (hero, foes, guards) takes a blow on its own rig: hit, stagger, fall, rise',
  '  foe: { species }   battle and defend: the foes are a beast (a wolf pack) on its own gaits and reactions',
  `  theme: { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? }   the game shell's skin`,
  "  music: 'auto' | '<mood>', sfx: 'auto' | '<palette>'   a score per level, the goal's sounds",
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
    'THE BATTLES — party battles, turn by turn, laid on the book\'s levels: battles { on?, board?, party?, packs?, per?, boss?, foe?, rest?,',
    '  random?, classes?, skills?, foes?, items?, rules? }. Absent: no battles (a turn-based cube asks for them: the',
    '  encounters concern). The fights are play.rpg (get_play_vocab({ id: \'ui-cues\' }), PARTY BATTLES).',
    '',
    `party   the hero and each cast member who joins (characters.cast.<id>.joins), each a class: { hero: { class, name? },`,
    `        <cast id>: { class } }. Unnamed: the hero a fighter, those who join in turn ${JOINER_CLASSES.join(', ')};`,
    '        with characters.casting, the hero and its first party each the class their sheet reads as.',
    `        Classes: ${BATTLE_CLASSES.join(', ')}, or the world's own (classes). A member switches class on P, outside a`,
    '        fight; each class keeps its own rank, points and skill tree; learned skills stay.',
    `packs   the packs met along the way, walked in order across the game's trail stages (default: ${PACKS.slice(0, 3).map((p) => `[${p.join(', ')}]`).join(', ')} …);`,
    '        per: n on each trail stage (2), on its beats, as many as it has room for. boss: a pack, the last stage\'s',
    '        last, with no escape. foe: { <hero-door words> } how a foe stands on the map, or { species, ooze?, stylism? }:',
    '        a beast on its own gaits (a wolf pack, dire wolves); walk up to one to fight.',
    'rest    E at each stage\'s start restores HP and MP (rest: false for none). random: { every?, chance?, after? }',
    '        random fights on the trails, drawn from the stage\'s packs.',
    'gear    one item a slot (weapon, armor, accessory), its numbers on the member\'s; each class starts in its own; the',
    '        Equip tab (P) wears what the bag holds. gear: the world\'s own, { <item>: { slot, atk?, def?, …, classes? } }.',
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
    '        Or skin: { people, facets? }: a person (\'human\') or a people (' + PEOPLE.slice(1).join(', ') + '),',
    '        rolled in the world\'s setting in its class\'s role, made by the character loop with its moves, at its own height.',
    '        Or skin: { meshRef, height? }: a rigged humanoid .glb made elsewhere, bound onto that sketch, worn as a person.',
    'levels.<id>.foes   true (the bestiary; each class on its stand-in if the world keeps none) or { from?: [<id>],',
    '        count?, win?: exit | clear }: one foe on each free beat of a stage, cycling through from; clear: won when all fall;',
    `        count stands that many (up to ${MAX_FOES}), the extra round the beats. A swarm stands a pack of ${SWARM}. A stage they`,
    '        stand on makes the hero hittable, its hp taking their hits.',
    `rank    ${Object.entries(FOE_RANKS).map(([k, R]) => `${k} ×${R.downs}`).join(', ')}: the blows it takes; a boss duels.`,
    '        skill: novice, regular, veteran, ace: how well it carries out what it decided.',
    '',
    'CLASSES (built unless marked: what does not run yet is said):',
    ...Object.values(FOE_CLASSES).map(row),
    '',
    `MOVES   ${Object.keys(MOVES).join(', ')}; ATTACKS ${Object.keys(ATTACKS).join(', ')}.`,
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
    'A world or level without foes is laid as it was.',
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
    'characters.cast: { <id>: { name?, looks?, motion? } }: each person a looks page and a motion page, as the hero has',
    '  (no actions, adornment or gear: those are the player\'s), drawn in the same direction. design_game makes each one',
    '  after the hero, at <ref>-cast-<id>.',
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
    'SLOTS (a tactics book\'s): when: { slot: before | after } on a level, where: { epoch }, when: { slot: begin | end } on',
    '  an epoch\'s map; shots and effects on the board itself: get_game_vocab({ id: \'board\' }).',
    'The story names the world, never its coordinates: rebuild or reshape the world and each moment binds again. A moment',
    'that cannot find its level, stage, place or people is UNPLACED: design_game\'s readout lists it with what is missing',
    '(next: { step: \'story\' }) and the rest of the world builds. Fix the moment or the world, then run again.',
    'A beat may be a CHOICE: { choose: { who?, say?, options: [{ say?, sets?: [flag], beats? }] } }: the player answers,',
    '  the answer sets its flags at once and plays its beats; a later moment reads them (if: { flag }).',
    'quests: [{ id, name?, starts?: flag, steps: [{ log?, done: flag, moments?: [moment id] }] }]: every level keeps',
    '  the journal (J), its flags carried level to level. A moment in step n waits until step n - 1 is done (in step 1,',
    '  until the quest begins); its own if holds besides. A step\'s flag is set by a moment\'s sets, an answer, or a cue',
    '  (emit \'flag:<name>\'); one nothing in the story sets is listed in the readout\'s story.unset.',
    'A COMPANION: characters.cast.<id>.joins: \'<flag>\'. Once the flag is set (an answer: { say: \'Come with me.\', sets:',
    '  [\'joined-teodor\'] }) they follow the hero, there and in every level after (the escort behaviour: they keep near',
    '  and fight what is hittable and not their own). Before it they stand where the story puts them, or are not there.',
    'A casting page\'s first party and familiars walk beside the hero from the start (a joins flag on one makes it a',
    '  companion as above), and every rolled member plays its own moves on the field (its hit, its fall and rise, its',
    '  swing) over the library\'s walk; a beast, a mascot or a beast-kin below the hero door walks on its own gaits.',
  );
}

function nextCard() {
  return lines(
    'THE NEXT MOVES — design_game\'s readout ends with `next`: step ids, each with what it needs. What each asks:',
    '',
    '  review     gated: show the creator the bible, then approve or send back those `parts` ({ ref, approve: [...] } or',
    '             { ref, revise: { part, note } }). The verdicts are theirs, never yours.',
    '  advised    autonomous: the machine gate advises on those `parts`: change the page, or approve it as it stands.',
    '  play       the game is made: `url`. Its levels are walkable by construction (the hero spawns on each stage\'s ground,',
    '             its exit is the stage\'s own end); whether they can be beaten is the creator\'s to judge in play: nothing',
    '             proved it (`gate: eyes`). `playtest` plays it with every level open and nothing saved; ?level=<ref> opens one.',
    '  share      the game is complete: ask the creator how they want to share it before exporting anything. `can` is',
    '             what this host allows per option (here | carry | ask | no); the call that made the game carries the',
    '             whole offer (`share`: each option\'s call and why). Where nothing can leave the host, the recipe is the handoff.',
    '  run        run: true makes every step that is ready: the hero first; a world with no characters (a composed one), its levels and the game.',
    '  rerun      after a change, run again: what moved is remade, a hand edit is left (force: true overwrites it).',
    '  adornment  the page is empty: the bible proposes what the hero carries from the power verbs, with reasons; write',
    '             your own at `path` (gameworld-adornment); its items seed the equipment table.',
    '  intent     the world has not said what game it is: write intent (gameworld-intent); `suggest` names the genres',
    '             its brief\'s words point at. Until then its cube is read from what it says, and its concerns follow.',
    '             With `drift`: a quick goal now reads as another genre than the written one; keep it or change it.',
    '  target     the intent names an engine (intent.target) and `lost` are values it does not carry: advice, not a',
    '             refusal (gameworld-intent). Change one or keep it; the export says the same.',
    '  wait       step `on` waits on those parts (their stamps in brackets).',
    '  form       what the game it is asks and the world lacks (`asks`: for, field, by, says): a field `by: creator` is',
    '             theirs (the hero: ask who it is, never pick one), a `by: composer` field compose fills; run lays it after.',
    '  feel       no feel written: `suggest` is the template its brief, shooter pole or genre points at (`why`, `from`):',
  '             write it (feel: …) or leave the hero its own rule. Written, `lost` are card fields the runtime does not',
  '             carry yet: advice (gameworld-feel). Keep it, pick a template closer to what the runtime plays, or wait.',
  '  advice     read `advice`: a choice the brief does not explain, or one that reads as a fixture or a sample, is the',
    '             creator\'s to confirm.',
  );
}

function intentCard() {
  return lines(
    'WHAT GAME IT IS — intent: { from?, cube?, why?, target? }. Say it before the world: the levels are laid for it.',
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
    '',
    `TARGET — intent.target: ${MARKED_ENGINES.map((e) => `'${e}'`).join(' | ')} (alone, or beside from and cube): the engine the game`,
    'is meant for. ADVICE ONLY: the readout\'s intent.target lists the cube\'s values that engine does not carry (lost)',
    'and carries in part (partly), as its marks say; nothing is refused or rewritten, and dropping the target drops the',
    'advice. export_game { target } writes the game whatever it holds, and its portability report names the same losses.',
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

/** One genre's card by id (`gameworld-intent-<genre>`), or null. Served by id, not listed with the rail. */
export function genreCardById(id) {
  const genre = typeof id === 'string' && id.startsWith('gameworld-intent-') ? id.slice('gameworld-intent-'.length) : null;
  if (!genre || !Object.prototype.hasOwnProperty.call(GENRES, genre)) return null;
  return { id, name: `What game it is: ${GENRES[genre].name}`, summary: GENRES[genre].why, when: `a ${GENRES[genre].name.toLowerCase()} game`, scope: 'rail', body: genreCard(genre) };
}

const CARDS = [
  ['gameworld-guide', 'The game book', 'the loop and the principles: design a game top down, then let design_game make it', 'make a game, design a game, a game with a hero and powers, where do I start', guide],
  ['gameworld-quick', 'The quick path', `one level and a simple goal in one call: ${Object.keys(QUICK_GOALS).join(', ')}`, 'a simple game, a platformer level, collect coins, reach the exit, survive for a minute, a race against the clock, a kart race against rivals, a stealth level, a rhythm game, drive a car, tower defence, a boulder puzzle, a farm, a turn-based fight, a shooter, a deathmatch with bots, a quick game', quickCard],
  ['gameworld-intent', 'What game it is', 'the cube the world is laid for: a genre to start from, and what each value asks of the world', 'a shooter, a farming game, a racing game, what kind of game, genre, game type', intentCard],
  ['gameworld-world', 'The world', 'the ground, its levels, kits, civilizations and links', 'the levels of my game, where it happens', worldCard],
  ['gameworld-direction', 'The direction', 'how characters are drawn: tradition, elements, motif', 'anime or western, the colours of my hero', directionCard],
  ['gameworld-looks', 'The looks', 'the hero bare: body, head, hair, colour and the underlayer', 'what my hero looks like', looksCard],
  ['gameworld-motion', 'The motion', 'how the hero feels to move: vibe words on four axes', 'make my hero feel heavy, bouncy, bold', motionCard],
  ['gameworld-feel', 'The feel', 'how the controls play: a game template (the run, the jump, its windows) lowered onto the hero', 'play like Mega Man X, a Devil May Cry feel, a Souls-like weight, a Mario jump, tighter controls, floatier jump, coyote time', feelCard],
  ['gameworld-juice', 'The juice', 'how its effects are drawn and timed: its register (anime | western) and its game type', 'anime-style hit effects, punchier impacts, western explosions, snappier effects, effects on twos, a cartoon boop', juiceCard],
  ['gameworld-actions', 'The actions', 'what the hero can do; it decides the systems', 'my hero\'s powers, a metroidvania, a soulslike', actionsCard],
  ['gameworld-adornment', 'The adornment', 'what the hero carries, and why', 'my hero\'s weapon, what she carries', adornmentCard],
  ['gameworld-equipment', 'The equipment', 'the gear classes in one gear language', 'the weapons in my game, a gear set', equipmentCard],
  ['gameworld-systems', 'The systems', 'the numbers and the HUD, derived from the actions', 'stats, levels, a skill tree, the HUD', systemsCard],
  ['gameworld-battles', 'The battles', 'party battles turn by turn: classes the party switches, packs along the way, carried level to level', 'a JRPG, turn-based battles, a party of classes, a job system, class switching, a skill tree, random encounters, a boss fight, minigames, a fishing minigame, an arcade in the inn', battlesCard],
  ['gameworld-foes', 'The foes', 'hostile classes on the trails: how each moves, hurts and decides, at any rank, on any body that fits', 'enemies in my level, goombas, monsters to fight, a wolf pack, a boss beast, dire wolves, foot soldiers, a turret, things that chase me, a swarm of rats', foesCard],
  ['gameworld-story', 'The cast and the story', 'other people, and the moments they are in, bound to the world as it is built', 'a mayor who greets you, a story written first, characters in my levels, what happens where, dialogue choices, quests, a journal, a companion, a party member who joins, a cast rolled for my game, a party, a rival, a villain and his lieutenant, a familiar or summon, beastfolk or a mascot in the party', storyCard],
  ['gameworld-next', 'The next moves', "design_game's readout steps: review, play, share, run, rerun, intent, target, feel, wait, advice", 'what do I do next, approve the parts, is it playable', nextCard],
];
export const GAMEWORLD_CARD_IDS = Object.freeze(CARDS.map(([id]) => id));
export { SAMPLE_PAGES };

let cache = null;
export function gameworldCards() {
  if (cache) return cache;
  cache = new Map(CARDS.map(([id, name, summary, when, body]) => [id, { id, name, summary, when, scope: 'rail', body: body() }]));
  return cache;
}
