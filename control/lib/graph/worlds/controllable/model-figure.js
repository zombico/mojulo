/**
 * A MODEL'S FIGURE: the packed rig a figures-map entry's `modelRef` stands on (gameworld/stage-figures.js modelFigure): the
 * latest rigged humanoid .glb bound onto that sketch (bind_mesh_render: scene/mesh-store.js), read into layer 0's pack by
 * scene/rig-import.js, stood `height` metres. worlds/world-scene.js heroFigure plays it as it plays a hero's pack (the
 * library's clips retargeted onto it), so the cuts, the shed, the states and the target rim take it as they take our own.
 *
 *   modelPack(name, ref, { height? })   → the pack (rig-import.js importRig's), its textures decoded (a JPEG through the
 *                                          optional sharp worker: absent, by its material's colour); throws naming the door
 *                                          when nothing is bound
 *
 * Read once per bound file and height (a bound slot is append-only, never edited: mesh-store.js).
 */
import { readFileSync } from 'node:fs';

const CACHE = new Map(), CACHE_MAX = 8;

export async function modelPack(name, ref, { height = null } = {}) {
  const { latestBoundMesh } = await import('@/lib/graph/scene/mesh-store.js');
  const slot = latestBoundMesh(ref);
  if (!slot) {
    // (the Claude plugin profile has no bind_mesh_render, lib/mcp/plugin-profile.js: it names no door)
    const { pluginProfileActive, pluginProfileNotice } = await import('@/lib/mcp/plugin-profile');
    throw new Error(pluginProfileActive()
      ? `figures.${name}: sketch '${ref}' has no model bound onto it. ${pluginProfileNotice('Binding a model made outside mojulo')}`
      : `figures.${name}: sketch '${ref}' has no model bound onto it: bind a rigged humanoid .glb first (bind_mesh_render { ref, glb_path })`);
  }
  const key = `${slot.path}|${height ?? ''}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const { importRig, decodeModelImages } = await import('@/lib/graph/scene/rig-import.js');
  const bytes = readFileSync(slot.path);
  let pack;
  try { pack = importRig(bytes, { height, images: (await decodeModelImages(bytes)).images }).pack; }
  catch (e) { throw new Error(`figures.${name}: the model bound onto '${ref}' cannot be worn: ${e.message.replace(/^rig-import: /, '')}`); }
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(key, pack);
  return pack;
}
