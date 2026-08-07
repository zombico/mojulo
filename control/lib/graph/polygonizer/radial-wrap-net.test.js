import { describe, expect, it } from 'vitest';

import {
  compileRadialWrapToRings,
  computeRadialWrapPlateLayout,
  radiusScaleAtFloor,
  resolveRadialWrapNet,
  walkRadialWrapNet,
} from './radial-wrap-net.js';

const BASIC = {
  role: 'heroic-radial',
  floors: 4,
  segments: 8,
  phaseDeg: 0,
  rhythm: ['glass', 'fin'],
  motifs: { glass: 'blue-glass', fin: 'silver-fin' },
};

describe('radial wrap-net planner', () => {
  it('walks segment x floor cells with closed seam metadata', () => {
    const net = resolveRadialWrapNet(BASIC);
    const cells = walkRadialWrapNet(net);

    expect(cells).toHaveLength(32);
    expect(cells[0]).toMatchObject({
      segment: 0,
      floor: 1,
      row: 3,
      motif: 'glass',
      motifRef: 'blue-glass',
      seamPrev: 7,
    });
    expect(cells[7]).toMatchObject({
      segment: 7,
      floor: 1,
      motif: 'fin',
      seamNext: 0,
    });
  });

  it('applies zones, angular spines, and sky-lobby voids', () => {
    const net = resolveRadialWrapNet({
      ...BASIC,
      floors: 10,
      zones: [
        { id: 'podium', floors: [1, 2], rhythm: ['lobby'] },
        { id: 'crown', floors: [9, 10], motif: 'crown-glass' },
      ],
      spines: [
        { id: 'north-service-spine', thetaRange: [80, 120], floors: [1, 10], motif: 'service-spine' },
      ],
      voids: [
        { id: 'sky-lobby', segments: [2, 3], floors: [5, 6] },
      ],
    });
    const all = walkRadialWrapNet(net, { includeExcluded: true });
    const visible = walkRadialWrapNet(net);

    expect(all).toHaveLength(80);
    expect(visible).toHaveLength(76);
    expect(all.find((cell) => cell.floor === 1 && cell.segment === 0).motif).toBe('lobby');
    expect(all.find((cell) => cell.floor === 10 && cell.segment === 0).motif).toBe('crown-glass');
    expect(all.some((cell) => cell.spine === 'north-service-spine' && cell.motif === 'service-spine')).toBe(true);
    const voidCell = all.find((cell) => cell.floor === 5 && cell.segment === 2);
    expect(voidCell.excluded).toBe(true);
    expect(voidCell.void).toBe('sky-lobby');
  });

  it('interpolates a taper radius profile by floor', () => {
    const net = resolveRadialWrapNet({
      ...BASIC,
      floors: 5,
      radiusProfile: [
        { floor: 1, radius: 1.2 },
        { floor: 3, radius: 1.0 },
        { floor: 'top', radius: 0.72 },
      ],
    });

    expect(radiusScaleAtFloor(net, 1)).toBeCloseTo(1.2);
    expect(radiusScaleAtFloor(net, 3)).toBeCloseTo(1.0);
    expect(radiusScaleAtFloor(net, 5)).toBeCloseTo(0.72);
    expect(radiusScaleAtFloor(net, 4)).toBeCloseTo(0.86);
  });

  it('groups cells by architectural floor for ring projection', () => {
    const compiled = compileRadialWrapToRings(BASIC);

    expect(compiled.rings).toHaveLength(4);
    expect(compiled.rings[0].floor).toBe(1);
    expect(compiled.rings[0].cells).toHaveLength(8);
    expect(compiled.diagnostics.cellsPlanned).toBe(32);
  });

  it('computes an unwrapped theta tape plate', () => {
    const layout = computeRadialWrapPlateLayout(BASIC, { cellW: 10, cellH: 8, gap: 1, labelH: 12 });

    expect(layout.tape).toMatchObject({ segments: 8, floors: 4, w: 87, h: 35 });
    expect(layout.bounds).toEqual({ width: 87, height: 47 });
  });
});
