#!/usr/bin/env node
/**
 * shoot-plan-demo.mjs — emit the shoot plan's worked example (lib/graph/shoot/example.js) as a self-contained World
 * page: a small city with three cameras drawn as objects, their paths, and the cut list. Prints the plan's readout
 * (the machine gate's numbers) and where the page went; opening it is the eyes gate.
 *
 *   node scripts/shoot-plan-demo.mjs --out /tmp/shoot.html
 *
 * Touches no database: the example is resolved in memory.
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({ options: { out: { type: 'string' } } });
register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);

const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { normalizeShoot, shootReadout } = await import('@/lib/graph/shoot/plan');
const { shootSubjects } = await import('@/lib/graph/shoot/subjects');
const { EXAMPLE_CITY, EXAMPLE_SHOOT } = await import('@/lib/graph/shoot/example');

const { payload } = await resolveWorldScene({ manifest: { ...EXAMPLE_CITY, shoot: EXAMPLE_SHOOT }, title: 'shoot plan demo' });
const subjects = shootSubjects(payload);
const { plan, warnings } = normalizeShoot(EXAMPLE_SHOOT, { subjects });
const html = emitThreeWorld({ ...payload, title: 'Shoot plan — worked example', inline: true });
const out = path.resolve(args.out || 'shoot-plan-demo.html');
await fs.writeFile(out, html);
process.stdout.write(`${JSON.stringify({ ok: true, out, bytes: html.length, warnings, readout: shootReadout(plan, { subjects }) }, null, 2)}\n`);
