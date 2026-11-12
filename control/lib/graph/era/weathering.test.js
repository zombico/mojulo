// Weathering (era/weathering.js): one scale for how far the causes have worked on a room's surfaces, an axis apart from
// its debris. One small ashlar crypt holds the concept: the scale tells each surface by its cause, the kit as drawn at
// its middle; a cause set to nothing leaves its surfaces be; weathering and debris turn on their own.
import { describe, it, expect } from 'vitest';
import { readWeathering, withWeathering, WEATHERING, WEATHER_CAUSES } from './weathering.js';
import { assembleStageScene, STAGE_KITS } from './stage.js';
import { generatedSpecOf } from '../landscape/surface-textures.js';

const ROOM = (over = {}) => ({ kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 12, h: 8 }], ...over });
const wallLoss = (P, group = 'stage:wall') => { const f = P.faces.find((q) => q.group === group && typeof q.texture === 'string' && q.texture.startsWith('gen:dressed')); return generatedSpecOf(f.texture).cfg.loss; };
const debris = (P) => (P.repeats || []).filter((r) => r.group.startsWith('skandart:')).length;

describe('weathering', () => {
  it('reads one scale and its causes; a cause it does not know, or a number off the scale, teaches', () => {
    expect(readWeathering({ weathering: 0.7 })).toEqual({ amount: 0.7, causes: Object.fromEntries(WEATHER_CAUSES.map((c) => [c, 1])) });
    expect(readWeathering({ weathering: { damp: 0.5 } })).toMatchObject({ amount: WEATHERING.authored, causes: { damp: 0.5, water: 1 } });
    expect(readWeathering({})).toBe(null);
    expect(() => readWeathering({ weathering: { rust: 1 } })).toThrow(/not a cause/);
    expect(() => readWeathering({ weathering: 2 })).toThrow(/0 \(fresh\) to 1/);
  });

  it('tells each surface by its cause, the kit as drawn at the middle: the coat lost low by damp and high by water, soot by fire, cracks and growth past the middle', () => {
    const ash = STAGE_KITS['gothic-ashlar'], low0 = generatedSpecOf(`${ash.tiles.wall.family}-a`).cfg.loss;
    expect(withWeathering({ weathering: WEATHERING.authored }, ash)._weathering.set.coat.low).toBeCloseTo(low0, 5);
    const full = withWeathering({ weathering: 1 }, ash)._weathering.set, none = withWeathering({ weathering: 0 }, ash)._weathering.set;
    expect(full.coat.low).toBe(WEATHERING.coat.low);
    expect(none.coat.low).toBe(0);
    expect(full.cracks).toBeGreaterThan(0);
    expect(none.cracks).toBeUndefined();
    // (a cause at nothing leaves its surfaces be: no fire, no soot; no damp, the low coat as drawn, no growth)
    const dry = withWeathering({ weathering: { amount: 1, damp: 0, fire: 0 } }, ash)._weathering.set;
    expect(dry.dirt.soot).toBe(0);
    expect(dry.coat.low).toBeCloseTo(low0, 5);
    expect(dry.growth).toBeUndefined();
    // (a recipe's own dial stands over the scale's)
    expect(withWeathering({ weathering: 1, grime: 0.2 }, ash).grime).toBe(0.2);
  });

  it('turns apart from the debris: weathered and swept, fresh and heaped; the wall\'s coat as weathered as asked', () => {
    const weatheredSwept = assembleStageScene(ROOM({ weathering: 1, skandart: 0 }), {}), freshHeaped = assembleStageScene(ROOM({ weathering: 0.05, skandart: 1 }), {});
    expect(wallLoss(weatheredSwept)).toBeGreaterThan(wallLoss(freshHeaped));
    expect(debris(weatheredSwept)).toBe(0);
    expect(debris(freshHeaped)).toBeGreaterThan(0);
    // (debris at 0 is a room where nothing lies: not even the kit's own fallen stone)
    expect(weatheredSwept.anchors.filter((a) => ['stones', 'boulder', 'debris'].includes(a.form))).toEqual([]);
    expect(weatheredSwept.weathering).toMatchObject({ amount: 1, set: { coat: { low: WEATHERING.coat.low } } });
    // (asked nothing, the room is as drawn)
    expect(assembleStageScene(ROOM(), {}).weathering).toBeUndefined();
  }, 300_000);
});
