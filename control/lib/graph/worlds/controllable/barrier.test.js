import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// SEE-THROUGH BARRIERS (barrier.js): glass and mesh hold a body out and let a gaze through; a wall in the same place
// does both; a page without barriers carries none of it.

const E = composeLive();
const hooks = { ground: () => 0 };
const PANE = { min: [3, -4, 0], max: [3.1, 4, 2.4] };
// the body 2 m short of the pane walking toward it; a guard 3 m beyond it, facing back
const world = ({ barriers = null, colliders = null } = {}) => E.createWorld({
  ...(barriers ? { barriers } : {}), ...(colliders ? { colliders } : {}),
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [1, 0, 0], heading: 0 } },
    { id: 'g', team: 'guards', rule: { type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, speed: 0, sightRange: 14, sightCone: 0.6, eye: 0, collideHeight: 1.8, guardRadius: 0.1 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [6, 0, 0], heading: Math.PI } },
  ],
});
const run = (w, input, n) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, 1 / 60, hooks); return w; };

describe('see-through barriers', () => {
  it('glass holds the body out and the guard sees it through the glass', () => {
    const w = run(world({ barriers: [PANE] }), { forward: 1 }, 120);
    expect(w.byId.p.transform.pos[0]).toBeLessThan(PANE.min[0]);
    expect(w.byId.g.sightings).toBeGreaterThan(0);
  });
  it('a wall in the same place holds the body out and hides it', () => {
    const w = run(world({ colliders: [PANE] }), { forward: 1 }, 120);
    expect(w.byId.p.transform.pos[0]).toBeLessThan(PANE.min[0]);
    expect(w.byId.g.sightings ?? 0).toBe(0);
  });
  it('a page without barriers carries none of it', () => {
    expect(emissionSource({})).not.toContain('stepWithBarriers');
    expect(emissionSource({ barrier: true })).toContain('stepWithBarriers');
  });
});
