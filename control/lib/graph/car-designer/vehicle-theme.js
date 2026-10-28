/**
 * A VEHICLE'S THEME — the styling a machine wears, as a card: the family layer's decoration (meta-fabricator.js) brought
 * to the race machines. The shape is the grammar's (the racer's parts solver, the supercar's surface compiler); a theme
 * says what it is painted, finished and dressed in, and leans the shape only through words the grammar already reads.
 *
 *   {
 *     reads?:    one line: what the theme is
 *     palette?:  { body, skin, trim, accent, frame, glass, seat, tyre, suit, helmet }   '#rrggbb' or a paint name
 *                (vehicle-livery.js PAINTS); body the primary, skin the secondary (a two-tone's lower half, a stripe),
 *                trim the bright metal, accent the hero piece, suit and helmet the driver's
 *     finish?:   { paint: gloss | satin | matte | metallic | pearl | candy,
 *                  trim:  alloy | chrome | brass | gold | copper | gunmetal | black,
 *                  glow:  [accent | skin, …] }              the form render's material rows (seventh generation): the
 *                paint's clear coat and flake, the trim's metal (its colour where the palette names none), and the
 *                colours that glow, each in its own colour (the accent's hero piece, the skin's stripe or lower half)
 *     livery?:   mono | two-tone | striped | numbered       (the vehicle sheet's; a supercar's pattern mono | split | stripes)
 *     shape?:    { silhouette, stance, cockpit, engine, era, motif }   the vehicle sheet's facets the racer is read with
 *     prefer?:   { family: id | [id, …] | null }           parts the racer's solver reaches for first (over the fits,
 *                never over a pin); null leaves an optional family off
 *     supercar?: { preset?, cabinStyle?, headlightStyle?, ventStyle?, spoilerStyle? }   the supercar's own words
 *     vary?:     { hue?: degrees, livery?: [livery, …] }   how a series varies it: each car's hues turned within ±hue
 *                (the trim's metal never), its livery in turn
 *   }
 *
 *   readTheme(theme)          a starter's name, a card, or { from?, variant?, …a card's keys over the starter's } →
 *                             the card resolved and checked (throws naming the known words)
 *   themeVariant(card, k)     the k-th car of a series in the theme: k 0 the card itself
 *   seriesTheme(series, k)    what the k-th entry of a field in a series is written with
 *   themeMaterials(base, card)    the material rows (VEHICLE_MATERIALS, KART_MATERIALS) in the theme's finish
 *   glowRow(word)             the material a glowing colour is drawn with: `glow:accent`, `glow:skin`
 *   trimTint(card)            the trim's colour: the palette's, else its metal's, else null
 *
 * THEMES are the starters: cards to be worn as they are, varied, or written over ({ from: 'steampunk', palette: … }).
 * A theme the user writes is the same card: nothing here is closed to a new one. Pure and deterministic: no dice.
 */
import { VEHICLE_MATERIALS } from './vehicle-surface-finish.js';
import { PAINTS } from './vehicle-livery.js';
import { SILHOUETTES, STANCES, COCKPITS, ENGINES, ERAS, MOTIF_READS, LIVERIES } from './facets.js';
import { hexLch, lchHex } from '../polygonizer/station-loft-shade.js';
import { BODIES, PARTS } from './parts.js';

const fail = (m) => new Error(`vehicle-theme: ${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/;
const f = Object.freeze;

export const THEME_KEYS = f(['reads', 'palette', 'finish', 'livery', 'shape', 'prefer', 'supercar', 'vary']);
/** A palette's words → the racer's paint slots (racer.js paintOf). */
export const PALETTE_SLOTS = f({ body: 'tech:body', skin: 'tech:skin', trim: 'tech:trim', accent: 'str:paint', frame: 'tech:frame', glass: 'tech:glass', seat: 'seat', tyre: 'tech:cable', suit: 'driver:suit', helmet: 'driver:helmet' });
/** The facets a theme's shape may name, with their tables. */
const SHAPE = f({ silhouette: SILHOUETTES, stance: STANCES, cockpit: COCKPITS, engine: ENGINES, era: ERAS, motif: MOTIF_READS });
/** The racer's part families (parts.js), and those a theme may leave off. */
export const PART_FAMILIES = f(['body', 'wheel', 'engine', 'exhaust', 'aero', 'nose', 'lamps', 'tail', 'seat', 'steering', 'cockpit', 'fender', 'booster', 'hero']);
const OPTIONAL = f(['exhaust', 'aero', 'nose', 'fender', 'booster', 'hero']);
const SUPERCAR_KEYS = f(['preset', 'cabinStyle', 'headlightStyle', 'ventStyle', 'spoilerStyle']);

/** The finishes: each a material row the form render draws its slot with. */
export const FINISHES = f({
  paint: f({
    gloss: VEHICLE_MATERIALS.paint,
    satin: f({ metalness: 0.1, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    matte: f({ metalness: 0, roughness: 0.82 }),
    metallic: f({ metalness: 0.62, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }),
    // (a pearl's colour shifts with the angle it is seen at: three's thin-film iridescence over the clear coat)
    pearl: f({ metalness: 0.3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.55, iridescenceIOR: 1.4 }),
    candy: f({ metalness: 0.35, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.02 }),
  }),
  // a trim's metal: its row and its colour (the trim's where the palette names none, a gloss wheel's lip and boss)
  trim: f({
    alloy: f({ row: VEHICLE_MATERIALS.alloy, tint: '#c9ced6' }),
    chrome: f({ row: f({ metalness: 1, roughness: 0.08 }), tint: '#dfe4ea' }),
    brass: f({ row: f({ metalness: 1, roughness: 0.3 }), tint: '#c39a4b' }),
    gold: f({ row: f({ metalness: 1, roughness: 0.18 }), tint: '#d9b45a' }),
    copper: f({ row: f({ metalness: 1, roughness: 0.28 }), tint: '#b8734a' }),
    gunmetal: f({ row: f({ metalness: 0.85, roughness: 0.42 }), tint: '#4a4f57' }),
    black: f({ row: f({ metalness: 0.3, roughness: 0.55 }), tint: '#1e1f23' }),
  }),
});
/** The colours a finish may make glow, and the row each glows with (its emissive the palette's colour). */
export const GLOWS = f(['accent', 'skin']);
const GLOW_ROW = f({ metalness: 0, roughness: 0.3, emissiveIntensity: 1.1 });
export const glowRow = (word) => `glow:${word}`;

const card = (c) => f(c);
/** The starters. Each a distinct look: a new one is a card (here, or the user's own, worn the same way). */
export const THEMES = f({
  candy: card({ reads: 'a sweet shop: pastel enamel under a deep clear coat, chrome like a sugar spoon',
    palette: { body: '#f2a7c3', skin: '#a9e5cf', accent: '#fff1a8', frame: '#efe7dc', seat: '#fbf6ee' },
    finish: { paint: 'candy', trim: 'chrome' }, livery: 'two-tone', shape: { motif: 'smooth' },
    prefer: { nose: 'pillow', lamps: 'eyes', wheel: 'disc', hero: 'daisy' },
    supercar: { cabinStyle: 'teardrop', headlightStyle: 'round', spoilerStyle: 'ducktail' }, vary: { hue: 180 } }),
  steampunk: card({ reads: 'brass and oxblood: a boiler on wheels, riveted plates, spoked wheels, stacks',
    palette: { body: '#6b2a26', skin: '#2f4a3a', accent: '#c39a4b', frame: '#2a2420', seat: '#5a3a22' },
    finish: { paint: 'satin', trim: 'brass' }, livery: 'two-tone', shape: { motif: 'riveted', era: 'vintage', engine: 'exposed' },
    prefer: { wheel: 'wire', lamps: 'stalks', exhaust: 'stacks', engine: ['bigblock', 'twin'], fender: 'wings' },
    supercar: { cabinStyle: 'fastback', headlightStyle: 'round', ventStyle: 'hoodLouvers', spoilerStyle: 'none' }, vary: { hue: 30, livery: ['two-tone', 'mono'] } }),
  neon: card({ reads: 'a synthwave night: black gloss, the accents glowing magenta and cyan',
    palette: { body: '#15141c', skin: '#20d9e8', accent: '#ff2bd6', frame: '#0c0c10', glass: '#2a1f4a' },
    finish: { paint: 'gloss', trim: 'chrome', glow: ['accent', 'skin'] }, livery: 'striped', shape: { era: 'future', motif: 'faceted' },
    prefer: { lamps: 'lightbar', wheel: 'disc', booster: 'rocket', aero: 'wing' },
    supercar: { cabinStyle: 'wedge', headlightStyle: 'slim', ventStyle: 'sideBlades', spoilerStyle: 'swanNeck' }, vary: { hue: 160 } }),
  military: card({ reads: 'olive drab: flat paint, gunmetal, big tyres and a ram',
    palette: { body: '#4b5320', skin: '#3a3f2a', accent: '#c2b280', frame: '#23251d', seat: '#3d3a2c' },
    finish: { paint: 'matte', trim: 'gunmetal' }, livery: 'mono', shape: { motif: 'faceted', stance: 'raised' },
    prefer: { wheel: 'chunky', nose: 'bumper', exhaust: 'stacks', aero: null },
    supercar: { cabinStyle: 'fastback', headlightStyle: 'round', ventStyle: 'hoodLouvers', spoilerStyle: 'pedestal' }, vary: { hue: 25, livery: ['mono', 'two-tone'] } }),
  royal: card({ reads: 'a coronation coach: deep purple pearl, gold leaf, a throne behind a grille',
    palette: { body: '#3b1f5c', skin: '#efe4cb', accent: '#d9b45a', seat: '#8b1e3f' },
    finish: { paint: 'pearl', trim: 'gold' }, livery: 'two-tone', shape: { motif: 'ornate', era: 'classic' },
    prefer: { seat: 'throne', hero: 'crest', nose: 'grille', wheel: 'star' },
    supercar: { cabinStyle: 'teardrop', headlightStyle: 'slim', ventStyle: 'none', spoilerStyle: 'none' }, vary: { hue: 70 } }),
  heritage: card({ reads: 'a works team of the fifties: its nation\'s colour in metallic, a cream stripe, chrome and wire',
    palette: { body: '#1f4d3a', skin: '#efe6cf', accent: '#efe6cf' },
    finish: { paint: 'metallic', trim: 'chrome' }, livery: 'striped', shape: { era: 'classic', motif: 'smooth' },
    prefer: { wheel: 'wire', nose: 'bumper', aero: 'ducktail' },
    supercar: { cabinStyle: 'fastback', headlightStyle: 'round', ventStyle: 'hoodLouvers', spoilerStyle: 'ducktail' }, vary: { hue: 180 } }),
});
export const THEME_IDS = f(Object.keys(THEMES));

const colour = (v, at) => {
  if (typeof v === 'string' && Object.hasOwn(PAINTS, v)) return PAINTS[v];
  if (typeof v === 'string' && HEX.test(v.toLowerCase())) return v.toLowerCase();
  throw fail(`${at} is '#rrggbb' or a paint (${Object.keys(PAINTS).join(', ')})`);
};
const word = (v, table, at) => { if (!Object.hasOwn(table, v)) throw fail(`${at} is one of ${Object.keys(table).join(', ')}`); return v; };
const keysOf = (o, known, at) => { if (!isObj(o)) throw fail(`${at} is { ${known.join(', ')} }`); for (const k of Object.keys(o)) if (!known.includes(k)) throw fail(`${at} has no '${k}' (${known.join(', ')})`); return o; };

/** A card checked, its words normalised (a palette's paint names as their hex). */
function checkCard(c) {
  const out = {};
  if (c.reads !== undefined) { if (typeof c.reads !== 'string') throw fail('reads is a line of words'); out.reads = c.reads; }
  if (c.palette !== undefined) out.palette = Object.fromEntries(Object.entries(keysOf(c.palette, Object.keys(PALETTE_SLOTS), 'a palette')).map(([k, v]) => [k, colour(v, `palette.${k}`)]));
  if (c.finish !== undefined) {
    keysOf(c.finish, [...Object.keys(FINISHES), 'glow'], 'a finish');
    out.finish = Object.fromEntries(Object.entries(c.finish).map(([k, v]) => {
      if (k !== 'glow') return [k, word(v, FINISHES[k], `finish.${k}`)];
      if (!Array.isArray(v) || !v.every((g) => GLOWS.includes(g))) throw fail(`finish.glow is a list of ${GLOWS.join(', ')}`);
      return [k, [...new Set(v)]];
    }));
  }
  if (c.livery !== undefined) out.livery = word(c.livery, LIVERIES, 'livery');
  if (c.shape !== undefined) out.shape = Object.fromEntries(Object.entries(keysOf(c.shape, Object.keys(SHAPE), 'a shape')).map(([k, v]) => [k, word(v, SHAPE[k], `shape.${k}`)]));
  if (c.prefer !== undefined) {
    keysOf(c.prefer, PART_FAMILIES, 'prefer');
    out.prefer = Object.fromEntries(Object.entries(c.prefer).map(([fam, v]) => {
      if (v === null) { if (!OPTIONAL.includes(fam)) throw fail(`prefer.${fam} cannot be left off (only ${OPTIONAL.join(', ')})`); return [fam, null]; }
      const ids = Array.isArray(v) ? v : [v];
      if (!ids.length || !ids.every((id) => typeof id === 'string' && id)) throw fail(`prefer.${fam} is a part's id, a list of them, or null`);
      const known = fam === 'body' ? Object.keys(BODIES) : Object.keys(PARTS).filter((id) => PARTS[id].family === fam);
      for (const id of ids) if (!known.includes(id)) throw fail(`prefer.${fam}: no ${fam} '${id}' (${known.join(', ')})`);
      return [fam, ids.length === 1 ? ids[0] : [...ids]];
    }));
  }
  if (c.supercar !== undefined) out.supercar = { ...keysOf(c.supercar, SUPERCAR_KEYS, 'a theme\'s supercar') };
  if (c.vary !== undefined) {
    keysOf(c.vary, ['hue', 'livery'], 'vary');
    if (c.vary.hue !== undefined && !(typeof c.vary.hue === 'number' && c.vary.hue >= 0 && c.vary.hue <= 180)) throw fail('vary.hue is degrees, 0 to 180');
    if (c.vary.livery !== undefined && !(Array.isArray(c.vary.livery) && c.vary.livery.length)) throw fail('vary.livery is a list of liveries');
    out.vary = { ...c.vary, ...(c.vary.livery ? { livery: c.vary.livery.map((l, i) => word(l, LIVERIES, `vary.livery[${i}]`)) } : {}) };
  }
  return out;
}

/** A theme as written → its card, resolved and checked. */
export function readTheme(theme) {
  if (typeof theme === 'string') {
    if (!Object.hasOwn(THEMES, theme)) throw fail(`no theme '${theme}' (${THEME_IDS.join(', ')}; or a card of your own)`);
    return { name: theme, ...checkCard(THEMES[theme]) };
  }
  if (!isObj(theme)) throw fail(`a theme is a name (${THEME_IDS.join(', ')}), a card, or { from, variant?, … }`);
  const { from, variant, ...own } = theme;
  for (const k of Object.keys(own)) if (!THEME_KEYS.includes(k)) throw fail(`a theme has no '${k}' (${['from', 'variant', ...THEME_KEYS].join(', ')})`);
  if (from !== undefined && !Object.hasOwn(THEMES, from)) throw fail(`no theme '${from}' to start from (${THEME_IDS.join(', ')})`);
  if (variant !== undefined && !(Number.isInteger(variant) && variant >= 0)) throw fail('a variant is a whole number, 0 the theme itself');
  const base = from ? checkCard(THEMES[from]) : {}, mine = checkCard(own);
  // (a card over its starter: each table merged key by key, a line or a livery replaced)
  const merged = { ...base, ...mine };
  for (const k of ['palette', 'finish', 'shape', 'prefer', 'supercar', 'vary']) if (base[k] || mine[k]) merged[k] = { ...(base[k] ?? {}), ...(mine[k] ?? {}) };
  const out = { ...(from ? { name: from } : {}), ...merged };
  return variant ? themeVariant(out, variant) : out;
}

const turn = (hex, deg) => { const [L, C, H] = hexLch(hex); return lchHex(L, C, (((H + deg) % 360) + 360) % 360); };
const PHI = 0.6180339887498949;
/** The k-th car of a series: its hues turned within ±vary.hue (the same turn for every colour, so the theme's harmony
 *  holds; the trim's metal never turns), its livery the next of vary.livery. k 0: the card. */
export function themeVariant(c, k) {
  if (!k) return c;
  const spread = c.vary?.hue ?? 180, deg = Math.round((((k * PHI) % 1) - 0.5) * 2 * spread * 10) / 10;
  const palette = c.palette ? Object.fromEntries(Object.entries(c.palette).map(([s, hex]) => [s, s === 'trim' ? hex : turn(hex, deg)])) : c.palette;
  const liv = c.vary?.livery;
  return { ...c, ...(palette ? { palette } : {}), ...(liv ? { livery: liv[k % liv.length] } : {}), variant: k };
}

/** The k-th entry of a field in a series: its theme as the recipe writes it (the name alone for the first). */
export function seriesTheme(series, k) {
  readTheme(series);
  if (typeof series === 'string') return k ? { from: series, variant: k } : series;
  return k ? { ...series, variant: k } : series;
}

/** The trim's colour: the palette's, else the trim metal's tint, else none. */
export const trimTint = (c) => c?.palette?.trim ?? (c?.finish?.trim ? FINISHES.trim[c.finish.trim].tint : null);

/** The material rows in a theme's finish: the paint's, the trim's metal on the alloy and chrome rows, and a row for
 *  each colour that glows (`glow:accent`, `glow:skin`), its emissive that colour. */
export function themeMaterials(base, c) {
  const F = c?.finish;
  if (!F) return base;
  const out = { ...base };
  if (F.paint) out.paint = FINISHES.paint[F.paint];
  if (F.trim) { const row = FINISHES.trim[F.trim].row; out.alloy = row; if (base.chrome) out.chrome = row; }
  for (const g of F.glow ?? []) out[glowRow(g)] = f({ ...GLOW_ROW, emissive: c.palette?.[g] ?? '#ffffff' });
  return out;
}
