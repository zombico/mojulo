import { describe, expect, it } from 'vitest';
import { project, viewZones } from './course-view.js';

// WHAT A RUNNER'S SCREEN IS MADE OF: the figure, the far, the middle third. One camera, behind and above a hero at the
// origin, looking up the way (the roll room's own).
const CAM = { pos: [0, -8.45, 2.956], look: [0, 1.5, 1.108], vfov: 43.808 };

describe('a point on the screen', () => {
  it('what the camera looks at is the middle; right is right, up is up, behind is nowhere', () => {
    const [u, v] = project(CAM, CAM.look);
    expect(u).toBeCloseTo(0.5, 6);
    expect(v).toBeCloseTo(0.5, 6);
    expect(project(CAM, [2, 10, 0])[0]).toBeGreaterThan(0.5);
    expect(project(CAM, [0, 10, 3])[1]).toBeLessThan(project(CAM, [0, 10, 0])[1]);
    expect(project(CAM, [0, -20, 0])).toBeNull();
    // a thing shrinks as it goes off: its width on the screen falls with its distance
    const w = (d) => project(CAM, [3.3, d, 0])[0] - project(CAM, [-3.3, d, 0])[0];
    expect(w(5)).toBeGreaterThan(w(10));
    expect(w(10)).toBeGreaterThan(w(40));
  });
});

describe('the three places a course is read in', () => {
  const Z = viewZones(CAM, { top: 12, sight: 19 });
  it('the way\'s far end goes to the top of the middle third; the figure stands below the middle', () => {
    expect(Z.horizon).toBeGreaterThan(0.2);
    expect(Z.horizon).toBeLessThan(1 / 3);
    expect(Z.figure.v[0]).toBeLessThan(Z.figure.v[1]);
    expect(Z.figure.v[1]).toBeGreaterThan(0.5);
    expect(Z.horizon).toBeLessThan(Z.figure.v[0]);
  });

  it('the middle third holds the way from the hero\'s feet out to where a thing is first read', () => {
    expect(Z.middle.from).toBeLessThan(2);
    expect(Z.middle.to).toBeGreaterThan(19);
  });

  it('a thing as wide as the way fills a third of the screen just before it is met, and is small where it is first read', () => {
    expect(Z.third.at).toBeGreaterThan(2);
    expect(Z.third.at).toBeLessThan(10);
    expect(Z.third.seconds).toBeCloseTo(Z.third.at / 12, 2);
    expect(Z.far.px).toBeLessThan(Z.third.px);
    expect(Z.far.px).toBeGreaterThan(60);     // small, but a shape still
    expect(Z.dwell).toBeGreaterThan(0.5);
    // a faster hero meets it sooner at the same size, and looks at it for less
    const fast = viewZones(CAM, { top: 20 });
    expect(fast.third.at).toBe(Z.third.at);
    expect(fast.third.seconds).toBeLessThan(Z.third.seconds);
    expect(fast.dwell).toBeLessThan(Z.dwell);
  });
});
