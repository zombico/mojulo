/**
 * immersive-ui — THE IMMERSIVE UI, a stylish action game's: NO BOX IS DRAWN. A screen is letters over the play: a
 * window, a banner and a region sit on no plate and in no frame; what is chosen is marked by its arrow alone, never a
 * tinted row; a rank is its letter, stamped large, with no caption. The letters carry the look instead: a light rim
 * and a light shadow in the theme's own accents (cut one way, lit the other), a soft glow of the same, and only then
 * the dark that keeps them read over a bright scene. Nothing is explained in words the play shows.
 *
 *   LETTER_RIM              the letters' rim, shadow and glow, as a text-shadow (the theme's accents, light)
 *   letterRimFilter()       the same as a filter, for letters whose fill is clipped to them (the style meter's tier)
 *   immersiveCss(scope)     the sheet laid over the game UI runtime's own, scoped to its root (the play shell's `#mana`)
 *
 * Laid by a game's `ui.immersive` (game/play-shell-mana.js) and on a level's HUD that carries the style meter
 * (scene/channels/mana-hud.js). Pure: strings.
 */
const A = 'var(--mana-accent)', A2 = 'var(--mana-accent2)';
const INK = `color-mix(in srgb,${A} 12%,#fff)`;
const LIGHT = `color-mix(in srgb,${A} 65%,#fff)`, GLOW = `color-mix(in srgb,${A2} 55%,transparent)`;
export const LETTER_RIM = `.045em .045em 0 ${A2},-.02em -.02em 0 ${LIGHT},0 0 .45em ${GLOW},0 .12em .3em rgba(0,0,0,.6)`;
export const letterRimFilter = () => `drop-shadow(.04em .04em 0 ${A2}) drop-shadow(-.018em -.018em 0 ${LIGHT}) drop-shadow(0 0 .2em ${GLOW}) drop-shadow(0 .1em .14em rgba(0,0,0,.55))`;

export function immersiveCss(scope = '#mana') {
  const s = scope, stamp = `${s} .mana-badge[data-variant=stamp]`;
  return [
    // the letters stand over the play, never on a plate: light, whatever ink the theme's plates were written in
    `${s},${s} .mana-root{--mana-ink:${INK};--mana-focus-ink:${INK};--mana-mid:color-mix(in srgb,${A2} 30%,#fff)}`,
    // no box: no plate, no frame, no ornament on a window, a banner or a region
    `${s} :is(.mana-window,.mana-banner,.mana-region){background:transparent!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;clip-path:none!important;outline:0!important}`,
    `${s} :is(.mana-window,.mana-banner)::before,${s} :is(.mana-window,.mana-banner)::after{display:none!important}`,
    `${s} :is(.mana-window,.mana-banner)>.mana-layers{display:none!important}`,
    // (no veil over the play behind a screen, and the legend on no plate)
    `${s} .mana-screen[data-layer=modal]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`,
    `${s} .mana-screen>.mana-legend{background:transparent!important}`,
    // what is chosen: its arrow alone
    `${s} [data-st=focus]{background:transparent!important}`,
    // the letters carry the look
    `${s} :is(.mana-title,.mana-banner,.mana-text,.mana-num,.mana-label,.mana-button,.mana-item){text-shadow:${LETTER_RIM}}`,
    `${s} :is(.mana-title,.mana-banner,.mana-text[data-role=display],.mana-text[data-role=heading]){font-style:italic}`,
    // a rank: its letter, stamped large, no caption and no rule beside it
    `${stamp}{background:transparent!important;border:0!important;box-shadow:none!important;padding:0;font-family:var(--mana-display);font-size:7.5em;font-weight:900;font-style:italic;line-height:.9;color:${A};text-shadow:${LETTER_RIM}}`,
    `${s} .mana-stack:has(>.mana-badge[data-variant=stamp]){justify-content:center}`,
    `${s} .mana-stack:has(>.mana-badge[data-variant=stamp])>.mana-text,${s} .mana-window .mana-divider{display:none}`,
    `${s} .mana-stat .mana-num{font-family:var(--mana-display);font-weight:900;font-style:italic;font-size:1.5em}`,
  ].join('');
}
