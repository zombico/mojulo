/**
 * hero-foot — the BARE structured hero's foot: the foot itself (heel, ankle bones, instep, arch, ball), the big toe on
 * its own and the other four side by side, in place of the shoe (two boxes, ankle → toe base → toe tip).
 *
 * Footwear REPLACES the foot: a shod hero (no detail, clothed, a kit, armour) keeps the shoe, byte for byte, and the
 * shoes to come (sandal, tabi, boot) take the foot's place on the same joints. The bare foot never sits inside a shoe.
 *
 * The rig is unchanged: the foot bone (ankle → toe base) carries the foot, the toe bone (toe base → toe tip) every toe,
 * so a planted foot, the guard's raised heel and the walk read the joints they did. Lengths scale with the cast's
 * `extremities` (X), widths with X × girth; heights stay the shoe's (the ankle and the sole do not move).
 *
 * The foot's frame: F forward (the ankle → toe base line, level), U up, and a ring's R side toward cross(U, F) (the
 * family's winding: its front slot is the top, its R slots run toward the big toe on the right foot).
 */
import * as dmath from '../../util/dmath.js';
import { r6 } from './station-loft-plan.js';

const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => mul(v, 1 / dmath.hypot(...v));

const R = (p) => p.map(r6);
/** the foot per body (× X along, × X × girth across; heights in the plan's units, the shoe's sole and ankle).
 * `rings`: [u (along F from the ankle), sole, top, the outer and the inner half-widths, the arch's lift on the inner
 * side] from the heel's back to the ball; `ankle` the two ankle bones (the inner pushed out at the ankle ring, the outer
 * at the heel ring: lower and further back), `ball` the ball's slant (the inner side forward, the outer back);
 * `toes`: [the offset across (+ toward the big toe), the length past the knuckle, the half-width, the half-height] for
 * the big toe and the four, `knuckle` where they leave the ball (u), `root` how far back they start inside it, `slant`
 * how far back a toe's knuckle sits per metre toward the little toe (the toe line's angle: the tips on a diagonal from the
 * second toe to the little toe) and `splay` the degrees the outermost toe turns out (the others in proportion) */
export const FOOT_FORM = Object.freeze({
  male: Object.freeze({
    rings: [[-0.048, 0.012, 0.042, 0.02, 0.02, 0], [-0.03, 0, 0.058, 0.03, 0.029, 0], [-0.004, 0, 0.07, 0.036, 0.035, 0.004],
      [0.03, 0, 0.062, 0.038, 0.038, 0.012], [0.062, 0, 0.048, 0.041, 0.041, 0.008], [0.094, 0, 0.032, 0.043, 0.047, 0]],
    ankle: Object.freeze({ inner: 0.004, outer: 0.004 }), ball: Object.freeze({ inner: 0.006, outer: -0.008 }),
    toes: Object.freeze({ hallux: [0.03, 0.05, 0.0135, 0.0135], toe2: [0.0055, 0.047, 0.0083, 0.0098], toe3: [-0.0102, 0.042, 0.008, 0.0093], toe4: [-0.0252, 0.034, 0.0074, 0.0083], toe5: [-0.0378, 0.025, 0.0063, 0.0068] }),
    knuckle: 0.098, root: 0.016, slant: 0.3, splay: 6,
  }),
  female: Object.freeze({
    rings: [[-0.046, 0.012, 0.04, 0.018, 0.018, 0], [-0.029, 0, 0.055, 0.027, 0.026, 0], [-0.004, 0, 0.066, 0.033, 0.032, 0.005],
      [0.029, 0, 0.058, 0.035, 0.035, 0.013], [0.06, 0, 0.045, 0.038, 0.038, 0.008], [0.092, 0, 0.03, 0.04, 0.044, 0]],
    ankle: Object.freeze({ inner: 0.0035, outer: 0.0035 }), ball: Object.freeze({ inner: 0.006, outer: -0.008 }),
    toes: Object.freeze({ hallux: [0.028, 0.048, 0.0125, 0.0122], toe2: [0.005, 0.045, 0.0077, 0.009], toe3: [-0.0095, 0.04, 0.0074, 0.0085], toe4: [-0.0235, 0.032, 0.0068, 0.0076], toe5: [-0.0352, 0.023, 0.0058, 0.0062] }),
    knuckle: 0.096, root: 0.016, slant: 0.3, splay: 6,
  }),
});
export const TOES = Object.freeze(['hallux', 'toe2', 'toe3', 'toe4', 'toe5']);

const RING12 = ['front', 'frontR', 'frontSideR', 'sideR', 'backSideR', 'backR', 'back', 'backL', 'backSideL', 'sideL', 'frontSideL', 'frontL'];
const LIMB6 = ['front', 'frontR', 'backR', 'back', 'backL', 'frontL'];

/** heroFoot({ ankle, toeBase, X, girth, female }) → { segments, parts }: the foot and five toes (the right side,
 * mirrored by name) and the names of every part, for the dials */
export function heroFoot({ ankle, toeBase, X = 1, girth = 1, female = false }) {
  const G = FOOT_FORM[female ? 'female' : 'male'], gx = X * girth;
  const U = [0, 0, 1], F = unit([toeBase[0] - ankle[0], toeBase[1] - ankle[1], 0]), S = cross(U, F);   // S: a ring's R side (toward the big toe)
  const at = (u, s, z) => add(add([ankle[0], ankle[1], 0], mul(F, u)), add(mul(S, s), mul(U, z)));
  const pw = (t, e) => Math.sign(t) * dmath.pow(Math.abs(t), 2 / e);
  // a section of the foot: the top round (e 2.4), the sole flatter (e 3.2), its inner side lifted by the arch
  const section = (u, zb, zt, xo, xi, arch, push = {}) => {
    const zc = (zb + zt) / 2;
    return Object.fromEntries(RING12.map((sl, k) => { const t = 2 * Math.PI * k / RING12.length, ct = dmath.cos(t), st = dmath.sin(t);
      const v = ct >= 0 ? (zt - zc) * pw(ct, 2.4) : (zc - zb - arch * Math.max(0, st)) * pw(ct, 3.2), h = (st >= 0 ? xi : xo) * pw(st, 2.6);
      const p = at(u * X + (push.along?.(st) ?? 0), h * gx + (push.side?.[k] ?? 0), zc + v);
      return [sl, R(p)]; }));
  };
  const last = G.rings.length - 1, ankleRing = 2, heelRing = 1;
  const stations = G.rings.map(([u, zb, zt, xo, xi, arch], i) => {
    const push = {};
    // the ankle bones at the side points (k 3: the inner, k 9: the outer); the ball's slant along F
    if (i === ankleRing) push.side = { 3: G.ankle.inner * gx };
    if (i === heelRing) push.side = { 9: -G.ankle.outer * gx };
    if (i === last) push.along = (st) => (st >= 0 ? G.ball.inner * st : -G.ball.outer * st) * X;
    return { id: `st${i}`, points: section(u, zb, zt, xo, xi, arch, push) };
  });
  const [h0] = G.rings, [ub, , zt] = G.rings[last];
  const foot = { name: 'footR', kind: 'rings', slots: 'ring12', stations, caps: { back: R(at(h0[0] * X - 0.008 * X, 0, 0.026)), tip: R(at(ub * X + 0.012 * X, 0, zt * 0.45)) }, group: 'Skin', mirror: 'name',
    bind: { bone: 'footR', blend: { [`st${ankleRing}`]: { shankR: 0.3, footR: 0.7 }, [`st${last}`]: { footR: 0.6, toesR: 0.4 }, tip: { footR: 0.5, toesR: 0.5 } } } };

  // the toes: each from inside the ball to a round pad on the floor, the big toe apart (the grip), the four side by side
  const segments = [foot];
  for (const name of TOES) {
    const [s, len, hw, hh] = G.toes[name], L = len * X, w = hw * gx, k0 = (G.knuckle + G.slant * Math.min(0, s)) * X;
    const turn = (G.splay * Math.PI / 180) * Math.min(0, s) / G.toes.toe5[0], sx = (u) => s * gx - (u - k0) * dmath.sin(turn);   // a little toe turns out
    const ring = (u, z, f) => { const c = at(u, sx(u), z); return Object.fromEntries(LIMB6.map((sl, k) => { const t = 2 * Math.PI * k / LIMB6.length; return [sl, R(add(c, add(mul(U, hh * f * dmath.cos(t)), mul(S, w * f * dmath.sin(t)))))]; })); };
    const st = [ring(k0 - G.root * X, hh + 0.006, 1.05), ring(k0, hh + 0.004, 1), ring(k0 + 0.82 * L, hh * 0.9, 0.82)];   // a toe is short: root, knuckle, pad
    segments.push({ name: `${name}R`, kind: 'rings', slots: 'limb6', stations: st.map((points, i) => ({ id: `st${i}`, points })),
      caps: { back: R(at(k0 - (G.root + 0.006) * X, sx(k0 - (G.root + 0.006) * X), hh + 0.006)), tip: R(at(k0 + L, sx(k0 + L), hh * 0.85)) }, group: 'Skin', mirror: 'name',
      bind: { bone: 'toesR', blend: { back: { footR: 1 }, st0: { footR: 1 }, st1: { footR: 0.5, toesR: 0.5 } } } });
  }
  return { segments, parts: ['foot$S', ...TOES.map((t) => `${t}$S`)] };
}
