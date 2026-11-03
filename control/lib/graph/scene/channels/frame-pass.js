// In-page script: THE FRAME PASS, a depth-aware softening of the far laid over the whole frame. Two things ask for it,
// and they share one pass (the frame drawn once to a target, laid on the canvas once):
//
//   the air      (channels/atmosphere.js `air.blur`): each pixel spread by how much air lies between it and the eye (the
//                air's optical depth, rebuilt from the depth), only past the view cone's reach and never nearer than a
//                share of the visibility
//   the crust    (channels/view-cone.js `cone.soften`): past the cone's reach the page draws impressions (a tree its card,
//                a tile of buildings its card, the grass its colour speckled at a pixel's grain), and the soften spreads
//                them by their distance past it, none at the reach and `soften` css pixels at `span` reaches, the sky at
//                its most, so the impression reads as the 3D world seen far off, with or without any air
//
// Where both are asked, a pixel takes the larger. A near thing never spreads onto the far behind it (each sample counts
// only as far as its own radius reaches), and nothing inside the reach is softened. The target holds exactly what the
// canvas would (tone-mapped and encoded as on screen: three does that for a target only when it is marked as an XR
// one), so the page looks the same at zero. It is wrapped round three's render FIRST (placed right after the scene is
// made), so every other wrapper of the page's render (the water's refraction, the live light's counters) sits outside it
// and sees a frame drawn to the canvas, and every scene hook is told so. A renderer that cannot draw to a half-float
// target, a camera that is not perspective and an XR session keep the plain frame.
//
// Absent both => NOT emitted. `window.__mojFrame` is the probe: { air, soften (css px, live), passes, set({ air?, soften? }) }.
import { safeJson } from '../emit-util.js';
import { atmosphereGlsl } from './atmosphere.js';
import { gradeGlsl, gradePageScript } from './grade.js';

/** The pass's measures: its taps, and the crust's ramp (none at the reach, its most at `span` reaches), the reach on a
 *  page without a view cone. */
export const FRAME_PASS = Object.freeze({ taps: 16, span: 3, reach: 40 });

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

// the composite: each pixel spread over a golden-angle disc by the larger of what asks, a sample counted only as far as
// its own radius reaches
const compositeFrag = (air, soften) => `uniform sampler2D tC;
uniform sampler2D tD;
uniform vec2 uRes;
uniform float uLogF, uFrom, uPx, uS, uSoft, uReach;
uniform vec3 uEye;
uniform mat4 uProjInv, uCamW;
varying vec2 vUv;
${air ? atmosphereGlsl(air, 'uEye') : ''}
float rad( vec2 uv ) {
  float d = texture2D( tD, uv ).x;
  vec4 p = uProjInv * vec4( uv * 2.0 - 1.0, 1.0, 1.0 ); vec3 dv = normalize( p.xyz / p.w );
  vec3 dw = ( uCamW * vec4( dv, 0.0 ) ).xyz;
  float r = 0.0;
  if ( d >= 0.99999 ) {
${air ? `    // (the air: the veil's air at the horizon, in its band)
    float hz = 1.0 - exp( - airDepth( normalize( vec3( dw.xy, 0.0 ) ) * ${f(air.sky)}, uS ) );
    r = uPx * hz * exp( - max( dw.z, 0.0 ) / ${f(air.band)} );
` : ''}${soften ? `    // (the crust: the sky is the farthest of all)
    r = max( r, uSoft );
` : ''}    return r;
  }
  float z = exp2( d * uLogF ) - 1.0;
${air ? `  float L = z / max( - dv.z, 1e-4 ), gate = clamp( ( z - uFrom ) / max( uFrom * 0.5, 1.0 ), 0.0, 1.0 );
  r = uPx * gate * sqrt( 1.0 - exp( - airDepth( dw * L, uS ) ) );
` : ''}${soften ? `  r = max( r, uSoft * clamp( ( z - uReach ) / max( uReach * ${f(FRAME_PASS.span - 1)}, 1.0 ), 0.0, 1.0 ) );
` : ''}  return r;
}
void main() {
  vec4 c0 = texture2D( tC, vUv );
  float r0 = rad( vUv );
  if ( r0 < 0.3 ) { gl_FragColor = c0; return; }
  vec3 acc = c0.rgb; float wsum = 1.0;
  for ( int i = 0; i < ${FRAME_PASS.taps}; i++ ) {
    float fi = float( i ) + 0.5, rr = r0 * sqrt( fi / ${f(FRAME_PASS.taps)} ), a = fi * 2.39996323;
    vec2 uv = vUv + vec2( cos( a ), sin( a ) ) * rr / uRes;
    float w = clamp( rad( uv ) - rr + 0.5, 0.0, 1.0 );
    acc += texture2D( tC, uv ).rgb * w; wsum += w;
  }
  gl_FragColor = vec4( acc / wsum, c0.a );
}
`;

// the composite with the grade (channels/grade.js) laid last: the softened far (when the air or the crust ask) is what the
// grade reads, else the frame as drawn
const gradedFrag = (air, soften) => (air || soften
  ? compositeFrag(air, soften).replace('void main() {', 'vec4 softened( vec2 vUv ) {').replace('if ( r0 < 0.3 ) { gl_FragColor = c0; return; }', 'if ( r0 < 0.3 ) return c0;').replace('gl_FragColor = vec4( acc / wsum, c0.a );', 'return vec4( acc / wsum, c0.a );') + `vec4 gradeBase( vec2 uv ) { return softened( uv ); }
`
  : `uniform sampler2D tC;
uniform vec2 uRes;
varying vec2 vUv;
vec4 gradeBase( vec2 uv ) { return texture2D( tC, uv ); }
`) + `${gradeGlsl()}void main() { gl_FragColor = gradeFrame( vUv ); }
`;

/** The frame pass's page source, right after the scene is made; `air` an atmosphereInput (its blur over 0) or null,
 *  `soften` the crust's css pixels or 0. Nothing when neither asks. */
export function framePassScript({ air = null, soften = 0, grade = null } = {}) {
  const A = air && air.blur > 0 ? air : null, S = soften > 0 ? soften : 0, G = grade ? (grade === true ? {} : grade) : null;
  if (!A && !S && !G) return '';
  return `
// --- the frame pass: ${A || S ? 'the far softened' : ''}${A ? ' by the air' : ''}${A && S ? ' and' : ''}${S ? ' past the crust' : ''}${G ? `${A || S ? ', ' : ''}the grade` : ''} (channels/frame-pass.js) ---
(function () {
  const FP = ${safeJson({ air: A ? { blur: A.blur, from: A.from, sigma: A.sigma } : null, soften: S, reach: FRAME_PASS.reach })};
  const probe = window.__mojFrame = { air: FP.air ? FP.air.blur : 0, soften: FP.soften, passes: 0,
    set(o) { if (o && Number.isFinite(o.air)) this.air = Math.max(0, o.air); if (o && Number.isFinite(o.soften)) this.soften = Math.max(0, o.soften); return this; } };${G ? gradePageScript(G) : ''}
  const ext = renderer.extensions;
  if (!(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))) return;
  const gl = renderer.getContext(), aa = !!(renderer.getContextAttributes() || {}).antialias;
  const RT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: aa ? Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0) : 0, depthTexture: new THREE.DepthTexture(1, 1) });
  // (three tone-maps and encodes a target only as it does the canvas when the target is marked as an XR one)
  RT.texture.colorSpace = THREE.SRGBColorSpace; RT.isXRRenderTarget = true;
  const BU = { tC: { value: RT.texture }, tD: { value: RT.depthTexture }, uRes: { value: new THREE.Vector2() }, uLogF: { value: 1 }, uFrom: { value: FP.air ? FP.air.from : 0 }, uPx: { value: 0 },
    uS: { value: FP.air ? FP.air.sigma : 0 }, uSoft: { value: 0 }, uReach: { value: FP.reach }, uEye: { value: new THREE.Vector3() }, uProjInv: { value: new THREE.Matrix4() }, uCamW: { value: new THREE.Matrix4() }${G ? ', uG0: { value: new THREE.Vector4() }, uG1: { value: new THREE.Vector4() }, uG2: { value: new THREE.Vector4() }, uG3: { value: new THREE.Vector3() }' : ''} };
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: BU, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv;\\nvoid main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }', fragmentShader: ${JSON.stringify(G ? gradedFrag(A, S) : compositeFrag(A, S))} }));
  q.frustumCulled = false;
  const BS = new THREE.Scene(), BC = new THREE.Camera(), R0 = renderer.render.bind(renderer), sz = new THREE.Vector2();
  renderer.render = function (s, cam) {
    if (s !== scene || ${G ? '(probe.air <= 0 && probe.soften <= 0 && !grade.on())' : '(probe.air <= 0 && probe.soften <= 0)'} || renderer.getRenderTarget() !== null || !cam.isPerspectiveCamera || (renderer.xr && renderer.xr.isPresenting)) return R0(s, cam);
    renderer.getDrawingBufferSize(sz);
    if (RT.width !== sz.x || RT.height !== sz.y) RT.setSize(sz.x, sz.y);
    // (the scene's hooks see the frame as drawn to the canvas: a hook that stands down for a prepass's target still runs)
    const hook = scene.onBeforeRender, after = scene.onAfterRender;
    scene.onBeforeRender = function (r, sc, c, rt) { return hook.call(this, r, sc, c, rt === RT ? null : rt); };
    scene.onAfterRender = function (r, sc, c, rt) { return after.call(this, r, sc, c, rt === RT ? null : rt); };
    try { renderer.setRenderTarget(RT); R0(s, cam); } finally { renderer.setRenderTarget(null); scene.onBeforeRender = hook; scene.onAfterRender = after; }
    const dpr = renderer.getPixelRatio(), reach = window.__mojCone ? window.__mojCone.reach : FP.reach;
    BU.uRes.value.copy(sz); BU.uLogF.value = Math.log2(cam.far + 1); BU.uPx.value = probe.air * dpr; BU.uSoft.value = probe.soften * dpr; BU.uReach.value = reach;
    if (FP.air) { BU.uFrom.value = Math.max(FP.air.from, window.__mojCone ? window.__mojCone.reach : 0); BU.uS.value = scene.fog ? scene.fog.density : FP.air.sigma; }
    BU.uEye.value.setFromMatrixPosition(cam.matrixWorld); BU.uProjInv.value.copy(cam.projectionMatrixInverse); BU.uCamW.value.copy(cam.matrixWorld);
${G ? `    __gradeU(BU, (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000);
` : ''}    R0(BS, BC); probe.passes++;
  };
  BS.add(q);
})();
`;
}
