/**
 * Vehicle swept-net — the unified swept-cross-section vehicle module.
 *
 * Both vehicle families are one swept superellipse skinned by a wrap card + flat
 * fascia caps, lit by vexar, strokeless:
 *   - BOX family (bus / van / truck): high `seN`, uniform width, belly planted,
 *     optional `profile` loft of the roofline (cab → tall box).
 *   - CAR family (sedan / suv / limo / taxi): low `seN`, a width taper `WID(u)`
 *     and TWO independent rooflines — a sill `ZBOT(u)` and a roof `ZTOP(u)` —
 *     so the hood → windshield → roof → backlight → trunk silhouette lofts for free.
 *
 * Merged here per vehicle-car-net.plan.md / vehicle-smooth-box-net.plan.md: both
 * families normalize into ONE cross-section form
 *   { length, seN, halfWAt(u), zBotAt(u), zTopAt(u) }
 * and flow through ONE builder (`buildSweptSceneShapes`). A box's
 * `{ halfW, halfH, zc, profile }` and a car's `{ W0, WID, ZBOT, ZTOP }` are just
 * two ways to author that form. `vehicle-smooth-box-net.js` re-exports the box
 * symbols from here for back-compat.
 *
 * Accessories (taxi roof sign, SUV roof rails) are REAL primitives: a `box`
 * accessory emits 6 vexar-lit, back-face-culled, depth-sorted faces in
 * body-relative coordinates — not a card-only fake.
 *
 * Mapping (both families): body wrap card u = front→back, v = around (0 belly ·
 * 0.25 stbd · 0.5 roof · 0.75 port, wrap:'v'); flat fascia caps u = across width,
 * v = height. Render-agnostic `{ type:'poly', fill }` output, same as the sibling
 * net modules — drops into the same serializer/consumers and projects through any
 * `projectPoint` (manji space via projectTwoPoint included).
 */

import { bilerp4 } from './box-net.js';
import { sampleStickerCard, stickerContext } from './vehicle-fuselage-net.js';
import { makeLight, shadeHex, dot3, sub3, centroid, newellNormal, orientOutward, lodCount } from './vexar.js';

export const VEHICLE_SWEPT_NET_VERSION = 'vehicle-swept-net-v0.1.0';
export const VEHICLE_SMOOTH_BOX_NET_VERSION = 'vehicle-smooth-box-net-v0.1.0';   // back-compat alias
export const SWEPT_DEFAULT_LIGHT = makeLight({ direction: [0.4, 0.5, -0.76], ambient: 0.46, diffuse: 0.6 });
export const SMOOTH_BOX_DEFAULT_LIGHT = SWEPT_DEFAULT_LIGHT;                      // back-compat alias
export const CAR_DEFAULT_LIGHT = makeLight({ direction: [0.38, 0.5, -0.78], ambient: 0.46, diffuse: 0.62 });

// ===========================================================================
// Cards — BOX family (parts[] grammar: band / rect / repeat / circle / poly)
// ===========================================================================
export const BUS_BODY = {
  id: 'bus-body', wrap: 'v', base: '#eef2f5',
  parts: [
    { kind: 'band', role: 'skirt', v: 0.0, h: 0.15, fill: '#363c44' },
    { kind: 'band', role: 'livery', v: 0.165, h: 0.05, fill: '#15569f' },
    // passenger windows LOWERED onto the side (was riding up at v 0.33)
    { kind: 'repeat', role: 'win-stbd', u0: 0.18, u1: 0.92, count: 7, gap: 0.016, v: 0.305, h: 0.115, fill: '#2b3d50' },
    { kind: 'repeat', role: 'win-port', u0: 0.18, u1: 0.92, count: 7, gap: 0.016, v: 0.695, h: 0.115, fill: '#2b3d50' },
    // a dark cantrail eyebrow under the roof makes the top section read as DISTINCT, not flush
    { kind: 'band', role: 'cantrail', v: 0.40, h: 0.022, fill: '#2a2f36' },
    { kind: 'band', role: 'roof', v: 0.5, h: 0.12, fill: '#cdd4d8' },
    // curb-side entry doors (stbd only), each with a glazed upper light
    { kind: 'rect', role: 'door-f', u: 0.135, w: 0.05, v: 0.205, h: 0.31, fill: '#27333d' },
    { kind: 'rect', role: 'doorwin-f', u: 0.135, w: 0.05, v: 0.335, h: 0.10, fill: '#2b3d50' },
    { kind: 'rect', role: 'door-m', u: 0.55, w: 0.05, v: 0.205, h: 0.31, fill: '#27333d' },
    { kind: 'rect', role: 'doorwin-m', u: 0.55, w: 0.05, v: 0.335, h: 0.10, fill: '#2b3d50' },
  ],
};
export const BUS_FRONT = {
  id: 'bus-front', base: '#eef2f5',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.08, h: 0.15, fill: '#363c44' },
    { kind: 'rect', role: 'grille', u: 0.37, w: 0.26, v: 0.20, h: 0.14, fill: '#2a2f36' },
    { kind: 'rect', role: 'hlamp-l', u: 0.09, w: 0.15, v: 0.21, h: 0.10, fill: '#f1ead0' },
    { kind: 'rect', role: 'hlamp-r', u: 0.76, w: 0.15, v: 0.21, h: 0.10, fill: '#f1ead0' },
    { kind: 'rect', role: 'windshield', u: 0.08, w: 0.84, v: 0.50, h: 0.34, fill: '#1b2a36' },
    { kind: 'rect', role: 'a-pillar', u: 0.49, w: 0.02, v: 0.50, h: 0.34, fill: '#eef2f5' },
    { kind: 'rect', role: 'destsign', u: 0.14, w: 0.72, v: 0.875, h: 0.075, fill: '#15191e' },
  ],
};
export const BUS_REAR = {
  id: 'bus-rear', base: '#eef2f5',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.08, h: 0.15, fill: '#363c44' },
    { kind: 'rect', role: 'rearwin', u: 0.13, w: 0.74, v: 0.55, h: 0.28, fill: '#1b2a36' },
    { kind: 'rect', role: 'tlamp-l', u: 0.08, w: 0.13, v: 0.24, h: 0.14, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.79, w: 0.13, v: 0.24, h: 0.14, fill: '#c0202a' },
  ],
};
export const VAN_BODY = {
  id: 'van-body', wrap: 'v', base: '#dfe4e8',
  parts: [
    { kind: 'band', role: 'skirt', v: 0.0, h: 0.12, fill: '#3a3f47' },
    { kind: 'band', role: 'livery', v: 0.20, h: 0.045, fill: '#1d6fb0' },
    // cab windows + a row of passenger windows down the body, dropped onto the side
    { kind: 'rect', role: 'cabwin-stbd', u: 0.06, w: 0.085, v: 0.315, h: 0.13, fill: '#1f2c35' },
    { kind: 'rect', role: 'cabwin-port', u: 0.06, w: 0.085, v: 0.685, h: 0.13, fill: '#1f2c35' },
    { kind: 'repeat', role: 'passwin-stbd', u0: 0.24, u1: 0.92, count: 4, gap: 0.022, v: 0.315, h: 0.135, fill: '#1f2c35' },
    { kind: 'repeat', role: 'passwin-port', u0: 0.24, u1: 0.92, count: 4, gap: 0.022, v: 0.685, h: 0.135, fill: '#1f2c35' },
    { kind: 'rect', role: 'sidedoor-stbd', u: 0.195, w: 0.028, v: 0.22, h: 0.36, fill: '#c2c8ce' },   // sliding-door seam
  ],
};
export const VAN_FRONT = {
  id: 'van-front', base: '#dfe4e8',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.05, h: 0.12, fill: '#3a3f47' },
    { kind: 'rect', role: 'grille', u: 0.34, w: 0.32, v: 0.30, h: 0.14, fill: '#2a2f36' },
    { kind: 'rect', role: 'hlamp-l', u: 0.10, w: 0.16, v: 0.30, h: 0.10, fill: '#f1ead0' },
    { kind: 'rect', role: 'hlamp-r', u: 0.74, w: 0.16, v: 0.30, h: 0.10, fill: '#f1ead0' },
    { kind: 'rect', role: 'windshield', u: 0.08, w: 0.84, v: 0.68, h: 0.34, fill: '#1b2a36' },   // raised + enlarged on the cab face
  ],
};
// box-van rear = split cargo doors (horizontal opening), each with a rear window
export const VAN_REAR = {
  id: 'van-rear', base: '#dfe4e8',
  parts: [
    { kind: 'rect', role: 'door-l', u: 0.10, w: 0.38, v: 0.50, h: 0.76, fill: '#cdd4da' },
    { kind: 'rect', role: 'door-r', u: 0.52, w: 0.38, v: 0.50, h: 0.76, fill: '#cdd4da' },
    { kind: 'rect', role: 'seam', u: 0.495, w: 0.012, v: 0.50, h: 0.76, fill: '#9aa0a6' },
    { kind: 'rect', role: 'rearwin-l', u: 0.135, w: 0.30, v: 0.74, h: 0.17, fill: '#1b2a36' },
    { kind: 'rect', role: 'rearwin-r', u: 0.565, w: 0.30, v: 0.74, h: 0.17, fill: '#1b2a36' },
    { kind: 'rect', role: 'handle', u: 0.46, w: 0.08, v: 0.42, h: 0.03, fill: '#3a3f47' },
    { kind: 'band', role: 'bumper', v: 0.05, h: 0.10, fill: '#3a3f47' },
    { kind: 'rect', role: 'tlamp-l', u: 0.02, w: 0.07, v: 0.18, h: 0.12, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.91, w: 0.07, v: 0.18, h: 0.12, fill: '#c0202a' },
  ],
};
export const TRUCK_BODY = {
  id: 'truck-body', wrap: 'v', base: '#e6e1d4',
  parts: [
    { kind: 'band', role: 'skirt', v: 0.0, h: 0.11, fill: '#33373d' },
    { kind: 'band', role: 'roof-rail', v: 0.5, h: 0.045, fill: '#cfcabd' },
    // cargo-box livery panels (box only, u >= 0.245 — leaves the cab clean for a door)
    { kind: 'rect', role: 'cargo-stbd', u: 0.245, w: 0.72, v: 0.31, h: 0.22, fill: '#9a2b22' },
    { kind: 'rect', role: 'cargo-port', u: 0.245, w: 0.72, v: 0.69, h: 0.22, fill: '#9a2b22' },
    // cab side window — larger + dropped to line up with the windshield (tractor-trailer
    // read), lit glass so it reads against dark backgrounds; door seam below
    { kind: 'rect', role: 'cabwin-stbd', u: 0.055, w: 0.115, v: 0.34, h: 0.15, fill: '#2b3d50' },
    { kind: 'rect', role: 'cabwin-port', u: 0.055, w: 0.115, v: 0.66, h: 0.15, fill: '#2b3d50' },
    { kind: 'rect', role: 'cabdoor-stbd', u: 0.05, w: 0.026, v: 0.185, h: 0.28, fill: '#2a2f36' },
    { kind: 'rect', role: 'cabdoor-port', u: 0.05, w: 0.026, v: 0.815, h: 0.28, fill: '#2a2f36' },
  ],
};
export const TRUCK_FRONT = {
  id: 'truck-front', base: '#e6e1d4',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.07, h: 0.16, fill: '#33373d' },
    { kind: 'rect', role: 'grille', u: 0.33, w: 0.34, v: 0.30, h: 0.18, fill: '#2a2f36' },
    { kind: 'rect', role: 'hlamp-l', u: 0.09, w: 0.16, v: 0.32, h: 0.11, fill: '#f1ead0' },
    { kind: 'rect', role: 'hlamp-r', u: 0.75, w: 0.16, v: 0.32, h: 0.11, fill: '#f1ead0' },
    { kind: 'rect', role: 'windshield', u: 0.12, w: 0.76, v: 0.72, h: 0.24, fill: '#1b2a36' },   // raised above the grille/lights
  ],
};
// truck rear = roll-up cargo door (vertical slide): a door panel with slats
export const TRUCK_REAR = {
  id: 'truck-rear', base: '#e6e1d4',
  parts: [
    { kind: 'rect', role: 'rolldoor', u: 0.08, w: 0.84, v: 0.52, h: 0.78, fill: '#cfcabd' },
    { kind: 'band', role: 'slat-1', v: 0.24, h: 0.014, fill: '#9a9486' },
    { kind: 'band', role: 'slat-2', v: 0.36, h: 0.014, fill: '#9a9486' },
    { kind: 'band', role: 'slat-3', v: 0.48, h: 0.014, fill: '#9a9486' },
    { kind: 'band', role: 'slat-4', v: 0.60, h: 0.014, fill: '#9a9486' },
    { kind: 'band', role: 'slat-5', v: 0.72, h: 0.014, fill: '#9a9486' },
    { kind: 'rect', role: 'pull', u: 0.44, w: 0.12, v: 0.16, h: 0.03, fill: '#33373d' },
    { kind: 'band', role: 'bumper', v: 0.05, h: 0.10, fill: '#33373d' },
    { kind: 'rect', role: 'tlamp-l', u: 0.02, w: 0.07, v: 0.135, h: 0.10, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.91, w: 0.07, v: 0.135, h: 0.10, fill: '#c0202a' },
  ],
};
// Delivery / mail truck — the box truck WIDENED, keeping its cab nose + angled
// facade (the loft step). The low front cap (nose) becomes a full grille; the
// windshield is printed on the angled facade (the loft ramp) via the body wrap.
export const DELIVERY_BODY = {
  id: 'delivery-body', wrap: 'v', base: '#e9e6df',
  parts: [
    { kind: 'band', role: 'skirt', v: 0.0, h: 0.10, fill: '#3a3f47' },
    { kind: 'band', role: 'livery', v: 0.165, h: 0.04, fill: '#15569f' },          // trimmed to a lower stripe (was burying the side)
    // WINDSHIELD on the angled facade: the loft ramp (u 0.12→0.20) faces forward+up;
    // a roof-centered rect over that u-span wraps glass across the cab-over front.
    { kind: 'rect', role: 'windshield', u: 0.12, w: 0.085, v: 0.5, h: 0.44, fill: '#1b2a36' },
    // cab side windows on the (now longer) cab, ahead of the ramp; lit glass + door seam
    { kind: 'rect', role: 'cabwin-stbd', u: 0.025, w: 0.085, v: 0.34, h: 0.16, fill: '#2b3d50' },
    { kind: 'rect', role: 'cabwin-port', u: 0.025, w: 0.085, v: 0.66, h: 0.16, fill: '#2b3d50' },
    { kind: 'rect', role: 'cabdoor-stbd', u: 0.02, w: 0.024, v: 0.19, h: 0.32, fill: '#cdd0d4' },
    { kind: 'rect', role: 'cabdoor-port', u: 0.02, w: 0.024, v: 0.81, h: 0.32, fill: '#cdd0d4' },
    { kind: 'rect', role: 'sidedoor-stbd', u: 0.24, w: 0.03, v: 0.18, h: 0.46, fill: '#c2c8ce' },    // roll-up side cargo door seam
    { kind: 'rect', role: 'logo-stbd', u: 0.50, w: 0.18, v: 0.28, h: 0.09, fill: '#15569f' },        // trimmed livery panel (no longer buries the side)
    { kind: 'rect', role: 'logo-port', u: 0.50, w: 0.18, v: 0.72, h: 0.09, fill: '#15569f' },
  ],
};
// front NOSE cap (low, because of the loft) = the grille, no windshield here
export const DELIVERY_FRONT = {
  id: 'delivery-front', base: '#e9e6df',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.09, h: 0.20, fill: '#33373d' },
    { kind: 'rect', role: 'grille', u: 0.20, w: 0.60, v: 0.55, h: 0.40, fill: '#2a2f36' },           // the nose IS the grille
    { kind: 'rect', role: 'hlamp-l', u: 0.05, w: 0.13, v: 0.56, h: 0.17, fill: '#f1ead0' },
    { kind: 'rect', role: 'hlamp-r', u: 0.82, w: 0.13, v: 0.56, h: 0.17, fill: '#f1ead0' },
    { kind: 'rect', role: 'plate', u: 0.42, w: 0.16, v: 0.235, h: 0.12, fill: '#cdd4da' },
  ],
};
export const DELIVERY_REAR = {
  id: 'delivery-rear', base: '#e9e6df',
  parts: [
    { kind: 'rect', role: 'rolldoor', u: 0.08, w: 0.84, v: 0.52, h: 0.80, fill: '#d7d3ca' },
    { kind: 'band', role: 'slat-1', v: 0.26, h: 0.014, fill: '#a7a294' },
    { kind: 'band', role: 'slat-2', v: 0.40, h: 0.014, fill: '#a7a294' },
    { kind: 'band', role: 'slat-3', v: 0.54, h: 0.014, fill: '#a7a294' },
    { kind: 'band', role: 'slat-4', v: 0.68, h: 0.014, fill: '#a7a294' },
    { kind: 'rect', role: 'pull', u: 0.44, w: 0.12, v: 0.18, h: 0.03, fill: '#33373d' },
    { kind: 'band', role: 'bumper', v: 0.05, h: 0.10, fill: '#33373d' },
    { kind: 'rect', role: 'tlamp-l', u: 0.03, w: 0.07, v: 0.15, h: 0.10, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.90, w: 0.07, v: 0.15, h: 0.10, fill: '#c0202a' },
  ],
};
// Streetcar / tram — a long, narrow box body read as an ARTICULATED unit: a row of
// big windows the full length, low-floor doors, and dark accordion BELLOWS bands at
// the articulation joints so the single swept body reads as connected sections. Cream
// + deep-red heritage livery. The curved nose/tail (net `wid`+`profile` taper) carries
// these cards onto rounded ends; the front/rear caps are the decorated faces.
// The tram glazing as ARTICULATED bays: rounded-rect windows grouped into the runs
// BETWEEN the doors and the articulation joints, so no window ever interspaces a door.
// Doors sit at u 0.135 / 0.475 / 0.815; bellows at 0.345 / 0.655 — the bays are the
// gaps left over. Same run mirrored to both flanks (stbd v0.30 · port v0.70).
const TRAM_WINDOW_BAYS = [
  [0.185, 0.320], [0.370, 0.440], [0.520, 0.630], [0.680, 0.785], [0.855, 0.910],
];
const tramWindows = () => {
  const parts = [], pitch = 0.072, maxW = 0.065, gap = 0.012, h = 0.10, r = 0.03, fill = '#274a5a';
  for (const [u0, u1] of TRAM_WINDOW_BAYS) {
    const span = u1 - u0, count = Math.max(1, Math.round(span / pitch));
    const w = Math.min(maxW, (span - gap * (count - 1)) / count);     // landscape panes, sized to fill the bay
    for (const [v, tag] of [[0.30, 'stbd'], [0.70, 'port']]) {
      parts.push({ kind: 'repeat', role: `win-${tag}-${u0}`, u0, u1, count, w, v, h, r, fill });
    }
  }
  return parts;
};

export const STREETCAR_BODY = {
  id: 'streetcar-body', wrap: 'v', base: '#e7e0cf',
  parts: [
    { kind: 'band', role: 'skirt', v: 0.0, h: 0.11, fill: '#33373d' },
    { kind: 'band', role: 'livery', v: 0.155, h: 0.05, fill: '#a4332a' },
    // rounded-rect window bays, grouped between the doors/joints (never over a door)
    ...tramWindows(),
    // low-floor doors (stbd boarding side), each with a glazed upper light
    { kind: 'rect', role: 'door-a', u: 0.135, w: 0.05, v: 0.205, h: 0.33, fill: '#cdd4da' },
    { kind: 'rect', role: 'doorwin-a', u: 0.135, w: 0.05, v: 0.34, h: 0.10, r: 0.035, fill: '#274a5a' },
    { kind: 'rect', role: 'door-b', u: 0.475, w: 0.05, v: 0.205, h: 0.33, fill: '#cdd4da' },
    { kind: 'rect', role: 'doorwin-b', u: 0.475, w: 0.05, v: 0.34, h: 0.10, r: 0.035, fill: '#274a5a' },
    { kind: 'rect', role: 'door-c', u: 0.815, w: 0.05, v: 0.205, h: 0.33, fill: '#cdd4da' },
    { kind: 'rect', role: 'doorwin-c', u: 0.815, w: 0.05, v: 0.34, h: 0.10, r: 0.035, fill: '#274a5a' },
    { kind: 'band', role: 'cantrail', v: 0.40, h: 0.02, fill: '#2a2f36' },
    { kind: 'band', role: 'roof', v: 0.5, h: 0.12, fill: '#d4cdbb' },
    // articulation bellows: dark accordion seams cut across both flanks at the joints,
    // so the one swept body reads as three connected sections
    { kind: 'rect', role: 'bellows-1-stbd', u: 0.345, w: 0.018, v: 0.27, h: 0.34, fill: '#1c2024' },
    { kind: 'rect', role: 'bellows-1-port', u: 0.345, w: 0.018, v: 0.73, h: 0.34, fill: '#1c2024' },
    { kind: 'rect', role: 'bellows-2-stbd', u: 0.655, w: 0.018, v: 0.27, h: 0.34, fill: '#1c2024' },
    { kind: 'rect', role: 'bellows-2-port', u: 0.655, w: 0.018, v: 0.73, h: 0.34, fill: '#1c2024' },
  ],
};
export const STREETCAR_FRONT = {
  id: 'streetcar-front', base: '#e7e0cf',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.07, h: 0.16, fill: '#33373d' },
    { kind: 'band', role: 'livery', v: 0.18, h: 0.045, fill: '#a4332a' },
    { kind: 'rect', role: 'windshield', u: 0.10, w: 0.80, v: 0.585, h: 0.40, fill: '#1b2a36' },
    { kind: 'rect', role: 'route-panel', u: 0.42, w: 0.16, v: 0.30, h: 0.12, fill: '#a4332a' },
    { kind: 'rect', role: 'hlamp-l', u: 0.10, w: 0.15, v: 0.235, h: 0.09, fill: '#f1ead0' },
    { kind: 'rect', role: 'hlamp-r', u: 0.75, w: 0.15, v: 0.235, h: 0.09, fill: '#f1ead0' },
    { kind: 'rect', role: 'destsign', u: 0.16, w: 0.68, v: 0.875, h: 0.07, fill: '#15191e' },
  ],
};
export const STREETCAR_REAR = {
  id: 'streetcar-rear', base: '#e7e0cf',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.07, h: 0.15, fill: '#33373d' },
    { kind: 'band', role: 'livery', v: 0.18, h: 0.045, fill: '#a4332a' },
    { kind: 'rect', role: 'rearwin', u: 0.14, w: 0.72, v: 0.58, h: 0.30, fill: '#1b2a36' },
    { kind: 'rect', role: 'tlamp-l', u: 0.08, w: 0.13, v: 0.235, h: 0.11, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.79, w: 0.13, v: 0.235, h: 0.11, fill: '#c0202a' },
  ],
};
// Catering / hi-loader truck — a short cab + a TALL box body (the galley van that
// raises to a widebody door). White body, green ops livery, a roll-up service door on
// the rear (the lift face); the raised scissor cab + safety rails are box accessories
// on the net. Cab nose is low (profile loft), so the front cap is a full grille.
export const CATERING_BODY = {
  id: 'catering-body', wrap: 'v', base: '#eef1f4',
  parts: [
    { kind: 'band', role: 'skirt', v: 0.0, h: 0.10, fill: '#3a3f47' },
    { kind: 'band', role: 'livery', v: 0.16, h: 0.04, fill: '#1d7a5a' },
    // windshield printed on the loft ramp facade; cab side windows + door ahead of the box
    { kind: 'rect', role: 'windshield', u: 0.24, w: 0.13, v: 0.5, h: 0.32, fill: '#1b2a36' },
    { kind: 'rect', role: 'cabwin-stbd', u: 0.05, w: 0.085, v: 0.34, h: 0.16, fill: '#2b3d50' },
    { kind: 'rect', role: 'cabwin-port', u: 0.05, w: 0.085, v: 0.66, h: 0.16, fill: '#2b3d50' },
    { kind: 'rect', role: 'cabdoor-stbd', u: 0.04, w: 0.024, v: 0.19, h: 0.30, fill: '#cdd0d4' },
    { kind: 'rect', role: 'cabdoor-port', u: 0.04, w: 0.024, v: 0.81, h: 0.30, fill: '#cdd0d4' },
    // tall box side panels + a service-door seam
    { kind: 'rect', role: 'panel-stbd', u: 0.30, w: 0.62, v: 0.34, h: 0.42, fill: '#dfe3e7' },
    { kind: 'rect', role: 'panel-port', u: 0.30, w: 0.62, v: 0.66, h: 0.42, fill: '#dfe3e7' },
    { kind: 'rect', role: 'svc-seam-stbd', u: 0.40, w: 0.018, v: 0.34, h: 0.48, fill: '#b6bcc2' },
    { kind: 'rect', role: 'svc-seam-port', u: 0.40, w: 0.018, v: 0.66, h: 0.48, fill: '#b6bcc2' },
  ],
};
export const CATERING_FRONT = {
  id: 'catering-front', base: '#eef1f4',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.09, h: 0.18, fill: '#33373d' },
    { kind: 'rect', role: 'grille', u: 0.22, w: 0.56, v: 0.52, h: 0.34, fill: '#2a2f36' },
    { kind: 'rect', role: 'hlamp-l', u: 0.07, w: 0.13, v: 0.52, h: 0.15, fill: '#f1ead0' },
    { kind: 'rect', role: 'hlamp-r', u: 0.80, w: 0.13, v: 0.52, h: 0.15, fill: '#f1ead0' },
    { kind: 'rect', role: 'plate', u: 0.42, w: 0.16, v: 0.24, h: 0.11, fill: '#cdd4da' },
  ],
};
export const CATERING_REAR = {
  id: 'catering-rear', base: '#eef1f4',
  parts: [
    { kind: 'rect', role: 'svc-door', u: 0.10, w: 0.80, v: 0.55, h: 0.74, fill: '#d2d6da' },
    { kind: 'band', role: 'seam-1', v: 0.34, h: 0.014, fill: '#a7adb3' },
    { kind: 'band', role: 'seam-2', v: 0.50, h: 0.014, fill: '#a7adb3' },
    { kind: 'band', role: 'seam-3', v: 0.66, h: 0.014, fill: '#a7adb3' },
    { kind: 'band', role: 'platform', v: 0.16, h: 0.05, fill: '#5a6066' },
    { kind: 'rect', role: 'tlamp-l', u: 0.03, w: 0.07, v: 0.13, h: 0.10, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.90, w: 0.07, v: 0.13, h: 0.10, fill: '#c0202a' },
  ],
};
// Belt loader — a low ops-yellow chassis (the conveyor itself is a `ramp` accessory on
// the net). Driver sits open behind a small dash; safety stripes on the skirt.
export const BELTLOADER_BODY = {
  id: 'beltloader-body', wrap: 'v', base: '#d8a72e',
  parts: [
    { kind: 'band', role: 'skirt', v: 0.0, h: 0.20, fill: '#33373d' },
    { kind: 'band', role: 'stripe', v: 0.5, h: 0.10, fill: '#23272d' },
    { kind: 'rect', role: 'seat-stbd', u: 0.52, w: 0.16, v: 0.34, h: 0.20, fill: '#2a2f36' },
    { kind: 'rect', role: 'seat-port', u: 0.52, w: 0.16, v: 0.66, h: 0.20, fill: '#2a2f36' },
  ],
};
export const BELTLOADER_FRONT = {
  id: 'beltloader-front', base: '#d8a72e',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.10, h: 0.24, fill: '#33373d' },
    { kind: 'rect', role: 'hlamp-l', u: 0.12, w: 0.18, v: 0.5, h: 0.20, fill: '#f1ead0' },
    { kind: 'rect', role: 'hlamp-r', u: 0.70, w: 0.18, v: 0.5, h: 0.20, fill: '#f1ead0' },
  ],
};
export const BELTLOADER_REAR = {
  id: 'beltloader-rear', base: '#d8a72e',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.10, h: 0.24, fill: '#33373d' },
    { kind: 'rect', role: 'tlamp-l', u: 0.12, w: 0.14, v: 0.5, h: 0.16, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.74, w: 0.14, v: 0.5, h: 0.16, fill: '#c0202a' },
  ],
};
// Boarding stairs — a small cab/chassis carrying a stepped `ramp` (the staircase) that
// climbs forward to a top platform at door height. White body, ops-yellow stripe.
export const STAIRS_BODY = {
  id: 'stairs-body', wrap: 'v', base: '#e7e9ec',
  parts: [
    { kind: 'band', role: 'skirt', v: 0.0, h: 0.14, fill: '#33373d' },
    { kind: 'band', role: 'stripe', v: 0.20, h: 0.05, fill: '#d8a72e' },
    { kind: 'rect', role: 'cabwin-stbd', u: 0.18, w: 0.16, v: 0.34, h: 0.22, fill: '#2b3d50' },
    { kind: 'rect', role: 'cabwin-port', u: 0.18, w: 0.16, v: 0.66, h: 0.22, fill: '#2b3d50' },
  ],
};
export const STAIRS_FRONT = {
  id: 'stairs-front', base: '#e7e9ec',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.10, h: 0.20, fill: '#33373d' },
    { kind: 'rect', role: 'hlamp-l', u: 0.10, w: 0.16, v: 0.4, h: 0.14, fill: '#f1ead0' },
    { kind: 'rect', role: 'hlamp-r', u: 0.74, w: 0.16, v: 0.4, h: 0.14, fill: '#f1ead0' },
  ],
};
export const STAIRS_REAR = {
  id: 'stairs-rear', base: '#e7e9ec',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.10, h: 0.18, fill: '#33373d' },
    { kind: 'rect', role: 'tlamp-l', u: 0.10, w: 0.12, v: 0.4, h: 0.14, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.78, w: 0.12, v: 0.4, h: 0.14, fill: '#c0202a' },
  ],
};
const SMOOTH_BOX_CARDS = Object.fromEntries(
  [BUS_BODY, BUS_FRONT, BUS_REAR, VAN_BODY, VAN_FRONT, VAN_REAR, TRUCK_BODY, TRUCK_FRONT, TRUCK_REAR, DELIVERY_BODY, DELIVERY_FRONT, DELIVERY_REAR, STREETCAR_BODY, STREETCAR_FRONT, STREETCAR_REAR, CATERING_BODY, CATERING_FRONT, CATERING_REAR, BELTLOADER_BODY, BELTLOADER_FRONT, BELTLOADER_REAR, STAIRS_BODY, STAIRS_FRONT, STAIRS_REAR].map((c) => [c.id, c]),
);
export function getSmoothBoxCard(idOrCard) {
  if (idOrCard && typeof idOrCard === 'object') return idOrCard;
  return SMOOTH_BOX_CARDS[String(idOrCard || '').trim()] || null;
}

// ===========================================================================
// Cards — CAR family
// ===========================================================================
// Side-glass capsule outline in (u,v): straight top/bottom, ROUND end caps.
// vRoof = edge toward the roof, vBelly = edge toward the body. uA/uC bound the
// cabin along the length (default = sedan cabin; limo widens it). Returns poly pts.
export function greenhouse(vRoof, vBelly, uA = 0.235, uC = 0.675) {
  const N = 14, pts = [];
  const vc = (vRoof + vBelly) / 2, hh = (vRoof - vBelly) / 2, capU = Math.abs(hh);
  const uAmid = uA + capU, uCmid = uC - capU;
  pts.push({ u: uAmid, v: vRoof }, { u: uCmid, v: vRoof });
  for (let i = 1; i < N; i += 1) { const a = (Math.PI * i) / N; pts.push({ u: uCmid + capU * Math.sin(a), v: vc + hh * Math.cos(a) }); }
  pts.push({ u: uCmid, v: vBelly }, { u: uAmid, v: vBelly });
  for (let i = 1; i < N; i += 1) { const a = (Math.PI * i) / N; pts.push({ u: uAmid - capU * Math.sin(a), v: vc - hh * Math.cos(a) }); }
  return pts;
}

export const SEDAN_BODY = {
  id: 'sedan-body', wrap: 'v', base: '#20407a',
  parts: [
    { kind: 'band', role: 'under-shadow', v: 0.0, h: 0.16, fill: '#0e1626' },
    { kind: 'poly', role: 'glass-stbd', points: greenhouse(0.34, 0.2675), fill: '#0c1a26' },
    { kind: 'poly', role: 'glass-port', points: greenhouse(0.66, 0.7325), fill: '#0c1a26' },
    { kind: 'rect', role: 'handle-f-stbd', u: 0.31, w: 0.05, v: 0.228, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-r-stbd', u: 0.49, w: 0.05, v: 0.228, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-f-port', u: 0.31, w: 0.05, v: 0.772, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-r-port', u: 0.49, w: 0.05, v: 0.772, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'windshield', u: 0.151, w: 0.145, v: 0.5, h: 0.20, fill: '#0c1a26' },
    { kind: 'rect', role: 'backlight', u: 0.62, w: 0.16, v: 0.5, h: 0.20, fill: '#0c1a26' },
    { kind: 'circle', role: 'wheel-fs', u: 0.175, v: 0.135, r: 0.050, fill: '#0b0d11' },
    { kind: 'circle', role: 'hub-fs', u: 0.175, v: 0.135, r: 0.022, fill: '#aab3bd' },
    { kind: 'circle', role: 'wheel-rs', u: 0.815, v: 0.135, r: 0.050, fill: '#0b0d11' },
    { kind: 'circle', role: 'hub-rs', u: 0.815, v: 0.135, r: 0.022, fill: '#aab3bd' },
    { kind: 'circle', role: 'wheel-fp', u: 0.175, v: 0.865, r: 0.050, fill: '#0b0d11' },
    { kind: 'circle', role: 'hub-fp', u: 0.175, v: 0.865, r: 0.022, fill: '#aab3bd' },
    { kind: 'circle', role: 'wheel-rp', u: 0.815, v: 0.865, r: 0.050, fill: '#0b0d11' },
    { kind: 'circle', role: 'hub-rp', u: 0.815, v: 0.865, r: 0.022, fill: '#aab3bd' },
  ],
};
export const SEDAN_FRONT = {
  id: 'sedan-front', base: '#20407a',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.11, h: 0.22, fill: '#11151c' },
    { kind: 'rect', role: 'grille', u: 0.32, w: 0.36, v: 0.46, h: 0.27, fill: '#0d0f13' },
    { kind: 'rect', role: 'hlamp-l', u: 0.085, w: 0.17, v: 0.55, h: 0.15, fill: '#e3ebf1' },
    { kind: 'rect', role: 'hlamp-r', u: 0.745, w: 0.17, v: 0.55, h: 0.15, fill: '#e3ebf1' },
    { kind: 'rect', role: 'plate', u: 0.42, w: 0.16, v: 0.165, h: 0.10, fill: '#cdd4da' },
  ],
};
export const SEDAN_REAR = {
  id: 'sedan-rear', base: '#20407a',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.11, h: 0.22, fill: '#11151c' },
    { kind: 'rect', role: 'tlamp-l', u: 0.065, w: 0.21, v: 0.55, h: 0.17, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.725, w: 0.21, v: 0.55, h: 0.17, fill: '#c0202a' },
    { kind: 'rect', role: 'lightbar', u: 0.065, w: 0.87, v: 0.55, h: 0.045, fill: '#7a1a20' },
    { kind: 'rect', role: 'plate', u: 0.42, w: 0.16, v: 0.235, h: 0.11, fill: '#cdd4da' },
  ],
};

// SUV — taller flat-roofed greenhouse, lower cladding, no trunk handles.
export const SUV_BODY = {
  id: 'suv-body', wrap: 'v', base: '#39414a',
  parts: [
    { kind: 'band', role: 'cladding', v: 0.0, h: 0.22, fill: '#16191e' },                 // matte-black lower cladding
    { kind: 'poly', role: 'glass-stbd', points: greenhouse(0.355, 0.25, 0.245, 0.83), fill: '#0c1a26' },
    { kind: 'poly', role: 'glass-port', points: greenhouse(0.645, 0.75, 0.245, 0.83), fill: '#0c1a26' },
    { kind: 'rect', role: 'handle-f-stbd', u: 0.33, w: 0.05, v: 0.225, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-r-stbd', u: 0.55, w: 0.05, v: 0.225, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-f-port', u: 0.33, w: 0.05, v: 0.775, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-r-port', u: 0.55, w: 0.05, v: 0.775, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'windshield', u: 0.155, w: 0.12, v: 0.5, h: 0.22, fill: '#0c1a26' },
    { kind: 'circle', role: 'wheel-fs', u: 0.17, v: 0.115, r: 0.058, fill: '#0b0d11' },
    { kind: 'circle', role: 'wheel-rs', u: 0.83, v: 0.115, r: 0.058, fill: '#0b0d11' },
    { kind: 'circle', role: 'wheel-fp', u: 0.17, v: 0.885, r: 0.058, fill: '#0b0d11' },
    { kind: 'circle', role: 'wheel-rp', u: 0.83, v: 0.885, r: 0.058, fill: '#0b0d11' },
  ],
};
export const SUV_REAR = {
  id: 'suv-rear', base: '#39414a',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.09, h: 0.20, fill: '#16191e' },
    { kind: 'rect', role: 'liftgate-glass', u: 0.16, w: 0.68, v: 0.62, h: 0.40, fill: '#0c1a26' },
    { kind: 'rect', role: 'tailgate-handle', u: 0.44, w: 0.12, v: 0.38, h: 0.03, fill: '#0a0f18' },
    { kind: 'rect', role: 'tlamp-l', u: 0.05, w: 0.10, v: 0.46, h: 0.30, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.85, w: 0.10, v: 0.46, h: 0.30, fill: '#c0202a' },
    { kind: 'rect', role: 'plate', u: 0.42, w: 0.16, v: 0.18, h: 0.10, fill: '#cdd4da' },
  ],
};

// Limo — black, long flat cabin, privacy glass, partition line, many doors.
export const LIMO_BODY = {
  id: 'limo-body', wrap: 'v', base: '#0a0c10',
  parts: [
    { kind: 'band', role: 'under-shadow', v: 0.0, h: 0.14, fill: '#050608' },
    { kind: 'band', role: 'chrome-belt', v: 0.205, h: 0.012, fill: '#8a8f98' },
    { kind: 'poly', role: 'glass-stbd', points: greenhouse(0.33, 0.255, 0.20, 0.82), fill: '#05080c' },   // privacy glass (near-opaque)
    { kind: 'poly', role: 'glass-port', points: greenhouse(0.67, 0.745, 0.20, 0.82), fill: '#05080c' },
    { kind: 'rect', role: 'partition-stbd', u: 0.42, w: 0.012, v: 0.292, h: 0.075, fill: '#1a1d22' },     // partition pillar
    { kind: 'rect', role: 'partition-port', u: 0.42, w: 0.012, v: 0.708, h: 0.075, fill: '#1a1d22' },
    { kind: 'rect', role: 'handle-a-stbd', u: 0.30, w: 0.045, v: 0.232, h: 0.012, fill: '#8a8f98' },
    { kind: 'rect', role: 'handle-b-stbd', u: 0.48, w: 0.045, v: 0.232, h: 0.012, fill: '#8a8f98' },
    { kind: 'rect', role: 'handle-c-stbd', u: 0.66, w: 0.045, v: 0.232, h: 0.012, fill: '#8a8f98' },
    { kind: 'rect', role: 'handle-a-port', u: 0.30, w: 0.045, v: 0.768, h: 0.012, fill: '#8a8f98' },
    { kind: 'rect', role: 'handle-b-port', u: 0.48, w: 0.045, v: 0.768, h: 0.012, fill: '#8a8f98' },
    { kind: 'rect', role: 'handle-c-port', u: 0.66, w: 0.045, v: 0.768, h: 0.012, fill: '#8a8f98' },
    { kind: 'rect', role: 'windshield', u: 0.13, w: 0.10, v: 0.5, h: 0.20, fill: '#0c1a26' },
    { kind: 'rect', role: 'backlight', u: 0.80, w: 0.10, v: 0.5, h: 0.20, fill: '#0c1a26' },
  ],
};
export const LIMO_FRONT = { ...SEDAN_FRONT, id: 'limo-front', base: '#0a0c10' };
export const LIMO_REAR = { ...SEDAN_REAR, id: 'limo-rear', base: '#0a0c10' };

// Taxi — sedan geometry, yellow livery + checker band + medallion.
export const TAXI_BODY = {
  id: 'taxi-body', wrap: 'v', base: '#f2c012',
  parts: [
    { kind: 'band', role: 'under-shadow', v: 0.0, h: 0.16, fill: '#5a4708' },
    { kind: 'repeat', role: 'checker-stbd', u0: 0.18, u1: 0.82, count: 12, gap: 0.0, v: 0.2, h: 0.03, fill: '#11151c' },   // checker stripe (alternating reads via gaps)
    { kind: 'repeat', role: 'checker-port', u0: 0.18, u1: 0.82, count: 12, gap: 0.0, v: 0.8, h: 0.03, fill: '#11151c' },
    { kind: 'poly', role: 'glass-stbd', points: greenhouse(0.34, 0.2675), fill: '#0c1a26' },
    { kind: 'poly', role: 'glass-port', points: greenhouse(0.66, 0.7325), fill: '#0c1a26' },
    { kind: 'rect', role: 'medallion-stbd', u: 0.40, w: 0.06, v: 0.15, h: 0.05, fill: '#11151c' },
    { kind: 'rect', role: 'medallion-port', u: 0.40, w: 0.06, v: 0.85, h: 0.05, fill: '#11151c' },
    { kind: 'rect', role: 'windshield', u: 0.151, w: 0.145, v: 0.5, h: 0.20, fill: '#0c1a26' },
    { kind: 'rect', role: 'backlight', u: 0.62, w: 0.16, v: 0.5, h: 0.20, fill: '#0c1a26' },
    { kind: 'circle', role: 'wheel-fs', u: 0.175, v: 0.135, r: 0.050, fill: '#0b0d11' },
    { kind: 'circle', role: 'wheel-rs', u: 0.815, v: 0.135, r: 0.050, fill: '#0b0d11' },
    { kind: 'circle', role: 'wheel-fp', u: 0.175, v: 0.865, r: 0.050, fill: '#0b0d11' },
    { kind: 'circle', role: 'wheel-rp', u: 0.815, v: 0.865, r: 0.050, fill: '#0b0d11' },
  ],
};
export const TAXI_FRONT = { ...SEDAN_FRONT, id: 'taxi-front', base: '#f2c012' };
export const TAXI_REAR = { ...SEDAN_REAR, id: 'taxi-rear', base: '#f2c012' };

// Station wagon / estate — sedan width with a SUV-style high, flat roofline carried
// the full length to a liftgate (the net zTop drops only at the tail). Long rear side
// glass (extended greenhouse uC) reads as the cargo bay. Airfield ops/utility vehicle.
export const WAGON_BODY = {
  id: 'wagon-body', wrap: 'v', base: '#3a4654',
  parts: [
    { kind: 'band', role: 'under-shadow', v: 0.0, h: 0.15, fill: '#10161e' },
    { kind: 'poly', role: 'glass-stbd', points: greenhouse(0.35, 0.255, 0.235, 0.84), fill: '#0c1a26' },
    { kind: 'poly', role: 'glass-port', points: greenhouse(0.65, 0.745, 0.235, 0.84), fill: '#0c1a26' },
    { kind: 'rect', role: 'handle-f-stbd', u: 0.32, w: 0.05, v: 0.228, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-r-stbd', u: 0.52, w: 0.05, v: 0.228, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-f-port', u: 0.32, w: 0.05, v: 0.772, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'handle-r-port', u: 0.52, w: 0.05, v: 0.772, h: 0.013, fill: '#0a0f18' },
    { kind: 'rect', role: 'windshield', u: 0.155, w: 0.13, v: 0.5, h: 0.21, fill: '#0c1a26' },
    { kind: 'circle', role: 'wheel-fs', u: 0.18, v: 0.13, r: 0.052, fill: '#0b0d11' },
    { kind: 'circle', role: 'hub-fs', u: 0.18, v: 0.13, r: 0.022, fill: '#aab3bd' },
    { kind: 'circle', role: 'wheel-rs', u: 0.82, v: 0.13, r: 0.052, fill: '#0b0d11' },
    { kind: 'circle', role: 'hub-rs', u: 0.82, v: 0.13, r: 0.022, fill: '#aab3bd' },
    { kind: 'circle', role: 'wheel-fp', u: 0.18, v: 0.87, r: 0.052, fill: '#0b0d11' },
    { kind: 'circle', role: 'hub-fp', u: 0.18, v: 0.87, r: 0.022, fill: '#aab3bd' },
    { kind: 'circle', role: 'wheel-rp', u: 0.82, v: 0.87, r: 0.052, fill: '#0b0d11' },
    { kind: 'circle', role: 'hub-rp', u: 0.82, v: 0.87, r: 0.022, fill: '#aab3bd' },
  ],
};
export const WAGON_REAR = {
  id: 'wagon-rear', base: '#3a4654',
  parts: [
    { kind: 'band', role: 'bumper', v: 0.10, h: 0.20, fill: '#11151c' },
    { kind: 'rect', role: 'liftgate-glass', u: 0.15, w: 0.70, v: 0.66, h: 0.34, fill: '#0c1a26' },
    { kind: 'rect', role: 'tailgate-handle', u: 0.44, w: 0.12, v: 0.42, h: 0.03, fill: '#0a0f18' },
    { kind: 'rect', role: 'tlamp-l', u: 0.06, w: 0.12, v: 0.40, h: 0.22, fill: '#c0202a' },
    { kind: 'rect', role: 'tlamp-r', u: 0.82, w: 0.12, v: 0.40, h: 0.22, fill: '#c0202a' },
    { kind: 'rect', role: 'plate', u: 0.42, w: 0.16, v: 0.20, h: 0.10, fill: '#cdd4da' },
  ],
};

const CAR_CARDS = Object.fromEntries(
  [SEDAN_BODY, SEDAN_FRONT, SEDAN_REAR, SUV_BODY, SUV_REAR, LIMO_BODY, LIMO_FRONT, LIMO_REAR, TAXI_BODY, TAXI_FRONT, TAXI_REAR, WAGON_BODY, WAGON_REAR].map((c) => [c.id, c]),
);
export function getCarCard(idOrCard) {
  if (idOrCard && typeof idOrCard === 'object') return idOrCard;
  return CAR_CARDS[String(idOrCard || '').trim()] || null;
}

// ===========================================================================
// Registries — vehicles as data
// ===========================================================================
export const SMOOTH_BOX_NETS = {
  'city-bus': { label: 'City bus', geo: { length: 8.0, halfW: 1.16, halfH: 1.6, seN: 6, zc: 2.0 }, body: 'bus-body', front: 'bus-front', rear: 'bus-rear', axles: [{ u: 0.165, r: 0.55 }, { u: 0.83, r: 0.55 }] },
  'box-van': { label: 'Box van', geo: { length: 6.4, halfW: 1.24, halfH: 1.78, seN: 9, zc: 1.95 }, body: 'van-body', front: 'van-front', rear: 'van-rear', axles: [{ u: 0.20, r: 0.52 }, { u: 0.83, r: 0.52 }] },
  'box-truck': {
    label: 'Box truck', geo: { length: 8.2, halfW: 1.14, halfH: 1.95, seN: 8, zc: 2.05 },
    profile: [{ u: 0, h: 0.66 }, { u: 0.16, h: 0.68 }, { u: 0.23, h: 1.0 }, { u: 1, h: 1.0 }],
    body: 'truck-body', front: 'truck-front', rear: 'truck-rear', axles: [{ u: 0.16, r: 0.56 }, { u: 0.82, r: 0.56, dual: true }],
  },
  // catering / hi-loader truck — a SHORT cab + a tall box galley (the body that scissor-
  // lifts to a jet door). Profile lofts from a low cab to a full-height box; the raised
  // service cab + rails ride the roof as box accessories. Airfield-only GSE.
  'catering-truck': {
    label: 'Catering truck', geo: { length: 7.0, halfW: 1.18, halfH: 2.05, seN: 8, zc: 2.1 },
    profile: [{ u: 0, h: 0.72 }, { u: 0.12, h: 0.74 }, { u: 0.42, h: 1.0 }, { u: 1, h: 1.0 }],   // tall cab, gentle loft so the facade reads clean (no steep facet sawtooth)
    body: 'catering-body', front: 'catering-front', rear: 'catering-rear',
    axles: [{ u: 0.17, r: 0.50 }, { u: 0.82, r: 0.50 }],
    accessories: [
      { kind: 'box', role: 'lift-cab', uSpan: [0.82, 0.99], xHalf: 1.0, xOffset: 0, base: 'roof', height: 0.5, fill: '#dfe3e7' },
      { kind: 'box', role: 'rail-stbd', uSpan: [0.80, 1.0], xHalf: 0.04, xOffset: 0.95, base: 'roof', height: 0.12, fill: '#3a3f47' },
      { kind: 'box', role: 'rail-port', uSpan: [0.80, 1.0], xHalf: 0.04, xOffset: -0.95, base: 'roof', height: 0.12, fill: '#3a3f47' },
    ],
  },
  // belt loader — low chassis + a long CONVEYOR (a `ramp` accessory overhanging both ends:
  // ground-low at the tail, door-high ahead of the nose), its rollers reading as cross-bands.
  'belt-loader': {
    label: 'Belt loader', geo: { length: 3.2, halfW: 0.92, halfH: 0.7, seN: 7, zc: 0.78 },
    body: 'beltloader-body', front: 'beltloader-front', rear: 'beltloader-rear',
    axles: [{ u: 0.24, r: 0.34 }, { u: 0.80, r: 0.34 }],
    accessories: [
      { kind: 'ramp', role: 'conveyor', uSpan: [-0.6, 1.05], xHalf: 0.52, xOffset: 0, z0: 0.45, z1: 2.25, deck: 0.28, rollers: 9, fill: '#5a6066', treadFill: '#2c3138' },
    ],
  },
  // boarding stairs — small cab + a STEPPED `ramp` (the staircase) climbing forward to a
  // top platform at door height. The treads are real climbing step boxes.
  'boarding-stairs': {
    label: 'Boarding stairs', geo: { length: 3.2, halfW: 0.92, halfH: 1.15, seN: 7, zc: 1.2 },
    body: 'stairs-body', front: 'stairs-front', rear: 'stairs-rear',
    axles: [{ u: 0.22, r: 0.40 }, { u: 0.80, r: 0.40 }],
    accessories: [
      { kind: 'ramp', role: 'stairs', uSpan: [-1.25, 1.0], xHalf: 0.62, xOffset: 0, z0: 0.35, z1: 2.7, deck: 0.12, steps: 11, fill: '#9a9faa', treadFill: '#c2c7cf' },
      { kind: 'box', role: 'platform', uSpan: [-1.4, -1.05], xHalf: 0.66, xOffset: 0, base: 2.55, height: 0.06, fill: '#8b9097' },
    ],
  },
  // delivery/mail truck — box truck WIDENED, keeping the cab nose + angled facade
  // loft. Nose cap = grille, windshield prints on the facade (see delivery-body).
  'delivery-truck': {
    label: 'Delivery truck', geo: { length: 6.8, halfW: 1.36, halfH: 1.86, seN: 8, zc: 2.0 },
    profile: [{ u: 0, h: 0.64 }, { u: 0.12, h: 0.66 }, { u: 0.20, h: 1.0 }, { u: 1, h: 1.0 }],
    body: 'delivery-body', front: 'delivery-front', rear: 'delivery-rear', axles: [{ u: 0.19, r: 0.52 }, { u: 0.82, r: 0.52 }],
  },
  // streetcar/tram — a BUS-CROSS-SECTION vehicle (same halfW/halfH/zc as city-bus),
  // just 2.5× as long (20 vs 8) and articulated. `wid` rounds the nose/tail in plan and
  // `profile` drops the roof corners, so the swept ends read as CURVED faces; the
  // pantograph is a real roof box. No `size` multiplier — its real proportions are baked
  // into the net, so it renders bus-width at any caller scale.
  streetcar: {
    label: 'Streetcar', geo: { length: 20.0, halfW: 1.16, halfH: 1.6, seN: 7, zc: 2.0 },
    wid: [{ u: 0, h: 0.46 }, { u: 0.05, h: 0.72 }, { u: 0.16, h: 1.0 }, { u: 0.84, h: 1.0 }, { u: 0.95, h: 0.72 }, { u: 1, h: 0.46 }],
    profile: [{ u: 0, h: 0.82 }, { u: 0.06, h: 0.92 }, { u: 0.16, h: 1.0 }, { u: 0.84, h: 1.0 }, { u: 0.94, h: 0.92 }, { u: 1, h: 0.82 }],
    body: 'streetcar-body', front: 'streetcar-front', rear: 'streetcar-rear',
    axles: [],   // rail vehicle — bogies hide under the skirt, so no exposed wheels
    accessories: [
      { kind: 'box', role: 'pantograph', uSpan: [0.30, 0.42], xHalf: 0.45, xOffset: 0, base: 'roof', height: 0.45, fill: '#2a2f36' },
      { kind: 'box', role: 'hvac', uSpan: [0.56, 0.80], xHalf: 0.6, xOffset: 0, base: 'roof', height: 0.16, fill: '#b8bcc0' },
    ],
  },
};
export function getSmoothBoxNet(id) { return SMOOTH_BOX_NETS[String(id || '').trim()] || null; }

export function resolveSmoothBoxNet(netOrId) {
  const net = typeof netOrId === 'string' ? getSmoothBoxNet(netOrId) : netOrId;
  if (!net) throw new Error(`vehicle-swept-net: unknown net "${netOrId}" (box family)`);
  const body = getSmoothBoxCard(net.body), front = getSmoothBoxCard(net.front), rear = getSmoothBoxCard(net.rear);
  for (const [slot, card] of [['body', body], ['front', front], ['rear', rear]]) {
    if (!card) throw new Error(`vehicle-swept-net: no ${slot} card "${net[slot]}"`);
  }
  return { label: net.label, geo: net.geo, profile: net.profile || null, wid: net.wid || null, body, front, rear, axles: net.axles || [], accessories: net.accessories || [] };
}

// Car nets: WID/ZBOT/ZTOP are piecewise-linear along u (front→rear). seN low.
// `accessories` are real box primitives (taxi roof sign, SUV roof rails).
export const CAR_NETS = {
  sedan: {
    label: 'Sedan', length: 5.0, W0: 1.22, seN: 3.3,
    wid: [{ u: 0, v: 0.84 }, { u: 0.06, v: 0.97 }, { u: 0.5, v: 1.0 }, { u: 0.94, v: 0.97 }, { u: 1, v: 0.84 }],
    zBot: [{ u: 0, v: 0.54 }, { u: 0.1, v: 0.5 }, { u: 0.9, v: 0.5 }, { u: 1, v: 0.54 }],
    zTop: [{ u: 0, v: 1.30 }, { u: 0.08, v: 1.36 }, { u: 0.17, v: 1.42 }, { u: 0.22, v: 1.66 }, { u: 0.32, v: 2.06 }, { u: 0.56, v: 2.10 }, { u: 0.66, v: 1.95 }, { u: 0.76, v: 1.60 }, { u: 0.92, v: 1.46 }, { u: 1, v: 1.40 }],
    body: 'sedan-body', front: 'sedan-front', rear: 'sedan-rear',
    axles: [{ u: 0.175, r: 0.46 }, { u: 0.805, r: 0.46 }],
  },
  suv: {
    label: 'SUV', length: 5.2, W0: 1.30, seN: 4.5,
    wid: [{ u: 0, v: 0.86 }, { u: 0.06, v: 0.98 }, { u: 0.5, v: 1.0 }, { u: 0.94, v: 0.99 }, { u: 1, v: 0.92 }],
    zBot: [{ u: 0, v: 0.62 }, { u: 0.1, v: 0.58 }, { u: 0.9, v: 0.58 }, { u: 1, v: 0.62 }],          // raised ride height
    zTop: [{ u: 0, v: 1.36 }, { u: 0.09, v: 1.46 }, { u: 0.17, v: 1.92 }, { u: 0.22, v: 2.28 }, { u: 0.86, v: 2.30 }, { u: 0.91, v: 2.20 }, { u: 0.97, v: 1.78 }, { u: 1, v: 1.66 }],   // high+flat → liftgate drop
    body: 'suv-body', front: 'sedan-front', rear: 'suv-rear',
    axles: [{ u: 0.17, r: 0.56 }, { u: 0.83, r: 0.56 }],
    accessories: [
      { kind: 'box', role: 'roof-rail-stbd', uSpan: [0.28, 0.86], xHalf: 0.05, xOffset: 0.62, base: 'roof', height: 0.09, fill: '#1b1e24' },
      { kind: 'box', role: 'roof-rail-port', uSpan: [0.28, 0.86], xHalf: 0.05, xOffset: -0.62, base: 'roof', height: 0.09, fill: '#1b1e24' },
    ],
  },
  limo: {
    label: 'Limo', length: 11.0, W0: 1.20, seN: 3.3,
    wid: [{ u: 0, v: 0.84 }, { u: 0.05, v: 0.97 }, { u: 0.5, v: 1.0 }, { u: 0.95, v: 0.97 }, { u: 1, v: 0.84 }],
    zBot: [{ u: 0, v: 0.52 }, { u: 0.08, v: 0.48 }, { u: 0.92, v: 0.48 }, { u: 1, v: 0.52 }],
    zTop: [{ u: 0, v: 1.30 }, { u: 0.06, v: 1.36 }, { u: 0.12, v: 1.46 }, { u: 0.16, v: 1.96 }, { u: 0.20, v: 2.06 }, { u: 0.84, v: 2.06 }, { u: 0.90, v: 1.74 }, { u: 0.96, v: 1.50 }, { u: 1, v: 1.42 }],   // long flat cabin
    body: 'limo-body', front: 'limo-front', rear: 'limo-rear',
    axles: [{ u: 0.12, r: 0.42 }, { u: 0.62, r: 0.42 }, { u: 0.90, r: 0.42 }],          // long wheelbase + 3rd axle
  },
  taxi: {
    label: 'Taxi', length: 5.0, W0: 1.22, seN: 3.3,                                       // identical sedan geometry
    wid: [{ u: 0, v: 0.84 }, { u: 0.06, v: 0.97 }, { u: 0.5, v: 1.0 }, { u: 0.94, v: 0.97 }, { u: 1, v: 0.84 }],
    zBot: [{ u: 0, v: 0.54 }, { u: 0.1, v: 0.5 }, { u: 0.9, v: 0.5 }, { u: 1, v: 0.54 }],
    zTop: [{ u: 0, v: 1.30 }, { u: 0.08, v: 1.36 }, { u: 0.17, v: 1.42 }, { u: 0.22, v: 1.66 }, { u: 0.32, v: 2.06 }, { u: 0.56, v: 2.10 }, { u: 0.66, v: 1.95 }, { u: 0.76, v: 1.60 }, { u: 0.92, v: 1.46 }, { u: 1, v: 1.40 }],
    body: 'taxi-body', front: 'taxi-front', rear: 'taxi-rear',
    axles: [{ u: 0.175, r: 0.46 }, { u: 0.805, r: 0.46 }],
    accessories: [
      { kind: 'box', role: 'roof-sign', uSpan: [0.40, 0.52], xHalf: 0.16, xOffset: 0, base: 'roof', height: 0.22, fill: '#e8e4d2' },
    ],
  },
  // airfield ops/utility estate — sedan width, SUV ride height, flat roof to a liftgate;
  // low roof rails. Default service-green paint (overridable by the placement sampler).
  'station-wagon': {
    label: 'Station wagon', length: 4.9, W0: 1.24, seN: 3.6,
    wid: [{ u: 0, v: 0.84 }, { u: 0.06, v: 0.97 }, { u: 0.5, v: 1.0 }, { u: 0.94, v: 0.98 }, { u: 1, v: 0.90 }],
    zBot: [{ u: 0, v: 0.56 }, { u: 0.1, v: 0.52 }, { u: 0.9, v: 0.52 }, { u: 1, v: 0.56 }],
    zTop: [{ u: 0, v: 1.30 }, { u: 0.08, v: 1.38 }, { u: 0.16, v: 1.46 }, { u: 0.21, v: 1.78 }, { u: 0.30, v: 2.04 }, { u: 0.86, v: 2.06 }, { u: 0.93, v: 1.92 }, { u: 0.98, v: 1.64 }, { u: 1, v: 1.54 }],
    body: 'wagon-body', front: 'sedan-front', rear: 'wagon-rear',
    axles: [{ u: 0.18, r: 0.48 }, { u: 0.82, r: 0.48 }],
    accessories: [
      { kind: 'box', role: 'roof-rail-stbd', uSpan: [0.30, 0.88], xHalf: 0.05, xOffset: 0.5, base: 'roof', height: 0.07, fill: '#1b1e24' },
      { kind: 'box', role: 'roof-rail-port', uSpan: [0.30, 0.88], xHalf: 0.05, xOffset: -0.5, base: 'roof', height: 0.07, fill: '#1b1e24' },
    ],
  },
};
export function getCarNet(id) { return CAR_NETS[String(id || '').trim()] || null; }

// ===========================================================================
// Generative car finish — PAINT (body color) + HULL (proportion) variations, so a
// street of sedans/SUVs doesn't read as clones. Mirrors the aircraft livery model:
// a tiny palette the placement sampler draws from with the scene rng (deterministic).
// Glass / handles / lamps / bumpers / wheels are STRUCTURAL (explicit part fills) and
// stay constant; only the body + fascia-cap BASE is repainted, so any paint coheres.
// ===========================================================================
export const CAR_PAINT_SCHEMES = [
  { name: 'navy',         body: '#20407a' },   // the sedan's authored default
  { name: 'graphite',     body: '#2b2f36' },
  { name: 'gunmetal',     body: '#4a525c' },
  { name: 'silver',       body: '#a9b0b8' },
  { name: 'pearl',        body: '#dde1e6' },
  { name: 'black',        body: '#15181d' },
  { name: 'crimson',      body: '#7c1f24' },
  { name: 'burgundy',     body: '#54222e' },
  { name: 'racing-green', body: '#1f4a35' },
  { name: 'teal',         body: '#1f5560' },
  { name: 'sand',         body: '#c4b189' },
  { name: 'copper',       body: '#9c5a2c' },
];
// Pick a paint scheme — by explicit index, via rng() (deterministic), or at random.
export function pickCarPaint(rngOrIndex) {
  const n = CAR_PAINT_SCHEMES.length;
  if (typeof rngOrIndex === 'number') return CAR_PAINT_SCHEMES[((rngOrIndex % n) + n) % n];
  const r = typeof rngOrIndex === 'function' ? rngOrIndex() : Math.random();
  return CAR_PAINT_SCHEMES[Math.min(n - 1, Math.max(0, Math.floor(r * n)))];
}

// Hull = proportion multipliers on the swept FORM (not the cards), so the silhouette
// varies without re-authoring a net. `roof` scales cabin height (zTop−zBot), `wid` the
// half-width, `ride` the sill/ground clearance. Length is deliberately fixed so the
// body stays centred on its placement anchor (and never overlaps a neighbour).
export const CAR_HULL_VARIANTS = {
  standard: {},
  coupe:    { roof: 0.90, wid: 0.98 },   // lower, slightly narrower roofline
  chopped:  { roof: 0.84 },              // sectioned roof — sleek
  wide:     { wid: 1.09 },               // wide-body stance
  narrow:   { wid: 0.93 },               // economy / kei
  lowered:  { ride: 0.82, roof: 1.02 },  // dropped onto the wheels
  lifted:   { ride: 1.18, wid: 1.03 },   // raised ride height (lift kit)
};
export const CAR_HULL_NAMES = Object.keys(CAR_HULL_VARIANTS);
// Resolve a hull spec (name | multiplier object | undefined) to full multipliers.
export function resolveCarHull(hull) {
  const base = { wid: 1, roof: 1, ride: 1 };
  if (!hull) return base;
  if (typeof hull === 'string') return { ...base, ...(CAR_HULL_VARIANTS[hull] || {}) };
  return { ...base, ...hull };
}
// Pick a hull variant NAME — by explicit index, via rng(), or at random.
export function pickCarHull(rngOrIndex) {
  const n = CAR_HULL_NAMES.length;
  if (typeof rngOrIndex === 'number') return CAR_HULL_NAMES[((rngOrIndex % n) + n) % n];
  const r = typeof rngOrIndex === 'function' ? rngOrIndex() : Math.random();
  return CAR_HULL_NAMES[Math.min(n - 1, Math.max(0, Math.floor(r * n)))];
}

export function resolveCarNet(netOrId, paint) {
  const net = typeof netOrId === 'string' ? getCarNet(netOrId) : netOrId;
  if (!net) throw new Error(`vehicle-swept-net: unknown net "${netOrId}" (car family)`);
  let body = getCarCard(net.body), front = getCarCard(net.front), rear = getCarCard(net.rear);
  for (const [slot, card] of [['body', body], ['front', front], ['rear', rear]]) {
    if (!card) throw new Error(`vehicle-swept-net: no ${slot} card "${net[slot]}"`);
  }
  // PAINT: recolor body + both fascia caps to one base so nose/tail match the flank.
  if (paint) { body = { ...body, base: paint }; front = { ...front, base: paint }; rear = { ...rear, base: paint }; }
  return {
    label: net.label, length: net.length, W0: net.W0, seN: net.seN,
    wid: net.wid, zBot: net.zBot, zTop: net.zTop,
    body, front, rear, axles: net.axles || [], accessories: net.accessories || [],
  };
}

// ===========================================================================
// Geometry: ONE swept superellipse, two families normalize into it
// ===========================================================================
function sePow(x, n) { return Math.sign(x) * Math.pow(Math.abs(x), 2 / n); }
function seXZ(theta, n) { const t = 2 * Math.PI * theta; return [sePow(Math.sin(t), n), -sePow(Math.cos(t), n)]; }
// piecewise-linear lookup over [{ u, [key] }] sorted by u.
function lerpAt(pts, u, key) {
  for (let i = 1; i < pts.length; i += 1) {
    if (u <= pts[i].u) { const a = pts[i - 1], b = pts[i]; const t = (u - a.u) / (b.u - a.u || 1); return a[key] + (b[key] - a[key]) * t; }
  }
  return pts[pts.length - 1][key];
}

// A resolved net → the family-agnostic cross-section FORM the core builder needs.
function boxForm(resolved) {
  const { geo, profile, wid } = resolved, belly = geo.zc - geo.halfH;
  return {
    length: geo.length, seN: geo.seN,
    halfWAt: wid ? (u) => geo.halfW * lerpAt(wid, u, 'h') : () => geo.halfW,   // optional nose/tail taper (curved ends)
    zBotAt: () => belly,
    zTopAt: (u) => belly + 2 * geo.halfH * (profile ? lerpAt(profile, u, 'h') : 1),
  };
}
function carForm(resolved, hull) {
  const h = resolveCarHull(hull);   // { wid, roof, ride } multipliers (all 1 = stock)
  return {
    length: resolved.length, seN: resolved.seN,
    halfWAt: (u) => resolved.W0 * lerpAt(resolved.wid, u, 'v') * h.wid,
    zBotAt: (u) => lerpAt(resolved.zBot, u, 'v') * h.ride,
    zTopAt: (u) => { const zb = lerpAt(resolved.zBot, u, 'v'), zt = lerpAt(resolved.zTop, u, 'v'); return zb * h.ride + (zt - zb) * h.roof; },
  };
}

function sweptPoint(form, place, u, theta) {
  const hw = form.halfWAt(u), zb = form.zBotAt(u), zt = form.zTopAt(u);
  const [ex, ez] = seXZ(theta, form.seN);
  return [place.cx + hw * ex, place.noseY - u * form.length, (zb + zt) / 2 + ((zt - zb) / 2) * ez];
}
// Flat fascia quad "carved" across an end (u across width, v up).
function capQuad(form, place, uEnd) {
  const hw = form.halfWAt(uEnd) * 0.9, zb = form.zBotAt(uEnd), zt = form.zTopAt(uEnd);
  const c = (zb + zt) / 2, hh = (zt - zb) / 2, y = place.noseY - uEnd * form.length;
  return [[place.cx - hw, y, c - hh * 0.92], [place.cx + hw, y, c - hh * 0.92], [place.cx + hw, y, c + hh * 0.92], [place.cx - hw, y, c + hh * 0.92]];
}
// 6 faces of an axis-aligned box (a,b,c,d wound consistently per face).
function boxFaces(xmin, xmax, ymin, ymax, zmin, zmax) {
  const V = (x, y, z) => [x, y, z];
  return [
    [V(xmax, ymin, zmin), V(xmax, ymax, zmin), V(xmax, ymax, zmax), V(xmax, ymin, zmax)],   // +x
    [V(xmin, ymax, zmin), V(xmin, ymin, zmin), V(xmin, ymin, zmax), V(xmin, ymax, zmax)],   // -x
    [V(xmax, ymax, zmin), V(xmin, ymax, zmin), V(xmin, ymax, zmax), V(xmax, ymax, zmax)],   // +y
    [V(xmin, ymin, zmin), V(xmax, ymin, zmin), V(xmax, ymin, zmax), V(xmin, ymin, zmax)],   // -y
    [V(xmin, ymin, zmax), V(xmax, ymin, zmax), V(xmax, ymax, zmax), V(xmin, ymax, zmax)],   // +z (top)
    [V(xmin, ymax, zmin), V(xmax, ymax, zmin), V(xmax, ymin, zmin), V(xmin, ymin, zmin)],   // -z (bottom)
  ];
}

/**
 * The shared swept-vehicle renderer. Body wrap (swept superellipse) + flat fascia
 * caps + protruding wheel discs + accessory boxes, vexar-lit, back-face culled,
 * depth-sorted into one strokeless painter list. Returns the shapes array of
 * render-agnostic `{ type:'poly', fill }`.
 */
function buildSweptSceneShapes(form, {
  body, front, rear, axles = [], accessories = [],
  place, projectPoint, cameraPosition, light = SWEPT_DEFAULT_LIGHT, quality = 'default', ns, na, cull = true,
}) {
  // cull=true: keep only camera-facing faces (the 2D painter path). cull=false:
  // emit the whole closed shell so a 3D backend (CSS3D) can show it from any camera.
  const NS = ns ?? lodCount(80, quality, 16), NA = na ?? lodCount(56, quality, 14);
  const project = (w) => { const p = projectPoint(w); return Array.isArray(p) ? { x: p[0], y: p[1] } : p; };
  const dist = (c) => Math.hypot(c[0] - cameraPosition[0], c[1] - cameraPosition[1], c[2] - cameraPosition[2]);
  const midHalfW = form.halfWAt(0.5), midHH = (form.zTopAt(0.5) - form.zBotAt(0.5)) / 2;
  const perim = 3.2 * (midHalfW + midHH);
  const ctx = stickerContext(body, form.length, perim);
  const faces = [];

  // body — swept superellipse, vexar shaded, back-face culled
  for (let i = 0; i < NS; i += 1) {
    const u0 = i / NS, u1 = (i + 1) / NS, uc = (u0 + u1) / 2;
    const spine = [place.cx, place.noseY - uc * form.length, (form.zBotAt(uc) + form.zTopAt(uc)) / 2];
    for (let j = 0; j < NA; j += 1) {
      const t0 = j / NA, t1 = (j + 1) / NA, tc = (t0 + t1) / 2;
      const wpts = [sweptPoint(form, place, u0, t0), sweptPoint(form, place, u1, t0), sweptPoint(form, place, u1, t1), sweptPoint(form, place, u0, t1)];
      const c = centroid(wpts);
      const n = orientOutward(newellNormal(wpts), c, spine);
      if (cull && dot3(n, sub3(cameraPosition, c)) <= 0) continue;
      faces.push({ wpts, fill: shadeHex(sampleStickerCard(body, uc, tc, ctx), n, light), role: `${body.id}:${i}.${j}`, dist: dist(c) });
    }
  }

  // fascia caps — flat, facing the camera (front/rear)
  const GU = lodCount(30, quality, 12), GV = lodCount(22, quality, 8);
  for (const cap of [{ corners: capQuad(form, place, 0), card: front, n: [0, 1, 0] }, { corners: capQuad(form, place, 1), card: rear, n: [0, -1, 0] }]) {
    if (cull && dot3(cap.n, sub3(cameraPosition, centroid(cap.corners))) <= 0) continue;
    const aspect = Math.hypot(...sub3(cap.corners[1], cap.corners[0])) / (Math.hypot(...sub3(cap.corners[3], cap.corners[0])) || 1);
    const cctx = stickerContext(cap.card, aspect, 1);
    for (let i = 0; i < GU; i += 1) for (let j = 0; j < GV; j += 1) {
      const u0 = i / GU, u1 = (i + 1) / GU, v0 = j / GV, v1 = (j + 1) / GV;
      const wpts = [bilerp4(cap.corners, u0, v0), bilerp4(cap.corners, u1, v0), bilerp4(cap.corners, u1, v1), bilerp4(cap.corners, u0, v1)];
      faces.push({ wpts, fill: shadeHex(sampleStickerCard(cap.card, (u0 + u1) / 2, (v0 + v1) / 2, cctx), cap.n, light), role: `${cap.card.id}:${i}.${j}`, dist: dist(centroid(wpts)) });
    }
  }

  // wheels — protruding discs per axle (dual = a second offset disc per side)
  const SEG = 30;
  for (const ax of axles) {
    const yw = place.noseY - ax.u * form.length, offs = ax.dual ? [ax.r * 0.62, -ax.r * 0.62] : [0];
    for (const sign of [1, -1]) for (const dy of offs) {
      const center = [place.cx + sign * form.halfWAt(ax.u) * 0.98, yw + dy, ax.r], n = [sign, 0, 0];
      const ring = (rad) => { const p = []; for (let k = 0; k < SEG; k += 1) { const a = (2 * Math.PI * k) / SEG; p.push([center[0], center[1] + rad * Math.cos(a), center[2] + rad * Math.sin(a)]); } return p; };
      const d = dist(center);
      faces.push({ wpts: ring(ax.r), fill: shadeHex('#0c0e12', n, light), role: 'wheel', dist: d + 0.02 });
      faces.push({ wpts: ring(ax.r * 0.42), fill: shadeHex('#aab3bd', n, light), role: 'hub', dist: d });
    }
  }

  // accessories — vexar-lit + culled. `box` = axis-aligned volume (roof sign / rails /
  // raised cab). `ramp` = a sloped deck (a parallelepiped tilted along the length): the
  // GSE primitive for belt-loader conveyors and boarding-stair stringers. A ramp may
  // carry `steps` (climbing treads → a staircase) or `rollers` (thin cross-bands → a
  // conveyor). `uSpan` may run OUTSIDE [0,1] so the deck overhangs nose/tail.
  for (const acc of accessories) {
    const emit = (wpts, fill, center) => {
      const c = centroid(wpts);
      const n = orientOutward(newellNormal(wpts), c, center);
      if (cull && dot3(n, sub3(cameraPosition, c)) <= 0) return;
      faces.push({ wpts, fill: shadeHex(fill, n, light), role: `accessory:${acc.role}`, dist: dist(c) });
    };
    if (acc.kind === 'box') {
      const midU = (acc.uSpan[0] + acc.uSpan[1]) / 2;
      const zBase = acc.base === 'roof' ? form.zTopAt(midU) : acc.base;
      const xc = place.cx + (acc.xOffset || 0);
      const xmin = xc - acc.xHalf, xmax = xc + acc.xHalf;
      const ymin = place.noseY - acc.uSpan[1] * form.length, ymax = place.noseY - acc.uSpan[0] * form.length;
      const zmin = zBase, zmax = zBase + acc.height;
      const accCenter = [(xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2];
      for (const wpts of boxFaces(xmin, xmax, ymin, ymax, zmin, zmax)) emit(wpts, acc.fill, accCenter);
    } else if (acc.kind === 'ramp') {
      const L = form.length, deck = acc.deck ?? 0.16;
      const xc = place.cx + (acc.xOffset || 0), xL = xc - acc.xHalf, xR = xc + acc.xHalf;
      const yF = place.noseY - acc.uSpan[0] * L, yR = place.noseY - acc.uSpan[1] * L;   // front (high z1) / rear (low z0)
      const z1 = acc.z1, z0 = acc.z0;
      const C = [(xL + xR) / 2, (yF + yR) / 2, (z0 + z1) / 2 - deck / 2];
      const TFL = [xL, yF, z1], TFR = [xR, yF, z1], TRL = [xL, yR, z0], TRR = [xR, yR, z0];
      const BFL = [xL, yF, z1 - deck], BFR = [xR, yF, z1 - deck], BRL = [xL, yR, z0 - deck], BRR = [xR, yR, z0 - deck];
      emit([TFL, TFR, TRR, TRL], acc.fill, C);   // sloped deck top
      emit([BFL, BFR, BRR, BRL], acc.fill, C);   // underside
      emit([TFL, TFR, BFR, BFL], acc.fill, C);   // high end
      emit([TRL, TRR, BRR, BRL], acc.fill, C);   // low end
      emit([TFL, TRL, BRL, BFL], acc.fill, C);   // -x flank
      emit([TFR, TRR, BRR, BFR], acc.fill, C);   // +x flank
      if (acc.steps) {                            // climbing treads — a staircase read
        const N = acc.steps, th = acc.stepThick ?? 0.1;
        for (let i = 0; i < N; i += 1) {
          const ya = yR + (yF - yR) * (i / N), yb = yR + (yF - yR) * ((i + 1) / N), zt = z0 + (z1 - z0) * ((i + 1) / N);
          const sc = [(xL + xR) / 2, (ya + yb) / 2, zt - th / 2];
          for (const wpts of boxFaces(xL, xR, Math.min(ya, yb), Math.max(ya, yb), zt - th, zt)) emit(wpts, acc.treadFill || '#c2c7cf', sc);
        }
      }
      if (acc.rollers) {                          // thin cross-bands on the deck — a conveyor read
        const N = acc.rollers, bw = Math.abs(yF - yR) / N * 0.34;
        for (let i = 0; i < N; i += 1) {
          const yc = yR + (yF - yR) * ((i + 0.5) / N), zc = z0 + (z1 - z0) * ((i + 0.5) / N) + 0.004;
          emit([[xL, yc - bw / 2, zc], [xR, yc - bw / 2, zc], [xR, yc + bw / 2, zc], [xL, yc + bw / 2, zc]], acc.treadFill || '#23272d', [xc, yc, zc - 0.5]);
        }
      }
    }
  }

  faces.sort((a, b) => b.dist - a.dist);
  return faces.map((f) => ({ type: 'poly', points: f.wpts.map(project), fill: f.fill, stroke: 'none', strokeWidth: 0, role: f.role }));
}

// ===========================================================================
// Public builders — one per family, both delegating to the shared core
// ===========================================================================
/** Box vehicle (bus / van / truck). `place` = { cx, noseY }. */
export function buildSmoothBoxNetSceneShapes(netOrId, opts = {}) {
  const resolved = typeof netOrId === 'object' && netOrId.body?.parts ? netOrId : resolveSmoothBoxNet(netOrId);
  const { place, projectPoint, cameraPosition, light = SMOOTH_BOX_DEFAULT_LIGHT, quality = 'default', ns, na, cull } = opts;
  const shapes = buildSweptSceneShapes(boxForm(resolved), {
    body: resolved.body, front: resolved.front, rear: resolved.rear, axles: resolved.axles, accessories: resolved.accessories,
    place, projectPoint, cameraPosition, light, quality, ns, na, cull,
  });
  return { resolved, shapes };
}

/** Car (sedan / suv / limo / taxi). `place` = { cx, noseY }. */
export function buildCarNetSceneShapes(netOrId, opts = {}) {
  const { place, projectPoint, cameraPosition, light = CAR_DEFAULT_LIGHT, quality = 'default', ns, na, cull, paint, hull } = opts;
  const resolved = typeof netOrId === 'object' && netOrId.body?.parts ? netOrId : resolveCarNet(netOrId, paint);
  const shapes = buildSweptSceneShapes(carForm(resolved, hull), {
    body: resolved.body, front: resolved.front, rear: resolved.rear, axles: resolved.axles, accessories: resolved.accessories,
    place, projectPoint, cameraPosition, light, quality, ns, na, cull,
  });
  return { resolved, shapes };
}
