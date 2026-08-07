/**
 * figure-animal-face — eye / ear / nose DECORATORS hung off the proto-skull.
 *
 * The skull (figure-animal-skull.js) gives a head axis: `anchor` (back of cranium) →
 * `dir` (muzzle), sized by length / width / muzzleDrop / dome / snout. This places the
 * face features as small attached primitives over those landmarks — two EYE balls on
 * the brow, two EAR paddles on the crown, and a NOSE ball (or flat sticker) at the
 * snout tip. All are ring-stacks `{polylines, stroke}` in STAND space, so the renderer
 * lights / culls / depth-sorts them in with the skull and body — no special-casing.
 *
 * Placement knobs are fractions of the skull's own length (L) / width (W), so one
 * preset rides every family's head at the right scale. buildAnimal wires it in via the
 * `face` opt and (when furred) tints the ears to the coat colour.
 */
import { normalize3, sub3, cross3 } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const vlen = (a) => Math.hypot(a.x, a.y, a.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export const FACE_DEFAULT = {
  // skull frame (defaults; buildAnimal passes the real skull cfg in)
  length: 0.18, width: 0.07, muzzleDrop: 0.14, dome: 1.0, snout: 0.44,
  // eyes — balls on the upper sides of the brow/stop, SUNK into the skull a little
  eyeS: 0.6, eyeSide: 0.92, eyeUp: 0.5, eyeR: 0.3, eyeSink: 0.6, eyeHex: '#17120d',
  eyePatchHex: null, eyePatchR: 0.6, eyePatchAspect: 1.5,   // domino-mask diamond (off by default)
  // ears — solid shells SEATED on the cranium, leaning up-and-out, curving to wrap
  earS: 0.26, earSide: 0.72, earUp: 1.0, earLen: 0.95, earW: 0.62, earThick: 0.4,
  earSplay: 0.55, earTip: 0.5, earSeat: 0.85, earCurve: 0.5, earHex: '#6b4a2f',
  // nose — a ball (or flat sticker) at the snout tip
  noseR: 0.5, noseFwd: 0.02, noseSticker: false, noseHex: '#17120d',
  N: 7, M: 10,
};

// ─── The MAMMALIAN face (read off a bear / big-cat / canid) ──────────────
// Small eyes set CLOSE together (predator-ish, forward) on a broad face, a big
// prominent nose ball, and rounded ears carried wide out on the sides. This is the
// shared mammal primitive — the rodent…ursine line all ride it; reptile/avian faces
// (slit eyes, no pinna, beak) will get their own preset.
export const MAMMAL_FACE = {
  eyeS: 0.6, eyeSide: 0.5, eyeUp: 0.42, eyeR: 0.15,         // small + close
  earS: 0.24, earSide: 0.88, earUp: 0.82, earLen: 0.58, earW: 0.72, earThick: 0.4,
  earSplay: 0.7, earTip: 0.78,                              // short, round, wide
  noseR: 0.6,                                               // bold muzzle nose
};

// Raccoon: the mammal face with bigger, taller, more POINTED ears and slightly larger,
// wider eyes (room for the black bandit mask the build variant paints on).
export const RACCOON_FACE = {
  ...MAMMAL_FACE,
  eyeR: 0.2, eyeSide: 0.6,
  earLen: 0.95, earW: 0.62, earUp: 1.0, earSide: 0.82, earTip: 0.42,
};

// Per-archetype face presets (cf. SKULL_PRESETS). The mammals share MAMMAL_FACE.
export const FACE_PRESETS = {
  rodent: MAMMAL_FACE, canine: MAMMAL_FACE, feline: MAMMAL_FACE, stumpy: MAMMAL_FACE,
  equine: MAMMAL_FACE, gazelle: MAMMAL_FACE, ursine: MAMMAL_FACE, raccoon: RACCOON_FACE,
};

// Head frame: side (lateral) + up, from the muzzle direction (matches the skull's).
function frameFrom(dir) {
  let up = { x: 0, y: 0, z: 1 }, side = cross3(up, dir);
  if (vlen(side) < 1e-6) { up = { x: 1, y: 0, z: 0 }; side = cross3(up, dir); }
  side = normalize3(side);
  return { side, up: normalize3(cross3(dir, side)) };
}

// A sphere ring-stack about `center` (world-z stacked — symmetric, so orientation is
// irrelevant). `squash` flattens it along world-z toward a sticker disc.
function ball(center, r, hex, c, squash = 1) {
  const rings = [];
  for (let i = 0; i < c.N; i++) {
    const v = -Math.PI / 2 + Math.PI * (i / (c.N - 1)), z = r * squash * Math.sin(v), rr = r * Math.cos(v), poly = [];
    for (let j = 0; j <= c.M; j++) {
      const a = (j / c.M) * Math.PI * 2;
      poly.push({ x: center.x + rr * Math.cos(a), y: center.y + rr * Math.sin(a), z: center.z + z });
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: hex };
}

// A flat disc facing `dir` (sticker) — a thin stack of rings along `dir`.
function sticker(center, dir, r, hex, c) {
  const { side, up } = frameFrom(normalize3(dir)), rings = [];
  for (let i = 0; i < c.N; i++) {
    const t = i / (c.N - 1), rr = r * Math.sin(Math.PI * t), off = r * 0.18 * (t - 0.5);
    const ctr = add(center, mul(dir, off)), poly = [];
    for (let j = 0; j <= c.M; j++) {
      const a = (j / c.M) * Math.PI * 2;
      poly.push(add(ctr, add(mul(side, rr * Math.cos(a)), mul(up, rr * Math.sin(a)))));
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: hex };
}

// A flat elongated DIAMOND decal facing `normal` — a 4-point (rhombus) sticker, `rw`
// wide × `rh` tall, slightly domed onto the surface. The black eye patch → domino mask.
function eyePatch(center, normal, rw, rh, hex, c) {
  const { side, up } = frameFrom(normalize3(normal)), rings = [];
  for (let i = 0; i < c.N; i++) {
    const t = i / (c.N - 1), s = Math.sin(Math.PI * t), off = 0.16 * Math.min(rw, rh) * (t - 0.5);
    const ctr = add(center, mul(normal, off)), poly = [];
    for (let j = 0; j <= 4; j++) {
      const a = (j / 4) * Math.PI * 2;
      poly.push(add(ctr, add(mul(side, rw * s * Math.cos(a)), mul(up, rh * s * Math.sin(a)))));
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: hex };
}

// A solid ear SHELL SEATED on the skull and curving to WRAP it: a tapered, closed
// cross-section (wide `wAx` = the pinna's broad face, thin `tAx` = front-to-back) swept
// up an ARCING centerline (`curveDir`·t² leans the tip back/in over the cranium). Base
// broad where it meets the skull, tapering to the tip by `tipFrac` (round ear ↑, pointed
// ↓). Closed cross-section → reads bold from any angle (not an edge-on sliver).
function earShell(seat, riseDir, wAx, tAx, curveDir, len, baseW, baseT, tipFrac, curve, hex, c) {
  const rings = [];
  for (let i = 0; i < c.N; i++) {
    const t = i / (c.N - 1);
    const p = t < 0.2 ? 0.6 + 0.4 * (t / 0.2) : 1 - (1 - tipFrac) * ((t - 0.2) / 0.8);   // broad base → tip
    const hw = baseW * p, ht = baseT * p;
    const ctr = add(add(seat, mul(riseDir, len * t)), mul(curveDir, curve * len * t * t));
    const poly = [];
    for (let j = 0; j <= c.M; j++) {
      const ang = (j / c.M) * Math.PI * 2;
      poly.push(add(ctr, add(mul(wAx, hw * Math.cos(ang)), mul(tAx, ht * Math.sin(ang)))));
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: hex };
}

/**
 * Build the face decorators for a head at `anchor` pointing along `dir`.
 * @param {{x,y,z}} anchor   back-of-skull (the skull's own anchor)
 * @param {{x,y,z}} dirIn    muzzle direction (the skull's own dir)
 * @param {object}  [cfg]    FACE_DEFAULT + the skull's length/width/muzzleDrop/dome/snout
 * @returns {{polylines, stroke}[]}
 */
export function faceDecor(anchor, dirIn, cfg = {}) {
  const c = { ...FACE_DEFAULT, ...cfg };
  const dir = normalize3(dirIn), { side, up } = frameFrom(dir);
  const L = c.length, W = c.width;
  const along = (s) => add(anchor, mul(dir, s * L));
  const parts = [];

  // eyes — SUNK into the skull (set in a socket, not bulging) + an optional black
  // DIAMOND patch around each (the raccoon's domino mask), painted on the surface.
  for (const sgn of [-1, 1]) {
    const radial = normalize3(add(mul(side, sgn * c.eyeSide), mul(up, c.eyeUp)));   // outward at the eye
    const surf = add(add(along(c.eyeS), mul(side, sgn * c.eyeSide * W)), mul(up, c.eyeUp * W));
    if (c.eyePatchHex) {
      const rw = c.eyePatchR * W;
      parts.push(eyePatch(add(surf, mul(radial, -0.04 * W)), radial, rw, rw / c.eyePatchAspect, c.eyePatchHex, c));
    }
    parts.push(ball(add(surf, mul(radial, -c.eyeSink * c.eyeR * W)), c.eyeR * W, c.eyeHex, c));
  }

  // BANDIT-MASK BRIDGE — link the two eye diamonds across the nose bridge so the dark
  // reads as ONE continuous band (the raccoon mask), not two floating patches. A wide,
  // short diamond on the midline, seated on the bridge (slightly below the eye line) and
  // facing dorsally-forward. Off unless `eyePatchHex` + `eyePatchBridge` are set.
  if (c.eyePatchHex && c.eyePatchBridge) {
    const radial = normalize3(add(up, mul(dir, 0.25)));                       // up + a touch forward (the bridge normal)
    const ctr = add(add(along(c.eyeS - 0.02), mul(up, c.eyeUp * W * 0.82)), mul(radial, -0.02 * W));
    const bw = c.eyeSide * W * (c.eyePatchBridge === true ? 1.05 : c.eyePatchBridge);
    parts.push(eyePatch(ctr, radial, bw, c.eyePatchR * W * 0.42, c.eyePatchHex, c));
  }

  // nose — a ball (or sticker) at the dropped snout tip
  const noseTip = add(add(along(1 + c.noseFwd), mul(up, -c.muzzleDrop * L)), { x: 0, y: 0, z: 0 });
  const noseR = c.noseR * W * Math.max(c.snout, 0.4);
  parts.push(c.noseSticker ? sticker(noseTip, dir, noseR, c.noseHex, c) : ball(noseTip, noseR, c.noseHex, c, 0.85));

  // ears — a solid SHELL per side, SEATED on the cranium surface (so it attaches / wraps
  // rather than floating) and curving back-and-in over the skull. The broad face is
  // lateral+up (faces forward); thin front-to-back. Size is a fraction of the skull
  // width W, so each family's ears are proportional to its head.
  for (const sgn of [-1, 1]) {
    const seatDir = normalize3(add(mul(side, sgn * c.earSide), mul(up, c.earUp * c.dome)));   // outward to the seat
    const seat = add(along(c.earS), mul(seatDir, c.earSeat * W));                             // on the cranium surface
    const riseDir = normalize3(add(up, mul(side, sgn * c.earSplay)));                         // up + out
    const lat = mul(side, sgn);                                                               // outward lateral
    let wAx = sub3(lat, mul(riseDir, dot(lat, riseDir)));                                     // broad face (⟂ rise)
    wAx = vlen(wAx) > 1e-6 ? normalize3(wAx) : normalize3(cross3(riseDir, dir));
    const tAx = normalize3(cross3(riseDir, wAx));                                             // thin, front-to-back
    const curveDir = normalize3(add(mul(dir, -0.7), mul(seatDir, -0.5)));                     // lean back + in → wrap
    parts.push(earShell(seat, riseDir, wAx, tAx, curveDir, c.earLen * W, c.earW * W, c.earThick * c.earW * W, c.earTip, c.earCurve, c.earHex, c));
  }
  return parts;
}
