// THE HOLO BRIEFING'S CLIENT — the page's own code (briefing-page.js inlines it after `import * as THREE`, the
// briefing's data, BRIEF, and the canvas it draws on, BRIEF_CANVAS): the table, the system as an orrery, the theatre in
// miniature, a step at a time. It exposes `window.__brief`: { go(k), step, steps, ready, stop() } for the page's words
// (mana-ui) and for probes; stop() ends its frames and gives its GL context back (a level's briefing, once launched). It
// draws only what the data says; the words over it are mana-ui's.

const COL = { friend: new THREE.Color('#38d8ff'), foe: new THREE.Color('#ff4a5c'), neutral: new THREE.Color('#ffc93a'), beacon: new THREE.Color('#ffc23a'), nav: new THREE.Color('#a8f4ff'), dim: new THREE.Color('#5fb7d8') };
const R = 6, LIFT = 1.5;                       // the table's radius and the height of the theatre's plane over it (units)
const HALF = BRIEF.theatre.field / 2, S = (R * 0.9) / HALF;   // metres to units
const V = BRIEF.theatre.vertical || 1;         // a ground stage's heights stretched so its land reads on the table
const MINI = { fighter: 0.22, bomber: 0.26, transport: 0.5, probe: 0.14 };   // a craft's miniature length (units)
const SHIP_LEAST = 0.42;                       // a capital ship or a station is drawn at scale, never smaller than this
const FONT = '"Rajdhani","Bahnschrift","Segoe UI",system-ui,sans-serif';

const canvas = BRIEF_CANVAS;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x02050a, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
camera.up.set(0, 0, 1);

// ── the hologram's light ──────────────────────────────────────────────────────────────────────────────────
const HOLO_VERT = 'varying vec3 vN; varying vec3 vW;\nvoid main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';
const HOLO_FRAG = 'uniform vec3 uColor; uniform float uTime; uniform float uAlpha; uniform float uBase; uniform float uTop; uniform float uReveal;\nvarying vec3 vN; varying vec3 vW;\n'
  + 'void main() {\n  float cut = uBase + (uTop - uBase) * uReveal;\n  if (vW.z > cut) discard;\n'
  + '  vec3 V = normalize(cameraPosition - vW); float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);\n'
  + '  float scan = 0.72 + 0.28 * sin(vW.z * 90.0 - uTime * 6.0);\n  float edge = smoothstep(0.04, 0.0, cut - vW.z) * step(uReveal, 0.999);\n'
  + '  float a = ((0.16 + 0.7 * fres) * scan + edge) * uAlpha;\n  gl_FragColor = vec4(uColor * (0.5 + 1.25 * fres + 2.0 * edge), a);\n}';
function holoMaterial(color) {
  return new THREE.ShaderMaterial({ uniforms: { uColor: { value: color.clone() }, uTime: { value: 0 }, uAlpha: { value: 1 }, uBase: { value: -100 }, uTop: { value: 100 }, uReveal: { value: 1 } },
    vertexShader: HOLO_VERT, fragmentShader: HOLO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
const holos = [];   // every hologram's materials: { mats: [holo], edges: [line], base, alpha, target, stage }

// ── the table ─────────────────────────────────────────────────────────────────────────────────────────────
const table = new THREE.Group(); scene.add(table);
table.add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.9, R + 1.3, 0.5, 96).rotateX(Math.PI / 2).translate(0, 0, -0.25), new THREE.MeshBasicMaterial({ color: 0x060b12 })));
table.add(new THREE.Mesh(new THREE.CircleGeometry(R + 0.6, 96), new THREE.MeshBasicMaterial({ color: 0x03080e })));
for (const [r, w, o] of [[R + 0.6, 0.05, 0.75], [R, 0.025, 0.4], [R * 0.66, 0.015, 0.22], [R * 0.33, 0.015, 0.22], [0.6, 0.02, 0.5]]) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - w, r, 128), additive(0x36d6ff, o)); m.position.z = 0.005; table.add(m);
}
{
  const pts = [];
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.006), new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0.006)); }
  for (let k = 0; k < 72; k++) { const a = (k / 72) * Math.PI * 2, r0 = R + 0.2, r1 = R + (k % 6 ? 0.35 : 0.55); pts.push(new THREE.Vector3(Math.cos(a) * r0, Math.sin(a) * r0, 0.006), new THREE.Vector3(Math.cos(a) * r1, Math.sin(a) * r1, 0.006)); }
  table.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0x36d6ff, 0.16)));
}
// the projector's sweep round the table, and the light it throws up
const sweep = new THREE.Mesh(new THREE.RingGeometry(0.6, R, 64, 1, 0, 0.5), additive(0x36d6ff, 0.08)); sweep.position.z = 0.008; table.add(sweep);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R, LIFT * 2.2, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, LIFT * 1.1), additive(0x1a6f96, 0.035)); table.add(beam);
// stars far off, for depth
{
  const n = 900, p = new Float32Array(n * 3);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = 160; p[3 * i] = r * Math.sqrt(1 - u * u) * Math.cos(t); p[3 * i + 1] = r * Math.sqrt(1 - u * u) * Math.sin(t); p[3 * i + 2] = r * u; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb8d0, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false })));
}

// ── a part of a miniature as geometry (holo-minis.js's parts) ─────────────────────────────────────────────
const DEG = Math.PI / 180;
function partGeo(P) {
  let g;
  if (P.box) { const [x, y, z, w, d, h] = P.box; g = new THREE.BoxGeometry(Math.max(w, 0.05), Math.max(d, 0.05), Math.max(h, 0.05)); if (P.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(P.rot[0] * DEG, P.rot[1] * DEG, P.rot[2] * DEG))); g.translate(x, y, z); }
  else if (P.ball) { const [x, y, z, r] = P.ball; g = new THREE.SphereGeometry(r, 14, 10); g.translate(x, y, z); }
  else if (P.tube) { const [x, y, z, r, len] = P.tube; g = new THREE.CylinderGeometry(r, r, len, 12); g.translate(x, y, z); }
  else if (P.plate) {
    const t = P.t || 0.2, sh = new THREE.Shape(P.plate.map(([u, v]) => new THREE.Vector2(u, v)));
    g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2);
    const M = new THREE.Matrix4();
    if (P.axis === 'x') M.set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
    else if (P.axis === 'y') M.set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
    g.applyMatrix4(M);
    if (P.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(P.rot[0] * DEG, P.rot[1] * DEG, P.rot[2] * DEG)));
    const o = P.at || 0; g.translate(P.axis === 'x' ? o : 0, P.axis === 'y' ? o : 0, P.axis === 'z' || !P.axis ? o : 0);
  }
  g.computeVertexNormals();
  return g;
}
const extentOf = (geos) => { const b = new THREE.Box3(); for (const g of geos) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };

// a hologram from parts: its meshes and edges, scaled `k`, in its own group; registered so its light can be set
function makeHolo(parts, color, k, { edges = true, edgeAlpha = 0.85, stage = 'theatre' } = {}) {
  const group = new THREE.Group(), mat = holoMaterial(color), em = lineMat(color, edgeAlpha);
  for (const P of parts) {
    const g = partGeo(P); g.scale(k, k, k);
    group.add(new THREE.Mesh(g, mat));
    if (edges) group.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), em));
  }
  const H = { group, mats: [mat], edges: [em], edgeBase: edgeAlpha, alpha: 1, target: 1, stage, reveal: 1, revealTo: 1 };
  holos.push(H);
  return H;
}

// a label that keeps its size on the screen, over a thing
function label(text, color, { size = 1, sub = '' } = {}) {
  // (as wide as its words: a long name is never clipped)
  const c = document.createElement('canvas'), m = c.getContext('2d');
  m.font = `700 54px ${FONT}`; const w1 = m.measureText(text.toUpperCase()).width; m.font = `500 38px ${FONT}`; const w2 = sub ? m.measureText(sub).width : 0;
  const W = Math.max(256, Math.ceil(Math.max(w1, w2) + 48)), Hh = sub ? 150 : 96; c.width = W; c.height = Hh;
  const g = c.getContext('2d'); g.font = `700 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#000'; g.shadowBlur = 10; g.fillStyle = '#' + color.getHexString(); g.fillText(text.toUpperCase(), W / 2, 48);
  if (sub) { g.font = `500 38px ${FONT}`; g.fillStyle = '#cfefff'; g.fillText(sub, W / 2, 112); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  const h = 0.042 * size * (Hh / 96); sp.scale.set(h * (W / Hh), h, 1); sp.renderOrder = 10; sp.center.set(0.5, 0);
  return sp;
}

// ── the orrery: the system, the cluster, the moon ─────────────────────────────────────────────────────────
const O = BRIEF.orrery, orr = new THREE.Group(); orr.position.z = LIFT; scene.add(orr);
const OR = R * 0.92;   // the outermost orbit (units)
const orrHolos = [], orrLabels = [], orrFade = [];   // (orrFade: the orrery's plain lights and lines, each faded as it zooms away)
const starCol = new THREE.Color(O.star.color);
{
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), additive(starCol, 0.95)); orr.add(core); orrFade.push([core.material, 0.95]);
  for (const [r, o] of [[0.45, 0.25], [0.75, 0.1], [1.2, 0.05]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), additive(starCol, o)); orr.add(m); orrFade.push([m.material, o]); }
}
const ringLine = (r, color, opacity, seg = 128) => { const pts = []; for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); } const L = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color, opacity)); orrFade.push([L.material, opacity]); return L; };
const homeAt = new THREE.Vector3(), moonAt = new THREE.Vector3(), clusterAt = new THREE.Vector3();
O.planets.forEach((P, i) => {
  const home = i === O.home, col = new THREE.Color(home ? '#7fe9ff' : P.color);
  orr.add(ringLine(P.r * OR, home ? 0x7fe9ff : 0x2f8fb8, home ? 0.55 : 0.22));
  const at = new THREE.Vector3(Math.cos(P.a) * P.r * OR, Math.sin(P.a) * P.r * OR, 0);
  const H = makeHolo([{ ball: [0, 0, 0, P.size * OR] }], col, 1, { edges: false, stage: 'orrery' }); H.group.position.copy(at); orr.add(H.group); orrHolos.push(H);
  if (P.ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(P.size * OR * 1.5, P.size * OR * 2.3, 48), additive(col, 0.3)); rg.position.copy(at); rg.rotation.x = 1.1; orr.add(rg); }
  if (home) {
    homeAt.copy(at);
    for (const m of P.moons) {
      const mr = m.r * OR, ma = new THREE.Vector3(at.x + Math.cos(m.a) * mr, at.y + Math.sin(m.a) * mr, 0);
      const ring = ringLine(mr, m.n === O.moon ? 0xffe08a : 0x4fb0d8, m.n === O.moon ? 0.6 : 0.25, 64); ring.position.copy(at); orr.add(ring);
      const M = makeHolo([{ ball: [0, 0, 0, m.size * OR] }], new THREE.Color(m.n === O.moon ? '#ffe7a0' : '#8fd0ea'), 1, { edges: false, stage: 'orrery' }); M.group.position.copy(ma); orr.add(M.group); orrHolos.push(M);
      if (m.n === O.moon) moonAt.copy(ma);
    }
  }
});
// the cluster: its rocks round the trojan point
{
  clusterAt.set(O.cluster.at[0] * OR, O.cluster.at[1] * OR, 0);
  const parts = O.cluster.rocks.map(([x, y, z, r]) => ({ box: [x * OR, y * OR, z * OR, r * OR * 2.2, r * OR * 2.2, r * OR * 2.2], rot: [x * 900, y * 700, (x + y) * 500] }));
  const C = makeHolo(parts, new THREE.Color('#d2b98a'), 1, { edges: false, stage: 'orrery' }); orr.add(C.group); orrHolos.push(C);
}
// the station by its moon: a blip and a marker ring
const moonMark = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.19, 48), additive(0xffe08a, 0.9)); moonMark.position.copy(moonAt); orr.add(moonMark);
const clusterMark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.45, 64), additive(0xd2b98a, 0.7)); clusterMark.position.copy(clusterAt); orr.add(clusterMark);
{
  const add = (sp, at, dz) => { sp.position.set(at.x, at.y, at.z + dz); orr.add(sp); orrLabels.push(sp); return sp; };
  add(label(BRIEF.place.parts[0], starCol, { size: 0.9 }), new THREE.Vector3(), 0.5);
  add(label(BRIEF.place.parts[1], new THREE.Color('#e8d3a8'), { size: 0.75 }), clusterAt, 0.5);
  add(label(BRIEF.place.parts[3], new THREE.Color('#ffe7a0'), { size: 0.75, sub: BRIEF.place.parts[2] }), moonAt, 0.24);
}

// ── the theatre: the fight's own space in miniature ──────────────────────────────────────────────────────
const th = new THREE.Group(); scene.add(th);
const toTable = (p) => new THREE.Vector3(p[0] * S, p[1] * S, LIFT + p[2] * S * V);
const places = {};   // id → { at: Vector3 (in the theatre's frame), r: radius (units), holo?, label? }
const thLabels = [];
// a ground stage's land (stage-ground.js): its heightfield as a hologram, its contours every few samples, the colony's
// masses on it; then no plane, the land is the theatre's floor
const TG = BRIEF.theatre.terrain || null;
if (TG) {
  const { x0, y0, dx, nx, ny, z } = TG, pos = new Float32Array(nx * ny * 3), idx = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; pos.set([(x0 + i * dx) * S, (y0 + j * dx) * S, LIFT + (z[k] / 10) * S * V], k * 3); }
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) { const k = j * nx + i; idx.push(k, k + 1, k + nx, k + 1, k + nx + 1, k + nx); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const col = new THREE.Color('#5fd8c8'), mat = holoMaterial(col), em = lineMat(col, 0.3), lines = [], step = 4;
  for (let j = 0; j < ny; j += step) for (let i = 0; i + 1 < nx; i++) { const a = (j * nx + i) * 3, b = a + 3; lines.push(pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2]); }
  for (let i = 0; i < nx; i += step) for (let j = 0; j + 1 < ny; j++) { const a = (j * nx + i) * 3, b = a + nx * 3; lines.push(pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2]); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3));
  const group = new THREE.Group(); group.add(new THREE.Mesh(g, mat), new THREE.LineSegments(lg, em)); th.add(group);
  const H = { group, mats: [mat], edges: [em], edgeBase: 0.3, alpha: 1, target: 1, stage: 'theatre', reveal: 1, revealTo: 1, base: 0.5 };
  holos.push(H); places.land = { holo: H };
  const M = BRIEF.theatre.masses || [];
  if (M.length) { const C = makeHolo(M.map(([x, y, zz, w, d, h]) => ({ box: [x * S, y * S, LIFT + (zz + h / 2) * S * V, w * S, d * S, h * S * V] })), new THREE.Color('#dff6ff'), 1, { edges: false }); th.add(C.group); C.base = 0.8; places.colony = { holo: C }; }
}
// the theatre's plane: a faint grid at the start's level, its field's edge
if (!TG) {
  const pts = [], n = 12, e = HALF * S;
  for (let k = 0; k <= n; k++) { const v = -e + (2 * e * k) / n; pts.push(new THREE.Vector3(-e, v, LIFT), new THREE.Vector3(e, v, LIFT), new THREE.Vector3(v, -e, LIFT), new THREE.Vector3(v, e, LIFT)); }
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0x2a86b0, 0.12)); th.add(grid);
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-e, -e], [e, -e], [e, e], [-e, e]].map(([x, y]) => new THREE.Vector3(x, y, LIFT))), lineMat(0x36d6ff, 0.35)); th.add(edge);
}
// the moon in the fight's sky, at the table's edge
{
  const M = BRIEF.theatre.moon, b = M.bearing * DEG, el = M.elevation * DEG, size = { distant: 0.16, near: 0.3, 'high-orbit': 0.55 }[M.size] * R * 0.5;
  const d = R * 1.45, at = new THREE.Vector3(Math.sin(b) * Math.cos(el) * d, Math.cos(b) * Math.cos(el) * d, LIFT + 1.2 + Math.sin(el) * d * 0.5);
  const H = makeHolo([{ ball: [0, 0, 0, size] }], new THREE.Color('#ffe7a0'), 1, { edges: false }); H.group.position.copy(at); th.add(H.group);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(size * 1.002, 18, 12)), lineMat(0xffe08a, 0.18)); wire.position.copy(at); th.add(wire); H.edges.push(wire.material);
  const sp = label(BRIEF.place.parts[3], new THREE.Color('#ffe7a0'), { size: 0.8 }); sp.position.set(at.x, at.y, at.z + size + 0.1); th.add(sp); thLabels.push(sp);
  places.moon = { at, r: size, holo: H };
}
// the rocks of the cluster
{
  const parts = BRIEF.theatre.rocks.map(([x, y, z, r]) => ({ box: [x * S, y * S, LIFT + z * S * V, Math.max(0.05, r * S * 1.8), Math.max(0.05, r * S * 1.6), Math.max(0.05, r * S * 1.4)], rot: [x, y, x + y] }));
  if (parts.length) { const H = makeHolo(parts, new THREE.Color('#c8ad7f'), 1, { edges: true, edgeAlpha: 0.25 }); th.add(H.group); H.base = 0.55; places.rocks = { holo: H }; }
}
// the nav points: a diamond and its name, a line down to the plane
for (const N of BRIEF.theatre.nav) {
  const at = toTable(N.at), H = makeHolo([{ box: [0, 0, 0, 0.12, 0.12, 0.12], rot: [45, 35, 0] }], COL.nav, 1, { edgeAlpha: 1 });
  H.group.position.copy(at); th.add(H.group);
  const sp = label(N.name, COL.nav, { size: 0.7 }); sp.position.set(at.x, at.y, at.z + 0.12); th.add(sp); thLabels.push(sp);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.19, 40), additive(COL.nav, 0.45)); ring.position.copy(at); th.add(ring);
  H.group.userData.id = N.id; sp.userData.id = N.id;
  places[N.id] = { at, r: 0.3, holo: H, label: sp, ring, model: H.group, labelDz: 0.12, nav: true };
}
// what fights: each a miniature on its post, a line to the plane, its name over it
const drops = [];
for (const T of BRIEF.things) {
  const col = COL[T.side] || COL.neutral, at = toTable(T.at), g = new THREE.Group();
  let H, r;
  if (T.kind === 'beacon') {
    // a beacon: a ring at its reach round a core, in amber (dashed while something has yet to light it)
    const rr = Math.max(0.12, T.radius * S * 2.2);
    H = makeHolo([{ ball: [0, 0, 0, rr * 0.3] }], col, 1, { edges: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, rr * 0.06, 8, 48), H.mats[0]); ring.rotation.x = Math.PI / 2; g.add(H.group, ring);
    if (T.dark) { const pts = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rr * 1.35, Math.sin(a) * rr * 1.35, 0)); } const dash = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col, 0.8)); g.add(dash); H.edges.push(dash.material); }
    r = rr;
  } else if (T.kind === 'group') {
    const ext = extentOf(T.mini.parts.map(partGeo)), len = Math.max(ext.max.x - ext.min.x, ext.max.y - ext.min.y), k = MINI[T.mini.size] / len;
    H = makeHolo([], col, 1);
    // a wedge: the lead at the point, the rest staggered back to either side
    for (let i = 0; i < T.count; i++) {
      const j = Math.ceil(i / 2), side = i % 2 ? -1 : 1, off = new THREE.Vector3(side * j * MINI[T.mini.size] * 1.1, -j * MINI[T.mini.size] * 0.9, (i % 2) * 0.02);
      for (const P of T.mini.parts) { const geo = partGeo(P); geo.scale(k, k, k); geo.translate(off.x, off.y, off.z); g.add(new THREE.Mesh(geo, H.mats[0])); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), H.edges[0])); }
    }
    r = MINI[T.mini.size] * (1 + Math.ceil(T.count / 2));
  } else {
    const len = T.mini.length, k = Math.max(S, SHIP_LEAST / len);
    H = makeHolo(T.mini.parts, col, k, { edgeAlpha: 0.7 });
    g.add(H.group); r = (len * k) / 2;
  }
  H.group = g;   // (its light is set by its materials; the group is what is placed, and what a jump-in reveals)
  g.position.copy(at); g.rotation.z = -T.heading * DEG; th.add(g);
  // the post: a line down to the table's plane and a ring where it meets it
  const foot = new THREE.Vector3(at.x, at.y, LIFT);
  let dl = null;
  if (Math.abs(at.z - LIFT) > 0.02) { dl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([at, foot]), lineMat(col, 0.35)); th.add(dl); drops.push({ id: T.id, line: dl }); H.edges.push(dl.material); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.12, r * 0.6), Math.max(0.14, r * 0.6 + 0.03), 40), additive(col, 0.4)); ring.position.copy(foot); th.add(ring); H.edges.push(ring.material);
  const name = T.kind === 'group' ? `${T.name}${T.count > 1 ? ` ×${T.count}` : ''}` : T.name, sub = T.pilot ? 'you' : T.label;
  const sp = label(name, col, { size: 0.75, sub }); sp.position.set(at.x, at.y, at.z + Math.max(0.12, r * 0.5)); th.add(sp); thLabels.push(sp);
  g.userData.id = T.id; sp.userData.id = T.id;
  places[T.id] = { at, r, holo: H, label: sp, thing: T, shown: !T.arrives, model: g, labelDz: Math.max(0.12, r * 0.5), foot: ring, drop: dl, col };
  if (T.arrives) { H.alpha = 0; H.target = 0; sp.material.opacity = 0; }
}

// ── routes: the way between two places, light running along it ──────────────────────────────────────────
let routes = [];
function clearRoutes() { for (const R0 of routes) { th.remove(R0.line); for (const d of R0.dots) th.remove(d); } routes = []; }
function drawRoutes(list) {
  clearRoutes();
  for (const [a, b] of list) {
    const A = places[a], B = places[b]; if (!A || !B) continue;
    const from = A.at.clone(), to = B.at.clone(), side = (A.thing && A.thing.side) || (B.thing && B.thing.side) || 'nav', col = COL[side] || COL.nav;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), lineMat(col, 0.0)); th.add(line);
    const dots = [];
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), to.clone().sub(from).normalize());
    for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8).rotateX(Math.PI / 2), additive(col, 0)); d.quaternion.copy(q); th.add(d); dots.push(d); }
    routes.push({ line, dots, from, to, t: 0 });
  }
}

// ── the camera and the steps ───────────────────────────────────────────────────────────────────────────────
let drift = 0.06;   // (the camera's slow turn round the table, rad/s; the editor holds it still)
const view = { target: new THREE.Vector3(0, 0, LIFT), dist: 16, az: -0.5, el: 0.62 }, want = { target: new THREE.Vector3(0, 0, LIFT), dist: 16, el: 0.62 };
let stage = 'orrery', mix = 0, mixTo = 0, now = 0, k0 = -1, stepAt = 0;
const shown = new Set();
function frame(ids) {
  const pts = ids.map((id) => places[id]).filter(Boolean);
  if (!pts.length) { want.target.set(0, 0, LIFT); want.dist = 15; return; }
  const box = new THREE.Box3();
  for (const P of pts) box.expandByPoint(P.at.clone().addScalar(P.r)).expandByPoint(P.at.clone().addScalar(-P.r));
  const c = box.getCenter(new THREE.Vector3()), rad = Math.max(0.9, box.getSize(new THREE.Vector3()).length() / 2);
  want.target.copy(c); want.dist = Math.max(3.2, (rad / Math.sin((camera.fov * DEG) / 2)) * 1.1);
}
function go(k) {
  const steps = BRIEF.steps; k = Math.max(0, Math.min(steps.length - 1, k));
  const St = steps[k];
  stage = St.stage; mixTo = stage === 'theatre' ? 1 : 0; stepAt = now;
  if (St.stage === 'orrery') {
    // the system whole; the cluster on its orbit; the moon and the station over it
    if (St.focus === 'system') { want.target.set(0, 0, LIFT); want.dist = 17; want.el = 0.78; }
    else if (St.focus === 'cluster') { want.target.set(clusterAt.x, clusterAt.y, LIFT); want.dist = 4.6; want.el = 0.85; }
    else { want.target.set((moonAt.x + homeAt.x) / 2, (moonAt.y + homeAt.y) / 2, LIFT); want.dist = 3.6; want.el = 0.95; }
    shown.clear(); clearRoutes();
  } else {
    want.el = 0.6; shown.clear(); for (const id of St.show) shown.add(id);
    // a group that jumps in arrives the first time its step shows it, and stays
    for (const id of St.show) { const P = places[id]; if (P && P.thing && P.thing.arrives && !P.shown) { P.shown = true; arrive(P); } }
    frame(St.show); drawRoutes(St.routes);
  }
  k0 = k;
  window.__brief.step = k;
}
// a jump in: a streak along its heading that draws back into the craft, and the craft summoned bottom to top
const effects = [];
function arrive(P) {
  const H = P.holo, col = COL[P.thing.side] || COL.neutral, dir = new THREE.Vector3(Math.sin(P.thing.heading * DEG), Math.cos(P.thing.heading * DEG), 0);
  H.target = 1; H.alpha = 1; H.reveal = 0; H.revealTo = 1;
  const b = new THREE.Box3().setFromObject(H.group); for (const m of H.mats) { m.uniforms.uBase.value = b.min.z - 0.01; m.uniforms.uTop.value = b.max.z + 0.01; }
  const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 1, 8, 1, true), additive(col, 0.9));
  th.add(streak);
  effects.push({ t: 0, life: 0.9, step: (u) => {
    const len = 4 * (1 - u) + 0.05, c = P.at.clone().addScaledVector(dir, -len / 2);
    streak.position.copy(c); streak.scale.set(1 + 2 * (1 - u), len, 1 + 2 * (1 - u)); streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); streak.material.opacity = 0.9 * (1 - u);
    P.label.material.opacity = u;
  }, end: () => th.remove(streak) });
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // the words sit on the left: the table is framed in what is left of the screen
  const shift = w > h * 1.1 ? -w * 0.17 : 0;
  camera.setViewOffset(w, h, shift, h > w ? -h * 0.12 : 0, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
let last = performance.now(), stopped = false;
function tick(t) {
  if (stopped) return;
  // (on the clock, not by frames: over a held level the page draws slower, and the zoom still takes its time)
  const dt = Math.min(0.25, Math.max(0, (t - last) / 1000)); last = t; now += dt;
  // the stage's blend: the orrery zooms through its moon and away as the theatre rises
  mix = damp(mix, mixTo, 3.2, dt);
  const zs = 1 + 7 * mix; orr.scale.setScalar(zs); orr.position.set(-moonAt.x * (zs - 1), -moonAt.y * (zs - 1), LIFT);
  orr.visible = mix < 0.97; th.visible = mix > 0.02;
  const ts = 0.3 + 0.7 * mix; th.scale.setScalar(ts); th.position.set(0, 0, LIFT * (1 - ts));
  // the light of each hologram: lit if its step is about it (or no step is), dimmed if not, faded with its stage
  for (const H of holos) {
    const stageA = H.stage === 'orrery' ? 1 - mix : mix;
    H.alpha = damp(H.alpha, H.target, 4, dt);
    H.reveal = damp(H.reveal, H.revealTo, 2.2, dt);
    for (const m of H.mats) { m.uniforms.uTime.value = now; m.uniforms.uAlpha.value = H.alpha * stageA * (H.base ?? 1); m.uniforms.uReveal.value = H.reveal > 0.995 ? 1 : H.reveal; }
    for (const e of H.edges) e.opacity = (H.edgeBase ?? 0.85) * H.alpha * stageA * (H.base ?? 1);
  }
  for (const id in places) {
    const P = places[id]; if (!P.thing && id !== 'moon' && !BRIEF.theatre.nav.some((n) => n.id === id)) continue;
    const on = !shown.size || shown.has(id), arrived = !P.thing || !P.thing.arrives || P.shown;
    if (P.holo) P.holo.target = arrived ? (on ? 1 : 0.16) : 0;
    if (P.label && arrived) P.label.material.opacity = damp(P.label.material.opacity, (on ? 1 : 0.28) * mix, 5, dt);
  }
  // (the orrery's names gone early: as it zooms through its moon a name would swell over the screen)
  for (const sp of orrLabels) sp.material.opacity = Math.max(0, 1 - 4 * mix);
  for (const [m, o] of orrFade) m.opacity = o * Math.max(0, 1 - 2 * mix);
  moonMark.material.opacity = (0.5 + 0.4 * Math.sin(now * 4)) * (1 - mix); clusterMark.material.opacity = (0.35 + 0.3 * Math.sin(now * 3)) * (1 - mix);
  // the routes: drawn out from their start, then light running along them
  for (const Rt of routes) {
    Rt.t += dt; const grow = Math.min(1, Rt.t / 0.8), to = Rt.from.clone().lerp(Rt.to, grow);
    Rt.line.geometry.setFromPoints([Rt.from, to]); Rt.line.material.opacity = 0.55 * mix;
    Rt.dots.forEach((d, k) => { const u = ((now * 0.35 + k / Rt.dots.length) % 1) * grow; d.position.copy(Rt.from).lerp(Rt.to, u); d.material.opacity = 0.9 * mix * Math.sin(Math.PI * Math.min(1, u / Math.max(0.01, grow))); });
  }
  for (let i = effects.length - 1; i >= 0; i--) { const E = effects[i]; E.t += dt; const u = Math.min(1, E.t / E.life); E.step(u); if (u >= 1) { E.end(); effects.splice(i, 1); } }
  sweep.rotation.z = now * 0.6; beam.material.opacity = 0.03 + 0.01 * Math.sin(now * 2);
  // the camera: eased to the step's frame, turning slowly round it
  view.target.x = damp(view.target.x, want.target.x, 2.4, dt); view.target.y = damp(view.target.y, want.target.y, 2.4, dt); view.target.z = damp(view.target.z, want.target.z, 2.4, dt);
  view.dist = damp(view.dist, want.dist, 2.2, dt); view.el = damp(view.el, want.el, 2, dt); view.az += dt * drift;
  camera.position.set(view.target.x + Math.cos(view.az) * Math.cos(view.el) * view.dist, view.target.y + Math.sin(view.az) * Math.cos(view.el) * view.dist, view.target.z + Math.sin(view.el) * view.dist);
  camera.lookAt(view.target);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
function stop() {
  stopped = true; removeEventListener('resize', resize);
  try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* a context already lost */ }
}
// a place moved (the editor's): its model, its name, its post down to the table's plane and the ring at its foot
function moveTo(id, at) {
  const P = places[id]; if (!P) return;
  P.at.copy(at); P.model.position.copy(at); P.label.position.set(at.x, at.y, at.z + P.labelDz);
  if (P.nav) { P.ring.position.copy(at); return; }
  const foot = new THREE.Vector3(at.x, at.y, LIFT); P.foot.position.copy(foot);
  if (!P.drop) { P.drop = new THREE.Line(new THREE.BufferGeometry(), lineMat(P.col, 0.35)); th.add(P.drop); P.holo.edges.push(P.drop.material); }
  P.drop.geometry.setFromPoints([at, foot]);
}
// everything on the table lit and in view, the stage the theatre, the camera held (the editor's)
function showAll() {
  stage = 'theatre'; mixTo = 1; shown.clear(); clearRoutes();
  for (const id in places) { const P = places[id]; if (P.thing && P.thing.arrives) { P.shown = true; P.label.material.opacity = 1; } }
  frame(Object.keys(places).filter((id) => places[id].model)); want.el = 0.9;
}
window.__brief = { go, stop, step: 0, steps: BRIEF.steps.length, ready: true,
  api: { places, th, camera, renderer, scene, S, LIFT, want, view, moveTo, showAll, setDrift: (v) => { drift = v; } } };
go(0);
view.target.copy(want.target); view.dist = want.dist * 1.6; view.el = want.el;
requestAnimationFrame(tick);
