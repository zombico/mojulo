#!/usr/bin/env node
// figure-study — regenerate the protoform figure study SVGs and rasterize the
// chosen one(s) to PNG for visual analysis. Run, then Read the printed PNG paths.
//
//   node .claude/skills/figure-study/study.mjs <study> [<study>...] [--no-gen]
//
// studies live in lite-template/integration/0609/spike-output/figure-readable-envelope/
// (e.g. 8a-stitched-vexar, 14-female-vexar, 15-female-vexar-bust-study). --no-gen
// skips the regen step (rasterize the existing SVGs only).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const OUT = 'lite-template/integration/0609/spike-output/figure-readable-envelope';
const SPEC = 'lib/graph/polygonizer/figure-readable-envelope.spike.gen.test.js';

const args = process.argv.slice(2);
const noGen = args.includes('--no-gen');
const names = args.filter((a) => a !== '--no-gen');
const studies = (names.length ? names : ['8a-stitched-vexar']).map((n) => (n.endsWith('.svg') ? n : `${n}.svg`));

if (!noGen) {
  console.error('figure-study: regenerating study SVGs (vitest spike)…');
  const gen = spawnSync('npx', ['vitest', 'run', '--config', 'vitest.spike.config.js', SPEC], {
    cwd: path.join(REPO, 'control'), stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (gen.status !== 0) { console.error('figure-study: gen test failed'); process.exit(gen.status || 1); }
}

const svgs = studies.map((n) => path.join(REPO, OUT, n));
const ras = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), ...svgs], {
  cwd: REPO, stdio: 'inherit',
});
process.exit(ras.status || 0);
