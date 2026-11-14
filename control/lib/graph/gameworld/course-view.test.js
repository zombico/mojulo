import { describe, expect, it } from 'vitest';
import { project, courseCamera, cameraAt, viewBands, VFOV } from './course-view.js';
import { rollRoom, rollRoomMeasured } from './roll-room.js';
import { courseOf } from './roll-course.js';
import { POLES } from './feel/cards.js';

// WHAT A RUNNER'S SCREEN IS MADE OF: three bands, top to bottom, the vanishing point on the line between the first two.
const MOMENTUM = Object.keys(POLES).find((p) => POLES[p].base === 'pinball');
// the practice rooms' usual follow camera behind a hero at the origin (playscape/player.js)
const USUAL = { pos: [0, -8.45, 2.956], look: [0, 1.5, 1.108], vfov: VFOV };

describe('a point on the screen', () => {
  it('what the camera looks at is the middle; right is right, up is up, behind is nowhere', () => {
    const [u, v] = project(USUAL, USUAL.look);
    expect(u).toBeCloseTo(0.5, 6);
    expect(v).toBeCloseTo(0.5, 6);
    expect(project(USUAL, [2, 10, 0])[0]).toBeGreaterThan(0.5);
    expect(project(USUAL, [0, 10, 3])[1]).toBeLessThan(project(USUAL, [0, 10, 0])[1]);
    expect(project(USUAL, [0, -20, 0])).toBeNull();
  });
});

describe('the camera that frames a course', () => {
  it('puts the vanishing point on the upper line, the reaction\'s place on the lower, the hero in the bottom band', () => {
    for (const react of [6, 10, 16]) {
      const F = courseCamera({ react }), B = viewBands(cameraAt(F), { react, top: 12 });
      expect(B.laws.filter((l) => !l.holds), `react ${react}`).toEqual([]);
      expect(B.horizon).toBeCloseTo(1 / 3, 2);
      expect(B.line).toBeCloseTo(react, 0);
      expect(B.bottom.to).toBeCloseTo(react, 0);
      expect(B.middle).toMatchObject({ to: null });          // the way's far end is in the middle band
      expect(B.figure.head).toBeGreaterThanOrEqual(0.62);
      expect(B.figure.feet).toBeLessThanOrEqual(1);
      expect(F.standOff).toBe(0);
    }
    // the further off a reaction begins, the higher the camera stands to see it at the lower line
    expect(courseCamera({ react: 10 }).height).toBeGreaterThan(courseCamera({ react: 3 }).height);
    // a hero's head stands as high on the screen as the way some metres on: a reaction that begins nearer than that
    // leaves a tall hero's head over the lower line, where a short one (a mascot's) still fits under it
    const near = cameraAt(courseCamera({ react: 4.5 }));
    expect(viewBands(near, { react: 4.5, tall: 1.7 }).laws.find((l) => l.law === 'figure-in-the-bottom').holds).toBe(false);
    expect(viewBands(near, { react: 4.5, tall: 1.1 }).laws.find((l) => l.law === 'figure-in-the-bottom').holds).toBe(true);
  });

  it('the usual follow camera does not frame one, and each band out of place is said', () => {
    const B = viewBands(USUAL, { react: 6, top: 12 });
    expect(B.laws.map((l) => l.law)).toEqual(['far-on-the-line', 'react-in-the-bottom', 'figure-in-the-bottom']);
    expect(B.laws.every((l) => !l.holds)).toBe(true);
    expect(B.laws[1].says).toMatch(/6 m ahead\) is 5\d % of the way down/);
    // its bottom band holds almost none of the way: the reaction's place is up in the middle band
    expect(B.bottom.to).toBeLessThan(1);
  });
});

describe('a course, framed', () => {
  const C = courseOf({ feel: MOMENTUM });
  it('the reaction begins where its earliest jump is pressed; its camera frames that', () => {
    expect(C.reactAt).toBeCloseTo(C.pace.top * Math.max(C.pace.lead.hurdle.early, C.pace.lead.block.early), 1);
    expect(C.camera).toEqual(courseCamera({ react: C.reactAt }));
    const R = rollRoom({ id: 'g', feel: MOMENTUM, roll: true });
    expect(R.manifest.camera).toMatchObject({ rule: 'follow', target: 'hero', ...C.camera });
  });

  it('the roll room\'s readout says the bands and that they are framed', () => {
    const V = rollRoomMeasured({ id: 'g', feel: MOMENTUM, roll: true }).view;
    expect(V.lost).toEqual([]);
    expect(V.reactAt).toBe(C.reactAt);
    expect(V.bottom.to).toBeCloseTo(C.reactAt, 0);
    expect(V.bottom.seconds).toBeCloseTo(C.reactAt / C.pace.top, 1);
    expect(V.says).toHaveLength(3);
  });
});
