// The side map's bot (side-map/bot.js), the machine gate's player, on the rule Galaxy Boy's game ships. The concepts: it
// plays the run and gun's first level to its end without a fall, and says the chimney's kicks, the least its feet stood
// over the rising frame's bottom, and the time; a stage climbed by each climb form (from the climb table) under a rising
// frame is played to its end; a frame that rises faster than the hero climbs costs it a life, and the bot says so; the
// same map plays the same way.
import { describe, it, expect } from 'vitest';
import { playSideMap } from './bot.js';
import { layoutSideMap } from './layout.js';
import { firstSideMap } from './first.js';
import { CLIMBS } from './zones.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true })), STATURE = 1.67;
const lay = (map) => layoutSideMap(map, { reach, stature: STATURE });
const stage = (climb) => ({ zones: [{ run: 'across', screens: 1 }, { run: 'up', screens: 2, climb, rises: true }, { run: 'across', screens: 1 }, { run: 'down', screens: 2, drop: 'chute' }, { run: 'across', screens: 2, pillars: 3 }, { room: [1, 1], teach: 'boss' }] });

describe('the side map\'s bot', () => {
  it('plays the run and gun\'s first level to its end without a fall, and says what the climb took', () => {
    const L = lay(firstSideMap()), R = playSideMap(L, reach, { stature: STATURE });
    expect(R.done).toBe(true);
    expect(R.falls).toBe(0);
    const [C] = R.climbs;
    expect(C.climb).toBe('chimney');
    expect(C.kicks).toBeGreaterThan(2);
    expect(C.margin).toBeGreaterThan(0);
    const length = L.zones.at(-1).rect[1] - L.zones[0].rect[0];
    expect(R.time).toBeGreaterThan(length / reach.speed);
  });
  it('plays a stage climbed by each climb form under a rising frame to its end', () => {
    for (const climb of Object.keys(CLIMBS)) {
      const R = playSideMap(lay(stage(climb)), reach, { stature: STATURE, seconds: 120 });
      expect({ climb, done: R.done, falls: R.falls }).toEqual({ climb, done: true, falls: 0 });
    }
  });
  it('a frame rising faster than the hero climbs costs it a life, and the bot says so', () => {
    const L = lay(stage('chimney'));
    L.rises[0].pace *= 4;
    const R = playSideMap(L, reach, { stature: STATURE, seconds: 40 });
    expect(R.falls).toBeGreaterThan(0);
  });
  it('the same map plays the same way', () => {
    const L = lay(stage('ladder'));
    expect(JSON.stringify(playSideMap(L, reach, { stature: STATURE, seconds: 60 }))).toBe(JSON.stringify(playSideMap(L, reach, { stature: STATURE, seconds: 60 })));
  });
});
