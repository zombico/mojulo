import { describe, it, expect } from 'vitest';
import { SWIPE, swipeOf } from './swipe.js';

describe('swipe: a flick read as a tap or a direction', () => {
  it('a quick touch that stays put is a tap; one held still is nothing', () => {
    expect(swipeOf(3, -2, 120)).toBe('tap');
    expect(swipeOf(0, 0, SWIPE.ms + 1)).toBe(null);
  });
  it('past the travel, quickly, it is the way it went most (screen y points down)', () => {
    expect(swipeOf(-40, 6, 150)).toBe('left');
    expect(swipeOf(40, -10, 150)).toBe('right');
    expect(swipeOf(5, -60, 150)).toBe('up');
    expect(swipeOf(-8, 50, 150)).toBe('down');
  });
  it('a slow drag, or one between the dead zone and the travel, is nothing', () => {
    expect(swipeOf(60, 0, SWIPE.ms + 50)).toBe(null);
    expect(swipeOf(SWIPE.dead + 2, 0, 100)).toBe(null);
  });
  it('its defaults are SWIPE\'s', () => {
    expect(swipeOf(SWIPE.dead - 0.1, 0, SWIPE.ms)).toBe('tap');
    expect(swipeOf(SWIPE.travel, 0, SWIPE.ms)).toBe('right');
    expect(swipeOf(SWIPE.travel - 0.1, 0, SWIPE.ms)).toBe(null);
  });
  it('takes its own thresholds, and the page copy is the same function', () => {
    expect(swipeOf(30, 0, 900, { ms: 1000 })).toBe('right');
    const copy = new Function(`return (${swipeOf.toString()})`)();
    for (const [dx, dy, ms] of [[3, 3, 100], [-40, 0, 100], [0, 70, 300], [60, 0, 900]]) expect(copy(dx, dy, ms)).toBe(swipeOf(dx, dy, ms));
  });
});
