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
export const GREYBOX_VARS = Object.freeze({
  ink: '#111111', mid: '#6b6b6b', soft: '#bdbdbd', line: '#111111', panel: '#fafafa', paper: '#fafafa', wash: '#ececec',
  scrim: 'rgba(255,255,255,.72)', shade: '#000000',
  // the sides' kits (a team, a seat, a lane): greys in the greybox, told apart by their names and by shade
  'side-0': '#111111', 'side-1': '#8a8a8a', 'side-2': '#4a4a4a', 'side-3': '#b5b5b5', 'side-4': '#2a2a2a', 'side-5': '#6b6b6b', 'side-6': '#9e9e9e', 'side-7': '#3c3c3c', accent: '#111111', accent2: '#111111', 'focus-ink': '#111111',
  hp: '#111111', mp: '#111111', xp: '#111111', stamina: '#111111', shield: '#111111', boss: '#111111', plain: '#111111', harm: '#111111',
  font: 'system-ui,-apple-system,"Segoe UI",sans-serif', display: 'system-ui,-apple-system,"Segoe UI",sans-serif', mono: 'ui-monospace,Menlo,Consolas,monospace',
  scale: '1', case: 'uppercase', radius: '0px', 'frame-w': '1px', 'frame-s': 'solid', plate: '#fafafa', motion: 'none',
  // THE FRAME: a length is in units of 1px at a 1080p reference (u: the stage's height over 1080, or a phone's CSS px),
  // times the distance's factor (k) — du — so a screen keeps its proportions at any resolution and grows for a couch;
  // text never goes under `min` (CSS px), and the player's text size (`text`, rt.textScale) multiplies it; `safe` is the
  // title-safe inset a side (90% title-safe), the frame a screen and the HUD's places sit in
  ...DISTANCES.desk, du: 'calc(var(--mana-u) * var(--mana-k))', text: '1', safe: '.05',
  target: 'calc(45 * var(--mana-du))',
  // text that has no window behind it keeps a halo in the panel's colour; the subtitles' plate (rt.subtitlePlate)
  halo: HALOS.outline, 'sub-plate': '.82',
  // the focus: the ▶ (a shape, never a colour alone) and the room it keeps at an item's left (mark 0: none)
  cursor: '"\\25B6"', mark: '1',
  // the lean of tabs, bars, banners, keys and buttons (theme.js SLANTS); the rule an inner part is drawn with
  slant: '0deg', 'rule-w': '1px',
  // a screen giving way to the next: the cover's animation (none: the screen fades) and its timing (theme.js TRANSITIONS)
  tx: 'none', 'tx-ease': 'ease-in-out',
  // layers: the filter over the stage (a theme's overlay), and a title's hollow echo behind it (a theme's breakout)
  overlay: 'none', 'echo-ink': 'var(--mana-accent)',
  // how things move (theme.js MOTIONS): the greybox fades and travels nowhere
  dur: '160ms', ease: 'ease-out', travel: '0px', pop: '1', stagger: '0ms', glide: '0ms', loop: 'paused', sheen: '0', i: '0',
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
export const TYPE = Object.freeze({ caption: 18, label: 18, body: 22, heading: 22, numeral: 22, title: 44, display: 84 });
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
    // key art behind a screen (a title, an attract loop): the whole stage, under everything the screen holds
    `${s} .mana-screen>.mana-image[data-ratio=backdrop]{position:absolute;inset:0;z-index:-1;aspect-ratio:auto;border:0;border-radius:0;padding:${u(12)}}`,
    // the legend bar: what the buttons do here, pinned to the foot of the safe frame, right-aligned (a console's prompt bar)
    `${s} .mana-screen>.mana-legend{position:absolute;right:${safe('right', SX)};bottom:${safe('bottom', SY)};z-index:2;justify-content:flex-end;max-width:calc(100% - 2 * ${SX})}`,
    `${s} .mana-screen:has(>.mana-legend):not([data-place=sheet]){padding-bottom:calc(${safe('bottom', SY)} + ${u(60)})}`,
    // the lean: tabs, bars, banners, keys and buttons skew (never a window: what a screen holds stays square)
    `${s} :is(.mana-tablabel,.mana-banner,.mana-key,.mana-button,.mana-track,.mana-badge){transform:skewX(${v('slant')})}`,
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
    // the overlay: a filter over the whole stage while the UI is up (scanlines, a grid, a vignette, grain), over the cover
    `${s}:is([data-hud=yes],:not([data-open=none]))::after{content:"";position:absolute;inset:0;z-index:10;pointer-events:none;background:${v('overlay')}}`,
    // the echo: a screen's title and a display's words drawn again behind them, huge and hollow, breaking past the box
    `${s} :is(.mana-screen>.mana-title,.mana-text[data-role=display]){position:relative}`,
    `${s} :is(.mana-screen>.mana-title,.mana-text[data-role=display])::before{content:none;position:absolute;left:-.3em;top:50%;translate:0 -52%;z-index:-1;font-size:2.6em;line-height:1;white-space:nowrap;color:transparent;-webkit-text-stroke:2px ${v('echo-ink')};opacity:.45;pointer-events:none;text-shadow:none}`,
    // panels and layout
    `${s} .mana-window{position:relative;background:${v('plate')};border:${v('frame-w')} ${v('frame-s')} ${v('line')};border-radius:${v('radius')};padding:${u(15)} ${u(18)};min-width:${u(300)};max-width:100%;min-height:0;overflow:hidden}`,
    // a window inside a window is a sub-panel: a lighter rule and a smaller corner than the panel it sits in
    `${s} .mana-window .mana-window:not([data-variant=ghost]){border-width:${v('rule-w')};border-radius:calc(${v('radius')} * .6);padding:${u(9)} ${u(12)}}`,
    `${s} .mana-window[data-variant=inset]{border-style:dashed}`,
    `${s} .mana-window[data-variant=ghost]{background:transparent;border-color:transparent;padding:0}`,
    `${s} .mana-stack{display:flex;flex-direction:column;gap:${u(12)};min-width:0}`,
    `${s} .mana-stack[data-dir=row]{flex-direction:row;align-items:center}`,
    `${s} .mana-stack[data-gap=tight]{gap:${u(4)}}`, `${s} .mana-stack[data-gap=loose]{gap:${u(28)}}`,
    `${s} .mana-stack[data-align=start]{align-items:flex-start}`, `${s} .mana-stack[data-align=center]{align-items:center}`,
    `${s} .mana-stack[data-align=end]{align-items:flex-end}`, `${s} .mana-stack[data-align=apart]{justify-content:space-between}`,
    `${s} .mana-split{display:grid;grid-template-columns:minmax(${u(270)},1fr) 2fr;gap:${u(18)};width:100%;align-items:stretch;min-height:0}`,
    `${s} .mana-screen>.mana-bar,${s} .mana-screen>.mana-counter{max-width:${u(780)}}`,
    `${s} .mana-split[data-ratio=even]{grid-template-columns:1fr 1fr}`, `${s} .mana-split[data-ratio=wide]{grid-template-columns:2fr 1fr}`,
    `@container (max-width:640px){${s} :is(.mana-split,.mana-split[data-ratio]){grid-template-columns:1fr}${s} .mana-screen{gap:${u(12)}}${s} .mana-grid{grid-template-columns:repeat(auto-fill,minmax(${u(114)},1fr))}${s} .mana-window{min-width:0}${s} .mana-bar[data-variant=boss]{min-width:0}${s} .mana-tabstrip{overflow-x:auto}${s} .mana-tree{grid-template-columns:repeat(var(--cols,1),minmax(${u(144)},1fr));overflow-x:auto}}`,
    `${s} .mana-each{display:flex;flex-direction:column;gap:${u(4)};min-width:0}`, `${s} .mana-each[data-dir=row]{flex-direction:row;flex-wrap:wrap;gap:${u(18)}}`,
    `${s} .mana-each[data-dir=row]>.mana-window{flex:1;min-width:${u(270)}}`,
    `${s} .mana-stack[data-fill=yes]{width:${u(1650)};max-width:100%}`, `${s} .mana-stack[data-fill=yes]>.mana-stack{flex:1;min-width:0}`,
    `${s} .mana-divider{display:flex;align-items:center;gap:${u(12)};border-top:1px solid ${v('soft')};padding-top:${u(6)};margin-top:${u(6)}}`,
    `${s} .mana-tabstrip{display:flex;gap:${u(3)};margin-bottom:${u(15)};border-bottom:1px solid ${v('line')}}`,
    `${s} .mana-tablabel{padding:${u(6)} ${u(18)};cursor:pointer;font-size:${t('heading')};font-weight:700;letter-spacing:.08em;text-transform:${v('case')};color:${v('mid')};border:1px solid transparent;border-bottom:0;margin-bottom:-1px;border-radius:${v('radius')} ${v('radius')} 0 0}`,
    `${s} .mana-tablabel[data-st=active]{color:${v('ink')};background:${v('panel')};border-color:${v('line')};font-weight:800}`,
    // what can be focused: ▶ is the focus; a bar at the edge the active row; a dashed line disabled
    `${all('')}{position:relative;min-height:${v('target')};padding:${u(9)} ${u(15)} ${u(9)} ${pl(15)};border:1px solid transparent;border-radius:calc(${v('radius')}*.6);cursor:pointer;transition:${v('motion')};touch-action:manipulation;user-select:none}`,
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
    // two fighters' bars, sharing a row across the top: the thickest on the screen (a fight is read off them)
    `${s} .mana-stack[data-fill=yes] .mana-bar[data-variant=hp] .mana-track{height:${u(30)}}`,
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
    // the subtitles: their own plate, its opacity the player's (XAG 104), at a size read from a sofa
    `${s} .mana-place>.mana-region[data-variant=subtitles]{background:color-mix(in srgb,${v('panel')} calc(${v('sub-plate')} * 100%),transparent);border:0;opacity:1;text-align:center;font-size:${ts(36)}}`,
    `${s} .mana-anchors{position:absolute;inset:0}`,
    `${s} .mana-anchor{position:absolute;transform:translate(-50%,-100%)}`,
    // what floats over the world carries its own plate: the world behind it can be any colour
    `${s} .mana-anchor>*{background:${v('plate')};border-radius:calc(${v('radius')}*.5);padding:${u(3)} ${u(8)};opacity:.94}`,
    // bare over the world, the aim keeps a halo in the panel's colour so it reads over any scene
    `${s} .mana-reticle{position:relative;font:300 ${u(39)}/1 ${v('mono')};text-align:center;text-shadow:0 0 2px ${v('panel')},0 0 3px ${v('panel')},0 0 1px ${v('panel')}}`,
    `${s} .mana-hit{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:${u(51)};font-weight:200}`,
    `${s} .mana-minimap{position:relative;width:${u(195)};height:${u(195)};border:${v('rule-w')} solid ${v('line')};background:${X_BOX} ${v('paper')}}`,
    `${s} .mana-minimap[data-shape=round]{border-radius:50%}`,
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
    `${s} .mana-track u{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(-45deg,${v('ink')} 0 1px,transparent 1px 3px);opacity:.55}`,
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
    `${s} .mana-edges,${s} .mana-threat,${s} .mana-letterbox{position:absolute;inset:0;pointer-events:none}`,
    `${s} .mana-edge{position:absolute;transform:translate(-50%,-50%);font:700 ${t('body')} ${v('mono')};padding:${u(1.5)} ${u(7.5)};background:${v('plate')};border:${v('rule-w')} solid ${v('line')};border-radius:calc(${v('radius')}*.5)}`,
    `${s} .mana-threat{inset:auto;left:50%;top:50%;width:${u(360)};height:${u(360)};transform:translate(-50%,-50%);border:1px dashed ${v('soft')};border-radius:50%}`,
    `${s} .mana-arc{position:absolute;font-size:${u(33)};line-height:1;color:${v('harm')}}`,
    `${s} .mana-letterbox i{position:absolute;left:0;right:0;height:11%;background:${v('shade')}}`,
    `${s} .mana-letterbox i:first-child{top:0}`, `${s} .mana-letterbox i:last-child{bottom:0}`,
    `${s} .mana-touchpad{display:flex;justify-content:space-between;align-items:flex-end;width:${u(1770)};max-width:100%;padding:0 ${u(18)}}`,
    `${s} .mana-stick,${s} .mana-pad{pointer-events:auto;touch-action:none}`,
    `${s} .mana-stick{position:relative;width:${u(180)};height:${u(180)};border-radius:50%;border:2px solid ${v('line')};background:${v('plate')};opacity:.85}`,
    `${s} .mana-stick i{position:absolute;inset:${u(57)};border-radius:50%;background:${v('ink')};opacity:.5}`,
    `${s} .mana-pads{display:grid;grid-template-columns:repeat(2,${u(90)});gap:${u(18)}}`,
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
  `@keyframes mana-rise{from{opacity:0;translate:0 ${v('travel')}}}`,
  `@keyframes mana-slide{from{opacity:0;translate:calc(${v('travel')} * 2) 0}}`,
  `@keyframes mana-slam{0%{opacity:0;scale:${pop(3)}}60%{opacity:1}100%{scale:1}}`,
  `@keyframes mana-pop{from{scale:${pop(1)}}}`,
  `@keyframes mana-flash{from{background-color:${v('flash')};color:${v('panel')}}}`,
  `@keyframes mana-gain{0%{opacity:0}15%{opacity:1}100%{opacity:0;translate:0 calc(${v('travel')} * -2.4)}}`,
  `@keyframes mana-ring{from{opacity:1}to{opacity:0;scale:${pop(2.5)}}}`,
  `@keyframes mana-turn{50%{box-shadow:inset 9px 0 0 ${v('turn')},inset 0 0 0 2px ${v('turn')}}}`,
  `@keyframes mana-sheen{from{transform:translateX(-120%) skewX(-20deg)}to{transform:translateX(320%) skewX(-20deg)}}`,
  // the focus lands: a small pop on the item the cursor moves to (the greybox's pop is 1: it lands still)
  `@keyframes mana-pick{from{scale:${pop(0.4)}}}`,
  // a prompt that waits for the player (press start): a slow breath, well under the 3 flashes a second XAG 118 allows
  `@keyframes mana-pulse{50%{opacity:.35}}`,
  // a blow's number: it pops in large, settles and rises off where it landed
  `@keyframes mana-hit{0%{opacity:0;scale:${pop(4)}}18%{opacity:1;scale:1}100%{opacity:1;translate:0 calc(${v('travel')} * -3)}}`,
  // a stamp: dropped from above the page onto it
  `@keyframes mana-stamp{0%{opacity:0;scale:${pop(5)}}70%{opacity:1}100%{opacity:1;scale:1}}`,
  // the transitions' covers (theme.js TRANSITIONS): each covers the stage in its middle and ends off it, so a cover
  // that has run leaves nothing drawn
  `@keyframes mana-tx-wipe{0%{opacity:1;translate:-101% 0}42%,58%{opacity:1;translate:0 0}100%{opacity:1;translate:101% 0}}`,
  `@keyframes mana-tx-slam{0%{opacity:1;translate:-120% 0}50%{opacity:1;translate:0 0}100%{opacity:1;translate:120% 0}}`,
  `@keyframes mana-tx-iris{0%{opacity:1;clip-path:circle(75% at 50% 50%)}100%{opacity:1;clip-path:circle(0% at 50% 50%)}}`,
  `@keyframes mana-tx-shutter{0%,25%{opacity:1;clip-path:inset(0 0 0 0)}100%{opacity:1;clip-path:inset(50% 0 50% 0)}}`,
];
// the prompt's breath: one cycle in PULSE seconds (0.8 Hz)
export const PULSE = 1.25;
const CALM = `--mana-travel:0px!important;--mana-pop:1!important;--mana-stagger:0ms!important;--mana-glide:0ms!important;--mana-loop:paused!important;--mana-sheen:0!important;--mana-tx:none!important`;
// less flash (the player's, apart from less motion): no cover over the stage, no sheen, a change pops without flashing
const DIM = `--mana-sheen:0!important;--mana-tx:none!important`;
function MOTION_RULES(s) {
  const rows = `:is(.mana-list>.mana-row,.mana-grid>.mana-cell,.mana-each>*,.mana-table tbody tr,.mana-tier>.mana-node)`;
  return [
    ...KEYFRAMES,
    // the focus lands with a pop (at no weight at all: an entrance, a change's flash or a pulse on the same element wins)
    `${s} :where([data-st=focus]){animation:mana-pick calc(${v('dur')} * 1.2) ${v('ease')}}`,
    // entrances: a screen fades in, its windows and rows rise, staggered by their place
    `${s} .mana-screen{animation:mana-fade ${v('dur')} ease-out both}`,
    // (at the least weight a selector can have: a change's flash or a turn's breath on the same element wins)
    `${s} :where(.mana-screen .mana-window){animation:mana-rise calc(${v('dur')} * 1.3) ${v('ease')} both}`,
    `${s} :where(.mana-screen) :where(${rows.slice(4, -1)}){animation:mana-rise ${v('dur')} ${v('ease')} both;animation-delay:calc(var(--mana-i,0) * ${v('stagger')})}`,
    // a row the cursor lands on keeps its entrance and adds the pop (an animation already run is not run again)
    `${s} :where(.mana-screen) :where(${rows.slice(4, -1)})[data-st=focus]{animation:mana-rise ${v('dur')} ${v('ease')} both,mana-pick calc(${v('dur')} * 1.2) ${v('ease')};animation-delay:calc(var(--mana-i,0) * ${v('stagger')}),0ms}`,
    ...Array.from({ length: 10 }, (_, i) => `${s} ${rows}:nth-child(${i + 2}){--mana-i:${i + 1}}`),
    `${s} ${rows}:nth-child(n+12){--mana-i:11}`,
    // the moments: a banner slams, its sheen sweeps once; a toast slides in from its edge
    `${s} .mana-banner{position:relative;overflow:hidden;animation:mana-slam calc(${v('dur')} * 2) ${v('ease')} both}`,
    `${s} .mana-banner::after{content:"";position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,${v('panel')},transparent);opacity:${v('sheen')};pointer-events:none;animation:mana-sheen calc(${v('dur')} * 5) ease-in-out calc(${v('dur')} * 2) both}`,
    `${s} .mana-toast{animation:mana-slide calc(${v('dur')} * 1.5) ${v('ease')} both}`,
    // press start: the prompt breathes while it waits (a pulse the greybox holds still, as it holds every loop), no cursor
    `${s} .mana-screen[data-press=any] .mana-button{border-color:transparent;background:transparent;font-size:${ts(TYPE.title * 0.75)};font-weight:800;letter-spacing:.12em;text-transform:${v('case')};animation:mana-pulse ${PULSE}s ease-in-out infinite;animation-play-state:${v('loop')}}`,
    `${s} .mana-screen[data-press=any] .mana-button::before{content:none}`,
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
