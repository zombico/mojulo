// In-page script: THE SPECIALS PALETTE (a moveset's specials, gameworld/combos.js mL mH mS, lowered as the moveset's
// `specials`): while the modifier is held (the right trigger, left Ctrl: controls/schemes.js `modifier`) a row of the
// hero's specials shows at the foot of the screen, each with the button that takes it, its name and its MP; one the
// pool cannot pay, cooling down or resting after a finisher is dimmed and says why; the MP pool beside them. Emitted
// only into a page whose hero plays a moveset, after the controllable channel's own script (it wraps __readInput), so
// every other page keeps every byte. A view: it reads the world and the input, and changes neither.
export function specialsPaletteScript() {
  return `
// ── THE SPECIALS PALETTE ──
const __SP = { el: null, shown: false, html: '' };
const __SP_BEATS = [['mL', 'light'], ['mH', 'heavy'], ['mS', 'special']];
const __SP_MOUSE = { light: 'Left click', heavy: 'Right click', special: 'Mouse 4' };
function __spLabel(id) { const L = window.__mojCtrl && window.__mojCtrl.label ? window.__mojCtrl.label(id) : ''; return L || __SP_MOUSE[id] || id; }
function __spUpdate(held) {
  const p = __world.pilotId && __world.byId[__world.pilotId], r = p && p.rule;
  const W = r && Array.isArray(r.weapons) ? r.weapons[p.weaponIdx || 0] : null, M = (W && W.moveset) || (r && r.moveset), S = M && M.specials;
  if (!held || !S) { if (__SP.shown) { __SP.el.style.display = 'none'; __SP.shown = false; } return; }
  if (!__SP.el) {
    __SP.el = document.createElement('div');
    __SP.el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);display:none;gap:10px;z-index:40;pointer-events:none;font:13px/1.35 ui-sans-serif,system-ui,sans-serif;color:#f3f1ec';
    document.body.appendChild(__SP.el);
  }
  const now = __world.time || 0, mv = p.mv || {}, mp = p.mp, pool = M.mp;
  let html = '';
  for (const [beat, id] of __SP_BEATS) {
    const X = S[beat]; if (!X) continue;
    const cool = Math.max(((mv.cool && mv.cool[X.move]) || -1e9) - now, (mv.restT || -1e9) - now);
    const why = X.mp && mp != null && mp < X.mp ? 'MP ' + Math.floor(mp) + ' / ' + X.mp : cool > 0 ? cool.toFixed(1) + ' s' : '';
    html += '<div style="min-width:118px;padding:7px 10px;border-radius:8px;border:1px solid ' + (why ? '#4a4d55' : '#c9a96a') + ';background:rgba(14,15,18,.86);opacity:' + (why ? 0.55 : 1) + '">'
      + '<div style="font-size:11px;letter-spacing:.04em;color:#c9a96a">' + __spLabel('modifier') + ' + ' + __spLabel(id) + '</div>'
      + '<div style="font-weight:600">' + X.name + '</div>'
      + '<div style="font-size:11px;color:#a9adb5">' + (X.mp ? X.mp + ' MP' : 'free') + (why ? ' · ' + why : '') + '</div></div>';
  }
  if (pool && mp != null) html += '<div style="align-self:center;padding:6px 10px;border-radius:8px;background:rgba(14,15,18,.86);font-size:12px;white-space:nowrap">MP <b>' + Math.floor(mp) + '</b> / ' + pool.max + '</div>';
  if (html !== __SP.html) { __SP.el.innerHTML = html; __SP.html = html; }
  if (!__SP.shown) { __SP.el.style.display = 'flex'; __SP.shown = true; }
}
const __spRead0 = __readInput;
__readInput = function () { const inp = __spRead0(); __spUpdate(!!(inp && inp.mod)); return inp; };
`;
}
