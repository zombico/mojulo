/**
 * interior/styles — the named styles decorators use, each a card a room is skinned by. A card is plain data and
 * resolves DOWN to what the house's furniture already speaks (furnishings/forms.js): a style to start from per piece,
 * the forms in each slot, a cloth, a timber and its finish, a board and its paint. Nothing below changes for a card.
 *
 *   palette   the scheme by 60-30-10: `walls` and `floor` the dominant 60, `upholstery`, `rug` and `casework` the
 *             secondary 30, `accent` the 10 (an accent chair, a cushion's cloth); colour words (interior/palette.js)
 *   floor     a floor pattern in its colours (finishes/patterns.js FLOOR_PATTERNS): { pattern, colours: ['#…', '#…'] }
 *   accentWall the wall a decorator dresses apart: { style: 'wallpaper', pattern, colours } (colour words) or a
 *             treatment ({ style: 'shiplap' }), on the wall behind the bed's head or the sofa's back, else the focal wall
 *   timber    the wood of every timber piece, and `wood` its finish (construction/timber.js)
 *   fabric    the main cloth (a FABRIC_PRESETS name), woven in `palette.upholstery`; `accentFabric` the accent's
 *   forms     per furniture kind, the forms its slots take (sofa: arms, back, seat, legs; chair and table: legs;
 *             casework: front)
 *   likes     per piece, the worked style it starts from, where the card wants a particular one
 *   density   the share of floor a room may fill (minimal styles leave more open)
 *   symmetry  'mirror' pairs pieces about the focal axis; 'balanced' lets one side carry a single heavier piece
 *
 * The line is what the style is, as a decorator says it. Sources: interior-vocab research (1stDibs 2026 survey, Pinterest
 * Predicts 2026, Milan 2026 coverage); palettes are representative.
 */

export const STYLE_CARDS = Object.freeze({
  japandi: {
    label: 'Japandi', line: 'Japanese restraint and Scandinavian warmth: low, calm, natural, nothing extra',
    palette: { walls: 'warm-white', trim: 'warm-white', upholstery: 'oat', rug: 'linen', casework: 'white-oak', accent: 'charcoal' },
    floor: { pattern: 'wide-plank', colours: ['#cfb894', '#b39c78'] },
    accentWall: { style: 'shiplap' },
    timber: 'oak', wood: 'oil', fabric: 'linen', accentFabric: 'boucle',
    forms: { sofa: { arms: 'track', back: 'tight', seat: 'bench', legs: 'block' }, chair: { legs: 'block' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    likes: { 'lounge-chair': 'armchair' },
    density: 0.32, symmetry: 'balanced',
  },
  scandinavian: {
    label: 'Scandinavian', line: 'bright, functional and light-wooded, soft textiles for warmth',
    palette: { walls: 'white', trim: 'white', upholstery: 'greige', rug: 'cream', casework: 'white', accent: 'sage' },
    floor: { pattern: 'wide-plank', colours: ['#e2d3b8', '#cbb894'] },
    timber: 'birch', wood: 'wax', fabric: 'linen', accentFabric: 'boucle',
    forms: { sofa: { arms: 'track', back: 'loose', seat: 'loose', legs: 'tapered' }, chair: { legs: 'tapered' }, table: { legs: 'tapered' }, casework: { front: 'doors' } },
    density: 0.38, symmetry: 'balanced',
  },
  'mid-century': {
    label: 'mid-century modern', line: '1945–70 modernism: teak and walnut, tapered legs, tight backs, earthy colour',
    palette: { walls: 'warm-white', trim: 'warm-white', upholstery: 'mustard', rug: 'oat', casework: 'teak', accent: 'teal' },
    floor: { pattern: 'straight-plank', colours: ['#9c5b32', '#7a4428'] },
    accentWall: { style: 'wallpaper', pattern: 'trellis', colours: ['warm-white', 'teak', 'mustard'] },
    timber: 'walnut', wood: 'oil', fabric: 'twill', accentFabric: 'boucle',
    forms: { sofa: { arms: 'track', back: 'tight', seat: 'bench', legs: 'tapered' }, chair: { legs: 'tapered' }, table: { legs: 'tapered' }, casework: { front: 'doors' } },
    likes: { sofa: 'mid-century-sofa', 'dining-table': 'mid-century-table' },
    density: 0.42, symmetry: 'balanced',
  },
  'modern-organic': {
    label: 'modern organic', line: 'soft modern with natural textures: cream and clay, oak and travertine, nubby cloth',
    palette: { walls: 'cream', trim: 'cream', upholstery: 'cream', rug: 'sand', casework: 'white-oak', accent: 'clay' },
    floor: { pattern: 'wide-plank', colours: ['#c9ab84', '#a88c66'] },
    accentWall: { style: 'wallpaper', pattern: 'grasscloth', colours: ['sand', 'clay'] },
    timber: 'oak', wood: 'wax', fabric: 'boucle', accentFabric: 'linen',
    forms: { sofa: { arms: 'rolled', back: 'loose', seat: 'bench', legs: 'block' }, chair: { legs: 'block' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    density: 0.36, symmetry: 'balanced',
  },
  'warm-minimal': {
    label: 'warm minimalism', line: 'minimal forms in warm materials: few things, each in its place',
    palette: { walls: 'ivory', trim: 'ivory', upholstery: 'taupe', rug: 'mushroom', casework: 'oak', accent: 'black' },
    floor: { pattern: 'wide-plank', colours: ['#b08a5e', '#8a6a48'] },
    timber: 'oak', wood: 'oil', fabric: 'linen', accentFabric: 'linen',
    forms: { sofa: { arms: 'track', back: 'tight', seat: 'bench', legs: 'block' }, chair: { legs: 'block' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    density: 0.28, symmetry: 'balanced',
  },
  'wabi-sabi': {
    label: 'wabi-sabi', line: 'imperfection and age: raw wood, lime plaster, earth colours, handmade',
    palette: { walls: 'ash', trim: 'ash', upholstery: 'sand', rug: 'mushroom', casework: 'oak', accent: 'rust' },
    floor: { pattern: 'wide-plank', colours: ['#8a7360', '#6a5644'] },
    timber: 'oak', wood: 'raw', fabric: 'linen', accentFabric: 'canvas',
    forms: { sofa: { arms: 'none', back: 'loose', seat: 'bench', legs: 'block' }, chair: { legs: 'block' }, table: { legs: 'block' }, casework: { front: 'open' } },
    density: 0.3, symmetry: 'balanced',
  },
  industrial: {
    label: 'industrial', line: 'the loft: steel and reclaimed wood, leather and concrete, structure on show',
    palette: { walls: 'concrete', trim: 'charcoal', upholstery: 'cinnamon', rug: 'charcoal', casework: 'blackened-steel', accent: 'rust' },
    floor: { pattern: 'large-format', colours: ['#9a9a96', '#6e6e6a'] },
    timber: 'pine', wood: 'sumi', fabric: 'canvas', accentFabric: 'twill',
    forms: { sofa: { arms: 'rolled', back: 'tufted', seat: 'bench', legs: 'hairpin' }, chair: { legs: 'hairpin' }, table: { legs: 'hairpin' }, casework: { front: 'open' } },
    likes: { sofa: 'chesterfield' },
    density: 0.4, symmetry: 'balanced',
  },
  contemporary: {
    label: 'contemporary', line: 'of the moment and gallery-clean: low profiles, one saturated accent',
    palette: { walls: 'white', trim: 'white', upholstery: 'greige', rug: 'stone', casework: 'white', accent: 'sapphire' },
    floor: { pattern: 'large-format', colours: ['#dcd8d0', '#a8a49c'] },
    timber: 'ash', wood: 'oil', fabric: 'twill', accentFabric: 'velvet',
    forms: { sofa: { arms: 'track', back: 'tight', seat: 'bench', legs: 'block' }, chair: { legs: 'tapered' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    density: 0.36, symmetry: 'balanced',
  },
  transitional: {
    label: 'transitional', line: 'traditional comfort with modern restraint: symmetry, greige and navy, nickel',
    palette: { walls: 'greige', trim: 'white', upholstery: 'linen', rug: 'stone', casework: 'white', accent: 'navy' },
    floor: { pattern: 'herringbone', colours: ['#b08a5e', '#8a6a48'] },
    accentWall: { style: 'picture-frame' },
    timber: 'oak', wood: 'oil', fabric: 'linen', accentFabric: 'velvet',
    forms: { sofa: { arms: 'rolled', back: 'tight', seat: 'loose', legs: 'turned' }, chair: { legs: 'turned' }, table: { legs: 'turned' }, casework: { front: 'doors-over-drawer' } },
    likes: { sofa: 'english-roll-arm' },
    density: 0.4, symmetry: 'mirror',
  },
  'modern-farmhouse': {
    label: 'modern farmhouse', line: 'rustic and clean: white and black, barnwood and iron, slipcovered comfort',
    palette: { walls: 'white', trim: 'white', upholstery: 'cream', rug: 'oat', casework: 'black', accent: 'sage' },
    floor: { pattern: 'wide-plank', colours: ['#c29a64', '#9a7444'] },
    accentWall: { style: 'board-and-batten' },
    timber: 'pine', wood: 'wax', fabric: 'canvas', accentFabric: 'ticking',
    forms: { sofa: { arms: 'rolled', back: 'loose', seat: 'loose', legs: 'turned' }, chair: { legs: 'turned' }, table: { legs: 'turned' }, casework: { front: 'doors' } },
    likes: { 'dining-table': 'farmhouse-table', 'dining-chair': 'windsor-side-chair' },
    density: 0.42, symmetry: 'mirror',
  },
  coastal: {
    label: 'coastal', line: 'breezy and polished: white and sand, sea blue and navy, whitewashed oak and linen',
    palette: { walls: 'white', trim: 'white', upholstery: 'white', rug: 'sand', casework: 'white', accent: 'navy' },
    floor: { pattern: 'wide-plank', colours: ['#dccbb0', '#c2ae8e'] },
    accentWall: { style: 'shiplap' },
    timber: 'oak', wood: 'limewash', fabric: 'linen', accentFabric: 'ticking',
    forms: { sofa: { arms: 'rolled', back: 'loose', seat: 'loose', legs: 'bun' }, chair: { legs: 'turned' }, table: { legs: 'turned' }, casework: { front: 'doors' } },
    likes: { sofa: 'english-roll-arm' },
    density: 0.4, symmetry: 'mirror',
  },
  mediterranean: {
    label: 'modern Mediterranean', line: 'sun-baked: lime plaster, terracotta and ochre, oak and wrought iron',
    palette: { walls: 'cream', trim: 'cream', upholstery: 'linen', rug: 'terracotta', casework: 'oak', accent: 'aegean' },
    floor: { pattern: 'hex-tile', colours: ['#c66b3d', '#8c5a3c', '#cc9a45'] },
    timber: 'oak', wood: 'wax', fabric: 'linen', accentFabric: 'canvas',
    forms: { sofa: { arms: 'none', back: 'loose', seat: 'bench', legs: 'block' }, chair: { legs: 'turned' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    density: 0.4, symmetry: 'balanced',
  },
  boho: {
    label: 'boho', line: 'collected and layered: terracotta and mustard, rattan, kilims and many plants',
    palette: { walls: 'cream', trim: 'cream', upholstery: 'rust', rug: 'terracotta', casework: 'teak', accent: 'mustard' },
    floor: { pattern: 'straight-plank', colours: ['#c29a64', '#9a7444'] },
    accentWall: { style: 'wallpaper', pattern: 'botanical', colours: ['cream', 'olive', 'terracotta'] },
    timber: 'pine', wood: 'oil', fabric: 'canvas', accentFabric: 'gingham',
    forms: { sofa: { arms: 'rolled', back: 'loose', seat: 'loose', legs: 'turned' }, chair: { legs: 'turned' }, table: { legs: 'turned' }, casework: { front: 'open' } },
    density: 0.5, symmetry: 'balanced',
  },
  maximalism: {
    label: 'maximalism', line: 'more is more: jewel tones, pattern on pattern, collections on show',
    palette: { walls: 'emerald', trim: 'cream', upholstery: 'oxblood', rug: 'sapphire', casework: 'walnut', accent: 'mustard' },
    floor: { pattern: 'herringbone', colours: ['#6b4a32', '#4a3020'] },
    accentWall: { style: 'wallpaper', pattern: 'damask', colours: ['emerald', 'mustard', 'oxblood'] },
    timber: 'walnut', wood: 'oil', fabric: 'velvet', accentFabric: 'tartan',
    forms: { sofa: { arms: 'rolled-high', back: 'tufted', seat: 'bench', legs: 'bun' }, chair: { legs: 'turned' }, table: { legs: 'turned' }, casework: { front: 'doors-over-drawer' } },
    likes: { sofa: 'chesterfield', 'lounge-chair': 'club-chair' },
    density: 0.55, symmetry: 'balanced',
  },
  neodeco: {
    label: 'NeoDeco', line: '1920s glamour, geometric: black and ivory, emerald and gold, lacquer and velvet',
    palette: { walls: 'ivory', trim: 'black', upholstery: 'emerald', rug: 'ivory', casework: 'black', accent: 'brass' },
    floor: { pattern: 'checkerboard', colours: ['#f2ede2', '#1f1f1f'] },
    accentWall: { style: 'wallpaper', pattern: 'scallop', colours: ['ivory', 'brass', 'emerald'] },
    timber: 'walnut', wood: 'urushi', fabric: 'velvet', accentFabric: 'velvet',
    forms: { sofa: { arms: 'tuxedo', back: 'tufted', seat: 'bench', legs: 'block' }, chair: { legs: 'tapered' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    likes: { sofa: 'tuxedo' },
    density: 0.42, symmetry: 'mirror',
  },
  'quiet-luxury': {
    label: 'quiet luxury', line: 'materials over logos: camel and cashmere, honed stone, walnut and bronze',
    palette: { walls: 'cashmere', trim: 'cashmere', upholstery: 'camel', rug: 'stone', casework: 'walnut', accent: 'chocolate' },
    floor: { pattern: 'herringbone', colours: ['#7a5a40', '#5a4030'] },
    accentWall: { style: 'wallpaper', pattern: 'grasscloth', colours: ['camel', 'cashmere'] },
    timber: 'walnut', wood: 'oil', fabric: 'boucle', accentFabric: 'velvet',
    forms: { sofa: { arms: 'tuxedo', back: 'tight', seat: 'bench', legs: 'block' }, chair: { legs: 'block' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    likes: { sofa: 'tuxedo' },
    density: 0.34, symmetry: 'balanced',
  },
  'new-brutalism': {
    label: 'new brutalism', line: 'monolithic and raw: concrete and stone, blackened steel, thick timber in blocks',
    palette: { walls: 'concrete', trim: 'concrete', upholstery: 'charcoal', rug: 'stone', casework: 'concrete', accent: 'rust' },
    floor: { pattern: 'large-format', colours: ['#9a9a96', '#7a7a76'] },
    timber: 'oak', wood: 'sumi', fabric: 'canvas', accentFabric: 'boucle',
    forms: { sofa: { arms: 'track', back: 'tight', seat: 'bench', legs: 'block' }, chair: { legs: 'block' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    density: 0.32, symmetry: 'balanced',
  },
  grandmillennial: {
    label: 'grandmillennial', line: 'granny chic made young: florals and scallops, skirted chairs, blue and white',
    palette: { walls: 'blush', trim: 'white', upholstery: 'dusty-rose', rug: 'sea-blue', casework: 'white', accent: 'navy' },
    floor: { pattern: 'basketweave', colours: ['#b08a5e', '#8a6a48'] },
    accentWall: { style: 'wallpaper', pattern: 'botanical', colours: ['cream', 'sage', 'dusty-rose'] },
    timber: 'cherry', wood: 'wax', fabric: 'linen', accentFabric: 'gingham',
    forms: { sofa: { arms: 'rolled', back: 'tight', seat: 'loose', legs: 'turned' }, chair: { legs: 'turned' }, table: { legs: 'turned' }, casework: { front: 'drawers' } },
    likes: { sofa: 'english-roll-arm', 'dining-chair': 'windsor-side-chair' },
    density: 0.5, symmetry: 'mirror',
  },
  'dark-academia': {
    label: 'dark academia', line: 'the library: forest green and oxblood, dark wood, leather and brass',
    palette: { walls: 'forest', trim: 'walnut', upholstery: 'cinnamon', rug: 'oxblood', casework: 'walnut', accent: 'brass' },
    floor: { pattern: 'herringbone', colours: ['#5c3a21', '#3e2716'] },
    accentWall: { style: 'wallpaper', pattern: 'stripe', colours: ['forest', 'tobacco'] },
    timber: 'walnut', wood: 'oil', fabric: 'herringbone', accentFabric: 'tartan',
    forms: { sofa: { arms: 'rolled-high', back: 'tufted', seat: 'bench', legs: 'bun' }, chair: { legs: 'turned' }, table: { legs: 'turned' }, casework: { front: 'open' } },
    likes: { sofa: 'chesterfield', 'lounge-chair': 'club-chair' },
    density: 0.5, symmetry: 'mirror',
  },
  seventies: {
    label: "'70s revival", line: 'earthy and low: rust, mustard and avocado, corduroy and smoked glass',
    palette: { walls: 'cream', trim: 'cream', upholstery: 'rust', rug: 'mustard', casework: 'teak', accent: 'avocado' },
    floor: { pattern: 'straight-plank', colours: ['#7a5236', '#5a3a24'] },
    accentWall: { style: 'wallpaper', pattern: 'stripe', colours: ['cream', 'rust'] },
    timber: 'walnut', wood: 'oil', fabric: 'twill', accentFabric: 'velvet',
    forms: { sofa: { arms: 'none', back: 'loose', seat: 'loose', legs: 'block' }, chair: { legs: 'block' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    density: 0.46, symmetry: 'balanced',
  },
  'soft-modern': {
    label: 'soft modern', line: 'the 2025–26 default: rounded modern in cloud white, khaki and burnt umber, bouclé',
    palette: { walls: 'cloud-dancer', trim: 'cloud-dancer', upholstery: 'cream', rug: 'universal-khaki', casework: 'oak', accent: 'silhouette' },
    floor: { pattern: 'chevron', colours: ['#c2a27c', '#a0805c'] },
    timber: 'oak', wood: 'oil', fabric: 'boucle', accentFabric: 'velvet',
    forms: { sofa: { arms: 'rolled', back: 'tight', seat: 'bench', legs: 'block' }, chair: { legs: 'block' }, table: { legs: 'block' }, casework: { front: 'doors' } },
    density: 0.36, symmetry: 'balanced',
  },
});

export const STYLE_NAMES = Object.freeze(Object.keys(STYLE_CARDS));
// a room with no style asked for is dressed in the house's own (its furniture language), else this
export const DEFAULT_STYLE = 'soft-modern';
// a house's furniture language (furnishings/languages.js) → the card nearest it
export const LANGUAGE_STYLE = Object.freeze({ cottage: 'transitional', brick: 'dark-academia', modern: 'mid-century', tofu: 'japandi', mission: 'modern-farmhouse' });
