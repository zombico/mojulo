/**
 * The live shadows' static bodies and the land's sun (scene/channels/cast-shadows.js). Claims under test: a page with a
 * body that stands still for the whole level (`stills`) gains the seam that puts it in the static world, so it casts
 * into the hour's map; a page whose bodies are lit by the land's own sun (`landSun`) draws that sun's map with the
 * static world in it, at the hour's pass and whenever the land asks for the map again; absent, the script carries
 * neither.
 */
import { describe, expect, it } from 'vitest';

import { liveShadowScript } from './cast-shadows.js';

const BASE = { actors: true, hour: true, toLight: [0.5, 0.4, 0.7], alpha: 0.38, mapSize: 2048, span: 16, lead: 8 };

describe('the live shadows\' static bodies', () => {
  it('a still body joins the static world only where one stands', () => {
    const plain = liveShadowScript(BASE), stills = liveShadowScript({ ...BASE, stills: true });
    expect(plain).not.toContain('still(root)');
    expect(stills).toContain('still(root)');
    expect(stills).toContain('__csStatic.add(o)');
    expect(stills.length).toBeGreaterThan(plain.length);
  });
  it('the land\'s sun holds the static world only on a page lit by it', () => {
    const plain = liveShadowScript(BASE), land = liveShadowScript({ ...BASE, landSun: true });
    expect(plain).not.toContain('__formSun');
    expect(land.match(/window\.__formSun\.shadow\.needsUpdate/g).length).toBeGreaterThanOrEqual(2);
  });
});

describe('the live shadows fitted to a built place', () => {
  it('fits its maps to the box it is given, and to the whole static stage without one', () => {
    const plain = liveShadowScript(BASE), fit = liveShadowScript({ ...BASE, fit: { at: [10, 20, 6], half: 40 } });
    expect(plain).not.toContain('__CS.fit');
    expect(fit).toContain('__csC.set(__CS.fit.at[0], __CS.fit.at[1], __CS.fit.at[2]); __csR = __CS.fit.half;');
  });
});
