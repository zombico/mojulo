import { describe, expect, it } from 'vitest';
import { buildVeil } from './veil.js';
import { composeLive, emissionSource } from './compose.js';

// TALL GRASS AS A VEIL (veil.js): a line of sight is lost after running `through` metres of grass under its top, so a
// body crouched or lying in a patch, or low behind one, is unseen; standing, its eye is over the grass; within `near` it
// is seen; from a tower the line runs under the top for less of its length.

const V = {}; buildVeil(V);
const PATCH = { at: [10, 0, 0], r: 3, h: 1.2 };
const GUARD_EYE = [0, 0, 1.35];
const CROUCH = 0.825, PRONE = 0.34, STAND = 1.275;

describe('a line through tall grass', () => {
  it('a body crouched or lying a stride into a patch is lost; standing, or at its edge, it is seen', () => {
    expect(V.veilBlocked(GUARD_EYE, [10, 0, CROUCH], [PATCH])).toBe(true);
    expect(V.veilBlocked(GUARD_EYE, [10, 0, PRONE], [PATCH])).toBe(true);
    expect(V.veilBlocked(GUARD_EYE, [10, 0, STAND], [PATCH])).toBe(false);   // (its eye over the grass)
    expect(V.veilBlocked(GUARD_EYE, [7.5, 0, CROUCH], [PATCH])).toBe(false); // (half a metre in: the grass is thin there)
  });

  it('low behind a patch is hidden too; a body beside it is not', () => {
    expect(V.veilBlocked(GUARD_EYE, [14, 0, CROUCH], [PATCH])).toBe(true);
    expect(V.veilBlocked(GUARD_EYE, [14, 5, CROUCH], [PATCH])).toBe(false);
  });

  it('within its near reach a watcher sees a body in the grass whatever', () => {
    expect(V.veilBlocked([8.5, 0, 1.35], [10, 0, PRONE], [PATCH])).toBe(false);
  });

  it('from a tower the line comes down into the grass: a crouch is seen, a body lying flat is not', () => {
    const tower = [0, 0, 5.35];
    expect(V.veilBlocked(tower, [10, 0, CROUCH], [PATCH])).toBe(false);
    expect(V.veilBlocked(tower, [10.5, 0, PRONE], [PATCH])).toBe(true);
  });

  it('the metres measured are the line\'s under the top inside the circle', () => {
    // (a level line under the top straight through the middle: the diameter)
    expect(V.veilThrough([0, 0, 0.5], [20, 0, 0.5], [PATCH])).toBeCloseTo(6, 6);
    expect(V.veilThrough([0, 0, 2], [20, 0, 2], [PATCH])).toBe(0);
    expect(V.veilThrough([0, 0, 0.5], [20, 0, 0.5], [])).toBe(0);
  });
});

describe('a world with veils', () => {
  const E = composeLive();
  const hooks = { ground: () => 0 };
  const world = (veils) => E.createWorld({
    ...(veils ? { veils } : {}),
    entities: [
      { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, collideHeight: 1.1 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [10, 0, 0], heading: Math.PI } },
      { id: 'g', team: 'guards', rule: { type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, speed: 0, sightRange: 20, sightCone: 0.6, eye: 0, collideHeight: 1.8, guardRadius: 0.1 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } },
    ],
  });
  const look = (w) => { for (let k = 0; k < 30; k++) E.stepWorld(w, {}, 1 / 60, hooks); return !!w.byId.g.lastSeen; };

  it('a watcher does not see a crouched body in the grass; without the grass it does', () => {
    expect(look(world([PATCH]))).toBe(false);
    expect(look(world(null))).toBe(true);
  });

  it('is emitted only into a world that has veils', () => {
    expect(emissionSource({})).not.toContain('function veilThrough');
    expect(emissionSource({ veil: true })).toContain('function veilThrough');
  });
});

describe('a crawl space', () => {
  // (a truck's belly: 2 m by 7 m, its chassis 0.6 m up; a guard's eye 1.35 m up, 6 m off its side)
  const U = { under: true, min: [-1, -3.5, 0], max: [1, 3.5, 0.6] }, EYE = [6, 0, 1.35];
  it('a body lying under it is hidden from an eye over its ceiling outside it, beyond its near reach', () => {
    expect(V.veilBlocked(EYE, [0, 0, PRONE], [U])).toBe(true);
    expect(V.veilBlocked([2.2, 0, 1.35], [0.9, 0, PRONE], [U])).toBe(false);   // (beside it, within reach)
    expect(V.veilBlocked([6, 0, 0.3], [0, 0, PRONE], [U])).toBe(false);       // (an eye under the ceiling: lying, it looks under)
    expect(V.veilBlocked(EYE, [0, 0, 1.275], [U])).toBe(false);               // (an eye over the ceiling: not under it)
    expect(V.veilBlocked(EYE, [0, 5, PRONE], [U])).toBe(false);               // (beside the truck, not under)
    expect(V.veilThrough(EYE, [0, 0, PRONE], [U])).toBe(0);                   // (it is not grass: no metres through)
  });
  it('a world takes it with its grass', () => {
    const E = composeLive(), w = E.createWorld({ veils: [PATCH, U, { under: true, min: [0, 0] }], entities: [] });
    expect(w.veils).toHaveLength(2); expect(w.veils[1]).toEqual(U);
  });
});

