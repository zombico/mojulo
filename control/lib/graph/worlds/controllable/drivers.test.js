// A taken car's driver (drivers.js): a car the traffic gave up (a spare cab) has someone in it, who gets out of the open
// door as the one taking it comes to it. With the taker's gun out: hands up at the door, then running off, the taker in.
// With none: the driver out to fight, the taker not in; the driver down, gone a little later, and the car free. A parked
// car (no spare) has nobody in it; a car is emptied once; a world without drivers keeps no state of them.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

const E = composeLive();
const DT = 1 / 30;
const car = (id, pos, spare = true) => ({
  id, rule: { type: 'drive', horsepower: 140, mass: 1400, wheelbase: 2.7, wheelRadius: 0.33, collideRadius: 1.1, collideHeight: 1.5 },
  mount: { cab: true, ...(spare ? { spare: true } : {}), reach: 3, stand: [-1.3, 0.2], mount: { s: 0.35 }, dismount: { s: 0.35 }, slow: 1.5 },
  body: { type: 'figure-rig', figure: id }, transform: { pos, heading: 0 },
});
// (a fleeing driver asleep; a fighting one asleep, its own melee rule, a pursuer's)
const sleeper = (id, rule) => ({ id, dormant: true, gone: true, hpMax: 30, rule, body: { type: 'figure-rig', figure: 'person', hp: 30, hittable: false }, transform: { pos: [0, 0, 0], heading: 0 } });
const FLEE = sleeper('driver-flee-1', { type: 'ai', speed: 3 });
const FIGHT = sleeper('driver-fight-1', { type: 'ai', speed: 3.2, meleeSeek: true, target: 'hero', loadout: [{ name: 'blow', strike: 'melee', strikeReach: 1.1, strikeDamage: 6, strikeDur: 0.5 }] });
function world({ gun = false, spare = true, drivers = true } = {}) {
  const st = E.createWorld({ entities: [
    { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, body: { type: 'figure-rig', figure: 'hero', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } },
    car('car-1', [2, 1, 0], spare), JSON.parse(JSON.stringify(FLEE)), JSON.parse(JSON.stringify(FIGHT)),
    { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'hero', dist: 5.5 } },
  ], ...(drivers ? { drivers: { flee: ['driver-flee-1'], fight: ['driver-fight-1'] } } : {}) });
  // (the gun drawn: combat-melee.js's own fact, `gunOut`)
  if (gun) st.byId.hero.gunOut = true;
  return st;
}
function run(st, s, input = {}) {
  let prev = E.castFacts(st, undefined).prev; const ev = [];
  for (let i = 0; i < Math.max(1, Math.round(s / DT)); i++) { E.stepWorld(st, typeof input === 'function' ? input(i) : input, DT, { ground: () => 0 }); const f = E.castFacts(st, prev); prev = f.prev; ev.push(...f.events); }
  return ev;
}
const press = (st) => run(st, 2 * DT, (i) => ({ interact: i === 0 ? 1 : 0 }));

describe('a taken car\'s driver', () => {
  it('with the gun out: out of the door with hands up, a moment there, then running off; the taker gets in', () => {
    const st = world({ gun: true }), d = st.byId['driver-flee-1'];
    const ev = press(st);
    expect(d.dormant).toBe(false);
    expect(d.surrender).toBe(true);
    expect(d.drv).toMatchObject({ kind: 'flee', car: 'car-1', phase: 'up' });
    expect(ev.find((e) => e.type === 'driver:flee')).toMatchObject({ car: 'car-1', driver: d.id });
    // (out at the door's side of the car, past the door, away from its middle)
    const C = st.byId['car-1'].transform.pos;
    expect(Math.hypot(d.transform.pos[0] - C[0], d.transform.pos[1] - C[1])).toBeGreaterThan(Math.hypot(1.3, 0.2) + 0.5);
    const at0 = d.transform.pos.slice();
    run(st, 0.9);
    expect(Math.hypot(d.transform.pos[0] - at0[0], d.transform.pos[1] - at0[1])).toBeLessThan(0.01);
    run(st, 1.5);
    expect(d.drv.phase).toBe('run');
    expect(Math.hypot(d.transform.pos[0] - at0[0], d.transform.pos[1] - at0[1])).toBeGreaterThan(3);
    run(st, 7);
    // (the taker in, the driver gone off)
    expect(st.pilotId).toBe('car-1');
    expect(d.gone).toBe(true);
    expect(d.drv).toBe(null);
  });

  it('with no gun out: out to fight, the taker not in; down, it is gone a little later and the car is free', () => {
    const st = world(), d = st.byId['driver-fight-1'], P = st.byId.hero;
    const ev = press(st);
    expect(d.dormant).toBe(false);
    expect(d.drv).toMatchObject({ kind: 'fight', car: 'car-1' });
    expect(P.mountedOn).toBe(null);
    expect(P.rule.type).toBe('platform');
    expect(st.pilotId).toBe('hero');
    expect(ev.find((e) => e.type === 'driver:fight')).toMatchObject({ car: 'car-1' });
    // (knocked down: gone `lie` s on, the bus told once)
    d.body.hp = 0; d.downed = true;
    const ev2 = run(st, 0.5);
    expect(ev2.filter((e) => e.type === 'driver:down')).toHaveLength(1);
    run(st, 4.5);
    expect(d.gone).toBe(true);
    // (the car empty now: taken again, it is got into, nobody out)
    run(st, 0.2);
    press(st); run(st, 3);
    expect(st.pilotId).toBe('car-1');
    expect(st.byId['driver-flee-1'].dormant).toBe(true);
  });

  it('a parked car has nobody in it; a world without drivers keeps no state of them', () => {
    const st = world({ gun: true, spare: false });
    press(st); run(st, 3);
    expect(st.pilotId).toBe('car-1');
    expect(st.byId['driver-flee-1'].dormant).toBe(true);
    const none = world({ drivers: false });
    press(none);
    expect(none.drivers).toBeUndefined();
  });
});

describe('on the page', () => {
  it('runs from its own source (the emitted runtime with drivers in it): a taker with a gun out, a driver out with hands up', async () => {
    const { emissionSource } = await import('./compose.js');
    const W = new Function(`return ${emissionSource({ drivers: true, mount: true })};`)();
    const st = W.createWorld({ entities: [
      { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0], heading: 0 } },
      car('car-1', [2, 1, 0]), JSON.parse(JSON.stringify(FLEE)), JSON.parse(JSON.stringify(FIGHT)),
    ], drivers: { flee: ['driver-flee-1'], fight: ['driver-fight-1'] } });
    st.byId.hero.gunOut = true;
    for (let i = 0; i < 3; i++) W.stepWorld(st, { interact: i === 0 ? 1 : 0 }, DT, { ground: () => 0 });
    expect(st.byId['driver-flee-1']).toMatchObject({ dormant: false, surrender: true });
  });
});
