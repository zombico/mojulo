// An operation's PROPS (frame-goal.js): things stood on the field for the level's scenes to move. Each raised over its
// place, asleep while hidden, nothing to hit; its place a spot of its id, each task's place the spot t<n>; and the
// world's scenes reach a frame level, which has no walk.
import { describe, expect, it } from 'vitest';
import { readOperation, operationCast, PROP } from './frame-goal.js';
import { GROUND_PROP_IDS, GROUND_UNIT_IDS } from '../groundforce/index.js';
import { readGameworld } from './world.js';

const ends = { spawn: [0, 0, 0], heading: Math.PI / 2, ground: (x) => x / 100, frame: { half: 500, centre: [0, 0], gravity: 2.47, bound: [-500, -500, 500, 500] } };
const prop = GROUND_PROP_IDS[0];
const OP = { groups: [{ id: 'drones', kind: 'gnat', count: 2, at: [0, 0.5] }], tasks: [{ reach: [0, 0.2] }, { down: ['drones'] }], props: [{ id: 'pod', unit: prop, at: [0.4, 0], raise: 300, hidden: true }] };

describe('an operation\'s props', () => {
  it('stands each raised over its place, asleep and unhit, and gives the scenes its place and the tasks\' as spots', () => {
    const X = operationCast(readOperation(OP), ends), P = X.entities.find((e) => e.id === 'pod');
    expect(P.dormant).toBe(true);
    expect(P.rule).toBeUndefined();                                 // (no mind: a thing, not a foe)
    expect(P.body).toMatchObject({ figure: `prop-${prop}`, hittable: false });
    expect(P.transform.pos).toEqual([200, 0, 302]);
    expect(X.figures[`prop-${prop}`]).toEqual({ unit: { kind: prop, form: true } });
    expect(X.play.spots.map((s) => [s.id, s.at])).toEqual([['t1', [0, 100, 0]], ['pod', [200, 0, 2]]]);
    // (an operation with none stands no spots: as it was)
    expect(operationCast(readOperation({ ...OP, props: undefined }), ends).play).toBeUndefined();
  });

  it('a mark is a named place on the field, a spot of its name for the scenes', () => {
    const X = operationCast(readOperation({ ...OP, props: undefined, marks: { post: [-0.2, 0.1] } }), ends);
    expect(X.play.spots).toContainEqual({ id: 'post', at: [-100, 50, -1] });
    expect(() => readOperation({ ...OP, marks: { t3: [0, 0] } })).toThrow(/not a task's/);
  });

  it('a prop is no foe a stage fields; one it cannot read is refused, teaching', () => {
    expect(GROUND_UNIT_IDS).not.toContain(prop);
    expect(() => readOperation({ ...OP, props: [{ id: 'drones', unit: prop, at: [0, 0] }] })).toThrow(/not a group's/);
    expect(() => readOperation({ ...OP, props: [{ id: 't2', unit: prop, at: [0, 0] }] })).toThrow(/a task's/);
    expect(() => readOperation({ ...OP, props: [{ id: 'pod', unit: 'piano', at: [0, 0] }] })).toThrow(/card it is drawn as/);
    expect(() => readOperation({ ...OP, props: [{ id: 'pod', unit: prop, at: [0, 0], raise: PROP.raise + 1 }] })).toThrow(/raise is metres/);
  });

  it('a level with no walk keeps its scenes', () => {
    const W = readGameworld({ id: 'w', name: 'W', levels: { field: { airspace: { map: { form: 'plain', field: 900, craft: 'jet' }, frame: { build: 'vanguard' } }, goal: { operation: OP }, scenes: [{ id: 'drop', when: { on: 'objective:done' }, beats: [{ do: { glide: { who: 'pod', to: 'pod', seconds: 4 } } }] }] } } });
    expect(W.scenes.field.map((s) => s.id)).toEqual(['drop']);
  });
});
