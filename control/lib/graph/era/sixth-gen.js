/**
 * The SIXTH-GEN era card (PS2 / GameCube / Xbox) and its reference moods — data, not code paths.
 *
 * The era card holds what every sixth-gen stage shares: the frame it was seen at, the texture sizes
 * its surfaces were painted at, and the order of magnitude a character and a level spent. The
 * reference cards hold what differs between the titles the composer studies: setting, surfaces, light
 * and air. Numbers are starting points read off the era's hardware and frames by eye, to be tuned at
 * the eyes gate; none is a measured fact about a shipped game.
 *
 * Nothing here draws. The stage kind, its kits and its light rig read these cards; measureFidelity
 * (fidelity.js) reads `frame` so a readout is taken at the resolution the era was seen at.
 */

export const SIXTH_GEN = Object.freeze({
  id: 'sixth-gen',
  title: 'sixth generation (PS2, GameCube, Xbox)',
  // the frame: 640×448 (PS2 NTSC) is the common floor; a readout taken here weighs detail the way the era's screen did
  frame: Object.freeze({ width: 640, height: 448, fovY: 55 }),
  // surface tiles: 128–256 px painted tiles, magnified on screen near the camera (≤ ~1 texel per pixel at the spawn)
  texture: Object.freeze({ tilePx: [128, 256], texelsPerMetre: [48, 128], maxTexelsPerPixelAtSpawn: 1.25 }),
  // light: the world is prebaked into vertex colour; characters carry their own rig on top (rim + key lift)
  light: Object.freeze({ world: 'baked-vertex', character: 'baked-plus-rim', fog: 'exp' }),
  // the character leads the world: the stage is tuned so the hero reads denser on screen than the walls behind it
  fidelity: Object.freeze({ characterOverWorld: 'slightly', target: null }),   // target set from the phase-1 baseline
});

/** The reference titles, one card each. `setting` names the first kit it suggests; light and air feed the rig. */
export const SIXTH_GEN_REFERENCES = Object.freeze({
  dmc3: Object.freeze({
    title: 'Devil May Cry 3',
    setting: 'gothic interior',
    kit: 'gothic-stone',
    surfaces: ['stone-block', 'carved-trim', 'iron', 'stained-glass'],
    palette: { base: '#4a4c55', accent: '#8a1c1c', warm: '#e0a050' },
    light: { ambient: '#2a3040', key: null, placed: ['torch', 'stained-shaft', 'red-accent'], contrast: 'high' },
    air: { fog: { color: '#151821', density: 0.05 }, sky: 'night-overcast', dome: { zenith: [10, 12, 20], horizon: [28, 32, 44] } },
  }),
  colosseum: Object.freeze({
    title: 'Pokémon Colosseum',
    setting: 'desert industrial town',
    kit: 'desert-industrial',
    surfaces: ['sandstone', 'metal-panel', 'pipe', 'neon-sign'],
    palette: { base: '#b08a5a', accent: '#3aa8a0', warm: '#f08a40' },
    light: { ambient: '#806a60', key: { color: '#ffb070', elevation: 18, azimuth: 200 }, placed: ['neon', 'lamp-post'], contrast: 'medium' },
    air: { fog: { color: '#d8a878', density: 0.012 }, sky: 'desert-sunset', dome: { zenith: [70, 80, 140], horizon: [240, 170, 110] } },
  }),
  sunshine: Object.freeze({
    title: 'Super Mario Sunshine',
    setting: 'island plaza',
    kit: 'island-plaza',
    surfaces: ['stucco', 'terracotta', 'wood-plank', 'cobble'],
    palette: { base: '#f0d8a8', accent: '#3a80d0', warm: '#e86a40' },
    light: { ambient: '#a8c8f0', key: { color: '#fff4d8', elevation: 58, azimuth: 225 }, placed: [], contrast: 'hard-sun' },
    air: { fog: { color: '#cfe4f4', density: 0.004 }, sky: 'tropical-day', dome: { zenith: [52, 122, 214], horizon: [200, 228, 246] } },
  }),
  mgs3: Object.freeze({
    title: 'Metal Gear Solid 3',
    setting: 'jungle and soviet facility',
    kit: 'concrete-facility',
    surfaces: ['mud', 'jungle-grass', 'concrete', 'rust-metal', 'foliage-card'],
    palette: { base: '#5a5e48', accent: '#8a6a3a', warm: '#c8b080' },
    light: { ambient: '#58604c', key: { color: '#e8e0c0', elevation: 40, azimuth: 150 }, placed: ['caged-bulb', 'floodlight'], contrast: 'filmic' },
    air: { fog: { color: '#7a8470', density: 0.03 }, sky: 'jungle-overcast', dome: { zenith: [110, 120, 112], horizon: [168, 176, 160] } },
  }),
  doom3: Object.freeze({
    title: 'Doom 3',
    setting: 'research lab',
    kit: 'research-lab',
    surfaces: ['vinyl-tile', 'steel-panel', 'hazard-stripe', 'grating', 'screen'],
    palette: { base: '#8a9098', accent: '#e0b030', warm: '#ff3a2a' },
    light: { ambient: '#3a424e', key: null, placed: ['troffer', 'screen', 'warning-lamp', 'tank'], contrast: 'high' },
    air: { fog: { color: '#1a1e24', density: 0.015 }, sky: 'interior', dome: { zenith: [16, 18, 22], horizon: [26, 30, 36] } },
  }),
});

export const SIXTH_GEN_REFERENCE_IDS = Object.freeze(Object.keys(SIXTH_GEN_REFERENCES));

/**
 * The looks as a recipe names them: plain words for the light and air each reference card holds. These are the ids an
 * agent sees and writes ("reference": "gothic-night"); the reference cards above stay the research record behind them,
 * and their own ids are still read so a recipe written before the looks had names renders as it did.
 */
export const SIXTH_GEN_LOOKS = Object.freeze({
  'gothic-night': 'dmc3',
  'desert-dusk': 'colosseum',
  'island-noon': 'sunshine',
  'jungle-haze': 'mgs3',
  'lab-dark': 'doom3',
});
export const SIXTH_GEN_LOOK_IDS = Object.freeze(Object.keys(SIXTH_GEN_LOOKS));
const LOOK_OF_REFERENCE = Object.freeze(Object.fromEntries(Object.entries(SIXTH_GEN_LOOKS).map(([look, ref]) => [ref, look])));

/** A look id (or a reference card's own id) → its reference card's id; null when it names neither. */
export function resolveLook(id) {
  if (SIXTH_GEN_LOOKS[id]) return SIXTH_GEN_LOOKS[id];
  return SIXTH_GEN_REFERENCES[id] ? id : null;
}

/** A reference card's id → the look id a recipe names it by. */
export const lookOfReference = (refId) => LOOK_OF_REFERENCE[refId];
