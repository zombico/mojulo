import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  verifyArtifact,
  verifyAppArtifact,
  _looksLikeFilesystemLocatorForTests as looksLikeFilesystemLocator,
} from './verification.js';

let tmpRoot;
let existingFile;
const missingFile = '/tmp/__definitely-not-here__/__nope__.md';

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-verification-test-'));
  existingFile = join(tmpRoot, 'artifact.md');
  writeFileSync(existingFile, '# stub');
});

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('looksLikeFilesystemLocator', () => {
  it('treats absolute POSIX paths as filesystem-shaped', () => {
    expect(looksLikeFilesystemLocator('/tmp/foo.md')).toBe(true);
  });
  it('treats relative ./ and ../ paths as filesystem-shaped', () => {
    expect(looksLikeFilesystemLocator('./foo.md')).toBe(true);
    expect(looksLikeFilesystemLocator('../foo.md')).toBe(true);
  });
  it('treats bare slugs as opaque handles', () => {
    expect(looksLikeFilesystemLocator('automation-handle-123')).toBe(false);
    expect(looksLikeFilesystemLocator('my-codex-automation')).toBe(false);
  });
  it('rejects empty / non-string locators', () => {
    expect(looksLikeFilesystemLocator('')).toBe(false);
    expect(looksLikeFilesystemLocator(null)).toBe(false);
    expect(looksLikeFilesystemLocator(undefined)).toBe(false);
  });
});

describe('verifyArtifact — claude-code', () => {
  it('accepts a file that exists on disk', () => {
    const r = verifyArtifact('claude-code', existingFile);
    expect(r.ok).toBe(true);
  });

  it('rejects a missing file with an actionable reason', () => {
    const r = verifyArtifact('claude-code', missingFile);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Claude Code/);
    expect(r.reason).toMatch(/nothing exists/);
  });
});

describe('verifyArtifact — generic', () => {
  it('accepts a file that exists on disk', () => {
    const r = verifyArtifact('generic', existingFile);
    expect(r.ok).toBe(true);
  });

  it('rejects a missing file', () => {
    const r = verifyArtifact('generic', missingFile);
    expect(r.ok).toBe(false);
  });
});

describe('verifyArtifact — codex', () => {
  it('accepts a workspace path that exists', () => {
    const r = verifyArtifact('codex', existingFile);
    expect(r.ok).toBe(true);
    expect(r.note).toBeUndefined();
  });

  it('rejects a workspace path that is filesystem-shaped but missing', () => {
    const r = verifyArtifact('codex', missingFile);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/does not exist/);
  });

  it('accepts an opaque automation handle on assertion, with a note', () => {
    const r = verifyArtifact('codex', 'my-automation-handle');
    expect(r.ok).toBe(true);
    expect(r.note).toBe('codex_accept_on_assertion');
  });
});

describe('verifyArtifact — rejection cases', () => {
  it('rejects unknown adapter ids', () => {
    const r = verifyArtifact('not-a-real-adapter', existingFile);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/unknown adapter/);
  });

  it('rejects missing adapter_id', () => {
    expect(verifyArtifact('', existingFile).ok).toBe(false);
    expect(verifyArtifact(null, existingFile).ok).toBe(false);
  });

  it('rejects missing locator', () => {
    expect(verifyArtifact('claude-code', '').ok).toBe(false);
    expect(verifyArtifact('claude-code', null).ok).toBe(false);
  });
});

// ── verifyAppArtifact ────────────────────────────────────────────────────
//
// App-paradigm spike: the artifact's directory must contain the scaffolded
// app-mcp/server.js. Materialization without a sidecar would leave the
// runner unable to lifecycle the app, so verification refuses the commit
// at the gate. See APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md.

describe('verifyAppArtifact — claude-code / generic', () => {
  it('accepts a directory whose app-mcp/server.js exists', () => {
    const appDir = join(tmpRoot, 'app-with-sidecar');
    mkdirSync(join(appDir, 'app-mcp'), { recursive: true });
    writeFileSync(join(appDir, 'app-mcp', 'server.js'), '// stub\n');
    expect(verifyAppArtifact('claude-code', appDir).ok).toBe(true);
    expect(verifyAppArtifact('generic', appDir).ok).toBe(true);
  });

  it('rejects a directory without the app-mcp scaffold', () => {
    const appDir = join(tmpRoot, 'app-no-sidecar');
    mkdirSync(appDir, { recursive: true });
    const r = verifyAppArtifact('claude-code', appDir);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/app-mcp scaffold missing/);
  });

  it('rejects when the artifact directory itself does not exist (base check fails first)', () => {
    const r = verifyAppArtifact('claude-code', missingFile);
    expect(r.ok).toBe(false);
    // The base claude-code message wins because the directory itself is gone.
    expect(r.reason).toMatch(/nothing exists/);
  });
});

describe('verifyAppArtifact — codex', () => {
  it('accepts opaque automation handles on assertion (carries the note through)', () => {
    const r = verifyAppArtifact('codex', 'opaque-codex-app-handle');
    expect(r.ok).toBe(true);
    expect(r.note).toBe('codex_accept_on_assertion');
  });

  it('still requires the scaffold when locator is a filesystem path', () => {
    const appDir = join(tmpRoot, 'codex-fs-app-no-sidecar');
    mkdirSync(appDir, { recursive: true });
    const r = verifyAppArtifact('codex', appDir);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/app-mcp scaffold missing/);
  });
});
