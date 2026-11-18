/**
 * MANA-UI's SHEET — the structure every component is drawn in, its look read from `--mana-*` variables whose defaults
 * are the GREYBOX: values only (black, white and greys), boxes, rules and placeholders, so a screen's structure and
 * behaviour are approved apart from its look (the UI direction's greybox, playscape/ui/direction.js, is the precedent).
 * A theme (theme.js) is a separate layer: it sets the variables and adds a few rules of its own, from closed words; it
 * never reaches into the structure.
 *
 * Values first, so the black-and-white law holds by construction under any theme: focus is a shape (the classic ▶ at
 * its left; a theme may make it a ring, a lift, a fill, a glow, brackets or a highlight bar), the active row a bar at its edge,
 * disabled a dashed outline; bar variants differ by PATTERN (hp solid, mp
 * hatched, xp dotted, stamina striped, shield checked, boss solid with phase ticks), a low bar cross-hatched; a better
 * compare is ▲; an enemy's awareness is a glyph; placeholders (an image, a portrait, a minimap) are crossed boxes.
 *
 *   GREYBOX_VARS        the variables and their greybox values (what a theme sets)
 *   manaCss(scope?)     the sheet, every rule under `scope` (default `.mana-root`), the greybox's values as defaults
 *
 * THE FRAME, never a page: the root is the stage, a size container. Every length is in units of 1px at a 1080p
 * reference (`u`: the stage's height over 1080), times the distance the player sits at (`k`: a couch's type is the
 * desk's ×26/18, XAG 101's console and PC minimums), so a screen keeps its proportions at any resolution and does not
 * reflow like a document; a phone (`hand`) sizes in CSS px. A screen and the HUD's places sit in the title-safe frame
 * (5% a side), the centre left open. THE TYPE RAMP has few levels and big jumps (TYPE): the floor, the body a step over
 * it, a title twice the body, a display near four times; a heading is the ink, never a grey eyebrow; text never goes
 * under `min` and the player's text size multiplies it. Text with no window behind it (a ghost window, a screen's own
 * title, a banner) keeps a HALO in the panel's colour, so it reads over any scene. A screen's LEGEND is a bar pinned to
 * the foot of the safe frame (the kernel draws one from what the screen holds when it names none).
 *
 * THE INPUT IN USE (the root's data-input, the runtime's input()): with keys or a pad the focus is a cursor you move;
 * with a mouse or a finger there is none: what is tapped is selected (tinted), a press sinks, a hover (a mouse) lights.
 * A touch screen's targets grow to 48 px, a screen keeps out of the notch and the home bar (the safe areas), and a
 * narrow screen (a phone, measured on the root, not the window) stacks its splits and lets its grids reflow.
 *   FRAME_CSS           the board's frames: a 1280×720 stage scaled into a 16:9 box, so a frame keeps a screen's proportions
 *
 * MOTION THAT MEANS SOMETHING: a value that changed flashes and pops once (up the second accent, down the harm, its gain
 * floating off), a fresh row or the last move opens a ring once, the side whose turn it is is alight (a thick bar at
 * its edge, breathing), a screen fades in and its windows and rows rise staggered, a moment's banner slams and a toast
 * slides. Every distance, scale and delay is a variable the theme's `motion` sets (the greybox: fades only, nothing
 * travels); prefers-reduced-motion and the root's data-motion=reduced zero them (the fades stay), and data-clock=held
 * holds the HUD's (a hit-stop). A side's chip is keylined where its colour would sink into the panel (WCAG's 3:1 for
 * a part of the UI).
 */
import { contrast, DISTANCES, HALOS } from './theme.js';
import { gunCss } from './guns.js';
export const GREYBOX_VARS = Object.freeze({
  ink: '#111111', mid: '#6b6b6b', soft: '#bdbdbd', line: '#111111', panel: '#fafafa', paper: '#fafafa', wash: '#ececec',
  scrim: 'rgba(255,255,255,.72)', shade: '#000000',
  // light falling on a fight's bars (their gloss, a hit's slice): white whatever the theme, as the shade is black
  gleam: '#ffffff',
  // the sides' kits (a team, a seat, a lane): greys in the greybox, told apart by their names and by shade
  'side-0': '#111111', 'side-1': '#8a8a8a', 'side-2': '#4a4a4a', 'side-3': '#b5b5b5', 'side-4': '#2a2a2a', 'side-5': '#6b6b6b', 'side-6': '#9e9e9e', 'side-7': '#3c3c3c', accent: '#111111', accent2: '#111111', 'focus-ink': '#111111',
  hp: '#111111', mp: '#111111', xp: '#111111', stamina: '#111111', shield: '#111111', boss: '#111111', plain: '#111111', harm: '#111111',
  font: 'system-ui,-apple-system,"Segoe UI",sans-serif', display: 'system-ui,-apple-system,"Segoe UI",sans-serif', mono: 'ui-monospace,Menlo,Consolas,monospace',
  scale: '1', case: 'uppercase', radius: '0px', 'frame-w': '1px', 'frame-s': 'solid', plate: '#fafafa', motion: 'background-color 0s',
  // THE FRAME: a length is in units of 1px at a 1080p reference (u: the stage's height over 1080, or a phone's CSS px),
  // times the distance's factor (k) — du — so a screen keeps its proportions at any resolution and grows for a couch;
  // text never goes under `min` (CSS px), and the player's text size (`text`, rt.textScale) multiplies it; `safe` is the
  // title-safe inset a side (90% title-safe), the frame a screen and the HUD's places sit in
  ...DISTANCES.desk, du: 'calc(var(--mana-u) * var(--mana-k))', text: '1', safe: '.05',
  target: 'calc(54 * var(--mana-du))',
  // a shape behind everything a screen holds (a theme's stage: a band, a burst, shards): none in the greybox
  stage: 'none',
  // text that has no window behind it keeps a halo in the panel's colour; the subtitles' plate (rt.subtitlePlate)
  halo: HALOS.outline, 'sub-plate': '.82',
  // how near the end is (the peril layer's level, set on it by the runtime): nothing in the greybox's stand-in
  peril: '0',
  // a magazine's wireframe and its rounds (guns.js: masks the sheet sets on the names that draw them): none unset
  gun: 'none', round: 'none', 'round-spent': 'none',
  // the focus: the ▶ (a shape, never a colour alone) and the room it keeps at an item's left (mark 0: none)
  cursor: '"\\25B6"', mark: '1',
  // the lean of tabs, bars, banners, keys and buttons (theme.js SLANTS); the rule an inner part is drawn with
  slant: '0deg', 'slant-words': '0deg', 'rule-w': '1px',
  // a screen giving way to the next: the cover's animation (none: the screen fades) and its timing (theme.js TRANSITIONS)
  tx: 'none', 'tx-ease': 'ease-in-out',
  // what a pause does to what it covers (theme.js VEILS): nothing in the greybox
  veil: 'none',
  // layers: the filter over the stage (a theme's overlay), and a title's hollow echo behind it (a theme's breakout)
  overlay: 'none', 'echo-ink': 'var(--mana-accent)',
  // how things move (theme.js MOTIONS): the greybox fades and travels nowhere
  dur: '160ms', ease: 'ease-out', travel: '0px', pop: '1', stagger: '0ms', glide: '0ms', loop: 'paused', sheen: '0', snap: '0px', nudge: '0px', lead: '0ms', out: 'ease-in', i: '0',
  // the way a screen's parts arrive: from the side the screen sits on (its place sets it), else rising from below
  enter: '0 var(--mana-travel)',
  // the way the cursor last went (the root's data-nav sets it): the side the item it lands on snaps in from
  'snap-from': '0 0',
  // what a change flashes and whose turn is alight: the accent unless a rule says otherwise
  flash: 'var(--mana-accent)', turn: 'var(--mana-accent)',
  // a side's keyline: the ink round a chip that would sink into the panel
  ...keylines(['#111111', '#8a8a8a', '#4a4a4a', '#b5b5b5', '#2a2a2a', '#6b6b6b', '#9e9e9e', '#3c3c3c'], '#fafafa', '#111111'),
});
/** Each side's keyline: the ink where its kit would sink into the panel (under 3:1), else none. */
export function keylines(sides, panel, ink) { return Object.fromEntries(sides.map((c, k) => [`side-${k}-key`, contrast(c, panel) < 3 ? ink : 'transparent'])); }
const v = (k) => `var(--mana-${k})`;
// a length at the 1080p reference, scaled by the stage and the distance
const u = (n) => `calc(${n} * ${v('du')})`;
// THE TYPE RAMP, at the 1080p reference on a desk (the couch multiplies it): few levels, big jumps. The floor (caption,
// label) is XAG 101's PC minimum; body a step over it; a title twice the body; the display, a hero, near four times
export const TYPE = Object.freeze({ caption: 18, label: 18, body: 24, heading: 24, numeral: 24, title: 48, display: 92 });
const ts = (n) => `calc(max(${v('min')}, ${n} * ${v('du')}) * ${v('scale')} * ${v('text')})`;
const t = (role) => ts(TYPE[role]);
// the title-safe frame: a side's inset, the device's own (a notch, the home bar) when that is larger
const SX = `calc(${v('safe')} * 100cqw)`, SY = `calc(${v('safe')} * 100cqh)`;
const safe = (side, axis) => `max(env(safe-area-inset-${side},0px),${axis})`;
// an item's left padding: its own, and the ▶'s room
const pl = (n) => `calc(${u(n)} + ${v('mark')} * ${u(26)})`;
const X_BOX = `linear-gradient(to top right,transparent calc(50% - .5px),${v('soft')} calc(50% - .5px),${v('soft')} calc(50% + .5px),transparent calc(50% + .5px)),linear-gradient(to bottom right,transparent calc(50% - .5px),${v('soft')} calc(50% - .5px),${v('soft')} calc(50% + .5px),transparent calc(50% + .5px))`;
const FILL = {
  plain: v('plain'), hp: v('hp'), boss: v('boss'),
  mp: `repeating-linear-gradient(45deg,${v('mp')} 0 2px,transparent 2px 5px)`,
  xp: `radial-gradient(${v('xp')} 1.2px,transparent 1.4px) 0 0/5px 5px`,
  stamina: `repeating-linear-gradient(90deg,${v('stamina')} 0 3px,transparent 3px 5px)`,
  shield: `repeating-conic-gradient(${v('shield')} 0 25%,transparent 0 50%) 0 0/6px 6px`,
};
const FOCUSABLE = ['row', 'cell', 'node', 'button', 'toggle', 'cycler', 'slider', 'keybind', 'carousel', 'alloc'];
// what floats over the world with no window behind it: it keeps the halo
const BARE = (s) => [`.mana-screen>.mana-title`, `.mana-screen>.mana-stack`, `.mana-screen>.mana-legend`, `.mana-window[data-variant=ghost]`, `.mana-banner`, `.mana-moments`].map((x) => `${s} ${x}`).join(',');

/** The sheet, scoped; the greybox's values as the variables' defaults. */
export function manaCss(scope = '.mana-root') {
  const s = scope, all = (sel) => FOCUSABLE.map((c) => `${s} .mana-${c}${sel}`).join(',');
  return [
    `${s}{${Object.entries(GREYBOX_VARS).map(([k, x]) => `--mana-${k}:${x}`).join(';')}}`,
    // the root is the stage (a size container): its own size is the fallback, the screens and the HUD size by the stage
    `${s}{position:fixed;inset:0;pointer-events:none;font-family:${v('font')};font-size:14px;line-height:1.3;color:${v('ink')};z-index:40;container-type:size;-webkit-tap-highlight-color:transparent}`,
    `${s} :is(.mana-screen,.mana-hud){font-size:${t('body')}}`,
    `${s}[data-input=touch]{--mana-target:48px}`,
    `${s} *{box-sizing:border-box}`,
    // the stack: a screen dims what it covers (a modal), and sits where it says, inside the title-safe frame
    `${s} .mana-screen{position:absolute;inset:0;display:flex;flex-direction:column;gap:${u(18)};padding:${safe('top', SY)} ${safe('right', SX)} ${safe('bottom', SY)} ${safe('left', SX)};pointer-events:auto;overflow:hidden;isolation:isolate}`,
    `${s} .mana-screen[data-layer=modal]{background:${v('scrim')}}`,
    // a pause dims, blurs or frosts what it covers (the world and the HUD), under its scrim; it eases in with the screen
    `${s} .mana-screen[data-layer=modal]{backdrop-filter:${v('veil')};-webkit-backdrop-filter:${v('veil')}}`,
    // THE STAGE: another layer behind what a screen holds (over its scrim and its key art), sweeping in as it opens
    `${s} .mana-screen::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:${v('stage')};animation:mana-stage calc(${v('dur')} * 3) ${v('ease')} both}`,
    // a screen's own window takes the room a game gives it: a menu is read from a sofa, not squeezed into a card
    `${s} .mana-screen:is([data-place=center],[data-place=left],[data-place=right])>.mana-window{min-width:min(100%,${u(640)})}`,
    `${s} .mana-screen[data-place=center]{align-items:center;justify-content:center}`,
    `${s} .mana-screen[data-place=left]{align-items:flex-start;justify-content:center}`,
    `${s} .mana-screen[data-place=left]>.mana-stack{max-width:min(100%,46cqw)}`,
    `${s} .mana-screen[data-place=right]{align-items:flex-end;justify-content:center}`,
    `${s} .mana-screen[data-place=top]{align-items:center;justify-content:flex-start}`,
    `${s} .mana-screen[data-place=bottom]{align-items:stretch;justify-content:flex-end}`,
    `${s} .mana-screen[data-place=full]{align-items:stretch;justify-content:flex-start}`,
    // the bottom sheet: a phone's menu, risen from the foot of the screen, its grabber a shape
    `${s} .mana-screen[data-place=sheet]{align-items:center;justify-content:flex-end;padding-bottom:0}`,
    `${s} .mana-screen[data-place=sheet]>.mana-window{width:min(${u(840)},100%);border-bottom:0;border-radius:calc(${v('radius')} + 14px) calc(${v('radius')} + 14px) 0 0;padding-top:${u(36)};padding-bottom:max(16px,env(safe-area-inset-bottom))}`,
    `${s} .mana-screen[data-place=sheet]>.mana-window::before{content:"";position:absolute;top:9px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:2px;background:${v('soft')}}`,
    `${s} .mana-screen[data-place=full]>:is(.mana-split,.mana-window,.mana-tabs){flex:1;min-height:0}`,
    // the words come first: in a pane that fills the screen, a picture gives up its height before the words beside it
    // lose their room (it shrinks to what is left, never under a strip)
    `${s} .mana-screen[data-place=full] .mana-window>.mana-stack:has(>.mana-image){height:100%}`,
    `${s} .mana-screen[data-place=full] .mana-window>.mana-stack>.mana-image{flex:1 1 0;min-height:${u(90)};aspect-ratio:auto}`,
    // key art behind a screen (a title, an attract loop): the whole stage, under everything the screen holds
    `${s} .mana-screen>.mana-image[data-ratio=backdrop]{position:absolute;inset:0;z-index:-1;aspect-ratio:auto;border:0;border-radius:0;padding:${u(12)}}`,
    // the legend bar: what the buttons do here, pinned to the foot of the safe frame, right-aligned (a console's prompt bar)
    `${s} .mana-screen>.mana-legend{position:absolute;right:${safe('right', SX)};bottom:${safe('bottom', SY)};z-index:2;justify-content:flex-end;max-width:calc(100% - 2 * ${SX});padding:${u(8)} ${u(18)} ${u(8)} ${u(90)};margin-right:${u(-18)};background:linear-gradient(90deg,transparent,color-mix(in srgb,${v('panel')} 86%,transparent) ${u(90)})}`,
    `${s} .mana-screen:has(>.mana-legend):not([data-place=sheet]){padding-bottom:calc(${safe('bottom', SY)} + ${u(60)})}`,
    // the lean: tabs, bars, banners, keys and buttons skew (never a window: what a screen holds stays square); a shape
    // with words to read leans no further than an italic (slant-words), a bar and a banner's display take the whole lean
    `${s} :is(.mana-banner,.mana-track){transform:skewX(${v('slant')})}`,
    `${s} :is(.mana-tablabel,.mana-key,.mana-button,.mana-badge){transform:skewX(${v('slant-words')})}`,
    `${s} .mana-bar[data-dir=rtl] .mana-track{transform:scaleX(-1) skewX(${v('slant')})}`,
    // the cover drawn over the stage as one screen gives way to the next (a new key replays it; out mirrors it)
    `${s}>.mana-transition{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;background:${v('shade')};animation:${v('tx')} calc(${v('dur')} * 3.5) ${v('tx-ease')} both}`,
    `${s}>.mana-transition[data-way=out]{scale:-1 1}`,
    // type roles: few levels, big jumps; a heading is the ink, never a grey eyebrow
    `${s} .mana-title{margin:0;font-family:${v('display')};font-size:${t('title')};font-weight:800;letter-spacing:.04em;line-height:1.05;text-transform:${v('case')}}`,
    `${s} .mana-heading{margin:0 0 ${u(12)};font-size:${t('heading')};font-weight:800;letter-spacing:.08em;text-transform:${v('case')};color:${v('ink')}}`,
    `${s} .mana-text[data-role=display]{font-family:${v('display')};font-size:${t('display')};font-weight:900;letter-spacing:.02em;text-transform:${v('case')};line-height:1}`,
    `${s} .mana-text[data-role=title]{font-family:${v('display')};font-size:${t('title')};font-weight:800;line-height:1.05}`,
    `${s} .mana-text[data-role=heading]{font-size:${t('heading')};font-weight:800;letter-spacing:.08em;text-transform:${v('case')}}`,
    // a label is second-level text: the ink at a lower weight, never a grey step (grey is for what cannot be used)
    `${s} .mana-text[data-role=label],${s} .mana-label{font-size:${t('label')};font-weight:500;color:${v('ink')}}`,
    `${s} .mana-text[data-role=caption],${s} .mana-caption{font-size:${t('caption')};color:${v('mid')}}`,
    `${s} .mana-text[data-role=numeral],${s} .mana-num{font-variant-numeric:tabular-nums;font-family:${v('mono')};font-size:${t('numeral')}}`,
    // nothing over the world goes bare: text with no window behind it keeps the halo; inside a window it needs none
    `${BARE(s)}{text-shadow:${v('halo')}}`,
    `${s} .mana-window:not([data-variant=ghost]),${s} .mana-place>*,${s} .mana-screen>.mana-region>:not(.mana-window),${s} .mana-anchor>*{text-shadow:none}`,
    // A WINDOW IN LAYERS (a theme lays it so): under what it holds, the plate (::after), the thing the plate sits on
    // (::before) and a crest over its top edge (b); none drawn by the greybox. A sub-panel has no backing or crest
    `${s} .mana-layers{display:none;position:absolute;inset:0;z-index:-1;pointer-events:none}`,
    `${s} .mana-layers::before,${s} .mana-layers::after{content:"";position:absolute;inset:0}`,
    `${s} .mana-layers::after{inset:calc(-1 * ${v('frame-w')});background:${v('plate')};border:${v('frame-w')} ${v('frame-s')} ${v('line')};border-radius:${v('radius')}}`,
    `${s} .mana-layers>b{position:absolute;display:block}`,
    `${s} .mana-window .mana-window>.mana-layers::before,${s} .mana-window .mana-window>.mana-layers>b{display:none}`,
    // the overlay: a filter over the picture while the UI is up (scanlines, a grid, a vignette, grain), never over the
    // words: over the world under the HUD and the screens, and over a screen's scrim, key art and stage under what it holds
    `${s}:is([data-hud=yes],:not([data-open=none]))::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:${v('overlay')}}`,
    `${s} .mana-screen::before{content:"";position:absolute;inset:0;pointer-events:none;background:${v('overlay')}}`,
    `${s} .mana-screen>:where(*){position:relative}`,
    // the echo: a screen's title and a display's words drawn again behind them, huge and hollow, breaking past the box
    `${s} :is(.mana-screen>.mana-title,.mana-text[data-role=display]){position:relative}`,
    `${s} :is(.mana-screen>.mana-title,.mana-text[data-role=display])::before{content:none;position:absolute;left:-.3em;top:50%;translate:0 -52%;z-index:-1;font-size:2.6em;line-height:1;white-space:nowrap;color:transparent;-webkit-text-stroke:2px ${v('echo-ink')};opacity:.45;pointer-events:none;text-shadow:none}`,
    // panels and layout
    `${s} .mana-window{position:relative;background:${v('plate')};border:${v('frame-w')} ${v('frame-s')} ${v('line')};border-radius:${v('radius')};padding:${u(21)} ${u(27)};min-width:${u(300)};max-width:100%;min-height:0;overflow:hidden}`,
    // a window inside a window is a sub-panel: a lighter rule and a smaller corner than the panel it sits in
    `${s} .mana-window .mana-window:not([data-variant=ghost]){border-width:${v('rule-w')};border-radius:calc(${v('radius')} * .6);padding:${u(9)} ${u(12)}}`,
    `${s} .mana-window[data-variant=inset]{border-style:dashed}`,
    `${s} .mana-window[data-variant=ghost]{background:transparent;border-color:transparent;padding:0}`,
    `${s} .mana-stack{display:flex;flex-direction:column;gap:${u(12)};min-width:0}`,
    `${s} .mana-stack[data-dir=row]{flex-direction:row;align-items:center}`,
    `${s} .mana-stack[data-fit=wrap]{flex-wrap:wrap}`, `@container (max-width:640px){${s} .mana-stack[data-dir=row][data-fit=stack]{flex-direction:column;align-items:stretch}}`,
    `${s} .mana-stack[data-gap=tight]{gap:${u(4)}}`, `${s} .mana-stack[data-gap=loose]{gap:${u(28)}}`,
    `${s} .mana-stack[data-align=start]{align-items:flex-start}`, `${s} .mana-stack[data-align=center]{align-items:center}`,
    `${s} .mana-stack[data-align=end]{align-items:flex-end}`, `${s} .mana-stack[data-align=apart]{justify-content:space-between}`,
    // (a row set at its end runs from that end too: the second fighter's parts from the right edge, the first's mirror)
    `${s} .mana-stack[data-dir=row][data-align=end]{justify-content:flex-end}`,
    `${s} .mana-split{display:grid;grid-template-columns:minmax(${u(270)},1fr) 2fr;gap:${u(18)};width:100%;align-items:stretch;min-height:0}`,
    `${s} .mana-screen>.mana-bar,${s} .mana-screen>.mana-counter{max-width:${u(780)}}`,
    `${s} .mana-split[data-ratio=even]{grid-template-columns:1fr 1fr}`, `${s} .mana-split[data-ratio=wide]{grid-template-columns:2fr 1fr}`,
    `@container (max-width:640px){${s} :is(.mana-split,.mana-split[data-ratio]){grid-template-columns:1fr}${s} .mana-screen{gap:${u(12)}}${s} .mana-grid{grid-template-columns:repeat(auto-fill,minmax(${u(114)},1fr))}${s} .mana-window{min-width:0}${s} .mana-bar[data-variant=boss]{min-width:0}${s} .mana-tabstrip{overflow-x:auto}${s} .mana-tree{grid-template-columns:repeat(var(--cols,1),minmax(${u(144)},1fr));overflow-x:auto}}`,
    `${s} .mana-each{display:flex;flex-direction:column;gap:${u(4)};min-width:0}`, `${s} .mana-each[data-dir=row]{flex-direction:row;flex-wrap:wrap;gap:${u(18)}}`,
    `${s} .mana-each[data-dir=row]>.mana-window{flex:1;min-width:${u(270)}}`,
    `${s} .mana-stack[data-fill=yes]{width:${u(1650)};max-width:100%}`, `${s} .mana-stack[data-fill=yes]>.mana-stack{flex:1;min-width:0}`,
    // (a filling row whose children say which of them fill: only those share the width, the rest keep their own (a
    // fight's clock between its two bars); the row's region takes its place's width, and its bars give way to it)
    `${s} .mana-stack[data-fill=yes]:has(>.mana-stack[data-fill=yes])>.mana-stack:not([data-fill=yes]){flex:none}`,
    `${s} .mana-place>.mana-region:has(>.mana-stack[data-fill=yes]){align-self:stretch}`, `${s} .mana-stack[data-fill=yes]>.mana-stack[data-fill=yes]>.mana-bar{min-width:0}`,
    `${s} .mana-divider{display:flex;align-items:center;gap:${u(12)};border-top:1px solid ${v('soft')};padding-top:${u(6)};margin-top:${u(6)}}`,
    `${s} .mana-tabstrip{display:flex;gap:${u(3)};margin-bottom:${u(15)};border-bottom:1px solid ${v('line')}}`,
    `${s} .mana-tablabel{padding:${u(6)} ${u(18)};cursor:pointer;font-size:${t('heading')};font-weight:700;letter-spacing:.08em;text-transform:${v('case')};color:${v('mid')};border:1px solid transparent;border-bottom:0;margin-bottom:-1px;border-radius:${v('radius')} ${v('radius')} 0 0}`,
    `${s} .mana-tablabel[data-st=active]{color:${v('ink')};background:${v('panel')};border-color:${v('line')};font-weight:800}`,
    // what can be focused: ▶ is the focus; a bar at the edge the active row; a dashed line disabled
    `${all('')}{position:relative;min-height:${v('target')};padding:${u(12)} ${u(18)} ${u(12)} ${pl(18)};border:1px solid transparent;border-radius:calc(${v('radius')}*.6);cursor:pointer;transition:${v('motion')},translate ${v('glide')} ${v('ease')};touch-action:manipulation;user-select:none}`,
    // the focus stands out: nudged along the way the eye reads, gliding back as it leaves
    `${s}:not([data-input=touch]):not([data-input=mouse]) :is(${FOCUSABLE.map((c) => `.mana-${c}`).join(',')})[data-st=focus]{translate:${v('nudge')} 0}`,
    // the way the cursor went: the item it lands on snaps in from that side (an overshoot under snap)
    `${s}[data-nav=down]{--mana-snap-from:0 calc(-1 * ${v('snap')})}`, `${s}[data-nav=up]{--mana-snap-from:0 ${v('snap')}}`,
    `${s}[data-nav=right]{--mana-snap-from:calc(-1 * ${v('snap')}) 0}`, `${s}[data-nav=left]{--mana-snap-from:${v('snap')} 0}`,
    `${s} :is(.mana-row,.mana-cell):has(>.mana-chip){padding-left:${pl(30)}}`,
    // the focus, a cursor (keys, a pad): the ▶ at its left and a tint, never moving what it marks; a theme's focus word
    // may take the ▶ away (--mana-cursor: none) for a ring, a lift, a fill, a glow, brackets or a bar
    `${s} [data-st=focus]{background:${v('wash')};color:${v('focus-ink')}}`,
    `${s} [data-st=focus]::before{content:${v('cursor')};position:absolute;left:${u(12)};top:50%;transform:translateY(-50%);font-size:${u(15)};line-height:1;color:${v('accent')}}`,
    `${s} :is(.mana-carousel,.mana-textentry .mana-cell)[data-st=focus]::before{content:none}`,
    `${s} [data-st=active]{background:${v('wash')};box-shadow:inset 3px 0 0 ${v('accent2')}}`,
    // a finger or a mouse moves no cursor: what is tapped is selected (the tint stays), a press sinks, a mouse lights
    `${s}:is([data-input=touch],[data-input=mouse]) [data-st=focus]{outline:none}`,
    `${s}:is([data-input=touch],[data-input=mouse]) [data-st=focus]::before{content:none}`,
    `${s}:is([data-input=touch],[data-input=mouse]) [data-k]:active,${s} [data-tap]:active{scale:.97}`,
    `@media (hover:hover){${s}[data-input=mouse] [data-k]:hover:not([data-st=focus]):not([data-st=disabled]){background:${v('wash')}}}`,
    `${s} [data-tap]{cursor:pointer;pointer-events:auto;touch-action:manipulation}`,
    `${s} [data-st=disabled]{color:${v('mid')};border:1px dashed ${v('soft')};cursor:default}`,
    `${s} [data-seats]::after{content:"P" attr(data-seats);position:absolute;right:3px;top:2px;font:700 ${u(14)}/1 ${v('mono')};padding:2px 3px;background:${v('accent')};color:${v('panel')}}`,
    `${s} .mana-button{display:flex;align-items:center;justify-content:center;border:${v('rule-w')} solid ${v('line')};text-align:center;padding:${u(9)} ${pl(21)}}`,
    `${s} .mana-list{display:flex;flex-direction:column;gap:${u(3)};min-height:0;overflow:hidden}`,
    // a menu list (the title's, a hub's): its rows at the title's size, the ▶ beside them
    `${s} .mana-list[data-variant=menu]>.mana-row{font-family:${v('display')};font-size:${ts(TYPE.title * 0.75)};font-weight:800;letter-spacing:.03em;text-transform:${v('case')};padding-top:${u(6)};padding-bottom:${u(6)}}`,
    `${s} .mana-list[data-variant=menu]>.mana-row[data-st=focus]::before{font-size:${u(24)}}`,
    `${s} .mana-list[data-empty=yes],${s} .mana-grid[data-empty=yes]{padding:${u(9)} ${u(12)};border:1px dashed ${v('soft')}}`,
    `${s} .mana-more{font-size:${t('caption')};color:${v('mid')};text-align:center}`,
    `${s} .mana-grid{display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:${u(6)}}`,
    `${s} .mana-cell{border:${v('rule-w')} solid ${v('soft')};min-height:${u(51)};padding:${u(6)} ${u(9)} ${u(6)} ${pl(24)};font-size:${t('body')}}`,
    `${s} .mana-tree{display:grid;grid-template-columns:repeat(var(--cols,1),minmax(${u(165)},1fr));gap:${u(28)}}`,
    `${s} .mana-tier{display:flex;flex-direction:column;gap:${u(12)};justify-content:center}`,
    `${s} .mana-node{border:${v('rule-w')} solid ${v('line')};font-size:${t('body')};background:${v('paper')}}`,
    `${s} .mana-node[data-state=learned]{background:${v('ink')};color:${v('panel')}}`,
    `${s} .mana-node[data-state=learned][data-st=focus]{background:${v('ink')};color:${v('panel')};opacity:.85}`,
    `${s} .mana-node[data-state=learned] :is(.mana-text,.mana-caption,.mana-label,.mana-req){color:inherit;opacity:.8}`,
    `${s} .mana-node[data-state=locked]{border-style:dashed;color:${v('mid')}}`,
    `${s} .mana-node[data-state=later]{border-style:dotted;color:${v('mid')}}`,
    `${s} .mana-req{display:block;font-size:${t('caption')};color:${v('mid')}}`,
    `${s} .mana-node[data-state=learned] .mana-req{color:${v('soft')}}`,
    `${s} .mana-toggle,${s} .mana-cycler,${s} .mana-slider,${s} .mana-keybind,${s} .mana-alloc{display:flex;justify-content:space-between;align-items:center;gap:${u(21)}}`,
    // an input's own name is what the row says: the body, in the ink (an option is read, not glanced at)
    `${s} :is(.mana-toggle,.mana-cycler,.mana-slider,.mana-keybind,.mana-alloc)>.mana-label{font-size:${t('body')};color:inherit}`,
    `${s} .mana-toggle .mana-value{display:flex;align-items:center;gap:${u(9)}}`,
    // a switch: the knob's side is the state, the word beside it again
    `${s} .mana-switch{position:relative;display:inline-block;width:${u(57)};height:${u(33)};border-radius:${u(16.5)};border:${v('rule-w')} solid ${v('line')};background:${v('paper')};transition:${v('motion')}}`,
    `${s} .mana-switch i{position:absolute;top:${u(4.5)};left:${u(4.5)};width:${u(21)};height:${u(21)};border-radius:50%;background:${v('mid')};transition:${v('motion')}}`,
    `${s} .mana-toggle[data-on=yes] .mana-switch{background:${v('accent')};border-color:${v('accent')}}`,
    `${s} .mana-toggle[data-on=yes] .mana-switch i{left:${u(28.5)};background:${v('panel')}}`,
    // a stepper's ends are its own targets (a tap on either turns it)
    `${s} .mana-cycler .mana-value{display:flex;align-items:center;gap:${u(3)}}`,
    `${s} .mana-step{display:inline-flex;align-items:center;justify-content:center;min-width:${u(39)};min-height:calc(${v('target')} - ${u(12)});border-radius:calc(${v('radius')}*.5 + 2px);color:${v('mid')};font-size:${t('label')}}`,
    `${s}[data-input=touch] .mana-step{min-width:40px;border:1px solid ${v('soft')}}`,
    `${s} .mana-now{min-width:5.5em;text-align:center}`,
    // the language picker: a cycler wide enough for a language's own name
    `${s} .mana-language .mana-now{min-width:9em}`,
    `${s} .mana-slider .mana-value{display:flex;align-items:center;gap:${u(9)};min-width:${u(180)}}`,
    `${s} .mana-slider .mana-track{flex:1}`,
    `${s} .mana-allocator{display:flex;flex-direction:column;gap:${u(4)};min-width:${u(420)}}`,
    `${s} .mana-alloc{display:grid;grid-template-columns:1fr ${u(48)} ${u(21)} ${u(48)} ${u(51)}}`,
    `${s} .mana-keys{display:flex;gap:${u(6)}}`,
    `${s} .mana-keybind[data-conflict=yes]{border-style:dashed;border-color:${v('harm')}}`, `${s} .mana-clash{font-size:${t('caption')};color:${v('harm')}}`,
    `${s} .mana-key{display:inline-block;min-width:${u(30)};padding:${u(1.5)} ${u(7.5)};border:${v('rule-w')} solid ${v('line')};border-bottom-width:2px;border-radius:calc(${v('radius')}*.5);font:700 ${t('label')}/1.3 ${v('mono')};text-align:center;text-transform:uppercase;background:${v('paper')}}`,
    `${s} .mana-carousel{display:grid;grid-template-columns:${u(36)} 1fr ${u(36)};align-items:center;gap:${u(9)};padding:${u(12)} ${u(12)} ${u(27)}}`,
    `${s} .mana-carousel .mana-dots{position:absolute;left:0;right:0;bottom:3px;text-align:center;font-size:${u(14)};letter-spacing:${u(3)}}`,
    `${s} .mana-slide{min-width:0}`,
    `${s} .mana-mark{color:${v('mid')}}`,
    `${s} .mana-draft{font:700 ${ts(30)}/1.2 ${v('mono')};letter-spacing:.12em;border-bottom:2px solid ${v('line')};padding:${u(6)} ${u(3)};margin:${u(9)} 0;min-height:${u(45)}}`,
    `${s} .mana-textentry .mana-grid{--cols:10}`,
    `${s} .mana-textentry .mana-cell{min-height:${u(36)};text-align:center;padding:${u(3)};font:600 ${t('body')} ${v('mono')}}`,
    // values
    `${s} .mana-stat{display:flex;justify-content:space-between;gap:${u(18)}}`,
    `${s} .mana-max{color:${v('mid')}}`,
    `${s} .mana-bar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:${u(9)};font-size:${t('label')};min-width:${u(225)}}`,
    `${s} .mana-track{position:relative;display:block;height:${u(14)};border:${v('rule-w')} solid ${v('line')};background:${v('paper')};border-radius:calc(${v('radius')}*.4);overflow:hidden}`,
    `${s} .mana-track i{display:block;height:100%;background:${v('plain')}}`,
    ...Object.entries(FILL).map(([k, x]) => `${s} .mana-bar[data-variant=${k}] .mana-track i{background:${x}}`),
    `${s} .mana-bar[data-variant=boss]{min-width:${u(690)}}`,
    `${s} .mana-bar[data-variant=boss] .mana-track{height:${u(24)}}`,
    // (a bar that is a frame: a fighter's health along the top, its meaning still its variant's)
    `${s} .mana-bar[data-size=large] .mana-track{height:${u(30)}}`,
    `${s} .mana-bar[data-size=thin] .mana-track{height:${u(6)}}`,
    // a bar with no figures: its track takes the room the value took (mirrored, the track first)
    `${s} .mana-bar[data-figures=no]{grid-template-columns:auto 1fr}`, `${s} .mana-bar[data-figures=no][data-dir=rtl]{grid-template-columns:1fr auto}`,
    // two fighters' bars, sharing a row across the top: the thickest on the screen (a fight is read off them)
    `${s} .mana-stack[data-fill=yes] .mana-bar[data-variant=hp] .mana-track{height:${u(30)}}`,
    // A LOAD: its line (the activity mark, the step, the percent), its track, a line kept for what it may say (still
    // loading, a failure) so nothing jumps when it speaks, and its tip at a reading measure, two lines kept for it
    `${s} .mana-loader{display:flex;flex-direction:column;gap:${u(9)};width:100%}`,
    `${s} .mana-loadline{display:flex;align-items:center;gap:${u(10)};min-height:${u(24)}}`,
    `${s} .mana-loadline>.mana-label{flex:1}`,
    `${s} .mana-loader .mana-track{height:${u(10)}}`,
    `${s} .mana-loader[data-state=failed] .mana-track i{background:${v('harm')}}`,
    `${s} .mana-loadsay{min-height:1.35em}`,
    `${s} .mana-tip{margin:0;max-width:60ch;line-height:1.45;min-height:2.9em}`,
    `${s} .mana-tip>b{margin-right:.4em;letter-spacing:.08em;text-transform:${v('case')};color:${v('accent')}}`,
    `${s} .mana-spin{flex:none;width:${u(18)};height:${u(18)};border-radius:50%;border:${u(3)} solid ${v('soft')};border-top-color:${v('accent')}}`,
    `${s} .mana-track[data-known=no] .mana-sweep{position:absolute;top:0;bottom:0;left:0;width:35%;background:${v('plain')}}`,
    // a load covers the stage: nothing half built shows through it, and its words never sit on the world
    `${s} .mana-screen:has(.mana-loader){background:${v('panel')}}`,
    // a load that went ready before its grace was up never showed: what it holds waits, the cover alone is seen
    `${s} .mana-screen:has(.mana-loader[data-grace=yes])>*{visibility:hidden}`,
    `${s} .mana-track b{position:absolute;top:-2px;bottom:-2px;width:1px;background:${v('line')};outline:1px solid ${v('paper')}}`,
    `${s} .mana-bar[data-low=yes] .mana-track i{background:repeating-linear-gradient(45deg,${v('harm')} 0 2px,transparent 2px 4px),repeating-linear-gradient(-45deg,${v('harm')} 0 2px,transparent 2px 4px)}`,
    `${s} .mana-pips .mana-glyphs{letter-spacing:2px;font-size:${ts(26)}}`,
    `${s} .mana-pips,${s} .mana-counter,${s} .mana-timer{display:flex;align-items:center;gap:${u(9)}}`,
    `${s} .mana-compare{display:grid;grid-template-columns:1fr auto ${u(21)} auto;gap:${u(9)};align-items:center}`,
    `${s} .mana-compare[data-way=better] .mana-mark,${s} .mana-compare[data-way=worse] .mana-mark{color:${v('ink')};font-weight:700}`,
    `${s} .mana-icon{display:inline-flex;align-items:center;justify-content:center;width:${u(36)};height:${u(36)};border:${v('rule-w')} solid ${v('line')};border-radius:calc(${v('radius')}*.4);font:700 ${u(14)} ${v('mono')};background:${v('paper')}}`,
    `${s} .mana-icon[data-size=s]{width:${u(24)};height:${u(24)};font-size:${u(11)}}`, `${s} .mana-icon[data-size=l]{width:${u(60)};height:${u(60)};font-size:${u(18)}}`,
    `${s} .mana-portrait{display:inline-flex;flex-direction:column;align-items:center;gap:${u(3)}}`,
    `${s} .mana-ph{display:flex;align-items:center;justify-content:center;width:${u(72)};height:${u(72)};border:${v('rule-w')} solid ${v('line')};border-radius:calc(${v('radius')}*.6);background:${X_BOX} ${v('paper')};font:700 ${u(20)} ${v('mono')}}`,
    `${s} .mana-portrait[data-size=s] .mana-ph{width:${u(42)};height:${u(42)};font-size:${u(14)}}`, `${s} .mana-portrait[data-size=l] .mana-ph{width:${u(126)};height:${u(126)};font-size:${u(27)}}`,
    // (a fighter's art at full height: tall, the room a versus screen gives it)
    `${s} .mana-portrait[data-size=xl] .mana-ph{width:${u(290)};height:${u(440)};font-size:${u(54)}}`,
    `${s} .mana-image{display:flex;align-items:flex-end;justify-content:center;border:${v('rule-w')} solid ${v('line')};border-radius:calc(${v('radius')}*.6);background:${X_BOX} ${v('paper')};aspect-ratio:16/9;width:100%;padding:${u(6)}}`,
    `${s} .mana-image[data-ratio=square]{aspect-ratio:1}`, `${s} .mana-image[data-ratio=tall]{aspect-ratio:3/4}`, `${s} .mana-image[data-ratio=banner]{aspect-ratio:4/1}`,
    `${s} .mana-badge{display:inline-block;padding:0 ${u(7.5)};border:${v('rule-w')} solid ${v('line')};border-radius:${u(12)};font:700 ${t('caption')}/1.5 ${v('mono')}}`,
    // a legend: what the buttons do here, each beside the glyph of the control in hand
    `${s} .mana-legend{display:flex;flex-wrap:wrap;gap:${u(27)};align-items:center;font-size:${t('label')};font-weight:700;letter-spacing:.04em;text-transform:${v('case')};color:${v('ink')}}`,
    `${s} .mana-hint{display:inline-flex;align-items:center;gap:${u(8)}}`,
    `${s} .mana-prompt{display:flex;align-items:center;gap:${u(9)};padding:${u(6)} ${u(12)};border:${v('rule-w')} solid ${v('line')};border-radius:${v('radius')};background:${v('plate')}}`,
    // in-game: regions, anchors, aim, maps, feed, moments. The HUD layer is the whole stage (a part over the world sits
    // where the game projects it); its places sit in the title-safe frame
    `${s} .mana-hud{position:absolute;inset:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);pointer-events:none}`,
    `${s} .mana-place,${s} .mana-screen>.mana-region{position:absolute;display:flex;flex-direction:column;gap:${u(9)};padding:${u(6)};max-width:40%}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region):is([data-at=top],[data-at=bottom]){max-width:92%}`,
    `${s} .mana-region,${s} .mana-tab{min-width:0}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=top-left]{top:${SY};left:${SX}}`, `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=top]{top:${SY};left:50%;transform:translateX(-50%);align-items:center}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=top-right]{top:${SY};right:${SX};align-items:flex-end}`, `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=left]{top:50%;left:${SX};transform:translateY(-50%)}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=center]{top:50%;left:50%;transform:translate(-50%,-50%);align-items:center}`, `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=right]{top:50%;right:${SX};transform:translateY(-50%);align-items:flex-end}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=bottom-left]{bottom:${SY};left:${SX}}`, `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=bottom]{bottom:${SY};left:50%;transform:translateX(-50%);align-items:center}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=bottom-right]{bottom:${SY};right:${SX};align-items:flex-end}`,
    `${s} .mana-place>*,${s} .mana-screen>.mana-region>:not(.mana-window){background:${v('plate')};border:${v('frame-w')} ${v('frame-s')} ${v('line')};border-radius:${v('radius')};padding:${u(8)} ${u(10)};opacity:.94}`,
    // the parts that are their own frame sit bare, with the halo: the aim, a moment's banner, a phone's controls
    `${s} .mana-place>.mana-region:has(>:is(.mana-reticle,.mana-banner,.mana-touchpad,.mana-moments)){background:transparent;border:0;opacity:1;clip-path:none;box-shadow:none;outline:0;text-shadow:${v('halo')}}`,
    // a bare region: no plate, its parts their own frame (a fight's bars, its combo over the round), the words haloed
    // (a region whose every part is gated off draws nothing: no empty plate left standing over the world)
    `${s} .mana-place>.mana-region:empty,${s} .mana-place>.mana-region:has(>.mana-stack:only-child:empty){display:none}`,
    `${s} .mana-screen>.mana-region[data-variant=bare][data-at]>:not(.mana-window){background:transparent;border:0;padding:0;clip-path:none;box-shadow:none;opacity:1}`,
    `${s} :is(.mana-place,.mana-screen)>.mana-region[data-variant=bare][data-at]{background:transparent;border:0;opacity:1;clip-path:none;box-shadow:none;outline:0;text-shadow:${v('halo')}}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-track{background:${v('panel')};box-shadow:0 0 0 ${u(3)} ${v('panel')}}`,
    // A SCRIM: no box, a shade rising behind the region from nowhere in particular, so a corner's readout sits on the
    // world as a shooter's does (darker where the words are, gone before any edge could show); the words haloed
    // (over a theme's plate and its cut corners, which would clip the shade to a box)
    `${s} .mana-place>.mana-region[data-variant=scrim][data-at]{position:relative;isolation:isolate;background:transparent;border:0;opacity:1;clip-path:none;box-shadow:none;outline:0;padding:${u(10)} ${u(14)};text-shadow:${v('halo')}}`,
    `${s} .mana-place>.mana-region[data-variant=scrim]::before{content:"";position:absolute;inset:-55% -35%;z-index:-1;background:radial-gradient(closest-side,color-mix(in srgb,${v('panel')} 62%,transparent),color-mix(in srgb,${v('panel')} 34%,transparent) 55%,transparent);pointer-events:none}`,
    `${s} .mana-place>.mana-region[data-variant=scrim] .mana-track{border:0;background:color-mix(in srgb,${v('panel')} 70%,transparent);box-shadow:0 0 0 ${u(2)} color-mix(in srgb,${v('panel')} 55%,transparent)}`,
    // AT REST: what holds no news fades back (a full magazine, full health), and comes forward the moment it changes
    `${s} .mana-place>.mana-region{transition:opacity calc(${v('dur')} * 3) ease-out}`,
    `${s} .mana-place>.mana-region[data-rest=yes]{opacity:.38!important;transition-duration:calc(${v('dur')} * 8)}`,
    // A FIGHT'S BARS, over the round: lit, not flat. The track sunk (a shade inside its top edge), the bar standing off
    // the round on a soft shadow; each fill glossed (a highlight across its top, a shade at its foot) with a bright
    // leading edge. A hit: the fill drops quickly, the slice it took flashes once, the chip holds what the combo took and
    // drains after a beat once the game gives the ghost back as the value; a gain glows across what it filled; a super
    // with a stock ready keeps a sheen running along it. All on the theme's motion: less motion stills the sheen and the
    // glides, less flash dims the slice, a hit-stop holds them.
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-track{border:0;border-radius:${u(2)};background:linear-gradient(color-mix(in srgb,${v('shade')} 55%,transparent),color-mix(in srgb,${v('gleam')} 5%,transparent)),${v('panel')};box-shadow:inset 0 ${u(2)} ${u(4)} color-mix(in srgb,${v('shade')} 75%,transparent),0 0 0 ${u(2)} ${v('panel')},0 ${u(4)} ${u(10)} color-mix(in srgb,${v('shade')} 35%,transparent)}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-track i{overflow:hidden;box-shadow:inset ${u(-2)} 0 0 color-mix(in srgb,${v('gleam')} 70%,transparent);transition:width calc(${v('glide')} * .55) ${v('ease')}}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-track :is(i,u)::after{content:"";position:absolute;inset:0;background:linear-gradient(color-mix(in srgb,${v('gleam')} 55%,transparent),color-mix(in srgb,${v('gleam')} 16%,transparent) 40%,transparent 52%,color-mix(in srgb,${v('shade')} 22%,transparent));box-shadow:inset 0 ${u(-2)} 0 color-mix(in srgb,${v('shade')} 22%,transparent);pointer-events:none}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-track u{background:${v('harm')};opacity:1;transition:width calc(${v('glide')} * 2.6) cubic-bezier(.45,0,.65,1) calc(${v('glide')} * 1.8)}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-track s{display:block;position:absolute;top:0;bottom:0;z-index:2;background:${v('gleam')};pointer-events:none;mix-blend-mode:screen}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-track s[data-ch]{animation:mana-moved calc(${v('dur')} * 3) ease-out both}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-track s[data-ch=up]{background:${v('accent2')};animation-duration:calc(${v('dur')} * 4)}`,
    `${s}[data-flash=reduced] .mana-place>.mana-region[data-variant=bare] .mana-track s[data-ch]{animation:mana-moved-dim calc(${v('dur')} * 3) ease-out both}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-bar[data-ready=yes]:not([data-variant=hp]) .mana-track i::before{content:"";position:absolute;top:0;bottom:0;left:0;width:35%;background:linear-gradient(90deg,transparent,color-mix(in srgb,${v('gleam')} 60%,transparent),transparent);animation:mana-runs 1.8s ease-in-out infinite;animation-play-state:${v('loop')}}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-bar[data-ready=yes]:not([data-variant=hp]) .mana-track{box-shadow:inset 0 ${u(2)} ${u(4)} color-mix(in srgb,${v('shade')} 75%,transparent),0 0 0 ${u(2)} ${v('panel')},0 0 ${u(12)} color-mix(in srgb,${v('xp')} 55%,transparent)}`,
    // (a lab's strips over the round, the inputs and a frame meter: one line each, the frames close as a meter's marks,
    // a mark that carries no number narrow)
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-each[data-dir=row]:has(>.mana-badge){flex-wrap:nowrap;gap:${u(3)}}`,
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-each[data-dir=row]>.mana-badge:empty{min-width:${u(9)};padding:0;height:1.5em}`,
    // (over the round, the two sides are each other's reflection: a row's parts centred across whichever end it runs
    // from, and figures in even widths, so a 1 and a 2 move nothing)
    `${s} .mana-place>.mana-region[data-variant=bare] .mana-stack[data-dir=row]:is([data-align=start],[data-align=end]){align-items:center}`,
    `${s} .mana-place>.mana-region[data-variant=bare] :is(.mana-text,.mana-num){font-variant-numeric:tabular-nums}`,
    // the subtitles: their own plate, its opacity the player's (XAG 104), at a size read from a sofa
    `${s} .mana-place>.mana-region[data-variant=subtitles]{background:color-mix(in srgb,${v('panel')} calc(${v('sub-plate')} * 100%),transparent);border:0;opacity:1;text-align:center;font-size:${ts(36)}}`,
    `${s} .mana-anchors{position:absolute;inset:0}`,
    `${s} .mana-anchor{position:absolute;transform:translate(-50%,-100%)}`,
    // what floats over the world carries its own plate: the world behind it can be any colour
    `${s} .mana-anchor>*{background:${v('plate')};border-radius:calc(${v('radius')}*.5);padding:${u(3)} ${u(8)};opacity:.94}`,
    // a passing row (a damage number): bare over the world, its words haloed in the panel's colour as the aim is
    `${s} .mana-anchors[data-pass=yes] .mana-anchor>*{background:transparent;padding:0;opacity:1;font-weight:700;text-shadow:0 0 2px ${v('panel')},0 0 3px ${v('panel')},0 0 1px ${v('panel')};white-space:nowrap}`,
    // bare over the world, the aim keeps a halo in the panel's colour so it reads over any scene
    `${s} .mana-reticle{position:relative;font:300 ${u(39)}/1 ${v('mono')};text-align:center;text-shadow:0 0 2px ${v('panel')},0 0 3px ${v('panel')},0 0 1px ${v('panel')}}`,
    `${s} .mana-hit{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:${u(51)};font-weight:200}`,
    `${s} .mana-minimap{position:relative;width:${u(195)};height:${u(195)};border:${v('rule-w')} solid ${v('line')};background:${X_BOX} ${v('paper')}}`,
    `${s} .mana-minimap[data-shape=round]{border-radius:50%}`,
    // THE MAP: its ground in the theme's own colours (never a colour of its own: a theme changes the map with the rest),
    // its plane turned and scaled by the runtime, its markers the theme's icons; the miniature a model on a table
    `${s} .mana-map{position:relative;overflow:hidden;border:${v('rule-w')} solid ${v('line')};background:${v('wash')};color:${v('ink')};container-type:size;display:flex;align-items:center;justify-content:center}`,
    `${s} .mana-map-frame{position:relative;flex:none;width:min(100cqw,100cqh);height:min(100cqw,100cqh)}`,
    // (a radar fills its corner: its ground runs under its edges)
    `${s} .mana-map[data-view=follow] .mana-map-frame{width:max(100cqw,100cqh);height:max(100cqw,100cqh)}`,
    `${s} .mana-map[data-size=corner]{width:${u(240)};height:${u(240)}}`,
    `${s} .mana-map[data-size=panel]{width:100%;aspect-ratio:4/3}`,
    `${s} .mana-map[data-size=full]{width:100%;height:100%;min-height:${u(360)}}`,
    `${s} .mana-map[data-view=miniature]{perspective:${u(1400)};background:linear-gradient(${v('paper')},${v('wash')})}`,
    `${s} .mana-map-plane{position:absolute;inset:0;transform-style:preserve-3d;background:${v('wash')}}`,
    `${s} .mana-map[data-view=miniature] .mana-map-plane{inset:12% 18%;box-shadow:0 0 0 ${v('rule-w')} ${v('line')}}`,
    `${s} .mana-map-shape{position:absolute;box-sizing:border-box;transform-style:preserve-3d}`,
    `${s} .mana-map-shape[data-kind=land]{background:${v('wash')}}`,
    `${s} .mana-map-shape[data-kind=road]{background:${v('paper')}}`,
    `${s} .mana-map-shape[data-kind=walk]{background:color-mix(in srgb,${v('paper')} 60%,${v('soft')})}`,
    `${s} .mana-map-shape[data-kind=block]{background:${v('soft')}}`,
    `${s} .mana-map-shape[data-kind=building]{background:${v('mid')}}`,
    `${s} .mana-map-shape[data-kind=lot]{background:color-mix(in srgb,${v('soft')} 55%,${v('paper')})}`,
    // (a side's turf: a wash of the side's own colour, the game's to say, `tint`; over the ground, under what stands on it)
    `${s} .mana-map-shape[data-kind=turf]{background:color-mix(in srgb,var(--tint,${v('accent')}) 34%,transparent);outline:1px solid color-mix(in srgb,var(--tint,${v('accent')}) 70%,transparent);outline-offset:-1px;pointer-events:none}`,
    `${s} .mana-map-shape[data-kind=park]{background:color-mix(in srgb,${v('accent2')} 38%,${v('wash')})}`,
    `${s} .mana-map-shape[data-kind=water]{background:color-mix(in srgb,${v('accent')} 34%,${v('wash')})}`,
    // (raised in the miniature: its roof lifted over its plot, its plot the wall's shade)
    `${s} .mana-map-shape[data-tall=yes]{background:color-mix(in srgb,${v('ink')} 45%,${v('soft')})}`,
    `${s} .mana-map-roof{position:absolute;inset:0;background:${v('soft')};box-shadow:inset 0 0 0 1px ${v('line')};transform:translateZ(calc(var(--tall) * ${u(120)}))}`,
    `${s} .mana-map-mark{position:absolute;display:flex;flex-direction:column;align-items:center;gap:${u(2)};line-height:1;transform-origin:50% 50%;white-space:nowrap;text-shadow:0 0 2px ${v('panel')},0 0 3px ${v('panel')}}`,
    `${s} .mana-map[data-view=miniature] .mana-map-mark{transform-origin:50% 100%}`,
    `${s} .mana-map-glyph{font-size:${u(18)}}`,
    `${s} .mana-map-mark[data-kind=goal]{color:${v('accent')}}`,
    `${s} .mana-map-mark[data-kind=foe]{color:${v('harm')}}`,
    `${s} .mana-map-mark[data-you=yes]{color:${v('accent')};z-index:2}`,
    `${s} .mana-map-mark[data-you=yes] .mana-icon,${s} .mana-map-mark[data-you=yes] .mana-map-glyph{font-size:${u(24)}}`,
    `${s} .mana-map>.mana-caption{position:absolute;left:${u(6)};bottom:${u(3)}}`,
    // A SCOPE: an instrument over the world, not a picture in a box. Its face fades out at its edge, a bezel of ticks
    // rings it, the wedge ahead shows what you see, and north rides the bezel as it turns
    `${s} .mana-minimap[data-scope=yes]{border:0;background:radial-gradient(closest-side,color-mix(in srgb,${v('panel')} 70%,transparent) 0 80%,color-mix(in srgb,${v('panel')} 38%,transparent) 92%,transparent);overflow:visible}`,
    `${s} .mana-bezel{position:absolute;inset:0;pointer-events:none}`,
    `${s} .mana-bezel::before{content:"";position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(${v('ink')} 0 1deg,transparent 1deg 15deg);-webkit-mask:radial-gradient(closest-side,transparent 86%,${v('ink')} 87% 91%,transparent 92%);mask:radial-gradient(closest-side,transparent 86%,${v('ink')} 87% 91%,transparent 92%);opacity:.55}`,
    `${s} .mana-minimap[data-scope=yes]::before{content:"";position:absolute;inset:25%;border-radius:50%;border:1px solid color-mix(in srgb,${v('ink')} 22%,transparent);pointer-events:none}`,
    `${s} .mana-cone{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from -35deg,color-mix(in srgb,${v('ink')} 24%,transparent) 0 70deg,transparent 70deg);-webkit-mask:radial-gradient(closest-side,${v('ink')},transparent 92%);mask:radial-gradient(closest-side,${v('ink')},transparent 92%)}`,
    `${s} .mana-north{position:absolute;inset:0;font:800 ${t('caption')}/1 ${v('mono')};text-align:center;pointer-events:none}`,
    `${s} .mana-north>span{display:inline-block;width:${u(24)};height:${u(24)};margin-top:${u(-6)};border-radius:50%;line-height:${u(24)};background:${v('accent')};color:${v('panel')};text-shadow:none}`,
    // THE MAGAZINE: the rounds are the figure, the reserve its caption, the magazine itself a belt of rounds that empties
    // toward the edge it sits by; a shot kicks the figure (no flash: firing is not news), low turns it to harm and says
    // so, empty says reload, a reload sweeps the belt full
    `${s} .mana-magazine{display:flex;flex-direction:column;align-items:flex-end;gap:${u(5)};font-variant-numeric:tabular-nums}`,
    `${s} .mana-gun{display:flex;align-items:baseline;gap:${u(10)};font:700 ${t('label')}/1.1 ${v('font')};letter-spacing:.1em;text-transform:${v('case')}}`,
    `${s} .mana-mode{font:700 ${t('caption')}/1 ${v('mono')};padding:${u(2)} ${u(6)};border:${v('rule-w')} solid currentColor;border-radius:calc(${v('radius')}*.5);opacity:.8}`,
    `${s} .mana-rounds{display:flex;align-items:baseline;gap:${u(8)}}`,
    `${s} .mana-rounds>.mana-num{display:inline-block;font:800 ${ts(80)}/.86 ${v('display')};letter-spacing:-.02em}`,
    `${s} .mana-reserve{font:700 ${ts(30)}/1 ${v('mono')};opacity:.72}`,
    `${s} .mana-reserve::before{content:"/";margin-right:${u(4)};opacity:.6}`,
    // (the gun's wireframe over it all, and each round a cartridge cut from the ink: guns.js; a spent one its outline)
    `${s} .mana-magazine .mana-sil{margin-bottom:${u(-4)};opacity:.92}`,
    // (a mark part full: the filled glyph over the empty one, cut to its share from the left)
    `${s} .mana-pip-part{position:relative;display:inline-block}`,
    `${s} .mana-pip-part>b{position:absolute;left:0;top:0;width:calc(var(--f,0) * 100%);overflow:hidden;font-weight:inherit;white-space:nowrap}`,
    // (a bar in its side's colour: a seat's health in its own kit, so whose it is reads without its tag)
    ...Array.from({ length: 8 }, (_, k) => `${s} .mana-bar[data-side="${k}"]:not([data-low]) .mana-track i{background:${v(`side-${k}`)}}`),
    // A CHARGE: a ring round its pictogram that fills as the power comes back, glows when it is ready and drains as it
    // is spent; what sets it off said small beside it
    `${s} .mana-charge{display:flex;align-items:center;gap:${u(10)}}`,
    `${s} .mana-ring{position:relative;display:grid;place-items:center;width:${u(56)};height:${u(56)};border-radius:50%}`,
    `${s} .mana-ring::before{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(${v('accent2')} calc(var(--r,0) * 1turn),color-mix(in srgb,${v('ink')} 18%,transparent) 0);-webkit-mask:radial-gradient(closest-side,transparent 74%,${v('ink')} 76%);mask:radial-gradient(closest-side,transparent 74%,${v('ink')} 76%)}`,
    `${s} .mana-ring>.mana-icon{position:relative;border:0;background:transparent;opacity:.55}`,
    `${s} .mana-charge[data-state=ready] .mana-ring::before{background:${v('accent')}}`,
    `${s} .mana-charge[data-state=ready] .mana-ring{box-shadow:0 0 ${u(16)} color-mix(in srgb,${v('accent')} 55%,transparent)}`,
    `${s} .mana-charge:is([data-state=ready],[data-state=active]) .mana-ring>.mana-icon{opacity:1}`,
    `${s} .mana-charge[data-state=active] .mana-ring::before{background:conic-gradient(${v('accent')} calc(var(--r,0) * 1turn),transparent 0)}`,
    `${s} .mana-charge[data-state=active] .mana-ring{animation:mana-pulse .9s ease-in-out infinite;animation-play-state:${v('loop')}}`,
    `${s} .mana-charge>.mana-label{font:700 ${t('label')}/1 ${v('font')};letter-spacing:.12em;text-transform:${v('case')}}`,
    `${s} .mana-charge:not([data-state=ready])>.mana-label{opacity:.6}`,
    // THE WHEEL: what is carried round a ring, each at the control that picks it, drawn as its wireframe; the one in
    // hand lit and named in the middle. A shade under it all, no box: the world still shows through
    `${s} .mana-wheel{position:relative;width:${u(600)};height:${u(600)};text-shadow:${v('halo')}}`,
    `${s} .mana-wring{position:absolute;inset:0;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,${v('panel')} 72%,transparent) 0 60%,color-mix(in srgb,${v('panel')} 40%,transparent) 82%,transparent)}`,
    `${s} .mana-wring::after{content:"";position:absolute;inset:22%;border-radius:50%;border:1px solid color-mix(in srgb,${v('ink')} 28%,transparent)}`,
    `${s} .mana-wslot{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:${u(4)};opacity:.62;transition:opacity ${v('dur')} ease-out,scale ${v('dur')} ${v('ease')}}`,
    `${s} .mana-wslot .mana-sil{width:${u(150)};height:${u(48)};-webkit-mask-position:center;mask-position:center}`,
    `${s} .mana-wslot>.mana-name{font:700 ${t('label')}/1 ${v('font')};letter-spacing:.1em;text-transform:${v('case')}}`,
    `${s} .mana-wmeta{display:flex;align-items:center;gap:${u(8)}}`,
    `${s} .mana-wmeta>.mana-key{min-width:${u(30)};padding:${u(2)} ${u(7)};border:${v('rule-w')} solid currentColor;border-radius:${u(15)};font:700 ${t('caption')}/1.3 ${v('mono')};text-align:center}`,
    `${s} .mana-wmeta>.mana-num{font:600 ${t('caption')}/1 ${v('mono')};opacity:.8}`,
    `${s} .mana-wslot[data-on]{opacity:1;scale:1.12;color:${v('accent')}}`,
    `${s} .mana-wslot[data-on] .mana-sil{background:${v('accent')}}`,
    `${s} .mana-whub{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:${u(4)};max-width:40%;text-align:center}`,
    `${s} .mana-whub>.mana-name{font:800 ${t('title')}/1 ${v('display')};text-transform:${v('case')};letter-spacing:.02em}`,
    `${s} .mana-belt{display:flex;flex-direction:row-reverse;align-items:flex-end;gap:${u(2)}}`,
    `${s} .mana-belt i{flex:1 1 0;min-width:1px;height:100%;background:${v('ink')};-webkit-mask:var(--mana-round) center bottom/contain no-repeat;mask:var(--mana-round) center bottom/contain no-repeat}`,
    `${s} .mana-belt i[data-spent]{background:color-mix(in srgb,${v('ink')} 45%,transparent);-webkit-mask-image:var(--mana-round-spent);mask-image:var(--mana-round-spent)}`,
    `${s} .mana-magazine>.mana-track{width:${u(300)};height:${u(8)}}`,
    `${s} .mana-magazine .mana-num[data-ch]{animation:mana-kick calc(${v('dur')} * 1.4) ${v('ease')}}`,
    `${s} .mana-magazine:is([data-low],[data-empty]) .mana-rounds>.mana-num{color:${v('harm')}}`,
    `${s} .mana-magazine:is([data-low],[data-empty]) .mana-belt i:not([data-spent]){background:${v('harm')}}`,
    `${s} .mana-call{font:800 ${t('label')}/1 ${v('font')};letter-spacing:.16em;text-transform:${v('case')};color:${v('harm')};animation:mana-fade calc(${v('dur')} * 2) ease-out both}`,
    ...gunCss(s).split('\n'),
    `${s} .mana-magazine[data-empty] .mana-call{animation:mana-pulse ${PULSE}s ease-in-out infinite;animation-play-state:${v('loop')}}`,
    `${s} .mana-magazine[data-reloading] .mana-call{color:${v('accent')}}`,
    `${s} .mana-magazine[data-reloading] .mana-belt i{background:${v('accent')};-webkit-mask-image:var(--mana-round-spent);mask-image:var(--mana-round-spent);animation:mana-pulse .75s ease-in-out infinite;animation-play-state:${v('loop')}}`,
    // (a map with its way drawn: the way's dots in place of the blank map's cross)
    `${s} .mana-minimap[data-route]{background:${v('paper')}}`,
    `${s} .mana-minimap[data-route] .mana-marker[data-kind=self]{color:${v('accent')};font-size:${u(22)}}`,
    `${s} .mana-trace{position:absolute;width:${u(7)};height:${u(7)};border-radius:50%;background:${v('ink')};opacity:.5;transform:translate(-50%,-50%)}`,
    `${s} .mana-marker{position:absolute;transform:translate(-50%,-50%);font-size:${u(16)};line-height:1}`,
    `${s} .mana-minimap .mana-caption{position:absolute;left:${u(6)};bottom:${u(3)}}`,
    `${s} .mana-compass{position:relative;width:${u(450)};height:${u(33)};border:${v('rule-w')} solid ${v('line')};background:${v('paper')};overflow:hidden}`,
    `${s} .mana-compass .mana-cardinal,${s} .mana-compass .mana-marker{position:absolute;top:50%;transform:translate(-50%,-50%);font:700 ${u(16)} ${v('mono')}}`,
    `${s} .mana-needle{position:absolute;left:50%;top:-3px;transform:translateX(-50%);font-size:${u(12)}}`,
    `${s} .mana-feed{display:flex;flex-direction:column;gap:${u(3)};font-size:${t('label')};min-width:${u(240)}}`,
    `${s} .mana-toast{display:flex;align-items:center;gap:${u(12)};padding:${u(6)} ${u(15)};border:${v('rule-w')} solid ${v('line')};background:${v('plate')};font-size:${t('body')}}`,
    `${s} .mana-toast>.mana-words{display:flex;flex-direction:column}`,
    // a rare one: the second accent's heavier edge and the banner's sheen (and its own sound, the runtime's)
    `${s} .mana-toast[data-tier=rare]{position:relative;overflow:hidden;border-width:2px;border-color:${v('accent2')};box-shadow:inset 0 0 0 1px ${v('accent2')}}`,
    `${s} .mana-toast[data-tier=rare]::after{content:"";position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,${v('panel')},transparent);opacity:${v('sheen')};pointer-events:none;animation:mana-sheen calc(${v('dur')} * 6) ease-in-out calc(${v('dur')} * 2) both}`,
    `${s} .mana-times{font-weight:800}`,
    // a number's tone (a blow's kind): the theme's colours, its word still beside it
    `${s} .mana-text[data-tone=crit]{color:${v('harm')}}`, `${s} .mana-text[data-tone=heal]{color:${v('hp')}}`, `${s} :is(.mana-text[data-tone=miss],.mana-text[data-tone=block]){color:${v('mid')}}`,
    // damage numbers: bare over the world with the halo, a display numeral that pops and rises (a crit larger)
    `${s} .mana-anchors[data-variant=bare] .mana-anchor>*{background:transparent;padding:0;opacity:1;text-shadow:${v('halo')}}`,
    `${s} .mana-anchors[data-variant=bare] .mana-text[data-role=numeral]{display:inline-block;font-family:${v('display')};font-weight:900;font-size:${ts(TYPE.title * 0.8)};animation:mana-hit calc(${v('dur')} * 6) ${v('ease')} both}`,
    `${s} .mana-anchors[data-variant=bare] .mana-text[data-role=numeral][data-tone=crit]{font-size:${ts(TYPE.title * 1.25)}}`,
    // a rank stamped on as the screen settles
    `${s} .mana-badge[data-variant=stamp]{padding:${u(3)} ${u(24)};border:3px solid ${v('accent')};border-radius:${v('radius')};color:${v('accent')};font:900 ${ts(TYPE.title)}/1 ${v('display')};rotate:-6deg;animation:mana-stamp calc(${v('dur')} * 3) ${v('ease')} calc(${v('dur')} * 8) both}`,
    `${s} .mana-banner{display:flex;flex-direction:column;align-items:center;gap:${u(3)};padding:${u(12)} ${u(36)};border-top:2px solid ${v('line')};border-bottom:2px solid ${v('line')};background:${v('plate')}}`,
    // the moments: one up at a time, the weightiest the boldest (a decisive one's rules doubled)
    `${s} .mana-moments{display:flex;flex-direction:column;align-items:center}`, `${s} .mana-moments[data-as=toast]{align-items:flex-end}`,
    `${s} .mana-moments .mana-banner[data-weight="3"]{border-top-width:4px;border-bottom-width:4px}`,
    `${s} .mana-moments .mana-banner[data-weight="0"]{border-width:1px 0}`,
    // a side's chip, and the cell that leads a row (a shape beside the number, the colour the theme's)
    `${s} .mana-chip{display:inline-block;width:${u(9)};height:.9em;margin-right:${u(9)};vertical-align:-1px;border-radius:1px;background:${v('ink')}}`,
    ...Array.from({ length: 8 }, (_, k) => `${s} .mana-chip[data-side="${k}"]{background:${v(`side-${k}`)};box-shadow:0 0 0 1px ${v(`side-${k}-key`)}}`),
    `${s} :is(.mana-row,.mana-cell)>.mana-chip{position:absolute;left:calc(${u(12)} + ${v('mark')} * ${u(26)});top:${u(10)};bottom:${u(10)};width:${u(6)};height:auto;margin:0}`,
    `${s} .mana-table td[data-lead=yes]{font-weight:800}`, `${s} .mana-table td[data-lead=yes]::after{content:" \\25B2";font-size:.7em;color:${v('accent2')}}`,
    // the live game's own: a bar's chip and its mirror, tables, dials, slots, what is off screen, where harm came from
    `${s} .mana-track u{position:absolute;top:0;bottom:0;left:0;background:repeating-linear-gradient(-45deg,${v('ink')} 0 1px,transparent 1px 3px);opacity:.55}`,
    // (the fill over its chip, the marks over both)
    `${s} .mana-track i{position:relative;z-index:1}`, `${s} .mana-track b{z-index:2}`, `${s} .mana-track s{display:none}`,
    `${s} .mana-bar[data-dir=rtl]>.mana-num{order:1}`, `${s} .mana-bar[data-dir=rtl]>.mana-track{order:2}`, `${s} .mana-bar[data-dir=rtl]>.mana-label{order:3}`,
    `${s} .mana-badge[data-variant=strong]{background:${v('ink')};color:${v('panel')};border-color:${v('ink')}}`,
    `${s} .mana-badge[data-variant=muted]{border-style:dashed;color:${v('mid')}}`,
    `${s} .mana-table{border-collapse:collapse;width:100%;font-size:${t('body')}}`,
    `${s} .mana-table th{font-size:${t('caption')};font-weight:700;letter-spacing:.1em;text-transform:${v('case')};color:${v('mid')};text-align:left;padding:${u(4.5)} ${u(12)};border-bottom:1px solid ${v('line')}}`,
    `${s} .mana-table td{padding:${u(4.5)} ${u(12)};border-bottom:1px solid ${v('soft')}}`,
    `${s} .mana-table [data-align=right]{text-align:right;font-variant-numeric:tabular-nums}`, `${s} .mana-table [data-align=center]{text-align:center}`,
    `${s} .mana-table tr[data-mark=yes] td{font-weight:700;background:${v('wash')}}`,
    `${s} .mana-table tr[data-mark=yes] td:first-child::before{content:"\\25B6  "}`,
    `${s} .mana-gauge{display:inline-flex;flex-direction:column;align-items:center;gap:${u(3)}}`,
    `${s} .mana-dial{position:relative;display:flex;align-items:center;justify-content:center;width:${u(144)};height:${u(144)};border-radius:50%;border:${v('rule-w')} solid ${v('line')};background:conic-gradient(from -120deg,${v('plain')} calc(var(--r,0)*240deg),${v('paper')} 0 240deg,transparent 0)}`,
    `${s} .mana-dial::after{content:"";position:absolute;inset:${u(14)};border-radius:50%;background:${v('panel')}}`,
    `${s} .mana-dial i{position:absolute;left:calc(50% - 1px);bottom:50%;width:2px;height:${u(60)};background:${v('ink')};transform-origin:50% 100%;z-index:1}`,
    `${s} .mana-dial .mana-num{position:relative;z-index:2;margin-top:${u(51)};font-size:${ts(26)};font-weight:700}`,
    `${s} .mana-slot{position:relative;display:inline-flex;align-items:center;justify-content:center;width:${u(72)};height:${u(72)};border:${v('rule-w')} solid ${v('line')};border-radius:calc(${v('radius')}*.6);background:${v('paper')};overflow:hidden}`,
    `${s} .mana-slot .mana-icon{border:0;background:transparent}`,
    `${s} .mana-slot .mana-key{position:absolute;left:2px;top:2px;min-width:0;padding:0 2px;font-size:${u(12)};border-bottom-width:1px}`,
    `${s} .mana-cool{position:absolute;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,${v('ink')} 0 1px,transparent 1px 4px);opacity:.55}`,
    `${s} .mana-count{position:absolute;right:${u(4)};bottom:${u(1.5)};font:700 ${t('caption')} ${v('mono')}}`,
    `${s} .mana-slot[data-active=yes]{border:2px solid ${v('accent')};box-shadow:inset 0 0 0 1px ${v('accent')}}`,
    `${s} .mana-slot[data-empty=yes]{border-style:dashed;border-color:${v('soft')}}`,
    // (a slot read at a glance: larger, its pictogram filling it, its key larger in its corner)
    `${s} .mana-slot[data-size=l]{width:${u(150)};height:${u(150)};border-width:calc(${v('rule-w')} * 2)}`, `${s} .mana-slot[data-size=l]>.mana-icon{width:${u(112)};height:${u(112)}}`, `${s} .mana-slot[data-size=l] .mana-key{font-size:${u(22)};left:${u(8)};top:${u(6)}}`, `${s} .mana-slot[data-size=l][data-active=yes]{border-width:calc(${v('rule-w')} * 3)}`,
    // a card on the table: values first (its state a shape: an edge alight, lifted, turned on its side; its back hatched)
    `${s} .mana-card{position:relative;display:inline-flex;flex-direction:column;gap:${u(4)};width:${u(132)};height:${u(184)};padding:0 0 ${u(6)};border:${v('rule-w')} solid ${v('line')};border-radius:calc(${v('radius')}*.6);background:${v('paper')};overflow:hidden;vertical-align:top;text-align:left}`,
    `${s} .mana-card[data-size=s]{width:${u(96)};height:${u(134)}}`,
    `${s} .mana-card>.mana-band{display:flex;align-items:baseline;justify-content:space-between;gap:${u(6)};padding:${u(4)} ${u(8)};border-bottom:${v('rule-w')} solid ${v('line')};background:${v('wash')};font-size:${t('label')};font-weight:700}`,
    ...Array.from({ length: 8 }, (_, k) => `${s} .mana-card>.mana-band[data-side="${k}"]{box-shadow:inset 0 ${u(5)} 0 ${v(`side-${k}`)};padding-top:${u(8)}}`),
    `${s} .mana-card .mana-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
    `${s} .mana-card .mana-cost{flex:none;font-family:${v('mono')};font-variant-numeric:tabular-nums}`,
    `${s} .mana-card .mana-rules{flex:1;min-height:0;overflow:hidden;padding:0 ${u(8)};font-size:${t('caption')};line-height:1.25}`,
    `${s} .mana-card[data-size=s] .mana-rules{display:none}`,
    `${s} .mana-card .mana-tags{padding:0 ${u(8)};font-size:${t('caption')};color:${v('mid')}}`,
    `${s} .mana-card .mana-might{padding:0 ${u(8)};font:700 ${t('label')} ${v('mono')}}`,
    `${s} .mana-card>.mana-count{right:${u(6)};bottom:${u(3)}}`,
    `${s} .mana-card[data-state=playable]{border-color:${v('accent2')};box-shadow:inset 0 0 0 1px ${v('accent2')}}`,
    `${s} .mana-card[data-state=picked]{border:2px solid ${v('accent')};translate:0 calc(-1 * ${u(12)})}`,
    `${s} .mana-card[data-state=spent]{rotate:90deg;scale:.72;color:${v('mid')};border-style:dashed}`,
    `${s} .mana-card[data-face=down]{align-items:center;justify-content:center;padding:${u(6)}}`,
    `${s} .mana-back{position:absolute;inset:${u(6)};border:1px solid ${v('line')};background:repeating-linear-gradient(45deg,${v('soft')} 0 2px,transparent 2px 7px)}`,
    `${s} .mana-card[data-face=down]>.mana-count{position:relative;right:auto;bottom:auto;max-width:100%;padding:0 ${u(4)};background:${v('paper')};font-size:${t('caption')};text-align:center;overflow-wrap:anywhere}`,
    // the whole of what happened, shown from its end; the newest line is the ink, the rest a step back
    `${s} .mana-log{display:flex;flex-direction:column;gap:${u(3)};min-width:${u(240)};font-size:${t('label')};color:${v('mid')}}`,
    `${s} .mana-log>.mana-line[data-last=yes]{color:${v('ink')};font-weight:700}`,
    `${s} .mana-no{display:inline-block;min-width:${u(34)};font-family:${v('mono')};font-variant-numeric:tabular-nums}`,
    // a small series: bars against the largest, the last said as a number
    `${s} .mana-spark{display:inline-flex;align-items:flex-end;gap:${u(9)}}`,
    `${s} .mana-bars{display:inline-flex;align-items:flex-end;gap:2px;height:${u(36)};padding-bottom:1px;border-bottom:1px solid ${v('line')}}`,
    `${s} .mana-bars>i{display:block;width:${u(6)};min-height:1px;background:${v('ink')}}`,
    `${s} .mana-bars>i:last-child{background:${v('accent2')}}`,
    // why a disabled thing cannot be done: said under it while it has the focus or the pointer, and as it is pressed
    `${s} .mana-why{display:none;position:absolute;left:0;top:100%;z-index:3;margin-top:${u(3)};padding:${u(3)} ${u(9)};max-width:${u(360)};border:1px solid ${v('line')};background:${v('plate')};color:${v('ink')};font:400 ${t('caption')} ${v('font')};text-align:left;white-space:normal;text-transform:none;letter-spacing:0}`,
    `${s} :is([data-st=focus],[data-press^=deny])>.mana-why{display:block}`,
    `@media (hover:hover){${s} :hover>.mana-why{display:block}}`,
    `${s} :is(.mana-button,.mana-slot):has(>.mana-why){position:relative;overflow:visible}`,
    `${s} .mana-edges,${s} .mana-threat,${s} .mana-letterbox,${s} .mana-peril{position:absolute;inset:0;pointer-events:none}`,
    `${s} .mana-edge{position:absolute;transform:translate(-50%,-50%);font:700 ${t('body')} ${v('mono')};padding:${u(1.5)} ${u(7.5)};background:${v('plate')};border:${v('rule-w')} solid ${v('line')};border-radius:calc(${v('radius')}*.5)}`,
    `${s} .mana-threat{inset:auto;left:50%;top:50%;width:${u(360)};height:${u(360)};transform:translate(-50%,-50%);border:1px dashed ${v('soft')};border-radius:50%}`,
    // an arc of the ring where the harm came from, centred on its bearing and tapering to its ends; it fades as it ages
    `${s} .mana-threat{border-color:transparent}`,
    `${s} .mana-arc{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from -22deg,transparent,${v('harm')} 15deg 29deg,transparent 44deg);-webkit-mask:radial-gradient(closest-side,transparent 86%,${v('ink')} 88% 97%,transparent 99%);mask:radial-gradient(closest-side,transparent 86%,${v('ink')} 88% 97%,transparent 99%);transition:opacity ${v('glide')} linear;animation:mana-fade ${v('dur')} ease-out}`,
    // PERIL: the screen's own edges close in, tinted, as the danger rises; near the end they beat slowly
    `${s} .mana-peril{position:absolute;inset:0;pointer-events:none;opacity:${v('peril')};background:radial-gradient(ellipse 72% 68% at 50% 50%,transparent 46%,color-mix(in srgb,${v('harm')} 30%,transparent) 74%,color-mix(in srgb,${v('harm')} 72%,transparent));transition:opacity calc(${v('dur')} * 4) ease-out}`,
    `${s} .mana-peril[data-tone=cold]{background:radial-gradient(ellipse 72% 68% at 50% 50%,transparent 46%,color-mix(in srgb,${v('accent2')} 30%,transparent) 74%,color-mix(in srgb,${v('accent2')} 72%,transparent))}`,
    `${s} .mana-peril[data-high]{animation:mana-beat 1.1s ease-in-out infinite;animation-play-state:${v('loop')}}`,
    `${s}[data-flash=reduced] .mana-peril{animation:none}`,
    `${s} .mana-letterbox i{position:absolute;left:0;right:0;height:11%;background:${v('shade')}}`,
    `${s} .mana-letterbox i:first-child{top:0}`, `${s} .mana-letterbox i:last-child{bottom:0}`,
    // SCREEN EFFECTS (an \`effect\`): a layer over everything that catches nothing and is laid out alone (contain), its
    // pieces moved by transform and opacity only (the compositor's: no layout, no paint a frame), on their own clock
    // (the container's size as cqw / cqh, so a piece crosses the screen whatever its size)
    `${s} .mana-effect{position:absolute;inset:0;pointer-events:none;overflow:hidden;contain:strict;container-type:size;z-index:30}`,
    `${s} .mana-effect[data-idle=yes]{display:none}`,
    `${s} .mana-effect i{position:absolute;display:block;left:var(--x);top:0;background:var(--c);will-change:transform,opacity;animation:var(--fx-d) linear var(--t) both}`,
    `${s} .mana-effect[data-loop=yes] i{animation-iteration-count:infinite}`,
    // confetti: chips that flutter as they fall; from the top, popped from the centre, or fired up from the bottom
    `${s} .mana-effect[data-kind=confetti] i{width:calc(var(--s) * ${u(24)});height:calc(var(--s) * ${u(12)});border-radius:${u(3)};animation-name:mana-fx-fall;animation-timing-function:cubic-bezier(.3,.55,.55,1)}`,
    `${s} .mana-effect[data-kind=confetti][data-from=center] i{left:50%;top:50%;animation-name:mana-fx-pop;animation-timing-function:cubic-bezier(.15,.7,.4,1)}`,
    `${s} .mana-effect[data-kind=confetti][data-from=bottom] i{top:100%;animation-name:mana-fx-cannon;animation-timing-function:cubic-bezier(.12,.75,.45,1)}`,
    // streamers: long ribbons that swing as they come down, slower
    `${s} .mana-effect[data-kind=streamers] i{width:calc(var(--s) * ${u(11)});height:calc(var(--s) * ${u(120)});border-radius:${u(6)};animation-name:mana-fx-ribbon;animation-timing-function:cubic-bezier(.35,.4,.6,1)}`,
    // sparkles: four-pointed stars that open and close where they stand
    `${s} .mana-effect[data-kind=sparkles] i{top:var(--y);width:calc(var(--s) * ${u(48)});height:calc(var(--s) * ${u(48)});clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);animation-name:mana-fx-twinkle;animation-timing-function:ease-in-out}`,
    // burst: stars thrown out from the middle, fading as they go
    `${s} .mana-effect[data-kind=burst] i{left:50%;top:50%;width:calc(var(--s) * ${u(38)});height:calc(var(--s) * ${u(38)});clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);animation-name:mana-fx-burst;animation-timing-function:cubic-bezier(.1,.8,.3,1)}`,
    // petals: drifting across and down, turning
    `${s} .mana-effect[data-kind=petals] i{width:calc(var(--s) * ${u(28)});height:calc(var(--s) * ${u(17)});border-radius:50% 0 50% 0;animation-name:mana-fx-drift;animation-timing-function:ease-in-out}`,
    // flash: the whole screen lit once, out at once
    `${s} .mana-effect[data-kind=flash] i{inset:0;left:0;background:radial-gradient(circle at 50% 45%,${v('gleam')},color-mix(in srgb,${v('accent')} 55%,transparent) 70%);animation-name:mana-fx-flash;animation-timing-function:ease-out}`,
    // (less motion: the pieces stay home, and a flash, a fade, is all that plays)
    ...[`${s}[data-motion=reduced]`, `@media (prefers-reduced-motion:reduce){${s}`].map((at) => `${at.startsWith('@') ? `${at} ` : `${at} `}.mana-effect:not([data-kind=flash]) i{display:none}${at.startsWith('@') ? '}' : ''}`),
    `${s} .mana-touchpad{display:flex;justify-content:space-between;align-items:flex-end;width:min(${u(1770)},90cqw);padding:0 ${u(18)}}`,
    `${s} .mana-stick,${s} .mana-pad{pointer-events:auto;touch-action:none}`,
    `${s} .mana-stick{position:relative;width:${u(180)};height:${u(180)};border-radius:50%;border:2px solid ${v('line')};background:${v('plate')};opacity:.4}`,
    `${s} .mana-stick i{position:absolute;inset:${u(57)};border-radius:50%;background:${v('ink')};opacity:.5}`,
    // (the driver's word: a lane's stick is a bar, a stick under a thumb stands out where it rose, a pad pressed is filled)
    `${s} .mana-stick[data-lane]{height:${u(84)};border-radius:${u(42)}}`,
    `${s} .mana-stick[data-lane] i{inset:${u(9)} ${u(57)}}`,
    `${s} .mana-stick[data-held]{opacity:.75}`,
    `${s} .mana-pad[data-on]{background:${v('ink')};color:${v('panel')};opacity:1}`,
    // (the HUD's bottom corners stand over the pad, and over a hint line above it, while it is drawn: the stick and the
    // pads have the foot of the screen)
    `${s} .mana-hud:has(.mana-touchpad) .mana-place:is([data-at=bottom-left],[data-at=bottom-right]){bottom:calc(${SY} + ${u(288)})}`,
    // (the pads fill from the screen's edge inward and from its foot up: one pad is under the thumb, not a column in)
    `${s} .mana-pads{display:flex;flex-wrap:wrap-reverse;flex-direction:row-reverse;gap:${u(18)};max-width:${u(198)}}`,
    // (a pad's pictogram, where the theme draws them, stands inside its round: the pad keeps its edge and its fill)
    `${s} .mana-pad b{display:flex;align-items:center;justify-content:center;width:62%;height:62%;font-weight:inherit;white-space:nowrap}`,
    `${s} .mana-pad{display:flex;align-items:center;justify-content:center;width:${u(90)};height:${u(90)};border-radius:50%;border:2px solid ${v('line')};background:${v('plate')};font:700 ${t('body')} ${v('mono')};opacity:.85}`,
    // enemies: awareness as a glyph, statuses as boxes
    `${s} .mana-awareness{font-size:${t('caption')};text-transform:uppercase;letter-spacing:.06em;color:${v('mid')}}`,
    `${s} .mana-awareness b{display:inline-block;min-width:${u(24)};padding:0 2px;border:1px solid ${v('line')};color:${v('ink')};text-align:center;font:900 ${t('caption')}/1.3 ${v('mono')}}`,
    `${s} .mana-awareness[data-state=alert] b,${s} .mana-awareness[data-state=combat] b{background:${v('harm')};border-color:${v('harm')};color:${v('panel')}}`,
    `${s} .mana-awareness[data-state=unaware] b,${s} .mana-awareness[data-state=down] b{border-style:dashed}`,
    `${s} .mana-statuses{display:inline-flex;gap:2px}`,
    `${s} .mana-status{display:inline-block;padding:0 3px;border:${v('rule-w')} solid ${v('line')};font:700 ${u(14)}/1.4 ${v('mono')};background:${v('paper')}}`,
    `${s} .mana-status sub{font-size:${u(11)};margin-left:1px}`,
    ...MOTION_RULES(s),
  ].join('\n');
}

// ── motion ────────────────────────────────────────────────────────────────────────────────────────────────────────
// every travel, scale and delay a variable: under reduced motion they are zero and the fades are all that is left
const pop = (k) => `calc(1 + (${v('pop')} - 1) * ${k})`;
const KEYFRAMES = [
  `@keyframes mana-fade{from{opacity:0}}`,
  `@keyframes mana-rise{from{opacity:0;translate:${v('enter')}}}`,
  `@keyframes mana-slide{from{opacity:0;translate:calc(${v('travel')} * 2) 0}}`,
  `@keyframes mana-slam{0%{opacity:0;scale:${pop(3)}}60%{opacity:1}100%{scale:1}}`,
  `@keyframes mana-pop{from{scale:${pop(1)}}}`,
  `@keyframes mana-flash{from{background-color:${v('flash')};color:${v('panel')}}}`,
  `@keyframes mana-gain{0%{opacity:0}15%{opacity:1}100%{opacity:0;translate:0 calc(${v('travel')} * -2.4)}}`,
  `@keyframes mana-ring{from{opacity:1}to{opacity:0;scale:${pop(2.5)}}}`,
  `@keyframes mana-turn{50%{box-shadow:inset 9px 0 0 ${v('turn')},inset 0 0 0 2px ${v('turn')}}}`,
  `@keyframes mana-moved{from{opacity:.95}to{opacity:0}}`, `@keyframes mana-moved-dim{from{opacity:.3}to{opacity:0}}`,
  `@keyframes mana-runs{from{transform:translateX(-110%)}to{transform:translateX(300%)}}`,
  `@keyframes mana-sheen{from{transform:translateX(-120%) skewX(-20deg)}to{transform:translateX(320%) skewX(-20deg)}}`,
  // the focus lands: a small pop on the item the cursor moves to (the greybox's pop is 1: it lands still)
  `@keyframes mana-pick{from{translate:${v('snap-from')};scale:${pop(0.4)}}}`,
  // a prompt that waits for the player (press start): a slow breath, well under the 3 flashes a second XAG 118 allows
  `@keyframes mana-pulse{50%{opacity:.35}}`,
  // a shot: the magazine's figure kicks and settles (the greybox's pop and travel are nothing: it only changes)
  `@keyframes mana-kick{from{translate:0 calc(${v('travel')} * -.5);scale:${pop(0.6)}}}`,
  // near the end of something: the peril's edge beats, a little over once a second
  `@keyframes mana-beat{50%{opacity:calc(${v('peril')} * .62)}}`,
  // the screen effects' motions (the pieces' own numbers: --dx −1..1, --dy 0..1, --r a spin, set by the kernel's dice)
  '@keyframes mana-fx-fall{0%{transform:translate3d(0,-8cqh,0) rotate3d(1,.3,.2,0deg)}35%{transform:translate3d(calc(var(--dx) * 6cqw),30cqh,0) rotate3d(1,.3,.2,calc(var(--r) * .35))}70%{transform:translate3d(calc(var(--dx) * -4cqw),72cqh,0) rotate3d(1,.3,.2,calc(var(--r) * .7))}90%{opacity:1}100%{transform:translate3d(calc(var(--dx) * 10cqw),108cqh,0) rotate3d(1,.3,.2,var(--r));opacity:0}}',
  '@keyframes mana-fx-pop{0%{transform:translate3d(-50%,-50%,0) scale(.3)}28%{transform:translate3d(calc(var(--dx) * 46cqw),calc(-12cqh - var(--dy) * 34cqh),0) rotate3d(1,.3,.2,calc(var(--r) * .3)) scale(1)}85%{opacity:1}100%{transform:translate3d(calc(var(--dx) * 58cqw),62cqh,0) rotate3d(1,.3,.2,var(--r));opacity:0}}',
  '@keyframes mana-fx-cannon{0%{transform:translate3d(0,0,0) scale(.4)}34%{transform:translate3d(calc(var(--dx) * 22cqw),calc(-62cqh - var(--dy) * 32cqh),0) rotate3d(1,.3,.2,calc(var(--r) * .4)) scale(1)}85%{opacity:1}100%{transform:translate3d(calc(var(--dx) * 34cqw),-8cqh,0) rotate3d(1,.3,.2,var(--r));opacity:0}}',
  '@keyframes mana-fx-ribbon{0%{transform:translate3d(0,-14cqh,0) rotate(-18deg) skewX(0)}25%{transform:translate3d(calc(var(--dx) * 5cqw),20cqh,0) rotate(14deg) skewX(12deg)}50%{transform:translate3d(calc(var(--dx) * -4cqw),50cqh,0) rotate(-12deg) skewX(-12deg)}75%{transform:translate3d(calc(var(--dx) * 5cqw),80cqh,0) rotate(10deg) skewX(10deg)}90%{opacity:1}100%{transform:translate3d(0,112cqh,0) rotate(-8deg);opacity:0}}',
  '@keyframes mana-fx-twinkle{0%{transform:translate(-50%,-50%) scale(0) rotate(0);opacity:0}40%{transform:translate(-50%,-50%) scale(1) rotate(40deg);opacity:1}100%{transform:translate(-50%,-50%) scale(0) rotate(90deg);opacity:0}}',
  '@keyframes mana-fx-burst{0%{transform:translate3d(-50%,-50%,0) scale(.2);opacity:1}75%{opacity:1}100%{transform:translate3d(calc(var(--dx) * 46cqw - 50%),calc((var(--dy) * 2 - 1) * 46cqh - 50%),0) rotate(var(--r)) scale(1);opacity:0}}',
  '@keyframes mana-fx-drift{0%{transform:translate3d(-10cqw,-8cqh,0) rotate(0)}50%{transform:translate3d(calc(8cqw + var(--dx) * 8cqw),50cqh,0) rotate(calc(var(--r) * .5))}90%{opacity:1}100%{transform:translate3d(calc(20cqw + var(--dx) * 6cqw),108cqh,0) rotate(var(--r));opacity:0}}',
  '@keyframes mana-fx-flash{0%{opacity:.85}100%{opacity:0}}',
  // a load: the mark turns, an unknown load's sweep crosses its track, a tip fades in as it turns
  '@keyframes mana-spin{to{transform:rotate(1turn)}}',
  '@keyframes mana-sweep{from{transform:translateX(-100%)}to{transform:translateX(290%)}}',
  '@keyframes mana-tip{from{opacity:0}}',
  // LEAVING: faster than arriving, accelerating away, never bouncing; back the way it came, or out to its edge
  `@keyframes mana-leave{to{opacity:0;translate:calc(-.6 * ${v('travel')}) calc(1.6 * ${v('travel')});scale:calc(1 - (${v('pop')} - 1) * .2)}}`,
  `@keyframes mana-leave-edge{to{opacity:0;translate:calc(3 * ${v('travel')}) 0}}`,
  `@keyframes mana-leave-shrink{to{opacity:0;scale:calc(1 - (${v('pop')} - 1) * .8)}}`,
  // A PRESS IS SEEN: confirm squashes, flashes in the accent and throws a ring off; deny shakes on a harm edge (two names
  // each, alternated, so a second press plays again); less flash keeps the ring and the shake, never the fill
  ...['a', 'b'].flatMap((x) => [
    `@keyframes mana-confirm-${x}{0%{scale:calc(1 - (${v('pop')} - 1) * .4);background-color:${v('accent')};color:${v('panel')};box-shadow:0 0 0 0 ${v('accent')}}30%{scale:${pop(0.35)}}100%{box-shadow:0 0 0 calc(18 * ${v('du')}) transparent}}`,
    `@keyframes mana-press-${x}{0%{box-shadow:0 0 0 0 ${v('accent')}}100%{box-shadow:0 0 0 calc(18 * ${v('du')}) transparent}}`,
    `@keyframes mana-deny-${x}{0%,100%{translate:0 0}15%{translate:calc(-.8 * ${v('travel')}) 0;box-shadow:inset 0 0 0 2px ${v('harm')}}35%{translate:calc(.8 * ${v('travel')}) 0}55%{translate:calc(-.5 * ${v('travel')}) 0}75%{translate:calc(.25 * ${v('travel')}) 0;box-shadow:inset 0 0 0 2px ${v('harm')}}}`,
  ]),
  // a row that moved past others says which way, once: a lift as it rises, a dip as it falls
  `@keyframes mana-moved-up{0%{box-shadow:inset 0 0 0 2px ${v('accent2')}}40%{scale:${pop(0.5)}}}`,
  `@keyframes mana-moved-down{0%{box-shadow:inset 0 0 0 1px ${v('mid')};opacity:.7}}`,
  // the stage sweeps in from the side the screen leans from
  `@keyframes mana-stage{from{opacity:0;translate:calc(${v('travel')} * -8) 0}}`,
  // a blow's number: it pops in large, settles and rises off where it landed
  `@keyframes mana-hit{0%{opacity:0;scale:${pop(4)}}18%{opacity:1;scale:1}100%{opacity:1;translate:0 calc(${v('travel')} * -3)}}`,
  // a stamp: dropped from above the page onto it
  `@keyframes mana-stamp{0%{opacity:0;scale:${pop(5)}}70%{opacity:1}100%{opacity:1;scale:1}}`,
  // the transitions' covers (theme.js TRANSITIONS): each covers the stage in its middle and ends off it, so a cover
  // that has run leaves nothing drawn
  `@keyframes mana-tx-fade{0%{opacity:0}42%,58%{opacity:1}100%{opacity:0}}`,
  `@keyframes mana-tx-blur{0%{opacity:1;backdrop-filter:blur(0px)}50%{opacity:1;backdrop-filter:blur(14px)}100%{opacity:1;backdrop-filter:blur(0px)}}`,
  `@keyframes mana-tx-wipe{0%{opacity:1;translate:-101% 0}42%,58%{opacity:1;translate:0 0}100%{opacity:1;translate:101% 0}}`,
  `@keyframes mana-tx-slam{0%{opacity:1;translate:-120% 0}50%{opacity:1;translate:0 0}100%{opacity:1;translate:120% 0}}`,
  `@keyframes mana-tx-iris{0%{opacity:1;clip-path:circle(75% at 50% 50%)}100%{opacity:1;clip-path:circle(0% at 50% 50%)}}`,
  `@keyframes mana-tx-shutter{0%,25%{opacity:1;clip-path:inset(0 0 0 0)}100%{opacity:1;clip-path:inset(50% 0 50% 0)}}`,
];
// the prompt's breath: one cycle in PULSE seconds (0.8 Hz)
export const PULSE = 1.25;
const CALM = `--mana-travel:0px!important;--mana-pop:1!important;--mana-stagger:0ms!important;--mana-glide:0ms!important;--mana-loop:paused!important;--mana-sheen:0!important;--mana-tx:none!important;--mana-snap:0px!important;--mana-nudge:0px!important`;
// less flash (the player's, apart from less motion): no cover over the stage, no sheen, a change pops without flashing
const DIM = `--mana-sheen:0!important;--mana-tx:none!important`;
function MOTION_RULES(s) {
  const rows = `:is(.mana-list>.mana-row,.mana-grid>.mana-cell,.mana-each>*,.mana-table tbody tr,.mana-tier>.mana-node)`;
  return [
    ...KEYFRAMES,
    // the focus lands with a pop (at no weight at all: an entrance, a change's flash or a pulse on the same element wins)
    `${s} :where([data-st=focus]){animation:mana-pick calc(${v('dur')} * 1.2) ${v('ease')}}`,
    // ENTRANCES, in an order: the frame builds (the screen, its windows), its rows fill it in reading order after the
    // lead, each a stagger after the last (capped: a long list's tail lands together), and the cursor lands last. They
    // come from the side the screen sits on: a left menu from the left, a sheet from below
    `${s} .mana-screen{animation:mana-fade ${v('dur')} ease-out both}`,
    `${s} .mana-screen[data-place=left]{--mana-enter:calc(-3 * ${v('travel')}) 0}`, `${s} .mana-screen[data-place=right]{--mana-enter:calc(3 * ${v('travel')}) 0}`,
    `${s} .mana-screen[data-place=top]{--mana-enter:0 calc(-2 * ${v('travel')})}`, `${s} .mana-screen:is([data-place=bottom],[data-place=sheet]){--mana-enter:0 calc(4 * ${v('travel')})}`,
    // the lead word slams in first: a screen's own title
    `${s} .mana-screen>.mana-title{animation:mana-slam calc(${v('dur')} * 2) ${v('ease')} both}`,
    // (at the least weight a selector can have: a change's flash or a turn's breath on the same element wins)
    `${s} :where(.mana-screen .mana-window){animation:mana-rise calc(${v('dur')} * 1.3) ${v('ease')} both}`,
    `${s} :where(.mana-screen) :where(${rows.slice(4, -1)}){animation:mana-rise ${v('dur')} ${v('ease')} both;animation-delay:calc(${v('lead')} + var(--mana-i,0) * ${v('stagger')})}`,
    // a row the cursor lands on keeps its entrance and adds the pop (an animation already run is not run again)
    `${s} :where(.mana-screen) :where(${rows.slice(4, -1)})[data-st=focus]{animation:mana-rise ${v('dur')} ${v('ease')} both,mana-pick calc(${v('dur')} * 1.2) ${v('ease')};animation-delay:calc(${v('lead')} + var(--mana-i,0) * ${v('stagger')}),0ms}`,
    ...Array.from({ length: 10 }, (_, i) => `${s} ${rows}:nth-child(${i + 2}){--mana-i:${i + 1}}`),
    `${s} ${rows}:nth-child(n+12){--mana-i:11}`,
    // EXITS (the view keeps what leaves, data-leaving, until its exit has played): a screen sinks back the way it rose,
    // a toast slides out to its edge, a banner shrinks away; faster than they came, on the exit's curve
    `${s} [data-leaving]{pointer-events:none}`,
    `${s} .mana-screen[data-leaving]{z-index:3;animation:mana-leave calc(${v('dur')} * .7) ${v('out')} both}`,
    `${s} .mana-toast[data-leaving]{animation:mana-leave-edge calc(${v('dur')} * .7) ${v('out')} both}`,
    `${s} .mana-banner[data-leaving]{animation:mana-leave-shrink calc(${v('dur')} * .7) ${v('out')} both}`,
    // SHUFFLES: the view glides a row from where it was to where it is (by its data-id, on the glide); a row that moved
    // past others says which way
    `${s} [data-moved=up]{animation:mana-moved-up calc(${v('dur')} * 4) ease-out}`, `${s} [data-moved=down]{animation:mana-moved-down calc(${v('dur')} * 3) ease-out}`,
    // A PRESS: on what was pressed, after every other motion it has (it wins the element)
    ...['a', 'b'].flatMap((x) => [`${s} [data-press=accept-${x}]{animation:mana-confirm-${x} calc(${v('dur')} * 2.2) ease-out}`, `${s} [data-press=deny-${x}]{animation:mana-deny-${x} calc(${v('dur')} * 2) ease-out}`, `${s}[data-flash=reduced] [data-press=accept-${x}]{animation:mana-press-${x} calc(${v('dur')} * 2.2) ease-out}`]),
    // the moments: a banner slams, its sheen sweeps once; a toast slides in from its edge
    `${s} .mana-banner{position:relative;overflow:hidden;animation:mana-slam calc(${v('dur')} * 2) ${v('ease')} both}`,
    `${s} .mana-banner::after{content:"";position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,${v('panel')},transparent);opacity:${v('sheen')};pointer-events:none;animation:mana-sheen calc(${v('dur')} * 5) ease-in-out calc(${v('dur')} * 2) both}`,
    `${s} .mana-toast{animation:mana-slide calc(${v('dur')} * 1.5) ${v('ease')} both}`,
    // press start: the prompt breathes while it waits (a pulse the greybox holds still, as it holds every loop), no cursor
    `${s} .mana-screen[data-press=any] .mana-button{border-color:transparent;background:transparent;font-size:${ts(TYPE.title * 0.75)};font-weight:800;letter-spacing:.12em;text-transform:${v('case')};animation:mana-pulse ${PULSE}s ease-in-out infinite;animation-play-state:${v('loop')}}`,
    `${s} .mana-screen[data-press=any] .mana-button::before{content:none}`,
    // a load's activity mark turns and an unknown load's sweep runs whatever the theme's loops do: they are a signal,
    // not an ornament (turned by transform, so they keep moving while the page is busy); less motion breathes them
    `${s} .mana-spin{animation:mana-spin .8s linear infinite}`,
    `${s} .mana-track[data-known=no] .mana-sweep{animation:mana-sweep 1.4s ease-in-out infinite}`,
    `${s} .mana-tip{animation:mana-tip calc(${v('dur')} * 2) ease-out}`,
    ...[`${s}[data-motion=reduced]`, `@media (prefers-reduced-motion:reduce){${s}`].map((at) => `${at} .mana-spin,${at.startsWith('@') ? s : at} .mana-track[data-known=no] .mana-sweep{animation:mana-pulse ${PULSE}s ease-in-out infinite;transform:none}${at.startsWith('@') ? '}' : ''}`),
    `${s}[data-motion=reduced] .mana-track[data-known=no] .mana-sweep{width:100%}`, `@media (prefers-reduced-motion:reduce){${s} .mana-track[data-known=no] .mana-sweep{width:100%}}`,
    // a passing anchor (a damage number) rises and fades once from where it lands; its id is its element, so it replays
    `${s} .mana-anchors[data-pass=yes] .mana-anchor>*{animation:mana-gain calc(${v('dur')} * 6) ease-out both}`,
    // a bar and a dial glide to their new value
    `${s} .mana-track i{transition:width ${v('glide')} ${v('ease')}}`, `${s} .mana-dial i{transition:transform ${v('glide')} ${v('ease')}}`,
    // what changed says so once: a flash and a pop, its gain floating off (a new data-key replays it)
    `${s} [data-ch]{animation:mana-flash calc(${v('dur')} * 4) ease-out,mana-pop calc(${v('dur')} * 1.5) ${v('ease')}}`,
    `${s} .mana-num[data-ch],${s} .mana-glyphs[data-ch]{display:inline-block;position:relative}`,
    `${s} [data-ch=up]{--mana-flash:${v('accent2')}}`, `${s} [data-ch=down]{--mana-flash:${v('harm')}}`,
    `${s} .mana-gain{position:absolute;right:0;bottom:100%;text-decoration:none;font:700 ${t('caption')}/1 ${v('mono')};white-space:nowrap;pointer-events:none;animation:mana-gain calc(${v('dur')} * 8) ease-out both}`,
    `${s} .mana-badge[data-ch]{position:relative}`,
    // a fresh row and the last move: a ring that opens once (the last move keeps a dotted edge while it is the last)
    `${s} :is([data-fresh=yes],[data-last=yes]){position:relative}`,
    `${s} :is([data-fresh=yes],[data-last=yes])::after{content:"";position:absolute;inset:-2px;border:2px solid ${v('accent')};border-radius:inherit;pointer-events:none;animation:mana-ring calc(${v('dur')} * 4) ease-out both}`,
    `${s} [data-last=yes]:not([data-st=focus]){outline:2px dotted ${v('accent2')};outline-offset:-3px}`,
    // whose turn: a thick bar at the edge in that side's colour, breathing (still under reduced motion: the bar stays)
    `${s} [data-turn]{box-shadow:inset 6px 0 0 ${v('turn')},inset 0 0 0 1px ${v('turn')};animation:mana-turn 1.6s ease-in-out infinite;animation-play-state:${v('loop')}}`,
    ...Array.from({ length: 8 }, (_, k) => `${s} [data-turn="${k}"]{--mana-turn:${v(`side-${k}`)}}`),
    `${s} .mana-table tr[data-turn]{box-shadow:none;animation:none}`, `${s} .mana-table tr[data-turn]>td:first-child{box-shadow:inset 6px 0 0 ${v('turn')}}`,
    `${s} .mana-badge[data-turn]{padding-left:9px}`, `${s} .mana-badge[data-turn]::before{content:"\\25B8 "}`,
    // the game's clock held (a hit-stop): the HUD's motion holds with it; less motion: the fades are all that is left
    `${s}[data-clock=held] .mana-hud,${s}[data-clock=held] .mana-hud *,${s}[data-clock=held] .mana-hud *::after{animation-play-state:paused!important}`,
    `${s}[data-motion=reduced]{${CALM}}`,
    `${s}[data-flash=reduced]{${DIM}}`,
    `${s}[data-flash=reduced] [data-ch]{animation:mana-pop calc(${v('dur')} * 1.5) ${v('ease')}}`,
    `@media (prefers-reduced-motion:reduce){${s}{${CALM}}}`,
  ];
}

/** The board's frames: a 1280×720 stage scaled into a 16:9 box, over a crossed "world" wash. */
export const FRAME_CSS = [
  '.mana-frame{position:relative;aspect-ratio:16/9;width:100%;overflow:hidden;border:1px solid #111;background:#d9d9d9 repeating-linear-gradient(45deg,transparent 0 22px,rgba(0,0,0,.05) 22px 23px)}',
  '.mana-stage{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0}',
  '.mana-stage .mana-root{position:absolute}',
  '.mana-frame[data-live=yes]{outline:3px solid #111;outline-offset:2px}',
  '.mana-frame[data-device=phone]{aspect-ratio:390/844;max-width:300px;margin:0 auto;border:6px solid #111;border-radius:30px}',
  '.mana-stage[data-device=phone]{width:390px;height:844px}',
].join('\n');

/**
 * THE LENS'S SHEET (a spec's `lens`, kernel.js): its own scope, its root laid over the world's canvas and NEVER made a
 * stacking context of its own (no z-index, no contain, no container-type, no opacity, transform or filter on it): a
 * region inside it filters the world's own pixels only while nothing between it and the canvas isolates it (the
 * reactive layer's finding, scripts/spikes/reactive-layer/FINDINGS.md). The HUD's root, raised over it, stays its own.
 *
 * A STRIKE is a ring-shaped region round a still figure (a turn-based fight's): its element the band's size (a region filters only its own
 * area: the cost is the band's), its mask's hole the figure's body (r: the world draws on the body itself; the lens bends
 * only the air round it), its motion transform and opacity alone. Its kinds:
 *   ring    the air round it bent and lit, a band that opens out as it fades (the default)
 *   lift    the air round it lit and saturated, fading
 *   shade   the air round it darkened and drained, so the figure stands out of it, fading
 *   ink     the air round it to its negative for a beat, then gone (an impact frame round the figure; a lift under less flash)
 *
 *   lensCss(scope?) → the lens's rules (default scope `.mana-lens`)
 */
export function lensCss(scope = '.mana-lens') {
  const s = scope, BF = (f) => `backdrop-filter:${f};-webkit-backdrop-filter:${f}`;
  const hole = 'radial-gradient(closest-side,transparent 0 40%,#000 47% 68%,transparent 100%)';
  return [
    `${s}{position:absolute;inset:0;pointer-events:none;overflow:hidden}`,
    `${s} .mana-strike{position:absolute;inset:0;pointer-events:none}`,
    // (2.4 times the body's radius each way: the hole the body, the band the air out to its edge)
    `${s} .mana-struck{position:absolute;height:calc(var(--r) * 480%);aspect-ratio:1;translate:-50% -50%;border-radius:50%;-webkit-mask:${hole};mask:${hole};will-change:opacity,scale;animation:mana-lens-fade var(--d) ease-out both}`,
    `${s} .mana-struck[data-kind=ring]{${BF('blur(calc(2px + var(--p) * 3px)) brightness(1.32) saturate(1.35)')};animation-name:mana-lens-ring}`,
    `${s} .mana-struck[data-kind=lift]{${BF('brightness(calc(1.15 + var(--p) * .35)) saturate(1.75)')}}`,
    `${s} .mana-struck[data-kind=shade]{${BF('brightness(calc(.78 - var(--p) * .28)) saturate(.5)')}}`,
    `${s} .mana-struck[data-kind=ink]{${BF('grayscale(1) invert(1) contrast(1.25)')};animation-name:mana-lens-ink;animation-timing-function:linear}`,
    // (less flash: an impact frame is a lift; less motion: nothing opens out, it fades where it is; a held clock holds it)
    `${s}[data-flash=reduced] .mana-struck[data-kind=ink]{${BF('brightness(1.25) saturate(1.5)')};animation-name:mana-lens-fade;animation-timing-function:ease-out}`,
    `${s}[data-motion=reduced] .mana-struck{animation-name:mana-lens-fade}`,
    `@media (prefers-reduced-motion:reduce){${s} .mana-struck{animation-name:mana-lens-fade}}`,
    `${s}[data-clock=held] .mana-struck{animation-play-state:paused}`,
    '@keyframes mana-lens-fade{0%{opacity:1}100%{opacity:0}}',
    '@keyframes mana-lens-ring{0%{scale:.62;opacity:1}100%{scale:1.22;opacity:0}}',
    '@keyframes mana-lens-ink{0%,52%{opacity:1}53%,100%{opacity:0}}',
  ].join('\n');
}
