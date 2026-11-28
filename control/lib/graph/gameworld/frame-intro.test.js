// A FOE'S INTRO (frame-goal.js `intro`): a short scene the first time a group comes, on its down task's beginning (or the
// level's start for a group awake from it): the camera pushed in on its members, its name as a banner, a line said
// over it where one is written. A scene as any other (playscape/ui/scenes.js reads it; Esc skips it).
import { describe, expect, it } from 'vitest';
import { readOperation, operationCast, FOE_INTRO } from './frame-goal.js';
import { readScenes } from '../playscape/ui/scenes.js';

const ends = { spawn: [0, 0, 0], heading: 0, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
const OP = { groups: [{ id: 'scout', kind: 'gnat', at: [0.5, 0], intro: true }, { id: 'pair', kind: 'gnat', count: 2, at: [0, 0.5], intro: { title: 'Rock Hydra drones', who: 'cole', line: 'Two of them.' } }, { id: 'quiet', kind: 'gnat', at: [0.5, 0.5] }],
  tasks: [{ reach: [0.2, 0] }, { down: ['scout'] }, { down: ['pair', 'quiet'] }] };

describe('a foe\'s intro', () => {
  it('plays as its group first comes: pushed in on its members, its name a banner, a line where one is written', () => {
    const S = operationCast(readOperation(OP), ends).play.scenes;
    expect(S.map((s) => [s.id, s.when.match.task])).toEqual([['intro-scout', 't2'], ['intro-pair', 't3']]);
    expect(S[0].beats[0].shot).toMatchObject({ on: ['scout'], move: 'push' });
    expect(S[0].beats[1].do).toEqual({ say: 'GNAT DRONE', as: 'banner', ttl: FOE_INTRO.banner });
    expect(S[0].beats[2]).toEqual({ wait: FOE_INTRO.hold });
    expect(S[1].beats[0].shot.on).toEqual(['pair-1', 'pair-2']);
    expect(S[1].beats[1].do.say).toBe('Rock Hydra drones');                 // (a title written is kept as written)
    expect(S[1].beats[2]).toEqual({ line: { who: 'cole', say: 'Two of them.' } });
    expect(() => readScenes({ scenes: S })).not.toThrow();
    // (none asked: no scene)
    expect(operationCast(readOperation({ ...OP, groups: OP.groups.map(({ intro, ...g }) => g) }), ends).play).toBeUndefined();
  });

  it('a group awake from the start is introduced as the level starts; one it cannot read is refused', () => {
    const S = operationCast(readOperation({ groups: [{ id: 'g', kind: 'tank', at: [0, 0.4], intro: true }], tasks: [{ hold: 10 }] }), ends).play.scenes;
    expect(S[0].when).toEqual({ start: true });
    expect(() => readOperation({ ...OP, groups: [{ id: 'g', kind: 'gnat', at: [0, 0], intro: { line: 'x' } }] })).toThrow(/a line needs its who/);
  });
});
