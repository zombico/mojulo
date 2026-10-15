/**
 * The craft shelf swept end to end: every inventory part builds clean, every archetype assembles to its class
 * figures. Minutes, not seconds, so it lives in the deep tier; `test:deep:changed` selects it when the shelf moves.
 */
import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { planAssembler } from '../worlds/workbench-assembler.js';
import { CRAFT_ARCHETYPES, CRAFT_ODM, assembleCraft, resolveCraftPart } from './index.js';

// What a thrust-to-weight at maximum take-off mass looks like per class (afterburner counted for the fighter).
const THRUST_TO_WEIGHT = {
  'jet fighter': [0.4, 1.3],
  'attack jet': [0.25, 0.6],
  'stealth jet': [0.3, 0.6],
  'star liner': [0.5, 1.5],
  'stealth raider': [1, 3],
  trainer: [1, 3],
  'business jet': [0.25, 0.5],
  airliner: [0.25, 0.4],
  'space superiority fighter': [2, 5],
  interceptor: [1.2, 3],
  'panel fighter': [1, 3],
  'heavy fighter': [1.5, 4],
  bomber: [1, 3],
  'utility shuttle': [1, 3],
};

describe('every inventory part', () => {
  it.each(Object.keys(CRAFT_ODM))('%s builds without an open shell', (sku) => {
    const { stats } = planWorkbench(resolveCraftPart(sku));
    expect(stats.faces).toBeGreaterThan(0);
    expect((stats.warnings || []).filter((w) => /open shell/.test(w))).toEqual([]);
  });
});

describe('every archetype', () => {
  it.each(Object.keys(CRAFT_ARCHETYPES))('%s assembles to its class figures', (id) => {
    const { manifest, readout } = assembleCraft(id);
    const { measures: m, reference: r } = readout;
    expect(Math.abs(m.span / r.span - 1)).toBeLessThan(0.08);
    expect(Math.abs(m.length / r.length - 1)).toBeLessThan(0.08);
    expect(Math.abs(m.height / r.height - 1)).toBeLessThan(0.1);
    expect(readout.audit.ok).toBe(true);
    expect(planAssembler(manifest).stats.warnings).toBeUndefined();
    if (readout.gear.length) for (const g of readout.gear) expect(Math.abs(g.contact[2])).toBeLessThan(0.03);
    if (readout.realm === 'earth') {
      if (readout.clearance['craft-propeller'] !== undefined) expect(readout.clearance['craft-propeller']).toBeGreaterThan(0.2);
      if (readout.class !== 'jet fighter' && readout.clearance['craft-engine'] !== undefined) expect(readout.clearance['craft-engine']).toBeGreaterThan(0.3);
      if (readout.class !== 'piston fighter') expect(Math.abs(readout.pitch)).toBeLessThan(1);
    }
    const band = THRUST_TO_WEIGHT[readout.class];
    if (band) {
      expect(readout.thrustToWeight).toBeGreaterThan(band[0]);
      expect(readout.thrustToWeight).toBeLessThan(band[1]);
    }
  });
});

describe('every archetype, posed', () => {
  const POSE = { gear: 1, flaps: 1, canopy: 1, roll: 0.6, pitch: -0.4, yaw: 0.5, prop: 20 };
  it.each(Object.keys(CRAFT_ARCHETYPES))('%s articulates without tearing a part', (id) => {
    const { manifest, readout } = assembleCraft(id, { pose: POSE });
    expect(planAssembler(manifest).stats.warnings).toBeUndefined();
    const seen = new Set();
    for (const item of manifest.items) {
      const key = JSON.stringify(item.source.garage.joints || []) + item.source.garage.sku;
      if (seen.has(key)) continue;
      seen.add(key);
      const { stats } = planWorkbench(item.source);
      expect((stats.warnings || []).filter((w) => /open shell/.test(w)), item.id).toEqual([]);
    }
    if (readout.realm === 'earth') expect(readout.joints.length).toBeGreaterThan(0);
  });
});
