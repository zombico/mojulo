/**
 * rotor.js — THE ROTORCRAFT'S ENVELOPES: the helicopters and the multirotor drones as the hover rule flies them
 * (worlds/controllable/rules-hover.js), each at its type's published figures, as eye.js CRAFT holds the fixed wings'.
 *
 *   ROTOR[key]   { label, mass (kg), max (m/s, its never-exceed or top speed, level), climb (m/s, its best rate),
 *                  descent (m/s, the most it sinks by choice), tilt (°, the most its disc is tilted: its nose down at its
 *                  top speed, its bank in a turn), tw (its rotors' most thrust over its weight), yaw (°/s, its pedals' or
 *                  motors' most turn), tiltRate (°/s, how fast its disc is tilted), ceiling (m), hold (true: a drone's
 *                  flight controller, the stick asks a velocity and let go it brakes to a hover; absent, a helicopter's
 *                  cyclic, the stick asks an attitude and let go its disc levels and it coasts) }
 *   hoverRule(key) → the hover rule's numbers for it (rules-hover.js says what each does)
 *
 * The figures, by type (the class the craft shelf builds; its reference mass the shelf's):
 *   lightHeli       a light turbine single (Bell 206B-3 class: Vne 122 kt, climb 1,280 ft/min, 13,500 ft)
 *   utilityHeli     a medium twin utility (UH-60L class: Vne 193 kt, climb 1,650 ft/min, 19,000 ft)
 *   attackHeli      a tandem attack (AH-64D class: Vne 197 kt, climb 2,500 ft/min, 21,000 ft)
 *   tandemHeli      a tandem-rotor heavy lift (CH-47F class: Vne 170 kt, climb 1,500 ft/min, 20,000 ft)
 *   cameraQuad      a folding camera quad (Mavic 3 class: 21 m/s in its sport mode, 8 m/s up, 6 down, 35°)
 *   fpvRacer        a 5-inch freestyle quad (≈ 45 m/s, thrust about eight times its weight, flown to 60°)
 *   inspectionQuad  an enterprise quad (Matrice 300 class: 23 m/s, 6 up, 5 down)
 *   heavyHex        a heavy-lift hexacopter (25 kg class: ≈ 18 m/s, 5 up)
 *   coaxX8          a coaxial X8 mapper (15 kg class: ≈ 20 m/s, 5 up)
 *   cropSprayer     a spray hexacopter (Agras class, loaded: 10 m/s, 3 up)
 *   deliveryQuad    a ducted parcel quad (9 kg class: ≈ 20 m/s, 5 up)
 *
 * Pure data and a pure function.
 */
const DEG = Math.PI / 180, G = 9.81;
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

export const ROTOR = Object.freeze({
  lightHeli: Object.freeze({ label: 'light turbine helicopter', mass: 1400, max: 62.8, climb: 6.5, descent: 7.6, tilt: 30, tw: 1.25, yaw: 60, tiltRate: 45, ceiling: 4100 }),
  utilityHeli: Object.freeze({ label: 'medium utility helicopter', mass: 10000, max: 99, climb: 8.4, descent: 7.6, tilt: 30, tw: 1.2, yaw: 45, tiltRate: 40, ceiling: 5790 }),
  attackHeli: Object.freeze({ label: 'attack helicopter', mass: 8000, max: 101, climb: 12.7, descent: 7.6, tilt: 35, tw: 1.3, yaw: 70, tiltRate: 50, ceiling: 6400 }),
  tandemHeli: Object.freeze({ label: 'tandem-rotor heavy lift helicopter', mass: 22700, max: 87, climb: 7.7, descent: 7.6, tilt: 25, tw: 1.15, yaw: 30, tiltRate: 30, ceiling: 6100 }),
  cameraQuad: Object.freeze({ label: 'camera quad', mass: 0.9, max: 21, climb: 8, descent: 6, tilt: 35, tw: 2.2, yaw: 200, tiltRate: 300, ceiling: 6000, hold: true }),
  fpvRacer: Object.freeze({ label: 'racing quad', mass: 0.65, max: 45, climb: 25, descent: 20, tilt: 60, tw: 8, yaw: 500, tiltRate: 600, ceiling: 3000 }),
  inspectionQuad: Object.freeze({ label: 'inspection quad', mass: 6.3, max: 23, climb: 6, descent: 5, tilt: 30, tw: 2, yaw: 100, tiltRate: 200, ceiling: 5000, hold: true }),
  heavyHex: Object.freeze({ label: 'heavy-lift hexacopter', mass: 25, max: 18, climb: 5, descent: 4, tilt: 25, tw: 1.8, yaw: 60, tiltRate: 120, ceiling: 4000, hold: true }),
  coaxX8: Object.freeze({ label: 'coaxial octocopter', mass: 15, max: 20, climb: 5, descent: 4, tilt: 25, tw: 1.9, yaw: 80, tiltRate: 150, ceiling: 4000, hold: true }),
  cropSprayer: Object.freeze({ label: 'spray hexacopter', mass: 40, max: 10, climb: 3, descent: 3, tilt: 15, tw: 1.6, yaw: 60, tiltRate: 90, ceiling: 2000, hold: true }),
  deliveryQuad: Object.freeze({ label: 'delivery quad', mass: 9, max: 20, climb: 5, descent: 4, tilt: 25, tw: 1.8, yaw: 90, tiltRate: 150, ceiling: 4000, hold: true }),
});
export const ROTOR_NAMES = Object.freeze(Object.keys(ROTOR));

/**
 * A rotorcraft's envelope as the hover rule's numbers: its thrust (N) enough to hold its height at its most tilt; its
 * drag (N per (m/s)²) what stops its speed at its top at that tilt (m·g·tan(tilt) = k·max²); its climb's drag what its
 * spare thrust climbs against at its best rate ((T − W) = kz·climb²).
 */
export function hoverRule(key) {
  const R = ROTOR[key];
  if (!R) throw new Error(`rotor: one of ${ROTOR_NAMES.join(', ')}`);
  const W = R.mass * G, tilt = R.tilt * DEG, thrust = Math.max(R.tw * W, (W / Math.cos(tilt)) * 1.02);
  return {
    type: 'hover', mass: R.mass, thrust: r3(thrust), drag: r3((W * Math.tan(tilt)) / (R.max * R.max)), dragZ: r3((thrust - W) / (R.climb * R.climb)),
    maxSpeed: R.max, climb: R.climb, descent: R.descent, tiltMax: r3(tilt), tiltRate: r3(R.tiltRate * DEG), yawRate: r3(R.yaw * DEG),
    ...(R.hold ? { hold: true } : {}),
  };
}
