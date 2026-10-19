/**
 * REAL-TIME STRATEGY ON THE WORLD PAGE — the skirmish (board-rts.js) played over the board: units drawn by side and
 * kind with their health over them, buildings and resource nodes on their spots, the selection ringed, a panel with
 * the purse and what is selected. The level hears `board-won`, `board-lost` or `board-draw` (the `board` mechanic ends it).
 *
 *   select: click a unit, shift-click to add, drag a box on the ground; Ctrl+A every fighter
 *   orders (to the selection): right-click the ground (move), a foe (attack), a node (workers gather), your foundation
 *   (workers build it), your damaged building or machine (workers repair it), your transport (the rest board it), with a
 *   building selected its rally point; U: a transport unloads where it stands; D: a siege deploys (or packs), what comes
 *   folded is set up where it stands; G: the selected building grows into what it upgrades to; F: the selection
 *   casts its abilities (stim, a shield); a status shows as a mark on whom it is on, an aura as a ring on the ground,
 *   one selected unit's reach as a ring, a cloaked foe not at all until something of the player's detects it; A then click: attack-move · S stop · H hold · B then click: build (B again: the next
 *   building the side can raise) · Q / W / E / R: the selected building trains its first … fourth kind · T: it researches
 *   its next step · Esc lets go
 *   a side with a roster (cfg.sides: a civilization's, board-rts-tech.js) is drawn as its technology crafted it (its
 *   looks, board-rts-look.js), in its team colour; what it has no look for is drawn as the plain kinds are
 *   the camera: the RTS form (the arrows and the screen's edge pan, Z X zoom; WASD is the orders' here)
 *   the clock: the game's time in the panel; P pauses, [ ] slow it and speed it (half, normal, faster, double); every
 *   action the player takes goes through the kernel's one way in (act) and is logged by its step, so the game replays
 *   from its log; each side's actions a minute (APM, the human measure) beside the clock
 *   control groups: Ctrl+1 … 9 keeps the selection (a building alone, too), Shift+n adds to it, n takes it again (twice
 *   quickly: the camera goes to it); . the next idle worker, the camera to it
 *   standing orders: I what the selected kind does when idle (a worker: wait, gather, repair; a fighter: wait, hold);
 *   Y the selected building repeats what it trains (each in turn, then off); C the selected kind casts on its own
 *   the fog (cfg.fog): ground no unit or building of the player's has seen dark, ground seen before dimmed, the foe's
 *   units only where the player sees them, its buildings remembered as last seen (a grey ghost, no health), the
 *   enemy's count what is in sight; an order on a remembered building attack-moves there
 *   a match (cfg.match): a lobby before the clock (your side and the opponent's: as minted, the other's, the plain
 *   tables, or random; the opponent's level; the purse; the workers; the victory rule; the fog), then the match; End
 *   twice gives up; the results after (the winner, the time, each side's count, its APM and its army over time) with
 *   Rematch (the same setup, the fields laid anew), New match (the lobby) and Leave (the level ends as the last
 *   match went)
 *
 * `boardRtsPage(api)` runs on the page only, inside the board channel's block (api: { THREE, scene, camera, renderer,
 * D, B, root, tops, panel, FX, RTK, spotAt, worldAt, push }); emitted only when a board has `rts`. It returns
 * { step(dt), readout(spot), probe }.
 */

/* global window, document */
export function boardRtsPage(api) {
  const { THREE, D, B, root, tops, FX, RTK } = api, cfg0 = D.rts, cell = B.cell;
  // a match plays as its lobby sets it up: the cfg each match is played under
  let cfg = cfg0, phase = cfg0.match ? 'lobby' : 'play';
  let R = RTK.start(B, cfg), sel = [], selB = null, armed = null, result = null, said = '';
  // the clock's hand on it, and what the player did, by step (a replay's log)
  const SPEEDS = [0.5, 1, 1.4, 2], log = [], groups = {};
  let paused = false, speedK = 1, lastGroup = null, idleK = 0;
  // every action of the player's: through the kernel's one way in, logged when it took
  function act(a) {
    try { const s = RTK.stepOf(R); R = RTK.act(B, cfg, R, a); log.push({ s, a }); return true; } catch (e) { return String(e.message).replace(/^rts: /, ''); }
  }
  const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
  const basic = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: o != null, opacity: o == null ? 1 : o, depthWrite: o == null });
  {
    let lit = false;
    api.scene.traverse((o) => { if (o.isLight) lit = true; });
    if (!lit) { const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(-0.4, -0.7, 1); root.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3328, 0.85), sun); }
  }
  // each side's colour: its civilization's team colour where the two differ, else blue and red
  const hexOf = (h) => parseInt(String(h).slice(1), 16);
  let S, SIDE;
  function sidesOf() {
    S = { player: RTK.roster(cfg, 'player'), enemy: RTK.roster(cfg, 'enemy') };
    SIDE = S.player.team && S.enemy.team && S.player.team !== S.enemy.team ? { player: hexOf(S.player.team), enemy: hexOf(S.enemy.team) } : { player: 0x3d8bff, enemy: 0xe5533d };
  }
  sidesOf();
  const UN = (side, k) => S[side].units[k], BU = (side, k) => S[side].buildings[k], lookOf = (side, k) => (S[side].looks && S[side].looks[k]) || null;
  const role = (u) => UN(u.side, u.kind).role, isWorker = (u) => role(u) === 'worker';
  // a look as a mesh: its triangles in its palette, the main mass leaning to the side's colour
  const geoms = {};
  function lookMesh(side, k, L) {
    const key = side + ':' + k;
    if (!geoms[key]) {
      const n = L.t.length, pos = new Float32Array(n * 9), col = new Float32Array(n * 9), c = new THREE.Color(), team = new THREE.Color(SIDE[side]);
      const pal = L.pal.map((h, i) => { c.set(h); if (L.team.indexOf(i) < 0) return [c.r, c.g, c.b]; return [c.r * 0.4 + team.r * 0.6, c.g * 0.4 + team.g * 0.6, c.b * 0.4 + team.b * 0.6]; });
      for (let i = 0; i < n * 9; i++) pos[i] = L.p[i] / 100;
      for (let i = 0; i < n; i++) for (let v = 0; v < 3; v++) { const q = pal[L.t[i]]; col[i * 9 + v * 3] = q[0]; col[i * 9 + v * 3 + 1] = q[1]; col[i * 9 + v * 3 + 2] = q[2]; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      geoms[key] = g;
    }
    return new THREE.Mesh(geoms[key], new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  }
  const bar = (h) => {
    const mk = (c, o, ord) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: c, transparent: true, opacity: o, depthTest: false })); sp.center.set(0, 0.5); sp.scale.set(0.8, 0.08, 1); sp.position.set(-0.4, 0, h); sp.renderOrder = ord; return sp; };
    return [mk(0x222222, 0.8, 6), mk(0x6bff8a, 0.95, 7)];
  };
  const fillBar = (fill, k, w) => { fill.scale.x = Math.max(0.001, w * k); fill.material.color.setHex(k > 0.5 ? 0x6bff8a : k > 0.25 ? 0xffd23d : 0xff6b5a); };

  // ── what stands: units by side and kind, buildings, the nodes ───────────────────────────────────────────────────
  const INFANTRY = ['melee', 'ranged', 'guard'];
  function unitMesh(u) {
    const g = new THREE.Group(), body = new THREE.Group(), c = SIDE[u.side], L = lookOf(u.side, u.kind), r = role(u), U = UN(u.side, u.kind);
    if (L && !L.hand) {
      // a crafted machine: its look, standing on its spot (a flyer over it)
      body.add(lookMesh(u.side, u.kind, L));
      if (U.fly) { body.position.z = 1.6; const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), basic(0x000000, 0.25)); sh.position.z = 0.04; g.add(sh); }
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 24), basic(0x7dffb0, 0.9)); ring.position.z = 0.06; ring.visible = false;
      const [back, fill] = bar(L.h + (U.fly ? 1.6 : 0) + 0.45);
      g.add(body, ring, back, fill);
      g.userData = { body, ring, fill };
      if (U.aura) auraRing(g, U.aura);
      return g;
    }
    if (r === 'worker') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.6, 10), lambert(c)); t.rotation.x = Math.PI / 2; t.position.z = 0.3;
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.26), lambert(0x8a6a44)); pack.position.set(-0.2, 0, 0.4);
      body.add(t, pack);
    } else if (r === 'melee' || r === 'guard') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 10), lambert(c)); t.rotation.x = Math.PI / 2; t.position.z = 0.45;
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.5), lambert(0xb8c4cc)); shield.position.set(0.3, 0, 0.5);
      body.add(t, shield);
    } else {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.85, 10), lambert(c)); t.rotation.x = Math.PI / 2; t.position.z = 0.43;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 10), lambert(0x3e5e3a)); hat.rotation.x = Math.PI / 2; hat.position.z = 1.0;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 16, Math.PI), lambert(0x8a6a44)); bow.position.set(0.25, 0, 0.55); bow.rotation.y = Math.PI / 2;
      body.add(t, hat, bow);
    }
    // infantry carries its civilization's weapon, crafted, in its hand
    if (L && L.hand && INFANTRY.indexOf(r) >= 0) {
      for (const o of body.children.slice(1)) body.remove(o);
      const w = lookMesh(u.side, u.kind, L); w.position.set(0.3, 0.12, 0.35); body.add(w);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lambert(0xe8c8a0)); head.position.z = r === 'worker' ? 0.72 : 1.02;
    body.add(head);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 24), basic(0x7dffb0, 0.9)); ring.position.z = 0.06; ring.visible = false;
    const [back, fill] = bar(r === 'worker' ? 1.05 : 1.35);
    g.add(body, ring, back, fill);
    g.userData = { body, ring, fill };
    if (U.aura) auraRing(g, U.aura);
    return g;
  }
  function buildingMesh(b) {
    const L = lookOf(b.side, b.kind);
    if (L) {
      // a crafted building: its look, raised as it goes up, a pad in the side's colour under it
      const g = new THREE.Group(), box = new THREE.Group(), pad = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.92, cell * 0.92, 0.08), lambert(SIDE[b.side]));
      pad.position.z = 0.04; box.add(lookMesh(b.side, b.kind, L));
      const [back, fill] = bar(L.h + 0.7);
      back.scale.x = 1.2; back.position.x = -0.6; fill.position.x = -0.6;
      const ring = new THREE.Mesh(new THREE.RingGeometry(cell * 0.62, cell * 0.7, 32), basic(0x7dffb0, 0.9)); ring.position.z = 0.06; ring.visible = false;
      g.add(pad, box, back, fill, ring);
      g.userData = { fill, box, ring, look: true };
      return g;
    }
    const g = new THREE.Group(), c = SIDE[b.side], big = BU(b.side, b.kind).role === 'base' || BU(b.side, b.kind).role === 'hall';
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
  // a node: gold, or (the second resource's) a blue crystal
  function nodeMesh(res) {
    const g = new THREE.Group(), m = basic(res === 2 ? 0x5ad1ff : 0xf2c14e), geo = new THREE.OctahedronGeometry(0.3, 0);
    for (const [x, y, s] of [[0, 0, 1.3], [0.3, 0.2, 0.9], [-0.28, 0.15, 0.8], [0.1, -0.3, 0.85]]) { const k = new THREE.Mesh(geo, m); k.position.set(x, y, 0.3 * s); k.scale.set(s, s, s * 1.5); g.add(k); }
    return g;
  }
  // ── what reads at a glance: a mark a status (stun a spinning ring over it, slow a ring at its feet, poison green,
  // stim red, a shield a bubble), an aura's reach on the ground, a selected unit's range, a flash where a blow lands ──
  const MARK = { stun: [0xffd23d, 'over'], slow: [0x6fb7ff, 'feet'], poison: [0x7dff5a, 'feet'], stim: [0xff5a3c, 'feet'] };
  function dress(g, u, dt) {
    const d = g.userData, m = (d.marks = d.marks || {}), top = (d.top = d.top || (lookOf(u.side, u.kind) ? lookOf(u.side, u.kind).h + 0.3 : 1.25));
    for (const id in MARK) {
      const on = !!(u.st && u.st[id] > 0);
      if (on && !m[id]) {
        const [c, where] = MARK[id], r = where === 'over' ? new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 18), basic(c, 0.95)) : new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 24), basic(c, 0.8));
        r.position.z = where === 'over' ? top + 0.25 : 0.08; m[id] = r; g.add(r);
      }
      if (m[id]) { m[id].visible = on; if (on && id === 'stun') m[id].rotation.z += 6 * dt; }
    }
    const shielded = u.shield > 0;
    if (shielded && !m.shield) { m.shield = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), basic(0x8fe8ff, 0.22)); m.shield.position.z = top * 0.5; g.add(m.shield); }
    if (m.shield) m.shield.visible = shielded;
    // a blow landed: the body lit for a moment
    if (d.flash > 0) d.flash -= dt;
    const lit = d.flash > 0 ? 0x666666 : 0;
    if (d.lit !== lit) { d.lit = lit; d.body.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(lit); }); }
    // cloaked: its own see it faintly; a foe that cannot see it, not at all
    const U = UN(u.side, u.kind);
    if (U.cloak) {
      const unseen = u.side === 'enemy' && RTK.hidden(B, cfg, R, u, 'player'), faint = u.side === 'player' || !unseen ? (u.side === 'player' ? 0.45 : 1) : 0;
      g.visible = g.visible && !unseen;
      if (d.faint !== faint) { d.faint = faint; d.body.traverse((o) => { if (o.isMesh && o.material) { o.material.transparent = faint < 1; o.material.opacity = faint; } }); }
    }
  }
  // an aura's reach, faint on the ground: its own side's green, a foe's against it violet
  function auraRing(g, A) {
    const r = new THREE.Mesh(new THREE.RingGeometry(A.r * cell * 0.5 - 0.06, A.r * cell * 0.5, 48), basic(A.who === 'foe' ? 0xb07dff : 0x7dffb0, 0.28));
    r.position.z = 0.05; g.add(r);
  }
  // ── the fog: a veil a spot, dark where the player never saw, dim where it saw before; ghosts where it remembers a
  // building that is gone ──
  let fogged = !!cfg.fog;
  const veils = [], ghosts = {};
  let V = fogged ? RTK.view(B, cfg, R, 'player') : null;
  function ghostly(g, on) {
    if (g.userData.ghost === on) return;
    g.userData.ghost = on;
    g.traverse((o) => { if (o.isMesh && o.material && o.material.color && !o.material.map) { o.material.transparent = on || o.material.opacity < 1; if (on) { o.userData.was = o.userData.was == null ? o.material.opacity : o.userData.was; o.material.opacity = 0.35; } else if (o.userData.was != null) o.material.opacity = o.userData.was; } });
  }
  function drawFog() {
    if (!veils.length) for (let i = 0; i < B.spots.length; i++) {
      const t = tops[i];
      if (!t) { veils.push(null); continue; }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell), basic(0x05070c, 0.8)); m.position.set(t[0], t[1], t[2] + 0.3); m.renderOrder = 5; root.add(m); veils.push(m);
    }
    for (let i = 0; i < veils.length; i++) {
      const m = veils[i];
      if (!m) continue;
      const o = V.seen[i] ? 0 : V.explored[i] ? 0.45 : 0.82;
      m.visible = o > 0;
      if (m.material.opacity !== o && o > 0) m.material.opacity = o;
    }
    // what it remembers of a building that is no longer there (it has not seen it fall)
    const live = {};
    for (const gh of V.ghosts) {
      if (R.buildings.some((b) => b.id === gh.id)) continue;
      live[gh.id] = 1;
      if (!ghosts[gh.id]) { const g = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.7, cell * 0.7, 1.2), basic(0x9aa0a8, 0.35)); const t = tops[gh.at]; g.position.set(t[0], t[1], t[2] + 0.6); root.add(g); ghosts[gh.id] = g; }
    }
    for (const id in ghosts) if (!live[id]) { root.remove(ghosts[id]); delete ghosts[id]; }
  }
  const meshes = {}, nodes = {};
  let rangeRing = null, lastDt = 0;
  function sync() {
    const live = {};
    if (fogged) V = RTK.view(B, cfg, R, 'player');
    for (const u of R.units) {
      live[u.id] = 1;
      if (!meshes[u.id]) { meshes[u.id] = unitMesh(u); root.add(meshes[u.id]); }
      const g = meshes[u.id], w = api.worldAt([u.x, u.y]);
      g.position.set(w[0], w[1], w[2]);
      g.visible = !u.inside && !(fogged && u.side === 'enemy' && RTK.hidden(B, cfg, R, u, 'player'));
      // deployed: squat and wide, as a siege set to fire
      const squat = u.mode ? 0.72 : 1; g.userData.body.scale.set(2 - squat, 2 - squat, squat);
      if (u.path.length) { const to = tops[u.path[0]]; g.userData.body.rotation.z = Math.atan2(to[1] - w[1], to[0] - w[0]); }
      fillBar(g.userData.fill, u.hp / UN(u.side, u.kind).hp, 0.8);
      g.userData.ring.visible = sel.indexOf(u.id) >= 0;
      dress(g, u, lastDt);
    }
    for (const b of R.buildings) {
      live[b.id] = 1;
      // (upgraded in place: drawn again as what it became)
      if (meshes[b.id] && meshes[b.id].userData.kind !== b.kind) { root.remove(meshes[b.id]); delete meshes[b.id]; }
      if (!meshes[b.id]) { meshes[b.id] = buildingMesh(b); meshes[b.id].userData.kind = b.kind; const p = tops[b.at]; meshes[b.id].position.set(p[0], p[1], p[2]); root.add(meshes[b.id]); }
      const g = meshes[b.id], up = b.raising > 0 ? 1 - b.raising / BU(b.side, b.kind).time : 1;
      g.userData.box.scale.z = Math.max(0.05, up);
      if (!g.userData.look) { g.userData.box.position.z = (g.userData.box.geometry.parameters.depth * up) / 2; g.userData.roof.visible = up >= 1; }
      fillBar(g.userData.fill, b.hp / b.hpMax, 1.2);
      g.userData.ring.visible = selB === b.id;
      // in the fog: the foe's building where the player sees it, else as last seen (grey, no health), else not at all
      if (fogged && b.side === 'enemy') {
        const seen = !!V.seen[b.at], mem = R.mem.player[b.id];
        g.visible = seen || !!mem;
        const back = g.children[g.children.indexOf(g.userData.fill) - 1];
        g.userData.fill.visible = seen; if (back) back.visible = seen;
        ghostly(g, !seen);
      }
    }
    for (const id in meshes) if (!live[id]) { root.remove(meshes[id]); delete meshes[id]; }
    if (fogged) drawFog();
    // one fighter selected: its reach on the ground
    const one = sel.length === 1 && R.units.find((u) => u.id === sel[0]), reach = one && RTK.statsOf(cfg, one).range;
    if (rangeRing && (!one || rangeRing.userData.r !== reach)) { root.remove(rangeRing); rangeRing = null; }
    if (one && reach > 1.5 && !rangeRing) { rangeRing = new THREE.Mesh(new THREE.RingGeometry(reach * cell * 0.5 - 0.05, reach * cell * 0.5, 64), basic(0xffffff, 0.35)); rangeRing.userData.r = reach; root.add(rangeRing); }
    if (rangeRing) { const w = api.worldAt([one.x, one.y]); rangeRing.position.set(w[0], w[1], w[2] + 0.07); }
    for (const n of R.nodes) {
      if (!nodes[n.at]) { nodes[n.at] = nodeMesh(n.res); const p = tops[n.at]; nodes[n.at].position.set(p[0], p[1], p[2]); root.add(nodes[n.at]); }
      const full = (cfg.nodes.find((x) => x.at === n.at) || { amount: 400 }).amount, k = Math.max(0.15, n.left / full);
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
  // what the player's side can raise (B, B again for the next), and the step its building researches next (T)
  let P = S.player, raisable = Object.keys(P.buildings).filter((k) => P.buildings[k].cost);
  let buildK = 0;
  const tier = () => RTK.tierOf(cfg, R, 'player');
  const needsOf = (K) => RTK.lockOf(cfg, R, 'player', K);
  function nextStep(b) {
    const L = P.research || {}, known = (R.known && R.known.player) || {};
    const order = (P.study || []).concat(Object.keys(L)).filter((id, i, a) => a.indexOf(id) === i);
    return order.find((id) => (BU('player', b.kind).studies || []).indexOf(id) >= 0 && !known[id] && !R.buildings.some((x) => x.side === 'player' && x.study && x.study.id === id) && !needsOf(L[id])) || null;
  }
  // the selection's abilities (F) and, for one unit, what is on it
  function abilityLine() {
    const us = R.units.filter((u) => sel.indexOf(u.id) >= 0), names = {};
    for (const u of us) for (const k in UN('player', u.kind).abilities || {}) names[k] = Math.max(names[k] || 0, (u.cool && u.cool[k]) || 0);
    const ab = Object.keys(names).map((k) => (names[k] > 0 ? `${k} ${Math.ceil(names[k])} s` : k)).join(', ');
    const on = us.length === 1 ? Object.keys(us[0].st || {}).concat(us[0].shield > 0 ? [`shield ${Math.round(us[0].shield)}`] : []).filter((k) => k !== 'shield' || us[0].shield > 0) : [];
    return `${ab ? `  F: ${ab}` : ''}${on.length ? `  [${on.join(', ')}]` : ''}`;
  }
  function drawPanel() {
    const mine = R.units.filter((u) => u.side === 'player'), workers = mine.filter(isWorker).length;
    const b = selB && R.buildings.find((x) => x.id === selB);
    const kinds = {};
    for (const u of R.units) if (sel.indexOf(u.id) >= 0) kinds[u.kind] = (kinds[u.kind] || 0) + 1;
    const carrying = R.units.filter((u) => sel.indexOf(u.id) >= 0 && UN('player', u.kind).carries).map((u) => `${(u.cargo || []).length} / ${UN('player', u.kind).carries} aboard`).join(', ');
    const standing = Object.keys(kinds).map((k) => `${ruleOf(k) !== 'stop' ? ` idle: ${ruleOf(k)}` : ''}${R.auto && R.auto.player && R.auto.player[k] ? ' auto-cast' : ''}`).join('');
    let what = sel.length ? `selected: ${sel.length} (${Object.keys(kinds).map((k) => kinds[k] + ' ' + UN('player', k).name.toLowerCase()).join(', ')})${standing ? ` ·${standing}` : ''}${carrying ? `  ${carrying} · U: unload` : ''}${R.units.some((u) => sel.indexOf(u.id) >= 0 && (UN('player', u.kind).modes || UN('player', u.kind).deploys)) ? '  D: deploy' : ''}${abilityLine()}` : '';
    if (b) {
      const K = BU('player', b.kind), L = P.research || {}, step = b.raising <= 0 && !b.study ? nextStep(b) : null;
      const builders = R.units.filter((u) => u.order.kind === 'build' && u.order.target === b.id).length;
      what = `${K.name}${b.raising > 0 ? (builders ? ` (going up, ${Math.ceil(b.raising)} s, ${builders} building)` : ' (a foundation: right-click it with workers to build)') : b.hp < b.hpMax ? ` (${Math.round(b.hp)} / ${b.hpMax}: right-click it with workers to repair)` : ''}  ${(K.trains || []).map((k, n) => `${'QWER'[n]}: ${UN('player', k).name} ${UN('player', k).cost}${UN('player', k).cost2 ? '+' + UN('player', k).cost2 : ''}${needsOf(UN('player', k)) ? ' (locked)' : ''}`).join('  ')}`
        + `${b.study ? `  researching ${L[b.study.id].name} (${Math.ceil(b.study.left)} s)` : step ? `  T: research ${L[step].name} ${L[step].cost}` : ''}`
        + `${b.up ? `  becoming a ${BU('player', b.up.to).name} (${Math.ceil(b.up.left)} s)` : K.upgrades ? `  G: grow into a ${BU('player', K.upgrades.to).name} ${K.upgrades.cost}${needsOf(Object.assign({}, BU('player', K.upgrades.to), { needs: K.upgrades.needs, tier: K.upgrades.tier })) ? ' (locked)' : ''}` : ''}${b.queue.length ? `  queue ${b.queue.map((q) => UN('player', q.kind).name).join(', ')}` : ''}${b.repeat ? `  repeating ${UN('player', b.repeat).name}` : ''}`;
    }
    const k = raisable[buildK % raisable.length], K = P.buildings[k], need = K && needsOf(K);
    const sup = RTK.supplyOf(cfg, R, 'player'), ore = P.res2 ? `   ${RTK.res2Name(cfg, 'player')} ${(R.ore && R.ore.player) || 0}` : '';
    const top = `${clock(R.t)}${paused ? '  paused' : ''}${SPEEDS[speedK] !== 1 ? `  ×${SPEEDS[speedK]}` : ''}   apm ${RTK.apmOf(R, 'player')} · them ${RTK.apmOf(R, 'enemy')}\n`;
    const text = top + `gold ${R.gold.player}${ore}${sup.cap ? `   supply ${sup.used} / ${sup.cap}` : ''}   workers ${workers}   army ${mine.length - workers}   tier ${tier()}${cfg.doctrine && cfg.doctrine.player ? `   ${RTK.DOCTRINES[cfg.doctrine.player].name.toLowerCase()}` : ''}   enemy ${fogged ? `${V.units.filter((u) => u.side === 'enemy').length} in sight` : R.units.filter((u) => u.side === 'enemy').length}\n${what || 'click or drag to select'}${armed ? `\n${armed === 'amove' ? 'attack-move: click where' : `build a ${K.name} (${K.cost})${need ? `, needs ${need}` : ''}: click a spot · B: the next`}` : ''}`;
    if (text !== said) { pan.textContent = text; said = text; }
  }

  // ── the player's hand ───────────────────────────────────────────────────────────────────────────────────────────
  const place = (x) => (x.x != null ? [x.x, x.y] : [(x.at % B.cols) + 0.5, Math.floor(x.at / B.cols) + 0.5]);
  const near = (list, p, r) => list.filter((x) => Math.hypot(place(x)[0] - p[0], place(x)[1] - p[1]) <= r).sort((a, b) => Math.hypot(place(a)[0] - p[0], place(a)[1] - p[1]) - Math.hypot(place(b)[0] - p[0], place(b)[1] - p[1]))[0] || null;
  const spotP = (i) => [(i % B.cols) + 0.5, Math.floor(i / B.cols) + 0.5];
  function selectAt(i, add) {
    const p = spotP(i), u = near(R.units.filter((x) => x.side === 'player' && !x.inside), p, 0.8), b = !u && R.buildings.find((x) => x.side === 'player' && x.at === i);
    if (u) { selB = null; sel = add ? (sel.indexOf(u.id) >= 0 ? sel.filter((x) => x !== u.id) : sel.concat([u.id])) : [u.id]; }
    else if (b) { sel = []; selB = b.id; }
    else if (!add) { sel = []; selB = null; }
    drawPanel();
  }
  function command(i) {
    const p = spotP(i);
    if (selB) { act({ k: 'rally', id: selB, at: i }); return 'rally'; }
    if (!sel.length) return null;
    // the side's own: a foundation its workers build, a damaged building or machine they repair
    const workersSel = R.units.filter((u) => sel.indexOf(u.id) >= 0 && isWorker(u)).map((u) => u.id);
    const mineB = R.buildings.find((x) => x.side === 'player' && x.at === i), mineU = !mineB && near(R.units.filter((x) => x.side === 'player' && sel.indexOf(x.id) < 0 && UN('player', x.kind).machine), p, 0.8);
    // a transport of the side's: the rest of the selection boards it
    const ride = near(R.units.filter((x) => x.side === 'player' && !x.inside && UN('player', x.kind).carries && sel.indexOf(x.id) < 0), p, 0.8);
    if (ride) { act({ k: 'order', ids: sel.filter((id) => id !== ride.id), o: { kind: 'board', target: ride.id } }); return 'board'; }
    if (workersSel.length && mineB && mineB.raising > 0) { act({ k: 'order', ids: workersSel, o: { kind: 'build', target: mineB.id } }); return 'build'; }
    if (workersSel.length && ((mineB && mineB.hp < mineB.hpMax) || (mineU && mineU.hp < UN('player', mineU.kind).hp))) { act({ k: 'order', ids: workersSel, o: { kind: 'repair', target: (mineB || mineU).id } }); return 'repair'; }
    const foe = near(R.units.filter((x) => x.side === 'enemy' && !(fogged && RTK.hidden(B, cfg, R, x, 'player'))), p, 0.8) || R.buildings.find((x) => x.side === 'enemy' && x.at === i && !(fogged && RTK.hidden(B, cfg, R, x, 'player')));
    // (in the fog, a building it remembers there: attack-moved on)
    if (!foe && fogged && Object.keys(R.mem.player).some((id) => R.mem.player[id].at === i)) { act({ k: 'order', ids: sel, o: { kind: 'amove', to: i } }); return 'amove'; }
    const node = R.nodes.find((n) => n.at === i && n.left > 0);
    if (foe) { act({ k: 'order', ids: sel, o: { kind: 'attack', target: foe.id } }); return 'attack'; }
    if (node) {
      const workers = R.units.filter((u) => sel.indexOf(u.id) >= 0 && isWorker(u)).map((u) => u.id);
      if (workers.length) act({ k: 'order', ids: workers, o: { kind: 'gather', node: i } });
      const rest = sel.filter((id) => workers.indexOf(id) < 0);
      if (rest.length) act({ k: 'order', ids: rest, o: { kind: 'move', to: i } });
      return 'gather';
    }
    act({ k: 'order', ids: sel, o: { kind: 'move', to: i } });
    return 'move';
  }
  function armedClick(i) {
    const was = armed;
    armed = null;
    if (was === 'amove' && sel.length) { act({ k: 'order', ids: sel, o: { kind: 'amove', to: i } }); return 'amove'; }
    // laid where clicked, built by the selected workers (else the nearest)
    const ws = R.units.filter((u) => sel.indexOf(u.id) >= 0 && isWorker(u)).map((u) => u.id);
    if (was === 'build') { const r = act({ k: 'build', kind: raisable[buildK % raisable.length], at: i, ...(ws.length ? { ids: ws } : {}) }); return r === true ? 'built' : r; }
    return null;
  }
  function trainAt(n) {
    const b = selB && R.buildings.find((x) => x.id === selB), kind = b && (BU('player', b.kind).trains || [])[n];
    if (!kind) return null;
    return act({ k: 'train', id: selB, kind });
  }
  // D: what is selected deploys (a siege sets up to fire, or packs; what comes folded is set up where it stands)
  function deploy() {
    const us = R.units.filter((u) => sel.indexOf(u.id) >= 0);
    const modal = us.filter((u) => UN('player', u.kind).modes), folded = us.filter((u) => UN('player', u.kind).deploys);
    for (const u of modal) act({ k: 'order', ids: [u.id], o: { kind: 'mode', to: u.mode ? null : Object.keys(UN('player', u.kind).modes)[0] } });
    if (folded.length) act({ k: 'order', ids: folded.map((u) => u.id), o: { kind: 'deploy' } });
    return modal.length + folded.length;
  }
  // F: each selected unit casts the first of its abilities that is ready
  function castSel() {
    let n = 0;
    for (const u of R.units.filter((x) => sel.indexOf(x.id) >= 0)) {
      const A = UN('player', u.kind).abilities;
      if (!A) continue;
      const id = Object.keys(A).find((k) => !(u.cool && u.cool[k] > 0));
      if (!id) continue;
      act({ k: 'order', ids: [u.id], o: { kind: 'cast', ability: id } });
      if (FX) { const w = api.worldAt([u.x, u.y]); FX.play(A[id].shield ? 'radiance' : 'aura', { at: w, targets: [w], seed: 'cast:' + R.t.toFixed(1) + ':' + u.id }); }
      n++;
    }
    sync();
    return n;
  }
  // G: the selected building grows into what it upgrades to
  function upgradeSel() {
    if (!selB) return null;
    return act({ k: 'upgrade', id: selB });
  }
  function researchNext() {
    const b = selB && R.buildings.find((x) => x.id === selB), id = b && nextStep(b);
    if (!id) return null;
    const r = act({ k: 'research', id: selB, step: id });
    return r === true ? id : r;
  }

  // I: what the selected kind does when idle, the next of what it may (a worker: wait, gather, repair; a fighter: wait,
  // hold); Y: the selected building repeats the next of what it trains (then nothing); C: the selected kind casts on
  // its own (again: it stops)
  const ruleOf = (k) => (R.idle && R.idle.player && R.idle.player[k]) || 'stop';
  function idleRule() {
    const u = R.units.find((x) => sel.indexOf(x.id) >= 0);
    if (!u) return null;
    const U = UN('player', u.kind), ways = U.role === 'worker' ? RTK.IDLE.worker : U.atk ? RTK.IDLE.fighter : ['stop'];
    const next = ways[(ways.indexOf(ruleOf(u.kind)) + 1) % ways.length];
    return act({ k: 'idle', kind: u.kind, rule: next }) === true ? next : null;
  }
  function repeatSel() {
    const b = selB && R.buildings.find((x) => x.id === selB), T = b && (BU('player', b.kind).trains || []);
    if (!T || !T.length) return null;
    const next = b.repeat ? T[T.indexOf(b.repeat) + 1] || null : T[0];
    return act({ k: 'repeat', id: selB, kind: next }) === true ? next : null;
  }
  function autoSel() {
    const kinds = R.units.filter((u) => sel.indexOf(u.id) >= 0 && UN('player', u.kind).abilities).map((u) => u.kind).filter((k, i, a) => a.indexOf(k) === i);
    if (!kinds.length) return null;
    const on = !(R.auto && R.auto.player && R.auto.player[kinds[0]]);
    for (const k of kinds) act({ k: 'auto', kind: k, on });
    return on;
  }
  // control groups: kept (Ctrl), added to (Shift), taken again; taken twice in a row, the camera goes to it
  function group(n, how) {
    if (how === 'set') { groups[n] = selB ? { building: selB } : { units: sel.slice() }; return true; }
    if (how === 'add') { const g = groups[n] && groups[n].units ? groups[n].units : []; groups[n] = { units: g.concat(sel.filter((id) => g.indexOf(id) < 0)) }; return true; }
    const g = groups[n];
    if (!g) return false;
    if (g.building) { if (!R.buildings.some((b) => b.id === g.building)) return false; sel = []; selB = g.building; }
    else { sel = g.units.filter((id) => R.units.some((u) => u.id === id && !u.inside)); selB = null; g.units = sel.slice(); }
    if (lastGroup === n && api.focus) { const x = selB ? R.buildings.find((b) => b.id === selB) : R.units.find((u) => u.id === sel[0]); if (x) api.focus(x.x != null ? api.worldAt([x.x, x.y]) : tops[x.at]); }
    lastGroup = n;
    drawPanel();
    return selB ? 1 : sel.length;
  }
  // .: the next idle worker of the player's (waiting, nothing to do), selected, the camera to it
  function idleWorker() {
    const idle = R.units.filter((u) => u.side === 'player' && !u.inside && isWorker(u) && u.order.kind === 'stop');
    if (!idle.length) return null;
    const u = idle[idleK++ % idle.length];
    sel = [u.id]; selB = null;
    if (api.focus) api.focus(api.worldAt([u.x, u.y]));
    drawPanel();
    return u.id;
  }
  const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

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
      if (result || phase !== 'play') return;
      if (e.code === 'End') { const now = Date.now(); if (now - quit < 2000) surrender(); else { quit = now; pan.textContent = said + '\nEnd again to give up'; said = ''; } return; }
      if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sel = R.units.filter((u) => u.side === 'player' && !isWorker(u)).map((u) => u.id); selB = null; }
      else if (e.code === 'KeyA' && sel.length) armed = 'amove';
      else if (e.code === 'KeyB') { if (armed === 'build') buildK++; armed = 'build'; }
      else if (e.code === 'KeyS' && sel.length) act({ k: 'order', ids: sel, o: { kind: 'stop' } });
      else if (e.code === 'KeyH' && sel.length) act({ k: 'order', ids: sel, o: { kind: 'hold' } });
      else if (e.code === 'KeyQ') trainAt(0);
      else if (e.code === 'KeyW') trainAt(1);
      else if (e.code === 'KeyE') trainAt(2);
      else if (e.code === 'KeyR') trainAt(3);
      else if (e.code === 'KeyT') researchNext();
      else if (e.code === 'KeyU' && sel.length) act({ k: 'order', ids: sel, o: { kind: 'unload' } });
      else if (e.code === 'KeyD' && sel.length) deploy();
      else if (e.code === 'KeyG') upgradeSel();
      else if (e.code === 'KeyF' && sel.length) castSel();
      else if (e.code === 'Escape') { armed = null; sel = []; selB = null; }
      else if (/^Digit[1-9]$/.test(e.code)) { e.preventDefault(); group(Number(e.code.slice(5)), e.ctrlKey || e.metaKey ? 'set' : e.shiftKey ? 'add' : 'take'); }
      else if (e.code === 'Period') idleWorker();
      else if (e.code === 'KeyI') idleRule();
      else if (e.code === 'KeyY') repeatSel();
      else if (e.code === 'KeyC' && !(e.ctrlKey || e.metaKey)) autoSel();
      else if (e.code === 'KeyP' || e.code === 'Pause') pause(!paused);
      else if (e.code === 'BracketLeft') speedK = Math.max(0, speedK - 1);
      else if (e.code === 'BracketRight') speedK = Math.min(SPEEDS.length - 1, speedK + 1);
      if (!/^Digit/.test(e.code)) lastGroup = null;
      drawPanel();
    });
  }
  // a box on the screen: every unit of the player's whose place falls inside it
  function boxSelect(x0, y0, x1, y1, add) {
    const r = el.getBoundingClientRect(), lo = [Math.min(x0, x1), Math.min(y0, y1)], hi = [Math.max(x0, x1), Math.max(y0, y1)], v = new THREE.Vector3();
    const inside = R.units.filter((u) => {
      if (u.side !== 'player' || u.inside) return false;
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
      if (e.kind === 'shot' && meshes[e.to]) meshes[e.to].userData.flash = 0.12;
      if (e.kind === 'shot' && FX) {
        // a shot by what shoots it: an arrow from range or a defence, a shell from siege, a bolt from the air
        const a = R.units.find((u) => u.id === e.from) || R.buildings.find((b) => b.id === e.from), t = R.units.find((u) => u.id === e.to) || R.buildings.find((b) => b.id === e.to);
        if (!a || !t) continue;
        const from = a.x != null ? api.worldAt([a.x, a.y]) : tops[a.at], to = t.x != null ? api.worldAt([t.x, t.y]) : tops[t.at];
        const r = a.x != null ? UN(a.side, a.kind).role : 'defence', fx = r === 'ranged' || r === 'defence' ? 'arrow' : r === 'siege' ? 'shell' : r === 'flyer' ? 'bolt' : 'hit';
        FX.play(fx, { from: [from[0], from[1], from[2] + (r === 'flyer' ? 1.8 : r === 'defence' ? 1.4 : 0.6)], at: to, targets: [to], seed: 'rts:' + R.t.toFixed(1) + ':' + e.from });
      } else if (e.kind === 'down' && FX) { const w = api.worldAt(e.at); FX.play(!UN(e.side, e.kind2) ? 'strike' : 'hit', { at: w, targets: [w], seed: 'down:' + e.id }); }
      else if (e.kind === 'status' && FX) { const t = R.units.find((u) => u.id === e.id); if (t) { const w = api.worldAt([t.x, t.y]); FX.play(e.status === 'stun' ? 'bolt' : e.status === 'poison' ? 'venom' : 'chill', { at: w, targets: [w], seed: 'st:' + R.t.toFixed(1) + ':' + e.id }); } }
      else if (e.kind === 'healed' && FX) { const t = R.units.find((u) => u.id === e.to); if (t) { const w = api.worldAt([t.x, t.y]); FX.play('mend', { at: w, targets: [w], seed: 'heal:' + R.t.toFixed(1) + ':' + e.to }); } }
      else if (e.kind === 'won' || e.kind === 'lost' || e.kind === 'draw') end(e.kind === 'won', e.kind === 'draw');
    }
  }
  function end(won, draw) {
    result = { won, ...(draw ? { draw } : {}), ...(R.over && R.over.surrender ? { surrender: R.over.surrender } : {}) };
    // a match: its results, and the player's choice of what next; a skirmish: the level ends
    if (cfg0.match) { phase = 'results'; said = ''; drawPanel(); showResults(); return; }
    banner.style.display = 'block';
    banner.textContent = won ? 'Victory\ntheir base has fallen' : draw ? 'Stalemate\nthe gold is gone and nobody stands' : 'Defeat\nyour base has fallen';
    api.push(won ? 'board-won' : draw ? 'board-draw' : 'board-lost');
  }

  // ── the match: its lobby, its start, its results ─────────────────────────────────────────────────────────────────
  const FROM = { player: (cfg0.sides && cfg0.sides.player) || null, enemy: (cfg0.sides && cfg0.sides.enemy) || null, plain: null };
  const SIDE_KEYS = Object.keys(FROM).filter((k) => k === 'plain' || FROM[k]).concat(['random']);
  const nameOf = (k) => (k === 'random' ? 'random' : k === 'plain' ? 'plain' : (FROM[k] && FROM[k].name) || k);
  const choice = { player: 'player', enemy: FROM.enemy ? 'enemy' : 'plain', level: 'normal', gold: RTK.MATCH.gold.indexOf(cfg0.gold) >= 0 ? cfg0.gold : 100, workers: RTK.MATCH.workers.indexOf(cfg0.workers) >= 0 ? cfg0.workers : 3, victory: cfg0.victory || 'base', fog: !!cfg0.fog, seed: 1 };
  if (!FROM.player) choice.player = 'plain';
  const ROWS = [['player', 'you', SIDE_KEYS], ['enemy', 'opponent', SIDE_KEYS], ['level', 'their level', RTK.MATCH.level], ['gold', 'purse', RTK.MATCH.gold], ['workers', 'workers', RTK.MATCH.workers], ['victory', 'victory', RTK.MATCH.victory], ['fog', 'fog', RTK.MATCH.fog]];
  const menu = cfg0.match ? api.panel('left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;padding:16px 20px;min-width:360px;display:none') : null;
  const btn = (label, on, go) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = `margin:2px 4px 2px 0;padding:3px 9px;font:inherit;cursor:pointer;border-radius:4px;border:1px solid ${on ? '#7dffb0' : '#556'};background:${on ? '#24543a' : '#1c2028'};color:#eef`; b.onclick = go; return b; };
  function showLobby() {
    phase = 'lobby';
    if (!menu || typeof document === 'undefined') return;
    menu.style.display = 'block'; menu.textContent = '';
    const h = document.createElement('div'); h.textContent = 'Skirmish: set up the match'; h.style.cssText = 'font-size:18px;margin-bottom:8px'; menu.appendChild(h);
    for (const [k, label, opts] of ROWS) {
      const row = document.createElement('div'), l = document.createElement('span');
      l.textContent = label; l.style.cssText = 'display:inline-block;width:90px;opacity:0.8'; row.appendChild(l);
      for (const o of opts) row.appendChild(btn(k === 'player' || k === 'enemy' ? nameOf(o) : k === 'fog' ? (o ? 'on' : 'off') : String(o), choice[k] === o, () => { choice[k] = o; showLobby(); }));
      menu.appendChild(row);
    }
    const go = btn('Start', true, () => start()); go.style.marginTop = '10px'; go.style.fontSize = '16px'; menu.appendChild(go);
  }
  function begin(c) {
    cfg = c; sidesOf();
    for (const k in geoms) delete geoms[k];
    for (const id in meshes) { root.remove(meshes[id]); delete meshes[id]; }
    for (const at in nodes) { root.remove(nodes[at]); delete nodes[at]; }
    for (const m of veils) if (m) root.remove(m);
    veils.length = 0;
    for (const id in ghosts) { root.remove(ghosts[id]); delete ghosts[id]; }
    if (rangeRing) { root.remove(rangeRing); rangeRing = null; }
    fogged = !!cfg.fog; R = RTK.start(B, cfg); V = fogged ? RTK.view(B, cfg, R, 'player') : null;
    P = S.player; raisable = Object.keys(P.buildings).filter((k) => P.buildings[k].cost); buildK = 0;
    log.length = 0; for (const k in groups) delete groups[k];
    sel = []; selB = null; armed = null; result = null; paused = false; speedK = 1; quit = 0;
    banner.style.display = 'none';
    sync(); drawPanel();
  }
  // Start: the lobby's choices, a match
  function start() {
    begin(RTK.setup(B, cfg0, choice));
    phase = 'play';
    if (menu) menu.style.display = 'none';
    return cfg.match.choice;
  }
  // End, then End again within two seconds: the player gives up
  let quit = 0;
  function surrender() {
    if (phase !== 'play' || result) return false;
    if (act({ k: 'surrender' }) !== true) return false;
    end(false, false);
    return true;
  }
  const bars = (xs) => { const top = Math.max(1, ...xs); return xs.map((x) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor((x / top) * 7.999))]).join(''); };
  function summary() {
    const one = (side) => Object.assign({ name: side === 'player' ? 'you' : 'them', civ: S[side].name || 'plain', apm: RTK.apmOf(R, side) }, R.stats[side]);
    return { won: !!(result && result.won), draw: !!(result && result.draw), surrender: (result && result.surrender) || null, time: clock(R.t), player: one('player'), enemy: one('enemy') };
  }
  function showResults() {
    if (!menu || typeof document === 'undefined') return;
    const r = summary();
    menu.style.display = 'block'; menu.textContent = '';
    const h = document.createElement('div');
    h.textContent = `${r.won ? 'Victory' : r.draw ? 'Stalemate' : 'Defeat'}${r.surrender ? (r.surrender === 'player' ? ' (you gave up)' : ' (they gave up)') : ''} · ${r.time}`;
    h.style.cssText = 'font-size:20px;margin-bottom:8px'; menu.appendChild(h);
    const t = document.createElement('pre'); t.style.cssText = 'margin:0 0 10px;font:inherit;line-height:1.5';
    const line = (label, k) => `${label.padEnd(16)}${String(r.player[k]).padStart(8)}${String(r.enemy[k]).padStart(8)}`;
    t.textContent = [`${''.padEnd(16)}${'you'.padStart(8)}${'them'.padStart(8)}`, line('trained', 'trained'), line('units lost', 'lost'), line('raised', 'built'), line('buildings lost', 'fell'), line('mined', 'mined'), line('research', 'research'), line('apm', 'apm'),
      `army  you  ${bars(r.player.army)}`, `      them ${bars(r.enemy.army)}`].join('\n');
    menu.appendChild(t);
    menu.appendChild(btn('Rematch', true, () => rematch()));
    menu.appendChild(btn('New match', false, () => { menu.style.display = 'none'; showLobby(); }));
    menu.appendChild(btn('Leave', false, () => leave()));
  }
  function rematch() { choice.seed = (Number(choice.seed) || 1) + 1; return start(); }
  function leave() {
    if (!result) return null;
    if (menu) menu.style.display = 'none';
    phase = 'over';
    api.push(result.won ? 'board-won' : result.draw ? 'board-draw' : 'board-lost');
    return result.won ? 'won' : 'lost';
  }

  function pause(on) {
    paused = !!on;
    if (!result) { banner.style.display = paused ? 'block' : 'none'; banner.textContent = paused ? 'Paused\nP to play on' : ''; }
    drawPanel();
    return paused;
  }
  function advance(dt) {
    if (result || paused || phase !== 'play') return;
    const o = RTK.tick(B, cfg, R, Math.min(0.4, dt * SPEEDS[speedK]));
    R = o.R;
    show(o.events);
  }
  let panelT = 0;
  sync(); drawPanel();
  if (phase === 'lobby') showLobby();
  return {
    step(dt) { lastDt = dt; advance(dt); sync(); if ((panelT += dt) > 0.25) { panelT = 0; drawPanel(); } },
    readout(i) {
      if (result) return result.won ? 'victory' : 'defeat';
      if (fogged && !V.seen[i]) { const id = Object.keys(R.mem.player).find((k) => R.mem.player[k].at === i); return id ? `their ${BU('enemy', R.mem.player[id].kind).name.toLowerCase()} (last seen)` : V.explored[i] ? '' : 'unexplored'; }
      const b = R.buildings.find((x) => x.at === i), n = R.nodes.find((x) => x.at === i && x.left > 0);
      if (b) return `${b.side === 'player' ? 'your' : 'their'} ${BU(b.side, b.kind).name.toLowerCase()} (${Math.max(0, Math.round(b.hp))} / ${b.hpMax})`;
      if (n) return `gold to mine: ${n.left}`;
      return armed === 'build' ? (RTK.open(B, R, i) ? 'build here' : 'nothing can stand here') : '';
    },
    probe: {
      state: () => R, get selected() { return { units: sel.slice(), building: selB }; }, get result() { return result; },
      select(ids) { sel = ids.slice(); selB = null; drawPanel(); }, selectBuilding(id) { sel = []; selB = id; drawPanel(); },
      selectAt, command, armedClick, deploy, upgradeSel, castSel,
      marks(id) { const g = meshes[id]; if (!g) return null; const m = g.userData.marks || {}; return { marks: Object.keys(m).filter((k) => m[k].visible), visible: g.visible, flash: g.userData.flash > 0 }; }, arm(what, k) { armed = what; if (k != null) buildK = Math.max(0, raisable.indexOf(k)); }, trainAt, researchNext, boxSelect,
      looks() { const out = {}; for (const id in meshes) { let n = 0; meshes[id].traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.color) n++; }); out[id] = n; } return out; },
      order(o) { act({ k: 'order', ids: sel, o }); }, run(dt) { advance(dt); sync(); },
      researchStep(id) { const r = act({ k: 'research', id: selB, step: id }); return r === true ? id : r; },
      pause, speed(k) { if (k != null) speedK = Math.max(0, Math.min(SPEEDS.length - 1, k)); return SPEEDS[speedK]; }, get paused() { return paused; },
      get clock() { return clock(R.t); }, apm: () => ({ player: RTK.apmOf(R, 'player'), enemy: RTK.apmOf(R, 'enemy') }),
      group, idleWorker, idleRule, repeatSel, autoSel, log: () => log.slice(),
      // what the player is shown: each enemy unit's and building's mesh, drawn or not (and a building as a ghost)
      shown() { const out = {}; for (const x of R.units.concat(R.buildings)) if (x.side === 'enemy' && meshes[x.id]) out[x.id] = meshes[x.id].visible ? (meshes[x.id].userData.ghost ? 'ghost' : 'seen') : 'hidden'; for (const id in ghosts) out[id] = 'ghost'; return out; },
      view: () => (fogged ? RTK.view(B, cfg, R, 'player') : null),
      // the match: the lobby's choices (set one, start), what it is in, the results, and what follows
      get phase() { return phase; }, get choice() { return Object.assign({}, choice); }, choose(k, v) { choice[k] = v; showLobby(); return Object.assign({}, choice); },
      start, surrender, results: () => (result ? summary() : null), rematch, newMatch() { if (menu) menu.style.display = 'none'; showLobby(); return phase; }, leave, get cfg() { return cfg; },
      // the game again from the log: the same state as the one played (the clock's remainder aside)
      replays() { const a = RTK.replay(B, cfg, log, RTK.stepOf(R)), strip = (x) => JSON.stringify(Object.assign({}, x, { acc: 0 })); return strip(a) === strip(R); },
    },
  };
}
