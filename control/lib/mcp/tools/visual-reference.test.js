// In-memory SQLite + no semantic index — must run before importing db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { getDb } from '@/lib/db/index.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { renderFigureToSvg } from '@/lib/graph/polygonizer/figure-render';
import { renderSketchToSvg } from '@/lib/graph/sketch-svg';
import { referenceProtocolHandler, captureReferenceHandler } from './visual-reference.js';
import { ensureToolsRegistered, listRegisteredToolNames } from '@/lib/mcp/server';

// Touch the DB so migrations run before the first repo call.
getDb();

const SCENE_INSIGHTS = {
  camera: {
    vanishingPoints: { left: [-220, 245], right: [1180, 245] },
    horizonY: 245,
    verticalAxis: [0, -1],
  },
  roomBasis: { frontLeft: [210, 510], depthReach: 0.46, verticalUnit: 26 },
  scale: { relative: 'figure ≈ 0.4 × door', grounded: false },
  thematic: { mood: 'warm low-key' },
  caveats: ['affine two-point — wide-angle curvature flattened'],
};

const POSE_INSIGHTS = {
  dials: {
    shR: { yaw: -30, pitch: -4, roll: 92 },
    elbowR: 90,
    hipL: { yaw: 8, pitch: 4 },
    kneeL: 12,
    head: { yaw: 13, pitch: -7 },
    spine: { sagittal: -0.1, lateral: 0.11, axial: 0.04 },
  },
  view: 'frontal',
  gesture: 'right arm raised, weight on left leg',
  confidence: { inPlane: 'high', depth: 'low', roll: 'unknown' },
  caveats: ['forearm roll unresolved from frontal view'],
};

describe('registration', () => {
  it('registers both tools into the MCP server', async () => {
    await ensureToolsRegistered();
    const names = listRegisteredToolNames();
    expect(names).toContain('reference_protocol');
    expect(names).toContain('capture_reference');
  });
});

describe('reference_protocol', () => {
  it('returns the scene + pose protocols with the expected shape', async () => {
    const scene = await referenceProtocolHandler({ target: 'scene' });
    expect(scene.ok).toBe(true);
    expect(scene.target).toBe('scene');
    expect(Array.isArray(scene.key_lines)).toBe(true);
    expect(scene.fidelity_contract.thematic).toBeTruthy();
    expect(scene.capture_call).toMatch(/capture_reference/);

    const pose = await referenceProtocolHandler({ target: 'pose' });
    expect(pose.target).toBe('pose');
    // pose now instructs the X-manji trace → solve flow
    expect(Object.keys(pose.input_schema)).toContain('insights.xmanji.landmarks');
    expect(pose.summary).toMatch(/X-manji/);
  });

  it('rejects an unknown target', async () => {
    await expect(referenceProtocolHandler({ target: 'nope' })).rejects.toThrow(/scene/);
  });
});

describe('capture_reference — pose', () => {
  it('mints a figure cage + a reference stash item that renders and carries insights', async () => {
    const res = await captureReferenceHandler({ target: 'pose', insights: POSE_INSIGHTS, label: 'Reach' });
    expect(res.ok).toBe(true);
    expect(res.target).toBe('pose');
    expect(res.fidelity).toBe('gesture'); // default
    expect(res.passes).toBe(1);
    expect(res.cage_ref).toMatch(/^sk_/);

    // The cage is a real figure sketch and renders.
    const sketch = SketchRepository.getByRef(res.cage_ref);
    expect(sketch.manifest.kind).toBe('figure');
    expect(sketch.manifest.pose.elbowR).toBe(90);
    expect(() => renderFigureToSvg(sketch.manifest)).not.toThrow();

    // The stash item is a sketch item carrying insights back.
    const full = StashRepository.getFull(res.stash_ref);
    const item = full.items.find((it) => it.id === res.item_id);
    expect(item.type).toBe('sketch');
    expect(item.metadata.sketch_ref).toBe(res.cage_ref);
    expect(item.metadata.reference_target).toBe('pose');
    expect(item.metadata.insights.gesture).toBe('right arm raised, weight on left leg');
  });

  it('refines across a second pass into the same stash', async () => {
    const first = await captureReferenceHandler({ target: 'pose', insights: POSE_INSIGHTS, title: 'Wave study' });
    const second = await captureReferenceHandler({
      target: 'pose',
      insights: { ...POSE_INSIGHTS, view: 'lateral' },
      stash_ref: first.stash_ref,
    });
    expect(second.stash_ref).toBe(first.stash_ref);
    expect(second.passes).toBe(2);
    const full = StashRepository.getFull(first.stash_ref);
    const poseItems = full.items.filter((it) => it.metadata?.reference_target === 'pose');
    expect(poseItems).toHaveLength(2);
  });

  it('solves the dials from a traced X-manji (direction B) end to end', async () => {
    // A traced X-manji: head + bars + limbs in anatomical coords (figure-right = +x, y up).
    const xmanji = {
      view: 0,
      landmarks: {
        headTop: { x: 0.04, y: 0.91 }, neckHub: { x: 0.05, y: 0.80 },
        navel: { x: 0.05, y: 0.64 }, pelvisHub: { x: 0.05, y: 0.55 },
        shoulderR: { x: 0.13, y: 0.765 }, shoulderL: { x: -0.05, y: 0.785 },
        elbowR: { x: 0.16, y: 0.64 }, wristR: { x: 0.17, y: 0.50 },
        elbowL: { x: -0.10, y: 0.64 }, wristL: { x: -0.07, y: 0.70 },
        hipR: { x: 0.10, y: 0.56 }, hipL: { x: -0.02, y: 0.53 },
        kneeR: { x: 0.09, y: 0.34 }, ankleR: { x: 0.08, y: 0.08 },
        kneeL: { x: 0.00, y: 0.34 }, ankleL: { x: -0.03, y: 0.16 },
      },
    };
    const res = await captureReferenceHandler({ target: 'pose', insights: { xmanji }, label: 'traced' });
    expect(res.ok).toBe(true);
    expect(res.solve?.source).toBe('xmanji');
    expect(res.solve.error).toBeLessThan(0.05);
    // At a frontal trace the depth DOFs are frozen, not invented.
    expect(res.solve.frozen).toContain('spine.sagittal');

    // The cage is a real figure built from the SOLVED dials, and they're stored back.
    const sketch = SketchRepository.getByRef(res.cage_ref);
    expect(sketch.manifest.kind).toBe('figure');
    const full = StashRepository.getFull(res.stash_ref);
    const item = full.items.find((it) => it.id === res.item_id);
    expect(item.metadata.insights.dials).toBeTruthy(); // solved dials persisted for create_figure
    expect(typeof item.metadata.insights.dials.shL?.pitch === 'number' || typeof item.metadata.insights.dials.shR?.yaw === 'number').toBe(true);
  });

  it('throws on an over-driven dial that the figure render rejects only if invalid (clamped otherwise)', async () => {
    // A non-object pose is a hard error.
    await expect(
      captureReferenceHandler({ target: 'pose', insights: { dials: 'not-an-object' } }),
    ).rejects.toThrow();
  });
});

describe('capture_reference — scene', () => {
  it('mints a perspective-frame cage that validates + renders, with insights stored', async () => {
    const res = await captureReferenceHandler({ target: 'scene', insights: SCENE_INSIGHTS, label: 'Studio room' });
    expect(res.ok).toBe(true);
    expect(res.fidelity).toBe('thematic'); // default
    expect(res.cage_ref).toMatch(/^sk_/);

    const sketch = SketchRepository.getByRef(res.cage_ref);
    expect(sketch.manifest.kind).toBeUndefined(); // routes to the default renderer
    expect(sketch.manifest.viewBox.width).toBeGreaterThan(0);
    expect(sketch.manifest.marks.length).toBeGreaterThan(0);
    // The default sketch renderer accepts it.
    expect(() => renderSketchToSvg(sketch.manifest, { technical: false })).not.toThrow();

    const full = StashRepository.getFull(res.stash_ref);
    const item = full.items.find((it) => it.id === res.item_id);
    expect(item.metadata.insights.camera.horizonY).toBe(245);
  });

  it('rejects a missing target / insights', async () => {
    await expect(captureReferenceHandler({ insights: SCENE_INSIGHTS })).rejects.toThrow();
    await expect(captureReferenceHandler({ target: 'scene' })).rejects.toThrow();
  });
});
