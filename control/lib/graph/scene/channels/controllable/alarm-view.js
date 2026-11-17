// In-page script: THE ALARM, SHOWN — a garrison's state of alert (worlds/controllable/alarm.js) as the player reads it,
// at the top of the screen in place of a sighting's SEEN. Emitted only into a page whose watchers carry an alarm, so every
// other page keeps every byte.
//
//   clear             nothing
//   THREAT DETECTED   orange: something was glimpsed, heard or found. Its bar drains while nothing new happens; empty,
//                     the team stands down
//   THREAT FOUND      red: a guard was sure and the call went through. Its bar is full while any guard sees you and
//                     drains only while none does: hide, and it dies down to orange
//   the call          while a guard radios it in, a line under the state says so with its progress: put it down first
//   backup            at red, when backup was sent, the line says so
// The screen's edge takes the state's colour, faintly. It reads the world and draws; it changes nothing.
export function alarmScript() {
  return `
// ── THE ALARM, SHOWN ──
const __AL = { el: null, bar: null, sub: null, edge: null, key: '' };
(function () {
  const d = (css) => { const x = document.createElement('div'); x.style.cssText = css; return x; };
  __AL.el = d('position:fixed;left:50%;top:5%;transform:translateX(-50%);z-index:12;pointer-events:none;display:none;text-align:center;font:700 22px/1 ui-monospace,monospace;letter-spacing:.16em;text-shadow:0 2px 0 rgba(0,0,0,.55)');
  __AL.label = d(''); __AL.track = d('margin:8px auto 0;width:240px;height:5px;background:rgba(255,255,255,.18)'); __AL.bar = d('height:100%;width:100%');
  __AL.sub = d('margin-top:7px;font:600 13px/1.2 ui-monospace,monospace;letter-spacing:.08em;color:#f2f2f2');
  __AL.track.appendChild(__AL.bar); __AL.el.append(__AL.label, __AL.track, __AL.sub); document.body.appendChild(__AL.el);
  __AL.edge = d('position:fixed;inset:0;z-index:6;pointer-events:none;display:none'); document.body.appendChild(__AL.edge);
})();
(function __alFrame() {
  requestAnimationFrame(__alFrame);
  const A = __world.alarm; if (!A) return;
  // (the team whose state is highest: found over detected over clear)
  let S = null; for (const k in A) { const x = A[k]; if (!S || (x.phase === 'found' ? 2 : x.phase === 'detected' ? 1 : 0) > (S.phase === 'found' ? 2 : S.phase === 'detected' ? 1 : 0) || (x.call && !S.call)) S = x; }
  const on = S && (S.phase !== 'clear' || S.call);
  __AL.el.style.display = on ? 'block' : 'none'; __AL.edge.style.display = on ? 'block' : 'none';
  if (!on) return;
  const red = S.phase === 'found', col = red ? '#ff3b30' : '#ff9a2e';
  __AL.label.textContent = red ? 'THREAT FOUND' : 'THREAT DETECTED'; __AL.label.style.color = col;
  __AL.bar.style.background = col; __AL.bar.style.width = (S.full > 0 ? Math.max(0, Math.min(1, S.left / S.full)) * 100 : 100).toFixed(1) + '%';
  __AL.sub.textContent = S.call ? 'a guard is radioing it in · ' + Math.round(Math.min(1, S.call.t / S.call.of) * 100) + '%' : red && S.backup ? 'backup called · stay out of sight' : red ? 'stay out of sight' : '';
  __AL.edge.style.boxShadow = 'inset 0 0 ' + (red ? 140 : 90) + 'px ' + (red ? 'rgba(255,59,48,.38)' : 'rgba(255,154,46,.26)');
})();
`;
}
