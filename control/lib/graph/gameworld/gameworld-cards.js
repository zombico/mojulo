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
import { IDIOMS, SYSTEM_KINDS, STAGES, TRAVERSAL_MOVES } from './actions.js';
import { RAILS } from './adornment-kit.js';
import { CLASS_SLOTS } from './equipment.js';
import { SCALE, EPOCH_LEVEL, GAINED, GEAR_STAT, GEAR_BY } from './mechanics.js';
import { WORLD_STYLE, CIVILIZATION, LINK_KINDS, TOPOLOGIES } from './world.js';
import { MODES, STAMPS } from './review.js';
import { SAMPLE_PAGES, SAMPLE_MAX, DERIVE } from './samples.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';
import { STAGE_KITS, resolveKitId } from '../era/stage.js';
import { STRUCTURE_KITS } from '../era/out-structures.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { SEEDED_STYLES } from '../equipment/styles.js';
import { QUICK_GOALS } from './quick.js';
import { LEVEL_SECTIONS } from '../level/graph.js';
import { TUNE_KEYS, HERO_MOVE_NAMES, PALETTE as HERO_PALETTE, HERO_CASTS, PROPORTION_WORDS } from '../polygonizer/hero-form.js';
import { LOOK_TABLES } from '../polygonizer/anime-looks.js';
import { HAIR_STYLE_NAMES } from '../polygonizer/humanoid-hair.js';
import { METAL_NAMES, FINISHES, FINISH_NAMES } from '../materials/metal-surface.js';

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
    'progression: the QUICK path, one call; read gameworld-quick only. A hero with abilities, gear, levelling, several',
    'levels or a story: the book below. Quick keeps the graphics rich, and its sketch grows into the book in place.',
    '',
    'THE LOOP (each page answers ONE question, from the brief and the pages above it; never from a default):',
    '  world       where is it? the ground, its levels, who built what (gameworld-world)',
    '  direction   how is it drawn? the tradition, the leading and supporting elements, the motif (gameworld-direction)',
    '  looks       who is the hero, bare? body, head, hair, colour, composed in a base that wears only the world (gameworld-looks)',
    '  motion      how does the hero feel to move? vibe words onto four axes (gameworld-motion)',
    '  actions     what can the hero DO beyond platforming? this decides the systems (gameworld-actions)',
    '  adornment   what does the hero carry, and why? an item exists because a power needs it (gameworld-adornment)',
    '  systems     the numbers and the HUD, derived from the actions, each with its reason (gameworld-systems)',
    '  equipment   the gear classes, in one gear language; they matter once a stat makes them matter (gameworld-equipment)',
    '',
    'PRINCIPLES:',
    '  - Ask, then derive. Before a page, ask the creator what only they know (who the hero is, what the verb of the game',
    '    is, how the world should feel to move through). A choice nothing in the brief explains is a defect, even when it',
    '    validates. Write the brief into the recipe (`brief`) so the readout can ask about the choices it does not explain.',
    '  - The book derives a first reading of every page; that is a floor, not a design. Accepting every derivation passes',
    '    every gate and designs nothing. Override where the brief says something the derivation does not (ledgered).',
    '  - Laws, not presets. Each card states what derives from what. A preset, a style card or an idiom is a language to',
    '    fork, never an answer to adopt whole.',
    '  - Fragments, not worlds. Cards show contrast pairs, samples random fragments with their consequences; compose your own.',
    '  - Past the book, the instruments: the hero door (get_solid_vocab({ id: \'layered\' })), inline equipment style cards,',
    '    the play block\'s parts and cues (get_play_vocab). The book never limits them.',
    '',
    'THE RECIPE (where each page lives; every key optional but id and levels):',
    '  { id, name?, seed?, mode?: gated | autonomous, brief?: \'<the ask, in words>\' | { text, why?: { <choice word>: \'<the brief words it answers>\' } },',
    '    style?: { kit, look?, land? }, civilizations?: { <id>: { name, builds } },',
    '    levels: { <id>: { name?, walk: { nodes: { <id>: { trail: {} } | { meru: {} } }, edges?: [{ from, to }] } } },',
    '    characters?: { direction: { tradition, primary?, secondary?, motif? },',
    '      hero: { looks?: { body?, head?, hair?, colour?, underlayer? }, motion?, actions?, adornment? } },',
    '    equipment?: { style?, classes? }, mechanics?: { scale?, powers?, stats?, hud?, ui? } }',
    '  patch ops are { op: \'set\' | \'remove\' | \'add\', path: \'/characters/hero/motion\', value } (JSON Pointer paths; no \'replace\').',
    '  A refusal names the field, the shape it wants, and the ref once stored.',
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
    ...Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].shell).map((k) => `  ${k.padEnd(14)} ${[ISEKAI_STYLES[resolveKitId(k)] ? 'a look in words' : null, STRUCTURE_KITS.includes(resolveKitId(k)) ? 'civilizations (buildings)' : null].filter(Boolean).join(', ') || 'the kit as it is (no look, no civilizations)'}`),
    'civilizations: { <id>: { name, builds: \'<what it builds, in words>\' } }: name and builds are words; anchor, fort, town, castle',
    '  and technology are structured, default from the kit, and are best left out (the world bible shows what they resolved to).',
    `levels: { <id>: { name?, style?, walk: { nodes: { <id>: { ${LEVEL_SECTIONS.join(': {} } | { ')}: {} } }, edges?: [{ from, to }] }, places? } }:`,
    '  a walk is one line of sections (a trail, then a climb), joined by edges in order; a level overrides its world where it says.',
    `links: ${Object.entries(LINK_KINDS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    `topology: ${Object.entries(TOPOLOGIES).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    '  in a map, a link may take key: \'<item>\' and keyAt: \'<level>\' (the item lies there, and opens the way from from to to); trails only.',
    '  a key that is one of the hero\'s powers is a power key: picking it up opens the door and, when the power names a move, gives the hero that move.',
    '',
    'ANSWER FROM: the brief\'s places and their moods. One level that is a promise of the rest is a better first',
    'reading than many; the world bible (the sketch page) draws every level as it resolves.',
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

function actionsCard() {
  return lines(
    'THE ACTIONS — what the hero can DO beyond platforming; this decides the systems.',
    'hero.actions { idiom?, system?: { kind, resource?, source?, rule? }, powers: [{ id, verb, element?, look?, attack?, move? }], progression: [{ stage, gains, gate? }] }',
    `move: what a power lets the hero do, given when it is found as a map key: ${Object.entries(TRAVERSAL_MOVES).map(([k, v]) => `${k} (${v.read})`).join('; ')}.`,
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

function quickCard() {
  return lines(
    'THE QUICK PATH — one level, one goal, one call: design_game({ quick: { goal, ... } }). The loop is simple; the graphics are not.',
    '',
    `goal: ${Object.entries(QUICK_GOALS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    'levers, all optional:',
    `  climb: true        a climb after the trail (reach: the exit is its top); pickup: '<word>' for collect (coin, key, star…); seconds: n for survive`,
    `  hero: { <hero-door words> } the hero's looks, hair, outfit, gear in hand, the motion's feel (get_solid_vocab({ id: 'layered' }));`,
    '                     absent or false: first person, you are the camera',
    `  camera: 'third-person' | 'first-person' | 'top-down' | 'side'   absent: third person with a hero, first person without; top-down (¾, north up) and side (A / D run the trail's line, no climb) need a hero`,
    `  theme: { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? }   the game shell's skin`,
    `  world: { id, name?, seed?, style?: { kit, look?, land? } }   the ground in words: kits ${Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].shell).join(', ')} (gameworld-world says what each takes)`,
    '',
    'THE ANSWER: the readout of the one-level gameworld that was written and run: its stage as a level with the goal placed on',
    'the stage\'s own anchors, the store the goal needs, and the game, with its play link. Walkable by construction; whether it',
    'can be beaten is the creator\'s to judge in play, and nothing proved it.',
    'GROWING: it is an ordinary gameworld. Patch in the hero\'s pages (design_game({ ref, patch })) and the same sketch becomes',
    'the book, with every page, review and gate (gameworld-guide). Levels composed by hand stay create_game\'s.',
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
    '             proved it (`gate: eyes`).',
    '  run        run: true makes the hero, and every step that is ready.',
    '  rerun      after a change, run again: what moved is remade, a hand edit is left (force: true overwrites it).',
    '  adornment  the page is empty: the bible proposes what the hero carries from the power verbs, with reasons; write',
    '             your own at `path` (gameworld-adornment); its items seed the equipment table.',
    '  wait       step `on` waits on those parts (their stamps in brackets).',
    '  advice     read `advice`: a choice the brief does not explain, or one that reads as a fixture or a sample, is the',
    '             creator\'s to confirm.',
  );
}

const CARDS = [
  ['gameworld-guide', 'The game book', 'the loop and the principles: design a game top down, then let design_game make it', 'make a game, design a game, a game with a hero and powers, where do I start', guide],
  ['gameworld-quick', 'The quick path', 'one level and a simple goal in one call: reach, collect, survive, avoid', 'a simple game, a platformer level, collect coins, reach the exit, survive for a minute, a quick game', quickCard],
  ['gameworld-world', 'The world', 'the ground, its levels, kits, civilizations and links', 'the levels of my game, where it happens', worldCard],
  ['gameworld-direction', 'The direction', 'how characters are drawn: tradition, elements, motif', 'anime or western, the colours of my hero', directionCard],
  ['gameworld-looks', 'The looks', 'the hero bare: body, head, hair, colour and the underlayer', 'what my hero looks like', looksCard],
  ['gameworld-motion', 'The motion', 'how the hero feels to move: vibe words on four axes', 'make my hero feel heavy, bouncy, bold', motionCard],
  ['gameworld-actions', 'The actions', 'what the hero can do; it decides the systems', 'my hero\'s powers, a metroidvania, a soulslike', actionsCard],
  ['gameworld-adornment', 'The adornment', 'what the hero carries, and why', 'my hero\'s weapon, what she carries', adornmentCard],
  ['gameworld-equipment', 'The equipment', 'the gear classes in one gear language', 'the weapons in my game, a gear set', equipmentCard],
  ['gameworld-systems', 'The systems', 'the numbers and the HUD, derived from the actions', 'stats, levels, a skill tree, the HUD', systemsCard],
  ['gameworld-next', 'The next moves', "design_game's readout steps: review, play, run, rerun, wait, advice", 'what do I do next, approve the parts, is it playable', nextCard],
];
export const GAMEWORLD_CARD_IDS = Object.freeze(CARDS.map(([id]) => id));
export { SAMPLE_PAGES };

let cache = null;
export function gameworldCards() {
  if (cache) return cache;
  cache = new Map(CARDS.map(([id, name, summary, when, body]) => [id, { id, name, summary, when, scope: 'rail', body: body() }]));
  return cache;
}
