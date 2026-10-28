/**
 * THE FORM RENDER'S PLANTS (gen-7), on the World page: the `form.flora` input (form/flora-read.js) grown where the trail's
 * placement stood them, under the land's sun and sky light (channels/form-land.js, inside whose block this runs). Each
 * template is built once in its own space: its wood as tubes in its bark (the bark's colour, relief normal and
 * occlusion, marched by parallax near), its crown its clumps merged into one mesh (and a far crown, a share of them kept
 * and grown to hold the cover), its sprays merged into another; every plant a copy of them (instanced), turned and
 * scaled, its leaves tinted its own colour (the instance colour over each leaf's tone) and its bark tinted toward the
 * level's. A copy's distance sorts it each few frames: near, the whole wood and crown and, inside the detail range, its
 * sprays coming in over the crown (the crown never draws in: the outline holds, form/bush-form.js BUSH_FORM.draw); far,
 * the thick axes and the far crown. The crowns and the wood cast into the land's shadow map; the sprays do not.
 *
 *   formFloraScript(flora, { snow? }) → the block's page source (absent `flora`, the land's block carries none); `snow`, the
 *     land's snow (channels/form-land.js, its map `SM`) caps the leaves that turn up where it lies
 *   `window.__formFlora()` → { templates, plants, near, far, sprays, triangles } what is drawn now
 */
import { safeJson } from '../emit-util.js';
import { WIND_AT_GLSL } from './terrain-wind.js';

/**
 * The plants in the wind: a tree's trunk stands, its limbs bend from where they leave it (each vertex's weight its
 * distance off the trunk over `limb` m, 0 on the trunk's skin), its leaves with their limbs and a flutter of their own; a
 * bush's stems hold at its foot and bend more with height, and so does a bamboo's culm (it has no trunk: it flexes,
 * `culmPhi`). The push is the page's gust field at the vertex
 * (terrain-wind.js, the grass's own: one wind), a pendulum's φ·u|u| (`phi`, `bushPhi`), the leaves' flutter `flutter` m
 * at a fresh wind; a walked-through bush SHAKES as the walker brushes it (`shake` m, settling over `settle` s).
 */
export const FLORA_WIND = Object.freeze({ phi: 0.006, bushPhi: 0.004, culmPhi: 0.012, limb: 1.2, flutter: 0.025, shake: 0.07, settle: 1.2 });
const SWAY_GLSL = `vec3 floraSway( vec3 wp, vec3 base, float w, float leaf, float shake, float ph ) {
  vec2 u = mojWindAt( wp.xy, max( 0.5, wp.z - base.z ), uWindT ); float m = length( u );
  vec2 push = u * m * uFloraPhi * w;
  float fl = leaf * ${FLORA_WIND.flutter} * min( 1.0, m / 4.0 ) * sin( uWindT * ( 5.0 + 2.0 * fract( ph * 0.37 ) ) + ph * 30.0 );
  float sk = shake * ${FLORA_WIND.shake} * w * sin( uFloraT * 17.0 + ph * 9.0 );
  return vec3( push + vec2( fl + sk, sk * 0.7 - fl * 0.6 ), -0.12 * length( push ) + fl * 0.5 );
}
`;
const STILL_GLSL = `vec3 floraSway( vec3 wp, vec3 base, float w, float leaf, float shake, float ph ) {
  float sk = shake * ${FLORA_WIND.shake} * w * sin( uFloraT * 17.0 + ph * 9.0 ); return vec3( sk, sk * 0.7, 0.0 );
}
`;
const WIND_HEAD = 'uniform float uWindT; uniform vec4 uWindA; uniform vec4 uWindB; uniform sampler2D uWindNoise;\n' + WIND_AT_GLSL + SWAY_GLSL;

export function formFloraScript(flora, { snow = false } = {}) {
  return `
  // the plants (gen-7: form/flora-read.js, channels/form-flora.js)
  {
    const FL = ${safeJson(flora)}, STRIDE = 13, LOD = FL.lod, FW = ${safeJson(FLORA_WIND)};
    // the wind: the page's gust field bound when a shader compiles (the grass's own), else still but for the shaking
    const FLORA_WIND_HEAD = ${JSON.stringify(WIND_HEAD)}, FLORA_STILL_HEAD = ${JSON.stringify(STILL_GLSL)}, floraT = { value: 0 };
    const SWAY_PROJECT = 'vec4 mvPosition = vec4( transformed, 1.0 );\\n#ifdef USE_INSTANCING\\n  mvPosition = instanceMatrix * mvPosition;\\n#endif\\n  { vec3 fb = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz; mvPosition.xyz += floraSway( ( modelMatrix * mvPosition ).xyz, fb, aSway, uLeaf, aShake, fract( dot( fb.xy, vec2( 0.131, 0.217 ) ) ) * 7.0 + aSway * 3.0 ); }\\n  mvPosition = modelViewMatrix * mvPosition;\\n  gl_Position = projectionMatrix * mvPosition;';
    function swayHead(sh, phi, leaf) {
      const W = window.__mojTerrain && window.__mojTerrain.wind && window.__mojTerrain.wind.uniforms;
      Object.assign(sh.uniforms, { uFloraT: floraT, uFloraPhi: { value: phi }, uLeaf: { value: leaf } });
      const decl = 'uniform float uFloraT, uFloraPhi, uLeaf;\\nattribute float aSway;\\nattribute float aShake;\\n';
      if (!W) return decl + FLORA_STILL_HEAD;
      Object.assign(sh.uniforms, { uWindT: W.uWindT, uWindA: W.uWindA, uWindB: W.uWindB, uWindNoise: W.uWindNoise });
      return decl + FLORA_WIND_HEAD;
    }
    // the occlusion's prepass (channels/creases.js) draws a material by its own vertex shader: this one's wind (and a
    // spray's growth) over it, so the plant's occlusion falls where the frame draws it, not where it would stand still
    function moves(m, phi, leaf, head = '', edit = (vs) => vs) {
      m.userData.prepass = (vs) => { const sh = { uniforms: {} }, sway = swayHead(sh, phi, leaf); return { uniforms: sh.uniforms, vertexShader: sway + head + edit(vs).replace('#include <project_vertex>', SWAY_PROJECT) }; };
      return m;
    }
    const f32 = (s) => new Float32Array(bytes(s).buffer), i8 = (s) => new Int8Array(bytes(s).buffer);
    const tl = new THREE.TextureLoader(), barkMats = {};
    // the bark: its own colour, its relief's normal, the fissures' occlusion and its roughness, marched by parallax near
    function barkMat(B, phi) {
      const tex = (u, srgb) => { const t = tl.load(u); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
      const orm = tex(B.orm), m = new THREE.MeshStandardMaterial({ map: tex(B.base, true), normalMap: tex(B.normal), roughnessMap: orm, aoMap: orm, roughness: 1, metalness: 0 });
      const U = { tBarkH: { value: tex(B.height) }, uPomDepth: { value: B.depth / B.metres } };
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = swayHead(sh, phi, 0) + sh.vertexShader.replace('#include <project_vertex>', SWAY_PROJECT);
        const via = (chunk, v) => THREE.ShaderChunk[chunk].split(v).join('pomUv');
        sh.fragmentShader = 'uniform sampler2D tBarkH;\\nuniform float uPomDepth;\\n' + sh.fragmentShader
          .replace('void main() {', ['void main() {', '  vec2 pomUv = vMapUv;',
            '  vec3 Vv = normalize( vViewPosition ), Nn = normalize( vNormal ), q1 = dFdx( -vViewPosition ), q2 = dFdy( -vViewPosition );',
            '  vec2 s1 = dFdx( vMapUv ), s2 = dFdy( vMapUv ); vec3 a2 = cross( q2, Nn ), a1 = cross( Nn, q1 );',
            '  vec3 Tt = normalize( a2 * s1.x + a1 * s2.x ), Bt = normalize( a2 * s1.y + a1 * s2.y ), Vt = vec3( dot( Vv, Tt ), dot( Vv, Bt ), dot( Vv, Nn ) );',
            '  float fade = 1.0 - smoothstep( 6.0, 14.0, length( vViewPosition ) );',
            '  if ( fade > 0.0 && Vt.z > 0.05 ) { vec2 dir = -Vt.xy / Vt.z * uPomDepth * fade; float cur = 1.0, h = texture( tBarkH, pomUv ).r;',
            '    for ( int i = 0; i < 10; i++ ) { if ( h >= cur ) break; cur -= 0.1; pomUv += dir * 0.1; h = texture( tBarkH, pomUv ).r; } }'].join('\\n'))
          .replace('#include <map_fragment>', via('map_fragment', 'vMapUv'))
          .replace('#include <normal_fragment_maps>', via('normal_fragment_maps', 'vNormalMapUv'))
          .replace('#include <roughnessmap_fragment>', via('roughnessmap_fragment', 'vRoughnessMapUv'))
          .replace('#include <aomap_fragment>', via('aomap_fragment', 'vAoMapUv'));
      };
      m.customProgramCacheKey = () => 'form-bark-' + phi;
      moves(m, phi, 0);
      return m;
    }
    const barkFor = (key, phi) => (barkMats[key + phi] ??= barkMat(FL.barks[key], phi));
    // a culm: no bark, smooth and a little waxy, tinted toward the level's foliage (the vertex colours its node bands)
    const culmMat = (phi) => (barkMats['culm' + phi] ??= (() => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 }); m.onBeforeCompile = (sh) => { sh.vertexShader = swayHead(sh, phi, 0) + sh.vertexShader.replace('#include <project_vertex>', SWAY_PROJECT); }; m.customProgramCacheKey = () => 'form-culm' + phi; return moves(m, phi, 0); })());
    // the leaves: each vertex its tone's factor over the plant's leaf, the plant's colour the instance's; the normal bent
    // toward the crown's outside (a crown takes the sun as one volume), the light through a thin leaf a fill in its
    // shade; near, a spray comes in at its own distance, growing from a third of its size about its site
    const eye = { value: new THREE.Vector3() };
${snow ? `    // (under snow, era/snow.js capOf: a leaf turned up past its cap carries it, a share of them by the depth, where the map says
    // the snow lies; its colour the snow's on the ground)
    const LEAF_SNOW = { tSnowL: { value: SM }, uSnowLO: { value: new THREE.Vector2(...D.snow.origin.map((v) => v - D.snow.cell / 2)) }, uSnowLM: { value: new THREE.Vector2(D.snow.size[0] * D.snow.cell, D.snow.size[1] * D.snow.cell) }, uSnowCap: { value: new THREE.Vector2(D.snow.cap.up, D.snow.cap.share) }, uSnowLB: { value: new THREE.Vector3(...D.snow.base) } };
    const LEAF_SNOW_HEAD = 'uniform sampler2D tSnowL;\\nuniform vec2 uSnowLO, uSnowLM, uSnowCap;\\nuniform vec3 uSnowLB;\\nvarying vec3 vSnowW;\\n';
    const LEAF_SNOW_CAP = '\\n  { vec2 su = ( vSnowW.xy - uSnowLO ) / uSnowLM; float sc = ( su.x > 0.0 && su.y > 0.0 && su.x < 1.0 && su.y < 1.0 ) ? texture2D( tSnowL, su ).r : 0.0;' +
      ' vec3 wn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz ); float hs = fract( sin( dot( floor( vSnowW * 3.0 ), vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );' +
      ' float sk = smoothstep( uSnowCap.x - 0.04, uSnowCap.x + 0.12, wn.z ) * step( hs, uSnowCap.y ) * smoothstep( 0.15, 0.45, sc ); diffuseColor.rgb = mix( diffuseColor.rgb, uSnowLB, sk ); }';
` : ''}    function leafMat(spray, detail, phi) {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
      const U = { uEye: eye, uDetail: { value: new THREE.Vector2(detail[0], detail[1]) }${snow ? ', ...LEAF_SNOW' : ''} };
      const HEAD = 'attribute vec3 aOut;\\nattribute vec3 aSite;\\nuniform vec3 uEye;\\nuniform vec2 uDetail;\\n';
      const grows = (vs) => vs.replace('#include <begin_vertex>', spray ? [
        'vec3 ipos = ( modelMatrix * instanceMatrix * vec4( aSite, 1.0 ) ).xyz;',
        'float nearF = 1.0 - smoothstep( uDetail.x, uDetail.y, distance( ipos, uEye ) );',
        'float hI = fract( sin( dot( ipos.xy, vec2( 12.9898, 78.233 ) ) + ipos.z * 4.13 ) * 43758.5453 ) * 0.7, inF = smoothstep( hI, hI + 0.3, nearF );',
        'vec3 transformed = aSite + ( position - aSite ) * mix( 0.35, 1.0, inF ) * step( 0.001, inF );'].join('\\n') : '#include <begin_vertex>');
      moves(m, phi, 1, HEAD, grows);
      const pre = m.userData.prepass; m.userData.prepass = (vs) => { const P = pre(vs); Object.assign(P.uniforms, U); return P; };
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = ${snow ? "'varying vec3 vSnowW;\\n' + " : ''}swayHead(sh, phi, 1) + HEAD + grows(sh.vertexShader)
          .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\\n  transformedNormal = normalize( mix( transformedNormal, normalMatrix * mat3( instanceMatrix ) * aOut, 0.65 ) );')
          .replace('#include <project_vertex>', ${snow ? "SWAY_PROJECT + '\\n  vSnowW = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;'" : 'SWAY_PROJECT'});
        sh.fragmentShader = ${snow ? 'LEAF_SNOW_HEAD + ' : ''}sh.fragmentShader
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  normal *= faceDirection;'${snow ? ' + LEAF_SNOW_CAP' : ''})
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.22;');
      };
      m.customProgramCacheKey = () => 'form-leaf' + (spray ? '-spray' : '') + phi${snow ? -snow : ''};
      return m;
    }
    // a template's pieces merged in its own space: each clump or spray a variant's triangles turned to its facing (a pad
    // level along its branch), rolled by its rank and scaled
    const AXZ = new THREE.Vector3(0, 0, 1), AXX = new THREE.Vector3(1, 0, 0);
    function variants(list) { return list.map((G) => ({ p: f32(G.p), c: bytes(G.c), n: G.n })); }
    function merged(sites, n, geos, kind, pad, pick, grow = 1) {
      const S = f32(sites), use = []; for (let i = 0; i < n; i++) if (pick(S, i)) use.push(i);
      let tv = 0; for (const i of use) tv += geos[i % geos.length].n * 3;
      const pos = new Float32Array(tv * 3), col = new Float32Array(tv * 3), out = new Float32Array(tv * 3), site = new Float32Array(tv * 3);
      const q = new THREE.Quaternion(), roll = new THREE.Quaternion(), m4 = new THREE.Matrix4(), v = new THREE.Vector3(), basis = new THREE.Matrix4();
      let o = 0;
      for (const i of use) {
        const b = i * 12, G = geos[i % geos.length], p = new THREE.Vector3(S[b], S[b + 1], S[b + 2]), fo = new THREE.Vector3(S[b + 3], S[b + 4], S[b + 5]), d = new THREE.Vector3(S[b + 6], S[b + 7], S[b + 8]);
        const s = S[b + 9] * grow, tone = 0.62 + 0.38 * S[b + 10], r = S[b + 11];
        if (kind === 'clump' && pad === 'cross') {
          // (a cross, vegetation/twigs.js: its slot along d, its lying card's face o)
          const x = d.clone().normalize(), z = fo.clone().normalize(); q.setFromRotationMatrix(basis.makeBasis(x, z.clone().cross(x), z));
        } else if (kind === 'clump' && pad) {
          const x = new THREE.Vector3(d.x, d.y, 0); if (x.lengthSq() < 1e-6) x.set(fo.x, fo.y, 0); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
          q.setFromRotationMatrix(basis.makeBasis(x, AXZ.clone().cross(x), AXZ));
        } else { const f = kind === 'clump' ? fo : d; q.setFromUnitVectors(kind === 'clump' ? AXZ : AXX, f.clone().normalize()); roll.setFromAxisAngle(f.clone().normalize(), r * 40); q.premultiply(roll); }
        m4.compose(p, q, new THREE.Vector3(s, s, s));
        for (let k = 0; k < G.n * 3; k++, o++) {
          v.set(G.p[k * 3], G.p[k * 3 + 1], G.p[k * 3 + 2]).applyMatrix4(m4); pos.set([v.x, v.y, v.z], o * 3);
          col.set([(G.c[k * 3] / 128) * tone, (G.c[k * 3 + 1] / 128) * tone, (G.c[k * 3 + 2] / 128) * tone], o * 3);
          out.set([fo.x, fo.y, fo.z], o * 3); site.set([p.x, p.y, p.z], o * 3);
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aOut', new THREE.BufferAttribute(out, 3)); g.setAttribute('aSite', new THREE.BufferAttribute(site, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
      return { g, tris: tv / 3 };
    }
    function woodGeo(W) {
      const g = new THREE.BufferGeometry(), I = W.big ? new Uint32Array(bytes(W.idx).buffer) : new Uint16Array(bytes(W.idx).buffer);
      g.setAttribute('position', new THREE.BufferAttribute(f32(W.pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(i8(W.nrm), 3, true));
      g.setAttribute('uv', new THREE.BufferAttribute(f32(W.uv), 2)); g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere();
      // (a culm's own colours, its node bands darker: sRGB bytes to linear)
      if (W.col) { const cb = bytes(W.col); g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(cb, (v) => LIN[v]), 3)); }
      return { g, tris: I.length / 3 };
    }
    // the sway's weight a vertex: a tree's its distance off the trunk's skin over the limb's reach (the leaves by their
    // clump's or spray's site), a bush's its height over the bush's (its stems hold at its foot)
    function swayWeights(t, g, bySite) {
      const P0 = g.getAttribute(bySite ? 'aSite' : 'position'), n = P0.count, w = new Float32Array(n), T = t.trunk || [];
      for (let i = 0; i < n; i++) {
        const x = P0.getX(i), y = P0.getY(i), z = P0.getZ(i);
        if (T.length < 8) { const h = Math.max(0, Math.min(1, z / t.height)); w[i] = h * h * (3 - 2 * h); continue; }
        let best = 1e9;
        for (let k = 0; k + 4 < T.length; k += 4) {
          const ax = T[k], ay = T[k + 1], az = T[k + 2], dx = T[k + 4] - ax, dy = T[k + 5] - ay, dz = T[k + 6] - az;
          const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / Math.max(1e-9, dx * dx + dy * dy + dz * dz)));
          const d = Math.hypot(x - ax - dx * u, y - ay - dy * u, z - az - dz * u) - (T[k + 3] + (T[k + 7] - T[k + 3]) * u);
          if (d < best) best = d;
        }
        const q = Math.max(0, Math.min(1, best / FW.limb)); w[i] = q * q * (3 - 2 * q);
      }
      g.setAttribute('aSway', new THREE.BufferAttribute(w, 1));
    }
    // the plants, each a copy of its template: its matrix and its colours
    const P = f32(FL.trees), N = FL.n, by = FL.templates.map(() => []);
    for (let i = 0; i < N; i++) by[P[i * STRIDE + 11]].push(i);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), cv = new THREE.Color();
    const T = FL.templates.map((t, ti) => {
      const cg = variants(t.clumpGeo), sg = variants(t.sprayGeo), detail = t.detail || LOD.detail, n = by[ti].length;
      // (each piece its sway's weights, and its copies' shaking, one value a copy, set as the walker brushes them)
      const mk = (geo, mat, cast, bySite) => {
        swayWeights(t, geo.g, bySite); geo.g.setAttribute('aShake', new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1));
        const im = new THREE.InstancedMesh(geo.g, mat, Math.max(1, n)); im.count = 0; im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
        return { im, tris: geo.tris, slot: new Int32Array(Math.max(1, n)).fill(-1) };
      };
      const phi = t.culm ? FW.culmPhi : t.kind === 'tree' ? FW.phi : FW.bushPhi, leaf = leafMat(false, detail, phi), wood = t.culm ? culmMat(phi) : barkFor(t.bark, phi);
      const parts = {
        wood: mk(woodGeo(t.wood), wood, true, false), woodFar: mk(woodGeo(t.woodFar || t.wood), wood, true, false),
        crown: mk(merged(t.clumps, t.nClumps, cg, 'clump', t.cross ? 'cross' : t.pad, () => true), leaf, true, true),
        // (far off: a crossed crown every clump where it stands, half its leaves; any other the share kept, grown)
        crownFar: mk(t.cross ? merged(t.clumps, t.nClumps, variants(t.farGeo), 'clump', 'cross', () => true) : merged(t.clumps, t.nClumps, cg, 'clump', t.pad, (S, i) => S[i * 12 + 11] < LOD.keep, LOD.grow), leaf, true, true),
        sprays: mk(merged(t.sites, t.nSites, sg, 'spray', false, () => true), leafMat(true, detail, phi), false, true),
      };
      // (a shrub's season: its blossoms facing out, its berries hanging, with its near crown)
      if (t.adorn) {
        const A = t.adorn, L = f32(A.list), geos = variants(A.geo), per = A.kind === 'bloom' ? 7 : 5, cnt = L.length / per, tri = [], cl = [];
        const qq = new THREE.Quaternion(), mm = new THREE.Matrix4(), vv = new THREE.Vector3();
        for (let i = 0; i < cnt; i++) {
          const b = i * per, G = A.kind === 'bloom' ? geos[0] : geos[Math.min(geos.length - 1, Math.max(0, L[b + 3] - A.lo))], s = L[b + per - 1];
          if (A.kind === 'bloom') qq.setFromUnitVectors(AXZ, new THREE.Vector3(L[b + 3], L[b + 4], L[b + 5]).normalize()); else qq.identity();
          mm.compose(new THREE.Vector3(L[b], L[b + 1], L[b + 2]), qq, new THREE.Vector3(s, s, s));
          for (let k = 0; k < G.n * 3; k++) { vv.set(G.p[k * 3], G.p[k * 3 + 1], G.p[k * 3 + 2]).applyMatrix4(mm); tri.push(vv.x, vv.y, vv.z); for (let c = 0; c < 3; c++) cl.push((G.c[k * 3 + c] / 128) * FL.leafRef[c]); }
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.computeVertexNormals();
        // (its colours its own, not the leaf's: the instance colour left white)
        const am = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: A.kind === 'fruit' ? 0.3 : 0.7, metalness: 0, side: THREE.DoubleSide });
        am.onBeforeCompile = (sh) => { sh.vertexShader = swayHead(sh, phi, 1) + sh.vertexShader.replace('#include <project_vertex>', SWAY_PROJECT); };
        am.customProgramCacheKey = () => 'form-adorn' + phi; moves(am, phi, 1);
        parts.adorn = mk({ g, tris: tri.length / 9 }, am, false, false);
        parts.adorn.white = true;
      }
      return { t, parts, list: by[ti] };
    });
    // the sort: near copies their whole wood and crown (and their sprays inside the detail range), far ones their thick
    // axes and far crown; every copy's matrix and colours set into the pieces it is drawn in
    let stat = {};
    function sortPlants() {
      eye.value.copy(camera.position); let near = 0, far = 0, sprays = 0, tris = 0;
      // (the sprays on the nearest copies inside the detail range only: every other copy's would be drawn at nothing)
      const ranked = [];
      for (const [ti, { t, list }] of T.entries()) for (const i of list) { const b = i * STRIDE, d = Math.hypot(P[b] - camera.position.x, P[b + 1] - camera.position.y, P[b + 2] + t.height * P[b + 3] * 0.5 - camera.position.z) - t.radius * P[b + 3]; if (d < (t.detail || LOD.detail)[1]) ranked.push([d, i]); }
      const sprayed = new Set(ranked.sort((a, b) => a[0] - b[0]).slice(0, LOD.sprayed).map((r) => r[1]));
      for (const { t, parts, list } of T) {
        const c = { wood: 0, woodFar: 0, crown: 0, crownFar: 0, sprays: 0, adorn: 0 };
        for (const i of list) {
          const b = i * STRIDE, sc = P[b + 3], d = Math.hypot(P[b] - camera.position.x, P[b + 1] - camera.position.y, P[b + 2] + t.height * sc * 0.5 - camera.position.z);
          q.setFromAxisAngle(AXZ, P[b + 4]); m4.compose(pv.set(P[b], P[b + 1], P[b + 2]), q, sv.set(sc, sc, sc));
          const isNear = d < LOD.mid, put = (k, col) => { const X = parts[k]; if (!X) return; X.im.setMatrixAt(c[k], m4); if (col) X.im.setColorAt(c[k], col); X.slot[c[k]] = i; c[k]++; };
          const leafC = cv.setRGB(P[b + 5], P[b + 6], P[b + 7], THREE.LinearSRGBColorSpace).clone(), barkC = new THREE.Color().setRGB(P[b + 8], P[b + 9], P[b + 10], THREE.LinearSRGBColorSpace);
          if (isNear) { put('wood', barkC); put('crown', leafC); if (parts.adorn) put('adorn', new THREE.Color(1, 1, 1)); near++; } else { put('woodFar', barkC); put('crownFar', leafC); far++; }
          if (sprayed.has(i)) { put('sprays', leafC); sprays++; }
        }
        for (const [k, X] of Object.entries(parts)) { X.im.count = c[k]; X.im.instanceMatrix.needsUpdate = true; if (X.im.instanceColor) X.im.instanceColor.needsUpdate = true; tris += c[k] * X.tris; }
      }
      stat = { templates: T.length, plants: N, near, far, sprays, triangles: tris, wind: !!(window.__mojTerrain && window.__mojTerrain.wind),
        // (the trunks stand: each template's share of its wood held still, and of its leaves at full sway)
        rigid: T.map(({ t, parts }) => { const w = parts.wood.im.geometry.getAttribute('aSway').array, l = parts.crown.im.geometry.getAttribute('aSway').array; let a = 0, b = 0; for (const v of w) if (v < 0.05) a++; for (const v of l) if (v > 0.95) b++; return { name: t.name, wood: +(a / w.length).toFixed(2), leaves: +(b / l.length).toFixed(2) }; }) };
    }
    sortPlants();
    // the shaking: a walked-through bush brushed by the walker (the camera's foot within its reach) shakes, settling as
    // it is left; written each frame into the copies' slots
    const soft = []; for (let i = 0; i < N; i++) if (P[i * STRIDE + 12] > 0.5) soft.push(i);
    const shake = new Float32Array(N); let last = 0, prev = performance.now();
    (function tick() {
      const t = performance.now(), dt = Math.min(0.1, (t - prev) / 1000); prev = t; floraT.value = t / 1000;
      if (t - last > 250) { last = t; sortPlants(); }
      if (soft.length) {
        for (const i of soft) {
          const b = i * STRIDE, tt = FL.templates[P[b + 11]], r = tt.radius * P[b + 3] + 0.3, d = Math.hypot(P[b] - camera.position.x, P[b + 1] - camera.position.y);
          const foot = camera.position.z - P[b + 2] < tt.height * P[b + 3] + 2;
          shake[i] = d < r && foot ? 1 : Math.max(0, shake[i] - dt / FW.settle);
        }
        for (const { parts } of T) for (const X of Object.values(parts)) { const A = X.im.geometry.getAttribute('aShake'); for (let k = 0; k < X.im.count; k++) A.array[k] = shake[X.slot[k]] || 0; A.needsUpdate = true; }
      }
      requestAnimationFrame(tick);
    })();
    window.__formFlora = () => ({ ...stat, soft: soft.length, shaking: soft.filter((i) => shake[i] > 0).length });
  }
`;
}
