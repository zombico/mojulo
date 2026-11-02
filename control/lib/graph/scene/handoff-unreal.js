/**
 * THE ENGINE HANDOFF'S UNREAL ADAPTER: a handoff (scene/handoff.js resolveHandoff) as an Unreal Engine 5 project a
 * developer opens. Nothing in it plays the game: the web build is the game; this is its assets, animation and level, to
 * wire and finish. (The Unreal ASSET pack, one thing by its ref, stays unreal-pack.js: `what: 'asset'`.)
 *
 *   handoffUnrealFiles(handoff, { title? }) → [{ file, data, keep? }]
 *     mojulo/level.glb               the handoff's GLB (lit materials, instances, lights, the level record in its extras)
 *     mojulo/handoff.json            the level record and the ledger, and what glTF has no slot for: each material's
 *                                    height map (`materials`), the instanced sets (`instanced`), the layered ground's
 *                                    read and images (`terrain`), the sea's (`sea`) and the clip each rigged figure
 *                                    stands in (`stands`, handoff.js figureStands)
 *     mojulo/textures/*.png          those height maps, as files
 *     mojulo/terrain/*.png           the layered ground's images: each layer of its atlases cut to its own image (the
 *                                    importer stacks them into a Texture2DArray, a layer a slice, as the page's arrays),
 *                                    the scree's dice, the trail's mask, the grass's cover, the sea's depth map
 *     mojulo/white.hdr               a white sky (an RGBE long-lat): the SkyLight's cubemap, its colour and intensity
 *                                    the solve's ambient
 *     mojulo/handoff_*.hlsl          the page's fragments ported to HLSL for the materials' Custom nodes (handoff-unreal/):
 *                                    the layered ground, the sea, the sky dome, the tone (Khronos PBR Neutral and the
 *                                    page's exp² haze, as a post-process material replacing the tonemapper)
 *     mojulo/import_handoff.py       the importer (Unreal editor Python, run headless with -run=pythonscript): imports the
 *                                    GLB with Interchange and builds the level (handoff-unreal/import_handoff.py)
 *     mojulo/handoff_probe.py        the gate's probe: what the import built, as one JSON line
 *     mojulo/handoff_render.py       a still per camera from the editor, offscreen (the visual gate)
 *     MojuloHandoff.uproject,        written once (`keep`): the developer's project (Python, Interchange) and its renderer
 *     Config/DefaultEngine.ini       settings (no Lumen, no screen-space reflections: the page lights with its solve), so
 *                                    a re-handoff leaves them as the developer left them
 *   writeHandoffUnreal(handoff, outDir, { title? }) → { written, kept }: the files on disk, `keep` files only where missing
 *
 * In the project the importer writes mojulo's content under /Game/Mojulo/ (replaced whole on every import: its assets
 * deleted and imported again, its sublevel /Game/Mojulo/Level_Mojulo emptied and built again in place), and the
 * developer's persistent level /Game/Level once, streaming mojulo's sublevel in (always loaded): whatever the developer
 * adds to /Game/Level stays. Deterministic: the same handoff, the same bytes. Unreal's own files (Content/, Saved/,
 * Intermediate/, DerivedDataCache/) are its to write.
 */
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { atlasCells } from './handoff-blender.js';
import { HANDOFF_INSTANCED } from './handoff-godot.js';

export const HANDOFF_UNREAL_VERSION = 'handoff-unreal/0';
/** The project file a pack carries (written once and kept). */
export const HANDOFF_UPROJECT = 'MojuloHandoff.uproject';
/** Where the importer builds in the project: the developer's persistent level, mojulo's content root and sublevel. */
export const HANDOFF_UNREAL_PATHS = Object.freeze({ map: '/Game/Level', root: '/Game/Mojulo', sublevel: '/Game/Mojulo/Level_Mojulo' });
/** The Unreal the adapter is built and measured against. */
export const HANDOFF_UNREAL_TARGET = 'Unreal Engine 5 (measured on 5.8.2)';

// (the adapter's Python and HLSL, beside this file; read from the cwd, as the other adapters read theirs: lib files may be bundled)
const srcDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'handoff-unreal');
const src = (name) => readFileSync(path.join(srcDir(), name), 'utf8');
export const HANDOFF_UNREAL_SOURCES = Object.freeze(['import_handoff.py', 'handoff_probe.py', 'handoff_render.py',
  'handoff_terrain.hlsl', 'handoff_sea.hlsl', 'handoff_sky.hlsl', 'handoff_tone.hlsl']);

const glbJson = (bytes) => { const b = Buffer.from(bytes); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const dataUrlBytes = (u) => Buffer.from(String(u).split(',')[1] ?? '', 'base64');
const fileKey = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

/** A white sky as a Radiance RGBE long-lat (64 × 32, run-length scanlines): every texel 1.0. */
export function whiteHdr(W = 64, H = 32) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'latin1');
  const line = [];
  for (const v of [128, 128, 128, 129]) for (let n = W; n > 0; n -= 127) line.push(128 + Math.min(n, 127), v);
  const row = Buffer.from([2, 2, W >> 8, W & 255, ...line]);
  return Buffer.concat([head, ...Array.from({ length: H }, () => row)]);
}

const uproject = (title) => `${JSON.stringify({
  FileVersion: 3,
  EngineAssociation: '',
  Category: '',
  Description: `${title}: a mojulo handoff (yours from here: a re-handoff replaces mojulo/ and /Game/Mojulo/ only)`,
  Plugins: [{ Name: 'PythonScriptPlugin', Enabled: true }, { Name: 'Interchange', Enabled: true }],
}, null, 2)}\n`;

// (the page lights with its solve, the sun, the lamps and the ambient, nothing else: no Lumen, no screen-space
// reflections; virtual shadow maps for the sun)
export const HANDOFF_UNREAL_INI = `; a mojulo handoff's renderer settings: yours from here (a re-handoff never rewrites this file)
[/Script/Engine.RendererSettings]
r.DynamicGlobalIlluminationMethod=0
r.ReflectionMethod=0
r.Shadow.Virtual.Enable=1
r.DefaultFeature.AutoExposure=False
r.DefaultFeature.Bloom=False
r.DefaultFeature.MotionBlur=False
r.DefaultFeature.LensFlare=False

[/Script/EngineSettings.GameMapsSettings]
EditorStartupMap=${HANDOFF_UNREAL_PATHS.map}.Level
GameDefaultMap=${HANDOFF_UNREAL_PATHS.map}.Level
`;

export function handoffUnrealFiles(h, { title = null } = {}) {
  const j = glbJson(h.exported.bytes), files = [], tex = new Map();
  const texFile = (name, url) => { const f = `textures/${fileKey(name)}.png`; if (!tex.has(f)) tex.set(f, dataUrlBytes(url)); return f; };
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
  // the layered ground: its parts, its read, each layer of its atlases its own image (stacked by the importer into a
  // Texture2DArray, a layer a slice), the scree's dice, the trail's mask and the grass's cover as written (read as data,
  // so the mask keeps its packed bytes)
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
    return { parts: parts.map((s) => s.name), read: T0.read, layers, images, hlsl: 'handoff_terrain.hlsl' };
  })() : null;
  // the sea: its plane's name, its read, its depth map as written (its red the depth over `max`)
  const seaSet = (h.instances ?? []).find((s) => s.sea);
  const sea = seaSet ? (() => {
    const { depth, ...read } = seaSet.sea;
    terrainFiles.push({ file: 'terrain/sea_depth.png', data: dataUrlBytes(depth) });
    return { part: seaSet.name, read, image: 'terrain/sea_depth.png', hlsl: 'handoff_sea.hlsl' };
  })() : null;
  const handoffJson = { version: HANDOFF_UNREAL_VERSION, handoff: h.ledger?.version ?? null, title: title ?? h.level?.title ?? null, paths: HANDOFF_UNREAL_PATHS,
    level: h.level ?? null, ledger: h.ledger ?? null, materials, instanced: [...HANDOFF_INSTANCED], ...(terrain ? { terrain } : {}), ...(sea ? { sea } : {}),
    ...(h.stands && Object.keys(h.stands).length ? { stands: h.stands } : {}) };
  const at = (f) => `mojulo/${f}`;
  files.push({ file: at('level.glb'), data: Buffer.from(h.exported.bytes) });
  files.push({ file: at('handoff.json'), data: `${JSON.stringify(handoffJson, null, 1)}\n` });
  for (const [f, b] of [...tex].sort(([a], [b2]) => (a < b2 ? -1 : a > b2 ? 1 : 0))) files.push({ file: at(f), data: b });
  for (const f of terrainFiles) files.push({ file: at(f.file), data: f.data });
  files.push({ file: at('white.hdr'), data: whiteHdr() });
  for (const name of HANDOFF_UNREAL_SOURCES) {
    if (name === 'handoff_terrain.hlsl' && !terrain) continue;
    if (name === 'handoff_sea.hlsl' && !sea) continue;
    files.push({ file: at(name), data: src(name) });
  }
  files.push({ file: HANDOFF_UPROJECT, data: uproject(title ?? h.level?.title ?? 'mojulo handoff'), keep: true });
  files.push({ file: 'Config/DefaultEngine.ini', data: HANDOFF_UNREAL_INI, keep: true });
  return files;
}

export async function writeHandoffUnreal(h, outDir, opts = {}) {
  const files = handoffUnrealFiles(h, opts), written = [], kept = [];
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

/** The headless commands for a pack at `dir` (`bin` the UnrealEditor-Cmd; the render takes UnrealEditor beside it). */
export function handoffUnrealCommands(dir, bin = '<UnrealEditor-Cmd>') {
  const q = (s) => `'${s}'`, proj = q(path.join(dir, HANDOFF_UPROJECT)), py = (f) => q(path.join(dir, 'mojulo', f));
  const ed = bin === '<UnrealEditor-Cmd>' ? '<UnrealEditor>' : q(bin.replace(/-Cmd$/, ''));
  const b = bin === '<UnrealEditor-Cmd>' ? bin : q(bin);
  return {
    import: `${b} ${proj} -run=pythonscript -script=${py('import_handoff.py')} -unattended -nosplash -AllowCommandletRendering -RenderOffscreen`,
    probe: `${b} ${proj} -run=pythonscript -script=${py('handoff_probe.py')} -unattended -nosplash -nullrhi`,
    open: `${ed} ${proj}`,
    render: `MOJULO_SHOTS=<shots.json> ${ed} ${proj} -RenderOffscreen -unattended -nosplash -nosound -ExecCmds="py ${path.join(dir, 'mojulo', 'handoff_render.py')}"`,
  };
}
