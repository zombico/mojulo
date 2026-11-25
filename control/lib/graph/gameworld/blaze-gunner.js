/**
 * BLAZE GUNNER — the scrolling shooter's rail's starter: a stage flown on a screen that scrolls on its own
 * (gameworld/scroll-stage/), left to right, a small agile ship on the d-pad, waves in formation, a hull flown along and a
 * capital ship's boss broken by its systems. Its game is its weapons: pods taken from the foes that carry them, each a
 * different hurtbox, two at once, switched, and ejected as a timed bomb. Offence and dodging over shields; damage taken
 * from HP.
 *
 *   stage-1  The fleet's edge   waves in the open, a gun pod and a heavy, a hull run low over a frigate, the corvette
 *
 * The ship is the craft shelf's hero gunship. Its stages are the scroll stage's own recipes (scroll-stage/stages.js), each
 * laid as a gameworld level whose airspace is that recipe and whose flight goal is `scroll` (flight-goal.js): lost when
 * the ship is down, won when the boss its track holds for is down.
 *
 *   BLAZE_GUNNER_LOOK          the look mana-ui draws its menus in (an arcade space shooter's: the `squadron` card)
 *   stageLevel(id)             → the stage as a gameworld level: { name, airspace, goal }
 *   blazeGunnerStart(world, { stages? }) → { world }: the rail's starter, its first stages under what the creator wrote
 *
 * Pure: the same starter lays the same stages.
 */
import { STAGES, STAGE_IDS, stageManifest } from './scroll-stage/stages.js';

export const BLAZE_GUNNER_LOOK = 'squadron';

/** A stage as a gameworld level: its airspace the stage's scroll, flown for the scroll goal. */
export function stageLevel(id) {
  const { kind: _k, title: _t, ...airspace } = stageManifest(id);
  return { name: STAGES[id].title.replace(/^Blaze Gunner: /, '').replace(/^./, (c) => c.toUpperCase()), airspace, goal: { flight: 'scroll' } };
}

/** The rail's starter: its first stages, under what the creator wrote (every key they wrote wins). */
export function blazeGunnerStart(world, { stages = STAGE_IDS.length } = {}) {
  const ids = STAGE_IDS.slice(0, Math.max(1, stages));
  const levels = Object.fromEntries(ids.map((id) => [id, stageLevel(id)]));
  return { world: { mode: 'autonomous', ui: { theme: BLAZE_GUNNER_LOOK }, start: ids[0], ...world, levels } };
}
