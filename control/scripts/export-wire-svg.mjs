#!/usr/bin/env node
/**
 * export-wire-svg.mjs — hidden-line WIRE drawings of a sketch (or a spatial source file) through
 * lib/graph/scene/wire-svg.js: fixed views, a construction view, an optional turntable set. Every
 * SVG embeds its source and camera; every stroke maps back to a spatial edge and parameter interval.
 * The camera is the PHYSICAL basis (what the World page, GLB and engine legs show).
 *
 * Usage (from control/; repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR for --ref):
 *   node scripts/export-wire-svg.mjs --ref <sketch> --out <dir>
 *   node scripts/export-wire-svg.mjs --source <head-wire-study.json> --out <dir> --features "Eyes,Nose"
 *   options: --views 150,180,90,0 (azimuths; default) --el 10 --size 900 --f 1400
 *            --dist-mul K (override: camera distance = K × bounding radius; default keeps the whole orbit in frame for the lens)
 *            --turntable 48 (also write az000..az352 frames) --no-construction
 *            --with-studio (keep the workbench floor + grid; dropped by default so the OBJECT sets the framing)
 * Azimuth convention: az 0 = camera south of the target looking north (+y); image-right = (cos az, sin az).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' }, source: { type: 'string' }, out: { type: 'string' },
  views: { type: 'string', default: '150,180,90,0' }, el: { type: 'string', default: '10' },
  'dist-mul': { type: 'string' }, size: { type: 'string', default: '900' }, f: { type: 'string', default: '1400' },
  features: { type: 'string', default: '' }, turntable: { type: 'string' }, 'no-construction': { type: 'boolean', default: false }, 'with-studio': { type: 'boolean', default: false },
} });
const fail = (msg) => { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); };
if (!args.out || (!args.ref && !args.source)) fail('need --out <dir> and one of --ref <sketch> | --source <json>');

register('./mcp-stdio-loader.mjs', import.meta.url);
const { orbitCamera, wireSvg, weldFaces, frameSource } = await import('@/lib/graph/scene/wire-svg.js');

let source; let title;
if (args.source) {
  source = JSON.parse(await fs.readFile(args.source, 'utf8')); title = path.basename(args.source);
  if (!Array.isArray(source.vertices) || !Array.isArray(source.faces)) fail('--source needs { vertices, faces, groups? } (the head-wire study schema)');
} else {
  resolveMojuloPaths();
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const sketch = SketchRepository.getByRef(args.ref); if (!sketch) fail(`sketch '${args.ref}' not found`);
  const { payload, kind } = await resolveWorldScene(sketch);
  if (!payload || !Array.isArray(payload.faces) || !payload.faces.length) fail(`sketch '${args.ref}' (kind '${kind}') has no face geometry`);
  const faces = args['with-studio'] ? payload.faces : payload.faces.filter((f) => !f.studio);   // workbench floor + grid are studio furniture
  if (!faces.length) fail(`sketch '${args.ref}' has only studio furniture`);
  source = { schema: 'wire-source-v1', ref: args.ref, kind, ...weldFaces(faces) }; title = `${args.ref} (${kind})`;
}
const features = args.features ? args.features.split(',').map((s) => s.trim()).filter(Boolean) : [];
const size = Number(args.size); const { target, distance, distanceMultiplier } = frameSource(source, { ...(args['dist-mul'] ? { distanceMultiplier: Number(args['dist-mul']) } : {}), focalPixels: Number(args.f), size });
const cam = (az) => orbitCamera({ azimuthDegrees: az, elevationDegrees: Number(args.el), target, distance, focalPixels: Number(args.f), size });
await fs.mkdir(args.out, { recursive: true });
const written = [];
const write = async (name, svg) => { await fs.writeFile(path.join(args.out, name), svg); written.push(name); };
const views = args.views.split(',').map(Number).filter(Number.isFinite);
for (const az of views) await write(`az${String(az).padStart(3, '0')}.svg`, wireSvg(source, cam(az), { features, title: `${title} — wire az ${az}` }));
if (!args['no-construction']) await write(`az${String(views[0]).padStart(3, '0')}-construction.svg`, wireSvg(source, cam(views[0]), { features, hidden: true, title: `${title} — construction az ${views[0]}` }));
if (args.turntable) { const n = Number(args.turntable); for (let i = 0; i < n; i++) { const az = (views[0] + i * 360 / n) % 360; await write(`turn-${String(i).padStart(3, '0')}.svg`, wireSvg(source, cam(az), { features, title: `${title} — turn ${i}`, embedSource: i === 0 })); } }
process.stdout.write(`${JSON.stringify({ ok: true, out: args.out, files: written.length, vertices: source.vertices.length, faces: source.faces.length, target, distance, distanceMultiplier, basis: 'physical' })}\n`);
