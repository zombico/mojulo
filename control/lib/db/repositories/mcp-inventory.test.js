// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js (getDb is lazy and reads SQLITE_PATH on first
// call). Vitest workers isolate sibling files so this doesn't leak.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '../index.js';
import { InventoryRepository } from './mcp-inventory.js';

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
