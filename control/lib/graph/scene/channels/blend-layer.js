import { safeJson } from '../emit-util.js';

// In-page script: the BLEND LAYER (opt-in: faces carrying `blend: true`). The sixth generation's two-tile vertex blend —
// a second surface tile laid over the first and faded in per vertex (moss over dirt, grass over a path) — as its own
// translucent pass: per texture key one mesh of the blend faces, its texture multiplied by the baked per-corner colour,
// its per-corner `cornerAlpha` the blend weight. Drawn after the opaque world with a polygon offset, so it sits on the
// face it shares a plane with and never fights it. No depth write; not a walk collider (the face under it is).
// Absent blend faces ⇒ NOT emitted, so every other World stays byte-identical. A face's `blend: 'cut'` draws its layer
// ALPHA-TESTED instead (tex.a × cornerAlpha against ½): a ragged pixel edge that grows with the weight, no blending.

const TRIS = [[0, 1, 2], [0, 2, 3]];
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
const b64 = (arr) => Buffer.from(new Float32Array(arr).buffer).toString('base64');

/** blend faces → [{ key, pos, uv, col }] (base64 Float32: xyz, uv, rgba) per texture key, sorted by key. */
export function collectBlendLayers(faces = []) {
  const by = new Map();
  const cut = new Set(), compact = new Map();
  for (const f of faces) {
    // a CUT layer whose uv is world-locked (`uvScale`: uv = x, y over it) ships compact: four corners a quad, the
    // colour as sRGB bytes, the uv and the triangles rebuilt in the page
    if (f && f.blend === 'cut' && f.uvScale > 0 && typeof f.texture === 'string' && Array.isArray(f.corners) && f.corners.length === 4) {
      const g = compact.get(f.texture) || compact.set(f.texture, { pos: [], c8: [], s: f.uvScale }).get(f.texture);
      const cols = (Array.isArray(f.cornerFills) && f.cornerFills.length >= 4 ? f.cornerFills : [0, 1, 2, 3].map(() => f.fill || '#ffffff'));
      const al = Array.isArray(f.cornerAlpha) && f.cornerAlpha.length >= 4 ? f.cornerAlpha : [1, 1, 1, 1];
      for (let k = 0; k < 4; k++) { g.pos.push(f.corners[k][0], f.corners[k][1], f.corners[k][2]); g.c8.push(...[1, 3, 5].map((i) => parseInt(cols[k].slice(i, i + 2), 16)), Math.round(255 * Math.max(0, Math.min(1, al[k])))); }
      continue;
    }
    if (!f || !f.blend || typeof f.texture !== 'string' || !Array.isArray(f.corners) || f.corners.length < 4 || !Array.isArray(f.uv)) continue;
    if (f.blend === 'cut') cut.add(f.texture);
    const g = by.get(f.texture) || by.set(f.texture, { pos: [], uv: [], col: [] }).get(f.texture);
    const cols = (Array.isArray(f.cornerFills) && f.cornerFills.length >= 4 ? f.cornerFills : [0, 1, 2, 3].map(() => f.fill || '#ffffff')).map(hexLin);
    const al = Array.isArray(f.cornerAlpha) && f.cornerAlpha.length >= 4 ? f.cornerAlpha : [1, 1, 1, 1];
    for (const tri of TRIS) for (const k of tri) {
      g.pos.push(f.corners[k][0], f.corners[k][1], f.corners[k][2]); g.uv.push(f.uv[k][0], f.uv[k][1]);
      g.col.push(cols[k][0], cols[k][1], cols[k][2], Math.max(0, Math.min(1, al[k])));
    }
  }
  return [...[...by.keys()].sort().map((key) => { const g = by.get(key); return { key, pos: b64(g.pos), uv: b64(g.uv), col: b64(g.col), ...(cut.has(key) ? { cut: true } : {}) }; }),
    ...[...compact.keys()].sort().map((key) => { const g = compact.get(key); return { key, cut: true, s: g.s, pos: b64(g.pos), c8: Buffer.from(Uint8Array.from(g.c8)).toString('base64') }; })];
}

export function blendLayerScript(layers) {
  return `
// --- blend layer (two-tile vertex blend): a second tile faded in per vertex over the world ---
for (const bl of ${safeJson(layers)}) {
  const url = TEXTURES[bl.key]; if (!url) continue;
  const g = new THREE.BufferGeometry();${layers.some((l) => l.c8) ? `
  if (bl.c8) {
    // compact: four corners a quad, sRGB bytes, uv from the world over the layer's scale, two triangles a quad
    const P = decodeF32(bl.pos), n = P.length / 3, b = Uint8Array.from(atob(bl.c8), (ch) => ch.charCodeAt(0)), C = new Float32Array(n * 4), U = new Float32Array(n * 2), I = new Uint32Array((n / 4) * 6);
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    for (let i = 0; i < n; i++) { C[i * 4] = lin(b[i * 4]); C[i * 4 + 1] = lin(b[i * 4 + 1]); C[i * 4 + 2] = lin(b[i * 4 + 2]); C[i * 4 + 3] = b[i * 4 + 3] / 255; U[i * 2] = P[i * 3] / bl.s; U[i * 2 + 1] = P[i * 3 + 1] / bl.s; }
    for (let q = 0; q < n / 4; q++) I.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 4)); g.setIndex(new THREE.BufferAttribute(I, 1));
  } else {` : ''}
  g.setAttribute('position', new THREE.BufferAttribute(decodeF32(bl.pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(decodeF32(bl.uv), 2));
  g.setAttribute('color', new THREE.BufferAttribute(decodeF32(bl.col), 4));${layers.some((l) => l.c8) ? `
  }` : ''}
  g.computeBoundingSphere();
  const tx = new THREE.TextureLoader().load(url); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8;
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tx, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4${layers.some((l) => l.cut) ? ', ...(bl.cut ? { transparent: false, alphaTest: 0.5 } : {})' : ''} }));
  m.renderOrder = 0.7;
  scene.add(m);
}`;
}
