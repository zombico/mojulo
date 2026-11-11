// Why a floor is not one shade (floor-shades.js), and the parts a plan lays over the rest (era/stage.js planRect): a
// threshold inside each doorway, an apron round the tomb.
import { describe, it, expect } from 'vitest';
import { FLOOR_SHADES, floorShade, shadeTint } from './floor-shades.js';
import { assembleStageScene, STAGE_KITS } from './stage.js';

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('a floor\'s shades', () => {
  it('each shade has a cause said in words, and leans the way its cause does', () => {
    for (const [id, S] of Object.entries(FLOOR_SHADES)) { expect(S.why.length, id).toBeGreaterThan(10); expect(S.hue).toHaveLength(3); }
    const T = [0.6, 0.6, 0.6], y = (c) => lum(shadeTint(T, c));
    // (what feet polish and what is new are lighter than the floor as laid; what nobody walks, soot and damp darker)
    expect(y('worn')).toBeGreaterThan(y('plain'));
    expect(y('relaid')).toBeGreaterThan(y('worn'));
    for (const dark of ['unwalked', 'soot', 'damp']) expect(y(dark), dark).toBeLessThan(y('plain'));
    // (soot is warm, damp is cool)
    expect(shadeTint(T, 'soot')[0]).toBeGreaterThan(shadeTint(T, 'soot')[2]);
    expect(shadeTint(T, 'damp')[2]).toBeGreaterThan(shadeTint(T, 'damp')[0]);
    expect(floorShade('no-such-cause')).toBe(FLOOR_SHADES.plain);
    expect(shadeTint([0.95, 0.95, 0.95], 'relaid').every((v) => v <= 1)).toBe(true);
  });

  it('a plan lays a threshold inside each doorway and an apron round the tomb, cut into the rest: no part lies on another, none is missing', () => {
    const M = { kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'hall', x: 0, y: 0, w: 12, d: 22, h: 9 }, { id: 'side', x: 12, y: 6, w: 10, d: 10, h: 6 }], links: [{ from: 'side', to: 'hall' }] };
    const P = assembleStageScene(M, { unshaded: true }), FP = STAGE_KITS['gothic-ashlar'].floorPlan;
    const hall = P.faces.filter((f) => f.group === 'stage:floor' && f.corners.every((c) => c[0] < 11.6 && c[2] === 0));
    const area = (f) => { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); };
    const xs = hall.flatMap((f) => f.corners.map((c) => c[0])), ys = hall.flatMap((f) => f.corners.map((c) => c[1]));
    const whole = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)), sum = hall.reduce((a, f) => a + area(f), 0);
    expect(sum).toBeGreaterThan(whole * 0.97);
    expect(sum).toBeLessThan(whole * 1.001);
    // (the fills an unshaded read carries are the parts' tints: more than two shades on one floor of one stone)
    const shades = new Set(hall.map((f) => f.fill));
    expect(shades.size).toBeGreaterThan(2);
    expect(new Set(hall.map((f) => f.texture.slice(0, -2))).size).toBe(1);
    expect(FP.threshold.shade).toBe('worn');
    expect(FP.apron.shade).toBe('soot');
    // (a floor meant all alike is clean: its fields every one the floor as laid, so fewer shades)
    const same = assembleStageScene({ ...M, rhythm: 'same' }, { unshaded: true }).faces.filter((f) => f.group === 'stage:floor' && f.corners.every((c) => c[0] < 11.6 && c[2] === 0));
    expect(new Set(same.map((f) => f.fill)).size).toBeLessThanOrEqual(shades.size);
  }, 120_000);
});
