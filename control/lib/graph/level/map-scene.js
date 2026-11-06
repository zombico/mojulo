/**
 * THE MAP'S PAGE — a map level (map.js) built as ONE world: each section built as its own stage would build it, then
 * placed on the level's ground (its frame turned to its heading and moved to its place, its heights met at the gate it
 * leaves from) and composed with the rest into one payload. Nothing in a section is rebuilt for the map: a trail on a
 * map is the trail its own page would be, so every trail keeps its craft, and a chain's seams meet as they always did.
 *
 *   assembleMapScene(manifest, ctx) → a world payload: every section's faces, repeats, cutouts, lights, anchors and
 *     colliders on the level's ground; the sky, the light, the walk and the cameras the root's (a junction's, the first
 *     trail's); `map`: { order, places, bands, sections } for what reads the map (its laws, the game).
 *
 * A JUNCTION is built here: a flat disc of the paving its `surface` names, its rim easing into the ground of the arms.
 *
 * THE LAND BETWEEN: a section owns its band only (what its page lays past it, its apron, is dropped). The map fills the
 * rest with land on a coarse grid over the whole map, its heights blended from what the bands' own ground stands at along
 * their edges (a cliff's top, an open meadow's rim, a junction's paving), easing toward their mean far out; where a cell
 * reaches into a band it is tucked a little under the band's own ground, so the seam has no gap and no flicker. The
 * root's horizon (its far ridges and clouds) is moved to ring the whole map, pushed out past it.
 * Heights: the root stands at 0; a trail off a gate is lifted so its path's first point stands at the junction's
 * height; a trail after a trail keeps its parent's lift (a seam is built in heights already); a junction a trail
 * arrives at stands at that trail's far end.
 *
 * Turned frames: a face's corners and normal, a repeat's instances (their place and turn), an anchor's place and facing,
 * a light's place, all turned exactly. A collider (an axis-aligned box) on a frame turned off the axes is laid as a run
 * of short boxes along its length, each the box round its stretch, so every reader of colliders reads them as before.
 */
import { readLevel } from './graph.js';
import { mapLevel, placeOf } from './map.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;
// a section's frame on the level: its turn (φ = heading − 90°: its +y onto its heading) and its lift
function frameOf(place, lift) {
  const phi = place.heading - Math.PI / 2, c = Math.cos(phi), s = Math.sin(phi);
  const P = (p) => { const q = placeOf(place, p); return [r5(q[0]), r5(q[1]), r5((p[2] ?? 0) + lift)]; };
  const V = (v) => [r5(v[0] * c - v[1] * s), r5(v[0] * s + v[1] * c), v[2]];
  return { phi, lift, P, V, aligned: Math.abs(Math.sin(2 * phi)) < 1e-5 };
}

// the ground's height at (x, y) of a section's own payload: the ground faces' corners near it, weighted by nearness
function groundAt(payload, x, y) {
  let w = 0, z = 0;
  for (const f of payload.faces || []) {
    if (!f.group || !/ground|trail|path|walk/.test(f.group) || !f.corners) continue;
    const c = f.corners;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of c) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    if (x < x0 - 0.5 || x > x1 + 0.5 || y < y0 - 0.5 || y > y1 + 0.5) continue;
    for (const p of c) { const k = 1 / (0.05 + Math.hypot(p[0] - x, p[1] - y)); w += k; z += k * p[2]; }
  }
  return w ? z / w : 0;
}

// the BACKDROP a trail's page rings itself with (its far ridges, its clouds): the map's root keeps its own, the rest drop
// theirs (one horizon a page)
const BACKDROP = /:(ridge|cloud)$/;
// a section's payload moved onto the level: its faces, repeats, cutouts, lights, anchors and colliders. `band` (a trail's
// own [x0, x1, D]): what lies past it (the apron a page lays so its edge never shows) is the map's to fill, so a face or
// an instance whose centre stands outside the band is dropped; `backdrop`: the far ridges and clouds kept or dropped
function placed(payload, F, node, { band = null, backdrop = true } = {}) {
  const inBand = (x, y) => !band || (x >= band[0] && x <= band[1] && y >= 0 && y <= band[2]);
  const keepFace = (f) => {
    if (f.group && BACKDROP.test(f.group)) return backdrop;
    let x = 0, y = 0; for (const c of f.corners) { x += c[0]; y += c[1]; }
    return inBand(x / f.corners.length, y / f.corners.length);
  };
  const face = (f) => ({ ...f, corners: f.corners.map(F.P), ...(f.normal ? { normal: F.V(f.normal) } : {}), ...(f.outNormal ? { outNormal: F.V(f.outNormal) } : {}) });
  const out = {
    faces: (payload.faces || []).filter(keepFace).map(face),
    repeats: (payload.repeats || []).map((r) => ({ ...r, transforms: r.transforms.filter((t) => inBand(t.pos[0], t.pos[1])).map((t) => ({ ...t, pos: F.P(t.pos), rotZ: r5((t.rotZ || 0) + F.phi) })) })).filter((r) => r.transforms.length),
    lights: (payload.lights || []).map((l) => ({ ...l, ...(Array.isArray(l.pos) ? { pos: F.P(l.pos) } : {}), ...(Array.isArray(l.at) ? { at: F.P(l.at) } : {}) })),
    anchors: (payload.anchors || []).map((a) => ({ ...a, node, ...(Array.isArray(a.at) ? { at: F.P(a.at) } : {}), ...(Array.isArray(a.N) ? { N: F.V(a.N) } : {}) })),
    colliders: [],
  };
  for (const b of payload.colliders || []) {
    if (!Array.isArray(b.min) || !Array.isArray(b.max)) { out.colliders.push(b); continue; }
    const corners = [[b.min[0], b.min[1]], [b.max[0], b.min[1]], [b.max[0], b.max[1]], [b.min[0], b.max[1]]];
    if (F.aligned) {
      const q = corners.map((p) => F.P([p[0], p[1], 0]));
      out.colliders.push({ ...b, min: [Math.min(...q.map((p) => p[0])), Math.min(...q.map((p) => p[1])), r5(b.min[2] + F.lift)], max: [Math.max(...q.map((p) => p[0])), Math.max(...q.map((p) => p[1])), r5(b.max[2] + F.lift)] });
      continue;
    }
    // (turned off the axes: a run of short boxes along its long side, each the box round its stretch)
    const lx = b.max[0] - b.min[0], ly = b.max[1] - b.min[1], along = lx >= ly ? 0 : 1, len = Math.max(lx, ly), thick = Math.min(lx, ly);
    const n = Math.max(1, Math.ceil(len / Math.max(0.5, thick * 2)));
    for (let k = 0; k < n; k++) {
      const a0 = b.min[along] + (len * k) / n, a1 = b.min[along] + (len * (k + 1)) / n;
      const lo = along === 0 ? [a0, b.min[1]] : [b.min[0], a0], hi = along === 0 ? [a1, b.max[1]] : [b.max[0], a1];
      const q = [[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]].map((p) => F.P([p[0], p[1], 0]));
      out.colliders.push({ ...b, min: [r5(Math.min(...q.map((p) => p[0]))), r5(Math.min(...q.map((p) => p[1]))), r5(b.min[2] + F.lift)], max: [r5(Math.max(...q.map((p) => p[0]))), r5(Math.max(...q.map((p) => p[1]))), r5(b.max[2] + F.lift)], ...(b.of ? { of: `${b.of}:${k}` } : {}) });
    }
  }
  return out;
}

// a JUNCTION's own ground: a flat disc of paving, its rim a ring easing out into the land round it
const SURFACES = Object.freeze({ paving: '#b4a68c', earth: '#9c8463', grass: '#7aa04a', cobbles: '#8f8a80' });
function junctionPayload(J, z, fill) {
  const R = J.radius, rings = Math.max(4, Math.round(R / 3)), seg = 48, faces = [], paving = SURFACES[J.surface] ?? SURFACES.paving;
  const at = (r, a, h) => [r5(r * Math.cos(a)), r5(r * Math.sin(a)), r5(h)];
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const r0 = (R * i) / rings, r1 = (R * (i + 1)) / rings, a0 = (j / seg) * 2 * Math.PI, a1 = ((j + 1) / seg) * 2 * Math.PI;
    faces.push({ corners: [at(r0, a0, z), at(r1, a0, z), at(r1, a1, z), at(r0, a1, z)], normal: [0, 0, 1], group: 'map:junction', fill: paving });
  }
  // (the rim: two metres out, a little below, in the land's own colour, so an arm's ground meets it softly)
  for (let j = 0; j < seg; j++) {
    const a0 = (j / seg) * 2 * Math.PI, a1 = ((j + 1) / seg) * 2 * Math.PI;
    faces.push({ corners: [at(R, a0, z), at(R + 2, a0, z - 0.1), at(R + 2, a1, z - 0.1), at(R, a1, z)], normal: [0, 0, 1], group: 'map:junction-rim', fill: fill || paving });
  }
  return { faces, anchors: [{ id: 'junction', kind: 'junction', at: [0, 0, z] }] };
}

// the ground faces' corners of the placed map, hashed by 2 m cells, for the height the map's own ground stands at
function groundIndex(faces) {
  const H = new Map(), key = (x, y) => `${Math.floor(x / 2)},${Math.floor(y / 2)}`;
  for (const f of faces) {
    if (!f.group || !/ground|trail|junction|cliff|lip|scree/.test(f.group) || /rim$/.test(f.group)) continue;
    for (const c of f.corners) { const k = key(c[0], c[1]); (H.get(k) ?? H.set(k, []).get(k)).push(c); }
  }
  return (x, y, r = 2.5) => {
    let w = 0, z = 0;
    for (let i = Math.floor((x - r) / 2); i <= Math.floor((x + r) / 2); i++) for (let j = Math.floor((y - r) / 2); j <= Math.floor((y + r) / 2); j++) {
      for (const c of H.get(`${i},${j}`) ?? []) { const d = Math.hypot(c[0] - x, c[1] - y); if (d > r) continue; const k = 1 / (0.05 + d * d); w += k; z += k * c[2]; }
    }
    return w ? z / w : null;
  };
}
const inPoly = (P, x, y) => { let inside = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const hash2 = (i, j) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const tint = (hex, k) => { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k)))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };

// THE LAND BETWEEN the bands: a 4 m grid over the map and a margin round it, heights from the bands' edges
const LAND = Object.freeze({ cell: 4, margin: 70, step: 3, near: 10, tuck: 0.08 });
function landBetween(faces, bands, fill) {
  const at = groundIndex(faces), polys = Object.values(bands);
  // the edge samples: every `step` metres round every band, the height its own ground stands at there
  const samples = [];
  for (const P of polys) for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / LAND.step));
    for (let k = 0; k < n; k++) { const x = a[0] + ((b[0] - a[0]) * k) / n, y = a[1] + ((b[1] - a[1]) * k) / n, z = at(x, y, 4); if (z !== null) samples.push([x, y, z]); }
  }
  if (!samples.length) return [];
  const mean = samples.reduce((s, p) => s + p[2], 0) / samples.length;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const P of polys) for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0 = Math.floor((x0 - LAND.margin) / LAND.cell) * LAND.cell; y0 = Math.floor((y0 - LAND.margin) / LAND.cell) * LAND.cell;
  const nx = Math.ceil((x1 + LAND.margin - x0) / LAND.cell), ny = Math.ceil((y1 + LAND.margin - y0) / LAND.cell);
  const inside = (x, y) => polys.some((P) => inPoly(P, x, y));
  // a corner's height: under a band, its own ground less the tuck; outside, the edges' heights by nearness (the nearest
  // rules, inverse to the cube of the distance), easing to their mean far out, with a little roll of its own
  const H = new Float64Array((nx + 1) * (ny + 1)), IN = new Uint8Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * LAND.cell, y = y0 + j * LAND.cell, k = j * (nx + 1) + i;
    if (inside(x, y)) { const z = at(x, y, 3); IN[k] = 1; if (z !== null) { H[k] = z - LAND.tuck; continue; } }
    let w = 0, z = 0, dmin = Infinity;
    // (the nearest edge rules: a cliff top ten metres off weighs a thousandth of a paving's edge one metre off)
    for (const p of samples) { const d = Math.hypot(p[0] - x, p[1] - y); dmin = Math.min(dmin, d); const q = 1 / (0.5 + d) ** 3; w += q; z += q * p[2]; }
    const near = z / w, far = Math.min(1, Math.max(0, (dmin - LAND.near) / 60));
    // (within two cells of a band it lies under it, its roll stilled, so a cell reaching over a band's edge is beneath it)
    const still = Math.min(1, Math.max(0, (dmin - 2 * LAND.cell) / LAND.near));
    H[k] = near * (1 - far) + mean * far + (hash2(i, j) - 0.5) * 0.6 * still - LAND.tuck * 1.5 * Math.max(0, 1 - dmin / (2 * LAND.cell));
  }
  const out = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const ks = [j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i];
    if (ks.every((k) => IN[k])) continue;   // (wholly under a band: the band's own)
    const c = ks.map((k, q) => [r5(x0 + (i + (q === 1 || q === 2 ? 1 : 0)) * LAND.cell), r5(y0 + (j + (q >= 2 ? 1 : 0)) * LAND.cell), r5(H[k])]);
    const u = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], v = [c[3][0] - c[0][0], c[3][1] - c[0][1], c[3][2] - c[0][2]];
    const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], L = Math.hypot(...nrm) || 1;
    // (its colour by corner, a soft wash over the grid, never a checker)
    const cf = ks.map((k, q) => tint(fill, 0.93 + 0.1 * hash2(i + (q === 1 || q === 2 ? 1 : 0) + 7, j + (q >= 2 ? 1 : 0) + 3)));
    out.push({ corners: c, normal: nrm.map((t) => r5(t / L)), group: 'map:land', fill, cornerFills: cf });
  }
  return out;
}
// the root's horizon moved to ring the whole map: its centre on the map's, pushed out past the farthest band
function ringTheMap(faces, bands) {
  const back = faces.filter((f) => f.group && BACKDROP.test(f.group));
  if (!back.length) return;
  let cx = 0, cy = 0, n = 0;
  for (const f of back) for (const c of f.corners) { cx += c[0]; cy += c[1]; n++; }
  cx /= n; cy /= n;
  // (the ring's own radius: its ridges' median distance from its centre)
  const rr = []; for (const f of back) if (/ridge$/.test(f.group)) for (const c of f.corners) rr.push(Math.hypot(c[0] - cx, c[1] - cy));
  rr.sort((a, b) => a - b);
  const r0 = rr.length ? rr[rr.length >> 1] : Infinity;
  let mx = 0, my = 0, m = 0; for (const P of Object.values(bands)) for (const [x, y] of P) { mx += x; my += y; m++; }
  mx /= m; my /= m;
  let reach = 0; for (const P of Object.values(bands)) for (const [x, y] of P) reach = Math.max(reach, Math.hypot(x - mx, y - my));
  const k = Number.isFinite(r0) && r0 < reach + LAND.margin + 40 ? (reach + LAND.margin + 40) / r0 : 1;
  for (const f of back) f.corners = f.corners.map((c) => [r5(mx + (c[0] - cx) * k), r5(my + (c[1] - cy) * k), c[2]]);
}

export async function assembleMapScene(m, ctx = {}, { buildStage } = {}) {
  if (!m || !m.level) throw new Error('map: a map is { level: <a level laid as a map> }');
  const L = mapLevel(readLevel({ ...m.level, layout: 'map' }));
  const build = buildStage ?? (async (manifest) => (await import('../worlds/world-kinds.js')).WORLD_KINDS.stage.resolve(manifest, ctx));
  const byNode = {}, lifts = {}, sections = [];
  const out = { faces: [], repeats: [], cutouts: [], lights: [], anchors: [], colliders: [], textures: {}, resample: {} };
  let root = null, landFill = null;
  for (const S of L.stages) {
    const e = L.edges.find((x) => x.to === S.node), parent = e ? e.from : null;
    let payload, lift;
    if (S.section === 'junction') {
      // (the root stands at 0; one a trail arrives at, at that trail's far end)
      let z = 0;
      if (parent && byNode[parent]) { const E = L.ends[parent]; z = groundAt(byNode[parent], E.x1, E.D - 0.25) + lifts[parent]; }
      payload = junctionPayload(L.junctions[S.node], 0, landFill);
      lift = z;
      // (a junction's frame: centred on its place, its own heading)
      byNode[S.node] = payload; lifts[S.node] = lift;
      const F = frameOf({ at: S.place.at, heading: S.place.heading }, lift), P = placed(payload, F, S.node);
      for (const k of ['faces', 'anchors']) out[k].push(...P[k]);
      sections.push({ node: S.node, section: 'junction', place: S.place, lift: r5(lift) });
      continue;
    }
    payload = await build(S.manifest);
    byNode[S.node] = payload;
    if (!landFill) landFill = (payload.faces || []).find((f) => f.group && /ground/.test(f.group))?.fill ?? null;
    // the lift: off a gate, its path's first point at the junction's height; after a trail, the trail's own
    if (!parent) lift = 0;
    else if (L.junctions[parent]) lift = lifts[parent] - groundAt(payload, L.ends[S.node].x0, 0.25);
    else lift = lifts[parent];
    lifts[S.node] = lift;
    const E = L.ends[S.node], F = frameOf(S.place, lift), P = placed(payload, F, S.node, { band: [E.band[0], E.band[1], E.D], backdrop: !root });
    for (const k of ['faces', 'repeats', 'lights', 'anchors', 'colliders']) out[k].push(...P[k]);
    for (const c of payload.cutouts || []) if (!out.cutouts.includes(c)) out.cutouts.push(c);
    Object.assign(out.textures, payload.textures || {});
    Object.assign(out.resample, payload.resample || {});
    if (!root) root = { payload, F, node: S.node };
    sections.push({ node: S.node, section: 'trail', place: S.place, lift: r5(lift), ...(payload.outTrail ? { outTrail: payload.outTrail } : {}) });
  }
  // the land between the bands, and the horizon round the map
  out.faces.push(...landBetween(out.faces, L.bands, landFill || '#7aa04a'));
  ringTheMap(out.faces, L.bands);
  // the page's own: the sky, light and paint of the first trail built; the walk from the root's spawn (a junction's
  // centre, else the first trail's own spawn), its cameras the first trail's
  const R = root.payload, keep = ['viewBox', 'bg', 'haze', 'sky', 'glow', 'pack', 'ao', 'fabric', 'vertexContrast', 'creases', 'occlusion', 'painted', 'shadows', 'lightTier', 'nonBakeable', 'weather'];
  const page = Object.fromEntries(keep.filter((k) => R[k] !== undefined).map((k) => [k, R[k]]));
  const rootIsJunction = !!L.junctions[L.root];
  const spawn = rootIsJunction ? [0, 0, r5(lifts[L.root] + (R.walk?.minEye ?? 1.7))] : R.walk?.spawn ? root.F.P(R.walk.spawn) : [0, 0, 1.7];
  return {
    ...page,
    title: ctx.title || 'mojulo map',
    ...out,
    textures: Object.keys(out.textures).length ? out.textures : undefined,
    resample: Object.keys(out.resample).length ? out.resample : undefined,
    cameras: (R.cameras || []).map((c) => c.worldFraming ? { ...c, worldFraming: { ...c.worldFraming, cameraPosition: root.F.P(c.worldFraming.cameraPosition), lookAt: root.F.P(c.worldFraming.lookAt) } } : c),
    walk: { ...(R.walk || {}), spawn },
    map: { order: L.order, places: L.places, bands: L.bands, gates: L.gates, sections },
  };
}
