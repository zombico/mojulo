// Isolate this test file to an in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '@/lib/db/index';
import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';
import { commitOperatorKyc } from './meta-context.js';
import {
  recordCapabilitiesHandler,
  getCapabilitiesHandler,
  _internals,
} from './mcp-capabilities.js';

beforeEach(() => {
  closeDb();
});

describe('recordCapabilitiesHandler: input validation', () => {
  it('throws when input is not an object', async () => {
    getDb();
    await expect(recordCapabilitiesHandler(null)).rejects.toThrow(/object input/);
    await expect(recordCapabilitiesHandler('x')).rejects.toThrow(/object input/);
  });

  it('throws when provider_ref is missing', async () => {
    getDb();
    await expect(
      recordCapabilitiesHandler({ body_md: 'body' })
    ).rejects.toThrow(/provider_ref/);
  });

  it('throws when provider_ref is empty / whitespace', async () => {
    getDb();
    await expect(
      recordCapabilitiesHandler({ provider_ref: '   ', body_md: 'body' })
    ).rejects.toThrow(/provider_ref/);
  });

  it('throws when body_md is missing', async () => {
    getDb();
    await expect(
      recordCapabilitiesHandler({ provider_ref: 'gmail' })
    ).rejects.toThrow(/body_md/);
  });

  it('throws when body_md is empty', async () => {
    getDb();
    await expect(
      recordCapabilitiesHandler({ provider_ref: 'gmail', body_md: '   ' })
    ).rejects.toThrow(/body_md/);
  });
});

describe('recordCapabilitiesHandler: happy path', () => {
  it('inserts a first capability row and returns the rich response shape', async () => {
    getDb();
    const res = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      display_name: 'Gmail',
      version_tag: 'API v1',
      body_md: 'gmail vendor body',
      source_urls: ['https://developers.google.com/gmail'],
    });
    expect(res.ok).toBe(true);
    expect(res.providerRef).toBe('gmail');
    expect(res.versionTag).toBe('API v1');
    expect(res.supersededId).toBe(null);
    expect(res.provenance).toBe('research');
    expect(typeof res.id).toBe('number');
    expect(typeof res.providerId).toBe('number');
    expect(typeof res.discoveredAt).toBe('number');
  });

  it('trims provider_ref whitespace before writing', async () => {
    getDb();
    const res = await recordCapabilitiesHandler({
      provider_ref: '  notion  ',
      body_md: 'body',
    });
    expect(res.providerRef).toBe('notion');
  });

  it('supersedes the prior current row on second write', async () => {
    getDb();
    const first = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'v1',
    });
    const second = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'v2',
      version_tag: 'v2',
    });
    expect(second.supersededId).toBe(first.id);
    // Repo confirms current row flipped.
    const current = CapabilitiesRepository.getCurrent('gmail');
    expect(current.id).toBe(second.id);
    expect(current.bodyMd).toBe('v2');
  });

  it('reports provenance="seed" when source_urls[0] starts with mojulo://', async () => {
    getDb();
    const res = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'body',
      source_urls: ['mojulo://CHANGELOG#v0.5.0'],
    });
    expect(res.provenance).toBe('seed');
  });

  it('surfaces no_operator_anchor warning when no KYC has been committed', async () => {
    getDb();
    const res = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'body',
    });
    expect(res.warnings).toEqual(['no_operator_anchor']);
  });

  it('omits warnings field when an operator anchor exists', async () => {
    getDb();
    await commitOperatorKyc({
      role: 'test operator',
      constraints: ['test constraint'],
    });
    const res = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'body',
    });
    expect(res.warnings).toBeUndefined();
  });
});

describe('getCapabilitiesHandler: input validation', () => {
  it('throws when input is not an object', async () => {
    getDb();
    await expect(getCapabilitiesHandler(null)).rejects.toThrow(/object input/);
  });

  it('throws when provider_ref is missing', async () => {
    getDb();
    await expect(getCapabilitiesHandler({})).rejects.toThrow(/provider_ref/);
  });

  it('throws when provider_ref is empty', async () => {
    getDb();
    await expect(getCapabilitiesHandler({ provider_ref: '' })).rejects.toThrow(/provider_ref/);
  });

  it('throws when asOf is provided but not parseable as ISO 8601', async () => {
    getDb();
    await expect(
      getCapabilitiesHandler({ provider_ref: 'gmail', asOf: 'not-a-date' })
    ).rejects.toThrow(/asOf/);
  });
});

describe('getCapabilitiesHandler: not found', () => {
  it('returns found=false with a hint for unknown providers', async () => {
    getDb();
    const res = await getCapabilitiesHandler({ provider_ref: 'unknown' });
    expect(res.ok).toBe(true);
    expect(res.found).toBe(false);
    expect(res.providerRef).toBe('unknown');
    expect(res.hint).toMatch(/research-mcp-vendor/);
  });

  it('returns found=false when asOf precedes the first row', async () => {
    getDb();
    CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v1',
      discoveredAt: 2000,
    });
    const res = await getCapabilitiesHandler({
      provider_ref: 'gmail',
      asOf: '1970-01-01T00:00:00Z',
    });
    expect(res.found).toBe(false);
  });
});

describe('getCapabilitiesHandler: found', () => {
  it('returns the current row when asOf is omitted', async () => {
    getDb();
    await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      display_name: 'Gmail',
      version_tag: 'API v1',
      body_md: 'gmail body',
      source_urls: ['https://docs.example.com'],
    });
    const res = await getCapabilitiesHandler({ provider_ref: 'gmail' });
    expect(res.ok).toBe(true);
    expect(res.found).toBe(true);
    expect(res.providerRef).toBe('gmail');
    expect(res.versionTag).toBe('API v1');
    expect(res.bodyMd).toBe('gmail body');
    expect(res.sourceUrls).toEqual(['https://docs.example.com']);
    expect(res.supersededBy).toBe(null);
    expect(typeof res.id).toBe('number');
    expect(typeof res.providerId).toBe('number');
    expect(typeof res.discoveredAt).toBe('number');
  });

  it('walks the supersession chain via asOf', async () => {
    getDb();
    const v1 = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v1',
      discoveredAt: 1000,
    });
    const v2 = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v2',
      discoveredAt: 2000,
    });
    CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v3',
      discoveredAt: 3000,
    });

    // At t=1500 (ISO), v1 was current.
    const at1500 = await getCapabilitiesHandler({
      provider_ref: 'gmail',
      asOf: new Date(1500 * 1000).toISOString(),
    });
    expect(at1500.id).toBe(v1.id);
    expect(at1500.bodyMd).toBe('v1');

    // At t=2500, v2 was current.
    const at2500 = await getCapabilitiesHandler({
      provider_ref: 'gmail',
      asOf: new Date(2500 * 1000).toISOString(),
    });
    expect(at2500.id).toBe(v2.id);
  });

  it('trims provider_ref whitespace before lookup', async () => {
    getDb();
    await recordCapabilitiesHandler({ provider_ref: 'gmail', body_md: 'body' });
    const res = await getCapabilitiesHandler({ provider_ref: '  gmail  ' });
    expect(res.found).toBe(true);
  });
});

describe('_internals.parseIsoToUnixSeconds', () => {
  it('parses a valid ISO 8601 string', () => {
    expect(_internals.parseIsoToUnixSeconds('2026-05-25T00:00:00Z')).toBe(
      Math.floor(Date.parse('2026-05-25T00:00:00Z') / 1000)
    );
  });

  it('throws on empty string', () => {
    expect(() => _internals.parseIsoToUnixSeconds('')).toThrow(/non-empty ISO/);
  });

  it('throws on non-string input', () => {
    expect(() => _internals.parseIsoToUnixSeconds(null)).toThrow(/non-empty ISO/);
    expect(() => _internals.parseIsoToUnixSeconds(42)).toThrow(/non-empty ISO/);
  });

  it('throws on unparseable string', () => {
    expect(() => _internals.parseIsoToUnixSeconds('garbage')).toThrow(/not a valid/);
  });
});
