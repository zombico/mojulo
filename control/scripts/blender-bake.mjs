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
 *   node scripts/blender-bake.mjs --ref sk_bear --fur               # FUR: a plush finish rendered from three views
 *   node scripts/blender-bake.mjs --ref sk_bear --fur --fur-length 0.03 --turntable 24 --blend
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
import { findBlender, BLENDER_APP } from '../lib/workers/find.js';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { glbToFaces } from '../lib/graph/scene/scene-gltf-read.js';
import { nextMeshPath } from '../lib/graph/scene/mesh-store.js';
import { tagFurFaces, furSkip } from '../lib/graph/scene/fur-groups.js';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BLENDER = findBlender() ?? BLENDER_APP;
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
    // RENDER mode (lit-handoff.plan.md step 2): keep the Cycles FRAME instead of baking it.
    // Source = the LIT unshaded export (real PBR materials, textures as albedo); a sun + sky
    // (or the preset's studio rig with --light studio); a camera; a PNG under outcomes/<ref>/.
    // A derived outcome with provenance — never a recipe change, never a bind.
    render: { type: 'boolean', default: false },
    camera: { type: 'string' },     // "x,y,z" in world units (z-up, the recipe's frame)
    look: { type: 'string' },       // "x,y,z" the camera aims at
    fov: { type: 'string' },        // horizontal field of view, degrees (default 60)
    res: { type: 'string' },        // "WxH" pixels (default 1600x1000)
    light: { type: 'string' },      // render light: 'sun' (default — sun + sky) | 'studio' (the preset's area rig)
    out: { type: 'string' },        // output PNG path (default outcomes/<ref>/render-<light>.png)
    roughness: { type: 'string' },  // lit export roughness (default 0.85)
    sun: { type: 'string' },        // render sun "elevation,azimuth" in degrees (default 35,30 — low enough to come through the windows)
    exposure: { type: 'string' },   // render film exposure in stops (default 1.2)
    sky: { type: 'string' },        // render sky (world background) strength (default 3)
    open: { type: 'boolean', default: false },   // render with the ceiling / roof faces dropped (the dollhouse light, like the bake's roof cut)
    'no-bind': { type: 'boolean', default: false },
    unshaded: { type: 'boolean', default: true }, // generate a flat-albedo source from --ref (clean GI base)
    shaded: { type: 'boolean', default: false }, // opt out: bake the sketch's own shaded export instead
    blender: { type: 'string' },
    // FUR (1010 drawer-alignment Phase D, the stuffy finish): render mode with particle hair grown on the
    // character's palette groups, the eyes / mouth / brows left bare. A Blender-side finish, never a recipe change:
    // stills (and a turntable) under outcomes/<ref>/fur/, a provenance fur.json, and with --blend the .blend.
    fur: { type: 'boolean', default: false },
    'fur-length': { type: 'string' },   // strand length as a fraction of the subject's span (default 0.02)
    'fur-density': { type: 'string' },  // guide strands per span² of furred surface (default 9000)
    'fur-clump': { type: 'string' },    // 0 loose → 1 tufted (default 0.15)
    'fur-fuzz': { type: 'string' },     // strand waviness, a fraction of span (default 0.012)
    'fur-children': { type: 'string' }, // interpolated strands rendered per guide (default 6)
    'fur-short': { type: 'string' },    // palette groups given a short felt nap (a third of the length): a doll's face and hands
    'fur-skip': { type: 'string' },     // palette groups left bare, comma-separated (default: eyes, lids, brows, mouth, nose, claws, hooves, horns)
    views: { type: 'string' },          // "name:az[:el],…" degrees around the subject, az 0 = its front (fur default: front, three-quarter, back)
    turntable: { type: 'string' },      // N frames around the subject, joined into turntable.gif
    blend: { type: 'boolean', default: false }, // also save the furred scene as a .blend to keep working in
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

const furMode = !!args.fur;
const renderMode = !!args.render || furMode;
if (furMode && !args.ref) fail('--fur needs --ref <character sketch>: the palette names which parts grow fur');
const bindRef = args['bind-to'] || args.ref;
if (!renderMode && !args['no-bind'] && !bindRef) fail('need --ref (or --bind-to with --glb) to bind the result; or pass --no-bind for a dry run');
if (renderMode && !args.ref && !args.glb) fail('--render needs --ref <sketch> (or --glb <path>)');

const blenderBin = args.blender || BLENDER;
if (!existsSync(blenderBin)) fail(`Blender not found at ${blenderBin} — install Blender or set MOJULO_BLENDER (see docs/local-blender-worker.md)`);

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'moj-bake-'));

// Source GLB. Precedence:
//   --glb <path>         operator-supplied — used AS-IS (pass an unshaded export for a clean bake).
//   --ref + unshaded     GENERATE a flat-albedo (FLAT_LIGHT) source here, in-process, from the
//                        sketch's recipe — the clean GI base. NOT the shaded data/outcomes export.
//   --ref + --shaded     read the sketch's own shaded export at data/outcomes/<ref>/model.glb.
let srcGlb;
let unitScale = 1;
let furPalette = null;  // fur mode: the palette groups that grow fur, group → hex   // the kind's metersPerUnit (the floorplan: feet) — render mode keeps it, so --camera/--look (recipe units) scale below
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
  // render mode exports LIT: real PBR materials (roughness dial) over the unshaded base, so
  // the glTF importer hands Cycles a Principled BSDF with vertex colour × any texture as albedo
  // Units: a bake ROUND-TRIPS (the baked GLB is bound back into the world), so it stays in
  // recipe units; a render is a Cycles frame with physical lights, so it goes out in metres.
  if (renderMode) unitScale = Number(payload.metersPerUnit) > 0 ? Number(payload.metersPerUnit) : 1;
  else delete payload.metersPerUnit;
  if (furMode) {
    // the studio floor stays out of a portrait; every other face is tagged by its palette group (an unshaded face
    // carries its group's colour exactly), `fur:<Group>` or `bare:<Group>`, one glTF node each
    const palette = (sketch.manifest && sketch.manifest.recipe && sketch.manifest.recipe.palette) || {};
    const tagged = tagFurFaces(payload.faces, palette, furSkip(args['fur-skip']));
    payload.faces = tagged.faces;
    furPalette = tagged.palette;
    if (!payload.faces.some((f) => f.group.startsWith('fur:'))) fail(`sketch '${args.ref}' has no palette groups left to fur (its palette: ${Object.keys(palette).join(', ') || 'none'})`);
  }
  if (renderMode && args.open && Array.isArray(payload.faces)) {
    payload.faces = payload.faces.filter((f) => !(typeof f.group === 'string' && (f.group.startsWith('shell:ceiling') || f.group.startsWith('roof'))));
  }
  const { bytes } = facesToGlb(payload, { clips: furMode ? null : '_all', generator: `mojulo ${args.ref} (unshaded${renderMode ? ', lit' : ''})`, ...(renderMode ? { lit: true, roughness: args.roughness ? Number(args.roughness) : 0.85 } : {}) });
  srcGlb = path.join(work, 'unshaded-src.glb');
  await fs.writeFile(srcGlb, bytes);
} else if (args.ref) {
  srcGlb = path.join(OUTCOMES, args.ref, 'model.glb');
  if (!existsSync(srcGlb)) fail(`source GLB not found: ${srcGlb} — run export_model on this ref first (or drop --shaded to generate an unshaded source)`);
} else {
  fail('need --glb <path> or --ref <sketch>');
}

// ── RENDER mode: one Cycles frame, then out ──
if (renderMode) {
  const toMetres = (v) => (v && unitScale !== 1 ? v.map((x) => x * unitScale) : v);   // the operator authors in recipe units
  const triple = (v, name) => { if (!v) return null; const a = v.split(',').map(Number); if (a.length !== 3 || a.some((x) => !Number.isFinite(x))) fail(`--${name} wants "x,y,z"`); return a; };
  const res = (args.res || '1600x1000').split('x').map(Number);
  if (res.length !== 2 || res.some((x) => !(x > 0))) fail('--res wants "WxH"');
  const lightMode = args.light || (furMode ? 'plush' : 'sun');
  if (!['sun', 'studio', 'plush'].includes(lightMode)) fail("--light is 'sun', 'studio' or 'plush'");
  const outDir = args.ref ? path.join(OUTCOMES, args.ref, ...(furMode ? ['fur'] : [])) : work;
  await fs.mkdir(outDir, { recursive: true });
  const png = args.out ? path.resolve(args.out) : path.join(outDir, `render-${lightMode}${args.open ? '-open' : ''}.png`);
  const rcfg = {
    src_glb: srcGlb,
    render: {
      png, camera: toMetres(triple(args.camera, 'camera')), look: toMetres(triple(args.look, 'look')),
      fov: args.fov ? Number(args.fov) : (furMode ? 40 : 60), res, samples: args.samples ? Number(args.samples) : 256,
      light: lightMode, rig: lightMode === 'studio' ? preset.light : null,
      sun: (args.sun || '35,30').split(',').map(Number), exposure: args.exposure ? Number(args.exposure) : (lightMode === 'plush' ? -0.7 : 1.2), sky: args.sky ? Number(args.sky) : 3, open: !!args.open,
    },
  };
  // views: named angles around the subject (az 0 = its front); a turntable is N evenly spaced unnamed ones
  const parseViews = (spec) => spec.split(',').map((v) => { const [name, az, el] = v.split(':'); return { name, az: Number(az), el: el === undefined ? 12 : Number(el) }; });
  let views = args.views ? parseViews(args.views) : furMode ? parseViews('front:0,three-quarter:35,back:180') : null;
  if (views && views.some((v) => !v.name || !Number.isFinite(v.az) || !Number.isFinite(v.el))) fail('--views wants "name:az[:el],…" in degrees');
  const frames = args.turntable ? Number(args.turntable) : 0;
  if (args.turntable && !(Number.isInteger(frames) && frames >= 4 && frames <= 120)) fail('--turntable wants a frame count between 4 and 120');
  if (views) views = views.map((v) => ({ ...v, png: path.join(outDir, `${v.name}.png`) }));
  const turn = frames ? Array.from({ length: frames }, (_, i) => ({ name: `turn-${String(i).padStart(3, '0')}`, az: (360 * i) / frames, el: 12, png: path.join(work, `turn-${String(i).padStart(3, '0')}.png`) })) : [];
  if (views || turn.length) rcfg.render.views = [...(views || []), ...turn];
  if (furMode) rcfg.render.distance = 1.6;   // a portrait: the subject fills the frame at fov 40
  if (furMode) {
    const num = (k, d) => (args[k] != null ? Number(args[k]) : d);
    rcfg.render.fur = {
      length: num('fur-length', 0.02), density: num('fur-density', 9000), clump: num('fur-clump', 0.15),
      fuzz: num('fur-fuzz', 0.012), children: num('fur-children', 6), seed: 7, colors: furPalette,
      short: args['fur-short'] ? args['fur-short'].split(',').map((g) => g.trim()).filter(Boolean) : [],
    };
    for (const [k, v] of Object.entries(rcfg.render.fur)) if (k !== 'colors' && k !== 'short' && !(Number.isFinite(v) && v >= 0)) fail(`--fur-${k} wants a number ≥ 0`);
  }
  if (args.blend) rcfg.render.blend = path.join(outDir, furMode ? 'stuffy.blend' : 'render.blend');
  const rcfgPath = path.join(work, 'render-config.json');
  await fs.writeFile(rcfgPath, JSON.stringify(rcfg, null, 2));
  const rcode = await new Promise((resolve) => {
    const proc = spawn(blenderBin, ['-b', '-P', path.join(here, 'blender-bake.py'), '--', rcfgPath], { stdio: ['ignore', 'inherit', 'inherit'] });
    proc.on('close', resolve);
  });
  const outputs = rcfg.render.views ? rcfg.render.views.map((v) => v.png) : [png];
  if (rcode !== 0 || outputs.some((p) => !existsSync(p))) fail(`Blender render failed (exit ${rcode})`);
  if (rcfg.render.views) {
    let gif = null;
    if (turn.length) {
      const { encodeGifBuffers } = await import('../lib/motion/encode-gif.js');
      gif = await encodeGifBuffers(await Promise.all(turn.map((t) => fs.readFile(t.png))), path.join(outDir, 'turntable.gif'), { fps: 12, width: 480 });
    }
    // provenance beside the renders: the source, the parameters and the worker, so the finish can be re-made
    const sourceSha = createHash('sha256').update(await fs.readFile(srcGlb)).digest('hex');
    const result = {
      ok: true, mode: furMode ? 'fur' : 'render', ref: args.ref || null, worker: 'blender-bake', blender: blenderBin,
      stills: (views || []).map((v) => v.png), turntable: gif ? gif.outPath : null, blend: rcfg.render.blend || null,
      fur: rcfg.render.fur || null, light: lightMode, samples: rcfg.render.samples, res, source_glb_sha256: sourceSha,
      note: furMode ? 'A Blender-side finish: the recipe is unchanged, and glTF cannot carry the strands.' : undefined,
    };
    await fs.writeFile(path.join(outDir, furMode ? 'fur.json' : 'render.json'), JSON.stringify({ ...result, made_at: new Date().toISOString() }, null, 2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(0);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, mode: 'render', ref: args.ref || null, png, source_glb: srcGlb, lit: true, units_scale: unitScale, light: lightMode, sun: rcfg.render.sun, exposure: rcfg.render.exposure, open: rcfg.render.open, samples: rcfg.render.samples, res, camera: rcfg.render.camera, look: rcfg.render.look, fov: rcfg.render.fov })}\n`);
  process.exit(0);
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
