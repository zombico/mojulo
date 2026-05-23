import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  verifyArtifact,
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
