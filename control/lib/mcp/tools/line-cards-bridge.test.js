/**
 * Line-between card migration bridge test.
 *
 * For each of the 4 new shelf cards (arc-shot, slack-rope, taut-wire,
 * vibrating-string), prove that invoking by name (`programRef: '<card>'`)
 * produces the SAME rendered SVG as the recipe-copy form (an inline
 * connection leaf carrying the same spec). If they match, the cards
 * are ready as callable shelf presets.
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

// Host with `start` and `end` slots matching the cards' contract,
// plus a `fill` slot for binding the programRef invocation.
function hostScene() {
  return {
    id: 'host',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
    anchor: { x: 0, y: -10, z: 0 },
    slots: [
      { id: 'start', position: { x: -8, y: 0, z: 1.5 } },
      { id: 'end',   position: { x:  8, y: 0, z: 3.0 } },
      { id: 'fill',  position: { x: 0, y: 0, z: 0 } },
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
  if (!recipe || recipe.kind !== 'connection') {
    throw new Error(`expected card '${cardId}' to carry a connection leaf at manjiProgram.children[0]`);
  }
  // Lift the recipe verbatim into a top-level connections[] entry with
  // absolute endpoint paths against the host scene.
  return {
    title: `${cardId} (recipe-copy)`,
    dimensions: '3d',
    tree: hostScene(),
    physics: PHYSICS,
    connections: [
      {
        from: 'host/slot/start',
        to:   'host/slot/end',
        ...(recipe.sag !== undefined ? { sag: recipe.sag } : {}),
        ...(recipe.relativeSag !== undefined ? { relativeSag: recipe.relativeSag } : {}),
        ...(recipe.wavelengths !== undefined ? { wavelengths: recipe.wavelengths } : {}),
        ...(recipe.plane !== undefined ? { plane: recipe.plane } : {}),
        ...(recipe.samples !== undefined ? { samples: recipe.samples } : {}),
        ...(recipe.style !== undefined ? { style: recipe.style } : {}),
      },
    ],
    showSlotMarkers: false,
  };
}

const CARDS = ['arc-shot', 'slack-rope', 'taut-wire', 'vibrating-string'];

describe('Line-between shelf cards — by-name vs recipe-copy SVG bridge', () => {
  for (const cardId of CARDS) {
    it(`${cardId}: by-name programRef and recipe-copy connections produce the same SVG`, async () => {
      const byNameRef = `lcb_${cardId.replace(/-/g, '_')}_byname`;
      const recipeRef = `lcb_${cardId.replace(/-/g, '_')}_recipe`;

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
