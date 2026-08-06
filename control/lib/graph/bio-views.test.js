import { describe, expect, it } from 'vitest';

import { planEnergyCycle, assembleEnergyCycleScene } from './views/bio/energy-cycle.js';
import { planDnaProcess, assembleDnaProcessScene, DNA_PROCESSES } from './views/bio/dna-process.js';
import { classifyBucket } from './sketch/sketch-manifest.js';

const finite3 = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(v));
const facesValid = (faces) => faces.length > 0 && faces.every((f) => f.corners.length >= 3 && f.corners.every(finite3) && /^#[0-9a-fA-F]{6}$/.test(f.fill));
const moversValid = (movers) => movers.every((m) => typeof m.group === 'string' && Array.isArray(m.basePos) && Array.isArray(m.path) && m.path.length > 1 && m.path.every(finite3));

describe('energy-cycle', () => {
  it('builds a valid timed cascade payload', () => {
    const plan = planEnergyCycle({});
    expect(facesValid(plan.faces)).toBe(true);
    expect(plan.movers.length).toBe(5);
    // every molecule mover carries a lifetime window on the shared clock.
    expect(plan.movers.every((m) => Number.isFinite(m.t0) && Number.isFinite(m.t1) && m.t1 > m.t0)).toBe(true);
    expect(moversValid(plan.movers)).toBe(true);
    expect(plan.picks.find((p) => p.name === 'chloroplast')).toBeTruthy();
    expect(plan.picks.find((p) => p.name === 'mitochondrion')).toBeTruthy();
  });
  it('assembles an emitThreeWorld payload', () => {
    const p = assembleEnergyCycleScene({}, { title: 't' });
    expect(p.cameras.length).toBe(2);
    expect(p.movers.length).toBe(5);
    expect(p.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it('speed scales the timeline', () => {
    const slow = planEnergyCycle({ speed: 1 }).movers[0].t1;
    const fast = planEnergyCycle({ speed: 2 }).movers[0].t1;
    expect(fast).toBeLessThan(slow);
  });
  it('classifies as a world', () => {
    expect(classifyBucket({ kind: 'energy-cycle' })).toBe('object');
  });
});

describe('dna-process', () => {
  for (const process of DNA_PROCESSES) {
    it(`builds a valid animated payload for '${process}'`, () => {
      const plan = planDnaProcess({ process });
      expect(plan.process).toBe(process);
      expect(facesValid(plan.faces)).toBe(true);
      expect(plan.movers.length).toBeGreaterThan(0);
      expect(moversValid(plan.movers)).toBe(true);
      const payload = assembleDnaProcessScene({ process });
      expect(payload.cameras.length).toBe(2);
      expect(payload.movers.length).toBe(plan.movers.length);
    });
  }
  it("defaults to meiosis and rejects nothing (unknown → meiosis)", () => {
    expect(planDnaProcess({}).process).toBe('meiosis');
    expect(planDnaProcess({ process: 'bogus' }).process).toBe('meiosis');
  });
  it('classifies as a world', () => {
    expect(classifyBucket({ kind: 'dna-process', process: 'meiosis' })).toBe('object');
  });
});
