// A mount's laws (mount.js): the pilot on foot gets on a horse in reach with interact (walking to its near side, the two
// playing `mount` together), then the horse is the pilot: the stick rides it up through its gaits by speed, its legs
// keeping time with the ground, it turns wider the faster it goes, jumps at a trot or faster, and comes back to a halt;
// interact at a walk sets the rider down beside it, the pilot again; emitted only into a page whose world has a mount.
import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

const E = composeLive();
const DT = 1 / 30;
const GAITS = [
  { clip: 'ride_walk', loose: 'walk', v: 1.6, stride: 1.8 },
  { clip: 'ride_trot', loose: 'trot', v: 3.6, stride: 2.6 },
  { clip: 'ride_canter', loose: 'canter', v: 6, stride: 3.3 },
  { clip: 'ride_gallop', loose: 'gallop', v: 11, stride: 5.2 },
];
const horse = (id, pos, heading = 0) => ({
  id, rule: { type: 'ride', gaits: GAITS, idle: { clip: 'ride_idle', loose: 'idle', s: 4 }, back: { clip: 'ride_back', v: 0.8, stride: 1.2 }, jump: { clip: 'ride_jump', s: 1.6, v: 6, air: [0.3, 0.7], clear: 1.1 } },
  mount: { reach: 2.6, stand: [-0.7, 0.1], facing: -Math.PI / 2, mount: { clip: 'mount', s: 3.4 }, dismount: { clip: 'dismount', s: 2.8 }, camera: { dist: 7, height: 3, lookH: 1.8 } },
  body: { type: 'figure-rig', figure: 'mount:bay' }, transform: { pos, heading },
});
function world(rides = true) {
  return E.createWorld({ entities: [
    { id: 'hero', pilotable: true, rides, rule: { type: 'platform', speed: 5 }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0], heading: 0 } },
    horse('bay', [1.5, 1, 0]), horse('grey', [30, 0, 0]),
    { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'hero', dist: 5.5 } },
  ] });
}
const run = (st, s, input = {}) => { for (let i = 0; i < Math.max(1, Math.round(s / DT)); i++) E.stepWorld(st, input, DT, { ground: () => 0 }); return st; };
const getOn = (st) => { run(st, DT, { interact: 1 }); return run(st, 7); };

describe('a mount', () => {
  it('interact in reach: the rider walks to the near side, both play the mount, then the horse is the pilot', () => {
    const st = world();
    run(st, DT, { interact: 1 });
    expect(st.byId.hero.mountedOn).toBe('bay');
    expect(st.byId.hero.mountPhase).toBe('approach');
    // (on its way, then getting on: the rider and the horse on the same clip at the same share)
    run(st, 2.5);
    const h = st.byId.bay, p = st.byId.hero;
    expect(p.mountPhase).toBe('mount');
    expect(h.locomotion).toBe('mount');
    expect(p.locomotion).toBe('mount');
    expect(p.gaitPhase).toBeCloseTo(h.mountU, 6);
    expect(p.transform.pos).toEqual(h.transform.pos);
    run(st, 3.5);
    expect(p.mountPhase).toBe('ride');
    expect(st.pilotId).toBe('bay');
    expect(st.camera.rule.target).toBe('bay');
    expect(st.camera.rule).toMatchObject({ dist: 7, height: 3, lookH: 1.8 });
    expect(st.mountEvents.map((x) => x.type)).toEqual(['mounting', 'mounted']);
  });

  it('a body whose figure does not ride, or a horse out of reach, is never got on', () => {
    expect(run(world(false), DT, { interact: 1 }).byId.hero.mountedOn).toBeFalsy();
    const st = world(); st.byId.bay.transform.pos = [10, 0, 0];
    expect(run(st, DT, { interact: 1 }).byId.hero.mountedOn).toBeFalsy();
  });

  it('the stick rides it up through the gaits by speed, the rider on the same clip and phase, and back to a halt', () => {
    const st = getOn(world()), h = st.byId.bay, p = st.byId.hero, seen = [];
    for (let i = 0; i < 180; i++) { run(st, DT, { forward: 1 }); if (seen[seen.length - 1] !== h.locomotion) seen.push(h.locomotion); }
    expect(seen).toEqual(['ride_walk', 'ride_trot', 'ride_canter', 'ride_gallop']);
    expect(h.speed).toBeCloseTo(11, 6);
    expect(p.locomotion).toBe('ride_gallop');
    expect(p.gaitPhase).toBe(h.gaitPhase);
    expect(p.transform.pos).toEqual(h.transform.pos);
    run(st, 6);
    expect(h.speed).toBe(0);
    expect(h.locomotion).toBe('ride_idle');
  });

  it('its legs keep time with the ground: a stride a cycle', () => {
    const st = getOn(world()), h = st.byId.bay;
    run(st, 0.5, { forward: 0.4 });   // (a walk)
    const x0 = h.transform.pos[0], f0 = h.gaitPhase;
    for (let i = 0; i < 30; i++) { run(st, DT, { forward: h.speed < 1.6 ? 0.2 : 0 }); }
    expect(h.locomotion).toBe('ride_walk');
    expect(h.gaitPhase - f0).toBeGreaterThan(0);
    expect((h.transform.pos[0] - x0) / (h.gaitPhase - f0)).toBeCloseTo(GAITS[0].stride, 6);
  });

  it('the turn is wider the faster it goes', () => {
    const turnAt = (fwdS) => { const st = getOn(world()); run(st, fwdS, { forward: 1 }); const h0 = st.byId.bay.transform.heading; run(st, 0.5, { forward: 1, turn: 1 }); return Math.abs(st.byId.bay.transform.heading - h0); };
    expect(turnAt(0.4)).toBeGreaterThan(turnAt(4) * 1.4);
  });

  it('jumps at a trot or faster, not at a walk; in the air it clears a low wall a halted horse cannot pass', () => {
    const st = getOn(world()), h = st.byId.bay;
    run(st, 0.3, { forward: 1 }); run(st, DT, { forward: 1, jump: 1 });
    expect(h.jumpT).toBeNull();
    run(st, 1.5, { forward: 1 }); run(st, DT, { forward: 1, jump: 1 });
    expect(h.locomotion).toBe('ride_jump');
    run(st, 0.7);
    expect(h.airborne).toBe(true);
    expect(st.byId.hero.locomotion).toBe('ride_jump');
    run(st, 1.3);
    expect(h.jumpT).toBeNull();
    expect(h.locomotion).not.toBe('ride_jump');
    // a wall 0.9 m high across the way: ridden at it, the horse stops; jumped, it is over
    const at = (jump) => {
      const w = getOn(world()), b = w.byId.bay, x0 = b.transform.pos[0];
      w.colliders = E.normalizeColliders([{ min: [x0 + 9, -20, 0], max: [x0 + 9.3, 20, 0.9] }]);
      run(w, 1.2, { forward: 1 });
      if (jump) { while (b.transform.pos[0] < x0 + 5) run(w, DT, { forward: 1 }); run(w, DT, { forward: 1, jump: 1 }); }
      run(w, 3, { forward: 1 });
      return b.transform.pos[0] - (x0 + 9.3);
    };
    expect(at(false)).toBeLessThan(0);
    expect(at(true)).toBeGreaterThan(0);
  });

  it('interact at a walk sets the rider down beside the horse, its own rule back, the pilot again', () => {
    const st = getOn(world()), h = st.byId.bay, p = st.byId.hero;
    run(st, 3, { forward: 1 });
    run(st, DT, { interact: 1 });
    expect(p.mountPhase).toBe('ride');                // (not at a canter)
    run(st, 6);
    run(st, DT, { interact: 1 });
    expect(p.mountPhase).toBe('dismount');
    expect(h.locomotion).toBe('dismount');
    run(st, 3);
    expect(p.mountedOn).toBeNull();
    expect(p.rule.type).toBe('platform');
    expect(st.pilotId).toBe('hero');
    expect(st.camera.rule.target).toBe('hero');
    expect(st.camera.rule.dist).toBe(5.5);
    expect(st.camera.rule.height).toBeUndefined();
    expect(h.riderId).toBeNull();
    // (where the clip leaves it: the horse's near side, facing it)
    const a = h.transform.heading - Math.PI / 2;
    expect(p.transform.pos[0]).toBeCloseTo(h.transform.pos[0] + -0.7 * Math.cos(a) - 0.1 * Math.sin(a), 6);
    // and the horse unridden stands at ease, its loose clips
    run(st, 0.5);
    expect(h.locomotion).toBe('idle');
    expect(st.mountEvents.map((x) => x.type)).toEqual(['mounting', 'mounted', 'dismounted']);
  });

  it('unridden it ignores the stick; the walker drives itself', () => {
    const st = world(), x0 = st.byId.bay.transform.pos.slice();
    run(st, 1, { forward: 1 });
    expect(st.byId.bay.transform.pos).toEqual(x0);
    expect(st.byId.bay.locomotion).toBe('idle');
  });

  it('is deterministic: the same inputs, the same world', () => {
    const go = () => { const st = getOn(world()); run(st, 2, { forward: 1, turn: 0.4 }); run(st, DT, { forward: 1, jump: 1 }); run(st, 2, { forward: 1 }); return JSON.stringify(st.byId.bay.transform) + JSON.stringify(st.byId.hero.transform); };
    expect(go()).toBe(go());
  });

  it('is emitted only into a page that asks', () => {
    expect(emissionSource()).not.toContain('stepWithMounts');
    expect(emissionSource({ mount: true })).toContain('stepWithMounts');
  });
});
