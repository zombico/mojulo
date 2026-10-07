/**
 * door — the first playscape entry: something that closes an opening and opens when used.
 *
 * WHAT IT DOES is the variant, a row of the mechanism (mechanism.js): a joint, how many leaves, how far they travel.
 * WHAT IT LOOKS LIKE is the skin, drawn on each leaf in the leaf's own closed place and carried by the joint. The two
 * never mix: a new look is a skin, a new way of opening is a variant.
 *
 *   single           one leaf on a hinge at the left jamb, a quarter turn to the front
 *   double           two leaves hinged at both jambs, meeting in the middle
 *   sliding-single   one leaf running left into the wall
 *   sliding-double   two leaves parting into the wall either side
 *   portcullis       one grate rising into the wall above
 *
 * Fitted to an opening ({ width, height }, or a doorway anchor), at any t from 0 (closed) to 1 (open). The door
 * answers for itself: its collider at t, the space its leaves sweep (a level keeps it clear), what a walker can get
 * through, where the player stands to use it, and the rules that open it.
 */
import { P, r5 } from '../../era/geom.js';
import { obox } from '../../era/props.js';
import { compose, deed } from '../../worlds/game-idioms.js';
import { poseLeaf, leafTransform, toWorld } from './mechanism.js';

const Z = [0, 0, 1];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const QUARTER = Math.PI / 2;
const GAP = 0.004;   // between two leaves meeting in the middle

// one leaf: its closed box across the opening, its thickness, its joint; `hinge` names its hinged edge for a skin
const leaf = (id, span, H, thick, joint, hinge = null) => ({ id, span, rise: [0, H], thick, joint, hinge });

export const DOOR_VARIANTS = {
  single: {
    about: 'one leaf on a hinge at the left jamb, a quarter turn to the front',
    leaves: (W, H, t) => [leaf('leaf', [-W / 2, W / 2], H, t, { type: 'hinge', pivot: -W / 2, toward: 1, angle: QUARTER }, 'left')],
  },
  double: {
    about: 'two leaves hinged at both jambs, meeting in the middle',
    leaves: (W, H, t) => [
      leaf('left', [-W / 2, -GAP], H, t, { type: 'hinge', pivot: -W / 2, toward: 1, angle: QUARTER }, 'left'),
      leaf('right', [GAP, W / 2], H, t, { type: 'hinge', pivot: W / 2, toward: 1, angle: QUARTER }, 'right'),
    ],
  },
  'sliding-single': {
    about: 'one leaf running left into the wall',
    leaves: (W, H, t) => [leaf('leaf', [-W / 2, W / 2], H, t, { type: 'slide', dir: -1, travel: W })],
  },
  'sliding-double': {
    about: 'two leaves parting into the wall either side',
    leaves: (W, H, t) => [
      leaf('left', [-W / 2, -GAP], H, t, { type: 'slide', dir: -1, travel: W / 2 }),
      leaf('right', [GAP, W / 2], H, t, { type: 'slide', dir: 1, travel: W / 2 }),
    ],
  },
  portcullis: {
    about: 'one grate rising into the wall above',
    leaves: (W, H, t) => [leaf('grate', [-W / 2, W / 2], H, t, { type: 'lift', travel: H })],
    control: 'beside',   // raised from a lever or winch beside the opening, not by a handle on the grate
  },
};
export const DOOR_VARIANT_IDS = Object.freeze(Object.keys(DOOR_VARIANTS));

// ── skins: what a leaf looks like, built on the closed leaf in values only (objects/laws.js) ─────────────────────
const surf = (group, v) => ({ key: null, scale: 1, tint: [v, v, v], group });
function box(out, name, group, v, [u, n, z], [hu, hn, hz]) {
  const from = out.length;
  obox(out, [u, n, z], [0, 1, 0], [1, 0, 0], Z, [hn, hu, hz], surf(group, v), 8);
  for (let i = from; i < out.length; i++) Object.assign(out[i], { part: name, value: v });
}
// the latch edge (where a handle goes): away from the hinge; a sliding leaf's is the edge that stays in the opening
const latchU = (L) => (L.hinge === 'left' ? L.span[1] : L.hinge === 'right' ? L.span[0] : L.joint.dir === -1 ? L.span[1] : L.joint.dir === 1 ? L.span[0] : null);

export const DOOR_SKINS = {
  // the mechanism made visible: each leaf a plain slab, a handle on both faces at its latch edge (the accent)
  greybox: (out, L) => {
    const [u0, u1] = L.span, w = u1 - u0, h = L.rise[1] - L.rise[0], t = L.thick;
    box(out, 'body', 'obj:body', 0.5, [(u0 + u1) / 2, 0, h / 2], [w / 2, t / 2, h / 2]);
    const lu = latchU(L);
    if (lu !== null) for (const s of [1, -1]) box(out, 'handle', 'obj:status', 0.85, [lu - Math.sign(lu - (u0 + u1) / 2) * 0.1, s * (t / 2 + 0.03), 1.0], [0.02, 0.03, 0.12]);
  },
  // iron-bound planks: boards grooved in the fill, straps from the hinged edge (their pintle ends past it), a lock
  // plate at the latch (the 33) and its ring (the handle); a grate is bars and rails instead
  plank: (out, L) => {
    const [u0, u1] = L.span, w = u1 - u0, h = L.rise[1] - L.rise[0], t = L.thick, mid = (u0 + u1) / 2;
    if (L.joint.type === 'lift') {   // a grate: bars down to points, rails across
      const bars = Math.max(4, Math.round(w / 0.2));
      for (let i = 0; i <= bars; i++) box(out, 'body', 'obj:body', 0.3, [u0 + (w * i) / bars, 0, h / 2 - 0.06], [0.025, t / 2, h / 2 + 0.06]);
      for (const zf of [0.2, 0.5, 0.8]) box(out, 'fill', 'obj:fill', 0.2, [mid, 0, zf * h], [w / 2, t / 2 + 0.01, 0.03]);
      box(out, 'detail', 'obj:detail', 0.12, [mid, 0, 0.9 * h], [w * 0.17, t / 2 + 0.02, h * 0.1]);
      return;
    }
    box(out, 'body', 'obj:body', 0.42, [mid, 0, h / 2], [w / 2, t / 2, h / 2]);
    const boards = Math.max(2, Math.round(w / 0.2));
    for (let i = 1; i < boards; i++) for (const s of [1, -1]) box(out, 'fill', 'obj:fill', 0.28, [u0 + (w * i) / boards, s * (t / 2 + 0.004), h / 2], [0.012, 0.004, h / 2 - 0.02]);
    const hingeU = L.hinge === 'left' ? u0 : L.hinge === 'right' ? u1 : null, past = hingeU === null ? 0 : 0.12;
    for (const zf of [0.2, 0.8]) {
      const a = hingeU === null ? u0 + 0.04 : hingeU === u0 ? u0 - past : u0 + w * 0.18, b = hingeU === null ? u1 - 0.04 : hingeU === u0 ? u1 - w * 0.18 : u1 + past;
      box(out, 'fill', 'obj:fill', 0.2, [(a + b) / 2, t / 2 + 0.012, zf * h], [(b - a) / 2, 0.012, 0.04]);
    }
    const lu = latchU(L);
    if (lu === null) return;
    const inward = Math.sign(mid - lu), pw = Math.min(0.42, 0.3 * w), pu = lu + inward * (0.08 + pw / 2), pz = 0.47 * h;
    box(out, 'detail', 'obj:detail', 0.14, [pu, t / 2 + 0.02, pz], [pw / 2, 0.02, 0.16 * h]);
    const rr = Math.min(0.11, 0.06 * w + 0.04), rz = pz - 0.16 * h - rr, bar = 0.018;
    for (const [du, dz, hu, hz] of [[0, rr, rr, bar], [0, -rr, rr, bar], [-rr, 0, bar, rr], [rr, 0, bar, rr]]) box(out, 'handle', 'obj:status', 0.62, [pu + du, t / 2 + 0.05, rz + dz], [hu, bar, hz]);
  },
};
export const DOOR_SKIN_IDS = Object.freeze(Object.keys(DOOR_SKINS));

// ── the entry ────────────────────────────────────────────────────────────────────────────────────────────────────
export const DOOR = {
  id: 'door',
  name: 'Door',
  role: 'closes an opening and opens when used',
  interest: 'interactable',
  states: { closed: 0, open: 1, locked: 0 },
  // what moves its t: the rule var a use sets (rules below), at `speed` t per second
  drive: (id = 'door') => ({ type: 'rule', var: `${id}-open`, speed: 0.8 }),
  variants: DOOR_VARIANTS,
  skins: DOOR_SKINS,
  when: 'a door, a double door, a sliding door, a gate, a portcullis, a locked door, a door that opens',

  params: ({ width, height }, variant) => ({ width: r5(width), height: r5(height), thick: variant === 'portcullis' ? 0.1 : 0.08 }),
  leaves: (variant, p) => DOOR_VARIANTS[variant].leaves(p.width, p.height, p.thick),

  /** Where the player stands to use it, in the opening's frame: in front of and behind each handle, or by the control. */
  usePoints(variant, p) {
    const V = DOOR_VARIANTS[variant];
    if (V.control === 'beside') return [{ at: P([p.width / 2 + 0.6, 0.8, 0]), side: 1, use: 'control' }];
    const L = this.leaves(variant, p)[0], lu = latchU(L);
    return [1, -1].map((s) => ({ at: P([lu - Math.sign(lu) * 0.3, s * 0.75, 0]), side: s, use: 'handle' }));
  },

  // the rules, from the shelf's idioms: a use sets `<id>-open`; locked (`unlock`: the event that frees it, a key's
  // pickup), the opening waits for that event, then for a use: a sequence, since a reaction carries no guard
  rules(id, { unlock } = {}) {
    const use = `use-${id}`, open = { do: 'set', var: `${id}-open`, to: 1 };
    if (!unlock) return compose({ vars: { [`${id}-open`]: 0 } }, deed({ on: 'pick', emit: use, effects: [{ on: use, ...open }] }));
    return compose({ vars: { [`${id}-open`]: 0 } }, deed({ on: 'pick', emit: use }), {
      sequences: [{ id: `unlock-${id}`, scope: id, trigger: { on: unlock }, steps: [{ await: { on: use } }, open] }],
    });
  },

  // where it stands: a doorway anchor's sill, normal and opening
  frame(anchor) {
    const l = Math.hypot(anchor.N[0], anchor.N[1], anchor.N[2]) || 1, N = anchor.N.map((x) => x / l);
    return { at: anchor.at, N, U: cross(Z, N), fit: { width: anchor.width, height: anchor.height } };
  },

  /** The faces of every leaf, skinned, posed at t, in the world. */
  build(variant, p, skin, t, frame) {
    const W = toWorld(frame), out = [];
    for (const L of this.leaves(variant, p)) {
      const mine = [];
      DOOR_SKINS[skin](mine, L);
      const move = leafTransform(L, t), { yaw } = poseLeaf(L, t), ca = Math.cos(yaw), sa = Math.sin(yaw);
      for (const f of mine) {
        const n = [f.normal[0] * ca - f.normal[1] * sa, f.normal[0] * sa + f.normal[1] * ca, f.normal[2]];
        const nw = [0, 1, 2].map((k) => r5(frame.U[k] * n[0] + frame.N[k] * n[1] + (k === 2 ? n[2] : 0)));
        out.push({ ...f, corners: f.corners.map((c) => W(move(c))), normal: nw, outNormal: nw, leaf: L.id });
      }
    }
    return out;
  },
};

