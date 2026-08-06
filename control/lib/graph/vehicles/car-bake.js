import { faceListToMesh } from '../figures/face-mesh.js';
import { b64f32, b64u8 } from '../figures/rig-bake.js';
import { vehicleAntFaces, vehicleFaces } from './vehicles-css3d.js';

// Bake a vehicle into a compact rigid mesh ({ pos, col }) for the animated `cars` channel. Build the
// car at the CANONICAL pose (origin, heading 0 → facing +x), mesh it, and centre it in XY so the
// channel can rotate it about its own centre before placing it on a lane. Z is kept as authored
// (wheels stay on the ground). Colours are 0..1 → normalized uint8 (÷255 on the GPU), same packing
// as the rig parts. Pass `rng` to sample a random street vehicle (type + paint + hull) for variety;
// pass an explicit `type` for a fixed vehicle.
export function bakeCarMesh({ type = 'sedan', scale = 1, rng } = {}) {
  const faces = rng
    ? vehicleAntFaces({ rng, context: 'street', cx: 0, cy: 0, heading: 0, scale })
    : vehicleFaces({ type, cx: 0, cy: 0, heading: 0, scale });
  const gm = faceListToMesh(faces, { decollide: true });
  const pos = gm.positions;
  // centre X and Y on the bounding box (rotate about the car centre); keep Z (wheels on the road).
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i] < mnx) mnx = pos[i]; if (pos[i] > mxx) mxx = pos[i];
    if (pos[i + 1] < mny) mny = pos[i + 1]; if (pos[i + 1] > mxy) mxy = pos[i + 1];
  }
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
  const centred = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) { centred[i] = pos[i] - cx; centred[i + 1] = pos[i + 1] - cy; centred[i + 2] = pos[i + 2]; }
  return { pos: b64f32(centred), col: b64u8(gm.colors) };
}
