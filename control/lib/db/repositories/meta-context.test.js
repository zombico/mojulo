// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js, since getDb() is lazy and reads SQLITE_PATH on
// first call. Vitest runs test files in worker isolation, so this env mutation
// doesn't leak to sibling test files.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '../index.js';
import {
  MetaNodeRepository,
  MetaEdgeRepository,
  MetaPrincipleRepository,
  MetaContextRepository,
  _BRIEF_NODE_CAP_FOR_TESTS as BRIEF_NODE_CAP,
} from './meta-context.js';
import { InventoryRepository } from './mcp-inventory.js';

beforeEach(() => {
  // Each test gets a fresh in-memory DB with the full schema applied via init().
  closeDb();
});

describe('schema bootstraps', () => {
  it('creates contextmap tables (and the current-state inventory cache + providers identity layer + capabilities facet) on first getDb()', () => {
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'meta_%'")
      .all()
      .map((r) => r.name)
      .sort();
    expect(tables).toEqual([
      'meta_edges',
      'meta_mcp_capabilities',
      'meta_mcp_inventory',
      'meta_mcp_providers',
      'meta_nodes',
      'meta_principles',
    ]);
  });

  it('creates the documented indexes', () => {
    const db = getDb();
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_meta_%'")
      .all()
      .map((r) => r.name)
      .sort();
    expect(indexes).toEqual([
      'idx_meta_edges_dst',
      'idx_meta_edges_src',
      'idx_meta_mcp_capabilities_by_provider',
      'idx_meta_mcp_capabilities_current',
      'idx_meta_mcp_inventory_provider',
      'idx_meta_mcp_inventory_tool_ref',
      'idx_meta_nodes_kind_ref',
      'idx_meta_principles_scope',
    ]);
  });

  it('enforces the node kind CHECK constraint at the DB layer', () => {
    const db = getDb();
    expect(() =>
      db
        .prepare('INSERT INTO meta_nodes (kind, ref, label) VALUES (?, ?, ?)')
        .run('nonsense', 'x', 'X'),
    ).toThrow(/CHECK constraint failed/);
  });

  it('enforces the edge kind CHECK constraint at the DB layer', () => {
    const db = getDb();
    const node = MetaNodeRepository.upsert({ kind: 'bot', ref: 'b1', label: 'B' });
    expect(() =>
      db
        .prepare('INSERT INTO meta_edges (src_id, dst_id, kind) VALUES (?, ?, ?)')
        .run(node.id, node.id, 'nonsense'),
    ).toThrow(/CHECK constraint failed/);
  });
});

describe('MetaNodeRepository.upsert', () => {
  it('inserts a new node and returns it', () => {
    const node = MetaNodeRepository.upsert({
      kind: 'bot',
      ref: 'dep-1',
      label: 'Front Desk',
      payload: { foo: 'bar' },
    });
    expect(node.id).toBeGreaterThan(0);
    expect(node.kind).toBe('bot');
    expect(node.ref).toBe('dep-1');
    expect(node.label).toBe('Front Desk');
    expect(node.payload).toEqual({ foo: 'bar' });
    expect(node.createdAt).toBeGreaterThan(0);
  });

  it('UNIQUE(kind, ref) → second upsert updates label/payload instead of inserting', () => {
    const a = MetaNodeRepository.upsert({ kind: 'bot', ref: 'dep-1', label: 'Old Name' });
    const b = MetaNodeRepository.upsert({
      kind: 'bot',
      ref: 'dep-1',
      label: 'New Name',
      payload: { changed: true },
    });
    expect(b.id).toBe(a.id);
    expect(b.label).toBe('New Name');
    expect(b.payload).toEqual({ changed: true });
    expect(MetaNodeRepository.listByKind('bot')).toHaveLength(1);
  });

  it('allows nodes with the same ref under different kinds', () => {
    // ref namespace is per-kind — a catalyst and an mcp_tool can both have
    // ref='hubspot' without colliding.
    const catalyst = MetaNodeRepository.upsert({ kind: 'catalyst', ref: 'x', label: 'Catalyst X' });
    const tool = MetaNodeRepository.upsert({ kind: 'mcp_tool', ref: 'x', label: 'Tool X' });
    expect(catalyst.id).not.toBe(tool.id);
  });

  it('rejects missing ref', () => {
    expect(() => MetaNodeRepository.upsert({ kind: 'bot', label: 'B' })).toThrow(/ref/);
  });

  it('rejects missing label', () => {
    expect(() => MetaNodeRepository.upsert({ kind: 'bot', ref: 'b1' })).toThrow(/label/);
  });

  it('rejects unknown kind at the application layer', () => {
    expect(() => MetaNodeRepository.upsert({ kind: 'nope', ref: 'x', label: 'X' })).toThrow(
      /Invalid node kind/,
    );
  });

  it('stores null payload as NULL, round-trips as null', () => {
    const node = MetaNodeRepository.upsert({ kind: 'bot', ref: 'b1', label: 'B' });
    expect(node.payload).toBeNull();
  });
});

describe('MetaEdgeRepository.upsert', () => {
  it('inserts an edge between two nodes', () => {
    const a = MetaNodeRepository.upsert({ kind: 'catalyst', ref: 'c1', label: 'C1' });
    const b = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'a1', label: 'A1' });
    const edge = MetaEdgeRepository.upsert({ src_id: a.id, dst_id: b.id, kind: 'seeded' });
    expect(edge.srcId).toBe(a.id);
    expect(edge.dstId).toBe(b.id);
    expect(edge.kind).toBe('seeded');
  });

  it('is idempotent on (src, dst, kind) — second upsert returns same edge id', () => {
    const a = MetaNodeRepository.upsert({ kind: 'catalyst', ref: 'c1', label: 'C1' });
    const b = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'a1', label: 'A1' });
    const first = MetaEdgeRepository.upsert({ src_id: a.id, dst_id: b.id, kind: 'seeded' });
    const second = MetaEdgeRepository.upsert({ src_id: a.id, dst_id: b.id, kind: 'seeded' });
    expect(second.id).toBe(first.id);
  });

  it('overwrites payload on duplicate insert', () => {
    const a = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'a1', label: 'A1' });
    const b = MetaNodeRepository.upsert({ kind: 'mcp_tool', ref: 't1', label: 'T1' });
    MetaEdgeRepository.upsert({
      src_id: a.id,
      dst_id: b.id,
      kind: 'binds',
      payload: { fields_bound: ['name'] },
    });
    const updated = MetaEdgeRepository.upsert({
      src_id: a.id,
      dst_id: b.id,
      kind: 'binds',
      payload: { fields_bound: ['name', 'email'] },
    });
    expect(updated.payload).toEqual({ fields_bound: ['name', 'email'] });
  });

  it('listForNode returns edges where the node is on either end', () => {
    const a = MetaNodeRepository.upsert({ kind: 'catalyst', ref: 'c1', label: 'C1' });
    const b = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'a1', label: 'A1' });
    const c = MetaNodeRepository.upsert({ kind: 'bot', ref: 'd1', label: 'D1' });
    MetaEdgeRepository.upsert({ src_id: a.id, dst_id: b.id, kind: 'seeded' });
    MetaEdgeRepository.upsert({ src_id: b.id, dst_id: c.id, kind: 'runs_for' });
    expect(MetaEdgeRepository.listForNode(b.id)).toHaveLength(2);
    expect(MetaEdgeRepository.listForNode(a.id)).toHaveLength(1);
  });

  it('rejects non-integer node ids', () => {
    expect(() =>
      MetaEdgeRepository.upsert({ src_id: 'one', dst_id: 2, kind: 'seeded' }),
    ).toThrow(/integer/);
  });

  it('ON DELETE CASCADE — removing a node drops its edges', () => {
    const a = MetaNodeRepository.upsert({ kind: 'catalyst', ref: 'c1', label: 'C1' });
    const b = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'a1', label: 'A1' });
    MetaEdgeRepository.upsert({ src_id: a.id, dst_id: b.id, kind: 'seeded' });
    getDb().prepare('DELETE FROM meta_nodes WHERE id = ?').run(a.id);
    expect(MetaEdgeRepository.listForNode(b.id)).toHaveLength(0);
  });
});

describe('MetaPrincipleRepository', () => {
  it('attaches a principle to a node scope', () => {
    const node = MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    const p = MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: 'Role: agency owner.',
      source_event: 'operator_kyc',
    });
    expect(p.id).toBeGreaterThan(0);
    expect(p.bodyMd).toBe('Role: agency owner.');
  });

  it('attaches a principle to an edge scope', () => {
    const a = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'a1', label: 'A1' });
    const b = MetaNodeRepository.upsert({ kind: 'mcp_tool', ref: 't1', label: 'T1' });
    const e = MetaEdgeRepository.upsert({ src_id: a.id, dst_id: b.id, kind: 'binds' });
    const p = MetaPrincipleRepository.insert({
      scope_kind: 'edge',
      scope_id: e.id,
      body_md: 'Route qualified leads to HubSpot.',
      source_event: 'artifact_materialization',
    });
    expect(p.scopeKind).toBe('edge');
    expect(p.scopeId).toBe(e.id);
  });

  it('stacks multiple principles on the same scope, ordered most-recent-first', () => {
    const node = MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: 'First.',
      source_event: 'operator_kyc',
    });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: 'Second.',
      source_event: 'operator_kyc',
    });
    const list = MetaPrincipleRepository.listForScope('node', node.id);
    expect(list).toHaveLength(2);
    expect(list[0].bodyMd).toBe('Second.');
    expect(list[1].bodyMd).toBe('First.');
  });

  it('rejects invalid scope_kind', () => {
    expect(() =>
      MetaPrincipleRepository.insert({
        scope_kind: 'nope',
        scope_id: 1,
        body_md: 'x',
        source_event: 'operator_kyc',
      }),
    ).toThrow(/scope_kind/);
  });

  it('rejects invalid source_event', () => {
    const node = MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    expect(() =>
      MetaPrincipleRepository.insert({
        scope_kind: 'node',
        scope_id: node.id,
        body_md: 'x',
        source_event: 'made_up',
      }),
    ).toThrow(/source_event/);
  });
});

describe('MetaContextRepository.commit', () => {
  it('runs fn inside a transaction and returns its result', () => {
    const out = MetaContextRepository.commit(() => {
      const node = MetaNodeRepository.upsert({ kind: 'bot', ref: 'b1', label: 'B' });
      return node.id;
    });
    expect(typeof out).toBe('number');
    expect(MetaNodeRepository.findById(out)).not.toBeNull();
  });

  it('rolls back all writes on throw', () => {
    expect(() =>
      MetaContextRepository.commit(() => {
        MetaNodeRepository.upsert({ kind: 'bot', ref: 'b1', label: 'B' });
        throw new Error('boom');
      }),
    ).toThrow(/boom/);
    expect(MetaNodeRepository.findByRef('bot', 'b1')).toBeNull();
  });
});

describe('MetaContextRepository.brief — fleet scope', () => {
  it('empty DB → { meta: { empty: true, suggest_kyc: true } }', () => {
    const brief = MetaContextRepository.brief({ kind: 'fleet' });
    expect(brief.nodes).toEqual([]);
    expect(brief.edges).toEqual([]);
    expect(brief.principles).toEqual([]);
    expect(brief.meta.empty).toBe(true);
    expect(brief.meta.suggest_kyc).toBe(true);
  });

  it('graph without operator → suggest_kyc still true', () => {
    MetaNodeRepository.upsert({ kind: 'bot', ref: 'b1', label: 'B' });
    const brief = MetaContextRepository.brief({ kind: 'fleet' });
    expect(brief.meta.empty).toBeUndefined();
    expect(brief.meta.suggest_kyc).toBe(true);
  });

  it('graph with operator → no suggest_kyc hint', () => {
    MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    const brief = MetaContextRepository.brief({ kind: 'fleet' });
    expect(brief.meta.suggest_kyc).toBeUndefined();
  });

  it('returns nodes, edges, and both node- and edge-scoped principles', () => {
    const bot = MetaNodeRepository.upsert({ kind: 'bot', ref: 'b1', label: 'B' });
    const cat = MetaNodeRepository.upsert({ kind: 'catalyst', ref: 'c1', label: 'C1' });
    const art = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'a1', label: 'A1' });
    const seeded = MetaEdgeRepository.upsert({ src_id: cat.id, dst_id: art.id, kind: 'seeded' });
    const runsFor = MetaEdgeRepository.upsert({ src_id: art.id, dst_id: bot.id, kind: 'runs_for' });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: art.id,
      body_md: 'artifact-level principle',
      source_event: 'artifact_materialization',
    });
    MetaPrincipleRepository.insert({
      scope_kind: 'edge',
      scope_id: seeded.id,
      body_md: 'edge-level principle',
      source_event: 'artifact_materialization',
    });

    const brief = MetaContextRepository.brief({ kind: 'fleet' });
    expect(brief.nodes).toHaveLength(3);
    const edgeIds = brief.edges.map((e) => e.id).sort();
    expect(edgeIds).toEqual([seeded.id, runsFor.id].sort());
    expect(brief.principles).toHaveLength(2);
  });

  it('includes current MCP inventory on fleet briefs (null fields when never declared)', () => {
    const empty = MetaContextRepository.brief({ kind: 'fleet' });
    expect(empty.inventory).toEqual({
      servers: [],
      declaredAt: null,
      ageSeconds: null,
      toolCount: 0,
    });

    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }, { name: 'search_messages' }] },
      { name: 'gdrive', tools: [{ name: 'list_recent_files' }] },
    ]);
    const populated = MetaContextRepository.brief({ kind: 'fleet' });
    expect(populated.inventory.toolCount).toBe(3);
    expect(populated.inventory.declaredAt).toBeGreaterThan(0);
    expect(populated.inventory.servers.map((s) => s.name).sort()).toEqual(['gdrive', 'gmail']);
  });

  it('does NOT include inventory on per-scope briefs (fleet-level fact only)', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    MetaNodeRepository.upsert({ kind: 'bot', ref: 'dep-1', label: 'B' });
    const brief = MetaContextRepository.brief({ kind: 'bot', ref: 'dep-1' });
    expect(brief.inventory).toBeUndefined();
  });

  it('honors BRIEF_NODE_CAP and marks the response as capped', () => {
    // Insert exactly the cap to trigger the limit branch.
    for (let i = 0; i < BRIEF_NODE_CAP; i += 1) {
      MetaNodeRepository.upsert({ kind: 'bot', ref: `b${i}`, label: `B${i}` });
    }
    const brief = MetaContextRepository.brief({ kind: 'fleet' });
    expect(brief.nodes).toHaveLength(BRIEF_NODE_CAP);
    expect(brief.meta.capped).toBe(true);
    expect(brief.meta.nodeCap).toBe(BRIEF_NODE_CAP);
  });
});

describe('MetaContextRepository.brief — per-scope (1-hop)', () => {
  it('returns the anchor and its directly-connected neighbors, not the whole graph', () => {
    const bot = MetaNodeRepository.upsert({ kind: 'bot', ref: 'b1', label: 'B' });
    const cat = MetaNodeRepository.upsert({ kind: 'catalyst', ref: 'c1', label: 'C1' });
    const art = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'a1', label: 'A1' });
    // Unconnected — should NOT appear in a brief anchored on bot.
    MetaNodeRepository.upsert({ kind: 'bot', ref: 'b2-orphan', label: 'B2' });

    MetaEdgeRepository.upsert({ src_id: cat.id, dst_id: art.id, kind: 'seeded' });
    MetaEdgeRepository.upsert({ src_id: art.id, dst_id: bot.id, kind: 'runs_for' });

    const brief = MetaContextRepository.brief({ kind: 'bot', ref: 'b1' });
    const nodeRefs = brief.nodes.map((n) => n.ref).sort();
    expect(nodeRefs).toEqual(['a1', 'b1']);
    expect(brief.edges).toHaveLength(1);
  });

  it('unknown ref → empty subgraph with suggest_kyc when operator absent', () => {
    const brief = MetaContextRepository.brief({ kind: 'bot', ref: 'never-existed' });
    expect(brief.nodes).toEqual([]);
    expect(brief.meta.empty).toBe(true);
    expect(brief.meta.suggest_kyc).toBe(true);
  });

  it('unknown ref → empty subgraph WITHOUT suggest_kyc when operator present', () => {
    MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    const brief = MetaContextRepository.brief({ kind: 'bot', ref: 'never-existed' });
    expect(brief.meta.suggest_kyc).toBe(false);
  });

  it('rejects scope kind that is not browsable', () => {
    expect(() => MetaContextRepository.brief({ kind: 'mcp_tool', ref: 'x' })).toThrow(
      /not supported/,
    );
    expect(() => MetaContextRepository.brief({ kind: 'operator', ref: 'self' })).toThrow(
      /not supported/,
    );
  });

  it('rejects missing kind', () => {
    expect(() => MetaContextRepository.brief({})).toThrow(/kind/);
  });

  it('rejects missing ref for per-scope briefs', () => {
    expect(() => MetaContextRepository.brief({ kind: 'bot' })).toThrow(/ref/);
  });
});

describe('MetaContextRepository.getMaterializationsForCatalyst', () => {
  function seedMaterialization({
    catalystRef,
    botRef,
    botName,
    artifactRef,
    artifactLabel,
    adapterRef,
    artifactPrincipleBody,
  }) {
    const cat = MetaNodeRepository.upsert({
      kind: 'catalyst',
      ref: catalystRef,
      label: catalystRef,
    });
    const art = MetaNodeRepository.upsert({
      kind: 'artifact',
      ref: artifactRef,
      label: artifactLabel,
    });
    const bot = MetaNodeRepository.upsert({ kind: 'bot', ref: botRef, label: botName });
    const adp = MetaNodeRepository.upsert({
      kind: 'adapter',
      ref: adapterRef,
      label: adapterRef,
    });
    MetaEdgeRepository.upsert({ src_id: cat.id, dst_id: art.id, kind: 'seeded' });
    MetaEdgeRepository.upsert({ src_id: art.id, dst_id: bot.id, kind: 'runs_for' });
    MetaEdgeRepository.upsert({ src_id: art.id, dst_id: adp.id, kind: 'materialized_by' });
    if (artifactPrincipleBody) {
      MetaPrincipleRepository.insert({
        scope_kind: 'node',
        scope_id: art.id,
        body_md: artifactPrincipleBody,
        source_event: 'artifact_materialization',
      });
    }
    return { catalystNode: cat, artifactNode: art };
  }

  it('returns [] when the catalyst has never been materialized', () => {
    expect(MetaContextRepository.getMaterializationsForCatalyst('never-built')).toEqual([]);
  });

  it('returns [] for nullish / non-string input', () => {
    expect(MetaContextRepository.getMaterializationsForCatalyst('')).toEqual([]);
    expect(MetaContextRepository.getMaterializationsForCatalyst(null)).toEqual([]);
  });

  it('returns one record per materialization with bot, adapter, artifact, latest principle', () => {
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-1',
      botName: 'Dental Front Desk',
      artifactRef: 'claude-code:/skills/dep-1/SKILL.md',
      artifactLabel: 'Qualify Lead — Dental',
      adapterRef: 'claude-code',
      artifactPrincipleBody: 'Route qualified leads to HubSpot.',
    });

    const out = MetaContextRepository.getMaterializationsForCatalyst('qualify-lead-to-crm');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      botRef: 'dep-1',
      botName: 'Dental Front Desk',
      artifactRef: 'claude-code:/skills/dep-1/SKILL.md',
      artifactLabel: 'Qualify Lead — Dental',
      adapterId: 'claude-code',
    });
    expect(out[0].latestArtifactPrinciple.bodyMd).toBe('Route qualified leads to HubSpot.');
  });

  it('orders most-recent-first across multiple materializations of the same catalyst', () => {
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-1',
      botName: 'Bot A',
      artifactRef: 'claude-code:/a/SKILL.md',
      artifactLabel: 'A',
      adapterRef: 'claude-code',
    });
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-2',
      botName: 'Bot B',
      artifactRef: 'codex:auto-b',
      artifactLabel: 'B',
      adapterRef: 'codex',
    });
    const out = MetaContextRepository.getMaterializationsForCatalyst('qualify-lead-to-crm');
    expect(out).toHaveLength(2);
    // Most recent (Bot B) first.
    expect(out[0].botRef).toBe('dep-2');
    expect(out[1].botRef).toBe('dep-1');
  });

  it('returns the MOST RECENT artifact principle when multiple stacked on the same artifact', () => {
    const { artifactNode } = seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-1',
      botName: 'A',
      artifactRef: 'claude-code:/a.md',
      artifactLabel: 'A',
      adapterRef: 'claude-code',
      artifactPrincipleBody: 'first',
    });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: artifactNode.id,
      body_md: 'second',
      source_event: 'artifact_materialization',
    });
    const [rec] = MetaContextRepository.getMaterializationsForCatalyst('qualify-lead-to-crm');
    expect(rec.latestArtifactPrinciple.bodyMd).toBe('second');
  });

  it('only returns materializations for the requested catalyst', () => {
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-1',
      botName: 'A',
      artifactRef: 'claude-code:/a.md',
      artifactLabel: 'A',
      adapterRef: 'claude-code',
    });
    seedMaterialization({
      catalystRef: 'appointment-to-calendar',
      botRef: 'dep-2',
      botName: 'B',
      artifactRef: 'claude-code:/b.md',
      artifactLabel: 'B',
      adapterRef: 'claude-code',
    });
    expect(MetaContextRepository.getMaterializationsForCatalyst('qualify-lead-to-crm')).toHaveLength(1);
    expect(MetaContextRepository.getMaterializationsForCatalyst('appointment-to-calendar')).toHaveLength(1);
  });
});

describe('MetaContextRepository.hasOperator / getOperatorAnchor', () => {
  it('hasOperator → false on empty DB', () => {
    expect(MetaContextRepository.hasOperator()).toBe(false);
    expect(MetaContextRepository.getOperatorAnchor()).toBeNull();
  });

  it('hasOperator → true after upserting the operator singleton', () => {
    MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    expect(MetaContextRepository.hasOperator()).toBe(true);
  });

  it('getOperatorAnchor returns the most recent principle as latestPrinciple', () => {
    const op = MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: op.id,
      body_md: 'old',
      source_event: 'operator_kyc',
    });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: op.id,
      body_md: 'new',
      source_event: 'operator_kyc',
    });
    const anchor = MetaContextRepository.getOperatorAnchor();
    expect(anchor.latestPrinciple.bodyMd).toBe('new');
    expect(anchor.allPrinciples).toHaveLength(2);
  });
});
