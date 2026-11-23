// In-page script: WHAT IS IN HAND's menu (worlds/controllable/carry.js) — the held menus a pilot who carries this way
// opens, and what the screen shows of them. Emitted only into a page whose world has a rule with `carry`, after the
// gunplay view's and the aim's (it wraps __readInput after them), so every other page keeps every byte.
//
//   equip   held: G, the D-pad's up: the weapon menu (nothing in hand, then each weapon)
//   item    held: H, the D-pad's left: the item menu (the consumables left)
//   the look steps it (the mouse, the right stick); the wheel steps it too. Let go: the place stepped to.
// The keys and the wheel that switched a kit's slots are held off: the menu alone says what is in hand.
// The strip is plain DOM for now (a spike's): the game's menus are mana-ui's, and this joins them when it is kept.
export function carryScript() {
  return `
// ── WHAT IS IN HAND ──
const __CV = { wheel: 0 };
__canvas.addEventListener('wheel', (ev) => { __CV.wheel += ev.deltaY > 0 ? 1 : -1; }, { passive: true });
const __cvRead0 = __readInput;
__readInput = function () {
  const inp = __cvRead0();
  if (window.__mojMenuOpen) return inp;
  const g = __padNow(), gr = g ? __CTL.gamepadRead(g, __DEV) : null, pb = (id) => !!gr && __CTL.held(__BIND, id, 'gamepad', gr);
  inp.equipHold = __k('equip') || pb('equip') ? 1 : 0;
  inp.itemHold = __k('item') || pb('item') ? 1 : 0;
  inp.cycle = 0; inp.slot = 0;
  inp.step = (inp.equipHold || inp.itemHold) && __CV.wheel ? Math.sign(__CV.wheel) : 0;
  __CV.wheel = 0;
  return inp;
};
const __cvEl = document.createElement('div');
__cvEl.style.cssText = 'position:fixed;left:50%;bottom:16%;transform:translateX(-50%);display:none;z-index:7;pointer-events:none;font:17px/1.2 ui-monospace,monospace;color:#e8e6e1;text-align:center';
document.body.appendChild(__cvEl);
let __cvKey = '';
// (what the menu holds, by name: nothing in hand and each weapon, or each consumable left)
function __cvRows(p, C) {
  const R = p.rule.carry || {}, lo = Array.isArray(p.rule.loadout) ? p.rule.loadout : [];
  return C.menu === 'weapon' ? [{ name: 'unarmed' }].concat(lo.map((s, i) => ({ name: (s && s.name) || ('weapon ' + (i + 1)) })))
    : (R.items || []).map((it, i) => ({ name: it.name || it.id, count: C.counts[i] })).filter((x) => x.count > 0);
}
// ON A PAGE WHOSE HUD IS THE GAME'S (channels/mana-hud.js): the held menu is its weapon wheel, each thing at its place
// round the ring, the one stepped to lit; this strip is put away. The page's own selector answers when no menu is held.
{ const own = window.__mojWc && window.__mojWc.view;
  window.__mojWc = { view: () => {
    const p = __world.pilotId && __world.byId[__world.pilotId], C = p && p.carry;
    if (!C || !C.menu || !window.__mojHud) return own ? own() : { open: false, rows: [] };
    const P = __cvRows(p, C), n = Math.max(1, P.length);
    return { open: true, title: (C.menu === 'weapon' ? 'in hand' : 'use') + ' · look to step · let go to choose', rows: P.map((x, i) => ({ name: x.name, at: (360 * i) / n, key: '', on: i === C.sel, count: x.count ? '\u00d7' + x.count : '', sub: x.count ? '\u00d7' + x.count : '' })) };
  } };
}
(function __cvFrame() {
  requestAnimationFrame(__cvFrame);
  const p = __world.pilotId && __world.byId[__world.pilotId], C = p && p.carry;
  if (!C || !C.menu || window.__mojHud) { if (__cvKey) { __cvKey = ''; __cvEl.style.display = 'none'; } return; }
  const R = p.rule.carry || {}, lo = Array.isArray(p.rule.loadout) ? p.rule.loadout : [];
  const P = C.menu === 'weapon' ? [{ name: 'unarmed' }].concat(lo.map((s, i) => ({ name: (s && s.name) || ('weapon ' + (i + 1)) })))
    : (R.items || []).map((it, i) => ({ name: it.name || it.id, count: C.counts[i] })).filter((x) => x.count > 0);
  const key = C.menu + ':' + C.sel + ':' + P.map((x) => x.name + (x.count || '')).join(',');
  if (key === __cvKey) return;
  __cvKey = key;
  __cvEl.style.display = 'block';
  __cvEl.innerHTML = '<div style="opacity:.7;margin-bottom:6px;letter-spacing:.08em">' + (C.menu === 'weapon' ? 'IN HAND' : 'USE') + ' · look to step · let go to choose</div>'
    + (P.length ? P.map((x, i) => '<span style="display:inline-block;margin:0 6px;padding:12px 20px;border:1px solid ' + (i === C.sel ? '#e8e6e1' : '#4a4d55') + ';background:' + (i === C.sel ? 'rgba(232,230,225,.16)' : 'rgba(14,15,18,.72)') + '">' + x.name + (x.count ? ' ×' + x.count : '') + '</span>').join('') : '<span style="opacity:.7">nothing left</span>');
})();
`;
}
