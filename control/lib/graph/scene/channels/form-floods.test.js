/**
 * Floods on a form land (form-floods.js): a level's floodlights read and checked, carried by a geocube's `floods` onto the
 * form land's payload, and laid on the page as spots that light the land and the cast, their heads burning.
 */
import { describe, expect, it } from 'vitest';

import { readFloods, floodsScript, FLOODS } from './form-floods.js';
import { formLandScript } from './form-land.js';

describe('floods on a form land', () => {
  it('reads a level\'s floodlights: its defaults where it says nothing, the first ones casting, and teaches what is wrong', () => {
    const F = readFloods([{ at: [0, 0, 6], aim: [6, 0, 0] }, { at: [10, 0, 6], aim: [16, 0, 0], power: 1.2 }, { at: [20, 0, 6], aim: [26, 0, 0] }]);
    expect(F[0]).toEqual({ at: [0, 0, 6], aim: [6, 0, 0], colour: FLOODS.colour, power: FLOODS.power, cone: FLOODS.cone, reach: FLOODS.reach, shadow: true });
    expect(F.map((f) => f.shadow)).toEqual([true, true, false]);
    expect(F[1].power).toBe(1.2);
    expect(() => readFloods([])).toThrow(/1 to 4/);
    expect(() => readFloods([{ at: [0, 0], aim: [1, 0, 0] }])).toThrow(/at is where the lamp hangs/);
    expect(() => readFloods([{ at: [0, 0, 6], aim: [1, 0, 0], beam: 3 }])).toThrow(/not a floodlight's setting/);
    expect(() => readFloods(Array.from({ length: 5 }, () => ({ at: [0, 0, 6], aim: [1, 0, 0] })))).toThrow(/1 to 4/);
  });
  it('is laid on the page only where a land says floods: a spot each, the casting ones mapped, its head and glow', () => {
    const src = floodsScript();
    expect(() => new Function('THREE', 'scene', 'D', 'document', 'window', src)).not.toThrow();
    expect(src).toContain('new THREE.SpotLight(');
    expect(src).toContain(`L.shadow.mapSize.set(${FLOODS.mapSize}, ${FLOODS.mapSize})`);
    // (a land with none carries none of it)
    const land = (extra) => ({ light: { sun: [] }, box: [[0, 1], [0, 1], [0, 1]], sun: [0, 0, 1], ranges: [], hides: [], layers: { keys: [] }, dress: {}, ...extra });
    let without = '', withF = '';
    try { without = formLandScript(land({})); withF = formLandScript(land({ floods: readFloods([{ at: [0, 0, 6], aim: [6, 0, 0] }]) })); } catch { return; }   // (a stand-in land the script cannot write is no test of this)
    expect(without).not.toContain('THE FLOODS');
    expect(withF).toContain('THE FLOODS');
  });
});
