/**
 * face-mesh — pure adapter from the engine-agnostic baked face list
 * (the same `{ corners, fill, bg, doubleSided }` shape `emitPreserve3dScene`
 * consumes) into renderer-ready triangle data for the three.js World path.
 *
 * Deliberately has NO three.js import: it emits plain typed arrays so it stays
 * unit-testable in node and `emitThreeWorld` remains the only three-aware module.
 *
 * The lighting is ALREADY baked into each face's `fill` hex (Lambert + diffusion
 * + shadows, computed in scene-css3d). So the mesh carries colour per vertex and
 * the World renders it UNLIT (MeshBasicMaterial + vertexColors) — the baked look
 * is reproduced exactly from any camera, with no lighting setup downstream.
 *
 * Quads are emitted as non-indexed triangle soup (6 verts/face): flat per-face
 * colour is trivial, and at city scale (a few thousand faces) the vertex count is
 * a rounding error for the GPU.
 *
 * World coordinates are kept verbatim (z-up). The emitter sets camera.up = +Z so
 * the `worldFraming` cameraPosition/lookAt values flow through without remapping.
 */

const HEX_RE = /#([0-9a-f]{3}|[0-9a-f]{6})\b/i;

// sRGB channel (0..1) → linear. Vertex colours in a BufferAttribute are treated
// as linear by three; the renderer's sRGB output then re-encodes them, so the
// on-screen result matches the original hex.
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Resolve a face's representative colour as linear [r,g,b] in 0..1.
 * Prefers `fill` (baked Lambert hex); falls back to the first hex found in a CSS
 * `bg` gradient (facades / clouds are gradient-painted — we can only approximate
 * them with a single triangle colour, which is the documented World/Scene
 * material trade-off); else a neutral grey.
 */
export function faceColorLinear(face, fallback = [0.5, 0.5, 0.5]) {
  const src = (face && (face.fill || face.bg)) || '';
  const m = typeof src === 'string' ? src.match(HEX_RE) : null;
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

const TRIS = [[0, 1, 2], [0, 2, 3]]; // quad → two triangles

/**
 * faceListToMesh(faces) → { positions, colors, vertexCount, faceCount, center, radius }
 * positions/colors are Float32Array triangle soup ready for BufferGeometry.
 * center/radius bound the geometry for a camera-framing fallback when a world
 * ships no `worldFraming` camera.
 */
export function faceListToMesh(faces = []) {
  const positions = [];
  const colors = [];
  let cx = 0, cy = 0, cz = 0, n = 0;
  for (const f of faces) {
    const c = f && f.corners;
    if (!c || c.length < 4) continue;
    const [lr, lg, lb] = faceColorLinear(f);
    for (const tri of TRIS) {
      for (const idx of tri) {
        const p = c[idx];
        positions.push(p[0], p[1], p[2]);
        colors.push(lr, lg, lb);
      }
    }
    for (let i = 0; i < 4; i++) { cx += c[i][0]; cy += c[i][1]; cz += c[i][2]; n++; }
  }
  const center = n ? [cx / n, cy / n, cz / n] : [0, 0, 0];
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - center[0], dy = positions[i + 1] - center[1], dz = positions[i + 2] - center[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > radius) radius = d;
  }
  return {
    positions: Float32Array.from(positions),
    colors: Float32Array.from(colors),
    vertexCount: positions.length / 3,
    faceCount: faces.length,
    center,
    radius,
  };
}
