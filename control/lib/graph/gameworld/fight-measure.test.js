// THE FIGHT MEASURED for a world (fight-measure.js): its streets read off the world, the decisive cases run.
import { describe, it, expect } from 'vitest';
import { fightMeasured } from './fight-measure.js';

// one short map (a way in, one held screen), so the measure is quick
const level = { kind: 'greybox', preset: 'street', belt: { screens: [{ length: 10 }, { length: 12, gate: true }] } };
const easy = [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }], wall = [{ screen: 1, crowd: [{ type: 'heavy', n: 6 }, { type: 'knife', n: 6 }] }];

describe('a world\'s fight, measured', () => {
  it('a world with no street has none', () => {
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
  it('a designed game\'s street level: its stops on its ground, read as its page reads it', () => {
    const ground = { kind: 'greybox', preset: 'street' };
    const M = fightMeasured({ id: 'w', levels: { dock: { name: 'Dock', street: { ground, stops: [{ wave: { grunt: 1 } }], lives: 3, things: [] } }, town: {} } });
    expect(M.maps).toHaveLength(1);
    expect(M.maps[0]).toMatchObject({ id: 'dock', name: 'Dock', play: 'brawl' });
    expect(M.maps[0].runs.map((r) => r.result)).toEqual(['won', 'won']);
    // (a run & gun's by its guns)
    const G = fightMeasured({ id: 'w', levels: { dock: { street: { ground, stops: [{ wave: { grunt: 1 } }], guns: true, things: [] } } } });
    expect(G.maps[0].play).toBe('gun');
  });
});
