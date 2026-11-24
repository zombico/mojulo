// THE VIEW FROM BEHIND A VEHICLE (cab-pool.js cabView, gameworld/cars.js, mount.js `pullIn`): a cab's chase framed
// by its size, so a big vehicle never hides the road it is driven down, and pulled in front of a wall that stands
// behind it (mount.js: only while something is ridden). One case per concept: a car as it was; a truck back and up, its eye line over its roof to the road ahead;
// the parked cab framed by its own model; the chase pulled in, and as it was without the word.
import { describe, it, expect } from 'vitest';
import { cabView, CAB_VIEW } from './cab-pool.js';
import { CAB, carsExtra } from '../../gameworld/cars.js';
import { carModel } from '../../geotown/cars.js';
import { composeLive } from '../../worlds/controllable/compose.js';

// where the eye's line over the roof's back edge, from the camera behind the vehicle's middle, meets the road ahead of
// its middle (m)
const reach = (V, L, H) => { const behind = V.dist - L / 2, rise = V.height - H; return rise > 0 ? -L / 2 + (H * behind) / rise : Infinity; };

describe('the view from behind a vehicle', () => {
  it('a car keeps the chase it had; a truck is seen from further back and higher, over its roof to the road ahead', () => {
    const car = carModel('familySedan'), truck = carModel('loft:straightBox');
    expect(cabView({ length: car.L, height: car.H }, CAB.camera, CAB_VIEW)).toEqual(CAB.camera);
    const T = cabView({ length: truck.L, height: truck.H }, CAB.camera, CAB_VIEW);
    expect(T.dist).toBeGreaterThan(CAB.camera.dist);
    expect(T.height).toBeGreaterThan(CAB.camera.height);
    expect(T.lookH).toBeGreaterThan(CAB.camera.lookH);
    // (its rear back off the lens, and the road seen `see` metres past its bumper over its roof, `clear` above it)
    expect(T.dist - truck.L / 2).toBeGreaterThanOrEqual(CAB_VIEW.back + truck.L / 2 - 1e-6);
    expect(reach({ dist: T.dist, height: T.height }, truck.L, truck.H + CAB_VIEW.clear)).toBeLessThanOrEqual(truck.L / 2 + CAB_VIEW.see + 0.05);   // (its numbers kept to the millimetre)
  });

  it('a level\'s parked cab is framed by its own model', () => {
    const ends = { spawn: [0, 0, 0], parked: [{ at: [5, 0, 0], heading: 0, model: 'familySedan', paint: '#2a3f6a' }, { at: [9, 0, 0], heading: 0, model: 'loft:straightBox', paint: '#d8d6d0' }] };
    const [sedan, truck] = carsExtra()(ends).entities.filter((e) => !e.mount.spare);
    expect(sedan.mount.camera).toEqual({ ...CAB.camera, pullIn: CAB.pullIn });
    expect(truck.mount.camera.dist).toBeGreaterThan(sedan.mount.camera.dist);
    expect(truck.mount.camera.height).toBeGreaterThan(sedan.mount.camera.height);
  });

  it('a ridden cab\'s chase with `pullIn` stands in front of a wall behind it; without it, where it would', () => {
    const E = composeLive(), hooks = { ground: () => 0 };
    // (a cab at the origin facing +x, ridden, a wall 5 m behind it; its chase wants 12 m back)
    const world = (camera) => {
      const w = E.createWorld({ colliders: [{ min: [-5.4, -20, 0], max: [-5, 20, 30] }], camera: { rule: 'follow', target: 'car', dist: 12, height: 3, lookH: 1, ...camera },
        entities: [
          { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0 }, body: { type: 'mesh' }, transform: { pos: [0, 3, 0], heading: 0 } },
          { id: 'car', rule: { type: 'platform', speed: 0, eye: 0 }, mount: { cab: true, hull: [0.95, 2.3], stand: [-1.45, 0.25], mount: { s: 0.35 }, dismount: { s: 0.35 } }, body: { type: 'mesh' }, transform: { pos: [0, 0, 0], heading: 0 } },
        ] });
      w.pilotId = 'car'; w.byId.car.riderId = 'p'; w.byId.p.gone = true;
      return w;
    };
    const run = (w) => { for (let k = 0; k < 240; k++) E.stepWorld(w, {}, 1 / 60, hooks); return w.camera.transform.pos; };
    const pulled = run(world({ pullIn: 0.6 })), plain = run(world({}));
    expect(pulled[0]).toBeGreaterThan(-5);
    expect(plain[0]).toBeLessThan(-5.4);
  });
});
