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

describe('create_sketch preload affordance', () => {
  it('echoes a resolved preload sketch into the response (advisory, no merge)', async () => {
    const prior = await createSketchHandler({
      title: 'Prior scene',
      ref: 'preload_source_1',
      manifest: pipelineManifest({ title: 'Prior' }),
    });
    expect(prior).toMatchObject({ ok: true, ref: 'preload_source_1' });

    const next = await createSketchHandler({
      title: 'Next scene',
      ref: 'preload_dest_1',
      manifest: pipelineManifest({ title: 'Next', middleLabel: 'Refined' }),
      preload: 'preload_source_1',
      preloadMetadata: { carry: 'same input + store, swap middle' },
    });
    expect(next.ok).toBe(true);
    expect(next.ref).toBe('preload_dest_1');
    expect(next.preload).toBeTruthy();
    expect(next.preload.ref).toBe('preload_source_1');
    expect(next.preload.title).toBe('Prior scene');
    expect(next.preload.metadata).toEqual({ carry: 'same input + store, swap middle' });
    // Stored manifest is the new one — preload is advisory, never blended.
    const stored = SketchRepository.getByRef('preload_dest_1');
    expect(stored.manifest.title).toBe('Next');
  });

  it('omits preload from the response when no preload is provided', async () => {
    const result = await createSketchHandler({
      title: 'Standalone',
      ref: 'preload_dest_2',
      manifest: pipelineManifest({ title: 'Standalone' }),
    });
    expect(result.ok).toBe(true);
    expect(result.preload).toBeUndefined();
  });

  it('rejects an unknown preload ref before persisting the new sketch', async () => {
    await expect(
      createSketchHandler({
        title: 'Would-be next',
        ref: 'preload_dest_3',
        manifest: pipelineManifest({ title: 'Would-be next' }),
        preload: 'sk_does_not_exist',
      }),
    ).rejects.toThrow(/preload sketch 'sk_does_not_exist' not found/);
    expect(SketchRepository.getByRef('preload_dest_3')).toBeNull();
  });

  it('rejects a non-string preload value with a clear message', async () => {
    await expect(
      createSketchHandler({
        title: 'Bad preload',
        ref: 'preload_dest_4',
        manifest: pipelineManifest({ title: 'Bad preload' }),
        preload: 42,
      }),
    ).rejects.toThrow(/preload.*string/);
  });
});

describe('create_sketch labeled-array preload affordance', () => {
  it('accepts an array of labeled refs and echoes them back as an array', async () => {
    await createSketchHandler({
      title: 'Character',
      ref: 'preload_char',
      manifest: pipelineManifest({ title: 'Character' }),
    });
    await createSketchHandler({
      title: 'Setting',
      ref: 'preload_set',
      manifest: pipelineManifest({ title: 'Setting', middleLabel: 'Garden' }),
    });

    const next = await createSketchHandler({
      title: 'Page 1',
      ref: 'preload_combo_1',
      manifest: pipelineManifest({ title: 'Page 1' }),
      preload: [
        { ref: 'preload_char', as: 'character', note: 'the fox' },
        { ref: 'preload_set', as: 'setting' },
      ],
    });
    expect(next.ok).toBe(true);
    expect(Array.isArray(next.preload)).toBe(true);
    expect(next.preload).toHaveLength(2);
    expect(next.preload[0]).toMatchObject({
      ref: 'preload_char',
      title: 'Character',
      as: 'character',
      note: 'the fox',
    });
    expect(next.preload[0].manifest).toBeTruthy();
    expect(next.preload[1]).toMatchObject({
      ref: 'preload_set',
      title: 'Setting',
      as: 'setting',
      note: null,
    });
  });

  it('accepts a mix of bare-string and labeled-object items in the array', async () => {
    await createSketchHandler({
      title: 'A',
      ref: 'preload_mix_a',
      manifest: pipelineManifest({ title: 'A' }),
    });
    await createSketchHandler({
      title: 'B',
      ref: 'preload_mix_b',
      manifest: pipelineManifest({ title: 'B' }),
    });

    const next = await createSketchHandler({
      title: 'Mix',
      ref: 'preload_mix_dest',
      manifest: pipelineManifest({ title: 'Mix' }),
      preload: ['preload_mix_a', { ref: 'preload_mix_b', as: 'palette' }],
    });
    expect(next.preload).toHaveLength(2);
    expect(next.preload[0]).toMatchObject({ ref: 'preload_mix_a', as: null, note: null });
    expect(next.preload[1]).toMatchObject({ ref: 'preload_mix_b', as: 'palette' });
  });

  it('rejects an over-cap preload array before persisting', async () => {
    for (let i = 0; i < 9; i++) {
      await createSketchHandler({
        title: `Src ${i}`,
        ref: `preload_cap_${i}`,
        manifest: pipelineManifest({ title: `Src ${i}` }),
      });
    }
    const refs = Array.from({ length: 9 }, (_, i) => `preload_cap_${i}`);
    await expect(
      createSketchHandler({
        title: 'Over cap',
        ref: 'preload_cap_dest',
        manifest: pipelineManifest({ title: 'Over cap' }),
        preload: refs,
      }),
    ).rejects.toThrow(/at most 8 priors/);
    expect(SketchRepository.getByRef('preload_cap_dest')).toBeNull();
  });

  it('rejects duplicate refs inside the array with a clear message', async () => {
    await createSketchHandler({
      title: 'Dupe src',
      ref: 'preload_dupe_src',
      manifest: pipelineManifest({ title: 'Dupe src' }),
    });
    await expect(
      createSketchHandler({
        title: 'Dupe',
        ref: 'preload_dupe_dest',
        manifest: pipelineManifest({ title: 'Dupe' }),
        preload: [
          { ref: 'preload_dupe_src', as: 'character' },
          { ref: 'preload_dupe_src', as: 'setting' },
        ],
      }),
    ).rejects.toThrow(/duplicate ref 'preload_dupe_src'/);
  });

  it('rejects an empty `as` label with a clear message', async () => {
    await createSketchHandler({
      title: 'Bad as src',
      ref: 'preload_bad_as_src',
      manifest: pipelineManifest({ title: 'Bad as src' }),
    });
    await expect(
      createSketchHandler({
        title: 'Bad as',
        ref: 'preload_bad_as_dest',
        manifest: pipelineManifest({ title: 'Bad as' }),
        preload: [{ ref: 'preload_bad_as_src', as: '   ' }],
      }),
    ).rejects.toThrow(/non-empty string/);
  });

  it('rejects an unknown ref inside the array before persisting the new sketch', async () => {
    await createSketchHandler({
      title: 'Known',
      ref: 'preload_known',
      manifest: pipelineManifest({ title: 'Known' }),
    });
    await expect(
      createSketchHandler({
        title: 'Unknown member',
        ref: 'preload_arr_unknown_dest',
        manifest: pipelineManifest({ title: 'Unknown member' }),
        preload: [
          { ref: 'preload_known', as: 'character' },
          { ref: 'sk_does_not_exist', as: 'setting' },
        ],
      }),
    ).rejects.toThrow(/preload sketch 'sk_does_not_exist' not found/);
    expect(SketchRepository.getByRef('preload_arr_unknown_dest')).toBeNull();
  });
});
