import { safeJson } from '../emit-util.js';
import { NECK_GLSL, basinStep, fallAeration, jetAt, jetGrowth, jetHitTime, jetNeck, jetOmega, jetProfile, jumpRadius, sheetProfile } from '../../materials/jet.js';

// In-page script: falling streams (materials/jet.js) and the basins they fill. Per jet:
//   the stream  a tube drawn on the GPU along its ballistic path: rings at even τ (time of flight), each ring's radius
//               and necking amplitude computed once per flow on the CPU, the ripple's phase ω(t − τ) and the
//               pinch-off in the vertex shader — so it costs nothing per frame. Glassy: it refracts the scene behind
//               it (the aqua depth pass's colour target) and reflects the sky by Fresnel; an aerated stream is white.
//   a sheet     the same fall from a lip (a weir, a waterfall): a ribbon across the lip's width instead of a tube.
//               Big water (a sheet, a landscape-sized spout) whitens as it falls (fallAeration), streaks running down
//               at the water's own speed (the same ω(t − τ) phase), and past break-up frays into fingers and spreads
//   the mist    a soft cloud boiling up at the foot of big water
//   drips       below the dripping threshold, drops released every V/Q seconds, closed form in t
//   the impact  where the stream meets water it drives the shallows body (`__aqWater.disturb`: a plunging jet's
//               crater, its foam, a drop's ring); on a dry or barely wet floor it spreads as a hydraulic jump (a disc)
//   the basin   its depth h obeys basinStep (inflow, the drain or the plug, the overflow), pushed to the body by
//               `__aqWater.setLevel` — the duck rides it up and settles as it drains
// A small HUD drives each jet's flow, plug and aerator; `window.__mojJet.set(id, { flow, plug, aerated })` does too.
const FNS = [jetProfile, sheetProfile, fallAeration, jetAt, jetGrowth, jetOmega, jetNeck, jetHitTime, jumpRadius, basinStep].map((f) => f.toString()).join('\n');
const RINGS = 640, SEGS = 12, COLS = 40, APP = 48;    // APP: a sheet's approach rings (the tongue over the brink)

const VERT = `
attribute float aTau; attribute float aTh; attribute float aR; attribute float aAmp; attribute float aAer;
uniform vec3 uP0; uniform vec3 uU0; uniform float uG; uniform float uTauEnd; uniform float uOm; uniform float uJT; uniform float uRough; uniform float uSheet; uniform vec3 uApp; uniform float uLayer;
varying vec3 vJP; varying vec3 vJN; varying float vJTau; varying float vJAer; varying float vJX; varying float vJU;
${NECK_GLSL}`;
const VERT_MAIN = `
  float tau = aTau;
  vec3 vel = uU0 + vec3(0.0, 0.0, -uG * tau);
  vec3 T = normalize(vel), up = abs(T.z) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 N1 = normalize(cross(T, up)), N2 = cross(T, N1);
  float ph = uOm * (uJT - tau);
  float neck = jetNeck(aAmp, ph) * (1.0 + uRough * 0.1 * sin(aTh * 3.0 + uJT * 37.0 - tau * 90.0));
  float rad = aR * neck * step(tau, uTauEnd);
  // the surface's slope along the jet tilts the normal: d(rad)/ds = aR·A·d(sin)/dφ·(−ω)/|v|
  float dr = aR * aAmp * (0.7 * cos(ph) + 0.411 * cos(1.37 * ph + 1.1)) * (-uOm) / max(length(vel), 1e-3);
  vec3 radial = cos(aTh) * N1 + sin(aTh) * N2;
  vec3 axis = uP0 + uU0 * tau + vec3(0.0, 0.0, -0.5 * uG * tau * tau);
  vec3 transformed = axis + rad * radial;
  vJN = normalize(radial - T * (neck > 0.0 ? dr : 0.0)); vJX = aTh * aR; vJU = 0.0;
  if (uSheet > 0.5) {
    // a ribbon across the lip: aTh runs −0.5 … 0.5, aR is the half-width (spread past break-up); fingers sway
    vec3 Uh = normalize(vec3(uU0.xy, 0.0) + vec3(1e-6, 0.0, 0.0)), A = normalize(cross(vec3(0.0, 0.0, 1.0), Uh));
    vec3 base = axis, Tt = T;
    if (tau < 0.0) {
      // the tongue: τ < 0 is upstream of the brink. The surface draws down to it — from the river's level uApp.y
      // above the brink, over uApp.x — steepest at the edge, so it rolls over into the fall in one surface
      float sd = -tau * length(uU0.xy), u = clamp(sd / uApp.x, 0.0, 1.0);
      base = uP0 - Uh * sd + vec3(0.0, 0.0, uApp.y * (1.0 - (1.0 - u) * (1.0 - u)));
      Tt = normalize(Uh - vec3(0.0, 0.0, 2.0 * uApp.y * (1.0 - u) / uApp.x));
    }
    float sway = aAer * aAer * 0.06 * aR * sin(aTh * 23.0 + uJT * 1.7 - tau * 2.3);
    // a second, fainter layer just behind the first: once the sheet aerates it has body, not one face
    base -= Uh * uLayer * aAer * uApp.z;
    transformed = base + A * (aTh * 2.0 * aR + sway) * step(tau, uTauEnd);
    vJN = normalize(cross(A, Tt)); vJX = aTh * 2.0 * aR + uLayer * 3.7 * uApp.z; vJU = aTh;
  }
  vJP = transformed; vJTau = tau; vJAer = aAer;
`;
const FRAG = `
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSun; uniform float uAer; uniform vec3 uTint; uniform float uJT; uniform float uStreak; uniform vec2 uStreakK; uniform float uSheet; uniform float uLayer; uniform float uTauEnd;
uniform sampler2D uAqScene; uniform vec2 uAqRes; uniform float uAqHasDepth;
varying vec3 vJP; varying vec3 vJN; varying float vJTau; varying float vJAer; varying float vJX; varying float vJU;
float jtH(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float jtN(vec2 p) { vec2 i = floor(p), f = fract(p), w = f * f * (3.0 - 2.0 * f);
  return mix(mix(jtH(i), jtH(i + vec2(1.0, 0.0)), w.x), mix(jtH(i + vec2(0.0, 1.0)), jtH(i + vec2(1.0, 1.0)), w.x), w.y); }
`;
const FRAG_MAIN = `{
  float alpha = 1.0;
  vec3 V = normalize(cameraPosition - vJP), N = normalize(vJN);
  if (dot(N, V) < 0.0) N = -N;
  float cv = clamp(dot(N, V), 0.0, 1.0), F = 0.02 + 0.98 * pow(1.0 - cv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHor, uZen, pow(max(R.z, 0.0), 0.55));
  // a water rod is a lens: what is behind it shows through, flipped and squeezed across the rod — offset the lookup
  // across the screen by the normal's sideways tilt
  vec3 nv = (viewMatrix * vec4(N, 0.0)).xyz;
  // (the tongue is a thin film on rock: what shows through is the rock right under it — barely any offset)
  vec2 uv = gl_FragCoord.xy / uAqRes - nv.xy * (vJTau < 0.0 ? 0.004 : 0.035);
  vec3 behind = uAqHasDepth > 0.5 ? texture2D(uAqScene, uv).rgb : uHor * 0.6;
  vec3 col = mix(behind * uTint, sky, F) + vec3(1.0, 0.96, 0.88) * pow(max(dot(R, uSun), 0.0), 260.0) * 4.0;
  // the bright line down each edge: grazing light caught inside the rod
  col += sky * 0.35 * smoothstep(0.35, 0.05, cv);
  // aerated: a white, bubbly column, lit by the sun, flecked
  float fleck = fract(sin(dot(floor(vec2(vJTau * 900.0, atan(N.y, N.x) * 6.0)), vec2(12.9898, 78.233))) * 43758.5453);
  vec3 white = vec3(0.92, 0.95, 0.97) * (0.62 + 0.38 * max(dot(N, uSun), 0.0)) * (0.88 + 0.12 * fleck);
  float aer = max(uAer, vJAer);
  if (uStreak > 0.5) {
    // big water: streaks stretched along the fall, riding down at the water's speed (phase t − τ), across in metres
    vec2 sp = vec2(vJX * uStreakK.x, (uJT - vJTau) * uStreakK.y);
    float st = 0.55 * jtN(sp) + 0.3 * jtN(sp * vec2(2.3, 2.0) + 5.0) + 0.15 * jtN(sp * vec2(5.1, 4.4) + 9.0);
    col = mix(col, white, smoothstep(0.5, 0.8, st) * 0.3 * (1.0 - aer));                // white threads in the glassy part
    // white water is brighter where it is thick and catches the sun, greyer in its own shade
    white *= 0.72 + 0.4 * st;
    // past break-up the sheet frays: thin places go see-through between the fingers, the edges tatter — softly
    float gap = smoothstep(0.5, 1.0, vJAer) * 0.42, ed = abs(vJU) * 2.0 + 0.2 * (st - 0.5) * vJAer;
    alpha = smoothstep(gap - 0.07, gap + 0.07, st) * (1.0 - smoothstep(1.0 - 0.25 * vJAer, 1.0, ed));
    if (uLayer > 0.5) alpha *= 0.75 * smoothstep(0.1, 0.5, vJAer);
    // the last of the fall dissolves into its own spray and the boil, rather than ending on a line
    alpha *= smoothstep(0.0, 0.09, uTauEnd - vJTau);
  }
  if (uSheet < 0.5 && alpha < 0.5) discard;
  gl_FragColor = vec4(mix(col, white, aer), uSheet > 0.5 ? alpha : 1.0);
}
#include <tonemapping_fragment>`;

// the jump disc: a glassy film racing out from the impact, a white churning ring at the jump, a slow layer beyond
const JUMP_FRAG = `
uniform float uJT; uniform float uRj; uniform float uOn; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uCen;
varying vec3 vJP;
float jh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
`;
const JUMP_MAIN = `{
  vec2 d = vJP.xy - uCen.xy; float rr = length(d) / max(uRj, 1e-5), th = atan(d.y, d.x);
  float streak = jh(vec2(floor(th * 40.0), floor(rr * 6.0 - uJT * 9.0)));
  float film = (1.0 - smoothstep(0.85, 1.0, rr)) * (0.18 + 0.22 * streak);
  float ring = exp(-pow((rr - 1.0) / 0.12, 2.0)) * (0.55 + 0.45 * jh(vec2(floor(th * 28.0 + uJT * 3.0), floor(uJT * 14.0))));
  float beyond = (1.0 - smoothstep(1.0, 1.6, rr)) * 0.12;
  vec3 col = mix(mix(uHor, uZen, 0.4), vec3(0.95, 0.97, 0.98), ring);
  gl_FragColor = vec4(col, uOn * clamp(film + ring * 0.85 + beyond, 0.0, 0.9));
}
#include <tonemapping_fragment>`;

export function jetChannelScript({ jets, toLight = [0.4, 0.3, 0.8], sky = null, hud = true }) {
  const zen = sky && sky.zenith ? sky.zenith.map((c) => (c / 255) ** 2.2) : [0.25, 0.42, 0.68];
  const hor = sky && sky.horizon ? sky.horizon.map((c) => (c / 255) ** 2.2) : [0.7, 0.78, 0.84];
  return `
// --- jets (falling streams: faucets, spouts — and the basins they fill) ---
let stepJets = () => {};
{
${FNS}
  const JETS = ${safeJson(jets)}, SUN = new THREE.Vector3(...${safeJson(toLight)}).normalize(), ZEN = new THREE.Vector3(...${safeJson(zen)}), HOR = new THREE.Vector3(...${safeJson(hor)});
  const VERT = ${safeJson(VERT)}, VERT_MAIN = ${safeJson(VERT_MAIN)}, FRAG = ${safeJson(FRAG)}, FRAG_MAIN = ${safeJson(FRAG_MAIN)}, JUMP_FRAG = ${safeJson(JUMP_FRAG)}, JUMP_MAIN = ${safeJson(JUMP_MAIN)};
  const RINGS = ${RINGS}, SEGS = ${SEGS}, COLS = ${COLS}, APP = ${APP}, DT = 1 / 120;
  let seed = 0x0fa0ce7;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const W = () => window.__aqWater;
  const J = JETS.map((cfg) => {
    const L = cfg.L, s = { cfg, L, flow: cfg.flow, aerated: cfg.aerated, plug: cfg.basin ? cfg.basin.plug : false, h: cfg.basin ? cfg.basin.h0 : 0, drips: [], lastDrip: -1, acc: 0 };
    // the stream: RINGS rings (even τ) × columns — around a tube, or across a sheet's lip. Position comes from the
    // shader; the attributes carry τ, the column (angle / across), radius or half-width, necking, aeration
    const sheet = cfg.shape === 'sheet', C = sheet ? COLS : SEGS, A0 = sheet && cfg.approach ? APP : 0, R = A0 + RINGS;
    const n = (R + 1) * (C + 1), aTau = new Float32Array(n), aTh = new Float32Array(n), aR = new Float32Array(n), aAmp = new Float32Array(n), aAer = new Float32Array(n), idx = [];
    for (let i = 0; i <= R; i++) for (let k = 0; k <= C; k++) { aTh[i * (C + 1) + k] = sheet ? k / C - 0.5 : (k / C) * Math.PI * 2; if (i < R && k < C) { const a = i * (C + 1) + k, b = a + C + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); } }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (const [k, a] of Object.entries({ aTau, aTh, aR, aAmp, aAer })) geo.setAttribute(k, new THREE.BufferAttribute(a, 1));
    geo.setIndex(idx);
    const U = { uP0: { value: new THREE.Vector3(...cfg.at) }, uU0: { value: new THREE.Vector3() }, uG: { value: 9.8 * L }, uTauEnd: { value: 0 }, uOm: { value: 0 }, uJT: { value: 0 }, uRough: { value: 0 }, uSheet: { value: sheet ? 1 : 0 },
      uApp: { value: new THREE.Vector3(1, 0, 0) }, uLayer: { value: 0 }, uStreak: { value: 0 }, uStreakK: { value: new THREE.Vector2(1, 1) },
      uZen: { value: ZEN }, uHor: { value: HOR }, uSun: { value: SUN }, uAer: { value: 0 }, uTint: { value: new THREE.Vector3(0.93, 0.98, 1.0) } };
    // a sheet blends (its frayed fingers and tattered edges are soft); a tube is solid
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: sheet, depthWrite: !sheet });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, { uAqScene: __aqShared.uAqScene, uAqRes: __aqShared.uAqRes, uAqHasDepth: __aqShared.uAqHasDepth });
      sh.vertexShader = VERT + sh.vertexShader.replace('#include <begin_vertex>', VERT_MAIN);
      sh.fragmentShader = FRAG + sh.fragmentShader.replace('#include <tonemapping_fragment>', FRAG_MAIN);
    };
    mat.customProgramCacheKey = () => 'jetTube';
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.raycast = () => {};
    __aqShared.meshes.push(mesh); scene.add(mesh);
    // the sheet's back layer: the same rings, its own uniforms (layer 1), drawn first
    let back = null;
    if (sheet) {
      const UB = { ...U, uLayer: { value: 1 } }, bmat = mat.clone();
      bmat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, UB, { uAqScene: __aqShared.uAqScene, uAqRes: __aqShared.uAqRes, uAqHasDepth: __aqShared.uAqHasDepth });
        sh.vertexShader = VERT + sh.vertexShader.replace('#include <begin_vertex>', VERT_MAIN);
        sh.fragmentShader = FRAG + sh.fragmentShader.replace('#include <tonemapping_fragment>', FRAG_MAIN);
      };
      bmat.customProgramCacheKey = () => 'jetTube';
      back = new THREE.Mesh(geo, bmat); back.frustumCulled = false; back.renderOrder = 2; back.raycast = () => {};
      __aqShared.meshes.push(back); scene.add(back);
    }
    // drips: a few spheres reused
    const dropMat = mat.clone(); dropMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, { uAqScene: __aqShared.uAqScene, uAqRes: __aqShared.uAqRes, uAqHasDepth: __aqShared.uAqHasDepth });
      sh.vertexShader = 'varying vec3 vJP; varying vec3 vJN; varying float vJTau;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\nvJP = (modelMatrix * vec4(transformed, 1.0)).xyz; vJN = normalize(mat3(modelMatrix) * normal); vJTau = 0.0;');
      sh.fragmentShader = FRAG + sh.fragmentShader.replace('#include <tonemapping_fragment>', FRAG_MAIN);
    };
    dropMat.customProgramCacheKey = () => 'jetDrop';
    const drops = []; for (let k = 0; k < 10; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), dropMat); d.visible = false; d.raycast = () => {}; __aqShared.meshes.push(d); scene.add(d); drops.push(d); }
    // the jump disc
    const JU = { uJT: U.uJT, uRj: { value: 0 }, uOn: { value: 0 }, uZen: { value: ZEN }, uHor: { value: HOR }, uCen: { value: new THREE.Vector3() } };
    const jmat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    jmat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, JU);
      sh.vertexShader = 'varying vec3 vJP;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\nvJP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = JUMP_FRAG + sh.fragmentShader.replace('#include <tonemapping_fragment>', JUMP_MAIN);
    };
    jmat.customProgramCacheKey = () => 'jetJump';
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), jmat); disc.renderOrder = 4; disc.raycast = () => {}; scene.add(disc);
    // the mist: a soft cloud at the foot of big water (seeded particles, each rising and spreading over its own cycle)
    let mist = null;
    if (cfg.mist !== false && (sheet || cfg.radius >= 0.05) && s.flow >= 50) {
      const N = 420, pos = new Float32Array(N * 3), col = new Float32Array(N * 4), seeds = [];
      for (let k = 0; k < N; k++) { seeds.push([rnd() - 0.5, rnd() * Math.PI * 2, 0.25 + 0.75 * rnd(), 0.4 + 0.6 * rnd(), 3 + 4 * rnd(), rnd()]); col.set([0.92, 0.95, 0.97, 0], k * 4); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4));
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
      const pm = new THREE.PointsMaterial({ size: 1, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, vertexColors: true, sizeAttenuation: true });
      const pts = new THREE.Points(g, pm); pts.frustumCulled = false; pts.renderOrder = 5; pts.raycast = () => {}; scene.add(pts);
      mist = { pts, pos, col, seeds, g, pm, N };
    }
    Object.assign(s, { geo, U, mesh, back, drops, disc, JU, aTau, aR, aAmp, aAer, sheet, C, A0, mist });
    profile(s);
    return s;
  });

  // the deepest the stream can fall: to the bed under the spout's landing point (or 3 m)
  function floorTau(s) {
    const { cfg, L, j } = s, w = W();
    let tau = jetHitTime(j, -(cfg.fall || 3));
    for (let it = 0; it < 3; it++) {
      const p = jetAt(j, tau).p, bz = w && w.bedAt ? w.bedAt(cfg.at[0] + p[0] * L, cfg.at[1] + p[1] * L) : null;
      if (bz == null) break; tau = jetHitTime(j, (bz - cfg.at[2]) / L);
    }
    return tau;
  }
  // a new flow: the stream's constants, and the per-ring radius and necking (the shader animates the rest)
  function profile(s) {
    const L = s.L, cfg = s.cfg, Q = s.flow / 1000;
    const j = s.j = s.sheet ? sheetProfile({ W: cfg.width / L, Q, dir: cfg.dir }) : jetProfile({ r0: cfg.radius, Q, dir: cfg.dir, aerated: s.aerated, K: cfg.K });
    s.tauMax = Math.min(8, floorTau(s));
    const amp = s.sheet ? null : jetGrowth(j, s.tauMax, ${RINGS}), ap = cfg.approach;
    // the tongue: A0 rings over the approach (τ < 0 at the brink's speed), widening from the lip to the channel
    for (let i = 0; i < s.A0; i++) {
      const u = 1 - i / s.A0, tau = -(u * ap.length) / (j.v0 * L), r = (j.W / 2) * L + (ap.half - (j.W / 2) * L) * u;
      for (let k = 0; k <= s.C; k++) { const q = i * (s.C + 1) + k; s.aTau[q] = tau; s.aR[q] = r; s.aAmp[q] = 0; s.aAer[q] = 0; }
    }
    s.U.uApp.value.set(ap ? ap.length : 1, ap ? ap.head * L : 0, 0.35 * L);
    for (let i = 0; i <= ${RINGS}; i++) {
      const tau = (i / ${RINGS}) * s.tauMax, at = jetAt(j, tau), drop = Math.max(0, -at.p[2]), aer = fallAeration(j.Lb, drop);
      // a sheet's half-width: the lip's, spreading once it has broken up; a tube's radius (fatter when white)
      // (white water bulks out: air and spray, not continuity, set its width)
      const r = s.sheet ? (j.W / 2 + 0.12 * Math.max(0, drop - 0.6 * j.Lb)) * L : at.r * L * (s.aerated ? 1.35 : 1) + 0.06 * aer * Math.max(0, drop - 0.3 * j.Lb) * L;
      for (let k = 0; k <= s.C; k++) { const q = (s.A0 + i) * (s.C + 1) + k; s.aTau[q] = tau; s.aR[q] = r; s.aAmp[q] = s.sheet ? 0 : s.aerated ? 0.04 : amp[i]; s.aAer[q] = aer; }
    }
    for (const k of ['aTau', 'aR', 'aAmp', 'aAer']) s.geo.attributes[k].needsUpdate = true;
    s.U.uU0.value.set(j.u0[0] * L, j.u0[1] * L, j.u0[2] * L); s.U.uOm.value = s.sheet ? 0 : jetOmega(j, s.tauMax, amp); s.U.uAer.value = s.aerated ? 1 : 0; s.U.uRough.value = s.sheet ? 0 : s.aerated ? 1 : j.rough;
    // big water carries streaks: a sheet, or a spout of landscape size
    const big = s.sheet || cfg.radius >= 0.05;
    s.U.uStreak.value = big ? 1 : 0; s.U.uStreakK.value.set(1 / (0.28 * L), Math.max(0.8, j.v0 / 1.6));
    s.mesh.visible = j.regime === 'jet' || j.regime === 'aerated' || j.regime === 'sheet'; if (s.back) s.back.visible = s.mesh.visible;
  }

  // where the stream lands now: the live water surface under it, else the bed
  function landing(s, tau0) {
    const { cfg, L, j } = s, w = W();
    let tau = tau0, hit = null;
    for (let it = 0; it < 3; it++) {
      const p = jetAt(j, tau).p, x = cfg.at[0] + p[0] * L, y = cfg.at[1] + p[1] * L, q = w && w.query(x, y), bz = w && w.bedAt ? w.bedAt(x, y) : null;
      const z = q ? q.level + q.h : bz != null ? bz : cfg.at[2] - 3 * L;
      hit = { x, y, z, q, depth: q ? q.depth / L : 0 };                    // the still layer's depth: the jet's own crater doesn't count
      tau = Math.min(s.tauMax, jetHitTime(j, (z - cfg.at[2]) / L));
    }
    hit.tau = tau; hit.v = jetAt(j, tau).speed;
    return hit;
  }

  stepJets = (t) => {
    const T = t / 1000, w = W();
    if (!Number.isFinite(T)) return;
    for (const s of J) {
      const { cfg, L, j } = s;
      let dt = s.last == null ? 0 : T - s.last; s.last = T; if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
      s.U.uJT.value = T;
      // the basin: integrate its depth, hand the level to the water
      if (cfg.basin && w && w.setLevel) {
        s.acc += dt; let n = 0;
        while (s.acc >= DT && n < 24) { s.acc -= DT; n++; s.h = basinStep(s.h, DT, j.regime === 'off' ? 0 : j.Q, s.plug, cfg.basin); }
        w.setLevel(cfg.into, cfg.basin.floor + (s.h > 0 ? s.h * L : -0.0005 * L));
      }
      const hit = landing(s, s.tauMax);
      s.U.uTauEnd.value = hit.tau;
      // on a dry floor or a thin layer the stream spreads into a hydraulic jump; once the layer drowns it, it plunges
      const Rj = j.regime === 'jet' || j.regime === 'aerated' ? jumpRadius(j.Q, hit.depth) * L : 0, jr = s.sheet ? 0.5 * L : jetAt(j, hit.tau).r * L;
      if (s.mist) stepMist(s, hit, T);
      const jumping = Rj > 2.2 * jr;
      s.JU.uRj.value = Rj; s.JU.uOn.value += ((jumping ? 1 : 0) - s.JU.uOn.value) * Math.min(1, dt * 6);
      s.disc.visible = s.JU.uOn.value > 0.02; s.disc.position.set(hit.x, hit.y, hit.z + 0.0015 * L); s.disc.scale.setScalar(Math.max(Rj, 1e-4) * 1.7);
      s.JU.uCen.value.set(hit.x, hit.y, hit.z);
      if (!w || dt <= 0) continue;
      if (j.regime === 'sheet' && hit.q) {
        // a sheet plunges all along its width: a few impacts a frame at random points across it, heavy with foam
        const A = sheetAxis(j), hw = s.aR[(s.A0 + ${RINGS}) * (s.C + 1)], push = Math.min(4, Math.sqrt(j.q) * hit.v * 0.4) * L * dt * 3;
        // (and the boil: the white water it carries down comes up as foam on a band either side of the line)
        for (let k = 0; k < 6; k++) { const u = (rnd() - 0.5) * 2.2 * hw, o = (rnd() - 0.5) * 3 * L; w.disturb(hit.x + A[0] * u - A[1] * o, hit.y + A[1] * u + A[0] * o, (0.7 + 0.8 * rnd()) * L, push * (0.6 + 0.8 * rnd()), dt * 45); }
        for (const f of w.floaters || []) {
          const ex = f.x - hit.x, ey = f.y - hit.y, along = ex * A[0] + ey * A[1], d = Math.hypot(ex - A[0] * along, ey - A[1] * along);
          if (Math.abs(along) < hw + 2 * L && d < 4 * L) { const p = (1 - d / (4 * L)) * 2 * L * dt / Math.max(d, 0.3 * L); f.vx += (ex - A[0] * along) * p; f.vy += (ey - A[1] * along) * p; }
        }
      } else if (j.regime === 'jet' || j.regime === 'aerated') {
        // the plunge: momentum flux ρQv pushes a crater, its rim and rings spread; bubbles carried down come up as foam
        if (hit.q) {
          const push = Math.min(3, Math.sqrt(j.Q * 1e4) * hit.v) * L * dt * 3, jit = () => (rnd() - 0.5) * jr * 2;
          w.disturb(hit.x + jit(), hit.y + jit(), Math.max(jr * 2.2, 0.006 * L), push * (0.7 + 0.6 * rnd()), (s.aerated ? 2.4 : 0.9) * dt * 12 * (jumping ? 0.3 : 1));
          // the outflow from the plunge sweeps floaters away from it (the crater's slope alone would draw them in)
          for (const f of w.floaters || []) {
            const ex = f.x - hit.x, ey = f.y - hit.y, d = Math.hypot(ex, ey), reach = 0.14 * L + f.r;
            if (d < reach) { const p = (1 - d / reach) * Math.sqrt(j.Q * 1e4) * hit.v * L * dt * 4 / Math.max(d, 0.2 * f.r); f.vx += ex * p; f.vy += ey * p; }
          }
          if (jumping) { const a = rnd() * Math.PI * 2; w.disturb(hit.x + Math.cos(a) * Rj, hit.y + Math.sin(a) * Rj, 0.006 * L, -push * 0.4, dt * 4); }
        }
      } else if (j.regime === 'drip') {
        // drops: released every V/Q s from a pendant drop that swells at the spout; each falls freely and rings the water
        const P = j.dripPeriod, rd = j.dropR * L, k1 = Math.floor(T / P), tauHit = jetHitTime({ u0: [0, 0, 0] }, (hit.z - cfg.at[2]) / L);
        for (const d of s.drops) d.visible = false;
        let used = 0;
        const pend = s.drops[used++], ph = T / P - k1; pend.visible = true; pend.scale.setScalar(rd * (0.45 + 0.55 * Math.cbrt(ph))); pend.position.set(cfg.at[0], cfg.at[1], cfg.at[2] - rd * (0.3 + 0.7 * ph));
        for (let k = k1; k > k1 - 40 && used < s.drops.length; k--) {
          const tau = T - k * P; if (tau < 0) continue; if (tau > tauHit) break;
          const d = s.drops[used++]; d.visible = true; d.scale.set(rd, rd, rd * 1.15); d.position.set(cfg.at[0], cfg.at[1], cfg.at[2] - rd - 0.5 * 9.8 * L * tau * tau);
        }
        // the drop that landed since last frame
        const kLand = Math.floor((T - tauHit) / P);
        if (kLand > s.lastDrip && s.lastDrip >= 0 && hit.q) w.disturb(hit.x, hit.y, Math.max(rd * 1.6, 0.005 * L), Math.min(1.2, Math.sqrt(2 * 9.8 * Math.max(0, (cfg.at[2] - hit.z) / L))) * L * 0.5, 0.15);
        s.lastDrip = kLand;
      }
      if (j.regime !== 'drip') for (const d of s.drops) d.visible = false;
    }
  };

  function sheetAxis(j) { const h = Math.hypot(j.dir[0], j.dir[1]) || 1; return [-j.dir[1] / h, j.dir[0] / h]; }
  function stepMist(s, hit, T) {
    const m = s.mist, j = s.j, L = s.L, fall = Math.max(1, (s.cfg.at[2] - hit.z) / L);
    const R = (1.5 + 1.1 * Math.cbrt(j.Q * fall)) * L, H = 0.9 * R, A = s.sheet ? sheetAxis(j) : [1, 0], hw = s.sheet ? s.aR[(s.A0 + ${RINGS}) * (s.C + 1)] : 0;
    m.pm.size = 0.55 * R;
    for (let k = 0; k < m.N; k++) {
      const [u, th, rr, hh, P, ph] = m.seeds[k], age = (T / P + ph) % 1, a = Math.sin(Math.PI * age);
      const rad = (0.15 + 0.85 * age) * R * rr * (s.sheet ? 0.7 : 1), along = u * 2.2 * hw;
      m.pos[k * 3] = hit.x + A[0] * along + Math.cos(th) * rad; m.pos[k * 3 + 1] = hit.y + A[1] * along + Math.sin(th) * rad; m.pos[k * 3 + 2] = hit.z + age * H * hh;
      m.col[k * 4 + 3] = 0.26 * a * a * (1 - 0.5 * rr) * (1 - 0.4 * hh * age);
    }
    m.g.attributes.position.needsUpdate = true; m.g.attributes.color.needsUpdate = true;
  }

  function set(id, o = {}) {
    const s = J.find((x) => x.cfg.id === id) || J[0]; if (!s) return;
    if (o.flow != null && Number.isFinite(+o.flow)) s.flow = Math.max(0, +o.flow);
    if (o.aerated != null) s.aerated = !!o.aerated;
    if (o.plug != null) s.plug = !!o.plug;
    profile(s); hudSync();
  }
  window.__mojJet = { jets: J, set, state: () => J.map((s) => ({ id: s.cfg.id, flow: s.flow, regime: s.j.regime, We: +(s.j.We || 0).toFixed(2), Re: Math.round(s.j.Re || 0), tauMax: +s.tauMax.toFixed(3), h: +s.h.toFixed(4), plug: s.plug, aerated: s.aerated, tauEnd: +s.U.uTauEnd.value.toFixed(3), jump: +s.JU.uRj.value.toFixed(4) })) };

  // the HUD: flow on a log slider (0 = off, then 0.0003 → 0.3 L/s), the plug, the aerator
  let hudSync = () => {};
${hud ? `  if (J.length) {
    const s0 = J[0], box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:12px;bottom:34px;z-index:5;background:rgba(20,24,30,.78);color:#e8eef2;font:12px system-ui;padding:10px 12px;border-radius:8px;display:flex;flex-direction:column;gap:6px;min-width:230px';
    box.innerHTML = '<label>flow <span data-k="q"></span><input data-k="flow" type="range" min="0" max="100" value="0" style="width:100%"></label><div style="display:flex;gap:6px"><button data-k="plug"></button><button data-k="aer"></button></div><div data-k="st" style="opacity:.75;font-variant-numeric:tabular-nums"></div>';
    (document.getElementById('wrap') || document.body).appendChild(box);
    const el = (k) => box.querySelector('[data-k="' + k + '"]');
    for (const b of box.querySelectorAll('button')) b.style.cssText = 'flex:1;background:#2c3440;color:#e8eef2;border:1px solid #4a5563;border-radius:5px;padding:4px 6px;font:12px system-ui;cursor:pointer';
    // a faucet's slider spans drip → full (0.0003 → 0.3 L/s); big water spans a trickle of its own flow → 5×
    const lo = s0.sheet || s0.cfg.radius >= 0.05 ? s0.cfg.flow / 300 : 0.0003, span = s0.sheet || s0.cfg.radius >= 0.05 ? 1500 : 1000;
    const toQ = (v) => (v <= 0 ? 0 : lo * Math.pow(span, (v - 1) / 99)), toV = (q) => (q <= 0 ? 0 : Math.round(1 + 99 * Math.log(q / lo) / Math.log(span)));
    if (!s0.cfg.basin) el('plug').style.display = 'none';
    if (s0.sheet || s0.cfg.radius >= 0.02) el('aer').style.display = 'none';
    el('flow').addEventListener('input', (e) => set(s0.cfg.id, { flow: toQ(+e.target.value) }));
    el('plug').addEventListener('click', () => set(s0.cfg.id, { plug: !s0.plug }));
    el('aer').addEventListener('click', () => set(s0.cfg.id, { aerated: !s0.aerated }));
    hudSync = () => {
      el('flow').value = toV(s0.flow); el('q').textContent = s0.flow <= 0 ? 'off' : (s0.flow >= 1000 ? (s0.flow / 1000).toFixed(s0.flow >= 1e4 ? 0 : 1) + ' m³/s' : s0.flow >= 1 ? s0.flow.toFixed(s0.flow >= 10 ? 0 : 1) + ' L/s' : (s0.flow * 1000).toFixed(s0.flow < 0.01 ? 1 : 0) + ' mL/s') + ' · ' + s0.j.regime;
      el('plug').textContent = s0.cfg.basin ? (s0.plug ? 'plug in' : 'plug out') : 'no basin'; el('aer').textContent = s0.aerated ? 'aerator on' : 'aerator off';
    };
    hudSync();
    setInterval(() => { el('st').textContent = s0.sheet ? 'over the lip ' + (s0.j.hb * 100).toFixed(0) + ' cm at ' + s0.j.v0.toFixed(1) + ' m/s · breaks up after ' + s0.j.Lb.toFixed(0) + ' m' : 'We ' + s0.j.We.toFixed(1) + ' · Re ' + Math.round(s0.j.Re) + (s0.cfg.basin ? ' · water ' + (s0.h * 1000).toFixed(1) + ' mm' : ''); }, 250);
  }
` : ''}}`;
}
