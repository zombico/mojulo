/**
 * THE COCKPITS — a starfighter's tuning and the cockpit it is flown from, a card a craft of the shelf: four by their
 * tuning, in the register of the 90s space-combat sims, each read off its airframe (craft-shelf/craft-archetypes.js) and
 * its canopy (craft-shelf/craft-odm.js):
 *
 *   strikeFoil        general    a four-foil snubfighter: a faceted bubble canopy, hoops at 30% and 60% of its length, four
 *                                cannons linked one, two or four, shields fore and aft; its panel a broad dashboard under a
 *                                glare shield, the targeting computer in the middle, a sensor scope each side
 *   arrowInterceptor  speed      an arrowhead interceptor: a low faceted canopy close over the head, one hoop, two cannons,
 *                                thin shields, the fastest and quickest to turn; its panel a narrow centre console, the
 *                                speed and the throttle read first
 *   heavyFighter      firepower  a carrier heavy fighter: an armoured canopy (its posts and both hoops), four heavy cannons and
 *                                racks of warheads, the deepest shields and hull, slow to turn; its panel wide and deep,
 *                                the ordnance read beside the targeting computer
 *   twinPanel         the other side's general: the twin-panel fighter's ball pod, seen out of its round viewport (a fine
 *                                rim and spokes, a window's tracery and not girders),
 *                                no shields, two cannons, quick; its panel the curve of the ball under the window
 *
 * A card:
 *   tuning   'general' | 'speed' | 'firepower'
 *   numbers  { speedOfMax, rates: { pitch, yaw, roll }, hull, shields: { max, regen } | null, lasers: { energy, regen, rof,
 *              damage, links }, warheads }   (skyscape/starfighter.js lays the pilot from them)
 *   eye      where the pilot's eye sits in the canopy: { t: its share of the canopy's length back from the front, up: its
 *            share of the canopy's height over the sill } (a bubble), { back: m behind the window } (a round window)
 *   frame    which of the canopy's members are bars: { edges: ['shoulder' | 'crown' …] (the facet edges along it that are
 *            framed: the shoulders' posts, the crown's rails; the rest are seams in the glass), bows: [its hoops, of the
 *            shelf's], bar, bow (their radii, m) }
 *   panel    the instrument panel over the screen's foot: { height: its share of the screen (0.28), top: the panel's top
 *            edge, [[x, y]…] as shares of the screen (x 0 to 1, y down from the top), slots: { fore, aft, computer,
 *            systems, flight }: each [x0, y0, x1, y1] shares of the screen, round: the slots drawn as round scopes }
 *
 *   COCKPITS · cockpitOf(airframe) → its card (a craft with none flies the general one's)
 *   canopyFrame(airframe)          → { bars: [{ pts: [[x, y, z]…], r }], window?: { z, r, hub } , fill: 'bubble' | 'round' }
 *                                    the canopy's frame in the eye's frame (x right, y up, z ahead, m): a bubble's facet
 *                                    edges and its hoops from the shelf's own canopy; a round window's rim and spokes
 *   CRAFT_PLANS · planOf(archetype) → a craft's outline from above (an SVG path in a 100 box, its nose up): what its
 *                                    shields are read off (mana-ui `shields`); a craft with none a plain dart
 *   frameCover(airframe, { aspect?, vfov? }) → the share of the view over the panel the bars cover (each segment
 *                                    projected as the page projects it, as thick as it is near): how much the frame hides
 *
 * Pure: the same craft, the same cockpit.
 */
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { CRAFT_ODM } from '../craft-shelf/craft-odm.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const P = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));

export const PANEL_HEIGHT = 0.28;
/** The most of the view over the panel a cockpit's frame may hide (frameCover): the view is what is flown by. */
export const FRAME_COVER_MAX = 0.16;

export const COCKPITS = Object.freeze({
  strikeFoil: Object.freeze({
    tuning: 'general',
    numbers: Object.freeze({ speedOfMax: 0.75, rates: Object.freeze({ pitch: 1.5, yaw: 1.1, roll: 2.4 }), hull: 12, shields: Object.freeze({ max: 8, regen: 0.25 }), lasers: Object.freeze({ energy: 24, regen: 4, rof: 6, damage: 1, links: Object.freeze([1, 2, 4]) }), warheads: 6 }),
    eye: Object.freeze({ t: 0.74, up: 0.58 }), frame: Object.freeze({ edges: Object.freeze(['shoulder']), bows: Object.freeze([0.3]), bar: 0.02, bow: 0.02 }),
    panel: Object.freeze({
      height: PANEL_HEIGHT,
      // a broad dashboard, the glare shield raised over the middle
      top: P([[0, 0.74], [0.3, 0.73], [0.38, 0.705], [0.62, 0.705], [0.7, 0.73], [1, 0.74]]),
      slots: Object.freeze({ fore: [0.12, 0.765, 0.25, 0.975], systems: [0.26, 0.76, 0.4, 0.975], computer: [0.405, 0.725, 0.595, 0.975], flight: [0.6, 0.76, 0.74, 0.975], aft: [0.75, 0.765, 0.88, 0.975] }),
    }),
  }),
  arrowInterceptor: Object.freeze({
    tuning: 'speed',
    numbers: Object.freeze({ speedOfMax: 0.95, rates: Object.freeze({ pitch: 1.9, yaw: 1.4, roll: 3.2 }), hull: 8, shields: Object.freeze({ max: 5, regen: 0.3 }), lasers: Object.freeze({ energy: 20, regen: 4, rof: 7, damage: 1, links: Object.freeze([1, 2]) }), warheads: 4 }),
    eye: Object.freeze({ t: 0.78, up: 0.66 }), frame: Object.freeze({ edges: Object.freeze(['shoulder']), bows: Object.freeze([0.4]), bar: 0.018, bow: 0.018 }),
    panel: Object.freeze({
      height: PANEL_HEIGHT,
      // a narrow centre console between the knees, the sides falling away under the low canopy's sills
      top: P([[0, 0.78], [0.28, 0.77], [0.34, 0.72], [0.66, 0.72], [0.72, 0.77], [1, 0.78]]),
      slots: Object.freeze({ fore: [0.2, 0.8, 0.32, 0.98], systems: [0.345, 0.745, 0.445, 0.975], computer: [0.45, 0.74, 0.58, 0.975], flight: [0.585, 0.735, 0.665, 0.975], aft: [0.68, 0.8, 0.8, 0.98] }),
    }),
  }),
  heavyFighter: Object.freeze({
    tuning: 'firepower',
    numbers: Object.freeze({ speedOfMax: 0.6, rates: Object.freeze({ pitch: 1.1, yaw: 0.8, roll: 1.6 }), hull: 20, shields: Object.freeze({ max: 12, regen: 0.25 }), lasers: Object.freeze({ energy: 30, regen: 4, rof: 5, damage: 1.5, links: Object.freeze([1, 2, 4]) }), warheads: 12 }),
    eye: Object.freeze({ t: 0.76, up: 0.56 }), frame: Object.freeze({ edges: Object.freeze(['shoulder']), bows: Object.freeze([0.3, 0.65]), bar: 0.028, bow: 0.024 }),
    panel: Object.freeze({
      height: PANEL_HEIGHT,
      // wide and deep, flat across, its side consoles stepped up
      top: P([[0, 0.7], [0.14, 0.7], [0.17, 0.725], [0.83, 0.725], [0.86, 0.7], [1, 0.7]]),
      slots: Object.freeze({ fore: [0.03, 0.73, 0.16, 0.95], systems: [0.18, 0.75, 0.38, 0.975], computer: [0.39, 0.745, 0.61, 0.975], flight: [0.62, 0.75, 0.82, 0.975], aft: [0.84, 0.73, 0.97, 0.95] }),
    }),
  }),
  twinPanel: Object.freeze({
    tuning: 'general',
    numbers: Object.freeze({ speedOfMax: 0.85, rates: Object.freeze({ pitch: 1.7, yaw: 1.3, roll: 2.6 }), hull: 8, shields: null, lasers: Object.freeze({ energy: 20, regen: 5, rof: 7, damage: 1, links: Object.freeze([1, 2]) }), warheads: 0 }),
    eye: Object.freeze({ back: 0.72 }), frame: Object.freeze({ bar: 0.012, bow: 0.012 }),
    panel: Object.freeze({
      height: PANEL_HEIGHT,
      // the curve of the ball under its window
      top: P([[0, 0.7], [0.15, 0.73], [0.3, 0.75], [0.5, 0.755], [0.7, 0.75], [0.85, 0.73], [1, 0.7]]),
      slots: Object.freeze({ fore: [0.16, 0.775, 0.29, 0.985], systems: [0.3, 0.78, 0.41, 0.975], computer: [0.42, 0.775, 0.58, 0.975], flight: [0.59, 0.78, 0.7, 0.975], aft: [0.71, 0.775, 0.84, 0.985] }),
    }),
  }),
});

/** A craft's cockpit card: its own, else the general one's (the strike foil's). */
export function cockpitOf(airframe) {
  return COCKPITS[airframe] ?? COCKPITS.strikeFoil;
}

// a faceted bubble's section corners (craft-parts.js canopyGeometry FACET): x a share of the half-width, z of the height
const FACET = [[1, 0], [0.62, 0.7], [0.18, 1], [-0.18, 1], [-0.62, 0.7], [-1, 0]];
const STATIONS = [[0, 0.3, 0.25], [0.3, 1, 0.92], [0.7, 0.95, 1], [1, 0.6, 0.55]];

/** The canopy's frame seen from the seat, in the eye's frame (x right, y up, z ahead, metres). */
export function canopyFrame(airframe) {
  const A = CRAFT_ARCHETYPES[airframe] ?? CRAFT_ARCHETYPES.strikeFoil, C = cockpitOf(airframe);
  const sku = (A.layout.find((l) => l.id === 'canopy' || l.id === 'window') ?? {}).sku, row = CRAFT_ODM[sku];
  const b = row?.build ?? { family: 'bubble', facets: true, bows: [0.3, 0.6] }, { length: L, width: W, height: H } = row?.dims ?? { length: 2.3, width: 0.95, height: 0.68 };
  if (b.family === 'roundWindow') {
    // the rim and its spokes, the window `back` m ahead of the eye; the spokes run in from the rim to a hub ring left clear
    // round the sight (the shelf's run to the middle: the eye looks through the hub)
    const R = W / 2, z = C.eye.back ?? 0.7, n = b.spokes || 8, hub = R * 0.2, bars = [];
    const ring = (rad) => Array.from({ length: 33 }, (_, k) => { const a = (k / 32) * 2 * Math.PI; return [r3(Math.cos(a) * rad), r3(Math.sin(a) * rad), r3(z)]; });
    bars.push({ pts: ring(R * 0.96), r: C.frame.bar * 1.6 }, { pts: ring(hub), r: C.frame.bar });
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI + Math.PI / n; bars.push({ pts: [[r3(Math.cos(a) * hub), r3(Math.sin(a) * hub), r3(z)], [r3(Math.cos(a) * R * 0.96), r3(Math.sin(a) * R * 0.96), r3(z)]], r: C.frame.bar }); }
    return { fill: 'round', window: { z: r3(z), r: r3(R * 0.96), hub: r3(hub) }, bars };
  }
  const rows = b.stations || STATIONS, te = C.eye.t ?? 0.75, ze = (C.eye.up ?? 0.58) * H;
  // a point of the canopy (its station t, a corner's x and z shares) seen from the eye
  const at = (t, w, h, fx, fz) => [r3(fx * (w * W) / 2), r3(fz * h * H - ze), r3((te - t) * L)];
  const bars = [];
  // the sills first (the cockpit's sides stand under them: not bars, the walls' edge), then the facet edges the card
  // frames, station to station
  const edge = { sill: (fz) => fz === 0, shoulder: (fz) => fz === 0.7, crown: (fz) => fz === 1 };
  for (const [fx, fz] of FACET) if (fz === 0) bars.push({ pts: rows.map(([t, w, h]) => at(t, w, h, fx, fz)), r: 0, sill: true });
  for (const [fx, fz] of FACET) if ((C.frame.edges ?? []).some((k) => edge[k] && edge[k](fz))) bars.push({ pts: rows.map(([t, w, h]) => at(t, w, h, fx, fz)), r: C.frame.bar });
  // the hoops across it, those of the shelf's the card frames
  for (const f of (b.bows || []).filter((x) => !C.frame.bows || C.frame.bows.includes(x))) {
    const st = rows.reduce((acc, r) => (r[0] <= f ? r : acc), rows[0]), pts = [];
    for (let i = 0; i <= 12; i++) { const th = (i / 12) * Math.PI; pts.push([r3(Math.cos(th) * ((st[1] * W) / 2) * 1.03), r3(Math.sin(th) * st[2] * H * 1.03 - ze), r3((te - f) * L)]); }
    bars.push({ pts, r: C.frame.bow });
  }
  return { fill: 'bubble', bars };
}

/** How much of the view over the panel the canopy's bars hide: each segment projected as the page draws it (cockpit-hud.js
 *  cockpitFramePage: its radius over its depth, a stroke at most an eighth of the screen's height), its length clipped to
 *  the screen, summed over the area above the panel. An estimate (overlaps counted twice), to tell one frame from another. */
export function frameCover(airframe, { aspect = 16 / 9, vfov = 60 } = {}) {
  const F = canopyFrame(airframe), C = cockpitOf(airframe), t = Math.tan((vfov * Math.PI) / 360), H = 1, W = aspect, f = H / 2 / t;
  const top = Math.min(...C.panel.top.map(([, y]) => y)), at = (p) => [W / 2 + (p[0] / p[2] / (t * aspect)) * (W / 2), H / 2 - (p[1] / p[2] / t) * (H / 2)];
  const inView = (q) => q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= top;
  let area = 0;
  for (const B of F.bars) {
    if (!(B.r > 0)) continue;
    for (let i = 1; i < B.pts.length; i++) {
      const p0 = B.pts[i - 1], p1 = B.pts[i];
      if (p0[2] <= 0.05 || p1[2] <= 0.05) continue;
      const a = at(p0), b = at(p1), w = Math.min(H * 0.12, (2 * B.r * f) / ((p0[2] + p1[2]) / 2));
      // (the share of the segment on the screen over the panel, by its sampled points)
      let on = 0; for (let k = 0; k <= 8; k++) { const u = k / 8; on += inView([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]) ? 1 : 0; }
      area += Math.hypot(b[0] - a[0], b[1] - a[1]) * w * (on / 9);
    }
  }
  return Math.round((area / (W * top)) * 1000) / 1000;
}

/** Each craft's outline seen from above, its nose up (an SVG path in a 100 box): the plan its shields are read off. */
export const CRAFT_PLANS = Object.freeze({
  // the four foils swept back off a long nose
  strikeFoil: 'M47 3 L53 3 L55 48 L95 56 L95 68 L56 71 L57 93 L43 93 L44 71 L5 68 L5 56 L45 48 Z',
  // an arrowhead, its two pods at its trailing corners
  arrowInterceptor: 'M50 5 L88 86 L66 94 L50 84 L34 94 L12 86 Z',
  // a long body on short wings, its twin fins aft
  heavyFighter: 'M43 3 L57 3 L60 38 L91 50 L91 64 L62 66 L64 95 L36 95 L38 66 L9 64 L9 50 L40 38 Z',
  // a ball between two flat panels, seen edge on from above
  twinPanel: 'M3 18 L11 18 L11 82 L3 82 Z M89 18 L97 18 L97 82 L89 82 Z M11 47 L36 47 L36 53 L11 53 Z M64 47 L89 47 L89 53 L64 53 Z M50 33 A17 17 0 1 1 49.9 33 Z',
  // the ball between two bent dagger panels
  daggerInterceptor: 'M4 8 L12 14 L14 50 L12 86 L4 92 L8 50 Z M96 8 L88 14 L86 50 L88 86 L96 92 L92 50 Z M14 47 L37 47 L37 53 L14 53 Z M63 47 L86 47 L86 53 L63 53 Z M50 35 A15 15 0 1 1 49.9 35 Z',
  // two pods side by side, panels outboard
  twinPodBomber: 'M3 20 L10 20 L10 80 L3 80 Z M90 20 L97 20 L97 80 L90 80 Z M10 47 L22 47 L22 53 L10 53 Z M78 47 L90 47 L90 53 L78 53 Z M34 14 A12 12 0 0 1 46 26 L46 86 L22 86 L22 26 A12 12 0 0 1 34 14 Z M54 30 L78 30 L78 84 L54 84 Z',
  // a long liner
  starliner: 'M50 3 C63 9 66 28 66 48 L66 92 L34 92 L34 48 C34 28 37 9 50 3 Z',
});
const DART = 'M50 6 L74 90 L50 78 L26 90 Z';

/** A craft's outline from above: its own, else a plain dart. */
export function planOf(archetype) {
  return CRAFT_PLANS[archetype] ?? DART;
}
