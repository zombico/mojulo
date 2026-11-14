/**
 * ICONS — mana-ui's pictograms: the small pictures a game's UI says things with in place of words (a coin, a heart, a
 * clock, a lock, a gesture). ONE outline an icon, on a 24 grid, drawn in the theme's ink; a theme's `icons` word says
 * the STYLE they are all drawn in, so a look changes its pictograms as it changes its frames:
 *
 *   solid    filled silhouettes (the plainest: reads smallest)
 *   line     the outline alone, round-jointed (clean, technical)
 *   chunky   filled and fattened by a round stroke (a toy's, a mascot game's)
 *   badge    the silhouette on a round plate in the accent (a sticker, a button's face)
 *   duo      the outline over a pale fill of itself (two tones of one ink)
 *   none     no pictograms: an icon is its name's initials, as it was (the greybox's, and any theme that says none)
 *
 * Nothing is loaded and no picture is embedded: an icon is a MASK in the theme's sheet (an SVG in a data URL, cut
 * out of a square of the current ink), so it takes the colour of the words beside it and scales with them. The
 * runtime only names it: an `icon`, a counter's `icon` and a prompt's glyph carry `data-icon` (the name, in lower
 * case, its words joined by a dash); a name with no icon keeps its initials.
 *
 *   ICONS            { <id>: '<path data>' }       every outline (fill-rule evenodd: a ring is a ring)
 *   ICON_IDS · ICON_STYLES · ICON_ALIASES ({ <word>: <id> }: the other words a game says for one: coins, time, hp)
 *   iconOf(name)     the icon a name draws (its id, an alias's), or null
 *   iconSvg(id, style?)  the icon as a whole <svg> (a board's, a doc's)
 *   iconCss(style, scope)  the sheet's rules for a style, under a scope ('' for none)
 *
 * Pure data and strings: imports nothing.
 */
export const ICONS = Object.freeze({
  // what is counted and kept
  coin: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 6.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
  gem: 'M7 4h10l4 5-9 11L3 9z',
  heart: 'M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15 12 20 12 20z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  key: 'M7.5 7.5a4.5 4.5 0 1 0 4.2 6H14v2.5h2.5v-2.5H19v2h2.5v-5H11.7a4.5 4.5 0 0 0-4.2-3zM7.5 10.4a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2z',
  lock: 'M7 10V8a5 5 0 0 1 10 0v2h1.5v10h-13V10zM9.5 10h5V8a2.5 2.5 0 0 0-5 0z',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM11 7h2v4.6l3.2 1.9-1 1.7L11 12.7z',
  flag: 'M5 3h2v18H5zM8 4h11l-3 4 3 4H8z',
  trophy: 'M7 3h10v2h3v3a4 4 0 0 1-3.6 4A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.6 12 4 4 0 0 1 4 8V5h3zM6 7v1a2 2 0 0 0 1 1.7V7zM17 7v2.7A2 2 0 0 0 18 8V7z',
  crown: 'M3 7l4.5 4L12 5l4.5 6L21 7l-2 11H5z',
  ticket: 'M3 7h18v3.5a1.5 1.5 0 0 0 0 3V17H3v-3.5a1.5 1.5 0 0 0 0-3zM14 8.5h1.5v7H14z',
  bag: 'M9 8V7a3 3 0 0 1 6 0v1h3l1 12H5L6 8zM10.5 8h3V7a1.5 1.5 0 0 0-3 0z',
  potion: 'M10 3h4v5l4.5 7.5A3 3 0 0 1 16 20H8a3 3 0 0 1-2.5-4.5L10 8z',
  // what a body has and meets
  shield: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z',
  sword: 'M19 3h2v2l-9.5 9.5 1.5 1.5-1.5 1.5-1.8-1.8L6 19.4 4.6 18l3.7-3.7-1.8-1.8L8 11l1.5 1.5z',
  skull: 'M12 3a7.5 7.5 0 0 0-4.5 13.5V20h9v-3.5A7.5 7.5 0 0 0 12 3zM9 9.4a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6zM15 9.4a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6z',
  bolt: 'M13 2L5 13h5l-1 9 8-12h-5z',
  flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2.5-7 1.5 1 2 2 2 3.5C11.5 8 12 5 12 2z',
  drop: 'M12 3c4 5 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11 8 8 12 3z',
  leaf: 'M5 19C5 9 11 4 20 4c0 9-5 15-13 15l-2 2-1-1z',
  person: 'M12 3a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM4 21c0-4.5 3.5-7.5 8-7.5s8 3 8 7.5z',
  speed: 'M4 6l7 6-7 6zM13 6l7 6-7 6z',
  // where things are
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 6v12l6 2V8z',
  compass: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zM12 6.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z',
  target: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 6.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11zM12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z',
  home: 'M12 3l9 8h-2.5v9h-5v-6h-3v6h-5v-9H3z',
  train: 'M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3l2 3h-2.5l-1.5-2h-6l-1.5 2H5l2-3a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM7 6v5h10V6zM8.5 13a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3zM15.5 13a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  // what a menu does
  gear: 'M10 2h4l.6 2.6 2.3 1.3 2.5-.8 2 3.4-1.9 1.8v2.6l1.9 1.8-2 3.4-2.5-.8-2.3 1.3L14 22h-4l-.6-2.6-2.3-1.3-2.5.8-2-3.4 1.9-1.8v-2.6L2.6 9.3l2-3.4 2.5.8 2.3-1.3zM12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
  sound: 'M4 9h4l5-4v14l-5-4H4zM15.5 8.5a5 5 0 0 1 0 7l-1.2-1.3a3.2 3.2 0 0 0 0-4.4zM18 6a8.5 8.5 0 0 1 0 12l-1.2-1.3a6.7 6.7 0 0 0 0-9.4z',
  mute: 'M4 9h4l5-4v14l-5-4H4zM15.2 9.2l1.3-1.3 2 2 2-2 1.3 1.3-2 2 2 2-1.3 1.3-2-2-2 2-1.3-1.3 2-2z',
  music: 'M9 4l11-2v13a3 3 0 1 1-2-2.8V6.4L11 7.7V18a3 3 0 1 1-2-2.8z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  play: 'M7 4l13 8-13 8z',
  restart: 'M12 4a8 8 0 1 1-7.4 5h2.2A6 6 0 1 0 12 6v3L7 5.5 12 2z',
  menu: 'M4 5h16v3H4zM4 10.5h16v3H4zM4 16h16v3H4z',
  back: 'M10 5l-7 7 7 7v-4.5h11v-5H10z',
  close: 'M6.3 4.9L12 10.6l5.7-5.7 1.4 1.4L13.4 12l5.7 5.7-1.4 1.4L12 13.4l-5.7 5.7-1.4-1.4L10.6 12 4.9 6.3z',
  check: 'M9.5 16.2L5 11.7l-1.9 1.9 6.4 6.4L21 8.5l-1.9-1.9z',
  plus: 'M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5z',
  minus: 'M4 10.5h16v3H4z',
  up: 'M12 3l8 9h-5v9H9v-9H4z',
  down: 'M12 21l-8-9h5V3h6v9h5z',
  left: 'M3 12l9-8v5h9v6h-9v5z',
  right: 'M21 12l-9 8v-5H3V9h9V4z',
  // what a hand does
  tap: 'M12 11a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM5.5 9a8 8 0 0 1 13 0l-1.6 1.2a6 6 0 0 0-9.8 0zM8.3 6.2a11 11 0 0 1 7.4 0l-.7 1.9a9 9 0 0 0-6 0z',
  swipe: 'M2 12l6-5.5V10h8V6.5l6 5.5-6 5.5V14H8v3.5z',
  'swipe-up': 'M12 2l5.5 6H14v7h-4V8H6.5zM9 17h6v2H9zM10 20.5h4V22h-4z',
  hold: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 5.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13zM12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
  jump: 'M12 3l6 6.5h-4V15h-4V9.5H6zM4 18h16v3H4z',
});
export const ICON_IDS = Object.freeze(Object.keys(ICONS));
export const ICON_STYLES = Object.freeze(['solid', 'line', 'chunky', 'badge', 'duo']);
/** The other words a game says for an icon (a HUD's label, an action's name): each draws the icon it names. */
export const ICON_ALIASES = Object.freeze({
  coins: 'coin', gold: 'coin', money: 'coin', gems: 'gem', hp: 'heart', health: 'heart', lives: 'heart', life: 'heart', stars: 'star', keys: 'key', locked: 'lock',
  time: 'clock', timer: 'clock', goal: 'flag', finish: 'flag', exit: 'flag', rank: 'trophy', best: 'trophy', score: 'star', armor: 'shield', armour: 'shield', guard: 'shield',
  attack: 'sword', defeat: 'skull', deaths: 'skull', energy: 'bolt', stamina: 'bolt', power: 'bolt', fire: 'flame', water: 'drop', mana: 'drop', mp: 'drop', nature: 'leaf',
  player: 'person', hero: 'person', fast: 'speed', sprint: 'speed', waypoint: 'pin', objective: 'target', aim: 'target', look: 'eye', title: 'home',
  settings: 'gear', options: 'gear', volume: 'sound', resume: 'play', start: 'play', retry: 'restart', again: 'restart', quit: 'close', cancel: 'close', done: 'check', ok: 'check', accept: 'check',
  add: 'plus', remove: 'minus', items: 'bag', inventory: 'bag', 'swipe-left': 'swipe', 'swipe-right': 'swipe', steer: 'swipe', press: 'tap', touch: 'tap',
});
const slug = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function iconOf(name) { const k = slug(name); return ICONS[k] ? k : ICON_ALIASES[k] ?? null; }

// one outline, five ways: the SVG a style draws it as (a mask: only its alpha is read, so its ink is any ink)
const DRAW = {
  solid: (d) => `<path d='${d}' fill-rule='evenodd'/>`,
  line: (d) => `<path d='${d}' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linejoin='round' stroke-linecap='round'/>`,
  chunky: (d) => `<path d='${d}' fill-rule='evenodd' stroke='currentColor' stroke-width='1.4' stroke-linejoin='round' stroke-linecap='round'/>`,
  badge: (d) => `<path d='${d}' fill-rule='evenodd'/>`,
  duo: (d) => `<path d='${d}' fill-rule='evenodd' fill-opacity='.34' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round' stroke-linecap='round'/>`,
};
// (a fattened or outlined icon needs room round its grid for the stroke)
const BOX = { solid: '0 0 24 24', line: '-1 -1 26 26', chunky: '-1 -1 26 26', badge: '0 0 24 24', duo: '-1 -1 26 26' };
export function iconSvg(id, style = 'solid') {
  const k = iconOf(id);
  if (!k) throw new Error(`icon '${id}' is one of: ${ICON_IDS.join(', ')}`);
  if (!DRAW[style]) throw new Error(`an icon style is one of: ${ICON_STYLES.join(', ')}`);
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${BOX[style]}'>${DRAW[style](ICONS[k])}</svg>`;
}
const urlOf = (svg) => `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23').replace(/"/g, '%22')}")`;

/**
 * The sheet for a style. A named icon hides its initials and draws its mask in the ink (a ::before, so the part
 * keeps its box); a badge keeps a round plate of the accent under a smaller silhouette. `vars` are the sheet's own
 * names for the accent and the ink that reads on it.
 */
export function iconCss(style, scope = '.mana-root', vars = { accent: 'var(--mana-accent)', on: 'var(--mana-focus-ink)' }) {
  if (!style || style === 'none') return '';
  if (!DRAW[style]) throw new Error(`an icon style is one of: ${ICON_STYLES.join(', ')}`);
  const s = scope, names = (id) => [id, ...Object.keys(ICON_ALIASES).filter((a) => ICON_ALIASES[a] === id)], badge = style === 'badge';
  const out = [
    `${s} [data-icon]:is(${[...ICON_IDS, ...Object.keys(ICON_ALIASES)].map((n) => `[data-icon=${n}]`).join(',')}){font-size:0;position:relative;border-color:transparent;background:${badge ? vars.accent : 'transparent'};${badge ? `border-radius:50%;color:${vars.on}` : ''}}`,
    `${s} [data-icon]:is(${[...ICON_IDS, ...Object.keys(ICON_ALIASES)].map((n) => `[data-icon=${n}]`).join(',')})::before{content:"";position:absolute;inset:${badge ? '19%' : '0'};background:currentColor;-webkit-mask:var(--mana-icon) center/contain no-repeat;mask:var(--mana-icon) center/contain no-repeat}`,
  ];
  for (const id of ICON_IDS) out.push(`${s} :is(${names(id).map((n) => `[data-icon=${n}]`).join(',')}){--mana-icon:${urlOf(iconSvg(id, style))}}`);
  return out.join('\n');
}
