import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { rollArt, ART_KITS } from './art-direction.js';
import { starter } from './entries.js';

// every rolled direction leaves an addressable level: unique ids, every thing in a room, every solid thing a hull,
// every doorway clear to walk through and the spawn clear to stand in
const inside = (p, c, pad) => [0, 1, 2].every((k) => p[k] > c.min[k] - pad && p[k] < c.max[k] + pad);

describe('anchors: every roll is addressable and walkable', () => {
  for (const kitId of ART_KITS) {
    it.each([1, 2, 3, 5, 8, 13, 21, 34])(`${kitId}, seed %i`, (seed) => {
      const p = assembleStageScene({ ...starter(kitId), reference: 'gothic-night', art: rollArt(kitId, seed) }), C = p.colliders;
      const ids = p.anchors.map((a) => a.id), rooms = new Set(p.rooms.map((r) => r.id));
      expect(new Set(ids).size).toBe(ids.length);
      for (const a of p.anchors) expect(rooms.has(a.room), a.id).toBe(true);
      for (const a of p.anchors.filter((q) => q.solid)) expect(C.some((c) => c.of === a.id), a.id).toBe(true);
      expect(C.filter((c) => inside([p.walk.spawn[0], p.walk.spawn[1], 1], c, 0.3)).map((c) => c.of)).toEqual([]);
      for (const d of p.anchors.filter((a) => a.kind === 'doorway')) for (const t of [-1, 0, 1]) {
        const q = [d.at[0] + d.N[0] * t * 0.9, d.at[1] + d.N[1] * t * 0.9, 1.2];
        expect(C.filter((c) => inside(q, c, 0.2)).map((c) => c.of), `${d.id} at ${t}`).toEqual([]);
      }
    }, 60000);
  }
});
