/**
 * furnishings/languages — what furniture a house of each style (polygonizer/floorplan-styles.js HOUSE_STYLES) is
 * furnished with, under `furnishing: 'composed'`. A language names, per roster role (roster.js ROLES), the styles
 * (forms.js FURNITURE_STYLES) a room may lock in that role's place, and the leg forms, cloths and timbers its pieces
 * wear. A house stays one house (its pieces speak one language, and its timber is one timber) while its rooms vary:
 * each room picks per role, seeded, so the chairs round one table match and the next house differs.
 *
 * The first entry of each list is the language's most typical; a pick is uniform over the list, so a list that wants
 * one thing more often names it twice.
 */
import { FURNITURE_STYLES } from './forms.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

// the roles a composed room fills; every other piece (a bed, a rug, a lamp, the kitchen run) keeps its own mesh
export const COMPOSED_ROLES = ['sofa', 'easy-chair', 'dining-chair', 'coffee-table', 'dining-table', 'bookcase', 'media', 'sideboard', 'dresser', 'nightstand'];

export const FURNITURE_LANGUAGES = {
  cottage: {
    label: 'cottage: rolled arms, turned legs, cotton and linen, pine and cherry',
    styles: {
      sofa: ['english-roll-arm', 'english-roll-arm', 'sofa', 'chesterfield'],
      'easy-chair': ['armchair', 'club-chair'],
      'dining-chair': ['windsor-side-chair', 'windsor-side-chair', 'chair'],
      'coffee-table': ['coffee-table'],
      'dining-table': ['farmhouse-table', 'farmhouse-table', 'dining-table'],
      bookcase: ['bookcase'], media: ['media-console'], sideboard: ['sideboard'],
      dresser: ['painted-dresser', 'chest'], nightstand: ['nightstand'],
    },
    legs: ['turned', 'turned', 'bun', 'block'],
    fabrics: ['linen', 'ticking', 'gingham', 'canvas'],
    timbers: ['pine', 'cherry', 'oak'],
  },
  brick: {
    label: 'brick: chesterfields and club chairs, velvet and tweed, walnut and oak',
    styles: {
      sofa: ['chesterfield', 'chesterfield', 'tuxedo', 'english-roll-arm'],
      'easy-chair': ['club-chair', 'club-chair', 'armchair'],
      'dining-chair': ['chair', 'windsor-side-chair'],
      'coffee-table': ['coffee-table'],
      'dining-table': ['dining-table', 'farmhouse-table'],
      bookcase: ['bookcase'], media: ['media-console'], sideboard: ['sideboard'],
      dresser: ['chest'], nightstand: ['nightstand'],
    },
    legs: ['bun', 'turned', 'block'],
    fabrics: ['velvet', 'herringbone', 'tartan', 'houndstooth'],
    timbers: ['walnut', 'oak'],
  },
  modern: {
    label: 'modern: tight backs and bench seats, tapered and hairpin legs, twill and bouclé, walnut',
    styles: {
      sofa: ['mid-century-sofa', 'mid-century-sofa', 'tuxedo', 'settee'],
      'easy-chair': ['armchair', 'club-chair'],
      'dining-chair': ['chair'],
      'coffee-table': ['coffee-table'],
      'dining-table': ['mid-century-table', 'mid-century-table', 'dining-table'],
      bookcase: ['bookcase'], media: ['media-console'], sideboard: ['sideboard'],
      dresser: ['chest'], nightstand: ['nightstand'],
    },
    legs: ['tapered', 'tapered', 'hairpin', 'block'],
    fabrics: ['twill', 'boucle', 'canvas'],
    timbers: ['walnut', 'ash'],
  },
  tofu: {
    label: 'tofu: low, plain and pale, block and tapered legs, linen and bouclé, hinoki, maple and ash',
    styles: {
      sofa: ['settee', 'sofa', 'mid-century-sofa'],
      'easy-chair': ['armchair'],
      'dining-chair': ['chair'],
      'coffee-table': ['coffee-table'],
      'dining-table': ['dining-table', 'mid-century-table'],
      bookcase: ['bookcase'], media: ['media-console'], sideboard: ['sideboard'],
      dresser: ['chest'], nightstand: ['nightstand'],
    },
    legs: ['block', 'block', 'tapered'],
    fabrics: ['linen', 'boucle', 'canvas'],
    timbers: ['hinoki', 'maple', 'ash'],
  },
  mission: {
    label: 'mission: square and solid, block legs, canvas and tweed, oak',
    styles: {
      sofa: ['sofa', 'sofa', 'tuxedo', 'english-roll-arm'],
      'easy-chair': ['armchair', 'club-chair'],
      'dining-chair': ['chair', 'windsor-side-chair'],
      'coffee-table': ['coffee-table'],
      'dining-table': ['farmhouse-table', 'dining-table'],
      bookcase: ['bookcase'], media: ['media-console'], sideboard: ['sideboard'],
      dresser: ['chest', 'painted-dresser'], nightstand: ['nightstand'],
    },
    legs: ['block', 'block', 'turned'],
    fabrics: ['canvas', 'herringbone', 'twill'],
    timbers: ['oak', 'oak', 'cherry'],
  },
};
export const FURNITURE_LANGUAGE_NAMES = Object.keys(FURNITURE_LANGUAGES);
// a house with no style (or an unknown one) speaks this
export const DEFAULT_LANGUAGE = 'modern';

// FNV-1a over a string → a 32-bit seed (the floorplan styles' own idea: a seed keyed on what it is for)
function keyed(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h || 1;
}
const pickOf = (rng, list) => list[Math.floor(rng() * list.length) % list.length];

/**
 * The composition a room locks in a role's place: { like, forms, finish }, seeded by the house, the room and the role
 * (so every chair at one table is the same chair), in the house's language. The timber is the house's, picked once.
 * `palette` is the house style's ({ upholstery, cabinet }): its colour weaves a plain cloth and paints painted casework.
 * Returns null for a role the language does not compose.
 */
export function composeForRole(language, role, { houseSeed = 1, roomSeed = 1, palette = null } = {}) {
  const L = FURNITURE_LANGUAGES[language] || FURNITURE_LANGUAGES[DEFAULT_LANGUAGE];
  const styles = L.styles[role];
  if (!styles) return null;
  const rng = mulberry32(keyed(language, houseSeed, roomSeed, role));
  const like = pickOf(rng, styles);
  const kind = FURNITURE_STYLES[like].kind;
  const forms = {}, finish = {};
  // legs: the language's, unless the style is defined by its own (a farmhouse table's turned legs, a settee's hairpins)
  if (kind !== 'casework') { const legs = pickOf(rng, L.legs); if (!FURNITURE_STYLES[like].forms.legs) forms.legs = legs; }
  const timber = pickOf(mulberry32(keyed(language, houseSeed, 'timber')), L.timbers);
  if (kind === 'sofa') {
    const cloth = pickOf(rng, L.fabrics);
    // a plain cloth takes the house's upholstery colour; a patterned one keeps its own
    finish.fabric = palette && typeof palette.upholstery === 'string' && PLAIN.has(cloth) ? { preset: cloth, warp: palette.upholstery } : cloth;
    finish.timber = timber;
  } else if (kind === 'chair' || kind === 'table') {
    finish.timber = timber;
  } else if (FURNITURE_STYLES[like].finish.paint && palette && typeof palette.cabinet === 'string') {
    finish.paint = palette.cabinet;
  }
  return { like, forms, finish };
}
// cloths of one colour, which a house palette may recolour (fabric.js FABRIC_PRESETS)
const PLAIN = new Set(['linen', 'canvas', 'velvet', 'boucle']);
