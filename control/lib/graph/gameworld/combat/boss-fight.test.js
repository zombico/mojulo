import { describe, expect, it } from 'vitest';
import { siegeWalkerBoss, tankPhase, tankSpots } from './boss-fight.js';

// THE BOSS FIGHT (boss-fight.js): the siege walker laid as the runtime's boss on its own frame, and the tank's way of
// being beaten as words any tank takes.

describe('the tank, beaten as every tank is', () => {
  it('its phase is a tank, and words laid over it keep the rest of its gun', () => {
    const P = tankPhase({ speed: 4, gun: { traverse: 10 } });
    expect(P.kind).toBe('tank');
    expect(P.speed).toBe(4);
    expect(P.gun.traverse).toBe(10);
    expect(P.gun.lay).toBeGreaterThan(0);
  });
  it('its engine is reached from behind and feeds the core; a tank must say where its engine is', () => {
    const S = tankSpots({ engine: [-3, 0, 1.5], sights: [2, 0, 2.5], more: [{ id: 'turret-ring', at: { tank: [0, 0, 2] } }] });
    const engine = S.find((s) => s.id === 'engine');
    expect(engine.from).toBe('behind');
    expect(engine.core).toBe(1);
    expect(S.map((s) => s.id)).toEqual(['engine', 'sights', 'turret-ring']);
    expect(() => tankSpots({})).toThrow(/engine/);
  });
});

describe('the siege walker as the boss', () => {
  const W = siegeWalkerBoss({ id: 'siege', at: [10, 0, 0], heading: Math.PI, down: { item: 'siege-down' } });
  it('stands and folds into a tank, its legs broken by mines and its reloaders shot from behind', () => {
    const B = W.boss;
    expect(Object.keys(B.phases)).toEqual(['stand', 'tank']);
    expect(B.phases.stand.then).toBe('tank');
    expect(B.fold).toBeGreaterThan(0);
    const by = Object.fromEntries(B.spots.map((s) => [s.id, s]));
    expect(by.legR.by).toBe('mine');
    expect(by.tailR.from).toBe('behind');
    expect(by.hipR.phases).toEqual(['tank']);
    // (the reloaders behind it, up on its back; the hips low in its tank form, off its sides)
    expect(by.tailR.at.walker[0]).toBeLessThan(0);
    expect(by.tailR.at.walker[2]).toBeGreaterThan(5);
    expect(by.hipR.at.tank[1]).toBeGreaterThan(1);
    expect(by.hipL.at.tank[1]).toBeLessThan(-1);
    expect(by.hipR.at.tank[2]).toBeLessThan(3);
  });
  it('lays a body for each spot a round reaches, and its figure carries its reload, its walk and its fold', () => {
    const ids = W.entities.map((e) => e.id);
    expect(ids[0]).toBe('siege');
    expect(ids).toContain('siege:tailR');
    expect(ids).not.toContain('siege:legR');
    expect(W.entities.find((e) => e.id === 'siege:engine').rule.bossSpot).toEqual({ boss: 'siege', spot: 'engine' });
    expect(Object.keys(W.figures.siege.clips)).toEqual(expect.arrayContaining(['forward', 'tails:reload', 'transform:tank', 'tank:forward']));
    expect(W.boss.weapons.r.at).toHaveLength(3);
    expect(W.boss.weapons.r.atTank[2]).toBeLessThan(W.boss.weapons.r.at[2]);
  });
});
