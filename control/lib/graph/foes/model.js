/**
 * A MODEL'S BODY: a foe skinned as a model made elsewhere (a rigged humanoid .glb bound onto a sketch: bind_mesh_render),
 * worn over layer 0 as any skin is (docs/foes.md). The class asks it as it asks a people (./fit.js): it answers on two legs,
 * without wings, at the height it is stood at.
 *
 *   readModelSkin(skin, at)   → { meshRef, height? } checked (throws teaching the words)
 *     meshRef  the sketch whose latest bound model it wears (worlds/world-scene.js reads it: scene/rig-import.js)
 *     height   the metres it stands (MODEL_HEIGHT absent): the model is scaled to it, so the body's numbers and its figure
 *              agree without reading the file
 *   modelBody(skin)           → the body ./fit.js measures, a people's shape: { support: 'two', wings: false, swimmer: false,
 *                               size, extent, height, scale: 1, gaits, model }
 *   isModelSkin(skin)         → the skin names a model
 *
 * Pure.
 */
import { classOfExtent } from '../fauna/size-class.js';

export const MODEL_HEIGHT = 1.8;
const KEYS = ['meshRef', 'height'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const isModelSkin = (skin) => isObj(skin) && skin.meshRef !== undefined;

export function readModelSkin(skin, at = 'foe: .skin') {
  if (!isObj(skin)) throw new Error(`${at} is { meshRef, height? }`);
  for (const k of Object.keys(skin)) if (!KEYS.includes(k)) throw new Error(`${at} has no key '${k}' beside meshRef (${KEYS.join(', ')})`);
  if (typeof skin.meshRef !== 'string' || !skin.meshRef) throw new Error(`${at}.meshRef is the sketch a rigged humanoid .glb is bound onto (bind_mesh_render)`);
  if (skin.height !== undefined && !(Number.isFinite(skin.height) && skin.height >= 0.3 && skin.height <= 12)) throw new Error(`${at}.height is the metres it stands, 0.3 … 12`);
  return { meshRef: skin.meshRef, ...(skin.height !== undefined ? { height: skin.height } : {}) };
}

export function modelBody(skin) {
  const S = readModelSkin(skin), h = S.height ?? MODEL_HEIGHT;
  return { support: 'two', wings: false, swimmer: false, size: classOfExtent(h, h), extent: h, height: h, scale: 1, gaits: ['walk', 'jog', 'run'], model: S.meshRef };
}
