import { safeJson } from '../emit-util.js';

// In-page script: ROCK FABRIC (a gritty style's rock: matte-paint/fabric.js). The polygons carry the cliff from afar,
// their light baked into the vertex; this refines what is NEAR. For each pixel of a rock group it finds where the rock's
// own fabric cuts the face (world-space joint planes and level beds), and shades that relief against the key light as a
// RATIO to the facet's own light, so a pixel the fabric does not reach is multiplied by exactly 1.
//
//   joints   each set's planes at q = p·n / s + phase integer: a V-groove `w` wide, `d` deep, held over `hold` of its
//            length (a joint stops and starts), and between the planes each block its own tilt
//   beds     (when the land has strata) a soft bed recessed behind its hard neighbours, its lips lit and shaded
//   grain    the rock's grain as a value noise in world space
//
// THE VISUAL DOMAIN: how much of this a pixel draws depends on the metres it covers (`foot`, from the screen-space
// derivatives of its world position). A layer fades in once its feature spans `px` pixels and is whole at three times
// that; a pixel covering more than `maxFoot` metres (the coarsest feature too small to read) does no work at all. So the
// detail is a sphere round the eye: none outside it, joints and beds as it nears, the grain at its heart, and nothing
// finer than the grain: the most a surface is ever drawn.
//
// Absent `fabric` ⇒ NOT emitted. `debug` (opt-in, for looking at it): 'relief' draws the rock as the relief map alone
// (mid-grey: unchanged), 'domain' as the visual domain (red the master joints, green the minor, blue the grain).
// `cfg`: { groups, sun, ambient, sets: [{ n, s, w, d, hold, phase }] (≤ 6), beds?: { b, t, hard, dip }, recess?, tilt, wave, echelon,
//          cavity, grain: { size, amount }, px, maxFoot }
const VERT_HEAD = 'varying vec3 vFabP;\n';
const VERT_MAIN = 'vFabP = (modelMatrix * vec4(transformed, 1.0)).xyz;\n';
const FRAG_HEAD = `varying vec3 vFabP;
uniform vec3 uFabSun; uniform float uFabAmb;
uniform vec4 uFabN[6]; uniform vec4 uFabK[6]; uniform int uFabSets; uniform float uFabWave; uniform float uFabEch;
uniform float uFabBedB[16]; uniform float uFabBedT[16]; uniform float uFabBedH[16]; uniform int uFabBeds; uniform vec2 uFabDip; uniform float uFabRecess;
uniform vec2 uFabSteep; uniform float uFabTilt; uniform float uFabCav; uniform float uFabGrain; uniform float uFabGrainAmt; uniform float uFabPx; uniform float uFabMaxFoot; uniform int uFabDebug; uniform int uFabMasters;
float fabHash(vec3 c) { return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float fabNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(fabHash(i), fabHash(i + vec3(1, 0, 0)), f.x), mix(fabHash(i + vec3(0, 1, 0)), fabHash(i + vec3(1, 1, 0)), f.x), f.y);
  float b = mix(mix(fabHash(i + vec3(0, 0, 1)), fabHash(i + vec3(1, 0, 1)), f.x), mix(fabHash(i + vec3(0, 1, 1)), fabHash(i + vec3(1, 1, 1)), f.x), f.y);
  return mix(a, b, f.z);
}
`;
const FRAG_MAIN = `{
  vec3 fp = vFabP, dpx = dFdx(fp), dpy = dFdy(fp);
  float foot = max(length(dpx), length(dpy));
  if (uFabDebug == 1 && foot >= uFabMaxFoot) gl_FragColor.rgb = vec3(0.5);
  if (uFabDebug == 2 && foot >= uFabMaxFoot) gl_FragColor.rgb = vec3(0.12);
  if (foot < uFabMaxFoot) {
    float dbM = 0.0, dbN = 0.0;
    vec3 Ng = normalize(cross(dpx, dpy));
    if (dot(Ng, cameraPosition - fp) < 0.0) Ng = -Ng;
    vec3 g = vec3(0.0); float cav = 0.0, alb = 1.0;
    // the joints read on the steep faces the landform broke on them (its band, as the cosines of the slope)
    float steepJ = 1.0 - smoothstep(uFabSteep.y, uFabSteep.x, abs(Ng.z));
    for (int i = 0; i < 6; i++) {
      if (i >= uFabSets) break;
      vec4 N = uFabN[i], K = uFabK[i];
      // a joint's plane undulates (two scales of wander) and steps sideways segment by segment (en echelon), so its
      // trace across the face is never a ruled line
      vec3 tg = cross(N.xyz, vec3(0.0, 0.0, 1.0)); tg = dot(tg, tg) < 1e-4 ? vec3(1.0, 0.0, 0.0) : normalize(tg);
      float q0 = dot(fp, N.xyz) / N.w + K.w, seg = floor((dot(fp, tg) + fp.z * 0.7) / (N.w * 0.8));
      float q = q0 + uFabWave * (fabNoise(fp * (1.3 / N.w) + float(i) * 3.1) - 0.5) + 0.3 * uFabWave * (fabNoise(fp * (5.0 / N.w) + float(i) * 7.7) - 0.5)
        + uFabEch * (fabHash(vec3(floor(q0), seg, float(i) + 4.0)) - 0.5), cell = floor(q), fr = q - cell, dist = min(fr, 1.0 - fr) * N.w;
      // a joint holds for a stretch and stops: a slow noise along the plane, the set's own
      float hold = step(1.0 - K.z, fabNoise(fp * (0.7 / N.w) + vec3(cell * 1.71, float(i) * 9.3, 0.0)));
      float lodJ = smoothstep(uFabPx, uFabPx * 3.0, K.x / foot) * steepJ;
      if (i < uFabMasters) dbM = max(dbM, lodJ); else dbN = max(dbN, lodJ);
      if (dist < K.x) { g += (K.y / K.x) * (fr < 0.5 ? 1.0 : -1.0) * N.xyz * hold * lodJ; cav = max(cav, (1.0 - dist / K.x) * hold * lodJ); }
      // the block between this set's planes: its own plane, tilted by its dice
      float lodB = smoothstep(uFabPx * 4.0, uFabPx * 12.0, N.w / foot);
      g += (vec3(fabHash(vec3(cell, float(i), 1.0)), fabHash(vec3(cell, float(i), 2.0)), fabHash(vec3(cell, float(i), 3.0))) - 0.5) * uFabTilt * lodB;
    }
    if (uFabBeds > 0) {
      float zz = fp.z - dot(uFabDip, fp.xy);
      for (int b = 0; b < 16; b++) {
        if (b >= uFabBeds) break;
        float t = (zz - uFabBedB[b]) / uFabBedT[b];
        if (t < 0.0 || t >= 1.0 || uFabBedH[b] > 0.5) continue;
        // a soft bed steps back over a few centimetres at its foot and its top
        float tr = min(0.06 / uFabBedT[b], 0.3), lodS = smoothstep(uFabPx, uFabPx * 3.0, 0.06 / foot);
        float up = (t < tr ? 1.0 : 0.0) - (t > 1.0 - tr ? 1.0 : 0.0);
        g += vec3(0.0, 0.0, -up * (uFabRecess / (tr * uFabBedT[b]))) * lodS;
        cav = max(cav, 0.5 * lodS);
      }
    }
    float lodG = smoothstep(uFabPx, uFabPx * 3.0, uFabGrain / foot);
    alb = 1.0 + uFabGrainAmt * (fabNoise(fp / uFabGrain) - 0.5) * 2.0 * lodG;
    // the relief's light against the facet's own: a ratio, so the baked light stays the face's mean
    vec3 gt = g - Ng * dot(g, Ng), N2 = normalize(Ng - gt);
    float l0 = uFabAmb + (1.0 - uFabAmb) * max(dot(Ng, uFabSun), 0.0), l1 = uFabAmb + (1.0 - uFabAmb) * max(dot(N2, uFabSun), 0.0);
    float fab = clamp(l1 / max(l0, 0.05), 0.35, 1.8) * (1.0 - uFabCav * cav) * alb;
    // (debug, opt-in: 1 the relief map, mid-grey unchanged; 2 the visual domain, red masters, green minors, blue grain)
    if (uFabDebug == 1) gl_FragColor.rgb = vec3(clamp(fab * 0.5, 0.0, 1.0));
    else if (uFabDebug == 2) gl_FragColor.rgb = 0.25 + 0.75 * vec3(dbM, dbN, lodG) * 0.9;
    else gl_FragColor.rgb *= fab;
  }
}
`;

export function fabricScript(cfg) {
  return `
// --- rock fabric: what the rock's own joints and beds do to a face, drawn only where they can be seen ---
(function () {
  const F = ${safeJson(cfg)}, groups = new Set(F.groups), V4 = (a, b, c, d) => new THREE.Vector4(a, b, c, d);
  const VH = ${safeJson(VERT_HEAD)}, VM = ${safeJson(VERT_MAIN)}, FH = ${safeJson(FRAG_HEAD)}, FM = ${safeJson(FRAG_MAIN)};
  const N = [0, 1, 2, 3, 4, 5].map((i) => (F.sets[i] ? V4(F.sets[i].n[0], F.sets[i].n[1], F.sets[i].n[2], F.sets[i].s) : V4(0, 0, 1, 1)));
  const K = [0, 1, 2, 3, 4, 5].map((i) => (F.sets[i] ? V4(F.sets[i].w, F.sets[i].d, F.sets[i].hold, F.sets[i].phase) : V4(0, 0, 0, 0)));
  const B = F.beds, pad = (a) => [...(a || []), ...Array(16).fill(1)].slice(0, 16);
  const patch = (mat) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, {
        uFabSun: { value: new THREE.Vector3(F.sun[0], F.sun[1], F.sun[2]) }, uFabAmb: { value: F.ambient },
        uFabN: { value: N }, uFabK: { value: K }, uFabSets: { value: Math.min(6, F.sets.length) }, uFabWave: { value: F.wave || 0 }, uFabEch: { value: F.echelon || 0 },
        uFabBedB: { value: pad(B && B.b) }, uFabBedT: { value: pad(B && B.t) }, uFabBedH: { value: pad(B && B.hard) }, uFabBeds: { value: B ? Math.min(16, B.b.length) : 0 },
        uFabDip: { value: new THREE.Vector2(B ? B.dip[0] : 0, B ? B.dip[1] : 0) }, uFabRecess: { value: F.recess || 0 },
        uFabSteep: { value: new THREE.Vector2(F.steep ? F.steep[0] : 1, F.steep ? F.steep[1] : 0.9) }, uFabTilt: { value: F.tilt }, uFabCav: { value: F.cavity }, uFabGrain: { value: F.grain.size }, uFabGrainAmt: { value: F.grain.amount },
        uFabPx: { value: F.px }, uFabMaxFoot: { value: F.maxFoot }, uFabDebug: { value: F.debug === 'relief' ? 1 : F.debug === 'domain' ? 2 : 0 }, uFabMasters: { value: F.masters ?? Math.ceil(F.sets.length / 2) },
      });
      sh.vertexShader = VH + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n' + VM);
      sh.fragmentShader = FH + sh.fragmentShader.replace('#include <fog_fragment>', FM + '#include <fog_fragment>');
    };
    mat.customProgramCacheKey = () => 'rock-fabric';
    mat.needsUpdate = true;
  };
  scene.traverse((o) => { if (o.isMesh && o.material && groups.has(o.userData.g)) patch(o.material); });
})();
`;
}
