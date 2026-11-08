import { safeJson } from '../emit-util.js';

// In-page script: THE GUIDE (level/guide.js, a sketched map's page): the level's INTRO and THE WAY ON, a beat at a time.
// ONE THING AT A TIME, in one place at the top of the screen, by what the moment asks:
//   a beat's line said on reaching it (`says`: a meet's words, a find's item), for a few seconds
//   the intro (the pitch) as the page opens, then the arrival's keys (`introKeys`)
//   at a held way (`held`) while a foe stands on the page: that it is held
//   near a beat that teaches (`keys`), or in its fight: its keys, each key a cap
//   else the way on: an arrow turned the way the beat lies from where the camera looks, its words, the metres to it
// Never two at once. A pillar of light stands where the beat is (the world's own marker, not the screen's). A beat is
// reached within its radius (a fight once its foes about it are down); the last one reached, the way is the page's.
// Its words sit on the scene, outlined, never on a card. It reads the pilot and the cast through window.__mojCtrl (the
// controllable channel's), so it waits for it. Emitted only when the page has a guide: every other page byte-identical.
export function guideScript(guide) {
  return `
// --- the guide: the level's intro and the way on, one thing at a time (level/guide.js) ---
(function () {
  const GD = ${safeJson(guide)};
  const host = (typeof wrap !== 'undefined' && wrap) || document.body;
  const sheet = document.createElement('style');
  sheet.textContent = '.moj-gd{position:absolute;left:50%;top:22px;transform:translateX(-50%);pointer-events:none;z-index:14;max-width:min(640px,86%);text-align:center;color:#fbf6e9;text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 10px rgba(0,0,0,.6);transition:opacity .35s ease;font:600 17px/1.35 system-ui,sans-serif;letter-spacing:.3px}'
    + '.moj-gd.off{opacity:0}.moj-gd .ar{display:inline-block;margin-right:10px;color:#f2c75c;transition:transform .08s linear}.moj-gd .m{margin-left:10px;opacity:.75;font-weight:500;font-size:14px}'
    + '.moj-gd.intro{top:28%;font:500 22px/1.45 Georgia,serif;letter-spacing:.2px}.moj-gd.say{top:auto;bottom:24%;font:500 18px/1.45 Georgia,serif}'
    + '.moj-gd .cap{display:inline-block;min-width:1.6em;margin:0 4px;padding:2px 7px;border:1.5px solid rgba(251,246,233,.9);border-bottom-width:3px;border-radius:5px;font:700 14px/1.2 ui-monospace,Menlo,monospace;background:rgba(10,8,6,.35);text-shadow:none}'
    + '.moj-gd .kw{margin:0 14px 0 4px;letter-spacing:1px;text-transform:uppercase;font-size:14px}';
  document.head.appendChild(sheet);
  const slot = document.createElement('div'); slot.className = 'moj-gd off'; host.appendChild(slot);
  // (what is up, and its text: redrawn only when it changes)
  let shown = '', mode = '';
  function put(m, html) { if (m === mode && html === shown) return; mode = m; shown = html; slot.className = 'moj-gd ' + m + (html ? '' : ' off'); slot.innerHTML = html; }
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // (a key line, 'F F  dodge · …': the keys before the double space as caps, the rest the words)
  const capped = (line) => { const i = line.indexOf('  '); if (i < 0) return '<span class="kw">' + esc(line) + '</span>'; return line.slice(0, i).split(' ').map((k) => '<span class="cap">' + esc(k) + '</span>').join('') + '<span class="kw">' + esc(line.slice(i + 2)) + '</span>'; };
  let k = 0, pillar = null, up = false, phase = GD.intro ? 'intro' : GD.introKeys && GD.introKeys.length ? 'keys0' : 'play', sayText = '', sayUntil = 0;
  const T3 = typeof THREE !== 'undefined' ? THREE : null, S3 = typeof scene !== 'undefined' ? scene : null;
  function plant() {
    if (!T3 || !S3) return;
    if (pillar) { S3.remove(pillar); pillar = null; }
    const s = GD.steps[k]; if (!s) return;
    pillar = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.5, 60, 12, 1, true), new T3.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.28, depthWrite: false, side: T3.DoubleSide }));
    pillar.rotation.x = Math.PI / 2; pillar.position.set(s.at[0], s.at[1], s.at[2] + 30); pillar.raycast = function () {};
    S3.add(pillar);
  }
  // (the opening's seconds counted from when the world is up, not from the page's parse)
  function begin() { up = true; plant(); if (phase === 'intro') setTimeout(() => { phase = GD.introKeys && GD.introKeys.length ? 'keys0' : 'play'; if (phase === 'keys0') setTimeout(() => { phase = 'play'; }, 5000); }, 6500); else if (phase === 'keys0') setTimeout(() => { phase = 'play'; }, 5000); }
  const standing = (e) => e.team === 'foes' && !e.gone && !e.downed && !(e.hp <= 0);
  const view = T3 ? new T3.Vector3() : null;
  function tick() {
    const W = window.__mojCtrl && window.__mojCtrl.world;
    if (W) {
      if (!up) begin();
      const p = (W.pilotId && W.byId[W.pilotId]) || W.entities.find((e) => e.pilotable), s = GD.steps[k];
      let dx = 0, dy = 0, d = Infinity, near = false;
      if (p && s) {
        dx = s.at[0] - p.transform.pos[0]; dy = s.at[1] - p.transform.pos[1]; d = Math.hypot(dx, dy);
        near = s.fight ? W.entities.some((e) => standing(e) && Math.hypot(e.transform.pos[0] - s.at[0], e.transform.pos[1] - s.at[1]) < s.radius) : false;
        if (d < s.radius && !near) { if (s.says) { sayText = s.says; sayUntil = performance.now() + 4500; } k++; plant(); }
      }
      const now = performance.now(), cur = GD.steps[k];
      const atHeld = p && GD.held && GD.held.some((h) => Math.hypot(h[0] - p.transform.pos[0], h[1] - p.transform.pos[1]) < 5) && W.entities.some(standing);
      // ONE THING: the line just said, the opening, a held way, a lesson at hand, else the way on
      if (now < sayUntil) put('say', esc(sayText));
      else if (phase === 'intro') put('intro', esc(GD.intro));
      else if (phase === 'keys0') put('keys', GD.introKeys.map(capped).join(''));
      else if (atHeld) put('held', 'The way on is held while foes stand here');
      else if (cur && cur.keys && cur.keys.length && p && d < Math.max(cur.radius * 2, 18)) put('keys', cur.keys.map(capped).join(''));
      else if (!cur) put('way', 'The way on lies past this place');
      else if (p) {
        let yaw = p.transform.heading;
        if (view && typeof camera !== 'undefined') { camera.getWorldDirection(view); yaw = Math.atan2(view.y, view.x); }
        put('way', '<span class="ar" style="transform:rotate(' + (-(Math.atan2(dy, dx) - yaw)).toFixed(2) + 'rad)">▲</span>' + esc(cur.say) + '<span class="m">' + Math.round(d) + ' m</span>');
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__mojGuide = { step: () => k, steps: GD.steps.length, held: GD.held || [], showing: () => mode };
})();
`;
}
