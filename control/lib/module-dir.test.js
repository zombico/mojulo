import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleDir } from './module-dir.js';

const ORIGINAL = process.env.MOJULO_CONTROL_DIR;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.MOJULO_CONTROL_DIR;
  else process.env.MOJULO_CONTROL_DIR = ORIGINAL;
});

describe('moduleDir', () => {
  it('resolves from MOJULO_CONTROL_DIR when set', () => {
    process.env.MOJULO_CONTROL_DIR = path.sep + path.join('some', 'install', 'root');
    expect(moduleDir(import.meta.url, 'lib/graph/sketch-vocab')).toBe(
      path.join(process.env.MOJULO_CONTROL_DIR, 'lib', 'graph', 'sketch-vocab'),
    );
  });

  it('never parses the meta URL when the env var is set — a foreign baked URL must not throw', () => {
    process.env.MOJULO_CONTROL_DIR = path.sep + 'root';
    // A posix file: URL with no drive letter throws ERR_INVALID_FILE_URL_PATH in
    // fileURLToPath on Windows — the published-bundle failure this helper exists
    // to prevent. 'not-a-url' throws on EVERY platform, so a non-throw here
    // proves the fallback is lazy.
    expect(() => moduleDir('not-a-url', 'lib/x')).not.toThrow();
  });

  it('falls back to the meta URL dirname when the env var is absent', () => {
    delete process.env.MOJULO_CONTROL_DIR;
    expect(moduleDir(import.meta.url, 'lib')).toBe(path.dirname(fileURLToPath(import.meta.url)));
  });
});
