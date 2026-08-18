/**
 * MCP Ring 6 — semantic_search (recall over durable app state).
 *
 * Fuzzy lookup over the unified meta_embeddings sidecar. Complements the
 * structured readers (meta_context_brief, get_mcp_orbit_component,
 * get_catalyst, ...) — those answer "give me the full row at this ref";
 * this answers "which refs are even relevant to this intent?"
 *
 * Contract: retrieve, don't resolve. The result rows give the agent stable
 * refs + short snippets; the agent follows up with the structured reader to
 * pull the full body when it decides a row is worth the context cost.
 *
 * See lite-template/integration/SEMANTIC_INDEX_PLAN.md.
 */

import { registerTool } from '@/lib/mcp/server';
import {
  EmbeddingsRepository,
  SOURCE_KINDS,
} from '@/lib/db/repositories/embeddings';
import { WEAK_SEARCH_TOP_SCORE } from '@/lib/db/repositories/mcpToolCalls';

// In-band recovery hints (routing-context-weaving.plan.md C1/C2). The weak
// threshold is the SAME constant the orientation cut counts gaps by — the
// telemetry and the agent-facing nudge never disagree about what "weak" means.
// Before C1 a weak search returned undecorated and only telemetry noticed; the
// hint turns the silent miss into a one-hop recovery. `degraded` separates
// "the index answered nothing" from "the index couldn't answer" (embed
// failure) — an empty result with no explanation reads as "nothing exists".
function buildSearchHint({ degraded, results, routing }) {
  if (degraded) {
    return (
      'Semantic index degraded — the query could not be embedded, so this empty result does NOT mean nothing matches. ' +
      'Retry once; if it persists, the embedder model may be missing — run `node scripts/reindex-embeddings.js` on the control plane.'
    );
  }
  const topScore = results.length ? results[0].score : null;
  const weak = results.length === 0 || topScore < WEAK_SEARCH_TOP_SCORE;
  if (!weak) return null;
  const scored = topScore === null ? 'no results' : `top score ${topScore.toFixed(2)}`;
  if (routing) {
    return (
      `Weak routing match (${scored}) — don't commit to a card on this. ` +
      "Rephrase with the artifact's FORM (a picture / object / world / tune / game about …), " +
      "or read the routing index directly: forward_context({mode:'studio'}) for creative asks, forward_context() for the office wing."
    );
  }
  return (
    `Weak match (${scored}) — treat these as leads, not answers. ` +
    'Rephrase closer to the user\'s own framing, widen by dropping the `kinds` filter, ' +
    'or route via forward_context / get_tool_index instead.'
  );
}

export async function semanticSearchHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('semantic_search requires an input object with `query`');
  }
  const { query, kinds, limit } = input;
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('query is required (non-empty string)');
  }
  const opts = {};
  if (kinds !== undefined && kinds !== null) opts.kinds = kinds;
  if (limit !== undefined && limit !== null) opts.limit = limit;
  const { results, degraded } = await EmbeddingsRepository.search(query, {
    ...opts,
    withMeta: true,
  });
  const routing = opts.kinds ? [].concat(opts.kinds).includes('routing') : false;
  const hint = buildSearchHint({ degraded, results, routing });
  // Outcome signal for the orientation-gap telemetry (numbers/enums only,
  // stripped from the wire by instrumentedInvoke). A zero-result or weak-top
  // search is a coined term that failed to reward the question — see
  // orientation-ramp.plan.md R4.
  const signal = {
    result_count: results.length,
    ...(results.length ? { top_score: results[0].score } : {}),
    ...(opts.kinds ? { kinds: [].concat(opts.kinds) } : {}),
    ...(degraded ? { degraded: true } : {}),
  };
  return {
    results,
    ...(degraded ? { degraded: true } : {}),
    ...(hint ? { hint } : {}),
    _telemetrySignal: signal,
  };
}

export function registerSemanticSearchTools() {
  registerTool({
    name: 'semantic_search',
    description:
      "Fuzzy retrieval over durable mojulo state: principles, capability bodies, mcp-orbit components / compositions / provider artifacts, declared MCP tool inventory, the shipped catalyst library, sketch vocabulary cards, the per-knob `sketch_method` capability records, manji-program-bearing cards (mandala-patterns + shot-glyphs whose card declares a `manjiProgram` field), painted-landscape glyph cards, view-vocab cards (one per `create_view` kind / `compose_world` base — the study-object and world parameter manuals), solid-vocab cards (one per `mint_solid` kind / `edit_solid` op — the figure/creature/object/structure parameter manuals), motion-vocab cards (one per `forge_motion` / `stitch_motion` subject family — camera / deck / effect / world / stitch), and routing cards (`kinds:['routing']`: creative recognizer rows → entry tool + forks, returned whole). Use when you have an intent or topic but not a specific ref — for finding which rows in the contextmap / capabilities / composer state are relevant before navigating them structurally, which sketch layout card to read before composing a diagram, which view kind or world base fits an intent, or which shot-glyph / mandala-pattern to pass as `programRef` to `create_manji_tree`. Returns `{ results: [{ source_kind, source_ref, score, snippet }] }`; snippets are capped at ~280 chars and the agent is expected to pair this with the structured readers (`meta_context_brief`, `get_mcp_capabilities`, `get_mcp_orbit_component`, `get_catalyst`, `get_sketch_vocab`, `get_view_vocab`, `get_solid_vocab`, `get_motion_vocab`, ...) to retrieve full bodies — or in the `manji_program` case, pass the `source_ref` straight to `create_manji_tree`, or in the `painted_landscape` case use the card's `id` as a named glyph in `compose_world`'s 'painted-landscape' `overrides`. Optional `kinds` filter restricts to one or more source kinds; default returns all kinds. Capability rows that have been superseded never appear in results — the search filters against the current row per provider. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Free-text intent. Phrased the way the user would phrase the question, not a SQL predicate — the index is semantic.',
        },
        kinds: {
          type: 'array',
          description:
            'Optional filter: restrict results to one or more source kinds. Default returns all kinds. Use when you already know whether you want, say, only principles vs. only mcp_tools.',
          items: {
            type: 'string',
            enum: SOURCE_KINDS,
          },
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          default: 8,
          description: 'Number of results to return (1–50). Defaults to 8.',
        },
      },
      required: ['query'],
    },
    handler: semanticSearchHandler,
  });
}
