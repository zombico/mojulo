/**
 * THE HAND-OFF — where the producer's work ends and the director's begins. The producer has heard the person, placed
 * their game on a rail, said the pitch back and locked it, and (for a designed game) asked its brief. What it hands the
 * director is the chain's FIRST UNIT: the first level, as a req the ledger takes (reqs.js), its remit filled from what
 * the producer settled, so the director starts from the person's game and never from the template alone.
 *
 * It PROPOSES; nothing is raised here. The readout offers it as a step (`hand-off`) with the req ready; the agent
 * raises it with its own ticket (`ask: { intent }`, asks.js: the game it inferred, in its own words, never the
 * person's message), and from there the ledger runs as it always has: what the unit reads and has not settled is
 * asked for first, its jobs are issued, it is received by its machine gate and accepted by the creator.
 *
 *   handOff(world, { units? }) → null | { step: 'hand-off', unit, remit, from, req, move, card }
 *     units    the units the ledger already holds reqs for (['level:first', 'hero' …]): a game whose director is
 *              already at work on a level is handed nothing
 *     unit     the first built beat of the main quest (`beat:<id>`: its remit is the quest's, ours beside it), else
 *              the world's first level (`level:<id>`)
 *     remit    what the first level must be: the template it starts from and that the game is theirs, what it keeps
 *              and where it departs; for a level with no quest behind it, also its place (the game's start, early: the
 *              slice that sets the tone), what it shows (the rail's first level) and the brief's first order
 *     from     what the remit was read from: { rail, brief? }
 *
 * null: no pitch, a pitch not locked yet, a brief still owed (the producer's own steps come first), a quick game (one
 * call made it), or a level already asked for.
 *
 * Pure: the world and the ledger's units in, the proposal out.
 */
import { readRail, railOf, TUNINGS } from './rails.js';
import { producerSteps } from './goalposts.js';
import { resolveGmn, layOrders } from './gmn.js';
import { beatUnit } from './quest-reqs.js';
import { readMainQuest, mainQuestContext, partsOf } from './main-quest.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// the brief's first order (the first level, the slice that sets the tone): stamped, else read from its mix
function firstOrder(world) {
  try {
    const B = world.gameBrief;
    if (!isObj(B)) return null;
    const orders = Array.isArray(B.orders) ? B.orders : layOrders(B.resolved ?? resolveGmn(B.gmn ?? {}));
    return orders.find((o) => o.id === 'lv0') ?? null;
  } catch { return null; }
}

// the main quest's first built beat and the level it is played on, or null (no quest, none built, played on no level)
function firstBeat(world) {
  try {
    if (!isObj(world.mainQuest)) return null;
    const first = partsOf(readMainQuest(world.mainQuest, mainQuestContext(world))).flatMap((A) => A.beats).find((B) => B.built);
    return first ? beatUnit(world, first.id) : null;
  } catch { return null; }
}

export function handOff(world, { units = [] } = {}) {
  if (!isObj(world) || !isObj(world.rail) || world.quick || !isObj(world.levels)) return null;
  const P = (() => { try { return readRail(world.rail); } catch { return null; } })();
  if (!P?.locked || producerSteps(world, { stored: true }).length) return null;
  if (units.some((u) => typeof u === 'string' && u.startsWith('level:'))) return null;
  const R = railOf(P.from), beat = firstBeat(world);
  const level = beat?.level ?? (typeof world.start === 'string' && world.levels[world.start] ? world.start : Object.keys(world.levels)[0]);
  if (!level) return null;
  const order = firstOrder(world);
  const pitch = {
    template: `${R.name}: a template, the game is theirs`,
    keeps: Object.keys(TUNINGS).filter((k) => !P.departs[k]),
    ...(Object.keys(P.departs).length ? { departs: { ...P.departs } } : {}),
  };
  // (a beat's remit is the quest's own, key by key: only what the producer settled is laid beside it)
  const remit = beat ? pitch : {
    in: 'the game\'s start: the first thing the player meets',
    band: 'early: the slice that sets the tone for every level after it',
    idea: `what this game is, in one level (${R.level1})`,
    ...(order ? { beat: order.words } : {}),
    ...pitch,
  };
  const unit = beat ? `beat:${beat.beat}` : `level:${level}`;
  return {
    step: 'hand-off', unit, level, remit,
    from: { rail: P.from, ...(order ? { brief: 'lv0' } : {}), ...(beat ? { quest: beat.beat } : {}) },
    req: { unit, remit },
    move: 'the producer hands the director its first unit: raise it with your ticket ({ ref, ask: { intent }, req }), the intent the game you inferred in your own words; what it reads and has not settled is asked for first',
    card: 'gameworld-ledger',
  };
}
