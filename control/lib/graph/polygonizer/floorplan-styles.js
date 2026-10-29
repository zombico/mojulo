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
  // the townhouse traditions (architect mode): a parlour's walnut, a London terrace's oak and green, a Dutch house's
  // pale oak and grey, a Japanese house's hinoki
  parlour: { wood: '#5e3d26', upholstery: '#4f5a4c', bedding: '#d9d2c3', rug: '#7a4a3c', cabinet: '#2e3136' },
  stock: { wood: '#8a6440', upholstery: '#3f5a45', bedding: '#e2dccd', rug: '#6d5a7a', cabinet: '#e8e3d8' },
  polder: { wood: '#b08a5e', upholstery: '#9aa3a8', bedding: '#ece7dc', rug: '#5d6b74', cabinet: '#e9e6df' },
  hinoki: { wood: '#d6bf95', upholstery: '#cfc6b4', bedding: '#f0ece2', rug: '#b7aa92', cabinet: '#efebe3' },
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
  // ── the townhouse traditions, contemporary (architect mode's house forms; any form may wear them) ──
  // a North American brownstone: coursed brown sandstone, a flat roof behind a deep cornice, tall sashes, a dark door
  brownstone: {
    fixed: { facadeStyle: 'stone', interiorWallStyle: 'paint', facadeWaterTableTint: '#5b4537' },
    pick: {
      stoneBodyTint: ['#7a5a46', '#6b4c3b', '#86644e', '#cfc3ad'],
      stoneJointTint: ['#5e4536', '#54402f'],
      roof: ['cornice'],
      windowStyle: ['double-hung', 'six-over-six'],
      entryDoorTint: ['#1a1a1a', '#5a3a24', '#2e3a2f'],
      wallPaints: [['#efebe3', '#e8e4da', '#ece6da'], ['#e5e1d6', '#dcd7cb', '#e9e4d8']],
      floorboardTint: ['#6f5d4b', '#7a6851'],
      finish: ['parlour', 'walnut'],
    },
    finishes: {
      doorStyle: ['two-panel', 'glazed', 'six-panel'],
      doorLeafTint: ['#1a1a1a', '#5a3a24', '#efebe3'],
      windowStyle: ['double-hung', 'six-over-six'],
      windowFrameTint: [null, '#2a2d31'],
      livingFloor: [{ pattern: 'herringbone', colours: ['#8a6a48', '#6b4a32'] }, { pattern: 'straight-plank', colours: ['#7a6450', '#5a4636'] }],
      bedroomFloor: [{ pattern: 'wide-plank', colours: ['#8a6a48', '#6b4a32'] }],
      wetFloor: [{ pattern: 'hex-tile', colours: ['#f2f0ea', '#1f1f1f', '#9a9a96'] }, { pattern: 'checkerboard', colours: ['#efeae0', '#1f1f1f'] }],
      wallTreatment: ['picture-frame', 'wainscot'],
      wallpaper: [{ pattern: 'stripe', colours: ['#ece6da', '#5a3a24'] }, { pattern: 'damask', colours: ['#e8e0cf', '#4f5a4c', '#7a4a3c'] }],
      interiorWallStyle: [null],
    },
  },
  // a London terrace: yellow-grey stock brick or white stucco, slate with its ridge to the street, sashes, a bold door
  terrace: {
    fixed: { interiorWallStyle: 'paint', facadeWaterTableTint: '#3c4148' },
    pick: {
      facadeStyle: ['brick', 'brick', 'render'],
      brickBodyTint: ['#c2b087', '#b4a27c', '#cbb995', '#a8946c'],
      brickMortarTint: ['#e2d9c6', '#d8cfbc'],
      renderBodyTint: ['#efeae0', '#f2efe8', '#e8e2d4'],
      roof: ['terrace-slate'],
      windowStyle: ['six-over-six', 'double-hung'],
      entryDoorTint: ['#1f2a44', '#1e3a2f', '#1a1a1a', '#7a2320'],
      wallPaints: [['#ece7dc', '#e3dccd', '#e8e2d4'], ['#dfe3dc', '#e6e1d4', '#d9dcd2']],
      floorboardTint: ['#8a7356', '#7a6450'],
      finish: ['stock', 'forest'],
    },
    finishes: {
      doorStyle: ['six-panel', 'two-panel', 'glazed'],
      doorLeafTint: ['#e8e3d8', '#1f2a44', '#1e3a2f'],
      windowStyle: ['six-over-six', 'double-hung'],
      windowFrameTint: [null],
      livingFloor: [{ pattern: 'herringbone', colours: ['#b08a5e', '#8a6a48'] }, { pattern: 'wide-plank', colours: ['#a8865e', '#86684a'] }],
      bedroomFloor: [{ pattern: 'wide-plank', colours: ['#b08a5e', '#8a6a48'] }],
      wetFloor: [{ pattern: 'hex-tile', colours: ['#efeae0', '#3a4a42', '#c9b48e'] }, { pattern: 'checkerboard', colours: ['#efeae0', '#2e3b55'] }],
      wallTreatment: ['wainscot', 'beadboard'],
      wallpaper: [{ pattern: 'botanical', colours: ['#efe6d6', '#3f5a45', '#c99a6a'] }, { pattern: 'stripe', colours: ['#e9e2d2', '#1f2a44'] }],
      interiorWallStyle: [null],
    },
  },
  // a Dutch canal or infill house: dark or warm brick, a steep gable to the street, tall slim glazing in anthracite
  canal: {
    fixed: { facadeStyle: 'brick', interiorWallStyle: 'paint', facadeWaterTableTint: '#2a2c2e' },
    pick: {
      brickBodyTint: ['#3f3833', '#4a403a', '#7a4a3a', '#5b4a40'],
      brickMortarTint: ['#8a837a', '#b8b0a4'],
      roof: ['canal-gable', 'canal-gable', 'tofu-deck'],
      windowStyle: ['german', 'french', 'casement'],
      entryDoorTint: ['#2a2d31', '#b08a5e', '#3a4a42'],
      wallPaints: [['#f0eee9', '#ebe8e2', '#e6e3dc']],
      floorboardTint: ['#b9a88d', '#a8957a'],
      finish: ['polder', 'ash'],
    },
    finishes: {
      doorStyle: ['flush', 'glazed', 'fluted'],
      doorLeafTint: ['#2a2d31', '#b08a5e'],
      windowStyle: ['german', 'french', 'casement'],
      windowFrameTint: ['#383e42', null],
      livingFloor: [{ pattern: 'wide-plank', colours: ['#c8b08a', '#a8906a'] }, { pattern: 'chevron', colours: ['#c8b08a', '#a8906a'] }],
      bedroomFloor: [{ pattern: 'wide-plank', colours: ['#c8b08a', '#a8906a'] }],
      wetFloor: [{ pattern: 'large-format', colours: ['#d9d6cf', '#8c8a84'] }, { pattern: 'terrazzo', colours: ['#e6e0d6', '#5d6b74', '#b9876a'] }],
      wallTreatment: ['shiplap'],
      wallpaper: [{ pattern: 'pinstripe', colours: ['#efece6', '#5d6b74'] }, { pattern: 'grasscloth', colours: ['#d8cfbc', '#a89a80'] }],
      interiorWallStyle: [null],
    },
  },
  // a Japanese small house (kyōshō jūtaku): white render, charred cedar or corrugated galvalume, a mono-pitch or a flat
  // roof, few openings to the street, aluminium sliders
  kyosho: {
    fixed: { interiorWallStyle: 'paint', cladding: 'corrugated', facadeWaterTableTint: '#3a3735' },
    pick: {
      facadeStyle: ['render', 'boards', 'metal'],
      renderBodyTint: ['#eeeae2', '#f2f0eb', '#e4e1da'],
      boardTint: ['#2b2826', '#2b2826', '#a07850'],
      roof: ['galvalume-shed', 'tofu-deck'],
      windowStyle: ['slider', 'picture'],
      entryDoorTint: ['#3a3735', '#a07850', '#d9d6cf'],
      wallPaints: [['#f2f0eb', '#eeebe4', '#f0ede6']],
      floorboardTint: ['#d6bf95', '#c8b088'],
      finish: ['hinoki', 'oat'],
    },
    finishes: {
      doorStyle: ['flush', 'plank'],
      doorLeafTint: ['#d6bf95', '#3a3735'],
      windowStyle: ['slider', 'picture'],
      windowFrameTint: ['#b9bdc1', '#5b5148'],
      livingFloor: [{ pattern: 'wide-plank', colours: ['#dcc49c', '#c4ab82'] }, { pattern: 'straight-plank', colours: ['#dcc49c', '#c4ab82'] }],
      bedroomFloor: [{ pattern: 'wide-plank', colours: ['#dcc49c', '#c4ab82'] }],
      wetFloor: [{ pattern: 'large-format', colours: ['#e8e5de', '#b8b2a6'] }],
      wallTreatment: ['shiplap'],
      wallpaper: [{ pattern: 'grasscloth', colours: ['#e6dfcf', '#c4b79c'] }],
      interiorWallStyle: [null],
    },
  },
};
export const HOUSE_STYLE_NAMES = Object.keys(HOUSE_STYLES);
// the families a house of the first look rolls from under `style: 'auto'`, in their first order: every house minted
// before the townhouse traditions keeps its family
const ROLLED_FAMILIES = Object.freeze(['cottage', 'brick', 'modern', 'tofu', 'mission']);
// a house of look 2 rolls its family from its form and its tradition (the house's `design.tradition`): a townhouse is
// its tradition's street house, a block a modern one, a detached house one of the first five (a Japanese one its own)
export const FAMILY_BY = Object.freeze({
  townhouse: { 'north-american': ['brownstone', 'brownstone', 'brick'], british: ['terrace'], metric: ['canal'], japanese: ['kyosho'] },
  block: { 'north-american': ['tofu', 'modern'], british: ['tofu', 'modern'], metric: ['tofu', 'canal'], japanese: ['kyosho', 'tofu'] },
  detached: { 'north-american': ROLLED_FAMILIES, british: ROLLED_FAMILIES, metric: ROLLED_FAMILIES, japanese: ['kyosho', 'tofu', 'modern'] },
});
const familyFor = (key, { look, form, tradition }) => (readLook(look) >= 2
  ? pick(key, 'family', (FAMILY_BY[form || 'detached'] || FAMILY_BY.detached)[tradition || 'north-american'] || ROLLED_FAMILIES)
  : pick(key, 'family', ROLLED_FAMILIES));

/** The seed a style draws from: the plan's seed, else the authored plan's geometry. */
export function houseStyleKey(input = {}) {
  if (input.seed != null) return `seed:${input.seed}`;
  const plan = Array.isArray(input.levels) && input.levels.length ? input.levels : input.rooms || [];
  return `plan:${fnv1a(JSON.stringify(plan))}`;
}

// HOME WINDOWS (a house of `houseLook: 2`, stamped at mint since architect mode): a home's windows are a home's, drawn from
// its tradition's (the house's `design.tradition`: North American, European, Asian) and its family's, never the steel
// grid of a workshop. Crittall stays in the catalog (finishes/index.js) for the buildings that want it, and for a house
// that names it. A frame of null wears the house's trim.
export const HOUSE_LOOKS = Object.freeze([1, 2]);
export const WINDOW_REGIONS = Object.freeze({ 'north-american': 'north-american', british: 'european', metric: 'european', japanese: 'asian' });
const ANTHRACITE = '#383e42', BLACK = '#2a2d31', BRONZE = '#3a2a20', ALUMINIUM = '#b9bdc1', DARK_ALU = '#5b5148';
export const HOME_WINDOWS = Object.freeze({
  'north-american': {
    cottage: { windowStyle: ['double-hung', 'six-over-six', 'cottage', 'colonial'], windowFrameTint: [null] },
    brick: { windowStyle: ['double-hung', 'six-over-six', 'colonial'], windowFrameTint: [null] },
    modern: { windowStyle: ['casement', 'picture', 'double-hung'], windowFrameTint: [BLACK, null] },
    tofu: { windowStyle: ['picture', 'casement'], windowFrameTint: [null, BLACK] },
    mission: { windowStyle: ['casement', 'prairie', 'double-hung'], windowFrameTint: [null, BRONZE] },
    brownstone: { windowStyle: ['double-hung', 'six-over-six'], windowFrameTint: [null, BLACK] },
    terrace: { windowStyle: ['six-over-six', 'double-hung'], windowFrameTint: [null] },
    canal: { windowStyle: ['casement', 'picture'], windowFrameTint: [BLACK, null] },
    kyosho: { windowStyle: ['slider', 'casement'], windowFrameTint: [ALUMINIUM, BLACK] },
  },
  european: {
    cottage: { windowStyle: ['casement', 'cottage'], windowFrameTint: [null] },
    brick: { windowStyle: ['six-over-six', 'casement', 'transom'], windowFrameTint: [null] },
    modern: { windowStyle: ['german', 'picture', 'casement'], windowFrameTint: [ANTHRACITE, null] },
    tofu: { windowStyle: ['german', 'picture'], windowFrameTint: [ANTHRACITE, null] },
    mission: { windowStyle: ['casement', 'french'], windowFrameTint: [null, BRONZE] },
    // (a British sash is the double-hung; a Dutch house's the tall tilt-turn and French windows)
    brownstone: { windowStyle: ['double-hung', 'casement'], windowFrameTint: [null] },
    terrace: { windowStyle: ['six-over-six', 'double-hung'], windowFrameTint: [null] },
    canal: { windowStyle: ['german', 'french', 'casement'], windowFrameTint: [ANTHRACITE, null] },
    kyosho: { windowStyle: ['german', 'picture'], windowFrameTint: [ANTHRACITE] },
  },
  asian: {
    cottage: { windowStyle: ['slider', 'casement'], windowFrameTint: [ALUMINIUM, DARK_ALU] },
    brick: { windowStyle: ['slider', 'casement'], windowFrameTint: [ALUMINIUM, DARK_ALU] },
    modern: { windowStyle: ['slider', 'picture'], windowFrameTint: [ALUMINIUM, DARK_ALU] },
    tofu: { windowStyle: ['slider', 'picture'], windowFrameTint: [ALUMINIUM, DARK_ALU] },
    mission: { windowStyle: ['slider', 'casement'], windowFrameTint: [DARK_ALU, ALUMINIUM] },
    brownstone: { windowStyle: ['casement', 'slider'], windowFrameTint: [DARK_ALU] },
    terrace: { windowStyle: ['casement', 'slider'], windowFrameTint: [DARK_ALU, ALUMINIUM] },
    canal: { windowStyle: ['slider', 'picture'], windowFrameTint: [DARK_ALU] },
    kyosho: { windowStyle: ['slider', 'picture'], windowFrameTint: [ALUMINIUM, DARK_ALU] },
  },
});
/** A house's `houseLook`: 1 (absent: as every house before architect mode) or 2 (a home's windows). */
export function readLook(v) {
  if (v === undefined || v === null) return 1;
  if (!HOUSE_LOOKS.includes(v)) throw new Error(`houseLook: one of ${HOUSE_LOOKS.join(', ')} (2: a home's windows from its tradition; 1 or absent: as before)`);
  return v;
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
 *
 * `houseLook: 2` (stamped at mint since architect mode) draws the windows a home has (HOME_WINDOWS), by its `tradition`
 * (the house's design tradition; absent, North American) and its family, each from its own stream.
 */
export function houseStyleOpts(style, key, view, { finishes = false, look = 1, tradition = null, form = null } = {}) {
  if (style == null || style === false) return {};
  if (style !== 'auto' && !HOUSE_STYLES[style]) {
    throw new Error(`unknown house style '${style}' — styles: auto, ${HOUSE_STYLE_NAMES.join(', ')}`);
  }
  const name = style === 'auto' ? familyFor(key, { look, form, tradition }) : style;
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
  if (readLook(look) >= 2) {
    const region = WINDOW_REGIONS[tradition || 'north-american'] || 'north-american', home = HOME_WINDOWS[region][name];
    out.windowStyle = pick(key, `${name}|home-window|${region}`, home.windowStyle);
    out.windowFrameTint = pick(key, `${name}|home-frame|${region}`, home.windowFrameTint);
  }
  out.furnishFinish = out.finish;
  delete out.finish;
  return out;
}
