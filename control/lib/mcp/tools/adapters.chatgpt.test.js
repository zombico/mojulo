process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdapterHandler } from './adapters.js';
import { getCatalystHandler } from './catalysts.js';
import { rememberClientInfo, _resetClientBindingsForTests } from '../client-bindings.js';

afterEach(() => {
  vi.unstubAllEnvs();
  _resetClientBindingsForTests();
});

describe('ChatGPT adapter tool entry points', () => {
  it('returns the ChatGPT card to a shell caller with no initialize', async () => {
    vi.stubEnv('MOJULO_HOST', 'chatgpt');
    expect((await getAdapterHandler({})).id).toBe('chatgpt');
    expect((await getAdapterHandler({ id: 'generic' })).id).toBe('generic');
    expect((await getAdapterHandler({ clientInfoHint: 'codex' })).id).toBe('codex');
  });

  it('uses captured client identity before a process fallback', async () => {
    vi.stubEnv('MOJULO_HOST', 'chatgpt');
    rememberClientInfo('codex-session', { name: 'codex' });
    expect((await getAdapterHandler({}, { mcpSessionId: 'codex-session' })).id).toBe('codex');
  });

  it('composes the same card into shell catalyst workflows', async () => {
    vi.stubEnv('MOJULO_HOST', 'chatgpt');
    const result = await getCatalystHandler({ id: 'refresh-connected-services' });
    expect(result.adapter.id).toBe('chatgpt');
    expect(result.body).toContain('## Preserve and resume');
  });
});
