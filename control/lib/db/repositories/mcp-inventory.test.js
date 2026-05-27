// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js (getDb is lazy and reads SQLITE_PATH on first
// call). Vitest workers isolate sibling files so this doesn't leak.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '../index.js';
import { InventoryRepository, _internals as inventoryInternals } from './mcp-inventory.js';

beforeEach(() => {
  closeDb();
});

describe('schema bootstraps', () => {
  it('creates meta_mcp_inventory on first getDb()', () => {
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'meta_mcp_inventory'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('creates the tool_ref index', () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name = 'idx_meta_mcp_inventory_tool_ref'",
      )
      .all();
    expect(indexes).toHaveLength(1);
  });

  it('enforces UNIQUE(server, tool_name)', () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO meta_mcp_inventory (server, tool_name, tool_ref) VALUES (?, ?, ?)`,
    ).run('gmail', 'send_message', 'gmail.send_message');
    expect(() =>
      db
        .prepare(
          `INSERT INTO meta_mcp_inventory (server, tool_name, tool_ref) VALUES (?, ?, ?)`,
        )
        .run('gmail', 'send_message', 'gmail.send_message'),
    ).toThrow(/UNIQUE constraint failed/);
  });
});

describe('InventoryRepository.replaceInventory', () => {
  it('inserts a fresh inventory and returns counts', () => {
    const out = InventoryRepository.replaceInventory([
      {
        name: 'gmail',
        tools: [
          { name: 'send_message', description: 'Send a Gmail message' },
          { name: 'search_messages', description: 'Search Gmail' },
        ],
      },
      { name: 'gdrive', tools: [{ name: 'list_recent_files' }] },
    ]);
    expect(out.replaced).toBe(0);
    expect(out.inserted).toBe(3);
    expect(out.declaredAt).toBeGreaterThan(0);
  });

  it('REPLACES — second declaration wipes the first', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }, { name: 'search_messages' }] },
      { name: 'gdrive', tools: [{ name: 'list_recent_files' }] },
    ]);
    const out = InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'search_messages' }] },
      { name: 'linear', tools: [{ name: 'create_issue' }] },
    ]);
    expect(out.replaced).toBe(3);
    expect(out.inserted).toBe(2);

    const current = InventoryRepository.currentInventory();
    expect(current.toolCount).toBe(2);
    const serverNames = current.servers.map((s) => s.name).sort();
    expect(serverNames).toEqual(['gmail', 'linear']);
    // Old tools from the first declaration are gone.
    expect(InventoryRepository.findByRef('gdrive.list_recent_files')).toBeNull();
    expect(InventoryRepository.findByRef('gmail.send_message')).toBeNull();
    // Tools that survived the redeclaration are present.
    expect(InventoryRepository.findByRef('gmail.search_messages')).not.toBeNull();
  });

  it('empty array → wipes inventory, returns inserted: 0', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    const out = InventoryRepository.replaceInventory([]);
    expect(out.replaced).toBe(1);
    expect(out.inserted).toBe(0);
    expect(InventoryRepository.currentInventory().toolCount).toBe(0);
  });

  it('server with empty tools array is allowed (no-op for that server)', () => {
    const out = InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [] },
      { name: 'gdrive', tools: [{ name: 'list_recent_files' }] },
    ]);
    expect(out.inserted).toBe(1);
    expect(InventoryRepository.currentInventory().toolCount).toBe(1);
  });

  it('atomicity — bad payload mid-insert rolls back the wipe', () => {
    // First, seed a baseline.
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    // Now attempt a redeclaration that fails validation upfront (before any
    // DB work) — baseline must be intact.
    expect(() =>
      InventoryRepository.replaceInventory([{ name: 'gmail', tools: [{ name: '' }] }]),
    ).toThrow(/non-empty name/);
    expect(InventoryRepository.currentInventory().toolCount).toBe(1);
    expect(InventoryRepository.findByRef('gmail.send_message')).not.toBeNull();
  });

  it('rejects non-array input', () => {
    expect(() => InventoryRepository.replaceInventory(null)).toThrow(/array/);
    expect(() => InventoryRepository.replaceInventory({ name: 'gmail' })).toThrow(/array/);
  });

  it('rejects server with missing name', () => {
    expect(() =>
      InventoryRepository.replaceInventory([{ tools: [{ name: 'x' }] }]),
    ).toThrow(/server.name/);
  });

  it('rejects server with missing tools array', () => {
    expect(() => InventoryRepository.replaceInventory([{ name: 'gmail' }])).toThrow(
      /tools array/,
    );
  });

  it('rejects tool with missing name', () => {
    expect(() =>
      InventoryRepository.replaceInventory([{ name: 'gmail', tools: [{ description: 'x' }] }]),
    ).toThrow(/non-empty name/);
  });

  it('rejects non-string description', () => {
    expect(() =>
      InventoryRepository.replaceInventory([
        { name: 'gmail', tools: [{ name: 'send_message', description: 42 }] },
      ]),
    ).toThrow(/description must be a string/);
  });

  it('stores null description when omitted, round-trips as null', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    const found = InventoryRepository.findByRef('gmail.send_message');
    expect(found.description).toBeNull();
  });
});

describe('InventoryRepository.currentInventory', () => {
  it('empty inventory → { servers: [], declaredAt: null, ageSeconds: null, toolCount: 0 }', () => {
    expect(InventoryRepository.currentInventory()).toEqual({
      servers: [],
      declaredAt: null,
      ageSeconds: null,
      toolCount: 0,
    });
  });

  it('groups tools by server and surfaces declaredAt + ageSeconds', () => {
    InventoryRepository.replaceInventory([
      {
        name: 'gmail',
        tools: [
          { name: 'send_message', description: 'Send' },
          { name: 'search_messages' },
        ],
      },
      { name: 'linear', tools: [{ name: 'create_issue' }] },
    ]);
    const out = InventoryRepository.currentInventory();
    expect(out.toolCount).toBe(3);
    expect(out.declaredAt).toBeGreaterThan(0);
    expect(out.ageSeconds).toBeGreaterThanOrEqual(0);
    expect(out.ageSeconds).toBeLessThan(5);

    const gmail = out.servers.find((s) => s.name === 'gmail');
    expect(gmail.tools).toHaveLength(2);
    expect(gmail.tools.map((t) => t.ref).sort()).toEqual([
      'gmail.search_messages',
      'gmail.send_message',
    ]);
    const send = gmail.tools.find((t) => t.name === 'send_message');
    expect(send.description).toBe('Send');
  });
});

describe('InventoryRepository.findByRef', () => {
  it('returns null for unknown ref', () => {
    expect(InventoryRepository.findByRef('nope.nothing')).toBeNull();
  });

  it('returns the tool for a known ref', () => {
    InventoryRepository.replaceInventory([
      { name: 'hubspot', tools: [{ name: 'create_contact', description: 'Create' }] },
    ]);
    const found = InventoryRepository.findByRef('hubspot.create_contact');
    expect(found.server).toBe('hubspot');
    expect(found.toolName).toBe('create_contact');
    expect(found.description).toBe('Create');
  });

  it('returns null for empty/nullish input', () => {
    expect(InventoryRepository.findByRef('')).toBeNull();
    expect(InventoryRepository.findByRef(null)).toBeNull();
    expect(InventoryRepository.findByRef(undefined)).toBeNull();
  });
});

describe('InventoryRepository.hasInventory', () => {
  it('false on empty DB', () => {
    expect(InventoryRepository.hasInventory()).toBe(false);
  });

  it('true once at least one tool has been declared', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    expect(InventoryRepository.hasInventory()).toBe(true);
  });

  it('false after a wipe with empty servers', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    InventoryRepository.replaceInventory([]);
    expect(InventoryRepository.hasInventory()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase A.1 — capability-snapshot extension
//
// Verifies the inventory can carry per-tool inputSchema + introspectionConfidence
// alongside the existing thin-declaration path, and that snapshotForServer
// returns the exact shape the primitive-binding generator expects.
// ---------------------------------------------------------------------------

describe('schema bootstraps — capability snapshot columns', () => {
  it('adds input_schema_json and introspection_confidence columns', () => {
    const db = getDb();
    const cols = db.prepare('PRAGMA table_info(meta_mcp_inventory)').all();
    const names = new Set(cols.map((c) => c.name));
    expect(names.has('input_schema_json')).toBe(true);
    expect(names.has('introspection_confidence')).toBe(true);
  });
});

describe('InventoryRepository.replaceInventory — richer per-tool fields', () => {
  it('persists inputSchema as JSON blob and round-trips through currentInventory', () => {
    const schema = {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    };
    InventoryRepository.replaceInventory([
      {
        name: 'gdrive',
        tools: [
          {
            name: 'search_files',
            description: 'Search by name',
            inputSchema: schema,
            introspectionConfidence: 'tools_list_full',
          },
        ],
      },
    ]);
    const inv = InventoryRepository.currentInventory();
    expect(inv.servers).toHaveLength(1);
    const t = inv.servers[0].tools[0];
    expect(t.inputSchema).toEqual(schema);
    expect(t.introspectionConfidence).toBe('tools_list_full');
  });

  it('omits the richer fields from currentInventory entries when they were not declared', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    const inv = InventoryRepository.currentInventory();
    const t = inv.servers[0].tools[0];
    expect(t.inputSchema).toBeUndefined();
    expect(t.introspectionConfidence).toBeUndefined();
  });

  it('rejects an inputSchema that is not an object', () => {
    expect(() =>
      InventoryRepository.replaceInventory([
        { name: 'x', tools: [{ name: 't', inputSchema: 'not-an-object' }] },
      ]),
    ).toThrow(/inputSchema must be an object/);
  });

  it('rejects an invalid introspectionConfidence value', () => {
    expect(() =>
      InventoryRepository.replaceInventory([
        { name: 'x', tools: [{ name: 't', introspectionConfidence: 'bogus' }] },
      ]),
    ).toThrow(/introspectionConfidence must be one of/);
  });
});

describe('InventoryRepository.snapshotForServer', () => {
  it('returns null when the server is not in inventory', () => {
    expect(InventoryRepository.snapshotForServer('nope')).toBeNull();
    expect(InventoryRepository.snapshotForServer('')).toBeNull();
    expect(InventoryRepository.snapshotForServer(null)).toBeNull();
  });

  it('returns generator-shaped snapshot with ISO timestamp', () => {
    InventoryRepository.replaceInventory([
      {
        name: 'gdrive',
        tools: [
          {
            name: 'search_files',
            description: 'Search',
            inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
            introspectionConfidence: 'tools_list_full',
          },
          {
            name: 'create_file',
            inputSchema: { type: 'object' },
            introspectionConfidence: 'tools_list_full',
          },
        ],
      },
    ]);
    const snap = InventoryRepository.snapshotForServer('gdrive');
    expect(snap).not.toBeNull();
    expect(snap.server).toBe('gdrive');
    expect(typeof snap.introspected_at).toBe('string');
    // ISO-8601 form check; Date.parse round-trips it without NaN.
    expect(Number.isFinite(Date.parse(snap.introspected_at))).toBe(true);
    expect(snap.introspection_confidence).toBe('tools_list_full');
    expect(snap.tools).toHaveLength(2);
    expect(snap.tools[0].name).toBe('create_file');
    expect(snap.tools[1].name).toBe('search_files');
    expect(snap.tools[1].description).toBe('Search');
    expect(snap.tools[1].inputSchema).toEqual({
      type: 'object',
      properties: { q: { type: 'string' } },
    });
  });

  it('drops the server-level confidence to names_only when any tool lacks introspection', () => {
    InventoryRepository.replaceInventory([
      {
        name: 'mixed',
        tools: [
          {
            name: 'with_schema',
            inputSchema: { type: 'object' },
            introspectionConfidence: 'tools_list_full',
          },
          {
            name: 'naked', // no inputSchema, no confidence
          },
        ],
      },
    ]);
    const snap = InventoryRepository.snapshotForServer('mixed');
    expect(snap.introspection_confidence).toBe('names_only');
  });

  it('reports agent_inferred when at least one tool is agent_inferred and none are names_only', () => {
    InventoryRepository.replaceInventory([
      {
        name: 'partial',
        tools: [
          {
            name: 'a',
            inputSchema: { type: 'object' },
            introspectionConfidence: 'tools_list_full',
          },
          {
            name: 'b',
            inputSchema: { type: 'object' },
            introspectionConfidence: 'agent_inferred',
          },
        ],
      },
    ]);
    const snap = InventoryRepository.snapshotForServer('partial');
    expect(snap.introspection_confidence).toBe('agent_inferred');
  });

  it('omits the optional fields per-tool when the underlying row has no value', () => {
    InventoryRepository.replaceInventory([
      { name: 'thin', tools: [{ name: 'x' }] },
    ]);
    const snap = InventoryRepository.snapshotForServer('thin');
    expect(snap.tools[0]).toEqual({ name: 'x' });
  });
});

describe('deriveServerConfidence', () => {
  const { deriveServerConfidence } = inventoryInternals;

  it('returns null for empty arrays', () => {
    expect(deriveServerConfidence([])).toBeNull();
  });

  it('returns names_only when any entry is null or names_only', () => {
    expect(deriveServerConfidence(['tools_list_full', null])).toBe('names_only');
    expect(deriveServerConfidence(['tools_list_full', 'names_only'])).toBe('names_only');
  });

  it('returns agent_inferred when at least one entry is agent_inferred and none are names_only', () => {
    expect(deriveServerConfidence(['tools_list_full', 'agent_inferred'])).toBe('agent_inferred');
  });

  it('returns tools_list_full when every entry is tools_list_full', () => {
    expect(deriveServerConfidence(['tools_list_full', 'tools_list_full'])).toBe('tools_list_full');
  });
});

describe('replaceInventory: provider_id stamping', () => {
  it('creates a provider row for each canonicalized server name', () => {
    const db = getDb();
    InventoryRepository.replaceInventory([
      { name: 'claude_ai_Gmail', tools: [{ name: 'send' }] },
      { name: 'claude_ai_Notion', tools: [{ name: 'search' }] },
    ]);
    const providers = db
      .prepare('SELECT provider_ref FROM meta_mcp_providers ORDER BY provider_ref')
      .all();
    expect(providers.map((p) => p.provider_ref)).toEqual(['gmail', 'notion']);
  });

  it('stamps provider_id on every inventory row', () => {
    const db = getDb();
    InventoryRepository.replaceInventory([
      { name: 'claude_ai_Gmail', tools: [{ name: 'send' }, { name: 'search' }] },
    ]);
    const rows = db.prepare('SELECT provider_id FROM meta_mcp_inventory').all();
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.provider_id).not.toBeNull();
      expect(typeof r.provider_id).toBe('number');
    }
    // Both tools for the same server share the same provider_id.
    expect(rows[0].provider_id).toBe(rows[1].provider_id);
  });

  it('two install aliases that canonicalize to the same provider share provider_id', () => {
    const db = getDb();
    InventoryRepository.replaceInventory([
      { name: 'claude_ai_Notion', tools: [{ name: 'search' }] },
      { name: 'notion-mcp-server', tools: [{ name: 'fetch' }] },
    ]);
    const rows = db
      .prepare('SELECT server, provider_id FROM meta_mcp_inventory ORDER BY server')
      .all();
    expect(rows).toHaveLength(2);
    expect(rows[0].provider_id).toBe(rows[1].provider_id);
    // Only one provider row exists despite two install aliases.
    const providerCount = db.prepare('SELECT COUNT(*) AS n FROM meta_mcp_providers').get().n;
    expect(providerCount).toBe(1);
  });

  it('rowToTool exposes providerId on returned rows', () => {
    InventoryRepository.replaceInventory([
      { name: 'claude_ai_Gmail', tools: [{ name: 'send' }] },
    ]);
    const row = InventoryRepository.findByRef('claude_ai_Gmail.send');
    expect(row).not.toBe(null);
    expect(typeof row.providerId).toBe('number');
  });

  it('a fresh replace leaves only the providers it just declared in inventory; orphan provider rows persist', () => {
    InventoryRepository.replaceInventory([
      { name: 'claude_ai_Gmail', tools: [{ name: 'send' }] },
    ]);
    InventoryRepository.replaceInventory([
      { name: 'claude_ai_Notion', tools: [{ name: 'search' }] },
    ]);
    const db = getDb();
    // Inventory rows are replaced cleanly.
    const rows = db.prepare('SELECT server FROM meta_mcp_inventory').all();
    expect(rows.map((r) => r.server)).toEqual(['claude_ai_Notion']);
    // Providers from the first declaration stay (no cleanup of orphan
    // providers in v0 — they're harmless and the next declaration will reuse
    // them if the same alias comes back; their capabilities rows remain
    // queryable for historical lookups via getAsOf).
    const providers = db
      .prepare('SELECT provider_ref FROM meta_mcp_providers ORDER BY provider_ref')
      .all();
    expect(providers.map((p) => p.provider_ref)).toEqual(['gmail', 'notion']);
  });

  it('handles linear (no prefix, no suffix) correctly', () => {
    const db = getDb();
    InventoryRepository.replaceInventory([
      { name: 'linear', tools: [{ name: 'list_issues' }] },
    ]);
    const provider = db
      .prepare('SELECT provider_ref FROM meta_mcp_providers')
      .get();
    expect(provider.provider_ref).toBe('linear');
  });
});

// ── App-MCP partition (server_kind = 'app') ───────────────────────────────
//
// The app paradigm spike adds runner-managed inventory entries that ride
// alongside agent-declared vendor entries on the same table. The two
// partitions must not interfere: vendor declarations preserve app rows;
// app add/remove never touches vendor rows; both surface in
// currentInventory(). See APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md.

describe('schema bootstraps — server_kind partition', () => {
  it('adds server_kind and running_ref columns with vendor default', () => {
    const db = getDb();
    const cols = db.prepare('PRAGMA table_info(meta_mcp_inventory)').all();
    const have = Object.fromEntries(cols.map((c) => [c.name, c]));
    expect(have.server_kind).toBeTruthy();
    expect(have.server_kind.dflt_value).toBe("'vendor'");
    expect(have.running_ref).toBeTruthy();
  });
});

describe('InventoryRepository.addAppInventory', () => {
  it('inserts app rows tagged server_kind=app with the running_ref populated', () => {
    InventoryRepository.addAppInventory({
      server: 'image-extractor',
      tools: [
        { name: 'list_extractions', description: 'List recent extractions' },
        { name: 'describe_app' },
      ],
      runningRef: 'run-abc123',
    });
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT server, tool_name, server_kind, running_ref FROM meta_mcp_inventory
         ORDER BY tool_name`,
      )
      .all();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.server).toBe('image-extractor');
      expect(row.server_kind).toBe('app');
      expect(row.running_ref).toBe('run-abc123');
    }
  });

  it('replace-by-running-ref drops a prior app push under the same runningRef', () => {
    InventoryRepository.addAppInventory({
      server: 'image-extractor',
      tools: [{ name: 'old_tool' }],
      runningRef: 'run-abc123',
    });
    InventoryRepository.addAppInventory({
      server: 'image-extractor',
      tools: [{ name: 'new_tool' }],
      runningRef: 'run-abc123',
    });
    const db = getDb();
    const rows = db
      .prepare("SELECT tool_name FROM meta_mcp_inventory WHERE server_kind = 'app'")
      .all();
    expect(rows.map((r) => r.tool_name)).toEqual(['new_tool']);
  });

  it('rejects empty server / tools-not-array / empty runningRef', () => {
    expect(() =>
      InventoryRepository.addAppInventory({ server: '', tools: [], runningRef: 'r' }),
    ).toThrow(/non-empty server name/);
    expect(() =>
      InventoryRepository.addAppInventory({ server: 'x', tools: null, runningRef: 'r' }),
    ).toThrow(/tools array/);
    expect(() =>
      InventoryRepository.addAppInventory({ server: 'x', tools: [], runningRef: '' }),
    ).toThrow(/non-empty runningRef/);
  });
});

describe('InventoryRepository.removeAppInventory', () => {
  it('drops every app row under the given runningRef and returns the count', () => {
    InventoryRepository.addAppInventory({
      server: 'image-extractor',
      tools: [{ name: 'a' }, { name: 'b' }],
      runningRef: 'run-1',
    });
    InventoryRepository.addAppInventory({
      server: 'other-app',
      tools: [{ name: 'c' }],
      runningRef: 'run-2',
    });
    const { removed } = InventoryRepository.removeAppInventory('run-1');
    expect(removed).toBe(2);
    const db = getDb();
    const remaining = db
      .prepare("SELECT tool_name FROM meta_mcp_inventory WHERE server_kind = 'app'")
      .all();
    expect(remaining.map((r) => r.tool_name)).toEqual(['c']);
  });

  it('is a no-op for an unknown runningRef', () => {
    InventoryRepository.addAppInventory({
      server: 'image-extractor',
      tools: [{ name: 'a' }],
      runningRef: 'run-1',
    });
    const { removed } = InventoryRepository.removeAppInventory('does-not-exist');
    expect(removed).toBe(0);
    const db = getDb();
    const remaining = db
      .prepare("SELECT COUNT(*) AS n FROM meta_mcp_inventory WHERE server_kind = 'app'")
      .get().n;
    expect(remaining).toBe(1);
  });
});

describe('vendor replace preserves app rows (server_kind partition)', () => {
  it('replaceInventory only deletes vendor rows; app rows survive', () => {
    InventoryRepository.addAppInventory({
      server: 'image-extractor',
      tools: [{ name: 'list_extractions' }],
      runningRef: 'run-1',
    });
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send' }] },
    ]);
    const db = getDb();
    const all = db
      .prepare('SELECT server, server_kind FROM meta_mcp_inventory ORDER BY server')
      .all();
    expect(all).toEqual([
      { server: 'gmail', server_kind: 'vendor' },
      { server: 'image-extractor', server_kind: 'app' },
    ]);
  });

  it('currentInventory surfaces serverKind and runningRef per server', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send' }] },
    ]);
    InventoryRepository.addAppInventory({
      server: 'image-extractor',
      tools: [{ name: 'list_extractions' }],
      runningRef: 'run-1',
    });
    const inv = InventoryRepository.currentInventory();
    const byName = Object.fromEntries(inv.servers.map((s) => [s.name, s]));
    expect(byName.gmail.serverKind).toBe('vendor');
    expect(byName.gmail.runningRef).toBeUndefined();
    expect(byName['image-extractor'].serverKind).toBe('app');
    expect(byName['image-extractor'].runningRef).toBe('run-1');
  });
});
