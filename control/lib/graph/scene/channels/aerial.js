// In-page script (part of the terrain channel, channels/terrain-lod.js): THE AERIAL GROUND, a flight map's country as
// a pilot sees it (skyscape/country.js, skyscape/aerial.js). Opt-in: the terrain channel carries `aerial` only for a map
// whose ground asks for a country; absent, not one byte of this is emitted and the terrain channel is as it was.
//
//   the cover    the land's use (skyscape/cover-kernel.js, inlined and baked here to a texture over the map's grid:
//                woods, crops, heath, sand, pasture the rest), drawn in the ground's own shader per pixel, not per
//                vertex: farmland as parcels in field systems turned with the land (hedged, furrowed, each a crop or a
//                grazing), woods as a canopy, heath, beaches; each pattern fading to its mean as it falls under a pixel,
//                so nothing shimmers. Past the grid, the same parcels and woods on a slow noise
//   the plan     the settlements' ground plans and the roads painted to a canvas (streets, blocks' pads, parks, lots,
//                yards, gardens' trees; the roads with their verges) and laid over the cover where it paints
//   the light    each vertex's light relative to flat ground (as a pad's paint is lit), so the cover is lit as the land
//                is; rock (the kernel's bare ground), the sea and the pads keep the kernel's own colour
//   the city     every building an instance of a unit box (one draw), its walls drawn by a facade shader: windows a
//                storey and a bay by what the building is (a curtain wall, an office's, a flat's, a hall's ribbon, a
//                house's), their glass reflecting the sky as the eye grazes them, fading to the wall's mean under a
//                pixel; a roof with its parapet and its plant; houses' and halls' gables; tanks, spheres, stacks, water
//                towers; highway decks on their piers
//   the lines    pylons as lattices of lines and their conductors sagging span to span, masts with a lit tip: thin as
//                they are, a line drawn a pixel wide is what reads from a kilometre off
//
// `window.__mojAerial` → { cover, plan, boxes, gables, rounds, pylons } what was built.
/** The vertex hook, in the terrain channel's flat chunk builder (__tBuildFlat's scope: X, Y, h, gx, gy, ln, v, aux):
 *  each vertex's light relative to flat ground, how much of its colour the cover takes, and how bare it is. */
export function aerialVertexFn() {
  return `
function __aVert(X, Y, h, gx, gy, ln, aux, v) {
  const A = TERRAIN.aerial, L = TERRAIN.K.light, Lm = TERRAIN.K.lambert, nx = -gx / ln, ny = -gy / ln, nz = 1 / ln;
  const lam = Lm.ambient + Lm.gain * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), flat = Lm.ambient + Lm.gain * Math.max(0, L[2]);
  const K = TERRAIN.K, s = K.s, yc = K.yc, b = __tk.bareAt(X / s, Y / s + yc)[0], gN = Math.sqrt(gx * gx + gy * gy);
  const sm = (a, c, x) => { const t = Math.min(1, Math.max(0, (x - a) / (c - a))); return t * t * (3 - 2 * t); };
  // (bare ground is the cover's own rock, never the kernel's pale stone through it; the sea and the pads keep theirs)
  let w = 1;
  const sea = __tk.seaZ; if (sea !== null && h < sea + 0.2) w = 0;
  const g = __tk.gradeAt(X, Y); if (g && g[2] < A.keep) w *= 1 - g[1];
  aux[v * 3] = lam / flat; aux[v * 3 + 1] = w; aux[v * 3 + 2] = Math.max(b, sm(0.67, 1.28, gN));
}`;
}

/** The ground's fragment: the cover's albedo at a world point. Uniforms and functions; `aerialAlbedo(P)` → linear rgb. */
const GROUND_GLSL = `
uniform sampler2D aCov; uniform vec4 aCovR; uniform sampler2D aPlan; uniform vec4 aPlanR; uniform float aHasPlan;
uniform vec3 aPal[17]; uniform float aSeed; uniform vec3 aTint; uniform float aNight; uniform sampler2D aLights;
// the towns' lights at night (their streets, their highways, their yards), a light of their own over the ground's
vec3 aerialLights(vec2 P) { vec2 pu = (P - aPlanR.xy) / (aPlanR.zw - aPlanR.xy); return (pu.x >= 0.0 && pu.y >= 0.0 && pu.x <= 1.0 && pu.y <= 1.0) ? texture2D(aLights, pu).rgb : vec3(0.0); }
varying vec3 vAer; varying vec3 vAWP;
float aH(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031 + aSeed * 0.000137); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float aN(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(aH(i), aH(i + vec2(1, 0)), u.x), mix(aH(i + vec2(0, 1)), aH(i + vec2(1, 1)), u.x), u.y); }
float aF(vec2 p) { return 0.55 * aN(p) + 0.3 * aN(p * 2.03 + 17.0) + 0.15 * aN(p * 4.1 + 41.0); }
vec3 aerialAlbedo(vec2 P, float bare) {
  vec2 cu = (P - aCovR.xy) / (aCovR.zw - aCovR.xy);
  // the cover's weights (forest, arable, heath, sand); past the grid a slow noise's woods and fields
  vec4 W = (cu.x >= 0.0 && cu.y >= 0.0 && cu.x <= 1.0 && cu.y <= 1.0) ? texture2D(aCov, cu) : vec4(smoothstep(0.55, 0.68, aF(P / 900.0)), 0.5, 0.0, 0.0);
  float px = max(length(vec2(dFdx(P.x), dFdy(P.x))), length(vec2(dFdx(P.y), dFdy(P.y))));
  // FIELD SYSTEMS: a region (1.7 km) turned its own way, its rows of parcels each its own depth, each row's parcels
  // their own widths; a parcel cropped (by the arable weight) or grazed, hedged where its system hedges
  vec2 rc = floor((P + 520.0 * (vec2(aN(P / 1300.0), aN(P / 1300.0 + 7.7)) - 0.5)) / 1700.0); float ang = aH(rc + 7.0) * 3.14159;
  vec2 q = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * P;
  float rowH = 150.0 + 140.0 * aH(rc + 3.0), row = floor(q.y / rowH);
  float colW = 90.0 + 170.0 * aH(vec2(row, 3.0) + rc), shift = aH(vec2(row, 5.0) + rc) * colW, col = floor((q.x + shift) / colW);
  vec2 cell = vec2(col, row) + rc * 31.0; float id = aH(cell), id2 = aH(cell + 9.1);
  vec2 f = vec2(fract((q.x + shift) / colW) * colW, fract(q.y / rowH) * rowH);
  float edge = min(min(f.x, colW - f.x), min(f.y, rowH - f.y));
  vec3 c;
  if (id2 < W.y) {
    float k = id * 10.0;
    c = k < 2.2 ? aPal[2] : k < 3.8 ? aPal[3] : k < 5.6 ? aPal[4] : k < 7.0 ? aPal[5] : k < 7.25 ? aPal[6] : k < 8.8 ? aPal[7] : aPal[8];
    // its furrows, along or across it, gone under a pixel
    float fq = (aH(cell + 2.2) < 0.5 ? q.x : q.y) / 6.0, fade = 1.0 - smoothstep(0.25, 0.7, px / 6.0);
    c *= 1.0 + 0.07 * fade * sin(fq * 6.28318);
  } else c = mix(aPal[0], aPal[1], id) * (0.92 + 0.16 * aN(P / 40.0 + cell));
  // within a parcel the crop is never even (wetter hollows, a headland's turning strip), and the land's own light
  c *= 0.9 + 0.2 * aF(P / 260.0) * (0.75 + 0.25 * id);
  c = mix(c, c * 0.86, (1.0 - smoothstep(6.0, 14.0, edge)) * (1.0 - smoothstep(4.0, 10.0, px)));
  // its hedges (a system hedged or open), drawn as their share of a pixel once they are thinner than one
  float hw = 3.0, hedged = step(0.35, aH(rc + 11.0));
  float hedge = hedged * (1.0 - smoothstep(hw - px * 0.5, hw + px * 0.5, edge)) * min(1.0, 2.0 * hw / max(px, 1e-3)) * step(0.12, aH(cell + 4.4));
  c = mix(c, aPal[9], clamp(hedge, 0.0, 1.0) * 0.85);
  // WOODS: a canopy of crowns and gaps over a ragged edge
  float fe = smoothstep(0.42, 0.58, W.x + 0.32 * (aF(P / 80.0) - 0.5));
  float crowns = aF(P / 9.0) * 0.6 + aN(P / 35.0) * 0.4, cf = 1.0 - smoothstep(4.0, 14.0, px);
  vec3 wood = mix(aPal[10], aPal[11], mix(0.25 + 0.5 * aF(P / 140.0), crowns, cf));
  wood *= 0.85 + 0.3 * aF(P / 55.0 + 3.0);
  // its edge a line of lit crowns on the sun's side, darker within
  wood *= 1.0 + 0.12 * (1.0 - smoothstep(0.0, 0.25, W.x - 0.42));
  c = mix(c, wood, fe);
  // HEATH and SAND
  float he = smoothstep(0.38, 0.62, W.z + 0.25 * (aN(P / 60.0) - 0.5));
  c = mix(c, mix(aPal[12], aPal[13], aF(P / 22.0)), he * (1.0 - fe));
  c = mix(c, aPal[14] * (0.95 + 0.1 * aN(P / 15.0)), smoothstep(0.35, 0.65, W.w));
  // ROCK where the ground is bare: the land's stone, broken by what clings to it
  c = mix(c, aPal[16] * (0.8 + 0.35 * aF(P / 18.0)), smoothstep(0.25, 0.75, bare + 0.3 * (aN(P / 25.0) - 0.5)));
  // THE PLAN: the settlements and the roads, over all
  if (aHasPlan > 0.5) {
    vec2 pu = (P - aPlanR.xy) / (aPlanR.zw - aPlanR.xy);
    if (pu.x >= 0.0 && pu.y >= 0.0 && pu.x <= 1.0 && pu.y <= 1.0) { vec4 pl = texture2D(aPlan, pu); c = mix(c, pl.rgb, pl.a); }
  }
  return c;
}`;

/** The buildings' shader: a unit box (or a gable's prism, a round) per instance, lit by the ground's light, its walls
 *  windowed by its skin. */
const MASS_VERT = `
attribute vec3 iWall; attribute vec3 iRoof; attribute vec2 iInfo;
varying vec3 vWall; varying vec3 vRoof; varying vec2 vInfo; varying vec3 vN; varying vec3 vL; varying vec3 vSize; varying vec3 vWP;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() {
  mat3 M = mat3(instanceMatrix);
  vSize = vec3(length(M[0]), length(M[1]), length(M[2]));
  vL = position * vSize; vN = normalize(transpose(inverse(M)) * normal);
  vWall = iWall; vRoof = iRoof; vInfo = iInfo;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`;
const MASS_FRAG = `
uniform vec3 uSun; uniform vec3 uLam; uniform vec3 uSky; uniform vec3 uGlass; uniform vec3 uTint; uniform float uNight;
varying vec3 vWall; varying vec3 vRoof; varying vec2 vInfo; varying vec3 vN; varying vec3 vL; varying vec3 vSize; varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float band(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x); }
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN), c, em = vec3(0.0);
  float skin = vInfo.x, fh = max(2.5, vInfo.y);
  vec3 V = normalize(cameraPosition - vWP);
  if (n.z > 0.5 && vSize.z > 0.0 && skin < 6.5) {
    // a flat roof: its parapet round its edge, its plant here and there
    vec2 e = vSize.xy * 0.5 - abs(vL.xy); float edge = min(e.x, e.y), px = length(fwidth(vL.xy));
    c = vRoof * (0.92 + 0.12 * h21(floor(vWP.xy / 7.0)));
    if (skin < 3.5) c = mix(c, vWall * 0.95, (1.0 - smoothstep(0.6 - px, 0.9 + px, edge)));
    if (skin < 1.5 && vSize.x > 14.0 && vSize.y > 14.0) { vec2 g = floor(vL.xy / 6.0); if (h21(g + floor(vWP.xy / 211.0)) > 0.86 && edge > 3.0) c *= 0.78; }
  } else if (n.z > 0.5) c = vRoof;
  else if (n.z > 0.2) c = vRoof * (0.95 + 0.1 * h21(floor(vWP.xy / 3.0)));
  else if (n.z < -0.5) c = vWall * 0.5;
  else {
    // a wall: u along it, v up it (metres); its windows a storey and a bay by its skin
    float u = abs(n.x) > 0.5 ? vL.y : vL.x, v = vL.z;
    float bay = skin < 0.5 ? 1.5 : skin < 1.5 ? 3.0 : skin < 2.5 ? 3.3 : skin < 3.5 ? 5.0 : 4.4;
    vec4 win = skin < 0.5 ? vec4(0.05, 0.95, 0.14, 0.94) : skin < 1.5 ? vec4(0.2, 0.8, 0.3, 0.86) : skin < 2.5 ? vec4(0.3, 0.7, 0.32, 0.8) : skin < 3.5 ? vec4(0.0, 1.0, 0.0, 0.0) : vec4(0.28, 0.62, 0.34, 0.76);
    float fx = u / bay, fy = v / fh, wx = fwidth(fx), wy = fwidth(fy);
    float share = (win.y - win.x) * (win.w - win.z), w = band(fract(fx), win.x, win.y, wx) * band(fract(fy), win.z, win.w, wy);
    // a hall's ribbon of glazing high along it; a plain wall or a deck none
    if (skin > 2.5 && skin < 3.5) { float top = vSize.z; w = band(v, top - 2.6, top - 1.4, fwidth(v)); share = 1.2 / max(top, 1.0) * 0.5; }
    if (skin > 4.5) { w = 0.0; share = 0.0; }
    // at night some of its windows lit (an office's fewer than a flat's), warm or cool, each its own; far off its mean
    if (uNight > 0.01) {
      float litShare = skin < 0.5 ? 0.22 : skin < 1.5 ? 0.28 : skin < 2.5 ? 0.4 : skin < 3.5 ? 0.3 : skin < 4.5 ? 0.4 : 0.0;
      vec2 bc = floor((vWP.xy - vL.xy) / 7.0), wc = floor(vec2(fx, fy)) + bc * 3.7;
      float on = step(1.0 - litShare, h21(wc)) * step(0.5, v), lit = mix(w * on, share * litShare * 0.55, smoothstep(0.3, 0.75, max(wx, wy))) * (skin < 0.5 ? 0.6 : 1.0);
      em = mix(vec3(1.0, 0.68, 0.36), vec3(0.82, 0.88, 1.0), step(0.65, h21(wc + 5.3))) * (0.55 + 0.6 * h21(wc * 1.3 + 2.1)) * lit;
    }
    w = mix(w, share, smoothstep(0.3, 0.75, max(wx, wy)));
    // the glass: dark, the sky in it as the eye grazes it, each pane its own
    float fr = pow(1.0 - abs(dot(V, n)), 3.0), pane = h21(floor(vec2(fx, fy)) + floor(vWP.xy / 50.0));
    vec3 glass = mix(uGlass * (0.75 + 0.5 * pane), uSky, 0.18 + 0.6 * fr);
    vec3 wall = skin < 0.5 ? mix(vWall, uSky * 0.6, 0.15 + 0.45 * fr) : vWall;
    // a curtain wall's mullions are its frame (its roof's colour)
    // (a curtain wall: its glass the building's own tint, the sky brighter in it up the tower; its mullions and
    // spandrels its frame)
    if (skin < 0.5) { glass = mix(mix(glass, vWall, 0.35), uSky, 0.22 * smoothstep(0.0, max(vSize.z, 1.0), v)); wall = vRoof; }
    c = mix(wall, glass, clamp(w, 0.0, 1.0));
    c *= 0.9 + 0.1 * smoothstep(0.0, 8.0, v);
  }
  float lam = uLam.x + uLam.y * max(0.0, dot(n, uSun));
  gl_FragColor = vec4(c * lam / uLam.z * uTint + em * uNight, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** The aerial channel's page source, in the terrain channel's scope (THREE, scene, camera, TERRAIN, __tk, __tMat,
 *  __tLin). `cfg` is TERRAIN.aerial. */
export function aerialScript(cfg) {
  return `
// --- the aerial ground (opt-in): the country's cover, plan and city ---
(function () {
  const A = TERRAIN.aerial, K = TERRAIN.K, dec = (b, T) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
  const lin3 = (u, k) => [__tLin(u[k]), __tLin(u[k + 1]), __tLin(u[k + 2])];
  const out = window.__mojAerial = {};
  // THE COVER, baked over the map's grid
  const CK = (${cfg.cover.kernel})(A.cover.C, { groundAt: __tk.heightAt });
  const N = A.cover.res, R = A.cover.rect, cov = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const w = CK.at(R[0] + (R[2] - R[0]) * (i + 0.5) / N, R[1] + (R[3] - R[1]) * (j + 0.5) / N), k = (j * N + i) * 4; cov[k] = 255 * w[0]; cov[k + 1] = 255 * w[1]; cov[k + 2] = 255 * w[2]; cov[k + 3] = 255 * w[3]; }
  const covTex = new THREE.DataTexture(cov, N, N, THREE.RGBAFormat); covTex.magFilter = THREE.LinearFilter; covTex.minFilter = THREE.LinearFilter; covTex.needsUpdate = true;
  out.cover = { res: N };
  // THE PLAN, painted to a canvas
  let planTex = null, lightTex = null;
  if (A.plan) {
    const P = A.plan, W = Math.min(4096, Math.ceil((P.rect[2] - P.rect[0]) / P.px)), H = Math.min(4096, Math.ceil((P.rect[3] - P.rect[1]) / P.px));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), X = (x) => (x - P.rect[0]) / P.px, Y = (y) => (P.rect[3] - y) / P.px;
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const r of P.ribbons) {
      const w = r[1], pts = r.slice(2);
      const path = () => { g.beginPath(); g.moveTo(X(pts[0]), Y(pts[1])); for (let k = 2; k < pts.length; k += 2) g.lineTo(X(pts[k]), Y(pts[k + 1])); };
      path(); g.strokeStyle = P.paints[P.verge]; g.globalAlpha = 0.55; g.lineWidth = (w + 10) / P.px; g.stroke(); g.globalAlpha = 1;
      path(); g.strokeStyle = P.paints[r[0]]; g.lineWidth = Math.max(1, w / P.px); g.stroke();
      if (w > 20) { path(); g.strokeStyle = P.paints[P.verge]; g.lineWidth = Math.max(0.6, 2.5 / P.px); g.stroke(); }
    }
    const rs = dec(P.rects, Float32Array);
    for (let k = 0; k < P.n; k++) { const o = k * 5; g.fillStyle = P.paints[rs[o + 4]]; g.fillRect(X(rs[o]), Y(rs[o + 3]), (rs[o + 2] - rs[o]) / P.px, (rs[o + 3] - rs[o + 1]) / P.px); }
    const ds = dec(P.dots, Float32Array), tree = P.paints[P.tree];
    g.fillStyle = tree;
    for (let k = 0; k < P.nd; k++) { const o = k * 3; g.beginPath(); g.arc(X(ds[o]), Y(ds[o + 1]), Math.max(0.6, ds[o + 2] / P.px), 0, 6.2832); g.fill(); }
    planTex = new THREE.CanvasTexture(cv); planTex.colorSpace = THREE.SRGBColorSpace; planTex.generateMipmaps = true; planTex.minFilter = THREE.LinearMipmapLinearFilter;
    if (typeof renderer !== 'undefined') planTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    out.plan = { w: W, h: H };
    // THE TOWNS' LIGHTS (at night): their streets lamp-lit (the land's ground under its blocks, sodium orange), their
    // yards and plazas dimmer, the highways white, the country roads barely; a halo round each by a blurred pass
    if (A.night > 0.01) {
      const lw = Math.ceil(W / 2), lh = Math.ceil(H / 2), lv = document.createElement('canvas'); lv.width = lw; lv.height = lh;
      const l = lv.getContext('2d'), lx = (x) => (x - P.rect[0]) / (2 * P.px), ly = (y) => (P.rect[3] - y) / (2 * P.px);
      l.fillStyle = '#000'; l.fillRect(0, 0, lw, lh); l.lineJoin = 'round'; l.lineCap = 'round';
      const LIT = { road: 'rgba(255,140,50,0.34)', plaza: 'rgba(255,180,110,0.16)', lot: 'rgba(255,150,70,0.14)', yard: 'rgba(230,235,255,0.12)', court: 'rgba(255,170,90,0.05)', site: 'rgba(230,235,255,0.1)', quay: 'rgba(255,170,90,0.2)' };
      for (const r of P.ribbons) { const name = P.names[r[0]], pts = r.slice(2); if (name === 'lane') continue;
        l.beginPath(); l.moveTo(lx(pts[0]), ly(pts[1])); for (let k = 2; k < pts.length; k += 2) l.lineTo(lx(pts[k]), ly(pts[k + 1]));
        l.strokeStyle = name === 'highway' ? 'rgba(235,240,255,0.45)' : 'rgba(255,160,70,0.1)'; l.lineWidth = Math.max(1, r[1] / (2 * P.px)); l.stroke(); }
      for (let k = 0; k < P.n; k++) { const o = k * 5; l.fillStyle = LIT[P.names[rs[o + 4]]] || '#000'; l.fillRect(lx(rs[o]), ly(rs[o + 3]), (rs[o + 2] - rs[o]) / (2 * P.px), (rs[o + 3] - rs[o + 1]) / (2 * P.px)); }
      const glow = document.createElement('canvas'); glow.width = lw; glow.height = lh; const gg = glow.getContext('2d');
      gg.filter = 'blur(' + Math.max(1, Math.round(8 / P.px)) + 'px)'; gg.drawImage(lv, 0, 0); gg.filter = 'none'; gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = 0.7; gg.drawImage(lv, 0, 0);
      lightTex = new THREE.CanvasTexture(glow); lightTex.colorSpace = THREE.SRGBColorSpace; lightTex.minFilter = THREE.LinearMipmapLinearFilter;
      out.lights = { w: lw, h: lh };
    }
  }
  // the ground's shader, patched: the cover's albedo, lit as the land, where the vertex says the cover lies
  const uni = { aCov: { value: covTex }, aCovR: { value: new THREE.Vector4(R[0], R[1], R[2], R[3]) }, aPlan: { value: planTex || covTex }, aPlanR: { value: A.plan ? new THREE.Vector4(...A.plan.rect) : new THREE.Vector4() }, aHasPlan: { value: A.plan ? 1 : 0 },
    aPal: { value: A.pal.map((c) => new THREE.Vector3(c[0], c[1], c[2])) }, aSeed: { value: A.seed % 9973 },
    aTint: { value: new THREE.Vector3(...(A.tint || [1, 1, 1])) }, aNight: { value: A.night || 0 }, aLights: { value: lightTex || covTex } };
  __tMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nattribute vec3 aerial; varying vec3 vAer; varying vec3 vAWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\\nvAer = aerial; vAWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\n' + ${JSON.stringify(GROUND_GLSL)})
      .replace('#include <color_fragment>', '#include <color_fragment>\\nif (vAer.y > 0.001) diffuseColor.rgb = mix(diffuseColor.rgb, aerialAlbedo(vAWP.xy, vAer.z) * vAer.x * aTint, clamp(vAer.y, 0.0, 1.0));\\nif (aNight > 0.01 && aHasPlan > 0.5) diffuseColor.rgb += aerialLights(vAWP.xy) * aNight * 0.6;');
    // (the flight sky's cloud shadows over it, flight-sky.js)
    if (window.__mojSkyPatch) window.__mojSkyPatch(sh);
  };
  __tMat.needsUpdate = true;
  // THE CITY: one material for every mass, lit by the ground's light
  const Lt = A.light, flat = Lt.ambient + Lt.gain * Math.max(0, Lt.dir[2]);
  const mat = new THREE.ShaderMaterial({ fog: true, vertexShader: ${JSON.stringify(MASS_VERT)}, fragmentShader: ${JSON.stringify(MASS_FRAG)},
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSun: { value: new THREE.Vector3(...Lt.dir).normalize() }, uLam: { value: new THREE.Vector3(Lt.ambient, Lt.gain, flat) },
      uSky: { value: new THREE.Color(TERRAIN.bg) }, uGlass: { value: new THREE.Color('#1d2833') }, uTint: { value: new THREE.Vector3(...(A.tint || [1, 1, 1])) }, uNight: { value: A.night || 0 } }]) });
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), V3 = new THREE.Vector3(), S3 = new THREE.Vector3();
  const instanced = (geo, n, fill) => {
    const wall = new Float32Array(n * 3), roof = new Float32Array(n * 3), info = new Float32Array(n * 2), mesh = new THREE.InstancedMesh(geo, mat, n);
    for (let k = 0; k < n; k++) { const t = fill(k, wall, roof, info); M4.compose(V3.set(t[0], t[1], t[2]), Q.setFromAxisAngle(Z, t[6] || 0), S3.set(t[3], t[4], t[5])); mesh.setMatrixAt(k, M4); }
    geo.setAttribute('iWall', new THREE.InstancedBufferAttribute(wall, 3)); geo.setAttribute('iRoof', new THREE.InstancedBufferAttribute(roof, 3)); geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(info, 2));
    mesh.frustumCulled = false; mesh.userData.g = 'aerial'; scene.add(mesh); return mesh;
  };
  const Ms = A.masses;
  // the boxes (x, y −½…½, z 0…1)
  if (Ms.n) {
    const F = dec(Ms.boxes, Float32Array), U = dec(Ms.boxCol, Uint8Array), geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, 0.5);
    out.boxes = instanced(geo, Ms.n, (k, wall, roof, info) => { const o = k * 8; wall.set(lin3(U, k * 6), k * 3); roof.set(lin3(U, k * 6 + 3), k * 3); info[k * 2] = F[o + 6]; info[k * 2 + 1] = F[o + 7]; return [F[o], F[o + 1], F[o + 2], F[o + 3], F[o + 4], F[o + 5], 0]; }).count;
  }
  // the gables: a prism, its ridge along x (turned a quarter for a ridge along y)
  if (Ms.ng) {
    const geo = new THREE.BufferGeometry(), p = [], tri = (a, b, c) => p.push(...a, ...b, ...c);
    const A0 = [-0.5, -0.5, 0], B0 = [0.5, -0.5, 0], C0 = [0.5, 0.5, 0], D0 = [-0.5, 0.5, 0], E0 = [-0.5, 0, 1], F0 = [0.5, 0, 1];
    tri(A0, B0, F0); tri(A0, F0, E0); tri(C0, D0, E0); tri(C0, E0, F0); tri(B0, C0, F0); tri(D0, A0, E0);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals();
    const F = dec(Ms.gables, Float32Array), U = dec(Ms.gableCol, Uint8Array);
    out.gables = instanced(geo, Ms.ng, (k, wall, roof, info) => { const o = k * 7; wall.set(lin3(U, k * 6), k * 3); roof.set(lin3(U, k * 6 + 3), k * 3); info[k * 2] = 5; info[k * 2 + 1] = 3; const ax = F[o + 6] > 0.5; return [F[o], F[o + 1], F[o + 2], ax ? F[o + 4] : F[o + 3], ax ? F[o + 3] : F[o + 4], F[o + 5], ax ? Math.PI / 2 : 0]; }).count;
  }
  // the rounds: tanks and towers' tanks (cylinders), spheres, stacks (tapered)
  if (Ms.nr) {
    const F = dec(Ms.rounds, Float32Array), U = dec(Ms.roundCol, Uint8Array), kinds = [[], [], []];
    for (let k = 0; k < Ms.nr; k++) kinds[F[k * 6 + 5] === 1 ? 1 : F[k * 6 + 5] === 2 ? 2 : 0].push(k);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 18, 1); cyl.rotateX(Math.PI / 2); cyl.translate(0, 0, 0.5);
    const sph = new THREE.SphereGeometry(1, 16, 10);
    const stk = new THREE.CylinderGeometry(0.55, 1, 1, 12, 1); stk.rotateX(Math.PI / 2); stk.translate(0, 0, 0.5);
    out.rounds = 0;
    [cyl, sph, stk].forEach((geo, g) => { const ks = kinds[g]; if (!ks.length) return; out.rounds += instanced(geo, ks.length, (i, wall, roof, info) => { const k = ks[i], o = k * 6, c = lin3(U, k * 3); wall.set(c, i * 3); roof.set(c.map((x) => x * 0.9), i * 3); info[i * 2] = 5; info[i * 2 + 1] = 3; return g === 1 ? [F[o], F[o + 1], F[o + 2], F[o + 3], F[o + 3], F[o + 4], 0] : [F[o], F[o + 1], F[o + 2], F[o + 3], F[o + 3], F[o + 4], 0]; }).count; });
  }
  // THE LINES: pylons as lattices, their conductors sagging span to span; masts and their lights
  const seg = [], line = (a, b) => seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  if (Ms.np) {
    const Pf = dec(Ms.pylons, Float32Array), Ht = A.pylon.h, arms = A.pylon.arms;
    const lat = (x, y, z, yaw) => {
      const c = Math.cos(yaw), s = Math.sin(yaw), at = (u, v, w) => [x + u * c - v * s, y + u * s + v * c, z + w];
      const half = (w) => 4.2 - 3.2 * Math.min(1, w / Ht), rings = [0, 6, 12, 18, arms[0][1], arms[1][1], arms[2][1], Ht];
      for (let r = 0; r + 1 < rings.length; r++) {
        const z0 = rings[r], z1 = rings[r + 1], a = half(z0), b = half(z1);
        const q0 = [[-a, -a], [a, -a], [a, a], [-a, a]], q1 = [[-b, -b], [b, -b], [b, b], [-b, b]];
        for (let k = 0; k < 4; k++) { const m = (k + 1) % 4; line(at(q0[k][0], q0[k][1], z0), at(q1[k][0], q1[k][1], z1)); line(at(q0[k][0], q0[k][1], z0), at(q1[m][0], q1[m][1], z1)); line(at(q0[m][0], q0[m][1], z0), at(q1[k][0], q1[k][1], z1)); line(at(q1[k][0], q1[k][1], z1), at(q1[m][0], q1[m][1], z1)); }
      }
      for (const [reach, h] of arms) for (const sd of [-1, 1]) { const b = half(h); line(at(0, sd * b, h), at(0, sd * reach, h)); line(at(0, sd * b, h + 2.4), at(0, sd * reach, h)); }
    };
    for (let k = 0; k < Ms.np; k++) lat(Pf[k * 4], Pf[k * 4 + 1], Pf[k * 4 + 2], Pf[k * 4 + 3]);
    const Wf = dec(Ms.wires, Float32Array);
    for (let k = 0; k < Ms.nw; k++) {
      const o = k * 6, a = [Wf[o], Wf[o + 1], Wf[o + 2]], b = [Wf[o + 3], Wf[o + 4], Wf[o + 5]], yaw = Math.atan2(b[1] - a[1], b[0] - a[0]), span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (const [reach, h] of arms) for (const sd of [-1, 1]) {
        const ox = -Math.sin(yaw) * sd * reach, oy = Math.cos(yaw) * sd * reach; let prev = null;
        for (let t = 0; t <= 12; t++) { const u = t / 12, pt = [a[0] + (b[0] - a[0]) * u + ox, a[1] + (b[1] - a[1]) * u + oy, a[2] + (b[2] - a[2]) * u + h - 2.6 - 0.035 * span * 4 * u * (1 - u)]; if (prev) line(prev, pt); prev = pt; }
      }
    }
  }
  const tips = [];
  for (const [x, y, z, h] of Ms.masts) {
    const leg = (a) => [x + 1.6 * Math.cos(a), y + 1.6 * Math.sin(a), z];
    for (let k = 0; k < 3; k++) { const a = k * 2.094, b = a + 2.094, p = leg(a), q = leg(b); for (let w = 0; w < h; w += 10) { line([p[0], p[1], z + w], [p[0], p[1], z + w + 10]); line([p[0], p[1], z + w], [q[0], q[1], z + w + 10]); } }
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.5; line([x, y, z + h * 0.7], [x + 0.45 * h * Math.cos(a), y + 0.45 * h * Math.sin(a), z]); }
    tips.push(x, y, z + h + 1);
  }
  if (seg.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x3b3e42, fog: true })); l.frustumCulled = false; l.userData.g = 'aerial'; scene.add(l); out.lines = seg.length / 6;
  }
  if (tips.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tips, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xff2a1a, size: 4, sizeAttenuation: false, fog: false })));
  }
})();
`;
}
