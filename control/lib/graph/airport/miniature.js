/**
 * THE AIRPORT IN MINIATURE: the whole plan (plan.js) as an architect's presentation model, shrunk evenly (1:1000 by
 * default) and set on a walnut plinth on a gallery floor. Every figure is the plan's, so the model and the wing drawn at
 * full scale from the same recipe agree; only the scale differs. A model's language: printed ground layers (grass,
 * the apron's concrete, the asphalt and its white and yellow marks), the terminal's long-span roof over glass, the piers'
 * glazed boxes under their white roofs and skylights, the jet bridges from their rotundas to each aircraft's door, the
 * tower's flared cab, the hangar's vault and its doors, the forecourt and its car park. The fleet is the registry's
 * stylised nets (vehicles-css3d.js) at each aircraft's true length, in a seeded livery each.
 *
 *   MINIATURE_SCALES                         the scales it is made at (the denominator: 1:250 … 1:4000)
 *   airportMiniature(plan, { scale?, seed? }) → { faces, cameras, size } in the model's metres (the floor z = 0, the
 *                                              plinth's top TOP)
 *   assembleAirportScene(manifest, { title }) → the World page payload (kind 'airport', `show: 'miniature'`)
 *
 * Pure and deterministic.
 */
import { planAirport } from './plan.js';
import { vehicleFaces, aircraftFootprint } from '../vehicles/vehicles-css3d.js';
import { pickAircraftLiveryScheme } from '../polygonizer/vehicle-fuselage-net.js';
import { mulberry32 } from '../vegetation/grow.js';
import { craftFootprint } from '../craft-shelf/index.js';
import { airportWing } from './wing.js';

export const MINIATURE_SCALES = Object.freeze([250, 4000]);
const TOP = 0.86;
// each liner as the stylised fleet draws it (the jumbo the twin-aisle's net at its own length)
const NET = Object.freeze({ bizjet: 'bizjet', regional: 'regional', narrowbody: 'airliner', widebody: 'widebody', jumbo: 'widebody' });
const C = Object.freeze({
  floor: '#d8d3c9', plinth: '#3b2b20', plinthEdge: '#2a1f17', grass: '#7f915d', grass2: '#748752', apron: '#cbc9c2', asphalt: '#4a4d52',
  runway: '#3e4145', white: '#f1f1ec', yellow: '#dfb12c', glass: '#7193a9', glassDeep: '#45607a', roof: '#e6e8ea', roofEdge: '#b9bfc5',
  frame: '#9aa3ab', concrete: '#d9d4cb', road: '#585b60', car: '#a7abb0', bridge: '#c4c8cc', tower: '#d1ccc2', hangarDoor: '#a9aeb3',
});

/** The plan as a model on its plinth. */
export function airportMiniature(plan, { scale = 1000, seed = 1 } = {}) {
  if (!(scale >= MINIATURE_SCALES[0] && scale <= MINIATURE_SCALES[1])) throw new Error(`airport: a miniature's scale is 1:${MINIATURE_SCALES[0]} to 1:${MINIATURE_SCALES[1]}`);
  const k = 1 / scale, B = plan.bounds, cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, faces = [], rng = mulberry32((seed * 2654435761 + 3) >>> 0);
  const T = (x, y, z = 0) => [(x - cx) * k, (y - cy) * k, TOP + z * k];
  // (a ground layer a fraction of a millimetre over the one under it, as a model's printed layers sit)
  const L = (n) => n * 0.00035;
  const quad = (cs, fill, extra = {}) => faces.push({ corners: cs, fill, ...extra });
  const flat = (poly, lift, fill) => quad(poly.map(([x, y]) => { const p = T(x, y); return [p[0], p[1], p[2] + lift]; }), fill);
  const strip = (a, b, w, lift, fill) => { const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d) || 1, n = [(-d[1] / l) * w / 2, (d[0] / l) * w / 2]; flat([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], lift, fill); };
  // an oriented box in plan metres: its centre, along u, half-lengths, its heights; its top and sides
  const box = (c, u, hu, hn, z0, z1, top, side, extra = {}) => {
    const n = [-u[1], u[0]], P = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [c[0] + u[0] * a * hu + n[0] * b * hn, c[1] + u[1] * a * hu + n[1] * b * hn]);
    quad(P.map(([x, y]) => T(x, y, z1)), top, extra);
    for (let i = 0; i < 4; i++) { const p = P[i], q = P[(i + 1) % 4]; quad([T(p[0], p[1], z0), T(q[0], q[1], z0), T(q[0], q[1], z1), T(p[0], p[1], z1)], typeof side === 'function' ? side(i) : side, extra); }
  };
  const prism = (c, r, n, z0, z1, top, side, rot = 0, r1 = r) => {
    const ring = (rr, z) => Array.from({ length: n }, (_, i) => { const a = rot + (2 * Math.PI * i) / n; return T(c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a), z); });
    const lo = ring(r, z0), hi = ring(r1, z1);
    if (top) quad(hi, top);
    for (let i = 0; i < n; i++) quad([lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]], side);
  };

  // ── the plinth on the gallery floor, its top the grass ──
  const x0 = B.x0, x1 = B.x1, y0 = B.y0, y1 = B.y1, m = 40;
  const pf = [T(x0 - m, y0 - m, 0), T(x1 + m, y0 - m, 0), T(x1 + m, y1 + m, 0), T(x0 - m, y1 + m, 0)].map(([x, y]) => [x, y, 0]);
  const S = Math.max(x1 - x0, y1 - y0) * k;
  quad([[-S * 2, -S * 2, 0], [S * 2, -S * 2, 0], [S * 2, S * 2, 0], [-S * 2, S * 2, 0]], C.floor);
  quad(pf.map(([x, y]) => [x, y, TOP - 0.004]), C.plinthEdge);
  for (let i = 0; i < 4; i++) { const p = pf[i], q = pf[(i + 1) % 4]; quad([p, q, [q[0], q[1], TOP - 0.004], [p[0], p[1], TOP - 0.004]], C.plinth); }
  flat([[x0 - m + 6, y0 - m + 6], [x1 + m - 6, y0 - m + 6], [x1 + m - 6, y1 + m - 6], [x0 - m + 6, y1 + m - 6]], L(0), C.grass);
  // (the grass cut in bands, the way a field is mown)
  for (let y = y0, i = 0; y < y1; y += 90, i++) if (i % 2) flat([[x0, y], [x1, y], [x1, Math.min(y1, y + 90)], [x0, Math.min(y1, y + 90)]], L(1), C.grass2);

  // ── the field: the apron, the taxilane, the taxiway and the runway, their connectors and their marks ──
  const F = plan.field, A = F.apron;
  flat([[A.x0, A.y0], [A.x1, A.y0], [A.x1, A.y1], [A.x0, A.y1]], L(2), C.apron);
  for (const c of F.connectors) strip(c.a, c.b, c.width, L(3), C.asphalt);
  strip(F.taxiway.a, F.taxiway.b, F.taxiway.width, L(3), C.asphalt);
  strip(F.runway.a, F.runway.b, F.runway.width, L(4), C.runway);
  // (the runway's marks: its edges, its centreline's dashes, its thresholds' piano keys, its touchdown zones)
  const R = F.runway, ru = [Math.sign(R.b[0] - R.a[0]) || 1, 0], rl = Math.abs(R.b[0] - R.a[0]), ry = R.a[1];
  for (const s of [-1, 1]) strip([R.a[0], ry + s * (R.width / 2 - 1)], [R.b[0], ry + s * (R.width / 2 - 1)], 0.9 * 2, L(5), C.white);
  for (let t = 80; t < rl - 80; t += 50) strip([R.a[0] + ru[0] * t, ry], [R.a[0] + ru[0] * (t + 30), ry], 0.9 * 2, L(5), C.white);
  for (const [end, dir] of [[R.a[0], 1], [R.b[0], -1]]) {
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { const yy = ry + s * (3 + i * 2.3); strip([end + dir * 6, yy], [end + dir * 36, yy], 1.8, L(5), C.white); }
    for (const t of [150, 300]) for (const s of [-1, 1]) strip([end + dir * t, ry + s * 9], [end + dir * (t + 22), ry + s * 9], 3, L(5), C.white);
  }
  // (the taxiways' and the taxilane's yellow centrelines)
  for (const t of [F.taxiway, F.taxilane, ...F.connectors]) strip(t.a, t.b, 1.2, L(6), C.yellow);

  // ── the landside: the forecourt road and its car park ──
  const fc = plan.forecourt;
  strip(fc.a, fc.b, fc.width, L(3), C.road);
  const pkY = fc.a[1] + fc.width / 2 + 50;
  flat([[fc.a[0] + 200, pkY - 30], [fc.b[0] - 200, pkY - 30], [fc.b[0] - 200, pkY + 70], [fc.a[0] + 200, pkY + 70]], L(3), C.road);
  for (let x = fc.a[0] + 210; x < fc.b[0] - 210; x += 6) for (const y of [pkY - 20, pkY - 8, pkY + 25, pkY + 37, pkY + 55]) if (rng() < 0.55) box([x, y], [0, 1], 2.3, 0.9, 0, 1.5, C.car, C.car);

  // ── the terminal: a long-span roof over glass (a processor), or a rotunda under its shallow dome ──
  const t = plan.terminal;
  if (t.kind === 'processor') {
    const len = t.b[0] - t.a[0], c = [(t.a[0] + t.b[0]) / 2, t.a[1]], H = t.h;
    box(c, [1, 0], len / 2, t.w / 2, 0, H - 4, C.roofEdge, (i) => (i % 2 ? C.frame : C.glass));
    // (the roof's shell: a shallow arc across its width, its eaves out over the airside and the forecourt)
    const over = 14, segs = 10, rise = 5, half = t.w / 2 + over;
    for (let i = 0; i < segs; i++) {
      const v0 = -half + (2 * half * i) / segs, v1 = -half + (2 * half * (i + 1)) / segs, z = (v) => H - 3 + rise * (1 - (v / half) ** 2);
      quad([T(t.a[0] - 8, c[1] + v0, z(v0)), T(t.b[0] + 8, c[1] + v0, z(v0)), T(t.b[0] + 8, c[1] + v1, z(v1)), T(t.a[0] - 8, c[1] + v1, z(v1))], i % 2 ? C.roof : C.roofEdge, { doubleSided: true });
    }
    // (its skylights: a row of glazed strips along the crown)
    for (let x = t.a[0] + 20; x < t.b[0] - 20; x += 40) flat([[x, c[1] - 3], [x + 24, c[1] - 3], [x + 24, c[1] + 3], [x, c[1] + 3]], (H + rise - 2.9) * k, C.glassDeep);
  } else {
    prism(t.c, t.R, 32, 0, t.h - 4, null, C.glass);
    prism(t.c, t.R + 8, 32, t.h - 4, t.h - 2, C.roofEdge, C.roofEdge);
    for (let i = 0; i < 4; i++) prism(t.c, (t.R + 8) * (1 - (i + 1) / 5), 32, t.h - 2 + i * 1.6, t.h - 0.4 + i * 1.6, i === 3 ? C.glassDeep : C.roof, C.roof, 0, (t.R + 8) * (1 - (i + 1.6) / 5));
  }
  // ── the piers: glazed boxes, their white roofs proud of them, a skylight along each ──
  for (const p of plan.concourses) {
    const d = [p.b[0] - p.a[0], p.b[1] - p.a[1]], l = Math.hypot(...d), u = [d[0] / l, d[1] / l], c = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2];
    box(c, u, l / 2, p.w / 2, 0, p.h - 1, C.roofEdge, (i) => (i % 2 ? C.glass : C.frame));
    box(c, u, l / 2 + 1.5, p.w / 2 + 1.5, p.h - 1, p.h, C.roof, C.roofEdge);
    box(c, u, l / 2 - 4, 2.2, p.h, p.h + 0.6, C.glassDeep, C.glassDeep);
  }
  // ── the stands: each aircraft at its stand, its lead-in line, its jet bridge to its door ──
  for (const s of plan.stands) {
    const net = NET[s.craft], fp = aircraftFootprint(net, 1);
    const len = lengthOf(s.craft), sc = (len * k) / fp.length, P = T(s.at[0], s.at[1]);
    for (const f of vehicleFaces({ type: net, cx: P[0], cy: P[1], heading: s.heading, scale: sc, quality: 0.25, livery: pickAircraftLiveryScheme(rng) })) faces.push({ ...f, corners: f.corners.map(([x, y, z]) => [x, y, z + TOP + L(8)]) });
    const lead0 = [s.stop[0] + s.nOut[0] * 4, s.stop[1] + s.nOut[1] * 4], lead1 = [s.at[0] + s.nOut[0] * (len / 2 + 14), s.at[1] + s.nOut[1] * (len / 2 + 14)];
    strip(lead0, lead1, 1.2, L(6), C.yellow);
    strip([lead0[0] - s.u[0] * 4, lead0[1] - s.u[1] * 4], [lead0[0] + s.u[0] * 4, lead0[1] + s.u[1] * 4], 1.2, L(6), C.yellow);
    if (s.bridge) {
      const { root, rotunda, door } = s.bridge, z0 = 5.5;
      // (its fixed link from the pier to the rotunda, the rotunda on its column, the tunnel down or up to the door's sill, its wheeled leg)
      box([(root[0] + rotunda[0]) / 2, (root[1] + rotunda[1]) / 2], s.nOut, 4.5, 1.6, z0, z0 + 3, C.bridge, C.bridge);
      prism(rotunda, 2.6, 10, 0, z0 + 3.2, C.bridge, C.frame);
      const d = [door[0] - rotunda[0], door[1] - rotunda[1]], dl = Math.hypot(...d) || 1, n = [-d[1] / dl * 1.6, d[0] / dl * 1.6];
      const za = z0, zb = door[2];
      const q = (p, z) => T(p[0], p[1], z);
      const a1 = [rotunda[0] + n[0], rotunda[1] + n[1]], a2 = [rotunda[0] - n[0], rotunda[1] - n[1]], b1 = [door[0] + n[0] - d[0] / dl * 1.2, door[1] + n[1] - d[1] / dl * 1.2], b2 = [door[0] - n[0] - d[0] / dl * 1.2, door[1] - n[1] - d[1] / dl * 1.2];
      quad([q(a1, za + 3), q(b1, zb + 3), q(b2, zb + 3), q(a2, za + 3)], C.bridge);
      quad([q(a1, za), q(b1, zb), q(b1, zb + 3), q(a1, za + 3)], C.bridge, { doubleSided: true });
      quad([q(a2, za), q(a2, za + 3), q(b2, zb + 3), q(b2, zb)], C.bridge, { doubleSided: true });
      const lg = [rotunda[0] + d[0] * 0.66, rotunda[1] + d[1] * 0.66];
      box(lg, [d[0] / dl, d[1] / dl], 0.6, 1.8, 0, za + (zb - za) * 0.66, C.frame, C.frame);
    }
  }
  // ── the tower: its shaft, its flared cab of dark glass, its roof and mast ──
  const tw = plan.tower;
  prism(tw.at, 4.5, 12, 0, tw.h - 14, null, C.tower);
  prism(tw.at, 6.5, 12, tw.h - 14, tw.h - 11, C.tower, C.tower, 0, 8.5);
  prism(tw.at, 8.5, 12, tw.h - 11, tw.h - 5, null, C.glassDeep, 0, 9.5);
  prism(tw.at, 10, 12, tw.h - 5, tw.h - 4, C.roof, C.roofEdge);
  box(tw.at, [1, 0], 0.4, 0.4, tw.h - 4, tw.h, C.frame, C.frame);
  // ── the hangar: its walls, its vault, its doors to the apron ──
  const hg = plan.hangar, hw = hg.w / 2, hd = hg.d / 2, wallH = hg.h - 9;
  box(hg.at, [1, 0], hw, hd, 0, wallH, C.concrete, (i) => (i === 0 ? C.hangarDoor : C.concrete));
  for (let i = 0; i < 12; i++) {
    const a0 = Math.PI * (i / 12), a1 = Math.PI * ((i + 1) / 12), xa = hg.at[0] - Math.cos(a0) * hw, xb = hg.at[0] - Math.cos(a1) * hw, za = wallH + Math.sin(a0) * 9, zb = wallH + Math.sin(a1) * 9;
    quad([T(xa, hg.at[1] - hd, za), T(xb, hg.at[1] - hd, zb), T(xb, hg.at[1] + hd, zb), T(xa, hg.at[1] + hd, za)], i % 2 ? C.roof : C.roofEdge, { doubleSided: true });
  }
  for (let x = hg.at[0] - hw + 4; x < hg.at[0] + hw - 4; x += 9.5) quad([T(x, hg.at[1] - hd - 0.3, 0), T(x + 0.6, hg.at[1] - hd - 0.3, 0), T(x + 0.6, hg.at[1] - hd - 0.3, wallH - 1), T(x, hg.at[1] - hd - 0.3, wallH - 1)], C.frame);

  // ── the cameras: across the model from airside, close over the terminal, low over the apron, from the landside ──
  const Sx = (x1 - x0) * k, Sy = (y1 - y0) * k, tc = t.kind === 'processor' ? [(t.a[0] + t.b[0]) / 2, t.a[1]] : t.c, Tm = T(tc[0], tc[1]);
  const s0 = plan.stands[0], Sm = s0 ? T(s0.at[0], s0.at[1]) : Tm;
  const cameras = [
    { name: 'model', worldFraming: { cameraPosition: [Sx * 0.18, -Sy * 1.35, TOP + Sx * 0.32], lookAt: [0, Sy * 0.05, TOP], horizontalFov: 48, pictureCenter: [560, 390] } },
    { name: 'terminal', worldFraming: { cameraPosition: [Tm[0] + 0.32, Tm[1] - 0.5, TOP + 0.24], lookAt: [Tm[0], Tm[1] - 0.12, TOP + 0.01], horizontalFov: 42, pictureCenter: [560, 390] } },
    { name: 'apron', worldFraming: { cameraPosition: [Sm[0] - 0.22, Sm[1] - 0.24, TOP + 0.05], lookAt: [Sm[0] + 0.05, Sm[1] + 0.06, TOP + 0.008], horizontalFov: 46, pictureCenter: [560, 390] } },
    { name: 'landside', worldFraming: { cameraPosition: [-Sx * 0.3, Sy * 0.95, TOP + 0.55], lookAt: [0, 0, TOP], horizontalFov: 50, pictureCenter: [560, 390] } },
  ];
  return { faces, cameras, size: { x: Sx, y: Sy, top: TOP } };
}
const LENGTHS = new Map();
const lengthOf = (craft) => { if (!LENGTHS.has(craft)) { const F = craftFootprint(craft); LENGTHS.set(craft, F.max[1] - F.min[1]); } return LENGTHS.get(craft); };

/** The words an airport recipe takes (kind 'airport'). */
export const AIRPORT_KEYS = Object.freeze(['kind', 'seed', 'glyph', 'chirality', 'asymmetry', 'stands', 'show', 'scale', 'wing', 'crews', 'title', 'viewBox']);
/** What an airport is shown as: the whole plan as a model, or one wing at full scale (wing.js). */
export const AIRPORT_SHOWS = Object.freeze(['miniature', 'wing']);

/** The World page's payload for an airport recipe. */
export function assembleAirportScene(m = {}, { title } = {}) {
  const show = m.show ?? 'miniature';
  if (!AIRPORT_SHOWS.includes(show)) throw new Error(`airport: show is ${AIRPORT_SHOWS.join(' | ')}`);
  const plan = planAirport({ seed: m.seed ?? 1, ...(m.glyph ? { glyph: m.glyph } : {}), ...(m.chirality ? { chirality: m.chirality } : {}), ...(m.asymmetry !== undefined ? { asymmetry: m.asymmetry } : {}), ...(m.stands ? { stands: m.stands } : {}) });
  const sky = { preset: 'day', zenith: [104, 140, 186], horizon: [214, 218, 222], day: 1, stars: 0, seed: 7 };
  // (one wing at full scale, its stands' aircraft and crews its figures, lit by the day)
  if (show === 'wing') {
    const W = airportWing(plan, { ...(m.wing ? { wing: m.wing } : {}), seed: m.seed ?? 1, ...(m.crews ? { crews: m.crews } : {}) });
    return {
      faces: W.faces, figures: W.figures, entities: W.entities, cameras: W.cameras, title: title ?? m.title ?? `mojulo airport, wing ${W.wing}`,
      viewBox: m.viewBox ?? { width: 1120, height: 780 }, bg: '#b9c6d3', sky, shadows: { actors: true }, light: { toLight: [0.42, -0.38, 0.82] }, metersPerUnit: 1,
    };
  }
  const { faces, cameras } = airportMiniature(plan, { scale: m.scale ?? 1000, seed: m.seed ?? 1 });
  return {
    faces, cameras, title: title ?? m.title ?? 'mojulo airport', viewBox: m.viewBox ?? { width: 1120, height: 780 },
    bg: '#d8d3c9', sky: { preset: 'day', zenith: [104, 140, 186], horizon: [214, 218, 222], day: 1, stars: 0, seed: 7 },
    light: { toLight: [0.42, -0.38, 0.82] }, metersPerUnit: 1,
  };
}
