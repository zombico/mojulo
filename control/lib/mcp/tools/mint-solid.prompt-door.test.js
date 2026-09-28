// Isolate to in-memory SQLite and a throwaway MOJULO_HOME (the saved key is
// encrypted under $MOJULO_HOME/secret.key).
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDb } from '@/lib/db/index';
import { ApiKeyRepository } from '@/lib/db/repositories/apiKeys';
import { encryptApiKey } from '@/lib/deployment-auth';
import { mintSolidHandler } from '@/lib/mcp/tools/mint-solid';
import { createPolygonizedSketchHandler } from '@/lib/mcp/tools/sketch-polygonizer';
import { resolvePolygonizerModelConfig } from '@/lib/graph/polygonizer/index.js';

// mint_solid kind:'manji-tree' via:'prompt' (and its hidden alias
// create_polygonized_sketch) sends the prompt to an LLM API. Before 3.0.0,
// with no provider given it quietly decrypted the operator's saved default
// OpenAI/Anthropic key and used it. Now the caller must name the provider.

const ORIGINAL_HOME = process.env.MOJULO_HOME;
let home;
let fetchSpy;

beforeAll(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-prompt-door-'));
  process.env.MOJULO_HOME = home;
  closeDb();
  await ApiKeyRepository.create({
    name: 'default anthropic',
    provider: 'anthropic',
    encryptedKey: encryptApiKey('sk-ant-saved'),
    isDefault: true,
  });
});

afterAll(() => {
  closeDb();
  if (ORIGINAL_HOME === undefined) delete process.env.MOJULO_HOME;
  else process.env.MOJULO_HOME = ORIGINAL_HOME;
  fs.rmSync(home, { recursive: true, force: true });
});

beforeEach(() => {
  fetchSpy = vi.fn(async () => {
    throw new Error('no network in this test');
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mint_solid via:'prompt' needs an explicit provider", () => {
  it('refuses without provider, even with a saved default key, and calls nothing', async () => {
    await expect(
      mintSolidHandler({ kind: 'manji-tree', via: 'prompt', spec: { prompt: 'a small squid' } }),
    ).rejects.toThrow(/`provider` is required/);
    await expect(createPolygonizedSketchHandler({ prompt: 'a small squid' })).rejects.toThrow(
      /`provider` is required.*via:'packet'/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('with the provider named, the saved key for it is used and reported', async () => {
    const config = await resolvePolygonizerModelConfig({ provider: 'anthropic' });
    expect(config).toMatchObject({ provider: 'anthropic', apiKey: 'sk-ant-saved', keySource: 'saved' });
  });

  it('a passed key wins over the saved one', async () => {
    const config = await resolvePolygonizerModelConfig({ provider: 'anthropic', apiKey: 'sk-ant-inline' });
    expect(config).toMatchObject({ apiKey: 'sk-ant-inline', keySource: 'apiKey' });
  });

  it('never crosses providers: no saved openai key means no call', async () => {
    await expect(resolvePolygonizerModelConfig({ provider: 'openai' })).rejects.toThrow(/No openai key/);
    const saved = await ApiKeyRepository.findByProvider('anthropic');
    await expect(
      resolvePolygonizerModelConfig({ provider: 'openai', apiKeyId: saved.id }),
    ).rejects.toThrow(/does not match/);
  });

  it("ollama needs no key and defaults to the local host", async () => {
    const config = await resolvePolygonizerModelConfig({ provider: 'ollama' });
    expect(config.keySource).toBe('ollama-default-host');
    expect(config.apiKey).toMatch(/^http:\/\/localhost:11434/);
  });

  it('rejects an unknown provider', async () => {
    await expect(resolvePolygonizerModelConfig({ provider: 'mystery' })).rejects.toThrow(/Unsupported provider/);
  });
});
