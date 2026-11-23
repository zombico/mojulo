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
 *   recorded  true: the row is voiced by its recording (the sound library's, sfx-shelf/resolve.js), with no synthesized
 *             voice of its own (`voices` empty): its family stands in where it has one; with neither, it is silent
 *   say       the sound's own words (optional): its onomatopoeia, the Japanese in kana with its romaji (`カチャ`,
 *             `kacha`), English where it has one (`clink`). Mouth foley's scores are these words, so the word that
 *             makes a sound also finds it (find.js). One word may score several sounds (ヒュン is the katana's swing
 *             and the staff's), so a sound word ranks rows where an alias names one.
 *   matter, weight, genres   facets (facets.js) where the row's family and dials do not already say them
 *
 * Pure data and pure functions: no clock, no dice.
 */
import { MAGIC_ROWS } from './magic-sounds.js';

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
  creature: 'an animal or a monster heard: a growl, a snarl, a roar',
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

// a row the mouth set voices too (sets/mouth.js): mouth foley, traced from a voice; `more` its sound words and facets
const mouthed = (r, more = {}) => ({ ...r, ...more, voices: { ...(r.voices || {}), mouth: 'mouth' } });
// a row only the mouth voices (round 6: a body built from syllables, sets/mouth.js): its palette stand-in, if any, in `family`
const mouthOnly = (category, family, slot, label, aliases, more = {}) => ({ label, aliases, category, family, voices: { mouth: 'mouth' }, slot, ...more });

// built by a family (families.js) at a dial preset, voiced realistic
const made = (category, family, slot, label, aliases, fam, dials = {}) => ({ label, aliases, category, family, voices: { realistic: 'families' }, make: { family: fam, dials }, slot });
// a row voiced by its RECORDING (the sound library's): no synthesized voice of its own, its palette stand-in (`family`)
// where it has one, silent where it has none and the library is not installed
const recorded = (category, family, slot, label, aliases, more = {}) => ({ label, aliases, category, family, voices: {}, recorded: true, slot, ...more });

const ROWS = {
  // ── the palettes' cue ids (beats/sfx-palettes.js): voiced by arcade, foley, orchestral and synth ──
  jump: mouthed(pal('movement', 'footsteps.jump', 'a jump', ['jumping']), { say: ['ピョン', 'pyon'] }),
  land: mouthed(pal('movement', 'footsteps.land', 'a landing', ['landing']), { say: ['スタッ', 'suta'] }),
  step: pal('movement', 'footsteps.step', 'a footstep', ['footstep', 'footsteps']),
  dodge: mouthed(pal('movement', 'dodge', 'a dodge', ['dodging', 'roll']), { say: ['シュタッ', 'shuta'] }),
  shoot: pal('weapon', 'weapon.shot', 'a shot', ['shot', 'fire']),
  reload: pal('weapon', 'weapon.reload', 'a reload', ['reloading']),
  hit: mouthed(pal('impact', 'weapon.hit', 'a hit landing', ['hit confirm']), { say: ['バシッ', 'bashi', 'whack'] }),
  thud: pal('impact', 'on', 'a heavy thud', ['thump']),
  swing: mouthed(pal('melee', 'strike.swing', 'a swing', ['swipe', 'whoosh']), { say: ['シュッ', 'shu', 'swoosh'] }),
  strike: pal('melee', 'strike.hit', 'a melee hit', ['melee hit']),
  down: mouthed(pal('body', 'on', 'a foe going down', ['downed', 'knockout']), { say: ['ドサッ', 'dosa', 'thud down'] }),
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
  // ── an arm cannon (sets/buster.js): a run and gun's energy shots, the tap, the first charge and the full charge ──
  'buster-shot': { label: 'an arm cannon\'s shot: a bright pew of energy', aliases: ['arm cannon', 'buster', 'pew', 'energy shot', 'laser shot'], category: 'weapon', family: 'shoot', voices: { realistic: 'buster' }, slot: 'weapon.shot' },
  'buster-charged-shot': { label: 'an arm cannon\'s charged shot: lower, driven, a warble on it', aliases: ['buster charge shot', 'charged pew'], category: 'weapon', family: 'shoot', voices: { realistic: 'buster' }, slot: 'weapon.chargedShot' },
  'buster-full-shot': { label: 'an arm cannon\'s full charge let go: a blast with a long falling tail', aliases: ['full charge', 'buster blast', 'charged blast'], category: 'weapon', family: 'shoot', voices: { realistic: 'buster' }, slot: 'weapon.chargedShot' },
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
  'metal-impact': mouthed(made('impact', 'hit', 'weapon.hit', 'a blow on metal', ['metal hit', 'clang'], 'impact', { material: 'metal' }), { say: ['カン', 'kan', 'clank'] }),
  'stone-impact': made('impact', 'hit', 'weapon.hit', 'a blow on stone', ['stone hit', 'rock hit'], 'impact', { material: 'stone' }),
  'wood-impact': mouthed(made('impact', 'hit', 'weapon.hit', 'a blow on wood', ['wood hit', 'knock'], 'impact', { material: 'wood' }), { say: ['コツ', 'kotsu', 'knock'] }),
  'dirt-impact': made('impact', 'thud', 'weapon.hit', 'a blow into the ground', ['dirt hit', 'ground hit'], 'impact', { material: 'dirt' }),
  'flesh-impact': made('impact', 'hit', 'weapon.hit', 'a blow on a body', ['body hit', 'flesh hit'], 'impact', { material: 'flesh' }),
  'water-impact': made('impact', 'hit', 'weapon.hit', 'a blow into water', ['water hit'], 'impact', { material: 'water' }),
  'armor-hit': made('body', 'hit', 'on', 'a machine\'s plating taking a hit', ['armor impact', 'plating hit', 'armour hit'], 'impact', { material: 'armor' }),
  'shield-hit': made('body', 'hit', 'on', 'a raised energy shield taking a hit', ['shield impact', 'energy hit'], 'impact', { material: 'energy' }),
  'step-concrete': made('movement', 'step', 'footsteps.step', 'a footstep on concrete', ['concrete step', 'concrete footstep'], 'footstep', { surface: 'concrete' }),
  'step-pavement': made('movement', 'step', 'footsteps.step', 'a footstep on a pavement: a heel\'s clean click, barely a scuff', ['pavement step', 'sidewalk step', 'street footstep', 'heel step'], 'footstep', { surface: 'pavement' }),
  'step-metal': mouthed(made('movement', 'step', 'footsteps.step', 'a footstep on metal', ['metal step', 'metal footstep'], 'footstep', { surface: 'metal' }), { say: ['ガン', 'gan'] }),
  'step-dirt': mouthed(made('movement', 'step', 'footsteps.step', 'a footstep on dirt', ['dirt step', 'dirt footstep'], 'footstep', { surface: 'dirt' }), { say: ['ザッ', 'za'] }),
  'step-grass': mouthed(made('movement', 'step', 'footsteps.step', 'a footstep on grass', ['grass step', 'grass footstep'], 'footstep', { surface: 'grass' }), { say: ['サッ', 'sa'] }),
  'step-gravel': mouthed(made('movement', 'step', 'footsteps.step', 'a footstep on gravel', ['gravel step', 'gravel footstep'], 'footstep', { surface: 'gravel' }), { say: ['ジャリッ', 'jari', 'crunch'] }),
  'step-wood': mouthed(made('movement', 'step', 'footsteps.step', 'a footstep on wood', ['wood step', 'wooden footstep'], 'footstep', { surface: 'wood' }), { say: ['トン', 'ton'] }),
  'step-snow': mouthed(made('movement', 'step', 'footsteps.step', 'a footstep in snow', ['snow step', 'snow footstep'], 'footstep', { surface: 'snow' }), { say: ['サクッ', 'saku'] }),
  'step-water': mouthed(made('movement', 'step', 'footsteps.step', 'a footstep in shallow water', ['water step', 'wading step'], 'footstep', { surface: 'water' }), { say: ['バシャ', 'basha'] }),
  'heavy-step': made('movement', 'step', 'footsteps.step', 'a heavy footstep: an armoured trooper, a brute', ['heavy footstep', 'armored footstep'], 'footstep', { body: 'heavy' }),
  'giant-step': made('movement', 'step', 'footsteps.step', 'a giant\'s footfall: the ground shaking', ['giant footstep', 'titan step'], 'footstep', { body: 'giant' }),
  'blade-swing': mouthed(made('melee', 'swing', 'strike.swing', 'a blade swung', ['sword swing', 'blade whoosh'], 'melee', { act: 'blade-swing' }), { say: ['ザシュッ', 'zashu', 'shing'] }),
  'blade-hit': made('melee', 'strike', 'strike.hit', 'a blade connecting', ['sword hit', 'blade strike'], 'melee', { act: 'blade-hit' }),
  'blade-clash': mouthed(made('melee', 'strike', 'on', 'two blades meeting', ['sword clash', 'parry'], 'melee', { act: 'clash' }), { say: ['ガキン', 'gakin', 'clang'] }),
  'energy-clash': made('melee', 'strike', 'on', 'two energy blades meeting', ['beam clash', 'saber clash'], 'melee', { act: 'clash', kind: 'energy' }),
  block: made('melee', 'strike', 'on', 'a blow blocked on a shield', ['shield block', 'blocked'], 'melee', { act: 'block' }),
  'blunt-swing': made('melee', 'swing', 'strike.swing', 'a club or a hammer swung', ['club swing', 'hammer swing'], 'melee', { act: 'blunt-swing' }),
  'blunt-hit': made('melee', 'strike', 'strike.hit', 'a club or a hammer connecting', ['club hit', 'hammer hit'], 'melee', { act: 'blunt-hit' }),
  punch: mouthed(made('melee', 'strike', 'strike.hit', 'a punch landing', ['fist hit', 'punch hit'], 'melee', { act: 'punch' }), { say: ['シュッ', 'shu'] }),
  kick: mouthed(made('melee', 'strike', 'strike.hit', 'a kick landing', ['kick hit'], 'melee', { act: 'kick' }), { say: ['ブン', 'bun'] }),
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
  ricochet: mouthed(made('impact', 'hit', 'on', 'a round glancing off', ['ricochet ping', 'glancing hit'], 'projectile', { act: 'ricochet' }), { say: ['チュン', 'chun', 'ping', 'zing'] }),
  'casing-drop': made('weapon', null, 'on', 'a spent casing bouncing on the floor', ['shell casing', 'brass drop'], 'projectile', { act: 'casing' }),
  'glass-break': made('destruction', 'thud', 'on', 'glass shattering', ['shatter', 'window break'], 'breakage', { material: 'glass' }),
  'wood-break': made('destruction', 'thud', 'on', 'wood splintering: a crate, a door', ['splinter', 'crate break'], 'breakage', { material: 'wood' }),
  'stone-break': made('destruction', 'thud', 'on', 'stone crumbling', ['crumble', 'rock break'], 'breakage', { material: 'stone' }),
  'metal-tear': made('destruction', 'thud', 'on', 'metal tearing', ['metal rip', 'tearing metal'], 'breakage', { material: 'metal' }),
  collapse: made('destruction', 'thud', 'on', 'a structure coming down', ['building collapse', 'cave in'], 'breakage', { material: 'stone', size: 'large' }),
  'fire-whoosh': made('elemental', null, 'on', 'fire flaring up', ['fireball', 'flame burst'], 'elemental', { element: 'fire' }),
  'ice-crack': made('elemental', null, 'on', 'ice cracking', ['ice shatter', 'freeze'], 'elemental', { element: 'ice' }),
  'lightning-strike': mouthed(made('elemental', null, 'on', 'lightning striking, its thunder rolling', ['lightning', 'thunder'], 'elemental', { element: 'lightning' }), { say: ['ゴロゴロ', 'gorogoro', 'kaboom'] }),
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
  'net-swish': mouthed(made('sport', 'goal', 'on', 'a ball through the net, nothing but net', ['swish', 'basket'], 'sport', { act: 'net-swish' }), { say: ['スパッ', 'supa', 'swish'] }),
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
  'road-car-engine': made('machinery', null, 'hold', 'a road car\'s engine as a game plays it: its note high enough for a small speaker, a burble, the tyres\' hiss', ['road car engine', 'street car engine', 'driving engine'], 'engine', { kind: 'road' }),
  // (the road car's sound design, the open city's: its growl under load, its tyres rolling, the city's traffic far off;
  // its door opened, its engine started and stopped, its brakes)
  'road-car-load': made('machinery', null, 'hold', 'a road car under load: the exhaust\'s growl and the intake as the pedal goes down, silent coasting', ['engine load', 'exhaust growl', 'throttle growl'], 'exhaust', { kind: 'road' }),
  'road-roar': made('machinery', null, 'hold', 'a car rolling on the road: its tyres\' roar and the wind past it, by the speed', ['road noise', 'tyre roar', 'tire roar', 'rolling'], 'tires', { surface: 'road' }),
  'traffic-hum': made('world', null, 'hold', 'a city\'s traffic far off and all round: its tyres\' wash, its engines\' murmur', ['traffic', 'city traffic', 'distant traffic', 'city hum'], 'ambience', { kind: 'traffic' }),
  'car-door-open': made('machinery', 'door', 'on', 'a car door opened: the latch, the door\'s swing', ['open car door', 'door latch car'], 'motoring', { act: 'door-open' }),
  'car-ignition': made('machinery', null, 'on', 'a car started: the starter cranking, the engine catching and revving', ['ignition', 'engine start', 'starter', 'start the car'], 'motoring', { act: 'ignition' }),
  'car-engine-off': made('machinery', null, 'on', 'a car\'s engine stopped: its note falling away, a click, a tick as it cools', ['engine off', 'engine stop', 'turn off the car'], 'motoring', { act: 'engine-off' }),
  'brake-squeal': made('machinery', null, 'on', 'a car\'s brakes squealing as it stops hard', ['brakes', 'brake', 'squealing brakes'], 'motoring', { act: 'brake-squeal' }),
  'diesel-engine': made('machinery', null, 'hold', 'a heavy diesel by its throttle: a truck, a carrier, a walking machine\'s power pack', ['diesel', 'truck engine', 'heavy engine'], 'engine', { kind: 'diesel' }),
  'tank-engine': made('machinery', null, 'hold', 'a tracked vehicle by its throttle: its diesel and its tracks clanking', ['tank engine', 'tracked engine', 'track clatter'], 'engine', { kind: 'tracked' }),
  'steam-hiss': made('machinery', null, 'hold', 'a machine venting steam, by its pressure: its exhaust hissing and chuffing', ['steam', 'steam vent', 'exhaust steam', 'venting'], 'servo', { kind: 'steam' }),
  'walker-hydraulics': made('machinery', null, 'hold', 'a walking machine\'s hydraulics by its pace: its pump straining, its valves chuffing with its steps', ['hydraulics', 'walker servo', 'mech hydraulics'], 'servo', { kind: 'walker' }),
  'boat-engine': made('machinery', null, 'hold', 'an outboard by its throttle', ['boat', 'speedboat', 'outboard'], 'engine', { kind: 'boat' }),
  'helicopter': made('machinery', null, 'hold', 'a helicopter by its throttle', ['chopper', 'rotor'], 'engine', { kind: 'helicopter' }),
  'drone-motors': made('machinery', null, 'hold', 'a multirotor drone\'s motors and props by its throttle', ['quadcopter buzz', 'drone buzz', 'multirotor'], 'engine', { kind: 'multirotor' }),
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
  'arrow-hit': mouthed(made('impact', 'hit', 'weapon.hit', 'an arrow striking wood', ['arrow thunk', 'arrow in wood'], 'bow', { act: 'hit-wood' }), { say: ['トスッ', 'tosu', 'thunk'] }),
  'arrow-target': made('impact', 'hit', 'weapon.hit', 'an arrow striking a target', ['bullseye', 'target hit'], 'bow', { act: 'hit-target' }),
  'chest-open': made('world', 'door', 'on', 'a chest opened', ['open chest', 'treasure chest'], 'interact', { act: 'chest-open' }),
  'chest-close': made('world', 'door', 'on', 'a chest closed', ['close chest', 'lid shut'], 'interact', { act: 'chest-close' }),
  lever: mouthed(made('world', 'door', 'on', 'a lever pulled', ['pull lever', 'switch lever'], 'interact', { act: 'lever', material: 'metal' }), { say: ['ガコン', 'gakon'] }),
  'pressure-plate': made('world', 'thud', 'on', 'a pressure plate pressed', ['floor switch', 'trap trigger'], 'interact', { act: 'pressure-plate', material: 'stone' }),
  'key-unlock': made('world', 'door', 'on', 'a key turned in a lock', ['unlock', 'unlocked'], 'interact', { act: 'key-unlock', material: 'metal' }),
  portcullis: made('world', 'door', 'on', 'a gate raised: a portcullis, a chain', ['gate open', 'gate raise'], 'interact', { act: 'gate', material: 'metal' }),
  'coin-drop': mouthed(made('world', 'pickup', 'on', 'coins dropped and scattering', ['coins', 'gold coins', 'loot'], 'interact', { act: 'coins' }), { say: ['チャリン', 'charin', 'clink', 'jingle'] }),
  'potion-drink': mouthed(made('world', 'pickup', 'on', 'a potion drunk', ['drink potion', 'quaff'], 'interact', { act: 'potion' }), { say: ['ゴクッ', 'goku', 'gulp'] }),
  'door-creak': mouthed(made('world', 'door', 'on', 'a door creaking open', ['creaking door', 'creak'], 'interact', { act: 'creak' }), { say: ['ギギギ', 'gigigi', 'creak'] }),
  'metal-creak': made('world', 'door', 'on', 'metal creaking: a hatch, a hull', ['hatch creak', 'hull groan'], 'interact', { act: 'creak', material: 'metal' }),
  // platformers, puzzles, tables
  coin: made('play', 'pickup', 'on', 'a coin collected', ['coin pickup', 'collect coin'], 'platform', { act: 'coin' }),
  gem: made('play', 'pickup', 'on', 'a gem collected', ['gem pickup', 'crystal pickup'], 'platform', { act: 'gem' }),
  'power-up': mouthed(made('play', 'checkpoint', 'on', 'a power-up taken', ['powerup', 'level up'], 'platform', { act: 'power-up' }), { say: ['キュイーン', 'kyuiin'] }),
  'bounce-pad': mouthed(made('play', 'jump', 'on', 'a bounce pad, a spring', ['spring', 'trampoline'], 'platform', { act: 'bounce-pad' }), { say: ['ピョーン', 'pyoon', 'boing'] }),
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
  uppercut: mouthed(made('melee', 'strike', 'strike.hit', 'an uppercut', ['heavy punch', 'haymaker'], 'brawl', { act: 'uppercut' }), { say: ['ドカッ', 'doka', 'pow'] }),
  counter: made('melee', 'strike', 'on', 'a counter: a blow turned and returned', ['counter hit', 'riposte'], 'brawl', { act: 'counter' }),
  'knockout-blow': made('melee', 'down', 'on', 'a knockout blow', ['ko punch', 'finishing blow'], 'brawl', { act: 'knockout' }),
  // a katana (families/blades.js): the swing a stylized slash
  'katana-swing': mouthed(made('melee', 'swing', 'strike.swing', 'a katana swung: a stylized slash', ['katana', 'katana slash', 'katana cut'], 'katana', { act: 'swing' }), { say: ['ヒュン', 'hyun'] }),
  'katana-heavy-swing': mouthed(made('melee', 'swing', 'strike.swing', 'a heavy two-handed katana cut', ['heavy slash', 'katana heavy cut'], 'katana', { act: 'swing', weight: 'heavy' })),
  // a swish reversed into a short forward tail: the swell before a strike lands or a dash goes. Only the mouth voices it
  'swell-in': { label: 'a swish swelling in: a reversed whoosh', aliases: ['swell', 'reverse whoosh', 'whoosh in'], category: 'melee', family: 'swing', voices: { mouth: 'mouth' }, slot: 'strike.swing', say: ['スッ', 'su'] },
  'katana-draw': mouthed(made('melee', 'reload', 'on', 'a katana drawn from its saya', ['draw katana', 'unsheathe'], 'katana', { act: 'draw' }), { say: ['シャキーン', 'shakiin', 'shing'] }),
  'katana-sheathe': mouthed(made('melee', 'reload', 'on', 'a katana sheathed', ['sheathe katana', 'sheathe'], 'katana', { act: 'sheathe' }), { say: ['チャキン', 'chakin'] }),
  'katana-jostle': made('melee', 'step', 'footsteps.step', 'a sheathed katana jostling with a step', ['saya rattle', 'sword jostle'], 'katana', { act: 'jostle' }),

  // ── mouth foley's bodies (sets/mouth.js, the bake's round 6): the word the score, its syllables held, layered or struck
  //    under ~150 ms; only the mouth voices them, so a realistic or palette game hears its stand-in (`family`) or none ──
  growl: mouthOnly('creature', null, 'on', 'a growl: a beast held low in its throat, a warning', ['growling', 'beast growl', 'low growl'], { say: ['グルル', 'gururu', 'grr'], matter: ['creature', 'voice'] }),
  snarl: mouthOnly('creature', null, 'on', 'a snarl: teeth bared, the breath through them', ['snarling', 'bared teeth'], { say: ['ガルル', 'garuru'], matter: ['creature', 'voice'] }),
  'roar-lion': mouthOnly('creature', null, 'on', 'a lion\'s roar: dark and low, rising into its A', ['lion roar', 'roar', 'big cat roar', 'beast roar'], { say: ['ガオー', 'gao', 'oa'], matter: ['creature', 'voice'], weight: 'heavy' }),
  'roar-bear': mouthOnly('creature', null, 'on', 'a bear\'s roar: mid and breathy, rising', ['bear roar', 'bear growl'], { say: ['グワァ', 'guwa', 'ea'], matter: ['creature', 'voice'], weight: 'heavy' }),
  'roar-monster': mouthOnly('creature', null, 'on', 'a giant monster\'s roar: a high screech climbing higher', ['monster roar', 'kaiju roar', 'giant monster', 'dragon roar'], { say: ['ギャオー', 'gyao', 'ia'], matter: ['creature', 'voice'], weight: 'heavy' }),
  'staff-swing': mouthOnly('melee', 'swing', 'strike.swing', 'a staff swung through the air', ['staff', 'bo staff', 'quarterstaff', 'pole swing'], { say: ['ヒュン', 'hyun'], matter: ['air', 'wood'] }),
  'staff-twirl': mouthOnly('melee', 'swing', 'strike.swing', 'a staff twirled: whop whop', ['twirl', 'staff spin', 'spin staff', 'whop whop'], { say: ['ブンブン', 'bunbun', 'whop'], matter: ['air', 'wood'] }),
  nunchaku: mouthOnly('melee', 'swing', 'strike.swing', 'nunchaku whipped in a figure-eight', ['nunchucks', 'nunchuks', 'chain sticks'], { say: ['ヒュンヒュン', 'hyunhyun'], matter: ['air', 'wood'], weight: 'light' }),
  'sword-guard': mouthOnly('melee', 'reload', 'on', 'a sword\'s guard clicked, a gun handled: a ready click', ['guard click', 'blade ready', 'sword click', 'koiguchi'], { say: ['チャキッ', 'chaki'], matter: ['metal'], weight: 'light' }),
  latch: mouthOnly('world', 'door', 'on', 'a latch, a catch, a clasp', ['door catch', 'clasp', 'latch click'], { say: ['カチャ', 'kacha'], matter: ['metal'], weight: 'light' }),
  'armour-clank': mouthOnly('movement', 'step', 'footsteps.step', 'armour clanking: a heavy latch, plates as a body moves', ['armour', 'armor', 'armor clank', 'plate armour', 'heavy latch'], { say: ['ガチャ', 'gacha', 'clank'], matter: ['metal'], weight: 'heavy' }),
  spark: mouthOnly('elemental', 'hit', 'on', 'a spark, a switch flicked', ['switch', 'light switch', 'snap spark'], { say: ['パチッ', 'pachi', 'snap'], matter: ['electric'], weight: 'light' }),
  'electric-crackle': mouthOnly('elemental', null, 'on', 'electricity crackling over a low hum', ['electric', 'electricity', 'live wire', 'sparking'], { say: ['バチバチ', 'bachibachi', 'crackle', 'zap'], matter: ['electric'] }),
  drip: mouthOnly('elemental', null, 'on', 'a drip, a small splash', ['dripping', 'water drop', 'droplet'], { say: ['ピチャ', 'picha', 'plip'], matter: ['water'], weight: 'light' }),
  scissors: mouthOnly('work', null, 'on', 'scissors snipping', ['snip', 'shears', 'cut cloth'], { say: ['チョキン', 'chokin'], matter: ['metal'], weight: 'light' }),
  ticking: mouthOnly('world', null, 'on', 'ticking: a clock, a timer, a fuse counting down', ['tick tock', 'clock', 'timer', 'countdown tick'], { say: ['カチカチ', 'kachikachi', 'tick'], matter: ['machine', 'metal'], weight: 'light' }),
  wade: mouthOnly('movement', 'step', 'footsteps.step', 'wading: a step through water', ['wading', 'splash step', 'water wade'], { say: ['バシャッ', 'basha', 'splash'], matter: ['water'] }),
  'fire-crackle': mouthOnly('elemental', null, 'on', 'a fire crackling: its pops, scattered', ['crackling fire', 'fire pops', 'fire crackling', 'bonfire'], { say: ['パチパチ', 'pachipachi'], matter: ['fire', 'wood'] }),
  // round 7 (passed by ear 2026-11-11)
  slide: mouthOnly('movement', 'dodge', 'dodge', 'a slide along the ground', ['sliding', 'baseball slide', 'ground slide'], { say: ['ズザーッ', 'zuza'], matter: ['earth', 'cloth'] }),
  stab: mouthOnly('melee', 'strike', 'strike.hit', 'a stab: a blade going in', ['stabbing', 'thrust', 'blade in'], { say: ['ズブッ', 'zubu'], matter: ['metal', 'flesh'] }),
  shuriken: mouthOnly('weapon', 'swing', 'on', 'shuriken thrown: two whips through the air', ['throwing star', 'throwing stars'], { say: ['シュシュッ', 'shushu'], matter: ['air', 'metal'], weight: 'light' }),
  sparkle: mouthOnly('magic', 'chime', 'on', 'a sparkle: a twinkle of small bright rings', ['twinkle', 'magic sparkle', 'glitter'], { say: ['キラキラ', 'kirakira'], matter: ['energy', 'glass'], weight: 'light' }),
  eat: mouthOnly('body', 'pickup', 'on', 'eating: chewing, twice', ['eating', 'chewing', 'munch', 'chomp'], { say: ['モグモグ', 'mogumogu'], matter: ['flesh', 'voice'] }),
  // round 7b (passed by ear 2026-11-11), and what the operator heard some takes as
  'power-up-rings': mouthOnly('play', 'checkpoint', 'on', 'a power-up as rising rings', ['rising chime', 'power chime', 'chime up'], { say: ['キラリン', 'kirarin'], matter: ['energy', 'metal'] }),
  'power-up-glass': mouthOnly('play', 'checkpoint', 'on', 'a power-up struck like glass: a bright ring and its tinkles', ['glass chime', 'crystal chime', 'tinkle up'], { say: ['パリン', 'parin'], matter: ['glass', 'energy'] }),
  bubbles: mouthOnly('elemental', null, 'on', 'bubbles rising: a pop and a quick rise, underwater', ['bubble', 'underwater bubbles', 'air bubbles'], { say: ['ポコポコ', 'pokopoko', 'blub'], matter: ['water', 'air'], weight: 'light' }),
  bubbling: mouthOnly('elemental', null, 'on', 'bubbling: a pot, a swamp, a cauldron', ['boiling', 'cauldron', 'swamp bubbles'], { matter: ['water'] }),
  button: mouthOnly('world', 'checkpoint', 'on', 'a button pressed', ['press button', 'button click', 'push button'], { say: ['カチッ', 'kachi', 'click'], matter: ['synthetic', 'metal'], weight: 'light' }),
  rattle: mouthOnly('creature', null, 'on', 'a rattle: a rattlesnake, maracas', ['rattlesnake', 'maracas', 'snake rattle', 'shaker'], { matter: ['creature', 'synthetic'] }),
  'bucket-splash': mouthOnly('elemental', null, 'on', 'water hitting a bucket', ['bucket', 'water in bucket', 'pail splash'], { matter: ['water', 'metal'], weight: 'light' }),
  'horse-neigh': mouthOnly('creature', null, 'on', 'a horse\'s neigh', ['horse', 'neigh', 'whinny'], { say: ['ヒヒーン', 'hihiin'], matter: ['creature', 'voice'] }),
  // round 7c: birds whistled (the kernel's own tones), passed by ear 2026-11-11
  'bird-chirp': mouthOnly('creature', 'chime', 'on', 'a small bird\'s chirp: piyo piyo', ['chirp', 'bird', 'tweet', 'songbird'], { say: ['ピヨピヨ', 'piyopiyo'], matter: ['creature', 'air'], weight: 'light' }),
  sparrow: mouthOnly('creature', 'chime', 'on', 'a sparrow\'s quick chirps', ['sparrows', 'chirping'], { say: ['チュンチュン', 'chunchun'], matter: ['creature', 'air'], weight: 'light' }),
  'bird-trill': mouthOnly('creature', 'chime', 'on', 'a bird\'s trill', ['trill', 'bird trill'], { say: ['ピピピッ', 'pipipi'], matter: ['creature', 'air'], weight: 'light' }),
  'bird-warble': mouthOnly('creature', 'chime', 'on', 'a bird\'s warble: a held note, then a fall', ['warble', 'birdsong'], { say: ['ピーヨ', 'piiyo'], matter: ['creature', 'air'], weight: 'light' }),
  // round 8b: bird calls whose traces were heard as other animals (the operator, 2026-11-11)
  'dog-bark': mouthOnly('creature', null, 'on', 'a dog barking, twice', ['bark', 'barking', 'dog', 'woof'], { matter: ['creature', 'voice'] }),
  'cat-hiss': mouthOnly('creature', null, 'on', 'a cat hissing', ['cat', 'hissing cat', 'angry cat'], { matter: ['creature', 'air'] }),
  'trumpet-call': mouthOnly('stinger', 'goal', 'on', 'a short trumpet call: four notes rising, the last held', ['trumpet', 'bugle', 'bugle call'], { matter: ['machine', 'metal'] }),
  // birds in the kernel's syrinx (passed by ear 2026-11-11): a buzz and a breath through the bird's resonances
  crow: mouthOnly('creature', null, 'on', 'a crow cawing, three times', ['caw', 'crows', 'cawing'], { say: ['カァ', 'kaa'], matter: ['creature', 'voice'] }),
  raven: mouthOnly('creature', null, 'on', 'a raven croaking, twice', ['croak', 'ravens', 'croaking'], { say: ['グワッ', 'guwa'], matter: ['creature', 'voice'] }),
  eagle: mouthOnly('creature', null, 'on', 'an eagle\'s scream, a hawk\'s', ['hawk', 'screech', 'raptor', 'bird of prey'], { say: ['キィーアー', 'kiiaa'], matter: ['creature', 'voice'] }),
  goose: mouthOnly('creature', null, 'on', 'a goose honking, twice', ['goose honk', 'honking goose'], { say: ['ガー', 'gaa'], matter: ['creature', 'voice'] }),
  geese: mouthOnly('creature', null, 'on', 'a flock of geese honking', ['flock', 'geese flock', 'flock of geese'], { say: ['ガーガー', 'gaagaa'], matter: ['creature', 'voice'] }),
  duck: mouthOnly('creature', null, 'on', 'a duck quacking, three times', ['quack', 'ducks', 'quacking'], { say: ['グワッグワッ', 'guwaguwa'], matter: ['creature', 'voice'] }),
  chicken: mouthOnly('creature', null, 'on', 'a hen clucking, then a bawk', ['cluck', 'hen', 'clucking'], { say: ['コッコッ', 'kokko'], matter: ['creature', 'voice'] }),
  rooster: mouthOnly('creature', null, 'on', 'a rooster crowing', ['crowing', 'cockerel', 'cock a doodle doo', 'dawn crow'], { say: ['コケコッコー', 'kokekokkoo'], matter: ['creature', 'voice'] }),
  // round 10 (passed 2026-11-11): what a game's environments need most
  'step-sand': mouthOnly('movement', 'step', 'footsteps.step', 'a footstep in sand', ['sand step', 'sand footstep', 'beach step'], { say: ['サッ', 'sa'], matter: ['earth'] }),
  'step-mud': mouthOnly('movement', 'step', 'footsteps.step', 'a footstep in mud', ['mud step', 'mud', 'muddy step', 'squelch'], { say: ['ベチャ', 'becha'], matter: ['earth', 'water'] }),
  'step-leaves': mouthOnly('movement', 'step', 'footsteps.step', 'a footstep on dry leaves', ['leaves', 'leaf step', 'dry leaves', 'leaf litter'], { say: ['ガサッ', 'gasa'], matter: ['earth', 'paper'] }),
  raindrop: mouthOnly('elemental', null, 'on', 'a raindrop', ['rain drop', 'drop'], { say: ['ポツ', 'potsu'], matter: ['water'], weight: 'light' }),
  'thunder-far': mouthOnly('elemental', null, 'on', 'thunder far off: a long dark rumble', ['distant thunder', 'rumble', 'far thunder'], { matter: ['air', 'electric'], weight: 'heavy' }),
  cricket: mouthOnly('creature', null, 'on', 'a cricket chirping', ['crickets', 'chirping cricket', 'night insects'], { say: ['リリリ', 'ririri'], matter: ['creature'], weight: 'light' }),
  frog: mouthOnly('creature', null, 'on', 'a frog croaking, twice', ['croaking frog', 'toad', 'ribbit'], { say: ['ゲロゲロ', 'gerogero'], matter: ['creature', 'voice'] }),
  owl: mouthOnly('creature', null, 'on', 'an owl hooting', ['hoot', 'owls', 'hooting'], { say: ['ホーホー', 'hoohoo'], matter: ['creature', 'air'] }),
  fly: mouthOnly('creature', null, 'on', 'a fly buzzing by', ['buzzing fly', 'housefly', 'insect buzz'], { say: ['ブーン', 'buun', 'bzz'], matter: ['creature', 'air'], weight: 'light' }),
  // the wolf's howl (round 10) heard as a European ambulance (the operator)
  siren: mouthOnly('machinery', 'alarm', 'on', 'a siren: a European ambulance\'s rise and fall', ['ambulance', 'ambulance siren', 'emergency siren'], { matter: ['machine'] }),
  // round 10b's howls, heard as other things (the operator, 2026-11-11)
  'retro-howl': mouthOnly('stinger', 'wave', 'on', 'a retro howl: an 80s arcade game\'s', ['arcade howl', '8-bit howl', 'retro wolf'], { matter: ['synthetic'], genres: ['run-and-gun', 'endless-runner', 'collectathon'] }),
  'retro-howl-duo': mouthOnly('stinger', 'wave', 'on', 'a retro howl in two voices, a third apart: an 80s arcade game\'s', ['arcade howl duo', 'retro howl pair'], { matter: ['synthetic'], genres: ['run-and-gun', 'endless-runner', 'collectathon'] }),
  'roar-lion-long': mouthOnly('creature', null, 'on', 'a lion\'s long roar, rising and held', ['long roar', 'lion long roar'], { matter: ['creature', 'voice'], weight: 'heavy' }),
  'motor-rev': mouthOnly('machinery', null, 'on', 'a small motor revving up and down', ['motor', 'small motor', 'motor whine', 'rev'], { matter: ['machine'] }),
  'wolf-howl': mouthOnly('creature', null, 'on', 'wolves howling: two, the second joining higher, each closing tight', ['howl', 'wolf', 'wolves howling', 'howling'], { say: ['ワオーン', 'waoon', 'awoo'], matter: ['creature', 'voice'] }),
  'bat-squeak': mouthOnly('creature', null, 'on', 'a bat\'s squeak', ['bat', 'squeak bat'], { matter: ['creature'], weight: 'light' }),
  'bat-squeak-high': mouthOnly('creature', null, 'on', 'a bat\'s squeak, higher and shorter', ['high bat squeak', 'small bat'], { matter: ['creature'], weight: 'light' }),
  'bat-chatter': mouthOnly('creature', null, 'on', 'bats chattering', ['bats', 'bat swarm', 'cave bats'], { matter: ['creature'], weight: 'light' }),
  'bat-wings': mouthOnly('creature', null, 'on', 'wings flapping: a bat, a small bird', ['wings', 'flapping', 'wing flaps', 'flutter'], { say: ['バサバサ', 'basabasa', 'flap'], matter: ['air', 'creature'], weight: 'light' }),
  // the voice protoform (families/voice.js): a person's efforts, composed for any voice by its dials (a game's hero's)
  'jump-effort': made('body', 'jump', 'footsteps.jump', 'a jump\'s effort: a short hup', ['jump grunt', 'hup', 'jump effort'], 'voice', { effort: 'jump' }),
  'hurt-grunt': made('body', 'hit', 'on', 'a grunt on being hit', ['grunt', 'hit grunt', 'pain grunt'], 'voice', { effort: 'hurt' }),
  'hurt-heavy': made('body', 'hit', 'on', 'a cry on a heavy hit', ['pain cry', 'heavy grunt', 'cry out'], 'voice', { effort: 'hurt-heavy' }),
  'land-grunt': made('body', 'land', 'footsteps.land', 'a landing\'s oof', ['oof', 'land grunt', 'landing grunt'], 'voice', { effort: 'land' }),
  'attack-shout': made('body', 'strike', 'strike.swing', 'an attack\'s shout: a kiai', ['kiai', 'battle cry', 'attack yell'], 'voice', { effort: 'attack' }),
  'strain-grunt': made('body', null, 'on', 'a strain: pushing, climbing, lifting', ['strain', 'effort grunt', 'pushing'], 'voice', { effort: 'strain' }),
  // the door creak's trace heard as a lion (operator, 2026-11-11): a short roar, smooth and rough
  'roar-lion-short': mouthOnly('creature', null, 'on', 'a lion\'s short roar', ['short roar', 'lion grunt', 'big cat snarl'], { matter: ['creature', 'voice'], weight: 'heavy' }),
  'roar-lion-rough': mouthOnly('creature', null, 'on', 'a lion\'s short roar, rough in the throat', ['rough roar', 'lion snarl', 'big cat growl'], { matter: ['creature', 'voice'], weight: 'heavy' }),
  // ── the vehicle registry's sounds (vehicle-registry/roster.js through sfx-shelf/vehicle-sounds.js): engines on the
  //    engine family at their nearest kind until the library's loops voice them (recorded-held.js), what a vehicle runs
  //    on, and the events a vehicle is known by, recorded where no synthesized voice stands in ──
  'electric-motor': made('machinery', null, 'hold', 'an electric motor by its throttle: its inverter\'s whine', ['electric motor', 'ev motor', 'electric car', 'inverter whine'], 'engine', { kind: 'car' }),
  'scooter-engine': made('machinery', null, 'hold', 'a scooter\'s small two-stroke by its throttle', ['scooter', 'moped', 'two stroke'], 'engine', { kind: 'motorbike' }),
  'vtwin-engine': made('machinery', null, 'hold', 'a cruiser motorcycle\'s V-twin by its throttle', ['v twin', 'cruiser bike', 'chopper bike'], 'engine', { kind: 'motorbike' }),
  'v8-engine': made('machinery', null, 'hold', 'a muscle car\'s V8 by its throttle', ['v8 engine', 'muscle car', 'big block'], 'engine', { kind: 'car' }),
  'supercar-engine': made('machinery', null, 'hold', 'a supercar\'s V12 by its throttle', ['v12', 'supercar', 'exotic car'], 'engine', { kind: 'road' }),
  'race-engine': made('machinery', null, 'hold', 'an open-wheel race car\'s engine by its throttle', ['race car', 'race engine', 'open wheel', 'formula car'], 'engine', { kind: 'road' }),
  'locomotive-engine': made('machinery', null, 'hold', 'a locomotive\'s diesel by its notch', ['locomotive', 'train engine', 'diesel locomotive'], 'engine', { kind: 'diesel' }),
  'tank-tracks': made('machinery', null, 'hold', 'a tracked vehicle\'s tracks by its speed: clanking and squealing', ['tank tracks', 'tracks', 'track squeal'], 'engine', { kind: 'tracked' }),
  'rail-wheels': made('machinery', null, 'hold', 'a train\'s wheels on the rails by its speed: the clack of the joints', ['train wheels', 'rail wheels', 'clickety clack'], 'tires', { surface: 'road' }),
  'bicycle-freewheel': made('machinery', null, 'hold', 'a bicycle coasting by its speed: its freewheel ticking', ['freewheel', 'bicycle', 'bike coasting'], 'tires', { surface: 'road' }),
  'air-jump': recorded('movement', 'jump', 'on', 'a jump in the air: a second leap, a spin', ['double jump', 'air jump', 'spin jump'], { matter: ['air'] }),
  hooves: recorded('creature', null, 'hold', 'a horse\'s hooves on the road by its pace', ['hooves', 'trotting', 'hoofbeats'], { matter: ['creature'] }),
  'sail-wind': recorded('elemental', null, 'hold', 'a sailing boat under way: wind in its sails, its ropes, the water', ['sails', 'sailing', 'under sail'], { matter: ['air', 'water'] }),
  'police-siren': recorded('machinery', 'alarm', 'on', 'a police car\'s siren wailing', ['police siren', 'siren wail', 'cop siren'], { matter: ['electric'] }),
  'police-yelp': recorded('machinery', 'alarm', 'on', 'a police siren\'s fast yelp', ['yelp', 'siren yelp'], { matter: ['electric'] }),
  'hilo-siren': recorded('machinery', 'alarm', 'on', 'an ambulance\'s two-tone siren', ['hi lo siren', 'two tone siren', 'ambulance two tone'], { matter: ['electric'] }),
  'fire-horn': made('machinery', 'alarm', 'on', 'a fire engine\'s air horn', ['fire horn', 'fire truck horn'], 'motoring', { act: 'truck-horn' }),
  'train-horn': made('machinery', 'alarm', 'on', 'a train\'s horn', ['train horn', 'locomotive horn'], 'motoring', { act: 'truck-horn' }),
  'ship-horn': made('machinery', 'alarm', 'on', 'a ship\'s foghorn', ['ship horn', 'foghorn'], 'motoring', { act: 'truck-horn' }),
  'v8-ignition': made('machinery', null, 'on', 'a V8 started: its starter cranking, the big engine catching with a blip', ['v8 start', 'muscle car start'], 'motoring', { act: 'ignition' }),
  'diesel-ignition': made('machinery', null, 'on', 'a diesel truck started: its starter cranking, the engine clattering to life', ['diesel start', 'truck start'], 'motoring', { act: 'ignition' }),
  'bike-ignition': made('machinery', null, 'on', 'a motorcycle started: its starter and a fast idle', ['bike start', 'motorcycle start'], 'motoring', { act: 'ignition' }),
  'train-brakes': made('machinery', null, 'on', 'a train braking: its wheels squealing on the rails', ['train brakes', 'rail squeal'], 'motoring', { act: 'brake-squeal' }),
  'reverse-beeper': recorded('machinery', 'alarm', 'on', 'a truck\'s reverse warning beeper', ['reverse beeper', 'backup beeper', 'reversing alarm'], { matter: ['electric'] }),
  'air-brakes': recorded('machinery', null, 'on', 'a bus\'s or a truck\'s air brakes releasing', ['air brakes', 'air brake', 'brake hiss'], { matter: ['air', 'machine'] }),
  'bus-door': recorded('machinery', 'door', 'on', 'a bus door folding open', ['bus door', 'folding door'], { matter: ['metal', 'air'] }),
  'bicycle-bell': recorded('machinery', 'chime', 'on', 'a bicycle\'s bell', ['bicycle bell', 'bike bell'], { matter: ['metal'] }),
  'tram-bell': recorded('machinery', 'chime', 'on', 'a tram\'s bell', ['tram bell', 'trolley bell'], { matter: ['metal'] }),
  'car-alarm': recorded('machinery', 'alarm', 'on', 'a car\'s alarm going off', ['car alarm', 'vehicle alarm'], { matter: ['electric'] }),
  'lock-chirp': recorded('machinery', 'pickup', 'on', 'a car locked by its key fob: a chirp and the locks', ['lock chirp', 'car lock', 'key fob'], { matter: ['electric', 'machine'] }),
  'jet-flyby': recorded('machinery', null, 'on', 'a jet flying low overhead', ['jet flyby', 'flyby', 'fly past'], { matter: ['machine', 'air'] }),
  'prop-flyby': recorded('machinery', null, 'on', 'a propeller plane flying low overhead', ['prop flyby', 'plane flyby'], { matter: ['machine', 'air'] }),
  'heli-flyby': recorded('machinery', null, 'on', 'a helicopter flying low overhead', ['heli flyby', 'helicopter flyby'], { matter: ['machine', 'air'] }),
  'turret-traverse': recorded('machinery', null, 'on', 'a tank\'s turret turning', ['turret', 'turret traverse', 'turret turn'], { matter: ['machine', 'metal'] }),
  'jet-spool': recorded('machinery', null, 'on', 'a jet engine starting, spooling up to idle', ['jet start', 'spool up', 'jet spool'], { matter: ['machine', 'air'] }),
  'prop-start': recorded('machinery', null, 'on', 'a propeller plane\'s engine cranking and catching', ['prop start', 'plane start'], { matter: ['machine'] }),
  'rocket-liftoff': recorded('machinery', null, 'on', 'a large rocket launching: ignition and a long roar', ['liftoff', 'rocket liftoff', 'launch roar'], { matter: ['fire', 'machine'] }),
  // ── a mobile suit's kit by its axes (sfx-shelf/suit-sounds.js): its weight, its drive, its loadout. A variant is heard as
  //    its `standIn` (the nearest row the shelf voices) until the library records it; one with none is silent until then ──
  'mech-step-light': recorded('movement', 'step', 'footsteps.step', 'a light mobile suit\'s footstep: quick, firm, an electric servo', ['light mech step', 'light suit step'], { matter: ['metal', 'machine'], standIn: 'mech-step' }),
  'mech-step-heavy': recorded('movement', 'step', 'footsteps.step', 'a heavy mobile suit\'s footfall: the ground shaking, plates rattling', ['heavy mech step', 'heavy suit step'], { matter: ['metal', 'machine'], standIn: 'giant-step' }),
  'mech-land-light': recorded('movement', 'land', 'jump.land', 'a light mobile suit landing: a sharp impact, a quick compression', ['light mech land', 'light suit landing'], { matter: ['metal', 'machine'], standIn: 'mech-land' }),
  'mech-land-heavy': recorded('movement', 'land', 'jump.land', 'a heavy mobile suit crashing down: a ground-shaking slam', ['heavy mech land', 'heavy suit landing'], { matter: ['metal', 'machine'], standIn: 'mech-land' }),
  'mech-jump': recorded('movement', null, 'on', 'a mobile suit jumping: a piston launch and a burst of thrusters', ['mech jump', 'suit jump'], { matter: ['machine'] }),
  'servo-whine': recorded('machinery', null, 'hold', 'a light machine\'s electric servos by its pace: a clean actuator whine', ['servo whine', 'electric servos', 'actuators'], { matter: ['electric', 'machine'], standIn: 'walker-hydraulics' }),
  'rocket-boost': recorded('machinery', null, 'on', 'a rocket booster igniting: a hard burst of flame and a rising roar', ['rocket boost', 'rocket ignition'], { matter: ['fire', 'machine'] }),
  'jet-boost': recorded('machinery', null, 'on', 'a jet thruster kicking in: a whoosh and a rising whine', ['jet boost', 'thruster kick'], { matter: ['air', 'machine'] }),
  'ion-boost': recorded('machinery', null, 'on', 'an ion thruster engaging: a charge-up zap and a humming surge', ['ion boost', 'ion surge'], { matter: ['electric', 'energy'] }),
  'rocket-quick-boost': recorded('movement', null, 'on', 'a rocket quick boost: one sharp blast of thrust', ['rocket quick boost', 'rocket dash'], { matter: ['fire', 'machine'] }),
  'jet-quick-boost': recorded('movement', null, 'on', 'a jet quick boost: a fast burst of air and a short shriek', ['jet quick boost', 'quick boost'], { matter: ['air', 'machine'] }),
  'ion-quick-boost': recorded('movement', null, 'on', 'an ion quick boost: a crisp electric snap and a swish', ['ion quick boost', 'ion dash'], { matter: ['electric', 'energy'] }),
  'overheat-alarm': recorded('machinery', 'alarm', 'on', 'a cockpit\'s overheat alarm: a fast pulsing warning buzzer', ['overheat', 'overheat alarm', 'heat warning'], { matter: ['electric'] }),
  'thruster-vent': recorded('machinery', null, 'on', 'hot thrusters venting: a steam blast and a sizzle', ['thruster vent', 'heat vent', 'cooling vent'], { matter: ['air', 'machine'] }),
  'mech-transform': recorded('machinery', null, 'on', 'a mobile suit folding into its vehicle: servos, sliding plates, locks', ['mech transform', 'transform', 'fold into vehicle'], { matter: ['metal', 'machine'] }),
  'mech-unfold': recorded('machinery', null, 'on', 'a vehicle unfolding into its mobile suit: servos rising, plates opening, a lock', ['mech unfold', 'unfold', 'transform back'], { matter: ['metal', 'machine'] }),
  'lock-on': recorded('machinery', null, 'on', 'a targeting system locking on: rising beeps and a locked tone', ['lock on', 'target lock', 'missile lock'], { matter: ['electric'] }),
  'suit-boot': recorded('machinery', null, 'on', 'a mobile suit powering up: a hum rising, relays, a reactor building', ['suit boot', 'mech power up', 'reactor start'], { matter: ['electric', 'machine'] }),
  'beam-cannon-shot': recorded('weapon', 'shoot', 'weapon.shot', 'a beam cannon firing: a thunderous discharge and a long beam', ['beam cannon', 'mega beam', 'mega particle cannon'], { matter: ['energy'], standIn: 'beam-charged-shot' }),
  'railgun-shot': recorded('weapon', 'shoot', 'weapon.shot', 'a railgun firing: a charge whine snapping into a metallic crack', ['railgun', 'rail gun', 'mass driver'], { matter: ['electric', 'metal'], standIn: 'beam-rifle-shot' }),
  'vulcan-burst': recorded('weapon', 'shoot', 'weapon.shot', 'a head vulcan\'s short rapid burst', ['vulcan burst', 'head vulcan', 'head gun'], { matter: ['metal'], standIn: 'machine-gun-shot' }),
  'missile-salvo': recorded('weapon', 'shoot', 'weapon.shot', 'a salvo of missiles launching in quick succession', ['missile salvo', 'missile pod', 'micro missiles'], { matter: ['fire', 'machine'], standIn: 'missile-launch' }),
  'heat-axe-swing': recorded('melee', 'swing', 'strike.swing', 'a heat axe swung: a heavy whoosh with a hot sizzle', ['heat axe', 'heat hawk', 'axe swing mech'], { matter: ['metal', 'fire'], standIn: 'saber-swing' }),
  'heat-axe-hit': recorded('melee', 'strike', 'strike.hit', 'a heat axe chopping into armour: a crunch and a hot sear', ['heat axe hit', 'heat hawk hit'], { matter: ['metal', 'fire'], standIn: 'saber-hit' }),
  // ── magic as a kit (sfx-shelf/magic-sounds.js): each element by its phase and tier, the statuses, the spells, a battle's
  //    moments, what magic does to a world; each `recorded`, heard as its stand-in until the library records it ──
  ...Object.fromEntries(MAGIC_ROWS.map((r) => [r.id, recorded(r.category, null, r.slot, r.label, r.aliases, { matter: r.matter, ...(r.standIn ? { standIn: r.standIn } : {}) })])),
  // ── the audio channel's own synth slots (scene/channels/audio.js): its code plays them, unless the level gives the
  //    slot the row's voice (a port of that code, range for range) ──
  'thruster-roar': { ...made('machinery', null, 'thruster', 'a thruster held: a jet whine that swells with the thrust', ['thruster', 'boost', 'booster'], 'booster', { kind: 'jet' }), channel: 'thruster' },
  'jump-servo': { ...made('machinery', null, 'jump.charge', 'a jump gathering: a hydraulic servo straining, pistons chuffing faster', ['servo', 'jump charge'], 'servo'), channel: 'jump.charge' },
  'jump-launch': { ...made('machinery', null, 'jump.release', 'a jump released: a piston slam, heavier the longer it was held', ['piston slam', 'jump release'], 'launch'), channel: 'jump.release' },
};

const freezeRow = (r) => Object.freeze({ ...r, aliases: Object.freeze(r.aliases.slice()), ...(r.say ? { say: Object.freeze(r.say.slice()) } : {}), ...(r.matter ? { matter: Object.freeze(r.matter.slice()) } : {}), ...(r.genres ? { genres: Object.freeze(r.genres.slice()) } : {}), ...(r.voices ? { voices: Object.freeze({ ...r.voices }) } : {}), ...(r.make ? { make: Object.freeze({ family: r.make.family, dials: Object.freeze({ ...r.make.dials }) }) } : {}) });
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
