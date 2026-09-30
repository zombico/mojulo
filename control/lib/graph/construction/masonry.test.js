import { describe, it, expect } from 'vitest';
import { layMasonry, validateMasonry, bakeBondKey } from './masonry.js';
import { expandRepeats } from '../polygonizer/rock-pool.js';
import { lowerFrame, validateFrames } from './frame.js';
import { planWorkbench } from '../worlds/workbench.js';

const front = { id: 'front', from: [0, 0, 0], to: [360, 0, 0], height: 260, bond: 'flemish', openings: [{ at: 60, width: 100, sill: 90, height: 130 }, { at: 230, width: 90, height: 210 }] };
const area = (c) => {
  // a planar quad's area, by the cross product of its diagonals
  const d1 = [0, 1, 2].map((k) => c[2][k] - c[0][k]), d2 = [0, 1, 2].map((k) => c[3][k] - c[1][k]);
  return Math.hypot(d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]) / 2;
};

describe('construction/masonry — walls in units, floors in tiles, roofs in slates', () => {
  it('lays a Flemish wall a brick thick, its openings snapped to the course gauge', () => {
    const { report } = layMasonry({ walls: [front] }, { scale: 0.01 });
    const w = report.walls[0];
    expect(w).toMatchObject({ bond: 'flemish', leaves: 2, thicknessMm: 215, courses: 34 });
    // UK brick: 65 mm + a 10 mm joint is a 75 mm gauge; a sill and a head land on it
    for (const o of w.openings) { expect(o.sillMm % 75).toBe(0); expect((o.headMm + 10) % 75).toBe(0); }
    expect(w.openings[1].sillMm).toBe(0);
    // a half-brick stretcher wall is one leaf
    expect(layMasonry({ walls: [{ ...front, bond: 'stretcher', openings: [] }] }, { scale: 0.01 }).report.walls[0].leaves).toBe(1);
  });

  it('lays the course above a soldier-course head (float edges at the gauge must not drop it)', () => {
    const { faces } = layMasonry({ walls: [front] }, { scale: 0.01 });
    // the door's head: soldiers from 210 cm to 231.5; the next course is 232.5–239, and it must be laid over the door
    const over = faces.filter((f) => f.outNormal[1] < -0.9 && f.corners.every((c) => c[0] > 235 && c[0] < 315 && c[2] > 232 && c[2] < 239.5));
    expect(over.length).toBeGreaterThan(0);
  });

  it('herringbone covers its rectangle, each tile wearing its own window of the stone', () => {
    const p = { origin: [0, 0, 0], size: [240, 180], tile: [300, 150, 20], pattern: 'herringbone', stone: 'marble-carrara', gap: 0 };
    const { faces, report } = layMasonry({ paving: [p] }, { scale: 0.01 });
    const tiles = faces.filter((f) => f.texture);
    expect(tiles).toHaveLength(report.paving[0].tiles);
    expect(tiles.every((f) => f.texture === 'marble-carrara' && f.textureLit)).toBe(true);
    const covered = tiles.reduce((s, f) => s + area(f.corners), 0);
    expect(covered / (240 * 180)).toBeCloseTo(1, 3);
    expect(new Set(tiles.map((f) => f.uv[0].join())).size).toBe(tiles.length);
    for (const pattern of ['stack', 'running', 'basketweave']) {
      const t = layMasonry({ paving: [{ ...p, pattern }] }, { scale: 0.01 }).faces.filter((f) => f.texture);
      expect(t.reduce((s, f) => s + area(f.corners), 0) / (240 * 180)).toBeCloseTo(1, 3);
    }
  });

  it('hangs slates at the gauge (length − headlap) / 2 on a plane at the pitch', () => {
    const { faces, report } = layMasonry({ slates: [{ eave: [[0, 0, 300], [400, 0, 300]], pitch: 40, run: 200 }] }, { scale: 0.01 });
    expect(report.slates[0]).toMatchObject({ gaugeMm: 213, headlapMm: 75 });
    const tops = faces.filter((f) => f.texture === 'slate');
    expect(tops.length).toBe(report.slates[0].slates);
    for (const f of tops) expect(f.outNormal[2]).toBeCloseTo(Math.cos((40 * Math.PI) / 180), 6);
    // alternate courses break joint by half a slate
    const firstX = (k) => Math.min(...tops.filter((f) => Math.abs(f.corners[0][2] - tops[0].corners[0][2] - k * 21.25 * Math.sin((40 * Math.PI) / 180)) < 1).map((f) => f.corners[1][0]));
    expect(Math.abs(firstX(0) - firstX(1))).toBeCloseTo(12.5, 0);
  });

  it('is a frame on its own, validated, and lays the same bytes twice', () => {
    const frame = { unit: 'cm', walls: [front], paving: [{ origin: [0, 15, 0], size: [360, 150], pattern: 'herringbone' }], slates: [{ eave: [[0, 0, 260], [360, 0, 260]], pitch: 45, run: 150 }] };
    expect(validateFrames([frame])).toEqual([]);
    expect(validateFrames([{ unit: 'cm' }])[0]).toMatch(/members: a non-empty array/);
    expect(validateMasonry({ walls: [{ ...front, bond: 'rat-trap' }], paving: [{ origin: [0, 0, 0], size: [1, 1], grout: 'grey' }] }, 'f').join('\n')).toMatch(/bond: one of[\s\S]*grout: '#rrggbb'/);
    const a = lowerFrame(frame), b = lowerFrame(frame);
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
    expect(a.report.walls[0].id).toBe('front');
    expect(a.report.members).toEqual([]);
    // the workbench takes it without calling the face-only masonry an open shell
    const { stats } = planWorkbench({ kind: 'workbench', frames: [frame] });
    expect((stats.warnings || []).filter((w) => /open shell/.test(w))).toEqual([]);
    expect(stats.frames[0].paving[0].pattern).toBe('herringbone');
  });
});

describe('construction/masonry — sustainable to render', () => {
  const wall = { id: 'w', from: [0, 0, 0], to: [600, 0, 0], height: 300, bond: 'flemish', openings: [{ at: 100, width: 120, sill: 90, height: 140 }] };
  const eye = (d) => [{ pos: [3, -d, 1.5], focalPx: 1000 }];

  it('picks units near, the bond texture farther, the far-read colour farthest', () => {
    const lv = (d) => layMasonry({ walls: [wall] }, { scale: 0.01, eyes: eye(d) }).report.walls[0].detail;
    expect(lv(5)).toBe('units'); expect(lv(30)).toBe('surface'); expect(lv(200)).toBe('mass');
    const surf = layMasonry({ walls: [wall] }, { scale: 0.01, eyes: eye(30) });
    expect(surf.faces.length).toBeLessThan(60);
    expect(surf.faces.some((f) => String(f.texture).startsWith('masonry:'))).toBe(true);
    expect(surf.report.walls[0]).toMatchObject({ unitsEstimated: true });
    expect(layMasonry({ walls: [wall] }, { scale: 0.01, eyes: eye(200) }).faces.every((f) => !f.texture)).toBe(true);
  });

  it('stamps plain units as repeats that expand to the same bricks', () => {
    const flat = layMasonry({ walls: [wall] }, { scale: 0.01 });
    const inst = layMasonry({ walls: [wall] }, { scale: 0.01, instance: true });
    expect(inst.repeats.length).toBeGreaterThan(0);
    expect(inst.faces.length).toBeLessThan(flat.faces.length / 5);
    const key = (f) => f.corners.map((c) => c.map((v) => Math.round(v * 1000)).join(',')).join(';');
    const expanded = [...inst.faces, ...expandRepeats(inst.repeats)].map(key).sort();
    expect(expanded).toEqual(flat.faces.map(key).sort());
  });

  it('bakes a seamless bond tile of whole periods', () => {
    for (const bond of ['stretcher', 'english', 'flemish', 'header', 'stack']) {
      const { report, faces } = layMasonry({ walls: [{ ...wall, bond, detail: 'surface' }] }, { scale: 0.01 });
      expect(report.walls[0].detail).toBe('surface');
      const b = bakeBondKey(faces.find((f) => f.texture).texture);
      const period = bond === 'flemish' ? 337.5 : bond === 'header' ? 112.5 : 225;
      expect((b.tileMm[0] / period) % 1).toBeCloseTo(0, 9);
      expect(b.rgb.length).toBe(b.W * b.H * 3);
    }
  });
});
