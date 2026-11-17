// In-page script: A MISSION, SHOWN — what worlds/controllable/mission.js holds, drawn and said. Emitted only into a page
// whose pilot's rule carries `mission`, so every other page keeps every byte.
//
//   things   each item a small turning marker until it is found; each clue a ring on the floor until it is read; each
//            way's two ends a plate on the floor (a lift's deck, a stairwell's threshold); each barrier a slab across its
//            passage until it opens
//   words    a hint, where the body stands in one; the objective the mission stands at (top left); what the action would do where the body stands, or what it
//            still needs (bottom middle); the last thing found, read or opened, for a few seconds; the result
//   a door   an exit's plate; taken, the screen closes and the page goes to the other segment's, what is held, read
//            and set and the body's health carried in the address (#ms=…), read back there as it loads
//   a shot   a decked ride to an end whose way names a cue: the page's shoot plan plays that shot and has the view, bars
//            top and bottom, until the ride ends
//   a ride   the screen closed over the middle of it, so the body is seen leaving one floor and arriving on the other
// It reads the world and draws; it changes nothing the simulation reads. Plain DOM for now, not mana-ui's.
export function missionScript() {
  return `
// ── A MISSION, SHOWN ──
// (what came in from another segment's page, in the address: taken by the simulation at its next step)
try { const m = /[#&]ms=([^&]*)/.exec(location.hash || ''); if (m) { __world.msCarry = JSON.parse(decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname + location.search); } } catch (e) {}
const __MS = { things: {}, t: 0, gone: false, shot: null };
const __msEl = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:8;pointer-events:none;font:600 14px/1.35 ui-monospace,monospace;color:#e8ecef;text-shadow:0 1px 0 rgba(0,0,0,.7);' + css; document.body.appendChild(d); return d; };
const __msObj = __msEl('left:18px;top:16px;max-width:44vw;padding:8px 12px;background:rgba(12,16,20,.62);border-left:3px solid #e0b040');
const __msAct = __msEl('left:50%;bottom:19%;transform:translateX(-50%);padding:6px 12px;background:rgba(12,16,20,.62);display:none');
// (a hint: what the player is told where it stands, low on the screen, plain)
const __msHint = __msEl('left:50%;bottom:27%;transform:translateX(-50%);max-width:min(640px,80vw);padding:10px 16px;background:rgba(12,16,20,.72);border-left:3px solid #6fd6ff;font-size:15px;display:none');
const __msSay = __msEl('left:50%;top:24%;transform:translateX(-50%);font-size:17px;letter-spacing:.06em;display:none');
const __msFade = __msEl('inset:0;background:#05070a;opacity:0;z-index:7');
// (a shot's bars: the frame closed top and bottom while the plan's camera has the view)
const __msBars = [__msEl('left:0;right:0;top:0;height:0;background:#05070a;z-index:9;transition:height .35s'), __msEl('left:0;right:0;bottom:0;height:0;background:#05070a;z-index:9;transition:height .35s')];
const __msMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, fog: false, side: THREE.DoubleSide });
function __msThing(id, make) { let m = __MS.things[id]; if (!m) { m = __MS.things[id] = make(); m.raycast = () => {}; m.frustumCulled = false; scene.add(m); } return m; }
(function __msFrame() {
  requestAnimationFrame(__msFrame);
  const p = __world.pilotId ? __world.byId[__world.pilotId] : null, M = p && p.rule && p.rule.mission, S = __world.ms;
  if (!M) return;
  const now = __world.time || 0; __MS.t += 0.03;
  for (const it of M.items || []) { const m = __msThing('i:' + it.id, () => { const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), __msMat(0xffc94a, 0.95)); g.position.set(it.at[0], it.at[1], it.at[2] + 1.05); return g; }); m.visible = !(S && S.held[it.id]); m.rotation.z = __MS.t; }
  for (const c of M.clues || []) { const m = __msThing('c:' + c.id, () => { const g = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), __msMat(0x6fd6ff, 0.8)); g.position.set(c.at[0], c.at[1], c.at[2] + 0.05); return g; }); m.visible = !(S && S.read[c.id]); m.scale.setScalar(1 + 0.08 * Math.sin(__MS.t * 2)); }
  for (const w of M.ways || []) if (!w.deck) for (const k of ['a', 'b']) __msThing('w:' + w.id + k, () => { const lift = (w.kind || 'lift') === 'lift', r = (w.radius || 1.8); const g = new THREE.Mesh(lift ? new THREE.PlaneGeometry(r * 2, r * 2) : new THREE.PlaneGeometry(r * 1.4, r * 0.7), __msMat(lift ? 0xe0b040 : 0x8fd08c, 0.34)); g.position.set(w[k][0], w[k][1], w[k][2] + 0.04); return g; });
  for (const b of M.barriers || []) { const m = __msThing('b:' + b.id, () => { const g = new THREE.Mesh(new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]), new THREE.MeshBasicMaterial({ color: 0x39424a })); g.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2); return g; }); m.visible = !(S && S.open[b.id]); }
  for (const x of M.exits || []) __msThing('x:' + x.id, () => { const r = (x.radius || 1.8); const g = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.4, r * 1.4), __msMat(0x8fd08c, 0.34)); g.position.set(x.at[0], x.at[1], x.at[2] + 0.06); return g; });
  // leaving for another segment's page: what is held, read and set and the body's health go with it, in the address
  if (S && S.exit && !__MS.gone && now - S.exit.t > 0.6) { __MS.gone = true; const carry = { held: S.held, read: S.read, flags: S.flags, hp: p.body && p.body.hp, door: S.exit.door }; location.href = S.exit.to + '#ms=' + encodeURIComponent(JSON.stringify(carry)); }
  const O = __CW.missionObjective ? __CW.missionObjective(__world) : null;
  __msObj.textContent = S && S.done ? 'MISSION COMPLETE' : O ? 'OBJECTIVE  ' + O.says : (M.result ? M.result.when : M.leave || []).length && (M.result ? M.result.when : M.leave).every((id) => S && S.held[id]) ? 'OBJECTIVE  get out' : (M.unsure ? 'OBJECTIVE  ' + M.unsure : '');
  let act = '';
  if (S && S.near && !S.ride) {
    const c = (M.clues || []).find((x) => x.id === S.near), w = (M.ways || []).find((x) => x.id === S.near);
    const x = (M.exits || []).find((y) => y.id === S.near);
    if (x) act = S.locked ? (x.name || x.id) + ' · locked: needs ' + S.locked.map((n) => { const it = (M.items || []).find((y) => y.id === n); return it ? (it.name || n) : n; }).join(', ') : 'E  ' + (x.name || 'go through');
    else if (c) act = 'E  look closer';
    else if (w) act = S.locked ? (w.name || w.id) + ' · locked: needs ' + S.locked.map((n) => { const it = (M.items || []).find((x) => x.id === n); return it ? (it.name || n) : 'to know where it goes'; }).join(', ') : 'E  ' + ((w.kind || 'lift') !== 'lift' ? 'take the stairs' : w.deck && S.decks && (S.decks[w.id] || w.at || 'a') !== (Math.abs(p.transform.pos[2] - w.a[2]) < Math.abs(p.transform.pos[2] - w.b[2]) ? 'a' : 'b') ? 'call the lift' : 'ride the lift');
  }
  __msAct.textContent = act; __msAct.style.display = act ? 'block' : 'none';
  { const h = S && S.hint != null && !S.ride && M.hints ? M.hints[S.hint] : null; __msHint.textContent = h ? h.says : ''; __msHint.style.display = h ? 'block' : 'none'; }
  const said = S && S.said && now - S.said.t < 4 ? S.said.text : '';
  __msSay.textContent = said; __msSay.style.display = said ? 'block' : 'none';
  const R = S && S.ride, u = R ? R.t / R.secs : 0;
  // (the plan's own gizmos, its cameras and paths drawn as objects, are a director's view: never shown in play)
  if (window.__mojShoot && !__MS.shot) for (const o of scene.children) if (o.renderOrder === 980 && o.visible) o.visible = false;
  // A RIDE'S SHOT: a carried ride to an end whose way names a cue plays that shot of the page's shoot plan, the view the
  // plan's through it (channels/shoot.js: cue, look), the bars drawn; as the ride ends the view is the game's again
  { const w = R && R.deck && R.rides ? (M.ways || []).find((x) => x.id === R.way) : null, cue = w && w.shot ? w.shot[R.end] : null, P = window.__mojShoot;
    if (cue && P && P.cue && !__MS.shot) { if (P.cue(cue)) { P.look(true); __MS.shot = R.way; for (const b of __msBars) b.style.height = '11vh'; } }
    else if (__MS.shot && !(R && R.way === __MS.shot)) { if (P) { if (P.cueAt) P.cueAt(false); P.look(false); } __MS.shot = null; for (const b of __msBars) b.style.height = '0'; }
    // (the shot keeps the ride's clock, not the page's: the camera and the deck stay together when the world is slowed)
    if (__MS.shot && R && P && P.cueAt) P.cueAt(R.t); }
  if (S && S.exit) __msFade.style.opacity = String(Math.min(1, (now - S.exit.t) / 0.5)); else
  if (R && R.deck) __msFade.style.opacity = '0'; else
  __msFade.style.opacity = R ? String(Math.max(0, Math.min(1, 1 - Math.abs(u - 0.5) * 4 + 1))) : '0';
  window.__mojMission = S || null;
})();
`;
}
