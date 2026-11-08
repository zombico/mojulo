/**
 * ui-sounds — the game UI's sound library, as beats-sfx gestures (card `beats-sfx`; nothing here adds a kernel voice).
 * The game UI runtime (control/lib/mana-ui/) emits its sounds as effects, { sound: <cue>, way?, step? }; this is what a
 * page plays for them.
 *
 * LEVELS: a set's `gain` matches its confirm's peak to the others' (measured on the rendered reels), and within a set the
 * cursor and the stepper sit well under confirm, cancel under confirm, a rare toast the loudest: what is pressed most is
 * heard least.
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
 *
 *   UI_SOUND_SETS        name → the voice of a set (glass, console, chip, terminal, paper, party)
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
  party: { gain: 1.5, root: 'F5', blip: (n, d, at, v) => [tone(n, d, at, v * 0.35, 'sawtooth', { lowpass: 3800 }), burst(0.01, at, v * 0.4, { highpass: 3000 })], click: (at, v) => [burst(0.01, at, v * 0.5, { highpass: 3500 }), tone('F6', 0.015, at, v * 0.2, 'square')], chime: (n, at, v) => [tone(n, 0.16, at, v * 0.3, 'sawtooth', { lowpass: 5000 }), ring(n, 'metal', 0.4, at, v * 0.25)], breath: (at, v) => [burst(0.14, at, v * 0.35, { filterEnv: { from: 6000, to: 900, decay: 0.14 } })] },
});
export const UI_SOUND_SET_IDS = Object.keys(UI_SOUND_SETS);

// the plan, in semitones over a set's root; its cues
const up = (root, k) => nameOf(midiOf(root) + k);
function plan(V) {
  const R = V.root, n = (k) => up(R, k);
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
