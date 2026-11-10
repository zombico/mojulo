import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { playerWorld } from '../playscape/player.js';
import { COMBAT, POSE_LAYERS, sheathedSpec } from './levels.js';

// COMBAT: an action hero's state (rules-platform.js `combat`): a foe near, a lock or a blow puts it in combat, where it
// walks a deliberate guard with its weapon drawn; out of it the weapon is sheathed and the run's legs are set apart
// (the page's pose layers).
const mk = (foeAt) => {
  const m = playerWorld({ hero: { cast: 'female' }, id: 'p', rule: { combat: { ...COMBAT, drawn: 'hero', sheathed: 'hero-sheathed' } } });
  const foe = { id: 'foe-1', team: 'foes', body: { type: 'box', size: [1, 1, 2], hittable: true, hp: 10 }, rule: { type: 'static' }, transform: { pos: foeAt, heading: 0 } };
  const w = createWorld({ entities: [...m.entities, foe], colliders: [] });
  w.byId.p.body.figure = 'hero-sheathed';
  return w;
};
const run = (w, n, input = {}) => { for (let i = 0; i < n; i++) stepWorld(w, input, 1 / 60, { ground: () => 0 }); return w.byId.p; };

describe('an action hero in combat', () => {
  it('draws its weapon when a foe is near and walks a deliberate guard; sheathes it a while after', () => {
    const w = mk([40, 0, 0]), p = run(mk([40, 0, 0]), 30);
    expect(p.combat).toBe(false);
    expect(p.body.figure).toBe('hero-sheathed');
    // (a foe within reach: combat, drawn, the guard at its pace)
    const near = mk([6, 0, 0]), q = run(near, 60, { forward: 1 });
    expect(q.combat).toBe(true);
    expect(q.body.figure).toBe('hero');
    expect(q.locomotion).toBe('guard');
    const x0 = q.transform.pos[0]; run(near, 60, { forward: 1 });
    expect(Math.hypot(q.transform.pos[0] - x0, q.transform.pos[1])).toBeLessThan(COMBAT.speed * 1.05);
    // (the foe down: combat lingers, then lets go)
    near.byId['foe-1'].downed = true;
    run(near, Math.round(COMBAT.linger * 60) + 10);
    expect(q.combat).toBe(false);
    expect(q.body.figure).toBe('hero-sheathed');
    expect(w).toBeTruthy();
  });
});

describe('the layers and the sheathed hero', () => {
  it('lays the run\'s legs apart and the guard over the clip; the sheathed hero carries the blade on its back', () => {
    expect(POSE_LAYERS.run.map((o) => o.pivot)).toEqual(['thighR', 'thighL']);
    expect(POSE_LAYERS.run[0].deg).toBeLessThan(0);
    expect(POSE_LAYERS.combat.find((o) => o.pivot === 'upperArmR').deg).toBeGreaterThan(0);
    const G = { camera: 'orbit', characters: { hero: { adornment: { items: [{ slot: 'right', serves: ['strike'] }] } } } };
    expect(sheathedSpec(G, { gear: { right: { item: 'sword', laws: 2 } }, gesture: 'hold' })).toEqual({ gear: { back: { item: 'sword', laws: 2 } } });
    expect(sheathedSpec({ ...G, camera: 'third-person' }, { gear: { right: { item: 'sword' } } })).toBeNull();
    expect(sheathedSpec(G, { gear: { right: { item: 'bow' } } })).toBeNull();
  });
});
