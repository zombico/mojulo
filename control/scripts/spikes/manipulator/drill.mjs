#!/usr/bin/env node
// drill — the manual manipulator's target drill (lib/graph/polygonizer/hero-reach.js targetDrill) on the realistic hero:
// seeded targets around the striking shoulder from the guard, each struck with its cheapest approach and the surface
// drawn for it, driven straight into it and recovered. Prints each target (surface, approach family, share of reach,
// direction, the aim off the shoulder's line, the contact time) and its checks on the clip as played (the contact's error,
// the surface's facing off the approach, the servos past a stop, the drive's straightness), and the drill's worst.
//
//   node scripts/spikes/manipulator/drill.mjs [--cast male] [--seed 1] [--count 6] [--surfaces knuckles,palmHeel]
//                                             [--sheet <dir>] [--json out.json]
//
// --sheet renders the guard and each contact frame, whole body, through the body-study skill (.claude/skills/body-study):
// the eyes gate's pictures (the targets are not drawn: read each frame against its row in the table).
import { register } from 'node:module';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { validateRig } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
const { targetDrill, SURFACE_NAMES } = await import('@/lib/graph/polygonizer/hero-reach.js');

const { values: opt } = parseArgs({ options: { cast: { type: 'string', default: 'male' }, seed: { type: 'string', default: '1' }, count: { type: 'string', default: '6' }, surfaces: { type: 'string', default: SURFACE_NAMES.join(',') }, sheet: { type: 'string' }, json: { type: 'string' } } });

const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: opt.cast, form: 'realistic' }) });
const R = validateRig(m.recipe.rig);
const t0 = performance.now();
const D = targetDrill(R, { seed: Number(opt.seed), count: Number(opt.count), surfaces: opt.surfaces.split(',') });
const ms = performance.now() - t0;

console.log(`\n══ the target drill: ${opt.cast} (realistic), right hand from the guard, seed ${D.seed} ══ ${D.targets.length} targets in ${D.seconds} s of clip (solved in ${(ms / 1000).toFixed(1)} s)`);
console.log(' #  surface    approach   share  az°    el°    aim°   t s     contact mm  facing°  straight mm  past a stop');
D.targets.forEach((x, i) => {
  const c = D.checks.targets[i];
  console.log(`${String(i).padStart(2)}  ${x.surface.padEnd(10)} ${x.family.padEnd(9)} ${String(x.share).padEnd(6)} ${String(x.az).padStart(5)}  ${String(x.el).padStart(5)}  ${String(x.aim).padStart(5)}  ${String(x.t).padEnd(6)}  ${String(+(c.contact * 1000).toFixed(1)).padStart(9)}  ${String(c.approach).padStart(7)}  ${String(+(c.straight * 1000).toFixed(1)).padStart(11)}  ${c.past.join(', ') || '-'}`);
});
const w = D.checks.worst;
console.log(`worst: contact ${+(w.contact * 1000).toFixed(1)} mm, facing ${w.approach}°, drive ${+(w.straight * 1000).toFixed(1)} mm off straight, ${w.past} servo readings past a stop`);

const acts = [{ pose: D.clip.fn(0), label: 'guard' }, ...D.targets.map((x) => ({ pose: D.clip.fn(x.t / D.seconds), label: `${x.surface} ${x.family}` }))];
if (opt.json) writeFileSync(opt.json, JSON.stringify({ targets: D.targets, checks: D.checks, seconds: D.seconds, keys: D.keys, acts }, null, 2));
if (opt.sheet) {
  const r = spawnSync(process.execPath, [path.join(CONTROL, '../.claude/skills/body-study/body.mjs'), opt.cast, '--hero', '{"form":"realistic"}', '--out', opt.sheet, '--acts', JSON.stringify(acts.map((a) => ({ pose: a.pose })))], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
