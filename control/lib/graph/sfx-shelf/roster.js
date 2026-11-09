/**
 * sfx-shelf/roster — one row per game sound, under the word people say: the shelf a game takes its effects from, so
 * it never has to invent one unless it wants to. Game effects only: a menu's sounds are the interface's.
 *
 * The roster NAMES; the cues live where they are voiced. The palettes (beats/sfx-palettes.js) are frozen behind it:
 * every palette cue id is exactly one row (`palette`), so the four palette styles voice that row as they always have and
 * no stored recipe changes by a byte. A sound the palettes do not have is voiced by a set (sets.js) in the styles its
 * row names. A sound the audio channel synthesizes in code, not from a cue (the thruster's roar, the jump's servo and
 * piston: scene/channels/audio.js), is a row naming that `channel` slot, until it is a cue of its own.
 *
 * A row:
 *   label     what it is in prose
 *   aliases   the words people say for it (3+ characters each, unique across the shelf)
 *   category  where it sits (CATEGORIES)
 *   family    the row it stands in for in a style that has no voice of its own for it: a beam rifle's shot is a shot.
 *             A palette row is its own family; a row with none (the charge-up) is unvoiced in such a style.
 *   palette   the palette cue id it is, when it is one
 *   voices    { <style>: <set> | 'families' }: what voices it, by style (STYLES): a set's cue, or its family's build
 *   make      { family, dials }: the family that builds it and the dial preset it is (families.js); a caller turns
 *             the dials further (sfxSound's `dials`)
 *   channel   the audio channel slot whose own code synthesizes it (SLOTS) unless the level gives that slot this row's
 *             voice (the thruster's `voice`, the jump charge's)
 *   slot      the audio channel slot it fills (SLOTS): where a level plays it
 *
 * Pure data and pure functions: no clock, no dice.
 */

/** Where a sound sits. A category with no row yet is a gap the shelf owes (sfxGaps). */
export const CATEGORIES = Object.freeze({
  weapon: 'a weapon firing, charging or being worked: a shot, a charge-up, a reload',
  impact: 'something meeting something: a round landing, a body hitting the ground',
  melee: 'a blade or a fist: the swing and what it meets',
  movement: 'a body moving: steps, jumps, landings, dodges',
  machinery: 'a machine running: thrusters, servos, engines, hydraulics',
  explosion: 'a blast, from a pop to a building going up',
  destruction: 'a thing breaking: glass, wood, stone, metal',
  elemental: 'fire, water, ice, lightning, wind',
  body: 'a body taking it: hurt, downed, dead',
  world: 'the things a world is worked by: a pickup, a door',
  stinger: 'a game event heard: a goal, a loss, a wave, a beat',
  sport: 'a contest\'s: the ball, the officials, the venue, the crowd',
  magic: 'a spell cast, healed, summoned, cursed',
  play: 'a run\'s, a puzzle\'s, a table\'s: coins and power-ups, pieces matched and placed, cards, dice',
  work: 'hands at work and things built: digging, chopping, mining, hammering, a tower raised',
});

/**
 * The audio channel's slots (scene/channels/audio.js and beats/sfx-palettes.js levelSfx): where a level plays a sound.
 * `on` is a bus event's cue (a level's `audio.on` row); `hold` a held voice a level drives by a control (an engine's
 * throttle, a beam's power); the rest are the gait, weapon, melee and jump seams.
 */
export const SLOTS = Object.freeze([
  'footsteps.step', 'footsteps.jump', 'footsteps.land',
  'jump.charge', 'jump.release', 'jump.land', 'thruster', 'dodge', 'hold',
  'weapon.shot', 'weapon.charge', 'weapon.chargedShot', 'weapon.hit', 'weapon.reload',
  'strike.swing', 'strike.hit',
  'on',
]);

const pal = (category, slot, label, aliases = []) => ({ label, aliases, category, palette: true, slot });
// voiced realistic by the layered set; the rescued `mecha` set is its floor (sets.js)
const mecha = (category, family, slot, label, aliases = []) => ({ label, aliases, category, family, voices: { realistic: 'mecha-layered' }, slot });

// built by a family (families.js) at a dial preset, voiced realistic
const made = (category, family, slot, label, aliases, fam, dials = {}) => ({ label, aliases, category, family, voices: { realistic: 'families' }, make: { family: fam, dials }, slot });

const ROWS = {
  // ── the palettes' cue ids (beats/sfx-palettes.js): voiced by arcade, foley, orchestral and synth ──
  jump: pal('movement', 'footsteps.jump', 'a jump', ['jumping']),
  land: pal('movement', 'footsteps.land', 'a landing', ['landing']),
  step: pal('movement', 'footsteps.step', 'a footstep', ['footstep', 'footsteps']),
  dodge: pal('movement', 'dodge', 'a dodge', ['dodging', 'roll']),
  shoot: pal('weapon', 'weapon.shot', 'a shot', ['shot', 'fire']),
  reload: pal('weapon', 'weapon.reload', 'a reload', ['reloading']),
  hit: pal('impact', 'weapon.hit', 'a hit landing', ['hit confirm']),
  thud: pal('impact', 'on', 'a heavy thud', ['thump']),
  swing: pal('melee', 'strike.swing', 'a swing', ['swipe', 'whoosh']),
  strike: pal('melee', 'strike.hit', 'a melee hit', ['melee hit']),
  down: pal('body', 'on', 'a foe going down', ['downed', 'knockout']),
  death: pal('body', 'on', 'a death', ['dead', 'dying']),
  pickup: pal('world', 'on', 'a pickup', ['collect', 'pick up']),
  door: pal('world', 'on', 'a door', ['doorway']),
  goal: pal('stinger', 'on', 'a goal reached', ['win', 'victory']),
  lose: pal('stinger', 'on', 'a loss', ['fail', 'defeat']),
  alarm: pal('stinger', 'on', 'an alarm: spotted', ['spotted', 'alert']),
  checkpoint: pal('stinger', 'on', 'a checkpoint', ['save point']),
  chime: pal('stinger', 'on', 'a chime: a lap, dawn', ['lap']),
  wave: pal('stinger', 'on', 'a wave coming', ['incoming']),
  'beat-hit': pal('stinger', 'on', 'a beat hit in time', ['on beat']),
  'beat-miss': pal('stinger', 'on', 'a beat missed', ['off beat']),

  // ── mech combat (sets/mecha.js, the floor; sets/mecha-layered.js, the realistic voice) ──
  'mech-step': mecha('movement', 'step', 'footsteps.step', 'a mobile suit\'s footstep', ['mech step', 'mech footstep']),
  'mech-land': mecha('movement', 'land', 'jump.land', 'a mobile suit landing: a metal clang under the weight', ['mech land', 'mech landing']),
  'mech-dodge': mecha('movement', 'dodge', 'dodge', 'a mobile suit\'s roll: three heavy contacts', ['mech dodge', 'mech roll']),
  'beam-blip': mecha('weapon', 'shoot', 'weapon.shot', 'a plain energy blip: the shot of a weapon with no sound of its own', ['blip shot', 'zap']),
  'beam-rifle-shot': mecha('weapon', 'shoot', 'weapon.shot', 'a beam rifle firing', ['beam rifle', 'long rifle', 'beam shot']),
  'beam-rifle-hit': mecha('impact', 'hit', 'weapon.hit', 'a beam round landing', ['beam hit', 'beam impact']),
  'beam-charge': mecha('weapon', null, 'weapon.charge', 'a beam rifle charging', ['charge up', 'beam charge']),
  'beam-charged-shot': mecha('weapon', 'shoot', 'weapon.chargedShot', 'a charged beam shot', ['charged shot', 'charge shot']),
  'bazooka-shot': mecha('weapon', 'shoot', 'weapon.shot', 'a bazooka firing', ['bazooka', 'launcher shot', 'rocket launch']),
  'bazooka-hit': mecha('impact', 'hit', 'weapon.hit', 'a bazooka round bursting', ['bazooka hit', 'shell burst']),
  'machine-gun-shot': mecha('weapon', 'shoot', 'weapon.shot', 'one round of a machine gun or a vulcan', ['machine gun', 'vulcan', 'gatling']),
  'saber-swing': mecha('melee', 'swing', 'strike.swing', 'a beam saber swung: crackling ozone', ['beam saber', 'saber swing']),
  'saber-hit': mecha('melee', 'strike', 'strike.hit', 'a beam saber connecting', ['saber hit', 'saber strike']),

  // ── built by the families (families.js): the presets people name; the dials reach the rest ──
  explosion: made('explosion', 'down', 'on', 'an explosion', ['blast', 'boom'], 'explosion'),
  'grenade-blast': made('explosion', 'down', 'on', 'a small blast: a grenade, a mine', ['grenade', 'small explosion'], 'explosion', { size: 'small' }),
  'big-explosion': made('explosion', 'down', 'on', 'a large blast', ['large explosion', 'big blast'], 'explosion', { size: 'large' }),
  'huge-explosion': made('explosion', 'down', 'on', 'a huge blast', ['massive explosion', 'huge blast'], 'explosion', { size: 'huge' }),
  'wreck-explosion': made('explosion', 'death', 'on', 'a machine\'s wreck going up: the blast and its plates coming apart', ['wreck', 'mech destroyed', 'suit destroyed'], 'explosion', { size: 'huge', metal: true }),
  'metal-impact': made('impact', 'hit', 'weapon.hit', 'a blow on metal', ['metal hit', 'clang'], 'impact', { material: 'metal' }),
  'stone-impact': made('impact', 'hit', 'weapon.hit', 'a blow on stone', ['stone hit', 'rock hit'], 'impact', { material: 'stone' }),
  'wood-impact': made('impact', 'hit', 'weapon.hit', 'a blow on wood', ['wood hit', 'knock'], 'impact', { material: 'wood' }),
  'dirt-impact': made('impact', 'thud', 'weapon.hit', 'a blow into the ground', ['dirt hit', 'ground hit'], 'impact', { material: 'dirt' }),
  'flesh-impact': made('impact', 'hit', 'weapon.hit', 'a blow on a body', ['body hit', 'flesh hit'], 'impact', { material: 'flesh' }),
  'water-impact': made('impact', 'hit', 'weapon.hit', 'a blow into water', ['water hit'], 'impact', { material: 'water' }),
  'armor-hit': made('body', 'hit', 'on', 'a machine\'s plating taking a hit', ['armor impact', 'plating hit', 'armour hit'], 'impact', { material: 'armor' }),
  'shield-hit': made('body', 'hit', 'on', 'a raised energy shield taking a hit', ['shield impact', 'energy hit'], 'impact', { material: 'energy' }),
  'step-concrete': made('movement', 'step', 'footsteps.step', 'a footstep on concrete', ['concrete step', 'concrete footstep'], 'footstep', { surface: 'concrete' }),
  'step-metal': made('movement', 'step', 'footsteps.step', 'a footstep on metal', ['metal step', 'metal footstep'], 'footstep', { surface: 'metal' }),
  'step-dirt': made('movement', 'step', 'footsteps.step', 'a footstep on dirt', ['dirt step', 'dirt footstep'], 'footstep', { surface: 'dirt' }),
  'step-grass': made('movement', 'step', 'footsteps.step', 'a footstep on grass', ['grass step', 'grass footstep'], 'footstep', { surface: 'grass' }),
  'step-gravel': made('movement', 'step', 'footsteps.step', 'a footstep on gravel', ['gravel step', 'gravel footstep'], 'footstep', { surface: 'gravel' }),
  'step-wood': made('movement', 'step', 'footsteps.step', 'a footstep on wood', ['wood step', 'wooden footstep'], 'footstep', { surface: 'wood' }),
  'step-snow': made('movement', 'step', 'footsteps.step', 'a footstep in snow', ['snow step', 'snow footstep'], 'footstep', { surface: 'snow' }),
  'step-water': made('movement', 'step', 'footsteps.step', 'a footstep in shallow water', ['water step', 'wading step'], 'footstep', { surface: 'water' }),
  'heavy-step': made('movement', 'step', 'footsteps.step', 'a heavy footstep: an armoured trooper, a brute', ['heavy footstep', 'armored footstep'], 'footstep', { body: 'heavy' }),
  'giant-step': made('movement', 'step', 'footsteps.step', 'a giant\'s footfall: the ground shaking', ['giant footstep', 'titan step'], 'footstep', { body: 'giant' }),
  'blade-swing': made('melee', 'swing', 'strike.swing', 'a blade swung', ['sword swing', 'blade whoosh'], 'melee', { act: 'blade-swing' }),
  'blade-hit': made('melee', 'strike', 'strike.hit', 'a blade connecting', ['sword hit', 'blade strike'], 'melee', { act: 'blade-hit' }),
  'blade-clash': made('melee', 'strike', 'on', 'two blades meeting', ['sword clash', 'parry'], 'melee', { act: 'clash' }),
  'energy-clash': made('melee', 'strike', 'on', 'two energy blades meeting', ['beam clash', 'saber clash'], 'melee', { act: 'clash', kind: 'energy' }),
  block: made('melee', 'strike', 'on', 'a blow blocked on a shield', ['shield block', 'blocked'], 'melee', { act: 'block' }),
  'blunt-swing': made('melee', 'swing', 'strike.swing', 'a club or a hammer swung', ['club swing', 'hammer swing'], 'melee', { act: 'blunt-swing' }),
  'blunt-hit': made('melee', 'strike', 'strike.hit', 'a club or a hammer connecting', ['club hit', 'hammer hit'], 'melee', { act: 'blunt-hit' }),
  punch: made('melee', 'strike', 'strike.hit', 'a punch landing', ['fist hit', 'punch hit'], 'melee', { act: 'punch' }),
  kick: made('melee', 'strike', 'strike.hit', 'a kick landing', ['kick hit'], 'melee', { act: 'kick' }),
  'pistol-shot': made('weapon', 'shoot', 'weapon.shot', 'a pistol fired', ['pistol', 'handgun shot', 'gunshot'], 'gunshot', { caliber: 'pistol' }),
  'smg-shot': made('weapon', 'shoot', 'weapon.shot', 'one round of a submachine gun', ['smg', 'submachine gun'], 'gunshot', { caliber: 'smg' }),
  'magnum-shot': made('weapon', 'shoot', 'weapon.shot', 'a magnum revolver fired', ['magnum', 'revolver shot'], 'gunshot', { caliber: 'magnum' }),
  'rifle-shot': made('weapon', 'shoot', 'weapon.shot', 'a rifle fired', ['rifle', 'assault rifle', 'rifle fire'], 'gunshot', { caliber: 'rifle' }),
  'shotgun-shot': made('weapon', 'shoot', 'weapon.shot', 'a shotgun fired', ['shotgun', 'shotgun blast'], 'gunshot', { caliber: 'shotgun' }),
  'sniper-shot': made('weapon', 'shoot', 'weapon.shot', 'a sniper rifle fired', ['sniper', 'sniper rifle'], 'gunshot', { caliber: 'sniper' }),
  'suppressed-shot': made('weapon', 'shoot', 'weapon.shot', 'a suppressed pistol fired', ['silenced shot', 'suppressed pistol'], 'gunshot', { caliber: 'pistol', suppressed: true }),
  'mag-out': made('weapon', 'reload', 'weapon.reload', 'a magazine dropped out', ['magazine out', 'mag eject'], 'handling', { act: 'mag-out' }),
  'mag-in': made('weapon', 'reload', 'weapon.reload', 'a magazine seated', ['magazine in', 'mag insert'], 'handling', { act: 'mag-in' }),
  rack: made('weapon', 'reload', 'weapon.reload', 'the slide or bolt racked', ['rack slide', 'chamber round'], 'handling', { act: 'rack' }),
  'weapon-switch': made('weapon', 'reload', 'on', 'a weapon drawn or switched', ['weapon swap', 'draw weapon'], 'handling', { act: 'switch' }),
  'dry-fire': made('weapon', 'reload', 'on', 'the trigger on an empty chamber', ['empty click', 'out of ammo'], 'handling', { act: 'dry-fire' }),
  'bullet-flyby': made('weapon', null, 'on', 'a bullet whizzing past', ['whiz', 'near miss'], 'projectile', { act: 'flyby' }),
  'beam-flyby': made('weapon', null, 'on', 'a beam passing close', ['beam pass'], 'projectile', { act: 'flyby', kind: 'beam' }),
  'rocket-flyby': made('weapon', null, 'on', 'a rocket roaring past', ['rocket pass', 'missile flyby'], 'projectile', { act: 'flyby', kind: 'rocket' }),
  ricochet: made('impact', 'hit', 'on', 'a round glancing off', ['ricochet ping', 'glancing hit'], 'projectile', { act: 'ricochet' }),
  'casing-drop': made('weapon', null, 'on', 'a spent casing bouncing on the floor', ['shell casing', 'brass drop'], 'projectile', { act: 'casing' }),
  'glass-break': made('destruction', 'thud', 'on', 'glass shattering', ['shatter', 'window break'], 'breakage', { material: 'glass' }),
  'wood-break': made('destruction', 'thud', 'on', 'wood splintering: a crate, a door', ['splinter', 'crate break'], 'breakage', { material: 'wood' }),
  'stone-break': made('destruction', 'thud', 'on', 'stone crumbling', ['crumble', 'rock break'], 'breakage', { material: 'stone' }),
  'metal-tear': made('destruction', 'thud', 'on', 'metal tearing', ['metal rip', 'tearing metal'], 'breakage', { material: 'metal' }),
  collapse: made('destruction', 'thud', 'on', 'a structure coming down', ['building collapse', 'cave in'], 'breakage', { material: 'stone', size: 'large' }),
  'fire-whoosh': made('elemental', null, 'on', 'fire flaring up', ['fireball', 'flame burst'], 'elemental', { element: 'fire' }),
  'ice-crack': made('elemental', null, 'on', 'ice cracking', ['ice shatter', 'freeze'], 'elemental', { element: 'ice' }),
  'lightning-strike': made('elemental', null, 'on', 'lightning striking, its thunder rolling', ['lightning', 'thunder'], 'elemental', { element: 'lightning' }),
  'water-splash': made('elemental', 'land', 'on', 'water splashing', ['splash'], 'elemental', { element: 'water' }),
  'wind-gust': made('elemental', null, 'on', 'a gust of wind', ['gust', 'wind'], 'elemental', { element: 'wind' }),
  'shield-up': made('body', null, 'on', 'an energy shield raised', ['shield on', 'barrier up'], 'shield', { act: 'up' }),
  'shield-down': made('body', null, 'on', 'an energy shield dropped', ['shield off', 'barrier down'], 'shield', { act: 'down' }),
  'shield-break': made('body', 'death', 'on', 'an energy shield failing', ['shield shatter', 'barrier break'], 'shield', { act: 'break' }),

  // ── held voices (families/held.js): driven by a control in 0..1, a sustain spec rather than a cue ──
  'rocket-booster': made('machinery', null, 'thruster', 'a rocket thruster held: a rough combustion roar', ['rocket thruster', 'rocket engine'], 'booster', { kind: 'rocket' }),
  'ion-drive': made('machinery', null, 'thruster', 'an ion drive held: a sci-fi hum', ['ion engine', 'sci-fi engine'], 'booster', { kind: 'ion' }),
  'car-engine': made('machinery', null, 'hold', 'a car\'s engine by its throttle', ['engine', 'car', 'car motor'], 'engine', { kind: 'car' }),
  'motorbike-engine': made('machinery', null, 'hold', 'a motorbike\'s engine by its throttle', ['motorbike', 'motorcycle'], 'engine', { kind: 'motorbike' }),
  'jet-engine': made('machinery', null, 'hold', 'a jet\'s turbine by its throttle', ['jet', 'turbine'], 'engine', { kind: 'jet' }),
  'prop-engine': made('machinery', null, 'hold', 'a propeller plane\'s engine by its throttle', ['propeller', 'prop plane'], 'engine', { kind: 'prop' }),
  'laser-beam': made('weapon', null, 'hold', 'a held laser beam by its power', ['held beam', 'laser'], 'beam', { kind: 'laser' }),
  'plasma-beam': made('weapon', null, 'hold', 'a held plasma stream by its power', ['plasma stream', 'plasma thrower'], 'beam', { kind: 'plasma' }),
  'charge-hum': made('weapon', null, 'hold', 'a charge filling', ['charging', 'charge loop'], 'charge', { kind: 'energy' }),
  'fire-burning': made('elemental', null, 'hold', 'a fire burning on, by its size', ['campfire', 'burning', 'torch'], 'fire', { kind: 'open' }),

  // ── by game type (families/sports, racing, adventure, play, life, horror, war) ──
  // sports
  'ball-kick': made('sport', 'thud', 'on', 'a ball kicked', ['kick ball', 'football kick'], 'ball', { act: 'kick' }),
  'ball-bounce': made('sport', 'thud', 'on', 'a ball bouncing', ['bounce', 'dribble'], 'ball', { act: 'bounce', ball: 'basketball' }),
  'racket-hit': made('sport', 'hit', 'on', 'a tennis ball struck', ['tennis hit', 'racket'], 'ball', { act: 'hit', ball: 'tennis' }),
  'golf-swing-hit': made('sport', 'hit', 'on', 'a golf ball driven', ['golf hit', 'tee shot'], 'ball', { act: 'hit', ball: 'golf' }),
  'ball-catch': made('sport', 'thud', 'on', 'a ball caught', ['catch', 'glove catch'], 'ball', { act: 'catch', ball: 'baseball' }),
  whistle: made('sport', 'alarm', 'on', 'a referee\'s whistle', ['referee whistle', 'foul'], 'sport', { act: 'whistle' }),
  'whistle-full-time': made('sport', 'goal', 'on', 'the final whistle: three blasts', ['final whistle', 'full time'], 'sport', { act: 'whistle-triple' }),
  'bat-crack': made('sport', 'hit', 'on', 'a bat cracking a ball', ['home run', 'bat hit'], 'sport', { act: 'bat-crack' }),
  'net-swish': made('sport', 'goal', 'on', 'a ball through the net, nothing but net', ['swish', 'basket'], 'sport', { act: 'net-swish' }),
  'goal-net': made('sport', 'goal', 'on', 'a ball hitting the back of the net', ['back of the net', 'goal scored'], 'sport', { act: 'goal-net' }),
  'goal-horn': made('sport', 'goal', 'on', 'the venue\'s horn for a goal', ['air horn', 'hockey horn'], 'sport', { act: 'horn' }),
  buzzer: made('sport', 'lose', 'on', 'the clock\'s buzzer', ['shot clock', 'time buzzer'], 'sport', { act: 'buzzer' }),
  'starter-pistol': made('sport', 'shoot', 'on', 'the starter\'s pistol', ['starting gun', 'race start'], 'sport', { act: 'starter-pistol' }),
  'boxing-bell': made('sport', 'chime', 'on', 'the ring\'s bell', ['ring bell', 'round bell'], 'sport', { act: 'bell' }),
  crowd: made('sport', null, 'hold', 'a crowd by its excitement', ['crowd roar', 'cheering', 'stadium crowd'], 'crowd', { kind: 'stadium' }),
  // racing
  'tire-squeal': made('machinery', null, 'hold', 'tyres squealing at their slip', ['skid', 'tire screech', 'drift'], 'tires', { surface: 'asphalt' }),
  'tire-dirt': made('machinery', null, 'hold', 'tyres churning dirt', ['dirt skid', 'rally slide'], 'tires', { surface: 'dirt' }),
  'tire-gravel': made('machinery', null, 'hold', 'tyres crunching gravel', ['gravel skid', 'gravel slide'], 'tires', { surface: 'gravel' }),
  'car-crash': made('impact', 'death', 'on', 'a vehicle crashing', ['crash', 'collision', 'wreck car'], 'crash'),
  'fender-bender': made('impact', 'hit', 'on', 'a light knock between cars', ['bump', 'light crash'], 'crash', { severity: 'light' }),
  'pileup': made('impact', 'death', 'on', 'a heavy crash', ['heavy crash', 'big crash'], 'crash', { severity: 'heavy' }),
  'gear-shift': made('machinery', 'reload', 'on', 'a gear changed', ['shift', 'gear change'], 'motoring', { act: 'gear-shift' }),
  'car-horn': made('machinery', 'alarm', 'on', 'a car\'s horn', ['honk', 'horn'], 'motoring', { act: 'horn' }),
  'truck-horn': made('machinery', 'alarm', 'on', 'a truck\'s air horn', ['lorry horn', 'big rig horn'], 'motoring', { act: 'truck-horn' }),
  'boost-pad': made('machinery', 'jump', 'on', 'a burst of speed: a boost pad, nitro', ['speed boost', 'nitro'], 'motoring', { act: 'boost' }),
  backfire: made('machinery', 'thud', 'on', 'an exhaust backfiring', ['exhaust pop'], 'motoring', { act: 'backfire' }),
  'car-door': made('machinery', 'door', 'on', 'a car door slammed', ['door slam car', 'car door slam'], 'motoring', { act: 'door-slam' }),
  'kart-engine': made('machinery', null, 'hold', 'a kart\'s engine by its throttle', ['kart', 'go kart'], 'engine', { kind: 'kart' }),
  'boat-engine': made('machinery', null, 'hold', 'an outboard by its throttle', ['boat', 'speedboat', 'outboard'], 'engine', { kind: 'boat' }),
  'helicopter': made('machinery', null, 'hold', 'a helicopter by its throttle', ['chopper', 'rotor'], 'engine', { kind: 'helicopter' }),
  // adventure
  'spell-cast': made('magic', 'shoot', 'on', 'a spell cast', ['cast', 'magic missile', 'spell'], 'magic', { act: 'cast' }),
  heal: made('magic', 'pickup', 'on', 'a healing spell', ['healing', 'cure', 'restore'], 'magic', { act: 'heal', school: 'light' }),
  buff: made('magic', 'checkpoint', 'on', 'a strengthening spell', ['power buff', 'enchant'], 'magic', { act: 'buff' }),
  teleport: made('magic', 'door', 'on', 'a teleport: gone, and here', ['warp', 'blink'], 'magic', { act: 'teleport' }),
  summon: made('magic', 'wave', 'on', 'a summoning', ['summoning', 'conjure'], 'magic', { act: 'summon' }),
  curse: made('magic', 'lose', 'on', 'a curse laid', ['hex', 'dark spell'], 'magic', { act: 'curse', school: 'dark' }),
  'nature-spell': made('magic', 'shoot', 'on', 'a nature spell: vines, a grove answering', ['druid spell', 'vine spell'], 'magic', { act: 'cast', school: 'nature' }),
  'bow-draw': made('weapon', 'reload', 'on', 'a bow drawn', ['draw bow', 'nock arrow'], 'bow', { act: 'draw' }),
  'bow-shot': made('weapon', 'shoot', 'weapon.shot', 'an arrow loosed', ['arrow shot', 'bow release', 'loose'], 'bow', { act: 'release' }),
  'crossbow-shot': made('weapon', 'shoot', 'weapon.shot', 'a crossbow bolt loosed', ['crossbow', 'bolt shot'], 'bow', { act: 'release', kind: 'crossbow' }),
  'arrow-flyby': made('weapon', null, 'on', 'an arrow passing close', ['arrow whiz', 'arrow pass'], 'bow', { act: 'flyby' }),
  'arrow-hit': made('impact', 'hit', 'weapon.hit', 'an arrow striking wood', ['arrow thunk', 'arrow in wood'], 'bow', { act: 'hit-wood' }),
  'arrow-target': made('impact', 'hit', 'weapon.hit', 'an arrow striking a target', ['bullseye', 'target hit'], 'bow', { act: 'hit-target' }),
  'chest-open': made('world', 'door', 'on', 'a chest opened', ['open chest', 'treasure chest'], 'interact', { act: 'chest-open' }),
  'chest-close': made('world', 'door', 'on', 'a chest closed', ['close chest', 'lid shut'], 'interact', { act: 'chest-close' }),
  lever: made('world', 'door', 'on', 'a lever pulled', ['pull lever', 'switch lever'], 'interact', { act: 'lever', material: 'metal' }),
  'pressure-plate': made('world', 'thud', 'on', 'a pressure plate pressed', ['floor switch', 'trap trigger'], 'interact', { act: 'pressure-plate', material: 'stone' }),
  'key-unlock': made('world', 'door', 'on', 'a key turned in a lock', ['unlock', 'unlocked'], 'interact', { act: 'key-unlock', material: 'metal' }),
  portcullis: made('world', 'door', 'on', 'a gate raised: a portcullis, a chain', ['gate open', 'gate raise'], 'interact', { act: 'gate', material: 'metal' }),
  'coin-drop': made('world', 'pickup', 'on', 'coins dropped and scattering', ['coins', 'gold coins', 'loot'], 'interact', { act: 'coins' }),
  'potion-drink': made('world', 'pickup', 'on', 'a potion drunk', ['drink potion', 'quaff'], 'interact', { act: 'potion' }),
  'door-creak': made('world', 'door', 'on', 'a door creaking open', ['creaking door', 'creak'], 'interact', { act: 'creak' }),
  'metal-creak': made('world', 'door', 'on', 'metal creaking: a hatch, a hull', ['hatch creak', 'hull groan'], 'interact', { act: 'creak', material: 'metal' }),
  // platformers, puzzles, tables
  coin: made('play', 'pickup', 'on', 'a coin collected', ['coin pickup', 'collect coin'], 'platform', { act: 'coin' }),
  gem: made('play', 'pickup', 'on', 'a gem collected', ['gem pickup', 'crystal pickup'], 'platform', { act: 'gem' }),
  'power-up': made('play', 'checkpoint', 'on', 'a power-up taken', ['powerup', 'level up'], 'platform', { act: 'power-up' }),
  'bounce-pad': made('play', 'jump', 'on', 'a bounce pad, a spring', ['spring', 'trampoline'], 'platform', { act: 'bounce-pad' }),
  stomp: made('play', 'strike', 'on', 'a foe stomped on', ['stomp enemy', 'head stomp'], 'platform', { act: 'stomp' }),
  'crumbling-ledge': made('play', 'thud', 'on', 'a ledge crumbling away', ['ledge crumble', 'platform crumble'], 'platform', { act: 'crumble' }),
  'ledge-grab': made('play', 'land', 'on', 'a ledge caught', ['grab ledge', 'hang'], 'platform', { act: 'ledge-grab' }),
  hurt: made('body', 'hit', 'on', 'a hero hurt', ['damage taken', 'ouch', 'player hurt'], 'platform', { act: 'hurt' }),
  'match-clear': made('play', 'chime', 'on', 'pieces matched', ['match', 'match three', 'combo'], 'puzzle', { act: 'match' }),
  'line-clear': made('play', 'goal', 'on', 'a line cleared', ['clear line', 'row clear'], 'puzzle', { act: 'clear' }),
  'piece-swap': made('play', 'swing', 'on', 'two pieces swapped', ['swap', 'swap tiles'], 'puzzle', { act: 'swap' }),
  'block-drop': made('play', 'thud', 'on', 'a block dropped into place', ['drop block', 'block land'], 'puzzle', { act: 'drop', material: 'stone' }),
  'block-push': made('play', 'thud', 'on', 'a block shoved across stone', ['push block', 'stone slide'], 'puzzle', { act: 'push', material: 'stone' }),
  'piece-lock': made('play', 'checkpoint', 'on', 'a piece clicking into place', ['click into place', 'lock in'], 'puzzle', { act: 'lock', material: 'wood' }),
  'piece-place': made('play', 'thud', 'on', 'a piece set on the board', ['place piece', 'chess move', 'move piece'], 'tabletop', { act: 'piece-place' }),
  'piece-slide': made('play', null, 'on', 'a piece slid across the board', ['slide piece'], 'tabletop', { act: 'piece-slide' }),
  'card-flip': made('play', null, 'on', 'a card flipped', ['flip card', 'turn card'], 'tabletop', { act: 'card-flip' }),
  'card-shuffle': made('play', null, 'on', 'a deck shuffled', ['shuffle', 'riffle'], 'tabletop', { act: 'card-shuffle' }),
  'card-deal': made('play', null, 'on', 'a card dealt', ['deal', 'deal card'], 'tabletop', { act: 'card-deal' }),
  'chip-stack': made('play', 'pickup', 'on', 'chips stacked', ['poker chips', 'bet chips'], 'tabletop', { act: 'chip-stack' }),
  'coin-flip': made('play', null, 'on', 'a coin flipped and landing', ['flip coin', 'toss coin'], 'tabletop', { act: 'coin-flip' }),
  'dice-roll': made('play', null, 'on', 'dice thrown', ['dice', 'roll dice'], 'dice', { count: 'two' }),
  // life sims
  dig: made('work', 'thud', 'on', 'a spade in earth', ['shovel', 'digging'], 'work', { act: 'dig' }),
  hoe: made('work', 'thud', 'on', 'a hoe tilling soil', ['till', 'tilling'], 'work', { act: 'hoe' }),
  plant: made('work', 'thud', 'on', 'a seed planted', ['sow', 'plant seed'], 'work', { act: 'plant' }),
  'watering-can': made('work', null, 'on', 'a watering can pouring', ['water plants', 'watering'], 'work', { act: 'water' }),
  harvest: made('work', 'pickup', 'on', 'a crop picked', ['pick crop', 'pluck'], 'work', { act: 'harvest' }),
  'axe-chop': made('work', 'hit', 'on', 'an axe into a log', ['chop wood', 'chop tree', 'axe'], 'work', { act: 'chop' }),
  'pickaxe-mine': made('work', 'hit', 'on', 'a pickaxe into stone', ['mine', 'mining', 'pickaxe'], 'work', { act: 'mine' }),
  'hammer-nail': made('work', 'hit', 'on', 'a hammer on a nail', ['hammering', 'nail'], 'work', { act: 'hammer' }),
  'saw-wood': made('work', null, 'on', 'a saw through wood', ['sawing', 'hand saw'], 'work', { act: 'saw' }),
  'fishing-cast': made('work', 'swing', 'on', 'a fishing line cast', ['cast line', 'fishing'], 'work', { act: 'cast-line' }),
  'fish-bite': made('work', 'pickup', 'on', 'a fish biting', ['bite', 'fish on'], 'work', { act: 'bite' }),
  sizzle: made('elemental', null, 'hold', 'a pan sizzling, by its heat', ['frying', 'cooking', 'sizzling'], 'cooking'),
  // horror and stealth
  heartbeat: made('body', null, 'hold', 'a heartbeat, by fear', ['heart beat', 'pulse'], 'heartbeat'),
  breathing: made('body', null, 'hold', 'breathing, by exertion', ['breath', 'panting'], 'breath'),
  jumpscare: made('stinger', 'alarm', 'on', 'a jumpscare\'s stab', ['scare', 'jump scare'], 'horror', { act: 'jumpscare' }),
  'distant-knock': made('world', null, 'on', 'three knocks somewhere else', ['knocking', 'three knocks'], 'horror', { act: 'distant-knock' }),
  'far-scrape': made('world', null, 'on', 'metal dragged far off', ['distant scrape', 'dragging metal'], 'horror', { act: 'far-scrape' }),
  'dread-drone': made('stinger', null, 'on', 'a drone swelling: something is coming', ['dread', 'tension rise'], 'horror', { act: 'drone-swell' }),
  // strategy, flight, brawlers
  'tower-place': made('work', 'thud', 'on', 'a tower placed', ['place tower', 'build tower', 'construct'], 'build', { act: 'place', material: 'stone' }),
  'tower-upgrade': made('work', 'checkpoint', 'on', 'a tower upgraded', ['upgrade', 'upgrade tower'], 'build', { act: 'upgrade', material: 'metal' }),
  demolish: made('work', 'down', 'on', 'a building demolished', ['sell tower', 'tear down'], 'build', { act: 'demolish', material: 'wood' }),
  repair: made('work', null, 'on', 'a building repaired', ['repairing', 'fix building'], 'build', { act: 'repair' }),
  catapult: made('weapon', 'shoot', 'on', 'a catapult loosed', ['trebuchet', 'catapult launch'], 'siege', { act: 'catapult' }),
  cannon: made('weapon', 'shoot', 'on', 'a cannon fired', ['cannon fire', 'artillery'], 'siege', { act: 'cannon' }),
  ballista: made('weapon', 'shoot', 'on', 'a ballista loosed', ['bolt thrower'], 'siege', { act: 'ballista' }),
  'arrow-volley': made('weapon', 'shoot', 'on', 'a volley of arrows', ['volley', 'arrow rain'], 'siege', { act: 'arrow-volley' }),
  'war-horn': made('stinger', 'wave', 'on', 'a war horn: the charge sounded', ['battle horn', 'horn call'], 'siege', { act: 'war-horn' }),
  'sonic-boom': made('machinery', 'thud', 'on', 'a sonic boom', ['sound barrier'], 'flight', { act: 'sonic-boom' }),
  'missile-launch': made('weapon', 'shoot', 'weapon.shot', 'a missile away', ['missile', 'fox two'], 'flight', { act: 'missile-launch' }),
  afterburner: made('machinery', 'jump', 'on', 'an afterburner lit', ['afterburners'], 'flight', { act: 'afterburner' }),
  'warp-jump': made('machinery', 'door', 'on', 'a warp jump', ['hyperspace', 'jump to warp'], 'flight', { act: 'warp-jump' }),
  'landing-gear': made('machinery', null, 'on', 'the landing gear lowered', ['gear down'], 'flight', { act: 'landing-gear' }),
  flares: made('weapon', null, 'on', 'flares dispensed', ['countermeasures', 'chaff'], 'flight', { act: 'flares' }),
  grab: made('melee', 'strike', 'on', 'a grab', ['grapple', 'clinch'], 'brawl', { act: 'grab' }),
  throw: made('melee', 'swing', 'on', 'a throw', ['toss', 'hurl'], 'brawl', { act: 'throw' }),
  'body-slam': made('melee', 'down', 'on', 'a body slammed down', ['slam', 'suplex'], 'brawl', { act: 'body-slam' }),
  uppercut: made('melee', 'strike', 'strike.hit', 'an uppercut', ['heavy punch', 'haymaker'], 'brawl', { act: 'uppercut' }),
  counter: made('melee', 'strike', 'on', 'a counter: a blow turned and returned', ['counter hit', 'riposte'], 'brawl', { act: 'counter' }),
  'knockout-blow': made('melee', 'down', 'on', 'a knockout blow', ['ko punch', 'finishing blow'], 'brawl', { act: 'knockout' }),
  // a katana (families/blades.js): the swing a stylized slash
  'katana-swing': made('melee', 'swing', 'strike.swing', 'a katana swung: a stylized slash', ['katana', 'katana slash', 'katana cut'], 'katana', { act: 'swing' }),
  'katana-heavy-swing': made('melee', 'swing', 'strike.swing', 'a heavy two-handed katana cut', ['heavy slash', 'katana heavy cut'], 'katana', { act: 'swing', weight: 'heavy' }),
  'katana-draw': made('melee', 'reload', 'on', 'a katana drawn from its saya', ['draw katana', 'unsheathe'], 'katana', { act: 'draw' }),
  'katana-sheathe': made('melee', 'reload', 'on', 'a katana sheathed', ['sheathe katana', 'sheathe'], 'katana', { act: 'sheathe' }),
  'katana-jostle': made('melee', 'step', 'footsteps.step', 'a sheathed katana jostling with a step', ['saya rattle', 'sword jostle'], 'katana', { act: 'jostle' }),

  // ── the audio channel's own synth slots (scene/channels/audio.js): its code plays them, unless the level gives the
  //    slot the row's voice (a port of that code, range for range) ──
  'thruster-roar': { ...made('machinery', null, 'thruster', 'a thruster held: a jet whine that swells with the thrust', ['thruster', 'boost', 'booster'], 'booster', { kind: 'jet' }), channel: 'thruster' },
  'jump-servo': { ...made('machinery', null, 'jump.charge', 'a jump gathering: a hydraulic servo straining, pistons chuffing faster', ['servo', 'jump charge'], 'servo'), channel: 'jump.charge' },
  'jump-launch': { ...made('machinery', null, 'jump.release', 'a jump released: a piston slam, heavier the longer it was held', ['piston slam', 'jump release'], 'launch'), channel: 'jump.release' },
};

const freezeRow = (r) => Object.freeze({ ...r, aliases: Object.freeze(r.aliases.slice()), ...(r.voices ? { voices: Object.freeze({ ...r.voices }) } : {}), ...(r.make ? { make: Object.freeze({ family: r.make.family, dials: Object.freeze({ ...r.make.dials }) }) } : {}) });
export const SOUNDS = Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([id, r]) => [id, freezeRow(r.palette ? { ...r, palette: id, family: id } : r)])));
export const SOUND_IDS = Object.freeze(Object.keys(SOUNDS));

/** A word as the index keys it: lower case, spaces, hyphens and underscores one space. */
export const normalizeName = (s) => String(s ?? '').toLowerCase().trim().replace(/[\s_-]+/g, ' ');

let index = null;
/** Every id and alias, normalized, to its row id. */
export function soundNameIndex() {
  if (index) return index;
  index = new Map();
  for (const [id, r] of Object.entries(SOUNDS)) for (const w of [id, ...r.aliases]) if (!index.has(normalizeName(w))) index.set(normalizeName(w), id);
  return index;
}

/** The row id a word names, or null. */
export function resolveSoundId(word) {
  if (word && SOUNDS[word]) return word;
  return soundNameIndex().get(normalizeName(word)) ?? null;
}

/** The rows of a category. */
export const soundsIn = (category) => SOUND_IDS.filter((id) => SOUNDS[id].category === category);

/** The categories with no row yet: what the shelf owes. */
export const sfxGaps = () => Object.keys(CATEGORIES).filter((c) => soundsIn(c).length === 0);
