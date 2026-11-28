// A SQUAD of frames (rules-frame.js squadPlan; a mind's `squad`, the cosmos mind facet's): a pack on the pilot from both
// sides, one pressing in and one keeping its range; team-aware, split one to each of the pilot's side; a mate that
// reels covered by the nearest, going in on whoever is over it.
import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { frameEntity } from '../../assault-frame/pilot.js';
import { readOperation, SQUAD_WAYS } from '../../gameworld/frame-goal.js';

const E = composeLive();
const DT = 1 / 30;
const flat = { ground: () => 0 };
const duo = (way) => [
  frameEntity('raptor', { id: 'hunter', at: [0, 300, 0], team: 'foes', mind: { range: 140, squad: { id: 'duo', way } } }),
  frameEntity('citadel', { id: 'brute', at: [60, 320, 0], team: 'foes', mind: { range: 140, squad: { id: 'duo', way } } }),
];
const field = (way) => E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), frameEntity('vanguard', { id: 'cole', at: [120, 0, 0], mind: { range: 140, ally: true, engage: 900 } }), ...duo(way)], pilot: 'p' });
const run = (st, n) => { for (let i = 0; i < n; i++) E.stepWorld(st, {}, DT, flat); return st; };

describe('a squad of frames', () => {
  it('pack: both on the pilot, from either side of it, one pressing and one keeping its range', () => {
    const st = run(field('pack'), 20), H = st.byId.hunter, B = st.byId.brute;
    expect([H.squadTarget, B.squadTarget]).toEqual(['p', 'p']);
    expect(new Set([H.squadRole, B.squadRole])).toEqual(new Set(['press', 'keep']));
    expect(H.frInput.strafe).toBe(-B.frInput.strafe);
  });

  it('team-aware: split, one to the pilot and one to its wingman', () => {
    const st = run(field('team-aware'), 20), H = st.byId.hunter, B = st.byId.brute;
    expect(new Set([H.squadTarget, B.squadTarget])).toEqual(new Set(['p', 'cole']));
  });

  it('a mate that reels is covered: the other turns on whoever is nearest it and goes in', () => {
    const st = run(field('team-aware'), 20), H = st.byId.hunter, B = st.byId.brute;
    // (the pilot right over the brute, the wingman far off: the brute broken)
    st.byId.p.transform.pos = [B.transform.pos[0], B.transform.pos[1] - 60, 0]; st.byId.cole.transform.pos = [-600, -600, 0];
    B.stagger = 2;
    run(st, 2);
    expect(H.squadRole).toBe('cover');
    expect(H.squadTarget).toBe('p');
    expect(H.frInput.boost).toBe(1);
  });

  it('a group names its squad in the facet\'s words, a frame\'s', () => {
    expect(SQUAD_WAYS).toEqual(['pack', 'team-aware']);
    const op = readOperation({ groups: [{ id: 'a', kind: 'frame', at: [0, 0.5], squad: { id: 'duo', way: 'pack' } }], tasks: [{ down: ['a'] }] });
    expect(op.groups[0].squad).toEqual({ id: 'duo', way: 'pack' });
    expect(() => readOperation({ groups: [{ id: 'a', kind: 'gnat', at: [0, 0.5], squad: { id: 'duo', way: 'pack' } }], tasks: [{ down: ['a'] }] })).toThrow(/squad is a frame's/);
    expect(() => readOperation({ groups: [{ id: 'a', kind: 'frame', at: [0, 0.5], squad: { id: 'duo', way: 'swarm' } }], tasks: [{ down: ['a'] }] })).toThrow(/squad is a frame's/);
  });
});
