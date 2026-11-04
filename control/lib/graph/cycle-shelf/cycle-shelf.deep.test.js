/**
 * The cycle shelf swept end to end: every inventory part builds closed, every archetype assembles at its class's numbers
 * with every law held, and articulates (steered to either lock, parked on its stand) without a part tearing. Seconds per
 * machine, so it lives in the deep tier; `test:deep:changed` selects it when the shelf moves.
 */
import { describe, it, expect } from 'vitest';

import { lowerObjectFaces, planWorkbench } from '../worlds/workbench.js';
import { planAssembler } from '../worlds/workbench-assembler.js';
import { CYCLE_ARCHETYPES, CYCLE_ODM, assembleCycle, resolveCyclePart } from './index.js';

describe('every inventory part', () => {
  it.each(Object.keys(CYCLE_ODM))('%s builds without an open shell', (sku) => {
    const { stats } = planWorkbench(resolveCyclePart(sku));
    expect(stats.faces).toBeGreaterThan(0);
    expect((stats.warnings || []).filter((w) => /open shell/.test(w))).toEqual([]);
  });
});

describe('every archetype', () => {
  it.each(Object.keys(CYCLE_ARCHETYPES))('%s assembles at its class, its laws held', (id) => {
    const { manifest, readout } = assembleCycle(id);
    expect(planAssembler(manifest).stats.warnings).toBeUndefined();
    expect(readout.laws.laws.filter((l) => !l.ok)).toEqual([]);
    expect(readout.audit.ok).toBe(true);
    for (const c of readout.contacts) expect(Math.abs(c.at[2])).toBeLessThan(0.003);
    expect(manifest.items.reduce((n, it) => n + lowerObjectFaces(it.source).reduce((m, f) => m + f.corners.length - 2, 0), 0)).toBeLessThan(40000);
  });
  it.each(Object.keys(CYCLE_ARCHETYPES))('%s steers to either lock and parks on its stand without tearing', (id) => {
    for (const pose of [{ steer: 40 }, { steer: -40 }, { stand: 'down' }, { stand: 'down', steer: -40 }]) {
      const { manifest } = assembleCycle(id, { pose });
      expect(planAssembler(manifest).stats.warnings, JSON.stringify(pose)).toBeUndefined();
    }
  });
});
