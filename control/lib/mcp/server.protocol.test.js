// Isolate to in-memory SQLite before any import that pulls db/index.js —
// same pattern as context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import {
  dispatchMcpRequest,
  ensureToolsRegistered,
  negotiateProtocolVersion,
  SUPPORTED_PROTOCOL_VERSIONS,
  LATEST_PROTOCOL_VERSION,
} from '@/lib/mcp/server';

// Protocol version negotiation at `initialize`: echo the client's revision when
// this server speaks it, otherwise answer with the newest one. Tool annotations
// (2025-03-26) and tool titles (2025-06-18) ride tools/list, so a client asking
// for either revision must get it back rather than being held at 2024-11-05.

const initialize = (params, id = 1) =>
  dispatchMcpRequest(
    { jsonrpc: '2.0', id, method: 'initialize', params },
    { mcpSessionId: `protocol-test-${id}` },
  );

describe('protocol version negotiation', () => {
  it('speaks 2025-06-18, 2025-03-26 and 2024-11-05, newest first', () => {
    expect(SUPPORTED_PROTOCOL_VERSIONS).toEqual(['2025-06-18', '2025-03-26', '2024-11-05']);
    expect(LATEST_PROTOCOL_VERSION).toBe('2025-06-18');
  });

  it.each(['2025-06-18', '2025-03-26', '2024-11-05'])('answers a request for %s with %s', async (version) => {
    const reply = await initialize({ protocolVersion: version, clientInfo: { name: 'claude-code' } });
    expect(reply.result.protocolVersion).toBe(version);
  });

  it('answers an unknown or missing revision with the newest it speaks', async () => {
    expect((await initialize({ protocolVersion: '2099-01-01' }, 2)).result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    expect((await initialize({}, 3)).result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    expect((await initialize(undefined, 4)).result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    expect(negotiateProtocolVersion(42)).toBe(LATEST_PROTOCOL_VERSION);
  });

  it('keeps the rest of the handshake unchanged', async () => {
    const { result } = await initialize({ protocolVersion: '2025-06-18', clientInfo: { name: 'claude-code' } }, 5);
    expect(result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(result.serverInfo.name).toBe('mojulo-control-plane');
    expect(typeof result.instructions).toBe('string');
  });

  it('the version tool reports the newest revision and the supported list', async () => {
    await ensureToolsRegistered();
    const reply = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'version', arguments: {} } },
      { mcpSessionId: 'protocol-test-version' },
    );
    const body = JSON.parse(reply.result.content[0].text);
    expect(body.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    expect(body.supportedProtocolVersions).toEqual(SUPPORTED_PROTOCOL_VERSIONS);
  });
});
