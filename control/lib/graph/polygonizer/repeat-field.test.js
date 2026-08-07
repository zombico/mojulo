/**
 * Unit + adapter-equivalence tests for repeat-field.js.
 *
 * The "adapter equivalence" tests at the bottom are the load-bearing ones:
 * they construct a RepeatField that intends to match each existing
 * repeater mark (array, partition, facade-bays, manjiLevelRepeater) and
 * assert the walked cells match what the existing renderer logic produces.
 * If those parity tests stay green, the existing expanders in
 * neo-rembrandt/index.js can be migrated to thin adapters one at a time
 * without shifting any cell positions.
 */

import { describe, it, expect } from 'vitest';
import {
  sequenceMotif,
  byCell,
  byPredicate,
  byRole,
  lineFrame,
  axisFrame,
  uvFaceFrame,
  radialFrame,
  cardinalManjiFrame,
  facadeManjiFrame,
  lineManjiFrame,
  repeatField,
  walk,
} from './repeat-field.js';

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

describe('sequenceMotif', () => {
  const cell = (index, extras = {}) => ({ index, total: 10, ...extras });

  it('treats a singleton sequence as uniform', () => {
    const m = sequenceMotif(['french-window']);
    expect(m.length).toBe(1);
    for (let i = 0; i < 5; i++) {
      const pick = m.pick(cell(i));
      expect(pick.motif).toBe('french-window');
      expect(pick.sequenceIndex).toBe(0);
      expect(pick.repeatIndex).toBe(i);
    }
  });

  it('wraps a rhythm-style sequence and bumps repeatIndex per cycle', () => {
    const m = sequenceMotif(['french-window', 'french-window', 'balcony']);
    const expected = [
      { motif: 'french-window', sequenceIndex: 0, repeatIndex: 0 },
      { motif: 'french-window', sequenceIndex: 1, repeatIndex: 0 },
      { motif: 'balcony',       sequenceIndex: 2, repeatIndex: 0 },
      { motif: 'french-window', sequenceIndex: 0, repeatIndex: 1 },
      { motif: 'french-window', sequenceIndex: 1, repeatIndex: 1 },
      { motif: 'balcony',       sequenceIndex: 2, repeatIndex: 1 },
    ];
    expected.forEach((want, i) => expect(m.pick(cell(i))).toEqual(want));
  });

  it('keys 2D cells off col, so the same motif column repeats top-to-bottom', () => {
    const m = sequenceMotif(['french-window', 'french-window', 'balcony']);
    // col determines the motif; row is irrelevant for the phase choice.
    expect(m.pick({ index: 17, col: 0, row: 2, total: 30 }).motif).toBe('french-window');
    expect(m.pick({ index: 23, col: 2, row: 3, total: 30 }).motif).toBe('balcony');
    expect(m.pick({ index: 11, col: 5, row: 1, total: 30 }).motif).toBe('balcony');
    expect(m.pick({ index: 12, col: 3, row: 2, total: 30 }).repeatIndex).toBe(1);
  });

  it('honors phaseKey: "index" to force linear keying even on 2D cells', () => {
    const m = sequenceMotif(['a', 'b', 'c'], { phaseKey: 'index' });
    expect(m.pick({ index: 4, col: 0, row: 0 }).motif).toBe('b');
  });

  it('falls back to a null singleton when given an empty/invalid sequence', () => {
    for (const input of [null, undefined, [], 'french-window']) {
      const m = sequenceMotif(input);
      expect(m.length).toBe(1);
      expect(m.pick(cell(0)).motif).toBe(null);
    }
  });
});

describe('exclusions', () => {
  it('byCell matches index, (col,row), col-only, row-only', () => {
    const ex = byCell({ index: 2 }, { col: 1, row: 0 }, [3, 4]);
    expect(ex.test({ index: 2 })).toBe(true);
    expect(ex.test({ index: 7, col: 1, row: 0 })).toBe(true);
    expect(ex.test({ index: 7, col: 3, row: 4 })).toBe(true);
    expect(ex.test({ index: 7, col: 0, row: 0 })).toBe(false);
  });

  it('byPredicate runs the supplied function', () => {
    const ex = byPredicate((cell) => cell.col === cell.row);
    expect(ex.test({ index: 0, col: 2, row: 2 })).toBe(true);
    expect(ex.test({ index: 1, col: 2, row: 3 })).toBe(false);
  });

  it('byRole resolves a role name to a cell coord via a resolver', () => {
    const ex = byRole(['door']);
    const resolver = (name) => (name === 'door' ? { col: 2, row: 1 } : null);
    expect(ex.test({ col: 2, row: 1 }, { roleResolver: resolver })).toBe(true);
    expect(ex.test({ col: 0, row: 0 }, { roleResolver: resolver })).toBe(false);
    expect(ex.test({ col: 2, row: 1 }, { roleResolver: undefined })).toBe(false);
  });
});

describe('lineFrame', () => {
  it('count=1 returns the midpoint', () => {
    const f = lineFrame({ from: [0, 0], to: [100, 0], count: 1 });
    const cells = f.cells();
    expect(cells).toHaveLength(1);
    expect(f.position(cells[0]).point).toEqual([50, 0]);
  });

  it('count=N evenly lerps from -> to', () => {
    const f = lineFrame({ from: [0, 10], to: [100, 10], count: 5 });
    const points = f.cells().map((c) => f.position(c).point);
    expect(points).toEqual([
      [0, 10], [25, 10], [50, 10], [75, 10], [100, 10],
    ]);
  });
});

describe('axisFrame', () => {
  it('emits count+1 boards with start/internal/end boundary stamps when includeBoundary', () => {
    const f = axisFrame({ axis: 'y', origin: [10, 100], extent: 200, count: 4 });
    const cells = f.cells();
    expect(cells).toHaveLength(5);
    expect(cells.map((c) => c.boundary)).toEqual([
      'start', 'internal', 'internal', 'internal', 'end',
    ]);
    // y positions step in 50px increments.
    expect(cells.map((c) => f.position(c).point[1])).toEqual([100, 150, 200, 250, 300]);
  });

  it('honors includeBoundary: false', () => {
    const f = axisFrame({ axis: 'y', origin: [0, 0], extent: 100, count: 3, includeBoundary: false });
    expect(f.cells()).toHaveLength(3);
  });

  it('walks the z axis when asked', () => {
    const f = axisFrame({ axis: 'z', origin: [0, 0, 0], extent: 30, count: 2 });
    const positions = f.cells().map((c) => f.position(c).point);
    expect(positions).toEqual([[0, 0, 0], [0, 0, 15], [0, 0, 30]]);
  });
});

describe('uvFaceFrame', () => {
  it('produces cols*rows cells with stable uv math', () => {
    const f = uvFaceFrame({ cols: 4, rows: 2, margin: 0.08, gap: 0.025 });
    const cells = f.cells();
    expect(cells).toHaveLength(8);
    // First cell starts at margin.
    const p00 = f.position(cells[0]);
    expect(approx(p00.u, 0.08)).toBe(true);
    expect(approx(p00.v, 0.08)).toBe(true);
    // Per the convention, manjiLevel = rows - row. Row 0 = top = level rows.
    expect(p00.manjiLevel).toBe(2);
    const bottomLeft = cells.find((c) => c.col === 0 && c.row === 1);
    expect(f.position(bottomLeft).manjiLevel).toBe(1);
  });

  it('matches the renderer-internal facade-bays math', () => {
    // Numbers chosen to mirror the recipe-compiler `facePattern` mark:
    //   subdivide: { cols: 4, rows: 2 }, default margin/gap.
    const cols = 4, rows = 2, margin = 0.08, gap = 0.025, topBand = 0.08, lowerBand = 0.12;
    const f = uvFaceFrame({ cols, rows, margin, gap, topBand, lowerBand });
    const usableU = 1 - margin * 2;
    const usableV = 1 - margin * 2 - topBand - lowerBand;
    const cellW = (usableU - gap * (cols - 1)) / cols;
    const cellH = (usableV - gap * (rows - 1)) / rows;
    expect(approx(f.cellW, cellW)).toBe(true);
    expect(approx(f.cellH, cellH)).toBe(true);
    const last = f.position({ index: 0, total: 8, col: cols - 1, row: rows - 1 });
    expect(approx(last.u, margin + (cols - 1) * (cellW + gap))).toBe(true);
    expect(approx(last.v, margin + topBand + (rows - 1) * (cellH + gap))).toBe(true);
  });

  it('topBand reserves space above the cells', () => {
    const f = uvFaceFrame({ cols: 1, rows: 1, margin: 0, gap: 0, topBand: 0.2, lowerBand: 0 });
    const cell = f.cells()[0];
    const pos = f.position(cell);
    expect(approx(pos.v, 0.2)).toBe(true);
  });
});

describe('radialFrame', () => {
  it('count=6 at 360° gives 60° spacing', () => {
    const f = radialFrame({ center: [0, 0], radius: 1, count: 6 });
    const angles = f.cells().map((c) => f.position(c).angleDeg);
    expect(angles).toEqual([-90, -30, 30, 90, 150, 210]);
  });

  it('an arc places endpoints at startDeg and startDeg+sweepDeg', () => {
    const f = radialFrame({ center: [0, 0], radius: 1, count: 3, sweepDeg: 180, startDeg: 0 });
    const angles = f.cells().map((c) => f.position(c).angleDeg);
    expect(angles).toEqual([0, 90, 180]);
  });
});

describe('cardinalManjiFrame / facadeManjiFrame / lineManjiFrame', () => {
  it('facadeManjiFrame matches the renderer-internal scale convention', () => {
    // The renderer (`facadeManjiFrame` in neo-rembrandt/index.js) uses
    // lengthScale = max(cols/4, 0.25) for the N-S bar and similarly for
    // Zenith-Nadir on rows. The arm tips of a bar at lengthScale L sit at
    // ±2L (one segment to end-dot, one segment as the tail extension), so a
    // canonical 4×4 grid yields a cuboid sweeping ±2 on N-S and Zenith-Nadir.
    const frame = facadeManjiFrame({ cols: 4, rows: 4, ref: 'window-band' });
    expect(frame.kind).toBe('facade-manji-frame');
    expect(frame.axes).toEqual(['N-S', 'E-W', 'Zenith-Nadir']);
    expect(approx(frame.cuboid.min.x, -2)).toBe(true);
    expect(approx(frame.cuboid.max.x, 2)).toBe(true);
    expect(approx(frame.cuboid.min.z, -2)).toBe(true);
    expect(approx(frame.cuboid.max.z, 2)).toBe(true);
    // E-W stays at the floor scale 0.25 → cuboid extent ±0.5.
    expect(approx(frame.cuboid.max.y, 0.5)).toBe(true);
    expect(approx(frame.cuboid.min.y, -0.5)).toBe(true);
    expect(frame.ref).toBe('window-band');
  });

  it('facadeManjiFrame floor is enforced for tiny grids', () => {
    const frame = facadeManjiFrame({ cols: 1, rows: 1 });
    // All three axes floor to lengthScale 0.25, so tips reach ±0.5.
    expect(approx(frame.cuboid.max.x, 0.5)).toBe(true);
    expect(approx(frame.cuboid.max.y, 0.5)).toBe(true);
    expect(approx(frame.cuboid.max.z, 0.5)).toBe(true);
  });

  it('lineManjiFrame scales the chosen axis only and floors the orthogonal axes', () => {
    const fNS = lineManjiFrame({ count: 8, axis: 'N-S' });
    expect(approx(fNS.cuboid.max.x, 4)).toBe(true);  // lengthScale 2 → tip 4
    expect(approx(fNS.cuboid.max.y, 0.5)).toBe(true);
    expect(approx(fNS.cuboid.max.z, 0.5)).toBe(true);

    const fZN = lineManjiFrame({ count: 8, axis: 'Zenith-Nadir' });
    expect(approx(fZN.cuboid.max.x, 0.5)).toBe(true);
    expect(approx(fZN.cuboid.max.y, 0.5)).toBe(true);
    expect(approx(fZN.cuboid.max.z, 4)).toBe(true);

    expect(() => lineManjiFrame({ count: 4, axis: 'Diagonal' })).toThrow(/unsupported axis/);
  });

  it('cardinalManjiFrame is the shared underlying constructor', () => {
    const frame = cardinalManjiFrame({
      bar1: { axis: 'N-S', lengthScale: 1 },
      bar3: { axis: 'Zenith-Nadir', lengthScale: 1 },
    }, { ref: 'r', kind: 'k' });
    expect(frame.kind).toBe('k');
    expect(frame.ref).toBe('r');
    expect(frame.axes).toEqual(['N-S', 'Zenith-Nadir']);
  });
});

describe('repeatField + walk', () => {
  it('walks an uvFace + sequence + byCell exclusion end to end', () => {
    const field = repeatField({
      frame: uvFaceFrame({ cols: 4, rows: 2, ref: 'window-band' }),
      motif: sequenceMotif(['french-window']),
      exclusions: [byCell({ col: 2, row: 1 })],
      manjiFrame: facadeManjiFrame({ cols: 4, rows: 2, ref: 'window-band' }),
      provenance: { role: 'window-band' },
    });
    const cells = walk(field);
    expect(cells).toHaveLength(7); // 8 - 1 excluded
    for (const cell of cells) {
      expect(cell.motif).toBe('french-window');
      expect(cell.provenance.role).toBe('window-band');
      expect(cell.provenance.kind).toBe('uvFace');
      expect(cell.provenance.ref).toBe('window-band');
      expect(cell.excluded).toBe(false);
      expect(cell.manjiFrame).not.toBeNull();
    }
    expect(cells.some((c) => c.col === 2 && c.row === 1)).toBe(false);
  });

  it('includeExcluded surfaces excluded cells with the flag set', () => {
    const field = repeatField({
      frame: uvFaceFrame({ cols: 2, rows: 1 }),
      exclusions: [byCell({ col: 0, row: 0 })],
    });
    const cells = walk(field, { includeExcluded: true });
    expect(cells).toHaveLength(2);
    expect(cells.find((c) => c.col === 0).excluded).toBe(true);
    expect(cells.find((c) => c.col === 1).excluded).toBe(false);
  });

  it('byRole exclusion resolves the door cell at walk time', () => {
    const field = repeatField({
      frame: uvFaceFrame({ cols: 4, rows: 2 }),
      exclusions: [byRole(['door'])],
      roleResolver: (name) => (name === 'door' ? { col: 2, row: 1 } : null),
    });
    const cells = walk(field);
    expect(cells).toHaveLength(7);
    expect(cells.some((c) => c.col === 2 && c.row === 1)).toBe(false);
  });
});

// === Adapter-equivalence tests ===
//
// These prove that the existing repeater mark kinds can be expressed as a
// RepeatField. Each test re-derives the expected per-cell positions from
// first principles (the same math the existing renderer expander uses) and
// asserts the walked cells match. When the renderer expanders are migrated
// to construct a RepeatField under the hood, these tests act as the
// migration safety net.

describe('adapter equivalence: array (step treads)', () => {
  it('matches expandArrayMark math for porch step treads', () => {
    // From recipe-compiler `houseStepMarks`:
    //   { kind: 'array', count: 4, from: [..., porch.y+24], to: [..., porch.y+24], ... }
    // We pick concrete porch numbers to assert.
    const porch = { x: 200, y: 380, width: 240 };
    const fromX = porch.x + porch.width * 0.18;
    const toX = porch.x + porch.width * 0.82;
    const y = porch.y + 24;
    const count = 4;

    const field = repeatField({
      frame: lineFrame({ from: [fromX, y], to: [toX, y], count, ref: 'steps' }),
      motif: sequenceMotif(['tread']),
      provenance: { role: 'steps' },
      manjiFrame: lineManjiFrame({ count, axis: 'N-S', ref: 'steps' }),
    });
    const cells = walk(field);
    expect(cells).toHaveLength(count);

    // expandArrayMark: t = i / (count - 1), lerp.
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const expected = [
        fromX + (toX - fromX) * t,
        y,
      ];
      expect(cells[i].point[0]).toBeCloseTo(expected[0], 9);
      expect(cells[i].point[1]).toBeCloseTo(expected[1], 9);
      expect(cells[i].provenance.index).toBe(i);
      expect(cells[i].provenance.total).toBe(count);
    }
  });
});

describe('adapter equivalence: partition (shelf boards)', () => {
  it('matches expandPartitionMark math for shelf boards along y', () => {
    // Stand-in for a shelving partition: target solid at y=100, height=200,
    // count=3 partitions → 4 boards (start, 2 internal, end).
    const target = { y: 100, height: 200 };
    const count = 3;
    const field = repeatField({
      frame: axisFrame({
        axis: 'y',
        origin: [0, target.y],
        extent: target.height,
        count,
        includeBoundary: true,
        ref: 'shelf',
      }),
      provenance: { role: 'shelf' },
    });
    const cells = walk(field);
    expect(cells).toHaveLength(count + 1);
    // partitionBoardIndex i has y = origin.y + (height * i) / count.
    for (let i = 0; i <= count; i++) {
      expect(cells[i].boardIndex).toBe(i);
      expect(cells[i].point[1]).toBeCloseTo(target.y + (target.height * i) / count, 9);
    }
    expect(cells[0].boundary).toBe('start');
    expect(cells[count].boundary).toBe('end');
  });
});

describe('adapter equivalence: facade-bays (mandalaFractal)', () => {
  it('reproduces facadeBayPatternBoxes cell math', () => {
    // Numbers mirror the canonical house facePattern mark in
    // recipe-compiler.js: subdivide { cols: 4, rows: 2 }, default margin/gap,
    // topBand 0.08, lowerBand 0.12.
    const cols = 4, rows = 2;
    const margin = 0.08, gap = 0.025, topBand = 0.08, lowerBand = 0.12;
    const field = repeatField({
      frame: uvFaceFrame({ cols, rows, margin, gap, topBand, lowerBand, ref: 'facade-bays' }),
      motif: sequenceMotif(['french-window']),
      manjiFrame: facadeManjiFrame({ cols, rows, ref: 'facade-bays' }),
      provenance: { role: 'window-band' },
    });
    const cells = walk(field);
    expect(cells).toHaveLength(cols * rows);
    // Compare cell 0 and the bottom-right cell against the renderer math.
    const usableU = 1 - margin * 2;
    const usableV = 1 - margin * 2 - topBand - lowerBand;
    const cellW = (usableU - gap * (cols - 1)) / cols;
    const cellH = (usableV - gap * (rows - 1)) / rows;
    const first = cells.find((c) => c.col === 0 && c.row === 0);
    expect(approx(first.u, margin)).toBe(true);
    expect(approx(first.v, margin + topBand)).toBe(true);
    expect(approx(first.w, cellW)).toBe(true);
    expect(approx(first.h, cellH)).toBe(true);
    const last = cells.find((c) => c.col === cols - 1 && c.row === rows - 1);
    expect(approx(last.u, margin + (cols - 1) * (cellW + gap))).toBe(true);
    expect(approx(last.v, margin + topBand + (rows - 1) * (cellH + gap))).toBe(true);
  });
});

describe('adapter equivalence: manjiLevelRepeater (shared apartment rhythm)', () => {
  it('matches the apartment tower test setup (sequence × xRepeat × yStacks)', () => {
    // Mirrors `sharedManjiLevelRepeaterManifest` in neo-rembrandt/index.test.js:
    // sequence ['french-window', 'french-window', 'balcony'], xRepeat=2, yStacks=5
    // → cols = sequence.length * xRepeat = 6, rows = yStacks = 5, total = 30.
    const sequence = ['french-window', 'french-window', 'balcony'];
    const xRepeat = 2, yStacks = 5;
    const cols = sequence.length * xRepeat;
    const rows = yStacks;

    const field = repeatField({
      frame: uvFaceFrame({ cols, rows, ref: 'window-window-balcony' }),
      motif: sequenceMotif(sequence),
      manjiFrame: facadeManjiFrame({ cols, rows, ref: 'window-window-balcony' }),
      provenance: { role: 'shared-apartment-rhythm' },
    });
    const cells = walk(field);

    // Tower-B math from the existing test:
    // french-windows: cols/sequence.length * 2 (windows per row) * rows = 4 * 5 = 20.
    // balconies: 1 (per row) * rows * xRepeat = 5 * 2 = 10. Wait — recount:
    // per row there are xRepeat balconies (sequence has 1 balcony per cycle),
    // so balconies = xRepeat * rows = 2 * 5 = 10.
    const frenchWindows = cells.filter((c) => c.motif === 'french-window');
    const balconies = cells.filter((c) => c.motif === 'balcony');
    expect(frenchWindows).toHaveLength(20);
    expect(balconies).toHaveLength(10);

    // Manji-level convention: row 0 is the highest level, row rows-1 is the
    // lowest. The existing renderer stamps manjiLevel = rows - row, which
    // matches uvFaceFrame's position output exactly.
    const groundFloor = cells.filter((c) => c.row === rows - 1);
    for (const c of groundFloor) expect(c.manjiLevel).toBe(1);
    const topFloor = cells.filter((c) => c.row === 0);
    for (const c of topFloor) expect(c.manjiLevel).toBe(rows);

    // Sequence indexing: every cell's motif lines up with col % sequence.length.
    for (const c of cells) {
      expect(c.motif).toBe(sequence[c.col % sequence.length]);
      expect(c.provenance.sequenceIndex).toBe(c.col % sequence.length);
      expect(c.provenance.repeatIndex).toBe(Math.floor(c.col / sequence.length));
    }
  });

  it('shared rhythm + different yStacks gives the test\'s 12/6 vs 20/10 split', () => {
    const sequence = ['french-window', 'french-window', 'balcony'];
    const xRepeat = 2;
    const towerA = walk(repeatField({
      frame: uvFaceFrame({ cols: sequence.length * xRepeat, rows: 3 }),
      motif: sequenceMotif(sequence),
    }));
    const towerB = walk(repeatField({
      frame: uvFaceFrame({ cols: sequence.length * xRepeat, rows: 5 }),
      motif: sequenceMotif(sequence),
    }));
    expect(towerA.filter((c) => c.motif === 'french-window')).toHaveLength(12);
    expect(towerA.filter((c) => c.motif === 'balcony')).toHaveLength(6);
    expect(towerB.filter((c) => c.motif === 'french-window')).toHaveLength(20);
    expect(towerB.filter((c) => c.motif === 'balcony')).toHaveLength(10);
  });
});
