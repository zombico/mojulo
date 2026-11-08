/**
 * ui-sounds — the game UI's sound library, as beats-sfx gestures (card `beats-sfx`; nothing here adds a kernel voice).
 * The game UI runtime (control/lib/mana-ui/) emits its sounds as effects, { sound: <cue>, way?, step? }; this is what a
 * page plays for them.
 *
 * LEVELS: a set's `gain` matches its confirm's peak to the others' (measured on the rendered reels, about −12 dBFS), and
 * within a set the cursor and the stepper sit well under confirm, cancel under confirm, a rare toast the loudest: what
 * is pressed most is heard least. A heavy set's big moments are let past confirm on purpose: crypt's door slams a few
 * dB over it, jackpot's jackpot near 9.
 *
 * ONE INTERVAL PLAN, SIX VOICES. Every set is built from the same plan over its root, so the sets differ in timbre and
 * belong together in harmony, and a game's sets sound like one game:
 *   move      the cursor's tick, high and short (an octave over the root); up a step higher, down at the octave
 *   change    the stepper: up a fifth, down a fourth (the value went up or down, and the ear says which)
 *   accept    confirm: a fifth rising to the octave, the brightest and the shortest-to-peak
 *   back      cancel: the fifth falling to the root, softer than confirm
 *   tab       a flick over the octave and a breath of noise
 *   open      root, third, fifth up;  close  the same down
 *   deny      a minor second low, twice (nothing is broken, it just will not do)
 *   toast     a chime on the tenth;   rare  the octave's arpeggio and a bell over it
 *   tick      a count's pip, two octaves up, quiet;   skip  a swept breath
 *   appear-1…5  a row landing: a soft tick up a pentatonic ladder (a page ripples them down the rows on its stagger)
 *   vanish    the tick falling, softer;   shuffle  a breath and a run of quick clicks (rows moved past each other)
 *
 *   UI_SOUND_SETS        name → the voice of a set: glass, console, chip, terminal, paper, party, and the heavy ones,
 *                        hydraulic (servos, pneumatics, clamps), clack (hardwood blocks), crypt (stone, iron, a toll; a
 *                        dungeon door), jackpot (coins, bells, a riser into a boom). A heavy set says some cues in its
 *                        own gestures (`over`), held to the same plan: confirm rises, cancel falls, the cursor quiet
 *   UI_SOUND_CUES        the cue ids a set holds (with the directional ones: move-up, move-down, change-up, change-down)
 *   uiSounds(set, { tonic? })   → { <cue>: [gesture…] }, in a game's key (tonic: semitones from C, −5…+6)
 *   uiSoundOf(effect)    → the cue id an effect plays ({ sound: 'change', step: -1 } → 'change-down')
 *   uiSoundManifest(set) → a beats-sfx manifest of the set (what create_beats mints, what the player fires)
 *   uiSoundAudio(sets?, { tonic? }) → { source, sets, of }: what a mana-ui page or the board plays its sounds with (the
 *                        beats kernel's source with only the features the sets need, the sets' cues, and uiSoundOf's
 *                        source); a page that is handed none carries no byte of it
 */
import { midiOf, nameOf } from './beats-authoring.js';
import { emitBeatsKernel } from './beats-kernel.js';
import { beatsFeatures } from './beats-features.js';

// a set's voice: how it says one note (blip), a click with no pitch, a held chime, a breath of noise
const tone = (note, dur, at, vol, wave, extra = {}) => ({ type: 'tone', note, dur, at, vol, wave, attack: 0.002, release: Math.min(0.08, dur * 0.6), ...extra });
const ring = (note, material, decay, at, vol) => ({ type: 'ring', note, material, decay, at, vol });
const burst = (decay, at, vol, extra = {}) => ({ type: 'burst', decay, at, vol, ...extra });
const sweep = (wave, from, to, dur, at, vol) => ({ type: 'sweep', wave, from, to, dur, at, vol });
// the heavy voices' own: a mass dropped (heavier is lower and longer), iron struck with noise, grit, a stick-slip creak
const thud = (mass, at, vol) => ({ type: 'thump', mass, at, vol });
const iron = (note, decay, at, vol) => ({ type: 'ring', note, material: 'metal', excite: 'noise', q: 18, decay, at, vol });
const grit = (grains, over, lo, hi, at, vol, seed) => ({ type: 'grain', grains, over, band: { lo, hi }, at, vol, seed });
const creak = (table, hold, at, vol, seed) => ({ type: 'flutter', wave: 'sawtooth', rateHz: 12, jitter: 0.8, seed, hold, tiers: [{ at: 0, table }], at, vol });
const hiss = (decay, at, vol, from = 9000, to = 2200) => burst(decay, at, vol, { highpass: 1800, filterEnv: { from, to, decay } });

export const UI_SOUND_SETS = Object.freeze({
  // clean glass: sine notes over a glass ring, soft-edged (a modern console's system menus)
  glass: { gain: 0.63, root: 'C5', blip: (n, d, at, v) => [tone(n, d, at, v * 0.6, 'sine'), ring(n, 'glass', d * 2.2, at, v * 0.35)], click: (at, v) => [burst(0.012, at, v * 0.25, { highpass: 5000 })], chime: (n, at, v) => [ring(n, 'glass', 0.9, at, v * 0.5)], breath: (at, v) => [burst(0.12, at, v * 0.2, { filterEnv: { from: 2000, to: 7000, decay: 0.12 } })] },
  // the console RPG's: triangle pips, the cursor a short square tick (the classic window-box menu)
  console: { gain: 0.9, root: 'A4', blip: (n, d, at, v) => [tone(n, d, at, v * 0.5, 'triangle'), tone(n, Math.max(0.01, d * 0.5), at, v * 0.15, 'square')], click: (at, v) => [tone('A6', 0.018, at, v * 0.25, 'square')], chime: (n, at, v) => [ring(n, 'bell', 0.7, at, v * 0.4)], breath: (at, v) => [burst(0.08, at, v * 0.18, { lowpass: 4000 })] },
  // chip: square notes, a pitched sweep for the cursor (8-bit)
  chip: { gain: 1.6, root: 'C5', blip: (n, d, at, v) => [sweep('square', n, n, d, at, v * 0.4)], click: (at, v) => [sweep('square', 'C7', 'G6', 0.02, at, v * 0.25)], chime: (n, at, v) => [sweep('square', n, n, 0.12, at, v * 0.35), sweep('square', n, n, 0.05, at + 0.14, v * 0.2)], breath: (at, v) => [burst(0.06, at, v * 0.25, { highpass: 2500 })] },
  // the terminal's: relay clicks and sine beeps, dry
  terminal: { gain: 2.6, root: 'E5', blip: (n, d, at, v) => [tone(n, Math.max(0.01, d * 0.7), at, v * 0.4, 'sine', { release: 0.005 }), burst(0.006, at, v * 0.3, { highpass: 6000 })], click: (at, v) => [burst(0.008, at, v * 0.45, { highpass: 4500 })], chime: (n, at, v) => [tone(n, 0.09, at, v * 0.35, 'sine'), tone(n, 0.09, at + 0.12, v * 0.35, 'sine')], breath: (at, v) => [burst(0.05, at, v * 0.2, { bandpass: 3000, q: 1.2 })] },
  // paper and wood: plucked wood, a page's rustle (a storybook's)
  paper: { gain: 0.8, root: 'D5', blip: (n, d, at, v) => [ring(n, 'wood', Math.max(0.08, d * 1.5), at, v * 0.55)], click: (at, v) => [ring('D6', 'wood', 0.05, at, v * 0.3)], chime: (n, at, v) => [ring(n, 'bell', 0.9, at, v * 0.35), ring(n, 'wood', 0.2, at, v * 0.3)], breath: (at, v) => [{ type: 'grain', grains: 10, over: 0.16, band: { lo: 1200, hi: 6000 }, at, vol: v * 0.35 }] },
  // the party's: a snapped click under every note, saw stabs, a sweep for cancel (the slam the look moves with)
  // HEAVY ONES. hydraulic: a machine's servos and pneumatics, clamps landing (a mech's hangar, a walker's cockpit)
  hydraulic: {
    gain: 0.63, root: 'A3',
    blip: (n, d, at, v) => [tone(n, Math.max(0.03, d), at, v * 0.32, 'sawtooth', { lowpass: 1300 }), burst(0.012, at, v * 0.3, { highpass: 3500 })],
    click: (at, v) => [burst(0.01, at, v * 0.4, { highpass: 3800 }), thud(0.15, at, v * 0.35)],
    chime: (n, at, v) => [ring(n, 'plate', 0.7, at, v * 0.45)],
    breath: (at, v) => [hiss(0.22, at, v * 0.45)],
    over: (n) => ({
      // a servo drives, a clamp lands, the line bleeds off
      accept: [tone(n(-12), 0.12, 0, 0.3, 'sawtooth', { to: n(-5), lowpass: 1400 }), thud(40, 0.12, 0.8), iron(n(7), 0.3, 0.12, 0.35), hiss(0.18, 0.15, 0.3)],
      // the pressure lets go first, the servo backs off, a lighter clamp
      back: [hiss(0.26, 0, 0.32, 8000, 1500), tone(n(-5), 0.14, 0.04, 0.24, 'sawtooth', { to: n(-12), lowpass: 1200 }), thud(18, 0.17, 0.42)],
      // a press rising and locking, a press lowering and seating
      open: [hiss(0.2, 0, 0.32), tone(n(-12), 0.34, 0.02, 0.26, 'sawtooth', { to: n(0), lowpass: 1500 }), thud(80, 0.36, 0.8), iron(n(0), 0.45, 0.36, 0.35)],
      close: [tone(n(0), 0.3, 0, 0.24, 'sawtooth', { to: n(-12), lowpass: 1200 }), thud(120, 0.3, 0.85), hiss(0.3, 0.32, 0.32, 7000, 1200)],
      deny: [thud(30, 0, 0.6), iron(n(-12), 0.12, 0, 0.3), thud(30, 0.11, 0.55), iron(n(-11), 0.12, 0.11, 0.28)],
    }),
  },
  // clack: hardwood blocks, a board's pieces, a clapper (a serious game's: strategy, a board game, a period drama)
  clack: {
    gain: 0.5, root: 'D4',
    blip: (n, d, at, v) => [ring(n, 'wood', Math.max(0.06, d * 1.4), at, v * 0.6), thud(0.3, at, v * 0.2)],
    click: (at, v) => [ring('D6', 'wood', 0.04, at, v * 0.45), burst(0.006, at, v * 0.25, { highpass: 2500 })],
    chime: (n, at, v) => [ring(n, 'wood', 0.25, at, v * 0.45), ring(n, 'bell', 0.7, at, v * 0.25)],
    breath: (at, v) => [grit(14, 0.18, 400, 3000, at, v * 0.4, 21)],
    over: (n) => ({
      // the clapper's two blocks struck together, then again higher: done
      accept: [ring(n(12), 'wood', 0.08, 0, 0.7), thud(0.6, 0, 0.3), ring(n(19), 'wood', 0.08, 0.075, 0.85), thud(0.6, 0.075, 0.32)],
      // one dull knock lower
      back: [ring(n(7), 'wood', 0.12, 0, 0.55), ring(n(0), 'wood', 0.14, 0.06, 0.45), thud(2, 0.06, 0.3)],
      // the clapper's roll, quickening, and the board set down
      open: [ring(n(12), 'wood', 0.06, 0, 0.45), ring(n(12), 'wood', 0.06, 0.12, 0.5), ring(n(14), 'wood', 0.06, 0.2, 0.55), ring(n(19), 'wood', 0.1, 0.25, 0.7), thud(3, 0.25, 0.35)],
      close: [ring(n(7), 'wood', 0.1, 0, 0.5), thud(3, 0.02, 0.5), grit(10, 0.12, 300, 2000, 0.03, 0.25, 22)],
      deny: [ring(n(-12), 'wood', 0.1, 0, 0.5), thud(1.5, 0, 0.4), ring(n(-12), 'wood', 0.1, 0.12, 0.45), thud(1.5, 0.12, 0.35)],
    }),
  },
  // crypt: stone, iron and a bell's toll, dry and dark (a grim game's, a souls-like's: few sounds, each one heavy)
  crypt: {
    gain: 0.5, root: 'D3',
    blip: (n, d, at, v) => [iron(n, Math.max(0.12, d * 3), at, v * 0.45), thud(1, at, v * 0.25)],
    click: (at, v) => [iron('D5', 0.05, at, v * 0.22), burst(0.012, at, v * 0.2, { lowpass: 2800 })],
    chime: (n, at, v) => [ring(n, 'bell', 2.2, at, v * 0.45)],
    breath: (at, v) => [grit(18, 0.4, 200, 1800, at, v * 0.35, 31), burst(0.4, at, v * 0.25, { lowpass: 600 })],
    over: (n) => ({
      // a toll and its fifth over it, a weight set down under them
      accept: [thud(150, 0, 0.55), ring(n(0), 'bell', 2.2, 0, 0.45), ring(n(7), 'bell', 1.6, 0.09, 0.42)],
      // an iron latch drawn back
      back: [iron(n(19), 0.25, 0, 0.32), iron(n(12), 0.3, 0.08, 0.3), thud(60, 0.08, 0.35)],
      // the door: it creaks a long way open over grit, and comes to rest
      open: [creak([n(-12), n(-9)], 0.9, 0, 0.28, 41), grit(30, 0.85, 150, 1500, 0, 0.32, 42), thud(400, 0.85, 0.7), burst(0.6, 0.85, 0.35, { lowpass: 400 })],
      // the door swung shut: a short creak, the slam, the boom in the stone, the latch falling
      close: [creak([n(-9), n(-12)], 0.45, 0, 0.26, 43), { type: 'impact', note: n(-24), decay: 2.4, at: 0.45, vol: 0.75 }, thud(800, 0.45, 0.85), burst(0.8, 0.45, 0.45, { lowpass: 700 }), grit(24, 0.5, 200, 2500, 0.47, 0.3, 44), iron(n(0), 1.2, 0.62, 0.3)],
      // stone that will not move
      deny: [grit(16, 0.22, 120, 900, 0, 0.45, 45), thud(90, 0, 0.55)],
      toast: [ring(n(12), 'bell', 2.4, 0, 0.42)],
      rare: [ring(n(0), 'bell', 3, 0, 0.45), ring(n(7), 'bell', 2.6, 0.5, 0.4), ring(n(12), 'bell', 3.2, 1, 0.48), thud(300, 1, 0.5)],
    }),
  },
  // jackpot: coins, bells, a riser into a boom and a fanfare (a casino's, a gacha's pull, a prize; bombastic on purpose)
  jackpot: {
    gain: 0.7, root: 'C5',
    blip: (n, d, at, v) => [tone(n, Math.max(0.03, d), at, v * 0.35, 'square', { lowpass: 6000 }), ring(n, 'bell', 0.3, at, v * 0.3)],
    click: (at, v) => [ring('E7', 'metal', 0.05, at, v * 0.3), burst(0.008, at, v * 0.25, { highpass: 6000 })],
    chime: (n, at, v) => [ring(n, 'bell', 1.2, at, v * 0.45), ring(up(n, 12), 'glass', 0.8, at, v * 0.3)],
    breath: (at, v) => [{ type: 'riser', dur: 0.25, from: 800, to: 8000, at, vol: v * 0.4 }],
    over: (n) => {
      const coins = (from, count, every, vol, seed) => Array.from({ length: count }, (_, i) => ring(n(36 + ((i * 7) % 5)), 'metal', 0.18, from + i * every + ((i * 37) % 7) * 0.004, vol));
      const stab = (at, vol) => [0, 4, 7, 12].map((k) => tone(n(k), 0.2, at, vol, 'sawtooth', { lowpass: 4200 }));
      return {
        // a brass stab under a bell: a win, every time
        accept: [...stab(0, 0.2), ring(n(12), 'bell', 0.6, 0, 0.35), ...coins(0.02, 2, 0.05, 0.18)],
        tick: [ring(n(36), 'metal', 0.07, 0, 0.18)],
        // a fanfare's arpeggio and a handful of coins
        toast: [...[0, 4, 7, 12].map((k, i) => tone(n(k), 0.1, i * 0.07, 0.2, 'square', { lowpass: 6000 })), ring(n(24), 'bell', 1, 0.28, 0.45), ...coins(0.3, 6, 0.05, 0.16)],
        // THE JACKPOT: a riser, the boom, the fanfare chord held, the bells, a shower of coins
        rare: [{ type: 'riser', dur: 0.6, from: 400, to: 9000, tone: n(-12), at: 0, vol: 0.5 }, { type: 'impact', note: n(-36), decay: 1.6, at: 0.6, vol: 0.8 },
          ...[0, 4, 7, 12, 16].map((k) => tone(n(k), 0.9, 0.6, 0.18, 'sawtooth', { lowpass: 5000, vibrato: { rate: 6, depth: 12 } })),
          ring(n(24), 'bell', 2, 0.6, 0.5), ring(n(31), 'bell', 1.8, 0.75, 0.4), sweep('square', n(0), n(24), 0.4, 0.6, 0.12),
          grit(60, 1.6, 4000, 12000, 0.65, 0.35, 51), ...coins(0.65, 16, 0.09, 0.15)],
        // a slot's lever: the ratchet and its thunk
        open: [{ type: 'flutter', wave: 'square', rateHz: 18, hold: 0.25, tiers: [{ at: 0, table: [n(12), n(14)] }], at: 0, vol: 0.18 }, thud(4, 0.26, 0.6), ring(n(12), 'bell', 0.5, 0.26, 0.3)],
        deny: [tone(n(-24), 0.25, 0, 0.25, 'square', { lowpass: 2500 }), tone(n(-23), 0.25, 0, 0.25, 'square', { lowpass: 2500 })],
      };
    },
  },
  party: { gain: 1.5, root: 'F5', blip: (n, d, at, v) => [tone(n, d, at, v * 0.35, 'sawtooth', { lowpass: 3800 }), burst(0.01, at, v * 0.4, { highpass: 3000 })], click: (at, v) => [burst(0.01, at, v * 0.5, { highpass: 3500 }), tone('F6', 0.015, at, v * 0.2, 'square')], chime: (n, at, v) => [tone(n, 0.16, at, v * 0.3, 'sawtooth', { lowpass: 5000 }), ring(n, 'metal', 0.4, at, v * 0.25)], breath: (at, v) => [burst(0.14, at, v * 0.35, { filterEnv: { from: 6000, to: 900, decay: 0.14 } })] },
});
export const UI_SOUND_SET_IDS = Object.keys(UI_SOUND_SETS);

// the plan, in semitones over a set's root; its cues
const up = (root, k) => nameOf(midiOf(root) + k);
function plan(V) {
  const R = V.root, n = (k) => up(R, k);
  return { ...basePlan(V, n), ...(V.over ? V.over(n) : {}) };
}
// the plan in a set's everyday voice (a heavy set says some cues in its own gestures: `over`)
function basePlan(V, n) {
  return {
    move: [...V.click(0, 0.55), ...V.blip(n(12), 0.03, 0, 0.3)],
    'move-up': [...V.click(0, 0.55), ...V.blip(n(14), 0.03, 0, 0.3)],
    'move-down': [...V.click(0, 0.55), ...V.blip(n(12), 0.03, 0, 0.3)],
    change: [...V.click(0, 0.5), ...V.blip(n(7), 0.04, 0, 0.4)],
    'change-up': [...V.click(0, 0.5), ...V.blip(n(7), 0.04, 0, 0.4)],
    'change-down': [...V.click(0, 0.5), ...V.blip(n(5), 0.04, 0, 0.4)],
    accept: [...V.click(0, 0.6), ...V.blip(n(7), 0.05, 0, 0.85), ...V.blip(n(12), 0.09, 0.045, 1)],
    back: [...V.blip(n(7), 0.05, 0, 0.55), ...V.blip(n(0), 0.08, 0.05, 0.5)],
    tab: [...V.blip(n(12), 0.03, 0, 0.5), ...V.blip(n(19), 0.03, 0.03, 0.4), ...V.breath(0, 0.6)],
    open: [...V.blip(n(0), 0.05, 0, 0.5), ...V.blip(n(4), 0.05, 0.05, 0.55), ...V.blip(n(7), 0.09, 0.1, 0.6), ...V.breath(0, 0.5)],
    close: [...V.blip(n(7), 0.05, 0, 0.5), ...V.blip(n(4), 0.05, 0.05, 0.45), ...V.blip(n(0), 0.09, 0.1, 0.45)],
    deny: [...V.blip(n(-11), 0.05, 0, 0.6), ...V.blip(n(-12), 0.05, 0.007, 0.6), ...V.blip(n(-11), 0.05, 0.09, 0.55), ...V.blip(n(-12), 0.05, 0.097, 0.55)],
    toast: [...V.chime(n(16), 0, 0.7), ...V.blip(n(12), 0.05, 0, 0.4)],
    rare: [...V.blip(n(12), 0.06, 0, 0.5), ...V.blip(n(16), 0.06, 0.07, 0.55), ...V.blip(n(19), 0.06, 0.14, 0.6), ...V.blip(n(24), 0.14, 0.21, 0.7), ...V.chime(n(28), 0.21, 0.8)],
    tick: [...V.blip(n(24), 0.015, 0, 0.25)],
    skip: [...V.breath(0, 1), ...V.blip(n(12), 0.04, 0.06, 0.45)],
    // APPEARING: a soft tick as each row lands, up a pentatonic ladder (a page ripples them down a screen's rows on its
    // stagger, so the sound lands where the eye does); quieter than the cursor: many of them come at once
    ...Object.fromEntries([12, 14, 16, 19, 21].map((k, i) => [`appear-${i + 1}`, [...V.blip(n(k), 0.02, 0, 0.18)]])),
    // LEAVING: the same tick falling, softer still (what goes is not news)
    vanish: [...V.blip(n(19), 0.025, 0, 0.16), ...V.blip(n(12), 0.03, 0.035, 0.12)],
    // SHUFFLING: a breath and a run of quick clicks, like cards riffled or tiles slid (once for the whole move)
    shuffle: [...V.breath(0, 0.45), ...[0, 0.035, 0.065, 0.09].flatMap((t, i) => V.click(t, 0.35 + i * 0.05)), ...V.blip(n(19), 0.03, 0.11, 0.22)],
  };
}
export const UI_SOUND_CUES = Object.freeze(Object.keys(plan(UI_SOUND_SETS.glass)));

// a pitched gesture moved by k semitones (note names only: noise and Hz stay put)
const shift = (g, k) => { if (!k) return g; const o = { ...g }; for (const f of ['note', 'from', 'to']) if (typeof o[f] === 'string') o[f] = nameOf(midiOf(o[f]) + k); return o; };

/** A set's cues, in a game's key (tonic: semitones from C, folded into −5…+6 so a set never drifts an octave). */
export function uiSounds(set, { tonic = 0 } = {}) {
  const V = UI_SOUND_SETS[set];
  if (!V) throw new Error(`ui sound set '${set}' — the sets: ${UI_SOUND_SET_IDS.join(', ')}`);
  if (!Number.isInteger(tonic)) throw new Error('tonic is whole semitones from C (the game\'s key)');
  const k = ((((tonic + 5) % 12) + 12) % 12) - 5;
  // the set's gain (its sets level-matched on confirm, so a game that changes its look does not change its loudness)
  const lvl = (g) => (typeof g.vol === 'number' ? { ...g, vol: Math.round(g.vol * V.gain * 1000) / 1000 } : g);
  return Object.fromEntries(Object.entries(plan(V)).map(([id, list]) => [id, list.map((g) => lvl(shift(g, k)))]));
}

/** The cue id an effect from the runtime plays: a cursor's way and a stepper's step pick their variant. */
export function uiSoundOf(effect) {
  if (!effect || typeof effect.sound !== 'string') return null;
  const s = effect.sound;
  if (s === 'appear') return 'appear-1';
  if (s === 'move' && effect.way) return effect.way === 'up' || effect.way === 'left' ? 'move-up' : 'move-down';
  if (s === 'change' && typeof effect.step === 'number' && effect.step) return effect.step > 0 ? 'change-up' : 'change-down';
  return s;
}

/** A set as a beats-sfx manifest: what create_beats mints and the beats player fires, cue by cue. */
export function uiSoundManifest(set, opts) {
  return { kind: 'beats-sfx', title: `UI sounds · ${set}`, cues: uiSounds(set, opts) };
}

/** What a page plays the UI's sounds with: the kernel (only the features the sets need), the sets, and the cue picker. */
export function uiSoundAudio(sets = UI_SOUND_SET_IDS, { tonic = 0 } = {}) {
  for (const s of sets) if (!UI_SOUND_SETS[s]) throw new Error(`ui sound set '${s}' — the sets: ${UI_SOUND_SET_IDS.join(', ')}`);
  const features = [...new Set(sets.flatMap((s) => beatsFeatures(uiSoundManifest(s, { tonic }))))];
  return { source: emitBeatsKernel(features), sets: Object.fromEntries(sets.map((s) => [s, uiSounds(s, { tonic })])), of: uiSoundOf.toString() };
}
