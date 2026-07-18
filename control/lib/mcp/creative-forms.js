// Single source of truth for the creative-mint FORM enum (Ring 10 re-cut).
//
// The forms `get_creative_toolset` expands, in canonical order. Two surfaces
// depend on this list and must agree: `FORM_TOOLSETS` in tools/context.js
// (keys deep-equal this, asserted in context.test.js) and the routing-card
// loader (each card's `form` frontmatter is validated against it). Extracted
// here so the loader can validate without importing context.js (which would
// pull the whole tool registry into the embeddings reindex path).
//
// See creative-toolsets.plan.md + creative-toolset-retrieval.plan.md.
export const CREATIVE_FORMS = [
  'diagram',
  'illustration',
  'reference',
  'image-render',
  'object',
  'world',
  'view',
  'motion',
  'audio',
  'voice',
  'game',
];
