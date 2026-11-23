import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// THE ALARM (alarm.js): a glimpse is a threat detected; a sure sighting is radioed in, and the call takes seconds, so a
// guard put down first never makes it; once it is through the threat is found, the whole team has the last known place
// and backup comes; it dies down only while no watcher sees the intruder.

const E = composeLive();
const hooks = { ground: () => 0 };
const ALARM = { confirm: 0.3, radio: 0.5, found: 1, detected: 1, every: 0.5, sweep: 3, backup: ['b'], from: [30, 0, 0] };
const WALL = { min: [3, -4, 0], max: [3.4, 4, 3] };
// a guard at the origin looking +x at the intruder 6 m off; a second guard far off looking away; a backup body asleep
const guard = (id, pos, heading, more = {}) => ({ id, team: 'guards', rule: { type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, speed: 0, sightRange: 14, sightCone: 0.6, eye: 0, collideHeight: 1.8, guardRadius: 0.1, alarm: ALARM, ...more }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos, heading } });
const world = ({ wall = false } = {}) => E.createWorld({
  ...(wall ? { colliders: [WALL] } : {}),
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [6, 0, 0], heading: Math.PI } },
    guard('g', [0, 0, 0], 0), guard('g2', [0, 40, 0], Math.PI / 2), guard('b', [30, 0, 0], Math.PI),
  ],
});
const run = (w, s) => { for (let k = 0; k < Math.round(s * 60); k++) E.stepWorld(w, {}, 1 / 60, hooks); return w.alarm.guards; };
const hide = (w, on) => { w.colliders = on ? [WALL] : []; };

describe('the alarm', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithAlarm');
    expect(emissionSource({ alarm: true })).toContain('stepWithAlarm');
  });
  it('a glimpse is a threat detected, no call; with nothing new it stands down', () => {
    const w = world({ wall: true }); run(w, 0.1);
    expect(w.byId.b).toMatchObject({ dormant: true, gone: true });   // (backup is out of the world until sent)
    hide(w, false); run(w, 0.15); hide(w, true);
    const S = run(w, 0.1);
    expect(S).toMatchObject({ phase: 'detected', cause: 'glimpse', call: null });
    expect(run(w, 1.2).phase).toBe('clear');
  });
  it('a sure sighting is radioed in: found once the call is through, the whole team has the place, backup is sent', () => {
    const w = world(); run(w, 0.4);
    expect(w.alarm.guards.call).toMatchObject({ by: 'g' });
    expect(w.alarm.guards.phase).toBe('detected');
    const S = run(w, 0.6);
    expect(S).toMatchObject({ phase: 'found', calls: 1, backup: true });
    expect(w.byId.g2.lastSeen.pos[0]).toBeCloseTo(6, 0);                  // (the far guard was told)
    expect(w.byId.b.dormant || w.byId.b.gone).toBeFalsy();
    expect(w.byId.b.transform.pos[0]).toBeCloseTo(30, 0);
  });
  it('the caller put down before the call is through: no call is made', () => {
    const w = world(); run(w, 0.4);
    w.byId.g.downed = true; w.byId.g.body.hp = 0;
    const S = run(w, 1);
    expect(S.phase).not.toBe('found');
    expect(S.downs).toBe(1);
    expect(w.byId.b.dormant).toBe(true);
  });
  it('a caller inside a chaff cloud gets nothing through while it is jammed; out of it, the call goes', () => {
    const w = world();
    // (a chaff's cloud round the guards, combat-ranged.js state.jams, for two seconds)
    w.jams = [{ at: [10, 0, 0], r: 15, t0: 0, until: 2 }];
    run(w, 1.5);
    expect(w.alarm.guards.phase).toBe('detected');
    expect(w.alarm.guards.calls).toBe(0);
    expect(w.alarm.guards.jammed).toBeGreaterThan(0.5);
    run(w, 1.5);
    expect(w.alarm.guards.calls).toBe(1);
    expect(w.alarm.guards.phase).toBe('found');
  });
  it('found dies down only while no one sees: in sight its clock is full; hidden, it runs to detected, then clear, and backup leaves', () => {
    const w = world(); run(w, 1.1);
    expect(w.alarm.guards.phase).toBe('found');
    run(w, 1);
    expect(w.alarm.guards.left).toBeCloseTo(1, 1);                        // (still seen: full)
    hide(w, true); run(w, 0.5);
    expect(w.alarm.guards.left).toBeLessThan(0.7);
    expect(run(w, 0.7).phase).toBe('detected');
    expect(run(w, 1.2).phase).toBe('clear');
    expect(w.byId.b).toMatchObject({ dormant: true, gone: true });
  });
  it('a body found is a threat detected', () => {
    const w = world({ wall: true }); run(w, 0.1);
    w.byId.g2.transform.pos = [8, 1, 0]; w.byId.g2.downed = true; w.byId.g2.body.hp = 0;
    hide(w, false); w.byId.p.transform.pos = [-6, 0, 0];
    expect(run(w, 0.1)).toMatchObject({ phase: 'detected', cause: 'body' });
  });
  it('a body behind a wall is not found', () => {
    const w = world({ wall: true }); run(w, 0.1);
    w.byId.g2.transform.pos = [8, 1, 0]; w.byId.g2.downed = true; w.byId.g2.body.hp = 0;
    w.byId.p.transform.pos = [-6, 0, 0];
    expect(run(w, 0.5).phase).toBe('clear');
    expect(w.byId.g2.alarmFound).toBeFalsy();
  });
  it('the bus hears its turns: detected, the call, found, backup, the sweeps, and back down to clear', () => {
    const w = world();
    let prev = E.castFacts(w, null).prev; const heard = [];
    const tick = (s) => { for (let k = 0; k < Math.round(s * 60); k++) { E.stepWorld(w, {}, 1 / 60, hooks); const F = E.castFacts(w, prev); prev = F.prev; for (const e of F.events) if (e.type.startsWith('alarm:')) heard.push(e.type); } };
    tick(1.2); hide(w, true); tick(3.5);
    expect(heard.slice(0, 5)).toEqual(['alarm:detected', 'alarm:spotted', 'alarm:call', 'alarm:found', 'alarm:backup']);
    expect(heard.filter((t) => t === 'alarm:spotted')).toHaveLength(1);   // (once an alarm, however often it is seen)
    expect(heard).toContain('alarm:sweep');
    expect(heard.slice(-1)).toEqual(['alarm:clear']);
  });

  it('a world without an alarm keeps none', () => {
    const w = E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform' }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    E.stepWorld(w, {}, 1 / 60, hooks);
    expect(w.alarm).toBeUndefined();
  });
});
