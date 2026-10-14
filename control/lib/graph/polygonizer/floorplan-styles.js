/**
 * House styles — a seeded bundle of the floorplan's existing finish knobs, so two houses do not
 * come up the same. A style names a family (cottage siding, brick, modern, tofu, mission); the
 * seed picks the family (`style: 'auto'`) and, within it, the variant: siding or brick colour,
 * roof, window pattern, entry door, interior paints, floor tone, and a furnishing palette (the
 * furniture meshes recolored by family, room-assets recolorManifest).
 *
 * A style only supplies DEFAULTS: every knob it sets loses to the same key on the manifest, so
 * `style: 'brick', brickBodyTint: '#…'` keeps the brick house and the operator's colour. It turns
 * the dressing on (facade and wall decor, floor finish, mesh furniture) because a style that
 * does not show is not a style. No `style` ⇒ nothing here runs, and the house is the same bytes.
 * The roof style applies to the exterior view only: the cutaway stays open.
 */

const fnv1a = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};
function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// one labelled stream per choice, so adding a choice never reshuffles the others
const stream = (key, label) => mulberry32(fnv1a(`${key}|style|${label}`));
const pick = (key, label, arr) => arr[Math.floor(stream(key, label)() * arr.length) % arr.length];

// Furnishing palettes by family (room-assets FINISH_SOURCES): wood, upholstery, bedding, rug, cabinet.
const FINISHES = {
  warm: { wood: '#9a6a3d', upholstery: '#7f8f76', bedding: '#b7a58a', rug: '#8a4a3c', cabinet: '#e2dccd' },
  honey: { wood: '#a8773f', upholstery: '#a0685a', bedding: '#c7b69b', rug: '#6f5a8a', cabinet: '#d9d0bc' },
  walnut: { wood: '#5e3d26', upholstery: '#7a3530', bedding: '#8a7a64', rug: '#5a3a30', cabinet: '#4f5a4c' },
  forest: { wood: '#6e4524', upholstery: '#3f5a45', bedding: '#a89a80', rug: '#7a4a2a', cabinet: '#3e4a3f' },
  ash: { wood: '#c2a67c', upholstery: '#8a8d90', bedding: '#d9d6cf', rug: '#6d7278', cabinet: '#ecebe7' },
  ink: { wood: '#b58f5e', upholstery: '#3a3d42', bedding: '#c9ccd1', rug: '#44474c', cabinet: '#2e3136' },
  oat: { wood: '#d1b890', upholstery: '#d6cdbb', bedding: '#ece7dc', rug: '#bdb3a0', cabinet: '#f2efe8' },
  sand: { wood: '#c9ad85', upholstery: '#b8aa92', bedding: '#e6e1d6', rug: '#a39580', cabinet: '#e8e4da' },
  terracotta: { wood: '#6a4228', upholstery: '#a0522d', bedding: '#d8c8a8', rug: '#8a3c24', cabinet: '#d8c7a4' },
  indigo: { wood: '#5a3a24', upholstery: '#3b4a78', bedding: '#e0d6c0', rug: '#34406a', cabinet: '#c9b48e' },
};

// Each family: its fixed knobs, then the lists the seed picks from.
export const HOUSE_STYLES = {
  cottage: {
    fixed: { facadeStyle: 'siding', interiorWallStyle: null },
    pick: {
      facadeSidingTint: ['#9fb4ad', '#a9bccb', '#d8cfb8', '#c7a9a0', '#b7b39a'],
      facadeTrimTint: ['#e8e0d2', '#f1ece2'],
      roof: ['bungalow', 'colonial', 'farmhouse'],
      windowStyle: ['double-hung', 'colonial'],
      entryDoorTint: ['#355f74', '#7a2e2a', '#2f4a3a', '#c8a13a'],
      wallPaints: [['#d7d1c3', '#dfd7c7', '#d9cdbb', '#cdd3cc'], ['#e2d6c0', '#d6c9ae', '#dccfb8', '#c9cfc2']],
      floorboardTint: ['#8f7d64', '#7f6d56', '#9e8c71'],
      finish: ['warm', 'honey'],
    },
    finishes: {
      doorStyle: ['plank', 'five-panel', 'two-panel'],
      doorLeafTint: ['#e8e2d4', '#7d5a36', '#5d7a73'],
      windowStyle: ['six-over-six', 'cottage', 'colonial', 'double-hung'],
      windowFrameTint: [null],
      livingFloor: [{ pattern: 'wide-plank', colours: ['#c29a64', '#9a7444'] }, { pattern: 'straight-plank', colours: ['#b08a5e', '#8a6a48'] }, { pattern: 'basketweave', colours: ['#b08a5e', '#8a6a48'] }],
      bedroomFloor: [{ pattern: 'wide-plank', colours: ['#c29a64', '#9a7444'] }, { pattern: 'straight-plank', colours: ['#d2bc96', '#b49c76'] }],
      wetFloor: [{ pattern: 'checkerboard', colours: ['#efeae0', '#3a4a42'] }, { pattern: 'hex-tile', colours: ['#efeae0', '#8a8f86', '#5d7a73'] }],
      wallTreatment: ['beadboard', 'board-and-batten', 'wainscot'],
      wallpaper: [{ pattern: 'botanical', colours: ['#efe6d6', '#5d7a5a', '#c99a6a'] }, { pattern: 'gingham', colours: ['#f2ede2', '#9fb4ad'] }, { pattern: 'scallop', colours: ['#f1ebdd', '#c99a96', '#9fb4ad'] }],
    },
  },
  brick: {
    fixed: { facadeStyle: 'brick', interiorWallStyle: null },
    pick: {
      brickBodyTint: ['#9c5a44', '#7e4636', '#b0795a', '#c9b08a', '#6d5048'],
      brickMortarTint: ['#d8c6b0', '#cfc9bf', '#e2d6c2'],
      roof: ['manor', 'colonial', 'bungalow'],
      windowStyle: ['colonial', 'casement', 'double-hung'],
      entryDoorTint: ['#2e3a2f', '#5a2320', '#1f2a3a'],
      wallPaints: [['#d5cabb', '#cabdac', '#d9cdbb', '#c8c2b4'], ['#cfc6b4', '#c4c9bd', '#d2c7b3', '#bfc3b8']],
      floorboardTint: ['#6f5d4b', '#604f3f', '#7a6851'],
      finish: ['walnut', 'forest'],
    },
    finishes: {
      doorStyle: ['six-panel', 'two-panel', 'glazed'],
      doorLeafTint: ['#2e3b55', '#5a3a24', '#e7e2d4'],
      windowStyle: ['six-over-six', 'colonial', 'double-hung', 'casement'],
      windowFrameTint: [null],
      livingFloor: [{ pattern: 'herringbone', colours: ['#6b4a32', '#4a3020'] }, { pattern: 'straight-plank', colours: ['#b08a5e', '#8a6a48'] }, { pattern: 'herringbone', colours: ['#b08a5e', '#8a6a48'] }],
      bedroomFloor: [{ pattern: 'straight-plank', colours: ['#6b4a32', '#4a3020'] }, { pattern: 'wide-plank', colours: ['#b08a5e', '#8a6a48'] }],
      wetFloor: [{ pattern: 'checkerboard', colours: ['#efeae0', '#1f1f1f'] }, { pattern: 'hex-tile', colours: ['#f2f0ea', '#9a9a96', '#2e3b55'] }],
      wallTreatment: ['wainscot', 'picture-frame'],
      wallpaper: [{ pattern: 'damask', colours: ['#e8e0cf', '#7a5a3a', '#6b1e1e'] }, { pattern: 'stripe', colours: ['#e9e2d2', '#2f4b3a'] }, { pattern: 'trellis', colours: ['#efe8d8', '#2e3b55', '#b8913f'] }],
    },
  },
  modern: {
    fixed: { facadeStyle: 'siding', interiorWallStyle: 'paint', facadeWaterTableTint: '#1f2226' },
    pick: {
      facadeSidingTint: ['#3d4146', '#2f3337', '#6b6f73', '#4a4540'],
      facadeTrimTint: ['#2a2d31', '#c8c4bc'],
      roof: ['modern-shed', 'butterfly'],
      windowStyle: ['picture', 'casement'],
      entryDoorTint: ['#1f2226', '#c8a13a', '#9a5a2e'],
      wallPaints: [['#eceae5', '#e4e3df', '#dfe0dd'], ['#e8e6e1', '#d9dadb', '#e2e0da']],
      floorboardTint: ['#ae9c82', '#9c8c74', '#b9a88d'],
      finish: ['ash', 'ink'],
    },
    finishes: {
      doorStyle: ['flush', 'shaker', 'fluted'],
      doorLeafTint: ['#e8e4dc', '#2b2b2b', '#b08a5e'],
      windowStyle: ['crittall', 'picture', 'casement'],
      windowFrameTint: ['#22252a', null],
      livingFloor: [{ pattern: 'chevron', colours: ['#b08a5e', '#8a6a48'] }, { pattern: 'wide-plank', colours: ['#7a6450', '#5a4636'] }, { pattern: 'herringbone', colours: ['#d2bc96', '#b49c76'] }],
      bedroomFloor: [{ pattern: 'wide-plank', colours: ['#b08a5e', '#8a6a48'] }, { pattern: 'straight-plank', colours: ['#d2bc96', '#b49c76'] }],
      wetFloor: [{ pattern: 'terrazzo', colours: ['#e6e0d6', '#8c867c', '#b9876a'] }, { pattern: 'large-format', colours: ['#d9d6cf', '#a8a49c'] }],
      wallTreatment: ['shiplap', 'picture-frame'],
      wallpaper: [{ pattern: 'grasscloth', colours: ['#cfc4ae', '#a89a80'] }, { pattern: 'trellis', colours: ['#f2efe8', '#2b2b2b'] }, { pattern: 'pinstripe', colours: ['#efece6', '#7c7f5c'] }],
      interiorWallStyle: [null],
    },
  },
  tofu: {
    fixed: { facadeStyle: 'tofu', interiorWallStyle: 'paint' },
    pick: {
      tofuBodyTint: ['#e0dbcf', '#ece8df', '#d8d4cc', '#e6ddcb'],
      tofuRevealTint: ['#8f8a7d', '#7d7a74'],
      roof: ['tofu-deck', 'tofu-stacked'],
      windowStyle: ['picture', 'german'],
      entryDoorTint: ['#8a6a48', '#3a3a38', '#d8d4cc'],
      wallPaints: [['#eeebe4', '#f0ece2', '#e8e6e0']],
      floorboardTint: ['#c2b298', '#cebea5', '#b6a48a'],
      finish: ['oat', 'sand'],
    },
    finishes: {
      doorStyle: ['flush', 'shaker'],
      doorLeafTint: ['#efece6', '#d2bc96'],
      windowStyle: ['picture', 'german', 'crittall'],
      windowFrameTint: [null, '#22252a'],
      livingFloor: [{ pattern: 'wide-plank', colours: ['#d2bc96', '#b49c76'] }, { pattern: 'straight-plank', colours: ['#d2bc96', '#b49c76'] }],
      bedroomFloor: [{ pattern: 'wide-plank', colours: ['#d2bc96', '#b49c76'] }],
      wetFloor: [{ pattern: 'large-format', colours: ['#e8e5de', '#b8b2a6'] }, { pattern: 'terrazzo', colours: ['#efece6', '#a39382', '#7c7f5c'] }],
      wallTreatment: ['shiplap'],
      wallpaper: [{ pattern: 'grasscloth', colours: ['#ded5c4', '#b8a99a'] }, { pattern: 'polka', colours: ['#f2efe8', '#b8a99a'] }],
      interiorWallStyle: [null],
    },
  },
  mission: {
    fixed: { facadeStyle: 'tofu', interiorWallStyle: 'paint', marbleTint: '#b5704f' },   // stucco, terracotta tile in the wet rooms
    pick: {
      tofuBodyTint: ['#e6d3b3', '#dcc3a0', '#efe0c6', '#e3c9a8'],
      tofuRevealTint: ['#a8876a', '#9a7a5c'],
      roof: ['mission', 'pavilion'],
      windowStyle: ['casement', 'french'],
      entryDoorTint: ['#5a3a24', '#2f4a5a', '#7a2e2a'],
      wallPaints: [['#e8d9bf', '#ead8c0', '#e2cfb2'], ['#efe3cc', '#e4d4b8', '#dcc8a8']],
      floorboardTint: ['#6c5646', '#5e4a3c'],
      finish: ['terracotta', 'indigo'],
    },
    finishes: {
      doorStyle: ['plank', 'five-panel', 'glazed'],
      doorLeafTint: ['#6b4a32', '#3a2a20'],
      windowStyle: ['prairie', 'casement', 'french'],
      windowFrameTint: [null, '#3a2a20'],
      livingFloor: [{ pattern: 'straight-plank', colours: ['#6b4a32', '#4a3020'] }, { pattern: 'herringbone', colours: ['#6b4a32', '#4a3020'] }],
      bedroomFloor: [{ pattern: 'wide-plank', colours: ['#7a6450', '#5a4636'] }],
      wetFloor: [{ pattern: 'hex-tile', colours: ['#d9c9ae', '#7a5a3a', '#c66b3d'] }, { pattern: 'checkerboard', colours: ['#d9c9ae', '#8a4b36'] }],
      wallTreatment: ['board-and-batten', 'wainscot'],
      wallpaper: [{ pattern: 'trellis', colours: ['#e6dcc8', '#6b4a32', '#c66b3d'] }, { pattern: 'stripe', colours: ['#e2d6c0', '#8a4b36'] }],
      interiorWallStyle: [null],
    },
  },
};
export const HOUSE_STYLE_NAMES = Object.keys(HOUSE_STYLES);

/** The seed a style draws from: the plan's seed, else the authored plan's geometry. */
export function houseStyleKey(input = {}) {
  if (input.seed != null) return `seed:${input.seed}`;
  const plan = Array.isArray(input.levels) && input.levels.length ? input.levels : input.rooms || [];
  return `plan:${fnv1a(JSON.stringify(plan))}`;
}

/**
 * `style` (a family name, 'auto', or absent) → the finish knobs it supplies, plus the resolved
 * `styleName`. Absent ⇒ {} (the house is untouched). An unknown name fails loudly, naming the
 * families. `view` gates the roof: only the exterior view is roofed by a style.
 *
 * `finishes: true` (a house carrying `finishes: 'auto'`, stamped at mint since 3.1) draws the family's
 * `finishes` knobs in the same roll, each from its own stream like every pick: its doors, the wider window
 * list, the window frames, a floor per room kind, a wall treatment and a wallpaper (lib/graph/finishes/).
 * A house without it draws exactly what it always did.
 */
export function houseStyleOpts(style, key, view, { finishes = false } = {}) {
  if (style == null || style === false) return {};
  if (style !== 'auto' && !HOUSE_STYLES[style]) {
    throw new Error(`unknown house style '${style}' — styles: auto, ${HOUSE_STYLE_NAMES.join(', ')}`);
  }
  const name = style === 'auto' ? pick(key, 'family', HOUSE_STYLE_NAMES) : style;
  const def = HOUSE_STYLES[name];
  const out = {
    styleName: name,
    // the dressing a style needs in order to show
    facadeDecor: true, wallDecor: true, floorStyle: 'auto', furnishScale: 'share',
    ...def.fixed,
  };
  for (const [knob, list] of Object.entries(def.pick)) {
    if (knob === 'roof' && view !== 'exterior') continue;
    const v = pick(key, `${name}|${knob}`, list);
    out[knob] = knob === 'finish' ? FINISHES[v] : v;
  }
  if (finishes && def.finishes) for (const [knob, list] of Object.entries(def.finishes)) out[knob] = pick(key, `${name}|${knob}`, list);
  out.furnishFinish = out.finish;
  delete out.finish;
  return out;
}
