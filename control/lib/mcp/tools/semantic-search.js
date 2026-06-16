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
  const results = await EmbeddingsRepository.search(query, opts);
  return { results };
}

export function registerSemanticSearchTools() {
  registerTool({
    name: 'semantic_search',
    description:
      "Fuzzy retrieval over durable mojulo state: principles, capability bodies, mcp-orbit components / compositions / provider artifacts, declared MCP tool inventory, the shipped catalyst library, sketch vocabulary cards, and manji-program-bearing cards (mandala-patterns + shot-glyphs whose card declares a `manjiProgram` field). Use when you have an intent or topic but not a specific ref — for finding which rows in the contextmap / capabilities / composer state are relevant before navigating them structurally, which sketch layout card to read before composing a diagram, or which shot-glyph / mandala-pattern to pass as `programRef` to `create_manji_tree`. Returns `{ results: [{ source_kind, source_ref, score, snippet }] }`; snippets are capped at ~280 chars and the agent is expected to pair this with the structured readers (`meta_context_brief`, `get_mcp_capabilities`, `get_mcp_orbit_component`, `get_catalyst`, `get_sketch_vocab`, ...) to retrieve full bodies — or in the `manji_program` case, pass the `source_ref` straight to `create_manji_tree`. Optional `kinds` filter restricts to one or more source kinds; default returns all kinds. Capability rows that have been superseded never appear in results — the search filters against the current row per provider. Read-only.",
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
