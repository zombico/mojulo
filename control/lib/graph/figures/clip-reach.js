/**
 * clip-reach — where a held weapon goes while a swing can hit, measured off the swing's packed clip. A held swing
 * (worlds/world-kinds.js, the held strike) records its weapon's TIP on the bone it rides (`move.tip`: the bone and the tip's
 * rest point) and its contact window (`move.window`, a share of the clip). A bone's frame in a packed clip is its rotation
 * from rest and its head (station-loft-rig.js boneFrames), so the tip at a frame is the head plus the rest offset turned
 * by that rotation. Read across the window, the tip's path says how far ahead the blow reaches and how wide it sweeps:
 * the hit is fitted to the weapon, so it lands where the weapon passes and nowhere else.
 *
 *   clipReach(pack, clip, { tip?, window? })  → { reach, cone, low, high, path } or null: in the figure's own frame (z up,
 *                                               the face to +y, the right on +x) and units, from its feet's centre:
 *     reach   the farthest the tip gets ahead in the window, flat (m)
 *     cone    the widest it strays from straight ahead, degrees either side
 *     low, high  the tip's lowest and highest in the window (m over the feet)
 *     path    the tip at each frame in the window, [x, y, z]
 *
 * Pure and deterministic.
 */

const N = 7;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// a quaternion [x, y, z, w] turning a vector
function qrot(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

export function clipReach(pack, clip, { tip = null, window = null } = {}) {
  const C = typeof clip === 'string' ? pack?.clips?.[clip] : clip, B = pack?.bones;
  const T = tip ?? C?.move?.tip, W = window ?? C?.move?.window;
  if (!C || !Array.isArray(C.b) || !Array.isArray(B) || !T || !Array.isArray(T.at) || !Array.isArray(W)) return null;
  const i = B.findIndex((b) => b.id === T.bone);
  if (i < 0 || !(C.k > 1)) return null;
  const K = C.k, rest = B[i].head, off = [T.at[0] - rest[0], T.at[1] - rest[1], T.at[2] - rest[2]];
  const path = [];
  for (let k = 0; k < K; k++) {
    const u = C.once ? k / (K - 1) : k / K;
    if (u < W[0] - 1e-9 || u > W[1] + 1e-9) continue;
    const o = (k * B.length + i) * N, q = C.b.slice(o, o + 4), h = C.b.slice(o + 4, o + 7), d = qrot(q, off);
    path.push([h[0] + d[0], h[1] + d[1], h[2] + d[2]]);
  }
  // (a window narrower than a frame: the frame nearest its middle)
  if (!path.length) {
    const m = (W[0] + W[1]) / 2, k = Math.max(0, Math.min(K - 1, Math.round(C.once ? m * (K - 1) : m * K) % K));
    const o = (k * B.length + i) * N, q = C.b.slice(o, o + 4), h = C.b.slice(o + 4, o + 7), d = qrot(q, off);
    path.push([h[0] + d[0], h[1] + d[1], h[2] + d[2]]);
  }
  const ahead = path.filter((p) => p[1] > 0);
  const reach = Math.max(0, ...path.map((p) => (p[1] > 0 ? Math.hypot(p[0], p[1]) : 0)));
  const cone = ahead.length ? Math.max(...ahead.map((p) => Math.abs(Math.atan2(p[0], p[1])) * 180 / Math.PI)) : 0;
  return { reach: r4(reach), cone: r4(cone), low: r4(Math.min(...path.map((p) => p[2]))), high: r4(Math.max(...path.map((p) => p[2]))), path: path.map((p) => p.map(r4)) };
}
