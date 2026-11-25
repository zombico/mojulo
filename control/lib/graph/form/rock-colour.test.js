import { describe, it, expect } from 'vitest';
import { readRockColour, rockColourAt } from './rock-colour.js';
import { readGeocube } from '../era/geocube.js';

// THE ROCK'S COLOUR (rock-colour.js): a cube's rock coloured by its beds and its weather. One case per concept: the words
// read and refuse; a band takes its cube colour by height, eased over its contact; each thin bed is its own tone and the
// same place the same colour; the varnish darkens some walls and not others; a geocube takes the word and checks it.
const bases = { stone: '#a0503a', trim: '#e0c8a0', floor: '#c88a5c' };
const STONE = [160, 80, 58];

describe('the rock\'s colour', () => {
  it('reads its words and refuses what it does not know, teaching', () => {
    expect(readRockColour(undefined)).toBeNull();
    const R = readRockColour({ beds: [{ to: 10 }, { to: 100, toward: 'trim' }] });
    expect(R.beds[1]).toEqual({ to: 100, toward: 'trim', mix: 0.5, value: 0 });
    expect(() => readRockColour({ beds: [] })).toThrow(/at least one/);
    expect(() => readRockColour({ beds: [{ to: 10 }, { to: 5 }] })).toThrow(/bottom up/);
    expect(() => readRockColour({ beds: [{ to: 10 }], streaks: 1 })).toThrow(/not a word/);
    expect(() => readRockColour({ beds: [{ to: 10, mix: 2 }] })).toThrow(/mix is 0..1/);
  });

  it('takes its band\'s colour by height, eased over the contact', () => {
    const at = rockColourAt(readRockColour({ beds: [{ to: 50 }, { to: 2000, toward: 'trim', mix: 1 }], blend: 4, thin: false }), bases);
    expect(at(0, 0, 10, STONE)).toEqual(STONE);
    expect(at(0, 0, 80, STONE)).toEqual([224, 200, 160]);
    const mid = at(0, 0, 50, STONE);
    for (let c = 0; c < 3; c++) expect(mid[c]).toBeGreaterThan(STONE[c]);
    for (let c = 0; c < 3; c++) expect(mid[c]).toBeLessThan([224, 200, 160][c]);
  });

  it('gives each thin bed its own tone, the same place the same colour', () => {
    const R = readRockColour({ beds: [{ to: 2000 }], thin: { beds: [4, 6], jitter: 0.2 } }), a = rockColourAt(R, bases), b = rockColourAt(structuredClone(R), bases);
    const tones = new Set();
    for (let z = 0; z < 60; z += 1) { const c = a(5, 5, z, STONE); expect(b(5, 5, z, STONE)).toEqual(c); tones.add(c.join()); }
    expect(tones.size).toBeGreaterThan(4);
  });

  it('streaks the varnish down some walls and leaves others clean', () => {
    const at = rockColourAt(readRockColour({ beds: [{ to: 2000 }], thin: false, varnish: { strength: 1, width: 10, mask: 40 } }), bases);
    let dark = 0, clean = 0;
    for (let i = 0; i < 400; i++) { const c = at(i * 3.7, i * 1.3, 20, STONE); if (c[0] < STONE[0] - 10) dark++; else if (c[0] === STONE[0]) clean++; }
    expect(dark).toBeGreaterThan(10);
    expect(clean).toBeGreaterThan(10);
  });

  it('lifts an edge and darkens a crease by how far the corner stands out of its neighbours', () => {
    const at = rockColourAt(readRockColour({ beds: [{ to: 2000 }], thin: false, wear: { edge: 0.3, crease: 0.3, reach: 1 } }), bases);
    expect(at(0, 0, 10, STONE, 0)).toEqual(STONE);
    expect(at(0, 0, 10, STONE, 2)[0]).toBeGreaterThan(STONE[0]);
    expect(at(0, 0, 10, STONE, -2)[0]).toBeLessThan(STONE[0]);
  });

  it('parts the rock into sections each its own mood, keyed to their place: never a repeating tile', () => {
    const at = rockColourAt(readRockColour({ beds: [{ to: 2000 }], thin: false, sections: { size: 20, value: 0.2, hue: 0.3, toward: 'trim' } }), bases);
    // (one section's ground is one colour; across many, many colours; and a section's mood is not its neighbour's a
    // lattice's period away, as a tile's would be)
    expect(at(1, 1, 10, STONE)).toEqual(at(1.2, 1.1, 10, STONE));
    const seen = new Set();
    for (let i = 0; i < 60; i++) seen.add(at(i * 23, i * 7, 10, STONE).join());
    expect(seen.size).toBeGreaterThan(20);
    let same = 0;
    for (let i = 0; i < 40; i++) if (at(i * 13, 5, 10, STONE).join() === at(i * 13 + 200, 5, 10, STONE).join()) same++;
    expect(same).toBeLessThan(10);
  });

  it('is a geocube\'s word, checked as the cube is read', () => {
    const cube = readGeocube('sandstone-wadi');
    expect(cube.outside.rock.beds.length).toBeGreaterThan(1);
    expect(() => readGeocube({ from: 'sandstone-wadi', outside: { rock: { beds: 3 } } })).toThrow(/outside.rock.beds/);
  });
});
