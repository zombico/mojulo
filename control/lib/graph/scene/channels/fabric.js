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

// THE SKIN (`cfg.skin`, opt-in; matte-paint/fabric.js ROCK_SKINS): the rock's chunks, a 3D Voronoi warped by noise in the
// fabric's own frame. Its height bumps the face's normal (by the screen-space derivatives: no second evaluation), one
// sample toward the sun casts each chunk's shadow into the recess beside it, and its cells are the joints, so the plane
// grooves step aside. Spliced only when the fabric names a skin: without one, not a byte of it.
const SKIN_HEAD = `uniform int uSkinOn; uniform mat3 uSkinF; uniform vec3 uSkinCell; uniform vec4 uSkinA; uniform vec4 uSkinB; uniform vec4 uSkinC;
float skinH(vec3 p) {
  vec3 w = (vec3(fabNoise(p / uSkinA.y), fabNoise(p / uSkinA.y + 5.2), fabNoise(p / uSkinA.y - 3.1)) - 0.5) * 2.0 * uSkinA.x;
  vec3 q = (uSkinF * (p + w)) / uSkinCell, c = floor(q), id = c;
  float f1 = 1e9, f2 = 1e9;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 cc = c + vec3(float(x), float(y), float(z)), pt = cc + 0.15 + 0.7 * vec3(fabHash(cc), fabHash(cc + 17.1), fabHash(cc + 31.7));
    float d = length(q - pt);
    if (d < f1) { f2 = f1; f1 = d; id = cc; } else if (d < f2) f2 = d;
  }
  float minc = min(uSkinCell.x, min(uSkinCell.y, uSkinCell.z)), edge = (f2 - f1) * minc * 0.5, own = fabHash(id + 7.7);
  float z = (own - 0.5) * uSkinB.y - uSkinA.z * (1.0 - smoothstep(0.0, uSkinA.z * 1.5, edge));
  if (edge < uSkinA.w) z -= uSkinB.x * (1.0 - edge / uSkinA.w);
  z += (fabNoise(p / 0.25) - 0.5) * 2.0 * uSkinB.z + (fabNoise(p / 0.11 + 3.3) - 0.5) * uSkinB.z;
  if (uSkinC.x > 0.0) z += (1.0 - abs(2.0 * fabNoise(vec3(p.x / uSkinC.y, p.y / uSkinC.y, p.z / uSkinC.z)) - 1.0)) * uSkinC.x;
  if (uSkinB.w > 0.0) { float b = (p.z + 0.04 * (fabNoise(p / 0.6) - 0.5)) / uSkinB.w, t = fract(b); z -= uSkinC.w * smoothstep(0.55, 1.0, t) - uSkinC.w * 0.4 * (fabHash(vec3(floor(b), 0.0, 5.0)) - 0.5); }
  return z;
}
`;
const SKIN_MAIN = `    if (uSkinOn == 1) {
      // (the chunks read where the joints do: on the steep faces the landform broke on them; a soft slope keeps its soil)
      float minc = min(uSkinCell.x, min(uSkinCell.y, uSkinCell.z)), lodS = smoothstep(uFabPx * 4.0, uFabPx * 10.0, minc / foot) * steepJ;
      dbM = lodS;
      if (lodS > 0.0) {
        float h = skinH(fp), dhx = dFdx(h), dhy = dFdy(h);
        vec3 R1 = cross(dpy, Ng), R2 = cross(Ng, dpx); float det = dot(dpx, R1);
        g += sign(det) * (dhx * R1 + dhy * R2) / max(abs(det), 1e-10) * lodS;
        // the cast shadow: the skin a step toward the sun standing above the ray to it
        vec3 st = uFabSun - Ng * dot(uFabSun, Ng); float sl = length(st);
        if (sl > 1e-3) { st /= sl; float occ = skinH(fp + st * 0.08) - h - 0.08 * dot(uFabSun, Ng) / sl; alb *= 1.0 - 0.45 * smoothstep(0.0, 0.03, occ) * lodS; }
        cav = max(cav, 0.3 * (1.0 - smoothstep(-0.12, -0.02, h)) * lodS);
      }
    }
`;
const SKIN_UNIFORMS = `
      if (F.skin) {
        const K = F.skin, r = K.frame, m = new THREE.Matrix3(); m.set(r[0][0], r[0][1], r[0][2], r[1][0], r[1][1], r[1][2], r[2][0], r[2][1], r[2][2]);
        Object.assign(sh.uniforms, { uSkinOn: { value: 1 }, uSkinF: { value: m }, uSkinCell: { value: new THREE.Vector3(K.cell[0], K.cell[1], K.cell[2]) },
          uSkinA: { value: V4(K.warp, K.warpScale, K.bevel, K.gap) }, uSkinB: { value: V4(K.gapDepth, K.proud, K.rough, K.beds ? K.beds[0] : 0) },
          uSkinC: { value: V4(K.flute[0], K.flute[1], K.flute[2], K.beds ? K.beds[1] : 0) }, uFabSets: { value: 0 }, uFabBeds: { value: 0 } });
      }`;

// THE FORMATION (`cfg.formation`, opt-in; matte-paint/fabric.js ROCK_FORMATIONS): the cliff as erosion leaves it. Units up
// the face (a jittered grid; a unit one thick bed or a packet of thin ones), each its own hardness; the joints cut each into
// blocks. A block's retreat is followed from four units below: the unit under it undercuts it by its own retreat and its
// soft wear, it bears an overhang up to its hardness and thickness, then sheds slabs; some fall on their own, a scar.
// Every step is blended over the pixel's own footprint (never thinner than a pixel and a half), so no edge aliases; the
// face is broken small by terraced noise (ledges along the beds, steps up the joints), shadowed by a few samples toward
// the sun, and weathered. Spliced only when the fabric names a formation: without one, not a byte of it.
const FORM_HEAD = `uniform vec4 uFmU; uniform vec4 uFmH; uniform vec4 uFmS; uniform vec4 uFmJ0; uniform vec4 uFmJ1; uniform vec4 uFmG; uniform vec4 uFmF; uniform vec4 uFmM;
uniform vec4 uFmC; uniform vec4 uFmW; uniform vec3 uFmFresh; uniform vec3 uFmGreen; uniform vec3 uFmRock; uniform vec2 uFmDip;
float fmN(vec3 p) { return fabNoise(p) * 2.0 - 1.0; }
float fmTer(float h) { float k = h * 3.0, f = floor(k), t = k - f; return (f + smoothstep(0.75, 1.0, t)) / 3.0; }
// a unit's lower boundary (its height in the beds' own frame), jittered within a third of a unit: never crossing
float fmUB(float u) { return (u + 0.35 * (fabHash(vec3(u, 3.0, 11.0)) - 0.5)) * uFmU.x; }
float fmHu(float u) { return fabHash(vec3(u, 5.0, 11.0)) < uFmU.z ? clamp(uFmH.y + uFmH.z * (fabHash(vec3(u, 6.0, 11.0)) - 0.5) * 2.0, 0.0, 1.0) : uFmH.x; }
float fmSoft(float u) { return uFmH.w * (1.0 - fmHu(u)) * (fabHash(vec3(u, 5.0, 11.0)) < uFmU.z ? 1.0 : 0.5); }
// the beds' own height at p: level but for their dip and a slow wander
float fmZ(vec3 p) { return p.z - dot(uFmDip, p.xy) + uFmU.w * uFmU.x * fmN(vec3(p.xy / 7.0, 0.3)); }
float fmUnit(float zz) { float u = floor(zz / uFmU.x); if (zz < fmUB(u)) u -= 1.0; else if (zz >= fmUB(u + 1.0)) u += 1.0; return u; }
// the block of unit u at p: its cell between the two joint sets (a joint runs through uFmG.z units, then shifts)
vec2 fmQ(float u, vec3 p) { float ju = floor(u / uFmG.z); return vec2(dot(p, uFmJ0.xyz) / uFmJ0.w + fabHash(vec3(ju, 1.0, 13.0)) + 0.25 * fmN(p / (uFmJ0.w * 1.3)) + 0.06 * fmN(p / (uFmJ0.w * 0.3)), dot(p, uFmJ1.xyz) / uFmJ1.w + fabHash(vec3(ju, 2.0, 13.0)) + 0.25 * fmN(p / (uFmJ1.w * 1.3) + 4.1) + 0.06 * fmN(p / (uFmJ1.w * 0.3) + 2.3)); }
// a block's retreat (x), its own fall (y), its cell (zw): from four units below, each undercut by the one beneath
vec4 fmR(float u, vec3 p) {
  float under = 0.0, r = 0.0, own = 0.0; vec2 c = vec2(0.0);
  for (int k = 3; k >= 0; k--) {
    float uu = u - float(k), H = fmHu(uu), T = fmUB(uu + 1.0) - fmUB(uu);
    c = floor(fmQ(uu, p));
    float slab = uFmS.x * (0.6 + 0.8 * fabHash(vec3(c, uu + 0.5))), hold = uFmS.y * H * sqrt(T) * (0.5 + fabHash(vec3(c, uu + 1.5)));
    float forced = under > hold ? ceil((under - hold) / slab) : 0.0;
    own = fabHash(vec3(c, uu + 2.5)) < uFmS.z * (1.3 - H) ? (1.0 + floor(fabHash(vec3(c, uu + 3.5)) * 2.5)) * slab : 0.0;
    r = forced * slab + uFmG.w * fabHash(vec3(c, uu + 4.5));
    under = r + 0.6 * own + fmSoft(uu);
  }
  return vec4(r, own, c);
}
// the structure's height at p (metres out of the face): masses, the block's retreat, its scar, a soft bed's hollow
float fmS(vec3 p) {
  float zz = fmZ(p), u = fmUnit(zz); vec4 R = fmR(u, p);
  float sz = clamp(min(uFmJ0.w, uFmJ1.w) * 0.5, 0.8, 4.0), scar = R.y > 0.0 ? smoothstep(0.47, 0.53, fabNoise(p / sz + vec3(R.zw, u)) + 0.15 * (fabHash(vec3(R.zw, u + 6.5)) - 0.3)) : 0.0;
  return uFmM.x * fmN(vec3(p.xy / uFmM.y, p.z / (uFmM.y * 1.5))) * 0.5 - R.x - R.y * scar - fmSoft(u) * 0.5;
}
`;
const FORM_MAIN = `    {
      // (the formation reads where the joints do: on the steep faces; the soft slopes keep their soil)
      float lodF = smoothstep(uFabPx, uFabPx * 3.0, uFmU.y / foot) * steepJ;
      dbM = lodF;
      if (lodF > 0.0) {
        float zz = fmZ(fp), u = fmUnit(zz), b0 = fmUB(u), b1 = fmUB(u + 1.0), T = b1 - b0, t = clamp((zz - b0) / T, 0.0, 1.0);
        vec4 R = fmR(u, fp); vec2 q = fmQ(u, fp), fq = fract(q);
        float e = max(uFmS.w, 2.5 * foot), sz = clamp(min(uFmJ0.w, uFmJ1.w) * 0.5, 0.8, 4.0);
        float scar = R.y > 0.0 ? smoothstep(0.5 - foot / sz, 0.5 + foot / sz, fabNoise(fp / sz + vec3(R.zw, u)) + 0.15 * (fabHash(vec3(R.zw, u + 6.5)) - 0.3)) : 0.0;
        // the block's neighbours across its nearest joints and beds: the step to each blended over e
        float d0 = min(fq.x, 1.0 - fq.x) * uFmJ0.w, d1 = min(fq.y, 1.0 - fq.y) * uFmJ1.w, dB = min(zz - b0, b1 - zz);
        vec3 n0 = fp + uFmJ0.xyz * (fq.x < 0.5 ? -1.0 : 1.0) * (d0 + 0.02), n1 = fp + uFmJ1.xyz * (fq.y < 0.5 ? -1.0 : 1.0) * (d1 + 0.02);
        float uN = t < 0.5 ? u - 1.0 : u + 1.0;
        float r0 = R.x + R.y * scar, h = r0 * -1.0;
        h += 0.5 * (1.0 - smoothstep(0.0, e, d0)) * (r0 - fmR(u, n0).x);
        h += 0.5 * (1.0 - smoothstep(0.0, e, d1)) * (r0 - fmR(u, n1).x);
        h += 0.5 * (1.0 - smoothstep(0.0, e, dB)) * (r0 - fmR(uN, fp).x - (fmSoft(uN) - fmSoft(u)) * 0.5);
        // the masses; a soft bed's hollow (a packet of thin beds: each its own, the hard ones proud)
        h += uFmM.x * fmN(vec3(fp.xy / uFmM.y, fp.z / (uFmM.y * 1.5))) * 0.5 - fmSoft(u) * 0.5;
        bool thick = fabHash(vec3(u, 5.0, 11.0)) < uFmU.z;
        // (a packet's thin beds: their partings jittered, so no two are one thickness)
        float nb = thick ? 1.0 : max(2.0, floor(T / uFmU.y + 0.5)), tb = t * nb, sb = floor(tb);
        float pj0 = 0.35 * (fabHash(vec3(u, sb, 19.0)) - 0.5), pj1 = 0.35 * (fabHash(vec3(u, sb + 1.0, 19.0)) - 0.5);
        if (sb > 0.0 && tb < sb + pj0) { sb -= 1.0; pj1 = pj0; pj0 = 0.35 * (fabHash(vec3(u, sb, 19.0)) - 0.5); }
        else if (sb < nb - 1.0 && tb >= sb + 1.0 + pj1) { sb += 1.0; pj0 = pj1; pj1 = 0.35 * (fabHash(vec3(u, sb + 1.0, 19.0)) - 0.5); }
        float lo0 = sb > 0.0 ? sb + pj0 : 0.0, hi0 = sb < nb - 1.0 ? sb + 1.0 + pj1 : nb, ft = clamp((tb - lo0) / max(hi0 - lo0, 1e-3), 0.0, 1.0);
        float Hb = thick ? fmHu(u) : clamp(uFmH.x + uFmH.z * (fabHash(vec3(u, sb, 17.0)) - 0.5) * 2.0, 0.0, 1.0), Tb = T * (hi0 - lo0) / nb;
        // a soft bed's hollow: flat in its depth, its lips rounded over the footprint (never a step thinner than a pixel)
        float see = smoothstep(uFabPx, uFabPx * 3.0, Tb / foot), lip = max(0.03, 2.0 * foot) / max(Tb, 1e-3);
        float prof = smoothstep(0.0, lip, ft) * smoothstep(0.0, lip, 1.0 - ft);
        if (Hb < 0.75) h -= uFmH.w * (1.0 - Hb) * (see * prof + (1.0 - see) * 0.75) * 0.6;
        // the joints' grooves, weathered open
        float jw = max(uFmG.x, 1.5 * foot), gs = smoothstep(uFabPx, uFabPx * 3.0, uFmG.x / foot);
        h -= uFmG.y * gs * (pow(1.0 - smoothstep(0.0, jw, d0), 2.0) + pow(1.0 - smoothstep(0.0, jw, d1), 2.0) * 0.7);
        // broken small: terraced noise, long along the beds (ledges) and long up the joints (steps), an octave at a time
        float broken = (0.3 + 0.7 * smoothstep(0.35, 0.65, fabNoise(vec3(fp.xy / 5.0, fp.z / 7.0) + 9.1))) * (1.0 - 0.6 * scar);
        float sx = uFmF.x, sy = uFmF.y, dd = uFmF.z * broken;
        for (int o = 0; o < 4; o++) {
          float lo = smoothstep(uFabPx, uFabPx * 3.0, min(sx, sy) * 0.3 / foot);
          if (lo <= 0.0) break;
          float h1 = fmN(vec3(fp.xy / (sx * 2.2), fp.z / (sy * 0.7)) + float(o) * 3.7) * 0.7 + 0.3 * fmN(vec3(fp.xy / (sx * 1.1), fp.z / (sy * 0.35)) + float(o) * 5.3);
          float h2 = fmN(vec3(fp.xy / (sx * 0.6), fp.z / (sy * 2.4)) + float(o) * 7.1) * 0.7 + 0.3 * fmN(vec3(fp.xy / (sx * 0.3), fp.z / (sy * 1.2)) + float(o) * 2.9);
          h += lo * dd * (uFmF.w * fmTer(h1) + uFmM.z * fmTer(h2)) * 2.0;
          sx *= 0.45; sy *= 0.45; dd *= 0.5;
        }
        // (a face turned from the sun reads by the sky alone: its relief is soft, never a sunlit bump on a shaded face)
        float lit = 0.25 + 0.75 * smoothstep(0.0, 0.4, dot(Ng, uFabSun));
        float dhx = dFdx(h), dhy = dFdy(h);
        vec3 R1 = cross(dpy, Ng), R2 = cross(Ng, dpx); float det = dot(dpx, R1);
        g += sign(det) * (dhx * R1 + dhy * R2) / max(abs(det), 1e-10) * lodF * lit;
        // cast shadow: the structure toward the sun standing above the ray to it, at a few reaches (each once it is seen)
        vec3 st = uFabSun - Ng * dot(uFabSun, Ng); float sl = length(st), sh = 0.0;
        if (sl > 1e-3) {
          st /= sl; float hs = fmS(fp), rise = dot(uFabSun, Ng) / sl;
          for (int k = 0; k < 4; k++) {
            float d = 0.2 * pow(2.6, float(k));
            if (d < 3.0 * foot) continue;
            sh = max(sh, smoothstep(0.0, 0.04 + 0.08 * d, fmS(fp + st * d) - hs - d * rise));
          }
        }
        float l0 = uFabAmb + (1.0 - uFabAmb) * max(dot(Ng, uFabSun), 0.0);
        alb *= 1.0 - sh * (1.0 - uFabAmb / max(l0, 0.05)) * 0.85 * lodF;
        cav = max(cav, lodF * 0.35 * smoothstep(0.05, 0.6, -h - R.x));
        // weathered: a bed's tint, the soft beds darker, the stone's mottle; fresh scars warm; lichen near
        float bid = thick ? u : u * 16.0 + sb;
        alb *= 1.0 + lodF * (uFmC.x * (fabHash(vec3(bid, 8.0, 17.0)) - 0.5) * 2.0 - uFmC.y * (1.0 - Hb) * see + 0.06 * fmN(fp / 1.3) + 0.05 * smoothstep(uFabPx, uFabPx * 3.0, 0.15 / foot) * fmN(fp / 0.15));
        float fm = fabHash(vec3(R.zw, u + 7.5)) < uFmC.z ? scar * lodF : 0.0;
        gl_FragColor.rgb *= mix(vec3(1.0), uFmFresh, fm * 0.8);
        float ln = smoothstep(0.5, 0.75, fabNoise(fp / 0.3)) * uFmC.w * (1.0 - fm) * smoothstep(uFabPx, uFabPx * 3.0, 0.12 / foot);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * (fabNoise(fp / 1.5) > 0.5 ? 1.35 : 0.7), ln * 0.35);
        // water: under a block that stands proud of this one, dark streaks run down from its foot, fading as they go
        vec4 Ra = fmR(u + 1.0, fp); float proud = smoothstep(0.05, 0.3, R.x - Ra.x), below = b1 - zz;
        float sm = smoothstep(0.45, 0.75, fabNoise(vec3(fp.xy / 0.45, fp.z / 8.0)) + 0.3 * (fabNoise(vec3(fp.xy / 4.0, 2.0)) - 0.5));
        alb *= 1.0 - uFmW.x * lodF * sm * (proud * exp(-below / uFmW.y) + 0.25);
        // green: hung over a ledge (the top of a block standing proud of the one above), in patches
        if (uFmW.z > 0.0) {
          float gm = proud * smoothstep(uFmW.w, 0.0, below - 0.02) * smoothstep(0.4, 0.6, fabNoise(fp / 0.4)) * uFmW.z * lodF;
          float lr = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11)) / max(dot(uFmRock, vec3(0.3, 0.59, 0.11)), 0.05);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFmGreen * lr, clamp(gm, 0.0, 1.0));
        }
      }
    }
`;
const FORM_UNIFORMS = `
      if (F.formation) {
        const M = F.formation, C = M.colour, j0 = M.joints[0], j1 = M.joints[1], gr = C.green || [0, 0];
        Object.assign(sh.uniforms, { uFmU: { value: V4(M.unit, M.thin, M.thickShare, M.lens) }, uFmH: { value: V4(M.hard[0], M.hard[1], M.spread, M.recess) },
          uFmS: { value: V4(M.slab, M.hold, M.fall, M.round) }, uFmJ0: { value: V4(j0[0], j0[1], j0[2], j0[3]) }, uFmJ1: { value: V4(j1[0], j1[1], j1[2], j1[3]) },
          uFmG: { value: V4(M.groove[0], M.groove[1], M.run, M.jitter) }, uFmF: { value: V4(M.frac[0], M.frac[1], M.frac[2], M.frac[3]) }, uFmM: { value: V4(M.masses[0], M.masses[1], M.frac[4], 0) },
          uFmC: { value: V4(C.tint, C.soft, C.freshShare, C.lichen) }, uFmW: { value: V4(C.streak[0], C.streak[1], gr[0], gr[1]) },
          uFmFresh: { value: new THREE.Vector3(C.fresh[0], C.fresh[1], C.fresh[2]) }, uFmGreen: { value: new THREE.Vector3(...(C.greenRgb || [0, 0, 0])) }, uFmRock: { value: new THREE.Vector3(...(C.rockRgb || [1, 1, 1])) },
          uFmDip: { value: new THREE.Vector2(M.dip[0], M.dip[1]) }, uFabSets: { value: 0 }, uFabBeds: { value: 0 } });
      }`;

export function fabricScript(cfg) {
  const skin = !!cfg.skin, form = !!cfg.formation;
  const FH = FRAG_HEAD + (skin ? SKIN_HEAD : '') + (form ? FORM_HEAD : '');
  // (a formation's ledges are steep: its light against the facet's is held closer, so a lit ledge is a highlight, not a glare)
  const FM0 = skin || form ? FRAG_MAIN.replace('    float lodG', (skin ? SKIN_MAIN : '') + (form ? FORM_MAIN : '') + '    float lodG') : FRAG_MAIN;
  const FM = form ? FM0.replace('clamp(l1 / max(l0, 0.05), 0.35, 1.8)', 'clamp(l1 / max(l0, 0.05), 0.5, 1.3)') : FM0;
  return `
// --- rock fabric: what the rock's own joints and beds do to a face, drawn only where they can be seen ---
(function () {
  const F = ${safeJson(cfg)}, groups = new Set(F.groups), V4 = (a, b, c, d) => new THREE.Vector4(a, b, c, d);
  const VH = ${safeJson(VERT_HEAD)}, VM = ${safeJson(VERT_MAIN)}, FH = ${safeJson(FH)}, FM = ${safeJson(FM)};
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
      });${skin ? SKIN_UNIFORMS : ''}${form ? FORM_UNIFORMS : ''}
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
