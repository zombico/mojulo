// The supercar on the grid: a composed supercar as a vehicle rig and its rule. The concepts: four wheel bones at the
// design's hubs and the lamps' bones the page lights; the rule the sports class at the car's own frame; in a mood the
// paint lit again and the lamps as they shine, the headlamps brighter after dark; junk refused; deterministic. One
// card, chosen from the library.
import { describe, it, expect } from 'vitest';
import { supercarFigure, supercarRule, readSupercarSpec } from './supercar-figure.js';
import { composeSupercar, SUPERCAR_LIBRARY } from './vehicle-library.js';
import { VEHICLES } from '../roads/vehicles.js';

const preset = Object.keys(SUPERCAR_LIBRARY)[0], spec = { preset, seed: 5 };
const fig = supercarFigure(spec), night = supercarFigure({ ...spec, mood: 'night' });
const design = composeSupercar({ preset, seed: 5, surface: { quality: 'game' } }).design;

describe('the supercar on the grid', () => {
  it('is a vehicle rig: four wheels at the design\'s hubs, the lamps\' bones, steering and a body that moves', () => {
    expect(fig).toMatchObject({ rig: true, model: 'vehicle' });
    const head = Object.fromEntries(fig.bones.map((b) => [b.id, b.head]));
    for (const w of ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']) expect(head[w]).toEqual(design.topology.anchors[w]);
    expect(Object.keys(head)).toEqual(expect.arrayContaining(['root', 'lampHead', 'lampBrake']));
    expect(fig.wheelRadius).toBeCloseTo(design.frame.wheelRadius, 4);
    expect(fig.live.steer).toEqual(['wheelFL', 'wheelFR']);
    expect(fig.juice.slots).toEqual({ head: 'lampHead', brake: 'lampBrake' });
    expect(fig.juice.anchors.filter((a) => a.kind === 'tip')).toHaveLength(2);
  });

  it('drives on the sports class at its own frame', () => {
    const rule = supercarRule(design, { tuning: 'arcade' });
    expect(rule).toMatchObject({ type: 'drive', vehicle: 'sports', tuning: 'arcade', mass: VEHICLES.sports.mass });
    expect(rule.wheelbase).toBeCloseTo(fig.wheelbase, 3);
    expect(rule.collideRadius).toBeCloseTo(design.frame.W / 2, 2);
  });

  it('in a mood: the paint lit again, the lamps as they shine, the headlamps up after dark', () => {
    expect(JSON.stringify(night.parts[0])).not.toBe(JSON.stringify(fig.parts[0]));
    const headIx = fig.bones.findIndex((b) => b.id === 'lampHead');
    expect(night.parts[headIx].col).toBe(fig.parts[headIx].col);
    const amount = (F) => F.juice.status.find((s) => s.id === 'headlamps').amount;
    expect(amount(night)).toBeGreaterThan(amount(fig));
  });

  it('refuses what is not a supercar, and is the same every time', () => {
    expect(() => readSupercarSpec({ preset: 'hatchback' })).toThrow(/preset is one of/);
    expect(() => readSupercarSpec({ mood: 'midnight' })).toThrow(/mood is one of/);
    expect(() => readSupercarSpec({ wings: 2 })).toThrow(/'wings' is not one of/);
    expect(JSON.stringify(supercarFigure(spec))).toBe(JSON.stringify(fig));
  });
});
