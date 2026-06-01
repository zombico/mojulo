process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, diffSketchesHandler } from './sketches.js';

beforeEach(() => {
  closeDb();
});

function pipelineManifest({ title, middleLabel = 'Transform', middleX = 330, extra = false } = {}) {
  return {
    title: title || 'Pipeline',
    viewBox: { width: 760, height: 320 },
    stations: [
      { id: 'input', kind: 'input', label: 'Input', x: 40, y: 112, w: 170, h: 90 },
      {
        id: 'transform',
        kind: 'mcp_tool',
        label: middleLabel,
        sublabel: 'normalizes payload',
        items: ['validate', 'shape'],
        x: middleX,
        y: 100,
        w: 190,
        h: 114,
      },
      { id: 'store', kind: 'db_row', label: 'Store', x: 560, y: 112, w: 160, h: 90 },
      ...(extra
        ? [{ id: 'notify', kind: 'filesystem', label: 'Notify', x: 560, y: 230, w: 160, h: 64 }]
        : []),
    ],
    edges: [
      { from: 'input', to: 'transform', label: 'sends' },
      { from: 'transform', to: 'store', label: 'writes' },
      ...(extra ? [{ from: 'transform', to: 'notify', label: 'alerts' }] : []),
    ],
    marks: [{ kind: 'text', x: 40, y: 40, value: 'v1', size: 13, color: '#94a3b8' }],
  };
}

function chartManifest() {
  return {
    title: 'Unrelated chart',
    viewBox: { width: 420, height: 260 },
    marks: [
      { kind: 'rect', x: 40, y: 60, w: 80, h: 160, fill: '#22c55e' },
      { kind: 'rect', x: 150, y: 120, w: 80, h: 100, fill: '#f59e0b' },
      { kind: 'text', x: 40, y: 36, value: 'Quarterly revenue', size: 16 },
    ],
  };
}

function p0StickerManifest() {
  const points = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    points.push([240 + Math.cos(t) * 72, 220 + Math.sin(t) * 104]);
  }
  return {
    title: 'P0 sticker egg',
    viewBox: { width: 480, height: 420 },
    scene: {
      light: { direction: [-0.58, -0.82], warmth: 0.6 },
      ground: { y: 340 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'polygon',
        closed: true,
        role: 'egg-body',
        z: 10,
        points,
        fill: '#c7a36f',
        shade: { algorithm: 'convex-value-stack', intensity: 0.9 },
        highlights: { algorithm: 'simple-highlight', intensity: 0.4 },
      },
    ],
  };
}

function blobStickerManifest() {
  return {
    title: 'Blob figure',
    viewBox: { width: 360, height: 360 },
    scene: {
      view: { direction: [-1, -1], baseZ: 10, blobZStep: 1 },
      light: { direction: [-0.58, -0.82] },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'blob',
        role: 'head',
        anchor: [120, 110],
        rx: 42,
        ry: 50,
        shade: { algorithm: 'form-light-stack', intensity: 0.9 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.4 },
      },
      {
        kind: 'blob',
        role: 'torso',
        anchor: [175, 210],
        rx: 62,
        ry: 84,
        shade: { algorithm: 'form-light-stack', intensity: 0.85 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.35 },
      },
    ],
  };
}

describe('create_sketch P0 sticker expansion', () => {
  it('expands shaded closed polygons before storing the sketch manifest', async () => {
    await createSketchHandler({
      ref: 'p0_egg',
      title: 'P0 sticker egg',
      manifest: p0StickerManifest(),
    });

    const sketch = SketchRepository.getByRef('p0_egg');
    expect(sketch.manifest.neoRembrandt.expanded).toBe(true);
    expect(sketch.manifest.marks.some((m) => m.kind === 'polygon')).toBe(true);
    expect(sketch.manifest.marks.some((m) => m.algorithm === 'convex-value-stack')).toBe(true);
    expect(sketch.manifest.marks.some((m) => m.algorithm === 'simple-highlight')).toBe(true);
    expect(sketch.manifest.marks.filter((m) => m.algorithm === 'simple-highlight').length).toBeGreaterThan(1);
    expect(sketch.manifest.marks.some((m) => /terminator/.test(m.role || ''))).toBe(false);
  });

  it('stores compact blob fields as concrete polygon sticker families', async () => {
    await createSketchHandler({
      ref: 'blob_figure',
      title: 'Blob figure',
      manifest: blobStickerManifest(),
    });

    const sketch = SketchRepository.getByRef('blob_figure');
    const sources = sketch.manifest.marks.filter((m) => m.source);
    const head = sources.find((m) => m.role === 'head');
    const torso = sources.find((m) => m.role === 'torso');

    expect(sketch.manifest.neoRembrandt.expanded).toBe(true);
    expect(sources.every((m) => m.kind === 'polygon')).toBe(true);
    expect(sources.every((m) => m.sourceShape === 'blob')).toBe(true);
    expect(sketch.manifest.marks.some((m) => m.kind === 'blob')).toBe(false);
    expect(head.z).toBeGreaterThan(torso.z);
    expect(sketch.manifest.marks.filter((m) => m.blobRole === 'head' && m.pass === 'shadow')).toHaveLength(6);
    expect(sketch.manifest.marks.filter((m) => m.blobRole === 'torso' && m.pass === 'highlight')).toHaveLength(4);
  });
});

describe('diff_sketches', () => {
  it('mints a side-by-side visual diff for comparable sketches', async () => {
    await createSketchHandler({
      ref: 'before_flow',
      title: 'Before flow',
      manifest: pipelineManifest({ title: 'Before flow' }),
    });
    await createSketchHandler({
      ref: 'after_flow',
      title: 'After flow',
      manifest: pipelineManifest({
        title: 'After flow',
        middleLabel: 'Transform + enrich',
        middleX: 310,
        extra: true,
      }),
    });

    const result = await diffSketchesHandler({
      left_ref: 'before_flow',
      right_ref: 'after_flow',
      ref: 'flow_diff',
    });

    expect(result.ok).toBe(true);
    expect(result.ref).toBe('flow_diff');
    expect(result.url).toBe('/sketches/flow_diff');
    expect(result.verdict).toBe('diff_created');
    expect(result.summary.changedStations).toBeGreaterThan(0);
    expect(result.summary.addedStations).toBe(1);

    const diff = SketchRepository.getByRef('flow_diff');
    expect(diff).toBeTruthy();
    expect(diff.manifest.viewBox.width).toBeGreaterThan(760);
    expect(diff.manifest.stations.map((s) => s.id)).toContain('left__transform');
    expect(diff.manifest.stations.map((s) => s.id)).toContain('right__transform');
    expect(diff.manifest.marks.some((m) => m.kind === 'text' && /changed/.test(m.value))).toBe(true);
    expect(diff.manifest.marks.some((m) => m.kind === 'text' && m.value === 'added')).toBe(true);
  });

  it('returns too_different without minting when sketches are unrelated', async () => {
    await createSketchHandler({
      ref: 'flow',
      title: 'Flow',
      manifest: pipelineManifest({ title: 'Flow' }),
    });
    await createSketchHandler({
      ref: 'chart',
      title: 'Chart',
      manifest: chartManifest(),
    });

    const result = await diffSketchesHandler({
      left_ref: 'flow',
      right_ref: 'chart',
      ref: 'should_not_exist',
    });

    expect(result.ok).toBe(false);
    expect(result.verdict).toBe('too_different');
    expect(result.similarity).toBeLessThan(0.25);
    expect(SketchRepository.getByRef('should_not_exist')).toBe(null);
  });

  it('can force a low-confidence diff for unrelated sketches', async () => {
    await createSketchHandler({
      ref: 'flow',
      title: 'Flow',
      manifest: pipelineManifest({ title: 'Flow' }),
    });
    await createSketchHandler({
      ref: 'chart',
      title: 'Chart',
      manifest: chartManifest(),
    });

    const result = await diffSketchesHandler({
      left_ref: 'flow',
      right_ref: 'chart',
      ref: 'forced_diff',
      force: true,
    });

    expect(result.ok).toBe(true);
    expect(result.verdict).toBe('forced_low_confidence');
    expect(SketchRepository.getByRef('forced_diff')).toBeTruthy();
  });

  it('validates refs and options', async () => {
    await expect(diffSketchesHandler({})).rejects.toThrow(/left_ref/);
    await expect(
      diffSketchesHandler({ left_ref: 'a', right_ref: 'a' }),
    ).rejects.toThrow(/must be different/);
    await expect(
      diffSketchesHandler({ left_ref: 'a', right_ref: 'b', min_similarity: 2 }),
    ).rejects.toThrow(/min_similarity/);
  });
});
