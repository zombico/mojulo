/**
 * THE BOARD ON THE WORLD PAGE — the board drawn over its ground and played with the tactical camera: a faint grid of
 * its spots, highlights (reach, aim, area), a cursor the keys move the way the screen shows, the units as tokens, a
 * readout of the spot under the cursor. The page runs the board kernel and the camera from their own source
 * (board-kernel.js, board-camera.js), so what the page shows is what Node tests.
 *
 * `boardPage` is emitted by its source inside the board channel's block (scene/channels/board.js) and never runs in
 * Node. From the page it uses only what a channel may: `THREE`, `scene`, `camera`, `controls`, `renderer`, `wrap` and
 * `__ctrlOwnsCamera` (it owns the camera from the start). It returns the frame step the page calls.
 *
 *   boardChannelData(laid, { units?, camera?, cursor?, drape?, clip? }) → D   what the page takes: the kernel's board,
 *     where it lies, the units (the kernel's start shape), the camera's options, the cursor's first spot, over land the
 *     ground's drape (board-lay.js), which the grid, the highlights, the pointer and the units lie on, and in rooms
 *     their floors' boxes ([[x0, y0, x1, y1]]), which hold what is drawn on a spot off the walls
 *
 * Keys (the `board` input scheme, controls/schemes.js): arrows or W A S D move the cursor (the RTS form pans instead);
 * Q / E turn the view a quarter; Z / X (or the wheel) zoom; V tilts; Enter or Space (or a click) selects a unit and
 * shows its reach, then moves it there; Esc lets it go. The pointer moves the cursor to the spot under it.
 */
import { boardParse } from './board-kernel.js';

const SIDE_COLOURS = ['#4aa3ff', '#ff5a4a', '#5ad17a', '#f2c14e'];

/** What the page takes, from a laid board (board-lay.js layBoard). */
export function boardChannelData(laid, { units = [], camera = {}, cursor, drape, clip } = {}) {
  const B = laid.board, at = cursor !== undefined ? boardParse(B, cursor) : -1;
  const first = at >= 0 && B.spots[at] ? at : B.spots.findIndex((s) => s && s.walk);
  const sides = [...new Set(units.map((u) => u.side))];
  return { B, origin: laid.frame.origin, units, camera, cursor: first, colours: Object.fromEntries(sides.map((s, k) => [s, SIDE_COLOURS[k % SIDE_COLOURS.length]])), ...(drape ? { drape } : {}), ...(clip ? { clip } : {}) };
}

/* global THREE, scene, camera, controls, renderer, wrap, __ctrlOwnsCamera */
export function boardPage(D, K, CAM) {
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
  const LAYERS = { reach: 0x3d8bff, aim: 0xff4a3d, area: 0xffd23d };
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
      const layer = lit.area && lit.area.has(i) ? 'area' : lit.aim && lit.aim.has(i) ? 'aim' : lit.reach && lit.reach.has(i) ? 'reach' : null;
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
  let S = D.units && D.units.length ? K.start(B, D.cfg || {}, D.units) : null;
  const tokens = {};
  const FACE = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];   // n e s w as a heading from +x
  if (S) for (const id of S.order) {
    const U = S.u[id], g = new THREE.Group(), colour = new THREE.Color(D.colours[U.side] || '#cccccc');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.24, cell * 0.28, 1.3, 14), new THREE.MeshBasicMaterial({ color: colour }));
    body.rotation.x = Math.PI / 2;
    body.position.z = 0.65;
    const head = new THREE.Mesh(new THREE.SphereGeometry(cell * 0.17, 14, 10), new THREE.MeshBasicMaterial({ color: colour.clone().offsetHSL(0, 0, 0.15) }));
    head.position.z = 1.55;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(cell * 0.1, cell * 0.28, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(cell * 0.3, 0, 0.9);
    g.add(body, head, nose);
    root.add(g);
    tokens[id] = { g, hops: [], t: 0, from: centre(U.at) };
    g.position.set(...centre(U.at));
    g.rotation.z = FACE[U.face];
  }

  // ── the readout ───────────────────────────────────────────────────────────────────────────────────────────────
  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:12px;bottom:12px;z-index:7;font:12px/1.45 ui-monospace,Menlo,monospace;color:#e8ecf2;background:rgba(10,12,16,0.62);padding:8px 10px;border-radius:6px;pointer-events:none;white-space:pre';
  wrap.appendChild(hud);
  const legend = rts ? 'arrows / WASD / edge: pan · Z X: zoom · V: tilt' : 'arrows / WASD: cursor · Q E: turn · Z X: zoom · V: tilt · Enter: select / move · Esc: back';

  // ── the cursor and the selection ──────────────────────────────────────────────────────────────────────────────
  let cursor = D.cursor >= 0 ? D.cursor : 0, sel = null;
  const occupant = (i) => (S ? K.occupant(S, i) : null);
  function readout() {
    const s = B.spots[cursor], who = occupant(cursor), U = who && S.u[who];
    const spot = s ? `${K.nameOf(B, cursor)}  h ${s.h} (${(s.h * B.step).toFixed(1)} m)  ${s.type}${s.walk ? '' : ', shut'}` : K.nameOf(B, cursor);
    hud.textContent = `${spot}${U ? `\n${U.name} (${U.side})  hp ${U.hp}/${U.hpMax}  move ${U.move}  jump ${U.jump}` : ''}${sel ? `\nselected: ${S.u[sel].name}` : ''}\n${legend}`;
  }
  function moveCursor(i) {
    if (i < 0 || !B.spots[i]) return;
    cursor = i;
    if (!rts) CAM.focusOn(C, tops[i]);
    readout();
  }
  function stepCursor(dir) {
    const d = CAM.screenStep(C, dir), c0 = cursor % B.cols, r0 = (cursor - c0) / B.cols;
    for (let k = 1; k < Math.max(B.cols, B.rows); k++) {
      const c = c0 + d[0] * k, r = r0 + d[1] * k;
      if (c < 0 || r < 0 || c >= B.cols || r >= B.rows) return;
      if (B.spots[r * B.cols + c]) { moveCursor(r * B.cols + c); return; }
    }
  }
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

  // ── input ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const held = {};
  const DIRS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', (e) => {
    if (e.code in DIRS) { e.preventDefault(); if (rts) held[DIRS[e.code]] = true; else stepCursor(DIRS[e.code]); return; }
    if (e.code === 'KeyQ') CAM.rotate(C, 1);
    else if (e.code === 'KeyE') CAM.rotate(C, -1);
    else if (e.code === 'KeyZ' || e.code === 'Equal') CAM.zoom(C, 1);
    else if (e.code === 'KeyX' || e.code === 'Minus') CAM.zoom(C, -1);
    else if (e.code === 'KeyV') CAM.tilt(C);
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); select(); }
    else if (e.code === 'Escape') { sel = null; highlight('reach', null); readout(); }
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
    const i = spotAt(e);
    if (i >= 0 && i !== cursor) { cursor = i; readout(); }
  });
  el.addEventListener('pointerleave', () => { mouse = null; });
  el.addEventListener('click', (e) => { const i = spotAt(e); if (i >= 0) { cursor = i; select(); } });

  readout();
  moveCursor(cursor);
  window.__mojBoard = { board: B, camera: C, get cursor() { return cursor; }, get selected() { return sel; }, state: () => S, highlight, moveCursor, stepCursor, select };

  // ── the frame ─────────────────────────────────────────────────────────────────────────────────────────────────
  let last = null;
  const HOP = 0.16;
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
      if (T.hops.length) {
        T.t += dt / HOP;
        const to = centre(T.hops[0]), f = Math.min(1, T.t), lift = Math.max(0, to[2] - T.from[2]) + 0.35;
        T.g.position.set(T.from[0] + (to[0] - T.from[0]) * f, T.from[1] + (to[1] - T.from[1]) * f, T.from[2] + (to[2] - T.from[2]) * f + Math.sin(f * Math.PI) * lift);
        T.g.rotation.z = Math.atan2(to[1] - T.from[1], to[0] - T.from[0]);
        if (f >= 1) { T.from = to; T.hops.shift(); T.t = 0; if (!T.hops.length) T.g.rotation.z = FACE[U.face]; }
      }
      T.g.visible = U.hp > 0;
    }
  };
}
