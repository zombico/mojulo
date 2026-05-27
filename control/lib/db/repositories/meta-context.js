/**
 * meta_context repository — three-table contextmap (nodes, edges, principles).
 *
 * Records the *why* behind structural decisions: which catalyst was materialized
 * into which artifact via which host adapter for which bot, what the operator's
 * locked-in constraints are, what mapping decisions specific bindings encode.
 *
 * Writes happen only at structural events (operator KYC, artifact
 * materialization) — never at outcome events (conversation occurred, automation
 * fired). That asymmetry is what makes the layer auditable: outcomes happen at
 * run-rate, structural decisions at deliberation-rate.
 *
 * The methods below are SYNCHRONOUS, unlike sibling repositories (deployments,
 * documents, etc. which are async-by-convention). better-sqlite3 is inherently
 * synchronous, and the Ring 6 tools call these methods inside a single
 * transaction via MetaContextRepository.commit(fn) — async coloring there would
 * break the transaction boundary, since better-sqlite3's db.transaction(fn)
 * requires fn to be sync.
 *
 * See lite-template/integration/META_CONTEXT_PLAN_v3.md for the design.
 */

import { getDb } from '../index.js';
import { InventoryRepository } from './mcp-inventory.js';
import { ProvidersRepository } from './mcp-providers.js';
import { CapabilitiesRepository } from './mcp-capabilities.js';

const NODE_KINDS = ['bot', 'mcp_tool', 'catalyst', 'adapter', 'artifact', 'operator'];
const EDGE_KINDS = ['binds', 'seeded', 'materialized_by', 'runs_for'];
const PRINCIPLE_SOURCE_EVENTS = [
  'artifact_materialization',
  'primitive_artifact_materialization',
  'app_materialization',
  'app_inference',
  'operator_kyc',
  'operator_workspace_setup',
  'adapter_shipped',
  'catalyst_shipped',
  'tool_added',
];

const BRIEF_NODE_CAP = 500;

function rowToNode(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    ref: row.ref,
    label: row.label,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    createdAt: row.created_at,
  };
}

function rowToEdge(row) {
  if (!row) return null;
  return {
    id: row.id,
    srcId: row.src_id,
    dstId: row.dst_id,
    kind: row.kind,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    createdAt: row.created_at,
  };
}

function rowToPrinciple(row) {
  if (!row) return null;
  return {
    id: row.id,
    scopeKind: row.scope_kind,
    scopeId: row.scope_id,
    bodyMd: row.body_md,
    sourceEvent: row.source_event,
    createdAt: row.created_at,
  };
}

function assertNodeKind(kind) {
  if (!NODE_KINDS.includes(kind)) {
    throw new Error(`Invalid node kind '${kind}' (expected one of: ${NODE_KINDS.join(', ')})`);
  }
}

function assertEdgeKind(kind) {
  if (!EDGE_KINDS.includes(kind)) {
    throw new Error(`Invalid edge kind '${kind}' (expected one of: ${EDGE_KINDS.join(', ')})`);
  }
}

function assertSourceEvent(event) {
  if (!PRINCIPLE_SOURCE_EVENTS.includes(event)) {
    throw new Error(
      `Invalid principle source_event '${event}' (expected one of: ${PRINCIPLE_SOURCE_EVENTS.join(', ')})`,
    );
  }
}

export const MetaNodeRepository = {
  /**
   * Upsert a node by (kind, ref). On conflict, updates label and payload so a
   * label rename (e.g. a bot rebrand) propagates without a separate update
   * path. `ref` must be a non-empty string — operator nodes use ref='self'.
   */
  upsert({ kind, ref, label, payload }) {
    assertNodeKind(kind);
    if (!ref || typeof ref !== 'string') {
      throw new Error('node.ref must be a non-empty string');
    }
    if (!label || typeof label !== 'string') {
      throw new Error('node.label must be a non-empty string');
    }
    const db = getDb();
    const payloadJson = payload === undefined || payload === null ? null : JSON.stringify(payload);
    db.prepare(
      `INSERT INTO meta_nodes (kind, ref, label, payload_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(kind, ref) DO UPDATE SET
         label = excluded.label,
         payload_json = excluded.payload_json`,
    ).run(kind, ref, label, payloadJson);
    return this.findByRef(kind, ref);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM meta_nodes WHERE id = ?').get(id);
    return rowToNode(row);
  },

  findByRef(kind, ref) {
    assertNodeKind(kind);
    const db = getDb();
    const row = db.prepare('SELECT * FROM meta_nodes WHERE kind = ? AND ref = ?').get(kind, ref);
    return rowToNode(row);
  },

  listByKind(kind) {
    assertNodeKind(kind);
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM meta_nodes WHERE kind = ? ORDER BY created_at ASC')
      .all(kind);
    return rows.map(rowToNode);
  },
};

export const MetaEdgeRepository = {
  /**
   * Upsert an edge by (src_id, dst_id, kind). Idempotent — second commit of
   * the same structural relationship is a no-op on the edge row, principles
   * attached afterward still stack. Payload is overwritten on conflict so a
   * binding's `fields_bound` list can evolve as a catalyst is re-materialized.
   */
  upsert({ src_id, dst_id, kind, payload }) {
    assertEdgeKind(kind);
    if (!Number.isInteger(src_id) || !Number.isInteger(dst_id)) {
      throw new Error('edge.src_id and edge.dst_id must be integer node ids');
    }
    const db = getDb();
    const payloadJson = payload === undefined || payload === null ? null : JSON.stringify(payload);
    db.prepare(
      `INSERT INTO meta_edges (src_id, dst_id, kind, payload_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(src_id, dst_id, kind) DO UPDATE SET
         payload_json = excluded.payload_json`,
    ).run(src_id, dst_id, kind, payloadJson);
    const row = db
      .prepare('SELECT * FROM meta_edges WHERE src_id = ? AND dst_id = ? AND kind = ?')
      .get(src_id, dst_id, kind);
    return rowToEdge(row);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM meta_edges WHERE id = ?').get(id);
    return rowToEdge(row);
  },

  /** All edges where the node is on either end. Used by brief()'s 1-hop walk. */
  listForNode(nodeId) {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM meta_edges WHERE src_id = ? OR dst_id = ? ORDER BY created_at ASC')
      .all(nodeId, nodeId);
    return rows.map(rowToEdge);
  },
};

export const MetaPrincipleRepository = {
  insert({ scope_kind, scope_id, body_md, source_event }) {
    if (scope_kind !== 'node' && scope_kind !== 'edge') {
      throw new Error(`Invalid principle scope_kind '${scope_kind}' (expected 'node' or 'edge')`);
    }
    if (!Number.isInteger(scope_id)) {
      throw new Error('principle.scope_id must be an integer');
    }
    if (!body_md || typeof body_md !== 'string') {
      throw new Error('principle.body_md must be a non-empty string');
    }
    assertSourceEvent(source_event);
    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO meta_principles (scope_kind, scope_id, body_md, source_event)
         VALUES (?, ?, ?, ?)`,
      )
      .run(scope_kind, scope_id, body_md, source_event);
    const row = db.prepare('SELECT * FROM meta_principles WHERE id = ?').get(result.lastInsertRowid);
    return rowToPrinciple(row);
  },

  /** Most-recent-first so display layers can show "latest wins" without re-sorting. */
  listForScope(scope_kind, scope_id) {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM meta_principles
         WHERE scope_kind = ? AND scope_id = ?
         ORDER BY created_at DESC, id DESC`,
      )
      .all(scope_kind, scope_id);
    return rows.map(rowToPrinciple);
  },
};

function principlesForNodes(nodeIds) {
  if (nodeIds.length === 0) return [];
  const db = getDb();
  const placeholders = nodeIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM meta_principles
       WHERE scope_kind = 'node' AND scope_id IN (${placeholders})
       ORDER BY created_at DESC, id DESC`,
    )
    .all(...nodeIds);
  return rows.map(rowToPrinciple);
}

function principlesForEdges(edgeIds) {
  if (edgeIds.length === 0) return [];
  const db = getDb();
  const placeholders = edgeIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM meta_principles
       WHERE scope_kind = 'edge' AND scope_id IN (${placeholders})
       ORDER BY created_at DESC, id DESC`,
    )
    .all(...edgeIds);
  return rows.map(rowToPrinciple);
}

function briefFleet() {
  const db = getDb();
  const nodeRows = db
    .prepare('SELECT * FROM meta_nodes ORDER BY created_at ASC LIMIT ?')
    .all(BRIEF_NODE_CAP);
  const nodes = nodeRows.map(rowToNode);
  const nodeIds = nodes.map((n) => n.id);

  let edges = [];
  if (nodeIds.length > 0) {
    const placeholders = nodeIds.map(() => '?').join(',');
    const edgeRows = db
      .prepare(
        `SELECT * FROM meta_edges
         WHERE src_id IN (${placeholders}) AND dst_id IN (${placeholders})
         ORDER BY created_at ASC`,
      )
      .all(...nodeIds, ...nodeIds);
    edges = edgeRows.map(rowToEdge);
  }

  const principles = [
    ...principlesForNodes(nodeIds),
    ...principlesForEdges(edges.map((e) => e.id)),
  ];

  const operatorPresent = nodes.some((n) => n.kind === 'operator');
  const meta = {};
  if (nodes.length === 0) {
    meta.empty = true;
    meta.suggest_kyc = true;
  } else if (!operatorPresent) {
    meta.suggest_kyc = true;
  }
  // Surface the cap if we hit it so callers can detect a clipped result.
  if (nodeRows.length === BRIEF_NODE_CAP) {
    meta.capped = true;
    meta.nodeCap = BRIEF_NODE_CAP;
  }

  // Inventory rides on fleet briefs only — it's a fleet-level fact, not a
  // per-node neighborhood property. Always include the field so callers can
  // distinguish "never declared" (declaredAt: null) from a stale snapshot.
  const inventory = InventoryRepository.currentInventory();

  // Vendor knowledge keyed by provider — one row per logical MCP across both
  // facets (inventory introspection + capabilities research). `provenance`
  // distinguishes build-time seeds (`mojulo://CHANGELOG#...` URL) from
  // agent-research; the agent uses this to decide whether to invoke the
  // research-mcp-vendor catalyst for a refresh.
  const vendorKnowledge = buildVendorKnowledgeSummary();

  return { nodes, edges, principles, meta, inventory, vendorKnowledge };
}

function buildVendorKnowledgeSummary() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const providers = ProvidersRepository.listAll().map((p) => {
    const view = CapabilitiesRepository.consolidatedView(p.providerRef);
    const hasInventory = !!view?.inventory;
    const hasCapabilities = !!view?.capabilities;
    return {
      provider_ref: p.providerRef,
      display_name: p.displayName,
      hasInventory,
      hasCapabilities,
      capabilitiesVersionTag: view?.capabilities?.versionTag ?? null,
      capabilitiesDiscoveredAt: view?.capabilities?.discoveredAt ?? null,
      ageSeconds: view?.capabilities?.discoveredAt
        ? Math.max(0, nowSeconds - view.capabilities.discoveredAt)
        : null,
      capabilitiesProvenance: view?.capabilities?.provenance ?? null,
    };
  });
  return { providers };
}

function briefNeighborhood(kind, ref) {
  const anchor = MetaNodeRepository.findByRef(kind, ref);
  if (!anchor) {
    return {
      nodes: [],
      edges: [],
      principles: [],
      meta: { empty: true, suggest_kyc: !MetaContextRepository.hasOperator() },
    };
  }

  const edges = MetaEdgeRepository.listForNode(anchor.id);
  const neighborIds = new Set();
  for (const e of edges) {
    if (e.srcId !== anchor.id) neighborIds.add(e.srcId);
    if (e.dstId !== anchor.id) neighborIds.add(e.dstId);
  }

  const nodes = [anchor];
  for (const id of neighborIds) {
    const n = MetaNodeRepository.findById(id);
    if (n) nodes.push(n);
  }

  const principles = [
    ...principlesForNodes(nodes.map((n) => n.id)),
    ...principlesForEdges(edges.map((e) => e.id)),
  ];

  return { nodes, edges, principles, meta: {} };
}

export const MetaContextRepository = {
  /**
   * Run fn inside a single transaction. fn must be SYNCHRONOUS — better-sqlite3
   * requires sync work. Use this around any multi-row commit so a partial
   * failure leaves no orphan nodes/edges/principles.
   */
  commit(fn) {
    if (typeof fn !== 'function') throw new Error('commit(fn) requires a function');
    const db = getDb();
    return db.transaction(fn)();
  },

  /**
   * Read the contextmap subgraph + principles for a scope.
   *   - kind='fleet' → entire graph (capped, see BRIEF_NODE_CAP).
   *   - kind∈{bot,catalyst,adapter,artifact} → anchor + 1-hop neighbors.
   *
   * Returns `{ nodes, edges, principles, meta }` where meta carries hints:
   *   - empty: true                  → no nodes at all
   *   - suggest_kyc: true            → operator node missing (set on empty fleet
   *                                    OR when a per-scope brief finds no anchor)
   *   - capped: true, nodeCap: N     → fleet brief truncated at the cap
   */
  brief({ kind, ref } = {}) {
    if (kind === 'fleet') return briefFleet();
    if (!kind) throw new Error("brief() requires { kind } — one of 'fleet', 'bot', 'catalyst', 'adapter', 'artifact'");
    if (kind === 'mcp_tool' || kind === 'operator') {
      throw new Error(`brief() scope kind '${kind}' is not supported; use 'fleet' or a per-scope kind`);
    }
    assertNodeKind(kind);
    if (!ref || typeof ref !== 'string') {
      throw new Error(`brief({ kind: '${kind}' }) requires a ref`);
    }
    return briefNeighborhood(kind, ref);
  },

  /** Sugar for the operator anchor presence check — used by Ring 5 hints. */
  hasOperator() {
    const operator = MetaNodeRepository.findByRef('operator', 'self');
    return operator !== null;
  },

  /** Most-recent operator principle, or null if no operator anchor yet. */
  getOperatorAnchor() {
    const operator = MetaNodeRepository.findByRef('operator', 'self');
    if (!operator) return null;
    const principles = MetaPrincipleRepository.listForScope('node', operator.id);
    return {
      node: operator,
      latestPrinciple: principles[0] || null,
      allPrinciples: principles,
    };
  },

  /**
   * For a catalyst id (ref), return every prior materialization across the
   * fleet: the artifact node, its adapter, the bot it runs for, and the most
   * recent artifact-scope principle (the "why" the agent should re-read
   * before re-materializing).
   *
   * Used by recommend_catalysts to surface overlap vs orthogonality at the
   * moment the agent is considering whether to materialize: 0 priors = net-new
   * pattern; priors on other bots = align-or-diverge decision; priors on the
   * same bot = likely duplicate, confirm intent.
   *
   * Returns [] when the catalyst node doesn't exist (never materialized) or
   * when there are no completed materializations linked to it.
   */
  getMaterializationsForCatalyst(catalystRef) {
    if (!catalystRef || typeof catalystRef !== 'string') return [];
    const catalystNode = MetaNodeRepository.findByRef('catalyst', catalystRef);
    if (!catalystNode) return [];

    const db = getDb();
    // One query: walk catalyst —seeded→ artifact —runs_for→ bot, joining in
    // the materialized_by adapter node along the way. Most-recent first so
    // the agent sees the freshest pattern at the top.
    const rows = db
      .prepare(
        `SELECT
           art.id          AS art_id,
           art.ref         AS art_ref,
           art.label       AS art_label,
           art.payload_json AS art_payload,
           bot.ref         AS bot_ref,
           bot.label       AS bot_label,
           adp.ref         AS adapter_id,
           seeded.created_at AS materialized_at
         FROM meta_edges seeded
         JOIN meta_nodes art       ON art.id = seeded.dst_id
         LEFT JOIN meta_edges runs ON runs.src_id = art.id AND runs.kind = 'runs_for'
         LEFT JOIN meta_nodes bot  ON bot.id = runs.dst_id
         LEFT JOIN meta_edges matby ON matby.src_id = art.id AND matby.kind = 'materialized_by'
         LEFT JOIN meta_nodes adp  ON adp.id = matby.dst_id
         WHERE seeded.src_id = ? AND seeded.kind = 'seeded'
         ORDER BY seeded.created_at DESC, art.id DESC`,
      )
      .all(catalystNode.id);

    return rows.map((row) => {
      const principles = MetaPrincipleRepository.listForScope('node', row.art_id);
      return {
        botRef: row.bot_ref || null,
        botName: row.bot_label || null,
        artifactRef: row.art_ref,
        artifactLabel: row.art_label,
        adapterId: row.adapter_id || null,
        materializedAt: row.materialized_at,
        latestArtifactPrinciple: principles[0]
          ? { id: principles[0].id, bodyMd: principles[0].bodyMd, createdAt: principles[0].createdAt }
          : null,
      };
    });
  },
};

// Test seam — exported so tests can assert against the cap directly.
export const _BRIEF_NODE_CAP_FOR_TESTS = BRIEF_NODE_CAP;
export const _NODE_KINDS_FOR_TESTS = NODE_KINDS;
export const _EDGE_KINDS_FOR_TESTS = EDGE_KINDS;
export const _PRINCIPLE_SOURCE_EVENTS_FOR_TESTS = PRINCIPLE_SOURCE_EVENTS;

// Public schema enums for consumers that need to validate against the
// contextmap's allowed values (e.g. the creation-map manifest validator at
// control/lib/graph/validate.js). These are the same lists asserted at
// write time inside this module.
export const META_NODE_KINDS = NODE_KINDS;
export const META_EDGE_KINDS = EDGE_KINDS;
export const META_PRINCIPLE_SOURCE_EVENTS = PRINCIPLE_SOURCE_EVENTS;
