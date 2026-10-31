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
 *   `window.__formFlora()` → { templates, plants, near, far, impressions, sprays, triangles } what is drawn now
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
/**
 * THE LITTER under a tree: its fallen leaves round its foot, as alpha on the ground, no geometry a leaf. One disc a tree
 * (`reach` × its crown's radius, at most `most` m), lying on the ground (`lift` m over the grass map's heights, a coarser
 * read of it than the land's, so the land never shows through; never up a stone, and none drawn under one); on it, leaves of the tree's own outline (its
 * template's `litter`: ovate, lobed, broad, lance, or needles) in cells `cell` m across, a leaf a cell where its dice
 * fall under the litter's thickness there (`thick` at the foot, none at the rim), each turned and sized its own way,
 * dark brown, yellowed, or its own green faded (`tones`, linear, the last a share of the tree's leaf colour); in `layers`
 * a little apart (`depth` m), the deeper seen through the gaps of the nearer, shifted against them as the eye moves (a
 * parallax), each deeper a shade darker. Between the leaves, nothing: the ground. A leaf is drawn only where it
 * stands `px` pixels or more on the screen (thinning between them, its narrowest way, measured by the screen's own
 * rate of change of the ground under it): seen far or low across, the litter thins rather than breaking into dots.
 * In the FALL (the level's `autumn`, 0 to 1) it lies thicker and wider (`fall`: its reach, its most and its thickness
 * each grown by as much × the autumn) and less of it brown, more of it the tree's own turned colour.
 */
export const LITTER = Object.freeze({ reach: 0.85, most: 4.5, cell: 0.26, size: Object.freeze([0.6, 0.92]), thick: 0.75, layers: 3, depth: 0.03, lift: 0.06, climb: 0.35, margin: 0.4, px: Object.freeze([4, 8]),
  tones: Object.freeze([Object.freeze([0.16, 0.09, 0.04]), Object.freeze([0.42, 0.3, 0.07]), Object.freeze([0.24, 0.26, 0.1])]),
  fall: Object.freeze({ reach: 0.75, most: 3, thick: 0.25, brown: 0.3 }) });
const LITTER_SHAPES = Object.freeze(['ovate', 'lobed', 'broad', 'lance', 'needle']);
/**
 * A needled crown's NEEDLES, drawn in its sleeves (form/tree-form.js SLEEVE): a pixel of a sleeve marches into it along the
 * eye's ray (`steps` samples across two of its radii), its depth there the true one, from the run's axis, so a ray
 * grazing the sleeve's edge stays in its outer bristle and leaves it spiky; the needles are strands out from the axis on a
 * grid round and along it (`cell` m), each its own length (`length`: the least and the spread, × the reach), leaning
 * toward the shoot's tip (`tilt` m along a metre in), thickening toward the axis (`width` × the cell at the axis); the
 * first strand the ray meets is the pixel, lighter at its tip, darker in (`shade`); meeting none it is not drawn; at the
 * axis (`core` × the reach) the shoot. Far off, where a strand is under `solid` pixels, the sleeve is drawn whole and its
 * edge feathered by how square the eye meets it.
 */
export const NEEDLE_LOOK = Object.freeze({ steps: 14, cell: Object.freeze([0.026, 0.024]), length: Object.freeze([0.6, 0.4]), tilt: 0.7, width: 0.5,
  shade: Object.freeze([1.15, 0.5]), core: 0.08, solid: 1.2 });
/**
 * THE FAR TREES: past the view cone's reach (channels/view-cone.js), in gameplay's camera, a tree or a bush is drawn as
 * its IMPRESSION: a card turned to the eye, painted with itself from that side at the card's own grain. Solved from the
 * recipe, not rendered: its near crown's own leaves (each clump's turned as the tree's recipe turns them, so the leaf
 * mass lies the way its clusters do, its gaps kept, no volume the leaves do not hold) and its wood's own triangles,
 * rasterized at `texels` (the crown's width, its height) from `bearings` sides, a leaf a quarter texel wider (`leaf`) so
 * a leaf under a texel is still a pixel of leaf, a limb half a texel (`wood`); each texel its surface's facing (a leaf's
 * its clump's), its tone (a leaf's its own) and whether leaf or wood. Baked once a template at load. The card is lit as
 * the land is by that facing, the leaf its plant's colour at its own tone and the wood its bark's, and casts its
 * silhouette from the sun's side into the land's shadow map. Every far plant is one draw. A needled crown and a culm keep their own far form.
 * A plant climbs a ladder by the screen's own rule, each rung where its own grain goes under a pixel: whole inside the
 * view cone's reach; past it, its own far form (fewer clumps grown, its thick axes); and its card where the card's texel
 * (its width over `texels`, × the plant's scale) is under `px` pixels at its distance. The aerial camera keeps the
 * trees' own far form past FLORA_LOD.mid.
 */
export const FLORA_FAR = Object.freeze({ bearings: 8, texels: Object.freeze([64, 96]), px: 1, leaf: 0.25, wood: 0.5 });
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
    // a needled crown's sleeves: the tube, each vertex's offset from its run's axis and the axis's run, its coordinates
    function sleeveGeo(W) {
      const G = woodGeo(W), g = G.g;
      g.setAttribute('aOut', new THREE.BufferAttribute(f32(W.out), 3)); g.setAttribute('aAx', new THREE.BufferAttribute(i8(W.ax), 3, true));
      g.setAttribute('aUvS', g.getAttribute('uv')); g.deleteAttribute('uv');
      return G;
    }
    function needleMat(phi) {
      const NL = ${safeJson(NEEDLE_LOOK)}, m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
      const VHEAD = 'attribute vec3 aOut;\\nattribute vec3 aAx;\\nattribute vec2 aUvS;\\nvarying vec2 vUvS;\\nvarying vec3 vCoreV;\\nvarying vec3 vAxV;\\nvarying float vRadV;\\nvarying float vScaleV;\\n';
      moves(m, phi, 1);
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = swayHead(sh, phi, 1) + VHEAD + sh.vertexShader
          .replace('#include <project_vertex>', SWAY_PROJECT + [
            // (the run's axis where this vertex is, in the eye's space after the sway: the vertex less its offset from it)
            '\\n  mat3 mvI = mat3( modelViewMatrix );',
            '#ifdef USE_INSTANCING',
            '  mvI = mvI * mat3( instanceMatrix );',
            '#endif',
            '  vec3 oV = mvI * aOut; vCoreV = mvPosition.xyz - oV; vAxV = mvI * aAx; vRadV = length( oV ); vScaleV = vRadV / max( 1e-4, length( aOut ) ); vUvS = aUvS;'].join('\\n'));
        sh.fragmentShader = 'varying vec2 vUvS;\\nvarying vec3 vCoreV;\\nvarying vec3 vAxV;\\nvarying float vRadV;\\nvarying float vScaleV;\\nfloat nlH( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\\n' + sh.fragmentShader
          .replace('#include <color_fragment>', [
            '#include <color_fragment>',
            '  {',
            '  vec3 P = -vViewPosition, Dv = normalize( P ), A = normalize( vAxV ); float Rr = vRadV, S = vScaleV;',
            '  vec3 rel0 = P - vCoreV, nOut = normalize( rel0 - A * dot( rel0, A ) ), Tu = normalize( cross( A, nOut ) );',
            '  vec2 CELL = vec2( ' + NL.cell[0].toFixed(3) + ', ' + NL.cell[1].toFixed(3) + ' );',
            '  float hit = -1.0, dHit = 0.0, lastD = -1.0;',
            // (far: a strand under a few pixels, the sleeve whole, its edge feathered)
            '  float pxS = length( fwidth( vUvS ) ) / CELL.x;',
            '  if ( pxS > ' + NL.solid.toFixed(2) + ' ) { float g = -dot( Dv, nOut ); if ( g < 0.32 * nlH( floor( vUvS / CELL ) ) ) discard; hit = 1.0; dHit = 0.35 + 0.4 * ( 1.0 - g ); }',
            '  else for ( int i = 0; i < ' + NL.steps + '; i++ ) {',
            '    float t = ( float( i ) + 0.5 ) / ' + NL.steps.toFixed(1) + ' * 2.0 * Rr;',
            '    vec3 Q = P + Dv * t, rel = Q - vCoreV; float al = dot( rel, A ), rho = length( rel - A * al ), d = Rr - rho;',
            '    lastD = d;',
            '    if ( d < 0.0 ) { if ( i > 0 ) break; else continue; }',
            '    if ( rho < Rr * ' + NL.core.toFixed(2) + ' ) { hit = 0.0; break; }',
            '    vec2 q = vec2( vUvS.x + dot( Q - P, Tu ) / S, vUvS.y + dot( Q - P, A ) / S ), cell = floor( q / CELL );',
            '    float h1 = nlH( cell ), h2 = nlH( cell + 3.1 ), h3 = nlH( cell + 7.7 ), dn = d / Rr;',
            '    if ( dn < 1.0 - ( ' + NL.length[0].toFixed(2) + ' + ' + NL.length[1].toFixed(2) + ' * h3 ) ) continue;',
            '    vec2 c = ( cell + 0.5 + ( vec2( h1, h2 ) - 0.5 ) * 0.6 ) * CELL; c.y -= ' + NL.tilt.toFixed(2) + ' * d / S;',
            '    vec2 e = ( q - c ) / CELL; e.y /= 1.6;',
            '    if ( length( e ) < ' + NL.width.toFixed(2) + ' * ( 0.3 + 0.7 * dn ) ) { hit = 1.0; dHit = dn; break; }',
            '  }',
            // (still inside at the march's end: the crown's dense middle)
            '  if ( hit < 0.0 && lastD > 0.0 ) { hit = 1.0; dHit = 0.9; }',
            '  if ( hit < 0.0 ) discard;',
            '  diffuseColor.rgb = hit > 0.5 ? diffuseColor.rgb * mix( ' + NL.shade[0].toFixed(2) + ', ' + NL.shade[1].toFixed(2) + ', dHit ) : diffuseColor.rgb * 0.38;',
            '  }'].join('\\n'))
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.22;');
      };
      m.customProgramCacheKey = () => 'form-needles' + phi;
      return m;
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
      // (a needled crown: its sleeves near and far, the needles drawn in them; no crown of clumps, no sprays)
      if (t.sleeve) {
        const sl = sleeveGeo(t.sleeve), nm = needleMat(phi);
        return { t, list: by[ti], parts: { wood: mk(woodGeo(t.wood), wood, true, false), woodFar: mk(woodGeo(t.woodFar || t.wood), wood, true, false), crown: mk(sl, nm, true, false), crownFar: mk(sleeveGeo(t.sleeve), nm, true, false) } };
      }
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
    // THE FAR TREES (FLORA_FAR): each template's silhouette from each bearing, baked from its clumps' discs and its trunk;
    // one card a far plant, turned to the eye, painted with it
    const FF0 = ${safeJson(FLORA_FAR)}, IB = FF0.bearings, [IW, IH] = FF0.texels;
    const impOf = T.map(({ t }) => !t.sleeve && !t.culm && t.nClumps > 0);
    const impRow = []; let rows = 0; impOf.forEach((ok, ti) => { impRow[ti] = ok ? rows++ : -1; });
    const atlas = new Uint8Array(Math.max(1, rows) * IH * IB * IW * 4), tpl = Array.from({ length: Math.max(1, T.length) }, () => new THREE.Vector4());
    T.forEach(({ t }, ti) => {
      if (!impOf[ti]) return;
      // (the leaves: the near crown's own triangles, each clump's leaves as the tree's recipe turns them, its tone and
      // its clump's facing)
      const CG = T[ti].parts.crown.im.geometry, LP = CG.getAttribute('position').array, LC = CG.getAttribute('color').array, LO = CG.getAttribute('aOut').array;
      // (the wood: its trunk and its limbs, the triangles themselves)
      const W = f32(t.wood.pos), WI = t.wood.big ? new Uint32Array(bytes(t.wood.idx).buffer) : new Uint16Array(bytes(t.wood.idx).buffer);
      let R = 0.5, top = 0.5;
      for (const A of [LP, W]) for (let k = 0; k < A.length; k += 3) { R = Math.max(R, Math.hypot(A[k], A[k + 1])); top = Math.max(top, A[k + 2]); }
      const row = impRow[ti], du0 = (2 * R) / IW, dv0 = top / IH, depth = new Float32Array(IW * IH);
      tpl[ti].set(R, top, row, du0);
      for (let k = 0; k < IB; k++) {
        const th = (2 * Math.PI * k) / IB, rx = -Math.sin(th), ry = Math.cos(th), tx = Math.cos(th), ty = Math.sin(th);
        depth.fill(-Infinity);
        const put = (iu, iv, f, nx, ny, tone, kind) => { const q = iv * IW + iu; if (f <= depth[q]) return; depth[q] = f; const o = (((row * IH + iv) * IB + k) * IW + iu) * 4;
          atlas[o] = Math.round((Math.max(-1, Math.min(1, nx)) * 0.5 + 0.5) * 255); atlas[o + 1] = Math.round((Math.max(-1, Math.min(1, ny)) * 0.5 + 0.5) * 255); atlas[o + 2] = Math.round(Math.min(1, tone) * 255); atlas[o + 3] = kind; };
        // (a triangle over its box: a texel whose centre is inside it, or within its grow of texels, is its; front-most wins)
        const tri = (a0, a1, a2, grow, nu, nv, tone, kind) => {
          const V = [a0, a1, a2].map((a) => [(a[0] * rx + a[1] * ry + R) / du0, a[2] / dv0, a[0] * tx + a[1] * ty]);
          const area = (V[1][0] - V[0][0]) * (V[2][1] - V[0][1]) - (V[2][0] - V[0][0]) * (V[1][1] - V[0][1]), f = (V[0][2] + V[1][2] + V[2][2]) / 3;
          for (let iv = Math.max(0, Math.floor(Math.min(V[0][1], V[1][1], V[2][1]) - grow)); iv <= Math.min(IH - 1, Math.floor(Math.max(V[0][1], V[1][1], V[2][1]) + grow)); iv++)
            for (let iu = Math.max(0, Math.floor(Math.min(V[0][0], V[1][0], V[2][0]) - grow)); iu <= Math.min(IW - 1, Math.floor(Math.max(V[0][0], V[1][0], V[2][0]) + grow)); iu++) {
              const px = iu + 0.5, py = iv + 0.5;
              let ok = true; for (let e = 0; e < 3 && ok; e++) { const a = V[e], b = V[(e + 1) % 3], ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1e-6; if ((Math.sign(area || 1) * (ex * (py - a[1]) - ey * (px - a[0]))) / el < -grow) ok = false; }
              if (ok) put(iu, iv, f, nu, nv, tone, kind);
            }
        };
        const at = (A, v) => [A[v * 3], A[v * 3 + 1], A[v * 3 + 2]];
        // (the leaves, a quarter texel wider so a leaf under a texel is still a pixel of leaf; lit as their clump faces)
        for (let v = 0; v < LP.length / 3; v += 3) {
          const o = at(LO, v), tone = ((LC[v * 3] + LC[v * 3 + 1] + LC[v * 3 + 2]) / 3) * 0.5;
          tri(at(LP, v), at(LP, v + 1), at(LP, v + 2), FF0.leaf, o[0] * rx + o[1] * ry, o[2], tone, 255);
        }
        // (the wood, half a texel wider so a limb thinner than a texel still shows)
        for (let f = 0; f < WI.length; f += 3) {
          const a = at(W, WI[f]), b = at(W, WI[f + 1]), c = at(W, WI[f + 2]), e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(...n) || 1;
          tri(a, b, c, FF0.wood, (n[0] * rx + n[1] * ry) / nl, n[2] / nl, 0.5, 128);
        }
      }
    });
    const impTex = new THREE.DataTexture(atlas, IB * IW, Math.max(1, rows) * IH, THREE.RGBAFormat); impTex.magFilter = impTex.minFilter = THREE.NearestFilter; impTex.needsUpdate = true;
    const ig = new THREE.InstancedBufferGeometry(); ig.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 0, 1, -1, 0, 1], 3)); ig.setIndex([0, 1, 2, 0, 2, 3]);
    const iPos = new Float32Array(Math.max(1, N) * 4), iTR = new Float32Array(Math.max(1, N) * 2), iLeaf = new Float32Array(Math.max(1, N) * 3), iBark = new Float32Array(Math.max(1, N) * 3);
    for (const [k, a, w] of [['aPos', iPos, 4], ['aTR', iTR, 2], ['aLeaf', iLeaf, 3], ['aBark', iBark, 3]]) ig.setAttribute(k, new THREE.InstancedBufferAttribute(a, w).setUsage(THREE.DynamicDrawUsage));
    ig.instanceCount = 0;
    const IU = { tImp: { value: impTex }, uTpl: { value: tpl }, uImpRows: { value: Math.max(1, rows) } };
    // (the card: turned to the eye about its foot, its bearing the nearest baked one in the plant's own turn)
    const IMP_VERT = 'attribute vec4 aPos;\\nattribute vec2 aTR;\\nattribute vec3 aLeaf;\\nattribute vec3 aBark;\\nuniform vec4 uTpl[ ' + Math.max(1, T.length) + ' ];\\nuniform float uImpRows;\\nvarying vec2 vAt;\\nvarying vec3 vLeaf, vBark, vRt, vTw;\\n';
    const IMP_PLACE = [
      'vec4 Tp = uTpl[ int( aTR.y + 0.5 ) ]; vec2 to = cameraPosition.xy - aPos.xy; float Lt = length( to ); vec2 tw = Lt > 1e-4 ? to / Lt : vec2( 1.0, 0.0 ), rt = vec2( -tw.y, tw.x );',
      'float bk = mod( floor( ( atan( tw.y, tw.x ) - aTR.x ) / 6.2831853 * ' + IB.toFixed(1) + ' + 0.5 ), ' + IB.toFixed(1) + ' );',
      'vec3 transformed = vec3( aPos.xy + rt * position.x * Tp.x * aPos.w, aPos.z + position.z * Tp.y * aPos.w );',
      'vAt = vec2( ( bk + position.x * 0.5 + 0.5 ) / ' + IB.toFixed(1) + ', ( Tp.z + position.z ) / uImpRows ); vLeaf = aLeaf; vBark = aBark; vRt = vec3( rt, 0.0 ); vTw = vec3( tw, 0.0 );'].join('\\n');
    const im = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    im.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, IU);
      sh.vertexShader = IMP_VERT + sh.vertexShader.replace('#include <begin_vertex>', IMP_PLACE);
      sh.fragmentShader = 'uniform sampler2D tImp;\\nvarying vec2 vAt;\\nvarying vec3 vLeaf, vBark, vRt, vTw;\\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\\n  vec4 impA = texture2D( tImp, vAt ); if ( impA.a < 0.25 ) discard;\\n  diffuseColor.rgb *= ( impA.a > 0.75 ? vLeaf : vBark ) * impA.b * 2.0;')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  { vec2 nn = impA.rg * 2.0 - 1.0; normal = normalize( ( viewMatrix * vec4( normalize( vRt * nn.x + vec3( 0.0, 0.0, 1.0 ) * nn.y + vTw * sqrt( max( 0.0, 1.0 - dot( nn, nn ) ) ) ), 0.0 ) ).xyz ); }');
    };
    im.customProgramCacheKey = () => 'form-flora-far';
    // (its shadow: the card turned to the sun, its silhouette from that side)
    const idm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    idm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, IU);
      sh.vertexShader = IMP_VERT + sh.vertexShader.replace('#include <begin_vertex>', IMP_PLACE);
      sh.fragmentShader = 'uniform sampler2D tImp;\\nvarying vec2 vAt;\\n' + sh.fragmentShader.replace('void main() {', 'void main() {\\n  if ( texture2D( tImp, vAt ).a < 0.25 ) discard;');
    };
    idm.customProgramCacheKey = () => 'form-flora-far-depth';
    const impMesh = new THREE.Mesh(ig, im); impMesh.customDepthMaterial = idm; impMesh.castShadow = impMesh.receiveShadow = true; impMesh.frustumCulled = false; impMesh.userData.ink = true; scene.add(impMesh);
    // the sort: near copies their whole wood and crown (and their sprays inside the detail range), far ones their thick
    // axes and far crown; every copy's matrix and colours set into the pieces it is drawn in
    let stat = {};
    function sortPlants() {
      eye.value.copy(camera.position); let near = 0, far = 0, sprays = 0, tris = 0, imps = 0;
      // (gameplay's camera: the near trees end at the view cone's reach and past it each is its impression; the aerial
      // camera keeps the trees' own far form past FLORA_LOD.mid)
      const CO = window.__mojCone, FFd = window.__formFar, pov = !!CO && CO.reach < 1e5 && (!FFd || FFd.pov()) && (!window.__formFarField || window.__formFarField.on);
      const mid = pov ? CO.reach : LOD.mid;
      // (the sprays on the nearest copies inside the detail range only: every other copy's would be drawn at nothing)
      const ranked = [];
      for (const [ti, { t, list }] of T.entries()) for (const i of list) { const b = i * STRIDE, d = Math.hypot(P[b] - camera.position.x, P[b + 1] - camera.position.y, P[b + 2] + t.height * P[b + 3] * 0.5 - camera.position.z) - t.radius * P[b + 3]; if (d < (t.detail || LOD.detail)[1]) ranked.push([d, i]); }
      const sprayed = new Set(ranked.sort((a, b) => a[0] - b[0]).slice(0, LOD.sprayed).map((r) => r[1]));
      for (const [ti, { t, parts, list }] of T.entries()) {
        const c = { wood: 0, woodFar: 0, crown: 0, crownFar: 0, sprays: 0, adorn: 0 };
        for (const i of list) {
          const b = i * STRIDE, sc = P[b + 3], d = Math.hypot(P[b] - camera.position.x, P[b + 1] - camera.position.y, P[b + 2] + t.height * sc * 0.5 - camera.position.z);
          q.setFromAxisAngle(AXZ, P[b + 4]); m4.compose(pv.set(P[b], P[b + 1], P[b + 2]), q, sv.set(sc, sc, sc));
          const isNear = d < mid, card = pov && impOf[ti] && d >= Math.max(mid, (tpl[ti].w * sc) / (FF0.px * CO.px)), put = (k, col) => { const X = parts[k]; if (!X) return; X.im.setMatrixAt(c[k], m4); if (col) X.im.setColorAt(c[k], col); X.slot[c[k]] = i; c[k]++; };
          const leafC = cv.setRGB(P[b + 5], P[b + 6], P[b + 7], THREE.LinearSRGBColorSpace).clone(), barkC = new THREE.Color().setRGB(P[b + 8], P[b + 9], P[b + 10], THREE.LinearSRGBColorSpace);
          if (isNear) { put('wood', barkC); put('crown', leafC); if (parts.adorn) put('adorn', new THREE.Color(1, 1, 1)); near++; }
          else if (card) { const bm = FL.barks[t.bark] ? FL.barks[t.bark].mean : [0.1, 0.07, 0.05]; iPos.set([P[b], P[b + 1], P[b + 2], sc], imps * 4); iTR.set([P[b + 4], ti], imps * 2); iLeaf.set([leafC.r, leafC.g, leafC.b], imps * 3); iBark.set([barkC.r * bm[0], barkC.g * bm[1], barkC.b * bm[2]], imps * 3); imps++; far++; }
          else { put('woodFar', barkC); put('crownFar', leafC); far++; }
          if (sprayed.has(i)) { put('sprays', leafC); sprays++; }
        }
        for (const [k, X] of Object.entries(parts)) { X.im.count = c[k]; X.im.instanceMatrix.needsUpdate = true; if (X.im.instanceColor) X.im.instanceColor.needsUpdate = true; tris += c[k] * X.tris; }
      }
      ig.instanceCount = imps; for (const k of ['aPos', 'aTR', 'aLeaf', 'aBark']) ig.getAttribute(k).needsUpdate = true; tris += imps * 2;
      stat = { templates: T.length, plants: N, near, far, impressions: imps, sprays, triangles: tris, wind: !!(window.__mojTerrain && window.__mojTerrain.wind),
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
    // the LITTER: a disc round each tree's foot lying on the ground (the grass map's heights where it has them), its
    // leaves drawn in the fragment: the tree's outline in cells, in layers a parallax apart, nothing between them
    (function () {
      const LT = ${safeJson(LITTER)}, SH = ${safeJson(LITTER_SHAPES)}, Gm = D.grass, gp = Gm ? bytes(Gm.px) : null, AU = FL.autumn || 0;
      const zAt = (x, y, z0) => { if (!gp) return z0; const [nx, ny] = Gm.size, u = (x - Gm.origin[0]) / Gm.cell, v = (y - Gm.origin[1]) / Gm.cell, i = Math.floor(u), j = Math.floor(v), f = u - i, g = v - j;
        const zq = (a, b) => { const q = (Math.min(ny - 1, Math.max(0, b)) * nx + Math.min(nx - 1, Math.max(0, a))) * 4; return Gm.z[0] + ((gp[q] * 256 + gp[q + 1]) / 65535) * Gm.z[1]; };
        return (zq(i, j) * (1 - f) + zq(i + 1, j) * f) * (1 - g) + (zq(i, j + 1) * (1 - f) + zq(i + 1, j + 1) * f) * g; };
      const pos = [], loc = [], tree = [], col = [], cov = [], idx = [], RINGS = 7, SEGS = 18;
      for (let i = 0; i < N; i++) {
        const b = i * STRIDE, t = FL.templates[P[b + 11]]; if (t.kind !== 'tree' || !t.litter) continue;
        const R = Math.min(LT.most + LT.fall.most * AU, (LT.reach + LT.fall.reach * AU) * t.radius * P[b + 3]), base = pos.length / 3, sh = Math.max(0, SH.indexOf(t.litter));
        for (let r = 0; r <= RINGS; r++) for (let k = 0; k < (r ? SEGS : 1); k++) {
          const a = (2 * Math.PI * k) / SEGS, d = (R * r) / RINGS, x = P[b] + d * Math.cos(a), y = P[b + 1] + d * Math.sin(a);
          // (never climbing a stone: the map's heights take a boulder's top, so the disc rises no steeper than LT.climb from the
          // tree's foot and goes under what stands higher)
          const zg = zAt(x, y, P[b + 2]), zc = P[b + 2] + LT.climb * d + 0.05;
          // (covered: a stone over the ground here or within LT.margin of it, so no leaf shows at a stone's foot either)
          const up = (u, v) => zAt(u, v, P[b + 2]) > zc + 0.1 + LT.climb * Math.hypot(u - x, v - y);
          const near = up(x, y) || [0, 1, 2, 3, 4, 5].some((q) => up(x + LT.margin * Math.cos(q * 1.0472), y + LT.margin * Math.sin(q * 1.0472)));
          pos.push(x, y, Math.min(zg, zc) + LT.lift); cov.push(near ? 1 : 0); loc.push(x - P[b], y - P[b + 1], R); tree.push(sh, (i * 37) % 97); col.push(P[b + 5], P[b + 6], P[b + 7]);
        }
        const at = (r, k) => (r ? base + 1 + (r - 1) * SEGS + (k % SEGS) : base);
        for (let k = 0; k < SEGS; k++) idx.push(at(0, 0), at(1, k), at(1, k + 1));
        for (let r = 1; r < RINGS; r++) for (let k = 0; k < SEGS; k++) idx.push(at(r, k), at(r + 1, k), at(r + 1, k + 1), at(r, k), at(r + 1, k + 1), at(r, k + 1));
      }
      if (!idx.length) return;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aLoc', new THREE.Float32BufferAttribute(loc, 3));
      g.setAttribute('aTree', new THREE.Float32BufferAttribute(tree, 2)); g.setAttribute('aGreen', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aCov', new THREE.Float32BufferAttribute(cov, 1)); g.setIndex(idx);
      g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
      // (drawn after the solids, whole where a leaf is and nothing between, so the occlusion's prepass, which would draw the
      // disc whole, passes it by: channels/creases.js reads a transparent material as no surface)
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, transparent: true, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -2 });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute vec3 aLoc;\\nattribute vec2 aTree;\\nattribute vec3 aGreen;\\nattribute float aCov;\\nvarying vec3 vLoc;\\nvarying vec2 vTree;\\nvarying vec3 vGreen;\\nvarying vec3 vWp;\\nvarying float vCov;\\n' + sh.vertexShader
          .replace('#include <begin_vertex>', '#include <begin_vertex>\\n  vLoc = aLoc; vTree = aTree; vGreen = aGreen; vCov = aCov; vWp = ( modelMatrix * vec4( position, 1.0 ) ).xyz;');
        const shapes = SH.map((n, k) => '    if ( s == ' + k + ' ) w = ' + ({ ovate: '0.42 * sqrt( max( 0.0, 1.0 - x * x ) ) * ( 1.05 - 0.35 * x )', lobed: '0.52 * sqrt( max( 0.0, 1.0 - x * x ) ) * ( 0.72 + 0.28 * cos( x * 9.4 ) )', broad: '0.62 * sqrt( max( 0.0, 1.0 - x * x ) )', lance: '0.2 * sqrt( max( 0.0, 1.0 - x * x ) )', needle: '0.05' })[n] + ';').join('\\n');
        sh.fragmentShader = 'varying vec3 vLoc;\\nvarying vec2 vTree;\\nvarying vec3 vGreen;\\nvarying vec3 vWp;\\nvarying float vCov;\\n'
          + 'float ltH( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\\n'
          + 'float ltW( int s, float x ) { float w = 0.0;\\n' + shapes + '\\n  return w; }\\n' + sh.fragmentShader
          .replace('#include <color_fragment>', [
            '#include <color_fragment>',
            // (the eye's slant over the ground: a deeper layer shifts against a nearer one as it moves)
            '  vec3 eyeL = normalize( cameraPosition - vWp ); vec2 par = eyeL.xy / max( eyeL.z, 0.3 );',
            // (the tree's shape and seed whole numbers, rounded: an interpolated value drifts in its last digits, which the
            // hash would turn into a different leaf at every pixel)
            '  int sL = int( vTree.x + 0.5 ); float sd = floor( vTree.y + 0.5 ); vec3 got = vec3( -1.0 );',
            // (how many pixels a leaf spans its narrowest way here: none drawn under the least)
            '  vec2 fw = fwidth( vLoc.xy ); float pxL = ' + LT.cell.toFixed(3) + ' * 0.7 / max( 1e-5, max( fw.x, fw.y ) ), seen = smoothstep( ' + LT.px[0].toFixed(1) + ', ' + LT.px[1].toFixed(1) + ', pxL );',
            // (none where a stone stands over the ground: the disc goes under it, and nothing of it shows)
            '  if ( seen <= 0.0 || vCov > 0.01 ) discard;',
            '  for ( int k = 0; k < ' + LT.layers + '; k++ ) {',
            '    vec2 p = vLoc.xy + par * float( k ) * ' + LT.depth.toFixed(3) + ' + vec2( float( k ) * 0.37, float( k ) * 0.61 );',
            '    vec2 c = floor( p / ' + LT.cell.toFixed(3) + ' ), f = p / ' + LT.cell.toFixed(3) + ' - c - 0.5; vec2 key = c + vec2( sd * 13.0, float( k ) * 57.0 );',
            '    float thick = ' + Math.min(0.97, LT.thick + LT.fall.thick * AU).toFixed(2) + ' * ( 1.0 - smoothstep( 0.25, 1.0, length( p ) / vLoc.z ) ) * seen;',
            '    if ( ltH( key ) > thick ) continue;',
            '    float a = ltH( key + 3.1 ) * 6.2832, sz = mix( ' + LT.size[0].toFixed(2) + ', ' + LT.size[1].toFixed(2) + ', ltH( key + 7.7 ) ) * 0.5;',
            '    vec2 o = ( vec2( ltH( key + 1.3 ), ltH( key + 5.9 ) ) - 0.5 ) * ( 0.5 - sz ) * 2.0, q = f - o; q = mat2( cos( a ), sin( a ), -sin( a ), cos( a ) ) * q / sz;',
            '    if ( abs( q.x ) > 1.0 || abs( q.y ) > ltW( sL, q.x ) ) continue;',
            // (its tone: dark brown, yellowed, or the tree's own green faded; a midrib a shade darker down its middle)
            '    float tn = ltH( key + 9.3 ); vec3 gr = vGreen / max( 1e-3, max( vGreen.r, max( vGreen.g, vGreen.b ) ) );',
            '    vec3 tone = tn < ' + (0.45 - LT.fall.brown * AU).toFixed(2) + ' ? vec3(' + LT.tones[0].join(', ') + ') : tn < ' + (0.8 - 0.4 * AU).toFixed(2) + ' ? vec3(' + LT.tones[1].join(', ') + ') : ' + (AU > 0 ? 'vGreen * ( 0.9 + 0.3 * ltH( key + 4.4 ) )' : 'vec3(' + LT.tones[2].join(', ') + ') * gr') + ';',
            '    got = tone * ( 0.75 + 0.5 * ltH( key + 2.2 ) ) * ( 1.0 - 0.22 * float( k ) ) * ( sL == 4 ? 1.0 : 1.0 - 0.3 * ( 1.0 - smoothstep( 0.0, 0.1, abs( q.y ) ) ) );',
            '    break;',
            '  }',
            '  if ( got.x < 0.0 ) discard;',
            '  diffuseColor.rgb = got;'].join('\\n'));
      };
      m.customProgramCacheKey = () => 'form-litter';
      const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; scene.add(mesh);
      window.__formLitter = idx.length / 3;
    })();
    window.__formFlora = () => ({ ...stat, soft: soft.length, shaking: soft.filter((i) => shake[i] > 0).length });
  }
`;
}
