/**
 * THE CORE LOOP — what the player does, nested from the second to the sitting. Every game has one, long or short; a long
 * game's main quest (main-quest.js) is the loop's outermost turn. Four layers, each feeding the next:
 *
 *   moment     seconds: the verbs pressed again and again (dash, throw, climb, talk)
 *   encounter  minutes: what a stretch of play asks of those verbs (reach the top, clear the arena, sneak past)
 *   reward     what an encounter gives back that feeds the moment (a power, an item, a stat, the next of the story)
 *   session    one sitting of play: a level, a beat of the main quest, a run
 *
 * The recipe (a gameworld's `loop`, the intent chapter's): { moment?: ['<verb>'] | '<words>', encounter?, reward?,
 * session? }. A layer not written is read from the book: the hero's powers' verbs (and moving and jumping), the levels'
 * goals, the beats' gains, the main quest's beats. The reading says where each layer came from.
 *
 * Advised (never refusing): `grounded`, every moment verb is something the hero can do (a power's verb, or a body's own:
 * move, run, jump, climb, talk, look).
 *
 *   readLoop(L)        → the loop as written (throws, teaching, on a malformed one)
 *   loopOf(W)          → { moment: [verbs], encounter, reward, session, from: { <layer>: 'written' | '<what it was read from>' } }
 *   loopLaws(W)        → [{ law, holds, says }]
 *
 * Pure.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const LOOP_LAYERS = Object.freeze({
  moment: 'seconds: the verbs pressed again and again',
  encounter: 'minutes: what a stretch of play asks of them',
  reward: 'what an encounter gives back that feeds the moment',
  session: 'one sitting of play',
});
/** What any hero's body does, powers or none. */
export const BODY_VERBS = Object.freeze(['move', 'walk', 'run', 'jump', 'climb', 'talk', 'look', 'explore']);

export function readLoop(L) {
  if (L === undefined || L === null) return null;
  if (!isObj(L)) throw new Error(`loop is { ${Object.keys(LOOP_LAYERS).map((k) => `${k}?`).join(', ')} }: ${Object.entries(LOOP_LAYERS).map(([k, v]) => `${k}, ${v}`).join('; ')}`);
  for (const k of Object.keys(L)) if (!LOOP_LAYERS[k]) throw new Error(`loop.${k} is not a layer (${Object.keys(LOOP_LAYERS).join(', ')})`);
  if (L.moment !== undefined && !(typeof L.moment === 'string' ? L.moment.trim() : Array.isArray(L.moment) && L.moment.length && L.moment.every((v) => typeof v === 'string' && v.trim()))) {
    throw new Error('loop.moment is the verbs pressed again and again: [\'<verb>\'] or words');
  }
  for (const k of ['encounter', 'reward', 'session']) if (L[k] !== undefined && (typeof L[k] !== 'string' || !L[k].trim())) throw new Error(`loop.${k} is words: ${LOOP_LAYERS[k]}`);
  return L;
}

const verbsOf = (m) => (Array.isArray(m) ? m : String(m).split(/[,;]|\band\b/)).map((v) => v.trim().toLowerCase()).filter(Boolean);
const firstWord = (s) => String(s ?? '').trim().toLowerCase().split(/\s+/)[0] ?? '';
const GOAL_SAYS = { gauntlet: 'clear the arena wave on wave', escape: 'find the way out of the room', boss: 'bring down the boss', guards: 'get past the guards', collect: 'gather what the level holds', survive: 'hold out on the clock' };

// a world that fights in battles (battles.js: written, or a turn-based or tactics genre's, laid at the run): its encounter is
// the battle and its reward the battle's spoils, whatever its levels' goals
const BATTLE_GENRES = Object.freeze({ jrpg: 'turn', tactics: 'board' });
const battlesIn = (W) => (isObj(W.battles) ? (W.battles.on === 'board' ? 'board' : 'turn') : BATTLE_GENRES[W.intent?.from] ?? null);
const BATTLE_SAYS = Object.freeze({
  turn: { encounter: 'a turn-based battle against a pack met on the trail, a boss at the end', reward: 'experience, gold and gear for the party' },
  board: { encounter: 'a tactics battle on a board', reward: 'experience, gold and gear for the party' },
});

export function loopOf(W = {}) {
  const L = readLoop(W.loop) ?? {}, from = {}, fights = battlesIn(W);
  const powers = Array.isArray(W.characters?.hero?.actions?.powers) ? W.characters.hero.actions.powers : [];
  let moment;
  if (L.moment !== undefined) { moment = verbsOf(L.moment); from.moment = 'written'; } else {
    moment = [...new Set(['move', 'jump', ...powers.map((p) => firstWord(p?.verb)).filter(Boolean), ...(fights ? ['fight'] : [])])];
    from.moment = powers.length ? 'the hero\'s powers, and the body\'s moving and jumping' : 'the body\'s moving and jumping';
  }
  const goals = [...new Set(Object.values(isObj(W.levels) ? W.levels : {}).flatMap((l) => Object.keys(isObj(l?.goal) ? l.goal : {})))];
  const quick = typeof W.quick?.goal === 'string' ? W.quick.goal : null;
  const encounter = L.encounter ?? (fights ? BATTLE_SAYS[fights].encounter : goals.length ? goals.map((g) => GOAL_SAYS[g] ?? g).join(', or ') : quick ? `a ${quick} level` : 'reach the level\'s exit');
  from.encounter = L.encounter ? 'written' : fights ? 'the battles' : goals.length ? 'the levels\' goals' : quick ? 'the quick goal' : 'a level\'s exit';
  const parts = isObj(W.mainQuest) ? W.mainQuest.chapters ?? W.mainQuest.acts : null;
  const Q = Array.isArray(parts) ? W.mainQuest : null;
  const gains = Q ? parts.flatMap((A) => (A.beats ?? []).flatMap((B) => B.gains ?? [])) : [];
  const reward = L.reward ?? (fights ? BATTLE_SAYS[fights].reward : gains.length ? 'a power gained on the main quest\'s beats' : Array.isArray(W.errands) && W.errands.length ? 'the errand\'s reward, home' : 'the next level');
  from.reward = L.reward ? 'written' : fights ? 'the battles' : gains.length ? 'the main quest\'s gains' : Array.isArray(W.errands) && W.errands.length ? 'the errands' : 'the game\'s levels';
  const session = L.session ?? (Q ? 'a beat of the main quest' : W.quick?.run ? 'a run' : 'a level');
  from.session = L.session ? 'written' : Q ? 'the main quest' : W.quick?.run ? 'the run' : 'the levels';
  return { moment, encounter, reward, session, from };
}

export function loopLaws(W = {}) {
  if (!isObj(W.loop) || W.loop.moment === undefined) return [];
  const powers = (W.characters?.hero?.actions?.powers ?? []).map((p) => firstWord(p?.verb));
  const can = new Set([...BODY_VERBS, ...powers]);
  const off = verbsOf(W.loop.moment).filter((v) => !can.has(firstWord(v)));
  return [{ law: 'grounded', holds: !off.length, says: off.length ? `the loop's moment asks for ${off.join(', ')}, which the hero cannot do (its powers' verbs: ${powers.join(', ') || 'none'}; its body: ${BODY_VERBS.join(', ')}): give it the power, or change the loop` : 'every moment verb is something the hero can do' }];
}
