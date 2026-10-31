// THE FAR FIELD: what gameplay's camera (POV) draws past the view cone's reach (channels/view-cone.js), where the eye
// cannot resolve what is there and the page paints an impression instead, in one geometry pass. Mojulo web only.
//
//   the blanket  (FAR_BLANKET_GLSL, in the ground's own shader, channels/form-land.js) the grass past the reach is one
//                colour, the grass's, offset by its cell's dice (FAR_FIELD.blanket: its tone, a standing drift's colour,
//                a flower's on a share of a flowering cell's pixels), lit and shadowed as the ground is. It reads the
//                grass's FAR MAP (channels/form-grass.js `window.__formFar`: a strand a cell, its height, colour slot,
//                dice and the ground's height). No draw, no triangle
//   the contour  (farFieldScript) the frame is drawn once into an image with its depth, and one 2D pass over it, from
//                that eye only, paints the grass's SILHOUETTE: where the blanket's edge meets what is past it (the sky,
//                or ground farther than FAR_FIELD.edge × its own depth: a ridge, a bank) strands stand up the image from
//                the contour, a pixel wide and 1 to FAR_FIELD.fringe pixels tall by a fine world dice, darker at the
//                root, a flower's colour at a tip where one grows, lit by the light under them (the frame's colour at the
//                contour over the blanket's own). Then the frame's tone curve and colour space, as the canvas would
//   aerial       (a cutscene's camera, the grass's `aerial`) draws the whole field live: no blanket, no contour pass
//
// `window.__formFar.on` and F toggle the far field on a walkable page.
export const FAR_FIELD = Object.freeze({
  fringe: 3, edge: 1.2, strand: 0.12, ground: 0.35, tone: Object.freeze([0.6, 1.4]), samples: 4,
  blanket: Object.freeze({ tone: Object.freeze([0.85, 1.15]), flowers: 0.35, blend: 0.9 }),
});

// (the far map's reading, shared: a cell's dice, a world point's strand where it is grass at the ground's height, and
// its colour by its slot)
const FAR_MAP_GLSL = (C) => `uniform sampler2D tFarG;
uniform vec2 uFGo;
uniform ivec2 uFGn;
uniform float uFGc, uFGz0, uFGzr, uFGfl[ 16 ];
uniform vec3 uFGcol[ 16 ];
float farHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
vec4 farGrassAt( vec3 W ) {
  ivec2 c = ivec2( floor( ( W.xy - uFGo ) / uFGc ) );
  if ( c.x < 0 || c.y < 0 || c.x >= uFGn.x || c.y >= uFGn.y ) return vec4( 0.0 );
  vec4 t = texelFetch( tFarG, c, 0 );
  return t.r > 0.0 && abs( W.z - ( uFGz0 + t.b * uFGzr ) ) < ${C.ground.toFixed(2)} ? t : vec4( 0.0 );
}
vec3 farBlanketAlbedo( vec3 W, vec4 t ) {
  int si = int( t.g * 255.0 + 0.5 );
  vec3 a = uFGfl[ si ] > 0.5 ? ( farHash( W.xy * 3.7 ) < ${C.blanket.flowers.toFixed(2)} ? uFGcol[ si ] : uFGcol[ 0 ] ) : uFGcol[ si ];
  return a * mix( ${C.blanket.tone[0].toFixed(2)}, ${C.blanket.tone[1].toFixed(2)}, t.a );
}
`;

/** The blanket, in the ground's fragment shader: its uniforms and `farBlanket(P, nW)` → the blanket's albedo over the
 *  ground point P (rgb) and its weight (a: 0 inside the reach, 1 past it, eased in over the last of it). */
export const FAR_BLANKET_GLSL = FAR_MAP_GLSL(FAR_FIELD) + `uniform float uFarOn, uFarR;
vec4 farBlanket( vec3 P, vec3 nW ) {
  if ( uFarOn < 0.5 || nW.z < 0.5 ) return vec4( 0.0 );
  float d = length( P.xy - cameraPosition.xy ), k = smoothstep( uFarR * ${FAR_FIELD.blanket.blend.toFixed(2)}, uFarR, d );
  if ( k <= 0.0 ) return vec4( 0.0 );
  vec4 t = farGrassAt( P );
  return t.r > 0.0 ? vec4( farBlanketAlbedo( P, t ), k ) : vec4( 0.0 );
}
`;

/** The blanket's uniforms, the ground's, set by the grass (its far map) and each frame (on, the reach). */
export const farBlanketUniforms = () => `{ uFarOn: { value: 0 }, uFarR: { value: 1e6 }, tFarG: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat) }, uFGo: { value: new THREE.Vector2() }, uFGn: { value: new THREE.Vector2(1, 1) }, uFGc: { value: 1 }, uFGz0: { value: 0 }, uFGzr: { value: 1 }, uFGfl: { value: new Array(16).fill(0) }, uFGcol: { value: Array.from({ length: 16 }, () => new THREE.Vector3()) } }`;

const CONTOUR = (C) => `precision highp float;
uniform sampler2D tC, tD;
uniform vec2 uRes;
uniform float uLogF, uFarR;
uniform mat4 uPI, uCW;
uniform vec3 uEye;
varying vec2 vUv;
${FAR_MAP_GLSL(C)}
// (a pixel's view depth, from the log depth; and its world point, along its ray)
float viewW( ivec2 b ) { float d = texelFetch( tD, b, 0 ).r; return d >= 1.0 ? 1e9 : exp2( d * uLogF ) - 1.0; }
vec3 worldAt( ivec2 b, float w ) { vec4 r = uPI * vec4( ( vec2( b ) + 0.5 ) / uRes * 2.0 - 1.0, 1.0, 1.0 ); vec3 rv = r.xyz / r.w; return ( uCW * vec4( rv / -rv.z * w, 1.0 ) ).xyz; }
vec3 contour( ivec2 P ) {
  for ( int k = 1; k <= ${C.fringe}; k++ ) {
    ivec2 b = P - ivec2( 0, k );
    if ( b.y < 0 ) break;
    float wb = viewW( b );
    if ( wb > 1e8 ) continue;
    vec3 W = worldAt( b, wb );
    if ( length( W.xy - uEye.xy ) < uFarR ) continue;
    vec4 t = farGrassAt( W );
    if ( t.r <= 0.0 || viewW( b + ivec2( 0, 1 ) ) < wb * ${C.edge.toFixed(2)} ) continue;
    float tall = ceil( ${C.fringe.toFixed(1)} * farHash( floor( W.xy / ${C.strand.toFixed(2)} ) ) * ( 0.5 + 0.5 * t.r ) );
    if ( float( k ) > tall ) continue;
    int si = int( t.g * 255.0 + 0.5 );
    float bt = float( k ) / tall;
    vec3 light = texelFetch( tC, b, 0 ).rgb / max( farBlanketAlbedo( W, t ), vec3( 1e-3 ) );
    return ( uFGfl[ si ] > 0.5 && bt < 1.0 ? uFGcol[ 0 ] : uFGcol[ si ] ) * light * mix( ${C.tone[0].toFixed(2)}, ${C.tone[1].toFixed(2)}, bt ) * ( 0.85 + 0.3 * t.a );
  }
  return vec3( -1.0 );
}
void main() {
  vec3 f = contour( ivec2( floor( vUv * uRes ) ) );
  gl_FragColor = vec4( f.r < 0.0 ? texture2D( tC, vUv ).rgb : f, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** The far field's page source, after the grass and the view cone, in the form channel's scope (THREE, scene, renderer,
 *  LAYER_U: the ground's uniforms, which carry the blanket's). */
export function farFieldScript() {
  return `
  // --- the far field: the blanket past the view cone's reach, and its contour painted in 2D (channels/far-field.js) ---
  (function () {
    const CO = window.__mojCone, FF = window.__formFar; if (!CO || !FF) return;
    // (the blanket's far map, on the ground's uniforms)
    LAYER_U.tFarG.value = FF.tex; LAYER_U.uFGo.value.set(...FF.origin); LAYER_U.uFGn.value.set(...FF.n); LAYER_U.uFGc.value = FF.cell;
    LAYER_U.uFGz0.value = FF.z[0]; LAYER_U.uFGzr.value = FF.z[1]; LAYER_U.uFGcol.value = FF.cols; LAYER_U.uFGfl.value = FF.flowers;
    const size = new THREE.Vector2(), dt = new THREE.DepthTexture(1, 1); dt.type = THREE.FloatType;
    const frameRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: ${FAR_FIELD.samples}, depthTexture: dt });
    const PU = Object.assign({ tC: { value: frameRT.texture }, tD: { value: dt }, uRes: { value: new THREE.Vector2() }, uLogF: { value: 1 }, uFarR: LAYER_U.uFarR,
      uPI: { value: new THREE.Matrix4() }, uCW: { value: new THREE.Matrix4() }, uEye: { value: new THREE.Vector3() } },
      { tFarG: LAYER_U.tFarG, uFGo: LAYER_U.uFGo, uFGn: LAYER_U.uFGn, uFGc: LAYER_U.uFGc, uFGz0: LAYER_U.uFGz0, uFGzr: LAYER_U.uFGzr, uFGcol: LAYER_U.uFGcol, uFGfl: LAYER_U.uFGfl });
    const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: PU, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv;\\nvoid main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }', fragmentShader: ${JSON.stringify(CONTOUR(FAR_FIELD))} })));
    let on = true;
    FF.on = () => on;
    window.__formFarField = { get on() { return on; }, set: (v) => { on = !!v; return on; } };
    window.addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') console.log('far field', window.__formFarField.set(!on)); });
    const R0 = renderer.render.bind(renderer);
    renderer.render = function (s, c) {
      const live = on && FF.pov() && CO.reach < 1e5;
      LAYER_U.uFarOn.value = live ? 1 : 0; LAYER_U.uFarR.value = live ? CO.reach : 1e6;
      if (!live || s !== scene || !c.isPerspectiveCamera || renderer.getRenderTarget() !== null) return R0(s, c);
      // (the frame, once, into an image with its depth; then its contour painted over it and its tone curve, to the canvas)
      renderer.getDrawingBufferSize(size);
      if (frameRT.width !== size.x || frameRT.height !== size.y) frameRT.setSize(size.x, size.y);
      renderer.setRenderTarget(frameRT); R0(s, c); renderer.setRenderTarget(null);
      PU.uRes.value.copy(size); PU.uLogF.value = Math.log2(c.far + 1); PU.uPI.value.copy(c.projectionMatrixInverse); PU.uCW.value.copy(c.matrixWorld); PU.uEye.value.setFromMatrixPosition(c.matrixWorld);
      R0(qs, qc);
    };
  })();
`;
}
