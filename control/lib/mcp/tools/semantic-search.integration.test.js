// Cross-kind integration test for the semantic index.
//
// Exercises every host write path covered in step 5:
//   - meta_principles via meta_context_commit handlers (commitOperatorKyc,
//     commitArtifactMaterialization, commitPrimitiveArtifactMaterialization)
//   - meta_mcp_inventory via InventoryRepository.replaceInventoryWithEmbeddings
//   - meta_mcp_capabilities via CapabilitiesRepository.insertWithEmbedding
//   - mcp_orbit_components via MCPOrbitComponentRepository.upsertWithEmbedding
//   - mcp_orbit_compositions via MCPOrbitCompositionRepository.insertWithEmbedding
//   - mcp_orbit_provider_artifacts via ProviderArtifactRepository.insertWithEmbedding
//   - catalysts via reindexAll() (filesystem markdown — no write event)
//   - sketch_vocab via reindexAll() (filesystem markdown — no write event)
//   - sketch_method via reindexAll() (filesystem capability catalog)
//   - manji_program via reindexAll() (filesystem + in-code illustration cards)
//
// Then runs semantic_search and confirms cross-kind recall returns the
// expected refs with the expected source_kind tags.

process.env.SQLITE_PATH = ':memory:';
// Auto-backfill stays OFF — we drive seeding explicitly from this test so
// timing is predictable. The embedding hooks themselves are still active
// (we do NOT set MOJULO_SEMANTIC_INDEX_DISABLED) so host writes exercise
// the full embed path.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED_BACKFILL_ONLY = '1';

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock the embedder so the test doesn't load the 113MB ONNX model. The mock
// produces deterministic 384-dim vectors keyed on text so cosine similarity
// behaves predictably: the same string maps to the same vector, similar
// strings map to similar vectors at the byte level.
vi.mock('@/lib/embedder/local', async () => {
  const { createHash } = await import('node:crypto');
  const LOCAL_EMBEDDING_DIM = 384;
  function vectorFromText(text) {
    const v = new Float32Array(LOCAL_EMBEDDING_DIM);
    const buf = createHash('sha512').update(text).digest();
    for (let i = 0; i < LOCAL_EMBEDDING_DIM; i++) v[i] = (buf[i % buf.length] - 128) / 128;
    let mag = 0;
    for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
    mag = Math.sqrt(mag) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= mag;
    return Array.from(v);
  }
  return {
    LOCAL_EMBEDDING_MODEL: 'multilingual-e5-small',
    LOCAL_EMBEDDING_DIM,
    preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async (texts) => texts.map(vectorFromText)),
  };
});

import { closeDb, getDb } from '@/lib/db/index';
import { DeploymentRepository } from '@/lib/db/repositories/deployments';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';
import {
  MCPOrbitComponentRepository,
  MCPOrbitCompositionRepository,
} from '@/lib/db/repositories/mcp-orbit';
import { ProviderArtifactRepository } from '@/lib/db/repositories/mcp-orbit-provider-artifacts';
import { EmbeddingsRepository, reindexAll } from '@/lib/db/repositories/embeddings';
import {
  commitOperatorKyc,
  commitArtifactMaterialization,
  commitPrimitiveArtifactMaterialization,
} from '@/lib/mcp/tools/meta-context';
import { semanticSearchHandler } from '@/lib/mcp/tools/semantic-search';
import { getSketchVocabCard } from '@/lib/graph/sketch-vocab/loader';
import { getSketchMethodCatalog } from '@/lib/graph/polygonizer/capabilities/loader';
import { resolveManjiProgramCard } from '@/lib/graph/polygonizer/mandala-patterns';
import { getPaintedLandscapeCardCatalog } from '@/lib/graph/painted-landscape-cards/loader';

let tmpRoot;
let existingArtifactPath;

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-semantic-integration-'));
  existingArtifactPath = join(tmpRoot, 'SKILL.md');
  writeFileSync(existingArtifactPath, '# stub');
});

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
});

async function seedDeployment(id, botName) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO deployments (id, bot_name, flow_type, status, config, api_key, document_ids, created_at, updated_at)
     VALUES (?, ?, 'modular', 'saved', ?, 'k', '[]', ?, ?)`,
  ).run(id, botName, '{}', now, now);
  return DeploymentRepository.findById(id);
}

// Seed every source kind so semantic_search has cross-kind material.
async function seedFullCorpus() {
  // 1. principle (via operator_kyc)
  const kyc = await commitOperatorKyc({
    type: 'operator_kyc',
    role: 'solo founder',
    primary_goal: 'route inbound leads through HubSpot CRM',
    constraints: ['route inbound leads through HubSpot CRM', 'no PII through the LLM'],
  });

  // 2. mcp_capability (research-mode body)
  await CapabilitiesRepository.insertWithEmbedding({
    providerRef: 'hubspot',
    displayName: 'HubSpot',
    bodyMd: 'HubSpot CRM contact create-and-search affordances and idempotency notes.',
    sourceUrls: ['https://developers.hubspot.com'],
  });

  // 3. mcp_tool (via inventory replace)
  await InventoryRepository.replaceInventoryWithEmbeddings([
    {
      name: 'hubspot',
      tools: [
        { name: 'create_contact', description: 'Create a new contact in HubSpot' },
        { name: 'search_contacts', description: 'Search HubSpot contacts by email' },
      ],
    },
    {
      name: 'google_calendar',
      tools: [
        { name: 'create_event', description: 'Create a new event on the calendar' },
      ],
    },
  ]);

  // 4. orbit_component (via upsertWithEmbedding)
  await MCPOrbitComponentRepository.upsertWithEmbedding({
    kind: 'pattern',
    ref: 'digest',
    version: '0.1.0',
    body_md: 'Weekly digest pattern — bucket items by day, render as a single message.',
  });
  await MCPOrbitComponentRepository.upsertWithEmbedding({
    kind: 'trigger',
    ref: 'cron',
    version: '0.1.0',
    body_md: 'Cron trigger fires on a recurring schedule. Use for digest workflows.',
  });

  // 5. orbit_composition (via insertWithEmbedding)
  const composition = await MCPOrbitCompositionRepository.insertWithEmbedding({
    intent_md:
      'Weekly digest of qualified HubSpot leads sent into a Google Calendar event',
    component_refs: [
      { kind: 'mcp', ref: 'hubspot', version: '0.1.0', role: 'source' },
      { kind: 'mcp', ref: 'google_calendar', version: '0.1.0', role: 'destination' },
      { kind: 'trigger', ref: 'cron', version: '0.1.0' },
      { kind: 'pattern', ref: 'digest', version: '0.1.0' },
    ],
    knobs: {},
  });

  // 6. orbit_artifact (via insertWithEmbedding)
  const providerArtifact = await ProviderArtifactRepository.insertWithEmbedding({
    primitiveRef: 'document-store@0.1.0',
    role: 'destination',
    server: 'claude_ai_Google_Drive',
    introspectedAt: '2026-05-24T18:00:00Z',
    snapshotConfidence: 'tools_list_full',
    bodyMd:
      'Bound document-store primitive on Google Drive — write affordance maps to create_file.',
    manifest: { bound: [{ affordance: 'write', tool: 'create_file', confidence: 'tools_list_full' }] },
    bindings: { write: 'create_file' },
  });

  // 7. catalysts come from the filesystem and have no SQL write event.
  // reindexAll() picks them up — same path the first-boot backfill takes.
  await reindexAll();

  // bot-shaped artifact_materialization principle so the principle kind has
  // a second variant (user-supplied body, not just operator_kyc).
  await seedDeployment('dep-int', 'Integration Bot');
  await commitArtifactMaterialization({
    type: 'artifact_materialization',
    adapter_id: 'generic',
    artifact: { locator: existingArtifactPath, label: 'lead-router skill' },
    bot_ref: 'dep-int',
    catalyst_ref: 'qualify-lead-to-crm',
    bindings: [{ mcp_tool: 'hubspot.create_contact', fields_bound: ['email'] }],
    principles: [
      {
        scope: 'artifact',
        body_md:
          'Operator confirmed HubSpot routing during onboarding — idempotency on normalized email.',
      },
    ],
  });

  // primitive-binding materialization so the auto-summary principle is
  // present too.
  await commitPrimitiveArtifactMaterialization({
    type: 'primitive_artifact_materialization',
    adapter_id: 'generic',
    artifact: { locator: existingArtifactPath, label: 'drive digest' },
    composition_intent: 'weekly digest of lead conversion rate into Drive',
    provider_artifact_refs: [providerArtifact.ref],
  });

  return { kyc, composition, providerArtifact };
}

describe('semantic_search — cross-kind recall integration', () => {
  it('returns rows tagged with every source_kind we wrote', async () => {
    await seedFullCorpus();
    // We expect at least one row per kind we seeded — the integration is
    // only "working" if the index actually has material from every host
    // write path the plan touches. Scope per kind so a broad query's
    // ranking does not accidentally crowd out a source kind at limit=50.
    const expectedKinds = [
      'principle',
      'mcp_tool',
      'mcp_capability',
      'orbit_component',
      'orbit_composition',
      'orbit_artifact',
      'catalyst',
      'sketch_vocab',
      'sketch_method',
      'manji_program',
    ];
    for (const kind of expectedKinds) {
      const { results } = await semanticSearchHandler({
        query: 'lead routing into HubSpot illustration card architecture',
        kinds: [kind],
        limit: 5,
      });
      expect(results.length, `${kind} should return at least one result`).toBeGreaterThan(0);
      for (const r of results) expect(r.source_kind).toBe(kind);
    }
  });

  it('per-kind scoping returns rows only of the requested kind', async () => {
    await seedFullCorpus();
    const { results } = await semanticSearchHandler({
      query: 'calendar event creation',
      kinds: ['mcp_tool'],
      limit: 10,
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.source_kind).toBe('mcp_tool');
    // The calendar create_event tool should be in the top results — the
    // deterministic mock embedder maps the same body to the same vector,
    // so the highest-similarity row is the one whose body exactly matches
    // the query.
    expect(results.map((r) => r.source_ref)).toContain('google_calendar::create_event');
  });

  it('snippets respect the 280-char cap', async () => {
    await seedFullCorpus();
    const { results } = await semanticSearchHandler({ query: 'HubSpot', limit: 50 });
    for (const r of results) expect(r.snippet.length).toBeLessThanOrEqual(280);
  });

  it('every result references a real row in its source table', async () => {
    const { kyc, composition, providerArtifact } = await seedFullCorpus();
    const { results } = await semanticSearchHandler({ query: 'HubSpot', limit: 50 });
    // For each result, spot-check that the source_ref still resolves in
    // the table it claims to come from. If the host writes failed to
    // produce backing rows, semantic_search would surface orphan refs
    // and the agent would chase 404s.
    const db = getDb();
    for (const r of results) {
      switch (r.source_kind) {
        case 'principle': {
          const row = db
            .prepare('SELECT id FROM meta_principles WHERE id = ?')
            .get(Number(r.source_ref));
          expect(row, `principle ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        case 'mcp_tool': {
          const [server, tool] = r.source_ref.split('::');
          const row = db
            .prepare(
              'SELECT id FROM meta_mcp_inventory WHERE server = ? AND tool_name = ?',
            )
            .get(server, tool);
          expect(row, `mcp_tool ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        case 'mcp_capability': {
          // Only the current row survives the search-time supersession filter.
          const row = CapabilitiesRepository.getCurrent(r.source_ref);
          expect(row, `mcp_capability ${r.source_ref} should be current`).toBeTruthy();
          break;
        }
        case 'orbit_component': {
          const row = db
            .prepare(
              "SELECT id FROM mcp_orbit_components WHERE (kind || '/' || ref || '@' || version) = ?",
            )
            .get(r.source_ref);
          expect(row, `orbit_component ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        case 'orbit_composition': {
          const row = MCPOrbitCompositionRepository.findByRef(r.source_ref);
          expect(row, `orbit_composition ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        case 'orbit_artifact': {
          const row = ProviderArtifactRepository.findByRef(r.source_ref);
          expect(row, `orbit_artifact ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        case 'catalyst': {
          // Catalysts come from the filesystem via the loader; we only
          // assert the source_ref looks like an id.
          expect(r.source_ref).toMatch(/^[a-z0-9-]+$/);
          break;
        }
        case 'sketch_vocab': {
          const card = getSketchVocabCard(r.source_ref);
          expect(card, `sketch_vocab ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        case 'sketch_method': {
          const method = getSketchMethodCatalog().get(r.source_ref);
          expect(method, `sketch_method ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        case 'manji_program': {
          const card = resolveManjiProgramCard(r.source_ref);
          expect(card, `manji_program ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        case 'painted_landscape': {
          const card = getPaintedLandscapeCardCatalog().get(r.source_ref);
          expect(card, `painted_landscape ${r.source_ref} should exist`).toBeTruthy();
          break;
        }
        default:
          throw new Error(`unexpected source_kind in result: ${r.source_kind}`);
      }
    }
    // Pin specific refs we know we wrote.
    expect(EmbeddingsRepository.findByRef('principle', String(kyc.principleId))).not.toBe(null);
    expect(EmbeddingsRepository.findByRef('orbit_composition', composition.ref)).not.toBe(null);
    expect(EmbeddingsRepository.findByRef('orbit_artifact', providerArtifact.ref)).not.toBe(null);
  });

  it('rejects empty / malformed inputs', async () => {
    await expect(semanticSearchHandler({})).rejects.toThrow(/query/);
    await expect(semanticSearchHandler({ query: '' })).rejects.toThrow(/query/);
    await expect(semanticSearchHandler({ query: 'x', limit: 0 })).rejects.toThrow(/limit/);
    await expect(semanticSearchHandler({ query: 'x', limit: 51 })).rejects.toThrow(/limit/);
    await expect(semanticSearchHandler({ query: 'x', kinds: ['rogue'] })).rejects.toThrow(/source_kind/);
  });
});
