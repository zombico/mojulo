import { describe, it, expect } from 'vitest';
import { createFigureHandler } from '@/lib/mcp/tools/figure';
import { renderFigureToSvg, buildPosedFigure, renderFigureFrames } from '@/lib/graph/polygonizer/figure-render';
import { resolvePose } from '@/lib/graph/polygonizer/figure-posing';
import { FIGURE_SETUPS } from '@/lib/visual-language/themes';

describe('create_figure', () => {
  it('renders a posed + dressed female figure manifest to SVG', () => {
    const svg = renderFigureToSvg({
      kind: 'figure',
      pose: { spine: { sagittal: 0.5, axial: 0.3 }, shR: { pitch: -90 }, elbowR: 20 },
      proto: { sex: 'female' },
      garment: 'tee',
      view: 'frontal',
    });
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/<polygon /);
  });

  it('buildPosedFigure returns tagged stacks; spine bend changes the geometry', () => {
    const neutral = buildPosedFigure({}, {}, null);
    const bent = buildPosedFigure({ spine: { sagittal: 1 } }, {}, null);
    expect(neutral.length).toBeGreaterThan(10);
    expect(neutral.every((s) => s.id && Array.isArray(s.rings))).toBe(true);
    // the trunk should move under a full flex (the deformer warped it)
    const trunk = (b) => b.find((s) => s.id === 'trunk').rings[0].center;
    expect(trunk(neutral)).not.toEqual(trunk(bent));
  });

  it('squash & stretch deforms the flesh volume-preservingly; squash:1 is identity', () => {
    const bbox = (b) => {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const s of b) for (const r of s.rings) for (const q of r.polyline) {
        lo[0] = Math.min(lo[0], q.x); lo[1] = Math.min(lo[1], q.y); lo[2] = Math.min(lo[2], q.z);
        hi[0] = Math.max(hi[0], q.x); hi[1] = Math.max(hi[1], q.y); hi[2] = Math.max(hi[2], q.z);
      }
      return { vol: (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]), h: hi[2] - lo[2] };
    };
    const base = buildPosedFigure({}, {}, null);
    expect(buildPosedFigure({ squash: 1 }, {}, null)).toEqual(base);     // 1 = identity
    const squashed = buildPosedFigure({ squash: 0.8 }, {}, null);
    expect(bbox(squashed).h).toBeLessThan(bbox(base).h);                 // shorter (pancaked)
    expect(bbox(squashed).vol / bbox(base).vol).toBeCloseTo(1, 2);       // volume preserved
  });

  it('leg rings follow the limb axis on a raised+bent leg (no horizontal-slice collapse)', () => {
    const b = buildPosedFigure(resolvePose({ support: 'R', legL: ['forward', 'up'], kneeL: 'half' }), {}, null);
    const leg = b.find((s) => s.id === 'legL');
    const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
    const sub = (a, c) => ({ x: a.x - c.x, y: a.y - c.y, z: a.z - c.z });
    const cross = (a, c) => ({ x: a.y * c.z - a.z * c.y, y: a.z * c.x - a.x * c.z, z: a.x * c.y - a.y * c.x });
    // a mid-thigh ring: its face normal should align with the local limb tangent
    const i = Math.round(leg.rings.length * 0.3);
    const ring = leg.rings[i];
    const tangent = norm(sub(leg.rings[i + 1].center, leg.rings[i - 1].center));
    const e0 = sub(ring.polyline[0], ring.center), e1 = sub(ring.polyline[Math.floor(ring.polyline.length / 4)], ring.center);
    const n = norm(cross(e0, e1));
    const align = Math.abs(n.x * tangent.x + n.y * tangent.y + n.z * tangent.z);
    expect(align).toBeGreaterThan(0.7);   // rings face along the limb, not a flat horizontal slice
  });

  it('root lift raises the whole figure (rigid z-translation)', () => {
    const z = (b) => b.find((s) => s.id === 'trunk').rings[0].center.z;
    expect(z(buildPosedFigure({ lift: 0.2 }, {}, null))).toBeGreaterThan(z(buildPosedFigure({}, {}, null)));
  });

  it('an airborne motion (support none + lift) renders frames without re-planting to the floor', () => {
    // grounded vs airborne phase of a hop should differ once the ground baseline
    // is locked across frames — i.e. the figure actually leaves the ground.
    const hop = (p) => (p < 0.5 ? { support: 'both' } : { support: 'none', lift: 0.3 });
    const frames = renderFigureFrames({ motion: hop }, 6);
    expect(frames).toHaveLength(6);
    expect(frames[0]).not.toBe(frames[5]);   // grounded frame ≠ lifted frame
    expect(frames.every((f) => f.includes('<polygon'))).toBe(true);
  });

  it('rejects bad dials before touching the store', async () => {
    await expect(createFigureHandler({})).rejects.toThrow(/title/);
    await expect(createFigureHandler({ title: 'x', garment: 'cape' })).rejects.toThrow(/garment/);
    await expect(createFigureHandler({ title: 'x', view: 'isometric' })).rejects.toThrow(/view/);
    await expect(createFigureHandler({ title: 'x', motion: 'backflip' })).rejects.toThrow(/motion/);
    await expect(createFigureHandler({ title: 'x', setup: 'noir' })).rejects.toThrow(/setup/);
  });

  it('no setup renders byte-identically to the default (back-compat)', () => {
    const m = { kind: 'figure', view: 'frontal' };
    expect(renderFigureToSvg(m)).toBe(renderFigureToSvg({ ...m }));
    // the default still backdrop is the built-in light grey
    expect(renderFigureToSvg(m)).toContain('fill="#eef1f4"');
  });

  it('a filled setup swaps the backdrop and keeps a meshed (filled-polygon) figure', () => {
    const svg = renderFigureToSvg({ kind: 'figure', view: 'frontal', setup: 'white-cyc' });
    expect(svg).toContain(`fill="${FIGURE_SETUPS['white-cyc'].bg}"`);
    expect(svg).toMatch(/<polygon /); // still a lit mesh
    expect(svg).not.toMatch(/<polyline /);
  });

  it('blueprint-wire renders a stroked ring-wave wireframe (no fill) on the blueprint ground', () => {
    const wire = FIGURE_SETUPS['blueprint-wire'];
    const svg = renderFigureToSvg({ kind: 'figure', view: 'frontal', setup: 'blueprint-wire' });
    expect(svg).toContain(`fill="${wire.bg}"`); // blueprint ground
    expect(svg).toMatch(/<polyline /); // ring polylines, not meshed faces
    expect(svg).not.toMatch(/<polygon /);
    expect(svg).toContain(`stroke="${wire.wireStroke}"`);
    expect(svg).toContain('fill="none"');
  });

  it('rejects an unknown setup token at render time too', () => {
    expect(() => renderFigureToSvg({ kind: 'figure', setup: 'noir' })).toThrow(/unknown figure setup/);
  });
});
