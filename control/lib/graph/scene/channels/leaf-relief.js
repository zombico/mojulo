import { safeJson } from '../emit-util.js';

// In-page script: THE LEAVES' RELIEF (era/shutter-leaves.js). A shutter is one box on its wall; its front wears its form's
// painted tile (the `leaf:` keys), which carries the form from afar. Near the eye this marches the form's height map along
// the view (parallax occlusion), so a slat's slot sinks under the slat above it and a panel stands in its frame, seen
// into as the eye moves. The leaf's own frame comes from the screen's derivatives (its normal, and how its uv runs across
// it in metres), so a leaf of any size marches its relief at its true depth.
//
//   march   `pom.steps` layers down to `depth` (m) under the crest, faded out between `pom.near` and `pom.far` (m): past
//           them a leaf is its tile alone, flat
//
// `__mojLeaf` is the machine gate's probe: the maps and the materials patched. Absent `leaves` ⇒ NOT emitted.
// `cfg`: { maps: { key: { height (a data URL, white the crest), depth } }, pom: { steps, near, far } }
export function leafReliefScript(cfg) {
  return `
// --- the leaves' relief: a shutter's form marched near the eye (channels/leaf-relief.js) ---
const __mojLeaf = (function () {
  const F = ${safeJson(cfg)}, loader = new THREE.TextureLoader(), probe = { maps: Object.keys(F.maps).length, patched: 0 };
  const VERT = 'varying vec3 vLfP;\\n';
  const FRAG = 'uniform sampler2D uLfH;\\nuniform float uLfD;\\nuniform vec2 uLfFade;\\nvarying vec3 vLfP;\\n';
  const POM = \`vec2 lfUV = vMapUv;
{
  vec3 q0 = dFdx( vLfP ), q1 = dFdy( vLfP ), N = normalize( cross( q0, q1 ) ), V = cameraPosition - vLfP;
  float dist = length( V ); V /= dist;
  if ( dot( V, N ) < 0.0 ) N = - N;
  float fk = 1.0 - smoothstep( uLfFade.x, uLfFade.y, dist );
  vec2 s0 = dFdx( vMapUv ), s1 = dFdy( vMapUv );
  vec3 q1p = cross( q1, N ), q0p = cross( N, q0 ); float det = dot( q0, q1p );
  if ( fk > 0.0 && abs( det ) > 1e-14 ) {
    vec3 gu = ( q1p * s0.x + q0p * s1.x ) / det, gv = ( q1p * s0.y + q0p * s1.y ) / det;
    float vn = max( dot( V, N ), 0.2 ); vec3 Vt = V - N * dot( V, N );
    vec2 dUV = vec2( dot( gu, Vt ), dot( gv, Vt ) ) / vn * uLfD * fk / float( LEAF_POM );
    float lay = 0.0, hh = 1.0 - textureGrad( uLfH, lfUV, s0, s1 ).r;
    for ( int k = 0; k < LEAF_POM; k++ ) { if ( lay >= hh ) break; lfUV -= dUV; hh = 1.0 - textureGrad( uLfH, lfUV, s0, s1 ).r; lay += 1.0 / float( LEAF_POM ); }
    lfUV = clamp( lfUV, 0.0, 1.0 );
  }
}
\`;
  const MAP = '#ifdef USE_MAP\\n' + POM + THREE.ShaderChunk.map_fragment.split('vMapUv').join('lfUV') + '\\n#endif\\n';
  const heights = {};
  for (const [key, M] of Object.entries(F.maps)) { const t = loader.load(M.height); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; heights[key] = t; }
  scene.traverse((o) => {
    const M = o.isMesh && o.userData.key ? F.maps[o.userData.key] : null;
    if (!M || !o.material || !o.material.map) return;
    const mat = o.material, H = heights[o.userData.key];
    mat.defines = { ...(mat.defines || {}), LEAF_POM: F.pom.steps };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uLfH: { value: H }, uLfD: { value: M.depth }, uLfFade: { value: new THREE.Vector2(F.pom.near, F.pom.far) } });
      sh.vertexShader = VERT + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vLfP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      sh.fragmentShader = FRAG + sh.fragmentShader.replace('#include <map_fragment>', MAP);
    };
    mat.customProgramCacheKey = () => 'leaf-relief';
    mat.needsUpdate = true;
    probe.patched++;
  });
  return probe;
})();
window.__mojLeaf = __mojLeaf;
`;
}
