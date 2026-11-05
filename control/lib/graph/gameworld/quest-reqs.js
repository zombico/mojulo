/**
 * THE QUEST AS THE QUEUE — the main quest's beats asked for one at a time (reqs.js). A beat's req names the level the
 * beat is played on, found as a run finds it (main-quest-lay.js questPlays), so everything after it (the level's view,
 * its jobs, the probe, the composite) is a level's as before. Its remit is filled from the quest; the director's own
 * words win, key by key:
 *
 *   beat   the act (its name, its place among the acts and its progression stage) and the beat's goal
 *   band   the act's stage of the hero's progression: early, mid or late
 *   foes   the beat's foes, when it names any
 *   idea   the powers the hero gains on it, when any: the one new thing it teaches
 *   in     the beat before it in the quest's order (the game's start for the first)
 *   out    the beat after it (the quest's ending, or its last beat, for the last)
 *   loop   the core loop's moment and encounter (core-loop.js loopOf): what every level serves
 *
 *   beatUnit(W, id)    → { beat, level, laid }   laid: the level a run would lay, not in the recipe yet
 *   beatRemit(W, id)   → the remit above
 *   questUnits(W)      → { units: [{ beat, level }], planned: [beat id], unhosted: [{ beat, as }] }, in the quest's order
 *
 * Refused (throws, saying what the quest holds): no main quest, a beat it does not have, a planned beat (built: false:
 * nothing to make yet), a beat played on no level (an epoch's map, or a structure the world does not hold).
 *
 * Pure: the world in, the units and remits out. The quest is read as the door reads it (readMainQuest).
 */
import { readMainQuest, mainQuestContext, partsOf, stageOfAct } from './main-quest.js';
import { questPlays } from './main-quest-lay.js';
import { loopOf } from './core-loop.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The quest read, its beats in order with their act and the act's place. */
function questBeats(W) {
  if (!isObj(W?.mainQuest)) throw new Error('design_game: this world has no main quest: write one (gameworld-main-quest), or ask for a level as level:<id>');
  const Q = readMainQuest(W.mainQuest, mainQuestContext(W)), acts = partsOf(Q);
  return { Q, beats: acts.flatMap((A, i) => A.beats.map((B) => ({ B, A, i, n: acts.length }))) };
}

/** The level a beat is played on. */
export function beatUnit(W, id) {
  const { beats } = questBeats(W), at = beats.find((x) => x.B.id === id);
  if (!at) throw new Error(`design_game: the main quest has no beat '${id}' (its beats: ${beats.map((x) => x.B.id).join(', ')})`);
  if (!at.B.built) throw new Error(`design_game: beat '${id}' is planned (built: false): there is nothing to make yet; build it in the quest first`);
  const level = questPlays(W).plays[id];
  if (!level) throw new Error(`design_game: beat '${id}' is played on no level (${at.B.as ? `as ${at.B.as.kind}` : 'its host is missing'}): a level's req cannot name it`);
  return { beat: id, level, laid: !isObj(W.levels?.[level]) };
}

/** The remit a beat's level is asked for with, from the quest. */
export function beatRemit(W, id) {
  const { Q, beats } = questBeats(W), plays = questPlays(W).plays;
  const live = beats.filter((x) => x.B.built && plays[x.B.id]);
  const k = live.findIndex((x) => x.B.id === id);
  const { B, A, i, n } = live[k] ?? beats.find((x) => x.B.id === id);
  const stage = stageOfAct(i, n), shape = Q.shape === 'chapters' ? 'chapter' : 'act';
  const near = (x) => `'${x.B.goal}' (level:${plays[x.B.id]})`;
  const L = loopOf(W);
  return {
    beat: `${shape} ${i + 1} of ${n}${A.name ? `, ${A.name}` : ''} (${stage}): ${B.goal}`,
    band: `${stage}: ${shape} ${i + 1} of ${n}`,
    ...(B.foes?.length ? { foes: B.foes.join(', ') } : {}),
    ...(B.gains?.length ? { idea: `the hero gains ${B.gains.join(', ')} here` } : {}),
    in: k > 0 ? `from ${near(live[k - 1])}` : 'the game\'s start',
    out: k >= 0 && k < live.length - 1 ? `on to ${near(live[k + 1])}` : Q.ending ? `the quest's ending (${Q.ending.beat})` : 'the quest\'s last built beat',
    loop: `${L.moment.join(', ')}; ${L.encounter}`,
  };
}

/** Every built beat's level, in the quest's order; the planned ones and the ones played on no level said. */
export function questUnits(W) {
  const { beats } = questBeats(W), plays = questPlays(W).plays;
  const units = [], planned = [], unhosted = [];
  for (const { B } of beats) {
    if (!B.built) { planned.push(B.id); continue; }
    if (!plays[B.id]) { unhosted.push({ beat: B.id, as: B.as?.kind ?? null }); continue; }
    units.push({ beat: B.id, level: plays[B.id] });
  }
  return { units, planned, unhosted };
}

/** The departments a beat's crew brings beside its level: the foes chapter when it fields foes, the story's when it
 * names its cast or is played as a moment of the story. */
export function beatCrew(W, id) {
  const { beats } = questBeats(W), at = beats.find((x) => x.B.id === id);
  if (!at) return [];
  return [...(at.B.foes?.length ? ['foes'] : []), ...(at.B.who?.length || at.B.as?.kind === 'scene' ? ['story'] : [])];
}
