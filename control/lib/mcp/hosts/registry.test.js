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
  hostHandoff,
  expandPath,
  HANDOFF_PAGE_DOORS,
  HANDOFF_FILE_DOORS,
  HANDOFF_VERIFIED,
} from './registry.js';

describe('host profile registry', () => {
  it('loads the shipped profiles in declared order', () => {
    expect(listHostProfiles().map((p) => p.id)).toEqual([
      'claude-code',
      'codex',
      'desktop',
      'grok',
      'hermes',
      'grok-chat',
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

  // remote-worker exports P1: every shipped profile says how an export reaches the operator,
  // and says how sure we are. A door outside the vocabulary is a typo the note would print.
  it('every shipped profile carries a handoff door table with a verified level', () => {
    for (const profile of listHostProfiles()) {
      const h = profile.handoff;
      expect(h, `${profile.id} has no handoff`).toBeTruthy();
      expect(HANDOFF_VERIFIED.has(h.verified), `${profile.id} verified='${h.verified}'`).toBe(true);
      expect(Boolean(h.local || h.box)).toBe(true);
      for (const row of [h.local, h.box].filter(Boolean)) {
        expect(HANDOFF_PAGE_DOORS.has(row.page), `${profile.id} page='${row.page}'`).toBe(true);
        expect(HANDOFF_FILE_DOORS.has(row.file), `${profile.id} file='${row.file}'`).toBe(true);
      }
      if (h.box) {
        expect(typeof h.box.name).toBe('string');
        expect(typeof h.box.ephemeral).toBe('boolean');
      }
    }
  });

  it('records the doors the research and the field runs established', () => {
    // Claude Code: the operator's machine has the dashboard; the web box has the Artifact tool
    // (one self-contained page ≤ 16 MiB) and a download allowlist that carries zip, not glb.
    const cc = hostHandoff('claude-code');
    expect(cc.local).toEqual({ page: 'dashboard', file: 'local' });
    expect(cc.box.page).toBe('artifact');
    expect(cc.box.pageMaxBytes).toBe(16 * 1024 * 1024);
    expect(cc.box.downloadExtensions).toContain('zip');
    expect(cc.box.downloadExtensions).not.toContain('glb');
    expect(cc.box.cdns).toContain('cdn.jsdelivr.net/npm/');
    expect(cc.box.ephemeral).toBe(true);
    // the operator opened the published page and saved the zip through the courier on 2026-09-22
    expect(cc.verified).toBe('field');
    // Codex cloud hands back a PR and nothing else.
    expect(hostHandoff('codex').box).toMatchObject({ page: 'none', file: 'git', ephemeral: true });
    // Grok chat's sandbox is the field-run box with no MCP client: files as cards, inferred.
    const gc = hostHandoff('grok-chat');
    expect(gc.local).toBeUndefined();
    expect(gc.box).toMatchObject({ page: 'file-card', file: 'file-card', ephemeral: true });
    expect(gc.verified).toBe('inferred');
    expect(getHostProfile('grok-chat').wire.format).toBe('manual');
    // Desktop's MCP App door is the flagged P6 spike; until it lands the dashboard is the door.
    expect(hostHandoff('desktop').local.page).toBe('dashboard');
    expect(hostHandoff('desktop').box).toBeUndefined();
    // Unknown host: no table, the caller prints the generic file:// sentence.
    expect(hostHandoff('nonexistent-host')).toBeNull();
    expect(hostHandoff(null)).toBeNull();
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
