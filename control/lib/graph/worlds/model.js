/**
 * model — the `model` kind: a model made OUTSIDE mojulo, brought in by `mint_solid({ kind: 'model', spec: { from } })`
 * or `create_character({ from })` (lib/mcp/tools/import-model.js), on the measured studio every object kind rides.
 *
 * Its recipe is what the import DECIDED (where the file came from and its hash, its licence, its units, the axis it
 * stands on, its height, what it is, how it moves); the geometry is the file itself, made one canonical GLB at the door
 * (import/to-glb.js, rigged onto the vajra when it is a figure with no skeleton that reads: import/autorig.js) and kept
 * as the row's bound mesh (scene/mesh-store.js), the slot every reader of a bound mesh already reads: a world places
 * it with `figures.<n>.meshRef`, a game plays a character with `figures.<n>.modelRef`.
 *
 *   assembleModelScene(m, { ref, title, light, toon }) → the studio payload: the bound mesh's faces in metres (the
 *   slot's `scale_applied`: the file's unit into metres), turned and stood on the floor as the studio stands any object
 *
 * Stored manifest: { kind: 'model', units: 'm', import: { file, format, sha256, units, up, height?, class, rig, licence?,
 *   … }, facing?, grid?, viewBox?, title? }
 */
import { readFileSync } from 'node:fs';
import { studioSceneFromFaces, WORKBENCH_LIGHT } from './workbench.js';
import { withBands, resolveToon } from '../polygonizer/vexar.js';

// a skinned file is drawn at rest (its skin applied: import/autorig.js stripSkin), never in its bind space; read once per
// bound file (a slot is append-only, never edited)
const CACHE = new Map(), CACHE_MAX = 8;
async function restFaces(path, scale) {
  const { statSync } = await import('node:fs');
  const st = statSync(path), key = `${path}:${st.mtimeMs}:${st.size}`;
  let faces = CACHE.get(key);
  if (!faces) {
    const { parseGlb, glbToScene } = await import('../scene/scene-gltf-read.js');
    let bytes = readFileSync(path);
    if ((parseGlb(bytes).json.skins || []).length) bytes = (await import('../import/autorig.js')).stripSkin(bytes);
    faces = glbToScene(bytes, { group: 'model' });
    if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(key, faces);
  }
  return { textures: faces.textures, faces: scale === 1 ? faces.faces : faces.faces.map((f) => ({ ...f, corners: f.corners.map((c) => c.map((v) => v * scale)) })) };
}

export async function assembleModelScene(m = {}, { ref, title, light, toon } = {}) {
  const { latestBoundMesh } = await import('../scene/mesh-store.js');
  const slot = ref ? latestBoundMesh(ref) : null;
  if (!slot) throw new Error(`model '${ref}': no file is bound to it (a model row is made by mint_solid({ kind: 'model', spec: { from } }) or create_character({ from }), which bind the file as they mint)`);
  let scale = 1;
  try { const sc = JSON.parse(readFileSync(slot.sidecarPath, 'utf8')); if (Number.isFinite(sc.scale_applied) && sc.scale_applied > 0) scale = sc.scale_applied; } catch { /* no sidecar: the file's numbers are metres */ }
  const { faces, textures } = await restFaces(slot.path, scale);
  // stood on the floor at its own middle, as the studio stands every object
  let lo = Infinity, cx = 0, cy = 0, n = 0;
  for (const f of faces) for (const c of f.corners) { if (c[2] < lo) lo = c[2]; cx += c[0]; cy += c[1]; n++; }
  cx /= n || 1; cy /= n || 1;
  const stood = faces.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0] - cx, c[1] - cy, c[2] - lo]) }));
  const lit = withBands(light || WORKBENCH_LIGHT, resolveToon(toon)?.bands);
  const payload = studioSceneFromFaces(stood, { ...m, title: title || m.title || 'mojulo model', light: lit });
  // its albedo textures ride the payload's texture channel, as a bound mesh's do in a world (world-scene.js meshRef)
  if (textures && Object.keys(textures).length) payload.textures = { ...(payload.textures || {}), ...textures };
  return payload;
}
