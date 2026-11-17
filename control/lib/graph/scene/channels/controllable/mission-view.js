// In-page script: A MISSION, SHOWN — what worlds/controllable/mission.js holds, drawn and said. Emitted only into a page
// whose pilot's rule carries `mission`, so every other page keeps every byte.
//
//   things   each item a small turning marker until it is found; each clue a ring on the floor until it is read; each
//            way's two ends a plate on the floor (a lift's deck, a stairwell's threshold); each barrier a slab across its
//            passage until it opens
//   words    the objective the mission stands at (top left); what the action would do where the body stands, or what it
//            still needs (bottom middle); the last thing found, read or opened, for a few seconds; the result
//   a ride   the screen closed over the middle of it, so the body is seen leaving one floor and arriving on the other
// It reads the world and draws; it changes nothing the simulation reads. Plain DOM for now, not mana-ui's.
export function missionScript() {
  return `
// ── A MISSION, SHOWN ──
const __MS = { things: {}, t: 0 };
const __msEl = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:8;pointer-events:none;font:600 14px/1.35 ui-monospace,monospace;color:#e8ecef;text-shadow:0 1px 0 rgba(0,0,0,.7);' + css; document.body.appendChild(d); return d; };
const __msObj = __msEl('left:18px;top:16px;max-width:44vw;padding:8px 12px;background:rgba(12,16,20,.62);border-left:3px solid #e0b040');
const __msAct = __msEl('left:50%;bottom:19%;transform:translateX(-50%);padding:6px 12px;background:rgba(12,16,20,.62);display:none');
const __msSay = __msEl('left:50%;top:24%;transform:translateX(-50%);font-size:17px;letter-spacing:.06em;display:none');
const __msFade = __msEl('inset:0;background:#05070a;opacity:0;z-index:7');
const __msMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, fog: false, side: THREE.DoubleSide });
function __msThing(id, make) { let m = __MS.things[id]; if (!m) { m = __MS.things[id] = make(); m.raycast = () => {}; m.frustumCulled = false; scene.add(m); } return m; }
(function __msFrame() {
  requestAnimationFrame(__msFrame);
  const p = __world.pilotId ? __world.byId[__world.pilotId] : null, M = p && p.rule && p.rule.mission, S = __world.ms;
  if (!M) return;
  const now = __world.time || 0; __MS.t += 0.03;
  for (const it of M.items || []) { const m = __msThing('i:' + it.id, () => { const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), __msMat(0xffc94a, 0.95)); g.position.set(it.at[0], it.at[1], it.at[2] + 1.05); return g; }); m.visible = !(S && S.held[it.id]); m.rotation.z = __MS.t; }
  for (const c of M.clues || []) { const m = __msThing('c:' + c.id, () => { const g = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), __msMat(0x6fd6ff, 0.8)); g.position.set(c.at[0], c.at[1], c.at[2] + 0.05); return g; }); m.visible = !(S && S.read[c.id]); m.scale.setScalar(1 + 0.08 * Math.sin(__MS.t * 2)); }
  for (const w of M.ways || []) for (const k of ['a', 'b']) __msThing('w:' + w.id + k, () => { const lift = (w.kind || 'lift') === 'lift', r = (w.radius || 1.8); const g = new THREE.Mesh(lift ? new THREE.PlaneGeometry(r * 2, r * 2) : new THREE.PlaneGeometry(r * 1.4, r * 0.7), __msMat(lift ? 0xe0b040 : 0x8fd08c, 0.34)); g.position.set(w[k][0], w[k][1], w[k][2] + 0.04); return g; });
  for (const b of M.barriers || []) { const m = __msThing('b:' + b.id, () => { const g = new THREE.Mesh(new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]), new THREE.MeshBasicMaterial({ color: 0x39424a })); g.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2); return g; }); m.visible = !(S && S.open[b.id]); }
  const O = __CW.missionObjective ? __CW.missionObjective(__world) : null;
  __msObj.textContent = S && S.done ? 'MISSION COMPLETE' : O ? 'OBJECTIVE  ' + O.says : M.result && M.result.when.every((id) => S && S.held[id]) ? 'OBJECTIVE  get out' : (M.unsure ? 'OBJECTIVE  ' + M.unsure : '');
  let act = '';
  if (S && S.near && !S.ride) {
    const c = (M.clues || []).find((x) => x.id === S.near), w = (M.ways || []).find((x) => x.id === S.near);
    if (c) act = 'E  look closer';
    else if (w) act = S.locked ? (w.name || w.id) + ' · locked: needs ' + S.locked.map((n) => { const it = (M.items || []).find((x) => x.id === n); return it ? (it.name || n) : 'to know where it goes'; }).join(', ') : 'E  ' + ((w.kind || 'lift') === 'lift' ? 'ride the lift' : 'take the stairs');
  }
  __msAct.textContent = act; __msAct.style.display = act ? 'block' : 'none';
  const said = S && S.said && now - S.said.t < 4 ? S.said.text : '';
  __msSay.textContent = said; __msSay.style.display = said ? 'block' : 'none';
  const R = S && S.ride, u = R ? R.t / R.secs : 0;
  __msFade.style.opacity = R ? String(Math.max(0, Math.min(1, 1 - Math.abs(u - 0.5) * 4 + 1))) : '0';
  window.__mojMission = S || null;
})();
`;
}
