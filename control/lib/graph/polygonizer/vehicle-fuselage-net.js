/**
 * Vehicle fuselage-net — the CURVED sibling of vehicle-face-net.
 *
 * vehicle-face-net renders box-shaped vehicles (bus/truck/train/car) by embedding
 * `parts[]` face cards onto planar box faces via `embedFaceOntoBox`. An aircraft
 * is the same idea on a body of revolution: a tapered cylinder skinned with a
 * livery card, plus flat appendage stickers (wings, stabilizers, fin). One card
 * grammar, two surface embeddings — planar (appendages, reusing box-net's
 * bilinear quad) and cylindrical wrap (the fuselage, the soda-can/can wrap).
 *
 * A net is a data descriptor, exactly like VEHICLE_FACE_NETS:
 *   { conceptId, label, proportions, fuselage:{ profile, livery, wrap },
 *     appendages:[ ... ] }
 * `buildFuselageNetSceneShapes(net, { body, projectPoint, cameraPosition })`
 * returns { resolved, shapes } in the same render-agnostic shape format the
 * vehicle-face-net serializer consumes — so a plane composes alongside the
 * box vehicles.
 *
 * Mapping convention for the fuselage livery card:
 *   u = station along the length (0 nose → 1 tail)   — fully-visible axis
 *   v = angle around the circumference (0 belly · 0.25 starboard · 0.5 roof ·
 *       0.75 port · 1 belly)                          — the WRAP axis (periodic)
 * Under that mapping a `band` (all u, fixed v) is a lengthwise cheatline; a
 * `rect` at fixed u with h:1 ENCIRCLES the body (the can-style wrap); a `repeat`
 * over u is a window row.
 *
 * See box-net-sticker.plan.md. Geometry proven in
 * aircraft-livery-wrap.spike.gen.test.js, which renders through this module.
 */

import { bilerp4 } from './box-net.js';
import { makeLight, shadeHex, newellNormal, dot3, sub3, centroid, lodCount } from './vexar.js';

export const VEHICLE_FUSELAGE_NET_VERSION = 'vehicle-fuselage-net-v0.1.0';

// ===========================================================================
// Cards — same parts[] grammar as vehicle-face-cards.js (band/rect/repeat/circle)
// ===========================================================================
export const AIRCRAFT_LIVERY = {
  id: 'aircraft-livery', surface: 'fuselage', wrap: 'v', base: '#eef1f4',
  parts: [
    { kind: 'band', role: 'belly-color', v: 0.0, h: 0.36, fill: '#123c7a' },        // belly sweep (wraps up the sides)
    { kind: 'band', role: 'cheat-stbd', v: 0.18, h: 0.022, fill: '#e8b54a' },        // lengthwise gold cheatlines
    { kind: 'band', role: 'cheat-port', v: 0.82, h: 0.022, fill: '#e8b54a' },
    { kind: 'repeat', role: 'win-stbd', u0: 0.16, u1: 0.74, count: 18, gap: 0.006, v: 0.25, h: 0.058, fill: '#27333c' },  // window rows
    { kind: 'repeat', role: 'win-port', u0: 0.16, u1: 0.74, count: 18, gap: 0.006, v: 0.75, h: 0.058, fill: '#27333c' },
    { kind: 'rect', role: 'cockpit-stbd', u: 0.045, w: 0.062, v: 0.345, h: 0.085, fill: '#19232b' },
    { kind: 'rect', role: 'cockpit-port', u: 0.045, w: 0.062, v: 0.655, h: 0.085, fill: '#19232b' },
    { kind: 'rect', role: 'nose-ring', u: 0.130, w: 0.022, v: 0.5, h: 1.0, fill: '#e8b54a' },     // ENCIRCLING wraps (h:1 = all the way around)
    { kind: 'rect', role: 'tail-wrap-pin', u: 0.770, w: 0.018, v: 0.5, h: 1.0, fill: '#e8b54a' },
    { kind: 'rect', role: 'tail-wrap', u: 0.788, w: 0.150, v: 0.5, h: 1.0, fill: '#c0392b' },
    { kind: 'rect', role: 'tail-wrap-end', u: 0.938, w: 0.016, v: 0.5, h: 1.0, fill: '#e8b54a' },
  ],
};
export const AIRCRAFT_WING = {
  id: 'aircraft-wing', surface: 'flat', base: '#16458c',
  parts: [
    { kind: 'band', role: 'leading', v: 0.0, h: 0.22, fill: '#e7edf3' },
    { kind: 'band', role: 'aileron', v: 1.0, h: 0.16, fill: '#0e2f63' },
    { kind: 'rect', role: 'wingtip', u: 0.87, w: 0.13, v: 0.5, h: 1.0, fill: '#c0392b' },
    { kind: 'circle', role: 'roundel', u: 0.52, v: 0.5, r: 0.17, fill: '#e7edf3' },
    { kind: 'circle', role: 'roundel-c', u: 0.52, v: 0.5, r: 0.085, fill: '#c0392b' },
  ],
};
export const AIRCRAFT_STAB = {
  id: 'aircraft-stab', surface: 'flat', base: '#16458c',
  parts: [
    { kind: 'band', role: 'leading', v: 0.0, h: 0.30, fill: '#e7edf3' },
    { kind: 'rect', role: 'tip', u: 0.80, w: 0.20, v: 0.5, h: 1.0, fill: '#c0392b' },
  ],
};
export const AIRCRAFT_FIN = {
  id: 'aircraft-fin', surface: 'flat', base: '#16458c',
  parts: [
    { kind: 'band', role: 'leading', v: 0.0, h: 0.16, fill: '#e7edf3' },
    { kind: 'circle', role: 'logo', u: 0.58, v: 0.5, r: 0.22, fill: '#e7edf3' },
    { kind: 'circle', role: 'logo-c', u: 0.58, v: 0.5, r: 0.11, fill: '#c0392b' },
  ],
};
const AIRCRAFT_CARDS = { [AIRCRAFT_LIVERY.id]: AIRCRAFT_LIVERY, [AIRCRAFT_WING.id]: AIRCRAFT_WING, [AIRCRAFT_STAB.id]: AIRCRAFT_STAB, [AIRCRAFT_FIN.id]: AIRCRAFT_FIN };
export function getAircraftCard(idOrCard) {
  if (idOrCard && typeof idOrCard === 'object') return idOrCard;
  return AIRCRAFT_CARDS[String(idOrCard || '').trim()] || null;
}

// ===========================================================================
// Generative liveries — a SCHEME is a tiny palette of slot colors; the four
// cards (fuselage + wing + stab + fin) are painted from it so the whole plane
// stays coherent. Windows, cockpit glass and leading-edge trim stay constant
// across schemes (they read as glass/structure, not airline branding). The
// `classic` scheme reproduces the original hand-authored AIRCRAFT_* cards.
// ===========================================================================
const LIVERY_WINDOW = '#27333c', LIVERY_COCKPIT = '#19232b', LIVERY_TRIM = '#e7edf3';
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mulHex = (h, f) => '#' + hex2(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');

export const DEFAULT_LIVERY_SCHEME = { name: 'classic', skin: '#eef1f4', belly: '#123c7a', cheat: '#e8b54a', tail: '#c0392b', wing: '#16458c', fin: '#16458c' };
export const AIRCRAFT_LIVERY_SCHEMES = [
  DEFAULT_LIVERY_SCHEME,
  { name: 'teal',    skin: '#eef3f4', belly: '#0e6b6b', cheat: '#f0ece0', tail: '#0a4f4f', wing: '#137a7a', fin: '#0a4f4f' },
  { name: 'crimson', skin: '#f4eeee', belly: '#7a1220', cheat: '#d9c08a', tail: '#9c1b2b', wing: '#6e1420', fin: '#9c1b2b' },
  { name: 'forest',  skin: '#eef4ef', belly: '#14532d', cheat: '#e8d9a0', tail: '#1f7a3d', wing: '#16602e', fin: '#1f7a3d' },
  { name: 'ember',   skin: '#eceef0', belly: '#2b2f36', cheat: '#e07a2a', tail: '#d35400', wing: '#3a3f47', fin: '#2b2f36' },
  { name: 'royal',   skin: '#f0eef4', belly: '#3a2363', cheat: '#cfc0e8', tail: '#5b2a9c', wing: '#4a2f7a', fin: '#5b2a9c' },
  { name: 'sky',     skin: '#f4f7fa', belly: '#2f7fc4', cheat: '#ffffff', tail: '#1f6bb0', wing: '#2f7fc4', fin: '#1f6bb0' },
  { name: 'sand',    skin: '#f4f1ea', belly: '#6e4a2a', cheat: '#e3c98a', tail: '#7a2e2e', wing: '#6e4a2a', fin: '#7a2e2e' },
];

// Paint the four aircraft cards from a scheme. Returns { livery, wing, stab, fin }.
// `windows`/`winH` size the window row to the airframe (a stubby bizjet wants ~7
// portholes, a widebody ~26), so the livery reads its class.
export function buildAircraftLivery(scheme = {}, { windows = 18, winH = 0.058 } = {}) {
  const s = { ...DEFAULT_LIVERY_SCHEME, ...scheme };
  return {
    livery: { id: 'aircraft-livery', surface: 'fuselage', wrap: 'v', base: s.skin, parts: [
      { kind: 'band', role: 'belly-color', v: 0.0, h: 0.36, fill: s.belly },
      { kind: 'band', role: 'cheat-stbd', v: 0.18, h: 0.022, fill: s.cheat },
      { kind: 'band', role: 'cheat-port', v: 0.82, h: 0.022, fill: s.cheat },
      { kind: 'repeat', role: 'win-stbd', u0: 0.16, u1: 0.74, count: windows, gap: 0.006, v: 0.25, h: winH, fill: LIVERY_WINDOW },
      { kind: 'repeat', role: 'win-port', u0: 0.16, u1: 0.74, count: windows, gap: 0.006, v: 0.75, h: winH, fill: LIVERY_WINDOW },
      { kind: 'rect', role: 'cockpit-stbd', u: 0.045, w: 0.062, v: 0.345, h: 0.085, fill: LIVERY_COCKPIT },
      { kind: 'rect', role: 'cockpit-port', u: 0.045, w: 0.062, v: 0.655, h: 0.085, fill: LIVERY_COCKPIT },
      { kind: 'rect', role: 'nose-ring', u: 0.130, w: 0.022, v: 0.5, h: 1.0, fill: s.cheat },
      { kind: 'rect', role: 'tail-wrap-pin', u: 0.770, w: 0.018, v: 0.5, h: 1.0, fill: s.cheat },
      { kind: 'rect', role: 'tail-wrap', u: 0.788, w: 0.150, v: 0.5, h: 1.0, fill: s.tail },
      { kind: 'rect', role: 'tail-wrap-end', u: 0.938, w: 0.016, v: 0.5, h: 1.0, fill: s.cheat },
    ] },
    wing: { id: 'aircraft-wing', surface: 'flat', base: s.wing, parts: [
      { kind: 'band', role: 'leading', v: 0.0, h: 0.22, fill: LIVERY_TRIM },
      { kind: 'band', role: 'aileron', v: 1.0, h: 0.16, fill: mulHex(s.wing, 0.66) },
      { kind: 'rect', role: 'wingtip', u: 0.87, w: 0.13, v: 0.5, h: 1.0, fill: s.tail },
      { kind: 'circle', role: 'roundel', u: 0.52, v: 0.5, r: 0.17, fill: LIVERY_TRIM },
      { kind: 'circle', role: 'roundel-c', u: 0.52, v: 0.5, r: 0.085, fill: s.tail },
    ] },
    stab: { id: 'aircraft-stab', surface: 'flat', base: s.wing, parts: [
      { kind: 'band', role: 'leading', v: 0.0, h: 0.30, fill: LIVERY_TRIM },
      { kind: 'rect', role: 'tip', u: 0.80, w: 0.20, v: 0.5, h: 1.0, fill: s.tail },
    ] },
    fin: { id: 'aircraft-fin', surface: 'flat', base: s.fin, parts: [
      { kind: 'band', role: 'leading', v: 0.0, h: 0.16, fill: LIVERY_TRIM },
      { kind: 'circle', role: 'logo', u: 0.58, v: 0.5, r: 0.22, fill: LIVERY_TRIM },
      { kind: 'circle', role: 'logo-c', u: 0.58, v: 0.5, r: 0.11, fill: s.tail },
    ] },
  };
}

// Pick a livery scheme — by explicit index, or via rng() (deterministic with a
// seeded rng), or at random. Returns one of AIRCRAFT_LIVERY_SCHEMES.
export function pickAircraftLiveryScheme(rngOrIndex) {
  const n = AIRCRAFT_LIVERY_SCHEMES.length;
  if (typeof rngOrIndex === 'number') return AIRCRAFT_LIVERY_SCHEMES[((rngOrIndex % n) + n) % n];
  const r = typeof rngOrIndex === 'function' ? rngOrIndex() : Math.random();
  return AIRCRAFT_LIVERY_SCHEMES[Math.min(n - 1, Math.max(0, Math.floor(r * n)))];
}

// ===========================================================================
// The sticker sampler — surface-agnostic (u,v) → fill. `wrap` names the periodic
// axis ('u' for the soda can, 'v' for the fuselage). `aspect` = uLen/vLen keeps
// circles round on whatever surface. This is the curved-surface method; flat
// faces can use vehicle-face-net's vector emitter instead.
// ===========================================================================
function frac(x) { return ((x % 1) + 1) % 1; }
function axisDelta(a, b, wrap) { const d = Math.abs(frac(a) - frac(b)); return wrap ? Math.min(d, 1 - d) : Math.abs(a - b); }
// inside an axis-aligned cell (half-extents hw×hh from centre, cu/dv = |Δu|,|Δv|),
// optionally with ROUNDED corners of world-radius `r`. r is a v-space radius; the
// u-space radius is r/aspect so the corner reads round on the (anisotropic) surface.
function inCell(cu, dv, hw, hh, r, aspect) {
  if (cu > hw || dv > hh) return false;
  if (!r) return true;
  const rv = Math.min(r, hh), ru = Math.min(rv / (aspect || 1), hw);
  const iu = hw - ru, iv = hh - rv;                         // inner box; corners live beyond it
  if (cu <= iu || dv <= iv) return true;
  const nx = (cu - iu) / ru, ny = (dv - iv) / rv;
  return nx * nx + ny * ny <= 1;
}
function partHit(p, u, v, ctx) {
  const { wrapU, wrapV, aspect } = ctx;
  switch (p.kind) {
    case 'band': return axisDelta(v, p.v, wrapV) <= p.h / 2;
    case 'rect': {
      const cu = wrapU ? axisDelta(u, p.u + p.w / 2, true) : Math.abs(u - (p.u + p.w / 2));
      return inCell(cu, axisDelta(v, p.v, wrapV), p.w / 2, p.h / 2, p.r ?? 0, aspect);
    }
    case 'repeat': {
      const dv = axisDelta(v, p.v, wrapV);
      if (dv > p.h / 2) return false;
      const span = p.u1 - p.u0, gap = p.gap ?? 0;
      const w = p.w ?? (span - gap * (p.count - 1)) / p.count;
      const step = p.count > 1 ? (span - w) / (p.count - 1) : 0;
      for (let i = 0; i < p.count; i += 1) { const u0 = p.u0 + i * step; if (inCell(Math.abs(u - (u0 + w / 2)), dv, w / 2, p.h / 2, p.r ?? 0, aspect)) return true; }
      return false;
    }
    case 'grid': {                              // 2-D repeat: countU×countV cells (building windows)
      const iu = Math.floor((u - p.u0) / ((p.u1 - p.u0) / p.countU));
      const iv = Math.floor((v - p.v0) / ((p.v1 - p.v0) / p.countV));
      if (iu < 0 || iu >= p.countU || iv < 0 || iv >= p.countV) return false;
      const stepU = (p.u1 - p.u0) / p.countU, stepV = (p.v1 - p.v0) / p.countV;
      const cu = p.u0 + (iu + 0.5) * stepU, cv = p.v0 + (iv + 0.5) * stepV;
      const wU = p.wU ?? (stepU - (p.gapU ?? 0)), wV = p.wV ?? (stepV - (p.gapV ?? 0));
      return inCell(axisDelta(u, cu, wrapU), axisDelta(v, cv, wrapV), wU / 2, wV / 2, p.r ?? 0, aspect);
    }
    case 'circle': {
      const du = axisDelta(u, p.u, wrapU) * aspect, dv = axisDelta(v, p.v, wrapV);
      return du * du + dv * dv <= p.r * p.r;
    }
    case 'poly': {                              // arbitrary (u,v) outline — shaped windows, raked pillars, etc.
      const pts = p.points; let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const ui = pts[i].u, vi = pts[i].v, uj = pts[j].u, vj = pts[j].v;
        if (((vi > v) !== (vj > v)) && (u < ((uj - ui) * (v - vi)) / (vj - vi) + ui)) inside = !inside;
      }
      return inside;
    }
    default: return false;
  }
}
export function stickerContext(card, uLen, vLen) {
  return { wrapU: card.wrap === 'u', wrapV: card.wrap === 'v', aspect: (uLen || 1) / (vLen || 1) };
}
export function sampleStickerCard(card, u, v, ctx) {
  let fill = card.base;
  for (const p of card.parts) if (partHit(p, u, v, ctx)) fill = p.fill;   // painter order
  return fill;
}

// ===========================================================================
// Net registry — a plane authored as data, alongside VEHICLE_FACE_NETS.
// ===========================================================================
export const AIRCRAFT_FUSELAGE_NETS = {
  jet: {
    conceptId: 'vehicle.aircraft.narrowbody-jet',
    label: 'Narrowbody jet',
    proportions: { length: 6, radius: 0.6 },
    fuselage: {
      livery: 'aircraft-livery',
      // s=0 nose (blunt rounded radome) → s=1 tail (long taper to a point)
      profile: [{ s: 0, r: 0.34 }, { s: 0.05, r: 0.74 }, { s: 0.14, r: 1 }, { s: 0.68, r: 1 }, { s: 0.90, r: 0.52 }, { s: 1, r: 0.10 }],
    },
    // appendages in fuselage-relative fractions; the builder turns them into world quads.
    // horizontal: a swept lifting/stab surface mirrored to both sides.
    // vertical: a fin in the centerline plane.
    appendages: [
      { id: 'wing', card: 'aircraft-wing', plane: 'horizontal', sides: [1, -1], rootX: 0.7, span: 3.4, drop: 0.55, root: [0.365, 0.54], tip: [0.575, 0.625] },   // rounded-triangle tip; root chord pushed forward (+area, same span)
      { id: 'stab', card: 'aircraft-stab', plane: 'horizontal', sides: [1, -1], rootX: 0.5, span: 1.9, drop: 0.05, root: [0.84, 0.94], tip: [0.945, 0.975] },   // rounded-triangle tip; chord pushed forward (+area)
      { id: 'fin', card: 'aircraft-fin', plane: 'vertical', baseZ: 0.6, tipZ: 1.55, base: [0.84, 0.99], tip: [0.93, 1.02] },
    ],
  },
  // WIDEBODY (jumbo): long fat fuselage, blunt nose, broad high-aspect wing, tall fin,
  // a dense double-length window row. Reads as a 747/777-class hauler.
  widebody: {
    conceptId: 'vehicle.aircraft.widebody-jumbo',
    label: 'Widebody jumbo',
    proportions: { length: 9, radius: 0.92 },
    fuselage: {
      livery: 'aircraft-livery', windows: 26, winH: 0.06,
      profile: [{ s: 0, r: 0.42 }, { s: 0.045, r: 0.82 }, { s: 0.12, r: 1 }, { s: 0.72, r: 1 }, { s: 0.90, r: 0.56 }, { s: 1, r: 0.12 }],
    },
    appendages: [
      { id: 'wing', card: 'aircraft-wing', plane: 'horizontal', sides: [1, -1], rootX: 0.7, span: 5.0, drop: 0.78, root: [0.335, 0.56], tip: [0.60, 0.66] },   // rounded-triangle tip; root chord pushed forward (+area, same span)
      { id: 'stab', card: 'aircraft-stab', plane: 'horizontal', sides: [1, -1], rootX: 0.5, span: 2.8, drop: 0.08, root: [0.85, 0.95], tip: [0.955, 0.985] },   // rounded-triangle tip; chord pushed forward (+area)
      { id: 'fin', card: 'aircraft-fin', plane: 'vertical', baseZ: 0.55, tipZ: 2.15, base: [0.85, 1.0], tip: [0.93, 1.04] },
    ],
  },
  // REGIONAL: a short narrowbody / regional jet — compact, conventional tail, a short
  // window row. Reads as a CRJ/E-jet-class continental hopper.
  regional: {
    conceptId: 'vehicle.aircraft.regional-jet',
    label: 'Regional jet',
    proportions: { length: 4.2, radius: 0.46 },
    fuselage: {
      livery: 'aircraft-livery', windows: 12, winH: 0.052,
      profile: [{ s: 0, r: 0.30 }, { s: 0.05, r: 0.72 }, { s: 0.15, r: 1 }, { s: 0.66, r: 1 }, { s: 0.89, r: 0.5 }, { s: 1, r: 0.10 }],
    },
    appendages: [
      { id: 'wing', card: 'aircraft-wing', plane: 'horizontal', sides: [1, -1], rootX: 0.7, span: 2.4, drop: 0.4, root: [0.388, 0.55], tip: [0.575, 0.625] },   // rounded-triangle tip; root chord pushed forward (+area, same span)
      { id: 'stab', card: 'aircraft-stab', plane: 'horizontal', sides: [1, -1], rootX: 0.5, span: 1.25, drop: 0.05, root: [0.84, 0.94], tip: [0.945, 0.975] },   // rounded-triangle tip; chord pushed forward (+area)
      { id: 'fin', card: 'aircraft-fin', plane: 'vertical', baseZ: 0.6, tipZ: 1.2, base: [0.83, 0.99], tip: [0.92, 1.02] },
    ],
  },
  // BIZJET (private): slim pointed fuselage, small low wing, a flat conventional tail, a
  // sparse porthole row. Reads as a Gulfstream-ish jet.
  bizjet: {
    conceptId: 'vehicle.aircraft.business-jet',
    label: 'Business jet',
    proportions: { length: 2.9, radius: 0.34 },
    fuselage: {
      livery: 'aircraft-livery', windows: 7, winH: 0.044,
      profile: [{ s: 0, r: 0.20 }, { s: 0.06, r: 0.60 }, { s: 0.17, r: 1 }, { s: 0.64, r: 1 }, { s: 0.88, r: 0.5 }, { s: 1, r: 0.08 }],
    },
    appendages: [
      { id: 'wing', card: 'aircraft-wing', plane: 'horizontal', sides: [1, -1], rootX: 0.65, span: 1.7, drop: 0.3, root: [0.43, 0.58], tip: [0.598, 0.643] },   // rounded-triangle tip; root chord pushed forward (+area, same span)
      { id: 'stab', card: 'aircraft-stab', plane: 'horizontal', sides: [1, -1], rootX: 0.5, span: 1.0, drop: 0.05, root: [0.88, 0.97], tip: [0.97, 0.995] },   // flat, rounded-triangle tip; chord pushed forward (+area)
      { id: 'fin', card: 'aircraft-fin', plane: 'vertical', baseZ: 0.55, tipZ: 1.4, base: [0.86, 1.0], tip: [0.93, 1.03] },
    ],
  },
};
export function getFuselageNet(id) { return AIRCRAFT_FUSELAGE_NETS[String(id || '').trim()] || null; }

// Aircraft world FOOTPRINT for a given render scale: the body length, full wingspan
// (2× the widest horizontal appendage) and body radius, each already scaled by
// GLOBAL_K·scale (the convention vehicles-swept uses). Lets a placer space gates +
// reserve non-overlap footprints sized to each plane's class.
const FOOTPRINT_K = 0.35;                                   // == vehicles-swept GLOBAL_K
export function fuselageFootprint(netOrId, scale = 1) {
  const net = typeof netOrId === 'string' ? getFuselageNet(netOrId) : netOrId;
  if (!net) return null;
  const k = FOOTPRINT_K * scale;
  const spans = (net.appendages || []).filter((a) => a.plane === 'horizontal').map((a) => a.span);
  const halfSpan = Math.max(net.proportions.radius, ...spans);
  return { length: net.proportions.length * k, span: 2 * halfSpan * k, radius: net.proportions.radius * k };
}

// `scheme` (optional) recolors the plane generatively: a palette is painted into
// the fuselage + appendage cards, overriding the net's authored livery.
export function resolveFuselageNet(netOrId, scheme) {
  const net = typeof netOrId === 'string' ? getFuselageNet(netOrId) : netOrId;
  if (!net) throw new Error(`vehicle-fuselage-net: unknown net "${netOrId}"`);
  const painted = scheme ? buildAircraftLivery(scheme, { windows: net.fuselage.windows, winH: net.fuselage.winH }) : null;
  const byId = painted ? { 'aircraft-wing': painted.wing, 'aircraft-stab': painted.stab, 'aircraft-fin': painted.fin } : null;
  const livery = painted ? painted.livery : getAircraftCard(net.fuselage.livery);
  if (!livery) throw new Error(`vehicle-fuselage-net: no livery card "${net.fuselage.livery}"`);
  const appendages = (net.appendages || []).map((a) => {
    const card = (byId && byId[a.card]) || getAircraftCard(a.card);
    if (!card) throw new Error(`vehicle-fuselage-net: no appendage card "${a.card}"`);
    return { ...a, card };
  });
  return { conceptId: net.conceptId, label: net.label, proportions: net.proportions, fuselage: { ...net.fuselage, livery }, appendages };
}

// ===========================================================================
// Geometry (lighting is vexar.js — shadeHex / newellNormal / vec helpers)
// ===========================================================================
function profileR(profile, R0, s) {
  for (let i = 1; i < profile.length; i += 1) {
    if (s <= profile[i].s) { const a = profile[i - 1], b = profile[i]; const t = (s - a.s) / (b.s - a.s || 1); return R0 * (a.r + (b.r - a.r) * t); }
  }
  return R0 * profile[profile.length - 1].r;
}
// world point on the fuselage skin. phi: 0 belly · π/2 starboard · π roof · 3π/2 port.
function fusPoint(body, profile, s, phi) {
  const R = profileR(profile, body.radius, s);
  return [body.center[0] + R * Math.sin(phi), body.noseY - s * body.length, body.axisZ - R * Math.cos(phi)];
}

const DEFAULT_LIGHT = makeLight({ direction: [0.45, 0.5, -0.74], ambient: 0.5, diffuse: 0.58 });

// Build the appendage world quads (a=root-lead, b=tip-lead, c=tip-trail, d=root-trail).
function appendageQuads(body, appendages) {
  const yAt = (s) => body.noseY - s * body.length;
  const out = [];
  for (const a of appendages) {
    if (a.plane === 'horizontal') {
      for (const side of a.sides) {
        const xr = body.center[0] + side * body.radius * a.rootX, xt = body.center[0] + side * a.span, zr = body.axisZ - 0.18, zt = body.axisZ - a.drop;
        out.push({ card: a.card, corners: [[xr, yAt(a.root[0]), zr], [xt, yAt(a.tip[0]), zt], [xt, yAt(a.tip[1]), zt], [xr, yAt(a.root[1]), zr]] });
      }
    } else { // vertical fin in the centerline plane
      const cx = body.center[0];
      out.push({ card: a.card, corners: [[cx, yAt(a.base[0]), body.axisZ + body.radius * a.baseZ], [cx, yAt(a.tip[0]), body.axisZ + a.tipZ], [cx, yAt(a.tip[1]), body.axisZ + a.tipZ], [cx, yAt(a.base[1]), body.axisZ + body.radius * a.baseZ]] });
    }
  }
  return out;
}

/**
 * Render an aircraft in 3/4 view: wrap the livery card around the tapered
 * fuselage and embed the appendage cards on their flat quads, all projected and
 * depth-sorted. Returns { resolved, shapes } with the same render-agnostic shape
 * primitives as buildFaceNetSceneShapes (poly + fill), ready for serialization.
 *
 * `body` places + scales the fuselage: { center:[x,y], axisZ, noseY, length, radius }.
 */
export function buildFuselageNetSceneShapes(netOrId, {
  body, projectPoint, cameraPosition, light = DEFAULT_LIGHT, quality = 'default', stations, angles, scheme, cull = true,
} = {}) {
  // vexar LOD: sustainable base, tweak up via `quality`. Explicit values override.
  const NSTA = stations ?? lodCount(96, quality, 24), NANG = angles ?? lodCount(64, quality, 20);
  const resolved = (!scheme && typeof netOrId === 'object' && netOrId.fuselage?.livery?.parts) ? netOrId : resolveFuselageNet(netOrId, scheme);
  const project = (w) => { const p = projectPoint(w); return Array.isArray(p) ? { x: p[0], y: p[1] } : p; };
  const dist = (c) => Math.hypot(c[0] - cameraPosition[0], c[1] - cameraPosition[1], c[2] - cameraPosition[2]);
  const faces = [];

  // --- fuselage: cylinder-wrap, tessellated + back-face culled ---
  const livery = resolved.fuselage.livery;
  const profile = resolved.fuselage.profile;
  const uLen = body.length, vLen = 2 * Math.PI * body.radius;
  const ctx = stickerContext(livery, uLen, vLen);
  for (let i = 0; i < NSTA; i += 1) {
    const s0 = i / NSTA, s1 = (i + 1) / NSTA, u = (s0 + s1) / 2;
    for (let j = 0; j < NANG; j += 1) {
      const p0 = (j / NANG) * 2 * Math.PI, p1 = ((j + 1) / NANG) * 2 * Math.PI, pc = (p0 + p1) / 2;
      const wpts = [fusPoint(body, profile, s0, p0), fusPoint(body, profile, s1, p0), fusPoint(body, profile, s1, p1), fusPoint(body, profile, s0, p1)];
      const c = centroid(wpts);
      const ni = newellNormal(wpts);
      const n = [-ni[0], -ni[1], -ni[2]];                            // Newell winds inward → flip to the outer skin
      if (cull && dot3(n, sub3(cameraPosition, c)) <= 0) continue;   // cull:false → emit the WHOLE shell (multi-camera scenes; shaded by the outward normal)
      const fill = shadeHex(sampleStickerCard(livery, u, frac(pc / (2 * Math.PI)), ctx), n, light);
      faces.push({ wpts, fill, role: `aircraft-livery:${i}.${j}`, dist: dist(c) });
    }
  }

  // --- appendages: flat card embed (box-net bilinear quad) ---
  const GU = lodCount(30, quality, 12), GV = lodCount(14, quality, 6);   // flat appendages: fewer cells suffice
  for (const quad of appendageQuads(body, resolved.appendages)) {
    const n0 = newellNormal(quad.corners), c0 = centroid(quad.corners);
    const lit = dot3(n0, sub3(cameraPosition, c0)) >= 0 ? n0 : [-n0[0], -n0[1], -n0[2]];
    const aspect = Math.hypot(...sub3(quad.corners[1], quad.corners[0])) / (Math.hypot(...sub3(quad.corners[3], quad.corners[0])) || 1);
    const actx = stickerContext(quad.card, aspect, 1);
    for (let i = 0; i < GU; i += 1) {
      for (let j = 0; j < GV; j += 1) {
        const u0 = i / GU, u1 = (i + 1) / GU, v0 = j / GV, v1 = (j + 1) / GV;
        const wpts = [bilerp4(quad.corners, u0, v0), bilerp4(quad.corners, u1, v0), bilerp4(quad.corners, u1, v1), bilerp4(quad.corners, u0, v1)];
        const fill = shadeHex(sampleStickerCard(quad.card, (u0 + u1) / 2, (v0 + v1) / 2, actx), lit, light);
        faces.push({ wpts, fill, role: `${quad.card.id}:${i}.${j}`, dist: dist(centroid(wpts)) });
      }
    }
  }

  faces.sort((a, b) => b.dist - a.dist);                             // painter order, far → near
  const shapes = faces.map((f) => ({ type: 'poly', points: f.wpts.map(project), fill: f.fill, stroke: 'none', strokeWidth: 0, role: f.role }));
  return { resolved, shapes };
}
