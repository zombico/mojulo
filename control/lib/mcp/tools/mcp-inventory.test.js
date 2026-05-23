// Isolate this test file to an in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { MetaNodeRepository } from '@/lib/db/repositories/meta-context';
import { declareInventoryHandler } from './mcp-inventory.js';

beforeEach(() => {
  closeDb();
});

describe('declareInventoryHandler', () => {
  it('happy path — declares inventory and returns counts', async () => {
    const out = await declareInventoryHandler({
      servers: [
        {
          name: 'gmail',
          tools: [
            { name: 'send_message', description: 'Send a Gmail message' },
            { name: 'search_messages' },
          ],
        },
        { name: 'gdrive', tools: [{ name: 'list_recent_files' }] },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.serversSeen).toBe(2);
    expect(out.toolsSeen).toBe(3);
    expect(out.replaced).toBe(0);
    expect(out.declaredAt).toBeGreaterThan(0);
  });

  it('replace semantics — second call wipes the first', async () => {
    await declareInventoryHandler({
      servers: [
        { name: 'gmail', tools: [{ name: 'send_message' }, { name: 'search_messages' }] },
        { name: 'gdrive', tools: [{ name: 'list_recent_files' }] },
      ],
    });
    const out = await declareInventoryHandler({
      servers: [{ name: 'linear', tools: [{ name: 'create_issue' }] }],
    });
    expect(out.replaced).toBe(3);
    expect(out.toolsSeen).toBe(1);

    expect(InventoryRepository.findByRef('gmail.send_message')).toBeNull();
    expect(InventoryRepository.findByRef('linear.create_issue')).not.toBeNull();
  });

  it('empty servers array wipes inventory and returns toolsSeen: 0', async () => {
    await declareInventoryHandler({
      servers: [{ name: 'gmail', tools: [{ name: 'send_message' }] }],
    });
    const out = await declareInventoryHandler({ servers: [] });
    expect(out.replaced).toBe(1);
    expect(out.toolsSeen).toBe(0);
    expect(InventoryRepository.hasInventory()).toBe(false);
  });

  it('warns when no operator anchor exists', async () => {
    const out = await declareInventoryHandler({
      servers: [{ name: 'gmail', tools: [{ name: 'send_message' }] }],
    });
    expect(out.warnings).toEqual(['no_operator_anchor']);
  });

  it('omits warnings when operator anchor exists', async () => {
    MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    const out = await declareInventoryHandler({
      servers: [{ name: 'gmail', tools: [{ name: 'send_message' }] }],
    });
    expect(out.warnings).toBeUndefined();
  });

  it('rejects missing input object', async () => {
    await expect(declareInventoryHandler(null)).rejects.toThrow(/object with a `servers` array/);
    await expect(declareInventoryHandler('hi')).rejects.toThrow(/object with a `servers` array/);
  });

  it('rejects missing servers array', async () => {
    await expect(declareInventoryHandler({})).rejects.toThrow(/`servers` must be an array/);
    await expect(declareInventoryHandler({ servers: 'gmail' })).rejects.toThrow(
      /`servers` must be an array/,
    );
  });

  it('propagates repository validation errors', async () => {
    await expect(
      declareInventoryHandler({ servers: [{ name: 'gmail' }] }),
    ).rejects.toThrow(/tools array/);
    await expect(
      declareInventoryHandler({
        servers: [{ name: 'gmail', tools: [{ description: 'no name' }] }],
      }),
    ).rejects.toThrow(/non-empty name/);
  });
});
