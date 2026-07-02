/**
 * effects-occluder — the SOLID side of the effects layer (effects-layer.plan.md, P2).
 *
 * P1 proved a SCENE-SDF occluder clips volumetric fog against a union of boxes, but P1 hardcoded
 * the boxes into GLSL and evaluated ALL of them at every march step — O(N) per sample, which does
 * not scale to a real `fractal-city`. P2 is the acceleration index that makes the general SDF
 * affordable: bake the box set + a coarse uniform grid into data textures, and the SDF only tests
 * the boxes in the ray-point's grid cell.
 *
 * Two halves:
 *   • bakeBoxField(boxes, opts)  — JS. Packs boxes + an XZ uniform-grid cell→box-index table into
 *                                  Float32 RGBA textures (data + grid metadata).
 *   • boxFieldGLSL(opts)         — GLSL. Defines `float sdfScene(vec3)` / `vec3 sceneNormal(vec3)` /
 *                                  `vec3 ground(vec3,vec3)` that decode those textures and traverse
 *                                  the grid, with conservative cell-bounded stepping so a sphere
 *                                  tracer never overshoots a box listed in a neighbouring cell.
 *
 * Coordinate frame is the raymarch render frame: Y is up, the ground plane is y = 0, towers extrude
 * in +Y. The grid is 2D over XZ (towns are extrusions); a box is listed in every cell its XZ
 * footprint overlaps. (A fractal-city box is z-up {x,y,w,d,z1} — convert with boxFromFootprint.)
 *
 * Box shape consumed here: { cx, cy, cz, hx, hy, hz } — center + half-extents.
 */

/** Convert a fractal-city footprint box (native z-up: x,y ground, z1 height) to the center form
 *  this module consumes. Footprint rect [x, x+w] × [y, y+d], height z0..z1.
 *  up='z' keeps the native frame (height → cz); up='y' swaps height into +Y for the raymarch frame. */
export function boxFromFootprint({ x, y, w, d, z0 = 0, z1 }, { up = 'y' } = {}) {
  if (up === 'z') {
    return { cx: x + w / 2, cy: y + d / 2, cz: (z0 + z1) / 2, hx: w / 2, hy: d / 2, hz: (z1 - z0) / 2 };
  }
  return { cx: x + w / 2, cz: y + d / 2, cy: (z0 + z1) / 2, hx: w / 2, hz: d / 2, hy: (z1 - z0) / 2 };
}

/**
 * Bake a box set into the data textures + grid metadata the occluder GLSL reads.
 * @param {Array<{cx,cy,cz,hx,hy,hz}>} boxes
 * @param {object} [opts]
 * @param {number} [opts.cell=4]    grid cell size (world units) over the XZ plane
 * @param {number} [opts.margin=2]  padding added around the box AABB before gridding
 * @param {number} [opts.K=8]       max boxes listed per cell (overflow is dropped + counted)
 * @param {'y'|'z'} [opts.up='y']    which axis is vertical — the grid spans the OTHER two. 'y' for the
 *   raymarch render frame (ground = XZ); 'z' for the World mesh frame (ground = XY, fractal-city native).
 * @returns {{ boxData, cellData, grid, count, overflow }}
 *   boxData/cellData: { data:number[], width, height } ready for a Float32 RGBA DataTexture.
 *   grid: { ox, oz, cell, cols, rows, tpc, K, up }. (ox/oz are the two GROUND-axis origins.)
 *   overflow: # of (box,cell) writes dropped past K.
 */
export function bakeBoxField(boxes, { cell = 4, margin = 2, K = 8, up = 'y' } = {}) {
  const N = boxes.length;
  if (!N) throw new Error('bakeBoxField: need at least one box');

  // ground axes (centre, half) — everything but the up axis. A is always x; B is z (y-up) or y (z-up).
  const A = ['cx', 'hx'], B = up === 'z' ? ['cy', 'hy'] : ['cz', 'hz'];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b[A[0]] - b[A[1]]); maxX = Math.max(maxX, b[A[0]] + b[A[1]]);
    minZ = Math.min(minZ, b[B[0]] - b[B[1]]); maxZ = Math.max(maxZ, b[B[0]] + b[B[1]]);
  }
  const ox = minX - margin, oz = minZ - margin;
  const cols = Math.max(1, Math.ceil((maxX + margin - ox) / cell));
  const rows = Math.max(1, Math.ceil((maxZ + margin - oz) / cell));

  // box data texture: width 2, height N — texel(0,i)=(cx,cy,cz,hx), texel(1,i)=(hy,hz,0,0)
  const boxData = new Float32Array(2 * N * 4);
  boxes.forEach((b, i) => {
    const o = i * 8;
    boxData[o] = b.cx; boxData[o + 1] = b.cy; boxData[o + 2] = b.cz; boxData[o + 3] = b.hx;
    boxData[o + 4] = b.hy; boxData[o + 5] = b.hz;
  });

  // cell table: cols×rows cells, K index slots each, packed 4 per RGBA texel. -1 = empty slot.
  const tpc = Math.ceil(K / 4);
  const cellW = cols * tpc, cellH = rows;
  const cellData = new Float32Array(cellW * cellH * 4).fill(-1);
  const counts = new Int32Array(cols * rows);
  let overflow = 0;
  for (let i = 0; i < N; i++) {
    const b = boxes[i];
    const c0 = Math.max(0, Math.floor((b[A[0]] - b[A[1]] - ox) / cell));
    const c1 = Math.min(cols - 1, Math.floor((b[A[0]] + b[A[1]] - ox) / cell));
    const r0 = Math.max(0, Math.floor((b[B[0]] - b[B[1]] - oz) / cell));
    const r1 = Math.min(rows - 1, Math.floor((b[B[0]] + b[B[1]] - oz) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ci = r * cols + c;
        const k = counts[ci];
        if (k >= K) { overflow++; continue; }
        counts[ci] = k + 1;
        const texelCol = c * tpc + Math.floor(k / 4);
        const comp = k % 4;
        cellData[(r * cellW + texelCol) * 4 + comp] = i;
      }
    }
  }

  return {
    boxData: { data: Array.from(boxData), width: 2, height: N },
    cellData: { data: Array.from(cellData), width: cellW, height: cellH },
    grid: { ox, oz, cell, cols, rows, tpc, K, up },
    count: N,
    overflow,
  };
}

/**
 * GLSL for the occluder: decode the baked textures + traverse the grid. Requires SDF_GLSL (for
 * `sdfBox`) to be concatenated BEFORE this. Defines, for buildVolumeFrag's occluder seam:
 *   float sdfScene(vec3 p)      — ground plane (y=0) unioned with the grid-culled box field
 *   vec3  sceneNormal(vec3 p)   — central-difference normal of sdfScene
 *   vec3  ground(vec3 p, vec3)  — shades a solid hit so the town is visible behind/through the fog
 * plus the uniform declarations it reads. Pass `occluder: { sdfFn: 'sdfScene', groundFn: 'ground' }`.
 * @param {object} [opts]
 * @param {number} [opts.K=8]  must match bakeBoxField's K (controls the per-cell unroll).
 * @param {number} [opts.wallFloor=0.12]  floor for the conservative cell-boundary step clamp. MUST
 *   exceed the consumer's occluder `surfEps`, else a step-limit at a cell wall is misread as a
 *   surface hit (phantom walls on every grid line). Keep occluder surfEps < this.
 * @param {'y'|'z'} [opts.up='y']  vertical axis — must match bakeBoxField's `up` (grid spans the other two).
 * @returns {string}
 */
export function boxFieldGLSL({ K = 8, wallFloor = 0.12, up = 'y' } = {}) {
  const tpc = Math.ceil(K / 4);
  const A = 'x', B = up === 'z' ? 'y' : 'z', U = up;        // ground axes A,B; vertical U
  const upVec = up === 'z' ? 'vec3(0.40, 0.35, 0.82)' : 'vec3(0.45, 0.82, 0.35)';
  return `
uniform sampler2D uBoxTex;     // box data: width 2, height uBoxCount
uniform sampler2D uCellTex;    // cell table: cols*tpc wide, rows tall
uniform float uBoxCount;
uniform vec3 uGridO;           // (ox, oz, cell)
uniform vec3 uGridN;           // (cols, rows, tpc)

vec4 efTexel(sampler2D t, float col, float row, float W, float H){
  return texture2D(t, vec2((col + 0.5) / W, (row + 0.5) / H));
}
void efBox(float i, out vec3 c, out vec3 h){
  vec4 a = efTexel(uBoxTex, 0.0, i, 2.0, uBoxCount);
  vec4 b = efTexel(uBoxTex, 1.0, i, 2.0, uBoxCount);
  c = a.xyz; h = vec3(a.w, b.x, b.y);
}
// box field at p, using ONLY the boxes listed in p's ground cell — clamped to the cell boundary so a
// sphere tracer re-samples before crossing into a region governed by another cell's boxes.
float efBoxField(vec3 p){
  float cols = uGridN.x, rows = uGridN.y;
  float ox = uGridO.x, oz = uGridO.y, cell = uGridO.z;
  float gx1 = ox + cols * cell, gz1 = oz + rows * cell;
  float ci = floor((p.${A} - ox) / cell), ri = floor((p.${B} - oz) / cell);
  if (ci < 0.0 || ci >= cols || ri < 0.0 || ri >= rows){
    // outside the grid: leap to its ground rectangle, never returning 0
    vec2 q = vec2(max(max(ox - p.${A}, p.${A} - gx1), 0.0), max(max(oz - p.${B}, p.${B} - gz1), 0.0));
    return max(length(q), 0.5);
  }
  float xmin = ox + ci * cell, zmin = oz + ri * cell;
  float wall = min(min(p.${A} - xmin, (xmin + cell) - p.${A}), min(p.${B} - zmin, (zmin + cell) - p.${B}));
  float d = 1e9;
  float cellW = cols * ${tpc}.0;
  for (int t = 0; t < ${tpc}; t++){
    vec4 idx = efTexel(uCellTex, ci * ${tpc}.0 + float(t), ri, cellW, rows);
    vec3 c, h;
    if (idx.x >= 0.0){ efBox(idx.x, c, h); d = min(d, sdfBox(p - c, h)); }
    if (idx.y >= 0.0){ efBox(idx.y, c, h); d = min(d, sdfBox(p - c, h)); }
    if (idx.z >= 0.0){ efBox(idx.z, c, h); d = min(d, sdfBox(p - c, h)); }
    if (idx.w >= 0.0){ efBox(idx.w, c, h); d = min(d, sdfBox(p - c, h)); }
  }
  return min(d, max(wall, ${wallFloor.toFixed(4)}));   // conservative step clamp (floored above surfEps)
}
float sdfScene(vec3 p){ return min(p.${U}, efBoxField(p)); }   // ground plane (up=0) unioned with the boxes
vec3 sceneNormal(vec3 p){
  vec2 e = vec2(0.02, 0.0);
  return normalize(vec3(
    sdfScene(p + e.xyy) - sdfScene(p - e.xyy),
    sdfScene(p + e.yxy) - sdfScene(p - e.yxy),
    sdfScene(p + e.yyx) - sdfScene(p - e.yyx)));
}
vec3 ground(vec3 p, vec3 rd){
  vec3 n = sceneNormal(p);
  vec3 L = normalize(${upVec});
  float diff = clamp(dot(n, L), 0.0, 1.0);
  bool isGround = p.${U} < 0.12;
  vec3 base = isGround ? vec3(0.13, 0.14, 0.17) : vec3(0.34, 0.36, 0.42);
  if (!isGround) base *= 0.82 + 0.18 * sin(p.${U} * 2.5 + 0.5);   // facade banding → reads as built
  return base * (0.28 + 0.85 * diff);
}
`;
}
