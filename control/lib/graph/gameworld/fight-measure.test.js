// THE FIGHT MEASURED for a world (fight-measure.js): its sideways maps read off the world, the decisive cases run.
import { describe, it, expect } from 'vitest';
import { fightMeasured } from './fight-measure.js';

// one short map (a way in, one held screen), so the measure is quick
const level = { kind: 'greybox', preset: 'street', belt: { screens: [{ length: 10 }, { length: 12, gate: true }] } };
const easy = [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }], wall = [{ screen: 1, crowd: [{ type: 'heavy', n: 6 }, { type: 'knife', n: 6 }] }];

describe('a world\'s fight, measured', () => {
  it('a world with no sideways map has none', () => {
    expect(fightMeasured({ id: 'w', levels: { a: {} } })).toBeNull();
    expect(fightMeasured({ id: 'w', quick: { goal: 'reach' } })).toBeNull();
  });
  it('a quick brawl\'s streets: a fair one loses no law, a crowd too many is said with the wave it names', () => {
    const M = fightMeasured({ id: 'w', quick: { goal: 'brawl', streets: [{ id: 'fair', level, waves: easy, things: [] }, { id: 'wall', level, waves: wall, things: [] }] } });
    expect(M.maps.map((m) => [m.id, m.play])).toEqual([['fair', 'brawl'], ['wall', 'brawl']]);
    expect(M.maps[0].lost).toEqual([]);
    expect(M.maps[0].runs.map((r) => `${r.bot}/${r.tier}`)).toEqual(['masher/easy', 'careful/medium']);
    expect(M.maps[1].lost.length).toBeGreaterThan(0);
    expect(M.worst).toMatchObject({ map: 'wall' });
    expect(M.worst.advice).toMatch(/screen 2/);
    expect(M.lost).toBe(M.maps[1].lost.length);
  });
  it('a composed world\'s sideways level, played as it says', () => {
    const M = fightMeasured({ id: 'w', levels: { dock: { name: 'Dock', sideways: { ground: level, play: 'gun', waves: [{ screen: 1, crowd: [{ type: 'rifleman', n: 1 }] }], things: [] } }, town: {} } });
    expect(M.maps).toHaveLength(1);
    expect(M.maps[0]).toMatchObject({ id: 'dock', name: 'Dock', play: 'gun', lost: [] });
  });
});
