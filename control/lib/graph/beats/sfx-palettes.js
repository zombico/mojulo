/**
 * sfx-palettes — a game's action sounds from one word. Pure.
 *
 *   audio: { sfx: 'auto' }                              // a level: the palette its music implies, wired to its mechanics
 *   audio: { sfx: { auto: 'arcade', cues?, on? } }      // a named palette; inline cues and `on` rows win
 *
 * A palette names the same cue ids in four voices: `arcade` (chip: square sweeps and blips), `foley` (thumps, grains,
 * wood and glass), `orchestral` (timpani, glockenspiel, brass stabs, harp glides) and `synth` (sine and saw sweeps,
 * held tones). Every cue is a list of the beats-sfx gestures (card `beats-sfx`); nothing here adds a kernel voice.
 * The game's score identity transposes the pitched gestures into its key, so the pickup belongs to the music.
 * `levelSfx` wires a cue only to the events the level's own mechanics emit, so a level without a door has no door.
 */
import { midiOf, nameOf } from './beats-authoring.js';
import { scoreIdentity } from './field-score.js';

const sq = (from, to, dur, extra = {}) => ({ type: 'sweep', wave: 'square', from, to, dur, ...extra });
const sine = (from, to, dur, extra = {}) => ({ type: 'sweep', wave: 'sine', from, to, dur, ...extra });
const saw = (from, to, dur, extra = {}) => ({ type: 'sweep', wave: 'sawtooth', from, to, dur, ...extra });
const thump = (from, to, decay, extra = {}) => ({ type: 'thump', from, to, decay, ...extra });
const burst = (decay, extra = {}) => ({ type: 'burst', decay, ...extra });
const ring = (note, material, decay, extra = {}) => ({ type: 'ring', note, material, decay, ...extra });
const grain = (grains, over, lo, hi, extra = {}) => ({ type: 'grain', grains, over, band: { lo, hi }, ...extra });
const tone = (note, dur, extra = {}) => ({ type: 'tone', note, dur, ...extra });

export const SFX_PALETTES = {
  arcade: {
    jump: [sq('C4', 'G4', 0.12, { vol: 0.6 })],
    land: [thump('G2', 'G1', 0.18), burst(0.08, { vol: 0.4, lowpass: 2500 })],
    step: [burst(0.05, { vol: 0.4, highpass: 1800 })],
    pickup: [sq('B5', 'B5', 0.05, { vol: 0.5 }), sq('E6', 'E6', 0.12, { at: 0.05, vol: 0.5 })],
    door: [sq('C4', 'C3', 0.1, { vol: 0.5 }), burst(0.12, { at: 0.08, vol: 0.4, lowpass: 1800 })],
    goal: [sq('C5', 'C5', 0.07, { vol: 0.5 }), sq('E5', 'E5', 0.07, { at: 0.08, vol: 0.5 }), sq('G5', 'G5', 0.07, { at: 0.16, vol: 0.5 }), sq('C6', 'C6', 0.3, { at: 0.24, vol: 0.5 })],
    lose: [sq('G4', 'E4', 0.2, { vol: 0.5 }), sq('E4', 'C4', 0.2, { at: 0.22, vol: 0.5 }), sq('C4', 'F3', 0.35, { at: 0.44, vol: 0.5 })],
    hit: [burst(0.1, { vol: 0.5, highpass: 1500 }), sq('A4', 'E4', 0.08, { vol: 0.4 })],
    down: [sq('E5', 'C3', 0.25, { vol: 0.45 }), burst(0.25, { at: 0.05, vol: 0.45 })],
    death: [sq('G4', 'C3', 0.5, { vol: 0.5 }), thump('C2', 'C1', 0.5, { at: 0.45, vol: 0.7 })],
    alarm: [sq('A5', 'A5', 0.08, { vol: 0.45 }), sq('A5', 'A5', 0.08, { at: 0.12, vol: 0.45 })],
    checkpoint: [sq('E5', 'E5', 0.06, { vol: 0.45 }), sq('B5', 'B5', 0.12, { at: 0.07, vol: 0.45 })],
    'beat-hit': [sq('C6', 'C6', 0.04, { vol: 0.4 })],
    'beat-miss': [sq('C3', 'A2', 0.08, { vol: 0.4 }), burst(0.05, { vol: 0.2 })],
    wave: [sq('C4', 'C5', 0.3, { vol: 0.45 }), sq('C5', 'C5', 0.2, { at: 0.3, vol: 0.45 })],
    chime: [ring('C6', 'bell', 0.8, { vol: 0.4 })],
    thud: [thump('A2', 'E2', 0.2, { vol: 0.5 }), burst(0.06, { vol: 0.3, lowpass: 1500 })],
    shoot: [sq('A5', 'A4', 0.09, { vol: 0.5 })],
    reload: [burst(0.03, { vol: 0.3, highpass: 3000 }), burst(0.04, { at: 0.1, vol: 0.3, highpass: 2500 })],
    swing: [burst(0.1, { vol: 0.3, highpass: 2500 }), sine('G5', 'C5', 0.1, { vol: 0.2 })],
    strike: [burst(0.08, { vol: 0.5 }), thump('E3', 'E2', 0.12)],
    dodge: [burst(0.12, { vol: 0.3, lowpass: 1200 }), thump('B2', 'G2', 0.1, { at: 0.15, vol: 0.3 })],
  },
  foley: {
    jump: [burst(0.08, { vol: 0.7, lowpass: 2500 }), grain(8, 0.06, 800, 3000, { vol: 0.6 })],
    land: [thump('A1', 'E1', 0.2, { vol: 0.6 }), grain(10, 0.08, 300, 2000, { vol: 0.3 })],
    step: [thump('G2', 'D2', 0.06, { vol: 0.3 }), grain(4, 0.04, 1000, 4000, { vol: 0.25 })],
    pickup: [ring('E6', 'glass', 0.4, { vol: 0.4 }), ring('B6', 'glass', 0.5, { at: 0.06, vol: 0.3 })],
    door: [thump('A1', 'E1', 0.25, { vol: 0.5 }), burst(0.15, { vol: 0.3, lowpass: 900 }), ring('C5', 'metal', 0.3, { at: 0.02, vol: 0.2 })],
    goal: [ring('C5', 'bell', 1.2, { vol: 0.4 }), ring('G5', 'bell', 1.2, { at: 0.12, vol: 0.3 })],
    lose: [ring('C4', 'bell', 1.5, { vol: 0.35 }), thump('C2', 'C1', 0.6, { at: 0.05, vol: 0.4 })],
    hit: [thump('E2', 'A1', 0.15, { vol: 0.6 }), burst(0.06, { vol: 0.4, lowpass: 3000 })],
    down: [thump('A1', 'D1', 0.4, { vol: 0.6 }), grain(14, 0.3, 200, 1500, { vol: 0.3 })],
    death: [thump('C2', 'C1', 0.6, { vol: 0.6 }), burst(0.5, { at: 0.02, vol: 0.3, lowpass: 800 })],
    alarm: [ring('A5', 'metal', 0.3, { vol: 0.4 }), ring('A5', 'metal', 0.3, { at: 0.15, vol: 0.4 })],
    checkpoint: [ring('G5', 'wood', 0.25, { vol: 0.4 }), ring('C6', 'wood', 0.25, { at: 0.08, vol: 0.4 })],
    'beat-hit': [ring('C6', 'wood', 0.12, { vol: 0.4 })],
    'beat-miss': [thump('C3', 'G2', 0.08, { vol: 0.3 }), grain(3, 0.03, 300, 1200, { vol: 0.2 })],
    wave: [burst(0.5, { vol: 0.4, lowpass: 900 }), thump('D2', 'D1', 0.5, { at: 0.1, vol: 0.5 })],
    chime: [ring('C6', 'bell', 1, { vol: 0.4 })],
    thud: [thump('B1', 'F1', 0.25, { vol: 0.5 }), grain(8, 0.1, 200, 1200, { vol: 0.3 })],
    shoot: [burst(0.15, { vol: 0.7, lowpass: 2500 }), thump('A2', 'A1', 0.12, { vol: 0.6 })],
    reload: [ring('E5', 'metal', 0.08, { vol: 0.3 }), ring('B4', 'metal', 0.1, { at: 0.12, vol: 0.35 })],
    swing: [burst(0.15, { vol: 0.9, filterEnv: { from: 1500, to: 6000, decay: 0.15 } })],
    strike: [thump('G2', 'C2', 0.12, { vol: 0.6 }), ring('C4', 'wood', 0.1, { vol: 0.3 })],
    dodge: [grain(12, 0.2, 300, 2000, { vol: 0.3 }), thump('A1', 'E1', 0.15, { at: 0.2, vol: 0.3 })],
  },
  orchestral: {
    jump: [sine('G4', 'D5', 0.12, { vol: 0.35 })],
    land: [thump('A1', 'E1', 0.2, { vol: 0.5 }), ring('C3', 'wood', 0.1, { vol: 0.2 })],
    step: [thump('G2', 'D2', 0.05, { vol: 0.25 }), burst(0.03, { vol: 0.15, lowpass: 1500 })],
    pickup: [ring('E6', 'bell', 0.6, { vol: 0.35 }), ring('B6', 'bell', 0.6, { at: 0.07, vol: 0.3 })],
    door: [thump('C2', 'G1', 0.3, { vol: 0.5 }), ring('G3', 'metal', 0.4, { at: 0.05, vol: 0.2 })],
    goal: [tone('C5', 0.5, { wave: 'triangle', vol: 0.25 }), tone('E5', 0.5, { wave: 'triangle', vol: 0.22 }), tone('G5', 0.5, { wave: 'triangle', vol: 0.2 }), ring('G6', 'bell', 0.8, { at: 0.05, vol: 0.25 })],
    lose: [tone('C4', 1, { to: 'B3', wave: 'sawtooth', lowpass: 1200, vol: 0.25 }), thump('C2', 'C1', 0.8, { vol: 0.5 })],
    hit: [burst(0.1, { vol: 0.5, lowpass: 2500 }), thump('D2', 'A1', 0.15, { vol: 0.5 })],
    down: [thump('G1', 'C1', 0.5, { vol: 0.6 }), ring('C5', 'cymbal', 0.8, { at: 0.02, vol: 0.25 })],
    death: [tone('A3', 1.2, { to: 'E3', wave: 'sawtooth', lowpass: 900, vol: 0.25 }), thump('A1', 'E1', 0.9, { at: 0.1, vol: 0.5 })],
    alarm: [tone('F#5', 0.15, { wave: 'sawtooth', lowpass: 3000, vol: 0.25 }), tone('F#5', 0.15, { at: 0.18, wave: 'sawtooth', lowpass: 3000, vol: 0.25 })],
    checkpoint: [ring('G5', 'bell', 0.6, { vol: 0.35 }), ring('D6', 'bell', 0.6, { at: 0.1, vol: 0.3 })],
    'beat-hit': [ring('C6', 'wood', 0.1, { vol: 0.35 })],
    'beat-miss': [thump('C3', 'A2', 0.1, { vol: 0.3 })],
    wave: [thump('D2', 'D1', 0.6, { vol: 0.6 }), thump('D2', 'D1', 0.6, { at: 0.25, vol: 0.6 }), tone('D4', 0.6, { at: 0.5, wave: 'sawtooth', lowpass: 1500, vol: 0.25 })],
    chime: [ring('C6', 'bell', 1, { vol: 0.4 })],
    thud: [thump('B1', 'F1', 0.25, { vol: 0.5 })],
    shoot: [sine('C6', 'C5', 0.12, { vol: 0.4 }), burst(0.05, { vol: 0.25, highpass: 4000 })],
    reload: [ring('G4', 'wood', 0.08, { vol: 0.3 }), ring('D4', 'wood', 0.08, { at: 0.1, vol: 0.3 })],
    swing: [burst(0.15, { vol: 0.9, filterEnv: { from: 1500, to: 6000, decay: 0.15 } })],
    strike: [thump('G2', 'C2', 0.12, { vol: 0.6 }), ring('E5', 'metal', 0.2, { vol: 0.25 })],
    dodge: [grain(16, 0.2, 400, 2500, { vol: 0.7 }), thump('A1', 'E1', 0.12, { at: 0.2, vol: 0.3 })],
  },
  synth: {
    jump: [sine('C4', 'C5', 0.15, { vol: 0.5 })],
    land: [thump('E2', 'A1', 0.2, { vol: 0.5 }), burst(0.06, { vol: 0.3, lowpass: 1500 })],
    step: [burst(0.04, { vol: 0.15, highpass: 3000 }), thump('A2', 'E2', 0.04, { vol: 0.2 })],
    pickup: [sine('E5', 'E6', 0.1, { vol: 0.4 }), sine('B5', 'B6', 0.12, { at: 0.08, vol: 0.35 })],
    door: [saw('A2', 'A3', 0.3, { vol: 0.25 }), burst(0.35, { vol: 0.2, highpass: 3000 })],
    goal: [sine('C5', 'C6', 0.2, { vol: 0.35 }), sine('E5', 'E6', 0.2, { at: 0.2, vol: 0.35 }), tone('G5', 0.4, { at: 0.4, wave: 'sine', vol: 0.3 })],
    lose: [saw('C4', 'C2', 0.9, { vol: 0.3 })],
    hit: [sq('C5', 'C3', 0.1, { vol: 0.4 }), burst(0.08, { vol: 0.3, highpass: 2000 })],
    down: [saw('E4', 'E1', 0.5, { vol: 0.35 }), burst(0.4, { at: 0.05, vol: 0.4, filterEnv: { from: 3000, to: 200, decay: 0.4 } })],
    death: [tone('E3', 1, { to: 'E1', wave: 'sawtooth', lowpass: 1500, vol: 0.3 }), burst(0.8, { vol: 0.3, lowpass: 600 })],
    alarm: [tone('A5', 0.3, { to: 'E5', wave: 'square', vol: 0.2 }), tone('A5', 0.3, { at: 0.32, to: 'E5', wave: 'square', vol: 0.2 })],
    checkpoint: [sine('A5', 'A5', 0.06, { vol: 0.4 }), sine('E6', 'E6', 0.12, { at: 0.07, vol: 0.4 })],
    'beat-hit': [sine('C6', 'C6', 0.04, { vol: 0.35 })],
    'beat-miss': [saw('C3', 'G2', 0.1, { vol: 0.3 })],
    wave: [tone('C3', 0.8, { to: 'C4', wave: 'sawtooth', lowpass: 2000, vol: 0.3 })],
    chime: [ring('C6', 'bell', 0.8, { vol: 0.4 })],
    thud: [thump('A1', 'E1', 0.25, { vol: 0.5 })],
    shoot: [sq('A5', 'A4', 0.09, { vol: 0.45 }), sine('E6', 'E5', 0.12, { vol: 0.25 })],
    reload: [sine('C4', 'C5', 0.2, { vol: 0.25 }), burst(0.05, { at: 0.2, vol: 0.3, highpass: 4000 })],
    swing: [tone('C4', 0.15, { to: 'C5', wave: 'sawtooth', lowpass: 3000, vol: 0.2 })],
    strike: [burst(0.1, { vol: 0.4, highpass: 2000 }), sq('E4', 'E2', 0.12, { vol: 0.3 })],
    dodge: [sine('G4', 'G3', 0.2, { vol: 0.25 }), burst(0.15, { vol: 0.2, highpass: 2500 })],
  },
};
export const SFX_PALETTE_NAMES = Object.keys(SFX_PALETTES);
export const SFX_CUE_IDS = Object.keys(SFX_PALETTES.arcade);

// the palette a score's identity implies: its flavour's band (an orchestra, a folk band, a chamber group, a synth).
const BY_FLAVOUR = { orchestral: 'orchestral', 'silk-road': 'orchestral', folk: 'foley', chamber: 'foley', 'synth-era': 'synth' };
export function paletteForIdentity(id) {
  return id ? BY_FLAVOUR[id.flavour] ?? 'arcade' : 'arcade';
}

// the events each mechanic emits (game/mechanics.js), and the cue each one sounds. First match wins in `on`.
export const MECHANIC_SFX = {
  'reach-exit': { 'goal:reached*': 'goal' },
  door: { 'door:*': 'door' },
  survive: { 'time:up': 'goal' },
  collect: { 'pickup:*': 'pickup' },
  'fail-on-death': { dead: 'death' },
  'hp-pool': { 'hit:*': 'hit', 'enemy:down': 'down' },
  'defeat-all': { 'all:defeated': 'goal' },
  supplies: { 'supply:*': 'pickup' },
  unseen: { spotted: 'alarm' },
  laps: { checkpoint: 'checkpoint', lap: 'chime', 'race:won': 'goal', 'race:lost': 'lose' },
  'on-beat': { 'beat:hit': 'beat-hit', 'beat:miss': 'beat-miss' },
  waves: { wave: 'wave', leak: 'hit', 'base:fallen': 'lose', 'waves:cleared': 'goal' },
  push: { pushed: 'thud', 'plates:held': 'goal' },
  clock: { dawn: 'chime', dusk: 'chime' },
  crops: { planted: 'thud', harvested: 'pickup' },
};

// shift every pitched gesture by `k` semitones (note names only; Hz, materials sized in metres and noise stay put)
function shiftNote(n, k) { return typeof n === 'string' && k ? nameOf(midiOf(n) + k) : n; }
function transpose(gestures, k) {
  if (!k) return gestures;
  return gestures.map((g) => {
    const o = { ...g };
    for (const f of ['from', 'to', 'note']) if (typeof o[f] === 'string') o[f] = shiftNote(o[f], k);
    if (Array.isArray(o.tiers)) o.tiers = o.tiers.map((t) => ({ ...t, table: (t.table || []).map((n) => shiftNote(n, k)) }));
    return o;
  });
}

/**
 * The cues of a palette in a game's key: `palette` one of SFX_PALETTE_NAMES (absent: the identity's), `identity` a
 * scoreIdentity or its seed (absent: C, untransposed). The tonic moves the pitched gestures −5…+6 semitones.
 */
export function paletteCues(palette, identity) {
  const id = identity == null ? null : Number.isInteger(identity) ? scoreIdentity(identity) : identity;
  const name = palette ?? paletteForIdentity(id);
  const P = SFX_PALETTES[name];
  if (!P) throw new Error(`sfx palette '${name}' — the palettes: ${SFX_PALETTE_NAMES.join(', ')}`);
  const k = id ? ((id.tonic + 5) % 12) - 5 : 0;
  return Object.fromEntries(Object.entries(P).map(([cue, g]) => [cue, transpose(g, k)]));
}

/**
 * A level's automatic sound: { palette, cues, on, footsteps, jump, weapon, strike, dodge }. `mechanics` is the
 * level's mechanic kinds; only their events get a row. The gait, weapon and melee sounds are wired whole: they fire
 * only when an entity in the level moves, shoots or swings, and a level without one never hears them.
 */
export function levelSfx({ palette, identity, mechanics = [] } = {}) {
  const id = identity == null ? null : Number.isInteger(identity) ? scoreIdentity(identity) : identity;
  const name = palette ?? paletteForIdentity(id);
  const cues = paletteCues(name, id);
  const on = {};
  for (const kind of mechanics) for (const [glob, cue] of Object.entries(MECHANIC_SFX[kind] || {})) if (!(glob in on)) on[glob] = cue;
  return {
    palette: name, cues, on,
    footsteps: { step: cues.step, jump: cues.jump, land: cues.land },
    weapon: { shot: cues.shoot, hit: cues.hit, reload: cues.reload },
    strike: { swing: cues.swing, hit: cues.strike },
    dodge: cues.dodge,
  };
}
