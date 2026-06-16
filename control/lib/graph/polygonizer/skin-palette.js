/**
 * skin-palette — resolves a skin layer's (role, flavor) against a
 * scene-global light tone into a concrete hex color.
 *
 * Skin cards author intent (`role: 'highlight', flavor: 'water'`), the
 * scene authors its light (`scene.light.tone`), and this resolver
 * bridges them so the same skin reads differently under moonlight,
 * sunset, overcast, etc. — deterministic palette as a function of the
 * world's lighting, not authored hex.
 *
 * Sized to stay reviewable: 5 flavors × 6 tones × 4 roles = 120 hex
 * stops in one hand-tuned table. No procedural color math yet — that
 * comes after we know which combinations actually get used.
 *
 * Schema slot in `scene.light`:
 *   {
 *     direction: [x, y],     // existing — 2D azimuth vector
 *     z: number,             // existing — vertical component
 *     tone?: SKIN_TONES[i],  // new — optional, defaults to silver-daylight
 *   }
 *
 * No validator changes are needed for `tone` — consumers (this module
 * and any future skin-aware primitive) read `scene.light?.tone` and
 * fall back to DEFAULT_TONE when absent. An explicit tone outside the
 * enum is treated as an error at resolve time, mirroring how the
 * fields module surfaces unknown ids with an "available: ..." list.
 */

export const DEFAULT_TONE = 'silver-daylight';

export const SKIN_TONES = Object.freeze([
  'moonlight',
  'sunset',
  'dawn',
  'overcast',
  'firelight',
  'silver-daylight',
]);

export const SKIN_FLAVORS = Object.freeze([
  'water',
  'stone',
  'atmosphere',
  'foliage',
  'fabric',
]);

export const SKIN_ROLES = Object.freeze([
  'shadow',
  'base',
  'mid',
  'highlight',
]);

// (flavor, tone) → { shadow, base, mid, highlight } hex stops.
//
// Design intent for the columns (tones):
//   moonlight        cool, low-key, silver-blue
//   sunset           warm key, amber/coral mids, violet shadows
//   dawn             pearl/lavender, low contrast, slightly warm mids
//   overcast         neutral, mid-key, low chroma
//   firelight        umber-amber dominant, deep shadows
//   silver-daylight  the substrate default — high-key neutral
//
// Design intent for the rows (flavors):
//   water       cool bias even under warm light (it reflects sky, not sun)
//   stone       holds local color but takes the light's temperature in mids
//   atmosphere  takes the light's color most directly (it IS the light volume)
//   foliage     green undertone modulated by the light's temperature
//   fabric      mid-saturation textile; takes light cleanly, warmer than stone
const PALETTE = {
  water: {
    moonlight:         { shadow: '#1f2a36', base: '#3a4d5e', mid: '#7e95a6', highlight: '#d7e4ec' },
    sunset:            { shadow: '#3a2a2b', base: '#7a4f48', mid: '#c9a07e', highlight: '#f0d4b8' },
    dawn:              { shadow: '#3c3848', base: '#7a7a8e', mid: '#bdb6c6', highlight: '#f1ecea' },
    overcast:          { shadow: '#3d4348', base: '#727b80', mid: '#a7adb1', highlight: '#dadfe1' },
    firelight:         { shadow: '#2a1e1a', base: '#5a3a2c', mid: '#b6764d', highlight: '#efc593' },
    'silver-daylight': { shadow: '#3a4a52', base: '#526f83', mid: '#c5d5dc', highlight: '#f0f5f6' },
  },
  stone: {
    moonlight:         { shadow: '#26262c', base: '#494a52', mid: '#878890', highlight: '#cdcdd2' },
    sunset:            { shadow: '#2e201c', base: '#624230', mid: '#a98059', highlight: '#e5c79a' },
    dawn:              { shadow: '#3c343a', base: '#7a6f70', mid: '#b8a9a6', highlight: '#ece1da' },
    overcast:          { shadow: '#3c3a36', base: '#736e66', mid: '#a8a39a', highlight: '#d6d2cb' },
    firelight:         { shadow: '#22150e', base: '#583521', mid: '#a76a3c', highlight: '#e7a767' },
    'silver-daylight': { shadow: '#4f4a44', base: '#756f67', mid: '#b1aa9b', highlight: '#e1dccf' },
  },
  atmosphere: {
    moonlight:         { shadow: '#2b3540', base: '#5a6e7c', mid: '#a0b1bc', highlight: '#e1e9ee' },
    sunset:            { shadow: '#41302c', base: '#94604f', mid: '#dca687', highlight: '#f4d6bd' },
    dawn:              { shadow: '#4c4651', base: '#9a8e92', mid: '#cebcb8', highlight: '#f5eeea' },
    overcast:          { shadow: '#4f5258', base: '#838790', mid: '#b6b9be', highlight: '#dee0e2' },
    firelight:         { shadow: '#2e1d18', base: '#683b25', mid: '#c08259', highlight: '#f1ce9d' },
    'silver-daylight': { shadow: '#454e55', base: '#7d8a91', mid: '#c7cbc5', highlight: '#eef0eb' },
  },
  foliage: {
    moonlight:         { shadow: '#1c2620', base: '#37463a', mid: '#7d8978', highlight: '#bccab2' },
    sunset:            { shadow: '#2d2a1c', base: '#56532b', mid: '#9d9152', highlight: '#dcc885' },
    dawn:              { shadow: '#2d3329', base: '#5d6850', mid: '#a0a78c', highlight: '#dadcc6' },
    overcast:          { shadow: '#2d3530', base: '#5b665a', mid: '#959e91', highlight: '#c1c8be' },
    firelight:         { shadow: '#241813', base: '#502c1b', mid: '#9d5e35', highlight: '#dba368' },
    'silver-daylight': { shadow: '#2d3a2d', base: '#5a6e57', mid: '#9aa893', highlight: '#cbd1bf' },
  },
  fabric: {
    moonlight:         { shadow: '#222631', base: '#454c5d', mid: '#8b94a4', highlight: '#d0d6dd' },
    sunset:            { shadow: '#352321', base: '#6f4639', mid: '#bc8669', highlight: '#ebcdaf' },
    dawn:              { shadow: '#3d343c', base: '#796a72', mid: '#b6a8ab', highlight: '#ebdee0' },
    overcast:          { shadow: '#3a383c', base: '#6f6c70', mid: '#a4a1a4', highlight: '#cfcdce' },
    firelight:         { shadow: '#2a1614', base: '#5d2d24', mid: '#a55c43', highlight: '#e29671' },
    'silver-daylight': { shadow: '#3c3a40', base: '#71707a', mid: '#a8a8b1', highlight: '#d8d8de' },
  },
};

/**
 * Resolve a full 4-stop palette for a (flavor, tone) pair. Returns
 * `{ shadow, base, mid, highlight }` as #rrggbb strings.
 *
 * Absent `tone` falls back to DEFAULT_TONE so calls from scenes that
 * haven't declared light tone (the majority today) still work. An
 * explicit but unknown tone throws — mirrors the substrate's "unknown
 * X (available: ...)" pattern in fields/connections validation.
 */
export function resolveSkinPalette(flavor, tone) {
  const flavorTable = PALETTE[flavor];
  if (!flavorTable) {
    throw new Error(
      `resolveSkinPalette: unknown flavor '${flavor}' (have: ${SKIN_FLAVORS.join(', ')})`,
    );
  }
  const effectiveTone = tone == null ? DEFAULT_TONE : tone;
  const palette = flavorTable[effectiveTone];
  if (!palette) {
    throw new Error(
      `resolveSkinPalette: unknown tone '${effectiveTone}' for flavor '${flavor}' (have: ${SKIN_TONES.join(', ')})`,
    );
  }
  return palette;
}

/**
 * Resolve a single color for (role, flavor, tone). Thin wrapper over
 * resolveSkinPalette for the common "I just need one stop" path.
 */
export function resolveSkinColor(role, flavor, tone) {
  const palette = resolveSkinPalette(flavor, tone);
  if (!Object.hasOwn(palette, role)) {
    throw new Error(
      `resolveSkinColor: unknown role '${role}' (have: ${SKIN_ROLES.join(', ')})`,
    );
  }
  return palette[role];
}
