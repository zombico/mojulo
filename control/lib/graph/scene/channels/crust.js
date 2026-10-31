// In-page script (part of the form channel, channels/form-land.js): THE CRUST, the far image the view cone's main slice
// is drawn over. In gameplay's camera (POV) each frame is drawn in two: the CRUST, everything past the cone's reach,
// rendered from the eye into an image with its depth, then painted over in 2D; and the MAIN SLICE, the live scene to the
// reach (the camera's far plane there), with the painted crust as its background. Mojulo web only.
//
//   the matte   a 2D pass over the crust, from that eye only: the impressions of what is not drawn past the reach. The
//               crust's depth says which world point each pixel is, and the grass's FAR MAP (channels/form-grass.js
//               `window.__formFar`: a strand a cell, its height, colour slot, dice and the ground's height) whether it is
//               grass there. Grass is spent on the land's CONTOUR, not everywhere:
//                 the BLANKET  every pixel of grass is one colour, the grass's, lit by the plate's light (the crust's
//                              colour there over the undergrowth's: its sun and its shadow both), offset by its cell's
//                              dice (CRUST.blanket: its tone, and a flower's colour where one grows), so the field is
//                              still and anchored to the world as the eye moves
//                 the FRINGE   where the grass's edge meets what is past it (the sky, or ground farther than CRUST.edge ×
//                              its own depth: a ridge, a bank), strands stand up the image from the contour, a pixel
//                              wide and 1 to CRUST.fringe pixels tall by a fine world dice, darker at the root, a
//                              flower's colour at a tip where one grows: the silhouette
//   aerial      (a cutscene's camera, the grass's `aerial`) draws the whole scene live, no crust
//
// `window.__formCrust`: { on, set(bool) }; C toggles it on a walkable page. The shadow map is drawn once, by the crust.
export const CRUST = Object.freeze({ fringe: 3, edge: 1.2, strand: 0.12, ground: 0.35, tone: Object.freeze([0.6, 1.4]), blanket: Object.freeze({ tone: Object.freeze([0.85, 1.15]), flowers: 0.35 }) });

const PAINT = (C) => `precision highp float;
uniform sampler2D tC, tD, tFarG;
uniform vec2 uRes, uFGo;
uniform ivec2 uFGn;
uniform float uLogF, uFGc, uFGz0, uFGzr;
uniform mat4 uPI, uCW;
uniform vec3 uUnder, uFGcol[ 16 ];
uniform float uFGfl[ 16 ];
varying vec2 vUv;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
// (a pixel's view depth, from the log depth; and its world point, along its ray)
float viewW( ivec2 b ) { float d = texelFetch( tD, b, 0 ).r; return d >= 1.0 ? 1e9 : exp2( d * uLogF ) - 1.0; }
vec3 worldAt( ivec2 b, float w ) { vec4 r = uPI * vec4( ( vec2( b ) + 0.5 ) / uRes * 2.0 - 1.0, 1.0, 1.0 ); vec3 rv = r.xyz / r.w; return ( uCW * vec4( rv / -rv.z * w, 1.0 ) ).xyz; }
// (the far map's strand where a pixel is grass: the ground there, at the ground's height; none elsewhere)
vec4 grassAt( vec3 W ) {
  ivec2 c = ivec2( floor( ( W.xy - uFGo ) / uFGc ) );
  if ( c.x < 0 || c.y < 0 || c.x >= uFGn.x || c.y >= uFGn.y ) return vec4( 0.0 );
  vec4 t = texelFetch( tFarG, c, 0 );
  return t.r > 0.0 && abs( W.z - ( uFGz0 + t.b * uFGzr ) ) < ${C.ground.toFixed(2)} ? t : vec4( 0.0 );
}
vec3 lightAt( ivec2 b ) { return texelFetch( tC, b, 0 ).rgb / max( uUnder, vec3( 1e-3 ) ); }
void main() {
  ivec2 P = ivec2( floor( vUv * uRes ) );
  // the FRINGE: a contour of grass under this pixel, the grass's edge against what is past it, a strand standing up from it
  for ( int k = 1; k <= ${C.fringe}; k++ ) {
    ivec2 b = P - ivec2( 0, k );
    if ( b.y < 0 ) break;
    float wb = viewW( b );
    if ( wb > 1e8 ) continue;
    vec3 W = worldAt( b, wb );
    vec4 t = grassAt( W );
    if ( t.r <= 0.0 || viewW( b + ivec2( 0, 1 ) ) < wb * ${C.edge.toFixed(2)} ) continue;
    float h = hash( floor( W.xy / ${C.strand.toFixed(2)} ) ), tall = ceil( ${C.fringe.toFixed(1)} * h * ( 0.5 + 0.5 * t.r ) );
    if ( float( k ) > tall ) continue;
    int si = int( t.g * 255.0 + 0.5 );
    float bt = float( k ) / tall;
    vec3 alb = uFGfl[ si ] > 0.5 && bt < 1.0 ? uFGcol[ 0 ] : uFGcol[ si ];
    gl_FragColor = vec4( alb * lightAt( b ) * mix( ${C.tone[0].toFixed(2)}, ${C.tone[1].toFixed(2)}, bt ) * ( 0.85 + 0.3 * t.a ), 1.0 );
    return;
  }
  // the BLANKET: grass is one colour, its own, lit as the plate is, offset by its cell's dice
  float w = viewW( P );
  if ( w < 1e8 ) {
    vec3 W = worldAt( P, w );
    vec4 t = grassAt( W );
    if ( t.r > 0.0 ) {
      int si = int( t.g * 255.0 + 0.5 );
      vec3 alb = uFGfl[ si ] > 0.5 && hash( W.xy * 3.7 ) < ${C.blanket.flowers.toFixed(2)} ? uFGcol[ si ] : uFGcol[ 0 ] * ( si > 0 && uFGfl[ si ] < 0.5 ? uFGcol[ si ] / max( uFGcol[ 0 ], vec3( 1e-3 ) ) : vec3( 1.0 ) );
      gl_FragColor = vec4( alb * lightAt( P ) * mix( ${C.blanket.tone[0].toFixed(2)}, ${C.blanket.tone[1].toFixed(2)}, t.a ), 1.0 );
      return;
    }
  }
  gl_FragColor = texture2D( tC, vUv );
}
`;

/** The crust's page source: after the grass and the view cone, in the form channel's scope (THREE, scene, renderer,
 *  LAYER_U). */
export function crustScript() {
  return `
  // --- the crust: the far image past the view cone's reach, painted in 2D (channels/crust.js) ---
  (function () {
    const CO = window.__mojCone, FF = window.__formFar; if (!CO || !FF) return;
    const size = new THREE.Vector2(), dt = new THREE.DepthTexture(1, 1); dt.type = THREE.FloatType;
    const farRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: dt }), outRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const cc = new THREE.PerspectiveCamera();
    const PU = { tC: { value: farRT.texture }, tD: { value: dt }, tFarG: { value: FF.tex }, uRes: { value: new THREE.Vector2() }, uFGo: { value: new THREE.Vector2(...FF.origin) }, uFGn: { value: new THREE.Vector2(...FF.n) },
      uLogF: { value: 1 }, uFGc: { value: FF.cell }, uFGz0: { value: FF.z[0] }, uFGzr: { value: FF.z[1] }, uPI: { value: new THREE.Matrix4() }, uCW: { value: new THREE.Matrix4() }, uUnder: LAYER_U.uUnderBase, uFGcol: { value: FF.cols }, uFGfl: { value: FF.flowers } };
    const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: PU, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv;\\nvoid main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }', fragmentShader: ${JSON.stringify(PAINT(CRUST))} })));
    let on = true;
    window.__formCrust = { get on() { return on; }, set: (v) => { on = !!v; return on; } };
    window.addEventListener('keydown', (e) => { if (e.key === 'c' || e.key === 'C') console.log('crust', window.__formCrust.set(!on)); });
    const R0 = renderer.render.bind(renderer);
    renderer.render = function (s, c) {
      if (!on || s !== scene || !c.isPerspectiveCamera || renderer.getRenderTarget() !== null || !FF.pov() || !(CO.reach < 1e5) || CO.reach >= c.far) return R0(s, c);
      const R = CO.reach;
      renderer.getDrawingBufferSize(size);
      if (farRT.width !== size.x || farRT.height !== size.y) { farRT.setSize(size.x, size.y); outRT.setSize(size.x, size.y); }
      // (the crust: the eye's view past the reach, with its depth)
      cc.copy(c); cc.near = R; cc.updateProjectionMatrix(); cc.updateMatrixWorld();
      renderer.setRenderTarget(farRT); R0(s, cc);
      // (the matte, painted over it in 2D)
      PU.uRes.value.copy(size); PU.uLogF.value = Math.log2(cc.far + 1);
      PU.uPI.value.copy(cc.projectionMatrixInverse); PU.uCW.value.copy(cc.matrixWorld);
      renderer.setRenderTarget(outRT); R0(qs, qc); renderer.setRenderTarget(null);
      // (the main slice, live to the reach, over the painted crust; its shadows the crust's)
      const bg = s.background, f0 = c.far, sm = renderer.shadowMap, au = sm.autoUpdate;
      s.background = outRT.texture; c.far = R; c.updateProjectionMatrix(); sm.autoUpdate = false;
      try { R0(s, c); } finally { sm.autoUpdate = au; s.background = bg; c.far = f0; c.updateProjectionMatrix(); }
    };
  })();
`;
}
