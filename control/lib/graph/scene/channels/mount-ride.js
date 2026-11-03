import { REACH_CSS } from './interact-channel.js';

// In-page script: GETTING ON AND OFF a mount (worlds/controllable/mount.js: a horse's `mount`, its `ride` rule), riding the
// controllable runtime (window.__mojCtrl: its world and its interact presses). The pilot on foot, a body that rides,
// within a free horse's reach is offered it: the reach prompt shows the live interact key and "ride"; riding at a walk or
// halted, "get off". The press is handed to the runtime (`mountPress`, read on its next step), which does the rest. The
// bus, when the page has one, hears the runtime's `mounting`, `mounted` and `dismounted` { rider, mount }: a game counts
// them. Absent a mount ⇒ NOT emitted.
export function mountRideScript() {
  return `
// --- mounts: the reach of a horse, getting on and off ---
(function () {
  const el = document.createElement('div'); el.className = 'moj-reach'; (typeof wrap !== 'undefined' ? wrap : document.body).appendChild(el);
  if (!window.__mojUses) { const st = document.createElement('style'); st.textContent = ${JSON.stringify(REACH_CSS)}; document.head.appendChild(st); }
  let prevN = null, shown = '';
  (function tick() {
    requestAnimationFrame(tick);
    const C = window.__mojCtrl; if (!C || !C.world || !C.world.byId) return;
    const W = C.world, pilot = W.byId[W.pilotId];
    if (!pilot) return;
    // what a press would do: get on the nearest free horse in reach, or get off the one ridden
    let ask = '';
    if (pilot.mount && pilot.riderId) {
      const p = W.byId[pilot.riderId];
      if (p && p.mountPhase === 'ride' && Math.abs(pilot.speed || 0) <= (pilot.mount.slow || 1.8) && pilot.jumpT == null) ask = 'get off';
    } else if (pilot.rides && !pilot.mountedOn) {
      for (const h of W.entities) {
        if (!h.mount || h.riderId || h.downed || h.gone) continue;
        if (Math.hypot(h.transform.pos[0] - pilot.transform.pos[0], h.transform.pos[1] - pilot.transform.pos[1]) < (h.mount.reach || 2.6)) { ask = 'ride'; break; }
      }
    }
    const n = C.interacts ? C.interacts() : 0;
    if (prevN !== null && n !== prevN && ask && !window.__mojMenuOpen && !window.__mojReach) W.mountPress = 1;
    prevN = n;
    // the runtime's moments, to the bus
    if (W.mountEvents && W.mountEvents.length) { for (const ev of W.mountEvents.splice(0)) if (typeof __inputQueue !== 'undefined') __inputQueue.push(ev); }
    const key = ask && C.label ? C.label('interact') : '';
    const h = ask && !window.__mojMenuOpen && !window.__mojReach ? '<b>' + (key || 'E').replace(/[<&]/g, '') + '</b>' + ask : '';
    if (h !== shown) { shown = h; el.innerHTML = h; el.style.display = h ? 'block' : 'none'; }
  })();
})();
`;
}
