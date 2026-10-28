// programs, swept: a use of every shape on every room shell, dressed, lowered as a level. The walker's way (each waypoint and
// the goal) stands clear of every collider the dressed stage carries: its walls, pilasters and set pieces. The uses
// on storeys (the tower, the keep) are walked, floor by floor, in storeys.deep.test.js: a plan point here has no floor.

import { describe, it, expect } from 'vitest';
import { PROGRAM_IDS, PROGRAMS } from './programs.js';
import { assembleStageScene, STAGE_KITS } from './stage.js';
import { withBuildingLevel } from '../structure/level.js';

// one room kit per shell, and one flat use per shape (a tall main room its own): each a distinct way to build and lay
const firstOf = (ids, key) => ids.filter((id, i) => ids.findIndex((x) => key(x) === key(id)) === i);
const ROOM_KITS = firstOf(Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].grid && STAGE_KITS[k].shell !== 'plaza'), (k) => STAGE_KITS[k].shell ?? 'crypt');
// (a building is flat on one storey: the clinic stands for the corridor-and-core shape)
const flat = (u) => (PROGRAMS[u].rooms ? !PROGRAMS[u].rooms.some((r) => r.s) : PROGRAMS[u].core.storeys === 1);
const USES = firstOf(PROGRAM_IDS.filter(flat), (u) => `${PROGRAMS[u].shape}/${!!PROGRAMS[u].tall}`);
const BODY = 0.3;   // the level walker's collideRadius

describe('every program shape, on every room shell, leaves its walker a way', () => {
  ROOM_KITS.forEach((kit, k) => {
    it(`${kit}: each use's waypoints and goal stand clear of its colliders`, () => {
      USES.forEach((use, u) => {
        const seed = 1 + ((k + u) % 2);
        const m = withBuildingLevel({ kind: 'stage', kit, program: { use, seed }, level: {} }, 'lv');
        const p = assembleStageScene(m, { unshaded: true });
        const mech = m.game.mechanics[0];
        for (const q of [...(mech.via || []), mech.at]) {
          const hit = p.colliders.find((c) => c.max[2] > 0.35 && q[0] > c.min[0] - BODY && q[0] < c.max[0] + BODY && q[1] > c.min[1] - BODY && q[1] < c.max[1] + BODY);
          expect(hit?.of, `${kit} ${use} s${seed} at ${q}`).toBeUndefined();
        }
      });
    });
  });
});
