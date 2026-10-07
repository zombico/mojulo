import { describe, it, expect } from 'vitest';
import { fabricationPlan, needsError, planModules, unplacedModules, FABRICATOR_VERSION } from './plan.js';

// A small powered box: a lid opened often, a shaft on bearings, a seal, a board inside.
const SPEC = {
  host: 'printed',
  needs: [
    { id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4 },
    { id: 'axle', function: 'spin', shaftD: 8, loadN: 300 },
    { id: 'gasket', function: 'seal', sealD: 70 },
    { id: 'pi', function: 'mount', to: 'board', board: 'rpi4' },
  ],
};

describe('fabricator plan', () => {
  it('gathers what is bought into one bill of materials, counted across needs', () => {
    const p = fabricationPlan(SPEC);
    expect(p.version).toBe(FABRICATOR_VERSION);
    expect(p.needs.map((n) => [n.id, n.strategy])).toEqual([['lid', 'heatset-bolt'], ['axle', 'ball-bearing'], ['gasket', 'o-ring'], ['pi', 'rpi']]);
    const bolt = p.bom.find((b) => b.part === 'socket-bolt');
    expect(bolt).toMatchObject({ code: 'M3x16-socket', count: 4, tool: '2.5 mm hex key', standard: 'ISO 4762', for: ['lid'] });
    // 300 N on two bearings: the slim 688 carries 150 N each at a safety factor near 4 (sized by its static rating).
    expect(p.bom.find((b) => b.part === 'radial-bearing')).toMatchObject({ code: '688', count: 2 });
    expect(p.cuts.filter((c) => c.need === 'lid').map((c) => c.count)).toEqual([4, 4]);
  });

  it('spec-level host and tags sit under each need; a need\'s own value wins', () => {
    const p = fabricationPlan({ host: 'wood', tags: ['flat-pack'], needs: [{ function: 'fasten' }, { function: 'fasten', host: 'printed', cycles: 200 }] });
    expect(p.needs.map((n) => n.strategy)).toEqual(['cam-lock', 'heatset-bolt']);
    expect(p.needs[0].id).toBe('fasten-1');
  });

  it('carries each notice once, and the gaps and refusals by need', () => {
    const p = fabricationPlan({ needs: [{ function: 'mount', to: 'action-cam' }, { function: 'mount', to: 'action-cam' }, { function: 'mount', to: 'board', board: 'esp32' }] });
    expect(p.notices.filter((n) => /GoPro/.test(n))).toHaveLength(1);
    expect(p.refused.map((r) => r.strategy)).toEqual(['action-cam-print', 'action-cam-print']);
    expect(p.gaps).toEqual([{ need: 'mount-3', function: 'mount', why: expect.any(String) }]);
  });

  it('is deterministic, and names the modules the source should place', () => {
    expect(JSON.stringify(fabricationPlan(SPEC))).toBe(JSON.stringify(fabricationPlan(SPEC)));
    const p = fabricationPlan(SPEC);
    expect(planModules(p)).toEqual(['mj_bearing_seat', 'mj_board_standoffs', 'mj_counterbore', 'mj_heatset_hole', 'mj_oring_groove']);
    expect(unplacedModules(p, 'mj_bearing_seat("608"); mj_heatset_hole("M5", 10);')).toEqual(['mj_board_standoffs', 'mj_counterbore', 'mj_oring_groove']);
  });

  it('teaches a malformed needs list', () => {
    expect(needsError(undefined)).toMatch(/non-empty array/);
    expect(needsError([{ function: 'weld' }])).toMatch(/not one of fasten/);
    expect(needsError([{ function: 'fasten', tags: ['shiny'] }])).toMatch(/unknown shiny/);
    expect(needsError([{ function: 'fasten', count: 0 }])).toMatch(/positive integer/);
    expect(() => fabricationPlan({ needs: [] })).toThrow(/non-empty/);
  });

  // The agent trials of 2026-10-06, each finding replayed.
  describe('the agent trials', () => {
    it('spool holder: inserts are bought, seats match bearings, the bolt clears the hole, the shaft is retained', () => {
      const p = fabricationPlan({ host: 'printed', needs: [{ id: 'axle', function: 'spin', shaftD: 8 }, { id: 'arm', function: 'fasten', tags: ['serviceable'], count: 2 }] });
      expect(p.bom.find((l) => l.part === 'heat-set-insert')).toMatchObject({ label: 'M3 heat-set insert', count: 2 });
      expect(p.bom.find((l) => l.part === 'radial-bearing').count).toBe(p.cuts.find((c) => c.call.startsWith('mj_bearing_seat')).count);
      expect(p.cuts.find((c) => c.call.startsWith('mj_heatset_hole')).call).toBe('mj_heatset_hole("M3", 8)');   // M3×16 at 10 mm grip: 6 in, 2 to spare
      expect(p.needs.find((n) => n.id === 'arm').assumes).toEqual({ grip: 10, size: null });
      expect(p.cuts.every((c) => typeof c.where === 'string' && c.where.length > 0)).toBe(true);
      expect(p.suggestions).toEqual([{ from: 'axle', function: 'retain', shaftD: 8, why: expect.any(String) }]);
      expect(fabricationPlan({ needs: [{ function: 'spin', shaftD: 8 }, { function: 'retain', shaftD: 8 }] }).suggestions).toEqual([]);
    });

    it('Pi box: the box is one job, its seal, gland and vent are suggested, the board screws are bought', () => {
      const p = fabricationPlan({ host: 'printed', needs: [
        { id: 'box', function: 'enclose', tags: ['waterproof'], board: 'rpi4', inner: [96, 66, 30] },
        { id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4 },
      ] });
      expect(p.needs[0].strategy).toBe('sealed-board-box');
      expect(p.overlaps).toEqual([{ need: 'lid', coveredBy: 'box', why: expect.stringMatching(/already does the fasten job/) }]);
      expect(p.suggestions.map((s) => s.through || 'rim')).toEqual(['rim', 'cable', 'vent']);
      expect(p.bom.find((l) => l.label === 'M2.5 heat-set insert')).toMatchObject({ count: 4 });
      expect(p.bom.find((l) => l.label === 'M2.5×6 socket head cap screw')).toMatchObject({ count: 4, code: null });
      expect(p.bom.filter((l) => /O-ring/.test(l.label))).toEqual([]);   // no phantom ring: the seal is its own need
      const sealed = fabricationPlan({ host: 'printed', needs: [
        { id: 'box', function: 'enclose', tags: ['waterproof'], board: 'rpi4', inner: [96, 66, 30] },
        { id: 'rim', function: 'seal', rim: [104, 74] }, { id: 'cable', function: 'seal', through: 'cable' }, { id: 'vent', function: 'seal', through: 'vent' },
      ] });
      expect(sealed.suggestions).toEqual([]);
      expect(sealed.needs.map((n) => n.strategy)).toEqual(['sealed-board-box', 'cord-seal', 'cable-gland', 'breather-vent']);
      expect(sealed.bom.find((l) => l.part === 'o-ring-cord').label).toBe('O-ring cord ⌀2.62 mm, 400 mm (the rim plus a 10 % margin)');
      expect(sealed.cuts.find((c) => c.need === 'rim').call).toBe('mj_oring_gland(2.62)');
    });

    it('bookcase: shelves are pins, a back is a groove, the wall fixing is a kit, the frame counts its fittings, no printed kit', () => {
      const p = fabricationPlan({ host: 'wood', tags: ['flat-pack'], needs: [
        { id: 'carcass', function: 'fasten', count: 4 }, { id: 'shelves', function: 'store', count: 4 },
        { id: 'back', function: 'enclose' }, { id: 'wall', function: 'mount', to: 'wall' }, { id: 'odd', function: 'catch', tags: ['print-only'] },
      ] });
      expect(p.needs.map((n) => [n.strategy, n.executor])).toEqual([['cam-lock', 'frames'], ['shelves', 'frames'], ['grooved-back', 'frames'], ['anti-tip', 'none'], ['mint-catch', 'frames']]);
      expect(p.joints.map((j) => j.type)).toEqual(['cam-lock', 'shelf-pin', 'groove']);
      const cams = p.bom.find((l) => l.code === 'cam-15');
      expect(cams).toMatchObject({ count: null, perJoint: 1, note: expect.stringMatching(/counted by the frame/) });
      expect(p.bom.find((l) => l.part === 'anti-tip-kit')).toMatchObject({ count: 1 });
      expect(p.kit).toEqual([]);
    });
  });
});
