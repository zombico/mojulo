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
import { IDIOMS, SYSTEM_KINDS, STAGES } from './actions.js';
import { RAILS } from './adornment-kit.js';
import { CLASS_SLOTS } from './equipment.js';
import { SCALE, EPOCH_LEVEL, GAINED, GEAR_STAT, GEAR_BY } from './mechanics.js';
import { WORLD_STYLE, CIVILIZATION, LINK_KINDS } from './world.js';
import { MODES, STAMPS } from './review.js';
import { SAMPLE_PAGES, SAMPLE_MAX, DERIVE } from './samples.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';
import { STAGE_KITS } from '../era/stage.js';
import { SEEDED_STYLES } from '../equipment/styles.js';

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
    '  - Fragments, not worlds. No worked world is served while you design. The cards show contrast pairs; samples show',
    '    random fragments with their consequences. Compose your own; nothing is to be copied.',
    '  - Past the book, the instruments: the hero door\'s sculpt, clips and paint (get_solid_vocab({ id: \'layered\' })),',
    '    inline equipment style cards, the play block\'s parts and cues (get_play_vocab). The book never limits them.',
    '',
    'THE DOOR (design_game):',
    '  design_game({ world })                 start a gameworld (a sketch: update_sketch works on it too)',
    '  design_game({ ref, patch })            edit it by part (JSON Pointer ops on the recipe)',
    '  design_game({ ref, approve, revise })  the creator\'s verdicts: approve part ids; revise { part, note } sends one back',
    '  design_game({ ref, run: true })        make every step that is ready: the hero, the systems world, the gear',
    '  A run keeps what did not move, remakes what did in place, and leaves what the creator edited by hand (force: true',
    '  overwrites). Its answer is each part\'s stamp, the steps, what was made and the next moves; the bible is the sketch',
    '  page\'s. `mode`: ' + Object.entries(MODES).map(([k, v]) => `${k} (${v})`).join('; ') + '.',
  );
}

function worldCard() {
  return lines(
    'THE WORLD — where the game happens: { id, name?, seed?, style?, civilizations?, levels, links?, start?, mode?, brief? }.',
    '',
    `style: ${Object.entries(WORLD_STYLE).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
    `kits (the outdoor stage kits a world is drawn in): ${Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].shell).join(', ')}.`,
    `civilizations: { <id>: { ${words(CIVILIZATION)} } }: who builds, and how (each in words where it can be).`,
    'levels: { <id>: { name?, style?, walk: { nodes, edges? }, places? } }: a level overrides its world where it says.',
    `links: ${Object.entries(LINK_KINDS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
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
    'hero.actions { idiom?, system?: { kind, resource?, source?, rule? }, powers: [{ id, verb, element?, look?, attack? }], progression: [{ stage, gains, gate? }] }',
    '',
    `idioms (a design convention, "-like", never a title): ${Object.entries(IDIOMS).map(([k, v]) => `${k} (${v.read})`).join('; ')}.`,
    `system kinds: ${Object.entries(SYSTEM_KINDS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
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
    'LAWS: the hero\'s item of a class seeds its row; your row wins (ledgered); an empty class is a task, not a fault; a',
    'style that would break a seeded template leaves it its own build, and says so. Gear is made once the stats exist.',
    '',
    samples('gear'),
  );
}

function systemsCard() {
  return lines(
    'THE SYSTEMS — the numbers and the HUD, derived from the actions: mechanics { stats?, scale?, hud?, ui?, gear? }.',
    '',
    `scale (the coarse dials): ${Object.entries(SCALE).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `stages → epochs reached by level: ${Object.entries(EPOCH_LEVEL).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `how a power is gained, by system kind: ${Object.entries(GAINED).map(([k, v]) => `${k}: ${v.why}`).join('; ')}.`,
    `what each class raises, by stage: ${Object.entries(GEAR_STAT).map(([k, v]) => `${k} ${v} ${GEAR_BY[v].join('/')}`).join(', ')}.`,
    'LAWS: every number carries its reason; your own `stats` are laid over the derived (lists by id, objects by key) and',
    'ledgered. Each power is a key (1, 2, 3 …) that spends its cost and shows its look; I opens the status page. The HUD',
    'is derived (hp, the resource, the level, banners, a status page) or yours (play parts: get_play_vocab).',
    `PARTS reviewed: ${CHARACTER_PART_IDS.join(', ')}. Stamps: ${Object.entries(STAMPS).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
  );
}

const CARDS = [
  ['gameworld-guide', 'The game book', 'the loop and the principles: design a game top down, then let design_game make it', 'make a game, design a game, a game with a hero and powers, where do I start', guide],
  ['gameworld-world', 'The world', 'the ground, its levels, kits, civilizations and links', 'the levels of my game, where it happens', worldCard],
  ['gameworld-direction', 'The direction', 'how characters are drawn: tradition, elements, motif', 'anime or western, the colours of my hero', directionCard],
  ['gameworld-looks', 'The looks', 'the hero bare: body, head, hair, colour and the underlayer', 'what my hero looks like', looksCard],
  ['gameworld-motion', 'The motion', 'how the hero feels to move: vibe words on four axes', 'make my hero feel heavy, bouncy, bold', motionCard],
  ['gameworld-actions', 'The actions', 'what the hero can do; it decides the systems', 'my hero\'s powers, a metroidvania, a soulslike', actionsCard],
  ['gameworld-adornment', 'The adornment', 'what the hero carries, and why', 'my hero\'s weapon, what she carries', adornmentCard],
  ['gameworld-equipment', 'The equipment', 'the gear classes in one gear language', 'the weapons in my game, a gear set', equipmentCard],
  ['gameworld-systems', 'The systems', 'the numbers and the HUD, derived from the actions', 'stats, levels, a skill tree, the HUD', systemsCard],
];
export const GAMEWORLD_CARD_IDS = Object.freeze(CARDS.map(([id]) => id));
export { SAMPLE_PAGES };

let cache = null;
export function gameworldCards() {
  if (cache) return cache;
  cache = new Map(CARDS.map(([id, name, summary, when, body]) => [id, { id, name, summary, when, scope: 'rail', body: body() }]));
  return cache;
}
