// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getOrCreateBuilderSession,
  resetBuilderSession,
} from '@/lib/mcp/session-binding';
import { executeBuilderTool } from '@/lib/builder/tool-executors';
import { BuilderSessionRepository, SESSION_STATUS } from '@/lib/db/repositories/builderSessions';
import { ApiKeyRepository } from '@/lib/db/repositories/apiKeys';

// R2 (0813 persona sims — Devon): the MCP connection→session binding rotated 4×
// across one build flow, stranding processed documents and failing the save with
// "Session ID mismatch" against the very ID get_builder_session had returned.
// Sessions were always durable rows; the binding now resumes them, the save
// adopts an explicit sessionId, and the deployed bot's LLM is an explicit gate.

const USER = 'local';

beforeAll(async () => {
  await ApiKeyRepository.create({
    name: 'test anthropic',
    provider: 'anthropic',
    encryptedKey: 'enc-test',
    isDefault: true,
  });
});

describe('durable builder session binding', () => {
  it('a rotated MCP connection resumes the SAME session (no work stranded)', async () => {
    const first = await getOrCreateBuilderSession('conn-a', USER);
    // simulate the binding map losing conn-a: a brand-new connection id arrives
    const second = await getOrCreateBuilderSession('conn-b', USER);
    expect(second.id).toBe(first.id);
  });

  it('start_new_bot abandons durably — reset survives further rotations', async () => {
    const before = await getOrCreateBuilderSession('conn-c', USER);
    await resetBuilderSession('conn-c', USER);
    const after = await getOrCreateBuilderSession('conn-d', USER);
    expect(after.id).not.toBe(before.id);
    const abandoned = await BuilderSessionRepository.findById(before.id);
    expect(abandoned.status).toBe(SESSION_STATUS.ABANDONED);
  });
});

describe('save_modular_bot: explicit sessionId adoption + LLM gate', () => {
  it('adopts the named session when the bound one rotated — the gate answers, never "mismatch"', async () => {
    const real = await getOrCreateBuilderSession('conn-e', USER);
    // context carries a DIFFERENT (stale) bound session, as Devon's did
    const stale = await BuilderSessionRepository.create({ userId: USER });
    const result = await executeBuilderTool(
      'save_modular_bot',
      { sessionId: real.id, confirmedProtocols: {} },
      { session: stale, userId: USER },
    );
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/mismatch/i);
    // adoption reached the real (mcp-origin) session, so the LLM gate speaks —
    // listing the configured key and the keyless option, with nothing saved
    expect(result.error).toMatch(/llm/);
    expect(result.error).toMatch(/anthropic 'test anthropic'/);
    expect(result.error).toMatch(/ollama/);
    expect(result.error).toMatch(/session is intact/);
  });

  it('an unknown sessionId still refuses, with a recoverable instruction', async () => {
    const stale = await BuilderSessionRepository.create({ userId: USER });
    const result = await executeBuilderTool(
      'save_modular_bot',
      { sessionId: 'mod_does_not_exist', confirmedProtocols: {} },
      { session: stale, userId: USER },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/get_builder_session/);
  });

  it('a malformed llm choice is refused with the contract', async () => {
    const real = await getOrCreateBuilderSession('conn-f', USER);
    const result = await executeBuilderTool(
      'save_modular_bot',
      { sessionId: real.id, confirmedProtocols: {}, llm: { provider: 'grok' } },
      { session: real, userId: USER },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/anthropic.*openai.*ollama/);
  });

  it('an explicit llm choice records provider/model/key on the session core config', async () => {
    await resetBuilderSession('conn-f', USER);
    const real = await getOrCreateBuilderSession('conn-g', USER);
    // provider with exactly one configured key: apiKeyId resolves automatically
    const result = await executeBuilderTool(
      'save_modular_bot',
      { sessionId: real.id, confirmedProtocols: {}, llm: { provider: 'anthropic' } },
      { session: real, userId: USER },
    );
    // the choice must be recorded regardless of how far the save pipeline got
    const fresh = await BuilderSessionRepository.findById(real.id);
    expect(fresh.generatedConfigs.core.provider).toBe('anthropic');
    expect(fresh.generatedConfigs.core.llmExplicit).toBe(true);
    expect(fresh.generatedConfigs.core.apiKeyId).toBeTruthy();
    expect(fresh.generatedConfigs.core.model).toBeTruthy();
    // and the gate no longer fires on this session
    if (!result.success) expect(result.error).not.toMatch(/needs the deployed bot's LLM/);
  });
});
