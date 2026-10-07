/**
 * platform — the platformer's classic: a deck you land on, standing still, shuttling, or running a rail.
 *
 * Called by its SURFACE AREA: `area` is the walkable deck top in square metres (`aspect`, width over depth, shapes it).
 * In a platformer the deck's area is the difficulty: a wide pad is a rest, a small one a test of the jump.
 *
 *   static   stands still
 *   shuttle  back and forth along `travel` ([dx, dy, dz] from where it starts)
 *   rail     along `rail` (points from where it starts), round if `loop`, else back and forth
 *
 * A platform answers for itself: its deck and collider at t, the space it sweeps on its way and the headroom a rider
 * needs over it all along (a level keeps both clear, so nothing crushes the rider), its ride surface, and how its
 * landing reads (rest, step, tight, too small) against the walker. It lowers to the world the platformer already
 * runs: a static deck is a floor face and a collider; a moving deck is a `mover` carrier the rider rides.
 */
import { obox } from '../../era/props.js';
import { r5, P } from '../../era/geom.js';
import { driveErrors } from './drive.js';

const Z = [0, 0, 1], X = [1, 0, 0], Y = [0, 1, 0];
const WALKER = { radius: 0.35, height: 1.8, landingError: 0.5 };   // the platform rule's rider, and how far a landing strays
const HEADROOM = WALKER.height + 0.3;

// what a deck's area reads as to a player, by the side a landing has to hit
export const LANDING = Object.freeze([
  { read: 'rest', from: 6 },     // stand, look around, line up the next jump
  { read: 'step', from: 2.25 },  // land and go
  { read: 'tight', from: 1.44 }, // a landing that asks for care: the walker's footprint and a landing's stray, no more
  { read: 'too small', from: 0 },
]);
export const landingRead = (area) => LANDING.find((l) => area >= l.from).read;

export const PLATFORM_VARIANTS = {
  static: { about: 'stands still', drive: null },
  shuttle: { about: 'back and forth along a travel', drive: { type: 'clock', period: 4, mode: 'pingpong' } },
  rail: { about: 'along a rail of points, round if it loops, else back and forth', drive: { type: 'clock', period: 8, mode: 'pingpong' } },
};
export const PLATFORM_VARIANT_IDS = Object.freeze(Object.keys(PLATFORM_VARIANTS));

/** The deck's numbers from an area budget: width and depth from `aspect`, the slab's thickness. */
export function platformParams({ area = 4, aspect = 1, thick = 0.5, at = [0, 0, 0], travel, rail, loop = false, drive } = {}, variant = 'static') {
  if (!(area > 0)) throw new Error('platform: area must be square metres above 0 (the walkable deck top)');
  if (!(aspect > 0)) throw new Error('platform: aspect must be width over depth, above 0');
  const w = Math.sqrt(area * aspect), d = Math.sqrt(area / aspect);
  const path = variant === 'shuttle' ? [[0, 0, 0], travel || [6, 0, 0]] : variant === 'rail' ? [[0, 0, 0], ...(rail || [[6, 0, 0], [6, 6, 2]])] : [[0, 0, 0]];
  if (variant === 'rail' && path.length < 2) throw new Error('platform: a rail needs at least one point after its start');
  const dv = drive || PLATFORM_VARIANTS[variant].drive;
  const D = dv && variant === 'rail' && loop && !drive ? { ...dv, mode: 'loop' } : dv;
  if (D) { const e = driveErrors(D, 'platform.drive'); if (e.length) throw new Error(e.join('; ')); }
  return { area: r5(area), aspect: r5(aspect), w: r5(w), d: r5(d), thick, at: P(at), path: path.map(P), loop: variant === 'rail' && !!loop, drive: D };
}

/** Where along its path the deck's top centre is at t (by distance, so it runs at one pace). */
export function deckAt(p, t) {
  const pts = p.loop ? [...p.path, p.path[0]] : p.path;
  if (pts.length === 1) return P(p.at);
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1], q[2] - pts[i][2]));
  let s = Math.min(1, Math.max(0, t)) * seg.reduce((a, b) => a + b, 0), i = 0;
  while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
  const f = seg[i] ? s / seg[i] : 0, a = pts[i], b = pts[i + 1];
  return P([0, 1, 2].map((k) => p.at[k] + a[k] + (b[k] - a[k]) * f));
}

export const platformCollider = (p, t) => { const c = deckAt(p, t); return { min: P([c[0] - p.w / 2, c[1] - p.d / 2, c[2] - p.thick]), max: P([c[0] + p.w / 2, c[1] + p.d / 2, c[2]]) }; };

/** The space the slab sweeps, and the headroom a rider needs over the deck all along: keep both clear. */
export function platformSweep(p, steps = 48) {
  const bs = Array.from({ length: steps + 1 }, (_, i) => platformCollider(p, i / steps));
  const min = P([0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k])))), max = P([0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k]))));
  return { slab: { min, max }, headroom: { min: P([min[0], min[1], min[2] + p.thick]), max: P([max[0], max[1], max[2] + HEADROOM]) } };
}

// ── skins: values only, on the obj:* groups, built at the deck's place at t ─────────────────────────────────────
const surf = (group, v) => ({ key: null, scale: 1, tint: [v, v, v], group });
function box(out, part, group, v, c, h) {
  const from = out.length;
  obox(out, c, X, Y, Z, h, surf(group, v), 8);
  for (let i = from; i < out.length; i++) Object.assign(out[i], { part, value: v });
}

export const PLATFORM_SKINS = {
  // the mechanism made visible: a slab, its top a band lighter than its sides; a moving deck's edge is the accent
  greybox: (out, p, c, moving) => {
    box(out, 'body', 'obj:body', 0.38, [c[0], c[1], c[2] - p.thick / 2], [p.w / 2, p.d / 2, p.thick / 2]);
    box(out, 'fill', 'obj:fill', 0.74, [c[0], c[1], c[2] + 0.005], [p.w / 2 - 0.02, p.d / 2 - 0.02, 0.005]);
    if (moving) box(out, 'handle', 'obj:status', 0.9, [c[0], c[1] - p.d / 2 - 0.02, c[2] - 0.08], [p.w / 2, 0.02, 0.05]);
  },
  // the floating island: a lighter deck with a lip, over a keel of rock narrowing below (the 33). Inverse interest
  // reads in the keel: a still island hangs one quiet point, a moving one a second tier, so it reads busier from afar
  island: (out, p, c, moving) => {
    const k = p.thick, W = p.w / 2 + 0.06, D = p.d / 2 + 0.06;   // the lip runs flush with the deck: it reads by value
    box(out, 'fill', 'obj:fill', 0.76, [c[0], c[1], c[2] - 0.04], [W, D, 0.04]);                                   // the deck top
    box(out, 'body', 'obj:body', 0.5, [c[0], c[1], c[2] - 0.08 - (k - 0.08) / 2], [W, D, (k - 0.08) / 2]);        // the lip and slab
    const tiers = moving ? [[0.72, 0.22], [0.42, 0.26]] : [[0.42, 0.34]];   // [scale of the deck, height in deck widths]
    let z = c[2] - k;
    for (const [s, h] of tiers) {
      const hh = (h * p.w) / 2, keel = s === 0.42;   // the narrowest tier is the point: the 33
      box(out, keel ? 'detail' : 'body', keel ? 'obj:detail' : 'obj:body', keel ? 0.18 : 0.34, [c[0], c[1], z - hh], [(p.w / 2) * s, (p.d / 2) * s, hh]);
      z -= 2 * hh;
    }
    if (moving) box(out, 'handle', 'obj:status', 0.9, [c[0], c[1] - p.d / 2 - 0.07, c[2] - 0.12], [p.w / 2 + 0.06, 0.012, 0.04]);
  },
};
export const PLATFORM_SKIN_IDS = Object.freeze(Object.keys(PLATFORM_SKINS));

export const PLATFORM = {
  id: 'platform',
  name: 'Platform',
  role: 'a deck to land on, still or moving',
  interest: (variant) => (variant === 'static' ? 'prop' : 'interactable'),
  variants: PLATFORM_VARIANTS,
  skins: PLATFORM_SKINS,
  when: 'a floating platform, a moving platform, a platform on a rail, a platformer jump, stepping stones, a floating island',

  resolve({ variant = 'static', skin = 'greybox', t = 0, params, ...spec } = {}) {
    if (!PLATFORM_VARIANTS[variant]) throw new Error(`playscape: a platform has no variant '${variant}' (variants: ${PLATFORM_VARIANT_IDS.join(', ')})`);
    if (!PLATFORM_SKINS[skin]) throw new Error(`playscape: a platform has no skin '${skin}' (skins: ${PLATFORM_SKIN_IDS.join(', ')})`);
    const p = params || platformParams(spec, variant), at = Math.min(1, Math.max(0, t)), c = deckAt(p, at), faces = [];
    PLATFORM_SKINS[skin](faces, p, c, variant !== 'static');
    return {
      entry: 'platform', variant, skin, t: at, params: p, interest: this.interest(variant),
      frame: { at: c, N: [0, -1, 0], U: [1, 0, 0] },   // judged from the front, like any object
      faces,
      deck: { top: c, half: [r5(p.w / 2), r5(p.d / 2)] },
      collider: [{ ...platformCollider(p, at), of: 'deck' }],
      sweep: platformSweep(p),
      landing: { area: p.area, read: landingRead(p.area) },
      world: this.lower(p, variant),
    };
  },

  /** The pieces the platformer world runs: a static deck is a floor face and a collider; a moving one a carrier. */
  lower(p, variant, id = 'platform') {
    if (variant === 'static') {
      const [x, y, z] = p.at, hw = p.w / 2, hd = p.d / 2;
      return { faces: [{ corners: [[x - hw, y - hd, z], [x + hw, y - hd, z], [x + hw, y + hd, z], [x - hw, y + hd, z]].map(P), fill: '#9aa0a8', group: 'floor' }], colliders: [platformCollider(p, 0)], entities: [] };
    }
    const path = p.path.map((q) => P([0, 1, 2].map((k) => p.at[k] + q[k] - p.thick / 2 * (k === 2 ? 1 : 0))));
    return {
      faces: [], colliders: [],
      entities: [{
        id,
        rule: { type: 'mover', path, ...(p.loop ? { loop: true } : {}), period: p.drive.period, ...(p.drive.phase ? { phase: p.drive.phase } : {}), ...(p.drive.mode === 'loop' ? { mode: 'loop' } : {}) },
        body: { type: 'mesh', shape: 'box', size: [p.w, p.d, p.thick], color: '#9aa0a8', marker: false, carrier: true, carryHalf: [r5(p.w / 2), r5(p.d / 2)], deck: r5(p.thick / 2) },
        transform: { pos: [...path[0]] },
      }],
    };
  },
};
