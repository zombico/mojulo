import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// THE CROUCH (stance.js): down on a press and up on the next; slower, smaller, and not seen over a low wall.

const E = composeLive();
const hooks = { ground: () => 0 };
// the body close behind a wall a metre high (0.6 m from its face); a watcher 3 m beyond it, facing back
const world = ({ stance = { crouch: {} }, wall = true } = {}) => E.createWorld({
  ...(wall ? { colliders: [{ min: [2.8, -4, 0], max: [3.2, 4, 1] }] } : {}),
  camera: { rule: 'follow', target: 'p' },
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7, ...(stance ? { stance } : {}) }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [2.2, 0, 0], heading: Math.PI / 2 } },
    { id: 'g', team: 'guards', rule: { type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, speed: 0, sightRange: 14, sightCone: 0.6, eye: 0, collideHeight: 1.8, guardRadius: 0.1 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [6, 0, 0], heading: Math.PI } },
  ],
});
const run = (w, input, n) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, 1 / 60, hooks); return w.byId.p; };

describe('the crouch', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithStance');
    expect(emissionSource({ stance: true })).toContain('stepWithStance');
  });
  it('a press goes down, the next comes up; down, it is slower and shorter and the page is told', () => {
    const w = world({ wall: false }), p = w.byId.p;
    run(w, { crouch: 1 }, 3); run(w, {}, 2);
    expect(p.crouched).toBe(true);
    expect(p.rule.collideHeight).toBe(1.1);
    expect(p.locomotion).toBe('crouch_idle');
    const y0 = p.transform.pos[1]; run(w, { forward: 1 }, 120);
    expect((p.transform.pos[1] - y0) / 2).toBeLessThan(2.3);
    expect(p.locomotion).toBe('crouch_walk');
    run(w, {}, 30); run(w, { crouch: 1 }, 3); run(w, {}, 2);
    expect(p.crouched).toBe(false);
    expect(p.rule.speed).toBe(5.8);
    expect(p.rule.collideHeight).toBe(1.7);
  });
  it('behind a wall a metre high: standing it is seen, crouched it is not', () => {
    const a = world(); run(a, {}, 60);
    expect(a.byId.g.sightings).toBeGreaterThan(0);
    const b = world(); run(b, { crouch: 1 }, 1); run(b, {}, 90);
    expect(b.byId.g.sightings || 0).toBe(0);
    // (and in the open, crouched, it is seen all the same)
    const c = world({ wall: false }); run(c, { crouch: 1 }, 1); run(c, {}, 60);
    expect(c.byId.g.sightings).toBeGreaterThan(0);
  });
  it('a body without it does nothing on the press', () => {
    const w = world({ stance: null }); run(w, { crouch: 1 }, 3);
    expect(w.byId.p.crouched).toBeFalsy();
    expect(w.byId.p.rule.speed).toBe(5.8);
  });
});
