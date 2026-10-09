/**
 * FROM A FLOORMAP — the walkmesh a floormap (era/floormap.js) makes: one plate per camera, all in one space, each
 * holding its camera's zone, so the figure walks one floor and the shot cuts as it crosses a zone line. Nothing is
 * traced: a baked plate freezes the floormap's greybox; a painted plate (an image handed in for that camera) gets its
 * floor, holes, occluders, exits and spawns projected from the floormap through the camera it was painted over.
 *
 *   walkmeshOfFloormap(manifest, { images, size })   → a walkmesh manifest (readWalkmesh reads it; resolveBakes
 *                                                      freezes its baked plates)
 *   OCCLUDES                                          a block this tall hides the figure (a stand always does)
 */
import { readFloormap, footprint, inPoly, edgeDist, triggerArea } from '../../era/floormap.js';
import { floormapCameras } from '../../era/floormap-cameras.js';
import { bakedFraming, plateBasis, project } from './camera.js';
import { clipNear } from './geom.js';
import { BAKE_SIZE } from './walkmesh.js';

export const OCCLUDES = 1.2;
const SPACE = 'floormap';
const r2 = (n) => Math.round(n * 100) / 100 + 0;

// a world polygon through the camera: cut at the near plane, projected, cut to the frame
function seen(B, poly3, [W, H]) {
  let q = clipNear(B, poly3).map((P) => project(B, P)).filter(Boolean).map((x) => x.px);
  for (const [axis, lim, keepLess] of [[0, 0, false], [0, W, true], [1, 0, false], [1, H, true]]) {
    const out = [], inside = (p) => (keepLess ? p[axis] <= lim : p[axis] >= lim);
    for (let i = 0; i < q.length; i++) {
      const P = q[i], Q = q[(i + 1) % q.length];
      if (inside(P)) out.push(P);
      if (inside(P) !== inside(Q)) { const t = (lim - P[axis]) / (Q[axis] - P[axis]); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
    }
    q = out;
  }
  return q.length >= 3 ? q.map((p) => p.map(r2)) : null;
}

// a plate segment cut to the frame (Liang–Barsky), or null when it misses it
function clipSeg([a, b], [W, H]) {
  let t0 = 0, t1 = 1;
  const d = [b[0] - a[0], b[1] - a[1]];
  for (const [p, q] of [[-d[0], a[0]], [d[0], W - a[0]], [-d[1], a[1]], [d[1], H - a[1]]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [[a[0] + d[0] * t0, a[1] + d[1] * t0], [a[0] + d[0] * t1, a[1] + d[1] * t1]];
}

// the convex hull of points (monotone chain), counter-clockwise
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}

export function walkmeshOfFloormap(manifest, { images = {}, size = [...BAKE_SIZE] } = {}) {
  const fm = readFloormap(manifest), cams = floormapCameras(fm, manifest.cameras), zOf = new Map(fm.regions.map((r) => [r.id, r.z]));
  const exitPieces = fm.pieces.filter((p) => p.kind === 'exit');
  const plates = cams.map((cam) => {
    const zone = cam.zone.poly, z = zOf.get(cam.zone.region), near = (q) => inPoly(q, zone) || edgeDist(q, zone) < 0.3;
    const camera = { at: cam.framing.cameraPosition, look: cam.framing.lookAt, fov: cam.framing.horizontalFov };
    // one exit per id: its longest piece in this zone
    const byId = new Map();
    for (const p of exitPieces) {
      const m = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2], L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
      if (near(m) && (!byId.has(p.id) || L > byId.get(p.id).L)) byId.set(p.id, { p, L });
    }
    const exitsM = [...byId.values()].map(({ p }) => ({ id: p.id, edge: [p.a, p.b], to: p.to }));
    const spawnsM = fm.items.filter((it) => it.kind === 'spawn' && near(it.at)).map((it) => ({ id: it.id, at: it.at, face: it.face }));
    const common = { id: cam.id, space: SPACE, zone };
    if (!images[cam.id]) return { ...common, baked: { floormap: manifest, camera, size }, exits: exitsM, spawns: spawnsM };
    const B = plateBasis(bakedFraming(camera, size), size), px = (q, zz = z) => (project(B, [q[0], q[1], zz]) || {}).px || null;
    const floor = fm.regions.map((r) => ({ id: r.id, poly: seen(B, r.poly.map(([x, y]) => [x, y, r.z]), size) })).filter((f) => f.poly);
    const solids = fm.items.filter((it) => footprint(it));
    const holes = solids.map((it) => seen(B, footprint(it).map(([x, y]) => [x, y, it.z]), size)).filter(Boolean);
    const occluders = solids.filter((it) => it.kind === 'stand' || it.h >= OCCLUDES).map((it) => {
      const f = footprint(it), corners = [...f.map(([x, y]) => [x, y, it.z]), ...f.map(([x, y]) => [x, y, it.z + it.h])];
      const pts = clipNear(B, corners).map((P) => project(B, P)).filter(Boolean).map((x) => x.px), foot = f.map((q) => px(q, it.z)).filter(Boolean);
      return pts.length >= 3 && foot.length ? { id: it.id, poly: hull(pts).map((p) => p.map(r2)), base: r2(Math.max(...foot.map((q) => q[1]))) } : null;
    }).filter(Boolean);
    // an exit is the part of its edge the frame shows (the floor is cut to the frame too)
    const exits = exitsM.map((e) => {
      const ends = clipNear(B, e.edge.map(([x, y]) => [x, y, z])).map((P) => project(B, P)).filter(Boolean).map((x) => x.px), seg = ends.length >= 2 ? clipSeg([ends[0], ends[ends.length - 1]], size) : null;
      return seg ? { ...e, edge: seg.map((q) => q.map(r2)) } : null;
    }).filter(Boolean);
    const spawns = spawnsM.map((s) => ({ ...s, at: px(s.at) })).filter((s) => s.at).map((s) => ({ ...s, at: s.at.map(r2) }));
    return { ...common, painted: { image: images[cam.id], size }, camera, floor, holes, occluders, exits, spawns };
  });
  const first = plates.find((p) => p.spawns.length);
  // the camera triggers, on the shared floor (an insert's plate is the trigger's own camera)
  const ids = new Set(plates.map((p) => p.id));
  const triggers = fm.items.filter((it) => it.kind === 'trigger' && it.cut && ids.has(typeof it.cut === 'string' ? it.cut : it.id)).map((it) => ({
    id: it.id, space: SPACE, area: triggerArea(it).map((q) => q.map(r2)), to: typeof it.cut === 'string' ? it.cut : it.id,
    ...(typeof it.cut === 'string' ? (it.from ? { from: it.from } : {}) : { insert: true }),
  }));
  return { kind: 'walkmesh', title: fm.title, start: first ? `${first.id}.${first.spawns[0].id}` : `${plates[0].id}.`, plates, ...(triggers.length ? { triggers } : {}) };
}
