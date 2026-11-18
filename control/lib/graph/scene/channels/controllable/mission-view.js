// In-page script: A MISSION, SHOWN — what worlds/controllable/mission.js holds, drawn and said. Emitted only into a page
// whose pilot's rule carries `mission`, so every other page keeps every byte.
//
//   things   each item its LOOK (a keycard, a document, a ration, an ammo can, a case: the item's \`look\`), a small model
//            at a game's scale (twice a thing's own) turning low over a ring of light the colour of its kind, until it is found; each clue a ring on the floor until it is read; each
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
// (an item's look: a few boxes at a game's scale, z up, lit as the level is; its ring's colour by its kind)
const __msStdC = {};
// (each a little lit from within, so a thing to find reads in a dim room and from a camera risen over its finder)
const __msStd = (c, r, m, e) => __msStdC[c + ':' + r + ':' + m + ':' + e] || (__msStdC[c + ':' + r + ':' + m + ':' + e] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m || 0, emissive: c, emissiveIntensity: Math.max(e || 0, 0.14) }));
const __MS_RING = { keycard: 0xffc94a, document: 0xffc94a, ration: 0x8fd08c, ammo: 0xffa040, case: 0xffc94a };
function __msLook(look) {
  const g = new THREE.Group(), box = (w, d, h, mat, x, y, z, rz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat); b.position.set(x || 0, y || 0, z || 0); if (rz) b.rotation.y = rz; g.add(b); return b; };
  const ring = (R, t, mat, x, y, z, arc, rx, rz) => { const r = new THREE.Mesh(new THREE.TorusGeometry(R, t, 6, 18, arc || Math.PI * 2), mat); r.position.set(x || 0, y || 0, z || 0); r.rotation.x = rx || 0; r.rotation.z = rz || 0; g.add(r); return r; };
  const ink = __msStd(0x9aa3ab, 0.8, 0), type = __msStd(0x4a4d52, 0.9, 0);
  if (look === 'keycard') {
    box(0.22, 0.008, 0.14, __msStd(0x223448, 0.4, 0.15));
    box(0.22, 0.010, 0.03, __msStd(0xe0b040, 0.4, 0, 0.35), 0, 0, 0.038);                  // the access stripe
    box(0.035, 0.010, 0.028, __msStd(0xd8b45a, 0.35, 0.35, 0.08), -0.065, 0, -0.008);              // the chip
    box(0.045, 0.0095, 0.055, __msStd(0xb9c2c9, 0.6, 0), 0.068, 0, -0.022);                 // the holder's photo
    for (const [z, w] of [[-0.03, 0.08], [-0.045, 0.06]]) box(w, 0.0098, 0.007, ink, -0.035 + w / 2 - 0.04, 0, z); // its print
    box(0.22, 0.0098, 0.022, __msStd(0x14181c, 0.35, 0.3), 0, 0.0005, -0.045).position.y = 0.0006;              // the magnetic band, behind
    ring(0.05, 0.005, __msStd(0xb83434, 0.7, 0, 0.15), -0.105, 0, 0.11, 0, Math.PI / 2);   // the lanyard's loop
  } else if (look === 'document') {
    box(0.30, 0.012, 0.22, __msStd(0xc9a66b, 0.85, 0));                                     // the folder
    box(0.27, 0.004, 0.2, __msStd(0xf0efe8, 0.9, 0), 0.03, -0.004, 0.03, -0.12);            // a sheet, sticking out
    box(0.28, 0.006, 0.205, __msStd(0xeeeeea, 0.9, 0), 0, -0.007, 0.014);                   // the papers, showing at the top
    box(0.30, 0.004, 0.22, __msStd(0xb8945a, 0.85, 0), 0, -0.012, 0);                       // its cover
    const stamp = __msStd(0xb02a2a, 0.7, 0, 0.2);
    box(0.13, 0.004, 0.034, stamp, -0.06, -0.0145, 0.065, 0.06);                            // the stamp, its border and its word
    box(0.10, 0.0046, 0.008, __msStd(0xc9a66b, 0.85, 0), -0.06, -0.0145, 0.0654, 0.06);
    for (let i = 0; i < 4; i++) box(0.12 - (i % 2) * 0.03, 0.0046, 0.005, type, -0.05 - (i % 2) * 0.015, -0.0145, 0.01 - i * 0.017); // its typing
    box(0.09, 0.004, 0.065, __msStd(0x6b7178, 0.5, 0), 0.075, -0.0145, -0.045);             // a photograph
    box(0.07, 0.0046, 0.03, __msStd(0x8d949a, 0.5, 0), 0.075, -0.0148, -0.05);              // and what is in it
    ring(0.012, 0.0025, __msStd(0xc8ccd0, 0.35, 0.35), 0.075, -0.017, -0.006, 0, Math.PI / 2); // its clip
    g.rotation.x = -0.32;                                                                   // leant back, read from above
  } else if (look === 'ration') {
    const foil = __msStd(0x66703a, 0.42, 0.45);
    box(0.24, 0.05, 0.15, foil);                                                            // the foil pouch
    box(0.2, 0.066, 0.12, foil);                                                            // full in the middle
    for (const x of [-0.12, 0.12]) box(0.018, 0.03, 0.158, __msStd(0x7a8448, 0.4, 0.5), x); // its crimped ends
    for (const x of [-0.12, 0.12]) box(0.02, 0.032, 0.012, __msStd(0x2d3020, 0.8, 0), x, 0, 0.06);   // their tear notches
    box(0.11, 0.07, 0.124, __msStd(0xcdbf8e, 0.85, 0));                                     // the label
    box(0.08, 0.072, 0.016, __msStd(0x2d3020, 0.8, 0), 0, 0, 0.035);                        // its stencil
    for (const z of [0.005, -0.015, -0.035]) box(0.07 - Math.abs(z) * 0.4, 0.072, 0.006, __msStd(0x5e5a44, 0.85, 0), 0, 0, z);
    g.rotation.x = -0.25;
  } else if (look === 'ammo') {
    const od = __msStd(0x5d6630, 0.5, 0.35);
    box(0.28, 0.12, 0.15, od);                                                              // the can
    box(0.296, 0.136, 0.026, __msStd(0x4e5627, 0.45, 0.45), 0, 0, 0.088);                   // its lid, over a lip
    box(0.282, 0.122, 0.008, __msStd(0x3b4120, 0.6, 0.4), 0, 0, 0.072);
    ring(0.045, 0.008, __msStd(0x2a2d22, 0.4, 0.6), 0, 0, 0.101, Math.PI, Math.PI / 2);     // the handle
    box(0.035, 0.03, 0.075, __msStd(0x6b7438, 0.45, 0.5), 0.152, 0, 0.045);                 // the latch
    box(0.19, 0.004, 0.026, __msStd(0xe0c840, 0.6, 0, 0.3), 0, -0.062, 0.015);              // the stencil band
    box(0.09, 0.004, 0.016, __msStd(0xe0c840, 0.6, 0, 0.3), -0.045, -0.062, -0.028);
    // (three rounds by it, brass with their copper heads: what is in it, said)
    // (stood on their bases by the can's corner; the metals not mirror-bright, so a page with no reflections lights them)
    const brass = __msStd(0xd8b05a, 0.35, 0.35, 0.08), head = __msStd(0xc07848, 0.35, 0.3, 0.05);
    for (const [x, y] of [[0.19, -0.05], [0.215, -0.02], [0.19, 0.01]]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.055, 10), brass), t = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.026, 10), head);
      c.rotation.x = t.rotation.x = Math.PI / 2; c.position.set(x, y, -0.0475); t.position.set(x, y, -0.007); g.add(c); g.add(t);
    }
  } else {
    box(0.32, 0.09, 0.23, __msStd(0x464d56, 0.45, 0.35));                                   // a case
    ring(0.05, 0.01, __msStd(0x1b1e22, 0.5, 0.2), 0, 0, 0.118, Math.PI, Math.PI / 2);
    for (const x of [-0.1, 0.1]) box(0.03, 0.095, 0.02, __msStd(0xd8b05a, 0.35, 0.35, 0.08), x, 0, 0.09);
  }
  g.scale.setScalar(2);
  return g;
}
function __msThing(id, make) { let m = __MS.things[id]; if (!m) { m = __MS.things[id] = make(); m.traverse((o) => { o.raycast = () => {}; }); m.frustumCulled = false; scene.add(m); } return m; }   // (never hit: not the camera's walls, not the ground)
(function __msFrame() {
  requestAnimationFrame(__msFrame);
  const p = __world.pilotId ? __world.byId[__world.pilotId] : null, M = p && p.rule && p.rule.mission, S = __world.ms;
  if (!M) return;
  const now = __world.time || 0; __MS.t += 0.03;
  for (const it of M.items || []) {
    const m = __msThing('i:' + it.id, () => { const g = new THREE.Group(), L = __msLook(it.look); L.position.z = 0.7; g.add(L);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 32), new THREE.MeshBasicMaterial({ color: __MS_RING[it.look] || 0xffc94a, transparent: true, opacity: 0.5, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      ring.position.z = 0.03; g.add(ring); g.position.set(it.at[0], it.at[1], it.at[2]); g.userData.look = L; g.userData.ring = ring; return g; });
    m.visible = !(S && S.held[it.id]);
    if (m.visible) { const ph = (it.at[0] * 1.7 + it.at[1]) % 6.28; m.userData.look.rotation.z = __MS.t * 0.7 + ph; m.userData.look.position.z = 0.7 + 0.05 * Math.sin(__MS.t * 1.6 + ph); m.userData.ring.material.opacity = 0.38 + 0.14 * Math.sin(__MS.t * 2.2 + ph); }
  }
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
