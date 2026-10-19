import { describe, it, expect } from 'vitest';

import { createWorld, stepWorld } from '../controllable-world.js';

// one body, two forms: a walker that becomes a car, and a walker that becomes a jet
const ground = () => 0;
function bot(vehicle = 'drive', extra = {}) {
  const alt = vehicle === 'fly'
    ? { rule: { type: 'fly', mass: 9000, thrust: 90000, stallSpeed: 30, maxSpeed: 120 }, lift: 4 }
    : { rule: { type: 'drive', horsepower: 300, mass: 1500, wheelbase: 2.7, wheelRadius: 0.34 } };
  return createWorld({
    entities: [{
      id: 'bot', pilotable: true,
      transform: { pos: [0, 0, 0], heading: 0 },
      forms: { robot: { rule: { type: 'platform', speed: 8 } }, vehicle: alt },
      transformDur: 0.5,
      body: { type: 'figure-rig', figure: 'bot' },
      ...extra,
    }],
  });
}
const run = (w, frames, input = {}, dt = 1 / 60) => { for (let i = 0; i < frames; i++) stepWorld(w, i === 0 ? input : { ...input, transform: 0 }, dt, { ground }); return w; };

describe('forms (more-than-meets): one body that changes what it is', () => {
  it('starts in its first form, under that form\'s rule (and pilot rule)', () => {
    const w = bot();
    const e = w.byId.bot;
    expect(e.form).toBe('robot');
    expect(e.rule.type).toBe('platform');
    expect(e.pilotRule).toBe(e.rule);
  });

  it('a press plays the beat (owned, invincible, the clip) and swaps the rule at its end', () => {
    const w = bot();
    const e = w.byId.bot;
    stepWorld(w, { transform: 1 }, 1 / 60, { ground });
    expect(e.transformT).toBeGreaterThan(0);
    expect(e.locomotion).toBe('transform:vehicle');
    expect(e.invincible).toBe(true);
    expect(e.rule.type).toBe('platform');   // still the robot until the beat ends
    run(w, 40);
    expect(e.form).toBe('vehicle');
    expect(e.rule.type).toBe('drive');
    expect(e.pilotRule).toBe(e.rule);
    expect(e.transformT).toBe(null);
    expect(e.invincible).toBe(false);
  });

  it('the speed crosses over along the heading: a running robot becomes a moving car', () => {
    const w = bot();
    const e = w.byId.bot;
    const x0 = e.transform.pos[0];
    run(w, 60, { forward: 1 });
    const vx = (e.transform.pos[0] - x0) / 1;   // metres in the last second
    expect(vx).toBeGreaterThan(4);
    run(w, 1, { transform: 1 });
    run(w, 40);
    expect(e.rule.type).toBe('drive');
    expect(e.speed).toBeGreaterThan(0.3 * vx);
    // and back: the car's speed is the robot's velocity
    run(w, 30, { forward: 1 });
    const sp = e.speed;
    run(w, 1, { transform: 1 });
    run(w, 40);
    expect(e.rule.type).toBe('platform');
    expect(Math.hypot(e.vel[0], e.vel[1])).toBeGreaterThan(0.3 * sp);
  });

  it('a jet form flies at once: at least its take-off speed, lifted clear', () => {
    const w = bot('fly');
    const e = w.byId.bot;
    run(w, 1, { transform: 1 });
    run(w, 40);
    expect(e.rule.type).toBe('fly');
    expect(e.airspeed).toBeGreaterThanOrEqual(30 * 1.25);
    expect(e.airborne).toBe(true);
    expect(e.transform.pos[2]).toBeGreaterThan(1);
  });

  it('a busy body does not transform', () => {
    const w = bot();
    const e = w.byId.bot;
    e.dodgeT = 0.2;
    stepWorld(w, { transform: 1 }, 1 / 60, { ground });
    expect(e.transformT).toBe(null);
    expect(e.form).toBe('robot');
  });

  it('is deterministic, and a body without forms steps as before', () => {
    const a = run(bot(), 90, { forward: 1, transform: 1 });
    const b = run(bot(), 90, { forward: 1, transform: 1 });
    expect(JSON.stringify(a.entities)).toBe(JSON.stringify(b.entities));
    const plain = createWorld({ entities: [{ id: 'p', transform: { pos: [0, 0, 0] }, rule: { type: 'platform' } }] });
    run(plain, 10, { transform: 1 });
    expect(plain.byId.p.form).toBeUndefined();
    expect(plain.byId.p.rule.type).toBe('platform');
  });
});
