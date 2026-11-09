// follow-pull-in — the follow camera's eye is drawn toward its look point by a stand-off the subject's own size sets,
// and never past the subject's far side: a small hero's wall (or none) cannot put the eye inside it; with nothing in
// the way a person's and a suit's chase keep the framing they were tuned at, and against a wall the eye stands just off
// it (2026-11-02), so a room keeps its depth behind the hero.
import { describe, it, expect } from 'vitest';
import { followPullIn } from './follow-pull-in.js';
import { HERO_CHASE } from '../../../playscape/hero-chase.js';
import { emitThreeWorld } from '../../scene-three.js';
import { EMIT_FIXTURES } from '../../emit-fixtures.js';

// the page's pull-in before the stand-off was the subject's: 3 m, floored at 0.15 of the follow distance
const legacy = (full, hitD) => Math.max(0.15, Math.min(1, (hitD - 3) / full));
// the follow rule's chase line (rules-basic.js follow, level ground, no pitch): the look point `lead` ahead at `lookH`,
// the eye `dist` behind and `height` up; what the page reads off it
function chase({ dist, height, lookH, lead }) {
  const dx = dist + lead, dz = height - lookH, full = Math.hypot(dx, dz);
  return { full, hz: dx / full, lead, dz };
}
const PERSON = HERO_CHASE;   // playscape/hero-chase.js
const SUIT = { dist: 6, height: 3, lookH: 1.5, lead: 4 };           // the follow rule's defaults (a suit's chase)
// the eye's distance behind the subject's centre, across the ground, at fraction `cd` of the follow distance
const behind = (C, cd) => C.full * cd * C.hz - C.lead;

describe('follow camera pull-in', () => {
  it('with nothing in the way, a person and a suit keep their framing: the 3 m stand-off, exactly as before', () => {
    const C = chase(PERSON), S = chase(SUIT);
    expect(followPullIn(C.full, C.full, C.lead, C.hz, 0.3, 1.7, 0.1)).toBe(legacy(C.full, C.full));
    expect(followPullIn(S.full, S.full, S.lead, S.hz, 0, 0, 0.1)).toBe(legacy(S.full, S.full));
    expect(followPullIn(S.full, S.full, S.lead, S.hz, 0, 18, 0.1)).toBe(legacy(S.full, S.full));
    // the hero's chase, laid long by the stand-off: its eye 5.5 m behind the hero, as its framing says
    expect(behind(C, followPullIn(C.full, C.full, C.lead, C.hz, 0.3, 1.7, 0.1))).toBeCloseTo(5.5, 2);
  });

  it('against a wall the eye stands half a metre off it (and its near plane), never farther out than the open line', () => {
    const C = chase(PERSON);
    for (const hitD of [9, 7, 5, 4]) {
      const cd = followPullIn(C.full, hitD, C.lead, C.hz, 0.3, 1.7, 0.1);
      expect(C.full * cd).toBeCloseTo(Math.min(C.full - 3, hitD - 0.6), 9);
      // never nearer the look point than the legacy 3 m stand-off put it
      expect(cd).toBeGreaterThanOrEqual(legacy(C.full, hitD));
    }
    // continuous where the wall meets the open line's eye
    const at = C.full - 3 + 0.6, a = followPullIn(C.full, at - 1e-9, C.lead, C.hz, 0.3, 1.7, 0.1), b = followPullIn(C.full, at + 1e-9, C.lead, C.hz, 0.3, 1.7, 0.1);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });

  it('a small hero: the old stand-off put the eye inside it with no wall at all; now it stands clear of it', () => {
    // a fox mascot's chase as it was scaled (a person's times 0.565), its capsule 0.961 m tall, its head 0.24 wide
    const C = chase({ dist: 3.109, height: 1.357, lookH: 0.721, lead: 0.848 }), r = 0.24, h = 0.961;
    expect(behind(C, legacy(C.full, C.full))).toBeLessThan(r);   // the bug: inside the head
    expect(behind(C, followPullIn(C.full, C.full, C.lead, C.hz, r, h, 0.1))).toBeGreaterThan(1);
  });

  it('however near the wall, the eye never comes nearer than the subject\'s far side, its near plane clear of it', () => {
    for (const cam of [PERSON, SUIT, { dist: 5.5, height: 2.4, lookH: 0.72, lead: 1.5 }, { dist: 3.1, height: 1.36, lookH: 0.72, lead: 0.85 }, { dist: 1.2, height: 0.6, lookH: 0.2, lead: 0.3 }]) {
      const C = chase(cam);
      for (const r of [0, 0.12, 0.24, 0.3, 2]) for (const h of [0, 0.35, 0.96, 1.7]) {
        for (let i = 1; i <= 40; i++) {
          const cd = followPullIn(C.full, (C.full * i) / 40, C.lead, C.hz, r, h, 0.1);
          expect(cd).toBeLessThanOrEqual(1);
          expect(cd).toBeGreaterThanOrEqual(0.15);
          if (cd < 1) expect(behind(C, cd)).toBeGreaterThanOrEqual(r + 0.1 - 1e-9);
        }
      }
    }
  });

  it('the stand-off shrinks with a subject smaller than a person, never grows past 3 m', () => {
    const full = 7.12, at = (h) => full * (1 - followPullIn(full, full, 0, 1, 0, h, 0.1));
    expect(at(1.7)).toBeCloseTo(3, 12);
    expect(at(3.4)).toBeCloseTo(3, 12);
    expect(at(0.85)).toBeCloseTo(1.5, 12);
    expect(at(0.85)).toBeLessThan(at(1.2));
  });

  it('a first-person follow camera (its look point leads its own eye) is never drawn in', () => {
    const C = chase({ dist: 0.05, height: 0, lookH: 0, lead: 2 });
    for (const hitD of [C.full, 1.5, 0.5]) expect(followPullIn(C.full, hitD, C.lead, C.hz, 0.3, 0, 0.1)).toBe(1);
    expect(followPullIn(C.full, 1, C.lead, 0, 0, 0, 0.1)).toBe(1);   // a line straight up stays where the rule put it
  });

  it('the page inlines this very function, and reads the subject off the camera\'s target', () => {
    const [, opts] = EMIT_FIXTURES.find(([n]) => n === 'controllable');
    const html = emitThreeWorld(opts);
    expect(html).toContain(`const __followPullIn = ${followPullIn.toString()};`);
    expect(html).toContain('__followPullIn(full, hitD, lead, Math.hypot(ux, uy), rad, ');
    expect(html).toContain(', camera.near, c.rule.standOff);');
    expect(html).not.toContain('const skin = 3;');
  });

  it('a camera\'s own stand-off (`standOff`): 0 stands the eye where the rule puts it in the open, and a wall still pulls it in', () => {
    // a shooter's over the shoulder (gameworld/quick.js SHOULDER): 2.8 m behind, its look point 10 m ahead
    const full = Math.hypot(12.8, 0.25), lead = 10;
    expect(followPullIn(full, full, lead, 1, 0.3, 1.7, 0.03)).toBeLessThan(0.81);   // the default stand-off: the eye on the hero
    expect(followPullIn(full, full, lead, 1, 0.3, 1.7, 0.03, 0)).toBe(1);           // its own: where the rule put it
    const wall = 11.5;   // a wall 1.5 m behind the hero
    expect(followPullIn(full, wall, lead, 1, 0.3, 1.7, 0.03, 0) * full).toBeCloseTo(wall - 0.53, 6);
    expect(followPullIn(full, full, lead, 1, 0.3, 1.7, 0.03, undefined)).toBe(followPullIn(full, full, lead, 1, 0.3, 1.7, 0.03));   // absent: as before
  });
});
