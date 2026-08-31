/**
 * scene-stl — export a baked face list as a binary STL.
 *
 * A THIRD consumer of the `{ faces, repeats }` payload `emitThreeWorld`
 * (scene-three.js) renders and `facesToGlb` (scene-gltf.js) packs — but where
 * the .glb is a faithful capture of the depiction (vertex colours, named group
 * nodes, textures), STL is the 3D-printing handoff: an unordered soup of bare
 * triangles with per-face normals and NOTHING else. Slicers (PrusaSlicer, Cura,
 * Bambu) ingest it directly; colour, grouping, and materials are deliberately
 * lost — the printer's loaded filament is the colour.
 *
 * Print-oriented trades vs the .glb (each drops non-solid embellishment):
 *  - water, shadow/ink decals, surface cards, and studio furniture (`studio:
 *    true` faces — the workbench measuring grid) are OMITTED — zero-thickness
 *    translucent sheets, floating facade flakes, and scale-cue props are
 *    poison for slicers.
 *  - instanced repeats are EXPANDED: every transform bakes into real triangles
 *    (STL has no instancing), so a 500-tree block is 500 trees of geometry.
 *  - no z-fight de-collision — coincident faces don't flicker in a slicer, and
 *    keeping vertices un-staggered helps its mesh-repair union coplanar shells.
 *  - the frame stays z-up: slicers assume z-up, which IS mojulo's native frame
 *    (unlike the .glb's y-up root rotation). `scale` maps world units → mm.
 *
 * The output is honest triangle soup, not a guaranteed-manifold solid — open
 * shells and intersecting parts survive; modern slicers repair them on import.
 *
 * No three.js import — pure Buffer assembly, unit-testable in node.
 */

import { faceListToMesh } from '../figures/face-mesh.js';

// Binary STL: 80-byte header + uint32 triangle count + 50 bytes per triangle
// (normal 3×f32, three vertices 9×f32, uint16 attribute byte count = 0).
const HEADER_BYTES = 80;
const TRI_BYTES = 50;

// A face that belongs in the print: not a water sheet, not a ground decal, and
// not studio furniture (the workbench's measuring grid + floor plate carry
// `studio: true` — they are the scale cue for /world and the GLB, never part of
// the object). Exported so export_model's closure audit sees the same set.
export function isPrintableFace(f) {
  return !!f && !f.water && f.decal !== 'shadow' && f.decal !== 'ink' && !f.studio;
}

// Collect every printable triangle from a face list into a flat position soup.
// Textured faces contribute their geometry too (a label-wrapped table top is a
// real surface); water, ground decals, and studio furniture do not.
function solidPositions(faces) {
  const printable = (Array.isArray(faces) ? faces : []).filter(isPrintableFace);
  const gm = faceListToMesh(printable, { decollide: false });
  const parts = [gm.positions];
  for (const grp of Object.values(gm.textureGroups || {})) parts.push(grp.positions);
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Bake one repeat transform ({ pos, rotZ, scale }) into a template vertex —
// scale, then rotate about +Z, then translate: the same TRS `addInstancedNodes`
// (scene-gltf.js) and emitThreeWorld's InstancedMesh apply as thin nodes.
function applyTransform(t, x, y, z) {
  const s = Number.isFinite(t.scale) ? t.scale : 1;
  let px = x * s, py = y * s;
  const pz = z * s;
  const rz = t.rotZ || 0;
  if (rz) {
    const c = Math.cos(rz), sn = Math.sin(rz);
    const rx = px * c - py * sn;
    py = px * sn + py * c;
    px = rx;
  }
  const p = Array.isArray(t.pos) ? t.pos : null;
  return [px + (p ? p[0] : 0), py + (p ? p[1] : 0), pz + (p ? p[2] : 0)];
}

/**
 * facesToStl(payload, { scale, generator }) → { bytes, byteLength, triangleCount,
 * vertexCount, bounds: { min, max, size } } or null when the payload carries no
 * printable geometry.
 *
 * `payload` is the same object `emitThreeWorld` consumes: `{ faces, repeats? }`.
 * `scale` multiplies every coordinate — slicers read STL units as millimetres,
 * so it is the world-units → mm dial (default 1). `bounds` is post-scale (the
 * printed extent), computed in the same pass — export_model's fit-to-size
 * measuring probe and size readout both ride it.
 */
export function facesToStl(payload = {}, { scale = 1, generator = 'mojulo scene-stl' } = {}) {
  const { faces = [], repeats = [] } = payload || {};
  const repeatList = (Array.isArray(repeats) ? repeats : []).filter((r) => r && Array.isArray(r.template) && r.template.length && Array.isArray(r.transforms) && r.transforms.length);
  if ((!Array.isArray(faces) || !faces.length) && !repeatList.length) return null;

  // One soup: base faces + every repeat instance expanded to real triangles.
  const soups = [solidPositions(faces)];
  for (const r of repeatList) {
    const tpl = solidPositions(r.template);
    if (!tpl.length) continue;
    for (const t of r.transforms) {
      const inst = new Float32Array(tpl.length);
      for (let i = 0; i < tpl.length; i += 3) {
        const [x, y, z] = applyTransform(t, tpl[i], tpl[i + 1], tpl[i + 2]);
        inst[i] = x; inst[i + 1] = y; inst[i + 2] = z;
      }
      soups.push(inst);
    }
  }

  // Filter to non-degenerate triangles, computing each face normal (right-hand
  // rule over the vertex winding — matches the faces' outward CCW convention),
  // and track the printed bounding box in the same pass.
  const tris = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const grow = (x, y, z) => {
    if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
    if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
    if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
  };
  for (const soup of soups) {
    for (let i = 0; i + 9 <= soup.length; i += 9) {
      const ax = soup[i] * scale, ay = soup[i + 1] * scale, az = soup[i + 2] * scale;
      const bx = soup[i + 3] * scale, by = soup[i + 4] * scale, bz = soup[i + 5] * scale;
      const cx = soup[i + 6] * scale, cy = soup[i + 7] * scale, cz = soup[i + 8] * scale;
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (!(len > 0)) continue; // zero-area sliver — nothing to print
      nx /= len; ny /= len; nz /= len;
      grow(ax, ay, az); grow(bx, by, bz); grow(cx, cy, cz);
      tris.push(nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz);
    }
  }
  const triangleCount = tris.length / 12;
  if (!triangleCount) return null;
  const bounds = { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };

  const bytes = Buffer.alloc(HEADER_BYTES + 4 + triangleCount * TRI_BYTES);
  bytes.write(String(generator).slice(0, HEADER_BYTES), 0, 'utf8');
  bytes.writeUInt32LE(triangleCount, HEADER_BYTES);
  let o = HEADER_BYTES + 4;
  for (let i = 0; i < tris.length; i += 12) {
    for (let k = 0; k < 12; k++) o = bytes.writeFloatLE(tris[i + k], o);
    o = bytes.writeUInt16LE(0, o); // attribute byte count
  }

  return { bytes, byteLength: bytes.length, triangleCount, vertexCount: triangleCount * 3, bounds };
}
