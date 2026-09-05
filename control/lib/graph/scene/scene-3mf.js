/**
 * scene-3mf — export a baked face list as a 3MF package (3D Manufacturing Format).
 *
 * The FOURTH consumer of the `{ faces, repeats }` payload, and the print leg's
 * second file format (interchange-seams.plan.md seam 1). Where the STL is bare
 * triangle soup whose "true scale" lives in a README beside it, 3MF is the format
 * the slicers PREFER (PrusaSlicer, Bambu Studio, OrcaSlicer, Cura) and it carries
 * what STL structurally cannot:
 *
 *  - UNITS in the file (`unit="millimeter"`), so the scale promise travels;
 *  - COLOUR per triangle via `<basematerials>` — the baked vertex colours the
 *    World draws, quantized to a bounded palette (multi-material printers map
 *    bases to filaments; single-filament printers ignore them);
 *  - SHELL IDENTITY: the base geometry is one `<object>`, every instanced repeat
 *    is its OWN object referenced once per instance as a `<build><item transform>`
 *    — the same TRS `applyTransform` bakes for the STL, expressed as the 3MF
 *    row-vector 4×3 matrix instead of expanded triangles. A 500-tree block is
 *    one tree mesh + 500 items; the slicer sees 500 placeable objects.
 *
 * Same printable SET as the STL (`printableShells`, gated by `isPrintableFace`):
 * water, decals, and studio furniture stay home; textured faces ship as bare
 * geometry; the frame stays z-up (3MF is z-up, like mojulo). Triangles are
 * indexed (3MF requires it) by exact-coordinate dedup, zero-area slivers dropped.
 *
 * The container is the deterministic `buildZip` (zip-writer.js): a fixed
 * timestamp, so the same recipe yields the same bytes — the byte-identity
 * baseline every kernel change is tested against.
 *
 * Honest limits: this is the CORE spec only (no beam lattice, no slice, no
 * production extension); a multi-shell object is still overlapping shells, not
 * a boolean union — that is seam 4 (Manifold). Slicers union on import today.
 */

import { printableShells, applyTransform } from './scene-stl.js';
import { buildZip } from './zip-writer.js';

const NS_CORE = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const NS_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_MODEL = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="${NS_CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>
`;
const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${NS_RELS}"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="${REL_MODEL}"/></Relationships>
`;

// Fixed-precision number → shortest decimal text (0.1 µm at mm scale; no "-0").
function num(v) {
  const s = (Math.round(v * 1e4) / 1e4).toString();
  return s === '-0' ? '0' : s;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// linear (0..1) → sRGB byte — the inverse of face-mesh's srgbToLinear.
function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

// Per-triangle colour: the mean of its three vertex colours (linear, AO-baked),
// as an sRGB byte triple. The palette quantizer works on these.
function triangleRgb(colors, i) {
  const r = (colors[i] + colors[i + 3] + colors[i + 6]) / 3;
  const g = (colors[i + 1] + colors[i + 4] + colors[i + 7]) / 3;
  const b = (colors[i + 2] + colors[i + 5] + colors[i + 8]) / 3;
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

// Index one shell's soup: dedup vertices by exact coordinate, drop slivers,
// collect per-triangle colour bytes. Returns { verts:[[x,y,z]], tris:[[a,b,c]], rgb:[[r,g,b]], bounds }.
function indexShell(positions, colors, scale) {
  const keyOf = new Map();
  const verts = [];
  const tris = [];
  const rgb = [];
  const vid = (x, y, z) => {
    const k = `${x},${y},${z}`;
    let id = keyOf.get(k);
    if (id === undefined) { id = verts.length; keyOf.set(k, id); verts.push([x, y, z]); }
    return id;
  };
  for (let i = 0; i + 9 <= positions.length; i += 9) {
    const ax = positions[i] * scale, ay = positions[i + 1] * scale, az = positions[i + 2] * scale;
    const bx = positions[i + 3] * scale, by = positions[i + 4] * scale, bz = positions[i + 5] * scale;
    const cx = positions[i + 6] * scale, cy = positions[i + 7] * scale, cz = positions[i + 8] * scale;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (!(nx * nx + ny * ny + nz * nz > 0)) continue; // zero-area sliver
    const a = vid(ax, ay, az), b = vid(bx, by, bz), c = vid(cx, cy, cz);
    if (a === b || b === c || a === c) continue; // collapsed after dedup
    tris.push([a, b, c]);
    rgb.push(triangleRgb(colors, i));
  }
  return { verts, tris, rgb };
}

// Quantize the colour set to at most `maxColors` distinct bases, dropping one bit
// per channel at a time (8 → 7 → … bits). Deterministic; returns the bit depth used
// and the mapper. Most exports fit at 8 bits; a big AO-shaded city may drop to 5–6.
function makePalette(shellsRgb, maxColors) {
  for (let bits = 8; bits >= 1; bits--) {
    const shift = 8 - bits;
    const q = (v) => {
      const lv = v >> shift;
      const maxL = (1 << bits) - 1;
      return Math.round((lv / maxL) * 255); // re-expand so #FFFFFF stays #FFFFFF
    };
    const hexOf = ([r, g, b]) => `#${[q(r), q(g), q(b)].map((n) => n.toString(16).toUpperCase().padStart(2, '0')).join('')}`;
    const seen = new Set();
    let over = false;
    for (const list of shellsRgb) {
      for (const c of list) { seen.add(hexOf(c)); if (seen.size > maxColors) { over = true; break; } }
      if (over) break;
    }
    if (!over) return { bits, hexOf };
  }
  return { bits: 1, hexOf: () => '#000000' };
}

// 3MF transform: 12 numbers, row-vector convention — p' = p·M + t, written
// "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32". Built by probing
// applyTransform on the basis vectors so the matrix IS the STL's TRS.
function transformAttr(t, scale) {
  const o = applyTransform(t, 0, 0, 0);
  const ex = applyTransform(t, 1, 0, 0), ey = applyTransform(t, 0, 1, 0), ez = applyTransform(t, 0, 0, 1);
  const row = (e) => [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
  const rx = row(ex), ry = row(ey), rz = row(ez);
  return [rx, ry, rz].flat().map(num).concat(o.map((v) => num(v * scale))).join(' ');
}

/**
 * facesTo3mf(payload, { scale, generator, title, maxColors }) → { bytes,
 * byteLength, triangleCount, vertexCount, objectCount, itemCount, colorCount,
 * colorBits, bounds: { min, max, size } } or null when nothing is printable.
 *
 * `scale` maps world units → mm (the file declares millimetres, so a `scale`
 * derived from the recipe's `units` makes the print true-scale WITHOUT a note).
 * `bounds` is post-scale and post-instancing — the printed extent, computed
 * over every build item — so it matches the STL's readout for the same input.
 */
export function facesTo3mf(payload = {}, { scale = 1, generator = 'mojulo scene-3mf', title = null, maxColors = 256 } = {}) {
  const shells = printableShells(payload);
  if (!shells) return null;

  const indexed = [];
  if (shells.base) indexed.push({ name: 'base', ...indexShell(shells.base.positions, shells.base.colors, scale), transforms: null });
  for (const r of shells.repeats) {
    const ix = indexShell(r.positions, r.colors, scale);
    if (!ix.tris.length) continue;
    indexed.push({ name: r.group || 'repeat', ...ix, transforms: r.transforms });
  }
  const shellsWithTris = indexed.filter((s) => s.tris.length);
  if (!shellsWithTris.length) return null;

  // Palette over every shell's triangle colours, in shell order.
  const { bits, hexOf } = makePalette(shellsWithTris.map((s) => s.rgb), maxColors);
  const palette = [];
  const paletteIdx = new Map();
  const colorIndex = (c) => {
    const h = hexOf(c);
    let i = paletteIdx.get(h);
    if (i === undefined) { i = palette.length; paletteIdx.set(h, i); palette.push(h); }
    return i;
  };

  // Printed bounds: base verts as-is, repeat verts through each item transform.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const grow = (x, y, z) => {
    if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
    if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
    if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
  };

  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>\n');
  parts.push(`<model unit="millimeter" xml:lang="en-US" xmlns="${NS_CORE}">\n`);
  parts.push(`<metadata name="Application">${esc(generator)}</metadata>\n`);
  if (title) parts.push(`<metadata name="Title">${esc(title)}</metadata>\n`);
  parts.push('<resources>\n');

  // Objects first (their triangles fill the palette), then the basematerials
  // block is spliced in ahead of them — the spec wants resources declared
  // before use, and pid="1" is reserved for the palette.
  const MATERIALS_ID = 1;
  const objectXml = [];
  const items = [];
  let triangleCount = 0;
  let vertexCount = 0;
  let nextId = MATERIALS_ID + 1;
  for (const s of shellsWithTris) {
    const id = nextId++;
    const triIdx = s.rgb.map(colorIndex);
    // Object default colour = its most frequent base; per-triangle p1 only where it differs.
    const freq = new Map();
    for (const ci of triIdx) freq.set(ci, (freq.get(ci) || 0) + 1);
    let defIdx = triIdx[0];
    for (const [ci, n] of freq) if (n > freq.get(defIdx)) defIdx = ci;
    const v = s.verts.map((p) => `<vertex x="${num(p[0])}" y="${num(p[1])}" z="${num(p[2])}"/>`).join('');
    const t = s.tris.map((tri, i) => `<triangle v1="${tri[0]}" v2="${tri[1]}" v3="${tri[2]}"${triIdx[i] === defIdx ? '' : ` p1="${triIdx[i]}"`}/>`).join('');
    objectXml.push(`<object id="${id}" name="${esc(s.name)}" type="model" pid="${MATERIALS_ID}" pindex="${defIdx}"><mesh><vertices>${v}</vertices><triangles>${t}</triangles></mesh></object>\n`);
    triangleCount += s.tris.length * (s.transforms ? s.transforms.length : 1);
    vertexCount += s.verts.length;
    if (s.transforms) {
      for (const tr of s.transforms) {
        items.push(`<item objectid="${id}" transform="${transformAttr(tr, scale)}"/>`);
        for (const p of s.verts) {
          // verts are already scaled; applyTransform's pos is in world units → scale it too
          const w = applyTransform({ ...tr, pos: Array.isArray(tr.pos) ? tr.pos.map((c) => c * scale) : tr.pos }, p[0], p[1], p[2]);
          grow(w[0], w[1], w[2]);
        }
      }
    } else {
      items.push(`<item objectid="${id}"/>`);
      for (const p of s.verts) grow(p[0], p[1], p[2]);
    }
  }
  parts.push(`<basematerials id="${MATERIALS_ID}">${palette.map((h) => `<base name="${h}" displaycolor="${h}FF"/>`).join('')}</basematerials>\n`);
  parts.push(...objectXml);
  parts.push('</resources>\n<build>');
  parts.push(items.join(''));
  parts.push('</build>\n</model>\n');
  const model = parts.join('');

  const bytes = buildZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: RELS },
    { name: '3D/3dmodel.model', data: model },
  ]);
  const bounds = { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
  return {
    bytes,
    byteLength: bytes.length,
    triangleCount,
    vertexCount,
    objectCount: shellsWithTris.length,
    itemCount: items.length,
    colorCount: palette.length,
    colorBits: bits,
    bounds,
  };
}
