// A cycle shelf machine as the doors draw it: its faces on the studio grid, and its figure in a level (the machine the
// root, a bone at each wheel, centred along its length, parked leaning on its stand). One machine with a stand, chosen
// in code; the words a cycle takes, and those it refuses. Ridden (a quick game's ride): its front a bone that turns about
// the steering axis, every wheel its own bone rolling, the live overlay's words (the lean the rule's when its wheels are
// in line, a three-wheeler's tipping edges read off its contacts); riderless here, the rider's own suite poses one.
import { describe, it, expect } from 'vitest';
import { CYCLE_ARCHETYPES, CYCLE_ODM } from './index.js';
import { VEHICLES as PHYSICS, wheelLayout } from '../roads/vehicles.js';
import { cycleFigure, cycleInstanceFaces, cycleRideFigure, readCycleSpec, tipEdges } from './cycle-figure.js';

const ID = Object.keys(CYCLE_ARCHETYPES).find((k) => CYCLE_ARCHETYPES[k].layout.some((e) => CYCLE_ODM[e.sku].kind === 'cycle-stand'));

describe('a cycle drawn', () => {
  it('on the grid: its faces, and what it is', async () => {
    const { faces, stats } = await cycleInstanceFaces({ archetype: ID });
    expect(faces.length).toBeGreaterThan(1000);
    expect(stats).toMatchObject({ archetype: ID, layout: 'inline', laws: true, faces: faces.length });
  });
  it('in a level: the machine the root, a bone at each wheel, centred along its length, leaning on its stand', () => {
    const fig = cycleFigure({ archetype: ID });
    expect(fig.bones.map((b) => b.id)).toEqual(['root', 'wheelF', 'wheelR']);
    const [front, rear] = ['wheelF', 'wheelR'].map((id) => fig.bones.find((b) => b.id === id).head);
    expect(front[1] - rear[1]).toBeCloseTo(PHYSICS[CYCLE_ARCHETYPES[ID].physics].wheelbase, 2);
    expect(Math.abs(front[1] + rear[1])).toBeLessThan(0.2);
    expect(fig.cycle.lean).toBeLessThan(0);
    expect(cycleFigure({ archetype: ID })).toEqual(fig);
  });
  it('stands upright when its pose says so', () => {
    expect(cycleFigure({ archetype: ID, pose: { stand: 'up' } }).cycle.lean).toBeUndefined();
  });
  it('names what it takes when asked for what it does not', () => {
    expect(() => readCycleSpec({ archetype: 'hovercycle' })).toThrow(/archetype is one of/);
    expect(() => readCycleSpec({ archetype: ID, colour: 'red' })).toThrow(/not a cycle's word/);
    expect(() => readCycleSpec({ archetype: ID, pose: { wheelie: 1 } })).toThrow(/not a cycle's pose/);
    expect(() => readCycleSpec({ archetype: ID, look: 'tartan' })).toThrow(/expected one of/);
    expect(() => readCycleSpec({ archetype: ID, rider: { form: 'tiered' } })).toThrow(/realistic hero/);
    expect(() => readCycleSpec({ archetype: ID, rider: true, pose: { stand: 'down' } })).toThrow(/stand up/);
    expect(() => readCycleSpec({ archetype: ID, posture: 'sport' })).toThrow(/give a rider/);
    expect(() => readCycleSpec({ archetype: ID, rider: true, posture: 'sidesaddle' })).toThrow(/expected one of/);
    expect(() => cycleFigure({ archetype: ID, rider: true })).toThrow(/no rider/);
    expect(() => cycleFigure({ archetype: ID, ride: true })).toThrow(/not ridden/);
    expect(() => readCycleSpec({ archetype: ID, ride: 'yes' })).toThrow(/ride is true/);
    expect(() => readCycleSpec({ archetype: ID, ride: true, pose: { steer: 10 } })).toThrow(/posed by its ride/);
  });
});

// one machine per way of standing, chosen in code: two in line, a sidecar's chair beside, and one whose wheels steer on kingpins
const layoutOf = (k) => wheelLayout(PHYSICS[CYCLE_ARCHETYPES[k].physics]);
const INLINE = Object.keys(CYCLE_ARCHETYPES).find((k) => layoutOf(k) === 'inline');
const CHAIR = Object.keys(CYCLE_ARCHETYPES).find((k) => layoutOf(k) === 'sidecar');
const KINGPIN = Object.keys(CYCLE_ARCHETYPES).find((k) => CYCLE_ARCHETYPES[k].layout.some((e) => e.steers === 'kingpin'));

describe('a cycle ridden', () => {
  it('two in line: the front a bone on the steering axis, each wheel rolling, the lean the rule\'s', async () => {
    const fig = await cycleRideFigure({ archetype: INLINE, ride: true });
    const ids = fig.bones.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['root', 'front', 'wheelF', 'wheelR']));
    expect(fig.live).toMatchObject({ ridden: true, lean: 'rule', steer: ['front', 'wheelF'] });
    expect(fig.live.lift).toBeUndefined();
    // the steering axis raked back from the upright (up the head, its top behind its foot), the front orbiting the head
    expect(fig.live.steerAxis[2]).toBeGreaterThan(0.8);
    expect(fig.live.steerAxis[1]).toBeLessThan(0);
    expect(fig.live.steerAt.front).toEqual(fig.bones.find((b) => b.id === 'front').head);
    // everything but the steered leans with the root; the wheels roll with the road
    expect(fig.live.body.bones).toEqual(ids.filter((id) => !fig.live.steer.includes(id)));
    const k = fig.clips.roll.k, at = (key, bone) => fig.clips.roll.b.slice((key * ids.length + ids.indexOf(bone)) * 7, (key * ids.length + ids.indexOf(bone)) * 7 + 4);
    expect(at(k / 4, 'wheelR')[0]).not.toBe(0);
    expect(at(k / 4, 'front')).toEqual([0, 0, 0, 1]);
    expect(fig.wheelbase).toBeCloseTo(PHYSICS[CYCLE_ARCHETYPES[INLINE].physics].wheelbase, 1);
    expect(await cycleRideFigure({ archetype: INLINE, ride: true })).toEqual(fig);
  });
  it('a sidecar outfit: it tips over the bike\'s own line sooner than over the chair\'s', async () => {
    const fig = await cycleRideFigure({ archetype: CHAIR, ride: true });
    const chair = fig.bones.filter((b) => b.id.startsWith('wheel')).reduce((m, b) => (Math.abs(b.head[0]) > Math.abs(m.head[0]) ? b : m));
    // (the chair's side: a turn away from it throws the machine over the bike, and the chair flies)
    const over = chair.head[0] > 0 ? fig.live.lift.l : fig.live.lift.r, toward = chair.head[0] > 0 ? fig.live.lift.r : fig.live.lift.l;
    expect(over.ssf).toBeLessThan(toward.ssf);
    expect(Math.abs(over.x)).toBeLessThan(0.05);
    expect(fig.live.lean).toBeUndefined();
  });
  it('a kingpin wheel turns on its own upright, the bars on the column\'s axis', async () => {
    const fig = await cycleRideFigure({ archetype: KINGPIN, ride: true });
    const kp = CYCLE_ARCHETYPES[KINGPIN].layout.filter((e) => e.steers === 'kingpin').map((e) => e.id);
    for (const id of kp) { expect(fig.live.steer).toContain(id); expect(fig.live.steerAt[id]).toBeUndefined(); }
    expect(fig.live.steerAt.front).toBeTruthy();
  });
  it('reads a symmetric machine\'s tipping edges alike each side', () => {
    const e = tipEdges([[0, 1.2, 0], [-0.5, 0, 0], [0.5, 0, 0]], { drive: 'rear', share: 0.6, cgH: 0.6 }, 'delta');
    expect(e.r.ssf).toBeCloseTo(e.l.ssf, 6);
    expect(e.r.x).toBeCloseTo(-e.l.x, 6);
    expect(e.r.x).toBeGreaterThan(0);
    expect(e.r.x).toBeLessThan(0.5);
  });
});
