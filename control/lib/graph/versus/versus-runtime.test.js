import { describe, it, expect } from 'vitest';
import { versusSource, VERSUS_PAGE_MODULES } from './versus-page.js';
import { compileFighter } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';

// the page's runtime (versus-runtime.client.js) is a classic script; it is loaded here the way the page inlines it,
// with a canvas that draws nothing, so its overlay clocks can be read against its steps

const src = [...VERSUS_PAGE_MODULES, 'versus-runtime.client.js'].map(versusSource).join('\n');
const load = () => new Function('window', 'navigator', `${src}\nRT.muted = true;\nreturn { newMatch, stepMatch, drawHud, drawEffects };`)({}, {});
// a 2D context that accepts every call and returns itself (a gradient, a measure)
const canvas = () => {
  const g = new Proxy(function () {}, { get: (_t, k) => (k === 'width' ? 0 : g), set: () => true, apply: () => g });
  return g;
};

describe('versus runtime: the overlay keeps the match\'s time, not the screen\'s', () => {
  const F = compileFighter(solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe);
  const watch = (drawsPerStep, steps) => {
    const R = load();
    const g = canvas();
    const m = R.newMatch({ fighters: [F, F], names: ['A', 'B'], colors: ['#e0503a', '#3a9be0'], schemes: ['modern', 'modern'], mode: 'watch', level: 1, rules: {}, seed: 5 });
    const seen = [];
    for (let k = 0; k < steps; k++) {
      R.stepMatch(m);
      for (let d = 0; d < drawsPerStep; d++) { R.drawEffects(g, m, () => [0, 0], 1); R.drawHud(g, 1280, 720, m); }
      seen.push([m.banner && m.banner.n > 0 ? `${m.banner.t}:${m.banner.n}` : '', m.flash && m.flash.n > 0 ? `${m.flash.text}:${m.flash.n}` : '', m.superFlash, m.sparks.length, Math.round(m.shake * 1000), Math.round(m.lag[0])]);
    }
    return seen;
  };

  it('a banner, a toast, the sparks, the shake and the trailing health last the same steps however often they are drawn', () => {
    const still = watch(0, 900);
    const fast = watch(5, 900);
    expect(fast).toEqual(still);
    // FIGHT! lasts its 40 steps, a frame of sim per step, not per picture
    const fight = still.filter(([b]) => b.startsWith('FIGHT!')).length;
    expect(fight).toBe(40);
    expect(still.some(([, , , sparks]) => sparks > 0)).toBe(true);
  });
});
