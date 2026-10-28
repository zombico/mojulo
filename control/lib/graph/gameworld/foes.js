/**
 * A GAMEWORLD'S FOES: the foe classes (lib/graph/foes/) a world fields and where its levels stand them. The world keeps
 * a BESTIARY, each entry a class at a rank on a skin; a level names which of them stand on its trails.
 *
 *   foes?: { '<id>': { class, rank?, skill?, skin?: { species?, ooze?, stylism? } | { people, facets? } | { meshRef, height? }, vanish? } }
 *                                                                                        // the world's bestiary: a skin is a
 *                                                                                        // beast, a person or a people, or a
 *                                                                                        // model made elsewhere (foes/model.js)
 *
 * A downed foe goes as the game's style guide says (vanish.js: a fade, a sink, motes, a blink or a puff, after it lies
 * a moment); an entry's `vanish` names its own. No carcass is kept.
 *   levels.<id>.foes?: true | { from?: ['<id>'], count?, win? }                          // who stands on its trails, and
 *                                                                                        // how it is won (FOE_WINS: exit | clear)
 *
 * `true` stands the whole bestiary (every class on its stand-in, when the world keeps none), one foe on each of a trail
 * stage's free beats (the exit and the trailhead left clear), cycling through `from`; `count` stands that many instead,
 * the extra ones round the beats. A swarm's placement is a pack of SWARM members sharing one group. Absent at both,
 * nothing is laid: every world as it was.
 *
 *   readBestiary(F)                     → { [id]: entry }, each resolved once (foes/resolve.js) so a bad word or a skin
 *                                         that does not fit its class says so at once; throws `gameworld: foes.<id>: …`
 *   readLevelFoes(LF, bestiary, at)     → { from, count? }: the level's word read against the bestiary
 *   bestiaryOf(G)                       → the entries the world fields: its own, or one per class (keyed by class)
 *   fieldedIds(G)                       → the bestiary ids some level stands, in bestiary order (each one figure to make)
 *   foeLook(entry)                      → { species, ooze?, stylism?, strike? }: the animal door's look for its figure
 *                                         (`strike` its blow's timing, minted as the beast's strike clip)
 *   peopleRollOf(G, id, entry)          → a people's egocube roll (foes/people.js): its sheet is made at foes-<id>-sheet
 *                                         and the character from it at foes-<id>, through its own door with its moves
 *   isPeople(entry)                     → the entry is skinned as a person or a people, not a beast
 *   isModel(entry)                      → the entry is skinned as a model made elsewhere: it stands on its own ref (the
 *                                         sketch its model is bound onto), made by no step, on the library as a person
 *   foePlacements(G, level, ends)       → [{ id, entry, at, heading, group? }]: who stands where on a stage
 *   hostileCast(G, level, ends, { refs, hero })   → the stage's extra (levels.js stageLevelOrder): the foes' figures and
 *                                         entities, and a hittable pilot; null when nothing stands
 *   stompOf(G)                          → the hero's stomp where foes stand: { low, high, blow, mercy }
 *   withFoeWin(G, level, ends, mechanics)   → a stage won by clearing it: its exit's reach replaced by every foe on it down
 *   withFoeHits(mechanics)              → a level's mechanics with the hero's hp taking each hit (fail-on-death `hits`):
 *                                         the goal's own when it has one, else one laid before its terminal
 *
 * Pure and deterministic: no dice (a foe's place is its beat's).
 */
import { FOE_CLASSES, foeClass } from '../foes/index.js';
import { MOVES } from '../foes/vocab.js';
import { resolveFoe } from '../foes/resolve.js';
import { foeFigure, fieldFigure, modelFigure, facing } from './stage-figures.js';
import { isModelSkin } from '../foes/model.js';
import { LEVEL_GOAL, PERSON } from './quick.js';
import { HERO } from '../foes/vocab.js';
import { FEELS, FPS } from './feel/cards.js';
import { feelCard } from './feel/lower.js';
import { readVanish, vanishOf } from './vanish.js';
import { readStates, stateBirth } from '../foes/states.js';
import { trailContext } from './juice.js';
import { resolveTrailColor } from '../scene/juice-style.js';
import { peopleRoll, peopleSeed } from '../foes/people.js';
import { rollEgocube } from '../egocube/egocube.js';
import { statureOf } from '../egocube/cast.js';
import { fieldOf } from './casting.js';
import { settingOfGame } from './cast-setting.js';

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const ENTRY_KEYS = ['class', 'rank', 'skill', 'skin', 'vanish', 'states', 'summons', 'pair', 'becomes'];
// the entry as the foe resolver takes it (its disposal is the gameworld's: vanish.js; what it calls, the bestiary's)
const specOf = ({ vanish, states, summons, pair, becomes, ...spec }) => spec;
/** A summoner's call (worlds/controllable/summon.js): how many of its summons may be up at once, the seconds between
 * calls, the hero's distance that starts them, how far round it they arrive (m) and the transit they arrive by. */
export const SUMMON = Object.freeze({ count: 3, at: 2, every: 4, radius: 14, ring: 1.8, with: 'smoke' });
const SUMMONS_KEYS = ['foe', 'count', 'bound'];
/** The most modes a foe is defeated through (its own and the entries it `becomes`, in turn). */
export const MAX_MODES = 4;
/** An entry's modes: itself, then each entry it `becomes`, in turn (worlds/controllable/vanish.js `body.modes`). */
export function modeChain(F, id) {
  const out = [id];
  for (let at = F[id]?.becomes; at !== undefined; at = F[at]?.becomes) out.push(at);
  return out;
}
/** A pair's rows (worlds/controllable/pair.js): what one does when its partner fell (`down`), and how far it stands off. */
export const PAIR_DOWNS = Object.freeze(['enrage', 'revive']);
const PAIR = Object.freeze({ apart: 2.5, back: 6 });
const PAIR_KEYS = ['foe', 'cover', 'down', 'swap'];
// a pair's `pair` (docs/foes.md, relations): another entry of the bestiary that stands with it, the two sharing a fate
function readPair(v, at, id, F) {
  if (!isObj(v)) throw new Error(`${at} is { foe, cover?, down?, swap? }: the bestiary's foe it stands with, whether each covers the other reeling (true), what one does when the other falls (${PAIR_DOWNS.join(' | ')}: enrage) and the share of its health under which it swaps out`);
  for (const k of Object.keys(v)) if (!PAIR_KEYS.includes(k)) throw new Error(`${at}.${k} is not a pair setting (${PAIR_KEYS.join(', ')})`);
  if (!F[v.foe] || v.foe === id) throw new Error(`${at}.foe is another foe of the bestiary (${Object.keys(F).filter((k) => k !== id).join(', ') || 'none yet'})`);
  if (F[v.foe].pair !== undefined || F[v.foe].summons !== undefined) throw new Error(`${at}.foe: '${v.foe}' has a relation of its own (a pair stands with a foe that has none)`);
  if (v.cover !== undefined && typeof v.cover !== 'boolean') throw new Error(`${at}.cover is true (each covers the other reeling) or false`);
  if (v.down !== undefined && !PAIR_DOWNS.includes(v.down)) throw new Error(`${at}.down is what one does when the other falls: ${PAIR_DOWNS.join(' | ')}`);
  if (v.swap !== undefined && !(Number.isFinite(v.swap) && v.swap > 0 && v.swap < 1)) throw new Error(`${at}.swap is the share of its health under which one leaves the field while the other stands, 0 … 1`);
  return { foe: v.foe, ...(v.cover !== undefined ? { cover: v.cover } : {}), ...(v.down !== undefined ? { down: v.down } : {}), ...(v.swap !== undefined ? { swap: v.swap } : {}) };
}
// a summoner's `summons` (foes/classes/summoner.js): another entry of the bestiary, how many it is minted with, and whether
// its fate is bound to the summoner's
function readSummons(v, at, id, F) {
  if (!isObj(v)) throw new Error(`${at} is { foe, count?, bound? }: the bestiary's foe it calls, how many (${SUMMON.count}), and whether they fall with it (true)`);
  for (const k of Object.keys(v)) if (!SUMMONS_KEYS.includes(k)) throw new Error(`${at}.${k} is not a summons setting (${SUMMONS_KEYS.join(', ')})`);
  if (!F[v.foe] || v.foe === id) throw new Error(`${at}.foe is another foe of the bestiary (${Object.keys(F).filter((k) => k !== id).join(', ') || 'none yet'})`);
  if (F[v.foe].class === 'summoner') throw new Error(`${at}.foe: '${v.foe}' is a summoner, and a summoner does not call a summoner`);
  if (v.count !== undefined && !(Number.isInteger(v.count) && v.count >= 1 && v.count <= 8)) throw new Error(`${at}.count is a whole number, 1 to 8`);
  if (v.bound !== undefined && typeof v.bound !== 'boolean') throw new Error(`${at}.bound is true (they fall with it) or false (they fight on)`);
  return { foe: v.foe, ...(v.count !== undefined ? { count: v.count } : {}), ...(v.bound !== undefined ? { bound: v.bound } : {}) };
}
const LEVEL_KEYS = ['from', 'count', 'win'];
/** How a stage its foes stand on is won: `exit` (the default: reach its exit, the foes in the way) or `clear` (every foe on it
 * down, a summoner's summons with it). */
export const FOE_WINS = Object.freeze(['exit', 'clear']);
export const SWARM = 3;
export const MAX_FOES = 32;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function readBestiary(F) {
  if (!isObj(F) || !Object.keys(F).length) throw new Error('gameworld: foes is the bestiary, { <id>: { class, rank?, skill?, skin?, vanish? } }, at least one (or leave it out)');
  const out = {};
  for (const [id, e] of Object.entries(F)) {
    const at = `gameworld: foes.${id}`;
    if (!ID.test(id)) throw new Error(`${at}: an id is a short lower-case name (letters, digits, hyphens)`);
    if (!isObj(e)) throw new Error(`${at} is { class, rank?, skill?, skin?, vanish? } (classes: ${Object.keys(FOE_CLASSES).join(', ')})`);
    for (const k of Object.keys(e)) if (!ENTRY_KEYS.includes(k)) throw new Error(`${at}.${k} is not a foe setting (${ENTRY_KEYS.join(', ')})`);
    try { resolveFoe(specOf(e)); } catch (err) { throw new Error(`${at}: ${err.message.replace(/^foe: /, '')}`); }
    const vanish = e.vanish !== undefined ? readVanish(e.vanish, `${at}.vanish`) : undefined;
    const states = e.states !== undefined ? readStates(e.states, `${at}.states`) : undefined;
    out[id] = { class: e.class, ...(e.rank !== undefined ? { rank: e.rank } : {}), ...(e.skill !== undefined ? { skill: e.skill } : {}), ...(e.skin !== undefined ? { skin: e.skin } : {}), ...(vanish !== undefined ? { vanish } : {}), ...(states !== undefined && Object.keys(states).length ? { states } : {}) };
  }
  // (what a summoner calls: read once every entry is known)
  for (const [id, e] of Object.entries(F)) {
    const at = `gameworld: foes.${id}`;
    if (e.class === 'summoner' && e.summons === undefined) throw new Error(`${at}: a summoner names what it calls, summons: { foe, count?, bound? }`);
    if (e.summons !== undefined && e.class !== 'summoner') throw new Error(`${at}.summons: only a summoner calls (its class is ${e.class})`);
    if (e.summons !== undefined) out[id].summons = readSummons(e.summons, `${at}.summons`, id, F);
    if (e.pair !== undefined && e.summons !== undefined) throw new Error(`${at}: a summoner and a pair are two relations; name one`);
    if (e.pair !== undefined) out[id].pair = readPair(e.pair, `${at}.pair`, id, F);
    // MODES (`becomes`: the entry it becomes when defeated, docs/foes.md): another entry, no loop, at most MAX_MODES in all
    if (e.becomes !== undefined) {
      if (typeof e.becomes !== 'string' || !F[e.becomes] || e.becomes === id) throw new Error(`${at}.becomes is the foe of the bestiary it becomes when defeated (${Object.keys(F).filter((k) => k !== id).join(', ') || 'none yet'})`);
      const seen = new Set([id]);
      for (let x = e.becomes; x !== undefined; x = F[x].becomes) {
        if (seen.has(x)) throw new Error(`${at}.becomes: its modes loop back (${[...seen, x].join(' → ')})`);
        seen.add(x);
        if (F[x].summons !== undefined || F[x].pair !== undefined) throw new Error(`${at}.becomes: '${x}' has a relation of its own (a mode is a body, its relations its first's)`);
      }
      if (seen.size > MAX_MODES) throw new Error(`${at}.becomes: ${seen.size} modes, at most ${MAX_MODES}`);
      out[id].becomes = e.becomes;
    }
  }
  return out;
}

// (a summoner on its stand-in calls the walker's)
const fallback = () => Object.fromEntries(Object.keys(FOE_CLASSES).map((c) => [c, { class: c, ...(c === 'summoner' ? { summons: { foe: 'walker' } } : {}) }]));
export const bestiaryOf = (G) => G.foes ?? fallback();

export function readLevelFoes(LF, bestiary, at) {
  const B = bestiary ?? fallback(), ids = Object.keys(B);
  if (LF === true) return { from: ids };
  if (!isObj(LF)) throw new Error(`gameworld: ${at}.foes is true (the bestiary) or { from?: [<id>], count? }`);
  for (const k of Object.keys(LF)) if (!LEVEL_KEYS.includes(k)) throw new Error(`gameworld: ${at}.foes.${k} is not a level's foes setting (${LEVEL_KEYS.join(', ')})`);
  const from = LF.from ?? ids;
  if (!Array.isArray(from) || !from.length) throw new Error(`gameworld: ${at}.foes.from is a list of the bestiary's ids, at least one (${ids.join(', ')})`);
  for (const id of from) if (!B[id]) throw new Error(`gameworld: ${at}.foes.from: '${id}' is not in the bestiary (${ids.join(', ')})`);
  if (LF.count !== undefined && !(Number.isInteger(LF.count) && LF.count >= 1 && LF.count <= MAX_FOES)) throw new Error(`gameworld: ${at}.foes.count is a whole number, 1 to ${MAX_FOES}`);
  if (LF.win !== undefined && !FOE_WINS.includes(LF.win)) throw new Error(`gameworld: ${at}.foes.win is how the stage is won: exit (reach it) or clear (every foe down)`);
  return { from: [...from], ...(LF.count !== undefined ? { count: LF.count } : {}), ...(LF.win !== undefined ? { win: LF.win } : {}) };
}

export function fieldedIds(G) {
  const used = new Set();
  for (const id of G.ids) { const LF = G.levels[id].foes; if (LF !== undefined) for (const f of readLevelFoes(LF, G.foes, `levels.${id}`).from) used.add(f); }
  // (and what a summoner it fields calls, and who a pair stands with)
  for (const id of [...used]) { const E = bestiaryOf(G)[id]; if (E?.summons) used.add(E.summons.foe); if (E?.pair) used.add(E.pair.foe); }
  // (and the modes each of them becomes)
  for (const id of [...used]) for (const m of modeChain(bestiaryOf(G), id)) used.add(m);
  return Object.keys(bestiaryOf(G)).filter((id) => used.has(id));
}

export const foeLook = (entry) => { const f = resolveFoe(specOf(entry)); return { ...f.skin, ...(f.strike ? { strike: f.strike } : {}) }; };

/** A people's roll (foes/people.js): its class's role, its people and facets, in the game's setting, on the entry's own
 * seed. The run makes its sheet from it, and the field rolls the same sheet to draw it. */
export const peopleRollOf = (G, id, entry) => peopleRoll(entry.skin, foeClass(entry.class), { seed: peopleSeed(G.seed, id), setting: settingOfGame(G) });
export const isPeople = (entry) => entry?.skin?.people !== undefined;
export const isModel = (entry) => isModelSkin(entry?.skin);

const freeBeats = (ends) => (ends?.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
// the k-th of n bodies round a point, `r` out, the first on it
const round = (at, k, n, r) => (k === 0 ? at : [r3(at[0] + r * Math.cos((2 * Math.PI * k) / n)), r3(at[1] + r * Math.sin((2 * Math.PI * k) / n)), at[2]]);

export function foePlacements(G, level, ends) {
  const LF = G.levels[level]?.foes;
  if (LF === undefined) return [];
  const along = freeBeats(ends);
  if (!along.length) return [];
  const { from, count = along.length } = readLevelFoes(LF, G.foes, `levels.${level}`), B = bestiaryOf(G), out = [];
  for (let k = 0; k < count; k++) {
    const beat = along[k % along.length], lap = Math.floor(k / along.length), eid = from[k % from.length], entry = B[eid];
    const back = (k % along.length) ? along[(k % along.length) - 1].at : ends.spawn;
    const at = lap ? round(beat.at, lap, Math.ceil(count / along.length), 2.5) : beat.at;
    const pack = MOVES[foeClass(entry.class).move].group ? SWARM : 1;
    for (let j = 0; j < pack; j++) out.push({ id: `foe-${eid}-${out.filter((p) => p.eid === eid).length + 1}`, eid, entry, at: round(at, j, pack, 1.2), heading: facing(at, back), ...(pack > 1 ? { group: `${eid}-${k + 1}` } : {}) });
  }
  return out;
}

// a beast's body in the field, by its grown size (foes/fit.js bodyOf) drawn at its game scale (its class's presence):
// what it collides with and where it is hit
function beastBody(measured, scale) {
  const extent = measured.extent * scale, height = measured.height * scale;
  return {
    rule: { eye: 0, step: 0.3, stride: r3(Math.max(0.3, extent * 0.6)), collideRadius: r3(clamp(extent * 0.25, 0.15, 2.5)), collideHeight: r3(Math.max(0.2, height)) },
    egg: { a: r3(clamp(extent * 0.3, 0.2, 3)), c: r3(Math.max(0.15, height / 2)), cz: r3(Math.max(0.15, height / 2)) },
  };
}

// a people's body in the field: a person's, at its rolled stature grown by its rank
function peopleBody(height, scale) {
  const h = height * scale;
  return {
    rule: { eye: 0, step: 0.3, stride: r3(1.6 * scale), collideRadius: r3(0.3 * scale), collideHeight: r3(h) },
    egg: { a: r3(PERSON.a * scale), c: r3(h / 2), cz: r3(h / 2) },
  };
}

// a foe's figure into the part, by its skin (a game's own, a model, a people, a beast), and the body it stands in
function figureFor(G, C, part, id, eid, entry, f, { ref = null, figure = null } = {}) {
  const had = part.figures[id];
  if (figure) {
    // a game's own person, made by its own door: drawn as it is, at a person's height grown by its rank
    part.figures[id] = figure;
    return peopleBody(2 * PERSON.c, f.scale);
  }
  if (isModel(entry)) {
    // a MODEL made elsewhere (foes/model.js): worn as a person on the library, stood at its height grown by its rank
    part.figures[id] = had ?? modelFigure(ref, f.measured.height);
    return peopleBody(f.measured.height, f.scale);
  }
  if (isPeople(entry)) {
    // a people plays its own moves as a cast member does (casting.js fieldOf: a person over the library's, a people
    // below the hero door on its creature clips), drawn from the sheet the run made it from
    const sheet = C.sheets[eid] ?? (C.sheets[eid] = rollEgocube(peopleRollOf(G, eid, entry)));
    part.figures[id] = had ?? fieldFigure(ref, fieldOf({ body: 'person', sheet }));
    return peopleBody(statureOf({ body: 'person', sheet }), f.scale);
  }
  part.figures[id] = had ?? foeFigure(ref, { species: f.body, ...(f.strike ? { strike: f.strike } : {}) });
  return beastBody(f.measured, f.scale);
}

/**
 * THE STAND STEP every hostile goes through (the bestiary's, a shooter's hunters, a sneak's guards): one foe stood into a
 * part's { figures, entities }, its figure and its entity, with everything layer 0 carries (its class's mind and attack,
 * its hit egg and health, its death in the game's register, its base states, the target rim and its bar).
 *   p      { id, eid?, entry, at, heading, group? }   the placement; `entry` a bestiary entry ({ class, skin?, … })
 *   ref    the figure's sketch (its people's, its model's, its beast's)
 *   figure a figure already made (a game's own person on the library): drawn as it is, on a person's body
 *   more   { rule?, dormant?, modeRefs? }   what the bestiary lays beside (a summoner's call, a summons' sleep, its modes'
 *          figures' sketches)
 *   tune   { team?, rule?, body?, weapon? }   a game type's own numbers over the class's (a shooter's gun, a sneak's
 *          unhittable watchers), laid last and kept small: the class says what it is, the game what it plays at
 *   ctx    { rim, sheets }   the world's rim colour and the people's sheets rolled (hostileCast shares them)
 * → the entity. Pure.
 */
export function standFoe(G, part, p, { ref = null, figure = null, more = {}, tune = null, ctx = null } = {}) {
  const C = ctx ?? { rim: targetRimOf(G), sheets: {} };
  const f = resolveFoe({ ...specOf(p.entry), ...(p.group ? { group: p.group } : {}) });
  // (its figure is its ENTRY's, `foe-<entry>`, shared by every body that entry stands, a summons or a mode included: the
  // page builds each body its own rig from one pack; a game's own figure, made per body, keeps the body's name)
  const fig = !figure && p.eid ? `foe-${p.eid}` : p.id;
  const b = figureFor(G, C, part, fig, p.eid, p.entry, f, { ref, figure });
  // its MODES (`becomes`): each a figure of its own on the same stick figure, its health and its class's rule; only the
  // last, layer 0, dies (worlds/controllable/vanish.js), so the death is the last's
  const B = G ? bestiaryOf(G) : null, chain = B && p.eid && p.entry.becomes !== undefined ? modeChain(B, p.eid) : null;
  const modes = chain ? chain.map((eid, k) => {
    if (!k) return { figure: fig, hp: f.toll.hp };
    const fk = resolveFoe(specOf(B[eid])), id = `foe-${eid}`;
    figureFor(G, C, part, id, eid, B[eid], fk, { ref: more.modeRefs?.[eid] ?? null });
    const lo = fk.entity.rule.loadout ? { loadout: fk.entity.rule.loadout.map((slot) => ({ ...slot, figure: id })) } : {};
    return { figure: id, hp: fk.toll.hp, rule: { ...fk.entity.rule, ...lo } };
  }) : null;
  const last = chain ? B[chain[chain.length - 1]] : p.entry;
  // (a blade's slot names the body's own figure: the World page draws a body with a loadout as its slots' figures, one
  // per weapon, so a slot naming none would leave the body undrawn)
  const loadout = f.entity.rule.loadout ? { loadout: f.entity.rule.loadout.map((slot) => ({ ...slot, figure: fig })) } : {};
  const T = tune ?? {}, weapon = T.weapon ?? f.entity.weapon;
  const e = {
    id: p.id, team: T.team ?? 'foes',
    rule: { ...f.entity.rule, ...b.rule, ...loadout, ...(more.rule || {}), ...(T.rule || {}) },
    ...(weapon ? { weapon: { ...weapon } } : {}),
    // (its hp bar over it only while the hero targets it, clear of its body: the World page's foe bars)
    // (and a rim of light round it while it is the one targeted, in the world's accent: the page's target rim)
    // (its base STATES, born in: foes/states.js, carried by layer 0 and so by every mode it wears)
    body: { type: 'figure-rig', figure: fig, hittable: true, hp: f.toll.hp, poise: 2, radius: b.rule.collideRadius, egg: b.egg, hpBar: 'target', targetRim: C.rim, ...(f.scale !== 1 ? { scale: f.scale } : {}), vanish: vanishOf(G, last), ...(modes ? { modes } : {}), ...(p.entry && p.entry.states ? { born: stateBirth(p.entry.states, { height: 2 * b.egg.cz }) } : {}), ...(T.body || {}) },
    transform: { pos: p.at, heading: p.heading },
    ...(more.dormant ? { dormant: true } : {}),
  };
  part.entities.push(e);
  return e;
}

export function hostileCast(G, level, ends, { refs, hero = true } = {}) {
  const P = foePlacements(G, level, ends);
  if (!P.length) return null;
  const figures = {}, entities = [], part = { figures, entities };
  // the target rim's colour: the world's accent (its juice's trail palette), the same on every foe it lays
  const ctx = { rim: targetRimOf(G), sheets: {} };
  const standOne = (p, more = {}) => standFoe(G, part, p, { ref: refs[p.eid], more: { ...more, modeRefs: refs }, ctx });
  const B = bestiaryOf(G);
  for (const p of P) {
    const S = p.entry.summons, Q = p.entry.pair;
    if (Q) {
      // a PAIR (worlds/controllable/pair.js): its partner stands beside it, each naming the other
      const h = p.heading ?? 0, side = [Math.cos(h + Math.PI / 2) * PAIR.apart, Math.sin(h + Math.PI / 2) * PAIR.apart];
      const pid = `${p.id}-p`, rows = { cover: Q.cover ?? true, down: Q.down ?? 'enrage', ...(Q.swap !== undefined ? { swap: Q.swap, back: PAIR.back } : {}) };
      standOne(p, { rule: { pair: { with: pid, ...rows } } });
      standOne({ id: pid, eid: Q.foe, entry: B[Q.foe], at: [r3(p.at[0] + side[0]), r3(p.at[1] + side[1]), p.at[2]], heading: p.heading }, { rule: { pair: { with: p.id, ...rows } } });
      continue;
    }
    if (!S) { standOne(p); continue; }
    // a SUMMONER (foes/classes/summoner.js): its summons minted with it, asleep where it stands, called a few at a time
    // (worlds/controllable/summon.js); bound, they fall with it
    const n = S.count ?? SUMMON.count, bound = S.bound ?? true, ids = Array.from({ length: n }, (_, k) => `${p.id}-s${k + 1}`);
    standOne(p, { rule: { summon: { ids, at: Math.min(SUMMON.at, n), every: SUMMON.every, wind: r3(resolveFoe(specOf(p.entry)).attack.timing.startup / 60), radius: SUMMON.radius, ring: SUMMON.ring, with: SUMMON.with } } });
    ids.forEach((id) => standOne({ id, eid: S.foe, entry: B[S.foe], at: p.at, heading: p.heading }, { dormant: true, rule: { summoned: { by: p.id, bound } } }));
  }
  // the hero takes their hits: hittable (a person's egg over its feet, or under the eye a first-person walker walks at);
  // a hero with legs stomps them (worlds/controllable/foe.js)
  const pilot = { ...(hero ? { rule: { stomp: stompOf(G) } } : {}), body: { hittable: true, radius: 0.5, egg: { ...PERSON, cz: hero ? PERSON.c : PERSON.c - 1.7 } } };
  return { figures, entities, pilot };
}

/** The hero's stomp (worlds/controllable/foe.js `rule.stomp`): the world's feel card's bounce when it stomps (its
 * `land: stomp`), else the action lab's platformer card's; a blow of the hero's (HERO.blow, the foes' hp frame); the
 * mercy after a touch, its card's `hit.mercy` frames. */
export function stompOf(G) {
  const own = G.feel ? feelCard(G.feel) : null, C = own && own.land?.model === 'stomp' ? own : FEELS.platformer;
  const r3 = (v) => Math.round(v * 1000) / 1000, mercy = (own ?? C).hit?.mercy || C.hit.mercy;
  return { low: C.land.low, high: r3(C.land.high), blow: HERO.blow, mercy: r3(mercy / FPS) };
}

/** A stage won by clearing it (`levels.<id>.foes.win: 'clear'`): its mechanics with the exit's reach replaced by every
 * foe stood on it down (game/mechanics.js defeat-all over the cast's own falls: a summoner's summons counted, those it
 * never called dropped as it falls); a stage that names no clear, or stands none, as it was. */
export function withFoeWin(G, level, ends, mechanics) {
  const LF = G.levels[level]?.foes;
  if (LF === undefined || readLevelFoes(LF, G.foes, `levels.${level}`).win !== 'clear') return mechanics;
  const B = bestiaryOf(G), P = foePlacements(G, level, ends);
  const count = P.reduce((n, p) => n + 1 + (B[p.eid]?.summons ? B[p.eid].summons.count ?? SUMMON.count : 0) + (B[p.eid]?.pair ? 1 : 0), 0);
  if (!count) return mechanics;
  const clear = { kind: 'defeat-all', who: 'foe-*', count, label: 'Down' };
  return mechanics.some((m) => m.kind === 'reach-exit') ? mechanics.map((m) => (m.kind === 'reach-exit' ? clear : m)) : [...mechanics, clear];
}

export function withFoeHits(mechanics) {
  const i = mechanics.findIndex((m) => m.kind === 'fail-on-death');
  if (i >= 0) return mechanics.map((m, j) => (j === i && m.hits === undefined ? { ...m, hits: LEVEL_GOAL.hit } : m));
  const death = { kind: 'fail-on-death', startHp: LEVEL_GOAL.hp, hits: LEVEL_GOAL.hit };
  return [...mechanics.slice(0, -1), death, ...mechanics.slice(-1)];
}

/** The TARGET RIM's colour (the World page's rim of light round the foe the hero targets): the world's accent, its
 * juice's trail palette, rounded; a world with none, a warm white. */
export function targetRimOf(G) {
  let c = null; try { c = resolveTrailColor('palette', trailContext(G)); } catch { c = null; }
  return Array.isArray(c) && c.length === 3 ? c.map((x) => Math.round(x * 1000) / 1000) : [1, 0.86, 0.6];
}
