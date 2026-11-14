/**
 * A GAME'S SET-UP — what the player chooses before a level loads, said once on the gameworld (`setup`) and lowered into
 * every level's turn (game/turn.js: untap, the picks, then the load). The game director's, on the flow's page: the
 * flow says what plays when, the set-up what is asked before a level plays.
 *
 *   setup: {
 *     difficulty?: true | { ask?, hint?, options?: [tier | { id: tier, name?, about? }] }
 *                  how hard the foes play, picked before a level: the engine's own tiers (worlds/controllable/mind.js
 *                  AI_DIFFICULTY: easy, medium, max), each in the game's words. The play shell hands the level the pick
 *                  as params.difficulty, which tunes its foes' minds; a level with no minds plays as it did
 *     picks?:      [a turn's picks]   any other choice, as game/turn.js says a pick: { id, from: { slice } | { options },
 *                  min?, max?, ask?, hint? } (a slice is one of the game's store, consumed by its levels: the party)
 *   }
 *
 *   SETUP_KEYS · DIFFICULTY_TIERS
 *   readSetup(setup, where?)     → errors[] (teaching)
 *   setupPicks(setup)            → the turn's picks it makes, the difficulty first ([] for none)
 *   withSetup(flow, setup)       → the flow, each of its level steps that says no picks of its own asking these
 *
 * Pure. A world that says no set-up adds nothing.
 */
import { readTurn } from '../game/turn.js';

export const SETUP_KEYS = Object.freeze(['difficulty', 'picks']);
/** The engine's tiers, each as a game says it when it says no words of its own. */
export const DIFFICULTY_TIERS = Object.freeze({
  easy: Object.freeze({ name: 'Easy', about: 'Foes are slow to act and keep their distance.' }),
  medium: Object.freeze({ name: 'Normal', about: 'Foes press, and step out of the way.' }),
  max: Object.freeze({ name: 'Hard', about: 'Foes at their sharpest: they read an opening and take it.' }),
});
const TIERS = Object.keys(DIFFICULTY_TIERS);
const DIFFICULTY_KEYS = ['ask', 'hint', 'options'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const tierOf = (o) => (isObj(o) ? o.id : o);

/** A set-up as written: every fault said, with what it should be. */
export function readSetup(setup, where = 'setup') {
  if (!isObj(setup)) return [`${where} is { difficulty?, picks? }: what the player chooses before a level loads`];
  const errors = [];
  for (const k of Object.keys(setup)) if (!SETUP_KEYS.includes(k)) errors.push(`${where}.${k}: a set-up takes ${SETUP_KEYS.join(', ')}`);
  const d = setup.difficulty;
  if (d !== undefined && d !== true) {
    if (!isObj(d)) errors.push(`${where}.difficulty is true (${TIERS.join(', ')} in the game's default words) or { ask?, hint?, options? }`);
    else {
      for (const k of Object.keys(d)) if (!DIFFICULTY_KEYS.includes(k)) errors.push(`${where}.difficulty.${k}: the difficulty takes ${DIFFICULTY_KEYS.join(', ')}`);
      for (const k of ['ask', 'hint']) if (d[k] !== undefined && !isStr(d[k])) errors.push(`${where}.difficulty.${k} is words`);
      if (d.options !== undefined) {
        const ok = (o) => TIERS.includes(tierOf(o)) && (!isObj(o) || Object.keys(o).every((k) => ['id', 'name', 'about'].includes(k) && isStr(o[k])));
        if (!Array.isArray(d.options) || d.options.length < 2 || !d.options.every(ok) || new Set(d.options.map(tierOf)).size !== d.options.length) {
          errors.push(`${where}.difficulty.options is two or more of the engine's tiers, each once: ${TIERS.join(', ')}, a word or { id, name?, about? } in the game's own words`);
        }
      }
    }
  }
  if (setup.picks !== undefined) {
    errors.push(...readTurn({ picks: setup.picks }, { where }));
    if (Array.isArray(setup.picks) && d !== undefined && setup.picks.some((p) => isObj(p) && p.id === 'difficulty')) errors.push(`${where}.picks: 'difficulty' is the set-up's own pick (difficulty); name this one otherwise`);
  }
  if (d === undefined && setup.picks === undefined) errors.push(`${where}: a set-up asks something (difficulty, picks); leave it out for none`);
  return errors;
}

/** The turn's picks a set-up makes: the difficulty first, then its own. */
export function setupPicks(setup) {
  if (!isObj(setup)) return [];
  const out = [], d = setup.difficulty;
  if (d !== undefined) {
    const o = isObj(d) ? d : {}, options = (o.options ?? TIERS).map((x) => ({ id: tierOf(x), name: (isObj(x) && x.name) || DIFFICULTY_TIERS[tierOf(x)].name, about: (isObj(x) && x.about) || DIFFICULTY_TIERS[tierOf(x)].about }));
    out.push({ id: 'difficulty', ask: o.ask ?? 'Choose a difficulty', ...(o.hint !== undefined ? { hint: o.hint } : {}), from: { options } });
  }
  return [...out, ...(setup.picks ?? [])];
}

/** The flow, each level step that says no picks of its own asking the set-up's. */
export function withSetup(flow, setup) {
  const picks = setupPicks(setup);
  if (!picks.length || !isObj(flow) || !isObj(flow.steps)) return flow;
  return { ...flow, steps: Object.fromEntries(Object.entries(flow.steps).map(([id, s]) => [id, s.kind === 'level' && s.picks === undefined ? { ...s, picks } : s])) };
}
