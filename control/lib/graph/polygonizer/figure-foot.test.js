/**
 * The foot's SHAPE — the facts footwear is drafted against (footwear P0, the big toe).
 *
 * Two properties a shoe depends on and nothing else asserted:
 *   1. a figure that says nothing about its feet STANDS FLAT (P0) — a sole is on the floor,
 *      not pitched toe-down, or every shoe drafted on it reads as a ski;
 *   2. the BIG TOE LEADS and the two feet are MIRRORS — the foot's point is on its inner edge,
 *      so a shoe last has a handedness to draft to.
 */
import { describe, expect, it } from 'vitest';

import { bodyGirths } from './body-chart.js';
import { buildPosedFigure } from './figure-render.js';

const foot = (stacks, id) => stacks.find((s) => s.id === id);
// the sole line: the lowest z of each station, heel → toe (the rounded caps excluded)
const solePitch = (f) => {
  const s = f.rings.map((r) => ({ y: r.center.y, z: Math.min(...r.polyline.map((p) => p.z)) }));
  const a = s[1], b = s[s.length - 2];
  return Math.atan2(-(b.z - a.z), b.y - a.y) * 180 / Math.PI;
};

describe('the flat stand', () => {
  it('a figure with no foot dials stands with its soles on the floor, on both poles', () => {
    for (const sex of ['male', 'female']) {
      const stacks = buildPosedFigure({}, { sex }, null);
      for (const id of ['footL', 'footR']) expect(Math.abs(solePitch(foot(stacks, id))), `${sex} ${id}`).toBeLessThan(0.5);
    }
  });

  it('a pose that asks for a pointed foot still gets one — the flat stand is a default, not a law', () => {
    const pointed = buildPosedFigure({ footFlat: { L: 0, R: 0 } }, {}, null);
    expect(solePitch(foot(pointed, 'footL'))).toBeGreaterThan(5);
  });
});

// The foot's SIZE against the body it belongs to. This is a proportion, so it holds at every
// stature and on both poles — the body scales, the ratio does not.
describe('the foot is in proportion', () => {
  it('is about 15% of stature long and 39% of its length broad, at any size', () => {
    for (const stature of [150, 170, 190]) {
      for (const sex of ['male', 'female']) {
        const stacks = buildPosedFigure({}, { sex }, null);
        const g = bodyGirths(stacks, { stature_cm: stature });
        const share = g.foot_length / stature;
        expect(share, `${sex} @${stature}`).toBeGreaterThan(0.14);   // a human foot is ~15% of height;
        expect(share, `${sex} @${stature}`).toBeLessThan(0.16);      // it was 18.1% — a EU 47 on a 170 cm figure
        // breadth at the ball, as a share of length (a human foot is 37-40%)
        const f = foot(stacks, 'footL'), pts = f.rings.flatMap((r) => r.polyline);
        const ys = pts.map((p) => p.y), yA = Math.min(...ys), len = Math.max(...ys) - yA;
        const band = pts.filter((p) => Math.abs(p.y - (yA + len * 0.6)) < len * 0.03);
        const breadth = Math.max(...band.map((p) => p.x)) - Math.min(...band.map((p) => p.x));
        expect(breadth / len, `${sex} @${stature} breadth`).toBeGreaterThan(0.35);
        expect(breadth / len, `${sex} @${stature} breadth`).toBeLessThan(0.43);
      }
    }
  });
});

describe('the big toe leads', () => {
  const stacks = buildPosedFigure({}, {}, null);

  it('the foot\'s leading edge is MEDIAL — its point is on the inner side, on both feet', () => {
    for (const id of ['footL', 'footR']) {
      const f = foot(stacks, id);
      // the foot's AXIS is the rear half's centres — the forefoot's carry the medial offset,
      // so averaging all of them would walk the midline toward the very thing being measured
      const rear = f.rings.slice(0, 5);
      const cx = rear.reduce((s, r) => s + r.center.x, 0) / rear.length;
      const pts = f.rings.flatMap((r) => r.polyline);
      const yMax = Math.max(...pts.map((p) => p.y));
      const lead = pts.filter((p) => yMax - p.y < 1e-9);               // the leading edge, ties included
      const tipX = lead.reduce((s, p) => s + p.x, 0) / lead.length;
      // medial = toward the body's midline (x = 0): +x for the left foot, −x for the right
      const inward = cx < 0 ? tipX - cx : cx - tipX;
      expect(inward, id).toBeGreaterThan(0.1);
    }
  });

  // The toe BOX is blunt. This is the guard that matters: walking a narrow cap medially turns it
  // into a blade, and the blade is what the width-and-depth near the tip catches. Measured as a
  // share of the ball's — before the forefoot gained its `roll` and `box` stations the foot was
  // 8 % as wide and 0.7 cm deep at 94 % of its length, a knife; it is now 64 % and 2.7 cm at 88 %.
  it('the toe box keeps real width and depth out toward the tip — not a blade', () => {
    const f = foot(stacks, 'footL');
    const pts = f.rings.flatMap((r) => r.polyline);
    const yA = Math.min(...pts.map((p) => p.y)), yB = Math.max(...pts.map((p) => p.y)), len = yB - yA;
    const at = (frac) => {
      const y = yA + len * frac, band = pts.filter((p) => Math.abs(p.y - y) < len * 0.025);
      if (band.length < 3) return null;
      return {
        w: Math.max(...band.map((p) => p.x)) - Math.min(...band.map((p) => p.x)),
        t: Math.max(...band.map((p) => p.z)) - Math.min(...band.map((p) => p.z)),
      };
    };
    const ball = at(0.60), box = at(0.88);
    expect(ball).toBeTruthy(); expect(box).toBeTruthy();
    expect(box.w / ball.w).toBeGreaterThan(0.4);    // still about two-thirds as wide as the ball
    expect(box.t / ball.t).toBeGreaterThan(0.4);    // and still has depth — a blade has none
  });

  // The tube's END. `litFaces` strips quads between consecutive rings and caps neither end, so
  // the last ring IS the hole. It has to stay small (the blunt box would otherwise show a window)
  // and non-zero (a degenerate ring has girth 0, and the foot chart divides by a row's girth).
  it('the toe closes: the last ring is small, and not degenerate', () => {
    for (const id of ['footL', 'footR']) {
      const f = foot(stacks, id), last = f.rings[f.rings.length - 1], c = last.center;
      const rad = Math.max(...last.polyline.map((p) => Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z)));
      expect(rad, `${id} closes`).toBeLessThan(0.05);
      expect(rad, `${id} non-degenerate`).toBeGreaterThan(0);
    }
  });

  it('the two feet are exact mirrors — one set of numbers, each foot pointing inward', () => {
    const L = foot(stacks, 'footL'), R = foot(stacks, 'footR');
    expect(L.rings.length).toBe(R.rings.length);
    // a reflection reverses the traversal, so the rings match as point SETS, not index for index
    for (let i = 0; i < L.rings.length; i++) {
      const rset = R.rings[i].polyline;
      for (const a of L.rings[i].polyline) {
        let best = Infinity;
        for (const b of rset) best = Math.min(best, Math.max(Math.abs(a.x + b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z)));
        expect(best).toBeLessThan(1e-9);
      }
    }
  });
});
