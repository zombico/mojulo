// construction/timber — the timbers a member can be cut from, and the finishes over them. Pure data and colour math.
//
// A species row carries three things:
//   · what the log looks like: its mean ring width, how dark the latewood is and how much of the ring it takes, the
//     pore band of a ring-porous hardwood, the broad rays that make quarter-sawn oak's fleck, the sapwood width, and
//     the colours (the sapwood's earlywood is the species' BASE colour; heartwood, knots and bark are ratios to it);
//   · how its branches sit (whorled conifers, scattered hardwoods), which sets its knots;
//   · what it does as a material: density, stiffness (E), bending strength (modulus of rupture) and shrinkage from
//     green to oven-dry, radial and tangential.
// Mechanical values are clear wood at about 12% moisture. US and European species follow the Wood Handbook (FPL, 2021,
// table 5-3a); Scots pine and the Japanese species are ESTIMATES from published ranges (`est: true`), good for the
// advisory span check and for relative behaviour, not for design.
//
// Colour is a finish, not the grain (building-materials B1/B2): the figure is baked RELATIVE to the base colour, and the
// base colour times the finish is the tint the renderer multiplies over it. So a stain, an oil or a `tint` override
// recolours a member without touching its figure, and paint replaces the figure with one flat colour.

/** Fibre saturation point, % moisture: below it wood shrinks; above it only the free water leaves. */
export const FSP = 28;

export const TIMBERS = Object.freeze({
  oak: {
    title: 'white oak', group: 'hardwood', porous: 'ring', whorled: false,
    base: [214, 188, 148], heart: [184, 152, 112], bark: [92, 84, 74],
    ringMm: 3, late: 0.1, lateShare: 0.5, pores: 0.3, ray: 0.75, rayGapMm: 6, rayMm: 1.0, sapMm: 25,
    density: 755, E: 12.3, MOR: 105, shrinkR: 5.6, shrinkT: 10.5,
  },
  ash: {
    title: 'white ash', group: 'hardwood', porous: 'ring', whorled: false,
    base: [228, 212, 180], heart: [204, 178, 138], bark: [110, 106, 98],
    ringMm: 3, late: 0.12, lateShare: 0.5, pores: 0.26, ray: 0.08, rayGapMm: 3, rayMm: 0.2, sapMm: 60,
    density: 670, E: 12.0, MOR: 103, shrinkR: 4.9, shrinkT: 7.8,
  },
  keyaki: {
    title: 'keyaki (Zelkova serrata)', group: 'hardwood', porous: 'ring', whorled: false, est: true,
    base: [218, 190, 148], heart: [188, 134, 86], bark: [118, 104, 92],
    ringMm: 3, late: 0.12, lateShare: 0.45, pores: 0.3, ray: 0.35, rayGapMm: 4, rayMm: 0.5, sapMm: 20,
    density: 690, E: 11.5, MOR: 100, shrinkR: 4.5, shrinkT: 8.5,
  },
  pine: {
    title: 'Scots pine', group: 'softwood', porous: null, whorled: true, est: true,
    base: [230, 206, 160], heart: [206, 156, 104], bark: [124, 80, 58],
    ringMm: 3, late: 0.32, lateShare: 0.3, pores: 0, ray: 0, sapMm: 60,
    density: 550, E: 10.1, MOR: 83, shrinkR: 5.2, shrinkT: 8.3,
  },
  'douglas-fir': {
    title: 'Douglas-fir (coast)', group: 'softwood', porous: null, whorled: true,
    base: [228, 196, 158], heart: [200, 136, 92], bark: [96, 72, 60],
    ringMm: 3, late: 0.42, lateShare: 0.35, pores: 0, ray: 0, sapMm: 40,
    density: 540, E: 13.4, MOR: 85, shrinkR: 4.8, shrinkT: 7.6,
  },
  spruce: {
    title: 'Sitka spruce', group: 'softwood', porous: null, whorled: true,
    base: [234, 218, 184], heart: [234, 218, 184], bark: [112, 96, 84],
    ringMm: 2.5, late: 0.2, lateShare: 0.25, pores: 0, ray: 0, sapMm: null,
    density: 450, E: 10.8, MOR: 70, shrinkR: 4.3, shrinkT: 7.5,
  },
  hinoki: {
    title: 'hinoki (Chamaecyparis obtusa)', group: 'softwood', porous: null, whorled: true, est: true,
    base: [238, 216, 180], heart: [230, 196, 156], bark: [132, 92, 72],
    ringMm: 1.5, late: 0.14, lateShare: 0.2, pores: 0, ray: 0, sapMm: 30,
    density: 440, E: 8.8, MOR: 75, shrinkR: 3.0, shrinkT: 6.0,
  },
  sugi: {
    title: 'sugi (Cryptomeria japonica)', group: 'softwood', porous: null, whorled: true, est: true,
    base: [238, 224, 198], heart: [176, 104, 78], bark: [120, 84, 66],
    ringMm: 3, late: 0.3, lateShare: 0.3, pores: 0, ray: 0, sapMm: 40,
    density: 380, E: 7.5, MOR: 65, shrinkR: 2.5, shrinkT: 7.0,
  },
  // furniture hardwoods (Wood Handbook, 12%): walnut's chocolate heart, cherry's red-brown heart, maple used as its pale
  // sapwood, beech with its small dense rays, yellow birch; all diffuse- or semi-ring-porous, so no pore band to speak of
  walnut: {
    title: 'black walnut', group: 'hardwood', porous: 'semi', whorled: false,
    base: [212, 194, 162], heart: [112, 80, 58], bark: [70, 60, 54],
    ringMm: 3.5, late: 0.08, lateShare: 0.4, pores: 0.08, ray: 0.05, rayGapMm: 2, rayMm: 0.15, sapMm: 25,
    density: 610, E: 11.6, MOR: 101, shrinkR: 5.5, shrinkT: 7.8,
  },
  cherry: {
    title: 'black cherry', group: 'hardwood', porous: 'diffuse', whorled: false,
    base: [228, 200, 164], heart: [182, 114, 80], bark: [70, 52, 46],
    ringMm: 3, late: 0.07, lateShare: 0.35, pores: 0, ray: 0.08, rayGapMm: 2, rayMm: 0.2, sapMm: 20,
    density: 560, E: 10.3, MOR: 85, shrinkR: 3.7, shrinkT: 7.1,
  },
  maple: {
    title: 'hard maple', group: 'hardwood', porous: 'diffuse', whorled: false,
    base: [238, 226, 200], heart: [214, 190, 152], bark: [110, 100, 92],
    ringMm: 2.5, late: 0.06, lateShare: 0.25, pores: 0, ray: 0.1, rayGapMm: 1.5, rayMm: 0.15, sapMm: 70,
    density: 705, E: 12.6, MOR: 109, shrinkR: 4.8, shrinkT: 9.9,
  },
  beech: {
    title: 'American beech', group: 'hardwood', porous: 'diffuse', whorled: false,
    base: [226, 196, 160], heart: [212, 176, 138], bark: [150, 150, 146],
    ringMm: 2.5, late: 0.06, lateShare: 0.3, pores: 0, ray: 0.4, rayGapMm: 2, rayMm: 0.35, sapMm: 60,
    density: 720, E: 11.9, MOR: 103, shrinkR: 5.5, shrinkT: 11.9,
  },
  birch: {
    title: 'yellow birch', group: 'hardwood', porous: 'diffuse', whorled: false,
    base: [234, 214, 180], heart: [212, 176, 136], bark: [196, 180, 150],
    ringMm: 2.5, late: 0.06, lateShare: 0.3, pores: 0, ray: 0.05, rayGapMm: 1.5, rayMm: 0.1, sapMm: 50,
    density: 690, E: 13.9, MOR: 114, shrinkR: 7.3, shrinkT: 9.5,
  },
});

export const TIMBER_KEYS = Object.freeze(Object.keys(TIMBERS));

/**
 * Finishes. `figure` finishes are transparent: their `tint` multiplies the base colour and the figure shows through.
 * `paint` finishes are opaque: their `color` replaces the member's colour and its figure. Traditional Japanese finishes
 * are named for what they are: bengara (red iron oxide), sumi (ink), kakishibu (persimmon tannin), fuki-urushi (wiped
 * lacquer), yakisugi (charred and brushed); gofun (shell white) and limewash cover.
 */
export const FINISHES = Object.freeze({
  raw: { mode: 'figure', tint: [1, 1, 1] },
  oil: { mode: 'figure', tint: [0.93, 0.84, 0.68] },
  wax: { mode: 'figure', tint: [0.97, 0.93, 0.85] },
  bengara: { mode: 'figure', tint: [0.8, 0.4, 0.3] },
  sumi: { mode: 'figure', tint: [0.36, 0.33, 0.31] },
  kakishibu: { mode: 'figure', tint: [0.82, 0.62, 0.45] },
  urushi: { mode: 'figure', tint: [0.62, 0.34, 0.2] },
  yakisugi: { mode: 'figure', tint: [0.22, 0.2, 0.19] },
  gofun: { mode: 'paint', color: [239, 236, 228] },
  limewash: { mode: 'paint', color: [236, 232, 220] },
});

const HEX = /^#?([0-9a-f]{6})$/i;
/** '#rrggbb' → [r, g, b] (0–255), or null. */
export function hexRgb(h) {
  const m = typeof h === 'string' && HEX.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** [r, g, b] → '#rrggbb' (rounded, clamped). */
export function rgbHex(c) {
  return `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** Why a species name is unknown, or null. */
export function timberError(species) {
  return TIMBERS[species] ? null : `unknown timber '${species}' (one of ${TIMBER_KEYS.join(', ')})`;
}

/**
 * Why a finish is invalid, or null. A finish is a name (`'oil'`, `'bengara'`), `{ stain: '#rrggbb' }` (transparent,
 * multiplies), or `{ paint: '#rrggbb' }` (opaque, covers the figure).
 */
export function finishError(finish) {
  if (finish === undefined) return null;
  if (typeof finish === 'string') return FINISHES[finish] ? null : `unknown finish '${finish}' (one of ${Object.keys(FINISHES).join(', ')}, or { stain: '#rrggbb' } / { paint: '#rrggbb' })`;
  if (finish && typeof finish === 'object') {
    const keys = Object.keys(finish);
    if (keys.length === 1 && (keys[0] === 'stain' || keys[0] === 'paint') && hexRgb(finish[keys[0]])) return null;
  }
  return 'finish must be a name, { stain: \'#rrggbb\' } or { paint: \'#rrggbb\' }';
}

/**
 * The colour a member wears → { mode: 'figure' | 'paint', rgb }. For `figure`, `rgb` is the tint multiplied over the
 * baked figure (the species base, or the `tint` override, times the finish); for `paint`, it is the flat colour.
 */
export function memberColor(species, { tint, finish } = {}) {
  const sp = TIMBERS[species];
  const base = hexRgb(tint) || sp.base;
  if (finish && typeof finish === 'object' && finish.paint) return { mode: 'paint', rgb: hexRgb(finish.paint) };
  if (finish && typeof finish === 'object' && finish.stain) { const s = hexRgb(finish.stain); return { mode: 'figure', rgb: base.map((v, i) => (v * s[i]) / 255) }; }
  const f = FINISHES[typeof finish === 'string' ? finish : 'raw'];
  if (f.mode === 'paint') return { mode: 'paint', rgb: f.color.slice() };
  return { mode: 'figure', rgb: base.map((v, i) => v * f.tint[i]) };
}

/** A colour relative to the species base (heartwood, bark): per channel, capped at 1 so a texel never exceeds 255. */
export const ratioTo = (c, base) => c.map((v, i) => Math.min(1, v / base[i]));
