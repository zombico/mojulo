/**
 * reference — the numbers a mount is held to, each with where it comes from. Data only: the solver reads the gait
 * laws from here and the gates read the ranges, so a number is changed in one place and both follow.
 *
 * The reference horse is a light riding horse of 16 hands (1.63 m at the withers, about 500 kg). Every length and speed
 * here is HIS; another mount (a pony, a draught, a stylized body) is held to the same numbers made dimensionless by
 * dynamic similarity (Alexander & Jayes 1983: animals of one build move alike at equal Froude numbers v²/gh, h the hip
 * height), so a stride is scaled by the leg, a speed by √(g·leg) and a frequency by √(g/leg).
 *
 * Sources (the general record of equine locomotion; a value marked ≈ is read from the record's ranges, not digitized):
 *  - MUYBRIDGE 1887   Animal Locomotion, plates of the horse at the walk, trot, canter, gallop and jump (public domain):
 *                     the footfall order and the poses at each phase.
 *  - HILDEBRAND 1965  Symmetrical gaits of horses (Science 150): the walk's and trot's footfall phases and duty.
 *  - HILDEBRAND 1977  Analysis of asymmetrical gaits (J Mammalogy 58): the canter's and gallop's.
 *  - HEGLUND 1974     Heglund, Taylor & McMahon, Scaling stride frequency and gait to animal size (Science 186):
 *                     the stride frequency rising with speed in the trot, barely in the gallop.
 *  - HOYT 1981        Hoyt & Taylor, Gait and the energetics of locomotion in horses (Nature 292): the speeds a horse
 *                     chooses in each gait.
 *  - CLAYTON 1994     Clayton, Comparison of the stride kinematics of the collected, working, medium and extended trot
 *                     (Equine Vet J 26): the trot's stride against speed.
 *  - BACK 1995        Back, Schamhardt et al., Stride kinematics of the fore- and hindlimb in trotting horses
 *                     (Am J Vet Res 56): the joint angles through the trot, the diagonal's advanced placement.
 *  - MERKENS 1993     Merkens et al., Ground reaction force patterns of Dutch Warmbloods at the walk and trot
 *                     (Equine Vet J 25): the forehand's share, the walk's double hump.
 *  - WITTE 2006       Witte, Hirst & Wilson, Effect of speed on stride parameters in racehorses at gallop in field
 *                     conditions (J Exp Biol 209): the gallop's stance, stride and frequency up to 17 m/s.
 *  - BACK & CLAYTON   Equine Locomotion, 2nd ed. (2013): the joints' ranges, the reciprocal and stay apparatus, the
 *                     scapula's rotation on the thoracic sling.
 *
 * Frame: metres, seconds; +y the mount's front, +z up, +x its right; angles in degrees here (the solver turns them).
 */

export const G = 9.81;

/** The reference horse's build: what the gaits below were measured on. */
export const REFERENCE_HORSE = Object.freeze({
  withers: 1.63,           // 16 hh
  hip: 1.32,               // the hip joint's height standing (≈; the leg length of dynamic similarity)
  mass: 500,               // kg (≈)
  foreShare: 0.58,         // the forehand's share of the weight standing (MERKENS 1993: 55-60 %)
  pitchGyration: 0.75,     // m, the body's radius of gyration in pitch (≈, an estimate: trunk, neck and head)
});

/**
 * The gaits. `feet` each limb's touchdown phase in its stride (LH = 0; R lead: the leading limbs are the right ones,
 * a left lead is the mirror); `speed` the band in m/s; the stride's frequency and the duty (the share of the stride a
 * hoof is on the ground) as lines in the speed, `f = f0 + f1·v`, `duty = d0 + d1·v`; `lift` the swing's clearance
 * at the preferred speed (m, the fetlock's rise over its path, fore and hind; it grows with the stride, as √(L / L₀)); `crouch` how far the body sinks below its standing height at speed (m, ≈); `load` the
 * shape of a hoof's vertical force through its stance: 0 a single hump, > 0 the walk's double hump (MERKENS 1993);
 * `aerial` how many suspensions a stride has (the gate); `track` the hooves' width out from the mid-plane as a share of
 * where they stand (≈: the track narrows with speed toward the gallop's near single file, BACK & CLAYTON 2013).
 * Lengths for the reference horse.
 */
export const GAITS = Object.freeze({
  walk: {
    beats: 4, aerial: 0, symmetric: true,
    feet: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 },                   // lateral sequence (HILDEBRAND 1965)
    speed: [1.0, 2.0], preferred: 1.6,                                // HOYT 1981
    f: [0.62, 0.18], duty: [0.72, -0.06],                             // 0.91 Hz and 0.62 at 1.6 m/s (≈)
    lift: [0.10, 0.07], crouch: 0, load: 0.28, track: 0.9,
    source: 'HILDEBRAND 1965, HOYT 1981, MERKENS 1993',
  },
  trot: {
    beats: 2, aerial: 2, symmetric: true,
    // the diagonal's hind lands a moment before its fore (advanced placement, BACK 1995: ≈ 1-2 % of the stride)
    feet: { LH: 0, RF: 0.015, RH: 0.5, LF: 0.515 },
    speed: [2.5, 6.0], preferred: 4.0,
    f: [1.20, 0.06], duty: [0.50, -0.02],                             // 1.44 Hz, 2.8 m and 0.42 at 4 m/s (CLAYTON 1994)
    lift: [0.16, 0.06], crouch: 0.02, load: 0, track: 0.75,
    source: 'HILDEBRAND 1965, CLAYTON 1994, BACK 1995, HEGLUND 1974',
  },
  canter: {
    beats: 3, aerial: 1, symmetric: false,
    // three beats on the right lead: the left hind; the right hind with the left fore (the hind a moment first); the
    // leading right fore; then the suspension
    feet: { LH: 0, RH: 0.26, LF: 0.29, RF: 0.50 },
    speed: [4.0, 9.0], preferred: 6.0,
    f: [1.55, 0.03], duty: [0.52, -0.018],                            // 1.73 Hz, 3.5 m and 0.41 at 6 m/s (≈)
    lift: [0.18, 0.11], crouch: 0.04, load: 0, track: 0.6,
    source: 'HILDEBRAND 1977, MUYBRIDGE 1887',
  },
  gallop: {
    beats: 4, aerial: 1, symmetric: false,
    // transverse, right lead: the trailing hind, the leading hind, the trailing fore, the leading fore, then the one
    // suspension (MUYBRIDGE 1887); at racing speed mostly one hoof down at a time (WITTE 2006)
    feet: { LH: 0, RH: 0.16, LF: 0.33, RF: 0.49 },
    speed: [9.0, 18.0], preferred: 15.0,
    f: [1.95, 0.02], duty: [0.34, -0.009],                            // 2.25 Hz, 6.7 m and 0.21 at 15 m/s (WITTE 2006)
    lift: [0.24, 0.20], crouch: 0.07, load: 0, track: 0.4,
    source: 'HILDEBRAND 1977, MUYBRIDGE 1887, WITTE 2006',
  },
  reinBack: {
    beats: 2, aerial: 0, symmetric: true, backward: true,
    feet: { LH: 0, RF: 0, RH: 0.5, LF: 0.5 },                         // a diagonal two-beat, going backwards
    speed: [-0.8, -0.3], preferred: -0.5,
    f: [0.8, 0], duty: [0.62, 0],
    lift: [0.07, 0.06], crouch: 0.01, load: 0, track: 0.95,
    source: 'BACK & CLAYTON 2013',
  },
});

/**
 * The limbs' passive mechanics (BACK & CLAYTON 2013), the laws the solver poses rather than keys:
 *  - FETLOCK: the suspensory apparatus lets the fetlock sink under the load, stiffening as it goes: the pastern's slope
 *    flattens by `drop·(1 − e^(−F/F0))` degrees for a vertical force F in body weights (≈, set so the trot's fore
 *    fetlock reaches ≈ 55-60° past straight and the gallop's ≈ 65-75°, BACK 1995, WITTE 2006).
 *  - SCAPULA: no collarbone; the blade rotates on the thoracic sling about a point in its upper third, by `scapula`
 *    of the limb's swing (≈ 0.45: ≈ 20° of blade for ≈ 45° of limb at the trot).
 *  - RECIPROCAL: the hind's stifle and hock flex together (the peroneus tertius and the superficial digital flexor),
 *    the hock by `reciprocal` of the stifle's change (≈ 1).
 *  - CARPUS: the knee locks straight while loaded and folds only in the swing.
 *  - BREAKOVER: the heel lifts and the hoof rolls over its toe at the end of the stance, over `breakover` of it, to
 *    `breakoverPitch` degrees at lift-off (≈).
 */
export const MECHANICS = Object.freeze({
  fetlock: { fore: { drop: 50, F0: 1.0 }, hind: { drop: 44, F0: 1.0 } },
  scapula: 0.45,
  reciprocal: 1.0,
  breakover: 0.18,
  breakoverPitch: 40,
});

/**
 * The swing's fold: how far each free joint flexes at the height of the swing, per gait (degrees past its stance
 * angle, ≈ BACK 1995 at the trot, scaled for the others from the plates), and `peak`, where in the swing it peaks.
 */
export const HIND_FETLOCK = 0.65;
export const FOLD = Object.freeze({
  walk:     { carpus: 65, fetlock: 45, peak: 0.42 },
  trot:     { carpus: 85, fetlock: 55, peak: 0.40 },
  canter:   { carpus: 95, fetlock: 60, peak: 0.40 },
  gallop:   { carpus: 105, fetlock: 65, peak: 0.38 },
  reinBack: { carpus: 40, fetlock: 30, peak: 0.50 },
});

/**
 * The ranges a gate holds the joints to through a gait at its PREFERRED speed (degrees; a collected or extended gait
 * folds less or more). Fetlock: extension past the cannon's line at its
 * deepest in the stance. Carpus: flexion at its height in the swing. Hock: its least angle (the most flexed) through
 * the stride. Scapula: its swing over the stride. All ≈, from BACK 1995 (trot) and BACK & CLAYTON 2013.
 */
export const RANGES = Object.freeze({
  walk:   { fetlockFore: [30, 50], carpus: [50, 80], hockMin: [110, 150], scapula: [10, 25] },
  trot:   { fetlockFore: [45, 65], carpus: [70, 100], hockMin: [100, 140], scapula: [14, 30] },
  canter: { fetlockFore: [50, 72], carpus: [80, 110], hockMin: [95, 135], scapula: [15, 34] },
  gallop: { fetlockFore: [58, 82], carpus: [90, 120], hockMin: [85, 130], scapula: [18, 40] },
});

/** The head and neck: a damped pendulum on the withers (≈, tuned against the plates' nod; `gain` the active share). */
export const NECK = Object.freeze({
  omega: 2 * Math.PI * 1.6, zeta: 0.6,
  gain: { walk: 2.6, trot: 0.6, canter: 0.55, gallop: 0.8, reinBack: 0.5 },
  headCounter: 0.5,        // the head turns back by half the neck's swing (the eyes held steadier)
});

/** The back: the lumbosacral joint rounds as the hinds reach forward (degrees of pelvis per degree of hind swing). */
export const LUMBOSACRAL = Object.freeze({ walk: 0.08, trot: 0.06, canter: 0.18, gallop: 0.28, reinBack: 0.05 });

/**
 * The sideways mechanics (≈, set against the plates seen from the front and the record's few-degree pelvic roll at the
 * walk): the girdles' roll as a damped oscillator driven by their pair's load difference (`gain` rad/s² per body
 * weight; the withers roll less than the pelvis), the neck's sideways swing on the body's sway, the swinging hoof's inward arc at mid-swing (m).
 */
export const LATERAL = Object.freeze({
  roll: { omega: 2 * Math.PI * 1.2, zeta: 0.7, gain: { fore: 3.5, hind: 6 } },
  neck: { gain: 0.8, r: 0.45 },
  swingIn: 0.012,
});
