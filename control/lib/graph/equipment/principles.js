// equipment/principles — the laws an equipment build obeys, as arithmetic over four dials.
//
// An item is authored by INTENT (what it is, what it is known for) and DIRECTION (how real or stylized, how heavy,
// which shape language). These laws turn those few words into every dimension, so an item nobody has drawn before
// comes out with the same discipline as the samples:
//
//   1. HIERARCHY. One focal element per item (the signature: a stone, the blade, the head). Everything else is sized
//      against it, never absolutely.
//      1b. On a FACE-item (a shield) the eye reads the focal against the whole face, not a local host: a stone that is
//      three times its boss is still a speck on a shield, so the face's diameter sets its share.
//   2. STYLIZATION IS A PROPORTION LAW, not a filter. `stylize` 0 → 1 moves every dimension along one curve: the focal
//      grows fastest, the hilt grows (hand-scale readability at a game camera), a blade widens and shortens a little,
//      a curve exaggerates, a long item compresses, and detail gets FEWER and BIGGER (wrap pitch, notch count).
//   3. THE HOST FRAMES THE FOCAL. The part that carries a stone re-forms as its setting (a flush bezel when realistic;
//      a boss, a cage or a claw when stylized) and it TOUCHES the stone. Neighbouring forms point at it.
//   4. READABILITY FLOOR. No feature is thinner than `minFeature(stylize)` × the item's length.
//   5. CONTRAST SPENDS ON THE FOCAL. Fittings recede toward neutral as stylization rises; the stone takes the glow.
//   6. THE FOCAL SITS WHERE THE EYE ALREADY GOES: the ends of a long item (a staff head), the hand (a bow's riser), the
//      centre of a face (a shield's boss). Leading lines (rays, bands, vines, feathers) run from the frame into it.
//   7. ORGANIC FORMS GROW. A branching head obeys the pipe model (a parent's cross-section shared among its children,
//      r² = Σ rᵢ², as vegetation/grow.js), so twigs taper by construction and never look glued on.
//
//   LAWS 2 (the hilt and the end, equipment/compose.js): an item is a HILT (what the hand holds: a sword's pommel,
//   grip and guard, or a haft) carrying an END (what does the work: a blade or a head), and the two are sized by:
//   8. THE GRIP IS COUNTED IN HANDS. A one-hand grip is a hand's width and a little (11.5 cm), a hand-and-half's two
//      fingers more than a hand (19), a two-hand grip two hands apart (30); a pole is taken at two bands.
//   9. THE GUARD IS SIZED BY THE BLADE IT STOPS. Its span is a multiple of the blade's base width (2.6 on a dagger, 4.2
//      on a one-hand sword, 5.4 on a two-hand), never more than a share of the blade's length (0.42), wider as it
//      stylizes; a guard's rise (a crescent's horns, a wing's sweep) is bounded by its span.
//   10. THE POMMEL BALANCES THE BLADE. Its radius from the blade's mass (∝ the cube root of its volume), never under
//      the grip's own, never past twice it (more as it stylizes): a ring pommel is a ring the hand can hold behind.
//   11. A HEAD IS SIZED BY ITS HAFT. A polearm's head is a share of its haft (a spear's point 0.16, a halberd 0.26, an
//      axe's blade 0.2 of an arm's haft), so a head reads at the haft's own camera; a blade on a haft (a glaive, a
//      naginata) the same way. A grip band and a collar sit ON the shaft, wherever a grown shaft wanders.
//
// Pure arithmetic; no dice. LAWS_VERSION is stamped on every minted build: a change to any curve here that moves an
// item's bytes is a new version, and the expander keeps the old one for rows minted under it (laws 1: the item names'
// own chains, equipment/sword.js and items.js, byte for byte).

import * as dmath from '../../util/dmath.js';

export const LAWS_VERSION = 2;
export const LAWS_VERSIONS = Object.freeze([1, 2]);

export const DIALS = Object.freeze({
  stylize: 'realism 0 → stylized 1: one proportion curve for the whole item',
  mass: 'heft: 0.8 slender … 1 … 1.35 heavy',
  focus: "the signature: 'guard' | 'pommel' | 'blade' (swords), 'head' (staff), 'riser' | 'tips' | 'curve' (bow), 'boss' (shield), or 'none'",
  ornament: '0–3: how many secondary accents the item is allowed',
});

export const lerp = (a, b, t) => a + (b - a) * t;

/** Law 2 (and 4): every dimension multiplier as a function of stylize and mass. */
export function proportion({ stylize: s = 0, mass = 1 } = {}) {
  return {
    bladeW: mass * lerp(1, 1.6, s),
    bladeT: mass ** 0.8 * lerp(1, 1.35, s),
    bladeL: lerp(1, 0.9, s),
    hilt: lerp(1, 1.5, s),            // guard span and height, grip girth, pommel
    gripL: lerp(1, 1.1, s),
    pitch: lerp(1, 2.6, s),           // wrap pitch: fewer, fatter turns
    notches: lerp(1, 0.6, s),         // count multiplier for barbs, rays, twigs
    minFeature: lerp(0.002, 0.009, s), // × the item's length
    curve: lerp(1, 1.9, s),           // a silhouette that IS a curve (a bow) exaggerates it
    length: lerp(1, 0.88, s),         // long items compress so the focal end reads at the same camera
    rim: lerp(1, 2.2, s),             // a face-item's frame thickens with its focal
    relief: lerp(1, 2.2, s),          // device relief: leading lines must survive the camera too
    twist: lerp(0.9, 1.7, s),         // organic heads curl more as they stylize
    barkTile: lerp(8, 13, s),         // a bark tile in stem radii: crack spacing ∝ thickness (law 7), coarser when stylized
  };
}

/**
 * Laws 1, 1b and 3: the focal stone's size from the host it sits in (≤ 0.85 of it when realistic, ~3× when stylized),
 * or from the face it sits on (6 % → 34 % of its diameter), and the setting that frames it.
 */
export function focalStone({ stylize: s = 0, host = 1, face = null }) {
  const size = face ? face * lerp(0.06, 0.34, s ** 0.9) : host * lerp(0.85, 3.2, s ** 0.9);
  return {
    size,                                    // longest extent (the crystal's `size`)
    r: size / 2,
    setting: s < 0.25 ? 'flush' : 'boss',    // flush: a bezel in the host; boss: the host grows a medallion
    bossR: (size / 2) * lerp(1.15, 1.35, s),
    bezel: (size / 2) * lerp(0.1, 0.16, s),  // the lip's tube radius; it touches the girdle
    glowBoost: lerp(0, 0.35, s),
  };
}

/** A non-stone focal (a mace head, a ringed loop, a spiked boss) grows by this factor. */
export const focalGrow = (s) => lerp(1, 2.1, s ** 0.9);

/**
 * Law 5: a painted fitting's colour steps toward neutral as stylization rises, so the focal carries the contrast. A metal
 * surface keeps its colour (it is the metal's optics); its role passes through.
 */
/**
 * Law 4 on a pattern-welded role: a pattern with no `scale` is sized to its blade (length L, cm) as the forge spike's
 * 20 cm blade was sized to read, and bolder as stylization rises. An explicit scale, or no pattern, passes through.
 */
export function patternRole(role, L, s) {
  if (!role || Array.isArray(role) || !role.pattern || role.pattern.scale != null) return role;
  const scale = Math.round(Math.min(20, Math.max(0.25, (L / 20) * lerp(1, 1.6, s))) * 100) / 100;
  return { ...role, pattern: { ...role.pattern, scale } };
}
export function recedeRole(role, s) { return Array.isArray(role) ? [role[0], recede(role[1], s)] : role; }
export function recede(hex, s, toward = '#9a9a9a') {
  const t = 0.35 * s;
  const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), b = [1, 3, 5].map((i) => parseInt(toward.slice(i, i + 2), 16));
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- laws 2 (the hilt and the end)

/** Law 8: the grip's length by the hands it takes (cm, realistic). */
export const GRIP_HANDS = Object.freeze({ dagger: 9.5, 'one-hand': 11.5, 'hand-and-half': 19, 'two-hand': 30 });

/** Law 9: a guard's span (cm) from the blade's base width and length, its class's multiple, the stylize dial. */
export function guardSpanOf({ W, L, k, stylize: s = 0 }) {
  return Math.min(W * k * lerp(1, 1.35, s), L * lerp(0.42, 0.5, s));
}
/** Law 9: the share of its span a guard may rise (a crescent's horns, a wing's sweep). */
export const GUARD_RISE = 0.34;

/** Law 10: the pommel's radius (cm) from the blade's volume, bounded by the grip's radius. */
export function pommelOf({ L, W, T, gripR, stylize: s = 0 }) {
  const r = 0.5 * dmath.cbrt(Math.max(1, L * W * T * 0.6)) * lerp(1, 1.25, s);
  return Math.min(gripR * lerp(1.9, 2.3, s), Math.max(gripR * 1.15, r));
}

/** Law 11: a head's share of its haft (the end's length over the haft's), by the head. */
export const HEAD_SHARE = Object.freeze({ spear: 0.16, halberd: 0.26, axe: 0.2, blade: 0.24 });
