// programs, swept: every use on every room kit, dressed, lowered as a level. The walker's way (each waypoint and
// the goal) stands clear of every collider the dressed stage carries: its walls, pilasters and set pieces.

import { describe, it, expect } from 'vitest';
import { PROGRAM_IDS } from './programs.js';
import { assembleStageScene, STAGE_KITS } from './stage.js';
import { withBuildingLevel } from '../structure/level.js';

const ROOM_KITS = Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].grid && STAGE_KITS[k].shell !== 'plaza');
const BODY = 0.3;   // the level walker's collideRadius

describe('every program, on every room kit, leaves its walker a way', () => {
  for (const kit of ROOM_KITS) {
    it(`${kit}: each use's waypoints and goal stand clear of its colliders`, () => {
      for (const use of PROGRAM_IDS) for (const seed of [1, 2]) {
        const m = withBuildingLevel({ kind: 'stage', kit, program: { use, seed }, level: {} }, 'lv');
        const p = assembleStageScene(m, { unshaded: true });
        const mech = m.game.mechanics[0];
        for (const q of [...(mech.via || []), mech.at]) {
          const hit = p.colliders.find((c) => c.max[2] > 0.35 && q[0] > c.min[0] - BODY && q[0] < c.max[0] + BODY && q[1] > c.min[1] - BODY && q[1] < c.max[1] + BODY);
          expect(hit?.of, `${kit} ${use} s${seed} at ${q}`).toBeUndefined();
        }
      }
    }, 300_000);
  }
});
