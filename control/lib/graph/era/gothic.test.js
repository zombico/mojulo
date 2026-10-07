import { describe, it, expect } from 'vitest';
import { pointedArch } from './gothic.js';
import { assembleStageScene, buildStageGeometry, planStage } from './stage.js';

const NAVE_SET = { kind: 'stage', reference: 'dmc3', kit: 'gothic-nave', rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13, open: ['-y', '+x'] }] };

describe('pointedArch', () => {
  const pts = pointedArch(2, 6, 3, 3.4, 8);
  it('springs from both ends at the springing line and peaks at mid-span', () => {
    expect(pts).toHaveLength(9);
    expect(pts[0].u).toBeCloseTo(2); expect(pts[0].z).toBeCloseTo(3);
    expect(pts[8].u).toBeCloseTo(6); expect(pts[8].z).toBeCloseTo(3);
    expect(pts[4].u).toBeCloseTo(4); expect(pts[4].z).toBeCloseTo(6.4);
  });
  it('is symmetric and rises monotonically to the apex', () => {
    for (let i = 0; i < 4; i++) {
      expect(pts[i].z).toBeLessThan(pts[i + 1].z);
      expect(pts[i].z).toBeCloseTo(pts[8 - i].z);
      expect(pts[i].u - 4).toBeCloseTo(4 - pts[8 - i].u);
    }
  });
  it('is pointed: the two halves meet at an angle (the slopes either side of the apex differ in sign)', () => {
    const l = (pts[4].z - pts[3].z) / (pts[4].u - pts[3].u), r = (pts[5].z - pts[4].z) / (pts[5].u - pts[4].u);
    expect(l).toBeGreaterThan(0.2); expect(r).toBeLessThan(-0.2);
  });
});

describe('the gothic nave kit', () => {
  const plan = planStage(NAVE_SET), { faces, seats } = buildStageGeometry(plan);
  it('leaves the open sides out: no wall face on the −y or +x planes', () => {
    const r = plan.rooms[0];
    const onPlane = (k, v) => faces.filter((f) => f.group === 'stage:wall' && f.corners.every((c) => Math.abs(c[k] - v) < 1e-6));
    expect(onPlane(1, r.y0)).toHaveLength(0);
    expect(onPlane(0, r.x1)).toHaveLength(0);
    expect(onPlane(0, r.x0).length).toBeGreaterThan(0);
  });
  it('vaults the ceiling: faces rise well above the springing line, to about 0.62 × span over it', () => {
    const top = Math.max(...faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(top).toBeGreaterThan(13 + 0.55 * 11.5);
    expect(faces.some((f) => f.group === 'stage:ceiling' && f.corners.some((c) => c[2] > 15))).toBe(true);
  });
  it('lights each clerestory lancet with a cool window light, and seats torches on the columns', () => {
    const win = seats.filter((s) => s.fixture === 'window'), torch = seats.filter((s) => !s.fixture);
    expect(win.length).toBeGreaterThan(4);
    expect(torch.length).toBeGreaterThan(0);
    expect(faces.filter((f) => f.group === 'stage:glass').length).toBeGreaterThan(0);
  });
  it('bakes, but leaves the self-lit glass as authored; the set is framed from its open corner; deterministic', () => {
    const a = assembleStageScene(NAVE_SET), b = assembleStageScene(NAVE_SET);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const glass = a.faces.filter((f) => f.group === 'stage:glass');
    expect(glass.every((f) => f.fill === '#8fa6e6' && !f.cornerFills)).toBe(true);
    expect(a.cameras[0].name).toBe('set');
    expect(a.lights.length).toBe(seats.length);
  });
});
