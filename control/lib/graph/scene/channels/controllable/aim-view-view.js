// In-page script: THE AIM HELD's hands (worlds/controllable/aim-view.js) — what a pilot who aims this way presses. Emitted
// only into a page whose world has a rule with `aimView`, after the controllable channel's own script and the gunplay
// view's (it wraps __readInput after them), so every other page keeps every byte. The page reads the OPERATIVE scheme
// (controls/schemes.js) in the pilot's place, so every control here is a binding, never a key.
//
//   aim        held: the right mouse, the left trigger
//   view       an edge: Tab, the right shoulder (to the eye and back, while aiming)
//   shoulder   an edge: Q, the right stick's click (the other shoulder, while aiming)
//   reload     R, the east face (a gunplay kit's reload)
//   dive       the jump's own button (Space, the north face), read as the dive's
//   act        the action (E, the west face), held: what a takedown is taken on
//   crouch     C, the south face or the left stick's click: down, and up again; held, lying (stance.js)
// The body hidden while the camera rides its eye is the controllable channel's own line (__avHides).
export function aimViewScript() {
  return `
// ── THE AIM HELD ──
const __AV = { aim: false };
__canvas.addEventListener('mousedown', (ev) => { if (__mb('aim', ev)) __AV.aim = true; });
window.addEventListener('mouseup', (ev) => { if (__mb('aim', ev)) __AV.aim = false; });
__canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
window.addEventListener('keydown', (ev) => { if (__CTL.is(__BIND, 'view', 'keyboard', ev.code)) ev.preventDefault(); });
window.addEventListener('blur', () => { __AV.aim = false; });
const __avRead0 = __readInput;
__readInput = function () {
  const inp = __avRead0();
  if (window.__mojMenuOpen) return inp;
  const g = __padNow(), gr = g ? __CTL.gamepadRead(g, __DEV) : null, pb = (id) => !!gr && __CTL.held(__BIND, id, 'gamepad', gr);
  inp.aim = inp.aim || __AV.aim || pb('aim') ? 1 : 0;
  inp.view = __k('view') || pb('view') ? 1 : 0;
  inp.shoulder = __k('shoulder') || pb('shoulder') ? 1 : 0;
  if (__k('reload') || pb('reload')) inp.reload = 1;
  // (the jump's button as the dive's, dive.js, and the action as a level: free-run.js climbs on it; a rule that asks for
  // neither reads neither)
  inp.dive = inp.jumpHeld || inp.jump ? 1 : 0;
  inp.act = __k('interact') || pb('interact') ? 1 : 0;
  inp.crouch = __k('crouch') || pb('crouch') ? 1 : 0;
  return inp;
};
`;
}
