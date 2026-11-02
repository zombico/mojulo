/**
 * hero-ball-grip — A BALL IN THE HAND: the manual manipulator's hand (hero-digits.js: the palm a box, each digit closed
 * until it touches) on a sphere of the ball's own radius (contest/ball-card.js BALLS), laid where the grip lays it and
 * closed by the grip's roles. Everything is in the hand's REST frame, so a grip is solved once and carried by whatever
 * the arm does (a throw, hero-throw.js).
 *
 *   THE GRIPS (BALL_GRIPS), each a place for the ball against the palm (`at`: along the palm from the wrist, across it
 *   toward the thumb, a share of the palm's length and breadth; `gap` the ball off the palm's front, metres) and its
 *   digits' roles:
 *     power      the ball sunk in the palm and wrapped (a softball's, a tennis ball's, a cricket ball's: a ball the hand
 *                closes round)
 *     fingertip  the ball on the pads of the index and the middle, the thumb under it, the ring and the little at its
 *                side, the palm clear (a pitcher's four-seam grip)
 *     spread     the fingers spread across a big ball, its weight on the pads and the finger roots, the palm a finger's
 *                width off it (a basketball's one-hand shot, a handball's, a quarterback's)
 *     cradle     the ball on the open palm, the fingers curled onto it, the thumb at its side (a volleyball's toss, an
 *                underhand roll's)
 *     pinch      a small ball between the thumb's, the index's and the middle's pads (a golf ball, a table-tennis ball)
 *     bowling    the thumb and the two middle fingers sunk in the ball's holes, the index and the little spread on its
 *                skin (the conventional grip)
 *   gripFor(ball) picks the grip a ball is held by when the throw names none (its size, and the ball's own sport).
 *
 *   ballGrip(R, S, ball, grip) → { grip, ball, r, centre (the ball's centre in the rig's rest frame: it rides the hand's
 *     bone), fingers (the rig's fingers<S> value), digits ({ <digit>: { gap (m, its nearest phalanx off the skin, − in),
 *     touching } }), contact (the digits on the ball), laws }. The laws: every digit the grip names touches (within 3 mm)
 *     and none is pressed in past 3 mm (a hole's digits, which go in by design, aside).
 * Pure and deterministic.
 */
import { handBox, closeOn, reachDigit, straightOf, setOf, digitGeometry, primDistance, primSurface, grasp, FINGERS, DIGITS } from './hero-digits.js';
import { BALLS } from '../contest/ball-card.js';
import { HAND_POSES } from './station-loft-rig.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const TOUCH = 0.003, PRESS = -0.003;

/** the grips: the ball's place (`at`: along, across shares; `gap`: m off the palm), the digits that hold it (`hold`),
 * each finger's spread (degrees from the middle, as the rig reads it), the thumb's start (its root's second axis), and
 * what the grip is (`says`) */
export const BALL_GRIPS = Object.freeze({
  power: { says: 'the ball sunk in the palm and wrapped (the little round a small one as it can)', at: [0.62, 0.05], gap: 0, hold: ['thumb', 'index', 'middle', 'ring'], spread: { index: 4, middle: 0, ring: 4, little: 8 }, thumb: 25 },
  fingertip: { says: 'the ball on the index\'s and the middle\'s pads, the thumb under it, the palm clear', at: [1.02, 0.06], gap: 0.016, hold: ['thumb', 'index', 'middle', 'ring'], spread: { index: 5, middle: 2, ring: 8, little: 14 }, thumb: 45 },
  spread: { says: 'the fingers spread across a big ball, the palm a finger off it', at: [0.72, 0.04], gap: 0.01, hold: DIGITS, spread: { index: 14, middle: 0, ring: 12, little: 24 }, thumb: 5 },
  cradle: { says: 'the ball on the open palm, the fingers curled onto it, the thumb open at its side', at: [0.6, 0], gap: 0, hold: ['index', 'middle', 'ring', 'little'], spread: { index: 8, middle: 0, ring: 8, little: 16 }, thumb: -30, thumbAcross: -45 },
  pinch: { says: 'a small ball between the thumb\'s, the index\'s and the middle\'s pads', pinch: true, hold: ['thumb', 'index', 'middle'] },
  bowling: { says: 'the thumb and the two middle fingers in the holes, the index and the little on the skin', at: [0.85, -0.05], gap: -0.012, hold: ['index', 'little'], holes: { thumb: { across: 55, toPalm: 35, mcp: 0, ip: 0 }, middle: { mcp: 25, pip: 25, dip: 5, spread: 0 }, ring: { mcp: 25, pip: 25, dip: 5, spread: 4 } }, spread: { index: 16, little: 22 } },
});
export const BALL_GRIP_NAMES = Object.freeze(Object.keys(BALL_GRIPS));

/** balls a hand throws that no contest plays yet (the sports' pages inline the ball card: these stay off it until a sport
 * needs them): a softball (WBSC 12-inch: 178 to 198 g, 30.2 to 30.8 cm round) and a handball (IHF size 3: 425 to 475 g,
 * 58 to 60 cm round) */
export const HAND_BALLS = Object.freeze({
  softball: { mass: 0.188, radius: 0.0485, restitution: 0.455, words: 'a softball' },
  handball: { mass: 0.45, radius: 0.094, restitution: 0.65, words: 'a handball' },
});
const ALL_BALLS = { ...BALLS, ...HAND_BALLS };
/** a ball: a ball-card id (contest/ball-card.js BALLS), a HAND_BALLS id, or { radius, mass? } */
export function ballOf(ball) {
  if (typeof ball === 'string') { const b = ALL_BALLS[ball]; if (!b) throw new Error(`hero-ball-grip: no ball '${ball}' (have ${Object.keys(ALL_BALLS).join(', ')})`); return { id: ball, ...b }; }
  if (!ball || !(ball.radius > 0)) throw new Error('hero-ball-grip: a ball is a ball-card id or { radius (m), mass? (kg) }');
  return { id: 'own', mass: 0.2, ...ball };
}
/** the grip a ball is held by when none is named: a bowling ball by its holes, a baseball at the fingertips, then by size */
export function gripFor(ball) {
  const b = ballOf(ball);
  if (b.id === 'bowling') return 'bowling';
  if (b.id === 'baseball') return 'fingertip';
  if (b.radius < 0.026) return 'pinch';
  if (b.radius < 0.065) return 'power';
  return 'spread';
}

/**
 * A ball gripped by a rig's hand S (see the head). `grip` a BALL_GRIPS name (else gripFor's).
 */
export function ballGrip(R, S, ball, grip = null, { female = !!R.joints.bustRootR } = {}) {
  const b = ballOf(ball), name = grip ?? gripFor(b), G = BALL_GRIPS[name];
  if (!G) throw new Error(`hero-ball-grip: no grip '${name}' (have ${BALL_GRIP_NAMES.join(', ')})`);
  if (!R.hands?.[S]) return { grip: name, ball: b.id, r: b.radius, centre: null, fingers: { ...HAND_POSES.grip }, digits: {}, contact: [], laws: { held: false }, mitten: true };
  const box = handBox(R, S, { female }), r = b.radius;
  let centre; const out = {};
  if (G.pinch) {
    // the ball before the thumb's and the index's pads, the middle beside the index (hero-digits' tripod: the pinch's
    // axis searched, the pads meeting on the ball's opposite sides), the ring and the little curled out of the way
    centre = box.at(1.22 * box.palmLen, 0.45 * box.breadth, 0.03 + r);
    const sph = { kind: 'sphere', c: centre, r }, T = grasp(R, box, 'tripod', sph), ball = [[centre, centre, r]];
    for (const d of DIGITS) out[d] = { value: T.fingers[d] };
    // (each pad then settled on the skin where it met it, its phalanges kept out of the ball: a pinch holds, never pierces)
    for (const d of G.hold) { const pad = digitGeometry(R, box, d, T.fingers[d]).pad.at; out[d] = reachDigit(R, box, d, { at: primSurface(sph, pad).at, contact: 'pad', avoid: ball }); }
    return finish(R, box, name, b, centre, sph, out, G);
  }
  // the ball against the palm where the grip lays it; then each digit closed onto it from straight (spread as the grip
  // says), the thumb from across the palm
  centre = box.at(G.at[0] * box.palmLen, G.at[1] * box.breadth, box.front + G.gap + r);
  const sph = { kind: 'sphere', c: centre, r };
  for (const d of FINGERS) {
    if (G.holes?.[d]) { out[d] = { value: setOf(R, box, d, G.holes[d]), hole: true }; continue; }
    const s0 = straightOf(R, box, d);
    out[d] = closeOn(R, box, d, sph, { start: { ...s0, spread: (G.spread?.[d] ?? 0) * (d === 'index' ? -1 : d === 'middle' ? 0 : 1) } });
  }
  if (G.holes?.thumb) out.thumb = { value: setOf(R, box, 'thumb', G.holes.thumb), hole: true };
  else if (name === 'fingertip') {
    // the thumb's pad on the ball's skin under it, opposite the two fingers on top, its phalanges kept out of the ball
    const side = primSurface(sph, box.at(G.at[0] * box.palmLen, 0.7 * box.breadth, box.front + G.gap + r * 0.2)).at;
    out.thumb = reachDigit(R, box, 'thumb', { at: side, contact: 'pad', avoid: [[centre, centre, r]] });
  } else if (name === 'cradle') {
    // the thumb open beside a ball on the palm: of its root's turns, the one that lies nearest the skin without pressing in
    let best = null;
    for (const a of [-40, -20, 0, 20]) for (const t of [-40, -20, 0]) {
      const v = { cmc: [a, t], mcp: 0, ip: 0 }, g = gapOf(R, box, 'thumb', v, sph);
      const score = g < PRESS ? 1 - g : Math.abs(g - 0.002);
      if (!best || score < best.score) best = { score, value: v };
    }
    out.thumb = { value: best.value };
  } else out.thumb = closeOn(R, box, 'thumb', sph, { start: { cmc: [G.thumbAcross ?? -20, G.thumb ?? 25], mcp: 0, ip: 0 } });
  return finish(R, box, name, b, centre, sph, out, G);
}
/** the palm's box as a primitive's fields (the folded ring and little of a pinch close onto it) */
// (unused by the tripod, kept for a pinch's folded fingers if a grip names them)
const palmLike = (box) => { const u0 = 0.05 * box.palmLen, u1 = 0.9 * box.palmLen; return { c: box.at((u0 + u1) / 2, 0, 0), axes: [box.A, box.V, box.N], half: [(u1 - u0) / 2, box.breadth * 0.55, box.front] }; };

/** a digit's nearest phalanx off a primitive's skin (m, − pressed in); its first phalanx is joined to the palm at its root,
 * so only its free length can press (as hero-digits reads it) */
function gapOf(R, box, d, v, prim) {
  return Math.min(...digitGeometry(R, box, d, v).capsules.map(([a, c, rr], j) => { let m = Infinity; for (let i = 0; i <= 8; i++) { const t = (j ? 0 : 0.4) + ((j ? 1 : 0.6) * i) / 8; m = Math.min(m, primDistance(prim, [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t])); } return m - rr; }));
}
/** a digit pressed into the ball opened back along its own joints (toward straight) until it rests on the skin */
function settle(R, box, d, v, prim) {
  if (gapOf(R, box, d, v, prim) >= -0.001) return v;
  const open = d === 'thumb' ? { cmc: [(v.cmc?.[0] ?? 0) - 35, (v.cmc?.[1] ?? 0) - 25], mcp: 0, ip: 0 } : { ...straightOf(R, box, d), spread: v.spread ?? 0 };
  const mix = (t) => (d === 'thumb' ? { cmc: [0, 1].map((i) => (v.cmc?.[i] ?? 0) + ((open.cmc[i]) - (v.cmc?.[i] ?? 0)) * t), mcp: (v.mcp ?? 0) * (1 - t), ip: (v.ip ?? 0) * (1 - t) }
    : Object.fromEntries(['spread', 'mcp', 'pip', 'dip'].filter((k) => v[k] !== undefined || open[k] !== undefined).map((k) => [k, (v[k] ?? 0) + ((open[k] ?? 0) - (v[k] ?? 0)) * t])));
  let lo = 0, hi = 1;
  if (gapOf(R, box, d, mix(1), prim) < -0.001) return mix(1);
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (gapOf(R, box, d, mix(m), prim) >= -0.001) hi = m; else lo = m; }
  return mix(hi);
}
function finish(R, box, name, b, centre, sph, out, G) {
  const digits = {};
  // (nothing is held by pressing into it: a digit the solve left in the ball is opened back onto its skin)
  for (const d of DIGITS) if (!out[d].hole) out[d] = { ...out[d], value: settle(R, box, d, out[d].value, sph) };
  for (const d of DIGITS) {
    const gap = gapOf(R, box, d, out[d].value, sph);
    digits[d] = { gap: r4(gap), touching: gap <= TOUCH, ...(out[d].hole ? { hole: true } : {}) };
  }
  const contact = DIGITS.filter((d) => digits[d].touching);
  const laws = { held: G.hold.every((d) => digits[d].touching), clear: DIGITS.every((d) => digits[d].hole || digits[d].gap >= PRESS) };
  return { grip: name, ball: b.id, r: b.radius, centre: centre.map(r4), fingers: Object.fromEntries(DIGITS.map((d) => [d, out[d].value])), digits, contact, laws };
}

/**
 * The hand OPEN in the wider hand's own form (every digit an object, as a grip's digits are): the fingers straight and
 * together, the thumb turned out from the palm. A clip that opens a gripping hand keys this, never the `open` word: a
 * clip's channels are its keys' numbers, and a digit that is a number in one key and an object in another loses its
 * joints between them. A mitten's hand (no digits) takes the word.
 */
export function openFingers(R, S, { female = !!R.joints.bustRootR } = {}) {
  if (!R.hands?.[S]) return { ...HAND_POSES.open };
  const box = handBox(R, S, { female });
  return Object.fromEntries(DIGITS.map((d) => [d, d === 'thumb' ? { cmc: [-20, 0], mcp: 0, ip: 0 } : { ...straightOf(R, box, d), spread: 0 }]));
}
