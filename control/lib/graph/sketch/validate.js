/**
 * Creation-map validator — asserts the manifest's references still resolve
 * against the live MCP registry and the contextmap's schema enums.
 *
 * Three checks, in order of likely failure:
 *   1. Every name in `validates.tools` is currently registered in the MCP
 *      server's tool registry.
 *   2. Every node/edge kind in `validates` is a member of the corresponding
 *      schema enum exported from `lib/db/repositories/meta-context`.
 *   3. Every source_event in `validates` is in the source-event whitelist
 *      asserted at principle insertion time.
 *
 * Returns { ok, problems: [{kind, ref, detail}] } — never throws. The page
 * renders a green status if `ok`, a red list otherwise.
 *
 * MCP tools register lazily (see `ensureToolsRegistered` in lib/mcp/server.js).
 * Callers should invoke that *before* `validateCreationMap` so the registry
 * is populated; otherwise every tool reference will report as missing.
 */

import { listRegisteredToolNames } from '@/lib/mcp/server';
import {
  META_NODE_KINDS,
  META_EDGE_KINDS,
  META_PRINCIPLE_SOURCE_EVENTS,
} from '@/lib/db/repositories/meta-context';

export function validateCreationMap(manifest) {
  const problems = [];
  const validates = manifest?.validates || {};

  // Registration check — a manifest may reference any registered tool, whether
  // or not it rides the connect surface (packs mode lists only spine + packs).
  const registeredToolNames = new Set(listRegisteredToolNames());
  for (const toolName of validates.tools || []) {
    if (!registeredToolNames.has(toolName)) {
      problems.push({
        kind: 'tool_missing',
        ref: toolName,
        detail: `Tool '${toolName}' is referenced by the manifest but not registered in the MCP server.`,
      });
    }
  }

  // Cross-check: every station that claims to be an MCP tool must point at
  // a name in validates.tools, so the validator's loud check covers it.
  for (const station of manifest?.stations || []) {
    if (station.kind === 'mcp_tool' && station.tool) {
      if (!(validates.tools || []).includes(station.tool)) {
        problems.push({
          kind: 'station_unvalidated',
          ref: station.id,
          detail: `Station '${station.id}' uses tool '${station.tool}' but it is not listed in validates.tools.`,
        });
      }
    }
  }

  const nodeKindSet = new Set(META_NODE_KINDS);
  for (const k of validates.nodeKinds || []) {
    if (!nodeKindSet.has(k)) {
      problems.push({
        kind: 'node_kind_missing',
        ref: k,
        detail: `Node kind '${k}' is not in the meta_nodes schema enum.`,
      });
    }
  }

  const edgeKindSet = new Set(META_EDGE_KINDS);
  for (const k of validates.edgeKinds || []) {
    if (!edgeKindSet.has(k)) {
      problems.push({
        kind: 'edge_kind_missing',
        ref: k,
        detail: `Edge kind '${k}' is not in the meta_edges schema enum.`,
      });
    }
  }

  const sourceEventSet = new Set(META_PRINCIPLE_SOURCE_EVENTS);
  for (const e of validates.sourceEvents || []) {
    if (!sourceEventSet.has(e)) {
      problems.push({
        kind: 'source_event_missing',
        ref: e,
        detail: `source_event '${e}' is not in the principle source-event whitelist.`,
      });
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    counts: {
      toolsChecked: (validates.tools || []).length,
      nodeKindsChecked: (validates.nodeKinds || []).length,
      edgeKindsChecked: (validates.edgeKinds || []).length,
      sourceEventsChecked: (validates.sourceEvents || []).length,
    },
  };
}
