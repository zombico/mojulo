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
 *                     service points it reaches: each payload's magazine, each spare in its rack, the drop behind;
 *                     `twin`, a tail each side, each serving its own side's payload; mount, cradle, its mounts' skus
 *     mass            what it adds to the class's mass with its own loadout (kg); swap, the frame's parts it asks
 *                     heavier (a sku for a sku)
 *     lean            how far its frame stands its hips ahead of its feet (m): a backpack whose weight rides behind, its
 *                     centre of mass carried back over the feet
 *     brace           the stance it fires from (a `brace` stance on the frame: the recoil law reads it there)
 *     laws            the bands it adds (mecha-laws.js: tailTorque, recoil, backblast, fireClear)
 *   MECHA_WEAPONS     a payload on a mount: its sku, its spare magazine's, its magazine's mass, its sustained recoil
 *                     (N), its backblast's reach behind its breech (m). Generic and invented, no real weapon's
 *                     A payload that fires nothing (`fires: false`: a sensor mast, a cargo carrier, a winch) has no line
 *                     of fire; its magazine is what its tail swaps all the same (a battery, a crate, a cable reel)
 *   MECHA_ROLES       a frame's roles: a loadout each (its backpack, its payloads by mount, the cabin it asks), as the
 *                     civilian worker's tasks are its site's (`role`, mecha-shelf/index.js composeFrame)
 *   TAIL_POSES        the tail's named poses: stow (tucked down the pack's back), or a service point it reaches down onto
 *   backpackLayout(card, loadout) → { layout, joints, tail, payloads }: what a frame adds carrying it
 */

export const MECHA_WEAPONS = Object.freeze({
  minigun: Object.freeze({ sku: 'minigun-wpn', spare: 'ammobox-wpn', label: 'rotary machine gun', mag: 'ammunition box', magMass: 30, recoil: 1200, backblast: 0 }),
  // (its recoil what its muzzle brake leaves)
  autocannon: Object.freeze({ sku: 'cannon-wpn', spare: 'cannonmag-wpn', label: 'autocannon', mag: 'box magazine', magMass: 40, recoil: 1600, backblast: 0 }),
  // (its recoil what its long-recoil mechanism (a stroke of some 1.4 m) and its muzzle brake leave of a shell's kick)
  howitzer: Object.freeze({ sku: 'howitzer-sw', spare: 'shellmag-sw', label: 'howitzer', mag: 'six-round shell cassette', magMass: 600, recoil: 65000, backblast: 0 }),
  missiles: Object.freeze({ sku: 'missiles-sw', spare: 'missilepod-sw', label: 'eighteen-cell missile launcher', mag: 'six-cell missile pod', magMass: 700, recoil: 8000, backblast: 8 }),
  rocketPod: Object.freeze({ sku: 'rockets-wpn', spare: 'rocketpod-wpn', label: 'five-round rocket launcher', mag: 'five-round rocket pod', magMass: 50, recoil: 150, backblast: 2.5 }),
  // (the functional payloads: what a frame carries to watch, to screen, to defend, to supply and to recover; a payload
  // that fires nothing, `fires: false`, has no line of fire to keep clear; its magazine what its tail hot-swaps all the same)
  // (a telescoping mast, an electro-optical ball and a radar panel at its head; its battery cassette swapped on a long watch)
  sensorMast: Object.freeze({ sku: 'sensor-wpn', spare: 'battery-wpn', label: 'sensor mast', mag: 'battery cassette', magMass: 25, recoil: 0, backblast: 0, fires: false }),
  // (four small rotor drones in a cassette of cells, launched ahead; a fresh cassette swapped in)
  droneLauncher: Object.freeze({ sku: 'drones-wpn', spare: 'dronecase-wpn', label: 'four-drone launcher', mag: 'four-drone cassette', magMass: 40, recoil: 60, backblast: 0 }),
  // (eight discharger cups fanned up and out: a screen of smoke ahead of it)
  smoke: Object.freeze({ sku: 'smoke-wpn', spare: 'smokecase-wpn', label: 'smoke discharger', mag: 'eight-cup cassette', magMass: 20, recoil: 250, backblast: 0 }),
  // (four light anti-air missiles in a pod, its tubes' backblast behind it)
  aaMissiles: Object.freeze({ sku: 'aam-wpn', spare: 'aampod-wpn', label: 'four-cell anti-air launcher', mag: 'four-cell missile pod', magMass: 60, recoil: 500, backblast: 4 }),
  // (a basket on the cradle, a supply crate strapped in it: the tail hands crates down to the drop behind)
  cargo: Object.freeze({ sku: 'cargo-wpn', spare: 'crate-wpn', label: 'cargo carrier', mag: 'supply crate', magMass: 45, recoil: 0, backblast: 0, fires: false }),
  // (a recovery winch: its drum a cable reel swapped whole, its fairlead ahead, its hook)
  winch: Object.freeze({ sku: 'winch-wpn', spare: 'reel-wpn', label: 'recovery winch', mag: 'cable reel', magMass: 40, recoil: 0, backblast: 0, fires: false }),
});
export const MECHA_WEAPON_IDS = Object.freeze(Object.keys(MECHA_WEAPONS));

const MECHA_BACKPACKS_MUT = {
  weapons: Object.freeze({
    label: 'weapons backpack', sku: 'pack-wpn', mounts: Object.freeze(['r', 'l']),
    takes: Object.freeze(['minigun', 'rocketPod', 'smoke']), loadout: Object.freeze({ r: 'minigun', l: 'rocketPod' }),
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
};
// (its heavier sibling: the same frame and tail, a heavier gun on its right mount; the rover walker carries it as built)
MECHA_BACKPACKS_MUT.heavyWeapons = Object.freeze({
  ...MECHA_BACKPACKS_MUT.weapons, label: 'heavy weapons backpack',
  takes: Object.freeze(['autocannon', 'minigun', 'rocketPod', 'smoke']), loadout: Object.freeze({ r: 'autocannon', l: 'rocketPod' }),
  mass: 360, swap: Object.freeze({}),
});
// (the siege backpack: the weapons backpack's frame at 2.5 times, a howitzer right and a missile launcher left, a
// scorpion's tail each side to serve them; the siege walker carries it as built)
MECHA_BACKPACKS_MUT.siege = Object.freeze({
  ...MECHA_BACKPACKS_MUT.weapons, label: 'siege backpack', sku: 'pack-sw', mount: 'mount-sw', cradle: 'cradle-sw', twin: true,
  takes: Object.freeze(['howitzer', 'missiles']), loadout: Object.freeze({ r: 'howitzer', l: 'missiles' }),
  tail: Object.freeze({ base: 'tailbase-sw', seg1: 'tailseg1-sw', seg2: 'tailseg2-sw', head: 'tailhead-sw' }),
  mass: 0, swap: Object.freeze({}),
});
// (the functional backpacks: the weapons backpack's frame, its pylons, its racks and its tail, fitted for a function)
// (to watch and to look beyond: a sensor mast, drones, smoke to break contact)
MECHA_BACKPACKS_MUT.recon = Object.freeze({
  ...MECHA_BACKPACKS_MUT.weapons, label: 'reconnaissance backpack',
  takes: Object.freeze(['sensorMast', 'droneLauncher', 'smoke']), loadout: Object.freeze({ r: 'sensorMast', l: 'droneLauncher' }), mass: 280, lean: 0.06,
});
// (to supply and to recover: cargo carriers whose crates its tail hands down, a recovery winch, smoke to cover it)
MECHA_BACKPACKS_MUT.support = Object.freeze({
  ...MECHA_BACKPACKS_MUT.weapons, label: 'logistics backpack',
  takes: Object.freeze(['cargo', 'winch', 'smoke']), loadout: Object.freeze({ r: 'cargo', l: 'cargo' }), mass: 300, lean: 0.1,
});
// (to defend against what flies: anti-air missiles, a sensor mast to find their targets, a rotary gun close in)
MECHA_BACKPACKS_MUT.airDefence = Object.freeze({
  ...MECHA_BACKPACKS_MUT.weapons, label: 'air defence backpack',
  takes: Object.freeze(['aaMissiles', 'sensorMast', 'minigun']), loadout: Object.freeze({ r: 'aaMissiles', l: 'sensorMast' }), mass: 320,
});
// (the brood walker's solar backpack in its abdomen's place: no mounts and no tail, its array folded inside under two
// wing covers; deployed (its `deploy` stance), the covers open out and down, the mast rises and the wings spread flat)
MECHA_BACKPACKS_MUT.solar = Object.freeze({
  label: 'solar backpack', sku: 'solar-bw', mounts: Object.freeze([]), takes: Object.freeze([]), loadout: Object.freeze({}), mass: 0,
  array: Object.freeze({ lid: 'elytron-bw', mast: 'mast-bw', panel: 'panel-bw', panels: 4, travel: 1.4, open: 150 }),
  stances: Object.freeze({ deploy: Object.freeze({ height: 'stand', deploy: true }) }),
  laws: Object.freeze({ solarArea: Object.freeze([8, 40]) }),
});
export const MECHA_BACKPACKS = Object.freeze(MECHA_BACKPACKS_MUT);
export const MECHA_BACKPACK_IDS = Object.freeze(Object.keys(MECHA_BACKPACKS));

/**
 * The roles a frame is fitted for, as the civilian worker's tasks are for its site: a loadout each, a backpack and its
 * payloads by mount, and the cabin it asks when the frame offers it. A frame takes a role whose backpack it offers, or
 * whose payloads its own backpack takes (its backpack carried as built, rearmed); the operator's own `backpack`,
 * `weapons` and `cabin` over it.
 */
const role = (label, backpack, r, l, cabin) => Object.freeze({ label, backpack, weapons: Object.freeze({ r, l }), ...(cabin ? { cabin } : {}) });
export const MECHA_ROLES = Object.freeze({
  assault: role('assault: a rotary machine gun to suppress, rockets to break cover', 'weapons', 'minigun', 'rocketPod', 'armoured'),
  escort: role('escort: a rotary machine gun, smoke to screen what it escorts', 'weapons', 'minigun', 'smoke', 'armoured'),
  fireSupport: role('fire support: an autocannon and rockets from behind the line', 'heavyWeapons', 'autocannon', 'rocketPod', 'armoured'),
  recon: role('reconnaissance: a sensor mast to watch, drones to look beyond it', 'recon', 'sensorMast', 'droneLauncher'),
  screening: role('screening: drones to spot, smoke to hide the advance', 'recon', 'smoke', 'droneLauncher'),
  airDefence: role('air defence: anti-air missiles, a sensor mast to find their targets', 'airDefence', 'aaMissiles', 'sensorMast', 'armoured'),
  resupply: role('resupply: two cargo carriers, their crates handed down by its tail', 'support', 'cargo', 'cargo'),
  recovery: role('recovery: a winch to pull a stuck frame free, a crate of spares', 'support', 'winch', 'cargo'),
  // (the siege walker's as it is built)
  bombardment: role('bombardment: a howitzer and a missile launcher', 'siege', 'howitzer', 'missiles'),
});
export const MECHA_ROLE_IDS = Object.freeze(Object.keys(MECHA_ROLES));

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
/** A solar backpack's array: its wing covers, its mast, its wings of panels z-folded (`at`), spread to `deploy`. */
function arrayLayout(card) {
  const A = card.array, joints = {}, layout = [];
  for (const [S, s] of [['r', 1], ['l', -1]]) {
    const U = S.toUpperCase();
    joints[`cover${U}`] = F({ kind: 'hinge', axis: F([0, 1, 0]), drive: `cover${U}`, when: F({ deploy: s * A.open }) });
    layout.push({ id: `cover${U}`, sku: A.lid, side: S, on: `pack.cover.${S}`, joint: `cover${U}` });
  }
  joints.mast = F({ kind: 'slide', axis: F([0, 0, 1]), travel: A.travel, when: F({ deploy: A.travel }) });
  layout.push({ id: 'mast', sku: A.mast, on: 'pack.mast', joint: 'mast' });
  for (const [S, s] of [['r', 1], ['l', -1]]) {
    const U = S.toUpperCase();
    for (let i = 1; i <= A.panels; i++) {
      // (stowed: the first panel hung down from the mast's head, each next folded back on the one before, a z)
      const rest = s * (i === 1 ? 90 : i % 2 ? 180 : -180);
      joints[`panel${U}${i}`] = F({ kind: 'hinge', axis: F([0, 1, 0]), drive: `panel${U}${i}`, at: rest, when: F({ deploy: 0 }) });
      layout.push({ id: `panel${U}${i}`, sku: A.panel, side: S, on: i === 1 ? `mast.wing.${S}` : `panel${U}${i - 1}.end`, joint: `panel${U}${i}` });
    }
  }
  return { layout: layout.map(F), joints: F(joints), tail: null, payloads: F({}) };
}

/** The bodies and joints a backpack adds to a frame, its payloads by side (their cards). */
export function backpackLayout(card, loadout) {
  if (card.array) return arrayLayout(card);
  const layout = [], joints = {}, payloads = {};
  for (const S of card.mounts) {
    const U = S.toUpperCase(), W = MECHA_WEAPONS[loadout[S]];
    payloads[S] = W;
    joints[`traverse${U}`] = F({ kind: 'slew', drive: `mount${U}` });
    joints[`elevate${U}`] = F({ kind: 'hinge', drive: `cradle${U}` });
    layout.push(
      { id: `mount${U}`, sku: card.mount ?? 'mount-wpn', side: S, on: `pack.mount.${S}`, joint: `traverse${U}` },
      { id: `cradle${U}`, sku: card.cradle ?? 'cradle-wpn', side: S, on: `mount${U}.cradle`, joint: `elevate${U}` },
      { id: `weapon${U}`, sku: W.sku, side: S, on: `cradle${U}.gun` },
      { id: `spare${U}`, sku: W.spare, side: S, on: `pack.spare.${S}` },
    );
  }
  const T = card.tail;
  // (twin tails: one each side, each serving its side's payload, its spare and the drop behind)
  if (card.twin) {
    const tails = {};
    for (const S of card.mounts) {
      const U = S.toUpperCase(), n = (w) => `${w}${U}`;
      Object.assign(joints, {
        [n('tailYaw')]: F({ kind: 'slew', drive: n('tailBase') }), [n('tailPitch')]: F({ kind: 'hinge', drive: n('tailSeg1') }),
        [n('tailElbow')]: F({ kind: 'hinge', drive: n('tailSeg2') }), [n('tailWrist')]: F({ kind: 'hinge', drive: n('tailHead') }),
      });
      layout.push(
        { id: n('tailBase'), sku: T.base, side: S, on: `pack.tail.${S}`, joint: n('tailYaw'), tail: true },
        { id: n('tailSeg1'), sku: T.seg1, side: S, on: `${n('tailBase')}.pivot`, joint: n('tailPitch'), tail: true },
        { id: n('tailSeg2'), sku: T.seg2, side: S, on: `${n('tailSeg1')}.end`, joint: n('tailElbow'), tail: true },
        { id: n('tailHead'), sku: T.head, side: S, on: `${n('tailSeg2')}.end`, joint: n('tailWrist'), tail: true },
      );
      tails[S] = F({ base: n('tailBase'), seg1: n('tailSeg1'), seg2: n('tailSeg2'), head: n('tailHead'), joints: F({ yaw: n('tailYaw'), pitch: n('tailPitch'), elbow: n('tailElbow'), wrist: n('tailWrist') }) });
    }
    return { layout: layout.map(F), joints: F(joints), tail: null, tails: F(tails), payloads: F(payloads) };
  }
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
