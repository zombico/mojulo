/**
 * THE ENGINE HANDOFF'S UNITY ADAPTER: a handoff (scene/handoff.js resolveHandoff) as a Unity 6 project (URP) a developer
 * opens. Nothing in it plays the game: the web build is the game; this is its assets, animation and level, to wire and
 * finish.
 *
 *   handoffUnityFiles(handoff, { title? }) → [{ file, data, keep? }]
 *     Assets/Mojulo/level.glb          the handoff's GLB (lit materials, instances, lights, the level record in its extras),
 *                                      imported by glTFast (com.unity.cloud.gltfast; Unity has no glTF importer of its own)
 *     Assets/Mojulo/handoff.json       the level record and the ledger, and what glTF has no slot for: each material's
 *                                      height map (`materials`), the instanced sets (`instanced`), the layered ground's
 *                                      read and images (`terrain`), the sea's (`sea`) and the clip each rigged figure
 *                                      stands in (`stands`, handoff.js figureStands)
 *     Assets/Mojulo/Data~/…            those images as files, read by the importer as they are written (a folder Unity
 *                                      does not import): the height maps, each layer of the ground's atlases cut to its own
 *                                      image (stacked by the importer into a Texture2DArray, a layer a slice), the scree's
 *                                      dice, the trail's mask, the grass's cover, the sea's depth map
 *     Assets/Mojulo/Editor/*.cs        the importer (MojuloImport.cs: `-batchmode -executeMethod Mojulo.Handoff.Import.Run`,
 *                                      or the editor's Mojulo menu) and the gate's probe and stills (MojuloProbe.cs)
 *     Assets/Mojulo/Runtime/*.cs       the records the level carries: MojuloLevel (the level's record and environment),
 *                                      MojuloMarker (a marker's or a seat's record), MojuloStream (mojulo's scene, loaded
 *                                      into the developer's)
 *     Assets/Mojulo/Shaders/…          the page's fragments ported to URP (handoff-unity/): the lit surfaces, the layered
 *                                      ground, the sea, the sky dome, and the tone (Khronos PBR Neutral and the page's exp²
 *                                      haze, a full-screen pass) with its material and the sky's
 *     every file and folder its .meta, its GUID from its path (unityGuid), so what references mojulo's scripts, shaders
 *     and materials holds across handoffs
 *     Packages/manifest.json,          written once (`keep`): the developer's project (URP, glTFast), its linear colour
 *     ProjectSettings/*                space and editor version, so a re-handoff leaves them as the developer left them
 *   writeHandoffUnity(handoff, outDir, { title? }) → { written, kept }: the files on disk, `keep` files only where missing
 *
 * In the project the importer builds mojulo's scene, Assets/Mojulo/Built/Level_Mojulo.unity, with its materials, arrays
 * and controller beside it in Built/ (inside Assets/Mojulo/, so a re-handoff clears them with the rest and the importer
 * builds them again), and the developer's scene Assets/Scenes/Level.unity once, which loads mojulo's in (MojuloStream, by
 * its name; the editor opens it beside): whatever the developer adds to Level.unity stays. The pipeline asset
 * (Assets/Settings/) is made once if the project has none, and the tone's pass added to its renderer. Deterministic: the
 * same handoff, the same bytes. Unity's own files (Library/, Temp/, Logs/, UserSettings/) are its to write.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { dataUrlBytes, fileKey, heightMaterials, terrainLayers, seaOf, handoffJson, sortedFiles, packSource, writePack } from './handoff-common.js';

export const HANDOFF_UNITY_VERSION = 'handoff-unity/0';
/** Where mojulo writes and the importer builds in the project. */
export const HANDOFF_UNITY_PATHS = Object.freeze({ root: 'Assets/Mojulo', scene: 'Assets/Mojulo/Built/Level_Mojulo.unity', level: 'Assets/Scenes/Level.unity', settings: 'Assets/Settings' });
/** The Unity the adapter is built and measured against. */
export const HANDOFF_UNITY_TARGET = 'Unity 6 with URP (measured on 6000.2.13f1, URP 17.2.0, glTFast 6.20.0)';
export const HANDOFF_UNITY_EDITOR = '6000.2.13f1';
/** The developer's packages: URP (the editor's own, 17.2 for 6000.2) and glTFast, pinned to the version measured. */
export const HANDOFF_UNITY_PACKAGES = Object.freeze({
  'com.unity.cloud.gltfast': '6.20.0',
  'com.unity.render-pipelines.universal': '17.2.0',
  'com.unity.modules.animation': '1.0.0',
  'com.unity.modules.imageconversion': '1.0.0',
  'com.unity.modules.jsonserialize': '1.0.0',
  'com.unity.modules.physics': '1.0.0',
  'com.unity.modules.unitywebrequest': '1.0.0',
  'com.unity.modules.unitywebrequesttexture': '1.0.0',
});

// (the adapter's C# and shaders, beside this file: handoff-unity/, its shaders' shared fragments from handoff-hlsl/)
const src = (name) => packSource('handoff-unity', name);
/** Each source of handoff-unity/ and where it lands under Assets/Mojulo/. */
export const HANDOFF_UNITY_SOURCES = Object.freeze({
  'MojuloImport.cs': 'Editor/MojuloImport.cs',
  'MojuloJson.cs': 'Editor/MojuloJson.cs',
  'MojuloProbe.cs': 'Editor/MojuloProbe.cs',
  'MojuloLevel.cs': 'Runtime/MojuloLevel.cs',
  'MojuloMarker.cs': 'Runtime/MojuloMarker.cs',
  'MojuloStream.cs': 'Runtime/MojuloStream.cs',
  'MojuloLighting.hlsl': 'Shaders/MojuloLighting.hlsl',
  'MojuloLit.shader': 'Shaders/MojuloLit.shader',
  'MojuloTerrain.hlsl': 'Shaders/MojuloTerrain.hlsl',
  'MojuloTerrain.shader': 'Shaders/MojuloTerrain.shader',
  'MojuloSea.shader': 'Shaders/MojuloSea.shader',
  'MojuloSky.shader': 'Shaders/MojuloSky.shader',
  'MojuloTone.shader': 'Shaders/MojuloTone.shader',
});

/** A file's GUID in the project: from its path alone, so a re-handoff keeps every reference to it. */
export const unityGuid = (assetPath) => createHash('sha256').update(`mojulo-unity-handoff:${assetPath}`).digest('hex').slice(0, 32);
/** The least .meta Unity reads: its GUID (Unity fills the importer's defaults in, keeping the GUID). */
export const unityMeta = (assetPath, { folder = false } = {}) => `fileFormatVersion: 2\nguid: ${unityGuid(assetPath)}\n${folder ? 'folderAsset: yes\n' : ''}`;

// a material asset on one of mojulo's shaders (its properties the shader's defaults; the importer sets the level's)
const materialAsset = (name, shaderPath) => `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!21 &2100000
Material:
  serializedVersion: 8
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_Name: ${name}
  m_Shader: {fileID: 4800000, guid: ${unityGuid(shaderPath)}, type: 3}
  m_ValidKeywords: []
  m_InvalidKeywords: []
  m_LightmapFlags: 4
  m_EnableInstancingVariants: 0
  m_DoubleSidedGI: 0
  m_CustomRenderQueue: -1
  stringTagMap: {}
  disabledShaderPasses: []
  m_LockedProperties:
  m_SavedProperties:
    serializedVersion: 3
    m_TexEnvs: []
    m_Ints: []
    m_Floats: []
    m_Colors: []
  m_BuildTextureStacks: []
  m_AllowLocking: 1
`;

const manifestJson = () => `${JSON.stringify({ dependencies: { ...HANDOFF_UNITY_PACKAGES } }, null, 2)}\n`;
const projectVersion = () => `m_EditorVersion: ${HANDOFF_UNITY_EDITOR}\n`;
// (the player settings Unity fills from defaults: the product's name and the linear colour space the page renders in)
const projectSettings = (title) => `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!129 &1
PlayerSettings:
  m_ObjectHideFlags: 0
  serializedVersion: 28
  companyName: mojulo
  productName: ${JSON.stringify(String(title))}
  m_ActiveColorSpace: 1
`;

export function handoffUnityFiles(h, { title = null } = {}) {
  const data = new Map(), R = HANDOFF_UNITY_PATHS.root, at = (f) => `${R}/${f}`;
  // each material's height map (handoff-common.js heightMaterials), under Data~/textures/
  const materials = heightMaterials(h, (name, url) => { const f = `Data~/textures/${fileKey(name)}.png`; if (!data.has(f)) data.set(f, dataUrlBytes(url)); return f; });
  // the layered ground: each layer of its atlases its own image, stacked by the importer into a Texture2DArray (a layer a
  // slice, as the page's arrays), the rest as written (handoff-common.js terrainLayers); the sea's depth map as written
  const T = terrainLayers(h, 'Data~/terrain'), S = seaOf(h);
  const terrain = T ? { ...T.terrain, shader: 'Mojulo/Terrain' } : null;
  const sea = S ? { part: S.part, read: S.read, image: 'Data~/terrain/sea_depth.png', shader: 'Mojulo/Sea' } : null;
  const files = [];
  // (an asset and its .meta; a folder's .meta beside it)
  const asset = (f, d) => { files.push({ file: at(f), data: d }, { file: `${at(f)}.meta`, data: unityMeta(at(f)) }); };
  files.push({ file: `${R}.meta`, data: unityMeta(R, { folder: true }) });
  asset('level.glb', Buffer.from(h.exported.bytes));
  asset('handoff.json', handoffJson(h, HANDOFF_UNITY_VERSION, { head: { title: title ?? h.level?.title ?? null, paths: HANDOFF_UNITY_PATHS }, materials, terrain, sea }));
  files.push(...sortedFiles(data, at));
  for (const f of [...(T?.files ?? []), ...(S ? [{ file: 'Data~/terrain/sea_depth.png', data: S.depth }] : [])]) files.push({ file: at(f.file), data: f.data });
  for (const dir of ['Editor', 'Runtime', 'Shaders']) files.push({ file: `${at(dir)}.meta`, data: unityMeta(at(dir), { folder: true }) });
  for (const [name, dest] of Object.entries(HANDOFF_UNITY_SOURCES)) asset(dest, src(name));
  asset('Shaders/MojuloSky.mat', materialAsset('MojuloSky', at('Shaders/MojuloSky.shader')));
  asset('Shaders/MojuloTone.mat', materialAsset('MojuloTone', at('Shaders/MojuloTone.shader')));
  files.push({ file: 'Packages/manifest.json', data: manifestJson(), keep: true });
  files.push({ file: 'ProjectSettings/ProjectVersion.txt', data: projectVersion(), keep: true });
  files.push({ file: 'ProjectSettings/ProjectSettings.asset', data: projectSettings(title ?? h.level?.title ?? 'mojulo handoff'), keep: true });
  return files;
}

export async function writeHandoffUnity(h, outDir, opts = {}) {
  // (Assets/Mojulo/ is mojulo's: cleared and written whole, so nothing a previous handoff wrote or built is left over)
  return writePack(handoffUnityFiles(h, opts), outDir, HANDOFF_UNITY_PATHS.root);
}

/** The batchmode commands for a pack at `dir` (`bin` the Unity editor binary). */
export function handoffUnityCommands(dir, bin = '<Unity>') {
  const q = (s) => `'${s}'`, b = bin === '<Unity>' ? bin : q(bin), proj = q(dir), log = (n) => q(path.join(dir, 'Logs', `mojulo-${n}.log`));
  const run = (method, n) => `${b} -batchmode -projectPath ${proj} -executeMethod ${method} -quit -logFile ${log(n)}`;
  return {
    import: run('Mojulo.Handoff.Import.Run', 'import'),
    probe: run('Mojulo.Handoff.Probe.Run', 'probe'),
    open: `${b} -projectPath ${proj}`,
    render: `MOJULO_SHOTS=<shots.json> ${run('Mojulo.Handoff.Probe.Render', 'render')}`,
  };
}
