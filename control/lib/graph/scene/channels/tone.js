import { safeJson } from '../emit-util.js';

// In-page script: TONE (a room stage's `tone`: era/tone.js). The build drained the colour out (grey tints, greyscale
// tiles); here each surface's material lights first and colours after: the pixel's lit value, times `gain`, picks its
// colour off the surface's ramp (five stops, shadow → light), in `steps` hard bands when asked. Darkness becomes the
// ramp's deepest colour, never black. The light is what is banded (each band at its middle, so the darkest still holds
// its detail); a tile's value (about `mid`) shifts the colour
// inside its band by `detail`. A `keep` group (the torches' flames) and anything not a group mesh (glow
// sprites, dust, fire) stay as built. The background and the fog take the default ramp's two darkest stops.
// Absent `tone` ⇒ NOT emitted.
// `cfg`: { steps, gain, mid, detail, ramps: [[[r, g, b] × 5], …], def, groups: { group: rampIndex }, keep: [group] }
export function toneScript(cfg) {
  return `
// --- tone: the lit value of each surface, coloured off its ramp ---
(function () {
  const T = ${safeJson(cfg)}, keep = new Set(T.keep);
  // the LIGHT is banded (the pools the torches throw), the tile's own value adds its detail inside the band: posterizing
  // the finished pixel instead would shatter every texture into shards
  const GLSL = 'uniform vec3 uRamp[5];\\nuniform float uSteps;\\nuniform float uGain;\\nuniform float uMid;\\nuniform float uDetail;\\n'
    + 'float toneBand(float x) {\\n  x = clamp(x, 0.0, 1.0);\\n  return uSteps > 0.5 ? (min(floor(x * uSteps), uSteps - 1.0) + 0.5) / uSteps : x;\\n}\\n'
    + 'vec3 toneRamp(float t) {\\n  float x = clamp(t, 0.0, 1.0) * 4.0; float i = min(3.0, floor(x)); float f = x - i;\\n'
    + '  vec3 a = uRamp[0]; vec3 b = uRamp[1];\\n  if (i > 0.5) { a = uRamp[1]; b = uRamp[2]; }\\n  if (i > 1.5) { a = uRamp[2]; b = uRamp[3]; }\\n  if (i > 2.5) { a = uRamp[3]; b = uRamp[4]; }\\n'
    + '  return mix(a, b, f);\\n}\\n';
  const MAIN = 'vec3 toneW = vec3(0.2126, 0.7152, 0.0722);\\n'
    + '#ifdef USE_COLOR\\nfloat toneL = pow(max(dot(vColor.rgb, toneW), 0.0), 0.4545);\\n#else\\nfloat toneL = pow(max(dot(diffuse, toneW), 0.0), 0.4545);\\n#endif\\n'
    + '#ifdef USE_MAP\\nfloat toneV = pow(max(dot(texture2D(map, vMapUv).rgb, toneW), 0.0), 0.4545);\\nfloat toneT = toneBand(toneL * uGain) + (toneV - uMid) * uDetail;\\n#else\\nfloat toneT = toneBand(toneL * uGain);\\n#endif\\n'
    + 'gl_FragColor.rgb = toneRamp(toneT);\\n';
  const ramps = T.ramps.map((r) => r.map((c) => new THREE.Vector3(c[0], c[1], c[2])));
  const patch = (mat, k) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRamp = { value: ramps[k] }; sh.uniforms.uSteps = { value: T.steps }; sh.uniforms.uGain = { value: T.gain }; sh.uniforms.uMid = { value: T.mid }; sh.uniforms.uDetail = { value: T.detail };
      sh.fragmentShader = GLSL + sh.fragmentShader.replace('#include <fog_fragment>', MAIN + '#include <fog_fragment>');
    };
    mat.customProgramCacheKey = () => 'tone' + k;
    mat.needsUpdate = true;
  };
  scene.traverse((o) => {
    if (!o.isMesh || !o.material || typeof o.userData.g !== 'string' || keep.has(o.userData.g)) return;
    patch(o.material, o.userData.g in T.groups ? T.groups[o.userData.g] : T.def);
  });
  const d = T.ramps[T.def];
  if (scene.background && scene.background.isColor) scene.background.setRGB(d[0][0], d[0][1], d[0][2], THREE.SRGBColorSpace);
  if (scene.fog) scene.fog.color.setRGB(d[1][0], d[1][1], d[1][2], THREE.SRGBColorSpace);
})();
`;
}
