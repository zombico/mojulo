/**
 * Mech Battle Kai's sounds (the `mech-battle-kai` rail, a mobile suit's action: the heavy machine that boosts, hovers,
 * shoots and transforms), made as a SUIT KIT so several suits can be designed from it: a suit is heard by its WEIGHT
 * (light, medium, heavy: its footfalls, its landings, its servos), its DRIVE (rocket, jet, ion: its booster held, the
 * boost's ignition, the quick boost), its LOADOUT (beam rifle, charged beam, beam cannon, railgun, vulcan, machine gun,
 * bazooka, missiles, beam saber, heat axe) and what every suit shares (a roll, a jump, the overheat, the transform, the
 * cockpit's lock-on and power-up). sfx-shelf/suit-sounds.js picks a suit's words from these axes.
 *
 * Not a flavor: a suit's sounds are realistic machine sounds any game with a mech hears (the artillery range's frames,
 * the brawl's guns, a recipe naming 'beam rifle'), so each card voices its shelf row for every game, as the vehicles'
 * do. The variant rows (a light suit's step, a rocket's boost) are rows of their own, `recorded` and heard as their
 * `standIn` until the library is installed. Each card's `tags` say its axis (`suit`, and `light` | `medium` | `heavy`,
 * `rocket` | `jet` | `ion`, `arms`), for finding it again (library.js recordingsTagged).
 */

const SFX = 'a sci-fi mecha sound effect, no music, no voice';
const shot = (id, shelf, prompt, seconds, tags, extra = {}) => ({ id, shelf, role: 'one-shot', prompt: `${prompt}, ${SFX}`, seconds, influence: 0.55, loop: false, takes: 3, tags: ['suit', ...tags], ...extra });
const cue = (id, shelf, prompt, seconds, tags) => ({ id, shelf, role: 'cue', prompt: `${prompt}, ${SFX}`, seconds, loop: false, takes: 3, tags: ['suit', ...tags] });
const hold = (id, shelf, prompt, tags, seconds = 8) => ({ id, shelf, role: 'loop', prompt: `${prompt}, constant and steady, ${SFX}`, seconds, influence: 0.6, loop: true, takes: 2, tags: ['suit', ...tags] });

export const CARDS = [
  // ── WEIGHT: the footfall, the landing, the servos (a light suit is quick and electric, a heavy one shakes the ground) ──
  shot('mbk-step-light', 'mech-step-light', 'a light agile mecha robot\'s footstep on concrete: a quick firm metal thump and a short electric servo whir', 0.8, ['light', 'step']),
  shot('mbk-step', 'mech-step', 'a giant mecha robot\'s footstep on hard ground: a deep heavy metal thud, a crunch of ground and a hydraulic hiss', 1.2, ['medium', 'step']),
  shot('mbk-step-heavy', 'mech-step-heavy', 'a colossal heavy mecha robot\'s footfall: an earth-shaking deep boom, armour plates rattling and a long hydraulic groan', 1.8, ['heavy', 'step']),
  shot('mbk-land-light', 'mech-land-light', 'a light mecha robot landing from a jump: a sharp metal impact, a quick hydraulic compression hiss', 1, ['light', 'land']),
  shot('mbk-land', 'mech-land', 'a giant mecha robot landing hard from a jump: a heavy metal slam, debris scattering and a hydraulic hiss', 1.5, ['medium', 'land']),
  shot('mbk-land-heavy', 'mech-land-heavy', 'a colossal heavy mecha robot crashing down from a jump: a massive ground-shaking slam, metal groaning and rubble falling', 2.2, ['heavy', 'land']),
  hold('mbk-servo-whine', 'servo-whine', 'a light robot\'s electric servo motors whining as its joints move, a high clean actuator hum', ['light', 'servo']),
  // ── DRIVE: the booster held (by the thrust), its ignition, the quick boost ──
  hold('mbk-rocket-loop', 'rocket-booster', 'a mecha robot\'s rocket booster firing, a rough deep combustion roar with crackle', ['rocket', 'booster']),
  hold('mbk-jet-loop', 'thruster-roar', 'a mecha robot\'s jet thruster firing, a smooth high turbine roar and whine', ['jet', 'booster']),
  hold('mbk-ion-loop', 'ion-drive', 'a mecha robot\'s ion thruster firing, a clean pulsing electric hum with a bright shimmering whine', ['ion', 'booster']),
  shot('mbk-rocket-boost', 'rocket-boost', 'a mecha robot\'s rocket booster igniting: a hard explosive burst of flame and a rising roar', 1.2, ['rocket', 'boost']),
  shot('mbk-jet-boost', 'jet-boost', 'a mecha robot\'s jet thruster kicking in: a sharp whoosh and a rising turbine whine', 1.2, ['jet', 'boost']),
  shot('mbk-ion-boost', 'ion-boost', 'a mecha robot\'s ion thruster engaging: an electric charge-up zap and a bright humming surge', 1.2, ['ion', 'boost']),
  shot('mbk-rocket-quick', 'rocket-quick-boost', 'a mecha robot\'s rocket quick boost: a single sharp blast of thrust, a punchy whoosh', 0.7, ['rocket', 'quick-boost']),
  shot('mbk-jet-quick', 'jet-quick-boost', 'a mecha robot\'s jet quick boost: a fast sharp burst of air and a short turbine shriek', 0.7, ['jet', 'quick-boost']),
  shot('mbk-ion-quick', 'ion-quick-boost', 'a mecha robot\'s ion quick boost: a crisp electric snap and a fast shimmering swish', 0.7, ['ion', 'quick-boost']),
  // ── every suit: the roll, the jump, the jump gathering, the overheat, the transform, the cockpit ──
  shot('mbk-dodge', 'mech-dodge', 'a giant mecha robot rolling sideways: heavy metal impacts tumbling, a scrape and a thruster whoosh', 1.2, ['move']),
  shot('mbk-jump', 'mech-jump', 'a giant mecha robot jumping: a deep hydraulic piston launch and a burst of thrusters', 1, ['move']),
  hold('mbk-jump-servo', 'jump-servo', 'a giant robot\'s hydraulic legs straining and compressing, a building mechanical whine under load', ['move']),
  cue('mbk-overheat', 'overheat-alarm', 'an electronic overheat alarm: a fast pulsing warning buzzer tone in a robot cockpit', 1.2, ['cockpit']),
  shot('mbk-vent', 'thruster-vent', 'hot thrusters venting: a loud pressurised steam blast fading to a sizzle and metal ticking', 1.5, ['move']),
  shot('mbk-transform', 'mech-transform', 'a robot transforming into a vehicle: a fast sequence of servo whirs, metal plates sliding and heavy locking clunks', 2.5, ['transform']),
  shot('mbk-unfold', 'mech-unfold', 'a vehicle transforming into a standing robot: rising servo whirs, armour plates unfolding and a final heavy metal lock', 2.5, ['transform']),
  cue('mbk-lock-on', 'lock-on', 'a targeting system locking on: rapid rising electronic beeps ending in a steady locked tone', 1, ['cockpit']),
  shot('mbk-boot', 'suit-boot', 'a giant robot powering up: a deep electric hum rising, relays clicking on and a reactor whine building', 2.5, ['cockpit']),
  // ── LOADOUT: the beam weapons, the guns, the blades ──
  shot('mbk-beam-rifle', 'beam-rifle-shot', 'a beam rifle firing: a sharp bright energy blast with an electric crackle tail', 1, ['arms', 'beam']),
  shot('mbk-beam-charge', 'beam-charge', 'a beam rifle charging up: a rising electric hum and a building energy whine', 1.5, ['arms', 'beam']),
  shot('mbk-beam-charged', 'beam-charged-shot', 'a fully charged beam rifle shot: a big deep energy blast and a long sizzling roar', 1.8, ['arms', 'beam']),
  shot('mbk-beam-hit', 'beam-rifle-hit', 'an energy beam striking heavy armour: a searing hiss, a metal impact and crackling sparks', 1, ['arms', 'beam']),
  shot('mbk-beam-cannon', 'beam-cannon-shot', 'a huge beam cannon firing: a deep thunderous energy discharge and a long roaring beam', 2.5, ['arms', 'beam']),
  shot('mbk-railgun', 'railgun-shot', 'a railgun firing: a high electric charge whine snapping into a supersonic metallic crack', 1.5, ['arms', 'gun']),
  shot('mbk-vulcan', 'vulcan-burst', 'a head-mounted vulcan gun firing a short rapid burst: fast small-calibre rattling shots', 1, ['arms', 'gun']),
  shot('mbk-machine-gun', 'machine-gun-shot', 'a large mecha machine gun firing a single heavy round: a loud deep bang with a metal clank', 0.6, ['arms', 'gun']),
  shot('mbk-bazooka', 'bazooka-shot', 'a giant robot bazooka firing: a deep explosive thump and a rocket hissing away', 1.5, ['arms', 'gun']),
  shot('mbk-bazooka-hit', 'bazooka-hit', 'a large rocket shell bursting on impact: a heavy explosion with metal debris', 2, ['arms', 'gun']),
  shot('mbk-missiles', 'missile-salvo', 'a salvo of small missiles launching in quick succession: a rapid string of whooshing launches', 2, ['arms', 'gun']),
  shot('mbk-saber-swing', 'saber-swing', 'a beam saber swung: a deep electric hum sweeping past with a crackling buzz', 0.8, ['arms', 'blade']),
  shot('mbk-saber-hit', 'saber-hit', 'a beam saber cutting into metal armour: a searing electric sizzle and a sharp crackle', 1, ['arms', 'blade']),
  shot('mbk-axe-swing', 'heat-axe-swing', 'a giant glowing heat axe swung: a heavy whoosh with a hot roaring sizzle', 1, ['arms', 'blade']),
  shot('mbk-axe-hit', 'heat-axe-hit', 'a giant heat axe chopping into metal armour: a heavy metal crunch and a hot hissing sear', 1.2, ['arms', 'blade']),
];
