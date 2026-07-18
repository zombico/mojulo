/**
 * Page-recipe vocabulary — the panel-blocking paradigms of the deterministic
 * comic pipeline (polygonizer/depiction-layout.js), ported onto the
 * AI-painted sequential-art kind so "make manga" lands on the generative
 * comic tool with the layout brains included.
 *
 * Each entry names a depiction-layout paradigm, carries the eye-line
 * phrasing (rendered into worker instructions — the reading-path direction
 * the paradigm exists to control), and a default reading flow. When a
 * manifest's panels omit `bounds`, the recipe computes them via the SAME
 * `layoutPanelBounds` the vexar pipeline uses — one source of truth for how
 * a paradigm carves a page.
 *
 * `pageRecipe` stays permissive as a label (any string is a fine title for
 * a hand-bounded page); it is only REQUIRED to be one of these entries when
 * auto-layout is asked for (a panel without bounds).
 */

import { layoutPanelBounds } from '../polygonizer/depiction-layout.js';

export const PAGE_RECIPES = {
  'manga-high-eye-control': {
    layout: 'manga-high-eye-control',
    idealPanelCount: 5,
    eyeLine: 'high vertical read with narrow reaction cuts and a large emotional landing panel',
    readingFlow: 'right-to-left, top-to-bottom',
  },
  'sunday-comic': {
    layout: 'sunday-comic',
    idealPanelCount: 6,
    eyeLine: 'large opening beat, three middle beats, wide punchline footer',
    readingFlow: 'left-to-right, top-to-bottom',
  },
  'american-comic-widescreen-panels': {
    layout: 'american-comic-widescreen-panels',
    idealPanelCount: 3,
    eyeLine: 'three cinematic horizontal beats stacked top to bottom',
    readingFlow: 'left-to-right, top-to-bottom',
  },
  monoculous: {
    layout: 'monoculous',
    idealPanelCount: 4,
    eyeLine: 'single dominant panel carrying the page, smaller inset detail panels supporting it',
    readingFlow: 'left-to-right, top-to-bottom',
  },
  'comic-page': {
    layout: 'comic-page',
    idealPanelCount: null,
    eyeLine: 'balanced comic-page grid, read row by row',
    readingFlow: 'left-to-right, top-to-bottom',
  },
};

export const PAGE_RECIPE_IDS = Object.keys(PAGE_RECIPES);

export function isPageRecipe(id) {
  return Object.prototype.hasOwnProperty.call(PAGE_RECIPES, id);
}

export function pageRecipeEntry(id) {
  const entry = PAGE_RECIPES[id];
  return entry ? { id, ...entry } : null;
}

/**
 * Compute the paradigm's panel bounds for a page. Padding and gutter scale
 * with the page so the same recipe reads right at any viewBox. Pure.
 */
export function recipePanelBounds(id, viewBox, panelCount) {
  const entry = PAGE_RECIPES[id];
  if (!entry) throw new Error(`unknown page recipe: ${id} (one of: ${PAGE_RECIPE_IDS.join(', ')})`);
  const short = Math.min(viewBox.width, viewBox.height);
  const pad = Math.round(short * 0.03);
  const gap = Math.round(short * 0.012);
  return layoutPanelBounds({ kind: entry.layout, pad, gap }, viewBox, panelCount);
}
