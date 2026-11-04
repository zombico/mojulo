/**
 * THE AIRPORT'S WING at full scale: one concourse of the plan (plan.js) and everything at its stands, drawn at its real
 * figures from the same recipe as the miniature (miniature.js), so a game can show the model as its map and stand the
 * player in the wing.
 *
 *   the piers    the wing's concourses in a modern pier's language: an apron-level base of concrete with its service
 *                doors, a full-height curtain wall over it (its mullions, its transom, its spandrel), a white roof slab
 *                proud of the glass on its fascia, a skylight along the ridge, the roof's plant; a glazed end at the tip
 *   the apron    its concrete in slabs (the joints cut every 7.5 m), the grass past it; the taxilane's yellow centreline;
 *                each stand's lead-in line, stop bar and painted number, and the red line of its equipment area
 *   the stands   each stand's aircraft off the craft shelf in the form render, made, in an airline look the seed picks;
 *                its jet bridge (jet-bridge.js) from the pier to its first door; and, at the stands the seed busies, its
 *                ground crew (vehicle-registry/turnaround.js) but the stairs, the bridge taking the door
 *
 *   WING_SHOWS                       what a wing shows (its stands' crews: 'busy' some, 'all' every, 'none')
 *   airportWing(plan, { wing?, seed?, crews? }) → { faces, figures, entities, cameras, wing }
 *
 * World space (x along the frontage, +y landside, z up), metres, the apron z = 0. Pure and deterministic.
 */
import { jetBridge } from './jet-bridge.js';
import { AIRPORT_FIGURES } from './plan.js';
import { craftFormFigure } from '../craft-shelf/craft-form.js';
import { LINER_LOOK_IDS } from '../craft-shelf/liner-looks.js';
import { loftFigure } from '../car-designer/race-families.js';
import { turnaround } from '../vehicle-registry/turnaround.js';
import { handlesOf } from '../vehicle-registry/roster.js';
import { STENCIL } from '../car-designer/livery-cut.js';
import { mulberry32 } from '../vegetation/grow.js';

export const WING_SHOWS = Object.freeze(['busy', 'all', 'none']);
const W = AIRPORT_FIGURES;
const C = Object.freeze({
  grass: '#768a50', apron: '#c4c2ba', joint: '#9e9c95', yellow: '#e0b02a', red: '#b83a2c', white: '#eeeee8',
  base: '#b9b5ad', door: '#5e6266', glass: '#5d7d93', mullion: '#c9ced2', spandrel: '#8d969d', roof: '#eceeef', fascia: '#d7dbde', plant: '#9aa0a6', skylight: '#3c5466',
});
// a stand's crew under its bridge: everything but the stairs, whose door the bridge has taken
const CREW = Object.freeze(['catering truck', 'belt loader', 'belt loader', 'baggage tug', 'baggage cart', 'baggage cart', 'fuel truck', 'pushback tug']);

/** One wing of the plan at full scale. */
export function airportWing(plan, { wing, seed = 1, crews = 'busy' } = {}) {
  if (!WING_SHOWS.includes(crews)) throw new Error(`airport: a wing's crews are ${WING_SHOWS.join(' | ')}`);
  const ids = Object.keys(plan.wings);
  // (by default the wing with the most stands)
  const id = wing ?? ids.reduce((a, b) => (plan.wings[b].stands.length > plan.wings[a].stands.length ? b : a), ids[0]);
  if (!plan.wings[id]) throw new Error(`airport: '${wing}' is no wing of this airport (${ids.join(', ')})`);
  const rng = mulberry32((seed * 2654435761 + 11) >>> 0), faces = [];
  const piers = plan.concourses.filter((c) => c.wing === id), stands = plan.stands.filter((s) => s.wing === id);
  const quad = (cs, fill, extra = {}) => faces.push({ corners: cs, fill, ...extra });
  const flat = (poly, z, fill) => quad(poly.map(([x, y]) => [x, y, z]), fill);
  const strip = (a, b, w, z, fill) => { const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d) || 1, n = [(-d[1] / l) * w / 2, (d[0] / l) * w / 2]; flat([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], z, fill); };

  // ── the region: the wing's piers and stands and a margin ──
  const pts = [...piers.flatMap((p) => [p.a, p.b]), ...stands.flatMap((s) => [s.at, s.stop])];
  const pad = 90, x0 = Math.min(...pts.map((p) => p[0])) - pad, x1 = Math.max(...pts.map((p) => p[0])) + pad, y0 = Math.min(...pts.map((p) => p[1])) - pad, y1 = Math.max(...pts.map((p) => p[1])) + pad;
  // ── the ground: grass, the apron's slabs and their joints, the taxilane's line ──
  flat([[x0 - 400, y0 - 400], [x1 + 400, y0 - 400], [x1 + 400, y1 + 400], [x0 - 400, y1 + 400]], -0.02, C.grass);
  const A = plan.field.apron, ax0 = Math.max(x0, A.x0), ax1 = Math.min(x1, A.x1), ay0 = Math.max(y0 - 60, A.y0), ay1 = Math.min(y1, A.y1);
  flat([[ax0, ay0], [ax1, ay0], [ax1, ay1], [ax0, ay1]], 0, C.apron);
  for (let x = Math.ceil(ax0 / 7.5) * 7.5; x < ax1; x += 7.5) strip([x, ay0], [x, ay1], 0.08, 0.004, C.joint);
  for (let y = Math.ceil(ay0 / 7.5) * 7.5; y < ay1; y += 7.5) strip([ax0, y], [ax1, y], 0.08, 0.004, C.joint);
  const TL = plan.field.taxilane;
  if (TL.a[1] > ay0 && TL.a[1] < ay1) strip([ax0, TL.a[1]], [ax1, TL.a[1]], 0.3, 0.01, C.yellow);
  // ── each stand's marks: its lead-in line from the taxilane, its stop bar, its number, its equipment area's red line ──
  const { SEG, DIGIT } = STENCIL;
  for (const [k, s] of stands.entries()) {
    const lead0 = [s.stop[0] + s.nOut[0] * W.noseGap * 0.5, s.stop[1] + s.nOut[1] * W.noseGap * 0.5];
    const lead1 = [s.at[0] + s.nOut[0] * 80, s.at[1] + s.nOut[1] * 80];
    strip(lead0, lead1, 0.2, 0.012, C.yellow);
    const bar = [s.stop[0] + s.nOut[0] * W.noseGap, s.stop[1] + s.nOut[1] * W.noseGap];
    strip([bar[0] - s.u[0] * 3, bar[1] - s.u[1] * 3], [bar[0] + s.u[0] * 3, bar[1] + s.u[1] * 3], 0.4, 0.012, C.yellow);
    // (the red line round the equipment area beside the nose: where the crew waits clear of the aircraft's arrival)
    const e0 = [s.stop[0] + s.nOut[0] * 1.5, s.stop[1] + s.nOut[1] * 1.5];
    for (const [a, b] of [[[-12, 0], [12, 0]], [[-12, 0], [-12, 5]], [[12, 0], [12, 5]]]) strip([e0[0] + s.u[0] * a[0] + s.nOut[0] * a[1], e0[1] + s.u[1] * a[0] + s.nOut[1] * a[1]], [e0[0] + s.u[0] * b[0] + s.nOut[0] * b[1], e0[1] + s.u[1] * b[0] + s.nOut[1] * b[1]], 0.15, 0.012, C.red);
    // (its number, painted along its lead-in line past the nose)
    const num = String(10 + k), h = 2.4, w = 0.6 * h, gap = 0.18 * h, Wn = num.length * w + (num.length - 1) * gap, at = [s.stop[0] + s.nOut[0] * 22, s.stop[1] + s.nOut[1] * 22];
    // (read from the cockpit as the aircraft taxis in: its up toward the pier, across along the stand's line)
    const up = [-s.nOut[0], -s.nOut[1]], across = [-s.u[0], -s.u[1]];
    [...num].forEach((d, i) => {
      const ox = -Wn / 2 + i * (w + gap) + 1.5;
      for (const sg of DIGIT[Number(d)]) {
        const [a, b, c, e] = SEG[sg], P = (u, v) => [at[0] + across[0] * (ox + u * h) + up[0] * (v * h - h / 2), at[1] + across[1] * (ox + u * h) + up[1] * (v * h - h / 2)];
        flat([P(a, b), P(c, b), P(c, e), P(a, e)], 0.012, C.yellow);
      }
    });
  }
  // ── the piers ──
  for (const p of piers) pier(faces, p);
  // ── the stands: the aircraft, its bridge, its crew ──
  const figures = {}, entities = [];
  const busy = new Set(crews === 'all' ? stands.map((s) => s.id) : crews === 'none' ? [] : stands.filter(() => rng() < 0.35).map((s) => s.id));
  if (crews === 'busy' && !busy.size && stands.length) busy.add(stands[0].id);
  for (const [k, s] of stands.entries()) {
    const look = LINER_LOOK_IDS[Math.floor(rng() * LINER_LOOK_IDS.length)], fid = `stand-${k}`;
    figures[fid] = craftFormFigure(s.craft, { pose: { gear: 0 }, attitude: 'ground', made: true, look });
    entities.push({ id: fid, rule: { type: 'static' }, body: { type: 'figure-rig', figure: fid }, transform: { pos: [s.at[0], s.at[1], 0], heading: s.heading } });
    if (s.bridge) {
      // (the fuselage's outward normal at its door: its left, toward the bridge)
      const left = [-Math.sin(s.heading), Math.cos(s.heading)];
      for (const f of jetBridge({ root: s.bridge.root, rotunda: s.bridge.rotunda, door: s.bridge.door, deck: 5.5, side: left })) faces.push({ corners: f.corners, fill: f.albedo });
    }
    if (busy.has(s.id)) for (const [j, e] of turnaround({ craft: s.craft, at: [s.at[0], s.at[1], 0], heading: s.heading }, { crew: [...CREW], seed: seed * 100 + k }).entries()) {
      const cid = `crew-${k}-${j}`, cls = handlesOf(e.vehicle).physics[0];
      figures[cid] = loftFigure({ class: cls, seed: e.seed, light: 'form', ...(e.reach !== undefined ? { reach: e.reach } : {}) });
      entities.push({ id: cid, rule: { type: 'static' }, body: { type: 'figure-rig', figure: cid }, transform: { pos: e.at, heading: e.heading } });
    }
  }
  // ── the cameras: over the wing, along the apron at a ramp agent's eye, from the pier's roof at a stand ──
  const s0 = stands[0] ?? { at: [(x0 + x1) / 2, (y0 + y1) / 2], nOut: [0, -1], u: [1, 0], stop: [(x0 + x1) / 2, (y0 + y1) / 2] }, mid = [(x0 + x1) / 2, (y0 + y1) / 2];
  const cameras = [
    { name: 'wing', worldFraming: { cameraPosition: [mid[0] + (x1 - x0) * 0.35, y0 - (y1 - y0) * 0.35, 90], lookAt: [mid[0], mid[1], 0], horizontalFov: 55, pictureCenter: [560, 390] } },
    { name: 'ramp', worldFraming: { cameraPosition: [s0.at[0] + s0.nOut[0] * 45 + s0.u[0] * 30, s0.at[1] + s0.nOut[1] * 45 + s0.u[1] * 30, 1.7], lookAt: [s0.at[0], s0.at[1], 4], horizontalFov: 60, pictureCenter: [560, 390] } },
    { name: 'gate', worldFraming: { cameraPosition: [s0.stop[0] - s0.nOut[0] * 6, s0.stop[1] - s0.nOut[1] * 6, W.pierH + 8], lookAt: [s0.at[0], s0.at[1], 3], horizontalFov: 60, pictureCenter: [560, 390] } },
  ];
  return { faces, figures, entities, cameras, wing: id };
}

// a pier at full scale: its base, its curtain wall, its roof and fascia, its skylight and plant, its glazed tip
function pier(faces, p) {
  const d = [p.b[0] - p.a[0], p.b[1] - p.a[1]], L = Math.hypot(...d), u = [d[0] / L, d[1] / L], n = [-u[1], u[0]], hw = p.w / 2;
  const at = (t, s, z) => [p.a[0] + u[0] * t + n[0] * s * hw, p.a[1] + u[1] * t + n[1] * s * hw, z];
  const quad = (cs, fill, extra = {}) => faces.push({ corners: cs, fill, ...extra });
  const zb = 4.5, zr = p.h - 1, zt = p.h;
  // (its base on the apron and the curtain wall over it, both sides; its ends)
  for (const s of [-1, 1]) {
    quad([at(0, s, 0), at(L, s, 0), at(L, s, zb), at(0, s, zb)], C.base);
    quad([at(0, s, zb), at(L, s, zb), at(L, s, zr), at(0, s, zr)], C.glass);
    // (the spandrel band at the floor, the transom at mid-height, the mullions every 1.5 m; a service door every 30 m)
    const off = (z0, z1, t0, t1, fill, lift = 0.03) => quad([at(t0, s * (1 + lift / hw), z0), at(t1, s * (1 + lift / hw), z0), at(t1, s * (1 + lift / hw), z1), at(t0, s * (1 + lift / hw), z1)], fill);
    off(zb, zb + 0.9, 0, L, C.spandrel);
    off((zb + zr) / 2 + 0.6, (zb + zr) / 2 + 0.75, 0, L, C.mullion);
    for (let t = 0.75; t < L; t += 1.5) off(zb + 0.9, zr, t - 0.06, t + 0.06, C.mullion, 0.05);
    for (let t = 12; t < L - 6; t += 30) off(0, 3.6, t, t + 4, C.door, 0.02);
  }
  for (const [t, sgn] of [[0, -1], [L, 1]]) {
    quad([at(t, -1, 0), at(t, 1, 0), at(t, 1, zb), at(t, -1, zb)], C.base, { doubleSided: true });
    quad([at(t, -1, zb), at(t, 1, zb), at(t, 1, zr), at(t, -1, zr)], sgn > 0 ? C.glass : C.base, { doubleSided: true });
  }
  // (the roof slab proud of the glass on its fascia, its top white; the skylight along its ridge; its plant)
  const ov = 1.6, R = (t, s, z) => [p.a[0] + u[0] * t + n[0] * s * (hw + ov), p.a[1] + u[1] * t + n[1] * s * (hw + ov), z];
  quad([R(-ov, -1, zt), R(L + ov, -1, zt), R(L + ov, 1, zt), R(-ov, 1, zt)], C.roof);
  for (const s of [-1, 1]) quad([R(-ov, s, zr), R(L + ov, s, zr), R(L + ov, s, zt), R(-ov, s, zt)], C.fascia, { doubleSided: true });
  quad([R(-ov, -1, zr), R(L + ov, -1, zr), R(L + ov, 1, zr), R(-ov, 1, zr)], C.fascia, { doubleSided: true });
  const sk = (t, s, z) => [p.a[0] + u[0] * t + n[0] * s * 1.8, p.a[1] + u[1] * t + n[1] * s * 1.8, z];
  quad([sk(6, -1, zt + 0.05), sk(L - 6, -1, zt + 0.05), sk(L - 6, 1, zt + 0.05), sk(6, 1, zt + 0.05)], C.skylight);
  for (let t = 20; t < L - 20; t += 55) {
    const c = [p.a[0] + u[0] * t + n[0] * hw * 0.55, p.a[1] + u[1] * t + n[1] * hw * 0.55];
    const B = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [c[0] + u[0] * a * 4 + n[0] * b * 2.5, c[1] + u[1] * a * 4 + n[1] * b * 2.5]);
    quad(B.map(([x, y]) => [x, y, zt + 2.2]), C.plant);
    for (let i = 0; i < 4; i++) { const a = B[i], b = B[(i + 1) % 4]; quad([[a[0], a[1], zt], [b[0], b[1], zt], [b[0], b[1], zt + 2.2], [a[0], a[1], zt + 2.2]], C.plant); }
  }
}
