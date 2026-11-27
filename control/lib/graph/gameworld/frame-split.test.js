// THE ENCOUNTER'S SCRIPT on a frame operation (frame-goal.js): a task's alarm (the enemy heard coming: a level cue), a
// group that comes with a task it is not that task's to down (`comes`), an ally that holds its post till a task begins
// (`hold: <n>`, the cast's `unhold`), and a SPLIT: an ally and a foe off the field together in a scene, the ally back
// alone on a later task. Each lowered onto what is there (game/objectives.js `ops`, the scenes, the cues).
import { describe, expect, it } from 'vitest';
import { readOperation, operationCast, operationMechanics, OP_ALARM, SPLIT } from './frame-goal.js';
import { readScenes } from '../playscape/ui/scenes.js';
import { readCues } from '../playscape/ui/cues.js';

const ends = { spawn: [0, 0, 0], heading: 0, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
const OP = {
  groups: [{ id: 'swarm', kind: 'gnat', count: 3, at: [0.4, 0.4] }, { id: 'heavy', kind: 'frame', mt: 'rhino', at: [0.2, 0.5] }, { id: 'quick', kind: 'frame', build: 'raptor', at: [0.3, 0.5], comes: 3 }],
  tasks: [{ reach: [0, 0.2] }, { down: ['swarm'], alarm: 'Enemy approach' }, { down: ['heavy'] }, { act: 'scene-end:after' }],
  allies: [{ id: 'cole', name: 'Cole', hold: 2 }],
  split: { ally: 'cole', foe: 'quick', at: 3, to: [0.8, 0.3], back: 4, title: 'Two frames', line: { who: 'cole', say: "The quick one's mine." } },
};

describe('the encounter\'s script', () => {
  it('a task\'s alarm: its words a banner as it begins, the alarm sounded, the screen flashed; a task without one, nothing', () => {
    const C = operationCast(readOperation(OP), ends).play.cues;
    expect(C).toEqual([{ id: 'alarm-t2', once: true, when: { on: 'objective:begin', match: { task: 't2' } }, then: { warning: { say: 'Enemy approach', title: OP_ALARM.title, ttl: OP_ALARM.ttl } } }]);
    expect(() => readCues({ cues: C })).not.toThrow();
    const { split, ...bare } = OP;
    expect(operationCast(readOperation({ ...bare, tasks: OP.tasks.map(({ alarm, ...t }) => t), allies: undefined, groups: OP.groups.map(({ comes, ...g }) => g) }), ends).play).toBeUndefined();
  });

  it('a group that comes with a task stands dormant till it begins and is woken then, not counted in it; an ally held till a task is let go as it begins', () => {
    const op = readOperation(OP), cast = operationCast(op, ends), [obj] = operationMechanics(op, ends);
    expect(cast.entities.find((e) => e.id === 'quick').dormant).toBe(true);
    expect(obj.tasks[2].foes).toEqual(['heavy']);
    expect(obj.tasks[2].ops).toEqual([{ op: 'spawn', who: 'quick', fresh: true }]);
    expect(obj.tasks[1].ops).toEqual([{ op: 'unhold', who: 'cole' }]);
    expect(cast.entities.find((e) => e.id === 'cole').rule.mind.hold).toBe(true);
    // (the ally back from the split as its back task begins: at where it went, let go)
    expect(obj.tasks[3].ops).toEqual([{ op: 'spawn', who: 'cole', at: [400, 150, 0] }, { op: 'unhold', who: 'cole' }]);
    expect(obj.tasks[0].ops).toBeUndefined();
  });

  it('a split: the foe\'s group shown, the ally and the foe in one frame, the line said, both off together and gone', () => {
    const cast = operationCast(readOperation(OP), ends), S = cast.play.scenes.find((s) => s.id === 'split-cole');
    expect(S.when).toEqual({ on: 'objective:begin', match: { task: 't3' } });
    expect(S.beats[0].shot).toMatchObject({ frame: 'wide', on: ['quick', 'heavy'], move: 'push' });
    expect(S.beats[1].do).toEqual({ say: 'Two frames', as: 'banner', ttl: SPLIT.banner });
    expect(S.beats[3].shot).toMatchObject({ frame: 'low', on: ['cole'] });                  // (the ally alone as it speaks)
    expect(S.beats[4]).toEqual({ line: { who: 'cole', say: "The quick one's mine." } });
    expect(S.beats[5].do).toEqual([{ walk: { who: 'cole', to: 'split-cole', speed: SPLIT.speed } }, { walk: { who: 'quick', to: 'split-cole', speed: SPLIT.speed } }]);
    expect(S.beats[6].shot).toMatchObject({ frame: 'wide', on: ['cole', 'quick'], move: 'track' });   // (the two as they go)
    expect(S.beats.at(-1).do).toEqual([{ vanish: 'cole' }, { vanish: 'quick' }]);
    expect(cast.play.spots.find((s) => s.id === 'split-cole').at).toEqual([400, 150, 0]);
    expect(() => readScenes({ scenes: cast.play.scenes, spots: cast.play.spots })).not.toThrow();
  });

  it('refuses what it cannot play, teaching', () => {
    expect(() => readOperation({ ...OP, split: { ...OP.split, foe: 'swarm' } })).toThrow(/a group of one/);
    expect(() => readOperation({ ...OP, split: { ...OP.split, ally: 'nobody' } })).toThrow(/one of the operation's allies/);
    expect(() => readOperation({ ...OP, split: { ...OP.split, back: 2 } })).toThrow(/after the split's/);
    expect(() => readOperation({ ...OP, groups: OP.groups.map((g) => (g.id === 'quick' ? { ...g, comes: 9 } : g)) })).toThrow(/comes with task 9, and there are 4/);
    expect(() => readOperation({ ...OP, allies: [{ id: 'cole', name: 'Cole', hold: 1 }] })).toThrow(/the number of the task it holds till/);
    expect(() => readOperation({ ...OP, tasks: [{ reach: [0, 0.2], alarm: 7 }, ...OP.tasks.slice(1)] })).toThrow(/alarm is the words on its banner/);
  });
});
