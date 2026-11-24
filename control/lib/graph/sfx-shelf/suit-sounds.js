/**
 * sfx-shelf/suit-sounds — a mobile suit's sounds as a KIT, so several suits can be designed and each heard as its own: a
 * suit is heard by its WEIGHT (its footfalls, its landings, its servos), its DRIVE (its booster held by the thrust, the
 * boost's ignition, the quick boost), its LOADOUT (each weapon's shot, its hit, a beam's charge) and what every suit
 * shares (the roll, the jump and its gathering, the overheat and its vent, the transform both ways, the cockpit's
 * lock-on and its power-up). Each answer is a shelf word (roster.js); the variants are `recorded` rows heard as their
 * `standIn` until the sound library records them (sound-library/library.js), so a page without the library hears what
 * it heard before.
 *
 *   SUIT_WEIGHTS, SUIT_DRIVES, SUIT_ARMS, SUIT_SHARED   the axes, each a row of shelf words (a new axis value is a row)
 *   suitWeight({ mass?, weight? })     'light' | 'medium' | 'heavy': by its mass in kg (a frame's, combat/frames.js),
 *                                      or its weight from 0 swift to 1 heavy (a feel's mech, feel/cards.js mechKnobs)
 *   suitSounds(suit?)                  { weight, drive, arms, step, land, servo, booster, boost, quickBoost, …SUIT_SHARED,
 *                                      loadout: { <arm>: { shot?, hit?, charge?, charged?, swing? } }, why }
 *                                      suit: { weight?: <axis value> | 0…1, mass?, drive?, arms?: [<arm>…] }
 *   suitRecorded(sounds)               whether the library records this suit (its footfall): a page asks before it plays them
 *
 * Pure but for suitRecorded (it reads the library's index); timeless.
 */
import { recordedFor } from '../sound-library/library.js';

const freeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

// (a frame under LIGHT_KG is a light suit, under HEAVY_KG a medium one: combat/frames.js's walkers span both)
export const LIGHT_KG = 6000;
export const HEAVY_KG = 12000;
export const SUIT_WEIGHTS = freeze({
  light: { step: 'mech-step-light', land: 'mech-land-light', servo: 'servo-whine', drive: 'ion', why: 'a light suit: quick firm footfalls, electric servos' },
  medium: { step: 'mech-step', land: 'mech-land', servo: 'walker-hydraulics', drive: 'jet', why: 'a medium suit: a heavy metal footfall, hydraulics' },
  heavy: { step: 'mech-step-heavy', land: 'mech-land-heavy', servo: 'walker-hydraulics', drive: 'rocket', why: 'a heavy suit: the ground shaking under it, hydraulics groaning' },
});
export const SUIT_DRIVES = freeze({
  rocket: { booster: 'rocket-booster', boost: 'rocket-boost', quickBoost: 'rocket-quick-boost', why: 'rocket boosters: a rough combustion roar' },
  jet: { booster: 'thruster-roar', boost: 'jet-boost', quickBoost: 'jet-quick-boost', why: 'jet thrusters: a turbine roar and whine' },
  ion: { booster: 'ion-drive', boost: 'ion-boost', quickBoost: 'ion-quick-boost', why: 'ion thrusters: a pulsing electric hum' },
});
export const SUIT_ARMS = freeze({
  'beam-rifle': { shot: 'beam-rifle-shot', hit: 'beam-rifle-hit', charge: 'beam-charge', charged: 'beam-charged-shot' },
  'beam-cannon': { shot: 'beam-cannon-shot', hit: 'beam-rifle-hit', charge: 'beam-charge' },
  railgun: { shot: 'railgun-shot', hit: 'beam-rifle-hit' },
  vulcan: { shot: 'vulcan-burst' },
  'machine-gun': { shot: 'machine-gun-shot' },
  bazooka: { shot: 'bazooka-shot', hit: 'bazooka-hit' },
  missiles: { shot: 'missile-salvo', hit: 'bazooka-hit' },
  'beam-saber': { swing: 'saber-swing', hit: 'saber-hit' },
  'heat-axe': { swing: 'heat-axe-swing', hit: 'heat-axe-hit' },
});
export const SUIT_SHARED = Object.freeze({ dodge: 'mech-dodge', jump: 'mech-jump', jumpCharge: 'jump-servo', overheat: 'overheat-alarm', vent: 'thruster-vent',
  transform: 'mech-transform', unfold: 'mech-unfold', lockOn: 'lock-on', boot: 'suit-boot' });
// a suit that names no loadout: the mobile suit's own, a rifle and a saber
export const SUIT_DEFAULT_ARMS = Object.freeze(['beam-rifle', 'beam-saber']);

const fail = (m) => new Error(`suit sounds: ${m}`);

export function suitWeight({ mass, weight } = {}) {
  if (typeof weight === 'string') {
    if (!SUIT_WEIGHTS[weight]) throw fail(`weight '${weight}' is one of ${Object.keys(SUIT_WEIGHTS).join(', ')}, or 0 (swift) … 1 (heavy)`);
    return weight;
  }
  if (Number.isFinite(weight)) return weight < 1 / 3 ? 'light' : weight < 2 / 3 ? 'medium' : 'heavy';
  if (Number.isFinite(mass)) return mass < LIGHT_KG ? 'light' : mass < HEAVY_KG ? 'medium' : 'heavy';
  return 'medium';
}

export function suitSounds(suit = {}) {
  if (!suit || typeof suit !== 'object' || Array.isArray(suit)) throw fail('a suit is { weight?, mass?, drive?, arms? }');
  for (const k of Object.keys(suit)) if (!['weight', 'mass', 'drive', 'arms'].includes(k)) throw fail(`'${k}' is not a suit's axis (weight, mass, drive, arms)`);
  const weight = suitWeight(suit), W = SUIT_WEIGHTS[weight];
  const drive = suit.drive ?? W.drive;
  if (!SUIT_DRIVES[drive]) throw fail(`drive '${drive}' is one of ${Object.keys(SUIT_DRIVES).join(', ')}`);
  const arms = suit.arms ?? SUIT_DEFAULT_ARMS;
  if (!Array.isArray(arms) || !arms.length) throw fail('arms is a list of weapons');
  for (const a of arms) if (!SUIT_ARMS[a]) throw fail(`arm '${a}' is one of ${Object.keys(SUIT_ARMS).join(', ')}`);
  const D = SUIT_DRIVES[drive];
  return {
    weight, drive, arms: [...arms],
    step: W.step, land: W.land, servo: W.servo, booster: D.booster, boost: D.boost, quickBoost: D.quickBoost, ...SUIT_SHARED,
    loadout: Object.fromEntries(arms.map((a) => [a, { ...SUIT_ARMS[a] }])),
    why: { weight: W.why, drive: `${D.why}${suit.drive ? '' : ` (a ${weight} suit's)`}`, arms: arms.join(', ') },
  };
}

export function suitRecorded(sounds) {
  return !!(sounds && recordedFor(sounds.step));
}
