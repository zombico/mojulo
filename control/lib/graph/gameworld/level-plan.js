/**
 * THE LEVEL'S PLAN — a level checked on paper before anything walks it: does what the level lays match the beat it is
 * played for, and can its win be reached at all? Read from the recipe and from the stages a run would make, never from
 * a browser: a plan known wrong is fixed before a walk is spent on it.
 *
 *   beatPlan(world)     → [{ beat, level, says, patch? }]: each built beat whose level does not lay what the beat says
 *                          - a beat that is one boss alone is a duel: its level stands one and is won by clearing it
 *                          - a beat that fields foes is played on a level that stands them
 *                          `patch` is the write that would lay it (offered: the level is the creator's)
 *   stagePlan(steps)    → [{ level, step, says }]: each level stage a run would make whose win cannot be reached on paper
 *                          - a stage that lays no win
 *                          - a stage won by clearing it with nothing stood to clear
 *   unwalked(steps)     → [{ level, step, why }]: each level stage the machine gate's walk cannot prove, and why (its
 *                          win is one the walk does not play); these are not wrong, they are the creator's to play
 *   walkReport(world, steps)  → null when the plan is clean and every stage can be walked, else
 *                          { plan?: [...beatPlan, ...stagePlan], unwalked?: [...] }: why no level is walked
 *
 * Advice: nothing here refuses. Pure: the recipe and the steps in, the findings out.
 */
import { readMainQuest, mainQuestContext, partsOf } from './main-quest.js';
import { questPlays } from './main-quest-lay.js';
import { unprovenKinds, WALKED_WINS } from './runner.js';
import { TERMINAL_KINDS } from '../game/mechanics.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const pointer = (id) => String(id).replace(/~/g, '~0').replace(/\//g, '~1');

export function beatPlan(world) {
  if (!isObj(world?.mainQuest)) return [];
  let C, Q, P;
  try { C = mainQuestContext(world); Q = readMainQuest(world.mainQuest, C); P = questPlays(world); } catch { return []; }
  const levels = isObj(world.levels) ? world.levels : {}, out = [];
  for (const A of partsOf(Q)) for (const B of A.beats) {
    const id = P.plays[B.id], L = id ? levels[id] : null;
    // (a beat not built, played on no level, or whose level a run has yet to lay: nothing to check on paper)
    if (!B.built || !isObj(L) || !B.foes.length) continue;
    const held = B.foes.filter((f) => f in C.foes);
    if (!held.length) continue;
    const stood = L.foes === true ? Object.keys(C.foes) : isObj(L.foes) && Array.isArray(L.foes.from) ? L.foes.from : L.foes === undefined ? null : Object.keys(C.foes);
    const duel = held.length === 1 && C.foes[held[0]] === 'boss';
    if (duel) {
      const one = isObj(L.foes) && L.foes.count === 1 && L.foes.win === 'clear' && stood?.length === 1 && stood[0] === held[0];
      if (!one) out.push({ beat: B.id, level: id, says: `beat '${B.id}' is one boss alone ('${held[0]}'): level '${id}' ${stood === null ? 'stands no foes' : `stands ${isObj(L.foes) && L.foes.count !== undefined ? L.foes.count : 'one on each free beat'} of ${stood.join(', ') || 'none'}`} and is won by ${isObj(L.foes) && L.foes.win === 'clear' ? 'clearing it' : 'its exit'}; a duel stands one and is won by clearing it`, patch: [{ op: 'set', path: `/levels/${pointer(id)}/foes`, value: { from: [held[0]], count: 1, win: 'clear' } }] });
      continue;
    }
    const missing = held.filter((f) => !(stood ?? []).includes(f));
    if (missing.length) out.push({ beat: B.id, level: id, says: `beat '${B.id}' fields ${missing.join(', ')}: level '${id}' ${stood === null ? 'stands no foes' : `stands ${stood.join(', ') || 'none'}`}`, patch: [{ op: 'set', path: `/levels/${pointer(id)}/foes`, value: { ...(isObj(L.foes) ? L.foes : {}), from: [...new Set([...(stood ?? []), ...missing])] } }] });
  }
  return out;
}

const levelSteps = (steps) => (Array.isArray(steps) ? steps : []).filter((s) => typeof s?.key === 'string' && s.key.startsWith('level-') && s.order?.manifest);
const levelOf = (key) => key.replace(/^level-/, '').replace(/-(\d+|skirmish)$/, '');
const kindsOf = (s) => (s.order.manifest.game?.mechanics ?? []).map((m) => m?.kind).filter(Boolean);
// the mechanics that end a level (game/mechanics.js, role terminal), less the ones that only lose it: what is left wins it
const LOSES = new Set(['fail-on-death', 'lives', 'unseen']);
const WINS = new Set([...TERMINAL_KINDS.filter((k) => !LOSES.has(k)), ...WALKED_WINS]);

export function stagePlan(steps) {
  const out = [];
  for (const s of levelSteps(steps)) {
    const kinds = kindsOf(s);
    // (a stage with no game contract at all is a place, not a level played to a win: a hub's square, a viewer)
    if (!s.order.manifest.game) continue;
    if (!kinds.some((k) => WINS.has(k))) { out.push({ level: levelOf(s.key), step: s.key, says: `stage '${s.key}' lays no win: nothing ends it (${kinds.join(', ') || 'no mechanics'})` }); continue; }
    if (kinds.includes('defeat-all') && !(s.order.manifest.entities ?? []).some((e) => /^foe-/.test(e?.id ?? ''))) out.push({ level: levelOf(s.key), step: s.key, says: `stage '${s.key}' is won by clearing it, with nothing stood to clear` });
  }
  return out;
}

export function unwalked(steps) {
  const out = [];
  for (const s of levelSteps(steps)) {
    if (!s.order.manifest.game) continue;
    const kinds = unprovenKinds(s.order);
    if (kinds.length) out.push({ level: levelOf(s.key), step: s.key, why: `it carries ${kinds.join(', ')}: the walk proves a level of ${WALKED_WINS.join(', ')} alone; this one is the creator's to play` });
  }
  return out;
}

export function walkReport(world, steps) {
  const plan = [...beatPlan(world).map(({ patch: _p, ...x }) => x), ...stagePlan(steps)], not = unwalked(steps);
  if (!plan.length && !not.length) return null;
  return { ...(plan.length ? { plan } : {}), ...(not.length ? { unwalked: not } : {}) };
}
