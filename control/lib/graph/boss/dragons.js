/**
 * THE DRAGONS — a FAMILY of bosses (a human boss each, ./bosses.js, the director's: worlds/controllable/boss.js) that
 * share their IDIOMS and their TELL LANGUAGE, each its own element, its signature moves and its face. A player who has
 * learned one dragon reads the next: the same tail sweep, the same buffet, the same breath and the same dive, told in
 * the same colours, in another element and around another dragon's own moves.
 *
 *   THE IDIOMS (DRAGON_IDIOMS)   every dragon has them, each in its element's words: its TAIL swept at the legs, its
 *                                WINGS beaten down round it, its BREATH poured across the floor, taking wing to DIVE on you
 *   THE TELL LANGUAGE (./bosses.js ANSWERS)   a move's `answer`, its hazard's tell colour: ROLL out of it (it cannot be
 *                                blocked: the breath, the dive), JUMP it (it comes low: the tail), BACK OFF (it reaches
 *                                round it: the buffet). The same colour, the same answer, in every dragon
 *   A DRAGON (DRAGONS)           its element, its colours (its scales, its wings, its breath), its SNOUT (a head drawn
 *                                from the dragon's skull, creature-heads/derive.js `drake-*`), its signature moves (each
 *                                with its answer), its name and its title
 *   ITS FIGHT (dragonBoss)       the idioms first; as it is hurt its signatures join them and it quickens: three phases
 *   ITS BODY (dragonFigure)      the draconic kin on two legs with wings (the castle's Lord Unbound's), its snout its head
 *   ITS PRIMARY FORM             the beast on four legs the two-legged body rises from, wearing its head, wings, dorsal
 *                                spines and colours (gameworld/beast-boss.js dragonPrimaryFigure, figures/dragon-primary.js)
 *
 *   DRAGON_IDIOMS, DRAGONS, DRAGON_IDS
 *   dragonBoss(id) → the boss row (readBoss reads it; bossRule stands it)        dragonFigure(id) → its hero-door words
 *
 * A new dragon is a row. Pure data and builders.
 */
import { readBoss } from './bosses.js';

/** The family's idioms: each a pattern, its answer, and what it says in an element's words (`{breath}` its breath's). */
export const DRAGON_IDIOMS = Object.freeze({
  'tail-sweep': Object.freeze({ pattern: 'scythe', answer: 'jump', says: 'turns its flank to you, its tail drawn back low; the arc glows at your legs' }),
  'wing-buffet': Object.freeze({ pattern: 'ring', answer: 'back', says: 'rears and spreads its wings; the floor round it shudders before they beat down' }),
  breath: Object.freeze({ pattern: 'sweep', answer: 'roll', says: 'draws its head back, its throat lit {breath}; the arc it will breathe glows on the floor', tune: Object.freeze({ reach: 9 }) }),
  dive: Object.freeze({ pattern: 'dive', answer: 'roll', says: 'beats up into the air and hangs over you; its shadow darkens the floor where it will fall' }),
});
const IDIOM_IDS = Object.keys(DRAGON_IDIOMS);

export const DRAGONS = Object.freeze({
  ember: Object.freeze({ name: 'The Ember Drake', title: 'the furnace of the deep halls', element: 'fire', snout: 'drake-ember', breath: 'orange',
    reads: 'a fire dragon: a deep, square furnace of a snout, its nostrils vented, scales the red of a dying coal, wings like smoke',
    scales: '#6a2a18', belly: '#c8823a', wings: '#3a1a14', horns: '#e8d2a8', eyes: '#ffb020', tell: '#ff7a2a', hazard: '#ffb347',
    signature: Object.freeze({ 'fire-rain': Object.freeze({ pattern: 'rain', answer: 'roll', says: 'spits embers high over the hall; each lands where it is marked and bursts' }) }) }),
  rime: Object.freeze({ name: 'The Rime Drake', title: 'the cold that waits', element: 'frost', snout: 'drake-rime', breath: 'white with frost',
    reads: 'a frost dragon: a short, pointed snout under crests swept back like ice, scales the blue of deep ice, wings pale as hoarfrost',
    scales: '#2a4a6a', belly: '#c8dceb', wings: '#9ab8cc', horns: '#e8f2f8', eyes: '#9fe8ff', tell: '#bfe9ff', hazard: '#e8f8ff',
    signature: Object.freeze({ 'ice-lances': Object.freeze({ pattern: 'lances', answer: 'roll', says: 'drives its claws into the floor; lances of ice spread from it where they are marked' }) }) }),
  storm: Object.freeze({ name: 'The Storm Drake', title: 'the thunder over the crags', element: 'thunder', snout: 'drake-storm', breath: 'crackling',
    reads: 'a storm dragon: a long blade of a snout finned down its bridge, scales the grey of a thunderhead, wings veined with light',
    scales: '#3a3a4a', belly: '#a8a8b8', wings: '#24243a', horns: '#e0e0c8', eyes: '#fff27a', tell: '#fff27a', hazard: '#fffbd0',
    signature: Object.freeze({ lightning: Object.freeze({ pattern: 'lock', answer: 'roll', says: 'raises its crest; the light crawls along it, follows you, holds, and strikes', tune: Object.freeze({ harm: 0.25 }) }) }) }),
  venom: Object.freeze({ name: 'The Venom Drake', title: 'the rot in the low marsh', element: 'poison', snout: 'drake-venom', breath: 'green and sick',
    reads: 'a venom dragon: a broad, flat shovel of a snout, spikes swept back off its wide cheeks, scales the green of a fen, wings mottled',
    scales: '#2a4a24', belly: '#a8b860', wings: '#3a4a20', horns: '#d8d0a0', eyes: '#9cff3a', tell: '#9cff3a', hazard: '#c8ff7a',
    signature: Object.freeze({ spit: Object.freeze({ pattern: 'venom', answer: 'roll', says: 'rears back, its throat swelling; where its venom lands is marked' }) }) }),
  gloom: Object.freeze({ name: 'The Gloom Drake', title: 'the shadow under the mountain', element: 'dark', snout: 'drake-gloom', breath: 'black and cold',
    reads: 'a shadow dragon: a long snout hooked down at its tip, tusks at its lip, scales the black of a starless night, wings ragged',
    scales: '#1e1a24', belly: '#5a4a6a', wings: '#120e18', horns: '#c8bcd8', eyes: '#a86bff', tell: '#a86bff', hazard: '#d0a8ff',
    signature: Object.freeze({ swoop: Object.freeze({ pattern: 'swoop', answer: 'roll', says: 'beats up off the floor and hangs in the dark over the hall; it folds its wings to dive' }) }) }),
});
export const DRAGON_IDS = Object.freeze(Object.keys(DRAGONS));

const rowOf = (id) => { const D = DRAGONS[id]; if (!D) throw new Error(`dragons: no dragon '${id}' (${DRAGON_IDS.join(', ')})`); return D; };

/** A dragon as the boss director fights it: the idioms in its element's words, its signatures, three phases. */
export function dragonBoss(id) {
  const D = rowOf(id), say = (s) => s.replace('{breath}', D.breath);
  const idioms = Object.fromEntries(IDIOM_IDS.map((m) => { const I = DRAGON_IDIOMS[m]; return [m, { pattern: I.pattern, answer: I.answer, says: say(I.says), ...(I.tune ? { tune: { ...I.tune } } : {}) }]; }));
  const sig = Object.fromEntries(Object.entries(D.signature).map(([m, S]) => [m, { pattern: S.pattern, answer: S.answer, says: S.says, ...(S.tune ? { tune: { ...S.tune } } : {}) }]));
  const sigIds = Object.keys(sig);
  const row = {
    name: D.name, title: D.title, reads: D.reads, element: D.element, family: 'dragon',
    look: { tell: D.tell, hazard: D.hazard },
    arena: { cover: 'pillars to break its breath behind', size: 'a hall high enough to fly in' },
    moves: { ...idioms, ...sig },
    phases: [
      { moves: { 'tail-sweep': 2, 'wing-buffet': 1, breath: 2 }, tempo: 2.4 },
      { below: 0.66, moves: { 'tail-sweep': 1, 'wing-buffet': 1, breath: 2, dive: 1, ...Object.fromEntries(sigIds.map((m) => [m, 2])) }, tempo: 2, temper: 'opportunist' },
      { below: 0.33, moves: { 'tail-sweep': 1, 'wing-buffet': 2, breath: 2, dive: 2, ...Object.fromEntries(sigIds.map((m) => [m, 3])) }, tempo: 1.5, temper: 'relentless' },
    ],
  };
  return readBoss(row, `dragon ${id}`);
}

/** A dragon's body as the hero door is asked for it: the draconic kin on two legs with wings, its snout its head, its
 * colours its element's. */
export function dragonFigure(id) {
  const D = rowOf(id);
  return { name: D.name, cast: { pole: 'male', build: 'brute' }, head: 'none', tune: { stature: 1.6 },
    beast: { kin: 'draconic', legs: 'digitigrade', head: D.snout, tail: 'thick', claws: 'long', ridge: 'spines', hunch: 24, mass: { trunk: 1.25, upperArm: 1.2, foreArm: 1.25, hand: 1.4, thigh: 1.45, shank: 1.25 } },
    outfit: { type: 'outfit', style: { id: 'designed', dials: {}, language: { feet: 'none' } }, pieces: [{ kind: 'wings', span: 1.25, rise: 1.05, sweep: 0.7 }], intent: { palette: { base: D.wings, secondary: D.wings, trim: D.horns, accent: D.tell, leather: D.scales, metal: D.horns, bone: D.horns } } },
    palette: { Skin: D.scales, Top: D.scales, Bottom: D.scales, Shoes: D.scales, Claws: D.horns, Horns: D.horns, Iris: D.eyes } };
}
