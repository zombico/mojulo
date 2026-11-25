import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { frameEntity } from '../../assault-frame/pilot.js';
import { assembleFrame } from '../../assault-frame/assemble.js';
import { ACES } from '../../assault-frame/aces.js';

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

  it('assault-boosts along the aim, held at its height, until it is toggled off; a kick lunges onto the locked foe and breaks its bar', () => {
    const st = world(), P = st.byId.p;
    run(st, { jump: 1, jumpHeld: 1 }, 40);
    const z0 = P.transform.pos[2];
    run(st, { ab: 1 }, 1); run(st, {}, 120);
    expect(P.ab).toBe(true);
    expect(P.speed).toBeGreaterThan(A.move.boost * 1.3);
    expect(Math.abs(P.transform.pos[2] - z0)).toBeLessThan(3);
    run(st, { ab: 1 }, 1); run(st, {}, 2);
    expect(P.ab).toBe(false);
    // (a light frame ahead, locked, kicked: a lunge onto it, its bar broken by the kick and a round's chip)
    const foe = frameEntity('raptor', { id: 'f', at: [60, 0, 0], team: 'foes', mind: {} });
    const s2 = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), foe], pilot: 'p', ai: 'off' }), F = s2.byId.f, P2 = s2.byId.p;
    run(s2, {}, 60);
    expect(P2.locked).toBe(true);
    F.poise = 0.3;
    const hp0 = F.body.hp;
    run(s2, { kick: 1 }, 1);
    let n = 0;
    while (!P2.lastHit && n++ < 60) run(s2, {}, 1);
    expect(P2.lastHit).toMatchObject({ by: 'kick', to: 'f' });
    expect(hp0 - F.body.hp).toBeGreaterThanOrEqual(A.kick.damage);
    run(s2, {}, 2);
    expect(F.stagger).toBeGreaterThan(0);
  });

  it('a blade\'s trigger lunges and cuts: no round flies', () => {
    const st = E.createWorld({ entities: [frameEntity('raptor', { id: 'p', at: [0, 0, 0], pilot: true }), frameEntity('citadel', { id: 'f', at: [50, 0, 0], team: 'foes', mind: {} })], pilot: 'p', ai: 'off' });
    const P = st.byId.p, F = st.byId.f, blade = assembleFrame('raptor').weapons.armL;
    expect(blade.fire).toBe('melee');
    run(st, {}, 60);
    const hp0 = F.body.hp, rounds = (st.projectiles || []).length;
    run(st, { alt: 1 }, 1);
    let n = 0;
    while (!P.lastHit && n++ < 60) run(st, {}, 1);
    expect(P.lastHit).toMatchObject({ by: 'armL', to: 'f' });
    expect(hp0 - F.body.hp).toBeGreaterThanOrEqual(blade.damage);
    expect((st.projectiles || []).length).toBe(rounds);
  });

  it('fires by its weapons\' handling: a free gun on the move, a dragging one holds the boost back, a braced one sticks it in the air and winds it down', () => {
    // (the Vanguard: a carbine (free) in the right hand, a mortar (braced) on the left shoulder; up and boosting first)
    const st = world(), P = st.byId.p, mortar = A.weapons.backL;
    expect(A.weapons.armR.handling).toBe('free');
    expect(mortar.handling).toBe('brace');
    run(st, { jump: 1, jumpHeld: 1 }, 50);
    run(st, { forward: 1, boost: 1, jumpHeld: 1 }, 60);
    const sp0 = P.speed;
    run(st, { forward: 1, boost: 1, jumpHeld: 1, fire: 1 }, 30);
    expect(P.speed).toBeGreaterThan(sp0 * 0.9);
    expect(P.braced).toBeNull();
    // (the mortar: the boost cut, the frame stuck where it fired, in the air, no gravity on it)
    run(st, { forward: 1, boost: 1, backL: 1 }, 1);
    run(st, { forward: 1, boost: 1 }, 20);
    expect(P.braced).toBe('stick');
    expect(P.airborne).toBe(true);
    expect(P.boosting).toBe(false);
    const z = P.transform.pos[2];
    run(st, { forward: 1, boost: 1 }, 10);
    expect(Math.abs(P.transform.pos[2] - z)).toBeLessThan(0.3);
    expect(P.speed).toBeLessThan(sp0 * 0.4);
    // (then the wind-down: gravity and control coming back; then free)
    const steady = assembleFrame('vanguard').parts.legs.steady;
    run(st, {}, Math.round((mortar.brace * steady) / DT));
    expect(P.braced).toBe('wind');
    run(st, {}, Math.round((mortar.wind * steady) / DT) + 2);
    expect(P.braced).toBeNull();
    // (a quick boost in the wind-down cancels it; in the stick it cannot)
    run(st, { backL: 0 }, Math.round(mortar.cooldown / DT));
    run(st, { backL: 1 }, 1); run(st, {}, 3);
    run(st, { strafe: 1, qb: 1 }, 1);
    expect(P.braced).toBe('stick');
    run(st, { strafe: 1, qb: 0 }, Math.round((mortar.brace * steady) / DT) + 2);
    run(st, { strafe: 1, qb: 1 }, 1);
    expect(P.braced).toBeNull();
  });

  it('a gatling\'s recoil holds the boost back while it fires', () => {
    const st = E.createWorld({ entities: [frameEntity('citadel', { id: 'p', at: [0, 0, 0], pilot: true })], pilot: 'p' }), P = st.byId.p, C = assembleFrame('citadel');
    expect(C.weapons.armR.handling).toBe('drag');
    run(st, { forward: 1, boost: 1 }, 120);
    const sp0 = P.speed;
    run(st, { forward: 1, boost: 1, fire: 1 }, 90);
    expect(P.speed).toBeLessThan(sp0 * (C.weapons.armR.drag + 0.05));
  });

  it('an ace fights by its phase: a rush tells its lunge before it strikes; cornered, it wakes its reserve and steadies', () => {
    const V = ACES.vermilion, P1 = V.phases[1];
    const ace = { ...frameEntity(V.build, { id: 'ace', at: [70, 0, 0], heading: Math.PI, team: 'foes', mind: { range: V.phases[0].range, phases: V.phases } }), ace: { id: 'vermilion', name: V.name } };
    const res = frameEntity('raptor', { id: 'reserve-1', at: [200, 0, 0], team: 'foes', mind: {} });
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), ace, { ...res, dormant: true }], pilot: 'p' });
    const A = st.byId.ace, R = st.byId['reserve-1'];
    expect(A.ace).toEqual({ id: 'vermilion', name: V.name });   // (its name kept on the body: the HUD's bar reads it)
    run(st, {}, 30);
    expect(A.acePhase).toBe(0);
    // (wounded past its first threshold: the rush; its lunge comes only after its tell)
    A.body.hp = A.body.hpMax * (P1.below - 0.05);
    let told = -1, struck = -1;
    for (let i = 0; i < 60 * 8 && struck < 0; i++) {
      run(st, {}, 1);
      if (told < 0 && A.tell) told = i;
      if (A.lunge && struck < 0) struck = i;
    }
    expect(A.acePhase).toBe(1);
    expect(told).toBeGreaterThanOrEqual(0);
    expect(struck - told).toBeGreaterThanOrEqual(Math.round(P1.tell / DT) - 1);
    expect(R.dormant).toBe(true);
    // (cornered: its reserve woken, its bar steadier)
    const regen = A.poiseRegen;
    A.body.hp = A.body.hpMax * 0.2;
    run(st, {}, 2);
    expect(A.acePhase).toBe(2);
    expect(R.dormant).toBe(false);
    expect(A.poiseRegen).toBeCloseTo(regen * V.phases[2].regen, 5);
  });

  it('a flier with a floor weaves in on a frame on its feet but never comes under its floor over the land', () => {
    const gnat = { id: 'g', team: 'foes', rule: { type: 'ai', space: true, speed: 30, turn: 3, standoff: 40, floor: 10, sightRange: 400 }, body: { type: 'box', size: [2, 2, 1], hittable: true, hp: 100, radius: 2 }, transform: { pos: [120, 0, 40], heading: Math.PI, pitch: 0 } };
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), gnat], pilot: 'p' }), G = st.byId.g;
    let low = 99;
    for (let i = 0; i < 300; i++) { run(st, {}, 1); low = Math.min(low, G.transform.pos[2]); }
    expect(Math.hypot(G.transform.pos[0], G.transform.pos[1])).toBeLessThan(100);
    expect(low).toBeGreaterThanOrEqual(10 - 1e-6);
  });

  it('a launcher\'s homing missiles chip a frame\'s bar by their impact, not break it outright', () => {
    const hammer = { id: 'h', team: 'foes', rule: { type: 'ai', space: true, speed: 0, turn: 2, standoff: 400, sightRange: 700, missiles: { count: 4, lockTime: 0.3, cone: 60, range: 600, speed: 120, turn: 2, damage: 300, splash: 9, prox: 4, cooldown: 3, impact: 0.12 } }, body: { type: 'box', size: [4, 8, 3], hittable: true, hp: 3000, radius: 5 }, transform: { pos: [200, 0, 2], heading: Math.PI, pitch: 0 } };
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), hammer], pilot: 'p' }), P = st.byId.p;
    const hp0 = P.body.hp;
    let n = 0;
    while (P.body.hp === hp0 && n++ < 60 * 8) run(st, {}, 1);
    expect(P.body.hp).toBeLessThan(hp0);
    run(st, {}, 2);
    expect(P.stagger ?? 0).toBe(0);
    expect(P.poise).toBeLessThan(P.poiseMax);
  });

  it('a shield-bearer\'s front eats rounds; a kick knocks the shield aside and staggers it; it is raised again', () => {
    const bastion = { id: 'b', team: 'foes', rule: { type: 'ai', space: true, speed: 0, turn: 2, standoff: 150, sightRange: 400, shieldRaise: 7 }, body: { type: 'box', size: [6, 6, 8], hittable: true, hp: 5000, hpMax: 5000, poise: 99, radius: 6, aimH: 4, shield: { hp: 4000, arc: 120 } }, transform: { pos: [70, 0, 0], heading: Math.PI, pitch: 0 } };
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), bastion], pilot: 'p', ai: 'off' }), B = st.byId.b, P = st.byId.p;
    run(st, {}, 60);
    expect(P.locked).toBe(true);
    // (the carbine into its front: the shield drains, its armour untouched)
    run(st, { fire: 1 }, 90); run(st, {}, 30);
    expect(B.shieldHp).toBeLessThan(B.shieldMax);
    expect(B.body.hp).toBe(5000);
    // (the kick: the shield knocked aside, the bearer staggered)
    run(st, { kick: 1 }, 1);
    let n = 0;
    while (!P.lastHit && n++ < 60) run(st, {}, 1);
    expect(B.shieldBroken).toBe(true);
    expect(B.staggerT != null || B.reactClip === 'stagger').toBe(true);
    expect(B.body.hp).toBeLessThan(5000);
    // (and raised again, whole)
    run(st, {}, Math.round(7 / DT) + 5);
    expect(B.shieldBroken).toBe(false);
    expect(B.shieldHp).toBe(B.shieldMax);
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
