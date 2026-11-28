// THE PATROL SHIP over a frame's field (frame-goal.js SHIP): read into two groups of its own, its pods and its guns;
// lowered to a hull hanging over the field with its parts riding on it (rules-frame.js frame-ship, frame-perch), its
// guns shielded until the task that downs them begins, then rebuilt unless all are down together; its pods all down,
// it sinks, listing; its bar the sum of its parts'; the pilot's lock never takes the hull.
import { describe, expect, it } from 'vitest';
import { composeLive } from '../worlds/controllable/compose.js';
import { frameEntity } from '../assault-frame/pilot.js';
import { readOperation, operationCast, operationMechanics, SHIP, OPERATION } from './frame-goal.js';
import { PATROL_PODS } from '../groundforce/index.js';

const E = composeLive();
const DT = 1 / 30;
const flat = { ground: () => 0 };
const ends = { spawn: [0, 0, 0], heading: Math.PI / 2, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
const OP = { ship: { id: 'patrol', at: [0, 0.4], guns: 4, comes: 2 }, groups: [{ id: 'w', kind: 'gnat', at: [0.5, 0.5] }], tasks: [{ down: ['w'] }, { down: ['patrol-pods'] }, { down: ['patrol-guns'] }] };

describe('the patrol ship', () => {
  it('reads into its two groups and lowers its steps: the hull comes with its task, the guns exposed and rebuilt by theirs', () => {
    const op = readOperation(OP);
    expect(op.groups.map((g) => g.id)).toEqual(['w', 'patrol-pods', 'patrol-guns']);
    expect(op.groups[1]).toMatchObject({ kind: 'patrol-pod', count: PATROL_PODS.length, comes: 2 });
    const [obj] = operationMechanics(op, ends);
    expect(obj.tasks[1].ops).toEqual(expect.arrayContaining([{ op: 'spawn', who: 'patrol', fresh: true }]));
    expect(obj.tasks[2].regen).toBe(SHIP.regen);
    expect(obj.tasks[2].ops.filter((o) => o.op === 'expose').map((o) => o.who)).toEqual(['patrol-gun-1', 'patrol-gun-2', 'patrol-gun-3', 'patrol-gun-4']);
    expect(() => readOperation({ ...OP, ship: { ...OP.ship, guns: 99 } })).toThrow(/guns is 1 to/);
    expect(() => readOperation({ ...OP, ship: { ...OP.ship, id: 'w' } })).toThrow(/not a group's/);
  });

  it('hangs over the field with its parts riding on it; its pods all down, it sinks, listing; its bar is its parts\'', () => {
    const op = readOperation(OP), cast = operationCast(op, ends);
    for (const e of cast.entities) if (e.dormant) delete e.dormant;
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, -300, 0], pilot: true }), ...cast.entities], pilot: 'p', ai: 'off' });
    const H = st.byId.patrol, pod = st.byId['patrol-pod-1'], gun = st.byId['patrol-gun-1'];
    for (let i = 0; i < 30; i++) E.stepWorld(st, {}, DT, flat);
    expect(Math.abs(H.transform.pos[2] - SHIP.alt)).toBeLessThan(SHIP.bob + 0.01);
    const off = (q) => Math.hypot(q.transform.pos[0] - H.transform.pos[0], q.transform.pos[1] - H.transform.pos[1]);
    const o0 = off(pod);
    // (moved: its parts go with it)
    H.transform.pos[0] += 40; E.stepWorld(st, {}, DT, flat);
    expect(off(pod)).toBeCloseTo(o0, 3);
    const max = PATROL_PODS.length * OPERATION.units['patrol-pod'].hp + 4 * OPERATION.units['patrol-gun'].hp;
    expect(H.body.hpMax).toBe(max);
    // (its pods down: it sinks to its sink, listing)
    for (let k = 1; k <= PATROL_PODS.length; k++) { const q = st.byId[`patrol-pod-${k}`]; q.body.hp = 0; q.downed = true; }
    for (let i = 0; i < 30 * (SHIP.fall + 1); i++) E.stepWorld(st, {}, DT, flat);
    expect(H.crippled).toBe(true);
    expect(Math.abs(H.transform.pos[2] - SHIP.alt * SHIP.sink)).toBeLessThan(SHIP.bob + 0.01);
    expect(H.transform.roll).toBeLessThan(0);
    expect(H.body.hp).toBeLessThan(max);
    expect(gun.invincible).toBe(true);
  });

  it('its guns take no harm until exposed; the pilot\'s lock never takes the hull', () => {
    const op = readOperation(OP), cast = operationCast(op, ends);
    for (const e of cast.entities) if (e.dormant) delete e.dormant;
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, -40, 0], heading: Math.PI / 2, pilot: true }), ...cast.entities], pilot: 'p', ai: 'off' });
    const G = st.byId['patrol-gun-5'] ?? st.byId['patrol-gun-1'];
    for (let i = 0; i < 30 * 4; i++) { E.stepWorld(st, { fire: 1 }, DT, flat); expect(st.byId.p.lockOn).not.toBe('patrol'); }
    expect(G.body.hp).toBe(G.body.hpMax);
    E.castOps(st, [{ op: 'expose', who: G.id }]);
    expect(G.invincible).toBe(false);
  });
});
