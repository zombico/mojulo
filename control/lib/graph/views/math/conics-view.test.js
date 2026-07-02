import { describe, expect, it } from 'vitest';

import { planConicsScene, assembleConicsScene, CONICS_SCENARIOS } from './conics-view.js';

const countGroup = (faces, group) => faces.filter((f) => f.group === group).length;

describe('planConicsScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planConicsScene({ scenario: 'parabola' }))).toBe(JSON.stringify(planConicsScene({ scenario: 'parabola' })));
  });

  it('falls back to ellipse on an unknown scenario', () => {
    expect(planConicsScene({ scenario: 'spiral' }).stats.scenario).toBe('ellipse');
  });

  it('exposes the four conic scenarios', () => {
    expect(CONICS_SCENARIOS).toEqual(['circle', 'ellipse', 'parabola', 'hyperbola']);
  });

  it('every scenario bakes a translucent cone, a cutting plane, and a bright conic ribbon', () => {
    for (const scen of CONICS_SCENARIOS) {
      const plan = planConicsScene({ scenario: scen });
      expect(countGroup(plan.faces, 'cone')).toBeGreaterThan(0);
      expect(countGroup(plan.faces, 'plane')).toBeGreaterThan(0);
      expect(countGroup(plan.faces, 'conic')).toBeGreaterThan(0);
    }
  });
});

describe('conics-view — the conic curve breaks for OPEN sections (the geometry)', () => {
  it('circle & ellipse are CLOSED: more conic ribbons than the OPEN parabola', () => {
    const circle = countGroup(planConicsScene({ scenario: 'circle' }).faces, 'conic');
    const ellipse = countGroup(planConicsScene({ scenario: 'ellipse' }).faces, 'conic');
    const parabola = countGroup(planConicsScene({ scenario: 'parabola' }).faces, 'conic');
    expect(circle).toBeGreaterThan(parabola);
    expect(ellipse).toBeGreaterThan(parabola);
  });

  it('hyperbola is OPEN too: fewer conic ribbons than the closed ellipse', () => {
    const ellipse = countGroup(planConicsScene({ scenario: 'ellipse' }).faces, 'conic');
    const hyperbola = countGroup(planConicsScene({ scenario: 'hyperbola' }).faces, 'conic');
    expect(ellipse).toBeGreaterThan(hyperbola);
  });

  it('plane tilt γ increases monotonically: circle < ellipse < parabola < hyperbola', () => {
    const g = (scen) => planConicsScene({ scenario: scen }).stats.gammaDeg;
    expect(g('circle')).toBe(0);
    expect(g('circle')).toBeLessThan(g('ellipse'));
    expect(g('ellipse')).toBeLessThan(g('parabola'));
    expect(g('parabola')).toBeLessThan(g('hyperbola'));
  });
});

describe('assembleConicsScene — payload', () => {
  it('threads scaled faces, 3/4 camera first, no surfaces channel', () => {
    const payload = assembleConicsScene({ scenario: 'circle' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('3/4');
  });
});
