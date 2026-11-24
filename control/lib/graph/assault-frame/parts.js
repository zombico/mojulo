/**
 * THE ASSAULT FRAME'S PARTS — a frame is built from parts, one in each slot, and its numbers are its parts' (assemble.js
 * reads them). The structure: a CORE (the fuselage, the cockpit inside it, the generator and the FCS fitted in it), a
 * HEAD on it, two ARMS on its shoulders (each hand holds an arm weapon), LEGS under it, a BOOSTER on its back, and two
 * shoulder mounts beside the booster (each carries a back weapon). Realistic military, a hundred and fifty years on,
 * built for space: the class (light, medium, heavy) and the parts' look are the body's (body.js); the numbers are here.
 *
 * A part is a row. A new part is a row: its slot, its class, its numbers. Units: kg, metres, seconds, m/s; EN is the
 * generator's energy, in points.
 *
 *   head       ap, weight; sensor (m: the lock's reach is the FCS's, a head lengthens it by this). A core that is
 *              `headless` (its cockpit and sensors in a forward fuselage) takes none: the slot null, its `sensor` the core's
 *   core       ap, weight; size the body's girth (1 a medium core); headless (a forward fuselage: no head), sensor
 *   arms       ap, weight; aim (rad/s: how fast the arms come round onto a lock), recoil (a heavy arm steadies a gun: 0..1)
 *   legs       ap, weight; joint 'reverse' (the knee bent back) or a biped's; load (kg the legs carry before they are overweight), walk (m/s), jump (m/s up off the
 *              ground), land (s the legs take a hard landing in), height (m of the hips over the ground)
 *   booster    weight; boost (m/s, a skate's speed at its rated mass), rated (kg), qb (m/s of a quick boost), qbTime (s),
 *              qbCool (s), lift (m/s² up while ascending, over the world's gravity), cost { boost, qb, ascend } (EN a
 *              second, a quick boost's, a second)
 *   generator  weight; en (capacity), regen (EN a second), delay (s after a draw before it regenerates), out (s it waits
 *              when emptied, the frame's boost shut till then)
 *   fcs        weight; lock (s to lock a target), range (m), cone (degrees round the aim), locks (missile locks at once)
 *   arm weapon weight; fire 'auto' | 'semi' | 'charge'; damage, rof (rounds a second) or cooldown (s), mag, reload (s),
 *              speed (m/s of the round), range (m), splash (m), stagger (0..1 of a target's poise per hit), energy (EN a
 *              shot, from the generator: an energy weapon), pellets (a shotgun's)
 *   back weapon as an arm weapon's; homing (rad/s a missile turns at, locked), salvo (missiles a trigger)
 *
 *   PARTS                       { <slot>: { <id>: row } }
 *   SLOTS, WEAPON_SLOTS         the slots, and the four a frame's weapons ride in (armR, armL, backR, backL)
 *   partOf(slot, id)            → the row (with its id), or throws naming the slot's parts
 *   STOCK                       the stock frames, a build each: what a mission starts the pilot in, and what it fights
 */

const f = Object.freeze;
const row = (o) => f(o);

export const SLOTS = f(['head', 'core', 'arms', 'legs', 'booster', 'generator', 'fcs']);
export const WEAPON_SLOTS = f(['armR', 'armL', 'backR', 'backL']);

export const PARTS = f({
  head: f({
    'hd-sentinel': row({ name: 'Sentinel', class: 'medium', ap: 1800, weight: 3200, sensor: 0, about: 'a standard head: a visor slit, a sensor bar, the antennas swept back' }),
    'hd-lancet': row({ name: 'Lancet', class: 'light', ap: 1100, weight: 2000, sensor: -60, about: 'a narrow wedge, one long optic, light and quick' }),
    'hd-bulwark': row({ name: 'Bulwark', class: 'heavy', ap: 2700, weight: 4900, sensor: 120, about: 'an armoured dome, its sensors behind shutters' }),
  }),
  core: f({
    'cr-vanguard': row({ name: 'Vanguard', class: 'medium', ap: 9500, weight: 15500, size: 1, about: 'a medium core: a chest of layered plate over the cockpit block, intakes at the sides' }),
    'cr-raptor': row({ name: 'Raptor', class: 'light', ap: 6800, weight: 11000, size: 0.86, about: 'a slim core, its chest cut back for the arms\' reach' }),
    // (a forward fuselage: the cockpit and its sensors carried in a prow ahead of the shoulders, so the frame wears no head)
    'cr-prow': row({ name: 'Prow', class: 'medium', ap: 10400, weight: 16800, size: 1, headless: true, sensor: 60, about: 'a forward fuselage: a long armoured prow ahead of the shoulders carrying the cockpit under a narrow canopy, its optics in a chin turret beneath it; no head' }),
    'cr-citadel': row({ name: 'Citadel', class: 'heavy', ap: 13200, weight: 21500, size: 1.16, about: 'a broad heavy core, its chest a slab of armour, its collar high round the head' }),
  }),
  arms: f({
    'ar-standard': row({ name: 'Standard', class: 'medium', ap: 4200, weight: 9800, aim: 4.5, recoil: 0.5, about: 'standard arms: armoured upper arms, the forearms boxed round their actuators' }),
    'ar-light': row({ name: 'Light', class: 'light', ap: 2900, weight: 6800, aim: 6.5, recoil: 0.3, about: 'light arms: slim, quick onto a lock, a gun kicks them' }),
    'ar-heavy': row({ name: 'Heavy', class: 'heavy', ap: 5900, weight: 13600, aim: 3.2, recoil: 0.8, about: 'heavy arms: shouldered with armour, slow round, steady under a heavy gun' }),
  }),
  legs: f({
    'lg-medium': row({ name: 'Biped M', class: 'medium', ap: 9800, weight: 19500, load: 64000, walk: 11, jump: 13, land: 0.35, height: 5.2, about: 'medium biped legs: the thighs armoured, the shins carrying their own thrusters' }),
    'lg-light': row({ name: 'Biped L', class: 'light', ap: 6900, weight: 14200, load: 41000, walk: 13, jump: 16, land: 0.22, height: 5.0, about: 'light biped legs: long and lean, a jump that carries' }),
    // (reverse-joint legs: the knee bent back as a bird's, a long shin down to a splayed foot; they jump and land lightest)
    'lg-reverse': row({ name: 'Reverse M', class: 'medium', joint: 'reverse', ap: 9200, weight: 18200, load: 63000, walk: 12, jump: 19, land: 0.26, height: 4.2, about: 'reverse-joint legs: thighs slung back from the hips, the knee bent back like a bird\'s, a long shin forward to a splayed three-toed foot with a spur behind; a jump that carries far' }),
    'lg-heavy': row({ name: 'Biped H', class: 'heavy', ap: 13800, weight: 27800, load: 84000, walk: 8.5, jump: 10, land: 0.55, height: 5.4, about: 'heavy biped legs: wide plated thighs, broad feet, a landing that shakes' }),
  }),
  booster: f({
    'bs-kestrel': row({ name: 'Kestrel', class: 'medium', weight: 2600, boost: 46, rated: 80000, qb: 96, qbTime: 0.24, qbCool: 0.42, lift: 9, cost: f({ boost: 260, qb: 620, ascend: 520 }), about: 'a balanced booster: four bells under a cowl' }),
    'bs-falcon': row({ name: 'Falcon', class: 'light', weight: 2100, boost: 52, rated: 72000, qb: 118, qbTime: 0.2, qbCool: 0.36, lift: 10.5, cost: f({ boost: 340, qb: 820, ascend: 640 }), about: 'a hot booster: fast and hungry, two long nozzles' }),
    'bs-ox': row({ name: 'Ox', class: 'heavy', weight: 3700, boost: 41, rated: 105000, qb: 84, qbTime: 0.3, qbCool: 0.5, lift: 8, cost: f({ boost: 220, qb: 560, ascend: 460 }), about: 'a heavy booster: six bells, slow to wind up, carries a heavy frame' }),
  }),
  generator: f({
    'gn-standard': row({ name: 'Standard', weight: 4200, en: 3200, regen: 1100, delay: 0.55, out: 1.8 }),
    'gn-deep': row({ name: 'Deep cell', weight: 5600, en: 4400, regen: 900, delay: 0.7, out: 2.2 }),
    'gn-quick': row({ name: 'Quick cell', weight: 3600, en: 2600, regen: 1450, delay: 0.4, out: 1.5 }),
  }),
  fcs: f({
    'fc-standard': row({ name: 'Standard', weight: 300, lock: 0.45, range: 420, cone: 26, locks: 4 }),
    'fc-close': row({ name: 'Close', weight: 260, lock: 0.25, range: 260, cone: 34, locks: 2 }),
    'fc-long': row({ name: 'Long', weight: 380, lock: 0.7, range: 640, cone: 20, locks: 6 }),
  }),
  // what a hand holds: a gun on its own trigger (the right on the left mouse, the left on the right)
  armWeapon: f({
    'rf-carbine': row({ name: 'Carbine', kind: 'rifle', weight: 3800, fire: 'auto', damage: 120, rof: 6, mag: 360, reload: 2.4, speed: 520, range: 380, stagger: 0.02, about: 'an assault rifle: a long receiver, a box magazine, a muzzle brake' }),
    'sg-scatter': row({ name: 'Scatter', kind: 'shotgun', weight: 4400, fire: 'semi', damage: 70, pellets: 8, cooldown: 0.9, mag: 48, reload: 3, speed: 420, range: 140, stagger: 0.05, about: 'a shotgun: a broad short bore, a drum under it' }),
    'gt-gatling': row({ name: 'Gatling', kind: 'gatling', weight: 6900, fire: 'auto', damage: 55, rof: 16, mag: 1200, reload: 4.5, speed: 560, range: 300, stagger: 0.01, about: 'a gatling: six barrels in a shroud, a belt to a drum' }),
    'bz-breaker': row({ name: 'Breaker', kind: 'bazooka', weight: 7800, fire: 'semi', damage: 1400, cooldown: 2.2, mag: 24, reload: 3.6, speed: 260, range: 420, splash: 6, stagger: 0.4, about: 'a bazooka: a fat tube, a rocket the size of a man' }),
    'lr-lance': row({ name: 'Lance', kind: 'laser', weight: 5200, fire: 'charge', damage: 650, cooldown: 0.8, mag: 9999, reload: 0, speed: 900, range: 520, energy: 380, stagger: 0.12, about: 'a laser rifle: a slim barrel in cooling fins, a charged shot' }),
  }),
  // what a shoulder carries: a launcher or a cannon, fired on its own key (the right on E, the left on Q)
  backWeapon: f({
    'ms-hornet': row({ name: 'Hornet', kind: 'missiles', weight: 4600, fire: 'semi', damage: 260, salvo: 4, cooldown: 2.6, mag: 96, reload: 0, speed: 180, range: 520, splash: 4, homing: 2.4, stagger: 0.06, about: 'a missile pod: four cells under a hatch' }),
    'gc-mortar': row({ name: 'Mortar', kind: 'grenade', weight: 8200, fire: 'semi', damage: 1800, cooldown: 3.4, mag: 20, reload: 0, speed: 200, range: 480, splash: 14, stagger: 0.5, about: 'a grenade cannon: a short heavy barrel on a cradle, folded over the shoulder to fire' }),
    'pc-arc': row({ name: 'Arc', kind: 'plasma', weight: 6400, fire: 'charge', damage: 1100, cooldown: 2, mag: 9999, reload: 0, speed: 320, range: 360, splash: 8, energy: 900, stagger: 0.3, about: 'a plasma cannon: coils round a bore, a cell behind it' }),
  }),
});

const SLOT_OF_WEAPON = f({ armR: 'armWeapon', armL: 'armWeapon', backR: 'backWeapon', backL: 'backWeapon' });
/** The part table a frame's slot reads (a weapon slot reads its kind's). */
export const tableOf = (slot) => PARTS[SLOT_OF_WEAPON[slot] ?? slot];

export function partOf(slot, id) {
  const T = tableOf(slot);
  if (!T) throw new Error(`assault frame: '${slot}' is not a slot (${[...SLOTS, ...WEAPON_SLOTS].join(', ')})`);
  const P = T[id];
  if (!P) throw new Error(`assault frame: ${slot} is one of ${Object.keys(T).join(', ')}, not '${id}'`);
  return { id, ...P };
}

/** The stock frames: a build each (a part in every slot, a weapon in each of the four or none). */
export const STOCK = f({
  // the pilot's first: a medium all-rounder, rifle and bazooka in the hands, missiles and a mortar on the shoulders
  // (its fuselage forward and no head, on reverse-joint legs)
  vanguard: f({ head: null, core: 'cr-prow', arms: 'ar-standard', legs: 'lg-reverse', booster: 'bs-kestrel', generator: 'gn-standard', fcs: 'fc-standard',
    armR: 'rf-carbine', armL: 'bz-breaker', backR: 'ms-hornet', backL: 'gc-mortar' }),
  // a light striker: shotgun and laser, quick boosts, a missile pod
  raptor: f({ head: 'hd-lancet', core: 'cr-raptor', arms: 'ar-light', legs: 'lg-light', booster: 'bs-falcon', generator: 'gn-quick', fcs: 'fc-close',
    armR: 'sg-scatter', armL: 'lr-lance', backR: 'ms-hornet', backL: null }),
  // a heavy: gatling and bazooka, plasma and mortar, slow and hard to put down
  citadel: f({ head: 'hd-bulwark', core: 'cr-citadel', arms: 'ar-heavy', legs: 'lg-heavy', booster: 'bs-ox', generator: 'gn-deep', fcs: 'fc-long',
    armR: 'gt-gatling', armL: 'bz-breaker', backR: 'pc-arc', backL: 'gc-mortar' }),
});
