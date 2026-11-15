// A MISSION ON A GROUND (mission/route.js): the same sections and tasks laid along a way a ground gives a body to walk.
// One way a procedure: a bent way longer than the mission asks, on a ground with a slope (the places stand on it); a way
// shorter than it asks (fitted, and said). The concepts: the sections follow one another along the way; every place
// stands on the ground; cover stands beside the way, never on it; a way on is a zone past its section's end and puts a
// body back short of it; the same seed lays the same mission; the laws hold and say what open ground does not.
import { describe, expect, it } from 'vitest';

import { missionBrief, makeRoute, composeOnRoute, routeLaws, ROUTE, SECTIONS } from './index.js';
import { TEMPLATE_LOADOUTS } from '../gameworld/loadout.js';

const TEMPLATE = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string'));
const BRIEF = missionBrief({ feel: TEMPLATE });
// a way with a bend in it, on a slope
const ground = (x, y) => 0.05 * x - 0.02 * y;
const bent = (n) => Array.from({ length: n + 1 }, (_, i) => (i < n / 2 ? [i, 0] : [n / 2, i - n / 2]));
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const offWay = (R, p) => Math.min(...R.points.map((q) => d2(q, p)));
const held = (M) => routeLaws(M, BRIEF).filter((l) => !l.holds).map((l) => l.law);

describe('a route', () => {
  it('is read by the length along it, and wants two points', () => {
    const R = makeRoute([[0, 0], [10, 0], [10, 10]], ground);
    expect(R.length).toBeCloseTo(20);
    expect(R.at(15).p).toEqual([10, 5]);
    expect(R.at(15).dir).toEqual([0, 1]);
    expect(R.at(99).p).toEqual([10, 10]);
    expect(R.z(10, 5)).toBeCloseTo(0.4);
    expect(() => makeRoute([[0, 0]])).toThrow(/two points or more/);
  });
});

describe('a mission laid along a way', () => {
  const R = makeRoute(bent(140), ground), M = composeOnRoute(BRIEF, R, { seed: 7 });
  it('lays the brief\'s sections one after another, the walk out taking what is left', () => {
    expect(M.on).toBe('route');
    expect(M.sections.map((s) => s.kind)).toEqual(BRIEF.sections);
    for (let i = 1; i < M.sections.length; i++) expect(M.sections[i].s[0]).toBe(M.sections[i - 1].s[1]);
    expect(M.sections.at(-1).s[1]).toBeCloseTo(R.length, 1);
    expect(M.fit.scale).toBe(1);
    expect(M.anchors.exit).toEqual(M.sections.at(-1).task.at);
  });
  it('stands every place on the ground, and its cover beside the way', () => {
    const places = [M.anchors.spawn, M.anchors.exit, ...M.sections.flatMap((s) => [s.entry, ...s.foes.map((f) => f.at), ...s.drops.map((d) => d.at)]), ...M.blocks.map((b) => b.at)];
    for (const p of places) expect(p[2]).toBeCloseTo(ground(p[0], p[1]), 1);
    expect(M.blocks.length).toBeGreaterThan(0);
    for (const b of M.blocks) { expect(offWay(R, b.at)).toBeGreaterThan(0.9); expect(Math.abs(b.N?.[0] ?? 1) + Math.abs(b.N?.[1] ?? 0)).toBe(1); }
    expect(M.primitives).toEqual([]);
  });
  it('seals each way on with a zone past its section\'s end, and puts a body back short of it', () => {
    const doors = M.sections.filter((s) => s.door);
    expect(doors.length).toBe(M.sections.length - 1);
    for (const s of doors) {
      // (the place a body is put back to is outside the zone that put it there, and inside its own section)
      expect(d2(s.door.back, s.door.at)).toBeGreaterThan(s.door.radius);
      expect(d2(s.door.back, s.zone.at)).toBeLessThanOrEqual((s.s[1] - s.s[0]) / 2 + 0.01);
    }
    expect(M.sections.at(-1).door).toBeNull();
  });
  it('wakes each fight\'s foes at its band, never at the way in', () => {
    for (const s of M.sections.filter((x) => SECTIONS[x.kind].fight)) { expect(s.foes.length).toBeGreaterThan(0); for (const f of s.foes) expect(d2(f.at, s.entry)).toBeGreaterThan(3); }
  });
  it('lays the same mission from the same seed, another from another', () => {
    expect(composeOnRoute(BRIEF, R, { seed: 7 })).toEqual(M);
    expect(composeOnRoute(BRIEF, R, { seed: 8 }).sections.map((s) => s.foes.map((f) => f.at))).not.toEqual(M.sections.map((s) => s.foes.map((f) => f.at)));
  });
  it('holds its laws, and says what a zone on open ground does not hold', () => {
    expect(held(M)).toEqual([]);
    expect(routeLaws(M, BRIEF).find((l) => l.law === 'gated').says).toMatch(/may walk round one, and gains nothing/);
  });
});

describe('a way shorter than the mission asks', () => {
  it('is fitted: every section scaled, and the fits law says by how much', () => {
    const R = makeRoute([[0, 0], [40, 0]], ground), M = composeOnRoute(BRIEF, R, { seed: 7 });
    expect(M.fit.scale).toBeLessThan(1);
    expect(M.sections.at(-1).s[1]).toBeCloseTo(40, 1);
    const fits = routeLaws(M, BRIEF).find((l) => l.law === 'fits');
    expect(fits.holds).toBe(false);
    expect(fits.says).toMatch(/scaled to \d+%/);
    expect(ROUTE.gate).toBeGreaterThan(0);
  });
});
