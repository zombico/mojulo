/**
 * REAL-TIME STRATEGY ON THE WORLD PAGE — the skirmish (board-rts.js) played over the board: units drawn by side and
 * kind with their health over them, buildings and resource nodes on their spots, the selection ringed, a panel with
 * the purse and what is selected. The level hears `board-won` or `board-lost` (the `board` mechanic ends it).
 *
 *   select: click a unit, shift-click to add, drag a box on the ground; Ctrl+A every soldier and archer
 *   orders (to the selection): right-click the ground (move), a foe (attack), a node (workers gather), with a building
 *   selected its rally point; A then click: attack-move · S stop · H hold · B then click: build a barracks · Q / W: the
 *   selected building trains its first / second kind · Esc lets go
 *   the camera: the RTS form (the arrows and the screen's edge pan, Z X zoom; WASD is the orders' here)
 *
 * `boardRtsPage(api)` runs on the page only, inside the board channel's block (api: { THREE, scene, camera, renderer,
 * D, B, root, tops, panel, FX, RTK, spotAt, worldAt, push }); emitted only when a board has `rts`. It returns
 * { step(dt), readout(spot), probe }.
 */

/* global window, document */
export function boardRtsPage(api) {
  const { THREE, D, B, root, tops, FX, RTK } = api, cfg = D.rts, cell = B.cell;
  let R = RTK.start(B, cfg), sel = [], selB = null, armed = null, result = null, said = '';
  const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
  const basic = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: o != null, opacity: o == null ? 1 : o, depthWrite: o == null });
  {
    let lit = false;
    api.scene.traverse((o) => { if (o.isLight) lit = true; });
    if (!lit) { const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(-0.4, -0.7, 1); root.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3328, 0.85), sun); }
  }
  const SIDE = { player: 0x3d8bff, enemy: 0xe5533d };
  const bar = (h) => {
    const mk = (c, o, ord) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: c, transparent: true, opacity: o, depthTest: false })); sp.center.set(0, 0.5); sp.scale.set(0.8, 0.08, 1); sp.position.set(-0.4, 0, h); sp.renderOrder = ord; return sp; };
    return [mk(0x222222, 0.8, 6), mk(0x6bff8a, 0.95, 7)];
  };
  const fillBar = (fill, k, w) => { fill.scale.x = Math.max(0.001, w * k); fill.material.color.setHex(k > 0.5 ? 0x6bff8a : k > 0.25 ? 0xffd23d : 0xff6b5a); };

  // ── what stands: units by side and kind, buildings, the nodes ───────────────────────────────────────────────────
  function unitMesh(u) {
    const g = new THREE.Group(), body = new THREE.Group(), c = SIDE[u.side];
    if (u.kind === 'worker') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.6, 10), lambert(c)); t.rotation.x = Math.PI / 2; t.position.z = 0.3;
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.26), lambert(0x8a6a44)); pack.position.set(-0.2, 0, 0.4);
      body.add(t, pack);
    } else if (u.kind === 'soldier') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 10), lambert(c)); t.rotation.x = Math.PI / 2; t.position.z = 0.45;
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.5), lambert(0xb8c4cc)); shield.position.set(0.3, 0, 0.5);
      body.add(t, shield);
    } else {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.85, 10), lambert(c)); t.rotation.x = Math.PI / 2; t.position.z = 0.43;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 10), lambert(0x3e5e3a)); hat.rotation.x = Math.PI / 2; hat.position.z = 1.0;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 16, Math.PI), lambert(0x8a6a44)); bow.position.set(0.25, 0, 0.55); bow.rotation.y = Math.PI / 2;
      body.add(t, hat, bow);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lambert(0xe8c8a0)); head.position.z = u.kind === 'worker' ? 0.72 : 1.02;
    body.add(head);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 24), basic(0x7dffb0, 0.9)); ring.position.z = 0.06; ring.visible = false;
    const [back, fill] = bar(u.kind === 'worker' ? 1.05 : 1.35);
    g.add(body, ring, back, fill);
    g.userData = { body, ring, fill };
    return g;
  }
  function buildingMesh(b) {
    const g = new THREE.Group(), c = SIDE[b.side], big = b.kind === 'base';
    const w = cell * (big ? 0.86 : 0.7), h = big ? 1.6 : 1.1;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, w, h), lambert(big ? 0xd9d2c0 : 0x9a8a72)); box.position.z = h / 2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 0.7, 4), lambert(c)); roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI / 4; roof.position.z = h + 0.35;
    const [back, fill] = bar(h + 1.0);
    back.scale.x = 1.2; back.position.x = -0.6; fill.position.x = -0.6;
    const ring = new THREE.Mesh(new THREE.RingGeometry(w * 0.62, w * 0.7, 32), basic(0x7dffb0, 0.9)); ring.position.z = 0.06; ring.visible = false;
    g.add(box, roof, back, fill, ring);
    g.userData = { fill, box, roof, ring };
    return g;
  }
  function nodeMesh() {
    const g = new THREE.Group(), m = basic(0xf2c14e), geo = new THREE.OctahedronGeometry(0.3, 0);
    for (const [x, y, s] of [[0, 0, 1.3], [0.3, 0.2, 0.9], [-0.28, 0.15, 0.8], [0.1, -0.3, 0.85]]) { const k = new THREE.Mesh(geo, m); k.position.set(x, y, 0.3 * s); k.scale.set(s, s, s * 1.5); g.add(k); }
    return g;
  }
  const meshes = {}, nodes = {};
  function sync() {
    const live = {};
    for (const u of R.units) {
      live[u.id] = 1;
      if (!meshes[u.id]) { meshes[u.id] = unitMesh(u); root.add(meshes[u.id]); }
      const g = meshes[u.id], w = api.worldAt([u.x, u.y]);
      g.position.set(w[0], w[1], w[2]);
      if (u.path.length) { const to = tops[u.path[0]]; g.userData.body.rotation.z = Math.atan2(to[1] - w[1], to[0] - w[0]); }
      fillBar(g.userData.fill, u.hp / RTK.UNITS[u.kind].hp, 0.8);
      g.userData.ring.visible = sel.indexOf(u.id) >= 0;
    }
    for (const b of R.buildings) {
      live[b.id] = 1;
      if (!meshes[b.id]) { meshes[b.id] = buildingMesh(b); const p = tops[b.at]; meshes[b.id].position.set(p[0], p[1], p[2]); root.add(meshes[b.id]); }
      const g = meshes[b.id], up = b.raising > 0 ? 1 - b.raising / RTK.BUILDINGS[b.kind].time : 1;
      g.userData.box.scale.z = Math.max(0.05, up); g.userData.box.position.z = (g.userData.box.geometry.parameters.depth * up) / 2;
      g.userData.roof.visible = up >= 1;
      fillBar(g.userData.fill, b.hp / b.hpMax, 1.2);
      g.userData.ring.visible = selB === b.id;
    }
    for (const id in meshes) if (!live[id]) { root.remove(meshes[id]); delete meshes[id]; }
    for (const n of R.nodes) {
      if (!nodes[n.at]) { nodes[n.at] = nodeMesh(); const p = tops[n.at]; nodes[n.at].position.set(p[0], p[1], p[2]); root.add(nodes[n.at]); }
      const k = Math.max(0.15, n.left / 400);
      nodes[n.at].scale.set(k, k, k);
      nodes[n.at].visible = n.left > 0;
    }
    sel = sel.filter((id) => live[id]);
    if (selB && !live[selB]) selB = null;
  }

  // ── the panel: the purse, what is selected and what it can do, what the next click will do ───────────────────────
  const pan = api.panel('left:12px;top:12px;pointer-events:none');
  const banner = api.panel('left:50%;top:38%;transform:translate(-50%,-50%);font-size:30px;padding:14px 26px;display:none;pointer-events:none;text-align:center');
  const boxEl = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (boxEl) { boxEl.style.cssText = 'position:fixed;border:1px solid #7dffb0;background:rgba(125,255,176,0.12);pointer-events:none;display:none;z-index:9'; document.body.appendChild(boxEl); }
  function drawPanel() {
    const mine = R.units.filter((u) => u.side === 'player'), count = (k) => mine.filter((u) => u.kind === k).length;
    const b = selB && R.buildings.find((x) => x.id === selB);
    let what = sel.length ? `selected: ${sel.length} (${['worker', 'soldier', 'archer'].map((k) => [k, R.units.filter((u) => sel.indexOf(u.id) >= 0 && u.kind === k).length]).filter((x) => x[1]).map((x) => x[1] + ' ' + x[0] + (x[1] > 1 ? 's' : '')).join(', ')})` : '';
    if (b) what = `${RTK.BUILDINGS[b.kind].name}${b.raising > 0 ? ` (going up, ${Math.ceil(b.raising)} s)` : ''}  ${RTK.BUILDINGS[b.kind].trains.map((k, n) => `${'QW'[n]}: ${RTK.UNITS[k].name} ${RTK.UNITS[k].cost}`).join('  ')}${b.queue.length ? `  queue ${b.queue.map((q) => q.kind).join(', ')}` : ''}`;
    const text = `gold ${R.gold.player}   workers ${count('worker')}   army ${count('soldier') + count('archer')}   enemy ${R.units.filter((u) => u.side === 'enemy').length}\n${what || 'click or drag to select'}${armed ? `\n${armed === 'amove' ? 'attack-move: click where' : 'build a barracks (150): click a spot'}` : ''}`;
    if (text !== said) { pan.textContent = text; said = text; }
  }

  // ── the player's hand ───────────────────────────────────────────────────────────────────────────────────────────
  const place = (x) => (x.x != null ? [x.x, x.y] : [(x.at % B.cols) + 0.5, Math.floor(x.at / B.cols) + 0.5]);
  const near = (list, p, r) => list.filter((x) => Math.hypot(place(x)[0] - p[0], place(x)[1] - p[1]) <= r).sort((a, b) => Math.hypot(place(a)[0] - p[0], place(a)[1] - p[1]) - Math.hypot(place(b)[0] - p[0], place(b)[1] - p[1]))[0] || null;
  const spotP = (i) => [(i % B.cols) + 0.5, Math.floor(i / B.cols) + 0.5];
  function selectAt(i, add) {
    const p = spotP(i), u = near(R.units.filter((x) => x.side === 'player'), p, 0.8), b = !u && R.buildings.find((x) => x.side === 'player' && x.at === i);
    if (u) { selB = null; sel = add ? (sel.indexOf(u.id) >= 0 ? sel.filter((x) => x !== u.id) : sel.concat([u.id])) : [u.id]; }
    else if (b) { sel = []; selB = b.id; }
    else if (!add) { sel = []; selB = null; }
    drawPanel();
  }
  function command(i) {
    const p = spotP(i);
    if (selB) { R = RTK.rally(B, cfg, R, selB, i); return 'rally'; }
    if (!sel.length) return null;
    const foe = near(R.units.filter((x) => x.side === 'enemy'), p, 0.8) || R.buildings.find((x) => x.side === 'enemy' && x.at === i);
    const node = R.nodes.find((n) => n.at === i && n.left > 0);
    if (foe) { R = RTK.order(B, cfg, R, sel, { kind: 'attack', target: foe.id }); return 'attack'; }
    if (node) {
      const workers = R.units.filter((u) => sel.indexOf(u.id) >= 0 && u.kind === 'worker').map((u) => u.id);
      R = RTK.order(B, cfg, R, workers, { kind: 'gather', node: i });
      const rest = sel.filter((id) => workers.indexOf(id) < 0);
      if (rest.length) R = RTK.order(B, cfg, R, rest, { kind: 'move', to: i });
      return 'gather';
    }
    R = RTK.order(B, cfg, R, sel, { kind: 'move', to: i });
    return 'move';
  }
  function armedClick(i) {
    const was = armed;
    armed = null;
    if (was === 'amove' && sel.length) { R = RTK.order(B, cfg, R, sel, { kind: 'amove', to: i }); return 'amove'; }
    if (was === 'build') { try { R = RTK.build(B, cfg, R, 'player', 'barracks', i); return 'built'; } catch (e) { return String(e.message).replace(/^rts: /, ''); } }
    return null;
  }
  function trainAt(n) {
    const b = selB && R.buildings.find((x) => x.id === selB), kind = b && RTK.BUILDINGS[b.kind].trains[n];
    if (!kind) return null;
    try { R = RTK.train(B, cfg, R, selB, kind); return true; } catch (e) { return String(e.message).replace(/^rts: /, ''); }
  }

  // the pointer: a click selects (or carries out what is armed), a drag boxes, the right button orders
  const el = api.renderer.domElement;
  let down = null;
  if (typeof window !== 'undefined') {
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (result) return; const i = api.spotAt(e); if (i >= 0) { command(i); drawPanel(); } });
    el.addEventListener('pointerdown', (e) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY, shift: e.shiftKey }; });
    el.addEventListener('pointermove', (e) => {
      if (!down || !boxEl) return;
      const w = Math.abs(e.clientX - down.x), h = Math.abs(e.clientY - down.y);
      if (w + h < 6) return;
      Object.assign(boxEl.style, { display: 'block', left: Math.min(e.clientX, down.x) + 'px', top: Math.min(e.clientY, down.y) + 'px', width: w + 'px', height: h + 'px' });
    });
    el.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0 || result) { down = null; return; }
      const d = down;
      down = null;
      if (boxEl) boxEl.style.display = 'none';
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) >= 6) { boxSelect(d.x, d.y, e.clientX, e.clientY, d.shift); return; }
      const i = api.spotAt(e);
      if (i < 0) return;
      if (armed) armedClick(i); else selectAt(i, d.shift);
      drawPanel();
    });
    window.addEventListener('keydown', (e) => {
      if (result) return;
      if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sel = R.units.filter((u) => u.side === 'player' && u.kind !== 'worker').map((u) => u.id); selB = null; }
      else if (e.code === 'KeyA' && sel.length) armed = 'amove';
      else if (e.code === 'KeyB') armed = 'build';
      else if (e.code === 'KeyS' && sel.length) R = RTK.order(B, cfg, R, sel, { kind: 'stop' });
      else if (e.code === 'KeyH' && sel.length) R = RTK.order(B, cfg, R, sel, { kind: 'hold' });
      else if (e.code === 'KeyQ') trainAt(0);
      else if (e.code === 'KeyW') trainAt(1);
      else if (e.code === 'Escape') { armed = null; sel = []; selB = null; }
      drawPanel();
    });
  }
  // a box on the screen: every unit of the player's whose place falls inside it
  function boxSelect(x0, y0, x1, y1, add) {
    const r = el.getBoundingClientRect(), lo = [Math.min(x0, x1), Math.min(y0, y1)], hi = [Math.max(x0, x1), Math.max(y0, y1)], v = new THREE.Vector3();
    const inside = R.units.filter((u) => {
      if (u.side !== 'player') return false;
      const w = api.worldAt([u.x, u.y]);
      v.set(w[0], w[1], w[2] + 0.5).project(api.camera);
      const sx = r.left + ((v.x + 1) / 2) * r.width, sy = r.top + ((1 - v.y) / 2) * r.height;
      return sx >= lo[0] && sx <= hi[0] && sy >= lo[1] && sy <= hi[1];
    }).map((u) => u.id);
    sel = add ? sel.concat(inside.filter((id) => sel.indexOf(id) < 0)) : inside;
    selB = null;
    drawPanel();
  }

  // what the effects play: an archer's arrow, a blow's sparks, a fall
  function show(events) {
    for (const e of events) {
      if (e.kind === 'shot' && FX) {
        const a = R.units.find((u) => u.id === e.from), t = R.units.find((u) => u.id === e.to) || R.buildings.find((b) => b.id === e.to);
        if (!a || !t) continue;
        const from = api.worldAt([a.x, a.y]), to = t.x != null ? api.worldAt([t.x, t.y]) : tops[t.at];
        FX.play(e.uk === 'archer' ? 'arrow' : 'hit', { from: [from[0], from[1], from[2] + 0.6], at: to, targets: [to], seed: 'rts:' + R.t.toFixed(1) + ':' + e.from });
      } else if (e.kind === 'down' && FX) { const w = api.worldAt(e.at); FX.play(e.kind2 === 'base' || e.kind2 === 'barracks' ? 'strike' : 'hit', { at: w, targets: [w], seed: 'down:' + e.id }); }
      else if (e.kind === 'won' || e.kind === 'lost') end(e.kind === 'won');
    }
  }
  function end(won) {
    result = { won };
    banner.style.display = 'block';
    banner.textContent = won ? 'Victory\ntheir base has fallen' : 'Defeat\nyour base has fallen';
    api.push(won ? 'board-won' : 'board-lost');
  }

  function advance(dt) {
    if (result) return;
    const o = RTK.tick(B, cfg, R, Math.min(0.2, dt));
    R = o.R;
    show(o.events);
  }
  let panelT = 0;
  sync(); drawPanel();
  return {
    step(dt) { advance(dt); sync(); if ((panelT += dt) > 0.25) { panelT = 0; drawPanel(); } },
    readout(i) {
      if (result) return result.won ? 'victory' : 'defeat';
      const b = R.buildings.find((x) => x.at === i), n = R.nodes.find((x) => x.at === i && x.left > 0);
      if (b) return `${b.side === 'player' ? 'your' : 'their'} ${RTK.BUILDINGS[b.kind].name.toLowerCase()} (${Math.max(0, Math.round(b.hp))} / ${b.hpMax})`;
      if (n) return `gold to mine: ${n.left}`;
      return armed === 'build' ? (RTK.open(B, R, i) ? 'build here' : 'nothing can stand here') : '';
    },
    probe: {
      state: () => R, get selected() { return { units: sel.slice(), building: selB }; }, get result() { return result; },
      select(ids) { sel = ids.slice(); selB = null; drawPanel(); }, selectBuilding(id) { sel = []; selB = id; drawPanel(); },
      selectAt, command, armedClick, arm(what) { armed = what; }, trainAt, boxSelect,
      order(o) { R = RTK.order(B, cfg, R, sel, o); }, run(dt) { advance(dt); sync(); },
    },
  };
}
