/**
 * Vehicle face cards (vehicle-scoped T-map shelf).
 *
 * A face card is a 2D drawing in normalized face-local (u, v):
 *   - u in [0, 1] runs left -> right across the panel as drawn
 *   - v in [0, 1] runs bottom -> top (v=0 ground, v=1 roof)
 *
 * The card is proportion-agnostic. The face-net (vehicle-face-net.js) owns the
 * vehicle's (L, W, H) box and stretches the unit frame onto the slot's real
 * panel (plate mode) or onto the 3D box face (production mode). One card, two
 * embeddings.
 *
 * Per-face u/v conventions (so cards stay mix-and-matchable):
 *   - side  (L x H): u = along length (0 = back, 1 = front),  v = height
 *   - front (W x H): u = across width (0 = left, 1 = right),  v = height
 *   - back  (W x H): u = across width,                        v = height
 *   - top   (L x W): u = across width,                        v = length (0 = back, 1 = front)
 *
 * aspect: 'square' (front/back, W~=H) | 'rectangle' (side L x H, top L x W).
 *
 * Decorator part kinds the plate/production renderer understands:
 *   - band   { v, h }                          full-width horizontal stripe
 *   - rect   { u, w, v, h }                     panel-local rectangle
 *   - repeat { u0, u1, count, v, h, w?, gap? }  evenly spaced rectangles
 *   - circle { u, v, r }                        r is a fraction of panel height (uniform scale -> stays round)
 *   - wheels { fractions:[u...], v, r, hub? }   circle + optional hub circle per fraction
 *   - line   { u0, v0, u1, v1, dash? }
 * Every part carries { role, fill?, stroke?, strokeWidth?, opacity? }.
 */

export const VEHICLE_FACE_CARDS_VERSION = 'vehicle-face-cards-v0.1.0';

const STROKE = '#6f5430';

// ---- registration bands -------------------------------------------------
// Named vertical (v) reference lines a card's decorators bind to instead of
// magic numbers. They keep structural rules true under variation:
//   - a door binds floor -> windowTop, so it always reaches the top of the
//     windows no matter where the beltline or window count lands;
//   - the truck side window and the truck front windshield share ONE band set,
//     so they are always the same height even across two different cards.
// A part may set `vFrom`/`vTo` (band name or number) instead of `v`/`h`; the
// height is derived. `v0`/`v1` on a line may also be band names.

// Shared by truck-side and truck-front so the side window === windshield band.
const TRUCK_BANDS = Object.freeze({ floor: 0.0, windowBottom: 0.46, windowTop: 0.72, cabRoof: 0.80 });
// Work-truck variants — each side/front pair shares one band set so the cab
// side window and the front windshield stay the same height (the truck rule).
const FIRE_BANDS = Object.freeze({ floor: 0.0, windowBottom: 0.54, windowTop: 0.78, cabRoof: 0.84 });
const DUMP_BANDS = Object.freeze({ floor: 0.0, windowBottom: 0.50, windowTop: 0.72, cabRoof: 0.78 });
const GARBAGE_BANDS = Object.freeze({ floor: 0.0, windowBottom: 0.50, windowTop: 0.72, cabRoof: 0.78 });

// ---- car seam registration ----------------------------------------------
// Cars are not boxes: the side silhouette is a profile CURVE, and the hood is a
// tilted facet folded down from the cowl. These shared seam points make the
// cutouts line up at the T-folds — the side profile's cowl/nose points lie
// exactly on the hood facet's back/front edges. (The new rule, one rung up from
// the scalar bands: a registered curve, not a registered height.)
export const SEDAN_SEAM = Object.freeze({
  cowlAlong: 0.70, cowlZ: 0.62, // windshield base — side profile == hood back edge
  noseAlong: 1.0, noseZ: 0.44, // nose — side profile == hood front edge == front-fascia top
});

// ---- car greenhouse registration ----------------------------------------
// RULE: the side glass is not hand-drawn panes — it is ONE mass that DUPLICATES
// the roof shape (the cabin outline in side view), inset for the frame and
// bisected by the B-pillar. The same four corners drive the side silhouette's
// roofline AND the glass, so the glass is registered to the roof by construction.
export const SEDAN_CABIN = Object.freeze([
  { u: 0.27, v: 0.62 }, // C-pillar base (beltline, rear)
  { u: 0.40, v: 0.86 }, // roof rear (C-pillar top)
  { u: 0.60, v: 0.90 }, // roof front (A-pillar top)
  { u: 0.70, v: 0.62 }, // cowl (A-pillar base)
]);

/** Shrink a polygon toward its centroid by fraction t — the window frame inset. */
export function insetTowardCentroid(points, t) {
  const cu = points.reduce((s, p) => s + p.u, 0) / points.length;
  const cv = points.reduce((s, p) => s + p.v, 0) / points.length;
  return points.map((p) => ({ u: p.u + t * (cu - p.u), v: p.v + t * (cv - p.v) }));
}

const midpoint = (a, b) => ({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 });

/**
 * The car greenhouse principle, reusable across car types/variants: the side
 * glass is ONE mass duplicating the roof shape (cabin corners inset), bisected
 * by the B-pillar from the inset bottom-edge midpoint to the top-edge midpoint.
 * Returns the glass points + the B-pillar endpoints, all registered to `cabin`.
 */
export function cabinGreenhouse(cabin, inset = 0.12) {
  const points = insetTowardCentroid(cabin, inset);
  return { points, bPillarBottom: midpoint(points[0], points[3]), bPillarTop: midpoint(points[1], points[2]) };
}

// SUV: taller, longer flatter roof, more upright pillars (a 2-box wagon cabin).
export const SUV_CABIN = Object.freeze([
  { u: 0.06, v: 0.66 }, // D-pillar base (rear beltline)
  { u: 0.12, v: 0.90 }, // roof rear
  { u: 0.74, v: 0.92 }, // roof front
  { u: 0.80, v: 0.66 }, // cowl (A-pillar base)
]);

const SEDAN_GH = cabinGreenhouse(SEDAN_CABIN);
const SEDAN_GREENHOUSE = SEDAN_GH.points;
const SEDAN_BPILLAR_BOTTOM = SEDAN_GH.bPillarBottom;
const SEDAN_BPILLAR_TOP = SEDAN_GH.bPillarTop;
const SUV_GH = cabinGreenhouse(SUV_CABIN);
const SUV_GREENHOUSE = SUV_GH.points;
const SUV_BPILLAR_BOTTOM = SUV_GH.bPillarBottom;
const SUV_BPILLAR_TOP = SUV_GH.bPillarTop;

function bandValue(bands, ref) {
  if (typeof ref === 'number') return ref;
  if (bands && Object.prototype.hasOwnProperty.call(bands, ref)) return bands[ref];
  throw new Error(`vehicle-face-cards: unknown band "${ref}"`);
}

/**
 * Resolve a card's band-relative parts into concrete (v, h) — and band-named
 * line endpoints — so both renderers consume plain numbers. Pure; returns new
 * part objects.
 */
export function materializeCardParts(card) {
  const bands = card.bands || {};
  const rv = (x) => (typeof x === 'string' ? bandValue(bands, x) : x);
  return (card.parts || []).map((part) => {
    const out = { ...part };
    if (part.vFrom != null || part.vTo != null) {
      out.v = rv(part.vFrom ?? 0);
      out.h = rv(part.vTo) - out.v;
      delete out.vFrom;
      delete out.vTo;
    }
    for (const k of ['v', 'v0', 'v1']) {
      if (typeof out[k] === 'string') out[k] = rv(out[k]);
    }
    return out;
  });
}

export const VEHICLE_FACE_CARDS = [
  // ---- Bus -------------------------------------------------------------
  {
    id: 'bus-side',
    label: 'Bus side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['bus flank', 'coach side', 'transit side'],
    silhouette: { roof: 'rounded', fill: '#e6b66f', stroke: STROKE },
    // floor -> beltline -> windowTop: door spans floor..windowTop (rule).
    bands: { floor: 0.04, beltline: 0.50, windowTop: 0.76 },
    parts: [
      { kind: 'band', role: 'livery-band', v: 0.30, h: 0.11, fill: '#bd7f3f', opacity: 0.72 },
      { kind: 'repeat', role: 'window-repeat', u0: 0.12, u1: 0.66, count: 5, vFrom: 'beltline', vTo: 'windowTop', gap: 0.018, fill: '#9bd0df', stroke: '#315969', strokeWidth: 0.8 },
      { kind: 'rect', role: 'door', u: 0.72, w: 0.085, vFrom: 'floor', vTo: 'windowTop', fill: '#d8eef4', stroke: '#315969', strokeWidth: 0.8 },
      { kind: 'line', role: 'door-split', u0: 0.7625, v0: 'floor', u1: 0.7625, v1: 'windowTop', stroke: '#315969', strokeWidth: 0.6 },
      { kind: 'rect', role: 'route-sign', u: 0.88, w: 0.085, v: 0.60, h: 0.18, fill: '#293241' },
      { kind: 'wheels', role: 'wheel', fractions: [0.20, 0.80], v: 0.13, r: 0.13, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.42, hubFill: '#cbd5e1' },
    ],
  },
  {
    id: 'bus-front',
    label: 'Bus front',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['bus face', 'bus nose'],
    silhouette: { roof: 'rounded', fill: '#e6b66f', stroke: STROKE },
    parts: [
      { kind: 'rect', role: 'route-sign', u: 0.30, w: 0.40, v: 0.82, h: 0.10, fill: '#293241' },
      { kind: 'rect', role: 'front-windshield', u: 0.12, w: 0.76, v: 0.50, h: 0.28, fill: '#9bd0df', stroke: '#315969', strokeWidth: 0.9 },
      { kind: 'rect', role: 'grille', u: 0.22, w: 0.56, v: 0.20, h: 0.12, fill: '#475569' },
      { kind: 'circle', role: 'headlight-l', u: 0.15, v: 0.25, r: 0.06, fill: '#f8d36b', stroke: STROKE, strokeWidth: 0.8 },
      { kind: 'circle', role: 'headlight-r', u: 0.85, v: 0.25, r: 0.06, fill: '#f8d36b', stroke: STROKE, strokeWidth: 0.8 },
      { kind: 'rect', role: 'mirror-l', u: 0.02, w: 0.04, v: 0.55, h: 0.12, fill: '#475569' },
      { kind: 'rect', role: 'mirror-r', u: 0.94, w: 0.04, v: 0.55, h: 0.12, fill: '#475569' },
      { kind: 'band', role: 'front-bumper', v: 0.05, h: 0.06, fill: '#475569' },
    ],
  },
  {
    id: 'bus-back',
    label: 'Bus back',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['bus rear', 'bus tail'],
    silhouette: { roof: 'rounded', fill: '#d9a55f', stroke: STROKE },
    parts: [
      { kind: 'rect', role: 'rear-window', u: 0.16, w: 0.68, v: 0.54, h: 0.26, fill: '#7fa9b5', stroke: '#315969', strokeWidth: 0.9 },
      { kind: 'rect', role: 'tail-light-l', u: 0.09, w: 0.10, v: 0.18, h: 0.16, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.7 },
      { kind: 'rect', role: 'tail-light-r', u: 0.81, w: 0.10, v: 0.18, h: 0.16, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.7 },
      { kind: 'rect', role: 'plate', u: 0.42, w: 0.16, v: 0.12, h: 0.10, fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 0.6 },
      { kind: 'band', role: 'rear-bumper', v: 0.05, h: 0.06, fill: '#475569' },
    ],
  },
  {
    id: 'bus-top',
    label: 'Bus top',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['bus roof', 'bus plan'],
    silhouette: { roof: 'flat', fill: '#f4d8a9', stroke: STROKE },
    parts: [
      { kind: 'line', role: 'centerline', u0: 0.5, v0: 0.03, u1: 0.5, v1: 0.97, stroke: '#b9914f', strokeWidth: 0.8, dash: '6 5' },
      { kind: 'rect', role: 'hvac', u: 0.24, w: 0.52, v: 0.58, h: 0.14, fill: '#cbd5e1', stroke: '#94a3b8', strokeWidth: 0.7 },
      { kind: 'rect', role: 'roof-hatch-1', u: 0.34, w: 0.32, v: 0.24, h: 0.08, fill: '#dbe4ee', stroke: '#94a3b8', strokeWidth: 0.6 },
      { kind: 'rect', role: 'roof-hatch-2', u: 0.34, w: 0.32, v: 0.82, h: 0.08, fill: '#dbe4ee', stroke: '#94a3b8', strokeWidth: 0.6 },
    ],
  },

  // ---- Train (rectangular-wheeled payload segment) ---------------------
  {
    id: 'train-side',
    label: 'Train car side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['rail car side', 'tram side', 'segment flank'],
    silhouette: { roof: 'flat', fill: '#c2ccd6', stroke: '#5b6776' },
    // subway rule: doors span floor..windowTop, same as the bus.
    bands: { floor: 0.04, beltline: 0.54, windowTop: 0.78 },
    parts: [
      { kind: 'band', role: 'livery-band', v: 0.36, h: 0.06, fill: '#d24d3e', opacity: 0.85 },
      { kind: 'repeat', role: 'window-repeat', u0: 0.07, u1: 0.93, count: 9, vFrom: 'beltline', vTo: 'windowTop', gap: 0.012, fill: '#7fb0c4', stroke: '#2f4858', strokeWidth: 0.8 },
      { kind: 'rect', role: 'door-1', u: 0.17, w: 0.06, vFrom: 'floor', vTo: 'windowTop', fill: '#aeb9c4', stroke: '#5b6776', strokeWidth: 0.8 },
      { kind: 'rect', role: 'door-2', u: 0.49, w: 0.06, vFrom: 'floor', vTo: 'windowTop', fill: '#aeb9c4', stroke: '#5b6776', strokeWidth: 0.8 },
      { kind: 'rect', role: 'door-3', u: 0.81, w: 0.06, vFrom: 'floor', vTo: 'windowTop', fill: '#aeb9c4', stroke: '#5b6776', strokeWidth: 0.8 },
      { kind: 'wheels', role: 'bogie', fractions: [0.16, 0.30, 0.70, 0.84], v: 0.10, r: 0.08, fill: '#1f2937', stroke: '#111827', strokeWidth: 0.9, hub: 0.4, hubFill: '#94a3b8' },
    ],
  },
  {
    id: 'train-front',
    label: 'Train cab front',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['locomotive face', 'rail cab', 'tram front'],
    silhouette: { roof: 'rounded', fill: '#c2ccd6', stroke: '#5b6776' },
    parts: [
      { kind: 'rect', role: 'number-board', u: 0.40, w: 0.20, v: 0.84, h: 0.08, fill: '#293241' },
      { kind: 'rect', role: 'front-windshield', u: 0.14, w: 0.72, v: 0.50, h: 0.32, fill: '#7fb0c4', stroke: '#2f4858', strokeWidth: 0.9 },
      { kind: 'circle', role: 'headlight-l', u: 0.20, v: 0.30, r: 0.055, fill: '#f4f1d0', stroke: '#5b6776', strokeWidth: 0.8 },
      { kind: 'circle', role: 'headlight-r', u: 0.80, v: 0.30, r: 0.055, fill: '#f4f1d0', stroke: '#5b6776', strokeWidth: 0.8 },
      { kind: 'rect', role: 'coupler', u: 0.42, w: 0.16, v: 0.02, h: 0.10, fill: '#475569' },
      { kind: 'band', role: 'skirt', v: 0.04, h: 0.05, fill: '#5b6776' },
    ],
  },
  {
    id: 'train-back',
    label: 'Train car back',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['rail car rear', 'segment coupler end'],
    silhouette: { roof: 'flat', fill: '#b6c0cb', stroke: '#5b6776' },
    parts: [
      { kind: 'rect', role: 'gangway', u: 0.30, w: 0.40, v: 0.10, h: 0.72, fill: '#8b97a4', stroke: '#5b6776', strokeWidth: 0.9 },
      { kind: 'rect', role: 'marker-light-l', u: 0.10, w: 0.08, v: 0.20, h: 0.12, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.7 },
      { kind: 'rect', role: 'marker-light-r', u: 0.82, w: 0.08, v: 0.20, h: 0.12, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.7 },
      { kind: 'rect', role: 'coupler', u: 0.44, w: 0.12, v: 0.02, h: 0.10, fill: '#475569' },
    ],
  },
  {
    id: 'train-top',
    label: 'Train car top',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['rail roof', 'pantograph deck'],
    silhouette: { roof: 'flat', fill: '#d3dbe2', stroke: '#5b6776' },
    parts: [
      { kind: 'line', role: 'centerline', u0: 0.5, v0: 0.03, u1: 0.5, v1: 0.97, stroke: '#9aa7b4', strokeWidth: 0.8, dash: '6 5' },
      { kind: 'rect', role: 'pantograph-base', u: 0.28, w: 0.44, v: 0.40, h: 0.18, fill: '#aeb9c4', stroke: '#5b6776', strokeWidth: 0.8 },
      { kind: 'line', role: 'pantograph-arm-a', u0: 0.34, v0: 0.42, u1: 0.5, v1: 0.56, stroke: '#5b6776', strokeWidth: 1.1 },
      { kind: 'line', role: 'pantograph-arm-b', u0: 0.66, v0: 0.42, u1: 0.5, v1: 0.56, stroke: '#5b6776', strokeWidth: 1.1 },
      { kind: 'repeat', role: 'roof-vent', u0: 0.34, u1: 0.66, count: 3, v: 0.74, h: 0.06, fill: '#c2ccd6', stroke: '#94a3b8', strokeWidth: 0.6 },
    ],
  },

  // ---- Truck (long-haul cab + trailer, one T-map) ----------------------
  {
    id: 'truck-side',
    label: 'Truck side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['semi side', 'tractor-trailer flank', 'freight side'],
    silhouette: { roof: 'flat', fill: '#e2e8f0', stroke: '#475569' },
    bands: TRUCK_BANDS,
    parts: [
      // cab sits at the front (u high); trailer fills the back.
      { kind: 'rect', role: 'cab-volume', u: 0.78, w: 0.22, vFrom: 'floor', vTo: 'cabRoof', fill: '#2b6cb0', stroke: '#1a4971', strokeWidth: 1 },
      { kind: 'rect', role: 'cab-window', u: 0.82, w: 0.14, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#9bd0df', stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'line', role: 'coupling-gap', u0: 0.745, v0: 0.0, u1: 0.745, v1: 0.5, stroke: '#475569', strokeWidth: 1.2, dash: '4 3' },
      { kind: 'repeat', role: 'cargo-rib', u0: 0.08, u1: 0.66, count: 6, v: 0.18, h: 0.56, w: 0.008, fill: '#94a3b8' },
      { kind: 'wheels', role: 'wheel', fractions: [0.10, 0.40, 0.52, 0.88], v: 0.10, r: 0.095, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.4, hubFill: '#cbd5e1' },
    ],
  },
  {
    id: 'truck-front',
    label: 'Truck cab front',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['semi face', 'tractor front'],
    silhouette: { roof: 'flat', fill: '#2b6cb0', stroke: '#1a4971' },
    bands: TRUCK_BANDS, // shared with truck-side: windshield === side window height
    parts: [
      { kind: 'rect', role: 'front-windshield', u: 0.14, w: 0.72, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#9bd0df', stroke: '#1a4971', strokeWidth: 0.9 },
      { kind: 'rect', role: 'grille', u: 0.22, w: 0.56, vFrom: 0.26, vTo: 'windowBottom', fill: '#1a4971' },
      { kind: 'repeat', role: 'grille-slat', u0: 0.24, u1: 0.76, count: 4, v: 0.30, h: 0.012, fill: '#9bb4cf' },
      { kind: 'circle', role: 'headlight-l', u: 0.15, v: 0.33, r: 0.06, fill: '#f8d36b', stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'circle', role: 'headlight-r', u: 0.85, v: 0.33, r: 0.06, fill: '#f8d36b', stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'rect', role: 'mirror-l', u: 0.01, w: 0.045, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#1a4971' },
      { kind: 'rect', role: 'mirror-r', u: 0.945, w: 0.045, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#1a4971' },
      { kind: 'band', role: 'front-bumper', v: 0.04, h: 0.08, fill: '#94a3b8' },
    ],
  },
  {
    id: 'truck-back',
    label: 'Truck trailer rear',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['trailer doors', 'box rear'],
    silhouette: { roof: 'flat', fill: '#e2e8f0', stroke: '#475569' },
    parts: [
      { kind: 'rect', role: 'door-l', u: 0.08, w: 0.42, v: 0.06, h: 0.84, fill: '#d7dee5', stroke: '#475569', strokeWidth: 0.9 },
      { kind: 'rect', role: 'door-r', u: 0.50, w: 0.42, v: 0.06, h: 0.84, fill: '#d7dee5', stroke: '#475569', strokeWidth: 0.9 },
      { kind: 'line', role: 'handle-l', u0: 0.44, v0: 0.2, u1: 0.44, v1: 0.7, stroke: '#475569', strokeWidth: 1.1 },
      { kind: 'line', role: 'handle-r', u0: 0.56, v0: 0.2, u1: 0.56, v1: 0.7, stroke: '#475569', strokeWidth: 1.1 },
      { kind: 'rect', role: 'tail-light-l', u: 0.10, w: 0.07, v: 0.10, h: 0.07, fill: '#c0392b' },
      { kind: 'rect', role: 'tail-light-r', u: 0.83, w: 0.07, v: 0.10, h: 0.07, fill: '#c0392b' },
      { kind: 'band', role: 'rear-bumper', v: 0.03, h: 0.05, fill: '#94a3b8' },
    ],
  },
  {
    id: 'truck-top',
    label: 'Truck top',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['trailer roof', 'truck plan'],
    silhouette: { roof: 'flat', fill: '#d7dee5', stroke: '#475569' },
    parts: [
      { kind: 'rect', role: 'cab-roof', u: 0.12, w: 0.76, v: 0.78, h: 0.18, fill: '#2b6cb0', stroke: '#1a4971', strokeWidth: 0.9 },
      { kind: 'line', role: 'coupling-gap', u0: 0.06, v0: 0.745, u1: 0.94, v1: 0.745, stroke: '#475569', strokeWidth: 1.1, dash: '4 3' },
      { kind: 'line', role: 'centerline', u0: 0.5, v0: 0.03, u1: 0.5, v1: 0.72, stroke: '#9aa7b4', strokeWidth: 0.8, dash: '6 5' },
      { kind: 'repeat', role: 'roof-rib', u0: 0.1, u1: 0.9, count: 7, v: 0.08, h: 0.6, w: 0.006, fill: '#aeb9c4' },
    ],
  },

  // ---- Fire engine (pumper) -------------------------------------------
  {
    id: 'firetruck-side',
    label: 'Fire engine side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['fire engine side', 'pumper side', 'fire apparatus flank'],
    silhouette: { roof: 'flat', fill: '#c0392b', stroke: '#7c241a' },
    bands: FIRE_BANDS,
    parts: [
      { kind: 'rect', role: 'ladder', u: 0.06, w: 0.88, v: 0.86, h: 0.035, fill: '#d7b740', stroke: '#9c7e1f', strokeWidth: 0.6 },
      { kind: 'band', role: 'reflective-stripe', v: 0.30, h: 0.05, fill: '#f4d03f', opacity: 0.9 },
      { kind: 'rect', role: 'cab-window', u: 0.80, w: 0.16, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#bcd8e6', stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'rect', role: 'crew-window', u: 0.70, w: 0.07, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#bcd8e6', stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'repeat', role: 'equipment-locker', u0: 0.06, u1: 0.64, count: 4, v: 0.18, h: 0.30, gap: 0.02, fill: '#cfd6dd', stroke: '#7c8893', strokeWidth: 0.7 },
      { kind: 'rect', role: 'pump-panel', u: 0.62, w: 0.07, v: 0.20, h: 0.30, fill: '#aeb6bf', stroke: '#7c8893', strokeWidth: 0.7 },
      { kind: 'rect', role: 'light-bar', u: 0.78, w: 0.18, vFrom: 'cabRoof', vTo: 0.90, fill: '#e23b2e', stroke: '#7c241a', strokeWidth: 0.6 },
      { kind: 'wheels', role: 'wheel', fractions: [0.14, 0.80], v: 0.12, r: 0.12, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.42, hubFill: '#cbd5e1' },
    ],
  },
  {
    id: 'firetruck-front',
    label: 'Fire engine front',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['fire engine face', 'pumper front'],
    silhouette: { roof: 'flat', fill: '#c0392b', stroke: '#7c241a' },
    bands: FIRE_BANDS,
    parts: [
      { kind: 'rect', role: 'light-bar-red', u: 0.22, w: 0.28, vFrom: 'cabRoof', vTo: 0.92, fill: '#e23b2e', stroke: '#7c241a', strokeWidth: 0.6 },
      { kind: 'rect', role: 'light-bar-blue', u: 0.50, w: 0.28, vFrom: 'cabRoof', vTo: 0.92, fill: '#2f6fb0', stroke: '#1a4971', strokeWidth: 0.6 },
      { kind: 'rect', role: 'front-windshield', u: 0.14, w: 0.72, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#bcd8e6', stroke: '#1a4971', strokeWidth: 0.9 },
      { kind: 'rect', role: 'grille', u: 0.24, w: 0.52, vFrom: 0.30, vTo: 'windowBottom', fill: '#7c241a' },
      { kind: 'circle', role: 'headlight-l', u: 0.16, v: 0.34, r: 0.06, fill: '#f8d36b', stroke: '#7c241a', strokeWidth: 0.8 },
      { kind: 'circle', role: 'headlight-r', u: 0.84, v: 0.34, r: 0.06, fill: '#f8d36b', stroke: '#7c241a', strokeWidth: 0.8 },
      { kind: 'rect', role: 'front-intake', u: 0.40, w: 0.20, v: 0.12, h: 0.10, fill: '#aeb6bf', stroke: '#7c8893', strokeWidth: 0.7 },
      { kind: 'band', role: 'front-bumper', v: 0.04, h: 0.07, fill: '#9aa3ad' },
    ],
  },
  {
    id: 'firetruck-back',
    label: 'Fire engine back',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['fire engine rear', 'pumper tail'],
    silhouette: { roof: 'flat', fill: '#b5331f', stroke: '#7c241a' },
    parts: [
      { kind: 'rect', role: 'hose-bed', u: 0.16, w: 0.68, v: 0.34, h: 0.42, fill: '#cfd6dd', stroke: '#7c8893', strokeWidth: 0.8 },
      { kind: 'repeat', role: 'hazard-stripe', u0: 0.04, u1: 0.96, count: 6, v: 0.06, h: 0.22, gap: 0.01, fill: '#f4d03f' },
      { kind: 'rect', role: 'tail-light-l', u: 0.07, w: 0.08, v: 0.40, h: 0.12, fill: '#f2b705' },
      { kind: 'rect', role: 'tail-light-r', u: 0.85, w: 0.08, v: 0.40, h: 0.12, fill: '#f2b705' },
      { kind: 'rect', role: 'ladder-overhang', u: 0.10, w: 0.80, v: 0.84, h: 0.03, fill: '#d7b740', stroke: '#9c7e1f', strokeWidth: 0.5 },
    ],
  },
  {
    id: 'firetruck-top',
    label: 'Fire engine top',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['fire engine roof', 'pumper plan'],
    silhouette: { roof: 'flat', fill: '#b5331f', stroke: '#7c241a' },
    parts: [
      { kind: 'rect', role: 'cab-roof', u: 0.12, w: 0.76, v: 0.82, h: 0.16, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.8 },
      { kind: 'rect', role: 'light-bar', u: 0.20, w: 0.60, v: 0.86, h: 0.06, fill: '#e23b2e', stroke: '#7c241a', strokeWidth: 0.6 },
      { kind: 'line', role: 'ladder-rail-l', u0: 0.38, v0: 0.05, u1: 0.38, v1: 0.80, stroke: '#d7b740', strokeWidth: 1.4 },
      { kind: 'line', role: 'ladder-rail-r', u0: 0.62, v0: 0.05, u1: 0.62, v1: 0.80, stroke: '#d7b740', strokeWidth: 1.4 },
      { kind: 'rect', role: 'pump-monitor', u: 0.42, w: 0.16, v: 0.46, h: 0.10, fill: '#aeb6bf', stroke: '#7c8893', strokeWidth: 0.7 },
    ],
  },

  // ---- Dump truck -----------------------------------------------------
  {
    id: 'dumptruck-side',
    label: 'Dump truck side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['dump truck side', 'tipper side', 'construction truck flank'],
    silhouette: { roof: 'flat', fill: '#6b7280', stroke: '#3f4651' },
    bands: DUMP_BANDS,
    parts: [
      { kind: 'rect', role: 'cab-volume', u: 0.72, w: 0.28, vFrom: 'floor', vTo: 'cabRoof', fill: '#e08a2c', stroke: '#9c5a12', strokeWidth: 1 },
      { kind: 'rect', role: 'cab-window', u: 0.78, w: 0.16, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#bcd8e6', stroke: '#9c5a12', strokeWidth: 0.8 },
      { kind: 'rect', role: 'bed-top-rail', u: 0.04, w: 0.62, v: 0.74, h: 0.05, fill: '#525a64', stroke: '#3f4651', strokeWidth: 0.7 },
      { kind: 'repeat', role: 'bed-rib', u0: 0.06, u1: 0.64, count: 6, v: 0.12, h: 0.62, w: 0.009, fill: '#535b65' },
      { kind: 'line', role: 'hydraulic-ram', u0: 0.69, v0: 0.10, u1: 0.58, v1: 0.42, stroke: '#3f4651', strokeWidth: 1.6 },
      { kind: 'wheels', role: 'wheel', fractions: [0.16, 0.72, 0.86], v: 0.12, r: 0.12, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.4, hubFill: '#cbd5e1' },
    ],
  },
  {
    id: 'dumptruck-front',
    label: 'Dump truck front',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['dump truck face', 'tipper front'],
    silhouette: { roof: 'flat', fill: '#e08a2c', stroke: '#9c5a12' },
    bands: DUMP_BANDS,
    parts: [
      { kind: 'rect', role: 'bed-headboard', u: 0.06, w: 0.88, vFrom: 'cabRoof', vTo: 0.98, fill: '#6b7280', stroke: '#3f4651', strokeWidth: 0.8 },
      { kind: 'rect', role: 'front-windshield', u: 0.14, w: 0.72, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#bcd8e6', stroke: '#9c5a12', strokeWidth: 0.9 },
      { kind: 'rect', role: 'grille', u: 0.24, w: 0.52, vFrom: 0.30, vTo: 'windowBottom', fill: '#9c5a12' },
      { kind: 'circle', role: 'headlight-l', u: 0.16, v: 0.34, r: 0.06, fill: '#f8d36b', stroke: '#9c5a12', strokeWidth: 0.8 },
      { kind: 'circle', role: 'headlight-r', u: 0.84, v: 0.34, r: 0.06, fill: '#f8d36b', stroke: '#9c5a12', strokeWidth: 0.8 },
      { kind: 'band', role: 'front-bumper', v: 0.03, h: 0.08, fill: '#9aa3ad' },
    ],
  },
  {
    id: 'dumptruck-back',
    label: 'Dump truck back',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['dump truck rear', 'tipper tailgate'],
    silhouette: { roof: 'flat', fill: '#6b7280', stroke: '#3f4651' },
    parts: [
      { kind: 'poly', role: 'tailgate', points: [{ u: 0.12, v: 0.12 }, { u: 0.88, v: 0.12 }, { u: 0.82, v: 0.84 }, { u: 0.18, v: 0.84 }], fill: '#7a828c', stroke: '#3f4651', strokeWidth: 1 },
      { kind: 'rect', role: 'hinge-l', u: 0.18, w: 0.05, v: 0.80, h: 0.08, fill: '#3f4651' },
      { kind: 'rect', role: 'hinge-r', u: 0.77, w: 0.05, v: 0.80, h: 0.08, fill: '#3f4651' },
      { kind: 'repeat', role: 'hazard-stripe', u0: 0.06, u1: 0.94, count: 6, v: 0.02, h: 0.10, gap: 0.01, fill: '#f2b705' },
      { kind: 'rect', role: 'tail-light-l', u: 0.10, w: 0.07, v: 0.20, h: 0.10, fill: '#c0392b' },
      { kind: 'rect', role: 'tail-light-r', u: 0.83, w: 0.07, v: 0.20, h: 0.10, fill: '#c0392b' },
    ],
  },
  {
    id: 'dumptruck-top',
    label: 'Dump truck top',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['dump truck roof', 'open bed plan'],
    silhouette: { roof: 'flat', fill: '#525a64', stroke: '#3f4651' },
    parts: [
      { kind: 'rect', role: 'cab-roof', u: 0.12, w: 0.76, v: 0.80, h: 0.16, fill: '#e08a2c', stroke: '#9c5a12', strokeWidth: 0.8 },
      { kind: 'rect', role: 'bed-opening', u: 0.10, w: 0.80, v: 0.06, h: 0.66, fill: '#33383f', stroke: '#3f4651', strokeWidth: 0.9 },
      { kind: 'rect', role: 'bed-liner', u: 0.16, w: 0.68, v: 0.12, h: 0.54, fill: '#454c54', stroke: '#3f4651', strokeWidth: 0.6 },
    ],
  },

  // ---- Garbage truck (rear loader) ------------------------------------
  {
    id: 'garbagetruck-side',
    label: 'Garbage truck side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['garbage truck side', 'refuse truck side', 'bin lorry flank'],
    silhouette: { roof: 'flat', fill: '#3f7d5a', stroke: '#255038' },
    bands: GARBAGE_BANDS,
    parts: [
      { kind: 'poly', role: 'rear-hopper', points: [{ u: 0.0, v: 0.30 }, { u: 0.20, v: 0.18 }, { u: 0.20, v: 0.66 }, { u: 0.0, v: 0.66 }], fill: '#586b60', stroke: '#255038', strokeWidth: 0.9 },
      { kind: 'rect', role: 'cab-volume', u: 0.74, w: 0.26, vFrom: 'floor', vTo: 'cabRoof', fill: '#357050', stroke: '#255038', strokeWidth: 1 },
      { kind: 'rect', role: 'cab-window', u: 0.80, w: 0.15, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#bcd8e6', stroke: '#255038', strokeWidth: 0.8 },
      { kind: 'line', role: 'packer-seam', u0: 0.20, v0: 0.50, u1: 0.72, v1: 0.50, stroke: '#255038', strokeWidth: 1 },
      { kind: 'repeat', role: 'body-panel', u0: 0.24, u1: 0.70, count: 4, v: 0.16, h: 0.56, w: 0.008, fill: '#2f6147' },
      { kind: 'rect', role: 'lift-arm', u: 0.10, w: 0.06, v: 0.22, h: 0.34, fill: '#2f6147', stroke: '#255038', strokeWidth: 0.7 },
      { kind: 'wheels', role: 'wheel', fractions: [0.30, 0.76, 0.90], v: 0.11, r: 0.11, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.4, hubFill: '#cbd5e1' },
    ],
  },
  {
    id: 'garbagetruck-front',
    label: 'Garbage truck front',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['garbage truck face', 'refuse truck front'],
    silhouette: { roof: 'flat', fill: '#357050', stroke: '#255038' },
    bands: GARBAGE_BANDS,
    parts: [
      { kind: 'rect', role: 'beacon', u: 0.38, w: 0.24, vFrom: 'cabRoof', vTo: 0.92, fill: '#f2b705', stroke: '#9c7e1f', strokeWidth: 0.6 },
      { kind: 'rect', role: 'front-windshield', u: 0.14, w: 0.72, vFrom: 'windowBottom', vTo: 'windowTop', fill: '#bcd8e6', stroke: '#255038', strokeWidth: 0.9 },
      { kind: 'rect', role: 'grille', u: 0.24, w: 0.52, vFrom: 0.30, vTo: 'windowBottom', fill: '#255038' },
      { kind: 'circle', role: 'headlight-l', u: 0.16, v: 0.34, r: 0.06, fill: '#f8d36b', stroke: '#255038', strokeWidth: 0.8 },
      { kind: 'circle', role: 'headlight-r', u: 0.84, v: 0.34, r: 0.06, fill: '#f8d36b', stroke: '#255038', strokeWidth: 0.8 },
      { kind: 'band', role: 'front-bumper', v: 0.04, h: 0.07, fill: '#9aa3ad' },
    ],
  },
  {
    id: 'garbagetruck-back',
    label: 'Garbage truck back',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['garbage truck rear', 'refuse loader hopper'],
    silhouette: { roof: 'flat', fill: '#357050', stroke: '#255038' },
    parts: [
      { kind: 'poly', role: 'loading-hopper', points: [{ u: 0.10, v: 0.06 }, { u: 0.90, v: 0.06 }, { u: 0.78, v: 0.70 }, { u: 0.22, v: 0.70 }], fill: '#586b60', stroke: '#255038', strokeWidth: 1 },
      { kind: 'rect', role: 'hopper-lip', u: 0.20, w: 0.60, v: 0.66, h: 0.07, fill: '#46584e', stroke: '#255038', strokeWidth: 0.7 },
      { kind: 'repeat', role: 'hazard-stripe', u0: 0.06, u1: 0.94, count: 6, v: 0.02, h: 0.10, gap: 0.01, fill: '#f2b705' },
      { kind: 'rect', role: 'tail-light-l', u: 0.10, w: 0.07, v: 0.74, h: 0.10, fill: '#c0392b' },
      { kind: 'rect', role: 'tail-light-r', u: 0.83, w: 0.07, v: 0.74, h: 0.10, fill: '#c0392b' },
    ],
  },
  {
    id: 'garbagetruck-top',
    label: 'Garbage truck top',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['garbage truck roof', 'refuse truck plan'],
    silhouette: { roof: 'flat', fill: '#2f6147', stroke: '#255038' },
    parts: [
      { kind: 'rect', role: 'cab-roof', u: 0.12, w: 0.76, v: 0.80, h: 0.16, fill: '#357050', stroke: '#255038', strokeWidth: 0.8 },
      { kind: 'rect', role: 'body-hatch', u: 0.28, w: 0.44, v: 0.30, h: 0.30, fill: '#3f7d5a', stroke: '#255038', strokeWidth: 0.7 },
      { kind: 'line', role: 'centerline', u0: 0.5, v0: 0.04, u1: 0.5, v1: 0.74, stroke: '#255038', strokeWidth: 0.8, dash: '6 5' },
    ],
  },

  // ---- Sedan (car: realistic 3-box, profile cutouts, slope + fascia rule) ----
  // The form is vector-space only; only these stickers paint. The side is the
  // profile CURVE; cowl (0.70, 0.62) and nose (1.0, 0.44) are the SEDAN_SEAM
  // points the hood facet also rides on. Fascia parts (grille/lights/plate) are
  // tagged `plane: 'fascia'` so they land on the vertical END of the slope (the
  // nose/tail), not flat on the hood/deck — the slope-vs-fascia rule.
  {
    id: 'sedan-side',
    label: 'Sedan side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['car side', 'sedan profile', 'automobile flank'],
    silhouette: {
      fill: '#3b6ea5',
      stroke: '#24486b',
      profile: [
        { u: 0.04, v: 0.56 }, { u: 0.07, v: 0.61 }, // trunk
        SEDAN_CABIN[0], SEDAN_CABIN[1], SEDAN_CABIN[2], SEDAN_CABIN[3], // roofline (registered)
        { u: 0.78, v: 0.625 }, { u: 0.86, v: 0.60 }, { u: 0.94, v: 0.535 },
        { u: 1.00, v: 0.44 }, // curved hood -> NOSE seam (fascia top)
        { u: 1.00, v: 0.20 }, { u: 0.04, v: 0.20 }, // sill / lower body
      ],
    },
    parts: [
      { kind: 'line', role: 'beltline', u0: 0.08, v0: 0.625, u1: 0.66, v1: 0.625, stroke: '#24486b', strokeWidth: 0.9 },
      // RULE: one glass mass duplicating the roof shape (SEDAN_CABIN inset),
      // bisected by the B-pillar. Registered to the roofline, not hand-drawn.
      { kind: 'poly', role: 'greenhouse', points: SEDAN_GREENHOUSE, fill: '#bcd8e6', stroke: '#24486b', strokeWidth: 0.7 },
      { kind: 'line', role: 'b-pillar', u0: SEDAN_BPILLAR_BOTTOM.u, v0: SEDAN_BPILLAR_BOTTOM.v, u1: SEDAN_BPILLAR_TOP.u, v1: SEDAN_BPILLAR_TOP.v, stroke: '#24486b', strokeWidth: 1.0 },
      { kind: 'line', role: 'door-cut', u0: 0.49, v0: 0.21, u1: 0.49, v1: 0.62, stroke: '#24486b', strokeWidth: 0.6 },
      { kind: 'rect', role: 'door-handle', u: 0.53, w: 0.05, v: 0.575, h: 0.02, fill: '#1c3a57' },
      { kind: 'wheels', role: 'wheel', fractions: [0.20, 0.80], v: 0.30, r: 0.18, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.42, hubFill: '#cbd5e1' },
    ],
  },
  {
    id: 'sedan-front',
    label: 'Sedan front (windshield + fascia)',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['car front', 'sedan face', 'front fascia'],
    // RULE: the windshield-face is a flush rectangular sticker at the cowl.
    // Hood separation carries the rake; this face must not taper into a pyramid.
    // Fascia parts sit below the hood gap and are tagged 'fascia' -> the nose
    // end-cap plane.
    silhouette: {
      fill: '#3b6ea5',
      stroke: '#24486b',
      profile: [{ u: 0.04, v: 0.62 }, { u: 0.96, v: 0.62 }, { u: 0.96, v: 0.90 }, { u: 0.04, v: 0.90 }],
    },
    parts: [
      { kind: 'poly', role: 'windshield-glass', points: [{ u: 0.12, v: 0.64 }, { u: 0.88, v: 0.64 }, { u: 0.88, v: 0.885 }, { u: 0.12, v: 0.885 }], fill: '#bcd8e6', stroke: '#24486b', strokeWidth: 0.6 },
      { kind: 'line', role: 'wiper-l', u0: 0.40, v0: 0.655, u1: 0.47, v1: 0.71, stroke: '#1c3a57', strokeWidth: 0.7 },
      { kind: 'line', role: 'wiper-r', u0: 0.53, v0: 0.655, u1: 0.60, v1: 0.71, stroke: '#1c3a57', strokeWidth: 0.7 },
      // --- front fascia (vertical nose end-cap) ---
      { kind: 'rect', role: 'fascia-panel', plane: 'fascia', u: 0.07, w: 0.86, v: 0.20, h: 0.24, fill: '#3b6ea5', stroke: '#24486b', strokeWidth: 0.8 },
      { kind: 'rect', role: 'grille', plane: 'fascia', u: 0.27, w: 0.46, v: 0.255, h: 0.11, fill: '#1c2a38', stroke: '#24486b', strokeWidth: 0.6 },
      { kind: 'line', role: 'grille-bar', plane: 'fascia', u0: 0.27, v0: 0.31, u1: 0.73, v1: 0.31, stroke: '#3b6ea5', strokeWidth: 0.8 },
      { kind: 'circle', role: 'headlight-l', plane: 'fascia', u: 0.165, v: 0.37, r: 0.045, fill: '#f8f4d0', stroke: '#24486b', strokeWidth: 0.7 },
      { kind: 'circle', role: 'headlight-r', plane: 'fascia', u: 0.835, v: 0.37, r: 0.045, fill: '#f8f4d0', stroke: '#24486b', strokeWidth: 0.7 },
      { kind: 'rect', role: 'bumper', plane: 'fascia', u: 0.05, w: 0.90, v: 0.205, h: 0.045, fill: '#9aa3ad' },
    ],
  },
  {
    id: 'sedan-hood',
    label: 'Sedan hood (slope skin)',
    faceKind: 'hood',
    aspect: 'rectangle',
    aliases: ['car hood', 'bonnet', 'sedan hood facet'],
    // Slope skin ONLY — grille/lights live on the front fascia, not here.
    silhouette: {
      fill: '#3b6ea5',
      stroke: '#24486b',
      profile: [{ u: 0.07, v: 0.0 }, { u: 0.93, v: 0.0 }, { u: 0.88, v: 1.0 }, { u: 0.12, v: 1.0 }],
    },
    parts: [
      { kind: 'line', role: 'hood-crease', u0: 0.5, v0: 0.06, u1: 0.5, v1: 0.92, stroke: '#2c5781', strokeWidth: 0.8 },
      { kind: 'line', role: 'hood-crease-l', u0: 0.28, v0: 0.08, u1: 0.24, v1: 0.9, stroke: '#2c5781', strokeWidth: 0.6 },
      { kind: 'line', role: 'hood-crease-r', u0: 0.72, v0: 0.08, u1: 0.76, v1: 0.9, stroke: '#2c5781', strokeWidth: 0.6 },
      { kind: 'circle', role: 'emblem', u: 0.5, v: 0.12, r: 0.028, fill: '#cbd5e1' },
    ],
  },
  {
    id: 'sedan-deck',
    label: 'Sedan deck (rear slope skin)',
    faceKind: 'deck',
    aspect: 'rectangle',
    aliases: ['trunk lid', 'rear deck'],
    // Rear slope skin (trunk lid). u = width, v = rear-cowl(0) -> tail(1).
    silhouette: {
      fill: '#3b6ea5',
      stroke: '#24486b',
      profile: [{ u: 0.12, v: 0.0 }, { u: 0.88, v: 0.0 }, { u: 0.84, v: 1.0 }, { u: 0.16, v: 1.0 }],
    },
    parts: [
      { kind: 'line', role: 'deck-crease', u0: 0.5, v0: 0.08, u1: 0.5, v1: 0.92, stroke: '#2c5781', strokeWidth: 0.7, dash: '5 4' },
      { kind: 'line', role: 'trunk-edge', u0: 0.16, v0: 0.9, u1: 0.84, v1: 0.9, stroke: '#24486b', strokeWidth: 0.8 },
    ],
  },
  {
    id: 'sedan-back',
    label: 'Sedan back (glass + fascia)',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['car rear', 'sedan trunk', 'rear fascia'],
    // silhouette = flush rectangular backlight sticker (rear-cowl plane).
    // Fascia parts -> tail end-cap.
    silhouette: {
      fill: '#3b6ea5',
      stroke: '#24486b',
      profile: [{ u: 0.26, v: 0.60 }, { u: 0.74, v: 0.60 }, { u: 0.74, v: 0.86 }, { u: 0.26, v: 0.86 }],
    },
    parts: [
      { kind: 'poly', role: 'rear-glass', points: [{ u: 0.32, v: 0.615 }, { u: 0.68, v: 0.615 }, { u: 0.68, v: 0.845 }, { u: 0.32, v: 0.845 }], fill: '#bcd8e6', stroke: '#24486b', strokeWidth: 0.6 },
      // --- rear fascia (vertical tail end-cap) ---
      { kind: 'rect', role: 'fascia-panel', plane: 'fascia', u: 0.06, w: 0.88, v: 0.20, h: 0.32, fill: '#3b6ea5', stroke: '#24486b', strokeWidth: 0.8 },
      { kind: 'rect', role: 'tail-light-l', plane: 'fascia', u: 0.10, w: 0.16, v: 0.40, h: 0.09, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.6 },
      { kind: 'rect', role: 'tail-light-r', plane: 'fascia', u: 0.74, w: 0.16, v: 0.40, h: 0.09, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.6 },
      { kind: 'rect', role: 'plate', plane: 'fascia', u: 0.42, w: 0.16, v: 0.28, h: 0.07, fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 0.6 },
      { kind: 'rect', role: 'bumper', plane: 'fascia', u: 0.05, w: 0.90, v: 0.205, h: 0.045, fill: '#9aa3ad' },
    ],
  },
  {
    id: 'sedan-top',
    label: 'Sedan roof',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['car roof', 'sedan greenhouse'],
    // Cabin roof only (seated over roofAlong); u = width, v = rear(0) -> front(1).
    silhouette: {
      fill: '#33608f',
      stroke: '#24486b',
      profile: [
        { u: 0.22, v: 0.0 }, { u: 0.78, v: 0.0 }, { u: 0.88, v: 0.22 },
        { u: 0.88, v: 0.78 }, { u: 0.78, v: 1.0 }, { u: 0.22, v: 1.0 },
        { u: 0.12, v: 0.78 }, { u: 0.12, v: 0.22 },
      ],
    },
    parts: [
      { kind: 'rect', role: 'sunroof', u: 0.32, w: 0.36, v: 0.36, h: 0.28, fill: '#1c3a57', stroke: '#24486b', strokeWidth: 0.6 },
      { kind: 'line', role: 'centerline', u0: 0.5, v0: 0.06, u1: 0.5, v1: 0.94, stroke: '#2c5781', strokeWidth: 0.7, dash: '5 4' },
    ],
  },

  // ---- SUV (car type: same principles, taller 2-box, near-vertical liftgate)
  // Greenhouse = SUV_CABIN inset + bisected (registered); full-width windshield;
  // fascia rule (lights/plate on the vertical ends); hood/deck slope skins.
  {
    id: 'suv-side',
    label: 'SUV side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['suv side', 'crossover profile', 'wagon flank'],
    silhouette: {
      fill: '#4b5e6b',
      stroke: '#28333b',
      profile: [
        { u: 0.05, v: 0.40 }, { u: 0.05, v: 0.62 }, // near-vertical liftgate
        SUV_CABIN[0], SUV_CABIN[1], SUV_CABIN[2], SUV_CABIN[3], // roofline (registered)
        { u: 0.90, v: 0.60 }, { u: 1.00, v: 0.50 }, // short hood -> nose
        { u: 1.00, v: 0.20 }, { u: 0.05, v: 0.20 }, // sill / lower body
      ],
    },
    parts: [
      { kind: 'line', role: 'beltline', u0: 0.08, v0: 0.665, u1: 0.78, v1: 0.665, stroke: '#28333b', strokeWidth: 0.9 },
      { kind: 'band', role: 'cladding', v: 0.20, h: 0.10, fill: '#2f3a42', opacity: 0.85 },
      { kind: 'poly', role: 'greenhouse', points: SUV_GREENHOUSE, fill: '#bcd8e6', stroke: '#28333b', strokeWidth: 0.7 },
      { kind: 'line', role: 'b-pillar', u0: SUV_BPILLAR_BOTTOM.u, v0: SUV_BPILLAR_BOTTOM.v, u1: SUV_BPILLAR_TOP.u, v1: SUV_BPILLAR_TOP.v, stroke: '#28333b', strokeWidth: 1.0 },
      { kind: 'rect', role: 'roof-rail', u: 0.14, w: 0.58, v: 0.925, h: 0.022, fill: '#1c242a' },
      { kind: 'line', role: 'door-cut', u0: 0.45, v0: 0.21, u1: 0.45, v1: 0.66, stroke: '#28333b', strokeWidth: 0.6 },
      { kind: 'rect', role: 'door-handle', u: 0.50, w: 0.05, v: 0.62, h: 0.02, fill: '#161d22' },
      { kind: 'wheels', role: 'wheel', fractions: [0.22, 0.80], v: 0.32, r: 0.20, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.42, hubFill: '#cbd5e1' },
    ],
  },
  {
    id: 'suv-front',
    label: 'SUV front (windshield + fascia)',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['suv front', 'crossover face'],
    // full-width windshield at the cowl; fascia parts ride the vertical nose.
    silhouette: {
      fill: '#4b5e6b',
      stroke: '#28333b',
      profile: [{ u: 0.04, v: 0.66 }, { u: 0.96, v: 0.66 }, { u: 0.80, v: 0.92 }, { u: 0.20, v: 0.92 }],
    },
    parts: [
      { kind: 'poly', role: 'windshield-glass', points: [{ u: 0.13, v: 0.68 }, { u: 0.87, v: 0.68 }, { u: 0.87, v: 0.905 }, { u: 0.13, v: 0.905 }], fill: '#bcd8e6', stroke: '#28333b', strokeWidth: 0.6 },
      { kind: 'line', role: 'wiper-l', u0: 0.40, v0: 0.69, u1: 0.47, v1: 0.74, stroke: '#161d22', strokeWidth: 0.7 },
      { kind: 'line', role: 'wiper-r', u0: 0.53, v0: 0.69, u1: 0.60, v1: 0.74, stroke: '#161d22', strokeWidth: 0.7 },
      { kind: 'rect', role: 'fascia-panel', plane: 'fascia', u: 0.05, w: 0.90, v: 0.20, h: 0.30, fill: '#4b5e6b', stroke: '#28333b', strokeWidth: 0.8 },
      { kind: 'rect', role: 'skid-plate', plane: 'fascia', u: 0.30, w: 0.40, v: 0.205, h: 0.06, fill: '#2f3a42' },
      { kind: 'rect', role: 'grille', plane: 'fascia', u: 0.22, w: 0.56, v: 0.30, h: 0.14, fill: '#161d22', stroke: '#28333b', strokeWidth: 0.6 },
      { kind: 'circle', role: 'headlight-l', plane: 'fascia', u: 0.16, v: 0.41, r: 0.05, fill: '#f8f4d0', stroke: '#28333b', strokeWidth: 0.7 },
      { kind: 'circle', role: 'headlight-r', plane: 'fascia', u: 0.84, v: 0.41, r: 0.05, fill: '#f8f4d0', stroke: '#28333b', strokeWidth: 0.7 },
      { kind: 'rect', role: 'bumper', plane: 'fascia', u: 0.04, w: 0.92, v: 0.205, h: 0.05, fill: '#2f3a42' },
    ],
  },
  {
    id: 'suv-back',
    label: 'SUV back (liftgate + fascia)',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['suv rear', 'liftgate', 'tailgate'],
    silhouette: {
      fill: '#4b5e6b',
      stroke: '#28333b',
      profile: [{ u: 0.08, v: 0.20 }, { u: 0.92, v: 0.20 }, { u: 0.88, v: 0.90 }, { u: 0.12, v: 0.90 }],
    },
    parts: [
      { kind: 'poly', role: 'rear-glass', points: [{ u: 0.18, v: 0.58 }, { u: 0.82, v: 0.58 }, { u: 0.82, v: 0.86 }, { u: 0.18, v: 0.86 }], fill: '#bcd8e6', stroke: '#28333b', strokeWidth: 0.6 },
      { kind: 'line', role: 'rear-wiper', u0: 0.40, v0: 0.66, u1: 0.50, v1: 0.62, stroke: '#161d22', strokeWidth: 0.8 },
      { kind: 'rect', role: 'fascia-panel', plane: 'fascia', u: 0.06, w: 0.88, v: 0.20, h: 0.34, fill: '#4b5e6b', stroke: '#28333b', strokeWidth: 0.8 },
      { kind: 'rect', role: 'tail-light-l', plane: 'fascia', u: 0.08, w: 0.10, v: 0.40, h: 0.16, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.6 },
      { kind: 'rect', role: 'tail-light-r', plane: 'fascia', u: 0.82, w: 0.10, v: 0.40, h: 0.16, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.6 },
      { kind: 'rect', role: 'plate', plane: 'fascia', u: 0.42, w: 0.16, v: 0.30, h: 0.08, fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 0.6 },
      { kind: 'rect', role: 'bumper', plane: 'fascia', u: 0.05, w: 0.90, v: 0.205, h: 0.05, fill: '#2f3a42' },
    ],
  },
  {
    id: 'suv-deck',
    label: 'SUV deck (short rear slope)',
    faceKind: 'deck',
    aspect: 'rectangle',
    aliases: ['suv roof spoiler', 'tailgate top'],
    silhouette: {
      fill: '#4b5e6b',
      stroke: '#28333b',
      profile: [{ u: 0.14, v: 0.0 }, { u: 0.86, v: 0.0 }, { u: 0.84, v: 1.0 }, { u: 0.16, v: 1.0 }],
    },
    parts: [
      { kind: 'rect', role: 'spoiler', u: 0.18, w: 0.64, v: 0.55, h: 0.30, fill: '#2f3a42', stroke: '#28333b', strokeWidth: 0.6 },
    ],
  },
  {
    id: 'suv-hood',
    label: 'SUV hood (slope skin)',
    faceKind: 'hood',
    aspect: 'rectangle',
    aliases: ['suv hood', 'crossover bonnet'],
    silhouette: {
      fill: '#4b5e6b',
      stroke: '#28333b',
      profile: [{ u: 0.06, v: 0.0 }, { u: 0.94, v: 0.0 }, { u: 0.88, v: 1.0 }, { u: 0.12, v: 1.0 }],
    },
    parts: [
      { kind: 'line', role: 'hood-crease-l', u0: 0.30, v0: 0.08, u1: 0.26, v1: 0.9, stroke: '#39454e', strokeWidth: 0.7 },
      { kind: 'line', role: 'hood-crease-r', u0: 0.70, v0: 0.08, u1: 0.74, v1: 0.9, stroke: '#39454e', strokeWidth: 0.7 },
      { kind: 'rect', role: 'emblem', u: 0.47, w: 0.06, v: 0.12, h: 0.05, fill: '#cbd5e1' },
    ],
  },
  {
    id: 'suv-top',
    label: 'SUV roof',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['suv roof', 'crossover roof rack'],
    silhouette: {
      fill: '#3c4d59',
      stroke: '#28333b',
      profile: [
        { u: 0.20, v: 0.0 }, { u: 0.80, v: 0.0 }, { u: 0.90, v: 0.14 },
        { u: 0.90, v: 0.86 }, { u: 0.80, v: 1.0 }, { u: 0.20, v: 1.0 },
        { u: 0.10, v: 0.86 }, { u: 0.10, v: 0.14 },
      ],
    },
    parts: [
      { kind: 'rect', role: 'sunroof', u: 0.30, w: 0.40, v: 0.40, h: 0.34, fill: '#1c242a', stroke: '#28333b', strokeWidth: 0.6 },
      { kind: 'line', role: 'roof-rail-l', u0: 0.16, v0: 0.06, u1: 0.16, v1: 0.94, stroke: '#1c242a', strokeWidth: 1.2 },
      { kind: 'line', role: 'roof-rail-r', u0: 0.84, v0: 0.06, u1: 0.84, v1: 0.94, stroke: '#1c242a', strokeWidth: 1.2 },
      { kind: 'repeat', role: 'crossbar', u0: 0.16, u1: 0.84, count: 2, v: 0.30, h: 0.02, fill: '#28333b' },
    ],
  },

  // ---- Conventional truck (hood-nosed, NOT cab-over) -------------------
  // The split hood + grille capability on a truck: the hood is a sloping facet
  // (cowl -> nose) and the grille/headlights/bumper are `plane:'fascia'` on the
  // vertical nose end-cap — exactly the car rule, on a flat-roofed box truck.
  {
    id: 'convtruck-side',
    label: 'Conventional truck side',
    faceKind: 'side',
    aspect: 'rectangle',
    aliases: ['conventional truck side', 'hood truck side', 'nosed truck flank', 'box truck side'],
    silhouette: {
      fill: '#dbe3ec',
      stroke: '#3a4a5a',
      profile: [
        { u: 0.04, v: 0.16 }, { u: 0.04, v: 0.80 }, // box rear
        { u: 0.80, v: 0.80 }, // box + cab roof to the cowl
        { u: 0.80, v: 0.62 }, // COWL (windshield base)
        { u: 0.90, v: 0.56 }, { u: 1.00, v: 0.46 }, // hood -> NOSE
        { u: 1.00, v: 0.16 }, // front bumper
      ],
    },
    parts: [
      { kind: 'rect', role: 'cargo-box', u: 0.04, w: 0.60, v: 0.18, h: 0.60, fill: '#dbe3ec', stroke: '#3a4a5a', strokeWidth: 0.8 },
      { kind: 'repeat', role: 'box-rib', u0: 0.10, u1: 0.60, count: 5, v: 0.22, h: 0.54, w: 0.008, fill: '#b9c5d3' },
      { kind: 'rect', role: 'cab-volume', u: 0.64, w: 0.16, v: 0.18, h: 0.62, fill: '#2b6cb0', stroke: '#1a4971', strokeWidth: 1 },
      { kind: 'rect', role: 'cab-window', u: 0.665, w: 0.115, v: 0.54, h: 0.22, fill: '#9bd0df', stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'line', role: 'cab-hood-seam', u0: 0.80, v0: 0.18, u1: 0.80, v1: 0.62, stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'rect', role: 'door-handle', u: 0.70, w: 0.04, v: 0.46, h: 0.02, fill: '#10243a' },
      { kind: 'wheels', role: 'wheel', fractions: [0.16, 0.70, 0.82], v: 0.13, r: 0.11, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.4, hubFill: '#cbd5e1' },
    ],
  },
  {
    id: 'convtruck-front',
    label: 'Conventional truck front (windshield + fascia)',
    faceKind: 'front',
    aspect: 'square',
    aliases: ['hood truck front', 'nosed truck face'],
    // windshield on the cowl plane; grille/headlights ride the nose fascia.
    silhouette: {
      fill: '#2b6cb0',
      stroke: '#1a4971',
      profile: [{ u: 0.05, v: 0.62 }, { u: 0.95, v: 0.62 }, { u: 0.95, v: 0.80 }, { u: 0.05, v: 0.80 }],
    },
    parts: [
      { kind: 'poly', role: 'windshield-glass', points: [{ u: 0.10, v: 0.64 }, { u: 0.90, v: 0.64 }, { u: 0.90, v: 0.78 }, { u: 0.10, v: 0.78 }], fill: '#9bd0df', stroke: '#1a4971', strokeWidth: 0.6 },
      { kind: 'rect', role: 'mirror-l', u: 0.01, w: 0.045, v: 0.62, h: 0.14, fill: '#1a4971' },
      { kind: 'rect', role: 'mirror-r', u: 0.945, w: 0.045, v: 0.62, h: 0.14, fill: '#1a4971' },
      // --- nose fascia (vertical end-cap of the hood slope) ---
      { kind: 'rect', role: 'fascia-panel', plane: 'fascia', u: 0.05, w: 0.90, v: 0.16, h: 0.30, fill: '#2b6cb0', stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'rect', role: 'grille', plane: 'fascia', u: 0.24, w: 0.52, v: 0.24, h: 0.15, fill: '#10243a', stroke: '#1a4971', strokeWidth: 0.6 },
      { kind: 'repeat', role: 'grille-slat', plane: 'fascia', u0: 0.26, u1: 0.74, count: 4, v: 0.27, h: 0.012, fill: '#5a8fc0' },
      { kind: 'circle', role: 'headlight-l', plane: 'fascia', u: 0.14, v: 0.30, r: 0.05, fill: '#f8d36b', stroke: '#1a4971', strokeWidth: 0.7 },
      { kind: 'circle', role: 'headlight-r', plane: 'fascia', u: 0.86, v: 0.30, r: 0.05, fill: '#f8d36b', stroke: '#1a4971', strokeWidth: 0.7 },
      { kind: 'rect', role: 'bumper', plane: 'fascia', u: 0.04, w: 0.92, v: 0.16, h: 0.05, fill: '#94a3b8' },
    ],
  },
  {
    id: 'convtruck-back',
    label: 'Conventional truck back (box rear)',
    faceKind: 'back',
    aspect: 'square',
    aliases: ['box truck rear', 'rollup door'],
    silhouette: {
      fill: '#dbe3ec',
      stroke: '#3a4a5a',
      profile: [{ u: 0.06, v: 0.16 }, { u: 0.94, v: 0.16 }, { u: 0.94, v: 0.80 }, { u: 0.06, v: 0.80 }],
    },
    parts: [
      { kind: 'rect', role: 'rollup-door', u: 0.12, w: 0.76, v: 0.22, h: 0.52, fill: '#cfd9e4', stroke: '#3a4a5a', strokeWidth: 0.8 },
      { kind: 'repeat', role: 'rollup-slat', u0: 0.13, u1: 0.87, count: 8, v: 0.24, h: 0.012, fill: '#aab8c7' },
      { kind: 'rect', role: 'tail-light-l', u: 0.08, w: 0.07, v: 0.18, h: 0.07, fill: '#c0392b' },
      { kind: 'rect', role: 'tail-light-r', u: 0.85, w: 0.07, v: 0.18, h: 0.07, fill: '#c0392b' },
      { kind: 'band', role: 'rear-bumper', v: 0.14, h: 0.05, fill: '#94a3b8' },
    ],
  },
  {
    id: 'convtruck-hood',
    label: 'Conventional truck hood (slope skin)',
    faceKind: 'hood',
    aspect: 'rectangle',
    aliases: ['truck hood', 'engine hood'],
    silhouette: {
      fill: '#2b6cb0',
      stroke: '#1a4971',
      profile: [{ u: 0.08, v: 0.0 }, { u: 0.92, v: 0.0 }, { u: 0.86, v: 1.0 }, { u: 0.14, v: 1.0 }],
    },
    parts: [
      { kind: 'line', role: 'hood-crease-l', u0: 0.30, v0: 0.08, u1: 0.26, v1: 0.9, stroke: '#1a4971', strokeWidth: 0.7 },
      { kind: 'line', role: 'hood-crease-r', u0: 0.70, v0: 0.08, u1: 0.74, v1: 0.9, stroke: '#1a4971', strokeWidth: 0.7 },
      { kind: 'rect', role: 'emblem', u: 0.46, w: 0.08, v: 0.12, h: 0.05, fill: '#cbd5e1' },
    ],
  },
  {
    id: 'convtruck-top',
    label: 'Conventional truck top',
    faceKind: 'top',
    aspect: 'rectangle',
    aliases: ['box truck roof'],
    silhouette: {
      fill: '#cfd9e4',
      stroke: '#3a4a5a',
      profile: [
        { u: 0.10, v: 0.0 }, { u: 0.90, v: 0.0 }, { u: 0.93, v: 0.10 },
        { u: 0.93, v: 0.90 }, { u: 0.90, v: 1.0 }, { u: 0.10, v: 1.0 },
        { u: 0.07, v: 0.90 }, { u: 0.07, v: 0.10 },
      ],
    },
    parts: [
      { kind: 'rect', role: 'cab-roof', u: 0.12, w: 0.76, v: 0.80, h: 0.16, fill: '#2b6cb0', stroke: '#1a4971', strokeWidth: 0.8 },
      { kind: 'line', role: 'centerline', u0: 0.5, v0: 0.04, u1: 0.5, v1: 0.76, stroke: '#9aa7b4', strokeWidth: 0.7, dash: '6 5' },
      { kind: 'repeat', role: 'roof-rib', u0: 0.12, u1: 0.88, count: 5, v: 0.08, h: 0.62, w: 0.006, fill: '#b9c5d3' },
    ],
  },
];

const CARD_INDEX = new Map(VEHICLE_FACE_CARDS.map((card) => [card.id, card]));

export function getVehicleFaceCard(id) {
  return CARD_INDEX.get(String(id || '').trim()) || null;
}

export function listVehicleFaceCards({ faceKind = null } = {}) {
  return VEHICLE_FACE_CARDS.filter((card) => !faceKind || card.faceKind === faceKind);
}

/** Aspect class a slot kind expects: square for front/back, rectangle otherwise. */
export function expectedAspectForKind(kind) {
  return kind === 'front' || kind === 'back' ? 'square' : 'rectangle';
}
