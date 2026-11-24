// In-page script: a metroidvania's HELD GATES seen (worlds/controllable/held-gates.js): what the hero picks up said as
// it is taken, a band across the top of the screen with its name, held a moment and gone; what the hero holds listed
// small under it. The gates themselves are breakables: the page's break pass hides each as it opens.
// Emitted only into a page whose world has held gates, so every other page keeps every byte.

export const HELD_TOAST = Object.freeze({ hold: 2.4, fade: 0.5 });

export function heldGatesScript() {
  return `
// HELD GATES (held-gates-view.js): what the hero picks up, said as it is taken
const __HG = ${JSON.stringify(HELD_TOAST)};
const __hgEl = document.createElement('div');
__hgEl.style.cssText = 'position:fixed;left:50%;top:9%;transform:translateX(-50%);padding:10px 28px;background:rgba(10,8,14,.82);color:#f3e6c4;font:600 20px/1.2 Georgia,serif;letter-spacing:.06em;border-top:1px solid #c9a75a;border-bottom:1px solid #c9a75a;pointer-events:none;opacity:0;transition:opacity .2s;z-index:30;text-align:center';
const __hgHeld = document.createElement('div');
__hgHeld.style.cssText = 'position:fixed;left:16px;bottom:14px;color:#cfc6b0;font:12px/1.4 Georgia,serif;pointer-events:none;z-index:30;text-shadow:0 1px 2px #000';
document.body.appendChild(__hgEl); document.body.appendChild(__hgHeld);
let __hgSeen = 0, __hgAt = -1;
function __hgFrame() {
  const G = __world.heldGates;
  if (!G) return;
  if (G.got.length > __hgSeen) {
    const g = G.got[G.got.length - 1]; __hgSeen = G.got.length; __hgAt = __world.time;
    __hgEl.textContent = g.name;
    __hgHeld.textContent = G.got.map((x) => x.name).join(' · ');
  }
  const age = __world.time - __hgAt;
  __hgEl.style.opacity = __hgAt < 0 || age > __HG.hold + __HG.fade ? '0' : age > __HG.hold ? String(1 - (age - __HG.hold) / __HG.fade) : '1';
}
const __hgStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __hgStep0(dt, inputOverride); __hgFrame(); };
`;
}
