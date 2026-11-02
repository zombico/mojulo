#!/usr/bin/env node
// throw-sticks — bake the throw library (lib/graph/polygonizer/hero-throw.js THROWS, solved on the canonical male hero)
// into the stick a contest page poses its athletes by (lib/graph/contest/athlete-pose.js: pelvis, neck, and per side the
// shoulder, the elbow, the wrist, the hip, the knee, the ankle), a frame every FRAME seconds, millimetres off the
// pelvis's place at the throw's start in the thrower's frame (+x right, +y toward the target, +z up), with the ball's
// centre while it is held and the release as solved. Writes lib/graph/contest/throw-sticks.data.js; deterministic (the
// solve is), so a test can hold the file to a fresh bake (throw-sticks.deep.test.js).
//
//   node scripts/throw-sticks.mjs [--check] [--only overhand,toss]
import { register } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { bakeThrowSticks, renderThrowSticksModule, BAKE_HERO } = await import('../lib/graph/polygonizer/hero-throw-bake.js');
const { validateRig } = await import('../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../lib/mcp/tools/layered.js');
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 'throws', hero: heroRecord(BAKE_HERO) }).recipe.rig);

const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const out = path.join(control, 'lib/graph/contest/throw-sticks.data.js');
const src = renderThrowSticksModule(bakeThrowSticks(R, { only }));
if (args.includes('--check')) {
  const same = readFileSync(out, 'utf8') === src;
  console.log(same ? 'throw-sticks: the baked file is fresh' : 'throw-sticks: STALE — run node scripts/throw-sticks.mjs');
  process.exit(same ? 0 : 1);
}
writeFileSync(out, src);
console.log(`throw-sticks: wrote ${path.relative(control, out)} (${src.length} bytes)`);
