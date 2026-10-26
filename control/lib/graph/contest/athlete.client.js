/**
 * athlete (a contest page's character bodies) — a character made with create_character playing a sport in its own body
 * (inlined into a contest page's block after versus-rig.js, versus-figure.js and athlete-pose.js, before the arena's
 * client, only when the arena carries bodies: scene/channels/contest.js; never imported).
 *
 * The arena's data carries `athletes` (a character's ref per slot: a lane, a side's player, a seat, cycled when the list
 * is shorter) and `bodies` (each character's rig bones and rigid parts, versus-character.js characterBody). A slot whose
 * character has a body is drawn in it: one mesh per bone part riding its segment of the pose (athlete-pose.js), relit
 * by the stage's key as it turns (the pack's baked rest light taken back out) and inked, as the versus arena draws a
 * fighter; a slot without one is the arena's own stick figure. One geometry per character, shared by its slots.
 *
 *   athleteRig(data)          → { refAt(i), has(i), make(i) → A }   A: { group, shadow, athlete: true }
 *   placeAthlete(A, stick, { face, lift, ground, shadowScale })  the meshes posed; → the posed nodes (a racquet, a
 *                             club ride them)
 */
/* global THREE, scene, decodeF32, decodeU8, figureSegments, segmentOf, athleteBase, athleteNodes */

const ATH_REST_KEY = new THREE.Vector3(0.35, -0.55, 0.75).normalize();   // the pack's baked light (station-loft-rig.js)
const ATH_WORLD_KEY = new THREE.Vector3(-0.35, -0.6, 0.72).normalize();  // the stage's: from the camera's side, above
const ATH_INK = 0.011;
// smooth normals over a triangle soup (corners at one place share theirs)
function athSmoothNormals(pos) {
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
let ATH_LIT = null, ATH_HULL = null;
function athMaterials() {
  if (ATH_LIT) return;
  ATH_LIT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  ATH_LIT.onBeforeCompile = (sh) => {
    sh.uniforms.uKey = { value: ATH_WORLD_KEY };
    sh.vertexShader = 'attribute float restShade;\nuniform vec3 uKey;\nvarying float vRelight;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  vec3 wn = normalize(mat3(modelMatrix) * normal);\n  vRelight = (0.55 + 0.45 * max(0.0, dot(wn, uKey))) / max(0.4, restShade);');
    sh.fragmentShader = 'varying float vRelight;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vRelight;');
  };
  ATH_HULL = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  ATH_HULL.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${ATH_INK.toFixed(4)};`);
  };
}
function athGeometry(part) {
  const pos = decodeF32(part.pos), nrm = athSmoothNormals(pos), rest = new Float32Array(pos.length / 3);
  for (let i = 0; i < rest.length; i++) rest[i] = 0.55 + 0.45 * Math.max(0, nrm[i * 3] * ATH_REST_KEY.x + nrm[i * 3 + 1] * ATH_REST_KEY.y + nrm[i * 3 + 2] * ATH_REST_KEY.z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));
  geo.setAttribute('restShade', new THREE.BufferAttribute(rest, 1));
  geo.computeBoundingSphere();
  return geo;
}

function athleteRig(data) {
  const refs = Array.isArray(data.athletes) ? data.athletes : [], bodies = data.bodies || {}, skins = {};
  const refAt = (i) => (refs.length ? refs[i % refs.length] : null);
  const skinOf = (ref) => {
    if (!ref || !bodies[ref]) return null;
    if (skins[ref] !== undefined) return skins[ref];
    try {
      const pack = bodies[ref];
      skins[ref] = { base: athleteBase(pack.bones), seg: pack.bones.map((b) => segmentOf(b.id)), geos: pack.parts.map((p) => (p ? athGeometry(p) : null)) };
    } catch (e) { skins[ref] = null; }   // a rig the figure cannot stand up: the stick figure
    return skins[ref];
  };
  return {
    refAt,
    has: (i) => !!skinOf(refAt(i)),
    make(i) {
      athMaterials();
      const skin = skinOf(refAt(i)), group = new THREE.Group();
      const meshes = skin.geos.map((geo) => {
        if (!geo) return null;
        const fill = new THREE.Mesh(geo, ATH_LIT), hull = new THREE.Mesh(geo, ATH_HULL);
        for (const m of [fill, hull]) { m.matrixAutoUpdate = false; m.frustumCulled = false; group.add(m); }   // matrices change every frame
        return { fill, hull };
      });
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
      scene.add(group, shadow);
      return { group, shadow, skin, meshes, athlete: true };
    },
  };
}

const ATH_M4 = new THREE.Matrix4();
function placeAthlete(A, stick, { face = [0, 1], lift = 0, ground = 0, shadowScale = 1 } = {}) {
  const N = athleteNodes(A.skin.base, stick, { face, lift, ground });
  const S = figureSegments(A.skin.base, N);
  for (let i = 0; i < A.meshes.length; i++) {
    const m = A.meshes[i];
    if (!m) continue;
    // v' = R (v − from) + at
    const { R, from, at } = S[A.skin.seg[i]];
    const tx = at[0] - (R[0][0] * from[0] + R[0][1] * from[1] + R[0][2] * from[2]);
    const ty = at[1] - (R[1][0] * from[0] + R[1][1] * from[1] + R[1][2] * from[2]);
    const tz = at[2] - (R[2][0] * from[0] + R[2][1] * from[1] + R[2][2] * from[2]);
    ATH_M4.set(R[0][0], R[0][1], R[0][2], tx, R[1][0], R[1][1], R[1][2], ty, R[2][0], R[2][1], R[2][2], tz, 0, 0, 0, 1);
    m.fill.matrix.copy(ATH_M4); m.hull.matrix.copy(ATH_M4);
  }
  A.shadow.position.set(N.pelvisHub[0], N.pelvisHub[1], ground + 0.01);
  A.shadow.scale.setScalar(shadowScale * Math.max(0.5, 1 - lift * 0.6));
  return N;
}
