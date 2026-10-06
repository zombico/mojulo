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
    expect(bolt).toMatchObject({ code: 'M3x16-socket', qty: 4, standard: 'ISO 4762', for: ['lid'] });
    expect(p.bom.find((b) => b.part === 'radial-bearing')).toMatchObject({ code: '608', qty: 2 });
    expect(p.cuts.filter((c) => c.need === 'lid').map((c) => c.qty)).toEqual([4, 4]);
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
});
