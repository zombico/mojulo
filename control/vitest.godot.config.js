import { defineConfig } from 'vitest/config';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import base from './vitest.config.js';

// The Godot tier (`npm run test:godot`): every suite with a Godot leg, found by the env var its skip reads (each names
// MOJULO_GODOT and skips without it in the other tiers): the engine handoff's (its project imported and probed) and
// export_model's humanoid GLB imported. No game runtime is run: they are retired. It sets nothing itself: it needs
// MOJULO_GODOT naming a Godot 4.7.2 binary and fails loudly without it, since a Godot tier that skips its Godot legs
// says nothing. CI's `godot` job runs a pinned Godot over the same legs, named.
const GODOT = process.env.MOJULO_GODOT;
if (!GODOT || !existsSync(GODOT)) {
  throw new Error(`test:godot needs MOJULO_GODOT naming a Godot binary (got ${GODOT ? `'${GODOT}', which does not exist` : 'nothing'}); every leg of this tier runs the engine`);
}

// every test file under lib/ and scripts/ that has a Godot leg, found by the env var its skip reads
function godotSuites(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules') continue;
    if (statSync(p).isDirectory()) godotSuites(p, out);
    else if (name.endsWith('.test.js') && readFileSync(p, 'utf8').includes('MOJULO_GODOT')) out.push(p);
  }
  return out;
}

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [...new Set([...godotSuites('lib'), ...godotSuites('scripts')])],
    // a headless Godot import per suite: one suite at a time
    testTimeout: 900000,
    fileParallelism: false,
  },
});
