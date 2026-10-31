// THE FAR FIELD: what gameplay's camera (POV) draws past the view cone's reach (channels/view-cone.js), where the eye
// cannot resolve what is there and the page paints an impression instead, in one geometry pass. Mojulo web only.
//
//   the blanket  (FAR_BLANKET_GLSL, in the ground's own shader, channels/form-land.js) the grass past the reach is one
//                colour, the grass's, offset by its cell's dice (FAR_FIELD.blanket: its tone, a standing drift's colour,
//                a flower's on a share of a flowering cell's pixels), lit and shadowed as the ground is. It reads the
//                grass's FAR MAP (channels/form-grass.js `window.__formFar`: a strand a cell, its height, colour slot,
//                dice and the ground's height). No draw, no triangle
//   the contour  (farFieldScript) the land's silhouette, SURVEYED, not read back from the frame: the eye's point of
//                view solved from the grass's map (form/survey.js contourScan, embedded whole): on each bearing of a full
//                turn, where the ground peaks against what is past it (the sky, or ground farther than FAR_FIELD.edge ×
//                its distance), its point, what stands there, its colour and its dice. The art at each: strokes a pixel
//                wide and up to FAR_FIELD.fringe pixels tall, the colour of what stands there (a flower's at a tip),
//                darker at the root, lit and shadowed as the ground is, anchored to the world, in one draw, depth-tested
//                against whatever stands nearer and standing over the ridge into the sky. A point of view is solved once
//                for its cell (FAR_FIELD.cell m of the eye's ground), kept once walked (FAR_FIELD.keep cells), and the
//                cells round it are solved while the page is idle, the probable next
//   aerial       (a cutscene's camera, the grass's `aerial`) draws the whole field live: no blanket, no contour pass
//
// `window.__formFarField` ({ on, set(bool), solved: the cells kept }) and F toggle the far field on a walkable page.
import { contourScan } from '../../form/survey.js';

export const FAR_FIELD = Object.freeze({
  fringe: 3, edge: 1.2, ground: 0.35, tone: Object.freeze([0.6, 1.4]), px: 1.2, bearings: 1440, strands: 3, cell: 2, keep: 64, most: 60000,
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


/** The far field's page source, after the grass and the view cone, in the form channel's scope (THREE, scene, LAYER_U:
 *  the ground's uniforms, which carry the blanket's). */
export function farFieldScript() {
  const C = FAR_FIELD;
  return `
  // --- the far field: the blanket past the view cone's reach, and the contour surveyed from the eye (channels/far-field.js) ---
  (function () {
    const CO = window.__mojCone, FF = window.__formFar; if (!CO || !FF) return;
    const FC = ${JSON.stringify(C)};
    // (the blanket's far map, on the ground's uniforms)
    LAYER_U.tFarG.value = FF.tex; LAYER_U.uFGo.value.set(...FF.origin); LAYER_U.uFGn.value.set(...FF.n); LAYER_U.uFGc.value = FF.cell;
    LAYER_U.uFGz0.value = FF.z[0]; LAYER_U.uFGzr.value = FF.z[1]; LAYER_U.uFGcol.value = FF.cols; LAYER_U.uFGfl.value = FF.flowers;
    // (the surveyor: the contour from a point of view, form/survey.js)
    const contourScan = ${contourScan.toString()};
    // (the art: a stroke an instance, its root, height, colour slot and dice; a pixel wide, at most FC.fringe tall)
    const sg = new THREE.InstancedBufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 1], 3)); sg.setIndex([0, 1, 2, 0, 2, 3]);
    const IB = new THREE.InstancedInterleavedBuffer(new Float32Array(FC.most * 6), 6, 1); IB.setUsage(THREE.DynamicDrawUsage);
    sg.setAttribute('aRoot', new THREE.InterleavedBufferAttribute(IB, 4, 0)); sg.setAttribute('aLook', new THREE.InterleavedBufferAttribute(IB, 2, 4)); sg.instanceCount = 0;
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(FF.centre[0] + FF.n[0] * FF.cell / 2, FF.centre[1] + FF.n[1] * FF.cell / 2, FF.z[0]), Math.hypot(FF.n[0], FF.n[1]) * FF.cell);
    const SU = { uPxm: { value: 0.001 }, uFGcol: LAYER_U.uFGcol, uFGfl: LAYER_U.uFGfl };
    const sm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    sm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, SU);
      sh.vertexShader = 'uniform float uPxm, uFGfl[ 16 ];\\nuniform vec3 uFGcol[ 16 ];\\nattribute vec4 aRoot;\\nattribute vec2 aLook;\\nvarying vec3 vCol;\\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', [
          'vec3 objectNormal = vec3( 0.0, 0.0, 1.0 );',
          'float dE = length( aRoot.xy - cameraPosition.xy ), hW = min( aRoot.w, ' + FC.fringe.toFixed(1) + ' * uPxm * dE ), bt = position.z;',
          'int si = int( aLook.x + 0.5 );',
          'vCol = ( uFGfl[ si ] > 0.5 && bt < 0.99 ? uFGcol[ 0 ] : uFGcol[ si ] ) * mix( ' + FC.tone[0].toFixed(2) + ', ' + FC.tone[1].toFixed(2) + ', bt ) * ( 0.85 + 0.3 * aLook.y );'].join('\\n'))
        .replace('#include <begin_vertex>', 'vec2 eyeD = normalize( aRoot.xy - cameraPosition.xy + vec2( 1e-4, 0.0 ) );\\nvec3 transformed = vec3( aRoot.xy + vec2( -eyeD.y, eyeD.x ) * position.x * ' + FC.px.toFixed(2) + ' * uPxm * dE, aRoot.z + position.z * hW );');
      sh.fragmentShader = 'varying vec3 vCol;\\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n  diffuseColor.rgb *= vCol;');
    };
    sm.customProgramCacheKey = () => 'far-field-strokes';
    const strokes = new THREE.Mesh(sg, sm); strokes.receiveShadow = true; strokes.visible = false; scene.add(strokes);
    // (a point of view solved once for its cell, kept once walked; the cells round it solved while the page is idle)
    const kept = new Map(), keyOf = (i, j, R) => i + ',' + j + ',' + Math.round(R), queue = [];
    const solve = (i, j, R) => { const k = keyOf(i, j, R); let S = kept.get(k);
      if (!S) { S = contourScan(FF, [(i + 0.5) * FC.cell, (j + 0.5) * FC.cell, eyeZ], { reach: R, bearings: FC.bearings, edge: FC.edge, strands: FC.strands }); kept.set(k, S); if (kept.size > FC.keep) kept.delete(kept.keys().next().value); }
      else { kept.delete(k); kept.set(k, S); }
      return S; };
    const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 50));
    const ahead = (dl) => { while (queue.length && dl.timeRemaining() > 4) { const [i, j, R] = queue.shift(); solve(i, j, R); } if (queue.length) idle(ahead); };
    let on = true, at = '', eyeZ = 0;
    window.__formFarField = { get on() { return on; }, set: (v) => { on = !!v; return on; }, get solved() { return kept.size; } };
    window.addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') console.log('far field', window.__formFarField.set(!on)); });
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (r, s, cam, rt) {
      if (prev) prev.call(this, r, s, cam, rt);
      if (!cam.isPerspectiveCamera) return;
      const live = on && FF.pov() && CO.reach < 1e5;
      LAYER_U.uFarOn.value = live ? 1 : 0; LAYER_U.uFarR.value = live ? CO.reach : 1e6; strokes.visible = live;
      if (!live) return;
      SU.uPxm.value = CO.px;
      const i = Math.floor(CO.eye.x / FC.cell), j = Math.floor(CO.eye.y / FC.cell), R = CO.reach, k = keyOf(i, j, R);
      if (k === at) return;
      at = k; eyeZ = CO.eye.z;
      const S = solve(i, j, R), n = Math.min(FC.most, S.length / 6);
      IB.array.set(S.subarray(0, n * 6)); IB.needsUpdate = true; sg.instanceCount = n;
      // (the probable next: the cells round this one)
      queue.length = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (!kept.has(keyOf(i + di, j + dj, R))) queue.push([i + di, j + dj, R]);
      if (queue.length) idle(ahead);
    };
  })();
`;
}
