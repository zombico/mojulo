import { describe, expect, it } from 'vitest';

import { composeControllable, EMISSION } from './compose.js';

// ── TARGET LOCK (target-lock.plan.md P1) — lock.js over the composed engine ──
const cw = composeControllable(EMISSION);
const DT = 1 / 60;
const suit = (id, pos, extra = {}) => ({ id, rule: { type: 'static' }, transform: { pos }, body: { type: 'figure-rig', hittable: true, radius: 1, hp: 100 }, ...extra });
const pilot = (extra = {}) => ({ id: 'me', pilotable: true, ambient: { type: 'clock' }, rule: { type: 'platform', space: true, turnMode: 'look', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, body: { type: 'figure-rig', hittable: true, radius: 1, hp: 100 }, ...extra });
const world = (entities, spec = {}) => cw.createWorld({ entities, lock: true, ...spec });
const step = (w, input = {}, n = 1) => { for (let i = 0; i < n; i++) cw.stepWorld(w, input, DT); return w; };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

describe('acquire', () => {
  it('absent `lock` ⇒ state.lock is null and a press does nothing', () => {
    const w = cw.createWorld({ entities: [pilot(), suit('a', [10, 0, 0])] });
    expect(w.lock).toBeNull();
    step(w, { lock: 1 });
    expect(w.lock).toBeNull();
    expect(w.byId.me.transform.heading).toBe(0);
  });

  it('the press takes the candidate nearest the AIM axis; allies, non-hittables, out-of-cone and out-of-range are skipped', () => {
    const w = world([
      pilot({ team: 'x' }),
      suit('ally', [6, 0.5, 0], { team: 'x' }),          // same team: never
      suit('prop', [7, 0, 0], { body: { type: 'mesh' } }), // not hittable
      suit('behind', [-8, 0, 0]),                          // 180° off the aim: outside the 60° cone
      suit('far', [500, 0, 0]),                            // beyond range 120
      suit('near-axis', [12, 3, 0]),                       // ~14°
      suit('close-off-axis', [4, 3.5, 0]),                 // ~41° — closer, but further off the aim
    ]);
    step(w, { lock: 1 });
    expect(w.lock.target).toBe('near-axis');
    expect(w.lock.pilot).toBe('me');
  });

  it('cycles by angle on the next press and releases when no other candidate is left', () => {
    const w = world([pilot(), suit('a', [10, 1, 0]), suit('b', [10, 4, 0])]);
    step(w, { lock: 1 }); expect(w.lock.target).toBe('a');
    step(w, { lock: 0 }, 5);                                    // the heading is now steering toward a…
    step(w, { lock: 1 }); expect(w.lock.target).toBe('b');      // …but the press cycles to the other candidate
    step(w, { lock: 0 }, 5);
    step(w, { lock: 1 }); expect(w.lock.target).toBe('a');      // wraps
    w.byId.b.gone = true;                                       // b vanishes: a is the only candidate
    step(w, { lock: 0 }); step(w, { lock: 1 });
    expect(w.lock.target).toBeNull();                           // press with nobody else ⇒ release
  });

  it('needs line of sight to acquire unless los:false', () => {
    const colliders = [{ min: [4, -2, -1], max: [6, 2, 5] }];
    const blocked = cw.createWorld({ entities: [pilot(), suit('a', [10, 0, 0])], lock: true, colliders });
    step(blocked, { lock: 1 });
    expect(blocked.lock.target).toBeNull();
    const seen = cw.createWorld({ entities: [pilot(), suit('a', [10, 0, 0])], lock: { los: false }, colliders });
    step(seen, { lock: 1 });
    expect(seen.lock.target).toBe('a');
  });
});

describe('steer + release', () => {
  it('eases heading (shortest arc) and pitch toward the target, then holds; the mouse is zeroed while locked', () => {
    const w = world([pilot(), suit('a', [10, -6, 6])]);   // 40° off the aim (inside the cone), raised
    const wantH = Math.atan2(-6, 10), wantP = Math.atan2(6, Math.hypot(10, 6));
    step(w, { lock: 1 });
    expect(w.lock.target).toBe('a');
    const h1 = w.byId.me.transform.heading;
    expect(h1).toBeLessThan(0); expect(h1).toBeGreaterThan(wantH);          // turned the short way, part-way
    step(w, { lock: 0, lookDX: 400, lookDY: 400 }, 240);                    // 4s of mouse: ignored while locked
    expect(wrap(w.byId.me.transform.heading)).toBeCloseTo(wantH, 3);
    expect(w.byId.me.transform.pitch).toBeCloseTo(wantP, 3);
  });

  it('pitch:false steers heading only', () => {
    const w = cw.createWorld({ entities: [pilot(), suit('a', [10, -6, 6])], lock: { pitch: false } });
    step(w, { lock: 1 }); step(w, {}, 120);
    expect(wrap(w.byId.me.transform.heading)).toBeCloseTo(Math.atan2(-6, 10), 3);
    expect(w.byId.me.transform.pitch).toBe(0);
  });

  it('releases when the target dies / vanishes, leaves the release range, or the pilot swaps', () => {
    const gone = world([pilot(), suit('a', [10, 0, 0])]);
    step(gone, { lock: 1 }); expect(gone.lock.target).toBe('a');
    gone.byId.a.gone = true; step(gone);
    expect(gone.lock.target).toBeNull();

    const far = cw.createWorld({ entities: [pilot(), suit('a', [10, 0, 0])], lock: { range: 20 } });
    step(far, { lock: 1 }); expect(far.lock.target).toBe('a');
    far.byId.a.transform.pos = [24, 0, 0]; step(far);                 // 24 < release 25: still held
    expect(far.lock.target).toBe('a');
    far.byId.a.transform.pos = [26, 0, 0]; step(far);                 // past release ⇒ let go
    expect(far.lock.target).toBeNull();

    const swap = world([pilot(), { ...pilot(), id: 'other', transform: { pos: [0, 5, 0], heading: 0 } }, suit('a', [10, 0, 0])]);
    step(swap, { lock: 1 }); expect(swap.lock.target).toBe('a');
    step(swap, { swap: 1 });
    expect(swap.pilotId).toBe('other');
    expect(swap.lock.target).toBeNull(); expect(swap.lock.pilot).toBe('other');
  });
});

describe('the follow camera tracks the lock (lockTrack)', () => {
  const cam = (extra) => ({ rule: 'follow', target: 'me', dist: 6, height: 3, lead: 4, lookH: 1.5, lerp: 1e9, ...extra });
  const settle = (w) => { for (let i = 0; i < 600; i++) cw.stepWorld(w, {}, DT); return w; };

  it('without lockTrack a locked pilot changes nothing about the camera arithmetic', () => {
    const a = settle(cw.createWorld({ entities: [pilot(), suit('a', [10, 0, 0])], camera: cam({}) }));
    const b = cw.createWorld({ entities: [pilot(), suit('a', [10, 0, 0])], camera: cam({}), lock: true });
    step(b, { lock: 1 }); settle(b);
    expect(b.camera.lookAt).toEqual(a.camera.lookAt);
    expect(b.camera.transform.pos).toEqual(a.camera.transform.pos);
    expect(b.camera.lockMix).toBeUndefined();
  });

  it('with lockTrack the look point blends toward the target and the chase pulls back, easing in and out', () => {
    const w = cw.createWorld({ entities: [pilot(), suit('a', [10, 0, 0])], camera: cam({ lockTrack: { mix: 0.5, dist: 1.5, rate: 4 } }), lock: true });
    settle(w);
    const plainLook = [...w.camera.lookAt], plainPos = [...w.camera.transform.pos];
    expect(plainLook[0]).toBeCloseTo(4, 6);              // pilot + lead along heading 0
    step(w, { lock: 1 }); settle(w);
    expect(w.camera.lockMix).toBeCloseTo(1, 3);
    expect(w.camera.lookAt[0]).toBeCloseTo((4 + 10) / 2, 2);          // halfway to the target's x
    expect(w.camera.lookAt[2]).toBeCloseTo(1.5, 2);                    // both look points sit at lookH
    expect(w.camera.transform.pos[0]).toBeCloseTo(-9, 2);              // 6 × 1.5 behind (was −6)
    expect(plainPos[0]).toBeCloseTo(-6, 2);
    w.byId.a.gone = true; step(w); settle(w);                          // the lock drops: ease back out
    expect(w.camera.lockMix).toBeCloseTo(0, 3);
    expect(w.camera.lookAt[0]).toBeCloseTo(plainLook[0], 2);
    expect(w.camera.transform.pos[0]).toBeCloseTo(plainPos[0], 2);
  });
});

describe('composition', () => {
  it('the builder is self-contained (the browser runs it via toString) and registers its two passes', () => {
    const src = EMISSION.find((b) => b.name === 'buildLock').toString();
    expect(() => new Function('return ' + src)()).not.toThrow();
    const order = cw.pipelineOrder();
    expect(order.preSteps).toContain('lock');
    expect(order.worldPasses.indexOf('lock')).toBeGreaterThan(order.worldPasses.indexOf('match'));
    expect(cw.ZERO_INPUT.lock).toBe(0);
    expect(cw.normalizeLock(true)).toEqual({ range: 120, cone: Math.PI / 3, release: 150, aimRate: 8, los: true, pitch: true });
    expect(cw.normalizeLock({ range: 50, cone: 400, release: 10 })).toMatchObject({ range: 50, cone: Math.PI, release: 62.5 });
    expect(cw.normalizeLock(null)).toBeNull();
  });
});
