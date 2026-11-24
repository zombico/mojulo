// In-page script: INVISIBLE MODE (worlds/controllable/ghost.js) — the designer's walk: I toggles it, and while it is on
// a badge at the top of the screen says so and the operative is drawn faint, so the walk is never mistaken for play.
//
// Emitted only into a page whose pilot carries `rule.ghost`, so every other page keeps every byte. Needs __world and
// __bodies (the drawn bodies by id, when exposed) in scope; reads and writes only the pilot's `rule.ghost`.
export function ghostScript() {
  return `
// ── INVISIBLE MODE ──
const __GH = { badge: null, was: null };
(function () {
  const b = document.createElement('div');
  b.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:14;pointer-events:none;font:600 12px/1 ui-monospace,monospace;letter-spacing:.14em;color:#d8f0ff;background:rgba(10,20,30,.62);border:1px solid rgba(160,210,255,.45);border-radius:999px;padding:7px 14px;display:none';
  document.body.appendChild(b);
  __GH.badge = b;
})();
const __ghOn = () => { const p = __world.pilotId ? __world.byId[__world.pilotId] : null, G = p && p.rule && p.rule.ghost; return !!G && (G === true || !!G.on); };
window.addEventListener('keydown', (ev) => {
  if (ev.code !== 'KeyI' || ev.repeat) return;
  const p = __world.pilotId ? __world.byId[__world.pilotId] : null;
  if (!p || !p.rule || !p.rule.ghost) return;
  p.rule.ghost = { on: !__ghOn() };
});
(function __ghFrame() {
  requestAnimationFrame(__ghFrame);
  const on = __ghOn();
  if (on === __GH.was) return;
  __GH.was = on;
  __GH.badge.textContent = on ? 'INVISIBLE  ·  no guard can see you  ·  I to be seen' : 'SEEN  ·  I to walk unseen';
  __GH.badge.style.display = 'block';
  __GH.badge.style.opacity = on ? '1' : '0.55';
})();
`;
}
