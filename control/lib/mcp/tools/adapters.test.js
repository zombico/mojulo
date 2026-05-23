import { describe, it, expect } from 'vitest';
import { getAdapterHandler, listAdaptersHandler } from './adapters.js';
import { rememberClientInfo, _resetClientBindingsForTests } from '@/lib/mcp/client-bindings';

describe('listAdaptersHandler', () => {
  it('returns the shipped adapters wrapped with total', async () => {
    const out = await listAdaptersHandler({});
    expect(out.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(out.adapters)).toBe(true);
    const ids = out.adapters.map((a) => a.id);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('codex');
    expect(ids).toContain('generic');
  });

  it('omits the body from list entries', async () => {
    const out = await listAdaptersHandler({});
    for (const a of out.adapters) {
      expect(a).not.toHaveProperty('body');
      expect(a).toHaveProperty('artifactTarget');
    }
  });
});

describe('getAdapterHandler — resolution order', () => {
  it('explicit id wins', async () => {
    _resetClientBindingsForTests();
    rememberClientInfo('test-adapter-1', { name: 'claude-code' });
    const out = await getAdapterHandler(
      { id: 'codex' },
      { mcpSessionId: 'test-adapter-1' }
    );
    expect(out.id).toBe('codex');
  });

  it('clientInfoHint wins when id is omitted', async () => {
    _resetClientBindingsForTests();
    rememberClientInfo('test-adapter-2', { name: 'claude-code' });
    const out = await getAdapterHandler(
      { clientInfoHint: 'codex' },
      { mcpSessionId: 'test-adapter-2' }
    );
    expect(out.id).toBe('codex');
  });

  it('captured clientInfo.name wins when id and clientInfoHint are omitted', async () => {
    _resetClientBindingsForTests();
    rememberClientInfo('test-adapter-3', { name: 'claude-code' });
    const out = await getAdapterHandler({}, { mcpSessionId: 'test-adapter-3' });
    expect(out.id).toBe('claude-code');
  });

  it('falls back to generic when nothing matches', async () => {
    _resetClientBindingsForTests();
    const out = await getAdapterHandler({}, { mcpSessionId: 'test-adapter-4' });
    expect(out.id).toBe('generic');
  });

  it('clientInfoHint matches case-insensitively (Codex CLI variant)', async () => {
    _resetClientBindingsForTests();
    const out = await getAdapterHandler(
      { clientInfoHint: 'CODEX-CLI-2.1' },
      { mcpSessionId: 'test-adapter-5' }
    );
    expect(out.id).toBe('codex');
  });

  it('returns the adapter body', async () => {
    _resetClientBindingsForTests();
    const out = await getAdapterHandler({ id: 'codex' }, { mcpSessionId: 'test-adapter-6' });
    expect(typeof out.body).toBe('string');
    expect(out.body).toMatch(/Codex/);
  });

  it('throws when an explicit id is unknown — does not silently fall back', async () => {
    // Explicit `id` is treated as the agent making a specific request; if
    // it doesn't exist, surfacing the error is more useful than silently
    // delivering the generic adapter. (The fallback path lives in
    // resolveAdapterId for the id-omitted case, not here.)
    _resetClientBindingsForTests();
    await expect(
      getAdapterHandler({ id: 'no-such-adapter' }, { mcpSessionId: 'test-adapter-7' })
    ).rejects.toThrow(/not found/);
  });

  it('clientInfoHint that does not match anything falls back to generic', async () => {
    _resetClientBindingsForTests();
    const out = await getAdapterHandler(
      { clientInfoHint: 'some-unrelated-runtime' },
      { mcpSessionId: 'test-adapter-8' }
    );
    expect(out.id).toBe('generic');
  });
});
