/**
 * FIGURE-CAST — limb and segment PROPORTIONS as a dial, cast off the locked armature.
 *
 * The manji armature (figure-vajra.js) is locked: `FIGURE_NODES` fixes every bone's rest
 * length, `proto` only scales the flesh's girth about it, and `proto.height` is one uniform
 * scale over the finished body. So a long-limbed, a short-limbed, a wide-shouldered or a
 * mascot figure was unreachable by recipe.
 *
 * A CAST is the missing layer, and it is the move the substrate already makes by hand in
 * three places (the flesh extends the forearm 40 % past the posed wrist, drops the knee 15 %,
 * and `worldSlots` re-implements both to keep the rig matching): go back to the VAJRA level,
 * satisfy the proportions THERE, re-chain the distal nodes along their own directions, then
 * re-seat the figure on the ground. Everything below — flesh, balance IK, spine warp,
 * garments, rig, export — reads the re-cast base the way it already reads the canonical one.
 *
 * THE INVARIANT that makes this cheap: a length dial re-places a distal node ALONG ITS OWN
 * rest direction, and a span dial TRANSLATES a limb subtree. Neither changes a rest bone's
 * unit vector, so `figure-posing.js`'s module-level REST directions stay exactly valid and
 * every swivel/aim solve is untouched. (`figure-spine`'s SHOULDER_ANCHOR_U and
 * `figure-posing`'s LEG_LEN are ratios/lengths, not directions — those DO move with a cast
 * and take the base explicitly. Pinned in figure-cast.test.js.)
 *
 * Kinematics are NOT parametrized here. Joints, subtrees and LIMITS are the armature's; a
 * cast changes rest LENGTHS and girdle SPANS, nothing else.
 *
 * Purity: arithmetic over frozen constants. `castArmature({})` is deep-equal to
 * `basePositions()` EXACTLY (every unit dial is an early-out no-op, not a multiply by one),
 * which is what lets every existing byte pin hold.
 */
import { basePositions } from './figure-vajra.js';

// ─── Dials ────────────────────────────────────────────────────────────────
// `scale` dials are multipliers on the canonical rest length / half-span (1 = canonical,
// unbounded above); `deg` dials are angles ADDED to the canonical rest (0 = canonical).
const CAST_DIALS = Object.freeze({
  // limb segment lengths
  upperArm: { kind: 'scale', def: 1 },      // shoulder → elbow
  forearm: { kind: 'scale', def: 1 },       // elbow → wrist
  thigh: { kind: 'scale', def: 1 },         // hip → knee
  shank: { kind: 'scale', def: 1 },         // knee → ankle
  // trunk segment lengths
  lumbar: { kind: 'scale', def: 1 },        // pelvisHub → navel
  thoracic: { kind: 'scale', def: 1 },      // navel → neckHub (carries the girdle, arms, neck, head)
  neck: { kind: 'scale', def: 1 },          // neckHub → headBase
  skull: { kind: 'scale', def: 1 },         // headBase → headTop — the ARMATURE bone. For head SIZE
                                            //   reach for `proto.headScale` (the head FIELD).
  // girdle half-spans (translations, not lengths)
  shoulderSpan: { kind: 'scale', def: 1 },  // shoulder{L,R}.x about the midline; the arm rides along whole
  hipSpan: { kind: 'scale', def: 1 },       // hip{L,R}.x about the midline; the leg follows 45 %
  // girdle CARRIAGE — how the shoulders SIT, not how wide or how long they are.
  // The canonical armature puts neckHub and both shoulders at the same z (0.78), so the clavicle
  // line and the shoulder yoke run dead level out to the acromion — anatomically a permanent
  // shrug, and the reason a neutral figure reads stiff through the girdle. This declines that
  // line: + = the acromion drops (relaxed), − = it rides up (a real shrug, or armour).
  shoulderDrop: { kind: 'deg', def: 0, min: -20, max: 30 },
});
export const CAST_KEYS = Object.freeze(Object.keys(CAST_DIALS));
export const CAST_DEFAULT = Object.freeze(Object.fromEntries(CAST_KEYS.map((k) => [k, CAST_DIALS[k].def])));

// Convenience dials, expanded by `resolveCast` before anything else sees them and never
// stored. An explicit dial always wins over an aggregate that contains it.
const AGGREGATES = Object.freeze({
  arm: ['upperArm', 'forearm'],
  leg: ['thigh', 'shank'],
  limb: ['upperArm', 'forearm', 'thigh', 'shank'],
  torso: ['lumbar', 'thoracic'],
});
export const CAST_AGGREGATE_KEYS = Object.freeze(Object.keys(AGGREGATES));

// ─── The chain ────────────────────────────────────────────────────────────
// Proximal → distal, rooted at pelvisHub. `sub` is the subtree the distal node carries when
// its bone lengthens — the same containment the armature's rotation subtrees use.
const ARM_L = ['elbowL', 'wristL'], ARM_R = ['elbowR', 'wristR'];
const GIRDLE = ['shoulderL', 'shoulderR', ...ARM_L, ...ARM_R];
const SKULL_UP = ['headTop'];
const NECK_UP = ['headBase', ...SKULL_UP];
const ABOVE_NECKHUB = ['neckHub', ...NECK_UP, ...GIRDLE];
const ABOVE_NAVEL = ['navel', ...ABOVE_NECKHUB];

const CHAIN = Object.freeze([
  { dial: 'lumbar', a: 'pelvisHub', b: 'navel', sub: ABOVE_NAVEL },
  { dial: 'thoracic', a: 'navel', b: 'neckHub', sub: ABOVE_NECKHUB },
  { dial: 'neck', a: 'neckHub', b: 'headBase', sub: NECK_UP },
  { dial: 'skull', a: 'headBase', b: 'headTop', sub: SKULL_UP },
  { dial: 'upperArm', a: 'shoulderL', b: 'elbowL', sub: ARM_L },
  { dial: 'upperArm', a: 'shoulderR', b: 'elbowR', sub: ARM_R },
  { dial: 'forearm', a: 'elbowL', b: 'wristL', sub: ['wristL'] },
  { dial: 'forearm', a: 'elbowR', b: 'wristR', sub: ['wristR'] },
  { dial: 'thigh', a: 'hipL', b: 'kneeL', sub: ['kneeL', 'ankleL'] },
  { dial: 'thigh', a: 'hipR', b: 'kneeR', sub: ['kneeR', 'ankleR'] },
  { dial: 'shank', a: 'kneeL', b: 'ankleL', sub: ['ankleL'] },
  { dial: 'shank', a: 'kneeR', b: 'ankleR', sub: ['ankleR'] },
]);

// The leg follows its girdle only PARTWAY, so widening the pelvis angles the thighs inward
// instead of sliding two parallel legs outward. Same 0.45 `proportioned` (figure-proto.js)
// already uses for the dimorphic hip, so the two proportion layers agree.
const LEG_FOLLOW = 0.45;

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// The canonical floor — the rest ankle height every cast re-seats onto.
const GROUND_Z = basePositions().ankleL.z;

/**
 * Resolve a cast spec to a full dial set.
 *
 * @param {?(string|object|Array)} spec  a preset name, a dial object, or an array of either
 *   (merged left → right, so `['brute', { forearm: 1.3 }]` is the preset with one dial moved).
 * @returns {object} every CAST_KEYS dial, plus `from` when a preset named it.
 */
export function resolveCast(spec) {
  if (spec === undefined || spec === null) return { ...CAST_DEFAULT };
  const out = { ...CAST_DEFAULT };
  let from = null;
  for (const entry of (Array.isArray(spec) ? spec : [spec])) {
    if (entry === undefined || entry === null) continue;
    if (typeof entry === 'string') {
      const preset = CAST_PRESETS[entry];
      if (!preset) throw new Error(`figure-cast: unknown cast preset '${entry}' (have ${Object.keys(CAST_PRESETS).join(', ')})`);
      Object.assign(out, preset.dials);
      from = from ? `${from}+${entry}` : entry;
      continue;
    }
    if (typeof entry !== 'object') throw new Error('figure-cast: a cast entry must be a preset name or a dial object');
    const { from: entryFrom, ...dials } = entry;
    if (typeof entryFrom === 'string') from = from ? `${from}+${entryFrom}` : entryFrom;
    // aggregates first, so an explicit dial in the SAME object wins over the group it belongs to
    for (const [group, keys] of Object.entries(AGGREGATES)) {
      if (dials[group] === undefined) continue;
      for (const k of keys) out[k] = dials[group];
    }
    for (const k of CAST_KEYS) if (dials[k] !== undefined) out[k] = dials[k];
  }
  return from ? { ...out, from } : out;
}

/** Error strings for a cast spec (empty = valid). The MCP tool refuses on a non-empty list. */
export function validateCast(spec, label = 'cast') {
  if (spec === undefined || spec === null) return [];
  if (Array.isArray(spec)) return spec.flatMap((e, i) => validateCast(e, `${label}[${i}]`));
  if (typeof spec === 'string') {
    return CAST_PRESETS[spec] ? [] : [`${label}: unknown preset '${spec}' (have ${Object.keys(CAST_PRESETS).join(', ')})`];
  }
  if (typeof spec !== 'object') return [`${label}: must be a preset name, a dial object, or an array of either`];
  const known = new Set([...CAST_KEYS, ...CAST_AGGREGATE_KEYS, 'from']);
  const errs = [];
  for (const [k, v] of Object.entries(spec)) {
    if (!known.has(k)) { errs.push(`${label}.${k}: unknown dial (have ${[...CAST_KEYS, ...CAST_AGGREGATE_KEYS].join(', ')})`); continue; }
    if (k === 'from') { if (typeof v !== 'string') errs.push(`${label}.from: must be a string`); continue; }
    if (typeof v !== 'number' || !Number.isFinite(v)) { errs.push(`${label}.${k}: must be a finite number`); continue; }
    const spec = CAST_DIALS[k];
    if (!spec || spec.kind === 'scale') {
      // Deliberately unbounded above, like proto's region multipliers — taste is the operator's.
      // A dial that is not a positive finite number is not taste, it is a broken skeleton.
      if (v <= 0) errs.push(`${label}.${k}: must be a finite number > 0`);
    } else if (v < spec.min || v > spec.max) {
      // An ANGLE is bounded both ways: past these the girdle stops being a shoulder.
      errs.push(`${label}.${k}: must be a number in [${spec.min}, ${spec.max}] degrees`);
    }
  }
  return errs;
}

/**
 * Build the rest armature for a cast — the same 17 landmark keys `basePositions()` returns,
 * so every consumer that takes a base map eats it unchanged.
 *
 * Order: spans set each limb's DIRECTION, lengths set its MAGNITUDE along that direction,
 * then the whole figure is re-seated so the ankles return to the canonical ground (z 0.02).
 * Re-seating is what keeps `groundVault`'s ground baseline and the renderer's locked floor
 * true without either of them knowing a cast happened — a taller cast grows upward.
 *
 * @param {?(string|object|Array)} cast  anything `resolveCast` takes
 */
export function castArmature(cast = {}) {
  const C = resolveCast(cast);
  const m = basePositions();

  // ── spans: translate the girdle and carry its limb (the `proportioned` move, off a dial
  //    instead of off the sex pole). Directions of the ARM bones are preserved exactly (the
  //    whole chain shifts); the THIGH re-aims by design, because the leg follows only 45 %.
  if (C.shoulderSpan !== 1) {
    // The clavicle offset from the neck root is scaled AS A VECTOR, not just in x: the rest
    // girdle is declined (figure-vajra's CLAVICLE_DECLINE), so scaling x alone would flatten a
    // broad-shouldered figure's shoulder line back toward the old shrug. A span makes the
    // clavicle longer, not shallower — the angle is `shoulderDrop`'s business, not this dial's.
    const f = C.shoulderSpan - 1, N = m.neckHub;
    for (const s of ['L', 'R']) {
      const sh = m['shoulder' + s];
      const dx = (sh.x - N.x) * f, dz = (sh.z - N.z) * f;
      for (const k of ['shoulder' + s, 'elbow' + s, 'wrist' + s]) { m[k].x += dx; m[k].z += dz; }
    }
  }
  if (C.hipSpan !== 1) {
    for (const s of ['L', 'R']) {
      const d = m['hip' + s].x * (C.hipSpan - 1);
      m['hip' + s].x += d;
      for (const k of ['knee' + s, 'ankle' + s]) m[k].x += d * LEG_FOLLOW;
    }
  }

  // ── girdle carriage: decline the clavicle line so the acromion sits BELOW the neck root.
  //    The shoulder node rotates about neckHub in the frontal plane; the arm is TRANSLATED by
  //    the same displacement rather than rotated with it, so the humerus keeps its rest hang and
  //    every cached rest bone direction (figure-posing's REST) stays exactly valid. That is also
  //    what relaxing the trapezius actually does: the acromion drops, the arm comes along.
  if (C.shoulderDrop !== 0) {
    const th = C.shoulderDrop * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
    for (const s of ['L', 'R']) {
      const sh = m['shoulder' + s], N = m.neckHub;
      const dx = sh.x - N.x, dz = sh.z - N.z, sgn = dx < 0 ? -1 : 1;
      const nx = sgn * (Math.abs(dx) * ct + dz * st), nz = dz * ct - Math.abs(dx) * st;
      const d = { x: N.x + nx - sh.x, z: N.z + nz - sh.z };
      for (const k of ['shoulder' + s, 'elbow' + s, 'wrist' + s]) { m[k].x += d.x; m[k].z += d.z; }
    }
  }

  // ── lengths: proximal → distal, so each child is re-placed off a parent already final.
  for (const { dial, a, b, sub } of CHAIN) {
    const k = C[dial];
    if (k === 1) continue;                       // a unit dial is an exact no-op
    const A = m[a], B = m[b];
    if (dist3(A, B) < 1e-12) continue;           // a collapsed bone has no direction to grow along
    // (B − A) IS dir · len, so the displacement the distal subtree takes is just (B − A)·(k−1).
    const f = k - 1;
    const d = { x: (B.x - A.x) * f, y: (B.y - A.y) * f, z: (B.z - A.z) * f };
    for (const key of sub) { m[key].x += d.x; m[key].y += d.y; m[key].z += d.z; }
  }

  // ── re-seat: the ground is invariant, the figure grows upward off it.
  const ground = Math.min(m.ankleL.z, m.ankleR.z);
  const dz = GROUND_Z - ground;
  if (dz !== 0) for (const k of Object.keys(m)) m[k].z += dz;

  return m;
}

/** Rest leg length (thigh + shank) of a base map. The gait converts a ground stride to a hip angle with it. */
export function legLengthOf(base) {
  return dist3(base.hipL, base.kneeL) + dist3(base.kneeL, base.ankleL);
}
/** Rest arm length (upperArm + forearm) of a base map. */
export function armLengthOf(base) {
  return dist3(base.shoulderL, base.elbowL) + dist3(base.elbowL, base.wristL);
}

// ─── The t-shirt sizes ────────────────────────────────────────────────────
// A preset is nothing but a NAMED POINT in the dial space: `resolveCast` expands it and the
// mint stores the resolved numbers, so a stored recipe never changes meaning when a preset is
// later re-tuned, and the operator's next move — read the manifest, nudge one number — works.
//
// What earns a slot: a proportion archetype an operator would otherwise find by trial, that is
// reachable no other way. GIRTH archetypes do NOT earn one — `proto.stockiness` and the region
// multipliers already cover them, which is why several presets name a proto pairing instead of
// inventing a dial. Do not quote this list's length anywhere; it is the list that defines it.
export const CAST_PRESETS = Object.freeze({
  canonical: { note: 'identity — the hand-sculpted protoform', dials: {} },
  heroic: {
    note: 'comic proportions: longer legs, broad shoulders, narrow hips. Pair with proto.headScale ≈ 0.90 for the heads-tall read.',
    dials: { thigh: 1.10, shank: 1.10, upperArm: 1.05, forearm: 1.05, thoracic: 1.06, shoulderSpan: 1.14, hipSpan: 0.94 },
  },
  brute: {
    note: 'the heavy: ape index up, legs short, no neck. Pair with proto.stockiness ≈ 1.35 + chestWidth / tankVee / bicep for the mass.',
    dials: { shoulderSpan: 1.34, hipSpan: 1.06, thoracic: 1.10, lumbar: 0.92, neck: 0.70, upperArm: 1.12, forearm: 1.14, thigh: 0.88, shank: 0.86 },
  },
  lithe: {
    note: 'long-limbed and narrow. Pair with proto.stockiness ≈ 0.90.',
    dials: { thigh: 1.08, shank: 1.10, upperArm: 1.06, forearm: 1.08, shoulderSpan: 0.94 },
  },
  stout: {
    note: 'short strong limbs over a long trunk and a wide pelvis.',
    dials: { thigh: 0.82, shank: 0.80, upperArm: 0.88, forearm: 0.90, lumbar: 1.06, shoulderSpan: 1.06, hipSpan: 1.12 },
  },
  child: {
    note: 'shorter limbs against a full-size skull. Pair with proto.headScale ≈ 1.18 — that is the dominant cue, not these dials.',
    dials: { thigh: 0.78, shank: 0.76, upperArm: 0.84, forearm: 0.82, lumbar: 0.94, thoracic: 0.92, shoulderSpan: 0.88, hipSpan: 0.92 },
  },
  chibi: {
    note: 'the mascot: the skeleton compresses, the skull does not. Pair with proto.headScale ≥ 1.3.',
    dials: { lumbar: 0.5, thoracic: 0.5, neck: 0.6, upperArm: 0.55, forearm: 0.55, thigh: 0.5, shank: 0.5, shoulderSpan: 0.82, hipSpan: 0.82 },
  },
});
export const CAST_PRESET_NAMES = Object.freeze(Object.keys(CAST_PRESETS));
