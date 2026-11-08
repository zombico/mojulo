/**
 * sfx-shelf/sets/mecha — the sounds of Mobile Suit Arena, rescued verbatim. Pure data.
 *
 * The game (ref `sk_ms_arena`, manifest sha256/16 `ecc2375e5365db5e`, exported summer 2026 and published as
 * github.com/zombico/mobile-suit-arena) synthesized every effect live from cues like these. They lived only in its rows:
 * mojulo's code never carried them, so the exported game was the last copy. Read on 2026-11-08 from that repo at
 * 0b2479e: the level pages' audio channel (`levels/<level>.html`, `const __AUDIO`: footsteps.step, jump.land, dodge,
 * weapon.shot, strike.swing, strike.hit; the 30 ground levels carry one blob, the 15 space and colony levels the same
 * without the footsteps and the jump) and the suits' loadouts (`recipe/<level>.json`,
 * `entities[].rule.loadout[].weapon.sfx`, four blocks). The charged rifle's plain shot and hit are the beam rifle's,
 * so they are not repeated here.
 *
 * VERBATIM: `MECHA_HASH` is the canonical hash of `MECHA.cues` as the game shipped them (roster.test.js holds it). A
 * better voice of one of these is a new voice in a new set, never an edit here: these are the floor it is measured
 * against (baseline.js).
 *
 * `used` names what played each cue in the game: the loadout entries (the weapon names as the game wrote them) or the
 * channel slot. Every melee weapon (beam saber, heat axe, heat saber, double saber, heat sword, heat rod) played the
 * world's strike cues; a weapon with no sound of its own (grenade, dual pistols, torso beam, some head vulcans) played
 * the world's fallback shot (`beam-blip`).
 */

const freeze = (v) => {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};

export const MECHA_HASH = '55e4d7c4223932db';

export const MECHA = freeze({
  label: 'Mobile Suit Arena',
  source: { repo: 'zombico/mobile-suit-arena', commit: '0b2479e', game: 'sk_ms_arena', manifest: 'ecc2375e5365db5e', read: '2026-11-08' },
  used: {
    'mech-step': ['footsteps.step'],
    'mech-land': ['jump.land'],
    'mech-dodge': ['dodge'],
    'beam-blip': ['weapon.shot (the world fallback)', 'GRENADE', 'DUAL PISTOLS', 'TORSO BEAM', 'HEAD VULCAN'],
    'beam-rifle-shot': ['BEAM RIFLE', 'LONG RIFLE', 'V78 BEAM RIFLE'],
    'beam-rifle-hit': ['BEAM RIFLE', 'LONG RIFLE', 'V78 BEAM RIFLE'],
    'beam-charge': ['V78 BEAM RIFLE'],
    'beam-charged-shot': ['V78 BEAM RIFLE'],
    'bazooka-shot': ['BAZOOKA', 'GIANT BAZOOKA', 'HYPER BAZOOKA', 'ANGULAR BAZOOKA'],
    'bazooka-hit': ['BAZOOKA', 'GIANT BAZOOKA', 'HYPER BAZOOKA', 'ANGULAR BAZOOKA'],
    'machine-gun-shot': ['MACHINE GUN', 'HEAD VULCAN', 'FINGER VULCANS', 'WRIST GATLING'],
    'saber-swing': ['strike.swing'],
    'saber-hit': ['strike.hit'],
  },
  cues: {
    'mech-step': [
      { type: 'burst', decay: 0.06, vol: 0.16, highpass: 1300, lowpass: 5200 },
      { type: 'thump', from: 'G2', to: 'C2', decay: 0.07, vol: 0.15 },
    ],
    'mech-land': [
      { type: 'burst', decay: 0.13, vol: 0.32, highpass: 850, lowpass: 5200 },
      { type: 'burst', decay: 0.05, vol: 0.2, highpass: 2400 },
      { type: 'thump', from: 'A2', to: 'E1', decay: 0.18, vol: 0.46 },
      { type: 'thump', from: 'D2', to: 'A0', decay: 0.24, vol: 0.4 },
      { type: 'burst', at: 0.09, decay: 0.11, vol: 0.14, highpass: 1300, lowpass: 3800 },
    ],
    'mech-dodge': [
      { type: 'burst', at: 0, decay: 0.1, vol: 0.26, highpass: 900, lowpass: 5000 },
      { type: 'thump', at: 0, from: 'A2', to: 'E1', decay: 0.14, vol: 0.36 },
      { type: 'burst', at: 0.28, decay: 0.14, vol: 0.22, highpass: 700, lowpass: 3800 },
      { type: 'thump', at: 0.28, from: 'G2', to: 'C2', decay: 0.1, vol: 0.24 },
      { type: 'burst', at: 0.5, decay: 0.09, vol: 0.24, highpass: 1100, lowpass: 5200 },
      { type: 'thump', at: 0.5, from: 'A2', to: 'D1', decay: 0.16, vol: 0.34 },
    ],
    'beam-blip': [
      { type: 'sweep', wave: 'square', from: 'E6', to: 'A3', dur: 0.12, vol: 0.3 },
    ],
    'beam-rifle-shot': [
      { type: 'thump', from: 'E3', to: 'A1', decay: 0.34, vol: 0.5 },
      { type: 'sweep', wave: 'sawtooth', from: 'A3', to: 'D2', dur: 0.3, vol: 0.26 },
      { type: 'sweep', wave: 'sawtooth', from: 'A5', to: 'A3', dur: 0.34, vol: 0.2 },
      { type: 'grain', grains: 30, over: 0.34, decay: [0.005, 0.024], band: { lo: 900, hi: 9000 }, vol: 0.24, spread: 0.5, seed: 32273 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 60, hold: 0.32, jitter: 0.9, tiers: [{ at: 0, table: ['A4', 'E4', 'A4', 'C5', 'G4'] }], vol: 0.16, seed: 32290 },
    ],
    'beam-rifle-hit': [
      { type: 'burst', decay: 0.11, vol: 0.36, highpass: 900 },
      { type: 'grain', grains: 36, over: 0.22, decay: [0.004, 0.022], band: { lo: 1100, hi: 10500 }, vol: 0.32, spread: 0.4, seed: 39953 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 72, hold: 0.2, jitter: 0.95, tiers: [{ at: 0, table: ['A4', 'E4', 'A4', 'C5', 'F4'] }], vol: 0.19, seed: 39970 },
      { type: 'thump', from: 'C3', to: 'C1', decay: 0.2, vol: 0.44 },
    ],
    'beam-charge': [
      { type: 'sweep', wave: 'sawtooth', from: 'E4', to: 'B5', dur: 1.08, vol: 0.18 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 46, hold: 1.06, jitter: 0.35, tiers: [{ at: 0, table: ['E4', 'A4', 'B4', 'E5'] }], vol: 0.12, seed: 30721 },
      { type: 'grain', grains: 18, over: 1.05, decay: [0.004, 0.018], band: { lo: 1800, hi: 9500 }, vol: 0.1, spread: 0.35, seed: 30722 },
    ],
    'beam-charged-shot': [
      { type: 'thump', from: 'A2', to: 'E1', decay: 0.42, vol: 0.62 },
      { type: 'sweep', wave: 'sawtooth', from: 'B4', to: 'A2', dur: 0.44, vol: 0.34 },
      { type: 'sweep', wave: 'square', from: 'E5', to: 'B2', dur: 0.28, vol: 0.22 },
      { type: 'grain', grains: 44, over: 0.42, decay: [0.004, 0.026], band: { lo: 700, hi: 10500 }, vol: 0.34, spread: 0.55, seed: 30723 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 78, hold: 0.34, jitter: 0.9, tiers: [{ at: 0, table: ['A3', 'E4', 'A4', 'C5', 'E5'] }], vol: 0.2, seed: 30724 },
    ],
    'bazooka-shot': [
      { type: 'thump', from: 'G2', to: 'G1', decay: 0.42, vol: 0.9 },
      { type: 'burst', decay: 0.2, vol: 0.5, lowpass: 2800 },
      { type: 'sweep', wave: 'sawtooth', from: 'A2', to: 'A1', dur: 0.34, vol: 0.28 },
      { type: 'grain', grains: 44, over: 0.36, decay: [0.006, 0.032], band: { lo: 120, hi: 2400 }, vol: 0.36, spread: 0.5, seed: 45217 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 44, hold: 0.3, jitter: 0.92, tiers: [{ at: 0, table: ['A2', 'E2', 'A2', 'C3', 'G2'] }], vol: 0.15, seed: 45218 },
    ],
    'bazooka-hit': [
      { type: 'burst', decay: 0.34, vol: 0.62, lowpass: 3400 },
      { type: 'thump', from: 'C2', to: 'C1', decay: 0.44, vol: 0.95 },
      { type: 'grain', grains: 56, over: 0.42, decay: [0.005, 0.03], band: { lo: 90, hi: 3200 }, vol: 0.42, spread: 0.4, seed: 45233 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 54, hold: 0.32, jitter: 0.96, tiers: [{ at: 0, table: ['A2', 'D2', 'A2', 'C3', 'F2'] }], vol: 0.17, seed: 45234 },
    ],
    'machine-gun-shot': [
      { type: 'burst', decay: 0.05, vol: 0.24, highpass: 800 },
      { type: 'thump', from: 'A2', to: 'D1', decay: 0.07, vol: 0.28 },
    ],
    'saber-swing': [
      { type: 'thump', from: 'E2', to: 'G1', decay: 0.34, vol: 0.6 },
      { type: 'sweep', wave: 'sawtooth', from: 'A2', to: 'E1', dur: 0.24, vol: 0.32 },
      { type: 'burst', decay: 0.2, vol: 0.26, lowpass: 240 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 58, hold: 0.5, jitter: 0.9, tiers: [{ at: 0, table: ['A3', 'E3', 'A3', 'D4', 'G3', 'B3'] }], vol: 0.17, seed: 1442 },
      { type: 'grain', grains: 52, over: 0.5, decay: [0.005, 0.028], band: { lo: 450, hi: 8200 }, vol: 0.32, spread: 0.45, seed: 23219 },
      { type: 'sweep', wave: 'sawtooth', from: 'A4', to: 'B2', dur: 0.46, vol: 0.13 },
    ],
    'saber-hit': [
      { type: 'grain', grains: 46, over: 0.3, decay: [0.003, 0.016], band: { lo: 1200, hi: 11000 }, vol: 0.3, spread: 0.3, seed: 11295 },
      { type: 'flutter', wave: 'square', rateHz: 95, hold: 0.26, jitter: 1, tiers: [{ at: 0, table: ['E5', 'A5', 'E5', 'C5', 'G4', 'D4'] }], vol: 0.18, seed: 11504 },
      { type: 'grain', grains: 34, over: 0.11, decay: [0.004, 0.02], band: { lo: 700, hi: 9200 }, vol: 0.36, spread: 0.35, seed: 4551 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 76, hold: 0.15, jitter: 0.95, tiers: [{ at: 0, table: ['A5', 'D5', 'A5', 'F5', 'C6'] }], vol: 0.22, seed: 1918 },
      { type: 'burst', decay: 0.13, vol: 0.34, highpass: 220, lowpass: 2600 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 44, hold: 0.16, jitter: 0.95, tiers: [{ at: 0, table: ['C3', 'G2', 'D3', 'A2', 'E3'] }], vol: 0.26, seed: 15124 },
      { type: 'thump', from: 'E3', to: 'C2', decay: 0.18, vol: 0.4 },
      { type: 'burst', decay: 0.09, vol: 0.34, highpass: 1700 },
      { type: 'thump', from: 'A3', to: 'A1', decay: 0.14, vol: 0.42 },
    ],
  },
});
