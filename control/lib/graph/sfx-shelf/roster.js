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
 *   voices    { <style>: <set> }: the sets that voice it, by style (STYLES)
 *   channel   the audio channel slot whose code synthesizes it (SLOTS), for a sound with no cue yet
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
});

/**
 * The audio channel's slots (scene/channels/audio.js and beats/sfx-palettes.js levelSfx): where a level plays a sound.
 * `on` is a bus event's cue (a level's `audio.on` row); the rest are the gait, weapon, melee and jump seams.
 */
export const SLOTS = Object.freeze([
  'footsteps.step', 'footsteps.jump', 'footsteps.land',
  'jump.charge', 'jump.release', 'jump.land', 'thruster', 'dodge',
  'weapon.shot', 'weapon.charge', 'weapon.chargedShot', 'weapon.hit', 'weapon.reload',
  'strike.swing', 'strike.hit',
  'on',
]);

const pal = (category, slot, label, aliases = []) => ({ label, aliases, category, palette: true, slot });
// voiced realistic by the layered set; the rescued `mecha` set is its floor (sets.js)
const mecha = (category, family, slot, label, aliases = []) => ({ label, aliases, category, family, voices: { realistic: 'mecha-layered' }, slot });

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

  // ── Mobile Suit Arena's sounds (sets/mecha.js, the floor; sets/mecha-layered.js, the realistic voice) ──
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

  // ── synthesized by the audio channel's own code (scene/channels/audio.js), no cue yet ──
  'thruster-roar': { label: 'a thruster held: a jet whine that swells with the thrust', aliases: ['thruster', 'boost', 'booster'], category: 'machinery', family: null, channel: 'thruster', slot: 'thruster' },
  'jump-servo': { label: 'a jump gathering: a hydraulic servo straining, pistons chuffing faster', aliases: ['servo', 'jump charge'], category: 'machinery', family: null, channel: 'jump.charge', slot: 'jump.charge' },
  'jump-launch': { label: 'a jump released: a piston slam, heavier the longer it was held', aliases: ['piston slam', 'jump release'], category: 'machinery', family: null, channel: 'jump.release', slot: 'jump.release' },
};

const freezeRow = (r) => Object.freeze({ ...r, aliases: Object.freeze(r.aliases.slice()), ...(r.voices ? { voices: Object.freeze({ ...r.voices }) } : {}) });
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
