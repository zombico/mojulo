/**
 * MANA-UI's GREYBOX — the wireframe every component is drawn in before any style: values only (black, white and greys),
 * boxes, rules and placeholders, so a screen's structure and behaviour are approved apart from its look (the UI
 * direction's greybox, playscape/ui/direction.js, is the precedent). Styles are a separate layer laid over this one
 * later; nothing here names a colour of the world.
 *
 * Values first, so the black-and-white law holds by construction: focus is a shape (the ▶ marker and a heavy rule), the
 * active row a bar at its edge, disabled a dashed outline; bar variants differ by PATTERN (hp solid, mp hatched, xp
 * dotted, stamina striped, shield checked, boss solid with phase ticks), a low bar cross-hatched; a better compare is ▲;
 * an enemy's awareness is a glyph; placeholders (an image, a portrait, a minimap) are crossed boxes with a caption.
 *
 *   manaCss(scope?)    the sheet, every rule under `scope` (default `.mana-root`)
 *   FRAME_CSS          the board's frames: a 1280×720 stage scaled into a 16:9 box, so a frame keeps a screen's proportions
 */
const INK = '#111', MID = '#6b6b6b', SOFT = '#bdbdbd', PAPER = '#fafafa', WASH = '#ececec';
const X_BOX = `linear-gradient(to top right,transparent calc(50% - .5px),${SOFT} calc(50% - .5px),${SOFT} calc(50% + .5px),transparent calc(50% + .5px)),linear-gradient(to bottom right,transparent calc(50% - .5px),${SOFT} calc(50% - .5px),${SOFT} calc(50% + .5px),transparent calc(50% + .5px))`;
const FILL = {
  plain: INK,
  hp: INK,
  boss: INK,
  mp: `repeating-linear-gradient(45deg,${INK} 0 2px,transparent 2px 5px)`,
  xp: `radial-gradient(${INK} 1.2px,transparent 1.4px) 0 0/5px 5px`,
  stamina: `repeating-linear-gradient(90deg,${INK} 0 3px,transparent 3px 5px)`,
  shield: `repeating-conic-gradient(${INK} 0 25%,transparent 0 50%) 0 0/6px 6px`,
};

/** The greybox sheet, scoped. */
export function manaCss(scope = '.mana-root') {
  const s = scope;
  return [
    `${s}{position:fixed;inset:0;pointer-events:none;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:${INK};z-index:40}`,
    `${s} *{box-sizing:border-box}`,
    // the stack: a screen dims what it covers (a modal), and sits where it says
    `${s} .mana-screen{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;padding:24px;pointer-events:auto;overflow:hidden}`,
    `${s} .mana-screen[data-layer=modal]{background:rgba(255,255,255,.72)}`,
    `${s} .mana-screen[data-place=center]{align-items:center;justify-content:center}`,
    `${s} .mana-screen[data-place=left]{align-items:flex-start;justify-content:center}`,
    `${s} .mana-screen[data-place=right]{align-items:flex-end;justify-content:center}`,
    `${s} .mana-screen[data-place=top]{align-items:center;justify-content:flex-start}`,
    `${s} .mana-screen[data-place=bottom]{align-items:stretch;justify-content:flex-end}`,
    `${s} .mana-screen[data-place=full]{align-items:stretch;justify-content:flex-start}`,
    `${s} .mana-screen[data-place=full]>:is(.mana-split,.mana-window,.mana-tabs){flex:1;min-height:0}`,
    // type roles: size and weight only
    `${s} .mana-title{margin:0;font-size:22px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}`,
    `${s} .mana-heading{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${MID}}`,
    `${s} .mana-text[data-role=display]{font-size:40px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;line-height:1.05}`,
    `${s} .mana-text[data-role=title]{font-size:19px;font-weight:800}`,
    `${s} .mana-text[data-role=heading]{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}`,
    `${s} .mana-text[data-role=label],${s} .mana-label{font-size:11px;color:${MID}}`,
    `${s} .mana-text[data-role=caption],${s} .mana-caption{font-size:10px;color:${MID}}`,
    `${s} .mana-text[data-role=numeral],${s} .mana-num{font-variant-numeric:tabular-nums;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}`,
    // panels and layout
    `${s} .mana-window{background:${PAPER};border:1px solid ${INK};padding:10px 12px;min-width:200px;max-width:100%;min-height:0;overflow:hidden}`,
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
    `${s} .mana-each{display:flex;flex-direction:column;gap:3px;min-width:0}`, `${s} .mana-each[data-dir=row]{flex-direction:row;flex-wrap:wrap;gap:6px}`,
    `${s} .mana-divider{display:flex;align-items:center;gap:8px;border-top:1px solid ${SOFT};padding-top:4px;margin-top:4px}`,
    `${s} .mana-tabstrip{display:flex;gap:2px;margin-bottom:10px;border-bottom:1px solid ${INK}}`,
    `${s} .mana-tablabel{padding:4px 10px;cursor:pointer;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${MID};border:1px solid transparent;border-bottom:0;margin-bottom:-1px}`,
    `${s} .mana-tablabel[data-st=active]{color:${INK};background:${PAPER};border-color:${INK};font-weight:700}`,
    // what can be focused: ▶ and a heavy rule are the focus; a bar at the edge the active row; a dashed line disabled
    `${s} .mana-row,${s} .mana-cell,${s} .mana-node,${s} .mana-button,${s} .mana-toggle,${s} .mana-cycler,${s} .mana-slider,${s} .mana-keybind,${s} .mana-carousel,${s} .mana-alloc{position:relative;padding:5px 8px 5px 20px;border:1px solid transparent;cursor:pointer}`,
    `${s} [data-st=focus]{border:2px solid ${INK};padding:4px 7px 4px 19px;background:${WASH}}`,
    `${s} [data-st=focus]::before{content:"\\25B6";position:absolute;left:5px;top:7px;font-size:9px}`,
    `${s} [data-st=active]{box-shadow:inset 3px 0 0 ${INK}}`,
    `${s} [data-st=disabled]{color:${MID};border:1px dashed ${SOFT};cursor:default}`,
    `${s} [data-seats]::after{content:"P" attr(data-seats);position:absolute;right:3px;top:2px;font:700 9px/1 ui-monospace,monospace;padding:2px 3px;background:${INK};color:${PAPER}}`,
    `${s} .mana-button{border:1px solid ${INK};text-align:center;padding-left:20px;padding-right:12px}`,
    `${s} .mana-list{display:flex;flex-direction:column;gap:2px;min-height:0;overflow:hidden}`,
    `${s} .mana-list[data-empty=yes],${s} .mana-grid[data-empty=yes]{padding:6px 8px;border:1px dashed ${SOFT}}`,
    `${s} .mana-more{font-size:10px;color:${MID};text-align:center}`,
    `${s} .mana-grid{display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:4px}`,
    `${s} .mana-cell{border:1px solid ${SOFT};min-height:34px;padding:4px 6px 4px 16px;font-size:12px}`,
    `${s} .mana-tree{display:grid;grid-template-columns:repeat(var(--cols,1),minmax(110px,1fr));gap:18px}`,
    `${s} .mana-tier{display:flex;flex-direction:column;gap:8px;justify-content:center}`,
    `${s} .mana-node{border:1px solid ${INK};font-size:12px;background:${PAPER}}`,
    `${s} .mana-node[data-state=learned]{background:${INK};color:${PAPER}}`,
    `${s} .mana-node[data-state=learned][data-st=focus]{background:#333;color:${PAPER}}`,
    `${s} .mana-node[data-state=locked]{border-style:dashed;color:${MID}}`,
    `${s} .mana-node[data-state=later]{border-style:dotted;color:${MID}}`,
    `${s} .mana-req{display:block;font-size:9px;color:${MID}}`,
    `${s} .mana-node[data-state=learned] .mana-req{color:${SOFT}}`,
    `${s} .mana-toggle,${s} .mana-cycler,${s} .mana-slider,${s} .mana-keybind,${s} .mana-alloc{display:flex;justify-content:space-between;align-items:center;gap:14px}`,
    `${s} .mana-toggle[data-on=no] .mana-value{color:${MID}}`,
    `${s} .mana-slider .mana-value{display:flex;align-items:center;gap:6px;min-width:120px}`,
    `${s} .mana-slider .mana-track{flex:1}`,
    `${s} .mana-alloc{display:grid;grid-template-columns:1fr 32px 14px 32px 34px}`,
    `${s} .mana-keys{display:flex;gap:4px}`,
    `${s} .mana-key{display:inline-block;min-width:20px;padding:1px 5px;border:1px solid ${INK};border-bottom-width:2px;font:700 10px/1.3 ui-monospace,monospace;text-align:center;text-transform:uppercase}`,
    `${s} .mana-carousel{display:grid;grid-template-columns:20px 1fr 20px;align-items:center;gap:6px;padding:8px 8px 18px}`,
    `${s} .mana-carousel .mana-dots{position:absolute;left:0;right:0;bottom:3px;text-align:center;font-size:9px;letter-spacing:2px}`,
    `${s} .mana-slide{min-width:0}`,
    `${s} .mana-mark{color:${MID}}`,
    `${s} .mana-draft{font:700 20px/1.2 ui-monospace,monospace;letter-spacing:.12em;border-bottom:2px solid ${INK};padding:4px 2px;margin:6px 0;min-height:30px}`,
    `${s} .mana-textentry .mana-grid{--cols:10}`,
    `${s} .mana-textentry .mana-cell{min-height:24px;text-align:center;padding:2px 2px 2px 12px;font:600 12px ui-monospace,monospace}`,
    // values
    `${s} .mana-stat{display:flex;justify-content:space-between;gap:12px}`,
    `${s} .mana-max{color:${MID}}`,
    `${s} .mana-bar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:6px;font-size:11px;min-width:150px}`,
    `${s} .mana-track{position:relative;display:block;height:8px;border:1px solid ${INK};background:${PAPER}}`,
    `${s} .mana-track i{display:block;height:100%;background:${INK}}`,
    ...Object.entries(FILL).map(([v, f]) => `${s} .mana-bar[data-variant=${v}] .mana-track i{background:${f}}`),
    `${s} .mana-bar[data-variant=boss]{min-width:460px}`,
    `${s} .mana-bar[data-variant=boss] .mana-track{height:12px}`,
    `${s} .mana-track b{position:absolute;top:-2px;bottom:-2px;width:1px;background:${INK};outline:1px solid ${PAPER}}`,
    `${s} .mana-bar[data-low=yes] .mana-track i{background:repeating-linear-gradient(45deg,${INK} 0 2px,transparent 2px 4px),repeating-linear-gradient(-45deg,${INK} 0 2px,transparent 2px 4px)}`,
    `${s} .mana-pips .mana-glyphs{letter-spacing:2px;font-size:15px}`,
    `${s} .mana-pips,${s} .mana-counter,${s} .mana-timer{display:flex;align-items:center;gap:6px}`,
    `${s} .mana-compare{display:grid;grid-template-columns:1fr auto 14px auto;gap:6px;align-items:center}`,
    `${s} .mana-compare[data-way=better] .mana-mark,${s} .mana-compare[data-way=worse] .mana-mark{color:${INK};font-weight:700}`,
    `${s} .mana-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid ${INK};font:700 9px ui-monospace,monospace;background:${PAPER}}`,
    `${s} .mana-icon[data-size=s]{width:16px;height:16px;font-size:7px}`, `${s} .mana-icon[data-size=l]{width:40px;height:40px;font-size:12px}`,
    `${s} .mana-portrait{display:inline-flex;flex-direction:column;align-items:center;gap:2px}`,
    `${s} .mana-ph{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border:1px solid ${INK};background:${X_BOX} ${PAPER};font:700 13px ui-monospace,monospace}`,
    `${s} .mana-portrait[data-size=s] .mana-ph{width:28px;height:28px;font-size:9px}`, `${s} .mana-portrait[data-size=l] .mana-ph{width:84px;height:84px;font-size:18px}`,
    `${s} .mana-image{display:flex;align-items:flex-end;justify-content:center;border:1px solid ${INK};background:${X_BOX} ${PAPER};aspect-ratio:16/9;width:100%;padding:4px}`,
    `${s} .mana-image[data-ratio=square]{aspect-ratio:1}`, `${s} .mana-image[data-ratio=tall]{aspect-ratio:3/4}`, `${s} .mana-image[data-ratio=banner]{aspect-ratio:4/1}`,
    `${s} .mana-badge{display:inline-block;padding:0 5px;border:1px solid ${INK};border-radius:8px;font:700 10px/1.5 ui-monospace,monospace}`,
    `${s} .mana-prompt{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid ${INK};background:${PAPER}}`,
    // in-game: regions, anchors, aim, maps, feed, moments
    `${s} .mana-hud{position:absolute;inset:0;pointer-events:none}`,
    `${s} .mana-place{position:absolute;display:flex;flex-direction:column;gap:6px;padding:12px;max-width:40%}`,
    `${s} .mana-place[data-at=top-left]{top:0;left:0}`, `${s} .mana-place[data-at=top]{top:0;left:50%;transform:translateX(-50%);align-items:center}`,
    `${s} .mana-place[data-at=top-right]{top:0;right:0;align-items:flex-end}`, `${s} .mana-place[data-at=left]{top:50%;left:0;transform:translateY(-50%)}`,
    `${s} .mana-place[data-at=center]{top:50%;left:50%;transform:translate(-50%,-50%);align-items:center}`, `${s} .mana-place[data-at=right]{top:50%;right:0;transform:translateY(-50%);align-items:flex-end}`,
    `${s} .mana-place[data-at=bottom-left]{bottom:0;left:0}`, `${s} .mana-place[data-at=bottom]{bottom:0;left:50%;transform:translateX(-50%);align-items:center}`,
    `${s} .mana-place[data-at=bottom-right]{bottom:0;right:0;align-items:flex-end}`,
    `${s} .mana-place>*{background:rgba(250,250,250,.86);border:1px solid ${INK};padding:5px 7px}`,
    `${s} .mana-place>.mana-reticle,${s} .mana-place>.mana-banner{background:transparent;border:0}`,
    `${s} .mana-anchors{position:absolute;inset:0}`,
    `${s} .mana-anchor{position:absolute;transform:translate(-50%,-100%)}`,
    `${s} .mana-reticle{position:relative;font:300 26px/1 ui-monospace,monospace;text-align:center}`,
    `${s} .mana-hit{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:34px;font-weight:200}`,
    `${s} .mana-minimap{position:relative;width:130px;height:130px;border:1px solid ${INK};background:${X_BOX} ${PAPER}}`,
    `${s} .mana-minimap[data-shape=round]{border-radius:50%}`,
    `${s} .mana-marker{position:absolute;transform:translate(-50%,-50%);font-size:11px;line-height:1}`,
    `${s} .mana-minimap .mana-caption{position:absolute;left:4px;bottom:2px}`,
    `${s} .mana-compass{position:relative;width:300px;height:22px;border:1px solid ${INK};background:${PAPER};overflow:hidden}`,
    `${s} .mana-compass .mana-cardinal,${s} .mana-compass .mana-marker{position:absolute;top:50%;transform:translate(-50%,-50%);font:700 11px ui-monospace,monospace}`,
    `${s} .mana-needle{position:absolute;left:50%;top:-3px;transform:translateX(-50%);font-size:8px}`,
    `${s} .mana-feed{display:flex;flex-direction:column;gap:2px;font-size:11px;min-width:160px}`,
    `${s} .mana-toast{padding:4px 10px;border:1px solid ${INK};background:${PAPER};font-size:12px}`,
    `${s} .mana-banner{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 24px;border-top:2px solid ${INK};border-bottom:2px solid ${INK};background:rgba(250,250,250,.86)}`,
    // enemies: awareness as a glyph, statuses as boxes
    `${s} .mana-awareness{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:${MID}}`,
    `${s} .mana-awareness b{display:inline-block;min-width:16px;padding:0 2px;border:1px solid ${INK};color:${INK};text-align:center;font:900 10px/1.3 ui-monospace,monospace}`,
    `${s} .mana-awareness[data-state=alert] b,${s} .mana-awareness[data-state=combat] b{background:${INK};color:${PAPER}}`,
    `${s} .mana-awareness[data-state=unaware] b,${s} .mana-awareness[data-state=down] b{border-style:dashed}`,
    `${s} .mana-statuses{display:inline-flex;gap:2px}`,
    `${s} .mana-status{display:inline-block;padding:0 3px;border:1px solid ${INK};font:700 8px/1.4 ui-monospace,monospace;background:${PAPER}}`,
    `${s} .mana-status sub{font-size:7px;margin-left:1px}`,
  ].join('\n');
}

/** The board's frames: a root inside a 16:9 box, over a crossed "world" wash, instead of over the window. */
export const FRAME_CSS = [
  `.mana-frame{position:relative;aspect-ratio:16/9;width:100%;overflow:hidden;border:1px solid ${INK};background:${WASH} repeating-linear-gradient(45deg,transparent 0 22px,rgba(0,0,0,.035) 22px 23px)}`,
  `.mana-stage{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0}`,
  `.mana-stage .mana-root{position:absolute}`,
  `.mana-frame[data-live=yes]{outline:3px solid ${INK};outline-offset:2px}`,
].join('\n');
