// The clock dial (clock-dial.js) is the page's own night and season, held equal to the text the World page emits
// (scene/channels/weather.js): its night() is lifted out of the emitted script and run against the twin.
import { describe, it, expect } from 'vitest';
import { nightAt, nightLook, seasonOf } from './clock-dial.js';
import { weatherScript } from '../scene/channels/weather.js';
import { readWeather } from './weather.js';

describe('the clock dial', () => {
  it('is the page\'s night, minute for minute', () => {
    const page = weatherScript({ weather: readWeather({ climate: 'temperate' }), seed: 1, clock: true, radius: 40 });
    const m = /const night = \(\) => \{([\s\S]*?)\n  \};/.exec(page);
    expect(m).toBeTruthy();
    const smooth = (u) => u * u * (3 - 2 * u);
    // eslint-disable-next-line no-new-func
    const pageNight = (minute) => new Function('window', 'smooth', m[1])({ __mojBus: { state: { vars: { minute } } } }, smooth);
    for (let mi = 0; mi < 1440; mi += 7) expect(nightAt(mi), `minute ${mi}`).toBe(pageNight(mi));
    expect(nightAt(undefined)).toBe(0);
    expect([nightAt(0), nightAt(12 * 60), nightAt(19 * 60)]).toEqual([1, 0, 0.5]);
  });
  it('darkens a state toward 0.78 and takes three quarters of its sky at full night', () => {
    expect(nightLook({ dim: 0.1, sky: 1 }, 1)).toEqual({ dim: 0.78, sky: 0.25 });
    expect(nightLook({ dim: 0.1, sky: 1 }, 0)).toEqual({ dim: 0.1, sky: 1 });
    expect([seasonOf({ season: 2 }), seasonOf({})]).toEqual([2, 0]);
  });
});
