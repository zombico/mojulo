/**
 * versus arena (the World page's fight) — the fight drawn on a scapeshift arena in 3D (inlined as text by
 * scene/channels/versus.js inside one block, never imported).
 *
 * The pure modules and the runtime (versus-runtime.client.js) come first in the block; `VERSUS_ARENA` (the plane,
 * the walls, the roster, the rules, the level wire's names) is injected. From the page it uses only what a channel
 * may: `THREE`, `scene`, `camera`, `controls`, `wrap`, and `__ctrlOwnsCamera` (it owns the camera from the start).
 *
 * The fight's plane is the arena's: sim x (mm) is world x / 1000 about the room's middle, sim y the height off the
 * floor, all at the plane's y. Every body is the fighter in 3D (versus-figure.js): the vajra's skeleton posed from the
 * sim's figure, bladed toward the camera with the lead on the far side, turning into its strikes, its side view the
 * sim's own. A stick fighter is drawn on it as solid limbs (a fill and a black hull for the ink, a joint ball at each
 * bend, the far side darker). The camera stands square to the
 * plane on the open side, keeps both fighters in frame (closer as they close in) and stops at the walls. Health,
 * timer, banners, sparks and fireballs are the runtime's overlay, on a canvas over the picture.
 *
 * A character made with create_character (its `character` ref, its body in `VERSUS_ARENA.bodies`) fights in its own
 * body: its rig's rigid parts on its own skeleton, each riding its segment of the figure, relit by the arena's key as
 * it turns (the pack's baked rest light taken back out) and inked.
 * One the arena has no body for (a game's roster grown since the arena was made) is the stick figure.
 *
 * As a level: hosted in a versus game's frame it posts READY, fights the picks INIT brings (fighters as recipes,
 * names, colours, schemes, mode), and posts OUTCOME at the end (its result for player 1; quitting from pause is an
 * abort). On its own it fights the arena's first two fighters, player 1 against the CPU, and offers another.
 */

/* global VERSUS_ARENA, THREE, scene, camera, controls, wrap, compileFighter, rigJoints, weaponLine, RT, VS_DUMMY,
   figureBase, characterBase, figurePose, figureSegments, segmentOf, decodeF32, decodeU8, installVersusInput, hostedRules, menuInput, endInputFrame, newMatch, stepMatch, poseOf, drawnPose, drawEffects, drawHud, vsText, vsOutlined, pushBox */

const AV = VERSUS_ARENA;
const hosted = window.parent !== window;
const PLANE = AV.plane, FLOOR = AV.floor || 0;

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
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the fight
const VFOV = 38;
const cam = { x: 0, dist: 5.8 };

// ── bodies ───────────────────────────────────────────────────────────────────────────────────────────────────

// the fighter in 3D (versus-figure.js): its nodes in the figure's frame (metres, facing +y, its right +x) placed on
// the plane, facing its foe: +y along the plane toward the foe, its right toward the camera when it faces +x
const worldOf = (p, n, out) => out.set(p.x / 1000 + p.face * n[1], PLANE - p.face * n[0], FLOOR + p.y / 1000 + n[2]);
// how far the body stands bladed: all the way on its feet, half when hit, not at all falling or down
const BLADE_OF = { fall: 0, ko: 0, down: 0, thrown: 0, rise: 0.4, hit: 0.5, burst: 0.6 };
const bladeOf = (p) => BLADE_OF[p.st] ?? 1;
const poseFigure = (base, p, F, { pose, J }) => ({
  pose,
  N: figurePose(base, J, {
    face: p.face, air: !!pose.air, blade: bladeOf(p), stance: F.stance,
    twist: pose.twist ?? 0, sway: pose.sway ?? 0, tilt: pose.tilt ?? 0, spin: pose.spin ?? 0, bank: pose.bank ?? 0, lie: !!pose.lie,
    ...(pose.hands ? { hands: pose.hands } : {}), ...(pose.feet ? { feet: pose.feet } : {}),
  }),
});

// a unit cylinder along +y with its light baked into vertex colours (the page draws unlit), and a ball
function shadedGeometry(geo) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const k = 0.5 + 0.5 * Math.max(0, n.getX(i) * -0.35 + n.getY(i) * 0.55 + n.getZ(i) * -0.75);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const CYL = shadedGeometry(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2));
const BALL = shadedGeometry(new THREE.SphereGeometry(1, 14, 10));
const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
// the stick figure in the round: [from, to, width] on each side (S: the figure's L or R), the trunk, the girdles
const LIMBS = [
  ['pelvisHub', 'neckHub', 1.7], ['shoulderL', 'shoulderR', 0.9], ['hipL', 'hipR', 0.9],
  ...['L', 'R'].flatMap((S) => [[`shoulder${S}`, `elbow${S}`, 1], [`elbow${S}`, `fist${S}`, 1], [`hip${S}`, `knee${S}`, 1.15], [`knee${S}`, `ankle${S}`, 1], [`ankle${S}`, `toe${S}`, 0.8]]),
];
const JOINTS = [['pelvisHub', 1.6], ...['L', 'R'].flatMap((S) => [[`shoulder${S}`, 1.2], [`elbow${S}`, 1], [`fist${S}`, 1.5], [`knee${S}`, 1.1], [`ankle${S}`, 1]])];
// the far side (the lead, versus-figure.js) in the darker shade
const farOf = (name, face) => { const S = name.slice(-1); return (S === 'L' && face > 0) || (S === 'R' && face < 0); };

function makeBody(color, F) {
  const near = new THREE.MeshBasicMaterial({ color, vertexColors: true });
  const far = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), vertexColors: true });
  const group = new THREE.Group();
  const part = (geo, mat) => {
    const fill = new THREE.Mesh(geo, mat), ink = new THREE.Mesh(geo, INK);
    group.add(fill, ink);
    return { fill, ink };
  };
  const limbs = LIMBS.map(([a, b, w]) => ({ a, b, w, ...part(CYL, near) }));
  const joints = JOINTS.map(([j, w]) => ({ j, w, ...part(BALL, near) }));
  const head = part(BALL, near);
  // a weapon: one more inked cylinder, the blade's own colour, from the grip hand
  const blade = F && F.weapon ? part(CYL, new THREE.MeshBasicMaterial({ color: F.weapon.color, vertexColors: true })) : null;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  scene.add(group, shadow);
  return { group, limbs, joints, head, blade, shadow, near, far, base: figureBase(F.body) };
}

const vA = new THREE.Vector3(), vB = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1), vD = new THREE.Vector3();
function cylinderAt(mesh, a, b, r) {
  vD.subVectors(b, a);
  const len = vD.length() || 0.001;
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, vD.normalize());
  mesh.scale.set(r, r, len);
}
function placeBody(B, p, F, drawn) {
  const { N } = poseFigure(B.base, p, F, drawn);
  const r = F.body.limbR / 1000;
  for (const L of B.limbs) {
    worldOf(p, N[L.a], vA); worldOf(p, N[L.b], vB);
    L.fill.material = farOf(L.a, p.face) && farOf(L.b, p.face) ? B.far : B.near;
    cylinderAt(L.fill, vA, vB, r * L.w);
    cylinderAt(L.ink, vA, vB, r * L.w * 1.32);
  }
  for (const Jn of B.joints) {
    worldOf(p, N[Jn.j], vA);
    Jn.fill.material = farOf(Jn.j, p.face) ? B.far : B.near;
    for (const [mesh, k] of [[Jn.fill, 1.05], [Jn.ink, 1.32]]) { mesh.position.copy(vA); mesh.scale.setScalar(r * Jn.w * k); }
  }
  if (B.blade) {
    // the blade along the sim's line (weaponLine), from the grip hand's depth
    const L = weaponLine(drawn.J, F.weapon);
    const grip = F.weapon.grip === 'B' ? (p.face > 0 ? 'R' : 'L') : (p.face > 0 ? 'L' : 'R');
    const depth = N[`wrist${grip}`][0];
    worldOf(p, [depth, L.butt[0] / 1000, L.butt[1] / 1000], vA);
    worldOf(p, [depth, L.tip[0] / 1000, L.tip[1] / 1000], vB);
    const wr = (F.weapon.width / 1000) * 0.55;
    cylinderAt(B.blade.fill, vA, vB, wr);
    cylinderAt(B.blade.ink, vA, vB, wr * 1.6);
  }
  // the head: a ball between the head's base and top
  worldOf(p, N.headBase, vA); worldOf(p, N.headTop, vB);
  vA.add(vB).multiplyScalar(0.5);
  const hr = F.body.head / 1000;
  B.head.fill.position.copy(vA); B.head.fill.scale.setScalar(hr);
  B.head.ink.position.copy(vA); B.head.ink.scale.setScalar(hr * 1.12);
  B.shadow.position.set(p.x / 1000, PLANE, FLOOR + 0.01);
  B.shadow.scale.setScalar((F.body.bodyR / 1000) * 1.8 * Math.max(0.4, 1 - p.y / 1600));
}

// a character's own body: one mesh per bone part riding its segment of the figure (versus-figure.js), relit by the
// world's key as it turns (the rest light the pack baked in, taken back out by the face's rest normal) and inked
const SKINS = {};
function skinOf(ref) {
  const pack = ref && AV.bodies && AV.bodies[ref];
  if (!pack) return null;
  // (a posed body rides the figure's segments; a played one samples its clips, and rides the segments where it has no
  // clip for what the fight is doing: its hands, the fingers' and the wrist's, kept as its guard holds them)
  return SKINS[ref] || (SKINS[ref] = { pack, base: characterBase(pack.bones), seg: pack.bones.map((b) => segmentOf(b.id)), ...(pack.played ? { hand: pack.bones.map((b) => /^foreArm[LR]$/.test(segmentOf(b.id)) && !/^(foreArm|elbowFold)[LR]?$/.test(b.id)) } : {}) });
}
const REST_KEY = new THREE.Vector3(0.35, -0.55, 0.75).normalize();     // the pack's baked light (station-loft-rig.js)
const WORLD_KEY = new THREE.Vector3(-0.35, -0.6, 0.72).normalize();    // the arena's: from the camera's side, above
const INK_WIDTH = 0.011;
// smooth normals over a triangle soup (corners at one place share theirs)
function smoothNormals(pos) {
  const acc = new Map(), n = new Float32Array(pos.length), key = (i) => `${Math.round(pos[i] * 2e4)},${Math.round(pos[i + 1] * 2e4)},${Math.round(pos[i + 2] * 2e4)}`;
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    const f = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    for (let k = 0; k < 9; k += 3) { const kk = key(i + k), v = acc.get(kk) || [0, 0, 0]; v[0] += f[0]; v[1] += f[1]; v[2] += f[2]; acc.set(kk, v); }
  }
  for (let i = 0; i < pos.length; i += 3) {
    const v = acc.get(key(i)), l = Math.hypot(v[0], v[1], v[2]) || 1;
    n[i] = v[0] / l; n[i + 1] = v[1] / l; n[i + 2] = v[2] / l;
  }
  return n;
}
function litMaterial() {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uKey = { value: WORLD_KEY };
    sh.vertexShader = 'attribute float restShade;\nuniform vec3 uKey;\nvarying float vRelight;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  vec3 wn = normalize(mat3(modelMatrix) * normal);\n  vRelight = (0.55 + 0.45 * max(0.0, dot(wn, uKey))) / max(0.4, restShade);');
    sh.fragmentShader = 'varying float vRelight;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vRelight;');
  };
  return mat;
}
function inkMaterial() {
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${INK_WIDTH.toFixed(4)};`);
  };
  return mat;
}
function makeCharacter(skin) {
  const group = new THREE.Group(), lit = litMaterial(), ink = inkMaterial();
  const meshes = skin.pack.parts.map((part) => {
    if (!part) return null;
    const pos = decodeF32(part.pos), nrm = smoothNormals(pos), rest = new Float32Array(pos.length / 3);
    for (let i = 0; i < rest.length; i++) rest[i] = 0.55 + 0.45 * Math.max(0, nrm[i * 3] * REST_KEY.x + nrm[i * 3 + 1] * REST_KEY.y + nrm[i * 3 + 2] * REST_KEY.z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));
    geo.setAttribute('restShade', new THREE.BufferAttribute(rest, 1));
    geo.computeBoundingSphere();
    const fill = new THREE.Mesh(geo, lit), hull = new THREE.Mesh(geo, ink);
    for (const m of [fill, hull]) { m.matrixAutoUpdate = false; m.frustumCulled = false; group.add(m); }   // matrices change every frame
    return { fill, hull };
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  scene.add(group, shadow);
  return { group, shadow, skin, meshes };
}
const M4 = new THREE.Matrix4();
function placeCharacter(B, p, F, drawn) {
  const { N } = poseFigure(B.skin.base, p, F, drawn);
  const S = figureSegments(B.skin.base, N);
  // the figure faces +y in its own frame: turned to face its foe along the plane, its feet on the fight's ground
  B.group.position.set(p.x / 1000, PLANE, FLOOR + p.y / 1000);
  B.group.rotation.set(0, 0, p.face > 0 ? -Math.PI / 2 : Math.PI / 2);
  for (let i = 0; i < B.meshes.length; i++) {
    const m = B.meshes[i];
    if (!m) continue;
    // v' = R (v − from) + at
    const { R, from, at } = S[B.skin.seg[i]];
    const tx = at[0] - (R[0][0] * from[0] + R[0][1] * from[1] + R[0][2] * from[2]);
    const ty = at[1] - (R[1][0] * from[0] + R[1][1] * from[1] + R[1][2] * from[2]);
    const tz = at[2] - (R[2][0] * from[0] + R[2][1] * from[1] + R[2][2] * from[2]);
    M4.set(R[0][0], R[0][1], R[0][2], tx, R[1][0], R[1][1], R[1][2], ty, R[2][0], R[2][1], R[2][2], tz, 0, 0, 0, 1);
    m.fill.matrix.copy(M4); m.hull.matrix.copy(M4);
  }
  B.shadow.position.set(p.x / 1000, PLANE, FLOOR + 0.01);
  B.shadow.scale.setScalar((F.body.bodyR / 1000) * 1.8 * Math.max(0.4, 1 - p.y / 1600));
}

// ── a character PLAYED in its own body (versus-character.js `played`: a fighter throwing its own strikes) ───────────
// One skinned mesh of its parts, bound at the rest, its painted skin over it, as the World page plays a hero; each
// frame its bones are set from its own clips at the moment the sim's state names (playedClip), so what lands is the
// clip the character was made with, timed by the fight's frame data.
/** THE FIGHTERS' LIGHTS (a lit body's, once): a warm key from the camera's side above, a cool fill from the other, a rim
 * from behind and a sky over the floor, as the hero's own viewer lights it. The room's surfaces are baked, so only the
 * fighters (and a set's lit pieces) take them */
let LIT = null;
function fighterLights() {
  if (LIT) return LIT;
  LIT = new THREE.Group();
  const key = new THREE.DirectionalLight(0xfff1e0, 1.7), fill = new THREE.DirectionalLight(0xc9dcff, 0.55), rim = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-1.6, PLANE - 3.4, FLOOR + 4.2); fill.position.set(2.6, PLANE - 2.2, FLOOR + 1.6); rim.position.set(0.4, PLANE + 3.2, FLOOR + 2.8);
  for (const L of [key, fill, rim]) { L.target.position.set(0, PLANE, FLOOR + 1); LIT.add(L, L.target); }
  LIT.add(new THREE.HemisphereLight(0xdfe6ee, 0x3a332e, 0.55));
  scene.add(LIT);
  return LIT;
}
/** THE RING (an arena's `set: 'ring'`, versus-arena.js ARENA_SETS): a raised canvas on the plane, its apron, four corner
 * posts with their pads, the ropes on three sides (the camera's side open, as a ring is shot), the light on the ring
 * (a spot over the canvas) and the hall round it fallen into the dark; built once, the arena's own */
function buildRing() {
  const h = AV.half + 0.45, H = FLOOR, g = new THREE.Group();
  const mat = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
  const box = (w, d, t, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, d, t), m); b.position.set(x, y, z); g.add(b); return b; };
  box(2 * h + 0.5, 2 * h + 0.5, 0.08, 0, PLANE, H - 0.04, mat(0xd8d2c4, 0.95));                 // the canvas
  box(2 * h + 0.5, 2 * h + 0.5, H - 0.08, 0, PLANE, (H - 0.08) / 2, mat(0x17264f, 0.7));        // the apron
  const post = mat(0xbfc4cc, 0.35), pad = mat(0xb3262a, 0.6), ropeM = [mat(0xe8e8e8, 0.5), mat(0xb3262a, 0.5), mat(0x2047a6, 0.5)];
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (const [x, y] of corners) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.45, 12), post); c.rotation.x = Math.PI / 2; c.position.set(x, PLANE + y, H + 0.72); g.add(c);
    box(0.2, 0.2, 0.95, x, PLANE + y, H + 0.78, pad);
  }
  // ropes: the far side and the two ends (the near side open to the camera)
  const rope = (a, b, z, m) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), r = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, L, 8), m); r.position.set((a[0] + b[0]) / 2, PLANE + (a[1] + b[1]) / 2, z); r.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2; g.add(r); };
  [0.42, 0.8, 1.18].forEach((dz, k) => { for (const [a, b] of [[corners[2], corners[3]], [corners[1], corners[2]], [corners[3], corners[0]]]) rope(a, b, H + dz, ropeM[k]); });
  // the light on the ring, and the hall fallen into the dark: its surfaces are baked and take no fog, so a dark veil
  // hangs behind the ring's far ropes, the crowd and the walls seen through it as the shapes in the dark past the light
  const spot = new THREE.SpotLight(0xfff4e6, 2.4, 16, 0.62, 0.55, 1); spot.position.set(0, PLANE - 0.6, H + 6.5); spot.target.position.set(0, PLANE, H); g.add(spot, spot.target);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.68, depthWrite: false, side: THREE.DoubleSide }));
  veil.rotation.x = Math.PI / 2; veil.position.set(0, PLANE + h + 0.9, 12); veil.renderOrder = 2; g.add(veil);
  scene.add(g);
  fighterLights();
  return g;
}
const RING = AV.set === 'ring' ? buildRing() : null;
function makePlayed(skin) {
  const pack = skin.pack, group = new THREE.Group();
  const bones = pack.bones.map(() => { const o = new THREE.Bone(); o.matrixAutoUpdate = false; group.add(o); return o; });
  let n = 0; for (const P of pack.parts) if (P) n += P.faces * 3;
  const painted = !!(pack.paintTex && pack.parts.some((P) => P && P.uv));
  const pos = new Float32Array(n * 3), col = new Uint8Array(n * 3), jnt = new Uint16Array(n * 4), wgt = new Float32Array(n * 4), uv = painted ? new Float32Array(n * 2) : null;
  // (a LIT body, the export's: each corner's normal, and the relief's tangent where it has its normal map)
  const lit = !!pack.lit, nrm = lit ? new Float32Array(n * 3) : null, relief = !!(lit && pack.normalTex && pack.parts.every((P) => !P || P.tan));
  const tan = relief ? new Float32Array(n * 4) : null;
  let o = 0;
  for (const P of pack.parts) {
    if (!P) continue;
    const pp = decodeF32(P.pos), c = decodeU8(P.col), j = decodeU8(P.jnt), w = decodeF32(P.wgt), m = pp.length / 3;
    pos.set(pp, o * 3); col.set(c, o * 3); jnt.set(j, o * 4); wgt.set(w, o * 4);
    if (nrm && P.nrm) nrm.set(decodeF32(P.nrm), o * 3);
    if (tan) tan.set(decodeF32(P.tan), o * 4);
    if (uv) { if (P.uv) uv.set(decodeF32(P.uv), o * 2); else for (let k = 0; k < m; k++) { uv[(o + k) * 2] = pack.paintTex.white[0]; uv[(o + k) * 2 + 1] = pack.paintTex.white[1]; } }
    o += m;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(jnt, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (nrm) geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (tan) geo.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
  geo.computeBoundingSphere();
  let map = null;
  if (painted) { map = new THREE.TextureLoader().load(pack.paintTex.url); map.colorSpace = THREE.SRGBColorSpace; }
  const alpha = map && pack.paintTex.alphaMask ? { alphaTest: 0.4 } : {};
  // (lit, as an engine draws it: its albedo under the fighters' lights, its relief and its roughness from its maps; else
  // its baked light as the page packs it)
  const tex = (t) => { const x = new THREE.TextureLoader().load(t.url); x.colorSpace = THREE.NoColorSpace; return x; };
  const material = lit
    ? new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: pack.ormTex ? 1 : 0.62, metalness: 0, ...(map ? { map } : {}), ...alpha,
      ...(relief ? { normalMap: tex(pack.normalTex) } : {}), ...(pack.ormTex ? { roughnessMap: tex(pack.ormTex) } : {}) })
    : new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, ...(map ? { map } : {}), ...alpha });
  if (lit) fighterLights();
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.frustumCulled = false;
  group.add(mesh); scene.add(group);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  scene.add(shadow);
  return { group, shadow, skin, played: true, bones, mesh };
}
/** the clip and its phase (0 … 1) a fighter's state shows: its move's own clip at the frame's share of it; a blow taken
 * or blocked in its guard through the stun; its knockdown; otherwise its guard, held. null: it has no clip of it (a
 * tradition's move, a throw, a special; a tradition's fighter's every state), and the fight's own pose drives its body */
function playedClip(p, F, clips) {
  const has = (k) => !!clips[k];
  if (p.mv) {
    const mv = F.moves[p.mv], fr = mv && mv.frames[Math.max(1, Math.min(p.mf, mv.total))];
    if (mv && mv.hero && has(mv.id)) return [mv.id, fr && fr.u !== undefined ? fr.u : p.mf / mv.total];
    // (a move it has no clip of, a tradition's, a throw or a special: the fight's own pose, on its body)
    return null;
  }
  const r = p.rx || { k: 'hit', h: 1 }, stunT = p.sf / Math.max(1, p.sf + (p.stun || 0));
  switch (p.st) {
    case 'hit': {
      const k = r.k === 'crush' ? 'guardStagger' : p.low || r.h === 2 ? 'guardHitLow' : r.h === 0 ? 'guardHitHigh' : 'guardHitBody';
      if (has(k)) return [k, stunT];
      break;
    }
    case 'block': { const k = p.low && has('blockBody') ? 'blockBody' : 'block'; if (has(k)) return [k, stunT]; break; }
    case 'fall': case 'ko': if (has('knockedOutDown')) return ['knockedOutDown', Math.min(1, p.sf / 40)]; break;
    case 'down': if (has('knockedOutDown')) return ['knockedOutDown', 1]; break;
    case 'rise': if (has('knockedOutUp')) return ['knockedOutUp', Math.min(1, p.sf / 20)]; break;
    default: break;
  }
  // (its guard held where it was made with its own strikes; a tradition's fighter stands, walks and falls as the fight
  // poses it)
  return has('guard') && Object.values(F.moves).some((m) => m.hero) ? ['guard', 1] : null;
}
const PQ = new THREE.Quaternion(), PQ2 = new THREE.Quaternion(), PV = new THREE.Vector3(), PH = new THREE.Vector3(), PONE = new THREE.Vector3(1, 1, 1);
/** one bone's rotation and head from a clip at a phase (its keys' frame pair, as the World page samples a hero's) */
function playedBone(pack, clip, phase, bi, outQ, outP) {
  const bone = pack.bones[bi];
  if (!clip) { outQ.set(0, 0, 0, 1); outP.set(bone.head[0], bone.head[1], bone.head[2]); return; }
  const nb = pack.bones.length, K = clip.k, B = clip.b;
  let i0, i1, t;
  if (clip.once) { const kf = Math.min(1, Math.max(0, phase)) * (K - 1); i0 = Math.min(K - 1, Math.floor(kf)); i1 = Math.min(K - 1, i0 + 1); t = kf - i0; }
  else { const kf = (((phase % 1) + 1) % 1) * K; i0 = Math.floor(kf) % K; i1 = (i0 + 1) % K; t = kf - Math.floor(kf); }
  const o0 = (i0 * nb + bi) * 7, o1 = (i1 * nb + bi) * 7;
  const sg = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (sg * B[o1] - B[o0]) * t, B[o0 + 1] + (sg * B[o1 + 1] - B[o0 + 1]) * t, B[o0 + 2] + (sg * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (sg * B[o1 + 3] - B[o0 + 3]) * t).normalize();
  outP.set(B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t, B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t, B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t);
}
// (the clips whose root travel the fight carries itself: a knockdown is flown by the sim's fall, so its clip's slide
// across the floor, which ends at its origin and so starts 0.8 m ahead, inside the opponent, is taken off)
const PINNED = { knockedOutDown: 1, knockedOutUp: 1 };
const PR = new THREE.Vector3();
const GM = new THREE.Matrix4(), GF = new THREE.Matrix4(), GQ = new THREE.Quaternion(), GH = new THREE.Vector3(), GV = new THREE.Vector3();
/** a bone's clip transform as a matrix (M·v = head' + q·(v − restHead)) */
function clipMatrix(pack, clip, phase, bi, out) {
  playedBone(pack, clip, phase, bi, GQ, GH);
  const h = pack.bones[bi].head;
  GV.set(h[0], h[1], h[2]).applyQuaternion(GQ);
  return out.compose(GV.set(GH.x - GV.x, GH.y - GV.y, GH.z - GV.z), GQ, PONE);
}
/** a played body POSED BY THE FIGHT (a move or a state it has no clip of): each bone riding its segment of the figure
 * (versus-figure.js), as the posed character's parts do, skinned; a hand's bones (the wrist's, the fingers') as its
 * guard clip holds them on its forearm, so a fist stays a fist */
function placeFromPose(B, p, F, drawn) {
  const pack = B.skin.pack, S = figureSegments(B.skin.base, poseFigure(B.skin.base, p, F, drawn).N), guard = pack.clips.guard;
  const fore = {};
  if (guard) for (let bi = 0; bi < B.bones.length; bi++) if (/^foreArm[LR]$/.test(pack.bones[bi].id)) fore[pack.bones[bi].id] = clipMatrix(pack, guard, 1, bi, new THREE.Matrix4()).invert();
  for (let bi = 0; bi < B.bones.length; bi++) {
    const sg = B.skin.seg[bi], { R, from, at } = S[sg];
    const tx = at[0] - (R[0][0] * from[0] + R[0][1] * from[1] + R[0][2] * from[2]);
    const ty = at[1] - (R[1][0] * from[0] + R[1][1] * from[1] + R[1][2] * from[2]);
    const tz = at[2] - (R[2][0] * from[0] + R[2][1] * from[1] + R[2][2] * from[2]);
    const M = B.bones[bi].matrix.set(R[0][0], R[0][1], R[0][2], tx, R[1][0], R[1][1], R[1][2], ty, R[2][0], R[2][1], R[2][2], tz, 0, 0, 0, 1);
    // (the hand on its forearm as the guard has it: posed forearm · guard forearm⁻¹ · guard hand)
    const inv = B.skin.hand[bi] && fore[sg];
    if (inv) M.multiply(GF.copy(inv).multiply(clipMatrix(pack, guard, 1, bi, GM)));
  }
}
function placePlayed(B, p, F, drawn) {
  const pack = B.skin.pack, pick = playedClip(p, F, pack.clips);
  B.group.position.set(p.x / 1000, PLANE, FLOOR + p.y / 1000);
  B.group.rotation.set(0, 0, p.face > 0 ? -Math.PI / 2 : Math.PI / 2);
  if (!pick || !pack.clips[pick[0]]) {
    placeFromPose(B, p, F, drawn);
    B.group.updateMatrixWorld(true);
    B.shadow.position.set(p.x / 1000, PLANE, FLOOR + 0.01);
    B.shadow.scale.setScalar((F.body.bodyR / 1000) * 1.8 * Math.max(0.4, 1 - p.y / 1600));
    return;
  }
  const [name, phase] = pick, clip = pack.clips[name];
  let rx = 0, ry = 0;
  if (PINNED[name]) { playedBone(pack, clip, phase, 0, PQ, PR); rx = PR.x - pack.bones[0].head[0]; ry = PR.y - pack.bones[0].head[1]; }
  for (let bi = 0; bi < B.bones.length; bi++) {
    playedBone(pack, clip, phase, bi, PQ, PH);
    PH.x -= rx; PH.y -= ry;
    // M·v = head' + q·(v − restHead)
    const h = pack.bones[bi].head;
    PV.set(h[0], h[1], h[2]).applyQuaternion(PQ);
    B.bones[bi].matrix.compose(PV.set(PH.x - PV.x, PH.y - PV.y, PH.z - PV.z), PQ, PONE);
  }
  B.group.updateMatrixWorld(true);
  B.shadow.position.set(p.x / 1000, PLANE, FLOOR + 0.01);
  B.shadow.scale.setScalar((F.body.bodyR / 1000) * 1.8 * Math.max(0.4, 1 - p.y / 1600));
}
const placeFighter = (B, p, F, drawn) => (B.played ? placePlayed(B, p, F, drawn) : B.skin ? placeCharacter(B, p, F, drawn) : placeBody(B, p, F, drawn));

// ── the fight ────────────────────────────────────────────────────────────────────────────────────────────────

const ROSTER = AV.roster.map((r) => ({ ...r, F: compileFighter(r.recipe) }));
let match = null, bodies = [], phase = 'wait', waited = 0, pauseIx = 0, pauseBy = 0, lastParams = null;

installVersusInput((code) => { if (code === 'KeyR' && match && match.mode === 'training') RT.dummy = (RT.dummy + 1) % VS_DUMMY.length; });

function defaults() {
  const a = ROSTER[0], b = ROSTER[Math.min(1, ROSTER.length - 1)];
  return { fighters: [a.recipe, b.recipe], names: [a.name, b.name], colors: [a.color, a.id === b.id ? '#e8e8e8' : b.color], characters: [a.character || null, b.character || null], schemes: ['modern', 'modern'], mode: 'cpu', level: 1, seed: 1 };
}

function begin(params) {
  lastParams = params;
  for (const B of bodies) scene.remove(B.group, B.shadow);
  const fighters = params.fighters.map((r) => compileFighter(r));
  const rules = hostedRules(AV.rules, params.rules, Math.round(AV.half * 1000));
  match = newMatch({ fighters, names: params.names, colors: params.colors, schemes: params.schemes, mode: params.mode, level: params.level, cpu: params.cpu, rules, seed: params.seed ?? 1 });
  bodies = params.colors.map((c, i) => {
    const skin = skinOf(params.characters && params.characters[i]);
    return skin ? (skin.pack.played ? makePlayed(skin) : makeCharacter(skin)) : makeBody(c, fighters[i]);
  });
  phase = 'fight';
}

function post(msg) { if (hosted) window.parent.postMessage(msg, '*'); }

if (hosted) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.moj !== AV.wire.init || d.contractVersion !== AV.wire.version) return;
    if (d.params && d.params.versus) begin(d.params.versus);
  });
  post({ moj: AV.wire.ready, contractVersion: AV.wire.version, levelRef: 'versus' });
}

function tick() {
  const inp = menuInput();
  const any = (k) => inp[0][k] || inp[1][k];
  if (phase === 'wait') {
    // hosted, a versus game sends its picks; on its own (or if none come) the arena's first two fight
    if (!hosted || ++waited > 90) begin(defaults());
    return;
  }
  if (phase === 'paused') {
    // the menu is the seat's that opened it: only that player's controller moves it
    const own = (k) => inp[pauseBy][k];
    if (own('up') || own('down')) pauseIx = 1 - pauseIx;
    if (own('ok')) {
      if (pauseIx === 0) phase = 'fight';
      else if (hosted) { post({ moj: AV.wire.outcome, envelope: { contractVersion: AV.wire.version, result: 'abort', events: [] } }); phase = 'done'; }
      else begin(lastParams);
    }
    return;
  }
  if (phase === 'over') {
    if (any('ok')) begin(lastParams);
    return;
  }
  if (phase !== 'fight') return;
  if ((inp[0].pause || inp[1].pause) && match.s.phase !== 'matchEnd') { phase = 'paused'; pauseIx = 0; pauseBy = inp[0].pause ? 0 : 1; return; }
  if (match.slow > 0) { match.slow--; if (match.slow % 3) return; }
  stepMatch(match);
  if (match.end === 150) {
    const s = match.s;
    if (hosted) {
      post({ moj: AV.wire.outcome, envelope: { contractVersion: AV.wire.version, result: s.winner === 0 ? 'success' : 'fail', events: [], stats: { versus: { winner: s.winner, wins: s.wins } } } });
      phase = 'done';
    } else phase = 'over';
  }
}

function frameCamera() {
  const s = match.s;
  const aspect = (OW || 16) / (OH || 9);
  const tanH = Math.tan((VFOV * Math.PI) / 360) * aspect;
  const sep = Math.abs(s.p[0].x - s.p[1].x) / 1000;
  // the genre's framing: a body near half the picture's height, both in frame with room to move (on a set, nearer: a
  // fighter near two thirds of it, shown as it was made)
  const want = RING ? Math.max(3.6, Math.min(6, (sep + 2.2) / (2 * tanH))) : Math.max(5.8, Math.min(9, (sep + 3.4) / (2 * tanH)));
  cam.dist += (want - cam.dist) * 0.12;
  const halfView = cam.dist * tanH;
  const lim = Math.max(0, AV.half + 0.8 - halfView);
  const mid = (s.p[0].x + s.p[1].x) / 2000;
  cam.x += (Math.max(-lim, Math.min(lim, mid)) - cam.x) * 0.15;
  const shake = match.shake > 0 ? Math.sin(match.t * 2.3) * match.shake * 0.006 : 0;
  if (camera.fov !== VFOV) { camera.fov = VFOV; camera.updateProjectionMatrix(); }
  camera.position.set(cam.x + shake, PLANE - cam.dist, FLOOR + (RING ? 1.1 : 1.25) + cam.dist * 0.05);
  camera.lookAt(cam.x + shake, PLANE, FLOOR + (RING ? 0.95 : 1.05));
}

const vP = new THREE.Vector3();
function toScreen(xmm, ymm) {
  vP.set(xmm / 1000, PLANE, FLOOR + ymm / 1000).project(camera);
  return [((vP.x + 1) / 2) * OW, ((1 - vP.y) / 2) * OH];
}

/** where each body is drawn: where the fight has it, but a body held in a throw (boxing's clinch) drawn back to where
 * the two push boxes touch, since the fight holds it a fixed 36 cm off the thrower's pelvis, inside a real body's chest */
function drawnAt(s, ctx) {
  const t = s.p.findIndex((p) => p.st === 'throwing');
  if (t < 0 || s.p[1 - t].st !== 'thrown') return s.p;
  const a = s.p[t], o = s.p[1 - t], pa = pushBox(a, ctx.fighters[t]), po = pushBox(o, ctx.fighters[1 - t]);
  const over = a.face > 0 ? pa[2] - po[0] : po[2] - pa[0];
  if (over <= 0) return s.p;
  const out = s.p.slice(); out[1 - t] = { ...o, x: o.x + a.face * over };
  return out;
}

function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!match) { vsOutlined(g2, 'GET READY', OW / 2, OH / 2, 40, '#fff'); return; }
  frameCamera();
  const s = match.s;
  const at = drawnAt(s, match.ctx);
  for (let i = 0; i < 2; i++) placeFighter(bodies[i], at[i], match.ctx.fighters[i], drawnPose(match, i));
  const S = OH / (2 * cam.dist * Math.tan((VFOV * Math.PI) / 360)) / 1000;
  drawEffects(g2, match, toScreen, S);
  drawHud(g2, OW, OH, match);
  if (phase === 'paused') {
    g2.fillStyle = 'rgba(0,0,0,0.65)'; g2.fillRect(0, 0, OW, OH);
    vsOutlined(g2, 'PAUSED', OW / 2, OH * 0.3, 54, '#fff');
    ['Resume', hosted ? 'Quit to character select' : 'Restart'].forEach((it, k) => vsText(g2, it, OW / 2, OH * 0.45 + k * 50, 24, k === pauseIx ? '#ffd23a' : '#fff'));
  }
  if (phase === 'over') vsOutlined(g2, 'PRESS START TO FIGHT AGAIN', OW / 2, OH * 0.62, 28, '#ffd23a');
}

// the page calls this from its frame step with its (pause-rebased) clock in MILLISECONDS (scene-three.js `__mojStep`, as
// fx reads it); the fight steps at 60 Hz (read as seconds, a frame's 16 ms had been capped at 0.1 s: six fight frames a
// drawn frame, the fight at six times its speed)
let fightAcc = 0, fightLast = null;
function stepArenaFight(ms) {
  const t = ms / 1000;
  if (fightLast === null) fightLast = t;
  fightAcc += Math.min(0.1, Math.max(0, t - fightLast));
  fightLast = t;
  let ticked = false;
  while (fightAcc >= 1 / 60) { fightAcc -= 1 / 60; tick(); ticked = true; }
  if (ticked) endInputFrame();
  draw();
}

window.__mojVersus = { get match() { return match; }, get phase() { return phase; }, get bodies() { return bodies; }, ROSTER };
