// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js (getDb is lazy and reads SQLITE_PATH on first
// call). Vitest workers isolate sibling files so this doesn't leak.
process.env.SQLITE_PATH = ':memory:';
// Short-circuit semantic-index write hooks across this file — the test
// suite covers contextmap structural behavior, not the embedding sidecar.
// Without this flag, every commit handler would await the ONNX model load.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import { DeploymentRepository } from '@/lib/db/repositories/deployments';
import {
  MetaContextRepository,
  MetaNodeRepository,
  MetaEdgeRepository,
  MetaPrincipleRepository,
} from '@/lib/db/repositories/meta-context';
import {
  briefHandler,
  commitHandler,
  commitOperatorKyc,
  commitOperatorWorkspaceSetup,
  commitArtifactMaterialization,
  commitPrimitiveArtifactMaterialization,
  commitAppMaterialization,
} from './meta-context.js';
import { ProviderArtifactRepository } from '@/lib/db/repositories/mcp-orbit-provider-artifacts';

let tmpRoot;
let existingArtifactPath;
const missingArtifactPath = '/tmp/__definitely-not-here__/__nope__.md';

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-meta-context-test-'));
  existingArtifactPath = join(tmpRoot, 'SKILL.md');
  writeFileSync(existingArtifactPath, '# stub');
});

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
});

// Helper: seed a real deployment row so artifact_materialization commits can
// resolve bot_ref via DeploymentRepository.findById.
async function seedDeployment({ id = 'dep-test', botName = 'Test Bot' } = {}) {
  // Insert directly so we can pin the id (DeploymentRepository.create
  // generates its own id via newId('dep')).
  const { getDb } = await import('@/lib/db/index');
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO deployments (id, bot_name, flow_type, status, config, api_key, document_ids, created_at, updated_at)
     VALUES (?, ?, 'modular', 'saved', ?, 'k', '[]', ?, ?)`,
  ).run(id, botName, '{}', now, now);
  return DeploymentRepository.findById(id);
}

// ---------------------------------------------------------------------------
// briefHandler
// ---------------------------------------------------------------------------

describe('briefHandler', () => {
  it('fleet scope on empty graph → meta.suggest_kyc: true', async () => {
    const out = await briefHandler({ scope: { kind: 'fleet' } });
    expect(out.nodes).toEqual([]);
    expect(out.meta.empty).toBe(true);
    expect(out.meta.suggest_kyc).toBe(true);
  });

  it('per-scope brief returns 1-hop neighborhood', async () => {
    const bot = MetaNodeRepository.upsert({ kind: 'bot', ref: 'dep-1', label: 'B' });
    const art = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'cc:foo', label: 'Foo' });
    MetaEdgeRepository.upsert({ src_id: art.id, dst_id: bot.id, kind: 'runs_for' });

    const out = await briefHandler({ scope: { kind: 'bot', ref: 'dep-1' } });
    expect(out.nodes.map((n) => n.ref).sort()).toEqual(['cc:foo', 'dep-1']);
    expect(out.edges).toHaveLength(1);
  });

  it('rejects missing scope', async () => {
    await expect(briefHandler({})).rejects.toThrow(/scope is required/);
  });

  it('rejects unsupported scope.kind', async () => {
    await expect(briefHandler({ scope: { kind: 'mcp_tool', ref: 'x' } })).rejects.toThrow(
      /scope.kind must be one of/,
    );
    await expect(briefHandler({ scope: { kind: 'operator', ref: 'self' } })).rejects.toThrow(
      /scope.kind must be one of/,
    );
  });
});

// ---------------------------------------------------------------------------
// commitHandler — dispatch
// ---------------------------------------------------------------------------

describe('commitHandler — dispatch', () => {
  it('rejects unknown event types', async () => {
    await expect(commitHandler({ type: 'made_up_event' })).rejects.toThrow(
      /Unknown commit event type/,
    );
  });

  it('rejects a non-object input', async () => {
    await expect(commitHandler(null)).rejects.toThrow(/event object/);
    await expect(commitHandler('hello')).rejects.toThrow(/event object/);
  });
});

// ---------------------------------------------------------------------------
// commit: operator_kyc
// ---------------------------------------------------------------------------

describe('commitOperatorKyc', () => {
  it('happy path — creates operator node + principle, returns ids', async () => {
    const out = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'Agency owner serving dental practices',
      primary_goal: 'Convert dental leads to booked appointments',
      constraints: ['CRM is HubSpot', 'Connecting agent is Claude Code'],
    });
    expect(out.ok).toBe(true);
    expect(out.operatorNodeId).toBeGreaterThan(0);
    expect(out.principleId).toBeGreaterThan(0);
    expect(out.revised).toBe(false);

    // Re-brief shows the anchor; suggest_kyc is gone.
    const brief = await briefHandler({ scope: { kind: 'fleet' } });
    expect(brief.meta.suggest_kyc).toBeUndefined();
    expect(brief.nodes.find((n) => n.kind === 'operator')?.ref).toBe('self');
    expect(brief.principles).toHaveLength(1);
    expect(brief.principles[0].bodyMd).toMatch(/Agency owner/);
    expect(brief.principles[0].bodyMd).toMatch(/CRM is HubSpot/);
  });

  it('composes the principle body with role + primary_goal + constraints', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      primary_goal: 'pg',
      constraints: ['c1', 'c2'],
    });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    const [p] = MetaPrincipleRepository.listForScope('node', node.id);
    expect(p.bodyMd).toMatch(/\*\*Role:\*\* r/);
    expect(p.bodyMd).toMatch(/\*\*Primary goal:\*\* pg/);
    expect(p.bodyMd).toMatch(/- c1/);
    expect(p.bodyMd).toMatch(/- c2/);
  });

  it('omits the primary_goal line when not provided', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
    });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    const [p] = MetaPrincipleRepository.listForScope('node', node.id);
    expect(p.bodyMd).not.toMatch(/Primary goal/);
  });

  it('rejects missing role', async () => {
    await expect(
      commitOperatorKyc({ type: 'operator_kyc', constraints: ['x'] }),
    ).rejects.toThrow(/role/);
  });

  it('rejects empty constraints', async () => {
    await expect(
      commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: [] }),
    ).rejects.toThrow(/constraints/);
  });

  it('rejects non-string constraint entries', async () => {
    await expect(
      commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: ['ok', 42] }),
    ).rejects.toThrow(/non-empty string/);
  });

  it('second KYC without revise → soft rejection with existing_operator hint', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'r1', constraints: ['c1'] });
    const out = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r2',
      constraints: ['c2'],
    });
    expect(out.ok).toBe(false);
    expect(out.existing_operator).toBe(true);
    expect(out.reason).toBe('operator_anchor_already_exists');

    // Still only one principle attached.
    const node = MetaNodeRepository.findByRef('operator', 'self');
    expect(MetaPrincipleRepository.listForScope('node', node.id)).toHaveLength(1);
  });

  it('revise: true stacks a new principle on the same operator node', async () => {
    const first = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r1',
      constraints: ['c1'],
    });
    const second = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r2',
      constraints: ['c2'],
      revise: true,
    });
    expect(second.ok).toBe(true);
    expect(second.operatorNodeId).toBe(first.operatorNodeId);
    expect(second.revised).toBe(true);
    expect(MetaPrincipleRepository.listForScope('node', first.operatorNodeId)).toHaveLength(2);

    // Operator label updates to the most recent role.
    const node = MetaNodeRepository.findById(first.operatorNodeId);
    expect(node.label).toBe('r2');
  });

  it('routes through the commit dispatcher correctly', async () => {
    const out = await commitHandler({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
    });
    expect(out.ok).toBe(true);
    expect(out.operatorNodeId).toBeGreaterThan(0);
  });

  // --- register tuning ---
  // See lite-template/integration/REGISTER_TUNING_PLAN.md.

  it('round-trips vocabulary_register + procedural_disclosure onto node payload and into principle body', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'terse',
    });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    expect(node.payload).toEqual({
      vocabulary_register: 'plain',
      procedural_disclosure: 'terse',
    });
    const [p] = MetaPrincipleRepository.listForScope('node', node.id);
    expect(p.bodyMd).toMatch(/Communication preferences/);
    expect(p.bodyMd).toMatch(/vocabulary_register: plain/);
    expect(p.bodyMd).toMatch(/procedural_disclosure: terse/);
  });

  it('omits payload + Communication-preferences block when neither register field is set', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: ['c1'] });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    expect(node.payload).toBeNull();
    const [p] = MetaPrincipleRepository.listForScope('node', node.id);
    expect(p.bodyMd).not.toMatch(/Communication preferences/);
  });

  it('rejects invalid vocabulary_register', async () => {
    await expect(
      commitOperatorKyc({
        type: 'operator_kyc',
        role: 'r',
        constraints: ['c1'],
        vocabulary_register: 'casual',
      }),
    ).rejects.toThrow(/vocabulary_register/);
  });

  it('rejects invalid procedural_disclosure', async () => {
    await expect(
      commitOperatorKyc({
        type: 'operator_kyc',
        role: 'r',
        constraints: ['c1'],
        procedural_disclosure: 'verbose',
      }),
    ).rejects.toThrow(/procedural_disclosure/);
  });

  it('revise without re-specifying register preserves existing payload values', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r1',
      constraints: ['c1'],
      vocabulary_register: 'mojulo',
      procedural_disclosure: 'pedagogical',
    });
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r2',
      constraints: ['c2'],
      revise: true,
    });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    expect(node.payload).toEqual({
      vocabulary_register: 'mojulo',
      procedural_disclosure: 'pedagogical',
    });
  });

  it('revise can update one register axis without resetting the other', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r1',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'reflective',
    });
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r2',
      constraints: ['c2'],
      revise: true,
      procedural_disclosure: 'terse',
    });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    expect(node.payload).toEqual({
      vocabulary_register: 'plain',
      procedural_disclosure: 'terse',
    });
  });
});

// ---------------------------------------------------------------------------
// commit: operator_workspace_setup
// ---------------------------------------------------------------------------

describe('commitOperatorWorkspaceSetup', () => {
  it('returns operator_anchor_missing when no operator node exists yet', async () => {
    const out = await commitOperatorWorkspaceSetup({
      type: 'operator_workspace_setup',
      workspace_root: '/Users/op/workspace',
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('operator_anchor_missing');
  });

  it('happy path — writes a workspace_root principle on the operator node', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'Op',
      constraints: ['c'],
    });
    const out = await commitOperatorWorkspaceSetup({
      type: 'operator_workspace_setup',
      workspace_root: '/Users/op/workspace',
    });
    expect(out.ok).toBe(true);
    expect(out.operatorNodeId).toBeGreaterThan(0);
    expect(out.workspaceRootPrincipleId).toBeGreaterThan(0);
    expect(out.workspaceConventionsPrincipleId).toBeNull();

    const node = MetaNodeRepository.findByRef('operator', 'self');
    const principles = MetaPrincipleRepository.listForScope('node', node.id);
    const setupPrinciples = principles.filter(
      (p) => p.sourceEvent === 'operator_workspace_setup',
    );
    expect(setupPrinciples).toHaveLength(1);
    expect(setupPrinciples[0].bodyMd).toMatch(/Workspace root/);
    expect(setupPrinciples[0].bodyMd).toContain('/Users/op/workspace');
  });

  it('writes a second principle when workspace_conventions is provided', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'Op',
      constraints: ['c'],
    });
    const out = await commitOperatorWorkspaceSetup({
      type: 'operator_workspace_setup',
      workspace_root: '/Users/op/workspace',
      workspace_conventions: 'JSON not binary; dated subdirs.',
    });
    expect(out.workspaceConventionsPrincipleId).toBeGreaterThan(0);

    const node = MetaNodeRepository.findByRef('operator', 'self');
    const principles = MetaPrincipleRepository.listForScope('node', node.id);
    const setupPrinciples = principles.filter(
      (p) => p.sourceEvent === 'operator_workspace_setup',
    );
    expect(setupPrinciples).toHaveLength(2);
    const conventionsPrinciple = setupPrinciples.find((p) =>
      p.bodyMd.includes('Workspace conventions'),
    );
    expect(conventionsPrinciple.bodyMd).toContain('JSON not binary');
  });

  it('is append-only — re-running stacks fresh principles, latest wins for readers', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'Op', constraints: ['c'] });
    await commitOperatorWorkspaceSetup({
      type: 'operator_workspace_setup',
      workspace_root: '/Users/op/workspace-old',
    });
    await commitOperatorWorkspaceSetup({
      type: 'operator_workspace_setup',
      workspace_root: '/Users/op/workspace-new',
    });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    const setupPrinciples = MetaPrincipleRepository.listForScope('node', node.id).filter(
      (p) => p.sourceEvent === 'operator_workspace_setup',
    );
    expect(setupPrinciples).toHaveLength(2);
    // listForScope returns most-recent-first (ORDER BY created_at DESC, id DESC),
    // so [0] is the latest write. Readers that want "the current workspace_root"
    // can take the first principle with source_event='operator_workspace_setup'.
    expect(setupPrinciples[0].bodyMd).toContain('/Users/op/workspace-new');
  });

  it('surfaces the workspace principles through briefHandler against the operator node', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'Op', constraints: ['c'] });
    await commitOperatorWorkspaceSetup({
      type: 'operator_workspace_setup',
      workspace_root: '/Users/op/workspace',
      workspace_conventions: 'dated subdirs',
    });
    const brief = await briefHandler({ scope: { kind: 'fleet' } });
    const setupPrinciples = brief.principles.filter(
      (p) => p.sourceEvent === 'operator_workspace_setup',
    );
    expect(setupPrinciples).toHaveLength(2);
  });

  it('rejects relative workspace_root paths', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'Op', constraints: ['c'] });
    await expect(
      commitOperatorWorkspaceSetup({
        type: 'operator_workspace_setup',
        workspace_root: 'workspace',
      }),
    ).rejects.toThrow(/absolute/);
  });

  it('rejects workspace_root containing .. segments', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'Op', constraints: ['c'] });
    await expect(
      commitOperatorWorkspaceSetup({
        type: 'operator_workspace_setup',
        workspace_root: '/Users/op/../etc',
      }),
    ).rejects.toThrow(/absolute/);
  });

  it('rejects an empty workspace_conventions when the field is present', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'Op', constraints: ['c'] });
    await expect(
      commitOperatorWorkspaceSetup({
        type: 'operator_workspace_setup',
        workspace_root: '/Users/op/workspace',
        workspace_conventions: '   ',
      }),
    ).rejects.toThrow(/workspace_conventions/);
  });

  it('routes via the commitHandler dispatcher', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'Op', constraints: ['c'] });
    const out = await commitHandler({
      type: 'operator_workspace_setup',
      workspace_root: '/Users/op/workspace',
    });
    expect(out.ok).toBe(true);
    expect(out.workspaceRootPrincipleId).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// commit: artifact_materialization
// ---------------------------------------------------------------------------

function buildBaseMaterializationInput(overrides = {}) {
  return {
    type: 'artifact_materialization',
    adapter_id: 'claude-code',
    artifact: {
      locator: existingArtifactPath,
      label: 'Qualify Lead to CRM',
    },
    bot_ref: 'dep-test',
    catalyst_ref: 'qualify-lead-to-crm',
    bindings: [
      { mcp_tool: 'hubspot.create_contact', fields_bound: ['name', 'email', 'phone'] },
    ],
    principles: [
      {
        scope: 'artifact',
        body_md: 'Route qualified leads to HubSpot contacts.',
      },
      {
        scope: 'materialized_by',
        body_md: 'Materialized as Claude Code skill because clientInfo was claude-code.',
      },
    ],
    ...overrides,
  };
}

describe('commitArtifactMaterialization', () => {
  it('happy path — writes bot, adapter, catalyst, artifact, mcp_tool nodes + 4 edges + 2 principles', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Dental Front Desk' });

    const out = await commitArtifactMaterialization(buildBaseMaterializationInput());

    expect(out.ok).toBe(true);
    expect(out.artifactNodeId).toBeGreaterThan(0);
    expect(out.nodes.bot).toBeGreaterThan(0);
    expect(out.nodes.adapter).toBeGreaterThan(0);
    expect(out.nodes.catalyst).toBeGreaterThan(0);
    expect(out.nodes.artifact).toBeGreaterThan(0);
    expect(out.edges.seeded).toBeGreaterThan(0);
    expect(out.edges.materialized_by).toBeGreaterThan(0);
    expect(out.edges.runs_for).toBeGreaterThan(0);
    expect(out.edges.binds).toHaveLength(1);
    expect(out.edges.binds[0].mcp_tool).toBe('hubspot.create_contact');
    expect(out.principlesCreated).toBe(2);
    expect(out.verification.ok).toBe(true);
    expect(out.warnings).toContain('no_operator_anchor');
  });

  it('omits warnings when an operator anchor exists', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: ['c'] });
    const out = await commitArtifactMaterialization(buildBaseMaterializationInput());
    expect(out.warnings).toBeUndefined();
  });

  it('resolves catalyst label from the catalyst loader, falls back to ref', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await commitArtifactMaterialization(buildBaseMaterializationInput());
    const catalystNode = MetaNodeRepository.findByRef('catalyst', 'qualify-lead-to-crm');
    expect(catalystNode.label).not.toBe('qualify-lead-to-crm'); // it has a real name
    expect(catalystNode.label.length).toBeGreaterThan(0);

    // Unknown catalyst id → label falls back to the ref.
    await commitArtifactMaterialization(
      buildBaseMaterializationInput({
        catalyst_ref: 'made-up-catalyst-that-does-not-exist',
        artifact: { locator: existingArtifactPath, label: 'Other' },
      }),
    );
    const fallback = MetaNodeRepository.findByRef('catalyst', 'made-up-catalyst-that-does-not-exist');
    expect(fallback.label).toBe('made-up-catalyst-that-does-not-exist');
  });

  it('stores artifact payload with adapter_id, locator, host', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await commitArtifactMaterialization(buildBaseMaterializationInput());
    const artifactNode = MetaNodeRepository.findByRef(
      'artifact',
      `claude-code:${existingArtifactPath}`,
    );
    expect(artifactNode.payload.adapter_id).toBe('claude-code');
    expect(artifactNode.payload.locator).toBe(existingArtifactPath);
    expect(artifactNode.payload.host).toBeTruthy();
  });

  it('binds edge carries fields_bound in its payload', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitArtifactMaterialization(buildBaseMaterializationInput());
    const edge = MetaEdgeRepository.findById(out.edges.binds[0].edgeId);
    expect(edge.payload).toEqual({ fields_bound: ['name', 'email', 'phone'] });
  });

  it('rejects unknown adapter_id', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({ adapter_id: 'not-a-real-adapter' }),
      ),
    ).rejects.toThrow(/Unknown adapter/);
    // No writes.
    expect(MetaContextRepository.brief({ kind: 'fleet' }).nodes).toHaveLength(0);
  });

  it('rejects missing artifact.locator / label', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({ artifact: { label: 'X' } }),
      ),
    ).rejects.toThrow(/locator/);
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({ artifact: { locator: '/x' } }),
      ),
    ).rejects.toThrow(/label/);
  });

  it('rejects unknown bot_ref', async () => {
    await expect(
      commitArtifactMaterialization(buildBaseMaterializationInput({ bot_ref: 'nope' })),
    ).rejects.toThrow(/Unknown bot_ref/);
    expect(MetaContextRepository.brief({ kind: 'fleet' }).nodes).toHaveLength(0);
  });

  it('rejects when verification fails — no DB writes', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({
          artifact: { locator: missingArtifactPath, label: 'Missing' },
        }),
      ),
    ).rejects.toThrow(/Artifact verification failed/);
    expect(MetaContextRepository.brief({ kind: 'fleet' }).nodes).toHaveLength(0);
  });

  it('codex adapter with opaque locator accepts on assertion, surfaces note in response', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitArtifactMaterialization(
      buildBaseMaterializationInput({
        adapter_id: 'codex',
        artifact: { locator: 'my-codex-automation-handle', label: 'Codex Auto' },
      }),
    );
    expect(out.ok).toBe(true);
    expect(out.verification.note).toBe('codex_accept_on_assertion');
  });

  it('re-committing the same materialization is idempotent on edges, stacks principles', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const first = await commitArtifactMaterialization(buildBaseMaterializationInput());
    const second = await commitArtifactMaterialization(buildBaseMaterializationInput());

    // Same node ids.
    expect(second.nodes.artifact).toBe(first.nodes.artifact);
    expect(second.nodes.catalyst).toBe(first.nodes.catalyst);
    expect(second.edges.seeded).toBe(first.edges.seeded);

    // Two principles per scope now.
    const artifactNode = MetaNodeRepository.findById(first.nodes.artifact);
    expect(MetaPrincipleRepository.listForScope('node', artifactNode.id)).toHaveLength(2);
  });

  it('rejects principle scope with no matching edge/node', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({
          principles: [{ scope: 'binds:never-bound-tool', body_md: 'x' }],
        }),
      ),
    ).rejects.toThrow(/no matching binding/);

    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({
          principles: [{ scope: 'made-up-scope', body_md: 'x' }],
        }),
      ),
    ).rejects.toThrow(/Unknown principle scope/);

    // No writes from the failed commits.
    expect(MetaContextRepository.brief({ kind: 'fleet' }).nodes).toHaveLength(0);
  });

  it("bare 'binds' principle fans out to every binding edge", async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitArtifactMaterialization(
      buildBaseMaterializationInput({
        bindings: [
          { mcp_tool: 'hubspot.create_contact', fields_bound: ['email'] },
          { mcp_tool: 'hubspot.update_contact', fields_bound: ['phone'] },
        ],
        principles: [{ scope: 'binds', body_md: 'Common binding posture.' }],
      }),
    );
    expect(out.principlesCreated).toBe(2);
    for (const { edgeId } of out.edges.binds) {
      expect(MetaPrincipleRepository.listForScope('edge', edgeId)).toHaveLength(1);
    }
  });

  it("binds:<ref> targets a specific binding edge only", async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitArtifactMaterialization(
      buildBaseMaterializationInput({
        bindings: [
          { mcp_tool: 'hubspot.create_contact', fields_bound: ['email'] },
          { mcp_tool: 'hubspot.update_contact', fields_bound: ['phone'] },
        ],
        principles: [
          { scope: 'binds:hubspot.create_contact', body_md: 'Just the create edge.' },
        ],
      }),
    );
    expect(out.principlesCreated).toBe(1);
    const createEdge = out.edges.binds.find((e) => e.mcp_tool === 'hubspot.create_contact');
    const updateEdge = out.edges.binds.find((e) => e.mcp_tool === 'hubspot.update_contact');
    expect(MetaPrincipleRepository.listForScope('edge', createEdge.edgeId)).toHaveLength(1);
    expect(MetaPrincipleRepository.listForScope('edge', updateEdge.edgeId)).toHaveLength(0);
  });

  it('rejects principle missing body_md', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({
          principles: [{ scope: 'artifact' }],
        }),
      ),
    ).rejects.toThrow(/body_md/);
  });

  it('per-bot brief after commit returns the artifact and edges', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Dental Front Desk' });
    await commitArtifactMaterialization(buildBaseMaterializationInput());

    const brief = await briefHandler({ scope: { kind: 'bot', ref: 'dep-test' } });
    expect(brief.nodes.find((n) => n.kind === 'bot')?.label).toBe('Dental Front Desk');
    expect(brief.nodes.find((n) => n.kind === 'artifact')).toBeTruthy();
    expect(brief.edges.find((e) => e.kind === 'runs_for')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// commitHandler routing
// ---------------------------------------------------------------------------

describe('commitHandler — routes artifact_materialization', () => {
  it('end-to-end through the dispatcher', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitHandler(buildBaseMaterializationInput());
    expect(out.ok).toBe(true);
    expect(out.artifactNodeId).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// commit: primitive_artifact_materialization
//
// Sibling to artifact_materialization, no bot / no catalyst. The audit chain
// in the contextmap is built from persisted provider artifacts (the rows
// bind_primitives produces). See MCP_PRIMITIVE_BINDING_PLAN.md.
// ---------------------------------------------------------------------------

function seedProviderArtifact(overrides = {}) {
  return ProviderArtifactRepository.insert({
    primitiveRef: 'document-store@0.1.0',
    role: 'source',
    server: 'claude_ai_Google_Drive',
    introspectedAt: '2026-05-24T18:00:00Z',
    snapshotConfidence: 'tools_list_full',
    bodyMd: '# stub provider body',
    manifest: {
      bound: [
        { affordance: 'list-recent', tool: 'list_recent_files', confidence: 'operator-confirmed' },
        { affordance: 'read-content', tool: 'read_file_content', confidence: 'agent-inferred' },
      ],
      unbound: [{ affordance: 'subscribe-to-changes', support: 'rare' }],
      declaredCount: 5,
    },
    bindings: {
      'list-recent': { tool: 'list_recent_files', confidence: 'operator-confirmed' },
      'read-content': { tool: 'read_file_content', confidence: 'agent-inferred' },
    },
    ...overrides,
  });
}

function buildBasePrimitiveMaterializationInput(overrides = {}) {
  return {
    type: 'primitive_artifact_materialization',
    adapter_id: 'claude-code',
    artifact: {
      locator: existingArtifactPath,
      label: 'Weekly Drive digest',
    },
    composition_intent:
      'Weekly digest of open Linear issues into a Google Drive folder, Monday 9am.',
    provider_artifact_refs: [],
    ...overrides,
  };
}

describe('commitPrimitiveArtifactMaterialization', () => {
  it('happy path — writes adapter + artifact nodes, binds edges, materialized_by edge, auto-summary principle', async () => {
    const pa = seedProviderArtifact();
    const out = await commitPrimitiveArtifactMaterialization(
      buildBasePrimitiveMaterializationInput({ provider_artifact_refs: [pa.ref] }),
    );
    expect(out.ok).toBe(true);
    expect(out.artifactNodeId).toBeGreaterThan(0);
    expect(out.nodes.adapter).toBeGreaterThan(0);
    expect(out.nodes.artifact).toBeGreaterThan(0);
    expect(out.edges.materialized_by).toBeGreaterThan(0);
    expect(out.edges.binds).toHaveLength(2);
    expect(out.edges.binds.map((b) => b.mcp_tool).sort()).toEqual([
      'claude_ai_Google_Drive.list_recent_files',
      'claude_ai_Google_Drive.read_file_content',
    ]);
    expect(out.autoSummaryPrincipleId).toBeGreaterThan(0);
    expect(out.principlesCreated).toBe(1); // auto-summary only, no user principles
    expect(out.warnings).toContain('no_operator_anchor');
  });

  it('auto-summary principle records composition_intent + bindings', async () => {
    const pa = seedProviderArtifact();
    const out = await commitPrimitiveArtifactMaterialization(
      buildBasePrimitiveMaterializationInput({ provider_artifact_refs: [pa.ref] }),
    );
    const principle = MetaPrincipleRepository.listForScope('node', out.nodes.artifact)[0];
    expect(principle).toBeTruthy();
    expect(principle.bodyMd).toContain('Composition intent');
    expect(principle.bodyMd).toContain('Weekly digest of open Linear issues');
    expect(principle.bodyMd).toContain('document-store@0.1.0');
    expect(principle.bodyMd).toContain('claude_ai_Google_Drive');
    expect(principle.bodyMd).toContain('list-recent');
    expect(principle.bodyMd).toContain('list_recent_files');
    expect(principle.bodyMd).toContain('subscribe-to-changes'); // unbound surfaced
    expect(principle.sourceEvent).toBe('primitive_artifact_materialization');
  });

  it('stores artifact payload with composition.intent_md + provider_artifact_refs', async () => {
    const pa = seedProviderArtifact();
    const out = await commitPrimitiveArtifactMaterialization(
      buildBasePrimitiveMaterializationInput({ provider_artifact_refs: [pa.ref] }),
    );
    const artifactNode = MetaNodeRepository.findByRef(
      'artifact',
      `claude-code:${existingArtifactPath}`,
    );
    expect(artifactNode.payload.composition).toBeDefined();
    expect(artifactNode.payload.composition.intent_md).toContain('Weekly digest');
    expect(artifactNode.payload.composition.provider_artifact_refs).toEqual([pa.ref]);
    expect(artifactNode.payload.adapter_id).toBe('claude-code');
    expect(artifactNode.id).toBe(out.nodes.artifact);
  });

  it('binds edge payload includes primitive, role, affordance, confidence, server, provider_artifact_ref', async () => {
    const pa = seedProviderArtifact();
    const out = await commitPrimitiveArtifactMaterialization(
      buildBasePrimitiveMaterializationInput({ provider_artifact_refs: [pa.ref] }),
    );
    const edgeId = out.edges.binds.find(
      (b) => b.mcp_tool === 'claude_ai_Google_Drive.list_recent_files',
    ).edgeId;
    const edge = MetaEdgeRepository.findById(edgeId);
    expect(edge.payload.primitive).toBe('document-store@0.1.0');
    expect(edge.payload.role).toBe('source');
    expect(edge.payload.affordance).toBe('list-recent');
    expect(edge.payload.confidence).toBe('operator-confirmed');
    expect(edge.payload.server).toBe('claude_ai_Google_Drive');
    expect(edge.payload.provider_artifact_ref).toBe(pa.ref);
  });

  it('accepts multiple provider_artifact_refs and creates binds edges for each', async () => {
    const source = seedProviderArtifact(); // document-store/source on Drive
    const dest = seedProviderArtifact({
      primitiveRef: 'structured-record-store@0.1.0',
      role: 'destination',
      server: 'claude_ai_Linear',
      manifest: {
        bound: [
          { affordance: 'create-record', tool: 'create_issue', confidence: 'operator-confirmed' },
        ],
        unbound: [],
        declaredCount: 6,
      },
      bindings: { 'create-record': { tool: 'create_issue', confidence: 'operator-confirmed' } },
    });
    const out = await commitPrimitiveArtifactMaterialization(
      buildBasePrimitiveMaterializationInput({ provider_artifact_refs: [source.ref, dest.ref] }),
    );
    expect(out.edges.binds.map((b) => b.mcp_tool).sort()).toEqual([
      'claude_ai_Google_Drive.list_recent_files',
      'claude_ai_Google_Drive.read_file_content',
      'claude_ai_Linear.create_issue',
    ]);
  });

  it('accepts user-provided principles on artifact / materialized_by / binds scopes', async () => {
    const pa = seedProviderArtifact();
    const out = await commitPrimitiveArtifactMaterialization(
      buildBasePrimitiveMaterializationInput({
        provider_artifact_refs: [pa.ref],
        principles: [
          { scope: 'artifact', body_md: 'Operator approved Monday 9am cadence.' },
          { scope: 'materialized_by', body_md: 'Materialized as a Claude Code skill.' },
          { scope: 'binds', body_md: 'Cursor field is modified_after on Drive.' },
        ],
      }),
    );
    expect(out.principlesCreated).toBe(1 + 4); // auto-summary + 1 artifact + 1 materialized_by + 2 binds-fanned
  });

  it('rejects principle scopes that do not exist in primitive flow (catalyst, bot, seeded, runs_for)', async () => {
    const pa = seedProviderArtifact();
    await expect(
      commitPrimitiveArtifactMaterialization(
        buildBasePrimitiveMaterializationInput({
          provider_artifact_refs: [pa.ref],
          principles: [{ scope: 'catalyst', body_md: 'no catalyst here' }],
        }),
      ),
    ).rejects.toThrow(/no matching/);
    await expect(
      commitPrimitiveArtifactMaterialization(
        buildBasePrimitiveMaterializationInput({
          provider_artifact_refs: [pa.ref],
          principles: [{ scope: 'runs_for', body_md: 'no bot here' }],
        }),
      ),
    ).rejects.toThrow(/no matching/);
  });

  it('rejects unknown provider_artifact_refs', async () => {
    await expect(
      commitPrimitiveArtifactMaterialization(
        buildBasePrimitiveMaterializationInput({ provider_artifact_refs: ['prov_nope'] }),
      ),
    ).rejects.toThrow(/not found/);
  });

  it('rejects missing composition_intent', async () => {
    const pa = seedProviderArtifact();
    await expect(
      commitPrimitiveArtifactMaterialization({
        ...buildBasePrimitiveMaterializationInput({ provider_artifact_refs: [pa.ref] }),
        composition_intent: '',
      }),
    ).rejects.toThrow(/composition_intent is required/);
  });

  it('rejects empty provider_artifact_refs array', async () => {
    await expect(
      commitPrimitiveArtifactMaterialization(buildBasePrimitiveMaterializationInput()),
    ).rejects.toThrow(/non-empty array/);
  });

  it('rejects unknown adapter_id', async () => {
    const pa = seedProviderArtifact();
    await expect(
      commitPrimitiveArtifactMaterialization(
        buildBasePrimitiveMaterializationInput({
          adapter_id: 'no-such-adapter',
          provider_artifact_refs: [pa.ref],
        }),
      ),
    ).rejects.toThrow(/Unknown adapter/);
  });

  it('rejects when adapter-delegated verification fails (artifact locator does not exist)', async () => {
    const pa = seedProviderArtifact();
    await expect(
      commitPrimitiveArtifactMaterialization(
        buildBasePrimitiveMaterializationInput({
          provider_artifact_refs: [pa.ref],
          artifact: { locator: missingArtifactPath, label: 'missing' },
        }),
      ),
    ).rejects.toThrow(/verification failed/);
  });

  it('omits no_operator_anchor warning when operator KYC exists', async () => {
    const pa = seedProviderArtifact();
    await commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: ['c'] });
    const out = await commitPrimitiveArtifactMaterialization(
      buildBasePrimitiveMaterializationInput({ provider_artifact_refs: [pa.ref] }),
    );
    expect(out.warnings).toBeUndefined();
  });
});

describe('commitHandler — routes primitive_artifact_materialization', () => {
  it('end-to-end through the dispatcher', async () => {
    const pa = seedProviderArtifact();
    const out = await commitHandler(
      buildBasePrimitiveMaterializationInput({ provider_artifact_refs: [pa.ref] }),
    );
    expect(out.ok).toBe(true);
    expect(out.artifactNodeId).toBeGreaterThan(0);
    expect(out.autoSummaryPrincipleId).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// commit: app_materialization
//
// App-paradigm spike: generated SPA codebases with their own MCP sidecar.
// No bot, no catalyst. The four bindings live on the artifact node's payload
// (runner / durability / inference / mcp_self) and an auto-summary principle
// captures them for audit + recall. Verification additionally checks for
// <locator>/app-mcp/server.js — apps without a sidecar can't be lifecycled.
// See APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md.
// ---------------------------------------------------------------------------

function buildAppArtifactDir(rootDir, name) {
  const appDir = join(rootDir, name);
  mkdirSync(join(appDir, 'app-mcp'), { recursive: true });
  writeFileSync(join(appDir, 'app-mcp', 'server.js'), '// stub sidecar\n');
  return appDir;
}

function buildBaseAppMaterializationInput(overrides = {}) {
  return {
    type: 'app_materialization',
    adapter_id: 'claude-code',
    app_name: 'image-extractor',
    artifact: {
      locator: overrides.locator || 'overridden-by-test',
      label: 'Image extractor (R1-Inference)',
    },
    bindings: {
      runner: { implementation: 'local' },
      durability: { kind: 'local-fs' },
      inference: { mode: 'agent-routed' },
      mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
    },
    ...overrides,
    // Re-apply overrides that nest deeper than the top level.
    ...(overrides.artifact ? { artifact: overrides.artifact } : {}),
  };
}

describe('commitAppMaterialization', () => {
  let appDir;
  beforeEach(() => {
    closeDb();
    appDir = buildAppArtifactDir(tmpRoot, `app-${Date.now()}-${Math.random()}`);
  });

  it('happy path — writes adapter + artifact nodes, materialized_by edge, auto-summary principle', async () => {
    const out = await commitAppMaterialization(
      buildBaseAppMaterializationInput({
        artifact: { locator: appDir, label: 'Image extractor (R1-Inference)' },
      }),
    );
    expect(out.ok).toBe(true);
    expect(out.artifactNodeId).toBeGreaterThan(0);
    expect(out.nodes.adapter).toBeGreaterThan(0);
    expect(out.nodes.artifact).toBeGreaterThan(0);
    expect(out.edges.materialized_by).toBeGreaterThan(0);
    expect(out.autoSummaryPrincipleId).toBeGreaterThan(0);
    expect(out.principlesCreated).toBe(1); // auto-summary only
    expect(out.warnings).toContain('no_operator_anchor');
  });

  it('artifact node payload carries app_name + all four bindings as structured data', async () => {
    const out = await commitAppMaterialization(
      buildBaseAppMaterializationInput({
        artifact: { locator: appDir, label: 'Image extractor' },
      }),
    );
    const node = MetaNodeRepository.findById(out.nodes.artifact);
    expect(node.payload.app.name).toBe('image-extractor');
    expect(node.payload.app.bindings.runner.implementation).toBe('local');
    expect(node.payload.app.bindings.durability.kind).toBe('local-fs');
    expect(node.payload.app.bindings.inference.mode).toBe('agent-routed');
    expect(node.payload.app.bindings.mcp_self.server_kind).toBe('app');
    expect(node.payload.app.bindings.mcp_self.entrypoint).toBe('app-mcp/server.js');
  });

  it('auto-summary principle renders the four bindings in prose', async () => {
    const out = await commitAppMaterialization(
      buildBaseAppMaterializationInput({
        artifact: { locator: appDir, label: 'Image extractor' },
      }),
    );
    const principle = MetaPrincipleRepository.listForScope('node', out.nodes.artifact)[0];
    expect(principle).toBeTruthy();
    expect(principle.sourceEvent).toBe('app_materialization');
    expect(principle.bodyMd).toContain('**App:** image-extractor');
    expect(principle.bodyMd).toContain('runner');
    expect(principle.bodyMd).toContain('local');
    expect(principle.bodyMd).toContain('durability');
    expect(principle.bodyMd).toContain('local-fs');
    expect(principle.bodyMd).toContain('inference');
    expect(principle.bodyMd).toContain('agent-routed');
    expect(principle.bodyMd).toContain('mcp_self');
  });

  it('attaches user-supplied principles scoped to artifact + adapter + materialized_by', async () => {
    const out = await commitAppMaterialization(
      buildBaseAppMaterializationInput({
        artifact: { locator: appDir, label: 'Image extractor' },
        principles: [
          { scope: 'artifact', body_md: '## Why this app — extract receipt totals' },
          { scope: 'adapter', body_md: '## Hosted on claude-code, no other surface' },
          { scope: 'materialized_by', body_md: '## Materialized via inline scaffold prompt' },
        ],
      }),
    );
    expect(out.principlesCreated).toBe(4); // 1 auto + 3 user
    const artifactPrinciples = MetaPrincipleRepository.listForScope('node', out.nodes.artifact);
    expect(artifactPrinciples).toHaveLength(2); // auto + 1 user
    const adapterPrinciples = MetaPrincipleRepository.listForScope('node', out.nodes.adapter);
    expect(adapterPrinciples).toHaveLength(1);
    const edgePrinciples = MetaPrincipleRepository.listForScope('edge', out.edges.materialized_by);
    expect(edgePrinciples).toHaveLength(1);
  });

  it('rejects principle scope outside the app_materialization allowed set', async () => {
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          artifact: { locator: appDir, label: 'Image extractor' },
          principles: [{ scope: 'catalyst', body_md: 'should fail — no catalyst scope for apps' }],
        }),
      ),
    ).rejects.toThrow(/scope 'catalyst' has no matching node/);
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          artifact: { locator: appDir, label: 'Image extractor' },
          principles: [{ scope: 'binds', body_md: 'should fail — no binds edges for apps' }],
        }),
      ),
    ).rejects.toThrow(/requires at least one binding/);
  });

  it('rejects when artifact locator does not exist (verifyAppArtifact base check fails)', async () => {
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          artifact: { locator: missingArtifactPath, label: 'missing' },
        }),
      ),
    ).rejects.toThrow(/verification failed/);
  });

  it('rejects when artifact dir exists but app-mcp/server.js is missing (the extended scaffold check)', async () => {
    // Create a directory but no scaffold inside.
    const naked = join(tmpRoot, `naked-app-${Date.now()}`);
    mkdirSync(naked, { recursive: true });
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          artifact: { locator: naked, label: 'no sidecar' },
        }),
      ),
    ).rejects.toThrow(/app-mcp scaffold missing/);
  });

  it('rejects unknown adapter_id', async () => {
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          adapter_id: 'no-such-adapter',
          artifact: { locator: appDir, label: 'x' },
        }),
      ),
    ).rejects.toThrow(/Unknown adapter/);
  });

  it('rejects missing app_name', async () => {
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          app_name: '',
          artifact: { locator: appDir, label: 'x' },
        }),
      ),
    ).rejects.toThrow(/app_name is required/);
  });

  it('validates each binding shape — bad runner.implementation', async () => {
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          artifact: { locator: appDir, label: 'x' },
          bindings: {
            runner: { implementation: 'nopey' },
            durability: { kind: 'local-fs' },
            inference: { mode: 'agent-routed' },
            mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
          },
        }),
      ),
    ).rejects.toThrow(/runner\.implementation/);
  });

  it('validates each binding shape — durability=github requires git_url', async () => {
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          artifact: { locator: appDir, label: 'x' },
          bindings: {
            runner: { implementation: 'local' },
            durability: { kind: 'github' },
            inference: { mode: 'agent-routed' },
            mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
          },
        }),
      ),
    ).rejects.toThrow(/git_url/);
  });

  it('validates each binding shape — inference=keyed requires provider', async () => {
    await expect(
      commitAppMaterialization(
        buildBaseAppMaterializationInput({
          artifact: { locator: appDir, label: 'x' },
          bindings: {
            runner: { implementation: 'local' },
            durability: { kind: 'local-fs' },
            inference: { mode: 'keyed' },
            mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
          },
        }),
      ),
    ).rejects.toThrow(/provider/);
  });

  it('omits no_operator_anchor warning when operator KYC exists', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: ['c'] });
    const out = await commitAppMaterialization(
      buildBaseAppMaterializationInput({
        artifact: { locator: appDir, label: 'Image extractor' },
      }),
    );
    expect(out.warnings).toBeUndefined();
  });

  it('brief({kind:"artifact", ref}) returns the app artifact + materialized_by + principles', async () => {
    const out = await commitAppMaterialization(
      buildBaseAppMaterializationInput({
        artifact: { locator: appDir, label: 'Image extractor' },
      }),
    );
    const node = MetaNodeRepository.findById(out.nodes.artifact);
    const result = await briefHandler({ scope: { kind: 'artifact', ref: node.ref } });
    expect(result.nodes.length).toBeGreaterThanOrEqual(2); // artifact + adapter neighbor
    expect(result.edges.some((e) => e.kind === 'materialized_by')).toBe(true);
    expect(result.principles.some((p) => p.sourceEvent === 'app_materialization')).toBe(true);
  });
});

describe('commitHandler — routes app_materialization', () => {
  let appDir;
  beforeEach(() => {
    closeDb();
    appDir = buildAppArtifactDir(tmpRoot, `app-dispatch-${Date.now()}-${Math.random()}`);
  });

  it('end-to-end through the dispatcher', async () => {
    const out = await commitHandler(
      buildBaseAppMaterializationInput({
        artifact: { locator: appDir, label: 'Image extractor' },
      }),
    );
    expect(out.ok).toBe(true);
    expect(out.artifactNodeId).toBeGreaterThan(0);
    expect(out.autoSummaryPrincipleId).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// commit: trigger_artifact_materialization
//
// Seals a binding between a typed composer trigger component and a target
// artifact node. Requires the trigger artifact to already exist (via
// TriggerArtifactRepository.insert from bind_trigger) and to carry an
// artifact_ref pointing at a materialized contextmap node.
// ---------------------------------------------------------------------------

import { commitTriggerArtifactMaterialization } from './meta-context.js';
import { TriggerArtifactRepository } from '@/lib/db/repositories/trigger-artifacts';

function seedArtifactNode({
  ref = 'app:trigger-test-app',
  label = 'Trigger Test App',
} = {}) {
  return MetaNodeRepository.upsert({ kind: 'artifact', ref, label });
}

function seedTrigger({
  componentRef = 'trigger/scheduled@0.1.0',
  bindingParams = { cron: '0 9 * * *', timezone: 'UTC' },
  payloadTemplate = { task_kind: 'envelope_inference', envelope: { inputs: {} } },
  artifactRef = 'app:trigger-test-app',
  compositionRef = null,
} = {}) {
  return TriggerArtifactRepository.insert({
    componentRef,
    bindingParams,
    payloadTemplate,
    artifactRef,
    compositionRef,
  });
}

describe('commitTriggerArtifactMaterialization', () => {
  beforeEach(() => {
    closeDb();
  });

  it('rejects missing trigger_ref', async () => {
    await expect(
      commitTriggerArtifactMaterialization({ type: 'trigger_artifact_materialization' }),
    ).rejects.toThrow(/trigger_ref is required/);
  });

  it('rejects unknown trigger_ref', async () => {
    await expect(
      commitTriggerArtifactMaterialization({
        type: 'trigger_artifact_materialization',
        trigger_ref: 'trig_nonexistent',
      }),
    ).rejects.toThrow(/not found/);
  });

  it('rejects composition-only triggers (no artifact_ref)', async () => {
    const trigger = seedTrigger({ artifactRef: null, compositionRef: 'comp_xyz' });
    await expect(
      commitTriggerArtifactMaterialization({
        type: 'trigger_artifact_materialization',
        trigger_ref: trigger.triggerRef,
      }),
    ).rejects.toThrow(/artifact_ref/);
  });

  it('rejects when the target artifact node does not exist', async () => {
    const trigger = seedTrigger({ artifactRef: 'artifact:not-materialized' });
    await expect(
      commitTriggerArtifactMaterialization({
        type: 'trigger_artifact_materialization',
        trigger_ref: trigger.triggerRef,
      }),
    ).rejects.toThrow(/no contextmap node/);
  });

  it('happy path — writes a trigger_artifact_materialization principle on the target artifact node', async () => {
    const artifactNode = seedArtifactNode({ ref: 'app:happy-target' });
    const trigger = seedTrigger({ artifactRef: 'app:happy-target' });

    const out = await commitTriggerArtifactMaterialization({
      type: 'trigger_artifact_materialization',
      trigger_ref: trigger.triggerRef,
    });

    expect(out.ok).toBe(true);
    expect(out.triggerRef).toBe(trigger.triggerRef);
    expect(out.componentRef).toBe('trigger/scheduled@0.1.0');
    expect(out.artifactNodeId).toBe(artifactNode.id);
    expect(out.principleId).toBeGreaterThan(0);

    const principles = MetaPrincipleRepository.listForScope('node', artifactNode.id);
    const tamPrinciples = principles.filter(
      (p) => p.sourceEvent === 'trigger_artifact_materialization',
    );
    expect(tamPrinciples).toHaveLength(1);
    const body = tamPrinciples[0].bodyMd;
    expect(body).toContain('Trigger bound');
    expect(body).toContain(trigger.triggerRef);
    expect(body).toContain('trigger/scheduled@0.1.0');
    expect(body).toContain('app:happy-target');
    expect(body).toContain('cron');
    expect(body).toContain('Payload template');
  });

  it('surfaces the principle through briefHandler against the artifact node', async () => {
    seedArtifactNode({ ref: 'app:brief-target' });
    const trigger = seedTrigger({ artifactRef: 'app:brief-target' });
    await commitTriggerArtifactMaterialization({
      type: 'trigger_artifact_materialization',
      trigger_ref: trigger.triggerRef,
    });

    const brief = await briefHandler({
      scope: { kind: 'artifact', ref: 'app:brief-target' },
    });
    const tamPrinciples = brief.principles.filter(
      (p) => p.sourceEvent === 'trigger_artifact_materialization',
    );
    expect(tamPrinciples).toHaveLength(1);
  });

  it('routes via the commitHandler dispatcher', async () => {
    seedArtifactNode({ ref: 'app:dispatch-target' });
    const trigger = seedTrigger({ artifactRef: 'app:dispatch-target' });
    const out = await commitHandler({
      type: 'trigger_artifact_materialization',
      trigger_ref: trigger.triggerRef,
    });
    expect(out.ok).toBe(true);
    expect(out.principleId).toBeGreaterThan(0);
  });
});
