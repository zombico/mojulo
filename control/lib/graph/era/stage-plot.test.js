// A room's light designed (era/stage.js `plot`): its wall torches thinned, its hung lights raised to its key, its way on
// flanked by a pair of torches; a room the plot names none of, and a stage with no plot, as the kit lays them.
import { describe, it, expect } from 'vitest';
import { assembleStageScene, formLightFaces } from './stage.js';
import { withProgram } from './programs.js';
import { solveRoomLight } from '../form/room-light.js';

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

  it('varies its flames, each by where it hangs (the same every read), and lays a moonlit window on its far wall', () => {
    const A = assembleStageScene(BUILDING({ hall: { vary: 1, cold: 1.5 } }), {}), B = assembleStageScene(BUILDING({ hall: { vary: 1, cold: 1.5 } }), {});
    expect(JSON.stringify(A.lights)).toBe(JSON.stringify(B.lights));
    const own = A.lights.filter((l) => hall(l.position) && l.color[0] > 0.9 && l.color[2] < 0.5);
    expect(new Set(own.map((l) => l.color.map((v) => v.toFixed(3)).join())).size).toBeGreaterThan(1);
    const moon = A.lights.filter((l) => hall(l.position) && l.color[2] > l.color[0]);
    expect(moon.length).toBe(1);
    expect(A.faces.filter((f) => f.group === 'stage:window').length).toBe(1);
    expect(P0.faces.some((f) => f.group === 'stage:window')).toBe(false);
  }, 120_000);
});

describe('a toned room\'s lamps, hued', () => {
  it('the reference lamp stays neutral and a lamp of another colour shows how it differs, asked; unasked, every lamp neutral', () => {
    const lamps = [{ at: [0.5, 0.5, 2], color: '#ff9c48', intensity: 1.5, radius: 6 }, { at: [3, 0.5, 2], color: '#ff9c48', intensity: 1.5, radius: 6 }, { at: [6, 0.5, 4], color: '#8ea9ef', intensity: 1.5, radius: 9 }];
    const ask = { targets: { r0: '#808080' }, ambient: [0.1, 0.1, 0.1], lights: lamps, neutral: true, contrast: 0.3 };
    const flat = { light: solveRoomLight(ask) }, hued = { light: solveRoomLight({ ...ask, hued: true }) };
    const spread = (k) => Math.max(...k) - Math.min(...k);
    for (const k of flat.light.keys) expect(spread(k)).toBeLessThan(1e-6);
    expect(spread(hued.light.keys[0])).toBeLessThan(1e-6);
    expect(hued.light.keys[2][2]).toBeGreaterThan(hued.light.keys[2][0]);
  });
});
