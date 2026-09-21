// resolveMojuloPaths seeds every data-path env var the lib reads from ONE home.
// The outcomes and exports dirs were missing (grok-headless-affordances P3):
// their lib fallbacks are cwd-relative and every bin chdirs, so export_model
// wrote into the installed package directory.

import { mkdtempSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const KEYS = [
  'MOJULO_HOME', 'MOJULO_DATA_DIR', 'MOJULO_MODELS_DIR', 'SQLITE_PATH', 'ARTIFACTS_DIR',
  'STORAGE_ROOT', 'MOJULO_OUTCOMES_DIR', 'MOJULO_EXPORTS_DIR',
];

function withCleanEnv(fn) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  try {
    return fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

describe('resolveMojuloPaths', () => {
  it('seeds the outcomes and exports dirs under MOJULO_DATA_DIR beside the db, artifacts and storage', () => {
    withCleanEnv(() => {
      const home = mkdtempSync(path.join(os.tmpdir(), 'mojulo-paths-'));
      process.env.MOJULO_HOME = home;
      const r = resolveMojuloPaths();
      const data = path.join(home, 'data');
      expect(r.dataDir).toBe(data);
      expect(process.env.SQLITE_PATH).toBe(path.join(data, 'mojulo-lite.db'));
      expect(process.env.MOJULO_OUTCOMES_DIR).toBe(path.join(data, 'outcomes'));
      expect(process.env.MOJULO_EXPORTS_DIR).toBe(path.join(data, 'exports'));
      expect(r.outcomesDir).toBe(process.env.MOJULO_OUTCOMES_DIR);
      expect(r.exportsDir).toBe(process.env.MOJULO_EXPORTS_DIR);
      expect(existsSync(path.join(data, 'artifacts'))).toBe(true);
    });
  });

  it('never overrides an explicit MOJULO_OUTCOMES_DIR / MOJULO_EXPORTS_DIR', () => {
    withCleanEnv(() => {
      const home = mkdtempSync(path.join(os.tmpdir(), 'mojulo-paths-'));
      process.env.MOJULO_HOME = home;
      process.env.MOJULO_OUTCOMES_DIR = '/elsewhere/outcomes';
      process.env.MOJULO_EXPORTS_DIR = '/elsewhere/exports';
      const r = resolveMojuloPaths();
      expect(r.outcomesDir).toBe('/elsewhere/outcomes');
      expect(r.exportsDir).toBe('/elsewhere/exports');
    });
  });
});
