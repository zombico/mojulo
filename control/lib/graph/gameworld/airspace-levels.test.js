// A gameworld level that is an airspace (skyscape/airspace.js) takes the world's palette as every level does: the
// world's, or the world's moved by its colour script. The laws: no palette, no `palette` on the stage's manifest; a
// world's palette rides the airspace manifest as its spec; a script moves it level by level.
import { describe, it, expect } from 'vitest';
import { MEADOWMARK } from './index.js';
import { gameStages } from './levels.js';

const withAir = (W, style) => ({ ...W, ...(style ? { style: { ...W.style, ...style } } : {}), levels: { ...W.levels, sky: { name: 'The Sky', airspace: { map: { form: 'island', field: 1200, craft: 'glider' } } } } });
const airOf = (W) => gameStages(W).find((s) => s.section === 'airspace').manifest;

describe('an airspace level in the world\'s palette', () => {
  it('no palette: the manifest carries none', () => {
    expect(airOf(withAir(MEADOWMARK, { palette: false }))).not.toHaveProperty('palette');
  });
  it('the world\'s palette rides the manifest as its spec', () => {
    const palette = { preset: 'coastal-noon', seed: 4 };
    expect(airOf(withAir(MEADOWMARK, { palette })).palette).toEqual(palette);
  });
  it('a colour script moves it for the level', () => {
    const W = withAir(MEADOWMARK, { palette: { seed: 4, script: 'dusk' } }), last = Object.keys(W.levels).at(-1);
    expect(last).toBe('sky');
    expect(airOf(W).palette).toMatchObject({ seed: 4, shift: expect.any(Object) });
  });
});
