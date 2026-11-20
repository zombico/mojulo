/**
 * THE SCREEN LAYER — what a cue's `screen` effect does to the screen itself (playscape/ui/cues.js SCREEN_VARS): a fade
 * to black and back, the world washed in a colour, a flash. Three layers over the page, read from the bus each frame;
 * emitted only where a level's events carry the screen's vars, so a level that names none carries none of it.
 *
 *   screenFxOn(events)   → the events carry the screen's vars
 *   screenFxScript()     → the page's layer: `__stepScreen()`, called each frame after the bus is synced
 */
import { SCREEN_VARS } from '../../playscape/ui/cues.js';

export const screenFxOn = (events) => !!events && !!events.vars && Object.values(SCREEN_VARS).some((v) => v in events.vars);

export function screenFxScript() {
  const V = SCREEN_VARS;
  return `
// THE SCREEN LAYER (screen-fx.js): a cue's fade, tint and flash, over everything
const __scrHost = (typeof wrap !== 'undefined' && wrap) || document.body;
const __scrLayer = (bg, ease) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:40;opacity:0;background:' + bg + ';transition:' + ease; __scrHost.appendChild(d); return d; };
const __scrTint = __scrLayer('transparent', 'opacity .6s ease, background-color .6s ease'), __scrFade = __scrLayer('#000', 'opacity .8s ease'), __scrFlash = __scrLayer('#fff', 'none');
let __scrN = 0, __scrT = '', __scrF = -1;
function __stepScreen() {
  const V = __busState.vars, f = V[${JSON.stringify(V.fade)}] ? 1 : 0, t = V[${JSON.stringify(V.tint)}] || '', n = V[${JSON.stringify(V.flash)}] || 0;
  if (f !== __scrF) { __scrF = f; __scrFade.style.opacity = String(f); }
  if (t !== __scrT) { __scrT = t; if (t) __scrTint.style.backgroundColor = t; __scrTint.style.opacity = t ? '0.35' : '0'; }
  if (n !== __scrN) {
    __scrN = n; __scrFlash.style.transition = 'none'; __scrFlash.style.backgroundColor = V[${JSON.stringify(V.flashColour)}] || '#ffffff'; __scrFlash.style.opacity = '0.85';
    requestAnimationFrame(() => requestAnimationFrame(() => { __scrFlash.style.transition = 'opacity .45s ease-out'; __scrFlash.style.opacity = '0'; }));
  }
}
`;
}
