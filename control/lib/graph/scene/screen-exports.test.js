// The screen a game is made for (game/screen.js), carried by its exports: the desktop window, the score's cameras.
// Absent, every export as it was.
import { describe, it, expect } from 'vitest';
import { desktopWindow, desktopMainJs } from '../game/desktop-shell.js';
import { levelCameras } from './scene-gltf-level.js';

describe('the screen in the exports', () => {
  it('the desktop window: the frame fitted inside 1280×800; without one, 1280×800 as it was', () => {
    expect(desktopWindow(null)).toEqual({ width: 1280, height: 800 });
    expect(desktopWindow('phone')).toEqual({ width: 450, height: 800 });
    expect(desktopWindow('screen')).toEqual({ width: 1280, height: 720 });
    expect(desktopWindow({ pole: 'tablet', orientation: 'portrait' })).toEqual({ width: 600, height: 800 });
    const app = { title: 'Coin Run', ref: 'g' };
    expect(desktopMainJs({ ...app, screen: 'phone' })).toContain('width: 450,\n    height: 800,');
    expect(desktopMainJs(app)).toContain('width: 1280,\n    height: 800,');
  });

  it('the score\'s cameras: the frame\'s own vertical fov when the screen names one; absent, the solve as it was', () => {
    const cams = [{ worldFraming: { cameraPosition: [0, -10, 2], lookAt: [0, 0, 1], horizontalFov: 75 } }];
    const plain = levelCameras({ cameras: cams, viewBox: { width: 630, height: 1120 } })[0];
    const named = levelCameras({ cameras: cams, viewBox: { width: 630, height: 1120 }, screen: { aspect: 0.5625, portrait: true, reach: 1.3333, v0: 66 } })[0];
    expect(plain.yfov).toBeCloseTo(2 * Math.atan(Math.tan((75 * Math.PI) / 360) / 0.5625), 9);
    expect(named.yfov).toBeCloseTo((66 * Math.PI) / 180, 9);
    expect(named.aspectRatio).toBeCloseTo(0.5625, 9);
  });
});
