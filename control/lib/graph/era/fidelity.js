/**
 * FIDELITY readout: how much detail the cast and the world each put on screen, from one camera, at the
 * era's frame. A machine metric that advises; it never refuses.
 *
 * A small z-buffer (no shading) rasterizes every triangle (double-sided, as the World draws them) at `frame` and keeps, per pixel,
 * the nearest triangle. From the visible pixels of each layer (`cast`, `world`) it reports:
 *   • pixels             screen share the layer holds
 *   • trianglesPerKpx    distinct visible triangles per 1000 pixels (geometric density)
 *   • verticesPerKpx     distinct visible vertices per 1000 pixels (vertex-colour samples)
 *   • texelsPerPixel     mean over textured pixels of tile texels per screen pixel along an axis (null when untextured)
 * and `ratio.triangles` / `ratio.vertices` = cast ÷ world. The texel axis is reported, not ratioed: the
 * hero is vertex-coloured, the world is tiled, and the two do not share a unit.
 *
 * `cast` and `world` are each a list of PARTS; a part is a world-frame (z-up, metres) face list
 * `[{ corners:[[x,y,z]…], uv?, texture? }…]` or a mesh `{ vertices:[[x,y,z]…], faces:[[i,j,k]…] }`.
 * `texturePx(key)` gives a tile's [w, h].
 * Deterministic: no dice, no clock.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A z-up look-at camera: world point → [screenX, screenY, viewDepth]. */
export function makeCamera({ eye, target, fovY = 55 }, { width, height }) {
  const f = norm(sub(target, eye));
  let r = cross(f, [0, 0, 1]);
  if (Math.hypot(...r) < 1e-9) r = [1, 0, 0];
  r = norm(r);
  const u = cross(r, f);
  const k = (height / 2) / Math.tan((fovY * Math.PI) / 360);
  return {
    view: (p) => { const d = sub(p, eye); return [dot(d, r), dot(d, u), dot(d, f)]; },
    project: (v) => [width / 2 + (v[0] * k) / v[2], height / 2 - (v[1] * k) / v[2], v[2]],
  };
}

const NEAR = 0.05;
// Sutherland–Hodgman against the near plane in view space; carries uv when present
function clipNear(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ina = a.v[2] >= NEAR, inb = b.v[2] >= NEAR;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (NEAR - a.v[2]) / (b.v[2] - a.v[2]);
      out.push({ v: a.v.map((x, j) => x + (b.v[j] - x) * t), uv: a.uv && b.uv ? [a.uv[0] + (b.uv[0] - a.uv[0]) * t, a.uv[1] + (b.uv[1] - a.uv[1]) * t] : null, id: -1 });
    }
  }
  return out;
}

/** Fan a layer's input into triangles: { p:[3 points], uv:[3]|null, texture, vid:[3 vertex ids] }. */
function layerTriangles(input, layer) {
  const tris = [];
  if (input?.vertices && input?.faces) {
    input.faces.forEach((t) => tris.push({ p: t.map((i) => input.vertices[i]), uv: null, texture: null, vid: t.map((i) => `${layer}:${i}`) }));
    return tris;
  }
  for (const f of input || []) {
    const c = f.corners; if (!c || c.length < 3) continue;
    const key = (p) => `${layer}:${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;   // shared corners count once
    for (let i = 1; i + 1 < c.length; i++) {
      const idx = [0, i, i + 1];
      tris.push({ p: idx.map((j) => c[j]), uv: Array.isArray(f.uv) && f.uv.length === c.length ? idx.map((j) => f.uv[j]) : null, texture: f.texture || null, vid: idx.map((j) => key(c[j])) });
    }
  }
  return tris;
}

const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/**
 * measureFidelity({ cast:[part…], world:[part…], camera:{eye,target,fovY?}, frame:{width,height}, texturePx? })
 */
export function measureFidelity({ cast = [], world = [], camera, frame, texturePx = () => null }) {
  const { width: W, height: H } = frame;
  const cam = makeCamera(camera, frame);
  const tris = [];
  for (const [layer, parts] of [['cast', cast], ['world', world]]) {
    parts.forEach((part, pi) => { for (const t of layerTriangles(part, `${layer}${pi}`)) tris.push({ ...t, layer }); });
  }

  const depth = new Float64Array(W * H).fill(Infinity), owner = new Int32Array(W * H).fill(-1);
  const texelRate = new Float64Array(tris.length).fill(NaN);
  tris.forEach((t, ti) => {
    const vs = t.p.map((p) => cam.view(p));   // no back-face cull: the World draws faces double-sided; the z-buffer decides
    const poly = clipNear(vs.map((v, j) => ({ v, uv: t.uv ? t.uv[j] : null })));
    if (poly.length < 3) return;
    const sp = poly.map((q) => cam.project(q.v));
    // texels per pixel for a textured triangle: √(tile texels its uv covers ÷ the screen area it covers), unclipped by the frame
    if (t.texture && t.uv) {
      const px = texturePx(t.texture);
      let uvA = 0, scrA = 0;
      for (let i = 1; i + 1 < poly.length; i++) {
        uvA += Math.abs(area2(poly[0].uv, poly[i].uv, poly[i + 1].uv)) / 2;
        scrA += Math.abs(area2(sp[0], sp[i], sp[i + 1])) / 2;
      }
      if (px && scrA > 0) texelRate[ti] = Math.sqrt((uvA * px[0] * px[1]) / scrA);   // linear: texels per pixel along an axis (a mip level's 2^n)
    }
    for (let i = 1; i + 1 < sp.length; i++) {
      const a = sp[0], b = sp[i], c = sp[i + 1], A = area2(a, b, c);
      if (Math.abs(A) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const P = [x + 0.5, y + 0.5];
        const w0 = area2(b, c, P) / A, w1 = area2(c, a, P) / A, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = 1 / (w0 / a[2] + w1 / b[2] + w2 / c[2]);   // perspective-correct view depth
        const o = y * W + x;
        if (z < depth[o]) { depth[o] = z; owner[o] = ti; }
      }
    }
  });

  const acc = { cast: { pixels: 0, tris: new Set(), verts: new Set(), texPx: 0, texSum: 0 }, world: { pixels: 0, tris: new Set(), verts: new Set(), texPx: 0, texSum: 0 } };
  for (let o = 0; o < owner.length; o++) {
    const ti = owner[o]; if (ti < 0) continue;
    const t = tris[ti], a = acc[t.layer];
    a.pixels++; a.tris.add(ti); for (const v of t.vid) a.verts.add(v);
    if (Number.isFinite(texelRate[ti])) { a.texPx++; a.texSum += texelRate[ti]; }
  }
  const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
  const layerOut = (a) => ({
    pixels: a.pixels,
    triangles: a.tris.size,
    trianglesPerKpx: r3(a.pixels ? (a.tris.size * 1000) / a.pixels : null),
    verticesPerKpx: r3(a.pixels ? (a.verts.size * 1000) / a.pixels : null),
    texelsPerPixel: r3(a.texPx ? a.texSum / a.texPx : null),
  });
  const cast_ = layerOut(acc.cast), world_ = layerOut(acc.world);
  const ratio = (k) => (cast_[k] && world_[k] ? r3(cast_[k] / world_[k]) : null);
  return { frame: { width: W, height: H }, cast: cast_, world: world_, ratio: { triangles: ratio('trianglesPerKpx'), vertices: ratio('verticesPerKpx') } };
}

/** A tile's pixel size from its data URL (PNG IHDR), for `texturePx`. */
export function pngSize(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return null;
  const b = Buffer.from(dataUrl.slice(22, 22 + 44), 'base64');
  return b.length >= 24 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
}
