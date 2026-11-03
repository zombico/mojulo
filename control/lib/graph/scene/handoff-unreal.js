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
import path from 'node:path';
import { dataUrlBytes, fileKey, heightMaterials, terrainLayers, seaOf, handoffJson, sortedFiles, packSource, writePack } from './handoff-common.js';

export const HANDOFF_UNREAL_VERSION = 'handoff-unreal/0';
/** The project file a pack carries (written once and kept). */
export const HANDOFF_UPROJECT = 'MojuloHandoff.uproject';
/** Where the importer builds in the project: the developer's persistent level, mojulo's content root and sublevel. */
export const HANDOFF_UNREAL_PATHS = Object.freeze({ map: '/Game/Level', root: '/Game/Mojulo', sublevel: '/Game/Mojulo/Level_Mojulo' });
/** The Unreal the adapter is built and measured against. */
export const HANDOFF_UNREAL_TARGET = 'Unreal Engine 5 (measured on 5.8.2)';

// (the adapter's Python and HLSL, beside this file: handoff-unreal/, its shaders' shared fragments from handoff-hlsl/)
const src = (name) => packSource('handoff-unreal', name);
export const HANDOFF_UNREAL_SOURCES = Object.freeze(['import_handoff.py', 'handoff_probe.py', 'handoff_render.py',
  'handoff_terrain.hlsl', 'handoff_sea.hlsl', 'handoff_sky.hlsl', 'handoff_tone.hlsl']);

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
  const tex = new Map(), at = (f) => `mojulo/${f}`;
  // each material's height map (handoff-common.js heightMaterials), under mojulo/textures/
  const materials = heightMaterials(h, (name, url) => { const f = `textures/${fileKey(name)}.png`; if (!tex.has(f)) tex.set(f, dataUrlBytes(url)); return f; });
  // the layered ground: each layer of its atlases its own image, stacked by the importer into a Texture2DArray (a layer a
  // slice), the rest as written (handoff-common.js terrainLayers); the sea's depth map as written
  const T = terrainLayers(h, 'terrain'), S = seaOf(h);
  const terrain = T ? { ...T.terrain, hlsl: 'handoff_terrain.hlsl' } : null;
  const sea = S ? { part: S.part, read: S.read, image: 'terrain/sea_depth.png', hlsl: 'handoff_sea.hlsl' } : null;
  return [
    { file: at('level.glb'), data: Buffer.from(h.exported.bytes) },
    { file: at('handoff.json'), data: handoffJson(h, HANDOFF_UNREAL_VERSION, { head: { title: title ?? h.level?.title ?? null, paths: HANDOFF_UNREAL_PATHS }, materials, terrain, sea }) },
    ...sortedFiles(tex, at),
    ...[...(T?.files ?? []), ...(S ? [{ file: 'terrain/sea_depth.png', data: S.depth }] : [])].map((f) => ({ file: at(f.file), data: f.data })),
    { file: at('white.hdr'), data: whiteHdr() },
    ...HANDOFF_UNREAL_SOURCES.filter((name) => (name !== 'handoff_terrain.hlsl' || terrain) && (name !== 'handoff_sea.hlsl' || sea)).map((name) => ({ file: at(name), data: src(name) })),
    { file: HANDOFF_UPROJECT, data: uproject(title ?? h.level?.title ?? 'mojulo handoff'), keep: true },
    { file: 'Config/DefaultEngine.ini', data: HANDOFF_UNREAL_INI, keep: true },
  ];
}

export async function writeHandoffUnreal(h, outDir, opts = {}) {
  return writePack(handoffUnrealFiles(h, opts), outDir, 'mojulo');
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
