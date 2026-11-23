import { safeJson } from '../emit-util.js';

// THE SPACE BACKDROP on the page (skyscape/backdrop.js plans it): the nebula's band, the planets lit by the map's own
// star, a far sun and the near star's corona, drawn ONCE at load into a cube at infinity and set as the scene's
// background, so it turns with the view and never moves with the craft, and costs nothing a frame after.
//
//   the nebula   a sphere's inside: a band on its great circle (a galaxy's plane), two hues of cloud by a domain-
//                warped noise, dust lanes dark through it, a few warm knots; dim, under the stars
//   the planets  each a sphere at its direction, its surface by its kind (a gas giant's bands and storms, a rocky
//                world's plains and highlands, ice, an ocean's land and cloud, lava's cracks glowing on its night),
//                lit by the star with a soft terminator, an atmosphere's rim brightest on the lit limb; a gas giant's
//                rings banded and translucent, the planet's shadow across them
//   the suns     the far one a hot disc in its glow; the near one's corona, a wide faint glow round where it stands
//
// The stars (sky-dome.js) are drawn over the backdrop; a star whose direction falls on a planet's disc is left out.
// Pure source: the noise is a hash, no dice; the same plan, the same sky.
//
//   spaceBackdropScript(B, { size? }) → the page's block (in a scope with THREE, scene, renderer, SKY)

/** The cube's face (px): a primary planet of 10° radius is ~230 px across. */
export const BACKDROP_FACE = 1024;

const lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }).map((v) => Math.round(v * 1e4) / 1e4);
const KIND_ID = { gas: 0, rocky: 1, ice: 2, ocean: 3, lava: 4 };

const NOISE = `
float bdHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bdNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bdHash(i), bdHash(i + vec3(1, 0, 0)), f.x), mix(bdHash(i + vec3(0, 1, 0)), bdHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(bdHash(i + vec3(0, 0, 1)), bdHash(i + vec3(1, 0, 1)), f.x), mix(bdHash(i + vec3(0, 1, 1)), bdHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float bdFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * bdNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }`;

const NEBULA_FRAG = `${NOISE}
uniform vec3 uPlane, uA, uB, uWarm; uniform float uWidth, uDust, uGlow, uSeed; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir), o = vec3(uSeed * 0.0013, uSeed * 0.0007, uSeed * 0.0011);
  float h = dot(d, uPlane), band = exp(-(h * h) / (uWidth * uWidth)), halo = exp(-(h * h) / (uWidth * uWidth * 6.0));
  // (clouds, domain-warped, and their filaments: the ridges of a finer noise drawn through the warp, as gas is drawn
  // out in threads; the galaxy's own unresolved glow along its plane under both)
  float n1 = bdFbm(d * 2.2 + o), n2 = bdFbm(d * 4.0 + vec3(n1 * 2.0) + o * 2.0);
  float fil = pow(1.0 - abs(2.0 * bdFbm(d * 7.0 + vec3(n2 * 1.6) + o * 3.0) - 1.0), 6.0);
  float cloud = (smoothstep(0.45, 0.82, n2) * 0.55 + fil * 0.7) * band + 0.1 * smoothstep(0.5, 0.8, n1) * halo;
  vec3 col = mix(uA, uB, smoothstep(0.3, 0.72, n1)) * cloud + vec3(0.55, 0.6, 0.75) * band * 0.05;
  float dust = smoothstep(0.46, 0.68, bdFbm(d * 8.5 + o * 3.0)) * uDust * band;
  float knots = pow(smoothstep(0.66, 0.86, bdFbm(d * 13.0 + o * 4.0)), 2.0) * band * smoothstep(0.45, 0.75, n2);
  col = col * (1.0 - dust) + uWarm * knots * 1.1;
  gl_FragColor = vec4(col * uGlow + vec3(0.0015, 0.0018, 0.003), 1.0);
}`;

const PLANET_FRAG = `${NOISE}
uniform vec3 uSun, uBase, uAlt, uAtmo; uniform float uAtmoK, uSeed; uniform int uKind; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), o = vec3(uSeed * 0.0017, uSeed * 0.0009, uSeed * 0.0013), c;
  float glow = 0.0;
  if (uKind == 0) {          // gas: bands warped by its weather, a storm or two
    float t = n.z * 7.0 + (bdFbm(n * 3.0 + o) - 0.5) * 2.4;
    c = mix(uBase, uAlt, 0.5 + 0.5 * sin(t * 2.6));
    c = mix(c, uAlt * 1.25, smoothstep(0.78, 0.9, bdFbm(n * 9.0 + o)) * 0.6);
  } else if (uKind == 1) {   // rocky: plains and highlands, a few craters' rims
    float h = bdFbm(n * 4.0 + o);
    c = mix(uAlt, uBase, smoothstep(0.38, 0.62, h)) * (0.85 + 0.3 * bdNoise(n * 40.0 + o));
  } else if (uKind == 2) {   // ice: pale, its fractures darker
    c = mix(uBase, uAlt, smoothstep(0.55, 0.8, bdFbm(n * 5.0 + o)) * 0.7);
  } else if (uKind == 3) {   // ocean: land, then cloud over both
    float land = smoothstep(0.52, 0.56, bdFbm(n * 3.2 + o));
    c = mix(uBase, uAlt, land);
    c = mix(c, vec3(0.85), smoothstep(0.55, 0.78, bdFbm(n * 6.0 + o + 5.0)) * 0.85);
  } else {                   // lava: a dark crust, its cracks alight
    float k = abs(bdFbm(n * 5.0 + o) - 0.5);
    c = uBase; glow = smoothstep(0.035, 0.0, k);
  }
  float lit = dot(n, uSun), k = smoothstep(-0.08, 0.3, lit) * max(lit + 0.08, 0.0);
  vec3 col = c * k * 1.05 + c * 0.004;
  col += uAlt * glow * 0.6 * (1.0 - smoothstep(-0.2, 0.3, lit) * 0.6);
  // (its atmosphere: a rim, brightest on the lit limb, a thin line round the dark one)
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += uAtmo * fres * uAtmoK * (0.08 + smoothstep(-0.35, 0.45, lit));
  // (its limb antialiased: the cube is drawn without samples, so the disc's last sliver fades to what is behind it)
  gl_FragColor = vec4(col, smoothstep(0.0, 0.09, dot(n, V)));
}`;

// a planet's halo: its atmosphere's glow past the limb, a thin ring brightest on its lit side
const HALO_FRAG = `uniform vec3 uAtmo, uSunUv; uniform float uAtmoK, uIn; varying vec2 vUv;
void main() {
  vec2 q = (vUv - 0.5) * 2.0; float r = length(q), t = (r - uIn) / (1.0 - uIn);
  float g = r < uIn ? 0.0 : exp(-t * t * 9.0) * (1.0 - smoothstep(0.85, 1.0, r));
  float lit = 0.25 + 0.75 * smoothstep(-0.4, 0.6, dot(normalize(q + 1e-5), uSunUv.xy));
  gl_FragColor = vec4(uAtmo * g * uAtmoK * lit * 0.9, 1.0);
}`;

const RING_FRAG = `${NOISE}
uniform vec3 uSun, uBase, uCenter; uniform float uIn, uOut, uR, uSeed; varying vec3 vW;
void main() {
  vec3 p = vW - uCenter; float r = length(p), t = (r - uIn) / (uOut - uIn);
  float bands = 0.55 + 0.45 * sin(t * 70.0 + bdNoise(vec3(t * 20.0, uSeed * 0.001, 0.0)) * 4.0);
  float a = bands * smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.9, t) * (t > 0.42 && t < 0.47 ? 0.15 : 1.0) * 0.75;
  // (the planet's shadow across it: a point behind the planet from the star)
  float b = dot(p, uSun), sh = b < 0.0 && length(p - b * uSun) < uR ? 0.08 : 1.0;
  gl_FragColor = vec4(uBase * (0.55 + 0.45 * abs(dot(normalize(cross(dFdx(vW), dFdy(vW))), uSun))) * sh, a);
}`;

const GLOW_FRAG = `uniform vec3 uCol; uniform float uCore, uK; varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0, g = exp(-r * r * 6.0) * uK;
  if (uCore > 0.0) g += (1.0 - smoothstep(uCore * 0.8, uCore, r)) * 1.6;   // (a disc where it has one)
  gl_FragColor = vec4(uCol * g * (1.0 - smoothstep(0.7, 1.0, r)), 1.0);    // (to nothing at its edge: no square)
}`;

export function spaceBackdropScript(B, { size = BACKDROP_FACE } = {}) {
  const D = {
    nebula: B.nebula ? { ...B.nebula, a: lin(B.nebula.a), b: lin(B.nebula.b), warm: lin(B.nebula.warm) } : null,
    planets: (B.planets || []).map((p) => ({ dir: p.dir, r: p.r, kind: KIND_ID[p.kind] ?? 1, base: lin(p.base), alt: lin(p.alt), atmo: lin(p.atmo), atmoK: p.atmoK, seed: p.seed, ...(p.rings ? { rings: p.rings } : {}) })),
    suns: (B.suns || []).map((s) => ({ dir: s.dir, r: s.r, glow: s.glow, color: lin(s.color) })),
  };
  return `
// --- the space backdrop (skyscape/backdrop.js; channels/space-backdrop.js): baked once into the sky at infinity ---
(function () {
  const BD = ${safeJson(D)}, SUN = (SKY.sun && SKY.sun.dir) || [0, 0, 1];
  const NEB = ${JSON.stringify(NEBULA_FRAG)}, PLA = ${JSON.stringify(PLANET_FRAG)}, RING = ${JSON.stringify(RING_FRAG)}, GLOW = ${JSON.stringify(GLOW_FRAG)}, HALO = ${JSON.stringify(HALO_FRAG)};
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]), sunV = v3(SUN).normalize();
  const VERT_DIR = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const VERT_N = 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const VERT_W = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const VERT_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  function bake() {
    if (typeof renderer === 'undefined') return setTimeout(bake, 50);
    const room = new THREE.Scene(), made = [];
    const add = (m) => { room.add(m); made.push(m); return m; };
    const glow = (dir, dist, deg, col, k, core) => { const s = dist * Math.tan(deg * Math.PI / 180) * 2, m = add(new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.ShaderMaterial({ uniforms: { uCol: { value: v3(col) }, uK: { value: k }, uCore: { value: core } }, vertexShader: VERT_UV, fragmentShader: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); m.position.copy(v3(dir).normalize().multiplyScalar(dist)); m.lookAt(0, 0, 0); return m; };
    if (BD.nebula) {
      const N = BD.nebula;
      add(new THREE.Mesh(new THREE.SphereGeometry(150, 96, 48), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: VERT_DIR, fragmentShader: NEB,
        uniforms: { uPlane: { value: v3(N.plane).normalize() }, uA: { value: v3(N.a) }, uB: { value: v3(N.b) }, uWarm: { value: v3(N.warm) }, uWidth: { value: N.width }, uDust: { value: N.dust }, uGlow: { value: N.glow }, uSeed: { value: N.seed } } }))).renderOrder = -3;
    }
    // (the near star's corona, wide and faint, round where its disc is drawn; the far suns, a disc in a glow each)
    glow(SUN, 120, 16, [1, 0.93, 0.82], 0.05, 0).renderOrder = -2;
    for (const S of BD.suns) glow(S.dir, 120, S.glow, S.color, 0.35, S.r / S.glow).renderOrder = -2;
    for (const P of BD.planets) {
      const c = v3(P.dir).normalize().multiplyScalar(60), R = 60 * Math.tan(P.r * Math.PI / 180);
      // (its halo behind it, a plane facing the eye: the atmosphere's glow past its limb, lit on the star's side)
      const hs = R * 1.18, halo = add(new THREE.Mesh(new THREE.PlaneGeometry(2 * hs, 2 * hs), new THREE.ShaderMaterial({ vertexShader: VERT_UV, fragmentShader: HALO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uAtmo: { value: v3(P.atmo) }, uAtmoK: { value: P.atmoK }, uIn: { value: R / hs }, uSunUv: { value: new THREE.Vector3() } } })));
      halo.position.copy(c).multiplyScalar(1.02); halo.lookAt(0, 0, 0); halo.updateMatrixWorld(true);
      { const inv = new THREE.Matrix4().copy(halo.matrixWorld).invert(), sp = sunV.clone().transformDirection(inv); halo.material.uniforms.uSunUv.value.set(sp.x, sp.y, 0).normalize(); }
      const m = add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.ShaderMaterial({ transparent: true, vertexShader: VERT_N, fragmentShader: PLA,
        uniforms: { uSun: { value: sunV }, uBase: { value: v3(P.base) }, uAlt: { value: v3(P.alt) }, uAtmo: { value: v3(P.atmo) }, uAtmoK: { value: P.atmoK }, uSeed: { value: P.seed }, uKind: { value: P.kind } } })));
      m.position.copy(c);
      if (P.rings) {
        const ring = add(new THREE.Mesh(new THREE.RingGeometry(R * P.rings.inner, R * P.rings.outer, 160, 1), new THREE.ShaderMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, vertexShader: VERT_W, fragmentShader: RING, extensions: { derivatives: true },
          uniforms: { uSun: { value: sunV }, uBase: { value: v3(P.alt).lerp(v3(P.base), 0.6) }, uCenter: { value: c.clone() }, uIn: { value: R * P.rings.inner }, uOut: { value: R * P.rings.outer }, uR: { value: R }, uSeed: { value: P.seed } } })));
        // (its plane tilted off the line of sight by the plan's tilt, about the planet's own equator)
        ring.position.copy(c); ring.lookAt(0, 0, 0); ring.rotateX((90 - P.rings.tilt) * Math.PI / 180);
      }
    }
    // (half-float: the nebula's faint gradients are a few hundredths of linear light, and in eight bits their channels
    // round apart, banding the dark into green and teal)
    const rt = new THREE.WebGLCubeRenderTarget(${size}, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const cam = new THREE.CubeCamera(0.5, 400, rt); cam.up.set(0, 0, 1);
    cam.update(renderer, room);
    scene.background = rt.texture;
    for (const m of made) { m.geometry.dispose(); m.material.dispose(); }
  }
  setTimeout(bake, 0);
})();
`;
}

/** Whether a direction falls on a planet's disc (a star there is left out): the page's star loop asks it. */
export const onPlanetSource = `(d) => { for (const P of SKY.backdrop.planets) { const L = Math.hypot(P.dir[0], P.dir[1], P.dir[2]) || 1; if ((d[0] * P.dir[0] + d[1] * P.dir[1] + d[2] * P.dir[2]) / L > Math.cos(P.r * 1.06 * Math.PI / 180)) return true; } return false; }`;
