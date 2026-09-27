import { describe, it, expect, afterEach, vi } from 'vitest';
import { FlyDeployer, splitSecretEnv } from './fly.js';

// The operator's LLM key used to travel in the Fly machine config's `env`,
// readable by anyone who can read the machine. It now goes in as a Fly app
// secret, set before the machine is created so the machine boots with it.

const LLM_KEY = 'sk-ant-api03-operator-secret';
const BOT_KEY = 'bot_0123456789abcdef';

function fakeFly() {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method || 'GET', body });
    const json = (value) => ({ ok: true, status: 200, text: async () => JSON.stringify(value) });
    if (url === 'https://api.fly.io/graphql') {
      if (body.query.includes('setSecrets')) return json({ data: { setSecrets: { app: { name: 'a' } } } });
      return json({ data: { allocateIpAddress: { ipAddress: { address: '::1', type: 'v6' } } } });
    }
    if (url.endsWith('/ips')) return json([]);
    if (url.endsWith('/volumes') && init.method === 'POST') return json({ id: 'vol_1' });
    if (url.endsWith('/volumes')) return json([]);
    if (url.endsWith('/machines') && init.method === 'POST') return json({ id: 'm_1' });
    if (url.endsWith('/machines')) return json([]);
    return json({});
  });
  return { calls, fetchImpl };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FlyDeployer credentials', () => {
  it('splitSecretEnv keeps credentials apart from plain env', () => {
    const { plain, secrets } = splitSecretEnv({
      LLM_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: LLM_KEY,
      MOJULO_API_KEY: BOT_KEY,
      FOO_TOKEN: 't',
      DOCKER_RUN: 'true',
    });
    expect(plain).toEqual({ LLM_PROVIDER: 'anthropic', DOCKER_RUN: 'true' });
    expect(Object.keys(secrets).sort()).toEqual(['ANTHROPIC_API_KEY', 'FOO_TOKEN', 'MOJULO_API_KEY']);
  });

  it('sets the LLM and bot keys as Fly secrets before the machine, never in its config', async () => {
    const { calls, fetchImpl } = fakeFly();
    vi.stubGlobal('fetch', fetchImpl);
    const progress = [];
    const deployer = new FlyDeployer({ apiToken: 'fly-token', image: 'ghcr.io/zombico/mojulo-bot:0.5.2' });

    await deployer.deploy({
      appName: 'abc-bot',
      env: { LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: LLM_KEY, MOJULO_API_KEY: BOT_KEY },
      onProgress: (e) => progress.push(e),
    });

    const secretsCall = calls.findIndex((c) => c.body?.query?.includes('setSecrets'));
    const machineCall = calls.findIndex((c) => c.method === 'POST' && c.url.endsWith('/apps/abc-bot/machines'));
    expect(secretsCall).toBeGreaterThan(-1);
    expect(machineCall).toBeGreaterThan(secretsCall);

    expect(calls[secretsCall].body.variables.input).toEqual({
      appId: 'abc-bot',
      secrets: [
        { key: 'ANTHROPIC_API_KEY', value: LLM_KEY },
        { key: 'MOJULO_API_KEY', value: BOT_KEY },
      ],
      replaceAll: false,
    });

    const machineConfig = calls[machineCall].body.config;
    expect(machineConfig.env).toEqual({ DOCKER_RUN: 'true', LLM_PROVIDER: 'anthropic' });
    expect(JSON.stringify(calls[machineCall].body)).not.toContain(LLM_KEY);
    expect(JSON.stringify(calls[machineCall].body)).not.toContain(BOT_KEY);
    // The audit trail names the secrets, never their values.
    expect(JSON.stringify(progress)).not.toContain(LLM_KEY);
    expect(progress.some((e) => e.step === 'secrets')).toBe(true);
  });

  it('falls back to the pinned bot image when no image env is set', () => {
    const saved = { cloud: process.env.MOJULO_CLOUD_IMAGE, bot: process.env.BOT_IMAGE };
    delete process.env.MOJULO_CLOUD_IMAGE;
    delete process.env.BOT_IMAGE;
    try {
      expect(new FlyDeployer({ apiToken: 't' }).image).toMatch(/^ghcr\.io\/zombico\/mojulo-bot:\d+\.\d+\.\d+$/);
    } finally {
      if (saved.cloud !== undefined) process.env.MOJULO_CLOUD_IMAGE = saved.cloud;
      if (saved.bot !== undefined) process.env.BOT_IMAGE = saved.bot;
    }
  });
});
