/**
 * departments — the animation studio's DEPARTMENTS: who owns which part of a film's recipe, which advice each answers,
 * which it reads, and so the waves a film is made in. The game studio's chapters (gameworld/chapters.js) in the
 * film's shape: pure data and what is derived from it.
 *
 *   DEPARTMENTS            [{ id, name, owner: 'main' | 'any', paths, reads, advice, does }]: paths are JSON Pointers into
 *                          the film's recipe (* any key or index); `advice` the advice ids it answers (each id has one
 *                          home: ADVICE_HOME)
 *   ADVICE_HOME            { <advice id>: <department id> }
 *   departmentWaves()      [[ids]]: a department in the wave after every department it reads
 *   departmentOfPath(ptr)  the department that owns a recipe path (the longest pattern that matches)
 *   departmentStates(F, advice, { approved }) → { <id>: 'open' | 'written' | 'advised' | 'settled' }: open, nothing written
 *                          where it writes (a look not given takes the default and reads written); advised, advice of its
 *                          own stands; settled, written, unadvised, and every scene's board approved; else written
 *
 * Pure.
 */
import { NOTE_IDS } from '../actor/notes.js';

export const DEPARTMENTS = Object.freeze([
  { id: 'script', name: 'Script', owner: 'main', paths: ['/title', '/scenes/*/id', '/scenes/*/script'], reads: [], advice: ['scene-refused', 'static', 'slowed-line'], does: 'the scenes and their words: who says what, crosses and turns, the time the film takes' },
  { id: 'casting', name: 'Casting', owner: 'any', paths: ['/cast', '/cast/*/persona', '/cast/*/hero', '/scenes/*/cast'], reads: ['script'], advice: ['no-body', 'idle-part'], does: 'who plays each part: a persona (its hero, its voice, its playing) or a hero' },
  { id: 'set', name: 'Sets', owner: 'any', paths: ['/sets', '/scenes/*/set', '/scenes/*/marks', '/scenes/*/cast/*/mark'], reads: ['script'], advice: ['set-blocks', 'distance'], does: 'where each scene is played: its world, its marks, where each part stands' },
  { id: 'performance', name: 'Performance', owner: 'any', paths: ['/style', '/cast/*/style', '/cast/*/role', '/cast/*/register', '/scenes/*/cast/*/style', '/scenes/*/cast/*/role', '/scenes/*/cast/*/register'], reads: ['casting'], advice: ['back-turned', 'extra-speaks'], does: 'how each part plays: its style, its role, its register' },
  { id: 'camera', name: 'Camera', owner: 'any', paths: ['/grain'], reads: ['set', 'performance'], advice: ['long-take', 'no-close', 'line-flips'], does: 'the coverage: the shots a director takes of each scene, on ones or on twos' },
  { id: 'voice', name: 'Voice and dub', owner: 'any', paths: ['/scenes/*/voice', '/scenes/*/dub'], reads: ['script', 'casting'], advice: ['voice-words', 'dub-over', 'part-voiced'], does: 'the recorded lines that set each scene\'s clock and mouths, and the dubs to picture' },
  { id: 'look', name: 'Look and light', owner: 'any', paths: ['/look', '/grade', '/render'], reads: [], advice: [], does: 'the film\'s look in Blender (film in Cycles, anime in EEVEE), its grade, its light (each setup lit from the cast rig, or the set\'s own), its focus and its motion blur' },
  { id: 'edit', name: 'Edit', owner: 'main', paths: ['/edit', '/edit/order', '/edit/cuts'], reads: ['script'], advice: [], does: 'the order the scenes play in and how each comes in' },
  { id: 'render', name: 'Render', owner: 'any', paths: [], reads: ['script', 'casting', 'set', 'performance', 'camera', 'voice', 'look', 'edit'], advice: ['unapproved', 'stale'], does: 'the boards, the cut animatic, the Blender packs and their renders; the person approves each scene\'s board' },
]);
export const DEPARTMENT_IDS = Object.freeze(DEPARTMENTS.map((D) => D.id));

/** every advice id the studio gives, and its department */
export const ADVICE_HOME = Object.freeze(Object.fromEntries(DEPARTMENTS.flatMap((D) => D.advice.map((a) => [a, D.id]))));
/** the director's notes (actor/notes.js) all have a home: a guard for a note added there */
export const UNHOMED_NOTES = Object.freeze(NOTE_IDS.filter((id) => !ADVICE_HOME[id]));

/** The waves: each department after all it reads */
export function departmentWaves() {
  const wave = {}, waves = [];
  const depth = (id, seen = new Set()) => {
    if (wave[id] !== undefined) return wave[id];
    if (seen.has(id)) throw new Error(`departments: a cycle through ${id}`);
    seen.add(id);
    const D = DEPARTMENTS.find((x) => x.id === id);
    return (wave[id] = D.reads.length ? 1 + Math.max(...D.reads.map((r) => depth(r, seen))) : 0);
  };
  for (const D of DEPARTMENTS) { const k = depth(D.id); (waves[k] ??= []).push(D.id); }
  return waves;
}

const match = (pattern, ptr) => {
  const a = pattern.split('/'), b = ptr.split('/');
  return a.length <= b.length && a.every((p, i) => p === '*' || p === b[i]);
};

/** The department that owns a path into the recipe (the most specific pattern that matches) */
export function departmentOfPath(ptr) {
  let best = null, len = -1;
  for (const D of DEPARTMENTS) for (const p of D.paths) if (match(p, ptr) && p.split('/').length > len) { best = D.id; len = p.split('/').length; }
  return best;
}

/** whether anything is written at a pattern in the film */
function written(F, pattern) {
  const walk = (v, parts) => {
    if (!parts.length) return v !== undefined && v !== null;
    const [p, ...rest] = parts;
    if (v === null || typeof v !== 'object') return false;
    if (p === '*') return Object.values(v).some((x) => walk(x, rest));
    return walk(v[p], rest);
  };
  return walk(F, pattern.split('/').slice(1));
}

/** Each department's state (see the header) */
export function departmentStates(F, advice, { approved = false } = {}) {
  const out = {};
  for (const D of DEPARTMENTS) {
    const own = advice.filter((a) => ADVICE_HOME[a.id] === D.id);
    const any = D.id === 'look' || D.id === 'camera' || D.id === 'edit' || D.id === 'render' || D.paths.some((p) => written(F, p));
    out[D.id] = own.length ? 'advised' : !any ? 'open' : approved ? 'settled' : 'written';
  }
  return out;
}
