import { describe, expect, it } from 'vitest';
import { rideVehicle, RIDE } from './ride-machine.js';

// THE RIDDEN MACHINE (ride-machine.js): a transforming walker parked to be ridden: boardable, piloted on its two forms
// (it walks, or rolls on its wheels), its backpack's guns given a fight's numbers (the autocannon automatic, the rockets a
// salvo), its figure carried as words for the world's resolve. One walker (the rover walker); a frame that cannot roll is
// refused by name.

describe('a machine to ride', () => {
  const R = rideVehicle('rover walker', { id: 'ride', at: [1, 2, 0], heading: 1, base: { damage: 25 } });
  it('is parked boardable, in its tank form, on its two forms\' rules, standing still till it is got into', () => {
    const e = R.entity;
    expect(e).toMatchObject({ id: 'ride', pilotable: true, form: 'tank', ambient: { type: 'static' }, board: { form: 'tank', reach: RIDE.reach } });
    expect(Object.keys(e.forms)).toEqual(['walker', 'tank']);
    expect(e.forms.tank.rule.speed).toBeGreaterThan(e.forms.walker.rule.speed);   // (it rolls faster than it walks)
    expect(e.forms.tank.rule.steer).toBeTruthy();                                    // (steered on its wheels)
    expect(e.transform.pos).toEqual([1, 2, 0]);
  });
  it('its guns: the autocannon automatic at its rate, the rockets a salvo, both bursting, scaled to the base round', () => {
    const [cannon, rockets] = R.entity.turret.rounds;
    expect(cannon).toMatchObject({ auto: true, rof: RIDE.cannon.rof, magazine: RIDE.cannon.magazine, damage: RIDE.cannon.dmg * 25 });
    expect(rockets).toMatchObject({ auto: false, magazine: RIDE.rockets.magazine, projectileGravity: 0, damage: RIDE.rockets.dmg * 25 });
    expect(cannon.splashRadius).toBeGreaterThan(0); expect(rockets.splashRadius).toBeGreaterThan(cannon.splashRadius);
    expect(R.entity.weapon).toBe(cannon);
    expect(R.entity.turret.look.view).toBe('chase');
  });
  it('its figure is words the world resolves, never the bodies themselves', () => {
    expect(R.figure).toEqual({ frame: { frame: 'rover walker', stance: 'roll' } });
  });
  it('a frame that does not roll is refused by name', () => {
    expect(() => rideVehicle('all-terrain walker')).toThrow(/walk and roll/);
  });
});
