/**
 * BATTLES — the book's party battles: a concern of the world beside its characters and its systems. The hero and the
 * cast who join it (characters.cast.<id>.joins) are the party, each in a class they can switch; packs of foes stand on
 * the trails' beats, met in order across the game and tougher further on; each stage has a rest at its start; and the
 * party, its levels, classes and skills, goes from level to level in the store's party slice (the party mechanic).
 * The fights themselves are play.rpg (playscape/rpg): this lays it on every stage that has a trail.
 *
 *   battles?: {
 *     party?: { hero?: { class?, name?, level?, bonus?, classes? }, <cast id>: { … } }
 *                          each member's class (hero: fighter; those who join, in turn: mage, cleric, rogue, knight, monk;
 *                          a casting page's (casting.js): the hero and its first party each the class their sheet reads as,
 *                          the rolled party in from the start unless the page gives one a joins flag; a rolled
 *                          familiar beside its keeper, picking for itself: play.rpg `auto`)
 *     packs?: [[foe ids]], the packs met along the way, in walking order across the game's trail stages; past the last,
 *                          the last again (default PACKS)
 *     per?: n,             packs on each trail stage (2), on its beats
 *     boss?: [foe ids],    the last trail stage's last pack, no escape from it
 *     foe?: <hero-door spec>,   how a foe on the map looks (a plain one, by default)
 *     rest?: false,        no rest at each stage's start (default: E there restores HP and MP)
 *     random?: { every?, chance?, after? },   random encounters on the trails, drawn from that stage's packs
 *     classes?, skills?, foes?, items?, gear?, juice?, rules?,   play.rpg's own (playscape/rpg/rpg.js), over the presets
 *   The party and the bag (its items, the gear not worn, and its gold: held:bag:gold) are carried level to level.
 *   }
 * A world that writes none but whose intent fights turn by turn (its cube's power.combat) is laid with the defaults.
 *
 * Pure. `laidBattles(G)` the world with them laid; `readBattles(v, characters)` reads the shape and throws, teaching; `battleBase(G)` is the play.rpg every stage
 * shares (its party, classes, skills, foes, items, rules); `battlePlan(G, stages)` the packs each stage meets;
 * `battleCast(G, stage, ends, { ref, packs, from })` what a stage stands and plays; `battleRoster(G)` the party slice's
 * roster as the game starts.
 */
import { readRpg } from '../playscape/rpg/rpg.js';
import { CLASS_PRESETS, FOE_PRESETS } from '../playscape/rpg/presets.js';
import { rpgInit, rpgSave } from '../playscape/rpg/kernel.js';
import { cubeOfWorld } from './intent.js';
import { castingOf, castingIds } from './casting.js';
import { foeFigure, beastLook, readBeastFoe, stand, facing } from './stage-figures.js';

export const PACKS = Object.freeze([
  ['slime', 'slime'], ['wolf', 'bat'], ['goblin', 'spider', 'slime'], ['skeleton', 'wolf'],
  ['bandit', 'goblin', 'bat'], ['shaman', 'goblin', 'goblin'], ['golem', 'wisp'], ['skeleton', 'skeleton', 'wisp'],
]);
export const JOINER_CLASSES = Object.freeze(['mage', 'cleric', 'rogue', 'knight', 'monk']);
export const BATTLE_FOE = Object.freeze({ cast: 'male', palette: { Top: '#6b2222' }, gear: { right: { item: 'dagger' } } });
export const PARTY_SLICE = 'party';
// the bag the party's items, gear and gold are carried in (the bag mechanic), and what it holds as the game starts
export const BAG_SLICE = 'bag';
export const BAG_START = Object.freeze({ potion: 2 });
// where battles are fought: a stage walked along a trail (its beats); a building, a city and a roadway have none
const FOUGHT = (s) => !['building', 'interior', 'city', 'roadway'].includes(s.section);
const KEYS = ['party', 'packs', 'per', 'boss', 'foe', 'rest', 'random', 'classes', 'skills', 'foes', 'items', 'gear', 'juice', 'rules'];
const MEMBER_KEYS = ['class', 'name', 'level', 'bonus', 'classes', 'gear'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`gameworld: battles${m}`);
const words = (s) => s.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());
const r3 = (v) => Math.round(v * 1000) / 1000;

const packOf = (v, where) => {
  if (!Array.isArray(v) || !v.length || v.length > 6 || !v.every((f) => typeof f === 'string' && f)) throw err(`${where} is a pack: 1 to 6 foe ids (${Object.keys(FOE_PRESETS).join(', ')}, or the world's own foes)`);
  return [...v];
};

/** The concern as written, read; `characters` (the world's, read) say who can be in the party. */
export function readBattles(v, characters = null) {
  if (v === undefined) return null;
  if (!isObj(v)) throw err(' is { party?, packs?, per?, boss?, foe?, rest?, random?, classes?, skills?, foes?, items?, rules? }');
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw err(`.${k} is not part of the battles (${KEYS.join(', ')})`);
  const cast = characters?.cast ?? {};
  // (a casting page's first party may be named too: its ids are read from its words, without rolling, at the largest
  // scale when the page names none, since the prompt's words decide it)
  const rolled = characters?.casting ? new Set(castingIds({ scale: 'journey', ...characters.casting }).filter((x) => x.bond === 'party').map((x) => x.id)) : new Set();
  if (v.party !== undefined) {
    if (!isObj(v.party)) throw err('.party is { hero?: { class }, <cast id>: { class } }: each member\'s class');
    for (const [id, m] of Object.entries(v.party)) {
      if (id !== 'hero' && !cast[id]?.joins && !rolled.has(id)) throw err(`.party.${id}: the party is the hero and the cast who join it (characters.cast.<id>.joins)${cast[id] ? `; give ${id} a joins flag` : ''}`);
      if (!isObj(m)) throw err(`.party.${id} is { class?, name?, level?, bonus?, classes? }`);
      for (const k of Object.keys(m)) if (!MEMBER_KEYS.includes(k)) throw err(`.party.${id}.${k} is not part of a member (${MEMBER_KEYS.join(', ')})`);
    }
  }
  const packs = v.packs === undefined ? null : (Array.isArray(v.packs) && v.packs.length ? v.packs.map((p, i) => packOf(p, `.packs[${i}]`)) : (() => { throw err('.packs is a list of packs, each 1 to 6 foe ids'); })());
  if (v.per !== undefined && !(Number.isInteger(v.per) && v.per >= 0 && v.per <= 6)) throw err('.per is the packs on each trail stage, 0 to 6');
  const boss = v.boss === undefined ? null : packOf(v.boss, '.boss');
  if (v.foe !== undefined && !isObj(v.foe)) throw err('.foe is a hero-door spec (how a foe on the map looks), or { species } for a beast');
  if (beastLook(v.foe)) readBeastFoe(v.foe, null, '.foe', err);
  if (v.rest !== undefined && typeof v.rest !== 'boolean') throw err('.rest is false for no rest at each stage\'s start');
  if (v.random !== undefined) {
    if (!isObj(v.random)) throw err('.random is { every?, chance?, after? }: random encounters on the trails, drawn from each stage\'s packs');
    for (const k of Object.keys(v.random)) if (!['every', 'chance', 'after'].includes(k)) throw err(`.random.${k} is not part of it (every, chance, after)`);
  }
  const out = { ...v, ...(packs ? { packs } : {}), ...(boss ? { boss } : {}) };
  // the play.rpg it makes, read now, so a wrong class, skill, foe or rule is said where it was written
  readRpg({ rpg: battleBase({ battles: out, characters }) });
  for (const p of [...(packs ?? []), ...(boss ? [boss] : [])]) readRpg({ rpg: { ...battleBase({ battles: out, characters }), encounters: [{ id: 'check', foes: p }] } });
  return out;
}

/** The world as the run lays it: a world whose cube fights turn by turn (power.combat turn-based: the jrpg genre, or
 * its own cube) and writes no battles is laid with the defaults, the encounters concern laid as the cover concern is.
 * A quick world is its own (its goal says what it fights). */
export function laidBattles(G) {
  if (G.battles !== undefined || G.quick) return G;
  const c = cubeOfWorld(G).cube.power?.combat;
  return (Array.isArray(c) ? c.includes('turn-based') : c === 'turn-based') ? { ...G, battles: {} } : G;
}

/** The party: the hero first, then each cast member who joins, in the cast's order. */
export function battleParty(G) {
  const P = G.battles?.party ?? {}, out = [];
  const at = (id, cls, name, joins) => {
    const m = P[id] ?? {};
    return { id, name: m.name ?? name, class: m.class ?? cls, ...(m.level !== undefined ? { level: m.level } : {}), ...(m.bonus ? { bonus: m.bonus } : {}), ...(m.classes ? { classes: m.classes } : {}), ...(m.gear ? { gear: m.gear } : {}), ...(joins ? { joins } : {}) };
  };
  const C = G.characters?.casting ? castingOf(G) : null, laid = new Set(G.characters?.rolled ?? []);
  out.push(at('hero', C ? C.anchor.cls : 'fighter', 'Hero', null));
  let k = 0;
  for (const [id, c] of Object.entries(G.characters?.cast ?? {})) if (c.joins && !laid.has(id)) out.push(at(id, JOINER_CLASSES[k++ % JOINER_CLASSES.length], c.name ?? words(id), c.joins));
  for (const M of C?.members ?? []) if (M.bond === 'party') out.push(at(M.id, M.cls, M.name, M.joins ?? null));
  // a familiar of the hero or of a first-party member fights beside its keeper, picking for itself
  const keeperOf = (M) => (M.of === C.sheet.anchor ? 'hero' : C.members.find((K) => K.path === M.of)?.id);
  for (const M of C?.members ?? []) {
    const keeper = M.bond === 'familiar' && keeperOf(M);
    if (keeper && out.some((x) => x.id === keeper)) out.push({ ...at(M.id, M.cls, M.name, M.joins ?? null), auto: { keeper } });
  }
  return out;
}

/** The play.rpg every stage shares, less its encounters. */
export function battleBase(G) {
  const B = G.battles ?? {};
  const own = Object.fromEntries(['classes', 'skills', 'foes', 'items', 'gear', 'juice'].filter((k) => B[k] !== undefined).map((k) => [k, B[k]]));
  // gold is the bag's (held:bag:gold), so it is carried as every item is
  return { party: battleParty(G), ...own, rules: { defeat: 'fail', gold: 'held:bag:gold', ...(B.rules ?? {}) } };
}

// the beats a pack may stand on: along the way, the exit and the trailhead left free
const freeBeats = (ends) => (ends?.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
/** How many packs a stage has room for (its free beats). */
export const roomOf = (ends) => freeBeats(ends).length;

/** The packs each stage meets (by its index in `stages`): `per` on each trail stage (as many as it has room for:
 * `room(i)`, its free beats), the ladder walked in order across the game, the boss as the last pack of the last stage
 * with room. → { [stage index]: [pack] } */
export function battlePlan(G, stages, room = () => Infinity) {
  const B = G.battles ?? {}, packs = B.packs ?? PACKS, per = B.per ?? 2, plan = {};
  let k = 0;
  const fought = stages.map((s, i) => [s, i]).filter(([s]) => FOUGHT(s)).map(([, i]) => i);
  const last = B.boss ? [...fought].reverse().find((i) => Math.min(per || 1, room(i)) > 0) : undefined;
  for (const i of fought) {
    const n = Math.min(i === last ? Math.max(per, 1) : per, room(i)), own = i === last ? n - 1 : n;
    plan[i] = [];
    for (let j = 0; j < own; j++) plan[i].push(packs[Math.min(k++, packs.length - 1)]);
    if (i === last) plan[i].push(B.boss);
  }
  return plan;
}

/**
 * A stage's battles: each pack stands on one of the trail's beats (evenly along it, the exit and the trailhead left
 * free), a foe figure facing back down the way; walking up to it starts the fight, and it falls when the fight is won.
 * A rest at the stage's start. `ref`: the foe figure; `packs`: the stage's; `from`: the game-wide number of its first.
 * → { figures, entities, play, mechanics } (the stage's extra: levels.js stageLevelOrder)
 */
export function battleCast(G, stage, ends, { ref, packs = [], from = 0, seed = 1 } = {}) {
  const B = G.battles ?? {}, base = battleBase(G);
  const along = freeBeats(ends);
  const n = Math.min(packs.length, along.length);
  const picks = Array.from({ length: n }, (_, k) => along[Math.min(along.length - 1, Math.floor(((k + 0.5) * along.length) / n))]);
  const figures = {}, entities = [], encounters = [];
  picks.forEach((b, k) => {
    const id = `foe-${k + 1}`, back = k ? picks[k - 1].at : ends.spawn;
    stand({ figures, entities }, id, foeFigure(ref, B.foe), b.at, facing(b.at, back));
    const boss = B.boss && k === n - 1 && packs[k] === B.boss;
    encounters.push({ id: `pack-${from + k + 1}`, foes: [...packs[k]], at: [b.at[0], b.at[1]], who: id, ...(boss ? { flee: false } : {}) });
  });
  const random = B.random ? { sets: packs.length ? packs.map((p) => [...p]) : [PACKS[0]], ...B.random } : null;
  const rpg = { ...base, ...(encounters.length ? { encounters } : {}), ...(random ? { random } : {}), rules: { ...base.rules, seed } };
  const rest = B.rest === false ? [] : [{ id: 'rpg-rest-spot', when: { use: { at: [ends.spawn[0], ends.spawn[1]], r: 2.5 }, prompt: 'rest' }, then: [{ emit: 'rpg-rest' }, { say: 'Rested', as: 'toast' }] }];
  // the party and the bag carried (the party and bag mechanics); a wiped party fails the level under defeat: 'fail'
  const mechanics = [{ kind: 'party', slice: PARTY_SLICE }, { kind: 'bag', slice: BAG_SLICE }, ...(rpg.rules.defeat === 'fail' ? [{ kind: 'fail-on-death', startHp: 1 }] : [])];
  return { figures, entities, play: { rpg, ...(rest.length ? { cues: rest } : {}) }, mechanics };
}

/** The party slice's roster as the game starts: each member as the battle kernel saves it (numbers only). */
export function battleRoster(G) {
  const cfg = readRpg({ rpg: battleBase(G) });
  return Object.fromEntries(Object.entries(rpgSave(cfg, rpgInit(cfg))).map(([id, stats]) => [id, { name: cfg.party.find((p) => p.id === id).name, level: stats.lv, stats }]));
}

export const BATTLE_CLASSES = Object.freeze(Object.keys(CLASS_PRESETS));
