// Under the Claude plugin profile (lib/mcp/plugin-profile.js) the recall model is never fetched on
// its own: the preload at server start and a search load it only when it is already on disk, and a
// missing model points at the user-run `install recall`. The embedding runtime is a stand-in shim in
// a throwaway $MOJULO_HOME/recall (the layout `mojulo install recall` writes), so nothing is loaded
// or fetched for real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEYS = ['MOJULO_HOME', 'MOJULO_MODELS_DIR', 'MOJULO_PACKS', 'MOJULO_DISTRIBUTION'];
const saved = {};
let home;

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  home = mkdtempSync(path.join(os.tmpdir(), 'mojulo-recall-profile-'));
  mkdirSync(path.join(home, 'recall'), { recursive: true });
  // The shim `install recall` writes re-exports the runtime; this one records the settings it is
  // given and has no model to load.
  writeFileSync(
    path.join(home, 'recall', 'entry.mjs'),
    "export const env = {};\nglobalThis.__mojuloRecallEnv = env;\nexport async function pipeline() { throw new Error('model not in the cache'); }\n",
  );
  process.env.MOJULO_HOME = home;
  process.env.MOJULO_MODELS_DIR = path.join(home, 'models');
  process.env.MOJULO_PACKS = 'creative,recall';
  vi.resetModules();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  rmSync(home, { recursive: true, force: true });
  delete globalThis.__mojuloRecallEnv;
});

describe('the recall model under the Claude plugin profile', () => {
  it('is never fetched by a preload or a search, and a missing model names install recall', async () => {
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    const { preloadModel } = await import('./local.js');
    const err = await preloadModel().catch((e) => e);
    expect(globalThis.__mojuloRecallEnv.allowRemoteModels).toBe(false);
    expect(err.message).toMatch(/does not download the model on its own/);
    expect(err.message).toMatch(/install recall/);
  });

  it('keeps the lazy fetch under the npm distribution (unchanged)', async () => {
    process.env.MOJULO_DISTRIBUTION = 'npm';
    const { preloadModel } = await import('./local.js');
    const err = await preloadModel().catch((e) => e);
    expect(globalThis.__mojuloRecallEnv.allowRemoteModels).toBe(true);
    expect(err.message).toMatch(/Lazy download/);
  });
});
