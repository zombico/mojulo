import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { frameEntity } from '../../assault-frame/pilot.js';
import { assembleFrame } from '../../assault-frame/assemble.js';

// THE ASSAULT FRAME (rules-frame.js): a mech that boosts, quick-boosts, climbs and fights with four guns. One procedure each:
// the boost, the quick boost, the generator emptied, the climb and the fall, the lock, the four triggers, a mind.
const E = composeLive();
const DT = 1 / 60;
const flat = { ground: () => 0 };
const world = (extra = []) => E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), ...extra], pilot: 'p' });
const run = (st, inp, n) => { for (let i = 0; i < n; i++) E.stepWorld(st, inp, DT, flat); return st; };
const A = assembleFrame('vanguard');

describe('the assault frame', () => {
  it('walks on its feet and skates on its booster at the frame\'s speeds', () => {
    const st = run(world(), { forward: 1 }, 90), P = st.byId.p;
    expect(P.speed).toBeCloseTo(A.move.walk, 0);
    expect(P.locomotion).toBe('forward');
    run(st, { forward: 1, boost: 1 }, 90);
    expect(P.speed).toBeCloseTo(A.move.boost, 0);
    expect(P.locomotion).toBe('boost');
  });

  it('quick-boosts a burst across, costing the generator, then waits for its cooldown', () => {
    const st = world(), P = st.byId.p;
    run(st, { strafe: 1, qb: 1 }, 1);
    const en = P.en;
    expect(en).toBeLessThan(A.en.max - A.en.cost.qb + 1);
    run(st, { strafe: 1, qb: 0 }, Math.round(A.move.qbTime / DT));
    // (right of a frame facing +x is −y: carried the burst's distance and more)
    expect(-P.transform.pos[1]).toBeGreaterThan(A.move.qb * A.move.qbTime * 0.8);
    run(st, { strafe: 1, qb: 1 }, 1);
    expect(P.en).toBeGreaterThanOrEqual(en);   // (still cooling down: no second burst)
    run(st, { strafe: 1, qb: 0 }, Math.round(A.move.qbCool / DT) + 2);
    const en2 = P.en;
    run(st, { strafe: 1, qb: 1 }, 1);
    expect(P.en).toBeLessThan(en2);   // a second one, after the first's cooldown is over
  });

  it('empties its generator and is shut out of its boost until it is back over a third', () => {
    const st = world(), P = st.byId.p;
    // (up on its thrusters and boosting: the draw outruns the generator)
    run(st, { jump: 1, jumpHeld: 1 }, 1);
    let n = 0;
    while (P.en > 0 && n < 60 * 20) { run(st, { jumpHeld: 1, boost: 1, forward: 1 }, 1); n++; }
    expect(P.en).toBe(0);
    expect(P.enOut).toBeGreaterThan(0);
    run(st, { forward: 1, boost: 1 }, 10);
    expect(P.boosting).toBe(false);
    run(st, {}, Math.round((A.en.out + A.en.delay + A.en.max / 3 / A.en.regen) / DT) + 30);
    run(st, { forward: 1, boost: 1 }, 5);
    expect(P.boosting).toBe(true);
  });

  it('jumps, climbs on its thrusters while Space is held, and comes back down to land', () => {
    const st = world(), P = st.byId.p;
    run(st, { jump: 1, jumpHeld: 1 }, 1);
    run(st, { jumpHeld: 1 }, 90);
    expect(P.transform.pos[2]).toBeGreaterThan(15);
    expect(P.ascending).toBe(true);
    expect(P.en).toBeLessThan(A.en.max);
    let n = 0;
    while (P.airborne && n < 60 * 20) { run(st, {}, 1); n++; }
    expect(P.airborne).toBe(false);
    expect(n * DT).toBeLessThan(10);
  });

  it('locks the foe in its sights after its FCS\'s time, and its four triggers fire their own guns', () => {
    const foe = { ...frameEntity('raptor', { id: 'f', at: [150, 0, 0], team: 'foes' }), rule: { type: 'none' } };
    const st = world([foe]), P = st.byId.p;
    run(st, {}, Math.ceil(A.fcs.lock / DT) + 2);
    expect(P.lockOn).toBe('f');
    expect(P.locked).toBe(true);
    run(st, { fire: 1 }, 30);
    expect(P.slotState.armR.ammo).toBeLessThan(A.weapons.armR.mag);
    expect(P.slotState.armL.ammo).toBe(A.weapons.armL.mag);
    run(st, { backR: 1 }, 1);
    expect(P.slotState.backR.ammo).toBe(A.weapons.backR.mag - 1);
    expect(P.slotState.backL.ammo).toBe(A.weapons.backL.mag);
    // (and they hurt it: a locked fight takes the foe's armour down)
    let n = 0;
    while (!st.byId.f.downed && n < 60 * 30) { run(st, { fire: 1, alt: n % 140 < 2 ? 1 : 0, backR: n % 160 === 0 ? 1 : 0 }, 1); n++; }
    expect(st.byId.f.downed).toBe(true);
  });

  it('an enemy frame moves by its own mind, not the pilot\'s keys, and the same world steps the same', () => {
    const foe = () => frameEntity('raptor', { id: 'f', at: [300, 0, 0], team: 'foes', mind: {} });
    const a = run(world([foe()]), { forward: 1 }, 240), b = run(world([foe()]), { forward: 1 }, 240);
    const F = a.byId.f;
    expect(Math.hypot(F.transform.pos[0] - 300, F.transform.pos[1])).toBeGreaterThan(30);
    expect(JSON.stringify(a.byId.f.transform)).toBe(JSON.stringify(b.byId.f.transform));
  });

  it('a hit\'s impact chips the stability bar; broken, the frame reels, its keys dead, hit harder, then stands again', () => {
    // (a heavy frame ahead with its mind off: the pilot's bazooka, the left hand, the weapon its stagger is read from)
    const foe = frameEntity('citadel', { id: 'f', at: [140, 0, 0], team: 'foes', mind: {} });
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), foe], pilot: 'p', ai: 'off' }), F = st.byId.f;
    const S = assembleFrame('citadel').stab, bz = A.weapons.armL;
    expect(F.poise).toBeCloseTo(S.max, 5);
    // (aimed until it holds its lock, then one round)
    run(st, {}, 60);
    // (the lowest the bar goes: it comes back as soon as it is hit)
    run(st, { alt: 1 }, 1);
    let low = F.poise;
    for (let i = 0; i < 90; i++) { run(st, {}, 1); low = Math.min(low, F.poise); }
    expect(low).toBeLessThan(S.max - bz.stagger * 0.9);
    expect(F.stagger ?? 0).toBe(0);
    // (broken: the engine arms a stagger on a bar at nothing; the frame takes it as its own reel)
    run(st, {}, Math.round(bz.cooldown / DT));
    F.poise = 0.01; run(st, { alt: 1 }, 1);
    let n = 0;
    while (!(F.stagger > 0) && n++ < 240) run(st, {}, 1);
    expect(F.stagger).toBeGreaterThan(0);
    expect(F.staggerT).toBeNull();
    expect(F.staggers).toBe(1);
    // (reeling: no boost though its keys would; a hit on it lands half as hard again)
    st.aiEnabled = true; run(st, {}, 2);
    expect(F.boosting).toBe(false);
    const hp0 = F.body.hp; F.body.hp -= 100; run(st, {}, 1);
    expect(hp0 - F.body.hp).toBeCloseTo(100 * S.bonus, 0);
    // (the reel runs out, and the bar comes back from nothing)
    run(st, {}, Math.round(S.stagger / DT) + 2);
    expect(F.stagger).toBe(0);
    expect(F.stab).toBeGreaterThan(0);
    expect(F.staggers).toBe(1);
  });
});
