// Isolate this test file to an in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { ProviderArtifactRepository } from '@/lib/db/repositories/mcp-orbit-provider-artifacts';
import { bindPrimitivesHandler } from './mcp-primitive-binding.js';

beforeEach(() => {
  closeDb();
});

// Test fixture mirrors the shape an agent would build by walking a Drive MCP's
// tools/list — names, descriptions, and JSON Schemas resemble what the real
// Claude-Code-shipped Drive MCP exposes.
function declareDriveInventory({ confidence = 'tools_list_full' } = {}) {
  // names_only means the agent only knows tool names — no schemas captured.
  // The fixture mirrors that: drop schemas when the confidence is names_only.
  const includeSchemas = confidence !== 'names_only';
  const tool = (name, schema) => {
    const t = { name, introspectionConfidence: confidence };
    if (includeSchemas) t.inputSchema = schema;
    return t;
  };
  return InventoryRepository.replaceInventory([
    {
      name: 'claude_ai_Google_Drive',
      tools: [
        tool('search_files', {
          type: 'object',
          properties: {
            query: { type: 'string' },
            folder_id: { type: 'string' },
          },
          required: ['query'],
        }),
        tool('read_file_content', {
          type: 'object',
          properties: { file_id: { type: 'string' } },
          required: ['file_id'],
        }),
        tool('list_recent_files', {
          type: 'object',
          properties: {
            folder_id: { type: 'string' },
            modified_after: { type: 'string' },
          },
        }),
        tool('get_file_metadata', { type: 'object' }),
        tool('create_file', {
          type: 'object',
          properties: {
            name: { type: 'string' },
            mime_type: { type: 'string' },
            parents: { type: 'array' },
          },
          required: ['name', 'mime_type'],
        }),
      ],
    },
  ]);
}

const DRIVE_SOURCE_BINDINGS = {
  'find-by-key-in-scope': { tool: 'search_files', confidence: 'agent-inferred' },
  'read-content': { tool: 'read_file_content', confidence: 'agent-inferred' },
  'list-recent': { tool: 'list_recent_files', confidence: 'operator-confirmed' },
  'get-metadata': { tool: 'get_file_metadata', confidence: 'agent-inferred' },
  // subscribe-to-changes intentionally unbound — Drive doesn't expose it
};

describe('bind_primitives — happy path', () => {
  beforeEach(() => {
    declareDriveInventory();
  });

  it('generates an artifact, persists it, and returns the inline body + manifest', async () => {
    const out = await bindPrimitivesHandler({
      primitive: 'document-store',
      role: 'source',
      server: 'claude_ai_Google_Drive',
      bindings: DRIVE_SOURCE_BINDINGS,
    });
    expect(out.ok).toBe(true);
    expect(out.artifact.ref).toMatch(/^prov_[a-f0-9]{12}$/);
    expect(out.artifact.primitiveRef).toBe('document-store@0.1.0');
    expect(out.artifact.role).toBe('source');
    expect(out.artifact.server).toBe('claude_ai_Google_Drive');
    expect(out.artifact.snapshotConfidence).toBe('tools_list_full');

    // Body has the bound tool names from the snapshot, not placeholders
    expect(out.artifact.body).toContain('search_files');
    expect(out.artifact.body).toContain('read_file_content');
    expect(out.artifact.body).toContain('list_recent_files');
    expect(out.artifact.body).toContain('get_file_metadata');
    // Unbound affordance still gets a placeholder
    expect(out.artifact.body).toContain('<UNBOUND>');

    // Manifest reflects bindings
    expect(out.artifact.manifest.declaredCount).toBe(5);
    expect(out.artifact.manifest.bound).toHaveLength(4);
    expect(out.artifact.manifest.unbound).toHaveLength(1);
    expect(out.artifact.manifest.unbound[0].affordance).toBe('subscribe-to-changes');

    // Persisted — findByRef returns the same row
    const persisted = ProviderArtifactRepository.findByRef(out.artifact.ref);
    expect(persisted).not.toBeNull();
    expect(persisted.bodyMd).toBe(out.artifact.body);
    expect(persisted.manifest).toEqual(out.artifact.manifest);
    expect(persisted.bindings).toEqual(DRIVE_SOURCE_BINDINGS);
  });

  it('warns when no operator anchor exists', async () => {
    const out = await bindPrimitivesHandler({
      primitive: 'document-store',
      role: 'source',
      server: 'claude_ai_Google_Drive',
      bindings: DRIVE_SOURCE_BINDINGS,
    });
    expect(out.warnings || []).toContain('no_operator_anchor');
  });

  it('warns when the snapshot is names_only', async () => {
    closeDb();
    declareDriveInventory({ confidence: 'names_only' });
    const out = await bindPrimitivesHandler({
      primitive: 'document-store',
      role: 'source',
      server: 'claude_ai_Google_Drive',
      bindings: {
        'find-by-key-in-scope': { tool: 'search_files' },
        'read-content': { tool: 'read_file_content' },
        'list-recent': { tool: 'list_recent_files' },
        'get-metadata': { tool: 'get_file_metadata' },
      },
    });
    expect(out.warnings || []).toContain('snapshot_names_only');
    expect(out.artifact.snapshotConfidence).toBe('names_only');
    // Schema slots render the "no schema available" placeholder
    expect(out.artifact.body).toContain('(no schema available)');
  });
});

describe('bind_primitives — destination role', () => {
  beforeEach(() => {
    declareDriveInventory();
  });

  it('generates a destination-role artifact with the right affordance set', async () => {
    const out = await bindPrimitivesHandler({
      primitive: 'document-store',
      role: 'destination',
      server: 'claude_ai_Google_Drive',
      bindings: {
        'create-with-mime': { tool: 'create_file', confidence: 'operator-confirmed' },
        'find-by-key-in-scope': { tool: 'search_files', confidence: 'agent-inferred' },
        // append-to-existing, move-to-folder intentionally unbound
      },
    });
    expect(out.artifact.role).toBe('destination');
    expect(out.artifact.body).toContain('create_file');
    expect(out.artifact.manifest.declaredCount).toBe(4);
    expect(out.artifact.manifest.bound).toHaveLength(2);
    expect(out.artifact.manifest.unbound.map((u) => u.affordance).sort()).toEqual([
      'append-to-existing',
      'move-to-folder',
    ]);
  });
});

describe('bind_primitives — input validation', () => {
  beforeEach(() => {
    declareDriveInventory();
  });

  it('rejects missing primitive', async () => {
    await expect(
      bindPrimitivesHandler({
        role: 'source',
        server: 'claude_ai_Google_Drive',
        bindings: {},
      }),
    ).rejects.toThrow(/primitive/);
  });

  it('rejects invalid role', async () => {
    await expect(
      bindPrimitivesHandler({
        primitive: 'document-store',
        role: 'sideways',
        server: 'claude_ai_Google_Drive',
        bindings: {},
      }),
    ).rejects.toThrow(/must be one of: source, destination/);
  });

  it('rejects missing server', async () => {
    await expect(
      bindPrimitivesHandler({
        primitive: 'document-store',
        role: 'source',
        bindings: {},
      }),
    ).rejects.toThrow(/server/);
  });

  it('rejects when server is not in declared inventory', async () => {
    await expect(
      bindPrimitivesHandler({
        primitive: 'document-store',
        role: 'source',
        server: 'no_such_server',
        bindings: {},
      }),
    ).rejects.toThrow(/not in the declared inventory/);
  });

  it('rejects bindings that are not an object', async () => {
    await expect(
      bindPrimitivesHandler({
        primitive: 'document-store',
        role: 'source',
        server: 'claude_ai_Google_Drive',
        bindings: 'not-an-object',
      }),
    ).rejects.toThrow(/must be an object mapping affordance/);
  });

  it('rejects binding entries without a tool', async () => {
    await expect(
      bindPrimitivesHandler({
        primitive: 'document-store',
        role: 'source',
        server: 'claude_ai_Google_Drive',
        bindings: { 'list-recent': { confidence: 'agent-inferred' } },
      }),
    ).rejects.toThrow(/tool must be a non-empty string/);
  });

  it('rejects invalid confidence values', async () => {
    await expect(
      bindPrimitivesHandler({
        primitive: 'document-store',
        role: 'source',
        server: 'claude_ai_Google_Drive',
        bindings: { 'list-recent': { tool: 'list_recent_files', confidence: 'bogus' } },
      }),
    ).rejects.toThrow(/confidence must be/);
  });
});

describe('bind_primitives — structured-record-store primitive', () => {
  it('handles a different primitive with deliberately divergent vocabulary', async () => {
    InventoryRepository.replaceInventory([
      {
        name: 'claude_ai_Linear',
        tools: [
          {
            name: 'search_issues',
            inputSchema: { type: 'object' },
            introspectionConfidence: 'tools_list_full',
          },
          {
            name: 'get_issue',
            inputSchema: { type: 'object' },
            introspectionConfidence: 'tools_list_full',
          },
          {
            name: 'list_issues',
            inputSchema: { type: 'object' },
            introspectionConfidence: 'tools_list_full',
          },
        ],
      },
    ]);
    const out = await bindPrimitivesHandler({
      primitive: 'structured-record-store',
      role: 'source',
      server: 'claude_ai_Linear',
      bindings: {
        'find-by-filter': { tool: 'search_issues' },
        'read-content': { tool: 'get_issue' },
        'list-recent': { tool: 'list_issues' },
      },
    });
    expect(out.artifact.primitiveRef).toBe('structured-record-store@0.1.0');
    expect(out.artifact.body).toContain('search_issues');
    // structured-record-store vocabulary, not document-store vocabulary
    expect(out.artifact.body).toContain('`find-by-filter`');
    expect(out.artifact.body).not.toContain('find-by-key-in-scope');
  });
});
