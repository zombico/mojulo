// AN ASSET DEFENDED on a frame field (frame-goal.js GUARD): a prop with armour is the foes' to hit and the pilot's to keep
// up. A group sent at it takes it for its foe (its mind's `target`, worlds/controllable/mind.js) and closes on it; the
// pilot's side's rounds go through it (its `ward`, combat-ranged.js), the pilot's lock passes it over; a task's guard is
// the objectives' keep; the HUD reads it by its `guard`.
import { describe, expect, it } from 'vitest';
import { composeLive } from '../worlds/controllable/compose.js';
import { frameEntity } from '../assault-frame/pilot.js';
import { readOperation, operationCast, operationMechanics, GUARD } from './frame-goal.js';

const E = composeLive();
const DT = 1 / 30;
const flat = { ground: () => 0 };
const ends = { spawn: [0, 0, 0], heading: Math.PI / 2, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
const OP = {
  groups: [{ id: 'w', kind: 'gnat', count: 2, at: [0.6, 0.6], target: 'candle' }],
  tasks: [{ down: ['w'], guard: ['candle'] }],
  props: [{ id: 'candle', unit: 'candle', at: [0, 0.3], hp: 20000, name: 'Roman Candle' }],
  retry: true,
};

describe('an asset defended', () => {
  it('reads: an asset is a prop with armour; a target and a guard name one, or are refused', () => {
    const op = readOperation(OP);
    expect(op.props[0]).toMatchObject({ hp: 20000, name: 'Roman Candle' });
    expect(op.groups[0].target).toEqual(['candle']);
    expect(op.tasks[0].guard).toEqual(['candle']);
    expect(() => readOperation({ ...OP, props: [{ id: 'candle', unit: 'candle', at: [0, 0.3] }] })).toThrow(/not a prop with armour/);
    expect(() => readOperation({ ...OP, props: [{ ...OP.props[0], hp: GUARD.hp * 2 }] })).toThrow(/hp is its armour/);
    expect(() => readOperation({ ...OP, groups: [{ id: 'f', kind: 'frame', at: [0.5, 0.5], target: 'candle' }], tasks: [{ down: ['f'] }] })).toThrow(/not a frame's/);
  });

  it("lowers: a hittable ward under its name, the group's minds sent at it, the task keeping it up", () => {
    const op = readOperation(OP), cast = operationCast(op, ends), C = cast.entities.find((e) => e.id === 'candle');
    expect(C).toMatchObject({ guard: 'Roman Candle', body: { hittable: true, ward: true, hp: 20000, hpMax: 20000 } });
    expect(C.team).toBeUndefined();
    expect(cast.entities.filter((e) => e.id.startsWith('w-')).every((e) => e.rule.target[0] === 'candle')).toBe(true);
    const [obj] = operationMechanics(op, ends);
    expect(obj.tasks[0].keep).toEqual(['candle']);
  });

  it('plays: the drones close on the candle and hit it', () => {
    const op = readOperation(OP), cast = operationCast(op, ends);
    // (the pilot far off to one side, holding still: the drones go for the candle, not for it)
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [-300, -300, 0], heading: 0, pilot: true }), ...cast.entities], pilot: 'p' });
    // (the world keeps its name: the HUD reads it there)
    expect(st.byId.candle.guard).toBe('Roman Candle');
    const C = st.byId.candle, D = st.byId['w-1'], P = st.byId.p, gap = (A, B2) => Math.hypot(A.transform.pos[0] - B2.transform.pos[0], A.transform.pos[1] - B2.transform.pos[1]);
    const d0 = gap(D, C);
    for (let i = 0; i < 30 * 20; i++) E.stepWorld(st, {}, DT, flat);
    expect(gap(D, C)).toBeLessThan(d0);
    expect(gap(D, C)).toBeLessThan(gap(D, P));
    expect(C.body.hp).toBeLessThan(20000);
    expect(P.body.hp).toBe(P.body.hpMax);
  });

  it("plays: the pilot's rounds go through it to the foe past it, and its lock passes it over", () => {
    const op = readOperation({ ...OP, groups: [{ id: 'f', kind: 'frame', at: [0, 0.6] }], tasks: [{ down: ['f'], guard: ['candle'] }] }), cast = operationCast(op, ends);
    const C = cast.entities.find((e) => e.id === 'candle'), F = cast.entities.find((e) => e.id === 'f');
    // (the candle straight between the pilot and an enemy frame, its mind off)
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [C.transform.pos[0], C.transform.pos[1] - 120, 0], heading: Math.atan2(F.transform.pos[1] - C.transform.pos[1] + 120, F.transform.pos[0] - C.transform.pos[0]), pilot: true }), C, F], pilot: 'p', ai: 'off' });
    const K = st.byId.candle, T = st.byId.f, hp0 = T.body.hp;
    for (let i = 0; i < 30 * 6; i++) { E.stepWorld(st, { fire: 1 }, DT, flat); expect(st.byId.p.lockOn).not.toBe('candle'); }
    expect(K.body.hp).toBe(20000);
    expect(T.body.hp).toBeLessThan(hp0);
  });
});
