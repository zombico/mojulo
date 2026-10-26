/**
 * holo arena — a board game lifted into a hologram arena (inlined into the World page's holo block after the tabletop
 * kernel and the mind, each built from its closure: scene/channels/holo.js). From the page it uses only what a channel
 * may: `THREE`, `scene`, `camera`, `controls`, `wrap`, and `__ctrlOwnsCamera` (it owns the camera).
 *
 * The arena: a projector disc on the floor and the board floating over it as a grid of light (each cell a pane, its
 * edges lit, a scan sweeping across), the duelists' podiums behind their own sides, each lit in its colour, the side to
 * move brighter. Every piece is a HOLOGRAM of its body (tabletop-shapes.js: a cut-out, a turned profile, a box, a
 * group): a translucent body lit at its rim, its edges in light, a glow on the cell under it.
 *
 * The game is the kernel's: the page asks it for the legal moves, applies the one chosen and depicts what changed, in
 * BEATS played one after another while the state is already ahead:
 *   summon      the pieces rise out of a beam onto their cells, one after another, at the start; a dropped piece so
 *   attack      a capture: the attacker turns to its victim and a beam crosses to it
 *   destroy     the victim shatters into light and fades; its duelist's LIFE POINTS tick down by its share of the army
 *   move        the piece lifts and glides to its cell (a leap higher); a castling partner beside it
 *   promote     a pillar of light, the piece remade as its new kind
 *   convert     a flipped piece changes colour (a game that turns pieces over)
 *   check, end  the banners: CHECK on a royal piece attacked, the winner, a draw and its reason; mate takes the loser's
 *               life points to zero
 *
 * The pads: the mouse (click a piece of yours, then a lit cell; a promotion or a drop with a choice asks which), Enter
 * begins again. players 0 is an exhibition (the minds play both seats), 1 you against the computer, 2 hot-seat (the
 * camera swings behind whoever is to move). The mind thinks in a count of positions from the seed and the ply, so the
 * same game plays the same moves on any machine (the e2e suite holds the page to Node move for move).
 *
 * As a level: hosted in a game's frame it posts READY, plays the game INIT brings (players, level, seed over the
 * arena's own) and posts the OUTCOME at the end: success when player 1 won or drew (or nobody held a seat), fail
 * otherwise, the winner, the reason and the moves as stats. On its own it starts at once and plays again on Enter.
 */
/* global HOLO_ARENA, HOLO_T, HOLO_M, THREE, scene, camera, controls, wrap */

const HA = HOLO_ARENA, HT = HOLO_T, HM = HOLO_M, HL = HA.L, CELL = HA.board.cell, C0 = HA.board.centre;
const hosted = window.parent !== window;
const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
const LP_START = 4000;
const PIECE_SCALE = 1.6;   // a hologram stands taller than a token: its body in cells, times this, times the cell

// ── the overlay and the camera ───────────────────────────────────────────────────────────────────────────────

const ov = document.createElement('canvas');
ov.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:6';
wrap.appendChild(ov);
const g2 = ov.getContext('2d');
let OW = 0, OH = 0, ODPR = 1;
function fitOverlay() {
  ODPR = Math.min(2, window.devicePixelRatio || 1);
  OW = wrap.clientWidth || window.innerWidth; OH = wrap.clientHeight || window.innerHeight;
  ov.width = Math.round(OW * ODPR); ov.height = Math.round(OH * ODPR);
}
window.addEventListener('resize', fitOverlay);
fitOverlay();
controls.enabled = false;
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the arena

// ── the board on the stage ───────────────────────────────────────────────────────────────────────────────────

const cellAt = (i) => [C0[0] + HL.cells[i].at[0], C0[1] + HL.cells[i].at[1], C0[2] + (HL.cells[i].at[2] || 0)];
const wayAngle = (name) => { const w = HL.dirs.concat(HL.diags).find((x) => x.name === name); return w ? (w.angle * Math.PI) / 180 : Math.PI / 2; };
const colourOf = (s) => new THREE.Color(HA.duelists[s].colour);
const reach = HL.cells.reduce((m, c) => Math.max(m, Math.hypot(c.at[0], c.at[1])), 0) + CELL;
// how far the board reaches along a way from its centre
const extent = (ang) => HL.cells.reduce((m, c) => Math.max(m, c.at[0] * Math.cos(ang) + c.at[1] * Math.sin(ang)), 0) + CELL / 2;

const dressing = new THREE.Group();
scene.add(dressing);
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
// the projector: a dark disc on the floor, its rings lit, beams from its rim up to the board
const disc = new THREE.Mesh(new THREE.CircleGeometry(reach + 1.2, 64), new THREE.MeshBasicMaterial({ color: 0x07090f }));
disc.position.set(C0[0], C0[1], 0.015); dressing.add(disc);
const rings = [];
for (const [r, w] of [[reach + 1.1, 0.06], [reach + 0.6, 0.03], [reach * 0.55, 0.02]]) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - w, r, 96), additive(0x36d6ff, 0.55));
  ring.position.set(C0[0], C0[1], 0.02); dressing.add(ring); rings.push(ring);
}
for (let k = 0; k < 6; k++) {
  const a = (k / 6) * Math.PI * 2 + 0.3, x = C0[0] + Math.cos(a) * (reach + 0.9), y = C0[1] + Math.sin(a) * (reach + 0.9);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.12, C0[2], 8, 1, true).rotateX(Math.PI / 2), additive(0x36d6ff, 0.18));
  beam.position.set(x, y, C0[2] / 2); dressing.add(beam);
}
// the cells: a pane each, its edges lit; a square board's checker in two lights
const cellPanes = [], cellLines = [];
const pane = (i) => {
  const c = HL.cells[i], pts = c.k.map((k) => HL.corners[k].at);
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0] - c.at[0], p[1] - c.at[1])));
  return new THREE.ShapeGeometry(shape);
};
HL.cells.forEach((c, i) => {
  const dark = HL.shape === 'square' ? (c.v[0] + c.v[1]) % 2 === 0 : (((c.v[0] - c.v[1]) % 3) + 3) % 3 === 0;
  const P = new THREE.Mesh(pane(i), additive(dark ? 0x0d3a52 : 0x1d7fa6, dark ? 0.5 : 0.38));
  const [x, y, z] = cellAt(i);
  P.position.set(x, y, z); P.userData.cell = i; P.userData.base = P.material.opacity;
  dressing.add(P); cellPanes.push(P);
  const pts = c.k.map((k) => HL.corners[k].at).map((p) => new THREE.Vector3(p[0] - c.at[0], p[1] - c.at[1], 0.004));
  const E = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  E.position.set(x, y, z); dressing.add(E); cellLines.push(E);
});
// the scan: a bar of light sweeping across the board
const scan = new THREE.Mesh(new THREE.PlaneGeometry(reach * 2, 0.12), additive(0x9ff3ff, 0.35));
scan.position.set(C0[0], C0[1], C0[2] + 0.01); dressing.add(scan);
// the podiums: behind each duelist's own side, lit in its colour
const podiums = HA.duelists.map((p, s) => {
  const back = wayAngle(p.facing) + Math.PI, d = extent(back) + HA.board.podium;
  const x = C0[0] + Math.cos(back) * d, y = C0[1] + Math.sin(back) * d;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.1), new THREE.MeshBasicMaterial({ color: 0x1a1f2a }));
  body.position.z = 0.55; g.add(body);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.96, 0.06), additive(colourOf(s), 0.9));
  rim.position.z = 1.1; g.add(rim);
  const spot = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.3, 48), additive(colourOf(s), 0.6));
  spot.position.z = 0.02; g.add(spot);
  g.position.set(x, y, 0); g.rotation.z = back + Math.PI / 2;
  dressing.add(g);
  return { g, rim, spot, at: [x, y], back };
});

// ── the holograms ────────────────────────────────────────────────────────────────────────────────────────────

const HOLO_VERT = 'varying vec3 vN; varying vec3 vW;\nvoid main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';
const HOLO_FRAG = 'uniform vec3 uColor; uniform float uTime; uniform float uAlpha; uniform float uBase; uniform float uTop; uniform float uReveal;\nvarying vec3 vN; varying vec3 vW;\n'
  + 'void main() {\n  float cut = uBase + (uTop - uBase) * uReveal;\n  if (vW.z > cut) discard;\n'
  + '  vec3 V = normalize(cameraPosition - vW); float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);\n'
  + '  float scan = 0.7 + 0.3 * sin((vW.z - uBase) * 70.0 - uTime * 7.0);\n  float edge = smoothstep(0.06, 0.0, cut - vW.z) * step(uReveal, 0.999);\n'
  + '  float a = ((0.24 + 0.8 * fres) * scan + edge) * uAlpha;\n  gl_FragColor = vec4(uColor * (0.55 + 1.3 * fres + 2.0 * edge), a);\n}';
function holoMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uTime: { value: 0 }, uAlpha: { value: 1 }, uBase: { value: 0 }, uTop: { value: 1 }, uReveal: { value: 1 } },
    vertexShader: HOLO_VERT, fragmentShader: HOLO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
// a body's parts as geometries in its own frame (cell units: x right, y forward, z up)
function partsOf(shape, at) {
  const o = at || [0, 0, 0];
  if (shape.form === 'group') return shape.parts.flatMap((p) => partsOf(p.shape, [o[0] + ((p.at && p.at[0]) || 0), o[1] + ((p.at && p.at[1]) || 0), o[2] + ((p.at && p.at[2]) || 0)]));
  let geo;
  if (shape.form === 'extrude') {
    geo = new THREE.ExtrudeGeometry(new THREE.Shape(shape.profile.map(([x, z]) => new THREE.Vector2(x, z))), { depth: shape.depth, bevelEnabled: false });
    geo.translate(0, 0, -shape.depth / 2); geo.rotateX(Math.PI / 2);
  } else if (shape.form === 'lathe') {
    geo = new THREE.LatheGeometry(shape.profile.map(([r, z]) => new THREE.Vector2(r, z)), Math.max(12, (shape.sides || 12) * 2));
    geo.rotateX(Math.PI / 2);
  } else {
    const [w, d, h] = shape.size;
    geo = new THREE.BoxGeometry(w, d, h); geo.translate(0, 0, h / 2);
  }
  geo.translate(o[0], o[1], o[2]);
  return [geo];
}
const BODIES = {};
function bodyOf(kind) {
  if (BODIES[kind]) return BODIES[kind];
  const k = CELL * PIECE_SCALE;
  const geos = partsOf(HA.kinds[kind].shape).map((g) => { g.scale(k, k, k); g.computeVertexNormals(); return g; });
  const top = Math.max(...geos.map((g) => { g.computeBoundingBox(); return g.boundingBox.max.z; }));
  return (BODIES[kind] = { geos, edges: geos.map((g) => new THREE.EdgesGeometry(g, 28)), top });
}
const GLOW = new THREE.CircleGeometry(CELL * 0.42, 32);
function makeHolo(kind, side) {
  const B = bodyOf(kind), col = colourOf(side), group = new THREE.Group();
  const mat = holoMaterial(col), edgeMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < B.geos.length; i++) { group.add(new THREE.Mesh(B.geos[i], mat)); group.add(new THREE.LineSegments(B.edges[i], edgeMat)); }
  const glow = new THREE.Mesh(GLOW, additive(col, 0.45));
  scene.add(group, glow);
  return { kind, side, group, glow, mat, edgeMat, top: B.top, pos: [0, 0, 0], yaw: 0 };
}
function dropHolo(H) { if (H) scene.remove(H.group, H.glow); }
function placeHolo(H, x, y, z) {
  H.pos = [x, y, z];
  H.group.position.set(x, y, z); H.group.rotation.z = H.yaw;
  H.mat.uniforms.uBase.value = z; H.mat.uniforms.uTop.value = z + H.top;
  H.glow.position.set(x, y, C0[2] + 0.006);
}
function tintHolo(H, side) { H.side = side; const c = colourOf(side); H.mat.uniforms.uColor.value.copy(c); H.edgeMat.color.copy(c); H.glow.material.color.copy(c); }
const faceYaw = (side) => wayAngle(HA.duelists[side].facing) - Math.PI / 2;

// effects: beams, pillars, sparks (each with its life and its own update)
const effects = [];
function beamFx(a, b, color, life) {
  const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = v.length() || 0.01;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 10, 1, true), additive(color, 1));
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  scene.add(m);
  effects.push({ t: 0, life, step: (u) => { m.scale.set(1 + 2 * Math.sin(Math.PI * u), len * Math.min(1, u * 3), 1 + 2 * Math.sin(Math.PI * u)); m.material.opacity = 0.9 * (1 - u); }, end: () => scene.remove(m) });
}
function pillarFx(at, color, life) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.38, CELL * 0.46, 6, 24, 1, true).rotateX(Math.PI / 2), additive(color, 0.5));
  m.position.set(at[0], at[1], at[2] + 3); scene.add(m);
  effects.push({ t: 0, life, step: (u) => { m.material.opacity = 0.55 * Math.sin(Math.PI * u); m.scale.set(1 - 0.4 * u, 1 - 0.4 * u, 1); }, end: () => scene.remove(m) });
}
function shatterFx(H) {
  const pts = [], vel = [];
  H.group.updateMatrixWorld(true);
  H.group.children.forEach((ch) => {
    if (!ch.isMesh) return;
    const p = ch.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 160)), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(ch.matrixWorld); pts.push(v.x, v.y, v.z); }
  });
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i] - H.pos[0], dy = pts[i + 1] - H.pos[1], n = Math.hypot(dx, dy) || 1, a = ((i * 7919) % 360) * Math.PI / 180;
    vel.push((dx / n) * 1.8 + Math.cos(a) * 0.6, (dy / n) * 1.8 + Math.sin(a) * 0.6, 1.5 + ((i * 31) % 17) / 6);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const P = new THREE.Points(geo, new THREE.PointsMaterial({ color: H.mat.uniforms.uColor.value, size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(P);
  const base = pts.slice(), flash = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 40), additive(0xffffff, 0.9));
  flash.position.set(H.pos[0], H.pos[1], C0[2] + 0.02); scene.add(flash);
  effects.push({ t: 0, life: 0.9, step: (u) => {
    const a = geo.attributes.position;
    for (let i = 0; i < base.length; i += 3) { const k = u * 0.9; a.array[i] = base[i] + vel[i] * k; a.array[i + 1] = base[i + 1] + vel[i + 1] * k; a.array[i + 2] = base[i + 2] + vel[i + 2] * k - 2.5 * k * k; }
    a.needsUpdate = true; P.material.opacity = 1 - u;
    flash.scale.setScalar(1 + 12 * u); flash.material.opacity = 0.9 * (1 - u);
  }, end: () => scene.remove(P, flash) });
}
// the lit cells: where the selected piece may go (a capture red), the selection, the last move
const marks = [];
function markCells(list) {
  for (const m of marks) scene.remove(m);
  marks.length = 0;
  for (const [cell, color] of list) {
    const r = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.3, CELL * 0.4, 32), additive(color, 0.85)), [x, y, z] = cellAt(cell);
    r.position.set(x, y, z + 0.012); scene.add(r); marks.push(r);
  }
}

// ── the duel ─────────────────────────────────────────────────────────────────────────────────────────────────

const K = HT.compile(HL, HA.G);
let S = null, line = [], legal = [], sel = -1, phase = 'wait', waited = 0, human = K.sideOf[HA.human];
let level = HA.level, seed = HA.seed, nPlayers = HA.players, lastParams = null, banner = null, thinkAt = 0, ended = null;
const holos = {};               // piece index → its hologram
const queue = [];               // the beats still to play
let beat = null, now = 0;
const seen = [];                // the beats begun, in order (for probes)
const startValue = [0, 0], lp = [LP_START, LP_START], lpShown = [LP_START, LP_START];
const isHuman = (side) => nPlayers === 2 || (nPlayers === 1 && side === human);
const armyOf = (St, s) => St.pieces.reduce((a, P) => a + (P.at >= 0 && P.side === s && !HA.kinds[P.kind].royal ? HA.kinds[P.kind].value : 0), 0);
// each duelist's life points: its army's share of what it began with (a royal piece counts nothing; mate takes them to zero)
const lpOf = (St) => [0, 1].map((s) => (startValue[s] > 0 ? Math.round((LP_START * armyOf(St, s)) / startValue[s]) : LP_START));
function lpTarget(St) { const v = lpOf(St); lp[0] = v[0]; lp[1] = v[1]; }
const nameOf = (s) => (nPlayers === 0 ? `CPU ${s + 1}` : isHuman(s) ? (nPlayers === 2 ? `P${s + 1}` : 'YOU') : 'CPU');

function begin(params = {}) {
  lastParams = params;
  for (const k of Object.keys(holos)) { dropHolo(holos[k]); delete holos[k]; }
  queue.length = 0; beat = null; markCells([]);
  nPlayers = params.players ?? HA.players; level = params.level ?? HA.level; seed = params.seed ?? HA.seed;
  S = HT.start(K); line = []; sel = -1; ended = null;
  for (let s = 0; s < 2; s++) startValue[s] = armyOf(S, s);
  lpTarget(S); lpShown[0] = lp[0]; lpShown[1] = lp[1];
  // the summon: every piece rises onto its cell, each a little after the last, the whole army in about two seconds
  const army = S.pieces.map((P, i) => ({ p: i, piece: { kind: P.kind, side: P.side }, at: P.at })).filter((x) => x.at >= 0);
  const gap = army.length > 1 ? Math.min(0.2, 1.4 / (army.length - 1)) : 0;
  queue.push({ kind: 'summon', army: army.map((x, k) => ({ ...x, delay: k * gap })), rise: 0.6, dur: 0.6 + gap * Math.max(0, army.length - 1) });
  banner = { text: 'DUEL!', left: 1.6, color: '#fff' };
  legal = HT.legal(K, S);
  phase = 'play'; thinkAt = 0;
}

// what a move changed, as beats; the state is already past it
function beatsOf(m, before, after) {
  const out = [], side = before.side;
  if (m.cap.length) {
    out.push({ kind: 'attack', p: m.p, from: m.p >= 0 ? m.from : m.to, victims: m.cap.slice(), dur: 0.45 });
    out.push({ kind: 'destroy', victims: m.cap.slice(), lp: lpOf(after), dur: 0.75 });
  }
  if (m.drop) out.push({ kind: 'summon', army: [{ p: before.pieces.length, piece: { kind: m.drop, side }, at: m.to, delay: 0 }], rise: 0.5, dur: 0.5 });
  if (m.p >= 0) out.push({ kind: 'move', p: m.p, from: m.from, to: m.to, partner: m.partner || null, partnerFrom: m.partner ? before.pieces[m.partner.p].at : -1, dur: 0.55 });
  if (m.promote) out.push({ kind: 'promote', p: m.p, to: m.promote, at: m.to, lp: lpOf(after), dur: 0.8 });
  for (const c of m.flip || []) out.push({ kind: 'convert', p: before.board[c], side, dur: 0.3 });
  return out;
}
function play(m) {
  const before = S;
  S = HT.apply(K, S, m);
  line.push(m.name);
  for (const b of beatsOf(m, before, S)) queue.push(b);
  sel = S.chain >= 0 && isHuman(S.side) ? S.pieces[S.chain].at : -1;
  legal = HT.legal(K, S);
  const end = S.over || HT.outcome(K, S, legal);
  if (end) { ended = end; queue.push({ kind: 'end', end, dur: 0.1 }); }
  else if (K.royal && S.pieces.some((P) => P.at >= 0 && P.side === S.side && HA.kinds[P.kind].royal && HT.attacked(K, S, P.at, 1 - S.side))) queue.push({ kind: 'check', dur: 0.1 });
  thinkAt = 0;
}
function computer() {
  const r = HM.think(K, S, Object.assign({}, HM.LEVELS[level], { seed: seed + line.length }));
  if (r) play(r.move); else { ended = HT.outcome(K, S, legal) || { winner: null, reason: 'stuck' }; queue.push({ kind: 'end', end: ended, dur: 0.1 }); }
}

// a beat's start and its frames (u 0 → 1)
const lerp = (a, b, u) => a + (b - a) * u;
function startBeat(B) {
  if (B.kind === 'summon') {
    for (const A of B.army) {
      const H = holos[A.p] = makeHolo(A.piece.kind, A.piece.side), [x, y, z] = cellAt(A.at);
      H.yaw = faceYaw(A.piece.side); placeHolo(H, x, y, z); H.mat.uniforms.uReveal.value = 0; H.edgeMat.opacity = 0;
    }
  } else if (B.kind === 'attack') {
    const A = holos[B.p] || null, from = A ? A.pos : cellAt(B.from);
    for (const q of B.victims) {
      const V = holos[q]; if (!V) continue;
      if (A) A.yaw = Math.atan2(V.pos[1] - A.pos[1], V.pos[0] - A.pos[0]) - Math.PI / 2;
      beamFx([from[0], from[1], from[2] + (A ? A.top * 0.6 : 0.5)], [V.pos[0], V.pos[1], V.pos[2] + V.top * 0.5], A ? A.mat.uniforms.uColor.value : new THREE.Color(0xffffff), B.dur);
    }
    banner = { text: 'ATTACK!', left: 0.7, color: A ? '#' + A.mat.uniforms.uColor.value.getHexString() : '#fff' };
  } else if (B.kind === 'destroy') {
    for (const q of B.victims) if (holos[q]) shatterFx(holos[q]);
    lp[0] = B.lp[0]; lp[1] = B.lp[1];
  } else if (B.kind === 'move') {
    const H = holos[B.p]; if (!H) return;
    B.a = H.pos.slice(); B.b = cellAt(B.to);
    const d = Math.hypot(B.b[0] - B.a[0], B.b[1] - B.a[1]);
    B.hop = 0.25 + 0.18 * d; B.yaw0 = H.yaw;
    if (B.partner && holos[B.partner.p]) { B.pa = holos[B.partner.p].pos.slice(); B.pb = cellAt(B.partner.to); }
  } else if (B.kind === 'promote') {
    pillarFx(cellAt(B.at), new THREE.Color(0xffffff), B.dur * 1.4);
    banner = { text: 'PROMOTION', left: 1.0, color: '#ffd23a' };
  } else if (B.kind === 'check') banner = { text: 'CHECK!', left: 1.2, color: '#ff4f7a' };
  else if (B.kind === 'end') {
    const w = B.end.winner;
    if (w !== null && w !== undefined) lp[1 - w] = 0;
    banner = { text: w === null || w === undefined ? `DRAW · ${B.end.reason}` : `${nameOf(w)} ${nameOf(w) === 'YOU' ? 'WIN' : 'WINS'} · ${B.end.reason}`, left: 1e9, color: w === null || w === undefined ? '#fff' : HA.duelists[w].colour };
  }
}
function stepBeat(B, u) {
  if (B.kind === 'summon') {
    // each piece out of its own beam of light, rising as the beam fades
    const t = u * B.dur;
    for (const A of B.army) {
      const H = holos[A.p]; if (!H) continue;
      const k = Math.min(1, Math.max(0, (t - A.delay) / B.rise));
      if (k > 0 && !A.lit) { A.lit = true; pillarFx(H.pos, colourOf(A.piece.side), B.rise * 1.6); }
      H.mat.uniforms.uReveal.value = k; H.edgeMat.opacity = 0.95 * k;
    }
  } else if (B.kind === 'destroy') {
    for (const q of B.victims) { const V = holos[q]; if (V) { V.mat.uniforms.uAlpha.value = (1 - u) * (0.6 + 0.4 * Math.sin(u * 60)); V.edgeMat.opacity = 0.95 * (1 - u); } }
  } else if (B.kind === 'move') {
    const H = holos[B.p]; if (!H || !B.a) return;
    const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    H.yaw = faceYaw(H.side);
    placeHolo(H, lerp(B.a[0], B.b[0], e), lerp(B.a[1], B.b[1], e), lerp(B.a[2], B.b[2], e) + B.hop * Math.sin(Math.PI * u));
    if (B.pa) { const Q = holos[B.partner.p]; placeHolo(Q, lerp(B.pa[0], B.pb[0], e), lerp(B.pa[1], B.pb[1], e), lerp(B.pa[2], B.pb[2], e) + 0.2 * Math.sin(Math.PI * u)); }
  } else if (B.kind === 'convert') {
    const H = holos[B.p]; if (H && u >= 0.5 && H.side !== B.side) tintHolo(H, B.side);
  }
}
function endBeat(B) {
  if (B.kind === 'destroy') for (const q of B.victims) { dropHolo(holos[q]); delete holos[q]; }
  else if (B.kind === 'move') stepBeat(B, 1);
  else if (B.kind === 'promote') {
    const old = holos[B.p]; if (!old) return;
    const H = makeHolo(B.to, old.side); H.yaw = old.yaw; placeHolo(H, old.pos[0], old.pos[1], old.pos[2]);
    dropHolo(old); holos[B.p] = H;
    lp[0] = B.lp[0]; lp[1] = B.lp[1];
  } else if (B.kind === 'summon') stepBeat(B, 1);
  else if (B.kind === 'convert') { const H = holos[B.p]; if (H) tintHolo(H, B.side); }
  else if (B.kind === 'end') { phase = 'over'; finish(); }
}
// every hologram where the state says, no beat between (after a probe's run)
function sync() {
  queue.length = 0; beat = null; lpTarget(S);
  for (const k of Object.keys(holos)) { const P = S.pieces[k]; if (!P || P.at < 0 || P.kind !== holos[k].kind) { dropHolo(holos[k]); delete holos[k]; } }
  S.pieces.forEach((P, i) => {
    if (P.at < 0) return;
    const H = holos[i] || (holos[i] = makeHolo(P.kind, P.side));
    if (H.side !== P.side) tintHolo(H, P.side);
    H.yaw = faceYaw(P.side); H.mat.uniforms.uReveal.value = 1; H.mat.uniforms.uAlpha.value = 1; H.edgeMat.opacity = 0.95;
    const [x, y, z] = cellAt(P.at); placeHolo(H, x, y, z);
  });
  lpShown[0] = lp[0]; lpShown[1] = lp[1];
}

function post(msg) { if (hosted) window.parent.postMessage(msg, '*'); }
function finish() {
  const w = ended ? ended.winner : null;
  const won = nPlayers !== 1 || w === null || w === undefined || w === human;
  if (hosted) { post({ moj: HA.wire.outcome, envelope: { result: won ? 'success' : 'fail', events: [], stats: { holo: { winner: w === null || w === undefined ? null : HA.duelists[w].id, reason: ended ? ended.reason : null, moves: line.length } } } }); phase = 'done'; }
}
if (hosted) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.moj !== HA.wire.init || d.contractVersion !== HA.wire.version) return;
    begin((d.params && d.params.holo) || {});
  });
  post({ moj: HA.wire.ready, contractVersion: HA.wire.version, levelRef: 'holo' });
}

// ── the pads ─────────────────────────────────────────────────────────────────────────────────────────────────

const picker = document.createElement('div');
picker.style.cssText = 'position:absolute;left:50%;bottom:16%;transform:translateX(-50%);display:none;gap:10px;z-index:8;pointer-events:auto';
wrap.appendChild(picker);
function pick(moves) {
  picker.innerHTML = '';
  for (const m of moves) {
    const b = document.createElement('button'), kind = m.promote || m.drop || S.pieces[m.p].kind;
    b.textContent = (HA.kinds[kind] && HA.kinds[kind].name) || kind;
    b.style.cssText = `font:700 15px ${FONT};padding:8px 14px;color:#dff9ff;background:rgba(10,30,45,0.85);border:1px solid #36d6ff;border-radius:6px;cursor:pointer`;
    b.onclick = () => { picker.style.display = 'none'; play(m); };
    picker.appendChild(b);
  }
  picker.style.display = 'flex';
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function cellUnder(ev) {
  const r = wrap.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(cellPanes, false)[0];
  return hit ? hit.object.userData.cell : -1;
}
function click(cell) {
  if (phase !== 'play' || ended || queue.length || beat || !isHuman(S.side) || cell < 0) return;
  if (sel >= 0) {
    const to = legal.filter((m) => m.from === sel && m.to === cell);
    if (to.length === 1) { sel = -1; markCells([]); return play(to[0]); }
    if (to.length > 1) return pick(to);
  }
  if (S.chain >= 0) return;
  const drops = legal.filter((m) => m.drop && m.to === cell);
  if (drops.length === 1) return play(drops[0]);
  if (drops.length > 1) return pick(drops);
  const p = S.board[cell];
  sel = p >= 0 && S.pieces[p].side === S.side && legal.some((m) => m.from === cell) ? cell : -1;
  lightSelection();
}
function lightSelection() {
  if (sel < 0) return markCells([]);
  markCells([[sel, 0xffffff], ...legal.filter((m) => m.from === sel).map((m) => [m.to, m.cap.length ? 0xff4f7a : 0x5cff8a])]);
}
wrap.addEventListener('pointerdown', (ev) => click(cellUnder(ev)));
window.addEventListener('keydown', (e) => { if (e.code === 'Enter' && phase === 'over') begin(lastParams || {}); });

// ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────

const cam = { yaw: null, focus: [C0[0], C0[1], C0[2]], dist: reach + HA.board.podium + 6.5 };
function frameCamera(dt) {
  const seat = nPlayers === 2 ? S.side : nPlayers === 1 ? human : 0;
  const want = podiums[seat].back + (nPlayers === 0 ? 0.35 * Math.sin(now * 0.12) : 0);
  if (cam.yaw === null) cam.yaw = want;
  let dy = want - cam.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  cam.yaw += dy * Math.min(1, dt * 2.2);
  // a beat draws the eye toward where it happens
  const B = beat, at = B && (B.b || (B.at !== undefined && B.at >= 0 ? cellAt(B.at) : B.kind === 'summon' && B.army.length === 1 ? cellAt(B.army[0].at) : null)), f = at ? [lerp(C0[0], at[0], 0.35), lerp(C0[1], at[1], 0.35), C0[2]] : C0;
  for (let i = 0; i < 3; i++) cam.focus[i] += (f[i] - cam.focus[i]) * Math.min(1, dt * 2);
  const d = cam.dist * (B && B.kind !== 'summon' ? 0.92 : 1);
  camera.position.set(cam.focus[0] + Math.cos(cam.yaw) * d, cam.focus[1] + Math.sin(cam.yaw) * d, C0[2] + d * 0.72);
  camera.lookAt(cam.focus[0], cam.focus[1], cam.focus[2] + 0.4);
  if (camera.fov !== 46) { camera.fov = 46; camera.updateProjectionMatrix(); }
}
function text(str, x, y, size, color, align = 'center', weight = 800) { g2.font = `${weight} ${size}px ${FONT}`; g2.textAlign = align; g2.textBaseline = 'middle'; g2.fillStyle = color; g2.fillText(str, x, y); }
function outlined(str, x, y, size, color) { g2.font = `900 ${size}px ${FONT}`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = Math.max(3, size / 9); g2.strokeStyle = '#000'; g2.lineJoin = 'round'; g2.strokeText(str, x, y); g2.fillStyle = color; g2.fillText(str, x, y); }
const PANEL_Y = 52;   // below the page's own buttons
function lpPanel(s, x, align) {
  const w = 250, top = PANEL_Y, left = align === 'left' ? x : x - w, col = HA.duelists[s].colour, live = S && !ended && S.side === s;
  g2.fillStyle = 'rgba(4,12,20,0.72)'; g2.fillRect(left, top, w, 64);
  g2.fillStyle = col; g2.fillRect(left, top, 4, 64);
  text(`${live ? '▶ ' : ''}${nameOf(s)}`, align === 'left' ? left + 14 : left + w - 14, top + 16, 15, col, align, 800);
  text(`LP ${Math.round(lpShown[s])}`, align === 'left' ? left + 14 : left + w - 14, top + 44, 26, '#fff', align, 900);
  const k = Math.max(0, lpShown[s] / LP_START);
  g2.fillStyle = 'rgba(255,255,255,0.12)'; g2.fillRect(left + 14, top + 58, w - 28, 3); g2.fillStyle = col; g2.fillRect(align === 'left' ? left + 14 : left + w - 14 - (w - 28) * k, top + 58, (w - 28) * k, 3);
}
function draw(dt) {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!S) { outlined('GET READY', OW / 2, OH / 2, 40, '#fff'); return; }
  frameCamera(dt);
  for (let s = 0; s < 2; s++) { const d = lp[s] - lpShown[s]; lpShown[s] += Math.abs(d) < 1 ? d : d * Math.min(1, dt * 4); }
  lpPanel(0, 16, 'left'); lpPanel(1, OW - 16, 'right');
  text(HA.title, OW / 2, 26, 15, 'rgba(220,250,255,0.85)', 'center', 700);
  const status = ended ? (phase === 'over' && !hosted ? 'press Enter to duel again' : '') : queue.length || beat ? (line.length ? line[line.length - 1] : '') : isHuman(S.side) ? (S.chain >= 0 ? 'jump again' : `${nameOf(S.side)}: your move`) : `${nameOf(S.side)} is thinking…`;
  if (status) text(status, OW / 2, OH - 26, 15, '#dff9ff', 'center', 600);
  if (banner) outlined(banner.text, OW / 2, OH * 0.28, 48, banner.color);
}

// the page calls this from its frame step with its clock in seconds
let last = null;
function stepHoloArena(t) {
  if (last === null) last = t;
  const dt = Math.min(0.1, Math.max(0, t - last));
  last = t; now += dt;
  if (phase === 'wait') { if (!hosted || (waited += dt) > 1.5) begin({}); draw(dt); return; }
  // the beats, one after another
  if (!beat && queue.length) { beat = queue.shift(); beat.t = 0; seen.push(beat.kind); startBeat(beat); }
  if (beat) { beat.t += dt; const u = Math.min(1, beat.t / beat.dur); stepBeat(beat, u); if (u >= 1) { endBeat(beat); beat = null; if (sel >= 0) lightSelection(); } }
  for (let i = effects.length - 1; i >= 0; i--) { const E = effects[i]; E.t += dt; const u = Math.min(1, E.t / E.life); E.step(u); if (u >= 1) { E.end(); effects.splice(i, 1); } }
  for (const H of Object.values(holos)) H.mat.uniforms.uTime.value = now;
  scan.position.y = C0[1] + Math.sin(now * 0.6) * reach * 0.9;
  for (const [i, P] of cellPanes.entries()) P.material.opacity = P.userData.base * (0.85 + 0.15 * Math.sin(now * 2 + i * 0.37));
  podiums.forEach((P, s) => { P.rim.material.opacity = S && !ended && S.side === s ? 0.65 + 0.35 * Math.sin(now * 5) : 0.35; });
  if (banner && (banner.left -= dt) <= 0) banner = null;
  // the computer's turn, a beat after the last one played out
  if (phase === 'play' && !ended && !queue.length && !beat && !isHuman(S.side) && (thinkAt += dt) > 0.35) computer();
  draw(dt);
}

window.__mojHolo = {
  get state() { return S; }, get phase() { return phase; }, get line() { return line.slice(); },
  // the beat on stage now (summon, attack, destroy, move, promote, convert, check, end), and every beat begun so far
  get beat() { return beat ? beat.kind : null; }, get seen() { return seen.slice(); },
  lp: () => lp.slice(),
  // a cell clicked as the pointer would, by its name ('E2')
  click: (name) => click(HL.cells.findIndex((c) => c.name === name)),
  holograms: () => Object.keys(holos).length,
  // a probe's run: so many plies played at once by the minds (the pads at rest), every hologram set where the state says
  run(plies) {
    if (phase === 'wait') begin({});
    for (let i = 0; i < plies && !ended; i++) {
      if (isHuman(S.side)) break;
      computer();
    }
    sync();
    if (ended) { if (ended.winner !== null && ended.winner !== undefined) lp[1 - ended.winner] = lpShown[1 - ended.winner] = 0; phase = 'over'; finish(); }
    return S;
  },
};
