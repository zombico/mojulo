import { describe, it, expect } from 'vitest';
import { geocubeCastLight, heroCastLight } from './cast-light.js';
import { readGeocube } from './geocube.js';
import { castLightFactor, shadeHex } from '../polygonizer/vexar.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const lit = (cube) => geocubeCastLight(readGeocube(cube));
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('a cube\'s light on a figure', () => {
  it('island noon: a warm high sun, a sky-blue shade, the floor bounced up', () => {
    const L = lit('island-noon');
    expect(L.from).toEqual({ geocube: 'island-noon', reference: 'island-noon', key: 'sun' });
    expect(L.toLight[2]).toBeGreaterThan(0.8);                         // elevation 58°
    const up = castLightFactor(L.toLight, L), away = castLightFactor(L.toLight.map((v) => -v), L);
    expect(lum(up)).toBeGreaterThan(lum(away) + 0.3);                   // the key reads
    expect(away[2]).toBeGreaterThan(away[0]);                          // the shade side leans to the sky's blue
    expect(up[0] / up[2]).toBeGreaterThan(away[0] / away[2]);          // the lit side warmer than the shade
    expect(Math.max(...up)).toBeLessThan(1);                           // the shoulder: never clips
    expect(L.bounce ?? L.cast.bounce).toEqual(L.cast.bounce);
    expect(L.cast.bounce.every((v) => v > 0)).toBe(true);
  });

  it('gothic night: no sun in the reference, so the cube\'s moon is the key, dimmed by its gain, and no bounce', () => {
    const L = lit('gothic-night');
    expect(L.from.key).toBe('moon');
    expect(L.cast.bounce).toEqual([0, 0, 0]);
    expect(L.cast.key[2]).toBeGreaterThan(L.cast.key[0]);              // a cold key
    const shade = castLightFactor(L.toLight.map((v) => -v), L);
    expect(lum(shade)).toBeGreaterThan(0.35);                           // shade is a colour, never black
    expect(shade[2]).toBeGreaterThan(shade[0]);
  });

  it('the rim is the reference\'s horizon sky; a banded register bands the key', () => {
    expect(lit('jungle-haze').rim).toEqual([0.6588, 0.6902, 0.6275, 0.45, 3]);
    const banded = lit({ from: 'island-noon', register: { steps: 3, key: 0.5 } });
    expect(banded.bands).toBe(3);
    const n = [Math.SQRT1_2, 0, Math.SQRT1_2];
    expect(castLightFactor(n, banded)).not.toEqual(castLightFactor(n, lit('island-noon')));
  });

  it('shadeHex reads a cast light per channel and leaves every other light as it was', () => {
    const L = lit('island-noon');
    expect(shadeHex('#808080', L.toLight, L)).not.toBe(shadeHex('#808080', L.toLight, { ...L, cast: undefined }));
    expect(heroCastLight({ cast: 'male' })).toBeNull();
  });
});

describe('a hero baked in its cube\'s light', () => {
  const world = async (hero) => WORLD_KINDS.layered.resolve(expandLayeredManifest({ kind: 'layered', hero: heroRecord(hero) }), {});

  it('the figure takes the cube\'s colours and its rim; without a cube it is today\'s figure', async () => {
    const plain = await world({ cast: 'male' }), noon = await world({ cast: 'male', geocube: 'island-noon' }), night = await world({ cast: 'male', geocube: 'gothic-night' });
    expect(plain.figures.body.rim).toBeUndefined();
    expect(noon.figures.body.rim).toEqual(lit('island-noon').rim);
    const fills = (w) => w.faces.filter((f) => f.group === 'body').map((f) => f.fill);
    expect(fills(noon)).not.toEqual(fills(plain));
    expect(fills(night)).not.toEqual(fills(noon));
    expect(noon.figures.body.parts.map((p) => p && p.col)).not.toEqual(plain.figures.body.parts.map((p) => p && p.col));
  }, 120000);

  it('an anime hero on a cube is lit by the cube, not by its read-time cel light; a named toon.light still wins', async () => {
    const cel = await world({ cast: 'female', head: 'anime' }), cube = await world({ cast: 'female', head: 'anime', geocube: 'jungle-haze' });
    expect(cel.figures.body.rim).toBeUndefined();
    expect(cube.figures.body.rim).toEqual(lit('jungle-haze').rim);
    expect(cube.faces.some((f) => Array.isArray(f.cornerFills))).toBe(true);   // smooth under the cube, as the landmark head is
  }, 180000);
});
