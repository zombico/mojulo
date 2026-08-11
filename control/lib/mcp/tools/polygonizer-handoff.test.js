process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the embedder so classifyPromptForCards' embedding default doesn't
// load the 113MB ONNX model under unit tests (same stub as
// lib/graph/polygonizer/index.test.js).
vi.mock('@/lib/embedder/local', () => {
  return {
    LOCAL_EMBEDDING_MODEL: 'multilingual-e5-small',
    LOCAL_EMBEDDING_DIM: 3,
    preloadModel: vi.fn(async () => {}),
    generateEmbeddings: vi.fn(async (texts, { inputType }) => {
      if (inputType === 'search_query') return [[1, 0, 0]];
      return texts.map(() => [0, 1, 0]);
    }),
  };
});

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import {
  getPolygonizerPacketHandler,
  submitPolygonizerManifestHandler,
  createSketchHandler,
} from './sketches.js';
import {
  POLYGONIZER_SCHEMA,
  POLYGONIZER_PLANNING_SCHEMA,
} from '@/lib/graph/polygonizer/index.js';

beforeEach(() => {
  closeDb();
});

const PROMPT = 'bookshelf with 4 rows at a slight angle';

// Trimmed copy of index.test.js's known-valid bookshelf fixture (fixtures
// are file-local there by convention).
function bookshelfManifest() {
  return {
    title: 'Bookshelf with 4 rows',
    viewBox: { width: 620, height: 460 },
    polygonizer: {
      subject: 'bookshelf',
      impactPoint: [280, 235],
      concept: { movementConcept: 'portrait', depictionClass: 'object-portrait' },
      picture: {
        framing: 'object portrait',
        shotAngle: 'slight angle',
        cameraDistance: 'medium',
        compositionIntent: 'show four rows and shelf depth',
      },
      elements: [
        { role: 'cabinet-body', importance: 'primary', footprint: 'center', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'shelf-row', importance: 'primary-detail', footprint: 'inside cabinet', depthBand: 'midground', blockingNeeded: 'partition' },
        { role: 'book-spines', importance: 'secondary', footprint: 'inside rows', depthBand: 'foreground', blockingNeeded: 'cca-array' },
      ],
      blockingReality: [
        {
          role: 'cabinet-body-block',
          basis: 'cca',
          footprint: 'center cabinet volume',
          depthBand: 'midground',
          purpose: 'primary bookshelf mass',
        },
        {
          role: 'shelf-row-partition',
          basis: 'partition',
          footprint: 'four horizontal bands inside cabinet-body',
          attachesTo: 'cabinet-body',
          depthBand: 'midground',
          purpose: 'four readable shelf rows',
        },
        {
          role: 'book-spines-item',
          basis: 'array-item',
          footprint: 'repeated narrow vertical blocks inside shelf rows',
          repeats: 'book-spines',
          depthBand: 'foreground',
          purpose: 'book contents without hand-placing every spine',
        },
      ],
      draftingTable: {
        horizonY: 190,
        vanishingPoint: [460, 190],
        baselineY: 382,
        depthBands: { foreground: [300, 420], midground: [140, 300], background: [80, 140] },
        eyeLine: { direction: [-0.45, -0.35], stackingRule: 'front shelf faces paint above back panel' },
      },
      realityFacts: ['4 shelf rows', 'side walls', 'back panel', 'book spines'],
      minimalAbstractions: ['cabinet = solid', 'rows = partition cabinet volume into 4 bands'],
    },
    scene: {
      perspective: { mode: 'one-point', vanishingPoint: [460, 190], depthScale: 230 },
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'solid',
        role: 'cabinet-body',
        x: 150,
        y: 82,
        width: 260,
        height: 300,
        depth: 62,
        fill: '#8a654a',
        stroke: '#3f2f24',
        z: 9,
      },
      {
        kind: 'partition',
        target: 'cabinet-body',
        axis: 'y',
        count: 4,
        role: 'shelf-row',
        thickness: 13,
      },
      {
        kind: 'array',
        role: 'book-spines',
        count: 10,
        from: [190, 156],
        to: [360, 156],
        item: { kind: 'solid', width: 10, height: 48, depth: 18, fill: '#6d7c74' },
      },
    ],
  };
}

function planningOnlyManifest() {
  const m = bookshelfManifest();
  delete m.marks;
  return m;
}

// A minimal known-valid flow-chart manifest for minting preload priors.
function priorPipelineManifest(title) {
  return {
    title,
    viewBox: { width: 760, height: 320 },
    stations: [
      { id: 'input', kind: 'input', label: 'Input', x: 40, y: 112, w: 170, h: 90 },
      { id: 'store', kind: 'db_row', label: 'Store', x: 540, y: 112, w: 170, h: 90 },
    ],
    edges: [{ from: 'input', to: 'store' }],
  };
}

describe('get_polygonizer_packet — the key-free packet half', () => {
  it('one-trip packet carries the same discipline the keyed path would send a provider', async () => {
    const packet = await getPolygonizerPacketHandler({ prompt: PROMPT });
    expect(packet.ok).toBe(true);
    expect(packet.mode).toBe('one-trip');
    expect(packet.phase).toBeUndefined();
    expect(packet.instructions).toContain('polygonizer');
    expect(packet.userPrompt).toContain(PROMPT);
    expect(packet.schema).toEqual(POLYGONIZER_SCHEMA);
    expect(packet.submit).toContain('submit_polygonizer_manifest');
    expect(Array.isArray(packet.classification.cards) || packet.classification.cards === 'all').toBe(true);
  });

  it('plan-then-skin packet is the planning turn: planning schema, no marks', async () => {
    const packet = await getPolygonizerPacketHandler({ prompt: PROMPT, mode: 'plan-then-skin' });
    expect(packet.ok).toBe(true);
    expect(packet.phase).toBe('planning');
    expect(packet.schema).toEqual(POLYGONIZER_PLANNING_SCHEMA);
    expect(packet.instructions).toContain('PLANNING-ONLY TURN');
    expect(packet.submit).toContain('"planning"');
  });

  it('preload priors ride the packet userPrompt and echo back', async () => {
    const prior = await createSketchHandler({ title: 'Prior flow', manifest: priorPipelineManifest('Prior flow') });
    const single = await getPolygonizerPacketHandler({ prompt: PROMPT, preload: prior.ref });
    expect(single.userPrompt).toContain('Prior scene');
    expect(single.preload).toEqual({ ref: prior.ref, title: 'Prior flow' });

    const labeled = await getPolygonizerPacketHandler({
      prompt: PROMPT,
      preload: [{ ref: prior.ref, as: 'setting', note: 'keep the flow' }],
    });
    expect(labeled.userPrompt).toContain('Prior setting');
    expect(labeled.preload).toEqual([{ ref: prior.ref, title: 'Prior flow', as: 'setting', note: 'keep the flow' }]);
  });

  it('guards: prompt required, mode must be known', async () => {
    await expect(getPolygonizerPacketHandler({})).rejects.toThrow(/prompt/);
    await expect(getPolygonizerPacketHandler({ prompt: PROMPT, mode: 'three-trip' })).rejects.toThrow(/mode/);
  });
});

describe('submit_polygonizer_manifest — the key-free submit half', () => {
  it('happy one-trip round trip: agent manifest -> validated -> minted', async () => {
    const result = await submitPolygonizerManifestHandler({
      prompt: PROMPT,
      manifest: bookshelfManifest(),
      ref: 'agent-bookshelf',
    });
    expect(result.ok).toBe(true);
    expect(result.expandedManifest).toBeDefined();
    expect(result.sketch).toEqual({ ok: true, ref: 'agent-bookshelf', url: '/sketches/agent-bookshelf' });
    const stored = SketchRepository.getByRef('agent-bookshelf');
    expect(stored).toBeTruthy();
    expect(stored.manifest.marks.length).toBeGreaterThan(0);
  });

  it('accepts the manifest as a fenced JSON string (agents hand back fenced blocks)', async () => {
    const fenced = '```json\n' + JSON.stringify(bookshelfManifest()) + '\n```';
    const result = await submitPolygonizerManifestHandler({ prompt: PROMPT, manifest: fenced, ref: 'fenced-bookshelf' });
    expect(result.ok).toBe(true);
    expect(SketchRepository.getByRef('fenced-bookshelf')).toBeTruthy();
  });

  it('conversational repair loop: broken manifest -> repairPrompt -> corrected resubmit mints', async () => {
    // A dangling partition target — not typo-close to any prior role, so the
    // deterministic repair patches can't fix it (same breakage index.test.js
    // uses for the keyed repair loop).
    const broken = bookshelfManifest();
    broken.marks[1] = { ...broken.marks[1], target: 'missing-cabinet' };
    const failed = await submitPolygonizerManifestHandler({ prompt: PROMPT, manifest: broken });
    expect(failed.ok).toBe(false);
    expect(failed.errors.join('\n')).toContain("target 'missing-cabinet'");
    expect(failed.repairPrompt).toContain(PROMPT);
    expect(failed.next).toContain('repairPrompt');
    expect(failed.sketch).toBeUndefined();

    const repaired = await submitPolygonizerManifestHandler({ prompt: PROMPT, manifest: bookshelfManifest(), ref: 'repaired-bookshelf' });
    expect(repaired.ok).toBe(true);
    expect(SketchRepository.getByRef('repaired-bookshelf')).toBeTruthy();
  });

  it('mint: false validates without persisting', async () => {
    const result = await submitPolygonizerManifestHandler({ prompt: PROMPT, manifest: bookshelfManifest(), mint: false, ref: 'never-minted' });
    expect(result.ok).toBe(true);
    expect(result.sketch).toBeUndefined();
    expect(SketchRepository.getByRef('never-minted')).toBeFalsy();
  });

  it('plan-then-skin chain: planning submit returns scaffold + skinPacket; skin submit mints', async () => {
    const planning = await submitPolygonizerManifestHandler({
      prompt: PROMPT,
      manifest: planningOnlyManifest(),
      mode: 'plan-then-skin',
      phase: 'planning',
    });
    expect(planning.ok).toBe(true);
    expect(planning.scaffold).toBeDefined();
    expect(planning.scaffold.draftingTable).toBeTruthy();
    expect(planning.authorshipPreview?.verdict).toBe('passed');
    expect(planning.skinPacket.instructions).toContain('SKIN-ONLY TURN');
    expect(planning.skinPacket.userPrompt).toContain('Solved scaffold');
    expect(planning.skinPacket.schema).toEqual(POLYGONIZER_SCHEMA);
    expect(planning.skinPacket.submit).toContain('"skin"');

    const skinned = await submitPolygonizerManifestHandler({
      prompt: PROMPT,
      manifest: bookshelfManifest(),
      mode: 'plan-then-skin',
      phase: 'skin',
      ref: 'planned-bookshelf',
    });
    expect(skinned.ok).toBe(true);
    expect(skinned.phase).toBe('skin');
    expect(SketchRepository.getByRef('planned-bookshelf')).toBeTruthy();
  });

  it('planning failure returns planning-phase errors + repairPrompt, no skinPacket', async () => {
    const broken = planningOnlyManifest();
    delete broken.viewBox;
    const result = await submitPolygonizerManifestHandler({
      prompt: PROMPT,
      manifest: broken,
      mode: 'plan-then-skin',
      phase: 'planning',
    });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('planning');
    expect(result.errors.some((e) => /viewBox/.test(e))).toBe(true);
    expect(result.repairPrompt).toContain('planning');
    expect(result.skinPacket).toBeUndefined();
  });

  it('guards: manifest required, phase required for plan-then-skin, forbidden for one-trip', async () => {
    await expect(submitPolygonizerManifestHandler({ prompt: PROMPT })).rejects.toThrow(/manifest/);
    await expect(
      submitPolygonizerManifestHandler({ prompt: PROMPT, manifest: bookshelfManifest(), mode: 'plan-then-skin' }),
    ).rejects.toThrow(/phase/);
    await expect(
      submitPolygonizerManifestHandler({ prompt: PROMPT, manifest: bookshelfManifest(), phase: 'skin' }),
    ).rejects.toThrow(/plan-then-skin/);
    await expect(
      submitPolygonizerManifestHandler({ prompt: PROMPT, manifest: 'not json at all' }),
    ).rejects.toThrow(/JSON/);
  });
});
