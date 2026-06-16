import { describe, expect, it } from 'vitest';

import {
  compileFacadeWrapToFacePatterns,
  computeFacadeWrapPlateLayout,
  resolveFacadeWrapNet,
  walkFacadeWrapNet,
} from './facade-wrap-net.js';

const BASIC = {
  role: 'test-wrap',
  floors: 3,
  perimeter: [
    { face: 'front', bays: 2 },
    { face: 'right', bays: 1 },
  ],
  rhythm: ['window', 'balcony'],
  motifs: { window: 'french-window', balcony: 'projecting-rail-slab' },
};

describe('facade wrap-net planner', () => {
  it('walks every face bay for every architectural floor', () => {
    const net = resolveFacadeWrapNet(BASIC);
    const cells = walkFacadeWrapNet(net);

    expect(net.totalBays).toBe(3);
    expect(cells).toHaveLength(9);
    expect(cells[0]).toMatchObject({
      face: 'front',
      bayOnFace: 0,
      floor: 1,
      row: 2,
      wrapIndex: 0,
      motif: 'window',
      motifRef: 'french-window',
    });
    expect(cells[2]).toMatchObject({
      face: 'right',
      bayOnFace: 0,
      floor: 1,
      wrapIndex: 2,
      motif: 'window',
      cornerPrev: 'front',
      cornerNext: 'front',
    });
  });

  it('keeps rhythm phase continuous across face boundaries', () => {
    const cells = walkFacadeWrapNet({
      ...BASIC,
      floors: 1,
      perimeter: [
        { face: 'front', bays: 3 },
        { face: 'right', bays: 2 },
      ],
      rhythm: ['a', 'b', 'c'],
    });

    expect(cells.map((cell) => `${cell.face}:${cell.bayOnFace}:${cell.motif}`)).toEqual([
      'front:0:a',
      'front:1:b',
      'front:2:c',
      'right:0:a',
      'right:1:b',
    ]);
  });

  it('applies floor zones, cores, and void exclusions with stable provenance', () => {
    const net = resolveFacadeWrapNet({
      ...BASIC,
      floors: 5,
      zones: [
        { id: 'podium', floors: [1, 2], rhythm: ['shopfront'] },
        { id: 'crown', floors: [5, 5], motif: 'mechanical-screen' },
      ],
      cores: [
        { id: 'east-stair', face: 'right', bays: [0], floors: [1, 5], motif: 'stairwell' },
      ],
      voids: [
        { id: 'sky-garden', face: 'front', bay: 1, floors: [3, 4] },
      ],
    });
    const visible = walkFacadeWrapNet(net);
    const all = walkFacadeWrapNet(net, { includeExcluded: true });

    expect(all).toHaveLength(15);
    expect(visible).toHaveLength(13);
    expect(all.find((cell) => cell.face === 'front' && cell.bayOnFace === 0 && cell.floor === 1).motif).toBe('shopfront');
    expect(all.find((cell) => cell.face === 'front' && cell.bayOnFace === 0 && cell.floor === 5).motif).toBe('mechanical-screen');
    expect(all.find((cell) => cell.face === 'right' && cell.floor === 4).motif).toBe('stairwell');
    const voidCell = all.find((cell) => cell.face === 'front' && cell.bayOnFace === 1 && cell.floor === 3);
    expect(voidCell.excluded).toBe(true);
    expect(voidCell.void).toBe('sky-garden');
    expect(voidCell.provenance).toMatchObject({
      role: 'test-wrap',
      face: 'front',
      bayOnFace: 1,
      floor: 3,
    });
  });

  it('groups planned cells by face for downstream projection', () => {
    const compiled = compileFacadeWrapToFacePatterns(BASIC);

    expect(compiled.faces.map((face) => [face.face, face.cols, face.rows, face.cells.length])).toEqual([
      ['front', 2, 3, 6],
      ['right', 1, 3, 3],
    ]);
    expect(compiled.diagnostics.cellsPlanned).toBe(9);
    expect(compiled.diagnostics.perimeterBays).toEqual({ front: 2, right: 1 });
  });

  it('computes a plate layout with one band per perimeter face', () => {
    const layout = computeFacadeWrapPlateLayout(BASIC, { cellW: 10, cellH: 8, gap: 1, faceGap: 5, labelH: 12 });

    expect(layout.faces).toHaveLength(2);
    expect(layout.faces[0]).toMatchObject({ face: 'front', w: 21, h: 26, bays: 2, floors: 3 });
    expect(layout.faces[1].x).toBe(layout.faces[0].x + layout.faces[0].w + 5);
    expect(layout.bounds.width).toBe(36);
    expect(layout.bounds.height).toBe(38);
  });
});
