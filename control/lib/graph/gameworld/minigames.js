/**
 * MINIGAMES — the book's games inside the game: a fishing pond by the road, a blocks cabinet, a match stall, each kept
 * by someone standing at it. Walk up, press interact, and a round comes up in a pixel window over the field
 * (playscape/ui/minigames.js, the arcade cabinet's own reducers); what it scores pays gold into the bag the party
 * carries, and the first win gives its prize. They may have nothing to do with the journey, as minigames often don't.
 *
 *   minigames?: true | false | [{ game, id?, where?, title?, goal?, gold?, prize?, flag? }]
 *     true    the three (fishing, blocks, match); false: none, whatever the prompt says
 *     game    blocks | match | fishing (playscape/ui/minigames.js MINIGAMES)
 *     where   inside (a building's room: the cabinet in the inn) | trail (beside the way); default: fishing on a trail,
 *             blocks and match inside, each on the other when the game has none of its own
 *   Absent: read from the world's prompt (minigames, carnival, fishing, arcade, match-3 …), else none.
 *
 * Each game is spread across the game in order over the stages of its kind, a keeper standing at its stall. On a trail,
 * a few steps on from the stage's start, beside the way. Inside, in a room that keeps one (ROOMS_KEPT: a tavern's snug
 * or taproom, a hall's hall, a shop's floor, a library's reading room), in its corner farthest from the way in; a
 * building level or the inside of a building entered by its door alike. A city, a roadway, an airspace or an arena
 * keeps none.
 *
 * Pure. `readMinigameBook(v)` the concern read (throws, teaching); `minigamesOfWords(text)` what a prompt asks for;
 * `minigamePlan(G, stages)` the games each stage keeps; `minigameCast(G, stage, ends, { ref, games, bag })` what a stage
 * stands and plays (its keepers stood as stage-figures.js stands every figure).
 */
import { MINIGAMES, MINIGAME_IDS, readMinigames } from '../playscape/ui/minigames.js';
import { libraryFigure, stand } from './stage-figures.js';

export const MINIGAME_KEEPER = Object.freeze({ cast: 'female', palette: { Top: '#2f6b55' } });
const KEEPER_LINE = Object.freeze({ fishing: 'Care to cast a line?', blocks: 'One round on the cabinet?', match: 'Fancy a round of match?' });
// what a prompt's words ask for: a game each, or all three
const WORDS = Object.freeze({
  fishing: ['fishing', 'angling', 'angler'],
  blocks: ['arcade', 'tetris', 'falling-blocks'],
  match: ['match-3', 'match3', 'bejeweled', 'gem-matching'],
  all: ['minigame', 'minigames', 'mini-game', 'mini-games', 'sidegames', 'side-games', 'carnival', 'casino'],
});
const ITEM_KEYS = ['game', 'id', 'where', 'title', 'goal', 'gold', 'prize', 'flag'];
export const WHERE = Object.freeze(['inside', 'trail']);
// where a game is kept when the book does not say
const HOME = Object.freeze({ fishing: 'trail', blocks: 'inside', match: 'inside' });
// the rooms of a building that keep a stall, by its use (era/programs.js), the best first
export const ROOMS_KEPT = Object.freeze({ tavern: ['snug', 'taproom'], hall: ['hall'], keep: ['hall'], shop: ['shopfloor'], library: ['reading'], dwelling: ['hall'] });
// where a keeper can stand: a stage walked along a trail, or a building with a room that keeps one
const ON_TRAIL = (s) => !['building', 'interior', 'city', 'roadway', 'airspace', 'arena'].includes(s.section);
const INSIDE = (s) => (s.section === 'building' || s.section === 'interior') && !!ROOMS_KEPT[s.building?.use];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`gameworld: minigames${m}`);
const r3 = (v) => Math.round(v * 1000) / 1000;

// ids game-wide: the game's own word, then -2, -3 for a second of the same
function withIds(list) {
  const seen = {};
  return list.map((g) => {
    if (g.id) return g;
    seen[g.game] = (seen[g.game] ?? 0) + 1;
    return { ...g, id: seen[g.game] === 1 ? g.game : `${g.game}-${seen[g.game]}` };
  });
}

/** The concern as written, read: a list of games with their ids, or null (none). */
export function readMinigameBook(v) {
  if (v === undefined || v === false) return null;
  if (v === true) return withIds(MINIGAME_IDS.map((game) => ({ game })));
  if (!Array.isArray(v) || !v.length) throw err(` is true, false, or a list of { game, id?, title?, goal?, gold?, prize?, flag? } (game: ${MINIGAME_IDS.join(', ')})`);
  const list = v.map((g, i) => {
    if (typeof g === 'string') g = { game: g };
    if (!isObj(g)) throw err(`[${i}] is { game, id?, … } or a game's name (${MINIGAME_IDS.join(', ')})`);
    for (const k of Object.keys(g)) if (!ITEM_KEYS.includes(k)) throw err(`[${i}].${k} is not part of a minigame here (${ITEM_KEYS.join(', ')})`);
    if (g.where !== undefined && !WHERE.includes(g.where)) throw err(`[${i}].where is ${WHERE.join(' or ')}: in a building's room, or beside a trail`);
    return { ...g };
  });
  const out = withIds(list);
  // the play's own reading, so a wrong game, goal or prize is said where it was written
  try { readMinigames({ minigames: out.map(({ where, ...g }) => g) }); } catch (e) { throw err(e.message.replace(/^play\.minigames/, '')); }
  return out;
}

/** What a prompt's words ask for: the games named (all three for "minigames", "carnival" …), or null. */
export function minigamesOfWords(text) {
  const W = new Set(String(text ?? '').toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean));
  const hit = (k) => WORDS[k].some((w) => W.has(w));
  if (hit('all')) return { games: readMinigameBook(true), words: WORDS.all.filter((w) => W.has(w)) };
  const games = MINIGAME_IDS.filter(hit);
  return games.length ? { games: readMinigameBook(games), words: games.flatMap((g) => WORDS[g].filter((w) => W.has(w))) } : null;
}

/** The games each stage keeps: { [stage index]: [game] }. Each game goes where it is kept (`where`, else its HOME;
 * the other kind when the world has none of that), spread over those stages in order. */
export function minigamePlan(G, stages) {
  const games = G.minigames ?? [];
  const of = (pick) => stages.map((s, i) => [s, i]).filter(([s]) => pick(s) && !s.building?.ref).map(([, i]) => i);
  const kinds = { trail: of(ON_TRAIL), inside: of(INSIDE) };
  if (!games.length || (!kinds.trail.length && !kinds.inside.length)) return null;
  // each game's kind of place: its own, or the other when the world has none of its own
  const placed = games.map((g) => { const w = g.where ?? HOME[g.game] ?? 'trail'; return [g, kinds[w].length ? w : w === 'inside' ? 'trail' : 'inside']; });
  const plan = {};
  for (const w of WHERE) {
    const mine = placed.filter(([, x]) => x === w).map(([g]) => g), at = kinds[w];
    mine.forEach((g, k) => { const i = at[Math.min(at.length - 1, Math.floor((k * at.length) / mine.length))]; (plan[i] ??= []).push(g); });
  }
  // (each stage's games in the book's order)
  for (const i of Object.keys(plan)) plan[i].sort((a, b) => games.indexOf(a) - games.indexOf(b));
  return plan;
}

// a stall inside: in a room that keeps one (the j-th game takes the next such room, then the next corner of it), in
// the corner farthest from where the walker comes in, a step and a bit off the walls, facing the room's middle
function stallInside(ends, j) {
  const rooms = (ROOMS_KEPT[ends.use] ?? []).map((id) => ends.rooms.find((r) => r.id === id)).filter(Boolean);
  if (!rooms.length) return null;
  const r = rooms[j % rooms.length], s = ends.spawn, inset = Math.min(1.3, r.w / 3, r.d / 3);
  const corners = [[r.x + inset, r.y + inset], [r.x + r.w - inset, r.y + inset], [r.x + inset, r.y + r.d - inset], [r.x + r.w - inset, r.y + r.d - inset]]
    .map((c, k) => ({ c, k, d: Math.hypot(c[0] - s[0], c[1] - s[1]) })).sort((a, b) => b.d - a.d || a.k - b.k);
  // (never at the way in: a corner within 3 m of where the walker stands is left, unless every one is)
  const clear = corners.filter((x) => x.d >= 3), from = clear.length ? clear : corners.slice(0, 1);
  const { c } = from[Math.floor(j / rooms.length) % from.length], mid = [r.x + r.w / 2, r.y + r.d / 2];
  return { at: [r3(c[0]), r3(c[1]), r3(s[2] + r.z)], face: r3(Math.atan2(mid[1] - c[1], mid[0] - c[0])) };
}

// a stall's place: in a building, its room's (stallInside); on a trail, a few steps on from the start toward the way on,
// beside it where there is land to stand on
function stallAt(ends, j) {
  if (Array.isArray(ends.rooms)) return stallInside(ends, j);
  const s = ends.spawn, ahead = [...(ends.beats ?? []).filter((b) => b.beat !== 'exit').map((b) => b.at), ends.exit];
  const far = ahead.find((a) => Math.hypot(a[0] - s[0], a[1] - s[1]) > 4) ?? ends.exit;
  const dx = far[0] - s[0], dy = far[1] - s[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const along = Math.min(5 + 3 * j, d * 0.8);
  const ground = typeof ends.ground === 'function' ? ends.ground : () => null;
  for (const side of j % 2 ? [-2.2, 2.2, 0] : [2.2, -2.2, 0]) {
    const x = s[0] + ux * along - uy * side, y = s[1] + uy * along + ux * side, z = ground(x, y);
    if (side === 0 || (z != null && Math.abs(z - s[2]) < 1.2)) return { at: [r3(x), r3(y), r3(z ?? s[2])], face: r3(Math.atan2(s[1] - y, s[0] - x)) };
  }
  return null;
}

/**
 * A stage's minigames: each a keeper standing at its stall, facing back toward the start (inside, the room's middle);
 * interact there and its round comes up. Gold goes into the carried bag (`bag`: the bag mechanic, when nothing else on the stage carries it).
 * → { figures, entities, play: { minigames, cues }, mechanics } (the stage's extra: levels.js stageLevelOrder)
 */
export function minigameCast(G, stage, ends, { ref, games = [], bag = true } = {}) {
  const figures = {}, entities = [], minigames = [], cues = [];
  games.forEach((g, j) => {
    const p = stallAt(ends, j);
    if (!p) return;
    const id = `keeper-${g.id}`;
    stand({ figures, entities }, id, libraryFigure(ref), p.at, p.face);
    const { where, ...own } = g;
    minigames.push({ ...own, at: { at: [p.at[0], p.at[1]], r: 2 }, purse: 'held:bag:gold' });
    cues.push({ id: `keeper-${g.id}-hello`, when: { near: { at: [p.at[0], p.at[1]], r: 3 } }, once: true, then: { say: KEEPER_LINE[g.game] ?? `${MINIGAMES[g.game].name}?`, as: 'toast' } });
  });
  if (!minigames.length) return null;
  return { figures, entities, play: { minigames, cues }, mechanics: bag ? [{ kind: 'bag', slice: 'bag' }] : [] };
}
