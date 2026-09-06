/**
 * blender-gate.js — the pure half of the Blender pack's machine gate
 * (export-blender.plan.md rev 3, D2: EXTENDS the verify-usd lineage; usd-gate.js
 * compares the fields the two readers share, this module compares what only a PACK
 * declares — the node inventory, the collections, and the asymmetric frame landmark).
 *
 * Two jobs, both pure (no bpy, no fs):
 *   glbNodeInventory(bytes)   — what mojulo DECLARED: every mesh-bearing node of the pack
 *                                GLB with its z-up world bounds + triangle count, read off
 *                                the POSITION accessors' min/max through the same node walk
 *                                the bind-back reader uses (scene-gltf-read.js). Exact for
 *                                the writer's axis-aligned root rotation.
 *   compareBlenderPack(...)   — what Blender BUILT (import_mojulo.py's verify report) vs
 *                                pack.json. Advisory: every check is a named boolean with
 *                                both numbers beside it; `ok` is the AND of the non-null
 *                                checks. A mirrored import shows in `landmark_frame` (the
 *                                landmark's bounds are compared SIGN-sensitively) — both
 *                                engine legs paid for this lesson.
 */
import { parseGlb, IDENT, mul4, trsMatrix, xfPoint } from './scene-gltf-read.js';

const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const MODE_TRIANGLES = 4;
const r4 = (v) => Math.round(v * 10000) / 10000 + 0; // + 0 folds -0 into 0

function boxOf(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  return { min, max };
}
const sizeOf = (b) => [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
const merge = (a, b) => ({ min: a.min.map((v, i) => Math.min(v, b.min[i])), max: a.max.map((v, i) => Math.max(v, b.max[i])) });

/**
 * glbNodeInventory(bytes) → { nodes, bounds, triangles, meshNodes }
 * nodes: [{ name, min, max, size, triangles, primitives, textured, vertexColour }] in
 * mojulo's z-up frame, sorted by name. Nodes without a mesh (the root, cameras, entity
 * placements, repeat wrappers) are not inventory — Blender makes Empties of them.
 */
export function glbNodeInventory(bytes) {
  const { json } = parseGlb(bytes);
  const nodes = [];
  const seenNames = new Map();
  const visit = (nodeIdx, parentM, parentName, guard) => {
    if (guard.has(nodeIdx)) return;
    guard.add(nodeIdx);
    const node = json.nodes?.[nodeIdx];
    if (!node) return;
    const m = mul4(parentM, trsMatrix(node));
    if (node.mesh != null) {
      const mesh = json.meshes?.[node.mesh];
      const corners = [];
      let triangles = 0;
      let textured = false;
      let vertexColour = false;
      for (const prim of mesh?.primitives || []) {
        if ((prim.mode ?? MODE_TRIANGLES) !== MODE_TRIANGLES) continue;
        const acc = json.accessors?.[prim.attributes?.POSITION];
        if (!acc || !Array.isArray(acc.min) || !Array.isArray(acc.max)) continue;
        const norm = acc.normalized ? NORM[acc.componentType] : null;
        const mn = acc.min.map((v) => (norm ? Math.max(-1, v / norm) : v));
        const mx = acc.max.map((v) => (norm ? Math.max(-1, v / norm) : v));
        for (const x of [mn[0], mx[0]]) for (const y of [mn[1], mx[1]]) for (const z of [mn[2], mx[2]]) {
          const p = xfPoint(m, x, y, z);
          corners.push([p[0], -p[2], p[1]]); // glTF y-up → mojulo z-up, the reader's inverse
        }
        const count = prim.indices != null ? json.accessors[prim.indices].count : acc.count;
        triangles += Math.floor(count / 3);
        if (json.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorTexture) textured = true;
        if (prim.attributes.COLOR_0 != null) vertexColour = true;
      }
      if (corners.length) {
        const raw = typeof node.name === 'string' && node.name ? node.name : `${parentName ?? 'node'}#${nodeIdx}`;
        const n = seenNames.get(raw) ?? 0;
        seenNames.set(raw, n + 1);
        const name = n ? `${raw}.${String(n).padStart(3, '0')}` : raw; // Blender's own dedupe spelling
        const b = boxOf(corners);
        nodes.push({ name, min: b.min.map(r4), max: b.max.map(r4), size: sizeOf(b).map(r4), triangles, primitives: mesh.primitives.length, textured, vertexColour });
      }
    }
    for (const c of node.children || []) visit(c, m, node.name ?? parentName, guard);
    guard.delete(nodeIdx);
  };
  const roots = json.scenes?.[json.scene ?? 0]?.nodes
    ?? (json.nodes || []).map((_, i) => i).filter((i) => !(json.nodes || []).some((n) => n.children?.includes(i)));
  for (const r of roots) visit(r, IDENT, null, new Set());
  nodes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const bounds = nodes.length ? nodes.slice(1).reduce((acc, n) => merge(acc, n), { min: [...nodes[0].min], max: [...nodes[0].max] }) : { min: [0, 0, 0], max: [0, 0, 0] };
  return {
    nodes,
    bounds: { min: bounds.min.map(r4), max: bounds.max.map(r4), size: sizeOf(bounds).map(r4) },
    triangles: nodes.reduce((s, n) => s + n.triangles, 0),
    meshNodes: nodes.length,
  };
}

/**
 * pickLandmark(inventory) → { name, min, max, size, asymmetry } | null — the node whose
 * centre sits farthest off the model's centre, relative to the model's size. A mirrored
 * import flips that offset's sign on the mirrored axis; a centred node cannot show it,
 * so `asymmetry` says how much the frame check is worth (0 ⇒ size-only). Slivers under
 * 1% of the model are not candidates. Deterministic: ties break by name.
 */
export function pickLandmark(inventory) {
  const { nodes, bounds } = inventory;
  if (!nodes.length) return null;
  const S = bounds.size;
  const longest = Math.max(...S, 1e-9);
  const C = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
  let best = null;
  for (const n of nodes) {
    if (Math.max(...n.size) < longest * 0.01) continue;
    const c = n.min.map((v, i) => (v + n.max[i]) / 2);
    const asym = Math.max(...c.map((v, i) => Math.abs(v - C[i]) / Math.max(S[i], 1e-9)));
    if (!best || asym > best.asymmetry + 1e-9 || (Math.abs(asym - best.asymmetry) <= 1e-9 && n.name < best.name)) {
      best = { name: n.name, min: n.min, max: n.max, size: n.size, asymmetry: r4(asym) };
    }
  }
  if (!best) {
    const n = [...nodes].sort((a, b) => Math.max(...b.size) - Math.max(...a.size))[0];
    best = { name: n.name, min: n.min, max: n.max, size: n.size, asymmetry: 0 };
  }
  return best;
}

// Blender object names are ≤ 63 bytes and dedupe as `name.001`; match the pack's node
// name to a report object exactly, else by that spelling, else by the 63-byte cut.
function matchObject(name, objects) {
  const byName = new Map(objects.map((o) => [o.name, o]));
  if (byName.has(name)) return byName.get(name);
  const cut = Buffer.from(name, 'utf8').subarray(0, 63).toString('utf8');
  if (cut !== name && byName.has(cut)) return byName.get(cut);
  return objects.find((o) => /\.\d{3}$/.test(o.name) && o.name.replace(/\.\d{3}$/, '') === name) ?? null;
}

const within = (a, b, eps) => a.every((v, i) => Math.abs(v - b[i]) <= eps);

/**
 * compareBlenderPack({ pack, report, tolerance }) → { ok, epsilon, checks, drift }
 * `pack` is pack.json (nodes / collections / landmark / meters_per_unit / glb); `report`
 * is import_mojulo.py's verify JSON (objects with world bbox + collections, the
 * collection list, shading, unit settings, scene camera).
 */
export function compareBlenderPack({ pack, report, tolerance = null } = {}) {
  const objects = Array.isArray(report?.objects) ? report.objects.filter((o) => o.type === 'MESH') : [];
  const longest = Math.max(...(pack?.bounds?.size ?? [0]), 1e-9);
  const eps = tolerance ?? pack?.epsilon ?? Math.max(0.01 / (pack?.meters_per_unit || 1), longest * 1e-3);
  const checks = {};
  const drift = [];

  const nodes = Array.isArray(pack?.nodes) ? pack.nodes : [];
  const matched = [];
  const missing = [];
  for (const n of nodes) {
    const o = matchObject(n.name, objects);
    if (o) matched.push([n, o]); else missing.push(n.name);
  }
  checks.objects_present = { expected: nodes.length, got: matched.length, missing, ok: report ? missing.length === 0 : null };

  let inBounds = 0;
  for (const [n, o] of matched) {
    if (!Array.isArray(o.bbox_min) || !Array.isArray(o.bbox_max)) continue;
    if (within(n.min, o.bbox_min, eps) && within(n.max, o.bbox_max, eps)) inBounds++;
    else drift.push({ name: n.name, expected: { min: n.min, max: n.max }, got: { min: o.bbox_min.map(r4), max: o.bbox_max.map(r4) } });
  }
  checks.node_bounds = { expected: matched.length, got: inBounds, epsilon: r4(eps), ok: report ? drift.length === 0 : null };

  const lm = pack?.landmark;
  if (lm) {
    const o = matchObject(lm.name, objects);
    const ok = o && Array.isArray(o.bbox_min) ? within(lm.min, o.bbox_min, eps) && within(lm.max, o.bbox_max, eps) : null;
    checks.landmark_frame = {
      name: lm.name, asymmetry: lm.asymmetry,
      expected: { min: lm.min, max: lm.max },
      got: o && Array.isArray(o.bbox_min) ? { min: o.bbox_min.map(r4), max: o.bbox_max.map(r4) } : null,
      ok: report ? (ok === null ? false : ok) : null,
      note: lm.asymmetry === 0 ? 'landmark is centred — a mirrored import cannot show here; size-only' : 'sign-sensitive — a mirrored import flips this box',
    };
  }

  const wantColls = Object.keys(pack?.collections ?? {});
  const gotColls = new Set(Array.isArray(report?.collections) ? report.collections : []);
  const missColls = wantColls.filter((c) => !gotColls.has(c));
  checks.collections = { expected: wantColls.length, got: wantColls.length - missColls.length, missing: missColls, ok: report ? missColls.length === 0 : null };

  const expectedTris = pack?.glb?.triangles ?? null;
  const gotTris = objects.length ? objects.reduce((s, o) => s + (o.triangles ?? 0), 0) : (report?.triangles ?? null);
  checks.triangles = { expected: expectedTris, got: gotTris, ok: report && expectedTris != null && gotTris != null ? gotTris === expectedTris : null };

  const wantColour = nodes.some((n) => n.vertexColour);
  checks.vertex_colours = { expected: wantColour, got: report?.vertex_colour_meshes ?? null, ok: report ? (!wantColour || (report.vertex_colour_meshes ?? 0) > 0) : null };

  if (report?.shading) {
    checks.shading = { expected: 'MATERIAL', got: report.shading.layout ?? null, color_type: report.shading.color_type ?? null, ok: report.shading.layout === 'MATERIAL' };
  }
  if (report?.unit) {
    const want = pack?.meters_per_unit ?? 1;
    checks.units = { expected: want, got: report.unit.scale_length ?? null, ok: Number.isFinite(report.unit.scale_length) ? Math.abs(report.unit.scale_length - want) < 1e-6 : false };
  }
  if (report) checks.framing_camera = { expected: 1, got: report.scene_camera ? 1 : 0, ok: !!report.scene_camera };

  const values = Object.values(checks).map((c) => c.ok).filter((v) => v !== null);
  return { ok: values.length > 0 && values.every(Boolean), epsilon: r4(eps), checks, drift: drift.slice(0, 20) };
}

/**
 * compareReturnContract({ pack, inventory, tolerance }) → { ok, epsilon, checks, contract_drift }
 * The RETURN half of the greybox contract (export-blender.plan.md B1, D4): what came home
 * (glbNodeInventory of the returned GLB) against what the pack declared. The contract
 * splits the mesh into a half that must not drift (node inventory, bounds, scale — form)
 * and a half that is free (colour, textures, surface detail), so drift is MEASURED and
 * NAMED as `contract_drift` rows — advisory, never a refusal; the operator may have had
 * reasons. `ok` means "no drift"; a bind proceeds either way.
 */
export function compareReturnContract({ pack, inventory, tolerance = null } = {}) {
  const longest = Math.max(...(pack?.bounds?.size ?? [0]), 1e-9);
  const eps = tolerance ?? pack?.epsilon ?? Math.max(0.01 / (pack?.meters_per_unit || 1), longest * 1e-3);
  const packNodes = Array.isArray(pack?.nodes) ? pack.nodes : [];
  const got = Array.isArray(inventory?.nodes) ? inventory.nodes : [];
  const drift = [];
  const claimed = new Set();
  const find = (name) => {
    const exact = got.find((n) => n.name === name && !claimed.has(n.name));
    if (exact) return exact;
    const cut = Buffer.from(name, 'utf8').subarray(0, 63).toString('utf8');
    return got.find((n) => !claimed.has(n.name) && (n.name === cut || n.name.replace(/\.\d{3}$/, '') === name)) ?? null;
  };
  let inBounds = 0;
  for (const n of packNodes) {
    const g = find(n.name);
    if (!g) { drift.push({ node: n.name, kind: 'missing', expected: { min: n.min, max: n.max } }); continue; }
    claimed.add(g.name);
    if (within(n.min, g.min, eps) && within(n.max, g.max, eps)) { inBounds++; continue; }
    const sizeDrift = n.size.some((v, i) => Math.abs(v - g.size[i]) > eps);
    drift.push({ node: n.name, kind: sizeDrift ? 'resized' : 'moved', expected: { min: n.min, max: n.max }, got: { min: g.min, max: g.max } });
  }
  for (const g of got) if (!claimed.has(g.name)) drift.push({ node: g.name, kind: 'unexpected', got: { min: g.min, max: g.max } });

  const checks = {};
  checks.node_inventory = { expected: packNodes.length, got: got.length, matched: claimed.size, in_bounds: inBounds, ok: drift.length === 0 };
  const lm = pack?.landmark;
  if (lm) {
    const g = find(lm.name) ?? got.find((n) => n.name === lm.name) ?? null;
    checks.landmark_frame = {
      name: lm.name, asymmetry: lm.asymmetry, expected: { min: lm.min, max: lm.max },
      got: g ? { min: g.min, max: g.max } : null,
      ok: g ? within(lm.min, g.min, eps) && within(lm.max, g.max, eps) : false,
      note: lm.asymmetry === 0 ? 'landmark is centred — a mirrored return cannot show here; size-only' : 'sign-sensitive — a mirrored return flips this box',
    };
  }
  if (pack?.bounds?.size && inventory?.bounds?.size) {
    const ratio = pack.bounds.size.map((v, i) => (v > eps ? r4(inventory.bounds.size[i] / v) : null));
    checks.scale = { expected: 1, got: ratio, ok: ratio.every((r) => r === null || Math.abs(r - 1) <= 0.02), note: 'per-axis size ratio, returned / declared — a unit slip shows as 100× or 0.01×, a mirror as 1 with a moved landmark' };
  }
  checks.triangles = { expected: pack?.glb?.triangles ?? null, got: inventory?.triangles ?? null, ok: null, note: 'informational — a sculpt or a decimate changes this legitimately' };
  const values = Object.values(checks).map((c) => c.ok).filter((v) => v !== null);
  return { ok: values.every(Boolean), epsilon: r4(eps), checks, contract_drift: drift.slice(0, 50) };
}
