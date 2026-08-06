/**
 * veh-common — the shared kit of the veh-* part shelf (vehicle designer).
 *
 * One palette table and six color roles shelf-wide, so any palette works on
 * any part (a wheel and a chassis minted from `factorySteel` match). Plus
 * the seeded-determinism helpers every veh-* module uses. Extracted at the
 * second consumer (veh-chassis), per vehicle-designer.plan.md.
 */

export const VEH_COLOR_ROLES = ['paint', 'trim', 'glass', 'rubber', 'chrome', 'light'];

export const VEH_PALETTES = {
  factorySteel: {
    paint: '#3a4550',
    trim: '#20242a',
    glass: '#7ea8c4',
    rubber: '#181a1c',
    chrome: '#c9ced4',
    light: '#e8b13a',
  },
  chromeAlloy: {
    paint: '#22262b',
    trim: '#2e3844',
    glass: '#8fb5cf',
    rubber: '#1a1c1e',
    chrome: '#dfe4ea',
    light: '#f0c04a',
  },
  vintageCream: {
    paint: '#b8342b',
    trim: '#ece6d6',
    glass: '#a9c3c8',
    rubber: '#26241f',
    chrome: '#d5d2c8',
    light: '#efd88f',
  },
  murderedOut: {
    paint: '#101214',
    trim: '#1c1f24',
    glass: '#3f4c58',
    rubber: '#141618',
    chrome: '#3a3f46',
    light: '#c8b46a',
  },
  // the modern register: glacier mono paint, privacy glass, satin gunmetal
  // (modern cars have no bright chrome), ice-white LED light bars
  glacierMono: {
    paint: '#e8eaec',
    trim: '#22262b',
    glass: '#20303c',
    rubber: '#161819',
    chrome: '#8e979f',
    light: '#dfe8f0',
  },
};

const PALETTE_IDS = Object.keys(VEH_PALETTES);

export const round3 = (n) => Math.round(n * 1e3) / 1e3;
export const clone = (v) => JSON.parse(JSON.stringify(v));

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(value, label = 'veh') {
  if (Number.isFinite(value)) return value >>> 0;
  const s = String(value ?? label);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function normalizeColorOverrides(colors = {}, label = 'veh') {
  if (!colors || typeof colors !== 'object') return {};
  const out = {};
  for (const [role, value] of Object.entries(colors)) {
    if (!VEH_COLOR_ROLES.includes(role)) {
      throw new Error(`Unknown ${label} color role '${role}' - expected one of: ${VEH_COLOR_ROLES.join(', ')}`);
    }
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
      throw new Error(`${label} color '${role}' must be a #RRGGBB hex string; received ${JSON.stringify(value)}`);
    }
    out[role] = value.toLowerCase();
  }
  return out;
}

export function resolvePalette(palette, colors, defaultPaletteId, label = 'veh') {
  if (palette && typeof palette === 'object') {
    const { id, base = defaultPaletteId, ...inlineColors } = palette;
    const basePalette = VEH_PALETTES[base];
    if (!basePalette) throw new Error(`Unknown ${label} palette '${base}' - expected one of: ${PALETTE_IDS.join(', ')}`);
    return {
      id: typeof id === 'string' && id ? id : 'custom',
      colors: {
        ...basePalette,
        ...normalizeColorOverrides(inlineColors, label),
        ...normalizeColorOverrides(colors, label),
      },
    };
  }
  const paletteId = palette || defaultPaletteId;
  const basePalette = VEH_PALETTES[paletteId];
  if (!basePalette) throw new Error(`Unknown ${label} palette '${paletteId}' - expected one of: ${PALETTE_IDS.join(', ')}`);
  return {
    id: paletteId,
    colors: {
      ...basePalette,
      ...normalizeColorOverrides(colors, label),
    },
  };
}
