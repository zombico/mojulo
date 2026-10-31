/** musculature/cards.js — THE CARDS: a muscle shirt as data, a tree of muscle masses by group and level.
 *
 * A card's GROUPS are the body's big masses (the chest, the core, the flank, the back, the trapezius, the seat, the
 * shoulder, the biceps, the triceps, the forearm, the quadriceps, the hamstrings, the calf). Each group names its FRAME
 * (`trunk`, or the right limb's bone: `upperArm`, `foreArm`, `thigh`, `shank`; the left is the right's mirror) and the
 * wearer's PARTS its masses are seated on and worn by (the base names, a limb's side implied), and its MASSES by LEVEL:
 * 0 the group's silhouette in a few shapes, 1 its muscles, 2 their heads. A finer level's masses are authored to fill
 * their parent's shape, so the silhouette holds as the definition dial brings them in (principles.js).
 *
 * A mass is an egg seated on the wearer's skin:
 *   trunk   on: { t, az, el? }   t up the torso bone from the navel joint (0) to the neck's hub (1), az the azimuth from
 *                                the front toward the right (degrees), el the ray's rise (degrees: the trapezius's top is
 *                                seen from above); `along` its fibre (world axes, laid into the skin there)
 *   limb    on: { s, az, el? }   s down the bone from its head joint (0) to its tail (1), az round it from the front
 *                                toward the outside (degrees), el the ray's rise toward the bone's head (degrees: the
 *                                deltoid's cap over the shoulder's top); its fibre the bone's, turned `spin` in the skin
 *   r: [along, across, depth] and proud (how far it stands off the skin), all in W, the wearer's half biacromial
 *   mid: true    a trunk mass on the midline, not mirrored
 *
 * A group may ACT at joints (`act`: [{ joint, role }], principles.js ACTIVITY_JOINTS and ACTIVITY): as the joint closes, a
 * flexor's masses bunch and an extensor's stretch, worn as correctives on the rest (passes.js activity).
 *
 * Pure data and its checks; no dice. */

const egg = (id, level, on, r, proud, more = {}) => Object.freeze({ id, level, on: Object.freeze(on), r: Object.freeze(r), proud, ...more });

/** THE SAIKYO BODY: hulking but lean on the anime frame — big biceps and a horseshoe triceps, a deltoid cap, a full chest
 * and a blocked core, sweeping lats, strong legs with a teardrop over the knee and a diamond calf */
const SAIKYO = {
  note: 'the Saikyo body: hulking but lean on the anime frame (big arms, a full chest and core, sweeping lats, strong legs); form end the JoJo openings\' bodybuilder in a few shapes, detail end Tekken\'s separated muscles',
  grain: 0.011,
  // (its hands follow its arms: principles.js HAND_SHARE of the forearm's growth; a number here would name their scale)
  groups: [
    { id: 'chest', frame: 'trunk', parts: ['torso'], act: [{ joint: 'shoulder', role: 'extensor' }], masses: [
      egg('pecSlab', 0, { t: 0.6, az: 30 }, [0.5, 0.32, 0.16], 0.065, { along: [1, 0, 0.15] }),
      egg('pecSternal', 1, { t: 0.55, az: 27 }, [0.44, 0.26, 0.13], 0.065, { along: [1, 0, 0.35] }),
      egg('pecClavicular', 1, { t: 0.8, az: 32 }, [0.32, 0.14, 0.08], 0.039, { along: [1, 0, -0.1] }),
      // (its heads at the detail end ROUNDED, as a pectoral is: a full belly low and in, the lower border one curve
      // rising gently and ending short of the armpit, the outer corner round, the fibres turning up into the tendon under
      // the deltoid; fans reaching out to the armpit had converged there in a triangle)
      egg('pecBelly', 2, { t: 0.52, az: 21 }, [0.3, 0.24, 0.12], 0.072, { along: [1, 0, 0.2] }),
      egg('pecLowerBorder', 2, { t: 0.44, az: 24 }, [0.28, 0.11, 0.09], 0.068, { along: [1, 0, 0.35] }),
      egg('pecUpper', 2, { t: 0.67, az: 27 }, [0.28, 0.11, 0.075], 0.058, { along: [1, 0, 0.05] }),
      egg('pecOuter', 2, { t: 0.57, az: 37 }, [0.17, 0.16, 0.08], 0.05, { along: [1, 0, 0.5] }),
      egg('pecClavicularHead', 2, { t: 0.8, az: 33 }, [0.3, 0.12, 0.075], 0.0423, { along: [1, 0, -0.1] }),
    ] },
    { id: 'core', frame: 'trunk', parts: ['torso', 'pelvis'], masses: [
      egg('rectusSheet', 0, { t: -0.2, az: 15 }, [1.05, 0.2, 0.08], 0.039),
      egg('absUpper', 1, { t: 0.16, az: 16 }, [0.48, 0.17, 0.07], 0.0423),
      egg('absLower', 1, { t: -0.5, az: 13 }, [0.55, 0.17, 0.06], 0.0292),
      egg('abs1', 2, { t: 0.36, az: 17 }, [0.12, 0.15, 0.06], 0.0455),
      egg('abs2', 2, { t: 0.14, az: 17 }, [0.12, 0.15, 0.06], 0.0488),
      egg('abs3', 2, { t: -0.08, az: 16 }, [0.12, 0.15, 0.06], 0.0488),
      egg('abs4', 2, { t: -0.48, az: 13 }, [0.3, 0.14, 0.055], 0.0325),
    ] },
    { id: 'flank', frame: 'trunk', parts: ['torso', 'pelvis'], masses: [
      egg('obliqueMass', 0, { t: -0.35, az: 70 }, [0.55, 0.3, 0.1], 0.039, { along: [0, 0.25, 1] }),
      egg('obliqueExternal', 1, { t: -0.4, az: 72 }, [0.45, 0.24, 0.09], 0.039, { along: [0, 0.3, 1] }),
      egg('serratus', 1, { t: 0.38, az: 60 }, [0.3, 0.2, 0.05], 0.0228, { along: [0, 1, -0.5] }),
      egg('obliqueUpper', 2, { t: -0.15, az: 70 }, [0.22, 0.2, 0.08], 0.0358, { along: [0, 0.4, 1] }),
      egg('obliqueLower', 2, { t: -0.55, az: 74 }, [0.3, 0.22, 0.085], 0.039, { along: [0, 0.3, 1] }),
      egg('serratus1', 2, { t: 0.2, az: 60 }, [0.12, 0.05, 0.035], 0.0228, { along: [0, 1, -0.45] }),
      egg('serratus2', 2, { t: 0.33, az: 61 }, [0.13, 0.05, 0.035], 0.0228, { along: [0, 1, -0.45] }),
      egg('serratus3', 2, { t: 0.46, az: 63 }, [0.13, 0.05, 0.035], 0.0228, { along: [0, 1, -0.4] }),
      egg('serratus4', 2, { t: 0.58, az: 65 }, [0.12, 0.05, 0.035], 0.0195, { along: [0, 1, -0.4] }),
    ] },
    { id: 'back', frame: 'trunk', parts: ['torso', 'pelvis'], act: [{ joint: 'shoulder', role: 'extensor' }], masses: [
      egg('latWing', 0, { t: 0.35, az: 122 }, [0.75, 0.32, 0.12], 0.065, { along: [0.35, 0, 1] }),
      egg('erectorMass', 0, { t: -0.35, az: 166 }, [0.65, 0.14, 0.09], 0.039),
      egg('latissimus', 1, { t: 0.3, az: 120 }, [0.65, 0.26, 0.11], 0.0585, { along: [0.35, 0, 1] }),
      egg('teresMajor', 1, { t: 0.72, az: 130 }, [0.22, 0.12, 0.08], 0.039, { along: [1, 0, -0.4] }),
      egg('infraspinatus', 1, { t: 0.72, az: 152 }, [0.24, 0.18, 0.08], 0.0325, { along: [1, 0, -0.3] }),
      egg('erector', 1, { t: -0.3, az: 166 }, [0.6, 0.12, 0.08], 0.039),
      egg('latUpper', 2, { t: 0.5, az: 124 }, [0.4, 0.22, 0.1], 0.0585, { along: [0.5, 0, 1] }),
      egg('latLower', 2, { t: 0.05, az: 116 }, [0.45, 0.2, 0.09], 0.0488, { along: [0.25, 0, 1] }),
      egg('teres', 2, { t: 0.72, az: 130 }, [0.2, 0.1, 0.075], 0.0423, { along: [1, 0, -0.4] }),
      egg('infraspinatusHead', 2, { t: 0.72, az: 152 }, [0.22, 0.16, 0.075], 0.0358, { along: [1, 0, -0.3] }),
      egg('erectorLower', 2, { t: -0.55, az: 166 }, [0.35, 0.12, 0.08], 0.0455),
      egg('erectorUpper', 2, { t: 0.0, az: 168 }, [0.35, 0.1, 0.06], 0.0325),
    ] },
    { id: 'trapezius', frame: 'trunk', parts: ['torso'], masses: [
      egg('trapYoke', 0, { t: 0.85, az: 125, el: 30 }, [0.45, 0.28, 0.12], 0.065, { along: [1, 0, -0.35] }),
      egg('trapUpper', 1, { t: 0.85, az: 125, el: 30 }, [0.4, 0.22, 0.11], 0.065, { along: [1, 0, -0.35] }),
      egg('trapMiddle', 1, { t: 0.72, az: 168 }, [0.32, 0.26, 0.07], 0.0325, { along: [1, 0, 0] }),
      egg('trapUpperHead', 2, { t: 0.85, az: 123, el: 30 }, [0.38, 0.2, 0.1], 0.0683, { along: [1, 0, -0.4] }),
      egg('trapMiddleHead', 2, { t: 0.72, az: 168 }, [0.28, 0.22, 0.065], 0.0325, { along: [1, 0, 0] }),
      egg('trapLower', 2, { t: 0.4, az: 172 }, [0.36, 0.16, 0.05], 0.0228, { along: [0.45, 0, 1] }),
    ] },
    { id: 'seat', frame: 'trunk', parts: ['pelvis', 'thigh'], masses: [
      // (the cheek a round mass, deep as it is broad, its fibre slanting down and out as the gluteus maximus's does, its
      // fullest point low, just over the fold, where the lower cheek turns under into it; the medius filling the hip's
      // side under the crest)
      egg('glute', 0, { t: -1.08, az: 146 }, [0.4, 0.31, 0.2], 0.11, { along: [0.35, 0, -1] }),
      egg('gluteMax', 1, { t: -1.1, az: 155 }, [0.36, 0.34, 0.19], 0.1, { along: [0.35, 0, -1] }),
      egg('gluteLower', 1, { t: -1.3, az: 160 }, [0.2, 0.3, 0.14], 0.075, { along: [1, 0, -0.25] }),
      egg('gluteMed', 1, { t: -0.7, az: 112 }, [0.24, 0.24, 0.08], 0.0325),
      egg('gluteMaxHead', 2, { t: -1.1, az: 155 }, [0.34, 0.32, 0.18], 0.105, { along: [0.35, 0, -1] }),
      egg('gluteLowerHead', 2, { t: -1.3, az: 160 }, [0.19, 0.28, 0.13], 0.078, { along: [1, 0, -0.25] }),
      egg('gluteMedHead', 2, { t: -0.7, az: 112 }, [0.22, 0.22, 0.08], 0.0358),
    ] },
    { id: 'deltoid', frame: 'upperArm', parts: ['upperArm', 'shoulderWeb', 'shoulderBall'], act: [{ joint: 'shoulder', role: 'flexor' }], masses: [
      egg('deltoidCap', 0, { s: 0.06, az: 90 }, [0.42, 0.42, 0.16], 0.078),
      egg('deltoidCrown', 0, { s: -0.08, az: 100, el: 70 }, [0.3, 0.36, 0.14], 0.05),
      egg('deltoidTop', 1, { s: -0.08, az: 100, el: 70 }, [0.26, 0.3, 0.12], 0.045),
      egg('deltoidAnterior', 1, { s: 0.08, az: 30 }, [0.36, 0.2, 0.13], 0.065),
      egg('deltoidLateral', 1, { s: 0.09, az: 90 }, [0.38, 0.22, 0.14], 0.0715),
      egg('deltoidPosterior', 1, { s: 0.08, az: 150 }, [0.34, 0.2, 0.12], 0.0585),
      egg('deltoidTopHead', 2, { s: -0.08, az: 100, el: 70 }, [0.24, 0.28, 0.11], 0.045),
      egg('deltoidAnteriorHead', 2, { s: 0.08, az: 30 }, [0.34, 0.18, 0.12], 0.065),
      egg('deltoidLateralFront', 2, { s: 0.1, az: 74 }, [0.36, 0.12, 0.12], 0.0715),
      egg('deltoidLateralBack', 2, { s: 0.1, az: 106 }, [0.36, 0.12, 0.12], 0.0715),
      egg('deltoidPosteriorHead', 2, { s: 0.08, az: 150 }, [0.32, 0.18, 0.11], 0.0585),
    ] },
    { id: 'biceps', frame: 'upperArm', parts: ['upperArm', 'elbowBridge', 'foreArm'], act: [{ joint: 'elbow', role: 'flexor' }], masses: [
      egg('armFront', 0, { s: 0.56, az: 10 }, [0.5, 0.3, 0.17], 0.078),
      egg('bicepsBelly', 1, { s: 0.56, az: 5 }, [0.42, 0.24, 0.15], 0.078),
      egg('brachialis', 1, { s: 0.76, az: 72 }, [0.25, 0.14, 0.09], 0.039),
      egg('bicepsLong', 2, { s: 0.53, az: 22 }, [0.38, 0.15, 0.14], 0.0748),
      egg('bicepsShort', 2, { s: 0.58, az: -15 }, [0.36, 0.14, 0.14], 0.0715),
      egg('brachialisHead', 2, { s: 0.76, az: 72 }, [0.23, 0.12, 0.085], 0.0423),
    ] },
    { id: 'triceps', frame: 'upperArm', parts: ['upperArm', 'elbowBridge', 'foreArm'], act: [{ joint: 'elbow', role: 'extensor' }], masses: [
      egg('armBack', 0, { s: 0.42, az: 180 }, [0.55, 0.32, 0.15], 0.065),
      egg('tricepsLong', 1, { s: 0.38, az: 196 }, [0.46, 0.2, 0.13], 0.065),
      egg('tricepsLateral', 1, { s: 0.36, az: 140 }, [0.4, 0.16, 0.12], 0.0585),
      egg('tricepsLongHead', 2, { s: 0.36, az: 200 }, [0.42, 0.17, 0.12], 0.065),
      egg('tricepsLateralHead', 2, { s: 0.34, az: 138 }, [0.38, 0.14, 0.12], 0.0618),
      egg('tricepsMedial', 2, { s: 0.68, az: 220 }, [0.2, 0.12, 0.08], 0.0358),
    ] },
    { id: 'forearm', frame: 'foreArm', parts: ['foreArm', 'elbowBridge', 'wristBridge', 'upperArm'], masses: [
      // (the forearm's bulk seated high and long, so its line carries up over the elbow, not flaring out under it)
      egg('forearmMass', 0, { s: 0.25, az: 55 }, [0.52, 0.36, 0.15], 0.0545),
      egg('brachioradialis', 1, { s: 0.22, az: 50 }, [0.42, 0.15, 0.12], 0.052),
      egg('flexors', 1, { s: 0.3, az: -55 }, [0.4, 0.18, 0.12], 0.0455),
      egg('extensors', 1, { s: 0.32, az: 140 }, [0.38, 0.17, 0.11], 0.0423),
      egg('brachioradialisHead', 2, { s: 0.2, az: 50 }, [0.4, 0.13, 0.115], 0.0553),
      egg('flexorRadial', 2, { s: 0.3, az: -30 }, [0.38, 0.1, 0.1], 0.0455),
      egg('flexorUlnar', 2, { s: 0.32, az: -80 }, [0.38, 0.1, 0.1], 0.0423),
      egg('extensorRadial', 2, { s: 0.3, az: 115 }, [0.36, 0.1, 0.1], 0.0423),
      egg('extensorUlnar', 2, { s: 0.34, az: 160 }, [0.34, 0.1, 0.09], 0.039),
    ] },
    // THE ELBOW's landmarks, one level, so they hold at every definition (a level-0 mass in a deeper group sinks under its
    // children toward the detail end): the brachioradialis's root rising out of the upper arm above the joint on the
    // thumb's side, the olecranon the elbow's point, the humerus's two epicondyles its width (the inner the prouder)
    { id: 'elbow', frame: 'foreArm', parts: ['upperArm', 'elbowBridge', 'foreArm'], masses: [
      egg('elbowCrest', 0, { s: -0.06, az: 60 }, [0.3, 0.17, 0.09], 0.03),
      egg('olecranon', 0, { s: -0.02, az: 182 }, [0.17, 0.12, 0.07], 0.032),
      egg('epicondyleInner', 0, { s: -0.12, az: -100 }, [0.18, 0.1, 0.06], 0.028),
      egg('epicondyleOuter', 0, { s: -0.13, az: 100 }, [0.18, 0.09, 0.05], 0.02),
    ] },
    { id: 'quadriceps', frame: 'thigh', parts: ['thigh', 'kneeBridge', 'shank', 'pelvis'], act: [{ joint: 'knee', role: 'extensor' }], masses: [
      egg('quadMass', 0, { s: 0.48, az: 20 }, [0.85, 0.46, 0.2], 0.078),
      egg('rectusFemoris', 1, { s: 0.42, az: 5 }, [0.65, 0.22, 0.16], 0.0715),
      egg('vastusLateralis', 1, { s: 0.5, az: 68 }, [0.7, 0.26, 0.17], 0.0715),
      egg('vastusMedialis', 1, { s: 0.8, az: -38 }, [0.3, 0.22, 0.16], 0.078),
      egg('rectusFemorisHead', 2, { s: 0.42, az: 5 }, [0.62, 0.19, 0.15], 0.0748),
      egg('vastusLateralisHead', 2, { s: 0.52, az: 72 }, [0.66, 0.22, 0.16], 0.0748),
      egg('vastusMedialisHead', 2, { s: 0.8, az: -40 }, [0.28, 0.2, 0.16], 0.0845),
      egg('sartorius', 2, { s: 0.5, az: -55 }, [0.7, 0.06, 0.05], 0.026, { spin: -18 }),
      egg('tensorFasciae', 2, { s: 0.12, az: 80 }, [0.26, 0.14, 0.08], 0.0325),
    ] },
    { id: 'hamstrings', frame: 'thigh', parts: ['thigh', 'kneeBridge', 'shank', 'pelvis'], act: [{ joint: 'knee', role: 'flexor' }], masses: [
      egg('hamMass', 0, { s: 0.5, az: 185 }, [0.75, 0.4, 0.16], 0.065),
      egg('adductorMass', 0, { s: 0.3, az: -100 }, [0.5, 0.26, 0.14], 0.0455),
      egg('bicepsFemoris', 1, { s: 0.5, az: 150 }, [0.62, 0.2, 0.14], 0.0585),
      egg('semitendinosus', 1, { s: 0.52, az: -160 }, [0.6, 0.2, 0.14], 0.0585),
      egg('adductors', 1, { s: 0.28, az: -100 }, [0.45, 0.22, 0.13], 0.0455),
      egg('bicepsFemorisHead', 2, { s: 0.5, az: 148 }, [0.6, 0.17, 0.13], 0.0618),
      egg('semitendinosusHead', 2, { s: 0.52, az: -158 }, [0.58, 0.17, 0.13], 0.0618),
      egg('adductorsHead', 2, { s: 0.28, az: -100 }, [0.42, 0.2, 0.12], 0.0488),
    ] },
    { id: 'calf', frame: 'shank', parts: ['shank', 'kneeBridge', 'thigh'], masses: [
      egg('calfMass', 0, { s: 0.3, az: 180 }, [0.45, 0.4, 0.16], 0.078),
      egg('tibialisMass', 0, { s: 0.35, az: 40 }, [0.45, 0.14, 0.08], 0.026),
      egg('gastrocMedial', 1, { s: 0.3, az: -150 }, [0.38, 0.2, 0.15], 0.078),
      egg('gastrocLateral', 1, { s: 0.27, az: 150 }, [0.33, 0.18, 0.13], 0.065),
      egg('soleus', 1, { s: 0.56, az: 180 }, [0.4, 0.26, 0.08], 0.0325),
      egg('tibialis', 1, { s: 0.35, az: 42 }, [0.45, 0.13, 0.08], 0.0292),
      egg('gastrocMedialHead', 2, { s: 0.3, az: -148 }, [0.36, 0.18, 0.15], 0.0813),
      egg('gastrocLateralHead', 2, { s: 0.27, az: 148 }, [0.31, 0.16, 0.13], 0.0683),
      egg('soleusHead', 2, { s: 0.56, az: 180 }, [0.38, 0.24, 0.08], 0.0325),
      egg('tibialisHead', 2, { s: 0.35, az: 42 }, [0.43, 0.11, 0.08], 0.0325),
      egg('peroneus', 2, { s: 0.42, az: 100 }, [0.4, 0.08, 0.06], 0.0228),
    ] },
  ],
};

export const MUSCLE_CARDS = Object.freeze({ saikyo: SAIKYO });
export const MUSCLE_CARD_NAMES = Object.freeze(Object.keys(MUSCLE_CARDS));
export const MUSCLE_FRAMES = Object.freeze(['trunk', 'upperArm', 'foreArm', 'thigh', 'shank']);

/** a card's errors (empty = valid): every group framed and worn, every mass seated, sized and levelled */
export function validateMuscleCard(card, label = 'card') {
  const errs = [];
  if (!card || !Array.isArray(card.groups) || !card.groups.length) return [`${label}: { groups: [{ id, frame, parts, masses }] }`];
  const ids = new Set();
  for (const g of card.groups) {
    const gl = `${label}.${g.id}`;
    if (!MUSCLE_FRAMES.includes(g.frame)) errs.push(`${gl}: frame is one of ${MUSCLE_FRAMES.join(', ')}`);
    if (!Array.isArray(g.parts) || !g.parts.length) errs.push(`${gl}: parts names the wearer's parts it is worn on`);
    for (const a of g.act ?? []) if (!['elbow', 'knee', 'shoulder'].includes(a.joint) || !['flexor', 'extensor'].includes(a.role)) errs.push(`${gl}.act: { joint: elbow | knee | shoulder, role: flexor | extensor }`);
    for (const m of g.masses || []) {
      const ml = `${gl}.${m.id}`;
      if (ids.has(m.id)) errs.push(`${ml}: a mass id is unique in a card`); ids.add(m.id);
      if (!(Number.isInteger(m.level) && m.level >= 0 && m.level <= 2)) errs.push(`${ml}: level is 0, 1 or 2`);
      if (!(Array.isArray(m.r) && m.r.length === 3 && m.r.every((x) => x > 0))) errs.push(`${ml}: r is [along, across, depth], each > 0 (W)`);
      if (!Number.isFinite(m.proud)) errs.push(`${ml}: proud is a number (W)`);
      const on = m.on || {};
      if (g.frame === 'trunk' ? !(Number.isFinite(on.t) && Number.isFinite(on.az)) : !(Number.isFinite(on.s) && Number.isFinite(on.az))) errs.push(`${ml}: on is ${g.frame === 'trunk' ? '{ t, az, el? }' : '{ s, az }'}`);
    }
  }
  return errs;
}
