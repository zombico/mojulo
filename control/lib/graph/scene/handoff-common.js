/**
 * THE ENGINE HANDOFF'S COMMON PACK: what every adapter (handoff-godot.js, handoff-blender.js, handoff-unreal.js,
 * handoff-unity.js) reads off a handoff (handoff.js resolveHandoff) and writes alike. Each adapter names its own files
 * and paths; what the files say is said here once.
 *
 *   HANDOFF_INSTANCED                the GLB node names an instance set's copies start with (instanced: no collision)
 *   glbJson(bytes), dataUrlBytes(url), fileKey(name)   a GLB's JSON chunk, a data URL's bytes, a name made a file's
 *   atlasCells(url, grid, count) → [png]   one layer of an atlas (a grid × grid of cells, row by row from the top), each
 *                                    its own PNG
 *   heightMaterials(h, ref) → { <material>: { height, depth, metres } }: each material's height map, by the material's
 *                                    own name in the GLB (a dressed face's: its texture key, on every group that lays it;
 *                                    a plant's bark: its set's name); `ref(name, url)` stores the image and returns
 *                                    what handoff.json calls it
 *   terrainLayers(h, dir) → { terrain: { parts, read, layers, images }, files } | null: the layered ground's parts, its
 *                                    read, each layer of its atlases cut to its own image under `dir` (a layer a file:
 *                                    an engine stacks them into an array, or repeats each on its own), the scree's dice,
 *                                    the trail's mask and the grass's cover as written (read as data, so the mask keeps
 *                                    its packed bytes)
 *   seaOf(h) → { part, read, depth } | null: the sea's plane, its read and its depth map's bytes (its red the depth over
 *                                    `max`)
 *   handoffJson(h, version, { head?, materials, terrain?, sea? }) → handoff.json's text: the adapter's version, the
 *                                    contract's, the adapter's `head` (its title, its paths), the level record and the
 *                                    ledger, the materials, the instanced sets, the terrain, the sea, the clip each rigged
 *                                    figure stands in (`stands`) and the room's lamps by their GLB node names (`lamps`:
 *                                    the lights in the solve's units, handoff.js roomLamps; any other light is glTF's
 *                                    candela), each absent when the handoff has none
 *   sortedFiles(map, at) → [{ file, data }]: a Map of files, in name order, each path through `at`
 *   packSource(folder, name) → text: an adapter's own source (lib/graph/scene/<folder>/<name>), with every
 *                                    `// @mojulo-include <file>` line replaced by handoff-hlsl/<file>, indented as the
 *                                    line is: the fragments Unreal's and Unity's shaders share, written once
 *   writePack(files, outDir, root) → { written, kept }: `root` (mojulo's folder) cleared and written whole, a `keep`
 *                                    file only where it is missing
 *
 * Deterministic: the same handoff, the same bytes.
 */
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { decodePng } from '../era/tone.js';
import { encodePng, encodePngRgba } from '../landscape/surface-textures.js';

export const HANDOFF_INSTANCED = Object.freeze(['form:stones:', 'form:flora:']);

export const glbJson = (bytes) => { const b = Buffer.from(bytes); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
export const dataUrlBytes = (u) => Buffer.from(String(u).split(',')[1] ?? '', 'base64');
export const fileKey = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

export function atlasCells(url, grid, count) {
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

export function heightMaterials(h, ref) {
  const materials = {};
  for (const m of glbJson(h.exported.bytes).materials ?? []) {
    const name = String(m.name ?? '');
    const dressed = Object.entries(h.materials ?? {}).find(([k]) => name.endsWith(`:${k}`));
    const set = (h.instances ?? []).find((s) => s.name === name && s.textures?.height);
    if (dressed && dressed[1].height) materials[name] = { height: ref(`${dressed[0]}.height`, dressed[1].height), depth: dressed[1].depth, metres: dressed[1].metres };
    else if (set) materials[name] = { height: ref(`${set.name}.height`, set.textures.height), depth: set.depth, metres: set.metres };
  }
  return materials;
}

const LAYER_ATLASES = ['base', 'normal', 'orm'];
export function terrainLayers(h, dir) {
  const parts = (h.instances ?? []).filter((s) => s.terrain);
  if (!parts.length) return null;
  const T0 = parts[0].terrain, cells = T0.read.atlas?.cells ?? [], grid = T0.read.atlas?.grid ?? 3, layers = {}, images = {}, files = [];
  for (const [k, u] of Object.entries(T0.atlases)) {
    if (LAYER_ATLASES.includes(k)) {
      const cut = atlasCells(u, grid, cells.length);
      if (!cut) continue;
      layers[k] = cut.map((b, i) => { const f = `${dir}/${k}_${i}.png`; files.push({ file: f, data: b }); return f; });
    } else { const f = `${dir}/${k}.png`; files.push({ file: f, data: dataUrlBytes(u) }); images[k] = f; }
  }
  return { terrain: { parts: parts.map((s) => s.name), read: T0.read, layers, images }, files };
}

export function seaOf(h) {
  const s = (h.instances ?? []).find((x) => x.sea);
  if (!s) return null;
  const { depth, ...read } = s.sea;
  return { part: s.name, read, depth: dataUrlBytes(depth) };
}

export function handoffJson(h, version, { head = {}, materials, terrain = null, sea = null }) {
  const json = { version, handoff: h.ledger?.version ?? null, ...head, level: h.level ?? null, ledger: h.ledger ?? null,
    materials, instanced: [...HANDOFF_INSTANCED], ...(terrain ? { terrain } : {}), ...(sea ? { sea } : {}),
    ...(h.stands && Object.keys(h.stands).length ? { stands: h.stands } : {}), ...(h.lamps?.length ? { lamps: h.lamps } : {}) };
  return `${JSON.stringify(json, null, 1)}\n`;
}

export const sortedFiles = (map, at = (f) => f) => [...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([f, data]) => ({ file: at(f), data }));

// (the adapters' sources, beside this file; read from the cwd: lib files may be bundled)
const sceneDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene');
const INCLUDE = /^([ \t]*)\/\/ @mojulo-include ([A-Za-z0-9_.-]+)[ \t]*$/;
export function packSource(folder, name) {
  return readFileSync(path.join(sceneDir(), folder, name), 'utf8').split('\n').map((line) => {
    const m = INCLUDE.exec(line);
    if (!m) return line;
    const shared = readFileSync(path.join(sceneDir(), 'handoff-hlsl', m[2]), 'utf8').replace(/\n$/, '');
    return shared.split('\n').map((l) => (l ? m[1] + l : l)).join('\n');
  }).join('\n');
}

export async function writePack(files, outDir, root) {
  const written = [], kept = [];
  // (mojulo's folder is mojulo's: cleared and written whole, so nothing a previous handoff wrote is left over)
  await fs.rm(path.join(outDir, root), { recursive: true, force: true });
  for (const f of files) {
    const p = path.join(outDir, f.file);
    if (f.keep && existsSync(p)) { kept.push(f.file); continue; }
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, f.data);
    written.push(f.file);
  }
  return { written, kept };
}
