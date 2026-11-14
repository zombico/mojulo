/**
 * THE WORLD'S PALETTE, READ — what a game's world is painted in, as the colour theorist's own terms, for whoever must
 * colour something that stands in it (the hero's garment, the cast's coats: hero-design.js, colour.js).
 *
 *   paletteSpecOf(G)   → the palette spec the world is solved from, or null: its stamped palette (style.palette); before
 *                        it is stored (a world just composed: color-theorist/stamp.js stamps at the write) its cube's own,
 *                        on its preset's character (era/geocube.js GEOCUBE_PALETTES)
 *   accentOf(G)        → the world's ACCENT as a colour, or null where the world has no palette: the one its author named
 *                        (the spec's `lock.accent` or `hues.accent`), a hue alone at a cloth's value, else the accent
 *                        the theorist solves
 *   groundOf(G)        → { against, palette?, from } what a figure on foot is seen against in this world
 *                        (color-theorist/figures.js seenOn): the solved palette's roles where it has a spec; else its
 *                        kit card's own ramps (the grass it stands on, the foliage behind it, its soil and rock);
 *                        null for a world with neither (a room kit)
 *
 *   GENRE_COLOUR       the colour direction (color-theorist/directions.js) a genre is laid in from a sentence, where one
 *                        was chosen at the eyes gate: a row per decision, so the next genre's is one more row and never
 *                        a guess. A genre with no row is laid as its cube paints it
 *   genrePaletteWords(genre, cubeSpec) → { direction, words } | null: the axes that direction moves on the cube's own
 *                        palette, as the cube's `palette` words (compose.js cubeWithLand)
 *
 * `G` is a read world (readGameworld's). Pure.
 */
import { solvePalette } from '../color-theorist/solve.js';
import { seenOn, FIGURE_CLEAR } from '../color-theorist/figures.js';
import { GEOCUBE_PALETTES } from '../era/geocube.js';
import { directSpec } from '../color-theorist/directions.js';
import { lchHex } from '../polygonizer/station-loft-shade.js';
import { kitCard, hasKitCard } from './style-guide.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** The accent as a garment where the palette names it as a hue alone: a mid value, saturated enough to read as cloth. */
const ACCENT_CLOTH = Object.freeze({ L: 52, C: 50 });
// the kit ramps a figure is seen against, by the role each plays, and the share of the clearance each asks
const KIT_SEEN = Object.freeze([['grass', 'ground', 1], ['foliage', 'foliage', 1], ['soil', 'soil', 0.6], ['rock', 'rock', 0.6]]);

export function paletteSpecOf(G) {
  const st = G?.style ?? {}, cube = st.geocube, from = typeof cube === 'string' ? cube : cube?.from;
  const spec = isObj(st.palette) ? st.palette : cube !== undefined ? { ...(GEOCUBE_PALETTES[from] ?? {}), ...(isObj(cube?.palette) ? cube.palette : {}) } : null;
  return spec && Object.keys(spec).length ? spec : null;
}

export function accentOf(G) {
  const spec = paletteSpecOf(G);
  if (!spec) return null;
  const named = spec.lock?.accent ?? spec.hues?.accent;
  if (typeof named === 'string') return named.toLowerCase();
  if (Number.isFinite(named)) return lchHex(ACCENT_CLOTH.L, ACCENT_CLOTH.C, named);
  try { return solvePalette(spec).roles.accent?.[2] ?? null; } catch { return null; }
}

export function groundOf(G) {
  const spec = isObj(G?.style?.palette) ? G.style.palette : null;
  if (spec) { try { const palette = solvePalette(spec); return { against: seenOn(palette), palette, from: 'palette' }; } catch { /* a spec that does not solve: its kit's ramps */ } }
  const kit = G?.style?.kit;
  if (!kit || !hasKitCard(kit)) return null;
  const ramps = kitCard(kit).ramps, mid = (r) => r.stops[Math.floor(r.stops.length / 2)];
  const against = KIT_SEEN.map(([name, what, share]) => { const r = ramps.find((x) => x.name === name); return r ? { what, hex: mid(r).toLowerCase(), min: Math.round(FIGURE_CLEAR * share * 1000) / 1000 } : null; }).filter(Boolean);
  return against.some((a) => a.what === 'ground') ? { against, from: 'kit' } : null;
}

export const GENRE_COLOUR = Object.freeze({ 'action-rpg': 'quiet-land' });

export function genrePaletteWords(genre, cubeSpec = {}) {
  const id = GENRE_COLOUR[genre];
  if (!id) return null;
  const moved = directSpec(cubeSpec, id), words = {};
  for (const [k, v] of Object.entries(moved)) if (JSON.stringify(v) !== JSON.stringify(cubeSpec[k])) words[k] = v;
  return Object.keys(words).length ? { direction: id, words } : null;
}
