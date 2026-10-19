/**
 * THE BOARD ON THE WORLD PAGE — the board drawn over its ground and played with the tactical camera: a faint grid of
 * its spots, highlights (reach, aim, area), a cursor the keys move the way the screen shows, the units as tokens, a
 * readout of the spot under the cursor. The page runs the board kernel and the camera from their own source
 * (board-kernel.js, board-camera.js), so what the page shows is what Node tests.
 *
 * With a battle (`D.battle`: board-battle.js readBoardBattle's cfg and units, and the sides the player moves) it plays
 * it: the player's units by a menu (Move, Act: attack, skills, items, and Wait, then a facing), the others by the board
 * mind (board-mind.js), each of their steps shown before it is taken; numbers rise off the units as blows land, a
 * turn-order bar and the active unit's card stand at the top, a forecast shows what an aimed act would do. At the end a
 * banner says who won and the level's bus hears `board-won`, `board-lost` or `board-draw` (`board-over` with no player).
 *
 * `boardPage` is emitted by its source inside the board channel's block (scene/channels/board.js) and never runs in
 * Node. From the page it uses only what a channel may: `THREE`, `scene`, `camera`, `controls`, `renderer`, `wrap` and
 * `__ctrlOwnsCamera` (it owns the camera from the start). It returns the frame step the page calls.
 *
 *   boardChannelData(laid, { units?, camera?, cursor?, drape?, clip?, battle? }) → D   what the page takes: the kernel's board,
 *     where it lies, the units (the kernel's start shape), the camera's options, the cursor's first spot, over land the
 *     ground's drape (board-lay.js), which the grid, the highlights, the pointer and the units lie on, and in rooms
 *     their floors' boxes ([[x0, y0, x1, y1]]), which hold what is drawn on a spot off the walls; a battle:
 *     { cfg, units, players } (players: the sides the player moves, ['party'] by default; [] lets the minds fight)
 *
 * Keys (the `board` input scheme, controls/schemes.js): arrows or W A S D move the cursor (the RTS form pans instead);
 * Q / E turn the view a quarter; Z / X (or the wheel) zoom; V tilts; Enter or Space (or a click) selects a unit and
 * shows its reach, then moves it there; Esc lets it go. The pointer moves the cursor to the spot under it.
 */
import { boardParse } from './board-kernel.js';

const SIDE_COLOURS = ['#4aa3ff', '#ff5a4a', '#5ad17a', '#f2c14e'];

/** What the page takes, from a laid board (board-lay.js layBoard). */
export function boardChannelData(laid, { units = [], camera = {}, cursor, drape, clip, battle } = {}) {
  const B = laid.board, at = cursor !== undefined ? boardParse(B, cursor) : -1;
  const first = at >= 0 && B.spots[at] ? at : B.spots.findIndex((s) => s && s.walk);
  const sides = [...new Set((battle ? battle.units : units).map((u) => u.side))];
  return { B, origin: laid.frame.origin, units, camera, cursor: first, colours: Object.fromEntries(sides.map((s, k) => [s, SIDE_COLOURS[k % SIDE_COLOURS.length]])),
    ...(drape ? { drape } : {}), ...(clip ? { clip } : {}), ...(battle ? { battle } : {}) };
}

/* global THREE, scene, camera, controls, renderer, wrap, __ctrlOwnsCamera, __inputQueue, window */
export function boardPage(D, K, CAM, MIND, RK, CARRY) {
  const B = D.B, O = D.origin, cell = B.cell;
  controls.enabled = false;
  __ctrlOwnsCamera = true;   // eslint-disable-line no-global-assign
  camera.up.set(0, 0, 1);

  // a spot's 3 × 3 points (south-west first, row by row): the ground's drape over land, flat at its height elsewhere
  const pts = B.spots.map((s, i) => {
    if (!s) return null;
    const c = i % B.cols, r = (i - c) / B.cols, z = O[2] + s.h * B.step, d = D.drape && D.drape[i], out = [];
    const mx = O[0] + (c + 0.5) * cell, my = O[1] + (r + 0.5) * cell;
    const box = D.clip && D.clip.find((q) => mx >= q[0] && mx <= q[2] && my >= q[1] && my <= q[3]);
    const hold = (v, lo, hi) => (box ? Math.min(hi, Math.max(lo, v)) : v);
    for (let b = 0; b <= 2; b++) for (let a = 0; a <= 2; a++) out.push([hold(O[0] + (c + a / 2) * cell, box && box[0], box && box[2]), hold(O[1] + (r + b / 2) * cell, box && box[1], box && box[3]), d ? d[b * 3 + a] : z]);
    return out;
  });
  const tops = pts.map((p) => (p ? p[4] : null));
  const centre = (i) => tops[i];
  const zs = tops.filter(Boolean).map((p) => p[2]);
  const C = CAM.init(Object.assign({ bounds: [O[0], O[1], O[0] + B.cols * cell, O[1] + B.rows * cell], z: (Math.min(...zs) + Math.max(...zs)) / 2 }, D.camera || {}));
  const rts = C.o.edge;

  // ── the overlay: the grid, the highlights, the cursor ─────────────────────────────────────────────────────────
  const root = new THREE.Group();
  scene.add(root);
  const LIFT = D.drape ? 0.1 : 0.04;
  const RING = [0, 1, 2, 5, 8, 7, 6, 3];   // a spot's edge, its points in order round it
  const inset = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + LIFT];
  {
    const seg = [];
    for (const P of pts) {
      if (!P) continue;
      for (let k = 0; k < 8; k++) { const u = inset(P[RING[k]], P[4], 0.03), v = inset(P[RING[(k + 1) % 8]], P[4], 0.03); seg.push(...u, ...v); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })));
  }
  const LAYERS = { reach: 0x3d8bff, aim: 0xff4a3d, area: 0xffd23d, road: 0xd8c08a };
  // the lit spots, one mesh rebuilt when they change: each spot its 3 × 3 points, a little in from its edge
  const marks = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  marks.renderOrder = 2;
  root.add(marks);
  const col = new THREE.Color();
  const lit = {};
  const QUADS = [[0, 1, 4, 3], [1, 2, 5, 4], [3, 4, 7, 6], [4, 5, 8, 7]];
  function paint() {
    const pos = [], cols = [];
    for (let i = 0; i < B.spots.length; i++) {
      const layer = lit.area && lit.area.has(i) ? 'area' : lit.aim && lit.aim.has(i) ? 'aim' : lit.reach && lit.reach.has(i) ? 'reach' : lit.road && lit.road.has(i) ? 'road' : null;
      if (!layer || !pts[i]) continue;
      col.set(LAYERS[layer]);
      const q = pts[i].map((p) => inset(p, pts[i][4], 0.06));
      for (const [a, b, c, d] of QUADS) for (const k of [a, b, c, a, c, d]) { pos.push(...q[k]); cols.push(col.r, col.g, col.b); }
    }
    marks.geometry.dispose();
    marks.geometry = new THREE.BufferGeometry();
    marks.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    marks.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  function highlight(layer, spots) { if (spots && spots.length) lit[layer] = new Set(spots); else delete lit[layer]; paint(); }
  paint();
  const cursorMesh = new THREE.Group();
  {
    const h = cell / 2, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0], 3));
    cursorMesh.add(new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false })));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(cell * 0.12, cell * 0.3, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = 2.2;
    cursorMesh.add(cone);
    cursorMesh.renderOrder = 4;
    root.add(cursorMesh);
  }

  // ── the units, as tokens ──────────────────────────────────────────────────────────────────────────────────────
  const battle = D.battle || null, cfg = battle ? battle.cfg : {};
  const units0 = battle ? battle.units : D.units;
  let S = units0 && units0.length ? K.start(B, cfg, units0) : null;
  const tokens = {};
  const FACE = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];   // n e s w as a heading from +x
  // a unit's figure: the controllable runtime's entity and body the board drives (none when it is a token)
  const CTRL = typeof window !== 'undefined' ? window.__mojCtrl : null;
  function figureOf(id) {
    const eid = D.figures && D.figures[id];
    if (!eid || !CTRL || !CTRL.world) return null;
    const e = CTRL.world.entities.find((x) => x.id === eid);
    return e ? { e, eid } : null;
  }
  // a drawn battle (board-battle.js draw): a token for every pack's foes, only the drawn pack's standing
  const own = battle && battle.draw ? battle.units.filter((u) => !battle.draw.some((p) => p.some((f) => f.id === u.id))) : null;
  const packUnits = (t) => own.concat(battle.draw[t]);
  const startU = {};
  if (S) for (const s of [S].concat(own ? battle.draw.map((_, t) => K.start(B, cfg, packUnits(t))) : [])) for (const id of s.order) if (!startU[id]) startU[id] = s.u[id];
  if (S) for (const id in startU) {
    const U = startU[id], g = new THREE.Group(), colour = new THREE.Color(D.colours[U.side] || '#cccccc');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.24, cell * 0.28, 1.3, 14), new THREE.MeshBasicMaterial({ color: colour }));
    body.rotation.x = Math.PI / 2;
    body.position.z = 0.65;
    const head = new THREE.Mesh(new THREE.SphereGeometry(cell * 0.17, 14, 10), new THREE.MeshBasicMaterial({ color: colour.clone().offsetHSL(0, 0, 0.15) }));
    head.position.z = 1.55;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(cell * 0.1, cell * 0.28, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(cell * 0.3, 0, 0.9);
    // the side's ring under it; the body itself is the figure's when the unit wears one (board-figures.js)
    const ring = new THREE.Mesh(new THREE.RingGeometry(cell * 0.3, cell * 0.4, 28), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.z = LIFT * 1.2;
    ring.renderOrder = 3;
    const fig = figureOf(id);
    if (fig) g.add(ring); else g.add(body, head, nose, ring);
    root.add(g);
    tokens[id] = { g, hops: [], t: 0, from: centre(U.at) };
    g.position.set(...centre(U.at));
    g.rotation.z = FACE[U.face];
  }
  // a token stands where its unit stands (unless it is still hopping there), and only while it stands
  function settleTokens() {
    for (const id in tokens) {
      const T = tokens[id], U = S.u[id];
      if (!U) { T.g.visible = false; continue; }   // a pack not drawn
      if (!T.hops.length) { T.from = centre(U.at); T.g.position.set(...T.from); T.g.rotation.z = FACE[U.face]; }
      T.g.visible = U.hp > 0;
    }
  }
  if (own && S) settleTokens();

  // ── the panels: the readout, the turn order, the unit's card, the menu, the banner, the numbers ────────────────
  const CSS = 'position:absolute;z-index:7;font:12px/1.45 ui-monospace,Menlo,monospace;color:#e8ecf2;background:rgba(10,12,16,0.72);padding:8px 10px;border-radius:6px;white-space:pre';
  const panel = (style) => { const el = document.createElement('div'); el.style.cssText = CSS + ';' + style; wrap.appendChild(el); return el; };
  const hud = panel('left:12px;bottom:12px;pointer-events:none');
  const orderEl = battle ? panel('left:12px;top:12px;pointer-events:none') : null;
  const cardEl = battle ? panel('right:12px;top:12px;pointer-events:none;min-width:190px') : null;
  const menuEl = battle ? panel('right:12px;bottom:12px;min-width:210px;display:none;cursor:pointer') : null;
  const bannerEl = battle || D.map ? panel('left:50%;top:38%;transform:translate(-50%,-50%);font-size:30px;padding:14px 26px;display:none;pointer-events:none') : null;
  const floats = [];
  const LEGEND = {
    free: rts ? 'arrows / WASD / edge: pan · Z X: zoom · V: tilt' : 'arrows / WASD: cursor · Q E: turn · Z X: zoom · V: tilt · Enter: select / move · Esc: back',
    menu: 'up / down: choose · Enter: pick · Q E: turn · Z X: zoom · V: tilt',
    move: 'arrows: cursor · Enter: move here · Esc: back',
    aim: 'arrows: cursor · Enter: act here · Esc: back',
    face: 'arrows: face that way · Enter: end the turn · Esc: back',
    deploy: 'arrows: cursor · Enter: place here · Esc: take the last one back',
    cpu: 'the other side is moving · Q E: turn · Z X: zoom',
    over: 'the battle is over',
    map: 'arrows: choose a place · Enter: go there · Q E: turn · Z X: zoom · V: tilt',
    travel: 'on the road…',
    wait: 'the level is starting',
  };
  const bar = (v, max, w) => { const n = Math.max(0, Math.round((v / Math.max(1, max)) * w)); return '█'.repeat(n) + '░'.repeat(w - n); };
  const ST = { poison: 'poisoned', sleep: 'asleep', silence: 'silenced' };
  function unitLines(U) {
    const st = Object.keys(ST).filter((k) => U.st && U.st[k]).map((k) => ST[k]);
    const bf = (U.buffs || []).map((b) => b.stat + (b.pct > 0 ? '↑' : '↓'));
    return `${U.name} (${U.side})\nHP ${bar(U.hp, U.hpMax, 10)} ${U.hp}/${U.hpMax}${U.mpMax ? `\nMP ${bar(U.mp, U.mpMax, 10)} ${U.mp}/${U.mpMax}` : ''}\nmove ${U.move}  jump ${U.jump}  spd ${K.statOf(U, 'spd')}${st.length || bf.length ? `\n${st.concat(bf).join('  ')}` : ''}`;
  }
  function float(id, text, colour) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;z-index:8;font:bold 16px ui-monospace,Menlo,monospace;text-shadow:0 1px 3px #000;pointer-events:none;transform:translate(-50%,-50%)';
    el.style.color = colour;
    el.textContent = text;
    wrap.appendChild(el);
    const p = tokens[id] ? tokens[id].g.position : null, U = S.u[id];
    floats.push({ el, at: p ? [p.x, p.y, p.z + 2.2] : [...centre(U.at)], t: 0 });
  }
  const V = new THREE.Vector3();
  function drawFloats(dt) {
    const r = renderer.domElement.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    for (let k = floats.length - 1; k >= 0; k--) {
      const F = floats[k];
      F.t += dt;
      V.set(F.at[0], F.at[1], F.at[2] + F.t * 0.8).project(camera);
      F.el.style.left = (r.left - w.left + ((V.x + 1) / 2) * r.width) + 'px';
      F.el.style.top = (r.top - w.top + ((1 - V.y) / 2) * r.height) + 'px';
      F.el.style.opacity = String(Math.max(0, 1 - Math.max(0, F.t - 0.7) / 0.6));
      if (F.t > 1.3) { F.el.remove(); floats.splice(k, 1); }
    }
  }

  // ── the cursor ────────────────────────────────────────────────────────────────────────────────────────────────
  let cursor = D.cursor >= 0 ? D.cursor : 0, sel = null, mode = battle ? 'cpu' : 'free';
  const occupant = (i) => (S ? K.occupant(S, i) : null);
  function readout() {
    if (mode === 'map' || mode === 'travel') { mapReadout(); return; }
    const s = B.spots[cursor], who = occupant(cursor), U = who && S.u[who];
    const spot = s ? `${K.nameOf(B, cursor)}  h ${s.h} (${(s.h * B.step).toFixed(1)} m)  ${s.type}${s.walk ? '' : ', shut'}` : K.nameOf(B, cursor);
    let more = '';
    if (mode === 'aim' && aiming && aiming.spots.has(cursor)) more = '\n' + forecastLines(aiming.what, cursor);
    else if (mode === 'deploy' && placing) more = `\nplace ${S.u[placing.ids[placing.k]].name} (${placing.k + 1} of ${placing.ids.length})`;
    else if (U) more = `\n${U.name} (${U.side})  hp ${U.hp}/${U.hpMax}`;
    hud.textContent = `${spot}${more}${sel ? `\nselected: ${S.u[sel].name}` : ''}\n${LEGEND[mode]}`;
  }
  function onCursor() {
    if (mode === 'aim' && aiming) {
      const sk = aiming.what.item ? K.itemOf(cfg, aiming.what.item) : K.skillOf(cfg, aiming.what.skill);
      highlight('area', aiming.spots.has(cursor) ? (sk.target === 'self' || sk.target === 'foe' || sk.target === 'ally' ? [cursor] : K.area(B, cursor, sk)) : null);
    }
    readout();
  }
  function moveCursor(i) {
    if (i < 0 || !B.spots[i]) return;
    cursor = i;
    if (!rts) CAM.focusOn(C, tops[i]);
    onCursor();
  }
  function stepCursor(dir) {
    const d = CAM.screenStep(C, dir), c0 = cursor % B.cols, r0 = (cursor - c0) / B.cols;
    for (let k = 1; k < Math.max(B.cols, B.rows); k++) {
      const c = c0 + d[0] * k, r = r0 + d[1] * k;
      if (c < 0 || r < 0 || c >= B.cols || r >= B.rows) return;
      if (B.spots[r * B.cols + c]) { moveCursor(r * B.cols + c); return; }
    }
  }

  // ── free mode (a board with units and no battle): select a unit, see its reach, move it there ───────────────────
  function select() {
    if (!S) return;
    if (sel && sel !== occupant(cursor) && lit.reach && lit.reach.has(cursor)) {
      const path = K.path(B, S, sel, cursor), U = S.u[sel], T = tokens[sel];
      T.hops.push(...path.slice(1));
      const a = path[path.length - 2], b = path[path.length - 1], dc = (b % B.cols) - (a % B.cols), dr = Math.floor(b / B.cols) - Math.floor(a / B.cols);
      U.face = Math.abs(dr) > Math.abs(dc) ? (dr > 0 ? 0 : 2) : (dc > 0 ? 1 : 3);
      U.at = cursor;
      sel = null; highlight('reach', null);
    } else if (occupant(cursor) && occupant(cursor) !== sel) {
      sel = occupant(cursor); highlight('reach', K.reach(B, S, sel));
    } else { sel = null; highlight('reach', null); }
    readout();
  }

  // ── the battle: the player's turns by the menu, the other side's by the mind ──────────────────────────────────
  const HUMAN = new Set(battle ? battle.players || ['party'] : []);
  let menu = null, aiming = null, face = 0, cpu = null, busy = 0, result = null, placing = null;
  const legalNow = () => K.legal(B, cfg, S);
  const sameAct = (a, b) => a.kind === b.kind && a.to === b.to && a.skill === b.skill && a.item === b.item && a.at === b.at && a.face === b.face;
  function forecastLines(what, at) {
    return MIND.forecast(K, B, cfg, S, Object.assign({ kind: 'act', at }, what)).map((f) => {
      const parts = [f.name];
      if (f.hurt != null) parts.push(`${f.hp} → ~${Math.max(0, f.hp - f.hurt)}  ${f.chance}%${f.rel && f.rel !== 'front' ? '  ' + f.rel : ''}`);
      if (f.heal != null) parts.push(`+${f.heal}`);
      if (f.revive) parts.push('raise');
      if (f.status) parts.push(`${f.status.is} ${f.status.chance}%`);
      if (f.buff) parts.push(`${f.buff.stat} ${f.buff.pct > 0 ? '↑' : '↓'}`);
      return parts.join('  ');
    }).join('\n');
  }
  function drawSide() {
    if (!battle) return;
    const P = S.turn ? K.preview(B, S, 8) : [];
    orderEl.textContent = 'turn order\n' + P.map((x, k) => `${k ? '  ' : '▶ '}${S.u[x.who].name}${HUMAN.has(x.side) ? '' : ' ·'}`).join('\n');
    cardEl.textContent = mode === 'deploy' && placing ? unitLines(S.u[placing.ids[placing.k]]) : S.turn ? unitLines(S.u[S.turn.who]) : '';
  }
  function drawMenu() {
    menuEl.style.display = 'block';
    menuEl.innerHTML = '';
    menu.items.forEach((it, k) => {
      const row = document.createElement('div');
      row.textContent = (k === menu.i ? '▶ ' : '  ') + it.label;
      row.style.opacity = it.ok ? '1' : '0.4';
      row.onclick = () => { if (it.ok) { menu.i = k; it.go(); } };
      menuEl.appendChild(row);
    });
  }
  const firstOk = (items) => Math.max(0, items.findIndex((x) => x.ok));
  function openMenu() {
    mode = 'menu'; aiming = null;
    highlight('reach', null); highlight('aim', null); highlight('area', null);
    const L = legalNow();
    const items = [
      { label: 'Move', ok: L.some((a) => a.kind === 'move'), go: startMove },
      { label: 'Act', ok: L.some((a) => a.kind === 'act'), go: openAct },
      { label: 'Wait', ok: true, go: startFace },
    ];
    menu = { items, i: firstOk(items), back: null };
    drawMenu(); drawSide(); readout();
  }
  function openAct() {
    const L = legalNow().filter((a) => a.kind === 'act'), id = S.turn.who, U = S.u[id], items = [];
    for (const k of ['attack'].concat(U.skills)) {
      const sk = K.skillOf(cfg, k);
      if (!sk) continue;
      const acts = L.filter((a) => a.skill === k);
      items.push({ label: sk.name + (sk.mp ? `  ${sk.mp} MP` : ''), ok: acts.length > 0, go: () => startAim({ skill: k }, acts) });
    }
    for (const k of K.items(cfg, S, id)) {
      const acts = L.filter((a) => a.item === k);
      items.push({ label: `${K.itemOf(cfg, k).name}  ×${S.bag[U.side][k]}`, ok: acts.length > 0, go: () => startAim({ item: k }, acts) });
    }
    menu = { items, i: firstOk(items), back: openMenu };
    drawMenu(); readout();
  }
  function menuStep(d) {
    const n = menu.items.length;
    for (let k = 1; k <= n; k++) { const j = (menu.i + d * k + n * 4) % n; if (menu.items[j].ok) { menu.i = j; break; } }
    drawMenu();
  }
  function startMove() {
    mode = 'move'; menuEl.style.display = 'none';
    highlight('reach', legalNow().filter((a) => a.kind === 'move').map((a) => a.to));
    readout();
  }
  function startAim(what, acts) {
    mode = 'aim'; menuEl.style.display = 'none';
    aiming = { what, spots: new Set(acts.map((a) => a.at)) };
    // the whole reach of it, red; the spots worth aiming at are the ones with someone on them
    highlight('aim', K.aim(B, cfg, S, S.turn.who, what.item ? K.itemOf(cfg, what.item) : K.skillOf(cfg, what.skill)));
    const U = S.u[S.turn.who];
    let best = acts[0].at, d = Infinity;
    for (const a of acts) { const e = Math.abs((a.at % B.cols) - (U.at % B.cols)) + Math.abs(Math.floor(a.at / B.cols) - Math.floor(U.at / B.cols)); if (a.at !== U.at && e < d) { d = e; best = a.at; } }
    moveCursor(acts.length === 1 ? acts[0].at : best);
  }
  function startFace() {
    mode = 'face'; menuEl.style.display = 'none';
    face = S.u[S.turn.who].face;
    highlight('reach', null);
    readout();
  }
  function back() {
    if (mode === 'deploy') { if (placing.k > 0) { placing.k--; moveCursor(S.u[placing.ids[placing.k]].at); drawSide(); } return; }
    if (mode === 'aim') { aiming = null; highlight('aim', null); highlight('area', null); openAct(); return; }
    if (mode === 'move' || mode === 'face') { if (mode === 'face') tokens[S.turn.who].g.rotation.z = FACE[S.u[S.turn.who].face]; openMenu(); return; }
    if (mode === 'menu' && menu.back) menu.back();
  }
  // before the first turn: the player puts each member it may place on a deploy spot, in turn (swapping with one there)
  function deploySpot() {
    const id = placing.ids[placing.k], there = occupant(cursor);
    if (!battle.deploy.includes(cursor) || (there && S.u[there].side !== 'party')) return;
    if (there && there !== id) S.u[there].at = S.u[id].at;
    S.u[id].at = cursor;
    settleTokens();
    placing.k++;
    if (placing.k >= placing.ids.length) { placing = null; mode = 'cpu'; highlight('reach', null); next(); return; }
    moveCursor(S.u[placing.ids[placing.k]].at);
    drawSide();
  }
  function confirm() {
    if (mode === 'deploy') { deploySpot(); return; }
    if (mode === 'menu') { const it = menu.items[menu.i]; if (it && it.ok) it.go(); return; }
    if (mode === 'move' && lit.reach && lit.reach.has(cursor)) play({ kind: 'move', to: cursor });
    else if (mode === 'aim' && aiming && aiming.spots.has(cursor)) play(Object.assign({ kind: 'act', at: cursor }, aiming.what));
    else if (mode === 'face') play({ kind: 'end', face: K.FACES[face] });
  }
  const HOP = 0.16;
  function beat(b) {
    if (b.kind === 'move') { tokens[b.who].hops.push(...b.path.slice(1)); busy = Math.max(busy, (b.path.length - 1) * HOP + 0.15); return; }
    if (b.kind === 'hurt') float(b.target, (b.poison ? 'poison ' : '') + b.amount + (b.crit ? '!' : ''), '#ff6b5a');
    else if (b.kind === 'heal') float(b.target, '+' + b.amount, '#6bff8a');
    else if (b.kind === 'miss') float(b.target, b.why === 'immune' ? 'immune' : b.why === 'resisted' ? 'resisted' : 'miss', '#d0d4da');
    else if (b.kind === 'ko') float(b.target, 'down', '#ffffff');
    else if (b.kind === 'revive') float(b.target, 'up', '#6bff8a');
    else if (b.kind === 'status') float(b.target, b.on ? ST[b.status] || b.status : b.status === 'cured' ? 'cured' : 'awake', '#c9a6ff');
    else if (b.kind === 'buff') float(b.target, b.stat + (b.pct > 0 ? ' up' : ' down'), '#ffd23d');
    else if (b.kind === 'mp') float(b.target, 'MP ' + b.mp, '#7fc4ff');
    else if (b.kind === 'count') float(b.target, String(b.left), '#ffb36b');
    else if (b.kind === 'lost') float(b.target, 'lost', '#ffb36b');
    else return;
    busy = Math.max(busy, 0.7);
  }
  function play(a) {
    const who = S.turn.who, out = K.apply(B, cfg, S, a);
    S = out.S;
    for (const b of out.beats) beat(b);
    highlight('reach', null); highlight('aim', null); highlight('area', null);
    aiming = null;
    settleTokens();
    drawSide();
    if (S.over) { finish(); return; }
    if (S.turn.who !== who) { busy = Math.max(busy, 0.35); next(); return; }
    if (HUMAN.has(S.u[who].side)) openMenu();
  }
  function next() {
    const U = S.u[S.turn.who];
    moveCursor(U.at);
    drawSide();
    if (HUMAN.has(U.side)) { openMenu(); return; }
    mode = 'cpu'; menuEl.style.display = 'none';
    cpu = { plan: MIND.plan(K, B, cfg, S), wait: 0.45, shown: false };
    readout();
  }
  function cpuStep(dt) {
    cpu.wait -= dt;
    if (cpu.wait > 0) return;
    let a = cpu.plan[0];
    if (!a || !legalNow().some((x) => sameAct(x, a))) { cpu.plan = MIND.plan(K, B, cfg, S); a = cpu.plan[0]; cpu.shown = false; }
    if (!cpu.shown && a.kind !== 'end') {
      // show what it is about to do: where it may go, or what it strikes
      if (a.kind === 'move') { highlight('reach', K.reach(B, S, S.turn.who)); moveCursor(a.to); }
      else { const sk = a.item ? K.itemOf(cfg, a.item) : K.skillOf(cfg, a.skill); highlight('area', sk.target === 'foe' || sk.target === 'ally' || sk.target === 'self' ? [a.at] : K.area(B, a.at, sk)); moveCursor(a.at); }
      cpu.shown = true; cpu.wait = 0.55;
      return;
    }
    cpu.plan.shift(); cpu.shown = false; cpu.wait = 0.3;
    play(a);
  }
  function finish() {
    mode = 'over'; menuEl.style.display = 'none'; orderEl.style.display = 'none'; cardEl.style.display = 'none';
    const W = S.over.winner, won = HUMAN.has(W);
    result = { winner: W, reason: S.over.reason, turns: S.n };
    bannerEl.style.display = 'block';
    const sp = S.spoils, got = sp ? [sp.xp ? `${sp.xp} xp` : '', sp.cp ? `${sp.cp} class points` : '', sp.gold ? `${sp.gold} gold` : '', ...sp.drops].filter(Boolean).join(' · ') : '';
    bannerEl.textContent = (HUMAN.size ? (W == null ? 'Draw' : won ? 'Victory' : 'Defeat') : (W == null ? 'Draw' : `${W} wins`)) + (got ? `\n${got}` : '');
    bannerEl.style.textAlign = 'center';
    // the level hears it on its bus, as it hears the party battles' end
    keep(won);   // the store hears the spoils before the level hears it is over
    const ev = HUMAN.size ? (W == null ? 'board-draw' : won ? 'board-won' : 'board-lost') : 'board-over';
    if (typeof __inputQueue !== 'undefined') __inputQueue.push({ type: ev });   // eslint-disable-line no-undef
    readout();
  }

  // ── the epoch's map: its dots, its roads, the party's marker; a dot chosen, the marker walks there and the map is left
  //    by that dot's exit (map-go:<dot> on the bus: the level contract's map mechanic ends the level through it) ──────
  const MAP = D.map || null;
  let mapAt = null, mapCur = 0, mapDone = {}, mapGone = null, walker = null;
  const dotMesh = {}, dotLabel = {};
  const dotIdx = (id) => MAP.dots.findIndex((d) => d.id === id);
  const doneDot = (d) => !!(d && d.ref && mapDone[d.ref] === 'success');
  const openDot = (d) => !d.gate || doneDot(MAP.dots[dotIdx(d.gate)]);
  const STATE_COLOUR = { done: 0xf2c14e, open: 0xffffff, locked: 0x5a606b };
  const stateOf = (d) => (doneDot(d) ? 'done' : openDot(d) ? 'open' : 'locked');
  function drawDots() {
    for (const d of MAP.dots) {
      const g = dotMesh[d.id], st = stateOf(d);
      g.children.forEach((m) => m.material.color.set(STATE_COLOUR[st]));
      dotLabel[d.id].style.opacity = st === 'locked' ? '0.55' : '1';
      dotLabel[d.id].textContent = d.name + (st === 'done' ? ' ✓' : st === 'locked' ? ' (locked)' : '');
    }
    // the roads the party may walk: between two dots it may stand at
    const road = new Set();
    for (const r of MAP.roads) if (openDot(MAP.dots[dotIdx(r.from)]) && openDot(MAP.dots[dotIdx(r.to)])) for (const i of r.path) road.add(i);
    highlight('road', [...road]);
  }
  // the dots by road from one to another, over open dots only (breadth first, the roads' own order) → the spots walked
  function route(from, to) {
    const prev = { [from]: null }, q = [from];
    for (let k = 0; k < q.length; k++) {
      const a = q[k];
      if (a === to) break;
      for (const r of MAP.roads) {
        const b = r.from === a ? r.to : r.to === a ? r.from : null;
        if (b == null || b in prev || !openDot(MAP.dots[dotIdx(b)])) continue;
        prev[b] = { a, r };
        q.push(b);
      }
    }
    if (!(to in prev)) return null;
    const spots = [];
    for (let x = to; prev[x]; x = prev[x].a) { const { a, r } = prev[x], p = r.from === a ? r.path.slice() : r.path.slice().reverse(); spots.unshift(...p.slice(1)); }
    return spots;
  }
  function mapReadout() {
    const d = MAP.dots[mapCur], st = stateOf(d), g = d.gate && MAP.dots[dotIdx(d.gate)];
    hud.textContent = `${d.name}  (${d.kind})\n${st === 'done' ? 'cleared' + (d.kind === 'skirmish' ? ' (fight it again)' : '') : st === 'open' ? 'open' : `locked: clear ${g ? g.name : 'the way'} first`}${mapAt === d.id ? '\nthe party is here' : ''}\n${LEGEND[mode]}`;
  }
  // a key: the next dot that way on screen (the nearest along it, the least off to the side)
  function mapPick(dir) {
    const v = CAM.screenStep(C, dir), here = MAP.dots[mapCur].at;
    let best = -1, score = Infinity;
    MAP.dots.forEach((d, k) => {
      if (k === mapCur) return;
      const dc = (d.at % B.cols) - (here % B.cols), dr = Math.floor(d.at / B.cols) - Math.floor(here / B.cols), along = dc * v[0] + dr * v[1];
      if (along <= 0) return;
      const sc = along + Math.abs(dc * v[1] - dr * v[0]) * 2;
      if (sc < score) { score = sc; best = k; }
    });
    if (best >= 0) { mapCur = best; moveCursor(MAP.dots[best].at); mapReadout(); }
  }
  function mapGo() {
    const d = MAP.dots[mapCur];
    if (stateOf(d) === 'locked' || mapGone) return;
    if (mapAt === d.id) { mapLeave(d); return; }
    const spots = route(mapAt, d.id);
    if (!spots) return;
    mode = 'travel';
    walker.hops.push(...spots);
    walker.dest = d;
    mapReadout();
  }
  function mapLeave(d) {
    mapGone = d.id;
    bannerEl.style.display = 'block';
    bannerEl.textContent = d.name;
    if (typeof __inputQueue !== 'undefined') __inputQueue.push({ type: 'map-go:' + d.id });   // eslint-disable-line no-undef
    result = { dot: d.id, ref: d.ref || null };
  }
  if (MAP) {
    mode = 'map';
    for (const d of MAP.dots) {
      const g = new THREE.Group(), p = tops[d.at];
      const post = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.12, cell * 0.16, 1.4, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      post.rotation.x = Math.PI / 2; post.position.z = 0.7;
      const flag = new THREE.Mesh(new THREE.ConeGeometry(cell * 0.3, cell * 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      flag.rotation.x = -Math.PI / 2; flag.position.z = 1.75;
      g.add(post, flag);
      g.position.set(p[0], p[1], p[2]);
      root.add(g);
      dotMesh[d.id] = g;
      const lab = document.createElement('div');
      lab.style.cssText = 'position:absolute;z-index:7;font:bold 12px ui-monospace,Menlo,monospace;color:#f4f1e8;text-shadow:0 1px 3px #000;pointer-events:none;transform:translate(-50%,-100%);white-space:nowrap';
      wrap.appendChild(lab);
      dotLabel[d.id] = lab;
    }
    // the party's marker: a token in the party's colour, beside the dot it stands at
    const mg = new THREE.Group(), mc = new THREE.Color('#4aa3ff');
    const mb = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.2, cell * 0.24, 1.0, 14), new THREE.MeshBasicMaterial({ color: mc }));
    mb.rotation.x = Math.PI / 2; mb.position.z = 0.5;
    const mh = new THREE.Mesh(new THREE.SphereGeometry(cell * 0.15, 14, 10), new THREE.MeshBasicMaterial({ color: mc.clone().offsetHSL(0, 0, 0.15) }));
    mh.position.z = 1.2;
    mg.add(mb, mh);
    root.add(mg);
    walker = { g: mg, hops: [], t: 0, from: null, dest: null };
    const place = (id) => { mapAt = id; const d = MAP.dots[dotIdx(id)]; walker.from = tops[d.at]; mg.position.set(walker.from[0], walker.from[1], walker.from[2]); mapCur = dotIdx(id); moveCursor(d.at); };
    const beginMap = (params) => {
      const prog = params && params[MAP.slice];
      mapDone = (prog && prog.completed) || {};
      // where the party stands: the dot whose level it came back from, else where the map starts
      const from = params && typeof params.arrive === 'string' ? MAP.dots.find((d) => d.ref === params.arrive) : null;
      place(from ? from.id : MAP.start);
      drawDots();
      mapReadout();
    };
    const GM = typeof window !== 'undefined' ? window.__mojGame : null;
    if (GM && GM.onStart) GM.onStart(beginMap); else beginMap({});
  }

  // ── input ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const held = {};
  const DIRS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const FACE_OF = { '0,1': 0, '1,0': 1, '0,-1': 2, '-1,0': 3 };
  window.addEventListener('keydown', (e) => {
    if (e.code in DIRS) {
      e.preventDefault();
      if (rts) held[DIRS[e.code]] = true;
      else if (mode === 'map') mapPick(DIRS[e.code]);
      else if (mode === 'menu') { if (DIRS[e.code] === 'up') menuStep(-1); else if (DIRS[e.code] === 'down') menuStep(1); }
      else if (mode === 'face') { face = FACE_OF[CAM.screenStep(C, DIRS[e.code]).join(',')]; tokens[S.turn.who].g.rotation.z = FACE[face]; }
      else if (mode !== 'over') stepCursor(DIRS[e.code]);
      return;
    }
    if (e.code === 'KeyQ') CAM.rotate(C, 1);
    else if (e.code === 'KeyE') CAM.rotate(C, -1);
    else if (e.code === 'KeyZ' || e.code === 'Equal') CAM.zoom(C, 1);
    else if (e.code === 'KeyX' || e.code === 'Minus') CAM.zoom(C, -1);
    else if (e.code === 'KeyV') CAM.tilt(C);
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); if (mode === 'free') select(); else if (mode === 'map') mapGo(); else confirm(); }
    else if (e.code === 'Escape' || e.code === 'Backspace') { if (mode === 'free') { sel = null; highlight('reach', null); readout(); } else back(); }
  });
  window.addEventListener('keyup', (e) => { if (e.code in DIRS) held[DIRS[e.code]] = false; });
  const el = renderer.domElement;
  el.addEventListener('wheel', (e) => { e.preventDefault(); CAM.zoom(C, e.deltaY < 0 ? 1 : -1); }, { passive: false });
  // the pointer: a ray onto the spots' tops (one quad a spot, never drawn)
  const pickTo = [], pickPos = [];
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i];
    if (!P) continue;
    for (const [a, b, c, d] of QUADS) { for (const k of [a, b, c, a, c, d]) pickPos.push(...P[k]); pickTo.push(i, i); }
  }
  const pickGeo = new THREE.BufferGeometry();
  pickGeo.setAttribute('position', new THREE.Float32BufferAttribute(pickPos, 3));
  const pick = new THREE.Mesh(pickGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide }));
  root.add(pick);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let mouse = null;
  const spotAt = (e) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(pick)[0];
    return hit ? pickTo[hit.faceIndex] : -1;
  };
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    mouse = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    if (mode === 'menu' || mode === 'cpu' || mode === 'over' || mode === 'map' || mode === 'travel') return;
    const i = spotAt(e);
    if (i >= 0 && i !== cursor) { cursor = i; onCursor(); }
  });
  el.addEventListener('pointerleave', () => { mouse = null; });
  el.addEventListener('click', (e) => {
    const i = spotAt(e);
    if (i < 0) return;
    cursor = i; onCursor();
    if (mode === 'free') select();
    else if (mode === 'map') { const k = MAP.dots.findIndex((d) => d.at === i); if (k >= 0) { mapCur = k; mapReadout(); mapGo(); } }
    else if (mode === 'move' || mode === 'aim' || mode === 'deploy') confirm();
  });

  readout();
  moveCursor(cursor);
  function begin() {
    if (battle.deploy && battle.placed && battle.placed.length && HUMAN.has('party')) {
      mode = 'deploy';
      placing = { ids: battle.placed.slice(), k: 0 };
      highlight('reach', battle.deploy);
      moveCursor(S.u[placing.ids[0]].at);
      drawSide();
    } else next();
  }
  // a game's party (the level contract's party: the store's slice): the battle waits for the level to start, stands the
  // party as the store has it, and takes the bag as it is
  const G = typeof window !== 'undefined' ? window.__mojGame : null;
  const carry = battle && RK && CARRY && G && G.contract && G.contract.party && typeof G.contract.party.slice === 'string'
    ? { slice: G.contract.party.slice, saved: null, bag0: null } : null;
  let drawn = 0;
  if (carry) {
    mode = 'wait';
    G.onStart(function (params) {
      const sl = params && params[carry.slice], roster = sl && sl.roster;
      // a drawn battle meets the pack the party's numbers draw
      if (own) drawn = CARRY.draw(battle.rpg, roster, battle.draw.length, cfg.seed);
      const list = own ? packUnits(drawn) : battle.units;
      if (roster || own) { S = K.start(B, cfg, roster ? CARRY.units(RK, battle.rpg, list, roster, battle.legs) : list); settleTokens(); }
      carry.saved = roster ? Object.fromEntries(Object.keys(roster).map((k) => [k, Object.assign({}, roster[k].stats)])) : RK.save(battle.rpg, RK.init(battle.rpg));
      const bagSlice = G.contract.bag && params[G.contract.bag.slice];
      if (bagSlice && bagSlice.items && S.bag) S.bag.party = Object.assign({}, bagSlice.items);
      carry.bag0 = S.bag ? Object.assign({}, S.bag.party) : {};
      begin();
    });
  } else if (battle) begin();
  // a win's spoils into the store (each member's number that moved) and the bag (gold, drops, and what the battle used)
  function keep(won) {
    if (!carry || !carry.saved) return;
    if (won && S.spoils) {
      const ids = S.order.filter((id) => S.u[id].side === 'party' && S.u[id].hp > 0);
      const after = CARRY.gain(RK, battle.rpg, carry.saved, ids, S.spoils.xp, S.spoils.cp);
      for (const c of CARRY.changes(carry.saved, after)) G.emit({ type: 'setStat', slice: carry.slice, id: c.id, stat: c.stat, value: c.value });
      carry.saved = after;
    }
    if (typeof __inputQueue === 'undefined') return;   // eslint-disable-line no-undef
    const now = (S.bag && S.bag.party) || {};
    for (const k of Object.keys(Object.assign({}, carry.bag0, now))) { const d = (now[k] || 0) - (carry.bag0[k] || 0); if (d) __inputQueue.push({ type: (d > 0 ? 'in' : 'out') + ':bag:' + k + ':' + Math.abs(d) }); }   // eslint-disable-line no-undef
    if (won && S.spoils) {
      if (S.spoils.gold) __inputQueue.push({ type: 'in:bag:gold:' + S.spoils.gold });   // eslint-disable-line no-undef
      for (const d of S.spoils.drops) __inputQueue.push({ type: 'in:bag:' + d + ':1' });   // eslint-disable-line no-undef
    }
  }
  window.__mojBoard = {
    board: B, camera: C, get cursor() { return cursor; }, get selected() { return sel; }, get mode() { return mode; }, get result() { return result; },
    state: () => S, highlight, moveCursor, stepCursor, select, get drawn() { return own ? drawn : null; },
    // the battle stepped by hand, `dt` seconds a call, apart from the frame (probes and tests: no waiting on the clock)
    run,
    get menu() { return menu && menu.items.map((x) => ({ label: x.label, ok: x.ok })); }, get hud() { return hud.textContent; },
    // the map's: where the party stands, the dot chosen, each dot's state; go there, as Enter would
    get map() { return MAP && { at: mapAt, cursor: MAP.dots[mapCur].id, gone: mapGone, dots: MAP.dots.map((d) => ({ id: d.id, state: stateOf(d) })) }; },
    goTo(id) { if (!MAP || mode !== 'map') return false; const k = dotIdx(id); if (k < 0) return false; mapCur = k; mapGo(); return true; },
    // the player's action, as the menu would make it (probes and tests): only a legal one, only on the player's turn
    act(a) { if (!battle || !S.turn || !HUMAN.has(S.u[S.turn.who].side) || !legalNow().some((x) => sameAct(x, a))) return false; play(a); return true; },
    // the player's turn played by the mind, as a probe's "auto" (the same mind the other side plays by)
    auto() {
      if (!battle || !S.turn || !HUMAN.has(S.u[S.turn.who].side)) return false;
      const who = S.turn.who;
      for (let k = 0; k < 6 && S.turn && S.turn.who === who && !S.over; k++) { const a = MIND.plan(K, B, cfg, S)[0]; if (!a) break; play(a); }
      return true;
    },
  };

  // the battle's own time: animations wait it out, then the other side takes its next step
  function run(dt) {
    if (busy > 0) busy = Math.max(0, busy - dt);
    else if (mode === 'cpu' && cpu && S.turn) cpuStep(dt);
  }

  // ── the frame ─────────────────────────────────────────────────────────────────────────────────────────────────
  let last = null;
  return function step(t) {
    const dt = last == null ? 0 : Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    if (rts) {
      const ex = mouse ? (mouse[0] < 0.03 ? -1 : mouse[0] > 0.97 ? 1 : 0) : 0, ey = mouse ? (mouse[1] < 0.03 ? 1 : mouse[1] > 0.97 ? -1 : 0) : 0;
      const right = (held.right ? 1 : 0) - (held.left ? 1 : 0) + (C.o.edge ? ex : 0), up = (held.up ? 1 : 0) - (held.down ? 1 : 0) + (C.o.edge ? ey : 0);
      if (right || up) CAM.pan(C, right, up, dt);
    }
    CAM.step(C, dt);
    const P = CAM.pose(C);
    camera.position.set(P.pos[0], P.pos[1], P.pos[2]);
    camera.up.set(0, 0, 1);
    camera.lookAt(P.target[0], P.target[1], P.target[2]);
    if (camera.fov !== P.fov) { camera.fov = P.fov; camera.updateProjectionMatrix(); }
    const cp = tops[cursor], top = pts[cursor] ? Math.max(...pts[cursor].map((p) => p[2])) : 0;
    if (cp) cursorMesh.position.set(cp[0], cp[1], top + LIFT * 2 + (Math.sin(t / 260) + 1) * 0.03);
    cursorMesh.children[1].position.z = 2.2 + Math.sin(t / 260) * 0.12;
    if (S) for (const id in tokens) {
      const T = tokens[id], U = S.u[id];
      if (!U) { T.g.visible = false; const F = figureOf(id); if (F) F.e.gone = true; continue; }   // a pack not drawn
      if (T.hops.length) {
        T.t += dt / HOP;
        const to = centre(T.hops[0]), f = Math.min(1, T.t), lift = Math.max(0, to[2] - T.from[2]) + 0.35;
        T.g.position.set(T.from[0] + (to[0] - T.from[0]) * f, T.from[1] + (to[1] - T.from[1]) * f, T.from[2] + (to[2] - T.from[2]) * f + Math.sin(f * Math.PI) * lift);
        T.g.rotation.z = Math.atan2(to[1] - T.from[1], to[0] - T.from[0]);
        if (f >= 1) { T.from = to; T.hops.shift(); T.t = 0; if (!T.hops.length) T.g.rotation.z = FACE[U.face]; }
      }
      T.g.visible = U.hp > 0;
      const F = figureOf(id);
      if (F) {
        const p = T.g.position;
        F.e.transform.pos = [p.x, p.y, p.z];
        F.e.transform.heading = T.g.rotation.z;
        F.e.moving = T.hops.length > 0;
        F.e.locomotion = 'forward';
        F.e.gone = U.hp <= 0;   // the runtime hides a body that is gone; a raised one stands again
      }
    }
    if (battle) { drawFloats(dt); run(dt); }
    if (MAP && walker && walker.from) {
      if (walker.hops.length) {
        walker.t += dt / HOP;
        const to = tops[walker.hops[0]], f = Math.min(1, walker.t), lift = Math.max(0, to[2] - walker.from[2]) + 0.3;
        walker.g.position.set(walker.from[0] + (to[0] - walker.from[0]) * f, walker.from[1] + (to[1] - walker.from[1]) * f, walker.from[2] + (to[2] - walker.from[2]) * f + Math.sin(f * Math.PI) * lift);
        if (f >= 1) {
          walker.from = to; walker.hops.shift(); walker.t = 0;
          if (!walker.hops.length && walker.dest) { const d = walker.dest; walker.dest = null; mapAt = d.id; mode = 'map'; mapReadout(); mapLeave(d); }
        }
      }
      const r = renderer.domElement.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      for (const d of MAP.dots) {
        const p = tops[d.at];
        V.set(p[0], p[1], p[2] + 2.3).project(camera);
        const lab = dotLabel[d.id];
        lab.style.left = (r.left - w.left + ((V.x + 1) / 2) * r.width) + 'px';
        lab.style.top = (r.top - w.top + ((1 - V.y) / 2) * r.height) + 'px';
      }
    }
  };
}
