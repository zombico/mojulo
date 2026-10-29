/**
 * unreal-pack.js — the Unreal ASSET pack: one of mojulo's things (a character, a creature, a prop, a building, a robot,
 * anything assembled) as Unreal takes it, shared by the two front doors so they cannot drift:
 * - export_model { ref, format: 'unreal' } (MCP: writes the pack; the gate note rides the result)
 * - scripts/export-unreal.mjs (CLI: writes the pack, then runs the advisory gate when an editor is found)
 *
 * Unreal takes mojulo's ASSETS, not its games or levels: what reaches it is the GLB's surface (geometry, vertex colour,
 * painted textures, a skinned figure's skeleton, clips and face morphs), and for an asset that surface is the thing; the
 * look mojulo draws on the web and a game's behaviour stay mojulo's. A game is refused with the move (its characters
 * and solids, each by its ref).
 *
 * A pack is DATA (model.glb, recipe/) plus the emitter's text (unreal-project.js: import_mojulo.py, IMPORT-GUIDE.md,
 * README.md). A rigged layered figure ships SKINNED (one mesh, its clips; Interchange makes a SkeletalMesh and an
 * AnimSequence per clip); a humanoid one ships as the engine skeleton by default (VRM-named joints at the T-pose rest,
 * the seam the importer's IK Rig and Retargeter map from; `humanoid: false` keeps the flat skeleton). Deterministic:
 * same rows → same pack bytes; the folder is wholly derived and clean-emitted on every build.
 */
import { emitUnrealAsset, UNREAL_LEG_VERSION } from './unreal-project.js';
import { loadSketch, packHash, resolveLevel, worldGlbStats, emitFolder, figureClip, figureClipNames, figureSkeleton } from './engines/pack.js';

/** Why a row does not go to Unreal, or null when it does: a game (and a pixelizer game, a 2D reducer) is not an asset. */
export function unrealRefusal(manifest = {}, ref = '?') {
  if (manifest.kind === 'game' || manifest.engine === 'pixelizer' || manifest.kind === 'pixelizer') {
    return `'${ref}' is a game: Unreal takes mojulo's assets, not its games or levels — export its characters and solids, `
      + "each by its own ref (export_model { ref, format: 'unreal' })";
  }
  return null;
}

/** An asset → its Unreal pack at outDir. `lit`: real PBR materials over the unshaded payload (Unreal lights it);
 * `humanoid`: a humanoid figure as the engine skeleton (default) or, false, on its flat skeleton. */
export async function buildUnrealAssetPack({ ref, outDir, clips = '_all', lit = false, humanoid = true, log = () => {} }) {
  const sketch = loadSketch(ref);
  const manifest = sketch.manifest ?? {};
  const refused = unrealRefusal(manifest, ref);
  if (refused) throw new Error(`refused: ${refused}`);
  const { kind, exported, fig, engine } = await resolveLevel(sketch, { engine: 'unreal', clips, lit, figure: true, humanoid });
  // the skinned figure: the clip the importer loops on it in the preview, and its skeleton
  const figure = fig ? (() => {
    const [name, f] = fig, clipNames = figureClipNames(clips, f);
    return { name, clip: figureClip(manifest.recipe?.clips, clipNames), clips: clipNames, ...figureSkeleton(f, engine) };
  })() : null;
  log(`resolved '${ref}' (kind ${kind}) — GLB ${exported.byteLength} bytes, ${exported.triangleCount} triangles${figure ? `, the figure '${figure.name}' skinned (${figure.joints} joints, loops ${figure.clip})` : ''}`);
  const manifestHash = packHash(manifest);
  const emitted = emitUnrealAsset({
    ref, kind: manifest.kind ?? kind, title: sketch.title ?? manifest.title ?? ref, manifestHash, lit, figure, ...(lit && fig?.[1]?.normalTex ? { relief: true } : {}),
    // (the clothes' depth map, cloth-relief.js: written beside the GLB for the importer to march the parallax with)
    ...(lit && fig?.[1]?.normalTex && fig[1].depthTex ? { parallax: { file: 'figure_depth.png', depth: fig[1].depthTex.depth, perM: fig[1].depthTex.perM } } : {}),
    remint: `node scripts/export-unreal.mjs --ref ${ref}${lit ? ' --lit' : ''}${humanoid ? '' : ' --no-humanoid'}`,
  });
  const { written } = await emitFolder({ outDir, files: [
    { rel: 'model.glb', data: exported.bytes },
    ...(lit && fig?.[1]?.normalTex && fig[1].depthTex ? [{ rel: 'figure_depth.png', data: Buffer.from(fig[1].depthTex.url.replace(/^data:image\/png;base64,/, ''), 'base64') }] : []),
    { rel: `recipe/${ref}.json`, data: JSON.stringify(manifest, null, 2) },
    ...emitted.files.map((f) => ({ rel: f.file, data: f.text })),
  ] });
  return {
    scope: 'asset', ref, kind: manifest.kind ?? kind, dir: outDir, manifestHash, legVersion: UNREAL_LEG_VERSION,
    glbStats: worldGlbStats(exported), written, ...(figure ? { figure } : {}),
  };
}
