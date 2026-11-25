// The scroll frame (scroll-stage/frame.js): a stage written in screen axes (u along the scroll, v across, d depth) and a
// view the rotation that stands them in the world. The concepts: each view is a rotation, never a reflection, and its
// screen's right and up agree with its camera; the side view is the side map's own frame; the ship's length holds its
// share of the frame across; the play box keeps the ship whole inside the frame; a layer behind the plane is drawn bigger
// and slides slower, by the side map's vista rule.
import { describe, it, expect } from 'vitest';
import { SCROLL_VIEWS, SCROLL_VIEW_IDS, SCROLL_FRAME, readScrollView, scrollCamera, cameraAt, toWorld, toScreen, playBox, layerGrowth, layerPace } from './frame.js';
import { screenOf } from '../side-map/screen.js';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const close = (a, b) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 9));

describe('the scroll frame', () => {
  it('each view is a rotation: along × across is toward, and the screen right × up faces the camera', () => {
    for (const id of SCROLL_VIEW_IDS) {
      const V = SCROLL_VIEWS[id];
      close(cross(V.along, V.across), V.toward);
      // the camera looks along −toward with V.up up: its right is forward × up, and right × up comes back to toward
      const right = cross(V.toward.map((x) => -x), V.up);
      close(cross(right, V.up), V.toward);
    }
  });

  it('the side view scrolls to the screen\'s right and the top view to its up, a quarter turn apart', () => {
    const right = (V) => cross(V.toward.map((x) => -x), V.up);
    close(right(SCROLL_VIEWS.side), SCROLL_VIEWS.side.along);
    close(SCROLL_VIEWS.top.up, SCROLL_VIEWS.top.along);
    // what is up the side view's screen (+v) is to the top view's left: turned, not mirrored
    close(right(SCROLL_VIEWS.top), SCROLL_VIEWS.top.across.map((x) => -x));
  });

  it('the side view is the side map\'s frame: the plane at x 0, the scroll along +y, the camera on +x', () => {
    const cam = scrollCamera(12);
    const C = cameraAt(cam, [40, 2]);
    close(C.lookAt, [0, 40, 2]);
    close(C.pos, [cam.dist, 40, 2]);
    close(C.up, [0, 0, 1]);
  });

  it('screen axes and the world go both ways, depth included', () => {
    for (const id of SCROLL_VIEW_IDS) close(toScreen(id, toWorld(id, [3.5, -2, -40])), [3.5, -2, -40]);
  });

  it('the ship\'s length holds its share of the frame across, in either view', () => {
    for (const view of SCROLL_VIEW_IDS) {
      const cam = scrollCamera(12, { view });
      expect(12 / cam.screen.across).toBeCloseTo(SCROLL_FRAME.shipShare, 3);
      const S = screenOf({ dist: cam.dist, vfov: cam.vfov, aspect: cam.aspect });
      // the lens is vertical: across is the frame's height in the side view, its width in the top
      expect(cam.screen.across).toBeCloseTo(view === 'side' ? S.height : S.width, 2);
    }
    expect(scrollCamera(12).screen.along).toBeGreaterThan(scrollCamera(12).screen.across);   // a wide frame, scrolled across
    expect(scrollCamera(12, { view: 'top' }).screen.along).toBeGreaterThan(scrollCamera(12, { view: 'top' }).screen.across);   // a tall one, scrolled up
  });

  it('a smaller share frames the same ship from further back, with more room round it', () => {
    const a = scrollCamera(12), b = scrollCamera(12, { shipShare: SCROLL_FRAME.shipShare / 2 });
    expect(b.dist).toBeCloseTo(a.dist * 2, 2);
    expect(b.screen.across).toBeCloseTo(a.screen.across * 2, 2);
  });

  it('the play box keeps the whole ship inside the frame, its edge kept', () => {
    const cam = scrollCamera(12), ship = { length: 12, breadth: 4 }, B = playBox(cam, ship), S = cam.screen;
    expect(B.u[1] + ship.length / 2).toBeLessThan(S.along / 2);
    expect(B.v[1] + ship.breadth / 2).toBeLessThan(S.across / 2);
    expect(B.u[0]).toBeCloseTo(-B.u[1], 9);
    expect(() => playBox(cam, { length: S.along })).toThrow(/too big/);
  });

  it('a layer behind the plane is drawn bigger and slides slower; one in front faster', () => {
    const cam = scrollCamera(12);
    expect(layerGrowth(cam, 0)).toBe(1);
    expect(layerGrowth(cam, -cam.dist)).toBeCloseTo(2, 9);
    expect(layerPace(cam, -cam.dist)).toBeCloseTo(0.5, 9);
    expect(layerPace(cam, cam.dist / 2)).toBeCloseTo(2, 9);
    expect(() => layerGrowth(cam, cam.dist)).toThrow(/camera/);
  });

  it('reads its words and refuses others, teaching', () => {
    expect(readScrollView()).toBe('side');
    expect(() => readScrollView('diagonal')).toThrow(/'side' or 'top'/);
    expect(() => scrollCamera(0)).toThrow(/shipLength/);
    expect(() => scrollCamera(12, { shipShare: 1.2 })).toThrow(/under 1/);
  });
});
