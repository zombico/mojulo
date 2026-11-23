/**
 * THE FLEET'S DESIGN LANGUAGE — industrial realism for the big things in space: capital ships and stations as working
 * machines, built, used and repaired, the register the cockpits and the fighters already fly in (a canopy's bolted frame,
 * an instrument panel's screws, a hull's panel lines and its wear). Every rule a reason a real engineer would give:
 *
 *   FORM FOLLOWS FUNCTION   a ship reads as what it does, front to back: command forward and high (to see), habitation
 *                           and hangars amidships (mass at the middle), the reactor armoured at the heart, the drive aft
 *                           with the radiators it needs (a reactor's heat has nowhere to go in a vacuum but out of fins)
 *   ONE BIG, SOME MEDIUM, MANY SMALL   a silhouette is one dominant mass, a few secondary ones (a tower, a drive, the
 *                           radiator wings) and the small detail only up close (plates, seams, lights, hatches); never
 *                           detail all over at one size, which reads as noise
 *   MODULAR                 built in modules of a standard length (the yard's own), so a hull is a run of the same
 *                           section, its plates of a standard size; damage takes a module, not the ship
 *   PLATED, NOT SMOOTH      plates with seams between them, each its own tone a little off its neighbours (replaced
 *                           at different times, weathered differently); armour belts of thick plate welded on where a
 *                           broadside lands
 *   A NARROW PALETTE        a neutral base, a darker structural tone, a small accent band (a fleet's, never more than a
 *                           tenth of a hull), hazard striping only where things dock and launch; lights warm windows,
 *                           red and green running lights at the extremities (port and starboard, as at sea), the drive's
 *                           glow; nothing in the target's magenta (the cockpit's code, cockpit-look.js)
 *   USED                    soot aft of the drive and streaks along the flow, the paint worn at the edges
 *
 *   FLEET_LOOKS     a fleet's livery: base, trim (structure), dark (shadowed recesses and seams), accent, plate variation
 *   ROLES           what each part is made of for destructible physics (rupa): its matter and the solid share of its
 *                   box, and whether it is welded on by its side (an armour plate: stripped, not broken)
 *   LIGHTS          the lit colours (windows, running lights, drive glow, hazard), drawn unshaded
 *   shade(hex, n, sun) → a face's colour under the map's star: a hard key and a dark fill, space's own light
 */

export const FLEET_LOOKS = Object.freeze({
  // a navy's: a cool light grey, darker structure, an oxide-red band
  navy: Object.freeze({ base: '#a7adb4', trim: '#6c737b', dark: '#3a3f45', accent: '#9c3b32', vary: 0.05 }),
  // a raider's: plates of mismatched rust and olive, patched, an orange band
  raider: Object.freeze({ base: '#80776a', trim: '#5c544a', dark: '#2f2c28', accent: '#c8792a', vary: 0.12 }),
  // a merchant's or a yard's: off-white, a blue band, hazard everywhere it works
  civil: Object.freeze({ base: '#c9c6bd', trim: '#8f8c84', dark: '#45443f', accent: '#2f6fa3', vary: 0.05 }),
  // a shadow fleet's: near black, a pale steel band
  shadow: Object.freeze({ base: '#43474d', trim: '#2c2f33', dark: '#1a1c1f', accent: '#7fa0b8', vary: 0.04 }),
});

/** The parts' matter (rupa/matter.js), the solid share of the box, and the lateral weld of a plate hung by its side. */
export const ROLES = Object.freeze({
  hull: Object.freeze({ matter: 'steel', fill: 0.05 }),          // a module: a steel shell round decks and air
  bow: Object.freeze({ matter: 'steel', fill: 0.06 }),
  armour: Object.freeze({ matter: 'armour-steel', fill: 1, lateral: true }),   // a belt's plate, welded on by its side
  core: Object.freeze({ matter: 'armour-steel', fill: 0.12 }),   // the reactor's casing: the heart, armoured
  drive: Object.freeze({ matter: 'steel', fill: 0.1 }),
  tower: Object.freeze({ matter: 'steel', fill: 0.06 }),
  truss: Object.freeze({ matter: 'steel', fill: 0.02 }),          // an open frame: little steel, much space
  tank: Object.freeze({ matter: 'steel', fill: 0.04 }),
  radiator: Object.freeze({ matter: 'aluminium', fill: 0.12, lateral: true }),
  turret: Object.freeze({ matter: 'armour-steel', fill: 0.3 }),
  hab: Object.freeze({ matter: 'steel', fill: 0.05 }),
  deck: Object.freeze({ matter: 'steel', fill: 0.07 }),
});

export const LIGHTS = Object.freeze({ window: '#ffd9a0', port: '#ff3b2e', starboard: '#3cff7a', strobe: '#f4f8ff', drive: '#a8d4ff', bay: '#ffe7b8', hazard: '#e8b21a' });

const SUN = [0.4506, -0.3505, 0.8211];
/** A face's colour under the map's star: the key on it by its normal, and the dark of space for its fill (a little
 *  more than none: the hull is read in its shade, as the craft are under the cast rig's value law). */
export function shade(hex, n, sun = SUN) {
  const L = Math.hypot(...sun), k = 0.26 + 0.74 * Math.max(0, (n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) / L);
  return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
}
