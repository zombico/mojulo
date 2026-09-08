#!/usr/bin/env node
/**
 * fit-mesh-to-greybox.mjs — the worker-side step between a generator's raw return and
 * submit_mesh_render (interchange-next.plan.md N4; lib/graph/scene/mesh-fit.js). Generators
 * normalise to their own unit box, so the raw file fails the size gate by design; this
 * reads the request's greybox box, stands the return up, scales it to the greybox height,
 * floors and centres it, and writes a GLB through mojulo's own writer (vertex colours and
 * albedo textures carried; nothing else changes).
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/fit-mesh-to-greybox.mjs --ref sk_foo --in raw.glb --out fitted.glb [--up z|y|triposr]
 *   node scripts/fit-mesh-to-greybox.mjs --box -19.7,-22.6,0,19.7,19.7,100 --in raw.glb --out fitted.glb
 * `--up triposr` for a TripoSR return (it writes z-up, which the reader stands on −y);
 * default 'z' (Blender / Meshy / Tripo returns).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({ options: {
  ref: { type: 'string' }, box: { type: 'string' }, in: { type: 'string' }, out: { type: 'string' }, up: { type: 'string', default: 'z' },
} });
function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
if (!args.in || !args.out) fail('need --in <raw.glb> --out <fitted.glb>');
if (!args.ref && !args.box) fail('need --ref <sketch with a pulled mesh request> or --box minx,miny,minz,maxx,maxy,maxz');

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { glbToScene, parseGlb } = await import('@/lib/graph/scene/scene-gltf-read.js');
const { facesToGlb } = await import('@/lib/graph/scene/scene-gltf.js');
const { fitFacesToBox } = await import('@/lib/graph/scene/mesh-fit.js');

let box;
if (args.box) {
  const v = args.box.split(',').map(Number);
  if (v.length !== 6 || v.some((n) => !Number.isFinite(n))) fail('--box wants six numbers');
  box = { min: v.slice(0, 3), max: v.slice(3) };
} else {
  const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
  const gb = path.join(outcomes, args.ref, 'greybox.glb');
  if (!existsSync(gb)) fail(`no greybox at ${gb} — pull_mesh_render writes it; or pass --box`);
  const { json } = parseGlb(await fs.readFile(gb));
  const pos = json.accessors.filter((a) => Array.isArray(a.min) && a.min.length === 3);
  if (!pos.length) fail('greybox carries no POSITION bounds');
  box = { min: [0, 1, 2].map((k) => Math.min(...pos.map((a) => a.min[k]))), max: [0, 1, 2].map((k) => Math.max(...pos.map((a) => a.max[k]))) };
}

const { faces, textures, ledger } = glbToScene(await fs.readFile(path.resolve(args.in)));
if (!faces.length) fail('the raw GLB carries no triangle geometry');
let fit;
try { fit = fitFacesToBox(faces, { box, up: args.up }); } catch (e) { fail(e.message); }
const out = facesToGlb({ faces: fit.faces, textures }, { generator: `mojulo fit-mesh-to-greybox${args.ref ? ` ${args.ref}` : ''}` });
await fs.writeFile(path.resolve(args.out), out.bytes);
process.stdout.write(`${JSON.stringify({
  ok: true, in: path.resolve(args.in), out: path.resolve(args.out), up: args.up, faces: fit.faces.length, bytes: out.byteLength,
  greybox_box: box, raw_size: fit.raw.size.map((v) => +v.toFixed(4)), scale: +fit.scale.toFixed(4),
  fitted_size: fit.fitted.size.map((v) => +v.toFixed(3)), fitted_min: fit.fitted.min.map((v) => +v.toFixed(3)),
  textures: Object.keys(textures || {}).length, ledger,
  next: 'submit_mesh_render({ request_id, glb_path: out, worker_audit, source }) — the size gate compares extents against the greybox; a 0.5×–2× miss in XY is the generator\'s proportions, not the fit',
}, null, 2)}\n`);
