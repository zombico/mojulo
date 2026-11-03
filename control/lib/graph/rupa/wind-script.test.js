import { describe, it, expect } from 'vitest';
import { composeLive } from '../worlds/controllable/compose.js';
import { blockMatter } from './matter.js';
import { scriptOf, leafAt, fallSpeed, releaseOf, scriptUniforms, GLSL } from './wind-script.js';

// the full simulation the script stands in for: a leaf as a runtime body
const CW = composeLive();
const LEAF = { size: [0.06, 0.04, 0.002], mass: 0.06 * 0.04 * 0.0003 * 600, joules: 1, stiff: 1e8, bounce: 0.1 };
const simulate = (wind, at, seconds, blocks = []) => {
  const anchor = { id: 'far', min: [90, 90, 0], max: [90.5, 90.5, 0.5], hp: 1, ...blockMatter({ min: [90, 90, 0], max: [90.5, 90.5, 0.5] }, 'stone') };
  const w = CW.createWorld({ entities: [], breakables: [anchor, ...blocks], rupa: wind ? { wind } : {} });
  CW.throwMatter(w, { id: 'leaf', at, vel: [0, 0, 0], ...LEAF });
  let landed = null;
  for (let i = 0; i < seconds * 60; i++) { CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); const b = w.rupa.bodies[0]; if (!landed && b.pos[2] - b.half[2] < 0.01) landed = [...b.pos]; }
  return { body: w.rupa.bodies[0], landed };
};
const point = (p) => ({ min: p, max: p });

describe('the wind script: the physics written as a formula of time', () => {
  it('its falling speed is the speed a simulated leaf reaches', () => {
    const { body } = simulate(null, [0, 0, 30], 4);
    expect(fallSpeed('leaf')).toBeCloseTo(-body.vel[2], 1);
  });

  it('over a whole fall it drifts where the simulated leaf lands, in a steady wind', () => {
    const wind = { speed: 8, dir: 0 }, s = scriptOf(wind, { source: point([0, 0, 5]) });
    const landAt = 5 / s.vt - 1e-6, scripted = leafAt(s, 0, landAt + 0).pos[0];
    // (leafAt's age is offset by its seed: find the time its own cycle is at landing)
    const cycle = 5 / s.vt + s.rest;
    let x = null;
    for (let t = 0; t < cycle; t += 0.01) { const L = leafAt(s, 0, t); if (L.falling && L.age > landAt - 0.02) { x = L.pos[0]; break; } }
    const sim = simulate(wind, [0, 0, 5], 6).landed[0];
    expect(scripted).toBeDefined();
    expect(Math.abs(x - sim) / sim).toBeLessThan(0.12);
  });

  it('behind a wall the scripted leaf drifts less, as the simulated one does', () => {
    const wall = { min: [0, -3, 0], max: [0.4, 3, 3] };
    const lee = scriptOf({ speed: 10, dir: 0 }, { source: point([1, 0, 2.5]), wakes: [wall] }), open = scriptOf({ speed: 10, dir: 0 }, { source: point([1, 10, 2.5]), wakes: [wall] });
    const landed = (s) => { const c = 2.5 / s.vt + s.rest; for (let t = 0; t < c; t += 0.005) { const L = leafAt(s, 0, t); if (L.falling && L.age > 2.5 / s.vt - 0.02) return L.pos[0] - 1; } return null; };
    expect(landed(lee)).toBeLessThan(landed(open) * 0.6);
  });

  it('it loops on its own, is seeded, and lies still on the ground under a breeze too weak to skitter it', () => {
    const s = scriptOf({ speed: 6, dir: 0 }, { source: { min: [-5, -5, 3], max: [5, 5, 6] } });
    const cycle = (releaseOf(s, 7)[2] - s.floor) / s.vt + s.rest;
    expect(leafAt(s, 7, 3.3).pos.map((x) => +x.toFixed(9))).toEqual(leafAt(s, 7, 3.3 + cycle).pos.map((x) => +x.toFixed(9)));
    // gusts follow the world's time, so a gusty lap differs from the last; the same wind at the same time is the same
    const g = () => scriptOf({ speed: 6, dir: 0, gust: 0.3, seed: 2 }, { source: { min: [-5, -5, 3], max: [5, 5, 6] } });
    expect(leafAt(g(), 7, 3.3)).toEqual(leafAt(g(), 7, 3.3));
    expect(s.skitter).toBeCloseTo(Math.sqrt(0.5) * s.vt, 12);
    const calm = scriptOf({ speed: 1, dir: 0 }, { source: point([0, 0, 2]) }), c2 = 2 / calm.vt + calm.rest;
    const onGround = []; for (let t = 0; t < c2; t += 0.05) { const L = leafAt(calm, 0, t); if (!L.falling) onGround.push(L.pos[0]); }
    expect(Math.max(...onGround) - Math.min(...onGround)).toBeLessThan(1e-9);
  });

  it('hands the GPU the same formula and its numbers', () => {
    const u = scriptUniforms(scriptOf({ speed: 8, dir: 0 }, { source: point([0, 0, 5]) }));
    expect(GLSL).toContain('vec4 windScript(float i, float t)');
    for (const k of ['uU10', 'uAlpha', 'uVt', 'uSkitter', 'uWakes', 'uPhases']) { expect(GLSL).toContain(k); expect(u[k]).toBeDefined(); }
  });
});
