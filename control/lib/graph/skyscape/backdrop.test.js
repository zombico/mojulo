import { describe, expect, it } from 'vitest';

import { planBackdrop, validateBackdrop, BACKDROP } from './backdrop.js';
import { assembleAirspace } from './airspace.js';
import { SPACE_STAR } from './space.js';
import { skyDomeScript } from '../scene/channels/sky-dome.js';

// ── the space backdrop (backdrop.js): a nebula's band, planets lit by the map's star, a far sun ────────────────────────
const S = [...SPACE_STAR.dir];
const ang = (a, b) => (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))))) * 180) / Math.PI;
const hueOf = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; const x = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };

describe('the space backdrop', () => {
  it('is the same sky for the same star and seed, and another for another seed', () => {
    expect(planBackdrop({ star: S, seed: 4 })).toEqual(planBackdrop({ star: S, seed: 4 }));
    expect(planBackdrop({ star: S, seed: 5 })).not.toEqual(planBackdrop({ star: S, seed: 4 }));
  });

  it('its primary lit from the side, every planet clear of the star and of each other, the far sun far from the near', () => {
    for (const seed of [1, 2, 3]) {
      const B = planBackdrop({ star: S, seed, planets: 3, worlds: ['jovian'] }), [P] = B.planets;
      const a = ang(P.dir, S);
      expect(a).toBeGreaterThanOrEqual(BACKDROP.phase[0] - 1e-6);
      expect(a).toBeLessThanOrEqual(BACKDROP.phase[1] + 1e-6);
      expect(P.r).toBeGreaterThanOrEqual(BACKDROP.primary[0]);
      for (const p of B.planets) expect(ang(p.dir, S)).toBeGreaterThan(p.r + BACKDROP.clear);
      for (const p of B.planets.slice(1)) expect(ang(p.dir, S)).toBeLessThanOrEqual(BACKDROP.lit + 1e-6);   // (lit, at least half)
      for (let i = 0; i < B.planets.length; i++) for (let j = i + 1; j < B.planets.length; j++) expect(ang(B.planets[i].dir, B.planets[j].dir)).toBeGreaterThan(B.planets[i].r + B.planets[j].r);
      for (const f of B.suns) expect(ang(f.dir, S)).toBeGreaterThanOrEqual(BACKDROP.sun.from);
    }
  });

  it('its nebula cool and never the target\'s magenta; its words read, a wrong one taught', () => {
    for (const seed of [1, 2, 3, 4]) {
      const N = planBackdrop({ star: S, seed }).nebula;
      for (const h of [N.a, N.b]) { const x = hueOf(h); expect(x < BACKDROP.forbid[0] || x > BACKDROP.forbid[1], h).toBe(true); expect(x).toBeGreaterThan(150); }
    }
    expect(planBackdrop({ star: S, nebula: false, planets: 0, suns: 0 })).toEqual({ nebula: null, planets: [], suns: [] });
    expect(validateBackdrop({ planets: 2, nebula: true })).toEqual([]);
    expect(validateBackdrop({ planets: 5 })[0]).toMatch(/0 to 3/);
    expect(validateBackdrop({ moons: 1 })[0]).toMatch(/not a backdrop's word/);
  });

  it('the worlds a level names are the ones it gets, the rest drawn; a black hole keeps its whole disk clear of the star', () => {
    const B = planBackdrop({ star: S, seed: 9, planets: 3, worlds: ['black-hole', 'random', 'city'] });
    expect(B.planets.map((p) => p.kind)[0]).toBe('black-hole');
    expect(B.planets[2].kind).toBe('city');
    const H = B.planets[0];
    expect(ang(H.dir, S)).toBeGreaterThan(H.r * H.disk[1]);
    expect(validateBackdrop({ worlds: ['black-hole', 'saturnian'] })).toEqual([]);
    expect(validateBackdrop({ worlds: ['dyson-sphere'] })[0]).toMatch(/not a kind of world/);
  });

  it('a space map\'s sky carries it, unless it says none; the page bakes it only where it is, and keeps stars off its planets', () => {
    const M = { kind: 'airspace', map: { craft: 'fighter', field: 3000 }, space: { asteroids: 'none' }, seed: 3 };
    const sky = assembleAirspace(M, {}).sky;
    expect(sky.backdrop.planets.length).toBeGreaterThan(0);
    expect(assembleAirspace({ ...M, space: { asteroids: 'none', backdrop: false } }, {}).sky.backdrop).toBeUndefined();
    const base = { space: true, zenith: [], horizon: [], day: 0, stars: 1, seed: 7, center: [0, 0, 0], radius: 7000, sun: { dir: S } };
    expect(skyDomeScript(base)).not.toContain('space backdrop');
    const page = skyDomeScript({ ...base, backdrop: sky.backdrop });
    for (const w of ['space backdrop', 'WebGLCubeRenderTarget', 'scene.background = sky.texture', 'HalfFloatType', '__onPlanet']) expect(page, w).toContain(w);
    // (the lensing pass only for a sky with a black hole in it)
    expect(page).not.toContain('HOLE =');
    const hole = planBackdrop({ star: S, seed: 9, worlds: ['black-hole'] });
    expect(skyDomeScript({ ...base, backdrop: hole })).toContain('HOLE =');
  });
});
