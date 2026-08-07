/**
 * Lathe end-to-end bridge test.
 *
 * Mirrors wave-manji-bridge: createManjiTreeHandler accepts a `lathes`
 * array, the validator runs at mint time, the manifest persists, and
 * renderManjiTreeToSvg projects + draws the lathe's cross-section
 * polylines into the final SVG.
 */

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createManjiTreeHandler } from './manji-trees.js';
import { renderManjiTreeToSvg } from '@/lib/graph/polygonizer/manji-svg.js';

beforeEach(() => {
  closeDb();
});

function twoSlotScene() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.5 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'top',  position: { x: 0, y: 0, z: 4 } },
      { id: 'base', position: { x: 0, y: 0, z: 0 } },
    ],
  };
}

const PHYSICS = {
  gravity: { x: 0, y: 0, z: -1 },
  gravityStrength: 1,
  defaultSagFactor: 0.12,
};

describe('lathe bridge — mint → store → render', () => {
  it('renders a cylinder via top-level lathes array', async () => {
    const result = await createManjiTreeHandler({
      title: 'cylinder-bridge',
      dimensions: '3d',
      tree: twoSlotScene(),
      physics: PHYSICS,
      showSlotMarkers: false,
      lathes: [
        {
          axisFrom: 'world/slot/top',
          axisTo: 'world/slot/base',
          profile: [{ t: 0, radius: 0.5 }],
          crossSections: 12,
          samples: 24,
        },
      ],
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    expect(sketch.manifest.lathes).toHaveLength(1);
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<svg/);
    expect(svg).toMatch(/<line /);
  });

  it('renders an in-tree lathe leaf', async () => {
    const result = await createManjiTreeHandler({
      title: 'in-tree-lathe',
      dimensions: '3d',
      tree: {
        ...twoSlotScene(),
        children: [
          {
            slot: 'base',
            node: {
              kind: 'lathe',
              axisFrom: 'self/slot/top',
              axisTo: 'self/slot/base',
              profile: [
                { t: 0.0, radius: 0.5 },
                { t: 0.5, radius: 0.3 },
                { t: 1.0, radius: 0.6 },
              ],
              crossSections: 12,
              samples: 24,
              style: { stroke: '#a60', width: 0.6 },
            },
          },
        ],
      },
      physics: PHYSICS,
      showSlotMarkers: false,
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toContain('stroke="#a60"');
  });

  it('rejects an unresolvable axisFrom path at mint time', async () => {
    await expect(
      createManjiTreeHandler({
        title: 'bad-axis',
        dimensions: '3d',
        tree: twoSlotScene(),
        physics: PHYSICS,
        lathes: [
          {
            axisFrom: 'world/slot/missing',
            axisTo: 'world/slot/base',
            profile: [{ t: 0, radius: 1 }],
          },
        ],
      }),
    ).rejects.toThrow(/Invalid manji-tree lathes|slot 'missing'/);
  });

  it('rejects a lathes array in 2D mode', async () => {
    await expect(
      createManjiTreeHandler({
        title: '2d-lathe',
        dimensions: '2d',
        tree: twoSlotScene(),
        lathes: [
          {
            axisFrom: { x: 0, y: 0, z: 0 },
            axisTo: { x: 0, y: 0, z: 1 },
            profile: [{ t: 0, radius: 1 }],
          },
        ],
      }),
    ).rejects.toThrow(/3D only/);
  });

  it('renders a chiseled column (24-fold negative harmonic)', async () => {
    const result = await createManjiTreeHandler({
      title: 'fluted-column-bridge',
      dimensions: '3d',
      tree: twoSlotScene(),
      physics: PHYSICS,
      showSlotMarkers: false,
      lathes: [
        {
          axisFrom: 'world/slot/top',
          axisTo: 'world/slot/base',
          profile: [
            { t: 0, radius: 0.45 },  // top
            { t: 0.5, radius: 0.5 }, // mid bulge
            { t: 1, radius: 0.55 },  // base
          ],
          harmonics: [{ n: 24, amplitude: -0.025 }],
          crossSections: 18,
          samples: 72,
          style: { stroke: '#6a5f4d', width: 0.45 },
        },
      ],
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<line /);
  });

  it('lathe ref by programRef from a shelf card renders', async () => {
    const result = await createManjiTreeHandler({
      title: 'chalice-shelf-card',
      dimensions: '3d',
      tree: {
        ...twoSlotScene(),
        children: [
          { slot: 'base', node: { programRef: 'chalice' } },
        ],
      },
      physics: PHYSICS,
      showSlotMarkers: false,
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<line /);
  });
});
