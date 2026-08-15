#!/usr/bin/env node
/**
 * blender-bake.mjs — the local Blender worker driver (interchange.plan.md, I5 hero-object leg).
 *
 * The "premium bake" round trip, as one repeatable command instead of scratchpad
 * scripting: a mojulo export (.glb) → Cycles diffuse GI baked into vertex colours
 * (blender-bake.py, headless) → bound back onto a sketch as a DERIVED display
 * artifact (the mesh-store append-only slot bind_mesh_render uses). The recipe
 * stays sovereign; the baked mesh is a bound render, regenerable from this script.
 *
 * Same posture as the local image / voice workers: OPTIONAL, operator-hosted,
 * produces bound artifacts, holds no substrate state. Requires a local Blender
 * (>=4.x); set MOJULO_BLENDER if it is not at the macOS default path.
 *
 * UNSHADED source (default): a clean Cycles bake wants a RAW-ALBEDO base — no
 * mojulo Lambert shading, no AO, no procedural-material/weathering darkening — so
 * the GI the bake computes is the ONLY lighting. When `--ref` is given, this driver
 * GENERATES that flat-albedo source GLB itself, in-process, via
 * `resolveWorldScene(sketch, { unshaded:true })` → `facesToGlb` — it does NOT read the
 * sketch's own (shaded) data/outcomes/<ref>/model.glb. Pass `--shaded` to opt out and
 * bake the sketch's existing shaded export instead. For the `--glb` (operator-supplied)
 * path the file is used as-is: pass an unshaded export (export it flat yourself) for a
 * clean bake.
 *
 * Usage (from control/):
 *   node scripts/blender-bake.mjs --ref sk_foo                      # GENERATE unshaded source, bake, bind back to sk_foo
 *   node scripts/blender-bake.mjs --ref sk_foo --shaded             # bake sk_foo's own (shaded) export instead
 *   node scripts/blender-bake.mjs --glb <path> --hero gframe_mk2_multi --bind-to sk_gframe_mk2_unit_v1_multi --clip gframe_mk2_multi:forward
 *   node scripts/blender-bake.mjs --ref sk_foo --preview            # also write a flat vertex-colour still
 *   node scripts/blender-bake.mjs --glb <path> --no-bind            # bake only, print the out path (dry run)
 *
 * Prints one JSON result line: { ok, bound_ref?, n?, out_glb, triangles, sha256, preview_png? }.
 */

import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { register } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { glbToFaces } from '../lib/graph/scene/scene-gltf-read.js';
import { nextMeshPath } from '../lib/graph/scene/mesh-store.js';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BLENDER = process.env.MOJULO_BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const OUTCOMES = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');

// Light-rig presets. Each lamp: { energy, color, size?, dir:[dx,dy,dz] } (dir = offset from
// subject centre, in span units). ambient fills the occlusion wells the biceps sit in.
// NOTE: with an UNSHADED source (the default) the statue preset's ambient-fill + no-cast tricks
// are double-lighting COMPENSATION that is no longer strictly needed — the flat-albedo input
// carries no baked directional darkening, so the Cycles GI is the only lighting and the black
// biceps can't occur. They are harmless (ambient fill still helps fill deep wells), so kept.
const PRESETS = {
  statue: {
    plinth: true,
    no_cast: ['shoulderCap', 'shield'],
    samples: 160,
    // Interior cull: drop faces that bake below this LINEAR threshold — sealed interior seams
    // (~45–50% of a suit's faces) that no viewpoint can see, so removing them opens no holes.
    // Verified hole-free on mk2 + Zeonic Z11 from every angle; halves the served .glb and kills
    // the browser's hidden-overdraw. Disable per-bake with `--cull-black 0` if a suit with deep
    // visible recesses ever shows a gap.
    cull_black: 0.004,
    light: {
      ambient: { color: [0.22, 0.24, 0.28], strength: 1.0 },
      key: { energy: 90000, color: [1.0, 0.95, 0.88], size: 1, dir: [1.3, 1.1, 1.3] },
      fill: { energy: 25000, color: [0.75, 0.85, 1.0], size: 1.6, dir: [-1.5, 0.9, 0.3] },
      rim: { energy: 70000, color: [0.9, 0.95, 1.0], size: 0.7, dir: [0.3, -1.6, 1.5] },
    },
  },
};

// Whiten a preset's light: pull the key/rim toward neutral white and the cool fill toward white,
// so a warm cream albedo (mk2 #e7dfcf) reads white rather than tan. Ambient unchanged. Deep-copies.
function neutralizeLight(light) {
  const L = JSON.parse(JSON.stringify(light));
  if (L.key) L.key.color = [1.0, 1.0, 1.0];
  if (L.rim) L.rim.color = [1.0, 1.0, 1.0];
  if (L.fill) L.fill.color = [0.94, 0.96, 1.0];
  return L;
}

const { values: args } = parseArgs({
  options: {
    ref: { type: 'string' }, // sketch to bind the baked mesh onto (and default source)
    glb: { type: 'string' }, // explicit source GLB (overrides ref's own export)
    'bind-to': { type: 'string' }, // bind target when --glb source differs from the target sketch
    hero: { type: 'string' }, // isolate this wrapper subtree (a suit inside a world export)
    clip: { type: 'string' }, // pose from this animation name before baking
    frame: { type: 'string', default: '10' },
    preset: { type: 'string', default: 'statue' },
    samples: { type: 'string' },
    'cull-black': { type: 'string' }, // post-bake: delete faces that baked below this LINEAR threshold
                                      // (sealed interior — never visible, so no holes). 0/absent = off.
    decimate: { type: 'string' },     // post-cull: Blender Collapse decimate to this face RATIO
                                      // (0.5 = keep ~half). Fewer tris = faster browser. 0/absent = off.
    'protect-top': { type: 'string' }, // spare the top FRACTION of the figure's height (head + chest)
                                       // from decimation — detail-dense, camera-facing. e.g. 0.45.
    'neutral-light': { type: 'boolean', default: false }, // whiten the key/rim so cream reads white
    preview: { type: 'boolean', default: false },
    'no-bind': { type: 'boolean', default: false },
    unshaded: { type: 'boolean', default: true }, // generate a flat-albedo source from --ref (clean GI base)
    shaded: { type: 'boolean', default: false }, // opt out: bake the sketch's own shaded export instead
    blender: { type: 'string' },
  },
});

// unshaded is ON by default (a clean bake is the whole point); --shaded overrides it. Only
// affects the --ref source-generation path — an operator-supplied --glb is always used as-is.
const unshaded = args.shaded ? false : args.unshaded;

function fail(msg) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`);
  process.exit(1);
}

const preset = PRESETS[args.preset];
if (!preset) fail(`unknown --preset '${args.preset}' (have: ${Object.keys(PRESETS).join(', ')})`);

const bindRef = args['bind-to'] || args.ref;
if (!args['no-bind'] && !bindRef) fail('need --ref (or --bind-to with --glb) to bind the result; or pass --no-bind for a dry run');

const blenderBin = args.blender || BLENDER;
if (!existsSync(blenderBin)) fail(`Blender not found at ${blenderBin} — install Blender or set MOJULO_BLENDER (see docs/local-blender-worker.md)`);

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'moj-bake-'));

// Source GLB. Precedence:
//   --glb <path>         operator-supplied — used AS-IS (pass an unshaded export for a clean bake).
//   --ref + unshaded     GENERATE a flat-albedo (FLAT_LIGHT) source here, in-process, from the
//                        sketch's recipe — the clean GI base. NOT the shaded data/outcomes export.
//   --ref + --shaded     read the sketch's own shaded export at data/outcomes/<ref>/model.glb.
let srcGlb;
if (args.glb) {
  srcGlb = path.resolve(args.glb);
  if (!existsSync(srcGlb)) fail(`source GLB not found: ${srcGlb}`);
} else if (args.ref && unshaded) {
  // Generate the unshaded source in-process. resolveWorldScene (and its transitive `@/…` imports)
  // run under plain Node only with the same alias loader the stdio MCP entry registers; and the
  // sketch DB lives under MOJULO_HOME, so resolve those paths before opening the repository.
  register('./mcp-stdio-loader.mjs', import.meta.url);
  resolveMojuloPaths();
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const { facesToGlb } = await import('@/lib/graph/scene/scene-gltf');
  const sketch = SketchRepository.getByRef(args.ref);
  if (!sketch) fail(`sketch '${args.ref}' not found in the mojulo DB`);
  const { payload, kind } = await resolveWorldScene(sketch, { unshaded: true });
  if (!payload) fail(`sketch '${args.ref}' (kind '${kind}') has no exportable World geometry — nothing to bake`);
  if (payload.unshadedWarning) process.stderr.write(`[blender-bake] unshaded note: ${payload.unshadedWarning}\n`);
  const { bytes } = facesToGlb(payload, { clips: '_all', generator: `mojulo ${args.ref} (unshaded)` });
  srcGlb = path.join(work, 'unshaded-src.glb');
  await fs.writeFile(srcGlb, bytes);
} else if (args.ref) {
  srcGlb = path.join(OUTCOMES, args.ref, 'model.glb');
  if (!existsSync(srcGlb)) fail(`source GLB not found: ${srcGlb} — run export_model on this ref first (or drop --shaded to generate an unshaded source)`);
} else {
  fail('need --glb <path> or --ref <sketch>');
}

const outGlb = path.join(work, 'baked.glb');
const previewPng = args.preview ? path.join(work, 'preview.png') : null;
const config = {
  src_glb: srcGlb,
  out_glb: outGlb,
  preview_png: previewPng,
  hero_node: args.hero || null,
  clip: args.clip || null,
  frame: Number(args.frame),
  drop: args.clip ? ['weapon_saber', 'weapon_bazooka'] : [], // stowed forms hide only when a combat clip poses them
  no_cast: preset.no_cast,
  plinth: preset.plinth,
  recenter: true,
  samples: args.samples ? Number(args.samples) : preset.samples,
  cull_black: args['cull-black'] != null ? Number(args['cull-black']) : (preset.cull_black || 0),
  decimate: args.decimate != null ? Number(args.decimate) : (preset.decimate || 0),
  protect_top: args['protect-top'] != null ? Number(args['protect-top']) : 0,
  // `--neutral-light` whitens the warm key/rim (and the slightly-blue fill) so cream albedos
  // (mk2 #e7dfcf) read closer to white instead of tan. Ambient kept. Non-destructive per-bake dial.
  light: args['neutral-light'] ? neutralizeLight(preset.light) : preset.light,
};
const configPath = path.join(work, 'config.json');
await fs.writeFile(configPath, JSON.stringify(config, null, 2));

const code = await new Promise((resolve) => {
  const proc = spawn(blenderBin, ['-b', '-P', path.join(here, 'blender-bake.py'), '--', configPath], { stdio: ['ignore', 'inherit', 'inherit'] });
  proc.on('close', resolve);
});
if (code !== 0 || !existsSync(outGlb)) fail(`Blender bake failed (exit ${code})`);

// The machine gate — the same decode bind_mesh_render runs. Rejects a broken bake before binding.
const bytes = await fs.readFile(outGlb);
const faces = glbToFaces(bytes);
if (!faces.length) fail('baked GLB carries no geometry');
const sha256 = createHash('sha256').update(bytes).digest('hex');

let result = { ok: true, out_glb: outGlb, triangles: faces.length, sha256, preview_png: previewPng };

if (!args['no-bind']) {
  const slot = nextMeshPath(bindRef);
  await fs.writeFile(slot.path, bytes);
  await fs.writeFile(
    slot.sidecarPath,
    JSON.stringify(
      {
        source_path: srcGlb,
        bound_at: new Date().toISOString(),
        sha256,
        bytes: bytes.length,
        note: `blender-bake ${args.preset}${args.hero ? ` hero=${args.hero}` : ''}${args.clip ? ` clip=${args.clip}` : ''}`,
        worker: 'blender-bake',
        n: slot.n,
      },
      null,
      2,
    ),
  );
  result = { ...result, bound_ref: bindRef, n: slot.n, bound_path: slot.path };
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
