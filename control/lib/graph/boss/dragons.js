/**
 * THE DRAGONS — a FAMILY of bosses (a human boss each, ./bosses.js, the director's: worlds/controllable/boss.js) that
 * share ONE FIGHT: the same two forms, the same idioms in each, the same tell language. What differs is each dragon's own
 * way of doing them: an idiom is IMPLEMENTED by each dragon's element (its pattern, what lands, in its words), so a player
 * who has learned one dragon reads the next by its body (it turns its flank: jump; it spreads its wings: back off) and is
 * caught out by what its element does with it.
 *
 *   THE TWO FORMS (DRAGON_FORMS)  it opens ON FOUR LEGS, its PRIMARY form (a beast: its tail at your legs, its charge, its
 *                                breath); hurt to DRAGON_RISE.below it RISES onto two (its `risen` look: the figure the
 *                                director swaps onto its body), wings spread, and fights as the RISEN form (its wings beaten
 *                                down round it, its dive, its breath) with its SIGNATURE joined; at the last it is relentless
 *   THE IDIOMS (DRAGON_IDIOMS)   each its form, its ANSWER and its body's tell, the same in every dragon
 *   THE TELL LANGUAGE (./bosses.js ANSWERS)   a move's `answer`, its hazard's tell colour: ROLL out of it (it cannot be
 *                                blocked), JUMP it (it comes low), BACK OFF (it reaches round it). An implementation is one
 *                                of the patterns its answer answers (ANSWERED_BY): the answer holds whatever the element
 *   A DRAGON (DRAGONS)           its element, its colours, its SNOUT (creature-heads/derive.js `drake-*`), its IMPLEMENTS
 *                                (each idiom's pattern and what its element makes of it), its RISE (what it does as it
 *                                stands, and the arena event it brings: Ember sets the hall's rim burning), its signature
 *   ITS FIGHT (dragonBoss)       three phases: on four legs; risen (its look swapped, its signature joined); relentless
 *   ITS BODIES (dragonFigure)    the risen form: the draconic kin on two legs with wings, its snout its head; the primary
 *                                form is grown from it on four (gameworld/beast-boss.js dragonPrimaryFigure)
 *
 *   DRAGON_IDIOMS, DRAGON_FORMS, DRAGON_RISE, ANSWERED_BY, DRAGONS, DRAGON_IDS
 *   dragonBoss(id) → the boss row (readBoss reads it; boss/stand.js bossRule stands it, `figures: { risen }`)
 *   dragonLaws(id) → the family's laws over its own (bossLaws): one language, two forms
 *   dragonFigure(id) → the risen form's hero-door words
 *
 * A new dragon is a row. Pure data and builders.
 */
import { readBoss, bossLaws, ANSWERS } from './bosses.js';

/** The patterns each answer answers: an idiom's implementation is one of its answer's (so its tell colour tells true). */
export const ANSWERED_BY = Object.freeze({
  jump: Object.freeze(['coil', 'quake', 'toll', 'swoop', 'lunge', 'boulder', 'volley']),
  roll: Object.freeze(['sweep', 'fan', 'charge', 'rain', 'barrage', 'lock', 'strafe', 'grid', 'dive', 'lances', 'venom', 'toss']),
  back: Object.freeze(['ring', 'cleave']),
});

/** The family's idioms: each its form ('primary' on four legs, 'risen' on two, 'both'), its answer, its body's tell
 * (`{breath}` the dragon's breath's words); what lands is each dragon's (DRAGONS[id].implements). */
export const DRAGON_IDIOMS = Object.freeze({
  'tail-sweep': Object.freeze({ form: 'primary', answer: 'jump', says: 'turns its flank to you, its tail drawn back low' }),
  charge: Object.freeze({ form: 'primary', answer: 'roll', says: 'drops its head horns first and paws the floor' }),
  breath: Object.freeze({ form: 'both', answer: 'roll', says: 'draws its head back, its throat lit {breath}' }),
  'wing-buffet': Object.freeze({ form: 'risen', answer: 'back', says: 'spreads its wings wide over you' }),
  dive: Object.freeze({ form: 'risen', answer: 'roll', says: 'beats up into the air and hangs over you, its shadow on the floor' }),
});
const IDIOM_IDS = Object.keys(DRAGON_IDIOMS);

/** The two forms and the rise between them: the share of its health it rises at, the look it rises into. */
export const DRAGON_FORMS = Object.freeze({
  primary: Object.freeze({ reads: 'on four legs, a beast: low, long, its head down at you' }),
  risen: Object.freeze({ reads: 'on two legs, wings spread: towering, in the air as much as on the floor' }),
});
export const DRAGON_RISE = Object.freeze({ below: 0.55, look: 'risen', fury: 0.25 });

const I = (pattern, does, tune) => Object.freeze({ pattern, does, ...(tune ? { tune: Object.freeze(tune) } : {}) });
export const DRAGONS = Object.freeze({
  ember: Object.freeze({ name: 'The Ember Drake', title: 'the furnace of the deep halls', element: 'fire', snout: 'drake-ember', breath: 'orange',
    reads: 'a fire dragon: a deep, square furnace of a snout, its nostrils vented, scales the red of a dying coal, wings like smoke',
    scales: '#6a2a18', belly: '#c8823a', wings: '#3a1a14', horns: '#e8d2a8', eyes: '#ffb020', tell: '#ff7a2a', hazard: '#ffb347',
    implements: Object.freeze({
      'tail-sweep': I('coil', 'the tail lashes round along the floor dragging a wake of embers'),
      charge: I('charge', 'it ploughs down the lane and leaves it smoking'),
      breath: I('sweep', 'a gout of flame turned across the arc in front of it', { reach: 9 }),
      'wing-buffet': I('ring', 'the beat throws a ring of fire out across the floor'),
      dive: I('dive', 'it falls on you in a burst of flame'),
    }),
    rise: Object.freeze({ says: 'rears up out of its own smoke onto its hind legs; the hall\'s rim catches', event: 'burn' }),
    signature: Object.freeze({ 'fire-rain': Object.freeze({ pattern: 'rain', answer: 'roll', says: 'spits embers high over the hall; each lands where it is marked and bursts' }) }) }),
  rime: Object.freeze({ name: 'The Rime Drake', title: 'the cold that waits', element: 'frost', snout: 'drake-rime', breath: 'white with frost',
    reads: 'a frost dragon: a short, pointed snout under crests swept back like ice, scales the blue of deep ice, wings pale as hoarfrost',
    scales: '#2a4a6a', belly: '#c8dceb', wings: '#9ab8cc', horns: '#e8f2f8', eyes: '#9fe8ff', tell: '#bfe9ff', hazard: '#e8f8ff',
    implements: Object.freeze({
      'tail-sweep': I('quake', 'the tail slams down and a ridge of ice runs out along the floor'),
      charge: I('charge', 'it skates down the lane on the frost it lays'),
      breath: I('fan', 'a cone of frost shards breathed down the aim'),
      'wing-buffet': I('ring', 'the beat throws a front of hoarfrost out across the floor'),
      dive: I('dive', 'it comes down like a calving glacier'),
    }),
    rise: Object.freeze({ says: 'the frost on its back cracks as it rears up onto its hind legs' }),
    signature: Object.freeze({ 'ice-lances': Object.freeze({ pattern: 'lances', answer: 'roll', says: 'drives its claws into the floor; lances of ice spread from it where they are marked' }) }) }),
  storm: Object.freeze({ name: 'The Storm Drake', title: 'the thunder over the crags', element: 'thunder', snout: 'drake-storm', breath: 'crackling',
    reads: 'a storm dragon: a long blade of a snout finned down its bridge, scales the grey of a thunderhead, wings veined with light',
    scales: '#3a3a4a', belly: '#a8a8b8', wings: '#24243a', horns: '#e0e0c8', eyes: '#fff27a', tell: '#fff27a', hazard: '#fffbd0',
    implements: Object.freeze({
      'tail-sweep': I('toll', 'the tail cracks the floor like thunder and the clap rolls out across it'),
      charge: I('charge', 'it comes down the lane as a bolt does'),
      breath: I('strafe', 'its breath walked down the line through you, strike after strike'),
      'wing-buffet': I('ring', 'the beat looses a ring of static across the floor'),
      dive: I('dive', 'it falls with the thunder'),
    }),
    rise: Object.freeze({ says: 'rears up onto its hind legs, the light crawling along its crest' }),
    signature: Object.freeze({ lightning: Object.freeze({ pattern: 'lock', answer: 'roll', says: 'raises its crest; the light crawls along it, follows you, holds, and strikes', tune: Object.freeze({ harm: 0.25 }) }) }) }),
  venom: Object.freeze({ name: 'The Venom Drake', title: 'the rot in the low marsh', element: 'poison', snout: 'drake-venom', breath: 'green and sick',
    reads: 'a venom dragon: a broad, flat shovel of a snout, spikes swept back off its wide cheeks, scales the green of a fen, wings mottled',
    scales: '#2a4a24', belly: '#a8b860', wings: '#3a4a20', horns: '#d8d0a0', eyes: '#9cff3a', tell: '#9cff3a', hazard: '#c8ff7a',
    implements: Object.freeze({
      'tail-sweep': I('coil', 'its barbed tail lashed round along the floor'),
      charge: I('charge', 'it barrels down the lane trailing its slime'),
      breath: I('grid', 'the gas sinks into the floor in a checker of sick tiles: onto the clean ones'),
      'wing-buffet': I('cleave', 'one wing scythed round in front of it at full height'),
      dive: I('dive', 'it drops on you out of its own green haze'),
    }),
    rise: Object.freeze({ says: 'rears up onto its hind legs, its throat swelling' }),
    signature: Object.freeze({ spit: Object.freeze({ pattern: 'venom', answer: 'roll', says: 'rears back, its throat swelling; where its venom lands is marked' }) }) }),
  gloom: Object.freeze({ name: 'The Gloom Drake', title: 'the shadow under the mountain', element: 'dark', snout: 'drake-gloom', breath: 'black and cold',
    reads: 'a shadow dragon: a long snout hooked down at its tip, tusks at its lip, scales the black of a starless night, wings ragged',
    scales: '#1e1a24', belly: '#5a4a6a', wings: '#120e18', horns: '#c8bcd8', eyes: '#a86bff', tell: '#a86bff', hazard: '#d0a8ff',
    implements: Object.freeze({
      'tail-sweep': I('quake', 'the tail falls like night and a front of darkness rolls along the floor'),
      charge: I('charge', 'it comes at you out of its own shadow'),
      breath: I('barrage', 'black fire spat round where you stood, each mark darkening before it bursts'),
      'wing-buffet': I('cleave', 'a ragged wing swept round in front of it at full height'),
      dive: I('dive', 'it folds its wings and drops out of the dark'),
    }),
    rise: Object.freeze({ says: 'unfolds out of its own shadow onto its hind legs' }),
    signature: Object.freeze({ swoop: Object.freeze({ pattern: 'swoop', answer: 'jump', says: 'beats up off the floor and hangs in the dark over the hall; it folds its wings and rakes the floor' }) }) }),
});
export const DRAGON_IDS = Object.freeze(Object.keys(DRAGONS));

const rowOf = (id) => { const D = DRAGONS[id]; if (!D) throw new Error(`dragons: no dragon '${id}' (${DRAGON_IDS.join(', ')})`); return D; };
const ofForm = (form) => IDIOM_IDS.filter((m) => DRAGON_IDIOMS[m].form === form || DRAGON_IDIOMS[m].form === 'both');

/** A dragon as the boss director fights it: each idiom its body's tell and its element's implementation; its two forms;
 * its signature joined as it rises. */
export function dragonBoss(id) {
  const D = rowOf(id), say = (s) => s.replace('{breath}', D.breath);
  const idioms = Object.fromEntries(IDIOM_IDS.map((m) => {
    const M = DRAGON_IDIOMS[m], X = D.implements[m];
    if (!X) throw new Error(`dragons: the ${D.name} does not implement '${m}'`);
    return [m, { pattern: X.pattern, answer: M.answer, says: `${say(M.says)}; ${X.does}`, ...(X.tune ? { tune: { ...X.tune } } : {}) }];
  }));
  const sig = Object.fromEntries(Object.entries(D.signature).map(([m, S]) => [m, { pattern: S.pattern, answer: S.answer, says: S.says, ...(S.tune ? { tune: { ...S.tune } } : {}) }]));
  const sigIds = Object.keys(sig), w = (ids, n) => Object.fromEntries(ids.map((m) => [m, n]));
  const row = {
    name: D.name, title: D.title, reads: D.reads, element: D.element, family: 'dragon',
    look: { tell: D.tell, hazard: D.hazard },
    arena: { cover: 'pillars to break its breath behind', size: 'a hall high enough to fly in' },
    moves: { ...idioms, ...sig },
    looks: { [DRAGON_RISE.look]: D.rise.says },
    phases: [
      // (on four legs)
      { moves: { 'tail-sweep': 2, charge: 1, breath: 2 }, tempo: 2.4 },
      // (risen: its look swapped onto it, its signature joined)
      { below: DRAGON_RISE.below, look: DRAGON_RISE.look, moves: { 'wing-buffet': 1, breath: 2, dive: 1, ...w(sigIds, 2) }, tempo: 2, temper: 'opportunist', ...(D.rise.event ? { event: D.rise.event } : {}) },
      { below: DRAGON_RISE.fury, look: DRAGON_RISE.look, moves: { 'wing-buffet': 2, breath: 2, dive: 2, ...w(sigIds, 3) }, tempo: 1.5, temper: 'relentless' },
    ],
  };
  return readBoss(row, `dragon ${id}`);
}

/** The family's laws, over a dragon's own (bossLaws): ONE LANGUAGE (every idiom its family's answer, its implementation
 * a pattern that answer answers; a signature too) and TWO FORMS (its first phase only what it does on four legs, every
 * later one only what it does risen and wearing that look, each form's idioms all fought in it). */
export function dragonLaws(id) {
  const D = rowOf(id), B = dragonBoss(id), sigIds = Object.keys(D.signature);
  const off = Object.entries(B.moves).filter(([, m]) => !(ANSWERS[m.answer] && ANSWERED_BY[m.answer].includes(m.pattern))).map(([m]) => m);
  const strays = IDIOM_IDS.filter((m) => B.moves[m].answer !== DRAGON_IDIOMS[m].answer);
  const first = new Set(ofForm('primary')), later = new Set([...ofForm('risen'), ...sigIds]);
  const wrong = B.phases.flatMap((ph, k) => Object.keys(ph.moves).filter((m) => !(k ? later : first).has(m)).map((m) => `${m} in phase ${k}`));
  const bare = B.phases.slice(1).map((ph, k) => [k + 1, ph.look]).filter(([, l]) => l !== DRAGON_RISE.look).map(([k]) => k);
  const unfought = [...ofForm('primary').filter((m) => !B.phases[0].moves[m]), ...[...later].filter((m) => !B.phases.slice(1).some((ph) => ph.moves[m]))];
  return [...bossLaws(B),
    { law: 'one-language', holds: !off.length && !strays.length, says: off.length ? `moves whose pattern its answer does not answer: ${off.join(', ')}` : strays.length ? `idioms off the family's answer: ${strays.join(', ')}` : 'every move told in the family\'s answer, its element\'s pattern one that answer answers' },
    { law: 'two-forms', holds: !wrong.length && !bare.length && !unfought.length, says: wrong.length ? `moves out of their form: ${wrong.join('; ')}` : bare.length ? `risen phases without its risen look: ${bare.join(', ')}` : unfought.length ? `idioms never fought in their form: ${unfought.join(', ')}` : `on four legs, then risen below ${Math.round(DRAGON_RISE.below * 100)}%, each form its own idioms` },
  ];
}

/** A dragon's risen body as the hero door is asked for it: the draconic kin on two legs with wings, its snout its head,
 * its colours its element's. */
export function dragonFigure(id) {
  const D = rowOf(id);
  return { name: D.name, cast: { pole: 'male', build: 'brute' }, head: 'none', tune: { stature: 1.6 },
    beast: { kin: 'draconic', legs: 'digitigrade', head: D.snout, tail: 'thick', claws: 'long', ridge: 'spines', hunch: 24, mass: { trunk: 1.25, upperArm: 1.2, foreArm: 1.25, hand: 1.4, thigh: 1.45, shank: 1.25 } },
    outfit: { type: 'outfit', style: { id: 'designed', dials: {}, language: { feet: 'none' } }, pieces: [{ kind: 'wings', span: 1.25, rise: 1.05, sweep: 0.7 }], intent: { palette: { base: D.wings, secondary: D.wings, trim: D.horns, accent: D.tell, leather: D.scales, metal: D.horns, bone: D.horns } } },
    palette: { Skin: D.scales, Top: D.scales, Bottom: D.scales, Shoes: D.scales, Claws: D.horns, Horns: D.horns, Iris: D.eyes } };
}
