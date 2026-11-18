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
/* global gunCode, joinStreet, newGunReader, readGunButtons, gunMoveList, tallyRounds, accuracyOf, sceneOf, stepScene, sceneShows, streetSession, STREET_DIFFICULTY, CPU_LEVELS, BRAWL_YARD, castKit, THREE, THINGS, MOUNTS, scene, camera, controls, renderer, wrap, manaUi, decodeF32, decodeU8, characterBase, figureSegments, segmentOf, __BR_CTL, __BR_DEV, __BR_BIND, __BR_SEATK, streetOf, stepStreet, streetRead, newReader, readButtons, practiceOf, stepYard, resetYard, yardRead, brawlMoveList, rangeMoveList, aimVector, gunShape, brawlPoseOf, rigJoints, weaponLine, figureBase, figurePose, beltCamera, beltPoint, viewHalf, yardHud, inputRun, BRAWL_RULES, PRACTICE_MODE_IDS, BRAWL_SWAY, swayAir, swayHang, swayStep, swayRegion, swayBend */
const BY = BRAWL_YARD;
const BELT = BY.belt;
controls.enabled = false;
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the yard
// the stage in the belt's frame: x along it, y across it (toward the far side), z up, from its start
const YARD = new THREE.Group();
YARD.position.set(BELT.at[0], BELT.at[1], BELT.floor);
// (a belt that RISES, brawl-belt.js `rise`: the floor's height where a thing stands, m; the simulation stays on a level
// floor, and everything it places is drawn that much higher)
const FL = (mm) => beltFloor(BELT, mm / 1000);
// (a belt that DRIFTS, `drift`: how far the band has slid across where a thing stands, m; drawn that much across)
const DR = (mm) => beltDrift(BELT, mm / 1000);
YARD.rotation.z = (BELT.heading * Math.PI) / 180;
scene.add(YARD);

// ── the register (the fight's look, versus-arena.client.js fightRig): every body drawn the one way under one key ─────
// 'anime' cel, three tones stepped from the key, its shadows stepped and cool; 'western' lit as an engine lights it, its
// shadows soft. The key from the greybox's own sun where the yard carries it (the room and the bodies share a light), else
// the camera's side above; a sky over the ground and a rim, both in the bodies' own shader (the cast rig, none of them a
// light); a catcher over the street's floor takes the shadows. The key and its shadow's box follow the camera along the
// belt. A yard with no register lights its bodies as it always did.
const REGISTER = BY.register === 'anime' || BY.register === 'western' ? BY.register : null;
const MID = (BELT.depth[0] + BELT.depth[1]) / 2;
function yardRig(register) {
  const toon = register === 'anime', KEY_DIR = new THREE.Vector3(), KEY_TO = new THREE.Vector3();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = toon ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const g = new THREE.Group();
  if (BY.sun) KEY_DIR.set(BY.sun[0], BY.sun[1], BY.sun[2]).normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), (-BELT.heading * Math.PI) / 180);
  else KEY_DIR.set(-0.35, -0.6, 0.72).normalize();
  // THE CAST RIG (color-theorist/cast-rig.js, the yard's `cast`; the kit: scene/channels/cast-rig.js): the key is the one
  // light, its colour and level the rig's; the sky over the ground and the rim are in each body's own shader, so they
  // light nothing but the bodies (the street is painted and unlit)
  const CAST = BY.cast, CU = castKit.uniforms(CAST), kl = CAST.key.linear, km = Math.max(kl[0], kl[1], kl[2], 1e-9);
  const key = new THREE.DirectionalLight(new THREE.Color().setRGB(kl[0] / km, kl[1] / km, kl[2] / km, THREE.LinearSRGBColorSpace), Math.PI * km);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  // (the shadow's box: the screen's width, the bodies spread across it, and the band)
  const box = viewHalf(BELT) + 1.5, sc = key.shadow.camera;
  sc.left = -box; sc.right = box; sc.top = box; sc.bottom = -box; sc.near = 0.5; sc.far = 30;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  if (!toon) key.shadow.radius = 3;
  g.add(key, key.target);
  const span = BELT.depth[1] - BELT.depth[0];
  // (the shadows' catcher lies on the floor: on a belt that rises, a ribbon cut a metre along, each row at the floor's height)
  const catchGeo = new THREE.PlaneGeometry(BELT.length + 12, span + 6, BELT.rise || BELT.drift ? Math.ceil(BELT.length + 12) : 1, 1);
  if (BELT.rise || BELT.drift) { const P = catchGeo.attributes.position; for (let i = 0; i < P.count; i++) { const sx = P.getX(i) + BELT.length / 2; P.setZ(i, beltFloor(BELT, sx)); P.setY(i, P.getY(i) + beltDrift(BELT, sx)); } P.needsUpdate = true; catchGeo.computeVertexNormals(); }
  const catcher = new THREE.Mesh(catchGeo, new THREE.ShadowMaterial({ color: toon ? 0x1c1830 : 0x000000, opacity: toon ? 0.6 : 0.55 }));
  catcher.position.set(BELT.length / 2, MID, 0.004); catcher.receiveShadow = true; catcher.renderOrder = 1;
  g.add(catcher);
  YARD.add(g);
  const ramp = toon ? castKit.ramp(CAST.bands) : null;
  return {
    toon,
    follow(x) {
      KEY_TO.set(x, MID + beltDrift(BELT, x), 1 + beltFloor(BELT, x)); key.target.position.copy(KEY_TO); key.position.copy(KEY_TO).addScaledVector(KEY_DIR, 12);
    },
    material(o) {
      const m = toon ? new THREE.MeshToonMaterial({ side: THREE.DoubleSide, gradientMap: ramp, ...o })
        : new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.62, metalness: 0, ...o });
      return castKit.patch(m, CU, { register, surface: 'paint' });
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
// A STREET fought down (brawl-street.js): the room a street (brawl-crowd.js streetOf), its waves a held screen, the
// players' buttons read by the brawler's own reader; the yard's readouts and settings are the practice's alone
const STREET = BY.street || null;
// (a street played as a run & gun: the gunner's buttons, its guns, its rounds tallied)
const GUNPLAY = STREET && STREET.play === 'gun' ? STREET : null;
let tally = { fired: 0, landed: 0 };
const TURNS = [];
const SET = { gun: RANGE ? RANGE.names[0] : null, waves: !!((RANGE && RANGE.waves) || BY.waves), mode: FIRST.mode ? FIRST.mode[0].toUpperCase() + FIRST.mode.slice(1) : 'Stand', type: Number.isInteger(FIRST.roster) ? BY.roster[FIRST.roster].name : FIRST.type ? FIRST.type[0].toUpperCase() + FIRST.type.slice(1) : 'Thug', count: '3', health: BY.health === 'refill' ? 'Refill' : 'Chains', fighter: BY.roster[BY.players[0] ?? 0].name, marks: true, log: true };
let picks = BY.players.slice(0, 4);
// (a street in a game's turn: who plays and how hard, as the turn's picks say; none said, as the street is written)
let SESSION = { players: picks, difficulty: null };
// (A STREET'S SPARE SEATS: the playable characters no one has picked (never one the crowd is drawn as), their bodies
// made and waiting, so a second player sits down mid-street and walks in: no street begun again. Two seats at least)
let SPARE = [];
const spareSeats = () => { if (!STREET) return []; const drawn = new Set(Object.values(STREET.cast || {}).flat().concat((STREET.castAt || []).filter((k) => k !== null))), can = BY.roster.map((_, k) => k).filter((k) => !drawn.has(k) && (!BY.playable || k < BY.playable)); const out = can.filter((k) => picks.indexOf(k) < 0); for (let k = 0; picks.length + out.length < 2 && can.length; k++) out.push(can[k % can.length]); return out.slice(0, Math.max(0, 4 - picks.length)); };
const seatsOf = () => picks.concat(SPARE);
// A SCENE PLAYING (brawl-scenes.js): the street's own beats, the fight held under it. `STAGED` what the game's turn asks
// of this session (the play shell's params: __stage as play starts, __end once the outcome is known); `CINE` the one
// on now: { id, beats, state, then } (then: what happens when it ends)
let STAGED = { start: null, end: null }, CINE = null;
// (the session's first frame, still to be drawn: the shell is told when it is, its veil lifts, and the start scene
// begins THEN, never under the loading screen)
let FRESH = false;
const SCENES = (BY.street && BY.street.scenes) || {};
function playScene(id, then) {
  const beats = SCENES[id];
  if (!beats) { then(true); return; }
  CINE = { id, beats, state: sceneOf(), then };
}
function sceneFrame(pad) {
  CINE.state = stepScene(CINE.beats, CINE.state, pad);
  const show = sceneShows(CINE.beats, CINE.state), S = UI.state.brawl.street;
  S.scene = show.done ? { on: false } : { on: true, title: show.title || '', sub: show.sub || '', say: show.say || '', who: show.who || '' };
  if (show.done) { const then = CINE.then; CINE = null; then(false); }
}
let dummies = BY.dummies;
let room = null, bodies = [], things = new Map(), rounds = new Map(), t = 0;
let readers = [], hp0 = [], over = null, seenClear = 0, bossSaid = false, said = 0;
// (the street's HUD, game-like: the foe last hit and when it goes, the combo and when it goes, the way on's arrow until
// when, the most grenades each seat has held)
let hudTarget = null, hudCombo = null, goUntil = -1, grTop = [];
// (a practice room with a GAME on it, its `stakes`: over once, told by the page's game contract)
let ENDED = false;
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
  SPARE = spareSeats();
  const who = seatsOf().map((i, k) => ({ recipe: BY.roster[i].recipe, style: BY.roster[i].style, ...(STREET && BY.roster[i].power ? { power: BY.roster[i].power } : {}), ...(k >= picks.length ? { away: true } : {}) }));
  if (STREET) {
    // (how hard the street fights, by the game's turn: the tier's crowd rules over the street's, its bosses' minds)
    const tier = SESSION.difficulty ? STREET_DIFFICULTY[SESSION.difficulty] : null, minds = Object.keys(CPU_LEVELS);
    const waves = tier && tier.cpu ? STREET.waves.map((w) => (w.boss ? { ...w, boss: { ...w.boss, cpu: tier.cpu === 'first' ? minds[0] : minds[minds.length - 1] } } : w)) : STREET.waves;
    // (a run & gun's guns: the one its turn's pick names held first)
    const gk = GUNPLAY && SESSION.gun ? GUNPLAY.ids.indexOf(SESSION.gun) : -1;
    const gunner = GUNPLAY ? { gunner: { guns: gk > 0 ? [GUNPLAY.guns[gk], ...GUNPLAY.guns.filter((_, k) => k !== gk)] : GUNPLAY.guns, grenades: GUNPLAY.grenades } } : {};
    tally = { fired: 0, landed: 0 };
    room = streetOf({ belt: BELT, players: who, waves, ...gunner, ...(STREET.lives ? { lives: STREET.lives } : {}), ...(STREET.tune ? { tune: STREET.tune } : {}), ...(BY.things.length ? { things: BY.things } : {}), ...(tier && Object.keys(tier.crowd).length ? { crowd: tier.crowd } : {}) });
    readers = picks.map(() => (GUNPLAY ? newGunReader() : newReader()));
    hp0 = room.s.bodies.map((b) => b.hp);
    over = null; seenClear = 0; bossSaid = false; hudTarget = null; hudCombo = null; goUntil = -1; grTop = [];
    Object.assign(UI.state.brawl.street, { moments: [], time: '0:00', scene: { on: false } });
  } else room = practiceOf({ belt: BELT, players: who, dummies, things: BY.things, health: SET.health.toLowerCase(), ...range, ...melee, ...(BY.stakes ? { stakes: BY.stakes } : {}) });
  ENDED = false;
  for (const m of rounds.values()) YARD.remove(m.tracer, m.shadow);
  rounds.clear();
  // (who each body is: a player's roster pick, a dummy's roster entry when it names one, else a thug of the street's)
  // (a street's crowd is drawn as its `cast` says: a body's type, the boss, or `*` for the rest → a roster's character)
  // (or, where its waves say who each body is, that body: a game's own cast, STREET.castAt in the crowd's order)
  const castOf = (i) => { const at = STREET && STREET.castAt ? STREET.castAt[i - picks.length - SPARE.length] : null; if (Number.isInteger(at)) return BY.roster[at]; const C = STREET && STREET.cast, t = C && room.mind.type[i], L = C ? (C[t] ?? C['*']) : null; return L && L.length ? BY.roster[L[i % L.length]] : null; };
  const SEATED = seatsOf();
  const entryOf = (i) => (i < SEATED.length ? BY.roster[SEATED[i]] : STREET ? castOf(i) : Number.isInteger(dummies[i - picks.length]?.roster) ? BY.roster[dummies[i - picks.length].roster] : null);
  bodies = room.s.bodies.map((b, i) => {
    const E = entryOf(i), skin = skinOf(E && E.character), player = i < SEATED.length;
    const B = skin ? (skin.pack.played ? makePlayed(skin) : makeCharacter(skin)) : makeBody(E ? E.color : '#9a8f86', room.ctx.fighters[b.fi], false);
    // (a street's player stands on its SEAT's colour, the one its quarter of the screen wears)
    if (player) B.line = lineOf(STREET && STREET.sides && STREET.sides[i] ? STREET.sides[i] : E.color);
    return B;
  });
  for (const m of things.values()) YARD.remove(m);
  things.clear();
  runs.length = 0;
}

// ── the bodies (the fight's stick figure in the round, versus-arena.client.js's) ────────────────────────────

const worldOf = (p, n, out) => out.set(p.x / 1000 + p.face * n[1], p.z / 1000 - p.face * n[0] + DR(p.x), p.y / 1000 + n[2] + FL(p.x));
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
  B.group.position.set(p.x / 1000, p.z / 1000 + DR(p.x), p.y / 1000 + FL(p.x));
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
  capeOffArms(skin, jnt, wgt);
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
// A CAPE HANGS FROM THE SHOULDERS (hero-cloth.js hangs a cloak on strings, `<part>S<m><k>`, and keeps on an arm the
// share of the cloth draped over it): on the street the arms strike and hold fists at the waist, so a cloak that kept
// to them would be pinched in to the fists; what hangs on strings keeps no share on an arm, the torso carrying it
const STRUNG = /_[A-Za-z]+S\d+$/;
function capeOffArms(skin, jnt, wgt) {
  const bones = skin.pack.bones, strung = bones.map((b) => STRUNG.test(b.id)), torso = bones.findIndex((b) => b.id === 'torso');
  if (torso < 0 || !strung.some(Boolean)) return;
  const arm = skin.seg.map((sg) => /^(upperArm|foreArm)/.test(sg));
  for (let v = 0; v < jnt.length / 4; v++) {
    let on = false;
    for (let q = 0; q < 4; q++) if (wgt[v * 4 + q] > 0 && strung[jnt[v * 4 + q]]) on = true;
    if (on) for (let q = 0; q < 4; q++) if (arm[jnt[v * 4 + q]]) jnt[v * 4 + q] = torso;
  }
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
  B.group.position.set(p.x / 1000, p.z / 1000 + DR(p.x), p.y / 1000 + FL(p.x));
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
  B.mount.position.set(p.x / 1000, p.z / 1000 + DR(p.x), FL(p.x));
  B.mount.rotation.set(0, 0, p.face > 0 ? 0 : Math.PI);
  // (the rider sat on its saddle: lifted from a stander's hip to the saddle's top)
  return MOUNTS[kind].seat + 60 - RIDER_HIP;
}
const RIDER_HIP = 900, FLOORED = new Set(['fall', 'down', 'ko', 'rise']);
function placeBody(B, p, F) {
  const hidden = !!p.gone, lift = placeMount(B, p);
  if (lift) p = { ...p, y: p.y + lift };
  // (a body carried on the air, a weather power's hero (brawl-kinetics.js BRAWL_AIR): it hovers, bobbing slowly, and drifts
  // standing, never walking; down, it lies on the ground as any body does)
  if (F.power && F.power.float && !FLOORED.has(p.st)) p = { ...p, y: p.y + BRAWL_AIR.HOVER + Math.round(60 * Math.sin((t + p.id * 37) * 0.06)), ...(p.st === 'walk' ? { st: 'stand' } : {}) };
  B.group.visible = !hidden; B.shadow.visible = !hidden;
  if (B.blade) B.blade.fill.visible = B.blade.ink.visible = !hidden && !!F.weapon;
  if (B.line) B.line.visible = !hidden;
  if (hidden) return;
  const { pose, J } = drawnOf(B, p, F);
  const N = figurePose(B.skin ? B.skin.base : B.base, J, { face: p.face, air: !!pose.air, blade: BLADE_OF[p.st] ?? 1, stance: F.stance, twist: pose.twist ?? 0, sway: pose.sway ?? 0, tilt: pose.tilt ?? 0, spin: pose.spin ?? 0, bank: pose.bank ?? 0, lie: !!pose.lie, ...(pose.hands ? { hands: pose.hands } : {}), ...(pose.feet ? { feet: pose.feet } : {}) });
  if (B.played) placePlayed(B, p, F, N);
  else if (B.skin) placeCharacter(B, p, F, N);
  else placeStick(B, p, F, N);
  if (B.skin) swayBody(B, p, F);
  placeBlade(B, p, F, J, N);
  if (p.gn !== undefined) placeGun(B, p, N);
  B.shadow.position.set(p.x / 1000, p.z / 1000 + DR(p.x), 0.01 + FL(p.x));
  B.shadow.scale.setScalar((F.body.bodyR / 1000) * (RIG ? 1.25 : 1.6) * Math.max(0.4, 1 - p.y / 1600));
  if (B.line) {
    const half = viewHalf(BELT);
    B.line.position.set(p.x / 1000, p.z / 1000 + DR(p.x), 0.008 + FL(p.x));
    B.line.scale.set(half * 2, (room.s.rules.line * 2) / 1000, 1);
    // (on a belt that drifts the line lies along the band's diagonal where the player stands)
    B.line.rotation.z = BELT.drift ? Math.atan2(DR(p.x + 500) - DR(p.x - 500), 1) : 0;
  }
}
// ── what hangs loose on a character's body (brawl-sway.js): its long hair below the neck and its cloth below the hips
// (a skirt, a coat's tails, a cape's hem), bent about their roots by the air the body moves through: its own motion,
// a gale it stands in, a floater's updraft. Read from its rest positions once; drawn only (the sim never sees it) ──
const SWAY_REST = new WeakMap();
function swayRegionsOf(B) {
  if (B.sway !== undefined) return B.sway;
  const pack = B.skin.pack, bi = (id) => pack.bones.findIndex((b) => b.id === id);
  const head = bi('head'), thigh = Math.max(bi('thighL'), bi('thighR')), pelvis = bi('pelvis');
  // (the trunk's, and a cloth's strings where the character's cloth hangs on them (hero-cloth.js: `<part>S<m><k>`): the
  // yard poses those riding the torso, so here they sway as the trunk's cloth does)
  const trunk = new Set([...['pelvis', 'lumbar', 'torso'].map(bi), ...pack.bones.map((b, i) => (STRUNG.test(b.id) ? i : -1))].filter((i) => i >= 0));
  if (head < 0) return (B.sway = null);
  const neck = pack.bones[head].head, hip = thigh >= 0 ? pack.bones[thigh].head : null;
  // (the hang's axis: the middle of what hangs at its root, so a mane hanging down the back bends about the back)
  const pivotOf = (pos, root, pick, at) => { let x = 0, y = 0, n = 0; for (let i = 0; i < pos.length / 3; i++) { const u = root - pos[i * 3 + 2]; if (u > 0 && u < 0.04 && pick(i)) { x += pos[i * 3]; y += pos[i * 3 + 1]; n++; } } return n ? [x / n, y / n] : [at[0], at[1]]; };
  const out = [];
  const add = (kind, geo, carrier, pick, root, at) => {
    const pos = geo.attributes.position.array, R = swayRegion(pos, root, pivotOf(pos, root, pick, at), pick, BRAWL_SWAY[kind].least);
    if (!SWAY_REST.has(geo)) SWAY_REST.set(geo, pos.slice());
    if (R) out.push({ kind, P: BRAWL_SWAY[kind], geo, rest: SWAY_REST.get(geo), R, carrier, st: { wx: 0, wy: 0, vx: 0, vy: 0 }, still: true });
  };
  // (the face and the throat ahead of the neck are not hair: a lock hangs behind it or beside it)
  const behind = (pos, i) => pos[i * 3 + 1] < neck[1] + 0.03;
  if (B.played) {
    const geo = B.mesh.geometry, pos = geo.attributes.position.array, J = geo.attributes.skinIndex.array, W = geo.attributes.skinWeight.array;
    const top = (i) => { let b = 0; for (let q = 1; q < 4; q++) if (W[i * 4 + q] > W[i * 4 + b]) b = q; return J[i * 4 + b]; };
    add('hair', geo, () => B.bones[head].matrix, (i) => top(i) === head && behind(pos, i), neck[2] - BRAWL_SWAY.neck, neck);
    if (hip && pelvis >= 0) add('cloth', geo, () => B.bones[pelvis].matrix, (i) => trunk.has(top(i)), hip[2] - BRAWL_SWAY.hip, pack.bones[pelvis].head);
  } else {
    const H = B.meshes[head];
    if (H) { const pos = H.fill.geometry.attributes.position.array; add('hair', H.fill.geometry, () => H.fill.matrix, (i) => behind(pos, i), neck[2] - BRAWL_SWAY.neck, neck); }
    if (hip) for (const k of trunk) { const M = B.meshes[k]; if (M) add('cloth', M.fill.geometry, () => M.fill.matrix, () => true, hip[2] - BRAWL_SWAY.hip, pack.bones[k].head); }
  }
  return (B.sway = out.length ? out : null);
}
const SWAY_IN = [0, 0, 0];
function swayBody(B, p, F) {
  const regions = swayRegionsOf(B);
  if (!regions) return;
  // the body's own velocity along the belt (m/s), read off the sim's frames: held while the street holds
  const f = room.s.f, W = (B.sw ??= { f, x: p.x, y: p.y, z: p.z, v: [0, 0, 0] }), dfr = f - W.f;
  if (dfr > 0) {
    const k = dfr > 8 ? 0 : 60 / 1000 / dfr, v = [(p.x - W.x) * k, (p.z - W.z) * k, (p.y - W.y) * k], s = Math.hypot(v[0], v[1], v[2]);
    W.v = s > BRAWL_SWAY.most ? v.map((c) => (c * BRAWL_SWAY.most) / s) : v;
    Object.assign(W, { f, x: p.x, y: p.y, z: p.z });
  }
  // the wind where it stands: each gale's column, whole over its first two thirds (brawl-core.js stepGusts)
  let wind = 0;
  for (const g of room.s.gusts || []) { const along = (p.x - g.x) * g.dir; if (along >= 0 && along <= g.len && Math.abs(p.z - g.z) <= g.wid / 2 + 400) wind += g.dir * g.v * Math.min(1, (3 * (g.len - along)) / g.len); }
  const float = !!(F.power && F.power.float) && !FLOORED.has(p.st), lying = p.st === 'down' || p.st === 'ko';
  const air = lying ? [0, 0, 0] : swayAir(W.v, [wind, 0, 0], p.face, float);
  for (const G of regions) {
    // (the air turned into the carrier's rest frame: its matrix's turn read transposed)
    const e = G.carrier().elements;
    SWAY_IN[0] = e[0] * air[0] + e[1] * air[1] + e[2] * air[2];
    SWAY_IN[1] = e[4] * air[0] + e[5] * air[1] + e[6] * air[2];
    SWAY_IN[2] = e[8] * air[0] + e[9] * air[1] + e[10] * air[2];
    if (dfr > 0) swayStep(G.st, swayHang(SWAY_IN, G.P), SWAY_IN, G.P, Math.min(dfr, 6), f, p.id * 1.37, float);
    const still = Math.hypot(G.st.wx, G.st.wy) < 1e-3;
    if (still && G.still) continue;
    swayBend(G.geo.attributes.position.array, G.rest, G.R, G.st.wx, G.st.wy);
    // (only the span it bent goes up to the card: a played body is one buffer of every part)
    const A = G.geo.attributes.position, lo = G.R.idx[0], hi = G.R.idx[G.R.idx.length - 1];
    A.addUpdateRange(lo * 3, (hi - lo + 1) * 3);
    A.needsUpdate = true;
    G.still = still;
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
// A SUPER BEAT on the lens (a powered street's): whoever calls up a power, or throws a fight's super, struck round for
// STRIKE_FOR steps in its power's screen (a seat's own, else its move's card's: a villain's), a super's the ink; drawn
// round the body as it stands (the street is held still for the beat, and the caster stands through its move)
const STRIKE_FOR = 30, STRIKES = [];
let strikeN = 0;
function superBeat(e) {
  const b = room.s.bodies[e.p], F = b && room.ctx.fighters[b.fi], mv = b && b.mv && F.moves[b.mv];
  const card = mv && typeof mv.id === 'string' && mv.id.startsWith('power.') ? POWERS[mv.id.slice(6)] : null;
  const kind = e.t === 'super' ? 'ink' : (F && F.power && F.power.screen) || (card && card.beat.screen) || 'lift';
  if (kind === 'none') return;
  STRIKES.push({ p: e.p, n: ++strikeN, kind, at: t, power: e.t === 'super' || kind === 'ink' ? 0.9 : 0.6 });
}
function strikeRows() {
  while (STRIKES.length && t - STRIKES[0].at > STRIKE_FOR) STRIKES.shift();
  const rows = [];
  for (const k of STRIKES) {
    const b = room.s.bodies[k.p];
    if (!b || b.gone) continue;
    const F = room.ctx.fighters[b.fi], h = (F.body && F.body.height) || 1800, m = project(b.x, b.z, b.y + h * 0.5), top = project(b.x, b.z, b.y + h);
    rows.push({ id: k.p, n: k.n, x: Math.round(m[0] * 1000) / 1000, y: Math.round(m[1] * 1000) / 1000, r: Math.round(Math.max(0.02, Math.abs(top[1] - m[1]) * 1.1) * 1000) / 1000, kind: k.kind, power: k.power });
  }
  return rows;
}
// (a SPECIAL's round, a projectile of the fight's (a fireball, a hero's power: brawl-powers.js): a glowing body its
// box's size, in its thrower's power's colour, else the fight's own)
const SPECIAL_LOOK = '#ffe9b0', POWER_LOOKS = new Map();
const powerColour = (id) => { const b = room.s.bodies[id], P = b && room.ctx.fighters[b.fi].power; return (P && P.colour) || SPECIAL_LOOK; };
const lookOf = (c) => { if (!POWER_LOOKS.has(c)) POWER_LOOKS.set(c, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false })); return POWER_LOOKS.get(c); };
function placeSpecial(r) {
  let m = rounds.get(r.id);
  if (!m) {
    m = { tracer: new THREE.Mesh(BALL, lookOf(powerColour(r.o))), shadow: new THREE.Mesh(new THREE.CircleGeometry(1, 12), ROUND_SHADOW), big: true };
    YARD.add(m.tracer, m.shadow);
    rounds.set(r.id, m);
  }
  m.tracer.position.set(r.x / 1000, r.z / 1000 + DR(r.x), r.y / 1000 + FL(r.x));
  m.tracer.scale.set(r.w / 2000, 0.18, r.h / 2000);
  m.shadow.position.set(r.x / 1000, r.z / 1000 + DR(r.x), 0.006 + FL(r.x));
  m.shadow.scale.setScalar(Math.min(0.6, r.w / 2400));
}
function placeRounds() {
  const seen = new Set();
  for (const r of room.s.shots) {
    if (r.life <= 0 || r.done) continue;
    if (r.gun === undefined) { if (r.hits > 0) { seen.add(r.id); placeSpecial(r); } continue; }
    seen.add(r.id);
    let m = rounds.get(r.id);
    if (!m) {
      const mine = r.side === 'player', big = r.area > 0 || r.lob;
      m = { tracer: new THREE.Mesh(big ? BALL : CYL, mine ? ROUND_MINE : ROUND_FOE), shadow: new THREE.Mesh(new THREE.CircleGeometry(1, 12), ROUND_SHADOW), big };
      YARD.add(m.tracer, m.shadow);
      rounds.set(r.id, m);
    }
    const rad = Math.min(0.09, Math.max(0.025, r.w / 2000));
    vM.set(r.x / 1000, r.z / 1000 + DR(r.x), r.y / 1000 + FL(r.x));
    if (m.big) { m.tracer.position.copy(vM); m.tracer.scale.setScalar(rad * 1.4); }
    else { vN.set((r.x - r.vx * 2.5) / 1000, (r.z - (r.vz || 0) * 2.5) / 1000 + DR(r.x - r.vx * 2.5), r.y / 1000 + FL(r.x - r.vx * 2.5)); cylinderAt(m.tracer, vN, vM, rad); }
    m.shadow.position.set(r.x / 1000, r.z / 1000 + DR(r.x), 0.006 + FL(r.x));
    m.shadow.scale.setScalar(rad * 1.6);
  }
  for (const [id, m] of rounds) if (!seen.has(id)) { YARD.remove(m.tracer, m.shadow); rounds.delete(id); }
}

// ── the street's things ──────────────────────────────────────────────────────────────────────────────────────

const THING_LOOK = { gun: [0.8, 0.14, 0.12, '#ffd23a'], food: [0.32, 0.32, 0.22, '#e8803a'], power: [0.3, 0.3, 0.3, '#3ad2ff'], weapon: [0.9, 0.07, 0.07, '#9aa0a8'] };
const BOX_LOOK = { barrel: '#8a5a32', crate: '#a0783e', drum: '#3d5a44', booth: '#5a6a8a' };
// cover: sandbags, a stack of crates, a low wall, a mount's wreck (THINGS.cover: its size along, across and up)
const COVER_LOOK = { sandbags: '#b39a6b', crates: '#9a7444', wall: '#8d8f93' };
// (a box drawn as its vessel, BRAWL_YARD.boxes: its triangles and their baked colours; broken, its wreck lies where it stood)
const BOXES = BRAWL_YARD.boxes || {};
// (cover drawn as the dress's own piece, BRAWL_YARD.covers: the thing that stands beside the fight, stood in it)
const COVERS = BRAWL_YARD.covers || {};
// (its colours are the dress's own, written as the eye reads them: brought to the renderer's linear light here, or
// every piece in the band stands paler than the same piece against the wall)
const modelOf = (M) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(M.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(M.col.map((v) => Math.pow(v / 255, 2.2)), 3)); g.computeVertexNormals(); return castOn(new THREE.Mesh(g, RIG ? RIG.material({ color: '#ffffff', vertexColors: true }) : new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))); };
const WRECKS = [];
function wreckAt(e) { const M = e.cover ? COVERS[e.what] : BOXES[e.what]; if (!M) return; const m = modelOf(M.wreck); m.position.set(e.x / 1000, e.z / 1000 + DR(e.x), FL(e.x)); m.rotation.z = (e.x % 628) / 100; YARD.add(m); WRECKS.push(m); if (WRECKS.length > 24) YARD.remove(WRECKS.shift()); }
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
      else if (box && BOXES[T.what]) m = modelOf(BOXES[T.what].whole);
      else if (cover && COVERS[T.what]) m = modelOf(COVERS[T.what].whole);
      else m = castOn(new THREE.Mesh(shaded(new THREE.BoxGeometry(size[0], size[1], size[2]).translate(0, 0, size[2] / 2)), lambert(cover ? COVER_LOOK[T.what] ?? '#9a8a70' : box ? BOX_LOOK[T.what] ?? '#8a6a4a' : D[3])));
      m.userData.what = T.what;
      things.set(T.id, m); YARD.add(m);
    }
    m.position.set(T.x / 1000, T.z / 1000 + DR(T.x), (T.y ?? 0) / 1000 + FL(T.x));
    if (T.kind === 'power') m.rotation.z = t * 0.05;
  }
  for (const [id, m] of things) if (!seen.has(id)) { YARD.remove(m); things.delete(id); }
}

// ── a flash where a blow lands ───────────────────────────────────────────────────────────────────────────────

const FLASHES = [];
const FLASH_GEO = new THREE.SphereGeometry(1, 12, 8);
function flash(e, heavy, spark = false, colour = null) {
  const m = new THREE.Mesh(FLASH_GEO, new THREE.MeshBasicMaterial({ color: colour || (spark ? 0xffb347 : heavy ? 0xffd23a : 0xffffff), transparent: true, opacity: 0.9, depthWrite: false }));
  m.position.set(e.x / 1000, (e.z ?? 0) / 1000 + DR(e.x), (e.y ?? 1100) / 1000 + FL(e.x));
  // (a round's spark small and quick; a blow's flash; a heavy one's, or a burst's, big)
  YARD.add(m); FLASHES.push({ m, k: 0, n: spark ? 5 : heavy ? 12 : 8, r: spark ? 0.14 : heavy ? 0.45 : 0.3 });
}
// A DUST RING where an impact meets the ground (brawl-kinetics.js, rupa's knockback: the ground's share of a power's
// impact), running out as wide as the cube root of that share, as rupa's own page draws it
const DUST_GEO = new THREE.RingGeometry(0.55, 1, 40);
function dustRing(e) {
  const m = new THREE.Mesh(DUST_GEO, new THREE.MeshBasicMaterial({ color: 0xcdbfa6, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(e.x / 1000, (e.z ?? 0) / 1000 + DR(e.x), 0.02 + FL(e.x));
  YARD.add(m); FLASHES.push({ m, k: 0, n: 26, r: 0.25 * Math.cbrt(Math.max(1, e.ground) / 1000) });
}
// AN EARTH POWER'S SLAB (brawl-core.js `walls`): a block of the street's stone, rising out of the ground, standing,
// sliding, and sinking back into dust as it crumbles
const SLABS = new Map(), SLAB_GEO = shaded(new THREE.BoxGeometry(1, 1, 1));
function placeWalls() {
  const seen = new Set();
  for (const w of room.s.walls || []) {
    seen.add(w.id);
    let m = SLABS.get(w.id);
    if (!m) { m = castOn(new THREE.Mesh(SLAB_GEO, lambert('#8a7b66'))); YARD.add(m); SLABS.set(w.id, m); }
    const H = w.h / 1000, sink = w.st === 'rise' ? H * (1 - Math.min(1, w.f / w.rise)) : w.st === 'crumble' ? H * Math.min(1, w.f / w.rest) : 0;
    m.scale.set(w.len / 1000, w.wid / 1000, Math.max(0.01, H - sink));
    m.position.set(w.x / 1000, w.z / 1000 + DR(w.x), FL(w.x) + (H - sink) / 2);
  }
  for (const [id, m] of SLABS) if (!seen.has(id)) { YARD.remove(m); SLABS.delete(id); }
}
// A GALE (brawl-core.js `gusts`): streaks of air running down its column from its caller for as long as it blows, each at
// its own height and across the column (by its index: no dice), pale and thin
const STREAK_GEO = new THREE.BoxGeometry(1, 0.03, 0.03), STREAKS = [];
function galeStreaks(e) {
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(STREAK_GEO, new THREE.MeshBasicMaterial({ color: 0xe8f2ff, transparent: true, opacity: 0, depthWrite: false }));
    const across = ((i * 0.618) % 1) - 0.5, up = 0.3 + ((i * 0.381) % 1) * 1.6;
    YARD.add(m); STREAKS.push({ m, e, i, across, up, k: -(i % 5) * 3, n: e.frames });
  }
}
function stepStreaks() {
  for (let j = STREAKS.length - 1; j >= 0; j--) {
    const S = STREAKS[j]; S.k++;
    const u = ((S.k * 3 + S.i * 17) % 40) / 40, along = (S.e.len / 1000) * u, x = S.e.x / 1000 + S.e.dir * along, len = 0.6 + 0.8 * (1 - u);
    S.m.scale.set(len, 1, 1);
    S.m.position.set(x, S.e.z / 1000 + S.across * (S.e.wid / 1000) + DR(S.e.x), S.up + FL(S.e.x));
    S.m.material.opacity = S.k < 0 ? 0 : 0.55 * (1 - u) * Math.min(1, (S.n - S.k) / 10);
    if (S.k >= S.n) { YARD.remove(S.m); S.m.material.dispose(); STREAKS.splice(j, 1); }
  }
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
  if (c) HEARD[c] = (HEARD[c] || 0) + 1;
  if (c && __AUDIO.cues[c]) __beatsCue(__AUDIO.cues[c], gain);
}
// THE BODIES' OWN SOUNDS (brawl-sfx.js BRAWL_SOUNDS), heard off the street's state, not its events: a blow THROWN (a
// move begun: a fist's swing, a strong blow's or a kick's whoosh, a blade's), a jump taken, and a thug's shout as it
// attacks (one in three, by its own hash, so a crowd is not a chorus). A cue the page carries none of plays nothing.
const SAID = new Map();
// (HEARD: each cue asked for and how often, with or without a sound to play it: a probe's, window.__mojBrawl.heard)
const HEARD = {};
const cue = (c, gain) => { HEARD[c] = (HEARD[c] || 0) + 1; if (typeof __beatsCue === 'function' && typeof __AUDIO !== 'undefined' && __AUDIO && __AUDIO.cues && __AUDIO.cues[c]) __beatsCue(__AUDIO.cues[c], gain); };
function bodySounds() {
  for (const p of room.s.bodies) {
    if (p.gone) continue;
    const was = SAID.get(p.id) || { mv: null, mf: 0, st: null }, F = room.ctx.fighters[p.fi];
    const began = p.st === 'move' && p.mv && (was.mv !== p.mv || p.mf < was.mf || was.st !== 'move');
    if (began) {
      const strong = p.mv.startsWith('strong') || p.mv === 'desperate' || p.mv.startsWith('special');
      cue(F.weapon ? 'swing-blade' : strong ? 'swing-heavy' : 'swing', p.side === 'player' ? 0.5 : 0.3);
      if (p.side === 'crowd' && (p.id * 7 + room.s.f) % 3 === 0) cue('shout', 0.4);
    }
    if (p.st === 'jump' && was.st !== 'jump') cue('jump', 0.4);
    SAID.set(p.id, { mv: p.mv, mf: p.mf, st: p.st });
  }
}
// (and on a blow: a thug's grunt on a heavy one, its cry as it goes down)
function voiceOf(e) {
  // (a blow's `d` is the body it landed on; a knockout's `p` the body that fell)
  const id = e.t === 'ko' ? e.p : e.t === 'hit' ? e.d : undefined, b = id !== undefined ? room.s.bodies[id] : null;
  if (!b || b.side !== 'crowd') return;
  if (e.t === 'ko') cue('cry', 0.6);
  else if ((e.w ?? 1) >= 2) cue('grunt', 0.45);
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
  const players = room.s.bodies.slice(0, picks.length + SPARE.length);
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
  if (e.code === 'KeyR' && !BY.street && !UI.rt.state().screen) { room = resetYard(room); for (const B of bodies) B.drawn = null; }
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
  const state = { brawl: { street: { strikes: [], p1: {}, p2: {}, p3: {}, p4: {}, gun: { on: false, name: '', ammo: '', grenades: 0 }, accuracy: '—', hp: 1, hpMax: 1, name: '', cleared: 0, of: 1, left: 0, boss: { on: false, name: '', hp: 0, hpMax: 1 }, moments: [], time: '0:00', rank: '', moves: [] }, practice: { set: SET, settings, moves: [], marks: [], heads: [], beats: [], ended: '', presses: [], inputs: [], clinch: { holding: false, left: 0, of: 1, knees: 0, behind: '' } } } };
  // (THE LENS, a powered street's (brawl-street.js STREET_LENS): its host over the world's canvas and under the HUD,
  // never raised (a z-index or a contain would make it its own, and its regions would filter nothing of the world))
  const lensHost = BY.yard.spec.lens ? document.createElement('div') : null;
  if (lensHost) { lensHost.className = 'moj-brawl-lens'; (document.getElementById('wrap') || document.body).appendChild(lensHost); }
  // (inside the scene's frame, so the HUD's corners are the street's, never the page's margin)
  const el = document.createElement('div');
  (document.getElementById('wrap') || document.body).appendChild(el);
  const setPath = (path, to) => { const k = path.split('.'), last = k.pop(); k.reduce((o, x) => o[x], state)[last] = to; };
  const rt = manaUi.runtime(BY.yard.spec, {
    read: (p) => manaUi.readPath(state, p),
    act: (e) => { if (e && e.set) setPath(e.set, e.to); if (e && e.emit === 'training:reset') { room = resetYard(room); rt.close(); } if (e && e.emit === 'street:again') { rt.close(); build(); } },
    now: () => performance.now() / 1000,
  });
  rt.glyphs({ keys: { up: 'W', down: 'S', left: 'A', right: 'D', tabPrev: 'A', tabNext: 'D', back: 'Esc', accept: 'J' }, pad: { xbox: { up: '↑', down: '↓', left: '←', right: '→', tabPrev: '←', tabNext: '→', back: 'B', accept: 'A' } } });
  rt.input('keys');
  const view = manaUi.mount(el, rt, { auto: true });
  if (lensHost) manaUi.mount(lensHost, rt, { part: 'lens', auto: true });
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
  const C = beltCamera(BELT, CINE && CINE.state.cam !== null ? Math.max(viewHalf(BELT), Math.min(BELT.length - viewHalf(BELT), CINE.state.cam)) : room.s.cam / 1000);
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
    // (a street's end is left by its own button; its move list by back, as the yard's)
    if (edge.start && !(STREET && over)) UI.press('back');
    if (!STREET && !UI.rt.state().screen) applySettings();
    return;
  }
  // (a scene playing: the fight held; accept puts its line away, start skips it where it may be skipped)
  if (CINE) { sceneFrame({ accept: !!edge.accept, skip: !!edge.start && CINE.skip !== false }); streetScreen(); return; }
  if (edge.start && !STREET) { UI.rt.open('settings'); UI.view.paint(); return; }
  if (edge.list) { const ML = GUNPLAY ? gunMoveList(room.ctx.guns.slice(0, GUNPLAY.guns.length + 1), room.s.bodies[0].gr) : RANGE ? rangeMoveList(room) : brawlMoveList(room.ctx.fighters[0]); if (STREET) UI.state.brawl.street.moves = ML; else UI.state.brawl.practice.moves = ML; UI.rt.open('moves'); UI.view.paint(); return; }
  // (a second controller sat down: it drops in as the next player)
  // (on a street: into its waiting seat, the street going on; in the yard, the room made again with it)
  if (STREET) { if (seated() > picks.length && SPARE.length) { room = joinStreet(room, picks.length); hp0[picks.length] = room.s.bodies[picks.length].hp; picks = picks.concat([SPARE.shift()]); readers.push(GUNPLAY ? newGunReader() : newReader()); } }
  else if (seated() > picks.length && picks.length < 4) { picks = [...picks, (picks.length) % BY.roster.length]; build(); }
  const buttons = picks.map((_, i) => buttonsOf(i));
  if (STREET) {
    const pads = buttons.map((bt, i) => { const me = room.s.bodies[i], [pad, r] = GUNPLAY ? readGunButtons(readers[i], bt, me) : readButtons(readers[i], bt, me, room.ctx.fighters[me.fi]); readers[i] = r; return pad; });
    room = stepStreet(room, pads);
    if (GUNPLAY) tally = tallyRounds(tally, room.s.events, picks.length);
    // (a boss turning: a crowd-kind boss's phase, a fighter boss's stage)
    for (const e of room.s.events) { if (e.t === 'phase') TURNS.push(e); if (e.t === 'bossStage') TURNS.push({ says: e.name || 'Stage ' + e.k, k: e.k - 1 }); }
  } else {
    room = stepYard(room, buttons);
    if (BY.stakes && !ENDED && room.yard.over) { ENDED = true; if (window.__mojGame) window.__mojGame.end(room.yard.over === 'won' ? 'success' : 'fail'); }
  }
  t++;
  for (const e of room.s.events) {
    if (e.t === 'hit') flash(e, (e.w ?? 1) >= 2, e.kind === 'round' && !e.flinch);
    if (e.t === 'clash') flash(e, true);
    if (e.t === 'impact') dustRing(e);
    // (a slab wrenched up, shoved, crumbling: dust where it meets the ground)
    if (e.t === 'wall' || e.t === 'crumble') { dustRing(e); if (e.t === 'crumble') flash({ ...e, y: 900 }, true, true); }
    if (e.t === 'shove') dustRing({ ...e, ground: 8000 });
    // (a gale's streaks; a round blown out of the air puffs)
    if (e.t === 'gust') galeStreaks(e);
    if (e.t === 'blown') flash(e, false, true, '#e8f2ff');
    // (a hero's power: a burst in its colour where it is called up; and its SUPER BEAT on the lens, round whoever calls
    // it up, the street held still for it: the power's own screen (brawl-powers.js `beat`), a fight super's its negative)
    if (e.t === 'power') flash({ ...e, y: 1000 }, true, false, powerColour(e.p));
    if (BY.yard.spec.lens && (e.t === 'power' || e.t === 'super')) superBeat(e);
    if (e.t === 'break') wreckAt(e);
    if (e.t === 'burst') flash({ ...e, y: 600 }, true);
    // (a round on cover sparks on its face; a body coming up out of the ground throws its dirt up)
    if (e.t === 'cover') flash(e, false, true);
    // (a mount going down: the heavy flash, the impact frames)
    if (e.t === 'crash') { flash({ ...e, y: 600 }, true); impactFrames(3); }
    if (e.t === 'enter' && e.how === 'dig') flash({ ...e, y: 200 }, true);
    // (a heavy landing's impact frames: a burst, a round that makes its body flinch)
    if (e.t === 'burst' || (e.t === 'hit' && e.flinch)) impactFrames(gunOf(e.gun)?.impact ?? 0);
    sound(e);
    voiceOf(e);
  }
  bodySounds();
  if (IMPACT.left > 0) IMPACT.left--;
  flybys();
  const next = inputRun(runs, buttons[0]);
  runs.splice(0, runs.length, ...next);
}
function draw() {
  if (FRESH) {
    FRESH = false;
    window.parent.postMessage({ moj: BY.wire.shown }, '*');
    if (STAGED.start && STAGED.start.scene) { const sid = STAGED.start.scene; playScene(sid, (missing) => window.parent.postMessage({ moj: BY.wire.sceneEnd, scene: sid, ...(missing ? { missing: true } : {}) }, '*')); if (CINE) CINE.skip = STAGED.start.skip; }
  }
  frameCamera();
  if (RIG) RIG.follow(room.s.cam / 1000);
  room.s.bodies.forEach((p, i) => placeBody(bodies[i], p, room.ctx.fighters[p.fi]));
  placeThings();
  placeRounds();
  placeWalls();
  stepStreaks();
  stepFlashes();
  IMPACT.el.style.display = IMPACT.left > 0 ? 'block' : 'none';
  if (STREET) { streetScreen(); return; }
  const read = yardRead(room, 0);
  Object.assign(UI.state.brawl.practice, yardHud(read, room.ctx.fighters[room.s.bodies[0].fi], project, runs.map((x) => ({ text: x.text }))));
}
// the street's screen: its read (brawl-street-read.js) into the state the spec binds, the moments said once each (GO as
// a held screen is beaten, the boss's name as it comes in), and its end opened once
function streetScreen() {
  const R = streetRead(room, hp0), S = UI.state.brawl.street, secs = Math.floor(R.f / 60);
  if (BY.yard.spec.lens) S.strikes = strikeRows();
  const say = (text, weight) => { S.moments = S.moments.slice(-4).concat([{ id: 'm' + (said++), text, ...(weight ? { weight } : {}) }]); };
  // (a held screen beaten: the way on opens, an arrow at the right edge for a few seconds, not a word over the fight)
  if (R.cleared > seenClear) { seenClear = R.cleared; if (!R.won) goUntil = t + 180; }
  // (the foe a player last hit, by name and a short bar, for two seconds; the hitter's combo, its word at each rung)
  for (const e of room.s.events) {
    if (e.t !== 'hit' || !(typeof e.p === 'number' && e.p < picks.length) || e.d === undefined || e.d < picks.length) continue;
    const d = room.s.bodies.find((x) => x.id === e.d), F = d && room.ctx.fighters[d.fb ?? d.fi];
    if (d && F && F.name !== R.boss.name) hudTarget = { id: d.id, until: t + 120 };
    if (e.combo >= 2) hudCombo = { n: e.combo, until: t + 90 };
  }
  if (R.boss.on && !bossSaid) { bossSaid = true; say(R.boss.name.toUpperCase(), 'decisive'); }
  // (a boss turning: its phase's word, or its number)
  while (TURNS.length) { const e = TURNS.shift(); say((e.says || 'PHASE ' + (e.k + 1)).toUpperCase(), 'major'); }
  // (each seat's quarter: taken (its name, health, gun, rounds: low at a fifth of a magazine, grenades), open, or none)
  const seat = (k) => {
    const OFF = { on: false, open: false, name: '', hp: 0, hpMax: 1, gun: '', gunId: '', ammo: '', rounds: 0, size: 0, endless: false, low: false, grenades: 0, grenadesMax: 0 };
    if (k >= picks.length) return k < picks.length + SPARE.length ? { ...OFF, open: true } : OFF;
    const p = room.s.bodies[k], G = p.gn !== undefined ? room.ctx.guns[p.gn] : null;
    grTop[k] = Math.max(grTop[k] || 0, p.gr || 0);
    return { ...OFF, on: true, name: BY.roster[picks[k]].name, hp: Math.max(0, p.hp), hpMax: hp0[k] || 1, ...(p.pwm !== undefined ? { powerOn: true, power: p.pw, powerMax: p.pwm } : {}), ...(G ? { gun: gunCode(G), gunId: G.id || '', ammo: p.am === undefined ? '∞' : String(p.am), rounds: p.am === undefined ? 0 : p.am, size: G.ammo || 0, endless: p.am === undefined, low: !!(p.am !== undefined && G.ammo && p.am <= G.ammo * 0.2), grenades: p.gr || 0, grenadesMax: grTop[k] } : {}) };
  };
  Object.assign(S, { hp: R.hp, hpMax: R.hpMax, name: BY.roster[picks[0]].name, cleared: R.cleared, of: R.of, left: R.left, lives: R.lives ? { on: true, left: R.lives.left, of: R.lives.of } : { on: false, left: 0, of: 1 }, boss: { ...R.boss, phased: !!R.phase, phase: R.phase ? R.phase.at : 0, phases: R.phase ? R.phase.of : 1 }, p1: seat(0), p2: seat(1), p3: seat(2), p4: seat(3), ...(R.gun ? { gun: R.gun, accuracy: accuracyOf(tally) === null ? '—' : accuracyOf(tally) + '%' } : {}) });
  // the danger (one player: the screen's edge, closing in under half its health), the foe being hit, the combo, the way on
  const share = R.hpMax > 0 ? R.hp / R.hpMax : 1, tgt = hudTarget && t < hudTarget.until ? room.s.bodies.find((x) => x.id === hudTarget.id) : null, TF = tgt && room.ctx.fighters[tgt.fb ?? tgt.fi];
  S.peril = picks.length === 1 ? Math.round(Math.min(1, Math.max(0, (0.5 - share) / 0.45)) * 20) / 20 : 0;
  S.target = tgt && TF && tgt.hp > 0 ? { on: true, name: TF.name || '', hp: Math.max(0, tgt.hp), hpMax: hp0[tgt.id] || TF.hp || tgt.hp || 1 } : { on: false, name: '', hp: 0, hpMax: 1 };
  const cn = hudCombo && t < hudCombo.until ? hudCombo.n : 0;
  S.combo = { on: cn >= 2, n: cn, word: cn >= 30 ? 'Insane' : cn >= 20 ? 'Wild' : cn >= 10 ? 'Great' : cn >= 5 ? 'Nice' : '' };
  S.go = t < goUntil && !R.boss.on;
  if (!over) { S.time = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'); S.rank = R.won ? R.rank : '—'; }
  if (!over && (R.won || R.lost)) {
    over = R.won ? 'won' : 'lost';
    // (in a game's shell the street's end is the shell's: the outcome goes up the wire, with what the street kept, and
    // the shell shows what comes next; on its own page the street shows its own end)
    const tell = () => { if (HOSTED) window.parent.postMessage({ moj: BY.wire.outcome, envelope: { contractVersion: BY.wire.version, levelRef: 'street', result: R.won ? 'success' : 'fail', events: [], stats: { street: { cleared: R.cleared, of: R.of, seconds: secs, health: R.hp, healthOf: R.hpMax }, ...(R.won ? { rank: R.rank } : {}), kept: [{ label: 'time', value: secs, unit: ' s', best: 'low' }, { label: 'health', value: R.hp, best: 'high' }, ...(GUNPLAY && accuracyOf(tally) !== null ? [{ label: 'accuracy', value: accuracyOf(tally), unit: '%', best: 'high' }] : [])] } } }, '*');
    // (and the keys go back to the shell: its result is driven from them)
      if (HOSTED) { try { window.parent.focus(); } catch (err) { /* an opaque parent */ } }
      else { UI.rt.open(over); UI.view.paint(); } };
    // (THE END SCENE the game's turn asks for, on the outcomes it names: played here, the outcome told after it)
    const E = STAGED.end;
    if (E && E.scene && SCENES[E.scene] && (!E.when || E.when.indexOf(over) >= 0)) { playScene(E.scene, tell); if (CINE) CINE.skip = E.skip; } else tell();
  }
}
// A STREET IN A GAME'S SHELL: it says it is ready, and begins again from its start when the shell says go (a retry is a
// new session of the same page)
const HOSTED = !!(STREET && BY.wire && window.parent !== window);
if (HOSTED) {
  window.addEventListener('message', (e) => { const d = e.data; if (d && typeof d === 'object' && d.moj === BY.wire.init && d.contractVersion === BY.wire.version) { const S0 = streetSession(d.params, BY.roster, BY.players), changed = S0.difficulty !== SESSION.difficulty || S0.gun !== SESSION.gun || S0.players.join() !== picks.join(); SESSION = S0; picks = S0.players.slice(); const P0 = d.params || {}; STAGED = { start: P0.__stage || null, end: P0.__end || null }; CINE = null; if (over || changed) build(); FRESH = true; try { window.focus(); } catch (err) { /* a frame that may not */ } } });
  window.parent.postMessage({ moj: BY.wire.ready, contractVersion: BY.wire.version, levelRef: 'street' }, '*');
  // (the keys are read in this frame: it takes the focus as it starts and whenever it is pressed on, so a player who
  // started the game on the shell's screen plays without a click)
  const take = () => { try { window.focus(); } catch (e) { /* a frame that may not */ } };
  take(); window.addEventListener('pointerdown', take);
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
window.__mojBrawl = { wreck: (e) => wreckAt(e), get seats() { return { joined: picks.length, spare: SPARE.length, seated: seated() }; }, get session() { return { players: picks.slice(), difficulty: SESSION.difficulty, ...(SESSION.gun ? { gun: SESSION.gun } : {}) }; }, get tally() { return { ...tally }; }, get scene() { return CINE ? { id: CINE.id, at: CINE.state.at, shows: sceneShows(CINE.beats, CINE.state) } : null; }, play: (id) => playScene(id, () => {}), get room() { return room; }, get ui() { return UI; }, get read() { return STREET ? streetRead(room, hp0) : yardRead(room, 0); }, get over() { return over; }, get heard() { return { ...HEARD }; }, get sway() { return bodies.map((B) => (B.sway ? B.sway.map((G) => ({ kind: G.kind, n: G.R.idx.length, L: +G.R.L.toFixed(3), w: +Math.hypot(G.st.wx, G.st.wy).toFixed(3) })) : null)); }, get cues() { return typeof __AUDIO !== 'undefined' && __AUDIO && __AUDIO.cues ? Object.keys(__AUDIO.cues) : []; } };
