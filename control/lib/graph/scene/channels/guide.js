import { safeJson } from '../emit-util.js';

// In-page script: THE GUIDE (level/guide.js, a sketched map's page): its INTRO, the level's pitch held in the middle of
// the screen as the page opens and faded, and THE WAY ON, the journey's beats on this page one at a time: the beat in
// words at the top of the screen with an arrow turned the way it lies from where the camera looks and the metres to it,
// and a pillar of light standing where it is. A beat is reached within its radius (a fight once its foes about it are
// down: no one of the foes' team standing within the radius); the last one reached, the line says the way is the page's.
// It reads the pilot and the cast through window.__mojCtrl (the controllable channel's), so it waits for it. Emitted only
// when the page has a guide: every other page byte-identical.
export function guideScript(guide) {
  return `
// --- the guide: the level's intro and the way on (level/guide.js) ---
(function () {
  const GD = ${safeJson(guide)};
  const host = (typeof wrap !== 'undefined' && wrap) || document.body;
  const css = 'position:absolute;left:50%;transform:translateX(-50%);pointer-events:none;z-index:14;font:600 15px/1.35 system-ui,sans-serif;color:#fff8e6;text-shadow:0 1px 4px rgba(0,0,0,.75);text-align:center';
  if (GD.intro) {
    const card = document.createElement('div');
    card.style.cssText = css + ';top:30%;max-width:min(560px,80%);padding:14px 20px;background:rgba(20,16,10,.55);border:1px solid rgba(255,230,180,.35);border-radius:6px;font:500 18px/1.45 Georgia,serif;transition:opacity 1.2s';
    card.textContent = GD.intro;
    host.appendChild(card);
    setTimeout(() => { card.style.opacity = '0'; setTimeout(() => card.remove(), 1400); }, 7000);
  }
  const line = document.createElement('div');
  line.style.cssText = css + ';top:14px;display:none;padding:5px 12px;background:rgba(20,16,10,.38);border-radius:14px';
  const arrow = document.createElement('span'), words = document.createElement('span'), dist = document.createElement('span');
  arrow.textContent = '▲'; arrow.style.cssText = 'display:inline-block;margin-right:8px;color:#ffd36b;transition:transform .08s linear';
  dist.style.cssText = 'margin-left:8px;opacity:.75;font-weight:500';
  line.append(arrow, words, dist); host.appendChild(line);
  let k = 0, pillar = null;
  const T3 = typeof THREE !== 'undefined' ? THREE : null, S3 = typeof scene !== 'undefined' ? scene : null;
  function plant() {
    if (!T3 || !S3) return;
    if (pillar) { S3.remove(pillar); pillar = null; }
    const s = GD.steps[k]; if (!s) return;
    pillar = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.5, 60, 12, 1, true), new T3.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.28, depthWrite: false, side: T3.DoubleSide }));
    pillar.rotation.x = Math.PI / 2; pillar.position.set(s.at[0], s.at[1], s.at[2] + 30); pillar.raycast = function () {};
    S3.add(pillar);
  }
  function show() { const s = GD.steps[k]; if (!s) { words.textContent = 'The way on lies past this place'; arrow.style.display = 'none'; dist.textContent = ''; } else { words.textContent = s.say; arrow.style.display = ''; } line.style.display = ''; }
  const view = T3 ? new T3.Vector3() : null;
  function tick() {
    const W = window.__mojCtrl && window.__mojCtrl.world;
    if (W) {
      if (!line.style.display || line.style.display === 'none') { show(); plant(); }
      const p = (W.pilotId && W.byId[W.pilotId]) || W.entities.find((e) => e.pilotable);
      const s = GD.steps[k];
      if (p && s) {
        const dx = s.at[0] - p.transform.pos[0], dy = s.at[1] - p.transform.pos[1], d = Math.hypot(dx, dy);
        const standing = s.fight ? W.entities.some((e) => e.team === 'foes' && !e.gone && !e.downed && !(e.hp <= 0) && Math.hypot(e.transform.pos[0] - s.at[0], e.transform.pos[1] - s.at[1]) < s.radius) : false;
        if (d < s.radius && !standing) { k++; show(); plant(); }
        else {
          let yaw = p.transform.heading;
          if (view && typeof camera !== 'undefined') { camera.getWorldDirection(view); yaw = Math.atan2(view.y, view.x); }
          arrow.style.transform = 'rotate(' + (-(Math.atan2(dy, dx) - yaw)) + 'rad)';
          dist.textContent = Math.round(d) + ' m' + (standing && d < s.radius ? ' · fight' : '');
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__mojGuide = { step: () => k, steps: GD.steps.length };
})();
`;
}
