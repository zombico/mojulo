import { describe, expect, it } from 'vitest';

import { emitPreserve3dScene, projectWorldToScreen } from './scene-css3d.js';
import { resolveSignage } from './signage-chrome.js';

const viewBox = { width: 800, height: 600 };
const worldFraming = { cameraPosition: [0, -10, 3], lookAt: [0, 0, 3], horizontalFov: 60 };
const faces = [{ corners: [[-2, 0, 0], [2, 0, 0], [2, 0, 4], [-2, 0, 4]], fill: '#888888' }];
const cameras = [{ name: 'front', worldFraming }];

describe('projectWorldToScreen', () => {
  it('projects the look-at point to the picture centre', () => {
    const p = projectWorldToScreen([0, 0, 3], worldFraming, viewBox);
    expect(p.behind).toBe(false);
    expect(p.x).toBeCloseTo(400, 0);
    expect(p.y).toBeCloseTo(300, 0);
  });

  it('flags a point behind the camera', () => {
    const p = projectWorldToScreen([0, -20, 3], worldFraming, viewBox);
    expect(p.behind).toBe(true);
  });

  it('moves the screen x right for a world point to camera-right', () => {
    const left = projectWorldToScreen([-3, 0, 3], worldFraming, viewBox);
    const right = projectWorldToScreen([3, 0, 3], worldFraming, viewBox);
    expect(right.x).not.toBeCloseTo(left.x, 0);
  });
});

describe('emitPreserve3dScene signage', () => {
  it('is byte-identical when no signage is supplied', () => {
    const a = emitPreserve3dScene({ faces, cameras, viewBox });
    const b = emitPreserve3dScene({ faces, cameras, viewBox, signs: [] });
    expect(a).toBe(b);
    expect(a).not.toMatch(/moj-signs/);
  });

  it('emits an overlay layer + per-camera projected positions for a world sign', () => {
    const signs = resolveSignage(
      [{ variant: 'popup', body: ['hello', 'world'], anchor: { world: [0, 0, 3] }, id: 's1' }],
      { palette: { mood: 'flat' } },
    );
    const html = emitPreserve3dScene({ faces, cameras, viewBox, signs });
    expect(html).toMatch(/class="moj-signs"/);
    expect(html).toMatch(/data-sign-id="s1"/);
    expect(html).toMatch(/moj-sign--popup/);
    expect(html).toMatch(/placeSigns/);
    // CAMS json carries the per-camera projected position for the world sign.
    expect(html).toMatch(/"signs":\{"s1":\[\d+,\d+,0\]\}/);
  });

  it('renders a toast with its timing data attributes and slot positioning', () => {
    const signs = resolveSignage(
      [{ variant: 'toast', text: '+100', anchor: { slot: 'top' }, after: 0.5, ttl: 2, id: 't1' }],
      { palette: { mood: 'night', bg: '#0b1018' } },
    );
    const html = emitPreserve3dScene({ faces, cameras, viewBox, signs });
    expect(html).toMatch(/moj-sign--toast/);
    expect(html).toMatch(/data-after="0.5"/);
    expect(html).toMatch(/data-ttl="2"/);
    expect(html).toMatch(/moj-slot-top/);
  });
});
