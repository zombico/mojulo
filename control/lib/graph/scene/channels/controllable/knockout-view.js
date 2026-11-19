// In-page script: KO AND KILL, SHOWN (worlds/controllable/knockout.js) — what the player reads of it:
//
//   a sleeper      a drifting "z z z" over a body knocked out, faint, so a body left asleep is seen to be (and a guard
//                  kneeling over one shows how far its waking has got, a ring filling round the z's)
//   drowsing       a guard a dart is in, its sleep coming on: the z's start small and grow
//   the hold       at the foot of the screen, what the action does: take hold of the sleeper in reach, or let go of the
//                  one dragged
//
// It reads the world and draws; it changes nothing. Emitted only into a page whose pilot carries `rule.knockout`, so
// every other page keeps every byte. Needs THREE, camera, __world and __CW (the runtime: koDragTarget) in scope.
export function knockoutScript() {
  return `
// ── KO AND KILL, SHOWN ──
const __KO = { tags: {}, hint: null, v: new THREE.Vector3() };
(function () {
  __KO.hint = document.createElement('div');
  __KO.hint.style.cssText = 'position:fixed;left:50%;bottom:14%;transform:translateX(-50%);z-index:12;pointer-events:none;display:none;font:600 14px/1 ui-monospace,monospace;letter-spacing:.12em;color:#e8e6e1;background:rgba(8,10,14,.62);padding:7px 12px;border:1px solid rgba(232,230,225,.25)';
  document.body.appendChild(__KO.hint);
})();
(function __koFrame() {
  requestAnimationFrame(__koFrame);
  const W = __world, p = W.pilotId ? W.byId[W.pilotId] : null, now = W.time || 0, seen = {};
  for (const e of W.entities) {
    const sleeping = !!e.ko && !e.gone, drowsy = !!e.koDrowse && !e.ko;
    if (!sleeping && !drowsy) continue;
    seen[e.id] = true;
    let t = __KO.tags[e.id];
    if (!t) { t = __KO.tags[e.id] = document.createElement('div'); t.style.cssText = 'position:fixed;z-index:11;pointer-events:none;transform:translate(-50%,-100%);font:italic 700 15px/1 Georgia,serif;color:#cfe3ff;text-shadow:0 0 6px rgba(80,140,255,.8);white-space:nowrap;text-align:center'; document.body.appendChild(t); }
    const q = e.transform.pos;
    __KO.v.set(q[0], q[1], q[2] + (sleeping ? 0.7 : 2.1)).project(camera);
    const on = __KO.v.z < 1 && Math.abs(__KO.v.x) < 1.1 && Math.abs(__KO.v.y) < 1.1;
    t.style.display = on ? 'block' : 'none';
    if (!on) continue;
    t.style.left = ((__KO.v.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; t.style.top = ((1 - __KO.v.y) / 2 * innerHeight).toFixed(1) + 'px';
    // (the z's drift up and fade in turn; a drowsing body's grow as its sleep comes on)
    const k = drowsy ? Math.min(1, e.koDrowse.t / Math.max(0.1, e.koDrowse.of)) : 1, ph = (now * 0.8) % 1;
    const z = (i) => '<span style="display:inline-block;font-size:' + (0.7 + 0.25 * i) * (0.6 + 0.4 * k) + 'em;opacity:' + (0.35 + 0.65 * ((ph + i / 3) % 1)).toFixed(2) + ';transform:translateY(' + (-6 * i - 6 * ((ph + i / 3) % 1)).toFixed(1) + 'px)">z</span>';
    const w = e.koWaker && W.byId[e.koWaker], wake = w && w.koWake && w.koWake.phase === 'wake' ? Math.min(1, w.koWake.t / 2.5) : 0;
    t.innerHTML = z(0) + z(1) + z(2) + (wake > 0 ? '<div style="margin:3px auto 0;width:34px;height:3px;background:rgba(255,255,255,.2)"><div style="height:100%;width:' + (wake * 100).toFixed(0) + '%;background:#ff9a2e"></div></div>' : '');
    t.style.opacity = sleeping && e.koDragged ? '0.5' : '1';
  }
  for (const id in __KO.tags) if (!seen[id]) { __KO.tags[id].remove(); delete __KO.tags[id]; }
  // the hold: what the action does now
  const tg = p && !p.koDrag && __CW.koDragTarget ? __CW.koDragTarget(W, p) : null;
  const say = p && p.koDrag ? 'E  ·  let go' : tg ? 'E  ·  drag the body' : '';
  __KO.hint.style.display = say ? 'block' : 'none';
  if (say && __KO.hint.textContent !== say) __KO.hint.textContent = say;
})();
`;
}
