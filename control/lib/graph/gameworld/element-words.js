/**
 * ELEMENT WORDS — what a direction's leading and supporting elements are, as the character book draws them: the tint a
 * word lands on the hero's palette (hero-looks.js) and the stone a staff cradles (adornment-kit.js, equipment's
 * CRYSTAL_GEMS). One row per word, so a new element is a row; a word with no stone gives a plain head.
 */
const ROWS = {
  flame: ['#d4572a', 'ruby'], fire: ['#d4572a', 'ruby'], ember: ['#d4572a', 'ruby'], lava: ['#d4572a', 'ruby'],
  wind: ['#9fd6c8', 'quartz'], air: ['#9fd6c8', 'quartz'], storm: ['#7f93b8', 'tourmaline'],
  water: ['#3f86c4', 'sapphire'], tide: ['#3f86c4', 'sapphire'], ice: ['#a9d4ea', 'diamond'], frost: ['#a9d4ea', 'diamond'],
  earth: ['#8a6a43', 'calcite'], stone: ['#8a6a43', 'calcite'], forest: ['#4f7a3f', 'tourmaline'], leaf: ['#4f7a3f', 'tourmaline'],
  lightning: ['#e8cf4a', 'amethyst'], thunder: ['#e8cf4a', 'amethyst'], light: ['#f2e7b0', 'diamond'], sun: ['#f2e7b0', 'opal'],
  shadow: ['#4a3a6a', 'amethyst'], dark: ['#4a3a6a', 'amethyst'], moon: ['#b8c0dc', 'opal'],
  brass: ['#b58a3a'], gold: ['#c9a23a'], iron: ['#6a6f78'],
};

export const ELEMENT_WORDS = Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([w, [tint, gem]]) => [w, Object.freeze({ tint, ...(gem ? { gem } : {}) })])));
/** word → the hero palette tint */
export const ELEMENT_TINT = Object.freeze(Object.fromEntries(Object.entries(ELEMENT_WORDS).map(([w, r]) => [w, r.tint])));
/** word → the stone a staff cradles (only the words that have one) */
export const ELEMENT_GEM = Object.freeze(Object.fromEntries(Object.entries(ELEMENT_WORDS).filter(([, r]) => r.gem).map(([w, r]) => [w, r.gem])));
