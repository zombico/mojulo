/**
 * whack-a-mole — an action-world GAME, now COMPOSED from the reusable rule-idiom catalog
 * (game-idioms.js) instead of hand-inlining the `events` block. It proves the paradigm carries a
 * real interactive game AND that the idiom layer reproduces it byte-for-byte (game-idioms.test.js
 * asserts the recomposed manifest is behaviorally identical to the hand-written one under the bus's
 * hashState oracle). Almost nothing below is whack-a-mole-specific — only the `deed` is:
 *
 *   spawnOnHeartbeat  → moles pop on staggered heartbeats ('pop' → toggle that mole up)
 *   deed (pick)       → click a mole ('whack' → drop it + inc score)            ← the only bespoke rule
 *   countdownClock    → a 10s clock counting down in a var, firing 'game-over' at zero
 *   gameOverFreeze    → raise the `over` gate (halts spawners + clock), clear the board, show banner
 *   scoreCounter      → score var on the HUD (countdownClock adds the time row)
 *
 * Pure builder; `kind:'controllable'` hosts the bare stage. Shared by the node test + /world generator.
 * Stage geometry (the mole/banner entities + ground face) is authored here; idioms supply the RULES.
 */

import { compose, scoreCounter, countdownClock, gameOverFreeze, spawnOnHeartbeat, deed } from '../game-idioms.js';

export function buildWhackAMole({ holes = 9, seconds = 10 } = {}) {
  const cols = 3, gap = 1.7, z = 0.6;
  const periods = [0.7, 1.1, 0.9, 1.3, 0.6, 1.0, 1.2, 0.8, 1.4];  // staggered so moles feel independent
  const entities = [];
  const ids = [];
  for (let i = 0; i < holes; i++) {
    const id = 'hole-' + i;
    ids.push(id);
    const cx = (i % cols - (cols - 1) / 2) * gap;
    const cy = (Math.floor(i / cols) - 1) * gap;
    entities.push({ id, on: false, color: '#ff5a4d', radius: 0.55, position: [cx, cy, z] }); // starts down
  }
  entities.push({ id: 'banner', on: false, color: '#ffd700', radius: 1.4, position: [0, 0, 3.2] }); // "TIME!"

  const events = compose(
    { entities },                                                                 // the STAGE (not a rule idiom)
    scoreCounter('score', { label: 'Score' }),
    countdownClock({ var: 'time', from: seconds, gate: 'over', onZero: 'game-over', label: 'Time' }),
    spawnOnHeartbeat({ targets: ids, periods, pop: 'pop', field: 'hole', gate: 'over' }),
    deed({ on: 'pick', emit: 'whack', effects: [                                   // the one bespoke rule
      { on: 'whack', do: 'toggle', target: 'event.target', to: false },           // the clicked mole drops
      { on: 'whack', do: 'inc', var: 'score' },                                    // SCORE — tied to the click deed
    ] }),
    gameOverFreeze({ signal: 'game-over', gate: 'over', banner: 'banner', clear: ids }),
  );

  const faces = [{ corners: [[-3.5, -3.5, 0], [3.5, -3.5, 0], [3.5, 3.5, 0], [-3.5, 3.5, 0]], fill: '#1c1f26' }];
  return { kind: 'controllable', events, faces, ids };
}
