import { describe, expect, it } from 'vitest';

import { buildControllable, createWorld, stepWorld, normalizeEntity, assembleControllableScene } from './controllable-world.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// run a fixed input for N steps at fixed dt.
const run = (state, input, steps, dt = 1 / 60, hooks) => { for (let i = 0; i < steps; i++) stepWorld(state, input, dt, hooks); return state; };

describe('createWorld', () => {
  it('normalizes entities and indexes them by id', () => {
    const w = createWorld({ entities: [{ id: 'a', rule: { type: 'walk' } }, { rule: { type: 'glide' } }] });
    expect(w.entities.length).toBe(2);
    expect(w.byId.a).toBeTruthy();
    expect(w.entities[1].id).toBe('ent-1');   // fallback id
  });

  it('turns the camera sugar into an isCamera entity', () => {
    const w = createWorld({ entities: [{ id: 'hero', rule: { type: 'walk' } }], camera: { rule: 'follow', target: 'hero' } });
    expect(w.camera).toBeTruthy();
    expect(w.camera.isCamera).toBe(true);
    expect(w.camera.rule.type).toBe('follow');
    expect(w.camera.rule.target).toBe('hero');
  });

  it('defaults a missing rule/body to inert types', () => {
    const e = normalizeEntity({}, 0);
    expect(e.rule.type).toBe('static');
    expect(e.body.type).toBe('none');
    expect(e.transform.pos).toEqual([0, 0, 0]);
  });
});

describe('rule: walk (tank)', () => {
  it('W moves forward along heading; gait phase advances with distance', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk', speed: 6 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { forward: 1 }, 60);   // 1 second
    expect(w.byId.h.transform.pos[0]).toBeCloseTo(6, 1);   // heading 0 → +X
    expect(w.byId.h.transform.pos[1]).toBeCloseTo(0, 5);
    expect(Math.abs(w.byId.h.gaitPhase)).toBeGreaterThan(0);
    expect(w.byId.h.moving).toBe(true);
  });

  it('S advances gait phase backward (cycle plays in reverse)', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { forward: -1 }, 30);
    expect(w.byId.h.gaitPhase).toBeLessThan(0);
    expect(w.byId.h.transform.pos[0]).toBeLessThan(0);
  });

  it('A/D turn the heading', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk', turn: 2 }, transform: { heading: 0 } }] });
    run(w, { turn: 1 }, 60);
    expect(w.byId.h.transform.heading).toBeCloseTo(2, 1);   // 2 rad/s · 1s
  });

  it('a ground hook sets the foot height', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk' }, transform: { pos: [0, 0, 99] } }] });
    run(w, { forward: 1 }, 5, 1 / 60, { ground: () => 0 });
    expect(w.byId.h.transform.pos[2]).toBe(0);
  });

  it('standing still does not advance the gait', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk' } }] });
    run(w, {}, 30);
    expect(w.byId.h.gaitPhase).toBe(0);
    expect(w.byId.h.moving).toBe(false);
  });
});

describe('rule: glide (free flight, no gravity)', () => {
  it('accelerates forward, keeps momentum, and does not fall', () => {
    const w = createWorld({ entities: [{ id: 'd', rule: { type: 'glide' }, transform: { pos: [0, 0, 10], heading: 0 } }] });
    run(w, { forward: 1 }, 30);
    expect(w.byId.d.transform.pos[0]).toBeGreaterThan(0);   // moved forward
    expect(w.byId.d.transform.pos[2]).toBeCloseTo(10, 5);   // no gravity → altitude held
    const x1 = w.byId.d.transform.pos[0];
    run(w, {}, 10);   // release input → coasts on momentum, then damps
    expect(w.byId.d.transform.pos[0]).toBeGreaterThan(x1);
  });

  it('lift climbs; look steers heading', () => {
    const w = createWorld({ entities: [{ id: 'd', rule: { type: 'glide' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { lift: 1 }, 20);
    expect(w.byId.d.transform.pos[2]).toBeGreaterThan(0);
    const h0 = w.byId.d.transform.heading;
    run(w, { lookDX: 100 }, 5);
    expect(w.byId.d.transform.heading).not.toBeCloseTo(h0, 3);
  });

  it('respects maxSpeed', () => {
    const w = createWorld({ entities: [{ id: 'd', rule: { type: 'glide', maxSpeed: 5, accel: 100 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { forward: 1 }, 120);
    const v = w.byId.d.vel;
    expect(Math.hypot(v[0], v[1], v[2])).toBeLessThanOrEqual(5 + 1e-6);
  });
});

describe('rule: platform (gravity + jump)', () => {
  const FLAT = { ground: () => 0 };   // a flat floor at z=0 under everything

  it('gravity pulls a spawned-in-air body down and it rests on the surface', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 5] } }] });
    run(w, {}, 120, 1 / 60, FLAT);   // 2s
    expect(w.byId.p.transform.pos[2]).toBeCloseTo(0, 2);   // landed on the floor
    expect(w.byId.p.vel[2]).toBeCloseTo(0, 4);             // vertical velocity zeroed
    expect(w.byId.p.grounded).toBe(true);
  });

  it('a jump leaves the ground and comes back down to it', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, jumpSpeed: 8 }, transform: { pos: [0, 0, 0] } }] });
    stepWorld(w, {}, 1 / 60, FLAT);
    expect(w.byId.p.grounded).toBe(true);
    let maxZ = 0, airborne = false;
    for (let i = 0; i < 120; i++) {
      stepWorld(w, { jump: i === 0 ? 1 : 0, jumpHeld: i < 10 ? 1 : 0 }, 1 / 60, FLAT);
      maxZ = Math.max(maxZ, w.byId.p.transform.pos[2]);
      if (!w.byId.p.grounded) airborne = true;
    }
    expect(maxZ).toBeGreaterThan(0.8);                     // clearly left the ground
    expect(airborne).toBe(true);
    expect(w.byId.p.transform.pos[2]).toBeCloseTo(0, 2);   // and landed again
    expect(w.byId.p.grounded).toBe(true);
  });

  it('variable height: holding jump rises higher than a one-frame tap', () => {
    const hop = (holdFrames) => {
      const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, jumpSpeed: 8, jumpCut: 0 }, transform: { pos: [0, 0, 0] } }] });
      stepWorld(w, {}, 1 / 60, FLAT);
      let maxZ = 0;
      for (let i = 0; i < 120; i++) {
        const held = i === 0 || (i > 0 && i <= holdFrames);
        stepWorld(w, { jump: i === 0 ? 1 : 0, jumpHeld: held ? 1 : 0 }, 1 / 60, FLAT);
        maxZ = Math.max(maxZ, w.byId.p.transform.pos[2]);
      }
      return maxZ;
    };
    expect(hop(60)).toBeGreaterThan(hop(1) + 0.3);
  });

  it('coyote time: a jump just after leaving a ledge still fires', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, coyote: 0.1 } }] });
    stepWorld(w, {}, 1 / 60, FLAT);                        // grounded
    expect(w.byId.p.grounded).toBe(true);
    const PIT = { ground: () => null };                    // walked off into open air
    for (let i = 0; i < 3; i++) stepWorld(w, {}, 1 / 60, PIT);   // ~0.05s airborne (within window)
    stepWorld(w, { jump: 1, jumpHeld: 1 }, 1 / 60, PIT);
    expect(w.byId.p.vel[2]).toBeGreaterThan(0);            // coyote jump launched despite no ground
  });

  it('mouselook (turnMode:look): A/D strafes instead of turning', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6, strafe: 1 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const h0 = w.byId.p.transform.heading;
    run(w, { turn: 1 }, 30, 1 / 60, FLAT);                 // A/D maps to the `turn` axis
    expect(w.byId.p.transform.heading).toBeCloseTo(h0, 6); // heading unchanged — the mouse turns, not A/D
    expect(Math.abs(w.byId.p.transform.pos[1])).toBeGreaterThan(0.5);   // it strafed sideways instead
  });

  it('mouselook: vertical mouse pitches the view (clamped) and does not move you vertically', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', turnMode: 'look', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { lookDY: 50 }, 30, 1 / 60, FLAT);              // sustained look-up
    expect(w.byId.p.transform.pitch).toBeGreaterThan(0.2);            // the view pitched
    expect(w.byId.p.transform.pitch).toBeLessThanOrEqual(Math.PI / 2);   // clamped shy of straight up
    expect(w.byId.p.transform.pos[2]).toBeCloseTo(0, 2);             // looking up did NOT lift you
  });

  it('tank mode: A turns left, D turns right (not inverted)', () => {
    const left = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(left, { turn: -1 }, 20, 1 / 60, FLAT);             // turn = D−A; A held → −1
    expect(left.byId.p.transform.heading).toBeGreaterThan(0);   // A → heading increases → LEFT
    const right = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(right, { turn: 1 }, 20, 1 / 60, FLAT);             // D held → +1
    expect(right.byId.p.transform.heading).toBeLessThan(0);     // D → heading decreases → RIGHT
  });

  it('is deterministic: same inputs → identical trajectory', () => {
    const trace = () => {
      const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 3] } }] });
      const out = [];
      for (let i = 0; i < 90; i++) {
        stepWorld(w, { forward: 1, jump: i === 5 ? 1 : 0, jumpHeld: i >= 5 && i < 15 ? 1 : 0 }, 1 / 60, FLAT);
        out.push(w.byId.p.transform.pos.slice());
      }
      return out;
    };
    expect(trace()).toEqual(trace());
  });
});

describe('rule: clock (autonomous frame playback)', () => {
  it('advances the gait phase by time with no input', () => {
    const w = createWorld({ entities: [{ id: 't', rule: { type: 'clock', rate: 2 } }] });
    run(w, {}, 60);   // 1s at rate 2 → ~2 cycles
    expect(w.byId.t.gaitPhase).toBeCloseTo(2, 1);
    expect(w.byId.t.moving).toBe(true);
  });
});

describe('rule: follow (camera slaved to a target)', () => {
  it('settles behind and above a stationary target', () => {
    const w = createWorld({ entities: [{ id: 'hero', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0 } }], camera: { rule: 'follow', target: 'hero', dist: 6, height: 3, lerp: 20 } });
    run(w, {}, 120);
    const cam = w.camera.transform.pos;
    expect(cam[0]).toBeCloseTo(-6, 0);   // heading 0 → behind is −X
    expect(cam[2]).toBeCloseTo(3, 0);
    expect(w.camera.lookAt).toBeTruthy();
  });

  it('trails a walking target (stays behind it as it moves +X)', () => {
    const w = createWorld({ entities: [{ id: 'hero', rule: { type: 'walk', speed: 4 }, transform: { pos: [0, 0, 0], heading: 0 } }], camera: { rule: 'follow', target: 'hero', dist: 6, lerp: 10 } });
    run(w, { forward: 1 }, 120);
    const hero = w.byId.hero.transform.pos, cam = w.camera.transform.pos;
    expect(hero[0]).toBeGreaterThan(3);
    expect(cam[0]).toBeLessThan(hero[0]);   // camera is behind the hero
    expect(w.camera.lookAt[0]).toBeGreaterThan(hero[0]);   // looks ahead of the hero
  });
});

describe('determinism', () => {
  it('two identical input runs produce byte-identical state', () => {
    const spec = { entities: [{ id: 'h', rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0.3 } }], camera: { rule: 'follow', target: 'h' } };
    const inputs = [{ forward: 1 }, { forward: 1, turn: 0.5 }, { forward: 0.5 }];
    const play = () => { const w = createWorld(spec); for (let k = 0; k < 90; k++) stepWorld(w, inputs[k % inputs.length], 1 / 60); return w; };
    const a = play(), b = play();
    expect(JSON.stringify(a.entities)).toBe(JSON.stringify(b.entities));
  });
});

describe('assembleControllableScene (standalone stage)', () => {
  it('builds a default checker floor + an initial camera when none given', () => {
    const p = assembleControllableScene({});
    expect(p.faces.length).toBeGreaterThan(10);
    expect(p.cameras[0].worldFraming).toBeTruthy();
    expect(p.faces.every((f) => f.corners.length === 4)).toBe(true);
  });

  it('uses caller-supplied faces verbatim', () => {
    const faces = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#abc' }];
    expect(assembleControllableScene({ faces }).faces).toBe(faces);
  });

  it('honors a ground spec size/cell', () => {
    const small = assembleControllableScene({ ground: { size: 8, cell: 4 } }).faces;     // 2x2
    const big = assembleControllableScene({ ground: { size: 40, cell: 4 } }).faces;      // 10x10
    expect(big.faces?.length ?? big.length).toBeGreaterThan(small.length);
  });
});

describe('single source of truth', () => {
  it('buildControllable source is self-contained, runnable JS (browser parity)', () => {
    // eslint-disable-next-line no-new-func
    const cw = new Function(`return (${buildControllable.toString()})();`)();
    const w = cw.createWorld({ entities: [{ id: 'h', rule: { type: 'walk' }, transform: { heading: 0 } }] });
    cw.stepWorld(w, { forward: 1 }, 1 / 60);
    expect(w.byId.h.transform.pos[0]).toBeGreaterThan(0);
  });
});
