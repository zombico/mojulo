import { describe, it, expect } from 'vitest';
import { airBase, aircraftOf, validateAircraft, AIRFRAMES } from './aircraft.js';
import { ROTOR_ARMS } from './rotorcraft.js';
import { AIR_GUNS, ORDNANCE } from './ordnance.js';
import { ROTOR } from '../../skyscape/rotor.js';
import { CRAFT } from '../../skyscape/eye.js';
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';
import { VEHICLES, handlesOf } from '../../vehicle-registry/roster.js';
import { composeLive } from '../../worlds/controllable/compose.js';

// THE AIRCRAFT ON THE RANGE (aircraft.js): the craft shelf's fighters on the fly rule at their class's envelope, their gun
// fixed along their nose; the rotorcraft on the hover rule at their types' envelopes, armed as such machines are. One
// case per procedure, chosen from the shelf in code: a jet and a piston fighter (the lightest of each); a helicopter on a
// turret with stores beside it, one with a door gun, a drone that drops, one that strikes; a fixed-wing drone's stores;
// and an aircraft the shelf builds unarmed.
const wordOf = (a) => VEHICLES[Object.keys(VEHICLES).find((id) => (handlesOf(id).craft ?? []).includes(a))].label;
const byMass = (f) => Object.keys(AIRFRAMES).filter((a) => f(a) && CRAFT_ARCHETYPES[a].layout.some((e) => e.id === 'gun')).sort((a, b) => CRAFT[AIRFRAMES[a]].mass - CRAFT[AIRFRAMES[b]].mass);
const JET = byMass((a) => CRAFT[AIRFRAMES[a]].max > 300)[0], PISTON = byMass((a) => CRAFT[AIRFRAMES[a]].max < 200)[0];
const E = composeLive(), DT = 1 / 60, hooks = { ground: () => 0 };
const rotorWord = (a) => VEHICLES[Object.keys(VEHICLES).find((id) => (handlesOf(id).rotor ?? []).includes(a))].label;
const armed = (f) => Object.keys(ROTOR_ARMS).find((a) => f(ROTOR_ARMS[a]));
const fly = (A) => E.createWorld({ entities: [{ id: 'a', pilotable: true, rule: A.rule, turret: { ...A.turret, rounds: A.rounds }, weapon: A.rounds[0], body: { type: 'none' }, transform: A.transform }] });
const run = (w, n, input = {}) => { for (let i = 0; i < n; i++) E.stepWorld(w, input, DT, hooks); };

describe('the aircraft on the range', () => {
  it('flies on its class\'s envelope: its drag from its thrust at its top speed, its stall, the lever set where cruise holds', () => {
    const A = airBase({ aircraft: wordOf(JET) }), C = CRAFT[AIRFRAMES[JET]];
    expect(A.rule.type).toBe('fly');
    expect(A.rule.drag).toBeCloseTo(C.thrust / C.max ** 2, 3);
    expect(A.rule.stallSpeed).toBe(C.stall);
    expect(A.rule.launchSpeed).toBe(C.cruise);
    // (on the runtime: at its lever it holds its cruise, level, a few seconds on)
    const w = E.createWorld({ entities: [{ id: 'a', pilotable: true, rule: A.rule, turret: A.turret, weapon: A.rounds[0], body: { type: 'none' }, transform: A.transform }] });
    for (let i = 0; i < 240; i++) E.stepWorld(w, {}, DT, hooks);
    expect(w.byId.a.airspeed).toBeCloseTo(C.cruise, -1);
    expect(Math.abs(w.byId.a.transform.pos[2] - A.transform.pos[2])).toBeLessThan(1);
  });

  it('its gun fixed along its nose: the mouse its to fly by, its rounds by calibre, fired with its own velocity', () => {
    const A = airBase({ aircraft: wordOf(PISTON) }), gun = CRAFT_ARCHETYPES[PISTON].layout.find((e) => e.id === 'gun').sku;
    expect(A.turret.mount.fixed).toBe(true);
    expect(A.rounds.map((r) => r.ordnance)).toEqual([...AIR_GUNS[gun].rounds]);
    expect(A.rounds[0].auto).toBe(true);
    const w = E.createWorld({ entities: [{ id: 'a', pilotable: true, rule: A.rule, turret: A.turret, weapon: A.rounds[0], body: { type: 'none' }, transform: A.transform }] });
    for (let i = 0; i < 10; i++) E.stepWorld(w, { lookDY: -4 }, DT, hooks);
    const a = w.byId.a;
    expect(a.transform.pitch).toBeLessThan(-0.05);   // (the look pitched the craft, not a turret)
    E.stepWorld(w, { fire: 1 }, DT, hooks);
    const p = w.projectiles.find((q) => q.owner === 'a'), sp = Math.hypot(...p.vel);
    // (along its nose, at its muzzle velocity and its airspeed together)
    expect(p.vel[2] / sp).toBeCloseTo(Math.sin(a.transform.pitch), 1);
    expect(sp).toBeGreaterThan(ORDNANCE[A.rounds[0].ordnance].v0 + 0.8 * a.airspeed);
  });

  it('a helicopter on its turret: its chin gun aimed by the hand, its stores along its nose, each a store of its own', () => {
    const a = armed((x) => x.chin && x.stores), A = airBase({ aircraft: rotorWord(a) }), R = ROTOR[A.rotor];
    expect(A.rule.type).toBe('hover');
    expect(A.turret.mount.fixed).toBeUndefined();
    expect(A.turret.mount.stabilized).toBe(true);
    expect(A.rounds.filter((r) => r.fixed).map((r) => r.ordnance)).toEqual(ROTOR_ARMS[a].stores.map((s) => s[0]));
    expect(A.rounds.every((r) => r.store)).toBe(true);
    // (the look slews the gun, not the craft; a store switched to is ready at once, the gun's count kept)
    const w = fly(A), h = w.byId.a;
    run(w, 30, { lookDX: -20 });
    expect(h.turret.yaw).toBeLessThan(-5);
    expect(h.transform.heading).toBeCloseTo(0, 6);
    run(w, 30, { fire: 1 });
    const left = h.weapon.ammo;
    expect(left).toBeLessThan(A.rounds[0].magazine);
    run(w, 1, { slot: 2 });
    expect(h.turret.loaded).toBe(1);
    expect(h.weapon.ammo).toBe(A.rounds[1].magazine);
    expect(h.weapon.reloading).toBeFalsy();
    run(w, 1, { slot: 1 });
    expect(h.weapon.ammo).toBe(left);
    // (it hovers where it was set, at its type's height)
    expect(h.transform.pos[2]).toBeCloseTo(A.transform.pos[2], 1);
    expect(R.max).toBeGreaterThan(50);
  });

  it('a door gun on the right: its arcs that side only, its rounds carried by the craft\'s own velocity', () => {
    const A = airBase({ aircraft: rotorWord(armed((x) => x.door)) }), M = A.turret.mount;
    expect(M.at[1]).toBeGreaterThan(0.5);
    expect(M.traverse.max).toBeLessThan(0);
    const w = fly(A), h = w.byId.a;
    run(w, 240, { forward: 1 });
    run(w, 1, { fire: 1 });
    const p = w.projectiles.find((q) => q.owner === 'a');
    expect(p.carried).toBe(true);
    expect(h.vel[0]).toBeGreaterThan(5);
  });

  it('a drone lets go below it what it lifts, and where it lets go is where it lands, carried on by its speed', () => {
    const a = armed((x) => x.drop), A = airBase({ aircraft: rotorWord(a) });
    expect(A.rule.hold).toBe(true);
    expect(A.turret.mount.fixedPitch).toBe(-90);
    expect(A.rounds.map((r) => r.ordnance)).toEqual(ROTOR_ARMS[a].drop.map((d) => d[0]));
    const w = fly(A), h = w.byId.a;
    run(w, 300, { forward: 1 });
    const x0 = h.transform.pos[0], v = h.vel[0];
    run(w, 1, { fire: 1 });
    const p = w.projectiles.find((q) => q.owner === 'a');
    expect(p.vel[2]).toBeLessThan(0);
    expect(p.vel[0]).toBeCloseTo(v, 0);
    // (let go, the drone brakes to a hover)
    run(w, 600);
    expect(h.airspeed).toBeLessThan(0.5);
    expect(h.transform.pos[0]).toBeGreaterThan(x0);
  });

  it('a drone that strikes: flown into the ground, its warhead released on its path, and the next one launched', () => {
    const A = airBase({ aircraft: rotorWord(armed((x) => x.strike)) });
    expect(A.turret.strike).toBeTruthy();
    const w = fly(A), h = w.byId.a;
    for (let i = 0; i < 900 && !(h.turret.strikes > 0); i++) E.stepWorld(w, { forward: 1, lift: -1 }, DT, hooks);
    expect(h.turret.strikes).toBe(1);
    expect(w.projSeq).toBe(1);
    expect(h.transform.pos).toEqual(A.transform.pos);
  });

  it('a fixed-wing drone: its stores along its nose, or itself the munition', () => {
    const male = airBase({ aircraft: 'reaper drone' }), loiter = airBase({ aircraft: 'loitering munition' });
    expect(male.rule.type).toBe('fly');
    expect(male.rounds[0].ordnance).toBe('missile');
    expect(loiter.turret.strike).toBeTruthy();
    expect(loiter.rule.maxSpeed).toBe(CRAFT[AIRFRAMES.loiterMunition].max);
  });

  it('refuses an aircraft that carries nothing the range fires, and what is no aircraft', () => {
    const unarmed = Object.keys(CRAFT_ARCHETYPES).find((a) => CRAFT_ARCHETYPES[a].realm === 'earth' && !AIRFRAMES[a] && !ROTOR_ARMS[a] && Object.keys(VEHICLES).some((id) => (handlesOf(id).craft ?? []).includes(a)) && !CRAFT_ARCHETYPES[a].hull);
    expect(validateAircraft({ aircraft: wordOf(unarmed) }).join()).toMatch(/carries nothing the range fires/);
    expect(validateAircraft({ aircraft: 'sedan' }).join()).toMatch(/no aircraft of the craft shelf/);
    expect(validateAircraft({ aircraft: wordOf(JET), paint: 'red' }).join()).toMatch(/base.paint/);
    expect(aircraftOf(wordOf(JET)).craft).toBe(AIRFRAMES[JET]);
  });
});
