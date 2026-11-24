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
 *   castleBoss(id)       → the row as the director's boss (boss/bosses.js readBoss reads it); a move's `look` names what
 *                        its attack looks like where its pattern's own does not say (boss/looks.js: a toss's thing)
 *   SIDE_BODY, sideBody(reach) → the body a side view's fight is measured for (boss/laws.js: on a lane, with its jump);
 *                        `reach` a feel's measured reach (feel/reach.js), else the castle's hero's numbers
 *   bossRow(name)        → { id, known, ...row }   the row a boss's name reads as (lower-cased, `the` off, hyphened)
 *   BOSS_DEFAULT         the row a boss the shelf does not know stands as
 *   CASTLE_FIGURES       { <id>: { hero } | { animal } | { bell } }   (a bell a card built on the page, bell.js)   each boss's figure in the door's words (the runner makes it,
 *                        `boss-<id>`); figuredBosses(names) → the ids a box's boss names have figures for
 *   standBosses(G, B, { stature, refs? }) → { figures, entities }   (`refs` { <row id>: its figure's sketch }: stood as
 *                        it, fitted to its tier's height; without one, a stand-in)   each of the box's bosses (scene.js boxOf `bosses`, laid
 *                        `bosses: 'stood'`) stood by the foe shelf where its room says, at its tier's height, its health its
 *                        blows, on its room's own stretch of the lane (it never follows her out of its room), its bar the
 *                        castle's (held-gates-view.js), never one over its head
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
import { lookOfMove, windClips } from '../../boss/looks.js';
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
  'lord-of-the-keep': Object.freeze({ class: 'pursuer', skin: Object.freeze({ people: 'infernal' }), tier: 1.6, blows: 34, reads: 'the vampire lord himself: he follows her across his throne room and strikes',
    moves: Object.freeze({ 'cape-sweep': { pattern: 'cleave', says: 'gathers his cape and sweeps it round' }, 'bat-swarm': { pattern: 'toss', says: 'opens his cape; bats pour out where she stood', look: { tell: { falling: 'swarm' } } }, 'blood-wave': { pattern: 'toll', says: 'raises both hands; the throne room\'s air turns red' }, 'shadow-lunge': { pattern: 'lunge', says: 'sinks into his own shadow' } }),
    phases: Object.freeze([ph({ 'cape-sweep': 2, 'bat-swarm': 2 }, 2.2), ph({ 'cape-sweep': 2, 'bat-swarm': 1, 'blood-wave': 2 }, 1.8, { below: 0.66, temper: 'opportunist' }), ph({ 'blood-wave': 2, 'shadow-lunge': 2, 'bat-swarm': 1, 'cape-sweep': 1 }, 1.3, { below: 0.33, temper: 'relentless' })]) }),
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
export const CASTLE_FIGURES = Object.freeze({
  'gate-warden': Object.freeze({ hero: { name: 'The Gate Warden', cast: { pole: 'male', build: 'brute' }, head: 'landmark',
    adorn: { type: 'armor', style: 'knight', theme: 'death-knight', language: { pauldron: 'bell' }, dials: { mass: 0.7, ornament: 1 } },
    palette: { Skin: '#9a9a86' }, gear: { right: { item: 'staff', style: 'grave', parts: { head: 'halberd' }, dials: { mass: 1.6 } } }, stylism: { ...MYTH, silhouette: 'wedge' } } }),
  gatekeeper: Object.freeze({ hero: { name: 'The Gatekeeper', cast: { pole: 'male', build: 'brute' }, head: 'landmark',
    adorn: { type: 'armor', style: 'knight', language: { pauldron: 'bell' }, dials: { mass: 0.7, ornament: 1 } }, headgear: 'skullKnight',
    palette: { Skin: '#7a2a22', Plate: '#3a1a1a', Iron: '#2a1a1a', Bronze: '#9a6a32', Helm: '#2a1414', Trim: '#9a6a32', Rivet: '#c9a75a', Accent: '#8a1a1a', Leather: '#1e1212', Top: '#2a1416', Bottom: '#1a0e10', Shoes: '#120a0a' },
    gear: { right: { item: 'greatsword', style: 'brutal', dials: { mass: 1.3 } } }, stylism: { ...MYTH, silhouette: 'wedge' } } }),
  'bell-ringer': Object.freeze({ hero: { name: 'The Bell Ringer', cast: { pole: 'male', build: 'stout' }, head: 'landmark',
    undead: { form: 'zombie' }, outfit: { type: 'outfit', style: 'mage' },
    palette: { Skin: '#8a9a7a', OutfitBase: '#4a3a2a', OutfitSecond: '#2e241a', OutfitTrim: '#8a6a32', OutfitAccent: '#c9a75a', Outer: '#2e241a', Top: '#4a3a2a', Bottom: '#3a2e22', Shoes: '#221a14' },
    gear: { right: { item: 'staff', style: 'grave', parts: { head: 'mace' } } }, stylism: { ...MYTH, silhouette: 'monk' } } }),
  bellkeeper: Object.freeze({ hero: { name: 'The Bellkeeper', cast: { pole: 'male', build: 'stout' }, head: 'landmark',
    outfit: { type: 'outfit', style: 'cleric' },
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
  // (the great bell: no door makes a bell, so it is a card of its own, bell.js, built on the page with its swings)
  'great-bell': Object.freeze({ bell: { card: 'great-bell' } }),
  'lord-of-the-keep': Object.freeze({ hero: { name: 'The Lord of the Keep', cast: 'male', head: 'anime', animeStyle: 'shonen-high', animeBody: 'toji',
    look: 'rival', hair: ['swept-back'], expression: 'deadpan', outfit: { type: 'outfit', style: 'noble' },
    palette: { Skin: '#ece4ea', Hair: '#d9d6e0', Outer: '#0e0a10', OutfitBase: '#4a0a1a', OutfitSecond: '#1a0a12', OutfitTrim: '#c9a75a', OutfitAccent: '#c9a75a', Top: '#3a0a18', Bottom: '#140a10', Shoes: '#0e0a0c' },
    stylism: { ...MYTH, canon: 'anime', silhouette: 'balance' } } }),
});
/** A castle boss's figure as its door is asked for it: a person's with its moves' wind-up and strike clips (boss/looks.js
 * ATTACK_POSES, played by the page as it winds up and strikes); a beast's as it is (its own gaits). */
export function castleFigure(id) {
  const F = CASTLE_FIGURES[id];
  if (!F || F.animal || F.bell) return F ?? null;
  const pats = Object.values(CASTLE_BOSSES[id].moves).map((m) => m.pattern);
  return { hero: { ...F.hero, clips: { ...windClips(pats), ...(F.hero.clips ?? {}) } } };
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
export function castleBoss(id) {
  const R = CASTLE_BOSSES[id] ?? CASTLE_BOSSES[BOSS_DEFAULT], name = id.split('-').map((w) => (w === 'of' || w === 'the' ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
  return { name: `The ${name}`, title: R.reads.split(':')[0], reads: R.reads, look: { tell: '#e8c77a', hazard: '#d0463c' }, moves: JSON.parse(JSON.stringify(R.moves)), phases: JSON.parse(JSON.stringify(R.phases)) };
}

/** the body a side view's fight is measured for: on the lane, no dive, its jump (Erina's measured numbers) */
export const SIDE_BODY = Object.freeze({ speed: 5.5, reaction: 0.6, dive: Object.freeze({ dist: 0, dur: 0, iframes: 0 }), lane: true, jump: Object.freeze({ height: 2.24, gravity: 20 }) });
export const sideBody = (reach) => (reach?.moves?.run ? { ...SIDE_BODY, speed: reach.speed, jump: { height: reach.moves.run.height, gravity: reach.rule.gravity } } : SIDE_BODY);

/** a castle boss's rule with each move's LOOK (boss/looks.js) carried for the page: its tell and its hit, by its pattern
 * and its own words (the thing a toss throws) */
const withLooks = (R, row) => ({ ...R, moves: Object.fromEntries(Object.entries(R.moves).map(([m, x]) => [m, { ...x, fx: lookOfMove({ id: m, ...row.moves[m] }) }])) });

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
    // (a figure grown to its tier: a door's body, a person's height, by its tier, as the side map's bosses are (its
    // bounds would count the halberd held over its head); a beast by its own bounds to the tier's height, the page's fit
    // (its skeleton shorter than its flesh))
    const { scale: _s, fit: _f, ...body } = e.body, fit = !figure || F.bell ? {} : F.animal ? { fit: { least: H, from: 1 } } : { scale: row.tier };
    part.entities.push({
      ...e,
      body: { ...body, ...fit, hp: row.blows * HERO.blow, hpBar: 'none', radius: R, egg: { a: r3(0.42 * row.tier), c: r3(H / 2), cz: r3(H / 2) } },
      // (on its room's own stretch of the lane, between its walls and short of its doorways)
      // (its FIGHT the director's, boss/stand.js: its moves laid at its tempo, planted through each, its mind crossing its
      // phases; between its moves it fights as its class does)
      rule: { ...e.rule, collideHeight: H, collideRadius: R, rail: { a: [0, P.span[0]], b: [0, P.span[1]], join: P.at, heading: P.heading },
        boss: withLooks({ ...bossRule(castleBoss(row.id), { seed: k + 1, first: 1.5 }), ...(b.room ? { room: [...b.room] } : {}), ...(figure && F.wind ? { wind: structuredClone(F.wind) } : {}) }, row), mind: { ...(e.rule.mind ?? {}), ...bossMind(castleBoss(row.id)), rank: 'boss' } },
    });
  }
  return part;
}

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
  const ids = [...new Set(Bs.map((b) => bossRow(b.name).id))], broke = ids.flatMap((id) => directorLaws(castleBoss(id), body).filter((l) => !l.holds).map((l) => `${id}: ${l.law} (${l.says})`));
  law('fights', !broke.length, broke.length ? `fights that break the director's laws on the lane: ${broke.join('; ')}` : `every boss's fight told, escaped along the lane or over, survivable and opened after, in phases that quicken (${ids.length})`);
  const tight = Bs.filter((b) => b.place.span[1] - b.place.span[0] < FIGHT_ROOM - 1e-9).map((b) => b.name);
  law('room-to-fight', !tight.length, tight.length ? `too little room to fight: ${tight.join(', ')}` : `every boss on ${FIGHT_ROOM} m of lane and more`);
  let most = 0;
  const eases = [];
  for (const b of Bs) { const n = bossRow(b.name).blows; if (n < most * BOSS_EASE - 1e-9) eases.push(b.name); most = Math.max(most, n); }
  law('rising', !eases.length, eases.length ? `the bosses ease going in at ${eases.join(', ')}` : `each boss along the walk as hard as ${BOSS_EASE} of the hardest before it, or harder`);
  return BOSS_LAWS.map((id) => out.find((l) => l.id === id));
}
