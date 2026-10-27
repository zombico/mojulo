import { safeJson } from '../emit-util.js';

// In-page script: THE FORM RENDER INDOORS (gen-7: form/room-form.js, era/stage.js). The build kept no light in the room's
// corners, only each surface's material colour (its tint under its dirt), and read each tile as material (its colour
// under no light, a tangent-space normal, occlusion + roughness packed). Here the page lights it: every surface becomes
// a lit material (three's MeshStandardMaterial, flat-shaded so the faces need no normals; the normal map finds its
// frame from the screen's derivatives) under the room's placed lights, live.
//
//   falloff   each light falls off by the bake's own law (stage.js bakeStageLight: flat inside 1.1 m, a smooth square to
//             its radius), raised to `fall` in linear light; its intensity decoded as the bake's sRGB corners are
//             (`gamma`). The bake sums its lights before the decode, so live lights summed after it fall off faster:
//             `fall` under the gamma, the indirect lifted (`ambientGain`) and the exposure hold a room near its gen-6
//             brightness (the machine gate: rooms.mjs, each frame's mean against its gen-6 twin)
//   indirect  the bake's ambient, and a bounce: each light's falloff over a wider reach, unshadowed, a share of it
//             (`bounce`): what a lightmap would hold. The material's occlusion darkens it, never the direct light
//   shadows   the `shadows.count` lights nearest the eye cast (cube maps `shadows.size` a side); the casters are a fixed
//             pool moved onto the nearest lights as the eye walks (each map drawn when its light changes), the rest light
//             unshadowed, so the shader never recompiles. With `actors` (a hero's level: what moves flags its meshes to
//             cast) the nearest light's map is drawn each frame, so a hero throws its shadow from the torch beside it;
//             the others stay as drawn
//   tone      the frame is tone-mapped (three's Neutral) at `exposure`: a lit crest rolls off where the bake's shoulder did
//
// `keep` groups (the torches' flames and iron, glass) stay as built. `__mojForm` is the machine gate's probe: the lights,
// the casters' lights, the maps and how each was read, the materials made.
// Absent `form` ⇒ NOT emitted.
// `cfg`: { lights: [{ at, rgb, intensity, radius, cast }], ambient: [r, g, b], maps: { key: { normal, orm, read } },
//          shadows: { count, size }, actors, bounce, reach, gamma, fall, ambientGain, exposure, keep: [group] }
export function formScript(cfg) {
  return `
// --- form: a room's surfaces as material, its placed lights live (gen-7) ---
const __mojForm = (function () {
  const F = ${safeJson(cfg)}, keep = new Set(F.keep), loader = new THREE.TextureLoader();
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = F.exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = !!F.actors;
  const srgb = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  // (the bake's falloff, in linear light: decay carries the gamma)
  const FALL = 'float formT = cutoffDistance > 0.0 ? clamp(1.0 - max(lightDistance, 1.1) / cutoffDistance, 0.0, 1.0) : 1.0;\\n\\tfloat distanceFalloff = pow(formT * formT, decayExponent);\\n\\treturn distanceFalloff;';
  const PARS = THREE.ShaderChunk.lights_pars_begin.replace('float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );', FALL);
  const INDIRECT = 'uniform vec3 uFormAmb;\\nuniform float uFormBounce;\\nuniform float uFormReach;\\n';
  const BOUNCE = '#if NUM_POINT_LIGHTS > 0\\nfor (int i = 0; i < NUM_POINT_LIGHTS; i++) {\\n'
    + '  vec3 fd = pointLights[i].position - geometryPosition; float fr = length(fd);\\n'
    + '  float ft = clamp(1.0 - max(fr, 1.1) / (pointLights[i].distance * uFormReach), 0.0, 1.0);\\n'
    + '  irradiance += pointLights[i].color * uFormBounce * pow(ft * ft, pointLights[i].decay) * (0.6 + 0.4 * max(dot(geometryNormal, fd / max(fr, 1e-3)), 0.0));\\n'
    + '}\\n#endif\\nirradiance += PI * uFormAmb;\\n';
  const amb = srgb(F.ambient), U = { uFormAmb: { value: new THREE.Vector3(amb.r, amb.g, amb.b).multiplyScalar(F.ambientGain) }, uFormBounce: { value: F.bounce }, uFormReach: { value: F.reach } };
  const lit = (params) => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true, ...params });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = INDIRECT + sh.fragmentShader.replace('#include <lights_pars_begin>', PARS).replace('#include <lights_fragment_end>', BOUNCE + '#include <lights_fragment_end>');
    };
    mat.customProgramCacheKey = () => 'form';
    return mat;
  };
  const map = (url) => { const t = loader.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.channel = 0; return t; };
  const maps = {}, made = { material: 0, colour: 0 };
  for (const [k, m] of Object.entries(F.maps)) maps[k] = { normal: map(m.normal), orm: map(m.orm) };
  // every surface of the room lit: a tile read as material takes its maps, the rest their colour alone
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.material || !o.material.isMeshBasicMaterial || typeof o.userData.g !== 'string' || keep.has(o.userData.g)) return;
    const b = o.material, M = maps[o.userData.key];
    o.material = lit({ map: b.map, vertexColors: b.vertexColors, side: b.side, transparent: b.transparent, opacity: b.opacity, depthWrite: b.depthWrite, alphaTest: b.alphaTest,
      ...(M ? { normalMap: M.normal, aoMap: M.orm, roughnessMap: M.orm, roughness: 1 } : {}) });
    if (M) made.material++; else made.colour++;
    o.receiveShadow = true;
    o.castShadow = !b.transparent && !b.alphaTest;
  });
  // the lights: each its own, unshadowed; the casters a pool laid over the nearest that may cast
  const lights = F.lights.map((l) => {
    const p = new THREE.PointLight(srgb(l.rgb), Math.PI * Math.pow(l.intensity, F.gamma), l.radius, F.fall);
    p.position.set(l.at[0], l.at[1], l.at[2]); scene.add(p); return p;
  });
  const pool = Array.from({ length: Math.min(F.shadows.count, F.lights.filter((l) => l.cast).length) }, () => {
    const p = new THREE.PointLight(0xffffff, 0, 1, F.fall);
    p.castShadow = true; p.shadow.mapSize.set(F.shadows.size, F.shadows.size); p.shadow.camera.near = 0.05; p.shadow.bias = -0.0015; p.shadow.normalBias = 0.02; p.shadow.radius = 3;
    p.shadow.autoUpdate = false; p.userData.on = -1; scene.add(p); return p;
  });
  const eye = new THREE.Vector3();
  let lastPick = -1;
  const pick = (cam) => {
    if (!pool.length) return;
    cam.getWorldPosition(eye);
    const near = F.lights.map((l, i) => [i, l]).filter(([, l]) => l.cast).map(([i, l]) => [i, (l.at[0] - eye.x) ** 2 + (l.at[1] - eye.y) ** 2 + (l.at[2] - eye.z) ** 2])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, pool.length).map(([i]) => i);
    const want = new Set(near), free = pool.filter((p) => !want.has(p.userData.on));
    let moved = false;
    for (const i of near) {
      if (pool.some((p) => p.userData.on === i)) continue;
      const p = free.shift(), l = F.lights[i];
      if (p.userData.on >= 0) lights[p.userData.on].intensity = Math.PI * Math.pow(F.lights[p.userData.on].intensity, F.gamma);
      p.userData.on = i; p.color.copy(lights[i].color); p.intensity = lights[i].intensity; p.distance = l.radius; p.shadow.camera.far = l.radius;
      p.position.set(l.at[0], l.at[1], l.at[2]); p.shadow.needsUpdate = true; lights[i].intensity = 0; moved = true;
    }
    // (with actors, the nearest light's map follows them each frame)
    if (F.actors) for (const p of pool) p.shadow.autoUpdate = p.userData.on === near[0];
    if (moved) { renderer.shadowMap.needsUpdate = true; probe.moves++; }
  };
  const probe = { lights: lights.length, casters: pool.length, moves: 0, made,
    reads: Object.fromEntries(Object.entries(F.maps).map(([k, m]) => [k, m.read])), on: () => pool.map((p) => p.userData.on) };
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, rt) {
    if (prev) prev.call(this, r, s, cam, rt);
    if (rt) return;
    const t = performance.now();
    if (t - lastPick > 250) { lastPick = t; pick(cam); }
  };
  return probe;
})();
window.__mojForm = __mojForm;
`;
}

/** The page's defaults under a form cfg: the indirect's share and reach, the gamma the bake's corners are decoded by, the
 *  exposure, the casters, the groups kept as built. */
export const FORM_PAGE = Object.freeze({ bounce: 0.25, reach: 1.6, gamma: 2.2, fall: 1.4, ambientGain: 1.6, exposure: 1.3, shadows: Object.freeze({ count: 4, size: 512 }), keep: Object.freeze(['stage:fixture', 'stage:glass']) });
