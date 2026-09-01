/**
 * Host profile registry — schema, capability resolution, path expansion.
 *
 * The init writers are exercised end-to-end in [../../../scripts/mcp-init.test.js];
 * this suite covers what the SERVER reads (capability flags) and the shape
 * contract a new profile has to satisfy.
 */

import { describe, it, expect } from 'vitest';
import {
  listHostProfiles,
  getHostProfile,
  hostProfileForAdapter,
  hostCapabilities,
  expandPath,
} from './registry.js';

describe('host profile registry', () => {
  it('loads the shipped profiles in declared order', () => {
    expect(listHostProfiles().map((p) => p.id)).toEqual([
      'claude-code',
      'codex',
      'desktop',
      'grok',
      'hermes',
    ]);
  });

  it('every profile carries a known wire format and a manual snippet', () => {
    for (const profile of listHostProfiles()) {
      expect(['cli-shellout', 'toml-append', 'json-patch', 'manual']).toContain(profile.wire.format);
      expect(profile.manual.length).toBeGreaterThan(0);
    }
  });

  it('maps a resolved adapter id back to its host profile', () => {
    expect(hostProfileForAdapter('claude-code').id).toBe('claude-code');
    expect(hostProfileForAdapter('codex').id).toBe('codex');
    // `generic` is an adapter with no host to detect; desktop is a host with no
    // card of its own. Both asymmetries are why the two registries stay split.
    expect(hostProfileForAdapter('generic')).toBeNull();
    expect(getHostProfile('desktop').adapterId).toBeNull();
  });

  it('preserves the packs default: claude-code defers schemas, nothing else does', () => {
    expect(hostCapabilities('claude-code').defersToolSchemas).toBe(true);
    expect(hostCapabilities('codex').defersToolSchemas).toBe(false);
    expect(hostCapabilities('generic').defersToolSchemas).toBe(false);
    expect(hostCapabilities(undefined).defersToolSchemas).toBe(false);
  });

  it('carries the declared runtime traits the server and the cards read', () => {
    // Grok's cap is the one measured substrate constraint (20k MCP output).
    expect(hostCapabilities('grok-build').maxOutputBytes).toBe(20000);
    expect(hostCapabilities('grok-build').nativeImageGen).toBe(true);
    // Claude Code is still the only headless fulfiller.
    expect(hostCapabilities('claude-code').headlessRuntime).toBe('claude-code-headless');
    for (const id of ['codex', 'grok-build', 'hermes']) {
      expect(hostCapabilities(id).headlessRuntime).toBeNull();
    }
  });

  it('never declares a writer for a host whose config format is unverified', () => {
    // A guessed configPath would print a false success against a file the host
    // never reads. `manual` is the honest state until someone verifies it.
    const hermes = getHostProfile('hermes');
    expect(hermes.wire.format).toBe('manual');
    expect(hermes.wire.configPath).toBeUndefined();
    expect(hermes.wire.verify).toMatch(/UNVERIFIED/);
  });

  it('fills capability defaults so an undeclared trait never reads as enabled', () => {
    const caps = hostCapabilities('nonexistent-host');
    expect(caps).toMatchObject({ defersToolSchemas: false, maxOutputBytes: null, headlessRuntime: null });
  });

  it('expands ~, windows env tokens, and per-platform maps', () => {
    expect(expandPath('~/.codex/config.toml', { home: '/h' })).toBe('/h/.codex/config.toml');
    expect(expandPath({ darwin: '~/a', default: '~/b' }, { platform: 'darwin', home: '/h' })).toBe('/h/a');
    expect(expandPath({ darwin: '~/a', default: '~/b' }, { platform: 'linux', home: '/h' })).toBe('/h/b');
    expect(expandPath({ darwin: '~/a' }, { platform: 'linux', home: '/h' })).toBeNull();
    expect(expandPath(null)).toBeNull();
    expect(expandPath('%APPDATA%/Claude/x.json', { home: '/h' })).toContain('/Claude/x.json');
  });

  it('does not treat a path-like prefix as a home expansion', () => {
    expect(expandPath('~notahome/x', { home: '/h' })).toBe('~notahome/x');
  });
});
