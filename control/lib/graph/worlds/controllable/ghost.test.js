import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// INVISIBLE MODE (ghost.js): a pilot carrying `ghost`, on, is seen by no mind; every mind's sight is given back after
// each step; off, it is seen as it always was; a page without it carries none of it.

const E = composeLive();
const hooks = { ground: () => 0 };
const ALARM = { confirm: 0.3, radio: 0.5, found: 1, detected: 1, every: 0.5, sweep: 3, from: [30, 0, 0] };
// two guards sharing one rule, both looking +x at the pilot 6 m off
const RULE = { type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, speed: 0, sightRange: 14, sightCone: 0.6, eye: 0, collideHeight: 1.8, guardRadius: 0.1, alarm: ALARM };
const world = (ghost) => E.createWorld({
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, collideHeight: 1.7, ...(ghost !== undefined ? { ghost } : {}) }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [6, 0, 0], heading: Math.PI } },
    { id: 'g', team: 'guards', rule: RULE, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'g2', team: 'guards', rule: RULE, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 1, 0], heading: 0 } },
  ],
});
const run = (w, s) => { for (let k = 0; k < Math.round(s * 60); k++) E.stepWorld(w, {}, 1 / 60, hooks); };

describe('invisible mode', () => {
  it('on, no guard sees the pilot in plain view, and every guard\'s sight is its own again after the step', () => {
    const w = world(true);
    run(w, 2);
    expect(w.byId.g.sightings ?? 0).toBe(0);
    expect(w.byId.g2.lastSeen ?? null).toBeNull();
    expect(w.byId.g.rule.sightRange).toBe(14);
  });

  it('toggled off, the same guard sees it; { on: false } starts seen', () => {
    const w = world({ on: true });
    run(w, 1);
    expect(w.byId.g.sightings ?? 0).toBe(0);
    w.byId.p.rule.ghost = { on: false };
    run(w, 1);
    expect(w.byId.g.sightings).toBeGreaterThan(0);
    const seen = world({ on: false });
    run(seen, 1);
    expect(seen.byId.g.sightings).toBeGreaterThan(0);
  });

  it('a guard on alert keeps its own sight: unseen a while, then toggled seen, it sees the pilot and its calm set is true', () => {
    const w = E.createWorld({
      entities: [
        { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, collideHeight: 1.7, ghost: { on: true } }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [6, 0, 0], heading: Math.PI } },
        { id: 'g', team: 'guards', rule: { ...RULE, alarm: undefined, alert: true }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } },
      ],
    });
    run(w, 1.5);
    expect(w.byId.g.sightings ?? 0).toBe(0);
    w.byId.p.rule.ghost = { on: false };
    run(w, 1);
    expect(w.byId.g.sightings).toBeGreaterThan(0);
    expect(w.byId.g.alertK.calm.sightRange).toBe(14);
  });

  it('a page without it carries none of it', () => {
    expect(emissionSource({})).not.toContain('stepWithGhost');
    expect(emissionSource({ ghost: true })).toContain('stepWithGhost');
  });
});
