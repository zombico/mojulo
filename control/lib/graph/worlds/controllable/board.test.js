import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// A VEHICLE GOT INTO AND RIDDEN (board.js): the action within its reach climbs in, and then the vehicle is the pilot (the
// stick drives it, the camera follows it) and its rider is aboard (out of sight, never hit, carried with it); the action
// again lets it out, in the vehicle's boarding form first, set down beside it. A vehicle downed throws its rider out.
// One vehicle, two forms (a walker's: one walks, one rolls), its numbers a small machine's.

const E = composeLive();
const hooks = { ground: () => 0 };
const dt = 1 / 60;
const walkRule = { type: 'walk', speed: 2, turn: 1, eye: 0, collideRadius: 1, collideHeight: 3 };
const rollRule = { type: 'walk', speed: 6, turn: 1, eye: 0, collideRadius: 1, collideHeight: 3 };
const world = () => E.createWorld({
  camera: { rule: 'follow', target: 'p', dist: 4, height: 2 },
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'walk', speed: 3, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, -3, 0], heading: Math.PI / 2 } },
    { id: 'v', pilotable: true, rule: rollRule, ambient: { type: 'static' }, forms: { walker: { rule: walkRule }, tank: { rule: rollRule } }, form: 'tank', transformDur: 0.5,
      body: { type: 'mesh', hittable: true, hp: 500 }, board: { reach: 3.5, climb: 0.5, form: 'tank' }, transform: { pos: [0, 0, 0], heading: Math.PI / 2 } },
  ],
});
const run = (w, s, input = {}, first = null) => { for (let k = 0; k < Math.round(s / dt); k++) E.stepWorld(w, k === 0 && first ? first : input, dt, hooks); };

describe('a vehicle got into and ridden', () => {
  it('is emitted only into a page that has one', () => {
    expect(emissionSource({})).not.toContain('stepWithBoard');
    expect(emissionSource({ board: true })).toContain('stepWithBoard');
  });
  it('the action in reach climbs in: then the vehicle is the pilot, the camera on it, its rider aboard, out of sight and never hit', () => {
    const w = world(), p = w.byId.p, v = w.byId.v;
    expect(E.boardTarget(w, p)).toBe(v);
    run(w, 0.3, {}, { act: 1 });
    expect(p.boarding).toBeTruthy(); expect(w.pilotId).toBe('p');   // (still climbing)
    run(w, 0.4);
    expect(w.pilotId).toBe('v');
    expect(p.aboard).toBe('v'); expect(v.boardedBy).toBe('p');
    expect(p.body.hittable).toBe(false);
    expect(w.camera.rule.target).toBe('v');
    // the stick drives it, its rider carried with it
    run(w, 1, { forward: 1 });
    expect(v.transform.pos[1]).toBeGreaterThan(2);
    expect(p.transform.pos[1]).toBeCloseTo(v.transform.pos[1], 6);
  });
  it('the action again: halted, in its boarding form first, its rider set down beside it, the pilot and the camera given back', () => {
    const w = world(), p = w.byId.p, v = w.byId.v;
    run(w, 1, {}, { act: 1 });
    run(w, 0.1, {}, { transform: 1 });   // (unfolded to walk)
    run(w, 0.7);
    expect(v.form).toBe('walker');
    run(w, 0.05, {}, { act: 1 });
    expect(w.pilotId).toBe('v');                                // (folding back onto its wheels first)
    run(w, 1);
    expect(v.form).toBe('tank');
    expect(w.pilotId).toBe('p');
    expect(p.aboard).toBe(null); expect(p.body.hittable).toBe(true);
    expect(w.camera.rule.target).toBe('p');
    const off = Math.hypot(p.transform.pos[0] - v.transform.pos[0], p.transform.pos[1] - v.transform.pos[1]);
    expect(off).toBeGreaterThan(1.5);                           // (beside it, clear of it)
    expect(v.rule.type).toBe('static');                         // (left standing)
  });
  it('a vehicle downed throws its rider out where it stands', () => {
    const w = world(), p = w.byId.p, v = w.byId.v;
    run(w, 1, {}, { act: 1 });
    v.downed = true;
    run(w, 0.05);
    expect(p.aboard).toBe(null);
    expect(w.pilotId).toBe('p');
  });
  it('out of reach, the action climbs into nothing', () => {
    const w = world(), p = w.byId.p;
    p.transform.pos = [0, -8, 0];
    run(w, 1, {}, { act: 1 });
    expect(p.boarding || null).toBe(null);
    expect(w.pilotId).toBe('p');
  });
});
