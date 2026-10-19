/**
 * schemes.js — how a robot and a vehicle become one body: one row per way of transforming. A new way is a row.
 *
 *   <scheme>: {
 *     words,                       // what it is, for the vocabulary
 *     form,                        // the vehicle form's kind: 'ground' (drives) | 'air' (flies)
 *     ratio,                       // the robot's height over the vehicle's length (a car-bot stands about as tall as
 *                                  // its car is long)
 *     stow: {                      // the vehicle form, as a pose of the robot's skeleton (hidden in the shell)
 *       root: [{ axis, deg, at }], // turns of the whole body about its pelvis, applied in order (the first innermost),
 *                                  // each eased over its window `at` [t0, t1] of the sequence robot → vehicle
 *       local: { <bone>: [rx, ry, rz] },   // joint folds (degrees, in the parent's frame)
 *       z,                         // where the stowed skeleton's middle sits, as a share of the vehicle's height
 *       y?,                        // and along it, a share of its length (− toward the tail)
 *       hover?,                    // a vehicle form of the robot alone: how far above the ground it rides (a share of
 *                                  // the robot's height: a hover jetski)
 *     },
 *     windows: { <group>: [t0, t1] },   // when each joint group folds and the panels close (robot → vehicle); the
 *                                  // reverse plays it back
 *     hop,                         // the leap in the middle of the sequence, a share of the robot's height
 *     regions: [REGION],           // the shell's panels: a triangle of a cut part (a whole part by its middle) joins
 *                                  // the first region whose box holds it; one panel a region (two when sided)
 *     parts: [[/re/, how]],        // how each vehicle part (a bone of its rig) is taken, first match wins:
 *                                  // 'cut' (triangle by triangle into the regions), 'whole' (into the region its
 *                                  // middle is in), 'wheel' (whole, its own panel, turning with the road: `wheels`),
 *                                  // or a SEAT (its own panel)
 *     wheels: { front: SEAT, rear: SEAT },
 *     holds: [<bone>],             // robot bones no stray triangle welds onto (the head pops out bare)
 *     frame?: { build },           // the inner frame's breadth when the scheme makes one (inner-frame.js)
 *   }
 *
 *   REGION: { id, u?, w?, h?, sided?, ...SEAT } — u [−1 tail … 1 nose], w [−1 left … 1 right], h [0 ground … 1 roof]
 *     are the box's ranges in the vehicle's normalized frame (absent: all of it). `sided`: a panel per side.
 *   SEAT: where the panel sits in the robot form —
 *     { bone, face, along?, turn?, embed?, flip? }: on that bone's box (`bone` without its L/R when sided: the side
 *       is the panel's, crossed over when `flip`, since a body stowed facing back has the vehicle's left on its
 *       right), against its `face` ('front' | 'back' | 'outer' | 'inner' | 'top' | 'bottom' | 'center'), at
 *       `along` (−1 … 1 of the box's height), turned by `turn`: 'stow' (as it lies on the stowed bone: the panel only
 *       slides) or [rx, ry, rz] degrees from the vehicle's frame; `embed` the share of its depth sunk into the bone;
 *       `hinge` [hx, hy, hz] (−1 … 1 of its box in the vehicle's frame): it SWINGS about that edge between its two
 *       places, the way a nose folds down, instead of sliding.
 *     { bone, at: [ax, ay, az], rot, anchor: 'root' }: pinned by its inboard edge at a point of the bone's box (a
 *       jet's wings on its back; `rot` mirrored for the robot's left).
 */

/**
 * fuselageFold({ fold, legs }) — the jet whose FUSELAGE FOLDS: lying face down in it, the robot's back the jet's
 * spine. `fold` 'front': the nose and cockpit hinge down onto the chest (the nose cone points down between the legs);
 * 'back': the tail hinges down behind as a pack (its fins pointing down), the front of the fuselage standing up as
 * the chest, canopy forward. `legs` 'stretch': the legs lie straight back as the engine nacelles, the nozzles their
 * feet; 'box': the legs tuck up at the knee into a box under the fuselage and unfold.
 */
function fuselageFold({ fold = 'front', legs = 'stretch' } = {}) {
  const box = legs === 'box';
  const L = box
    // (the shins folded forward under the thighs, the belly side: a box of doubled legs under the rear fuselage)
    ? { thighL: [0, -4, 0], thighR: [0, 4, 0], shinL: [160, 0, 0], shinR: [160, 0, 0] }
    : { thighL: [0, -3, 0], thighR: [0, 3, 0] };
  const front = fold === 'front';
  const regions = front ? [
    // the nose swings down about its rear edge, top to the front: the cockpit on the chest, the cone pointing down
    { id: 'nose', u: [0.3, 1.01], bone: 'torso', face: 'front', along: -0.1, turn: [-90, 0, 0], hinge: [0, -1, 1], embed: 0.4 },
    { id: 'spine', u: [-0.25, 0.3], bone: 'torso', face: 'back', along: 0.1, turn: 'stow', embed: 0.4 },
  ] : [
    // the front of the fuselage stands up as the chest, canopy forward; the tail swings down behind about its front edge
    { id: 'nose', u: [-0.1, 1.01], bone: 'torso', face: 'front', along: 0.1, turn: [90, 0, 180], embed: 0.4 },
    { id: 'tail', u: [-1.01, -0.62], bone: 'torso', face: 'back', along: -0.6, turn: [90, 0, 0], hinge: [0, 1, 1], embed: 0.3 },
  ];
  const legRegions = front
    ? [{ id: 'thigh', u: [-0.6, -0.25], sided: true, flip: false, bone: 'thigh', face: box ? 'back' : 'front', turn: 'stow', embed: 0.45 },
      { id: 'leg', u: [-1.01, -0.6], sided: true, flip: false, bone: 'shin', face: box ? 'back' : 'front', along: -0.2, turn: 'stow', embed: 0.45 }]
    : [{ id: 'thigh', u: [-0.4, -0.1], sided: true, flip: false, bone: 'thigh', face: box ? 'back' : 'front', turn: 'stow', embed: 0.45 },
      { id: 'leg', u: [-0.62, -0.4], sided: true, flip: false, bone: 'shin', face: box ? 'back' : 'front', along: -0.2, turn: 'stow', embed: 0.45 }];
  return {
    words: `a jet whose fuselage folds: lying face down in it, ${front ? 'the nose and cockpit hinge down onto its chest' : 'the tail hinges down behind it as a pack, the front of the fuselage its chest'}; its legs ${box ? 'tucked into a box under the fuselage' : 'stretched back as the engine nacelles, the nozzles its feet'}; the wings on its back`,
    form: 'air',
    // the legs folded in a box make the robot no longer than the jet; stretched, a little shorter than it
    ratio: box ? 1.0 : 0.85,
    stow: {
      root: [{ axis: 'x', deg: -90, at: [0.15, 0.8] }],
      local: { head: [55, 0, 0], upperArmL: [18, -8, 0], upperArmR: [18, 8, 0], forearmL: [20, 0, 0], forearmR: [20, 0, 0], ...L },
      // in the fuselage (a craft's height counts its fin: the fuselage is its lower part)
      z: 0.28,
    },
    frame: { build: { shoulder: 0.11, hip: 0.045, chest: 0.16 } },
    windows: WINDOWS,
    hop: 0.2,
    regions: [...regions, ...legRegions],
    parts: [
      [/^wing/, { bone: 'torso', at: [0.55, -1, 0.5], rot: [90, 24, 0], anchor: 'root' }],
      [/^stab/, { bone: 'shin', face: 'outer', along: 0.1, turn: 'stow', embed: 0.3 }],
      [/^missile/, { bone: 'forearm', face: 'outer', turn: 'stow', embed: 0.3 }],
      ...(front ? [[/^fin/, { bone: 'torso', face: 'back', along: 0.5, turn: 'stow', embed: 0.2 }]] : []),
      [/^(hull|engine|intake|root|canopy)$/, 'cut'],
      [/.*/, 'whole'],
    ],
    holds: ['head'],
    dials: { fold, legs },
  };
}

const WINDOWS = {
  legs: [0.15, 0.7],
  arms: [0.2, 0.75],
  head: [0.0, 0.35],
  riders: [0.25, 0.85],
  panels: [0.45, 0.97],   // the shell closes after the skeleton has folded (and opens first on the way back)
};

export const TRANSFORM_SCHEMES = Object.freeze({
  'car-bot': {
    words: 'a car that stands up into a robot: the hood and nose its chest, the roof its back, the doors its arms, the rear its legs (the bumper its feet), the wheels its shoulders and calves',
    form: 'ground',
    ratio: 1.0,
    stow: {
      // on its back, head to the nose: it falls back as it spins round to face the way the car drives
      root: [{ axis: 'x', deg: 90, at: [0.25, 0.85] }, { axis: 'z', deg: 180, at: [0.0, 0.6] }],
      local: { head: [-40, 0, 0], upperArmL: [0, -4, 0], upperArmR: [0, 4, 0], forearmL: [12, 0, 0], forearmR: [12, 0, 0] },
      z: 0.45,
    },
    windows: WINDOWS,
    hop: 0.18,
    regions: [
      { id: 'chest', u: [0.2, 0.64], bone: 'torso', face: 'front', along: 0.1, turn: 'stow', embed: 0.35 },
      { id: 'nose', u: [0.64, 1.01], bone: 'pelvis', face: 'front', along: -0.2, turn: 'stow', embed: 0.35 },
      { id: 'floor', u: [-0.42, 0.2], w: [-0.55, 0.55], h: [-0.01, 0.32], bone: 'pelvis', face: 'center', turn: 'stow' },
      { id: 'roof', u: [-0.42, 0.2], h: [0.55, 1.01], bone: 'torso', face: 'back', along: 0.25, turn: [90, 0, 0], embed: 0.3 },
      { id: 'door', u: [-0.42, 0.2], sided: true, flip: true, bone: 'forearm', face: 'outer', along: 0.2, turn: 'stow', embed: 0.4 },
      { id: 'quarter', u: [-0.7, -0.42], sided: true, flip: true, bone: 'thigh', face: 'front', turn: 'stow', embed: 0.4 },
      { id: 'tail', u: [-1.01, -0.7], sided: true, flip: true, bone: 'shin', face: 'front', along: -0.25, turn: 'stow', embed: 0.4 },
    ],
    parts: [[/^wheel/, 'wheel'], [/.*/, 'cut']],
    wheels: {
      front: { bone: 'upperArm', face: 'outer', along: 0.25, turn: [0, 0, 0], embed: 0.35, flip: true },
      rear: { bone: 'shin', face: 'outer', along: 0.35, turn: [0, 0, 0], embed: 0.35, flip: true },
    },
    holds: ['head'],
  },
  'jet-bot': {
    words: 'a jet that stands up into a robot: the nose and canopy its chest, the engines its legs (the nozzles its feet), the wings on its back, the tailplanes on its shins',
    form: 'air',
    ratio: 0.9,
    stow: {
      root: [{ axis: 'x', deg: 90, at: [0.2, 0.8] }, { axis: 'z', deg: 180, at: [0.0, 0.55] }],
      local: { head: [-50, 0, 0], upperArmL: [0, -6, 0], upperArmR: [0, 6, 0], thighL: [0, 3, 0], thighR: [0, -3, 0] },
      z: 0.3,
    },
    // a fuselage is narrow: the frame's shoulders and hips close up so it lies inside it
    frame: { build: { shoulder: 0.1, hip: 0.042, chest: 0.15 } },
    windows: WINDOWS,
    hop: 0.25,
    regions: [
      { id: 'chest', u: [0.25, 1.01], bone: 'torso', face: 'front', along: 0.2, turn: 'stow', embed: 0.4 },
      { id: 'back', u: [-0.3, 0.25], bone: 'torso', face: 'back', along: -0.1, turn: 'stow', embed: 0.4 },
      { id: 'intake', u: [-0.3, 0.25], h: [-0.01, 0.4], sided: true, flip: true, bone: 'upperArm', face: 'outer', turn: 'stow', embed: 0.4 },
      { id: 'thigh', u: [-0.66, -0.3], sided: true, flip: true, bone: 'thigh', face: 'front', turn: 'stow', embed: 0.45 },
      { id: 'leg', u: [-1.01, -0.66], sided: true, flip: true, bone: 'shin', face: 'front', along: -0.15, turn: 'stow', embed: 0.45 },
    ],
    parts: [
      [/^wing/, { bone: 'torso', at: [0.55, -1, 0.55], rot: [90, 28, 0], anchor: 'root' }],
      [/^stab/, { bone: 'shin', face: 'outer', along: 0.2, turn: 'stow', embed: 0.3, flip: true }],
      [/^missile/, { bone: 'forearm', face: 'outer', turn: 'stow', embed: 0.3, flip: true }],
      [/^fin/, { bone: 'torso', face: 'back', along: 0.6, turn: 'stow', embed: 0.2 }],
      [/^(hull|engine|intake|root)$/, 'cut'],
      [/.*/, 'whole'],
    ],
    holds: ['head'],
  },
  variable: {
    words: 'a variable suit (variable-suit.js) folding into its waverider: face down, legs together for the engine pods, arms along its belly, the head tucked under the shield that is its nose, the binders spread into wings, the hip fins up for the tail',
    form: 'air',
    ratio: 1.0,
    stow: {
      root: [{ axis: 'x', deg: -90, at: [0.12, 0.8] }],
      local: {
        head: [60, 0, 0],
        upperArmL: [14, -8, 0], upperArmR: [14, 8, 0], forearmL: [10, 0, 0], forearmR: [10, 0, 0],
        thighL: [0, -3, 0], thighR: [0, 3, 0],
      },
      z: 0.5,
    },
    windows: WINDOWS,
    hop: 0.12,
    regions: [],
    parts: [],
    holds: [],
  },
  'rear-foot': {
    words: 'a car whose rear is its legs together (the bumper its feet), whose hood is its chest, whose head pops out of the middle of it last; the doors its forearms, the roof its back, the wheels its shoulders and calves',
    form: 'ground',
    // shorter than its car, so the folded head lies under the middle of it
    ratio: 0.85,
    stow: {
      root: [{ axis: 'x', deg: 90, at: [0.25, 0.85] }, { axis: 'z', deg: 180, at: [0.0, 0.6] }],
      // the head folded down into the chest (it pops out last on the way back); the legs together
      local: { head: [175, 0, 0], upperArmL: [0, -4, 0], upperArmR: [0, 4, 0], forearmL: [12, 0, 0], forearmR: [12, 0, 0], thighL: [0, -8, 0], thighR: [0, 8, 0] },
      // low in the car, so the toes (pointing up as it lies on its back) stay under the boot lid; set back, its feet at
      // the bumper and its folded head under the middle of the car
      z: 0.36,
      y: -0.15,
    },
    windows: { ...WINDOWS, head: [0.0, 0.25] },
    hop: 0.15,
    regions: [
      { id: 'chest', u: [0.3, 1.01], bone: 'torso', face: 'front', along: 0.15, turn: 'stow', embed: 0.35 },
      { id: 'cabin', u: [-0.42, 0.3], h: [0.5, 1.01], bone: 'torso', face: 'back', along: 0.2, turn: [90, 0, 0], embed: 0.3 },
      { id: 'floor', u: [-0.42, 0.3], w: [-0.5, 0.5], h: [-0.01, 0.3], bone: 'pelvis', face: 'center', turn: 'stow' },
      { id: 'door', u: [-0.42, 0.3], sided: true, flip: true, bone: 'forearm', face: 'outer', along: 0.15, turn: 'stow', embed: 0.4 },
      // the rear, split down its middle: a half each leg, the quarters the thighs, the tail and bumper the shins and feet
      { id: 'hip', u: [-0.72, -0.42], sided: true, flip: true, bone: 'thigh', face: 'front', turn: 'stow', embed: 0.45 },
      { id: 'foot', u: [-1.01, -0.72], sided: true, flip: true, bone: 'shin', face: 'front', along: -0.5, turn: 'stow', embed: 0.45 },
    ],
    parts: [[/^wheel/, 'wheel'], [/.*/, 'cut']],
    wheels: {
      front: { bone: 'upperArm', face: 'outer', along: 0.25, turn: [0, 0, 0], embed: 0.35, flip: true },
      rear: { bone: 'shin', face: 'outer', along: 0.25, turn: [0, 0, 0], embed: 0.35, flip: true },
    },
    holds: ['head'],
  },
  'fuselage-fold': fuselageFold(),
  waverider: {
    words: 'a suit that folds into its own flight form: face down, legs together for the engines, arms stretched ahead',
    form: 'air',
    ratio: 1.0,
    stow: {
      root: [{ axis: 'x', deg: -90, at: [0.1, 0.8] }],
      // arms stretched ahead (what the hands hold points down the flight path), the head back to look ahead
      local: {
        head: [-35, 0, 0],
        upperArmL: [165, -6, 0], upperArmR: [165, 6, 0], forearmL: [8, 0, 0], forearmR: [8, 0, 0],
        thighL: [0, -4, 0], thighR: [0, 4, 0],
      },
      z: 0.5,
    },
    windows: WINDOWS,
    hop: 0.12,
    regions: [],
    parts: [],
    holds: [],
  },
  'alien-jetski': {
    words: 'an alien body (alien-body.js) of pointed shells folding into a hover jetski: face down, its keel run under it for the hull (the point its prow), the thigh shells beside it for sponsons, the head tipped up behind the prow, the legs together its tail with the feet for skegs, its blades, spikes and spine swung back for fins',
    form: 'ground',
    ratio: 1.0,
    stow: {
      root: [{ axis: 'x', deg: -90, at: [0.12, 0.75] }],
      local: {
        head: [-25, 0, 0],
        upperArmL: [8, 16, 0], upperArmR: [8, -16, 0], forearmL: [-6, -8, 0], forearmR: [-6, 8, 0],
        thighL: [0, -6, 0], thighR: [0, 6, 0],
      },
      z: 0.5,
      hover: 0.035,
    },
    windows: WINDOWS,
    hop: 0.1,
    regions: [],
    parts: [],
    holds: [],
  },
});

export const SCHEME_IDS = Object.freeze(Object.keys(TRANSFORM_SCHEMES));

// the dials a scheme takes, and their values (the first the default)
export const SCHEME_DIALS = Object.freeze({ 'fuselage-fold': { fold: ['front', 'back'], legs: ['stretch', 'box'] } });

/** resolveScheme(id, dials) → the row, its dials applied (an unknown id or dial value throws, naming the choices) */
export function resolveScheme(id, dials = {}) {
  const S = TRANSFORM_SCHEMES[id];
  if (!S) throw new Error(`transformation: scheme '${id}' is not one of ${SCHEME_IDS.join(', ')}`);
  const D = SCHEME_DIALS[id];
  const given = Object.entries(dials || {}).filter(([, v]) => v != null);
  if (!D) {
    if (given.length) throw new Error(`transformation: scheme '${id}' takes no dials (${given.map(([k]) => k).join(', ')})`);
    return S;
  }
  for (const [k, v] of given) {
    if (!D[k]) throw new Error(`transformation: scheme '${id}' dials are ${Object.keys(D).join(', ')}`);
    if (!D[k].includes(v)) throw new Error(`transformation: scheme '${id}' ${k} is one of ${D[k].join(', ')}`);
  }
  return id === 'fuselage-fold' ? fuselageFold(Object.fromEntries(given)) : S;
}

// which window a bone folds in
export function boneGroup(id) {
  if (/^head/.test(id)) return 'head';
  if (/^(thigh|shin)/.test(id)) return 'legs';
  if (/^(upperArm|forearm|hand)/.test(id)) return 'arms';
  if (id === 'pelvis' || id === 'torso') return 'root';
  return 'riders';
}

/** the scheme a vehicle source calls for when none is named: a craft flies, anything else drives */
export function schemeFor({ vehicle } = {}) {
  if (!vehicle) return 'waverider';
  return vehicle.craft ? 'jet-bot' : 'car-bot';
}
