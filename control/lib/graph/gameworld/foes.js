/**
 * A GAMEWORLD'S FOES: the foe classes (lib/graph/foes/) a world fields and where its levels stand them. The world keeps
 * a BESTIARY, each entry a class at a rank on a skin; a level names which of them stand on its trails.
 *
 *   foes?: { '<id>': { class, rank?, skill?, skin?: { species?, ooze?, stylism? } | { people, facets? }, vanish? } }
 *                                                                                        // the world's bestiary: a skin is a
 *                                                                                        // beast, or a person or a people
 *
 * A downed foe goes as the game's style guide says (vanish.js: a fade, a sink, motes, a blink or a puff, after it lies
 * a moment); an entry's `vanish` names its own. No carcass is kept.
 *   levels.<id>.foes?: true | { from?: ['<id>'], count? }                                // who stands on its trails
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
 *   foePlacements(G, level, ends)       → [{ id, entry, at, heading, group? }]: who stands where on a stage
 *   hostileCast(G, level, ends, { refs, hero })   → the stage's extra (levels.js stageLevelOrder): the foes' figures and
 *                                         entities, and a hittable pilot; null when nothing stands
 *   stompOf(G)                          → the hero's stomp where foes stand: { low, high, blow, mercy }
 *   withFoeHits(mechanics)              → a level's mechanics with the hero's hp taking each hit (fail-on-death `hits`):
 *                                         the goal's own when it has one, else one laid before its terminal
 *
 * Pure and deterministic: no dice (a foe's place is its beat's).
 */
import { FOE_CLASSES, foeClass } from '../foes/index.js';
import { MOVES } from '../foes/vocab.js';
import { resolveFoe } from '../foes/resolve.js';
import { foeFigure, fieldFigure, facing } from './stage-figures.js';
import { LEVEL_GOAL, PERSON } from './quick.js';
import { HERO } from '../foes/vocab.js';
import { FEELS, FPS } from './feel/cards.js';
import { feelCard } from './feel/lower.js';
import { readVanish, vanishOf } from './vanish.js';
import { peopleRoll, peopleSeed } from '../foes/people.js';
import { rollEgocube } from '../egocube/egocube.js';
import { statureOf } from '../egocube/cast.js';
import { fieldOf } from './casting.js';
import { settingOfGame } from './cast-setting.js';

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const ENTRY_KEYS = ['class', 'rank', 'skill', 'skin', 'vanish'];
// the entry as the foe resolver takes it (its disposal is the gameworld's: vanish.js)
const specOf = ({ vanish, ...spec }) => spec;
const LEVEL_KEYS = ['from', 'count'];
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
    out[id] = { class: e.class, ...(e.rank !== undefined ? { rank: e.rank } : {}), ...(e.skill !== undefined ? { skill: e.skill } : {}), ...(e.skin !== undefined ? { skin: e.skin } : {}), ...(vanish !== undefined ? { vanish } : {}) };
  }
  return out;
}

const fallback = () => Object.fromEntries(Object.keys(FOE_CLASSES).map((c) => [c, { class: c }]));
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
  return { from: [...from], ...(LF.count !== undefined ? { count: LF.count } : {}) };
}

export function fieldedIds(G) {
  const used = new Set();
  for (const id of G.ids) { const LF = G.levels[id].foes; if (LF !== undefined) for (const f of readLevelFoes(LF, G.foes, `levels.${id}`).from) used.add(f); }
  return Object.keys(bestiaryOf(G)).filter((id) => used.has(id));
}

export const foeLook = (entry) => { const f = resolveFoe(specOf(entry)); return { ...f.skin, ...(f.strike ? { strike: f.strike } : {}) }; };

/** A people's roll (foes/people.js): its class's role, its people and facets, in the game's setting, on the entry's own
 * seed. The run makes its sheet from it, and the field rolls the same sheet to draw it. */
export const peopleRollOf = (G, id, entry) => peopleRoll(entry.skin, foeClass(entry.class), { seed: peopleSeed(G.seed, id), setting: settingOfGame(G) });
export const isPeople = (entry) => entry?.skin?.people !== undefined;

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

export function hostileCast(G, level, ends, { refs, hero = true } = {}) {
  const P = foePlacements(G, level, ends);
  if (!P.length) return null;
  const figures = {}, entities = [], sheets = {};
  for (const p of P) {
    const f = resolveFoe({ ...specOf(p.entry), ...(p.group ? { group: p.group } : {}) });
    let b;
    if (isPeople(p.entry)) {
      // a people plays its own moves as a cast member does (casting.js fieldOf: a person over the library's, a people
      // below the hero door on its creature clips), drawn from the sheet the run made it from
      const sheet = sheets[p.eid] ?? (sheets[p.eid] = rollEgocube(peopleRollOf(G, p.eid, p.entry)));
      figures[p.id] = fieldFigure(refs[p.eid], fieldOf({ body: 'person', sheet }));
      b = peopleBody(statureOf({ body: 'person', sheet }), f.scale);
    } else {
      b = beastBody(f.measured, f.scale);
      figures[p.id] = foeFigure(refs[p.eid], { species: f.body, ...(f.strike ? { strike: f.strike } : {}) });
    }
    // (a blade's slot names the body's own figure: the World page draws a body with a loadout as its slots' figures, one
    // per weapon, so a slot naming none would leave the body undrawn)
    const loadout = f.entity.rule.loadout ? { loadout: f.entity.rule.loadout.map((slot) => ({ ...slot, figure: p.id })) } : {};
    entities.push({
      id: p.id, team: 'foes',
      rule: { ...f.entity.rule, ...b.rule, ...loadout },
      ...(f.entity.weapon ? { weapon: f.entity.weapon } : {}),
      // (its hp bar over it only while the hero targets it, clear of its body: the World page's foe bars)
      body: { type: 'figure-rig', figure: p.id, hittable: true, hp: f.toll.hp, poise: 2, radius: b.rule.collideRadius, egg: b.egg, hpBar: 'target', ...(f.scale !== 1 ? { scale: f.scale } : {}), vanish: vanishOf(G, p.entry) },
      transform: { pos: p.at, heading: p.heading },
    });
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

export function withFoeHits(mechanics) {
  const i = mechanics.findIndex((m) => m.kind === 'fail-on-death');
  if (i >= 0) return mechanics.map((m, j) => (j === i && m.hits === undefined ? { ...m, hits: LEVEL_GOAL.hit } : m));
  const death = { kind: 'fail-on-death', startHp: LEVEL_GOAL.hp, hits: LEVEL_GOAL.hit };
  return [...mechanics.slice(0, -1), death, ...mechanics.slice(-1)];
}
