/**
 * scad-gate — the OpenSCAD MACHINE GATE's pure half (openscad-leg.plan.md phase 3).
 *
 * Sibling of print-gate.js, same posture and same split: `scripts/scad-gate.mjs` spawns the
 * binary (operator-hosted, never a dependency), and everything testable without one lives
 * here — the binary search order, the STL measurement, and the verdict.
 *
 * WHAT THIS GATE ANSWERS. The transpiler claims a recipe became an equivalent OpenSCAD
 * program. Nothing inside mojulo can check that claim: the emitted file is text, and the
 * solid it describes exists only once OpenSCAD evaluates it. So the gate renders the file
 * and compares the result against what `measure_solid` / `export_model` already DECLARED.
 * It is the phase that makes phase 1 falsifiable.
 *
 * WHAT IT COMPARES, AND WHAT IT DELIBERATELY DOES NOT (plan decision 4):
 *  - BOUNDING BOX, always. This catches the entire units-and-scale class of error, which is
 *    the one that actually bites a print leg — a ×10 or a ×25.4 shows up here immediately.
 *  - VOLUME, when the caller has one to declare. It is the strong check precisely because it
 *    is triangulation-independent; absent a declared volume the field is null with a reason,
 *    never a failure.
 *  - TRIANGLE COUNT: NEVER. This is not an oversight, and a future reader should not add it.
 *    The USD gate compares triangles legitimately because both sides carry the same mesh.
 *    Here they do not: OpenSCAD tessellates exact solids by its own `$fn`, while mojulo
 *    marched a grid. Equal counts would be a coincidence and unequal counts mean nothing.
 *
 * ADVISORY, never refusing (the bicycle doctrine). Absent the binary the driver stamps
 * `{ skipped: true, reason }` naming the env var; a disagreement is REPORTED with its
 * numbers. Suitability is the operator's.
 *
 * Pure: no spawn, no fs, no clock. The caller injects `exists` / `which`.
 */

// Search order for the binary: explicit env, then PATH names, then the macOS app bundle.
export const OPENSCAD_CANDIDATES = [
  { id: 'openscad', names: ['openscad', 'OpenSCAD'], apps: ['/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD'] },
  { id: 'openscad-nightly', names: ['openscad-nightly'], apps: ['/Applications/OpenSCAD-nightly.app/Contents/MacOS/OpenSCAD'] },
];

/**
 * findOpenscad({ env, exists, which }) → { id, bin } | null.
 * `env.MOJULO_OPENSCAD` wins. `which(name)` resolves a PATH binary or returns null;
 * `exists(p)` tests an absolute path.
 */
export function findOpenscad({ env = {}, exists = () => false, which = () => null } = {}) {
  if (env.MOJULO_OPENSCAD) return { id: 'custom', bin: env.MOJULO_OPENSCAD };
  for (const c of OPENSCAD_CANDIDATES) {
    for (const n of c.names) { const p = which(n); if (p) return { id: c.id, bin: p }; }
    for (const p of c.apps) if (exists(p)) return { id: c.id, bin: p };
  }
  return null;
}

const BIN_HEADER = 84;          // 80-byte header + uint32 triangle count
const BIN_TRI = 50;             // 12 float32 + uint16 attribute

/** Is this buffer a BINARY stl? The length test is the only reliable one — a binary file may also begin with "solid". */
function isBinaryStl(buf) {
  if (buf.length < BIN_HEADER) return false;
  return BIN_HEADER + buf.readUInt32LE(80) * BIN_TRI === buf.length;
}

/**
 * measureStl(buffer) → { triangles, bounds: { min, max, size }, volume } | null.
 *
 * A MEASUREMENT, not a reader: it returns numbers and never geometry, so nothing OpenSCAD
 * produced can enter a recipe through here. That is the doctrine line — foreign meshes come
 * home only as bound artifacts with provenance, and this is a gate, not a door.
 *
 * `volume` is the signed-tetrahedron sum over the triangles (the divergence theorem), which
 * is exact for a closed surface and meaningless for an open one — the caller pairs it with a
 * closure verdict rather than trusting it alone.
 */
/** STL bytes → triangles `[[a,b,c]…]` (binary or ascii), or null when it is not an STL. */
export function readStlTriangles(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  return isBinaryStl(buf) ? readBinaryStl(buf) : readAsciiStl(buf);
}

export function measureStl(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const tris = isBinaryStl(buf) ? readBinaryStl(buf) : readAsciiStl(buf);
  if (!tris || !tris.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let vol = 0;
  for (const [a, b, c] of tris) {
    for (const p of [a, b, c]) {
      for (let k = 0; k < 3; k += 1) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
    }
    vol += (
      a[0] * (b[1] * c[2] - b[2] * c[1])
      - a[1] * (b[0] * c[2] - b[2] * c[0])
      + a[2] * (b[0] * c[1] - b[1] * c[0])
    ) / 6;
  }
  if (!Number.isFinite(min[0])) return null;
  return {
    triangles: tris.length,
    bounds: { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] },
    volume: Math.abs(vol),
  };
}

export function readBinaryStl(buf) {
  const n = buf.readUInt32LE(80);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const o = BIN_HEADER + i * BIN_TRI + 12;      // skip the per-facet normal
    out.push([
      [buf.readFloatLE(o), buf.readFloatLE(o + 4), buf.readFloatLE(o + 8)],
      [buf.readFloatLE(o + 12), buf.readFloatLE(o + 16), buf.readFloatLE(o + 20)],
      [buf.readFloatLE(o + 24), buf.readFloatLE(o + 28), buf.readFloatLE(o + 32)],
    ]);
  }
  return out;
}

export function readAsciiStl(buf) {
  const text = buf.toString('utf8');
  if (!/^\s*solid/.test(text)) return null;
  const out = [];
  let cur = [];
  for (const m of text.matchAll(/vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g)) {
    cur.push([Number(m[1]), Number(m[2]), Number(m[3])]);
    if (cur.length === 3) { out.push(cur); cur = []; }
  }
  return out.length ? out : null;
}

/**
 * compareScadGate({ declared, measured, tolerance_mm }) → the verdict.
 *
 * `declared` is what mojulo said before OpenSCAD ran — `{ size_mm, volume_mm3? }`, straight
 * off an `export_model` / `measure_solid` result. `measured` is `measureStl` output of what
 * OpenSCAD rendered. Every field is reported with its numbers; `agrees` is a summary, not a
 * gate, and the caller stamps it either way.
 *
 * Tolerance defaults to the larger of 0.1 mm and 1% of the axis — a transpiled solid should
 * land far inside that, and a BAKED one is a polygonized field whose surface sits up to
 * about half a grid cell in, so a caller comparing a baked part passes its own cell size.
 */
export function compareScadGate({ declared = {}, measured = null, tolerance_mm: tol = null } = {}) {
  if (!measured) {
    return { agrees: false, reason: 'OpenSCAD produced no readable geometry', size: null, volume: null };
  }
  const out = { agrees: true, size: null, volume: null, triangles_compared: false };
  const dsz = Array.isArray(declared.size_mm) ? declared.size_mm.map(Number) : null;
  if (dsz && dsz.length === 3 && dsz.every(Number.isFinite)) {
    const axes = ['x', 'y', 'z'].map((axis, i) => {
      const d = dsz[i];
      const m = measured.bounds.size[i];
      const limit = Number.isFinite(tol) && tol > 0 ? tol : Math.max(0.1, Math.abs(d) * 0.01);
      const delta = Math.abs(m - d);
      return { axis, declared: round(d), measured: round(m), delta: round(delta), limit: round(limit), agrees: delta <= limit };
    });
    out.size = { axes, agrees: axes.every((a) => a.agrees) };
    if (!out.size.agrees) out.agrees = false;
  } else {
    out.size = { agrees: false, reason: 'nothing declared a size_mm to compare against' };
    out.agrees = false;
  }
  const dv = Number(declared.volume_mm3);
  if (Number.isFinite(dv) && dv > 0) {
    const limit = Math.max(dv * 0.02, 1);
    const delta = Math.abs(measured.volume - dv);
    out.volume = { declared: round(dv), measured: round(measured.volume), delta: round(delta), limit: round(limit), agrees: delta <= limit };
    if (!out.volume.agrees) out.agrees = false;
  } else {
    out.volume = null;
    out.volume_reason = 'no declared volume — run export_model with `union: true` on a print format, or measure_solid, to get one';
  }
  // decision 4, stated in the stamp so nobody reads its absence as an oversight
  out.triangles_note = 'Triangle counts are deliberately NOT compared: OpenSCAD tessellates exact solids by $fn while mojulo marched a grid, so agreement would be coincidence.';
  return out;
}

const round = (v) => Math.round(v * 1000) / 1000;
