import { describe, it, expect } from 'vitest';
import { airBase, aircraftOf, validateAircraft, AIRFRAMES } from './aircraft.js';
import { AIR_GUNS, ORDNANCE } from './ordnance.js';
import { CRAFT } from '../../skyscape/eye.js';
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';
import { VEHICLES, handlesOf } from '../../vehicle-registry/roster.js';
import { composeLive } from '../../worlds/controllable/compose.js';

// THE AIRCRAFT ON THE RANGE (aircraft.js): the craft shelf's fighters on the fly rule at their class's envelope, their gun
// fixed along their nose. One case per procedure, chosen from the shelf in code: a jet and a piston fighter (the lightest
// of each), and an aircraft the shelf builds without a gun.
const wordOf = (a) => VEHICLES[Object.keys(VEHICLES).find((id) => (handlesOf(id).craft ?? []).includes(a))].label;
const byMass = (f) => Object.keys(AIRFRAMES).filter(f).sort((a, b) => CRAFT[AIRFRAMES[a]].mass - CRAFT[AIRFRAMES[b]].mass);
const JET = byMass((a) => CRAFT[AIRFRAMES[a]].max > 300)[0], PISTON = byMass((a) => CRAFT[AIRFRAMES[a]].max < 200)[0];
const E = composeLive(), DT = 1 / 60, hooks = { ground: () => 0 };

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

  it('refuses an aircraft with no gun the range fires, and what is no aircraft', () => {
    const unarmed = Object.keys(CRAFT_ARCHETYPES).find((a) => CRAFT_ARCHETYPES[a].realm === 'earth' && !AIRFRAMES[a] && Object.keys(VEHICLES).some((id) => (handlesOf(id).craft ?? []).includes(a)));
    expect(validateAircraft({ aircraft: wordOf(unarmed) }).join()).toMatch(/carries no gun/);
    expect(validateAircraft({ aircraft: 'sedan' }).join()).toMatch(/no aircraft of the craft shelf/);
    expect(validateAircraft({ aircraft: wordOf(JET), paint: 'red' }).join()).toMatch(/base.paint/);
    expect(aircraftOf(wordOf(JET)).craft).toBe(AIRFRAMES[JET]);
  });
});
