// A sun for rooms indoors (era/stage.js `daylight`): the form render takes it live; a room without the word, and a
// painted page, are as they were.
import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';

const rooms = [{ id: 'a', x: 0, y: 0, w: 10, d: 14, h: 7 }], M = { kind: 'stage', kit: 'bay-military', rooms };
const day = { elevation: 38, azimuth: 200 };

describe('daylight: a sun for rooms indoors', () => {
  it('the form render takes it live: the sun in the room\'s record, every floor corner its share, no patch painted', () => {
    const P = assembleStageScene({ ...M, daylight: day }, { formLit: true });
    const R = P.form.room, sun = R.lights.find((l) => l.radius >= 1e8);
    expect(R.sun.live).toBe(true);
    expect(sun.live).toBe(true);
    // (toward the sun: up, and along its bearing)
    expect(sun.at[2]).toBeGreaterThan(0);
    const floor = P.faces.filter((f) => f.group === 'stage:floor');
    expect(floor.length).toBeGreaterThan(0);
    for (const f of floor) expect(Math.min(...[].concat(f.sunShare)), 'a floor corner\'s share').toBeGreaterThan(0.05);
    expect(P.faces.some((f) => f.group === 'stage:sunpatch')).toBe(false);
  }, 60000);

  it('a room without the word carries no sun, and a painted page none of it', () => {
    const plain = assembleStageScene(M, { formLit: true });
    expect(plain.form.room.sun).toBeUndefined();
    expect(plain.form.room.lights.some((l) => l.radius >= 1e8)).toBe(false);
    const paint = assembleStageScene({ ...M, daylight: day });
    expect(paint.form).toBeUndefined();
    expect(JSON.stringify(paint.faces)).toBe(JSON.stringify(assembleStageScene(M).faces));
  }, 60000);

  it('the word is checked: an elevation, a bearing, a colour, a gain; never on a kit that stands under its own sun', () => {
    expect(() => assembleStageScene({ ...M, daylight: { elevation: 120 } })).toThrow(/daylight is/);
    expect(() => assembleStageScene({ ...M, daylight: { elevation: 30, haze: 1 } })).toThrow(/daylight is/);
  });

  it('a sample is a material set down to be looked at: a liquid a pool on the floor, a metal a cube, each its own surface', () => {
    const P = assembleStageScene({ ...M, daylight: day, samples: [{ of: 'oil', at: [5, 6], size: 3 }, { of: 'chrome', at: [7, 9] }] }, { formLit: true });
    const oil = P.faces.filter((f) => f.group === 'stage:sample-oil'), cube = P.faces.filter((f) => f.group === 'stage:sample-chrome');
    expect(oil.length).toBeGreaterThan(0);
    expect(Math.max(...oil.flatMap((f) => f.corners.map((c) => c[2])))).toBeLessThan(0.02);
    expect(Math.max(...cube.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(1, 3);
    const S = P.form.room.reflect.surfaces;
    expect(S['stage:sample-oil'].metal).toBe(0);
    expect(S['stage:sample-chrome'].metal).toBe(1);
    expect(S['stage:sample-oil'].rough).toBeLessThan(S['stage:sample-chrome'].rough + 1);
    expect(() => assembleStageScene({ ...M, samples: [{ of: 'lava', at: [1, 1] }] })).toThrow(/samples are/);
  }, 60000);
});
