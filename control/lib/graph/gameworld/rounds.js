// gameworld/rounds — what an eye sees of a small arm going off: the ROUND a weapon fires, in the sim register. A gun's
// `round` (worlds/controllable/combat-ranged.js initWeapon) is opt-in: with it the page draws a shot as small arms look
// (scene/channels/controllable: a muzzle flash about a hand's length, gone in a frame or two, a wisp of smoke, the round
// a faint streak at its own speed, a pinch of dust where it strikes); without it, the glowing bolt and the burst a mech's
// beam rifle wants, as before.
//
//   speed  the round's speed at the muzzle (m/s; its streak crosses the gap at it: a rifle's 30 m in two frames)
//   flash  the muzzle flash's length (m): a pistol's a palm, a rifle's a hand, a shotgun's and a magnum's longer
//
// Magnitudes by cartridge class (subsonic to full-power rifle), never one maker's figures.
export const ROUNDS = Object.freeze({
  pistol: Object.freeze({ speed: 360, flash: 0.09 }),
  magnum: Object.freeze({ speed: 440, flash: 0.15 }),
  smg: Object.freeze({ speed: 390, flash: 0.1 }),
  rifle: Object.freeze({ speed: 880, flash: 0.14 }),
  marksman: Object.freeze({ speed: 830, flash: 0.17 }),
  sniper: Object.freeze({ speed: 850, flash: 0.2 }),
  shotgun: Object.freeze({ speed: 400, flash: 0.22 }),
});

/** A gun's round as its weapon carries it (a fresh object: a weapon is the world's to change). */
export const roundOf = (word) => (ROUNDS[word] ? { ...ROUNDS[word] } : null);
