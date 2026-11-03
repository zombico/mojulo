/**
 * THE ENGINE HANDOFF'S BLENDER ADAPTER: a handoff (scene/handoff.js resolveHandoff) as a folder a Blender artist opens.
 * Nothing in it plays the game: the web build is the game; this is its assets, animation and level, lit and dressed in
 * Blender for an art pass, a render or a further handoff.
 *
 *   handoffBlenderFiles(handoff, { title? }) → [{ file, data }]
 *     mojulo/level.glb               the handoff's GLB (lit materials, instances, lights, the level record in its extras)
 *     mojulo/handoff.json            the level record and the ledger, and what glTF has no slot for: each material's
 *                                    height map (`materials`), the instanced sets (`instanced`), the layered ground's
 *                                    read and images (`terrain`), the sea's (`sea`) and the clip each rigged figure
 *                                    stands in (`stands`, handoff.js figureStands)
 *     mojulo/textures/*.png          those height maps, as files
 *     mojulo/terrain/*.png           the layered ground's images: each layer of its atlases cut to its own image (a
 *                                    layer a file, so each repeats on its own and no cell bleeds into the next one's
 *                                    mips), the scree's dice, the trail's mask, the grass's cover, the sea's depth map
 *     mojulo/import_handoff.py       the importer (handoff-blender/): imports the GLB with Blender's glTF importer into
 *                                    mojulo's own collections of the artist's level.blend, and builds from handoff.json
 *                                    the materials, the layered ground's and the sea's node trees (handoff_nodes.py, the
 *                                    page's fragments ported), the World (the page's sky dome, the solve's ambient), the
 *                                    haze, the sun, the lamps at the page's strength, the camera, every marker and seat
 *     mojulo/handoff_nodes.py        the node trees: the layered ground, the sea, the haze, the sky
 *     mojulo/handoff_probe.py        the gate's probe: what the import built, as one JSON line
 *   writeHandoffBlender(handoff, outDir, { title?, sketch?, fireT?, fireDetail? }) → { written, kept, fire }
 *     mojulo/ is cleared and written whole. level.blend beside it is the artist's: the importer writes it the first time
 *     and, on a re-handoff, opens it, removes only what mojulo built (its collections, its world, the data it imported)
 *     and builds them again, so whatever the artist added in their own collections stays. A world with `fire` carries
 *     its fire at `fireT` (the art pack's own writer, blender-pack.js packFire) under mojulo/fire/, built by
 *     mojulo/handoff_fire.py (the art pack's fire builder) into the `mojulo-fire` collection.
 *
 * Deterministic: the same handoff, the same bytes. level.blend and fire/vdb/ are Blender's to write.
 */
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { importerPy } from './blender-project.js';
import { dataUrlBytes, fileKey, heightMaterials, terrainLayers, seaOf, handoffJson, sortedFiles, packSource, writePack } from './handoff-common.js';

export const HANDOFF_BLENDER_VERSION = 'handoff-blender/0';
/** The artist's .blend, beside mojulo/: written by the importer the first time, opened and rebuilt in place after. */
export const HANDOFF_BLEND = 'level.blend';

// (the adapter's Python, beside this file: handoff-blender/)
const py = (name) => packSource('handoff-blender', name);

export function handoffBlenderFiles(h, { title = null } = {}) {
  const tex = new Map(), at = (f) => `mojulo/${f}`;
  // each material's height map (handoff-common.js heightMaterials, as Godot's), under mojulo/textures/
  const materials = heightMaterials(h, (name, url) => { const f = `textures/${fileKey(name)}.png`; if (!tex.has(f)) tex.set(f, dataUrlBytes(url)); return f; });
  // the layered ground: each layer of its atlases its own image (Blender has no texture arrays: a layer a file, repeating
  // on its own, as the page's array slices do), the rest as written (handoff-common.js terrainLayers)
  const T = terrainLayers(h, 'terrain'), S = seaOf(h);
  const sea = S ? { part: S.part, read: S.read, image: 'terrain/sea_depth.png' } : null;
  return [
    { file: at('level.glb'), data: Buffer.from(h.exported.bytes) },
    { file: at('handoff.json'), data: handoffJson(h, HANDOFF_BLENDER_VERSION, { head: { title: title ?? h.level?.title ?? null }, materials, terrain: T?.terrain, sea }) },
    ...sortedFiles(tex, at),
    ...[...(T?.files ?? []), ...(S ? [{ file: 'terrain/sea_depth.png', data: S.depth }] : [])].map((f) => ({ file: at(f.file), data: f.data })),
    ...['import_handoff.py', 'handoff_nodes.py', 'handoff_probe.py'].map((f) => ({ file: at(f), data: py(f) })),
  ];
}

// THE ART PACK'S FIRE BUILDER, for a handoff of a world with fire: import_mojulo.py's fire section (blender-project.js,
// the same text, not a copy) as a module the importer runs over mojulo/fire/, with the few names it reads from the art
// pack's importer
export function handoffFirePy() {
  const src = importerPy(), a = src.indexOf('# ---- fire ('), b = src.indexOf('\ndef render():');
  if (a < 0 || b < a) throw new Error('handoff-blender: the art pack\'s fire builder moved (blender-project.js importerPy)');
  return `"""
handoff_fire.py - a mojulo handoff's fire, built in Blender: the Blender art pack's own fire builder (import_mojulo.py's
fire section), run by import_handoff.py over mojulo/fire/ (the world's fire at one instant: its flames as OpenVDB
volumes of light, its smoke, its embers, a light per fire, its props) into the 'mojulo-fire' collection.
"""
import bpy
import json
import os
import sys
from mathutils import Vector

PACK = os.environ.get('MOJULO_FIRE_PACK') or os.path.dirname(os.path.abspath(__file__))


def _argv():
    a = sys.argv
    return a[a.index('--') + 1:] if '--' in a else []


def _opt(name, default=None):
    a = _argv()
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def log(*a):
    print('[mojulo-handoff]', *a)


def base_name(n):
    if len(n) > 4 and n[-4] == '.' and n[-3:].isdigit():
        return n[:-4]
    return n


${src.slice(a, b).trimEnd()}
`;
}

export async function writeHandoffBlender(h, outDir, { title = null, sketch = null, fireT = null, fireDetail = 1 } = {}) {
  const { written } = await writePack(handoffBlenderFiles(h, { title }), outDir, 'mojulo');
  // (a world's fire at one instant, by the art pack's writer, under mojulo/fire/)
  let fire = null;
  if (sketch?.manifest?.fire) {
    const { packFire } = await import('./blender-pack.js');
    const dir = path.join(outDir, 'mojulo');
    const writeOut = async (rel, data) => { await fs.writeFile(path.join(dir, rel), data); if (!/^fire\/g\d+\.bin$/.test(rel)) written.push(`mojulo/${rel}`); };
    fire = await packFire({ sketch, manifest: sketch.manifest, payload: null, shaded: false, fireT, fireDetail, outDir: dir, writeOut });
    if (fire) { await fs.writeFile(path.join(dir, 'handoff_fire.py'), handoffFirePy()); written.push('mojulo/handoff_fire.py'); }
  }
  const kept = existsSync(path.join(outDir, HANDOFF_BLEND)) ? [HANDOFF_BLEND] : [];
  return { written, kept, fire };
}
