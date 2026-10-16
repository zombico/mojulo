/**
 * interior/skin — a style card worn by a room. A placed piece becomes what the house's furniture speaks: a composed
 * piece's { like, forms, finish } (furnishings/forms.js, locked later at the piece's own size), or a mesh piece's
 * palette by family (architecture/room-assets.js recolorManifest). The room's surfaces (walls, trim, floor) come from
 * the card's palette under the operator's own.
 *
 * The scheme is 60-30-10: the walls and floor the dominant, the sofa, rug and casework the secondary, and the accent on
 * the chairs (an accent chair is the decorator's usual 10%). `style.accent` names a second card the chairs and the
 * coffee table are drawn from, the 80/20 mix decorators make (Japandi with a mid-century accent).
 */
import { STYLE_CARDS, DEFAULT_STYLE, LANGUAGE_STYLE } from './styles.js';
import { PIECES } from './pieces.js';
import { colourHex } from './palette.js';
import { readPaletteSpec, solvePalette } from '../color-theorist/solve.js';
import { interiorPalette } from '../color-theorist/adapters.js';
import { FURNITURE_KINDS, FURNITURE_STYLES, resolveFurniture } from '../furnishings/forms.js';
import { FABRIC_PRESETS } from '../construction/fabric.js';
import { FINISHES as TIMBER_FINISHES } from '../construction/timber.js';
import { FLOOR_PATTERNS, WALLPAPERS } from '../finishes/index.js';

// cloths of one colour, which a scheme recolours; a patterned cloth keeps its own (furnishings/languages.js PLAIN)
const PLAIN = new Set(['linen', 'canvas', 'velvet', 'boucle', 'twill']);
const WOOD_WORDS = new Set(['white-oak', 'oak', 'walnut', 'teak', 'ashwood', 'birch']);
// a timber's colour, for a mesh piece's wood family (the composed pieces draw the timber itself)
const TIMBER_HEX = { oak: '#b08a5e', ash: '#d6c4a4', walnut: '#5c3a21', pine: '#c9a26b', birch: '#e8d9c0', cherry: '#9a5a3a', maple: '#d9b98a', beech: '#d2ae84', hinoki: '#e2c9a0', keyaki: '#b48a5c' };
const DARK_FINISH = { sumi: '#2b2724', urushi: '#3a1f18', yakisugi: '#262320' };
// the pieces that wear the accent: the 10%
const ACCENT_IDS = /^(conversation\.chair-|reading\.chair)/;
const ACCENT_TABLE = /^conversation\.coffee-table/;

/** The card a room is dressed in: the asked style, else the house's furniture language's nearest, else the default.
 * Its colours: the card's, then a palette solved for the room (color-theorist; the interior's `palette`), then the
 * operator's own words over both. */
export function styleCard(style, house = {}, palette = undefined) {
  const name = typeof style === 'string' ? style : style?.name;
  const base = STYLE_CARDS[name] || STYLE_CARDS[LANGUAGE_STYLE[house.furnitureLanguage]] || STYLE_CARDS[DEFAULT_STYLE];
  const id = STYLE_CARDS[name] ? name : Object.keys(STYLE_CARDS).find((k) => STYLE_CARDS[k] === base);
  const accentName = typeof style === 'object' && style ? style.accent : null;
  const accent = accentName && STYLE_CARDS[accentName] ? { id: accentName, ...STYLE_CARDS[accentName] } : null;
  // the operator's palette words over the card's
  const solved = palette && palette !== false ? solvePalette(palette === 'auto' ? {} : palette) : null;
  const colours = { ...base.palette, ...(solved ? interiorPalette(solved, base.palette) : {}), ...(typeof style === 'object' && style?.palette ? style.palette : {}) };
  return { id, ...base, palette: colours, accent, ...(solved ? { solved: { id: solved.id, scheme: solved.read.scheme, key: solved.read.key } } : {}) };
}

/** Why an interior's palette spec is malformed → string[]. */
export function paletteErrors(palette) {
  if (palette === undefined) return [];
  try { readPaletteSpec(palette, 'palette'); return []; } catch (e) { return [e.message]; }
}

/** Why a style is malformed → string[]. */
export function styleErrors(style) {
  const e = [];
  if (style == null) return e;
  const name = typeof style === 'string' ? style : style.name;
  if (name != null && !STYLE_CARDS[name]) e.push(`style: '${name}' is not a style (${Object.keys(STYLE_CARDS).join(', ')})`);
  if (typeof style === 'object') {
    if (style.accent != null && !STYLE_CARDS[style.accent]) e.push(`style.accent: '${style.accent}' is not a style`);
    for (const [k, v] of Object.entries(style.palette || {})) if (!colourHex(v)) e.push(`style.palette.${k}: '${v}' is not a colour`);
  }
  return e;
}

const fabricOf = (preset, colour) => (PLAIN.has(preset) && colour ? { preset, warp: colour } : preset);
const timberHex = (card) => DARK_FINISH[card.wood] || TIMBER_HEX[card.timber] || '#b08a5e';

/** A placed piece in a card → { compose } for a composed piece or { finish } (mesh families) for a mesh one. */
export function skinPiece(p, card, override = {}) {
  const P = PIECES[p.piece];
  const useAccent = card.accent && (ACCENT_IDS.test(p.id) || ACCENT_TABLE.test(p.id));
  const C = useAccent ? card.accent : card;
  const pal = card.palette, hex = (w) => colourHex(w);
  if (P.render === 'mesh') {
    const finish = { wood: timberHex(card) };
    if (p.piece === 'rug') finish.rug = hex(pal.rug);
    if (p.piece === 'bed') { finish.bedding = hex(pal.upholstery); finish.upholstery = hex(pal.upholstery); }
    if (p.piece === 'bench' || p.piece === 'desk') finish.cabinet = hex(WOOD_WORDS.has(pal.casework) ? pal.casework : pal.casework);
    return { finish: Object.fromEntries(Object.entries(finish).filter(([, v]) => v)) };
  }
  // composed: the style to start from, its forms, its finish
  const kind = P.kind;
  const asked = override.like;
  const cardLike = C.likes?.[p.piece];
  let like = asked || cardLike || P.like;
  if (!FURNITURE_STYLES[like] || FURNITURE_STYLES[like].kind !== kind) like = P.like;
  // a worked style keeps the forms that make it what it is (a chesterfield's rolled arms, a bookcase's open front);
  // the card fills the slots it leaves open
  const slots = FURNITURE_KINDS[kind].slots;
  const cardForms = Object.fromEntries(Object.entries(C.forms?.[kind] || {}).filter(([s]) => slots[s] && !FURNITURE_STYLES[like].forms[s]));
  const forms = { ...cardForms, ...(override.forms || {}) };
  const finish = {};
  const upholstery = useAccent ? hex(pal.accent) : hex(pal.upholstery);
  if (kind === 'sofa') {
    finish.fabric = fabricOf(useAccent ? C.accentFabric || C.fabric : C.fabric, upholstery);
    finish.timber = C.timber;
  } else if (kind === 'chair' || kind === 'table') {
    finish.timber = C.timber;
    if (TIMBER_FINISHES[C.wood]) finish.wood = C.wood;
  } else if (kind === 'casework') {
    if (WOOD_WORDS.has(pal.casework)) { finish.board = 'plywood'; if (TIMBER_FINISHES[C.wood]) finish.wood = C.wood; }
    else { finish.board = 'mdf'; finish.paint = hex(pal.casework) || '#e8e2d6'; }
  }
  // only what the kind wears (forms.js finishErrors), then the operator's finish over it
  const out = { like, forms, finish: { ...finish, ...(override.finish || {}) } };
  // the console's screen hangs on the wall (interior/wall-faces.js), not on the console
  if (p.piece === 'media-console') out.dress = false;
  resolveFurniture({ like: out.like, forms: out.forms, finish: out.finish, size: [p.w, p.d, p.h] });   // throws, naming what is valid, on a bad override
  return { compose: out };
}

const hexAll = (cs) => (Array.isArray(cs) ? cs.map((c) => colourHex(c)).filter(Boolean) : []);
// a wall spec (a card's accent wall, or the operator's) → the fit-out's: a paper in its colours, or a treatment
function wallSpec(w, paint, base) {
  const style = w.style || 'paint';
  const out = { style, paint: colourHex(w.paint) || paint, base, ...(w.material !== undefined ? { material: w.material } : {}) };
  if (style === 'wallpaper' && WALLPAPERS[w.pattern]) {
    const colours = hexAll(w.colours);
    out.wallpaper = { pattern: w.pattern, colours: colours.length >= 2 ? colours : [paint, '#7c7f5c'] };
  }
  return out;
}

/**
 * The room's surfaces from the card, under the operator's `surface`: { walls, floor } for the house's fit-out. The
 * card's accent wall goes on `accentEdge` (the wall behind the bed's head or the sofa's back, else the focal wall)
 * unless the operator dresses that wall, or says `accentWall: false`.
 */
export function skinSurfaces(card, surface = {}, accentEdge = null) {
  const pal = card.palette;
  const paint = colourHex(surface.walls?.paint || pal.walls);
  const base = colourHex(surface.trim?.paint || pal.trim || pal.walls);
  const walls = { all: wallSpec({ ...(surface.walls || {}), paint: surface.walls?.paint || pal.walls }, paint, base) };
  const accent = surface.accentWall === false ? null : (surface.accentWall && typeof surface.accentWall === 'object' ? surface.accentWall : card.accentWall);
  if (accent && accentEdge) walls[accentEdge] = wallSpec(accent, paint, base);
  for (const e of ['N', 'E', 'S', 'W']) if (surface[e] && typeof surface[e] === 'object') walls[e] = wallSpec(surface[e], paint, base);
  // the floor: a pattern in its colours (finishes/patterns.js), else the house's plank or stone in a tint
  const f = surface.floor && typeof surface.floor === 'object' ? surface.floor : card.floor;
  let floor;
  if (f.pattern && FLOOR_PATTERNS[f.pattern]) {
    const colours = hexAll(f.colours);
    floor = { pattern: f.pattern, colours: colours.length >= 2 ? colours : ['#b08a5e', '#8a6a48'] };
  } else floor = { style: f.style || 'floorboards', texture: f.texture ?? null, ...(f.tint ? { tint: colourHex(f.tint) || f.tint } : {}) };
  return { walls, floor, ...(accent && accentEdge ? { accentEdge } : {}) };
}

export { FABRIC_PRESETS };
