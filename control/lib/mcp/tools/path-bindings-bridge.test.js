/**
 * pathBindings bridge test — proves that a host whose slot names don't
 * match a shelf card's contract can still invoke the card by name and
 * get a byte-identical SVG to the recipe-copy form.
 *
 * Setup mimics the helicopter-island scene: the root manji has
 * `water-NW`/`water-NE`/`water-SE`/`water-SW` slots (natural names for
 * an island scene), and the `calm-water` card's contract is
 * `self/slot/NW`/`NE`/`SE`/`SW`. Without pathBindings, the by-name
 * invocation can't reach those slots. With pathBindings, the agent
 * aliases each contract path to the host's actual path and the card
 * works.
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

// A host whose slot names follow island-scene convention (prefixed,
// case mismatches the card's NW/NE/SE/SW contract).
function islandLikeHost() {
  return {
    id: 'island',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
    anchor: { x: 0, y: -10, z: 0 },
    slots: [
      { id: 'water-NW', position: { x: -12, y: -12, z: -0.3 } },
      { id: 'water-NE', position: { x:  12, y: -12, z: -0.3 } },
      { id: 'water-SE', position: { x:  12, y:  10, z: -0.3 } },
      { id: 'water-SW', position: { x: -12, y:  10, z: -0.3 } },
      { id: 'fill',     position: { x: 0, y: 0, z: 0 } },
    ],
  };
}

const PHYSICS = {
  gravity: { x: 0, y: 0, z: -1 },
  gravityStrength: 1,
  defaultSagFactor: 0.12,
};

function manifestByNameWithBindings() {
  const tree = islandLikeHost();
  tree.children = [{
    slot: 'fill',
    node: {
      programRef: 'calm-water',
      pathBindings: {
        'self/slot/NW': 'island/slot/water-NW',
        'self/slot/NE': 'island/slot/water-NE',
        'self/slot/SE': 'island/slot/water-SE',
        'self/slot/SW': 'island/slot/water-SW',
      },
    },
  }];
  return {
    title: 'island-like host (by-name + pathBindings)',
    dimensions: '3d',
    tree,
    physics: PHYSICS,
    showSlotMarkers: false,
  };
}

function manifestRecipeCopy() {
  const recipe = getManjiProgramShelfCard('calm-water')?.manjiProgram?.children?.[0];
  if (!recipe || recipe.kind !== 'wave-field') {
    throw new Error("expected migrated 'calm-water' card to carry a wave-field leaf");
  }
  return {
    title: 'island-like host (recipe-copy)',
    dimensions: '3d',
    tree: islandLikeHost(),
    physics: PHYSICS,
    waveFields: [
      {
        corners: [
          'island/slot/water-NW',
          'island/slot/water-NE',
          'island/slot/water-SE',
          'island/slot/water-SW',
        ],
        waves: recipe.waves,
        samples: recipe.samples,
        style: recipe.style,
      },
    ],
    showSlotMarkers: false,
  };
}

describe('pathBindings — by-name invocation against mismatched host slot names', () => {
  it('produces byte-identical SVG to the recipe-copy form', async () => {
    const byNameRef = 'pbb_by_name';
    const recipeRef = 'pbb_recipe_copy';

    const byNameResult = await createManjiTreeHandler({
      ref: byNameRef,
      ...manifestByNameWithBindings(),
    });
    expect(byNameResult.ok).toBe(true);

    const recipeResult = await createManjiTreeHandler({
      ref: recipeRef,
      ...manifestRecipeCopy(),
    });
    expect(recipeResult.ok).toBe(true);

    const byNameSvg = renderManjiTreeToSvg(SketchRepository.getByRef(byNameRef).manifest);
    const recipeSvg = renderManjiTreeToSvg(SketchRepository.getByRef(recipeRef).manifest);

    const strip = (svg) => svg.replace(
      /<text [^>]*>island-like host[^<]*<\/text>/,
      '<text>TITLE</text>',
    );
    expect(strip(byNameSvg)).toBe(strip(recipeSvg));
  });

  it('mint throws when pathBindings references unresolvable host paths', async () => {
    await expect(createManjiTreeHandler({
      ref: 'pbb_bad_target',
      title: 'broken bindings',
      dimensions: '3d',
      tree: {
        id: 'island',
        spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
        slots: [
          { id: 'water-NW', position: { x: -10, y: -10, z: 0 } },
          { id: 'water-NE', position: { x:  10, y: -10, z: 0 } },
          { id: 'water-SE', position: { x:  10, y:  10, z: 0 } },
          { id: 'water-SW', position: { x: -10, y:  10, z: 0 } },
          { id: 'fill',     position: { x: 0, y: 0, z: 0 } },
        ],
        children: [{
          slot: 'fill',
          node: {
            programRef: 'calm-water',
            pathBindings: {
              'self/slot/NW': 'island/slot/missing-NW',
              'self/slot/NE': 'island/slot/water-NE',
              'self/slot/SE': 'island/slot/water-SE',
              'self/slot/SW': 'island/slot/water-SW',
            },
          },
        }],
      },
      physics: PHYSICS,
    })).rejects.toThrow(/Invalid manji-tree leaf marks.*missing-NW/s);
  });
});
