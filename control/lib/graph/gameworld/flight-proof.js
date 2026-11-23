/**
 * THE FLIGHT PROOF — a run's flight levels flown on the levels it made (machine gate): each airspace level flown for a
 * list of tasks (flight-goal.js) is flown by the lesson pilot (skyscape/lesson-pilot.js) on the fly rule, judged on the
 * bus by its own mechanics, and its medal said. A course is the autopilot's to prove (an airspace's `flown` law), a fight
 * the dogfight's; a task the student does not fly (a landing, a fight) is said, never guessed.
 *
 *   flightStageManifests(steps) → { <level id>: manifest }   the first stage of each level whose page flies a task list
 *   proveFlights(manifests)     → [{ level, won, result, grade?, time, met, of, reason }] or null (none to fly)
 *
 * Pure but for the flight it simulates; deterministic.
 */
import { flyTasks } from '../skyscape/lesson-pilot.js';
import { objectivesOf } from '../game/objectives.js';

export function flightStageManifests(steps) {
  const out = {};
  for (const s of steps) {
    const m = /^level-(.+)-(\d+)$/.exec(s.key), M = s.order?.manifest;
    if (m && M?.kind === 'airspace' && objectivesOf(M.game?.mechanics) && !out[m[1]]) out[m[1]] = M;
  }
  return out;
}

export function proveFlights(manifests) {
  const ids = Object.keys(manifests);
  if (!ids.length) return null;
  return ids.map((level) => {
    const R = flyTasks(manifests[level]);
    return { level, won: R.won, result: R.result, ...(R.grade ? { grade: R.grade } : {}), time: R.time, met: R.met, of: R.of, ...(R.reason ? { reason: R.reason } : {}) };
  });
}
