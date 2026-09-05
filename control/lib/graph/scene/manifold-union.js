/**
 * manifold-union — true CSG union of the printable shells via the Manifold
 * library (interchange-seams.plan.md seam 4a).
 *
 * Multi-part solids ship to the printer as OVERLAPPING SHELLS and rely on the
 * slicer's mesh repair to merge them; the closure audit can say "the rims are
 * closed" but not "this is one solid with this volume". Manifold (Apache-2.0,
 * WASM, the boolean kernel under OpenSCAD 2025) computes an exact, watertight
 * union and reports volume / genus — the print leg's honest VOLUME gate.
 *
 * Posture: `manifold-3d` is an OPTIONAL dependency in the creative group (like
 * `three`), loaded lazily. Absent ⇒ `unionShells` returns `{ skipped }` and the
 * caller ships the un-unioned file with the reason — never an error. Per-shell
 * failures (an open surface, a non-manifold seam) are reported by name and the
 * shell is left OUT of the union but still listed; the caller decides.
 *
 * Colour survives: each vertex carries its linear RGB as Manifold properties
 * (numProp 6), which the boolean interpolates across cut edges, so the unioned
 * solid comes back as the standard face list with per-corner fills.
 *
 * Deterministic for a given input (Manifold is); byte-identity of the OLD path
 * is untouched (this only runs when a caller opts in).
 */

let _modulePromise = null;

/** Lazy-load the WASM module once; null when the package is not installed. */
export async function loadManifold() {
  if (!_modulePromise) {
    _modulePromise = (async () => {
      let mod;
      try {
        mod = await import('manifold-3d');
      } catch (e) {
        if (e && (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'MODULE_NOT_FOUND')) return null;
        throw e;
      }
      const wasm = await mod.default();
      wasm.setup();
      return wasm;
    })();
  }
  return _modulePromise;
}

function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}
const hex2 = (n) => n.toString(16).padStart(2, '0');
const rgbHex = (r, g, b) => `#${hex2(linearToSrgb(r))}${hex2(linearToSrgb(g))}${hex2(linearToSrgb(b))}`;

/**
 * One shell (a position soup + matching linear colours) → a Manifold, or
 * { error } when the surface is not a closed manifold. The soup's duplicated
 * corners are merged by position (Mesh.merge) so the topology closes.
 */
function shellToManifold(wasm, positions, colors) {
  const { Manifold, Mesh } = wasm;
  const n = positions.length / 3;
  const vp = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    vp[i * 6] = positions[i * 3]; vp[i * 6 + 1] = positions[i * 3 + 1]; vp[i * 6 + 2] = positions[i * 3 + 2];
    vp[i * 6 + 3] = colors ? colors[i * 3] : 0.5; vp[i * 6 + 4] = colors ? colors[i * 3 + 1] : 0.5; vp[i * 6 + 5] = colors ? colors[i * 3 + 2] : 0.5;
  }
  const tv = new Uint32Array(n);
  for (let i = 0; i < n; i++) tv[i] = i;
  const mesh = new Mesh({ numProp: 6, vertProperties: vp, triVerts: tv });
  mesh.merge();
  try {
    const m = new Manifold(mesh);
    const status = m.status();
    if (status !== 'NoError') { m.delete(); return { error: status }; }
    return { manifold: m };
  } catch (e) {
    return { error: e && e.code ? e.code : String(e && e.message ? e.message : e) };
  }
}

/**
 * unionShells(shells) → { faces, stats } | { skipped: true, reason, stats? }
 *
 * `shells`: [{ name, positions: Float32Array (triangle soup, world units),
 * colors: Float32Array|null (linear rgb per vertex) }] — the printable set
 * with every instance already transformed into place.
 * `faces`: the unioned solid as the standard face list (triangles padded to
 * [a,b,c,c] quads with per-corner `cornerFills`), ready for facesToStl / 3mf.
 * `stats`: { shells, unioned, non_manifold: [{ name, error }], volume, genus,
 * triangles, vertices } — volume in cubic world units; `unioned` counts the closed
 * COMPONENTS fed to the union (a shell decomposes into its connected parts first).
 */
export async function unionShells(shells) {
  const wasm = await loadManifold();
  if (!wasm) {
    return { skipped: true, reason: "manifold-3d is not installed (an optional creative dependency — `npm install manifold-3d` in control/); shells ship un-unioned" };
  }
  const { Manifold } = wasm;
  const parts = [];
  const nonManifold = [];
  for (const s of shells) {
    if (!s || !s.positions || !s.positions.length) continue;
    const r = shellToManifold(wasm, s.positions, s.colors || null);
    if (!r.manifold) { nonManifold.push({ name: s.name || 'shell', error: r.error }); continue; }
    // A shell (the base set especially) is usually SEVERAL closed components that overlap —
    // a multi-component mesh is "manifold" without resolving its overlaps (volumes just add),
    // so split into connected components first; the union below resolves them for real.
    const comps = r.manifold.decompose();
    if (comps.length <= 1) parts.push({ name: s.name, m: r.manifold });
    else {
      comps.forEach((c, i) => parts.push({ name: `${s.name}#${i}`, m: c }));
      r.manifold.delete();
    }
  }
  if (!parts.length) {
    return { skipped: true, reason: `no shell is a closed manifold (${nonManifold.map((n) => `${n.name}: ${n.error}`).join('; ')}) — nothing to union`, stats: { shells: shells.length, unioned: 0, non_manifold: nonManifold } };
  }
  let result;
  try {
    result = parts.length === 1 ? parts[0].m : Manifold.union(parts.map((p) => p.m));
    const status = result.status();
    if (status !== 'NoError') {
      return { skipped: true, reason: `Manifold union failed: ${status}`, stats: { shells: shells.length, unioned: 0, non_manifold: nonManifold } };
    }
    const mesh = result.getMesh();
    const np = mesh.numProp;
    const vp = mesh.vertProperties;
    const tv = mesh.triVerts;
    const faces = [];
    for (let t = 0; t + 3 <= tv.length; t += 3) {
      const corners = [];
      const fills = [];
      for (let k = 0; k < 3; k++) {
        const v = tv[t + k] * np;
        corners.push([vp[v], vp[v + 1], vp[v + 2]]);
        fills.push(np >= 6 ? rgbHex(vp[v + 3], vp[v + 4], vp[v + 5]) : '#808080');
      }
      corners.push(corners[2]); // pad to the [a,b,c,c] quad the mesh builder expects
      fills.push(fills[2]);
      const flat = fills[0] === fills[1] && fills[1] === fills[2];
      const face = { corners, fill: fills[0], group: 'union' };
      if (!flat) face.cornerFills = fills;
      faces.push(face);
    }
    const stats = {
      shells: shells.length,
      unioned: parts.length,
      non_manifold: nonManifold,
      volume: result.volume(),
      genus: result.genus(),
      triangles: mesh.numTri,
      vertices: mesh.numVert,
    };
    return { faces, stats };
  } finally {
    for (const p of parts) { try { p.m.delete(); } catch { /* already consumed */ } }
    if (result && parts.length > 1) { try { result.delete(); } catch { /* freed */ } }
  }
}

/**
 * shellsToInstances(shells, applyTransform) → [{ name, positions, colors }] —
 * flatten printableShells() output into placed soups: the base as one shell and
 * every repeat instance as its own shell (transform baked, world units).
 */
export function shellsToInstances(shells, applyTransform) {
  const out = [];
  if (shells.base) out.push({ name: 'base', positions: shells.base.positions, colors: shells.base.colors });
  for (const r of shells.repeats) {
    r.transforms.forEach((t, i) => {
      const inst = new Float32Array(r.positions.length);
      for (let k = 0; k < r.positions.length; k += 3) {
        const [x, y, z] = applyTransform(t, r.positions[k], r.positions[k + 1], r.positions[k + 2]);
        inst[k] = x; inst[k + 1] = y; inst[k + 2] = z;
      }
      out.push({ name: `${r.group || 'repeat'}:${i}`, positions: inst, colors: r.colors });
    });
  }
  return out;
}
