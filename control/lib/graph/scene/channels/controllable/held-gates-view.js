// In-page script: a metroidvania's HELD GATES seen (worlds/controllable/held-gates.js): what the hero picks up said as
// it is taken, a band across the top of the screen with its name, held a moment and gone (and a save room's "Saved", a
// waking after death); what the hero holds listed small under it; her health and MP as bars at the top left, under the page's own
// buttons (the page's health panel hidden: one set of vitals). The gates themselves are breakables: the page's break pass hides each as it opens.
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
// (her VITALS, an action RPG's: health and MP as bars at the top left, read off her body and her moveset's pool; no lives)
const __hgV = document.createElement('div');
__hgV.style.cssText = 'position:fixed;left:16px;top:62px;width:220px;pointer-events:none;z-index:30;font:600 11px/1 Georgia,serif;color:#e8dcc0;letter-spacing:.08em;text-shadow:0 1px 2px #000';
__hgV.innerHTML = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="width:22px">HP</span><div style="flex:1;height:9px;background:#2a1418;border:1px solid #6b3a2e"><div data-hp style="height:100%;width:100%;background:linear-gradient(#e0565a,#9c1e2c)"></div></div></div>'
  + '<div style="display:flex;align-items:center;gap:6px"><span style="width:22px">MP</span><div style="flex:1;height:7px;background:#141a2a;border:1px solid #34406b"><div data-mp style="height:100%;width:100%;background:linear-gradient(#6f9cf0,#2a4ea8)"></div></div></div>';
document.body.appendChild(__hgV);
const __hgHp = __hgV.querySelector('[data-hp]'), __hgMp = __hgV.querySelector('[data-mp]');
let __hgSeen = 0, __hgAt = -1;
function __hgFrame() {
  const G = __world.heldGates;
  if (!G) return;
  // (one set of vitals: the page's own health panel, drawn and shown for any body with an hpMax, gives way to the castle's)
  if (typeof __hp !== 'undefined' && __hp && __hp.wrap && __hp.wrap.style.display !== 'none') __hp.wrap.style.display = 'none';
  // (a game with a look draws these on mana-ui, gameworld/metroidvania/hud.js: this page's own band and bars give way)
  if (window.__mojHud && window.__mojHud.state && window.__mojHud.state.bx) { if (__hgV.parentNode) { __hgEl.remove(); __hgHeld.remove(); __hgV.remove(); } return; }
  const T = __world.byId[G.spec.target || 'hero'];
  if (T) {
    const hp = T.body && Number.isFinite(T.body.hp) && T.hpMax ? Math.max(0, T.body.hp / T.hpMax) : 1, M = T.rule && T.rule.moveset && T.rule.moveset.mp;
    __hgHp.style.width = (hp * 100).toFixed(1) + '%';
    __hgMp.style.width = (M ? Math.max(0, (T.mp == null ? M.max : T.mp) / M.max) * 100 : 0).toFixed(1) + '%';
  }
  if (G.got.length > __hgSeen) {
    const g = G.got[G.got.length - 1]; __hgSeen = G.got.length; __hgAt = __world.time;
    __hgEl.textContent = g.name;
    __hgHeld.textContent = G.got.filter((x) => !x.kind).map((x) => x.name).join(' · ');
  }
  const age = __world.time - __hgAt;
  __hgEl.style.opacity = __hgAt < 0 || age > __HG.hold + __HG.fade ? '0' : age > __HG.hold ? String(1 - (age - __HG.hold) / __HG.fade) : '1';
}
const __hgStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __hgStep0(dt, inputOverride); __hgFrame(); };
`;
}
