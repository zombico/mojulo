import { defineConfig } from 'vitest/config';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import base from './vitest.config.js';

// The Godot tier (`npm run test:godot`): every suite with a Godot leg (each names MOJULO_GODOT and skips without it
// in the other tiers) and the ratchet; the runtime's own legs (its corpora, the fixture matrix) left with the engine
// handoff, which culls the runtime they proved. It sets nothing itself: it needs
// MOJULO_GODOT naming a Godot 4.7.2 binary and fails loudly without it, since a Godot tier that skips its Godot legs
// says nothing. CI's `godot` job runs a pinned Godot over the legs the engine handoff keeps, not this whole tier; run
// the tier before every commit that touches the kernel, the score, the bus contract or the marks.
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
    include: [...new Set([...godotSuites('lib'), ...godotSuites('scripts'), 'lib/graph/scene/godot-marks.test.js', 'lib/graph/scene/bus-abi.test.js', 'lib/graph/cosmos/**/*.test.js'])],
    exclude: base.test.exclude.filter((x) => x !== '**/*.godot.test.js'),
    // the matrix plays every fixture in both engines: minutes, one suite at a time
    testTimeout: 3600000,
    fileParallelism: false,
  },
});
