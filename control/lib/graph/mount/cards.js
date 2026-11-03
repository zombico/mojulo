/**
 * cards — the mounts as data, and the registers a mount is drawn in. A new mount is a card; a new look is a register.
 *
 * A card is the mount's BUILD at its standing pose, in its body frame: metres, +y its front, +z up, the centre of
 * mass at y = 0 over the ground, every trunk landmark [y, z] on the mid-plane; the limbs as bone lengths (a limb's
 * standing angles are solved, never authored); the hooves where they stand (`hoofY` fore-aft, `hoofX` out from the
 * mid-plane), and each girdle's joint out from it (`girdleX`: the scapula's pivot on the ribs, the hip joint). The gait solver reads nothing else.
 *
 * THE HORSE — a light riding horse of 16 hands, the reference the gaits were measured on (reference.js). The masses:
 * the withers at 1.63 m; the hip joint at 1.32 m; the forehand carrying 58 % (the hooves 1.20 m apart either side of
 * the centre of mass in that share); the scapula sloping at 57° from a pivot a third of the way down it; the neck's
 * base low in front of the shoulder (C7 at the point of the shoulder's height), its S rising to the poll; the head
 * carried 42° off the vertical. Bone lengths after the general record of the light horse (BACK & CLAYTON 2013):
 * humerus 0.30, radius 0.37, knee and cannon 0.32, pasterns 0.155; femur 0.43, tibia 0.38, hock and cannon 0.37.
 *
 * REGISTERS — `realistic` is the card as measured. `stylized` balances a read for animation against the mechanics:
 * a bigger head and ears, a shorter neck, legs a little shorter and hooves a little bigger, the motion's heave, nod,
 * fold and lift exaggerated. Its gaits stay mechanically true for its own legs: the solver scales every stride, speed
 * and frequency to the build's hip height by dynamic similarity, so a shorter-legged mount takes shorter, quicker
 * strides at the same Froude number, never the reference horse's strides on shorter legs.
 */

export const MOUNTS = Object.freeze({
  horse: Object.freeze({
    name: 'a riding horse',
    trunk: Object.freeze({
      com: [0, 1.15],
      withers: [0.30, 1.63], back: [0.02, 1.54], loin: [-0.30, 1.54], lumbosacral: [-0.40, 1.47],
      croup: [-0.60, 1.60], buttock: [-0.86, 1.32], tailRoot: [-0.80, 1.46],
      scapulaPivot: [0.40, 1.33], hip: [-0.66, 1.32],
      // the neck from its base (C7) to the poll, an S: the lower neck runs forward, the upper rises
      neck: [[0.58, 1.20], [0.70, 1.33], [0.79, 1.50], [0.87, 1.65], [0.95, 1.77], [1.02, 1.86]],
    }),
    scapula: Object.freeze({ length: 0.42, slope: 57, pivot: 1 / 3 }),
    head: Object.freeze({ length: 0.60, carriage: 42, ear: 0.16, jaw: 0.38 }),
    tail: Object.freeze({ dock: 0.45, hair: 0.62 }),
    fore: Object.freeze({ girdleX: 0.17, hoofX: 0.13, humerus: 0.30, radius: 0.37, cannon: 0.32, pastern: 0.155, hoofY: 0.48, slope: 55 }),
    hind: Object.freeze({ girdleX: 0.19, hoofX: 0.14, femur: 0.43, tibia: 0.38, cannon: 0.37, pastern: 0.155, hoofY: -0.66, slope: 57, hock: 30 }),
    // the hoof about its coffin joint, flat on the ground: the toe, the heel (the ground at -coffin)
    hoof: Object.freeze({ toe: 0.08, heel: -0.05, coffin: 0.065 }),
    // where the tack and the rider will hang (the next spike), carried by every clip from the start
    // (the saddle's seat on the back over T12-T14; the bit at the mouth's bars, a share along the head)
    sockets: Object.freeze({ saddle: [0.05, 1.58], bit: 0.8 }),
  }),
});

/** The registers: proportion multipliers (the build) and motion multipliers (the solver). */
export const REGISTERS = Object.freeze({
  realistic: Object.freeze({ head: 1, ear: 1, neck: 1, leg: 1, hoof: 1, motion: Object.freeze({ heave: 1, nod: 1, fold: 1, lift: 1 }) }),
  stylized: Object.freeze({ head: 1.25, ear: 1.5, neck: 0.9, leg: 0.88, hoof: 1.25, motion: Object.freeze({ heave: 1.25, nod: 1.35, fold: 1.1, lift: 1.1 }) }),
});

export const mountWords = () => Object.keys(MOUNTS);
export const registerWords = () => Object.keys(REGISTERS);
