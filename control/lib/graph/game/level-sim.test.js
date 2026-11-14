// THE LEVEL SIM (level-sim.js) runs what the page runs beside the bus: the stats kernel (a stat bound to a body reaches
// it, as the page's applyBodies does) and the world's own options the page hands its runtime (the lock). Each absent,
// nothing of it.
import { describe, expect, it } from 'vitest';

import { simLevel } from './level-sim.js';
import { lowerStats } from '../playscape/stats/stats.js';

const hero = () => ({ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 0, speed: 4 }, body: { type: 'none', hittable: true }, transform: { pos: [0, 0, 0], heading: 0 } });
const foe = () => ({ id: 'foe-1', team: 'foes', rule: { type: 'static' }, body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 10 }, transform: { pos: [5, 0, 0], heading: Math.PI } });

describe('the level sim runs what the page runs', () => {
  it('a stat bound to a body reaches it (the hero\'s hp), as the page binds it; without stats the body keeps its own', () => {
    const { vars, stats } = lowerStats({ stats: { holders: ['hero'], stats: [{ id: 'hp', base: 50 }], bodies: { hpMax: 'hp' } } });
    const L = simLevel({ entities: [hero()], events: { vars, stats } });
    L.frame(1 / 30);
    expect(L.world.byId.hero.body.hp).toBe(50);
    const bare = simLevel({ entities: [hero()], events: {} });
    bare.frame(1 / 30);
    expect(bare.world.byId.hero.body.hp).toBeUndefined();
  });

  it('the world\'s own options reach its runtime (the lock), and a sim given none has none', () => {
    const L = simLevel({ entities: [hero(), foe()], events: {}, world: { lock: true } });
    expect(L.world.lock).not.toBeNull();
    L.input.lock = 1; L.frame(1 / 30);
    expect(L.world.lock.target).toBe('foe-1');
    expect(simLevel({ entities: [hero(), foe()], events: {} }).world.lock).toBeNull();
  });
});
