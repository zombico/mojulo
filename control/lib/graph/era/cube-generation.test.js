/**
 * A cube's generation (era/cube-generation.js, era/geocube.js): gen-6 pure poly, gen-7 the texture-map layer, decided
 * once for the world. One cube of literal colours and one solved from a palette, the two ways a cube has its ramps.
 */
import { describe, it, expect } from 'vitest';
import { isTextured, cubeTexture, DEFAULT_WEAR } from './cube-generation.js';
import { readGeocube, geocubeRamps, geocubeRelief, geocubeReadout, lowerGeocube, GEOCUBE_PALETTES } from './geocube.js';
import { solvePalette, RELIEF_STOPS } from '../color-theorist/solve.js';

const solvedSpec = { ...GEOCUBE_PALETTES['valley-morning'], seed: 3 };

describe('the generation', () => {
  it('gen-6 is pure poly whatever its grit says; gen-7 is the texture layer, its grit the wear', () => {
    expect(cubeTexture(readGeocube('valley-morning'))).toBeNull();
    expect(cubeTexture(readGeocube({ from: 'valley-morning', grit: 0.9 }))).toBeNull();
    expect(cubeTexture(readGeocube({ from: 'valley-morning', era: 'gen-7' }))).toBe(DEFAULT_WEAR);
    expect(cubeTexture(readGeocube({ from: 'valley-morning', era: 'gen-7', grit: 0.2 }))).toBe(0.2);
    // the first terrain past the sixth generation is gen-7
    expect(isTextured(readGeocube('limestone-crags'))).toBe(true);
  });

  it('a gen-7 room is dressed from relief, a gen-6 one keeps its pixel maps whatever its grit', () => {
    const six = lowerGeocube(readGeocube({ from: 'valley-morning', grit: 0.8 }), 'inside'), seven = lowerGeocube(readGeocube({ from: 'valley-morning', era: 'gen-7', grit: 0.8 }), 'inside');
    expect(six.tiles.wall.gen).not.toBe('dressed');
    expect(seven.tiles.wall.gen).toBe('dressed');
    // the land's rock draws its fabric only for gen-7
    expect(lowerGeocube(readGeocube({ from: 'valley-morning', grit: 0.8 }), 'outside').meru.shading?.grit).toBeUndefined();
    expect(lowerGeocube(readGeocube({ from: 'valley-morning', era: 'gen-7', grit: 0.8 }), 'outside').meru.shading.grit).toBe(0.8);
  });

  it('a gen-7 cube carries its relief beside its ramps: each ramp, two deeper shades and their light negatives', () => {
    const C = readGeocube('limestone-crags'), R = geocubeRamps(C), V = geocubeRelief(C);
    for (const [k, ramp] of Object.entries(R)) {
      expect(V[k]).toHaveLength(RELIEF_STOPS);
      expect(V[k].slice(2, 7)).toEqual(ramp);
    }
    const out = geocubeReadout(C, 'land', null, {});
    expect(out.relief).toEqual(V);
    expect(out.texture).toEqual({ layer: 'texture-map', wear: C.grit });
    // gen-6: no relief; naming grit, told what it asks for
    expect(geocubeRelief(readGeocube('valley-morning'))).toBeNull();
    expect('relief' in geocubeReadout(readGeocube('valley-morning'), 'land', null, {})).toBe(false);
    expect(geocubeReadout(readGeocube({ from: 'valley-morning', grit: 0.5 }), 'land', null, {}).texture).toMatchObject({ layer: 'pure poly', says: expect.stringMatching(/era 'gen-7'/) });
  });

  it('a gen-7 cube solved from a palette keeps the theorist\'s ramps and relief: added to, never regrown', () => {
    const C = readGeocube({ from: 'valley-morning', era: 'gen-7', palette: solvedSpec }), R = geocubeRamps(C), V = geocubeRelief(C);
    expect(C.palette.era).toBe('gen-7');
    const { id: _i, reads: _r, ...spec } = C.palette, K = solvePalette(spec);
    expect(K.era).toBe('gen-7');
    expect(R.stone).toEqual(K.roles.rock);
    expect(V.stone).toEqual(K.relief.rock);
    // a gen-6 cube from the same palette rebuilds its ramps from the colours, as it always has
    const six = readGeocube({ from: 'valley-morning', palette: solvedSpec });
    expect(six.palette.era).toBeUndefined();
    expect(geocubeRamps(six).stone).not.toEqual(K.roles.rock);
  });

  it('its palette takes the cube\'s generation, never another', () => {
    expect(() => readGeocube({ from: 'valley-morning', palette: { ...solvedSpec, era: 'gen-7' } })).toThrow(/palette.era is the cube's \(gen-6\)/);
  });
});
