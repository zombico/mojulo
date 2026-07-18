process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

// Bound sheet renders write real files; point the outcome folder at a
// scratch dir so tests never touch data/outcomes.
process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-test-outcomes-'));

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import {
  createSketchHandler,
  diffSketchesHandler,
  getImageRenderPacketHandler,
  bindCharacterSheetHandler,
  bindImageRenderHandler,
} from './sketches.js';
import { mangaSignalPageFixture, cityBlockoutFixture } from '@/lib/graph/image-outcomes/fixtures';

// A valid 1x1 PNG for bind tests.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

describe('get_image_render_packet — the render-worker read surface', () => {
  it('expands per-panel targets and scopes instructions + scaffold crops per panel', async () => {
    await createSketchHandler({ title: 'Manga', ref: 'packet_manga', manifest: mangaSignalPageFixture() });
    const packet = await getImageRenderPacketHandler({ ref: 'packet_manga' });
    expect(packet.ok).toBe(true);
    expect(packet.kind).toBe('sequential-art');
    expect(packet.renderStrategy).toBe('per-panel');
    expect(packet.targets).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(packet.target).toBe('p1');
    expect(packet.instructions).toContain('panel p1');
    expect(packet.scaffold.svgUrl).toContain('panel=p1');
    expect(packet.scaffold.pngUrl).toContain('panel=p1');
    // the page scaffold rides along with every panel target
    expect(packet.pageScaffold.svgUrl).not.toContain('panel=');

    const p3 = await getImageRenderPacketHandler({ ref: 'packet_manga', target: 'p3' });
    expect(p3.instructions).toContain('panel p3');
    expect(p3.instructions).not.toContain('panel p1');
  });

  it('loops the image generator in: workerProtocol + generate-don\'t-trace in every packet', async () => {
    await createSketchHandler({ title: 'Manga', ref: 'packet_protocol', manifest: mangaSignalPageFixture() });
    const packet = await getImageRenderPacketHandler({ ref: 'packet_protocol', target: 'p2' });
    // the protocol names the mandatory generation step and the remaining targets
    const protocol = packet.workerProtocol.join('\n');
    expect(protocol).toContain('INVOKE your image-generation capability');
    expect(protocol).toContain('NOT the artifact');
    expect(protocol).toContain('Repeat for each remaining target: p1, p3, p4');
    // the brief itself bans returning the scaffold's graphic language
    expect(packet.instructions).toContain('INVOKE YOUR IMAGE-GENERATION CAPABILITY');
    expect(packet.instructions).toContain('The scaffold is INPUT, never the deliverable');
    expect(packet.instructions).toContain('traced instead of generated');

    await createSketchHandler({ title: 'Shot', ref: 'packet_protocol_shot', manifest: cityBlockoutFixture() });
    const shot = await getImageRenderPacketHandler({ ref: 'packet_protocol_shot' });
    expect(shot.workerProtocol.join('\n')).toContain('INVOKE your image-generation capability');
    expect(shot.workerProtocol.join('\n')).not.toContain('Repeat'); // single target
    expect(shot.instructions).toContain('The scaffold is INPUT, never the deliverable');
  });

  it('serves a single page target for image-outcome shots', async () => {
    await createSketchHandler({ title: 'Shot', ref: 'packet_shot', manifest: cityBlockoutFixture() });
    const packet = await getImageRenderPacketHandler({ ref: 'packet_shot' });
    expect(packet.kind).toBe('image-outcome');
    expect(packet.targets).toEqual(['page']);
    expect(packet.target).toBe('page');
    expect(packet.scaffold.svgUrl).not.toContain('panel=');
    expect(packet.pageScaffold).toBeUndefined();
    expect(packet.instructions).toContain('composition source of truth');
  });

  it('carries the Style Lock when the manifest tunes a style preset', async () => {
    const manifest = mangaSignalPageFixture();
    manifest.renderBrief = { preset: 'gpen-shonen', dials: { stylization: 0.9 } };
    await createSketchHandler({ title: 'Styled manga', ref: 'packet_styled', manifest });
    const packet = await getImageRenderPacketHandler({ ref: 'packet_styled', target: 'p2' });
    expect(packet.instructions).toContain('## Style Lock');
    expect(packet.instructions).toContain('gpen-shonen');
    expect(packet.instructions).toContain('enlarged heads and eyes');
    expect(packet.manifest.renderBrief.dials.stylization).toBe(0.9);
  });

  it('never leaks bubble lettering into the packet instructions', async () => {
    await createSketchHandler({ title: 'Manga', ref: 'packet_lettering', manifest: mangaSignalPageFixture() });
    for (const target of ['p1', 'p2', 'p3', 'p4']) {
      const packet = await getImageRenderPacketHandler({ ref: 'packet_lettering', target });
      expect(packet.instructions).not.toContain('What is that light');
    }
  });

  it('rejects unknown refs, non-packet kinds, and off-strategy targets', async () => {
    await expect(getImageRenderPacketHandler({ ref: 'sk_nope' })).rejects.toThrow(/not found/);
    await createSketchHandler({ title: 'Diagram', ref: 'packet_diagram', manifest: pipelineManifest() });
    await expect(getImageRenderPacketHandler({ ref: 'packet_diagram' })).rejects.toThrow(/not an image-outcome/);
    await createSketchHandler({ title: 'Manga', ref: 'packet_targets', manifest: mangaSignalPageFixture() });
    await expect(getImageRenderPacketHandler({ ref: 'packet_targets', target: 'page' })).rejects.toThrow(/not a render target/);
    await expect(getImageRenderPacketHandler({ ref: 'packet_targets', target: 'p9' })).rejects.toThrow(/not a render target/);
  });

  it('declared characters yield reference-sheet briefs and a sheets-first protocol step', async () => {
    const manifest = mangaSignalPageFixture();
    manifest.characters = [
      {
        id: 'hero',
        name: 'Aki',
        description: 'wiry courier, short asymmetric black hair',
        outfits: [{ id: 'street', description: 'hooded courier jacket' }],
      },
    ];
    manifest.panels[0].figures[0] = { id: 'hero', x: 386, y: 630, pose: 'stand', character: 'hero', outfit: 'street' };
    await createSketchHandler({ title: 'Cast manga', ref: 'packet_cast', manifest });
    const packet = await getImageRenderPacketHandler({ ref: 'packet_cast', target: 'p1' });
    expect(packet.characterSheets).toHaveLength(1);
    expect(packet.characterSheets[0]).toMatchObject({ id: 'hero', name: 'Aki', outfits: ['street'] });
    expect(packet.characterSheets[0].instructions).toContain('NEUTRAL PRESENTATION');
    expect(packet.workerProtocol[0]).toContain('0. FIRST — before any panel');
    expect(packet.workerProtocol[0]).toContain('identity reference');
    expect(packet.instructions).toContain('[character hero, outfit street — match the reference sheet exactly]');
    // characterless packets stay unchanged
    await createSketchHandler({ title: 'Plain manga', ref: 'packet_plain', manifest: mangaSignalPageFixture() });
    const plain = await getImageRenderPacketHandler({ ref: 'packet_plain' });
    expect(plain.characterSheets).toBeUndefined();
    expect(plain.workerProtocol[0]).toContain('1. Fetch the scaffold PNG');
  });

  it('character-sheet lifecycle: mint → pull packet → bind PNG → reuse by ref in a comic', async () => {
    // 1. Mint the character as its own reusable primitive.
    await createSketchHandler({
      title: 'Aki — courier',
      ref: 'sheet_aki',
      manifest: {
        kind: 'character-sheet',
        title: 'Aki — courier',
        character: {
          id: 'aki',
          name: 'Aki',
          description: 'wiry courier, short asymmetric black hair',
          outfits: [
            { id: 'street', description: 'hooded courier jacket' },
            { id: 'rooftop-gear', description: 'harness and goggles' },
          ],
        },
      },
    });
    const stored = SketchRepository.getByRef('sheet_aki');
    expect(stored.manifest.kind).toBe('character-sheet');
    expect(stored.manifest.character.outfits).toHaveLength(2);

    // 2. The sheet itself is a pullable render target with a strip scaffold.
    const sheetPacket = await getImageRenderPacketHandler({ ref: 'sheet_aki' });
    expect(sheetPacket.targets).toEqual(['page']);
    expect(sheetPacket.instructions).toContain('NEUTRAL PRESENTATION');
    expect(sheetPacket.workerProtocol[0]).toContain('bind_character_sheet');
    expect(sheetPacket.boundSheet).toBeUndefined();

    // 3. The worker binds its generated PNG; bindings are append-only.
    const bound = await bindCharacterSheetHandler({ ref: 'sheet_aki', image_base64: TINY_PNG_BASE64 });
    expect(bound).toMatchObject({ ok: true, ref: 'sheet_aki', n: 1 });
    expect(bound.url).toBe('/api/sketches/sheet_aki/sheet.png');
    const again = await bindCharacterSheetHandler({ ref: 'sheet_aki', image_base64: TINY_PNG_BASE64 });
    expect(again.n).toBe(2);

    // 4. A comic casts the character by ref; the sheet inlines at mint.
    const comic = mangaSignalPageFixture();
    comic.characters = [{ ref: 'sheet_aki' }];
    comic.panels[0].figures[0] = { id: 'hero', x: 386, y: 630, pose: 'stand', character: 'aki', outfit: 'street' };
    await createSketchHandler({ title: 'Reused cast', ref: 'packet_reuse', manifest: comic });
    const minted = SketchRepository.getByRef('packet_reuse');
    expect(minted.manifest.characters[0]).toMatchObject({ id: 'aki', ref: 'sheet_aki' });

    // 5. The packet serves the bound PNG as the conditioning reference.
    const packet = await getImageRenderPacketHandler({ ref: 'packet_reuse', target: 'p1' });
    expect(packet.characterSheets[0].ref).toBe('sheet_aki');
    expect(packet.characterSheets[0].boundSheet.n).toBe(2);
    expect(packet.characterSheets[0].boundSheet.url).toBe('/api/sketches/sheet_aki/sheet.png');
    expect(packet.workerProtocol[0]).toContain('do NOT regenerate that character');
    expect(packet.instructions).toContain('[character aki, outfit street');
  });

  it('bind_character_sheet rejects wrong kinds, non-PNGs, and ambiguous sources', async () => {
    await createSketchHandler({ title: 'Manga', ref: 'packet_not_sheet', manifest: mangaSignalPageFixture() });
    await expect(bindCharacterSheetHandler({ ref: 'packet_not_sheet', image_base64: TINY_PNG_BASE64 }))
      .rejects.toThrow(/bind to the character-sheet ref itself/);
    await createSketchHandler({
      title: 'Solo',
      ref: 'sheet_solo',
      manifest: {
        kind: 'character-sheet',
        title: 'Solo',
        character: { id: 'solo', description: 'a lone figure' },
      },
    });
    await expect(bindCharacterSheetHandler({ ref: 'sheet_solo' })).rejects.toThrow(/exactly one of/);
    await expect(bindCharacterSheetHandler({ ref: 'sheet_solo', image_base64: Buffer.from('not a png').toString('base64') }))
      .rejects.toThrow(/not a PNG/);
    // unresolved ref pointing at a missing sheet fails at mint, not silently
    const comic = mangaSignalPageFixture();
    comic.characters = [{ ref: 'sk_ghost' }];
    await expect(createSketchHandler({ title: 'Ghost cast', ref: 'packet_ghost', manifest: comic }))
      .rejects.toThrow(/'sk_ghost' not found/);
  });

  it('bind_image_render: bind every panel → final composite unlocks → cook-ready', async () => {
    await createSketchHandler({ title: 'Manga', ref: 'packet_final', manifest: mangaSignalPageFixture() });
    const before = await getImageRenderPacketHandler({ ref: 'packet_final' });
    expect(before.boundRenders).toBeUndefined();
    expect(before.finalUrl).toBeUndefined();
    expect(before.workerProtocol.join('\n')).toContain('bind_image_render');

    let last;
    for (const target of ['p1', 'p2', 'p3', 'p4']) {
      last = await bindImageRenderHandler({ ref: 'packet_final', target, image_base64: TINY_PNG_BASE64 });
    }
    expect(last.remaining_targets).toEqual([]);
    expect(last.final_url).toBe('/api/sketches/packet_final/final.png');

    const after = await getImageRenderPacketHandler({ ref: 'packet_final' });
    expect(after.boundRenders).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1 });
    expect(after.finalUrl).toBe('/api/sketches/packet_final/final.png');

    // the composite is real: the publication resolver returns the final PNG
    const { resolveSketchItem } = await import('@/lib/outcomes/resolvers/sketch.js');
    const resolved = await resolveSketchItem(
      { metadata: { sketch_ref: 'packet_final' } },
      { preferFinalRender: true },
    );
    expect(resolved.png?.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(resolved.svgInline).toBeNull();
    // without the flag (or before binding) the scaffold serves as the nēmu
    const scaffold = await resolveSketchItem({ metadata: { sketch_ref: 'packet_final' } });
    expect(scaffold.svgInline).toContain('clip-p1');
  });

  it('bind_image_render validates targets, kinds, and sources', async () => {
    await createSketchHandler({ title: 'Manga', ref: 'packet_bind_bad', manifest: mangaSignalPageFixture() });
    await expect(bindImageRenderHandler({ ref: 'packet_bind_bad', target: 'page', image_base64: TINY_PNG_BASE64 }))
      .rejects.toThrow(/valid target.*p1, p2, p3, p4/);
    await expect(bindImageRenderHandler({ ref: 'packet_bind_bad', image_base64: TINY_PNG_BASE64 }))
      .rejects.toThrow(/valid target/); // multi-target needs an explicit target
    // single-target kinds may omit target
    await createSketchHandler({ title: 'Shot', ref: 'packet_bind_shot', manifest: cityBlockoutFixture() });
    const bound = await bindImageRenderHandler({ ref: 'packet_bind_shot', image_base64: TINY_PNG_BASE64 });
    expect(bound.target).toBe('page');
    expect(bound.final_url).toBe('/api/sketches/packet_bind_shot/final.png');
    // character sheets are redirected to their own bind tool
    await createSketchHandler({
      title: 'Solo', ref: 'packet_bind_sheet',
      manifest: { kind: 'character-sheet', title: 'Solo', character: { id: 'solo', description: 'a lone figure' } },
    });
    await expect(bindImageRenderHandler({ ref: 'packet_bind_sheet', image_base64: TINY_PNG_BASE64 }))
      .rejects.toThrow(/bind_character_sheet/);
  });

  it('hybrid strategy leads with the page pass, then panels', async () => {
    const manifest = mangaSignalPageFixture();
    manifest.renderStrategy = 'hybrid';
    await createSketchHandler({ title: 'Hybrid', ref: 'packet_hybrid', manifest });
    const packet = await getImageRenderPacketHandler({ ref: 'packet_hybrid' });
    expect(packet.targets).toEqual(['page', 'p1', 'p2', 'p3', 'p4']);
    expect(packet.target).toBe('page'); // hybrid defaults to the palette pass; panels follow
    const panel = await getImageRenderPacketHandler({ ref: 'packet_hybrid', target: 'p2' });
    expect(panel.scaffold.svgUrl).toContain('panel=p2');
    expect(panel.pageScaffold.pngUrl).not.toContain('panel=');
  });
});
