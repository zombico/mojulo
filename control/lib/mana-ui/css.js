/**
 * MANA-UI's SHEET — the structure every component is drawn in, its look read from `--mana-*` variables whose defaults
 * are the GREYBOX: values only (black, white and greys), boxes, rules and placeholders, so a screen's structure and
 * behaviour are approved apart from its look (the UI direction's greybox, playscape/ui/direction.js, is the precedent).
 * A theme (theme.js) is a separate layer: it sets the variables and adds a few rules of its own, from closed words; it
 * never reaches into the structure.
 *
 * Values first, so the black-and-white law holds by construction under any theme: focus is a shape (the ▶ marker and a
 * heavy rule), the active row a bar at its edge, disabled a dashed outline; bar variants differ by PATTERN (hp solid, mp
 * hatched, xp dotted, stamina striped, shield checked, boss solid with phase ticks), a low bar cross-hatched; a better
 * compare is ▲; an enemy's awareness is a glyph; placeholders (an image, a portrait, a minimap) are crossed boxes.
 *
 *   GREYBOX_VARS        the variables and their greybox values (what a theme sets)
 *   manaCss(scope?)     the sheet, every rule under `scope` (default `.mana-root`), the greybox's values as defaults
 *   FRAME_CSS           the board's frames: a 1280×720 stage scaled into a 16:9 box, so a frame keeps a screen's proportions
 */
export const GREYBOX_VARS = Object.freeze({
  ink: '#111111', mid: '#6b6b6b', soft: '#bdbdbd', line: '#111111', panel: '#fafafa', paper: '#fafafa', wash: '#ececec',
  scrim: 'rgba(255,255,255,.72)', shade: '#000000',
  // the sides' kits (a team, a seat, a lane): greys in the greybox, told apart by their names and by shade
  'side-0': '#111111', 'side-1': '#8a8a8a', 'side-2': '#4a4a4a', 'side-3': '#b5b5b5', 'side-4': '#2a2a2a', 'side-5': '#6b6b6b', 'side-6': '#9e9e9e', 'side-7': '#3c3c3c', accent: '#111111', accent2: '#111111', 'focus-ink': '#111111',
  hp: '#111111', mp: '#111111', xp: '#111111', stamina: '#111111', shield: '#111111', boss: '#111111', plain: '#111111', harm: '#111111',
  font: 'system-ui,-apple-system,"Segoe UI",sans-serif', display: 'system-ui,-apple-system,"Segoe UI",sans-serif', mono: 'ui-monospace,Menlo,Consolas,monospace',
  scale: '1', case: 'uppercase', radius: '0px', 'frame-w': '1px', 'frame-s': 'solid', plate: '#fafafa', motion: 'none',
});
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
    `${s}{position:fixed;inset:0;pointer-events:none;font-family:${v('font')};font-size:${f(14)};line-height:1.35;color:${v('ink')};z-index:40}`,
    `${s} *{box-sizing:border-box}`,
    // the stack: a screen dims what it covers (a modal), and sits where it says
    `${s} .mana-screen{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;padding:24px;pointer-events:auto;overflow:hidden}`,
    `${s} .mana-screen[data-layer=modal]{background:${v('scrim')}}`,
    `${s} .mana-screen[data-place=center]{align-items:center;justify-content:center}`,
    `${s} .mana-screen[data-place=left]{align-items:flex-start;justify-content:center}`,
    `${s} .mana-screen[data-place=right]{align-items:flex-end;justify-content:center}`,
    `${s} .mana-screen[data-place=top]{align-items:center;justify-content:flex-start}`,
    `${s} .mana-screen[data-place=bottom]{align-items:stretch;justify-content:flex-end}`,
    `${s} .mana-screen[data-place=full]{align-items:stretch;justify-content:flex-start}`,
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
    `@media (max-width:640px){${s} .mana-split{grid-template-columns:1fr}}`,
    `${s} .mana-each{display:flex;flex-direction:column;gap:3px;min-width:0}`, `${s} .mana-each[data-dir=row]{flex-direction:row;flex-wrap:wrap;gap:12px}`,
    `${s} .mana-each[data-dir=row]>.mana-window{flex:1;min-width:180px}`,
    `${s} .mana-stack[data-fill=yes]{width:1100px;max-width:100%}`, `${s} .mana-stack[data-fill=yes]>.mana-stack{flex:1;min-width:0}`,
    `${s} .mana-divider{display:flex;align-items:center;gap:8px;border-top:1px solid ${v('soft')};padding-top:4px;margin-top:4px}`,
    `${s} .mana-tabstrip{display:flex;gap:2px;margin-bottom:10px;border-bottom:1px solid ${v('line')}}`,
    `${s} .mana-tablabel{padding:4px 10px;cursor:pointer;font-size:${f(11)};letter-spacing:.1em;text-transform:${v('case')};color:${v('mid')};border:1px solid transparent;border-bottom:0;margin-bottom:-1px;border-radius:${v('radius')} ${v('radius')} 0 0}`,
    `${s} .mana-tablabel[data-st=active]{color:${v('ink')};background:${v('panel')};border-color:${v('line')};font-weight:700}`,
    // what can be focused: ▶ and a heavy rule are the focus; a bar at the edge the active row; a dashed line disabled
    `${all('')}{position:relative;padding:5px 8px 5px 20px;border:1px solid transparent;border-radius:calc(${v('radius')}*.6);cursor:pointer;transition:${v('motion')}}`,
    `${s} [data-st=focus]{border:2px solid ${v('accent')};padding:4px 7px 4px 19px;background:${v('wash')};color:${v('focus-ink')}}`,
    `${s} [data-st=focus]::before{content:"\\25B6";position:absolute;left:5px;top:7px;font-size:9px;color:${v('accent')}}`,
    `${s} [data-st=active]{box-shadow:inset 3px 0 0 ${v('accent2')}}`,
    `${s} [data-st=disabled]{color:${v('mid')};border:1px dashed ${v('soft')};cursor:default}`,
    `${s} [data-seats]::after{content:"P" attr(data-seats);position:absolute;right:3px;top:2px;font:700 9px/1 ${v('mono')};padding:2px 3px;background:${v('accent')};color:${v('panel')}}`,
    `${s} .mana-button{border:1px solid ${v('line')};text-align:center;padding-left:20px;padding-right:12px}`,
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
    `${s} .mana-toggle[data-on=no] .mana-value{color:${v('mid')}}`,
    `${s} .mana-slider .mana-value{display:flex;align-items:center;gap:6px;min-width:120px}`,
    `${s} .mana-slider .mana-track{flex:1}`,
    `${s} .mana-allocator{display:flex;flex-direction:column;gap:3px;min-width:280px}`,
    `${s} .mana-alloc{display:grid;grid-template-columns:1fr 32px 14px 32px 34px}`,
    `${s} .mana-keys{display:flex;gap:4px}`,
    `${s} .mana-key{display:inline-block;min-width:20px;padding:1px 5px;border:1px solid ${v('line')};border-bottom-width:2px;border-radius:calc(${v('radius')}*.5);font:700 ${f(10)}/1.3 ${v('mono')};text-align:center;text-transform:uppercase;background:${v('paper')}}`,
    `${s} .mana-carousel{display:grid;grid-template-columns:20px 1fr 20px;align-items:center;gap:6px;padding:8px 8px 18px}`,
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
    `${s} .mana-prompt{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid ${v('line')};border-radius:${v('radius')};background:${v('plate')}}`,
    // in-game: regions, anchors, aim, maps, feed, moments
    `${s} .mana-hud{position:absolute;inset:0;pointer-events:none}`,
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
    `${s} .mana-place>.mana-region:has(>:is(.mana-reticle,.mana-banner,.mana-touchpad)){background:transparent;border:0;opacity:1;clip-path:none;box-shadow:none;outline:0}`,
    `${s} .mana-anchors{position:absolute;inset:0}`,
    `${s} .mana-anchor{position:absolute;transform:translate(-50%,-100%)}`,
    // what floats over the world carries its own plate: the world behind it can be any colour
    `${s} .mana-anchor>*{background:${v('plate')};border-radius:calc(${v('radius')}*.5);padding:2px 5px;opacity:.94}`,
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
    // a side's chip, and the cell that leads a row (a shape beside the number, the colour the theme's)
    `${s} .mana-chip{display:inline-block;width:6px;height:.9em;margin-right:6px;vertical-align:-1px;border-radius:1px;background:${v('ink')}}`,
    ...Array.from({ length: 8 }, (_, k) => `${s} .mana-chip[data-side="${k}"]{background:${v(`side-${k}`)}}`),
    `${s} :is(.mana-row,.mana-cell)>.mana-chip{position:absolute;left:12px;top:7px;bottom:7px;width:4px;height:auto;margin:0}`,
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
  ].join('\n');
}

/** The board's frames: a 1280×720 stage scaled into a 16:9 box, over a crossed "world" wash. */
export const FRAME_CSS = [
  '.mana-frame{position:relative;aspect-ratio:16/9;width:100%;overflow:hidden;border:1px solid #111;background:#d9d9d9 repeating-linear-gradient(45deg,transparent 0 22px,rgba(0,0,0,.05) 22px 23px)}',
  '.mana-stage{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0}',
  '.mana-stage .mana-root{position:absolute}',
  '.mana-frame[data-live=yes]{outline:3px solid #111;outline-offset:2px}',
].join('\n');
