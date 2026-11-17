// The screen as a measure (side-map/screen.js). The concepts: a screen's height is the lens's at the camera's distance and
// its width the frame's aspect of it; the side map's camera holds a hero at the frame's share whatever its stature, the
// lane's top at its place down the frame; a distance reads in screens along a run or up a climb; a bad word is refused.
import { describe, it, expect } from 'vitest';
import { SIDE_MAP_FRAME, screenOf, heroShare, sideMapCamera, inScreens } from './screen.js';

describe('the screen as a measure', () => {
  it('a screen is the lens at the camera\'s distance, the frame\'s aspect wide', () => {
    const S = screenOf({ dist: 11 });
    expect(S.height).toBeCloseTo(2 * 11 * Math.tan((SIDE_MAP_FRAME.vfov * Math.PI) / 360), 2);
    expect(S.width / S.height).toBeCloseTo(16 / 9, 2);
    expect(screenOf({ dist: 22 }).height).toBeCloseTo(2 * S.height, 2);
  });
  it('the side map\'s camera holds any hero at the frame\'s share: a taller hero, a camera further back', () => {
    for (const stature of [1.0, 1.67]) {
      const C = sideMapCamera(stature);
      expect(heroShare(stature, C)).toBeCloseTo(SIDE_MAP_FRAME.heroShare, 2);
      expect(C.screen.height).toBeCloseTo(stature * 8, 1);
    }
    expect(sideMapCamera(1.67).dist).toBeGreaterThan(sideMapCamera(1.0).dist);
  });
  it('looks over the hero\'s feet so the lane meets the frame two thirds down', () => {
    const C = sideMapCamera(1.6);
    // (the frame's middle over the lane by (laneDown - 1/2) of a screen)
    expect(C.lookH / C.screen.height).toBeCloseTo(SIDE_MAP_FRAME.laneDown - 0.5, 2);
  });
  it('reads a distance in screens: along a run by the width, up a climb by the height', () => {
    const S = sideMapCamera(1.6).screen;
    expect(inScreens(S.width * 5, S)).toBeCloseTo(5, 3);
    expect(inScreens(S.height * 2.5, S, 'height')).toBeCloseTo(2.5, 3);
  });
  it('refuses a measure that is no positive number', () => {
    expect(() => screenOf({ dist: 0 })).toThrow(/dist is a positive number/);
    expect(() => sideMapCamera(-1)).toThrow(/stature is a positive number/);
  });
});
