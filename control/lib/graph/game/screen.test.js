import { describe, it, expect } from 'vitest';
import { SCREENS, NEW_GAME_SCREEN, REACH, readScreen, screenFrame, screenPayload, fitScreen, payloadFrame } from './screen.js';
import { verticalFov } from '../scene/scene-three.js';

const hfov = (vfov, aspect) => 2 * Math.atan(Math.tan(vfov * Math.PI / 360) * aspect) * 180 / Math.PI;

describe('screen: the screen a game is made for', () => {
  it('reads each pole to its frame, a phone upright and the others on their side', () => {
    expect(readScreen('phone')).toEqual({ pole: 'phone', aspect: [9, 16], orientation: 'portrait' });
    expect(readScreen('tablet')).toEqual({ pole: 'tablet', aspect: [4, 3], orientation: 'landscape' });
    expect(readScreen('screen')).toEqual({ pole: 'screen', aspect: [16, 9], orientation: 'landscape' });
    expect(SCREENS[NEW_GAME_SCREEN]).toBeTruthy();
  });

  it('turns a pole to the orientation asked for, and reads a custom aspect', () => {
    expect(readScreen({ pole: 'tablet', orientation: 'portrait' })).toEqual({ pole: 'tablet', aspect: [3, 4], orientation: 'portrait' });
    expect(readScreen({ pole: 'phone', orientation: 'landscape' }).aspect).toEqual([16, 9]);
    expect(readScreen({ aspect: [21, 9] })).toEqual({ pole: 'custom', aspect: [21, 9], orientation: 'landscape' });
    expect(readScreen({ aspect: [1, 1] }).orientation).toBe('landscape');
  });

  it('is absent when absent, and refuses a malformed screen loudly', () => {
    expect(readScreen(undefined)).toBe(null);
    expect(readScreen(null)).toBe(null);
    expect(() => readScreen('watch')).toThrow(/screen is one of phone/);
    expect(() => readScreen({ pole: 'phone', aspect: [9, 16] })).toThrow(/not both/);
    expect(() => readScreen({ aspect: [9] })).toThrow(/aspect is \[w, h\]/);
    expect(() => readScreen({ aspect: [10, 1] })).toThrow(/4:1/);
    expect(() => readScreen({ pole: 'phone', size: 3 })).toThrow(/size is not a screen setting/);
    expect(() => readScreen({ orientation: 'portrait' })).toThrow(/names a pole or an aspect/);
  });

  it('frames in whole pixels on the long side', () => {
    expect(screenFrame(readScreen('phone'), 1120)).toEqual({ width: 630, height: 1120 });
    expect(screenFrame(readScreen('screen'), 320)).toEqual({ width: 320, height: 180 });
    const P = screenPayload(readScreen('phone'));
    expect(payloadFrame(P, 320)).toEqual({ width: 180, height: 320 });
    expect(payloadFrame(screenPayload(readScreen('tablet')), 320)).toEqual({ width: 320, height: 240 });
  });

  it('holds the short axis: a portrait frame grown taller keeps its horizontal fov, up to the reach', () => {
    const P = screenPayload(readScreen('phone')), v0 = verticalFov(60, P.aspect);
    for (const device of [9 / 19.5, 9 / 16]) {
      const { shown, fovScale } = fitScreen(P, device);
      expect(shown).toBeCloseTo(device, 6);   // inside the reach: the whole device is drawn
      const v = 2 * Math.atan(Math.tan(v0 * Math.PI / 360) * fovScale) * 180 / Math.PI;
      expect(hfov(v, shown)).toBeCloseTo(60, 6);
    }
    // a monitor showing a phone game: barred at the sides, the frame as designed
    expect(fitScreen(P, 16 / 9)).toEqual({ shown: P.aspect, fovScale: 1 });
    // past the reach: barred above and below
    expect(fitScreen(P, 9 / 30).shown).toBeCloseTo(P.aspect / REACH, 3);
  });

  it('holds the short axis: a landscape frame grown wider keeps its vertical fov', () => {
    const P = screenPayload(readScreen('screen'));
    expect(fitScreen(P, 21 / 9)).toEqual({ shown: 21 / 9, fovScale: 1 });
    expect(fitScreen(P, 4 / 3)).toEqual({ shown: P.aspect, fovScale: 1 });   // a squarer device: bars above and below
  });
});
