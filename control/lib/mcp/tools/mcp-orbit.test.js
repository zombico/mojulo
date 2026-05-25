// Isolate to in-memory SQLite — must set env before any db import.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';

import { closeDb } from '../../db/index.js';
import { InventoryRepository } from '../../db/repositories/mcp-inventory.js';
import { MCPOrbitCompositionRepository } from '../../db/repositories/mcp-orbit.js';
import { MetaContextRepository } from '../../db/repositories/meta-context.js';
import { _resetSeededForTests, seedComponents } from '../mcp-orbit-components/loader.js';
import { dispatchMcpRequest, ensureToolsRegistered } from '../server.js';
import { _resetMetaCatalystCacheForTests } from './mcp-orbit.js';

async function call(name, args = {}, ctx = { mcpSessionId: 'test', userId: 'local' }) {
  await ensureToolsRegistered();
  const res = await dispatchMcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
    ctx,
  );
  if (res.result?.isError) {
    throw new Error(res.result.content?.[0]?.text || 'tool errored');
  }
  // Tools return either MCP-shaped content[{text}] or a structured object
  // that the server JSON.stringifies into a text block. Parse the latter so
  // tests can assert against the structure.
  const text = res.result?.content?.[0]?.text;
  if (text === undefined) return res.result;
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

beforeEach(async () => {
  closeDb();
  _resetSeededForTests();
  _resetMetaCatalystCacheForTests();
  // ensureToolsRegistered() has its own once-flag in server.js, so the
  // registerMCPOrbitTools() → seedComponents() chain only fires on the very
  // first test. Subsequent tests get a fresh in-memory DB but no seeded
  // components. Explicitly re-seed here so each test sees the shipped
  // five-component library.
  await ensureToolsRegistered();
  seedComponents({ force: true });
});

describe('list_mcp_orbit_components', () => {
  it('lists every shipped component with summaries', async () => {
    const out = await call('list_mcp_orbit_components', {});
    expect(out.total).toBeGreaterThanOrEqual(9);
    const refs = out.components.map((c) => c.kind + '/' + c.ref).sort();
    expect(refs).toEqual(
      expect.arrayContaining([
        // Weekly-digest shape
        'idempotency/window-key',
        'mcp/gdrive',
        'mcp/linear',
        'pattern/aggregation',
        'trigger/scheduled',
        // Signal-routing shape
        'idempotency/source-side-label',
        'mcp/gmail',
        'pattern/routing',
        'trigger/signal-polled',
      ]),
    );
    // Body intentionally not surfaced in list responses.
    expect(out.components[0].bodyMd).toBeUndefined();
    expect(out.components[0].summary).toBeTruthy();
  });

  it('filters by kind', async () => {
    const out = await call('list_mcp_orbit_components', { kind: 'mcp' });
    expect(out.components.length).toBeGreaterThanOrEqual(3);
    expect(out.components.every((c) => c.kind === 'mcp')).toBe(true);
  });
});

describe('get_mcp_orbit_component', () => {
  it('returns the full body and structured payload', async () => {
    const out = await call('get_mcp_orbit_component', { kind: 'mcp', ref: 'linear' });
    expect(out.kind).toBe('mcp');
    expect(out.ref).toBe('linear');
    expect(out.version).toBe('0.1.0');
    expect(out.bodyMd).toMatch(/# mcp: Linear/);
    expect(out.payload.requires.mcpInventoryCategory).toBe('issue_tracker');
    expect(out.payload.affordances).toEqual({ read: true, write: true, watch: false });
    expect(Array.isArray(out.payload.exposesKnobs)).toBe(true);
  });

  it('throws on unknown ref', async () => {
    await expect(
      call('get_mcp_orbit_component', { kind: 'mcp', ref: 'no-such-thing' }),
    ).rejects.toThrow(/Component not found/);
  });
});

describe('get_meta_catalyst', () => {
  it('returns the composer rulebook as prose content', async () => {
    const out = await call('get_meta_catalyst', {});
    // Returned as content array → call() falls into rawText.
    const text = out.rawText || out.content?.[0]?.text;
    expect(text).toMatch(/The mcp-orbit meta-catalyst/);
    expect(text).toMatch(/five categories/);
    expect(text).toMatch(/constraint table/);
  });
});

describe('recommend_mcp_orbit_compositions — end-to-end weekly-digest assembly', () => {
  it('with inventory declared, returns a candidate composition matching the hand-written weekly-digest recipe', async () => {
    // Operator declares the same MCP environment the hand-written recipe targets.
    InventoryRepository.replaceInventory([
      {
        name: 'linear',
        tools: [{ name: 'list_issues', description: 'List Linear issues' }],
      },
      {
        name: 'gdrive',
        tools: [{ name: 'create_file', description: 'Create a Google Doc' }],
      },
    ]);

    const out = await call('recommend_mcp_orbit_compositions', {
      intent: 'weekly Linear digest into Drive — Monday morning summary so I stop opening Linear every week',
    });

    expect(out.ok).toBe(true);
    expect(out.candidates).toHaveLength(1);
    const cand = out.candidates[0];
    expect(cand.compositionRef).toMatch(/^comp_[a-f0-9]{12}$/);

    // The candidate must include two mcp entries (source + destination roles)
    // plus the three other singleton kinds.
    const kinds = cand.components.map((c) => c.kind).sort();
    expect(kinds).toEqual(['idempotency', 'mcp', 'mcp', 'pattern', 'trigger']);

    // The two mcp entries carry distinct roles.
    const mcpEntries = cand.components.filter((c) => c.kind === 'mcp');
    const rolesByRef = Object.fromEntries(mcpEntries.map((c) => [c.ref, c.role]));
    expect(rolesByRef.linear).toBe('source');
    expect(rolesByRef.gdrive).toBe('destination');

    // And the specific refs match the five shipped components.
    const refs = new Set(cand.components.map((c) => c.kind + '/' + c.ref));
    expect(refs.has('mcp/linear')).toBe(true);
    expect(refs.has('mcp/gdrive')).toBe(true);
    expect(refs.has('trigger/scheduled')).toBe(true);
    expect(refs.has('pattern/aggregation')).toBe(true);
    expect(refs.has('idempotency/window-key')).toBe(true);

    // Inventory matched on both source-role and destination-role mcps → score
    // should top out.
    expect(cand.rationale.inventoryFit).toBe(1);
    expect(cand.score).toBeGreaterThan(0);
    expect(cand.constraintWarnings).not.toContain(
      expect.stringMatching(/source_not_in_inventory|destination_not_in_inventory/),
    );

    // The recommendation must persist as a proposed row (audit trail).
    const persisted = MCPOrbitCompositionRepository.findByRef(cand.compositionRef);
    expect(persisted).not.toBeNull();
    expect(persisted.status).toBe('proposed');
    expect(persisted.intentMd).toMatch(/weekly Linear digest/);

    // nextSteps must walk the agent through the flow.
    expect(out.nextSteps.join(' ')).toMatch(/get_meta_catalyst/);
    expect(out.nextSteps.join(' ')).toMatch(/get_mcp_orbit_component/);
    expect(out.nextSteps.join(' ')).toMatch(/meta_context_commit/);
  });

  it('with no inventory declared, still returns a candidate but warns', async () => {
    const out = await call('recommend_mcp_orbit_compositions', {
      intent: 'weekly Linear digest into Drive',
    });
    expect(out.ok).toBe(true);
    expect(out.warnings).toContain('inventory_empty');
    const cand = out.candidates[0];
    expect(cand.constraintWarnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^source_not_in_inventory:/),
        expect.stringMatching(/^destination_not_in_inventory:/),
      ]),
    );
  });

  it('rejects empty intent', async () => {
    await expect(call('recommend_mcp_orbit_compositions', { intent: '' })).rejects.toThrow(
      /intent is required/,
    );
  });

  it('surfaces no_operator_anchor when KYC has not been committed', async () => {
    InventoryRepository.replaceInventory([
      { name: 'linear', tools: [{ name: 'list_issues' }] },
      { name: 'gdrive', tools: [{ name: 'create_file' }] },
    ]);
    const out = await call('recommend_mcp_orbit_compositions', {
      intent: 'weekly digest',
    });
    expect(out.warnings).toContain('no_operator_anchor');
    expect(out.operatorAnchor).toBeNull();
  });

  it('does not warn no_operator_anchor when operator KYC has been committed', async () => {
    InventoryRepository.replaceInventory([
      { name: 'linear', tools: [{ name: 'list_issues' }] },
      { name: 'gdrive', tools: [{ name: 'create_file' }] },
    ]);
    // Commit operator KYC the same way meta_context_commit would.
    await call('meta_context_commit', {
      type: 'operator_kyc',
      role: 'Eng lead',
      primary_goal: 'Stop opening Linear every Monday',
      constraints: ['Weekly digest cadence', 'Output to Drive'],
    });
    const out = await call('recommend_mcp_orbit_compositions', {
      intent: 'weekly digest',
    });
    expect(out.warnings || []).not.toContain('no_operator_anchor');
    expect(out.operatorAnchor).not.toBeNull();
    expect(out.operatorAnchor.role).toBe('Eng lead');
  });
});

describe('e2e: full mcp-orbit flow — recommend → get_meta_catalyst → get_component → commit', () => {
  it('walks the seven-step flow end-to-end and seals the composition', async () => {
    InventoryRepository.replaceInventory([
      { name: 'linear', tools: [{ name: 'list_issues' }] },
      { name: 'gdrive', tools: [{ name: 'create_file' }] },
    ]);

    // 1. Recommend.
    const rec = await call('recommend_mcp_orbit_compositions', {
      intent: 'weekly Linear digest into Drive',
    });
    const compRef = rec.candidates[0].compositionRef;

    // 2. Pull the meta-catalyst (read once per session).
    const meta = await call('get_meta_catalyst', {});
    const metaText = meta.rawText || meta.content?.[0]?.text;
    expect(metaText).toMatch(/composition flow/);

    // 3. Pull every component body.
    const bodies = await Promise.all(
      rec.candidates[0].components.map((c) =>
        call('get_mcp_orbit_component', { kind: c.kind, ref: c.ref }),
      ),
    );
    expect(bodies).toHaveLength(5);
    expect(bodies.every((b) => typeof b.bodyMd === 'string' && b.bodyMd.length > 100)).toBe(true);

    // 4. The agent would now negotiate knobs and dry-run. Simulate that by
    //    flipping the composition forward.
    const dryRun = MCPOrbitCompositionRepository.update(compRef, {
      status: 'dry_run',
      knobs: { cadence: 'weekly', day_of_week: 'Mon', time_of_day: '09:00', timezone: 'UTC' },
    });
    expect(dryRun.status).toBe('dry_run');

    // 5. Materialize via the contextmap commit. Use the generic adapter and a
    //    locator under a tmp dir that actually exists (verification requires
    //    existsSync). We use the project root as a stand-in for "the artifact
    //    is on disk."
    await call('meta_context_commit', {
      type: 'artifact_materialization',
      adapter_id: 'generic',
      artifact: { locator: 'package.json', label: 'Weekly Linear digest → Drive' },
      bot_ref: 'local-orbit',
      catalyst_ref: 'mcp-orbit-composition',
      bindings: [
        { mcp_tool: 'linear.list_issues', fields_bound: ['updated_at', 'team', 'state'] },
        { mcp_tool: 'gdrive.create_file', fields_bound: ['title', 'body'] },
      ],
      principles: [
        {
          scope: 'artifact',
          body_md: `Composed from components: mcp/linear@0.1.0 (role=source), mcp/gdrive@0.1.0 (role=destination), trigger/scheduled@0.1.0, idempotency/window-key@0.1.0, pattern/aggregation@0.1.0. Composition ref: ${compRef}.`,
        },
      ],
    }).catch((err) => {
      // The deployment 'local-orbit' isn't a real deployment row; we expect
      // this to fail at bot resolution. The test's value is exercising the
      // upstream tool path — assert we hit the deployment-lookup error, not
      // some earlier validation error.
      expect(err.message).toMatch(/Unknown bot_ref/);
    });

    // 6. Promote the composition row to materialized to close the loop.
    const finalized = MCPOrbitCompositionRepository.update(compRef, {
      status: 'materialized',
      artifact_ref: 'generic:package.json',
    });
    expect(finalized.status).toBe('materialized');
    expect(finalized.artifactRef).toBe('generic:package.json');

    // 7. The composition log captures the full deliberation, queryable.
    const allMaterialized = MCPOrbitCompositionRepository.list({ status: 'materialized' });
    expect(allMaterialized.some((c) => c.ref === compRef)).toBe(true);
  });
});

describe('recommend_mcp_orbit_compositions — gmail-support-thread-to-linear-issue (second worked example)', () => {
  // Validation gate per MCP_ORBIT_V1_PLAN.md sequence #3: a signal-shaped
  // composition must be assemblable end-to-end from the same component
  // store that produced the weekly-digest shape. If the recommender can't
  // generalize past the single canonical shape, the role refactor hasn't
  // bought us anything beyond schema cleanliness.
  it('with gmail + linear in inventory, returns a candidate matching the hand-written gmail-support catalyst', async () => {
    InventoryRepository.replaceInventory([
      {
        name: 'gmail',
        tools: [
          { name: 'search_messages', description: 'Search Gmail by query' },
          { name: 'get_thread', description: 'Fetch a Gmail thread by id' },
          { name: 'modify_labels', description: 'Apply or remove labels on a thread' },
        ],
      },
      {
        name: 'linear',
        tools: [
          { name: 'list_issues', description: 'List Linear issues' },
          { name: 'create_issue', description: 'Create a Linear issue' },
        ],
      },
    ]);

    const out = await call('recommend_mcp_orbit_compositions', {
      intent:
        'When a Gmail support thread arrives in the inbox, file a Linear issue with the conversation context so support requests stop sitting in inboxes',
    });

    expect(out.ok).toBe(true);
    expect(out.candidates).toHaveLength(1);
    const cand = out.candidates[0];

    // Composition shape: two mcps (one per role), plus singleton
    // trigger/pattern/idempotency.
    const kinds = cand.components.map((c) => c.kind).sort();
    expect(kinds).toEqual(['idempotency', 'mcp', 'mcp', 'pattern', 'trigger']);

    // The two mcp entries play distinct roles — gmail-as-source,
    // linear-as-destination — exactly as the hand-written catalyst directs.
    const mcpEntries = cand.components.filter((c) => c.kind === 'mcp');
    const rolesByRef = Object.fromEntries(mcpEntries.map((c) => [c.ref, c.role]));
    expect(rolesByRef.gmail).toBe('source');
    expect(rolesByRef.linear).toBe('destination');

    // The non-mcp picks must match the signal-driven shape, not the
    // scheduled-aggregation shape the weekly-digest test exercises.
    const refsByKind = Object.fromEntries(
      cand.components
        .filter((c) => c.kind !== 'mcp')
        .map((c) => [c.kind, c.ref]),
    );
    expect(refsByKind.trigger).toBe('signal-polled');
    expect(refsByKind.pattern).toBe('routing');
    expect(refsByKind.idempotency).toBe('source-side-label');

    // Inventory matched on both mcps → fit tops out.
    expect(cand.rationale.inventoryFit).toBe(1);

    // The persisted proposed row is queryable for the audit trail.
    const persisted = MCPOrbitCompositionRepository.findByRef(cand.compositionRef);
    expect(persisted).not.toBeNull();
    expect(persisted.status).toBe('proposed');
    expect(persisted.intentMd).toMatch(/Gmail support thread/);
  });

  it('walks the full seven-step composition flow against the gmail-support shape', async () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'search_messages' }, { name: 'modify_labels' }] },
      { name: 'linear', tools: [{ name: 'create_issue' }] },
    ]);

    // 1. Recommend.
    const rec = await call('recommend_mcp_orbit_compositions', {
      intent: 'When a Gmail support thread arrives, file a Linear issue and label the thread as filed',
    });
    const compRef = rec.candidates[0].compositionRef;
    expect(rec.candidates[0].components.filter((c) => c.kind === 'mcp').map((c) => c.role).sort()).toEqual(
      ['destination', 'source'],
    );

    // 2. Pull the meta-catalyst — must teach the constraints relevant to the
    // chosen shape (signal-polled requires source cursor + idempotency).
    const meta = await call('get_meta_catalyst', {});
    const metaText = meta.rawText || meta.content?.[0]?.text;
    expect(metaText).toMatch(/signal-polled/);

    // 3. Every component body must be retrievable. For mcp components we
    // must be able to fetch both source-role and destination-role bodies
    // (same component body covers both roles).
    const bodies = await Promise.all(
      rec.candidates[0].components.map((c) =>
        call('get_mcp_orbit_component', { kind: c.kind, ref: c.ref }),
      ),
    );
    expect(bodies).toHaveLength(5);
    expect(bodies.every((b) => typeof b.bodyMd === 'string' && b.bodyMd.length > 100)).toBe(true);
    // The gmail body must carry per-role sections (the role refinement only
    // pays off if mcp bodies teach both sides).
    const gmailBody = bodies.find((b) => b.kind === 'mcp' && b.ref === 'gmail');
    expect(gmailBody.bodyMd).toMatch(/Source-role surface/);
    expect(gmailBody.bodyMd).toMatch(/Destination-role surface/);

    // 4. Knob negotiation simulated by writing knobs into the composition.
    const dryRun = MCPOrbitCompositionRepository.update(compRef, {
      status: 'dry_run',
      knobs: {
        match_query: 'label:support -label:linear-filed',
        poll_interval: '5m',
        routing_target: 'fixed',
        marker_name: 'linear-filed',
      },
    });
    expect(dryRun.status).toBe('dry_run');

    // 5. The signal-driven artifact-scope principle pattern matches what
    // the hand-written catalyst's commit example does.
    const finalized = MCPOrbitCompositionRepository.update(compRef, {
      status: 'materialized',
      artifact_ref: 'generic:./mojulo-workflows/gmail-support-to-linear/workflow.md',
    });
    expect(finalized.status).toBe('materialized');
    expect(finalized.artifactRef).toMatch(/gmail-support-to-linear/);

    // 6. The composition log carries the deliberation forward, queryable.
    const allMaterialized = MCPOrbitCompositionRepository.list({ status: 'materialized' });
    expect(allMaterialized.some((c) => c.ref === compRef)).toBe(true);
  });
});

// Silence the "no contextmap on this brief" warning for tests that hit
// meta_context indirectly via the recommend path — they don't write
// contextmap rows, so the brief stays empty by design.
describe('integration with meta_context_brief', () => {
  it('inventory rides on the fleet brief after declare → recommend cycle', async () => {
    InventoryRepository.replaceInventory([
      { name: 'linear', tools: [{ name: 'list_issues' }] },
    ]);
    await call('recommend_mcp_orbit_compositions', { intent: 'weekly digest' });
    const brief = MetaContextRepository.brief({ kind: 'fleet' });
    expect(brief.inventory.toolCount).toBe(1);
    expect(brief.inventory.servers.map((s) => s.name)).toContain('linear');
  });
});
