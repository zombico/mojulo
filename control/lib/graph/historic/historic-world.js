/**
 * historic-world — a historic scene as a WebGL World page (three.js, orbit to rotate) or a GLB, instead of
 * the CSS 3D page. A whole town is tens of thousands of faces, and the CSS page stalls under that; the
 * World draws the same faces as one mesh. Same payload as the CSS page (./historic-city.js): its skins
 * already carry a `texture` key and uvs for the World (./ground.js), so only the texture map is added here,
 * and the layout's `horizon` (the land beyond the frame) is drawn.
 */
import { surfaceTexture } from '../landscape/surface-textures.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { assembleHistoricCityScene, assembleAssetSheetScene } from './historic-city.js';

/**
 * A polygon face (more than four corners: a sandbar, a ragged ground strip) as triangles. The World's mesh
 * takes triangles and quads only; the CSS page draws the polygon whole. Ear clipping in the plane the face
 * most faces, so a concave edge (the bluff's ragged top) stays inside its outline.
 */
export function triangulateFace(f) {
  const c = f.corners;
  if (!Array.isArray(c) || c.length <= 4 || f.texture) return [f];
  const U = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]];
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const k = [0, 1, 2].reduce((m, i) => (Math.abs(n[i]) > Math.abs(n[m]) ? i : m), 0), [i0, i1] = [[1, 2], [2, 0], [0, 1]][k], sgn = Math.sign(n[k]) || 1;
  const P = c.map((p) => [p[i0], p[i1]]), area2 = (a, b, q) => ((P[b][0] - P[a][0]) * (P[q][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[q][0] - P[a][0])) * sgn;
  const inside = (q, a, b, d) => area2(a, b, q) >= 0 && area2(b, d, q) >= 0 && area2(d, a, q) >= 0;
  const idx = c.map((_, i) => i), out = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 1000) {
    let cut = false;
    for (let j = 0; j < idx.length; j++) {
      const a = idx[(j + idx.length - 1) % idx.length], b = idx[j], d = idx[(j + 1) % idx.length];
      if (area2(a, b, d) <= 1e-12) continue;
      if (idx.some((q) => q !== a && q !== b && q !== d && inside(q, a, b, d))) continue;
      out.push([a, b, d]); idx.splice(j, 1); cut = true; break;
    }
    if (!cut) break;   // degenerate: fan the rest
  }
  for (let j = 1; j + 1 < idx.length; j++) out.push([idx[0], idx[j], idx[j + 1]]);
  return out.map((t) => ({ ...f, corners: t.map((i) => c[i]) }));
}

/** The scene with every texture its faces name resolved into `textures` (key → data URL), ready for the World. */
export function withWorldTextures(scene) {
  const textures = { ...(scene.textures || {}) };
  // the land beyond the frame joins the World's faces (the CSS page leaves it off); polygons go as triangles
  scene = { ...scene, faces: [...scene.faces, ...(scene.horizon || [])].flatMap(triangulateFace) };
  for (const f of scene.faces) {
    if (typeof f.texture === 'string' && !textures[f.texture]) { const url = surfaceTexture(f.texture); if (url) textures[f.texture] = url; }
  }
  return { ...scene, textures };
}

// cdn: three from the public CDN, so the page opens from a file or a plain static server
const world = (scene, title) => emitThreeWorld({ ...withWorldTextures(scene), title: title || scene.title, cdn: true });

/** The town as a rotatable World page; its named views are the page's camera buttons. */
export function renderHistoricCityToWorld(opts = {}) {
  return world(assembleHistoricCityScene(opts));
}

/** One asset on its base tile, as a rotatable World page. */
export function renderAssetSheetToWorld(opts = {}) {
  return world(assembleAssetSheetScene(opts));
}

/** The town as a GLB (glTF binary, z-up scene units, cameras as glTF cameras): for Blender, Godot, any viewer. */
export function historicCityToGlb(opts = {}) {
  return facesToGlb(withWorldTextures(assembleHistoricCityScene(opts)), { generator: 'mojulo historic' });
}
