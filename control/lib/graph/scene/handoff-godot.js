/**
 * THE ENGINE HANDOFF'S GODOT ADAPTER: a handoff (scene/handoff.js resolveHandoff) as a Godot 4 project a developer opens.
 * Nothing in it plays the game: the web build is the game; this is its assets, animation and level, to wire and finish.
 *
 *   handoffGodotFiles(handoff, { title? }) → [{ file, data, keep? }]
 *     mojulo/level.glb               the handoff's GLB (lit materials, instances, lights, the level record in its extras)
 *     mojulo/level.glb.import        names the post-import script, so every (re)import of the GLB runs it
 *     mojulo/handoff.json            the level record and the ledger, and what glTF has no slot for: each material's
 *                                    height map for parallax (`materials`), the instanced sets (`instanced`, which get no
 *                                    collision), the terrain's atlases and weights (`terrain`), the sea's (`sea`) and the
 *                                    clip each rigged figure stands in (`stands`, handoff.js figureStands)
 *     mojulo/textures/*.png          those height maps, as files
 *     mojulo/terrain/*.png           the layered ground's images: its layers' atlases (imported as arrays, `.import` beside
 *                                    each), the scree's dice, the trail's mask, the grass's cover (kept as written)
 *     mojulo/handoff_terrain.gdshader  the World page's layered-ground fragment, ported, for the parts `terrain` names
 *     mojulo/handoff_sea.gdshader    the page's sea, ported, for the plane `sea` names (its depth map in mojulo/terrain/)
 *     mojulo/handoff_post_import.gd  the importer (handoff-godot/): materials, collision, the environment and the sun,
 *                                    the markers and the seats, built on every import from handoff.json
 *     mojulo/handoff_probe.gd        the gate's probe: what the import built, as one JSON line
 *     project.godot, level.tscn      written once (`keep`): the developer's project and scene, level.tscn instancing
 *                                    mojulo/level.glb, so a re-handoff (mojulo/ replaced, reimported) leaves them and
 *                                    whatever the developer added as they were
 *   writeHandoffGodot(handoff, outDir, { title? }) → { written, kept }: the files on disk, `keep` files only where missing
 *
 * Deterministic: the same handoff, the same bytes. Godot's own files (.godot/, .uid) are its to write.
 */
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const HANDOFF_GODOT_VERSION = 'handoff-godot/0';
/** The GLB node names an instance set's copies start with: instanced, so the importer gives them no collision. */
export const HANDOFF_INSTANCED = Object.freeze(['form:stones:', 'form:flora:']);

// (the adapter's GDScript, beside this file; read from the cwd: lib files may be bundled)
const gdDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'handoff-godot');
const gd = (name) => readFileSync(path.join(gdDir(), name), 'utf8');

const glbJson = (bytes) => { const b = Buffer.from(bytes); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const dataUrlBytes = (u) => Buffer.from(String(u).split(',')[1] ?? '', 'base64');
const fileKey = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');
const gdStr = (s) => JSON.stringify(String(s));

export const LEVEL_GLB_IMPORT = `[remap]

importer="scene"
importer_version=1
type="PackedScene"

[params]

import_script/path="res://mojulo/handoff_post_import.gd"
meshes/ensure_tangents=true
meshes/generate_lods=true
meshes/force_disable_compression=true
`;

// (the terrain's layer atlases, Godot's array importer: a cell a layer, mipmapped, lossless; and an image kept as written)
const TERRAIN_LAYERS = ['base', 'normal', 'orm'];
const layerArrayImport = (grid) => `[remap]

importer="2d_array_texture"
type="CompressedTexture2DArray"

[params]

compress/mode=0
mipmaps/generate=true
slices/horizontal=${grid}
slices/vertical=${grid}
`;
const KEEP_IMPORT = `[remap]

importer="keep"
`;

const projectGodot = (title) => `; a mojulo handoff's Godot project: yours from here (a re-handoff replaces mojulo/ only)
config_version=5

[application]

config/name=${gdStr(title)}
run/main_scene="res://level.tscn"
`;

export const LEVEL_TSCN = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://mojulo/level.glb" id="1_mojulo"]

[node name="Level" type="Node3D"]

[node name="Mojulo" parent="." instance=ExtResource("1_mojulo")]
`;

export function handoffGodotFiles(h, { title = null } = {}) {
  const j = glbJson(h.exported.bytes), files = [], tex = new Map();
  const texFile = (name, url) => { const f = `mojulo/textures/${fileKey(name)}.png`; if (!tex.has(f)) tex.set(f, dataUrlBytes(url)); return `res://${f}`; };
  // each material's height map, by the material's own name in the GLB: a dressed face's (its texture key, on every group
  // that lays it) and a plant's bark (its set's name)
  const materials = {};
  for (const m of j.materials ?? []) {
    const name = String(m.name ?? '');
    const dressed = Object.entries(h.materials ?? {}).find(([k]) => name.endsWith(`:${k}`));
    const set = (h.instances ?? []).find((s) => s.name === name && s.textures?.height);
    if (dressed && dressed[1].height) materials[name] = { height: texFile(`${dressed[0]}.height`, dressed[1].height), depth: dressed[1].depth, metres: dressed[1].metres };
    else if (set) materials[name] = { height: texFile(`${set.name}.height`, set.textures.height), depth: set.depth, metres: set.metres };
  }
  // the layered ground: each part's name, its read and its images for the terrain shader (handoff_terrain.gdshader), under
  // mojulo/terrain/: the layers' atlases imported by Godot as arrays (its own importer, a cell a layer, lossless), the
  // scree's dice, the trail's mask and the grass's cover kept as written (the importer reads them as they are, so the
  // mask keeps its packed bytes)
  const parts = (h.instances ?? []).filter((s) => s.terrain), terrainFiles = [];
  const terrain = parts.length ? {
    parts: parts.map((s) => s.name), read: parts[0].terrain.read, shader: 'res://mojulo/handoff_terrain.gdshader',
    images: Object.fromEntries(Object.entries(parts[0].terrain.atlases).map(([k, u]) => {
      const f = `mojulo/terrain/${k}.png`, grid = parts[0].terrain.read.atlas?.grid ?? 3;
      terrainFiles.push({ file: f, data: dataUrlBytes(u) }, { file: `${f}.import`, data: TERRAIN_LAYERS.includes(k) ? layerArrayImport(grid) : KEEP_IMPORT });
      return [k, `res://${f}`];
    })),
  } : null;
  // the sea: its plane's name, its read, its depth map kept as written (its red the depth over `max`) and its shader
  const seaSet = (h.instances ?? []).find((s) => s.sea);
  const sea = seaSet ? (() => {
    const { depth, ...read } = seaSet.sea;
    terrainFiles.push({ file: 'mojulo/terrain/sea_depth.png', data: dataUrlBytes(depth) }, { file: 'mojulo/terrain/sea_depth.png.import', data: KEEP_IMPORT });
    return { part: seaSet.name, read, image: 'res://mojulo/terrain/sea_depth.png', shader: 'res://mojulo/handoff_sea.gdshader' };
  })() : null;
  const handoffJson = { version: HANDOFF_GODOT_VERSION, handoff: h.ledger?.version ?? null, level: h.level ?? null, ledger: h.ledger ?? null,
    materials, instanced: [...HANDOFF_INSTANCED], ...(terrain ? { terrain } : {}), ...(sea ? { sea } : {}),
    ...(h.stands && Object.keys(h.stands).length ? { stands: h.stands } : {}) };
  files.push({ file: 'mojulo/level.glb', data: Buffer.from(h.exported.bytes) });
  files.push({ file: 'mojulo/level.glb.import', data: LEVEL_GLB_IMPORT });
  files.push({ file: 'mojulo/handoff.json', data: `${JSON.stringify(handoffJson, null, 1)}\n` });
  for (const [f, b] of [...tex].sort(([a], [b2]) => (a < b2 ? -1 : a > b2 ? 1 : 0))) files.push({ file: f, data: b });
  files.push(...terrainFiles);
  if (terrain) files.push({ file: 'mojulo/handoff_terrain.gdshader', data: gd('handoff_terrain.gdshader') });
  if (sea) files.push({ file: 'mojulo/handoff_sea.gdshader', data: gd('handoff_sea.gdshader') });
  files.push({ file: 'mojulo/handoff_post_import.gd', data: gd('handoff_post_import.gd') });
  files.push({ file: 'mojulo/handoff_probe.gd', data: gd('handoff_probe.gd') });
  files.push({ file: 'project.godot', data: projectGodot(title ?? h.level?.title ?? 'mojulo handoff'), keep: true });
  files.push({ file: 'level.tscn', data: LEVEL_TSCN, keep: true });
  return files;
}

export async function writeHandoffGodot(h, outDir, opts = {}) {
  const files = handoffGodotFiles(h, opts), written = [], kept = [];
  // (mojulo/ is mojulo's: cleared and written whole, so nothing a previous handoff wrote is left over)
  await fs.rm(path.join(outDir, 'mojulo'), { recursive: true, force: true });
  for (const f of files) {
    const p = path.join(outDir, f.file);
    if (f.keep && existsSync(p)) { kept.push(f.file); continue; }
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, f.data);
    written.push(f.file);
  }
  return { written, kept };
}
