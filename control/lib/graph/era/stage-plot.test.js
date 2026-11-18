// A room's light designed (era/stage.js `plot`): its wall torches thinned, its hung lights raised to its key, its way on
// flanked by a pair of torches; a room the plot names none of, and a stage with no plot, as the kit lays them.
import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { withProgram } from './programs.js';

const BUILDING = (plot) => withProgram({ kind: 'stage', kit: 'gothic-ashlar', program: { use: 'hall', seed: 3 }, ...(plot ? { plot } : {}) });
const inRoom = (S, id) => { const r = S.rooms.find((q) => q.id === id); return (p) => p[0] >= r.x - 0.6 && p[0] <= r.x + r.w + 0.6 && p[1] >= r.y - 0.6 && p[1] <= r.y + r.d + 0.6; };
const torchLike = (l) => Math.abs(l.color[1] - 0.6118) < 0.01;

describe('a room\'s light plot', () => {
  const plain = BUILDING(), S = plain;
  const P0 = assembleStageScene(plain, {});
  const hall = inRoom(S, 'hall');
  const torches0 = P0.lights.filter((l) => torchLike(l) && hall(l.position));

  it('keeps as many of the room\'s torches as it says, and flanks its way on with a brighter pair', () => {
    const P = assembleStageScene(BUILDING({ hall: { torches: 1, lead: 1.5 } }), {});
    const own = P.lights.filter((l) => torchLike(l) && hall(l.position));
    expect(torches0.length).toBeGreaterThan(1);
    const base = torches0[0].intensity, led = own.filter((l) => l.intensity > base * 1.2);
    expect(led.length).toBe(2);
    expect(own.length).toBeLessThanOrEqual(1 + 2);
    // (the pair stand either side of one doorway, on one wall)
    expect(Math.min(Math.abs(led[0].position[0] - led[1].position[0]), Math.abs(led[0].position[1] - led[1].position[1]))).toBeLessThan(0.01);
  }, 120_000);

  it('a room it names none of, and a stage with no plot, keep the kit\'s lights; a room it does not have, refused', () => {
    const P = assembleStageScene(BUILDING({ hall: { torches: 2 } }), {});
    const other = (L) => L.filter((l) => !hall(l.position)).map((l) => JSON.stringify(l)).sort();
    expect(other(P.lights)).toEqual(other(P0.lights));
    expect(() => assembleStageScene(BUILDING({ nave: { torches: 2 } }), {})).toThrow(/plot names 'nave'/);
    expect(() => assembleStageScene(BUILDING({ hall: { torches: 2.5 } }), {})).toThrow(/whole number/);
    expect(() => assembleStageScene(BUILDING({ hall: { glow: 1 } }), {})).toThrow(/not a setting/);
  }, 120_000);
});
