/**
 * auto-audit-runner — the REAL headless execution of a compiled mechanic audit
 * (game-mechanics.plan.md, M3). Kept in its own module so `create_game` only pulls in the
 * traversal render pipeline (puppeteer / headless WebGL) when `auto_audit` is actually requested;
 * a normal mint never imports it. Injectable: the gate accepts any runTraversal with this
 * signature, so the orchestration is unit-tested with a stub while production uses this path.
 *
 * Runs the compiled plan (waypoints for reach-exit, idle ticks for survive) through the same
 * traversal renderer forge_motion uses; the probe stream carries the `game` outcome (added to the
 * capture probe in G4), so the LAST probe's game.result is the completability verdict. Skips PNG
 * encoding (probes only) for speed — an audit needs the outcome, not the film.
 *
 * A level with seats (pilots.plan.md: a co-op level's `seats`) is walked by seat 1 alone, the world's pilot: the traversal
 * hands the page its own input, so no other seat is taken and each extra seat's body runs its AI (it follows the hero).
 * Completable means seat 1 can finish it; what a second player adds is the eyes gate's.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { renderWorldTraversalMotion } from '@/lib/motion';

/**
 * @param {{ levelRef: string, plan: { motion:'traversal', fps?, waypoints?, ticks? } }} arg
 * @returns {Promise<object|null>} the traversal's final probe (carrying `game`), or null
 */
export async function runLevelTraversal({ levelRef, plan }) {
  const sketch = SketchRepository.getByRef(levelRef);
  if (!sketch) throw new Error(`level '${levelRef}' not found`);
  const res = await renderWorldTraversalMotion({
    sketch,
    ticks: plan.ticks,
    waypoints: plan.waypoints,
    fps: plan.fps || 12,
    params: { frames: false },   // probes only — the audit reads the outcome, not the frames
  });
  const probes = res.probes || [];
  return probes[probes.length - 1] || null;
}
