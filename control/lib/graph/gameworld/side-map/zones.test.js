// The zone chain (side-map/zones.js): a side map written as words. The concepts: a chain of runs and rooms reads, each
// zone a run (an axis and a length in screens) or a room (its size), never both; an up run is climbed (a chimney unsaid)
// and a down run dropped (a cascade unsaid, a chute a commit); what teaches is the first level's word, what does not a
// beat; a word in the wrong place or unknown is refused, saying what it takes; and the words are the cube's.
import { describe, it, expect } from 'vitest';
import { readSideMap, CLIMBS, BEATS } from './zones.js';
import { FILL_IDS } from './fills.js';
import { capabilityRegistry } from '../../cosmos/registry.js';

const MAP = { premise: 'a plant built inside a mountain: the hero climbs it to stop what it makes', fill: 'rock', zones: [
  { run: 'across', screens: 5, teach: 'basic', place: 'gate tunnel' },
  { run: 'down', screens: 2, drop: 'cascade' },
  { run: 'across', screens: 4, teach: 'gauntlet', place: 'factory floor', spawners: 3, fill: 'machine' },
  { run: 'up', screens: 2.5, teach: 'advanced', rises: true },
  { run: 'across', screens: 3, beat: 'landing', reveal: true },
  { run: 'down', screens: 2.5, drop: 'chute' },
  { room: [1, 1], teach: 'boss' },
] };

describe('the zone chain', () => {
  it('reads a chain of runs and rooms, each zone its own words', () => {
    const M = readSideMap(MAP);
    expect(M.zones.map((z) => z.kind)).toEqual(['run', 'run', 'run', 'run', 'run', 'run', 'room']);
    expect(M.zones[2]).toMatchObject({ run: 'across', screens: 4, teach: 'gauntlet', spawners: 3, fill: 'machine' });
    expect(M.zones[6]).toEqual({ kind: 'room', room: [1, 1], teach: 'boss' });
    expect(M).toMatchObject({ premise: MAP.premise, fill: 'rock' });
  });
  it('an up run is climbed, a chimney unsaid; a down run is dropped, a cascade unsaid, a chute a commit', () => {
    const M = readSideMap(MAP);
    expect(M.zones[3]).toMatchObject({ climb: 'chimney', rises: true });
    expect(M.zones[1].drop).toBe('cascade');
    expect(M.zones[5]).toMatchObject({ drop: 'chute', beat: 'commit' });
    expect(Object.keys(CLIMBS)).toContain(readSideMap({ zones: [{ run: 'up', screens: 1, climb: 'ladder' }] }).zones[0].climb);
  });
  it('refuses what is not a zone, saying what it takes', () => {
    const one = (z) => () => readSideMap({ zones: [z] });
    expect(one({ run: 'across', screens: 2, room: [1, 1] })).toThrow(/a run .* or a room .* one of them/);
    expect(one({ run: 'across', screens: 0.5 })).toThrow(/at least one/);
    expect(one({ run: 'sideways', screens: 2 })).toThrow(/across \| up \| down/);
    expect(one({ run: 'across', screens: 2, climb: 'chimney' })).toThrow(/an up run's word/);
    expect(one({ run: 'up', screens: 2, drop: 'chute' })).toThrow(/a down run's word/);
    expect(one({ run: 'up', screens: 2, teach: 'advanced', beat: 'rest' })).toThrow(/not both/);
    expect(one({ run: 'across', screens: 2, beat: 'nap' })).toThrow(new RegExp(Object.keys(BEATS)[0]));
    expect(one({ run: 'across', screens: 2, fill: 'lava' })).toThrow(new RegExp(FILL_IDS.join(' \\| ')));
    expect(one({ run: 'across', screens: 2, depth: 3 })).toThrow(/not a zone's word/);
    expect(() => readSideMap({ zones: [] })).toThrow(/at least one/);
  });
  it('its words are the cube\'s: the form a level form of space, its fills reality\'s', () => {
    const reg = capabilityRegistry();
    expect(reg.space.levelForm.values['side-map']).toMatchObject({ lowers: 'lib/graph/gameworld/side-map/scene.js', requires: ['space.camera=side', 'power.rules=platform'] });
    expect(Object.keys(reg.reality.fill.values)).toEqual(['none', ...FILL_IDS]);
    expect(reg.reality.fill.values.none.status).toBe('built');
  });
});
