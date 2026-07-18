/**
 * edifice — the bespoke-building assembler (dream-architecture.plan.md, track E).
 *
 * A bespoke INHABITABLE building authored as a GRAPH: a set of MASSES connected by
 * CONCOURSES, composed by RELATION (mass B sits east of mass A), not coordinates. This
 * is the "workbench for buildings" — the metaprinciple (recipe → plan → baked
 * flat-Lambert faces) applied to arbitrary buildings the frozen generators
 * (fractal-city/school/hub) don't produce.
 *
 * Two entry points, both pure:
 *   planEdifice(recipe)            → the plan-is-truth IR (masses + concourses + envelopes)
 *   buildEdificeFaces(plan, opts)  → { faces, textures } for the World renderers
 * plus advisory assessEdifice(plan) — SURFACED, never enforced (a user's building is
 * theirs; see the doctrine section of the plan).
 *
 * E1 scope: relative placement, concourse derivation with real DOORWAY PUNCHES (a
 * concourse cuts a ground-floor opening, not the whole wall), facade-card exterior
 * skin, roof cappers, and the `open` interior kernel (a walkable hollow shell). The
 * `suite` / `chambers` interior kernels + the full four-check assessment suite are
 * later increments (E3/E6).
 */

import { makeLight, litFactor } from '../polygonizer/vexar.js';
import { boxFaces } from './condo-entrance.js';
import { buildFacadeCard, projectCardOntoQuad } from './facade-card.js';
import { buildRoof } from './roof.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { planSuite, buildSuiteFaces } from './suite-layout.js';

export const FLOOR_FT = 11;      // one storey
const BAY_FT = 8;                // facade bay pitch → bay count
const DOOR_FT = 9;               // doorway head height
const RELIEF = 0.5;              // facade shirt thickness (recess depth)
const WALL_T = 0.4;              // corridor wall thickness
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Roof names the recipe uses → roof.js STYLE keys ('flat' is the one alias).
const roofStyle = (roof) => (roof === 'flat' || roof == null ? 'tofu-deck' : roof);

// ── planEdifice: recipe → plan-is-truth IR ──────────────────────────────────
export function planEdifice(recipe) {
  if (!recipe || !Array.isArray(recipe.masses) || !recipe.masses.length) {
    throw new Error('planEdifice: recipe.masses must be a non-empty array');
  }
  const byId = new Map();
  const masses = [];
  // 1) topological placement: roots (`at`) first, then `on` masses once their anchor lands.
  const pending = recipe.masses.slice();
  let guard = 0;
  while (pending.length) {
    if (guard++ > recipe.masses.length * recipe.masses.length + 4) {
      throw new Error(`planEdifice: unresolved placement (cycle or missing anchor) among [${pending.map((m) => m.id).join(', ')}]`);
    }
    const m = pending.shift();
    let x, y;
    if (m.at) { [x, y] = m.at; }
    else if (m.on) {
      const a = byId.get(m.on.anchor);
      if (!a) { pending.push(m); continue; }              // anchor not placed yet → retry later
      const { side, align = 'center', gap = 0 } = m.on;
      const { w, d } = m.footprint;
      if (side === 'E') { x = a.x1 + gap; y = alignAlong(a, 'y', d, align); }
      else if (side === 'W') { x = a.x0 - gap - w; y = alignAlong(a, 'y', d, align); }
      else if (side === 'N') { y = a.y1 + gap; x = alignAlong(a, 'x', w, align); }
      else if (side === 'S') { y = a.y0 - gap - d; x = alignAlong(a, 'x', w, align); }
      else throw new Error(`planEdifice: mass '${m.id}' on.side must be N|S|E|W (got '${side}')`);
    } else {
      throw new Error(`planEdifice: mass '${m.id}' needs an 'at':[x,y] or an 'on':{anchor,side} placement`);
    }
    const { w, d } = m.footprint;
    const z1 = Math.max(1, m.floors || 1) * FLOOR_FT;
    const node = {
      id: m.id, x0: x, y0: y, x1: x + w, y1: y + d, z0: 0, z1, w, d,
      cx: x + w / 2, cy: y + d / 2, floors: Math.max(1, m.floors || 1),
      form: m.form || 'rect', facade: m.facade, roof: m.roof ?? 'flat',
      interior: m.interior || { kernel: 'open' }, openings: [],
    };
    byId.set(m.id, node); masses.push(node);
  }
  // 2) concourses: derive each hall from the two masses' facing walls + the gap, and record
  //    an opening (with its world cross-span) on each facing wall so the facade can be PUNCHED.
  const concourses = (recipe.concourses || []).map((c, i) => {
    const A = byId.get(c.from), B = byId.get(c.to);
    if (!A || !B) throw new Error(`planEdifice: concourse ${i} references missing mass '${!A ? c.from : c.to}'`);
    const f = facing(A, B);
    if (!f) throw new Error(`planEdifice: masses '${c.from}' and '${c.to}' overlap or share no facing wall — cannot derive a concourse`);
    const width = c.width || 10;
    const crossMid = (f.cross[0] + f.cross[1]) / 2;
    const overlap = f.cross[1] - f.cross[0];
    if (overlap < width * 0.5) throw new Error(`planEdifice: concourse '${c.from}'→'${c.to}' has too little wall overlap (${overlap.toFixed(1)}ft) for width ${width}ft`);
    const half = Math.min(width, overlap) / 2;
    const z1 = FLOOR_FT;                                  // single-storey covered hall
    const span = [crossMid - half, crossMid + half];
    const hall = f.axis === 'x'
      ? { x0: f.along[0], x1: f.along[1], y0: span[0], y1: span[1], z0: 0, z1 }
      : { x0: span[0], x1: span[1], y0: f.along[0], y1: f.along[1], z0: 0, z1 };
    A.openings.push({ side: f.aSide, span });
    B.openings.push({ side: f.bSide, span });
    return { id: `c${i}`, from: c.from, to: c.to, axis: f.axis, hall, aSide: f.aSide, bSide: f.bSide };
  });
  // 3) structureEnvelopes: the solid masses (+ hall strips), each with a top z — derived ONCE,
  //    the single source a facade march / roof / fog / livability probe reads.
  const envelopes = [
    ...masses.map((m) => ({ id: m.id, kind: 'mass', x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, top: m.z1 })),
    ...concourses.map((c) => ({ id: c.id, kind: 'hall', ...c.hall, top: c.hall.z1 })),
  ];
  const xs = envelopes.flatMap((e) => [e.x0, e.x1]), ys = envelopes.flatMap((e) => [e.y0, e.y1]);
  const bounds = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const entranceId = recipe.entrance || masses[0].id;
  const ent = byId.get(entranceId);
  if (!ent) throw new Error(`planEdifice: entrance '${entranceId}' is not a mass`);
  return {
    kind: 'edifice', seed: recipe.seed ?? 1, theme: recipe.theme || 'earth-temperate',
    masses, concourses, envelopes, bounds, entranceId,
    spawn: [ent.cx, ent.y0 - 18, 1.6],
  };
}

// align a placed mass along the shared edge: axis 'y' (E/W placements) or 'x' (N/S).
function alignAlong(a, axis, extent, align) {
  const lo = axis === 'y' ? a.y0 : a.x0, hi = axis === 'y' ? a.y1 : a.x1;
  if (align === 'S' || align === 'W' || align === 'start') return lo;
  if (align === 'N' || align === 'E' || align === 'end') return hi - extent;
  return (lo + hi) / 2 - extent / 2;                      // center
}

// which walls of A and B face each other, the gap span (along) and the shared overlap (cross).
// Returns null if the masses overlap on both axes (no clean facing wall).
export function facing(A, B) {
  const ov = (lo1, hi1, lo2, hi2) => [Math.max(lo1, lo2), Math.min(hi1, hi2)];
  if (B.x0 >= A.x1) return { aSide: 'E', bSide: 'W', axis: 'x', along: [A.x1, B.x0], cross: ov(A.y0, A.y1, B.y0, B.y1) };
  if (B.x1 <= A.x0) return { aSide: 'W', bSide: 'E', axis: 'x', along: [B.x1, A.x0], cross: ov(A.y0, A.y1, B.y0, B.y1) };
  if (B.y0 >= A.y1) return { aSide: 'N', bSide: 'S', axis: 'y', along: [A.y1, B.y0], cross: ov(A.x0, A.x1, B.x0, B.x1) };
  if (B.y1 <= A.y0) return { aSide: 'S', bSide: 'N', axis: 'y', along: [B.y1, A.y0], cross: ov(A.x0, A.x1, B.x0, B.x1) };
  return null;
}

// ── wall local frame: u along the wall (0..len), v up (0..z1); outward-normal ordered ──
function wallFrame(m, side) {
  switch (side) {
    case 'S': return { len: m.w, at: (u, v) => [m.x0 + u, m.y0, v], toU: (c) => c - m.x0, normal: [0, -1, 0] };
    case 'N': return { len: m.w, at: (u, v) => [m.x1 - u, m.y1, v], toU: (c) => m.x1 - c, normal: [0, 1, 0] };
    case 'E': return { len: m.d, at: (u, v) => [m.x1, m.y0 + u, v], toU: (c) => c - m.y0, normal: [1, 0, 0] };
    default:  return { len: m.d, at: (u, v) => [m.x0, m.y1 - u, v], toU: (c) => m.y1 - c, normal: [-1, 0, 0] };   // 'W'
  }
}

// project a facade card onto a sub-rectangle (u0..u1, v0..v1) of a wall.
function facadeSegment(fr, u0, u1, v0, v1, facade, light) {
  const worldW = u1 - u0, worldH = v1 - v0;
  if (worldW < 0.2 || worldH < 0.2) return [];
  const corners = [fr.at(u0, v0), fr.at(u1, v0), fr.at(u1, v1), fr.at(u0, v1)];
  const bays = Math.max(1, Math.round(worldW / BAY_FT));
  const rows = Math.max(2, Math.round(worldH / (FLOOR_FT / 2)));    // ~2 rows/storey → floor bands
  const card = buildFacadeCard(facade, rows, bays);
  const lit = Math.max(0.15, litFactor(fr.normal, light));
  return projectCardOntoQuad(corners, card, { lit, relief: RELIEF, light });
}

// one exterior wall, PUNCHED for any concourse openings on that side (left pier / right pier /
// lintel above the door; the ground-floor door span is left as a real gap you walk through).
function wallFaces(m, side, facade, light) {
  const fr = wallFrame(m, side);
  const doors = m.openings.filter((o) => o.side === side).map((o) => {
    let a = fr.toU(o.span[0]), b = fr.toU(o.span[1]);
    if (a > b) [a, b] = [b, a];
    return [clamp(a, 0, fr.len), clamp(b, 0, fr.len)];
  }).sort((p, q) => p[0] - q[0]);
  if (!doors.length) return facadeSegment(fr, 0, fr.len, 0, m.z1, facade, light);
  const out = [];
  const doorH = Math.min(DOOR_FT, m.z1 - 0.5);
  let cursor = 0;
  for (const [a, b] of doors) {
    out.push(...facadeSegment(fr, cursor, a, 0, m.z1, facade, light));   // pier before the door
    out.push(...facadeSegment(fr, a, b, doorH, m.z1, facade, light));    // lintel above the door
    cursor = b;                                                          // door gap [a,b]×[0,doorH] stays open
  }
  out.push(...facadeSegment(fr, cursor, fr.len, 0, m.z1, facade, light)); // pier after the last door
  return out;
}

const translateFaces = (faces, dx, dy, dz) => faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x + dx, y + dy, z + dz]) }));

// The `suite` interior kernel: a linear chain of walkable rooms laid INSIDE a mass's
// ground floor (inset from the exterior facade, which stays the outer shell). Author the
// rooms via `mass.interior.volumes` (suite-layout volume specs), or a default room chain
// sized to the footprint is synthesized. Returns faces already translated into the mass.
function suiteInteriorFaces(m) {
  const t = 1.5;                                        // inset from the facade
  const iw = m.w - 2 * t, idd = m.d - 2 * t;
  if (iw < 4 || idd < 4) return [];
  let volumes = Array.isArray(m.interior?.volumes) ? m.interior.volumes : null;
  if (!volumes) {
    const n = Math.max(1, Math.min(4, Math.round(idd / 16)));
    const depth = idd / n;
    volumes = Array.from({ length: n }, (_, i) => ({
      id: `${m.id}_r${i}`, kind: 'room', width: iw, depth, heightFt: FLOOR_FT,
      vexar: { direction: [0.3, 0.4, -0.8], ambient: 0.64, diffuse: 0.4 }, tint: [0.96, 0.95, 0.92],
    }));
  }
  const plan = planSuite({ start: 0, roomWidth: iw, ceilingFt: FLOOR_FT, entryOpen: true, volumes });
  return translateFaces(buildSuiteFaces(plan), m.x0 + t, m.y0 + t, 0);
}

// ── buildEdificeFaces: plan → { faces, textures } (all pure) ─────────────────
export function buildEdificeFaces(plan, { light } = {}) {
  const L = light || makeLight({ direction: [0.36, 0.42, -0.83], ambient: 0.5, diffuse: 0.55 });
  const faces = [], textures = {};
  for (const m of plan.masses) {
    // floor slab (the `open` interior kernel: a walkable hollow shell on grade)
    faces.push(...boxFaces(m.x0, m.x1, m.y0, m.y1, -0.15, 0, '#7d7972', L, { top: true }));
    // exterior facade on all four walls, punched where concourses attach
    for (const side of ['S', 'N', 'E', 'W']) faces.push(...wallFaces(m, side, m.facade, L));
    // roof caps the footprint at the wall top
    const { faces: rf, textureKeys } = buildRoof({ x: m.x0, y: m.y0, w: m.w, d: m.d, z: m.z1 }, { style: roofStyle(m.roof), light: L });
    faces.push(...rf);
    for (const k of textureKeys) { const u = surfaceTexture(k); if (u) textures[k] = u; }
    // interior kernel: `open` (a bare shell — the mass IS the room) or `suite` (walkable rooms inside)
    if (m.interior?.kernel === 'suite') faces.push(...suiteInteriorFaces(m));
  }
  // concourses: covered corridor (floor + two side walls + flat cap); the ends open into the
  // punched doorways of both masses.
  for (const c of plan.concourses) {
    const h = c.hall;
    faces.push(...boxFaces(h.x0, h.x1, h.y0, h.y1, -0.15, 0, '#8d8881', L, { top: true }));   // floor
    if (c.axis === 'x') {
      faces.push(...boxFaces(h.x0, h.x1, h.y0, h.y0 + WALL_T, 0, h.z1, '#b8b2a6', L));
      faces.push(...boxFaces(h.x0, h.x1, h.y1 - WALL_T, h.y1, 0, h.z1, '#b8b2a6', L));
    } else {
      faces.push(...boxFaces(h.x0, h.x0 + WALL_T, h.y0, h.y1, 0, h.z1, '#b8b2a6', L));
      faces.push(...boxFaces(h.x1 - WALL_T, h.x1, h.y0, h.y1, 0, h.z1, '#b8b2a6', L));
    }
    faces.push(...boxFaces(h.x0, h.x1, h.y0, h.y1, h.z1, h.z1 + WALL_T, '#9aa0a6', L, { top: true })); // flat cap
  }
  return { faces, textures };
}

// ── assembleEdificeScene: manifest → World payload (the WORLD_KIND resolver) ──
// A day sun aimed across the footprint, for the soft diffusion + ground-shadow bake.
function daySun(b) {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, w = b.x1 - b.x0;
  const sx = b.x1 + w * 0.4, sy = b.y0 - (b.y1 - b.y0) * 0.6, sz = w * 1.2;
  const dx = cx - sx, dy = cy - sy, dz = -sz, dl = Math.hypot(dx, dy, dz) || 1;
  return { pos: [sx, sy, sz], dir: [dx / dl, dy / dl, dz / dl], spread: 42, color: [1, 0.95, 0.82], intensity: 2.4, rays: 420, bounces: 1, fixture: false };
}
function edificeCameras(b) {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  return [
    { name: 'aerial-3q', worldFraming: { cameraPosition: [cx - span * 0.9, b.y0 - span * 1.4, span * 1.5], lookAt: [cx, cy, 10], horizontalFov: 58 } },
    { name: 'street', worldFraming: { cameraPosition: [cx - span * 0.3, b.y0 - span * 0.7, 12], lookAt: [cx, cy, 12], horizontalFov: 62 } },
  ];
}

export function assembleEdificeScene(manifest = {}, ctx = {}) {
  const L = makeLight({ direction: [0.36, 0.42, -0.83], ambient: 0.5, diffuse: 0.55 });
  const plan = planEdifice(manifest);
  const { faces, textures } = buildEdificeFaces(plan, { light: L });
  const b = plan.bounds, pad = Math.max(24, (b.x1 - b.x0) * 0.3);
  const ground = [{ x: b.x0 - pad, y: b.y0 - pad, w: (b.x1 - b.x0) + 2 * pad, d: (b.y1 - b.y0) + 2 * pad, z: 0, fill: '#6f7d52' }];
  const viewBox = manifest.viewBox || { width: 1280, height: 820 };
  const payload = assembleBoxCityScene({
    boxes: [], grounds: ground, faces, sources: [daySun(b)],
    diffusion: { soft: true, gain: 1.8, softness: 1.05, shadows: true, shadowStrength: 1.0, shadowMaxAlpha: 0.4 },
    light: L, cameras: edificeCameras(b), viewBox, unitScale: manifest.unitScale || 6,
    title: ctx.title || manifest.title || 'mojulo edifice',
    sky: ctx.sky || { preset: 'day' }, groundShadows: ctx.groundShadows ?? true,
  });
  payload.textures = { ...payload.textures, ...textures };
  payload.walk = manifest.walk === false ? false : { eye: 5.6, spawn: plan.spawn };
  payload.edifice = plan;
  Object.assign(payload, assessEdifice(plan));   // advisory: reachability (E3 adds the rest)
  return payload;
}

// ── assessEdifice (advisory — SURFACED, never enforced) ─────────────────────
// Each check is a pure function of the plan, re-deriving geometry through the same
// envelopes the renderer reads. Returns { <check>: { ok, necessary } } — never throws,
// never gates; a defect is information the operator acts on (or doesn't). E6 adds
// livability; egress / flow land later (they want the interior kernels).
export function assessEdifice(plan) {
  return { reachability: assessReachability(plan), livability: assessLivability(plan) };
}

// reachability: every mass has a concourse path from the entrance.
function assessReachability(plan) {
  const adj = new Map(plan.masses.map((m) => [m.id, []]));
  for (const c of plan.concourses) { adj.get(c.from)?.push(c.to); adj.get(c.to)?.push(c.from); }
  const seen = new Set([plan.entranceId]); const q = [plan.entranceId];
  while (q.length) for (const n of adj.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  const necessary = plan.masses.filter((m) => !seen.has(m.id))
    .map((m) => ({ code: 'unreachable-mass', id: m.id, note: `mass '${m.id}' has no concourse path from the entrance` }));
  return { ok: necessary.length === 0, necessary };
}

// livability (daylight): every mass has ≥1 exterior wall facing OPEN AIR — a mass boxed
// in by neighbouring masses/halls on all four sides gets no daylight. Probes just outside
// each wall midpoint against the shared envelopes (the fractal-condo "windows face open
// air" principle, at mass scale).
function assessLivability(plan) {
  const inside = (px, py, e) => px > e.x0 + 0.1 && px < e.x1 - 0.1 && py > e.y0 + 0.1 && py < e.y1 - 0.1;
  const necessary = [];
  for (const m of plan.masses) {
    const cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2;
    const probes = [[cx, m.y0 - 1.5], [cx, m.y1 + 1.5], [m.x0 - 1.5, cy], [m.x1 + 1.5, cy]];
    const open = probes.some(([px, py]) => !plan.envelopes.some((e) => e.id !== m.id && inside(px, py, e)));
    if (!open) necessary.push({ code: 'no-daylight', id: m.id, note: `mass '${m.id}' is enclosed on all sides — no exterior wall faces open air` });
  }
  return { ok: necessary.length === 0, necessary };
}
