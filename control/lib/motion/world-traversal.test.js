import { describe, expect, it } from 'vitest';

import { renderWorldTraversalMotion } from './world-motion.js';
import { renderWorldTraversal } from './world-frames.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

// renderer-ladder P3 — traversals: an input script replayed through the world's live channels.

const sketch = (manifest) => ({ manifest, title: 'traversal test', ref: 'sk_test' });

const PLATFORM_WORLD = {
  kind: 'controllable',
  entities: [{ id: 'hero', rule: { type: 'platform', speed: 4, eye: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] }, transform: { pos: [0, 0, 0.1], heading: 0 } }],
  worldFraming: { cameraPosition: [10, -10, 6], lookAt: [0, 0, 1], horizontalFov: 55 },
};

describe('renderWorldTraversalMotion — validation (node only)', () => {
  it('requires a non-empty ticks script', async () => {
    await expect(renderWorldTraversalMotion({ sketch: sketch(PLATFORM_WORLD), ticks: [] }))
      .rejects.toThrow(/ticks/);
  });

  it('rejects kinds with no World form', async () => {
    await expect(renderWorldTraversalMotion({ sketch: sketch({ kind: 'no-such-kind' }), ticks: [{}] }))
      .rejects.toThrow(/no traversable/);
  });
});

describe('renderWorldTraversal — determinism audit (headless)', () => {
  it('same ticks twice → byte-identical probe streams, and the run actually moves', async () => {
    const { payload } = await resolveWorldScene(sketch(PLATFORM_WORLD));
    const html = emitThreeWorld({ ...payload, inline: true, glow: false, capture: true });
    // forward run with a HELD jump mid-run — exercises gait phase, gravity (variable jump
    // height: jumpHeld sustains the ascent), and ground-snap on landing
    const ticks = Array.from({ length: 36 }, (_, k) => ({
      forward: k < 30 ? 1 : 0,
      jump: k === 12 ? 1 : 0,
      jumpHeld: k >= 12 && k < 20 ? 1 : 0,
    }));

    const run = () => renderWorldTraversal(html, ticks, { fps: 24, frames: false });
    const [a, b] = [await run(), await run()];

    expect(JSON.stringify(a.probes)).toBe(JSON.stringify(b.probes));   // deterministic replay

    const first = a.probes[0].entities.hero;
    const last = a.probes[a.probes.length - 1].entities.hero;
    expect(last.pos[0]).toBeGreaterThan(first.pos[0] + 2);   // it walked +x
    const peakZ = Math.max(...a.probes.map((p) => p.entities.hero.pos[2]));
    expect(peakZ).toBeGreaterThan(0.5);                      // the jump left the ground
    expect(Math.abs(last.pos[2] - 0.1)).toBeLessThan(0.2);   // and landed again
  }, 300000);
});

describe('compileWorldWaypoints — waypoint compiler (renderer-convergence step 3, headless)', () => {
  it('compiles a route into ticks, deterministically, and the replay reaches the target', async () => {
    const { payload } = await resolveWorldScene(sketch(PLATFORM_WORLD));
    const html = emitThreeWorld({ ...payload, inline: true, glow: false, capture: true });
    const { compileWorldWaypoints } = await import('./world-frames.js');

    const route = [[6, 0], [6, 4]];
    const a = await compileWorldWaypoints(html, route, { fps: 24 });
    expect(a.arrived).toBe(true);
    expect(a.legs.length).toBe(2);
    expect(a.ticks.length).toBeGreaterThan(10);

    // determinism: compiling the same route on a fresh load yields the identical script
    const b = await compileWorldWaypoints(html, route, { fps: 24 });
    expect(JSON.stringify(a.ticks)).toBe(JSON.stringify(b.ticks));

    // the compiled ticks ARE a Phase-3 recipe: replaying them reaches the target
    const run = await renderWorldTraversal(html, a.ticks, { fps: 24, frames: false });
    const last = run.probes[run.probes.length - 1].entities.hero;
    expect(Math.hypot(last.pos[0] - 6, last.pos[1] - 4)).toBeLessThan(0.8);
  }, 600000);

  it('reports an unreachable target as stuck instead of looping (the walkability audit failure shape)', async () => {
    // the target sits past the floor's edge: the hero walks off at x=2 and falls — no stable
    // footing at the target, so the leg must report stuck, never "arrived" mid-air. (The
    // entity rules have no lateral wall collision — ground raycasts only — so a VOID, not a
    // wall, is what "unreachable" means at this substrate tier.)
    const gapped = {
      ...PLATFORM_WORLD,
      faces: [{ corners: [[-10, -10, 0], [2, -10, 0], [2, 10, 0], [-10, 10, 0]], fill: '#1b2230', doubleSided: true }],
    };
    const { payload } = await resolveWorldScene(sketch(gapped));
    const html = emitThreeWorld({ ...payload, inline: true, glow: false, capture: true });
    const { compileWorldWaypoints } = await import('./world-frames.js');
    const out = await compileWorldWaypoints(html, [[8, 0]], { fps: 24 });
    expect(out.arrived).toBe(false);
    expect(out.legs[0].stuck).toBe(true);
    expect(out.legs[0].at[2]).toBeLessThan(0);     // it fell — the probe shows WHERE the route died
  }, 600000);
});
