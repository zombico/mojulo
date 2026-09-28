#!/usr/bin/env node
/**
 * export-wire-svg.mjs — hidden-line WIRE drawings of a sketch (or a spatial source file) through
 * lib/graph/scene/wire-svg.js: fixed views, a construction view, an optional turntable set. Every
 * SVG embeds its source and camera; every stroke maps back to a spatial edge and parameter interval.
 * The camera is the PHYSICAL basis (what the World page, GLB and engine legs show).
 *
 * Usage (from control/; repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR for --ref):
 *   node scripts/export-wire-svg.mjs --ref <sketch> --out <dir>
 *   node scripts/export-wire-svg.mjs --ref <layered sketch with a rig> --pose '{"crouch":0.5}' | --clip crouch --phase 0.5 --out <dir>   # posed frames
 *   node scripts/export-wire-svg.mjs --source <head-wire-study.json> --out <dir> --features "Eyes,Nose"
 *   options: --views 150,180,90,0 (azimuths; default) --el 10 --size 900 --f 1400
 *            --dist-mul K (override: camera distance = K × bounding radius; default keeps the whole orbit in frame for the lens)
 *            --turntable 48 (also write az000..az352 frames) --no-construction
 *            --with-studio (keep the workbench floor + grid; dropped by default so the OBJECT sets the framing)
 *            --compare frontal=ref.png,lateral=side.png (the matched-azimuth silhouette compare: numbers to compare.json,
 *                      a sheet per view — reference | silhouette | overlap; views are frontal / three-quarter /
 *                      three-quarter-left / lateral / left / back or an azimuth) --compare-res 256
 *            --stroke s1 (a layered sketch's stored stroke drawn over the wire in the camera it was drawn against —
 *                      stroke-<id>.svg — with, for a silhouette, the RESIDUAL band where the outline and the solid
 *                      disagree; stroke-<id>.json carries the resolve) --stroke-res 256
 * Azimuth convention: az 0 = camera south of the target looking north (+y); image-right = (cos az, sin az).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' }, source: { type: 'string' }, out: { type: 'string' }, pose: { type: 'string' }, clip: { type: 'string' }, phase: { type: 'string' },
  views: { type: 'string', default: '150,180,90,0' }, el: { type: 'string', default: '10' },
  'dist-mul': { type: 'string' }, size: { type: 'string', default: '900' }, f: { type: 'string', default: '1400' },
  features: { type: 'string', default: '' }, turntable: { type: 'string' }, 'no-construction': { type: 'boolean', default: false }, 'with-studio': { type: 'boolean', default: false },
  compare: { type: 'string' }, 'compare-res': { type: 'string', default: '256' },
  stroke: { type: 'string' }, 'stroke-res': { type: 'string', default: '256' },
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
  let payload, kind;
  if (args.pose || args.clip) {
    // a POSED layered solid: compile → bind → pose → skin, drawn straight from the skinned mesh (no lowering)
    if (sketch.manifest?.kind !== 'layered' || !sketch.manifest.recipe?.rig) fail(`--pose/--clip needs a layered sketch with a rig (${args.ref} is kind '${sketch.manifest?.kind}')`);
    const { compileLayered } = await import('@/lib/graph/polygonizer/station-loft');
    const { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered, layeredClip } = await import('@/lib/graph/polygonizer/station-loft-rig');
    const recipe = sketch.manifest.recipe; const mesh = compileLayered(recipe, sketch.manifest.dials || {}, sketch.manifest.channels || {}); const R = validateRig(recipe.rig); const skin = bindLayered(mesh, recipe, R);
    let pose; if (args.clip) { const keys = recipe.clips?.[args.clip]; if (!keys) fail(`clip '${args.clip}' is not in the recipe (have ${Object.keys(recipe.clips || {}).join(', ') || 'none'})`); pose = layeredClip(keys, R)(Number(args.phase ?? 0)); } else pose = JSON.parse(args.pose);
    const { nodes, report } = rigNodesAt(R, pose); const posed = skinLayered(mesh, skin, boneFrames(R, R.joints, nodes));
    payload = { faces: mesh.faces.map((tri, i) => ({ corners: tri.map((vi) => posed[vi]), group: mesh.groups[i] })) }; kind = `layered · posed ${args.clip ? `${args.clip}@${args.phase ?? 0}` : 'pose'}`;
    process.stderr.write(`${JSON.stringify({ pose, legs: report.legs })}\n`);
  } else ({ payload, kind } = await resolveWorldScene(sketch));
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
let strokeOut;
if (args.stroke) {
  // a stored stroke over the wire (lib/graph/scene/stroke-overlay-svg.js): the wire is drawn from the compiled mesh in
  // the stroke's OWN camera (unseated, the frame the stroke resolves in), the stroke on top, and for a silhouette the
  // residual against this form (silhouette-solve.js) as a band. Numbers to stdout and stroke-<id>.json.
  if (!args.ref) fail('--stroke needs --ref (a layered sketch)');
  const { SketchRepository } = await import('@/lib/db/repositories/sketches'); const sk = SketchRepository.getByRef(args.ref);
  if (sk?.manifest?.kind !== 'layered') fail(`--stroke needs a layered sketch (${args.ref} is kind '${sk?.manifest?.kind}')`);
  const stroke = (sk.manifest.strokes || []).find((s) => s.id === args.stroke); if (!stroke) fail(`no stroke '${args.stroke}' on ${args.ref} (have ${(sk.manifest.strokes || []).map((s) => s.id).join(', ') || 'none'})`);
  const { compileLayered } = await import('@/lib/graph/polygonizer/station-loft');
  const { resolveStroke, strokeCamera } = await import('@/lib/graph/polygonizer/stroke-resolve');
  const { silhouetteResidual } = await import('@/lib/graph/polygonizer/silhouette-solve');
  const { strokeOverlaySvg, overlayWireSvg } = await import('@/lib/graph/scene/stroke-overlay-svg');
  const mesh = compileLayered(sk.manifest.recipe, sk.manifest.dials || {}, sk.manifest.channels || {});
  const src = { schema: 'wire-source-v1', ref: args.ref, kind: 'layered', vertices: mesh.vertices, faces: mesh.faces, groups: mesh.groups, pointIds: mesh.pointIds };
  const scam = strokeCamera(stroke, mesh); const resolved = resolveStroke(mesh, stroke);
  const residual = stroke.intent === 'silhouette' ? silhouetteResidual(mesh, stroke, { res: Number(args['stroke-res']) }) : null;
  // a non-silhouette stroke shows its resolve: hit / miss marks, and the mirrored twins projected back through the camera
  const { projectVertices } = await import('@/lib/graph/scene/wire-svg.js');
  const marks = stroke.intent === 'silhouette' ? {} : { resolved: resolved.addresses, mirrored: resolved.mirrored ? projectVertices(resolved.mirrored.filter((a) => a.hit).map((a) => a.hit.world), scam).map(([x, y]) => [x / scam.size, y / scam.size]) : null };
  const svg = overlayWireSvg(wireSvg(src, scam, { features, title: `${title} — stroke ${stroke.id} (${stroke.intent})`, embedSource: false }), strokeOverlaySvg(stroke, scam.size, { residual, ...marks }));
  await write(`stroke-${stroke.id}.svg`, svg);
  const { mask: _m, ...numbers } = residual || {};
  strokeOut = { id: stroke.id, intent: stroke.intent, view: stroke.view, camera: scam.meta, hits: resolved.hits, misses: resolved.misses, ...(residual ? { residual: numbers } : {}), ...(stroke.solved ? { solved: stroke.solved } : {}) };
  await write(`stroke-${stroke.id}.json`, `${JSON.stringify({ ...strokeOut, addresses: resolved.addresses, ...(resolved.mirrored ? { mirrored: resolved.mirrored } : {}) }, null, 1)}\n`);
}
let compare;
if (args.compare) {
  // the matched-azimuth compare (lib/graph/scene/wire-compare.js): the source's silhouette at a NAMED view against a
  // reference picture read at the same azimuth; shape only (both normalised to their boxes); the picture is never kept
  const { sourceSilhouette, compareSilhouette, referenceMask, writeCompareSheet } = await import('@/lib/graph/scene/wire-compare.js');
  const res = Number(args['compare-res']); compare = {};
  for (const pair of args.compare.split(',').map((s) => s.trim()).filter(Boolean)) {
    const eq = pair.indexOf('='); if (eq < 0) fail(`--compare wants view=path pairs (got '${pair}')`);
    const viewName = pair.slice(0, eq).trim(); const refPath = pair.slice(eq + 1).trim(); const view = Number.isFinite(Number(viewName)) ? Number(viewName) : viewName;
    const sil = sourceSilhouette(source, view, { res, elevationDegrees: Number(args.el) }); const ref = await referenceMask(refPath);
    const { fitted, ...numbers } = compareSilhouette(sil, ref.mask, ref.res);
    const sheet = `compare-${String(viewName).replace(/[^a-z0-9-]/gi, '_')}.png`; await writeCompareSheet(path.join(args.out, sheet), sil, ref.mask, ref.res, fitted); written.push(sheet);
    compare[viewName] = { ...numbers, azimuth: sil.azimuth, reference: path.basename(refPath), sheet };
  }
  await write('compare.json', `${JSON.stringify({ ref: args.ref || null, res, views: compare }, null, 1)}\n`);
}
process.stdout.write(`${JSON.stringify({ ok: true, out: args.out, files: written.length, vertices: source.vertices.length, faces: source.faces.length, target, distance, distanceMultiplier, basis: 'physical', ...(compare ? { compare } : {}), ...(strokeOut ? { stroke: strokeOut } : {}) })}\n`);
