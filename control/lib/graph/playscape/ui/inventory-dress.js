/**
 * THE INVENTORY'S DRESS — how the guide dresses a view (shop, chest, inventory) drawn as a grid: the tiles' size and
 * shape, the worn slots, where the focused item's card sits, the count badge, how the kinds are coloured, how the focus
 * shows and what falls behind the menu. A menu still has no look of its own (menus.js): the dress is the world's UI
 * guide's (play.ui.inventory), as the register and the border are, and it is drawn from closed words only.
 *
 *   play.ui.inventory: '<look>' | 'flavor' | { look?, tile?, shape?, slots?, card?, badge?, kinds?, focus?, backdrop? }
 *
 *   DRESS_WORDS            word → { <value>: about } (each dial's closed set)
 *   INVENTORY_LOOKS        look → { about, …a word for every dial } (classic is the page's own defaults)
 *   FLAVOR_LOOK            border flavor → the look it dresses an inventory in (borders.js)
 *   readDress(v, flavor)   the operator's or the hints' value → { look, …every dial } (throws, teaching); 'flavor'
 *                          takes the border flavor's look, and a look's words yield to any word named beside it
 *   cleanDress(d)          a dress as received on the page (a hand-poked events.register.inventory): known words only
 *   inventoryCss(d, scope) THE DOM BACKEND: closed words in, CSS out, laid after the menu sheet (interact-channel.js
 *                          MENU_CSS) so it wins where they meet; classic adds nothing
 *
 * Colour stays the guide's: every rule reads the guide's tokens (--moj-accent, --moj-line, --moj-ink, --moj-panel, --moj-bg).
 */

export const DRESS_WORDS = Object.freeze({
  tile: { compact: 'small tiles, more to a row (38 px)', regular: 'the default tile (46 px)', large: 'big tiles, the icon reads first (58 px)' },
  shape: { square: 'hard corners', rounded: 'softly rounded corners (the default)', round: 'circles', hex: 'hexagons', diamond: 'diamonds' },
  slots: { dashed: 'worn slots as dashed outlines (the default)', socket: 'worn slots sunk into the plate', outline: 'worn slots as solid outlines' },
  card: { side: 'the focused item\'s card beside the grid (the default)', below: 'the card under the grid', none: 'no card: the tiles alone (a name on hover)' },
  badge: { corner: 'the count in the tile\'s corner (the default)', pill: 'the count on a pill over the tile\'s edge', none: 'no count drawn' },
  kinds: { tinted: 'each kind its own colour (the default)', accent: 'every icon in the accent', ink: 'every icon in the ink: a mono bag' },
  focus: { glow: 'the focused tile glows in the accent (the default)', ring: 'a hard ring, no glow', lift: 'the focused tile rises and grows', invert: 'the focused tile filled with the accent' },
  backdrop: { none: 'the play stays as it is behind the menu (the default)', dim: 'the play darkened behind it', blur: 'the play blurred and darkened behind it' },
});
export const DRESS_DIALS = Object.keys(DRESS_WORDS);

export const INVENTORY_LOOKS = Object.freeze({
  classic: { about: 'the page\'s own grid: rounded tiles, a dashed slot strip, the card beside', tile: 'regular', shape: 'rounded', slots: 'dashed', card: 'side', badge: 'corner', kinds: 'tinted', focus: 'glow', backdrop: 'none' },
  satchel: { about: 'a hearth-side bag: large round tiles sunk in, the card below, counts on pills', tile: 'large', shape: 'round', slots: 'socket', card: 'below', badge: 'pill', kinds: 'tinted', focus: 'lift', backdrop: 'dim' },
  loadout: { about: 'a field loadout: compact square tiles, solid slot outlines, mono icons, a hard ring', tile: 'compact', shape: 'square', slots: 'outline', card: 'side', badge: 'corner', kinds: 'ink', focus: 'ring', backdrop: 'dim' },
  armory: { about: 'a hangar rack: square tiles, sockets, accent icons, the focus filled', tile: 'regular', shape: 'square', slots: 'socket', card: 'side', badge: 'corner', kinds: 'accent', focus: 'invert', backdrop: 'blur' },
  tactical: { about: 'a net overlay: hexagons, outlined slots, a glow, the play blurred', tile: 'regular', shape: 'hex', slots: 'outline', card: 'side', badge: 'corner', kinds: 'tinted', focus: 'glow', backdrop: 'blur' },
});
export const LOOK_IDS = Object.keys(INVENTORY_LOOKS);
export const FLAVOR_LOOK = Object.freeze({ cozy: 'satchel', covert: 'loadout', 'mech-cockpit': 'armory', futurepunk: 'tactical', quest: 'classic' });

// readDress's flavor when only the shape is checked (authoring, before the guide knows its border): 'flavor' passes
export const ANY_FLAVOR = '*';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const words = (d) => Object.keys(DRESS_WORDS[d]);
const lookDials = (id) => Object.fromEntries(DRESS_DIALS.map((d) => [d, INVENTORY_LOOKS[id][d]]));

/** A dress as asked → { look, …every dial }. `flavor` is the guide's border flavor (for 'flavor'). */
export function readDress(v, flavor = null, where = 'play.ui.inventory') {
  const o = typeof v === 'string' ? { look: v } : v;
  const teach = `${where} is a look (${LOOK_IDS.join(', ')}), 'flavor' (the border flavor's look), or { look?, ${DRESS_DIALS.join('?, ')}? }`;
  if (!isObj(o)) throw new Error(teach);
  for (const k of Object.keys(o)) if (k !== 'look' && !DRESS_WORDS[k]) throw new Error(`${where}.${k}: no such word (${['look', ...DRESS_DIALS].join(', ')})`);
  let look = o.look ?? 'classic';
  if (look === 'flavor' && flavor === ANY_FLAVOR) look = 'classic';
  else if (look === 'flavor') {
    if (!flavor || !FLAVOR_LOOK[flavor]) throw new Error(`${where}: 'flavor' takes the border flavor's look, and the guide has no border flavor (play.ui.border: ${Object.keys(FLAVOR_LOOK).join(', ')})`);
    look = FLAVOR_LOOK[flavor];
  }
  if (!INVENTORY_LOOKS[look]) throw new Error(`${where}.look is one of: ${LOOK_IDS.join(', ')}, or 'flavor'`);
  const out = { look, ...lookDials(look) };
  for (const d of DRESS_DIALS) {
    if (o[d] === undefined) continue;
    if (!words(d).includes(o[d])) throw new Error(`${where}.${d} is one of: ${words(d).join(', ')}`);
    out[d] = o[d];
  }
  return out;
}

/** A dress as received on the page: only known dials with known words survive (missing ones read as classic). */
export function cleanDress(d) {
  const out = lookDials('classic');
  if (!isObj(d)) return out;
  for (const k of DRESS_DIALS) if (words(k).includes(d[k])) out[k] = d[k];
  return out;
}

const TILE = { compact: 38, regular: 46, large: 58 };
const CLIP = { hex: 'polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)', diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' };
const RADIUS = { square: '2px', rounded: '8px', round: '50%', hex: '0', diamond: '0' };
const mix = (v, pct) => `color-mix(in srgb,var(--moj-${v}) ${pct}%,transparent)`;

/** The dom backend: the dress's rules under `scope` (the page's .moj-hud, a board specimen's stage). Classic: ''. */
export function inventoryCss(dress, scope = '.moj-hud') {
  const d = cleanDress(dress), w = `${scope} .moj-w-inv`, rules = [], vars = [];
  if (d.tile !== 'regular') vars.push(`--moj-tile:${TILE[d.tile]}px`, `--moj-tile-gap:${d.tile === 'compact' ? 4 : 7}px`);
  if (d.shape !== 'rounded') vars.push(`--moj-tile-radius:${RADIUS[d.shape]}`);
  if (vars.length) rules.push(`${w}{${vars.join(';')}}`);
  // the card and the tabs keep a soft corner whatever the tiles' shape (a circle's 50% would make the card an ellipse)
  if (d.shape !== 'rounded' && d.shape !== 'square') rules.push(`${w} .pu-card{border-radius:${d.shape === 'round' ? 14 : 0}px}`);
  // a clipped shape loses its border and its shadows to the clip: the tile is filled with the line and a plate clipped
  // the same way sits 2 px inside it, so the edge reads as a stroke; the worn slots stay unclipped (their slot's name
  // hangs under them) and the badge moves to the bottom middle, inside the shape
  const C = CLIP[d.shape];
  if (C) {
    rules.push(`${w} .pu-tile{clip-path:${C};border:0;background:var(--moj-line)}${w} .pu-tile::before{content:'';position:absolute;inset:2px;clip-path:${C};background:var(--moj-panel)}`);
    rules.push(`${w} .pu-tile>svg{position:relative;z-index:1}${w} .pu-qty,${w} .pu-price{z-index:1;right:50%;bottom:${d.shape === 'diamond' ? 8 : 3}px;transform:translateX(50%)}`);
    rules.push(`${w} .pu-tile.empty{background:${mix('line', 55)}}`);
  }
  if (d.slots === 'socket') rules.push(`${w} .pu-slot{border:0;background:${mix('bg', 70)};box-shadow:inset 0 2px 5px ${mix('bg', 90)},inset 0 -1px 0 ${mix('line', 70)}}`);
  else if (d.slots === 'outline') rules.push(`${w} .pu-slot{border-style:solid}`);
  if (d.card === 'below') rules.push(`${w} .pu-body{flex-direction:column;align-items:stretch}${w} .pu-card{width:auto;min-height:0;flex-direction:row;flex-wrap:wrap;align-items:center;column-gap:10px}${w} .pu-card .pu-big{width:40px;height:40px}${w} .pu-card .pu-about{flex-basis:100%}`);
  else if (d.card === 'none') rules.push(`${w} .pu-card{display:none}`);
  // a pill hangs over the tile's corner, except on a clipped shape, where it stays inside
  if (d.badge === 'pill') rules.push(`${w} .pu-qty,${w} .pu-price{${C ? '' : 'right:-4px;bottom:-5px;'}padding:1px 6px;border-radius:999px;background:var(--moj-accent);color:var(--moj-panel);box-shadow:0 0 0 2px var(--moj-panel)}${w} .pu-tile{overflow:visible}`);
  else if (d.badge === 'none') rules.push(`${w} .pu-qty{display:none}`);
  if (d.kinds !== 'tinted') {
    const c = d.kinds === 'accent' ? 'var(--moj-accent)' : 'var(--moj-ink)';
    rules.push(`${w} .k-consumable,${w} .k-equipment,${w} .k-key,${w} .k-thing,${w} .k-currency{color:${c}}`);
  }
  const on = `${w} .pu-tile.on,${w} .pu-slot.on`;
  if (d.focus === 'ring') rules.push(`${on}{box-shadow:0 0 0 2px var(--moj-accent) inset;transform:none}`);
  else if (d.focus === 'lift') rules.push(`${on}{box-shadow:0 6px 14px ${mix('bg', 80)},0 0 0 2px var(--moj-accent) inset;transform:translateY(-3px) scale(1.1);z-index:1}`);
  else if (d.focus === 'invert') rules.push(`${on}{background:var(--moj-accent);color:var(--moj-panel);box-shadow:none;transform:none}${on} .pu-qty{background:var(--moj-panel);color:var(--moj-accent)}`);
  // on a clipped shape the focus is the edge itself: the accent, thicker (inverted, the plate too)
  if (C) rules.push(`${w} .pu-tile.on{background:var(--moj-accent)}${w} .pu-tile.on::before{inset:3px${d.focus === 'invert' ? ';background:var(--moj-accent)' : ''}}`);
  if (d.backdrop !== 'none') rules.push(`${scope}.moj-menu-hud:has(.moj-w-inv){background:${mix('bg', d.backdrop === 'blur' ? 45 : 62)}${d.backdrop === 'blur' ? ';backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)' : ''}}`);
  return rules.join('');
}
