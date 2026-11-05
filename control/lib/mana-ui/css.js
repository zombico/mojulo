/**
 * MANA-UI's SHEET — the DOM backend's look for every component, from closed words only (the `data-*` the kernel writes),
 * over the guide's tokens (`--moj-*`: accent, accent2, ink, bg, panel, panel-a, line, font, harm, value, goal). The
 * theme is context: a node never carries a look, the page's tokens dress every one of them.
 *
 * Values first: focus is a shape (the ▶ marker and an inset rule), not only the accent; a better compare is ▲ and a
 * worse ▼; a low bar is striped. Colour adds to what already reads in black and white.
 *
 *   DEFAULT_TOKENS        the tokens a page without a guide is drawn in (game/hud-widgets.js STYLE_DEFAULTS: a test
 *                         holds them equal, since this folder imports nothing outside it)
 *   tokenCss(tokens)      `--moj-*` declarations for a tokens object (a preview's; a game page has its own)
 *   manaCss(scope?)       the sheet, every rule under `scope` (default `.mana-root`)
 */
export const DEFAULT_TOKENS = Object.freeze({ accent: '#5fb0ff', accent2: '#e8b96a', ink: '#ffffff', bg: '#0b1220', panel: '#0c101a', line: '#2a3b58' });

const HEX = /^#[0-9a-fA-F]{3,8}$/;
/** `--moj-*` declarations for tokens (hex only; anything else falls back to the default). */
export function tokenCss(tokens = {}) {
  const t = {};
  for (const k of Object.keys(DEFAULT_TOKENS)) t[k] = typeof tokens[k] === 'string' && HEX.test(tokens[k]) ? tokens[k] : DEFAULT_TOKENS[k];
  const p = t.panel.length === 7 ? `${t.panel}e6` : t.panel;
  return [...Object.entries(t).map(([k, v]) => `--moj-${k}:${v}`), `--moj-panel-a:${p}`].join(';');
}

/** The sheet, scoped. */
export function manaCss(scope = '.mana-root') {
  const s = scope;
  return [
    `${s}{position:fixed;inset:0;pointer-events:none;font:15px/1.35 var(--moj-font,system-ui,sans-serif);color:var(--moj-ink,#fff);z-index:40}`,
    `${s}[data-open=none]{display:none}`,
    `${s} *{box-sizing:border-box}`,
    // the screen and where it sits; a modal dims what is behind it
    `${s} .mana-screen{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;padding:24px;pointer-events:auto}`,
    `${s} .mana-screen[data-layer=modal]{background:color-mix(in srgb,var(--moj-bg,#000) 62%,transparent)}`,
    `${s} .mana-screen[data-place=center]{align-items:center;justify-content:center}`,
    `${s} .mana-screen[data-place=left]{align-items:flex-start;justify-content:center}`,
    `${s} .mana-screen[data-place=right]{align-items:flex-end;justify-content:center}`,
    `${s} .mana-screen[data-place=full]{align-items:stretch;justify-content:flex-start}`,
    `${s} .mana-screen[data-place=full]>:not(.mana-title){flex:1;min-height:0}`,
    // type roles
    `${s} .mana-title{margin:0;font-size:24px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}`,
    `${s} .mana-heading{margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.8}`,
    `${s} .mana-text[data-role=title]{font-size:20px;font-weight:800}`,
    `${s} .mana-text[data-role=heading]{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}`,
    `${s} .mana-text[data-role=label],${s} .mana-label{font-size:12px;opacity:.75}`,
    `${s} .mana-text[data-role=caption]{font-size:11px;opacity:.65}`,
    `${s} .mana-text[data-role=numeral],${s} .mana-num{font-variant-numeric:tabular-nums}`,
    // panels and layout
    `${s} .mana-window{background:var(--moj-panel,#0c101a);border:1px solid var(--moj-line,#2a3b58);border-radius:6px;padding:12px 14px;min-width:220px;max-width:100%}`,
    `${s} .mana-window[data-variant=inset]{background:var(--moj-panel-a,#0c101ae6);border-style:dashed}`,
    `${s} .mana-stack{display:flex;flex-direction:column;gap:8px;min-width:0}`,
    `${s} .mana-stack[data-dir=row]{flex-direction:row;align-items:center}`,
    `${s} .mana-stack[data-gap=tight]{gap:3px}`, `${s} .mana-stack[data-gap=loose]{gap:16px}`,
    `${s} .mana-stack[data-align=start]{align-items:flex-start}`, `${s} .mana-stack[data-align=center]{align-items:center}`,
    `${s} .mana-stack[data-align=end]{align-items:flex-end}`, `${s} .mana-stack[data-align=apart]{justify-content:space-between}`,
    `${s} .mana-split{display:grid;grid-template-columns:minmax(200px,1fr) 2fr;gap:12px;width:min(960px,100%);align-items:start}`,
    `${s} .mana-split[data-ratio=even]{grid-template-columns:1fr 1fr}`,
    `@media (max-width:640px){${s} .mana-split{grid-template-columns:1fr}}`,
    // tabs: the open one underlined (a shape), the strip turned by [ and ]
    `${s} .mana-tabstrip{display:flex;gap:4px;margin-bottom:10px;border-bottom:1px solid var(--moj-line,#2a3b58)}`,
    `${s} .mana-tablabel{padding:4px 10px;cursor:pointer;font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.6;border-bottom:3px solid transparent;margin-bottom:-1px}`,
    `${s} .mana-tablabel[data-st=active]{opacity:1;border-bottom-color:var(--moj-accent,#5fb0ff)}`,
    // what can be focused: the ▶ marker is the focus, an inset rule the active row a detail reads
    `${s} .mana-row,${s} .mana-button,${s} .mana-toggle,${s} .mana-cycler{position:relative;padding:5px 8px 5px 22px;border-radius:4px;cursor:pointer}`,
    `${s} [data-st=focus]{background:color-mix(in srgb,var(--moj-accent,#5fb0ff) 18%,transparent);box-shadow:inset 0 0 0 1px var(--moj-accent,#5fb0ff)}`,
    `${s} [data-st=focus]::before{content:"\\25B6";position:absolute;left:6px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--moj-accent,#5fb0ff)}`,
    `${s} .mana-row[data-st=focus]::before{top:9px;transform:none}`,
    `${s} .mana-row[data-st=active]{box-shadow:inset 3px 0 0 var(--moj-accent2,#e8b96a)}`,
    `${s} [data-st=disabled]{opacity:.45;cursor:default}`,
    `${s} .mana-list{display:flex;flex-direction:column;gap:2px}`,
    `${s} .mana-list[data-empty=yes]{padding:6px 8px}`,
    `${s} .mana-toggle,${s} .mana-cycler{display:flex;justify-content:space-between;gap:16px}`,
    `${s} .mana-toggle[data-on=no] .mana-value{opacity:.55}`,
    `${s} .mana-mark{opacity:.7}`,
    // values: a stat, a bar, a compare
    `${s} .mana-stat{display:flex;justify-content:space-between;gap:12px}`,
    `${s} .mana-max{opacity:.55}`,
    `${s} .mana-bar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:6px;font-size:12px;min-width:120px}`,
    `${s} .mana-track{display:block;height:6px;background:color-mix(in srgb,var(--moj-ink,#fff) 16%,transparent);border-radius:3px;overflow:hidden}`,
    `${s} .mana-track i{display:block;height:100%;width:calc(var(--r,0) * 100%);background:var(--moj-accent,#5fb0ff)}`,
    `${s} .mana-bar[data-variant=hp] .mana-track i{background:var(--moj-goal,#3ff56f)}`,
    `${s} .mana-bar[data-variant=mp] .mana-track i{background:var(--moj-accent,#5fb0ff)}`,
    `${s} .mana-bar[data-variant=xp] .mana-track i{background:var(--moj-value,#ffd700)}`,
    `${s} .mana-bar[data-low=yes] .mana-track i{background:repeating-linear-gradient(-45deg,var(--moj-harm,#ff5a4d) 0 4px,color-mix(in srgb,var(--moj-harm,#ff5a4d) 55%,transparent) 4px 8px)}`,
    `${s} .mana-compare{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center}`,
    `${s} .mana-compare[data-way=better] .mana-mark{color:var(--moj-goal,#3ff56f);opacity:1}`,
    `${s} .mana-compare[data-way=worse] .mana-mark{color:var(--moj-harm,#ff5a4d);opacity:1}`,
  ].join('\n');
}
