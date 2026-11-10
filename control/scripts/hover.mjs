#!/usr/bin/env node
/**
 * hover — fly the HOVER BOT over a world (lib/graph/scene/hover-bot.js): teleport it to coordinates for shots, fly it
 * along a path (or the world's own route) at a speed, visit the page's own cameras; its shots and a report written to a
 * folder. A world's tester that samples as a person sees it, without a body's physics.
 *
 *   node scripts/hover.mjs <tour.json> [--out <dir>]
 *
 *   tour: {
 *     world?: { kind, … }         a world's recipe (built by world-scene.js, emitted as a capture page), or
 *     page?:  'path.html'         a capture page already written (emitThreeWorld { capture: true })
 *     out?:   'dir'               where its shots and report.json go (--out over it)
 *     view?:  [width, height]     the shots' size (1280 × 720)
 *     ops: [
 *       { teleport: { at: [x, y] | pos: [x, y, z], height?, heading? (radians, 0 east), pitch?, look?: [x, y, z],
 *                     vfov?, shot?: 'name' } },
 *       { fly: { path: [[x, y], …] | 'route' (its dummy's walk), speed?: crawl | walk | jog | cycle | drive | fly | m/s, height?, pitch?,
 *                shots?: { every, name } } },
 *       { cameras: true | ['street', …] }   each of the page's cameras as a shot (its own eye and aim)
 *     ]
 *   }
 *
 * Run from control/ (it moves there itself).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.join(here, '..'));
register('./mcp-stdio-loader.mjs', import.meta.url);

const args = process.argv.slice(2), tourPath = args.find((a) => !a.startsWith('--'));
if (!tourPath) { console.error('usage: node scripts/hover.mjs <tour.json> [--out <dir>]'); process.exit(2); }
const tour = JSON.parse(await fs.readFile(path.resolve(process.env.INIT_CWD ?? '.', tourPath), 'utf8').catch(() => fs.readFile(tourPath, 'utf8')));
const outIx = args.indexOf('--out'), out = path.resolve(outIx >= 0 ? args[outIx + 1] : tour.out ?? 'hover-out');
await fs.mkdir(out, { recursive: true });

const { openHoverBot } = await import('../lib/graph/scene/hover-bot.js');
let html, payload = null;
if (tour.page) html = await fs.readFile(tour.page, 'utf8');
else if (tour.world) {
  const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
  const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
  const t0 = Date.now();
  ({ payload } = await resolveWorldScene({ ref: 'hover', manifest: tour.world }));
  html = emitThreeWorld({ ...payload, walk: false, hud: false, capture: true, inline: true, spin: false, wireframe: false });
  console.log(`built in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${payload.faces.length} faces`);
} else { console.error('hover: a tour has a world (its recipe) or a page'); process.exit(2); }

const [vw, vh] = tour.view ?? [1280, 720];
const bot = await openHoverBot(html, { width: vw, height: vh });
const report = { ops: [] };
try {
  for (const [k, op] of (tour.ops ?? []).entries()) {
    if (op.teleport) {
      const T = op.teleport, res = await bot.teleport({ ...T, ...(T.shot ? { shot: path.join(out, `${T.shot}.jpg`) } : {}) });
      report.ops.push({ teleport: T, ...res });
      console.log(`teleport ${JSON.stringify(T.at ?? T.pos)}: eye ${res.eye.map((v) => v.toFixed(2)).join(', ')} over ${res.ground?.group ?? 'nothing'}${res.shot ? ` → ${res.shot}` : ''}`);
    } else if (op.fly) {
      const F = op.fly, pathPts = F.path === 'route' ? (payload?.walkers?.[0]?.path ?? payload?.route ?? []).map((p) => [p[0], p[1]]) : F.path;
      const res = await bot.fly({ ...F, path: pathPts, ...(F.shots ? { shots: { every: F.shots.every ?? 10, dir: out, name: F.shots.name ?? `fly${k}` } } : {}) });
      report.ops.push({ fly: { ...F, path: F.path === 'route' ? 'route' : F.path }, report: res.report, shots: res.shots });
      const R = res.report;
      console.log(`fly ${F.speed ?? 'walk'} ${R.length} m, ${R.samples} samples: ${R.holes.length} holes, ${R.steps.length} steps, steepest ${(R.steepest * 100).toFixed(1)}%, ${Object.keys(R.groups).length} groups${R.triangles ? `, ${R.triangles.max} triangles at most` : ''}${res.shots.length ? `, ${res.shots.length} shots` : ''}`);
    } else if (op.cameras) {
      const want = Array.isArray(op.cameras) ? op.cameras : null;
      for (const c of (payload?.cameras ?? []).filter((c) => !want || want.includes(c.name))) {
        const wf = c.worldFraming, res = await bot.teleport({ pos: wf.cameraPosition, look: wf.lookAt, vfov: (wf.horizontalFov ?? 60) * 0.62, shot: path.join(out, `camera-${c.name}.jpg`) });
        report.ops.push({ camera: c.name, ...res });
        console.log(`camera ${c.name} → ${res.shot}`);
      }
    }
  }
} finally { await bot.close(); }
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(`report → ${path.join(out, 'report.json')}`);
