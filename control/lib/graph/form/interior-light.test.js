import { describe, it, expect } from 'vitest';
import { readInterior, interiorLights, interiorPayload, MAX_LAMPS } from './interior-light.js';

// THE INTERIOR'S LIGHT (interior-light.js): a land under a roof. One case per concept: the words read and refuse; a
// place's own lamps are hung, the nearest its middle kept; with none, rows under the roof; the page reads no sky.
const box = [[-500, 500], [-500, 500], [0, 80]];

describe('the interior\'s light', () => {
  it('reads its words over its defaults and refuses what it does not know', () => {
    const I = readInterior({ lamps: { spacing: 100 } });
    expect(I.lamps.spacing).toBe(100);
    expect(I.void).toMatch(/^#/);
    expect(readInterior(undefined)).toBeNull();
    expect(() => readInterior({ sun: 1 })).toThrow(/not a word/);
    expect(() => readInterior({ haze: { density: 1 } })).toThrow(/density/);
  });

  it('hangs a place\'s own lamps, the nearest its middle kept; with none, rows under the roof', () => {
    const I = readInterior({}), own = Array.from({ length: 30 }, (_, k) => ({ at: [k * 30 - 450, 0, 70] }));
    const L = interiorLights(I, { box, lamps: own, glows: [{ at: [10, 10, 5] }] });
    expect(L.lamps.length).toBe(MAX_LAMPS);
    expect(Math.max(...L.lamps.map((q) => Math.abs(q.at[0])))).toBeLessThan(200);
    expect(L.glows[0].colour).toBe(I.glow.colour);
    const rows = interiorLights(I, { box, floor: 0 });
    expect(rows.lamps.length).toBeGreaterThan(0);
    for (const q of rows.lamps) expect(q.at[2]).toBe(I.lamps.height);
    expect(interiorPayload(I, L)).toMatchObject({ void: I.void, lamps: L.lamps, env: { lamp: I.lamps.colour } });
  });
});
