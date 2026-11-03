// The turnaround: a parked aircraft's ground crew placed and posed to its own doors, holds and nose gear, read off its
// form. An airliner's whole crew, each at its station and none on another or on the aircraft's gear and engines; the
// stairs and the galley at a door's sill, the belts at the holds'; what a door is out of the reach of left off; turned
// with the aircraft; in the field's camo under a camo'd aircraft; asked by a parked craft's `crew`, and an airside body's
// `reach` carried to its figure. One aircraft per concept, chosen in code from the shelf.
import { describe, it, expect } from 'vitest';
import { CREW_ROLES, craftService, crewFor, turnaround } from './turnaround.js';
import { readParked, withParked } from './parked.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/index.js';
import { craftForm } from '../craft-shelf/craft-form.js';
import { AIRSIDE_REACH, reachFront } from '../car-designer/road-airside.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { handlesOf, rowOfHandle } from './roster.js';

// (an airliner whose doors a stair truck reaches, and one whose sill is under it: chosen from the shelf by measure)
const LINERS = Object.keys(CRAFT_ARCHETYPES).filter((k) => CRAFT_ARCHETYPES[k].role === 'liner');
const TALL = LINERS.find((k) => craftService(k).doors[0]?.sill >= AIRSIDE_REACH.stairs.range[0] && craftService(k).doors[0].sill <= 4.5);
const LOW = LINERS.find((k) => craftService(k).doors[0]?.sill < AIRSIDE_REACH.stairs.range[0]);
const OTHER = Object.keys(CRAFT_ARCHETYPES).find((k) => CRAFT_ARCHETYPES[k].realm === 'earth' && CRAFT_ARCHETYPES[k].role !== 'liner' && rowOfHandle('craft', k) && craftService(k).nose);
const classOf = (id) => handlesOf(id).physics[0];
// a crew vehicle back in the craft's frame (x its right, +y its nose): its middle, its nose's way, its plan's corners
function local(e, craft) {
  const c = Math.cos(craft.heading), s = Math.sin(craft.heading), dx = e.at[0] - craft.at[0], dy = e.at[1] - craft.at[1];
  const p = [dx * s - dy * c, dx * c + dy * s], h = e.heading - craft.heading + Math.PI / 2, d = [Math.cos(h), Math.sin(h)];
  const v = PHYSICS[classOf(e.vehicle)], n = [-d[1], d[0]];
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [p[0] + d[0] * a * v.L / 2 + n[0] * b * v.W / 2, p[1] + d[1] * a * v.L / 2 + n[1] * b * v.W / 2]);
  return { p, d, corners };
}
const boxOf = (cs) => ({ lo: [0, 1].map((k) => Math.min(...cs.map((q) => q[k]))), hi: [0, 1].map((k) => Math.max(...cs.map((q) => q[k]))) });
const overlap = (a, b) => a.lo[0] < b.hi[0] && b.lo[0] < a.hi[0] && a.lo[1] < b.hi[1] && b.lo[1] < a.hi[1];

describe('the turnaround: the ground crew to an aircraft\'s own geometry', () => {
  const craft = { craft: TALL, at: [0, 0, 0], heading: 0 }, crew = turnaround(craft);
  it('reads its doors, its holds low in its belly, its nose gear ahead', () => {
    const S = craftService(TALL);
    expect(S.doors.length).toBeGreaterThan(1);
    expect(S.holds).toHaveLength(2);
    for (const h of S.holds) expect(h.sill).toBeLessThan(S.doors[0].sill);
    expect(S.nose[1]).toBeGreaterThan(S.holds[0].y);
    expect(S.holds[0].y).toBeGreaterThan(S.holds[1].y);
  });
  it('an airliner calls its whole crew, each at its station: the stairs and the galley at a door\'s sill, a belt at each hold', () => {
    expect(new Set(crew.map((e) => e.vehicle))).toEqual(new Set(Object.values(CREW_ROLES)));
    const S = craftService(TALL), at = (role) => crew.filter((e) => e.vehicle === CREW_ROLES[role]);
    for (const [role, side] of [['stairs', 'L'], ['catering', 'R']]) {
      const [e] = at(role), L = local(e, craft), front = L.p[0] + L.d[0] * reachFront(classOf(e.vehicle), e.reach);
      expect(e.reach, role).toBeCloseTo(S.doors[0].sill, 2);
      expect(Math.abs(front), role).toBeCloseTo(S.doors[0].x[side] + 0.08, 2);
      expect(Math.sign(L.p[0]), role).toBe(side === 'L' ? -1 : 1);
      expect(L.p[1], role).toBeCloseTo(S.doors[0].y, 2);
    }
    at('belt').forEach((e, k) => { expect(e.reach).toBeCloseTo(S.holds[k].sill, 2); expect(local(e, craft).p[1]).toBeCloseTo(S.holds[k].y, 2); });
    expect(local(at('pushback')[0], craft).p[1]).toBeGreaterThan(S.nose[1]);
  });
  it('none stands on another, nor on the aircraft\'s gear and engines', () => {
    const plans = crew.map((e) => boxOf(local(e, craft).corners));
    for (let i = 0; i < plans.length; i++) for (let j = i + 1; j < plans.length; j++) expect(overlap(plans[i], plans[j]), `${crew[i].vehicle} on ${crew[j].vehicle}`).toBe(false);
    const { items } = craftForm(TALL, { attitude: 'ground', pose: { gear: 0 } }), all = items.flatMap((it) => it.faces.flatMap((f) => f.corners));
    const c = [0, 1].map((k) => (Math.min(...all.map((p) => p[k])) + Math.max(...all.map((p) => p[k]))) / 2);
    const solid = items.filter((it) => /^(engine|main|nose)/.test(it.id)).map((it) => boxOf(it.faces.flatMap((f) => f.corners.map((p) => [p[0] - c[0], p[1] - c[1]]))));
    for (const [i, P] of plans.entries()) for (const B of solid) expect(overlap(P, B), crew[i].vehicle).toBe(false);
  });
  it('turns with the aircraft, the same crew to the same stations', () => {
    const turned = { craft: TALL, at: [40, -12, 0], heading: Math.PI / 3 }, again = turnaround(turned);
    expect(again.map((e) => e.vehicle)).toEqual(crew.map((e) => e.vehicle));
    again.forEach((e, k) => { const a = local(e, turned), b = local(crew[k], craft); expect(a.p[0]).toBeCloseTo(b.p[0], 2); expect(a.p[1]).toBeCloseTo(b.p[1], 2); expect(e.reach).toEqual(crew[k].reach); });
  });
  it('leaves off what a door is out of the reach of, and gives another aircraft what it can use', () => {
    expect(turnaround({ craft: LOW, at: [0, 0, 0], heading: 0 }).some((e) => e.vehicle === CREW_ROLES.stairs)).toBe(false);
    expect(new Set(turnaround({ craft: OTHER, at: [0, 0, 0], heading: 0 }).map((e) => e.vehicle))).toEqual(new Set([CREW_ROLES.fuel, CREW_ROLES.pushback]));
  });
  it('a camo\'d aircraft\'s crew in the field\'s camo; a crew asked by its words, and refused one that is not', () => {
    const camo = turnaround({ ...craft, livery: 'desert' });
    expect(camo.every((e) => e.livery === 'desert')).toBe(true);
    expect(crew.every((e) => e.livery === undefined)).toBe(true);
    expect(crewFor(TALL, ['stair truck', 'fuel truck'])).toEqual([CREW_ROLES.stairs, CREW_ROLES.fuel]);
    expect(() => crewFor(TALL, ['sedan'])).toThrow(/not one of the ground crew/);
  });
});

describe('through a level\'s parked vehicles', () => {
  const word = rowOfHandle('craft', TALL);
  it('a parked craft\'s crew follows it, each a figure posed to its reach and a collider of its own', () => {
    const P = readParked([{ vehicle: word, at: [0, 0, 0], crew: true }]);
    expect(P[0].craft).toBe(TALL);
    expect(P.length).toBe(1 + turnaround({ craft: TALL, at: [0, 0, 0], heading: 0 }).length);
    const { manifest, colliders } = withParked({ parked: [{ vehicle: word, at: [0, 0, 0], crew: true }] });
    expect(colliders).toHaveLength(P.length);
    const stairs = Object.values(manifest.figures).find((f) => f.loft?.class === classOf(CREW_ROLES.stairs));
    expect(stairs.loft.reach).toBeCloseTo(craftService(TALL).doors[0].sill, 2);
  });
  it('an airside body takes a reach, and only it; a crew is a craft\'s', () => {
    expect(readParked([{ vehicle: 'stair truck', at: [0, 0, 0], reach: 4 }])[0]).toMatchObject({ reach: 4 });
    expect(() => readParked([{ vehicle: 'pickup', at: [0, 0, 0], reach: 2 }])).toThrow(/lifts nothing/);
    expect(() => readParked([{ vehicle: 'stair truck', at: [0, 0, 0], crew: true }])).toThrow(/no craft/);
    expect(() => readParked([{ vehicle: word, at: [0, 0, 0], crew: ['sedan'] }])).toThrow(/not one of the ground crew/);
  });
});

describe('a four-engined jumbo\'s turnaround', () => {
  // (a liner on four engines: its inner and outer pairs by their own ids)
  const QUAD = LINERS.find((k) => CRAFT_ARCHETYPES[k].layout.filter((e) => /^engine/.test(e.id)).length > 1);
  it('calls its whole crew, the fuel truck clear of every engine it has', () => {
    const craft = { craft: QUAD, at: [0, 0, 0], heading: 0 }, crew = turnaround(craft);
    expect(new Set(crew.map((e) => e.vehicle))).toEqual(new Set(Object.values(CREW_ROLES)));
    const { items } = craftForm(QUAD, { attitude: 'ground', pose: { gear: 0 } }), all = items.flatMap((it) => it.faces.flatMap((f) => f.corners));
    let cx = 0, cy = 0; { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const p of all) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); } cx = (a + b) / 2; cy = (c + d) / 2; }
    const engines = items.filter((it) => /^engine/.test(it.id)).map((it) => boxOf(it.faces.flatMap((f) => f.corners.map((p) => [p[0] - cx, p[1] - cy]))));
    expect(engines.length).toBe(4);
    for (const e of crew) for (const B of engines) expect(overlap(boxOf(local(e, craft).corners), B), e.vehicle).toBe(false);
  });
});
