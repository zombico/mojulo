#!/usr/bin/env node
/**
 * Config CLI for the mojulo control plane.
 *
 * Writes / reads provider keys in the existing encrypted api_keys table —
 * same source the Settings UI populates, same AES-256-GCM encryption
 * ([@/lib/deployment-auth](../lib/deployment-auth.js)). This deviates from
 * §9 of the release plan (which sketched a plaintext ~/.mojulo/config.json):
 * single source of truth, reuses encryption, no downstream resolver shim.
 *
 * Usage:
 *   mojulo-config set anthropic sk-ant-...
 *   mojulo-config set openai sk-...
 *   mojulo-config set ollama http://localhost:11434
 *   mojulo-config list
 *   mojulo-config unset openai
 *
 * `set` replaces any existing key(s) for that provider with a single fresh
 * row, and marks it default if no default exists. The one reader of a saved
 * key is mint_solid's via:'prompt' door, so the providers are its LLM
 * providers. `list` and `unset` also reach a row for a provider 3.0 no longer
 * takes (a 2.x Fly deploy token, which only the chatbot factory read).
 */

import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

register('./mcp-stdio-loader.mjs', import.meta.url);

resolveMojuloPaths();

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(CONTROL_DIR);

const { LLM_PROVIDERS } = await import('@/lib/llm-providers');
const ALLOWED_PROVIDERS = new Set(Object.keys(LLM_PROVIDERS));

function usage(exitCode = 0) {
  const lines = [
    'Usage:',
    '  mojulo-config set <provider> <value>',
    '  mojulo-config list',
    '  mojulo-config unset <provider>',
    '',
    `Providers: ${[...ALLOWED_PROVIDERS].join(', ')}`,
  ];
  process.stdout.write(lines.join('\n') + '\n');
  process.exit(exitCode);
}

function maskValue(plaintext) {
  if (!plaintext) return '(empty)';
  if (plaintext.length <= 8) return '*'.repeat(plaintext.length);
  return `${plaintext.slice(0, 4)}…${plaintext.slice(-4)}`;
}

async function setKey(provider, value) {
  const { ApiKeyRepository } = await import('@/lib/db/repositories/apiKeys');
  const { encryptApiKey } = await import('@/lib/deployment-auth');

  const existing = await ApiKeyRepository.findByUserId('local');
  const sameProvider = existing.filter((k) => k.provider === provider);
  for (const row of sameProvider) {
    await ApiKeyRepository.delete(row.id);
  }

  const remaining = existing.filter((k) => k.provider !== provider);
  const isDefault = !remaining.some((k) => k.isDefault);

  await ApiKeyRepository.create({
    name: `${provider}-cli`,
    provider,
    encryptedKey: encryptApiKey(value),
    isDefault,
  });

  process.stdout.write(
    `Set ${provider} → ${maskValue(value)}${isDefault ? ' (default)' : ''}\n`
  );
}

async function listKeys() {
  const { ApiKeyRepository } = await import('@/lib/db/repositories/apiKeys');
  const keys = await ApiKeyRepository.findByUserId('local');
  if (keys.length === 0) {
    process.stdout.write('No provider keys configured.\n');
    process.stdout.write('Set one with: mojulo-config set anthropic sk-ant-...\n');
    return;
  }
  const rows = keys.map((k) => ({
    provider: k.provider,
    name: k.name,
    default: k.isDefault ? '*' : '',
  }));
  const retired = [...new Set(rows.map((r) => r.provider).filter((p) => !ALLOWED_PROVIDERS.has(p)))];
  const widths = {
    provider: Math.max(8, ...rows.map((r) => r.provider.length)),
    name: Math.max(4, ...rows.map((r) => r.name.length)),
    default: 7,
  };
  const fmt = (r) =>
    `${r.provider.padEnd(widths.provider)}  ${r.name.padEnd(widths.name)}  ${r.default}`;
  process.stdout.write(fmt({ provider: 'provider', name: 'name', default: 'default' }) + '\n');
  process.stdout.write(
    `${'-'.repeat(widths.provider)}  ${'-'.repeat(widths.name)}  ${'-'.repeat(widths.default)}\n`
  );
  for (const r of rows) process.stdout.write(fmt(r) + '\n');
  if (retired.length) {
    process.stdout.write(
      `\nNothing in this version reads ${retired.join(', ')} (saved by an earlier install). ` +
        `Remove with: mojulo-config unset ${retired[0]}\n`
    );
  }
}

async function unsetKey(provider) {
  const { ApiKeyRepository } = await import('@/lib/db/repositories/apiKeys');
  const existing = await ApiKeyRepository.findByUserId('local');
  const sameProvider = existing.filter((k) => k.provider === provider);
  if (sameProvider.length === 0) {
    // A provider this version does not take is only reachable while a row for it exists.
    if (!ALLOWED_PROVIDERS.has(provider)) {
      process.stderr.write(`Unknown provider: ${provider}\n`);
      usage(2);
    }
    process.stdout.write(`No keys for ${provider}.\n`);
    return;
  }
  for (const row of sameProvider) {
    await ApiKeyRepository.delete(row.id);
  }
  process.stdout.write(`Removed ${sameProvider.length} key(s) for ${provider}.\n`);
}

const [, , subcommand, ...rest] = process.argv;

if (!subcommand || subcommand === '-h' || subcommand === '--help') {
  usage(0);
}

try {
  if (subcommand === 'set') {
    const [provider, value] = rest;
    if (!provider || !value) {
      process.stderr.write('set requires <provider> <value>\n');
      usage(2);
    }
    if (!ALLOWED_PROVIDERS.has(provider)) {
      process.stderr.write(`Unknown provider: ${provider}\n`);
      usage(2);
    }
    await setKey(provider, value);
  } else if (subcommand === 'list') {
    await listKeys();
  } else if (subcommand === 'unset') {
    const [provider] = rest;
    if (!provider) {
      process.stderr.write('unset requires <provider>\n');
      usage(2);
    }
    await unsetKey(provider);
  } else {
    process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
    usage(2);
  }
} catch (err) {
  process.stderr.write(`mojulo-config: ${err.message || err}\n`);
  process.exit(1);
}

process.exit(0);
