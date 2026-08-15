#!/usr/bin/env node
/**
 * export-unshaded.mjs — write a FLAT-ALBEDO (unshaded) .glb for a sketch ref.
 *
 * Mirrors the unshaded-source path in blender-bake.mjs: mojulo normally bakes its
 * own Lambert + AO into vertex colours, which makes the exported model.glb's
 * colours SHADED (unreliable for per-part segmentation). This emits the raw tints
 * (litFactor ≡ 1) so studio-render.py's `byluma` island classifier can split parts
 * by their true tint luminance. NOT for display — a segmentation aid.
 *
 * Usage (from control/, repo-dev needs the data-dir env):
 *   MOJULO_DATA_DIR="$(pwd)/data" MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes" \
 *     node scripts/export-unshaded.mjs --ref <ref> --out <path.glb>
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { register } from 'node:module';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  out: { type: 'string' },
} });

if (!args.ref || !args.out) {
  process.stderr.write('need --ref <ref> --out <path.glb>\n');
  process.exit(1);
}

register('./mcp-stdio-loader.mjs', import.meta.url);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { facesToGlb } = await import('@/lib/graph/scene/scene-gltf');

const sketch = SketchRepository.getByRef(args.ref);
if (!sketch) { process.stderr.write(`sketch '${args.ref}' not found\n`); process.exit(1); }
const { payload, kind } = await resolveWorldScene(sketch, { unshaded: true });
if (!payload) { process.stderr.write(`sketch '${args.ref}' (kind '${kind}') has no exportable geometry\n`); process.exit(1); }
if (payload.unshadedWarning) process.stderr.write(`[unshaded note] ${payload.unshadedWarning}\n`);
const { bytes } = facesToGlb(payload, { clips: '_all', generator: `mojulo ${args.ref} (unshaded)` });
await fs.writeFile(args.out, bytes);
process.stdout.write(JSON.stringify({ ok: true, ref: args.ref, out: args.out, bytes: bytes.length, kind }) + '\n');
