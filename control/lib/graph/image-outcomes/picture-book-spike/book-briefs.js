/**
 * Book briefs — per-target render instructions for the picture-book spike.
 *
 * Character identity is NOT here: it rides the substrate's character-sheet
 * primitive (`buildCharacterSheetInstructions` + the characters[] section
 * the page briefs get for free from `buildRenderInstructions`). What this
 * module adds is the BOOK layer — scene truths no single manifest carries:
 * setting, palette, and the continuity ladder — rendered verbatim into
 * every brief.
 *
 * Invariant (tested): page CAPTIONS never appear in any brief — captions
 * are book-owned typesetting, the lettering rule transposed to publications.
 */

import { buildRenderInstructions, buildCharacterSheetInstructions } from '../instructions.js';

/** The book bible block — identical at the top of every brief. */
export function buildBookBible(book) {
  const b = book.bible;
  return [
    '## Book Bible (identical for every target in this book)',
    '',
    '### Setting',
    `- ${b.setting}`,
    '',
    '### Palette',
    `- ${b.palette}`,
    '',
    '### Continuity',
    ...b.continuity.map((line) => `- ${line}`),
  ].join('\n');
}

/** Brief for the character-sheet target — the substrate emitter, book-framed. */
export function buildSheetBrief(book) {
  return [
    buildBookBible(book),
    '',
    buildCharacterSheetInstructions(book.characterSheet),
  ].join('\n');
}

/**
 * Brief for the cover target — the pure protected-zone case: the title and
 * imprint are typeset by the book OUTSIDE the raster, so the brief must
 * carry the zone rule in prose (the scaffold draws the zones, but the
 * shipping image-outcome instructions don't yet narrate them — a noted gap
 * for the retro). The title itself never appears here.
 */
export function buildCoverInstructions(book) {
  return [
    buildBookBible(book),
    '',
    '## Cover',
    '- This is the book COVER: one portrait shot that carries the whole story\'s promise.',
    '- Condition on the character sheet (renders/character-sheet.png) plus this cover\'s scaffold.',
    '- Paint the ART LAYER ONLY: no title, no author, no imprint, no readable text — the book typesets all words outside the image.',
    '- The scaffold\'s dashed red boxes are PROTECTED ZONES: paint them (sky, atmosphere), but keep them compositionally QUIET — no focal detail, no busy texture, no high contrast — the title and imprint are typeset over them after generation.',
    '',
    buildRenderInstructions(book.cover),
  ].join('\n');
}

/** Brief for one page target. */
export function buildPageInstructions(book, page) {
  return [
    buildBookBible(book),
    '',
    `## Page ${page.n} of ${book.pages.length}`,
    '- Condition on the character sheet (renders/character-sheet.png once bound) plus this page\'s scaffold.',
    '- Paint the ART LAYER ONLY: no captions, no title, no readable text — the book typesets all words outside the image.',
    '',
    buildRenderInstructions(page.manifest),
  ].join('\n');
}
