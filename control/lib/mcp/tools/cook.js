/**
 * MCP Ring 9 — `cook` tool (slice 2 of Gather/Stash/Cook).
 *
 * The multi-input collider on Stashes. Takes ≥2 ingredients (≥1 stash + 1 user
 * query, optional additional stashes + optional MCP `additional_context` the
 * agent looped in) and materializes an Outcome Artifact: a folder on disk with
 * a model-authored report.md, an auto-rendered static index.html, manifest.json,
 * and any visual files (svg/png) the agent provided.
 *
 * Authoring model: the AGENT authors report.md (and provides visuals); cook
 * just materializes the folder. This mirrors the substrate's general posture —
 * mojulo provides the durable filing surface, the agent provides the thinking.
 * No LLM call from server-side; no per-cook compute.
 *
 * Cook does NOT compile, NOT execute, and NOT flip a status flag. It writes
 * a row + a folder, returns the URL, and is done. **Cook stops at cook.** If
 * a cook outcome later reads as tractable work, plan mode itself can be
 * seeded from it via `forge_plan({ source: { kind: 'cook', cook_ref } })` —
 * that's a plan-side decision made later, not a cook outlet. Any other ring
 * that wants to deliberate on a cook output reads it the same way:
 * `get_cook` / `list_cooks` make cook a first-class node, not a fan-out verb.
 *
 * See lite-template/integration/app-system/0531/GATHER_STASH_COOK.md.
 */

import { randomUUID } from 'node:crypto';

import { registerTool } from '@/lib/mcp/server';
import { CookRepository } from '@/lib/db/repositories/cooks';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { outcomeUrlFor } from '@/lib/outcomes/paths';
import { writeOutcome } from '@/lib/outcomes/kinds/essay';
import { writePictureBookOutcome } from '@/lib/outcomes/kinds/picture-book';
import { writeSlideDeckOutcome } from '@/lib/outcomes/kinds/slide-deck';
import { writeFlyerOutcome } from '@/lib/outcomes/kinds/flyer';
import { writeBriefOutcome } from '@/lib/outcomes/kinds/brief';
import { writeResumeOutcome } from '@/lib/outcomes/kinds/resume';
import { writeNewsletterOutcome } from '@/lib/outcomes/kinds/newsletter';
import { writeFieldGuideOutcome } from '@/lib/outcomes/kinds/field-guide';
import { writePamphletOutcome } from '@/lib/outcomes/kinds/pamphlet';
import { writeTextbookOutcome } from '@/lib/outcomes/kinds/textbook';
import { writeNovelOutcome } from '@/lib/outcomes/kinds/novel';
import { writeVisualGuideOutcome } from '@/lib/outcomes/kinds/visual-guide';
import { writeComicOutcome } from '@/lib/outcomes/kinds/comic';
import { writeInstructionManualOutcome } from '@/lib/outcomes/kinds/instruction-manual';
import { writeLessonPlanOutcome } from '@/lib/outcomes/kinds/lesson-plan';
import { writePhotojournalOutcome } from '@/lib/outcomes/kinds/photojournal';
import {
  resolvePresentationTheme,
  presentationDocVars,
  presentationSketchTheme,
  PRESENTATION_THEME_NAMES,
} from '@/lib/visual-language/themes';

const LENSES = new Set(['spike', 'segment_expansion', 'vertical_reinforcement', 'collider']);

// Publication kinds: well-known recipes the agent picks from. Each kind is a
// point in (page_model · geometry · grid · resolver · report_md_slot) space —
// see lib/outcomes/PUBLISHER.plan.md for the design doc.
//
// `essay` and `picture_book` are the today-shipping kinds; `slide_deck` is the
// first proof that the publisher primitive composes. Subsequent kinds
// (newsletter, flyer, pamphlet, field_guide, brief) land one PR each.
const PUBLICATION_KINDS = new Set([
  'essay',
  'picture_book',
  'slide_deck',
  'flyer',
  'brief',
  'resume',
  'newsletter',
  'field_guide',
  'pamphlet',
  'textbook',
  'novel',
  'visual_guide',
  'comic',
  'instruction_manual',
  'lesson_plan',
  'photojournal',
]);

// Kinds that accept the `viewer_aspect` override (paginated/book-viewer kinds).
// textbook and novel are scroll-mode (long-form reading), so excluded.
const PAGINATED_KINDS = new Set(['picture_book', 'slide_deck', 'field_guide', 'pamphlet', 'visual_guide', 'comic', 'instruction_manual']);

// Kinds with whole-stash semantics (no item_ids cleaving — the publication
// IS the stash). picture_book pioneered this; comic and photojournal inherit it.
const WHOLE_STASH_KINDS = new Set(['picture_book', 'comic', 'photojournal']);

// Kinds that accept `visuals[]` (only essay — the rest read items from the stash).
const ACCEPTS_VISUALS = new Set(['essay']);

// Named accent colors for `publication.style.accent`. Operators can also pass
// any 3/6-digit hex. Curated palette keeps things visually coherent without
// shutting the door on custom shades.
const ACCENT_NAMES = {
  red: '#b91c1c',
  orange: '#c2410c',
  amber: '#d97706',
  green: '#166534',
  emerald: '#047857',
  teal: '#0f766e',
  sky: '#0369a1',
  blue: '#1d4ed8',
  indigo: '#4338ca',
  violet: '#7c3aed',
  purple: '#7e22ce',
  pink: '#be185d',
  rose: '#be123c',
  slate: '#475569',
  zinc: '#52525b',
  black: '#171717',
};

// Kinds that accept `publication.style.theme` (a named presentation theme). The
// theme sets the WHOLE page palette + (for slide_deck) the embedded sketch
// surface, so it's only wired where that's coherent: the essay page chrome and
// the slide_deck page + visual band. Other kinds still take `accent`; theme on
// them would chrome the page but leave their embedded visuals un-themed.
const THEMED_KINDS = new Set(['essay', 'slide_deck']);

/** Resolve `publication.style.accent` to a hex value, or throw. */
function resolveAccent(accent) {
  if (typeof accent !== 'string') {
    throw new Error('publication.style.accent must be a string (named color or hex)');
  }
  const lower = accent.toLowerCase().trim();
  if (ACCENT_NAMES[lower]) return ACCENT_NAMES[lower];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(lower)) return lower;
  throw new Error(
    `publication.style.accent '${accent}' is not a known color name or 3/6-digit hex. Named options: ${Object.keys(ACCENT_NAMES).join(', ')}.`,
  );
}

/**
 * Validate publication.style and resolve it to the inline CSS override block
 * plus the embedded-sketch theme inputs.
 *
 * `theme` (a named presentation theme) sets the full page palette so the chrome
 * matches the embedded visuals — no more light-page/dark-visual split. `accent`
 * still works on its own and, when both are given, overrides the theme's accent.
 * Both inject as a body-level CSS-var block placed AFTER each kind's main
 * <style>, so it wins over the template's own `:root` for everything in <body>.
 *
 * @returns {{ styleOverridesHtml: string, sketchTheme: object|null }}
 */
function resolvePublicationStyle(style, publicationKind) {
  if (style === undefined || style === null) return { styleOverridesHtml: '', sketchTheme: null };
  if (typeof style !== 'object' || Array.isArray(style)) {
    throw new Error('publication.style must be an object');
  }
  const { accent, theme } = style;

  let docVars = null;
  let sketchTheme = null;
  if (theme !== undefined && theme !== null) {
    if (typeof theme !== 'string') {
      throw new Error('publication.style.theme must be a string (a named presentation theme)');
    }
    if (!THEMED_KINDS.has(publicationKind)) {
      throw new Error(
        `publication.style.theme is supported for ${[...THEMED_KINDS].join(' and ')} so far; ` +
          `for '${publicationKind}' use publication.style.accent instead.`,
      );
    }
    const resolvedTheme = resolvePresentationTheme(theme); // throws on unknown token
    docVars = presentationDocVars(resolvedTheme, publicationKind);
    sketchTheme = presentationSketchTheme(resolvedTheme);
  }

  const accentHex = accent !== undefined ? resolveAccent(accent) : null;
  if (!docVars && accentHex === null) return { styleOverridesHtml: '', sketchTheme: null };

  const vars = { ...(docVars || {}) };
  if (accentHex !== null) vars['--accent'] = accentHex; // explicit accent overrides the theme's
  const decls = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  return { styleOverridesHtml: `<style>body { ${decls} }</style>`, sketchTheme };
}

// Soft-alias table: maps the pre-publisher `template:` enum onto the new
// `publication.kind` vocabulary. Carried for one release so existing agents
// keep working while they switch over.
const TEMPLATE_ALIASES = {
  standard: 'essay',
  picture_book: 'picture_book',
};

function generateRef() {
  return `cook_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * Resolve the publication kind from either the new `publication: { kind }`
 * arg or the legacy `template:` enum. Returns the canonical kind name.
 * Throws on unknown values, conflicting args, or malformed shapes.
 */
function resolvePublicationKind({ publication, template }) {
  if (publication !== undefined && template !== undefined) {
    throw new Error(
      "cook accepts either `publication: { kind }` (new) or `template:` (legacy alias), not both. Use `publication`.",
    );
  }
  if (publication !== undefined) {
    if (!publication || typeof publication !== 'object') {
      throw new Error('publication must be an object of shape { kind }');
    }
    const { kind } = publication;
    if (typeof kind !== 'string' || !kind) {
      throw new Error('publication.kind is required (a string)');
    }
    if (!PUBLICATION_KINDS.has(kind)) {
      throw new Error(
        `publication.kind '${kind}' is not a known kind. Allowed: ${[...PUBLICATION_KINDS].join(', ')}.`,
      );
    }
    return kind;
  }
  if (template !== undefined) {
    if (typeof template !== 'string' || !TEMPLATE_ALIASES[template]) {
      throw new Error(
        `template '${template}' is not a valid cook template. Allowed: ${Object.keys(TEMPLATE_ALIASES).join(', ')}. (Note: \`template:\` is the legacy arg — prefer \`publication: { kind }\`.)`,
      );
    }
    return TEMPLATE_ALIASES[template];
  }
  return 'essay';
}

export async function cookHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('cook requires an object with slices, aim, and report_md');
  }
  const {
    slices,
    aim,
    report_md,
    additional_context,
    suggested_lens,
    visuals,
    template,
    publication,
  } = input;

  const publicationKind = resolvePublicationKind({ publication, template });

  // Validate the structural requirements. Slice cardinality and report_md
  // requiredness vary by template; everything else is shared.
  if (!Array.isArray(slices) || slices.length === 0) {
    throw new Error(
      'slices is required (a non-empty array of { stash_ref, item_ids? }). Cleave the context first — Cook does not run on whole-substrate inputs.',
    );
  }
  for (const [i, s] of slices.entries()) {
    if (!s || typeof s !== 'object' || typeof s.stash_ref !== 'string' || !s.stash_ref) {
      throw new Error(`slices[${i}] must be an object with a stash_ref string`);
    }
    if (s.item_ids !== undefined) {
      if (!Array.isArray(s.item_ids) || s.item_ids.length === 0 || !s.item_ids.every((n) => Number.isInteger(n))) {
        throw new Error(
          `slices[${i}].item_ids must be a non-empty array of integers when provided (omit it for whole-stash)`,
        );
      }
    }
  }
  if (!aim || typeof aim !== 'string') {
    throw new Error(
      'aim is required (the singular dismantling question Cook nucleates around — ONE target per cook, the binding vow)',
    );
  }

  if (publicationKind === 'essay') {
    // essay is the only kind where report_md IS the content (other kinds
    // get their content from stash items). visuals[] is the essay-only
    // escape hatch for agent-supplied figures.
    if (!report_md || typeof report_md !== 'string') {
      throw new Error(
        'report_md is required (the agent-authored nucleation, markdown). Cook materializes; the agent authors.',
      );
    }
    if (visuals !== undefined && !Array.isArray(visuals)) {
      throw new Error('visuals must be an array when provided');
    }
  } else {
    // All other kinds are single-slice, item-driven publications. Each kind
    // routes items to its own slot shape (cards, slides, pages, panels…)
    // via its writer's resolver dispatch — visuals[] is forbidden because
    // the content lives in the stash, not on the cook arg.
    if (slices.length !== 1) {
      throw new Error(
        `publication.kind '${publicationKind}' takes exactly one slice (a single stash). Cross-stash composition isn't supported in this kind — gather the source items into one stash first.`,
      );
    }
    if (WHOLE_STASH_KINDS.has(publicationKind) && slices[0].item_ids !== undefined) {
      throw new Error(
        `publication.kind '${publicationKind}' takes a whole-stash slice (omit item_ids). The publication IS the stash; subsetting it would skip pages.`,
      );
    }
    if (report_md !== undefined && report_md !== null && typeof report_md !== 'string') {
      throw new Error("report_md must be a string when provided (used as the cover blurb / lede / summary slot for this kind)");
    }
    if (visuals !== undefined && !ACCEPTS_VISUALS.has(publicationKind)) {
      throw new Error(
        `publication.kind '${publicationKind}' does not accept \`visuals\` — its content comes from stash items. (Only 'essay' accepts visuals[].)`,
      );
    }
  }

  if (suggested_lens !== undefined && !LENSES.has(suggested_lens)) {
    throw new Error(`suggested_lens must be one of: ${[...LENSES].join(', ')}`);
  }
  if (additional_context !== undefined && !Array.isArray(additional_context)) {
    throw new Error('additional_context must be an array when provided');
  }

  // Resolve each slice: confirm the stash exists; if item_ids were given,
  // confirm each one belongs to that stash. Surface precise errors so the
  // agent knows exactly which slice to fix.
  const resolvedSlices = [];
  for (const [i, slice] of slices.entries()) {
    const stash = StashRepository.getByRef(slice.stash_ref);
    if (!stash) {
      throw new Error(`slices[${i}].stash_ref '${slice.stash_ref}' not found. Use list_stashes.`);
    }
    if (slice.item_ids === undefined) {
      // Whole-stash slice. Capture the total for the header chip.
      resolvedSlices.push({
        stashRef: stash.stashRef,
        title: stash.title,
        whole: true,
        itemCount: StashRepository.countItems(stash.stashRef),
      });
      continue;
    }
    // Sliced — validate each id belongs to this stash.
    const stashItems = StashRepository.listItems(stash.stashRef);
    const valid = new Set(stashItems.map((it) => it.id));
    for (const id of slice.item_ids) {
      if (!valid.has(id)) {
        throw new Error(
          `slices[${i}].item_ids contains ${id}, which is not an item in stash '${slice.stash_ref}'.`,
        );
      }
    }
    resolvedSlices.push({
      stashRef: stash.stashRef,
      title: stash.title,
      whole: false,
      itemIds: [...slice.item_ids],
      itemCount: slice.item_ids.length,
      total: stashItems.length,
    });
  }

  const cookRef = generateRef();

  // Materialize the folder FIRST — if writing fails we don't want a dangling
  // cook row pointing at nothing.
  let outcomeDir;
  let templateVersion;
  let fileCount;
  let skippedItems = [];
  // Optional viewer-aspect override on publication. Accepted as either
  // `publication.viewer_aspect` (snake_case MCP arg) or `viewerAspect`
  // (passthrough for internal callers). Validated as "<num> / <num>" to
  // keep CSS injection safe; the value is escaped before reaching the
  // template too.
  const viewerAspectRaw = publication && typeof publication === 'object'
    ? (publication.viewer_aspect ?? publication.viewerAspect)
    : undefined;
  let viewerAspect;
  if (viewerAspectRaw !== undefined) {
    if (typeof viewerAspectRaw !== 'string' || !/^\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*$/.test(viewerAspectRaw)) {
      throw new Error(
        "publication.viewer_aspect must be a string like '16 / 9' or '7 / 10' (two positive numbers separated by /).",
      );
    }
    viewerAspect = viewerAspectRaw.trim();
  }

  // Optional style overrides on publication: `accent` (a named color or hex)
  // and/or `theme` (a named presentation theme that sets the whole palette).
  // Rendered to an inline <style> block injected after each kind's main CSS so
  // it wins; `sketchTheme` carries the matching surface for embedded sketches.
  const styleRaw = publication && typeof publication === 'object'
    ? publication.style
    : undefined;
  const { styleOverridesHtml, sketchTheme } = resolvePublicationStyle(styleRaw, publicationKind);

  if (publicationKind === 'essay') {
    const result = await writeOutcome({
      cookRef,
      aim,
      slices: resolvedSlices,
      reportMd: report_md,
      visuals: visuals || [],
      suggestedLens: suggested_lens,
      publicationKind,
      styleOverridesHtml,
    });
    outcomeDir = result.outcomeDir;
    templateVersion = result.templateVersion;
    fileCount = result.fileCount;
  } else {
    // All non-essay kinds are single-slice and item-driven. Shared call
    // shape: { cookRef, aim, stashRef, itemIds?, reportMd, publicationKind,
    // viewerAspect?, styleOverridesHtml }. picture_book is the lone
    // whole-stash kind (item_ids already gated above).
    const slice = resolvedSlices[0];
    const includeAspect = viewerAspect && PAGINATED_KINDS.has(publicationKind);
    const baseArgs = {
      cookRef,
      aim,
      stashRef: slice.stashRef,
      itemIds: slice.whole ? undefined : slice.itemIds,
      reportMd: report_md || '',
      publicationKind,
      styleOverridesHtml,
      // Only slide_deck reads sketchTheme today; harmless for other writers.
      ...(sketchTheme ? { sketchTheme } : {}),
      ...(includeAspect ? { viewerAspect } : {}),
    };
    const writers = {
      picture_book: writePictureBookOutcome,
      slide_deck: writeSlideDeckOutcome,
      flyer: writeFlyerOutcome,
      brief: writeBriefOutcome,
      resume: writeResumeOutcome,
      newsletter: writeNewsletterOutcome,
      field_guide: writeFieldGuideOutcome,
      pamphlet: writePamphletOutcome,
      textbook: writeTextbookOutcome,
      novel: writeNovelOutcome,
      visual_guide: writeVisualGuideOutcome,
      comic: writeComicOutcome,
      instruction_manual: writeInstructionManualOutcome,
      lesson_plan: writeLessonPlanOutcome,
      photojournal: writePhotojournalOutcome,
    };
    const writer = writers[publicationKind];
    if (!writer) {
      throw new Error(`no writer registered for publication.kind '${publicationKind}'`);
    }
    // Whole-stash kinds (picture_book, comic) take stashRef alone (no itemIds).
    // comic also threads through format + fidelity from publication.{format,fidelity}.
    let args;
    if (publicationKind === 'comic') {
      const format = publication && typeof publication === 'object' ? publication.format : undefined;
      const fidelity = publication && typeof publication === 'object' ? publication.fidelity : undefined;
      args = {
        cookRef,
        aim,
        stashRef: slice.stashRef,
        reportMd: report_md || '',
        publicationKind,
        styleOverridesHtml,
        ...(includeAspect ? { viewerAspect } : {}),
        ...(format !== undefined ? { format } : {}),
        ...(fidelity !== undefined ? { fidelity } : {}),
      };
    } else if (WHOLE_STASH_KINDS.has(publicationKind)) {
      args = { cookRef, aim, stashRef: slice.stashRef, reportMd: report_md || '', publicationKind, styleOverridesHtml, ...(includeAspect ? { viewerAspect } : {}) };
    } else if (publicationKind === 'lesson_plan') {
      // lesson_plan threads the learner band from publication.style; the rest
      // is the standard item-driven slice shape.
      const learnerBand = styleRaw && typeof styleRaw === 'object' ? styleRaw.learner_band : undefined;
      args = { ...baseArgs, ...(learnerBand !== undefined ? { learnerBand } : {}) };
    } else {
      args = baseArgs;
    }
    const result = await writer(args);
    outcomeDir = result.outcomeDir;
    templateVersion = result.templateVersion;
    fileCount = result.fileCount;
    skippedItems = result.skippedItems || [];
  }

  // Index it. We persist the SUBMITTED slice manifest verbatim (not the
  // resolved form) so the row carries exactly what the agent declared —
  // re-resolving on read gives current titles.
  CookRepository.insert({
    cookRef,
    slices,
    aim,
    additionalContext: additional_context || [],
    outcomeDir,
    suggestedLens: suggested_lens || null,
    templateVersion,
  });

  // Surface dropped items in the response and the message so the agent
  // doesn't miss silent skips. Group by reason so the warning stays tight
  // even with many items.
  const skippedByReason = new Map();
  for (const s of skippedItems) {
    const key = `${s.type}: ${s.reason}`;
    skippedByReason.set(key, (skippedByReason.get(key) || 0) + 1);
  }
  const skippedSummary = skippedItems.length === 0
    ? ''
    : ` ⚠ ${skippedItems.length} item(s) dropped — ${[...skippedByReason.entries()].map(([k, n]) => `${n}× ${k}`).join('; ')}.`;

  return {
    ok: true,
    cook_ref: cookRef,
    outcome_url: outcomeUrlFor(cookRef),
    outcome_dir: outcomeDir,
    template_version: templateVersion,
    file_count: fileCount,
    skipped_items: skippedItems,
    ...(suggested_lens ? { suggested_lens } : {}),
    message: `Cook nucleated at ${outcomeUrlFor(cookRef)} (${fileCount} files, template v${templateVersion}). Aim: "${aim}".${skippedSummary} Cook stops at cook — if this outcome later reads as tractable work, plan mode pulls it via forge_plan({ source: { kind: 'cook', cook_ref: '${cookRef}' } }).`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// recommend_kind — rules-based scan of a stash → ranked kind suggestions.
//
// No LLM call. Each kind's score function gets the scan summary and returns
// { score, rationale, fit_notes }. Top-N returned by score.
// ─────────────────────────────────────────────────────────────────────────────

function scanStashForRecommendation(stashRef, itemIds, aim) {
  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);
  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  const typeCounts = { text: 0, markdown: 0, image: 0, svg: 0, script: 0, pointer: 0, link: 0, sketch: 0 };
  let sketchesWithBodyMd = 0;
  let sketchesWithComicMeta = 0;
  for (const it of items) {
    if (typeCounts[it.type] !== undefined) typeCounts[it.type] += 1;
    if (it.type === 'sketch' && it.bodyMd && it.bodyMd.trim().length > 0) sketchesWithBodyMd += 1;
    if (it.type === 'sketch' && it.metadata && it.metadata.comic && typeof it.metadata.comic === 'object') {
      sketchesWithComicMeta += 1;
    }
  }
  const drawerNames = full.drawers.map((d) => d.name.toLowerCase());
  return {
    item_count: items.length,
    type_counts: typeCounts,
    drawer_count: full.drawers.length,
    drawer_names: drawerNames,
    sketches_with_bodymd: sketchesWithBodyMd,
    sketches_with_comic_meta: sketchesWithComicMeta,
    has_aim: !!(aim && aim.trim()),
    stash_title: full.stash.title,
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// One scoring function per kind. Returns { score, rationale, fit_notes }.
// rationale: one-liner the operator reads directly.
// fit_notes: bullet observations (also useful for "why not this kind").
const KIND_SCORERS = {
  essay(scan) {
    let score = 30;
    const notes = ['essay is always a valid fallback (uses report_md)'];
    if (scan.item_count < 3) { score += 20; notes.push(`only ${scan.item_count} item(s) — essay reads well as long-form prose`); }
    if (scan.has_aim) { score += 15; notes.push('aim is set — drives the doc title and frame'); }
    if (scan.type_counts.markdown >= 2 && scan.type_counts.sketch === 0) {
      score += 10;
      notes.push('text-heavy, no sketches → essay shape fits');
    }
    return { score, rationale: 'long-form scroll, agent authors the body', fit_notes: notes };
  },

  picture_book(scan) {
    const sketches = scan.type_counts.sketch;
    if (sketches === 0) return { score: 0, rationale: 'needs ≥1 sketch item — book pages come from sketches', fit_notes: [] };
    let score = 40 + Math.min(sketches * 5, 40);
    const notes = [`${sketches} sketch item(s) → ${sketches} page(s)`];
    if (scan.drawer_count >= 2) { score += 15; notes.push(`${scan.drawer_count} drawer(s) → chapter dividers`); }
    if (scan.sketches_with_bodymd === sketches && sketches >= 1) {
      score += 10;
      notes.push('every sketch has a body_md caption — book reads cleanly');
    }
    const nonSketch = scan.item_count - sketches;
    if (nonSketch > sketches) { score -= 10; notes.push(`⚠ ${nonSketch} non-sketch item(s) will be skipped`); }
    return { score: clamp(score, 0, 100), rationale: 'paginated illustrated book, sketches → pages', fit_notes: notes };
  },

  slide_deck(scan) {
    const visuals = scan.type_counts.sketch + scan.type_counts.svg;
    const content = scan.type_counts.markdown + scan.type_counts.text;
    if (visuals + content === 0) return { score: 0, rationale: 'needs sketch/svg/markdown/text items', fit_notes: [] };
    let score = 30 + Math.min((visuals + content) * 4, 40);
    const notes = [`${visuals} visual + ${content} content slide(s)`];
    if (scan.drawer_count >= 2) { score += 15; notes.push(`${scan.drawer_count} drawer(s) → section dividers`); }
    if (visuals > 0 && content > 0) { score += 10; notes.push('mixed visual + content — deck-shaped'); }
    const ideal = scan.item_count >= 5 && scan.item_count <= 15;
    if (ideal) { score += 10; notes.push('item count in ideal deck range (5–15)'); }
    if (scan.item_count > 20) { score -= 10; notes.push('⚠ >20 items will make a very long deck'); }
    return { score: clamp(score, 0, 100), rationale: '16:9 deck for presenting', fit_notes: notes };
  },

  flyer(scan) {
    const t = scan.type_counts;
    if (t.markdown === 0 && !scan.has_aim) return { score: 0, rationale: 'needs ≥1 markdown headline (or an aim)', fit_notes: [] };
    let score = 30;
    const notes = [];
    if (t.sketch >= 1 && t.markdown >= 1) { score += 20; notes.push('1 sketch (hero) + 1 markdown (headline) — flyer-shaped'); }
    if (t.link > 0) { score += Math.min(t.link * 10, 30); notes.push(`${t.link} link(s) → CTA buttons`); }
    if (scan.item_count > 5) { score -= 15; notes.push('⚠ flyer reads best with ≤5 items'); }
    if (t.sketch > 1) notes.push(`only the first of ${t.sketch} sketches becomes the hero`);
    return { score: clamp(score, 0, 100), rationale: 'single-page poster, hero + headline + CTAs', fit_notes: notes };
  },

  brief(scan) {
    if (scan.type_counts.markdown === 0) return { score: 0, rationale: 'needs ≥1 markdown item for the points column', fit_notes: [] };
    const md = scan.type_counts.markdown;
    let score = 30 + Math.min(md * 8, 35);
    const notes = [`${md} markdown point(s)`];
    if (scan.has_aim) { score += 10; notes.push('aim drives the page title'); }
    if (scan.type_counts.sketch <= 2 && scan.type_counts.sketch >= 1) { score += 10; notes.push(`${scan.type_counts.sketch} sidebar figure(s)`); }
    if (md >= 2 && md <= 5) { score += 10; notes.push('markdown count in ideal range (2–5)'); }
    if (md > 8) { score -= 10; notes.push('⚠ brief reads best with ≤5 points'); }
    return { score: clamp(score, 0, 100), rationale: 'executive-summary brief, 2-col with sidebar figures', fit_notes: notes };
  },

  resume(scan) {
    if (scan.type_counts.markdown === 0) return { score: 0, rationale: 'needs markdown items for sections', fit_notes: [] };
    let score = 25 + Math.min(scan.type_counts.markdown * 5, 30);
    const notes = [`${scan.type_counts.markdown} markdown section(s)`];
    const hasIdentity = scan.drawer_names.includes('identity') || scan.drawer_names.includes('header');
    if (hasIdentity) { score += 25; notes.push('identity drawer present → drives the header'); }
    const sidebarish = scan.drawer_names.some((n) => ['skills', 'education', 'contact', 'sidebar'].includes(n) || n.startsWith('sb-'));
    if (sidebarish) { score += 15; notes.push('drawers route to the sidebar column'); }
    const nonText = scan.item_count - scan.type_counts.markdown - scan.type_counts.text;
    if (nonText > 0) { score -= nonText * 5; notes.push(`⚠ ${nonText} non-text item(s) will be skipped`); }
    return { score: clamp(score, 0, 100), rationale: 'opinionated 1-page CV with sidebar routing by drawer', fit_notes: notes };
  },

  newsletter(scan) {
    const t = scan.type_counts;
    if (t.markdown === 0) return { score: 0, rationale: 'needs ≥1 markdown article', fit_notes: [] };
    let score = 25 + Math.min(t.markdown * 12, 40);
    const notes = [`${t.markdown} article card(s)`];
    if (t.link > 0) { score += Math.min(t.link * 8, 25); notes.push(`${t.link} link(s) → "in case you missed it"`); }
    if (t.sketch >= 1) { score += 10; notes.push('first sketch → hero figure'); }
    if (t.text >= 1) { score += 5; notes.push(`${t.text} text item(s) → pull quote(s)`); }
    return { score: clamp(score, 0, 100), rationale: 'periodical-shaped, mixed media in a hero+grid layout', fit_notes: notes };
  },

  field_guide(scan) {
    const sketches = scan.type_counts.sketch;
    if (sketches === 0 && scan.type_counts.markdown === 0) {
      return { score: 0, rationale: 'needs sketch+caption pairs or markdown items', fit_notes: [] };
    }
    let score = 25 + Math.min(scan.sketches_with_bodymd * 8, 50);
    const notes = [];
    if (scan.sketches_with_bodymd > 0) notes.push(`${scan.sketches_with_bodymd} sketch+caption pair(s)`);
    if (scan.drawer_count >= 2) { score += 15; notes.push(`${scan.drawer_count} section(s) from drawers`); }
    if (sketches > scan.sketches_with_bodymd) notes.push(`${sketches - scan.sketches_with_bodymd} sketch(es) without body_md will render without descriptions`);
    return { score: clamp(score, 0, 100), rationale: 'paginated specimen entries with illustrations + descriptions', fit_notes: notes };
  },

  pamphlet(scan) {
    if (scan.type_counts.markdown === 0) return { score: 0, rationale: 'needs markdown items for panel sections', fit_notes: [] };
    const md = scan.type_counts.markdown;
    let score = 30 + Math.min(md * 6, 30);
    const notes = [`${md} markdown item(s) → ${md} content panel(s)`];
    if (md === 4) { score += 25; notes.push('4 panels exactly — fits the tri-fold layout perfectly'); }
    else if (md >= 3 && md <= 5) { score += 10; notes.push('close to tri-fold ideal (4)'); }
    if (md > 8) { score -= 10; notes.push('⚠ pamphlet stops being a true tri-fold beyond ~6 content panels'); }
    if (scan.type_counts.sketch > 0) { score += 8; notes.push(`${scan.type_counts.sketch} sketch(es) pair with panels`); }
    return { score: clamp(score, 0, 100), rationale: 'print-oriented tri-fold (front + content panels + back)', fit_notes: notes };
  },

  textbook(scan) {
    const md = scan.type_counts.markdown;
    if (md === 0) return { score: 0, rationale: 'needs ≥1 markdown item for sections', fit_notes: [] };
    let score = 25 + Math.min(md * 6, 35);
    const notes = [`${md} markdown section(s)`];
    if (scan.drawer_count >= 2) { score += 20; notes.push(`${scan.drawer_count} drawer(s) → numbered chapters`); }
    if (scan.type_counts.sketch >= 1) { score += 10; notes.push(`${scan.type_counts.sketch} sketch(es) → numbered figures`); }
    if (scan.type_counts.text >= 1) { score += 5; notes.push(`${scan.type_counts.text} text item(s) → callouts / key terms`); }
    if (md >= 4 && md <= 20) { score += 10; notes.push('section count in textbook range (4–20)'); }
    if (md > 30) { score -= 10; notes.push('⚠ very long — consider splitting into multiple textbooks'); }
    return { score: clamp(score, 0, 100), rationale: 'scroll-mode long-form book with numbered chapters, sections, figures', fit_notes: notes };
  },

  novel(scan) {
    const md = scan.type_counts.markdown;
    if (md === 0) return { score: 0, rationale: 'needs ≥1 markdown item for prose scenes', fit_notes: [] };
    let score = 20 + Math.min(md * 5, 30);
    const notes = [`${md} prose scene(s)`];
    if (scan.drawer_count >= 3) { score += 20; notes.push(`${scan.drawer_count} drawer(s) → chapters`); }
    else if (scan.drawer_count >= 1) { score += 10; notes.push(`${scan.drawer_count} chapter(s)`); }
    if (scan.type_counts.text >= 1) { score += 5; notes.push(`${scan.type_counts.text} text item(s) → epigraph(s) / pull quote(s)`); }
    if (scan.type_counts.sketch >= 1) { score += 3; notes.push('first sketch → chapter frontispiece (sparing)'); }
    const nonProse = scan.item_count - md - scan.type_counts.text - scan.type_counts.sketch;
    if (nonProse > 0) { score -= nonProse * 4; notes.push(`⚠ ${nonProse} non-prose item(s) will be skipped`); }
    if (md >= 8) { score += 10; notes.push('novella-length prose volume'); }
    return { score: clamp(score, 0, 100), rationale: 'scroll-mode fiction prose (short story → novella → novel), scenes → chapters, light TOC', fit_notes: notes };
  },

  visual_guide(scan) {
    const sketches = scan.type_counts.sketch;
    if (sketches === 0) {
      return { score: 0, rationale: 'needs ≥1 sketch — visual_guide is illustration-anchored', fit_notes: [] };
    }
    let score = 30 + Math.min(sketches * 5, 35);
    const notes = [`${sketches} sketch item(s) → illustrated plates`];
    if (scan.drawer_count >= 2) { score += 20; notes.push(`${scan.drawer_count} drawer(s) → numbered chapters with intros`); }
    if (scan.type_counts.markdown >= 1) { score += 12; notes.push(`${scan.type_counts.markdown} markdown item(s) → chapter intros + interstitial pages`); }
    if (scan.sketches_with_bodymd === sketches && sketches >= 2) {
      score += 8;
      notes.push('every plate has a body_md caption');
    }
    if (scan.type_counts.text >= 1) { score += 4; notes.push(`${scan.type_counts.text} text item(s) → quote spread(s)`); }
    if (sketches >= 4 && scan.drawer_count >= 2 && scan.type_counts.markdown >= 1) {
      score += 8;
      notes.push('shape fits a fan-guide / curated reference book');
    }
    return { score: clamp(score, 0, 100), rationale: 'paginated illustrated guide with chapters, intros, and plates', fit_notes: notes };
  },

  comic(scan) {
    const sketches = scan.type_counts.sketch;
    if (sketches === 0) {
      return { score: 0, rationale: 'needs sketches (one per page) — comic pages are sketch-authored', fit_notes: [] };
    }
    let score = 35 + Math.min(sketches * 5, 35);
    const notes = [`${sketches} sketch item(s) → ${sketches} page(s)`];
    if (scan.sketches_with_comic_meta > 0) {
      score += 20;
      notes.push(`${scan.sketches_with_comic_meta} sketch(es) carry comic metadata (panel recipe, spread, role) — operator already opted in`);
    }
    if (scan.drawer_count >= 2) {
      score += 15;
      notes.push(`${scan.drawer_count} drawer(s) → chapter dividers`);
    }
    if (scan.sketches_with_bodymd === sketches && sketches >= 1) {
      score += 10;
      notes.push('every sketch has a body_md editor-note caption');
    }
    if (sketches < 3) {
      score -= 10;
      notes.push('⚠ <3 pages reads more like a flyer or strip than a book');
    }
    const nonSketch = scan.item_count - sketches;
    if (nonSketch > 0) {
      score -= Math.min(nonSketch * 3, 15);
      notes.push(`⚠ ${nonSketch} non-sketch item(s) will be skipped`);
    }
    return {
      score: clamp(score, 0, 100),
      rationale: 'paginated comic with fidelity dial (nemu → breakdown → pencils → inks)',
      fit_notes: notes,
    };
  },

  instruction_manual(scan) {
    const md = scan.type_counts.markdown;
    const sketches = scan.type_counts.sketch;
    if (md === 0 && sketches === 0) {
      return { score: 0, rationale: 'needs markdown steps and/or sketch diagrams', fit_notes: [] };
    }
    let score = 25 + Math.min(md * 8, 40);
    const notes = [`${md} markdown step(s)`];
    if (sketches > 0) {
      score += Math.min(sketches * 6, 24);
      notes.push(`${sketches} sketch diagram(s) → exploded assembly views`);
    }
    if (md >= 1 && sketches >= 1) {
      score += 10;
      notes.push('step + diagram pairs — manual-shaped');
    }
    if (scan.drawer_count >= 2) {
      score += 12;
      notes.push(`${scan.drawer_count} drawer(s) → numbered Parts`);
    }
    if (md >= 4 && md <= 16) {
      score += 8;
      notes.push('step count in ideal range (4–16)');
    }
    if (md > 24) {
      score -= 10;
      notes.push('⚠ very long — consider splitting into multiple manuals');
    }
    return {
      score: clamp(score, 0, 100),
      rationale: 'paginated step-by-step assembly booklet — exploded diagrams, numbered multi-column steps, fine print',
      fit_notes: notes,
    };
  },

  lesson_plan(scan) {
    const md = scan.type_counts.markdown;
    if (md === 0 && !scan.has_aim) {
      return { score: 0, rationale: 'needs ≥1 markdown activity (or an aim)', fit_notes: [] };
    }
    let score = 30;
    const notes = [];
    const anatomy = ['objectives', 'activities', 'assessment'];
    const present = anatomy.filter((n) => scan.drawer_names.includes(n));
    if (present.length > 0) {
      score += 20;
      notes.push(`lesson anatomy present (${present.join(', ')}) → pedagogical sections`);
    }
    if (scan.type_counts.link >= 1) {
      score += 15;
      notes.push(`${scan.type_counts.link} link(s) → references drawer`);
    }
    if (scan.type_counts.sketch >= 1 || scan.type_counts.image >= 1) {
      score += 10;
      notes.push('has a figure (sketch/image) for the lesson');
    }
    if (scan.drawer_count >= 3) {
      score += 10;
      notes.push(`${scan.drawer_count} drawer(s) → structured into sections`);
    }
    if (scan.item_count < 3) {
      score -= 10;
      notes.push('⚠ thin — an essay may read better than a lesson');
    }
    return {
      score: clamp(score, 0, 100),
      rationale: 'teacher tool — one stash, two faces (teacher plan + printable learner handout, band-tuned)',
      fit_notes: notes,
    };
  },

  photojournal(scan) {
    const images = scan.type_counts.image;
    if (images === 0) {
      return { score: 0, rationale: 'needs ≥1 image item — photojournal is photograph-anchored', fit_notes: [] };
    }
    let score = 40 + Math.min(images * 6, 40);
    const notes = [`${images} photo(s) → cover + scroll`];
    if (scan.drawer_count >= 2) { score += 15; notes.push(`${scan.drawer_count} drawer(s) → section breaks`); }
    if (scan.type_counts.markdown >= 1) { score += 8; notes.push(`${scan.type_counts.markdown} markdown item(s) → prose interludes`); }
    const otherVisual = scan.type_counts.sketch + scan.type_counts.svg;
    if (otherVisual > 0) notes.push(`⚠ ${otherVisual} sketch/svg item(s) will be skipped — photojournal renders photos + prose only`);
    return { score: clamp(score, 0, 100), rationale: 'scroll-mode photo journal with a cover photo + caption — prints "direct" (one photo per sheet)', fit_notes: notes };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// forge_publications — cook the same stash into 2–4 candidate kinds in one
// MCP call. Convenience verb for the multi-kind preview pattern: the operator
// browses N candidates side-by-side and picks the winner; the rest sit in the
// outputs inbox until archived. Each forged cook is a REAL cook (DB row +
// folder) — there's no "preview" namespace. `forge_id` groups them for later
// cleanup.
// ─────────────────────────────────────────────────────────────────────────────

export async function forgePublicationsHandler(input, ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('forge_publications requires an object with slices, aim, and kinds');
  }
  const { slices, aim, report_md, kinds, viewer_aspect, suggested_lens, additional_context } = input;
  if (!Array.isArray(kinds) || kinds.length < 2 || kinds.length > 4) {
    throw new Error('kinds must be an array of 2–4 publication kinds');
  }
  const uniqueKinds = [...new Set(kinds)];
  if (uniqueKinds.length !== kinds.length) {
    throw new Error('kinds must be distinct');
  }
  for (const k of uniqueKinds) {
    if (!PUBLICATION_KINDS.has(k)) {
      throw new Error(`kinds contains '${k}' which is not a known publication kind. Allowed: ${[...PUBLICATION_KINDS].join(', ')}.`);
    }
  }

  const forgeId = `forge_${randomUUID().replace(/-/g, '').slice(0, 10)}`;

  // Cook each kind sequentially. Sequential (not parallel) for two reasons:
  // (a) cookHandler writes a DB row; better-sqlite3 + WAL handles concurrent
  // writes but serialization keeps the cook_ref insertion order intuitive,
  // and (b) failures surface earlier — if kind 1 fails we don't waste work
  // on kinds 2–4.
  const cooks = [];
  const errors = [];
  for (const kind of uniqueKinds) {
    try {
      const result = await cookHandler({
        slices,
        aim,
        report_md,
        additional_context,
        suggested_lens,
        publication: { kind, ...(viewer_aspect ? { viewer_aspect } : {}) },
      }, ctx);
      cooks.push({
        kind,
        cook_ref: result.cook_ref,
        outcome_url: result.outcome_url,
        skipped_items: result.skipped_items || [],
        template_version: result.template_version,
        message: result.message,
      });
    } catch (err) {
      errors.push({ kind, error: err.message || String(err) });
    }
  }

  if (cooks.length === 0) {
    throw new Error(`forge_publications produced 0 successful cooks. Errors: ${errors.map((e) => `${e.kind}: ${e.error}`).join('; ')}`);
  }

  return {
    ok: true,
    forge_id: forgeId,
    cooks,
    ...(errors.length > 0 ? { errors } : {}),
    message: `Forged ${cooks.length} publication(s) of ${uniqueKinds.length} requested: ${cooks.map((c) => `${c.kind} (${c.outcome_url})`).join(' · ')}.${errors.length > 0 ? ` ⚠ ${errors.length} kind(s) failed.` : ''}`,
  };
}

export async function recommendKindHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('recommend_kind requires an object with stash_ref');
  }
  const { stash_ref, item_ids, aim, limit } = input;
  if (!stash_ref || typeof stash_ref !== 'string') {
    throw new Error('stash_ref is required (string)');
  }
  if (item_ids !== undefined) {
    if (!Array.isArray(item_ids) || !item_ids.every((n) => Number.isInteger(n))) {
      throw new Error('item_ids must be an array of integers when provided');
    }
  }
  if (aim !== undefined && typeof aim !== 'string') {
    throw new Error('aim must be a string when provided');
  }
  const n = Number.isInteger(limit) && limit > 0 ? limit : 3;

  const scan = scanStashForRecommendation(stash_ref, item_ids, aim);

  const scored = [];
  for (const kind of PUBLICATION_KINDS) {
    const result = KIND_SCORERS[kind](scan);
    scored.push({ kind, ...result });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, n);

  return {
    stash_ref,
    stash_title: scan.stash_title,
    scan: {
      item_count: scan.item_count,
      type_counts: scan.type_counts,
      drawer_count: scan.drawer_count,
      sketches_with_bodymd: scan.sketches_with_bodymd,
      sketches_with_comic_meta: scan.sketches_with_comic_meta,
      has_aim: scan.has_aim,
    },
    recommendations: top.map((r) => ({
      kind: r.kind,
      score: r.score,
      rationale: r.rationale,
      fit_notes: r.fit_notes,
    })),
  };
}

export async function getCookHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_cook requires an object with cook_ref');
  }
  const { cook_ref } = input;
  if (!cook_ref || typeof cook_ref !== 'string') {
    throw new Error('cook_ref is required');
  }
  const cook = CookRepository.getByRef(cook_ref);
  if (!cook) throw new Error(`Cook '${cook_ref}' not found.`);
  return {
    cook_ref: cook.cookRef,
    aim: cook.aim,
    slices: cook.slices,
    stash_refs: cook.stashRefs,
    additional_context: cook.additionalContext,
    suggested_lens: cook.suggestedLens,
    outcome_dir: cook.outcomeDir,
    outcome_url: outcomeUrlFor(cook.cookRef),
    template_version: cook.templateVersion,
    created_at: cook.createdAt,
  };
}

export async function listCooksHandler(input, _ctx) {
  const { limit, status } = input || {};
  const filter = {};
  if (limit !== undefined) filter.limit = limit;
  if (status !== undefined) {
    if (!['open', 'archived', 'all'].includes(status)) {
      throw new Error("status must be one of: 'open', 'archived', 'all'");
    }
    filter.status = status;
  }
  const cooks = CookRepository.list(filter);
  return {
    total: cooks.length,
    cooks: cooks.map((c) => ({
      cook_ref: c.cookRef,
      aim: c.aim,
      stash_refs: c.stashRefs,
      slice_count: c.slices.length,
      suggested_lens: c.suggestedLens,
      outcome_url: outcomeUrlFor(c.cookRef),
      template_version: c.templateVersion,
      created_at: c.createdAt,
      archived_at: c.archivedAt,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// sketch_stash — vibe-to-items scaffold. Given an intent + optional target
// kind, returns a PROPOSED stash structure (drawers + item slots) plus a
// step-by-step script the agent can execute (or amend) with operator
// approval. No DB writes, no LLM call. Encodes the same "ideal content
// shape" rules `recommend_kind` uses, but inverted: from kind → structure
// rather than from items → kind.
// ─────────────────────────────────────────────────────────────────────────────

const STASH_RECIPES = {
  essay: {
    drawers: [],
    items: [],
    notes: [
      "Essay barely needs a stash — gather the intent directly into the cook call as `report_md`. Use a stash here only if you want to keep source thoughts as items for later re-cooks (a different kind from the same material).",
    ],
  },
  picture_book: {
    drawers: [
      { name: 'ch-1-opening', role: 'chapter', hint: 'Opening beat — set the scene.' },
      { name: 'ch-2-development', role: 'chapter', hint: 'Middle beats — develop the idea or story.' },
      { name: 'ch-3-closing', role: 'chapter', hint: 'Closing beat — land the resolution.' },
    ],
    items: [
      { type: 'sketch', role: 'page', drawer: 'ch-1-opening', repeat: '1–3', hint: 'Each sketch becomes a page. Use create_sketch first, then gather with metadata.sketch_ref + body_md (the page caption). Distribute across chapter drawers.' },
    ],
    notes: [
      'Drawers become chapter dividers in the book viewer.',
      'Each sketch item must have body_md (the caption that appears below the illustration).',
      "Use viewer_aspect: '7 / 10' for a portrait book; the default '10 / 7' is landscape.",
    ],
  },
  slide_deck: {
    drawers: [
      { name: 'act-1', role: 'section', hint: 'Section 1 — opening framing slides.' },
      { name: 'act-2', role: 'section', hint: 'Section 2 — supporting material.' },
      { name: 'act-3', role: 'section', hint: 'Section 3 — close + ask.' },
    ],
    items: [
      { type: 'sketch', role: 'visual_slide', drawer: 'act-1', repeat: '1–2 per section', hint: 'Each sketch becomes a full-bleed visual slide.' },
      { type: 'markdown', role: 'content_slide', drawer: 'act-1', repeat: '1–3 per section', hint: 'h1 = slide title; body = bullets.' },
      { type: 'text', role: 'simple_slide', repeat: '0–2 total', hint: 'A short standalone thought — renders as a centered text slide.' },
    ],
    notes: [
      'Drawers become section-divider slides between content beats.',
      'Mixed visual + content slides reads better than all-of-one-type.',
      'Ideal total: 5–15 slides.',
    ],
  },
  flyer: {
    drawers: [],
    items: [
      { type: 'sketch', role: 'hero', repeat: '1', hint: 'Single hero visual — fills the top of the flyer. Use create_sketch first.' },
      { type: 'markdown', role: 'headline_body', repeat: '1', hint: 'h1 = headline; rest = pitch. The agent owns the body copy.' },
      { type: 'link', role: 'cta', repeat: '1–3', hint: 'Each link becomes a CTA button at the bottom.' },
    ],
    notes: [
      'Flyer is print-oriented (US letter); use Cmd-P to save as PDF.',
      'Keep total item count ≤5 — flyer reads worse with more.',
    ],
  },
  brief: {
    drawers: [],
    items: [
      { type: 'markdown', role: 'point', repeat: '2–5', hint: 'Each markdown item becomes a "point card" in the left column. h1 = point title; body = supporting prose.' },
      { type: 'sketch', role: 'sidebar_figure', repeat: '0–2', hint: 'Each sketch becomes a sidebar figure on the right.' },
      { type: 'text', role: 'callout', repeat: '0–2', hint: 'Each text item becomes a callout box in the sidebar.' },
    ],
    notes: [
      'report_md (passed to cook) becomes the executive summary at the top.',
      'Ideal: 3 points + 1 sketch + 1 text callout — clean, focused, briefable.',
    ],
  },
  resume: {
    drawers: [
      { name: 'identity', role: 'header', hint: 'Drives the resume header. Put exactly 1 markdown item here.' },
      { name: 'skills', role: 'sidebar', hint: 'Left-column section. 1 markdown item with bullet list.' },
      { name: 'education', role: 'sidebar', hint: 'Left-column section. 1 markdown item.' },
    ],
    items: [
      { type: 'markdown', role: 'identity_card', drawer: 'identity', repeat: '1', hint: 'h1 = your name; next line = tagline; rest = short summary.' },
      { type: 'markdown', role: 'skills_list', drawer: 'skills', repeat: '1', hint: 'h1 = "Skills"; body = bullet list.' },
      { type: 'markdown', role: 'education_list', drawer: 'education', repeat: '1', hint: 'h1 = "Education"; body = degrees + institutions.' },
      { type: 'markdown', role: 'main_section', repeat: '2–4 at root', hint: 'Each becomes a right-column section. Common: Experience, Projects, Publications, Talks. h1 = section name; use h2/h3 for entries.' },
    ],
    notes: [
      'Drawer names are load-bearing: "identity" drives the header; "skills"/"education"/"sb-*" route to the sidebar; everything else goes in the main column.',
      'Aim for 1 page printable — keep main sections to 2–4.',
    ],
  },
  newsletter: {
    drawers: [],
    items: [
      { type: 'sketch', role: 'hero', repeat: '0–1', hint: 'Optional hero figure at the top of the issue.' },
      { type: 'markdown', role: 'article', repeat: '2–4', hint: 'Each becomes an article card in the 2-column grid. h1 = headline; body = the piece.' },
      { type: 'text', role: 'pull_quote', repeat: '0–2', hint: 'Each becomes a styled pull-quote card.' },
      { type: 'link', role: 'recommendation', repeat: '2–5', hint: 'Each becomes an entry in the "In case you missed it" footer.' },
    ],
    notes: [
      'report_md (passed to cook) becomes the masthead lede right under the issue title.',
      'Mixed media reads better than all-articles — a hero + pull quote + links makes it feel like a real periodical.',
    ],
  },
  field_guide: {
    drawers: [
      { name: 'category-a', role: 'section', hint: 'Group specimens by category (genus, region, function, …). Each drawer becomes a section.' },
      { name: 'category-b', role: 'section', hint: 'Second category drawer.' },
    ],
    items: [
      { type: 'sketch', role: 'specimen', drawer: 'category-a', repeat: '3–12 total across all drawers', hint: 'Each sketch becomes a specimen entry. body_md → h1 = specimen name (label); next italicized line = scientific name (optional); rest = description.' },
    ],
    notes: [
      'Pair every sketch with body_md — sketches without captions render without descriptions.',
      'report_md (passed to cook) becomes the foreword on the cover page.',
      'Drawer names show up as section dividers; pick categorical names.',
    ],
  },
  pamphlet: {
    drawers: [],
    items: [
      { type: 'markdown', role: 'panel', repeat: 'exactly 4', hint: 'Each markdown item becomes one content panel. h1 = panel title; body = panel content. Item order = panel order.' },
      { type: 'sketch', role: 'panel_illustration', repeat: '0–4', hint: 'Optional sketches; each pairs with the immediately-preceding markdown panel (use gather order).' },
    ],
    notes: [
      'A real tri-fold needs exactly 4 content panels (+ front + back). 3–6 still works.',
      'report_md (passed to cook) becomes the front-cover blurb.',
      'Print on US letter, fold along two vertical creases — the @media print rules already set this up.',
    ],
  },
  textbook: {
    drawers: [
      { name: 'ch-1-foundations', role: 'chapter', hint: 'Chapter 1 — establish the base concepts.' },
      { name: 'ch-2-mechanisms', role: 'chapter', hint: 'Chapter 2 — develop the mechanisms / methods.' },
      { name: 'ch-3-applications', role: 'chapter', hint: 'Chapter 3 — apply the ideas; worked examples.' },
    ],
    items: [
      { type: 'markdown', role: 'section', drawer: 'ch-1-foundations', repeat: '2–6 per chapter', hint: 'h1 = section title; body = section prose. The FIRST markdown item in a chapter (with no h1) becomes the chapter intro lead.' },
      { type: 'sketch', role: 'figure', drawer: 'ch-1-foundations', repeat: '0–4 per chapter', hint: 'Each sketch becomes a numbered figure (Fig. N.M). body_md → figure caption; metadata.label → figure label.' },
      { type: 'text', role: 'key_term', drawer: 'ch-1-foundations', repeat: '0–2 per chapter', hint: 'Each text item becomes a key-term / callout box at the top of the chapter. title → callout title; body → callout body.' },
    ],
    notes: [
      'Drawers become numbered chapters (Chapter 1, 2, 3 …).',
      'Auto-generated TOC at the front lists each chapter with section / figure / key-term counts.',
      'report_md becomes the preface on the cover.',
      'Scroll-mode (no book-viewer) — textbooks read top-to-bottom.',
      'Ideal: 3–6 chapters, 2–6 sections each, 1–4 figures per chapter.',
    ],
  },
  novel: {
    drawers: [
      { name: 'i-departure', role: 'chapter', hint: 'Chapter I — opening, status quo, inciting event.' },
      { name: 'ii-crossing', role: 'chapter', hint: 'Chapter II — middle, complication, rising stakes.' },
      { name: 'iii-return', role: 'chapter', hint: 'Chapter III — close, resolution, transformed status quo.' },
    ],
    items: [
      { type: 'markdown', role: 'scene', drawer: 'i-departure', repeat: '1–4 per chapter', hint: 'Each markdown item is a scene. Multiple scenes in one chapter are separated by a centered ✦ ✦ ✦ break.' },
      { type: 'text', role: 'epigraph_or_quote', drawer: 'i-departure', repeat: '0–2 per chapter', hint: 'If first in the chapter → epigraph above the prose; if later → italic pull-quote between scenes.' },
      { type: 'sketch', role: 'frontispiece', drawer: 'i-departure', repeat: '0–1 per chapter', hint: 'Optional, used sparingly. Only the first sketch in a chapter renders; later ones are ignored.' },
    ],
    notes: [
      'Drawers become Roman-numeral chapters (I, II, III …).',
      'TOC is intentionally light — chapter number + italicized name, no counts.',
      'report_md becomes a centered front-matter block on the cover (dedication, epigraph).',
      'Scroll-mode (no book-viewer) — fiction prose is read, not paged.',
      'Short or long — a single-chapter short story and a multi-chapter novella both render well. Drawers are optional; use them only when the piece has chapters.',
    ],
  },
  visual_guide: {
    drawers: [
      { name: 'ch-1-the-world', role: 'chapter', hint: 'Chapter 1 — establish the setting / domain (e.g. "The City", "The Crew").' },
      { name: 'ch-2-the-details', role: 'chapter', hint: 'Chapter 2 — explore details / artifacts / characters (e.g. "Weapons", "Locations").' },
      { name: 'ch-3-the-context', role: 'chapter', hint: 'Chapter 3 — broader context, timelines, lore.' },
    ],
    items: [
      { type: 'markdown', role: 'chapter_intro', drawer: 'ch-1-the-world', repeat: '1 per chapter', hint: 'h1 → chapter subtitle; rest → chapter intro prose. The FIRST markdown item in a chapter is consumed as the intro page.' },
      { type: 'sketch', role: 'plate', drawer: 'ch-1-the-world', repeat: '2–8 per chapter', hint: 'Each sketch becomes a full plate page (Plate N.M). body_md → plate caption; metadata.label → plate label.' },
      { type: 'markdown', role: 'interstitial', drawer: 'ch-1-the-world', repeat: '0–2 per chapter', hint: 'Additional markdown items become interstitial text pages between plates.' },
      { type: 'text', role: 'quote_spread', repeat: '0–2 total', hint: 'Each text item becomes a centered quote spread.' },
    ],
    notes: [
      'Drawers become numbered chapters with their own divider page and TOC entry.',
      "Use viewer_aspect: '4 / 3' (default, landscape) or '3 / 4' for a portrait guide.",
      'At least 1 sketch is required — visual_guide is illustration-anchored.',
      'report_md becomes the inside-cover blurb.',
      'Ideal: 3–4 chapters, 3–6 plates per chapter, optional intro + interstitial text pages.',
    ],
  },
  comic: {
    drawers: [
      { name: 'ch-1-opening', role: 'chapter', hint: 'Opening beat — establish character, setting, tone.' },
      { name: 'ch-2-development', role: 'chapter', hint: 'Middle beats — complication, action, dialogue scenes.' },
      { name: 'ch-3-closing', role: 'chapter', hint: 'Closing beat — resolution, button, cliffhanger.' },
    ],
    items: [
      { type: 'sketch', role: 'page', drawer: 'ch-1-opening', repeat: '1–4 per chapter', hint: 'Each sketch is one page. Author with create_polygonized_sketch or create_sketch using `depiction.panelRecipe` (sunday-comic, manga-high-eye-control, american-comic-widescreen-panels, monoculous) and `depiction.lettering.carriers` for balloons. body_md is the editor note (visible at all fidelities). Optional metadata.comic.{spread, fidelity, role} per page.' },
    ],
    notes: [
      'Default fidelity is `nemu` (rough storyboard). The viewer ships a fidelity dial to flip stage in-place — no re-cook.',
      'Choose `publication.format`: american-comic (default), sunday-strip, manga-tankobon (R→L), or webtoon (vertical scroll).',
      "Per-page override: `metadata.comic.fidelity: 'pencils'` pins a single page while the rest stays at the publication default.",
      "Spreads: pair adjacent left/right pages with `metadata.comic.spread: 'left'` then `'right'` — they render side-by-side.",
      "Mark a cover sketch with `metadata.comic.role: 'cover'` to author the cover with the cover-mode recipe (default: first sketch becomes a standard page).",
      "report_md becomes the cover blurb. `aim` becomes the cover title.",
    ],
  },

  instruction_manual: {
    drawers: [
      { name: 'part-1-prepare', role: 'section', hint: 'Part 1 — unpack, identify parts and hardware.' },
      { name: 'part-2-assemble', role: 'section', hint: 'Part 2 — the core assembly steps.' },
      { name: 'part-3-finish', role: 'section', hint: 'Part 3 — final fittings, safety, care.' },
    ],
    items: [
      { type: 'markdown', role: 'step', drawer: 'part-2-assemble', repeat: '4–16 total', hint: 'Each markdown item is one numbered step. h1 = step title; the body is the instructions (rendered multi-column). End the markdown with a `> blockquote` line to set that step\'s fine-print / warning.' },
      { type: 'sketch', role: 'diagram', drawer: 'part-2-assemble', repeat: '1 per step', hint: 'Create with create_sketch using the `assembly-line-art` vocab card (exploded isometric line art). Gather each diagram IMMEDIATELY AFTER the step it illustrates — it attaches to that step\'s page.' },
      { type: 'text', role: 'note', repeat: '0–2 total', hint: 'Each text item appends to the current step\'s fine-print zone.' },
    ],
    notes: [
      'Order matters: a sketch attaches to the markdown step gathered just before it; a sketch with no open step (or whose step already has a diagram) opens its own diagram-only page.',
      'Drawers become numbered Parts with divider pages.',
      "Portrait booklet — default viewer_aspect '7 / 10'.",
      'report_md becomes the cover overview blurb. `aim` becomes the cover title.',
      'Each step page reserves a fine-print band; populate it via a trailing `> blockquote` in the step markdown or a text item.',
    ],
  },
  lesson_plan: {
    drawers: [
      { name: 'objectives', role: 'objectives', audience: 'both', hint: 'What the learner will be able to do. markdown; one item per objective or a short list.' },
      { name: 'references', role: 'references', audience: 'both', hint: 'Links and source material. gather type:link (title + source_url). Images/sketches welcome too.' },
      { name: 'activities', role: 'activities', audience: 'both', hint: 'The teaching sequence. Each markdown item is one step (h1 = step title). Add metadata.lesson.timing ("8 min") and metadata.lesson.teacher_note for the teacher face. Drop a create_sketch diagram in here as a figure.' },
      { name: 'assessment', role: 'assessment', audience: 'both', hint: 'Checks for understanding. body_md = the question; metadata.lesson.answer (or a trailing `> **Answer:** …` blockquote) = the key, shown on the teacher face only.' },
      { name: 'materials', role: 'materials', audience: 'both', hint: 'What is needed to run the lesson. markdown list or text items.' },
      { name: 'extensions', role: 'extensions', audience: 'both', hint: 'Differentiation / go-further prompts. markdown.' },
      { name: 'teacher_notes', role: 'teacher_notes', audience: 'teacher', hint: 'Notes-to-self, pacing, gotchas. Never rendered on the handout.' },
    ],
    items: [
      { type: 'markdown', role: 'objective', drawer: 'objectives', repeat: '1–4', hint: 'One objective each, or a single list item.' },
      { type: 'markdown', role: 'step', drawer: 'activities', repeat: '3–8', hint: 'One teaching step each. h1 = title; body = what to do.' },
      { type: 'link', role: 'reference', drawer: 'references', repeat: '0–6', hint: 'Each becomes a reference card (title + domain).' },
      { type: 'sketch', role: 'figure', drawer: 'activities', repeat: '0–4', hint: 'Inline diagram; gather with metadata.sketch_ref + optional body_md caption.' },
      { type: 'markdown', role: 'check', drawer: 'assessment', repeat: '1–4', hint: 'A check for understanding; put the key in metadata.lesson.answer.' },
    ],
    notes: [
      'Drawers carry the lesson anatomy; reserved names route to pedagogical sections. Unknown drawer names fall through to a generic section.',
      'One cook renders TWO faces into one folder: index.html (teacher plan) + handout.html (printable learner copy). They cross-link.',
      'metadata.audience on an item (teacher | learner | both) overrides its drawer default — that decides which face the item appears on.',
      'Set publication.style.learner_band (lower_primary | upper_primary | middle | secondary | undergrad | professional) to tune the handout’s typography and scaffolding. v1 is single-band; default is secondary.',
      'The band controls support density and type scale, NOT vocabulary — author the activities prose for the band you target.',
      'aim becomes the lesson title; report_md becomes the overview blurb on both faces.',
    ],
  },
};

export async function sketchStashHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('sketch_stash requires an object with intent');
  }
  const { intent, target_kind } = input;
  if (!intent || typeof intent !== 'string' || !intent.trim()) {
    throw new Error('intent is required (a one-line description of what to make)');
  }
  let kind = target_kind;
  if (kind !== undefined) {
    if (typeof kind !== 'string' || !STASH_RECIPES[kind]) {
      throw new Error(
        `target_kind must be one of: ${Object.keys(STASH_RECIPES).join(', ')} (or omit to get a default proposal).`,
      );
    }
  } else {
    kind = 'essay';
  }

  const recipe = STASH_RECIPES[kind];
  const trimmedIntent = intent.trim();

  // Build a per-kind suggested step list. Each step is a string the agent
  // can run directly via the named MCP tool; the operator can amend before
  // execution. We name the parameters explicitly so an agent unfamiliar
  // with the loop can follow it.
  const steps = [];
  const stashTitle = trimmedIntent.length > 80 ? `${trimmedIntent.slice(0, 77)}…` : trimmedIntent;
  steps.push(`mint_stash({ title: ${JSON.stringify(stashTitle)} })  // returns { stash_ref }`);
  for (const d of recipe.drawers) {
    steps.push(`mint_drawer({ stash_ref, name: ${JSON.stringify(d.name)} })  // ${d.hint}`);
  }
  for (const item of recipe.items) {
    if (item.type === 'sketch') {
      steps.push(`create_sketch({ title: ${JSON.stringify(`for ${item.role}`)}, manifest: { ... } })  // returns { ref }`);
      steps.push(`gather({ stash_ref, type: 'sketch', metadata: { sketch_ref: ref, label: '…' }, body_md: '…'${item.drawer ? `, drawer: ${JSON.stringify(item.drawer)}` : ''} })  // ${item.hint}`);
    } else if (item.type === 'markdown') {
      steps.push(`gather({ stash_ref, type: 'markdown', body_md: '# Title\\n\\nBody.'${item.drawer ? `, drawer: ${JSON.stringify(item.drawer)}` : ''} })  // ${item.hint}`);
    } else if (item.type === 'text') {
      steps.push(`gather({ stash_ref, type: 'text', body: '…' })  // ${item.hint}`);
    } else if (item.type === 'link') {
      steps.push(`gather({ stash_ref, type: 'link', source_url: 'https://…', title: '…' })  // ${item.hint}`);
    }
  }
  steps.push(`cook({ slices: [{ stash_ref }], aim: ${JSON.stringify(trimmedIntent)}, publication: { kind: ${JSON.stringify(kind)} } })  // materializes the outcome at /outcomes/<cook_ref>/`);

  return {
    intent: trimmedIntent,
    target_kind: kind,
    proposed: {
      title: stashTitle,
      drawers: recipe.drawers.map((d) => ({ ...d })),
      items: recipe.items.map((it) => ({ ...it })),
    },
    suggested_steps: steps,
    notes: [...recipe.notes],
    next_actions: [
      'Operator approves or amends the proposed structure',
      'Agent executes the suggested_steps (mint_stash → mint_drawer → create_sketch/gather → cook)',
      `Operator browses the outcome at /outcomes/<cook_ref>/ (route serves the static folder)`,
      target_kind === undefined
        ? "If you weren't sure about the kind, consider calling recommend_kind after gathering — it can suggest alternatives based on what actually landed in the stash."
        : `Consider forge_publications to materialize this alongside one or two other kinds for comparison.`,
    ],
  };
}

export async function archiveCookHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('archive_cook requires an object with cook_ref');
  }
  const { cook_ref, unarchive } = input;
  if (!cook_ref || typeof cook_ref !== 'string') {
    throw new Error('cook_ref is required (string)');
  }
  const result = unarchive
    ? CookRepository.unarchive(cook_ref)
    : CookRepository.archive(cook_ref);
  if (result.notFound) {
    throw new Error(`Cook '${cook_ref}' not found.`);
  }
  if (unarchive) {
    return {
      cook_ref,
      unarchived: !!result.unarchived,
      already_open: !!result.alreadyOpen,
      message: result.unarchived
        ? `Cook '${cook_ref}' restored to the inbox.`
        : `Cook '${cook_ref}' is already open.`,
    };
  }
  return {
    cook_ref,
    archived: !!result.archived,
    already_archived: !!result.alreadyArchived,
    message: result.archived
      ? `Cook '${cook_ref}' archived. Outcome folder at /outcomes/${cook_ref}/ is unchanged and still browseable. Use archive_cook({ cook_ref, unarchive: true }) to restore.`
      : `Cook '${cook_ref}' is already archived.`,
  };
}

export function registerCookTools() {
  registerTool({
    name: 'cook',
    description:
      "Ring 9 — the COOK verb: the nucleation collider on cleaved stash slices.\n\n" +
      "THE BINDING VOW: a Cook aims its nucleation arrow at ONE target — one singular `aim`. \"What open questions remain?\" is ONE aim; the body can enumerate, but the OUTCOME is the singular framing. If you find yourself wanting to nucleate two outcomes, that is two cooks. Refuse to compound them.\n\n" +
      "THREE REQUIREMENTS (the discipline this tool enforces in shape; the brief teaches in spirit):\n" +
      "  1. CLEAVE slices of context from Stash(es). A slice is a deliberate cut — { stash_ref, item_ids? } — not 'everything I happen to have'. item_ids omitted means whole-stash (use lazily). Multiple slices, including across stashes, are the superposition.\n" +
      "  2. AIM with a dismantling question — interrogative, pattern-seeking ('what unifies these?', 'where do these disagree?', 'what hidden structure?'). Not exploratory ('tell me about X' — that's gathering, the Stash's job).\n" +
      "  3. NUCLEATE one new artifact — the agent authors report_md, focusing all attention on the singular aim. The slices are RECOMBINATOR material, not citation material: they flavor the prose without appearing in it as quotes.\n\n" +
      "AUTHORING MODEL: the AGENT authors report_md (and visuals); cook only materializes the folder. No server-side LLM call.\n\n" +
      "COOK STOPS AT COOK. There is no cook outlet to plan mode — a cook is a first-class deliberation node, and other rings read it. If a cook outcome later reads as tractable work, plan mode itself can be seeded from it via `forge_plan({ source: { kind: 'cook', cook_ref } })`; the cook's aim becomes the seeded plan goal. That handoff is a plan-side decision made later, not a cook outlet — most cooks never become plans, which is correct.\n\n" +
      "PUBLISHER: the materialization shape is a `publication: { kind }` — `essay` (long-form agent-authored doc, default), `picture_book` (paginated sketch-per-page book; one whole-stash slice), `slide_deck` (16:9 paginated deck), `comic` (sketch-per-page comic with format + fidelity dial: nemu → breakdown → pencils → inks; one whole-stash slice; collaboration surface, not just a final-output renderer), `lesson_plan` (teacher tool — one stash renders TWO faces into one folder: a teacher plan and a printable, band-tuned student handout; drawers carry the lesson anatomy; metadata.audience routes items between faces), or the other catalog entries (flyer/brief/resume/newsletter/field_guide/pamphlet/textbook/novel/visual_guide). Cook is the verb; the OUTCOME is a publication of a chosen kind. The legacy `template:` arg is accepted as a soft alias for one release (`'standard'` → `'essay'`).\n\n" +
      "Returns { cook_ref, outcome_url, outcome_dir, template_version, file_count, suggested_lens?, message }. The static index.html is self-contained.",
    inputSchema: {
      type: 'object',
      properties: {
        slices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stash_ref: { type: 'string' },
              item_ids: { type: 'array', items: { type: 'integer' } },
            },
            required: ['stash_ref'],
          },
          description: "Cleaved slices of context (≥1). Each: { stash_ref, item_ids? }. Omit item_ids for a whole-stash slice (lazy default). Multiple slices = superposition. Per the cleave requirement, prefer to enumerate item_ids when you've actually chosen — 'whole stash' should be the exception, not the default.",
        },
        aim: {
          type: 'string',
          description: "The singular dismantling question Cook nucleates around. ONE target per cook (the binding vow). Interrogative, pattern-seeking, not open-ended. If multiple aims are in play, cook them separately.",
        },
        report_md: {
          type: 'string',
          description: 'The agent-authored nucleation, markdown. Cook materializes this verbatim as report.md and renders it through the static template into index.html. The aim should be the report\'s singular target — the body can have sections/lists/tables but never multiple outcomes. Slices are recombinator material; do not cite them as sources.',
        },
        additional_context: {
          type: 'array',
          items: { type: 'object' },
          description: 'Optional: MCP tool results the agent looped in (e.g. meta_context_brief output, semantic_search hits, get_catalyst result). Stored on the cook row for lineage; not embedded into report.md.',
        },
        suggested_lens: {
          type: 'string',
          enum: ['spike', 'segment_expansion', 'vertical_reinforcement', 'collider'],
          description: 'Optional: which plan-mode lens the agent thinks fits if this becomes work. Surfaced in the outcome header; carried through to plan mode if the cook is later seeded into forge_plan via source.',
        },
        visuals: {
          type: 'array',
          items: { type: 'object' },
          description: "Optional visuals to inline into the outcome (essay kind only). Each entry: { filename (safe name ending .svg or .png), type ('svg'|'png'), body (svg source) OR data_base64 (png bytes), caption? }. SVGs inlined into index.html; PNGs written as files and <img>-referenced. Not accepted by publication.kind='picture_book' — each page's illustration comes from a sketch item's sketch_ref instead.",
        },
        publication: {
          type: 'object',
          description: "Publication kind to materialize. Defaults to { kind: 'essay' } (agent-authored long-form doc). Use { kind: 'picture_book' } to render a stash as a sequential illustrated book — one sketch-typed stash item per page (drawers become chapters), body_md on each sketch becomes the page caption, `aim` becomes the cover title, `report_md` becomes the (optional) cover blurb. picture_book takes EXACTLY one whole-stash slice and ignores `visuals`.",
          properties: {
            kind: {
              type: 'string',
              enum: ['essay', 'picture_book', 'slide_deck', 'flyer', 'brief', 'resume', 'newsletter', 'field_guide', 'pamphlet', 'textbook', 'novel', 'visual_guide', 'comic', 'instruction_manual', 'lesson_plan', 'photojournal'],
              description:
                "The publication kind. Each entry: shape · resolver · `min:` content shape to look good. If unsure, call `recommend_kind` first.\n" +
                "  · `essay`        — scroll · letter · 1col, report_md is the whole body, optional visuals[].\n" +
                "                      min: a non-empty report_md (the agent owns the body). Visuals optional.\n" +
                "  · `picture_book` — paginated · book · 1col, sketch items → pages (one whole-stash slice).\n" +
                "                      min: ≥3 sketch items each with a body_md caption. Drawers become chapters.\n" +
                "  · `slide_deck`   — paginated · slide (16:9), sketch/svg/markdown/text items → mixed slides, drawers → section dividers.\n" +
                "                      min: 5–15 items of mixed types (sketch/svg for visual slides; markdown/text for content slides). Drawers welcome.\n" +
                "  · `flyer`        — single page · letter · hero+headline+body+CTA, first sketch → hero, markdown → headline+body, link → CTA.\n" +
                "                      min: 1 sketch (hero) + 1 markdown (h1 = headline; body = pitch) + 1–3 link items as CTAs. ≤5 items total.\n" +
                "  · `brief`        — single page · letter · 2col, report_md = executive summary, markdown → points, sketch → sidebar figures, text → callouts.\n" +
                "                      min: 2–5 markdown items (each a point with h1 + body). report_md = executive summary. Optional 1–2 sketches in the sidebar.\n" +
                "  · `resume`       — single page · letter · opinionated 2col, markdown → sections (drawer 'sidebar'/'skills'/'education' routes to sidebar; 'identity' drawer drives the header).\n" +
                "                      min: an `identity` drawer with 1 markdown item (h1 = name; line 2 = tagline; rest = summary). 1–2 sidebar drawers (skills/education) + 2–4 main markdown sections (experience/projects/publications).\n" +
                "  · `newsletter`   — scroll · letter · hero_rail, markdown → article cards, text → pull quotes, link → 'in case you missed it' section, first sketch → hero.\n" +
                "                      min: 2–4 markdown items (articles, each with h1 + body) + 0–2 text items (pull quotes) + 2–5 link items. Optional 1 hero sketch. report_md = masthead lede.\n" +
                "  · `field_guide`  — paginated · book · 1col, sketch+markdown → specimen entries, drawers → sections. Book-viewer supported.\n" +
                "                      min: 3–12 sketch items each paired with a body_md caption (h1 = label; rest = description). Drawers = categorical sections. report_md = foreword.\n" +
                "  · `pamphlet`     — paginated · tri-fold (front + content panels + back), markdown → panel sections, sketch → panel illustrations. Book-viewer supported.\n" +
                "                      min: exactly 4 markdown items (one per content panel; h1 = panel title) for a true tri-fold. 3–6 acceptable. report_md = front-cover blurb.\n" +
                "  · `textbook`     — scroll · book · 1col, drawers → numbered chapters, markdown → sections, sketch → numbered figures (Fig. N.M), text → key-term callouts. Auto TOC.\n" +
                "                      min: 3+ drawers as chapters, 2–6 markdown sections per chapter, optional 1–4 sketches per chapter as figures, optional text items as callouts. report_md = preface.\n" +
                "  · `novel`        — scroll · book · 1col, fiction prose — short story, novella, or novel. Drawers → Roman-numeral chapters, markdown → prose scenes (✦ ✦ ✦ between scenes), text → epigraphs/pull-quotes, first sketch → chapter frontispiece.\n" +
                "                      min: ≥1 markdown scene. Short or long — a single-chapter short story and a multi-chapter novella both render well; drawers are optional (add them only when there are chapters). report_md = front-matter (dedication/epigraph).\n" +
                "  · `visual_guide` — paginated · book · 1col, drawers → numbered chapters with intro pages, sketches → full plate pages (Plate N.M), markdown → chapter intros + interstitials, text → quote spreads.\n" +
                "                      min: ≥1 sketch, 3–4 drawers as chapters, 1 markdown chapter-intro per chapter, 2–6 plates per chapter. report_md = inside-cover blurb. Default aspect 4/3.\n" +
                "  · `comic`        — paginated · format-driven · sketch-per-page comic with fidelity dial (nemu → breakdown → pencils → inks). Format: american-comic (default), sunday-strip, manga-tankobon (R→L), webtoon (vertical scroll). Sibling of picture_book; one whole-stash slice. Per-page metadata.comic.{spread, fidelity, role} carries through to the viewer. Collaboration surface: the dial flips presentation without re-cooking.\n" +
                "                      min: ≥3 sketch items (each ideally a panel-recipe-authored page). Drawers become chapters. report_md = cover blurb. Pages with metadata.comic.spread='left' then 'right' render side-by-side.\n" +
                "  · `instruction_manual` — paginated · portrait booklet · per-page: a dominant exploded-diagram band + a numbered multi-column step + a fine-print band. markdown → numbered steps (h1 = step title; body = instructions; trailing `> blockquote` = fine print), the sketch gathered right after a step → that step's diagram, drawers → numbered Parts, text → step notes. Author diagrams with create_sketch using the `assembly-line-art` vocab card (exploded isometric line art).\n" +
                "                      min: 4–16 markdown steps each followed by a sketch diagram. Drawers = Parts. report_md = cover overview. Default aspect '7 / 10'.\n" +
                "  · `lesson_plan` — scroll · TWO faces in one folder: index.html (teacher plan) + handout.html (printable learner copy), cross-linked. Reserved drawers route to pedagogical sections (objectives, references, activities, assessment, materials, extensions, teacher_notes); unknown drawers fall through to generic sections; root items lead as Overview. markdown → steps/objectives/checks (h1 = title), link → reference cards, sketch → inline figures, text → callouts. metadata.audience (teacher | learner | both, drawer-defaulted) decides which face an item lands on; metadata.lesson.{timing,teacher_note,answer} render on the teacher face only (the answer key is stripped from the handout — structured field or a trailing `> **Answer:** …` blockquote). Set publication.style.learner_band (lower_primary…professional, default secondary) to tune the handout’s type scale + scaffolding — presentation only, not prose. v1 is single-band.",
            },
            viewer_aspect: {
              type: 'string',
              description: "Optional aspect ratio for the book-viewer page frame on paginated kinds. Format: '<num> / <num>' (e.g. '16 / 9' for a standard slide deck, '7 / 10' for a portrait book, '1 / 1' for square). Defaults: picture_book = '10 / 7', slide_deck = '16 / 9'. Ignored for essay (scroll mode has no aspect).",
            },
            format: {
              type: 'string',
              enum: ['american-comic', 'sunday-strip', 'manga-tankobon', 'webtoon'],
              description: "Comic-only. Format preset resolving to (pagination, reading_direction, aspect). Defaults to 'american-comic'. 'manga-tankobon' is R→L; 'webtoon' is vertical-scroll (no page breaks).",
            },
            fidelity: {
              type: 'string',
              enum: ['nemu', 'breakdown', 'pencils', 'inks'],
              description: "Comic-only. Initial render stage. 'nemu' (ネーム, default) is the roughest — panel guides, eye-line arrows, balloon placeholders. 'breakdown' / 'pencils' / 'inks' progressively polish. The viewer ships a dial; this just sets the entry stage. Per-page override: metadata.comic.fidelity on the stash item.",
            },
            style: {
              type: 'object',
              description: `Optional style overrides. \`accent\` (named color or 3/6-digit hex) overrides the kind's default accent (callouts, links, dividers, hero backgrounds); named: red, orange, amber, green, emerald, teal, sky, blue, indigo, violet, purple, pink, rose, slate, zinc, black. \`theme\` (essay + slide_deck only) sets the WHOLE page palette from a named presentation theme so chrome AND embedded visuals stay coherent — a published deck need not default to a light page wrapping dark slides. For slide_deck it also re-tints the embedded sketch ink/backdrop to match. One of: ${PRESENTATION_THEME_NAMES.join(', ')} (default unset = the kind's built-in light palette). \`accent\` still applies on top of a theme.`,
              properties: {
                accent: {
                  type: 'string',
                  description: "Accent color override. Named ('teal', 'rose', 'amber', …) or hex ('#1d4ed8', '#fff').",
                },
                theme: {
                  type: 'string',
                  enum: PRESENTATION_THEME_NAMES,
                  description: "Named presentation theme (essay + slide_deck only) — sets the full page palette + embedded-sketch surface so the artifact isn't a light page wrapping dark visuals. dark | midnight | light | paper | blueprint | sepia | high-contrast.",
                },
              },
            },
          },
          required: ['kind'],
        },
        template: {
          type: 'string',
          enum: ['standard', 'picture_book'],
          description: "DEPRECATED — use `publication: { kind }` instead. Soft alias kept for one release: 'standard' maps to publication.kind='essay'; 'picture_book' maps to publication.kind='picture_book'. Passing both `publication` and `template` is an error.",
        },
      },
      required: ['slices', 'aim'],
    },
    handler: cookHandler,
  });

  registerTool({
    name: 'get_cook',
    description:
      "Ring 9 — fetch a cook row (the index pointing at its Outcome Artifact folder). Returns { cook_ref, aim, slices, stash_refs, additional_context, suggested_lens, outcome_dir, outcome_url, template_version, created_at }. The actual ideation lives in report.md inside outcome_dir. Cook is a first-class node: any ring (plan mode via forge_plan source, audit/compose/brief surfaces, etc.) can read this row and act on it.",
    inputSchema: {
      type: 'object',
      properties: {
        cook_ref: { type: 'string', description: 'The cook to fetch.' },
      },
      required: ['cook_ref'],
    },
    handler: getCookHandler,
  });

  registerTool({
    name: 'list_cooks',
    description:
      "Ring 9 — list cooks (the outcomes inbox), most-recent first. Optional `limit` and `status` filter ('open' default / 'archived' / 'all'). Returns { total, cooks: [{ cook_ref, aim, stash_refs, suggested_lens, outcome_url, template_version, created_at, archived_at }] }. Each row is a deliberation node any ring can read — pull a `cook_ref` into forge_plan's `source` to seed a plan from it.",
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max rows to return.' },
        status: {
          type: 'string',
          enum: ['open', 'archived', 'all'],
          description: "Soft-delete filter. 'open' (default) hides archived rows; 'archived' shows only archived; 'all' shows both.",
        },
      },
    },
    handler: listCooksHandler,
  });

  registerTool({
    name: 'sketch_stash',
    description:
      "Ring 9 — vibe-to-items scaffold: given a free-form intent + optional target publication kind, return a PROPOSED stash structure (drawers + item slots) plus a step-by-step script the agent can execute (mint_stash → mint_drawer → create_sketch/gather → cook).\n\n" +
      "Companion to `sketch_plan`. Use this BEFORE gathering when the operator's request is vague and you want to confirm shape before producing content. No DB writes; no LLM call. The kind catalog's per-kind ideal-content-shape rules are inverted here (kind → structure rather than items → kind).\n\n" +
      "Without `target_kind`, returns an essay-shaped default and recommends calling `recommend_kind` after gathering to validate the chosen kind matches the actual material. With `target_kind`, returns the canonical recipe for that kind.\n\n" +
      "Returns { intent, target_kind, proposed: { title, drawers, items }, suggested_steps: [string], notes: [string], next_actions: [string] }. The agent can execute suggested_steps verbatim or amend them in response to operator feedback.",
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'One-line description of what to make ("a flyer for the open house", "a brief on the Q3 refactor", …). Drives the stash title and the cook aim.' },
        target_kind: {
          type: 'string',
          enum: ['essay', 'picture_book', 'slide_deck', 'flyer', 'brief', 'resume', 'newsletter', 'field_guide', 'pamphlet', 'textbook', 'novel', 'visual_guide', 'comic', 'instruction_manual', 'lesson_plan', 'photojournal'],
          description: 'Optional. If known, the proposal is shaped specifically for this kind. Omit to get a default essay-shaped proposal + a nudge toward recommend_kind.',
        },
      },
      required: ['intent'],
    },
    handler: sketchStashHandler,
  });

  registerTool({
    name: 'archive_cook',
    description:
      "Ring 9 — soft-delete a cook row, removing it from the default /outputs inbox. Idempotent: already-archived rows return { archived: false, already_archived: true }.\n\n" +
      "The outcome folder on disk is NOT touched — `/outcomes/<cook_ref>/` stays addressable so downstream consumers (plan-mode sources, contextmap citations, share-links) continue to resolve. This matches the citable-atoms posture from archive_item. To truly remove the artifact, delete the folder manually after archiving.\n\n" +
      "Pass `unarchive: true` to restore a previously archived cook to the inbox.\n\n" +
      "Useful pattern: after `forge_publications` materializes N candidate kinds, archive the (N−1) rejects so the inbox stays tight.",
    inputSchema: {
      type: 'object',
      properties: {
        cook_ref: { type: 'string', description: 'The cook to archive (or unarchive).' },
        unarchive: { type: 'boolean', description: 'If true, restore an already-archived cook to the inbox. Default false.' },
      },
      required: ['cook_ref'],
    },
    handler: archiveCookHandler,
  });

  registerTool({
    name: 'forge_publications',
    description:
      "Ring 9 — cook the same stash into 2–4 candidate publication kinds in a single call. Convenience verb for the multi-kind preview pattern: gather → forge candidates → operator picks the winner → archive the rest.\n\n" +
      "Use this when the right kind isn't obvious and `recommend_kind` returns multiple close-scoring options, OR when the operator explicitly wants to compare shapes (e.g. 'show me this as a brief AND a newsletter AND a slide_deck'). The agent doesn't have to pick — the operator does, by browsing the materialized outcomes.\n\n" +
      "Each forged cook is a REAL cook (full DB row + outcome folder, indexed by `list_cooks` and visible at /outputs). `forge_id` groups them so later cleanup can archive the rejects. v1 has no `archive_cook` yet, so use this judiciously — every forge writes N cooks the operator will see in their inbox.\n\n" +
      "Returns { forge_id, cooks: [{ kind, cook_ref, outcome_url, skipped_items, template_version, message }], errors?, message }.",
    inputSchema: {
      type: 'object',
      properties: {
        slices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stash_ref: { type: 'string' },
              item_ids: { type: 'array', items: { type: 'integer' } },
            },
            required: ['stash_ref'],
          },
          description: 'Same shape as cook(). All forged cooks share this slice manifest.',
        },
        aim: {
          type: 'string',
          description: 'Same shape as cook(). One aim across all forged kinds (the comparison is which SHAPE fits the same aim best).',
        },
        report_md: {
          type: 'string',
          description: 'Same shape as cook(). Threaded through to every forged cook (each kind slots it differently — body, exec summary, lede, etc.).',
        },
        kinds: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['essay', 'picture_book', 'slide_deck', 'flyer', 'brief', 'resume', 'newsletter', 'field_guide', 'pamphlet', 'textbook', 'novel', 'visual_guide', 'comic', 'instruction_manual', 'lesson_plan', 'photojournal'],
          },
          description: '2–4 distinct publication kinds to materialize against the same slice + aim. Each becomes its own cook (DB row + folder).',
        },
        viewer_aspect: {
          type: 'string',
          description: "Optional aspect ratio for paginated kinds in the set. Same format as cook's `publication.viewer_aspect`. Ignored for non-paginated kinds.",
        },
        suggested_lens: {
          type: 'string',
          enum: ['spike', 'segment_expansion', 'vertical_reinforcement', 'collider'],
          description: 'Same shape as cook(). Threaded through to every forged cook.',
        },
        additional_context: {
          type: 'array',
          items: { type: 'object' },
          description: 'Same shape as cook(). Recorded on every forged cook for lineage.',
        },
      },
      required: ['slices', 'aim', 'kinds'],
    },
    handler: forgePublicationsHandler,
  });

  registerTool({
    name: 'recommend_kind',
    description:
      "Ring 9 — rules-based recommendation: scan a stash, return ranked publication kinds for cook().\n\n" +
      "No LLM call. Examines item type counts, drawer structure, sketch+caption pairings, and whether an aim is set; scores each kind in the catalog against rules-of-thumb derived from the v1 PUBLISHER.plan.md (e.g. picture_book needs ≥1 sketch; resume rewards an `identity` drawer; pamphlet hits its ideal at exactly 4 markdown items).\n\n" +
      "Use this *before* cook() when the operator's intent doesn't already pin a kind, or when an agent is uncertain which kind best fits the gathered material. The returned `rationale` is one-line and the `fit_notes` enumerate the score's reasoning so the operator can read the recommendation and pick.\n\n" +
      "Returns { stash_ref, stash_title, scan: { item_count, type_counts, drawer_count, sketches_with_bodymd, has_aim }, recommendations: [{ kind, score, rationale, fit_notes: [...] }] }. Default limit 3.",
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'The stash to scan.' },
        item_ids: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Optional subset of item ids (matches a planned cook slice). Omit to consider the whole stash.',
        },
        aim: {
          type: 'string',
          description: 'Optional intended cook aim — biases scoring toward kinds that benefit from a singular framing (essay, brief, flyer).',
        },
        limit: {
          type: 'integer',
          description: 'Max recommendations to return. Default 3.',
        },
      },
      required: ['stash_ref'],
    },
    handler: recommendKindHandler,
  });
}

// Test seam.
export const _internals = {
  LENSES,
  PUBLICATION_KINDS,
  TEMPLATE_ALIASES,
  generateRef,
  resolvePublicationKind,
  KIND_SCORERS,
  scanStashForRecommendation,
};
