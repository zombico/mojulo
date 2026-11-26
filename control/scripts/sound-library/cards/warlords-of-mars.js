/**
 * Warlords of Mars's sounds (the `warlords-of-mars` rail, an assault frame's operations on Mars): only what the library
 * lacks for it (sfx-shelf/frame-sounds.js). Everything else a frame plays is already recorded (Mech Battle Kai's suit
 * kit, the registry's machines, spike's and batch2's blasts and impacts), so these cards are the gaps, each a shelf row
 * heard as its stand-in until it is recorded.
 *
 * The guns and the wreck at a frame's scale, the energy shield, and the cockpit's missile warning are REALISTIC rows,
 * any game's with a frame (no flavor). The objectives' stingers are the game's own, a FLAVOR: heard only by a game of
 * that flavor (airspace.frame.flavor), named as sounds only (generate.mjs SPEECH_WORDS: never a radio, never a word).
 */

const FLAVOR = 'warlords-of-mars';
const SFX = 'a heavy sci-fi mecha combat sound effect, realistic, no music, no voice';
const shot = (id, shelf, prompt, seconds, tags, extra = {}) => ({ id, shelf, role: 'one-shot', prompt: `${prompt}, ${SFX}`, seconds, influence: 0.55, loop: false, takes: 3, tags: ['frame', ...tags], ...extra });
const cue = (id, shelf, prompt, seconds, tags, extra = {}) => ({ id, shelf, role: 'cue', prompt, seconds, loop: false, takes: 3, tags: ['frame', ...tags], ...extra });

export const CARDS = [
  // ── a frame's guns, at its scale (the shelf's shotgun and vulcan are a soldier's and a head gun's) ──
  shot('wom-scatter', 'scatter-shot', 'a giant robot\'s scatter cannon firing: a huge deep blast of buckshot from a broad short bore, a heavy metal recoil clank', 1.2, ['arms', 'gun']),
  shot('wom-gatling', 'gatling-burst', 'a giant robot\'s six-barrel gatling cannon firing a short burst: barrels spinning, a ripping stream of heavy rounds', 1, ['arms', 'gun']),
  shot('wom-mortar', 'mortar-shot', 'a giant robot\'s shoulder grenade cannon firing: a deep hollow thump and a shell whistling away', 1.4, ['arms', 'gun']),
  // ── what it meets ──
  shot('wom-shield-hit', 'shield-hit', 'a heavy round striking a raised energy shield: a deep electric thrum and a crackling shimmer', 0.9, ['shield']),
  shot('wom-shield-break', 'shield-break', 'an energy shield overloading and collapsing: a rising electric whine snapping into a shattering crackle', 1.5, ['shield']),
  shot('wom-wreck', 'frame-wreck', 'a giant war robot destroyed: a reactor exploding, armour plates torn away, heavy debris raining down', 2.8, ['wreck']),
  // ── the cockpit ──
  cue('wom-missile-warning', 'missile-warning', 'a fighter cockpit missile alert tone: a fast urgent two-tone electronic beeping, a sci-fi mecha sound effect', 1.2, ['cockpit']),
  // ── the operation's stingers (the game's own) ──
  cue('wom-task', 'chime', 'a military tactical display stinger: two short low synth pulses and a bright rising blip, a sci-fi game sound effect', 1, ['stinger'], { flavor: FLAVOR }),
  cue('wom-done', 'checkpoint', 'a military tactical display stinger: a firm low synth hit and a clean rising tone, a sci-fi game sound effect', 1.2, ['stinger'], { flavor: FLAVOR }),
  cue('wom-won', 'goal', 'a triumphant military synth stinger: a deep brass and synth swell resolving to a major chord, a sci-fi game sound effect', 2.5, ['stinger'], { flavor: FLAVOR }),
  cue('wom-lost', 'lose', 'a grim military synth stinger: a low falling brass and synth swell into a dark rumble, a sci-fi game sound effect', 2.5, ['stinger'], { flavor: FLAVOR }),
];
