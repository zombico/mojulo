/**
 * mecha-backpacks — the backpacks' ODM: a frame's back fitted for a function, not for heavy arms (the giant arm pack's
 * cousin): a backpack card over the inventory's rows, the bodies and joints it adds to the frame, its own laws. Pure data
 * and a layout factory.
 *
 *   MECHA_BACKPACKS   a backpack (a frame offers those it takes: its archetype's `backpacks`):
 *     sku             its frame (the power pack's place on the pelvis)
 *     mounts          the sides it carries a payload on ('r', 'l'), each a mount's ring and cradle
 *     takes           the payloads its mounts take (MECHA_WEAPONS), its own loadout by default
 *     tail            its service tail (a scorpion's: a yaw base, two segments and a head on rotary drives) and the
 *                     service points it reaches: each payload's magazine, each spare in its rack, the drop behind
 *     mass            what it adds to the class's mass with its own loadout (kg); swap, the frame's parts it asks
 *                     heavier (a sku for a sku)
 *     brace           the stance it fires from (a `brace` stance on the frame: the recoil law reads it there)
 *     laws            the bands it adds (mecha-laws.js: tailTorque, recoil, backblast, fireClear)
 *   MECHA_WEAPONS     a payload on a mount: its sku, its spare magazine's, its magazine's mass, its sustained recoil
 *                     (N), its backblast's reach behind its breech (m). Generic and invented, no real weapon's
 *   TAIL_POSES        the tail's named poses: stow (tucked down the pack's back), or a service point it reaches down onto
 *   backpackLayout(card, loadout) → { layout, joints, tail, payloads }: what a frame adds carrying it
 */

export const MECHA_WEAPONS = Object.freeze({
  minigun: Object.freeze({ sku: 'minigun-wpn', spare: 'ammobox-wpn', label: 'rotary machine gun', mag: 'ammunition box', magMass: 30, recoil: 1200, backblast: 0 }),
  rocketPod: Object.freeze({ sku: 'rockets-wpn', spare: 'rocketpod-wpn', label: 'five-round rocket launcher', mag: 'five-round rocket pod', magMass: 50, recoil: 150, backblast: 2.5 }),
});
export const MECHA_WEAPON_IDS = Object.freeze(Object.keys(MECHA_WEAPONS));

export const MECHA_BACKPACKS = Object.freeze({
  weapons: Object.freeze({
    label: 'weapons backpack', sku: 'pack-wpn', mounts: Object.freeze(['r', 'l']),
    takes: Object.freeze(['minigun', 'rocketPod']), loadout: Object.freeze({ r: 'minigun', l: 'rocketPod' }),
    tail: Object.freeze({ base: 'tailbase-wpn', seg1: 'tailseg1-wpn', seg2: 'tailseg2-wpn', head: 'tailhead-wpn' }),
    mass: 340,
    // (braced to fire: crouched, the left foot set back behind the hips, the recoil's lever shortened and its weight's
    // to its heels lengthened, as a gunner braces)
    brace: Object.freeze({ knee: 75, feet: Object.freeze({ r: Object.freeze({ y: 0.12 }), l: Object.freeze({ y: -0.42 }) }) }),
    // (the frame's parts it asks heavier: its hip roll rams, for its sway on one foot with the pack on)
    swap: Object.freeze({ 'ram-roll-fw': 'ram-roll-fw-hd' }),
    // (laden, a foot is set down a little lower than the bare frame's: its step's band from there)
    laws: Object.freeze({ step: Object.freeze([0.3, 1]), tailTorque: Object.freeze([0, 0.8]), recoil: Object.freeze([0, 0.6]), backblast: Object.freeze([0.3, 9]), fireClear: Object.freeze([0.1, 9]) }),
  }),
});
export const MECHA_BACKPACK_IDS = Object.freeze(Object.keys(MECHA_BACKPACKS));

/** The tail's poses: `joints` held as they are, or a service point (`at`: body.hardpoint) reached from above, the head
 *  `approach` degrees from straight down toward ahead, `carry` a magazine held in its grip as it does. */
export const TAIL_POSES = Object.freeze({
  // (tucked down the bay's back until it is wanted: turned to the rear, its root segment raked back clear of the bay's top
  // edge, its outer segment folded down against the bay, its head hanging)
  stow: Object.freeze({ joints: Object.freeze({ tailYaw: 180, tailPitch: 60, tailElbow: -85, tailWrist: 25 }) }),
  reloadR: Object.freeze({ at: 'weaponR.mag', approach: 0, carry: 'r' }),
  reloadL: Object.freeze({ at: 'weaponL.mag', approach: 0, carry: 'l' }),
  fetchR: Object.freeze({ at: 'spareR.lug', approach: 0, carry: 'r' }),
  fetchL: Object.freeze({ at: 'spareL.lug', approach: 0, carry: 'l' }),
  drop: Object.freeze({ at: 'pack.drop', approach: 0, carry: 'l' }),
});

const F = Object.freeze;
/** The bodies and joints a backpack adds to a frame, its payloads by side (their cards). */
export function backpackLayout(card, loadout) {
  const layout = [], joints = {}, payloads = {};
  for (const S of card.mounts) {
    const U = S.toUpperCase(), W = MECHA_WEAPONS[loadout[S]];
    payloads[S] = W;
    joints[`traverse${U}`] = F({ kind: 'slew', drive: `mount${U}` });
    joints[`elevate${U}`] = F({ kind: 'hinge', drive: `cradle${U}` });
    layout.push(
      { id: `mount${U}`, sku: 'mount-wpn', side: S, on: `pack.mount.${S}`, joint: `traverse${U}` },
      { id: `cradle${U}`, sku: 'cradle-wpn', side: S, on: `mount${U}.cradle`, joint: `elevate${U}` },
      { id: `weapon${U}`, sku: W.sku, side: S, on: `cradle${U}.gun` },
      { id: `spare${U}`, sku: W.spare, side: S, on: `pack.spare.${S}` },
    );
  }
  const T = card.tail;
  Object.assign(joints, {
    tailYaw: F({ kind: 'slew', drive: 'tailBase' }),
    tailPitch: F({ kind: 'hinge', drive: 'tailSeg1' }),
    tailElbow: F({ kind: 'hinge', drive: 'tailSeg2' }),
    tailWrist: F({ kind: 'hinge', drive: 'tailHead' }),
  });
  layout.push(
    { id: 'tailBase', sku: T.base, on: 'pack.tail', joint: 'tailYaw', tail: true },
    { id: 'tailSeg1', sku: T.seg1, on: 'tailBase.pivot', joint: 'tailPitch', tail: true },
    { id: 'tailSeg2', sku: T.seg2, on: 'tailSeg1.end', joint: 'tailElbow', tail: true },
    { id: 'tailHead', sku: T.head, on: 'tailSeg2.end', joint: 'tailWrist', tail: true },
  );
  const tail = F({ base: 'tailBase', seg1: 'tailSeg1', seg2: 'tailSeg2', head: 'tailHead', joints: F({ yaw: 'tailYaw', pitch: 'tailPitch', elbow: 'tailElbow', wrist: 'tailWrist' }) });
  return { layout: layout.map(F), joints: F(joints), tail, payloads: F(payloads) };
}
