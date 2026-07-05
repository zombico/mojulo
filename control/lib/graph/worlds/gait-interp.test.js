import { describe, expect, it } from 'vitest';

import { gaitFramePair, advanceGaitMix } from './controllable-world.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// renderer-ladder.plan.md Phase 2 rung 1 — the pure delivery math for smooth figure-frames
// playback: frame-pair interpolation within a clip + crossfade bookkeeping between modes.

describe('gaitFramePair — continuous phase → bracketing frame pair', () => {
  it('brackets an interior phase with its lerp weight', () => {
    expect(gaitFramePair(8, 0.3)).toEqual({ i0: 2, i1: 3, t: expect.closeTo(0.4, 10) });
  });

  it('wraps the last frame back to the first (a cycle, not a clamp)', () => {
    const p = gaitFramePair(8, 0.99);
    expect(p.i0).toBe(7);
    expect(p.i1).toBe(0);
    expect(p.t).toBeCloseTo(0.92, 10);
  });

  it('wraps negative phases (strafe-left runs the clip backwards)', () => {
    expect(gaitFramePair(8, -0.25)).toEqual(gaitFramePair(8, 0.75));
    expect(gaitFramePair(8, -1.25)).toEqual(gaitFramePair(8, 0.75));
  });

  it('phase 0 and integer phases land exactly on frame 0', () => {
    expect(gaitFramePair(8, 0)).toEqual({ i0: 0, i1: 1, t: 0 });
    expect(gaitFramePair(8, 3)).toEqual({ i0: 0, i1: 1, t: 0 });
  });

  it('degenerates safely for single-frame and empty clips', () => {
    expect(gaitFramePair(1, 0.6)).toEqual({ i0: 0, i1: 0, t: 0 });
    expect(gaitFramePair(0, 0.6)).toEqual({ i0: 0, i1: 0, t: 0 });
  });
});

describe('advanceGaitMix — crossfade between locomotion modes', () => {
  it('locks in the first mode with full weight, no fade', () => {
    const mix = advanceGaitMix({}, 'forward', 0.1, 1 / 60);
    expect(mix).toMatchObject({ mode: 'forward', w: 1, prevMode: null });
  });

  it('starts a fade on a mode switch, freezing the outgoing phase', () => {
    const mix = advanceGaitMix({}, 'forward', 0.4, 1 / 60);
    advanceGaitMix(mix, 'strafe', 0.45, 1 / 60);
    expect(mix.mode).toBe('strafe');
    expect(mix.prevMode).toBe('forward');
    expect(mix.prevPhase).toBe(0.4);   // frozen at the switch
    expect(mix.w).toBeGreaterThan(0);
    expect(mix.w).toBeLessThan(1);
  });

  it('completes the fade after blendTime and clears prevMode', () => {
    const mix = advanceGaitMix({}, 'forward', 0, 1 / 60);
    advanceGaitMix(mix, 'idle', 0, 1 / 60, 0.1);
    for (let i = 0; i < 12; i++) advanceGaitMix(mix, 'idle', 0, 1 / 60, 0.1);
    expect(mix.w).toBe(1);
    expect(mix.prevMode).toBeNull();
  });

  it('is deterministic under fixed-step advancement', () => {
    const run = () => {
      const mix = advanceGaitMix({}, 'forward', 0, 1 / 60);
      const trace = [];
      const modes = ['forward', 'forward', 'strafe', 'strafe', 'strafe', 'idle', 'idle', 'forward'];
      for (let i = 0; i < modes.length; i++) { advanceGaitMix(mix, modes[i], i * 0.07, 1 / 60); trace.push({ ...mix }); }
      return trace;
    };
    expect(run()).toEqual(run());
  });
});

describe('emitThreeWorld — interpolated figure delivery', () => {
  const world = () => emitThreeWorld({
    faces: [{ corners: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], fill: '#333' }],
    entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'figure-frames', figure: 'male' } }],
    figures: { male: { clips: { forward: { pos: [''], col: [''], origin: [0, 0, 0], invScale: 1, foot: [0, 0, 0] } } } },
  });

  it('ships the frame-pair lerp + crossfade runtime, not geometry snapping', () => {
    const html = world();
    expect(html).toContain('gaitFramePair');       // model math emitted via buildControllable
    expect(html).toContain('advanceGaitMix');
    expect(html).toContain('__figAccum');          // renderer accumulates weighted poses
    expect(html).not.toContain('fig.mesh.geometry = clip[frame]');   // the old snap is gone
  });
});
