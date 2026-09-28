import { safeJson } from '../emit-util.js';

// In-page script: the crystal channel (crystal-shine S4) — crystals shaded live on the World page. Groups whose
// geometry carries the per-vertex crystal attribute (packed by faceListToMesh from faces tagged `crystal`) get their
// MeshBasicMaterial patched with the crystal response (polygonizer/crystal-shine.js, here in GLSL): a Fresnel glint of
// a small studio (softbox, dark floor, the scene's sun), the view ray refracted per channel into the stone and out of
// its far side (the far side taken as the stone's bounding sphere, tilted per entry facet so the inside reads faceted,
// not as a lens: one pass, any number of stones per group), total
// internal reflection once, colour by path length, dichroism by the ray's angle to c, ruby's glow on its lit side,
// opal's Bragg flashes from an object-space domain mosaic. World-space normals from dFdx × dFdy, the fixed light and
// the live camera: right as the camera orbits, and on instances. Each stone's print (the light it throws, traced once
// on the server by crystal-print.js) is drawn under it: the shadow, then the caustic added. A one-shot setup block:
// pages with no crystal faces emit ZERO bytes of it.
export function crystalChannelScript({ toLight, gems, prints, pools = [], ambient = 0 }) {
  return `
// --- crystal channel (crystal shine): live crystal response + the prints stones throw ---
const CRY = ${safeJson({ sun: toLight.map((v) => +v.toFixed(6)), amb: +ambient.toFixed(3), gems, prints, ...(pools.length ? { pools } : {}) })};
const __cryDecode = (s) => decodeF32(s);
const __cryPatch = (m, grp) => {
  const G = grp.crystal.gems.map((name) => CRY.gems[name]); const S = G.length;
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const uni = {
    uCrySun: { value: v3(CRY.sun) }, uCryAmb: { value: CRY.amb }, uCryCmu: { value: grp.crystal.cmu },
    uCryNo: { value: G.map((g) => v3(g.n.o)) }, uCryNe: { value: G.map((g) => v3(g.n.e)) },
    uCryColO: { value: G.flatMap((g) => g.colour.o.map(v3)) }, uCryColE: { value: G.flatMap((g) => g.colour.e.map(v3)) },
    uCryGlow: { value: G.map((g) => g.glow ? new THREE.Vector4(g.glow.rgb[0], g.glow.rgb[1], g.glow.rgb[2], g.glow.strength) : new THREE.Vector4(0, 0, 0, 0)) },   // Vector4() is (0,0,0,1): spell the zero
    uCryPhot: { value: G.map((g) => g.photonic ? new THREE.Vector4(g.photonic.d111[0], g.photonic.d111[1], g.photonic.nEff, 1) : new THREE.Vector4(0, 0, 0, 0)) },
    uCryUni: { value: G.map((g) => (g.uniaxial ? 1 : 0)) },
  };
  const ib = new THREE.InterleavedBuffer(__cryDecode(grp.crystal.a), 8);
  m.geometry.setAttribute('aCry0', new THREE.InterleavedBufferAttribute(ib, 4, 0)); m.geometry.setAttribute('aCry1', new THREE.InterleavedBufferAttribute(ib, 4, 4));
  m.material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = 'attribute vec4 aCry0;\\nattribute vec4 aCry1;\\nvarying vec4 vCry0;\\nvarying vec4 vCry1;\\nvarying vec3 vCryWp;\\n' + sh.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      'vec4 cryP = vec4(transformed, 1.0); vec4 cryC = vec4(aCry0.xyz, 1.0); vec3 cryA = aCry1.xyz; float cryS = 1.0;',
      '#ifdef USE_INSTANCING',
      'cryP = instanceMatrix * cryP; cryC = instanceMatrix * cryC; cryA = mat3(instanceMatrix) * cryA; cryS = length(instanceMatrix[0].xyz);',
      '#endif',
      'vCryWp = (modelMatrix * cryP).xyz; vCry0 = vec4((modelMatrix * cryC).xyz, aCry0.w * cryS * length(modelMatrix[0].xyz));',
      'vCry1 = vec4(normalize(mat3(modelMatrix) * cryA), aCry1.w);'].join('\\n'));
    sh.fragmentShader = [
      'uniform vec3 uCrySun; uniform float uCryAmb; uniform float uCryCmu;',
      'uniform vec3 uCryNo[' + S + ']; uniform vec3 uCryNe[' + S + ']; uniform vec3 uCryColO[' + (S * 4) + ']; uniform vec3 uCryColE[' + (S * 4) + '];',
      'uniform vec4 uCryGlow[' + S + ']; uniform vec4 uCryPhot[' + S + ']; uniform float uCryUni[' + S + '];',
      'varying vec4 vCry0; varying vec4 vCry1; varying vec3 vCryWp;',
      // the studio: a softbox overhead fading to the horizon, a floor, the sun a ~1.1° disc with a halo; a lit scene's
      // ambient lifts the horizon and the floor (a stone in daylight sees a bright world, on a turntable a dark room)
      'vec3 cryStudio(vec3 d) { float h = d.z; float w = pow(max(h, 0.0), 1.6);',
      '  vec3 hz = vec3(0.025, 0.03, 0.045) + uCryAmb * vec3(0.16, 0.16, 0.17), fl = vec3(0.018, 0.02, 0.026) + uCryAmb * vec3(0.2, 0.19, 0.17);',
      '  vec3 base = h > 0.0 ? mix(hz, vec3(0.42, 0.44, 0.48) + uCryAmb * 0.3, w) : fl;',
      '  float c = dot(d, uCrySun); return base + vec3((c > 0.9998 ? 40.0 : 0.0) + 0.9 * pow(max(c, 0.0), 256.0) + 0.135 * pow(max(c, 0.0), 16.0)); }',
      // a ray's colour after a path (tabled at 0.1 / 0.3 / 1 / 3 cm), geometric interpolation
      'vec3 cryPath(int s, float cm, bool e) { float P[4] = float[4](0.1, 0.3, 1.0, 3.0); vec3 a, b; float t;',
      '  if (cm <= 0.1) { a = vec3(1.0); b = e ? uCryColE[s * 4] : uCryColO[s * 4]; t = cm / 0.1; return mix(a, b, t); }',
      '  int i = cm < 0.3 ? 0 : (cm < 1.0 ? 1 : 2); a = e ? uCryColE[s * 4 + i] : uCryColO[s * 4 + i]; b = e ? uCryColE[s * 4 + i + 1] : uCryColO[s * 4 + i + 1];',
      '  t = (cm - P[i]) / (P[i + 1] - P[i]); return a * pow(max(b, vec3(1e-5)) / max(a, vec3(1e-5)), vec3(t)); }',
      'float cryChord(vec3 p, vec3 d, vec3 c, float r) { vec3 oc = p - c; float b = dot(oc, d); return -b + sqrt(max(b * b - dot(oc, oc) + r * r, 0.0)); }',
      'float cryFres(float c, float n) { float r0 = (n - 1.0) / (n + 1.0); r0 *= r0; return r0 + (1.0 - r0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }',
      'vec3 crySpec(float l) { float t = (l - 400.0) / 300.0; return clamp(vec3(abs(t * 6.0 - 4.2) - 1.0, 2.0 - abs(t * 6.0 - 2.6), 2.0 - abs(t * 6.0 - 1.0)), 0.0, 1.0); }',
      'float cryHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
      sh.fragmentShader.replace('#include <tonemapping_fragment>', [
        'if (vCry1.w > -0.5) {',
        '  int s = int(vCry1.w + 0.5); vec3 C = vCry0.xyz; float R = vCry0.w; vec3 ax = vCry1.xyz;',
        '  vec3 N = normalize(cross(dFdx(vCryWp), dFdy(vCryWp))); vec3 V = normalize(cameraPosition - vCryWp); if (dot(N, V) < 0.0) N = -N;',
        '  float nM = 0.5 * (uCryNo[s].y + uCryNe[s].y); float F = cryFres(dot(N, V), nM); vec3 col = cryStudio(reflect(-V, N)) * F;',
        '  if (uCryPhot[s].w > 0.5) {',                                        // opal: a black body, domains that flash
        '    vec3 q = floor((vCryWp - C) / max(R, 1e-6) * 3.5); vec3 g = normalize(N * 0.55 + vec3(cryHash(q), cryHash(q + 17.0), cryHash(q + 41.0)) - 0.5);',
        '    vec3 H = normalize(uCrySun + V); float w = exp(-(1.0 - abs(dot(g, H))) / 0.012); float d = mix(uCryPhot[s].x, uCryPhot[s].y, cryHash(q + 7.0));',
        '    float l = 2.0 * d * uCryPhot[s].z * abs(dot(g, V)); col += vec3(0.012) + (l >= 400.0 && l <= 700.0 ? crySpec(l) * w * 1.4 : vec3(0.0));',
        '  } else {',
        '    vec3 thru = vec3(0.0); int rays = uCryUni[s] > 0.5 ? 2 : 1;',
        '    vec3 Nq = floor(N * 24.0 + 0.5);',                                // the facet's normal, quantized: one value per facet, no per-pixel noise
        '    vec3 jit = (vec3(cryHash(Nq), cryHash(Nq + 3.0), cryHash(Nq + 9.0)) - 0.5) * 0.9;',   // each entry facet sees its own inner facet, not a lens
        '    for (int r = 0; r < 2; r++) { if (r >= rays) break; vec3 nn = r == 0 ? uCryNo[s] : uCryNe[s];',
        '      for (int k = 0; k < 3; k++) { float n = nn[k]; vec3 t = refract(-V, N, 1.0 / n); if (dot(t, t) < 0.5) continue;',
        '        float L1 = cryChord(vCryWp, t, C, R); vec3 q = vCryWp + t * L1; vec3 m = normalize(normalize(q - C) + jit); vec3 o = refract(t, -m, n); float path = L1;',
        '        if (dot(o, o) < 0.5) { vec3 t2 = reflect(t, m); float L2 = cryChord(q, t2, C, R); path += L2; vec3 q2 = q + t2 * L2; o = refract(t2, -normalize(normalize(q2 - C) - jit), n); }',   // one total internal reflection
        '        float eS = r == 1 ? 1.0 - pow(dot(t, ax), 2.0) : 0.0; vec3 pc = mix(cryPath(s, path * uCryCmu, false), cryPath(s, path * uCryCmu, true), eS);',
        '        float seen = dot(o, o) > 0.5 ? cryStudio(o)[k] : 0.02; thru[k] += (1.0 - F) * pc[k] * seen / float(rays); } }',
        '    col += thru;',
        '    if (uCryGlow[s].w > 0.0) col += uCryGlow[s].rgb * uCryGlow[s].w * (0.45 + 0.55 * max(0.0, dot(N, uCrySun))) * 0.55;',
        '  }',
        '  vec3 x = col * 1.5; gl_FragColor.rgb = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);',   // the turntable's tone curve
        '}',
        '#include <tonemapping_fragment>'].join('\\n'))].join('\\n');
  };
  m.material.needsUpdate = true;
};
for (const grp of GROUPS) { if (grp.crystal && meshes[grp.name]) __cryPatch(meshes[grp.name], grp); }
// the prints: each stone's shadow (dimming what is under it), then its caustic added on top
const __mojCrystal = { prints: 0 };
if (CRY.prints.length) {
  const tri = (polys) => { const out = []; for (const P of polys) for (let i = 1; i < P.length - 1; i++) out.push(...P[0], ...P[i], ...P[i + 1]); return new Float32Array(out); };
  const shadow = new THREE.BufferGeometry(); shadow.setAttribute('position', new THREE.BufferAttribute(tri(CRY.prints.map((p) => p.shadow).filter((s) => s.length)), 3));
  const sm = new THREE.Mesh(shadow, new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  sm.renderOrder = 2; scene.add(sm);
  const pos = [], col = [];
  for (const p of CRY.prints) for (const q of p.polys) for (let i = 1; i < q.v.length - 1; i++) for (const c of [q.v[0], q.v[i], q.v[i + 1]]) { pos.push(c[0], c[1], c[2]); col.push(q.rgb[0], q.rgb[1], q.rgb[2]); }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  const cm = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  cm.renderOrder = 3; scene.add(cm); __mojCrystal.prints = CRY.prints.length;
}
// the glow a shining stone spills: a soft disc of its colour on the surface it grew from, added
if (CRY.pools) {
  const pos = [], col = [];
  for (const p of CRY.pools) {
    const n = new THREE.Vector3(...p.n); const u = new THREE.Vector3(Math.abs(n.z) < 0.9 ? 0 : 1, Math.abs(n.z) < 0.9 ? 0 : 0, Math.abs(n.z) < 0.9 ? 1 : 0).cross(n).normalize(); const v = new THREE.Vector3().crossVectors(n, u);
    const at = (a) => [p.c[0] + p.r * (u.x * Math.cos(a) + v.x * Math.sin(a)), p.c[1] + p.r * (u.y * Math.cos(a) + v.y * Math.sin(a)), p.c[2] + p.r * (u.z * Math.cos(a) + v.z * Math.sin(a))];
    for (let i = 0; i < 20; i++) { const a0 = i / 20 * Math.PI * 2, a1 = (i + 1) / 20 * Math.PI * 2; pos.push(...p.c, ...at(a0), ...at(a1)); col.push(...p.rgb, 0, 0, 0, 0, 0, 0); }
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  const pm = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  pm.renderOrder = 4; scene.add(pm); __mojCrystal.pools = CRY.pools.length;
}`;
}
