/**
 * INVISIBLE MODE — a designer's walk, never a game's: a pilot whose rule carries `ghost` (true, or { on }) is seen by
 * no mind while it is on. The guards walk their rounds, look round at their ends, call to each other and wake their
 * sleepers as they would, and none of them sees the pilot, so a level's layout and its watchers are read on foot without
 * setting them off. The page toggles it (scene/channels/controllable/ghost-view.js, the I key).
 *
 *   rule.ghost   true | { on: boolean }   on while true or `on`; { on: false } a page that starts seen and can go unseen
 *
 * Wraps stepWorld just outside the patrol (compose.js lists it right after `foe`): while it is on, every mind's
 * `sightRange` is set below any distance for that much of the step and given back after it (each rule once, a rule two
 * bodies share given back once), so the patrol's sighting (foe.js) and the mind's (mind.js perceive) both fail at their
 * first test. Everything wrapped outside it reads and writes the minds' own sight: the alert's calm and hot sets
 * (alert.js) are taken and worn on the true values, a guard still sees a fallen teammate (alarm.js) and a sleeper to
 * wake (knockout.js). What a mind does with what it saw before it went unseen is its own. Import-free (the page runs this source via
 * toString(), compose.js); emitted only into a page whose pilot carries `rule.ghost`, so every other page keeps every
 * byte.
 */
export function buildGhost(E) {
  const step = E.stepWorld;
  E.ghostOn = (p) => { const G = p && p.rule && p.rule.ghost; return !!G && (G === true || !!G.on); };
  E.stepWorld = function stepWithGhost(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null;
    if (!E.ghostOn(p)) return step(state, input, dt, hooks);
    const saved = new Map();
    for (const e of state.entities) {
      const r = e.rule;
      if (e === p || !r || r.type !== 'ai' || saved.has(r)) continue;
      saved.set(r, Object.prototype.hasOwnProperty.call(r, 'sightRange') ? r.sightRange : undefined);
      r.sightRange = -1;
    }
    try {
      return step(state, input, dt, hooks);
    } finally {
      for (const [r, v] of saved) { if (v === undefined) delete r.sightRange; else r.sightRange = v; }
    }
  };
}
