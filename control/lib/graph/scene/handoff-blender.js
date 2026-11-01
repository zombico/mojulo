/**
 * THE ENGINE HANDOFF'S BLENDER ADAPTER: a handoff (scene/handoff.js resolveHandoff) as a folder a Blender artist opens.
 * Nothing in it plays the game: the web build is the game; this is its assets, animation and level, lit and dressed in
 * Blender for an art pass, a render or a further handoff.
 *
 *   handoffBlenderFiles(handoff, { title? }) → [{ file, data }]
 *     mojulo/level.glb               the handoff's GLB (lit materials, instances, lights, the level record in its extras)
 *     mojulo/handoff.json            the level record and the ledger, and what glTF has no slot for: each material's
 *                                    height map (`materials`), the instanced sets (`instanced`), the layered ground's
 *                                    read and images (`terrain`) and the sea's (`sea`)
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
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { decodePng } from '../era/tone.js';
import { encodePng, encodePngRgba } from '../landscape/surface-textures.js';
import { importerPy } from './blender-project.js';
import { HANDOFF_INSTANCED } from './handoff-godot.js';

export const HANDOFF_BLENDER_VERSION = 'handoff-blender/0';
/** The artist's .blend, beside mojulo/: written by the importer the first time, opened and rebuilt in place after. */
export const HANDOFF_BLEND = 'level.blend';

// (the adapter's Python, beside this file; read from the cwd, as the Godot adapter reads its GDScript: lib files may be bundled)
const pyDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'handoff-blender');
const py = (name) => readFileSync(path.join(pyDir(), name), 'utf8');

const glbJson = (bytes) => { const b = Buffer.from(bytes); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const dataUrlBytes = (u) => Buffer.from(String(u).split(',')[1] ?? '', 'base64');
const fileKey = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

// one layer of an atlas (a grid × grid of T × T cells, ATLAS_LAYERS' order: row by row from the top), as its own PNG
function atlasCells(url, grid, count) {
  const d = decodePng(url);
  if (!d) return null;
  const T = Math.floor(d.W / grid), out = [];
  for (let i = 0; i < count; i++) {
    const x0 = (i % grid) * T, y0 = Math.floor(i / grid) * T, px = Buffer.alloc(T * T * (d.alpha ? 4 : 3));
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const s = ((y0 + y) * d.W + x0 + x) * 4, o = (y * T + x) * (d.alpha ? 4 : 3);
      px[o] = d.px[s]; px[o + 1] = d.px[s + 1]; px[o + 2] = d.px[s + 2]; if (d.alpha) px[o + 3] = d.px[s + 3];
    }
    out.push(d.alpha ? encodePngRgba(px, T, T) : encodePng(px, T, T));
  }
  return out;
}

export function handoffBlenderFiles(h, { title = null } = {}) {
  const j = glbJson(h.exported.bytes), files = [], tex = new Map();
  const texFile = (name, url) => { const f = `textures/${fileKey(name)}.png`; if (!tex.has(f)) tex.set(f, dataUrlBytes(url)); return f; };
  // each material's height map, by the material's own name in the GLB (as Godot's: a dressed face's, a plant's bark)
  const materials = {};
  for (const m of j.materials ?? []) {
    const name = String(m.name ?? '');
    const dressed = Object.entries(h.materials ?? {}).find(([k]) => name.endsWith(`:${k}`));
    const set = (h.instances ?? []).find((s) => s.name === name && s.textures?.height);
    if (dressed && dressed[1].height) materials[name] = { height: texFile(`${dressed[0]}.height`, dressed[1].height), depth: dressed[1].depth, metres: dressed[1].metres };
    else if (set) materials[name] = { height: texFile(`${set.name}.height`, set.textures.height), depth: set.depth, metres: set.metres };
  }
  // the layered ground: its parts, its read, each layer of its atlases its own image (Blender has no texture arrays: a
  // layer a file, repeating on its own, as the page's array slices do), the scree's dice, the trail's mask and the
  // grass's cover as written (the importer reads them as data, so the mask keeps its packed bytes)
  const parts = (h.instances ?? []).filter((s) => s.terrain), terrainFiles = [];
  const terrain = parts.length ? (() => {
    const T0 = parts[0].terrain, cells = T0.read.atlas?.cells ?? [], grid = T0.read.atlas?.grid ?? 3, layers = {}, images = {};
    for (const [k, u] of Object.entries(T0.atlases)) {
      if (['base', 'normal', 'orm'].includes(k)) {
        const cut = atlasCells(u, grid, cells.length);
        if (!cut) continue;
        layers[k] = cut.map((b, i) => { const f = `terrain/${k}_${i}.png`; terrainFiles.push({ file: f, data: b }); return f; });
      } else { const f = `terrain/${k}.png`; terrainFiles.push({ file: f, data: dataUrlBytes(u) }); images[k] = f; }
    }
    return { parts: parts.map((s) => s.name), read: T0.read, layers, images };
  })() : null;
  // the sea: its plane's name, its read, its depth map as written (its red the depth over `max`)
  const seaSet = (h.instances ?? []).find((s) => s.sea);
  const sea = seaSet ? (() => {
    const { depth, ...read } = seaSet.sea;
    terrainFiles.push({ file: 'terrain/sea_depth.png', data: dataUrlBytes(depth) });
    return { part: seaSet.name, read, image: 'terrain/sea_depth.png' };
  })() : null;
  const handoffJson = { version: HANDOFF_BLENDER_VERSION, handoff: h.ledger?.version ?? null, title: title ?? h.level?.title ?? null, level: h.level ?? null, ledger: h.ledger ?? null,
    materials, instanced: [...HANDOFF_INSTANCED], ...(terrain ? { terrain } : {}), ...(sea ? { sea } : {}) };
  const at = (f) => `mojulo/${f}`;
  files.push({ file: at('level.glb'), data: Buffer.from(h.exported.bytes) });
  files.push({ file: at('handoff.json'), data: `${JSON.stringify(handoffJson, null, 1)}\n` });
  for (const [f, b] of [...tex].sort(([a], [b2]) => (a < b2 ? -1 : a > b2 ? 1 : 0))) files.push({ file: at(f), data: b });
  for (const f of terrainFiles) files.push({ file: at(f.file), data: f.data });
  files.push({ file: at('import_handoff.py'), data: py('import_handoff.py') });
  files.push({ file: at('handoff_nodes.py'), data: py('handoff_nodes.py') });
  files.push({ file: at('handoff_probe.py'), data: py('handoff_probe.py') });
  return files;
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
  const files = handoffBlenderFiles(h, { title }), written = [];
  // (mojulo/ is mojulo's: cleared and written whole, so nothing a previous handoff wrote is left over)
  await fs.rm(path.join(outDir, 'mojulo'), { recursive: true, force: true });
  for (const f of files) {
    const p = path.join(outDir, f.file);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, f.data);
    written.push(f.file);
  }
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
