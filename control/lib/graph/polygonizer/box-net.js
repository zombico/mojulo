/**
 * box-net — surface-agnostic sticker-net substrate.
 *
 * Generalizes the vehicle face-net embed (embedFaceOntoBox) to ANY surface
 * quad: given four world corners (CCW, a=(0,0) b=(1,0) c=(1,1) d=(0,1)) and a
 * camera projector, `embedSurfaceQuad` returns a (u,v) → screen map that
 * bilerps within the quad and projects. Furniture box faces, room walls, and
 * vehicle box faces all reduce to this one map.
 *
 * A bilinear quad reproduces every vehicle face-kind exactly — each face-kind
 * is multilinear in (u,v) — so embedFaceOntoBox delegates here without changing
 * any vehicle output. This is the shared primitive the furniture box-net and
 * the room-surface stickers build on (see box-net-sticker.plan.md).
 */

/** Bilinear interpolation of a point within a world quad. */
export function bilerp4(corners, u, v) {
  const [a, b, c, d] = corners; // a=(0,0) b=(1,0) c=(1,1) d=(0,1)
  return [
    a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + c[0] * u * v + d[0] * (1 - u) * v,
    a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + c[1] * u * v + d[1] * (1 - u) * v,
    a[2] * (1 - u) * (1 - v) + b[2] * u * (1 - v) + c[2] * u * v + d[2] * (1 - u) * v,
  ];
}

function dist3(a, b) {
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0), (a[2] || 0) - (b[2] || 0));
}

/**
 * Embed a flat (u,v) frame onto a world quad and project to screen.
 *
 * @param {number[][]} corners  four 3D world corners, CCW from (0,0).
 * @param {(p:number[])=>{x:number,y:number}} projectPoint  scene camera.
 * @param {{uLen?:number, vLen?:number}} [opts]  explicit world extents of the
 *   u / v axes (else derived from edge lengths) — lets callers keep discs round.
 * @returns {(u:number,v:number)=>{x:number,y:number}} embed, with .corners /
 *   .uLen / .vLen attached.
 */
export function embedSurfaceQuad(corners, projectPoint, { uLen, vLen } = {}) {
  const embed = (u, v) => projectPoint(bilerp4(corners, u, v));
  embed.corners = corners;
  embed.uLen = Number.isFinite(uLen) ? uLen : dist3(corners[0], corners[1]);
  embed.vLen = Number.isFinite(vLen) ? vLen : dist3(corners[0], corners[3]);
  return embed;
}

// Camera-facing front semicircle of an upright cylinder, as an angular range.
// The visible 180° is centered on the bearing from the cylinder to the camera.
function visibleArc(center, cameraPosition) {
  if (!cameraPosition) return [0, Math.PI * 2];
  const c = Math.atan2(cameraPosition[1] - center[1], cameraPosition[0] - center[0]);
  return [c - Math.PI / 2, c + Math.PI / 2];
}

/**
 * Tessellate the visible arc of an upright (z-axis) cylinder into projected
 * segment quads — the curved twin of embedSurfaceQuad. A flat quad across an
 * arc is a chord; this walks the arc so the silhouette curves and each segment
 * carries its own outward normal for cylindrical shading. Back faces are culled
 * by only sweeping the camera-facing semicircle (or pass an explicit theta range
 * for a partial wrap). v runs bottom→top over `height`.
 *
 * @returns {Array<{corners:{x,y}[], normal:number[], theta:number}>} far→near
 *   isn't sorted here; each segment's `theta`/screen corners let the caller sort
 *   and shade. `corners` are screen points [bl, br, tr, tl].
 */
export function cylinderSurfaceSegments({
  center, radius, height, z0 = 0, project, cameraPosition,
  segments = 14, vRange = [0, 1], thetaRange,
}) {
  const [t0, t1] = thetaRange || visibleArc([center[0], center[1]], cameraPosition);
  const [v0, v1] = vRange;
  const point = (theta, v) => project([
    center[0] + radius * Math.cos(theta),
    center[1] + radius * Math.sin(theta),
    z0 + v * height,
  ]);
  const out = [];
  const n = Math.max(1, Math.floor(segments));
  for (let i = 0; i < n; i += 1) {
    const a = t0 + (t1 - t0) * (i / n);
    const b = t0 + (t1 - t0) * ((i + 1) / n);
    const mid = (a + b) / 2;
    out.push({
      corners: [point(a, v0), point(b, v0), point(b, v1), point(a, v1)],
      normal: [Math.cos(mid), Math.sin(mid), 0],
      theta: mid,
    });
  }
  return out;
}
