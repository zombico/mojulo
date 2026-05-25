// Isolate this test file to an in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';
// Skip first-boot backfill — each test seeds embeddings via the host write
// paths it's exercising.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED_BACKFILL_ONLY = '1';
// NOTE: the embed hooks in tools/meta-context.js short-circuit when
// MOJULO_SEMANTIC_INDEX_DISABLED=1; we deliberately leave that flag UNSET
// here so the host writes actually call into the (mocked) embedder.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Deterministic embedder mock — same shape as embeddings.test.js so the
// principle path exercises the full embed/upsert dance without loading
// ONNX.
vi.mock('@/lib/embedder/local', async () => {
  const { createHash } = await import('node:crypto');
  const LOCAL_EMBEDDING_DIM = 384;
  const LOCAL_EMBEDDING_MODEL = 'multilingual-e5-small';
  function vectorFromText(text) {
    const v = new Float32Array(LOCAL_EMBEDDING_DIM);
    const buf = createHash('sha512').update(text).digest();
    for (let i = 0; i < LOCAL_EMBEDDING_DIM; i++) {
      v[i] = (buf[i % buf.length] - 128) / 128;
    }
    let mag = 0;
    for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
    mag = Math.sqrt(mag) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= mag;
    return Array.from(v);
  }
  return {
    LOCAL_EMBEDDING_MODEL,
    LOCAL_EMBEDDING_DIM,
    preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async (texts) => texts.map(vectorFromText)),
  };
});

import { closeDb, getDb } from '@/lib/db/index';
import { DeploymentRepository } from '@/lib/db/repositories/deployments';
import { EmbeddingsRepository } from '@/lib/db/repositories/embeddings';
import {
  commitOperatorKyc,
  commitArtifactMaterialization,
  commitPrimitiveArtifactMaterialization,
} from './meta-context.js';
import { ProviderArtifactRepository } from '@/lib/db/repositories/mcp-orbit-provider-artifacts';

let tmpRoot;
let existingArtifactPath;

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-meta-context-embed-test-'));
  existingArtifactPath = join(tmpRoot, 'SKILL.md');
  writeFileSync(existingArtifactPath, '# stub');
});

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
});

async function seedDeployment({ id = 'dep-embed', botName = 'Embed Bot' } = {}) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO deployments (id, bot_name, flow_type, status, config, api_key, document_ids, created_at, updated_at)
     VALUES (?, ?, 'modular', 'saved', ?, 'k', '[]', ?, ?)`,
  ).run(id, botName, '{}', now, now);
  return DeploymentRepository.findById(id);
}

describe('operator_kyc principle embedding', () => {
  it('writes a meta_embeddings row keyed on the inserted principle id', async () => {
    getDb();
    const out = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'product lead',
      constraints: ['no Calendly', 'no PII through LLM'],
    });
    expect(out.ok).toBe(true);
    const row = EmbeddingsRepository.findByRef('principle', String(out.principleId));
    expect(row).not.toBe(null);
    expect(row.sourceKind).toBe('principle');
    expect(row.bodyText).toContain('product lead');
  });
});

describe('artifact_materialization principle embeddings', () => {
  it('writes one embedding row per user-supplied principle', async () => {
    await seedDeployment({ id: 'dep-embed' });
    const out = await commitArtifactMaterialization({
      type: 'artifact_materialization',
      adapter_id: 'generic',
      artifact: { locator: existingArtifactPath, label: 'My Skill' },
      bot_ref: 'dep-embed',
      catalyst_ref: 'qualify-lead-to-crm',
      bindings: [{ mcp_tool: 'hubspot.create_contact', fields_bound: ['email', 'name'] }],
      principles: [
        { scope: 'artifact', body_md: 'Maps email + name only, drops phone.' },
        { scope: 'binds', body_md: 'Idempotency key is normalized email.' },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.principlesCreated).toBe(2);

    const db = getDb();
    const rows = db
      .prepare("SELECT body_text FROM meta_embeddings WHERE source_kind = 'principle'")
      .all();
    expect(rows.length).toBe(2);
    const bodies = rows.map((r) => r.body_text).sort();
    expect(bodies).toEqual([
      'Idempotency key is normalized email.',
      'Maps email + name only, drops phone.',
    ]);
  });

  it('fans `binds` scope into N embedding rows sharing the body text', async () => {
    await seedDeployment({ id: 'dep-fanout' });
    const out = await commitArtifactMaterialization({
      type: 'artifact_materialization',
      adapter_id: 'generic',
      artifact: { locator: existingArtifactPath, label: 'Multi-bind' },
      bot_ref: 'dep-fanout',
      catalyst_ref: 'qualify-lead-to-crm',
      bindings: [
        { mcp_tool: 'hubspot.create_contact' },
        { mcp_tool: 'hubspot.search_contact' },
      ],
      principles: [
        { scope: 'binds', body_md: 'Operator confirmed both writes are atomic.' },
      ],
    });
    expect(out.principlesCreated).toBe(2);
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT body_text FROM meta_embeddings WHERE source_kind = 'principle' AND body_text = ?`,
      )
      .all('Operator confirmed both writes are atomic.');
    expect(rows.length).toBe(2);
  });
});

describe('primitive_artifact_materialization principle embeddings', () => {
  it('writes the auto-summary embedding plus any user principles', async () => {
    getDb();
    const pa = ProviderArtifactRepository.insert({
      primitiveRef: 'document-store@0.1.0',
      role: 'destination',
      server: 'claude_ai_Google_Drive',
      introspectedAt: '2026-05-24T18:00:00Z',
      snapshotConfidence: 'tools_list_full',
      bodyMd: '# body',
      manifest: { bound: [{ affordance: 'write', tool: 'create_file', confidence: 'tools_list_full' }] },
      bindings: { write: 'create_file' },
    });

    const out = await commitPrimitiveArtifactMaterialization({
      type: 'primitive_artifact_materialization',
      adapter_id: 'generic',
      artifact: { locator: existingArtifactPath, label: 'Drive digest' },
      composition_intent: 'weekly digest of open issues into a Drive folder',
      provider_artifact_refs: [pa.ref],
      principles: [{ scope: 'artifact', body_md: 'Skip closed issues.' }],
    });
    expect(out.ok).toBe(true);

    const db = getDb();
    const rows = db
      .prepare("SELECT body_text FROM meta_embeddings WHERE source_kind = 'principle'")
      .all();
    // Auto-summary + user principle = 2 rows.
    expect(rows.length).toBe(2);
    const bodies = rows.map((r) => r.body_text);
    expect(bodies).toContain('Skip closed issues.');
    expect(bodies.some((b) => b.includes('weekly digest'))).toBe(true);
  });
});
