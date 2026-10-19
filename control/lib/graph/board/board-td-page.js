/**
 * A TOWER DEFENCE ON THE WORLD PAGE — the defence (board-td.js) played over the board: the base and the spawns marked,
 * the foes' road lit on the spots, towers built where the cursor stands, foes walking, shots and falls played as
 * effects (board-fx.js), a panel with the wave, the purse and the lives. The level hears `board-won` or `board-lost`
 * (the `board` mechanic ends it).
 *
 *   keys: 1 2 3 a tower (as the defence lists them) · click or Enter: build at the cursor · S: sell there · N: the next
 *   wave now · B: the spots a tower may stand on (the mazing rule) · the camera's own (pan, edge scroll, zoom)
 *
 * `boardTdPage(api)` runs on the page only, inside the board channel's block, handed what the board page has made
 * (api: { THREE, scene, D, B, root, tops, highlight, panel, FX, TDK, cursorAt, worldAt, push }); emitted only when a board has
 * `td`, so no other board carries a byte of it. It returns { step(dt), pick(spot), readout(spot), probe }.
 */

/* global window */
export function boardTdPage(api) {
  const { THREE, D, B, root, tops, highlight, FX, TDK } = api, cfg = D.td, cell = B.cell;
  let T = TDK.start(B, cfg), kind = cfg.towers[0], showLegal = false, result = null, said = '', last = null;
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  // the defence's pieces are lit; a world that brings no light of its own (a diorama) gets a soft sky and a sun for them
  {
    let lit = false;
    api.scene.traverse((o) => { if (o.isLight) lit = true; });
    if (!lit) {
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(-0.4, -0.7, 1);
      root.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3328, 0.85), sun);
    }
  }
  const basic = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: o != null, opacity: o == null ? 1 : o, depthWrite: o == null });

  // the base (a keep of a sort) and each spawn (a dark gate in the ground)
  {
    const p = tops[cfg.base], g = new THREE.Group();
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.36, cell * 0.42, 1.6, 8), mat(0xd9d2c0));
    keep.rotation.x = Math.PI / 2; keep.position.z = 0.8;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.32), basic(0x3d8bff));
    flag.position.set(0, 0.25, 2.1);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), mat(0x6b5a44));
    pole.rotation.x = Math.PI / 2; pole.position.z = 1.95;
    g.add(keep, pole, flag);
    g.position.set(p[0], p[1], p[2]);
    root.add(g);
    for (const sp of cfg.spawns) {
      const q = tops[sp], gate = new THREE.Mesh(new THREE.RingGeometry(cell * 0.18, cell * 0.42, 24), basic(0x7a2fb0, 0.85));
      gate.position.set(q[0], q[1], q[2] + 0.05);
      root.add(gate);
    }
  }

  // a tower by its kind: an arrow tower tall and wooden, a cannon squat and iron, a frost tower a crystal on a plinth
  function towerMesh(k) {
    const g = new THREE.Group();
    if (k === 'cannon') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.32, cell * 0.38, 0.7, 10), mat(0x4a4f58));
      base.rotation.x = Math.PI / 2; base.position.z = 0.35;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.9, 10), mat(0x24272c));
      barrel.position.set(0, 0.25, 0.85); barrel.rotation.x = -0.5;
      g.add(base, barrel);
      g.userData.turn = barrel;
    } else if (k === 'frost') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.28, cell * 0.32, 0.5, 6), mat(0xb8c4cc));
      base.rotation.x = Math.PI / 2; base.position.z = 0.25;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), basic(0x9fe4ff, 0.9));
      gem.position.z = 1.15; gem.scale.set(1, 1, 1.6);
      g.add(base, gem);
      g.userData.spin = gem;
    } else {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.18, cell * 0.24, 1.6, 8), mat(0x8a6a44));
      post.rotation.x = Math.PI / 2; post.position.z = 0.8;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(cell * 0.3, 0.6, 8), mat(0x9b3b2e));
      roof.rotation.x = Math.PI / 2; roof.position.z = 1.9;
      g.add(post, roof);
    }
    return g;
  }
  const towers = {};
  function syncTowers() {
    for (const i in towers) if (!T.towers[i]) { root.remove(towers[i]); delete towers[i]; }
    for (const i in T.towers) if (!towers[i]) { const g = towerMesh(T.towers[i].kind), p = tops[i]; g.position.set(p[0], p[1], p[2]); root.add(g); towers[i] = g; }
  }

  // a foe by its kind, with a bar of its health over it
  const FOE_LOOK = { runner: [0xc8d94a, 0.32, 0.7], grunt: [0xb2412f, 0.4, 1.0], brute: [0x5c2a2a, 0.62, 1.4] };
  const foes = {};
  function foeMesh(f) {
    const [c, r, h] = FOE_LOOK[f.kind] || FOE_LOOK.grunt, g = new THREE.Group(), body = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, h, 12), mat(c));
    trunk.rotation.x = Math.PI / 2; trunk.position.z = h / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 12, 10), mat(c));
    head.position.z = h + r * 0.45;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(r * 0.25, r * 0.6, 8), mat(0xffffff));
    nose.rotation.z = -Math.PI / 2; nose.position.set(r * 0.9, 0, h * 0.7);
    body.add(trunk, head, nose);
    // its health over it, a bar that always faces the view, filled from the left
    const bar = (col, o) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: col, transparent: true, opacity: o, depthTest: false })); sp.center.set(0, 0.5); sp.scale.set(0.8, 0.09, 1); sp.position.set(-0.4, 0, h + r + 0.35); sp.renderOrder = 6; return sp; };
    const back = bar(0x222222, 0.8), fill = bar(0x6bff8a, 0.95);
    fill.renderOrder = 7;
    g.add(body, back, fill);
    g.userData = { body, fill };
    return g;
  }
  function syncFoes() {
    const live = {};
    for (const f of T.foes) {
      live[f.id] = 1;
      if (!foes[f.id]) { foes[f.id] = foeMesh(f); root.add(foes[f.id]); }
      const g = foes[f.id], w = api.worldAt(TDK.where(B, T, f));
      g.position.set(w[0], w[1], w[2]);
      if (f.to >= 0) { const a = tops[f.at], b = tops[f.to]; g.userData.body.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); }
      const k = Math.max(0, f.hp / f.hpMax), fill = g.userData.fill;
      fill.scale.x = Math.max(0.001, 0.8 * k);
      fill.material.color.setHex(k > 0.5 ? 0x6bff8a : k > 0.25 ? 0xffd23d : 0xff6b5a);
    }
    for (const id in foes) if (!live[id]) { root.remove(foes[id]); delete foes[id]; }
  }

  // the road the foes walk now (every spawn's), and while B is down the spots a tower may stand on
  function drawRoad() {
    const road = new Set();
    for (const sp of cfg.spawns) for (const i of TDK.route(B, cfg, T, sp)) road.add(i);
    highlight('road', [...road]);
    highlight('reach', showLegal ? TDK.legal(B, cfg, T) : null);
  }

  // the panel: the wave, the purse, the lives, the tower in hand
  const pan = api.panel('left:12px;top:12px;pointer-events:none');
  const banner = api.panel('left:50%;top:38%;transform:translate(-50%,-50%);font-size:30px;padding:14px 26px;display:none;pointer-events:none;text-align:center');
  function drawPanel() {
    const wave = T.next, waves = cfg.waves.length;
    const when = T.out.length ? 'coming in' : T.next < waves ? `next in ${Math.max(0, Math.ceil(T.clock))} s (N: now)` : T.foes.length ? 'the last of them' : '';
    const hand = cfg.towers.map((k, n) => `${k === kind ? '▸' : ' '}${n + 1} ${TDK.TOWERS[k].name} ${TDK.TOWERS[k].cost}`).join('   ');
    const text = `wave ${Math.min(wave, waves)} of ${waves}  ${when}\ngold ${T.gold}   lives ${T.lives}   foes ${T.foes.length}\n${hand}`;
    if (text !== said) { pan.textContent = text; said = text; }
  }

  // what the effects play: a shot from the tower to its foe, a fall, a foe through the gate
  const SHOT = { arrow: 'arrow', cannon: 'shell', frost: 'chill' };
  function show(events) {
    for (const e of events) {
      if (e.kind === 'shot' && FX) { const p = tops[e.tower], w = api.worldAt(e.at); FX.play(SHOT[e.tk] || 'arrow', { from: [p[0], p[1], p[2] + 0.6], at: w, targets: [w], seed: 'td:' + T.t.toFixed(2) + ':' + e.tower }); }
      else if (e.kind === 'down' && FX) { const w = api.worldAt(e.at); FX.play('hit', { at: w, targets: [w], seed: 'down:' + e.id }); }
      else if (e.kind === 'leak') { const p = tops[cfg.base]; if (FX) FX.play('strike', { at: p, targets: [p], seed: 'leak:' + e.id }); }
      else if (e.kind === 'won' || e.kind === 'lost') end(e.kind === 'won');
    }
  }
  function end(won) {
    result = { won };
    banner.style.display = 'block';
    banner.textContent = won ? 'Held\nevery wave turned back' : 'Overrun';
    highlight('reach', null);
    api.push(won ? 'board-won' : 'board-lost');
  }

  // the player's hand: build, sell, the next wave, which tower, the legal spots
  function build(i) {
    if (result) return 'the defence is over';
    try { T = TDK.place(B, cfg, T, i, kind); } catch (e) { return String(e.message).replace(/^td: /, ''); }
    syncTowers(); drawRoad(); drawPanel();
    return true;
  }
  function sellAt(i) {
    try { T = TDK.sell(B, cfg, T, i); } catch (e) { return String(e.message).replace(/^td: /, ''); }
    syncTowers(); drawRoad(); drawPanel();
    return true;
  }
  function callNext() { T = TDK.call(B, cfg, T); drawPanel(); }
  if (typeof window !== 'undefined') window.addEventListener('keydown', (e) => {
    if (result) return;
    const n = /^Digit([1-9])$/.exec(e.code);
    if (n && cfg.towers[+n[1] - 1]) { kind = cfg.towers[+n[1] - 1]; drawPanel(); }
    else if (e.code === 'KeyS') { last = sellAt(api.cursorAt()); }
    else if (e.code === 'KeyN') callNext();
    else if (e.code === 'KeyB') { showLegal = !showLegal; drawRoad(); }
  });

  syncTowers(); drawRoad(); drawPanel();
  // the defence's own time: the kernel in its fixed slices, the road again when a tower changed it
  function advance(dt) {
    if (result) return;
    const was = Object.keys(T.towers).length, o = TDK.tick(B, cfg, T, Math.min(0.1, dt));
    T = o.T;
    show(o.events);
    if (o.events.some((e) => e.kind === 'spawn' || e.kind === 'down' || e.kind === 'leak') || Object.keys(T.towers).length !== was) drawPanel();
  }
  let roadT = 0;
  function step(dt) {
    advance(dt);
    syncFoes();
    for (const i in towers) { const s = towers[i].userData.spin; if (s) s.rotation.z += dt * 1.5; }
    // the panel's clock, and the road now and then (the foes standing on it keep it honest)
    if ((roadT += dt) > 0.5) { roadT = 0; drawPanel(); if (showLegal) drawRoad(); }
  }
  function readout(i) {
    if (result) return result.won ? 'held' : 'overrun';
    if (T.towers[i]) return `${TDK.TOWERS[T.towers[i].kind].name} (S: sell for ${Math.floor(TDK.TOWERS[T.towers[i].kind].cost / 2)})`;
    if (i === cfg.base) return 'the base';
    if (cfg.spawns.indexOf(i) >= 0) return 'a gate they come through';
    const ok = TDK.legal(B, cfg, T).indexOf(i) >= 0, tw = TDK.TOWERS[kind];
    return ok ? `build here: ${tw.name}, ${tw.cost} gold${T.gold < tw.cost ? ' (too little gold)' : ''}` : 'no tower here: it would shut the road, or it is taken';
  }
  return {
    step, readout,
    pick(i) { last = build(i); return last; },
    probe: {
      state: () => T, get kind() { return kind; }, set kind(k) { kind = k; }, get result() { return result; }, get last() { return last; },
      legal: () => TDK.legal(B, cfg, T), place(i, k) { if (k) kind = k; last = build(i); return last; }, sell: (i) => sellAt(i), call: callNext,
      // the defence stepped by hand (probes and tests: no waiting on the clock)
      run(dt) { advance(dt); },
    },
  };
}
