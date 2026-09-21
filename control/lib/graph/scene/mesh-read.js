/**
 * mesh-read — STL and 3MF bytes → the standard face list, for the inbound mesh door.
 *
 * `bind_mesh_render` accepts a GLB; OpenSCAD (and most slicers' neighbours) write STL and 3MF
 * and nothing glTF. This module is the small converter that closes that gap: an STL becomes
 * grey faces, a 3MF keeps its `basematerials` colour per triangle and its build transforms, and
 * either lands as the ordinary `{ corners, fill, tint, outNormal }` records `facesToGlb` takes.
 * The shading is the studio's Lambert over the tint, so a bound OpenSCAD part reads like every
 * other mojulo face in the World rather than as a flat swatch.
 *
 * Pure: bytes in, faces out. The zip reader is the ~60 lines a 3MF needs (stored + deflate),
 * the twin of zip-writer.js.
 */

import zlib from 'node:zlib';
import { readStlTriangles } from './scad-gate.js';
import { shadeHex, DEFAULT_LIGHT } from '../polygonizer/vexar.js';

export const MESH_DEFAULT_TINT = '#b8bcc4';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; };

function faceOf(a, b, c, tint, group, light) {
  const n = norm(cross(sub(b, a), sub(c, a)));
  return { corners: [a, b, c, a], fill: shadeHex(tint, n, light), tint, outNormal: n, doubleSided: true, group };
}

/** STL bytes → faces (one grey tint), or null when the bytes are not an STL. */
export function stlToFaces(buffer, { tint = MESH_DEFAULT_TINT, group = 'mesh', light = DEFAULT_LIGHT } = {}) {
  const tris = readStlTriangles(buffer);
  if (!tris || !tris.length) return null;
  return tris.map(([a, b, c]) => faceOf(a, b, c, tint, group, light));
}

// ─── zip ──────────────────────────────────────────────────────────────────────────

const SIG_EOCD = 0x06054b50, SIG_CEN = 0x02014b50, SIG_LOC = 0x04034b50, SIG_Z64_LOC = 0x07064b50, SIG_Z64_EOCD = 0x06064b50;

/** The entries of a zip as `Map<name, Buffer>` (stored and deflate methods, zip64 offsets honoured). */
export function unzipEntries(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i -= 1) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');
  let count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  // zip64 (lib3mf writes one even for a small 3MF): the locator sits just before the EOCD and
  // points at the zip64 record, which carries the real count and central-directory offset.
  if ((count === 0xffff || p === 0xffffffff) && eocd >= 20 && buf.readUInt32LE(eocd - 20) === SIG_Z64_LOC) {
    const z = Number(buf.readBigUInt64LE(eocd - 20 + 8));
    if (buf.readUInt32LE(z) !== SIG_Z64_EOCD) throw new Error('zip: bad zip64 end-of-central-directory record');
    count = Number(buf.readBigUInt64LE(z + 32));
    p = Number(buf.readBigUInt64LE(z + 48));
  }
  const out = new Map();
  for (let k = 0; k < count; k += 1) {
    if (buf.readUInt32LE(p) !== SIG_CEN) throw new Error('zip: bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    let csize = buf.readUInt32LE(p + 20);
    let usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    let local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    // zip64 extra (id 0x0001): the 64-bit twins of whichever 32-bit fields were pinned at max
    let e = p + 46 + nameLen;
    const eEnd = e + extraLen;
    while (e + 4 <= eEnd) {
      const id = buf.readUInt16LE(e), len = buf.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (usize === 0xffffffff && q + 8 <= e + 4 + len) { usize = Number(buf.readBigUInt64LE(q)); q += 8; }
        if (csize === 0xffffffff && q + 8 <= e + 4 + len) { csize = Number(buf.readBigUInt64LE(q)); q += 8; }
        if (local === 0xffffffff && q + 8 <= e + 4 + len) { local = Number(buf.readBigUInt64LE(q)); q += 8; }
      }
      e += 4 + len;
    }
    p += 46 + nameLen + extraLen + commentLen;
    if (buf.readUInt32LE(local) !== SIG_LOC) throw new Error(`zip: bad local header for ${name}`);
    const lNameLen = buf.readUInt16LE(local + 26), lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const packed = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, packed);
    else if (method === 8) out.set(name, zlib.inflateRawSync(packed));
    else throw new Error(`zip: unsupported compression method ${method} for ${name}`);
  }
  return out;
}

// ─── 3MF ──────────────────────────────────────────────────────────────────────────

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };

/** A 3MF `transform` attribute (12 numbers, row-major 3×4 as the spec lays them) → a point mapper. */
function transformOf(text) {
  if (!text) return (p) => p;
  const m = text.trim().split(/\s+/).map(Number);
  if (m.length !== 12 || m.some((v) => !Number.isFinite(v))) return (p) => p;
  return ([x, y, z]) => [
    m[0] * x + m[3] * y + m[6] * z + m[9],
    m[1] * x + m[4] * y + m[7] * z + m[10],
    m[2] * x + m[5] * y + m[8] * z + m[11],
  ];
}

/**
 * 3MF bytes → faces. Colour: `basematerials` `displaycolor` by the triangle's `p1` (else the
 * object's `pindex`), `#rrggbb`; a 3MF without materials is grey. Build items place objects
 * with their `transform`; an object made of `components` places each child (one level).
 */
export function threeMfToFaces(buffer, { group = 'mesh', light = DEFAULT_LIGHT } = {}) {
  const entries = unzipEntries(buffer);
  let modelName = [...entries.keys()].find((n) => /^3D\/.*\.model$/i.test(n));
  if (!modelName) modelName = [...entries.keys()].find((n) => /\.model$/i.test(n));
  if (!modelName) throw new Error('3MF: no 3D/*.model part in the package');
  const xml = entries.get(modelName).toString('utf8');
  // materials: id → [hex…]
  const palettes = new Map();
  for (const bm of xml.matchAll(/<basematerials\b([^>]*)>([\s\S]*?)<\/basematerials>/g)) {
    const id = attr(bm[1], 'id');
    const cols = [...bm[2].matchAll(/<base\b[^>]*displaycolor="#([0-9A-Fa-f]{6})/g)].map((m) => `#${m[1].toLowerCase()}`);
    palettes.set(id, cols);
  }
  const colourOf = (pid, idx) => { const pal = palettes.get(pid); const i = Number(idx); return pal && Number.isInteger(i) && pal[i] ? pal[i] : MESH_DEFAULT_TINT; };
  // objects
  const objects = new Map();
  for (const ob of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const id = attr(ob[1], 'id');
    const pid = attr(ob[1], 'pid'), pindex = attr(ob[1], 'pindex');
    const body = ob[2];
    const comps = [...body.matchAll(/<component\b([^>]*)\/?>/g)].map((c) => ({ objectid: attr(c[1], 'objectid'), transform: attr(c[1], 'transform') }));
    const verts = [...body.matchAll(/<vertex\b[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*z="([^"]+)"/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
    const tris = [...body.matchAll(/<triangle\b([^>]*)\/?>/g)].map((t) => ({
      v: [Number(attr(t[1], 'v1')), Number(attr(t[1], 'v2')), Number(attr(t[1], 'v3'))],
      tint: colourOf(attr(t[1], 'pid') || pid, attr(t[1], 'p1') ?? pindex),
    }));
    objects.set(id, { verts, tris, comps });
  }
  if (!objects.size) throw new Error('3MF: the model has no <object>');
  const faces = [];
  const emit = (id, map, depth) => {
    const ob = objects.get(id);
    if (!ob) return;
    for (const t of ob.tris) {
      const [a, b, c] = t.v.map((k) => map(ob.verts[k]));
      if (!a || !b || !c) continue;
      faces.push(faceOf(a, b, c, t.tint, group, light));
    }
    if (depth < 4) for (const comp of ob.comps) { const inner = transformOf(comp.transform); emit(comp.objectid, (p) => map(inner(p)), depth + 1); }
  };
  const items = [...xml.matchAll(/<item\b([^>]*)\/?>/g)].map((m) => ({ objectid: attr(m[1], 'objectid'), transform: attr(m[1], 'transform') }));
  if (items.length) for (const it of items) emit(it.objectid, transformOf(it.transform), 0);
  else for (const id of objects.keys()) emit(id, (p) => p, 0);
  if (!faces.length) throw new Error('3MF: no triangles in the build');
  return faces;
}

/** Route by extension / magic: `.stl` or `.3mf` bytes → faces; anything else → null. */
export function meshFileToFaces(buffer, name = '', opts = {}) {
  const ext = String(name).toLowerCase().match(/\.(stl|3mf)$/)?.[1];
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (ext === '3mf' || (!ext && buf.length > 4 && buf.readUInt32LE(0) === SIG_LOC)) return threeMfToFaces(buf, opts);
  if (ext === 'stl' || !ext) return stlToFaces(buf, opts);
  return null;
}
