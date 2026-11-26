#!/usr/bin/env node
/**
 * `node scripts/foe-audit.mjs <level-ref | game-ref> … [--json]` — how a level's foes are drawn on its page
 * (gameworld/foe-audit.js): bodied, lit by the level, a pose for each state they play. A game's ref audits each of its
 * levels. Reads the store where the CLI reads it (resolveMojuloPaths); writes nothing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { register } from 'node:module';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

register('./mcp-stdio-loader.mjs', import.meta.url);
process.env.MOJULO_INVOKE_CWD ??= process.cwd();
resolveMojuloPaths();
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const { values: args, positionals: refs } = parseArgs({ options: { json: { type: 'boolean', default: false } }, allowPositionals: true });
if (!refs.length) { console.error('usage: node scripts/foe-audit.mjs <level-ref | game-ref> … [--json]'); process.exit(2); }

const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { levelSketch, resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
const { foeAudit } = await import('@/lib/graph/gameworld/foe-audit.js');

/** a gameworld's levels (the run's `made` level steps, in order), else the ref itself */
function levelsOf(ref) {
  const row = SketchRepository.getByRef(ref);
  if (!row) throw new Error(`'${ref}' is not in the store`);
  if (row.manifest?.kind === 'gameworld') return Object.entries(row.manifest.made ?? {}).filter(([k]) => k.startsWith('level-')).map(([, v]) => v.ref);
  return [ref];
}

const out = [];
for (const ref of refs) {
  for (const level of levelsOf(ref)) {
    const scene = await resolveWorldScene(await levelSketch(SketchRepository.getByRef(level)), {});
    const A = foeAudit(scene.payload ?? scene);
    out.push({ level, audit: A });
    if (args.json) continue;
    console.log(`\n${level}${A ? `: ${A.foes.length} foes, the hero ${A.hero?.light ?? 'absent'}` : ': no foes'}`);
    if (!A) continue;
    for (const l of A.laws) console.log(`  ${l.ok ? 'ok  ' : 'FAIL'} ${l.law}: ${l.value}`);
    const byFig = {};
    for (const r of A.foes) (byFig[r.figure] ??= { n: 0, ...r }).n++;
    for (const r of Object.values(byFig)) console.log(`    ${r.figure} ×${r.n}: ${r.body}, ${r.light}, needs ${r.needs.join(' ')}${r.missing.length ? `, missing ${r.missing.join(' ')}` : ''}`);
  }
}
if (args.json) console.log(JSON.stringify(out, null, 1));
