// A cycle shelf machine as the doors draw it: its faces on the studio grid, and its figure in a level (the machine the
// root, a bone at each wheel, centred along its length, parked leaning on its stand). One machine with a stand, chosen
// in code; the words a cycle takes, and those it refuses.
import { describe, it, expect } from 'vitest';
import { CYCLE_ARCHETYPES, CYCLE_ODM } from './index.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { cycleFigure, cycleInstanceFaces, readCycleSpec } from './cycle-figure.js';

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
  });
});
