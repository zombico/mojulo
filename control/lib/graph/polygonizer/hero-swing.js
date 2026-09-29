// hero-swing — a swing as a hero clip: `gesture: 'chop' | 'thrust' | 'rising' | 'cleave' | 'bash' | 'plant'` stands in
// the swing's ready key and adds a looping clip of that name. Keys are the gesture's own pose words, evenly spaced and
// smoothstep-eased by the rig's clip player, so the phases are counted in keys:
//   ready → (load) → coil → COCK → STRIKE → follow → recover → (ready)
// with the strike one segment (the fastest: the largest arc in one key), never a key inside it. Seven keys put the cock
// at 2/7 ≈ .29 and the impact at 3/7 ≈ .43 — the mecha shelf's windup : strike : follow : recover of 28 : 14 : 14 : 44.
//
// Law 8, the swing follows the mass: the item's class sets the key count and the arc. A light item (a dagger, or a
// short one) drops the coil and strikes at 2/6 ≈ .33 with a smaller cock; a heavy one (a greatsword, a mass ≥ 1.2, or an
// item past three quarters of the figure's height) adds a LOAD key (a held cock, the body sinking and coiling deeper), so it
// cracks at 4/8 = .5 (the mecha's heavy cleave, +.06). The body drives: the shoulders and the spine coil toward the
// weapon at the cock and uncoil through the strike, the trunk hinges over, the knees sink; both feet stay planted.
//
// The hand has no roll: a blade held tip-down at rest (hero-gear.js) is carried by the arm's arc, so the verbs keep to
// arcs that read (a chop, a thrust, a rising diagonal); a flat sweep would drift the edge. Signs probed on the rig:
// shR/shL pitch + raises the arm forward (90 level, 150 overhead); shR yaw + carries the right arm inward across the
// body (shL mirrored); shoulders + brings the right shoulder forward; spine twist 'right' takes the right shoulder back.
// Pure data: no dice, no clock.

export const SWING_WORDS = Object.freeze(['chop', 'thrust', 'rising', 'cleave', 'bash', 'plant']);
export const isSwing = (g) => typeof g === 'string' && SWING_WORDS.includes(g);
/** the hand each verb swings with (its gear slot) */
export const SWING_HAND = Object.freeze({ chop: 'right', thrust: 'right', rising: 'right', cleave: 'right', bash: 'left', plant: 'right' });

const READY = { support: 'both', crouch: 0.1, shR: { yaw: 4, pitch: 40, roll: 0 }, elbowR: 40, shL: { yaw: -6, pitch: 20, roll: 0 }, elbowL: 50, shoulders: 0, head: { pitch: -6 } };
const pose = (o) => ({ ...READY, ...o });
/** each verb's keys at the NORMAL class: [ready, coil, cock, strike, follow, recover]; the clip loops back to ready */
const VERBS = {
  // THE ELBOW STAYS LOW (the operator's sketches; a searched set on the rig). At the cock the upper arm is level and
  // forward, the forearm folded up behind the hand, rolled 120° (the mecha's hammer-grip roll) so the blade points BACK
  // over the head while the elbow points forward at shoulder height, never over the head. On the DOWNSWING the upper arm
  // unrolls (the forearm turning as a real one does), so through the strike and the follow the elbow points to the
  // ground (below the shoulder–wrist line), the blade forward at the target
  chop: {
    coil: { shR: { yaw: -40, pitch: 75, roll: 30 }, elbowR: 100, shoulders: -14, spine: { twist: ['right', 0.2] } },
    cock: { crouch: 0.12, shR: { yaw: 0, pitch: 105, roll: 120 }, elbowR: 110, shoulders: -24, spine: { twist: ['right', 0.35], arch: 0.1 }, head: { pitch: -2 } },
    strike: { crouch: 0.2, shR: { yaw: 20, pitch: 50, roll: 30 }, elbowR: 20, shoulders: 20, spine: { twist: ['left', 0.25], curl: 0.1 }, hinge: 8, head: { pitch: 8 } },
    follow: { crouch: 0.24, shR: { yaw: 20, pitch: 35, roll: 0 }, elbowR: 20, shoulders: 26, spine: { twist: ['left', 0.35], curl: 0.2 }, hinge: 14, head: { pitch: 12 } },
    recover: { crouch: 0.15, shR: { yaw: 0, pitch: 55, roll: 30 }, elbowR: 20, shoulders: 10, spine: { twist: ['left', 0.1] }, hinge: 6 },
  },
  // the fist drawn back to the waist, the blade level, then driven out along the centreline, the arm near straight with
  // its elbow turned to the ground (below the shoulder–wrist line), the roll barely moving so the blade does not turn
  thrust: {
    coil: { shR: { yaw: 0, pitch: 25, roll: 40 }, elbowR: 60, shoulders: -16, spine: { twist: ['right', 0.2] } },
    cock: { crouch: 0.12, shR: { yaw: 0, pitch: 15, roll: 60 }, elbowR: 80, shoulders: -26, spine: { twist: ['right', 0.35] } },
    strike: { crouch: 0.22, shR: { yaw: 20, pitch: 60, roll: 30 }, elbowR: 15, shoulders: 24, spine: { twist: ['left', 0.3] }, hinge: 10 },
    follow: { crouch: 0.25, shR: { yaw: 20, pitch: 70, roll: 30 }, elbowR: 10, shoulders: 30, spine: { twist: ['left', 0.35] }, hinge: 14 },
    recover: { crouch: 0.15, shR: { yaw: 8, pitch: 65, roll: 20 }, elbowR: 30, shoulders: 10, hinge: 6 },
  },
  rising: {
    coil: { shR: { yaw: 20, pitch: 20, roll: 0 }, elbowR: 40, shoulders: 10, spine: { twist: ['left', 0.15] } },
    cock: { crouch: 0.16, shR: { yaw: 36, pitch: 12, roll: 0 }, elbowR: 30, shoulders: 22, spine: { twist: ['left', 0.3] }, hinge: 10 },
    strike: { crouch: 0.12, shR: { yaw: -20, pitch: 96, roll: 0 }, elbowR: 16, shoulders: -18, spine: { twist: ['right', 0.25], arch: 0.1 } },
    follow: { crouch: 0.1, shR: { yaw: -34, pitch: 98, roll: 0 }, elbowR: 30, shoulders: -24, spine: { twist: ['right', 0.35], arch: 0.15 }, head: { pitch: -2 } },
    recover: { crouch: 0.1, shR: { yaw: -10, pitch: 70, roll: 0 }, elbowR: 32, shoulders: -8 },
  },
  // two hands: the off hand tracks the sword hand's pitch and yaws hard inboard, so the fists meet on the centreline
  // the sword hand keeps the chop's low-elbow cock; the off hand comes up under it as far as its own low elbow lets it
  // (within about 18 cm at the cock, 5 cm at the strike: a support near the grip, the mecha's rule over a straining reach)
  cleave: {
    coil: { shR: { yaw: -40, pitch: 75, roll: 30 }, elbowR: 100, shL: { yaw: -75, pitch: 45, roll: 0 }, elbowL: 60, shoulders: -8, spine: { arch: 0.1 } },
    cock: { crouch: 0.14, shR: { yaw: -20, pitch: 105, roll: 120 }, elbowR: 110, shL: { yaw: -60, pitch: 75, roll: 90 }, elbowL: 70, shoulders: -10, spine: { arch: 0.16 }, head: { pitch: -4 } },
    strike: { crouch: 0.26, shR: { yaw: 20, pitch: 65, roll: -60 }, elbowR: 20, shL: { yaw: -30, pitch: 60, roll: 30 }, elbowL: 35, shoulders: 6, spine: { curl: 0.22 }, hinge: 16, head: { pitch: 10 } },
    follow: { crouch: 0.3, shR: { yaw: 20, pitch: 40, roll: -60 }, elbowR: 50, shL: { yaw: -15, pitch: 40, roll: 30 }, elbowL: 50, shoulders: 8, spine: { curl: 0.3 }, hinge: 20, head: { pitch: 14 } },
    recover: { crouch: 0.18, shR: { yaw: 6, pitch: 55, roll: 30 }, elbowR: 25, shL: { yaw: -30, pitch: 40, roll: 0 }, elbowL: 40, hinge: 8 },
  },
  // the shield arm punches forward; the body turns the left shoulder into it (shoulders −)
  bash: {
    coil: { shL: { yaw: 0, pitch: 40, roll: 0 }, elbowL: 90, shoulders: 12, spine: { twist: ['left', 0.2] } },
    cock: { crouch: 0.14, shL: { yaw: 6, pitch: 36, roll: 0 }, elbowL: 110, shoulders: 22, spine: { twist: ['left', 0.35] } },
    strike: { crouch: 0.22, shL: { yaw: -6, pitch: 80, roll: 0 }, elbowL: 20, shoulders: -24, spine: { twist: ['right', 0.3] }, hinge: 10 },
    follow: { crouch: 0.24, shL: { yaw: -8, pitch: 84, roll: 0 }, elbowL: 12, shoulders: -28, spine: { twist: ['right', 0.35] }, hinge: 12 },
    recover: { crouch: 0.15, shL: { yaw: -4, pitch: 50, roll: 0 }, elbowL: 50, shoulders: -8 },
  },
  // the staff lifted and driven down to the floor before the feet
  plant: {
    coil: { shR: { yaw: 6, pitch: 60, roll: 0 }, elbowR: 60, spine: { arch: 0.08 } },
    cock: { crouch: 0.05, shR: { yaw: 8, pitch: 78, roll: 0 }, elbowR: 70, spine: { arch: 0.14 }, head: { pitch: -4 } },
    strike: { crouch: 0.26, shR: { yaw: 6, pitch: 30, roll: 0 }, elbowR: 30, spine: { curl: 0.16 }, hinge: 10, head: { pitch: 8 } },
    follow: { crouch: 0.28, shR: { yaw: 6, pitch: 26, roll: 0 }, elbowR: 32, spine: { curl: 0.2 }, hinge: 12, head: { pitch: 10 } },
    recover: { crouch: 0.15, shR: { yaw: 6, pitch: 34, roll: 0 }, elbowR: 40, hinge: 4 },
  },
};

const scaleArm = (k, s) => ({ ...k, ...(k.shR ? { shR: { ...k.shR, pitch: Math.round(READY.shR.pitch + (k.shR.pitch - READY.shR.pitch) * s) } } : {}), ...(k.shL ? { shL: { ...k.shL, pitch: Math.round(READY.shL.pitch + (k.shL.pitch - READY.shL.pitch) * s) } } : {}) });
/** The class a held item swings as (law 8): light, normal or heavy, from its type, its mass dial and its length. */
export function swingClass({ item, mass = 1, share = 0.5 }) {
  if (item === 'greatsword' || mass >= 1.2 || share >= 0.75) return 'heavy';
  if (item === 'dagger' || share < 0.3) return 'light';
  return 'normal';
}
/**
 * A verb's keyposes for a class, and where its phases fall: `strike` the impact's phase, `window` the contact window
 * (from the end of the cock to the end of the follow-through: a game's hit test reads it; the clip never does).
 */
export function swingKeys(word, cls = 'normal') {
  const V = VERBS[word];
  let keys;
  if (cls === 'light') keys = [READY, scaleArm(pose(V.cock), 0.75), pose(V.strike), pose(V.follow), pose(V.recover)];
  else if (cls === 'heavy') {
    // the load: a held, deeper cock carried by the legs and the coil (a deeper sink, more twist), the arm and the arch where
    // the cock put them, so the elbow stays at the shoulder line (more arch lifts the shoulder girdle and the elbow with it)
    const cock = pose(V.cock); const load = { ...cock, crouch: Math.min(0.3, (cock.crouch ?? 0) + 0.08), ...(cock.spine?.twist ? { spine: { ...cock.spine, twist: [cock.spine.twist[0], Math.min(0.45, cock.spine.twist[1] + 0.1)] } } : {}) };
    keys = [READY, pose(V.coil), cock, load, pose(V.strike), pose(V.follow), pose(V.recover)];
  } else keys = [READY, pose(V.coil), pose(V.cock), pose(V.strike), pose(V.follow), pose(V.recover)];
  const n = keys.length + 1;   // the loop's wrap back to ready is the last segment
  return { keys, cls, strike: +((keys.length - 3) / n).toFixed(3), window: [+((keys.length - 4) / n).toFixed(3), +((keys.length - 2) / n).toFixed(3)] };
}

/**
 * The swing a hero record plays, or null: its gesture word, the hand's gear, the item's class (law 8: its type, its mass
 * dial, its length against the canonical figure) and the keys. The stand is the swing's ready key.
 */
export function heroSwing(hero, { expand, gearBuild, height = 167.4 }) {
  const word = hero?.gesture; if (!isSwing(word)) return null;
  const hand = SWING_HAND[word]; const spec = hero.gear?.[hand]; if (!spec) return null;
  const b = gearBuild(spec, hero); const e = expand(b);
  const cls = swingClass({ item: b.item, mass: e.trace.dials?.mass ?? 1, share: e.trace.length / height });
  return { word, hand, item: b.item, ...swingKeys(word, cls) };
}
