/**
 * Deterministic codification of the 3D light-diffusion physics. No RNG (rays are
 * Fibonacci-sampled), so these assertions pin the behaviour exactly: occlusion,
 * the downward-cone-darkens-above rule, bounce, and the cosine term.
 */

import { describe, it, expect } from 'vitest';
import { bakeDiffusion3d, bakeDiffusionField, applyDiffusionSoft } from './light-diffusion-3d.js';

const sum = (e) => e[0] + e[1] + e[2];
const quad = (z, h = 2) => ({ corners: [[-h, -h, z], [h, -h, z], [h, h, z], [-h, h, z]] });

describe('light-diffusion-3d physics', () => {
  it('OCCLUSION — a blocker between source and floor cuts the floor energy to ~0', () => {
    const floor = quad(0);
    const blocker = quad(1.5, 1.5);
    const src = { pos: [0, 0, 3], dir: [0, 0, -1], spread: 25, rays: 200, bounces: 0, color: [1, 1, 1], intensity: 1 };
    const open = bakeDiffusion3d({ faces: [floor], sources: [src] });
    const blocked = bakeDiffusion3d({ faces: [floor, blocker], sources: [src] });
    expect(sum(open[0])).toBeGreaterThan(0.1);
    expect(sum(blocked[0])).toBeLessThan(sum(open[0]) * 0.05); // floor is shadowed
    expect(sum(blocked[1])).toBeGreaterThan(0.1);              // the blocker caught it instead
  });

  it('DOWNWARD CONE — only surfaces below the lamp get direct light (above is dark)', () => {
    const below = quad(0), above = quad(4);
    const src = { pos: [0, 0, 2], dir: [0, 0, -1], spread: 35, rays: 200, intensity: 1 };
    const direct = bakeDiffusion3d({ faces: [below, above], sources: [{ ...src, bounces: 0 }] });
    expect(sum(direct[0])).toBeGreaterThan(0.1); // below lit
    expect(sum(direct[1])).toBe(0);              // above gets NO direct rays from a down-cone
  });

  it('BOUNCE — light reaches the ceiling above via the floor, but dimmer than direct', () => {
    const below = quad(0), above = quad(4);
    const src = { pos: [0, 0, 2], dir: [0, 0, -1], spread: 35, rays: 200, bounces: 2, intensity: 1 };
    const e = bakeDiffusion3d({ faces: [below, above], sources: [src] });
    expect(sum(e[1])).toBeGreaterThan(0);          // bounce reaches above
    expect(sum(e[1])).toBeLessThan(sum(e[0]));     // but attenuated vs the directly-lit floor
  });

  it('COSINE — a surface facing the lamp out-lights a grazing one', () => {
    const floor = quad(0);                                  // normal up, faces the lamp
    const wall = { corners: [[2, -2, 0], [2, -2, 4], [2, 2, 4], [2, 2, 0]] }; // vertical, grazing
    const src = { pos: [0, 0, 3], dir: [0, 0, -1], spread: 80, rays: 300, bounces: 0, intensity: 1 };
    const e = bakeDiffusion3d({ faces: [floor, wall], sources: [src] });
    expect(sum(e[0])).toBeGreaterThan(sum(e[1]));
  });

  it('TRANSMISSION — a glass pane passes light through (tinted + dimmed); opaque blocks it', () => {
    const floor = quad(0, 2);
    const pane = (transmit) => ({ corners: [[-1, -1, 1.5], [1, -1, 1.5], [1, 1, 1.5], [-1, 1, 1.5]], transmit, glassTint: [0.8, 0.9, 1.0] });
    const src = { pos: [0, 0, 3], dir: [0, 0, -1], spread: 24, rays: 300, bounces: 0, color: [1, 1, 1], intensity: 1 };
    const open = bakeDiffusion3d({ faces: [floor], sources: [src] });
    const opaque = bakeDiffusion3d({ faces: [floor, pane(0)], sources: [src] });
    const glass = bakeDiffusion3d({ faces: [floor, pane(0.8)], sources: [src] });
    expect(sum(opaque[0])).toBeLessThan(0.05);                 // opaque pane shadows the floor
    expect(sum(glass[0])).toBeGreaterThan(0.2);                // glass lets light reach the floor
    expect(sum(glass[0])).toBeLessThan(sum(open[0]));          // but dimmer than no pane (attenuated)
    expect(glass[0][2]).toBeGreaterThan(glass[0][0]);          // tinted cool by the glass (blue > red on white light)
  });

  it('is deterministic — same inputs give byte-identical energy', () => {
    const faces = [quad(0)];
    const src = { pos: [0, 0, 3], dir: [0, 0, -1], spread: 40, rays: 64, bounces: 1, intensity: 1 };
    expect(bakeDiffusion3d({ faces, sources: [src] })).toEqual(bakeDiffusion3d({ faces, sources: [src] }));
  });

  it('SOFT field — reports where the light landed (u,v centroid + spread)', () => {
    const floor = quad(0);
    // a centred down-cone lands a pool at the floor centre (u,v ≈ 0.5)
    const e = bakeDiffusionField({ faces: [floor], sources: [{ pos: [0, 0, 3], dir: [0, 0, -1], spread: 30, rays: 300, bounces: 0, intensity: 1 }] });
    expect(e[0].uv).not.toBeNull();
    expect(e[0].uv[0]).toBeCloseTo(0.5, 1);
    expect(e[0].uv[1]).toBeCloseTo(0.5, 1);
    expect(e[0].spread).toBeGreaterThan(0);
    // an offset source shifts the pool centre off-centre
    const off = bakeDiffusionField({ faces: [floor], sources: [{ pos: [1.4, 0, 1], dir: [0, 0, -1], spread: 30, rays: 300, bounces: 0, intensity: 1 }] });
    expect(off[0].uv[0]).toBeGreaterThan(e[0].uv[0]); // pool moved toward +x
  });

  it('SOFT render — paints a translucent radial-gradient pool into bg, not a flat fill', () => {
    const floor = { ...quad(0), fill: '#403018' };
    const field = bakeDiffusionField({ faces: [floor], sources: [{ pos: [0, 0, 3], dir: [0, 0, -1], spread: 40, rays: 200, color: [1, 0.8, 0.5], intensity: 1.5 }] });
    const [lit] = applyDiffusionSoft([floor], field, { gain: 2.6 });
    expect(lit.bg).toContain('radial-gradient');
    expect(lit.bg).toContain(floor.fill);     // base fill is the bottom layer
    expect(lit.fill).toBe(floor.fill);        // fill untouched (gradient rides on top)
  });

  it('SHADOW (inverse) — an elevated occluder darkens the floor where it blocked light', () => {
    const floor = quad(0, 3);
    const box = { corners: [[-0.5, -0.5, 1.5], [0.5, -0.5, 1.5], [0.5, 0.5, 1.5], [-0.5, 0.5, 1.5]] }; // slab above the floor
    const src = { pos: [0, 0, 3], dir: [0, 0, -1], spread: 30, rays: 400, bounces: 0, intensity: 1 };
    const withShadow = bakeDiffusionField({ faces: [floor, box], sources: [src], shadows: true });
    expect(withShadow[0].shadow.s).toBeGreaterThan(0.05); // floor caught the box's shadow
    expect(withShadow[0].shadow.uv).not.toBeNull();
    // opt-in: no flag → no shadow field computed
    expect(bakeDiffusionField({ faces: [floor, box], sources: [src] })[0].shadow.s).toBe(0);
  });

  it('SHADOW render — a dark pool rides ON TOP so it darkens even a lit face', () => {
    const floor = { corners: [[-3, -3, 0], [3, -3, 0], [3, 3, 0], [-3, 3, 0]], fill: '#403018' };
    const box = { corners: [[-0.5, -0.5, 1.5], [0.5, -0.5, 1.5], [0.5, 0.5, 1.5], [-0.5, 0.5, 1.5]] };
    const field = bakeDiffusionField({ faces: [floor, box], sources: [{ pos: [0, 0, 3], dir: [0, 0, -1], spread: 30, rays: 300, intensity: 1.5 }], shadows: true });
    const [lit] = applyDiffusionSoft([floor, box], field, { gain: 2.6, shadowStrength: 1.2 });
    expect(lit.bg).toContain('rgba(10,8,6');                          // the dark shadow pool is present
    expect(lit.bg.indexOf('rgba(10,8,6')).toBeLessThan(lit.bg.lastIndexOf('radial-gradient')); // listed first = on top
  });
});
