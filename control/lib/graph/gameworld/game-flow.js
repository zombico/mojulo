/**
 * THE GAME'S FLOW in the studio: what plays when, from the first screen to the credits (game/flow.js), as the game
 * director's page. The flow chapter (production) is the main agent's own: it reads the main quest, the levels, the story
 * and the interface, and is never handed to a subagent; the creator approves it. Its steps' content stays with the
 * departments that own it: a screen is the interface's, a cinematic the story's, a level the worlds'.
 *
 * A gameworld's `flow` is game/flow.js's shape, its levels named by the world's level ids (`stage` and `level` steps);
 * the game made of the world plays it, each level id the ref of that level's first stage. A world that says none plays
 * the flow its front, levels and run make, with the story's cinematics placed in it: its moments in the game's slots
 * (story.js GAME_SLOTS), and the main quest's ending when that beat is a story moment (`as: { scene }`) and the story
 * has no ending of its own.
 *
 *   storyCinematics(G)       → { opening?, prologue?, ending?: { scene, level } }   (level: the moment's level id)
 *   worldFlow(G)             → { flow, source: 'own' | 'default' } in the world's level ids, or null (nothing to say:
 *                              no flow of its own and no cinematics)
 *   flowToRefs(flow, refOf)  → { flow, missing: [level id] }: its levels as a game's refs (refOf(id) → ref | null)
 *   flowStoryboard(flow)     → [{ step, kind, what, department, waits, goes }]: the steps in the order the start reaches
 *                              them, each with the department its content comes from and what it waits on
 *
 * Pure.
 */
import { defaultFlow } from '../game/flow.js';
import { GAME_SLOTS } from './story.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The story's cinematics: its moments in the game's slots, and the main quest's ending as a moment. */
export function storyCinematics(G) {
  const out = {};
  for (const m of G.story ?? []) if (GAME_SLOTS.includes(m.when?.slot) && m.where?.level) out[m.when.slot] = { scene: m.id, level: m.where.level };
  // the main quest's ending, played as a story moment (its beat's `as: { scene }`): the game's ending, unless the story
  // has one of its own
  const Q = G.mainQuest, beat = Q?.ending && [...(Q.acts ?? []), ...(Q.chapters ?? [])].flatMap((a) => a.beats ?? []).find((b) => b.id === Q.ending.beat);
  // (a read quest keeps it as { kind: 'scene', at }, a written one as { scene })
  const sceneId = beat?.as?.kind === 'scene' ? beat.as.at : beat?.as?.scene;
  const m = sceneId && (G.story ?? []).find((x) => x.id === sceneId);
  if (!out.ending && m?.where?.level) out.ending = { scene: m.id, level: m.where.level };
  return out;
}

/** The game's flow in the world's own level ids: its own, else the default with the story's cinematics; null: none to say. */
export function worldFlow(G) {
  if (isObj(G.flow)) return { flow: G.flow, source: 'own' };
  const C = storyCinematics(G);
  if (!Object.keys(C).length) return null;
  const ids = G.ids ?? Object.keys(G.levels ?? {});
  const cinematics = Object.fromEntries(Object.entries(C).map(([k, c]) => [k, { scene: c.scene, stage: c.level }]));
  return { flow: defaultFlow({ levels: ids, ...(G.front !== undefined ? { front: G.front } : {}), ...(isObj(G.quick) && G.quick.run ? { run: { length: G.quick.run } } : {}), cinematics }), source: 'default' };
}

/** A flow's levels as a game's refs: a level step's `level`, a cinematic's `stage`. Missing: the ids no ref was found for. */
export function flowToRefs(flow, refOf) {
  const missing = [], to = (id) => { const r = refOf(id); if (!r && !missing.includes(id)) missing.push(id); return r || id; };
  const steps = Object.fromEntries(Object.entries(flow.steps).map(([id, s]) => [id,
    s.kind === 'level' && s.level !== '$any' ? { ...s, level: to(s.level) } : s.kind === 'cinematic' ? { ...s, stage: to(s.stage) } : s]));
  return { flow: { ...flow, steps }, missing };
}

const DEPARTMENT = { screen: 'interface', cinematic: 'cinematics', level: 'worlds', hold: 'production' };
const targets = (t) => (Array.isArray(t) ? t : [t]).map((a) => (isObj(a) ? `${a.go} (when ${a.when})` : a));

/** The storyboard: the steps in the order the start reaches them, each what it is, whose, what it waits on, where it goes. */
export function flowStoryboard(flow) {
  const order = [], todo = targets(flow.start).map((t) => t.split(' ')[0]);
  while (todo.length) {
    const id = todo.shift();
    if (order.includes(id) || !flow.steps[id]) continue;
    order.push(id);
    const s = flow.steps[id];
    for (const t of [...Object.values(s.on ?? {}), ...(s.next !== undefined ? [s.next] : []), ...(s.idle ? [s.idle.go] : [])]) for (const x of targets(t)) todo.push(x.split(' ')[0]);
  }
  for (const id of Object.keys(flow.steps)) if (!order.includes(id)) order.push(id);
  return order.map((id) => {
    const s = flow.steps[id];
    const what = s.kind === 'screen' ? `the ${s.screen} screen` : s.kind === 'cinematic' ? `the scene ${s.scene}, on ${s.stage}${s.keep ? ', kept into play' : ''}${s.skip === false ? ', unskippable' : ''}` : s.kind === 'level' ? (s.level === '$any' ? 'any level it is given' : `the level ${s.level}`) : `a hold${s.for ? ` of ${s.for} s` : ''}${s.until ? ` until ${s.until}` : ''}`;
    const waits = s.kind === 'screen' ? `the player (${Object.keys(s.on ?? {}).join(', ') || 'next'})${s.idle ? `, or ${s.idle.after} s left alone` : ''}` : s.kind === 'cinematic' ? 'its scene to end' : s.kind === 'level' ? `its end (${Object.keys(s.on ?? {}).join(', ')})` : s.until ? `the event ${s.until}` : 'its time';
    const goes = Object.fromEntries([...Object.entries(s.on ?? {}), ...(s.next !== undefined ? [['next', s.next]] : []), ...(s.idle ? [['idle', s.idle.go]] : [])].map(([e, t]) => [e, targets(t).join(' | ')]));
    return { step: id, kind: s.kind, what, department: DEPARTMENT[s.kind], waits, goes };
  });
}

