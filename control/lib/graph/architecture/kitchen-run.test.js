import { describe, expect, it } from 'vitest';

import { planKitchenRun } from './kitchen-run.js';
import { resolveRoomSceneElementPlan, roomSceneRenderElements } from '../polygonizer/room-scene-elements.js';
import { extractRoomSceneFaces } from '../scene/scene-css3d.js';

const roomBasis = {
  worldExtent: { width: 4, depth: 3.5, height: 2.6 },
  xRange: [0, 4],
  yRange: [0, 3.5],
  zRange: [0, 2.6],
};

describe('planKitchenRun', () => {
  it('packs base units along the back + side walls with pre-baked world footprints', () => {
    const { elements } = planKitchenRun(roomBasis);
    const types = elements.map((e) => e.type);
    expect(types).toContain('kitchen-counter');
    expect(types).toContain('kitchen-sink');
    expect(types).toContain('kitchen-stove');
    // every emitted element carries a world-space footprint quad
    for (const el of elements) {
      expect(el.heightManji.basePlane.corners).toHaveLength(4);
      expect(el.heightManji.heightWorld).toBeGreaterThan(0);
    }
  });

  it('drops units that overrun a too-small back wall instead of overflowing', () => {
    const tiny = { ...roomBasis, worldExtent: { width: 1.2, depth: 1.2, height: 2.6 }, xRange: [0, 1.2], yRange: [0, 1.2] };
    const { dropped } = planKitchenRun(tiny);
    expect(dropped.length).toBeGreaterThan(0);
  });
});

describe('room builder ← kitchen-run wiring', () => {
  it('expands a kitchen-run directive in roomConcept.elements into placed units', () => {
    const plan = resolveRoomSceneElementPlan(
      { elements: [{ type: 'kitchen-run' }], roomBasis },
      roomBasis,
    );
    const types = plan.elements.map((e) => e.type);
    expect(types).toContain('kitchen-counter');
    expect(types).toContain('kitchen-fridge');
    // units land at distinct positions — NOT collapsed onto a default anchor
    const centres = plan.elements.map((e) => e.anchor.join(','));
    expect(new Set(centres).size).toBe(plan.elements.length);
  });

  it('passes a pre-baked element through unchanged and raises its topPlane', () => {
    const baked = {
      type: 'kitchen-counter',
      heightManji: { basePlane: { corners: [[0, 0, 0], [0.8, 0, 0], [0.8, 0.6, 0], [0, 0.6, 0]] }, heightWorld: 0.9 },
    };
    const [el] = resolveRoomSceneElementPlan({ elements: [baked], roomBasis }, roomBasis).elements;
    // world corners survive verbatim (not re-derived from a default anchor)
    expect(el.worldCorners).toEqual(baked.heightManji.basePlane.corners);
    expect(el.heightManji.basePlane.corners).toEqual(baked.heightManji.basePlane.corners);
    // topPlane is the base lifted by heightWorld
    expect(el.heightManji.topPlane.corners[0][2]).toBeCloseTo(0.9);
  });

  it('renders kitchen units as workbench-authored room assets (faces grouped per asset)', () => {
    const { faces } = extractRoomSceneFaces({ elements: [{ type: 'kitchen-run' }], roomBasis });
    const groups = new Set(faces.map((f) => f.group).filter(Boolean));
    expect(groups).toContain('asset:kitchen-counter');
    expect(groups).toContain('asset:kitchen-sink');
  });

  it('keeps directive expansion on the render element list too', () => {
    const els = roomSceneRenderElements({ elements: [{ type: 'kitchen-run' }], roomBasis }, { roomBasis });
    expect(els.some((e) => e.type === 'kitchen-stove')).toBe(true);
  });
});
