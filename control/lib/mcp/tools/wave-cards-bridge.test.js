/**
 * Wave 1.5 card migration bridge test.
 *
 * For each of the 6 migrated surface cards, prove that invoking by name
 * (`programRef: '<card>'`) produces the SAME rendered SVG as the
 * recipe-copy form (top-level `waveFields[]` with the card's recipe
 * verbatim). If the SVGs match, the migration is sound and operator
 * agents can switch to the 1-line invocation safely.
 *
 * Container preset semantics under test:
 *   - A `programRef` whose resolved manjiProgram has `children: [...]`
 *     and no spine / no slots is treated as a TRANSPARENT WRAPPER.
 *   - The card's child leaf marks are inlined at the calling node's
 *     position; the host's enclosing-manji id stays in scope as
 *     `parentSelfId`, so `self/slot/<id>` inside the card resolves to
 *     the host's slot.
 *   - Calling pattern: bind `{ programRef: 'calm-water' }` as a child
 *     of a host manji whose slots are named NW / NE / SE / SW (matching
 *     the card's `boundaryContract.corners`).
 */

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createManjiTreeHandler } from './manji-trees.js';
import { renderManjiTreeToSvg } from '@/lib/graph/polygonizer/manji-svg.js';
import { getManjiProgramShelfCard } from '@/lib/graph/manji-programs/loader';

beforeEach(() => {
  closeDb();
});

// A 20×20 host with NW/NE/SE/SW slots — the contract the migrated
// surface cards reference via `self/slot/<corner>`. Shared across all
// six card tests to keep the rendered scene comparable.
function hostScene() {
  return {
    id: 'host',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: -10, z: 0 },
    slots: [
      { id: 'NW', position: { x: -10, y: -10, z: 0 } },
      { id: 'NE', position: { x:  10, y: -10, z: 0 } },
      { id: 'SE', position: { x:  10, y:  10, z: 0 } },
      { id: 'SW', position: { x: -10, y:  10, z: 0 } },
      { id: 'fill', position: { x: 0, y: 0, z: 0 } },
    ],
  };
}

const PHYSICS = {
  gravity: { x: 0, y: 0, z: -1 },
  gravityStrength: 1,
  defaultSagFactor: 0.12,
};

function manifestByName(cardId) {
  const tree = hostScene();
  tree.children = [{ slot: 'fill', node: { programRef: cardId } }];
  return {
    title: `${cardId} (by-name)`,
    dimensions: '3d',
    tree,
    physics: PHYSICS,
    showSlotMarkers: false,
  };
}

function manifestRecipeCopy(cardId) {
  const card = getManjiProgramShelfCard(cardId);
  const recipe = card?.manjiProgram?.children?.[0];
  if (!recipe || recipe.kind !== 'wave-field') {
    throw new Error(`expected migrated card '${cardId}' to carry a wave-field leaf under manjiProgram.children[0]`);
  }
  return {
    title: `${cardId} (recipe-copy)`,
    dimensions: '3d',
    tree: hostScene(),
    physics: PHYSICS,
    waveFields: [
      {
        corners: ['host/slot/NW', 'host/slot/NE', 'host/slot/SE', 'host/slot/SW'],
        waves: recipe.waves,
        samples: recipe.samples,
        style: recipe.style,
      },
    ],
    showSlotMarkers: false,
  };
}

const CARDS = [
  'calm-water',
  'choppy-sea',
  'flat-floor',
  'tile-grid-floor',
  'rolling-hills',
  'clear-sky-gradient',
];

describe('Wave 1.5 card migration — by-name vs recipe-copy SVG bridge', () => {
  for (const cardId of CARDS) {
    it(`${cardId}: by-name programRef and recipe-copy waveFields produce the same SVG`, async () => {
      const byNameRef = `wcb_${cardId.replace(/-/g, '_')}_byname`;
      const recipeRef = `wcb_${cardId.replace(/-/g, '_')}_recipe`;

      const byNameResult = await createManjiTreeHandler({
        ref: byNameRef,
        ...manifestByName(cardId),
      });
      expect(byNameResult.ok).toBe(true);

      const recipeResult = await createManjiTreeHandler({
        ref: recipeRef,
        ...manifestRecipeCopy(cardId),
      });
      expect(recipeResult.ok).toBe(true);

      const byNameSvg = renderManjiTreeToSvg(SketchRepository.getByRef(byNameRef).manifest);
      const recipeSvg = renderManjiTreeToSvg(SketchRepository.getByRef(recipeRef).manifest);

      // Strip titles so the comparison reduces to the rendered geometry.
      const strip = (svg) => svg.replace(
        /<text [^>]*>[^<]*\(by-name\)<\/text>/,
        '<text>TITLE</text>',
      ).replace(
        /<text [^>]*>[^<]*\(recipe-copy\)<\/text>/,
        '<text>TITLE</text>',
      );
      expect(strip(byNameSvg)).toBe(strip(recipeSvg));
    });
  }
});
