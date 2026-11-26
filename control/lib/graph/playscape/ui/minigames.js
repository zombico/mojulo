/**
 * MINIGAMES — the games inside the game: a stall at the fair, the pond, the arcade cabinet in the inn. One comes up in
 * a window over the field (the world holds still, as in a battle), plays to its end, and pays what it scored back into
 * the level: gold, a best score, a prize and a flag on a win. Each is a pixelizer reducer with its raster skin
 * (pixelizer/brickster, philosophers-stone, fishing), the same code the arcade cabinet runs, inlined on the page by the
 * minigame channel (scene/channels/minigame-channel.js) only when a level has one.
 *
 *   play.minigames: [{ id, game, at?, prompt?, title?, goal?, gold?, purse?, prize?, flag?, seed?, time?, casts?, lawn?, if?, locked? }]
 *     game    blocks | match | fishing | mowing (MINIGAMES; the first three the stalls a book keeps, STALLS)
 *     at      where it is played: a spot or an anchor (or { at, r } | { anchor, r }); the figure stands there and
 *             presses interact. Without one, anything that emits `minigame:<id>` starts it (a talk's answer, a cue)
 *     prompt  the word beside the key (default: the game's)
 *     goal    the score that wins (default: the game's)
 *     gold    gold paid a point scored (default: the game's rate)
 *     purse   the var the gold goes into (default: play.rpg's gold var, the bag's in a game world; else `gold`); a
 *             holder's (held:bag:gold) is said as a bag transfer, so the bag mechanic carries it
 *     prize   an item (or { item, n }) given the first time it is won; flag: a flag set the first time it is won
 *     time    seconds a round of blocks lasts (default 90), or of mowing (pixelizer/mowing-core.js TIME); casts: fish a
 *             round of fishing (default 5)
 *     lawn    mowing's lawn: { rows, start } (pixelizer/mowing-core.js: a park's tiles and where the mower starts); a
 *             seeded park where absent
 *     if      when its place may start it: { var, gte | … } (playscape/ui/cues.js), as a job's taken flag; `locked` what
 *             is said at it when not
 *
 * Happenings: `minigame:<id>` starts it; `minigame-done:<id>`, then `minigame-won:<id>` or `minigame-lost:<id>`, come
 * back as it closes. Vars: `minigame-best-<id>` (the best score), `minigame-last-<id>` (the last).
 *
 *   readMinigames(play)   → [{ id, game, … }] read, defaults filled, or throws, teaching
 *   minigameCues(play)    → the cues: the use at its place, the first win's prize and flag
 *   withMinigames(play)   → play with those cues appended (the same object without minigames)
 *   lowerMinigames(play)  → { vars, minigames } or null: the page's cfg
 */
import { readRpg } from '../rpg/rpg.js';

export const MINIGAMES = Object.freeze({
  blocks: { name: 'Blocks', prompt: 'play blocks', goal: 800, gold: 0.02, about: 'falling blocks: clear lines before the well fills or the time runs out' },
  match: { name: 'Match', prompt: 'play match', goal: 1000, gold: 0.02, about: 'swap reagents into runs of three against the clock' },
  fishing: { name: 'Fishing', prompt: 'fish', goal: 60, gold: 0.5, about: 'hold the line over the fish until it is landed; a few casts a round' },
  // (a job's, not a stall's: a groundskeeper's lawn, gameworld/jobsified.js; it pays its job, not a rate)
  mowing: { name: 'Mowing', prompt: 'mow the lawn', goal: 850, gold: 0, about: 'a zero-turn mower on a park\'s lawn from above: cut the long grass in stripes, round the trees, off the flowerbeds', stall: false },
});
export const MINIGAME_IDS = Object.freeze(Object.keys(MINIGAMES));
/** The games a book keeps a stall of (gameworld/minigames.js): not a job's. */
export const STALLS = Object.freeze(MINIGAME_IDS.filter((g) => MINIGAMES[g].stall !== false));
export const BLOCKS_TIME = 90;
export const minigameStart = (id) => `minigame:${id}`;
export const bestVar = (id) => `minigame-best-${id}`;
export const lastVar = (id) => `minigame-last-${id}`;

const ID = /^[a-z][a-z0-9-]*$/;
const FLAG = /^[a-z][a-z0-9-]{0,47}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const err = (m) => new Error(`play.minigames${m}`);
const KEYS = ['id', 'game', 'at', 'prompt', 'title', 'goal', 'gold', 'purse', 'prize', 'flag', 'seed', 'time', 'casts', 'lawn', 'if', 'locked'];

export function readMinigames(play) {
  const M = play && play.minigames;
  if (M === undefined) return [];
  if (!Array.isArray(M)) throw err(` is a list of { id, game, at?, prompt?, goal?, gold?, prize?, flag? }: the games inside the game (${MINIGAME_IDS.join(', ')})`);
  const seen = new Set();
  return M.map((g, i) => {
    const at = `[${i}]`;
    if (!isObj(g)) throw err(`${at} is { id, game, at?, … }`);
    for (const k of Object.keys(g)) if (!KEYS.includes(k)) throw err(`${at}.${k} is not part of a minigame (${KEYS.join(', ')})`);
    if (typeof g.id !== 'string' || !ID.test(g.id)) throw err(`${at}.id is a lower-case word (letters, digits, dashes)`);
    if (seen.has(g.id)) throw err(`${at}.id '${g.id}' appears twice`);
    seen.add(g.id);
    const G = MINIGAMES[g.game];
    if (!G) throw err(`${at}.game is one of ${MINIGAME_IDS.join(', ')}`);
    if (g.at !== undefined && !(typeof g.at === 'string' && g.at) && !isObj(g.at)) throw err(`${at}.at is a spot or an anchor (or { at: [x, y], r } | { anchor, r }) where it is played`);
    for (const k of ['prompt', 'title']) if (g[k] !== undefined && !(typeof g[k] === 'string' && g[k])) throw err(`${at}.${k} is words`);
    if (g.goal !== undefined && !(num(g.goal) && g.goal > 0)) throw err(`${at}.goal is the score that wins, above 0`);
    if (g.gold !== undefined && !(num(g.gold) && g.gold >= 0)) throw err(`${at}.gold is the gold paid a point scored (0 pays none)`);
    if (g.purse !== undefined && !(typeof g.purse === 'string' && /^[a-z][a-z0-9:._-]*$/i.test(g.purse))) throw err(`${at}.purse is the var its gold goes into (gold, held:bag:gold)`);
    if (g.seed !== undefined && !Number.isInteger(g.seed)) throw err(`${at}.seed is a whole number`);
    if (g.flag !== undefined && !FLAG.test(g.flag)) throw err(`${at}.flag is the flag its first win sets (a lowercase name: won-the-derby)`);
    const prize = g.prize === undefined ? null : typeof g.prize === 'string' ? { item: g.prize, n: 1 } : g.prize;
    if (prize && !(isObj(prize) && typeof prize.item === 'string' && prize.item && (prize.n === undefined || (Number.isInteger(prize.n) && prize.n > 0)))) throw err(`${at}.prize is an item (or { item, n }) its first win gives`);
    if (g.time !== undefined && (!['blocks', 'mowing'].includes(g.game) || !(num(g.time) && g.time >= 10))) throw err(`${at}.time is the seconds a round of blocks or mowing lasts (10 or more)`);
    if (g.lawn !== undefined && (g.game !== 'mowing' || !isObj(g.lawn) || !Array.isArray(g.lawn.rows) || !g.lawn.rows.length || g.lawn.rows.some((r) => typeof r !== 'string' || r.length !== g.lawn.rows[0].length || !/^[.=T#*]+$/.test(r)) || (g.lawn.start !== undefined && !(Array.isArray(g.lawn.start) && g.lawn.start.length === 3 && g.lawn.start.every(num))))) throw err(`${at}.lawn is mowing's lawn: { rows: [rows of one width, each tile . = T # *], start?: [x, y, heading] }`);
    if (g.if !== undefined && !(isObj(g.if) || (Array.isArray(g.if) && g.if.every(isObj)))) throw err(`${at}.if is when its place may start it: { var, gte | … } (a cue's if)`);
    if (g.locked !== undefined && !(typeof g.locked === 'string' && g.locked)) throw err(`${at}.locked is what is said at its place when its if does not hold`);
    if (g.casts !== undefined && (g.game !== 'fishing' || !(Number.isInteger(g.casts) && g.casts >= 1 && g.casts <= 20))) throw err(`${at}.casts is the fish a round of fishing (1 to 20)`);
    return {
      id: g.id, game: g.game, ...(g.at !== undefined ? { at: g.at } : {}), prompt: g.prompt ?? G.prompt, title: g.title ?? G.name,
      goal: g.goal ?? G.goal, gold: g.gold ?? G.gold, ...(g.purse ? { purse: g.purse } : {}), ...(prize ? { prize: { item: prize.item, n: prize.n ?? 1 } } : {}),
      ...(g.flag ? { flag: g.flag } : {}), ...(g.seed !== undefined ? { seed: g.seed >>> 0 } : {}),
      ...(g.game === 'blocks' ? { time: g.time ?? BLOCKS_TIME } : {}), ...(g.game === 'fishing' && g.casts ? { casts: g.casts } : {}),
      ...(g.game === 'mowing' && g.time !== undefined ? { time: g.time } : {}), ...(g.lawn ? { lawn: { rows: g.lawn.rows.slice(), ...(g.lawn.start ? { start: g.lawn.start.slice() } : {}) } } : {}),
      ...(g.if !== undefined ? { if: g.if } : {}), ...(g.locked ? { locked: g.locked } : {}),
    };
  });
}

export function minigameCues(play) {
  const cues = [];
  for (const g of readMinigames(play)) {
    if (g.at !== undefined) cues.push({ id: `minigame-${g.id}`, when: { use: g.at, prompt: g.prompt }, then: { emit: minigameStart(g.id) }, ...(g.if !== undefined ? { if: g.if } : {}), ...(g.locked ? { else: { say: g.locked, as: 'toast' } } : {}) });
    const first = [...(g.prize ? [{ give: { item: g.prize.item, n: g.prize.n } }] : []), ...(g.flag ? [{ emit: `flag:${g.flag}` }] : [])];
    if (first.length) cues.push({ id: `minigame-${g.id}-prize`, when: { on: `minigame-won:${g.id}` }, once: true, then: first });
  }
  return cues;
}

export function withMinigames(play) {
  if (!play || play.minigames === undefined) return play;
  return { ...play, cues: [...(play.cues || []), ...minigameCues(play)] };
}

// a seed from the id when none is given (FNV-1a), so two stalls in one level never deal the same round
const seedOf = (id) => { let h = 0x811c9dc5; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0; return h; };

export function lowerMinigames(play) {
  const list = readMinigames(play);
  if (!list.length) return null;
  const rpg = play.rpg !== undefined ? readRpg(play) : null;
  const purse0 = rpg ? rpg.rules.gold : 'gold';
  const games = list.map(({ at, prompt, prize, flag, if: _if, locked, ...g }) => ({ ...g, purse: g.purse ?? purse0, seed: g.seed ?? seedOf(g.id) }));
  const vars = {};
  for (const g of games) { vars[g.purse] = 0; vars[bestVar(g.id)] = 0; vars[lastVar(g.id)] = 0; }
  return { vars, minigames: { games } };
}
