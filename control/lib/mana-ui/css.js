/**
 * MANA-UI's SHEET — the structure every component is drawn in, its look read from `--mana-*` variables whose defaults
 * are the GREYBOX: values only (black, white and greys), boxes, rules and placeholders, so a screen's structure and
 * behaviour are approved apart from its look (the UI direction's greybox, playscape/ui/direction.js, is the precedent).
 * A theme (theme.js) is a separate layer: it sets the variables and adds a few rules of its own, from closed words; it
 * never reaches into the structure.
 *
 * Values first, so the black-and-white law holds by construction under any theme: focus is a shape (a ring round what
 * is in focus; a theme may make it a lift, a fill, a glow, brackets or the classic ▶), the active row a bar at its edge,
 * disabled a dashed outline; bar variants differ by PATTERN (hp solid, mp
 * hatched, xp dotted, stamina striped, shield checked, boss solid with phase ticks), a low bar cross-hatched; a better
 * compare is ▲; an enemy's awareness is a glyph; placeholders (an image, a portrait, a minimap) are crossed boxes.
 *
 *   GREYBOX_VARS        the variables and their greybox values (what a theme sets)
 *   manaCss(scope?)     the sheet, every rule under `scope` (default `.mana-root`), the greybox's values as defaults
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
import { contrast } from './theme.js';
export const GREYBOX_VARS = Object.freeze({
  ink: '#111111', mid: '#6b6b6b', soft: '#bdbdbd', line: '#111111', panel: '#fafafa', paper: '#fafafa', wash: '#ececec',
  scrim: 'rgba(255,255,255,.72)', shade: '#000000',
  // the sides' kits (a team, a seat, a lane): greys in the greybox, told apart by their names and by shade
  'side-0': '#111111', 'side-1': '#8a8a8a', 'side-2': '#4a4a4a', 'side-3': '#b5b5b5', 'side-4': '#2a2a2a', 'side-5': '#6b6b6b', 'side-6': '#9e9e9e', 'side-7': '#3c3c3c', accent: '#111111', accent2: '#111111', 'focus-ink': '#111111',
  hp: '#111111', mp: '#111111', xp: '#111111', stamina: '#111111', shield: '#111111', boss: '#111111', plain: '#111111', harm: '#111111',
  font: 'system-ui,-apple-system,"Segoe UI",sans-serif', display: 'system-ui,-apple-system,"Segoe UI",sans-serif', mono: 'ui-monospace,Menlo,Consolas,monospace',
  scale: '1', case: 'uppercase', target: '30px', radius: '0px', 'frame-w': '1px', 'frame-s': 'solid', plate: '#fafafa', motion: 'none',
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
const f = (px) => `calc(${px}px*var(--mana-scale))`;
const X_BOX = `linear-gradient(to top right,transparent calc(50% - .5px),${v('soft')} calc(50% - .5px),${v('soft')} calc(50% + .5px),transparent calc(50% + .5px)),linear-gradient(to bottom right,transparent calc(50% - .5px),${v('soft')} calc(50% - .5px),${v('soft')} calc(50% + .5px),transparent calc(50% + .5px))`;
const FILL = {
  plain: v('plain'), hp: v('hp'), boss: v('boss'),
  mp: `repeating-linear-gradient(45deg,${v('mp')} 0 2px,transparent 2px 5px)`,
  xp: `radial-gradient(${v('xp')} 1.2px,transparent 1.4px) 0 0/5px 5px`,
  stamina: `repeating-linear-gradient(90deg,${v('stamina')} 0 3px,transparent 3px 5px)`,
  shield: `repeating-conic-gradient(${v('shield')} 0 25%,transparent 0 50%) 0 0/6px 6px`,
};
const FOCUSABLE = ['row', 'cell', 'node', 'button', 'toggle', 'cycler', 'slider', 'keybind', 'carousel', 'alloc'];

/** The sheet, scoped; the greybox's values as the variables' defaults. */
export function manaCss(scope = '.mana-root') {
  const s = scope, all = (sel) => FOCUSABLE.map((c) => `${s} .mana-${c}${sel}`).join(',');
  return [
    `${s}{${Object.entries(GREYBOX_VARS).map(([k, x]) => `--mana-${k}:${x}`).join(';')}}`,
    `${s}{position:fixed;inset:0;pointer-events:none;font-family:${v('font')};font-size:${f(14)};line-height:1.35;color:${v('ink')};z-index:40;container-type:size;-webkit-tap-highlight-color:transparent}`,
    `${s}[data-input=touch]{--mana-target:48px}`,
    `${s} *{box-sizing:border-box}`,
    // the stack: a screen dims what it covers (a modal), and sits where it says
    `${s} .mana-screen{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));pointer-events:auto;overflow:hidden}`,
    `${s} .mana-screen[data-layer=modal]{background:${v('scrim')}}`,
    `${s} .mana-screen[data-place=center]{align-items:center;justify-content:center}`,
    `${s} .mana-screen[data-place=left]{align-items:flex-start;justify-content:center}`,
    `${s} .mana-screen[data-place=right]{align-items:flex-end;justify-content:center}`,
    `${s} .mana-screen[data-place=top]{align-items:center;justify-content:flex-start}`,
    `${s} .mana-screen[data-place=bottom]{align-items:stretch;justify-content:flex-end}`,
    `${s} .mana-screen[data-place=full]{align-items:stretch;justify-content:flex-start}`,
    // the bottom sheet: a phone's menu, risen from the foot of the screen, its grabber a shape
    `${s} .mana-screen[data-place=sheet]{align-items:center;justify-content:flex-end;padding-bottom:0}`,
    `${s} .mana-screen[data-place=sheet]>.mana-window{width:min(560px,100%);border-bottom:0;border-radius:calc(${v('radius')} + 14px) calc(${v('radius')} + 14px) 0 0;padding-top:24px;padding-bottom:max(16px,env(safe-area-inset-bottom))}`,
    `${s} .mana-screen[data-place=sheet]>.mana-window::before{content:"";position:absolute;top:9px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:2px;background:${v('soft')}}`,
    `${s} .mana-screen[data-place=full]>:is(.mana-split,.mana-window,.mana-tabs){flex:1;min-height:0}`,
    // type roles
    `${s} .mana-title{margin:0;font-family:${v('display')};font-size:${f(22)};font-weight:800;letter-spacing:.06em;text-transform:${v('case')}}`,
    `${s} .mana-heading{margin:0 0 8px;font-size:${f(11)};font-weight:700;letter-spacing:.14em;text-transform:${v('case')};color:${v('mid')}}`,
    `${s} .mana-text[data-role=display]{font-family:${v('display')};font-size:${f(40)};font-weight:900;letter-spacing:.04em;text-transform:${v('case')};line-height:1.05}`,
    `${s} .mana-text[data-role=title]{font-family:${v('display')};font-size:${f(19)};font-weight:800}`,
    `${s} .mana-text[data-role=heading]{font-size:${f(11)};font-weight:700;letter-spacing:.12em;text-transform:${v('case')}}`,
    `${s} .mana-text[data-role=label],${s} .mana-label{font-size:${f(11)};color:${v('mid')}}`,
    `${s} .mana-text[data-role=caption],${s} .mana-caption{font-size:${f(10)};color:${v('mid')}}`,
    `${s} .mana-text[data-role=numeral],${s} .mana-num{font-variant-numeric:tabular-nums;font-family:${v('mono')};font-size:${f(12)}}`,
    // panels and layout
    `${s} .mana-window{position:relative;background:${v('plate')};border:${v('frame-w')} ${v('frame-s')} ${v('line')};border-radius:${v('radius')};padding:10px 12px;min-width:200px;max-width:100%;min-height:0;overflow:hidden}`,
    `${s} .mana-window[data-variant=inset]{border-style:dashed}`,
    `${s} .mana-window[data-variant=ghost]{background:transparent;border-color:transparent;padding:0}`,
    `${s} .mana-stack{display:flex;flex-direction:column;gap:8px;min-width:0}`,
    `${s} .mana-stack[data-dir=row]{flex-direction:row;align-items:center}`,
    `${s} .mana-stack[data-gap=tight]{gap:3px}`, `${s} .mana-stack[data-gap=loose]{gap:18px}`,
    `${s} .mana-stack[data-align=start]{align-items:flex-start}`, `${s} .mana-stack[data-align=center]{align-items:center}`,
    `${s} .mana-stack[data-align=end]{align-items:flex-end}`, `${s} .mana-stack[data-align=apart]{justify-content:space-between}`,
    `${s} .mana-split{display:grid;grid-template-columns:minmax(180px,1fr) 2fr;gap:12px;width:100%;align-items:stretch;min-height:0}`,
    `${s} .mana-screen>.mana-bar,${s} .mana-screen>.mana-counter{max-width:520px}`,
    `${s} .mana-split[data-ratio=even]{grid-template-columns:1fr 1fr}`, `${s} .mana-split[data-ratio=wide]{grid-template-columns:2fr 1fr}`,
    `@container (max-width:640px){${s} :is(.mana-split,.mana-split[data-ratio]){grid-template-columns:1fr}${s} .mana-screen{gap:8px}${s} .mana-grid{grid-template-columns:repeat(auto-fill,minmax(76px,1fr))}${s} .mana-window{min-width:0}${s} .mana-bar[data-variant=boss]{min-width:0}${s} .mana-tabstrip{overflow-x:auto}${s} .mana-tree{grid-template-columns:repeat(var(--cols,1),minmax(96px,1fr));overflow-x:auto}}`,
    `${s} .mana-each{display:flex;flex-direction:column;gap:3px;min-width:0}`, `${s} .mana-each[data-dir=row]{flex-direction:row;flex-wrap:wrap;gap:12px}`,
    `${s} .mana-each[data-dir=row]>.mana-window{flex:1;min-width:180px}`,
    `${s} .mana-stack[data-fill=yes]{width:1100px;max-width:100%}`, `${s} .mana-stack[data-fill=yes]>.mana-stack{flex:1;min-width:0}`,
    `${s} .mana-divider{display:flex;align-items:center;gap:8px;border-top:1px solid ${v('soft')};padding-top:4px;margin-top:4px}`,
    `${s} .mana-tabstrip{display:flex;gap:2px;margin-bottom:10px;border-bottom:1px solid ${v('line')}}`,
    `${s} .mana-tablabel{padding:4px 10px;cursor:pointer;font-size:${f(11)};letter-spacing:.1em;text-transform:${v('case')};color:${v('mid')};border:1px solid transparent;border-bottom:0;margin-bottom:-1px;border-radius:${v('radius')} ${v('radius')} 0 0}`,
    `${s} .mana-tablabel[data-st=active]{color:${v('ink')};background:${v('panel')};border-color:${v('line')};font-weight:700}`,
    // what can be focused: ▶ and a heavy rule are the focus; a bar at the edge the active row; a dashed line disabled
    `${all('')}{position:relative;min-height:${v('target')};padding:6px 10px;border:1px solid transparent;border-radius:calc(${v('radius')}*.6 + 3px);cursor:pointer;transition:${v('motion')};touch-action:manipulation;user-select:none}`,
    `${s} :is(.mana-row,.mana-cell):has(>.mana-chip){padding-left:20px}`,
    // the focus, a cursor (keys, a pad): a ring just inside its edge (a scrolling list never clips it), never moving
    // what it rings
    `${s} [data-st=focus]{outline:2px solid ${v('accent')};outline-offset:-2px;background:${v('wash')};color:${v('focus-ink')}}`,
    `${s} [data-st=active]{background:${v('wash')};box-shadow:inset 3px 0 0 ${v('accent2')}}`,
    // a finger or a mouse moves no cursor: what is tapped is selected (the tint stays), a press sinks, a mouse lights
    `${s}:is([data-input=touch],[data-input=mouse]) [data-st=focus]{outline:none}`,
    `${s}:is([data-input=touch],[data-input=mouse]) [data-st=focus]::before{content:none}`,
    `${s}:is([data-input=touch],[data-input=mouse]) [data-k]:active,${s} [data-tap]:active{transform:scale(.97)}`,
    `@media (hover:hover){${s}[data-input=mouse] [data-k]:hover:not([data-st=focus]):not([data-st=disabled]){background:${v('wash')}}}`,
    `${s} [data-tap]{cursor:pointer;pointer-events:auto;touch-action:manipulation}`,
    `${s} [data-st=disabled]{color:${v('mid')};border:1px dashed ${v('soft')};cursor:default}`,
    `${s} [data-seats]::after{content:"P" attr(data-seats);position:absolute;right:3px;top:2px;font:700 9px/1 ${v('mono')};padding:2px 3px;background:${v('accent')};color:${v('panel')}}`,
    `${s} .mana-button{display:flex;align-items:center;justify-content:center;border:1px solid ${v('line')};text-align:center;padding:6px 14px}`,
    `${s} .mana-list{display:flex;flex-direction:column;gap:2px;min-height:0;overflow:hidden}`,
    `${s} .mana-list[data-empty=yes],${s} .mana-grid[data-empty=yes]{padding:6px 8px;border:1px dashed ${v('soft')}}`,
    `${s} .mana-more{font-size:${f(10)};color:${v('mid')};text-align:center}`,
    `${s} .mana-grid{display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:4px}`,
    `${s} .mana-cell{border:1px solid ${v('soft')};min-height:34px;padding:4px 6px 4px 16px;font-size:${f(12)}}`,
    `${s} .mana-tree{display:grid;grid-template-columns:repeat(var(--cols,1),minmax(110px,1fr));gap:18px}`,
    `${s} .mana-tier{display:flex;flex-direction:column;gap:8px;justify-content:center}`,
    `${s} .mana-node{border:1px solid ${v('line')};font-size:${f(12)};background:${v('paper')}}`,
    `${s} .mana-node[data-state=learned]{background:${v('ink')};color:${v('panel')}}`,
    `${s} .mana-node[data-state=learned][data-st=focus]{background:${v('ink')};color:${v('panel')};opacity:.85}`,
    `${s} .mana-node[data-state=learned] :is(.mana-text,.mana-caption,.mana-label,.mana-req){color:inherit;opacity:.8}`,
    `${s} .mana-node[data-state=locked]{border-style:dashed;color:${v('mid')}}`,
    `${s} .mana-node[data-state=later]{border-style:dotted;color:${v('mid')}}`,
    `${s} .mana-req{display:block;font-size:${f(9)};color:${v('mid')}}`,
    `${s} .mana-node[data-state=learned] .mana-req{color:${v('soft')}}`,
    `${s} .mana-toggle,${s} .mana-cycler,${s} .mana-slider,${s} .mana-keybind,${s} .mana-alloc{display:flex;justify-content:space-between;align-items:center;gap:14px}`,
    `${s} .mana-toggle .mana-value{display:flex;align-items:center;gap:6px}`,
    // a switch: the knob's side is the state, the word beside it again
    `${s} .mana-switch{position:relative;display:inline-block;width:38px;height:22px;border-radius:11px;border:1px solid ${v('line')};background:${v('paper')};transition:${v('motion')}}`,
    `${s} .mana-switch i{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:${v('mid')};transition:${v('motion')}}`,
    `${s} .mana-toggle[data-on=yes] .mana-switch{background:${v('accent')};border-color:${v('accent')}}`,
    `${s} .mana-toggle[data-on=yes] .mana-switch i{left:19px;background:${v('panel')}}`,
    // a stepper's ends are its own targets (a tap on either turns it)
    `${s} .mana-cycler .mana-value{display:flex;align-items:center;gap:2px}`,
    `${s} .mana-step{display:inline-flex;align-items:center;justify-content:center;min-width:26px;min-height:calc(${v('target')} - 8px);border-radius:calc(${v('radius')}*.5 + 2px);color:${v('mid')};font-size:11px}`,
    `${s}[data-input=touch] .mana-step{min-width:40px;border:1px solid ${v('soft')}}`,
    `${s} .mana-now{min-width:5.5em;text-align:center}`,
    `${s} .mana-slider .mana-value{display:flex;align-items:center;gap:6px;min-width:120px}`,
    `${s} .mana-slider .mana-track{flex:1}`,
    `${s} .mana-allocator{display:flex;flex-direction:column;gap:3px;min-width:280px}`,
    `${s} .mana-alloc{display:grid;grid-template-columns:1fr 32px 14px 32px 34px}`,
    `${s} .mana-keys{display:flex;gap:4px}`,
    `${s} .mana-keybind[data-conflict=yes]{border-style:dashed;border-color:${v('harm')}}`, `${s} .mana-clash{font-size:${f(10)};color:${v('harm')}}`,
    `${s} .mana-key{display:inline-block;min-width:20px;padding:1px 5px;border:1px solid ${v('line')};border-bottom-width:2px;border-radius:calc(${v('radius')}*.5);font:700 ${f(10)}/1.3 ${v('mono')};text-align:center;text-transform:uppercase;background:${v('paper')}}`,
    `${s} .mana-carousel{display:grid;grid-template-columns:24px 1fr 24px;align-items:center;gap:6px;padding:8px 8px 18px}`,
    `${s} .mana-carousel .mana-dots{position:absolute;left:0;right:0;bottom:3px;text-align:center;font-size:9px;letter-spacing:2px}`,
    `${s} .mana-slide{min-width:0}`,
    `${s} .mana-mark{color:${v('mid')}}`,
    `${s} .mana-draft{font:700 ${f(20)}/1.2 ${v('mono')};letter-spacing:.12em;border-bottom:2px solid ${v('line')};padding:4px 2px;margin:6px 0;min-height:30px}`,
    `${s} .mana-textentry .mana-grid{--cols:10}`,
    `${s} .mana-textentry .mana-cell{min-height:24px;text-align:center;padding:2px 2px 2px 12px;font:600 ${f(12)} ${v('mono')}}`,
    // values
    `${s} .mana-stat{display:flex;justify-content:space-between;gap:12px}`,
    `${s} .mana-max{color:${v('mid')}}`,
    `${s} .mana-bar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:6px;font-size:${f(11)};min-width:150px}`,
    `${s} .mana-track{position:relative;display:block;height:8px;border:1px solid ${v('line')};background:${v('paper')};border-radius:calc(${v('radius')}*.4);overflow:hidden}`,
    `${s} .mana-track i{display:block;height:100%;background:${v('plain')}}`,
    ...Object.entries(FILL).map(([k, x]) => `${s} .mana-bar[data-variant=${k}] .mana-track i{background:${x}}`),
    `${s} .mana-bar[data-variant=boss]{min-width:460px}`,
    `${s} .mana-bar[data-variant=boss] .mana-track{height:12px}`,
    `${s} .mana-track b{position:absolute;top:-2px;bottom:-2px;width:1px;background:${v('line')};outline:1px solid ${v('paper')}}`,
    `${s} .mana-bar[data-low=yes] .mana-track i{background:repeating-linear-gradient(45deg,${v('harm')} 0 2px,transparent 2px 4px),repeating-linear-gradient(-45deg,${v('harm')} 0 2px,transparent 2px 4px)}`,
    `${s} .mana-pips .mana-glyphs{letter-spacing:2px;font-size:${f(15)}}`,
    `${s} .mana-pips,${s} .mana-counter,${s} .mana-timer{display:flex;align-items:center;gap:6px}`,
    `${s} .mana-compare{display:grid;grid-template-columns:1fr auto 14px auto;gap:6px;align-items:center}`,
    `${s} .mana-compare[data-way=better] .mana-mark,${s} .mana-compare[data-way=worse] .mana-mark{color:${v('ink')};font-weight:700}`,
    `${s} .mana-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid ${v('line')};border-radius:calc(${v('radius')}*.4);font:700 9px ${v('mono')};background:${v('paper')}}`,
    `${s} .mana-icon[data-size=s]{width:16px;height:16px;font-size:7px}`, `${s} .mana-icon[data-size=l]{width:40px;height:40px;font-size:12px}`,
    `${s} .mana-portrait{display:inline-flex;flex-direction:column;align-items:center;gap:2px}`,
    `${s} .mana-ph{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border:1px solid ${v('line')};border-radius:calc(${v('radius')}*.6);background:${X_BOX} ${v('paper')};font:700 13px ${v('mono')}}`,
    `${s} .mana-portrait[data-size=s] .mana-ph{width:28px;height:28px;font-size:9px}`, `${s} .mana-portrait[data-size=l] .mana-ph{width:84px;height:84px;font-size:18px}`,
    `${s} .mana-image{display:flex;align-items:flex-end;justify-content:center;border:1px solid ${v('line')};border-radius:calc(${v('radius')}*.6);background:${X_BOX} ${v('paper')};aspect-ratio:16/9;width:100%;padding:4px}`,
    `${s} .mana-image[data-ratio=square]{aspect-ratio:1}`, `${s} .mana-image[data-ratio=tall]{aspect-ratio:3/4}`, `${s} .mana-image[data-ratio=banner]{aspect-ratio:4/1}`,
    `${s} .mana-badge{display:inline-block;padding:0 5px;border:1px solid ${v('line')};border-radius:8px;font:700 ${f(10)}/1.5 ${v('mono')}}`,
    // a legend: what the buttons do here, each beside the glyph of the control in hand
    `${s} .mana-legend{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:${f(11)};color:${v('mid')}}`,
    `${s} .mana-hint{display:inline-flex;align-items:center;gap:5px}`,
    `${s} .mana-prompt{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid ${v('line')};border-radius:${v('radius')};background:${v('plate')}}`,
    // in-game: regions, anchors, aim, maps, feed, moments
    `${s} .mana-hud{position:absolute;inset:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);pointer-events:none}`,
    `${s} .mana-place,${s} .mana-screen>.mana-region{position:absolute;display:flex;flex-direction:column;gap:6px;padding:12px;max-width:40%}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region):is([data-at=top],[data-at=bottom]){max-width:92%}`,
    `${s} .mana-region,${s} .mana-tab{min-width:0}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=top-left]{top:0;left:0}`, `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=top]{top:0;left:50%;transform:translateX(-50%);align-items:center}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=top-right]{top:0;right:0;align-items:flex-end}`, `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=left]{top:50%;left:0;transform:translateY(-50%)}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=center]{top:50%;left:50%;transform:translate(-50%,-50%);align-items:center}`, `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=right]{top:50%;right:0;transform:translateY(-50%);align-items:flex-end}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=bottom-left]{bottom:0;left:0}`, `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=bottom]{bottom:0;left:50%;transform:translateX(-50%);align-items:center}`,
    `${s} :is(.mana-place,.mana-screen>.mana-region)[data-at=bottom-right]{bottom:0;right:0;align-items:flex-end}`,
    `${s} .mana-place>*,${s} .mana-screen>.mana-region>:not(.mana-window){background:${v('plate')};border:${v('frame-w')} ${v('frame-s')} ${v('line')};border-radius:${v('radius')};padding:5px 7px;opacity:.94}`,
    // the parts that are their own frame sit bare: the aim, a moment's banner, a phone's controls
    `${s} .mana-place>.mana-region:has(>:is(.mana-reticle,.mana-banner,.mana-touchpad,.mana-moments)){background:transparent;border:0;opacity:1;clip-path:none;box-shadow:none;outline:0}`,
    `${s} .mana-anchors{position:absolute;inset:0}`,
    `${s} .mana-anchor{position:absolute;transform:translate(-50%,-100%)}`,
    // what floats over the world carries its own plate: the world behind it can be any colour
    `${s} .mana-anchor>*{background:${v('plate')};border-radius:calc(${v('radius')}*.5);padding:2px 5px;opacity:.94}`,
    // a passing row (a damage number): bare over the world, its words haloed in the panel's colour as the aim is
    `${s} .mana-anchors[data-pass=yes] .mana-anchor>*{background:transparent;padding:0;opacity:1;font-weight:700;text-shadow:0 0 2px ${v('panel')},0 0 3px ${v('panel')},0 0 1px ${v('panel')};white-space:nowrap}`,
    // bare over the world, the aim keeps a halo in the panel's colour so it reads over any scene
    `${s} .mana-reticle{position:relative;font:300 26px/1 ${v('mono')};text-align:center;text-shadow:0 0 2px ${v('panel')},0 0 3px ${v('panel')},0 0 1px ${v('panel')}}`,
    `${s} .mana-hit{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:34px;font-weight:200}`,
    `${s} .mana-minimap{position:relative;width:130px;height:130px;border:1px solid ${v('line')};background:${X_BOX} ${v('paper')}}`,
    `${s} .mana-minimap[data-shape=round]{border-radius:50%}`,
    `${s} .mana-marker{position:absolute;transform:translate(-50%,-50%);font-size:11px;line-height:1}`,
    `${s} .mana-minimap .mana-caption{position:absolute;left:4px;bottom:2px}`,
    `${s} .mana-compass{position:relative;width:300px;height:22px;border:1px solid ${v('line')};background:${v('paper')};overflow:hidden}`,
    `${s} .mana-compass .mana-cardinal,${s} .mana-compass .mana-marker{position:absolute;top:50%;transform:translate(-50%,-50%);font:700 11px ${v('mono')}}`,
    `${s} .mana-needle{position:absolute;left:50%;top:-3px;transform:translateX(-50%);font-size:8px}`,
    `${s} .mana-feed{display:flex;flex-direction:column;gap:2px;font-size:${f(11)};min-width:160px}`,
    `${s} .mana-toast{padding:4px 10px;border:1px solid ${v('line')};background:${v('plate')};font-size:${f(12)}}`,
    `${s} .mana-banner{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 24px;border-top:2px solid ${v('line')};border-bottom:2px solid ${v('line')};background:${v('plate')}}`,
    // the moments: one up at a time, the weightiest the boldest (a decisive one's rules doubled)
    `${s} .mana-moments{display:flex;flex-direction:column;align-items:center}`, `${s} .mana-moments[data-as=toast]{align-items:flex-end}`,
    `${s} .mana-moments .mana-banner[data-weight="3"]{border-top-width:4px;border-bottom-width:4px}`,
    `${s} .mana-moments .mana-banner[data-weight="0"]{border-width:1px 0}`,
    // a side's chip, and the cell that leads a row (a shape beside the number, the colour the theme's)
    `${s} .mana-chip{display:inline-block;width:6px;height:.9em;margin-right:6px;vertical-align:-1px;border-radius:1px;background:${v('ink')}}`,
    ...Array.from({ length: 8 }, (_, k) => `${s} .mana-chip[data-side="${k}"]{background:${v(`side-${k}`)};box-shadow:0 0 0 1px ${v(`side-${k}-key`)}}`),
    `${s} :is(.mana-row,.mana-cell)>.mana-chip{position:absolute;left:8px;top:7px;bottom:7px;width:4px;height:auto;margin:0}`,
    `${s} .mana-table td[data-lead=yes]{font-weight:800}`, `${s} .mana-table td[data-lead=yes]::after{content:" \\25B2";font-size:.7em;color:${v('accent2')}}`,
    // the live game's own: a bar's chip and its mirror, tables, dials, slots, what is off screen, where harm came from
    `${s} .mana-track u{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(-45deg,${v('ink')} 0 1px,transparent 1px 3px);opacity:.55}`,
    `${s} .mana-bar[data-dir=rtl] .mana-track{transform:scaleX(-1)}`,
    `${s} .mana-bar[data-dir=rtl]>.mana-num{order:1}`, `${s} .mana-bar[data-dir=rtl]>.mana-track{order:2}`, `${s} .mana-bar[data-dir=rtl]>.mana-label{order:3}`,
    `${s} .mana-badge[data-variant=strong]{background:${v('ink')};color:${v('panel')};border-color:${v('ink')}}`,
    `${s} .mana-badge[data-variant=muted]{border-style:dashed;color:${v('mid')}}`,
    `${s} .mana-table{border-collapse:collapse;width:100%;font-size:${f(12)}}`,
    `${s} .mana-table th{font-size:${f(10)};font-weight:700;letter-spacing:.1em;text-transform:${v('case')};color:${v('mid')};text-align:left;padding:3px 8px;border-bottom:1px solid ${v('line')}}`,
    `${s} .mana-table td{padding:3px 8px;border-bottom:1px solid ${v('soft')}}`,
    `${s} .mana-table [data-align=right]{text-align:right;font-variant-numeric:tabular-nums}`, `${s} .mana-table [data-align=center]{text-align:center}`,
    `${s} .mana-table tr[data-mark=yes] td{font-weight:700;background:${v('wash')}}`,
    `${s} .mana-table tr[data-mark=yes] td:first-child::before{content:"\\25B6  "}`,
    `${s} .mana-gauge{display:inline-flex;flex-direction:column;align-items:center;gap:2px}`,
    `${s} .mana-dial{position:relative;display:flex;align-items:center;justify-content:center;width:96px;height:96px;border-radius:50%;border:1px solid ${v('line')};background:conic-gradient(from -120deg,${v('plain')} calc(var(--r,0)*240deg),${v('paper')} 0 240deg,transparent 0)}`,
    `${s} .mana-dial::after{content:"";position:absolute;inset:9px;border-radius:50%;background:${v('panel')}}`,
    `${s} .mana-dial i{position:absolute;left:calc(50% - 1px);bottom:50%;width:2px;height:40px;background:${v('ink')};transform-origin:50% 100%;z-index:1}`,
    `${s} .mana-dial .mana-num{position:relative;z-index:2;margin-top:34px;font-size:${f(15)};font-weight:700}`,
    `${s} .mana-slot{position:relative;display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border:1px solid ${v('line')};border-radius:calc(${v('radius')}*.6);background:${v('paper')};overflow:hidden}`,
    `${s} .mana-slot .mana-icon{border:0;background:transparent}`,
    `${s} .mana-slot .mana-key{position:absolute;left:2px;top:2px;min-width:0;padding:0 2px;font-size:8px;border-bottom-width:1px}`,
    `${s} .mana-cool{position:absolute;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,${v('ink')} 0 1px,transparent 1px 4px);opacity:.55}`,
    `${s} .mana-count{position:absolute;right:3px;bottom:1px;font:700 ${f(10)} ${v('mono')}}`,
    `${s} .mana-slot[data-active=yes]{border:2px solid ${v('accent')};box-shadow:inset 0 0 0 1px ${v('accent')}}`,
    `${s} .mana-slot[data-empty=yes]{border-style:dashed;border-color:${v('soft')}}`,
    `${s} .mana-edges,${s} .mana-threat,${s} .mana-letterbox{position:absolute;inset:0;pointer-events:none}`,
    `${s} .mana-edge{position:absolute;transform:translate(-50%,-50%);font:700 ${f(13)} ${v('mono')};padding:1px 5px;background:${v('plate')};border:1px solid ${v('line')};border-radius:calc(${v('radius')}*.5)}`,
    `${s} .mana-threat{inset:auto;left:50%;top:50%;width:240px;height:240px;transform:translate(-50%,-50%);border:1px dashed ${v('soft')};border-radius:50%}`,
    `${s} .mana-arc{position:absolute;font-size:22px;line-height:1;color:${v('harm')}}`,
    `${s} .mana-letterbox i{position:absolute;left:0;right:0;height:11%;background:${v('shade')}}`,
    `${s} .mana-letterbox i:first-child{top:0}`, `${s} .mana-letterbox i:last-child{bottom:0}`,
    `${s} .mana-touchpad{display:flex;justify-content:space-between;align-items:flex-end;width:1180px;max-width:100%;padding:0 12px}`,
    `${s} .mana-stick,${s} .mana-pad{pointer-events:auto;touch-action:none}`,
    `${s} .mana-stick{position:relative;width:120px;height:120px;border-radius:50%;border:2px solid ${v('line')};background:${v('plate')};opacity:.85}`,
    `${s} .mana-stick i{position:absolute;inset:38px;border-radius:50%;background:${v('ink')};opacity:.5}`,
    `${s} .mana-pads{display:grid;grid-template-columns:repeat(2,60px);gap:12px}`,
    `${s} .mana-pad{display:flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:50%;border:2px solid ${v('line')};background:${v('plate')};font:700 ${f(14)} ${v('mono')};opacity:.85}`,
    // enemies: awareness as a glyph, statuses as boxes
    `${s} .mana-awareness{font-size:${f(10)};text-transform:uppercase;letter-spacing:.06em;color:${v('mid')}}`,
    `${s} .mana-awareness b{display:inline-block;min-width:16px;padding:0 2px;border:1px solid ${v('line')};color:${v('ink')};text-align:center;font:900 10px/1.3 ${v('mono')}}`,
    `${s} .mana-awareness[data-state=alert] b,${s} .mana-awareness[data-state=combat] b{background:${v('harm')};border-color:${v('harm')};color:${v('panel')}}`,
    `${s} .mana-awareness[data-state=unaware] b,${s} .mana-awareness[data-state=down] b{border-style:dashed}`,
    `${s} .mana-statuses{display:inline-flex;gap:2px}`,
    `${s} .mana-status{display:inline-block;padding:0 3px;border:1px solid ${v('line')};font:700 8px/1.4 ${v('mono')};background:${v('paper')}}`,
    `${s} .mana-status sub{font-size:7px;margin-left:1px}`,
    ...MOTION_RULES(s),
  ].join('\n');
}

// ── motion ────────────────────────────────────────────────────────────────────────────────────────────────────────
// every travel, scale and delay a variable: under reduced motion they are zero and the fades are all that is left
const pop = (k) => `calc(1 + (${v('pop')} - 1) * ${k})`;
const KEYFRAMES = [
  `@keyframes mana-fade{from{opacity:0}}`,
  `@keyframes mana-rise{from{opacity:0;transform:translateY(${v('travel')})}}`,
  `@keyframes mana-slide{from{opacity:0;transform:translateX(calc(${v('travel')} * 2))}}`,
  `@keyframes mana-slam{0%{opacity:0;transform:scale(${pop(3)})}60%{opacity:1}100%{transform:none}}`,
  `@keyframes mana-pop{from{transform:scale(${pop(1)})}}`,
  `@keyframes mana-flash{from{background-color:${v('flash')};color:${v('panel')}}}`,
  `@keyframes mana-gain{0%{opacity:0}15%{opacity:1}100%{opacity:0;transform:translateY(calc(${v('travel')} * -2.4))}}`,
  `@keyframes mana-ring{from{opacity:1}to{opacity:0;transform:scale(${pop(2.5)})}}`,
  `@keyframes mana-turn{50%{box-shadow:inset 9px 0 0 ${v('turn')},inset 0 0 0 2px ${v('turn')}}}`,
  `@keyframes mana-sheen{from{transform:translateX(-120%) skewX(-20deg)}to{transform:translateX(320%) skewX(-20deg)}}`,
];
const CALM = `--mana-travel:0px!important;--mana-pop:1!important;--mana-stagger:0ms!important;--mana-glide:0ms!important;--mana-loop:paused!important;--mana-sheen:0!important`;
function MOTION_RULES(s) {
  const rows = `:is(.mana-list>.mana-row,.mana-grid>.mana-cell,.mana-each>*,.mana-table tbody tr,.mana-tier>.mana-node)`;
  return [
    ...KEYFRAMES,
    // entrances: a screen fades in, its windows and rows rise, staggered by their place
    `${s} .mana-screen{animation:mana-fade ${v('dur')} ease-out both}`,
    // (at the least weight a selector can have: a change's flash or a turn's breath on the same element wins)
    `${s} :where(.mana-screen .mana-window){animation:mana-rise calc(${v('dur')} * 1.3) ${v('ease')} both}`,
    `${s} :where(.mana-screen) :where(${rows.slice(4, -1)}){animation:mana-rise ${v('dur')} ${v('ease')} both;animation-delay:calc(var(--mana-i,0) * ${v('stagger')})}`,
    ...Array.from({ length: 10 }, (_, i) => `${s} ${rows}:nth-child(${i + 2}){--mana-i:${i + 1}}`),
    `${s} ${rows}:nth-child(n+12){--mana-i:11}`,
    // the moments: a banner slams, its sheen sweeps once; a toast slides in from its edge
    `${s} .mana-banner{position:relative;overflow:hidden;animation:mana-slam calc(${v('dur')} * 2) ${v('ease')} both}`,
    `${s} .mana-banner::after{content:"";position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,${v('panel')},transparent);opacity:${v('sheen')};pointer-events:none;animation:mana-sheen calc(${v('dur')} * 5) ease-in-out calc(${v('dur')} * 2) both}`,
    `${s} .mana-toast{animation:mana-slide calc(${v('dur')} * 1.5) ${v('ease')} both}`,
    // a passing anchor (a damage number) rises and fades once from where it lands; its id is its element, so it replays
    `${s} .mana-anchors[data-pass=yes] .mana-anchor>*{animation:mana-gain calc(${v('dur')} * 6) ease-out both}`,
    // a bar and a dial glide to their new value
    `${s} .mana-track i{transition:width ${v('glide')} ${v('ease')}}`, `${s} .mana-dial i{transition:transform ${v('glide')} ${v('ease')}}`,
    // what changed says so once: a flash and a pop, its gain floating off (a new data-key replays it)
    `${s} [data-ch]{animation:mana-flash calc(${v('dur')} * 4) ease-out,mana-pop calc(${v('dur')} * 1.5) ${v('ease')}}`,
    `${s} .mana-num[data-ch],${s} .mana-glyphs[data-ch]{display:inline-block;position:relative}`,
    `${s} [data-ch=up]{--mana-flash:${v('accent2')}}`, `${s} [data-ch=down]{--mana-flash:${v('harm')}}`,
    `${s} .mana-gain{position:absolute;right:0;bottom:100%;text-decoration:none;font:700 ${f(10)}/1 ${v('mono')};white-space:nowrap;pointer-events:none;animation:mana-gain calc(${v('dur')} * 8) ease-out both}`,
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
