/**
 * THE PRE-COMPILE CHECK — what a design_game run would hit, found before it makes anything (machine gate: it advises,
 * never refuses). A run makes its steps one after another through the real doors; a design error a door refuses used to
 * surface minutes in, after the steps before it were made. This reads the run's plan (gameworld/runner.js runSteps)
 * and checks each order as its door would, where the door's check is cheap and needs nothing made:
 *
 *   the plan       the recipe the runner reads (a refusal names its field: said on that field's chapter)
 *   heroes         every hero-door order's spec (layered.js validateHeroSpec: the hero, its cast, its foes, its folk)
 *   levels         every level's houses and bodies (the world door's construction and body-type checks)
 *   the game       the game as create_game makes it, over the planned levels: its manifest, each level's contract
 *                  dry-run against the game's store, its links and menu (game-resolve.js resolveGame)
 *   refs           every sketch an order names is one a step makes or one that is stored (a hero adopted by a ref with
 *                  no row, a building played by a ref that is gone: the page would refuse it at the end)
 *
 * The world door's full resolve (resolveWorldScene) and the gear's workbench are not run: they need what the run makes,
 * and they are the run. Its answer: { gate, ready, steps, make, waiting, estimate: { seconds, calls }, blockers? },
 * each blocker { chapter, step?, says }; `make` what a run makes now, `waiting` what waits on approvals. The estimate
 * prices the build left (both) at the times measured on the reference book (a hero ~8 s, a level ~6 s, a level's walk
 * ~45 s …) and divides it by the run's budget: an order of size, not a promise.
 *
 *   compileCheck(steps, { actions, row, budgetMs })   pure: `actions` each step's decide, `row(ref)` the stored row or null
 *   planError(message)                                   → the blocker a refused plan is
 */
import { validateHeroSpec } from './layered.js';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { validateHouseConstruction } from '@/lib/graph/construction/house-frame.js';
import { bodyTypeErrors } from '@/lib/graph/worlds/controllable/body-types';
import { chapterOfStep, chaptersOfPath } from '@/lib/graph/gameworld/chapters.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Seconds a step takes, by what it is (measured on the meadowmark reference book, a 4-core container: a level is ~6 s
 * to make and ~9 s for its first frame; a walk 22-64 s). */
export const STEP_SECONDS = Object.freeze({ figure: 8, level: 15, walk: 45, gear: 1.5, systems: 4, game: 3, other: 4 });
const FIGURE = /^(hero|hero-equipped|(guard|foe|tower|farmhand|keeper|athlete)(-\d+)?|cast-.+|folk-.+|foes-.+|fighter-.+)$/;
export function stepSeconds(key) {
  if (key.startsWith('audit-')) return STEP_SECONDS.walk;
  if (key.startsWith('level-') || /^map-\d+$/.test(key)) return STEP_SECONDS.level;
  if (key.startsWith('gear-') || key.startsWith('stock-')) return STEP_SECONDS.gear;
  if (key === 'systems') return STEP_SECONDS.systems;
  if (key === 'game') return STEP_SECONDS.game;
  return FIGURE.test(key) ? STEP_SECONDS.figure : STEP_SECONDS.other;
}

/** A refused plan as a blocker: its field's chapter where the refusal names one (`gameworld: feel.pole …`). */
export function planError(message) {
  const m = /gameworld: ([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9-]+)*)/.exec(String(message));
  const chapters = m ? chaptersOfPath(`/${m[1].split('.').join('/')}`) : [];
  return { chapter: chapters.length === 1 ? chapters[0].id : 'intent', says: String(message).split('\n')[0] };
}

// the sketches an order names: every string under a key that ends in Ref or is `ref` (a game's levels, a level's pilot,
// a stand's figures), and a cast member's casting row (`egocube`); its own ref (a level's levelRef) is not a need
function namedRefs(order, own) {
  const out = new Set();
  const walk = (v, key) => {
    if (typeof v === 'string') { if ((key === 'ref' || /Ref$/.test(key ?? '') || key === 'egocube') && v !== own) out.add(v); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, key); return; }
    if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(order, null);
  return out;
}

// the manifest create_game makes from the run's order (create-game.js mintGame: the flags are the door's, not the game's)
const GAME_FLAGS = new Set(['allow_unaudited', 'auto_audit', 'audits', 'ref', 'folder_ref', 'project_ref']);
const gameManifest = (order) => ({ kind: 'game', ...Object.fromEntries(Object.entries(order).filter(([k]) => !GAME_FLAGS.has(k))) });

export function compileCheck(steps, { actions = {}, row = () => null, budgetMs = 0 } = {}) {
  const blockers = [];
  const block = (step, says) => blockers.push({ chapter: chapterOfStep(step.key)?.id ?? 'build', step: step.key, says });
  const makes = new Set(steps.map((s) => s.ref));
  const planned = new Map(steps.filter((s) => isObj(s.order?.manifest)).map((s) => [s.ref, { ref: s.ref, title: s.order.title, manifest: s.order.manifest }]));
  for (const s of steps) {
    if (s.audit) continue;
    // an adopted hero is the creator's own row: it is there, or the run has no hero to pin
    if (s.adopt) { if (!row(s.ref)) block(s, `the adopted hero '${s.ref}' is no sketch (make it with create_character, or name another)`); continue; }
    const O = s.order ?? {};
    // a hero-door order (the hero, its cast, foes and folk as minted): its spec as the door reads it
    const spec = O.mint?.kind === 'layered' ? O.mint.spec : null;
    if (isObj(spec) && !O.mascot) for (const e of validateHeroSpec(spec)) block(s, `the hero door would refuse: ${e}`);
    // a level: its houses and its bodies as the world door checks them
    if (s.key.startsWith('level-') && isObj(O.manifest)) {
      for (const e of validateHouseConstruction(O.manifest)) block(s, `the world door would refuse: ${e}`);
      for (const e of bodyTypeErrors(O.manifest.entities)) block(s, `the world door would refuse: ${e}`);
    }
    // the game over the planned levels (a level made before is read as stored): create_game's own resolve
    if (s.key === 'game' && O.engine !== 'versus') {
      try { resolveGame(gameManifest(O), (r) => planned.get(r) ?? row(r) ?? null, (r) => r); }
      catch (err) { for (const line of String(err.message).split('\n').filter((l) => l.startsWith('- ') || !/^game manifest/.test(l))) block(s, `create_game would refuse: ${line.replace(/^- /, '')}`); }
    }
    // the sketches it names: made by a step of this run, or stored (the game's are its resolve's to say, above)
    if (s.key !== 'game') for (const r of namedRefs(O, s.ref)) if (!makes.has(r) && !row(r)) block(s, `names '${r}', which no step makes and no sketch is`);
  }
  // what a run makes now, what waits on approvals, and the build left (both: every step not kept as it is), priced
  const now = steps.filter((s) => actions[s.key] === 'make' || actions[s.key] === 'remake');
  const waiting = steps.filter((s) => actions[s.key] === 'waiting');
  const seconds = Math.round([...now, ...waiting].reduce((n, s) => n + stepSeconds(s.key), 0));
  const calls = !seconds ? 0 : budgetMs > 0 ? Math.max(1, Math.ceil((seconds * 1000) / budgetMs)) : 1;
  return { gate: 'machine', ready: blockers.length === 0, steps: steps.length, make: now.length, waiting: waiting.length, estimate: { seconds, calls }, ...(blockers.length ? { blockers } : {}) };
}
