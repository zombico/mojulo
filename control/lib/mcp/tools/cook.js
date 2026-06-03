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
import { writeOutcome, outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes/write';

const LENSES = new Set(['spike', 'segment_expansion', 'vertical_reinforcement', 'collider']);

function generateRef() {
  return `cook_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
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
  } = input;

  // Validate the three structural requirements: cleaved slices, a singular
  // aim, and an agent-authored report. The binding vow lives in the brief
  // (aim must be ONE target) — at the schema level we just enforce shape.
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
  if (!report_md || typeof report_md !== 'string') {
    throw new Error(
      'report_md is required (the agent-authored nucleation, markdown). Cook materializes; the agent authors.',
    );
  }
  if (suggested_lens !== undefined && !LENSES.has(suggested_lens)) {
    throw new Error(`suggested_lens must be one of: ${[...LENSES].join(', ')}`);
  }
  if (additional_context !== undefined && !Array.isArray(additional_context)) {
    throw new Error('additional_context must be an array when provided');
  }
  if (visuals !== undefined && !Array.isArray(visuals)) {
    throw new Error('visuals must be an array when provided');
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
  const { outcomeDir, templateVersion, fileCount } = await writeOutcome({
    cookRef,
    aim,
    slices: resolvedSlices,
    reportMd: report_md,
    visuals: visuals || [],
    suggestedLens: suggested_lens,
  });

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

  return {
    ok: true,
    cook_ref: cookRef,
    outcome_url: outcomeUrlFor(cookRef),
    outcome_dir: outcomeDir,
    template_version: templateVersion,
    file_count: fileCount,
    ...(suggested_lens ? { suggested_lens } : {}),
    message: `Cook nucleated at ${outcomeUrlFor(cookRef)} (${fileCount} files, template v${templateVersion}). Aim: "${aim}". Cook stops at cook — if this outcome later reads as tractable work, plan mode pulls it via forge_plan({ source: { kind: 'cook', cook_ref: '${cookRef}' } }).`,
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
  const { limit } = input || {};
  const cooks = CookRepository.list(limit ? { limit } : {});
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
    })),
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
          description: "Optional visuals to inline into the outcome. Each entry: { filename (safe name ending .svg or .png), type ('svg'|'png'), body (svg source) OR data_base64 (png bytes), caption? }. SVGs inlined into index.html; PNGs written as files and <img>-referenced.",
        },
      },
      required: ['slices', 'aim', 'report_md'],
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
      "Ring 9 — list cooks (the outcomes inbox), most-recent first. Optional `limit`. Returns { total, cooks: [{ cook_ref, aim, stash_refs, suggested_lens, outcome_url, template_version, created_at }] }. Each row is a deliberation node any ring can read — pull a `cook_ref` into forge_plan's `source` to seed a plan from it.",
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max rows to return.' },
      },
    },
    handler: listCooksHandler,
  });
}

// Test seam.
export const _internals = { LENSES, generateRef };
