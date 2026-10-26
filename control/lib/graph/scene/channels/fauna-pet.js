import { safeJson } from '../emit-util.js';
import { REACH_CSS } from './interact-channel.js';

// In-page script: PETTING a level's fauna (a biocube herd's `interact: 'pet'`, era/biocube-fauna.js placeHerds), riding
// the controllable runtime (window.__mojCtrl: its world and its interact presses). The petter is the pilot when there
// is one, else the walker's eye. The nearest pettable animal in its `reach` (planar) is offered: the reach prompt shows
// the live interact key and "pet"; the press holds the animal (the cast's hold: its mind waits) turned to the petter,
// playing its relax loop (a `clip` of its own, else standing) for `hold` seconds, a heart rising over it; then it goes
// back to grazing or wandering. The bus, when the page has one, hears `petted` { entity, species }: a game counts it.
// A downed or sent-away animal is never offered. The page's own: Godot plays the herds, not the petting.
// Absent a pettable animal ⇒ NOT emitted.
// `cfg`: { pets: { <entity id>: { reach, hold, species, clip? } } }
export function faunaPetScript(cfg) {
  return `
// --- fauna pets: the reach of a pettable animal, and the petting ---
(function () {
  const PETS = ${safeJson(cfg.pets)};
  const ids = Object.keys(PETS);
  if (!ids.length) return;
  const el = document.createElement('div'); el.className = 'moj-reach'; (typeof wrap !== 'undefined' ? wrap : document.body).appendChild(el);
  if (!window.__mojUses) { const st = document.createElement('style'); st.textContent = ${JSON.stringify(REACH_CSS)}; document.head.appendChild(st); }
  // a heart over a petted animal: a sprite rising and fading
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d'); cx.fillStyle = '#ff6f91'; cx.beginPath(); cx.moveTo(32, 54);
  cx.bezierCurveTo(4, 34, 8, 8, 32, 22); cx.bezierCurveTo(56, 8, 60, 34, 32, 54); cx.fill();
  const heartTex = new THREE.CanvasTexture(cv);
  const hearts = [], held = {};
  let prevN = null, shown = '', last = null;
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  function petter(W) {
    const p = W.pilotId && W.byId[W.pilotId];
    return p && p.transform ? p.transform.pos : [camera.position.x, camera.position.y, camera.position.z];
  }
  (function tick() {
    requestAnimationFrame(tick);
    const C = window.__mojCtrl; if (!C || !C.world || !C.world.byId) return;
    const W = C.world, me = petter(W), t = clock(), dt = last == null ? 0 : Math.min(0.1, t - last); last = t;
    // the held: content while their time lasts, then let go to their own minds
    for (const id in held) {
      const e = W.byId[id], h = held[id];
      if (!e || e.downed || e.gone || t >= h.until) { if (e && !e.downed && !e.gone) { e.held = false; e.moving = false; } delete held[id]; continue; }
      if (h.clip) { e.moving = true; e.locomotion = h.clip; e.gaitPhase = (e.gaitPhase || 0) + dt / 3; }
    }
    // the nearest pettable in reach
    let best = null, bd = Infinity;
    for (const id of ids) {
      const e = W.byId[id]; if (!e || e.downed || e.gone || held[id]) continue;
      const d = Math.hypot(e.transform.pos[0] - me[0], e.transform.pos[1] - me[1]);
      if (d < PETS[id].reach && d < bd) { bd = d; best = e; }
    }
    const n = C.interacts ? C.interacts() : 0;
    if (prevN !== null && n !== prevN && best && !window.__mojMenuOpen && !window.__mojReach) {
      const P = PETS[best.id];
      best.route = null; best.held = true; best.moving = false; best.locomotion = 'forward';
      best.transform.heading = Math.atan2(me[1] - best.transform.pos[1], me[0] - best.transform.pos[0]);
      held[best.id] = { until: t + P.hold, clip: P.clip || null };
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
      s.raycast = () => {}; s.scale.set(0.35, 0.35, 0.35); scene.add(s); hearts.push({ s, e: best, t0: t });
      if (typeof __inputQueue !== 'undefined') __inputQueue.push({ type: 'petted', entity: best.id, species: P.species });
      best = null;
    }
    prevN = n;
    for (let i = hearts.length - 1; i >= 0; i--) {
      const H = hearts[i], k = (t - H.t0) / 1.6, p = H.e.transform.pos;
      if (k >= 1) { scene.remove(H.s); hearts.splice(i, 1); continue; }
      H.s.position.set(p[0], p[1], p[2] + 1 + 0.8 * k); H.s.material.opacity = 1 - k;
    }
    const key = best && C.label ? C.label('interact') : '';
    const h = best && !window.__mojMenuOpen && !window.__mojReach ? '<b>' + (key || 'E').replace(/[<&]/g, '') + '</b>pet' : '';
    if (h !== shown) { shown = h; el.innerHTML = h; el.style.display = h ? 'block' : 'none'; }
  })();
})();
`;
}
