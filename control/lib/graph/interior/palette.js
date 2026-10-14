/**
 * interior/palette — the colour words decorators and paint cards use, as hex. A colour is a word here or '#rrggbb'.
 * Representative values, not a manufacturer's spec; the 2026 colours of the year are named after their cards.
 */

export const NAMED_COLOURS = Object.freeze({
  // whites and neutrals
  white: '#f7f6f2', 'warm-white': '#f2eee6', 'cloud-dancer': '#f0eee9', ivory: '#f5f0e8', cream: '#f3ede2',
  oat: '#d8cbb3', sand: '#cdbba0', linen: '#e6dccb', greige: '#c9c0b4', taupe: '#b8a99a', mushroom: '#a39382',
  stone: '#bdb5a8', 'universal-khaki': '#b8a88a', camel: '#c19a6b', cashmere: '#d9cbb8', ash: '#cfc7bc',
  // darks
  charcoal: '#3a3836', ink: '#23262b', black: '#1f1f1f', 'silhouette': '#5a4a42', chocolate: '#4b2e20', tobacco: '#6f4e37',
  espresso: '#3b2a22', concrete: '#9a9a96',
  // woods, as colours
  'white-oak': '#c9ab84', oak: '#b08a5e', walnut: '#5c3a21', teak: '#9c5b32', ashwood: '#d6c4a4', birch: '#e8d9c0',
  // earths
  clay: '#b9876a', terracotta: '#c66b3d', rust: '#a0522d', ochre: '#cc9a45', mustard: '#d4a017', cinnamon: '#9e5b34',
  caramel: '#b7834f', 'burnt-orange': '#c65d21',
  // greens and blues
  olive: '#7c7f5c', sage: '#a3ad94', moss: '#6e6b4e', forest: '#2f4b3a', emerald: '#0f5e4b', 'hidden-gem': '#4e6e66',
  avocado: '#7b8a3c', teal: '#2f6f73', 'sea-blue': '#8fb3c9', navy: '#2e3b55', sapphire: '#1f3a93', 'aegean': '#2a5d8f',
  // reds and pinks
  oxblood: '#6b1e1e', blush: '#e8b4b8', 'dusty-rose': '#c99a96', brick: '#8a4b36',
  // metals, as colours
  brass: '#b8913f', bronze: '#7a5a36', chrome: '#c9ccd1', 'blackened-steel': '#2b2b2b', nickel: '#b9b7b0',
});

const HEX = /^#[0-9a-f]{6}$/i;
const norm = (w) => String(w || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

/** A colour word or hex → '#rrggbb', or null. */
export function colourHex(word) {
  if (typeof word !== 'string') return null;
  if (HEX.test(word)) return word.toLowerCase();
  return NAMED_COLOURS[norm(word)] || null;
}

/** Why a colour is not one → string, or null. */
export function colourError(word, at) {
  return colourHex(word) ? null : `${at}: '${word}' is not a colour ('#rrggbb' or a name: ${Object.keys(NAMED_COLOURS).slice(0, 12).join(', ')}, …)`;
}

/** Mix two hex colours, t of the way from a to b. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const c = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
