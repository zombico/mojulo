/**
 * brawl yard client — the practice room in the browser: the yard's room (brawl-practice.js) stepped at 60 a second from
 * the seats' buttons, drawn in the round on the world's level, under the belt's locked camera, its readouts in mana-ui
 * (brawl-yard.js's screen). Inlined by the brawl channel after the fight's and the brawl's pure modules, so every name it
 * uses is theirs or the page's (THREE, scene, camera, controls).
 *
 * What it draws: each body as the fight draws its fighters (the move's pose or the reaction's, jointed by the fight's rig
 * and stood in the round by its figure, versus-figure.js), a CHARACTER in its own body (PLAYED: its own clips where it has
 * one for what it is doing, its bones riding the figure's segments where it has none; or posed, its parts riding them),
 * anyone else as the fight's stick figure, all in the yard's REGISTER where it has one (the fight's look: cel or lit
 * under one key that casts), on the belt: along it the body's x, across it its z; the
 * street's things; a held BLADE along the line the sim strikes with (its weapon's, versus-rig.js weaponLine), in the
 * weapon's colour; each player's LINE on the floor (the strip a blow must share, the yard's first lesson); a flash where a
 * blow lands; the fight's sounds by event where the page carries them.
 *
 * ON THE RANGE (the run & gun's practice room, `BRAWL_YARD.range`): the guns passed in, the one held first (the settings'
 * Gun); each round drawn as it flies (a tracer along its flight, warm a player's, hot red a foe's, its shadow on the
 * street so its depth reads), a foe's warning as a thin line along its aim, the gun out in the hand, a flash at the
 * muzzle and a burst where a rocket or a grenade lands; the gunner's buttons (fire, aim, plant, roll, jump, grenade).
 * Its SOUNDS each gun's own (its shot, its landing; brawl-sfx.js), a foe's round whizzing past close, a gun run dry, a
 * magazine seated; its IMPACT FRAMES (a gun's `impact`: a burst, a heavy round's flinch) the picture flashed a few
 * frames, inverted in the anime register, white otherwise.
 * Its keys (the brawl scheme, controls/schemes.js): the stick, attack, strong, jump, special; start the practice settings, back
 * the move list; R a reset. A second controller pressing attack or start drops in as the next player (four at most).
 */
/* global BRAWL_YARD, THREE, THINGS, MOUNTS, scene, camera, controls, renderer, wrap, manaUi, decodeF32, decodeU8, characterBase, figureSegments, segmentOf, __BR_CTL, __BR_DEV, __BR_BIND, __BR_SEATK, practiceOf, stepYard, resetYard, yardRead, brawlMoveList, rangeMoveList, aimVector, gunShape, brawlPoseOf, rigJoints, weaponLine, figureBase, figurePose, beltCamera, beltPoint, viewHalf, yardHud, inputRun, BRAWL_RULES, PRACTICE_MODE_IDS */
const BY = BRAWL_YARD;
const BELT = BY.belt;
controls.enabled = false;
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the yard
// the stage in the belt's frame: x along it, y across it (toward the far side), z up, from its start
const YARD = new THREE.Group();
YARD.position.set(BELT.at[0], BELT.at[1], BELT.floor);
YARD.rotation.z = (BELT.heading * Math.PI) / 180;
scene.add(YARD);

// ── the register (the fight's look, versus-arena.client.js fightRig): every body drawn the one way under one key ─────
// 'anime' cel, three tones stepped from the key, its shadows stepped and cool; 'western' lit as an engine lights it, its
// shadows soft. The key from the greybox's own sun where the yard carries it (the room and the bodies share a light), else
// the camera's side above; a cool fill, a rim from behind, a sky; a catcher over the street's floor takes the shadows. The
// key and its shadow's box follow the camera along the belt. A yard with no register lights its bodies as it always did.
const REGISTER = BY.register === 'anime' || BY.register === 'western' ? BY.register : null;
const MID = (BELT.depth[0] + BELT.depth[1]) / 2;
function yardRig(register) {
  const toon = register === 'anime', KEY_DIR = new THREE.Vector3(), KEY_TO = new THREE.Vector3();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = toon ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const g = new THREE.Group();
  if (BY.sun) KEY_DIR.set(BY.sun[0], BY.sun[1], BY.sun[2]).normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), (-BELT.heading * Math.PI) / 180);
  else KEY_DIR.set(-0.35, -0.6, 0.72).normalize();
  const key = new THREE.DirectionalLight(toon ? 0xfff6ea : 0xffeedb, toon ? 2.4 : 3.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  // (the shadow's box: the screen's width, the bodies spread across it, and the band)
  const box = viewHalf(BELT) + 1.5, sc = key.shadow.camera;
  sc.left = -box; sc.right = box; sc.top = box; sc.bottom = -box; sc.near = 0.5; sc.far = 30;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  if (!toon) key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xb9ccff, toon ? 0 : 0.28), rim = new THREE.DirectionalLight(0xffffff, toon ? 0.7 : 1.3);
  g.add(key, key.target, fill, fill.target, rim, rim.target, toon ? new THREE.HemisphereLight(0xc6d2ff, 0x5c5068, 0.75) : new THREE.HemisphereLight(0xdfe7f2, 0x2e2925, 0.3));
  const span = BELT.depth[1] - BELT.depth[0];
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(BELT.length + 12, span + 6), new THREE.ShadowMaterial({ color: toon ? 0x1c1830 : 0x000000, opacity: toon ? 0.6 : 0.55 }));
  catcher.position.set(BELT.length / 2, MID, 0.004); catcher.receiveShadow = true; catcher.renderOrder = 1;
  g.add(catcher);
  YARD.add(g);
  const ramp = toon ? new THREE.DataTexture(new Uint8Array([92, 92, 92, 255, 165, 165, 165, 255, 255, 255, 255, 255]), 3, 1) : null;
  if (ramp) { ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true; }
  return {
    toon,
    follow(x) {
      KEY_TO.set(x, MID, 1); key.target.position.copy(KEY_TO); key.position.copy(KEY_TO).addScaledVector(KEY_DIR, 12);
      fill.target.position.copy(KEY_TO); fill.position.set(x + 2.8, MID - 2.4, 1.4);
      rim.target.position.copy(KEY_TO); rim.position.set(x + 0.6, MID + 3.4, 3);
    },
    material(o) {
      return toon ? new THREE.MeshToonMaterial({ side: THREE.DoubleSide, gradientMap: ramp, ...o })
        : new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.62, metalness: 0, ...o });
    },
  };
}
const RIG = REGISTER ? yardRig(REGISTER) : null;
const castOn = (m) => { if (RIG) { m.castShadow = true; m.receiveShadow = true; } return m; };
const footShadow = () => new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: RIG ? 0.2 : 0.3, depthWrite: false }));

// ── the room ─────────────────────────────────────────────────────────────────────────────────────────────────

const cap = (w) => w[0].toUpperCase() + w.slice(1);
const FIRST = BY.dummies[0] || {};
const RANGE = BY.range || null;
const SET = { gun: RANGE ? RANGE.names[0] : null, waves: !!((RANGE && RANGE.waves) || BY.waves), mode: FIRST.mode ? FIRST.mode[0].toUpperCase() + FIRST.mode.slice(1) : 'Stand', type: Number.isInteger(FIRST.roster) ? BY.roster[FIRST.roster].name : FIRST.type ? FIRST.type[0].toUpperCase() + FIRST.type.slice(1) : 'Thug', count: '3', health: BY.health === 'refill' ? 'Refill' : 'Chains', fighter: BY.roster[BY.players[0] ?? 0].name, marks: true, log: true };
let picks = BY.players.slice(0, 4);
let dummies = BY.dummies;
let room = null, bodies = [], things = new Map(), rounds = new Map(), t = 0;
const runs = [];
function dummiesOf() {
  const n = Number(SET.count) || 1, mode = SET.mode.toLowerCase();
  // (a type of the street's crowd, or one of the roster: a character fought as a dummy, in its own body)
  const k = BY.roster.findIndex((r) => r.name === SET.type);
  if (k >= 0) return Array.from({ length: n }, () => ({ mode, recipe: BY.roster[k].recipe, roster: k }));
  return Array.from({ length: n }, () => ({ mode, type: mode === 'grab' ? 'heavy' : SET.type.toLowerCase() }));
}
function build() {
  for (const B of bodies) { YARD.remove(B.group, B.shadow, B.line); if (B.blade) YARD.remove(B.blade.fill, B.blade.ink); if (B.gun) YARD.remove(B.gun.barrel.fill, B.gun.barrel.ink, B.gun.mag.fill, B.gun.mag.ink, B.gun.warn); }
  // (on the range, the gun chosen held first)
  const g = RANGE ? Math.max(0, RANGE.names.indexOf(SET.gun)) : 0;
  // (its waves while the settings' Waves is on)
  const range = RANGE ? { range: { guns: [RANGE.guns[g], ...RANGE.guns.filter((_, k) => k !== g)], grenades: RANGE.grenades, ...(RANGE.waves && SET.waves ? { waves: RANGE.waves, loop: RANGE.loop } : {}) } } : {};
  // (the brawler yard's own waves while the settings' Waves is on)
  const melee = !RANGE && BY.waves && SET.waves ? { waves: BY.waves, loop: BY.loop } : {};
  room = practiceOf({ belt: BELT, players: picks.map((i) => ({ recipe: BY.roster[i].recipe, style: BY.roster[i].style })), dummies, things: BY.things, health: SET.health.toLowerCase(), ...range, ...melee });
  for (const m of rounds.values()) YARD.remove(m.tracer, m.shadow);
  rounds.clear();
  // (who each body is: a player's roster pick, a dummy's roster entry when it names one, else a thug of the street's)
  const entryOf = (i) => (i < picks.length ? BY.roster[picks[i]] : Number.isInteger(dummies[i - picks.length]?.roster) ? BY.roster[dummies[i - picks.length].roster] : null);
  bodies = room.s.bodies.map((b, i) => {
    const E = entryOf(i), skin = skinOf(E && E.character), player = i < picks.length;
    const B = skin ? (skin.pack.played ? makePlayed(skin) : makeCharacter(skin)) : makeBody(E ? E.color : '#9a8f86', room.ctx.fighters[b.fi], false);
    if (player) B.line = lineOf(E.color);
    return B;
  });
  for (const m of things.values()) YARD.remove(m);
  things.clear();
  runs.length = 0;
}

// ── the bodies (the fight's stick figure in the round, versus-arena.client.js's) ────────────────────────────

const worldOf = (p, n, out) => out.set(p.x / 1000 + p.face * n[1], p.z / 1000 - p.face * n[0], p.y / 1000 + n[2]);
const BLADE_OF = { fall: 0, ko: 0, down: 0, thrown: 0, held: 0.4, rise: 0.4, hit: 0.5 };
// the light baked into the geometry's colours (the greybox world is drawn unlit, by its faces' own shading)
function shaded(geo) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const k = 0.5 + 0.5 * Math.max(0, n.getX(i) * -0.35 + n.getY(i) * -0.55 + n.getZ(i) * 0.76);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const CYL = shaded(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2));
const BALL = shaded(new THREE.SphereGeometry(1, 14, 10));
const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const LIMBS = [
  ['pelvisHub', 'neckHub', 1.7], ['shoulderL', 'shoulderR', 0.9], ['hipL', 'hipR', 0.9],
  ...['L', 'R'].flatMap((S) => [[`shoulder${S}`, `elbow${S}`, 1], [`elbow${S}`, `fist${S}`, 1], [`hip${S}`, `knee${S}`, 1.15], [`knee${S}`, `ankle${S}`, 1], [`ankle${S}`, `toe${S}`, 0.8]]),
];
const JOINTS = [['pelvisHub', 1.6], ...['L', 'R'].flatMap((S) => [[`shoulder${S}`, 1.2], [`elbow${S}`, 1], [`fist${S}`, 1.5], [`knee${S}`, 1.1], [`ankle${S}`, 1]])];
const farOf = (name, face) => { const S = name.slice(-1); return (S === 'L' && face > 0) || (S === 'R' && face < 0); };
// (under the register, the rig's surface; without one, the colour over the baked shading)
function lambert(color) { return RIG ? RIG.material({ color }) : new THREE.MeshBasicMaterial({ color, vertexColors: true }); }
function makeBody(color, F, player) {
  const near = lambert(color), far = lambert(new THREE.Color(color).multiplyScalar(0.6));
  const group = new THREE.Group();
  const part = (geo, mat) => { const fill = castOn(new THREE.Mesh(geo, mat)), ink = new THREE.Mesh(geo, INK); group.add(fill, ink); return { fill, ink }; };
  const limbs = LIMBS.map(([a, b, w]) => ({ a, b, w, ...part(CYL, near) }));
  const joints = JOINTS.map(([j, w]) => ({ j, w, ...part(BALL, near) }));
  const head = part(BALL, near);
  const shadow = footShadow();
  YARD.add(group, shadow);
  return { group, limbs, joints, head, shadow, line: null, near, far, base: figureBase(F.body), drawn: null };
}
// a player's LINE: the strip along the street a blow must share (the core's `line` each side of its body)
function lineOf(color) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
  YARD.add(line);
  return line;
}

// ── a character in its own body (versus-arena.client.js's posed character): its parts, relit by the yard's key as it
// turns (the rest light its pack baked in taken back out by the face's rest normal) and inked, each riding its segment
// of the fight's figure ──
const SKINS = {};
function skinOf(ref) {
  const pack = ref && BY.bodies && BY.bodies[ref];
  if (!pack || !pack.parts) return null;
  // (a played body samples its clips, and rides the segments where it has none for what the yard is doing: its hands,
  // the fingers' and the wrist's, kept as its guard holds them)
  return SKINS[ref] || (SKINS[ref] = { pack, base: characterBase(pack.bones), seg: pack.bones.map((b) => segmentOf(b.id)), ...(pack.played ? { hand: pack.bones.map((b) => /^foreArm[LR]$/.test(segmentOf(b.id)) && !/^(foreArm|elbowFold)[LR]?$/.test(b.id)) } : {}) });
}
const REST_KEY = new THREE.Vector3(0.35, -0.55, 0.75).normalize();
// the yard's key: from the camera's side and above, in the belt's frame turned into the world's
const WORLD_KEY = new THREE.Vector3(-0.35, -0.6, 0.72).normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), (BELT.heading * Math.PI) / 180);
function smoothNormals(pos) {
  const acc = new Map(), n = new Float32Array(pos.length), key = (i) => `${Math.round(pos[i] * 2e4)},${Math.round(pos[i + 1] * 2e4)},${Math.round(pos[i + 2] * 2e4)}`;
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    const f = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    for (let k = 0; k < 9; k += 3) { const kk = key(i + k), v = acc.get(kk) || [0, 0, 0]; v[0] += f[0]; v[1] += f[1]; v[2] += f[2]; acc.set(kk, v); }
  }
  for (let i = 0; i < pos.length; i += 3) { const v = acc.get(key(i)), l = Math.hypot(v[0], v[1], v[2]) || 1; n[i] = v[0] / l; n[i + 1] = v[1] / l; n[i + 2] = v[2] / l; }
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
  mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * 0.0110;'); };
  return mat;
}
function makeCharacter(skin) {
  // (under the register drawn its one way, as every body is: the rig's surface over its albedo, casting, no ink hull)
  const group = new THREE.Group(), lit = RIG ? RIG.material({ vertexColors: true }) : litMaterial(), ink = RIG ? null : inkMaterial();
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
    const fill = castOn(new THREE.Mesh(geo, lit)), hull = ink ? new THREE.Mesh(geo, ink) : null;
    for (const m of [fill, hull]) if (m) { m.matrixAutoUpdate = false; m.frustumCulled = false; group.add(m); }   // matrices change every frame
    return { fill, hull };
  });
  const shadow = footShadow();
  YARD.add(group, shadow);
  return { group, shadow, skin, meshes, line: null, base: skin.base, drawn: null };
}
const M4 = new THREE.Matrix4();
function placeCharacter(B, p, F, N) {
  const S = figureSegments(B.skin.base, N);
  // the figure faces +y in its own frame: turned to face the way the body faces along the belt, its feet on the floor
  B.group.position.set(p.x / 1000, p.z / 1000, p.y / 1000);
  B.group.rotation.set(0, 0, p.face > 0 ? -Math.PI / 2 : Math.PI / 2);
  for (let i = 0; i < B.meshes.length; i++) {
    const m = B.meshes[i];
    if (!m) continue;
    const { R, from, at } = S[B.skin.seg[i]];
    const tx = at[0] - (R[0][0] * from[0] + R[0][1] * from[1] + R[0][2] * from[2]);
    const ty = at[1] - (R[1][0] * from[0] + R[1][1] * from[1] + R[1][2] * from[2]);
    const tz = at[2] - (R[2][0] * from[0] + R[2][1] * from[1] + R[2][2] * from[2]);
    M4.set(R[0][0], R[0][1], R[0][2], tx, R[1][0], R[1][1], R[1][2], ty, R[2][0], R[2][1], R[2][2], tz, 0, 0, 0, 1);
    m.fill.matrix.copy(M4); if (m.hull) m.hull.matrix.copy(M4);
  }
}

// ── a character PLAYED in its own body (versus-arena.client.js's): one skinned mesh of its parts, its painted skin over
// it; each frame its bones set from its own clip at the moment the yard's state names (yardClip), or riding the figure's
// segments where it has no clip for it (the brawl's own: walking the street, a hold, being held, a pick-up, a throw) ──
function makePlayed(skin) {
  const pack = skin.pack, group = new THREE.Group();
  const bones = pack.bones.map(() => { const o = new THREE.Bone(); o.matrixAutoUpdate = false; group.add(o); return o; });
  let n = 0; for (const P of pack.parts) if (P) n += P.faces * 3;
  const painted = !!(pack.paintTex && pack.parts.some((P) => P && P.uv));
  const pos = new Float32Array(n * 3), col = new Uint8Array(n * 3), jnt = new Uint16Array(n * 4), wgt = new Float32Array(n * 4), uv = painted ? new Float32Array(n * 2) : null;
  const lit = !!pack.lit, nrm = lit ? new Float32Array(n * 3) : null, relief = !!(lit && pack.normalTex && pack.parts.every((P) => !P || P.tan));
  const tan = relief ? new Float32Array(n * 4) : null;
  let o = 0;
  for (const P of pack.parts) {
    if (!P) continue;
    const pp = decodeF32(P.pos), m = pp.length / 3;
    pos.set(pp, o * 3); col.set(decodeU8(P.col), o * 3); jnt.set(decodeU8(P.jnt), o * 4); wgt.set(decodeF32(P.wgt), o * 4);
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
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm || smoothNormals(pos), 3));
  if (tan) geo.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
  geo.computeBoundingSphere();
  let map = null;
  if (painted) { map = new THREE.TextureLoader().load(pack.paintTex.url); map.colorSpace = THREE.SRGBColorSpace; }
  const alpha = map && pack.paintTex.alphaMask ? { alphaTest: 0.4 } : {};
  const tex = (t) => { const x = new THREE.TextureLoader().load(t.url); x.colorSpace = THREE.NoColorSpace; return x; };
  // (under the register the rig's surface over its albedo, its relief and roughness where lit; else its baked light,
  // relit by the yard's key as a posed body is)
  const material = RIG
    ? RIG.material({ vertexColors: true, ...(map ? { map } : {}), ...alpha, ...(!RIG.toon && relief ? { normalMap: tex(pack.normalTex) } : {}), ...(!RIG.toon && pack.ormTex ? { roughness: 1, roughnessMap: tex(pack.ormTex) } : {}) })
    : new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, ...(map ? { map } : {}), ...alpha });
  const mesh = castOn(new THREE.SkinnedMesh(geo, material));
  mesh.frustumCulled = false;
  group.add(mesh); YARD.add(group);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())));
  const shadow = footShadow();
  YARD.add(shadow);
  return { group, shadow, skin, played: true, bones, mesh, line: null, base: skin.base, drawn: null };
}
// the states a played body shows by its own clips (the fight's: a blow, a reaction, a fall, the guard); the brawl's own
// (walking, a hold, held, a pick-up, a throw, a jump with no blow) are posed by the yard on its body
const CLIPPED = { stand: 1, hit: 1, fall: 1, ko: 1, down: 1, rise: 1 };
/** the clip and its phase a body's state shows (versus-arena.client.js playedClip), or null: posed on its body */
function yardClip(p, F, clips) {
  const has = (k) => !!clips[k];
  // (a gunner holds its rifle as the figure poses it; its reactions are still its clips')
  if (p.gn !== undefined && !REELING.has(p.st)) return null;
  if (p.mv) {
    const mv = F.moves[p.mv], fr = mv && mv.frames && mv.frames[Math.max(1, Math.min(p.mf, mv.total))];
    return mv && mv.hero && has(mv.id) ? [mv.id, fr && fr.u !== undefined ? fr.u : p.mf / mv.total] : null;
  }
  if (!CLIPPED[p.st]) return null;
  const r = p.rx || { k: 'hit', h: 1 }, stunT = p.sf / Math.max(1, p.sf + (p.stun || 0));
  switch (p.st) {
    case 'hit': { const k = r.k === 'crush' ? 'guardStagger' : p.low || r.h === 2 ? 'guardHitLow' : r.h === 0 ? 'guardHitHigh' : 'guardHitBody'; return has(k) ? [k, stunT] : null; }
    case 'fall': case 'ko': return has('knockedOutDown') ? ['knockedOutDown', Math.min(1, p.sf / 40)] : null;
    case 'down': return has('knockedOutDown') ? ['knockedOutDown', 1] : null;
    case 'rise': return has('knockedOutUp') ? ['knockedOutUp', Math.min(1, p.sf / 20)] : null;
    default: return has('guard') && Object.values(F.moves).some((m) => m.hero) ? ['guard', 1] : null;
  }
}
const PQ = new THREE.Quaternion(), PV = new THREE.Vector3(), PH = new THREE.Vector3(), PR = new THREE.Vector3(), PONE = new THREE.Vector3(1, 1, 1);
/** one bone's rotation and head from a clip at a phase (its keys' frame pair) */
function playedBone(pack, clip, phase, bi, outQ, outP) {
  const bone = pack.bones[bi];
  if (!clip) { outQ.set(0, 0, 0, 1); outP.set(bone.head[0], bone.head[1], bone.head[2]); return; }
  const nb = pack.bones.length, K = clip.k, B = clip.b;
  let i0, i1, u;
  if (clip.once) { const kf = Math.min(1, Math.max(0, phase)) * (K - 1); i0 = Math.min(K - 1, Math.floor(kf)); i1 = Math.min(K - 1, i0 + 1); u = kf - i0; }
  else { const kf = (((phase % 1) + 1) % 1) * K; i0 = Math.floor(kf) % K; i1 = (i0 + 1) % K; u = kf - Math.floor(kf); }
  const o0 = (i0 * nb + bi) * 7, o1 = (i1 * nb + bi) * 7;
  const sg = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (sg * B[o1] - B[o0]) * u, B[o0 + 1] + (sg * B[o1 + 1] - B[o0 + 1]) * u, B[o0 + 2] + (sg * B[o1 + 2] - B[o0 + 2]) * u, B[o0 + 3] + (sg * B[o1 + 3] - B[o0 + 3]) * u).normalize();
  outP.set(B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * u, B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * u, B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * u);
}
// (a knockdown is flown by the yard's fall, so its clip's own slide across the floor is taken off)
const PINNED = { knockedOutDown: 1, knockedOutUp: 1 };
const GM = new THREE.Matrix4(), GF = new THREE.Matrix4(), GQ = new THREE.Quaternion(), GH = new THREE.Vector3(), GV = new THREE.Vector3();
function clipMatrix(pack, clip, phase, bi, out) {
  playedBone(pack, clip, phase, bi, GQ, GH);
  const h = pack.bones[bi].head;
  GV.set(h[0], h[1], h[2]).applyQuaternion(GQ);
  return out.compose(GV.set(GH.x - GV.x, GH.y - GV.y, GH.z - GV.z), GQ, PONE);
}
/** a played body posed by the yard: each bone riding its segment of the figure, a hand's bones as its guard clip holds
 * them on its forearm, so a fist stays a fist */
function placeFromPose(B, N) {
  const pack = B.skin.pack, S = figureSegments(B.skin.base, N), guard = pack.clips && pack.clips.guard;
  const fore = {};
  if (guard) for (let bi = 0; bi < B.bones.length; bi++) if (/^foreArm[LR]$/.test(pack.bones[bi].id)) fore[pack.bones[bi].id] = clipMatrix(pack, guard, 1, bi, new THREE.Matrix4()).invert();
  for (let bi = 0; bi < B.bones.length; bi++) {
    const sg = B.skin.seg[bi], { R, from, at } = S[sg];
    const tx = at[0] - (R[0][0] * from[0] + R[0][1] * from[1] + R[0][2] * from[2]);
    const ty = at[1] - (R[1][0] * from[0] + R[1][1] * from[1] + R[1][2] * from[2]);
    const tz = at[2] - (R[2][0] * from[0] + R[2][1] * from[1] + R[2][2] * from[2]);
    const M = B.bones[bi].matrix.set(R[0][0], R[0][1], R[0][2], tx, R[1][0], R[1][1], R[1][2], ty, R[2][0], R[2][1], R[2][2], tz, 0, 0, 0, 1);
    const inv = B.skin.hand[bi] && fore[sg];
    if (inv) M.multiply(GF.copy(inv).multiply(clipMatrix(pack, guard, 1, bi, GM)));
  }
}
function placePlayed(B, p, F, N) {
  const pack = B.skin.pack, pick = yardClip(p, F, pack.clips || {});
  B.group.position.set(p.x / 1000, p.z / 1000, p.y / 1000);
  B.group.rotation.set(0, 0, p.face > 0 ? -Math.PI / 2 : Math.PI / 2);
  if (!pick) placeFromPose(B, N);
  else {
    const [name, phase] = pick, clip = pack.clips[name];
    let rx = 0, ry = 0;
    if (PINNED[name]) { playedBone(pack, clip, phase, 0, PQ, PR); rx = PR.x - pack.bones[0].head[0]; ry = PR.y - pack.bones[0].head[1]; }
    for (let bi = 0; bi < B.bones.length; bi++) {
      playedBone(pack, clip, phase, bi, PQ, PH);
      PH.x -= rx; PH.y -= ry;
      const h = pack.bones[bi].head;
      PV.set(h[0], h[1], h[2]).applyQuaternion(PQ);
      B.bones[bi].matrix.compose(PV.set(PH.x - PV.x, PH.y - PV.y, PH.z - PV.z), PQ, PONE);
    }
  }
  B.group.updateMatrixWorld(true);
}
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1), vD = new THREE.Vector3();
function cylinderAt(mesh, a, b, r) {
  vD.subVectors(b, a);
  const len = vD.length() || 0.001;
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, vD.normalize());
  mesh.scale.set(r, r, len);
}
// a body's pose, its joints eased over a few frames when what it is doing changes (a cut would snap)
function drawnOf(B, p, F) {
  const pose = brawlPoseOf(p, F, t + p.id * 40, { ...room.s.rules, pick: BRAWL_RULES.pick, kneeFrames: BRAWL_RULES.kneeFrames }), J = rigJoints(F.body, pose);
  const key = p.mv ? `mv:${p.mv}` : `st:${p.st}`;
  const d = B.drawn;
  if (!d) { B.drawn = { key, from: J, k: 1, pose, J }; return B.drawn; }
  if (key !== d.key) { d.from = d.J; d.k = 0; d.key = key; }
  d.k = Math.min(1, d.k + 1 / (p.mv ? 2 : 4));
  const e = d.k * d.k * (3 - 2 * d.k);
  d.pose = pose;
  d.J = d.k >= 1 ? J : Object.fromEntries(Object.keys(J).map((k) => [k, [d.from[k][0] + (J[k][0] - d.from[k][0]) * e, d.from[k][1] + (J[k][1] - d.from[k][1]) * e]]));
  return d;
}
// ── a rider's mount (MOUNTS: its length, its saddle's height): a frame on two wheels, the bars ahead, drawn under its
// rider while it rides; off it, the mount is the street's (a wreck, cover) ──
const MOUNT_LOOK = { motorcycle: ['#2a2c32', '#b8bcc4'], scooter: ['#c8423a', '#e8e2d4'] };
const WHEEL = shaded(new THREE.CylinderGeometry(1, 1, 1, 18));
function mountOf(kind) {
  const M = MOUNTS[kind], L = M.len / 1000, seat = M.seat / 1000, r = kind === 'scooter' ? 0.2 : 0.31;
  const [paint, trim] = MOUNT_LOOK[kind] ?? MOUNT_LOOK.motorcycle, g = new THREE.Group(), tyre = lambert('#18181a');
  for (const x of [-(L / 2 - r), L / 2 - r]) { const w = castOn(new THREE.Mesh(WHEEL, tyre)); w.scale.set(r, 0.13, r); w.position.set(x, 0, r); g.add(w); }
  // (the body between the wheels, the tank and saddle on it, the forks up to the bars)
  const box = (sx, sy, sz, x, z, c) => { const m = castOn(new THREE.Mesh(shaded(new THREE.BoxGeometry(sx, sy, sz)), lambert(c))); m.position.set(x, 0, z); g.add(m); return m; };
  box(L * 0.55, 0.26, seat - r - 0.08, 0, (r + seat) / 2 - 0.04, paint);
  box(L * 0.3, 0.3, 0.1, -L * 0.08, seat - 0.05, '#1c1c1e');
  box(L * 0.2, 0.32, 0.18, L * 0.16, seat - 0.02, paint);
  const fork = box(0.06, 0.06, seat * 0.75, L / 2 - r * 1.2, r + seat * 0.38, trim); fork.rotation.y = -0.35;
  box(0.06, 0.72, 0.05, L / 2 - r * 1.45, seat + 0.26, trim);
  g.userData.kind = kind;
  return g;
}
function placeMount(B, p) {
  const kind = p.st === 'ride' && !p.gone ? p.mk : null;
  if (B.mount && B.mount.userData.kind !== kind) { YARD.remove(B.mount); B.mount = null; }
  if (!kind || !MOUNTS[kind]) return 0;
  if (!B.mount) { B.mount = mountOf(kind); YARD.add(B.mount); }
  B.mount.position.set(p.x / 1000, p.z / 1000, 0);
  B.mount.rotation.set(0, 0, p.face > 0 ? 0 : Math.PI);
  // (the rider sat on its saddle: lifted from a stander's hip to the saddle's top)
  return MOUNTS[kind].seat + 60 - RIDER_HIP;
}
const RIDER_HIP = 900;
function placeBody(B, p, F) {
  const hidden = !!p.gone, lift = placeMount(B, p);
  if (lift) p = { ...p, y: p.y + lift };
  B.group.visible = !hidden; B.shadow.visible = !hidden;
  if (B.blade) B.blade.fill.visible = B.blade.ink.visible = !hidden && !!F.weapon;
  if (B.line) B.line.visible = !hidden;
  if (hidden) return;
  const { pose, J } = drawnOf(B, p, F);
  const N = figurePose(B.skin ? B.skin.base : B.base, J, { face: p.face, air: !!pose.air, blade: BLADE_OF[p.st] ?? 1, stance: F.stance, twist: pose.twist ?? 0, sway: pose.sway ?? 0, tilt: pose.tilt ?? 0, spin: pose.spin ?? 0, bank: pose.bank ?? 0, lie: !!pose.lie, ...(pose.hands ? { hands: pose.hands } : {}), ...(pose.feet ? { feet: pose.feet } : {}) });
  if (B.played) placePlayed(B, p, F, N);
  else if (B.skin) placeCharacter(B, p, F, N);
  else placeStick(B, p, F, N);
  placeBlade(B, p, F, J, N);
  if (p.gn !== undefined) placeGun(B, p, N);
  B.shadow.position.set(p.x / 1000, p.z / 1000, 0.01);
  B.shadow.scale.setScalar((F.body.bodyR / 1000) * (RIG ? 1.25 : 1.6) * Math.max(0.4, 1 - p.y / 1600));
  if (B.line) {
    const half = viewHalf(BELT);
    B.line.position.set(p.x / 1000, p.z / 1000, 0.008);
    B.line.scale.set(half * 2, (room.s.rules.line * 2) / 1000, 1);
  }
}
// ── a held blade (versus-arena.client.js's): from the grip hand along the sim's own line, so what is drawn is what
// strikes; made as the body first holds one, changed as it changes weapon ──
function placeBlade(B, p, F, J, N) {
  const W = F.weapon;
  if (!W) { if (B.blade) B.blade.fill.visible = B.blade.ink.visible = false; return; }
  if (!B.blade || B.blade.kind !== W.kind) {
    if (B.blade) YARD.remove(B.blade.fill, B.blade.ink);
    const fill = castOn(new THREE.Mesh(CYL, lambert(W.color))), ink = new THREE.Mesh(CYL, INK);
    YARD.add(fill, ink);
    B.blade = { kind: W.kind, fill, ink };
  }
  B.blade.fill.visible = B.blade.ink.visible = true;
  const L = weaponLine(J, W);
  const grip = W.grip === 'B' ? (p.face > 0 ? 'R' : 'L') : (p.face > 0 ? 'L' : 'R');
  const depth = N[`wrist${grip}`] ? N[`wrist${grip}`][0] : 0;
  worldOf(p, [depth, L.butt[0] / 1000, L.butt[1] / 1000], vA);
  worldOf(p, [depth, L.tip[0] / 1000, L.tip[1] / 1000], vB);
  // (a played body's hand is its clip's: the blade held in that hand, pointing the sim's way)
  const hand = B.played ? handOf(B, grip) : null;
  if (hand) { worldOf(p, [depth, L.grip[0] / 1000, L.grip[1] / 1000], vG); vA.sub(vG).add(hand); vB.sub(vG).add(hand); }
  const wr = (W.width / 1000) * 0.55;
  cylinderAt(B.blade.fill, vA, vB, wr); cylinderAt(B.blade.ink, vA, vB, wr * 1.6);
}
const vG = new THREE.Vector3(), vH = new THREE.Vector3();
/** a played body's hand (`L` or `R`), the middle of its hand bone, in the yard's frame; null if it has none */
function handOf(B, side) {
  const pack = B.skin.pack;
  B.hands ??= { L: pack.bones.findIndex((b) => b.id === 'handL'), R: pack.bones.findIndex((b) => b.id === 'handR') };
  const bi = B.hands[side];
  if (bi < 0) return null;
  const b = pack.bones[bi];
  return vH.set((b.head[0] + b.tail[0]) / 2, (b.head[1] + b.tail[1]) / 2, (b.head[2] + b.tail[2]) / 2).applyMatrix4(B.bones[bi].matrix).applyMatrix4(B.group.matrix);
}
function placeStick(B, p, F, N) {
  const r = F.body.limbR / 1000;
  for (const L of B.limbs) {
    worldOf(p, N[L.a], vA); worldOf(p, N[L.b], vB);
    L.fill.material = farOf(L.a, p.face) && farOf(L.b, p.face) ? B.far : B.near;
    cylinderAt(L.fill, vA, vB, r * L.w); cylinderAt(L.ink, vA, vB, r * L.w * 1.32);
  }
  for (const Jn of B.joints) {
    worldOf(p, N[Jn.j], vA);
    Jn.fill.material = farOf(Jn.j, p.face) ? B.far : B.near;
    for (const [mesh, k] of [[Jn.fill, 1.05], [Jn.ink, 1.32]]) { mesh.position.copy(vA); mesh.scale.setScalar(r * Jn.w * k); }
  }
  worldOf(p, N.headBase, vA); worldOf(p, N.headTop, vB);
  vA.add(vB).multiplyScalar(0.5);
  const hr = F.body.head / 1000;
  B.head.fill.position.copy(vA); B.head.fill.scale.setScalar(hr);
  B.head.ink.position.copy(vA); B.head.ink.scale.setScalar(hr * 1.12);
}

// ── the range: a gun in the hand, a foe's warning, the rounds in flight ─────────────────────────────────────────

const GUN_LOOK = new THREE.MeshBasicMaterial({ color: 0x2b2f36, vertexColors: true });
const WARN_LOOK = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.6, depthWrite: false });
const vM = new THREE.Vector3(), vN = new THREE.Vector3(), vR = new THREE.Vector3(), vL = new THREE.Vector3(), vU = new THREE.Vector3(), vS = new THREE.Vector3();
const REELING = new Set(['hit', 'fall', 'ko', 'down', 'rise']);
/** THE RIFLE in a gunner's hands (the run & gun's, its figure's own hands: brawl-pose.js RIFLE): its stock behind the
 * rear hand, its barrel on through the lead hand along the aim (reeling, along its hands, wherever they fly), a magazine
 * under the grip; inked, so it reads as a held gun at a glance. Its warning: a thin red line on from the muzzle. */
function placeGun(B, p, N) {
  if (!B.gun) {
    const mat = RIG ? RIG.material({ color: 0x2b2f36 }) : GUN_LOOK;
    const part = () => { const fill = castOn(new THREE.Mesh(CYL, mat)), ink = new THREE.Mesh(CYL, INK); YARD.add(fill, ink); return { fill, ink }; };
    const warn = new THREE.Mesh(CYL, WARN_LOOK);
    YARD.add(warn);
    B.gun = { barrel: part(), mag: part(), warn };
  }
  const G = room.ctx.guns[p.gn], [ext, stock, girth] = gunShape(G);
  const shown = !p.gone && !p.ko && p.st !== 'roll';
  for (const k of ['barrel', 'mag']) B.gun[k].fill.visible = B.gun[k].ink.visible = shown;
  B.gun.warn.visible = shown && p.tl > 0;
  if (!shown) return;
  const lead = p.face > 0 ? 'L' : 'R', rear = lead === 'L' ? 'R' : 'L';
  worldOf(p, N[`fist${rear}`], vR); worldOf(p, N[`fist${lead}`], vL);
  const span = Math.max(0.15, vL.distanceTo(vR));
  if (REELING.has(p.st)) vU.subVectors(vL, vR).normalize();
  else {
    // (along the aim on the street's floor, at the slope its hands hold it)
    const [ax, az] = aimVector([p.ax ?? p.face, p.az ?? 0], p.face), flat = Math.hypot(vL.x - vR.x, vL.y - vR.y) || 0.1;
    vU.set(ax / 1000, az / 1000, (vL.z - vR.z) / flat).normalize();
  }
  vS.copy(vR).addScaledVector(vU, -stock); vM.copy(vR).addScaledVector(vU, span + ext);
  cylinderAt(B.gun.barrel.fill, vS, vM, girth); cylinderAt(B.gun.barrel.ink, vS, vM, girth * 1.35);
  // (the magazine: down from just ahead of the grip)
  vN.copy(vR).addScaledVector(vU, 0.1); vL.copy(vN); vL.z -= 0.08 + girth * 1.5;
  cylinderAt(B.gun.mag.fill, vN, vL, girth * 0.7); cylinderAt(B.gun.mag.ink, vN, vL, girth * 0.95);
  // (its warning: on from the muzzle along its aim, brighter as the shot comes)
  if (B.gun.warn.visible) { vN.copy(vM).addScaledVector(vU, 7); cylinderAt(B.gun.warn, vM, vN, 0.012 + 0.0006 * Math.min(30, p.tl)); WARN_LOOK.opacity = 0.35 + 0.3 * Math.abs(Math.sin(t * 0.3)); }
}
const ROUND_MINE = new THREE.MeshBasicMaterial({ color: 0xffe28a }), ROUND_FOE = new THREE.MeshBasicMaterial({ color: 0xff5a2a });
const ROUND_SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
function placeRounds() {
  const seen = new Set();
  for (const r of room.s.shots) {
    if (r.gun === undefined || r.life <= 0 || r.done) continue;
    seen.add(r.id);
    let m = rounds.get(r.id);
    if (!m) {
      const mine = r.side === 'player', big = r.area > 0 || r.lob;
      m = { tracer: new THREE.Mesh(big ? BALL : CYL, mine ? ROUND_MINE : ROUND_FOE), shadow: new THREE.Mesh(new THREE.CircleGeometry(1, 12), ROUND_SHADOW), big };
      YARD.add(m.tracer, m.shadow);
      rounds.set(r.id, m);
    }
    const rad = Math.min(0.09, Math.max(0.025, r.w / 2000));
    vM.set(r.x / 1000, r.z / 1000, r.y / 1000);
    if (m.big) { m.tracer.position.copy(vM); m.tracer.scale.setScalar(rad * 1.4); }
    else { vN.set((r.x - r.vx * 2.5) / 1000, (r.z - (r.vz || 0) * 2.5) / 1000, r.y / 1000); cylinderAt(m.tracer, vN, vM, rad); }
    m.shadow.position.set(r.x / 1000, r.z / 1000, 0.006);
    m.shadow.scale.setScalar(rad * 1.6);
  }
  for (const [id, m] of rounds) if (!seen.has(id)) { YARD.remove(m.tracer, m.shadow); rounds.delete(id); }
}

// ── the street's things ──────────────────────────────────────────────────────────────────────────────────────

const THING_LOOK = { food: [0.32, 0.32, 0.22, '#e8803a'], power: [0.3, 0.3, 0.3, '#3ad2ff'], weapon: [0.9, 0.07, 0.07, '#9aa0a8'] };
const BOX_LOOK = { barrel: '#8a5a32', crate: '#a0783e', booth: '#5a6a8a' };
// cover: sandbags, a stack of crates, a low wall, a mount's wreck (THINGS.cover: its size along, across and up)
const COVER_LOOK = { sandbags: '#b39a6b', crates: '#9a7444', wall: '#8d8f93' };
function placeThings() {
  const seen = new Set();
  for (const T of room.s.things ?? []) {
    seen.add(T.id);
    let m = things.get(T.id);
    if (!m || m.userData.what !== T.what) {
      if (m) YARD.remove(m);
      const box = T.kind === 'box', cover = T.kind === 'cover', D = box || cover ? null : THING_LOOK[T.kind];
      const C = cover ? THINGS.cover[T.what] : null, size = cover ? [C.w, C.d, C.h] : box ? [0.8, 0.8, 1] : D;
      // (a mount's wreck: the mount itself, down on its side)
      if (cover && MOUNTS[T.what]) { m = new THREE.Group(); const w = mountOf(T.what); w.rotation.x = Math.PI / 2; w.position.z = 0.12; m.add(w); }
      else m = castOn(new THREE.Mesh(shaded(new THREE.BoxGeometry(size[0], size[1], size[2]).translate(0, 0, size[2] / 2)), lambert(cover ? COVER_LOOK[T.what] ?? '#9a8a70' : box ? BOX_LOOK[T.what] ?? '#8a6a4a' : D[3])));
      m.userData.what = T.what;
      things.set(T.id, m); YARD.add(m);
    }
    m.position.set(T.x / 1000, T.z / 1000, (T.y ?? 0) / 1000);
    if (T.kind === 'power') m.rotation.z = t * 0.05;
  }
  for (const [id, m] of things) if (!seen.has(id)) { YARD.remove(m); things.delete(id); }
}

// ── a flash where a blow lands ───────────────────────────────────────────────────────────────────────────────

const FLASHES = [];
const FLASH_GEO = new THREE.SphereGeometry(1, 12, 8);
function flash(e, heavy, spark = false) {
  const m = new THREE.Mesh(FLASH_GEO, new THREE.MeshBasicMaterial({ color: spark ? 0xffb347 : heavy ? 0xffd23a : 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  m.position.set(e.x / 1000, (e.z ?? 0) / 1000, (e.y ?? 1100) / 1000);
  // (a round's spark small and quick; a blow's flash; a heavy one's, or a burst's, big)
  YARD.add(m); FLASHES.push({ m, k: 0, n: spark ? 5 : heavy ? 12 : 8, r: spark ? 0.14 : heavy ? 0.45 : 0.3 });
}
// IMPACT FRAMES: the picture flashed for a heavy landing (inverted under the anime register, white otherwise)
const IMPACT = (() => {
  const d = document.createElement('div');
  d.id = 'brawl-impact';
  const invert = BY.register === 'anime';
  d.style.cssText = `position:absolute;inset:0;pointer-events:none;display:none;background:#fff;${invert ? 'mix-blend-mode:difference;' : 'opacity:0.55;'}`;
  (typeof wrap !== 'undefined' && wrap ? wrap : document.body).appendChild(d);
  return { el: d, left: 0 };
})();
const gunOf = (id) => (id && room.ctx.guns ? room.ctx.guns.find((g) => g.id === id) : null);
function impactFrames(n) { if (n > IMPACT.left) IMPACT.left = n; }
function stepFlashes() {
  for (let i = FLASHES.length - 1; i >= 0; i--) {
    const F = FLASHES[i]; F.k++;
    const u = F.k / F.n;
    F.m.scale.setScalar(F.r * (0.4 + u)); F.m.material.opacity = 0.9 * (1 - u);
    if (F.k >= F.n) { YARD.remove(F.m); F.m.material.dispose(); FLASHES.splice(i, 1); }
  }
}

// ── the sounds: the fight's cues by event, where the page's audio channel carries them ──────────────────────

const HIT_CUE = ['hit-light', 'hit-medium', 'hit-heavy'];
function cueOf(e) {
  if (e.t === 'hit' && e.kind === 'ram') return 'crush';
  if (e.t === 'hit' && e.limb !== 'shot') return e.kind === 'flung' ? 'crush' : e.limb === 'foot' ? (e.w >= 2 ? 'kick-heavy' : 'kick-light') : e.limb === 'blade' ? (e.w >= 2 ? 'blade-heavy' : 'blade-light') : HIT_CUE[Math.min(2, e.w ?? 1)];
  if (e.t === 'hit' && e.limb === 'shot') return 'shot-hit';
  return { burst: 'burst', clash: 'clash', grab: 'grab', throw: 'throw', land: 'land', ko: 'ko', break: 'crush', thud: 'block', armor: 'clash', state: 'super', toss: 'throw' }[e.t] ?? null;
}
function sound(e) {
  if (typeof __beatsCue !== 'function' || typeof __AUDIO === 'undefined' || !__AUDIO || !__AUDIO.cues) return;
  const [c, gain] = gunCue(e) ?? [cueOf(e), 0.8];
  if (c && __AUDIO.cues[c]) __beatsCue(__AUDIO.cues[c], gain);
}
/** the range's sounds: a gun's shot and landing its own, a gun run dry, a magazine seated (null: the fight's) */
function gunCue(e) {
  if (e.t === 'fire') return [gunOf(e.gun)?.sound, 0.45];
  if (e.t === 'hit' && e.kind === 'round') return [gunOf(e.gun)?.hit ?? 'flesh-impact', e.flinch ? 0.85 : 0.5];
  if (e.t === 'burst') return [gunOf(e.gun)?.hit ?? 'burst', 1];
  if (e.t === 'empty') return ['dry-fire', 0.7];
  if (e.t === 'cover' || (e.t === 'break' && e.cover)) return [THINGS.cover[e.what]?.sound ?? 'wood-impact', e.t === 'break' ? 1 : 0.5];
  if (e.t === 'enter' && e.how === 'dig') return ['dirt-impact', 0.9];
  // (a rider's mount: its crash as it goes down)
  if (e.t === 'crash') return ['car-crash', 1];
  if (e.t === 'reload') return ['mag-in', 0.6];
  return null;
}
// a foe's round whizzing past a player close (off its line, near enough to hear): once a round
const WHIZZED = new Set();
function flybys() {
  if (!room.s.shots.length) return;
  const players = room.s.bodies.slice(0, picks.length);
  for (const r of room.s.shots) {
    if (r.gun === undefined || r.side === 'player' || WHIZZED.has(r.id) || r.life <= 0) continue;
    const near = players.some((p) => !p.gone && Math.abs(r.x - p.x) < Math.abs(r.vx) + 60 && Math.abs(r.z - p.z) > (r.line ?? 300) && Math.abs(r.z - p.z) < 1100);
    if (near) { WHIZZED.add(r.id); if (typeof __beatsCue === 'function' && typeof __AUDIO !== 'undefined' && __AUDIO && __AUDIO.cues && __AUDIO.cues['bullet-flyby']) __beatsCue(__AUDIO.cues['bullet-flyby'], 0.7); }
  }
  if (WHIZZED.size > 200) WHIZZED.clear();
}
const unlock = () => { if (typeof __beatsUnlock === 'function') __beatsUnlock(); };
addEventListener('keydown', unlock); addEventListener('pointerdown', unlock);

// ── the seats (controls/seats-kernel.js): four, each a controller; the keyboard one, every pad another ──────────

const HELD = new Set(), LATCH = new Set();
addEventListener('keydown', (e) => {
  HELD.add(e.code); LATCH.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR' && !UI.rt.state().screen) { room = resetYard(room); for (const B of bodies) B.drawn = null; }
});
addEventListener('keyup', (e) => HELD.delete(e.code));
addEventListener('blur', () => HELD.clear());
const kbRead = (c) => HELD.has(c) || LATCH.has(c);
let SEATS = __BR_SEATK.newSeats({ max: 4 }), READS = {};
function pollSeats() {
  const reads = { keyboard: kbRead }, frame = {};
  const wants = (fam, rd) => __BR_CTL.held(__BR_BIND, 'start', fam, rd) || __BR_CTL.held(__BR_BIND, 'attack', fam, rd);
  frame.keyboard = { join: wants('keyboard', kbRead) };
  const ps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k];
    if (!p || !p.connected) continue;
    const id = 'pad:' + p.index, rd = __BR_CTL.gamepadRead(p, __BR_DEV);
    reads[id] = rd; frame[id] = { connected: true, join: wants('gamepad', rd) };
  }
  for (const x of SEATS.seats) if (!frame[x.controller]) frame[x.controller] = { connected: false };
  SEATS = __BR_SEATK.step(SEATS, frame);
  READS = reads;
}
const NO_BUTTONS = Object.freeze({ x: 0, z: 0, a: false, h: false, j: false, s: false, start: false, back: false });
function buttonsOf(i) {
  const s = __BR_SEATK.seat(SEATS, i + 1);
  if (!s || s.away || !READS[s.controller]) return NO_BUTTONS;
  const fam = s.controller === 'keyboard' ? 'keyboard' : 'gamepad', rd = READS[s.controller];
  const on = (id) => __BR_CTL.held(__BR_BIND, id, fam, rd);
  return { x: (on('right') ? 1 : 0) - (on('left') ? 1 : 0), z: (on('up') ? 1 : 0) - (on('down') ? 1 : 0), a: on('attack'), h: on('strong'), j: on('jump'), s: on('special'), start: on('start'), back: on('back') };
}
const seated = () => SEATS.seats.filter((x) => !x.away).length;

// ── the screen (mana-ui over the yard: brawl-yard.js) ────────────────────────────────────────────────────────

const UI = (() => {
  const style = document.createElement('style');
  style.textContent = BY.yard.css;
  document.head.appendChild(style);
  // (the fighter from the roster; the dummies' type the street's crowd or anyone on the roster)
  const settings = [{ kind: 'cycler', label: 'Fighter', var: 'brawl.practice.set.fighter', options: BY.roster.map((r) => r.name) },
    ...(RANGE ? [{ kind: 'cycler', label: 'Gun', var: 'brawl.practice.set.gun', options: RANGE.names }] : []),
    ...((RANGE && RANGE.waves) || BY.waves ? [{ kind: 'toggle', label: 'Waves', var: 'brawl.practice.set.waves' }] : []),
    ...BY.yard.settings.map((f) => (f.label === 'Type' ? { ...f, options: [...f.options, ...BY.roster.map((r) => r.name)] } : f))];
  const state = { brawl: { practice: { set: SET, settings, moves: [], marks: [], heads: [], beats: [], ended: '', presses: [], inputs: [], clinch: { holding: false, left: 0, of: 1, knees: 0, behind: '' } } } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  const setPath = (path, to) => { const k = path.split('.'), last = k.pop(); k.reduce((o, x) => o[x], state)[last] = to; };
  const rt = manaUi.runtime(BY.yard.spec, {
    read: (p) => manaUi.readPath(state, p),
    act: (e) => { if (e && e.set) setPath(e.set, e.to); if (e && e.emit === 'training:reset') { room = resetYard(room); rt.close(); } },
    now: () => performance.now() / 1000,
  });
  rt.glyphs({ keys: { up: 'W', down: 'S', left: 'A', right: 'D', tabPrev: 'A', tabNext: 'D', back: 'Esc', accept: 'J' }, pad: { xbox: { up: '↑', down: '↓', left: '←', right: '→', tabPrev: '←', tabNext: '→', back: 'B', accept: 'A' } } });
  rt.input('keys');
  const view = manaUi.mount(el, rt, { auto: true });
  return { state, rt, view, press: (a) => { rt.press(a); view.paint(); } };
})();
// the settings applied as the screen closes: the fighter, the dummies, their health
let applied = JSON.stringify(SET);
function applySettings() {
  const now = JSON.stringify(SET);
  if (now === applied) return;
  applied = now;
  const f = BY.roster.findIndex((r) => r.name === SET.fighter);
  if (f >= 0) picks[0] = f;
  dummies = dummiesOf();
  build();
}
const MENU_PREV = {};
function menuEdges(b) {
  // (in a screen, special backs out as the back key does; in play only the back key opens the move list, special is a
  // special's, or a grenade's)
  const now = { up: b.z > 0, down: b.z < 0, left: b.x < 0, right: b.x > 0, accept: b.a || b.j, back: b.back || b.s, list: b.back, start: b.start };
  const edge = {};
  for (const k of Object.keys(now)) edge[k] = now[k] && !MENU_PREV[k];
  Object.assign(MENU_PREV, now);
  return edge;
}

// ── a frame ──────────────────────────────────────────────────────────────────────────────────────────────────

const vP = new THREE.Vector3();
const project = (x, z, y) => { YARD.localToWorld(vP.set(x / 1000, z / 1000, y / 1000)).project(camera); return [(vP.x + 1) / 2, (1 - vP.y) / 2]; };
function frameCamera() {
  const C = beltCamera(BELT, room.s.cam / 1000);
  const aspect = (innerWidth || 16) / (innerHeight || 9);
  const v = (2 * Math.atan(Math.tan((C.horizontalFov * Math.PI) / 360) / aspect) * 180) / Math.PI;
  if (Math.abs(camera.fov - v) > 0.01) { camera.fov = v; camera.updateProjectionMatrix(); }
  camera.position.set(...C.cameraPosition);
  camera.up.set(0, 0, 1);
  camera.lookAt(...C.lookAt);
}
function tick() {
  pollSeats();
  const b0 = buttonsOf(0), edge = menuEdges(b0), screen = UI.rt.state().screen;
  if (screen) {
    // (on the move list the stick's left and right turn its tabs; on the settings they cycle a value)
    const tabs = screen === 'moves';
    for (const a of ['up', 'down', 'left', 'right', 'accept', 'back']) if (edge[a]) UI.press(tabs && a === 'left' ? 'tabPrev' : tabs && a === 'right' ? 'tabNext' : a);
    if (edge.start) UI.press('back');
    if (!UI.rt.state().screen) applySettings();
    return;
  }
  if (edge.start) { UI.rt.open('settings'); UI.view.paint(); return; }
  if (edge.list) { UI.state.brawl.practice.moves = RANGE ? rangeMoveList(room) : brawlMoveList(room.ctx.fighters[0]); UI.rt.open('moves'); UI.view.paint(); return; }
  // (a second controller sat down: it drops in as the next player)
  if (seated() > picks.length && picks.length < 4) { picks = [...picks, (picks.length) % BY.roster.length]; build(); }
  const buttons = picks.map((_, i) => buttonsOf(i));
  room = stepYard(room, buttons);
  t++;
  for (const e of room.s.events) {
    if (e.t === 'hit') flash(e, (e.w ?? 1) >= 2, e.kind === 'round' && !e.flinch);
    if (e.t === 'clash') flash(e, true);
    if (e.t === 'burst') flash({ ...e, y: 600 }, true);
    // (a round on cover sparks on its face; a body coming up out of the ground throws its dirt up)
    if (e.t === 'cover') flash(e, false, true);
    // (a mount going down: the heavy flash, the impact frames)
    if (e.t === 'crash') { flash({ ...e, y: 600 }, true); impactFrames(3); }
    if (e.t === 'enter' && e.how === 'dig') flash({ ...e, y: 200 }, true);
    // (a heavy landing's impact frames: a burst, a round that makes its body flinch)
    if (e.t === 'burst' || (e.t === 'hit' && e.flinch)) impactFrames(gunOf(e.gun)?.impact ?? 0);
    sound(e);
  }
  if (IMPACT.left > 0) IMPACT.left--;
  flybys();
  const next = inputRun(runs, buttons[0]);
  runs.splice(0, runs.length, ...next);
}
function draw() {
  frameCamera();
  if (RIG) RIG.follow(room.s.cam / 1000);
  room.s.bodies.forEach((p, i) => placeBody(bodies[i], p, room.ctx.fighters[p.fi]));
  placeThings();
  placeRounds();
  stepFlashes();
  IMPACT.el.style.display = IMPACT.left > 0 ? 'block' : 'none';
  const read = yardRead(room, 0);
  Object.assign(UI.state.brawl.practice, yardHud(read, room.ctx.fighters[room.s.bodies[0].fi], project, runs.map((x) => ({ text: x.text }))));
}

build();
// the page calls this from its frame step with its clock in MILLISECONDS; the yard steps at 60 a second
let yardAcc = 0, yardLast = null;
function stepBrawlYard(ms) {
  const s = ms / 1000;
  if (yardLast === null) yardLast = s;
  yardAcc += Math.min(0.1, Math.max(0, s - yardLast));
  yardLast = s;
  while (yardAcc >= 1 / 60) { yardAcc -= 1 / 60; tick(); }
  LATCH.clear();
  draw();
}
window.__mojBrawl = { get room() { return room; }, get ui() { return UI; }, get read() { return yardRead(room, 0); } };
