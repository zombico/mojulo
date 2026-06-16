import { describe, expect, it } from 'vitest';

import { resolveRoomSceneElementPlan } from './room-scene-elements.js';
import {
  projectLeggedThing,
  resolveLeggedThing,
  resolveLeggedThingLibrary,
} from './room-legged-things.js';

const ROOM_BASIS = {
  worldExtent: { width: 16, depth: 12, height: 8 },
  xRange: [0, 16],
  yRange: [0, 12],
};

const CAMERA = {
  kind: 'two-point',
  viewBox: { width: 800, height: 600 },
  worldFraming: {
    cameraPosition: [18, 18, 7],
    lookAt: [8, 5, 2.2],
    horizontalFov: 62,
    pictureCenter: [400, 330],
  },
};

function element(type, id = type) {
  const plan = resolveRoomSceneElementPlan({
    elements: [{ id, type, anchor: [0.5, 0.5], areaShare: type === 'chair' ? 0.035 : 0.06 }],
  }, ROOM_BASIS);
  return plan.elements[0];
}

describe('room legged things', () => {
  it('expands a table height manji into a four-leg table with blobPla joinery', () => {
    const thing = resolveLeggedThing(element('table', 'work-table'), { variant: 'four-leg' });

    expect(thing).toMatchObject({ kind: 'roomLeggedThing', family: 'table', variant: 'four-leg' });
    expect(thing.parts.some((part) => part.kind === 'top-plane' && part.orientation === 'horizontal')).toBe(true);
    expect(thing.parts.filter((part) => part.kind === 'apron-plane' && part.orientation === 'vertical')).toHaveLength(2);
    expect(thing.supports).toHaveLength(4);
    expect(thing.adapters).toHaveLength(4);
    expect(thing.adapters.every((adapter) => adapter.kind === 'blobPla' && adapter.blobPlaAdapter)).toBe(true);
  });

  it('supports pedestal and shelf-table variants deterministically', () => {
    const table = element('table', 'round-table');
    const pedestal = resolveLeggedThing(table, { variant: 'pedestal' });
    const shelf = resolveLeggedThing(table, { variant: 'shelf-table' });

    expect(pedestal.supports).toHaveLength(1);
    expect(pedestal.parts.some((part) => part.kind === 'round-foot' && part.orientation === 'round')).toBe(true);
    expect(shelf.supports).toHaveLength(4);
    expect(shelf.parts.some((part) => part.kind === 'shelf-plane' && part.orientation === 'horizontal')).toBe(true);
    expect(shelf.parts.some((part) => part.kind === 'apron-plane' && part.orientation === 'vertical')).toBe(true);
  });

  it('expands chairs into seat, back, and arm shelf planes by variant', () => {
    const chair = element('chair', 'reading-chair');
    const sideChair = resolveLeggedThing(chair, { variant: 'side-chair' });
    const armchair = resolveLeggedThing(chair, { variant: 'armchair' });

    expect(sideChair.family).toBe('chair');
    expect(sideChair.parts.some((part) => part.kind === 'seat-plane' && part.orientation === 'horizontal')).toBe(true);
    expect(sideChair.parts.some((part) => part.kind === 'back-plane' && part.orientation === 'vertical')).toBe(true);
    expect(sideChair.supports).toHaveLength(4);
    expect(armchair.parts.filter((part) => part.kind === 'arm-plane' && part.orientation === 'vertical')).toHaveLength(2);
    expect(armchair.supports.every((support) => support.kind === 'block')).toBe(true);
  });

  it('builds a small variant library from entries', () => {
    const table = element('table', 'table-source');
    const chair = element('chair', 'chair-source');
    const library = resolveLeggedThingLibrary([
      { id: 'trestle-study', type: 'table', variant: 'trestle', element: table },
      { id: 'bench-study', type: 'chair', variant: 'bench', element: chair },
    ]);

    expect(library.map((thing) => [thing.id, thing.variant, thing.supports.length])).toEqual([
      ['trestle-study', 'trestle', 2],
      ['bench-study', 'bench', 2],
    ]);
  });

  it('projects legged thing parts and supports through the room camera', () => {
    const thing = resolveLeggedThing(element('chair', 'reading-chair'), { variant: 'side-chair' });
    const projected = projectLeggedThing(thing, CAMERA, ROOM_BASIS);

    expect(projected.projectedParts.length).toBeGreaterThanOrEqual(2);
    expect(projected.projectedSupports).toHaveLength(4);
    for (const support of projected.projectedSupports) {
      expect(Number.isFinite(support.projectedTop.x)).toBe(true);
      expect(Number.isFinite(support.projectedBottom.y)).toBe(true);
    }
  });
});
