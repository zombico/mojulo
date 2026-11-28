/**
 * sfx-shelf/frame-sounds — an ASSAULT FRAME heard by its parts (assault-frame/parts.js), on the mobile suit's kit
 * (suit-sounds.js) and the recorded library first: its legs' class its weight (its footfalls and landings), its
 * booster's class its drive (the thrust held, its ignition, the quick boost), each weapon by its KIND (a part's
 * `kind`: a new weapon of a kind sounds as its kind does), and the cockpit every frame shares. Its foes too: the ground
 * force's units by their kind (groundforce/, gameworld/frame-goal.js OPERATION.units), each its round, its missiles,
 * the hum it flies or rolls on and how big it goes up.
 *
 * Every answer is a list of shelf words, the first that is voiced winning (frameWord): the recorded row first, then a
 * synthesized row where the recorded one has no voice without the library (a rocket's ignition is the launch's then),
 * so a page without the library still hears the frame, and one with it hears the recordings.
 *
 *   FRAME_WEIGHTS   { light | medium | heavy: { step, land } }      by the legs' class
 *   FRAME_DRIVES    { ion | jet | rocket: { held, boost, quick } }   by the booster's class, as a suit of that weight's
 *   FRAME_ARMS      { <weapon kind>: { shot, every?, charge?, charged?, hit? } }   `every`: the least seconds between
 *                   two shots heard (an automatic's rounds come quicker than a recording can be heard whole)
 *   FRAME_UNITS     { <unit kind>: { shot?, every?, missile?, hum?, down } }
 *   FRAME_COCKPIT   { jump, enOut, enBack, lock, boot, warn }   the pilot's own
 *   FRAME_WORLD     { struck, shield, shieldBreak, burst, blast, wreck, task, done, won, lost }   what any of them meets
 *   FRAME_UI        the menus' cues the hangar and the briefing play (the holo table's set, beats/ui-sounds.js)
 *   frameWeight(legs) / frameDrive(booster)   a part row's class → its weight / its drive
 *   frameWord(words, { style, flavor })       the first word of a list voiced in the style → { word, sound } | null
 *
 * Pure but for frameWord (the shelf reads the library's index); timeless.
 */
import { sfxSound } from './resolve.js';
import { SUIT_WEIGHTS, SUIT_DRIVES } from './suit-sounds.js';

const freeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(Object.fromEntries(Object.entries(v).map(([q, w]) => [q, Array.isArray(w) ? Object.freeze(w) : w])))])));

export const FRAME_WEIGHTS = freeze({
  light: { step: [SUIT_WEIGHTS.light.step], land: [SUIT_WEIGHTS.light.land] },
  medium: { step: [SUIT_WEIGHTS.medium.step], land: [SUIT_WEIGHTS.medium.land] },
  heavy: { step: [SUIT_WEIGHTS.heavy.step], land: [SUIT_WEIGHTS.heavy.land] },
});
// (the ignition and the quick boost have no synthesized voice of their own: a launch and a whoosh stand for them)
export const FRAME_DRIVES = freeze(Object.fromEntries(Object.entries(SUIT_DRIVES).map(([d, D]) => [d, { held: [D.booster], boost: [D.boost, 'jump-launch'], quick: [D.quickBoost, 'fire-whoosh'] }])));
export const FRAME_ARMS = freeze({
  rifle: { shot: ['machine-gun-shot'], every: 0.15, hit: ['ricochet'] },
  shotgun: { shot: ['scatter-shot'], hit: ['metal-impact'] },
  gatling: { shot: ['gatling-burst'], every: 0.32, hit: ['ricochet'] },
  bazooka: { shot: ['bazooka-shot'], hit: ['bazooka-hit'] },
  blade: { shot: ['saber-swing'], hit: ['saber-hit'] },
  laser: { shot: ['beam-rifle-shot'], charge: ['beam-charge'], charged: ['beam-charged-shot'], hit: ['beam-rifle-hit'] },
  missiles: { shot: ['missile-salvo'], hit: ['bazooka-hit'] },
  grenade: { shot: ['mortar-shot'], hit: ['grenade-blast'] },
  plasma: { shot: ['beam-cannon-shot'], charge: ['beam-charge'], hit: ['beam-rifle-hit'] },
});
export const FRAME_UNITS = freeze({
  turret: { shot: ['machine-gun-shot'], every: 0.3, down: ['explosion'] },
  tank: { shot: ['bazooka-shot'], hum: ['tank-tracks'], down: ['explosion'] },
  walker: { shot: ['machine-gun-shot'], every: 0.2, down: ['explosion'] },
  // (a spider bot: its cutter's crackle as it cuts, its legs' servos whining as it comes, a small blast)
  crawler: { shot: ['electric-crackle'], every: 0.2, hum: ['servo-whine'], down: ['grenade-blast'] },
  // (the patrol ship's parts: a lift pod's drive held under it, a turret's heavy rounds, each a wreck as it goes)
  'patrol-pod': { hum: ['ion-drive'], down: ['frame-wreck'] },
  'patrol-gun': { shot: ['railgun-shot'], down: ['explosion'] },
  hammer: { missile: ['missile-launch'], hum: ['tank-tracks'], down: ['explosion'] },
  bastion: { shot: ['railgun-shot'], down: ['explosion'] },
  gnat: { shot: ['vulcan-burst'], every: 0.5, hum: ['drone-motors'], down: ['grenade-blast'] },
  wasp: { shot: ['vulcan-burst'], every: 0.4, hum: ['drone-motors'], down: ['grenade-blast'] },
  kite: { missile: ['missile-launch'], hum: ['drone-motors'], down: ['explosion'] },
  harrow: { shot: ['vulcan-burst'], every: 0.35, missile: ['missile-salvo'], hum: ['helicopter'], down: ['frame-wreck'] },
  thunderhead: { shot: ['vulcan-burst'], every: 0.3, missile: ['missile-salvo'], hum: ['helicopter'], down: ['frame-wreck'] },
});
export const FRAME_COCKPIT = Object.freeze({
  jump: Object.freeze(['mech-jump', 'jump-launch']), enOut: Object.freeze(['overheat-alarm']), enBack: Object.freeze(['thruster-vent', 'fire-whoosh']),
  lock: Object.freeze(['lock-on', 'beam-blip']), boot: Object.freeze(['suit-boot', 'power-up']), warn: Object.freeze(['missile-warning']),
});
export const FRAME_WORLD = Object.freeze({
  struck: Object.freeze(['metal-impact']), shield: Object.freeze(['shield-hit']), shieldBreak: Object.freeze(['shield-break']),
  burst: Object.freeze(['bazooka-hit']), blast: Object.freeze(['grenade-blast']), wreck: Object.freeze(['frame-wreck']),
  task: Object.freeze(['chime']), done: Object.freeze(['checkpoint']), won: Object.freeze(['goal']), lost: Object.freeze(['lose']),
});
export const FRAME_UI = Object.freeze({ set: 'glass', cues: Object.freeze(['move', 'change', 'accept', 'back', 'open', 'close', 'deny']) });

// a legs part's class is its weight; a booster's class its drive as a suit of that weight's (suit-sounds.js)
export function frameWeight(legs) {
  const c = legs && legs.class;
  return FRAME_WEIGHTS[c] ? c : 'medium';
}
export function frameDrive(booster) {
  const c = booster && booster.class;
  return SUIT_WEIGHTS[c] ? SUIT_WEIGHTS[c].drive : SUIT_WEIGHTS.medium.drive;
}

/** The first of `words` the shelf voices in `style` (its recording, else its synthesized voice), or null: a word that
 *  answers with nothing (a recorded row with no stand-in, the library not here) gives way to the next. */
export function frameWord(words, { style = 'realistic', flavor = null } = {}) {
  for (const w of words || []) {
    const s = sfxSound(w, { style, flavor });
    if (s && (s.gestures || s.sustain)) return { word: s.id, sound: s };
  }
  return null;
}
