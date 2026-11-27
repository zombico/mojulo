// THE CITADEL'S LOCKS (battles.js citadelLocks): a walled core's gated doors on a building, laid as locks across its
// route, each on the last doorway between its guard and what lies past it (the next pack, or the boss), its key carried
// by that guard; a door with no doorway there is not laid, never a lock whose key lies past it
import { describe, it, expect } from 'vitest';
import { citadelLocks } from './battles.js';

const W = { wcd: { core: 'c', spaces: { a: { level: 'L' }, b: { level: 'L' }, c: { level: 'L' } }, doors: [{ from: 'a', to: 'b', gate: { clearance: 1 } }, { from: 'b', to: 'c', gate: { clearance: 2 } }] } };
const stage = { section: 'building', level: 'L' };
// (a straight route along x: the way in at 0, doorways at 10, 20, 30, the goal at 40, the walker's eye at 1.7)
const ends = { spawn: [0, 0, 0], exit: [40, 0, 1.7], via: [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]] };
const pack = (id, x) => ({ id, foes: ['slime'], at: [x, 1] });
const bossAt = { id: 'pack-9', foes: ['drake'], at: [38, 0], flee: false };

describe('the citadel\'s locks', () => {
  it('each door after a guard, on the last doorway before what lies past it, its key that guard\'s', () => {
    const L = citadelLocks(W, stage, ends, [pack('pack-1', 5), pack('pack-2', 25), bossAt]);
    expect(L.mechanics.map((m) => [m.id, m.at[0], m.back[0], m.key])).toEqual([['b', 20, 10, 'b-key'], ['c', 30, 20, 'c-key']]);
    expect(L.mechanics[0].at[2]).toBe(1.7);
    expect(L.cues.map((c) => [c.when.on, c.then[0].give])).toEqual([['rpg-won:pack-1', 'b-key'], ['rpg-won:pack-2', 'c-key']]);
    expect(L.items['b-key']).toEqual({ name: 'B Key', kind: 'key' });
  });

  it('a door with no doorway between its guard and what follows is not laid; none, no locks', () => {
    // (the second guard past the last doorway: only the first door is laid)
    expect(citadelLocks(W, stage, ends, [pack('pack-1', 5), pack('pack-2', 35), bossAt]).mechanics.map((m) => m.id)).toEqual(['b']);
    expect(citadelLocks(W, stage, ends, [pack('pack-1', 35), bossAt])).toBeNull();
    expect(citadelLocks({}, stage, ends, [pack('pack-1', 5)])).toBeNull();
    expect(citadelLocks(W, { ...stage, section: 'trail' }, ends, [pack('pack-1', 5)])).toBeNull();
  });
});
