/**
 * Bridge test — acceptance check #2 from the wave-and-line-in-tree plan.
 *
 * A scene authored as top-level `connections[]` / `waveFields[]` arrays
 * must produce a BYTE-IDENTICAL SVG to the same scene authored with the
 * same primitives as `kind: 'connection'` / `kind: 'wave-field'` leaf
 * marks inside the tree. If this holds, the desugar path is sound and
 * card-side migration is safe.
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

// Shared scene fragments — the SAME tree-and-physics for both forms.

function towerSpine(height) {
  return {
    spine: {
      bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'closed' }, lengthScale: height },
      bar1: { axis: 'N-S',          tails: { N: 'open', S: 'open' },             lengthScale: 0.4 },
      bar2: { axis: 'E-W',          tails: { W: 'open', E: 'open' },             lengthScale: 0.4 },
    },
    slots: [],
  };
}

function bridgeTreeShared() {
  return {
    id: 'world',
    spine: {
      bar2: { axis: 'E-W', tails: { W: 'closed', E: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: -12, z: 0 },
    slots: [
      { id: 'tower-L-anchor', position: { x: -9, y: 0, z: 0 } },
      { id: 'tower-R-anchor', position: { x:  9, y: 0, z: 0 } },
      { id: 'floor-NW', position: { x: -9, y: -3, z: -1 } },
      { id: 'floor-NE', position: { x:  9, y: -3, z: -1 } },
      { id: 'floor-SE', position: { x:  9, y:  3, z: -1 } },
      { id: 'floor-SW', position: { x: -9, y:  3, z: -1 } },
    ],
    children: [
      { slot: 'tower-L-anchor', node: { id: 'tower-L', ...towerSpine(3) } },
      { slot: 'tower-R-anchor', node: { id: 'tower-R', ...towerSpine(3) } },
    ],
  };
}

const PHYSICS = {
  gravity: { x: 0, y: 0, z: -1 },
  gravityStrength: 1,
  defaultSagFactor: 0.18,
};

const CABLE_SPEC = {
  from: 'tower-L/bar/Zenith-Nadir/posTip',
  to:   'tower-R/bar/Zenith-Nadir/posTip',
  style: { stroke: '#222', width: 1.4 },
};

const FLOOR_SPEC = {
  corners: ['world/slot/floor-NW', 'world/slot/floor-NE', 'world/slot/floor-SE', 'world/slot/floor-SW'],
  samples: { u: 8, v: 6 },
  waves: [{ amplitude: 0.4, cycles: { u: 2, v: 1 } }],
  style: { stroke: '#789', width: 0.5 },
};

function manifestTopLevelArrays() {
  return {
    title: 'bridge with top-level arrays',
    dimensions: '3d',
    tree: bridgeTreeShared(),
    physics: PHYSICS,
    connections: [CABLE_SPEC],
    waveFields: [FLOOR_SPEC],
    showSlotMarkers: false,
  };
}

function manifestInTreeLeaves() {
  // SAME scene; lift the cable and floor into the tree as leaf marks
  // bound under generic overlay slots that don't affect any rendered
  // geometry (the leaves' positions come entirely from their endpoints).
  const tree = bridgeTreeShared();
  tree.slots.push({ id: 'cable-overlay', position: { x: 0, y: 0, z: 0 } });
  tree.slots.push({ id: 'floor-overlay', position: { x: 0, y: 0, z: 0 } });
  tree.children.push(
    { slot: 'cable-overlay', node: { kind: 'connection', ...CABLE_SPEC } },
    { slot: 'floor-overlay', node: { kind: 'wave-field',  ...FLOOR_SPEC } },
  );
  return {
    title: 'bridge with in-tree leaves',
    dimensions: '3d',
    tree,
    physics: PHYSICS,
    showSlotMarkers: false,
  };
}

describe('in-tree leaves vs top-level arrays — byte-identical SVG', () => {
  it('renders the same scene to the same SVG regardless of authoring form', async () => {
    // Mint both forms.
    const topResult = await createManjiTreeHandler({
      ref: 'bridge_top_level',
      ...manifestTopLevelArrays(),
    });
    expect(topResult.ok).toBe(true);

    const leafResult = await createManjiTreeHandler({
      ref: 'bridge_in_tree',
      ...manifestInTreeLeaves(),
    });
    expect(leafResult.ok).toBe(true);

    const topStored = SketchRepository.getByRef('bridge_top_level');
    const leafStored = SketchRepository.getByRef('bridge_in_tree');

    const topSvg = renderManjiTreeToSvg(topStored.manifest);
    const leafSvg = renderManjiTreeToSvg(leafStored.manifest);

    // The only legitimate differences would be the title text. Strip
    // titles before comparing the rest of the body bytes.
    const stripTitle = (svg) => svg.replace(
      /<text [^>]*>bridge with [^<]+<\/text>/,
      '<text>TITLE</text>',
    );
    expect(stripTitle(leafSvg)).toBe(stripTitle(topSvg));
  });
});
